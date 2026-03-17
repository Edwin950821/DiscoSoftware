import { useState, useMemo, useEffect, useRef } from 'react'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { useMesas } from '../hooks/useMesas'
import { usePedidos } from '../hooks/usePedidos'
import { useProductos } from '../hooks/useProductos'
import { playDespachadoSound } from '../lib/sound'
import { vibrar, sendBrowserNotification } from '../lib/notification'
import type { Mesa, Producto, CuentaMesa } from '../types'

const fmtCOP = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO')

const PRODUCTO_IMG: Record<string, string> = {
  'Aguila Negra 330ml': 'AguilaNegra.png',
  'Aguila Light': 'aguila_light.png',
  'Costeñita 330ml': 'costeñita.png',
  'Coronita 355ml': 'Coronita.png',
  'Club Colombia': 'club_colombia.png',
  'Heineken': 'heineken.png',
  'Stella Artois': 'stella.png',
  'Smirnoff Ice': 'Smirnoff_Ice.png',
  'Budweiser': 'budweiser.png',
  'Antioqueño Litro Tapa Verde': 'antioqueñoVerde.png',
  'Antioqueño 750ml Verde': 'antioqueñoVerde.png',
  'Antioqueño Litro Amarillo': 'Antioqueño_Amarillo.png',
  'Old Parr 1 Litro': 'oldparr.png',
  'Agua': 'cristal.png',
  'Coca Cola': 'cocacola.png',
  'Soda': 'bretaña.png',
  'Gatorade': 'gatorade.png',
  'Electrolit': 'electrolit.png',
  'Redbull': 'redbull.png',
  'Bombon': 'bonbon.png',
  'Detodito': 'de_todito.png',
  'Vaso Michelado': 'michelada.png',
  'Mani': 'mani.png',
}

interface Props {
  meseroId: string
}

interface LineaCarrito {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
}

