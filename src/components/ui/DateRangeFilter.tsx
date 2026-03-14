interface DateRangeFilterProps {
  desde: string
  hasta: string
  setDesde: (v: string) => void
  setHasta: (v: string) => void
  total: number
  filtrados: number
}

export function DateRangeFilter({ desde, hasta, setDesde, setHasta, total, filtrados }: DateRangeFilterProps) {
  const hayFiltro = desde || hasta
  return (
    <div className="flex flex-wrap items-end gap-2 sm:gap-3">
      <div className="flex gap-2">
        <div>
          <span className="text-[10px] text-white/35 font-medium block mb-1">Desde</span>
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="bg-transparent px-2 py-1.5 text-[11px] sm:text-xs text-white/80 focus:outline-none focus:text-white w-[115px] sm:w-[130px] border-none" />
          </div>
        </div>
        <div>
          <span className="text-[10px] text-white/35 font-medium block mb-1">Hasta</span>
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="bg-transparent px-2 py-1.5 text-[11px] sm:text-xs text-white/80 focus:outline-none focus:text-white w-[115px] sm:w-[130px] border-none" />
          </div>
        </div>
      </div>
      {hayFiltro && (
        <div className="flex items-center gap-2 pb-1">
          <span className="text-[10px] text-white/30 tabular-nums">{filtrados}/{total}</span>
          <button onClick={() => { setDesde(''); setHasta('') }}
            className="flex items-center gap-1 text-[10px] text-[#CDA52F]/70 hover:text-[#CDA52F] transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
            </svg>
            Limpiar
          </button>
        </div>
      )}
    </div>
  )
}
