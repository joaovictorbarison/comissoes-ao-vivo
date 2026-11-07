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
