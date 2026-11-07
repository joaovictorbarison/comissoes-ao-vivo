import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'

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
  const active = data.items?.find(i=>String(i.id)===String(data.active_item_id)) || data.items?.[0]
  if(!active) return <div className="bg-black text-white min-h-screen flex items-center justify-center">Aguardando item…</div>
  const proc = active.processoDadosView||{}
  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center p-6">
      <div className="text-center w-full max-w-4xl border-2 border-blue-800 rounded-2xl p-10 bg-gradient-to-b from-alesp to-black">
        <div className="text-xs uppercase tracking-widest opacity-80">Assembleia Legislativa do Estado de São Paulo</div>
        <div className="text-4xl font-black mt-2">EM VOTAÇÃO</div>
        <div className="inline-block bg-yellow-400 text-black font-extrabold px-4 py-1 rounded-full mt-3">ITEM {active.nuOrdem} • {proc.txDescricao}</div>
        <div className="text-2xl font-bold mt-4">{proc.txEmenta}</div>
        <div className="text-sm opacity-80 mt-3">{active.status_oficial||'pendente'} • somente leitura</div>
      </div>
    </div>
  )
}
