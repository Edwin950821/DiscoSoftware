import { useState, useMemo } from 'react'
import { Card } from './ui/Card'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIAS_HEADER = ['L','M','M','J','V','S','D']
const DIAS_HEADER_LG = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM']

interface DiaInfo {
  fecha: string
  dia: number
  abre: boolean
  si: number | null        // número de semana (1, 2, 3...)
  siLabel: string          // "SI-1", "SI-2"...
  festivo: boolean
  needsAssignment: boolean // festivo mid-semana sin SI asignado
}

interface Semana {
  si: number
  label: string  // "SI-1"
  dias: string[] // fechas en esta semana
  rango: string  // "2 al 4 may"
}

function fmt(year: number, month: number, d: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function generarCalendario(
  year: number,
  month: number,
  festivos: Set<string>,
  asignaciones: Record<string, number>
): { dias: DiaInfo[]; semanas: Semana[] } {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dateToSi: Record<string, number> = {}
  let siCount = 0

  // Anclar cada SI en su sábado: incluye Vie festivo antes, Sáb, Dom, Lun festivo después
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month, d).getDay() !== 6) continue
    siCount++
    const si = siCount

    // Viernes antes (si es festivo)
    if (d - 1 >= 1 && new Date(year, month, d - 1).getDay() === 5 && festivos.has(fmt(year, month, d - 1)))
      dateToSi[fmt(year, month, d - 1)] = si

    // Sábado (siempre)
    dateToSi[fmt(year, month, d)] = si

    // Domingo (siempre, si está en el mes)
    if (d + 1 <= daysInMonth) dateToSi[fmt(year, month, d + 1)] = si

    // Lunes después (solo si festivo)
    if (d + 2 <= daysInMonth && new Date(year, month, d + 2).getDay() === 1 && festivos.has(fmt(year, month, d + 2)))
      dateToSi[fmt(year, month, d + 2)] = si
  }

  // Si el mes empieza en domingo sin sábado previo en el mes → asignar a SI-1
  if (new Date(year, month, 1).getDay() === 0 && !dateToSi[fmt(year, month, 1)] && siCount >= 1)
    dateToSi[fmt(year, month, 1)] = 1

  // Aplicar asignaciones manuales de festivos mid-semana
  for (const [fecha, si] of Object.entries(asignaciones))
    if (festivos.has(fecha)) dateToSi[fecha] = si

  // Construir días
  const dias: DiaInfo[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const fechaStr = fmt(year, month, d)
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

  // Construir semanas con rango de días
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
        dias: sorted.map(d => fmt(year, month, d)),
        rango: `${sorted[0]} al ${sorted[sorted.length - 1]} ${MESES_SHORT[month]}`,
      }
    })
    .sort((a, b) => a.si - b.si)

  return { dias, semanas }
}

