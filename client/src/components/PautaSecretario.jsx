import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import { useProcessoLinks } from '../hooks/useProcessoLinks.js'
import { proposituraUrl, votoUrl } from '../lib/legisLinks.js'
import PresentesTab from './PresentesTab.jsx'

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

function cardClass(status) {
  if (status==='aprovado_relator' || status==='aprovado_simbolico') return 'border-green-300 bg-green-100'
  if (status==='aprovado_nominal') return 'border-green-400 bg-green-200'
  if (status==='rejeitado_relator' || status==='rejeitado_nominal') return 'border-red-300 bg-red-100'
  if (status==='vista') return 'border-orange-300 bg-orange-100'
  if (status==='retirado') return 'border-slate-400 bg-slate-200'
  if (status==='em_discussao') return 'border-yellow-300 bg-yellow-100'
  if (status==='em_votacao') return 'border-blue-300 bg-blue-100'
  if (status==='nao_deliberado') return 'border-slate-300 bg-slate-100'
  return 'border-slate-200 bg-white'
}
function btnClass(actionKey, currentStatus) {
  if (actionKey!==currentStatus) return 'bg-slate-100 hover:bg-slate-200'
  if (actionKey==='aprovado_relator' || currentStatus==='aprovado_simbolico' || currentStatus==='aprovado_nominal') return 'bg-green-300 text-green-900 font-bold'
  if (actionKey==='rejeitado_relator' || currentStatus==='rejeitado_nominal') return 'bg-red-300 text-red-900 font-bold'
  if (actionKey==='vista') return 'bg-orange-300 text-orange-900 font-bold'
  if (actionKey==='retirado') return 'bg-slate-400 text-slate-900 font-bold'
  if (actionKey==='em_discussao') return 'bg-yellow-300 text-yellow-900 font-bold'
  if (actionKey==='em_votacao') return 'bg-blue-300 text-blue-900 font-bold'
  return 'bg-slate-100 font-bold'
}

