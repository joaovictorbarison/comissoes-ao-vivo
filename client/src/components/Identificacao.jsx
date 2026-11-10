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
  const [sugNome, setSugNome] = useState([])
  const [sugDep, setSugDep] = useState([])
  const [showSugNome, setShowSugNome] = useState(false)
  const [showSugDep, setShowSugDep] = useState(false)

  // type-ahead de parlamentares ativos (API Legis) — para deputado e para assessor escolher deputado
  const fetchSug = async (q, setter) => {
    if (q.trim().length < 2) { setter([]); return }
    const r = await fetch(`/api/legis/parlamentares-ativos?q=${encodeURIComponent(q)}`).catch(()=>null)
    if (!r) return
    const j = await r.json().catch(()=>[])
    setter(Array.isArray(j) ? j.slice(0,8) : [])
  }
  useEffect(()=>{
    if (profile !== 'deputado') return
    const t = setTimeout(()=>fetchSug(name, setSugNome), 300)
    return ()=>clearTimeout(t)
  }, [name, profile])
  useEffect(()=>{
    if (profile !== 'assessor') return
    const t = setTimeout(()=>fetchSug(deputado, setSugDep), 300)
    return ()=>clearTimeout(t)
  }, [deputado, profile])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Informe o nome.'); return }
    if (profile === 'assessor' && !deputado.trim()) { setError('Informe o deputado que você assessora.'); return }
    let token = null
    if (profile === 'secretario') {
      let res
      try {
        res = await fetch('/api/auth/secretario', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: password.trim(), name: name.trim()}) })
      } catch {
        setError('Erro de conexão com o servidor. Verifique sua internet e tente novamente.'); return
      }
      if (res.status === 401) { setError('Senha incorreta para secretário.'); return }
      if (!res.ok) { setError('Erro no servidor. Tente novamente em instantes.'); return }
      const j = await res.json().catch(()=>({}))
      token = j.token
    } else {
      const res = await fetch('/api/auth/identificar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({profile, name: name.trim(), deputadoVinculado: profile==='assessor' ? deputado.trim() : null}) })
      if (!res.ok) { setError('Erro no servidor. Tente novamente em instantes.'); return }
      const j = await res.json().catch(()=>({}))
      token = j.token
    }
    setAuth(profile, name.trim(), profile==='assessor' ? deputado.trim() : null, token)
    navigate('/reunioes')
  }

  const sugBox = (sug, show, setVal, hide) => show && sug.length>0 && (
    <div className="absolute z-10 left-0 right-0 bg-white border rounded-lg mt-1 shadow max-h-52 overflow-auto">
      {sug.map(s=>(
        <button type="button" key={s.matricula||s.nome} onClick={()=>{ setVal(s.nome); hide() }} className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm">{s.nome}</button>
      ))}
    </div>
  )

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
      <div className="relative mb-4">
        <input value={name} onChange={e=>{ setName(e.target.value); setShowSugNome(true) }} onFocus={()=>setShowSugNome(true)} placeholder="Ex.: Maria Silva" className="w-full border rounded-lg p-3" autoComplete="off" />
        {sugBox(sugNome, showSugNome && profile==='deputado', setName, ()=>setShowSugNome(false))}
      </div>
      {profile==='assessor' && (<>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Deputado(a) que você assessora</label>
        <div className="relative mb-4">
          <input value={deputado} onChange={e=>{ setDeputado(e.target.value); setShowSugDep(true) }} onFocus={()=>setShowSugDep(true)} placeholder="Digite para buscar parlamentares ativos…" className="w-full border rounded-lg p-3" autoComplete="off" />
          {sugBox(sugDep, showSugDep, setDeputado, ()=>setShowSugDep(false))}
        </div>
      </>)}
      {profile==='secretario' && (<>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Senha do secretário</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border rounded-lg p-3 mb-4" autoComplete="current-password" spellCheck={false} autoCapitalize="none" autoCorrect="off" />
      </>)}
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      <button type="submit" className="w-full bg-alesp text-white rounded-lg p-3 font-bold">Continuar</button>
    </form>
  )
}
