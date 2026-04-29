import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Btn } from './ui/Btn'
import type {
  Producto, Trabajador, Jornada, LiquidacionTrabajador,
  LineaVenta, TransaccionPago, Vale, Cortesia, GastoDiario,
} from '../types'

const COLORES_TRABAJADOR = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A8E6CF', '#C3B1E1', '#FF8FA3', '#98D8C8', '#FFB347']

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

type Layout = 'liq-diaria' | 'liq-barra'

interface LineaProblema {
  nombreExcel: string
  motivo: string
}

interface ParsedLiq {
  trabajadorNombreExcel: string
  trabajadorMatch?: Trabajador
  layout: Layout
  liquidacion: LiquidacionTrabajador
  lineasProblema: LineaProblema[]
}

interface ParsedJornada {
  fecha: string
  liquidaciones: ParsedLiq[]
  totalVendido: number
  warnings: string[]
}

interface ParseResult {
  jornadas: ParsedJornada[]
  trabajadoresNoEncontrados: string[]
  globalWarnings: string[]
}

const LIQ_DIARIA_PREFIX = 'Liq Diaria'
const LIQ_BARRA_NAME = 'Liq Barra'

const ROW_DATE = 0
const ROW_PRODUCT_FIRST = 2
const ROW_PRODUCT_LAST = 51
const ROW_EFECTIVO = 54
const ROW_EFECTIVO_ENTREGADO = 55
const ROW_PAGOS_FIRST = 59
const ROW_PAGOS_LAST = 64
const ROW_CORTESIAS_FIRST = 68
const ROW_CORTESIAS_LAST = 73
const ROW_GASTOS_FIRST = 76
const ROW_GASTOS_LAST = 81
const ROW_BARRA_DATA_LAST = 95

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d+)\s*ml\b/g, '$1ml')
    .replace(/(\d+)\s*(lt|l|litro|litros)\b/g, '$1l')
    .replace(/\s+/g, ' ')
    .trim()
}

function buscarProducto(nombreExcel: string, productos: Producto[]): { producto?: Producto; ambiguo: boolean; candidatos?: string[] } {
  const target = normalizar(nombreExcel)
  if (!target) return { ambiguo: false }
  const exacto = productos.find(p => normalizar(p.nombre) === target)
  if (exacto) return { producto: exacto, ambiguo: false }
  const exPref = productos.filter(p => normalizar(p.nombre).startsWith(target + ' '))
  if (exPref.length === 1) return { producto: exPref[0], ambiguo: false }
  if (exPref.length > 1) return { ambiguo: true, candidatos: exPref.map(p => p.nombre) }
  const bdPref = productos.filter(p => target.startsWith(normalizar(p.nombre) + ' '))
  if (bdPref.length === 1) return { producto: bdPref[0], ambiguo: false }
  if (bdPref.length > 1) return { ambiguo: true, candidatos: bdPref.map(p => p.nombre) }
  return { ambiguo: false }
}

function isHeaderText(s: string): boolean {
  if (!s) return true
  const lower = s.toLowerCase().trim()
  return (
    lower.startsWith('total') ||
    lower.startsWith('vales') ||
    lower.startsWith('cortes') ||
    lower.startsWith('gastos') ||
    lower.startsWith('datafono') ||
    lower.startsWith('medios') ||
    lower === 'qr' || lower === 'nq' || lower === 'nequi' ||
    lower === '3ero' || lower === 'vr.' || lower === 'vr' ||
    lower === 'concep' || lower === 'concep.' || lower === 'conc.' || lower === 'conc' ||
    lower.startsWith('efectivo')
  )
}

function getNum(sh: XLSX.WorkSheet, r: number, c: number): number {
  const cell = sh[XLSX.utils.encode_cell({ r, c })]
  if (!cell) return 0
  return typeof cell.v === 'number' ? cell.v : 0
}

function getStr(sh: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sh[XLSX.utils.encode_cell({ r, c })]
  if (!cell || cell.v == null) return ''
  return String(cell.v).trim()
}

function detectarFechas(sh: XLSX.WorkSheet): { fecha: string; startCol: number }[] {
  const merges = sh['!merges'] || []
  const out: { fecha: string; startCol: number }[] = []
  for (const m of merges) {
    if (m.s.r !== ROW_DATE) continue
    const cell = sh[XLSX.utils.encode_cell({ r: ROW_DATE, c: m.s.c })]
    if (!cell) continue
    const v = cell.v
    if (typeof v === 'number' && v > 40000) {
      const d = XLSX.SSF.parse_date_code(v)
      if (!d) continue
      const fecha = `${d.y}-${String(d.m).padStart(2, '0')}-${String(Math.floor(d.d)).padStart(2, '0')}`
      out.push({ fecha, startCol: m.s.c })
    }
  }
  return out
}

