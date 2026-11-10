import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import Identificacao from './components/Identificacao.jsx'
import ListaReunioes from './components/ListaReunioes.jsx'
import PautaAssessor from './components/PautaAssessor.jsx'
import PautaSecretario from './components/PautaSecretario.jsx'
import TvDisplay from './components/TvDisplay.jsx'
import { useAuth } from './context/AuthContext.jsx'

function PautaRouter() {
  const { profile } = useAuth()
  if (profile === 'secretario') return <PautaSecretario />
  return <PautaAssessor />
}

function Header() {
  const { profile, name, deputadoVinculado } = useAuth()
  const [showVinculo, setShowVinculo] = useState(false)
  const [dep, setDep] = useState('')
  const [sug, setSug] = useState([])
  const base = {
    secretario: 'Comissões Ao Vivo - Painel do Secretário',
    deputado: 'Comissões Ao Vivo - Painel do Parlamentar',
    assessor: 'Comissões Ao Vivo - Painel de Assessoria'
  }[profile] || 'Comissões Ao Vivo'
  const subtitle = (profile==='deputado' || profile==='assessor') && name ? `${base} - ${name}` : base

  useEffect(()=>{
    if (!showVinculo || dep.trim().length<2) { setSug([]); return }
    const t = setTimeout(async ()=>{
      const r = await authFetch(`/api/legis/parlamentares-ativos?q=${encodeURIComponent(dep)}`).catch(()=>null)
      if (r) setSug((await r.json().catch(()=>[])).slice(0,8))
    }, 300)
    return ()=>clearTimeout(t)
  }, [dep, showVinculo])

  const pedir = async () => {
    if (!dep.trim()) return
    // precisa de uma reunião de referência para a rota antiga; usa global
    await authFetch(`/api/vinculos`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ assessorName: name, deputadoName: dep }) }).catch(()=>{})
    setShowVinculo(false)
    setDep('')
  }

  return (
    <>
      <header className="bg-alesp text-white px-4 py-3 flex items-center gap-3">
        <div className="bg-white text-alesp w-9 h-9 rounded flex items-center justify-center font-extrabold">AL</div>
        <div>
          <div className="text-xs opacity-80">{subtitle}</div>
          <div className="text-xs opacity-70">Assembleia Legislativa do Estado de São Paulo</div>
        </div>
        <nav className="ml-auto flex gap-4 text-sm">
          <Link to="/reunioes" className="underline">Reuniões</Link>
          <Link to="/identificacao" className="underline">Identificação</Link>
          {profile==='assessor' && <button onClick={()=>setShowVinculo(true)} className="underline">Solicitar vínculo</button>}
        </nav>
      </header>
      {showVinculo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <div className="font-bold mb-2">Solicitar vínculo com parlamentar</div>
            <div className="relative mb-4">
              <input value={dep} onChange={e=>setDep(e.target.value)} placeholder="Digite o nome do parlamentar…" className="w-full border rounded-lg p-3" autoComplete="off" autoFocus />
              {sug.length>0 && (
                <div className="absolute z-10 left-0 right-0 bg-white border rounded-lg mt-1 shadow max-h-52 overflow-auto">
                  {sug.map(s=>(
                    <button key={s.matricula||s.nome} onClick={()=>setDep(s.nome)} className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm">{s.nome}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-slate-500 mb-3">Você está logado como {name}. O pedido aparecerá para o parlamentar aceitar.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setShowVinculo(false)} className="bg-slate-100 rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={pedir} className="bg-alesp text-white rounded px-4 py-2 text-sm font-bold">Solicitar vínculo</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function VinculoBar() {
  const { profile, cabinetKey, deputadoVinculado, name, authFetch } = useAuth()
  const [pendentes, setPendentes] = useState([])
  const [aceitos, setAceitos] = useState([])
  const load = async () => {
    if (profile !== 'deputado') return
    const r = await authFetch(`/api/vinculos?deputadoKey=${encodeURIComponent(cabinetKey||'')}`)
    const j = await r.json().catch(()=>[])
    setPendentes(j.filter(v=>v.status==='pendente'))
    setAceitos(j.filter(v=>v.status==='aceito'))
  }
  useEffect(()=>{ load(); const t = setInterval(load, 5000); return ()=>clearInterval(t) }, [profile, cabinetKey])

  const accept = async (v) => {
    await authFetch(`/api/reuniao/${v.id_reuniao || 1}/vinculo/${v.id}/aceitar`, { method:'POST' })
    load()
  }
  const refuse = async (v) => {
    await authFetch(`/api/reuniao/${v.id_reuniao || 1}/vinculo/${v.id}/recusar`, { method:'POST' })
    load()
  }

  if (!profile || profile==='secretario') return null
  if (profile==='assessor') {
    return <div className="bg-blue-50 border-b text-xs px-4 py-2 text-center text-slate-700">Vínculo: <b>{name}</b> → Deputado <b>{deputadoVinculado || '—'}</b></div>
  }
  if (profile==='deputado') {
    return (
      <div>
        {aceitos.length>0 && <div className="bg-green-50 border-b text-xs px-4 py-2 text-center text-slate-700">Assessores vinculados: <b>{aceitos.map(a=>a.assessor_name).join(', ')}</b></div>}
        {pendentes.length>0 && (
          <div className="bg-amber-50 border-b px-4 py-2">
            <div className="text-xs font-bold mb-1 text-center">Pedido(s) de vínculo de assessor:</div>
            {pendentes.map(v=>(
              <div key={v.id} className="flex items-center gap-2 text-xs justify-center py-1 flex-wrap">
                <span>{v.assessor_name} quer te assessorar</span>
                <button onClick={()=>accept(v)} className="bg-green-600 text-white rounded px-3 py-1 font-bold">Aceitar</button>
                <button onClick={()=>refuse(v)} className="bg-red-600 text-white rounded px-3 py-1 font-bold">Recusar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <Header />
          <VinculoBar />
          <main className="max-w-5xl mx-auto p-4">
            <Routes>
              <Route path="/" element={<Identificacao />} />
              <Route path="/identificacao" element={<Identificacao />} />
              <Route path="/reunioes" element={<ListaReunioes />} />
              <Route path="/reuniao/:id" element={<PautaRouter />} />
              <Route path="/tv/:id" element={<TvDisplay />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
