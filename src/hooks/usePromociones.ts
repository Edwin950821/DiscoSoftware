import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Promocion } from '../types'

export function usePromociones() {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/promociones`)
      if (!res.ok) throw new Error('Error fetching promociones')
      const data = await res.json()
      setPromociones(data.map((p: any) => ({ ...p, id: String(p.id) })))
    } catch {}
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const crear = async (req: {
    nombre: string
    compraProductoIds: string[]
    compraCantidad: number
    regaloProductoId: string
    regaloCantidad: number
  }) => {
    const res = await apiFetch(`${API_MANAGEMENT}/promociones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.message || 'Error al crear promoción')
    }
    const data = await res.json()
    fetchAll()
    return data
  }

  const actualizar = async (id: string, req: {
    nombre?: string
    compraProductoIds?: string[]
    compraCantidad?: number
    regaloProductoId?: string
    regaloCantidad?: number
    activa?: boolean
  }) => {
    const res = await apiFetch(`${API_MANAGEMENT}/promociones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.message || 'Error al actualizar promoción')
    }
    const data = await res.json()
    fetchAll()
    return data
  }

  const eliminar = async (id: string) => {
    const res = await apiFetch(`${API_MANAGEMENT}/promociones/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar promoción')
    fetchAll()
  }

  const toggleActiva = async (id: string, activa: boolean) => {
    return actualizar(id, { activa })
  }

  return { promociones, loading, crear, actualizar, eliminar, toggleActiva, refetch: fetchAll }
}
