import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Btn } from './ui/Btn'
import type { Producto } from '../types'

type FilaStatus = 'nuevo' | 'cambia-precio' | 'igual' | 'duplicado-excel' | 'sin-precio'

interface FilaParseada {
  status: FilaStatus
  nombreExcel: string
  precioExcel: number
  productoExistente?: { id: string; nombre: string; precio: number }
  motivo?: string
}

const SHEET_NAME = 'Tabla precios'
const COL_NOMBRE = 0   // col A
const COL_PRECIO = 5   // col F (precio venta)

const STATUS_CFG: Record<FilaStatus, { icon: string; color: string; label: string }> = {
  'nuevo':           { icon: '+', color: 'text-[#4ECDC4]', label: 'Nuevo Producto Encontrado(crear)' },
  'cambia-precio':   { icon: '~', color: 'text-[#FFE66D]', label: 'Actualizar precio' },
  'igual':           { icon: '=', color: 'text-white/30', label: 'Sin cambios' },
  'duplicado-excel': { icon: '↻', color: 'text-[#FF8FA3]', label: 'Duplicado en Excel' },
  'sin-precio':      { icon: '∅', color: 'text-[#FF5050]', label: 'Sin precio' },
}

interface ParseResult {
  filas: FilaParseada[]
  error?: string
}

function parseProductosSheet(buf: ArrayBuffer, productos: Producto[]): ParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const sheet = wb.Sheets[SHEET_NAME]
  if (!sheet) {
    return { filas: [], error: `No se encontró la hoja "${SHEET_NAME}" en el archivo` }
  }

  // Normalización idéntica al importador de inventario para consistencia
  const normalizar = (s: string): string => s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d+)\s*ml\b/g, '$1ml')
    .replace(/(\d+)\s*(lt|l|litro|litros)\b/g, '$1l')
    .replace(/\s+/g, ' ')
    .trim()

  const productosByNorm = new Map<string, Producto>()
  for (const p of productos) {
    productosByNorm.set(normalizar(p.nombre), p)
  }

  const hasValue = (r: number, c: number): boolean => {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })]
    return !!cell && cell.v != null && cell.v !== ''
  }

  const num = (r: number, c: number): number => {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })]
    if (!cell) return 0
    const v = cell.v
    return typeof v === 'number' ? v : 0
  }

  const filas: FilaParseada[] = []
  const nombresVistos = new Map<string, string>()

  // Datos comienzan en row 2 (index 1) — row 1 es header
  for (let r = 1; r <= 200; r++) {
    if (!hasValue(r, COL_NOMBRE)) {
      // Si la siguiente también está vacía, fin de tabla
      if (!hasValue(r + 1, COL_NOMBRE)) break
      continue
    }
    const nombre = String(sheet[XLSX.utils.encode_cell({ r, c: COL_NOMBRE })]!.v).trim()
    if (!nombre) continue
    const precio = num(r, COL_PRECIO)

    // Detección 1: nombre duplicado en Excel
    const nombreNorm = normalizar(nombre)
    if (nombresVistos.has(nombreNorm)) {
      filas.push({
        status: 'duplicado-excel',
        nombreExcel: nombre,
        precioExcel: precio,
        motivo: `Aparece más de una vez en el Excel`,
      })
      continue
    }
    nombresVistos.set(nombreNorm, nombre)

    // Detección 2: sin precio en col F
    if (precio <= 0) {
      filas.push({
        status: 'sin-precio',
        nombreExcel: nombre,
        precioExcel: precio,
        motivo: `Precio en col F está vacío o es 0`,
      })
      continue
    }

    const existente = productosByNorm.get(nombreNorm)

    if (!existente) {
      // No existe → crear nuevo
      filas.push({
        status: 'nuevo',
        nombreExcel: nombre,
        precioExcel: precio,
      })
    } else if (existente.precio === precio) {
      filas.push({
        status: 'igual',
        nombreExcel: nombre,
        precioExcel: precio,
        productoExistente: { id: existente.id, nombre: existente.nombre, precio: existente.precio },
      })
    } else {
      filas.push({
        status: 'cambia-precio',
        nombreExcel: nombre,
        precioExcel: precio,
        productoExistente: { id: existente.id, nombre: existente.nombre, precio: existente.precio },
        motivo: `${existente.precio.toLocaleString('es-CO')} → ${precio.toLocaleString('es-CO')}`,
      })
    }
  }

  return { filas }
}

interface Props {
  productos: Producto[]
  agregar: (p: Omit<Producto, 'id'>) => Promise<void>
  actualizar: (id: string, data: Partial<Producto>) => Promise<void>
  onClose: () => void
}

