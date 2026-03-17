import { useCallback, useEffect, useState } from 'react'
import { API_PEDIDOS, apiFetch } from '../lib/config'
import { getSocket } from '../lib/socket'
import type { ResumenDia, ResumenJornada } from '../types'

export function useJornadaDiaria() {
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [historial, setHistorial] = useState<ResumenJornada[]>([])
  const [loading, setLoading] = useState(false)

  const fetchResumen = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/jornada/resumen`)
      if (res.ok) setResumen(await res.json())
    } catch {}
  }, [])

  const fetchHistorial = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/jornada/historial`)
      if (res.ok) setHistorial(await res.json())
    } catch {}
  }, [])

  const cerrarJornada = useCallback(async (): Promise<ResumenJornada | null> => {
    setLoading(true)
    try {
      const res = await apiFetch(`${API_PEDIDOS}/jornada/cerrar`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message || 'Error al cerrar jornada')
      }
      const data = await res.json()
      await fetchResumen()
      await fetchHistorial()
      return data
    } catch (e) {
      throw e
    } finally {
      setLoading(false)
    }
  }, [fetchResumen, fetchHistorial])

  useEffect(() => {
    fetchResumen()
    fetchHistorial()
  }, [fetchResumen, fetchHistorial])

  useEffect(() => {
    let cleanup: (() => void) | null = null
    let retryId: ReturnType<typeof setInterval> | null = null

    const register = () => {
      const socket = getSocket()
      if (!socket) return false

      const onJornadaCerrada = () => {
        fetchResumen()
        fetchHistorial()
      }
      socket.on('jornada_cerrada', onJornadaCerrada)
      cleanup = () => { socket.off('jornada_cerrada', onJornadaCerrada) }
      return true
    }

    if (!register()) {
      retryId = setInterval(() => {
        if (register() && retryId) { clearInterval(retryId); retryId = null }
      }, 500)
    }

    return () => {
      if (retryId) clearInterval(retryId)
      if (cleanup) cleanup()
    }
  }, [fetchResumen, fetchHistorial])

  return { resumen, historial, cerrarJornada, loading, refetch: fetchResumen }
}
