const BASE = import.meta.env.VITE_API_URL || '/api/disco'
export const API_URL = `${BASE}/auth`
export const API_MANAGEMENT = `${BASE}/management`

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, options)
}
