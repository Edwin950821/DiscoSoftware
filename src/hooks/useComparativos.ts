import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Comparativo, ComparativoInput, LineaComparativo } from '../types'
import { enqueueOp, isNetworkError, SYNC_EVENT } from '../lib/syncQueue'

export function useComparativos() {
  const [comparativos, setComparativos] = useState<Comparativo[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/comparativos?_=${Date.now()}`)
      if (!res.ok) return
      const data = await res.json()
      setComparativos(data.map((c: any) => {
        const lineas: LineaComparativo[] = (c.lineas || []).map((l: any) => {
          const conteo = typeof l.conteo === 'number' ? l.conteo : 0
          const tiquets = typeof l.tiquets === 'number' ? l.tiquets : 0
          return {
            ...l,
            productoId: String(l.productoId),
            conteo,
            tiquets,
            diferencia: typeof l.diferencia === 'number' ? l.diferencia : tiquets - conteo,
          } as LineaComparativo
        })
        const totalTiquets = typeof c.totalTiquets === 'number' ? c.totalTiquets : lineas.reduce((s, l) => s + l.tiquets, 0)
        const totalConteo = typeof c.totalConteo === 'number' ? c.totalConteo : lineas.reduce((s, l) => s + l.conteo, 0)
        return {
          ...c,
          id: String(c.id),
          fechaHasta: c.fechaHasta ?? c.fecha,
          lineas,
          totalConteo,
          totalTiquets,
          totalDiferencia: c.totalDiferencia ?? totalTiquets - totalConteo,
        } as Comparativo
      }))
    } catch (e) { console.error('Error fetching comparativos:', e) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const handler = () => { fetchAll() }
    window.addEventListener(SYNC_EVENT, handler)
    return () => window.removeEventListener(SYNC_EVENT, handler)
  }, [fetchAll])

  const mapLineas = (lineas: ComparativoInput['lineas']) =>
    lineas.map(l => ({
      productoId: l.productoId,
      nombre: l.nombre,
      conteo: l.conteo,
      tiquets: l.tiquets,
    }))

  const guardar = async (comparativo: ComparativoInput): Promise<{ queued?: boolean }> => {
    const body = {
      fecha: comparativo.fecha,
      fechaHasta: comparativo.fechaHasta ?? comparativo.fecha,
      lineas: mapLineas(comparativo.lineas),
      totalConteo: comparativo.totalConteo,
      totalTiquets: comparativo.totalTiquets,
    }
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/comparativos`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Error al guardar comparativo: ${res.status}`)
      await fetchAll()
      return {}
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueOp({ tipo: 'comparativo', accion: 'crear', payload: body })
        return { queued: true }
      }
      throw err
    }
  }

  const actualizar = async (id: string, comparativo: ComparativoInput): Promise<{ queued?: boolean }> => {
    const body = {
      fecha: comparativo.fecha,
      fechaHasta: comparativo.fechaHasta ?? comparativo.fecha,
      lineas: mapLineas(comparativo.lineas),
      totalConteo: comparativo.totalConteo,
      totalTiquets: comparativo.totalTiquets,
    }
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/comparativos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Error al actualizar comparativo: ${res.status}`)
      await fetchAll()
      return {}
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueOp({ tipo: 'comparativo', accion: 'actualizar', targetId: id, payload: body })
        return { queued: true }
      }
      throw err
    }
  }

  const eliminar = async (id: string): Promise<{ queued?: boolean }> => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/comparativos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Error al eliminar comparativo: ${res.status}`)
      await fetchAll()
      return {}
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueOp({ tipo: 'comparativo', accion: 'eliminar', targetId: id })
        return { queued: true }
      }
      throw err
    }
  }

  return { comparativos, guardar, actualizar, eliminar }
}
