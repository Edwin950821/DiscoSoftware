import { useState } from 'react'
import type { Producto } from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Input } from './ui/Input'
import { fmtFull } from '../lib/utils'

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
              <Btn size="sm" variant={confirmAction.tipo === 'eliminar' ? 'danger' : 'primary'} onClick={handleConfirmAction}>
                {confirmAction.tipo === 'eliminar' ? 'Eliminar' : confirmAction.tipo === 'desactivar' ? 'Desactivar' : 'Activar'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Productos</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50 w-56"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Btn onClick={() => { setMostrarForm(!mostrarForm); setError('') }}>
            {mostrarForm ? 'Cancelar' : '+ Nuevo Producto'}
          </Btn>
        </div>
      </div>

      {mostrarForm && (
        <Card className="mb-4">
          <div className="flex gap-3 items-end">
            <Input label="Nombre" value={nombre} onChange={e => { setNombre(e.target.value); setError('') }} placeholder="Ej: Aguila Negra" className="flex-1" />
            <Input label="Precio" type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="5000" className="w-32" />
            <Btn onClick={handleAgregar} disabled={!nombre.trim() || !precio}>Agregar</Btn>
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
          <Card key={p.id} className="flex items-center justify-between">
            {editId === p.id ? (
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editNombre}
                    onChange={e => { setEditNombre(e.target.value); setError('') }}
                    className="bg-white/5 border border-[#CDA52F]/30 rounded-lg px-3 py-1.5 text-sm text-white flex-1 focus:outline-none focus:border-[#CDA52F]/60"
                  />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                    <input
                      type="number"
                      value={editPrecio}
                      onChange={e => setEditPrecio(e.target.value)}
                      className="bg-white/5 border border-[#CDA52F]/30 rounded-lg pl-6 pr-3 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-[#CDA52F]/60"
                    />
                  </div>
                  <Btn size="sm" onClick={saveEdit}>Guardar</Btn>
                  <Btn size="sm" variant="ghost" onClick={cancelEdit}>Cancelar</Btn>
                </div>
                {error && editId === p.id && (
                  <div className="mt-2 text-xs text-[#FF5050]">{error}</div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${p.activo ? 'text-white' : 'text-white/30 line-through'}`}>{p.nombre}</span>
                  <span className="text-xs text-[#FFE66D]">{fmtFull(p.precio)}</span>
                </div>
                <div className="flex gap-2">
                  <Btn size="sm" variant="ghost" onClick={() => startEdit(p)}>Editar</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setConfirmAction({ id: p.id, tipo: p.activo ? 'desactivar' : 'activar' })}>
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => setConfirmAction({ id: p.id, tipo: 'eliminar' })}>Eliminar</Btn>
                </div>
              </>
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
