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

interface ProductoFaltante {
  nombre: string
  precioEstimado: number
  skip?: boolean
}

interface TrabajadorNoMatch {
  nombreExcel: string
  sugerenciaId?: string
}

interface ParseResult {
  jornadas: ParsedJornada[]
  trabajadoresNoEncontrados: TrabajadorNoMatch[]
  productosNoEncontrados: ProductoFaltante[]
  globalWarnings: string[]
}

const LIQ_DIARIA_PREFIX = 'Liq Diaria'
const LIQ_BARRA_NAME = 'Liq Barra'

const ROW_DATE = 0
const ROW_PRODUCT_FIRST = 2
const ROW_PRODUCT_LAST = 51
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

function normalizarMesero(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^(liq\s*\.?|liq\s+diaria|sr\s*\.?|sra\s*\.?|srta\s*\.?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buscarTrabajadorFuzzy(nombreExcel: string, trabajadores: Trabajador[]): { trabajador?: Trabajador; sugerencia?: Trabajador } {
  const target = normalizarMesero(nombreExcel)
  if (!target) return {}
  const exact = trabajadores.find(t => normalizarMesero(t.nombre) === target)
  if (exact) return { trabajador: exact }
  const firstWord = target.split(' ')[0]
  if (firstWord) {
    const fw = trabajadores.filter(t => normalizarMesero(t.nombre).split(' ')[0] === firstWord)
    if (fw.length === 1) return { trabajador: fw[0] }
    if (fw.length > 1) return { sugerencia: fw[0] }
  }
  const sub = trabajadores.filter(t => {
    const n = normalizarMesero(t.nombre)
    return n.includes(target) || target.includes(n)
  })
  if (sub.length === 1) return { trabajador: sub[0] }
  if (sub.length > 1) return { sugerencia: sub[0] }
  return {}
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
): { liq: LiquidacionTrabajador; problemas: LineaProblema[]; tieneData: boolean; productosFaltantes: ProductoFaltante[] } {
  const lineas: LineaVenta[] = []
  const problemas: LineaProblema[] = []
  const productosFaltantes: ProductoFaltante[] = []
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
      problemas.push({ nombreExcel, motivo: 'No existe en el sistema' })
      productosFaltantes.push({ nombre: nombreExcel, precioEstimado: precioUnit })
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

  const efectivoEntregado = getNum(sh, ROW_EFECTIVO_ENTREGADO, X + 2)

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

  return { liq, problemas, tieneData, productosFaltantes }
}

export function parseLiquidacionWorkbook(
  buf: ArrayBuffer,
  productos: Producto[],
  trabajadores: Trabajador[],
  trabajadorOverrides: Record<string, string> = {},
): ParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const globalWarnings: string[] = []
  const trabajadoresNoEncontradosMap = new Map<string, TrabajadorNoMatch>()
  const productosFaltantesMap = new Map<string, ProductoFaltante>()

  const porFecha = new Map<string, ParsedJornada>()

  for (const sheetName of wb.SheetNames) {
    const isDiaria = sheetName.startsWith(LIQ_DIARIA_PREFIX)
    const isBarra = !isDiaria && (
      sheetName === LIQ_BARRA_NAME ||
      sheetName.toLowerCase().startsWith('liq ')
    )
    if (!isBarra && !isDiaria) continue

    const sh = wb.Sheets[sheetName]
    if (!sh) continue

    const layout: Layout = isBarra ? 'liq-barra' : 'liq-diaria'
    const trabajadorNombreExcel = String(sh[XLSX.utils.encode_cell({ r: 0, c: 1 })]?.v || '').trim()
      || sheetName.replace(/^Liq\s*(Diaria\s+)?/i, '').trim()
      || (isBarra ? 'Barra' : 'Sin nombre')

    const overrideId = trabajadorOverrides[trabajadorNombreExcel]
    let trabajador: Trabajador | undefined
    if (overrideId) {
      trabajador = trabajadores.find(t => t.id === overrideId)
    }
    let sugerencia: Trabajador | undefined
    if (!trabajador) {
      const fz = buscarTrabajadorFuzzy(trabajadorNombreExcel, trabajadores)
      trabajador = fz.trabajador
      sugerencia = fz.sugerencia
    }
    if (!trabajador && !trabajadoresNoEncontradosMap.has(trabajadorNombreExcel)) {
      trabajadoresNoEncontradosMap.set(trabajadorNombreExcel, {
        nombreExcel: trabajadorNombreExcel,
        sugerenciaId: sugerencia?.id,
      })
    }

    const fechas = detectarFechas(sh)
    if (fechas.length === 0) {
      globalWarnings.push(`${sheetName}: no se detectaron fechas en fila 1`)
      continue
    }

    for (const f of fechas) {
      const { liq, problemas, tieneData, productosFaltantes } = parseDateBlock(sh, f.startCol, layout, productos, trabajador, trabajadorNombreExcel)
      for (const pf of productosFaltantes) {
        const key = normalizar(pf.nombre)
        const existing = productosFaltantesMap.get(key)
        if (!existing || (pf.precioEstimado > 0 && existing.precioEstimado <= 0)) {
          productosFaltantesMap.set(key, pf)
        }
      }
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
  const productosNoEncontrados = Array.from(productosFaltantesMap.values())
  const trabajadoresNoEncontrados = Array.from(trabajadoresNoEncontradosMap.values())
  return { jornadas, trabajadoresNoEncontrados, productosNoEncontrados, globalWarnings }
}

interface Props {
  productos: Producto[]
  trabajadores: Trabajador[]
  jornadasExistentes: Jornada[]
  agregarTrabajador: (t: Omit<Trabajador, 'id'>) => Promise<void>
  agregarProducto: (p: Omit<Producto, 'id'>) => Promise<void>
  onImport: (toImport: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }[]) => Promise<void>
  onClose: () => void
}

const NUEVO_TRABAJADOR = '__nuevo__'
const SKIP_TRABAJADOR = '__skip__'

export default function ImportarLiquidacionExcel({ productos, trabajadores, jornadasExistentes, agregarTrabajador, agregarProducto, onImport, onClose }: Props) {
  const [parsing, setParsing] = useState(false)
  const [aplicandoMapeo, setAplicandoMapeo] = useState(false)
  const [trabajadoresCreados, setTrabajadoresCreados] = useState<string[]>([])
  const [trabajadorMapping, setTrabajadorMapping] = useState<Record<string, string>>({})
  const [trabajadorOverrides, setTrabajadorOverrides] = useState<Record<string, string>>({})
  const [creandoProductos, setCreandoProductos] = useState(false)
  const [productosCreados, setProductosCreados] = useState<string[]>([])
  const [productosEditables, setProductosEditables] = useState<ProductoFaltante[]>([])
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

  const initMappingFromResult = useCallback((result: ParseResult) => {
    setTrabajadorMapping(prev => {
      const next: Record<string, string> = { ...prev }
      for (const t of result.trabajadoresNoEncontrados) {
        if (next[t.nombreExcel]) continue
        next[t.nombreExcel] = t.sugerenciaId ?? NUEVO_TRABAJADOR
      }
      return next
    })
  }, [])

  const reparsear = useCallback((buf: ArrayBuffer, overrides: Record<string, string> = trabajadorOverrides) => {
    const result = parseLiquidacionWorkbook(buf, productos, trabajadores, overrides)
    if (result.jornadas.length === 0 && result.productosNoEncontrados.length === 0 && result.trabajadoresNoEncontrados.length === 0) {
      setError(result.globalWarnings[0] || 'No se encontraron hojas Liq Diaria * o Liq Barra con datos')
      return
    }
    setParsed(result)
    setProductosEditables(result.productosNoEncontrados.map(p => ({ ...p })))
    initMappingFromResult(result)
    const existentes = new Set(jornadasExistentes.map(j => j.fecha))
    const initSel: Record<string, boolean> = {}
    for (const j of result.jornadas) {
      if (!existentes.has(j.fecha)) initSel[j.fecha] = true
    }
    setSeleccionados(initSel)
  }, [productos, trabajadores, jornadasExistentes, trabajadorOverrides, initMappingFromResult])

  useEffect(() => {
    if (!needsReparse || !fileBufRef.current) return
    const trabsPresentes = trabajadoresCreados.every(nombre =>
      trabajadores.some(t => normalizarMesero(t.nombre) === normalizarMesero(nombre))
    )
    const prodsPresentes = productosCreados.every(nombre =>
      productos.some(p => normalizar(p.nombre) === normalizar(nombre))
    )
    if (!trabsPresentes || !prodsPresentes) return
    reparsear(fileBufRef.current)
    setNeedsReparse(false)
  }, [needsReparse, reparsear, trabajadores, trabajadoresCreados, productos, productosCreados])

  const handleFile = async (file: File) => {
    setParsing(true)
    setError('')
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      fileBufRef.current = buf
      const result = parseLiquidacionWorkbook(buf, productos, trabajadores)
      if (result.jornadas.length === 0 && result.productosNoEncontrados.length === 0 && result.trabajadoresNoEncontrados.length === 0) {
        setError(result.globalWarnings[0] || 'No se encontraron hojas Liq Diaria * o Liq Barra con datos')
      } else {
        setParsed(result)
        setProductosEditables(result.productosNoEncontrados.map(p => ({ ...p })))
        initMappingFromResult(result)
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

  const updateTrabajadorMapping = (excelName: string, value: string) => {
    setTrabajadorMapping(prev => ({ ...prev, [excelName]: value }))
  }

  const handleAplicarMapeo = async () => {
    if (!parsed) return
    setAplicandoMapeo(true)
    setError('')
    const nuevos: { excelName: string; nombre: string }[] = []
    const overrides: Record<string, string> = { ...trabajadorOverrides }
    for (const t of parsed.trabajadoresNoEncontrados) {
      const choice = trabajadorMapping[t.nombreExcel] ?? NUEVO_TRABAJADOR
      if (choice === SKIP_TRABAJADOR) continue
      if (choice === NUEVO_TRABAJADOR) {
        nuevos.push({ excelName: t.nombreExcel, nombre: capitalizar(t.nombreExcel) })
      } else {
        overrides[t.nombreExcel] = choice
      }
    }
    const creados: string[] = []
    for (let i = 0; i < nuevos.length; i++) {
      const { nombre } = nuevos[i]
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
    setTrabajadoresCreados(prev => [...prev, ...creados])
    setTrabajadorOverrides(overrides)
    setTrabajadorMapping(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (next[key] === SKIP_TRABAJADOR) delete next[key]
      }
      return next
    })
    setAplicandoMapeo(false)
    setNeedsReparse(true)
  }

  const nuevas = parsed?.jornadas.filter(j => !fechasExistentes.has(j.fecha)) ?? []
  const duplicadas = parsed?.jornadas.filter(j => fechasExistentes.has(j.fecha)) ?? []
  const aImportar = nuevas.filter(j => seleccionados[j.fecha])
  const todasSeleccionadas = nuevas.length > 0 && aImportar.length === nuevas.length

  const totalAvisos = nuevas.reduce((s, j) =>
    s + j.liquidaciones.reduce((s2, l) =>
      s2 + l.lineasProblema.length + (l.trabajadorMatch ? 0 : 1), 0), 0)

  const updateProductoEditable = (idx: number, campo: 'nombre' | 'precioEstimado' | 'skip', valor: string | boolean) => {
    setProductosEditables(prev => prev.map((p, i) => {
      if (i !== idx) return p
      if (campo === 'skip') return { ...p, skip: valor as boolean }
      if (campo === 'precioEstimado') return { ...p, precioEstimado: Number(valor) || 0 }
      return { ...p, nombre: valor as string }
    }))
  }

  const handleCrearProductos = async () => {
    const validos = productosEditables.filter(p => !p.skip && p.nombre.trim() && p.precioEstimado > 0)
    if (validos.length === 0) {
      setError('Cada producto necesita un nombre y un precio mayor a 0.')
      return
    }
    setCreandoProductos(true)
    setError('')
    const creados: string[] = []
    for (const p of validos) {
      try {
        const nombre = p.nombre.trim()
        await agregarProducto({ nombre, precio: p.precioEstimado, activo: true })
        creados.push(nombre)
      } catch (e: any) {
        console.warn(`No se pudo crear producto ${p.nombre}:`, e?.message)
      }
    }
    setProductosCreados(prev => [...prev, ...creados])
    setProductosEditables(prev => prev.filter(p => !p.skip))
    setCreandoProductos(false)
    setNeedsReparse(true)
  }

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
                disabled={parsing || aplicandoMapeo}
                onChange={e => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0])
                  e.target.value = ''
                }}
                className="hidden"
              />
            </label>
            {parsing && <p className="text-xs text-white/40 mt-3 text-center">Analizando...</p>}
            {aplicandoMapeo && <p className="text-xs text-[#CDA52F] mt-3 text-center">Aplicando mapeo y creando trabajadores...</p>}
            {needsReparse && !aplicandoMapeo && <p className="text-xs text-white/40 mt-3 text-center">Sincronizando...</p>}
            {error && <p className="text-xs text-[#FF5050] mt-3 text-center">{error}</p>}
          </div>
        )}

        {parsed && (
          <div>
            <p className="text-[11px] text-white/40 mb-3">Archivo: <span className="text-white/70">{fileName}</span></p>

            {trabajadoresCreados.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-[#4ECDC4] font-medium mb-1">Trabajadores creados automáticamente:</p>
                  <p className="text-[11px] text-white/60">{trabajadoresCreados.join(', ')}</p>
                </div>
                <div className="shrink-0 w-8 h-8 rounded-full bg-[#4ECDC4]/20 border border-[#4ECDC4]/40 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
            )}

            {productosCreados.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-[#4ECDC4] font-medium mb-1">Productos creados automáticamente:</p>
                  <p className="text-[11px] text-white/60">{productosCreados.join(', ')}</p>
                </div>
                <div className="shrink-0 w-8 h-8 rounded-full bg-[#4ECDC4]/20 border border-[#4ECDC4]/40 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
            )}

            {parsed.trabajadoresNoEncontrados.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-[#FFE66D]/10 border border-[#FFE66D]/20">
                <p className="text-[11px] text-[#FFE66D] font-medium mb-1">
                  {parsed.trabajadoresNoEncontrados.length} mesero{parsed.trabajadoresNoEncontrados.length === 1 ? '' : 's'} del Excel sin coincidencia exacta
                </p>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-white/60">
                    Desmarcá para ignorar ese mesero y no importar sus ventas.
                  </p>
                  {(() => {
                    const todos = parsed.trabajadoresNoEncontrados
                    const todosActivos = todos.every(t => (trabajadorMapping[t.nombreExcel] ?? NUEVO_TRABAJADOR) !== SKIP_TRABAJADOR)
                    const algunoActivo = todos.some(t => (trabajadorMapping[t.nombreExcel] ?? NUEVO_TRABAJADOR) !== SKIP_TRABAJADOR)
                    const toggleTodos = () => {
                      const next: Record<string, string> = { ...trabajadorMapping }
                      if (algunoActivo) {
                        todos.forEach(t => { next[t.nombreExcel] = SKIP_TRABAJADOR })
                      } else {
                        todos.forEach(t => { next[t.nombreExcel] = NUEVO_TRABAJADOR })
                      }
                      setTrabajadorMapping(next)
                    }
                    return (
                      <label className="flex items-center gap-1.5 cursor-pointer shrink-0 ml-2 select-none">
                        <input
                          type="checkbox"
                          checked={todosActivos}
                          ref={el => { if (el) el.indeterminate = !todosActivos && algunoActivo }}
                          onChange={toggleTodos}
                          disabled={aplicandoMapeo}
                          className="w-3.5 h-3.5 accent-[#FFE66D] cursor-pointer"
                        />
                        <span className="text-[11px] text-[#FFE66D]/70 hover:text-[#FFE66D]">
                          {algunoActivo ? 'Desmarcar todos' : 'Marcar todos'}
                        </span>
                      </label>
                    )
                  })()}
                </div>
                <div className="space-y-1 max-h-48 overflow-auto pr-1">
                  {parsed.trabajadoresNoEncontrados.map(t => {
                    const choice = trabajadorMapping[t.nombreExcel] ?? NUEVO_TRABAJADOR
                    const isSkipped = choice === SKIP_TRABAJADOR
                    return (
                      <div key={t.nombreExcel} className={`flex items-center gap-2 transition-opacity ${isSkipped ? 'opacity-40' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!isSkipped}
                          onChange={e => updateTrabajadorMapping(t.nombreExcel, e.target.checked ? NUEVO_TRABAJADOR : SKIP_TRABAJADOR)}
                          disabled={aplicandoMapeo}
                          className="w-3.5 h-3.5 accent-[#FFE66D] cursor-pointer shrink-0"
                        />
                        <span className={`text-[11px] shrink-0 truncate max-w-[120px] ${isSkipped ? 'line-through text-white/30' : 'text-white/70'}`} title={t.nombreExcel}>
                          {t.nombreExcel}
                        </span>
                        {!isSkipped && (
                          <>
                            <span className="text-white/30 text-[11px] shrink-0">→</span>
                            <select
                              value={choice}
                              onChange={e => updateTrabajadorMapping(t.nombreExcel, e.target.value)}
                              disabled={aplicandoMapeo}
                              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#FFE66D]/50"
                            >
                              <option value={NUEVO_TRABAJADOR}>— Crear nuevo "{capitalizar(t.nombreExcel)}" —</option>
                              {trabajadores.map(tr => (
                                <option key={tr.id} value={tr.id}>
                                  {tr.nombre}{t.sugerenciaId === tr.id ? ' (sugerido)' : ''}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        {isSkipped && <span className="text-[11px] text-white/30 italic">ignorar — no se importará</span>}
                      </div>
                    )
                  })}
                </div>
                {parsed.trabajadoresNoEncontrados.some(t => (trabajadorMapping[t.nombreExcel] ?? NUEVO_TRABAJADOR) !== SKIP_TRABAJADOR) && (
                  <div className="flex justify-end mt-2">
                    <Btn size="sm" variant="primary" onClick={handleAplicarMapeo} disabled={aplicandoMapeo}>
                      {aplicandoMapeo ? 'Aplicando...' : 'Aplicar mapeo'}
                    </Btn>
                  </div>
                )}
              </div>
            )}

            {productosEditables.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-[#FFE66D]/10 border border-[#FFE66D]/20">
                <p className="text-[11px] text-[#FFE66D] font-medium mb-1">
                  {productosEditables.length} producto{productosEditables.length === 1 ? '' : 's'} del Excel no existe{productosEditables.length === 1 ? '' : 'n'} en este negocio
                </p>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-white/60">
                    Revisá nombre y precio. Desmarcá los que no querés crear.
                  </p>
                  {(() => {
                    const todosActivos = productosEditables.every(p => !p.skip)
                    const algunoActivo = productosEditables.some(p => !p.skip)
                    const toggleTodos = () => {
                      const nuevoSkip = algunoActivo
                      setProductosEditables(prev => prev.map(p => ({ ...p, skip: nuevoSkip })))
                    }
                    return (
                      <label className="flex items-center gap-1.5 cursor-pointer shrink-0 ml-2 select-none">
                        <input
                          type="checkbox"
                          checked={todosActivos}
                          ref={el => { if (el) el.indeterminate = !todosActivos && algunoActivo }}
                          onChange={toggleTodos}
                          disabled={creandoProductos}
                          className="w-3.5 h-3.5 accent-[#FFE66D] cursor-pointer"
                        />
                        <span className="text-[11px] text-[#FFE66D]/70 hover:text-[#FFE66D]">
                          {algunoActivo ? 'Desmarcar todos' : 'Marcar todos'}
                        </span>
                      </label>
                    )
                  })()}
                </div>
                <div className="space-y-1 max-h-48 overflow-auto pr-1">
                  {productosEditables.map((p, i) => (
                    <div key={i} className={`flex items-center gap-2 transition-opacity ${p.skip ? 'opacity-40' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!p.skip}
                        onChange={e => updateProductoEditable(i, 'skip', !e.target.checked)}
                        disabled={creandoProductos}
                        className="w-3.5 h-3.5 accent-[#FFE66D] cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={p.nombre}
                        onChange={e => updateProductoEditable(i, 'nombre', e.target.value)}
                        className={`flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[#FFE66D]/50 ${p.skip ? 'text-white/30 line-through' : 'text-white'}`}
                        disabled={creandoProductos || !!p.skip}
                      />
                      <input
                        type="number"
                        min={0}
                        value={p.precioEstimado || ''}
                        onChange={e => updateProductoEditable(i, 'precioEstimado', e.target.value)}
                        placeholder="Precio"
                        className={`w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[#FFE66D]/50 tabular-nums text-right ${p.skip ? 'text-white/30' : 'text-white'}`}
                        disabled={creandoProductos || !!p.skip}
                      />
                    </div>
                  ))}
                </div>
                {productosEditables.some(p => !p.skip) && (
                  <div className="flex justify-end mt-2">
                    <Btn size="sm" variant="primary" onClick={handleCrearProductos} disabled={creandoProductos}>
                      {creandoProductos ? 'Creando...' : `Crear ${productosEditables.filter(p => !p.skip && p.nombre.trim() && p.precioEstimado > 0).length} productos`}
                    </Btn>
                  </div>
                )}
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
              {duplicadas.map(j => {
                const isExpanded = !!expandidas[`dup_${j.fecha}`]
                const liqsValidas = j.liquidaciones.filter(l => l.trabajadorMatch)
                const sinTrabajador = j.liquidaciones.filter(l => !l.trabajadorMatch).length
                return (
                  <div key={j.fecha} className="rounded-lg bg-white/[0.02] border border-white/[0.03]">
                    <div className="flex items-center gap-2 p-2">
                      <span className="w-4 h-4 rounded bg-white/[0.05] shrink-0 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/30"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                      <span className="text-sm text-white/40 flex-1">{j.fecha}</span>
                      <span className="text-[11px] text-white/30 shrink-0">
                        {liqsValidas.length} trab.
                        {sinTrabajador > 0 && <span className="text-[#FF5050]/60"> · {sinTrabajador} sin match</span>}
                        {' '}— ya existe
                      </span>
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setExpandidas(s => ({ ...s, [`dup_${j.fecha}`]: !s[`dup_${j.fecha}`] })) }}
                        className="text-white/40 hover:text-white/70 text-xs px-1 shrink-0"
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-2 pt-1 border-t border-white/[0.03] space-y-0.5">
                        {j.liquidaciones.map((l, i) => (
                          <div key={i} className="flex items-center gap-2 py-0.5 text-[11px]">
                            <span className={`shrink-0 ${l.trabajadorMatch ? 'text-white/30' : 'text-[#FF5050]/50'}`}>{l.trabajadorMatch ? '✓' : '✗'}</span>
                            <span className="text-white/30 truncate">
                              {l.trabajadorNombreExcel}
                              {l.trabajadorMatch && l.trabajadorMatch.nombre !== l.trabajadorNombreExcel && (
                                <span className="text-white/20"> → {l.trabajadorMatch.nombre}</span>
                              )}
                            </span>
                            <span className="text-white/25 ml-auto shrink-0 tabular-nums">
                              ${l.liquidacion.totalVenta.toLocaleString('es-CO')} · {l.liquidacion.lineas.length} prods
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-[10px] text-white/40 mb-3">
              Click en ▶ para ver los trabajadores y productos de cada fecha.
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
