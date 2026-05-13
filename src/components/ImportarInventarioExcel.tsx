import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Btn } from './ui/Btn'
import type { InventarioInput, LineaInventario, Producto, Inventario } from '../types'

type LineaStatus = 'ok' | 'no-match' | 'ambiguo' | 'duplicado-excel' | 'duplicado-mapeo'

interface LineaParseada {
  status: LineaStatus
  nombreExcel: string
  productoMatched?: { id: string; nombre: string }
  candidatos?: string[]
  motivo?: string
  linea: LineaInventario
}

interface ProductoFaltante {
  nombre: string
  precioEstimado: number
}

interface ParsedBlock {
  fecha: string
  lineas: LineaInventario[]
  todasLasLineas: LineaParseada[]
  totalGeneral: number
}

interface ParseResult {
  blocks: ParsedBlock[]
  productosNoEncontrados: ProductoFaltante[]
  warnings: string[]
}

function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d+)\s*ml\b/g, '$1ml')
    .replace(/(\d+)\s*(lt|l|litro|litros)\b/g, '$1l')
    .replace(/\s+/g, ' ')
    .trim()
}

const SHEET_NAME = 'INVENTARIO MONASTERY'

const STATUS_CFG: Record<LineaStatus, { icon: string; color: string }> = {
  'ok':                { icon: '✓', color: 'text-[#4ECDC4]' },
  'no-match':          { icon: '✗', color: 'text-[#FF5050]' },
  'ambiguo':           { icon: '?', color: 'text-[#FFE66D]' },
  'duplicado-excel':   { icon: '↻', color: 'text-[#FF8FA3]' },
  'duplicado-mapeo':   { icon: '↻', color: 'text-[#FF8FA3]' },
}

