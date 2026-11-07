import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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

const ACTIONS_ALL = [
  {k:'em_discussao', label:'Em discussão'},
  {k:'em_votacao', label:'Em votação'},
  {k:'aprovado_relator', label:'Aprovado ✓'},
  {k:'rejeitado_relator', label:'Rejeitado ✕'},
  {k:'aprovado_separado', label:'Aprovado voto em separado'},
  {k:'vista', label:'Vista'},
  {k:'retirado', label:'Retirado'}
]

function cardClass(status) {
  if (status==='aprovado_relator' || status==='aprovado_separado') return 'border-green-200 bg-green-50'
  if (status==='rejeitado_relator') return 'border-red-200 bg-red-50'
  if (status==='vista' || status==='retirado') return 'border-slate-300 bg-slate-50'
  return 'border-slate-200 bg-white'
}
function btnClass(actionKey, currentStatus) {
  if (actionKey!==currentStatus) return 'bg-slate-100 hover:bg-slate-200'
  if (actionKey==='aprovado_relator' || actionKey==='aprovado_separado') return 'bg-green-200 text-green-900 font-bold'
  if (actionKey==='rejeitado_relator') return 'bg-red-200 text-red-900 font-bold'
  if (actionKey==='vista' || actionKey==='retirado') return 'bg-slate-300 text-slate-900 font-bold'
  if (actionKey==='em_discussao') return 'bg-yellow-200 text-yellow-900 font-bold'
  if (actionKey==='em_votacao') return 'bg-blue-200 text-blue-900 font-bold'
  return 'bg-slate-100 font-bold'
}

export default function PautaSecretario() {
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [presencas, setPresencas] = useState([])
  const [vistaOpen, setVistaOpen] = useState(null) // itemId
  const [vistaSel, setVistaSel] = useState([])
  const [vistas, setVistas] = useState({})
  const socket = useSocket(id)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    const j = await r.json()
    setItems(j.items || j || [])
  }
  const loadPres = async () => {
    const r = await fetch(`/api/reuniao/${id}/presencas`)
    setPresencas(await r.json().catch(()=>[]))
  }
  const loadVistas = async () => {
    const r = await fetch(`/api/reuniao/${id}/vistas`)
    setVistas(await r.json().catch(()=>({})))
  }
  useEffect(()=>{ if(id){ load(); loadPres(); loadVistas() } }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => { load(); loadPres(); loadVistas() }
    socket.on('official_status_changed', on)
    socket.on('active_item_changed', on)
    socket.on('presence_pending', on)
    socket.on('presence_confirmed', on)
    return ()=>{ socket.off('official_status_changed', on); socket.off('active_item_changed', on); socket.off('presence_pending', on); socket.off('presence_confirmed', on) }
  }, [socket])

  const setStatus = async (itemId, status) => {
    if (status==='vista') {
      await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status})})
      setVistaOpen(itemId)
      setVistaSel([])
      load(); loadVistas()
      return
    }
    await fetch(`/api/reuniao/${id}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, status})})
    load()
  }

  const saveVista = async (itemId) => {
    if (vistaSel.length===0) { alert('Selecione ao menos um parlamentar.'); return }
    await fetch(`/api/reuniao/${id}/vista`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId, names: vistaSel})})
    setVistaOpen(null)
    load(); loadVistas()
  }

  const toggleVistaName = (name) => {
    setVistaSel(s => s.includes(name) ? s.filter(n=>n!==name) : [...s, name])
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-alesp">Painel do Secretário</h1>
        <Link to={`/tv/${id}`} target="_blank" className="text-sm bg-black text-white rounded-lg px-3 py-2 font-bold">📺 Ver TV (testar)</Link>
      </div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-4 mt-4">
        <div>
          {items.map(it=>{
            const proc = it.processoDadosView||{}
            const status = it.status_oficial||'pendente'
            const vistaList = vistas[it.id] || []
            return (
              <div key={it.id} className={`border-2 rounded-xl p-4 mb-3 ${cardClass(status)}`}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-2xl font-black text-slate-900">Item {it.nuOrdem}</span>
                  <span className="text-xl font-extrabold text-alesp">{proc.txDescricao}</span>
                </div>
                <div className="font-bold mt-1 text-slate-800">{proc.txEmenta}</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {ACTIONS_ALL.map(a=>(<button key={a.k} onClick={()=>setStatus(it.id,a.k)} className={`rounded px-3 py-2 text-sm ${btnClass(a.k,status)}`}>{a.label}</button>))}
                </div>
                {vistaList.length>0 && <div className="text-xs mt-2 text-slate-700">Vista solicitada por: {vistaList.join(', ')}</div>}
                {vistaOpen===it.id && (
                  <div className="mt-3 border border-slate-300 rounded-lg p-3 bg-white">
                    <div className="text-sm font-bold mb-2">Quem solicitou vista?</div>
                    {presencas.length===0 && <div className="text-xs text-slate-500 mb-2">Nenhum parlamentar presente ainda. Aguarde a aba Presentes.</div>}
                    {presencas.map(p=>(
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
    </div>
  )
}
