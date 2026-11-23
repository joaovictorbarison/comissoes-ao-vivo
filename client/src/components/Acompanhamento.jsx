import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import { useProcessoLinks } from '../hooks/useProcessoLinks.js'
import { proposituraUrl, votoUrl } from '../lib/legisLinks.js'
import { isTerminalStatus, STATUS_SHORT, useOpenItems } from '../lib/itemCollapse.js'
import PresencasPublicas from './PresencasPublicas.jsx'

const STATUS_LABEL = {
  pendente: 'PENDENTE',
  em_discussao: 'EM DISCUSSÃO',
  em_votacao: 'EM VOTAÇÃO',
  aprovado_relator: 'APROVADO VOTO DO RELATOR',
  aprovado_simbolico: 'APROVADO VOTO DO RELATOR',
  aprovado_nominal: 'APROVADO VOTO DO RELATOR',
  rejeitado_relator: 'REJEITADO VOTO DO RELATOR',
  rejeitado_simbolico: 'REJEITADO VOTO DO RELATOR',
  rejeitado_nominal: 'REJEITADO VOTO DO RELATOR',
  aprovado_separado: 'APROVADO VOTO EM SEPARADO',
  retirado: 'RETIRADO',
  vista: 'VISTA',
  nao_deliberado: 'NÃO DELIBERADO'
}
const STATUS_COLOR = {
  pendente: 'bg-slate-200 text-slate-700',
  em_discussao: 'bg-blue-300 text-blue-900',
  em_votacao: 'bg-yellow-300 text-yellow-900',
  aprovado_relator: 'bg-green-300 text-green-900',
  aprovado_simbolico: 'bg-green-300 text-green-900',
  aprovado_nominal: 'bg-green-300 text-green-900',
  rejeitado_relator: 'bg-red-300 text-red-900',
  rejeitado_simbolico: 'bg-red-300 text-red-900',
  rejeitado_nominal: 'bg-red-300 text-red-900',
  aprovado_separado: 'bg-green-300 text-green-900',
  retirado: 'bg-slate-400 text-slate-900',
  vista: 'bg-orange-300 text-orange-900',
  nao_deliberado: 'bg-slate-300 text-slate-700'
}

function cardTone(status) {
  if (status==='aprovado_relator' || status==='aprovado_simbolico' || status==='aprovado_nominal') return 'bg-green-100 border-green-300'
  if (status==='rejeitado_relator' || status==='rejeitado_simbolico' || status==='rejeitado_nominal') return 'bg-red-100 border-red-300'
  if (status==='vista') return 'bg-orange-100 border-orange-300'
  if (status==='retirado') return 'bg-slate-200 border-slate-400'
  if (status==='nao_deliberado') return 'bg-slate-100 border-slate-300'
  if (status==='em_discussao') return 'bg-yellow-100 border-yellow-300'
  if (status==='em_votacao') return 'bg-blue-100 border-blue-300'
  return 'bg-white border-slate-200'
}

function formatDataBR(dt) {
  if (!dt) return ''
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}`
  const m2 = dt.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`
  return dt
}

