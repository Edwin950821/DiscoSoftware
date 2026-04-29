import { useEffect, useState, useCallback, useRef } from 'react'
import { API_SUPER, apiFetch } from '../lib/config'
import type { ConsolidadoData } from '../types'

interface UseConsolidadoState {
  data: ConsolidadoData | null
  loading: boolean
  error: string | null
}

export function useConsolidado() {
  const [state, setState] = useState<UseConsolidadoState>({ data: null, loading: true, error: null })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchConsolidado = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await apiFetch(`${API_SUPER}/consolidado`)
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
  }, [])

  useEffect(() => { fetchConsolidado() }, [fetchConsolidado])

  return { ...state, recargar: fetchConsolidado }
}
