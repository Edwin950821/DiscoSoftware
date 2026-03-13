import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT } from '../lib/config'
import type { Inventario, InventarioInput, LineaInventario } from '../types'

export function useInventarios() {
  const [inventarios, setInventarios] = useState<Inventario[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${API_MANAGEMENT}/inventarios`)
      if (!res.ok) throw new Error('Error fetching inventarios')
      const data = await res.json()
      setInventarios(data.map((inv: any) => ({
        ...inv,
        id: String(inv.id),
        lineas: (inv.lineas || []).map((l: any) => ({
          ...l,
          productoId: String(l.productoId),
        } as LineaInventario)),
      } as Inventario)))
    } catch {
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (inventario: InventarioInput) => {
    try {
      const body = {
        fecha: inventario.fecha,
        totalGeneral: inventario.totalGeneral,
        lineas: inventario.lineas.map(l => ({
          ...l,
          productoId: Number(l.productoId),
        })),
      }
      const res = await fetch(`${API_MANAGEMENT}/inventarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error creating inventario')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  const eliminar = async (id: string) => {
    try {
      const res = await fetch(`${API_MANAGEMENT}/inventarios/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error deleting inventario')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  return { inventarios, guardar, eliminar }
}
