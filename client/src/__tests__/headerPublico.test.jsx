import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { Layout } from '../App.jsx'

vi.mock('../components/PautaSecretario.jsx', () => ({ default: () => <div>PainelSecretario</div> }))
vi.mock('../components/PautaAssessor.jsx', () => ({ default: () => <div>PainelAssessor</div> }))
vi.mock('../components/Acompanhamento.jsx', () => ({ default: () => <div>AcompanhamentoPublico</div> }))
vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

function setup(profile) {
  vi.stubGlobal('fetch', async () => ({ json: async () => [] }))
  if (profile) sessionStorage.setItem('c2_profile', profile)
  else sessionStorage.removeItem('c2_profile')
  render(<MemoryRouter initialEntries={['/reuniao/123']}><AuthProvider><Layout /></AuthProvider></MemoryRouter>)
}

test.each([['anonimo'], [null]])('public profile %s hides Ver TV and Identificação, keeps Reuniões', (profile) => {
  setup(profile)
  expect(screen.queryByText(/Ver TV/)).toBeFalsy()
  expect(screen.queryByRole('link', { name: /Identificação/ })).toBeFalsy()
  expect(screen.getByRole('link', { name: /Reuniões/ })).toBeTruthy()
  sessionStorage.clear(); vi.unstubAllGlobals()
})

test('deputy keeps Identificação and Ver TV', () => {
  setup('deputado')
  expect(screen.getByRole('link', { name: /Identificação/ })).toBeTruthy()
  expect(screen.getByText(/Ver TV/)).toBeTruthy()
  sessionStorage.clear(); vi.unstubAllGlobals()
})
