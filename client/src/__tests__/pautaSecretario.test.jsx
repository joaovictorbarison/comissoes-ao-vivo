import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import PautaSecretario from '../components/PautaSecretario.jsx'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

test('secretary can change status and sees pending presence', async () => {
  vi.stubGlobal('fetch', async (url) => {
    if (String(url).includes('/presencas')) return { json: async () => [] }
    if (String(url).includes('/vistas')) return { json: async () => ({}) }
    if (String(url).includes('/api/reuniao/')) return { json: async () => ({ items: [{ id:'1', nuOrdem:1, processoDadosView:{txDescricao:'PL 197/2019', txEmenta:'Institui', txNomeAutores:'Thiago'}, documentosVoto:[{autores:'Gil', conclusao:'favorável'}]}], active_item_id:null }) }
    return { json: async () => [] }
  })
  vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on:()=>{}, off:()=>{} }) }))
  render(<MemoryRouter initialEntries={['/reuniao/1']}><Routes><Route path="/reuniao/:id" element={<PautaSecretario />} /></Routes></MemoryRouter>)
  expect(await screen.findByText(/PL 197\/2019/)).toBeTruthy()
  expect(screen.getByRole('button', {name:/Em discussão/i})).toBeTruthy()
  expect(screen.getByText(/Presentes/i)).toBeTruthy()
  vi.unstubAllGlobals()
})

test('secretary header has hyphen and author/relator', async () => {
  vi.stubGlobal('fetch', async (url) => {
    if (String(url).includes('/presencas')) return { json: async () => [] }
    if (String(url).includes('/vistas')) return { json: async () => ({}) }
    if (String(url).includes('/api/reuniao/')) return { json: async () => ({ items: [{ id:'1', nuOrdem:1, processoDadosView:{txDescricao:'PL 197/2019', txEmenta:'Institui', txNomeAutores:'Thiago'}, documentosVoto:[{autores:'Gil', conclusao:'favorável'}]}], active_item_id:null }) }
    return { json: async () => [] }
  })
  render(<MemoryRouter initialEntries={['/reuniao/1']}><Routes><Route path="/reuniao/:id" element={<PautaSecretario />} /></Routes></MemoryRouter>)
  expect(await screen.findByText(/Item 1 - PL 197\/2019/)).toBeTruthy()
  expect(screen.getByText(/Autor:/)).toBeTruthy()
  expect(screen.getByText(/Relator:/)).toBeTruthy()
  expect(screen.queryByRole('button', {name:/voto em separado/i})).toBeNull()
  vi.unstubAllGlobals()
})
