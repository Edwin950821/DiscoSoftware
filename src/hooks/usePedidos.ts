import { useEffect, useState, useCallback, useRef } from 'react'
import { API_PEDIDOS, apiFetch } from '../lib/config'
import { getSocket } from '../lib/socket'
import { playNotificationSound } from '../lib/sound'
import { sendBrowserNotification, vibrar } from '../lib/notification'
import type { Pedido, CuentaMesa } from '../types'

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [pendientes, setPendientes] = useState<Pedido[]>([])
  const [notificacion, setNotificacion] = useState<Pedido | null>(null)
  const [notifDespachado, setNotifDespachado] = useState<Pedido | null>(null)
  const [notifCuentaPagada, setNotifCuentaPagada] = useState<CuentaMesa | null>(null)
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const despachadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cuentaPagadaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const despachando = useRef<string | null>(null)

  const fetchHoy = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/hoy`)
      if (!res.ok) throw new Error('Error fetching pedidos')
      const data = await res.json()
      setPedidos(data.map((p: any) => ({ ...p, id: String(p.id) })))
    } catch {}
  }, [])

  const fetchPendientes = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/pendientes`)
      if (!res.ok) throw new Error('Error fetching pendientes')
      const data = await res.json()
      setPendientes(data.map((p: any) => ({ ...p, id: String(p.id) })))
    } catch {}
  }, [])

  const refetch = useCallback(() => { fetchHoy(); fetchPendientes() }, [fetchHoy, fetchPendientes])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    let cleanup: (() => void) | null = null
    let retryId: ReturnType<typeof setInterval> | null = null

    const registerListeners = () => {
      const socket = getSocket()
      if (!socket) return false

      const onNuevoPedido = (pedido: any) => {
        const p = { ...pedido, id: String(pedido.id) }
        setPedidos(prev => [p, ...prev])
        setPendientes(prev => [p, ...prev])
        if (notifTimer.current) clearTimeout(notifTimer.current)
        setNotificacion(p)
        playNotificationSound()
        vibrar([300, 100, 300])
        sendBrowserNotification(
          `Nuevo Ticket #${p.ticketDia}`,
          `${p.mesaNombre} - ${p.meseroNombre} - $${Number(p.total || 0).toLocaleString('es-CO')}`,
        )
        notifTimer.current = setTimeout(() => setNotificacion(null), 5000)
      }

      const onPedidoDespachado = (pedido: any) => {
        const p = { ...pedido, id: String(pedido.id) }
        setPedidos(prev => prev.map(x => x.id === p.id ? p : x))
        setPendientes(prev => prev.filter(x => x.id !== p.id))
        if (despachando.current !== p.id) {
          if (despachadoTimer.current) clearTimeout(despachadoTimer.current)
          setNotifDespachado(p)
          despachadoTimer.current = setTimeout(() => setNotifDespachado(null), 8000)
        }
      }

      const onPedidoCancelado = (pedido: any) => {
        const p = { ...pedido, id: String(pedido.id) }
        setPedidos(prev => prev.map(x => x.id === p.id ? p : x))
        setPendientes(prev => prev.filter(x => x.id !== p.id))
      }

      const onCortesiaAplicada = (pedido: any) => {
        const p = { ...pedido, id: String(pedido.id) }
        setPedidos(prev => [p, ...prev])
      }

      const onCortesiaCancelada = (pedido: any) => {
        const p = { ...pedido, id: String(pedido.id) }
        setPedidos(prev => prev.map(x => x.id === p.id ? p : x))
      }

      const onCuentaPagada = (cuenta: any) => {
        if (cuentaPagadaTimer.current) clearTimeout(cuentaPagadaTimer.current)
        setNotifCuentaPagada(cuenta)
        playNotificationSound()
        vibrar([200, 100, 200])
        sendBrowserNotification(
          `Cuenta pagada`,
          `${cuenta.mesaNombre} — ${cuenta.meseroNombre} — $${Number(cuenta.total || 0).toLocaleString('es-CO')}`,
        )
        cuentaPagadaTimer.current = setTimeout(() => setNotifCuentaPagada(null), 8000)
      }

      socket.on('nuevo_pedido', onNuevoPedido)
      socket.on('pedido_despachado', onPedidoDespachado)
      socket.on('pedido_cancelado', onPedidoCancelado)
      socket.on('cortesia_aplicada', onCortesiaAplicada)
      socket.on('cortesia_cancelada', onCortesiaCancelada)
      socket.on('cuenta_pagada', onCuentaPagada)

      cleanup = () => {
        socket.off('nuevo_pedido', onNuevoPedido)
        socket.off('pedido_despachado', onPedidoDespachado)
        socket.off('pedido_cancelado', onPedidoCancelado)
        socket.off('cortesia_aplicada', onCortesiaAplicada)
        socket.off('cortesia_cancelada', onCortesiaCancelada)
        socket.off('cuenta_pagada', onCuentaPagada)
      }
      return true
    }

    if (!registerListeners()) {
      retryId = setInterval(() => {
        if (registerListeners() && retryId) {
          clearInterval(retryId)
          retryId = null
        }
      }, 500)
    }

    return () => {
      if (retryId) clearInterval(retryId)
      if (cleanup) cleanup()
      if (notifTimer.current) clearTimeout(notifTimer.current)
      if (despachadoTimer.current) clearTimeout(despachadoTimer.current)
      if (cuentaPagadaTimer.current) clearTimeout(cuentaPagadaTimer.current)
    }
  }, [])

  const despachar = async (pedidoId: string) => {
    despachando.current = pedidoId
    const res = await apiFetch(`${API_PEDIDOS}/${pedidoId}/despachar`, { method: 'PATCH' })
    if (!res.ok) { despachando.current = null; throw new Error('Error al despachar') }
    const data = await res.json()
    setTimeout(() => { despachando.current = null }, 2000)
    return data
  }

  const cancelar = async (pedidoId: string) => {
    const res = await apiFetch(`${API_PEDIDOS}/${pedidoId}/cancelar`, { method: 'PATCH' })
    if (!res.ok) throw new Error('Error al cancelar')
    return res.json()
  }

  const getCuenta = async (mesaId: string): Promise<CuentaMesa | null> => {
    const res = await apiFetch(`${API_PEDIDOS}/mesas/${mesaId}/cuenta`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.message) return null
    return data
  }

  const pagarCuenta = async (mesaId: string) => {
    const res = await apiFetch(`${API_PEDIDOS}/mesas/${mesaId}/pagar`, { method: 'POST' })
    if (!res.ok) throw new Error('Error al pagar')
    return res.json()
  }

  const aplicarPromos = async (mesaId: string): Promise<CuentaMesa> => {
    const res = await apiFetch(`${API_PEDIDOS}/mesas/${mesaId}/aplicar-promos`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.message || 'Error al aplicar promociones')
    }
    return res.json()
  }

  const atenderMesa = async (mesaId: string, meseroId: string, nombreCliente: string) => {
    const res = await apiFetch(`${API_PEDIDOS}/mesas/${mesaId}/atender`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meseroId, nombreCliente }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.message || 'Error al atender mesa')
    }
    return res.json()
  }

  const editarPedido = async (pedidoId: string, lineas: { productoId: string; cantidad: number }[], nota?: string) => {
    const res = await apiFetch(`${API_PEDIDOS}/${pedidoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas, nota }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.message || 'Error al editar pedido')
    }
    const updated = await res.json()
    const p = { ...updated, id: String(updated.id) }
    setPedidos(prev => prev.map(x => x.id === p.id ? p : x))
    setPendientes(prev => prev.map(x => x.id === p.id ? p : x))
    return p
  }

  const crearPedido = async (mesaId: string, meseroId: string, lineas: { productoId: string; cantidad: number }[], nota?: string) => {
    const res = await apiFetch(`${API_PEDIDOS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaId, meseroId, lineas, nota }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.message || 'Error al crear pedido')
    }
    return res.json()
  }

  return { pedidos, pendientes, notificacion, notifDespachado, notifCuentaPagada, despachar, cancelar, editarPedido, getCuenta, pagarCuenta, aplicarPromos, atenderMesa, crearPedido, refetch }
}
