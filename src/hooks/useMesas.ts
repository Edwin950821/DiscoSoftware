import { useEffect, useState, useCallback } from 'react'
import { API_MANAGEMENT, apiFetch } from '../lib/config'
import type { Mesa } from '../types'

export function useMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_MANAGEMENT}/mesas`)
      if (!res.ok) return
      const data = await res.json()
      setMesas(data.map((m: any) => ({
        id: String(m.id), numero: m.numero, nombre: m.nombre, estado: m.estado || 'LIBRE',
        nombreCliente: m.nombreCliente || undefined, meseroId: m.meseroId ? String(m.meseroId) : undefined,
        meseroNombre: m.meseroNombre || undefined, meseroColor: m.meseroColor || undefined,
        meseroAvatar: m.meseroAvatar || undefined,
      })))
    } catch { /* offline */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { mesas, refetch: fetchAll }
}
