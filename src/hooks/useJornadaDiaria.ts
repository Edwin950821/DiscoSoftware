import { useCallback, useEffect, useState } from 'react'
import { db, getHoy } from '../lib/db'
import type { ResumenDia, ResumenJornada } from '../types'

export function useJornadaDiaria() {
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [historial, setHistorial] = useState<ResumenJornada[]>([])
  const [loading, setLoading] = useState(false)

  const fetchResumen = useCallback(async () => {
    const hoy = getHoy()

    const cuentas = await db.cuentas.where('jornadaFecha').equals(hoy).toArray()
    const pedidos = await db.pedidos.where('jornadaFecha').equals(hoy).toArray()
    const partidas = await db.partidasBillar.where('jornadaFecha').equals(hoy).toArray()

    const cuentasPagadas = cuentas.filter((c: any) => c.estado === 'PAGADA')
    const cuentasAbiertas = cuentas.filter((c: any) => c.estado === 'ABIERTA')
    const partidasFinalizadas = partidas.filter((p: any) => p.estado === 'FINALIZADA')

    const totalVentas = cuentasPagadas.reduce((s: number, c: any) => s + (c.total || 0) - (c.descuentoPromo || 0), 0)
    const totalBillar = partidasFinalizadas.reduce((s: number, p: any) => s + (p.total || 0), 0)

    const mesasAtendidas = new Set(cuentas.map((c: any) => c.mesaId)).size

    // Check if jornada was already closed today
    const jornadaCerrada = await db.jornadasDiarias.where('fecha').equals(hoy).first()

    setResumen({
      fecha: hoy,
      totalVentas,
      totalBillar,
      totalGeneral: totalVentas + totalBillar,
      cuentasCerradas: cuentasPagadas.length,
      cuentasAbiertas: cuentasAbiertas.length,
      ticketsTotales: pedidos.length,
      mesasAtendidas,
      partidasBillar: partidasFinalizadas.length,
      jornadaCerrada: !!jornadaCerrada,
    })
  }, [])

  const fetchHistorial = useCallback(async () => {
    const data = await db.jornadasDiarias.orderBy('fecha').reverse().toArray()
    setHistorial(data.map((j: any) => ({ ...j, id: String(j.id) })) as ResumenJornada[])
  }, [])

  const cerrarJornada = useCallback(async (): Promise<ResumenJornada | null> => {
    setLoading(true)
    try {
      const hoy = getHoy()

      // Check if already closed
      const existing = await db.jornadasDiarias.where('fecha').equals(hoy).first()
      if (existing) throw new Error('La jornada de hoy ya fue cerrada')

      const cuentas = await db.cuentas.where('jornadaFecha').equals(hoy).toArray()
      const pedidos = await db.pedidos.where('jornadaFecha').equals(hoy).toArray()
      const partidas = await db.partidasBillar.where('jornadaFecha').equals(hoy).toArray()

      const cuentasPagadas = cuentas.filter((c: any) => c.estado === 'PAGADA')
      const partidasFinalizadas = partidas.filter((p: any) => p.estado === 'FINALIZADA')

      const totalVentas = cuentasPagadas.reduce((s: number, c: any) => s + (c.total || 0) - (c.descuentoPromo || 0), 0)
      const totalBillar = partidasFinalizadas.reduce((s: number, p: any) => s + (p.total || 0), 0)
      const mesasAtendidas = new Set(cuentas.map((c: any) => c.mesaId)).size

      const resumenJornada = {
        fecha: hoy,
        totalVentas,
        totalBillar,
        totalGeneral: totalVentas + totalBillar,
        cuentasCerradas: cuentasPagadas.length,
        ticketsTotales: pedidos.length,
        mesasAtendidas,
        partidasBillar: partidasFinalizadas.length,
        cerradoEn: new Date().toISOString(),
      }

      const id = await db.jornadasDiarias.add(resumenJornada)

      // Liberar todas las mesas
      const todasMesas = await db.mesas.toArray()
      await Promise.all(todasMesas.map((m: any) =>
        db.mesas.update(m.id, {
          estado: 'LIBRE',
          nombreCliente: undefined,
          meseroId: undefined,
          meseroNombre: undefined,
          meseroColor: undefined,
          meseroAvatar: undefined,
        })
      ))

      await fetchResumen()
      await fetchHistorial()
      return { ...resumenJornada, id: String(id) } as ResumenJornada
    } catch (e) {
      throw e
    } finally {
      setLoading(false)
    }
  }, [fetchResumen, fetchHistorial])

  useEffect(() => {
    fetchResumen()
    fetchHistorial()
  }, [fetchResumen, fetchHistorial])

  return { resumen, historial, cerrarJornada, loading, refetch: fetchResumen }
}