function parseDateBlock(
  sh: XLSX.WorkSheet,
  X: number,
  layout: Layout,
  productos: Producto[],
  trabajador: Trabajador | undefined,
  trabajadorNombreExcel: string,
): { liq: LiquidacionTrabajador; problemas: LineaProblema[]; tieneData: boolean } {
  const lineas: LineaVenta[] = []
  const problemas: LineaProblema[] = []
  const productoIdsUsados = new Set<string>()

  for (let r = ROW_PRODUCT_FIRST; r <= ROW_PRODUCT_LAST; r++) {
    const total = getNum(sh, r, X + 2)
    const cantidad = getNum(sh, r, X)
    if (total <= 0 && cantidad <= 0) continue

    const nombreExcel = getStr(sh, r, 0)
    if (!nombreExcel) continue

    const precioExcel = getNum(sh, r, X + 1)
    const precioUnit = precioExcel > 0 ? precioExcel : (cantidad > 0 ? Math.round(total / cantidad) : 0)
    const cantFinal = cantidad > 0 ? cantidad : (precioUnit > 0 ? Math.round(total / precioUnit) : 0)

    const m = buscarProducto(nombreExcel, productos)
    if (m.ambiguo) {
      problemas.push({ nombreExcel, motivo: `Ambiguo: ${m.candidatos?.join(' / ')}` })
      continue
    }
    if (!m.producto) {
      problemas.push({ nombreExcel, motivo: 'No existe en BD' })
      continue
    }
    if (productoIdsUsados.has(m.producto.id)) {
      problemas.push({ nombreExcel, motivo: `Mapea a "${m.producto.nombre}" que ya estaba en este día` })
      continue
    }
    productoIdsUsados.add(m.producto.id)

    lineas.push({
      productoId: m.producto.id,
      nombre: m.producto.nombre,
      precioUnitario: precioUnit,
      cantidad: cantFinal,
      total,
    })
  }

  const totalVenta = lineas.reduce((s, l) => s + l.total, 0)

  const transacciones: TransaccionPago[] = []
  const vales: Vale[] = []
  const cortesias: Cortesia[] = []
  const gastos: GastoDiario[] = []

  if (layout === 'liq-diaria') {
    for (let r = ROW_PAGOS_FIRST; r <= ROW_PAGOS_LAST; r++) {
      const dat = getNum(sh, r, X - 2)
      if (dat > 0) transacciones.push({ tipo: 'Datafono', concepto: '', monto: dat })
      const qr = getNum(sh, r, X - 1)
      if (qr > 0) transacciones.push({ tipo: 'QR', concepto: '', monto: qr })
      const nq = getNum(sh, r, X)
      if (nq > 0) transacciones.push({ tipo: 'Nequi', concepto: '', monto: nq })

      const vTercero = getStr(sh, r, X + 1)
      const vMonto = getNum(sh, r, X + 2)
      if (vMonto > 0 && !isHeaderText(vTercero)) {
        vales.push({ tercero: vTercero || 'Sin nombre', monto: vMonto })
      }
    }
    for (let r = ROW_CORTESIAS_FIRST; r <= ROW_CORTESIAS_LAST; r++) {
      const conc = getStr(sh, r, X + 1)
      const monto = getNum(sh, r, X + 2)
      if (monto > 0 && !isHeaderText(conc)) {
        cortesias.push({ concepto: conc || 'Sin concepto', monto })
      }
    }
    for (let r = ROW_GASTOS_FIRST; r <= ROW_GASTOS_LAST; r++) {
      const conc = getStr(sh, r, X + 1)
      const monto = getNum(sh, r, X + 2)
      if (monto > 0 && !isHeaderText(conc)) {
        gastos.push({ concepto: conc || 'Sin concepto', monto })
      }
    }
  } else {
    for (let r = ROW_PAGOS_FIRST; r <= ROW_BARRA_DATA_LAST; r++) {
      if (r >= ROW_PAGOS_FIRST && r <= ROW_PAGOS_LAST) {
        const vTercero = getStr(sh, r, X + 3)
        const vMonto = getNum(sh, r, X + 4)
        if (vMonto > 0 && !isHeaderText(vTercero)) {
          vales.push({ tercero: vTercero || 'Sin nombre', monto: vMonto })
        }
      }
      if (r >= ROW_CORTESIAS_FIRST && r <= ROW_BARRA_DATA_LAST) {
        const conc = getStr(sh, r, X + 3)
        const monto = getNum(sh, r, X + 4)
        if (monto > 0 && !isHeaderText(conc)) {
          cortesias.push({ concepto: conc || 'Sin concepto', monto })
        }
      }
      const gConc = getStr(sh, r, X - 2)
      const gMonto = getNum(sh, r, X - 1)
      if (gMonto > 0 && !isHeaderText(gConc)) {
        gastos.push({ concepto: gConc || 'Sin concepto', monto: gMonto })
      }
      const dat = getNum(sh, r, X)
      if (dat > 0) transacciones.push({ tipo: 'Datafono', concepto: '', monto: dat })
      const qr = getNum(sh, r, X + 1)
      if (qr > 0) transacciones.push({ tipo: 'QR', concepto: '', monto: qr })
      const nq = getNum(sh, r, X + 2)
      if (nq > 0) transacciones.push({ tipo: 'Nequi', concepto: '', monto: nq })
    }
  }

  let efectivoEntregado: number
  if (layout === 'liq-barra') {
    efectivoEntregado = getNum(sh, ROW_EFECTIVO_ENTREGADO, X + 2)
  } else {
    const sumDatafono = transacciones.filter(t => t.tipo === 'Datafono').reduce((s, t) => s + t.monto, 0)
    const sumQR = transacciones.filter(t => t.tipo === 'QR').reduce((s, t) => s + t.monto, 0)
    const sumNequi = transacciones.filter(t => t.tipo === 'Nequi').reduce((s, t) => s + t.monto, 0)
    const sumVales = vales.reduce((s, v) => s + v.monto, 0)
    const sumCortesias = cortesias.reduce((s, c) => s + c.monto, 0)
    const sumGastos = gastos.reduce((s, g) => s + g.monto, 0)
    efectivoEntregado = totalVenta - sumDatafono - sumQR - sumNequi - sumVales - sumCortesias - sumGastos
  }

  const liq: LiquidacionTrabajador = {
    trabajadorId: trabajador?.id || '',
    nombre: trabajador?.nombre || trabajadorNombreExcel,
    color: trabajador?.color || '#CDA52F',
    avatar: trabajador?.avatar || trabajadorNombreExcel.slice(0, 2).toUpperCase(),
    lineas,
    transacciones,
    vales,
    cortesias,
    gastos,
    totalVenta,
    efectivoEntregado,
  }

  const tieneData = lineas.length > 0 || transacciones.length > 0 || vales.length > 0 || cortesias.length > 0 || gastos.length > 0 || efectivoEntregado > 0

  return { liq, problemas, tieneData }
}

