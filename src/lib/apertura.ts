// Lógica compartida de Días de Apertura.
// Persiste los festivos y asignaciones de SI en localStorage por mes,
// para que la Liquidación Semanal pueda usarlos al agrupar jornadas.

export interface DiaInfo {
  fecha: string
  dia: number
  abre: boolean
  si: number | null
  siLabel: string
  festivo: boolean
  needsAssignment: boolean
}

export interface Semana {
  si: number
  label: string
  dias: string[]
  rango: string
}

const MESES_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

export function fmtFecha(year: number, month: number, d: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function generarCalendario(
  year: number,
  month: number,
  festivos: Set<string>,
  asignaciones: Record<string, number>
): { dias: DiaInfo[]; semanas: Semana[] } {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dateToSi: Record<string, number> = {}
  let siCount = 0

  // Si el mes empieza en Sáb/Dom antes del primer Vie → pre-asignar a SI-1
  const firstDayDow = new Date(year, month, 1).getDay()
  if (firstDayDow === 6 || firstDayDow === 0) {
    siCount = 1
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay()
      if (dow === 5) break
      if (dow === 6 || dow === 0) dateToSi[fmtFecha(year, month, d)] = 1
      else if (festivos.has(fmtFecha(year, month, d))) dateToSi[fmtFecha(year, month, d)] = 1
    }
  }

  // Anclar cada SI en su VIERNES: Vie (si festivo) + Sáb + Dom + Lun (si festivo)
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month, d).getDay() !== 5) continue
    siCount++
    const si = siCount

    if (festivos.has(fmtFecha(year, month, d))) dateToSi[fmtFecha(year, month, d)] = si
    if (d + 1 <= daysInMonth) dateToSi[fmtFecha(year, month, d + 1)] = si
    if (d + 2 <= daysInMonth) dateToSi[fmtFecha(year, month, d + 2)] = si
    if (d + 3 <= daysInMonth && new Date(year, month, d + 3).getDay() === 1 && festivos.has(fmtFecha(year, month, d + 3)))
      dateToSi[fmtFecha(year, month, d + 3)] = si
  }

  // Aplicar asignaciones manuales de festivos mid-semana
  for (const [fecha, si] of Object.entries(asignaciones))
    if (festivos.has(fecha)) dateToSi[fecha] = si

  const dias: DiaInfo[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const fechaStr = fmtFecha(year, month, d)
    const festivo = festivos.has(fechaStr)
    const si = dateToSi[fechaStr] ?? null
    dias.push({
      fecha: fechaStr, dia: d,
      abre: si !== null,
      si, siLabel: si ? `SI-${si}` : '',
      festivo,
      needsAssignment: festivo && si === null,
    })
  }

  const semanaMap: Record<number, number[]> = {}
  dias.forEach(d => {
    if (d.si !== null) {
      if (!semanaMap[d.si]) semanaMap[d.si] = []
      semanaMap[d.si].push(d.dia)
    }
  })
  const semanas: Semana[] = Object.entries(semanaMap)
    .map(([si, days]) => {
      const sorted = [...days].sort((a, b) => a - b)
      return {
        si: Number(si), label: `SI-${si}`,
        dias: sorted.map(d => fmtFecha(year, month, d)),
        rango: `${sorted[0]} al ${sorted[sorted.length - 1]} ${MESES_SHORT[month]}`,
      }
    })
    .sort((a, b) => a.si - b.si)

  return { dias, semanas }
}

// ─── Persistencia en localStorage ────────────────────────────────────────────

function storageKey(year: number, month: number): string {
  return `monastery_apertura_${year}_${String(month + 1).padStart(2, '0')}`
}

export function guardarCalendarioMes(
  year: number,
  month: number,
  festivos: Set<string>,
  asignaciones: Record<string, number>
): void {
  try {
    localStorage.setItem(storageKey(year, month), JSON.stringify({
      festivos: [...festivos],
      asignaciones,
    }))
  } catch { /* noop */ }
}

export function cargarCalendarioMes(
  year: number,
  month: number
): { festivos: Set<string>; asignaciones: Record<string, number> } {
  try {
    const raw = localStorage.getItem(storageKey(year, month))
    if (!raw) return { festivos: new Set(), asignaciones: {} }
    const parsed = JSON.parse(raw)
    return {
      festivos: new Set<string>(parsed.festivos ?? []),
      asignaciones: parsed.asignaciones ?? {},
    }
  } catch {
    return { festivos: new Set(), asignaciones: {} }
  }
}

// Dado una fecha "YYYY-MM-DD", devuelve el número de SI al que pertenece
// según la configuración guardada en localStorage para ese mes.
// Devuelve null si no hay datos o la fecha no tiene SI asignado.
export function getSiParaFecha(fecha: string): number | null {
  try {
    const parts = fecha.split('-')
    const year = Number(parts[0])
    const month = Number(parts[1]) - 1
    const { festivos, asignaciones } = cargarCalendarioMes(year, month)
    const { dias } = generarCalendario(year, month, festivos, asignaciones)
    return dias.find(d => d.fecha === fecha)?.si ?? null
  } catch {
    return null
  }
}
