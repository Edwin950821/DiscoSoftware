// Config stub — API calls replaced by Dexie.js local DB
// These exports are kept so any remaining imports don't break at compile time

export const API_URL = ''
export const API_MANAGEMENT = ''
export const API_PEDIDOS = ''

export function apiFetch(_url: string, _options: RequestInit = {}): Promise<Response> {
  // Should never be called — all data goes through Dexie hooks now
  return Promise.resolve(new Response(JSON.stringify({ error: 'Local mode — use Dexie' }), { status: 501 }))
}
