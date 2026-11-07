import { test, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

test('rooms isolate meetings', async () => {
  const { Server } = require('socket.io')
  const http = require('http')
  const server = http.createServer()
  const io = new Server(server)
  const { registerMeetingHandler } = require('../socket/meetingHandler.js')
  registerMeetingHandler(io)
  await new Promise(r=>server.listen(0,r))
  const port = server.address().port
  const { io: clientIo } = require('socket.io-client')
  const a = clientIo(`http://localhost:${port}`)
  const b = clientIo(`http://localhost:${port}`)
  await Promise.all([new Promise(r=>a.on('connect',r)), new Promise(r=>b.on('connect',r))])
  a.emit('join-room','1000007671'); b.emit('join-room','1100000053')
  await new Promise(r=>setTimeout(r,50))
  let bHeard = false
  b.on('official_status_changed', ()=>{ bHeard = true })
  io.to('reuniao:1000007671').emit('official_status_changed', { idReuniao:'1000007671' })
  await new Promise(r=>setTimeout(r,50))
  expect(bHeard).toBe(false)
  a.disconnect(); b.disconnect()
  await new Promise(r=>io.close(r))
  await new Promise(r=>server.close(r))
})
