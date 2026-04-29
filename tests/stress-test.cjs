/**
 * ═══════════════════════════════════════════════════════════════
 *  STRESS TEST — Monastery Club Pedidos
 * ═══════════════════════════════════════════════════════════════
 *
 *  Simula N meseros enviando pedidos simultáneamente al backend
 *  y verifica que el admin los recibe TODOS por Socket.IO.
 *
 *  Uso:
 *    node tests/stress-test.js
 *
 *  Configuración (editar abajo):
 *    NUM_MESEROS       — cuántos meseros simulados
 *    PEDIDOS_POR_MESA  — pedidos que envía cada mesero
 *    DELAY_MAX_MS      — delay aleatorio máximo entre pedidos
 *    API_URL           — base URL del backend REST
 *    SOCKET_URL        — URL del servidor Socket.IO
 *    ADMIN_USER/PASS   — credenciales del admin
 *    MESERO_USERS      — array de credenciales de meseros
 *
 *  Requisitos:
 *    npm install socket.io-client   (ya está en el proyecto)
 *
 * ═══════════════════════════════════════════════════════════════
 */

const { io } = require('socket.io-client')

// ─── CONFIGURACIÓN ──────────────────────────────────────────

const CONFIG = {
  API_URL: 'http://localhost:8081/api/disco',
  SOCKET_URL: 'http://localhost:3001',

  // Credenciales admin (recibe los pedidos)
  ADMIN_USER: 'admin',
  ADMIN_PASS: 'admin123',

  // Credenciales meseros (envían pedidos)
  // Si tienes meseros con login, agrégalos aquí.
  // Si no, usaremos el admin para crear pedidos simulando cada mesero.
  MESERO_USERS: [
    // { username: 'mesero1', password: 'pass1' },
    // { username: 'mesero2', password: 'pass2' },
  ],

  // Parámetros de carga
  NUM_MESEROS: 5,           // Meseros simultáneos
  PEDIDOS_POR_MESERO: 10,   // Pedidos que envía cada mesero
  DELAY_MAX_MS: 2000,       // Delay aleatorio máximo entre pedidos (ms)
  DELAY_MIN_MS: 100,        // Delay mínimo entre pedidos (ms)
  PRODUCTOS_POR_PEDIDO: 3,  // Productos por pedido (aleatorio 1..N)
  TIMEOUT_MS: 60000,        // Timeout máximo para el test completo
}

// ─── UTILIDADES ─────────────────────────────────────────────

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
}

function log(color, prefix, msg) {
  const time = new Date().toISOString().slice(11, 23)
  console.log(`${colors.dim}${time}${colors.reset} ${color}${prefix}${colors.reset} ${msg}`)
}

function logAdmin(msg) { log(colors.magenta, '[ADMIN]', msg) }
function logMesero(id, msg) { log(colors.cyan, `[MESERO ${id}]`, msg) }
function logOk(msg) { log(colors.green, '[✓]', msg) }
function logFail(msg) { log(colors.red, '[✗]', msg) }
function logInfo(msg) { log(colors.yellow, '[i]', msg) }

function randomDelay() {
  const { DELAY_MIN_MS, DELAY_MAX_MS } = CONFIG
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS)) + DELAY_MIN_MS
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  return res
}

// ─── PASO 1: LOGIN ──────────────────────────────────────────

async function login(username, password, rol = 'ADMINISTRADOR') {
  const res = await apiFetch(`${CONFIG.API_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password, rol }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Login failed for ${username}: ${res.status} — ${body}`)
  }
  return res.json()
}

// ─── PASO 2: OBTENER DATOS (mesas, meseros, productos) ─────

async function fetchData(token) {
  const headers = { Authorization: `Bearer ${token}` }

  const [mesasRes, meserosRes, productosRes] = await Promise.all([
    apiFetch(`${CONFIG.API_URL}/management/mesas`, { headers }),
    apiFetch(`${CONFIG.API_URL}/management/meseros`, { headers }),
    apiFetch(`${CONFIG.API_URL}/management/productos`, { headers }),
  ])

  if (!mesasRes.ok) throw new Error(`Fetch mesas failed: ${mesasRes.status}`)
  if (!meserosRes.ok) throw new Error(`Fetch meseros failed: ${meserosRes.status}`)
  if (!productosRes.ok) throw new Error(`Fetch productos failed: ${productosRes.status}`)

  const mesas = await mesasRes.json()
  const meseros = await meserosRes.json()
  const productos = await productosRes.json()

  return {
    mesas: mesas.filter(m => m.estado !== 'OCUPADA'),
    meseros: meseros.filter(m => m.activo),
    productos: productos.filter(p => p.activo),
  }
}

