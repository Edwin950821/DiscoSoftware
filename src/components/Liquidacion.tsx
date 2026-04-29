import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type {
  Producto, Trabajador, Jornada, LiquidacionTrabajador, TipoPago,
  Inventario as InventarioType, LineaInventario, InventarioInput,
  Comparativo as ComparativoType, LineaComparativo, ComparativoInput,
  Pedido, CuentaMesa,
} from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Input } from './ui/Input'
import ImportarInventarioExcel from './ImportarInventarioExcel'
import ImportarLiquidacionExcel from './ImportarLiquidacionExcel'
import ImportarComparativoExcel from './ImportarComparativoExcel'
import { DateRangeFilter } from './ui/DateRangeFilter'
import { fmtFull, fmtCOP, calcularLiquidacion, calcularCuadreDia } from '../lib/utils'
import { API_PEDIDOS, apiFetch } from '../lib/config'

const TIPOS_PAGO: TipoPago[] = ['Datafono', 'QR', 'Nequi']

/** Navegar entre filas con flechas ↑↓ como Excel (y evitar que cambien el número) */
const handleTableArrowNav = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  e.preventDefault()
  e.stopPropagation()
  const input = e.currentTarget
  const td = input.closest('td')
  if (!td) return
  const tr = td.closest('tr')
  if (!tr) return
  const colIdx = Array.from(tr.children).indexOf(td)
  const tbody = tr.closest('tbody')
  if (!tbody) return
  const rows = Array.from(tbody.rows)
  const rowIdx = rows.indexOf(tr as HTMLTableRowElement)
  const nextIdx = e.key === 'ArrowUp' ? rowIdx - 1 : rowIdx + 1
  if (nextIdx < 0 || nextIdx >= rows.length) return
  const targetInput = rows[nextIdx].children[colIdx]?.querySelector('input') as HTMLInputElement | null
  if (targetInput) {
    targetInput.focus()
    targetInput.select()
  }
}
const COLORES_PAGO: Record<string, string> = { Efectivo: '#CDA52F', Datafono: '#A8E6CF', QR: '#4ECDC4', Nequi: '#FFE66D', Vales: '#C3B1E1' }
const COLORES_TRABAJADOR = ['#CDA52F', '#4ECDC4', '#FFE66D', '#A8E6CF', '#C3B1E1', '#FF8FA3', '#98D8C8', '#FFB347']

function formatMoney(n: number): string {
  if (!n) return ''
  return n.toLocaleString('es-CO')
}

const printLogoUrl = `${window.location.origin}/assets/M05.png`

function printHTML(title: string, body: string) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(`<html><head><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; padding: 28px 32px; color: #1a1a1a; background: #fff; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #CDA52F; }
  .header img { width: 56px; height: 56px; object-fit: contain; }
  .header-text h1 { font-size: 18px; color: #1a1a1a; font-weight: 700; margin-bottom: 2px; }
  .header-text h1 span { color: #CDA52F; }
  .header-text .sub { font-size: 10px; color: #888; }
  h2 { font-size: 11px; margin: 18px 0 8px; color: #CDA52F; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; border-bottom: 1px solid #e8d9a8; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th, td { padding: 6px 10px; text-align: right; }
  th { font-size: 9px; color: #997a1e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #CDA52F; background: #fdf8eb; }
  td { border-bottom: 1px solid #f0ece0; color: #333; }
  td:first-child, th:first-child { text-align: left; }
  tr:nth-child(even) td { background: #fdfcf8; }
  .bold { font-weight: 700; color: #1a1a1a; }
  .gold { color: #997a1e; font-weight: 700; }
  .total-row td { border-top: 2px solid #CDA52F; font-weight: 700; font-size: 12px; padding-top: 8px; color: #997a1e; background: #fdf8eb !important; }
  .saldo-row td { border-top: 3px solid #CDA52F; font-weight: 700; font-size: 13px; padding-top: 10px; background: #fdf8eb !important; }
  .green { color: #0a7a5a; }
  .red { color: #c62828; }
  .blue { color: #1565c0; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 2px solid #CDA52F; text-align: center; font-size: 9px; color: #aaa; }
  .footer span { color: #CDA52F; font-weight: 600; }
  @media print { body { padding: 16px 20px; } @page { margin: 10mm; } }
</style></head><body>
${body}
<div class="footer"><span>Monastery Club</span> · Baranoa, Colombia · Sistema de Gestion</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
</body></html>`)
  w.document.close()
}

function saldoColor(v: number) { return v === 0 ? 'blue' : v > 0 ? 'green' : 'red' }

function printJornada(j: Jornada) {
  const esperado = j.totalVendido - j.cortesias - j.gastos
  let body = `<div class="header"><img src="${printLogoUrl}" alt="Monastery Club" /><div class="header-text"><h1>Liquidacion Diaria — <span>${j.sesion}</span></h1><p class="sub">${j.fecha}</p></div></div>`

  body += '<h2>Meseros</h2><table><thead><tr><th>Nombre</th><th>Venta</th><th>Efectivo</th><th>Datafono</th><th>QR</th><th>Nequi</th><th>Vales</th><th>Cortesias</th><th>Gastos</th><th>Saldo</th></tr></thead><tbody>'
  for (const liq of j.liquidaciones || []) {
    const c = calcularLiquidacion(liq)
    body += `<tr>
      <td>${liq.nombre}</td><td class="gold">${fmtFull(c.totalVenta)}</td>
      <td>${fmtFull(liq.efectivoEntregado ?? c.efectivo)}</td>
      <td>${c.totalDatafono ? fmtFull(c.totalDatafono) : '-'}</td>
      <td>${c.totalQR ? fmtFull(c.totalQR) : '-'}</td>
      <td>${c.totalNequi ? fmtFull(c.totalNequi) : '-'}</td>
      <td>${c.totalVales ? fmtFull(c.totalVales) : '-'}</td>
      <td>${c.totalCortesias ? fmtFull(c.totalCortesias) : '-'}</td>
      <td>${c.totalGastos ? fmtFull(c.totalGastos) : '-'}</td>
      <td class="${saldoColor(c.saldo)} bold">${fmtFull(c.saldo)}</td>
    </tr>`
  }
  body += '</tbody></table>'

  body += '<h2>Cuadre de Caja</h2><table>'
  body += `<tr><td>Total Vendido</td><td class="gold">${fmtFull(j.totalVendido)}</td></tr>`
  body += `<tr><td>(-) Cortesias</td><td>${j.cortesias ? fmtFull(j.cortesias) : '-'}</td></tr>`
  body += `<tr><td>(-) Gastos</td><td>${j.gastos ? fmtFull(j.gastos) : '-'}</td></tr>`
  body += `<tr class="total-row"><td>Esperado</td><td>${fmtFull(esperado)}</td></tr>`
  body += `<tr><td>Total Recibido</td><td class="bold">${fmtFull(j.totalRecibido)}</td></tr>`
  body += `<tr class="saldo-row"><td>SALDO</td><td class="${saldoColor(j.saldo)}">${fmtFull(j.saldo)}</td></tr>`
  body += '</table>'

  printHTML(`Liquidacion ${j.sesion}`, body)
}

function printSemanal(jornadasVisibles: Jornada[], d: ReturnType<typeof calcSemanaData>) {
  const f0 = jornadasVisibles[0]?.fecha || ''
  const fN = jornadasVisibles[jornadasVisibles.length - 1]?.fecha || ''
  let body = `<div class="header"><img src="${printLogoUrl}" alt="Monastery Club" /><div class="header-text"><h1>Liquidacion <span>Semanal</span></h1><p class="sub">${f0} al ${fN} · ${jornadasVisibles.length} jornadas</p></div></div>`

  const cols = jornadasVisibles.map(j => `<th>${j.sesion}<br/><span style="font-weight:normal;font-size:9px">${j.fecha}</span></th>`).join('')
  const hasTotal = jornadasVisibles.length > 1

  body += '<h2>Meseros</h2><table><thead><tr><th>Nombre</th>' + cols + (hasTotal ? '<th>Liq. Semana</th>' : '') + '</tr></thead><tbody>'
  for (const t of d.trabajadores) {
    body += `<tr><td>${t.nombre}</td>`
    for (const v of t.totales) body += `<td>${v > 0 ? fmtCOP(v) : '-'}</td>`
    if (hasTotal) body += `<td class="bold">${fmtCOP(t.totales.reduce((a, v) => a + v, 0))}</td>`
    body += '</tr>'
  }
  body += `<tr class="total-row"><td>Venta Total</td>`
  for (const r of d.resumen) body += `<td>${fmtCOP(r.ventaTotal)}</td>`
  if (hasTotal) body += `<td>${fmtCOP(d.tot.ventaTotal)}</td>`
  body += '</tr></tbody></table>'

  body += '<h2>Medios de Pago & Deducciones</h2><table><thead><tr><th></th>' + cols + (hasTotal ? '<th>Total</th>' : '') + '</tr></thead><tbody>'
  const filas = [
    { key: 'gastos', label: 'Gastos' }, { key: 'datafono', label: 'Datafono' },
    { key: 'qr', label: 'QR' }, { key: 'nequi', label: 'Nequi' },
    { key: 'vales', label: 'Vales' }, { key: 'cortesias', label: 'Cortesias' },
    { key: 'efectivo', label: 'Efectivo Entregado' },
    { key: 'totalRecibido', label: 'Total' },
  ]
  for (const f of filas) {
    const isTotal = f.key === 'totalRecibido'
    body += `<tr${isTotal ? ' class="total-row"' : ''}><td>${f.label}</td>`
    for (const r of d.resumen) body += `<td>${fmtCOP((r as any)[f.key] || 0)}</td>`
    if (hasTotal) body += `<td class="bold">${fmtCOP((d.tot as any)[f.key] || 0)}</td>`
    body += '</tr>'
  }
  body += `<tr class="saldo-row"><td>Saldo</td>`
  for (const r of d.resumen) body += `<td class="${saldoColor(r.saldo)}">${fmtCOP(r.saldo)}</td>`
  if (hasTotal) body += `<td class="${saldoColor(d.tot.saldo)}">${fmtCOP(d.tot.saldo)}</td>`
  body += '</tr></tbody></table>'

  printHTML(`Liquidacion Semanal ${f0} - ${fN}`, body)
}

function MoneyInput({ value, onChange, label, placeholder, className = '' }: {
  value: number; onChange: (n: number) => void; label?: string; placeholder?: string; className?: string
}) {
  const [display, setDisplay] = useState(value ? formatMoney(value) : '')

  useEffect(() => {
    setDisplay(value ? formatMoney(value) : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const num = Number(raw) || 0
    setDisplay(num ? formatMoney(num) : '')
    onChange(num)
  }

  return (
    <div className={className}>
      {label && <label className="text-xs text-white/45 block mb-1">{label}</label>}
      <div className="relative">
        <span className="absolute top-1/2 -translate-y-1/2 left-2.5 text-white/25 text-xs">$</span>
        <input type="text" inputMode="numeric" value={display} onChange={handleChange} placeholder={placeholder || '$0'}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50" />
      </div>
    </div>
  )
}

function BackButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <button onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.05] transition-all duration-200 group">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="transition-transform duration-200 group-hover:-translate-x-0.5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Atras
      </button>
      <div className="w-px h-5 bg-white/[0.08]" />
      <span className="text-sm font-medium text-white/50">{title}</span>
    </div>
  )
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-white/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

type Tab = 'liquidacion' | 'semana' | 'inventario' | 'comparativo'

