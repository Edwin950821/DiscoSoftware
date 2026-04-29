import { useState } from 'react'
import type { Producto } from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Input } from './ui/Input'
import { fmtFull } from '../lib/utils'
import ImportarProductosExcel from './ImportarProductosExcel'

interface Props {
  productos: Producto[]
  agregar: (p: Omit<Producto, 'id'>) => Promise<void>
  actualizar: (id: string, data: Partial<Producto>) => Promise<void>
  eliminar: (id: string) => Promise<void>
}

export default function Productos({ productos, agregar, actualizar, eliminar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPrecio, setEditPrecio] = useState('')
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ id: string; tipo: 'eliminar' | 'desactivar' | 'activar' } | null>(null)
  const [showImport, setShowImport] = useState(false)

  const existeNombre = (name: string, excludeId?: string) =>
    productos.some(p => p.nombre.toLowerCase() === name.toLowerCase() && p.id !== excludeId)

  const filtrados = busqueda.trim()
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : productos

  const handleAgregar = async () => {
    setError('')
    const precioNum = Number(precio)
    if (!nombre.trim() || !precioNum || precioNum <= 0) return
    if (existeNombre(nombre.trim())) {
      setError(`Ya existe un producto llamado "${nombre.trim()}"`)
      return
    }
    await agregar({ nombre: nombre.trim(), precio: precioNum, activo: true })
    setNombre('')
    setPrecio('')
    setMostrarForm(false)
  }

  const startEdit = (p: Producto) => {
    setEditId(p.id)
    setEditNombre(p.nombre)
    setEditPrecio(String(p.precio))
    setError('')
    setConfirmAction(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditNombre('')
    setEditPrecio('')
    setError('')
  }

  const saveEdit = async () => {
    setError('')
    if (!editId) return
    const precioNum = Number(editPrecio)
    if (!editNombre.trim() || !precioNum || precioNum <= 0) return
    if (existeNombre(editNombre.trim(), editId)) {
      setError(`Ya existe un producto llamado "${editNombre.trim()}"`)
      return
    }
    await actualizar(editId, { nombre: editNombre.trim(), precio: precioNum })
    cancelEdit()
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    if (confirmAction.tipo === 'eliminar') {
      await eliminar(confirmAction.id)
    } else {
      const activo = confirmAction.tipo === 'activar'
      await actualizar(confirmAction.id, { activo })
    }
    setConfirmAction(null)
  }

  const getConfirmMsg = () => {
    if (!confirmAction) return ''
    const p = productos.find(x => x.id === confirmAction.id)
    if (!p) return ''
    if (confirmAction.tipo === 'eliminar') return `¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`
    if (confirmAction.tipo === 'desactivar') return `¿Desactivar "${p.nombre}"? No aparecerá en el ingreso de tiquetes.`
    return `¿Activar "${p.nombre}"?`
  }

  return (
    <div>
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setConfirmAction(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-white mb-4">{getConfirmMsg()}</p>
            <div className="flex justify-end gap-2">
              <Btn size="sm" variant="ghost" onClick={() => setConfirmAction(null)}>Cancelar</Btn>
              <Btn size="sm" variant={confirmAction.tipo === 'eliminar' ? 'danger' : 'primary'} onClick={handleConfirmAction} className="flex items-center gap-1.5">
                {confirmAction.tipo === 'eliminar' && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>}
                {confirmAction.tipo === 'eliminar' ? 'Eliminar' : confirmAction.tipo === 'desactivar' ? 'Desactivar' : 'Activar'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-lg sm:text-xl font-bold mb-3">Productos</h2>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50 w-full sm:w-56"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <Btn variant="ghost" onClick={() => setShowImport(true)} className="flex-1 sm:flex-initial">
            Importar Excel
          </Btn>
          <Btn onClick={() => { setMostrarForm(!mostrarForm); setError('') }} className="flex-1 sm:flex-initial">
            {mostrarForm ? 'Cancelar' : '+ Nuevo'}
          </Btn>
        </div>
      </div>
      {showImport && (
        <ImportarProductosExcel
          productos={productos}
          agregar={agregar}
          actualizar={actualizar}
          onClose={() => setShowImport(false)}
        />
      )}

      {mostrarForm && (
        <Card className="mb-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-end">
            <Input label="Nombre" value={nombre} onChange={e => { setNombre(e.target.value); setError('') }} placeholder="Ej: Aguila Negra" className="flex-1" />
            <div className="flex gap-2 items-end">
              <Input label="Precio" type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="5000" className="flex-1 sm:w-32" />
              <Btn onClick={handleAgregar} disabled={!nombre.trim() || !precio} className="shrink-0">Agregar</Btn>
            </div>
          </div>
          {error && !editId && (
            <div className="mt-2 text-xs text-[#FF5050] bg-[#FF5050]/10 border border-[#FF5050]/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </Card>
      )}

      <p className="text-xs text-white/30 mb-3">
        {filtrados.length} de {productos.length} productos
        {busqueda.trim() && <button onClick={() => setBusqueda('')} className="ml-2 text-[#CDA52F] hover:text-[#CDA52F]/70">Limpiar</button>}
      </p>

      <div className="space-y-2">
        {filtrados.map(p => (
          <Card key={p.id}>
            {editId === p.id ? (
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input
                    type="text"
                    value={editNombre}
                    onChange={e => { setEditNombre(e.target.value); setError('') }}
                    className="bg-white/5 border border-[#CDA52F]/30 rounded-lg px-3 py-1.5 text-sm text-white flex-1 focus:outline-none focus:border-[#CDA52F]/60"
                  />
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1 sm:flex-none">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                      <input
                        type="number"
                        value={editPrecio}
                        onChange={e => setEditPrecio(e.target.value)}
                        className="bg-white/5 border border-[#CDA52F]/30 rounded-lg pl-6 pr-3 py-1.5 text-sm text-white w-full sm:w-28 focus:outline-none focus:border-[#CDA52F]/60"
                      />
                    </div>
                    <Btn size="sm" onClick={saveEdit}>
                      <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      <span className="hidden sm:inline">Guardar</span>
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={cancelEdit}>
                      <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                      <span className="hidden sm:inline">Cancelar</span>
                    </Btn>
                  </div>
                </div>
                {error && editId === p.id && (
                  <div className="mt-2 text-xs text-[#FF5050]">{error}</div>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
                <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0 sm:flex-1">
                  <span className={`text-sm ${p.activo ? 'text-white' : 'text-white/30 line-through'}`}>{p.nombre}</span>
                  <span className="text-xs text-[#FFE66D] shrink-0">{fmtFull(p.precio)}</span>
                </div>
                <div className="flex gap-2 sm:gap-1 shrink-0">
                  <button onClick={() => startEdit(p)} title="Editar"
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-all">
                    <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span className="hidden sm:inline text-sm font-medium">Editar</span>
                  </button>
                  <button onClick={() => setConfirmAction({ id: p.id, tipo: p.activo ? 'desactivar' : 'activar' })} title={p.activo ? 'Desactivar' : 'Activar'}
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-all">
                    {p.activo ? (
                      <>
                        <svg className="w-4 h-4 sm:hidden text-white/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        <span className="hidden sm:inline text-sm font-medium">Desactivar</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:hidden text-[#4ECDC4]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        <span className="hidden sm:inline text-sm font-medium">Activar</span>
                      </>
                    )}
                  </button>
                  <button onClick={() => setConfirmAction({ id: p.id, tipo: 'eliminar' })} title="Eliminar"
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-[#FF5050]/10 text-[#FF5050] border border-[#FF5050]/20 hover:bg-[#FF5050]/20 transition-all">
                    <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    <span className="hidden sm:inline text-sm font-medium">Eliminar</span>
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {filtrados.length === 0 && busqueda.trim() && (
          <Card className="text-center py-6 text-white/30 text-sm">
            No se encontraron productos con "{busqueda}"
          </Card>
        )}
      </div>
    </div>
  )
}
