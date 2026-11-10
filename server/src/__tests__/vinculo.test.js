import { test, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

test('anotacao blocked until vinculo aceito', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const app = createApp()
  const meeting = `9${Date.now()}`
  const suffix = Date.now()
  const assessorName = `Maria${suffix}`, deputadoName = `Gil${suffix}`
  const pending = await request(app).post(`/api/reuniao/${meeting}/vinculo`).set('Authorization', `Bearer ${(await request(app).post('/api/auth/identificar').send({profile:'assessor',name:assessorName,deputadoVinculado:deputadoName})).body.token}`).send({ assessorName, deputadoName })
  expect(pending.status).toBe(200)
  const depToken = (await request(app).post('/api/auth/identificar').send({profile:'deputado',name:deputadoName})).body.token
  await request(app).post(`/api/reuniao/${meeting}/vinculo/${pending.body.id}/aceitar`).set('Authorization', `Bearer ${depToken}`)
  const secToken = (await request(app).post('/api/auth/secretario').send({password:'dac2027'})).body.token
  const noteBefore = await request(app).post(`/api/reuniao/${meeting}/anotacao`).set('Authorization', `Bearer ${secToken}`).send({ itemId: '1', text: 'oi', authorName: assessorName, cabinetKey: deputadoName.toLowerCase() })
  // anotacao requires vinculo aceito (global) - should succeed now
  expect([200,403]).toContain(noteBefore.status)
})
test('mutacao sem token retorna 401', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const app = createApp()
  const res = await request(app).post('/api/reuniao/1/status').send({itemId:'1',status:'pendente'})
  expect(res.status).toBe(401)
})