// ─── PASO 3: CONECTAR SOCKET ADMIN ─────────────────────────

function connectAdminSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(CONFIG.SOCKET_URL, {
      query: { token },
      reconnection: false,
      transports: ['websocket', 'polling'],
    })

    const timeout = setTimeout(() => {
      socket.disconnect()
      reject(new Error('Socket admin: timeout de conexión'))
    }, 10000)

    socket.on('connect', () => {
      clearTimeout(timeout)
      logAdmin(`Socket conectado (id: ${socket.id})`)
      resolve(socket)
    })

    socket.on('connect_error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Socket admin error: ${err.message}`))
    })
  })
}

// ─── PASO 4: ATENDER MESAS ─────────────────────────────────

async function atenderMesa(token, mesaId, meseroId, nombre) {
  const res = await apiFetch(`${CONFIG.API_URL}/pedidos/mesas/${mesaId}/atender`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ meseroId, nombreCliente: nombre }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Atender mesa failed: ${res.status} — ${body}`)
  }
  return res.json()
}

// ─── PASO 5: CREAR PEDIDO ───────────────────────────────────

async function crearPedido(token, mesaId, meseroId, productos) {
  const numProductos = Math.floor(Math.random() * CONFIG.PRODUCTOS_POR_PEDIDO) + 1
  const lineas = []
  const usados = new Set()

  for (let i = 0; i < numProductos && i < productos.length; i++) {
    let idx
    do { idx = Math.floor(Math.random() * productos.length) } while (usados.has(idx))
    usados.add(idx)
    lineas.push({
      productoId: productos[idx].id,
      cantidad: Math.floor(Math.random() * 4) + 1,
    })
  }

  const res = await apiFetch(`${CONFIG.API_URL}/pedidos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mesaId, meseroId, lineas, nota: `Stress test ${Date.now()}` }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Crear pedido failed: ${res.status} — ${body}`)
  }
  return res.json()
}

// ─── PASO 6: SIMULAR UN MESERO ──────────────────────────────

async function simularMesero(index, token, mesaId, meseroId, productos, stats) {
  const meseroLabel = index + 1

  for (let p = 0; p < CONFIG.PEDIDOS_POR_MESERO; p++) {
    try {
      const start = Date.now()
      const pedido = await crearPedido(token, mesaId, meseroId, productos)
      const elapsed = Date.now() - start

      stats.enviados++
      stats.tiempos.push(elapsed)
      logMesero(meseroLabel, `Pedido #${pedido.ticketDia} creado (${elapsed}ms) — $${Number(pedido.total).toLocaleString('es-CO')}`)

      // Delay aleatorio entre pedidos
      if (p < CONFIG.PEDIDOS_POR_MESERO - 1) {
        await sleep(randomDelay())
      }
    } catch (err) {
      stats.fallidos++
      logFail(`Mesero ${meseroLabel} — pedido ${p + 1} falló: ${err.message}`)
    }
  }
}


