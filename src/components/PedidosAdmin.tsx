import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { useMesas } from '../hooks/useMesas'
import { usePedidos } from '../hooks/usePedidos'
import { useProductos } from '../hooks/useProductos'
import { useTrabajadores } from '../hooks/useTrabajadores'
import type { Mesa, Pedido, CuentaMesa, Producto } from '../types'
import { playDespachadoSound } from '../lib/sound'

const fmtCOP = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO')
const logoUrl = `${window.location.origin}/assets/M05.png`

function tiempoDesde(fechaStr: string): string {
  const diff = Date.now() - new Date(fechaStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `${min}m`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

export default function PedidosAdmin() {
  const { mesas, refetch: refetchMesas } = useMesas()
  const { pendientes, pedidos, notificacion, notifCuentaPagada, despachar, cancelar, editarPedido, getCuenta, pagarCuenta, aplicarPromos, atenderMesa, refetch: refetchPedidos } = usePedidos()
  const { productos } = useProductos()
  const { trabajadores } = useTrabajadores()
  const [tab, setTab] = useState<'pendientes' | 'mesas' | 'historial'>('pendientes')
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'despachar' | 'cancelar' | 'pagar' } | null>(null)
  const [cuentaModal, setCuentaModal] = useState<CuentaMesa | null>(null)
  const [pagoExitoso, setPagoExitoso] = useState<CuentaMesa | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [aplicandoPromos, setAplicandoPromos] = useState(false)
  const actionInProgress = useRef(false)
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLineas, setEditLineas] = useState<{ productoId: string; nombre: string; precioUnitario: number; cantidad: number }[]>([])
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const emptyLineas = useRef<{ productoId: string; nombre: string; precioUnitario: number; cantidad: number }[]>([]).current
  const [despachadoAlert, setDespachadoAlert] = useState<{ ticket: number; mesa: string } | null>(null)
  const despachadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (despachadoTimer.current) clearTimeout(despachadoTimer.current) }
  }, [])
  const [abrirMesaModal, setAbrirMesaModal] = useState<Mesa | null>(null)
  const [selectedMeseroId, setSelectedMeseroId] = useState<string | null>(null)
  const [clienteNombreInput, setClienteNombreInput] = useState('')
  const [abrirLoading, setAbrirLoading] = useState(false)

  useEffect(() => {
    if (notificacion) {
      setUnseenIds(prev => new Set(prev).add(notificacion.id))
    }
  }, [notificacion])

  useEffect(() => {
    if (notifCuentaPagada) {
      refetchMesas()
      refetchPedidos()
    }
  }, [notifCuentaPagada])

  useEffect(() => {
    setUnseenIds(prev => {
      if (prev.size === 0) return prev
      const pendienteIds = new Set(pendientes.map(p => p.id))
      const next = new Set<string>()
      for (const id of prev) {
        if (pendienteIds.has(id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [pendientes])

  const markSeen = useCallback((id: string) => {
    setUnseenIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const mesasOcupadas = useMemo(() => mesas.filter(m => m.estado === 'OCUPADA'), [mesas])
  const mesasLibres = useMemo(() => mesas.filter(m => m.estado === 'LIBRE'), [mesas])

  const productosActivos = useMemo(() => productos.filter(p => p.activo), [productos])
  const meserosActivos = useMemo(() => trabajadores.filter(t => t.activo), [trabajadores])

  const openAbrirMesa = (mesa: Mesa) => {
    setAbrirMesaModal(mesa)
    setSelectedMeseroId(null)
    setClienteNombreInput('')
  }

  const handleAbrirMesa = async () => {
    if (!abrirMesaModal || !selectedMeseroId) return
    setAbrirLoading(true)
    try {
      await atenderMesa(abrirMesaModal.id, selectedMeseroId, clienteNombreInput.trim() || 'Cliente')
      setAbrirMesaModal(null)
      refetchMesas()
    } catch (e: any) { alert(e.message) }
    setAbrirLoading(false)
  }

  const startEditing = (p: Pedido) => {
    setEditingId(p.id)
    setEditLineas(p.lineas.map(l => ({ productoId: l.productoId, nombre: l.nombre, precioUnitario: l.precioUnitario, cantidad: l.cantidad })))
    setShowAddProduct(false)
    setAddSearch('')
    setConfirmAction(null)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditLineas([])
    setShowAddProduct(false)
    setAddSearch('')
  }

  const updateEditCantidad = (productoId: string, delta: number) => {
    setEditLineas(prev => {
      const next = prev.map(l => l.productoId === productoId ? { ...l, cantidad: Math.max(0, l.cantidad + delta) } : l)
      return next.filter(l => l.cantidad > 0)
    })
  }

  const addProductToEdit = (prod: Producto) => {
    setEditLineas(prev => {
      const existing = prev.find(l => l.productoId === prod.id)
      if (existing) return prev.map(l => l.productoId === prod.id ? { ...l, cantidad: l.cantidad + 1 } : l)
      return [...prev, { productoId: prod.id, nombre: prod.nombre, precioUnitario: prod.precio, cantidad: 1 }]
    })
    setShowAddProduct(false)
    setAddSearch('')
  }

  const saveEdit = async (pedidoId: string) => {
    if (editLineas.length === 0) return
    setSavingEdit(true)
    try {
      await editarPedido(pedidoId, editLineas.map(l => ({ productoId: l.productoId, cantidad: l.cantidad })))
      cancelEditing()
    } catch (e) { console.error('Error editando pedido:', e) }
    setSavingEdit(false)
  }

  const editTotal = useMemo(() => editLineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0), [editLineas])

  const handleDespachar = async (id: string) => {
    if (actionInProgress.current) return
    actionInProgress.current = true
    const p = pendientes.find(x => x.id === id)
    markSeen(id)
    setLoadingId(id)
    try {
      await despachar(id)
      if (p) {
        playDespachadoSound()
        setDespachadoAlert({ ticket: p.ticketDia, mesa: p.mesaNombre })
        if (despachadoTimer.current) clearTimeout(despachadoTimer.current)
        despachadoTimer.current = setTimeout(() => setDespachadoAlert(null), 3000)
      }
    } catch {}
    actionInProgress.current = false
    setLoadingId(null)
    setConfirmAction(null)
  }

  const handleCancelar = async (id: string) => {
    if (actionInProgress.current) return
    actionInProgress.current = true
    markSeen(id)
    setLoadingId(id)
    try { await cancelar(id) } catch {}
    actionInProgress.current = false
    setLoadingId(null)
    setConfirmAction(null)
  }

  const handleVerCuenta = async (mesaId: string) => {
    try {
      const cuenta = await getCuenta(mesaId)
      if (cuenta) setCuentaModal(cuenta)
    } catch (e) { console.error('Error cargando cuenta:', e) }
  }

  const handleAplicarPromos = async () => {
    if (!cuentaModal || aplicandoPromos) return
    setAplicandoPromos(true)
    try {
      const cuentaActualizada = await aplicarPromos(cuentaModal.mesaId)
      setCuentaModal(cuentaActualizada)
    } catch (e: any) {
      console.error('Error aplicando promos:', e)
    } finally {
      setAplicandoPromos(false)
    }
  }

  const handlePagar = async (mesaId: string) => {
    setLoadingId(mesaId)
    try {
      const result = await pagarCuenta(mesaId)
      setCuentaModal(null)
      if (result) setPagoExitoso(result)
      refetchPedidos()
      refetchMesas()
    } catch (e) { console.error(e) }
    setLoadingId(null)
    setConfirmAction(null)
  }

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return
    const printWindow = window.open('', '_blank', 'width=350,height=600')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>Recibo</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; width: 280px; color: #000; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .total-row { font-size: 16px; font-weight: bold; }
        h2 { font-size: 16px; margin-bottom: 4px; }
        .small { font-size: 10px; color: #666; }
        .logo { width: 60px; height: auto; margin: 0 auto 6px; display: block; }
        h2 { font-size: 14px; margin-bottom: 2px; }
      </style></head><body>
      ${receiptRef.current.innerHTML}
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
      </body></html>
    `)
    printWindow.document.close()
  }

  const historial = useMemo(() => pedidos.filter(p => p.estado !== 'PENDIENTE'), [pedidos])
  const isPedidosMode = new URLSearchParams(window.location.search).has('mode')

  return (
    <div>
      {notificacion && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-[#1a1a1a] border border-[#CDA52F]/40 rounded-xl p-4 shadow-[0_0_30px_rgba(205,165,47,0.2)] max-w-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#CDA52F]/15 flex items-center justify-center text-[#CDA52F] shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <div>
                <p className="text-sm text-white font-medium">Nuevo Ticket #{notificacion.ticketDia}</p>
                <p className="text-xs text-white/40">{notificacion.mesaNombre} - {notificacion.meseroNombre} - {fmtCOP(notificacion.total)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {despachadoAlert && (
        <div className="fixed top-6 left-1/2 z-50 despachado-toast">
          <div className="bg-[#0f1f1d] border border-[#4ECDC4]/50 rounded-2xl px-7 py-5 shadow-[0_0_40px_rgba(78,205,196,0.3),0_4px_20px_rgba(0,0,0,0.5)] flex items-center gap-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#4ECDC4]/5 via-transparent to-[#4ECDC4]/5 shimmer-bg" />
            <div className="w-12 h-12 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center shrink-0 relative check-pop">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="check-draw"/>
              </svg>
            </div>
            <div className="relative">
              <p className="text-base text-white font-bold">Ticket #{despachadoAlert.ticket} despachado</p>
              <p className="text-xs text-[#4ECDC4]/60 mt-0.5">{despachadoAlert.mesa}</p>
            </div>
            <div className="absolute bottom-0 left-0 h-[3px] bg-[#4ECDC4]/40 toast-progress" />
          </div>
        </div>
      )}

      {notifCuentaPagada && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in">
          <div className="bg-[#1a1a1a] border border-[#4ECDC4]/40 rounded-xl p-4 shadow-[0_0_30px_rgba(78,205,196,0.2)] max-w-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[#4ECDC4] shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div>
                <p className="text-sm text-white font-medium">Cuenta cobrada por mesero</p>
                <p className="text-xs text-white/40">{notifCuentaPagada.mesaNombre} — {notifCuentaPagada.meseroNombre} — {fmtCOP(notifCuentaPagada.total)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Tickets en Tiempo Real</h2>
        {!isPedidosMode && (
          <button
            onClick={() => window.open(`${window.location.origin}?mode=pedidos`, '_blank')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Abrir en nueva pestana
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        <TabBtn label="Pendientes" active={tab === 'pendientes'} onClick={() => setTab('pendientes')} badge={pendientes.length} />
        <TabBtn label="Mesas" active={tab === 'mesas'} onClick={() => setTab('mesas')} badge={mesasOcupadas.length} />
        <TabBtn label="Historial" active={tab === 'historial'} onClick={() => setTab('historial')} />
      </div>

      {tab === 'pendientes' && (
        <div className="space-y-3">
          {pendientes.length === 0 ? (
            <Card className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-white/40 text-sm">No hay tickets pendientes</p>
            </Card>
          ) : (
            pendientes.map(p => (
              <PedidoCard key={p.id} pedido={p}
                unseen={unseenIds.has(p.id)}
                onSeen={() => markSeen(p.id)}
                loading={loadingId === p.id}
                confirmAction={confirmAction?.id === p.id ? confirmAction.action : null}
                onDespachar={() => confirmAction?.id === p.id && confirmAction.action === 'despachar' ? handleDespachar(p.id) : setConfirmAction({ id: p.id, action: 'despachar' })}
                onCancelar={() => confirmAction?.id === p.id && confirmAction.action === 'cancelar' ? handleCancelar(p.id) : setConfirmAction({ id: p.id, action: 'cancelar' })}
                onCancelConfirm={() => setConfirmAction(null)}
                isEditing={editingId === p.id}
                editLineas={editingId === p.id ? editLineas : emptyLineas}
                editTotal={editingId === p.id ? editTotal : 0}
                onStartEdit={() => startEditing(p)}
                onCancelEdit={cancelEditing}
                onUpdateCantidad={updateEditCantidad}
                onSaveEdit={() => saveEdit(p.id)}
                savingEdit={savingEdit}
                showAddProduct={editingId === p.id && showAddProduct}
                onToggleAddProduct={() => setShowAddProduct(prev => !prev)}
                addSearch={addSearch}
                onAddSearchChange={setAddSearch}
                productosActivos={productosActivos}
                onAddProduct={addProductToEdit}
              />
            ))
          )}
        </div>
      )}

      {tab === 'mesas' && (
        <div>
          {mesasOcupadas.length > 0 && (
            <>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Ocupadas ({mesasOcupadas.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
                {mesasOcupadas.map(m => (
                  <MesaCard key={m.id} mesa={m} onClick={() => handleVerCuenta(m.id)} />
                ))}
              </div>
            </>
          )}
          <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Libres ({mesasLibres.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {mesasLibres.map(m => (
              <MesaCard key={m.id} mesa={m} onClick={() => openAbrirMesa(m)} />
            ))}
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <HistorialTab historial={historial} />
      )}

      {cuentaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setCuentaModal(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{cuentaModal.mesaNombre}</h3>
                <p className="text-xs text-white/40">Cliente: {cuentaModal.nombreCliente}</p>
              </div>
              <button onClick={() => setCuentaModal(null)} className="text-white/30 hover:text-white/60">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ backgroundColor: cuentaModal.meseroColor + '33', color: cuentaModal.meseroColor }}>{cuentaModal.meseroAvatar}</div>
              <span className="text-sm text-white/60">{cuentaModal.meseroNombre}</span>
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
                          <span className="text-xs font-medium text-[#CDA52F]">Ticket #{p.ticketDia}</span>
                          <span className="text-xs text-white/40">{tiempoDesde(p.creadoEn)}</span>
                        </div>
                        {p.lineas.map(l => (
                          <div key={l.id} className="flex justify-between text-xs text-white/50 py-0.5">
                            <span>{l.cantidad}x {l.nombre}</span>
                            <span>{fmtCOP(l.total)}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/5 mt-1 pt-1 flex justify-between text-xs font-medium text-white/70">
                          <span>Subtotal</span>
                          <span>{fmtCOP(p.total)}</span>
                        </div>
                      </div>
                    ))}

                    {pedidosCortesia.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-[#4ECDC4]/60 uppercase tracking-wider">Cortesias (promo)</p>
                        {pedidosCortesia.map(p => (
                          <div key={p.id} className="bg-[#4ECDC4]/5 border border-[#4ECDC4]/15 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-[#4ECDC4]">Cortesia</span>
                                {p.promoNombre && <span className="text-[10px] text-[#4ECDC4]/50">({p.promoNombre})</span>}
                              </div>
                              <span className="text-[10px] text-[#4ECDC4]/40">{tiempoDesde(p.creadoEn)}</span>
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

                  <div className="border-t border-white/10 pt-4 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/40">Tickets: {pedidosRegulares.length}</span>
                      <span className="text-xs text-white/40">Items: {pedidosRegulares.reduce((s, p) => s + p.lineas.reduce((ls, l) => ls + l.cantidad, 0), 0)}</span>
                    </div>
                    {descuento > 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/50">Subtotal</span>
                          <span className="text-sm text-white/40 line-through">{fmtCOP(totalCuenta)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[11px] text-[#4ECDC4]">Descuento promo</span>
                          <span className="text-[11px] text-[#4ECDC4]">-{fmtCOP(descuento)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm font-bold text-white">Total a cobrar</span>
                          <span className="text-2xl font-extrabold text-[#CDA52F]">{fmtCOP(totalACobrar)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">Total</span>
                        <span className="text-2xl font-extrabold text-[#CDA52F]">{fmtCOP(totalCuenta)}</span>
                      </div>
                    )}
                  </div>

                  {/* TODO: Promociones deshabilitadas temporalmente */}

                  {cuentaModal.estado !== 'PAGADA' && (
                    confirmAction?.action === 'pagar' && confirmAction.id === cuentaModal.mesaId ? (
                      <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-4 mb-2">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Confirmar cobro</p>
                            <p className="text-xs text-white/40">Se cerrara la cuenta y liberara la mesa</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Btn className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#F5D76E] text-black font-bold hover:brightness-110" onClick={() => handlePagar(cuentaModal.mesaId)}
                            disabled={loadingId === cuentaModal.mesaId}>
                            {loadingId === cuentaModal.mesaId ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                Procesando...
                              </span>
                            ) : `Cobrar ${fmtCOP(totalACobrar)}`}
                          </Btn>
                          <Btn variant="ghost" onClick={() => setConfirmAction(null)}>Cancelar</Btn>
                        </div>
                      </div>
                    ) : (
                      <Btn className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F5D76E] text-black font-bold text-base py-3 hover:brightness-110" onClick={() => setConfirmAction({ id: cuentaModal.mesaId, action: 'pagar' })}>
                        <span className="flex items-center justify-center gap-2">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                          </svg>
                          Cobrar Mesa
                        </span>
                      </Btn>
                    )
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {abrirMesaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setAbrirMesaModal(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white">Abrir Mesa</h3>
                <p className="text-xs text-white/40">{abrirMesaModal.nombre}</p>
              </div>
              <button onClick={() => setAbrirMesaModal(null)} className="text-white/30 hover:text-white/60">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="text-xs text-white/40 block mb-1.5">Nombre del cliente</label>
              <input
                value={clienteNombreInput}
                onChange={e => setClienteNombreInput(e.target.value)}
                placeholder="Cliente (opcional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50"
              />
            </div>

            <div className="mb-5">
              <label className="text-xs text-white/40 block mb-2">Asignar mesero</label>
              {meserosActivos.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-4">No hay meseros activos</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {meserosActivos.map(m => {
                    const selected = selectedMeseroId === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMeseroId(selected ? null : m.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                          selected
                            ? 'border-[#CDA52F]/60 bg-[#CDA52F]/10 shadow-[0_0_12px_rgba(205,165,47,0.15)]'
                            : 'border-white/[0.07] bg-white/[0.03] hover:border-white/15'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: m.color + '33', color: m.color }}>
                          {m.avatar}
                        </div>
                        <div className="text-left min-w-0">
                          <p className={`text-sm font-medium truncate ${selected ? 'text-white' : 'text-white/60'}`}>{m.nombre}</p>
                        </div>
                        {selected && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#CDA52F" className="shrink-0 ml-auto">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={() => setAbrirMesaModal(null)}>Cancelar</Btn>
              <Btn
                className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#F5D76E] text-black font-bold hover:brightness-110"
                onClick={handleAbrirMesa}
                disabled={!selectedMeseroId || abrirLoading}
              >
                {abrirLoading ? 'Abriendo...' : 'Abrir Mesa'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {pagoExitoso && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPagoExitoso(null)}>
          <div className="bg-[#0f1f1d] border border-[#4ECDC4]/40 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto pago-exitoso-modal" onClick={e => e.stopPropagation()}>
            <div className="text-center pt-6 pb-4 px-6">
              <div className="w-16 h-16 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center mx-auto mb-3 check-pop">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" className="check-draw"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#4ECDC4]">Pago Confirmado</h3>
              <p className="text-xs text-white/40 mt-1">{pagoExitoso.mesaNombre} - {pagoExitoso.nombreCliente}</p>
              {pagoExitoso.descuentoPromo && pagoExitoso.descuentoPromo > 0 ? (
                <div className="mt-2">
                  <p className="text-sm text-white/40 line-through">{fmtCOP(pagoExitoso.total)}</p>
                  <p className="text-[11px] text-[#4ECDC4]/70">-{fmtCOP(pagoExitoso.descuentoPromo)} cortesia</p>
                  <p className="text-3xl font-extrabold text-white">{fmtCOP(pagoExitoso.total - pagoExitoso.descuentoPromo)}</p>
                </div>
              ) : (
                <p className="text-3xl font-extrabold text-white mt-2">{fmtCOP(pagoExitoso.total)}</p>
              )}
            </div>

            <div ref={receiptRef} style={{ position: 'absolute', left: '-9999px' }}>
              <div className="center">
                <img src={logoUrl} className="logo" alt="Monastery Club" />
                <h2 className="bold">MONASTERY CLUB</h2>
                <p className="small">Baranoa, Atlantico</p>
                <p className="small">NIT: 000.000.000-0</p>
              </div>
              <div className="divider"></div>
              <div className="row"><span>Venta:</span><span style={{fontSize:'9px'}}>{pagoExitoso.id.slice(0, 8)}</span></div>
              <div className="row"><span>Mesa:</span><span>{pagoExitoso.mesaNombre}</span></div>
              <div className="row"><span>Cliente:</span><span>{pagoExitoso.nombreCliente}</span></div>
              <div className="row"><span>Mesero:</span><span>{pagoExitoso.meseroNombre}</span></div>
              <div className="row"><span>Fecha:</span><span>{new Date().toLocaleDateString('es-CO')}</span></div>
              <div className="row"><span>Hora:</span><span>{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
              <div className="divider"></div>
              {pagoExitoso.pedidos.filter(p => !p.esCortesia).map(p => (
                <div key={p.id}>
                  <p className="bold" style={{fontSize:'11px',marginTop:'4px'}}>Ticket #{p.ticketDia}</p>
                  {p.lineas.map(l => (
                    <div key={l.id} className="row">
                      <span>{l.cantidad}x {l.nombre}</span>
                      <span>${Number(l.total).toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>
              ))}
              {pagoExitoso.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO').length > 0 && (
                <>
                  <div className="divider"></div>
                  <p className="bold" style={{fontSize:'11px',marginTop:'4px'}}>CORTESIAS</p>
                  {pagoExitoso.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO').map(p => (
                    <div key={p.id}>
                      {p.lineas.map(l => (
                        <div key={l.id} className="row">
                          <span>{l.cantidad}x {l.nombre} (Cortesia)</span>
                          <span>$0</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
              <div className="divider"></div>
              {pagoExitoso.descuentoPromo && pagoExitoso.descuentoPromo > 0 && (
                <>
                  <div className="row"><span>Subtotal</span><span>${Number(pagoExitoso.total).toLocaleString('es-CO')}</span></div>
                  <div className="row"><span>Cortesias</span><span>-${Number(pagoExitoso.descuentoPromo).toLocaleString('es-CO')}</span></div>
                </>
              )}
              <div className="row total-row">
                <span>TOTAL</span>
                <span>${Number(pagoExitoso.descuentoPromo && pagoExitoso.descuentoPromo > 0 ? pagoExitoso.total - pagoExitoso.descuentoPromo : pagoExitoso.total).toLocaleString('es-CO')}</span>
              </div>
              <div className="divider"></div>
              <div className="center">
                <p className="small" style={{marginTop:'8px'}}>Gracias por su visita</p>
                <p className="small">Monastery Club - Baranoa</p>
              </div>
            </div>

            <div className="mx-6 mb-4 bg-white/[0.04] rounded-xl p-4 border border-white/[0.07]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Detalle de la venta</p>
              {pagoExitoso.pedidos.filter(p => !p.esCortesia).map(p => (
                <div key={p.id} className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[#CDA52F]">Ticket #{p.ticketDia}</span>
                    <span className="text-[10px] text-white/30">{fmtCOP(p.total)}</span>
                  </div>
                  {p.lineas.map(l => (
                    <div key={l.id} className="flex justify-between text-[11px] text-white/45 py-0.5 pl-2">
                      <span>{l.cantidad}x {l.nombre}</span>
                      <span>{fmtCOP(l.total)}</span>
                    </div>
                  ))}
                </div>
              ))}
              {pagoExitoso.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO').length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#4ECDC4]/10">
                  <p className="text-[10px] text-[#4ECDC4]/50 uppercase tracking-wider mb-2">Cortesias</p>
                  {pagoExitoso.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO').map(p => (
                    <div key={p.id} className="mb-1">
                      {p.lineas.map(l => (
                        <div key={l.id} className="flex justify-between text-[11px] text-[#4ECDC4]/40 py-0.5 pl-2">
                          <span>{l.cantidad}x {l.nombre} (Cortesia)</span>
                          <span className="line-through">{fmtCOP(l.total)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-white/10 mt-2 pt-2">
                {pagoExitoso.descuentoPromo && pagoExitoso.descuentoPromo > 0 && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#4ECDC4]/60">Cortesias</span>
                    <span className="text-[10px] text-[#4ECDC4]/70">-{fmtCOP(pagoExitoso.descuentoPromo)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/60">Total</span>
                  <span className="text-sm font-extrabold text-white">{fmtCOP(pagoExitoso.descuentoPromo && pagoExitoso.descuentoPromo > 0 ? pagoExitoso.total - pagoExitoso.descuentoPromo : pagoExitoso.total)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Btn className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#F5D76E] text-black font-bold hover:brightness-110" onClick={handlePrintReceipt}>
                <span className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Imprimir Recibo
                </span>
              </Btn>
              <Btn variant="ghost" onClick={() => setPagoExitoso(null)}>Cerrar</Btn>
            </div>
          </div>
        </div>
      )}

      <PedidosStyles />
    </div>
  )
}

const PedidosStyles = memo(function PedidosStyles() {
  return (
    <style>{`
      @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      .animate-slide-in { animation: slide-in 0.3s ease-out; }
      .despachado-toast { animation: toast-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      @keyframes toast-enter {
        0% { transform: translateX(-50%) translateY(-120%) scale(0.8); opacity: 0; }
        100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      }
      .check-pop { animation: check-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both; }
      @keyframes check-pop { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      .check-draw polyline { stroke-dasharray: 30; stroke-dashoffset: 30; animation: draw-check 0.4s ease-out 0.5s forwards; }
      @keyframes draw-check { to { stroke-dashoffset: 0; } }
      .shimmer-bg { animation: shimmer 2s ease-in-out infinite; }
      @keyframes shimmer { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
      .toast-progress { animation: toast-shrink 3s linear forwards; }
      @keyframes toast-shrink { from { width: 100%; } to { width: 0%; } }
      .pedido-unseen { animation: pedido-pulse 1.5s ease-in-out infinite; }
      @keyframes pedido-pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.3); } }
      @keyframes avatar-ring { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
      .avatar-bounce { animation: avatar-bounce 1.5s ease-in-out infinite; }
      @keyframes avatar-bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
      .nuevo-badge { animation: badge-blink 1s ease-in-out infinite; }
      @keyframes badge-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      .tiempo-urgente { animation: tiempo-pulse 1.2s ease-in-out infinite; }
      @keyframes tiempo-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,80,80,0.4); transform: scale(1); } 50% { box-shadow: 0 0 12px 4px rgba(255,80,80,0.25); transform: scale(1.05); } }
      .pago-exitoso-modal { animation: pago-modal-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; box-shadow: 0 0 60px rgba(78,205,196,0.2), 0 4px 30px rgba(0,0,0,0.5); }
      @keyframes pago-modal-enter { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    `}</style>
  )
})

function TabBtn({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-2 ${
        active ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'
      }`}>
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-[#CDA52F]/20 text-[#CDA52F]'
        }`}>{badge}</span>
      )}
    </button>
  )
}

const PedidoCard = memo(function PedidoCard({ pedido, unseen, onSeen, loading, confirmAction, onDespachar, onCancelar, onCancelConfirm,
  isEditing, editLineas, editTotal, onStartEdit, onCancelEdit, onUpdateCantidad, onSaveEdit, savingEdit,
  showAddProduct, onToggleAddProduct, addSearch, onAddSearchChange, productosActivos, onAddProduct,
}: {
  pedido: Pedido; unseen: boolean; onSeen: () => void; loading: boolean; confirmAction: string | null
  onDespachar: () => void; onCancelar: () => void; onCancelConfirm: () => void
  isEditing: boolean; editLineas: { productoId: string; nombre: string; precioUnitario: number; cantidad: number }[]
  editTotal: number; onStartEdit: () => void; onCancelEdit: () => void
  onUpdateCantidad: (productoId: string, delta: number) => void; onSaveEdit: () => void; savingEdit: boolean
  showAddProduct: boolean; onToggleAddProduct: () => void; addSearch: string; onAddSearchChange: (v: string) => void
  productosActivos: Producto[]; onAddProduct: (p: Producto) => void
}) {
  const color = pedido.meseroColor || '#CDA52F'
  const tiempo = tiempoDesde(pedido.creadoEn)
  const esUrgente = tiempo.includes('m') && parseInt(tiempo) >= 5

  const filteredProducts = productosActivos.filter(p =>
    !editLineas.some(l => l.productoId === p.id) &&
    p.nombre.toLowerCase().includes(addSearch.toLowerCase())
  )

  return (
    <div
      onClick={unseen ? onSeen : undefined}
      className={`bg-card border rounded-xl overflow-hidden transition-all ${
        unseen ? 'cursor-pointer pedido-unseen' : isEditing ? 'border-[#4ECDC4]/40 shadow-[0_0_20px_rgba(78,205,196,0.15)]' : 'border-white/[0.07]'
      }`}
      style={unseen ? {
        borderColor: color,
        boxShadow: `0 0 15px ${color}66, inset 0 0 10px ${color}1a`,
      } : undefined}
    >
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="relative shrink-0">
          {unseen && (
            <div className="absolute -inset-1 rounded-full"
              style={{ animation: 'avatar-ring 1.5s ease-in-out infinite', border: `2px solid ${color}` }} />
          )}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold ${unseen ? 'avatar-bounce' : ''}`}
            style={{ backgroundColor: color + '33', color }}>
            {pedido.meseroAvatar}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-[#CDA52F]">#{pedido.ticketDia}</span>
            <span className="text-sm text-white font-semibold">{pedido.mesaNombre}</span>
            {unseen && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#FF5050]/20 text-[#FF5050] nuevo-badge">NUEVO</span>}
            {isEditing && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#4ECDC4]/20 text-[#4ECDC4]">EDITANDO</span>}
          </div>
          <p className="text-[11px] text-white/35">{pedido.meseroNombre}</p>
        </div>
        {esUrgente ? (
          <div className="shrink-0 rounded-lg bg-[#FF5050]/15 border border-[#FF5050]/30 px-3 py-1.5 text-center tiempo-urgente">
            <p className="text-base font-extrabold text-[#FF5050] leading-none">{tiempo}</p>
            <p className="text-[7px] uppercase tracking-widest font-bold text-[#FF5050]/70 mt-0.5">Esperando</p>
          </div>
        ) : (
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-white/30">{tiempo}</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-2">
        {isEditing ? (
          <div className="space-y-1.5">
            {editLineas.map(l => (
              <div key={l.productoId} className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2 py-1.5">
                <span className="text-xs text-white/70 font-medium flex-1 truncate">{l.nombre}</span>
                <span className="text-[10px] text-white/30">{fmtCOP(l.precioUnitario)}</span>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => onUpdateCantidad(l.productoId, -1)}
                    className="w-6 h-6 rounded-md bg-[#FF5050]/15 text-[#FF5050] text-sm font-bold flex items-center justify-center hover:bg-[#FF5050]/25 transition-colors">
                    -
                  </button>
                  <span className="w-7 text-center text-sm font-bold text-[#CDA52F]">{l.cantidad}</span>
                  <button onClick={() => onUpdateCantidad(l.productoId, 1)}
                    className="w-6 h-6 rounded-md bg-[#4ECDC4]/15 text-[#4ECDC4] text-sm font-bold flex items-center justify-center hover:bg-[#4ECDC4]/25 transition-colors">
                    +
                  </button>
                </div>
                <span className="text-xs font-bold text-white/50 w-16 text-right">{fmtCOP(l.precioUnitario * l.cantidad)}</span>
              </div>
            ))}

            {showAddProduct ? (
              <div className="bg-white/[0.04] rounded-lg p-2 border border-[#4ECDC4]/20">
                <div className="relative mb-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    value={addSearch}
                    onChange={e => onAddSearchChange(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ECDC4]/40"
                    autoFocus
                  />
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {filteredProducts.slice(0, 8).map(p => (
                    <button key={p.id} onClick={() => onAddProduct(p)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs hover:bg-white/5 transition-colors">
                      <span className="text-white/70">{p.nombre}</span>
                      <span className="text-white/30">{fmtCOP(p.precio)}</span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="text-[10px] text-white/20 text-center py-2">No hay productos</p>
                  )}
                </div>
              </div>
            ) : (
              <button onClick={onToggleAddProduct}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-white/10 text-xs text-white/30 hover:text-[#4ECDC4] hover:border-[#4ECDC4]/30 transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                Agregar producto
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {pedido.lineas.map(l => (
              <div key={l.id} className="flex items-center gap-1 bg-white/[0.06] rounded-lg pl-1 pr-2.5 py-1">
                <span className="w-6 h-6 rounded-md bg-[#CDA52F]/20 text-[#CDA52F] text-[11px] font-bold flex items-center justify-center shrink-0">
                  {l.cantidad}
                </span>
                <span className="text-xs text-white/70 font-medium truncate max-w-[160px]">{l.nombre}</span>
              </div>
            ))}
          </div>
        )}

        {pedido.nota && !isEditing && (
          <div className="mt-2 flex items-start gap-1.5 bg-[#FFE66D]/8 rounded-lg px-2.5 py-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFE66D" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p className="text-[11px] text-[#FFE66D]/70 italic leading-tight">{pedido.nota}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-t border-white/[0.05]">
        <span className="text-lg font-extrabold text-white">{fmtCOP(isEditing ? editTotal : pedido.total)}</span>
        <div className="flex gap-2 items-center">
          {isEditing ? (
            <>
              <Btn size="sm" variant="ghost" onClick={onCancelEdit}>Cancelar</Btn>
              <Btn size="sm" onClick={onSaveEdit} disabled={savingEdit || editLineas.length === 0} className="px-5 font-bold bg-[#4ECDC4] hover:bg-[#4ECDC4]/80">
                {savingEdit ? 'Guardando...' : 'Guardar'}
              </Btn>
            </>
          ) : confirmAction === 'cancelar' ? (
            <>
              <Btn size="sm" variant="danger" onClick={onCancelar} disabled={loading}>
                {loading ? '...' : 'Si, cancelar'}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={onCancelConfirm}>No</Btn>
            </>
          ) : confirmAction === 'despachar' ? (
            <>
              <Btn size="sm" onClick={onDespachar} disabled={loading}>
                {loading ? '...' : 'Si, despachar'}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={onCancelConfirm}>No</Btn>
            </>
          ) : (
            <>
              <button onClick={onCancelar} className="p-2 rounded-lg text-white/20 hover:text-[#FF5050] hover:bg-[#FF5050]/10 transition-all" title="Cancelar ticket">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
              <button onClick={onStartEdit} className="p-2 rounded-lg text-white/20 hover:text-[#4ECDC4] hover:bg-[#4ECDC4]/10 transition-all" title="Editar ticket">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <Btn size="sm" onClick={onDespachar} disabled={loading} className="px-5 font-bold">Despachar</Btn>
            </>
          )}
        </div>
      </div>
    </div>
  )
}, (prev, next) =>
  prev.pedido === next.pedido &&
  prev.unseen === next.unseen &&
  prev.loading === next.loading &&
  prev.confirmAction === next.confirmAction &&
  prev.isEditing === next.isEditing &&
  prev.editTotal === next.editTotal &&
  prev.editLineas === next.editLineas &&
  prev.savingEdit === next.savingEdit &&
  prev.showAddProduct === next.showAddProduct &&
  prev.addSearch === next.addSearch
)

function HistorialTab({ historial }: { historial: Pedido[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const filtrado = useMemo(() => {
    if (!busqueda.trim()) return historial
    const q = busqueda.trim().toLowerCase()
    return historial.filter(p =>
      `#${p.ticketDia}`.includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.meseroNombre.toLowerCase().includes(q) ||
      p.mesaNombre.toLowerCase().includes(q) ||
      p.lineas.some(l => l.nombre.toLowerCase().includes(q))
    )
  }, [historial, busqueda])

  if (historial.length === 0) {
    return <Card className="text-center py-8 text-white/30 text-sm">No hay tickets en el historial de hoy</Card>
  }

  return (
    <div className="space-y-2">
      <div className="relative max-w-[240px]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar #ticket, UUID, mesero..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50 transition-colors"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
      {busqueda && <p className="text-[9px] text-white/25 px-1">{filtrado.length} resultado{filtrado.length !== 1 ? 's' : ''}</p>}
      {filtrado.map(p => {
        const expanded = expandedId === p.id
        const color = p.meseroColor || '#CDA52F'
        const esCancelado = p.estado === 'CANCELADO'
        return (
          <div key={p.id}
            onClick={() => setExpandedId(expanded ? null : p.id)}
            className={`bg-card border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-white/15 ${
              expanded ? 'border-white/15' : 'border-white/[0.07]'
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ backgroundColor: color + '33', color }}>{p.meseroAvatar}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80 font-bold">#{p.ticketDia}</span>
                  <span className="text-xs text-white/40">{p.mesaNombre}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    esCancelado ? 'bg-[#FF5050]/15 text-[#FF5050]' : 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                  }`}>{p.estado}</span>
                </div>
                <p className="text-[10px] text-white/25">{p.meseroNombre} - {p.lineas.length} items</p>
                <p className="text-[8px] text-white/15 font-mono truncate max-w-[180px]" title={p.id}>ID: {p.id}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold ${esCancelado ? 'text-white/30 line-through' : 'text-white/70'}`}>{fmtCOP(p.total)}</span>
                {p.despachadoEn && (
                  <p className="text-[9px] text-white/20">{new Date(p.despachadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {expanded && (
              <div className="px-4 pb-4 border-t border-white/[0.05]">
                <div className="pt-3 space-y-1">
                  {p.lineas.map(l => (
                    <div key={l.id} className="flex items-center gap-2 py-1">
                      <span className="w-6 h-6 rounded-md bg-[#CDA52F]/15 text-[#CDA52F] text-[10px] font-bold flex items-center justify-center shrink-0">
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

                <div className="mt-3 pt-2 border-t border-white/[0.05] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-[10px] text-white/20">
                      <span>Creado: {new Date(p.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      {p.despachadoEn && <span>Despachado: {new Date(p.despachadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
                    </div>
                    <span className="text-base font-extrabold text-white">{fmtCOP(p.total)}</span>
                  </div>
                  <p className="text-[9px] text-white/15 font-mono select-all">UUID: {p.id}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MesaCard({ mesa, onClick }: { mesa: Mesa; onClick?: () => void }) {
  const ocupada = mesa.estado === 'OCUPADA'
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-4 border transition-all cursor-pointer ${
        ocupada
          ? 'bg-[#CDA52F]/10 border-[#CDA52F]/30 hover:border-[#CDA52F]/60'
          : 'bg-white/[0.03] border-white/[0.07] hover:border-[#4ECDC4]/30 hover:bg-[#4ECDC4]/5'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${ocupada ? 'text-[#CDA52F]' : 'text-white/50'}`}>{mesa.nombre}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
          ocupada ? 'bg-[#CDA52F]/20 text-[#CDA52F]' : 'bg-white/5 text-white/20'
        }`}>{mesa.estado}</span>
      </div>
      {ocupada ? (
        <>
          <p className="text-xs text-white/50 truncate">{mesa.nombreCliente}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold"
              style={{ backgroundColor: (mesa.meseroColor || '#666') + '33', color: mesa.meseroColor || '#666' }}>
              {mesa.meseroAvatar}
            </div>
            <span className="text-[10px] text-white/30">{mesa.meseroNombre}</span>
          </div>
        </>
      ) : (
        <p className="text-[10px] text-white/20 mt-1">Toca para abrir y asignar mesero</p>
      )}
    </div>
  )
}
