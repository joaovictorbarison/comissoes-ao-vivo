import React from 'react'
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
  const { profile } = useAuth()
  const subtitle = {
    secretario: 'Comissões Ao Vivo - Painel do Secretário',
    deputado: 'Comissões Ao Vivo - Painel do Parlamentar',
    assessor: 'Comissões Ao Vivo - Painel de Assessoria'
  }[profile] || 'Comissões Ao Vivo'
  return (
    <header className="bg-alesp text-white px-4 py-3 flex items-center gap-3">
      <div className="bg-white text-alesp w-9 h-9 rounded flex items-center justify-center font-extrabold">AL</div>
      <div>
        <div className="text-xs opacity-80">{subtitle}</div>
        <div className="text-xs opacity-70">Assembleia Legislativa do Estado de São Paulo</div>
      </div>
      <nav className="ml-auto flex gap-4 text-sm">
        <Link to="/reunioes" className="underline">Reuniões</Link>
        <Link to="/identificacao" className="underline">Identificação</Link>
      </nav>
    </header>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <Header />
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