interface Props {
  jornadas: Jornada[]
  trabajadores: Trabajador[]
  productos: Producto[]
  inventarios: InventarioType[]
  comparativos: ComparativoType[]
  agregarTrabajador: (t: Omit<Trabajador, 'id'>) => Promise<void>
  eliminarTrabajador: (id: string) => Promise<void>
  guardarJornada: (input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => Promise<void>
  actualizarJornada: (id: string, input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => Promise<void>
  eliminarJornada: (id: string) => Promise<void>
  guardarInventario: (inv: InventarioInput) => Promise<void>
  actualizarInventario: (id: string, inv: InventarioInput) => Promise<void>
  eliminarInventario: (id: string) => Promise<void>
  guardarComparativo: (comp: ComparativoInput) => Promise<void>
  eliminarComparativo: (id: string) => Promise<void>
  initialTab?: 'inventario' | 'comparativo'
}

export default function Liquidacion({
  jornadas, trabajadores, productos, inventarios, comparativos,
  agregarTrabajador, eliminarTrabajador,
  guardarJornada, actualizarJornada, eliminarJornada,
  guardarInventario, actualizarInventario, eliminarInventario,
  guardarComparativo, eliminarComparativo,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab || 'liquidacion')


  const [modoLiq, setModoLiq] = useState<'lista' | 'nueva' | 'editar'>('lista')
  const [editJornadaId, setEditJornadaId] = useState<string | null>(null)
  const nextSesion = () => {
    const nums = jornadas.map(j => { const m = j.sesion.match(/(\d+)/); return m ? Number(m[1]) : 0 })
    return `SI-${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`
  }
  const [sesion, setSesion] = useState('')
  const [fechaLiq, setFechaLiq] = useState(new Date().toISOString().split('T')[0])
  const [liquidaciones, _setLiquidaciones] = useState<LiquidacionTrabajador[]>([])
  const liqHistoryRef = useRef<LiquidacionTrabajador[][]>([])
  const setLiquidaciones: typeof _setLiquidaciones = (val) => {
    _setLiquidaciones(prev => {
      liqHistoryRef.current = [...liqHistoryRef.current.slice(-30), prev]
      return typeof val === 'function' ? val(prev) : val
    })
  }
  const [activeTrabajadorId, setActiveTrabajadorId] = useState<string | null>(null)
  const [guardandoLiq, setGuardandoLiq] = useState(false)
  const [nuevoTrabajador, setNuevoTrabajador] = useState('')
  const [confirmDeleteJ, setConfirmDeleteJ] = useState<string | null>(null)
  const [modalExito, setModalExito] = useState<string | null>(null)


  const [modoInv, setModoInv] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editInvId, setEditInvId] = useState<string | null>(null)
  const [fechaInv, setFechaInv] = useState(new Date().toISOString().split('T')[0])
  const [lineasInv, _setLineasInv] = useState<LineaInventario[]>([])
  const invHistoryRef = useRef<LineaInventario[][]>([])
  const setLineasInv: typeof _setLineasInv = (val) => {
    _setLineasInv(prev => {
      invHistoryRef.current = [...invHistoryRef.current.slice(-30), prev]
      return typeof val === 'function' ? val(prev) : val
    })
  }
  const [expandedInv, setExpandedInv] = useState<string | null>(null)
  const [confirmDeleteI, setConfirmDeleteI] = useState<string | null>(null)
  const [guardandoI, setGuardandoI] = useState(false)


  const [modoComp, setModoComp] = useState<'lista' | 'nuevo'>('lista')
  const [fechaComp, setFechaComp] = useState(new Date().toISOString().split('T')[0])
  const [lineasComp, setLineasComp] = useState<LineaComparativo[]>([])
  const [expandedComp, setExpandedComp] = useState<string | null>(null)
  const [confirmDeleteC, setConfirmDeleteC] = useState<string | null>(null)
  const [guardandoC, setGuardandoC] = useState(false)



  const undoLiq = useCallback(() => {
    const h = liqHistoryRef.current
    if (h.length === 0) return
    const prev = h[h.length - 1]
    liqHistoryRef.current = h.slice(0, -1)
    _setLiquidaciones(prev)
  }, [])

  const undoInv = useCallback(() => {
    const h = invHistoryRef.current
    if (h.length === 0) return
    const prev = h[h.length - 1]
    invHistoryRef.current = h.slice(0, -1)
    _setLineasInv(prev)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        if (tab === 'liquidacion' && (modoLiq === 'nueva' || modoLiq === 'editar')) undoLiq()
        else if (tab === 'inventario' && (modoInv === 'nuevo' || modoInv === 'editar')) undoInv()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tab, modoLiq, modoInv, undoLiq, undoInv])

  const fechaLiqDuplicada = jornadas.some(j => j.fecha === fechaLiq && j.id !== editJornadaId)

  const toggleTrabajador = (id: string) => {
    setLiquidaciones(prev => {
      const idx = prev.findIndex(l => l.trabajadorId === id)
      if (idx >= 0) {
        const next = prev.filter(l => l.trabajadorId !== id)
        if (activeTrabajadorId === id) setActiveTrabajadorId(next.length > 0 ? next[0].trabajadorId : null)
        return next
      }
      const t = trabajadores.find(x => x.id === id)
      if (!t) return prev
      const ultimoInv = inventarios.length > 0 ? inventarios[0] : null
      const lineasIniciales = productos.filter(p => p.activo).map(p => {
        const invLinea = ultimoInv?.lineas.find(l => l.productoId === p.id)
        const cantidad = invLinea?.saldo ?? 0
        return { productoId: p.id, nombre: p.nombre, precioUnitario: p.precio, cantidad, total: p.precio * cantidad }
      })
      const newLiq: LiquidacionTrabajador = {
        trabajadorId: t.id, nombre: t.nombre, color: t.color, avatar: t.avatar,
        lineas: lineasIniciales, transacciones: [], vales: [], cortesias: [], gastos: [],
        totalVenta: 0, efectivoEntregado: 0,
      }
      setActiveTrabajadorId(id)
      return [...prev, newLiq]
    })
  }

  const handleTabClick = (id: string) => {
    const isSelected = liquidaciones.some(l => l.trabajadorId === id)
    if (isSelected) {
      setActiveTrabajadorId(id)
    } else {
      toggleTrabajador(id)
    }
  }

  const handleTabDblClick = (id: string) => {
    const liq = liquidaciones.find(l => l.trabajadorId === id)
    if (!liq) return
    const tieneVentas = liq.lineas.some(l => l.cantidad > 0) || liq.totalVenta > 0
    if (tieneVentas) {
      if (!confirm(`${liq.nombre} tiene ventas ingresadas. ¿Quitar de la liquidacion?`)) return
    }
    toggleTrabajador(id)
  }

  const updateLiquidacion = (trabajadorId: string, updater: (liq: LiquidacionTrabajador) => LiquidacionTrabajador) => {
    setLiquidaciones(prev => prev.map(l => {
      if (l.trabajadorId !== trabajadorId) return l
      return updater(l)
    }))
  }

  const updateEfectivoEntregado = (trabajadorId: string, valor: number) => {
    updateLiquidacion(trabajadorId, liq => ({ ...liq, efectivoEntregado: valor }))
  }

  const updateTotalVentaManual = (trabajadorId: string, total: number) => {
    setLiquidaciones(prev => prev.map(l => l.trabajadorId === trabajadorId ? { ...l, totalVenta: total } : l))
  }

  const updateLineaCantidad = useCallback((trabajadorId: string, productoId: string, cantidad: number) => {
    if (cantidad < 0) return
    updateLiquidacion(trabajadorId, liq => {
      const lineas = liq.lineas.map(l =>
        l.productoId === productoId ? { ...l, cantidad, total: l.precioUnitario * cantidad } : l
      )
      const totalVenta = lineas.reduce((s, l) => s + l.total, 0)
      return { ...liq, lineas, totalVenta }
    })
  }, [])


  const addTransaccion = (trabajadorId: string, tipo: TipoPago) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, transacciones: [...liq.transacciones, { tipo, concepto: '', monto: 0 }],
    }))
  }
  const updateTransaccion = (trabajadorId: string, idx: number, field: 'concepto' | 'monto', value: string | number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, transacciones: liq.transacciones.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }))
  }
  const removeTransaccion = (trabajadorId: string, idx: number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, transacciones: liq.transacciones.filter((_, i) => i !== idx),
    }))
  }


  const addVale = (trabajadorId: string) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, vales: [...liq.vales, { tercero: '', monto: 0 }],
    }))
  }
  const updateVale = (trabajadorId: string, idx: number, field: 'tercero' | 'monto', value: string | number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, vales: liq.vales.map((v, i) => i === idx ? { ...v, [field]: value } : v),
    }))
  }
  const removeVale = (trabajadorId: string, idx: number) => {
    updateLiquidacion(trabajadorId, liq => ({ ...liq, vales: liq.vales.filter((_, i) => i !== idx) }))
  }


  const addCortesia = (trabajadorId: string) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, cortesias: [...liq.cortesias, { concepto: '', monto: 0 }],
    }))
  }
  const updateCortesia = (trabajadorId: string, idx: number, field: 'concepto' | 'monto', value: string | number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, cortesias: liq.cortesias.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }))
  }
  const removeCortesia = (trabajadorId: string, idx: number) => {
    updateLiquidacion(trabajadorId, liq => ({ ...liq, cortesias: liq.cortesias.filter((_, i) => i !== idx) }))
  }


  const addGasto = (trabajadorId: string) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, gastos: [...liq.gastos, { concepto: '', monto: 0 }],
    }))
  }
  const updateGasto = (trabajadorId: string, idx: number, field: 'concepto' | 'monto', value: string | number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, gastos: liq.gastos.map((g, i) => i === idx ? { ...g, [field]: value } : g),
    }))
  }
  const removeGasto = (trabajadorId: string, idx: number) => {
    updateLiquidacion(trabajadorId, liq => ({ ...liq, gastos: liq.gastos.filter((_, i) => i !== idx) }))
  }

  const cuadreDia = calcularCuadreDia(liquidaciones)
  const algunoConVentas = liquidaciones.length > 0 && liquidaciones.some(liq => liq.lineas.some(l => l.cantidad > 0) || liq.totalVenta > 0)
  const formValidoLiq = sesion.trim() !== '' && algunoConVentas && !fechaLiqDuplicada

  const editarJornada = (j: Jornada) => {
    setSesion(j.sesion)
    setFechaLiq(j.fecha)
    const liqs = (j.liquidaciones || []).map(liq => ({ ...liq }))
    _setLiquidaciones(liqs)
    setActiveTrabajadorId(liqs.length > 0 ? liqs[0].trabajadorId : null)
    setEditJornadaId(j.id)
    setModoLiq('editar')
  }

  const handleGuardarLiq = async () => {
    if (!formValidoLiq || guardandoLiq) return
    setGuardandoLiq(true)
    try {
      const liqsConVentas = liquidaciones.filter(liq => liq.lineas.some(l => l.cantidad > 0) || liq.totalVenta > 0)
      const liqsConEfectivo = liqsConVentas.map(liq => {
        const c = calcularLiquidacion(liq)
        return { ...liq, efectivoEntregado: liq.efectivoEntregado > 0 ? liq.efectivoEntregado : c.efectivo }
      })
      const data = { sesion, fecha: fechaLiq, liquidaciones: liqsConEfectivo }
      if (modoLiq === 'editar' && editJornadaId) {
        await actualizarJornada(editJornadaId, data)
        setModalExito('Liquidacion actualizada correctamente')
      } else {
        await guardarJornada(data)
        setModalExito('Liquidacion guardada correctamente')
      }
      setGuardandoLiq(false)
      setTimeout(() => {
        setModalExito(null)
        setSesion(''); setFechaLiq(new Date().toISOString().split('T')[0])
        _setLiquidaciones([]); setActiveTrabajadorId(null); setEditJornadaId(null); setModoLiq('lista')
      }, 2000)
    } catch {
      setGuardandoLiq(false)
      alert('Error al guardar. Revisa la consola.')
    }
  }

  const handleEliminarJ = async (id: string) => { await eliminarJornada(id); setConfirmDeleteJ(null) }

  const handleAgregarTrabajador = async () => {
    if (!nuevoTrabajador.trim()) return
    const color = COLORES_TRABAJADOR[trabajadores.length % COLORES_TRABAJADOR.length]
    const avatar = nuevoTrabajador.trim().slice(0, 2).toUpperCase()
    await agregarTrabajador({ nombre: nuevoTrabajador.trim(), color, avatar, activo: true })
    setNuevoTrabajador('')
  }


  const fechaInvDuplicada = inventarios.some(i => i.fecha === fechaInv && i.id !== editInvId)

  const generarLineasInv = () => {
    const activos = productos.filter(p => p.activo)
    if (activos.length === 0) return []
    const ultimo = inventarios.length > 0 ? inventarios[0] : null
    return activos.map(p => {
      const ant = ultimo?.lineas.find(l => l.productoId === p.id)
      const invInicial = ant?.invFisico ?? 0
      const saldo = invInicial
      return { productoId: p.id, nombre: p.nombre, valorUnitario: p.precio, salidas: 0, invInicial, entradas: 0, invFisico: 0, saldo, total: saldo * p.precio }
    }).sort((a, b) => b.valorUnitario - a.valorUnitario)
  }

  const crearNuevoInv = () => { setLineasInv(generarLineasInv()); setFechaInv(new Date().toISOString().split('T')[0]); setEditInvId(null); setModoInv('nuevo') }

  const editarInv = (inv: InventarioType) => {
    setFechaInv(inv.fecha)
    setLineasInv(inv.lineas.map(l => ({ ...l })))
    setEditInvId(inv.id)
    setModoInv('editar')
  }

  useEffect(() => {
    if (modoInv === 'nuevo' && lineasInv.length === 0 && productos.length > 0) setLineasInv(generarLineasInv())
  }, [modoInv, productos, lineasInv.length])

  const actualizarLineaInv = (idx: number, campo: 'salidas' | 'invInicial' | 'entradas' | 'invFisico', valor: string) => {
    setLineasInv(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [campo]: Number(valor) || 0 }

      updated.saldo = (updated.invInicial + updated.entradas) - updated.invFisico - updated.salidas
      updated.total = updated.saldo * updated.valorUnitario
      return updated
    }))
  }

  const reordenarLineasInv = (campo: string, dir: 'asc' | 'desc') => {
    setLineasInv(prev => [...prev].sort((a, b) => {
      const va = (a as any)[campo] ?? ''
      const vb = (b as any)[campo] ?? ''
      if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return dir === 'asc' ? va - vb : vb - va
    }))
  }

  const totalGeneralInv = lineasInv.reduce((s, l) => s + l.total, 0)

  const handleGuardarInv = async () => {
    if (fechaInvDuplicada || guardandoI) return
    setGuardandoI(true)
    try {
      const data = { fecha: fechaInv, lineas: lineasInv, totalGeneral: totalGeneralInv }
      if (modoInv === 'editar' && editInvId) {
        await actualizarInventario(editInvId, data)
        setModalExito('Inventario actualizado correctamente')
      } else {
        await guardarInventario(data)
        setModalExito('Inventario guardado correctamente')
      }
      setGuardandoI(false)
      setTimeout(() => { setModalExito(null); setModoInv('lista'); setEditInvId(null) }, 2000)
    } catch { setGuardandoI(false); alert('Error al guardar inventario.') }
  }

  const handleEliminarI = async (id: string) => { await eliminarInventario(id); setConfirmDeleteI(null); setExpandedInv(null) }


  const fechasComp = new Set(comparativos.map(c => c.fecha))
  const fechaCompDuplicada = fechasComp.has(fechaComp)

  const generarLineasComp = () => {
    const activos = productos.filter(p => p.activo)
    if (activos.length === 0) return []

    return activos.map(p => ({
      productoId: p.id, nombre: p.nombre, conteo: 0, tiquets: 0, diferencia: 0
    })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  const crearNuevoComp = () => { setLineasComp(generarLineasComp()); setFechaComp(new Date().toISOString().split('T')[0]); setModoComp('nuevo') }

  const actualizarLineaComp = (idx: number, campo: 'conteo' | 'tiquets', valor: string) => {
    setLineasComp(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [campo]: Number(valor) || 0 }
      updated.diferencia = updated.tiquets - updated.conteo
      return updated
    }))
  }

  const totalConteoComp = lineasComp.reduce((s, l) => s + l.conteo, 0)
  const totalTiquetsComp = lineasComp.reduce((s, l) => s + l.tiquets, 0)

  const handleGuardarComp = async () => {
    if (fechaCompDuplicada || guardandoC) return
    setGuardandoC(true)
    try {
      await guardarComparativo({ fecha: fechaComp, lineas: lineasComp, totalConteo: totalConteoComp, totalTiquets: totalTiquetsComp })
      setGuardandoC(false)
      setModalExito('Comparativo guardado correctamente')
      setTimeout(() => { setModalExito(null); setModoComp('lista') }, 2000)
    } catch { setGuardandoC(false); alert('Error al guardar comparativo.') }
  }

  const handleEliminarC = async (id: string) => { await eliminarComparativo(id); setConfirmDeleteC(null); setExpandedComp(null) }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'liquidacion', label: 'Liquidacion' },
    { key: 'semana', label: 'Liq. Semana' },
    { key: 'inventario', label: 'Inventario' },
    { key: 'comparativo', label: 'Comparativo' },
  ]

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Liquidaciones</h2>

      <div className="flex gap-1 mb-4 sm:mb-6 bg-white/5 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm transition-all whitespace-nowrap flex-1 sm:flex-none ${tab === t.key ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'liquidacion' && (
        modoLiq === 'nueva' || modoLiq === 'editar' ? (
          <LiquidacionNueva
            trabajadores={trabajadores}
            liquidaciones={liquidaciones} activeTrabajadorId={activeTrabajadorId}
            sesion={sesion} fecha={fechaLiq} fechaDuplicada={fechaLiqDuplicada}
            guardando={guardandoLiq} formValido={formValidoLiq}
            cuadreDia={cuadreDia}
            nuevoTrabajador={nuevoTrabajador} setNuevoTrabajador={setNuevoTrabajador}
            handleAgregarTrabajador={handleAgregarTrabajador}
            setSesion={setSesion} setFecha={setFechaLiq}
            handleTabClick={handleTabClick} handleTabDblClick={handleTabDblClick}
            updateEfectivoEntregado={updateEfectivoEntregado} updateTotalVentaManual={updateTotalVentaManual}
            updateLineaCantidad={updateLineaCantidad}
            updateTransaccion={updateTransaccion}
            addTransaccion={addTransaccion} removeTransaccion={removeTransaccion}
            updateVale={updateVale} addVale={addVale} removeVale={removeVale}
            updateCortesia={updateCortesia} addCortesia={addCortesia} removeCortesia={removeCortesia}
            updateGasto={updateGasto} addGasto={addGasto} removeGasto={removeGasto}
            updateLiqDirect={(tid: string, data: Partial<LiquidacionTrabajador>) => {
              setLiquidaciones(prev => prev.map(l => l.trabajadorId !== tid ? l : { ...l, ...data }))
            }}
            handleGuardar={handleGuardarLiq}
            onBack={() => { setModoLiq('lista'); setEditJornadaId(null) }}
            isEditing={modoLiq === 'editar'}
          />
        ) : (
          <LiquidacionLista jornadas={jornadas} confirmDelete={confirmDeleteJ}
            setConfirmDelete={setConfirmDeleteJ} handleEliminar={handleEliminarJ}
            onNueva={() => { setSesion(nextSesion()); setEditJornadaId(null); setModoLiq('nueva') }}
            onEditar={editarJornada}
            productos={productos} trabajadores={trabajadores} guardarJornada={guardarJornada}
            agregarTrabajador={agregarTrabajador} />
        )
      )}

      {tab === 'semana' && <LiquidacionSemana jornadas={jornadas} inventarios={inventarios} />}

      {tab === 'inventario' && (
        modoInv === 'nuevo' || modoInv === 'editar' ? (
          <InventarioNuevo fecha={fechaInv} setFecha={setFechaInv} lineas={lineasInv} totalGeneral={totalGeneralInv}
            actualizarLinea={actualizarLineaInv} reordenarLineas={reordenarLineasInv} guardando={guardandoI} fechaDuplicada={fechaInvDuplicada}
            handleGuardar={handleGuardarInv} onBack={() => { setModoInv('lista'); setEditInvId(null) }}
            isEditing={modoInv === 'editar'} />
        ) : (
          <InventarioLista inventarios={inventarios} expandedId={expandedInv} setExpandedId={setExpandedInv}
            confirmDelete={confirmDeleteI} setConfirmDelete={setConfirmDeleteI}
            handleEliminar={handleEliminarI} onNuevo={crearNuevoInv} onEditar={editarInv} productosLoaded={productos.length > 0}
            productos={productos} guardarInventario={guardarInventario} />
        )
      )}

      {tab === 'comparativo' && (
        modoComp === 'nuevo' ? (
          <ComparativoNuevo fecha={fechaComp} setFecha={setFechaComp} lineas={lineasComp}
            totalConteo={totalConteoComp} totalTiquets={totalTiquetsComp}
            actualizarLinea={actualizarLineaComp} guardando={guardandoC} fechaDuplicada={fechaCompDuplicada}
            handleGuardar={handleGuardarComp} onBack={() => setModoComp('lista')} />
        ) : (
          <ComparativoLista comparativos={comparativos} expandedId={expandedComp} setExpandedId={setExpandedComp}
            confirmDelete={confirmDeleteC} setConfirmDelete={setConfirmDeleteC}
            handleEliminar={handleEliminarC} onNuevo={crearNuevoComp} productosLoaded={productos.length > 0}
            productos={productos} guardarComparativo={guardarComparativo} />
        )
      )}

      {modalExito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#CDA52F]/30 rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4"
            style={{ boxShadow: '0 0 40px rgba(205,165,47,0.15)' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#CDA52F]/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CDA52F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-lg font-bold text-white mb-1">{modalExito}</p>
            <p className="text-sm text-white/40">Datos almacenados correctamente</p>
          </div>
        </div>
      )}
    </div>
  )
}



