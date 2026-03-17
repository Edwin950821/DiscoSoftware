import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

function getSocketUrl(): string {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) {
    try { return new URL(apiUrl).origin } catch { /* */ }
  }
  return 'http://localhost:9092'
}

const BASE = getSocketUrl()

export function initSocket(token: string, meseroId?: string): Socket {
  if (socket) return socket

  const query: Record<string, string> = { token }
  if (meseroId) query.meseroId = meseroId

  socket = io(BASE, {
    query,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
    transports: ['websocket', 'polling'],
  })

  socket.on('connect', () => console.log('Socket.IO conectado'))
  socket.on('disconnect', (reason) => console.log('Socket.IO desconectado:', reason))
  socket.on('connect_error', (err) => console.warn('Socket.IO error:', err.message))

  return socket
}

export function getSocket(): Socket | null { return socket }

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
