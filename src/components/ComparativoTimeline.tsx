import { useMemo, useState } from 'react'
import type { Comparativo, LineaComparativo } from '../types'

interface Props {
  comparativos: Comparativo[]
  onSelectFecha?: (fecha: string) => void
}

type MetricType = 'conteo' | 'tiquets' | 'diferencia' | 'all'

const METRIC_LABELS: Record<MetricType, string> = {
  conteo: 'Venta Conteo',
  tiquets: 'Venta Tiquets',
  diferencia: 'Diferencia',
  all: 'Todas',
}

function formatearFechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-')
  return `${d}/${m}`
}

function formatearFechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${meses[parseInt(m, 10) - 1]}, ${y}`
}

export default function ComparativoTimeline({ comparativos, onSelectFecha }: Props) {
  const [metric, setMetric] = useState<MetricType>('all')
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const sorted = useMemo(() => {
    return [...comparativos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [comparativos])

  // Si no hay rango seleccionado, se muestra todo el histórico.
  // Al elegir fechas, se filtra y todo lo de abajo (totales, gráfico) se recalcula solo.
  const filtrados = useMemo(() => {
    if (!fechaDesde && !fechaHasta) return sorted
    return sorted.filter(c => {
      if (fechaDesde && c.fecha < fechaDesde) return false
      if (fechaHasta && c.fecha > fechaHasta) return false
      return true
    })
  }, [sorted, fechaDesde, fechaHasta])

  const hayRango = Boolean(fechaDesde || fechaHasta)

  const maxValues = useMemo(() => {
    if (filtrados.length === 0) return { conteo: 1, tiquets: 1, diferencia: 1 }
    return {
      conteo: Math.max(...filtrados.map(c => c.totalConteo || 0), 1),
      tiquets: Math.max(...filtrados.map(c => c.totalTiquets || 0), 1),
      diferencia: Math.max(...filtrados.map(c => Math.abs(c.totalDiferencia || 0)), 1),
    }
  }, [filtrados])

  const totals = useMemo(() => {
    return filtrados.reduce(
      (acc, c) => ({
        conteo: acc.conteo + (c.totalConteo || 0),
        tiquets: acc.tiquets + (c.totalTiquets || 0),
        diferencia: acc.diferencia + (c.totalDiferencia || 0),
      }),
      { conteo: 0, tiquets: 0, diferencia: 0 }
    )
  }, [filtrados])

  const handleSelect = (fecha: string) => {
    setSelectedFecha(prev => prev === fecha ? null : fecha)
    onSelectFecha?.(fecha)
  }

  const limpiarRango = () => {
    setFechaDesde('')
    setFechaHasta('')
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-[#141414] border border-white/[0.07] rounded-xl p-8 text-center">
        <p className="text-white/40 text-sm">No hay comparativos registrados aún.</p>
        <p className="text-white/20 text-xs mt-1">Importa o crea comparativos para ver la línea de tiempo.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#141414] border border-white/[0.07] rounded-xl p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Línea de Tiempo de Ventas</h3>
          <p className="text-xs text-white/40 mt-0.5">
            {hayRango
              ? `${filtrados.length} día${filtrados.length !== 1 ? 's' : ''} en el rango seleccionado`
              : `${filtrados.length} día${filtrados.length !== 1 ? 's' : ''} registrado${filtrados.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 self-start">
          {(Object.keys(METRIC_LABELS) as MetricType[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                metric === m
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de rango de fechas */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-lg focus-within:border-[#D4AF37]/50 transition-colors">
          <input
            type="date"
            value={fechaDesde}
            max={fechaHasta || undefined}
            onChange={(e) => setFechaDesde(e.target.value)}
            aria-label="Fecha desde"
            className="bg-transparent px-2 py-1.5 text-[11px] sm:text-xs text-white/80 outline-none focus:text-white w-[115px] sm:w-[130px] border-none [color-scheme:dark]"
          />
          <span className="text-white/30 text-xs select-none">→</span>
          <input
            type="date"
            value={fechaHasta}
            min={fechaDesde || undefined}
            onChange={(e) => setFechaHasta(e.target.value)}
            aria-label="Fecha hasta"
            className="bg-transparent px-2 py-1.5 text-[11px] sm:text-xs text-white/80 outline-none focus:text-white w-[115px] sm:w-[130px] border-none [color-scheme:dark]"
          />
        </div>
        {hayRango && (
          <button
            onClick={limpiarRango}
            className="text-[11px] text-white/40 hover:text-[#D4AF37] transition-colors px-2 py-1"
          >
            Limpiar rango
          </button>
        )}
      </div>

      {/* Resumen de totales — se recalcula solo con el rango activo */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-3 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
          <p className="text-[10px] text-white/50 uppercase tracking-wider">Total Conteo</p>
          <p className="text-xl font-bold text-[#4ECDC4] mt-1">
            {totals.conteo.toLocaleString()}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20">
          <p className="text-[10px] text-white/50 uppercase tracking-wider">Total Tiquets</p>
          <p className="text-xl font-bold text-[#D4AF37] mt-1">
            {totals.tiquets.toLocaleString()}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[#FF5050]/10 border border-[#FF5050]/20">
          <p className="text-[10px] text-white/50 uppercase tracking-wider">Diferencia Total</p>
          <p className={`text-xl font-bold mt-1 ${totals.diferencia >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
            {totals.diferencia >= 0 ? '+' : ''}{totals.diferencia.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Gráfico de barras */}
      {filtrados.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-white/40 text-sm">No hay comparativos en ese rango de fechas.</p>
          <button
            onClick={limpiarRango}
            className="text-[11px] text-[#D4AF37] hover:text-[#D4AF37]/80 mt-2 transition-colors"
          >
            Ver todo el histórico
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-0 right-0 bottom-8 h-px bg-white/10" />

          <div className="flex items-end gap-2 overflow-x-auto pb-2 pt-4 px-1">
            {filtrados.map((comp) => {
              const isSelected = selectedFecha === comp.fecha
              const conteoH = Math.max((comp.totalConteo || 0) / maxValues.conteo * 100, 2)
              const tiquetsH = Math.max((comp.totalTiquets || 0) / maxValues.tiquets * 100, 2)
              const difRaw = comp.totalDiferencia || 0
              const difH = difRaw === 0 ? 0 : Math.max(Math.abs(difRaw) / maxValues.diferencia * 100, 3)

              return (
                <div
                  key={comp.fecha}
                  className={`relative flex flex-col items-center gap-1 min-w-[56px] cursor-pointer group ${
                    isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                  }`}
                  onClick={() => handleSelect(comp.fecha)}
                >
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-24 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2.5 text-[10px] whitespace-nowrap z-20 pointer-events-none shadow-xl">
                    <p className="text-white font-medium mb-1.5 border-b border-white/[0.1] pb-1">{formatearFechaLarga(comp.fecha)}</p>
                    <div className="space-y-0.5">
                      <p className="text-[#4ECDC4]">Conteo: {(comp.totalConteo || 0).toLocaleString()}</p>
                      <p className="text-[#D4AF37]">Tiquets: {(comp.totalTiquets || 0).toLocaleString()}</p>
                      <p className={difRaw >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}>
                        Dif: {difRaw >= 0 ? '+' : ''}{difRaw.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Barras */}
                  <div className="flex items-end gap-0.5 h-32">
                    {(metric === 'all' || metric === 'conteo') && (
                      <div
                        className="w-3.5 rounded-t-sm bg-[#4ECDC4] transition-all duration-500"
                        style={{ height: `${conteoH}%` }}
                      />
                    )}
                    {(metric === 'all' || metric === 'tiquets') && (
                      <div
                        className="w-3.5 rounded-t-sm bg-[#D4AF37] transition-all duration-500"
                        style={{ height: `${tiquetsH}%` }}
                      />
                    )}
                    {(metric === 'all' || metric === 'diferencia') && (
                      <div
                        className={`w-3.5 rounded-t-sm transition-all duration-500 ${
                          difRaw >= 0 ? 'bg-[#4ECDC4]' : 'bg-[#FF5050]'
                        }`}
                        style={{ height: `${difH}%`, opacity: difRaw === 0 ? 0.3 : 1 }}
                      />
                    )}
                  </div>

                  {/* Fecha */}
                  <span className={`text-[10px] mt-1 transition-colors ${
                    isSelected ? 'text-[#D4AF37] font-medium' : 'text-white/40'
                  }`}>
                    {formatearFechaCorta(comp.fecha)}
                  </span>

                  {/* Indicador */}
                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5 transition-all ${
                    isSelected ? 'bg-[#D4AF37] scale-125' : 'bg-transparent'
                  }`} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/[0.05] flex-wrap">
        {(metric === 'all' || metric === 'conteo') && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#4ECDC4]" />
            <span className="text-[10px] text-white/50">Venta Conteo</span>
          </div>
        )}
        {(metric === 'all' || metric === 'tiquets') && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#D4AF37]" />
            <span className="text-[10px] text-white/50">Venta Tiquets</span>
          </div>
        )}
        {(metric === 'all' || metric === 'diferencia') && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#FF5050]" />
            <span className="text-[10px] text-white/50">Diferencia</span>
          </div>
        )}
      </div>

      {/* Detalle del día seleccionado (solo si sigue visible dentro del rango filtrado) */}
      {selectedFecha && filtrados.some(c => c.fecha === selectedFecha) && (
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          {(() => {
            const comp = filtrados.find(c => c.fecha === selectedFecha)
            if (!comp) return null
            const difTotal = comp.totalDiferencia || 0
            const lineas = (comp.lineas || []).slice().sort((a, b) => (b.tiquets || 0) - (a.tiquets || 0))

            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white">{formatearFechaLarga(comp.fecha)}</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-white/50">
                      {lineas.length} producto{lineas.length !== 1 ? 's' : ''}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      difTotal === 0
                        ? 'bg-white/[0.05] text-white/40'
                        : difTotal > 0
                          ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]'
                          : 'bg-[#FF5050]/10 text-[#FF5050]'
                    }`}>
                      Diferencia: {difTotal >= 0 ? '+' : ''}{difTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Header columnas */}
                <div className="flex items-center justify-between py-1.5 px-2 text-[10px] text-white/30 uppercase tracking-wider border-b border-white/[0.05] mb-1">
                  <span className="flex-1">Producto</span>
                  <span className="w-12 text-right">Conteo</span>
                  <span className="w-12 text-right">Tiquets</span>
                  <span className="w-14 text-right">Dif.</span>
                </div>

                <div className="space-y-0.5 max-h-60 overflow-auto">
                  {lineas.map((linea, i) => {
                    const dif = typeof linea.diferencia === 'number' ? linea.diferencia : (linea.tiquets || 0) - (linea.conteo || 0)
                    return (
                      <div
                        key={`${comp.fecha}-${linea.productoId || i}`}
                        className="flex items-center justify-between py-2 px-2 rounded hover:bg-white/[0.03] text-[11px] transition-colors"
                      >
                        <span className="text-white/70 truncate flex-1 pr-3" title={linea.nombre}>
                          {linea.nombre}
                        </span>
                        <span className="text-[#4ECDC4] w-12 text-right font-mono">
                          {(linea.conteo || 0).toLocaleString()}
                        </span>
                        <span className="text-[#D4AF37] w-12 text-right font-mono">
                          {(linea.tiquets || 0).toLocaleString()}
                        </span>
                        <span className={`w-14 text-right font-mono font-medium ${
                          dif === 0 ? 'text-white/30' : dif > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'
                        }`}>
                          {dif > 0 ? '+' : ''}{dif.toLocaleString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}