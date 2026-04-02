import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import Login from './components/Login'
import DiasApertura from './components/Jornadas'
import Configuracion from './components/Configuracion'
import Productos from './components/Productos'
import Liquidacion from './components/Liquidacion'
import PedidosAdmin from './components/PedidosAdmin'
import PedidosMesero from './components/PedidosMesero'
import Ventas from './components/Ventas'
const Dashboard = lazy(() => import('./components/Dashboard'))
const MesasBillar = lazy(() => import('./components/MesasBillar'))
import { Badge } from './components/ui/Badge'
import { useProductos } from './hooks/useProductos'
import { useTrabajadores } from './hooks/useTrabajadores'
import { useJornadas } from './hooks/useJornadas'
import { useInventarios } from './hooks/useInventarios'
import { useComparativos } from './hooks/useComparativos'
import { seedDatabase } from './lib/seedData'
import type { DiscoRol, View } from './types'

interface SessionData {
  accessToken: string
  refreshToken: string
  rol: DiscoRol
  nombre: string
  meseroId?: string
}

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
    if (!raw) return null
    return JSON.parse(raw) as SessionData
  } catch { return null }
}

function saveSession(data: SessionData) {
  const json = JSON.stringify(data)
  sessionStorage.setItem('monastery_session', json)
  localStorage.setItem('monastery_session', json)
}

function removeSession() {
  sessionStorage.removeItem('monastery_session')
  localStorage.removeItem('monastery_session')
}

const _PH = '6dba77308243555a9aa265b68f884ed5e51a46beb48d07fdf5fdba47f20e728a'
async function verifyPin(pin: string): Promise<boolean> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hash === _PH
}

function loadPremium(): boolean {
  return localStorage.getItem('monastery_premium') === 'true'
}

