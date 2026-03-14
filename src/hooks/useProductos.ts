import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Producto } from '../types'

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/productos`)
      if (!res.ok) throw new Error('Error fetching productos')
      const data = await res.json()
      setProductos(data.map((p: any) => ({ ...p, id: String(p.id) })))
    } catch (e) {
      console.error('Error cargando productos:', e)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const agregar = async (p: Omit<Producto, 'id'>) => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/productos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      if (!res.ok) throw new Error('Error creating producto')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  const actualizar = async (id: string, data: Partial<Producto>) => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/productos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error updating producto')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  const eliminar = async (id: string) => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/productos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error deleting producto')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  return { productos, agregar, actualizar, eliminar }
}
