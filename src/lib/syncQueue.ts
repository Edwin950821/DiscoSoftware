import { db } from './db'
import { apiFetch, API_MANAGEMENT } from './config'
import { toast } from 'sonner'

export type SyncTipo = 'jornada' | 'inventario' | 'comparativo'
export type SyncAccion = 'crear' | 'actualizar' | 'eliminar'

export interface PendingOp {
  id?: number
  tipo: SyncTipo
  accion: SyncAccion
  negocioId: string | null
  payload?: unknown
  targetId?: string
  error?: string
  intentos: number
  creadoEn: number
}

const BASE_URL: Record<SyncTipo, string> = {
  jornada: `${API_MANAGEMENT}/jornadas`,
  inventario: `${API_MANAGEMENT}/inventarios`,
  comparativo: `${API_MANAGEMENT}/comparativos`,
}

export function causaOp(op: PendingOp): 'internet' | 'servidor' | null {
  if (!op.error) return null
  if (/\bHTTP \d{3}\b/.test(op.error)) return 'servidor'
  return 'internet'
}

export function describirOp(op: PendingOp): string {
  const p = op.payload as Record<string, unknown> | undefined
  const fecha = (typeof p?.fecha === 'string' && p.fecha) || ''
  const sesion = (typeof p?.sesion === 'string' && p.sesion) || ''
  const hasta = (typeof p?.fechaHasta === 'string' && p.fechaHasta) || ''
  const detalle = (items: string[]) => {
    const bits = items.filter(Boolean)
    return bits.length ? ` · ${bits.join(' · ')}` : ''
  }
  if (op.accion === 'eliminar') {
    switch (op.tipo) {
      case 'jornada': return 'Eliminar jornada'
      case 'inventario': return 'Eliminar inventario'
      case 'comparativo': return 'Eliminar comparativo'
    }
  }
  switch (op.tipo) {
    case 'jornada': {
      const liqs = Array.isArray(p?.liquidaciones) ? (p.liquidaciones as unknown[]).length : null
      return `${op.accion === 'crear' ? 'Nueva jornada' : 'Editar jornada'} ${sesion}${detalle([fecha, liqs != null ? `${liqs} trabajador(es)` : ''])}`
    }
    case 'inventario': {
      const lineas = Array.isArray(p?.lineas) ? (p.lineas as unknown[]).length : null
      return `${op.accion === 'crear' ? 'Nuevo' : 'Editar'} inventario ${fecha}${detalle([lineas != null ? `${lineas} líneas` : ''])}`
    }
    case 'comparativo': {
      const lineas = Array.isArray(p?.lineas) ? (p.lineas as unknown[]).length : null
      return `${op.accion === 'crear' ? 'Nuevo' : 'Editar'} comparativo ${fecha}${detalle([hasta, lineas != null ? `${lineas} líneas` : ''])}`
    }
  }
}

function getNegocioActivo(): string | null {
  try {
    const raw = sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.negocioActivo || null
  } catch {
    return null
  }
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|networkerror|network error|internet|ERR_INTERNET|load failed/i.test(msg)
}

const listeners = new Set<() => void>()

function notifyChange() {
  for (const cb of listeners) cb()
}

export function subscribePending(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export async function getPendingOps(): Promise<PendingOp[]> {
  return db.pendingOps.orderBy('id').toArray()
}

export async function getPendingCount(): Promise<number> {
  return db.pendingOps.count()
}

export async function enqueueOp(op: Omit<PendingOp, 'id' | 'intentos' | 'creadoEn' | 'negocioId'>): Promise<number> {
  const id = await db.pendingOps.add({
    ...op,
    negocioId: getNegocioActivo(),
    intentos: 0,
    creadoEn: Date.now(),
  })
  notifyChange()
  return id
}

async function deleteOp(id: number) {
  await db.pendingOps.delete(id)
  notifyChange()
}

async function markError(id: number, error: string) {
  const op = await db.pendingOps.get(id)
  await db.pendingOps.update(id, { error, intentos: (op?.intentos ?? 0) + 1 })
  notifyChange()
}

export const SYNC_EVENT = 'monastery:flush'
export const SYNC_PROGRESS_EVENT = 'monastery:sync-progreso'

function emitProgreso(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(SYNC_PROGRESS_EVENT, { detail }))
}

