import { useEffect, useState, useCallback } from 'react'
import { db, getHoy } from '../lib/db'
import type { CuentaMesa } from '../types'

export function useVentas() {
  const [cuentas, setCuentas] = useState<CuentaMesa[]>([])

  const fetchCuentas = useCallback(async () => {
    const hoy = getHoy()
    const data = await db.cuentas.where('jornadaFecha').equals(hoy).toArray()
    const enriched = await Promise.all(data.map(async (c: any) => {
      const pedidosList = await db.pedidos.where({ mesaId: c.mesaId, jornadaFecha: hoy }).toArray()
      const activePedidos = pedidosList
        .filter((p: any) => p.estado !== 'CANCELADO')
        .map((p: any) => ({ ...p, id: String(p.id) }))
      const total = activePedidos.reduce((s: number, p: any) => s + (p.total || 0), 0)
      return {
        ...c,
        id: String(c.id),
        total,
        pedidos: activePedidos,
      }
    }))

    setCuentas(enriched as CuentaMesa[])
  }, [])

  useEffect(() => { fetchCuentas() }, [fetchCuentas])

  const ventasPagadas = cuentas.filter(c => c.estado === 'PAGADA')
  const ventasAbiertas = cuentas.filter(c => c.estado === 'ABIERTA')
  const totalVentas = ventasPagadas.reduce((s, c) => s + c.total - (c.descuentoPromo || 0), 0)

  return { cuentas, ventasPagadas, ventasAbiertas, totalVentas, refetch: fetchCuentas }
}
