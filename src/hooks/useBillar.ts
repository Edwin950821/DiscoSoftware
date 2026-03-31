import { useState, useEffect, useCallback, useMemo } from 'react'
import { db, getHoy } from '../lib/db'
import type { MesaBillar, PartidaBillar } from '../types'

export function useBillar() {
  const [mesas, setMesas] = useState<MesaBillar[]>([])
  const [partidas, setPartidas] = useState<PartidaBillar[]>([])

  const fetchMesas = useCallback(async () => {
    const data = await db.mesasBillar.toArray()
    const mapped = await Promise.all(data.map(async (m: any) => {
      const mesaId = String(m.id)
      const partidaActiva = await db.partidasBillar
        .where('[mesaBillarId+estado]')
        .equals([mesaId, 'EN_CURSO'])
        .first()
      return {
        ...m,
        id: mesaId,
        estado: partidaActiva ? 'EN_JUEGO' : (m.activo ? 'LIBRE' : 'INACTIVA'),
        partidaActiva: partidaActiva ? { ...partidaActiva, id: String(partidaActiva.id) } : undefined,
      }
    }))
    setMesas(mapped as MesaBillar[])
  }, [])

  const fetchPartidas = useCallback(async () => {
    const hoy = getHoy()
    const data = await db.partidasBillar.where('jornadaFecha').equals(hoy).toArray()
    setPartidas(data.map((p: any) => ({ ...p, id: String(p.id) })))
  }, [])

  const refetch = useCallback(async () => {
    await Promise.all([fetchMesas(), fetchPartidas()])
  }, [fetchMesas, fetchPartidas])

  useEffect(() => { refetch() }, [refetch])

  const crearMesa = async (nombre: string, precioPorHora: number) => {
    const todas = await db.mesasBillar.toArray()
    const maxNumero = todas.reduce((max: number, m: any) => Math.max(max, m.numero || 0), 0)
    const id = await db.mesasBillar.add({
      numero: maxNumero + 1,
      nombre,
      precioPorHora,
      activo: true,
    })
    await refetch()
    return { id: String(id), nombre, precioPorHora }
  }

  const actualizarMesa = async (id: string, data: { nombre?: string; precioPorHora?: number; activo?: boolean }) => {
    await db.mesasBillar.update(Number(id), data)
    await refetch()
  }

  const eliminarMesa = async (id: string) => {
    await db.mesasBillar.delete(Number(id))
    await refetch()
  }

  const iniciarPartida = async (mesaId: string, nombreCliente: string, precioPorHora?: number) => {
    const mesa = await db.mesasBillar.get(Number(mesaId))
    if (!mesa) throw new Error('Mesa no encontrada')

    const hoy = getHoy()
    const precio = precioPorHora ?? mesa.precioPorHora

    const id = await db.partidasBillar.add({
      mesaBillarId: mesaId,
      mesaBillarNumero: mesa.numero,
      mesaBillarNombre: mesa.nombre,
      nombreCliente,
      horaInicio: new Date().toISOString(),
      precioPorHora: precio,
      estado: 'EN_CURSO',
      jornadaFecha: hoy,
      creadoEn: new Date().toISOString(),
    })

    await refetch()
    return { id: String(id) }
  }

  const finalizarPartida = async (mesaId: string) => {
    const partida = await db.partidasBillar
      .where('[mesaBillarId+estado]')
      .equals([mesaId, 'EN_CURSO'])
      .first()
    if (!partida) throw new Error('No hay partida activa')

    const horaFin = new Date()
    const horaInicio = new Date(partida.horaInicio)
    const diffMs = horaFin.getTime() - horaInicio.getTime()
    const minutosCobrados = Math.max(1, Math.ceil(diffMs / (1000 * 60)))
    const precioPorMinuto = partida.precioPorHora / 60
    const total = Math.round(minutosCobrados * precioPorMinuto)
    const horasCobradas = minutosCobrados

    await db.partidasBillar.update(partida.id, {
      horaFin: horaFin.toISOString(),
      horasCobradas,
      total,
      estado: 'FINALIZADA',
    })

    await refetch()
    return { ...partida, horaFin: horaFin.toISOString(), horasCobradas, total, estado: 'FINALIZADA', id: String(partida.id) }
  }

  const trasladarPartida = async (mesaOrigenId: string, mesaDestinoId: string) => {
    const partida = await db.partidasBillar
      .where('[mesaBillarId+estado]')
      .equals([mesaOrigenId, 'EN_CURSO'])
      .first()
    if (!partida) throw new Error('No hay partida activa en mesa origen')

    const destino = await db.mesasBillar.get(Number(mesaDestinoId))
    if (!destino) throw new Error('Mesa destino no encontrada')

    await db.partidasBillar.update(partida.id, {
      mesaBillarId: mesaDestinoId,
      mesaBillarNumero: destino.numero,
      mesaBillarNombre: destino.nombre,
    })

    await refetch()
    return { ...partida, mesaBillarId: mesaDestinoId, id: String(partida.id) }
  }

  const partidasFinalizadas = useMemo(() => partidas.filter(p => p.estado === 'FINALIZADA'), [partidas])
  const totalBillarHoy = useMemo(() => partidasFinalizadas.reduce((s, p) => s + (p.total || 0), 0), [partidasFinalizadas])

  return {
    mesas,
    partidasFinalizadas,
    totalBillarHoy,
    crearMesa,
    actualizarMesa,
    eliminarMesa,
    iniciarPartida,
    finalizarPartida,
    trasladarPartida,
  }
}