export default function Jornadas() {
  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]
  const [year, setYear] = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth())
  const [festivos, setFestivos] = useState<Set<string>>(new Set())
  const [asignaciones, setAsignaciones] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [pendingFestivo, setPendingFestivo] = useState<{
    fecha: string
    prev: Semana | null
    next: Semana | null
  } | null>(null)

  const { dias, semanas } = useMemo(
    () => generarCalendario(year, month, festivos, asignaciones),
    [year, month, festivos, asignaciones]
  )

  const prevMonth = () => { setSelected(null); if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { setSelected(null); if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const handleToggleFestivo = (fecha: string) => {
    const yaEsFestivo = festivos.has(fecha)
    if (yaEsFestivo) {
      setFestivos(prev => { const n = new Set(prev); n.delete(fecha); return n })
      setAsignaciones(prev => { const n = { ...prev }; delete n[fecha]; return n })
      return
    }

    const dow = new Date(fecha + 'T12:00:00').getDay()

    // Mar, Mié, Jue → necesita diálogo de asignación
    if (dow >= 2 && dow <= 4) {
      const dayNum = parseInt(fecha.split('-')[2])
      const semOrdenadas = [...semanas].sort((a, b) => a.si - b.si)
      const prev = [...semOrdenadas].reverse().find(s =>
        Math.max(...s.dias.map(d => parseInt(d.split('-')[2]))) < dayNum
      ) ?? null
      const next = semOrdenadas.find(s =>
        Math.min(...s.dias.map(d => parseInt(d.split('-')[2]))) > dayNum
      ) ?? null
      // Marcar como festivo primero (muestra punto amarillo), luego pedir asignación
      setFestivos(prev2 => { const n = new Set(prev2); n.add(fecha); return n })
      setPendingFestivo({ fecha, prev, next })
      return
    }

    // Lun, Vie, y cualquier otro: auto-asigna al fin de semana más cercano (generarCalendario lo maneja)
    setFestivos(prev => { const n = new Set(prev); n.add(fecha); return n })
  }

  const confirmarAsignacion = (siNum: number) => {
    if (!pendingFestivo) return
    setAsignaciones(prev => ({ ...prev, [pendingFestivo.fecha]: siNum }))
    setPendingFestivo(null)
  }

  const reabrirDialogo = (dia: DiaInfo) => {
    const dayNum = dia.dia
    const semOrdenadas = [...semanas].sort((a, b) => a.si - b.si)
    const prev = [...semOrdenadas].reverse().find(s =>
      Math.max(...s.dias.map(d => parseInt(d.split('-')[2]))) < dayNum
    ) ?? null
    const next = semOrdenadas.find(s =>
      Math.min(...s.dias.map(d => parseInt(d.split('-')[2]))) > dayNum
    ) ?? null
    setPendingFestivo({ fecha: dia.fecha, prev, next })
  }

  const firstDow = new Date(year, month, 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1
  const selectedDia = selected ? dias.find(d => d.fecha === selected) : null

  return (
    <div>
      {/* Header mes */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="text-center">
          <p className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: '#CDA52F' }}>{MESES[month]}</p>
          <div className="flex items-center justify-center gap-3 mt-0.5">
            <span className="text-[10px] text-white/25">{year}</span>
            <span className="text-[10px] text-white/15">·</span>
            <span className="text-[10px] text-[#CDA52F] font-bold">{semanas.length} semanas</span>
          </div>
        </div>
        <button onClick={nextMonth} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Headers de días */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5 mb-0.5 sm:mb-1.5">
        {DIAS_HEADER.map((d, i) => (
          <div key={`${d}-${i}`} className={`text-center text-[9px] sm:text-[10px] font-bold tracking-wider py-1.5 sm:py-2 rounded-md sm:rounded-lg
            ${i >= 5 ? 'text-[#CDA52F]/60' : 'text-white/20'}`}>
            <span className="sm:hidden">{d}</span>
            <span className="hidden sm:inline">{DIAS_HEADER_LG[i]}</span>
          </div>
        ))}
      </div>

      {/* Grilla del calendario */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
        {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} />)}

        {dias.map(d => {
          const isToday = d.fecha === hoyStr
          const isSel = d.fecha === selected

          return (
            <button key={d.fecha} onClick={() => setSelected(isSel ? null : d.fecha)}
              className={`group relative rounded-lg sm:rounded-2xl transition-all duration-200 overflow-hidden aspect-square sm:aspect-auto sm:min-h-[72px]
                ${isSel
                  ? 'ring-2 ring-[#CDA52F] bg-[#CDA52F]/10 scale-[1.03] z-10'
                  : isToday
                    ? 'ring-1 ring-[#CDA52F]/50 bg-[#CDA52F]/5'
                    : d.abre
                      ? 'bg-white/[0.03] border border-white/[0.06]'
                      : d.needsAssignment
                        ? 'border border-[#FFE66D]/20 bg-[#FFE66D]/5'
                        : 'border border-transparent'
                }`}
            >
              {d.abre && <div className={`h-[2px] w-full ${isSel ? 'bg-[#CDA52F]' : 'bg-[#CDA52F]/30'}`} />}

              <div className="flex flex-col items-center justify-center py-1 sm:py-2 px-0.5">
                <span className={`text-xs sm:text-base font-bold leading-none
                  ${isSel ? 'text-[#CDA52F]' : isToday ? 'text-[#CDA52F]' : d.abre ? 'text-white/90' : d.needsAssignment ? 'text-[#FFE66D]/60' : 'text-white/15'}`}>
                  {d.dia}
                </span>
                {d.abre && (
                  <span className={`text-[6px] sm:text-[8px] font-bold mt-0.5 sm:mt-1.5 px-1 sm:px-2 py-px sm:py-0.5 rounded-full
                    ${isSel ? 'bg-[#CDA52F]/25 text-[#CDA52F]' : 'text-[#4ECDC4]/60 sm:bg-[#4ECDC4]/10 sm:text-[#4ECDC4]/70'}`}>
                    {d.siLabel}
                  </span>
                )}
                {d.needsAssignment && (
                  <span className="text-[8px] font-bold mt-0.5" style={{ color: 'rgba(255,230,109,0.5)' }}>?</span>
                )}
              </div>

              {d.festivo && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#FFE66D]" />}
              {isToday && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#CDA52F]" />}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-center gap-4 text-[9px] text-white/25 mt-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#CDA52F]/20 border border-[#CDA52F]/40" /> Abre</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#FFE66D]" /> Festivo</span>
        <span className="flex items-center gap-1"><span className="text-[#FFE66D]/50 font-bold">?</span> Sin asignar</span>
      </div>

      {/* Diálogo asignación festivo mid-semana */}
      {pendingFestivo && (
        <div className="mt-3 rounded-xl p-4" style={{ border: '1px solid rgba(255,230,109,0.2)', background: 'rgba(255,230,109,0.04)' }}>
          <p className="text-xs font-bold mb-0.5" style={{ color: '#FFE66D' }}>¿A qué semana pertenece este festivo?</p>
          <p className="text-[10px] text-white/35 mb-3 capitalize">
            {new Date(pendingFestivo.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="flex gap-2">
            {pendingFestivo.prev && (
              <button onClick={() => confirmarAsignacion(pendingFestivo.prev!.si)}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(78,205,196,0.08)', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.2)' }}>
                {pendingFestivo.prev.label}
                <span className="block font-normal text-[9px] mt-0.5 opacity-60">{pendingFestivo.prev.rango}</span>
              </button>
            )}
            {pendingFestivo.next && (
              <button onClick={() => confirmarAsignacion(pendingFestivo.next!.si)}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(78,205,196,0.08)', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.2)' }}>
                {pendingFestivo.next.label}
                <span className="block font-normal text-[9px] mt-0.5 opacity-60">{pendingFestivo.next.rango}</span>
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setFestivos(prev => { const n = new Set(prev); n.delete(pendingFestivo.fecha); return n })
              setPendingFestivo(null)
            }}
            className="mt-2 w-full text-[10px] text-white/20 hover:text-white/40 transition py-1">
            Cancelar
          </button>
        </div>
      )}

      {/* Detalle día seleccionado */}
      {selectedDia && !pendingFestivo && (
        <Card className="mt-3 border-[#CDA52F]/15">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-extrabold
                ${selectedDia.abre ? 'bg-[#CDA52F]/15 text-[#CDA52F]' : 'bg-white/5 text-white/20'}`}>
                {selectedDia.dia}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-white capitalize">
                  {new Date(selectedDia.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
                {selectedDia.abre && <p className="text-[10px] font-bold" style={{ color: '#4ECDC4' }}>{selectedDia.siLabel}</p>}
                {selectedDia.needsAssignment && <p className="text-[10px] font-bold" style={{ color: 'rgba(255,230,109,0.6)' }}>Sin asignar</p>}
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/30">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Abre', value: selectedDia.abre ? 'SI' : 'NO', color: selectedDia.abre ? '#4ECDC4' : '' },
              { label: 'Festivo', value: selectedDia.festivo ? 'SI' : 'NO', color: selectedDia.festivo ? '#FFE66D' : '' },
              { label: 'Semana', value: selectedDia.abre ? selectedDia.siLabel : '—', color: selectedDia.abre ? '#CDA52F' : '' },
            ].map(item => (
              <div key={item.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-[8px] sm:text-[10px] text-white/25 uppercase">{item.label}</p>
                <p className="text-sm font-extrabold" style={{ color: item.color || 'rgba(255,255,255,0.4)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Botón festivo: oculto solo para Sáb y Dom */}
          {(() => {
            const dow = new Date(selectedDia.fecha + 'T12:00:00').getDay()
            if (dow === 6 || dow === 0) return null

            if (selectedDia.needsAssignment) {
              return (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => reabrirDialogo(selectedDia)}
                    className="flex-1 py-2 rounded-lg text-[11px] font-semibold"
                    style={{ background: 'rgba(255,230,109,0.08)', color: 'rgba(255,230,109,0.7)', border: '1px solid rgba(255,230,109,0.2)' }}>
                    Asignar semana
                  </button>
                  <button
                    onClick={() => handleToggleFestivo(selectedDia.fecha)}
                    className="px-3 py-2 rounded-lg text-[11px] font-semibold"
                    style={{ background: 'rgba(255,80,80,0.07)', color: 'rgba(255,80,80,0.5)', border: '1px solid rgba(255,80,80,0.15)' }}>
                    Quitar
                  </button>
                </div>
              )
            }

            return (
              <button
                onClick={() => handleToggleFestivo(selectedDia.fecha)}
                className="mt-2 w-full py-2 rounded-lg text-[11px] font-semibold transition-all"
                style={selectedDia.festivo
                  ? { background: 'rgba(255,230,109,0.10)', color: '#FFE66D', border: '1px solid rgba(255,230,109,0.25)' }
                  : { background: 'rgba(255,230,109,0.07)', color: 'rgba(255,230,109,0.55)', border: '1px solid rgba(255,230,109,0.22)' }
                }>
                {selectedDia.festivo ? 'Quitar festivo' : 'Marcar como festivo'}
              </button>
            )
          })()}
        </Card>
      )}
    </div>
  )
}
