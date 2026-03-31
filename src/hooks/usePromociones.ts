import { useEffect, useState, useCallback } from 'react'
import { db } from '../lib/db'
import type { Promocion } from '../types'

export function usePromociones() {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    const data = await db.promociones.toArray()
    setPromociones(data.map((p: any) => ({ ...p, id: String(p.id) })))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const crear = async (req: {
    nombre: string
    compraProductoIds: string[]
    compraCantidad: number
    regaloProductoId: string
    regaloCantidad: number
  }) => {
    // Resolver nombres de productos
    const compraProds = await Promise.all(
      req.compraProductoIds.map(id => db.productos.get(Number(id)))
    )
    const regaloProd = await db.productos.get(Number(req.regaloProductoId))

    const data = {
      nombre: req.nombre,
      compraProductoIds: req.compraProductoIds,
      compraProductoNombres: compraProds.map((p: any) => p?.nombre || ''),
      compraCantidad: req.compraCantidad,
      regaloProductoId: req.regaloProductoId,
      regaloProductoNombre: regaloProd?.nombre || '',
      regaloProductoPrecio: regaloProd?.precio || 0,
      regaloCantidad: req.regaloCantidad,
      activa: true,
    }
    const id = await db.promociones.add(data)
    await fetchAll()
    return { ...data, id: String(id) }
  }

  const actualizar = async (id: string, req: {
    nombre?: string
    compraProductoIds?: string[]
    compraCantidad?: number
    regaloProductoId?: string
    regaloCantidad?: number
    activa?: boolean
  }) => {
    const updates: any = { ...req }

    if (req.compraProductoIds) {
      const prods = await Promise.all(req.compraProductoIds.map(pid => db.productos.get(Number(pid))))
      updates.compraProductoNombres = prods.map((p: any) => p?.nombre || '')
    }
    if (req.regaloProductoId) {
      const prod = await db.productos.get(Number(req.regaloProductoId))
      updates.regaloProductoNombre = prod?.nombre || ''
      updates.regaloProductoPrecio = prod?.precio || 0
    }

    await db.promociones.update(Number(id), updates)
    await fetchAll()
    return { id, ...updates }
  }

  const eliminar = async (id: string) => {
    await db.promociones.delete(Number(id))
    await fetchAll()
  }

  const toggleActiva = async (id: string, activa: boolean) => {
    return actualizar(id, { activa })
  }

  return { promociones, loading, crear, actualizar, eliminar, toggleActiva, refetch: fetchAll }
}
