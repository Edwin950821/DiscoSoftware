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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-0 rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-r border-white/[0.06]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(205,165,47,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="text-[10px] text-white/30 font-medium">Desde</span>
        </div>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
          className="bg-transparent px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:text-white w-[120px] border-none" />
        <div className="w-px h-5 bg-white/[0.08]" />
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-r border-white/[0.06]">
          <span className="text-[10px] text-white/30 font-medium">Hasta</span>
        </div>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
          className="bg-transparent px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:text-white w-[120px] border-none" />
      </div>
      {hayFiltro && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 tabular-nums">{filtrados} de {total}</span>
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
