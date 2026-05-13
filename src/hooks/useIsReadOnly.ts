import { useMemo } from 'react'

function readRol(): string | null {
  try {
    const raw = sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.rol ?? null
  } catch {
    return null
  }
}

export function useIsReadOnly(): boolean {
  return useMemo(() => readRol() === 'SUPER', [])
}
