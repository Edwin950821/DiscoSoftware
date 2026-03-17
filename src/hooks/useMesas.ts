import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import { getSocket } from '../lib/socket'
import type { Mesa } from '../types'

export function useMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/mesas`)
      if (!res.ok) throw new Error('Error fetching mesas')
      const data = await res.json()
      setMesas(data.map((m: any) => ({ ...m, id: String(m.id) })))
    } catch {}
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    let cleanup: (() => void) | null = null
    let retryId: ReturnType<typeof setInterval> | null = null

    const register = () => {
      const socket = getSocket()
      if (!socket) return false

      const onMesaOcupada = (mesa: any) => {
        setMesas(prev => prev.map(m => m.id === String(mesa.id) ? { ...mesa, id: String(mesa.id) } : m))
      }
      const onMesaActualizada = (mesa: any) => {
        setMesas(prev => prev.map(m => m.id === String(mesa.id) ? { ...mesa, id: String(mesa.id) } : m))
      }
      const onMesaLiberada = (mesa: any) => {
        setMesas(prev => prev.map(m => m.id === String(mesa.id) ? { ...mesa, id: String(mesa.id) } : m))
      }

      socket.on('mesa_ocupada', onMesaOcupada)
      socket.on('mesa_actualizada', onMesaActualizada)
      socket.on('mesa_liberada', onMesaLiberada)

      cleanup = () => {
        socket.off('mesa_ocupada', onMesaOcupada)
        socket.off('mesa_actualizada', onMesaActualizada)
        socket.off('mesa_liberada', onMesaLiberada)
      }
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
  }, [])

  return { mesas, refetch: fetchAll }
}
