import { useState, useEffect } from 'react'
import { Card } from './ui/Card'
import { DateRangeFilter } from './ui/DateRangeFilter'
import { fmtCOP } from '../lib/utils'
import { useConsolidado } from '../hooks/useConsolidado'
import type { NegocioInfo, RangoTemporal } from '../types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts'

type FiltroSeleccion = { tipo: 'TODOS' } | { negocioId: string }

const COLORES_PAGO: Record<string, string> = {
  Efectivo: '#FF6B35',
  QR: '#4ECDC4',
  Nequi: '#FFE66D',
  Datafono: '#A8E6CF',
  Vales: '#C3B1E1',
}

interface Props {
  onSelectNegocio?: (id: string, nombre: string, slug: string, color: string) => void
  negocios?: NegocioInfo[]
}

export default function DashboardConsolidado({ onSelectNegocio, negocios = [] }: Props = {}) {
  const [filtro, setFiltro] = useState<FiltroSeleccion>({ tipo: 'TODOS' })
  const [rango, setRango] = useState<RangoTemporal>('MES_ACTUAL')
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const isTodos = 'tipo' in filtro && filtro.tipo === 'TODOS'
  const isNegocio = (id: string) => 'negocioId' in filtro && filtro.negocioId === id

  const rangoInvalido = rango === 'PERSONALIZADO' && !!fechaDesde && !!fechaHasta && fechaDesde > fechaHasta
  const personalizadoIncompleto = rango === 'PERSONALIZADO' && (!fechaDesde || !fechaHasta)

  const { data, loading, error, recargar } = useConsolidado(
    'tipo' in filtro
      ? { tipo: 'TODOS', rango, fechaDesde: rangoInvalido ? '' : fechaDesde, fechaHasta: rangoInvalido ? '' : fechaHasta }
      : { negocioId: filtro.negocioId, rango, fechaDesde: rangoInvalido ? '' : fechaDesde, fechaHasta: rangoInvalido ? '' : fechaHasta }
  )

  const tituloVista = isTodos
    ? 'Vista Consolidada'
    : (negocios.find(n => 'negocioId' in filtro && n.id === filtro.negocioId)?.nombre ?? 'Negocio')

  const Header = (
    <div>
      <h1 className="text-2xl font-bold text-white">{tituloVista}</h1>
      {data && (
        <p className="text-sm text-white/40 mt-1">
          {data.negociosCount} negocio(s) · {data.jornadasCount} jornada(s) {rango === 'TODO' ? 'registrada(s)' : 'en el periodo'}
        </p>
      )}
      <div className="flex gap-1 mt-4 bg-white/5 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
        <FiltroTab
          label="Todos"
          active={isTodos}
          onClick={() => setFiltro({ tipo: 'TODOS' })}
        />
        {negocios.map(n => (
          <FiltroTab
            key={n.id}
            label={n.nombre}
            active={isNegocio(n.id)}
            onClick={() => setFiltro({ negocioId: n.id })}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-white/30">Periodo:</span>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1 overflow-x-auto">
          <RangoTab label="Hoy"          active={rango === 'HOY'}           onClick={() => setRango('HOY')} />
          <RangoTab label="7d"           active={rango === '7D'}            onClick={() => setRango('7D')} />
          <RangoTab label="30d"          active={rango === '30D'}           onClick={() => setRango('30D')} />
          <RangoTab label="Este mes"     active={rango === 'MES_ACTUAL'}    onClick={() => setRango('MES_ACTUAL')} />
          <RangoTab label="Este año"     active={rango === 'ESTE_ANO'}      onClick={() => setRango('ESTE_ANO')} />
          <RangoTab label="Todo"         active={rango === 'TODO'}          onClick={() => setRango('TODO')} />
          <RangoTab label="Personalizado" active={rango === 'PERSONALIZADO'} onClick={() => setRango('PERSONALIZADO')} />
        </div>
      </div>
      {rango === 'PERSONALIZADO' && (
        <div className="mt-3">
          <DateRangeFilter
            desde={fechaDesde}
            hasta={fechaHasta}
            setDesde={setFechaDesde}
            setHasta={setFechaHasta}
            total={data?.jornadasCount ?? 0}
            filtrados={data?.jornadasCount ?? 0}
          />
          {personalizadoIncompleto && (
            <p className="text-[10px] text-white/40 mt-2">Selecciona fecha desde y hasta para cargar el consolidado.</p>
          )}
          {rangoInvalido && (
            <p className="text-[10px] text-[#FF5050] mt-2">La fecha "Desde" no puede ser posterior a "Hasta".</p>
          )}
        </div>
      )}
    </div>
  )

  if (rango === 'PERSONALIZADO' && (personalizadoIncompleto || rangoInvalido)) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="flex flex-col items-center justify-center h-[40vh] text-center px-6">
          <p className="text-white/60 text-sm font-medium">
            {rangoInvalido ? 'Rango de fechas inválido' : 'Selecciona un rango de fechas'}
          </p>
          <p className="text-white/30 text-xs mt-2">
            {rangoInvalido
              ? 'La fecha "Desde" no puede ser posterior a "Hasta".'
              : 'Elige fecha desde y fecha hasta arriba para ver el consolidado.'}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="flex flex-col items-center justify-center h-[40vh]">
          <img src="/assets/M02.png" alt="" className="w-12 h-12 animate-pulse opacity-50" />
          <p className="text-white/40 text-xs mt-3 tracking-widest uppercase">Cargando consolidado...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="flex flex-col items-center justify-center h-[40vh] text-center px-6">
          <p className="text-[#FF5050] text-sm font-medium">No se pudo cargar el consolidado</p>
          <p className="text-white/30 text-xs mt-2">{error ?? 'Sin datos'}</p>
          <button onClick={recargar} className="mt-5 px-4 py-2 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium hover:bg-[#D4AF37]/25 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (data.negociosCount === 0) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="flex flex-col items-center justify-center h-[40vh] text-center">
          <p className="text-white/60 text-sm font-medium">Sin negocios activos</p>
          <p className="text-white/30 text-xs mt-2">
            {isTodos
              ? 'Crea al menos un negocio para ver el consolidado'
              : 'Este negocio no tiene datos. Cambia el filtro arriba.'}
          </p>
        </div>
      </div>
    )
  }

  // Empty state: hay negocios pero ninguna jornada en el rango filtrado
  if (data.jornadasCount === 0 && rango !== 'TODO') {
    const rangoLabel: Record<RangoTemporal, string> = {
      'HOY': 'hoy',
      '7D': 'los últimos 7 días',
      '30D': 'los últimos 30 días',
      'MES_ACTUAL': 'este mes',
      'ESTE_ANO': 'este año',
      'TODO': '',
      'PERSONALIZADO': `el rango ${fechaDesde} → ${fechaHasta}`,
    }
    return (
      <div className="space-y-6">
        {Header}
        <div className="flex flex-col items-center justify-center h-[40vh] text-center px-6">
          <p className="text-white/60 text-sm font-medium">Sin actividad en el periodo</p>
          <p className="text-white/30 text-xs mt-2">No hay jornadas registradas para {rangoLabel[rango]}.</p>
          <p className="text-white/30 text-xs mt-1">Cambia el periodo arriba o selecciona "Todo".</p>
        </div>
      </div>
    )
  }

  const chartData = data.porNegocio.map(n => ({
    nombre: n.nombre,
    Vendido: n.totalVendido,
    Recibido: n.totalRecibido,
  }))

  const fade = (i: number) => ({
    animation: `disco-fadeup 0.25s ease-out both`,
    animationDelay: `${Math.min(i, 7) * 30}ms`,
  } as React.CSSProperties)

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes disco-fadeup {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={fade(0)}>{Header}</div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={fade(1)}>
        <KpiCard label="Total Vendido" value={fmtCOP(data.totalVendido)} color="#D4AF37" />
        <KpiCard label="Total Recibido" value={fmtCOP(data.totalRecibido)} color="#4ECDC4" />
        <KpiCard label="Cortesías + Gastos" value={fmtCOP(data.totalCortesias + data.totalGastos)} color="#FFE66D" />
        <KpiCard label="Saldo Global" value={fmtCOP(data.totalSaldo)} color={data.totalSaldo >= 0 ? '#4ECDC4' : '#FF5050'} />
      </div>

      {(rango === 'TODO' || rango === 'MES_ACTUAL' || rango === 'ESTE_ANO') &&
       ((data.totalMesActual ?? 0) > 0 || (data.totalMesAnterior ?? 0) > 0) && (() => {
        const hoy = new Date()
        const nombreMes = (offset: number) => {
          const d = new Date(hoy.getFullYear(), hoy.getMonth() - offset, 1)
          return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
            .replace(/^\w/, c => c.toUpperCase())
        }
        return (
          <div style={fade(2)}>
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">Mes actual vs mes anterior</h3>
              <div className="grid grid-cols-2 gap-3">
                <MesKpi label={nombreMes(1)} valor={data.totalMesAnterior ?? 0} color="rgba(255,255,255,0.5)" />
                <MesKpiDelta label={nombreMes(0)} valor={data.totalMesActual ?? 0} anterior={data.totalMesAnterior ?? 0} />
              </div>
            </Card>
          </div>
        )
      })()}

      {chartData.length > 1 && (
      <div style={fade(3)}>
      <Card>
        <h3 className="text-sm font-semibold text-white mb-4">
          Comparativo por negocio <span className="text-white/30 font-normal text-xs">({chartData.length} negocios)</span>
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="nombre" stroke="rgba(255,255,255,0.4)" fontSize={11} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={(v) => fmtCOP(v)} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#fff', fontSize: 12 }}
                formatter={(v) => fmtCOP(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Bar dataKey="Vendido" fill="#D4AF37" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="Vendido" content={(props: any) => renderBarLabel(props, 'top', isMobile, '#D4AF37')} />
              </Bar>
              <Bar dataKey="Recibido" fill="#4ECDC4" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="Recibido" content={(props: any) => renderBarLabel(props, 'bottom', isMobile, '#4ECDC4')} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      </div>
      )}

      {data.pagosTotales && Object.values(data.pagosTotales).some(v => v > 0) && (
        <div style={fade(4)}>
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">
            Distribución de pagos {data.porNegocio.length > 1 ? '(todos los negocios)' : ''}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(data.pagosTotales)
                      .filter(([, v]) => v > 0)
                      .map(([medio, total]) => ({ medio, total }))}
                    dataKey="total"
                    nameKey="medio"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {Object.keys(data.pagosTotales)
                      .filter(k => (data.pagosTotales![k] ?? 0) > 0)
                      .map((k) => (
                        <Cell key={k} fill={COLORES_PAGO[k] ?? '#888'} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    formatter={(v) => fmtCOP(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center gap-2">
              {Object.entries(data.pagosTotales)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([medio, total]) => {
                  const pct = data.totalRecibido > 0 ? (total / data.totalRecibido) * 100 : 0
                  return (
                    <div key={medio} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03]">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORES_PAGO[medio] ?? '#888' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/80">{medio}</p>
                        <p className="text-[10px] text-white/40">{pct.toFixed(1)}% del total</p>
                      </div>
                      <p className="text-sm font-semibold text-white tabular-nums">{fmtCOP(total)}</p>
                    </div>
                  )
                })}
            </div>
          </div>
        </Card>
        </div>
      )}

      {/* Tendencia ultimos 30 dias */}
      {data.tendencia30Dias && data.tendencia30Dias.some(d => d.total > 0) && (
        <div style={fade(5)}>
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Tendencia últimos 30 días</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.tendencia30Dias} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="grad-tendencia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="fecha"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickFormatter={(d) => (typeof d === 'string' ? d.slice(5) : '')}
                />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={(v) => fmtCOP(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff', fontSize: 12 }}
                  formatter={(v) => fmtCOP(Number(v))}
                />
                <Area type="monotone" dataKey="total" stroke="#D4AF37" strokeWidth={2} fill="url(#grad-tendencia)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        </div>
      )}

      {/* Participación por negocio (donut) + Top productos lado a lado */}
      <div className={`grid grid-cols-1 ${data.porNegocio.length > 1 ? 'lg:grid-cols-2' : ''} gap-6`} style={fade(6)}>
        {data.porNegocio.length > 1 && data.totalVendido > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-white mb-4">Participación por negocio</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.porNegocio.map(n => ({ nombre: n.nombre, total: n.totalVendido, color: n.colorPrimario }))}
                      dataKey="total"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {data.porNegocio.map((n) => (
                        <Cell key={n.negocioId} fill={n.colorPrimario} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                      formatter={(v) => fmtCOP(Number(v))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {data.porNegocio.map(n => {
                  const pct = data.totalVendido > 0 ? (n.totalVendido / data.totalVendido) * 100 : 0
                  return (
                    <div key={n.negocioId} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03]">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: n.colorPrimario }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/80 truncate">{n.nombre}</p>
                        <p className="text-[10px] text-white/40">{pct.toFixed(1)}% del total</p>
                      </div>
                      <p className="text-sm font-semibold text-white tabular-nums">{fmtCOP(n.totalVendido)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {data.topProductos && data.topProductos.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-white mb-4">Top 5 productos</h3>
            <div className="space-y-2">
              {data.topProductos.map((p, i) => (
                <div key={p.productoId} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03]">
                  <span className="w-6 h-6 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[10px] font-bold text-[#D4AF37] shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{p.nombre}</p>
                    <p className="text-[10px] text-white/40">{p.cantidad} unid.</p>
                  </div>
                  <p className="text-xs font-semibold text-white tabular-nums">{fmtCOP(p.total)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {data.comparativoBarras && data.comparativoBarras.length > 0 && (
        <div style={fade(6)}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                {data.comparativoBarras.length === 1 ? 'Estadísticas de la Barra' : 'Comparativo de Barras'}
              </h3>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">
                {data.comparativoBarras.length} barra{data.comparativoBarras.length === 1 ? '' : 's'} · punto de venta principal
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.comparativoBarras.map((b, i) => {
                const sinBarra = b.totalVendido === 0
                return (
                <div key={b.negocioId} className={`p-4 rounded-lg bg-white/[0.03] border flex flex-col gap-3 ${
                  sinBarra ? 'border-[#FF5050]/20' : 'border-white/[0.07]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{ backgroundColor: '#C3B1E1' + '22', color: '#C3B1E1', border: '1px solid #C3B1E155' }}>
                      {sinBarra ? '–' : i + 1}
                    </span>
                    <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: b.negocioColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/90 font-medium truncate">{b.negocioNombre}</p>
                      <p className="text-[10px] text-white/40">{b.jornadasCount} jornada(s)</p>
                    </div>
                  </div>

                  {sinBarra ? (
                    <div className="py-3 text-center">
                      <p className="text-xs text-[#FF5050] font-medium">Sin Barra registrada</p>
                      <p className="text-[10px] text-white/40 mt-1">Crea un mesero llamado "Barra" en este negocio</p>
                    </div>
                  ) : (
                    <>
                  <div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: b.negocioColor }}>{fmtCOP(b.totalVendido)}</p>
                    <p className="text-[11px] text-white/50">
                      {b.pctDelNegocio.toFixed(1)}% del total del negocio
                    </p>
                  </div>

                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, b.pctDelNegocio)}%`, backgroundColor: b.negocioColor }}
                    />
                  </div>

                  {(() => {
                    const medios: { label: string; valor: number; color: string }[] = [
                      { label: 'Efectivo', valor: b.pagosEfectivo, color: '#FF6B35' },
                      { label: 'QR',       valor: b.pagosQR,       color: '#4ECDC4' },
                      { label: 'Nequi',    valor: b.pagosNequi,    color: '#FFE66D' },
                      { label: 'Datafono', valor: b.pagosDatafono, color: '#A8E6CF' },
                      { label: 'Vales',    valor: b.pagosVales,    color: '#C3B1E1' },
                    ].filter(m => m.valor > 0)
                    if (medios.length === 0) return null
                    return (
                      <div className={`grid gap-2 text-center pt-2 border-t border-white/[0.05] ${
                        medios.length === 1 ? 'grid-cols-1' :
                        medios.length === 2 ? 'grid-cols-2' :
                        medios.length === 3 ? 'grid-cols-3' :
                        medios.length === 4 ? 'grid-cols-4' : 'grid-cols-5'
                      }`}>
                        {medios.map(m => (
                          <div key={m.label}>
                            <p className="text-[9px] uppercase tracking-wider text-white/30">{m.label}</p>
                            <p className="text-[11px] font-semibold tabular-nums" style={{ color: m.color }}>{fmtCOP(m.valor)}</p>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                    </>
                  )}
                </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {data.topMeseros && data.topMeseros.length > 0 && (
        <div style={fade(6)}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Top 5 meseros</h3>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">excluye Barras</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {data.topMeseros.map((m, i) => (
                <div key={m.meseroId} className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: m.color + '22', color: m.color, border: `1px solid ${m.color}55` }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate font-medium">{m.nombre}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.negocioColor }} />
                      <p className="text-[10px] text-white/50 truncate">{m.negocioNombre}</p>
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5">{m.jornadasCount} jornada(s)</p>
                    <p className="text-[11px] font-semibold tabular-nums mt-0.5" style={{ color: m.color }}>{fmtCOP(m.totalVendido)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div style={fade(7)}>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Ranking de negocios</h3>
          {onSelectNegocio && (
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Clic para ver detalles</span>
          )}
        </div>
        <div className="space-y-2">
          {data.porNegocio.map((n, i) => {
            const clickable = !!onSelectNegocio
            const baseClasses = "flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] w-full text-left"
            const interactive = clickable ? "hover:bg-white/[0.06] hover:border-[#D4AF37]/30 transition-all cursor-pointer" : ""
            const content = (
              <>
                <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[11px] font-bold text-white/60 shrink-0">{i + 1}</span>
                <span className="w-2 h-12 rounded-full shrink-0" style={{ backgroundColor: n.colorPrimario }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white truncate font-medium">{n.nombre}</p>
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: n.colorPrimario + '22', color: n.colorPrimario, border: `1px solid ${n.colorPrimario}40` }}>
                      {n.tipo === 'BILLAR' ? 'Billar' : 'Discoteca'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40">
                    {n.jornadasCount} jornada(s)
                    {n.diaSemanaMasFuerte ? ` · Mejor día: ${n.diaSemanaMasFuerte}` : ''}
                  </p>
                </div>
                {n.sparkline7Dias && n.sparkline7Dias.length > 1 && (
                  <Sparkline values={n.sparkline7Dias} color={n.colorPrimario} />
                )}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white">{fmtCOP(n.totalVendido)}</p>
                  <p className={`text-[11px] ${n.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                    {n.saldo >= 0 ? '+' : ''}{fmtCOP(n.saldo)}
                  </p>
                </div>
                {clickable && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </>
            )
            return clickable ? (
              <button
                key={n.negocioId}
                onClick={() => onSelectNegocio!(n.negocioId, n.nombre, n.slug, n.colorPrimario)}
                className={`${baseClasses} ${interactive}`}
              >
                {content}
              </button>
            ) : (
              <div key={n.negocioId} className={baseClasses}>
                {content}
              </div>
            )
          })}
        </div>
      </Card>
      </div>
    </div>
  )
}

function renderBarLabel(props: any, anchor: 'top' | 'bottom', isMobile: boolean, barColor: string) {
  const value = Number(props.value)
  if (!value || value <= 0) return null
  const x = Number(props.x) || 0
  const y = Number(props.y) || 0
  const width = Number(props.width) || 0
  const height = Number(props.height) || 0
  const text = fmtCOP(value)

  const fontSize = isMobile ? 10 : 11
  const padX = 6
  const padY = 3
  const textW = text.length * fontSize * 0.6
  const pillW = textW + padX * 2
  const pillH = fontSize + padY * 2

  if (isMobile) {
    const cx = x + width / 2
    const cy = anchor === 'top'
      ? y + pillW / 2 + 6
      : y + height - pillW / 2 - 6
    return (
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <rect
          x={cx - pillW / 2}
          y={cy - pillH / 2}
          width={pillW}
          height={pillH}
          rx={pillH / 2}
          fill="#0A0A0A"
          fillOpacity={0.85}
          stroke={barColor}
          strokeWidth={1}
        />
        <text
          x={cx}
          y={cy + 0.5}
          fill={barColor}
          fontSize={fontSize}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing={0.3}
        >
          {text}
        </text>
      </g>
    )
  }

  const cx = x + width / 2
  const cy = anchor === 'top' ? y + pillH / 2 + 4 : y + height - pillH / 2 - 4
  return (
    <g>
      <rect
        x={cx - pillW / 2}
        y={cy - pillH / 2}
        width={pillW}
        height={pillH}
        rx={pillH / 2}
        fill="#0A0A0A"
        fillOpacity={0.85}
        stroke={barColor}
        strokeWidth={1}
      />
      <text
        x={cx}
        y={cy + 0.5}
        fill={barColor}
        fontSize={fontSize}
        fontWeight={800}
        textAnchor="middle"
        dominantBaseline="middle"
        letterSpacing={0.3}
      >
        {text}
      </text>
    </g>
  )
}

function FiltroTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm transition-all whitespace-nowrap flex-1 sm:flex-none ${
        active
          ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]'
          : 'text-white/50 hover:text-white/70'
      }`}
    >
      {label}
    </button>
  )
}

function RangoTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[11px] transition-all whitespace-nowrap ${
        active
          ? 'bg-white/15 text-white font-medium'
          : 'text-white/45 hover:text-white/70'
      }`}
    >
      {label}
    </button>
  )
}


function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  if (max <= 0) return null
  const w = 80
  const h = 28
  const stepX = w / (values.length - 1)
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = h - (v / max) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 hidden sm:block" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card>
      <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </Card>
  )
}

function MesKpi({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/[0.03]">
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums" style={{ color }}>{fmtCOP(valor)}</p>
    </div>
  )
}

function MesKpiDelta({ label, valor, anterior }: { label: string; valor: number; anterior: number }) {
  const delta = valor - anterior
  const pct = anterior > 0 ? ((delta / anterior) * 100) : (valor > 0 ? 100 : 0)
  const sube = delta >= 0
  const color = sube ? '#4ECDC4' : '#FF5050'
  const arrow = sube ? '↑' : '↓'
  return (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-[#D4AF37]/15">
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums text-white">{fmtCOP(valor)}</p>
      {anterior > 0 && (
        <p className="text-[11px] mt-1 tabular-nums" style={{ color }}>
          {arrow} {Math.abs(pct).toFixed(1)}% vs mes anterior
        </p>
      )}
    </div>
  )
}
