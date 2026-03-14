import { useState } from 'react'
import type { Jornada } from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Badge } from './ui/Badge'
import { DateRangeFilter } from './ui/DateRangeFilter'
import { fmtFull, fmtCOP, calcularLiquidacion } from '../lib/utils'

const COLORES_PAGO: Record<string, string> = {
  Efectivo: '#CDA52F', Datafono: '#A8E6CF', QR: '#4ECDC4', Nequi: '#FFE66D', Vales: '#C3B1E1',
}

interface Props {
  jornadas: Jornada[]
  eliminar: (id: string) => Promise<void>
}

export default function Jornadas({ jornadas, eliminar }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const jornadasFiltradas = jornadas.filter(j => {
    if (desde && j.fecha < desde) return false
    if (hasta && j.fecha > hasta) return false
    return true
  })

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id)

  const handleEliminar = async (id: string) => {
    await eliminar(id)
    setConfirmDelete(null)
    setExpanded(null)
  }

  if (jornadas.length === 0) {
    return (
      <div className="text-center mt-20">
        <p className="text-2xl text-white/30 mb-2">Sin jornadas</p>
        <p className="text-sm text-white/20">Crea tu primera jornada para verla aqui</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-bold mb-3">Jornadas</h2>
      <div className="mb-4 sm:mb-6">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}
          total={jornadas.length} filtrados={jornadasFiltradas.length} />
      </div>
      <div className="space-y-3">
        {jornadasFiltradas.map(j => (
          <Card key={j.id} className="cursor-pointer" onClick={() => toggle(j.id)}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Badge>{j.sesion}</Badge>
                <div className="min-w-0">
                  <span className="text-xs text-white/45 block truncate">{j.fecha}</span>
                  <span className="text-[10px] text-white/30">{j.liquidaciones?.length || 0} trab.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-xs sm:text-sm text-[#FFE66D] block">{fmtCOP(j.totalVendido)}</span>
                  <span className={`text-[10px] sm:text-xs font-bold ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                    {fmtCOP(j.saldo)}
                  </span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-white/40 transition-transform duration-200 ${expanded === j.id ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {expanded === j.id && (
              <div className="mt-4 pt-4 border-t border-white/[0.07]" onClick={e => e.stopPropagation()}>
                <div className="space-y-3 mb-4">
                  {j.liquidaciones?.map((liq, i) => {
                    const c = calcularLiquidacion(liq)
                    return (
                      <div key={i} className="p-3 rounded-lg bg-white/[0.03]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ backgroundColor: liq.color + '33', color: liq.color }}>{liq.avatar}</div>
                          <span className="text-xs text-white/70 flex-1">{liq.nombre}</span>
                          <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(c.totalVenta)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 ml-9">
                          {liq.efectivoEntregado > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: COLORES_PAGO.Efectivo + '22', color: COLORES_PAGO.Efectivo }}>
                              Efectivo: {fmtCOP(liq.efectivoEntregado)}
                            </span>
                          )}
                          {c.totalDatafono > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: COLORES_PAGO.Datafono + '22', color: COLORES_PAGO.Datafono }}>
                              Datafono: {fmtCOP(c.totalDatafono)}
                            </span>
                          )}
                          {c.totalQR > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: COLORES_PAGO.QR + '22', color: COLORES_PAGO.QR }}>
                              QR: {fmtCOP(c.totalQR)}
                            </span>
                          )}
                          {c.totalNequi > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: COLORES_PAGO.Nequi + '22', color: COLORES_PAGO.Nequi }}>
                              Nequi: {fmtCOP(c.totalNequi)}
                            </span>
                          )}
                          {c.totalVales > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: COLORES_PAGO.Vales + '22', color: COLORES_PAGO.Vales }}>
                              Vales: {fmtCOP(c.totalVales)}
                            </span>
                          )}
                          {c.totalCortesias > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                              Cortesias: {fmtCOP(c.totalCortesias)}
                            </span>
                          )}
                          {c.totalGastos > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                              Gastos: {fmtCOP(c.totalGastos)}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between ml-9 mt-1 text-[10px]">
                          <span className="text-white/30">Saldo: <span className={c.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}>{fmtFull(c.saldo)}</span></span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {j.pagos && Object.entries(j.pagos).filter(([, v]) => v > 0).map(([k, v]) => (
                    <span key={k} className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ backgroundColor: (COLORES_PAGO[k] || '#fff') + '22', color: COLORES_PAGO[k] || '#fff' }}>
                      {k}: {fmtFull(v as number)}
                    </span>
                  ))}
                </div>

                <div className="text-xs space-y-1 mb-4">
                  <div className="flex justify-between"><span className="text-white/45">Vendido</span><span>{fmtFull(j.totalVendido)}</span></div>
                  <div className="flex justify-between"><span className="text-white/45">Cortesias</span><span>-{fmtFull(j.cortesias)}</span></div>
                  <div className="flex justify-between"><span className="text-white/45">Gastos</span><span>-{fmtFull(j.gastos)}</span></div>
                  <div className="flex justify-between"><span className="text-white/45">Recibido</span><span className="text-[#4ECDC4]">{fmtFull(j.totalRecibido)}</span></div>
                  <div className="flex justify-between font-bold">
                    <span>Saldo</span>
                    <span className={j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}>{fmtFull(j.saldo)}</span>
                  </div>
                </div>

                {confirmDelete === j.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#FF5050]">Seguro?</span>
                    <Btn size="sm" variant="danger" onClick={() => handleEliminar(j.id)}>Si, eliminar</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
                  </div>
                ) : (
                  <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(j.id)} className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Eliminar jornada</Btn>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
