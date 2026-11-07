const { joinRoom, leaveRoom } = require('./rooms.js')
function registerMeetingHandler(io) {
  io.on('connection', (socket) => {
    socket.on('join-room', (idReuniao) => { joinRoom(socket, idReuniao) })
    socket.on('disconnect', () => leaveRoom(socket))
  })
}
module.exports = { registerMeetingHandler }
