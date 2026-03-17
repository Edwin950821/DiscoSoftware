import { useEffect, useState, useCallback } from 'react'
import { API_PEDIDOS, apiFetch } from '../lib/config'
import { getSocket } from '../lib/socket'
import type { CuentaMesa } from '../types'

export function useVentas() {
  const [cuentas, setCuentas] = useState<CuentaMesa[]>([])

  const fetchCuentas = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/cuentas/hoy`)
      if (!res.ok) throw new Error('Error fetching cuentas')
      const data = await res.json()
      setCuentas(data.map((c: any) => ({
        ...c,
        id: String(c.id),
        pedidos: (c.pedidos || []).map((p: any) => ({ ...p, id: String(p.id) })),
      })))
    } catch {}
  }, [])

  useEffect(() => { fetchCuentas() }, [fetchCuentas])

  useEffect(() => {
    let cleanup: (() => void) | null = null
    let retryId: ReturnType<typeof setInterval> | null = null

    const register = () => {
      const socket = getSocket()
      if (!socket) return false

      const onCuentaPagada = () => { fetchCuentas() }
      socket.on('cuenta_pagada', onCuentaPagada)

      cleanup = () => { socket.off('cuenta_pagada', onCuentaPagada) }
      return true
    }

    if (!register()) {
      retryId = setInterval(() => {
        if (register() && retryId) { clearInterval(retryId); retryId = null }
      }, 500)
    }

    return () => {
      if (retryId) clearInterval(retryId)
      if (cleanup) cleanup()
    }
  }, [fetchCuentas])

  const ventasPagadas = cuentas.filter(c => c.estado === 'PAGADA')
  const ventasAbiertas = cuentas.filter(c => c.estado === 'ABIERTA')

  const totalVentas = ventasPagadas.reduce((s, c) => s + c.total - (c.descuentoPromo || 0), 0)

  return { cuentas, ventasPagadas, ventasAbiertas, totalVentas, refetch: fetchCuentas }
}
