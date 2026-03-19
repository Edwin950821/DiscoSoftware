import { useState, useMemo } from 'react'
import { Card } from './ui/Card'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_HEADER = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DIAS_HEADER_LG = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

interface DiaInfo {
  fecha: string
  dia: number
  abre: boolean
  sesion: string
  festivo: boolean
  acumulado: number
}

function generarDiasMes(year: number, month: number, festivos: Set<string>): DiaInfo[] {
  const dias: DiaInfo[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let acumulado = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay()
    const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const esFestivo = festivos.has(fechaStr)
    const abre = esFestivo || dow === 6 || dow === 0 || dow === 1
    if (abre) acumulado++
    dias.push({ fecha: fechaStr, dia: d, abre, sesion: abre ? `SI-${acumulado}` : '', festivo: esFestivo, acumulado })
  }
  return dias
}

export default function Jornadas() {
  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]
  const [year, setYear] = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth())
  const [festivos, setFestivos] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)

  const dias = useMemo(() => generarDiasMes(year, month, festivos), [year, month, festivos])
  const diasAbiertos = dias.filter(d => d.abre).length

  const toggleFestivo = (fecha: string) => {
    setFestivos(prev => {
      const next = new Set(prev)
      if (next.has(fecha)) next.delete(fecha); else next.add(fecha)
      return next
    })
  }

  const prevMonth = () => { setSelected(null); if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { setSelected(null); if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const firstDow = new Date(year, month, 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1
  const selectedDia = selected ? dias.find(d => d.fecha === selected) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="text-center">
          <p className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: '#CDA52F' }}>{MESES[month]}</p>
          <div className="flex items-center justify-center gap-3 mt-0.5">
            <span className="text-[10px] text-white/25">{year}</span>
            <span className="text-[10px] text-white/15">·</span>
            <span className="text-[10px] text-[#CDA52F] font-bold">{diasAbiertos} dias</span>
          </div>
        </div>
        <button onClick={nextMonth} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5 mb-0.5 sm:mb-1.5">
        {DIAS_HEADER.map((d, i) => (
          <div key={`${d}-${i}`} className={`text-center text-[9px] sm:text-[10px] font-bold tracking-wider py-1.5 sm:py-2 rounded-md sm:rounded-lg
            ${i >= 5 ? 'text-[#CDA52F]/60' : 'text-white/20'}`}>
            <span className="sm:hidden">{d}</span>
            <span className="hidden sm:inline">{DIAS_HEADER_LG[i]}</span>
          </div>
        ))}
      </div>

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
                      : 'border border-transparent'
                }`}
            >
              {d.abre && <div className={`h-[2px] w-full ${isSel ? 'bg-[#CDA52F]' : 'bg-[#CDA52F]/30'}`} />}

              <div className="flex flex-col items-center justify-center py-1 sm:py-2 px-0.5">
                <span className={`text-xs sm:text-base font-bold leading-none
                  ${isSel ? 'text-[#CDA52F]' : isToday ? 'text-[#CDA52F]' : d.abre ? 'text-white/90' : 'text-white/15'}`}>
                  {d.dia}
                </span>

                {d.abre && (
                  <span className={`text-[6px] sm:text-[8px] font-bold mt-0.5 sm:mt-1.5 px-1 sm:px-2 py-px sm:py-0.5 rounded-full
                    ${isSel ? 'bg-[#CDA52F]/25 text-[#CDA52F]' : 'text-[#4ECDC4]/60 sm:bg-[#4ECDC4]/10 sm:text-[#4ECDC4]/70'}`}>
                    {d.sesion}
                  </span>
                )}
              </div>

              {d.festivo && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#FFE66D]" />}
              {isToday && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#CDA52F]" />}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-4 text-[9px] text-white/25 mt-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#CDA52F]/20 border border-[#CDA52F]/40" /> Abre</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#FFE66D]" /> Festivo</span>
      </div>

      {selectedDia && (
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
                {selectedDia.abre && <p className="text-[10px] text-[#4ECDC4] font-bold">{selectedDia.sesion}</p>}
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/30">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Abre', value: selectedDia.abre ? 'SI' : 'NO', color: selectedDia.abre ? '#4ECDC4' : '' },
              { label: 'Festivo', value: selectedDia.festivo ? 'SI' : 'NO', color: selectedDia.festivo ? '#FFE66D' : '' },
              { label: 'Sesion', value: selectedDia.abre ? selectedDia.sesion : '—', color: selectedDia.abre ? '#CDA52F' : '' },
              { label: 'Acum.', value: String(selectedDia.acumulado), color: '' },
            ].map(item => (
              <div key={item.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-[8px] sm:text-[10px] text-white/25 uppercase">{item.label}</p>
                <p className="text-sm font-extrabold" style={{ color: item.color || 'rgba(255,255,255,0.4)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {(() => {
            const dow = new Date(selectedDia.fecha + 'T12:00:00').getDay()
            if (dow === 6 || dow === 0 || dow === 1) return null
            return (
              <button onClick={() => toggleFestivo(selectedDia.fecha)}
                className={`mt-2 w-full py-2 rounded-lg text-[11px] font-semibold transition-all
                  ${selectedDia.festivo
                    ? 'bg-[#FFE66D]/10 text-[#FFE66D] border border-[#FFE66D]/20'
                    : 'bg-white/5 text-white/30 border border-white/[0.07]'
                  }`}>
                {selectedDia.festivo ? 'Quitar festivo' : 'Marcar como festivo'}
              </button>
            )
          })()}
        </Card>
      )}
    </div>
  )
}
