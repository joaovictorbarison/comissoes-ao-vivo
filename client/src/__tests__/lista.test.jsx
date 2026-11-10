import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ListaReunioes from '../components/ListaReunioes.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'

test('renders convocada meeting 1000007671', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ content: [
    { idReuniao:1000007671, nuReuniao:1, tituloReuniao:'Reunião de Pauta', txAssunto:'pauta anexa', dtReuniao:'2026-11-10T15:30', tipoConvocacao:'Ordinária', status:{txNome:'Convocada'}, local:{txNome:'Plenário José Bonifácio'}, colegiadosRelacionados:[{sigla:'CDD', nome:'Comissão CDD Teste'}], documentosReuniao:[{idDocumento:1, descricao:'Pauta de colegiado nº 2/2026', tipo:'Pauta de colegiado', linkArquivoPDF:'#'}] }
  ]})}))
  render(<MemoryRouter><AuthProvider><ListaReunioes /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText(/José Bonifácio/)).toBeTruthy()
  expect(screen.getByText(/1ª Ordinária/i)).toBeTruthy()
  expect(screen.getByText(/10\/11\/2026/)).toBeTruthy()
  expect(screen.queryByText(/^Comunicado$/i)).toBeFalsy()
  expect(screen.getByText(/^Pauta$/i)).toBeTruthy()
  expect(screen.getByText(/Ir para reunião/i)).toBeTruthy()
  expect(screen.queryByText(/Convocada/i)).toBeFalsy()
  expect(screen.getByText(/CDD — Comissão CDD Teste/)).toBeTruthy()
  vi.unstubAllGlobals()
})
