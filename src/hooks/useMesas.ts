import { useEffect, useState, useCallback } from 'react'
import { db } from '../lib/db'
import type { Mesa } from '../types'

export function useMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([])

  const fetchAll = useCallback(async () => {
    const data = await db.mesas.orderBy('numero').toArray()
    setMesas(data.map((m: any) => ({ ...m, id: String(m.id) })))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { mesas, refetch: fetchAll }
}
