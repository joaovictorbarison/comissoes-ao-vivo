import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import { useAuth } from '../context/AuthContext.jsx'

function formatName(n='') {
  return String(n||'').trim().toLowerCase().split(/\s+/).map(w => ['de','da','do','das','dos','e'].includes(w) ? w : w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
}

export default function RegistroVista() {
  const { id } = useParams()
  const { authFetch } = useAuth()
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [meeting, setMeeting] = useState({})
  const [presencas, setPresencas] = useState([])
  const [depSel, setDepSel] = useState(new Set())
  const [vistas, setVistas] = useState({})
  const [feedback, setFeedback] = useState('')
  const socket = useSocket(id)

  const load = async () => {
    const r = await authFetch(`/api/reuniao/${id}`).catch(()=>null)
    if (!r || r.ok === false) return
    const j = await r.json().catch(()=>null)
    if (!j) return
    setItems(j.items || j || [])
    setMeeting(j)
    const p = await authFetch(`/api/reuniao/${id}/presencas`).then(r=>r.json()).catch(()=>[])
    setPresencas(Array.isArray(p) ? p : [])
    const v = await authFetch(`/api/reuniao/${id}/vistas`).then(r=>r.json()).catch(()=>({}))
    setVistas(v)
  }
  const reloadTimer = useRef(null)
  useEffect(()=>{ if(id) load() }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      reloadTimer.current = setTimeout(()=>load(), 150)
    }
    socket.on('official_status_changed', on)
    socket.on('presence_pending', on)
    socket.on('presence_confirmed', on)
    return ()=>{ if (reloadTimer.current) clearTimeout(reloadTimer.current); socket.off('official_status_changed', on); socket.off('presence_pending', on); socket.off('presence_confirmed', on) }
  }, [socket])

  const toggle = (itemId) => {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(String(itemId))) n.delete(String(itemId)); else n.add(String(itemId))
      return n
    })
  }
  const toggleDeputado = (name) => {
    setDepSel(s => {
      const n = new Set(s)
      if (n.has(name)) n.delete(name); else n.add(name)
      return n
    })
  }

  const registrar = async () => {
    if (depSel.size===0 || selected.size===0) { alert('Selecione ao menos um deputado e um item.'); return }
    await authFetch(`/api/reuniao/${id}/vista-bloco`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemIds: [...selected], names: [...depSel]})})
    setFeedback(`Vista registrada para ${depSel.size} parlamentar(es) em ${selected.size} item(ns).`)
    setTimeout(()=>setFeedback(''), 4000)
    setSelected(new Set())
    setDepSel(new Set())
    load()
  }

  const deputadosPresentes = presencas.filter(p=>p.profile==='deputado')
  const comissaoNome = meeting?.solicitante || meeting?.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || 'Registro de Vista'

  const cardColor = (status, hasVista) => {
    if (hasVista) return 'bg-orange-300 border-orange-500 text-orange-900'
    if (status==='aprovado_relator' || status==='aprovado_simbolico' || status==='aprovado_nominal') return 'bg-green-300 border-green-500 text-green-900'
    if (status==='rejeitado_relator' || status==='rejeitado_simbolico' || status==='rejeitado_nominal') return 'bg-red-300 border-red-500 text-red-900'
    if (status==='vista') return 'bg-orange-300 border-orange-500 text-orange-900'
    if (status==='retirado') return 'bg-slate-400 border-slate-600 text-slate-900'
    if (status==='em_discussao') return 'bg-blue-300 border-blue-500 text-blue-900'
    if (status==='em_votacao') return 'bg-yellow-300 border-yellow-500 text-yellow-900'
    return 'bg-white border-slate-300 text-slate-700'
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <h1 className="text-lg font-extrabold text-alesp">{comissaoNome} — Registro de Vista</h1>
        <Link to={`/reuniao/${id}`} className="text-sm bg-slate-700 text-white rounded-lg px-3 py-2 font-bold">Voltar</Link>
      </div>

      <div className="text-sm font-bold text-slate-700 mt-3 mb-2">Deputados solicitantes (selecione um ou mais):</div>
      <div className="flex flex-wrap gap-2">
        {deputadosPresentes.length===0 && <div className="text-sm text-slate-500">Nenhum deputado com presença registrada ainda.</div>}
        {deputadosPresentes.map(p=>{
          const sel = depSel.has(p.name)
          return (
            <button key={p.id} onClick={()=>toggleDeputado(p.name)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${sel?'bg-orange-500 border-orange-600 text-white ring-2 ring-orange-300':'bg-white border-slate-300 text-slate-800 hover:bg-orange-50'}`} title={formatName(p.name)}>
              {formatName(p.name)}{p.confirmed ? '' : ' (pendente)'}
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 items-center mt-4">
        <button onClick={registrar} className="rounded-lg px-4 py-2 text-sm bg-orange-500 text-white font-bold disabled:opacity-50" disabled={depSel.size===0 || selected.size===0}>Registrar vista{depSel.size>0 && selected.size>0 ? ` (${depSel.size} parlamentar(es), ${selected.size} item(ns))` : ''}</button>
        {feedback && <div className="text-sm text-green-700 font-bold">✔️ {feedback}</div>}
      </div>
      <div className="text-sm font-bold text-slate-700 mt-4">Selecionados: {selected.size}</div>

      <div className="flex flex-wrap gap-2 mt-2">
        {items.map(it=>{
          const sel = selected.has(String(it.id))
          const st = it.status_oficial
          const proc = it.processoDadosView || {}
          const desc = proc.txDescricao || ''
          const vistaNames = vistas[it.id] || []
          const color = cardColor(st, vistaNames.length>0)
          return (
            <button key={it.id} onClick={()=>toggle(it.id)} title={`${it.nuOrdem} — ${desc}`} className={`w-32 h-32 rounded-xl border-2 p-2 flex flex-col items-center text-center gap-0.5 ${sel?'ring-2 ring-yellow-400 bg-yellow-200 border-yellow-500 text-yellow-900':color} hover:opacity-80 overflow-hidden`}>
              <div className="text-2xl font-black leading-none">{it.nuOrdem}</div>
              <div className="text-[10px] font-bold leading-tight line-clamp-2">{desc}</div>
              {vistaNames.length>0 && (
                <div className="w-full mt-auto pt-1 leading-tight space-y-0.5">
                  {vistaNames.map((n,i)=>(<div key={i} className="text-[8px] font-semibold leading-tight break-words border-t border-current/20 pt-0.5">{formatName(n)}</div>))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