export default function ImportarProductosExcel({ productos, agregar, actualizar, onClose }: Props) {
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parsed, setParsed] = useState<FilaParseada[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  // Por default: 'nuevo' y 'cambia-precio' marcados; el resto desmarcados
  const [seleccionados, setSeleccionados] = useState<Record<number, boolean>>({})

  const handleFile = async (file: File) => {
    setParsing(true)
    setError('')
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const result = parseProductosSheet(buf, productos)
      if (result.error) {
        setError(result.error)
      } else if (result.filas.length === 0) {
        setError('La hoja "Tabla precios" no tiene productos para importar')
      } else {
        setParsed(result.filas)
        // Defaults: marca solo accionables (nuevo, cambia-precio)
        const initSel: Record<number, boolean> = {}
        result.filas.forEach((f, i) => {
          if (f.status === 'nuevo' || f.status === 'cambia-precio') initSel[i] = true
        })
        setSeleccionados(initSel)
      }
    } catch (e: any) {
      setError(e?.message || 'Error al leer el archivo')
    } finally {
      setParsing(false)
    }
  }

  const toggleFila = (idx: number) => {
    const f = parsed?.[idx]
    if (!f) return
    // Solo permitir toggle en filas accionables
    if (f.status !== 'nuevo' && f.status !== 'cambia-precio') return
    setSeleccionados(s => ({ ...s, [idx]: !s[idx] }))
  }

  const counts = {
    nuevo: parsed?.filter(f => f.status === 'nuevo').length ?? 0,
    cambiaPrecio: parsed?.filter(f => f.status === 'cambia-precio').length ?? 0,
    igual: parsed?.filter(f => f.status === 'igual').length ?? 0,
    duplicado: parsed?.filter(f => f.status === 'duplicado-excel').length ?? 0,
    sinPrecio: parsed?.filter(f => f.status === 'sin-precio').length ?? 0,
  }
  const aImportar = parsed?.map((f, i) => ({ f, i })).filter(({ i }) => seleccionados[i]) ?? []

  const handleConfirm = async () => {
    if (aImportar.length === 0) return
    setImporting(true)
    setError('')
    const fallidos: { nombre: string; error: string }[] = []
    let exitosos = 0
    for (const { f } of aImportar) {
      try {
        if (f.status === 'nuevo') {
          await agregar({ nombre: f.nombreExcel, precio: f.precioExcel, activo: true })
        } else if (f.status === 'cambia-precio' && f.productoExistente) {
          await actualizar(f.productoExistente.id, { precio: f.precioExcel })
        }
        exitosos++
      } catch (e: any) {
        fallidos.push({ nombre: f.nombreExcel, error: e?.message ?? 'Error desconocido' })
      }
    }
    setImporting(false)
    if (fallidos.length > 0) {
      setError(`${exitosos}/${aImportar.length} importados. Fallaron: ${fallidos.map(x => x.nombre).join(', ')}`)
    } else {
      onClose()
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
            <h2 className="text-lg font-bold text-white">Importar Productos desde Excel</h2>
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

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 text-center">
              <div className="p-2 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
                <p className="text-lg font-bold text-[#4ECDC4]">{counts.nuevo}</p>
                <p className="text-[9px] text-white/50 uppercase tracking-wider">Nuevos</p>
              </div>
              <div className="p-2 rounded-lg bg-[#FFE66D]/10 border border-[#FFE66D]/20">
                <p className="text-lg font-bold text-[#FFE66D]">{counts.cambiaPrecio}</p>
                <p className="text-[9px] text-white/50 uppercase tracking-wider">Cambia precio</p>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-lg font-bold text-white/40">{counts.igual}</p>
                <p className="text-[9px] text-white/40 uppercase tracking-wider">Sin cambio</p>
              </div>
              <div className="p-2 rounded-lg bg-[#FF8FA3]/10 border border-[#FF8FA3]/20">
                <p className="text-lg font-bold text-[#FF8FA3]">{counts.duplicado}</p>
                <p className="text-[9px] text-white/50 uppercase tracking-wider">Duplicados</p>
              </div>
              <div className="p-2 rounded-lg bg-[#FF5050]/10 border border-[#FF5050]/20">
                <p className="text-lg font-bold text-[#FF5050]">{counts.sinPrecio}</p>
                <p className="text-[9px] text-white/50 uppercase tracking-wider">Sin precio</p>
              </div>
            </div>

            <p className="text-[11px] text-white/50 mb-2 px-1">
              Selecciona qué importar (por defecto: nuevos y cambios de precio):
            </p>

            <div className="space-y-1 mb-4 max-h-72 overflow-auto pr-2">
              {parsed.map((f, i) => {
                const cfg = STATUS_CFG[f.status]
                const checked = !!seleccionados[i]
                const accionable = f.status === 'nuevo' || f.status === 'cambia-precio'
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                      checked
                        ? 'bg-[#4ECDC4]/10 border-[#4ECDC4]/30'
                        : 'bg-white/[0.02] border-white/[0.05]'
                    } ${accionable ? 'cursor-pointer' : 'opacity-60'}`}
                    onClick={() => toggleFila(i)}
                  >
                    {accionable ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFila(i)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 accent-[#4ECDC4] cursor-pointer shrink-0"
                      />
                    ) : (
                      <span className={`w-4 text-center font-mono text-xs shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        <span className="font-medium">{f.nombreExcel}</span>
                        <span className={`ml-2 text-[10px] uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                      </p>
                      {f.motivo && <p className="text-[10px] text-white/40">{f.motivo}</p>}
                    </div>
                    <span className="text-xs font-semibold text-white shrink-0 tabular-nums">
                      ${f.precioExcel.toLocaleString('es-CO')}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose} disabled={importing}>Cancelar</Btn>
              <Btn
                variant="primary"
                disabled={aImportar.length === 0 || importing}
                onClick={handleConfirm}
              >
                {importing
                  ? 'Importando...'
                  : aImportar.length === 0
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
