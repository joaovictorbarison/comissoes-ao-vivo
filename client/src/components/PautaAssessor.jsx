import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useSocket } from '../hooks/useSocket.js'

const STATUS_LABEL = {
  pendente: 'PENDENTE',
  em_discussao: 'EM DISCUSSÃO',
  em_votacao: 'EM VOTAÇÃO',
  aprovado_relator: 'APROVADO VOTO DO RELATOR',
  rejeitado_relator: 'REJEITADO VOTO DO RELATOR',
  aprovado_separado: 'APROVADO VOTO EM SEPARADO',
  vista: 'VISTA SOLICITADA',
  retirado: 'RETIRADO'
}
const STATUS_COLOR = {
  pendente: 'bg-slate-200 text-slate-700',
  em_discussao: 'bg-yellow-100 text-yellow-800',
  em_votacao: 'bg-blue-100 text-blue-800',
  aprovado_relator: 'bg-green-100 text-green-800',
  rejeitado_relator: 'bg-red-100 text-red-800',
  aprovado_separado: 'bg-green-200 text-green-900',
  vista: 'bg-orange-100 text-orange-800',
  retirado: 'bg-slate-300 text-slate-800'
}

export default function PautaAssessor() {
  const { id } = useParams()
  const { cabinetKey, name, profile } = useAuth()
  const [items, setItems] = useState([])
  const [notes, setNotes] = useState([])
  const [drafts, setDrafts] = useState({})
  const socket = useSocket(id)

  const load = async () => {
    const res = await fetch(`/api/reuniao/${id}`)
    const j = await res.json()
    setItems(j.items || j || [])
    const n = await fetch(`/api/reuniao/${id}/anotacoes`).then(r=>r.json()).catch(()=>[])
    setNotes(Array.isArray(n) ? n : [])
  }
  useEffect(()=>{ if(id) load() }, [id])
  useEffect(()=>{
    if(!socket) return
    const onStatus = () => load()
    const onNote = () => load()
    socket.on('official_status_changed', onStatus)
    socket.on('note_created', onNote)
    return ()=>{ socket.off('official_status_changed', onStatus); socket.off('note_created', onNote) }
  }, [socket])

  const saveNote = async (itemId) => {
    const text = drafts[itemId]?.trim()
    if(!text) return
    await fetch(`/api/reuniao/${id}/anotacao`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, text, authorName:name, cabinetKey})})
    setDrafts(d=>({...d, [itemId]:''}))
    load()
  }

  const notesFor = (itemId) => notes.filter(n => String(n.item_id)===String(itemId))

  return (
    <div>
      <h1 className="text-lg font-extrabold text-alesp">Pauta completa — Assessor/Deputado</h1>
      <p className="text-sm text-slate-600 mb-4">Faixa oficial no topo • anotações privadas assessor ↔ deputado</p>
      {items.map(it => {
        const status = it.status_oficial || 'pendente'
        const proc = it.processoDadosView || it.processo || {}
        const vote = (it.documentosVoto||[])[0] || {}
        return (
          <article key={it.id} className="bg-white border rounded-xl overflow-hidden mb-3">
            <div className={`px-4 py-2 text-xs font-extrabold flex justify-between ${STATUS_COLOR[status]||''}`}>
              <span>● {STATUS_LABEL[status]||status}</span><span>Secretário • ao vivo</span>
            </div>
            <div className="p-4">
              <span className="bg-alesp text-white text-xs px-2 py-1 rounded-full">ITEM {it.nuOrdem} • {proc.txDescricao}</span>
              <div className="font-extrabold mt-2">{proc.txEmenta}</div>
              <div className="text-sm text-slate-600">Autor: {proc.txNomeAutores} {vote.autores && <>• Relator: {vote.autores} — <b>{vote.conclusao}</b></>}</div>
              <div className="bg-amber-50 border border-dashed border-yellow-300 rounded-lg p-2 mt-3">
                <div className="text-xs font-bold">🔒 Nota do assessor → deputado (privada)</div>
                {notesFor(it.id).map(n=>(<div key={n.id} className="text-sm mt-1"><b>{n.author_name}:</b> {n.text}</div>))}
                <div className="flex gap-2 mt-2">
                  <input value={drafts[it.id]||''} onChange={e=>setDrafts(d=>({...d,[it.id]:e.target.value}))} placeholder="Nova orientação/observação…" className="flex-1 border rounded-lg p-2 text-sm" />
                  <button onClick={()=>saveNote(it.id)} className="bg-alesp text-white rounded-lg px-3 py-2 text-sm font-bold">Salvar</button>
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
