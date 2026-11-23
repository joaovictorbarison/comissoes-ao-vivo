import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Acompanhamento from '../components/Acompanhamento.jsx'

vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

test('anonymous accompaniment shows meeting info, items and public report, without private notes', async () => {
  vi.stubGlobal('fetch', async (url) => {
    if (String(url).includes('/vistas')) return { json: async () => ({}) }
    return { json: async () => ({
      tituloReuniao: '1ª Reunião Ordinária',
      dtReuniao: '2026-11-10T15:30',
      local: { txNome: 'Plenário José Bonifácio' },
      colegiadosRelacionados: [{ sigla: 'CDD', nome: 'Comissão de Defesa dos Direitos da Pessoa Humana' }],
      items: [{ id:'1', nuOrdem:1, status_oficial:'em_votacao', processoDadosView:{ txDescricao:'PL 197/2019', txEmenta:'Institui o Programa Agente Cidadão Sênior.', txNomeAutores:'Thiago Auricchio' }, documentosVoto:[{ autores:'Gil Diniz Bolsonaro', conclusao:'favorável' }] }]
    }) }
  })
  render(<MemoryRouter initialEntries={['/reuniao/1000007671']}><Routes><Route path="/reuniao/:id" element={<Acompanhamento />} /></Routes></MemoryRouter>)
  expect(await screen.findByText(/PL 197\/2019/)).toBeTruthy()
  expect(screen.getByText(/CDD/)).toBeTruthy()
  expect(screen.getByText(/1ª Reunião Ordinária/)).toBeTruthy()
  expect(screen.getByText(/Plenário José Bonifácio/)).toBeTruthy()
  expect(screen.getByText(/EM VOTAÇÃO/)).toBeTruthy()
  const report = screen.getByRole('link', { name: /Baixar relatório/i })
  expect(report.getAttribute('href')).toBe('/api/reuniao/1000007671/relatorio-publico.pdf')
  expect(screen.queryByText(/Orientação da assessoria/i)).toBeFalsy()
  expect(screen.queryByPlaceholderText(/orientação/i)).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Aceitar/i })).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Recusar/i })).toBeFalsy()
  vi.unstubAllGlobals()
})