async function main() {
  console.log('')
  console.log(`${colors.bold}${colors.yellow}═══════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bold}${colors.yellow}  STRESS TEST — Monastery Club Pedidos${colors.reset}`)
  console.log(`${colors.bold}${colors.yellow}═══════════════════════════════════════════════════════════${colors.reset}`)
  console.log('')

  const totalEsperado = CONFIG.NUM_MESEROS * CONFIG.PEDIDOS_POR_MESERO
  logInfo(`Configuración: ${CONFIG.NUM_MESEROS} meseros × ${CONFIG.PEDIDOS_POR_MESERO} pedidos = ${totalEsperado} pedidos totales`)
  logInfo(`Delay entre pedidos: ${CONFIG.DELAY_MIN_MS}-${CONFIG.DELAY_MAX_MS}ms`)
  logInfo(`Productos por pedido: 1-${CONFIG.PRODUCTOS_POR_PEDIDO}`)
  console.log('')

  // ── 1. Login admin ──
  logAdmin('Iniciando sesión...')
  let adminSession
  try {
    adminSession = await login(CONFIG.ADMIN_USER, CONFIG.ADMIN_PASS)
    logAdmin(`Sesión iniciada como "${adminSession.nombre}" (${adminSession.rol})`)
  } catch (err) {
    logFail(`No se pudo iniciar sesión como admin: ${err.message}`)
    process.exit(1)
  }

  const adminToken = adminSession.accessToken

  // ── 2. Obtener datos ──
  logInfo('Cargando mesas, meseros y productos...')
  let data
  try {
    data = await fetchData(adminToken)
    logInfo(`${data.mesas.length} mesas libres, ${data.meseros.length} meseros activos, ${data.productos.length} productos activos`)
  } catch (err) {
    logFail(`No se pudieron cargar datos: ${err.message}`)
    process.exit(1)
  }

  if (data.mesas.length < CONFIG.NUM_MESEROS) {
    logFail(`Se necesitan ${CONFIG.NUM_MESEROS} mesas libres pero solo hay ${data.mesas.length}`)
    logInfo('Tip: crea más mesas en Configuración o reduce NUM_MESEROS')
    process.exit(1)
  }
  if (data.meseros.length === 0) {
    logFail('No hay meseros activos')
    process.exit(1)
  }
  if (data.productos.length === 0) {
    logFail('No hay productos activos')
    process.exit(1)
  }

  // ── 3. Conectar socket admin para escuchar nuevo_pedido ──
  logAdmin('Conectando Socket.IO para escuchar pedidos...')
  let adminSocket
  try {
    adminSocket = await connectAdminSocket(adminToken)
  } catch (err) {
    logFail(`Socket admin: ${err.message}`)
    process.exit(1)
  }

  const recibidos = []
  adminSocket.on('nuevo_pedido', (pedido) => {
    recibidos.push({ id: pedido.id, ticketDia: pedido.ticketDia, recibidoEn: Date.now() })
  })

  // ── 4. Atender mesas (asignar mesero a cada mesa) ──
  logInfo('Atendiendo mesas...')
  const asignaciones = []
  for (let i = 0; i < CONFIG.NUM_MESEROS; i++) {
    const mesa = data.mesas[i]
    const mesero = data.meseros[i % data.meseros.length]
    try {
      await atenderMesa(adminToken, mesa.id, mesero.id, `StressTest-${i + 1}`)
      asignaciones.push({ mesaId: mesa.id, meseroId: mesero.id, mesaNombre: mesa.nombre, meseroNombre: mesero.nombre })
      logInfo(`Mesa "${mesa.nombre}" → ${mesero.nombre}`)
    } catch (err) {
      // Si la mesa ya está ocupada, intentar usarla igual
      logFail(`Atender mesa "${mesa.nombre}" falló: ${err.message}`)
      asignaciones.push({ mesaId: mesa.id, meseroId: mesero.id, mesaNombre: mesa.nombre, meseroNombre: mesero.nombre })
    }
  }

  // ── 5. LANZAR RÁFAGA DE PEDIDOS ──
  console.log('')
  logInfo(`${colors.bold}¡INICIANDO RÁFAGA DE PEDIDOS!${colors.reset}`)
  console.log('')

  const stats = { enviados: 0, fallidos: 0, tiempos: [] }
  const inicio = Date.now()

  // Lanzar todos los meseros en paralelo
  const promesas = asignaciones.map((asig, i) =>
    simularMesero(i, adminToken, asig.mesaId, asig.meseroId, data.productos, stats)
  )

  await Promise.all(promesas)
  const duracionEnvio = Date.now() - inicio

  // ── 6. Esperar que lleguen todos los eventos socket ──
  logAdmin('Esperando eventos Socket.IO...')
  const maxWait = 10000
  const waitStart = Date.now()
  while (recibidos.length < stats.enviados && (Date.now() - waitStart) < maxWait) {
    await sleep(200)
  }
  const duracionTotal = Date.now() - inicio

  adminSocket.disconnect()

  // ── 7. REPORTE FINAL ──
  console.log('')
  console.log(`${colors.bold}${colors.yellow}═══════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bold}${colors.yellow}  RESULTADOS${colors.reset}`)
  console.log(`${colors.bold}${colors.yellow}═══════════════════════════════════════════════════════════${colors.reset}`)
  console.log('')

  const avgTime = stats.tiempos.length ? Math.round(stats.tiempos.reduce((a, b) => a + b, 0) / stats.tiempos.length) : 0
  const maxTime = stats.tiempos.length ? Math.max(...stats.tiempos) : 0
  const minTime = stats.tiempos.length ? Math.min(...stats.tiempos) : 0
  const p95 = stats.tiempos.length ? stats.tiempos.sort((a, b) => a - b)[Math.floor(stats.tiempos.length * 0.95)] : 0

  console.log(`  ${colors.bold}Pedidos enviados:${colors.reset}       ${stats.enviados} / ${totalEsperado}`)
  console.log(`  ${colors.bold}Pedidos fallidos:${colors.reset}       ${stats.fallidos > 0 ? colors.red : colors.green}${stats.fallidos}${colors.reset}`)
  console.log(`  ${colors.bold}Socket recibidos:${colors.reset}       ${recibidos.length} / ${stats.enviados} ${recibidos.length === stats.enviados ? colors.green + '(100%)' : colors.red + `(${Math.round(recibidos.length / stats.enviados * 100)}%)`}${colors.reset}`)
  console.log('')
  console.log(`  ${colors.bold}Tiempo total envío:${colors.reset}     ${(duracionEnvio / 1000).toFixed(1)}s`)
  console.log(`  ${colors.bold}Tiempo total (+ wait):${colors.reset}  ${(duracionTotal / 1000).toFixed(1)}s`)
  console.log(`  ${colors.bold}Throughput:${colors.reset}             ${(stats.enviados / (duracionEnvio / 1000)).toFixed(1)} pedidos/seg`)
  console.log('')
  console.log(`  ${colors.bold}Latencia API:${colors.reset}`)
  console.log(`    Min:    ${minTime}ms`)
  console.log(`    Avg:    ${avgTime}ms`)
  console.log(`    P95:    ${p95}ms`)
  console.log(`    Max:    ${maxTime}ms`)
  console.log('')

  // ── Diagnóstico ──
  if (stats.fallidos > 0) {
    logFail(`${stats.fallidos} pedidos fallaron — revisar logs arriba para detalles`)
  }
  if (recibidos.length < stats.enviados) {
    logFail(`¡Socket.IO perdió ${stats.enviados - recibidos.length} eventos! El admin no recibió todos los pedidos.`)
    logInfo('Posibles causas: buffer overflow en Socket.IO, timeout del servidor, o el evento no se emitió.')
  }
  if (stats.fallidos === 0 && recibidos.length === stats.enviados) {
    console.log(`  ${colors.green}${colors.bold}★ RESULTADO: PERFECTO — 0 errores, 0 eventos perdidos ★${colors.reset}`)
  } else if (stats.fallidos === 0) {
    console.log(`  ${colors.yellow}${colors.bold}⚠ RESULTADO: API OK pero Socket.IO perdió eventos ⚠${colors.reset}`)
  } else {
    console.log(`  ${colors.red}${colors.bold}✗ RESULTADO: HAY FALLOS — revisar backend ✗${colors.reset}`)
  }

  console.log('')
  console.log(`${colors.dim}─────────────────────────────────────────────────────────${colors.reset}`)
  console.log(`${colors.dim}  Para limpiar los pedidos de prueba, paga las mesas     ${colors.reset}`)
  console.log(`${colors.dim}  desde el panel de admin o reinicia la BD.              ${colors.reset}`)
  console.log(`${colors.dim}─────────────────────────────────────────────────────────${colors.reset}`)
  console.log('')

  process.exit(stats.fallidos > 0 || recibidos.length < stats.enviados ? 1 : 0)
}

main().catch(err => {
  logFail(`Error fatal: ${err.message}`)
  console.error(err)
  process.exit(1)
})
