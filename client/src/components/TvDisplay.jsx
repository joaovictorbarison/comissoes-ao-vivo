import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import TvQrBadge from './TvQrBadge.jsx'

function formatName(n='') {
  return String(n||'').trim().toLowerCase().split(/\s+/).map(w => ['de','da','do','das','dos','e'].includes(w) ? w : w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
}
function resultLabel(item, vistas) {
  const st = item?.status_oficial
  if (st==='aprovado_relator' || st==='aprovado_simbolico' || st==='aprovado_nominal') return 'APROVADO'
  if (st==='rejeitado_relator' || st==='rejeitado_nominal' || st==='rejeitado_simbolico') return 'REJEITADO'
  if (st==='retirado') return 'RETIRADO'
  if (st==='vista') {
    const names = vistas[item.id] || []
    return names.length ? `Pedido de Vista: ${names.map(formatName).join(', ')}` : 'Pedido de Vista'
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

function Card({ children }) {
  return (
    <div className="text-center w-full h-full min-h-0 flex flex-col items-center justify-center border-2 border-blue-800 rounded-2xl p-[4vh] bg-gradient-to-b from-alesp to-black overflow-hidden">
      {children}
    </div>
  )
}

function TvShell({ children }) {
  return (
    <div data-testid="tv-shell" className="h-screen w-screen overflow-hidden bg-black text-white flex flex-col p-[1.5vh] gap-[1vh]">
      <div className="flex-1 min-h-0 w-full">
        <Card>{children}</Card>
      </div>
      <div className="h-[12vh] shrink-0 flex items-center justify-center">
        <TvQrBadge />
      </div>
    </div>
  )
}

export default function TvDisplay() {
  const { id } = useParams()
  const [data, setData] = useState({ items: [] })
  const [vistas, setVistas] = useState({})
  const [currentId, setCurrentId] = useState(null)
  const [resultItemId, setResultItemId] = useState(null)
  const [bloco, setBloco] = useState(null)
  const [vistaBloco, setVistaBloco] = useState(null)
  const timerRef = useRef(null)
  const socket = useSocket(id)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`).catch(()=>null)
    if (!r || r.ok === false) return data
    const j = await r.json().catch(()=>null)
    if (!j) return data
    setData(j)
    const v = await fetch(`/api/reuniao/${id}/vistas`).then(r=>r.json()).catch(()=>({}))
    setVistas(v)
    const b = await fetch(`/api/reuniao/${id}/bloco`).then(r=>r.json()).catch(()=>null)
    setBloco(b && b.ativo ? b : null)
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
      const st = payload.status
      if (payload?.vistaBatch) return // evento do lote: quem atualiza o splash e o handler vista_bloco_registered
      // Qualquer evento normal (inclusive vista registrada pela pauta) sai do Splash consolidado.
      if (target) {
        setVistaBloco(null)
      } else if (!target) {
        setVistaBloco(null)
      }
      if (!target) return
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
    const onBloco = async () => { await load() }
    const onVistaBloco = async (payload) => {
      const fresh = (await load()) || data
      const its = fresh?.items || []
      const ids = payload?.itemIds || []
      const nums = its.filter(i=>ids.includes(String(i.id))).map(i=>i.nuOrdem).sort((a,b)=>a-b).join(', ')
      setVistaBloco({ names: (payload?.names || []).map(formatName), nums })
    }
    socket.on('official_status_changed', onStatus)
    socket.on('active_item_changed', onStatus)
    socket.on('bloco_changed', onBloco)
    socket.on('vista_bloco_registered', onVistaBloco)
    return ()=>{ socket.off('official_status_changed', onStatus); socket.off('active_item_changed', onStatus); socket.off('bloco_changed', onBloco); socket.off('vista_bloco_registered', onVistaBloco) }
  }, [socket])
  useEffect(()=>()=>{ if(timerRef.current) clearTimeout(timerRef.current); }, [])

  const items = data.items || []
  const active = items.find(i=>String(i.id)===String(currentId)) || items.find(i=>String(i.id)===String(resultItemId)) || initialPick(items)
  if (!active) {
    return (
      <TvShell>
        <div className="text-[clamp(2.5vh,4vw,6vh)] font-bold opacity-90">Aguardando item…</div>
      </TvShell>
    )
  }
  const isIdle = !data.iniciada && (active?.status_oficial==='pendente' && !items.some(i=>i.status_oficial==='em_votacao' || i.status_oficial==='em_discussao'))
  const showSplash = isIdle || (!items.some(i=>i.status_oficial==='em_votacao' || i.status_oficial==='em_discussao' || isTerminal(i)) && !resultItemId)
  const comissaoNome = data.solicitante || data.colegiadosRelacionados?.map(c=>c.nome).join('; ') || ''
  const numTipo = data.tituloReuniao || (data.nuReuniao != null ? `${data.nuReuniao}ª Reunião ${data.tipoConvocacao||'Ordinária'}` : '')
  const totalItens = items.length

  // Tela de pedido de vista (persiste até o status mudar)
  if (vistaBloco) {
    const plural = vistaBloco.names.length > 1
    return (
      <TvShell>
        <div className="text-[clamp(1.2vh,1.6vw,2.4vh)] uppercase tracking-widest opacity-80 font-semibold">Assembleia Legislativa do Estado de São Paulo</div>
        {comissaoNome && <div className="text-[clamp(1.8vh,2.4vw,3.6vh)] font-bold mt-2 opacity-90">{comissaoNome}</div>}
        <div className="inline-block bg-orange-300 text-orange-900 font-extrabold px-[2vw] py-[1vh] rounded-full mt-[3vh] text-[clamp(1.8vh,2.4vw,3.6vh)]">PEDIDO DE VISTA</div>
        <div className="text-[clamp(2.2vh,3vw,4.5vh)] font-bold mt-[3vh]">{plural ? 'Solicitantes:' : 'Solicitante:'}</div>
        <div className="text-[clamp(3vh,4.5vw,7vh)] font-black mt-1 opacity-95">{vistaBloco.names.join(', ')}</div>
        <div className="text-[clamp(2.2vh,3vw,4.5vh)] font-bold mt-[2vh]">{vistaBloco.nums.includes(',') ? 'Itens:' : 'Item:'} {vistaBloco.nums}</div>
      </TvShell>
    )
  }

  if (showSplash) {
    return (
      <TvShell>
        <div className="text-[clamp(1.2vh,1.6vw,2.4vh)] uppercase tracking-widest opacity-80 font-semibold">Assembleia Legislativa do Estado de São Paulo</div>
        {comissaoNome && <div className="text-[clamp(2.5vh,4vw,6.5vh)] font-black mt-[3vh] opacity-95 leading-tight">{comissaoNome}</div>}
        <div className="text-[clamp(2vh,3vw,4.5vh)] font-bold mt-[3vh] opacity-90">{numTipo}</div>
        <div className="text-[clamp(2vh,3vw,4.5vh)] font-bold mt-2 opacity-90">{totalItens} itens em pauta</div>
        {!data.iniciada && <div className="inline-block bg-slate-700 text-white font-extrabold px-[2vw] py-[1vh] rounded-full mt-[3vh] text-[clamp(1.6vh,2vw,3vh)] tracking-wide">AGUARDANDO INÍCIO</div>}
      </TvShell>
    )
  }

  // Bloco ativo
  if (bloco && bloco.ativo && Array.isArray(bloco.itemIds) && bloco.itemIds.length) {
    const blocoItems = items.filter(i => bloco.itemIds.includes(String(i.id)))
    const nums = blocoItems.map(i=>i.nuOrdem).sort((a,b)=>a-b).join(', ')
    const st = bloco.status || 'em_discussao'
    const title = st==='em_votacao' ? 'EM VOTAÇÃO' : (st==='aprovado_relator'?'APROVADO':st==='rejeitado_relator'?'REJEITADO':st==='vista'?'VISTA':'EM DISCUSSÃO')
    const pillClass = statusColor(st==='em_votacao'?'em_votacao':st==='aprovado_relator'?'aprovado_relator':st==='rejeitado_relator'?'rejeitado_relator':st==='vista'?'vista':'em_discussao')
    return (
      <TvShell>
        <div className="text-[clamp(1.2vh,1.6vw,2.4vh)] uppercase tracking-widest opacity-80 font-semibold">Assembleia Legislativa do Estado de São Paulo</div>
        {comissaoNome && <div className="text-[clamp(1.8vh,2.4vw,3.6vh)] font-bold mt-2 opacity-90">{comissaoNome}</div>}
        <div className={`inline-block font-extrabold px-[2vw] py-[1vh] rounded-full mt-[2vh] text-[clamp(1.8vh,2.4vw,3.6vh)] ${pillClass}`}>{title}</div>
        <div className="text-[clamp(2.5vh,3.5vw,5.5vh)] font-bold mt-[3vh]">Votação em bloco</div>
        <div className="text-[clamp(2vh,2.8vw,4.5vh)] font-bold mt-[2vh]">Itens: {nums}</div>
      </TvShell>
    )
  }

  const proc = active.processoDadosView||{}
  const vote = (active.documentosVoto||[])[0] || {}
  const label = resultLabel(active, vistas)
  const isVoting = active.status_oficial==='em_votacao'
  const title = label || (isVoting ? 'EM VOTAÇÃO' : (active.status_oficial==='em_discussao' ? 'EM DISCUSSÃO' : 'PAUTA'))
  const pillClass = statusColor(active.status_oficial)
  return (
    <TvShell>
      <div className="text-[clamp(1.2vh,1.6vw,2.4vh)] uppercase tracking-widest opacity-80 font-semibold">Assembleia Legislativa do Estado de São Paulo</div>
      {comissaoNome && <div className="text-[clamp(1.8vh,2.4vw,3.6vh)] font-bold mt-2 opacity-90">{comissaoNome}</div>}
      <div className={`inline-block font-extrabold px-[2vw] py-[1vh] rounded-full mt-[1.5vh] text-[clamp(1.6vh,2.2vw,3.4vh)] ${pillClass}`}>{title}</div>
      <div className="text-[clamp(2.2vh,3.2vw,5vh)] font-bold mt-[2vh]">ITEM {active.nuOrdem} - {proc.txDescricao}</div>
      <div className="text-[clamp(1.8vh,2.6vw,4vh)] font-bold mt-2 line-clamp-4 overflow-hidden">{proc.txEmenta}</div>
      <div className="text-[clamp(1.4vh,1.8vw,2.8vh)] mt-[1.5vh] opacity-90">Autor: {proc.txNomeAutores}</div>
      {vote.autores && vote.conclusao && <div className="text-[clamp(1.4vh,1.8vw,2.8vh)] opacity-90">Relator: {vote.autores} — {vote.conclusao}</div>}
    </TvShell>
  )
}
