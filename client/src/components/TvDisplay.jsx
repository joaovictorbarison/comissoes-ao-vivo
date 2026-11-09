import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'

function pickActive(items=[]) {
  return items.find(i=>i.status_oficial==='em_votacao')
    || items.find(i=>i.status_oficial==='em_discussao')
    || items[0]
}
function resultLabel(item, vistas) {
  const st = item?.status_oficial
  if (st==='aprovado_relator') return 'APROVADO'
  if (st==='rejeitado_relator') return 'REJEITADO'
  if (st==='retirado') return 'RETIRADO'
  if (st==='vista') {
    const names = vistas[item.id] || []
    return names.length ? `VISTA: ${names.join(', ')}` : 'VISTA'
  }
  return null
}
function isTerminal(item) {
  return ['aprovado_relator','rejeitado_relator','vista','retirado'].includes(item?.status_oficial)
}

export default function TvDisplay() {
  const { id } = useParams()
  const [data, setData] = useState({ items: [] })
  const [vistas, setVistas] = useState({})
  const [resultItem, setResultItem] = useState(null)
  const [forcedNext, setForcedNext] = useState(null)
  const timerRef = useRef(null)
  const prevTerminalRef = useRef(null)
  const socket = useSocket(id)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    const j = await r.json()
    // detect newly terminal item (change since last load)
    const items = j.items || []
    setData(j)
    const v = await fetch(`/api/reuniao/${id}/vistas`).then(r=>r.json()).catch(()=>({}))
    setVistas(v)
    const term = items.find(i=>isTerminal(i))
    // only start 8s timer when terminal appears/changes (not on every load)
    const termKey = term ? `${term.id}:${term.status_oficial}` : null
    if (term && termKey !== prevTerminalRef.current) {
      prevTerminalRef.current = termKey
      setResultItem(term)
      if (timerRef.current) clearTimeout(timerRef.current)
      const next = items.find(i=>i.nuOrdem === (term.nuOrdem+1)) || items.find(i=>i.status_oficial==='em_votacao') || items[0]
      timerRef.current = setTimeout(()=>{ setResultItem(null); setForcedNext(next||null) }, 8000)
    } else if (!term) {
      prevTerminalRef.current = null
      setResultItem(null)
    }
  }
  useEffect(()=>{ load() }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => load()
    socket.on('official_status_changed', on)
    socket.on('active_item_changed', on)
    return ()=>{ socket.off('official_status_changed', on); socket.off('active_item_changed', on) }
  }, [socket])
  useEffect(()=>()=>{ if(timerRef.current) clearTimeout(timerRef.current) }, [])

  const comissaoNome = data.solicitante || data.colegiadosRelacionados?.map(c=>c.nome).join('; ') || ''
  const active = resultItem || forcedNext || pickActive(data.items)
  if(!active) return <div className="bg-black text-white min-h-screen flex items-center justify-center">Aguardando item…</div>
  const proc = active.processoDadosView||{}
  const vote = (active.documentosVoto||[])[0] || {}
  const isVoting = active.status_oficial==='em_votacao'
  const label = resultLabel(active, vistas)
  // forcedNext sempre exibe como EM DISCUSSÃO (mesmo que pendente)
  const isForcedDiscussao = !!forcedNext && !resultItem
  const title = label || (isVoting ? 'EM VOTAÇÃO' : (active.status_oficial==='em_discussao' || isForcedDiscussao ? 'EM DISCUSSÃO' : 'PAUTA'))
  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center p-6">
      <div className="text-center w-full max-w-4xl border-2 border-blue-800 rounded-2xl p-10 bg-gradient-to-b from-alesp to-black">
        <div className="text-xs uppercase tracking-widest opacity-80">Assembleia Legislativa do Estado de São Paulo</div>
        {comissaoNome && <div className="text-sm font-bold mt-1 opacity-90">{comissaoNome}</div>}
        <div className="text-4xl font-black mt-2">{title}</div>
        <div className="inline-block bg-yellow-400 text-black font-extrabold px-4 py-1 rounded-full mt-3">ITEM {active.nuOrdem} - {proc.txDescricao}</div>
        <div className="text-2xl font-bold mt-4">{proc.txEmenta}</div>
        <div className="text-sm opacity-80 mt-3">Autor: {proc.txNomeAutores}</div>
        {vote.autores && vote.conclusao && <div className="text-sm opacity-80">Relator: {vote.autores} — {vote.conclusao}</div>}
        {label && <div className="text-xl font-black mt-3 text-yellow-300">{label}</div>}
      </div>
    </div>
  )
}
