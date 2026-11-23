import { test, expect } from 'vitest'
import { TERMINAL_FINAL, STATUS_SHORT, isTerminalStatus } from '../lib/itemCollapse.js'

test('terminal set matches the secretary and excludes nao_deliberado/aprovado_separado', () => {
  expect(isTerminalStatus('aprovado_relator')).toBe(true)
  expect(isTerminalStatus('rejeitado_nominal')).toBe(true)
  expect(isTerminalStatus('vista')).toBe(true)
  expect(isTerminalStatus('retirado')).toBe(true)
  expect(isTerminalStatus('nao_deliberado')).toBe(false)
  expect(isTerminalStatus('aprovado_separado')).toBe(false)
  expect(isTerminalStatus('em_votacao')).toBe(false)
  expect(isTerminalStatus('pendente')).toBe(false)
  expect(STATUS_SHORT.aprovado_simbolico).toBe('Aprovado')
  expect(STATUS_SHORT.vista).toBe('Vista')
  expect(TERMINAL_FINAL).toHaveLength(8)
})
