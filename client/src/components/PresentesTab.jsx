import React, { useEffect, useState } from 'react'
import { useSocket } from '../hooks/useSocket.js'

export default function PresentesTab({ idReuniao }) {
  const [presencas, setPresencas] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const socket = useSocket(idReuniao)
  const load = async () => {
    const r = await fetch(`/api/reuniao/${idReuniao}/presencas`)
    setPresencas(await r.json().catch(()=>[]))
  }
  useEffect(()=>{ load() }, [idReuniao])
  useEffect(()=>{
    if(!socket) return
    const on = () => load()
    socket.on('presence_pending', on)
    socket.on('presence_confirmed', on)
    return ()=>{ socket.off('presence_pending', on); socket.off('presence_confirmed', on) }
  }, [socket])

  const confirm = async (pid) => {
    await fetch(`/api/reuniao/${idReuniao}/presenca/${pid}/confirmar`, {method:'POST'})
    load()
  }
  const doDelete = async (pid) => {
    await fetch(`/api/reuniao/${idReuniao}/presenca/${pid}`, {method:'DELETE'})
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-extrabold text-alesp mb-2">Presentes</h2>
      {presencas.length===0 && <div className="text-sm text-slate-500">Nenhum parlamentar entrou ainda.</div>}
      {presencas.map(p=>(
        <div key={p.id} className="flex items-center justify-between border-b py-2 text-sm">
          <span>{p.name} <span className="text-slate-500">({p.profile})</span></span>
          <span className="flex items-center gap-2">
            {p.confirmed ? <span className="text-green-700 font-bold">Confirmado ✓</span> : <button onClick={()=>confirm(p.id)} className="bg-alesp text-white rounded px-3 py-1">Confirmar</button>}
            <button onClick={()=>setConfirmDelete(p)} className="bg-red-600 text-white rounded w-6 h-6 text-xs font-bold" title="Excluir">×</button>
          </span>
        </div>
      ))}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <div className="font-bold mb-2">Excluir presença?</div>
            <div className="text-sm text-slate-600 mb-4">Excluir "{confirmDelete.name}" dos presentes?</div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setConfirmDelete(null)} className="bg-slate-100 rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={()=>doDelete(confirmDelete.id)} className="bg-red-600 text-white rounded px-4 py-2 text-sm font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
