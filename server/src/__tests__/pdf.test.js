import { test, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

test('pdf fallback contains %PDF header', async () => {
  const dbPath = `/tmp/test-pdf-${Date.now()}.db`
  process.env.DB_PATH = dbPath
  const { initDb } = require('../db.js')
  const db = initDb(dbPath)
  db.prepare('INSERT OR REPLACE INTO sessions (id_reuniao, titulo, tipo, dt, local, assunto, status, raw) VALUES (?,?,?,?,?,?,?,?)')
    .run('1000007671','Reunião de Pauta','Ordinária','2026-11-10T15:30','Plenário José Bonifácio','pauta anexa','Convocada', JSON.stringify({ nuReuniao:1, tipoConvocacao:'Ordinária', dtReuniao:'2026-11-10T15:30', local:{txNome:'Plenário José Bonifácio'}, solicitante:'CDD' }))
  const { generatePdf } = require('../pdf/report.js')
  const buf = await generatePdf('1000007671')
  expect(buf.slice(0,4).toString()).toBe('%PDF')
  db.close()
})
