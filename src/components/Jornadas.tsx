import { useState } from 'react'
import type { Jornada, MedioPago } from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Badge } from './ui/Badge'
import { DateRangeFilter } from './ui/DateRangeFilter'
import { fmtFull, fmtCOP } from '../lib/utils'

const COLORES_PAGO: Record<string, string> = {
  Efectivo: '#CDA52F', Transferencias: '#4ECDC4', Vales: '#C3B1E1',
}
const MEDIOS: MedioPago[] = ['Efectivo', 'Transferencias', 'Vales']

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Jornadas</h2>
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}
          total={jornadas.length} filtrados={jornadasFiltradas.length} />
      </div>
      <div className="space-y-3">
        {jornadasFiltradas.map(j => (
          <Card key={j.id} className="cursor-pointer" onClick={() => toggle(j.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge>{j.sesion}</Badge>
                <span className="text-sm text-white/45">{j.fecha}</span>
                <span className="text-xs text-white/30">{j.meseros?.length || 0} meseros</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#FFE66D]">{fmtCOP(j.totalVendido)}</span>
                <span className={`text-sm font-bold ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                  {fmtCOP(j.saldo)}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-white/40 transition-transform duration-200 ${expanded === j.id ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {expanded === j.id && (
              <div className="mt-4 pt-4 border-t border-white/[0.07]" onClick={e => e.stopPropagation()}>
                <div className="space-y-3 mb-4">
                  {j.meseros?.map(m => {
                    const totalLiq = (m.pagos?.Efectivo || 0) + (m.pagos?.Transferencias || 0) + (m.pagos?.Vales || 0)
                    return (
                      <div key={m.meseroId} className="p-3 rounded-lg bg-white/[0.03]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ backgroundColor: m.color + '33', color: m.color }}>{m.avatar}</div>
                          <span className="text-xs text-white/70 flex-1">{m.nombre}</span>
                          <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(m.totalMesero)}</span>
                        </div>
                        {m.pagos && (
                          <div className="flex flex-wrap gap-1.5 ml-9">
                            {MEDIOS.filter(medio => (m.pagos[medio] || 0) > 0).map(medio => (
                              <span key={medio} className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: (COLORES_PAGO[medio] || '#fff') + '22', color: COLORES_PAGO[medio] || '#fff' }}>
                                {medio}: {fmtFull(m.pagos[medio])}
                              </span>
                            ))}
                            {(m.cortesias || 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                                Cortesias: {fmtFull(m.cortesias)}
                              </span>
                            )}
                            {(m.gastos || 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                                Gastos: {fmtFull(m.gastos)}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between ml-9 mt-1 text-[10px]">
                          <span className="text-white/30">Total Liq: {fmtFull(totalLiq)}</span>
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
                  <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(j.id)}>Eliminar jornada</Btn>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
