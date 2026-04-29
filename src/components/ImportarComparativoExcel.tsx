import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Btn } from './ui/Btn'
import type { ComparativoInput, LineaComparativo, Producto, Comparativo } from '../types'

type LineaStatus = 'ok' | 'no-match' | 'ambiguo' | 'duplicado-excel' | 'duplicado-mapeo'

interface LineaParseada {
  status: LineaStatus
  nombreExcel: string
  productoMatched?: { id: string; nombre: string }
  candidatos?: string[]
  motivo?: string
  linea: LineaComparativo
}

interface ParsedBlock {
  fecha: string
  lineas: LineaComparativo[]
  todasLasLineas: LineaParseada[]
  totalConteo: number
  totalTiquets: number
  totalDiferencia: number
}

interface ParseResult {
  blocks: ParsedBlock[]
  warnings: string[]
}

const SHEET_NAME = 'Comparativo ventas'
const ROW_DATE = 1
const ROW_FIRST = 3
const ROW_LAST = 100

const STATUS_CFG: Record<LineaStatus, { icon: string; color: string }> = {
  'ok':                { icon: '✓', color: 'text-[#4ECDC4]' },
  'no-match':          { icon: '✗', color: 'text-[#FF5050]' },
  'ambiguo':           { icon: '?', color: 'text-[#FFE66D]' },
  'duplicado-excel':   { icon: '↻', color: 'text-[#FF8FA3]' },
  'duplicado-mapeo':   { icon: '↻', color: 'text-[#FF8FA3]' },
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d+)\s*ml\b/g, '$1ml')
    .replace(/(\d+)\s*(lt|l|litro|litros)\b/g, '$1l')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseComparativoSheet(buf: ArrayBuffer, productos: Producto[]): ParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const sheet = wb.Sheets[SHEET_NAME]
  if (!sheet) {
    return { blocks: [], warnings: [`No se encontró la hoja "${SHEET_NAME}" en el archivo`] }
  }

  const merges = sheet['!merges'] || []
  const dateBlocks: { fecha: string; startCol: number }[] = []

  for (const m of merges) {
    if (m.s.r !== ROW_DATE) continue
    const cell = sheet[XLSX.utils.encode_cell({ r: ROW_DATE, c: m.s.c })]
    if (!cell) continue
    const v = cell.v
    if (typeof v === 'number' && v > 40000) {
      const d = XLSX.SSF.parse_date_code(v)
      if (!d) continue
      const fecha = `${d.y}-${String(d.m).padStart(2, '0')}-${String(Math.floor(d.d)).padStart(2, '0')}`
      dateBlocks.push({ fecha, startCol: m.s.c })
    }
  }

  if (dateBlocks.length === 0) {
    return { blocks: [], warnings: ['No se detectaron fechas en la hoja. ¿La plantilla cambió?'] }
  }

  const blocks: ParsedBlock[] = []
  const warnings: string[] = []

  for (const block of dateBlocks) {
    const colConteo = block.startCol + 1
    const colTiquets = block.startCol + 2

    const num = (r: number, c: number): number => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      if (!cell) return 0
      const v = cell.v
      return typeof v === 'number' ? v : 0
    }

    const buscarProducto = (nombreExcel: string): { producto?: Producto; ambiguo: boolean; candidatos?: string[] } => {
      const target = normalizar(nombreExcel)
      const exacto = productos.find(p => normalizar(p.nombre) === target)
      if (exacto) return { producto: exacto, ambiguo: false }
      const exPref = productos.filter(p => normalizar(p.nombre).startsWith(target + ' '))
      if (exPref.length === 1) return { producto: exPref[0], ambiguo: false }
      if (exPref.length > 1) return { producto: undefined, ambiguo: true, candidatos: exPref.map(p => p.nombre) }
      const bdPref = productos.filter(p => target.startsWith(normalizar(p.nombre) + ' '))
      if (bdPref.length === 1) return { producto: bdPref[0], ambiguo: false }
      if (bdPref.length > 1) return { producto: undefined, ambiguo: true, candidatos: bdPref.map(p => p.nombre) }
      return { producto: undefined, ambiguo: false }
    }

    const productoIdsUsados = new Set<string>()
    const nombresExcelVistos = new Map<string, string>()
    const todasLasLineas: LineaParseada[] = []
    const lineas: LineaComparativo[] = []
    let totalConteo = 0
    let totalTiquets = 0

    for (let r = ROW_FIRST; r <= ROW_LAST; r++) {
      const cellNombre = sheet[XLSX.utils.encode_cell({ r, c: 0 })]
      if (!cellNombre || cellNombre.v == null || cellNombre.v === '') {
        if (!sheet[XLSX.utils.encode_cell({ r: r + 1, c: 0 })]?.v) break
        continue
      }
      const nombre = String(cellNombre.v).trim()
      if (nombre.toUpperCase().startsWith('TOTAL')) break

      const conteo = num(r, colConteo)
      const tiquets = num(r, colTiquets)
      if (conteo === 0 && tiquets === 0) continue

      const lineaBase: LineaComparativo = {
        productoId: '',
        nombre,
        conteo,
        tiquets,
        diferencia: tiquets - conteo,
      }

      const nombreNorm = normalizar(nombre)
      if (nombresExcelVistos.has(nombreNorm)) {
        todasLasLineas.push({
          status: 'duplicado-excel',
          nombreExcel: nombre,
          motivo: 'Aparece más de una vez con el mismo nombre',
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

      const linea: LineaComparativo = {
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
      totalConteo += conteo
      totalTiquets += tiquets
    }

    if (lineas.length === 0 && todasLasLineas.length === 0) continue

    const totalDiferencia = totalTiquets - totalConteo
    blocks.push({ fecha: block.fecha, lineas, todasLasLineas, totalConteo, totalTiquets, totalDiferencia })
  }

  blocks.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return { blocks, warnings }
}

interface Props {
  productos: Producto[]
  comparativosExistentes: Comparativo[]
  onImport: (comparativos: ComparativoInput[]) => Promise<void>
  onClose: () => void
}

export default function ImportarComparativoExcel({ productos, comparativosExistentes, onImport, onClose }: Props) {
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parsed, setParsed] = useState<ParsedBlock[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({})
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({})

  const fechasExistentes = new Set(comparativosExistentes.map(c => c.fecha))

  const handleFile = async (file: File) => {
    setParsing(true)
    setError('')
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const result = parseComparativoSheet(buf, productos)
      if (result.blocks.length === 0) {
        setError(result.warnings[0] || 'No se pudo extraer información del archivo')
      } else {
        setParsed(result.blocks)
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

  const nuevos = parsed?.filter(b => !fechasExistentes.has(b.fecha)) ?? []
  const duplicados = parsed?.filter(b => fechasExistentes.has(b.fecha)) ?? []
  const aImportar = nuevos.filter(b => seleccionados[b.fecha])
  const todosSeleccionados = nuevos.length > 0 && aImportar.length === nuevos.length
  const algunoSeleccionado = aImportar.length > 0

  const totalAvisos = nuevos.reduce(
    (sum, b) => sum + b.todasLasLineas.filter(l => l.status !== 'ok').length,
    0
  )

  const toggleFecha = (fecha: string) => setSeleccionados(s => ({ ...s, [fecha]: !s[fecha] }))

  const toggleTodos = () => {
    if (todosSeleccionados) setSeleccionados({})
    else {
      const all: Record<string, boolean> = {}
      for (const b of nuevos) all[b.fecha] = true
      setSeleccionados(all)
    }
  }

  const handleConfirm = async () => {
    if (aImportar.length === 0) return
    setImporting(true)
    setError('')
    try {
      const toImport: ComparativoInput[] = aImportar.map(b => ({
        fecha: b.fecha,
        lineas: b.lineas,
        totalConteo: b.totalConteo,
        totalTiquets: b.totalTiquets,
      }))
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
            <h2 className="text-lg font-bold text-white">Importar Comparativo desde Excel</h2>
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
                <button onClick={toggleTodos} className="text-[11px] text-[#D4AF37] hover:underline" type="button">
                  {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
            )}
            <div className="space-y-1.5 mb-4 max-h-56 overflow-auto pr-2">
              {nuevos.map(b => {
                const checked = !!seleccionados[b.fecha]
                const isExpanded = !!expandidas[b.fecha]
                const problematicas = b.todasLasLineas.filter(l => l.status !== 'ok').length
                return (
                  <div
                    key={b.fecha}
                    className={`rounded-lg border transition-colors ${
                      checked
                        ? 'bg-[#4ECDC4]/10 border-[#4ECDC4]/30'
                        : 'bg-white/[0.02] border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2 p-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFecha(b.fecha)}
                        className="w-4 h-4 accent-[#4ECDC4] cursor-pointer shrink-0"
                      />
                      <span className={`text-sm flex-1 ${checked ? 'text-white' : 'text-white/60'}`}>{b.fecha}</span>
                      <span className="text-[11px] text-white/50 shrink-0">
                        {b.lineas.length} OK
                        {problematicas > 0 && <span className="text-[#FFE66D]"> · {problematicas} ⚠</span>}
                      </span>
                      <span className={`text-xs font-semibold shrink-0 ${checked ? 'text-white' : 'text-white/50'}`}>
                        {b.totalConteo} / {b.totalTiquets}
                        <span className={`ml-1 ${b.totalDiferencia === 0 ? 'text-white/30' : b.totalDiferencia > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                          ({b.totalDiferencia > 0 ? '+' : ''}{b.totalDiferencia})
                        </span>
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
                              <span className="text-[10px] text-white/40 shrink-0">
                                {l.linea.conteo}/{l.linea.tiquets}
                                {l.linea.diferencia !== 0 && (
                                  <span className={l.linea.diferencia > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}>
                                    {' '}({l.linea.diferencia > 0 ? '+' : ''}{l.linea.diferencia})
                                  </span>
                                )}
                              </span>
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
              Click en ▶ para ver el detalle (conteo / tiquets / diferencia por producto).
            </p>

            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose} disabled={importing}>Cancelar</Btn>
              <Btn variant="primary" disabled={!algunoSeleccionado || importing} onClick={handleConfirm}>
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
