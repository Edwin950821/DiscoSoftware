import Dexie, { type Table } from 'dexie'
import type { PendingOp } from './syncQueue'

/* ── Tipos locales para auth ── */
export interface LocalUser {
  id?: number
  username: string
  passwordHash: string
  nombre: string
  role: 'ADMINISTRADOR' | 'DUENO' | 'MESERO'
  meseroId?: number
  isActive: boolean
}

/* ── Base de datos ── */
class MonasteryDB extends Dexie {
  productos!: Table
  trabajadores!: Table
  jornadas!: Table
  inventarios!: Table
  comparativos!: Table
  mesas!: Table
  pedidos!: Table
  cuentas!: Table
  promociones!: Table
  mesasBillar!: Table
  partidasBillar!: Table
  users!: Table<LocalUser, number>
  jornadasDiarias!: Table
  pendingOps!: Table<PendingOp, number>

  constructor() {
    super('MonasteryClub')
    this.version(1).stores({
      productos: '++id, nombre, activo',
      trabajadores: '++id, nombre, activo, username',
      jornadas: '++id, sesion, fecha, creadoEn',
      inventarios: '++id, fecha, creadoEn',
      comparativos: '++id, fecha, creadoEn',
      mesas: '++id, numero, estado',
      pedidos: '++id, mesaId, meseroId, estado, jornadaFecha, creadoEn, [mesaId+jornadaFecha]',
      cuentas: '++id, mesaId, meseroId, estado, jornadaFecha, [mesaId+jornadaFecha+estado]',
      promociones: '++id, activa',
      mesasBillar: '++id, numero, activo',
      partidasBillar: '++id, mesaBillarId, estado, jornadaFecha, [mesaBillarId+estado]',
      users: '++id, username, role',
      jornadasDiarias: '++id, fecha',
    })
    this.version(2).stores({
      productos: '++id, nombre, activo',
      trabajadores: '++id, nombre, activo, username',
      jornadas: '++id, sesion, fecha, creadoEn',
      inventarios: '++id, fecha, creadoEn',
      comparativos: '++id, fecha, creadoEn',
      mesas: '++id, numero, estado',
      pedidos: '++id, mesaId, meseroId, estado, jornadaFecha, creadoEn, [mesaId+jornadaFecha]',
      cuentas: '++id, mesaId, meseroId, estado, jornadaFecha, [mesaId+jornadaFecha+estado]',
      promociones: '++id, activa',
      mesasBillar: '++id, numero, activo',
      partidasBillar: '++id, mesaBillarId, estado, jornadaFecha, [mesaBillarId+estado]',
      users: '++id, username, role',
      jornadasDiarias: '++id, fecha',
      pendingOps: '++id, tipo, accion, negocioId, creadoEn, error',
    })
  }
}

export const db = new MonasteryDB()

/* ── Helpers ── */
export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function getHoy(): string {
  const now = new Date()
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  return col.toISOString().slice(0, 10)
}

if (import.meta.env.DEV) (window as any).db = db

