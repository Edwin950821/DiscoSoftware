import { useState, useEffect, useCallback } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Jornadas from './components/Jornadas'
import Configuracion from './components/Configuracion'
import Productos from './components/Productos'
import Liquidacion from './components/Liquidacion'
import { Badge } from './components/ui/Badge'
import { useProductos } from './hooks/useProductos'
import { useMeseros } from './hooks/useMeseros'
import { useJornadas } from './hooks/useJornadas'
import { useInventarios } from './hooks/useInventarios'
import { useComparativos } from './hooks/useComparativos'
import { API_URL } from './lib/config'
import type { DiscoRol, View } from './types'

function loadSession() {
  try {
    const raw = sessionStorage.getItem('monastery_session')
    if (!raw) return null
    return JSON.parse(raw) as { accessToken: string; refreshToken: string; rol: DiscoRol; nombre: string }
  } catch { return null }
}

function saveSession(data: { accessToken: string; refreshToken: string; rol: DiscoRol; nombre: string }) {
  sessionStorage.setItem('monastery_session', JSON.stringify(data))
}

function removeSession() {
  sessionStorage.removeItem('monastery_session')
}

export default function App() {
  const saved = loadSession()
  const [view, setView] = useState<View>(saved ? 'dashboard' : 'login')
  const [rol, setRol] = useState<DiscoRol | null>(saved?.rol ?? null)
  const [nombre, setNombre] = useState(saved?.nombre ?? '')
  const [reloj, setReloj] = useState('')
  const [accessToken, setAccessToken] = useState(saved?.accessToken ?? '')
  const [refreshToken, setRefreshToken] = useState(saved?.refreshToken ?? '')

  const { productos, agregar: agregarProd, actualizar: actualizarProd, eliminar: eliminarProd } = useProductos()
  const { meseros, agregar: agregarMesero, eliminar: eliminarMesero } = useMeseros()
  const { jornadas, guardar, eliminar } = useJornadas()
  const { inventarios, guardar: guardarInventario, eliminar: eliminarInventario } = useInventarios()
  const { comparativos, guardar: guardarComparativo, eliminar: eliminarComparativo } = useComparativos()

  useEffect(() => {
    const tick = () => setReloj(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const clearSession = useCallback(() => {
    removeSession(); setAccessToken(''); setRefreshToken(''); setRol(null); setNombre(''); setView('login')
  }, [])

  const handleLogout = useCallback(async () => {
    try { await fetch(`${API_URL}/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } }) } catch { /* */ }
    clearSession()
  }, [accessToken, clearSession])

  useEffect(() => {
    if (!refreshToken) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) })
        if (res.ok) {
          const data = await res.json()
          saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, rol: rol!, nombre })
          setAccessToken(data.accessToken); setRefreshToken(data.refreshToken)
        } else { clearSession() }
      } catch { /* */ }
    }, 14 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshToken, rol, nombre, clearSession])

  const handleLogin = (accessToken: string, refreshToken: string, rol: DiscoRol, nombre: string) => {
    saveSession({ accessToken, refreshToken, rol, nombre })
    setAccessToken(accessToken); setRefreshToken(refreshToken); setRol(rol); setNombre(nombre); setView('dashboard')
  }

  if (view === 'login') return <Login onLogin={handleLogin} />

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex">
      <aside className="w-[220px] bg-[#0A0A0A] border-r border-white/[0.07] flex flex-col p-5 shrink-0 h-screen sticky top-0">
        <div className="mb-6">
          <img src="/assets/M02.png" alt="Monastery Club" className="h-14 object-contain mb-1" />
          <p className="text-xs text-white/30">MVP</p>
          <p className="text-xs text-white/20 mt-1 font-mono">{reloj}</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <SidebarLink label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          {rol === 'ADMINISTRADOR' && (
            <>
              <SidebarLink label="Liquidaciones" active={view === 'liquidacion'} onClick={() => setView('liquidacion')}
                badge={jornadas.length > 0 ? jornadas.length : undefined} />
              <SidebarLink label="Jornadas" active={view === 'jornadas'} onClick={() => setView('jornadas')} />
              <SidebarLink label="Productos" active={view === 'productos'} onClick={() => setView('productos')} />
              <SidebarLink label="Configuración" active={view === 'configuracion'} onClick={() => setView('configuracion')} />
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
              <p className="text-[10px] text-white/30">{rol === 'ADMINISTRADOR' ? 'Administrador' : 'Dueño'}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#FF5050]/20 bg-[#FF5050]/5 text-xs text-[#FF5050] font-medium hover:bg-[#FF5050]/10 hover:border-[#FF5050]/30 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        {view === 'dashboard' && <Dashboard jornadas={jornadas} />}
        {rol === 'ADMINISTRADOR' && (
          <div style={{ display: view === 'liquidacion' ? 'block' : 'none' }}>
            <Liquidacion
              jornadas={jornadas} meserosDB={meseros} productos={productos} inventarios={inventarios}
              comparativos={comparativos}
              agregarMesero={agregarMesero} eliminarMesero={eliminarMesero}
              guardarJornada={guardar} eliminarJornada={eliminar}
              guardarInventario={guardarInventario} eliminarInventario={eliminarInventario}
              guardarComparativo={guardarComparativo} eliminarComparativo={eliminarComparativo}
            />
          </div>
        )}
        {view === 'jornadas' && <Jornadas jornadas={jornadas} eliminar={eliminar} />}
        {view === 'productos' && <Productos productos={productos} agregar={agregarProd} actualizar={actualizarProd} eliminar={eliminarProd} />}
        {view === 'configuracion' && <Configuracion accessToken={accessToken} />}
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
