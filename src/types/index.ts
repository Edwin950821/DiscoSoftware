export type DiscoRol = 'ADMINISTRADOR' | 'DUENO'
export type View = 'login' | 'dashboard' | 'jornadas' | 'liquidacion' | 'productos' | 'configuracion'
export type MedioPago = 'Efectivo' | 'Transferencias' | 'Vales'

export interface Producto {
  id: string
  nombre: string
  precio: number
  activo: boolean
}

export interface Mesero {
  id: string
  nombre: string
  color: string
  avatar: string
  activo: boolean
}

export interface MeseroJornada {
  meseroId: string
  nombre: string
  color: string
  avatar: string
  totalMesero: number
  pagos: Record<MedioPago, number>
  cortesias: number
  gastos: number
  efectivoEntregado: number
}

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

export interface Jornada {
  id: string
  sesion: string
  fecha: string
  meseros: MeseroJornada[]
  pagos: Record<MedioPago, number>
  cortesias: number
  gastos: number
  totalVendido: number
  totalRecibido: number
  saldo: number
  creadoEn?: any
}

export type JornadaInput = {
  sesion: string
  fecha: string
  meseros: MeseroJornada[]
}

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
