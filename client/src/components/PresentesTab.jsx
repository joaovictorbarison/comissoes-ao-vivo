import React, { useEffect, useState } from 'react'
import { useSocket } from '../hooks/useSocket.js'

export default function PresentesTab({ idReuniao }) {
  const [presencas, setPresencas] = useState([])
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
  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-extrabold text-alesp mb-2">Presentes</h2>
      {presencas.length===0 && <div className="text-sm text-slate-500">Nenhum parlamentar entrou ainda.</div>}
      {presencas.map(p=>(
        <div key={p.id} className="flex items-center justify-between border-b py-2 text-sm">
          <span>{p.name} <span className="text-slate-500">({p.profile})</span></span>
          {p.confirmed ? <span className="text-green-700 font-bold">Confirmado ✓</span> : <button onClick={()=>confirm(p.id)} className="bg-alesp text-white rounded px-3 py-1">Confirmar</button>}
        </div>
      ))}
    </div>
  )
}
