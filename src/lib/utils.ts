import type { JornadaInput, MedioPago } from '../types'

const MEDIOS: MedioPago[] = ['Efectivo', 'Transferencias', 'Vales']

export const fmtCOP = (n: number): string => {
  if (!n && n !== 0) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export const fmtFull = (n: number): string =>
  '$' + Number(n || 0).toLocaleString('es-CO')

export function calcularCuadre(jornada: JornadaInput) {
  const totalVendido = jornada.meseros.reduce((s, m) => s + m.totalMesero, 0)
  const cortesias = jornada.meseros.reduce((s, m) => s + m.cortesias, 0)
  const gastos = jornada.meseros.reduce((s, m) => s + m.gastos, 0)

  const pagos = {} as Record<MedioPago, number>
  for (const medio of MEDIOS) {
    pagos[medio] = jornada.meseros.reduce((s, m) => s + (m.pagos?.[medio] || 0), 0)
  }

  const totalRecibido = MEDIOS.reduce((s, m) => s + pagos[m], 0)
  const esperado = totalVendido - cortesias - gastos
  const saldo = totalRecibido - esperado

  return { totalVendido, totalRecibido, saldo, pagos, cortesias, gastos }
}
