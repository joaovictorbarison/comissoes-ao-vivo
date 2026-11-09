import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Identificacao() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState('assessor')
  const [name, setName] = useState('')
  const [deputado, setDeputado] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sugestoes, setSugestoes] = useState([])
  const [showSug, setShowSug] = useState(false)

  // type-ahead de parlamentares ativos (API Legis)
  useEffect(()=>{
    if (profile !== 'assessor') return
    const q = deputado.trim()
    if (q.length < 2) { setSugestoes([]); return }
    let alive = true
    const t = setTimeout(async ()=>{
      const r = await fetch(`/api/legis/parlamentares-ativos?q=${encodeURIComponent(q)}`).catch(()=>null)
      if (!r || !alive) return
      const j = await r.json().catch(()=>[])
      if (alive) setSugestoes(Array.isArray(j) ? j.slice(0,8) : [])
    }, 300)
    return ()=>{ alive=false; clearTimeout(t) }
  }, [deputado, profile])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Informe o nome.'); return }
    if (profile === 'assessor' && !deputado.trim()) { setError('Informe o deputado que você assessora.'); return }
    if (profile === 'secretario') {
      const res = await fetch('/api/auth/secretario', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password}) })
      if (!res.ok) { setError('Senha incorreta para secretário.'); return }
    }
    setAuth(profile, name.trim(), profile==='assessor' ? deputado.trim() : null)
    navigate('/reunioes')
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto bg-white border rounded-xl p-6">
      <h1 className="text-xl font-extrabold text-alesp mb-2">Quem é você?</h1>
      <p className="text-sm text-slate-600 mb-4">Esta escolha define o conjunto de telas seguintes.</p>
      <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Perfil</label>
      <select value={profile} onChange={e=>setProfile(e.target.value)} className="w-full border rounded-lg p-3 mb-4">
        <option value="secretario">Secretário(a) de Comissão</option>
        <option value="assessor">Assessor(a) Parlamentar</option>
        <option value="deputado">Deputado(a)</option>
      </select>
      <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Seu nome</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Maria Silva" className="w-full border rounded-lg p-3 mb-4" />
      {profile==='assessor' && (<>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Deputado(a) que você assessora</label>
        <div className="relative">
          <input value={deputado} onChange={e=>{ setDeputado(e.target.value); setShowSug(true) }} onFocus={()=>setShowSug(true)} placeholder="Digite para buscar parlamentares ativos…" className="w-full border rounded-lg p-3" autoComplete="off" />
          {showSug && sugestoes.length>0 && (
            <div className="absolute z-10 left-0 right-0 bg-white border rounded-lg mt-1 shadow max-h-52 overflow-auto">
              {sugestoes.map(s=>(
                <button type="button" key={s.matricula||s.nome} onClick={()=>{ setDeputado(s.nome); setShowSug(false) }} className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm">{s.nome}</button>
              ))}
            </div>
          )}
        </div>
        <div className="mb-4" />
      </>)}
      {profile==='secretario' && (<>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Senha do secretário</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border rounded-lg p-3 mb-4" />
      </>)}
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      <button type="submit" className="w-full bg-alesp text-white rounded-lg p-3 font-bold">Continuar</button>
    </form>
  )
}