let flushing = false
let notificarUI = false

export async function flushQueue(notificar = false): Promise<void> {
  if (notificar) notificarUI = true
  if (flushing) return
  flushing = true
  try {
    const negocioId = getNegocioActivo()
    const ops = await getPendingOps()
    if (ops.length === 0) return

    let proceedAny = false
    for (const op of ops) {
      if (!(op.negocioId && negocioId && op.negocioId !== negocioId)) { proceedAny = true; break }
    }
    if (!proceedAny) return

    let someDone = false
    let done = 0
    let procesadas = 0
    let motivo: 'completo' | 'red' | 'auth' = 'completo'
    const total = ops.length
    const opciones = ops.map(op => {
      const causa = causaOp(op)
      return describirOp(op) + (causa ? ` — ${causa === 'servidor' ? 'error del servidor' : 'sin conexión'}` : '')
    })
    if (notificarUI) emitProgreso({ estado: 'inicio', total, ops: opciones })
    for (const op of ops) {
      if (op.negocioId && negocioId && op.negocioId !== negocioId) continue

      const url = op.accion === 'eliminar' ? `${BASE_URL[op.tipo]}/${op.targetId}` : BASE_URL[op.tipo]
      const method = op.accion === 'crear' ? 'POST' : op.accion === 'actualizar' ? 'PUT' : 'DELETE'

      try {
        procesadas += 1
        const res = await apiFetch(url, {
          method,
          ...(op.accion !== 'eliminar' ? { body: JSON.stringify(op.payload) } : {}),
        })
        if (res.status === 401 || res.status === 403) { motivo = 'auth'; break }
        if (!res.ok) {
          await markError(op.id as number, `HTTP ${res.status}`)
          if (notificarUI) emitProgreso({ estado: 'progreso', done, procesadas, total, ops: opciones })
          continue
        }
        await deleteOp(op.id as number)
        done += 1
        someDone = true
        if (notificarUI) emitProgreso({ estado: 'progreso', done, procesadas, total, ops: opciones })
      } catch (err) {
        if (isNetworkError(err)) { motivo = 'red'; break }
        try {
          await markError(op.id as number, err instanceof Error ? err.message : String(err))
        } catch { /* noop: si IndexedDB falla no bloquear el flush */ }
        if (notificarUI) emitProgreso({ estado: 'progreso', done, procesadas, total, ops: opciones })
      }
    }
    if (notificarUI) {
      const restantes = await getPendingCount()
      const error = motivo !== 'completo' ? motivo : (restantes > 0 ? 'pendientes' : null)
      emitProgreso({ estado: 'fin', done, procesadas, total, error, ops: opciones })
    }
    if (someDone) window.dispatchEvent(new Event(SYNC_EVENT))
    const restantes = await getPendingCount()
    if (someDone) {
      if (restantes === 0) {
        if (avisoPendiente) {
          toast.success('Todos los cambios pendientes fueron sincronizados.')
          avisoPendiente = false
        }
      } else {
        if (!avisoPendiente) {
          toast.info(`${restantes} cambio(s) aún pendientes de sincronizar. Se reintenta automáticamente.`)
          avisoPendiente = true
        }
      }
    }
  } finally {
    flushing = false
    notificarUI = false
  }
}

let initialized = false
let estadoOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
let huboCaida = false
let avisoPendiente = false

export function initSyncListener(): void {
  if (initialized) return
  initialized = true
  window.addEventListener('offline', () => { huboCaida = true; estadoOnline = false })
  window.addEventListener('online', () => {
    const notificar = huboCaida
    huboCaida = false
    estadoOnline = true
    flushQueue(notificar)
  })
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue()
  })
  window.addEventListener('pagehide', () => { flushQueue() })
  window.setInterval(() => {
    const ahora = navigator.onLine
    if (!estadoOnline && ahora) {
      huboCaida = true
      flushQueue(true)
    }
    estadoOnline = ahora
    flushQueue()
  }, 30000)
  window.setTimeout(() => { flushQueue() }, 3000)
}