export default function App() {
  const [initialSession] = useState(() => loadSession())
  const [premiumEnabled, setPremiumEnabled] = useState(loadPremium)
  const [view, setView] = useState<View>(() => {
    if (!initialSession) return 'login'
    if (initialSession.rol === 'MESERO') return 'pedidos'
    return loadPremium() ? 'dashboard' : 'liquidacion'
  })
  const [rol, setRol] = useState<DiscoRol | null>(() => initialSession?.rol ?? null)
  const [nombre, setNombre] = useState(() => initialSession?.nombre ?? '')
  const [reloj, setReloj] = useState('')
  const [accessToken, setAccessToken] = useState(() => initialSession?.accessToken ?? '')
  const [meseroId, setMeseroId] = useState(() => initialSession?.meseroId ?? '')
  const [mobileMenu, setMobileMenu] = useState(false)

  const { productos, agregar: agregarProd, actualizar: actualizarProd, eliminar: eliminarProd } = useProductos()
  const { trabajadores, agregar: agregarTrabajador, actualizar: actualizarTrabajador, eliminar: eliminarTrabajador } = useTrabajadores()
  const { jornadas, guardar: guardarJornada, actualizar: actualizarJornada, eliminar: eliminarJornada } = useJornadas()
  const { inventarios, guardar: guardarInventario, actualizar: actualizarInventario, eliminar: eliminarInventario } = useInventarios()
  const { comparativos, guardar: guardarComparativo, eliminar: eliminarComparativo } = useComparativos()

  const [seeded, setSeeded] = useState(false)
  useEffect(() => { seedDatabase().then(() => setSeeded(true)) }, [])

  useEffect(() => {
    const tick = () => setReloj(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const clearSession = useCallback(() => {
    removeSession(); setAccessToken(''); setMeseroId(''); setRol(null); setNombre(''); setView('login')
  }, [])

  const handleLogout = useCallback(() => {
    clearSession()
  }, [clearSession])

  const handleLogin = (at: string, _rt: string, r: DiscoRol, n: string, mId?: string) => {
    saveSession({ accessToken: at, refreshToken: at, rol: r, nombre: n, meseroId: mId })
    // Recargar para que los hooks carguen datos con el token
    window.location.reload()
  }

  const navigate = (v: View) => { setView(v); setMobileMenu(false) }

  if (!seeded) return <div className="flex items-center justify-center h-screen bg-[#0A0A0A]"><p className="text-white/30 text-sm">Cargando...</p></div>
  if (view === 'login') return <Login onLogin={handleLogin} />

  const isAdmin = rol === 'ADMINISTRADOR'
  const isMesero = rol === 'MESERO'
  const rolLabel = isAdmin ? 'Administrador' : isMesero ? 'Mesero' : 'Dueno'
  const searchParams = new URLSearchParams(window.location.search)
  const pedidosMode = searchParams.get('mode') === 'pedidos'
  const billarMode = searchParams.get('mode') === 'billar'

  if (isMesero) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <header className="bg-[#0A0A0A] border-b border-white/[0.07] px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/M04.png" alt="M" className="h-8 object-contain" />
            <span className="text-sm font-semibold text-white/80">Monastery Club</span>
            <span className="text-[10px] text-white/20 font-mono">{reloj}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-white/50 block">{nombre}</span>
              <span className="text-[10px] text-[#D4AF37]/60">Mesero</span>
            </div>
            <button onClick={handleLogout} className="text-xs text-[#FF5050] hover:text-[#FF5050]/80 transition-colors">Salir</button>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <PedidosMesero meseroId={meseroId} />
        </main>
      </div>
    )
  }

  if (billarMode && isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <header className="bg-[#0A0A0A] border-b border-white/[0.07] px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/M04.png" alt="M" className="h-8 object-contain" />
            <span className="text-sm font-semibold text-white/80">Monastery Club</span>
            <span className="text-[10px] text-[#4ECDC4]/60 font-medium ml-1">Billar</span>
            <span className="text-[10px] text-white/20 font-mono">{reloj}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/30">{nombre}</span>
            <button onClick={handleLogout} className="text-xs text-[#FF5050] hover:text-[#FF5050]/80 transition-colors">Cerrar sesion</button>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-white/30 text-sm">Cargando...</div>}><MesasBillar /></Suspense>
        </main>
      </div>
    )
  }

  if (pedidosMode) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <header className="bg-[#0A0A0A] border-b border-white/[0.07] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/M04.png" alt="M" className="h-8 object-contain" />
            <span className="text-sm font-semibold text-white/80">Monastery Club</span>
            <span className="text-[10px] text-white/20 font-mono">{reloj}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/30">{nombre}</span>
            <button onClick={handleLogout} className="text-xs text-[#FF5050] hover:text-[#FF5050]/80 transition-colors">Cerrar sesion</button>
          </div>
        </header>
        <main className="p-6">
          <PedidosAdmin />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col lg:flex-row">

<header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/[0.07] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/assets/M04.png" alt="M" className="h-8 object-contain" />
          <span className="text-sm font-semibold text-white/80">Monastery</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/25 font-mono">{reloj}</span>
          {!isAdmin && (
            <button onClick={handleLogout} className="text-[10px] text-[#FF5050] hover:text-[#FF5050]/80 transition-colors">
              Salir
            </button>
          )}
        </div>
      </header>

{mobileMenu && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileMenu(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 bg-[#141414] rounded-t-2xl border-t border-white/[0.1] p-5 pb-8"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.07]">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <p className="text-sm text-white/90 font-medium">{nombre}</p>
                <p className="text-[11px] text-white/30">{rolLabel}</p>
              </div>
            </div>

            <nav className="space-y-1 mb-5">
              {premiumEnabled && <MobileMenuItem label="Dashboard" active={view === 'dashboard'} onClick={() => navigate('dashboard')}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>} />}
              {isAdmin && (
                <>
                  {premiumEnabled && <>
                    <MobileMenuItem label="Tickets" active={view === 'pedidos'} onClick={() => navigate('pedidos')}
                      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>} />
                    <MobileMenuItem label="Ventas" active={view === 'ventas'} onClick={() => navigate('ventas')}
                      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
                  </>}
                  <MobileMenuItem label="Billar" active={view === 'billar'} onClick={() => navigate('billar')}
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4.5"/><text x="12" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">8</text></svg>} />
                  <MobileMenuItem label="Liquidacion" active={view === 'liquidacion'} onClick={() => navigate('liquidacion')}
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>} />
                  <MobileMenuItem label="Dias de Apertura" active={view === 'apertura'} onClick={() => navigate('apertura')}
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
                  <div className="h-px bg-white/[0.05] my-2" />
                  <MobileMenuItem label="Productos" active={view === 'productos'} onClick={() => navigate('productos')}
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>} />
                  <MobileMenuItem label="Configuracion" active={view === 'configuracion'} onClick={() => navigate('configuracion')}
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>} />
                </>
              )}
            </nav>

            <button onClick={() => { setMobileMenu(false); handleLogout() }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#FF5050]/20 bg-[#FF5050]/5 text-sm text-[#FF5050] font-medium">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Cerrar sesion
            </button>
          </div>
        </div>
      )}

