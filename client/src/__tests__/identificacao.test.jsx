import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Identificacao from '../components/Identificacao.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'

test('secretario without password is blocked', () => {
  render(<MemoryRouter><AuthProvider><Identificacao /></AuthProvider></MemoryRouter>)
  expect(screen.getByText(/Quem é você/i)).toBeTruthy()
  expect(screen.queryByText(/Continuar/i)).toBeTruthy()
})
