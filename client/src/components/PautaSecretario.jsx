import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import { useProcessoLinks } from '../hooks/useProcessoLinks.js'
import { proposituraUrl, votoUrl } from '../lib/legisLinks.js'
import PresentesTab from './PresentesTab.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const ACTIONS_ALL = [
  {k:'em_discussao', label:'Em discussão'},
  {k:'em_votacao', label:'Em votação'},
  {k:'aprovado_relator', label:'Aprovado ✓'},
  {k:'rejeitado_relator', label:'Rejeitado ✕'},
  {k:'vista', label:'Vista'},
  {k:'retirado', label:'Retirado'}
]

const ACTIONS_LABEL = {
  em_discussao:'em discussão', em_votacao:'em votação', aprovado_relator:'aprovado',
  rejeitado_relator:'rejeitado', vista:'vista', retirado:'retirado', pendente:'pendente'
}

function normalizeName(n=''){ return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
function cardClass(status) {  if (status==='aprovado_relator' || status==='aprovado_simbolico') return 'border-green-300 bg-green-100'
  if (status==='aprovado_nominal') return 'border-green-400 bg-green-200'
  if (status==='rejeitado_relator' || status==='rejeitado_nominal' || status==='rejeitado_simbolico') return 'border-red-300 bg-red-100'
  if (status==='vista') return 'border-orange-300 bg-orange-100'
  if (status==='retirado') return 'border-slate-400 bg-slate-200'
  if (status==='em_discussao') return 'border-blue-300 bg-blue-100'
  if (status==='em_votacao') return 'border-yellow-300 bg-yellow-100'
  if (status==='nao_deliberado') return 'border-slate-300 bg-slate-100'
  return 'border-slate-200 bg-white'
}
function isAprovado(s){ return s==='aprovado_relator' || s==='aprovado_simbolico' || s==='aprovado_nominal' }
function isRejeitado(s){ return s==='rejeitado_relator' || s==='rejeitado_nominal' || s==='rejeitado_simbolico' }
function btnClass(actionKey, currentStatus) {
  if (actionKey==='aprovado_relator' && isAprovado(currentStatus)) return 'bg-green-300 text-green-900 font-bold'
  if (actionKey==='rejeitado_relator' && isRejeitado(currentStatus)) return 'bg-red-300 text-red-900 font-bold'
  if (actionKey==='vista' && currentStatus==='vista') return 'bg-orange-300 text-orange-900 font-bold'
  if (actionKey==='retirado' && currentStatus==='retirado') return 'bg-slate-400 text-slate-900 font-bold'
  if (actionKey==='em_discussao' && currentStatus==='em_discussao') return 'bg-blue-300 text-blue-900 font-bold'
  if (actionKey==='em_votacao' && currentStatus==='em_votacao') return 'bg-yellow-300 text-yellow-900 font-bold animate-pulse'
  return 'bg-slate-100 hover:bg-slate-200'
}

export default function PautaSecretario() {
  const { id } = useParams()
  const { authFetch } = useAuth()
  const [items, setItems] = useState([])
  const [meeting, setMeeting] = useState({})
  const [presencas, setPresencas] = useState([])
  const [vistaOpen, setVistaOpen] = useState(null)
  const [vistaSel, setVistaSel] = useState([])
  const [vistas, setVistas] = useState({})
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmEncerrar, setConfirmEncerrar] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [iniciada, setIniciada] = useState(false)
  const [encerrada, setEncerrada] = useState(false)
  const [votTipo, setVotTipo] = useState({})
  const [votosNom, setVotosNom] = useState({})
  const [outroTxt, setOutroTxt] = useState({})
  const [notas, setNotas] = useState({})
  const [savedNotas, setSavedNotas] = useState({})
  const [needsManual, setNeedsManual] = useState({})
  const [membros, setMembros] = useState([])
  const [partyPortal, setPartyPortal] = useState({})
  const socket = useSocket(id)
  const linksMap = useProcessoLinks(items)

  const load = async () => {
    const r = await authFetch(`/api/reuniao/${id}`)
    const j = await r.json()
    setItems(j.items || j || [])
    setMeeting(j)
    setEncerrada(!!j.encerrada)
    setIniciada(!!j.iniciada)
  }
  const loadPres = async () => {
    const r = await authFetch(`/api/reuniao/${id}/presencas`)
    setPresencas(await r.json().catch(()=>[]))
  }
  const loadVistas = async () => {
    const r = await authFetch(`/api/reuniao/${id}/vistas`)
    setVistas(await r.json().catch(()=>({})))
  }
  const loadNom = async () => {
    const r = await authFetch(`/api/reuniao/${id}/votos-nominais`).catch(()=>null)
    if (r) setVotosNom(await r.json().catch(()=>({})))
  }
  const loadMembros = async () => {
    const r = await authFetch(`/api/reuniao/${id}`).catch(()=>null)
    if (!r) return
    const j = await r.json().catch(()=>({}))
    const cols = j.colegiadosRelacionados || []
    const ids = cols.map(c=>c.id).filter(Boolean)
    if (!ids.length) return
    const seen = new Map()
    for (const cid of ids) {
      const mr = await authFetch(`/api/legis/colegiados/${cid}/membros`).catch(()=>null)
      if (!mr) continue
      const arr = await mr.json().catch(()=>[])
      arr.forEach(p=>{
        const mat = p.nuMatriculaParlamentar || p.parlamentar
        if (!seen.has(mat)) seen.set(mat, p)
        else {
          const cur = seen.get(mat)
          const isEfet = (v)=> /efetivo|presidente|vice/i.test(v||'')
          if (isEfet(p.ocupacao) && !isEfet(cur.ocupacao)) seen.set(mat, p)
        }
      })
    }
    setMembros([...seen.values()])
    // party via portal para nao-membros
    const pr = await authFetch(`/api/legis/parlamentares-ativos`).catch(()=>null)
    if (pr) {
      const arr = await pr.json().catch(()=>[])
      const map = {}
      arr.forEach(p=>{ map[normalizeName(p.nome)] = p.partido || '' })
      setPartyPortal(map)
    }
  }
  const loadNotas = async () => {
    const r = await authFetch(`/api/reuniao/${id}/anotacoes-secretario`).catch(()=>null)
    if (r) setNotas(await r.json().catch(()=>({})))
  }
  const loadEstado = async () => {
    const r = await authFetch(`/api/sessoes`).catch(()=>null)
    if (r) {
      const j = await r.json().catch(()=>({}))
      setIniciada(!!j[String(id)]?.iniciada)
      setEncerrada(!!j[String(id)]?.encerrada)
    }
  }
  useEffect(()=>{ if(id){ load(); loadPres(); loadVistas(); loadEstado(); loadNom(); loadNotas(); loadMembros() } }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => { load(); loadPres(); loadVistas(); loadEstado(); loadNom(); loadNotas(); loadMembros() }
    socket.on('official_status_changed', on)
    socket.on('active_item_changed', on)
    socket.on('presence_pending', on)
    socket.on('presence_confirmed', on)
    socket.on('voto_nominal_changed', on)
    return ()=>{ socket.off('official_status_changed', on); socket.off('active_item_changed', on); socket.off('presence_pending', on); socket.off('presence_confirmed', on); socket.off('voto_nominal_changed', on) }
  }, [socket])

  const iniciar = async () => {
    await authFetch(`/api/reuniao/${id}/iniciar`, {method:'POST'})
    setIniciada(true); setEncerrada(false)
    load(); loadPres(); loadVistas(); loadEstado()
  }
  const encerrar = () => setConfirmEncerrar(true)
  const doEncerrar = async () => {
    await authFetch(`/api/reuniao/${id}/encerrar`, {method:'POST'})
    setConfirmEncerrar(false)
    setEncerrada(true)
    load(); loadPres(); loadVistas(); loadEstado()
  }
  const reabrir = async () => {
    await authFetch(`/api/reuniao/${id}/reabrir`, {method:'POST'})
    setEncerrada(false); setIniciada(true)
    load(); loadPres(); loadVistas(); loadEstado()
  }
  const limpar = async () => {
    await authFetch(`/api/reuniao/${id}/limpar`, {method:'POST'})
    setConfirmClear(false)
    load(); loadVistas(); loadEstado(); loadNom(); loadNotas()
  }

  const applyStatus = async (item, status) => {
    if (encerrada) return
    await authFetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: item.id, status})})
    load()
  }

  const setStatus = async (item, status) => {
    if (encerrada) return
    const itemId = item.id
    const current = item.status_oficial || 'pendente'
    if (status !== 'vista') setVistaOpen(null)
    if (status==='em_votacao') {
      // abre painel simbólica/nominal
      setVotTipo(t=>({...t, [itemId]: t[itemId] || 'simbolica'}))
      if (current !== 'em_votacao') {
        await authFetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status})})
      }
      load()
      return
    }
    if (status==='vista') {
      if (current !== 'vista') {
        await authFetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status})})
      }
      setVistaOpen(itemId)
      setVistaSel(vistas[itemId] || [])
      load(); loadVistas()
      return
    }
    if (status === current) {
      await authFetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status:'pendente'})})
      load()
      return
    }
    // Aprovado na simbólica → snapshot
    if (status==='aprovado_relator' && (votTipo[itemId]||'simbolica')==='simbolica') {
      await authFetch(`/api/reuniao/${id}/votacao-simbolica`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, decision: 'aprovado'})})
      load(); loadNom()
      return
    }
    // Rejeitado na simbólica → snapshot (direto também assume simbólica)
    if (status==='rejeitado_relator' && (votTipo[itemId]||'simbolica')==='simbolica') {
      await authFetch(`/api/reuniao/${id}/votacao-simbolica`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, decision: 'rejeitado'})})
      load(); loadNom()
      return
    }
    if (status==='aprovado_relator' && votTipo[itemId]==='nominal') {
      // finalizar nominal (auto ou manual se outro>=4)
      const r = await authFetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, decisaoManual: needsManual[itemId] ? 'aprovado' : null})})
      const j = await r.json()
      if (j.needsManual) { setNeedsManual(m=>({...m, [itemId]: true})); alert('4 ou mais "Outro". Defina Aprovado ou Rejeitado.'); return }
      load(); return
    }
    if (status==='rejeitado_relator' && votTipo[itemId]==='nominal') {
      const r = await authFetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, decisaoManual: needsManual[itemId] ? 'rejeitado' : null})})
      const j = await r.json()
      if (j.needsManual) { setNeedsManual(m=>({...m, [itemId]: true})); alert('4 ou mais "Outro". Defina Aprovado ou Rejeitado.'); return }
      load(); return
    }
    const hasVista = (vistas[itemId]||[]).length>0 || current==='vista'
    if (hasVista && ['aprovado_relator','rejeitado_relator','retirado'].includes(status)) {
      setPendingAction({ item, status })
      return
    }
    await applyStatus(item, status)
  }

  const confirmPending = async () => {
    if (!pendingAction) return
    const { item, status } = pendingAction
    await authFetch(`/api/reuniao/${id}/vista`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: item.id, names:[]})})
    await applyStatus(item, status)
    setPendingAction(null)
    loadVistas()
  }

  const saveVista = async (itemId) => {
    if (encerrada) return
    await authFetch(`/api/reuniao/${id}/vista`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, names: vistaSel})})
    setVistaOpen(null)
    load(); loadVistas()
  }

  const toggleVistaName = (name) => {
    setVistaSel(s => s.includes(name) ? s.filter(n=>n!==name) : [...s, name])
  }

  const registrarVoto = async (itemId, deputado, voto) => {
    if (!voto) {
      await authFetch(`/api/reuniao/${id}/voto-nominal/${itemId}/${encodeURIComponent(deputado)}`, {method:'DELETE'})
      loadNom()
      return
    }
    const outro = voto==='outro' ? (outroTxt[`${itemId}:${deputado}`]||'') : null
    await authFetch(`/api/reuniao/${id}/voto-nominal`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, deputado, voto, outro})})
    loadNom()
  }

  const saveNota = async (itemId) => {
    await authFetch(`/api/reuniao/${id}/item-nota`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, texto: notas[itemId]||''})})
    setSavedNotas(s=>({...s, [itemId]: true}))
  }

  const deputadosPresentes = presencas.filter(p=>p.profile==='deputado')
  const comissaoNome = meeting?.solicitante || meeting?.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || 'Painel do Secretário'
  const meetingSuffix = encerrada ? ' - Reunião encerrada' : (iniciada ? ' - Reunião iniciada' : '')

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <h1 className="text-lg font-extrabold text-alesp">{comissaoNome}{meetingSuffix}</h1>
        <div className="flex gap-2 flex-wrap">
          {!iniciada && <button onClick={iniciar} className="text-sm w-36 rounded-lg px-3 py-2 font-bold bg-green-600 text-white">Iniciar reunião</button>}
          {iniciada && !encerrada && <button onClick={encerrar} className="text-sm w-36 rounded-lg px-3 py-2 font-bold bg-red-600 text-white">Encerrar reunião</button>}
          {encerrada && <button onClick={reabrir} className="text-sm w-36 rounded-lg px-3 py-2 font-bold bg-blue-600 text-white">Reabrir reunião</button>}
          <a href={`/api/reuniao/${id}/relatorio.pdf`} className="text-sm bg-yellow-400 text-slate-900 rounded-lg px-3 py-2 font-bold">Baixar relatório</a>
          <button onClick={()=>setConfirmClear(true)} className="text-sm bg-slate-700 text-white rounded-lg px-3 py-2 font-bold">Limpar dados</button>
          <Link to={`/tv/${id}`} target="_blank" className="text-sm bg-black text-white rounded-lg px-3 py-2 font-bold">📺 Ver TV (testar)</Link>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 mt-4">
        <div className="order-2 lg:order-1">
          {items.map(it=>{
            const proc = it.processoDadosView||{}
            const vote = (it.documentosVoto||[])[0] || {}
            const status = it.status_oficial||'pendente'
            const vistaList = vistas[it.id] || []
            const pUrl = proposituraUrl(linksMap[proc.idProcesso])
            const vUrl = votoUrl(vote)
            const tipo = votTipo[it.id] || 'simbolica'
            const nomVotes = votosNom[it.id] || []
            const outroCount = nomVotes.filter(v=>v.voto==='outro').length
            const needManual = outroCount >= 4
            return (
              <div key={it.id} className={`border-2 rounded-xl p-4 mb-3 ${cardClass(status)}`}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-2xl font-black text-slate-900">Item {it.nuOrdem} - {pUrl ? <a href={pUrl} target="_blank" rel="noreferrer" className="text-alesp underline">{proc.txDescricao}</a> : <>{proc.txDescricao}</>}</span>
                </div>
                <div className="font-bold mt-1 text-slate-800">{proc.txEmenta}</div>
                <div className="text-sm text-slate-600 mt-1">Autor: {proc.txNomeAutores}</div>
                {vote.autores && vote.conclusao && <div className="text-sm text-slate-600 mt-1">{vUrl ? <a href={vUrl} target="_blank" rel="noreferrer" className="text-alesp underline">Relator: {vote.autores} — <b>{vote.conclusao}</b></a> : <>Relator: {vote.autores} — <b>{vote.conclusao}</b></>}</div>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {ACTIONS_ALL.map(a=>(<button key={a.k} disabled={encerrada} onClick={()=>setStatus(it,a.k)} className={`rounded px-3 py-2 text-sm ${btnClass(a.k,status)} ${encerrada?'opacity-40 cursor-not-allowed':''}`}>{a.label}</button>))}
                </div>
                {status==='em_votacao' && !encerrada && (
                  <div className="mt-3 border border-slate-300 rounded-lg p-2 bg-white">
                    <div className="flex gap-1 mb-1.5">
                      <button onClick={()=>setVotTipo(t=>({...t, [it.id]:'simbolica'}))} className={`rounded px-2 py-0.5 text-xs ${tipo==='simbolica'?'bg-blue-600 text-white':'bg-slate-100'}`}>Simbólica</button>
                      <button onClick={()=>setVotTipo(t=>({...t, [it.id]:'nominal'}))} className={`rounded px-2 py-0.5 text-xs ${tipo==='nominal'?'bg-blue-600 text-white':'bg-slate-100'}`}>Nominal</button>
                    </div>
                    {tipo==='nominal' && (
                      <div>
                        {deputadosPresentes.length===0 && <div className="text-xs text-slate-500 mb-1">Nenhum parlamentar presente ainda.</div>}
                        {needManual && <div className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded p-1 mb-1">4 ou mais "Outro" — defina Aprovado ou Rejeitado para finalizar.</div>}
                        {(()=>{
                          const partyMap = new Map()
                          membros.forEach(m=>{ if (/substituto/i.test(m.ocupacao||'')) return; const key=(m.federacao||m.partido||'Sem partido'); partyMap.set(key,(partyMap.get(key)||0)+1) })
                          const grupos = new Map()
                          deputadosPresentes.forEach(p=>{
                            const mem = membros.find(m=>normalizeName(m.parlamentar)===normalizeName(p.name))
                            const party = mem ? (mem.federacao||mem.partido||'Sem partido') : (partyPortal[normalizeName(p.name)] || 'Sem partido')
                            const vagas = partyMap.get(party) || 0
                            if (!vagas) return // partido sem vaga não entra na nominal
                            if (!grupos.has(party)) grupos.set(party, [])
                            grupos.get(party).push(p)
                          })
                          const formatName = (n) => n.toLowerCase().split(' ').map(w => ['de','da','do','das','dos','e'].includes(w) ? w : w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
                          return [...grupos.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([party, deps])=>{
                            const vagas = partyMap.get(party) || deps.length
                            const voted = deps.filter(d=>nomVotes.find(v=>v.deputado_name===d.name)).length
                            const reached = voted >= vagas
                            return (
                              <div key={party} className="mb-1.5">
                                <div className="text-[11px] font-bold text-slate-600 uppercase flex justify-between"><span>{party}</span><span>{voted}/{vagas}</span></div>
                                <div className="grid gap-0.5 mt-0.5">
                                  {deps.map(p=>{
                                    const cur = nomVotes.find(v=>v.deputado_name===p.name)
                                    const disp = formatName(p.name)
                                    const blocked = reached && !cur
                                    return (
                                      <div key={p.id} className={`flex items-center gap-1 border rounded px-1.5 h-7 text-xs ${blocked?'opacity-40':''}`}>
                                        <span className={`flex-1 truncate ${disp.length>28?'text-[11px]':''}`}>{disp}</span>
                                        <button disabled={blocked} onClick={()=>registrarVoto(it.id, p.name, cur?.voto==='favoravel' ? null : 'favoravel')} className={`w-6 h-5 rounded text-xs ${cur?.voto==='favoravel'?'bg-green-300':'bg-slate-100'}`}>✓</button>
                                        <button disabled={blocked} onClick={()=>registrarVoto(it.id, p.name, cur?.voto==='contrario' ? null : 'contrario')} className={`w-6 h-5 rounded text-xs ${cur?.voto==='contrario'?'bg-red-300':'bg-slate-100'}`}>✕</button>
                                        <button disabled={blocked} onClick={()=>registrarVoto(it.id, p.name, cur?.voto==='outro' ? null : 'outro')} className={`h-5 px-1.5 rounded text-xs ${cur?.voto==='outro'?'bg-slate-400':'bg-slate-100'}`}>Outro</button>
                                        {cur?.voto==='outro' && (
                                          <input value={outroTxt[`${it.id}:${p.name}`]||cur.outro_texto||''} onChange={e=>setOutroTxt(t=>({...t, [`${it.id}:${p.name}`]: e.target.value}))} onBlur={()=>registrarVoto(it.id, p.name, 'outro')} placeholder="…" className="border rounded px-1 h-5 text-xs w-32" />
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })
                        })()}
                        <button onClick={async ()=>{
                          const r = await authFetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: it.id})})
                          const j = await r.json()
                          if (j.needsManual) setNeedsManual(m=>({...m, [it.id]: true}))
                          else if (j.ok) { const x = await authFetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: it.id, status: j.status==='aprovado_nominal'?'aprovado_relator':'rejeitado_relator'})}).catch(()=>{}) }
                          load()
                        }} className="bg-alesp text-white rounded px-2 py-0.5 text-xs mt-1">Finalizar nominal</button>
                        {needsManual[it.id] && (
                          <div className="flex gap-1 mt-1">
                            <button onClick={async ()=>{ await authFetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: it.id, decisaoManual:'aprovado'})}); setNeedsManual(m=>({...m, [it.id]:false})); load() }} className="bg-green-600 text-white rounded px-2 py-0.5 text-xs">Aprovado (manual)</button>
                            <button onClick={async ()=>{ await authFetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: it.id, decisaoManual:'rejeitado'})}); setNeedsManual(m=>({...m, [it.id]:false})); load() }} className="bg-red-600 text-white rounded px-2 py-0.5 text-xs">Rejeitado (manual)</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {vistaList.length>0 && <div className="text-xs mt-2 text-slate-700">Vista solicitada por: {vistaList.join(', ')}</div>}
                {status==='nao_deliberado' && <div className="text-xs mt-1 font-bold text-slate-600">Não deliberado</div>}
                {!encerrada && (
                  <div className="mt-3">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Anotação do secretário</div>
                    <div className="flex gap-1">
                      <div className="relative flex-1">
                        <input value={notas[it.id]||''} onChange={e=>{ setNotas(n=>({...n, [it.id]: e.target.value})); setSavedNotas(s=>({...s, [it.id]: false})) }} placeholder="Anotação interna…" className="w-full border rounded px-2 py-1.5 text-sm pr-8" />
                        {savedNotas[it.id] && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 text-sm">✔️</span>}
                      </div>
                      <button onClick={()=>saveNota(it.id)} className={`${savedNotas[it.id] ? 'bg-blue-600' : 'bg-slate-700'} text-white rounded px-3 text-xs font-bold`}>{savedNotas[it.id] ? 'Editar' : 'Salvar'}</button>
                    </div>
                  </div>
                )}
                {vistaOpen===it.id && !encerrada && (
                  <div className="mt-3 border border-slate-300 rounded-lg p-3 bg-white">
                    <div className="text-sm font-bold mb-2">Quem solicitou vista?</div>
                    {deputadosPresentes.length===0 && <div className="text-xs text-slate-500 mb-2">Nenhum parlamentar presente ainda. Aguarde a aba Presentes.</div>}
                    {deputadosPresentes.map(p=>(
                      <label key={p.id} className="flex items-center gap-2 text-sm py-1">
                        <input type="checkbox" checked={vistaSel.includes(p.name)} onChange={()=>toggleVistaName(p.name)} />
                        {p.name} <span className="text-slate-500">({p.profile})</span>
                      </label>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <button onClick={()=>saveVista(it.id)} className="bg-alesp text-white rounded px-4 py-2 text-sm font-bold">Registrar vista</button>
                      <button onClick={()=>setVistaOpen(null)} className="bg-slate-100 rounded px-4 py-2 text-sm">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <a href={`/api/reuniao/${id}/relatorio.pdf`} className="block text-center bg-yellow-400 text-slate-900 font-bold rounded-xl p-3">Baixar relatório</a>
        </div>
        <div className="order-1 lg:order-2">
          <PresentesTab idReuniao={id} />
        </div>
      </div>
      {confirmEncerrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <div className="font-bold mb-2">Encerrar reunião?</div>
            <div className="text-sm text-slate-600 mb-4">Itens sem deliberação ficarão "Não deliberado". Após encerrar, não será possível alterar status nem presenças até reabrir.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setConfirmEncerrar(false)} className="bg-slate-100 rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={doEncerrar} className="bg-red-600 text-white rounded px-4 py-2 text-sm font-bold">Encerrar</button>
            </div>
          </div>
        </div>
      )}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <div className="font-bold mb-2">Limpar dados?</div>
            <div className="text-sm text-slate-600 mb-4">Isso remove todas as deliberações e vistas desta reunião. Presenças serão mantidas.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setConfirmClear(false)} className="bg-slate-100 rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={limpar} className="bg-red-600 text-white rounded px-4 py-2 text-sm font-bold">Limpar</button>
            </div>
          </div>
        </div>
      )}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <div className="font-bold mb-2">Há pedido de vista neste item</div>
            <div className="text-sm text-slate-600 mb-4">Deseja limpar a vista e registrar {ACTIONS_LABEL[pendingAction.status] || pendingAction.status}?</div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setPendingAction(null)} className="bg-slate-100 rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={confirmPending} className="bg-alesp text-white rounded px-4 py-2 text-sm font-bold">Limpar e registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
