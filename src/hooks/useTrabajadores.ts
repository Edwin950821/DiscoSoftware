import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Trabajador } from '../types'

export function useTrabajadores() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/meseros`)
      if (!res.ok) return
      const data = await res.json()
      setTrabajadores(data.map((m: any) => ({
        id: String(m.id), nombre: m.nombre, color: m.color,
        avatar: m.avatar, activo: m.activo, username: m.username || undefined,
      })))
    } catch { /* offline */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const agregar = async (t: Omit<Trabajador, 'id'> & { username?: string; password?: string }) => {
    await apiFetch(`${API_MANAGEMENT}/meseros`, {
      method: 'POST',
      body: JSON.stringify({ nombre: t.nombre, color: t.color, avatar: t.avatar, activo: t.activo, username: t.username, password: t.password }),
    })
    await fetchAll()
  }

  const actualizar = async (id: string, data: Partial<Trabajador>) => {
    setTrabajadores(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  }

  const eliminar = async (id: string) => {
    await apiFetch(`${API_MANAGEMENT}/meseros/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  return { trabajadores, agregar, actualizar, eliminar }
}
