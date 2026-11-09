import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useSocket } from '../hooks/useSocket.js'

export default function AssessoresTab({ idReuniao }) {
  const { cabinetKey } = useAuth()
  const [assessores, setAssessores] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const socket = useSocket(idReuniao)
  const load = async () => {
    const r = await fetch(`/api/vinculos?deputadoKey=${encodeURIComponent(cabinetKey||'')}`)
    const j = await r.json().catch(()=>[])
    setAssessores(j.filter(v=>v.status==='aceito'))
  }
  useEffect(()=>{ load() }, [cabinetKey, idReuniao])
  useEffect(()=>{
    if(!socket) return
    const on = () => load()
    socket.on('vinculo_changed', on)
    return ()=>socket.off('vinculo_changed', on)
  }, [socket])

  const doDelete = async (vid) => {
    await fetch(`/api/vinculos/${vid}`, { method:'DELETE' }).catch(()=>{})
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-extrabold text-alesp mb-2">Assessores vinculados</h2>
      {assessores.length===0 && <div className="text-sm text-slate-500">Nenhum assessor vinculado.</div>}
      {assessores.map(a=>(
        <div key={a.id} className="flex items-center justify-between border-b py-2 text-sm">
          <span>{a.assessor_name}</span>
          <button onClick={()=>setConfirmDelete(a)} className="bg-red-600 text-white rounded w-6 h-6 text-xs font-bold" title="Excluir vínculo">×</button>
        </div>
      ))}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <div className="font-bold mb-2">Excluir vínculo?</div>
            <div className="text-sm text-slate-600 mb-4">As orientações de "{confirmDelete.assessor_name}" para você serão removidas.</div>
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
