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
      const mapped = data.map((p: any) => ({
        id: String(p.id),
        nombre: p.nombre,
        precio: p.precio,
        activo: p.activo,
        orden: p.orden ?? 999999
      }))
      // Ordenar por campo 'orden' ascendente
      mapped.sort((a: Producto, b: Producto) => (a.orden ?? 999999) - (b.orden ?? 999999))
      setProductos(mapped)
    } catch { /* offline */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const agregar = async (p: Omit<Producto, 'id'>) => {
    // Nuevos productos van al final
    const maxOrden = productos.reduce((max, prod) => Math.max(max, prod.orden ?? 0), 0)
    const res = await apiFetch(`${API_MANAGEMENT}/productos`, {
      method: 'POST',
      body: JSON.stringify({ ...p, orden: maxOrden + 1 })
    })
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

  // Reordenar productos: recibe el array completo con el nuevo orden
  const reordenar = async (nuevosProductos: Producto[]) => {
    // Crear mapa del orden actual para comparar
    const ordenActual = new Map(productos.map((p, idx) => [p.id, idx]))
    
    // Solo actualizar los productos que cambiaron de posición
    const cambios = nuevosProductos
      .map((p, nuevoIdx) => ({ id: p.id, orden: nuevoIdx }))
      .filter(item => ordenActual.get(item.id) !== item.orden)
    
    // Si no hay cambios, no hacer nada
    if (cambios.length === 0) return
    
    // Actualizar localmente primero para UX fluida
    const productosConNuevoOrden = nuevosProductos.map((p, idx) => ({ ...p, orden: idx }))
    setProductos(productosConNuevoOrden)
    
    // Enviar solo las actualizaciones necesarias al backend
    try {
      await Promise.all(
        cambios.map(u =>
          apiFetch(`${API_MANAGEMENT}/productos/${u.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ orden: u.orden })
          })
        )
      )
    } catch (error) {
      // Si falla, recargar del servidor
      await fetchAll()
      throw error
    }
  }

  return { productos, agregar, actualizar, eliminar, reordenar }
}
