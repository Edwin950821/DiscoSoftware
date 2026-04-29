import { Card } from './ui/Card'
import { fmtCOP } from '../lib/utils'
import { useConsolidado } from '../hooks/useConsolidado'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts'

const COLORES_PAGO: Record<string, string> = {
  Efectivo: '#FF6B35',
  QR: '#4ECDC4',
  Nequi: '#FFE66D',
  Datafono: '#A8E6CF',
  Vales: '#C3B1E1',
}

interface Props {
  onSelectNegocio?: (id: string, nombre: string, slug: string, color: string) => void
}

export default function DashboardConsolidado({ onSelectNegocio }: Props = {}) {
  const { data, loading, error, recargar } = useConsolidado()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <img src="/assets/M02.png" alt="" className="w-12 h-12 animate-pulse opacity-50" />
        <p className="text-white/40 text-xs mt-3 tracking-widest uppercase">Cargando consolidado...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <p className="text-[#FF5050] text-sm font-medium">No se pudo cargar el consolidado</p>
        <p className="text-white/30 text-xs mt-2">{error ?? 'Sin datos'}</p>
        <button onClick={recargar} className="mt-5 px-4 py-2 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium hover:bg-[#D4AF37]/25 transition-colors">
          Reintentar
        </button>
      </div>
    )
  }

  if (data.negociosCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <p className="text-white/60 text-sm font-medium">Sin negocios activos</p>
        <p className="text-white/30 text-xs mt-2">Crea al menos un negocio para ver el consolidado</p>
      </div>
    )
  }

  const chartData = data.porNegocio.map(n => ({
    nombre: n.nombre,
    Vendido: n.totalVendido,
    Recibido: n.totalRecibido,
  }))

  const fade = (i: number) => ({
    animation: `disco-fadeup 0.5s ease-out both`,
    animationDelay: `${Math.min(i, 7) * 80}ms`,
  } as React.CSSProperties)

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes disco-fadeup {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={fade(0)}>
        <h1 className="text-2xl font-bold text-white">Vista Consolidada</h1>
        <p className="text-sm text-white/40 mt-1">{data.negociosCount} negocio(s) · {data.jornadasCount} jornada(s) registrada(s)</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={fade(1)}>
        <KpiCard label="Total Vendido" value={fmtCOP(data.totalVendido)} color="#D4AF37" />
        <KpiCard label="Total Recibido" value={fmtCOP(data.totalRecibido)} color="#4ECDC4" />
        <KpiCard label="Cortesías + Gastos" value={fmtCOP(data.totalCortesias + data.totalGastos)} color="#FFE66D" />
        <KpiCard label="Saldo Global" value={fmtCOP(data.totalSaldo)} color={data.totalSaldo >= 0 ? '#4ECDC4' : '#FF5050'} />
      </div>

      {((data.totalMesActual ?? 0) > 0 || (data.totalMesAnterior ?? 0) > 0) && (
        <div style={fade(2)}>
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3">Mes actual vs mes anterior</h3>
            <div className="grid grid-cols-2 gap-3">
              <MesKpi label="Mes anterior" valor={data.totalMesAnterior ?? 0} color="rgba(255,255,255,0.5)" />
              <MesKpiDelta label="Mes actual" valor={data.totalMesActual ?? 0} anterior={data.totalMesAnterior ?? 0} />
            </div>
          </Card>
        </div>
      )}

      <div style={fade(3)}>
      <Card>
        <h3 className="text-sm font-semibold text-white mb-4">Comparativo por negocio</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="nombre" stroke="rgba(255,255,255,0.4)" fontSize={11} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={(v) => fmtCOP(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#fff', fontSize: 12 }}
                formatter={(v) => fmtCOP(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Bar dataKey="Vendido" fill="#D4AF37" radius={[4, 4, 0, 0]} animationDuration={1000} animationEasing="ease-out" />
              <Bar dataKey="Recibido" fill="#4ECDC4" radius={[4, 4, 0, 0]} animationDuration={1000} animationEasing="ease-out" animationBegin={200} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      </div>

      {data.pagosTotales && Object.values(data.pagosTotales).some(v => v > 0) && (
        <div style={fade(4)}>
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Distribución de pagos (todos los negocios)</h3>
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
                    animationDuration={1200}
                    animationEasing="ease-out"
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
                <Area type="monotone" dataKey="total" stroke="#D4AF37" strokeWidth={2} fill="url(#grad-tendencia)" animationDuration={1500} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        </div>
      )}

      {/* Participación por negocio (donut) + Top productos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={fade(6)}>
        {data.porNegocio.length > 0 && data.totalVendido > 0 && (
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
                      animationDuration={1200}
                      animationEasing="ease-out"
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
                <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: n.colorPrimario }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{n.nombre}</p>
                  <p className="text-[11px] text-white/40">{n.jornadasCount} jornada(s)</p>
                </div>
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
