import { useState, useEffect, useMemo } from 'react'
import { Card } from './ui/Card'
import { useBillar } from '../hooks/useBillar'
import type { MesaBillar } from '../types'

const fmtCOP = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO')

export default function MesasBillar() {
  const {
    mesas, partidasFinalizadas, totalBillarHoy,
    crearMesa, actualizarMesa, eliminarMesa, iniciarPartida, finalizarPartida, trasladarPartida
  } = useBillar()

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

  const mesasActivas = useMemo(() => mesas.filter(m => m.estado === 'EN_JUEGO'), [mesas])

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Mesas de Billar</h2>
          <p className="text-xs text-white/30 mt-0.5">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => setShowAddForm(true)}
          className="px-4 py-2 rounded-xl bg-[#4ECDC4] text-black text-sm font-semibold hover:bg-[#4ECDC4]/80 transition-all flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar Mesa
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Mesas Totales" value={String(mesas.length)} color="#4ECDC4" icon={
          <svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="currentColor"/><text x="12" y="14.8" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#141414">8</text></svg>
        } />
        <KpiCard label="En Juego" value={String(mesasActivas.length)} color="#FF6B35" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        } />
        <KpiCard label="Partidas Hoy" value={String(partidasFinalizadas.length)} color="#D4AF37" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
        } />
        <KpiCard label="Total Billar" value={fmtCOP(totalBillarHoy)} color="#FFE66D" icon={
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {mesas.map(mesa => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              onPlay={() => { setShowPlay(mesa); setPrecioCustom(String(mesa.precioPorHora)) }}
              onFinish={() => setShowFinish(mesa)}
              onTransfer={() => setShowTransfer(mesa)}
              onEdit={() => openEdit(mesa)}
              onDelete={() => setConfirmDelete(mesa.id)}
            />
          ))}
        </div>
      )}

      {partidasFinalizadas.length > 0 && (
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
                      <p className="text-[11px] text-white/30">{p.nombreCliente} - {p.horasCobradas}h x {fmtCOP(p.precioPorHora)}/h</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#FFE66D]">{fmtCOP(p.total || 0)}</p>
                    <p className="text-[10px] text-white/20">{new Date(p.horaInicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} - {p.horaFin ? new Date(p.horaFin).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
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
          <p className="text-xs text-white/30 text-center mb-4">Se cobrara por horas completas. Si se paso de la hora, se cobra la siguiente.</p>
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
                <span className="text-white/40">Precio/hora</span>
                <span className="text-white/70">{fmtCOP(finishResult.precioPorHora)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Horas cobradas</span>
                <span className="text-white/70">{finishResult.horasCobradas}h</span>
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
              <span className="text-xs text-white/70 font-medium">{mesa.partidaActiva.nombreCliente}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Inicio</span>
              <span className="text-xs text-white/70">{new Date(mesa.partidaActiva.horaInicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
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

function ActiveTimer({ horaInicio, precioPorHora }: { horaInicio: string; precioPorHora: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  const start = new Date(horaInicio).getTime()
  const elapsed = Math.max(0, now - start)
  const totalSec = Math.floor(elapsed / 1000)
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  const horasCobrar = Math.max(1, Math.ceil((totalSec) / 3600))
  const totalEstimado = horasCobrar * precioPorHora

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/40">Tiempo</span>
        <span className="text-sm font-mono font-bold text-[#FF6B35]">
          {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">Estimado ({horasCobrar}h)</span>
        <span className="text-sm font-bold text-[#FFE66D]">{fmtCOP(totalEstimado)}</span>
      </div>
    </div>
  )
}

function FinishTimer({ horaInicio, precioPorHora }: { horaInicio: string; precioPorHora: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  const start = new Date(horaInicio).getTime()
  const elapsed = Math.max(0, now - start)
  const totalSec = Math.floor(elapsed / 1000)
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const horasCobrar = Math.max(1, Math.ceil(totalSec / 3600))
  const totalEstimado = horasCobrar * precioPorHora

  return (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-white/40">Tiempo jugado</span>
        <span className="text-white/70 font-mono">{hours}h {mins}m</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-white/40">Horas a cobrar</span>
        <span className="text-white/70 font-bold">{horasCobrar}h</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-white/40">Precio/hora</span>
        <span className="text-white/70">{fmtCOP(precioPorHora)}</span>
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
