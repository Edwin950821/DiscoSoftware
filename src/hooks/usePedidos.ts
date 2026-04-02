import { useEffect, useState, useCallback, useRef } from 'react'
import { API_PEDIDOS, apiFetch } from '../lib/config'
import type { Pedido, CuentaMesa } from '../types'

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [pendientes, setPendientes] = useState<Pedido[]>([])
  const [notificacion, setNotificacion] = useState<Pedido | null>(null)
  const [notifDespachado, setNotifDespachado] = useState<Pedido | null>(null)
  const [notifCuentaPagada, setNotifCuentaPagada] = useState<CuentaMesa | null>(null)
  const despachadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mapPedido = (p: any): Pedido => ({
    id: String(p.id), mesaId: String(p.mesaId), mesaNumero: p.mesaNumero, mesaNombre: p.mesaNombre,
    meseroId: String(p.meseroId), meseroNombre: p.meseroNombre, meseroColor: p.meseroColor,
    meseroAvatar: p.meseroAvatar, ticketDia: p.ticketDia, estado: p.estado, total: p.total,
    jornadaFecha: p.jornadaFecha, nota: p.nota || undefined, esCortesia: p.esCortesia || false,
    lineas: (p.lineas || []).map((l: any) => ({
      id: String(l.id), productoId: String(l.productoId), nombre: l.nombre,
      precioUnitario: l.precioUnitario, cantidad: l.cantidad, total: l.total,
    })),
    creadoEn: p.creadoEn, despachadoEn: p.despachadoEn || undefined,
  })

  const fetchHoy = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/hoy`)
      if (!res.ok) return
      const data = await res.json()
      const mapped = data.map(mapPedido)
      setPedidos(mapped)
      setPendientes(mapped.filter((p: Pedido) => p.estado === 'PENDIENTE'))
    } catch { /* offline */ }
  }, [])

  const refetch = useCallback(() => { fetchHoy() }, [fetchHoy])
  useEffect(() => { refetch() }, [refetch])

  const crearPedido = async (mesaId: string, meseroId: string, lineas: { productoId: string; cantidad: number }[], nota?: string) => {
    const res = await apiFetch(`${API_PEDIDOS}`, {
      method: 'POST', body: JSON.stringify({ mesaId, meseroId, lineas, nota }),
    })
    if (!res.ok) throw new Error('Error al crear pedido')
    const pedido = mapPedido(await res.json())
    setNotificacion(pedido)
    setTimeout(() => setNotificacion(null), 5000)
    await fetchHoy()
    return pedido
  }

  const despachar = async (pedidoId: string) => {
    const res = await apiFetch(`${API_PEDIDOS}/${pedidoId}/despachar`, { method: 'PATCH' })
    if (!res.ok) throw new Error('Error al despachar')
    const pedido = mapPedido(await res.json())
    if (despachadoTimer.current) clearTimeout(despachadoTimer.current)
    setNotifDespachado(pedido)
    despachadoTimer.current = setTimeout(() => setNotifDespachado(null), 8000)
    await fetchHoy()
    return pedido
  }

  const cancelar = async (pedidoId: string) => {
    const res = await apiFetch(`${API_PEDIDOS}/${pedidoId}/cancelar`, { method: 'PATCH' })
    if (!res.ok) throw new Error('Error al cancelar')
    await fetchHoy()
    return mapPedido(await res.json())
  }

  const editarPedido = async (pedidoId: string, lineas: { productoId: string; cantidad: number }[], nota?: string) => {
    const actual = pedidos.find(p => p.id === pedidoId)
    const res = await apiFetch(`${API_PEDIDOS}/${pedidoId}`, {
      method: 'PUT', body: JSON.stringify({ mesaId: actual?.mesaId, meseroId: actual?.meseroId, lineas, nota }),
    })
    if (!res.ok) throw new Error('Error al editar')
    const pedido = mapPedido(await res.json())
    setPedidos(prev => prev.map(x => x.id === pedidoId ? pedido : x))
    setPendientes(prev => prev.map(x => x.id === pedidoId ? pedido : x))
    return pedido
  }

  const getCuenta = async (mesaId: string): Promise<CuentaMesa | null> => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/mesas/${mesaId}/cuenta`)
      if (!res.ok) return null
      const d = await res.json()
      return { id: String(d.id), mesaId: String(d.mesaId), mesaNumero: d.mesaNumero, mesaNombre: d.mesaNombre,
        nombreCliente: d.nombreCliente, meseroId: String(d.meseroId), meseroNombre: d.meseroNombre,
        meseroColor: d.meseroColor, meseroAvatar: d.meseroAvatar, jornadaFecha: d.jornadaFecha,
        total: d.total, estado: d.estado, pedidos: (d.pedidos || []).map(mapPedido), creadoEn: d.creadoEn,
      } as CuentaMesa
    } catch { return null }
  }

  const pagarCuenta = async (mesaId: string) => {
    const res = await apiFetch(`${API_PEDIDOS}/mesas/${mesaId}/pagar`, { method: 'POST' })
    if (!res.ok) throw new Error('Error al pagar')
    const data = await res.json()
    setNotifCuentaPagada(data as CuentaMesa)
    setTimeout(() => setNotifCuentaPagada(null), 5000)
    await fetchHoy()
    return data
  }

  const atenderMesa = async (mesaId: string, meseroId: string, nombreCliente: string) => {
    const res = await apiFetch(`${API_PEDIDOS}/mesas/${mesaId}/atender`, {
      method: 'POST', body: JSON.stringify({ meseroId, nombreCliente }),
    })
    if (!res.ok) throw new Error('Error al atender mesa')
    return await res.json()
  }

  const aplicarPromos = async (mesaId: string): Promise<CuentaMesa> => {
    const cuenta = await getCuenta(mesaId)
    if (!cuenta) throw new Error('No hay cuenta abierta')
    return cuenta
  }

  return {
    pedidos, pendientes, notificacion, notifDespachado, notifCuentaPagada,
    despachar, cancelar, editarPedido, getCuenta, pagarCuenta,
    aplicarPromos, atenderMesa, crearPedido, refetch,
  }
}