export default function Acompanhamento() {
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [meeting, setMeeting] = useState({})
  const [vistas, setVistas] = useState({})
  const socket = useSocket(id)
  const linksMap = useProcessoLinks(items)
  const [openItems, toggleItem] = useOpenItems()

  const load = async () => {
    const res = await fetch(`/api/reuniao/${id}`)
    const j = await res.json()
    setItems(j.items || (Array.isArray(j) ? j : []))
    setMeeting(j)
    const v = await fetch(`/api/reuniao/${id}/vistas`).then(r=>r.json()).catch(()=>({}))
    setVistas(v || {})
  }

  useEffect(()=>{ if (id) load() }, [id])

  useEffect(()=>{
    if(!socket) return
    const onUpdate = () => load()
    socket.on('official_status_changed', onUpdate)
    socket.on('active_item_changed', onUpdate)
    socket.on('bloco_changed', onUpdate)
    return ()=>{
      socket.off('official_status_changed', onUpdate)
      socket.off('active_item_changed', onUpdate)
      socket.off('bloco_changed', onUpdate)
    }
  }, [socket])

  const comissaoNome = meeting?.solicitante || meeting?.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || ''
  const titulo = meeting?.tituloReuniao || (meeting?.nuReuniao != null ? `${meeting.nuReuniao}ª Reunião ${meeting?.tipoConvocacao || 'Ordinária'}` : '')
  const data = formatDataBR(meeting?.dtReuniao)
  const local = meeting?.local?.txNome || ''

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-alesp">{comissaoNome}</h1>
          <div className="text-sm text-slate-600 mt-1">
            {[titulo, data, local].filter(Boolean).join(' • ')}
          </div>
        </div>
        <a href={`/api/reuniao/${id}/relatorio-publico.pdf`} className="bg-alesp text-white rounded-lg px-4 py-2 text-sm font-bold">
          Baixar relatório
        </a>
      </div>
      <div className="mt-3 mb-4 text-xs text-slate-500">
        Acompanhamento público da reunião. Informações sujeitas a atualização durante a sessão.
      </div>
      <PresencasPublicas idReuniao={id} />
      {items.map(it => {
        const status = it.status_oficial || 'pendente'
        const proc = it.processoDadosView || it.processo || {}
        const vote = (it.documentosVoto||[])[0] || {}
        const pUrl = proposituraUrl(linksMap[proc.idProcesso])
        const vUrl = votoUrl(vote)
        const vistaNames = vistas[it.id] || []
        const isVista = status==='vista' || vistaNames.length>0
        const isTerminal = isTerminalStatus(status)
        const expanded = !isTerminal || openItems.has(String(it.id))
        if (!expanded) {
          return (
            <div key={it.id} className={`border-2 rounded-xl mb-2 overflow-hidden ${cardTone(status)}`}>
              <button aria-label={`Expandir item ${it.nuOrdem}`} onClick={()=>toggleItem(it.id)} className="w-full flex items-center gap-2 text-left px-3 py-2 min-w-0">
                <span className="text-lg font-black text-slate-900 shrink-0">Item {it.nuOrdem}</span>
                <span className="min-w-0 flex-1 truncate block text-sm font-bold text-slate-900">— {proc.txDescricao}</span>
                <span className="text-[10px] uppercase tracking-wide font-bold text-slate-700 bg-white/70 border border-slate-300 rounded-full px-2 py-0.5 shrink-0">{STATUS_SHORT[status]||status}</span>
                <span className="text-xs text-slate-700 shrink-0">▼</span>
              </button>
            </div>
          )
        }
        return (
          <article key={it.id} className={`border-2 rounded-xl overflow-hidden mb-3 ${cardTone(status)}`}>
            <div className={`px-4 py-2 text-xs font-extrabold flex justify-between items-center ${isVista && vistaNames.length ? 'bg-orange-300 text-orange-900' : (STATUS_COLOR[status]||'bg-slate-200 text-slate-700')}`}>
              <span>● {isVista && vistaNames.length ? `VISTA SOLICITADA: ${vistaNames.join(', ')}` : STATUS_LABEL[status]||status}</span>
              {isTerminal && <button aria-label={`Recolher item ${it.nuOrdem}`} onClick={()=>toggleItem(it.id)} className="text-slate-700 shrink-0">▼</button>}
            </div>
            <div className="p-4">
              <span className="bg-alesp text-white text-xs px-2 py-1 rounded-full">ITEM {it.nuOrdem} • {pUrl ? <a href={pUrl} target="_blank" rel="noreferrer" className="underline text-white">{proc.txDescricao}</a> : proc.txDescricao}</span>
              <div className="font-extrabold mt-2">{proc.txEmenta}</div>
              <div className="text-sm text-slate-600">Autor: {proc.txNomeAutores}</div>
              {vote.autores && vote.conclusao && <div className="text-sm text-slate-600">{vUrl ? <a href={vUrl} target="_blank" rel="noreferrer" className="text-alesp underline">Relator: {vote.autores} — <b>{vote.conclusao}</b></a> : <>Relator: {vote.autores} — <b>{vote.conclusao}</b></>}</div>}
            </div>
          </article>
        )
      })}
    </div>
  )
}
