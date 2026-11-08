import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import TvDisplay from '../components/TvDisplay.jsx'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

test('tv shows active item readonly', async () => {
  vi.stubGlobal('fetch', async () => ({ json: async () => ({ items: [{ id:'1', nuOrdem:1, status_oficial:'em_votacao', processoDadosView:{txDescricao:'PL 197/2019', txEmenta:'Institui o Programa Agente Cidadão Sênior.'}}], active_item_id:'1' }) }))
  vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on:()=>{}, off:()=>{} }) }))
  render(<MemoryRouter initialEntries={['/tv/1000007671']}><Routes><Route path="/tv/:id" element={<TvDisplay />} /></Routes></MemoryRouter>)
  expect(await screen.findByText(/INSTITUI O PROGRAMA/i)).toBeTruthy()
  expect(screen.queryByRole('button', {name:/Aprovado/i})).toBeFalsy()
  vi.unstubAllGlobals()
})

test('TV shows APROVADO and result label for terminal item', async () => {
  const items = [
    { id:'1', nuOrdem:1, status_oficial:'aprovado_relator', processoDadosView:{txDescricao:'PL 1/2026', txEmenta:'Primeiro'}},
    { id:'2', nuOrdem:2, status_oficial:'pendente', processoDadosView:{txDescricao:'PL 2/2026', txEmenta:'Segundo'}}
  ]
  vi.stubGlobal('fetch', async (url) => {
    if (String(url).includes('/vistas')) return { json: async () => ({}) }
    return { json: async () => ({ items, active_item_id:null }) }
  })
  render(<MemoryRouter initialEntries={['/tv/1']}><Routes><Route path="/tv/:id" element={<TvDisplay />} /></Routes></MemoryRouter>)
  expect((await screen.findAllByText(/APROVADO/)).length).toBeGreaterThan(0)
  expect(screen.getByText(/PL 1\/2026/)).toBeTruthy()
  vi.unstubAllGlobals()
})
