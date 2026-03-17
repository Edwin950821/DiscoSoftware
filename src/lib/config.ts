const BASE = import.meta.env.VITE_API_URL || '/api/disco'
export const API_URL = `${BASE}/auth`
export const API_MANAGEMENT = `${BASE}/management`
export const API_PEDIDOS = `${BASE}/pedidos`

const PUBLIC_PATHS = ['/auth/login', '/auth/logout', '/auth/refresh']

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  const headers = new Headers(options.headers as HeadersInit | undefined)
  const isPublic = PUBLIC_PATHS.some(p => url.includes(p))
  if (!isPublic) {
    try {
      const raw = sessionStorage.getItem('monastery_session') || localStorage.getItem('monastery_session')
      if (raw && !headers.has('Authorization')) {
        const { accessToken } = JSON.parse(raw)
        if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
      }
    } catch { /* */ }
  }

  return fetch(url, { ...options, headers, signal: controller.signal }).finally(() => clearTimeout(timeout))
}
