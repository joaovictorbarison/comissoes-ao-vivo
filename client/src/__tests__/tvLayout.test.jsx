import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { Layout } from '../App.jsx'

const { toDataURL } = vi.hoisted(() => ({ toDataURL: vi.fn(async () => 'data:image/png;base64,QR') }))
vi.mock('qrcode', () => ({ default: { toDataURL }, toDataURL }))
vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

test('TV is full-screen, has no app header and keeps the QR with a long ementa', async () => {
  vi.stubGlobal('fetch', async (url) => {
    const u = String(url)
    if (u.includes('/vistas')) return { json: async () => ({}) }
    if (u.includes('/bloco')) return { json: async () => ({ ativo: false }) }
    return { json: async () => ({ iniciada: true, items: [{ id:'1', nuOrdem:1, status_oficial:'em_votacao', processoDadosView:{ txDescricao:'PL 197/2019', txEmenta:'Ementa muito longa '.repeat(80), txNomeAutores:'Autor' } }] }) }
  })
  render(<MemoryRouter initialEntries={['/tv/1000007671']}><AuthProvider><Layout /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText(/PL 197\/2019/)).toBeTruthy()
  expect(screen.queryByText(/Comissões Ao Vivo/i)).toBeFalsy()
  expect(screen.queryByRole('link', { name: /Reuniões/i })).toBeFalsy()
  const shell = screen.getByTestId('tv-shell')
  expect(shell.className).toMatch(/h-screen/)
  expect(shell.className).toMatch(/bg-black/)
  const img = await screen.findByRole('img', { name: /QR code/i })
  expect(img.parentElement.className).not.toMatch(/\bfixed\b/)
  expect(img.parentElement.className).toMatch(/items-center/)
  vi.unstubAllGlobals()
})
