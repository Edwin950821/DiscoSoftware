import { useEffect, useState, useCallback, useRef } from 'react'
import { API_SUPER, apiFetch } from '../lib/config'
import type { ConsolidadoData, TipoNegocio, RangoTemporal } from '../types'

interface UseConsolidadoState {
  data: ConsolidadoData | null
  loading: boolean
  error: string | null
}

export interface ConsolidadoFiltro {
  tipo?: TipoNegocio | 'TODOS'
  negocioId?: string
  rango?: RangoTemporal
  fechaDesde?: string
  fechaHasta?: string
}

export function useConsolidado(filtro?: ConsolidadoFiltro) {
  const [state, setState] = useState<UseConsolidadoState>({ data: null, loading: true, error: null })
  const mountedRef = useRef(true)
  const tipo = filtro?.tipo
  const negocioId = filtro?.negocioId
  const rango = filtro?.rango
  const fechaDesde = filtro?.fechaDesde
  const fechaHasta = filtro?.fechaHasta

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchConsolidado = useCallback(async () => {
    if (rango === 'PERSONALIZADO' && (!fechaDesde || !fechaHasta)) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const params = new URLSearchParams()
      if (negocioId) {
        params.set('negocioId', negocioId)
      } else if (tipo && tipo !== 'TODOS') {
        params.set('tipo', tipo)
      }
      if (rango === 'PERSONALIZADO' && fechaDesde && fechaHasta) {
        params.set('fechaDesde', fechaDesde)
        params.set('fechaHasta', fechaHasta)
      } else if (rango && rango !== 'TODO') {
        params.set('rango', rango)
      }
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await apiFetch(`${API_SUPER}/consolidado${qs}`)
      if (!mountedRef.current) return
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        if (!mountedRef.current) return
        setState({ data: null, loading: false, error: body?.message || `Error ${res.status}` })
        return
      }
      const data = (await res.json()) as ConsolidadoData
      if (!mountedRef.current) return
      setState({ data, loading: false, error: null })
    } catch {
      if (!mountedRef.current) return
      setState({ data: null, loading: false, error: 'Error de conexión' })
    }
  }, [tipo, negocioId, rango, fechaDesde, fechaHasta])

  useEffect(() => { fetchConsolidado() }, [fetchConsolidado])

  return { ...state, recargar: fetchConsolidado }
}
