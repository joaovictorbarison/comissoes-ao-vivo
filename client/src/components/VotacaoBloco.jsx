import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import { useProcessoLinks } from '../hooks/useProcessoLinks.js'
import { proposituraUrl } from '../lib/legisLinks.js'

export default function VotacaoBloco() {
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [status, setStatus] = useState('em_discussao')
  const [meeting, setMeeting] = useState({})
  const [blocos, setBlocos] = useState([])
  const socket = useSocket(id)
  const linksMap = useProcessoLinks(items)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    const j = await r.json()
    setItems(j.items || j || [])
    setMeeting(j)
    const b = await fetch(`/api/reuniao/${id}/bloco`).then(r=>r.json()).catch(()=>({}))
    if (b.itemIds && b.ativo && (b.status === 'em_discussao' || b.status === 'em_votacao')) {
      setSelected(new Set(b.itemIds))
    } else {
      setSelected(new Set())
    }
    if (b.status) setStatus(b.status)
    const bl = await fetch(`/api/reuniao/${id}/blocos`).then(r=>r.json()).catch(()=>[])
    setBlocos(Array.isArray(bl) ? bl : [])
  }
  useEffect(()=>{ if(id) load() }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => load()
    socket.on('bloco_changed', on)
    socket.on('official_status_changed', on)
    return ()=>{ socket.off('bloco_changed', on); socket.off('official_status_changed', on) }
  }, [socket])

  const toggle = (itemId) => {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(String(itemId))) n.delete(String(itemId)); else n.add(String(itemId))
      return n
    })
  }

  const aplicar = async (st) => {
    setStatus(st)
    await fetch(`/api/reuniao/${id}/bloco`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemIds: [...selected], status: st})})
    setSelected(new Set())
    load()
  }
  const desativar = async () => {
    await fetch(`/api/reuniao/${id}/bloco`, {method:'DELETE'})
    setSelected(new Set())
    load()
  }

  const comissaoNome = meeting?.solicitante || meeting?.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || 'Votação em Bloco'

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <h1 className="text-lg font-extrabold text-alesp">{comissaoNome} — Votação em Bloco</h1>
        <div className="flex gap-2 flex-wrap">
          <Link to={`/reuniao/${id}`} className="text-sm bg-slate-700 text-white rounded-lg px-3 py-2 font-bold">Voltar</Link>
          <Link to={`/tv/${id}`} target="_blank" className="text-sm bg-black text-white rounded-lg px-3 py-2 font-bold">📺 Ver TV</Link>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mt-3">
        <button onClick={()=>aplicar('em_discussao')} className={`rounded px-3 py-2 text-sm font-bold ${status==='em_discussao'?'bg-blue-600 text-white':'bg-blue-300 text-blue-900'}`}>Em discussão</button>
        <button onClick={()=>aplicar('em_votacao')} className={`rounded px-3 py-2 text-sm font-bold ${status==='em_votacao'?'bg-yellow-600 text-white':'bg-yellow-300 text-yellow-900'}`}>Em votação</button>
        <button onClick={()=>aplicar('aprovado_relator')} className={`rounded px-3 py-2 text-sm font-bold ${status==='aprovado_relator'?'bg-green-600 text-white':'bg-green-300 text-green-900'}`}>Aprovado</button>
        <button onClick={()=>aplicar('rejeitado_relator')} className={`rounded px-3 py-2 text-sm font-bold ${status==='rejeitado_relator'?'bg-red-600 text-white':'bg-red-300 text-red-900'}`}>Rejeitado</button>
        <button onClick={desativar} className="rounded px-3 py-2 text-sm bg-slate-700 text-white font-bold" title="Desativa o bloco na TV e volta para a pauta normal">Desativar na TV</button>
      </div>
      <div className="text-sm font-bold text-slate-700 mt-2">Status do bloco: <span className="text-alesp">{status==='em_discussao'?'Em discussão':status==='em_votacao'?'Em votação':status==='aprovado_relator'?'Aprovado':status==='rejeitado_relator'?'Rejeitado':status}</span></div>
      {blocos.length>0 && (
        <div className="mt-3 border-t pt-2">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Blocos registrados</div>
          {blocos.map(b=>(
            <div key={b.id} className="text-sm text-slate-700 py-0.5">
              Bloco {b.numero}: Itens {b.itemIds.map(i=>items.find(x=>String(x.id)===String(i))?.nuOrdem||i).join(', ')} - {b.resultado}
            </div>
          ))}
        </div>
      )}
      <div className="w-fit mt-2">
        <div className="grid grid-cols-10 gap-px">
        {items.map(it=>{
          const sel = selected.has(String(it.id))
          const st = it.status_oficial
          const color = st==='aprovado_relator' || st==='aprovado_simbolico' ? 'bg-green-300 border-green-500 text-green-900'
            : st==='rejeitado_relator' || st==='rejeitado_simbolico' ? 'bg-red-300 border-red-500 text-red-900'
            : st==='vista' ? 'bg-orange-300 border-orange-500 text-orange-900'
            : st==='retirado' ? 'bg-slate-400 border-slate-600 text-slate-900'
            : st==='em_discussao' ? 'bg-blue-300 border-blue-500 text-blue-900'
            : st==='em_votacao' ? 'bg-yellow-300 border-yellow-500 text-yellow-900'
            : 'bg-white border-slate-300 text-slate-700'
          return (
            <button key={it.id} onClick={()=>toggle(it.id)} className={`w-9 h-9 rounded border text-xs font-bold flex items-center justify-center ${sel?'ring-1 ring-yellow-400 bg-yellow-200 border-yellow-500 text-yellow-900':color} hover:opacity-80`}>
              {it.nuOrdem}
            </button>
          )
        })}
        </div>
      </div>
    </div>
  )
}
