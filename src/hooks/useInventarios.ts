import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Inventario, InventarioInput, LineaInventario } from '../types'
import { enqueueOp, isNetworkError, SYNC_EVENT } from '../lib/syncQueue'

export function useInventarios() {
  const [inventarios, setInventarios] = useState<Inventario[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/inventarios?_=${Date.now()}`)
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
    } catch (e) { console.error('Error fetching inventarios:', e) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const handler = () => { fetchAll() }
    window.addEventListener(SYNC_EVENT, handler)
    return () => window.removeEventListener(SYNC_EVENT, handler)
  }, [fetchAll])

  const mapLineas = (lineas: InventarioInput['lineas']) =>
    lineas.map(l => ({
      productoId: l.productoId, nombre: l.nombre, valorUnitario: l.valorUnitario,
      salidas: l.salidas, invInicial: l.invInicial, entradas: l.entradas, invFisico: l.invFisico, saldo: l.saldo, total: l.total,
    }))

  const guardar = async (inventario: InventarioInput): Promise<{ queued?: boolean }> => {
    const body = { fecha: inventario.fecha, lineas: mapLineas(inventario.lineas), totalGeneral: inventario.totalGeneral }
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/inventarios`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Error al guardar inventario: ${res.status}`)
      await fetchAll()
      return {}
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueOp({ tipo: 'inventario', accion: 'crear', payload: body })
        return { queued: true }
      }
      throw err
    }
  }

  const actualizar = async (id: string, inventario: InventarioInput): Promise<{ queued?: boolean }> => {
    const body = { fecha: inventario.fecha, lineas: mapLineas(inventario.lineas), totalGeneral: inventario.totalGeneral }
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/inventarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Error al actualizar inventario: ${res.status}`)
      await fetchAll()
      return {}
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueOp({ tipo: 'inventario', accion: 'actualizar', targetId: id, payload: body })
        return { queued: true }
      }
      throw err
    }
  }

  const eliminar = async (id: string): Promise<{ queued?: boolean }> => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/inventarios/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Error al eliminar inventario: ${res.status}`)
      await fetchAll()
      return {}
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueOp({ tipo: 'inventario', accion: 'eliminar', targetId: id })
        return { queued: true }
      }
      throw err
    }
  }

  return { inventarios, guardar, actualizar, eliminar }
}