export function parseLiquidacionWorkbook(buf: ArrayBuffer, productos: Producto[], trabajadores: Trabajador[]): ParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const globalWarnings: string[] = []
  const trabajadoresNoEncontrados: string[] = []

  const porFecha = new Map<string, ParsedJornada>()

  for (const sheetName of wb.SheetNames) {
    const isBarra = sheetName === LIQ_BARRA_NAME
    const isDiaria = sheetName.startsWith(LIQ_DIARIA_PREFIX)
    if (!isBarra && !isDiaria) continue

    const sh = wb.Sheets[sheetName]
    if (!sh) continue

    const layout: Layout = isBarra ? 'liq-barra' : 'liq-diaria'
    const trabajadorNombreExcel = String(sh[XLSX.utils.encode_cell({ r: 0, c: 1 })]?.v || '').trim()
      || sheetName.replace(/^Liq Diaria\s+/i, '').trim()
      || (isBarra ? 'Barra' : 'Sin nombre')

    const trabajador = trabajadores.find(t => normalizar(t.nombre) === normalizar(trabajadorNombreExcel))
    if (!trabajador && !trabajadoresNoEncontrados.includes(trabajadorNombreExcel)) {
      trabajadoresNoEncontrados.push(trabajadorNombreExcel)
    }

    const fechas = detectarFechas(sh)
    if (fechas.length === 0) {
      globalWarnings.push(`${sheetName}: no se detectaron fechas en fila 1`)
      continue
    }

    for (const f of fechas) {
      const { liq, problemas, tieneData } = parseDateBlock(sh, f.startCol, layout, productos, trabajador, trabajadorNombreExcel)
      if (!tieneData) continue

      let pj = porFecha.get(f.fecha)
      if (!pj) {
        pj = { fecha: f.fecha, liquidaciones: [], totalVendido: 0, warnings: [] }
        porFecha.set(f.fecha, pj)
      }
      pj.liquidaciones.push({
        trabajadorNombreExcel,
        trabajadorMatch: trabajador,
        layout,
        liquidacion: liq,
        lineasProblema: problemas,
      })
      pj.totalVendido += liq.totalVenta
    }
  }

  const jornadas = Array.from(porFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
  return { jornadas, trabajadoresNoEncontrados, globalWarnings }
}

