import { useEffect, useState, useCallback } from 'react'
import { db } from '../lib/db'
import type { Inventario, InventarioInput, LineaInventario } from '../types'

export function useInventarios() {
  const [inventarios, setInventarios] = useState<Inventario[]>([])

  const fetchAll = useCallback(async () => {
    const data = await db.inventarios.orderBy('creadoEn').reverse().toArray()
    setInventarios(data.map((inv: any) => ({
      ...inv,
      id: String(inv.id),
      lineas: (inv.lineas || []).map((l: any) => ({
        ...l,
        productoId: String(l.productoId),
      } as LineaInventario)),
    } as Inventario)))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (inventario: InventarioInput) => {
    await db.inventarios.add({
      fecha: inventario.fecha,
      totalGeneral: inventario.totalGeneral,
      creadoEn: new Date().toISOString(),
      lineas: inventario.lineas.map(l => ({
        productoId: l.productoId,
        nombre: l.nombre,
        valorUnitario: l.valorUnitario,
        invInicial: l.invInicial,
        entradas: l.entradas,
        invFisico: l.invFisico,
        saldo: l.saldo,
        total: l.total,
      })),
    })
    await fetchAll()
  }

  const eliminar = async (id: string) => {
    await db.inventarios.delete(Number(id))
    await fetchAll()
  }

  return { inventarios, guardar, eliminar }
}
