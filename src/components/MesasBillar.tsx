import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from './ui/Card'
import { useBillar } from '../hooks/useBillar'
import { useJornadaDiaria } from '../hooks/useJornadaDiaria'
import type { MesaBillar } from '../types'

const fmtCOP = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO')

export default function MesasBillar() {
  const {
    mesas, partidasFinalizadas, totalBillarHoy,
    crearMesa, actualizarMesa, eliminarMesa, iniciarPartida, finalizarPartida, trasladarPartida
  } = useBillar()

  const { resumen, historial, cerrarJornada: cerrarJornadaHook, loading: cerrandoJornadaHook } = useJornadaDiaria()
  const jornadaActiva = resumen === null ? null : !resumen.jornadaCerrada

  const [showAddForm, setShowAddForm] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newPrecio, setNewPrecio] = useState('20000')
  const [showPlay, setShowPlay] = useState<MesaBillar | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [precioCustom, setPrecioCustom] = useState('')
  const [showFinish, setShowFinish] = useState<MesaBillar | null>(null)
  const [finishResult, setFinishResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState<MesaBillar | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPrecio, setEditPrecio] = useState('')
  const [showTransfer, setShowTransfer] = useState<MesaBillar | null>(null)
  const [showCerrarJornada, setShowCerrarJornada] = useState(false)
  const [jornadaCerradaResult, setJornadaCerradaResult] = useState<any>(null)
  const [showJornadaHistory, setShowJornadaHistory] = useState(false)
  const [showMesasActivasWarning, setShowMesasActivasWarning] = useState(false)

  const mesasActivas = useMemo(() => mesas.filter(m => m.estado === 'EN_JUEGO'), [mesas])

  // --- Drag & drop reorder ---
  const [mesaOrder, setMesaOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('billar_mesa_order')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const mesasOrdenadas = useMemo(() => {
    if (mesaOrder.length === 0) return mesas
    const orderMap = new Map(mesaOrder.map((id, i) => [id, i]))
    const sorted = [...mesas].sort((a, b) => {
      const oa = orderMap.get(a.id) ?? 9999
      const ob = orderMap.get(b.id) ?? 9999
      return oa - ob
    })
    return sorted
  }, [mesas, mesaOrder])

  const saveMesaOrder = useCallback((ids: string[]) => {
    setMesaOrder(ids)
    localStorage.setItem('billar_mesa_order', JSON.stringify(ids))
  }, [])

  const handleDragStart = (id: string) => setDragId(id)
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id) }
  const handleDragLeave = () => setDragOverId(null)
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const currentIds = mesasOrdenadas.map(m => m.id)
    const fromIdx = currentIds.indexOf(dragId)
    const toIdx = currentIds.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); setDragOverId(null); return }
    const newIds = [...currentIds]
    newIds.splice(fromIdx, 1)
    newIds.splice(toIdx, 0, dragId)
    saveMesaOrder(newIds)
    setDragId(null)
    setDragOverId(null)
  }
  const handleDragEnd = () => { setDragId(null); setDragOverId(null) }

  const gridRef = useRef<HTMLDivElement>(null)

  const handleCerrarJornada = async () => {
    try {
      const data = await cerrarJornadaHook()
      setJornadaCerradaResult(data)
      setShowCerrarJornada(false)
    } catch (e: any) { alert(e.message) }
  }

  const handleCrear = async () => {
    if (!newNombre.trim()) return
    setLoading(true)
    try {
      await crearMesa(newNombre.trim(), Number(newPrecio) || 20000)
      setNewNombre('')
      setNewPrecio('20000')
      setShowAddForm(false)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  const handleIniciar = async () => {
    if (!showPlay) return
    setLoading(true)
    try {
      const precio = precioCustom ? Number(precioCustom) : undefined
      await iniciarPartida(showPlay.id, clienteNombre || 'Cliente', precio)
      setShowPlay(null)
      setClienteNombre('')
      setPrecioCustom('')
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  const handleFinalizar = async () => {
    if (!showFinish) return
    setLoading(true)
    try {
      const result = await finalizarPartida(showFinish.id)
      setFinishResult(result)
      setShowFinish(null)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  const handleEliminar = async (id: string) => {
    if (loading) return
    setLoading(true)
    try {
      await eliminarMesa(id)
      setConfirmDelete(null)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  const openEdit = (mesa: MesaBillar) => {
    setShowEdit(mesa)
    setEditNombre(mesa.nombre)
    setEditPrecio(String(mesa.precioPorHora))
  }

  const handleTrasladar = async (mesaDestinoId: string) => {
    if (!showTransfer || loading) return
    setLoading(true)
    try {
      await trasladarPartida(showTransfer.id, mesaDestinoId)
      setShowTransfer(null)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  const mesasLibres = useMemo(() => mesas.filter(m => m.estado !== 'EN_JUEGO'), [mesas])

  const handleEditar = async () => {
    if (!showEdit || loading) return
    setLoading(true)
    try {
      await actualizarMesa(showEdit.id, {
        nombre: editNombre.trim() || showEdit.nombre,
        precioPorHora: Number(editPrecio) || showEdit.precioPorHora
      })
      setShowEdit(null)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-base sm:text-xl font-bold">Mesas de Billar</h2>
          <p className="text-[10px] text-white/30 mt-0.5">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {jornadaActiva === true && (
            <button onClick={() => {
              if (mesasActivas.length > 0) {
                setShowMesasActivasWarning(true)
                return
              }
              setShowCerrarJornada(true)
            }}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#FF6B35] text-white text-[10px] sm:text-sm font-semibold hover:bg-[#FF6B35]/80 transition-all flex items-center gap-1 sm:gap-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              Cerrar Jornada
            </button>
          )}
          <button
            onClick={() => window.open(`${window.location.origin}${window.location.pathname}?mode=billar`, '_blank')}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/10 text-white/60 text-[10px] sm:text-sm font-medium hover:bg-white/5 transition-all flex items-center gap-1 sm:gap-2"
            title="Abrir en nueva pestaña">
            <svg className="w-3 h-3 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span className="hidden sm:inline">Nueva pestaña</span>
          </button>
          <button onClick={() => setShowAddForm(true)}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#4ECDC4] text-black text-[10px] sm:text-sm font-semibold hover:bg-[#4ECDC4]/80 transition-all flex items-center gap-1 sm:gap-2">
            <svg className="w-3 h-3 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar Mesa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <KpiCard label="Mesas Totales" value={String(mesas.length)} color="#4ECDC4" icon={
          <svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="currentColor"/><text x="12" y="14.8" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#141414">8</text></svg>
        } />
        <KpiCard label="En Juego" value={String(mesasActivas.length)} color="#FF6B35" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        } />
        <KpiCard label="Partidas Hoy" value={String(jornadaActiva !== false ? partidasFinalizadas.length : 0)} color="#D4AF37" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
        } />
        <KpiCard label="Total Billar" value={fmtCOP(jornadaActiva !== false ? totalBillarHoy : 0)} color="#FFE66D" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z"/></svg>
        } />
      </div>

      {mesas.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#4ECDC4" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="#4ECDC4"/><text x="12" y="14.8" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0A0A0A">8</text></svg>
          </div>
          <p className="text-white/60 font-medium mb-1">No hay mesas de billar</p>
          <p className="text-white/30 text-sm">Agrega tu primera mesa para empezar</p>
        </Card>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {mesasOrdenadas.map(mesa => (
            <div
              key={mesa.id}
              draggable
              onDragStart={() => handleDragStart(mesa.id)}
              onDragOver={e => handleDragOver(e, mesa.id)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(mesa.id)}
              onDragEnd={handleDragEnd}
              className={`transition-all duration-150 ${dragId === mesa.id ? 'opacity-40 scale-95' : ''} ${dragOverId === mesa.id && dragId !== mesa.id ? 'ring-2 ring-[#4ECDC4]/50 rounded-xl' : ''}`}
              style={{ cursor: 'grab' }}
            >
              <MesaCard
                mesa={mesa}
                onPlay={() => { setShowPlay(mesa); setPrecioCustom(String(mesa.precioPorHora)) }}
                onFinish={() => setShowFinish(mesa)}
                onTransfer={() => setShowTransfer(mesa)}
                onEdit={() => openEdit(mesa)}
                onDelete={() => setConfirmDelete(mesa.id)}
              />
            </div>
          ))}
        </div>
      )}

      {jornadaActiva !== false && partidasFinalizadas.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-xs text-white/30 uppercase tracking-wider mb-3 hover:text-white/50 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            Historial de partidas ({partidasFinalizadas.length})
          </button>
          {showHistory && (
            <div className="space-y-2">
              {partidasFinalizadas.map(p => (
                <Card key={p.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#4ECDC4" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="#4ECDC4"/><text x="12" y="14.8" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#141414">8</text></svg>
                    </div>
                    <div>
                      <p className="text-sm text-white/80 font-medium">{p.mesaBillarNombre}</p>
                      <p className="text-[11px] text-white/30">{p.nombreCliente !== 'Cliente' ? p.nombreCliente + ' - ' : ''}{p.horasCobradas} min x {fmtCOP(Math.round(p.precioPorHora / 60))}/min</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#FFE66D]">{fmtCOP(p.total || 0)}</p>
                    <p className="text-[10px] text-white/20">{new Date(parseUTC(p.horaInicio)).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} - {p.horaFin ? new Date(parseUTC(p.horaFin)).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {jornadaActiva !== false && partidasFinalizadas.length > 0 && <BillarCharts partidas={partidasFinalizadas} total={totalBillarHoy} />}

      {jornadaActiva === false && (
        <Card className="text-center py-8 mb-6">
          <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#4ECDC4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <p className="text-white/60 font-medium">Jornada cerrada</p>
          <p className="text-white/30 text-sm mt-1">Las partidas fueron contabilizadas en el historial</p>
        </Card>
      )}

      {historial.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowJornadaHistory(!showJornadaHistory)}
            className="flex items-center gap-2 text-xs text-white/30 uppercase tracking-wider mb-3 hover:text-white/50 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showJornadaHistory ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            Historial de jornadas ({historial.length})
          </button>
          {showJornadaHistory && (
            <div className="space-y-2">
              {historial.map(j => (
                <Card key={j.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-white/80 font-medium">{new Date(j.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p className="text-[11px] text-white/30">{j.partidasBillar} partida{j.partidasBillar !== 1 ? 's' : ''} de billar</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#FFE66D]">{fmtCOP(j.totalBillar)}</p>
                    <p className="text-[10px] text-white/20">Total: {fmtCOP(j.totalGeneral)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddForm && (
        <Modal onClose={() => setShowAddForm(false)}>
          <h3 className="text-lg font-bold mb-4">Nueva Mesa de Billar</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">Nombre</label>
              <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Ej: Mesa 1, Mesa VIP..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ECDC4]/50" />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">Precio por hora (COP)</label>
              <input type="number" value={newPrecio} onChange={e => setNewPrecio(e.target.value)} placeholder="20000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ECDC4]/50" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowAddForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-all">Cancelar</button>
            <button onClick={handleCrear} disabled={loading || !newNombre.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#4ECDC4] text-black text-sm font-semibold hover:bg-[#4ECDC4]/80 transition-all disabled:opacity-40">
              {loading ? 'Creando...' : 'Crear Mesa'}
            </button>
          </div>
        </Modal>
      )}

      {showPlay && (
        <Modal onClose={() => { setShowPlay(null); setClienteNombre(''); setPrecioCustom('') }}>
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#4ECDC4" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="#4ECDC4"/><text x="12" y="14.8" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1A1A1A">8</text></svg>
            </div>
            <h3 className="text-lg font-bold">Iniciar Partida</h3>
            <p className="text-sm text-white/30">{showPlay.nombre}</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">Nombre del cliente</label>
              <input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} placeholder="Nombre (opcional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ECDC4]/50" />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">Precio por hora (COP)</label>
              <input type="number" value={precioCustom} onChange={e => setPrecioCustom(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ECDC4]/50" />
              <p className="text-[10px] text-white/20 mt-1">Si se pasa de la hora, se cobra la siguiente hora completa</p>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => { setShowPlay(null); setClienteNombre(''); setPrecioCustom('') }}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-all">Cancelar</button>
            <button onClick={handleIniciar} disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#4ECDC4] text-black text-sm font-semibold hover:bg-[#4ECDC4]/80 transition-all disabled:opacity-40">
              {loading ? 'Iniciando...' : 'Iniciar'}
            </button>
          </div>
        </Modal>
      )}

      {showFinish && (
        <Modal onClose={() => setShowFinish(null)}>
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-[#FF6B35]/10 flex items-center justify-center mx-auto mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF6B35"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            </div>
            <h3 className="text-lg font-bold">Finalizar Partida</h3>
            <p className="text-sm text-white/30">{showFinish.nombre} - {showFinish.partidaActiva?.nombreCliente}</p>
          </div>
          {showFinish.partidaActiva && (
            <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-2">
              <FinishTimer horaInicio={showFinish.partidaActiva.horaInicio} precioPorHora={showFinish.partidaActiva.precioPorHora} />
            </div>
          )}
          <p className="text-xs text-white/30 text-center mb-4">Se cobra por minutos jugados. Precio por minuto = precio por hora / 60.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowFinish(null)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-all">Cancelar</button>
            <button onClick={handleFinalizar} disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#FF6B35]/80 transition-all disabled:opacity-40">
              {loading ? 'Finalizando...' : 'Cobrar y Finalizar'}
            </button>
          </div>
        </Modal>
      )}

      {finishResult && (
        <Modal onClose={() => setFinishResult(null)}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#4ECDC4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <h3 className="text-lg font-bold mb-1">Partida Finalizada</h3>
            <p className="text-sm text-white/40 mb-4">{finishResult.mesaBillarNombre} - {finishResult.nombreCliente}</p>
            <div className="bg-white/5 rounded-xl p-4 space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Precio/min</span>
                <span className="text-white/70">{fmtCOP(Math.round(finishResult.precioPorHora / 60))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Minutos cobrados</span>
                <span className="text-white/70">{finishResult.horasCobradas} min</span>
              </div>
              <div className="h-px bg-white/[0.07] my-1" />
              <div className="flex justify-between text-base font-bold">
                <span className="text-white/60">Total</span>
                <span className="text-[#FFE66D]">{fmtCOP(finishResult.total)}</span>
              </div>
            </div>
            <button onClick={() => setFinishResult(null)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-sm text-white/70 hover:bg-white/15 transition-all">Cerrar</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal onClose={() => setShowEdit(null)}>
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#D4AF37"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </div>
            <h3 className="text-lg font-bold">Editar Mesa</h3>
            <p className="text-sm text-white/30">Mesa #{showEdit.numero}</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">Nombre</label>
              <input value={editNombre} onChange={e => setEditNombre(e.target.value)} placeholder="Nombre de la mesa"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/50" />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">Precio por hora (COP)</label>
              <input type="number" value={editPrecio} onChange={e => setEditPrecio(e.target.value)} placeholder="20000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/50" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowEdit(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-all">Cancelar</button>
            <button onClick={handleEditar} disabled={loading || !editNombre.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#D4AF37]/80 transition-all disabled:opacity-40">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[#FF5050]/10 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF5050"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </div>
            <h3 className="text-lg font-bold mb-1">Eliminar Mesa</h3>
            <p className="text-sm text-white/40 mb-4">Esta accion no se puede deshacer</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-all">Cancelar</button>
              <button onClick={() => handleEliminar(confirmDelete)} disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#FF5050] text-white text-sm font-semibold hover:bg-[#FF5050]/80 transition-all disabled:opacity-40">
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showTransfer && (
        <Modal onClose={() => setShowTransfer(null)}>
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><path d="M21 3l-7 7"/><polyline points="9 21 3 21 3 15"/><path d="M3 21l7-7"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold">Trasladar Partida</h3>
            <p className="text-sm text-white/30">{showTransfer.nombre} — {showTransfer.partidaActiva?.nombreCliente}</p>
          </div>

          {mesasLibres.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-white/40">No hay mesas libres disponibles</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-white/40 mb-3">Selecciona la mesa destino:</p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {mesasLibres.filter(m => m.id !== showTransfer.id).map(mesa => (
                  <button
                    key={mesa.id}
                    onClick={() => handleTrasladar(mesa.id)}
                    disabled={loading}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-[#4ECDC4]/10 hover:border-[#4ECDC4]/30 transition-all text-left disabled:opacity-40"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#4ECDC4" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="#4ECDC4"/><text x="12" y="14.8" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#141414">8</text></svg>
                    </div>
                    <div>
                      <p className="text-sm text-white/80 font-medium">{mesa.nombre}</p>
                      <p className="text-[10px] text-white/30">{fmtCOP(mesa.precioPorHora)}/hora</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-4">
            <button onClick={() => setShowTransfer(null)}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-all">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {showCerrarJornada && (
        <Modal onClose={() => setShowCerrarJornada(false)}>
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-[#FF6B35]/10 flex items-center justify-center mx-auto mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </div>
            <h3 className="text-lg font-bold">Cerrar Jornada</h3>
            <p className="text-sm text-white/30 mt-1">Se contabilizaran todas las partidas del dia</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/40">Partidas</span><span className="font-bold">{partidasFinalizadas.length}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Total Billar</span><span className="font-bold text-[#FFE66D]">{fmtCOP(totalBillarHoy)}</span></div>
          </div>
          <p className="text-[11px] text-white/25 text-center mb-4">La jornada cubre desde la apertura (ej: 12pm) hasta este momento, sin importar que haya pasado medianoche.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowCerrarJornada(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-all">Cancelar</button>
            <button onClick={handleCerrarJornada} disabled={cerrandoJornadaHook}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#FF6B35]/80 transition-all disabled:opacity-40">
              {cerrandoJornadaHook ? 'Cerrando...' : 'Cerrar Jornada'}
            </button>
          </div>
        </Modal>
      )}

      {jornadaCerradaResult && (
        <Modal onClose={() => setJornadaCerradaResult(null)}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#4ECDC4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <h3 className="text-lg font-bold mb-1">Jornada Cerrada</h3>
            <p className="text-sm text-white/30 mb-4">{jornadaCerradaResult.fecha}</p>
            <div className="bg-white/5 rounded-xl p-4 space-y-2 mb-5 text-sm">
              {jornadaCerradaResult.totalVentas > 0 && <div className="flex justify-between"><span className="text-white/40">Ventas</span><span className="text-white/70">{fmtCOP(jornadaCerradaResult.totalVentas)}</span></div>}
              <div className="flex justify-between"><span className="text-white/40">Billar</span><span className="text-white/70">{fmtCOP(jornadaCerradaResult.totalBillar)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Partidas</span><span className="text-white/70">{jornadaCerradaResult.partidasBillar}</span></div>
              <div className="h-px bg-white/[0.07]" />
              <div className="flex justify-between font-bold"><span className="text-white/60">Total General</span><span className="text-[#FFE66D]">{fmtCOP(jornadaCerradaResult.totalGeneral)}</span></div>
            </div>
            <button onClick={() => setJornadaCerradaResult(null)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-sm text-white/70 hover:bg-white/15 transition-all">Cerrar</button>
          </div>
        </Modal>
      )}

      {showMesasActivasWarning && (
        <Modal onClose={() => setShowMesasActivasWarning(false)}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[#FF5050]/10 flex items-center justify-center mx-auto mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF5050" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            </div>
            <h3 className="text-lg font-bold mb-2">No puedes cerrar la jornada</h3>
            <p className="text-sm text-white/40 mb-4">
              Hay <span className="text-[#FF6B35] font-bold">{mesasActivas.length}</span> mesa{mesasActivas.length !== 1 ? 's' : ''} en juego. Finaliza todas las partidas antes de cerrar.
            </p>
            <div className="bg-white/5 rounded-xl p-3 mb-5 space-y-1.5">
              {mesasActivas.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/60">{m.nombre}</span>
                  <span className="text-[#FF6B35] text-xs font-medium">EN JUEGO</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowMesasActivasWarning(false)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-sm text-white/70 hover:bg-white/15 transition-all">Entendido</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function MesaCard({ mesa, onPlay, onFinish, onTransfer, onEdit, onDelete }: { mesa: MesaBillar; onPlay: () => void; onFinish: () => void; onTransfer: () => void; onEdit: () => void; onDelete: () => void }) {
  const enJuego = mesa.estado === 'EN_JUEGO'

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${enJuego ? 'border-[#FF6B35]/40 shadow-[0_0_20px_rgba(255,107,53,0.08)]' : 'border-white/[0.07]'}`}>
      <div className={`h-1.5 ${enJuego ? 'bg-[#FF6B35]' : 'bg-[#4ECDC4]/30'}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${enJuego ? 'bg-[#FF6B35]/15' : 'bg-[#4ECDC4]/10'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke={enJuego ? '#FF6B35' : '#4ECDC4'} strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill={enJuego ? '#FF6B35' : '#4ECDC4'}/><text x="12" y="14.8" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#141414">8</text></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/90">{mesa.nombre}</p>
              <p className="text-[11px] text-white/30">{fmtCOP(mesa.precioPorHora)}/hora</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${enJuego ? 'bg-[#FF6B35]/15 text-[#FF6B35]' : 'bg-[#4ECDC4]/10 text-[#4ECDC4]'}`}>
            {enJuego ? 'En Juego' : 'Libre'}
          </span>
        </div>

        {enJuego && mesa.partidaActiva && (
          <div className="bg-white/[0.03] rounded-lg p-3 mb-3 border border-white/[0.05]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Cliente</span>
              <span className="text-xs text-white/70 font-medium">{mesa.partidaActiva.nombreCliente === 'Cliente' ? '—' : mesa.partidaActiva.nombreCliente}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Inicio</span>
              <span className="text-xs text-white/70">{new Date(parseUTC(mesa.partidaActiva.horaInicio)).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <ActiveTimer horaInicio={mesa.partidaActiva.horaInicio} precioPorHora={mesa.partidaActiva.precioPorHora} />
          </div>
        )}

        <div className="flex gap-2">
          {enJuego ? (
            <>
            <button onClick={onFinish}
              className="flex-1 px-3 py-2 rounded-lg bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#FF6B35]/80 transition-all flex items-center justify-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
              Cobrar
            </button>
            <button onClick={onTransfer}
              className="px-3 py-2 rounded-lg border border-[#4ECDC4]/20 bg-[#4ECDC4]/5 text-[#4ECDC4] text-xs hover:bg-[#4ECDC4]/10 transition-all flex items-center justify-center gap-1.5"
              title="Trasladar a otra mesa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><path d="M21 3l-7 7"/><polyline points="9 21 3 21 3 15"/><path d="M3 21l7-7"/>
              </svg>
            </button>
            </>
          ) : (
            <>
              <button onClick={onPlay}
                className="flex-1 px-3 py-2 rounded-lg bg-[#4ECDC4] text-black text-xs font-semibold hover:bg-[#4ECDC4]/80 transition-all flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Iniciar
              </button>
              <button onClick={onEdit}
                className="px-3 py-2 rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/5 text-[#D4AF37] text-xs hover:bg-[#D4AF37]/10 transition-all"
                title="Editar mesa">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              </button>
              <button onClick={onDelete}
                className="px-3 py-2 rounded-lg border border-[#FF5050]/20 bg-[#FF5050]/5 text-[#FF5050] text-xs hover:bg-[#FF5050]/10 transition-all"
                title="Eliminar mesa">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function parseUTC(dt: string) {
  // Truncar nanosegundos a milisegundos (JS solo soporta 3 decimales)
  const clean = dt.replace(/(\.\d{3})\d+/, '$1')
  return new Date(clean.endsWith('Z') ? clean : clean + 'Z').getTime()
}

function ActiveTimer({ horaInicio, precioPorHora }: { horaInicio: string; precioPorHora: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  const start = parseUTC(horaInicio)
  const elapsed = Math.max(0, now - start)
  const totalSec = Math.floor(elapsed / 1000)
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  const minutosCobrar = Math.max(1, Math.ceil(totalSec / 60))
  const precioPorMinuto = precioPorHora / 60
  const totalEstimado = Math.round(minutosCobrar * precioPorMinuto)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/40">Tiempo</span>
        <span className="text-sm font-mono font-bold text-[#FF6B35]">
          {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">Estimado ({minutosCobrar} min)</span>
        <span className="text-sm font-bold text-[#FFE66D]">{fmtCOP(totalEstimado)}</span>
      </div>
    </div>
  )
}

function FinishTimer({ horaInicio, precioPorHora }: { horaInicio: string; precioPorHora: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  const start = parseUTC(horaInicio)
  const elapsed = Math.max(0, now - start)
  const totalSec = Math.floor(elapsed / 1000)
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const minutosCobrar = Math.max(1, Math.ceil(totalSec / 60))
  const precioPorMinuto = precioPorHora / 60
  const totalEstimado = Math.round(minutosCobrar * precioPorMinuto)

  return (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-white/40">Tiempo jugado</span>
        <span className="text-white/70 font-mono">{hours}h {mins}m</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-white/40">Minutos a cobrar</span>
        <span className="text-white/70 font-bold">{minutosCobrar} min</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-white/40">Precio/min</span>
        <span className="text-white/70">{fmtCOP(Math.round(precioPorMinuto))}</span>
      </div>
      <div className="h-px bg-white/[0.07]" />
      <div className="flex justify-between text-base font-bold">
        <span className="text-white/60">Total estimado</span>
        <span className="text-[#FFE66D]">{fmtCOP(totalEstimado)}</span>
      </div>
    </>
  )
}

function KpiCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-white/[0.07] rounded-xl overflow-hidden flex">
      <div className="w-12 sm:w-20 shrink-0 flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
        <div className="scale-75 sm:scale-100" style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0 p-2 sm:p-3 sm:pl-3.5">
        <span className="text-[9px] sm:text-[10px] text-white/30 uppercase tracking-wider block mb-0.5 sm:mb-1 truncate">{label}</span>
        <p className="text-sm sm:text-lg font-extrabold text-white truncate">{value}</p>
      </div>
    </div>
  )
}

const CHART_COLORS = ['#CDA52F', '#4ECDC4', '#FFE66D', '#FF6B35', '#C3B1E1', '#FF8FA3', '#A8E6CF', '#FFB347']

function BillarCharts({ partidas, total }: { partidas: import('../types').PartidaBillar[]; total: number }) {
  const ventaPorMesa = useMemo(() => {
    const map = new Map<string, { nombre: string; total: number; partidas: number; horas: number }>()
    for (const p of partidas) {
      const key = p.mesaBillarNombre
      const prev = map.get(key) || { nombre: key, total: 0, partidas: 0, horas: 0 }
      prev.total += p.total || 0
      prev.partidas += 1
      prev.horas += p.horasCobradas || 0
      map.set(key, prev)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [partidas])

  const pieData = ventaPorMesa.filter(v => v.total > 0)

  return (
    <div className="mt-4 space-y-4">
      <Card className="border-[#FFE66D]/20 bg-[#FFE66D]/[0.03]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-bold text-white/60">Total Billar Hoy</span>
            <span className="text-[10px] text-white/25 ml-2">({partidas.length} partida{partidas.length !== 1 ? 's' : ''})</span>
          </div>
          <span className="text-xl font-extrabold text-[#FFE66D]">{fmtCOP(total)}</span>
        </div>
      </Card>

      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Distribucion por Mesa</p>
            <div className="flex items-center gap-4">
              <div className="w-[120px] h-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="total" nameKey="nombre" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} strokeWidth={0} isAnimationActive={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {pieData.map((v, i) => (
                  <div key={v.nombre} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs text-white/60">{v.nombre}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white/80">{fmtCOP(v.total)}</span>
                      <span className="text-[9px] text-white/25 ml-1">{v.partidas}p</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Venta por Mesa</p>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventaPorMesa} layout="vertical" margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                  <XAxis type="number" tickFormatter={v => fmtCOP(v)} tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nombre" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
                    formatter={(value: any) => [fmtCOP(Number(value)), 'Total']}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
                    {ventaPorMesa.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-[#1A1A1A] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
