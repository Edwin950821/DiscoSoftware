import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Comparativo, ComparativoInput, LineaComparativo } from '../types'

export function useComparativos() {
  const [comparativos, setComparativos] = useState<Comparativo[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/comparativos`)
      if (!res.ok) throw new Error('Error fetching comparativos')
      const data = await res.json()
      setComparativos(data.map((c: any) => ({
        ...c,
        id: String(c.id),
        lineas: (c.lineas || []).map((l: any) => ({
          ...l,
          productoId: String(l.productoId),
        } as LineaComparativo)),
      } as Comparativo)))
    } catch {}
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (comparativo: ComparativoInput) => {
    try {
      const body = {
        fecha: comparativo.fecha,
        totalConteo: comparativo.totalConteo,
        totalTiquets: comparativo.totalTiquets,
        lineas: comparativo.lineas.map(l => ({
          productoId: l.productoId,
          nombre: l.nombre,
          conteo: l.conteo,
          tiquets: l.tiquets,
        })),
      }
      const res = await apiFetch(`${API_MANAGEMENT}/comparativos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error creating comparativo')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  const eliminar = async (id: string) => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/comparativos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error deleting comparativo')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  return { comparativos, guardar, eliminar }
}
