const path = require('path')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')
const http = require('http')
const { initDb } = require('./db.js')
const legisRoutes = require('./routes/legis.js')
const meetingRoutes = require('./routes/meeting.js')
const { registerMeetingHandler } = require('./socket/meetingHandler.js')

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.get('/health', (req,res)=>res.json({ ok:true }))
  app.use('/api', legisRoutes)
  app.use('/api', meetingRoutes)
  app.use(express.static(path.join(__dirname, '../../client/dist')))
  return app
}

function start(port = process.env.PORT || 3000) {
  initDb()
  const app = createApp()
  const server = http.createServer(app)
  const io = new Server(server, { cors:{ origin:'*' } })
  app.set('io', io)
  registerMeetingHandler(io)
  server.listen(port, ()=>console.log(`server on ${port}`))
  return { app, server, io }
}

if (require.main === module) start()

module.exports = { createApp, start }
