import { useEffect, useState, useCallback, useRef } from 'react'
import { db, getHoy } from '../lib/db'
import type { Pedido, CuentaMesa } from '../types'

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [pendientes, setPendientes] = useState<Pedido[]>([])
  const [notificacion, setNotificacion] = useState<Pedido | null>(null)
  const [notifDespachado, setNotifDespachado] = useState<Pedido | null>(null)
  const [notifCuentaPagada, setNotifCuentaPagada] = useState<CuentaMesa | null>(null)
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const despachadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchHoy = useCallback(async () => {
    const hoy = getHoy()
    const data = await db.pedidos.where('jornadaFecha').equals(hoy).toArray()
    const mapped = data.map((p: any) => ({ ...p, id: String(p.id) })).reverse()
    setPedidos(mapped)
    setPendientes(mapped.filter((p: Pedido) => p.estado === 'PENDIENTE'))
  }, [])

  const refetch = useCallback(() => { fetchHoy() }, [fetchHoy])

  useEffect(() => { refetch() }, [refetch])

  const crearPedido = async (mesaId: string, meseroId: string, lineas: { productoId: string; cantidad: number }[], nota?: string) => {
    const hoy = getHoy()
    const mesa = await db.mesas.get(Number(mesaId))
    const mesero = await db.trabajadores.get(Number(meseroId))
    if (!mesa || !mesero) throw new Error('Mesa o mesero no encontrado')

    // Calcular ticketDia
    const todayPedidos = await db.pedidos.where('jornadaFecha').equals(hoy).count()
    const ticketDia = todayPedidos + 1

    // Resolver productos
    const lineasCompletas = await Promise.all(lineas.map(async l => {
      const prod = await db.productos.get(Number(l.productoId))
      return {
        id: String(Date.now() + Math.random()),
        productoId: l.productoId,
        nombre: prod?.nombre || '',
        precioUnitario: prod?.precio || 0,
        cantidad: l.cantidad,
        total: (prod?.precio || 0) * l.cantidad,
      }
    }))

    const total = lineasCompletas.reduce((s, l) => s + l.total, 0)
    const now = new Date().toISOString()

    const pedido = {
      mesaId: mesaId,
      mesaNumero: mesa.numero,
      mesaNombre: mesa.nombre,
      meseroId: meseroId,
      meseroNombre: mesero.nombre,
      meseroColor: mesero.color,
      meseroAvatar: mesero.avatar,
      ticketDia,
      estado: 'PENDIENTE',
      total,
      jornadaFecha: hoy,
      nota: nota || undefined,
      esCortesia: false,
      lineas: lineasCompletas,
      creadoEn: now,
    }

    const id = await db.pedidos.add(pedido)

    // Asegurar que la mesa esté OCUPADA
    await db.mesas.update(Number(mesaId), {
      estado: 'OCUPADA',
      meseroId: meseroId,
      meseroNombre: mesero.nombre,
      meseroColor: mesero.color,
      meseroAvatar: mesero.avatar,
    })

    // Crear o actualizar cuenta
    let cuenta = await db.cuentas.where({ mesaId, jornadaFecha: hoy, estado: 'ABIERTA' }).first()
    if (!cuenta) {
      await db.cuentas.add({
        mesaId,
        mesaNumero: mesa.numero,
        mesaNombre: mesa.nombre,
        nombreCliente: mesa.nombreCliente || '',
        meseroId,
        meseroNombre: mesero.nombre,
        meseroColor: mesero.color,
        meseroAvatar: mesero.avatar,
        jornadaFecha: hoy,
        total: total,
        estado: 'ABIERTA',
        pedidos: [],
        creadoEn: now,
      })
    } else {
      // Actualizar total de la cuenta
      const cuentaPedidos = await db.pedidos.where({ mesaId, jornadaFecha: hoy }).toArray()
      const cuentaTotal = cuentaPedidos
        .filter((p: any) => p.estado !== 'CANCELADO')
        .reduce((s: number, p: any) => s + (p.total || 0), 0)
      await db.cuentas.update(cuenta.id, { total: cuentaTotal })
    }

    await fetchHoy()
    return { ...pedido, id: String(id) }
  }

  const despachar = async (pedidoId: string) => {
    const now = new Date().toISOString()
    await db.pedidos.update(Number(pedidoId), { estado: 'DESPACHADO', despachadoEn: now })
    const pedido = await db.pedidos.get(Number(pedidoId))
    const p = { ...pedido, id: pedidoId }

    if (despachadoTimer.current) clearTimeout(despachadoTimer.current)
    setNotifDespachado(p as Pedido)
    despachadoTimer.current = setTimeout(() => setNotifDespachado(null), 8000)

    await fetchHoy()
    return p
  }

  const cancelar = async (pedidoId: string) => {
    await db.pedidos.update(Number(pedidoId), { estado: 'CANCELADO' })
    const pedido = await db.pedidos.get(Number(pedidoId))

    // Recalcular total cuenta
    if (pedido) {
      const cuenta = await db.cuentas.where({ mesaId: pedido.mesaId, jornadaFecha: pedido.jornadaFecha, estado: 'ABIERTA' }).first()
      if (cuenta) {
        const cuentaPedidos = await db.pedidos.where({ mesaId: pedido.mesaId, jornadaFecha: pedido.jornadaFecha }).toArray()
        const cuentaTotal = cuentaPedidos
          .filter((p: any) => p.estado !== 'CANCELADO')
          .reduce((s: number, p: any) => s + (p.total || 0), 0)
        await db.cuentas.update(cuenta.id, { total: cuentaTotal })
      }
    }

    await fetchHoy()
    return { ...pedido, id: pedidoId }
  }

  const editarPedido = async (pedidoId: string, lineas: { productoId: string; cantidad: number }[], nota?: string) => {
    const lineasCompletas = await Promise.all(lineas.map(async l => {
      const prod = await db.productos.get(Number(l.productoId))
      return {
        id: String(Date.now() + Math.random()),
        productoId: l.productoId,
        nombre: prod?.nombre || '',
        precioUnitario: prod?.precio || 0,
        cantidad: l.cantidad,
        total: (prod?.precio || 0) * l.cantidad,
      }
    }))

    const total = lineasCompletas.reduce((s, l) => s + l.total, 0)
    await db.pedidos.update(Number(pedidoId), { lineas: lineasCompletas, total, nota })

    const pedido = await db.pedidos.get(Number(pedidoId))

    // Recalcular total cuenta
    if (pedido) {
      const cuenta = await db.cuentas.where({ mesaId: pedido.mesaId, jornadaFecha: pedido.jornadaFecha, estado: 'ABIERTA' }).first()
      if (cuenta) {
        const cuentaPedidos = await db.pedidos.where({ mesaId: pedido.mesaId, jornadaFecha: pedido.jornadaFecha }).toArray()
        const cuentaTotal = cuentaPedidos
          .filter((p: any) => p.estado !== 'CANCELADO')
          .reduce((s: number, p: any) => s + (p.total || 0), 0)
        await db.cuentas.update(cuenta.id, { total: cuentaTotal })
      }
    }

    const p = { ...pedido, id: pedidoId }
    setPedidos(prev => prev.map(x => x.id === pedidoId ? p as Pedido : x))
    setPendientes(prev => prev.map(x => x.id === pedidoId ? p as Pedido : x))
    return p
  }

  const getCuenta = async (mesaId: string): Promise<CuentaMesa | null> => {
    const hoy = getHoy()
    const cuenta = await db.cuentas.where({ mesaId, jornadaFecha: hoy, estado: 'ABIERTA' }).first()
    if (!cuenta) return null

    const pedidosList = await db.pedidos.where({ mesaId, jornadaFecha: hoy }).toArray()
    const activePedidos = pedidosList
      .filter((p: any) => p.estado !== 'CANCELADO')
      .map((p: any) => ({ ...p, id: String(p.id) }))

    const total = activePedidos.reduce((s: number, p: any) => s + (p.total || 0), 0)

    return {
      ...cuenta,
      id: String(cuenta.id),
      total,
      pedidos: activePedidos,
    } as CuentaMesa
  }

  const pagarCuenta = async (mesaId: string) => {
    const hoy = getHoy()
    const cuenta = await db.cuentas.where({ mesaId, jornadaFecha: hoy, estado: 'ABIERTA' }).first()
    if (!cuenta) throw new Error('No hay cuenta abierta')

    await db.cuentas.update(cuenta.id, { estado: 'PAGADA' })

    // Liberar mesa
    await db.mesas.update(Number(mesaId), {
      estado: 'LIBRE',
      nombreCliente: undefined,
      meseroId: undefined,
      meseroNombre: undefined,
      meseroColor: undefined,
      meseroAvatar: undefined,
    })

    await fetchHoy()
    return { ...cuenta, estado: 'PAGADA', id: String(cuenta.id) }
  }

  const aplicarPromos = async (mesaId: string): Promise<CuentaMesa> => {
    const hoy = getHoy()
    const cuenta = await db.cuentas.where({ mesaId, jornadaFecha: hoy, estado: 'ABIERTA' }).first()
    if (!cuenta) throw new Error('No hay cuenta abierta')

    const pedidosList = await db.pedidos.where({ mesaId, jornadaFecha: hoy }).toArray()
    const activePedidos = pedidosList.filter((p: any) => p.estado !== 'CANCELADO' && !p.esCortesia)

    // Obtener promociones activas
    const promos = (await db.promociones.toArray()).filter((p: any) => p.activa)

    let descuentoTotal = 0

    for (const promo of promos) {
      // Contar productos de compra en los pedidos
      let cantidadCompra = 0
      for (const pedido of activePedidos) {
        for (const linea of (pedido.lineas || [])) {
          if ((promo.compraProductoIds || []).includes(String(linea.productoId))) {
            cantidadCompra += linea.cantidad
          }
        }
      }

      const vecesAplica = Math.floor(cantidadCompra / promo.compraCantidad)
      if (vecesAplica > 0) {
        const regalos = vecesAplica * promo.regaloCantidad
        descuentoTotal += regalos * (promo.regaloProductoPrecio || 0)

        // Crear pedido cortesia
        const mesa = await db.mesas.get(Number(mesaId))
        const ticketCount = await db.pedidos.where('jornadaFecha').equals(hoy).count()

        await db.pedidos.add({
          mesaId,
          mesaNumero: mesa?.numero || 0,
          mesaNombre: mesa?.nombre || '',
          meseroId: cuenta.meseroId,
          meseroNombre: cuenta.meseroNombre,
          meseroColor: cuenta.meseroColor,
          meseroAvatar: cuenta.meseroAvatar,
          ticketDia: ticketCount + 1,
          estado: 'DESPACHADO',
          total: 0,
          jornadaFecha: hoy,
          esCortesia: true,
          promoNombre: promo.nombre,
          lineas: [{
            id: String(Date.now()),
            productoId: promo.regaloProductoId,
            nombre: promo.regaloProductoNombre,
            precioUnitario: 0,
            cantidad: regalos,
            total: 0,
          }],
          creadoEn: new Date().toISOString(),
        })
      }
    }

    if (descuentoTotal > 0) {
      await db.cuentas.update(cuenta.id, {
        descuentoPromo: descuentoTotal,
        totalConDescuento: (cuenta.total || 0) - descuentoTotal,
      })
    }

    await fetchHoy()
    const updated = await getCuenta(mesaId)
    return updated as CuentaMesa
  }

  const atenderMesa = async (mesaId: string, meseroId: string, nombreCliente: string) => {
    const mesero = await db.trabajadores.get(Number(meseroId))
    if (!mesero) throw new Error('Mesero no encontrado')

    await db.mesas.update(Number(mesaId), {
      estado: 'OCUPADA',
      nombreCliente,
      meseroId: meseroId,
      meseroNombre: mesero.nombre,
      meseroColor: mesero.color,
      meseroAvatar: mesero.avatar,
    })

    // Crear cuenta
    const hoy = getHoy()
    const mesa = await db.mesas.get(Number(mesaId))
    const existing = await db.cuentas.where({ mesaId, jornadaFecha: hoy, estado: 'ABIERTA' }).first()
    if (!existing) {
      await db.cuentas.add({
        mesaId,
        mesaNumero: mesa?.numero || 0,
        mesaNombre: mesa?.nombre || '',
        nombreCliente,
        meseroId,
        meseroNombre: mesero.nombre,
        meseroColor: mesero.color,
        meseroAvatar: mesero.avatar,
        jornadaFecha: hoy,
        total: 0,
        estado: 'ABIERTA',
        pedidos: [],
        creadoEn: new Date().toISOString(),
      })
    }

    return { ...mesa, id: mesaId }
  }

  return {
    pedidos, pendientes, notificacion, notifDespachado, notifCuentaPagada,
    despachar, cancelar, editarPedido, getCuenta, pagarCuenta,
    aplicarPromos, atenderMesa, crearPedido, refetch,
  }
}
