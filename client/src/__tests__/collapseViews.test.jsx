import { render, screen, fireEvent } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import PautaAssessor from '../components/PautaAssessor.jsx'
import Acompanhamento from '../components/Acompanhamento.jsx'

vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))
vi.mock('../components/AssessoresTab.jsx', () => ({ default: () => null }))
vi.mock('../components/PresencasPublicas.jsx', () => ({ default: () => null }))

const items = [
  { id:'t1', nuOrdem:1, status_oficial:'aprovado_relator', processoDadosView:{ txDescricao:'PL 1/2026', txEmenta:'Ementa Aprovada', txNomeAutores:'Autor A' }, documentosVoto:[] },
  { id:'v1', nuOrdem:2, status_oficial:'em_votacao', processoDadosView:{ txDescricao:'PL 2/2026', txEmenta:'Ementa Votacao', txNomeAutores:'Autor B' }, documentosVoto:[] },
  { id:'n1', nuOrdem:3, status_oficial:'nao_deliberado', processoDadosView:{ txDescricao:'PL 3/2026', txEmenta:'Ementa Nao Deliberada', txNomeAutores:'Autor C' }, documentosVoto:[] }
]
function stubFetch() {
  vi.stubGlobal('fetch', async (url) => {
    const u = String(url)
    if (u.includes('/vistas')) return { json: async () => ({}) }
    if (u.includes('/anotacoes')) return { json: async () => [] }
    if (u.includes('/api/reuniao/')) return { json: async () => ({ items }) }
    return { json: async () => [] }
  })
}

test('deputy view collapses terminal item, keeps voting and nao_deliberado open, toggles back', async () => {
  stubFetch()
  sessionStorage.setItem('c2_profile','deputado'); sessionStorage.setItem('c2_name','Gil')
  render(<MemoryRouter initialEntries={['/reuniao/1']}><AuthProvider><Routes><Route path="/reuniao/:id" element={<PautaAssessor />} /></Routes></AuthProvider></MemoryRouter>)
  expect(await screen.findByText('Ementa Votacao')).toBeTruthy()
  expect(screen.getByText('Ementa Nao Deliberada')).toBeTruthy()
  expect(screen.queryByText('Ementa Aprovada')).toBeFalsy()
  fireEvent.click(screen.getByRole('button', { name: /Expandir item 1/ }))
  expect(await screen.findByText('Ementa Aprovada')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Recolher item 1/ }))
  expect(screen.queryByText('Ementa Aprovada')).toBeFalsy()
  sessionStorage.clear(); vi.unstubAllGlobals()
})

test('anonymous view collapses terminal item and keeps voting open', async () => {
  stubFetch()
  render(<MemoryRouter initialEntries={['/reuniao/1']}><Routes><Route path="/reuniao/:id" element={<Acompanhamento />} /></Routes></MemoryRouter>)
  expect(await screen.findByText('Ementa Votacao')).toBeTruthy()
  expect(screen.queryByText('Ementa Aprovada')).toBeFalsy()
  fireEvent.click(screen.getByRole('button', { name: /Expandir item 1/ }))
  expect(await screen.findByText('Ementa Aprovada')).toBeTruthy()
  vi.unstubAllGlobals()
})
