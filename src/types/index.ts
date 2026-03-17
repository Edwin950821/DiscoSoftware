export type DiscoRol = 'ADMINISTRADOR' | 'DUENO' | 'MESERO'
export type View = 'login' | 'dashboard' | 'liquidacion' | 'jornadas' | 'inventario' | 'comparativo' | 'productos' | 'configuracion' | 'pedidos' | 'ventas' | 'billar'
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
  username?: string
}

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

export interface Mesa {
  id: string
  numero: number
  nombre: string
  estado: string
  nombreCliente?: string
  meseroId?: string
  meseroNombre?: string
  meseroColor?: string
  meseroAvatar?: string
}

export interface LineaPedido {
  id: string
  productoId: string
  nombre: string
  precioUnitario: number
  cantidad: number
  total: number
}

export interface Pedido {
  id: string
  mesaId: string
  mesaNumero: number
  mesaNombre: string
  meseroId: string
  meseroNombre: string
  meseroColor: string
  meseroAvatar: string
  ticketDia: number
  estado: string
  total: number
  jornadaFecha: string
  nota?: string
  esCortesia: boolean
  promoNombre?: string
  lineas: LineaPedido[]
  creadoEn: string
  despachadoEn?: string
}

export interface CuentaMesa {
  id: string
  mesaId: string
  mesaNumero: number
  mesaNombre: string
  nombreCliente: string
  meseroId: string
  meseroNombre: string
  meseroColor: string
  meseroAvatar: string
  jornadaFecha: string
  total: number
  descuentoPromo?: number
  totalConDescuento?: number | null
  estado: string
  pedidos: Pedido[]
  creadoEn: string
}

export interface Promocion {
  id: string
  nombre: string
  compraProductoIds: string[]
  compraProductoNombres: string[]
  compraCantidad: number
  regaloProductoId: string
  regaloProductoNombre: string
  regaloProductoPrecio: number
  regaloCantidad: number
  activa: boolean
}

export interface PartidaBillar {
  id: string
  mesaBillarId: string
  mesaBillarNumero: number
  mesaBillarNombre: string
  nombreCliente: string
  horaInicio: string
  horaFin?: string
  precioPorHora: number
  horasCobradas?: number
  total?: number
  estado: string
  jornadaFecha: string
  creadoEn: string
}

export interface MesaBillar {
  id: string
  numero: number
  nombre: string
  precioPorHora: number
  estado: string
  activo: boolean
  partidaActiva?: PartidaBillar
}

export interface ResumenDia {
  fecha: string
  totalVentas: number
  totalBillar: number
  totalGeneral: number
  cuentasCerradas: number
  cuentasAbiertas: number
  ticketsTotales: number
  mesasAtendidas: number
  partidasBillar: number
  jornadaCerrada: boolean
}

export interface ResumenJornada {
  id: string
  fecha: string
  totalVentas: number
  totalBillar: number
  totalGeneral: number
  cuentasCerradas: number
  ticketsTotales: number
  mesasAtendidas: number
  partidasBillar: number
  cerradoEn: string
}