function LiquidacionLista({ jornadas, confirmDelete, setConfirmDelete, handleEliminar, onNueva, onEditar, productos, trabajadores, guardarJornada, agregarTrabajador }: {
  jornadas: Jornada[]; confirmDelete: string | null; setConfirmDelete: (id: string | null) => void
  handleEliminar: (id: string) => void; onNueva: () => void; onEditar: (j: Jornada) => void
  productos: Producto[]; trabajadores: Trabajador[]
  guardarJornada: (input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => Promise<void>
  agregarTrabajador: (t: Omit<Trabajador, 'id'>) => Promise<void>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showImport, setShowImport] = useState(false)
  const productosLoaded = productos.length > 0 && trabajadores.length > 0

  const filtradas = jornadas.filter(j => {
    if (desde && j.fecha < desde) return false
    if (hasta && j.fecha > hasta) return false
    return true
  })

  const handleImport = async (toImport: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }[]) => {
    const fallidos: { fecha: string; error: string }[] = []
    let exitosos = 0
    for (const j of toImport) {
      try {
        await guardarJornada(j)
        exitosos++
      } catch (e: any) {
        fallidos.push({ fecha: j.fecha, error: e?.message ?? 'Error desconocido' })
      }
    }
    if (fallidos.length > 0) {
      const detalle = fallidos.map(f => `${f.fecha}: ${f.error}`).join('\n')
      throw new Error(`${exitosos}/${toImport.length} importadas. Fallaron:\n${detalle}`)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}
          total={jornadas.length} filtrados={filtradas.length} />
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <Btn variant="ghost" onClick={() => setShowImport(true)} disabled={!productosLoaded} className="flex-1 sm:flex-initial">
            Importar Excel
          </Btn>
          <Btn onClick={onNueva} className="flex-1 sm:flex-initial">+ Nueva Liquidacion</Btn>
        </div>
      </div>
      {showImport && (
        <ImportarLiquidacionExcel
          productos={productos}
          trabajadores={trabajadores}
          jornadasExistentes={jornadas}
          agregarTrabajador={agregarTrabajador}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
      {filtradas.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">
          {jornadas.length === 0 ? 'No hay liquidaciones registradas.' : 'No hay liquidaciones en el periodo seleccionado.'}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map(j => {
            const expanded = expandedId === j.id
            const esperado = j.totalVendido - j.cortesias - j.gastos
            return (
              <Card key={j.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : j.id)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#CDA52F]/15 text-[#CDA52F] shrink-0">{j.sesion}</span>
                    <span className="text-xs sm:text-sm text-white/45 truncate">{j.fecha}</span>
                    <span className="text-[10px] sm:text-xs text-white/30 shrink-0">{j.liquidaciones?.length || 0} trab.</span>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 ml-auto">
                    <span className="text-xs sm:text-sm text-[#FFE66D] font-medium">{fmtCOP(j.totalVendido)}</span>
                    <span className={`text-xs sm:text-sm font-bold ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtCOP(j.saldo)}</span>
                    <Chevron expanded={expanded} />
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-white/[0.07]" onClick={e => e.stopPropagation()}>
                    <div className="space-y-3 mb-4">
                      {j.liquidaciones?.map((liq, i) => {
                        const c = calcularLiquidacion(liq)
                        return (
                          <div key={i} className="p-3 rounded-lg bg-white/[0.03]">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{ backgroundColor: liq.color + '33', color: liq.color }}>{liq.avatar}</div>
                              <span className="text-xs text-white/70 flex-1">{liq.nombre}</span>
                              <span className="text-xs text-[#FFE66D] font-bold">{fmtFull(c.totalVenta)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 ml-9">
                              {liq.efectivoEntregado > 0 && (
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#CDA52F22', color: '#CDA52F' }}>
                                  Efectivo: {fmtFull(liq.efectivoEntregado)}
                                </span>
                              )}
                              {c.totalDatafono > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#A8E6CF22', color: '#A8E6CF' }}>Datafono: {fmtFull(c.totalDatafono)}</span>}
                              {c.totalQR > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#4ECDC422', color: '#4ECDC4' }}>QR: {fmtFull(c.totalQR)}</span>}
                              {c.totalNequi > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FFE66D22', color: '#FFE66D' }}>Nequi: {fmtFull(c.totalNequi)}</span>}
                              {c.totalVales > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#C3B1E122', color: '#C3B1E1' }}>Vales: {fmtFull(c.totalVales)}</span>}
                              {c.totalCortesias > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-white/40">Cort: {fmtFull(c.totalCortesias)}</span>}
                              {c.totalGastos > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-white/40">Gast: {fmtFull(c.totalGastos)}</span>}
                            </div>

                            {/* Detalle items: Transacciones, Vales, Cortesias, Gastos */}
                            {((liq.transacciones?.length > 0) || (liq.vales?.length > 0) || (liq.cortesias?.length > 0) || (liq.gastos?.length > 0)) && (
                              <div className="ml-9 mt-2 space-y-1.5">
                                {liq.transacciones?.filter(t => t.monto > 0).map((t, ti) => (
                                  <div key={`tr-${ti}`} className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded bg-white/[0.02]">
                                    <span className="text-white/35">{t.tipo}{t.concepto ? ` — ${t.concepto}` : ''}</span>
                                    <span style={{ color: COLORES_PAGO[t.tipo] || '#A8E6CF' }} className="font-medium">{fmtFull(t.monto)}</span>
                                  </div>
                                ))}
                                {liq.vales?.filter(v => v.monto > 0).map((v, vi) => (
                                  <div key={`va-${vi}`} className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded bg-white/[0.02]">
                                    <span className="text-white/35">Vale{v.tercero ? ` — ${v.tercero}` : ''}</span>
                                    <span className="font-medium" style={{ color: '#C3B1E1' }}>{fmtFull(v.monto)}</span>
                                  </div>
                                ))}
                                {liq.cortesias?.filter(ct => ct.monto > 0).map((ct, ci) => (
                                  <div key={`co-${ci}`} className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded bg-white/[0.02]">
                                    <span className="text-white/35">Cortesia{ct.concepto ? ` — ${ct.concepto}` : ''}</span>
                                    <span className="font-medium text-white/50">{fmtFull(ct.monto)}</span>
                                  </div>
                                ))}
                                {liq.gastos?.filter(g => g.monto > 0).map((g, gi) => (
                                  <div key={`ga-${gi}`} className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded bg-white/[0.02]">
                                    <span className="text-white/35">Gasto{g.concepto ? ` — ${g.concepto}` : ''}</span>
                                    <span className="font-medium text-white/50">{fmtFull(g.monto)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="ml-9 mt-1.5 flex justify-between text-xs">
                              <span className="text-white/30 font-medium">Saldo: <span className={`font-bold ${c.saldo === 0 ? 'text-[#60A5FA]' : c.saldo > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(c.saldo)}</span></span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div><p className="text-white/30 mb-0.5">Vendido</p><p className="text-[#FFE66D] font-bold">{fmtFull(j.totalVendido)}</p></div>
                        <div><p className="text-white/30 mb-0.5">Esperado</p><p className="text-white font-medium">{fmtFull(esperado)}</p></div>
                        <div><p className="text-white/30 mb-0.5">Recibido</p><p className="text-[#4ECDC4] font-bold">{fmtFull(j.totalRecibido)}</p></div>
                        <div><p className="text-white/30 mb-0.5">Saldo</p><p className={`font-bold text-base ${j.saldo === 0 ? 'text-[#60A5FA]' : j.saldo > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(j.saldo)}</p></div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-3">
                      <Btn size="sm" variant="ghost" onClick={() => onEditar(j)} className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => printJornada(j)} className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Imprimir
                      </Btn>
                      {confirmDelete === j.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#FF5050]">Seguro?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(j.id)}>Si, eliminar</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(j.id)} className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Eliminar</Btn>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}



function LiquidacionNueva({
  trabajadores, liquidaciones, activeTrabajadorId,
  sesion, fecha, fechaDuplicada, guardando, formValido, cuadreDia,
  nuevoTrabajador, setNuevoTrabajador, handleAgregarTrabajador,
  setSesion, setFecha, handleTabClick, handleTabDblClick,
  updateEfectivoEntregado, updateTotalVentaManual,
  updateLineaCantidad,
  updateTransaccion, addTransaccion, removeTransaccion,
  updateVale, addVale, removeVale,
  updateCortesia, addCortesia, removeCortesia,
  updateGasto, addGasto, removeGasto,
  updateLiqDirect,
  handleGuardar, onBack, isEditing = false,
}: {
  trabajadores: Trabajador[]
  liquidaciones: LiquidacionTrabajador[]; activeTrabajadorId: string | null
  sesion: string; fecha: string; fechaDuplicada: boolean; guardando: boolean; formValido: boolean
  cuadreDia: ReturnType<typeof calcularCuadreDia>
  nuevoTrabajador: string; setNuevoTrabajador: (v: string) => void; handleAgregarTrabajador: () => void
  setSesion: (v: string) => void; setFecha: (v: string) => void
  handleTabClick: (id: string) => void
  handleTabDblClick: (id: string) => void
  updateEfectivoEntregado: (tid: string, val: number) => void
  updateTotalVentaManual: (tid: string, total: number) => void
  updateLineaCantidad: (tid: string, productoId: string, cantidad: number) => void
  updateTransaccion: (tid: string, idx: number, field: 'concepto' | 'monto', value: string | number) => void
  addTransaccion: (tid: string, tipo: TipoPago) => void
  removeTransaccion: (tid: string, idx: number) => void
  updateVale: (tid: string, idx: number, field: 'tercero' | 'monto', value: string | number) => void
  addVale: (tid: string) => void
  removeVale: (tid: string, idx: number) => void
  updateCortesia: (tid: string, idx: number, field: 'concepto' | 'monto', value: string | number) => void
  addCortesia: (tid: string) => void
  removeCortesia: (tid: string, idx: number) => void
  updateGasto: (tid: string, idx: number, field: 'concepto' | 'monto', value: string | number) => void
  addGasto: (tid: string) => void
  removeGasto: (tid: string, idx: number) => void
  updateLiqDirect: (tid: string, data: Partial<LiquidacionTrabajador>) => void
  handleGuardar: () => void; onBack: () => void; isEditing?: boolean
}) {
  const activeLiq = liquidaciones.find(l => l.trabajadorId === activeTrabajadorId)


  const [pedidosHoy, setPedidosHoy] = useState<Pedido[]>([])
  const [cuentasHoy, setCuentasHoy] = useState<CuentaMesa[]>([])
  const [ticketsExpanded, setTicketsExpanded] = useState(true)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)

  const fetchPedidosHoy = useCallback(async () => {
    try {
      const [resPedidos, resCuentas] = await Promise.all([
        apiFetch(`${API_PEDIDOS}/hoy`),
        apiFetch(`${API_PEDIDOS}/cuentas/hoy`),
      ])
      if (resPedidos.ok) {
        const data = await resPedidos.json()
        setPedidosHoy(data.map((p: any) => ({ ...p, id: String(p.id) })))
      }
      if (resCuentas.ok) {
        const data = await resCuentas.json()
        setCuentasHoy(data.map((c: any) => ({
          ...c,
          id: String(c.id),
          pedidos: (c.pedidos || []).map((p: any) => ({ ...p, id: String(p.id) })),
        })))
      }
    } catch (e) { console.error('Error cargando pedidos para liquidacion:', e) }
  }, [])

  useEffect(() => { fetchPedidosHoy() }, [fetchPedidosHoy])

  const pedidosTrabajador = useMemo(() => {
    if (!activeTrabajadorId) return []
    return pedidosHoy.filter(p => p.meseroId === activeTrabajadorId)
  }, [pedidosHoy, activeTrabajadorId])

  const cuentasTrabajador = useMemo(() => {
    if (!activeTrabajadorId) return []
    return cuentasHoy.filter(c => c.meseroId === activeTrabajadorId)
  }, [cuentasHoy, activeTrabajadorId])

  const totalTicketsTrabajador = useMemo(() => pedidosTrabajador.reduce((s, p) => s + p.total, 0), [pedidosTrabajador])


  useEffect(() => { setExpandedTicket(null) }, [activeTrabajadorId])

  return (
    <div>
      <BackButton onClick={onBack} title={isEditing ? "Editar Liquidacion" : "Nueva Liquidacion"} />

      <div className="flex gap-2 sm:gap-3 items-end mb-2">
        <Input label="Sesion" value={sesion} onChange={e => setSesion(e.target.value)} placeholder="SI-7" className="w-24 sm:w-32" />
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-36 sm:w-44" />
      </div>
      {fechaDuplicada && <p className="text-xs text-[#FF5050] mb-3">Ya existe una liquidacion para esta fecha.</p>}

      <div className="flex gap-2 flex-wrap items-center mb-5">
        {trabajadores.filter(t => t.activo).map(t => {
          const sel = liquidaciones.some(l => l.trabajadorId === t.id)
          const isActive = activeTrabajadorId === t.id
          return (
            <button key={t.id} onClick={() => handleTabClick(t.id)} onDoubleClick={() => handleTabDblClick(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs ${isActive && sel ? 'ring-2 ring-offset-1 ring-offset-[#0A0A0A]' : ''}`}
              style={{
                border: `2px solid ${sel ? t.color : 'rgba(255,255,255,0.1)'}`,
                backgroundColor: sel ? t.color + '20' : 'transparent',
                color: sel ? t.color : 'rgba(255,255,255,0.5)',
                ...(sel ? { '--tw-ring-color': t.color } as React.CSSProperties : {}),
              }}>
              <span className="font-bold">{t.avatar}</span>
              <span>{t.nombre}</span>
              {sel && (() => { const liq = liquidaciones.find(l => l.trabajadorId === t.id); if (!liq) return null; const c = calcularLiquidacion(liq); return c.totalVenta > 0 ? <span className="text-[10px] opacity-70">{fmtCOP(c.totalVenta)}</span> : null })()}
            </button>
          )
        })}
        <div className="flex gap-1 items-center">
          <input type="text" placeholder="+ Trabajador" value={nuevoTrabajador} onChange={e => setNuevoTrabajador(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAgregarTrabajador()}
            className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50 w-28" />
          {nuevoTrabajador.trim() && <button onClick={handleAgregarTrabajador} className="text-[#CDA52F] text-sm font-bold hover:text-[#CDA52F]/70">+</button>}
        </div>
      </div>

      {activeLiq ? (
        <div className="flex flex-col lg:flex-row gap-4">

          {liquidaciones.length > 0 && (
            <div className="lg:hidden flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              <div className="flex gap-2 items-center shrink-0 px-3 py-2 rounded-lg border border-[#FFE66D]/15 bg-[#FFE66D]/[0.03]">
                <span className="text-[10px] text-white/40">Vendido</span>
                <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(cuadreDia.totalVendido)}</span>
              </div>
              <div className="flex gap-2 items-center shrink-0 px-3 py-2 rounded-lg border border-[#4ECDC4]/15 bg-[#4ECDC4]/[0.03]">
                <span className="text-[10px] text-white/40">Recibido</span>
                <span className="text-xs text-[#4ECDC4] font-bold">{fmtCOP(cuadreDia.totalRecibido)}</span>
              </div>
              <div className={`flex gap-2 items-center shrink-0 px-3 py-2 rounded-lg border ${cuadreDia.saldo === 0 ? 'border-[#60A5FA]/15 bg-[#60A5FA]/[0.03]' : cuadreDia.saldo > 0 ? 'border-[#4ECDC4]/15 bg-[#4ECDC4]/[0.03]' : 'border-[#FF5050]/15 bg-[#FF5050]/[0.03]'}`}>
                <span className="text-[10px] text-white/40">Saldo</span>
                <span className={`text-xs font-bold ${cuadreDia.saldo === 0 ? 'text-[#60A5FA]' : cuadreDia.saldo > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(cuadreDia.saldo)}</span>
              </div>
            </div>
          )}

          <div className="hidden lg:block w-[220px] shrink-0 space-y-2">
            {liquidaciones.map(liq => {
              const c = calcularLiquidacion(liq)
              const isActive = liq.trabajadorId === activeTrabajadorId
              return (
                <button key={liq.trabajadorId} onClick={() => handleTabClick(liq.trabajadorId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${isActive ? 'border-white/15 bg-white/[0.06]' : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: liq.color + '33', color: liq.color }}>{liq.avatar}</div>
                    <span className="text-xs text-white/80 font-medium flex-1 truncate">{liq.nombre}</span>
                  </div>
                  <div className="ml-9 flex items-center justify-between">
                    <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(c.totalVenta)}</span>
                    {c.totalVenta > 0 && (
                      <span className={`text-[10px] font-bold ${c.saldo === 0 ? 'text-[#60A5FA]' : c.saldo > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                        {c.saldo === 0 ? '\u2713' : fmtCOP(c.saldo)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}

            {liquidaciones.length > 0 && (
              <div className="mt-4 p-3 rounded-xl border border-[#FFE66D]/15 bg-[#FFE66D]/[0.03]">
                <p className="text-[10px] text-white/40 font-medium mb-2 uppercase tracking-wider">Cuadre del Dia</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Vendido</span><span className="text-[#FFE66D] font-bold">{fmtCOP(cuadreDia.totalVendido)}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Recibido</span><span className="text-[#4ECDC4] font-bold">{fmtCOP(cuadreDia.totalRecibido)}</span></div>
                  <div className="border-t border-white/5 my-1" />
                  <div className="flex justify-between font-bold">
                    <span className="text-white/60">Saldo</span>
                    <span className={cuadreDia.saldo === 0 ? 'text-[#60A5FA]' : cuadreDia.saldo > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}>{fmtFull(cuadreDia.saldo)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: activeLiq.color + '33', color: activeLiq.color }}>{activeLiq.avatar}</div>
              <span className="text-sm font-medium">{activeLiq.nombre}</span>
              <span className="text-xs text-white/30 ml-auto">Liquidacion Diaria</span>
            </div>

            {pedidosTrabajador.length > 0 && (
              <Card className="mb-4 border-[#D4AF37]/10">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setTicketsExpanded(!ticketsExpanded)}>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <p className="text-xs text-[#D4AF37] font-medium uppercase tracking-wider">
                      Tickets del dia ({pedidosTrabajador.length})
                    </p>
                    <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(totalTicketsTrabajador)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); fetchPedidosHoy() }}
                      className="p-1 rounded-md hover:bg-white/5 text-white/30 hover:text-white/50 transition-colors" title="Actualizar">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                    </button>
                    <Chevron expanded={ticketsExpanded} />
                  </div>
                </div>

                {ticketsExpanded && (
                  <div className="mt-3 space-y-2">
                    {cuentasTrabajador.length > 0 && cuentasTrabajador.map(cuenta => {
                      const pedidosCuenta = pedidosTrabajador.filter(p =>
                        cuenta.pedidos.some(cp => cp.id === p.id)
                      )
                      if (pedidosCuenta.length === 0) return null
                      return (
                        <div key={`cuenta-${cuenta.id}`} className="rounded-lg bg-white/[0.03] border border-white/[0.05] overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-white/60">{cuenta.mesaNombre}</span>
                              <span className="text-[10px] text-white/30">— {cuenta.nombreCliente}</span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                cuenta.estado === 'PAGADA' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FFE66D]/15 text-[#FFE66D]'
                              }`}>{cuenta.estado}</span>
                            </div>
                            <span className="text-xs font-bold text-[#FFE66D]">{fmtCOP(cuenta.total)}</span>
                          </div>
                          <div className="divide-y divide-white/[0.03]">
                            {pedidosCuenta.map(p => {
                              const isExpanded = expandedTicket === p.id
                              return (
                                <div key={p.id}>
                                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                    onClick={() => setExpandedTicket(isExpanded ? null : p.id)}>
                                    <span className="text-[10px] font-bold text-[#CDA52F]">#{p.ticketDia}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                      p.estado === 'PENDIENTE' ? 'bg-[#FFE66D]/15 text-[#FFE66D]'
                                      : p.estado === 'DESPACHADO' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                                      : p.estado === 'CANCELADO' ? 'bg-[#FF5050]/15 text-[#FF5050]'
                                      : 'bg-white/5 text-white/30'
                                    }`}>{p.estado}</span>
                                    <span className="text-[10px] text-white/25">{p.lineas.length} items</span>
                                    <span className="text-[10px] text-white/20 ml-auto">
                                      {new Date(p.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-xs text-white/60 font-medium">{fmtCOP(p.total)}</span>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                      className={`text-white/20 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                      <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                  </div>
                                  {isExpanded && (
                                    <div className="px-3 pb-2 space-y-0.5">
                                      {p.lineas.map(l => (
                                        <div key={l.id} className="flex items-center gap-2 py-0.5">
                                          <span className="w-5 h-5 rounded bg-[#CDA52F]/10 text-[#CDA52F] text-[9px] font-bold flex items-center justify-center shrink-0">{l.cantidad}</span>
                                          <span className="text-[11px] text-white/50 flex-1">{l.nombre}</span>
                                          <span className="text-[10px] text-white/20">{fmtCOP(l.precioUnitario)} c/u</span>
                                          <span className="text-[11px] text-white/50 font-medium w-16 text-right">{fmtCOP(l.total)}</span>
                                        </div>
                                      ))}
                                      {p.nota && <p className="text-[10px] text-white/25 italic mt-1">Nota: {p.nota}</p>}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}

                    {(() => {
                      const pedidosSinCuenta = pedidosTrabajador.filter(p =>
                        !cuentasTrabajador.some(c => c.pedidos.some(cp => cp.id === p.id))
                      )
                      if (pedidosSinCuenta.length === 0) return null
                      return pedidosSinCuenta.map(p => {
                        const isExpanded = expandedTicket === p.id
                        return (
                          <div key={p.id} className="rounded-lg bg-white/[0.03] border border-white/[0.05] overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
                              onClick={() => setExpandedTicket(isExpanded ? null : p.id)}>
                              <span className="text-[10px] font-bold text-[#CDA52F]">#{p.ticketDia}</span>
                              <span className="text-[10px] text-white/40">{p.mesaNombre}</span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                p.estado === 'PENDIENTE' ? 'bg-[#FFE66D]/15 text-[#FFE66D]'
                                : p.estado === 'DESPACHADO' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                                : p.estado === 'CANCELADO' ? 'bg-[#FF5050]/15 text-[#FF5050]'
                                : 'bg-white/5 text-white/30'
                              }`}>{p.estado}</span>
                              <span className="text-[10px] text-white/20 ml-auto">
                                {new Date(p.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-xs text-white/60 font-medium">{fmtCOP(p.total)}</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                className={`text-white/20 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </div>
                            {isExpanded && (
                              <div className="px-3 pb-2 space-y-0.5">
                                {p.lineas.map(l => (
                                  <div key={l.id} className="flex items-center gap-2 py-0.5">
                                    <span className="w-5 h-5 rounded bg-[#CDA52F]/10 text-[#CDA52F] text-[9px] font-bold flex items-center justify-center shrink-0">{l.cantidad}</span>
                                    <span className="text-[11px] text-white/50 flex-1">{l.nombre}</span>
                                    <span className="text-[10px] text-white/20">{fmtCOP(l.precioUnitario)} c/u</span>
                                    <span className="text-[11px] text-white/50 font-medium w-16 text-right">{fmtCOP(l.total)}</span>
                                  </div>
                                ))}
                                {p.nota && <p className="text-[10px] text-white/25 italic mt-1">Nota: {p.nota}</p>}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </Card>
            )}

            <Card className="mb-4">
              <p className="text-xs text-white/40 font-medium mb-3 uppercase tracking-wider">Productos — Cantidades Vendidas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/45 text-xs font-medium py-2 pr-2">Producto</th>
                      <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-16">Precio</th>
                      <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-32">Cantidad</th>
                      <th className="text-right text-[#FFE66D] text-xs font-medium py-2 pl-1 w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLiq.lineas.map(l => (
                      <LineaProductoRow
                        key={`${l.productoId}-${l.nombre}`}
                        linea={l}
                        trabajadorId={activeLiq.trabajadorId}
                        onUpdate={updateLineaCantidad}
                        onArrowNav={handleTableArrowNav}
                      />
                    ))}
                  </tbody>
                  {activeLiq.lineas.some(l => l.total > 0) && (
                    <tfoot>
                      <tr className="border-t-2 border-white/10">
                        <td colSpan={3} className="py-3 text-right text-sm font-bold text-white/70">Total Vendido:</td>
                        <td className="py-3 pl-1 text-right text-sm font-bold text-[#FFE66D]">{fmtFull(activeLiq.lineas.reduce((s, l) => s + l.total, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {(() => {
              const totalVenta = activeLiq.lineas.reduce((s, l) => s + l.total, 0) || activeLiq.totalVenta
              const esBarra = activeLiq.nombre.toLowerCase() === 'barra'
              return (
                <>
                  <Card className="mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#CDA52F' }}>Efectivo s/n Liquidacion</span>
                      <span className="text-lg font-bold" style={{ color: '#CDA52F' }}>{fmtFull(totalVenta)}</span>
                    </div>
                  </Card>
                  {esBarra && (
                    <Card className="mb-4">
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-xs font-medium uppercase tracking-wider text-white/60 shrink-0">Efectivo Entregado</span>
                        <MoneyInput value={activeLiq.efectivoEntregado}
                          onChange={v => updateEfectivoEntregado(activeLiq.trabajadorId, v)} placeholder="$0" />
                      </div>
                    </Card>
                  )}
                </>
              )
            })()}

            {TIPOS_PAGO.map(tipo => {
              const entries = activeLiq.transacciones.map((t, idx) => ({ ...t, idx })).filter(t => t.tipo === tipo)
              const totalTipo = entries.reduce((s, t) => s + t.monto, 0)
              const color = COLORES_PAGO[tipo] || '#4ECDC4'
              return (
                <Card key={tipo} className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color }}>{tipo}</p>
                    <button onClick={() => addTransaccion(activeLiq.trabajadorId, tipo)}
                      className="text-xs px-2 py-1 rounded hover:opacity-80 transition"
                      style={{ backgroundColor: color + '15', color }}>+ Agregar</button>
                  </div>
                  {entries.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin {tipo.toLowerCase()}</p>}
                  <div className="space-y-2">
                    {entries.map(t => (
                      <div key={t.idx} className="flex items-center gap-2">
                        <input value={t.concepto || ''} onChange={e => updateTransaccion(activeLiq.trabajadorId, t.idx, 'concepto', e.target.value)}
                          placeholder="Concepto"
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 w-32" />
                        <MoneyInput value={t.monto} onChange={v => updateTransaccion(activeLiq.trabajadorId, t.idx, 'monto', v)} placeholder="$0" />
                        <button onClick={() => removeTransaccion(activeLiq.trabajadorId, t.idx)}
                          className="text-[#FF5050]/60 hover:text-[#FF5050] text-lg leading-none shrink-0">&times;</button>
                      </div>
                    ))}
                  </div>
                  {entries.length > 0 && (
                    <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm">
                      <span className="text-white/45">Total {tipo}</span>
                      <span className="font-bold" style={{ color }}>{fmtFull(totalTipo)}</span>
                    </div>
                  )}
                </Card>
              )
            })}

            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#C3B1E1' }}>Vales</p>
                <button onClick={() => addVale(activeLiq.trabajadorId)}
                  className="text-xs px-2 py-1 rounded bg-[#C3B1E1]/10 text-[#C3B1E1] hover:bg-[#C3B1E1]/20 transition">+ Agregar</button>
              </div>
              {activeLiq.vales.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin vales</p>}
              <div className="space-y-2">
                {activeLiq.vales.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={v.tercero} onChange={e => updateVale(activeLiq.trabajadorId, i, 'tercero', e.target.value)}
                      placeholder="Nombre 3ero"
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#C3B1E1]/50 w-32" />
                    <MoneyInput value={v.monto} onChange={val => updateVale(activeLiq.trabajadorId, i, 'monto', val)} placeholder="$0" />
                    <button onClick={() => removeVale(activeLiq.trabajadorId, i)}
                      className="text-[#FF5050]/60 hover:text-[#FF5050] text-lg leading-none shrink-0">&times;</button>
                  </div>
                ))}
              </div>
              {activeLiq.vales.length > 0 && (
                <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm">
                  <span className="text-white/45">Total Vales</span>
                  <span className="text-[#C3B1E1] font-bold">{fmtFull(activeLiq.vales.reduce((s, v) => s + v.monto, 0))}</span>
                </div>
              )}
            </Card>

            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">Cortesias</p>
                <button onClick={() => addCortesia(activeLiq.trabajadorId)}
                  className="text-xs px-2 py-1 rounded bg-white/5 text-white/40 hover:bg-white/10 transition">+ Agregar</button>
              </div>
              {activeLiq.cortesias.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin cortesias</p>}
              <div className="space-y-2">
                {activeLiq.cortesias.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={c.concepto} onChange={e => updateCortesia(activeLiq.trabajadorId, i, 'concepto', e.target.value)}
                      placeholder="Concepto"
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 w-32" />
                    <MoneyInput value={c.monto} onChange={val => updateCortesia(activeLiq.trabajadorId, i, 'monto', val)} placeholder="$0" />
                    <button onClick={() => removeCortesia(activeLiq.trabajadorId, i)}
                      className="text-[#FF5050]/60 hover:text-[#FF5050] text-lg leading-none shrink-0">&times;</button>
                  </div>
                ))}
              </div>
              {activeLiq.cortesias.length > 0 && (
                <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm">
                  <span className="text-white/45">Total Cortesias</span>
                  <span className="text-white/60 font-bold">{fmtFull(activeLiq.cortesias.reduce((s, c) => s + c.monto, 0))}</span>
                </div>
              )}
            </Card>

            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">Gastos</p>
                <button onClick={() => addGasto(activeLiq.trabajadorId)}
                  className="text-xs px-2 py-1 rounded bg-white/5 text-white/40 hover:bg-white/10 transition">+ Agregar</button>
              </div>
              {activeLiq.gastos.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin gastos</p>}
              <div className="space-y-2">
                {activeLiq.gastos.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={g.concepto} onChange={e => updateGasto(activeLiq.trabajadorId, i, 'concepto', e.target.value)}
                      placeholder="Concepto"
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 w-32" />
                    <MoneyInput value={g.monto} onChange={val => updateGasto(activeLiq.trabajadorId, i, 'monto', val)} placeholder="$0" />
                    <button onClick={() => removeGasto(activeLiq.trabajadorId, i)}
                      className="text-[#FF5050]/60 hover:text-[#FF5050] text-lg leading-none shrink-0">&times;</button>
                  </div>
                ))}
              </div>
              {activeLiq.gastos.length > 0 && (
                <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm">
                  <span className="text-white/45">Total Gastos</span>
                  <span className="text-white/60 font-bold">{fmtFull(activeLiq.gastos.reduce((s, g) => s + g.monto, 0))}</span>
                </div>
              )}
            </Card>

            {(() => {
              const c = calcularLiquidacion(activeLiq)
              return (
                <Card className="mb-4 border-[#CDA52F]/15">
                  <p className="text-xs text-white/40 font-medium mb-3 uppercase tracking-wider">Cuadre — {activeLiq.nombre}</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-white/45">Total Venta</span><span className="text-[#FFE66D] font-bold">{fmtFull(c.totalVenta)}</span></div>
                    {c.totalDatafono > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Datafono</span><span className="text-white/60">-{fmtFull(c.totalDatafono)}</span></div>}
                    {c.totalQR > 0 && <div className="flex justify-between"><span className="text-white/45">(-) QR</span><span className="text-white/60">-{fmtFull(c.totalQR)}</span></div>}
                    {c.totalNequi > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Nequi</span><span className="text-white/60">-{fmtFull(c.totalNequi)}</span></div>}
                    {c.totalVales > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Vales</span><span className="text-white/60">-{fmtFull(c.totalVales)}</span></div>}
                    {c.totalCortesias > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Cortesias</span><span className="text-white/60">-{fmtFull(c.totalCortesias)}</span></div>}
                    {c.totalGastos > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Gastos</span><span className="text-white/60">-{fmtFull(c.totalGastos)}</span></div>}
                    <div className="border-t border-white/10 my-1" />
                    <div className={`flex justify-between text-lg font-bold mt-1 px-3 py-2 rounded-lg ${c.efectivo >= 0 ? 'bg-[#CDA52F]/10' : 'bg-[#FF5050]/10'}`}>
                      <span className={c.efectivo >= 0 ? 'text-[#CDA52F]' : 'text-[#FF5050]'}>EFECTIVO</span>
                      <span className={c.efectivo >= 0 ? 'text-[#CDA52F]' : 'text-[#FF5050]'}>{fmtFull(c.efectivo)}</span>
                    </div>
                  </div>
                </Card>
              )
            })()}
          </div>
        </div>
      ) : (
        <Card className="text-center py-12 text-white/30 text-sm">Selecciona al menos un trabajador para comenzar</Card>
      )}

      {liquidaciones.length > 0 && (
        <div className="mt-4">
          {!formValido && !guardando && (
            <p className="text-xs text-[#FF5050] mb-2 text-right">
              {sesion.trim() === '' ? 'Falta el ID de sesion' : fechaDuplicada ? 'Ya existe una liquidacion para esta fecha' : 'Al menos un trabajador debe tener productos ingresados'}
            </p>
          )}
          <div className="flex justify-end">
            <Btn onClick={handleGuardar} disabled={!formValido || guardando}>{guardando ? 'Guardando...' : isEditing ? 'Actualizar Liquidacion' : 'Guardar Liquidacion'}</Btn>
          </div>
        </div>
      )}
    </div>
  )
}



function InventarioNuevo({ fecha, setFecha, lineas, totalGeneral, actualizarLinea, reordenarLineas, guardando, fechaDuplicada, handleGuardar, onBack, isEditing = false }: {
  fecha: string; setFecha: (v: string) => void; lineas: LineaInventario[]; totalGeneral: number
  actualizarLinea: (idx: number, campo: 'salidas' | 'invInicial' | 'entradas' | 'invFisico', valor: string) => void
  reordenarLineas: (campo: string, dir: 'asc' | 'desc') => void
  guardando: boolean; fechaDuplicada: boolean; handleGuardar: () => void; onBack: () => void
  isEditing?: boolean
}) {
  const [sortCol, setSortCol] = useState<string>('nombre')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (campo: string) => {
    const newDir = sortCol === campo && sortDir === 'asc' ? 'desc' : 'asc'
    setSortCol(campo)
    setSortDir(newDir)
    reordenarLineas(campo, newDir)
  }

  const SortTh = ({ campo, label, className = '' }: { campo: string; label: string; className?: string }) => (
    <th className={`text-xs font-medium py-2 px-1 cursor-pointer select-none hover:text-white/70 transition-colors ${className}`}
      onClick={() => handleSort(campo)}>
      {label} {sortCol === campo ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  )

  return (
    <div>
      <BackButton onClick={onBack} title={isEditing ? "Editar Inventario" : "Nuevo Inventario"} />
      <div className="flex gap-3 items-end mb-2">
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-44" />
        <div className="text-sm text-white/45 pb-2">Total: <span className="text-[#FFE66D] font-bold">{fmtFull(totalGeneral)}</span></div>
      </div>
      {fechaDuplicada && <p className="text-xs text-[#FF5050] mb-3">Ya existe un inventario para esta fecha.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <SortTh campo="nombre" label="Articulos" className="text-left text-white/45 pr-2" />
              <SortTh campo="salidas" label="Salidas" className="text-center text-white/45 w-20" />
              <SortTh campo="invInicial" label="Inv. Inicial" className="text-center text-white/45 w-24" />
              <SortTh campo="entradas" label="Entradas" className="text-center text-white/45 w-24" />
              <SortTh campo="invFisico" label="Inv. Fisico" className="text-center text-white/45 w-24" />
              <SortTh campo="saldo" label="Saldo" className="text-center text-[#FFE66D]/70 w-20" />
              <SortTh campo="valorUnitario" label="Var Unitario" className="text-right text-white/45 w-24" />
              <SortTh campo="total" label="Total" className="text-right text-[#FFE66D]/70 w-28" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => (
              <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 pr-2 text-white/80 text-xs">{l.nombre}</td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.salidas || ''} onChange={e => actualizarLinea(idx, 'salidas', e.target.value)}
                    onKeyDown={handleTableArrowNav}
                    className="bg-white/5 border border-[#FF5050]/20 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#FF5050]/50" />
                </td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.invInicial || ''} onChange={e => actualizarLinea(idx, 'invInicial', e.target.value)}
                    onKeyDown={handleTableArrowNav}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#CDA52F]/50" />
                </td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.entradas || ''} onChange={e => actualizarLinea(idx, 'entradas', e.target.value)}
                    onKeyDown={handleTableArrowNav}
                    className="bg-white/5 border border-[#4ECDC4]/20 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#4ECDC4]/50" />
                </td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.invFisico || ''} onChange={e => actualizarLinea(idx, 'invFisico', e.target.value)}
                    onKeyDown={handleTableArrowNav}
                    className="bg-white/5 border border-[#CDA52F]/20 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#CDA52F]/50" />
                </td>
                <td className={`py-2 px-1 text-center text-xs font-bold ${l.saldo >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{l.saldo}</td>
                <td className="py-2 px-1 text-right text-xs text-white/45">{fmtFull(l.valorUnitario)}</td>
                <td className={`py-2 pl-1 text-right text-xs font-bold ${l.total >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{fmtFull(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/10">
              <td colSpan={7} className="py-3 text-right text-sm font-bold text-white/70">Total General:</td>
              <td className={`py-3 pl-1 text-right text-sm font-bold ${totalGeneral >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{fmtFull(totalGeneral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end mt-4">
        <Btn onClick={handleGuardar} disabled={guardando || fechaDuplicada}>{guardando ? 'Guardando...' : isEditing ? 'Actualizar Inventario' : 'Guardar Inventario'}</Btn>
      </div>
    </div>
  )
}

function InventarioLista({ inventarios, expandedId, setExpandedId, confirmDelete, setConfirmDelete, handleEliminar, onNuevo, onEditar, productosLoaded, productos, guardarInventario }: {
  inventarios: InventarioType[]; expandedId: string | null; setExpandedId: (id: string | null) => void
  confirmDelete: string | null; setConfirmDelete: (id: string | null) => void
  handleEliminar: (id: string) => void; onNuevo: () => void; onEditar: (inv: InventarioType) => void; productosLoaded: boolean
  productos: Producto[]; guardarInventario: (inv: InventarioInput) => Promise<void>
}) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showImport, setShowImport] = useState(false)
  const filtrados = inventarios.filter(inv => { if (desde && inv.fecha < desde) return false; if (hasta && inv.fecha > hasta) return false; return true })

  const handleImport = async (toImport: InventarioInput[]) => {
    // Importa secuencialmente. Captura errores por inventario para reportar
    // cuáles se guardaron y cuáles fallaron sin abortar todo.
    const fallidos: { fecha: string; error: string }[] = []
    let exitosos = 0
    for (const inv of toImport) {
      try {
        await guardarInventario(inv)
        exitosos++
      } catch (e: any) {
        fallidos.push({ fecha: inv.fecha, error: e?.message ?? 'Error desconocido' })
      }
    }
    if (fallidos.length > 0) {
      const detalle = fallidos.map(f => `${f.fecha}: ${f.error}`).join('\n')
      throw new Error(`${exitosos}/${toImport.length} importados. Fallaron:\n${detalle}`)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} total={inventarios.length} filtrados={filtrados.length} />
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <Btn variant="ghost" onClick={() => setShowImport(true)} disabled={!productosLoaded} className="flex-1 sm:flex-initial">
            Importar Excel
          </Btn>
          <Btn onClick={onNuevo} disabled={!productosLoaded} className="flex-1 sm:flex-initial">{productosLoaded ? '+ Nuevo' : 'Cargando...'}</Btn>
        </div>
      </div>
      {showImport && (
        <ImportarInventarioExcel
          productos={productos}
          inventariosExistentes={inventarios}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
      {filtrados.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">{inventarios.length === 0 ? 'No hay inventarios registrados.' : 'No hay inventarios en el periodo seleccionado.'}</Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(inv => {
            const expanded = expandedId === inv.id
            const conVenta = inv.lineas.filter(l => l.saldo > 0).length
            return (
              <Card key={inv.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : inv.id)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#4ECDC4]/15 text-[#4ECDC4] shrink-0">{inv.fecha}</span>
                    <span className="text-xs text-white/45 truncate">{conVenta} con venta</span>
                  </div>
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="text-sm font-bold text-[#FFE66D]">{fmtCOP(inv.totalGeneral)}</span>
                    <Chevron expanded={expanded} />
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4" onClick={e => e.stopPropagation()}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-white/45 py-1 pr-2">Articulos</th>
                            <th className="text-center text-white/45 py-1 px-1">Salidas</th>
                            <th className="text-center text-white/45 py-1 px-1">Inv. Inicial</th>
                            <th className="text-center text-white/45 py-1 px-1">Entradas</th>
                            <th className="text-center text-white/45 py-1 px-1">Inv. Fisico</th>
                            <th className="text-center text-white/45 py-1 px-1">Saldo</th>
                            <th className="text-right text-white/45 py-1 px-1">Var Unitario</th>
                            <th className="text-right text-white/45 py-1 pl-1">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.lineas.filter(l => l.saldo !== 0 || l.entradas !== 0 || (l.salidas && l.salidas !== 0)).map(l => (
                            <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5">
                              <td className="py-1 pr-2 text-white/70">{l.nombre}</td>
                              <td className="py-1 px-1 text-center text-[#FF5050]">{l.salidas || '-'}</td>
                              <td className="py-1 px-1 text-center text-white/50">{l.invInicial}</td>
                              <td className="py-1 px-1 text-center text-[#4ECDC4]">{l.entradas || '-'}</td>
                              <td className="py-1 px-1 text-center text-white/50">{l.invFisico}</td>
                              <td className={`py-1 px-1 text-center font-bold ${l.saldo >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{l.saldo}</td>
                              <td className="py-1 px-1 text-right text-white/40">{fmtFull(l.valorUnitario)}</td>
                              <td className={`py-1 pl-1 text-right font-bold ${l.total >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{fmtFull(l.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/10">
                            <td colSpan={7} className="py-2 text-right text-sm font-bold text-white/60">Total:</td>
                            <td className="py-2 pl-1 text-right text-sm font-bold text-[#FFE66D]">{fmtFull(inv.totalGeneral)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Btn size="sm" variant="ghost" onClick={() => onEditar(inv)} className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar
                      </Btn>
                      {confirmDelete === inv.id ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-[#FF5050]">Eliminar?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(inv.id)}>Si</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(inv.id)} className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Eliminar</Btn>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}



function ComparativoNuevo({ fecha, setFecha, lineas, totalConteo, totalTiquets, actualizarLinea, guardando, fechaDuplicada, handleGuardar, onBack }: {
  fecha: string; setFecha: (v: string) => void; lineas: LineaComparativo[]
  totalConteo: number; totalTiquets: number
  actualizarLinea: (idx: number, campo: 'conteo' | 'tiquets', valor: string) => void
  guardando: boolean; fechaDuplicada: boolean; handleGuardar: () => void; onBack: () => void
}) {
  const totalDiferencia = lineas.reduce((s, l) => s + l.diferencia, 0)
  return (
    <div>
      <BackButton onClick={onBack} title="Nuevo Comparativo de Ventas" />
      <div className="flex gap-3 items-end mb-2">
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-44" />
      </div>
      {fechaDuplicada && <p className="text-xs text-[#FF5050] mb-3">Ya existe un comparativo para esta fecha.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/45 text-xs font-medium py-2 pr-2">Articulo</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-28">Ventas conteo</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-28">Ventas tiquets</th>
              <th className="text-center text-[#FFE66D]/70 text-xs font-medium py-2 px-1 w-24">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => (
              <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 pr-2 text-white/80 text-xs">{l.nombre}</td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.conteo || ''} onChange={e => actualizarLinea(idx, 'conteo', e.target.value)}
                    onKeyDown={handleTableArrowNav}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#CDA52F]/50" />
                </td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.tiquets || ''} onChange={e => actualizarLinea(idx, 'tiquets', e.target.value)}
                    onKeyDown={handleTableArrowNav}
                    className="bg-white/5 border border-[#4ECDC4]/20 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#4ECDC4]/50" />
                </td>
                <td className="py-2 px-1 text-center">
                  <span className={`inline-block min-w-[32px] px-2 py-0.5 rounded text-xs font-bold ${l.diferencia === 0 ? 'text-white/30' : l.diferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'}`}>
                    {l.diferencia !== 0 ? Math.abs(l.diferencia) : '0'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/10">
              <td className="py-3 text-right text-sm font-bold text-white/70">Total:</td>
              <td className="py-3 text-center text-sm font-bold text-white/80">{totalConteo}</td>
              <td className="py-3 text-center text-sm font-bold text-[#4ECDC4]">{totalTiquets}</td>
              <td className="py-3 text-center">
                <span className={`inline-block min-w-[40px] px-2 py-0.5 rounded text-sm font-bold ${totalDiferencia === 0 ? 'text-white/30' : totalDiferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'}`}>
                  {totalDiferencia}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end mt-4">
        <Btn onClick={handleGuardar} disabled={guardando || fechaDuplicada}>{guardando ? 'Guardando...' : 'Guardar Comparativo'}</Btn>
      </div>
    </div>
  )
}

function ComparativoLista({ comparativos, expandedId, setExpandedId, confirmDelete, setConfirmDelete, handleEliminar, onNuevo, productosLoaded, productos, guardarComparativo }: {
  comparativos: ComparativoType[]; expandedId: string | null; setExpandedId: (id: string | null) => void
  confirmDelete: string | null; setConfirmDelete: (id: string | null) => void
  handleEliminar: (id: string) => void; onNuevo: () => void; productosLoaded: boolean
  productos: Producto[]; guardarComparativo: (comp: ComparativoInput) => Promise<void>
}) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showImport, setShowImport] = useState(false)
  const filtrados = comparativos.filter(c => { if (desde && c.fecha < desde) return false; if (hasta && c.fecha > hasta) return false; return true })

  const handleImport = async (toImport: ComparativoInput[]) => {
    const fallidos: { fecha: string; error: string }[] = []
    let exitosos = 0
    for (const comp of toImport) {
      try {
        await guardarComparativo(comp)
        exitosos++
      } catch (e: any) {
        fallidos.push({ fecha: comp.fecha, error: e?.message ?? 'Error desconocido' })
      }
    }
    if (fallidos.length > 0) {
      const detalle = fallidos.map(f => `${f.fecha}: ${f.error}`).join('\n')
      throw new Error(`${exitosos}/${toImport.length} importados. Fallaron:\n${detalle}`)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} total={comparativos.length} filtrados={filtrados.length} />
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <Btn variant="ghost" onClick={() => setShowImport(true)} disabled={!productosLoaded} className="flex-1 sm:flex-initial">
            Importar Excel
          </Btn>
          <Btn onClick={onNuevo} disabled={!productosLoaded} className="flex-1 sm:flex-initial">{productosLoaded ? '+ Nuevo Comparativo' : 'Cargando...'}</Btn>
        </div>
      </div>
      {showImport && (
        <ImportarComparativoExcel
          productos={productos}
          comparativosExistentes={comparativos}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
      {filtrados.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">{comparativos.length === 0 ? 'No hay comparativos registrados.' : 'No hay comparativos en el periodo seleccionado.'}</Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => {
            const expanded = expandedId === c.id
            const totalDif = c.lineas.reduce((s, l) => s + l.diferencia, 0)
            const conDif = c.lineas.filter(l => l.diferencia !== 0).length
            return (
              <Card key={c.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : c.id)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#4ECDC4]/15 text-[#4ECDC4] shrink-0">{c.fecha}</span>
                    <span className="text-xs text-white/45 truncate">{conDif} con diferencia</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap">
                    <span className="text-[10px] sm:text-xs text-white/40">Conteo: <span className="text-white/70 font-medium">{c.totalConteo}</span></span>
                    <span className="text-[10px] sm:text-xs text-white/40">Tiquets: <span className="text-[#4ECDC4] font-medium">{c.totalTiquets}</span></span>
                    <span className={`text-[10px] sm:text-xs font-bold ${totalDif === 0 ? 'text-white/30' : totalDif > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>Dif: {totalDif}</span>
                    <Chevron expanded={expanded} />
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4" onClick={e => e.stopPropagation()}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-white/45 py-1 pr-2">Articulo</th>
                            <th className="text-center text-white/45 py-1 px-1">Conteo</th>
                            <th className="text-center text-white/45 py-1 px-1">Tiquets</th>
                            <th className="text-center text-white/45 py-1 px-1">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.lineas.map(l => (
                            <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5">
                              <td className="py-1 pr-2 text-white/70">{l.nombre}</td>
                              <td className="py-1 px-1 text-center text-white/50">{l.conteo}</td>
                              <td className="py-1 px-1 text-center text-[#4ECDC4]">{l.tiquets}</td>
                              <td className="py-1 px-1 text-center">
                                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-bold ${l.diferencia === 0 ? 'text-white/30' : l.diferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'}`}>
                                  {Math.abs(l.diferencia)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/10">
                            <td className="py-2 text-right text-sm font-bold text-white/60">Total:</td>
                            <td className="py-2 text-center text-sm font-bold text-white/70">{c.totalConteo}</td>
                            <td className="py-2 text-center text-sm font-bold text-[#4ECDC4]">{c.totalTiquets}</td>
                            <td className="py-2 text-center">
                              <span className={`inline-block min-w-[36px] px-2 py-0.5 rounded text-sm font-bold ${totalDif === 0 ? 'text-white/30' : totalDif > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'}`}>
                                {totalDif}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex justify-end mt-3">
                      {confirmDelete === c.id ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-[#FF5050]">Eliminar?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(c.id)}>Si</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(c.id)} className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Eliminar</Btn>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}



function calcSemanaData(jornadasSem: Jornada[]) {
  const tMap = new Map<string, { nombre: string; color: string; avatar: string; totales: number[] }>()
  for (let i = 0; i < jornadasSem.length; i++) {
    for (const liq of jornadasSem[i].liquidaciones || []) {
      if (!tMap.has(liq.nombre)) tMap.set(liq.nombre, { nombre: liq.nombre, color: liq.color, avatar: liq.avatar, totales: new Array(jornadasSem.length).fill(0) })
      tMap.get(liq.nombre)!.totales[i] = liq.lineas?.reduce((s, l) => s + l.total, 0) || liq.totalVenta || 0
    }
  }
  const resumen = jornadasSem.map(j => { const c = calcularCuadreDia(j.liquidaciones || []); return { sesion: j.sesion, fecha: j.fecha, id: j.id, ventaTotal: c.totalVendido, gastos: c.totalGastos, datafono: c.pagos.Datafono, qr: c.pagos.QR, nequi: c.pagos.Nequi, vales: c.pagos.Vales, cortesias: c.totalCortesias, efectivo: c.pagos.Efectivo, totalRecibido: c.totalRecibido, saldo: c.saldo } })
  const s = (k: string) => resumen.reduce((a, r) => a + ((r as any)[k] || 0), 0)
  const tot = { ventaTotal: s('ventaTotal'), gastos: s('gastos'), datafono: s('datafono'), qr: s('qr'), nequi: s('nequi'), vales: s('vales'), cortesias: s('cortesias'), efectivo: s('efectivo'), totalRecibido: s('totalRecibido'), saldo: s('saldo') }
  return { trabajadores: Array.from(tMap.values()), resumen, tot }
}

const FILAS_SEM: { key: string; label: string; color: string; bold?: boolean; isSaldo?: boolean }[] = [
  { key: 'ventaTotal', label: 'Venta Total', color: '#FFE66D', bold: true },
  { key: 'gastos', label: 'Gastos', color: '' },
  { key: 'datafono', label: 'Datafono', color: '#A8E6CF' },
  { key: 'qr', label: 'QR', color: '#4ECDC4' },
  { key: 'nequi', label: 'Nequi', color: '#FFE66D' },
  { key: 'vales', label: 'Vales', color: '#C3B1E1' },
  { key: 'cortesias', label: 'Cortesias', color: '' },
  { key: 'efectivo', label: 'Efectivo Entregado', color: '#CDA52F' },
  { key: 'totalRecibido', label: 'Total', color: '#4ECDC4', bold: true },
  { key: 'saldo', label: 'Saldo a Favor o en contra', color: '', isSaldo: true },
]

function LiquidacionSemana({ jornadas }: { jornadas: Jornada[]; inventarios: InventarioType[] }) {
  // Default: rango que cubre TODAS las jornadas existentes (para que se vea algo al abrir el tab).
  const [desde, setDesde] = useState(() => {
    if (jornadas.length === 0) return ''
    return jornadas.reduce((min, j) => j.fecha < min ? j.fecha : min, jornadas[0].fecha)
  })
  const [hasta, setHasta] = useState(() => {
    if (jornadas.length === 0) return ''
    return jornadas.reduce((max, j) => j.fecha > max ? j.fecha : max, jornadas[0].fecha)
  })
  const [semanaActiva, setSemanaActiva] = useState<number | null>(null)
  const [jornadaActivaId, setJornadaActivaId] = useState<string | null>(null)

  // Si las jornadas cargan async después del mount y los filtros estaban vacíos, los autocompleta.
  useEffect(() => {
    if (jornadas.length === 0) return
    if (!desde && !hasta) {
      const fechas = jornadas.map(j => j.fecha)
      setDesde(fechas.reduce((min, f) => f < min ? f : min))
      setHasta(fechas.reduce((max, f) => f > max ? f : max))
    }
  }, [jornadas]) // eslint-disable-line react-hooks/exhaustive-deps

  const jornadasFiltradas = useMemo(() => {
    if (!desde || !hasta) return []
    return jornadas.filter(j => j.fecha >= desde && j.fecha <= hasta).sort((a, b) => {
      const f = a.fecha.localeCompare(b.fecha)
      if (f !== 0) return f
      const na = Number(a.sesion.match(/(\d+)/)?.[1] || 0)
      const nb = Number(b.sesion.match(/(\d+)/)?.[1] || 0)
      return na - nb
    })
  }, [jornadas, desde, hasta])

  const fechasDisponibles = useMemo(() => {
    const sorted = [...jornadas].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const grupos: Jornada[][] = []
    let curr: Jornada[] = []
    for (const j of sorted) {
      if (curr.length > 0) {
        const prev = new Date(curr[curr.length - 1].fecha + 'T12:00:00')
        const cur = new Date(j.fecha + 'T12:00:00')
        if ((cur.getTime() - prev.getTime()) / 86400000 > 2) { grupos.push(curr); curr = [] }
      }
      curr.push(j)
    }
    if (curr.length > 0) grupos.push(curr)
    return grupos
  }, [jornadas])

  const jornadasVisibles = useMemo(() => {
    if (jornadaActivaId) return jornadasFiltradas.filter(j => j.id === jornadaActivaId)
    if (semanaActiva === null || !fechasDisponibles[semanaActiva]) return jornadasFiltradas
    const grupo = fechasDisponibles[semanaActiva]
    const ids = new Set(grupo.map(j => j.id))
    return jornadasFiltradas.filter(j => ids.has(j.id))
  }, [jornadasFiltradas, semanaActiva, jornadaActivaId, fechasDisponibles])

  const d = useMemo(() => jornadasVisibles.length > 0 ? calcSemanaData(jornadasVisibles) : null, [jornadasVisibles])

  const diasNombre = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

  return (
    <div>
      <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Liquidacion Semanal</h3>

      <div className="flex items-end gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-white/30 uppercase">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CDA52F]/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-white/30 uppercase">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CDA52F]/50" />
        </div>
        {desde && hasta && (
          <span className="text-[10px] text-white/30 pb-2">{jornadasFiltradas.length} jornada{jornadasFiltradas.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {desde && hasta && fechasDisponibles.filter(g => g[0].fecha <= hasta && g[g.length - 1].fecha >= desde).length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Sesiones en el rango seleccionado</p>
          <div className="flex flex-wrap gap-2">
            {fechasDisponibles.map((grupo, gi) => {
              const f0 = grupo[0].fecha
              const fN = grupo[grupo.length - 1].fecha
              if (!(f0 <= hasta && fN >= desde)) return null
              const isActive = semanaActiva === gi
              return (
                <div key={gi} className="flex flex-col gap-1.5">
                  <button onClick={() => { setJornadaActivaId(null); setSemanaActiva(isActive ? null : gi) }}
                    className={`text-[10px] font-bold tracking-wider transition-all ${isActive && !jornadaActivaId ? 'text-[#CDA52F]' : 'text-white/25 hover:text-[#CDA52F]/60'}`}>
                    S{gi + 1}
                  </button>
                  <div className="flex items-center rounded-xl overflow-hidden border border-[#CDA52F]/25"
                    style={{ boxShadow: isActive ? '0 0 12px rgba(205,165,47,0.12)' : 'none' }}>
                    {grupo.map((j, ji) => {
                      const dt = new Date(j.fecha + 'T12:00:00')
                      const isJornadaActive = jornadaActivaId === j.id
                      const isLast = ji === grupo.length - 1
                      return (
                        <button key={ji} onClick={() => { setSemanaActiva(gi); setJornadaActivaId(isJornadaActive ? null : j.id) }}
                          className={`px-3.5 py-2 text-center transition-all text-[11px] font-medium ${!isLast ? 'border-r border-[#CDA52F]/15' : ''} ${isJornadaActive ? 'bg-[#CDA52F]/20 text-[#CDA52F]' : isActive && !jornadaActivaId ? 'bg-[#CDA52F]/10 text-[#CDA52F]/80' : 'bg-white/[0.02] text-white/35 hover:bg-[#CDA52F]/10 hover:text-[#CDA52F]/70'}`}>
                          {diasNombre[dt.getDay()]} {dt.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!desde || !hasta ? (
        <Card className="text-center py-12 text-white/30 text-sm">Selecciona un rango de fechas para ver la liquidacion semanal.</Card>
      ) : jornadasVisibles.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">No hay jornadas en el rango seleccionado.</Card>
      ) : d && (
        <div className="space-y-4">
          <Card className="border-[#CDA52F]/20">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-center text-white/30 py-2 pr-4 font-bold border-b border-[#CDA52F]/20 text-[10px] uppercase tracking-wider">Meseros</th>
                    {jornadasVisibles.map(j => (
                      <th key={j.id} className="text-right text-white/50 py-2 px-3 font-medium border-b border-[#CDA52F]/20 min-w-[100px]">
                        <div className="text-[11px] font-bold">{j.sesion}</div>
                        <div className="text-[9px] text-white/25 font-normal">{j.fecha}</div>
                      </th>
                    ))}
                    {jornadasVisibles.length > 1 && (
                      <th className="text-center text-[#CDA52F] py-2 px-3 font-bold border-b border-[#CDA52F]/20 bg-white/[0.02]">LIQ. SEMANA</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {d.trabajadores.map(t => (
                    <tr key={t.nombre} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: t.color + '33', color: t.color }}>{t.avatar}</div>
                          <span className="text-white/60 font-medium">{t.nombre}</span>
                        </div>
                      </td>
                      {t.totales.map((v, i) => (
                        <td key={i} className="text-right text-white/50 py-2 px-3">{v > 0 ? fmtCOP(v) : '-'}</td>
                      ))}
                      {jornadasVisibles.length > 1 && (
                        <td className="text-center font-bold text-white/80 py-2 px-3 bg-white/[0.02]">{fmtCOP(t.totales.reduce((a, v) => a + v, 0))}</td>
                      )}
                    </tr>
                  ))}

                  <tr className="border-t-2 border-[#FFE66D]/30">
                    <td className="py-2.5 pr-4 font-bold text-[#FFE66D] text-sm">Venta Total</td>
                    {d.resumen.map((r, i) => (
                      <td key={i} className="text-right font-bold text-[#FFE66D] py-2.5 px-3">{fmtCOP(r.ventaTotal)}</td>
                    ))}
                    {jornadasVisibles.length > 1 && (
                      <td className="text-center font-bold text-[#FFE66D] text-sm py-2.5 px-3 bg-white/[0.02]">{fmtCOP(d.tot.ventaTotal)}</td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="border-white/[0.07]">
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-3">Medios de Pago & Deducciones</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-white/40 py-2 pr-4 font-medium border-b border-white/10"></th>
                    {jornadasVisibles.map(j => (
                      <th key={j.id} className="text-right text-white/40 py-2 px-3 font-medium border-b border-white/10 min-w-[100px]">{j.sesion}</th>
                    ))}
                    {jornadasVisibles.length > 1 && (
                      <th className="text-center text-[#CDA52F] py-2 px-3 font-bold border-b border-white/10 bg-white/[0.02]">Total</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {FILAS_SEM.filter(f => f.key !== 'ventaTotal' && !f.isSaldo).map(f => {
                    const vals = d.resumen.map(r => ((r as any)[f.key] as number) ?? 0)
                    const total = ((d.tot as any)[f.key] as number) ?? 0
                    const isTotal = f.key === 'totalRecibido'
                    return (
                      <tr key={f.key} className={`border-b border-white/[0.04] ${isTotal ? 'border-t-2 border-[#4ECDC4]/30' : ''}`}>
                        <td className={`py-2 pr-4 ${isTotal ? 'font-bold text-white/70 text-sm' : 'text-white/40'}`}>{f.label}</td>
                        {vals.map((v, i) => (
                          <td key={i} className={`text-right py-2 px-3 ${isTotal ? 'font-bold' : ''}`} style={{ color: f.color || 'rgba(255,255,255,0.5)' }}>
                            {fmtCOP(v)}
                          </td>
                        ))}
                        {jornadasVisibles.length > 1 && (
                          <td className={`text-center py-2 px-3 bg-white/[0.02] ${isTotal ? 'font-bold text-sm' : 'font-bold'}`} style={{ color: f.color || '#CDA52F' }}>
                            {fmtCOP(total)}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {(() => {
                    const saldoVals = d.resumen.map(r => r.saldo)
                    const saldoTotal = d.tot.saldo
                    return (
                      <tr className="border-t-2 border-white/20">
                        <td className="py-3 pr-4 font-bold text-sm" style={{ color: saldoTotal === 0 ? '#4ECDC4' : saldoTotal > 0 ? '#4ECDC4' : '#FF5050' }}>Saldo</td>
                        {saldoVals.map((v, i) => (
                          <td key={i} className="text-right py-3 px-3 font-bold" style={{ color: v === 0 ? '#60A5FA' : v > 0 ? '#4ECDC4' : '#FF5050' }}>
                            {fmtCOP(v)}
                          </td>
                        ))}
                        {jornadasVisibles.length > 1 && (
                          <td className="text-center py-3 px-3 font-bold text-sm bg-white/[0.02]" style={{ color: saldoTotal === 0 ? '#60A5FA' : saldoTotal > 0 ? '#4ECDC4' : '#FF5050' }}>
                            {fmtCOP(saldoTotal)}
                          </td>
                        )}
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end mt-4">
            <Btn variant="ghost" onClick={() => printSemanal(jornadasVisibles, d)} className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Imprimir Liquidacion
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}

const LineaProductoRow = React.memo(function LineaProductoRow({
  linea, trabajadorId, onUpdate, onArrowNav,
}: {
  linea: LiquidacionTrabajador['lineas'][number]
  trabajadorId: string
  onUpdate: (tid: string, productoId: string, cantidad: number) => void
  onArrowNav: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02]">
      <td className="py-2 pr-2 text-white/80 text-xs">{linea.nombre}</td>
      <td className="py-2 px-1 text-center text-xs text-white/45">{fmtCOP(linea.precioUnitario)}</td>
      <td className="py-1 px-1">
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => onUpdate(trabajadorId, linea.productoId, linea.cantidad - 1)}
            className="w-7 h-7 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white flex items-center justify-center text-sm font-bold">-</button>
          <input type="number" min={0} value={linea.cantidad || ''}
            onChange={e => onUpdate(trabajadorId, linea.productoId, Number(e.target.value) || 0)}
            onKeyDown={onArrowNav}
            className="bg-white/5 border border-white/10 rounded px-1 py-1 text-xs text-white w-12 text-center focus:outline-none focus:border-[#CDA52F]/50" />
          <button onClick={() => onUpdate(trabajadorId, linea.productoId, linea.cantidad + 1)}
            className="w-7 h-7 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white flex items-center justify-center text-sm font-bold">+</button>
        </div>
      </td>
      <td className="py-2 pl-1 text-right text-xs font-bold text-white/30">{linea.total > 0 ? <span className="text-[#FFE66D]">{fmtCOP(linea.total)}</span> : '-'}</td>
    </tr>
  )
})
