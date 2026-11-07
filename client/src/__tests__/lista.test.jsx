import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import ListaReunioes from '../components/ListaReunioes.jsx'

test('renders convocada meeting 1000007671', async () => {
  vi.stubGlobal('fetch', async () => ({ json: async () => ({ content: [
    { idReuniao:1000007671, nuReuniao:1, tituloReuniao:'Reunião de Pauta', txAssunto:'pauta anexa', dtReuniao:'2026-11-10T15:30', tipoConvocacao:'Ordinária', status:{txNome:'Convocada'}, local:{txNome:'Plenário José Bonifácio'}, documentosReuniao:[{idDocumento:1, descricao:'Pauta', linkArquivoPDF:'#'}] }
  ]})}))
  render(<ListaReunioes />)
  expect(await screen.findByText(/José Bonifácio/)).toBeTruthy()
  vi.unstubAllGlobals()
})
