import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TvDisplay from '../components/TvDisplay.jsx'

const { toDataURL } = vi.hoisted(() => ({ toDataURL: vi.fn(async () => 'data:image/png;base64,QR') }))
vi.mock('qrcode', () => ({ default: { toDataURL }, toDataURL }))
vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

test('TV QR points to the meeting accompaniment page', async () => {
  vi.stubGlobal('fetch', async () => ({ json: async () => ({ items: [], active_item_id: null }) }))
  render(<MemoryRouter initialEntries={['/tv/1000007671']}><Routes><Route path="/tv/:id" element={<TvDisplay />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('img', { name: /QR code/i })).toBeTruthy()
  expect(toDataURL).toHaveBeenCalledWith(expect.stringContaining('/reuniao/1000007671'), expect.anything())
  vi.unstubAllGlobals()
})
