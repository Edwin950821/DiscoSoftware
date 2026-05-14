import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Producto } from '../types'

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/productos`)
      if (!res.ok) return
      const data = await res.json()
      setProductos(data.map((p: any) => ({ id: String(p.id), nombre: p.nombre, precio: p.precio, activo: p.activo })))
    } catch { /* offline */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const agregar = async (p: Omit<Producto, 'id'>) => {
    const res = await apiFetch(`${API_MANAGEMENT}/productos`, { method: 'POST', body: JSON.stringify(p) })
    if (!res.ok) throw new Error(`Error al crear producto: ${res.status}`)
    await fetchAll()
  }

  const actualizar = async (id: string, data: Partial<Producto>) => {
    const res = await apiFetch(`${API_MANAGEMENT}/productos/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
    if (!res.ok) throw new Error(`Error al actualizar producto: ${res.status}`)
    await fetchAll()
  }

  const eliminar = async (id: string) => {
    await apiFetch(`${API_MANAGEMENT}/productos/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  return { productos, agregar, actualizar, eliminar }
}
