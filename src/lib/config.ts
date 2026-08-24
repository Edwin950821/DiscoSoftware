export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.DEV
    ? 'http://localhost:8082'
    : 'https://api.monasteryclub.com')
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

// LOG TEMPORAL - borrar después de diagnosticar
function logDebug401(path: string, status: number) {
  try {
    const raw = localStorage.getItem('monastery_debug_401')
    let log: unknown[] = []
    try { log = JSON.parse(raw || '[]') } catch { log = [] }
    if (!Array.isArray(log)) log = []
    log.push({
      path,
      status,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      hadSession: !!readStoredSession(),
    })
    localStorage.setItem('monastery_debug_401', JSON.stringify(log.slice(-10)))
  } catch { /* noop */ }
}

async function notifySessionExpired(path: string, status: number) {
  if (sessionExpiredHandled) return
  sessionExpiredHandled = true
  logDebug401(path, status)
  sessionStorage.setItem('monastery_session_expired', '1')
  sessionStorage.removeItem('monastery_session')
  localStorage.removeItem('monastery_session')
  window.location.reload()
}


export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const negocioActivo = getNegocioActivo()
  const isTenantScoped =
    path.includes('/api/disco/management/') ||
    path.includes('/api/disco/pedidos/') ||
    path.includes('/api/disco/billar/')
  if (isTenantScoped && !negocioActivo) {
    return new Response(JSON.stringify({ error: 'Negocio no seleccionado' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (negocioActivo) headers['X-Negocio-Id'] = negocioActivo
  const signal = options.signal ?? AbortSignal.timeout(30000)
  const res = await fetch(path, { ...options, signal, headers, credentials: 'include' })
  if (res.status === 401 || res.status === 403) {
    notifySessionExpired(path, res.status)
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
          parsed.negocioActivo = negocios[0].id
          const serialized = JSON.stringify(parsed)
          sessionStorage.setItem('monastery_session', serialized)
          localStorage.setItem('monastery_session', serialized)
        } else {
          sessionStorage.removeItem('monastery_session')
          localStorage.removeItem('monastery_session')
        }
        return true
      }
      return false
    }

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