import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT } from '../lib/config'
import type { Jornada, JornadaInput, MeseroJornada } from '../types'

export function useJornadas() {
  const [jornadas, setJornadas] = useState<Jornada[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${API_MANAGEMENT}/jornadas`)
      if (!res.ok) throw new Error('Error fetching jornadas')
      const data = await res.json()
      setJornadas(data.map((j: any) => ({
        ...j,
        id: String(j.id),
        meseros: (j.meseros || []).map((m: any) => ({
          ...m,
          meseroId: String(m.meseroId),
        } as MeseroJornada)),
      } as Jornada)))
    } catch {
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const guardar = async (jornada: JornadaInput) => {
    try {
      const body = {
        sesion: jornada.sesion,
        fecha: jornada.fecha,
        meseros: jornada.meseros.map(m => ({
          meseroId: Number(m.meseroId),
          nombre: m.nombre,
          color: m.color,
          avatar: m.avatar,
          totalMesero: m.totalMesero,
          cortesias: m.cortesias,
          gastos: m.gastos,
          pagos: m.pagos,
          efectivoEntregado: m.efectivoEntregado || 0,
        })),
      }
      const res = await fetch(`${API_MANAGEMENT}/jornadas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error creating jornada')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  const eliminar = async (id: string) => {
    try {
      const res = await fetch(`${API_MANAGEMENT}/jornadas/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error deleting jornada')
      await fetchAll()
    } catch (e) {
      throw e
    }
  }

  return { jornadas, guardar, eliminar }
}
