import { useState, useEffect } from 'react'

const STORAGE_KEY = 'monastery_colores_pago'

const COLORES_DEFAULT: Record<string, string> = {
  Efectivo: '#CDA52F',
  Datafono: '#A8E6CF',
  QR: '#4ECDC4',
  Nequi: '#FFE66D',
  Vales: '#C3B1E1',
}

function loadColores(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...COLORES_DEFAULT, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...COLORES_DEFAULT }
}

function saveColores(colores: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colores))
}

let _colores: Record<string, string> = loadColores()
let _listeners: Array<(c: Record<string, string>) => void> = []

export function getColoresPago(): Record<string, string> {
  return { ..._colores }
}

export function useColoresPago() {
  const [colores, setColores] = useState<Record<string, string>>({ ..._colores })

  useEffect(() => {
    const handler = (c: Record<string, string>) => setColores({ ...c })
    _listeners.push(handler)
    _colores = loadColores()
    setColores({ ..._colores })
    return () => {
      _listeners = _listeners.filter(h => h !== handler)
    }
  }, [])

  const actualizar = (nuevos: Record<string, string>) => {
    const merged = { ..._colores, ...nuevos }
    saveColores(merged)
    _colores = merged
    _listeners.forEach(h => h(merged))
  }

  return { colores, actualizar }
}
