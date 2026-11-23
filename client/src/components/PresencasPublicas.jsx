import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useSocket } from '../hooks/useSocket.js'

function normalizeName(n=''){ return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
function formatName(n='') {
  if (!n) return ''
  return n.toLowerCase().split(' ').map(w => ['de','da','do','das','dos','e'].includes(w) ? w : w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
}

export default function PresencasPublicas({ idReuniao }) {
  const [presencas, setPresencas] = useState([])
  const [membros, setMembros] = useState([])
  const [partyPortal, setPartyPortal] = useState({})
  const [open, setOpen] = useState(true)
  const socket = useSocket(idReuniao)

  const load = async () => {
    const r = await fetch(`/api/reuniao/${idReuniao}/presencas`).catch(()=>null)
    if (!r || r.ok === false) return
    const j = await r.json().catch(()=>[])
    setPresencas(Array.isArray(j) ? j : [])
  }
  const loadMembros = async () => {
    const r = await fetch(`/api/reuniao/${idReuniao}`).catch(()=>null)
    if (!r || r.ok === false) return
    const j = await r.json().catch(()=>({}))
    const ids = (j.colegiadosRelacionados || []).map(c=>c.id).filter(Boolean)
    const seen = new Map()
    for (const cid of ids) {
      const mr = await fetch(`/api/legis/colegiados/${cid}/membros`).catch(()=>null)
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
    const pr = await fetch(`/api/legis/parlamentares-ativos`).catch(()=>null)
    if (pr) {
      const arr = await pr.json().catch(()=>[])
      const map = {}
      arr.forEach(p=>{ map[normalizeName(p.nome)] = p.partido || '' })
      setPartyPortal(map)
    }
  }

  const reloadTimer = useRef(null)
  const onPresence = () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(()=>load(), 150)
  }
  useEffect(()=>{ load(); loadMembros() }, [idReuniao])
  useEffect(()=>{
    if(!socket) return
    socket.on('presence_pending', onPresence)
    socket.on('presence_confirmed', onPresence)
    return ()=>{ if (reloadTimer.current) clearTimeout(reloadTimer.current); socket.off('presence_pending', onPresence); socket.off('presence_confirmed', onPresence) }
  }, [socket])

  const presConfirmedByKey = useMemo(()=>{
    const m = new Map()
    presencas.forEach(p=>{ if (p.confirmed) m.set(normalizeName(p.name), p) })
    return m
  }, [presencas])

  const efetivos = membros.filter(p=> !/substituto/i.test(p.ocupacao||''))
  const substitutos = membros.filter(p=> /substituto/i.test(p.ocupacao||''))
  const outrosPresentes = presencas.filter(p=> p.confirmed && !membros.some(m=>normalizeName(m.parlamentar)===normalizeName(p.name)))
  const presentCount = presencas.filter(p=>p.confirmed).length

  const row = (p) => {
    const present = presConfirmedByKey.has(normalizeName(p.parlamentar))
    const display = formatName(p.parlamentar)
    const party = p.federacao || p.partido || ''
    const cls = present ? 'bg-green-200 border-green-400' : 'bg-white border-slate-200'
    return (
      <div key={p.nuMatriculaParlamentar||p.parlamentar} className={`flex items-start justify-between gap-1 border rounded px-2 py-1 text-xs font-normal ${cls}`}>
        <span className="flex-1 min-w-0 break-words"><span>{display}</span>{party && <span className="text-slate-600"> ({party})</span>}{present ? ' ✓' : ''}</span>
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-xl p-3 mb-4 shadow-sm">
      <button onClick={()=>setOpen(o=>!o)} className="font-extrabold text-alesp text-sm flex items-center gap-1">
        Presenças <span className="text-xs font-normal text-slate-500">({presentCount} presentes)</span> <span className="text-xs">{open?'▼':'▶'}</span>
      </button>
      {open && (
        <div className="mt-2">
          {membros.length>0 && (
            <>
              <div className="text-[11px] font-bold text-slate-500 uppercase mb-0.5">Efetivos</div>
              <div className="grid gap-0.5">{efetivos.map(row)}</div>
              {substitutos.length>0 && (<>
                <div className="text-[11px] font-bold text-slate-500 uppercase mt-2 mb-0.5">Substitutos</div>
                <div className="grid gap-0.5">{substitutos.map(row)}</div>
              </>)}
            </>
          )}
          {outrosPresentes.length>0 && (
            <>
              <div className="text-[11px] font-bold text-slate-500 uppercase mt-2 mb-0.5">Outros parlamentares presentes</div>
              <div className="grid gap-0.5">{outrosPresentes.map(p=>{
                const display = formatName(p.name)
                const party = partyPortal[normalizeName(p.name)] || ''
                return (
                  <div key={p.id} className="flex items-start justify-between gap-1 border rounded px-2 py-1 text-xs font-normal bg-green-200 border-green-400">
                    <span className="flex-1 min-w-0 break-words"><span>{display}</span>{party && <span className="text-slate-600"> ({party})</span>} ✓</span>
                  </div>
                )
              })}</div>
            </>
          )}
          {membros.length===0 && outrosPresentes.length===0 && (
            <div className="text-xs text-slate-500">Nenhuma presença confirmada ainda.</div>
          )}
        </div>
      )}
    </div>
  )
}
