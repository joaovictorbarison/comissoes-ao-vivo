import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useSocket } from '../hooks/useSocket.js'
import { useProcessoLinks } from '../hooks/useProcessoLinks.js'
import { proposituraUrl, votoUrl } from '../lib/legisLinks.js'
import AssessoresTab from './AssessoresTab.jsx'

const STATUS_LABEL = {
  pendente: 'PENDENTE',
  em_discussao: 'EM DISCUSSÃO',
  em_votacao: 'EM VOTAÇÃO',
  aprovado_relator: 'APROVADO VOTO DO RELATOR',
  rejeitado_relator: 'REJEITADO VOTO DO RELATOR',
  aprovado_separado: 'APROVADO VOTO EM SEPARADO',
  retirado: 'RETIRADO'
}
const STATUS_COLOR = {
  pendente: 'bg-slate-200 text-slate-700',
  em_discussao: 'bg-yellow-300 text-yellow-900',
  em_votacao: 'bg-blue-300 text-blue-900',
  aprovado_relator: 'bg-green-300 text-green-900',
  rejeitado_relator: 'bg-red-300 text-red-900',
  aprovado_separado: 'bg-green-300 text-green-900',
  retirado: 'bg-slate-400 text-slate-900'
}

function cardTone(status) {
  if (status==='aprovado_relator') return 'bg-green-100 border-green-300'
  if (status==='rejeitado_relator') return 'bg-red-100 border-red-300'
  if (status==='vista') return 'bg-orange-100 border-orange-300'
  if (status==='retirado') return 'bg-slate-200 border-slate-400'
  if (status==='em_discussao') return 'bg-yellow-100 border-yellow-300'
  if (status==='em_votacao') return 'bg-blue-100 border-blue-300'
  return 'bg-white border-slate-200'
}

