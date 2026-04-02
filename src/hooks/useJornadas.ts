import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Jornada, LiquidacionTrabajador } from '../types'
import { calcularLiquidacion, calcularCuadreDia } from '../lib/utils'

export function useJornadas() {
  const [jornadas, setJornadas] = useState<Jornada[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/jornadas`)
      if (!res.ok) return
      const data = await res.json()
      setJornadas(data.map((j: any) => {
        const meseros = j.meseros || []
        const liquidaciones = meseros.map((m: any) => {
          const pagos = m.pagos || {}
          return {
            trabajadorId: String(m.meseroId),
            nombre: m.nombre, color: m.color, avatar: m.avatar,
            totalVenta: m.totalMesero ?? 0,
            efectivoEntregado: pagos.Efectivo ?? null,
            lineas: m.lineas || [],
            transacciones: m.transaccionesDetalle?.length > 0
              ? m.transaccionesDetalle
              : Object.entries(pagos)
                  .filter(([k]) => k !== 'Efectivo' && k !== 'Vales')
                  .filter(([, v]) => (v as number) > 0)
                  .map(([tipo, monto]) => ({ tipo, concepto: '', monto: monto as number })),
            vales: m.valesDetalle?.length > 0
              ? m.valesDetalle
              : pagos.Vales ? [{ tercero: 'Vales', monto: pagos.Vales }] : [],
            cortesias: m.cortesiasDetalle?.length > 0
              ? m.cortesiasDetalle
              : typeof m.cortesias === 'number' && m.cortesias > 0
                ? [{ concepto: 'Cortesias', monto: m.cortesias }] : [],
            gastos: m.gastosDetalle?.length > 0
              ? m.gastosDetalle
              : typeof m.gastos === 'number' && m.gastos > 0
                ? [{ concepto: 'Gastos', monto: m.gastos }] : [],
          } as LiquidacionTrabajador
        })
        const cuadre = calcularCuadreDia(liquidaciones)
        return {
          id: String(j.id), sesion: j.sesion, fecha: j.fecha, creadoEn: j.creadoEn,
          liquidaciones, totalVendido: cuadre.totalVendido, totalRecibido: cuadre.totalRecibido,
          saldo: cuadre.saldo, cortesias: cuadre.totalCortesias, gastos: cuadre.totalGastos, pagos: cuadre.pagos,
        } as Jornada
      }))
    } catch { /* offline */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => {
    const meseros = input.liquidaciones.map(liq => {
      const c = calcularLiquidacion(liq)
      const pagos: Record<string, number> = {}
      const efEntregado = liq.efectivoEntregado ?? c.efectivo
      if (efEntregado > 0) pagos['Efectivo'] = efEntregado
      if (c.totalDatafono > 0) pagos['Datafono'] = c.totalDatafono
      if (c.totalQR > 0) pagos['QR'] = c.totalQR
      if (c.totalNequi > 0) pagos['Nequi'] = c.totalNequi
      if (c.totalVales > 0) pagos['Vales'] = c.totalVales
      return {
        meseroId: liq.trabajadorId, nombre: liq.nombre, color: liq.color, avatar: liq.avatar,
        totalMesero: c.totalVenta, cortesias: c.totalCortesias, gastos: c.totalGastos, pagos,
        lineas: liq.lineas?.filter(l => l.cantidad > 0) || [],
        transaccionesDetalle: liq.transacciones?.filter(t => t.monto > 0) || [],
        valesDetalle: liq.vales?.filter(v => v.monto > 0) || [],
        cortesiasDetalle: liq.cortesias?.filter(ct => ct.monto > 0) || [],
        gastosDetalle: liq.gastos?.filter(g => g.monto > 0) || [],
      }
    })
    await apiFetch(`${API_MANAGEMENT}/jornadas`, {
      method: 'POST', body: JSON.stringify({ sesion: input.sesion, fecha: input.fecha, meseros }),
    })
    await fetchAll()
  }

  const actualizar = async (id: string, input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => {
    await apiFetch(`${API_MANAGEMENT}/jornadas/${id}`, { method: 'DELETE' })
    await guardar(input)
  }

  const eliminar = async (id: string) => {
    await apiFetch(`${API_MANAGEMENT}/jornadas/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  return { jornadas, guardar, actualizar, eliminar }
}