interface Props {
  productos: Producto[]
  trabajadores: Trabajador[]
  jornadasExistentes: Jornada[]
  agregarTrabajador: (t: Omit<Trabajador, 'id'>) => Promise<void>
  onImport: (toImport: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }[]) => Promise<void>
  onClose: () => void
}

export default function ImportarLiquidacionExcel({ productos, trabajadores, jornadasExistentes, agregarTrabajador, onImport, onClose }: Props) {
  const [parsing, setParsing] = useState(false)
  const [creandoTrabajadores, setCreandoTrabajadores] = useState(false)
  const [trabajadoresCreados, setTrabajadoresCreados] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({})
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({})
  const [needsReparse, setNeedsReparse] = useState(false)
  const fileBufRef = useRef<ArrayBuffer | null>(null)

  const fechasExistentes = new Set(jornadasExistentes.map(j => j.fecha))

  const reparsear = useCallback((buf: ArrayBuffer) => {
    const result = parseLiquidacionWorkbook(buf, productos, trabajadores)
    if (result.jornadas.length === 0) {
      setError(result.globalWarnings[0] || 'No se encontraron hojas Liq Diaria * o Liq Barra con datos')
      return
    }
    setParsed(result)
    const existentes = new Set(jornadasExistentes.map(j => j.fecha))
    const initSel: Record<string, boolean> = {}
    for (const j of result.jornadas) {
      if (!existentes.has(j.fecha)) initSel[j.fecha] = true
    }
    setSeleccionados(initSel)
  }, [productos, trabajadores, jornadasExistentes])

  useEffect(() => {
    if (!needsReparse || !fileBufRef.current) return
    reparsear(fileBufRef.current)
    setNeedsReparse(false)
  }, [needsReparse, reparsear])

  const handleFile = async (file: File) => {
    setParsing(true)
    setError('')
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      fileBufRef.current = buf
      const result = parseLiquidacionWorkbook(buf, productos, trabajadores)

      if (result.trabajadoresNoEncontrados.length > 0) {
        setCreandoTrabajadores(true)
        const creados: string[] = []
        for (let i = 0; i < result.trabajadoresNoEncontrados.length; i++) {
          const raw = result.trabajadoresNoEncontrados[i]
          const nombre = capitalizar(raw)
          try {
            await agregarTrabajador({
              nombre,
              color: COLORES_TRABAJADOR[(trabajadores.length + i) % COLORES_TRABAJADOR.length],
              avatar: nombre.slice(0, 2).toUpperCase(),
              activo: true,
            })
            creados.push(nombre)
          } catch (e: any) {
            console.warn(`No se pudo crear trabajador ${nombre}:`, e?.message)
          }
        }
        setTrabajadoresCreados(creados)
        setCreandoTrabajadores(false)
        setNeedsReparse(true)
      } else if (result.jornadas.length === 0) {
        setError(result.globalWarnings[0] || 'No se encontraron hojas Liq Diaria * o Liq Barra con datos')
      } else {
        setParsed(result)
        const initSel: Record<string, boolean> = {}
        for (const j of result.jornadas) {
          if (!fechasExistentes.has(j.fecha)) initSel[j.fecha] = true
        }
        setSeleccionados(initSel)
      }
    } catch (e: any) {
      setError(e?.message || 'Error al leer el archivo')
    } finally {
      setParsing(false)
    }
  }

  const nuevas = parsed?.jornadas.filter(j => !fechasExistentes.has(j.fecha)) ?? []
  const duplicadas = parsed?.jornadas.filter(j => fechasExistentes.has(j.fecha)) ?? []
  const aImportar = nuevas.filter(j => seleccionados[j.fecha])
  const todasSeleccionadas = nuevas.length > 0 && aImportar.length === nuevas.length

  const totalAvisos = nuevas.reduce((s, j) =>
    s + j.liquidaciones.reduce((s2, l) =>
      s2 + l.lineasProblema.length + (l.trabajadorMatch ? 0 : 1), 0), 0)

  const toggleFecha = (fecha: string) => setSeleccionados(s => ({ ...s, [fecha]: !s[fecha] }))
  const toggleTodas = () => {
    if (todasSeleccionadas) setSeleccionados({})
    else {
      const all: Record<string, boolean> = {}
      for (const j of nuevas) all[j.fecha] = true
      setSeleccionados(all)
    }
  }

  const handleConfirm = async () => {
    if (aImportar.length === 0) return
    setImporting(true)
    setError('')
    try {
      const toImport = aImportar.map(j => ({
        sesion: j.fecha,
        fecha: j.fecha,
        liquidaciones: j.liquidaciones
          .filter(l => l.trabajadorMatch)
          .map(l => l.liquidacion),
      })).filter(j => j.liquidaciones.length > 0)
      await onImport(toImport)
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#141414] border border-white/[0.07] rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Importar Liquidaciones desde Excel</h2>
            <p className="text-xs text-white/40 mt-0.5">Hojas: <span className="text-[#CDA52F]">Liq Diaria *</span> y <span className="text-[#CDA52F]">Liq Barra</span></p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        {!parsed && (
          <div>
            <label className="block">
              <div
                onDragOver={e => { e.preventDefault(); if (!parsing) setDragOver(true) }}
                onDragLeave={e => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return
                  setDragOver(false)
                }}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  if (parsing) return
                  const file = e.dataTransfer.files?.[0]
                  if (!file) return
                  const valid = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
                  if (!valid) { setError('El archivo debe ser .xlsx o .xls'); return }
                  handleFile(file)
                }}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                    : 'border-white/[0.1] hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/[0.03]'
                }`}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30 mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm text-white/70">{dragOver ? 'Suelta el archivo' : 'Click para seleccionar archivo Excel'}</p>
                <p className="text-xs text-white/40 mt-1">o arrastra el .xlsx aquí</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={parsing || creandoTrabajadores}
                onChange={e => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0])
                  e.target.value = ''
                }}
                className="hidden"
              />
            </label>
            {parsing && <p className="text-xs text-white/40 mt-3 text-center">Analizando...</p>}
            {creandoTrabajadores && <p className="text-xs text-[#CDA52F] mt-3 text-center">Creando trabajadores faltantes...</p>}
            {needsReparse && !creandoTrabajadores && <p className="text-xs text-white/40 mt-3 text-center">Sincronizando lista de trabajadores...</p>}
            {error && <p className="text-xs text-[#FF5050] mt-3 text-center">{error}</p>}
          </div>
        )}

        {parsed && (
          <div>
            <p className="text-[11px] text-white/40 mb-3">Archivo: <span className="text-white/70">{fileName}</span></p>

            {trabajadoresCreados.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
                <p className="text-[11px] text-[#4ECDC4] font-medium mb-1">Trabajadores creados automáticamente:</p>
                <p className="text-[11px] text-white/60">{trabajadoresCreados.join(', ')}</p>
              </div>
            )}

            {parsed.trabajadoresNoEncontrados.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-[#FF5050]/10 border border-[#FF5050]/20">
                <p className="text-[11px] text-[#FF5050] font-medium mb-1">Trabajadores no encontrados (no se pudieron crear):</p>
                <p className="text-[11px] text-white/60">{parsed.trabajadoresNoEncontrados.join(', ')}</p>
                <p className="text-[10px] text-white/40 mt-1">Se omitirán esas hojas. Revisa la conexión y vuelve a importar.</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="p-3 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
                <p className="text-2xl font-bold text-[#4ECDC4]">{nuevas.length}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mt-1">Nuevas</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-2xl font-bold text-white/40">{duplicadas.length}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Duplicadas (skip)</p>
              </div>
              <div className="p-3 rounded-lg bg-[#FFE66D]/10 border border-[#FFE66D]/20">
                <p className="text-2xl font-bold text-[#FFE66D]">{totalAvisos}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mt-1">Avisos</p>
              </div>
            </div>

            {nuevas.length > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[11px] text-white/50">Selecciona qué importar:</p>
                <button onClick={toggleTodas} className="text-[11px] text-[#D4AF37] hover:underline" type="button">
                  {todasSeleccionadas ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              </div>
            )}

            <div className="space-y-1.5 mb-4 max-h-72 overflow-auto pr-2">
              {nuevas.map(j => {
                const checked = !!seleccionados[j.fecha]
                const isExpanded = !!expandidas[j.fecha]
                const liqsValidas = j.liquidaciones.filter(l => l.trabajadorMatch)
                const problemasCount = j.liquidaciones.reduce((s, l) => s + l.lineasProblema.length, 0)
                const sinTrabajador = j.liquidaciones.filter(l => !l.trabajadorMatch).length
                return (
                  <div
                    key={j.fecha}
                    className={`rounded-lg border transition-colors ${
                      checked ? 'bg-[#4ECDC4]/10 border-[#4ECDC4]/30' : 'bg-white/[0.02] border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2 p-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFecha(j.fecha)}
                        className="w-4 h-4 accent-[#4ECDC4] cursor-pointer shrink-0"
                      />
                      <span className={`text-sm flex-1 ${checked ? 'text-white' : 'text-white/60'}`}>{j.fecha}</span>
                      <span className="text-[11px] text-white/50 shrink-0">
                        {liqsValidas.length} trab.
                        {sinTrabajador > 0 && <span className="text-[#FF5050]"> · {sinTrabajador} sin match</span>}
                        {problemasCount > 0 && <span className="text-[#FFE66D]"> · {problemasCount} ⚠</span>}
                      </span>
                      <span className={`text-xs font-semibold shrink-0 ${checked ? 'text-white' : 'text-white/50'}`}>
                        ${j.totalVendido.toLocaleString('es-CO')}
                      </span>
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setExpandidas(s => ({ ...s, [j.fecha]: !s[j.fecha] })) }}
                        className="text-white/40 hover:text-white/80 text-xs px-1 shrink-0"
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-2 pt-1 border-t border-white/[0.05] space-y-2 max-h-72 overflow-auto">
                        {j.liquidaciones.map((l, i) => (
                          <div key={i} className="text-[11px]">
                            <div className="flex items-center gap-2 py-1">
                              <span className={`font-semibold ${l.trabajadorMatch ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                                {l.trabajadorMatch ? '✓' : '✗'}
                              </span>
                              <span className={l.trabajadorMatch ? 'text-white/80' : 'text-white/50'}>
                                {l.trabajadorNombreExcel}
                                {l.trabajadorMatch && l.trabajadorMatch.nombre !== l.trabajadorNombreExcel && (
                                  <span className="text-white/40"> → {l.trabajadorMatch.nombre}</span>
                                )}
                              </span>
                              <span className="text-white/40 ml-auto">
                                ${l.liquidacion.totalVenta.toLocaleString('es-CO')}
                                {' · '}{l.liquidacion.lineas.length} prods
                              </span>
                            </div>
                            {l.lineasProblema.length > 0 && (
                              <div className="ml-5 space-y-0.5">
                                {l.lineasProblema.slice(0, 6).map((p, pi) => (
                                  <div key={pi} className="text-[10px] text-[#FFE66D]">
                                    ⚠ <span className="font-medium">{p.nombreExcel}</span> <span className="text-white/40">— {p.motivo}</span>
                                  </div>
                                ))}
                                {l.lineasProblema.length > 6 && (
                                  <div className="text-[10px] text-white/30">… y {l.lineasProblema.length - 6} más</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {duplicadas.map(j => (
                <div key={j.fecha} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] opacity-60">
                  <span className="w-4 h-4 rounded bg-white/[0.05] shrink-0 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/30"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                  <span className="text-sm text-white/40 flex-1">{j.fecha}</span>
                  <span className="text-[11px] text-white/30 shrink-0">ya existe — saltar</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-white/40 mb-3">
              Click en ▶ para ver el detalle por trabajador y los productos que no matchearon.
            </p>

            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose} disabled={importing}>Cancelar</Btn>
              <Btn variant="primary" disabled={aImportar.length === 0 || importing} onClick={handleConfirm}>
                {importing
                  ? 'Importando...'
                  : aImportar.length === 0
                    ? 'Selecciona al menos una'
                    : `Importar ${aImportar.length} jornada${aImportar.length === 1 ? '' : 's'}`}
              </Btn>
            </div>
            {error && <p className="text-xs text-[#FF5050] mt-2 text-right">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
