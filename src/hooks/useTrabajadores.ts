import { useEffect, useState, useCallback } from 'react'
import { db, hashPassword } from '../lib/db'
import type { Trabajador } from '../types'

export function useTrabajadores() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])

  const fetchAll = useCallback(async () => {
    const data = await db.trabajadores.toArray()
    setTrabajadores(data.map((m: any) => ({ ...m, id: String(m.id) })))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const agregar = async (t: Omit<Trabajador, 'id'> & { username?: string; password?: string }) => {
    const { username, password, ...trabajadorData } = t

    // Si tiene username/password, crear también un user para login
    if (username && password) {
      const existingUser = await db.users.where('username').equals(username).first()
      if (existingUser) throw new Error('El usuario ya existe')

      const id = await db.trabajadores.add({ ...trabajadorData, username })
      const pwHash = await hashPassword(password)
      await db.users.add({
        username,
        passwordHash: pwHash,
        nombre: trabajadorData.nombre,
        role: 'MESERO',
        meseroId: id as number,
        isActive: true,
      })
    } else {
      await db.trabajadores.add(trabajadorData)
    }
    await fetchAll()
  }

  const actualizar = async (id: string, data: Partial<Trabajador>) => {
    await db.trabajadores.update(Number(id), data)
    // Actualizar nombre en users si corresponde
    if (data.nombre) {
      const trab = await db.trabajadores.get(Number(id))
      if (trab?.username) {
        const user = await db.users.where('username').equals(trab.username).first()
        if (user?.id) await db.users.update(user.id, { nombre: data.nombre })
      }
    }
    await fetchAll()
  }

  const eliminar = async (id: string) => {
    const trab = await db.trabajadores.get(Number(id))
    if (trab?.username) {
      const user = await db.users.where('username').equals(trab.username).first()
      if (user?.id) await db.users.delete(user.id)
    }
    await db.trabajadores.delete(Number(id))
    await fetchAll()
  }

  return { trabajadores, agregar, actualizar, eliminar }
}
