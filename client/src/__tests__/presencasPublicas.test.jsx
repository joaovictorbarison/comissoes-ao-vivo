import { render, screen, fireEvent } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import PresencasPublicas from '../components/PresencasPublicas.jsx'

vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

function stub() {
  vi.stubGlobal('fetch', async (url) => {
    const u = String(url)
    if (u.includes('/presencas')) return { json: async () => [
      { id:1, name:'Gil Diniz', profile:'deputado', confirmed:true, origem:'login' },
      { id:2, name:'Maria Souza', profile:'deputado', confirmed:false, origem:'login' },
      { id:3, name:'Outro Parlamentar', profile:'deputado', confirmed:true, origem:'manual' }
    ] }
    if (u.includes('/colegiados/')) return { json: async () => [
      { parlamentar:'Gil Diniz', ocupacao:'Efetivo', federacao:'PA' },
      { parlamentar:'Maria Souza', ocupacao:'Efetivo', federacao:'PB' },
      { parlamentar:'Joao Sub', ocupacao:'Substituto', federacao:'PC' }
    ] }
    if (u.includes('/parlamentares-ativos')) return { json: async () => [{ nome:'Outro Parlamentar', partido:'PD' }] }
    if (u.includes('/api/reuniao/')) return { json: async () => ({ colegiadosRelacionados:[{ id:'c1', sigla:'CDD', nome:'Comissão X' }] }) }
    return { json: async () => [] }
  })
}

test('shows roster with party, marks confirmed present, lists other present parliamentarians, no write actions', async () => {
  stub()
  render(<PresencasPublicas idReuniao="1" />)
  expect(await screen.findByText(/Gil Diniz/)).toBeTruthy()
  expect(screen.getByText(/Maria Souza/)).toBeTruthy()
  expect(screen.getByText(/Joao Sub/)).toBeTruthy()
  expect(screen.getByText(/Outro Parlamentar/)).toBeTruthy()
  expect(screen.getByText(/Efetivos/)).toBeTruthy()
  expect(screen.getByText(/Substitutos/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Confirmar/ })).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Excluir/ })).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Incluir/ })).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Limpar/ })).toBeFalsy()
  vi.unstubAllGlobals()
})

test('panel collapses and expands', async () => {
  stub()
  render(<PresencasPublicas idReuniao="1" />)
  expect(await screen.findByText(/Gil Diniz/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Presenças/ }))
  expect(screen.queryByText(/Gil Diniz/)).toBeFalsy()
  fireEvent.click(screen.getByRole('button', { name: /Presenças/ }))
  expect(await screen.findByText(/Gil Diniz/)).toBeTruthy()
  vi.unstubAllGlobals()
})

test('empty roster still renders other present parliamentarians without crashing', async () => {
  vi.stubGlobal('fetch', async (url) => {
    const u = String(url)
    if (u.includes('/presencas')) return { json: async () => [{ id:3, name:'Outro Parlamentar', confirmed:true, origem:'manual' }] }
    if (u.includes('/parlamentares-ativos')) return { json: async () => [{ nome:'Outro Parlamentar', partido:'PD' }] }
    if (u.includes('/api/reuniao/')) return { json: async () => ({ colegiadosRelacionados:[] }) }
    return { json: async () => [] }
  })
  render(<PresencasPublicas idReuniao="1" />)
  expect(await screen.findByText(/Outro Parlamentar/)).toBeTruthy()
  vi.unstubAllGlobals()
})
