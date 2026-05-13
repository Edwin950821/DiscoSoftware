import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { requestNotificationPermission, sendBrowserNotification, vibrar } from '../lib/notification'
import { playSuperNotificationSound } from '../lib/sound'

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || 'http://localhost:3001'
const STORAGE_KEY = 'monastery_super_notifs'
const MAX_NOTIFS = 50

export type SuperModulo = 'LIQUIDACION' | 'INVENTARIO' | 'PRODUCTO' | 'MESERO' | 'PROMOCION' | 'MESA_BILLAR'
export type SuperAccion = 'CREATE' | 'UPDATE' | 'DELETE'

const MODULOS_VALIDOS: SuperModulo[] = ['LIQUIDACION', 'INVENTARIO', 'PRODUCTO', 'MESERO', 'PROMOCION', 'MESA_BILLAR']

export const MODULO_LABEL: Record<SuperModulo, string> = {
  LIQUIDACION: 'Liquidación',
  INVENTARIO: 'Inventario',
  PRODUCTO: 'Producto',
  MESERO: 'Mesero',
  PROMOCION: 'Promoción',
  MESA_BILLAR: 'Mesa de billar',
}

export const ACCION_LABEL: Record<SuperAccion, string> = {
  CREATE: 'creado',
  UPDATE: 'actualizado',
  DELETE: 'eliminado',
}

export interface SuperNotificacion {
  id: string
  negocioId: string
  negocioNombre: string
  negocioColor: string
  modulo: SuperModulo
  accion: SuperAccion
  recursoId: string | null
  descripcion: string | null
  timestamp: string
  leida: boolean
}

interface RawEvent {
  id?: string
  negocioId?: string
  negocioNombre?: string
  negocioColor?: string
  modulo?: string
  accion?: string
  recursoId?: string | null
  descripcion?: string | null
  timestamp?: string
}

function readStored(): SuperNotificacion[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStored(items: SuperNotificacion[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFS)))
  } catch { /* noop */ }
}

function readSession(): { token: string; rol: string } | null {
  try {
    const raw = sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { token: parsed?.accessToken ?? '', rol: parsed?.rol ?? '' }
  } catch {
    return null
  }
}

export function useSuperNotifications(enabled: boolean, onAbrir?: (n: SuperNotificacion) => void) {
  const [notificaciones, setNotificaciones] = useState<SuperNotificacion[]>(() => readStored())
  const [conectado, setConectado] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const mountedRef = useRef(true)
  const onAbrirRef = useRef(onAbrir)

  const session = readSession()
  const token = session?.rol === 'SUPER' ? session.token : null

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => { onAbrirRef.current = onAbrir }, [onAbrir])

  useEffect(() => {
    if (!enabled) return
    requestNotificationPermission().catch(() => { /* permiso denegado */ })
  }, [enabled])

  const persistir = useCallback((next: SuperNotificacion[]) => {
    writeStored(next)
    return next
  }, [])

  const marcarTodasLeidas = useCallback(() => {
    if (!mountedRef.current) return
    setNotificaciones(prev => persistir(prev.map(n => ({ ...n, leida: true }))))
  }, [persistir])

  const marcarLeida = useCallback((id: string) => {
    if (!mountedRef.current) return
    setNotificaciones(prev => persistir(prev.map(n => n.id === id ? { ...n, leida: true } : n)))
  }, [persistir])

  const limpiar = useCallback(() => {
    if (!mountedRef.current) return
    setNotificaciones(persistir([]))
  }, [persistir])

  useEffect(() => {
    if (!enabled || !token) return

    const socket = io(SOCKET_URL, {
      auth: { token },
      query: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    })

    socket.on('connect', () => { if (mountedRef.current) setConectado(true) })
    socket.on('disconnect', () => { if (mountedRef.current) setConectado(false) })
    socket.on('connect_error', () => { if (mountedRef.current) setConectado(false) })

    socket.on('super_actualizacion', (raw: RawEvent) => {
      if (!mountedRef.current) return
      if (!raw || !raw.modulo || !raw.negocioId) return
      const modulo = raw.modulo as SuperModulo
      if (!MODULOS_VALIDOS.includes(modulo)) return

      const accionRaw = raw.accion?.toUpperCase()
      const accion: SuperAccion = accionRaw === 'UPDATE' ? 'UPDATE'
        : accionRaw === 'DELETE' ? 'DELETE' : 'CREATE'

      const notif: SuperNotificacion = {
        id: raw.id ?? `${Date.now()}-${Math.random()}`,
        negocioId: raw.negocioId,
        negocioNombre: raw.negocioNombre ?? 'Desconocido',
        negocioColor: raw.negocioColor ?? '#888',
        modulo,
        accion,
        recursoId: raw.recursoId ?? null,
        descripcion: raw.descripcion ?? null,
        timestamp: raw.timestamp ?? new Date().toISOString(),
        leida: false,
      }
      setNotificaciones(prev => {
        if (prev.some(n => n.id === notif.id)) return prev
        return persistir([notif, ...prev].slice(0, MAX_NOTIFS))
      })

      try { playSuperNotificationSound() } catch { /* noop */ }
      try { vibrar([100, 80, 100]) } catch { /* noop */ }

      const moduloTxt = MODULO_LABEL[notif.modulo] ?? notif.modulo
      const accionTxt = ACCION_LABEL[notif.accion] ?? notif.accion
      const titulo = `${notif.negocioNombre} · ${moduloTxt} ${accionTxt}`
      const cuerpo = notif.descripcion ?? ''
      sendBrowserNotification(titulo, cuerpo, () => onAbrirRef.current?.(notif))
    })

    socketRef.current = socket
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled, token, persistir])

  const noLeidas = notificaciones.filter(n => !n.leida).length

  return { notificaciones, noLeidas, conectado, marcarTodasLeidas, marcarLeida, limpiar }
}
