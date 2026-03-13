import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT } from '../lib/config'
import type { Mesero } from '../types'

export function useMeseros() {
  const [meseros, setMeseros] = useState<Mesero[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${API_MANAGEMENT}/meseros`)
      if (!res.ok) throw new Error('Error fetching meseros')
      const data = await res.json()
      setMeseros(data.map((m: any) => ({ ...m, id: String(m.id) })))
    } catch {
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const agregar = async (m: Omit<Mesero, 'id'>) => {
    try {
      const res = await fetch(`${API_MANAGEMENT}/meseros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      })
      if (!res.ok) throw new Error('Error creating mesero')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  const actualizar = async (id: string, data: Partial<Mesero>) => {
    try {
      const res = await fetch(`${API_MANAGEMENT}/meseros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error updating mesero')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  const eliminar = async (id: string) => {
    try {
      const res = await fetch(`${API_MANAGEMENT}/meseros/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error deleting mesero')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  return { meseros, agregar, actualizar, eliminar }
}
