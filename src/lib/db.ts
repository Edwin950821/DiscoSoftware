import Dexie, { type Table } from 'dexie'

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
  }
}

export const db = new MonasteryDB()

/* ── Helpers ── */
export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function getHoy(): string {
  return new Date().toISOString().slice(0, 10)
}
