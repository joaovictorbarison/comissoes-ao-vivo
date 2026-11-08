import { test, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

test('POST presenca rejects assessor', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const app = createApp()
  const res = await request(app).post('/api/reuniao/1/presenca').send({ name: 'Maria', profile: 'assessor' })
  expect(res.status).toBe(400)
})
test('POST presenca accepts deputado', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const app = createApp()
  const res = await request(app).post('/api/reuniao/1/presenca').send({ name: 'Gil', profile: 'deputado' })
  expect(res.status).toBe(200)
})
