import type { LiquidacionTrabajador } from '../types'

export const fmtCOP = (n: number): string => {
  if (!n && n !== 0) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export const fmtFull = (n: number): string =>
  '$' + Number(n || 0).toLocaleString('es-CO')

/** Calcula totales derivados de una liquidacion de trabajador */
export function calcularLiquidacion(liq: LiquidacionTrabajador) {
  const lineas = liq.lineas || []
  const transacciones = liq.transacciones || []
  const vales = liq.vales || []
  const cortesias = liq.cortesias || []
  const gastos = liq.gastos || []

  const totalVentaLineas = lineas.reduce((s, l) => s + l.total, 0)
  const totalVenta = totalVentaLineas > 0 ? totalVentaLineas : (liq.totalVenta || 0)
  const totalDatafono = transacciones.filter(t => t.tipo === 'Datafono').reduce((s, t) => s + t.monto, 0)
  const totalQR = transacciones.filter(t => t.tipo === 'QR').reduce((s, t) => s + t.monto, 0)
  const totalNequi = transacciones.filter(t => t.tipo === 'Nequi').reduce((s, t) => s + t.monto, 0)
  const totalVales = vales.reduce((s, v) => s + v.monto, 0)
  const totalCortesias = cortesias.reduce((s, c) => s + c.monto, 0)
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)

  const esperado = totalVenta - totalCortesias - totalGastos
  const totalRecibido = liq.efectivoEntregado + totalDatafono + totalQR + totalNequi + totalVales
  const saldo = totalRecibido - esperado

  return {
    totalVenta, totalDatafono, totalQR, totalNequi, totalVales,
    totalCortesias, totalGastos, esperado, totalRecibido, saldo
  }
}

/** Calcula cuadre agregado del dia (todas las liquidaciones) */
export function calcularCuadreDia(liquidaciones: LiquidacionTrabajador[]) {
  let totalVendido = 0, totalCortesias = 0, totalGastos = 0
  let totalDatafono = 0, totalQR = 0, totalNequi = 0, totalVales = 0, totalEfectivo = 0

  for (const liq of liquidaciones) {
    const c = calcularLiquidacion(liq)
    totalVendido += c.totalVenta
    totalCortesias += c.totalCortesias
    totalGastos += c.totalGastos
    totalDatafono += c.totalDatafono
    totalQR += c.totalQR
    totalNequi += c.totalNequi
    totalVales += c.totalVales
    totalEfectivo += liq.efectivoEntregado
  }

  const esperado = totalVendido - totalCortesias - totalGastos
  const totalRecibido = totalEfectivo + totalDatafono + totalQR + totalNequi + totalVales
  const saldo = totalRecibido - esperado

  return {
    totalVendido, totalRecibido, saldo,
    totalCortesias, totalGastos,
    pagos: {
      Efectivo: totalEfectivo,
      Datafono: totalDatafono,
      QR: totalQR,
      Nequi: totalNequi,
      Vales: totalVales,
    }
  }
}
