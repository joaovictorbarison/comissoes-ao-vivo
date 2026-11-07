import { test, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { initDb } = require('../db.js')

test('schema creates all 6 tables keyed by meeting', () => {
  const db = initDb(':memory:')
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name)
  expect(tables).toContain('sessions')
  expect(tables).toContain('agenda_items')
  expect(tables).toContain('official_status')
  expect(tables).toContain('presencas')
  expect(tables).toContain('anotacoes_privadas')
  expect(tables).toContain('relatorio_final')
  db.close()
})
