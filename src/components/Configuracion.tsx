import { useState } from 'react'
import type { Trabajador } from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Input } from './ui/Input'
import { API_URL } from '../lib/config'

const COLORES_TRABAJADOR = ['#CDA52F', '#4ECDC4', '#FFE66D', '#A8E6CF', '#C3B1E1', '#FF8FA3', '#98D8C8', '#FFB347']

interface Props {
  accessToken: string
  trabajadores: Trabajador[]
  agregarTrabajador: (t: Omit<Trabajador, 'id'>) => Promise<void>
  actualizarTrabajador: (id: string, data: Partial<Trabajador>) => Promise<void>
  eliminarTrabajador: (id: string) => Promise<void>
}

export default function Configuracion({ accessToken, trabajadores, agregarTrabajador, actualizarTrabajador, eliminarTrabajador }: Props) {
  const [tab, setTab] = useState<'trabajadores' | 'seguridad'>('trabajadores')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const handleAgregar = async () => {
    if (!nuevoNombre.trim()) return
    const color = COLORES_TRABAJADOR[trabajadores.length % COLORES_TRABAJADOR.length]
    const avatar = nuevoNombre.trim().slice(0, 2).toUpperCase()
    await agregarTrabajador({ nombre: nuevoNombre.trim(), color, avatar, activo: true })
    setNuevoNombre('')
  }

  const handleEliminar = async (id: string) => {
    await eliminarTrabajador(id)
    setConfirmDelete(null)
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
      const res = await fetch(`${API_URL}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.ok) {
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
        setPwMsg(null)
        setShowSuccessModal(true)
      } else if (res.status === 403 || res.status === 401) {
        setPwMsg({ text: 'Sesion expirada. Cierra sesion y vuelve a ingresar.', ok: false })
      } else {
        const data = await res.json().catch(() => null)
        setPwMsg({ text: data?.message || 'Error al cambiar contrasena', ok: false })
      }
    } catch {
      setPwMsg({ text: 'No se pudo conectar al servidor', ok: false })
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

      <h2 className="text-xl font-bold mb-6">Configuracion</h2>

      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('trabajadores')}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'trabajadores' ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'}`}>
          Trabajadores
        </button>
        <button onClick={() => setTab('seguridad')}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'seguridad' ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'}`}>
          Seguridad
        </button>
      </div>

      {tab === 'trabajadores' && (
        <div className="max-w-lg">
          {/* Agregar nuevo */}
          <Card className="mb-4">
            <p className="text-xs text-white/40 font-medium mb-3 uppercase tracking-wider">Agregar Trabajador</p>
            <div className="flex gap-2">
              <Input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Nombre del trabajador"
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAgregar()}
                className="flex-1" />
              <Btn onClick={handleAgregar} disabled={!nuevoNombre.trim()}>Agregar</Btn>
            </div>
            {nuevoNombre.trim() && (
              <div className="flex items-center gap-2 mt-2 text-xs text-white/30">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{
                    backgroundColor: COLORES_TRABAJADOR[trabajadores.length % COLORES_TRABAJADOR.length] + '33',
                    color: COLORES_TRABAJADOR[trabajadores.length % COLORES_TRABAJADOR.length],
                  }}>
                  {nuevoNombre.trim().slice(0, 2).toUpperCase()}
                </div>
                <span>Vista previa del avatar</span>
              </div>
            )}
          </Card>

          {/* Lista de trabajadores */}
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
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: t.color + '33', color: t.color }}>{t.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 font-medium">{t.nombre}</p>
                        <p className="text-[10px] text-white/25">ID: {t.id}</p>
                      </div>
                      {confirmDelete === t.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#FF5050]">Eliminar?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(t.id)}>Si</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Btn>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
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

      {tab === 'seguridad' && (
        <Card className="max-w-md">
          <h3 className="text-sm font-medium text-white/45 mb-4">Cambiar contrasena</h3>
          <div className="space-y-3">
            <Input label="Contrasena actual" type="password" value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••" />
            <Input label="Nueva contrasena" type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" />
            <Input label="Confirmar nueva contrasena" type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} placeholder="Repetir nueva contrasena" />

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
    </div>
  )
}
