import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
test('placeholder renders', () => {
  render(<div>Comissões Ao Vivo 2</div>)
  expect(screen.getByText('Comissões Ao Vivo 2')).toBeTruthy()
})
