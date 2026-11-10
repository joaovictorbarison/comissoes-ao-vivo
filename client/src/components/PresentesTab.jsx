import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useSocket } from '../hooks/useSocket.js'
import { useAuth } from '../context/AuthContext.jsx'

function normalizeName(n=''){ return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
function formatName(n='') {
  if (!n) return ''
  return n.toLowerCase().split(' ').map(w => {
    if (['de','da','do','das','dos','e'].includes(w)) return w
    return w.charAt(0).toUpperCase() + w.slice(1)
  }).join(' ')
}
function nameCls(n='') {
  return n.length > 28 ? 'text-[11px] leading-tight' : 'text-xs'
}

export default function PresentesTab({ idReuniao }) {
  const { authFetch } = useAuth()
  const [presencas, setPresencas] = useState([])
  const [membros, setMembros] = useState([])
  const [partyPortal, setPartyPortal] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [extraInputs, setExtraInputs] = useState([''])
  const [extraSug, setExtraSug] = useState({})
  const [open, setOpen] = useState(true)
  const socket = useSocket(idReuniao)

  const load = async () => {
    const r = await authFetch(`/api/reuniao/${idReuniao}/presencas`).catch(()=>null)
    if (!r || r.ok === false) return
    const j = await r.json().catch(()=>[])
    setPresencas(Array.isArray(j) ? j : [])
  }
  const loadMembros = async () => {
    const r = await authFetch(`/api/reuniao/${idReuniao}`).catch(()=>null)
    if (!r || r.ok === false) return
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
          // efetivo tem prioridade sobre substituto
          const cur = seen.get(mat)
          const isEfet = (v)=> /efetivo|presidente|vice/i.test(v||'')
          if (isEfet(p.ocupacao) && !isEfet(cur.ocupacao)) seen.set(mat, p)
        }
      })
    }
    setMembros([...seen.values()])
    const pr = await authFetch(`/api/legis/parlamentares-ativos`).catch(()=>null)
    if (pr) {
      const arr = await pr.json().catch(()=>[])
      const map = {}
      arr.forEach(p=>{ map[normalizeName(p.nome)] = p.partido || '' })
      setPartyPortal(map)
    }
  }
  const reloadTimer = useRef(null)
  const on = () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(()=>load(), 150)
  }
  useEffect(()=>{ load(); loadMembros() }, [idReuniao])
  useEffect(()=>{
    if(!socket) return
    socket.on('presence_pending', on)
    socket.on('presence_confirmed', on)
    return ()=>{ if (reloadTimer.current) clearTimeout(reloadTimer.current); socket.off('presence_pending', on); socket.off('presence_confirmed', on) }
  }, [socket])

  const confirm = async (pid) => {
    await authFetch(`/api/reuniao/${idReuniao}/presenca/${pid}/confirmar`, {method:'POST'})
    load()
  }
  const doDelete = async (pid) => {
    await authFetch(`/api/reuniao/${idReuniao}/presenca/${pid}`, {method:'DELETE'})
    setConfirmDelete(null)
    load()
  }
  const doClearAll = async () => {
    await authFetch(`/api/reuniao/${idReuniao}/presencas`, {method:'DELETE'})
    setConfirmClearAll(false)
    load()
  }
  const marcarPresente = async (nome) => {
    if (!nome.trim()) return
    await authFetch(`/api/reuniao/${idReuniao}/presenca`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: nome.trim(), profile:'deputado', manual:true })})
    load()
  }

  const presByKey = useMemo(()=>{
    const m = new Map()
    presencas.forEach(p=>m.set(normalizeName(p.name), p))
    return m
  }, [presencas])

  const efetivos = membros.filter(p=> !/substituto/i.test(p.ocupacao||''))
  const substitutos = membros.filter(p=> /substituto/i.test(p.ocupacao||''))

  const extraNotInMembros = presencas.filter(p=>{
    const key = normalizeName(p.name)
    const inMembros = membros.some(m=>normalizeName(m.parlamentar)===key)
    return !inMembros
  })

  const partiLabel = (p) => {
    const f = p.federacao || p.partido || ''
    return f ? ` (${f})` : ''
  }

  const row = (p) => {
    const pres = presByKey.get(normalizeName(p.parlamentar))
    const display = formatName(p.parlamentar)
    const fCls = nameCls(display)
    let cls, label, action
    if (!pres) { cls='bg-white';
      return (
        <button key={p.nuMatriculaParlamentar||p.parlamentar} onClick={()=>marcarPresente(p.parlamentar)} className={`w-full text-left border rounded px-2 py-1 min-h-7 ${fCls} font-normal text-slate-800 ${cls} hover:bg-slate-50`}><span>{display}</span><span className="text-slate-500">{partiLabel(p)}</span></button>
      )
    }
    if (pres.origem==='login' && !pres.confirmed) cls='bg-yellow-100 border-yellow-300'
    else if (pres.origem==='login' && pres.confirmed) cls='bg-green-200 border-green-400'
    else cls='bg-blue-100 border-blue-300' // manual confirmado
    return (
      <div key={p.nuMatriculaParlamentar||p.parlamentar} className={`flex items-start justify-between gap-1 border rounded px-2 py-1 ${fCls} font-normal ${cls}`}>
        <span className="flex-1 min-w-0 break-words"><span>{display}</span><span className="text-slate-600">{partiLabel(p)}</span> {pres.origem==='login' && pres.confirmed ? '✓' : ''}</span>
        <span className="flex items-center gap-1 shrink-0">
          {pres.origem==='login' && !pres.confirmed && <button onClick={()=>confirm(pres.id)} className="bg-alesp text-white rounded px-2 h-5 text-xs font-normal">Confirmar</button>}
          <button onClick={()=>setConfirmDelete(pres)} className="bg-red-600 text-white rounded w-5 h-5 text-xs font-normal" title="Excluir" aria-label={`Excluir ${p.parlamentar}`}>×</button>
        </span>
      </div>
    )
  }

  const searchExtra = async (idx, q) => {
    if (q.trim().length<2) { setExtraSug({}); return }
    const r = await authFetch(`/api/legis/parlamentares-ativos?q=${encodeURIComponent(q)}`).catch(()=>null)
    if (!r) return
    const j = await r.json().catch(()=>[])
    setExtraSug(s=>({...s, [idx]: j.slice(0,8)}))
  }

  return (
    <div className="bg-white border rounded-xl p-3 sticky top-2 z-10 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <button onClick={()=>setOpen(o=>!o)} className="font-extrabold text-alesp text-sm flex items-center gap-1">Presentes <span className="text-xs">{open?'▼':'▶'}</span></button>
        <button onClick={()=>setConfirmClearAll(true)} className="bg-slate-700 text-white rounded px-2 py-0.5 text-xs font-bold">Limpar presenças</button>
      </div>
      {open && (
      <>
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
      {extraNotInMembros.length>0 && (
        <>
          <div className="text-[11px] font-bold text-slate-500 uppercase mt-2 mb-0.5">Outros presentes (não-membros)</div>
          <div className="grid gap-0.5">{extraNotInMembros.map(p=>{
            const cls = p.origem==='login' && !p.confirmed ? 'bg-yellow-100 border-yellow-300' : (p.origem==='login' && p.confirmed ? 'bg-green-200 border-green-400' : 'bg-blue-100 border-blue-300')
            const disp = formatName(p.name)
            const part = partyPortal[normalizeName(p.name)] || ''
            return (
              <div key={p.id} className={`flex items-start justify-between gap-1 border rounded px-2 py-1 text-xs font-normal ${cls}`}>
                <span className="flex-1 min-w-0 break-words"><span className={nameCls(disp)}>{disp}</span>{part?` (${part})`:''}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {p.origem==='login' && !p.confirmed && <button onClick={()=>confirm(p.id)} className="bg-alesp text-white rounded px-2 h-5 text-xs">Confirmar</button>}
                  <button onClick={()=>setConfirmDelete(p)} className="bg-red-600 text-white rounded w-5 h-5 text-xs">×</button>
                </span>
              </div>
            )
          })}</div>
        </>
      )}
      <div className="mt-2">
        <div className="text-[11px] font-bold text-slate-500 uppercase mb-0.5">Outro deputado (94 ativos)</div>
        {extraInputs.map((val, idx)=>(
          <div key={idx} className="relative mb-1 flex gap-1">
            <div className="relative flex-1">
              <input value={val} onChange={e=>{ const v=e.target.value; setExtraInputs(s=>s.map((x,i)=>i===idx?v:x)); searchExtra(idx,v) }} placeholder="Buscar parlamentar…" className="w-full border rounded px-2 py-1 text-xs" autoComplete="off" />
              {extraSug[idx]?.length>0 && (
                <div className="absolute z-10 left-0 right-0 bg-white border rounded mt-1 shadow max-h-40 overflow-auto">
                  {extraSug[idx].map(s=>(
                    <button key={s.matricula} onClick={()=>{ setExtraInputs(s2=>s2.map((x,i)=>i===idx?s.nome:x)); setExtraSug({}) }} className="w-full text-left px-2 py-1 hover:bg-slate-100 text-sm">{s.nome}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={async ()=>{ await marcarPresente(val); setExtraInputs(s=>[...s.slice(0,idx), ...s.slice(idx+1), '']); setExtraSug({}) }} className="bg-alesp text-white rounded px-2 text-xs font-bold">Incluir</button>
          </div>
        ))}
      </div>
      </>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <div className="font-bold mb-2">Excluir presença?</div>
            <div className="text-sm text-slate-600 mb-4">Excluir "{confirmDelete.name}" dos presentes?</div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setConfirmDelete(null)} className="bg-slate-100 rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={()=>doDelete(confirmDelete.id)} className="bg-red-600 text-white rounded px-4 py-2 text-sm font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}
      {confirmClearAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <div className="font-bold mb-2">Limpar todas as presenças?</div>
            <div className="text-sm text-slate-600 mb-4">Isso remove todos os presentes desta reunião.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setConfirmClearAll(false)} className="bg-slate-100 rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={doClearAll} className="bg-red-600 text-white rounded px-4 py-2 text-sm font-bold">Limpar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