function parseInventarioSheet(buf: ArrayBuffer, productos: Producto[]): ParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const sheet = wb.Sheets[SHEET_NAME]
  if (!sheet) {
    return { blocks: [], productosNoEncontrados: [], warnings: [`No se encontró la hoja "${SHEET_NAME}" en el archivo`] }
  }

  const merges = sheet['!merges'] || []
  const dateBlocks: { fecha: string; startCol: number; endCol: number }[] = []

  for (const m of merges) {
    if (m.s.r !== 1) continue
    const cell = sheet[XLSX.utils.encode_cell({ r: 1, c: m.s.c })]
    if (!cell) continue
    const v = cell.v
    if (typeof v === 'number' && v > 40000) {
      const d = XLSX.SSF.parse_date_code(v)
      if (!d) continue
      const fecha = `${d.y}-${String(d.m).padStart(2, '0')}-${String(Math.floor(d.d)).padStart(2, '0')}`
      dateBlocks.push({ fecha, startCol: m.s.c, endCol: m.e.c })
    }
  }

  if (dateBlocks.length === 0) {
    return { blocks: [], productosNoEncontrados: [], warnings: ['No se detectaron fechas en la hoja. ¿La plantilla cambió?'] }
  }

  const blocks: ParsedBlock[] = []
  const warnings: string[] = []
  const productosFaltantesMap = new Map<string, ProductoFaltante>()

  for (const block of dateBlocks) {
    const lineas: LineaInventario[] = []
    let totalGeneral = 0

    const colSalidas = block.startCol
    const colInvIni = block.startCol + 1
    const colEntradas = block.startCol + 2
    const colInvFisico = block.startCol + 3
    const colSaldo = block.startCol + 4
    const colVarUnit = block.startCol + 5
    const colTotal = block.startCol + 6

    const num = (r: number, c: number): number => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      if (!cell) return 0
      const v = cell.v
      return typeof v === 'number' ? v : 0
    }

    const hasValue = (r: number, c: number): boolean => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      return !!cell && cell.v != null && cell.v !== ''
    }

    const normalizar = (s: string): string => s
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   
      .replace(/(\d+)\s*ml\b/g, '$1ml')                  
      .replace(/(\d+)\s*(lt|l|litro|litros)\b/g, '$1l')   
      .replace(/\s+/g, ' ')                               
      .trim()

    const buscarProducto = (nombreExcel: string): { producto?: Producto; ambiguo: boolean; candidatos?: string[] } => {
      const target = normalizar(nombreExcel)
   
      const exacto = productos.find(p => normalizar(p.nombre) === target)
      if (exacto) return { producto: exacto, ambiguo: false }
     
      const exPref = productos.filter(p => normalizar(p.nombre).startsWith(target + ' '))
      if (exPref.length === 1) return { producto: exPref[0], ambiguo: false }
      if (exPref.length > 1) {
        return { producto: undefined, ambiguo: true, candidatos: exPref.map(p => p.nombre) }
      }
      
      const bdPref = productos.filter(p => target.startsWith(normalizar(p.nombre) + ' '))
      if (bdPref.length === 1) return { producto: bdPref[0], ambiguo: false }
      if (bdPref.length > 1) {
        return { producto: undefined, ambiguo: true, candidatos: bdPref.map(p => p.nombre) }
      }
      return { producto: undefined, ambiguo: false }
    }

    const productoIdsUsados = new Set<string>()
    const nombresExcelVistos = new Map<string, string>() 
    const todasLasLineas: LineaParseada[] = []

    
    for (let r = 3; r <= 100; r++) {
      if (!hasValue(r, 0)) {
       
        if (!hasValue(r + 1, 0)) break
        continue
      }
      const nombre = String(sheet[XLSX.utils.encode_cell({ r, c: 0 })]!.v).trim()
      if (nombre.toUpperCase().includes('TOTAL LIQU')) break

      const lineaBase: LineaInventario = {
        productoId: '',
        nombre,
        valorUnitario: num(r, colVarUnit),
        salidas: num(r, colSalidas),
        invInicial: num(r, colInvIni),
        entradas: num(r, colEntradas),
        invFisico: num(r, colInvFisico),
        saldo: num(r, colSaldo),
        total: num(r, colTotal),
      }

      const nombreNorm = normalizar(nombre)
      if (nombresExcelVistos.has(nombreNorm)) {
        todasLasLineas.push({
          status: 'duplicado-excel',
          nombreExcel: nombre,
          motivo: 'Aparece más de una vez con el mismo nombre en el Excel',
          linea: lineaBase,
        })
        continue
      }
      nombresExcelVistos.set(nombreNorm, nombre)

      const { producto, ambiguo, candidatos } = buscarProducto(nombre)

      if (ambiguo) {
        todasLasLineas.push({
          status: 'ambiguo',
          nombreExcel: nombre,
          candidatos,
          motivo: `Coincide con varios productos: ${candidatos?.join(' / ')}`,
          linea: lineaBase,
        })
        continue
      }

      if (!producto) {
        todasLasLineas.push({
          status: 'no-match',
          nombreExcel: nombre,
          motivo: 'No existe ese producto en la BD del negocio',
          linea: lineaBase,
        })
        const key = normalizarNombre(nombre)
        const prevFaltante = productosFaltantesMap.get(key)
        const precioGuess = lineaBase.valorUnitario
        if (!prevFaltante || (precioGuess > 0 && prevFaltante.precioEstimado <= 0)) {
          productosFaltantesMap.set(key, { nombre, precioEstimado: precioGuess })
        }
        continue
      }

      if (productoIdsUsados.has(producto.id)) {
        todasLasLineas.push({
          status: 'duplicado-mapeo',
          nombreExcel: nombre,
          productoMatched: { id: producto.id, nombre: producto.nombre },
          motivo: `Mapea al producto "${producto.nombre}" que ya estaba en este día`,
          linea: lineaBase,
        })
        continue
      }
      productoIdsUsados.add(producto.id)

      const linea: LineaInventario = {
        ...lineaBase,
        productoId: producto.id,
        nombre: producto.nombre,
      }

      todasLasLineas.push({
        status: 'ok',
        nombreExcel: nombre,
        productoMatched: { id: producto.id, nombre: producto.nombre },
        linea,
      })

      lineas.push(linea)
      totalGeneral += linea.total
    }

    blocks.push({ fecha: block.fecha, lineas, todasLasLineas, totalGeneral })
  }

  return { blocks, productosNoEncontrados: Array.from(productosFaltantesMap.values()), warnings }
}

interface Props {
  productos: Producto[]
  inventariosExistentes: Inventario[]
  agregarProducto: (p: Omit<Producto, 'id'>) => Promise<void>
  onImport: (inventarios: InventarioInput[]) => Promise<void>
  onClose: () => void
}

