import { test, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

test('anotacao blocked until vinculo aceito', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const app = createApp()
  const meeting = `9${Date.now()}`
  const pending = await request(app).post(`/api/reuniao/${meeting}/vinculo`).send({ assessorName: 'Maria', deputadoName: 'Gil' })
  expect(pending.status).toBe(200)
  const noteBefore = await request(app).post(`/api/reuniao/${meeting}/anotacao`).send({ itemId: '1', text: 'oi', authorName: 'Maria', cabinetKey: 'gil' })
  expect(noteBefore.status).toBe(403)
  await request(app).post(`/api/reuniao/${meeting}/vinculo/${pending.body.id}/aceitar`)
  const noteAfter = await request(app).post(`/api/reuniao/${meeting}/anotacao`).send({ itemId: '1', text: 'oi', authorName: 'Maria', cabinetKey: 'gil' })
  expect(noteAfter.status).toBe(200)
})
