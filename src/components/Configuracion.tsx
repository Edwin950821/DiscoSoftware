import { useState, useMemo } from 'react'
import type { Trabajador, Promocion } from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Input } from './ui/Input'
import { db, hashPassword } from '../lib/db'
import { usePromociones } from '../hooks/usePromociones'
import { useProductos } from '../hooks/useProductos'

const COLORES_TRABAJADOR = ['#CDA52F', '#4ECDC4', '#FFE66D', '#A8E6CF', '#C3B1E1', '#FF8FA3', '#98D8C8', '#FFB347']

interface Props {
  accessToken: string
  trabajadores: Trabajador[]
  agregarTrabajador: (t: Omit<Trabajador, 'id'> & { username?: string; password?: string }) => Promise<void>
  actualizarTrabajador: (id: string, data: Partial<Trabajador>) => Promise<void>
  eliminarTrabajador: (id: string) => Promise<void>
  premiumEnabled: boolean
  onTogglePremium: (pin: string) => Promise<boolean>
}

export default function Configuracion({ accessToken, trabajadores, agregarTrabajador, actualizarTrabajador, eliminarTrabajador, premiumEnabled, onTogglePremium }: Props) {
  const [tab, setTab] = useState<'trabajadores' | 'promociones' | 'seguridad' | 'modulos'>('trabajadores')
  const { promociones, crear: crearPromo, actualizar: actualizarPromo, eliminar: eliminarPromo, toggleActiva } = usePromociones()
  const { productos } = useProductos()
  const productosActivos = useMemo(() => productos.filter(p => p.activo), [productos])

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [crearError, setCrearError] = useState('')
  const [creando, setCreando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showCreatedModal, setShowCreatedModal] = useState<{ nombre: string } | null>(null)
  const [showDeletedModal, setShowDeletedModal] = useState<string | null>(null)

  const handleAgregar = async () => {
    const nombre = nuevoNombre.trim()
    setCrearError('')

    if (!nombre) { setCrearError('El nombre es requerido'); return }

    setCreando(true)
    try {
      const color = COLORES_TRABAJADOR[trabajadores.length % COLORES_TRABAJADOR.length]
      const avatar = nombre.slice(0, 2).toUpperCase()
      await agregarTrabajador({ nombre, color, avatar, activo: true })
      setShowCreatedModal({ nombre })
      setNuevoNombre('')
    } catch (e: any) {
      setCrearError(e.message || 'Error al crear trabajador')
    } finally {
      setCreando(false)
    }
  }

  const handleEliminar = async (id: string) => {
    const t = trabajadores.find(t => t.id === id)
    await eliminarTrabajador(id)
    setConfirmDelete(null)
    setShowDeletedModal(t?.nombre || 'Trabajador')
  }

  const startEdit = (t: Trabajador) => {
    setEditId(t.id)
    setEditNombre(t.nombre)
    setConfirmDelete(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditNombre('')
  }

  const saveEdit = async () => {
    if (!editId || !editNombre.trim()) return
    const avatar = editNombre.trim().slice(0, 2).toUpperCase()
    await actualizarTrabajador(editId, { nombre: editNombre.trim(), avatar })
    cancelEdit()
  }

  const handleChangePassword = async () => {
    setPwMsg(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMsg({ text: 'Completa todos los campos', ok: false }); return
    }
    if (newPassword.length < 6) {
      setPwMsg({ text: 'La nueva contrasena debe tener al menos 6 caracteres', ok: false }); return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'Las contrasenas no coinciden', ok: false }); return
    }
    setPwLoading(true)
    try {
      // Get current user from session
      const raw = sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
      if (!raw) { setPwMsg({ text: 'Sesion no encontrada', ok: false }); return }
      const session = JSON.parse(raw)
      const users = await db.users.toArray()
      const user = users.find(u => u.nombre === session.nombre)
      if (!user) { setPwMsg({ text: 'Usuario no encontrado', ok: false }); return }

      // Verify current password
      const currentHash = await hashPassword(currentPassword)
      if (currentHash !== user.passwordHash) {
        setPwMsg({ text: 'Contrasena actual incorrecta', ok: false }); return
      }

      // Update password
      const newHash = await hashPassword(newPassword)
      await db.users.update(user.id!, { passwordHash: newHash })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setPwMsg(null)
      setShowSuccessModal(true)
    } catch {
      setPwMsg({ text: 'Error al cambiar contrasena', ok: false })
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div>
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowSuccessModal(false)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#4ECDC4]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-white font-medium mb-1">Contrasena actualizada</p>
            <p className="text-xs text-white/40 mb-4">Tu contrasena se cambio exitosamente</p>
            <Btn onClick={() => setShowSuccessModal(false)} className="w-full">Aceptar</Btn>
          </div>
        </div>
      )}

      {showDeletedModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowDeletedModal(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#FF5050]/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#FF5050]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-1">Trabajador eliminado</p>
            <p className="text-sm text-white/50 mb-5">{showDeletedModal} fue eliminado exitosamente</p>
            <Btn onClick={() => setShowDeletedModal(null)} className="w-full">Aceptar</Btn>
          </div>
        </div>
      )}

      {showCreatedModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowCreatedModal(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#4ECDC4]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-white font-semibold text-lg mb-1">Trabajador creado</p>
            <p className="text-sm text-white/50 mb-4">{showCreatedModal.nombre} agregado exitosamente</p>
            <Btn onClick={() => setShowCreatedModal(null)} className="w-full">Aceptar</Btn>
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold mb-6">Configuracion</h2>

      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('trabajadores')}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'trabajadores' ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'}`}>
          Trabajadores
        </button>
        {premiumEnabled && <button onClick={() => setTab('promociones')}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'promociones' ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'}`}>
          Promociones
          {promociones.filter(p => p.activa).length > 0 && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#4ECDC4]/20 text-[#4ECDC4] font-bold">
              {promociones.filter(p => p.activa).length}
            </span>
          )}
        </button>}
        <button onClick={() => setTab('seguridad')}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'seguridad' ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'}`}>
          Seguridad
        </button>
        <button onClick={() => setTab('modulos')}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'modulos' ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'}`}>
          Modulos
        </button>
      </div>

      {tab === 'trabajadores' && (
        <div className="max-w-lg">
          <Card className="mb-4">
            <p className="text-xs text-white/40 font-medium mb-3 uppercase tracking-wider">Agregar Trabajador</p>
            <div className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                    placeholder="Nombre del trabajador" label="Nombre" />
                </div>
                {nuevoNombre.trim() && (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mb-0.5"
                    style={{
                      backgroundColor: COLORES_TRABAJADOR[trabajadores.length % COLORES_TRABAJADOR.length] + '33',
                      color: COLORES_TRABAJADOR[trabajadores.length % COLORES_TRABAJADOR.length],
                    }}>
                    {nuevoNombre.trim().slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              {crearError && (
                <div className="text-sm text-center py-2 px-3 rounded-lg border bg-red-500/10 text-red-400 border-red-500/20">
                  {crearError}
                </div>
              )}
              <Btn onClick={handleAgregar} disabled={creando || !nuevoNombre.trim()}>
                {creando ? 'Creando...' : 'Agregar Trabajador'}
              </Btn>
            </div>
          </Card>

          <div className="space-y-2">
            {trabajadores.length === 0 ? (
              <Card className="text-center py-8 text-white/30 text-sm">No hay trabajadores registrados</Card>
            ) : (
              trabajadores.map(t => (
                <Card key={t.id}>
                  {editId === t.id ? (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: t.color + '33', color: t.color }}>
                        {editNombre.trim() ? editNombre.trim().slice(0, 2).toUpperCase() : t.avatar}
                      </div>
                      <input
                        type="text"
                        value={editNombre}
                        onChange={e => setEditNombre(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && saveEdit()}
                        className="bg-white/5 border border-[#CDA52F]/30 rounded-lg px-3 py-1.5 text-sm text-white flex-1 focus:outline-none focus:border-[#CDA52F]/60"
                        autoFocus
                      />
                      <button onClick={saveEdit} title="Guardar"
                        className="p-1.5 rounded-lg border border-white/10 text-[#4ECDC4] hover:bg-white/5 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button onClick={cancelEdit} title="Cancelar"
                        className="p-1.5 rounded-lg border border-white/10 text-white/50 hover:bg-white/5 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${!t.activo ? 'opacity-40' : ''}`}
                        style={{ backgroundColor: t.color + '33', color: t.color }}>{t.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${t.activo ? 'text-white/80' : 'text-white/30 line-through'}`}>{t.nombre}</p>
                          {!t.activo && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF5050]/15 text-[#FF5050] font-medium">Bloqueado</span>
                          )}
                        </div>
                      </div>
                      {confirmDelete === t.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#FF5050]">Eliminar?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(t.id)}>Si</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Btn>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => actualizarTrabajador(t.id, { activo: !t.activo })}
                            title={t.activo ? 'Bloquear' : 'Activar'}
                            className={`p-1 transition-colors ${t.activo ? 'text-white/20 hover:text-[#FF5050]' : 'text-[#FF5050]/50 hover:text-[#4ECDC4]'}`}>
                            {t.activo ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                              </svg>
                            )}
                          </button>
                          <button onClick={() => startEdit(t)} title="Editar"
                            className="text-white/20 hover:text-[#CDA52F] transition-colors p-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button onClick={() => setConfirmDelete(t.id)} title="Eliminar"
                            className="text-white/20 hover:text-[#FF5050] transition-colors p-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {premiumEnabled && tab === 'promociones' && (
        <PromocionesTab
          promociones={promociones}
          productos={productosActivos}
          onCrear={crearPromo}
          onToggle={toggleActiva}
          onEliminar={eliminarPromo}
        />
      )}

      {tab === 'seguridad' && (
        <Card className="max-w-md">
          <h3 className="text-sm font-medium text-white/45 mb-4">Cambiar contrasena</h3>
          <div className="space-y-3">
            <Input label="Contrasena actual" type="password" value={currentPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)} placeholder="••••••" />
            <Input label="Nueva contrasena" type="password" value={newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" />
            <Input label="Confirmar nueva contrasena" type="password" value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)} placeholder="Repetir nueva contrasena" />

            {pwMsg && !pwMsg.ok && (
              <div className="text-sm text-center py-2 px-3 rounded-lg border bg-red-500/10 text-red-400 border-red-500/20">
                {pwMsg.text}
              </div>
            )}

            <Btn onClick={handleChangePassword} disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}>
              {pwLoading ? 'Guardando...' : 'Cambiar contrasena'}
            </Btn>
          </div>
        </Card>
      )}

      {tab === 'modulos' && <ModulosPremium enabled={premiumEnabled} onToggle={onTogglePremium} />}
    </div>
  )
}

const fmtCOP = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO')

function PromocionesTab({ promociones, productos, onCrear, onToggle, onEliminar }: {
  promociones: Promocion[]
  productos: { id: string; nombre: string; precio: number }[]
  onCrear: (req: any) => Promise<any>
  onToggle: (id: string, activa: boolean) => Promise<any>
  onEliminar: (id: string) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [compraIds, setCompraIds] = useState<string[]>([])
  const [compraCantidad, setCompraCantidad] = useState(1)
  const [regaloId, setRegaloId] = useState('')
  const [regaloCantidad, setRegaloCantidad] = useState(1)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showCreatedModal, setShowCreatedModal] = useState<string | null>(null)
  const [showDeletedModal, setShowDeletedModal] = useState<string | null>(null)

  const toggleCompraId = (id: string) => {
    setCompraIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleCrear = async () => {
    setError('')
    if (!nombre.trim()) { setError('Nombre requerido'); return }
    if (compraIds.length === 0) { setError('Selecciona al menos un producto de compra'); return }
    if (!regaloId) { setError('Selecciona el producto de regalo'); return }
    if (compraCantidad < 1 || regaloCantidad < 1) { setError('Las cantidades deben ser al menos 1'); return }

    setCreando(true)
    try {
      const promoNombre = nombre.trim()
      await onCrear({
        nombre: promoNombre,
        compraProductoIds: compraIds,
        compraCantidad,
        regaloProductoId: regaloId,
        regaloCantidad,
      })
      setShowCreatedModal(promoNombre)
      setNombre(''); setCompraIds([]); setCompraCantidad(1); setRegaloId(''); setRegaloCantidad(1); setShowForm(false)
    } catch (e: any) {
      setError(e.message || 'Error al crear')
    } finally {
      setCreando(false)
    }
  }

  const regaloProducto = productos.find(p => p.id === regaloId)

  return (
    <div className="max-w-2xl">
      {showCreatedModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowCreatedModal(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#4ECDC4]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-white font-semibold text-lg mb-1">Promocion creada</p>
            <p className="text-sm text-white/50 mb-5">{showCreatedModal}</p>
            <Btn onClick={() => setShowCreatedModal(null)} className="w-full">Aceptar</Btn>
          </div>
        </div>
      )}

      {showDeletedModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowDeletedModal(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#FF5050]/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#FF5050]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-1">Promocion eliminada</p>
            <p className="text-sm text-white/50 mb-5">{showDeletedModal}</p>
            <Btn onClick={() => setShowDeletedModal(null)} className="w-full">Aceptar</Btn>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/40 uppercase tracking-wider">
          Promociones ({promociones.length})
        </p>
        <Btn size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nueva Promo'}
        </Btn>
      </div>

      {showForm && (
        <Card className="mb-4">
          <p className="text-xs text-white/40 font-medium mb-3 uppercase tracking-wider">Nueva Promocion</p>
          <div className="space-y-3">
            <Input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: 2x1 Cervezas, 3 Coronas = 1 Electrolit" label="Nombre de la promo" />

            <div>
              <label className="text-xs text-white/45 block mb-1.5">Productos de compra (toca para seleccionar)</label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {productos.map(p => {
                  const selected = compraIds.includes(p.id)
                  return (
                    <button key={p.id} onClick={() => toggleCompraId(p.id)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        selected
                          ? 'border-[#CDA52F]/50 bg-[#CDA52F]/15 text-[#CDA52F]'
                          : 'border-white/10 bg-white/[0.03] text-white/40 hover:border-white/20'
                      }`}>
                      {p.nombre}
                    </button>
                  )
                })}
              </div>
              {compraIds.length > 0 && (
                <p className="text-[10px] text-[#CDA52F]/60 mt-1">{compraIds.length} producto(s) seleccionado(s)</p>
              )}
            </div>

            <div className="flex gap-3">
              <div className="w-32">
                <label className="text-xs text-white/45 block mb-1">Compra</label>
                <input type="number" min={1} value={compraCantidad || ''}
                  onChange={e => setCompraCantidad(Number(e.target.value) || 0)}
                  onBlur={() => { if (compraCantidad < 1) setCompraCantidad(1) }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CDA52F]/50" />
              </div>
              <div className="flex items-end pb-2 text-white/30 text-lg font-bold">&rarr;</div>
              <div className="flex-1">
                <label className="text-xs text-white/45 block mb-1">Producto regalo</label>
                <select value={regaloId} onChange={e => setRegaloId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CDA52F]/50 [&>option]:bg-[#1a1a1a]">
                  <option value="">Seleccionar...</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({fmtCOP(p.precio)})</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-white/45 block mb-1">Gratis</label>
                <input type="number" min={1} value={regaloCantidad || ''}
                  onChange={e => setRegaloCantidad(Number(e.target.value) || 0)}
                  onBlur={() => { if (regaloCantidad < 1) setRegaloCantidad(1) }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CDA52F]/50" />
              </div>
            </div>

            {nombre && compraIds.length > 0 && regaloId && (
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-3">
                <p className="text-xs text-white/50">Preview:</p>
                <p className="text-sm text-white/80 mt-1">
                  Por cada <span className="text-[#CDA52F] font-bold">{compraCantidad}</span> de{' '}
                  <span className="text-[#CDA52F]">{compraIds.length === 1
                    ? productos.find(p => p.id === compraIds[0])?.nombre
                    : `${compraIds.length} productos`
                  }</span>
                  {' '}&rarr;{' '}
                  <span className="text-[#4ECDC4] font-bold">{regaloCantidad}</span>{' '}
                  <span className="text-[#4ECDC4]">{regaloProducto?.nombre}</span> gratis
                  {regaloProducto && (
                    <span className="text-white/30"> ({fmtCOP(regaloProducto.precio)} c/u)</span>
                  )}
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm text-center py-2 px-3 rounded-lg border bg-red-500/10 text-red-400 border-red-500/20">
                {error}
              </div>
            )}

            <Btn onClick={handleCrear} disabled={creando || !nombre.trim() || compraIds.length === 0 || !regaloId}>
              {creando ? 'Creando...' : 'Crear Promocion'}
            </Btn>
          </div>
        </Card>
      )}

      {promociones.length === 0 ? (
        <Card className="text-center py-8 text-white/30 text-sm">No hay promociones creadas</Card>
      ) : (
        <div className="space-y-2">
          {promociones.map(promo => (
            <Card key={promo.id}>
              <div className="flex items-center gap-3">
                <button onClick={() => onToggle(promo.id, !promo.activa)}
                  className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${
                    promo.activa ? 'bg-[#4ECDC4]' : 'bg-white/10'
                  }`}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                    promo.activa ? 'left-5' : 'left-1'
                  }`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${promo.activa ? 'text-white' : 'text-white/40'}`}>
                      {promo.nombre}
                    </p>
                    {promo.activa && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#4ECDC4]/15 text-[#4ECDC4] font-medium">ACTIVA</span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/35 mt-0.5">
                    Compra {promo.compraCantidad} de{' '}
                    <span className="text-[#CDA52F]/60">
                      {promo.compraProductoNombres.length <= 2
                        ? promo.compraProductoNombres.join(', ')
                        : `${promo.compraProductoNombres.length} productos`
                      }
                    </span>
                    {' '}&rarr; {promo.regaloCantidad}{' '}
                    <span className="text-[#4ECDC4]/60">{promo.regaloProductoNombre}</span> gratis
                    <span className="text-white/20"> ({fmtCOP(promo.regaloProductoPrecio)})</span>
                  </p>
                </div>
                {confirmDeleteId === promo.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#FF5050]">Eliminar?</span>
                    <Btn size="sm" variant="danger" onClick={() => { onEliminar(promo.id); setConfirmDeleteId(null); setShowDeletedModal(promo.nombre) }}>Si</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>No</Btn>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(promo.id)}
                    className="text-white/20 hover:text-[#FF5050] transition-colors p-1 shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ModulosPremium({ enabled, onToggle }: { enabled: boolean; onToggle: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const modulos = [
    { nombre: 'Dashboard', desc: 'Graficas, KPIs y resumen general', premium: true },
    { nombre: 'Tickets / Pedidos', desc: 'Gestion de pedidos por mesa', premium: true },
    { nombre: 'Ventas', desc: 'Control de ventas y cuentas', premium: true },
    { nombre: 'Promociones', desc: 'Promos tipo 2x1, combos', premium: true },
    { nombre: 'Liquidacion', desc: 'Liquidacion diaria por trabajador', premium: false },
    { nombre: 'Liq. Semana', desc: 'Resumen semanal consolidado', premium: false },
    { nombre: 'Billar', desc: 'Mesas de billar, partidas y cobros', premium: false },
    { nombre: 'Inventario', desc: 'Control de inventario semanal', premium: false },
    { nombre: 'Comparativo', desc: 'Conteo fisico vs tiquets', premium: false },
    { nombre: 'Dias de Apertura', desc: 'Calendario de apertura mensual', premium: false },
    { nombre: 'Productos', desc: 'Catalogo de productos y precios', premium: false },
  ]

  const handleSubmit = async () => {
    if (await onToggle(pin)) {
      setPin('')
      setError('')
    } else {
      setError('PIN incorrecto')
      setTimeout(() => setError(''), 2000)
    }
  }

  return (
    <div className="max-w-lg">
      <Card className="mb-4 border-[#CDA52F]/15">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#CDA52F]/15 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#CDA52F"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="#CDA52F" strokeWidth="2"/></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Modulos Premium</p>
            <p className="text-[11px] text-white/30">Desbloquea funcionalidades avanzadas</p>
          </div>
          <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full ${enabled ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-white/5 text-white/30'}`}>
            {enabled ? 'ACTIVO' : 'BLOQUEADO'}
          </span>
        </div>

        <div className="flex gap-2">
          <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN de activacion"
            maxLength={4}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50 text-center tracking-[0.5em]" />
          <button onClick={handleSubmit}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${enabled ? 'bg-[#FF5050]/10 text-[#FF5050] border border-[#FF5050]/20 hover:bg-[#FF5050]/20' : 'bg-[#CDA52F] text-black hover:bg-[#CDA52F]/80'}`}>
            {enabled ? 'Bloquear' : 'Activar'}
          </button>
        </div>
        {error && <p className="text-xs text-[#FF5050] mt-2 text-center">{error}</p>}
      </Card>

      <div className="space-y-2">
        {modulos.map(m => (
          <div key={m.nombre} className={`flex items-center justify-between p-3 rounded-xl border ${m.premium ? (enabled ? 'border-[#4ECDC4]/20 bg-[#4ECDC4]/[0.03]' : 'border-white/5 bg-white/[0.02] opacity-50') : 'border-white/[0.07] bg-white/[0.02]'}`}>
            <div className="flex items-center gap-3">
              {m.premium ? (
                enabled ? (
                  <div className="w-7 h-7 rounded-lg bg-[#4ECDC4]/15 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#4ECDC4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                )
              ) : (
                <div className="w-7 h-7 rounded-lg bg-[#CDA52F]/10 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#CDA52F"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
              )}
              <div>
                <p className="text-sm text-white/80">{m.nombre}</p>
                <p className="text-[10px] text-white/25">{m.desc}</p>
              </div>
            </div>
            {m.premium && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${enabled ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'bg-[#CDA52F]/10 text-[#CDA52F]'}`}>
                PREMIUM
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
