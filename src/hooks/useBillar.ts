import { useState, useEffect, useCallback, useMemo } from 'react'
import { API_DISCO, apiFetch } from '../lib/config'
import type { MesaBillar, PartidaBillar } from '../types'

const API_BILLAR = `${API_DISCO}/billar`

export function useBillar() {
  const [mesas, setMesas] = useState<MesaBillar[]>([])
  const [partidas, setPartidas] = useState<PartidaBillar[]>([])

  const fetchMesas = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BILLAR}/mesas`)
      if (!res.ok) return
      const data = await res.json()
      setMesas(data.map((m: any) => ({
        id: String(m.id),
        numero: m.numero,
        nombre: m.nombre,
        precioPorHora: m.precioPorHora,
        estado: m.estado,
        activo: m.activo,
        partidaActiva: m.partidaActiva ? {
          ...m.partidaActiva,
          id: String(m.partidaActiva.id),
          mesaBillarId: String(m.partidaActiva.mesaBillarId),
        } : undefined,
      })))
    } catch { /* offline */ }
  }, [])

  const fetchPartidas = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BILLAR}/partidas/hoy`)
      if (!res.ok) return
      const data = await res.json()
      setPartidas(data.map((p: any) => ({
        ...p,
        id: String(p.id),
        mesaBillarId: String(p.mesaBillarId),
      })))
    } catch { /* offline */ }
  }, [])

  const refetch = useCallback(async () => {
    await Promise.all([fetchMesas(), fetchPartidas()])
  }, [fetchMesas, fetchPartidas])

  useEffect(() => { refetch() }, [refetch])

  const crearMesa = async (nombre: string, precioPorHora: number) => {
    const res = await apiFetch(`${API_BILLAR}/mesas`, {
      method: 'POST',
      body: JSON.stringify({ nombre, precioPorHora }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al crear mesa')
    }
    const mesa = await res.json()
    await refetch()
    return { id: String(mesa.id), nombre: mesa.nombre, precioPorHora: mesa.precioPorHora }
  }

  const actualizarMesa = async (id: string, data: { nombre?: string; precioPorHora?: number; activo?: boolean }) => {
    const res = await apiFetch(`${API_BILLAR}/mesas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al actualizar mesa')
    }
    await refetch()
  }

  const eliminarMesa = async (id: string) => {
    const res = await apiFetch(`${API_BILLAR}/mesas/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al eliminar mesa')
    }
    await refetch()
  }

  const iniciarPartida = async (mesaId: string, nombreCliente: string, precioPorHora?: number) => {
    const body: any = { nombreCliente }
    if (precioPorHora != null) body.precioPorHora = precioPorHora
    const res = await apiFetch(`${API_BILLAR}/mesas/${mesaId}/iniciar`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al iniciar partida')
    }
    const partida = await res.json()
    await refetch()
    return { id: String(partida.id) }
  }

  const finalizarPartida = async (mesaId: string) => {
    const res = await apiFetch(`${API_BILLAR}/mesas/${mesaId}/finalizar`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al finalizar partida')
    }
    const partida = await res.json()
    await refetch()
    return {
      ...partida,
      id: String(partida.id),
      mesaBillarId: String(partida.mesaBillarId),
    }
  }

  const trasladarPartida = async (mesaOrigenId: string, mesaDestinoId: string) => {
    const res = await apiFetch(`${API_BILLAR}/mesas/${mesaOrigenId}/trasladar`, {
      method: 'POST',
      body: JSON.stringify({ mesaDestinoId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Error al trasladar partida')
    }
    const partida = await res.json()
    await refetch()
    return { ...partida, id: String(partida.id), mesaBillarId: String(partida.mesaBillarId) }
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
    trasladarPartida,
    refetch,
  }
}
