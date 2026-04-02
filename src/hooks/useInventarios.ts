import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Inventario, InventarioInput, LineaInventario } from '../types'

export function useInventarios() {
  const [inventarios, setInventarios] = useState<Inventario[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/inventarios`)
      if (!res.ok) return
      const data = await res.json()
      setInventarios(data.map((inv: any) => ({
        id: String(inv.id), fecha: inv.fecha, totalGeneral: inv.totalGeneral, creadoEn: inv.creadoEn,
        lineas: (inv.lineas || []).map((l: any) => ({
          productoId: String(l.productoId), nombre: l.nombre, valorUnitario: l.valorUnitario,
          salidas: l.salidas ?? 0, invInicial: l.invInicial, entradas: l.entradas,
          invFisico: l.invFisico, saldo: l.saldo, total: l.total,
        } as LineaInventario)),
      } as Inventario)))
    } catch { /* offline */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const mapLineas = (lineas: InventarioInput['lineas']) =>
    lineas.map(l => ({
      productoId: l.productoId, nombre: l.nombre, valorUnitario: l.valorUnitario,
      invInicial: l.invInicial, entradas: l.entradas, invFisico: l.invFisico, saldo: l.saldo, total: l.total,
    }))

  const guardar = async (inventario: InventarioInput) => {
    await apiFetch(`${API_MANAGEMENT}/inventarios`, {
      method: 'POST',
      body: JSON.stringify({ fecha: inventario.fecha, lineas: mapLineas(inventario.lineas), totalGeneral: inventario.totalGeneral }),
    })
    await fetchAll()
  }

  const actualizar = async (id: string, inventario: InventarioInput) => {
    await apiFetch(`${API_MANAGEMENT}/inventarios/${id}`, { method: 'DELETE' })
    await guardar(inventario)
  }

  const eliminar = async (id: string) => {
    await apiFetch(`${API_MANAGEMENT}/inventarios/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  return { inventarios, guardar, actualizar, eliminar }
}