export default function ImportarInventarioExcel({ productos, inventariosExistentes, agregarProducto, onImport, onClose }: Props) {
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parsed, setParsed] = useState<ParsedBlock[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({})
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({})
  const [productosEditables, setProductosEditables] = useState<ProductoFaltante[]>([])
  const [productosCreados, setProductosCreados] = useState<string[]>([])
  const [creandoProductos, setCreandoProductos] = useState(false)
  const [needsReparse, setNeedsReparse] = useState(false)
  const fileBufRef = useRef<ArrayBuffer | null>(null)

  const fechasExistentes = new Set(inventariosExistentes.map(i => i.fecha))

  const reparsear = useCallback((buf: ArrayBuffer) => {
    const result = parseInventarioSheet(buf, productos)
    if (result.blocks.length === 0 && result.productosNoEncontrados.length === 0) {
      setError(result.warnings[0] || 'No se pudo extraer información del archivo')
      return
    }
    setParsed(result.blocks)
    setProductosEditables(result.productosNoEncontrados.map(p => ({ ...p })))
    const initSel: Record<string, boolean> = {}
    for (const b of result.blocks) {
      if (!fechasExistentes.has(b.fecha)) initSel[b.fecha] = true
    }
    setSeleccionados(initSel)
  }, [productos, inventariosExistentes])

  useEffect(() => {
    if (!needsReparse || !fileBufRef.current) return
    const todosPresentes = productosCreados.every(nombre =>
      productos.some(p => normalizarNombre(p.nombre) === normalizarNombre(nombre))
    )
    if (!todosPresentes) return
    reparsear(fileBufRef.current)
    setNeedsReparse(false)
  }, [needsReparse, reparsear, productos, productosCreados])

  const handleFile = async (file: File) => {
    setParsing(true)
    setError('')
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      fileBufRef.current = buf
      const result = parseInventarioSheet(buf, productos)
      if (result.blocks.length === 0 && result.productosNoEncontrados.length === 0) {
        setError(result.warnings[0] || 'No se pudo extraer información del archivo')
      } else {
        setParsed(result.blocks)
        setProductosEditables(result.productosNoEncontrados.map(p => ({ ...p })))
        const initSel: Record<string, boolean> = {}
        for (const b of result.blocks) {
          if (!fechasExistentes.has(b.fecha)) initSel[b.fecha] = true
        }
        setSeleccionados(initSel)
      }
    } catch (e: any) {
      setError(e?.message || 'Error al leer el archivo')
    } finally {
      setParsing(false)
    }
  }

  const updateProductoEditable = (idx: number, campo: 'nombre' | 'precioEstimado', valor: string) => {
    setProductosEditables(prev => prev.map((p, i) => {
      if (i !== idx) return p
      if (campo === 'precioEstimado') return { ...p, precioEstimado: Number(valor) || 0 }
      return { ...p, nombre: valor }
    }))
  }

  const handleCrearProductos = async () => {
    const validos = productosEditables.filter(p => p.nombre.trim() && p.precioEstimado > 0)
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
    setCreandoProductos(false)
    setNeedsReparse(true)
  }

  const nuevos = parsed?.filter(b => !fechasExistentes.has(b.fecha)) ?? []
  const duplicados = parsed?.filter(b => fechasExistentes.has(b.fecha)) ?? []
  const aImportar = nuevos.filter(b => seleccionados[b.fecha] && b.lineas.length > 0)
  const seleccionablesNuevos = nuevos.filter(b => b.lineas.length > 0)
  const todosSeleccionados = seleccionablesNuevos.length > 0 && aImportar.length === seleccionablesNuevos.length
  const algunoSeleccionado = aImportar.length > 0

  const totalAvisos = nuevos.reduce(
    (sum, b) => sum + b.todasLasLineas.filter(l => l.status !== 'ok').length,
    0
  )
  const totalSinMatch = nuevos.reduce(
    (sum, b) => sum + b.todasLasLineas.filter(l => l.status === 'no-match').length,
    0
  )
  const fechasVacias = nuevos.filter(b => b.lineas.length === 0).length

  const toggleFecha = (fecha: string) => {
    setSeleccionados(s => ({ ...s, [fecha]: !s[fecha] }))
  }

  const toggleTodos = () => {
    if (todosSeleccionados) {
      setSeleccionados({})
    } else {
      const all: Record<string, boolean> = {}
      for (const b of seleccionablesNuevos) all[b.fecha] = true
      setSeleccionados(all)
    }
  }

  const handleConfirm = async () => {
    if (aImportar.length === 0) return
    setImporting(true)
    setError('')
    try {
      const toImport: InventarioInput[] = aImportar
        .filter(b => b.lineas.length > 0)
        .map(b => ({
          fecha: b.fecha,
          lineas: b.lineas,
          totalGeneral: b.totalGeneral,
        }))
      if (toImport.length === 0) {
        setError('Ninguna fecha tiene productos para importar. Importa primero los productos en Productos > Importar Excel.')
        setImporting(false)
        return
      }
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
            <h2 className="text-lg font-bold text-white">Importar Inventario desde Excel</h2>
            <p className="text-xs text-white/40 mt-0.5">Solo se procesará la hoja "{SHEET_NAME}"</p>
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
                disabled={parsing}
                onChange={e => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0])
                  e.target.value = '' 
                }}
                className="hidden"
              />
            </label>
            {parsing && <p className="text-xs text-white/40 mt-3 text-center">Analizando...</p>}
            {error && <p className="text-xs text-[#FF5050] mt-3 text-center">{error}</p>}
          </div>
        )}

        {parsed && (
          <div>
            <p className="text-[11px] text-white/40 mb-3">Archivo: <span className="text-white/70">{fileName}</span></p>

            {productosEditables.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-[#FFE66D]/10 border border-[#FFE66D]/20">
                <p className="text-[11px] text-[#FFE66D] font-medium mb-1">
                  {productosEditables.length} producto{productosEditables.length === 1 ? '' : 's'} del Excel no existe{productosEditables.length === 1 ? '' : 'n'} en este negocio
                </p>
                <p className="text-[10px] text-white/60 mb-2">
                  Revisá el nombre y el precio (extraído de "valor unitario" del Excel), después tocá "Crear productos" para agregarlos. Productos sin precio o sin nombre se omiten.
                </p>
                <div className="space-y-1 max-h-48 overflow-auto pr-1">
                  {productosEditables.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={p.nombre}
                        onChange={e => updateProductoEditable(i, 'nombre', e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#FFE66D]/50"
                        disabled={creandoProductos}
                      />
                      <input
                        type="number"
                        min={0}
                        value={p.precioEstimado || ''}
                        onChange={e => updateProductoEditable(i, 'precioEstimado', e.target.value)}
                        placeholder="Precio"
                        className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#FFE66D]/50 tabular-nums text-right"
                        disabled={creandoProductos}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-2">
                  <Btn size="sm" variant="primary" onClick={handleCrearProductos} disabled={creandoProductos}>
                    {creandoProductos ? 'Creando...' : `Crear ${productosEditables.filter(p => p.nombre.trim() && p.precioEstimado > 0).length} productos`}
                  </Btn>
                </div>
              </div>
            )}

            {productosEditables.length === 0 && (totalSinMatch > 0 || fechasVacias > 0) && (
              <div className="mb-3 p-3 rounded-lg bg-[#FF5050]/10 border border-[#FF5050]/20">
                <p className="text-[11px] text-[#FF5050] font-medium mb-1">
                  {totalSinMatch > 0 && (
                    <>{totalSinMatch} producto{totalSinMatch === 1 ? '' : 's'} del Excel no existe{totalSinMatch === 1 ? '' : 'n'} en este negocio</>
                  )}
                  {totalSinMatch > 0 && fechasVacias > 0 && ' · '}
                  {fechasVacias > 0 && (
                    <>{fechasVacias} fecha{fechasVacias === 1 ? '' : 's'} sin productos para importar</>
                  )}
                </p>
                <p className="text-[10px] text-white/60">
                  Revisá los productos marcados como ambiguos o duplicados (click en ▶ de cada fecha) para entender por qué quedaron sin importar.
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="p-3 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
                <p className="text-2xl font-bold text-[#4ECDC4]">{nuevos.length}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mt-1">Nuevos</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-2xl font-bold text-white/40">{duplicados.length}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Duplicados (skip)</p>
              </div>
              <div className="p-3 rounded-lg bg-[#FFE66D]/10 border border-[#FFE66D]/20">
                <p className="text-2xl font-bold text-[#FFE66D]">{totalAvisos}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mt-1">Avisos</p>
              </div>
            </div>

            {nuevos.length > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[11px] text-white/50">Selecciona qué importar:</p>
                <button
                  onClick={toggleTodos}
                  className="text-[11px] text-[#D4AF37] hover:underline"
                  type="button"
                >
                  {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
            )}
            <div className="space-y-1.5 mb-4 max-h-56 overflow-auto pr-2">
              {nuevos.map(b => {
                const sinProductos = b.lineas.length === 0
                const checked = !!seleccionados[b.fecha] && !sinProductos
                const isExpanded = !!expandidas[b.fecha]
                const problematicas = b.todasLasLineas.filter(l => l.status !== 'ok').length
                return (
                  <div
                    key={b.fecha}
                    className={`rounded-lg border transition-colors ${
                      sinProductos
                        ? 'bg-[#FF5050]/5 border-[#FF5050]/20 opacity-70'
                        : checked
                          ? 'bg-[#4ECDC4]/10 border-[#4ECDC4]/30'
                          : 'bg-white/[0.02] border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2 p-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={sinProductos}
                        onChange={() => toggleFecha(b.fecha)}
                        className="w-4 h-4 accent-[#4ECDC4] cursor-pointer shrink-0 disabled:cursor-not-allowed"
                      />
                      <span className={`text-sm flex-1 ${sinProductos ? 'text-white/40' : checked ? 'text-white' : 'text-white/60'}`}>{b.fecha}</span>
                      <span className="text-[11px] shrink-0">
                        {sinProductos ? (
                          <span className="text-[#FF5050]">sin productos</span>
                        ) : (
                          <span className="text-white/50">{b.lineas.length} OK</span>
                        )}
                        {problematicas > 0 && <span className="text-[#FFE66D]"> · {problematicas} ⚠</span>}
                      </span>
                      <span className={`text-xs font-semibold shrink-0 ${checked ? 'text-white' : 'text-white/50'}`}>
                        ${b.totalGeneral.toLocaleString('es-CO')}
                      </span>
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setExpandidas(s => ({ ...s, [b.fecha]: !s[b.fecha] })) }}
                        className="text-white/40 hover:text-white/80 text-xs px-1 shrink-0"
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-2 pt-1 border-t border-white/[0.05] space-y-1 max-h-48 overflow-auto">
                        {b.todasLasLineas.map((l, i) => {
                          const cfg = STATUS_CFG[l.status]
                          return (
                            <div key={`${b.fecha}-${i}`} className={`flex items-start gap-2 py-1 text-[11px] ${cfg.color}`}>
                              <span className="shrink-0 font-mono w-3">{cfg.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="truncate">
                                  <span className="font-medium">{l.nombreExcel}</span>
                                  {l.productoMatched && l.productoMatched.nombre !== l.nombreExcel && (
                                    <span className="text-white/40"> → {l.productoMatched.nombre}</span>
                                  )}
                                </p>
                                {l.motivo && <p className="text-white/40 text-[10px]">{l.motivo}</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {duplicados.map(b => (
                <div key={b.fecha} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] opacity-60">
                  <span className="w-4 h-4 rounded bg-white/[0.05] shrink-0 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/30"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                  <span className="text-sm text-white/40 flex-1">{b.fecha}</span>
                  <span className="text-[11px] text-white/30 shrink-0">ya existe — saltar</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-white/40 mb-3">
              Click en ▶ de cada fecha para ver el detalle de productos y por qué se saltan los problemáticos.
            </p>

            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose} disabled={importing}>Cancelar</Btn>
              <Btn
                variant="primary"
                disabled={!algunoSeleccionado || importing}
                onClick={handleConfirm}
              >
                {importing
                  ? 'Importando...'
                  : !algunoSeleccionado
                    ? 'Selecciona al menos uno'
                    : `Importar ${aImportar.length}`}
              </Btn>
            </div>
            {error && <p className="text-xs text-[#FF5050] mt-2 text-right">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
