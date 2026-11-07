import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PautaAssessor from '../components/PautaAssessor.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'

test('item 1 PL 197/2019 shows banner and private note input', async () => {
  vi.stubGlobal('fetch', async (url) => {
    if (String(url).includes('/anotacoes')) return { json: async () => [] }
    if (String(url).includes('/api/reuniao/')) return { json: async () => ({ items: [{ id:'50000000397500', nuOrdem:1, status_oficial:'em_votacao', processoDadosView:{txDescricao:'PL 197/2019', txEmenta:'Institui o Programa Agente Cidadão Sênior.', txNomeAutores:'Thiago Auricchio'}, documentosVoto:[{autores:'Gil Diniz Bolsonaro', conclusao:'favorável'}] }], active_item_id:null }) }
    return { json: async () => [] }
  })
  // mock socket hook
  vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on:(e,fn)=>{}, off:()=>{} }) }))
  render(<MemoryRouter initialEntries={['/reuniao/1000007671']}><AuthProvider><Routes><Route path="/reuniao/:id" element={<PautaAssessor />} /></Routes></AuthProvider></MemoryRouter>)
  expect(await screen.findByText(/PL 197\/2019/)).toBeTruthy()
  expect(screen.getByText(/EM VOTAÇÃO/)).toBeTruthy()
  expect(screen.getByPlaceholderText(/orientação/i)).toBeTruthy()
  vi.unstubAllGlobals()
})