<aside className="hidden lg:flex w-[220px] bg-[#0A0A0A] border-r border-white/[0.07] flex-col p-5 shrink-0 h-screen sticky top-0">
        <div className="mb-6 flex flex-col items-center">
          <img src="/assets/M04.png" alt="Monastery Club" className="h-24 object-contain mb-1" />
          <p className="text-xs text-white/30">MVP</p>
          <p className="text-xs text-white/20 mt-1 font-mono">{reloj}</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {premiumEnabled && <SidebarLink label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />}
          {isAdmin && (
            <>
              {premiumEnabled && <>
                <SidebarLink label="Tickets" active={view === 'pedidos'} onClick={() => setView('pedidos')} />
                <SidebarLink label="Ventas" active={view === 'ventas'} onClick={() => setView('ventas')} />
              </>}
              <SidebarLink label="Billar" active={view === 'billar'} onClick={() => setView('billar')} />
              <SidebarLink label="Liquidacion" active={view === 'liquidacion'} onClick={() => setView('liquidacion')} />
              <SidebarLink label="Dias de Apertura" active={view === 'apertura'} onClick={() => setView('apertura')} />
              <div className="h-px bg-white/[0.05] my-1" />
              <SidebarLink label="Productos" active={view === 'productos'} onClick={() => setView('productos')} />
              <SidebarLink label="Configuracion" active={view === 'configuracion'} onClick={() => setView('configuracion')} />
            </>
          )}
        </nav>
        <div className="mt-auto pt-4 border-t border-white/[0.07]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 font-medium truncate">{nombre}</p>
              <p className="text-[10px] text-white/30">{rolLabel}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#FF5050]/20 bg-[#FF5050]/5 text-xs text-[#FF5050] font-medium hover:bg-[#FF5050]/10 hover:border-[#FF5050]/30 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesion
          </button>
        </div>
      </aside>

{isAdmin && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-white/[0.07] flex justify-around items-center px-2 py-1.5 safe-bottom">
          {premiumEnabled && <>
            <BottomNavItem label="Home" active={view === 'dashboard'} onClick={() => setView('dashboard')}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>} />
            <BottomNavItem label="Tickets" active={view === 'pedidos'} onClick={() => setView('pedidos')}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>} />
            <BottomNavItem label="Ventas" active={view === 'ventas'} onClick={() => setView('ventas')}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
          </>}
          <BottomNavItem label="Liquidar" active={view === 'liquidacion'} onClick={() => setView('liquidacion')}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>} />
          <BottomNavItem label="Mas" active={['apertura','productos','configuracion','billar'].includes(view)} onClick={() => setMobileMenu(true)}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>} />
        </nav>
      )}

