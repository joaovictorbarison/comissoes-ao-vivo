import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export function useSocket(idReuniao) {
  const [socket, setSocket] = useState(null)
  useEffect(() => {
    const s = io({ transports: ['websocket'] })
    if (idReuniao) s.emit('join-room', String(idReuniao))
    setSocket(s)
    return () => { s.disconnect() }
  }, [idReuniao])
  return socket
}
