import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'

function resultLabel(item, vistas) {
  const st = item?.status_oficial
  if (st==='aprovado_relator' || st==='aprovado_simbolico' || st==='aprovado_nominal') return 'APROVADO'
  if (st==='rejeitado_relator' || st==='rejeitado_nominal' || st==='rejeitado_simbolico') return 'REJEITADO'
  if (st==='retirado') return 'RETIRADO'
  if (st==='vista') {
    const names = vistas[item.id] || []
    return names.length ? `VISTA: ${names.join(', ')}` : 'VISTA'
  }
  return null
}
function isTerminal(item) {
  return ['aprovado_relator','rejeitado_relator','aprovado_simbolico','aprovado_nominal','rejeitado_nominal','rejeitado_simbolico','vista','retirado'].includes(item?.status_oficial)
}
function statusColor(status) {
  if (status==='aprovado_relator' || status==='aprovado_simbolico' || status==='aprovado_nominal') return 'bg-green-300 text-green-900'
  if (status==='rejeitado_relator' || status==='rejeitado_nominal' || status==='rejeitado_simbolico') return 'bg-red-300 text-red-900'
  if (status==='vista') return 'bg-orange-300 text-orange-900'
  if (status==='retirado') return 'bg-slate-400 text-slate-900'
  if (status==='em_votacao') return 'bg-yellow-400 text-black animate-pulse'
  if (status==='em_discussao') return 'bg-blue-300 text-blue-900'
  return 'bg-slate-300 text-slate-900'
}

export default function TvDisplay() {
  const { id } = useParams()
  const [data, setData] = useState({ items: [] })
  const [vistas, setVistas] = useState({})
  const [currentId, setCurrentId] = useState(null)
  const [resultItemId, setResultItemId] = useState(null)
  const timerRef = useRef(null)
  const socket = useSocket(id)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    const j = await r.json()
    setData(j)
    const v = await fetch(`/api/reuniao/${id}/vistas`).then(r=>r.json()).catch(()=>({}))
    setVistas(v)
    return j
  }

  const initialPick = (items) => items.find(i=>i.status_oficial==='em_votacao') || items.find(i=>i.status_oficial==='em_discussao') || items[0]

  useEffect(()=>{
    load().then(j=>{
      const p = initialPick(j.items||[])
      if (p) setCurrentId(p.id)
    })
  }, [id])

  useEffect(()=>{
    if(!socket) return
    const onStatus = async (payload) => {
      const fresh = await load()
      const items = fresh.items || []
      const target = items.find(i=>String(i.id)===String(payload.itemId))
      if (!target) return
      const st = payload.status
      if (isTerminal(target)) {
        setCurrentId(target.id)
        setResultItemId(target.id)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(()=>{ setResultItemId(null) }, 6000)
      } else if (st==='em_discussao' || st==='em_votacao') {
        setResultItemId(null)
        setCurrentId(target.id)
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }
    socket.on('official_status_changed', onStatus)
    socket.on('active_item_changed', onStatus)
    return ()=>{ socket.off('official_status_changed', onStatus); socket.off('active_item_changed', onStatus) }
  }, [socket])
  useEffect(()=>()=>{ if(timerRef.current) clearTimeout(timerRef.current) }, [])

  const items = data.items || []
  const active = items.find(i=>String(i.id)===String(currentId)) || items.find(i=>String(i.id)===String(resultItemId)) || initialPick(items)
  const isIdle = !active || (active.status_oficial==='pendente' && !items.some(i=>i.status_oficial==='em_votacao' || i.status_oficial==='em_discussao'))
  const comissaoNome = data.solicitante || data.colegiadosRelacionados?.map(c=>c.nome).join('; ') || ''
  const numTipo = data.tituloReuniao || (data.nuReuniao != null ? `${data.nuReuniao}ª Reunião ${data.tipoConvocacao||'Ordinária'}` : '')
  const totalItens = items.length

  if (isIdle) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center p-6">
        <div className="text-center w-full max-w-4xl border-2 border-blue-800 rounded-2xl p-10 bg-gradient-to-b from-alesp to-black">
          <div className="text-sm uppercase tracking-widest opacity-80 font-semibold">Assembleia Legislativa do Estado de São Paulo</div>
          {comissaoNome && <div className="text-xl font-bold mt-2 opacity-90">{comissaoNome}</div>}
          <div className="inline-block bg-yellow-400 text-black font-extrabold px-6 py-2 rounded-full mt-6 text-2xl">{numTipo}</div>
          <div className="text-2xl font-bold mt-6 opacity-90">{totalItens} itens em pauta</div>
          <div className="inline-block bg-slate-700 text-white font-extrabold px-6 py-2 rounded-full mt-6 text-lg tracking-wide">AGUARDANDO INÍCIO</div>
        </div>
      </div>
    )
  }

  const proc = active.processoDadosView||{}
  const vote = (active.documentosVoto||[])[0] || {}
  const label = resultLabel(active, vistas)
  const isVoting = active.status_oficial==='em_votacao'
  const title = label || (isVoting ? 'EM VOTAÇÃO' : (active.status_oficial==='em_discussao' ? 'EM DISCUSSÃO' : 'PAUTA'))
  const pillClass = statusColor(active.status_oficial)
  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center p-6">
      <div className="text-center w-full max-w-4xl border-2 border-blue-800 rounded-2xl p-10 bg-gradient-to-b from-alesp to-black">
        <div className="text-sm uppercase tracking-widest opacity-80 font-semibold">Assembleia Legislativa do Estado de São Paulo</div>
        {comissaoNome && <div className="text-base font-bold mt-1 opacity-90">{comissaoNome}</div>}
        <div className={`inline-block font-extrabold px-4 py-1 rounded-full mt-3 ${pillClass}`}>{title}</div>
        <div className="text-2xl font-bold mt-4">ITEM {active.nuOrdem} - {proc.txDescricao}</div>
        <div className="text-xl font-bold mt-2">{proc.txEmenta}</div>
        <div className="text-base mt-3 opacity-90">Autor: {proc.txNomeAutores}</div>
        {vote.autores && vote.conclusao && <div className="text-base opacity-90">Relator: {vote.autores} — {vote.conclusao}</div>}
        {label && <div className="text-xl font-black mt-3 text-yellow-300">{label}</div>}
      </div>
    </div>
  )
}
