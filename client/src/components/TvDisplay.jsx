import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'

function pickActive(items=[]) {
  // Regra automática: em votação > em discussão > primeiro
  return items.find(i=>i.status_oficial==='em_votacao')
    || items.find(i=>i.status_oficial==='em_discussao')
    || items[0]
}

export default function TvDisplay() {
  const { id } = useParams()
  const [data, setData] = useState({ items: [], active_item_id: null })
  const socket = useSocket(id)
  const load = async () => {
    const r = await fetch(`/api/reuniao/${id}`)
    setData(await r.json())
  }
  useEffect(()=>{ load() }, [id])
  useEffect(()=>{
    if(!socket) return
    const on = () => load()
    socket.on('official_status_changed', on)
    socket.on('active_item_changed', on)
    return ()=>{ socket.off('official_status_changed', on); socket.off('active_item_changed', on) }
  }, [socket])
  const active = pickActive(data.items) || data.items?.find(i=>String(i.id)===String(data.active_item_id))
  if(!active) return <div className="bg-black text-white min-h-screen flex items-center justify-center">Aguardando item…</div>
  const proc = active.processoDadosView||{}
  const isVoting = active.status_oficial==='em_votacao'
  const title = isVoting ? 'EM VOTAÇÃO' : (active.status_oficial==='em_discussao' ? 'EM DISCUSSÃO' : 'PAUTA')
  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center p-6">
      <div className="text-center w-full max-w-4xl border-2 border-blue-800 rounded-2xl p-10 bg-gradient-to-b from-alesp to-black">
        <div className="text-xs uppercase tracking-widest opacity-80">Assembleia Legislativa do Estado de São Paulo</div>
        <div className="text-4xl font-black mt-2">{title}</div>
        <div className="inline-block bg-yellow-400 text-black font-extrabold px-4 py-1 rounded-full mt-3">ITEM {active.nuOrdem} • {proc.txDescricao}</div>
        <div className="text-2xl font-bold mt-4">{proc.txEmenta}</div>
        <div className="text-sm opacity-80 mt-3">somente leitura • atualiza automaticamente</div>
      </div>
    </div>
  )
}
