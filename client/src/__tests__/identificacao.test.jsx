import { render, screen, fireEvent } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Identificacao from '../components/Identificacao.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'

test('secretario without password is blocked', () => {
  render(<MemoryRouter><AuthProvider><Identificacao /></AuthProvider></MemoryRouter>)
  expect(screen.getByText(/Quem é você/i)).toBeTruthy()
  expect(screen.queryByText(/Continuar/i)).toBeTruthy()
})

test('anonymous button sets anonimo profile and navigates to meetings', async () => {
  render(
    <MemoryRouter initialEntries={['/identificacao']}>
      <AuthProvider>
        <Routes>
          <Route path="/identificacao" element={<Identificacao />} />
          <Route path="/reunioes" element={<div>Lista de reuniões</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole('button', { name: /Acompanhar sem identificação/i }))
  expect(await screen.findByText('Lista de reuniões')).toBeTruthy()
  expect(sessionStorage.getItem('c2_profile')).toBe('anonimo')
  sessionStorage.clear()
})
