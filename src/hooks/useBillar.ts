import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiFetch } from '../lib/config'
import { getSocket } from '../lib/socket'
import type { MesaBillar, PartidaBillar } from '../types'

const API = import.meta.env.VITE_API_URL || '/api/disco'
const BASE = `${API}/billar`

export function useBillar() {
  const [mesas, setMesas] = useState<MesaBillar[]>([])
  const [partidas, setPartidas] = useState<PartidaBillar[]>([])

  const fetchMesas = useCallback(async () => {
    try {
      const res = await apiFetch(`${BASE}/mesas`)
      if (!res.ok) throw new Error('Error fetching mesas billar')
      const data = await res.json()
      setMesas(data.map((m: any) => ({ ...m, id: String(m.id) })))
    } catch {}
  }, [])

  const fetchPartidas = useCallback(async () => {
    try {
      const res = await apiFetch(`${BASE}/partidas/hoy`)
      if (!res.ok) throw new Error('Error fetching partidas')
      const data = await res.json()
      setPartidas(data.map((p: any) => ({ ...p, id: String(p.id) })))
    } catch {}
  }, [])

  const refetch = useCallback(() => {
    fetchMesas()
    fetchPartidas()
  }, [fetchMesas, fetchPartidas])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    let cleanup: (() => void) | null = null
    let retryId: ReturnType<typeof setInterval> | null = null

    const register = () => {
      const socket = getSocket()
      if (!socket) return false

      const handler = () => refetch()
      socket.on('billar_mesa_creada', handler)
      socket.on('billar_partida_iniciada', handler)
      socket.on('billar_partida_finalizada', handler)
      socket.on('billar_partida_trasladada', handler)

      cleanup = () => {
        socket.off('billar_mesa_creada', handler)
        socket.off('billar_partida_iniciada', handler)
        socket.off('billar_partida_finalizada', handler)
        socket.off('billar_partida_trasladada', handler)
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
  }, [refetch])

  const crearMesa = async (nombre: string, precioPorHora: number) => {
    const res = await apiFetch(`${BASE}/mesas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, precioPorHora })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al crear mesa')
    }
    await refetch()
    return res.json()
  }

  const actualizarMesa = async (id: string, data: { nombre?: string; precioPorHora?: number; activo?: boolean }) => {
    const res = await apiFetch(`${BASE}/mesas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Error al actualizar mesa')
    await refetch()
  }

  const eliminarMesa = async (id: string) => {
    const res = await apiFetch(`${BASE}/mesas/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar mesa')
    await refetch()
  }

  const iniciarPartida = async (mesaId: string, nombreCliente: string, precioPorHora?: number) => {
    const res = await apiFetch(`${BASE}/mesas/${mesaId}/iniciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreCliente, precioPorHora })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al iniciar partida')
    }
    await refetch()
    return res.json()
  }

  const finalizarPartida = async (mesaId: string) => {
    const res = await apiFetch(`${BASE}/mesas/${mesaId}/finalizar`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al finalizar partida')
    }
    await refetch()
    return res.json()
  }

  const trasladarPartida = async (mesaOrigenId: string, mesaDestinoId: string) => {
    const res = await apiFetch(`${BASE}/mesas/${mesaOrigenId}/trasladar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaDestinoId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al trasladar partida')
    }
    await refetch()
    return res.json()
  }

  const partidasFinalizadas = useMemo(() => partidas.filter(p => p.estado === 'FINALIZADA'), [partidas])
  const totalBillarHoy = useMemo(() => partidasFinalizadas.reduce((s, p) => s + (p.total || 0), 0), [partidasFinalizadas])

  return {
    mesas,
    partidasFinalizadas,
    totalBillarHoy,
    crearMesa,
    actualizarMesa,
    eliminarMesa,
    iniciarPartida,
    finalizarPartida,
    trasladarPartida
  }
}
