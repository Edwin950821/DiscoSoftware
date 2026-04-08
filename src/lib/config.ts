// API Backend
// En desarrollo (npm run dev) → backend local en :8081
// En producción (npm run build) → backend en Render
export const API_BASE = import.meta.env.DEV
  ? 'http://localhost:8081'
  : 'https://monastery-backend-dmby.onrender.com'
export const API_DISCO = `${API_BASE}/api/disco`
export const API_MANAGEMENT = `${API_DISCO}/management`
export const API_PEDIDOS = `${API_DISCO}/pedidos`
export const API_AUTH = `${API_DISCO}/auth`

function getToken(): string | null {
  try {
    const raw = sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
    if (!raw) return null
    return JSON.parse(raw).accessToken || null
  } catch { return null }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  if (!token) {
    return new Response(JSON.stringify([]), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  headers['Authorization'] = `Bearer ${token}`
  return fetch(path, { ...options, headers, credentials: 'include' })
}