export default function PedidosMesero({ meseroId }: Props) {
  const { mesas, refetch: refetchMesas } = useMesas()
  const { pendientes, pedidos, notifDespachado, atenderMesa, crearPedido, getCuenta, pagarCuenta, aplicarPromos, refetch: refetchPedidos } = usePedidos()
  const { productos } = useProductos()
  const [tab, setTab] = useState<'mesas' | 'pedido' | 'mis-pedidos'>('mesas')
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null)
  const [showAtenderModal, setShowAtenderModal] = useState(false)
  const [nombreCliente, setNombreCliente] = useState('')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchProd, setSearchProd] = useState('')
  const [cuentaModal, setCuentaModal] = useState<CuentaMesa | null>(null)
  const [confirmPagar, setConfirmPagar] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [pagoExitoMsg, setPagoExitoMsg] = useState('')
  const [aplicandoPromos, setAplicandoPromos] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pagoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const productosActivos = useMemo(
    () => productos.filter(p => p.activo),
    [productos]
  )

  const productosFiltrados = useMemo(
    () => searchProd
      ? productosActivos.filter(p => p.nombre.toLowerCase().includes(searchProd.toLowerCase()))
      : productosActivos,
    [productosActivos, searchProd]
  )

  const misMesas = useMemo(
    () => mesas.filter(m => m.estado === 'OCUPADA' && m.meseroId === meseroId),
    [mesas, meseroId]
  )

  const mesasLibres = useMemo(
    () => mesas.filter(m => m.estado === 'LIBRE'),
    [mesas]
  )

  const otrasMesasOcupadas = useMemo(
    () => mesas.filter(m => m.estado === 'OCUPADA' && m.meseroId !== meseroId),
    [mesas, meseroId]
  )

  const misPedidosHoy = useMemo(
    () => pedidos.filter(p => p.meseroId === meseroId),
    [pedidos, meseroId]
  )

  const totalCarrito = useMemo(
    () => carrito.reduce((s, l) => s + l.precio * l.cantidad, 0),
    [carrito]
  )

  useEffect(() => {
    if (notifDespachado && notifDespachado.meseroId === meseroId) {
      playDespachadoSound()
      vibrar([200, 100, 200])
      sendBrowserNotification(
        `Pedido listo!`,
        `${notifDespachado.mesaNombre} — Ticket #${notifDespachado.ticketDia}`,
      )
    }
  }, [notifDespachado, meseroId])

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current)
      if (pagoTimer.current) clearTimeout(pagoTimer.current)
    }
  }, [])

  const handleAtenderMesa = async (mesa: Mesa) => {
    if (mesa.estado === 'OCUPADA' && mesa.meseroId === meseroId) {
      setMesaSeleccionada(mesa)
      setCarrito([])
      setNota('')
      setTab('pedido')
      return
    }
    if (mesa.estado === 'LIBRE') {
      setMesaSeleccionada(mesa)
      setNombreCliente('')
      setShowAtenderModal(true)
    }
  }

  const confirmarAtender = async () => {
    if (!mesaSeleccionada || !nombreCliente.trim()) return
    setLoading(true)
    setError('')
    try {
      const mesaActualizada = await atenderMesa(mesaSeleccionada.id, meseroId, nombreCliente.trim())
      setMesaSeleccionada({ ...mesaActualizada, id: String(mesaActualizada.id) })
      setShowAtenderModal(false)
      refetchMesas()
      setCarrito([])
      setNota('')
      setTab('pedido')
    } catch (e: any) {
      setError(e.message || 'Error al atender mesa')
    } finally {
      setLoading(false)
    }
  }

  const agregarAlCarrito = (p: Producto) => {
    setCarrito(prev => {
      const existe = prev.find(l => l.productoId === p.id)
      if (existe) {
        return prev.map(l => l.productoId === p.id ? { ...l, cantidad: l.cantidad + 1 } : l)
      }
      return [...prev, { productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }]
    })
  }

  const cambiarCantidad = (productoId: string, delta: number) => {
    setCarrito(prev => prev.map(l => {
      if (l.productoId !== productoId) return l
      const nueva = l.cantidad + delta
      return nueva > 0 ? { ...l, cantidad: nueva } : l
    }).filter(l => l.cantidad > 0))
  }

  const quitarDelCarrito = (productoId: string) => {
    setCarrito(prev => prev.filter(l => l.productoId !== productoId))
  }

  const enviarPedido = async () => {
    if (!mesaSeleccionada || carrito.length === 0) return
    setLoading(true)
    setError('')
    try {
      const lineas = carrito.map(l => ({ productoId: l.productoId, cantidad: l.cantidad }))
      await crearPedido(mesaSeleccionada.id, meseroId, lineas, nota.trim() || undefined)
      setSuccessMsg(`Ticket enviado para ${mesaSeleccionada.nombre}`)
      if (successTimer.current) clearTimeout(successTimer.current)
      successTimer.current = setTimeout(() => setSuccessMsg(''), 3000)
      setCarrito([])
      setNota('')
      refetchPedidos()
    } catch (e: any) {
      setError(e.message || 'Error al enviar ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleVerCuenta = async (mesaId: string) => {
    try {
      const cuenta = await getCuenta(mesaId)
      if (cuenta) {
        setCuentaModal(cuenta)
        setConfirmPagar(false)
        setPromoMsg('')
      }
    } catch (e) { console.error('Error cargando cuenta:', e) }
  }

  const handleAplicarPromos = async () => {
    if (!cuentaModal || aplicandoPromos) return
    setAplicandoPromos(true)
    setPromoMsg('')
    try {
      const cuentaActualizada = await aplicarPromos(cuentaModal.mesaId)
      const cortesiasAntes = cuentaModal.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO').length
      const cortesiasDespues = cuentaActualizada.pedidos.filter((p: any) => p.esCortesia && p.estado !== 'CANCELADO').length
      setCuentaModal(cuentaActualizada)
      if (cortesiasDespues > cortesiasAntes) {
        setPromoMsg(`Se aplicaron ${cortesiasDespues - cortesiasAntes} cortesia(s)`)
      } else if (cortesiasDespues > 0) {
        setPromoMsg('Las promociones ya estan aplicadas')
      } else {
        setPromoMsg('No hay promociones aplicables')
      }
    } catch (e: any) {
      setError(e.message || 'Error al aplicar promociones')
    } finally {
      setAplicandoPromos(false)
    }
  }

  const handlePagarCuenta = async () => {
    if (!cuentaModal || pagando) return
    setPagando(true)
    setError('')
    try {
      await pagarCuenta(cuentaModal.mesaId)
      setCuentaModal(null)
      setConfirmPagar(false)
      setPagoExitoMsg(`Cuenta de ${cuentaModal.mesaNombre} cobrada`)
      if (pagoTimer.current) clearTimeout(pagoTimer.current)
      pagoTimer.current = setTimeout(() => setPagoExitoMsg(''), 4000)
      refetchMesas()
      refetchPedidos()
    } catch (e: any) {
      setError(e.message || 'Error al pagar cuenta')
    } finally {
      setPagando(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {successMsg && (
        <div className="fixed top-6 left-1/2 z-50 pedido-enviado-toast">
          <div className="bg-[#0f1f1d] border border-[#4ECDC4]/50 rounded-2xl px-7 py-5 shadow-[0_0_40px_rgba(78,205,196,0.3),0_4px_20px_rgba(0,0,0,0.5)] flex items-center gap-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#4ECDC4]/5 via-transparent to-[#4ECDC4]/5 shimmer-bg" />
            <div className="w-12 h-12 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center shrink-0 relative check-pop">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="check-draw"/>
              </svg>
            </div>
            <div className="relative">
              <p className="text-base text-white font-bold">Ticket enviado</p>
              <p className="text-xs text-[#4ECDC4]/60 mt-0.5">{successMsg}</p>
            </div>
            <div className="absolute bottom-0 left-0 h-[3px] bg-[#4ECDC4]/40 toast-progress" />
          </div>
        </div>
      )}

      {pagoExitoMsg && !successMsg && (
        <div className="fixed top-6 left-1/2 z-50 pedido-enviado-toast">
          <div className="bg-[#0f1f1d] border border-[#4ECDC4]/50 rounded-2xl px-7 py-5 shadow-[0_0_40px_rgba(78,205,196,0.3),0_4px_20px_rgba(0,0,0,0.5)] flex items-center gap-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#4ECDC4]/5 via-transparent to-[#4ECDC4]/5 shimmer-bg" />
            <div className="w-12 h-12 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center shrink-0 relative check-pop">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="check-draw"/>
              </svg>
            </div>
            <div className="relative">
              <p className="text-base text-white font-bold">Cuenta cobrada</p>
              <p className="text-xs text-[#4ECDC4]/60 mt-0.5">{pagoExitoMsg}</p>
            </div>
            <div className="absolute bottom-0 left-0 h-[3px] bg-[#4ECDC4]/40 toast-progress-pago" />
          </div>
        </div>
      )}

      {notifDespachado && notifDespachado.meseroId === meseroId && !successMsg && (
        <div className="fixed top-6 left-1/2 z-50 despachado-mesero-toast">
          <div className="bg-[#0f1f1d] border border-[#4ECDC4]/50 rounded-2xl px-6 py-4 shadow-[0_0_40px_rgba(78,205,196,0.3),0_4px_20px_rgba(0,0,0,0.5)] flex items-center gap-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#4ECDC4]/5 via-transparent to-[#4ECDC4]/5 shimmer-bg" />
            <div className="w-10 h-10 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center shrink-0 relative check-pop">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="check-draw"/>
              </svg>
            </div>
            <div className="relative">
              <p className="text-sm text-white font-bold">Pedido listo!</p>
              <p className="text-[11px] text-[#4ECDC4]/60">{notifDespachado.mesaNombre} — Ticket #{notifDespachado.ticketDia}</p>
            </div>
            <div className="absolute bottom-0 left-0 h-[2px] bg-[#4ECDC4]/40 toast-progress-desp" />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#FF5050]/10 border border-[#FF5050]/20 text-sm text-[#FF5050]">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-[#FF5050]/60 hover:text-[#FF5050]">x</button>
        </div>
      )}

      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        <TabBtn label="Mesas" active={tab === 'mesas'} onClick={() => setTab('mesas')} badge={misMesas.length} />
        <TabBtn label="Nuevo Ticket" active={tab === 'pedido'} onClick={() => { if (mesaSeleccionada) setTab('pedido') }}
          disabled={!mesaSeleccionada} />
        <TabBtn label="Mis Tickets" active={tab === 'mis-pedidos'} onClick={() => setTab('mis-pedidos')}
          badge={misPedidosHoy.filter(p => p.estado === 'PENDIENTE').length || undefined} />
      </div>

      {tab === 'mesas' && (
        <div>
          {misMesas.length > 0 && (
            <>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Mis Mesas ({misMesas.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {misMesas.map(m => (
                  <MesaCardMesero key={m.id} mesa={m}
                    onPedir={() => handleAtenderMesa(m)}
                    onVerCuenta={() => handleVerCuenta(m.id)} />
                ))}
              </div>
            </>
          )}
          <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Mesas Libres ({mesasLibres.length})</p>
          {mesasLibres.length === 0 ? (
            <Card className="text-center py-8 text-white/30 text-sm">Todas las mesas estan ocupadas</Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {mesasLibres.map(m => (
                <div key={m.id} onClick={() => handleAtenderMesa(m)}
                  className="rounded-xl p-4 border border-white/[0.07] bg-white/[0.03] cursor-pointer hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5 transition-all">
                  <span className="text-sm font-bold text-white/40">{m.nombre}</span>
                  <p className="text-[10px] text-white/20 mt-1">Toca para atender</p>
                </div>
              ))}
            </div>
          )}

          {otrasMesasOcupadas.length > 0 && (
            <>
              <p className="text-xs text-white/20 uppercase tracking-wider mb-3 mt-6">
                Otras mesas ocupadas ({otrasMesasOcupadas.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 opacity-50">
                {otrasMesasOcupadas.map(m => (
                  <div key={m.id} className="rounded-xl p-4 border border-white/[0.05] bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white/25">{m.nombre}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/20">OCUPADA</span>
                    </div>
                    <p className="text-[10px] text-white/15">{m.meseroNombre}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'pedido' && mesaSeleccionada && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setTab('mesas')} className="text-white/30 hover:text-white/60">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <h3 className="text-lg font-bold text-[#D4AF37]">{mesaSeleccionada.nombre}</h3>
              <p className="text-xs text-white/30">{mesaSeleccionada.nombreCliente || 'Cliente'}</p>
            </div>
            {carrito.length > 0 && (
              <span className="ml-auto text-lg font-bold text-[#FFE66D]">{fmtCOP(totalCarrito)}</span>
            )}
          </div>

          {carrito.length > 0 && (
            <Card className="mb-4">
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Tu ticket</p>
              {carrito.map(l => (
                <div key={l.productoId} className="flex items-center gap-2 py-1.5 border-b border-white/[0.05] last:border-0">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => cambiarCantidad(l.productoId, -1)}
                      className="w-6 h-6 rounded-full bg-white/5 text-white/40 hover:bg-white/10 flex items-center justify-center text-sm">-</button>
                    <span className="text-sm text-white font-bold w-6 text-center">{l.cantidad}</span>
                    <button onClick={() => cambiarCantidad(l.productoId, 1)}
                      className="w-6 h-6 rounded-full bg-white/5 text-white/40 hover:bg-white/10 flex items-center justify-center text-sm">+</button>
                  </div>
                  <span className="text-sm text-white/70 flex-1">{l.nombre}</span>
                  <span className="text-sm text-white/50">{fmtCOP(l.precio * l.cantidad)}</span>
                  <button onClick={() => quitarDelCarrito(l.productoId)}
                    className="text-[#FF5050]/40 hover:text-[#FF5050] ml-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              <div className="mt-2">
                <input
                  type="text" placeholder="Nota especial (opcional)" value={nota} onChange={e => setNota(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/50"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setCarrito([]); setNota('') }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-[#FF5050]/15 bg-[#FF5050]/[0.06] text-[#FF5050]/50 hover:bg-[#FF5050]/10 hover:border-[#FF5050]/25 hover:text-[#FF5050]/70 transition-all">
                  <img src="/assets/broom.png" alt="" width="20" height="20" />
                  Limpiar
                </button>
                <Btn className="flex-1" onClick={enviarPedido} disabled={loading || carrito.length === 0}>
                  {loading ? 'Enviando...' : `Enviar Ticket — ${fmtCOP(totalCarrito)}`}
                </Btn>
              </div>
            </Card>
          )}

          <div className="mb-3 flex justify-end">
            <div className="relative w-64">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text" placeholder="Buscar producto..." value={searchProd} onChange={e => setSearchProd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {productosFiltrados.map(p => {
              const enCarrito = carrito.find(l => l.productoId === p.id)
              const img = PRODUCTO_IMG[p.nombre]
              return (
                <button key={p.id} onClick={() => agregarAlCarrito(p)}
                  className={`rounded-xl p-3 border text-left transition-all active:scale-95 relative overflow-hidden ${
                    enCarrito ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10' : 'border-white/[0.07] bg-white/[0.03] hover:border-white/15'
                  }`}>
                  {img && (
                    <img src={`/assets/${img}`} alt="" className="absolute right-0 top-0 bottom-0 w-[45%] h-full object-cover object-center opacity-25 pointer-events-none rounded-r-xl" />
                  )}
                  <div className={`relative ${img ? 'w-[55%]' : 'w-full'}`}>
                    <p className="text-sm text-white/80 font-medium leading-tight">{p.nombre}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#D4AF37]">{fmtCOP(p.precio)}</span>
                      {enCarrito && (
                        <span className="text-[10px] font-bold text-[#D4AF37] bg-[#D4AF37]/20 px-1.5 py-0.5 rounded-full">
                          x{enCarrito.cantidad}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'mis-pedidos' && (
        <MisPedidosTab pedidos={misPedidosHoy} />
      )}

      {showAtenderModal && mesaSeleccionada && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAtenderModal(false)}>
          <div className="bg-[#1a1a1a] border border-[#D4AF37]/20 rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Atender {mesaSeleccionada.nombre}</h3>
            <p className="text-xs text-white/30 mb-4">Ingresa el nombre del cliente</p>

            <input
              type="text" placeholder="Nombre del cliente" value={nombreCliente} autoFocus
              onChange={e => setNombreCliente(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && nombreCliente.trim()) confirmarAtender() }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/50 mb-4"
            />

            {error && <p className="text-xs text-[#FF5050] mb-3">{error}</p>}

            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={() => { setShowAtenderModal(false); setError('') }}>Cancelar</Btn>
              <Btn className="flex-1" onClick={confirmarAtender} disabled={loading || !nombreCliente.trim()}>
                {loading ? 'Abriendo...' : 'Atender Mesa'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {cuentaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setCuentaModal(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{cuentaModal.mesaNombre}</h3>
                <p className="text-xs text-white/40">Cliente: {cuentaModal.nombreCliente}</p>
              </div>
              <button onClick={() => setCuentaModal(null)} className="text-white/30 hover:text-white/60">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>

            {(() => {
              const pedidosRegulares = cuentaModal.pedidos.filter(p => !p.esCortesia)
              const pedidosCortesia = cuentaModal.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO')
              const totalCuenta = cuentaModal.total
              const descuento = pedidosCortesia.reduce((s, p) => s + p.total, 0)
              const totalACobrar = descuento > 0 ? totalCuenta - descuento : totalCuenta

              return (
                <>
                  <div className="space-y-3 mb-4">
                    {pedidosRegulares.map(p => (
                      <div key={p.id} className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[#D4AF37]">Ticket #{p.ticketDia}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            p.estado === 'PENDIENTE' ? 'bg-[#FFE66D]/15 text-[#FFE66D]'
                            : p.estado === 'DESPACHADO' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                            : 'bg-[#FF5050]/15 text-[#FF5050]'
                          }`}>{p.estado}</span>
                        </div>
                        {p.lineas.map(l => (
                          <div key={l.id} className="flex justify-between text-xs text-white/50 py-0.5">
                            <span>{l.cantidad}x {l.nombre}</span>
                            <span>{fmtCOP(l.total)}</span>
                          </div>
                        ))}
                      </div>
                    ))}

                    {pedidosCortesia.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-[#4ECDC4]/60 uppercase tracking-wider">Cortesias (promo)</p>
                        {pedidosCortesia.map(p => (
                          <div key={p.id} className="bg-[#4ECDC4]/5 border border-[#4ECDC4]/15 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-[#4ECDC4]">Cortesia</span>
                              {p.promoNombre && <span className="text-[10px] text-[#4ECDC4]/50">({p.promoNombre})</span>}
                            </div>
                            {p.lineas.map(l => (
                              <div key={l.id} className="flex justify-between text-xs text-[#4ECDC4]/50 py-0.5">
                                <span>{l.cantidad}x {l.nombre}</span>
                                <span className="line-through">{fmtCOP(l.total)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* TODO: Promociones deshabilitadas temporalmente */}

                  <div className="border-t border-white/10 pt-3">
                    {descuento > 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/40">Subtotal</span>
                          <span className="text-sm text-white/40 line-through">{fmtCOP(totalCuenta)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[11px] text-[#4ECDC4]">Descuento promo</span>
                          <span className="text-[11px] text-[#4ECDC4]">-{fmtCOP(descuento)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 mb-2">
                          <span className="text-sm font-bold text-white">Total a cobrar</span>
                          <span className="font-bold text-[#D4AF37] text-lg">{fmtCOP(totalACobrar)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">Total a cobrar</span>
                        <span className="font-bold text-[#D4AF37] text-lg">{fmtCOP(totalACobrar)}</span>
                      </div>
                    )}

                    {!confirmPagar ? (
                      <Btn className="w-full" onClick={() => setConfirmPagar(true)}>
                        Cobrar Cuenta — {fmtCOP(totalACobrar)}
                      </Btn>
                    ) : (
                      <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-3">
                        <p className="text-xs text-[#D4AF37] text-center mb-3 font-medium">Confirmar cobro de {fmtCOP(totalACobrar)}?</p>
                        <div className="flex gap-2">
                          <Btn variant="ghost" className="flex-1" onClick={() => setConfirmPagar(false)} disabled={pagando}>Cancelar</Btn>
                          <Btn className="flex-1" onClick={handlePagarCuenta} disabled={pagando}>
                            {pagando ? 'Cobrando...' : 'Confirmar'}
                          </Btn>
                        </div>
                      </div>
                  )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      <style>{`
        .pedido-enviado-toast {
          animation: toast-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes toast-enter {
          0% { transform: translateX(-50%) translateY(-120%) scale(0.8); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }

        .check-pop { animation: check-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both; }
        @keyframes check-pop {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .check-draw polyline {
          stroke-dasharray: 30;
          stroke-dashoffset: 30;
          animation: draw-check 0.4s ease-out 0.5s forwards;
        }
        @keyframes draw-check { to { stroke-dashoffset: 0; } }

        .shimmer-bg { animation: shimmer 2s ease-in-out infinite; }
        @keyframes shimmer {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }

        .toast-progress { animation: toast-shrink 3s linear forwards; }
        @keyframes toast-shrink { from { width: 100%; } to { width: 0%; } }

        .despachado-mesero-toast {
          animation: toast-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .toast-progress-desp { animation: toast-shrink-desp 8s linear forwards; }
        @keyframes toast-shrink-desp { from { width: 100%; } to { width: 0%; } }

        .toast-progress-pago { animation: toast-shrink-pago 4s linear forwards; }
        @keyframes toast-shrink-pago { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  )
}

function MisPedidosTab({ pedidos }: { pedidos: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (pedidos.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-white/30 text-sm">No tienes tickets hoy</p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {pedidos.map(p => {
        const expanded = expandedId === p.id
        const esCancelado = p.estado === 'CANCELADO'
        const esPendiente = p.estado === 'PENDIENTE'
        return (
          <div key={p.id}
            onClick={() => setExpandedId(expanded ? null : p.id)}
            className={`bg-card border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-white/15 ${
              expanded ? 'border-white/15' : 'border-white/[0.07]'
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#D4AF37]">#{p.ticketDia}</span>
                  <span className="text-sm text-white/70">{p.mesaNombre}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    esPendiente ? 'bg-[#FFE66D]/15 text-[#FFE66D]'
                    : esCancelado ? 'bg-[#FF5050]/15 text-[#FF5050]'
                    : 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                  }`}>{p.estado}</span>
                </div>
                <p className="text-[10px] text-white/25 mt-0.5">{p.lineas.length} items</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold ${esCancelado ? 'text-white/30 line-through' : 'text-white/70'}`}>{fmtCOP(p.total)}</span>
                <p className="text-[9px] text-white/20">
                  {new Date(p.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {expanded && (
              <div className="px-4 pb-4 border-t border-white/[0.05]">
                <div className="pt-3 space-y-1">
                  {p.lineas.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-2 py-1">
                      <span className="w-6 h-6 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] text-[10px] font-bold flex items-center justify-center shrink-0">
                        {l.cantidad}
                      </span>
                      <span className="text-xs text-white/60 flex-1">{l.nombre}</span>
                      <span className="text-[10px] text-white/30">{fmtCOP(l.precioUnitario)} c/u</span>
                      <span className="text-xs text-white/50 font-medium w-20 text-right">{fmtCOP(l.total)}</span>
                    </div>
                  ))}
                </div>

                {p.nota && (
                  <div className="mt-2 flex items-start gap-1.5 bg-[#FFE66D]/8 rounded-lg px-2.5 py-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFE66D" strokeWidth="2" className="shrink-0 mt-0.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p className="text-[11px] text-[#FFE66D]/70 italic">{p.nota}</p>
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-white/[0.05] flex items-center justify-between">
                  <div className="flex gap-4 text-[10px] text-white/20">
                    <span>Creado: {new Date(p.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    {p.despachadoEn && <span>Despachado: {new Date(p.despachadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
                  </div>
                  <span className="text-base font-extrabold text-white">{fmtCOP(p.total)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TabBtn({ label, active, onClick, badge, disabled }: {
  label: string; active: boolean; onClick: () => void; badge?: number; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-[#D4AF37] text-white font-medium shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'text-white/50 hover:text-white/70'
      }`}>
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-[#D4AF37]/20 text-[#D4AF37]'
        }`}>{badge}</span>
      )}
    </button>
  )
}

function MesaCardMesero({ mesa, onPedir, onVerCuenta }: { mesa: Mesa; onPedir: () => void; onVerCuenta: () => void }) {
  return (
    <div className="rounded-xl p-4 border border-[#D4AF37]/30 bg-[#D4AF37]/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-[#D4AF37]">{mesa.nombre}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-medium">OCUPADA</span>
      </div>
      <p className="text-xs text-white/50 truncate mb-3">{mesa.nombreCliente}</p>
      <div className="flex gap-2">
        <button onClick={onPedir}
          className="flex-1 text-[10px] font-medium py-1.5 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/30 transition-all">
          + Ticket
        </button>
        <button onClick={onVerCuenta}
          className="flex-1 text-[10px] font-medium py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 transition-all">
          Ver Cuenta
        </button>
      </div>
    </div>
  )
}
