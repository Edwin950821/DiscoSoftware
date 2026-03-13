import { useState } from 'react'
import type { Jornada, MedioPago } from '../types'
import { Card } from './ui/Card'
import { fmtCOP, fmtFull } from '../lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'

const COLORES_PAGO: Record<string, string> = {
  Efectivo: '#CDA52F', Transferencias: '#4ECDC4', Vales: '#C3B1E1',
}

interface Props { jornadas: Jornada[] }

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-4 py-3"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
      <p className="text-[11px] text-white/50 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-3 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[11px] text-white/50">{p.name || p.dataKey}:</span>
          <span className="text-[11px] font-semibold text-white ml-auto">{fmtFull(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ jornadas }: Props) {
  const [hoveredMesero, setHoveredMesero] = useState<string | null>(null)

  if (jornadas.length === 0) {
    return (
      <div className="text-center mt-20">
        <p className="text-2xl text-white/30 mb-2">Sin datos</p>
        <p className="text-sm text-white/20">Ingresa jornadas para ver el dashboard</p>
      </div>
    )
  }

  const totalVendido = jornadas.reduce((s, j) => s + j.totalVendido, 0)
  const totalRecibido = jornadas.reduce((s, j) => s + j.totalRecibido, 0)
  const totalGastos = jornadas.reduce((s, j) => s + j.cortesias + j.gastos, 0)
  const saldoGlobal = jornadas.reduce((s, j) => s + j.saldo, 0)

  const mesesNombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const mesMap: Record<string, { vendido: number; recibido: number; orden: number }> = {}
  jornadas.forEach(j => {
    const [anio, mes] = j.fecha.split('-')
    const key = `${mesesNombres[Number(mes) - 1]} ${anio.slice(2)}`
    const orden = Number(anio) * 100 + Number(mes)
    if (!mesMap[key]) mesMap[key] = { vendido: 0, recibido: 0, orden }
    mesMap[key].vendido += j.totalVendido
    mesMap[key].recibido += j.totalRecibido
  })
  const chartData = Object.entries(mesMap)
    .sort(([, a], [, b]) => a.orden - b.orden)
    .map(([mes, d]) => ({ mes, Vendido: d.vendido, Recibido: d.recibido }))

  const pagosMap: Record<string, number> = {}
  jornadas.forEach(j => {
    if (j.pagos) Object.entries(j.pagos).forEach(([k, v]) => { pagosMap[k] = (pagosMap[k] || 0) + (v as number) })
  })
  const pieData = Object.entries(pagosMap).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)

  const rankingMap: Record<string, { nombre: string; color: string; avatar: string; total: number; noches: number }> = {}
  jornadas.forEach(j => {
    j.meseros?.forEach(m => {
      if (!rankingMap[m.meseroId]) rankingMap[m.meseroId] = { nombre: m.nombre, color: m.color, avatar: m.avatar, total: 0, noches: 0 }
      rankingMap[m.meseroId].total += m.totalMesero
      rankingMap[m.meseroId].noches += 1
    })
  })
  const ranking = Object.values(rankingMap).sort((a, b) => b.total - a.total)
  const maxRanking = ranking.length > 0 ? ranking[0].total : 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <span className="text-xs text-white/25">{jornadas.length} jornada{jornadas.length > 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Vendido', value: totalVendido, color: '#4ECDC4' },
          { label: 'Total Recibido', value: totalRecibido, color: '#4ECDC4' },
          { label: 'Gastos + Cortesias', value: totalGastos, color: '#FFE66D' },
          { label: 'Saldo Global', value: saldoGlobal, color: saldoGlobal >= 0 ? '#4ECDC4' : '#FF5050' },
        ].map(k => (
          <Card key={k.label}>
            <p className="text-[11px] text-white/40 mb-2">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{fmtCOP(k.value)}</p>
            <p className="text-[10px] text-white/20 mt-0.5">{fmtFull(k.value)}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-white/70">Rendimiento mensual</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4ECDC4]" />
              <span className="text-[10px] text-white/40">Vendido: {fmtFull(totalVendido)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#CDA52F' }} />
              <span className="text-[10px] text-white/40">Recibido: {fmtFull(totalRecibido)}</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradVendido" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ECDC4" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#4ECDC4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRecibido" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#CDA52F" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#CDA52F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="mes"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
              axisLine={false} tickLine={false} dy={8} />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => fmtCOP(v)} width={55} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="Vendido" name="Vendido"
              stroke="#4ECDC4" strokeWidth={2.5} fill="url(#gradVendido)" isAnimationActive={false}
              dot={false} activeDot={{ r: 5, fill: '#4ECDC4', stroke: '#0A0A0A', strokeWidth: 2 }} />
            <Area type="monotone" dataKey="Recibido" name="Recibido"
              stroke="#CDA52F" strokeWidth={2} fill="url(#gradRecibido)"
              strokeDasharray="6 4" isAnimationActive={false}
              dot={false} activeDot={{ r: 4, fill: '#CDA52F', stroke: '#0A0A0A', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="text-sm font-medium text-white/70 mb-4">Pagos</p>
          {pieData.length > 0 ? (
            <div className="flex gap-6 items-start">
              <div className="shrink-0" style={{ width: 160, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={45} outerRadius={70} dataKey="value"
                      paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
                      {pieData.map(d => <Cell key={d.name} fill={COLORES_PAGO[d.name] || '#888'} />)}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]
                        const pct = pieTotal > 0 ? ((Number(d.value) / pieTotal) * 100).toFixed(0) : '0'
                        return (
                          <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-lg px-3 py-2"
                            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                            <p className="text-[11px] text-white font-medium">{d.name}</p>
                            <p className="text-[11px] text-white/50">{fmtFull(Number(d.value))} · {pct}%</p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3 pt-2">
                {pieData.map(d => {
                  const pct = pieTotal > 0 ? (d.value / pieTotal) * 100 : 0
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORES_PAGO[d.name] }} />
                          <span className="text-xs text-white/60">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">{pct.toFixed(0)}%</span>
                          <span className="text-xs text-white font-semibold">{fmtCOP(d.value)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: COLORES_PAGO[d.name] }} />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] text-white/30">Total recibido</span>
                  <span className="text-sm text-white font-bold">{fmtFull(pieTotal)}</span>
                </div>
              </div>
            </div>
          ) : <p className="text-xs text-white/20 py-8 text-center">Sin datos de pago</p>}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-white/70">Ranking meseros</p>
            <span className="text-[10px] text-white/20">{ranking.length} meseros</span>
          </div>
          <div className="space-y-1">
            {ranking.map((m, i) => {
              const pct = maxRanking > 0 ? (m.total / maxRanking) * 100 : 0
              const isTop = i === 0
              const hovered = hoveredMesero === m.nombre
              return (
                <div key={m.nombre}
                  onMouseEnter={() => setHoveredMesero(m.nombre)}
                  onMouseLeave={() => setHoveredMesero(null)}
                  className={`relative rounded-lg px-3 py-2.5 transition-all duration-200 ${hovered ? 'bg-white/[0.03]' : ''}`}>
                  <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                    <div className="h-full transition-all duration-500 opacity-[0.05]"
                      style={{ width: `${pct}%`, backgroundColor: m.color }} />
                  </div>
                  <div className="relative flex items-center gap-3">
                    <span className={`text-xs w-4 text-center font-bold ${isTop ? 'text-[#FFE66D]' : 'text-white/20'}`}>{i + 1}</span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: m.color + '20', color: m.color }}>{m.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90">{m.nombre}</p>
                      <p className="text-[10px] text-white/25">{m.noches} noche{m.noches > 1 ? 's' : ''} · {fmtCOP(m.noches > 0 ? Math.round(m.total / m.noches) : 0)}/noche</p>
                    </div>
                    <span className={`text-sm font-bold ${isTop ? 'text-[#FFE66D]' : 'text-white/60'}`}>{fmtCOP(m.total)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