export default function PautaSecretario() {
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [meeting, setMeeting] = useState({})
  const [presencas, setPresencas] = useState([])
  const [vistaOpen, setVistaOpen] = useState(null)
  const [vistaSel, setVistaSel] = useState([])
  const [vistas, setVistas] = useState({})
  const [confirmClear, setConfirmClear] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [iniciada, setIniciada] = useState(false)
  const [encerrada, setEncerrada] = useState(false)
  const [votTipo, setVotTipo] = useState({})
  const [votosNom, setVotosNom] = useState({})
  const [outroTxt, setOutroTxt] = useState({})
  const [notas, setNotas] = useState({})
  const [needsManual, setNeedsManual] = useState({})
  const socket = useSocket(id)
  const linksMap = useProcessoLinks(items)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    const j = await r.json()
    setItems(j.items || j || [])
    setMeeting(j)
    setEncerrada(!!j.encerrada)
    setIniciada(!!j.iniciada)
  }
  const loadPres = async () => {
    const r = await fetch(`/api/reuniao/${id}/presencas`)
    setPresencas(await r.json().catch(()=>[]))
  }
  const loadVistas = async () => {
    const r = await fetch(`/api/reuniao/${id}/vistas`)
    setVistas(await r.json().catch(()=>({})))
  }
  const loadNom = async () => {
    const r = await fetch(`/api/reuniao/${id}/votos-nominais`).catch(()=>null)
    if (r) setVotosNom(await r.json().catch(()=>({})))
  }
  const loadNotas = async () => {
    const r = await fetch(`/api/reuniao/${id}/anotacoes-secretario`).catch(()=>null)
    if (r) setNotas(await r.json().catch(()=>({})))
  }
  const loadEstado = async () => {
    const r = await fetch(`/api/sessoes`).catch(()=>null)
    if (r) {
      const j = await r.json().catch(()=>({}))
      setIniciada(!!j[String(id)]?.iniciada)
      setEncerrada(!!j[String(id)]?.encerrada)
    }
  }
  useEffect(()=>{ if(id){ load(); loadPres(); loadVistas(); loadEstado(); loadNom(); loadNotas() } }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => { load(); loadPres(); loadVistas(); loadEstado(); loadNom(); loadNotas() }
    socket.on('official_status_changed', on)
    socket.on('active_item_changed', on)
    socket.on('presence_pending', on)
    socket.on('presence_confirmed', on)
    socket.on('voto_nominal_changed', on)
    return ()=>{ socket.off('official_status_changed', on); socket.off('active_item_changed', on); socket.off('presence_pending', on); socket.off('presence_confirmed', on); socket.off('voto_nominal_changed', on) }
  }, [socket])

  const iniciar = async () => {
    await fetch(`/api/reuniao/${id}/iniciar`, {method:'POST'})
    setIniciada(true); setEncerrada(false)
    load(); loadPres(); loadVistas(); loadEstado()
  }
  const encerrar = async () => {
    await fetch(`/api/reuniao/${id}/encerrar`, {method:'POST'})
    setEncerrada(true)
    load(); loadPres(); loadVistas(); loadEstado()
  }
  const reabrir = async () => {
    await fetch(`/api/reuniao/${id}/reabrir`, {method:'POST'})
    setEncerrada(false); setIniciada(true)
    load(); loadPres(); loadVistas(); loadEstado()
  }
  const limpar = async () => {
    await fetch(`/api/reuniao/${id}/limpar`, {method:'POST'})
    setConfirmClear(false)
    load(); loadVistas(); loadEstado(); loadNom(); loadNotas()
  }

  const applyStatus = async (item, status) => {
    if (encerrada) return
    await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: item.id, status})})
    load()
  }

  const setStatus = async (item, status) => {
    if (encerrada) return
    const itemId = item.id
    const current = item.status_oficial || 'pendente'
    if (status==='em_votacao') {
      // abre painel simbólica/nominal
      setVotTipo(t=>({...t, [itemId]: t[itemId] || 'simbolica'}))
      if (current !== 'em_votacao') {
        await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status})})
      }
      load()
      return
    }
    if (status==='vista') {
      if (current !== 'vista') {
        await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status})})
      }
      setVistaOpen(itemId)
      setVistaSel(vistas[itemId] || [])
      load(); loadVistas()
      return
    }
    if (status === current) {
      await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status:'pendente'})})
      load()
      return
    }
    // Aprovado na simbólica → snapshot
    if (status==='aprovado_relator' && (votTipo[itemId]||'simbolica')==='simbolica') {
      await fetch(`/api/reuniao/${id}/votacao-simbolica`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId})})
      load(); loadNom()
      return
    }
    if (status==='aprovado_relator' && votTipo[itemId]==='nominal') {
      // finalizar nominal (auto ou manual se outro>=4)
      const r = await fetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, decisaoManual: needsManual[itemId] ? 'aprovado' : null})})
      const j = await r.json()
      if (j.needsManual) { setNeedsManual(m=>({...m, [itemId]: true})); alert('4 ou mais "Outro". Defina Aprovado ou Rejeitado.'); return }
      load(); return
    }
    if (status==='rejeitado_relator' && votTipo[itemId]==='nominal') {
      const r = await fetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, decisaoManual: needsManual[itemId] ? 'rejeitado' : null})})
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
    await fetch(`/api/reuniao/${id}/vista`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: item.id, names:[]})})
    await applyStatus(item, status)
    setPendingAction(null)
    loadVistas()
  }

  const saveVista = async (itemId) => {
    if (encerrada) return
    await fetch(`/api/reuniao/${id}/vista`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, names: vistaSel})})
    setVistaOpen(null)
    load(); loadVistas()
  }

  const toggleVistaName = (name) => {
    setVistaSel(s => s.includes(name) ? s.filter(n=>n!==name) : [...s, name])
  }

  const registrarVoto = async (itemId, deputado, voto) => {
    const outro = voto==='outro' ? (outroTxt[`${itemId}:${deputado}`]||'') : null
    await fetch(`/api/reuniao/${id}/voto-nominal`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, deputado, voto, outro})})
    loadNom()
  }

  const saveNota = async (itemId) => {
    await fetch(`/api/reuniao/${id}/item-nota`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, texto: notas[itemId]||''})})
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
                  <div className="mt-3 border border-slate-300 rounded-lg p-3 bg-white">
                    <div className="flex gap-2 mb-2">
                      <button onClick={()=>setVotTipo(t=>({...t, [it.id]:'simbolica'}))} className={`rounded px-3 py-1.5 text-sm font-bold ${tipo==='simbolica'?'bg-blue-600 text-white':'bg-slate-100'}`}>Simbólica</button>
                      <button onClick={()=>setVotTipo(t=>({...t, [it.id]:'nominal'}))} className={`rounded px-3 py-1.5 text-sm font-bold ${tipo==='nominal'?'bg-blue-600 text-white':'bg-slate-100'}`}>Nominal</button>
                    </div>
                    {tipo==='nominal' && (
                      <div>
                        {deputadosPresentes.length===0 && <div className="text-xs text-slate-500 mb-2">Nenhum parlamentar presente ainda.</div>}
                        {needManual && <div className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 mb-2">4 ou mais "Outro" — defina Aprovado ou Rejeitado para finalizar.</div>}
                        {deputadosPresentes.map(p=>{
                          const cur = nomVotes.find(v=>v.deputado_name===p.name)
                          return (
                            <div key={p.id} className="border rounded p-2 mb-1">
                              <div className="text-sm font-semibold">{p.name}</div>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                <button onClick={()=>registrarVoto(it.id, p.name, 'favoravel')} className={`rounded px-2 py-1 text-xs font-bold ${cur?.voto==='favoravel'?'bg-green-300':'bg-slate-100'}`}>Favorável</button>
                                <button onClick={()=>registrarVoto(it.id, p.name, 'contrario')} className={`rounded px-2 py-1 text-xs font-bold ${cur?.voto==='contrario'?'bg-red-300':'bg-slate-100'}`}>Contrário</button>
                                <button onClick={()=>registrarVoto(it.id, p.name, 'outro')} className={`rounded px-2 py-1 text-xs font-bold ${cur?.voto==='outro'?'bg-slate-400':'bg-slate-100'}`}>Outro</button>
                                {cur?.voto==='outro' && (
                                  <input value={outroTxt[`${it.id}:${p.name}`]||cur.outro_texto||''} onChange={e=>setOutroTxt(t=>({...t, [`${it.id}:${p.name}`]: e.target.value}))} onBlur={()=>registrarVoto(it.id, p.name, 'outro')} placeholder="Descreva o outro…" className="border rounded px-2 py-1 text-xs flex-1" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                        <button onClick={async ()=>{
                          const r = await fetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: it.id})})
                          const j = await r.json()
                          if (j.needsManual) setNeedsManual(m=>({...m, [it.id]: true}))
                          load()
                        }} className="bg-alesp text-white rounded px-3 py-1.5 text-xs font-bold mt-2">Finalizar votação nominal</button>
                        {needsManual[it.id] && (
                          <div className="flex gap-1 mt-1 ml-2">
                            <button onClick={async ()=>{ await fetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: it.id, decisaoManual:'aprovado'})}); setNeedsManual(m=>({...m, [it.id]:false})); load() }} className="bg-green-600 text-white rounded px-2 py-1 text-xs font-bold">Aprovado (manual)</button>
                            <button onClick={async ()=>{ await fetch(`/api/reuniao/${id}/votacao-nominal/finalizar`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: it.id, decisaoManual:'rejeitado'})}); setNeedsManual(m=>({...m, [it.id]:false})); load() }} className="bg-red-600 text-white rounded px-2 py-1 text-xs font-bold">Rejeitado (manual)</button>
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
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Anotação do secretário (só neste painel e no relatório)</div>
                    <div className="flex gap-1">
                      <input value={notas[it.id]||''} onChange={e=>setNotas(n=>({...n, [it.id]: e.target.value}))} placeholder="Anotação interna…" className="flex-1 border rounded px-2 py-1.5 text-sm" />
                      <button onClick={()=>saveNota(it.id)} className="bg-slate-700 text-white rounded px-3 text-xs font-bold">Salvar</button>
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
