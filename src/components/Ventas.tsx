import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Card } from './ui/Card'
import { useVentas } from '../hooks/useVentas'
import { useJornadaDiaria } from '../hooks/useJornadaDiaria'
import { API_PEDIDOS, apiFetch } from '../lib/config'
import { getSocket } from '../lib/socket'
import type { CuentaMesa, PartidaBillar, Pedido, ResumenJornada } from '../types'

const fmtCOP = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO')
const logoUrl = `${window.location.origin}/assets/M05.png`
const API = import.meta.env.VITE_API_URL || '/api/disco'

type VentaItem =
  | { tipo: 'cuenta'; data: CuentaMesa; id: string; total: number; timestamp: string }
  | { tipo: 'billar'; data: PartidaBillar; id: string; total: number; timestamp: string }

export default function Ventas() {
  const { ventasPagadas, ventasAbiertas, totalVentas, refetch: refetchVentas } = useVentas()
  const { resumen, historial, cerrarJornada, loading: cerrandoJornada } = useJornadaDiaria()
  const [partidasBillar, setPartidasBillar] = useState<PartidaBillar[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState<CuentaMesa | null>(null)
  const [search, setSearch] = useState('')
  const receiptRef = useRef<HTMLDivElement>(null)

  const [showCerrarModal, setShowCerrarModal] = useState(false)
  const [jornadaCerradaExito, setJornadaCerradaExito] = useState<ResumenJornada | null>(null)
  const [showHistorial, setShowHistorial] = useState(false)
  const [historialExpandedId, setHistorialExpandedId] = useState<string | null>(null)

  const [confirmPagar, setConfirmPagar] = useState<string | null>(null)
  const [pagandoId, setPagandoId] = useState<string | null>(null)

  const handlePagar = async (mesaId: string) => {
    setPagandoId(mesaId)
    try {
      const res = await apiFetch(`${API_PEDIDOS}/mesas/${mesaId}/pagar`, { method: 'POST' })
      if (!res.ok) throw new Error('Error al pagar')
      setConfirmPagar(null)
      refetchVentas()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cobrar mesa')
    } finally {
      setPagandoId(null)
    }
  }

  const handleCerrarJornada = async () => {
    try {
      const result = await cerrarJornada()
      setShowCerrarModal(false)
      if (result) setJornadaCerradaExito(result)
      refetchVentas()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cerrar jornada')
    }
  }

  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null)
  const [editLines, setEditLines] = useState<{ productoId: string; cantidad: number; nombre: string; precioUnitario: number }[]>([])
  const [saving, setSaving] = useState(false)

  const startEdit = (pedido: Pedido) => {
    setEditingPedidoId(pedido.id)
    setEditLines(pedido.lineas.map(l => ({
      productoId: l.productoId,
      cantidad: l.cantidad,
      nombre: l.nombre,
      precioUnitario: l.precioUnitario,
    })))
  }

  const cancelEdit = () => {
    setEditingPedidoId(null)
    setEditLines([])
  }

  const updateQty = (idx: number, delta: number) => {
    setEditLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const nueva = Math.max(0, l.cantidad + delta)
      return { ...l, cantidad: nueva }
    }))
  }

  const saveEdit = async () => {
    if (!editingPedidoId) return
    const lineasConCantidad = editLines.filter(l => l.cantidad > 0)
    if (lineasConCantidad.length === 0) return
    setSaving(true)
    try {
      const res = await apiFetch(`${API_PEDIDOS}/${editingPedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineas: lineasConCantidad.map(l => ({ productoId: l.productoId, cantidad: l.cantidad })) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message || 'Error al editar pedido')
      }
      cancelEdit()
      refetchVentas()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al editar pedido')
    } finally {
      setSaving(false)
    }
  }

  const editTotal = useMemo(() => editLines.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0), [editLines])

  const fetchBillarPartidas = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/billar/partidas/hoy`)
      if (res.ok) {
        const data = await res.json()
        setPartidasBillar(data.filter((p: PartidaBillar) => p.estado === 'FINALIZADA').map((p: any) => ({ ...p, id: String(p.id) })))
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchBillarPartidas()
    const id = setInterval(fetchBillarPartidas, 30000)
    const socket = getSocket()
    const handler = () => fetchBillarPartidas()
    if (socket) {
      socket.on('billar_partida_finalizada', handler)
    }
    return () => {
      clearInterval(id)
      if (socket) socket.off('billar_partida_finalizada', handler)
    }
  }, [fetchBillarPartidas])

  const totalBillar = useMemo(() => partidasBillar.reduce((s, p) => s + (p.total || 0), 0), [partidasBillar])
  const totalAbiertas = useMemo(() => ventasAbiertas.reduce((s, c) => s + c.total, 0), [ventasAbiertas])
  const totalTickets = useMemo(() => ventasPagadas.reduce((s, c) => s + c.pedidos.length, 0), [ventasPagadas])

  const allVentas: VentaItem[] = useMemo(() => {
    const cuentas: VentaItem[] = ventasPagadas.map(c => ({
      tipo: 'cuenta' as const, data: c, id: c.id, total: c.total, timestamp: c.creadoEn
    }))
    const billar: VentaItem[] = partidasBillar.map(p => ({
      tipo: 'billar' as const, data: p, id: p.id, total: p.total || 0, timestamp: p.creadoEn
    }))
    return [...cuentas, ...billar].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [ventasPagadas, partidasBillar])

  const filteredVentas = useMemo(() => {
    if (!search.trim()) return allVentas
    const q = search.toLowerCase()
    return allVentas.filter(v => {
      if (v.tipo === 'cuenta') {
        const c = v.data as CuentaMesa
        return c.mesaNombre.toLowerCase().includes(q) ||
          c.meseroNombre.toLowerCase().includes(q) ||
          c.nombreCliente.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.pedidos.some(p => String(p.ticketDia).includes(q))
      } else {
        const p = v.data as PartidaBillar
        return p.mesaBillarNombre.toLowerCase().includes(q) ||
          p.nombreCliente.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          'billar'.includes(q)
      }
    })
  }, [allVentas, search])

  const handlePrint = (cuenta: CuentaMesa) => {
    setReceiptData(cuenta)
    setTimeout(() => {
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
          .small { font-size: 10px; color: #666; }
          .logo { width: 60px; height: auto; margin: 0 auto 6px; display: block; }
          h2 { font-size: 14px; margin-bottom: 2px; }
        </style></head><body>
        ${receiptRef.current.innerHTML}
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
        </body></html>
      `)
      printWindow.document.close()
      setReceiptData(null)
    }, 100)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Ventas del Dia</h2>
          <p className="text-xs text-white/30 mt-0.5">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistorial(!showHistorial)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
              showHistorial ? 'border-[#4ECDC4]/40 bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'border-white/10 text-white/40 hover:bg-white/5'
            }`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Historial
          </button>
          {resumen && !resumen.jornadaCerrada && (
            <button onClick={() => setShowCerrarModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[#FF5050]/30 bg-[#FF5050]/10 text-[#FF5050] hover:bg-[#FF5050]/20 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Terminar Jornada
            </button>
          )}
          {resumen?.jornadaCerrada && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#4ECDC4]/30 bg-[#4ECDC4]/10 text-[#4ECDC4]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Jornada Cerrada
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Vendido" value={fmtCOP(totalVentas + totalBillar)} color="#4ECDC4" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z"/>
          </svg>
        } />
        <KpiCard label="Ventas Cerradas" value={String(ventasPagadas.length + partidasBillar.length)} color="#D4AF37" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        } />
        <KpiCard label="Tickets Totales" value={String(totalTickets)} color="#FF6B35" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-9 7.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/>
          </svg>
        } />
        <KpiCard label="Mesas Abiertas" value={`${ventasAbiertas.length} (${fmtCOP(totalAbiertas)})`} color="#FFE66D" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 8h-3V6c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v4h2v-2h2v2h12v-2h2v2h2v-4c0-1.1-.9-2-2-2zM9 6h6v2H9V6zM4 20h2v-4H4v4zm14 0h2v-4h-2v4z"/>
          </svg>
        } />
      </div>

      {!showHistorial ? (
        <>
          <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Cuentas abiertas ({ventasAbiertas.length})</p>
          {ventasAbiertas.length === 0 ? (
            <Card className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-[#FFE66D]/10 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFE66D" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-white/40 text-sm">No hay mesas abiertas</p>
              <p className="text-white/20 text-xs mt-1">Las mesas apareceran aqui cuando se atiendan</p>
            </Card>
          ) : (
          <div className="space-y-2">
            {ventasAbiertas.map(cuenta => {
              const color = cuenta.meseroColor || '#CDA52F'
              const expanded = expandedId === `abierta-${cuenta.id}`
              return (
                <div key={cuenta.id}
                  className={`bg-card border rounded-xl overflow-hidden transition-all ${
                    expanded ? 'border-[#FFE66D]/30' : 'border-[#FFE66D]/20 hover:border-[#FFE66D]/40'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : `abierta-${cuenta.id}`)}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: color + '33', color }}>{cuenta.meseroAvatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-bold">{cuenta.mesaNombre}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#FFE66D]/15 text-[#FFE66D]">ABIERTA</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-white/30">{cuenta.pedidos.length} tickets</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-white/40"><span className="text-white/20">Mesero:</span> {cuenta.meseroNombre}</span>
                        <span className="text-[10px] text-white/40"><span className="text-white/20">Cliente:</span> {cuenta.nombreCliente}</span>
                      </div>
                    </div>
                    {(() => {
                      const desc = cuenta.descuentoPromo || 0
                      const neto = desc > 0 ? cuenta.total - desc : cuenta.total
                      return (
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-[#FFE66D]">{fmtCOP(neto)}</span>
                          {desc > 0 && <p className="text-[9px] text-[#4ECDC4]/50">-{fmtCOP(desc)} promo</p>}
                          <p className="text-[9px] text-white/20">
                            {new Date(cuenta.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )
                    })()}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>

                  {expanded && (() => {
                    const pedidosRegulares = cuenta.pedidos.filter(p => !p.esCortesia)
                    const pedidosCortesia = cuenta.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO')
                    const descuento = pedidosCortesia.reduce((s, p) => s + p.total, 0)
                    return (
                    <div className="px-4 pb-4 border-t border-white/[0.05]">
                      <div className="pt-3 space-y-3">
                        {pedidosRegulares.map(p => {
                          const isEditing = editingPedidoId === p.id
                          return (
                          <div key={p.id} className="bg-white/[0.04] rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-[#CDA52F]">Ticket #{p.ticketDia}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                  p.estado === 'PENDIENTE' ? 'bg-[#FFE66D]/15 text-[#FFE66D]'
                                  : p.estado === 'DESPACHADO' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                                  : 'bg-[#FF5050]/15 text-[#FF5050]'
                                }`}>{p.estado}</span>
                                {!isEditing ? (
                                  <>
                                    <span className="text-xs text-white/30">{fmtCOP(p.total)}</span>
                                    <button onClick={(e) => { e.stopPropagation(); startEdit(p) }}
                                      className="ml-1 p-1 rounded-md bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
                                      title="Editar cantidades">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                      </svg>
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs font-bold text-[#D4AF37]">{fmtCOP(editTotal)}</span>
                                )}
                              </div>
                            </div>

                            {isEditing ? (
                              <>
                                {editLines.map((l, idx) => (
                                  <div key={idx} className="flex items-center gap-2 py-1">
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button onClick={() => updateQty(idx, -1)}
                                        className="w-5 h-5 rounded bg-[#FF5050]/15 text-[#FF5050] text-xs font-bold flex items-center justify-center hover:bg-[#FF5050]/25 transition-colors"
                                        disabled={l.cantidad <= 0}>−</button>
                                      <span className="w-6 text-center text-xs font-bold text-[#D4AF37]">{l.cantidad}</span>
                                      <button onClick={() => updateQty(idx, 1)}
                                        className="w-5 h-5 rounded bg-[#4ECDC4]/15 text-[#4ECDC4] text-xs font-bold flex items-center justify-center hover:bg-[#4ECDC4]/25 transition-colors">+</button>
                                    </div>
                                    <span className={`text-xs flex-1 ${l.cantidad === 0 ? 'text-white/20 line-through' : 'text-white/50'}`}>{l.nombre}</span>
                                    <span className="text-[10px] text-white/25">{fmtCOP(l.precioUnitario)} c/u</span>
                                    <span className={`text-xs font-medium w-20 text-right ${l.cantidad === 0 ? 'text-white/15' : 'text-white/50'}`}>
                                      {fmtCOP(l.precioUnitario * l.cantidad)}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-white/[0.05]">
                                  <button onClick={cancelEdit}
                                    className="px-3 py-1 rounded-lg text-[10px] font-medium border border-white/10 text-white/40 hover:bg-white/5 transition-colors">
                                    Cancelar
                                  </button>
                                  <button onClick={saveEdit} disabled={saving || editLines.every(l => l.cantidad === 0)}
                                    className="px-3 py-1 rounded-lg text-[10px] font-medium bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/30 transition-colors disabled:opacity-40">
                                    {saving ? 'Guardando...' : 'Guardar'}
                                  </button>
                                </div>
                              </>
                            ) : (
                              p.lineas.map(l => (
                                <div key={l.id} className="flex items-center gap-2 py-0.5">
                                  <span className="w-5 h-5 rounded-md bg-[#CDA52F]/15 text-[#CDA52F] text-[9px] font-bold flex items-center justify-center shrink-0">{l.cantidad}</span>
                                  <span className="text-xs text-white/50 flex-1">{l.nombre}</span>
                                  <span className="text-[10px] text-white/25">{fmtCOP(l.precioUnitario)} c/u</span>
                                  <span className="text-xs text-white/50 font-medium w-20 text-right">{fmtCOP(l.total)}</span>
                                </div>
                              ))
                            )}
                          </div>
                          )
                        })}

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
                                </div>
                                {p.lineas.map(l => (
                                  <div key={l.id} className="flex items-center gap-2 py-0.5">
                                    <span className="w-5 h-5 rounded-md bg-[#4ECDC4]/15 text-[#4ECDC4] text-[9px] font-bold flex items-center justify-center shrink-0">{l.cantidad}</span>
                                    <span className="text-xs text-[#4ECDC4]/50 flex-1">{l.nombre}</span>
                                    <span className="text-xs text-[#4ECDC4]/30 font-medium w-20 text-right line-through">{fmtCOP(l.total)}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/[0.07]">
                        {descuento > 0 ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-white/30">{pedidosRegulares.length} ticket{pedidosRegulares.length !== 1 ? 's' : ''} en cuenta</span>
                              <span className="text-sm text-white/40 line-through">{fmtCOP(cuenta.total)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[11px] text-[#4ECDC4]">Descuento promo</span>
                              <span className="text-[11px] text-[#4ECDC4]">-{fmtCOP(descuento)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm font-bold text-white">Total a cobrar</span>
                              <span className="text-lg font-extrabold text-[#FFE66D]">{fmtCOP(cuenta.total - descuento)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/30">{pedidosRegulares.length} ticket{pedidosRegulares.length !== 1 ? 's' : ''} en cuenta</span>
                            <span className="text-lg font-extrabold text-[#FFE66D]">{fmtCOP(cuenta.total)}</span>
                          </div>
                        )}
                      </div>

                      {confirmPagar === cuenta.mesaId ? (
                        <div className="mt-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
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
                            <button
                              onClick={() => handlePagar(cuenta.mesaId)}
                              disabled={pagandoId === cuenta.mesaId}
                              className="flex-1 py-2.5 rounded-lg font-bold text-sm text-black bg-gradient-to-r from-[#D4AF37] to-[#F5D76E] hover:brightness-110 transition-all disabled:opacity-50"
                            >
                              {pagandoId === cuenta.mesaId ? (
                                <span className="flex items-center justify-center gap-2">
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                  Procesando...
                                </span>
                              ) : `Cobrar ${fmtCOP(descuento > 0 ? cuenta.total - descuento : cuenta.total)}`}
                            </button>
                            <button onClick={() => setConfirmPagar(null)}
                              className="px-4 py-2.5 rounded-lg text-sm font-medium border border-white/10 text-white/50 hover:bg-white/5 transition-colors">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmPagar(cuenta.mesaId)}
                          className="mt-3 w-full py-3 rounded-xl font-bold text-base text-black bg-gradient-to-r from-[#D4AF37] to-[#F5D76E] hover:brightness-110 transition-all flex items-center justify-center gap-2"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                          </svg>
                          Cobrar Mesa
                        </button>
                      )}
                    </div>
                  )
                  })()}
                </div>
              )
            })}
          </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-white/30 uppercase tracking-wider">Ventas del dia ({filteredVentas.length})</p>
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar mesa, mesero, cliente, billar..."
                className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/40 w-64"
              />
            </div>
          </div>

          {filteredVentas.length === 0 ? (
            <Card className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <p className="text-white/40 text-sm">{search ? 'No se encontraron ventas' : 'No hay ventas registradas hoy'}</p>
              {!search && <p className="text-white/20 text-xs mt-1">Las ventas apareceran cuando se cobren las mesas</p>}
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredVentas.map(venta => {
                if (venta.tipo === 'cuenta') {
                  const cuenta = venta.data as CuentaMesa
                  const expanded = expandedId === cuenta.id
                  const color = cuenta.meseroColor || '#CDA52F'
                  return (
                    <div key={cuenta.id}
                      className={`bg-card border rounded-xl overflow-hidden transition-all ${
                        expanded ? 'border-[#D4AF37]/30' : 'border-white/[0.07] hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : cuenta.id)}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: color + '33', color }}>{cuenta.meseroAvatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-white font-bold">{cuenta.mesaNombre}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#4ECDC4]/15 text-[#4ECDC4]">PAGADA</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-white/30">{cuenta.pedidos.length} tickets</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-white/40"><span className="text-white/20">Mesero:</span> {cuenta.meseroNombre}</span>
                            <span className="text-[10px] text-white/40"><span className="text-white/20">Cliente:</span> {cuenta.nombreCliente}</span>
                          </div>
                        </div>
                        {(() => {
                          const desc = cuenta.descuentoPromo || 0
                          const neto = desc > 0 ? cuenta.total - desc : cuenta.total
                          return (
                            <div className="text-right shrink-0">
                              <span className="text-base font-extrabold text-[#4ECDC4]">{fmtCOP(neto)}</span>
                              {desc > 0 && <p className="text-[9px] text-[#4ECDC4]/50">-{fmtCOP(desc)} promo</p>}
                              <p className="text-[9px] text-white/20">
                                {new Date(cuenta.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          )
                        })()}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                      {expanded && (() => {
                        const pedidosRegulares = cuenta.pedidos.filter(p => !p.esCortesia)
                        const pedidosCortesia = cuenta.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO')
                        const descuento = pedidosCortesia.reduce((s, p) => s + p.total, 0)
                        return (
                        <div className="px-4 pb-4 border-t border-white/[0.05]">
                          <div className="pt-3 space-y-3">
                            {pedidosRegulares.map(p => (
                              <div key={p.id} className="bg-white/[0.04] rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-[#CDA52F]">Ticket #{p.ticketDia}</span>
                                  <span className="text-xs text-white/30">{fmtCOP(p.total)}</span>
                                </div>
                                {p.lineas.map(l => (
                                  <div key={l.id} className="flex items-center gap-2 py-0.5">
                                    <span className="w-5 h-5 rounded-md bg-[#CDA52F]/15 text-[#CDA52F] text-[9px] font-bold flex items-center justify-center shrink-0">{l.cantidad}</span>
                                    <span className="text-xs text-white/50 flex-1">{l.nombre}</span>
                                    <span className="text-[10px] text-white/25">{fmtCOP(l.precioUnitario)} c/u</span>
                                    <span className="text-xs text-white/50 font-medium w-20 text-right">{fmtCOP(l.total)}</span>
                                  </div>
                                ))}
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
                                    </div>
                                    {p.lineas.map(l => (
                                      <div key={l.id} className="flex items-center gap-2 py-0.5">
                                        <span className="w-5 h-5 rounded-md bg-[#4ECDC4]/15 text-[#4ECDC4] text-[9px] font-bold flex items-center justify-center shrink-0">{l.cantidad}</span>
                                        <span className="text-xs text-[#4ECDC4]/50 flex-1">{l.nombre}</span>
                                        <span className="text-xs text-[#4ECDC4]/30 font-medium w-20 text-right line-through">{fmtCOP(l.total)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/[0.07]">
                            <div className="flex items-center justify-between">
                              <button onClick={() => handlePrint(cuenta)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-xs text-[#D4AF37] font-medium hover:bg-[#D4AF37]/20 transition-all">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                                </svg>
                                Imprimir Recibo
                              </button>
                              {descuento > 0 ? (
                                <div className="text-right">
                                  <span className="text-sm text-white/40 line-through">{fmtCOP(cuenta.total)}</span>
                                  <span className="text-[10px] text-[#4ECDC4]/70 ml-2">-{fmtCOP(descuento)} promo</span>
                                  <p className="text-lg font-extrabold text-white">{fmtCOP(cuenta.total - descuento)}</p>
                                </div>
                              ) : (
                                <span className="text-lg font-extrabold text-white">{fmtCOP(cuenta.total)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        )
                      })()}
                    </div>
                  )
                } else {
                  const partida = venta.data as PartidaBillar
                  const expanded = expandedId === partida.id
                  return (
                    <div key={`billar-${partida.id}`}
                      className={`bg-card border rounded-xl overflow-hidden transition-all ${
                        expanded ? 'border-[#4ECDC4]/30' : 'border-white/[0.07] hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : partida.id)}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#4ECDC4]/15">
                          <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#4ECDC4" strokeWidth="2"/><circle cx="12" cy="12" r="4.5" fill="#4ECDC4"/><text x="12" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#141414">8</text></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-white font-bold">{partida.mesaBillarNombre}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#4ECDC4]/15 text-[#4ECDC4]">BILLAR</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-white/30">{partida.horasCobradas}h</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-white/40"><span className="text-white/20">Cliente:</span> {partida.nombreCliente}</span>
                            <span className="text-[10px] text-white/40"><span className="text-white/20">Tarifa:</span> {fmtCOP(partida.precioPorHora)}/h</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-extrabold text-[#4ECDC4]">{fmtCOP(partida.total || 0)}</span>
                          <p className="text-[9px] text-white/20">
                            {new Date(partida.horaInicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                      {expanded && (
                        <div className="px-4 pb-4 border-t border-white/[0.05]">
                          <div className="pt-3">
                            <div className="bg-white/[0.04] rounded-lg p-3 space-y-2">
                              <div className="flex justify-between text-xs"><span className="text-white/40">Mesa</span><span className="text-white/70 font-medium">{partida.mesaBillarNombre} (#{partida.mesaBillarNumero})</span></div>
                              <div className="flex justify-between text-xs"><span className="text-white/40">Cliente</span><span className="text-white/70 font-medium">{partida.nombreCliente}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-white/40">Inicio</span><span className="text-white/70">{new Date(partida.horaInicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
                              {partida.horaFin && <div className="flex justify-between text-xs"><span className="text-white/40">Fin</span><span className="text-white/70">{new Date(partida.horaFin).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>}
                              <div className="flex justify-between text-xs"><span className="text-white/40">Precio/hora</span><span className="text-white/70">{fmtCOP(partida.precioPorHora)}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-white/40">Horas cobradas</span><span className="text-white/70 font-bold">{partida.horasCobradas}h</span></div>
                              <div className="h-px bg-white/[0.07]" />
                              <div className="flex justify-between text-sm font-bold"><span className="text-white/60">Total</span><span className="text-[#4ECDC4]">{fmtCOP(partida.total || 0)}</span></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }
              })}
            </div>
          )}

          {historial.length > 0 && (
            <>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3 mt-8">Historial de Jornadas ({historial.length})</p>
              <div className="space-y-2">
              {historial.map(j => {
                const expanded = historialExpandedId === j.id
                const fechaObj = new Date(j.fecha + 'T12:00:00')
                const fechaStr = fechaObj.toLocaleDateString('es-CO', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                return (
                  <div key={j.id} className={`bg-card border rounded-xl overflow-hidden transition-all ${
                    expanded ? 'border-[#D4AF37]/30' : 'border-white/[0.07] hover:border-white/15'
                  }`}>
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setHistorialExpandedId(expanded ? null : j.id)}>
                      <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{fechaStr}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-white/40">{j.cuentasCerradas} cuentas</span>
                          <span className="text-[10px] text-white/40">{j.ticketsTotales} tickets</span>
                          <span className="text-[10px] text-white/40">{j.mesasAtendidas} mesas</span>
                          {j.partidasBillar > 0 && <span className="text-[10px] text-[#4ECDC4]/60">{j.partidasBillar} billar</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-extrabold text-[#D4AF37]">{fmtCOP(j.totalGeneral)}</span>
                        <p className="text-[9px] text-white/20">
                          {new Date(j.cerradoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4 border-t border-white/[0.05]">
                        <div className="pt-3 grid grid-cols-2 gap-2">
                          <div className="bg-white/[0.04] rounded-lg p-3">
                            <span className="text-[10px] text-white/30 uppercase block mb-1">Ventas Mesas</span>
                            <span className="text-sm font-bold text-[#4ECDC4]">{fmtCOP(j.totalVentas)}</span>
                          </div>
                          <div className="bg-white/[0.04] rounded-lg p-3">
                            <span className="text-[10px] text-white/30 uppercase block mb-1">Ventas Billar</span>
                            <span className="text-sm font-bold text-[#4ECDC4]">{fmtCOP(j.totalBillar)}</span>
                          </div>
                          <div className="bg-white/[0.04] rounded-lg p-3">
                            <span className="text-[10px] text-white/30 uppercase block mb-1">Cuentas Cerradas</span>
                            <span className="text-sm font-bold text-white">{j.cuentasCerradas}</span>
                          </div>
                          <div className="bg-white/[0.04] rounded-lg p-3">
                            <span className="text-[10px] text-white/30 uppercase block mb-1">Tickets Totales</span>
                            <span className="text-sm font-bold text-white">{j.ticketsTotales}</span>
                          </div>
                          <div className="bg-white/[0.04] rounded-lg p-3">
                            <span className="text-[10px] text-white/30 uppercase block mb-1">Mesas Atendidas</span>
                            <span className="text-sm font-bold text-white">{j.mesasAtendidas}</span>
                          </div>
                          <div className="bg-white/[0.04] rounded-lg p-3">
                            <span className="text-[10px] text-white/30 uppercase block mb-1">Partidas Billar</span>
                            <span className="text-sm font-bold text-white">{j.partidasBillar}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/[0.07] flex items-center justify-between">
                          <span className="text-xs text-white/30">Total General</span>
                          <span className="text-lg font-extrabold text-[#D4AF37]">{fmtCOP(j.totalGeneral)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </>
          )}
        </>
      )}

      {showCerrarModal && resumen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCerrarModal(false)}>
          <div className="bg-[#1a1a1a] border border-[#FF5050]/20 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-[#FF5050]/15 flex items-center justify-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF5050" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Terminar Jornada</h3>
                <p className="text-xs text-white/40">{new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setShowCerrarModal(false)} className="ml-auto text-white/30 hover:text-white/60">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>

            <p className="text-xs text-white/40 mb-4">Resumen del dia antes de cerrar:</p>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between items-center bg-white/[0.04] rounded-lg px-4 py-3">
                <span className="text-xs text-white/50">Ventas Mesas</span>
                <span className="text-sm font-bold text-[#4ECDC4]">{fmtCOP(resumen.totalVentas)}</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.04] rounded-lg px-4 py-3">
                <span className="text-xs text-white/50">Ventas Billar</span>
                <span className="text-sm font-bold text-[#4ECDC4]">{fmtCOP(resumen.totalBillar)}</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.04] rounded-lg px-4 py-3">
                <span className="text-xs text-white/50">Cuentas Cerradas</span>
                <span className="text-sm font-bold text-white">{resumen.cuentasCerradas}</span>
              </div>
              {resumen.cuentasAbiertas > 0 && (
                <div className="flex justify-between items-center bg-[#FF5050]/10 border border-[#FF5050]/30 rounded-lg px-4 py-3">
                  <span className="text-xs text-[#FF5050] font-medium">Cuentas Abiertas (pendientes)</span>
                  <span className="text-sm font-bold text-[#FF5050]">{resumen.cuentasAbiertas}</span>
                </div>
              )}
              <div className="flex justify-between items-center bg-white/[0.04] rounded-lg px-4 py-3">
                <span className="text-xs text-white/50">Tickets Totales</span>
                <span className="text-sm font-bold text-white">{resumen.ticketsTotales}</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.04] rounded-lg px-4 py-3">
                <span className="text-xs text-white/50">Mesas Atendidas</span>
                <span className="text-sm font-bold text-white">{resumen.mesasAtendidas}</span>
              </div>
              {resumen.partidasBillar > 0 && (
                <div className="flex justify-between items-center bg-white/[0.04] rounded-lg px-4 py-3">
                  <span className="text-xs text-white/50">Partidas Billar</span>
                  <span className="text-sm font-bold text-white">{resumen.partidasBillar}</span>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-4 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-white">Total General</span>
                <span className="text-2xl font-extrabold text-[#D4AF37]">{fmtCOP(resumen.totalGeneral)}</span>
              </div>
            </div>

            {resumen.cuentasAbiertas > 0 && (
              <div className="bg-[#FF5050]/10 border border-[#FF5050]/30 rounded-lg p-3 mb-4">
                <p className="text-[11px] text-[#FF5050]/90">
                  <strong>No se puede cerrar.</strong> Hay {resumen.cuentasAbiertas} cuenta{resumen.cuentasAbiertas !== 1 ? 's' : ''} abierta{resumen.cuentasAbiertas !== 1 ? 's' : ''}. Debe cobrar todas las cuentas antes de terminar la jornada.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCerrarJornada}
                disabled={cerrandoJornada || resumen.cuentasAbiertas > 0}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-[#FF5050] hover:bg-[#FF5050]/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cerrandoJornada ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Cerrando...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Terminar Jornada
                  </>
                )}
              </button>
              <button onClick={() => setShowCerrarModal(false)}
                className="px-5 py-3 rounded-xl text-sm font-medium border border-white/10 text-white/50 hover:bg-white/5 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {jornadaCerradaExito && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setJornadaCerradaExito(null)}>
          <div className="bg-[#1a1a1a] border border-[#4ECDC4]/20 rounded-2xl p-6 max-w-md w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Jornada Cerrada</h3>
            <p className="text-xs text-white/40 mb-5">
              {new Date(jornadaCerradaExito.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>

            <div className="bg-white/[0.04] rounded-xl p-4 mb-5">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <span className="text-[9px] text-white/30 uppercase block">Cuentas</span>
                  <span className="text-sm font-bold text-white">{jornadaCerradaExito.cuentasCerradas}</span>
                </div>
                <div>
                  <span className="text-[9px] text-white/30 uppercase block">Tickets</span>
                  <span className="text-sm font-bold text-white">{jornadaCerradaExito.ticketsTotales}</span>
                </div>
                <div>
                  <span className="text-[9px] text-white/30 uppercase block">Mesas</span>
                  <span className="text-sm font-bold text-white">{jornadaCerradaExito.mesasAtendidas}</span>
                </div>
              </div>
              <div className="border-t border-white/[0.07] pt-3">
                <span className="text-[10px] text-white/30 uppercase block mb-1">Total del dia</span>
                <span className="text-2xl font-extrabold text-[#D4AF37]">{fmtCOP(jornadaCerradaExito.totalGeneral)}</span>
              </div>
            </div>

            <button
              onClick={() => setJornadaCerradaExito(null)}
              className="w-full py-3 rounded-xl font-bold text-sm text-black bg-gradient-to-r from-[#4ECDC4] to-[#45B7AA] hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Entendido
            </button>
          </div>
        </div>
      )}

      {receiptData && (
        <div ref={receiptRef} style={{ position: 'absolute', left: '-9999px' }}>
          <div className="center">
            <img src={logoUrl} className="logo" alt="Monastery Club" />
            <h2 className="bold">MONASTERY CLUB</h2>
            <p className="small">Baranoa, Atlantico</p>
            <p className="small">NIT: 000.000.000-0</p>
          </div>
          <div className="divider"></div>
          <div className="row"><span>Venta:</span><span style={{fontSize:'9px'}}>{receiptData.id.slice(0, 8)}</span></div>
          <div className="row"><span>Mesa:</span><span>{receiptData.mesaNombre}</span></div>
          <div className="row"><span>Cliente:</span><span>{receiptData.nombreCliente}</span></div>
          <div className="row"><span>Mesero:</span><span>{receiptData.meseroNombre}</span></div>
          <div className="row"><span>Fecha:</span><span>{new Date().toLocaleDateString('es-CO')}</span></div>
          <div className="row"><span>Hora:</span><span>{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div className="divider"></div>
          {receiptData.pedidos.filter(p => !p.esCortesia).map(p => (
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
          {receiptData.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO').length > 0 && (
            <>
              <div className="divider"></div>
              <p className="bold" style={{fontSize:'11px',marginTop:'4px'}}>CORTESIAS</p>
              {receiptData.pedidos.filter(p => p.esCortesia && p.estado !== 'CANCELADO').map(p => (
                <div key={p.id}>
                  {p.lineas.map(l => (
                    <div key={l.id} className="row">
                      <span>{l.cantidad}x {l.nombre}</span>
                      <span>$0</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
          <div className="divider"></div>
          {receiptData.descuentoPromo && receiptData.descuentoPromo > 0 && (
            <>
              <div className="row"><span>Subtotal</span><span>${Number(receiptData.total).toLocaleString('es-CO')}</span></div>
              <div className="row"><span>Cortesias</span><span>-${Number(receiptData.descuentoPromo).toLocaleString('es-CO')}</span></div>
            </>
          )}
          <div className="row total-row">
            <span>TOTAL</span>
            <span>${Number(receiptData.descuentoPromo && receiptData.descuentoPromo > 0 ? receiptData.total - receiptData.descuentoPromo : receiptData.total).toLocaleString('es-CO')}</span>
          </div>
          <div className="divider"></div>
          <div className="center">
            <p className="small" style={{marginTop:'8px'}}>Gracias por su visita</p>
            <p className="small">Monastery Club - Baranoa</p>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-white/[0.07] rounded-xl overflow-hidden flex">
      <div className="w-20 shrink-0 flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1 p-3 pl-3.5">
        <span className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">{label}</span>
        <p className="text-lg font-extrabold text-white">{value}</p>
      </div>
    </div>
  )
}
