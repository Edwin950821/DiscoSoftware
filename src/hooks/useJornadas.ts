import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Jornada, LiquidacionTrabajador } from '../types'
import { calcularLiquidacion } from '../lib/utils'

export function useJornadas() {
  const [jornadas, setJornadas] = useState<Jornada[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/jornadas`)
      if (!res.ok) throw new Error('Error fetching jornadas')
      const data = await res.json()
      setJornadas(data.map((j: any) => {
        const meseros = j.meseros || j.liquidaciones || []
        return {
          ...j,
          id: String(j.id),
          liquidaciones: meseros.map((m: any) => {
            const pagos = m.pagos || {}
            return {
              trabajadorId: String(m.meseroId || m.trabajadorId),
              nombre: m.nombre,
              color: m.color,
              avatar: m.avatar,
              totalVenta: m.totalMesero ?? m.totalVenta ?? 0,
              efectivoEntregado: pagos.Efectivo ?? m.efectivoEntregado ?? 0,
              lineas: m.lineas || [],
              transacciones: Object.entries(pagos)
                .filter(([k]) => k !== 'Efectivo' && k !== 'Vales')
                .filter(([, v]) => (v as number) > 0)
                .map(([tipo, monto]) => ({ tipo, concepto: '', monto: monto as number })),
              vales: pagos.Vales ? [{ tercero: 'Vales', monto: pagos.Vales }] : (m.vales || []),
              cortesias: typeof m.cortesias === 'number' && m.cortesias > 0 ? [{ concepto: 'Cortesias', monto: m.cortesias }] : (Array.isArray(m.cortesias) ? m.cortesias : []),
              gastos: typeof m.gastos === 'number' && m.gastos > 0 ? [{ concepto: 'Gastos', monto: m.gastos }] : (Array.isArray(m.gastos) ? m.gastos : []),
            } as LiquidacionTrabajador
          }),
        } as Jornada
      }))
    } catch {}
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => {
    const body = {
      sesion: input.sesion,
      fecha: input.fecha,
      meseros: input.liquidaciones.map(liq => {
        const c = calcularLiquidacion(liq)
        const pagos: Record<string, number> = {}
        const efEntregado = liq.efectivoEntregado ?? c.efectivo
        if (efEntregado > 0) pagos['Efectivo'] = efEntregado
        if (c.totalDatafono > 0) pagos['Datafono'] = c.totalDatafono
        if (c.totalQR > 0) pagos['QR'] = c.totalQR
        if (c.totalNequi > 0) pagos['Nequi'] = c.totalNequi
        if (c.totalVales > 0) pagos['Vales'] = c.totalVales
        return {
          meseroId: liq.trabajadorId,
          nombre: liq.nombre,
          color: liq.color,
          avatar: liq.avatar,
          totalMesero: c.totalVenta,
          cortesias: c.totalCortesias,
          gastos: c.totalGastos,
          pagos,
        }
      }),
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
