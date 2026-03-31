import { useEffect, useState, useCallback } from 'react'
import { db } from '../lib/db'
import type { Comparativo, ComparativoInput, LineaComparativo } from '../types'

export function useComparativos() {
  const [comparativos, setComparativos] = useState<Comparativo[]>([])

  const fetchAll = useCallback(async () => {
    const data = await db.comparativos.orderBy('creadoEn').reverse().toArray()
    setComparativos(data.map((c: any) => ({
      ...c,
      id: String(c.id),
      lineas: (c.lineas || []).map((l: any) => ({
        ...l,
        productoId: String(l.productoId),
      } as LineaComparativo)),
    } as Comparativo)))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (comparativo: ComparativoInput) => {
    await db.comparativos.add({
      fecha: comparativo.fecha,
      totalConteo: comparativo.totalConteo,
      totalTiquets: comparativo.totalTiquets,
      creadoEn: new Date().toISOString(),
      lineas: comparativo.lineas.map(l => ({
        productoId: l.productoId,
        nombre: l.nombre,
        conteo: l.conteo,
        tiquets: l.tiquets,
      })),
    })
    await fetchAll()
  }

  const eliminar = async (id: string) => {
    await db.comparativos.delete(Number(id))
    await fetchAll()
  }

  return { comparativos, guardar, eliminar }
}
