export type DiscoRol = 'ADMINISTRADOR' | 'DUENO'
export type View = 'login' | 'dashboard' | 'liquidacion' | 'jornadas' | 'inventario' | 'comparativo' | 'productos' | 'configuracion'
export type TipoPago = 'Datafono' | 'QR' | 'Nequi'

export interface Producto {
  id: string
  nombre: string
  precio: number
  activo: boolean
}

export interface Trabajador {
  id: string
  nombre: string
  color: string
  avatar: string
  activo: boolean
}

// ─── Liquidacion Diaria (por trabajador por dia) ───

export interface LineaVenta {
  productoId: string
  nombre: string
  precioUnitario: number
  cantidad: number
  total: number
}

export interface TransaccionPago {
  tipo: TipoPago
  monto: number
}

export interface Vale {
  tercero: string
  monto: number
}

export interface Cortesia {
  concepto: string
  monto: number
}

export interface GastoDiario {
  concepto: string
  monto: number
}

export interface LiquidacionTrabajador {
  trabajadorId: string
  nombre: string
  color: string
  avatar: string
  lineas: LineaVenta[]
  transacciones: TransaccionPago[]
  vales: Vale[]
  cortesias: Cortesia[]
  gastos: GastoDiario[]
  totalVenta: number
  efectivoEntregado: number
}

export interface Jornada {
  id: string
  sesion: string
  fecha: string
  liquidaciones: LiquidacionTrabajador[]
  pagos: Record<string, number>
  cortesias: number
  gastos: number
  totalVendido: number
  totalRecibido: number
  saldo: number
  creadoEn?: any
}

// ─── Inventario ───

export interface LineaInventario {
  productoId: string
  nombre: string
  valorUnitario: number
  invInicial: number
  entradas: number
  invFisico: number
  saldo: number
  total: number
}

export interface Inventario {
  id: string
  fecha: string
  lineas: LineaInventario[]
  totalGeneral: number
  creadoEn?: any
}

export type InventarioInput = Omit<Inventario, 'id' | 'creadoEn'>

// ─── Comparativo ───

export interface LineaComparativo {
  productoId: string
  nombre: string
  conteo: number
  tiquets: number
  diferencia: number
}

export interface Comparativo {
  id: string
  fecha: string
  lineas: LineaComparativo[]
  totalConteo: number
  totalTiquets: number
  creadoEn?: any
}

export type ComparativoInput = Omit<Comparativo, 'id' | 'creadoEn'>
