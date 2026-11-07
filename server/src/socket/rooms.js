const rooms = new Map() // roomName -> Set<socketId>
const MAX_ROOMS = 10
function roomName(idReuniao){ return 'reuniao:' + String(idReuniao) }
function joinRoom(socket, idReuniao) {
  const room = roomName(idReuniao)
  socket.join(room)
  if (!rooms.has(room)) rooms.set(room, new Set())
  rooms.get(room).add(socket.id)
  socket.data.room = room
}
function leaveRoom(socket) {
  if (!socket.data.room) return
  rooms.get(socket.data.room)?.delete(socket.id)
  if (rooms.get(socket.data.room)?.size === 0) rooms.delete(socket.data.room)
}
function activeRoomCount(){ return rooms.size }
module.exports = { roomName, joinRoom, leaveRoom, activeRoomCount, MAX_ROOMS }
