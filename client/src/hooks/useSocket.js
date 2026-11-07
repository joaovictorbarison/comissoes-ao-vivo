import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export function useSocket(idReuniao) {
  const [socket, setSocket] = useState(null)
  useEffect(() => {
    const s = io({ transports: ['websocket', 'polling'] })
    setSocket(s)
    const join = () => { if (idReuniao) s.emit('join-room', String(idReuniao)) }
    s.on('connect', join)
    if (idReuniao) join()
    return () => { s.disconnect() }
  }, [idReuniao])
  return socket
}