export default function PautaAssessor() {
  const { id } = useParams()
  const { cabinetKey, name, profile, deputadoVinculado } = useAuth()
  const [items, setItems] = useState([])
  const [meeting, setMeeting] = useState({})
  const [notes, setNotes] = useState([])
  const [drafts, setDrafts] = useState({})
  const [vinculos, setVinculos] = useState([])
  const [vistas, setVistas] = useState({})
  const socket = useSocket(id)
  const linksMap = useProcessoLinks(items)

  const load = async () => {
    const res = await fetch(`/api/reuniao/${id}`)
    const j = await res.json()
    setItems(j.items || j || [])
    setMeeting(j)
    const n = await fetch(`/api/reuniao/${id}/anotacoes?cabinetKey=${encodeURIComponent(cabinetKey||'')}`).then(r=>r.json()).catch(()=>[])
    setNotes(Array.isArray(n) ? n : [])
    const v = await fetch(`/api/reuniao/${id}/vistas`).then(r=>r.json()).catch(()=>({}))
    setVistas(v)
  }
  const loadVinculos = async () => {
    const r = await fetch(`/api/vinculos?deputadoKey=${encodeURIComponent(cabinetKey||'')}`)
    setVinculos(await r.json().catch(()=>[]))
  }
  useEffect(()=>{ if(id) { load(); loadVinculos() } }, [id, cabinetKey])
  useEffect(()=>{
    if(!id || !name || profile !== 'deputado') return
    fetch(`/api/reuniao/${id}/presenca`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, profile }) }).catch(()=>{})
  }, [id, name, profile])
  useEffect(()=>{
    if(!id || profile !== 'assessor' || !name || !deputadoVinculado) return
    fetch(`/api/reuniao/${id}/vinculo`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ assessorName: name, deputadoName: deputadoVinculado }) }).catch(()=>{})
  }, [id, profile, name, deputadoVinculado])
  useEffect(()=>{
    if(!socket) return
    const onStatus = () => load()
    const onNote = () => load()
    const onVinculo = () => { loadVinculos(); load() }
    socket.on('official_status_changed', onStatus)
    socket.on('note_created', onNote)
    socket.on('vinculo_changed', onVinculo)
    return ()=>{ socket.off('official_status_changed', onStatus); socket.off('note_created', onNote); socket.off('vinculo_changed', onVinculo) }
  }, [socket])

  const acceptVinculo = async (vid) => {
    await fetch(`/api/reuniao/${id}/vinculo/${vid}/aceitar`, { method:'POST' })
    loadVinculos(); load()
  }
  const refuseVinculo = async (vid) => {
    await fetch(`/api/reuniao/${id}/vinculo/${vid}/recusar`, { method:'POST' })
    loadVinculos()
  }

  const saveNote = async (itemId) => {
    const text = drafts[itemId]?.trim()
    if(!text) return
    const r = await fetch(`/api/reuniao/${id}/anotacao`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, text, authorName:name, cabinetKey})})
    if (!r.ok) { alert('Vínculo pendente ou recusado. Aguarde o aceite do deputado.'); return }
    setDrafts(d=>({...d, [itemId]:''}))
    load()
  }

  const notesFor = (itemId) => notes.filter(n => String(n.item_id)===String(itemId))
  const pendentes = vinculos.filter(v=>v.status==='pendente')
  const comissaoNome = meeting?.solicitante || meeting?.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || ''

  return (
    <div>
      <h1 className="text-lg font-extrabold text-alesp">{comissaoNome}</h1>
      <div className="flex gap-2 my-3">
        <a href={`/api/reuniao/${id}/relatorio-assessoria.pdf?cabinetKey=${encodeURIComponent(cabinetKey)}`} className="bg-alesp text-white rounded-lg px-4 py-2 text-sm font-bold">Baixar relatório</a>
      </div>
      {profile==='deputado' && pendentes.length>0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
          <div className="font-bold text-sm mb-2">Pedido(s) de vínculo de assessor:</div>
          {pendentes.map(v=>(
            <div key={v.id} className="flex items-center gap-2 text-sm py-1">
              <span>{v.assessor_name} quer te assessorar</span>
              <button onClick={()=>acceptVinculo(v.id)} className="bg-green-600 text-white rounded px-3 py-1 font-bold">Aceitar</button>
              <button onClick={()=>refuseVinculo(v.id)} className="bg-red-600 text-white rounded px-3 py-1 font-bold">Recusar</button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div className="order-2 lg:order-1">
      {items.map(it => {
        const status = it.status_oficial || 'pendente'
        const proc = it.processoDadosView || it.processo || {}
        const vote = (it.documentosVoto||[])[0] || {}
        const pUrl = proposituraUrl(linksMap[proc.idProcesso])
        const vUrl = votoUrl(vote)
        const vistaNames = vistas[it.id] || []
        const isVista = status==='vista' || vistaNames.length>0
        return (
          <article key={it.id} className={`border-2 rounded-xl overflow-hidden mb-3 ${cardTone(status)}`}>
            <div className={`px-4 py-2 text-xs font-extrabold flex justify-between ${isVista && vistaNames.length ? 'bg-orange-300 text-orange-900' : (STATUS_COLOR[status]||'bg-slate-200 text-slate-700')}`}>
              <span>● {isVista && vistaNames.length ? `VISTA SOLICITADA: ${vistaNames.join(', ')}` : STATUS_LABEL[status]||status}</span>
            </div>
            <div className="p-4">
              <span className="bg-alesp text-white text-xs px-2 py-1 rounded-full">ITEM {it.nuOrdem} • {pUrl ? <a href={pUrl} target="_blank" rel="noreferrer" className="underline text-white">{proc.txDescricao}</a> : proc.txDescricao}</span>
              <div className="font-extrabold mt-2">{proc.txEmenta}</div>
              <div className="text-sm text-slate-600">Autor: {proc.txNomeAutores}</div>
              {vote.autores && vote.conclusao && <div className="text-sm text-slate-600">{vUrl ? <a href={vUrl} target="_blank" rel="noreferrer" className="text-alesp underline">Relator: {vote.autores} — <b>{vote.conclusao}</b></a> : <>Relator: {vote.autores} — <b>{vote.conclusao}</b></>}</div>}
              <div className="bg-amber-50 border border-dashed border-yellow-300 rounded-lg p-2 mt-3">
                <div className="text-xs font-bold">Orientação da assessoria</div>
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
        {profile==='deputado' && <div className="order-1 lg:order-2"><AssessoresTab idReuniao={id} /></div>}
      </div>
    </div>
  )
}
