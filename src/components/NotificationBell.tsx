import { useEffect, useRef, useState } from 'react'
import type { SuperNotificacion } from '../hooks/useSuperNotifications'
import { MODULO_LABEL, ACCION_LABEL } from '../hooks/useSuperNotifications'

interface Props {
  notificaciones: SuperNotificacion[]
  noLeidas: number
  conectado: boolean
  onMarcarLeidas: () => void
  onMarcarLeida: (id: string) => void
  onLimpiar: () => void
  onAbrir: (notif: SuperNotificacion) => void
  dropdownAlign?: 'left' | 'right'
}

function formatRelativo(iso: string): string {
  try {
    const t = new Date(iso).getTime()
    const diff = Date.now() - t
    const seg = Math.floor(diff / 1000)
    if (seg < 60) return 'ahora'
    const min = Math.floor(seg / 60)
    if (min < 60) return `hace ${min}min`
    const h = Math.floor(min / 60)
    if (h < 24) return `hace ${h}h`
    const d = Math.floor(h / 24)
    return `hace ${d}d`
  } catch { return '' }
}

const LIMITE_VISIBLE = 5

export default function NotificationBell({ notificaciones, noLeidas, conectado, onMarcarLeidas, onMarcarLeida, onLimpiar, onAbrir, dropdownAlign = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmLimpiar, setConfirmLimpiar] = useState(false)
  const [mostrarTodas, setMostrarTodas] = useState(false)
  const [, setTick] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setConfirmLimpiar(false)
      setMostrarTodas(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    setOpen(prev => !prev)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative w-9 h-9 rounded-lg border border-white/[0.08] bg-[#141414] hover:bg-[#1a1a1a] hover:border-white/15 flex items-center justify-center transition-all"
        title={conectado ? 'Notificaciones (en línea)' : 'Notificaciones (desconectado)'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF5050] text-[10px] font-bold text-white flex items-center justify-center border-2 border-[#0A0A0A]">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0A0A0A] ${conectado ? 'bg-[#4ECDC4]' : 'bg-white/20'}`}
          title={conectado ? 'Conectado' : 'Desconectado'}
        />
      </button>

      {open && (
        <div className={`absolute top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-[#141414] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden ${
          dropdownAlign === 'left' ? 'left-0' : 'right-0'
        }`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div>
              <p className="text-sm font-semibold text-white">Notificaciones</p>
              <p className="text-[10px] text-white/40">
                {conectado ? 'En vivo · Cambios en módulos' : 'Sin conexión en tiempo real'}
              </p>
            </div>
            {notificaciones.length > 0 && (
              confirmLimpiar ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/50">¿Borrar todo?</span>
                  <button
                    onClick={() => { onLimpiar(); setConfirmLimpiar(false) }}
                    className="text-[11px] text-[#FF5050] hover:text-[#FF5050]/80 font-semibold transition-colors px-1.5"
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setConfirmLimpiar(false)}
                    className="text-[11px] text-white/40 hover:text-white/70 transition-colors px-1.5"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {noLeidas > 0 && (
                    <button
                      onClick={onMarcarLeidas}
                      className="text-[11px] text-[#CDA52F]/80 hover:text-[#CDA52F] transition-colors"
                      title="Marcar todas como leídas"
                    >
                      Leer todas
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmLimpiar(true)}
                    className="text-[11px] text-white/40 hover:text-[#FF5050] transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
              )
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20 mx-auto mb-3">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p className="text-xs text-white/40">No hay notificaciones</p>
                <p className="text-[10px] text-white/25 mt-1">Te avisamos cuando un negocio registre una liquidación o inventario</p>
              </div>
            ) : (
              (mostrarTodas ? notificaciones : notificaciones.slice(0, LIMITE_VISIBLE)).map(n => (
                <button
                  key={n.id}
                  onClick={() => { onMarcarLeida(n.id); onAbrir(n); setOpen(false) }}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors text-left ${
                    !n.leida ? 'bg-white/[0.025]' : ''
                  }`}
                >
                  <span
                    className="mt-1 w-2 h-2 rounded-full shrink-0 transition-all"
                    style={{
                      backgroundColor: n.leida ? 'rgba(255,255,255,0.15)' : n.negocioColor,
                      boxShadow: !n.leida ? `0 0 0 3px ${n.negocioColor}30` : 'none',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-medium truncate ${n.leida ? 'text-white/40' : 'text-white/90'}`}>{n.negocioNombre}</p>
                      <span className={`text-[10px] shrink-0 ${n.leida ? 'text-white/20' : 'text-white/35'}`}>{formatRelativo(n.timestamp)}</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 truncate ${n.leida ? 'text-white/30' : 'text-white/50'}`}>
                      {MODULO_LABEL[n.modulo] ?? n.modulo} ·{' '}
                      <span style={{
                        color: n.accion === 'DELETE' ? '#FF5050' : n.accion === 'UPDATE' ? '#FFE66D' : '#4ECDC4',
                        opacity: n.leida ? 0.5 : 1,
                      }}>
                        {ACCION_LABEL[n.accion] ?? n.accion}
                      </span>
                    </p>
                    {n.descripcion && (
                      <p className={`text-[11px] mt-0.5 line-clamp-2 ${n.leida ? 'text-white/35' : 'text-white/70'}`}>{n.descripcion}</p>
                    )}
                  </div>
                  {!n.leida && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#CDA52F] shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
            {notificaciones.length > LIMITE_VISIBLE && (
              <button
                onClick={() => setMostrarTodas(v => !v)}
                className="w-full py-2.5 text-center text-[11px] text-[#CDA52F]/80 hover:text-[#CDA52F] hover:bg-white/[0.03] transition-colors border-t border-white/[0.04]"
              >
                {mostrarTodas
                  ? `Ver menos (${LIMITE_VISIBLE} más recientes)`
                  : `Ver todas (${notificaciones.length})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
