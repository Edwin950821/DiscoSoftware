import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Jornada, LiquidacionTrabajador } from '../types'

export function useJornadas() {
  const [jornadas, setJornadas] = useState<Jornada[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/jornadas`)
      if (!res.ok) throw new Error('Error fetching jornadas')
      const data = await res.json()
      setJornadas(data.map((j: any) => ({
        ...j,
        id: String(j.id),
        liquidaciones: (j.liquidaciones || []).map((l: any) => ({
          ...l,
          trabajadorId: String(l.trabajadorId),
          lineas: l.lineas || [],
          transacciones: l.transacciones || [],
          vales: l.vales || [],
          cortesias: l.cortesias || [],
          gastos: l.gastos || [],
        } as LiquidacionTrabajador)),
      } as Jornada)))
    } catch {}
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => {
    const body = {
      sesion: input.sesion,
      fecha: input.fecha,
      liquidaciones: input.liquidaciones.map(liq => ({
        trabajadorId: Number(liq.trabajadorId),
        nombre: liq.nombre,
        color: liq.color,
        avatar: liq.avatar,
        totalVenta: liq.totalVenta,
        efectivoEntregado: liq.efectivoEntregado,
        lineas: liq.lineas.filter(l => l.cantidad > 0).map(l => ({
          productoId: Number(l.productoId),
          nombre: l.nombre,
          precioUnitario: l.precioUnitario,
          cantidad: l.cantidad,
          total: l.total,
        })),
        transacciones: liq.transacciones.filter(t => t.monto > 0).map(t => ({
          tipo: t.tipo,
          monto: t.monto,
        })),
        vales: liq.vales.filter(v => v.monto > 0).map(v => ({
          tercero: v.tercero,
          monto: v.monto,
        })),
        cortesias: liq.cortesias.filter(c => c.monto > 0).map(c => ({
          concepto: c.concepto,
          monto: c.monto,
        })),
        gastos: liq.gastos.filter(g => g.monto > 0).map(g => ({
          concepto: g.concepto,
          monto: g.monto,
        })),
      })),
    }
    const res = await apiFetch(`${API_MANAGEMENT}/jornadas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Error creating jornada')
    await fetchAll()
  }

  const eliminar = async (id: string) => {
    const res = await apiFetch(`${API_MANAGEMENT}/jornadas/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error deleting jornada')
    await fetchAll()
  }

  return { jornadas, guardar, eliminar }
}
