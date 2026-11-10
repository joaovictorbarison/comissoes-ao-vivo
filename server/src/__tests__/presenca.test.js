import { test, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

async function token(app, profile='deputado', name='Gil') {
  const request = (await import('supertest')).default
  const r = await request(app).post('/api/auth/identificar').send({ profile, name })
  return r.body.token
}

test('POST presenca rejects assessor', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const app = createApp()
  const t = await token(app)
  const res = await request(app).post('/api/reuniao/1/presenca').set('Authorization', `Bearer ${t}`).send({ name: 'Maria', profile: 'assessor' })
  expect(res.status).toBe(400)
})
test('POST presenca accepts deputado', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const app = createApp()
  const t = await token(app)
  const res = await request(app).post('/api/reuniao/1/presenca').set('Authorization', `Bearer ${t}`).send({ name: 'Gil', profile: 'deputado' })
  expect(res.status).toBe(200)
})
test('POST presenca without token returns 401', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const app = createApp()
  const res = await request(app).post('/api/reuniao/1/presenca').send({ name: 'Gil', profile: 'deputado' })
  expect(res.status).toBe(401)
})
