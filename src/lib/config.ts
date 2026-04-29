
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
  // Endpoints tenant-scoped requieren negocioActivo. SUPER en vista consolidada
  // no tiene negocioActivo; los hooks (useProductos, useMeseros, etc.) corren igual
  // en cada render. Devolvemos [] silenciosamente para no spamear backend con 500s.
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
