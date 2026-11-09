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
  if (status==='aprovado_relator') return 'border-green-300 bg-green-100'
  if (status==='rejeitado_relator') return 'border-red-300 bg-red-100'
  if (status==='vista') return 'border-orange-300 bg-orange-100'
  if (status==='retirado') return 'border-slate-400 bg-slate-200'
  if (status==='em_discussao') return 'border-yellow-300 bg-yellow-100'
  if (status==='em_votacao') return 'border-blue-300 bg-blue-100'
  return 'border-slate-200 bg-white'
}
function btnClass(actionKey, currentStatus) {
  if (actionKey!==currentStatus) return 'bg-slate-100 hover:bg-slate-200'
  if (actionKey==='aprovado_relator') return 'bg-green-300 text-green-900 font-bold'
  if (actionKey==='rejeitado_relator') return 'bg-red-300 text-red-900 font-bold'
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
  const socket = useSocket(id)
  const linksMap = useProcessoLinks(items)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    const j = await r.json()
    setItems(j.items || j || [])
    setMeeting(j)
  }
  const loadEstado = async () => {
    const r = await fetch(`/api/sessoes`).catch(()=>null)
    if (r) {
      const j = await r.json().catch(()=>({}))
      setIniciada(!!j[String(id)]?.iniciada)
    }
  }
  const loadPres = async () => {
    const r = await fetch(`/api/reuniao/${id}/presencas`)
    setPresencas(await r.json().catch(()=>[]))
  }
  const loadVistas = async () => {
    const r = await fetch(`/api/reuniao/${id}/vistas`)
    setVistas(await r.json().catch(()=>({})))
  }
  useEffect(()=>{ if(id){ load(); loadPres(); loadVistas(); loadEstado() } }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => { load(); loadPres(); loadVistas(); loadEstado() }
    socket.on('official_status_changed', on)
    socket.on('active_item_changed', on)
    socket.on('presence_pending', on)
    socket.on('presence_confirmed', on)
    return ()=>{ socket.off('official_status_changed', on); socket.off('active_item_changed', on); socket.off('presence_pending', on); socket.off('presence_confirmed', on) }
  }, [socket])

  const iniciar = async () => {
    await fetch(`/api/reuniao/${id}/iniciar`, {method:'POST'})
    setIniciada(true)
    load(); loadPres(); loadVistas(); loadEstado()
  }
  const limpar = async () => {
    await fetch(`/api/reuniao/${id}/limpar`, {method:'POST'})
    setConfirmClear(false)
    load(); loadVistas(); loadEstado()
  }

  const applyStatus = async (item, status) => {
    await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: item.id, status})})
    load()
  }

  const setStatus = async (item, status) => {
    const itemId = item.id
    const current = item.status_oficial || 'pendente'
    // Vista: sempre abre o painel com checkboxes pré-marcados, nunca apaga direto
    if (status==='vista') {
      if (current !== 'vista') {
        await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status})})
      }
      setVistaOpen(itemId)
      setVistaSel(vistas[itemId] || [])
      load(); loadVistas()
      return
    }
    // Desfazer: clicar no mesmo botão volta para pendente
    if (status === current) {
      await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status:'pendente'})})
      load()
      return
    }
    // Se item tem vista, pedir confirmação antes de trocar para outra ação final
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
    // limpar vista antes de aplicar nova ação
    await fetch(`/api/reuniao/${id}/vista`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: item.id, names:[]})})
    await applyStatus(item, status)
    setPendingAction(null)
    loadVistas()
  }

  const saveVista = async (itemId) => {
    await fetch(`/api/reuniao/${id}/vista`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, names: vistaSel})})
    setVistaOpen(null)
    load(); loadVistas()
  }

  const toggleVistaName = (name) => {
    setVistaSel(s => s.includes(name) ? s.filter(n=>n!==name) : [...s, name])
  }

  const deputadosPresentes = presencas.filter(p=>p.profile==='deputado')
  const comissaoNome = meeting?.solicitante || meeting?.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || 'Painel do Secretário'

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <h1 className="text-lg font-extrabold text-alesp">{comissaoNome}</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={iniciar} disabled={iniciada} className={`text-sm w-36 rounded-lg px-3 py-2 font-bold ${iniciada ? 'bg-green-600 text-white opacity-50 cursor-not-allowed' : 'bg-green-600 text-white'}`}>{iniciada ? 'Reunião iniciada' : 'Iniciar reunião'}</button>
          <a href={`/api/reuniao/${id}/relatorio.pdf`} className="text-sm bg-yellow-400 text-slate-900 rounded-lg px-3 py-2 font-bold">Encerrar e baixar relatório final</a>
          <button onClick={()=>setConfirmClear(true)} className="text-sm bg-red-600 text-white rounded-lg px-3 py-2 font-bold">Limpar dados</button>
          <Link to={`/tv/${id}`} target="_blank" className="text-sm bg-black text-white rounded-lg px-3 py-2 font-bold">📺 Ver TV (testar)</Link>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-4 mt-4">
        <div>
          {items.map(it=>{
            const proc = it.processoDadosView||{}
            const vote = (it.documentosVoto||[])[0] || {}
            const status = it.status_oficial||'pendente'
            const vistaList = vistas[it.id] || []
            const pUrl = proposituraUrl(linksMap[proc.idProcesso])
            const vUrl = votoUrl(vote)
            return (
              <div key={it.id} className={`border-2 rounded-xl p-4 mb-3 ${cardClass(status)}`}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-2xl font-black text-slate-900">Item {it.nuOrdem} - {pUrl ? <a href={pUrl} target="_blank" rel="noreferrer" className="text-alesp underline">{proc.txDescricao}</a> : <>{proc.txDescricao}</>}</span>
                </div>
                <div className="font-bold mt-1 text-slate-800">{proc.txEmenta}</div>
                <div className="text-sm text-slate-600 mt-1">Autor: {proc.txNomeAutores}</div>
                {vote.autores && vote.conclusao && <div className="text-sm text-slate-600 mt-1">{vUrl ? <a href={vUrl} target="_blank" rel="noreferrer" className="text-alesp underline">Relator: {vote.autores} — <b>{vote.conclusao}</b></a> : <>Relator: {vote.autores} — <b>{vote.conclusao}</b></>}</div>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {ACTIONS_ALL.map(a=>(<button key={a.k} onClick={()=>setStatus(it,a.k)} className={`rounded px-3 py-2 text-sm ${btnClass(a.k,status)}`}>{a.label}</button>))}
                </div>
                {vistaList.length>0 && <div className="text-xs mt-2 text-slate-700">Vista solicitada por: {vistaList.join(', ')}</div>}
                {vistaOpen===it.id && (
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
          <a href={`/api/reuniao/${id}/relatorio.pdf`} className="block text-center bg-yellow-400 text-slate-900 font-bold rounded-xl p-3">Encerrar e baixar PDF final</a>
        </div>
        <PresentesTab idReuniao={id} />
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