<main className="flex-1 p-4 lg:p-6 pt-16 lg:pt-6 pb-20 lg:pb-6 overflow-auto">
        {premiumEnabled && view === 'dashboard' && <Suspense fallback={<div className="flex items-center justify-center h-64 text-white/30 text-sm">Cargando...</div>}><Dashboard jornadas={jornadas} trabajadores={trabajadores} /></Suspense>}
        {isAdmin && view === 'liquidacion' && (
          <Liquidacion
            jornadas={jornadas} trabajadores={trabajadores} productos={productos}
            inventarios={inventarios} comparativos={comparativos}
            agregarTrabajador={agregarTrabajador} eliminarTrabajador={eliminarTrabajador}
            guardarJornada={guardarJornada} actualizarJornada={actualizarJornada} eliminarJornada={eliminarJornada}
            guardarInventario={guardarInventario} actualizarInventario={actualizarInventario} eliminarInventario={eliminarInventario}
            guardarComparativo={guardarComparativo} eliminarComparativo={eliminarComparativo}
          />
        )}
        {view === 'apertura' && <DiasApertura />}
        {view === 'inventario' && (
          <Liquidacion
            jornadas={jornadas} trabajadores={trabajadores} productos={productos}
            inventarios={inventarios} comparativos={comparativos}
            agregarTrabajador={agregarTrabajador} eliminarTrabajador={eliminarTrabajador}
            guardarJornada={guardarJornada} actualizarJornada={actualizarJornada} eliminarJornada={eliminarJornada}
            guardarInventario={guardarInventario} actualizarInventario={actualizarInventario} eliminarInventario={eliminarInventario}
            guardarComparativo={guardarComparativo} eliminarComparativo={eliminarComparativo}
            initialTab="inventario"
          />
        )}
        {view === 'comparativo' && (
          <Liquidacion
            jornadas={jornadas} trabajadores={trabajadores} productos={productos}
            inventarios={inventarios} comparativos={comparativos}
            agregarTrabajador={agregarTrabajador} eliminarTrabajador={eliminarTrabajador}
            guardarJornada={guardarJornada} actualizarJornada={actualizarJornada} eliminarJornada={eliminarJornada}
            guardarInventario={guardarInventario} actualizarInventario={actualizarInventario} eliminarInventario={eliminarInventario}
            guardarComparativo={guardarComparativo} eliminarComparativo={eliminarComparativo}
            initialTab="comparativo"
          />
        )}
        {premiumEnabled && isAdmin && view === 'pedidos' && <PedidosAdmin />}
        {premiumEnabled && isAdmin && view === 'ventas' && <Ventas />}
        {isAdmin && view === 'billar' && <Suspense fallback={<div className="flex items-center justify-center h-64 text-white/30 text-sm">Cargando...</div>}><MesasBillar /></Suspense>}
        {view === 'productos' && <Productos productos={productos} agregar={agregarProd} actualizar={actualizarProd} eliminar={eliminarProd} />}
        {view === 'configuracion' && (
          <Configuracion accessToken={accessToken} trabajadores={trabajadores}
            agregarTrabajador={agregarTrabajador} actualizarTrabajador={actualizarTrabajador} eliminarTrabajador={eliminarTrabajador}
            premiumEnabled={premiumEnabled} onTogglePremium={async (pin: string) => {
              if (await verifyPin(pin)) {
                const next = !premiumEnabled
                setPremiumEnabled(next)
                localStorage.setItem('monastery_premium', String(next))
                return true
              }
              return false
            }} />
        )}
      </main>
    </div>
  )
}

function SidebarLink({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick}
      className={`text-left text-sm px-3 py-2 rounded-lg transition-all flex items-center justify-between ${
        active ? 'bg-white/10 text-white font-medium' : 'text-white/45 hover:text-white/70 hover:bg-white/5'
      }`}>
      {label}
      {badge !== undefined && <Badge>{badge}</Badge>}
    </button>
  )
}

function BottomNavItem({ label, active, onClick, icon, badge }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode; badge?: number }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 px-2 py-1 relative min-w-[52px]">
      <span className={active ? 'text-[#CDA52F]' : 'text-white/35'}>{icon}</span>
      <span className={`text-[10px] ${active ? 'text-[#CDA52F] font-medium' : 'text-white/35'}`}>{label}</span>
      {badge !== undefined && (
        <span className="absolute -top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#CDA52F] text-[8px] text-black font-bold flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>
      )}
    </button>
  )
}

function MobileMenuItem({ label, active, onClick, icon, badge }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode; badge?: number }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all ${
        active ? 'bg-[#CDA52F]/10 text-[#CDA52F]' : 'text-white/60 active:bg-white/5'
      }`}>
      {icon}
      <span className={`text-sm flex-1 text-left ${active ? 'font-medium' : ''}`}>{label}</span>
      {badge !== undefined && <Badge>{badge}</Badge>}
    </button>
  )
}
