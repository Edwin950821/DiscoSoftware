import { useEffect, useState, useCallback } from 'react'
import { db } from '../lib/db'
import type { Producto } from '../types'

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([])

  const fetchAll = useCallback(async () => {
    const data = await db.productos.toArray()
    setProductos(data.map((p: any) => ({ ...p, id: String(p.id) })))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const agregar = async (p: Omit<Producto, 'id'>) => {
    await db.productos.add(p)
    await fetchAll()
  }

  const actualizar = async (id: string, data: Partial<Producto>) => {
    await db.productos.update(Number(id), data)
    await fetchAll()
  }

  const eliminar = async (id: string) => {
    await db.productos.delete(Number(id))
    await fetchAll()
  }

  return { productos, agregar, actualizar, eliminar }
}
