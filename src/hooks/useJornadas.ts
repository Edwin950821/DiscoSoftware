import { useEffect, useState, useCallback } from 'react'
import { db } from '../lib/db'
import type { Jornada, LiquidacionTrabajador } from '../types'
import { calcularLiquidacion, calcularCuadreDia } from '../lib/utils'

export function useJornadas() {
  const [jornadas, setJornadas] = useState<Jornada[]>([])

  const fetchAll = useCallback(async () => {
    const data = await db.jornadas.orderBy('creadoEn').reverse().toArray()
    setJornadas(data.map((j: any) => {
      const meseros = j.meseros || j.liquidaciones || []
      const liquidaciones = meseros.map((m: any) => {
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
          cortesias: typeof m.cortesias === 'number' && m.cortesias > 0
            ? [{ concepto: 'Cortesias', monto: m.cortesias }]
            : (Array.isArray(m.cortesias) ? m.cortesias : []),
          gastos: typeof m.gastos === 'number' && m.gastos > 0
            ? [{ concepto: 'Gastos', monto: m.gastos }]
            : (Array.isArray(m.gastos) ? m.gastos : []),
        } as LiquidacionTrabajador
      })
      const cuadre = calcularCuadreDia(liquidaciones)
      return {
        ...j,
        id: String(j.id),
        liquidaciones,
        totalVendido: cuadre.totalVendido,
        totalRecibido: cuadre.totalRecibido,
        saldo: cuadre.saldo,
        cortesias: cuadre.totalCortesias,
        gastos: cuadre.totalGastos,
        pagos: cuadre.pagos,
      } as Jornada
    }))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => {
    const cuadre = calcularCuadreDia(input.liquidaciones)
    const body = {
      sesion: input.sesion,
      fecha: input.fecha,
      creadoEn: new Date().toISOString(),
      totalVendido: cuadre.totalVendido,
      totalRecibido: cuadre.totalRecibido,
      saldo: cuadre.saldo,
      cortesias: cuadre.totalCortesias,
      gastos: cuadre.totalGastos,
      pagos: cuadre.pagos,
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
          lineas: liq.lineas || [],
        }
      }),
    }
    await db.jornadas.add(body)
    await fetchAll()
  }

  const eliminar = async (id: string) => {
    await db.jornadas.delete(Number(id))
    await fetchAll()
  }

  return { jornadas, guardar, eliminar }
}
