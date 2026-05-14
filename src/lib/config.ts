
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.DEV
    ? 'http://localhost:8081'
    : 'https://monastery-backend-dmby.onrender.com')
export const API_DISCO = `${API_BASE}/api/disco`
export const API_MANAGEMENT = `${API_DISCO}/management`
export const API_PEDIDOS = `${API_DISCO}/pedidos`
export const API_AUTH = `${API_DISCO}/auth`
export const API_SUPER = `${API_DISCO}/super`

function readStoredSession(): string | null {
  try {
    return sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
  } catch { return null }
}

function getToken(): string | null {
  const raw = readStoredSession()
  if (!raw) return null
  try { return JSON.parse(raw).accessToken || null } catch { return null }
}

function getNegocioActivo(): string | null {
  const raw = readStoredSession()
  if (!raw) return null
  try { return JSON.parse(raw).negocioActivo || null } catch { return null }
}

let sessionExpiredHandled = false

function notifySessionExpired() {
  if (sessionExpiredHandled) return
  sessionExpiredHandled = true
  try {
    sessionStorage.setItem('monastery_session_expired', '1')
    sessionStorage.removeItem('monastery_session')
    localStorage.removeItem('monastery_session')
    setTimeout(() => {
      try { window.location.reload() } catch { /* noop */ }
    }, 0)
  } catch { /* noop */ }
}


export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  if (!token) {
    if (readStoredSession()) notifySessionExpired()
    return new Response(JSON.stringify([]), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  const negocioActivo = getNegocioActivo()
  const isTenantScoped =
    path.includes('/api/disco/management/') ||
    path.includes('/api/disco/pedidos/') ||
    path.includes('/api/disco/billar/')
  if (isTenantScoped && !negocioActivo) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  headers['Authorization'] = `Bearer ${token}`
  if (negocioActivo) headers['X-Negocio-Id'] = negocioActivo
  const res = await fetch(path, { ...options, headers, credentials: 'include' })
  if (res.status === 401) {
    notifySessionExpired()
  }
  return res
}

export function limpiarNegocioGhostSiNoExiste(): boolean {
  try {
    const raw = sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const activo = parsed?.negocioActivo
    const negocios = Array.isArray(parsed.negocios) ? parsed.negocios : []
    const rol = parsed?.rol

    if (rol && rol !== 'SUPER' && rol !== 'MESERO') {
      const valido = activo && negocios.some((n: { id: string }) => n.id === activo)
      if (!valido) {
        if (negocios.length > 0) {
          // Auto-sanar: usar el primer negocio disponible
          parsed.negocioActivo = negocios[0].id
          const serialized = JSON.stringify(parsed)
          sessionStorage.setItem('monastery_session', serialized)
          localStorage.setItem('monastery_session', serialized)
        } else {
          // Sin negocios en sesión: forzar re-login para obtener datos frescos
          sessionStorage.removeItem('monastery_session')
          localStorage.removeItem('monastery_session')
        }
        return true
      }
      return false
    }

    // SUPER: limpiar negocioActivo si apunta a un negocio que no está en la lista
    if (activo && !negocios.some((n: { id: string }) => n.id === activo)) {
      parsed.negocioActivo = null
      const serialized = JSON.stringify(parsed)
      sessionStorage.setItem('monastery_session', serialized)
      localStorage.setItem('monastery_session', serialized)
      return true
    }
    return false
  } catch { return false }
}
