import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { PautaRouter } from '../App.jsx'

vi.mock('../components/PautaSecretario.jsx', () => ({ default: () => <div>PainelSecretario</div> }))
vi.mock('../components/PautaAssessor.jsx', () => ({ default: () => <div>PainelAssessor</div> }))
vi.mock('../components/Acompanhamento.jsx', () => ({ default: () => <div>AcompanhamentoPublico</div> }))

function setup(profile) {
  if (profile) sessionStorage.setItem('c2_profile', profile)
  else sessionStorage.removeItem('c2_profile')
  render(<MemoryRouter initialEntries={['/reuniao/1000007671']}><AuthProvider><Routes><Route path="/reuniao/:id" element={<PautaRouter />} /></Routes></AuthProvider></MemoryRouter>)
}

test.each([
  ['secretario', 'PainelSecretario'],
  ['deputado', 'PainelAssessor'],
  ['assessor', 'PainelAssessor'],
  ['anonimo', 'AcompanhamentoPublico'],
  [null, 'AcompanhamentoPublico']
])('profile %s renders %s', (profile, expected) => {
  setup(profile)
  expect(screen.getByText(expected)).toBeTruthy()
  sessionStorage.clear()
})
