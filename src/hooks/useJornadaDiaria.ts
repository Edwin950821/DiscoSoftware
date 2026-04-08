import { useCallback, useEffect, useState } from 'react'
import { API_PEDIDOS, apiFetch } from '../lib/config'
import type { ResumenDia, ResumenJornada } from '../types'

export function useJornadaDiaria() {
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [historial, setHistorial] = useState<ResumenJornada[]>([])
  const [loading, setLoading] = useState(false)

  const fetchResumen = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/jornada/resumen`)
      if (!res.ok) return
      const data = await res.json()
      setResumen({
        fecha: data.fecha,
        totalVentas: data.totalVentas,
        totalBillar: data.totalBillar,
        totalGeneral: data.totalGeneral,
        cuentasCerradas: data.cuentasCerradas,
        cuentasAbiertas: data.cuentasAbiertas ?? 0,
        ticketsTotales: data.ticketsTotales,
        mesasAtendidas: data.mesasAtendidas,
        partidasBillar: data.partidasBillar,
        jornadaCerrada: data.jornadaCerrada,
      })
    } catch { /* offline */ }
  }, [])

  const fetchHistorial = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_PEDIDOS}/jornada/historial`)
      if (!res.ok) return
      const data = await res.json()
      setHistorial(data.map((j: any) => ({
        id: String(j.id),
        fecha: j.fecha,
        totalVentas: j.totalVentas,
        totalBillar: j.totalBillar,
        totalGeneral: j.totalGeneral,
        cuentasCerradas: j.cuentasCerradas,
        ticketsTotales: j.ticketsTotales,
        mesasAtendidas: j.mesasAtendidas,
        partidasBillar: j.partidasBillar,
        cerradoEn: j.cerradoEn,
      })))
    } catch { /* offline */ }
  }, [])

  const cerrarJornada = useCallback(async (): Promise<ResumenJornada | null> => {
    setLoading(true)
    try {
      const res = await apiFetch(`${API_PEDIDOS}/jornada/cerrar`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Error al cerrar jornada')
      }
      const data = await res.json()
      await fetchResumen()
      await fetchHistorial()
      return {
        id: String(data.id),
        fecha: data.fecha,
        totalVentas: data.totalVentas,
        totalBillar: data.totalBillar,
        totalGeneral: data.totalGeneral,
        cuentasCerradas: data.cuentasCerradas,
        ticketsTotales: data.ticketsTotales,
        mesasAtendidas: data.mesasAtendidas,
        partidasBillar: data.partidasBillar,
        cerradoEn: data.cerradoEn,
      } as ResumenJornada
    } finally {
      setLoading(false)
    }
  }, [fetchResumen, fetchHistorial])

  useEffect(() => {
    fetchResumen()
    fetchHistorial()
  }, [fetchResumen, fetchHistorial])

  return {
    resumen,
    historial,
    cerrarJornada,
    loading,
    refetch: fetchResumen,
    refetchHistorial: fetchHistorial,
  }
}
