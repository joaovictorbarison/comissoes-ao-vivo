import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import { useProcessoLinks } from '../hooks/useProcessoLinks.js'

export default function RegistroVista() {
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [meeting, setMeeting] = useState({})
  const [presencas, setPresencas] = useState([])
  const [deputado, setDeputado] = useState('')
  const [vistas, setVistas] = useState({})
  const socket = useSocket(id)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    const j = await r.json()
    setItems(j.items || j || [])
    setMeeting(j)
    const p = await fetch(`/api/reuniao/${id}/presencas`).then(r=>r.json()).catch(()=>[])
    setPresencas(p)
    const v = await fetch(`/api/reuniao/${id}/vistas`).then(r=>r.json()).catch(()=>({}))
    setVistas(v)
  }
  useEffect(()=>{ if(id) load() }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => load()
    socket.on('official_status_changed', on)
    socket.on('presence_pending', on)
    socket.on('presence_confirmed', on)
    return ()=>{ socket.off('official_status_changed', on); socket.off('presence_pending', on); socket.off('presence_confirmed', on) }
  }, [socket])

  const toggle = (itemId) => {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(String(itemId))) n.delete(String(itemId)); else n.add(String(itemId))
      return n
    })
  }

  const registrar = async () => {
    if (!deputado || selected.size===0) { alert('Selecione um deputado e ao menos um item.'); return }
    await fetch(`/api/reuniao/${id}/vista-bloco`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemIds: [...selected], names: [deputado]})})
    setSelected(new Set())
    load()
  }

  const deputadosPresentes = presencas.filter(p=>p.profile==='deputado')
  const comissaoNome = meeting?.solicitante || meeting?.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || 'Registro de Vista'

  const cardColor = (status) => {
    if (status==='aprovado_relator' || status==='aprovado_simbolico') return 'bg-green-300 border-green-500 text-green-900'
    if (status==='rejeitado_relator' || status==='rejeitado_simbolico') return 'bg-red-300 border-red-500 text-red-900'
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
      <div className="flex gap-2 flex-wrap mt-3 items-center">
        <label className="text-sm font-bold">Deputado solicitante:</label>
        <select value={deputado} onChange={e=>setDeputado(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Selecione…</option>
          {deputadosPresentes.map(p=>(<option key={p.id} value={p.name}>{p.name}</option>))}
        </select>
        <button onClick={registrar} className="rounded px-3 py-2 text-sm bg-orange-500 text-white font-bold">Registrar vista</button>
      </div>
      <div className="text-sm font-bold text-slate-700 mt-2">Selecionados: {selected.size}</div>
      <div className="w-fit mt-2">
        <div className="grid grid-cols-10 gap-0.5">
          {items.map(it=>{
            const sel = selected.has(String(it.id))
            const st = it.status_oficial
            const color = cardColor(st)
            const vistaNames = vistas[it.id] || []
            return (
              <button key={it.id} onClick={()=>toggle(it.id)} className={`w-9 h-9 rounded border text-xs font-bold flex items-center justify-center ${sel?'ring-1 ring-yellow-400 bg-yellow-200 border-yellow-500 text-yellow-900':color} hover:opacity-80`} title={vistaNames.length?`Vista: ${vistaNames.join(', ')}`:''}>
                {it.nuOrdem}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
