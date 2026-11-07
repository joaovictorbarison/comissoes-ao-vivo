import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import PresentesTab from './PresentesTab.jsx'

const ACTIONS = [
  {k:'em_discussao', label:'Em discussão'},
  {k:'em_votacao', label:'Em votação'},
  {k:'aprovado_relator', label:'Aprovado ✓'},
  {k:'rejeitado_relator', label:'Rejeitado ✕'},
  {k:'vista', label:'Vista'},
  {k:'retirado', label:'Retirado'}
]

export default function PautaSecretario() {
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState(null)
  const socket = useSocket(id)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    const j = await r.json()
    setItems(j.items || j || [])
    setActiveId(j.active_item_id || null)
  }
  useEffect(()=>{ if(id) load() }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => load()
    socket.on('official_status_changed', on)
    socket.on('active_item_changed', on)
    return ()=>{ socket.off('official_status_changed', on); socket.off('active_item_changed', on) }
  }, [socket])

  const setStatus = async (itemId, status) => {
    await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status})})
    load()
  }
  const setActive = async (itemId) => {
    await fetch(`/api/reuniao/${id}/item-ativo`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId})})
    load()
  }

  return (
    <div>
      <h1 className="text-lg font-extrabold text-alesp">Painel do Secretário</h1>
      <div className="grid lg:grid-cols-[1fr_300px] gap-4 mt-4">
        <div>
          {items.map(it=>{
            const proc = it.processoDadosView||{}
            const isActive = String(activeId)===String(it.id)
            return (
              <div key={it.id} className={`bg-white border-2 rounded-xl p-4 mb-3 ${isActive?'border-yellow-400':'border-slate-200'}`}>
                <div className="flex justify-between text-xs"><span>{isActive?'▶ ITEM ATUAL NA TV':'Item '+it.nuOrdem}</span><span>{proc.txDescricao}</span></div>
                <div className="font-bold mt-1">{proc.txEmenta}</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {ACTIONS.map(a=>(<button key={a.k} onClick={()=>setStatus(it.id,a.k)} className="bg-slate-100 hover:bg-slate-200 rounded px-3 py-2 text-sm">{a.label}</button>))}
                  <button onClick={()=>setActive(it.id)} className="bg-alesp text-white rounded px-3 py-2 text-sm">📺 Definir como em votação (TV)</button>
                </div>
                <div className="text-xs text-slate-500 mt-2">Status atual: {it.status_oficial||'pendente'}</div>
              </div>
            )
          })}
          <a href={`/api/reuniao/${id}/relatorio.pdf`} className="block text-center bg-yellow-400 text-slate-900 font-bold rounded-xl p-3">Encerrar e baixar PDF final</a>
        </div>
        <PresentesTab idReuniao={id} />
      </div>
    </div>
  )
}
