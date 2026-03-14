import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Trabajador } from '../types'

export function useTrabajadores() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/meseros`)
      if (!res.ok) throw new Error('Error fetching trabajadores')
      const data = await res.json()
      setTrabajadores(data.map((m: any) => ({ ...m, id: String(m.id) })))
    } catch (e) { console.error('Error cargando trabajadores:', e) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const agregar = async (t: Omit<Trabajador, 'id'>) => {
    const res = await apiFetch(`${API_MANAGEMENT}/meseros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    })
    if (!res.ok) throw new Error('Error creating trabajador')
    await fetchAll()
  }

  const actualizar = async (id: string, data: Partial<Trabajador>) => {
    const res = await apiFetch(`${API_MANAGEMENT}/meseros/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Error updating trabajador')
    await fetchAll()
  }

  const eliminar = async (id: string) => {
    const res = await apiFetch(`${API_MANAGEMENT}/meseros/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error deleting trabajador')
    await fetchAll()
  }

  return { trabajadores, agregar, actualizar, eliminar }
}
