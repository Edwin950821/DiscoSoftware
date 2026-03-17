const { io } = require('socket.io-client')

const CONFIG = {
  API_URL: 'http://localhost:8081/api/disco',
  SOCKET_URL: 'http://localhost:3001',

  ADMIN_USER: 'admin',
  ADMIN_PASS: 'admin123',

  NUM_MESEROS: 50,
  PEDIDOS_POR_MESERO: 5,
  DELAY_MIN_MS: 50,
  DELAY_MAX_MS: 500,
  PRODUCTOS_POR_PEDIDO: 4,
  DESPACHAR_PEDIDOS: true,
  PAGAR_CUENTAS: true,
  TIMEOUT_MS: 120000,
}

const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m',
}

const ts = () => new Date().toISOString().slice(11, 23)
const log = (c, pre, msg) => console.log(`${C.dim}${ts()}${C.reset} ${c}${pre}${C.reset} ${msg}`)
const logA = msg => log(C.magenta, '[ADMIN]', msg)
const logM = (id, msg) => log(C.cyan, `[M${String(id).padStart(2, '0')}]`, msg)
const logOk = msg => log(C.green, '[OK]', msg)
const logErr = msg => log(C.red, '[ERR]', msg)
const logI = msg => log(C.yellow, '[i]', msg)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const rand = (min, max) => Math.floor(Math.random() * (max - min)) + min

async function api(url, opts = {}) {
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } })
}

async function authedApi(url, token, opts = {}) {
  return api(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } })
}

async function login(username, password, rol = 'ADMINISTRADOR') {
  const res = await api(`${CONFIG.API_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password, rol }),
  })
  if (!res.ok) throw new Error(`Login ${username}: ${res.status} — ${await res.text()}`)
  return res.json()
}

function connectSocket(token, meseroId) {
  return new Promise((resolve, reject) => {
    const query = { token }
    if (meseroId) query.meseroId = meseroId
    const socket = io(CONFIG.SOCKET_URL, { query, reconnection: false, transports: ['websocket', 'polling'] })
    const timeout = setTimeout(() => { socket.disconnect(); reject(new Error('Socket timeout')) }, 10000)
    socket.on('connect', () => { clearTimeout(timeout); resolve(socket) })
    socket.on('connect_error', err => { clearTimeout(timeout); reject(err) })
  })
}

async function main() {
  console.log('')
  console.log(`${C.bold}${C.yellow}${'='.repeat(65)}${C.reset}`)
  console.log(`${C.bold}${C.yellow}  STRESS TEST MESEROS — Monastery Club (${CONFIG.NUM_MESEROS} meseros)${C.reset}`)
  console.log(`${C.bold}${C.yellow}${'='.repeat(65)}${C.reset}`)
  console.log('')

  const total = CONFIG.NUM_MESEROS * CONFIG.PEDIDOS_POR_MESERO
  logI(`${CONFIG.NUM_MESEROS} meseros x ${CONFIG.PEDIDOS_POR_MESERO} pedidos = ${total} pedidos`)
  logI(`Delay: ${CONFIG.DELAY_MIN_MS}-${CONFIG.DELAY_MAX_MS}ms | Productos/pedido: 1-${CONFIG.PRODUCTOS_POR_PEDIDO}`)
  logI(`Despachar: ${CONFIG.DESPACHAR_PEDIDOS} | Pagar: ${CONFIG.PAGAR_CUENTAS}`)
  console.log('')

  logA('Login admin...')
  const adminSession = await login(CONFIG.ADMIN_USER, CONFIG.ADMIN_PASS)
  const adminToken = adminSession.accessToken
  logA(`OK — ${adminSession.nombre}`)

  logI('Cargando datos...')
  const [mesasRes, meserosRes, productosRes] = await Promise.all([
    authedApi(`${CONFIG.API_URL}/management/mesas`, adminToken),
    authedApi(`${CONFIG.API_URL}/management/meseros`, adminToken),
    authedApi(`${CONFIG.API_URL}/management/productos`, adminToken),
  ])

  const mesas = (await mesasRes.json()).filter(m => m.estado !== 'OCUPADA')
  const meseros = (await meserosRes.json()).filter(m => m.activo)
  const productos = (await productosRes.json()).filter(p => p.activo)

  logI(`${mesas.length} mesas libres, ${meseros.length} meseros, ${productos.length} productos`)

  if (mesas.length < CONFIG.NUM_MESEROS) {
    logErr(`Necesitas ${CONFIG.NUM_MESEROS} mesas libres, solo hay ${mesas.length}`)
    logI('Crea mas mesas en Configuracion o reduce NUM_MESEROS')
    process.exit(1)
  }

  logA('Conectando socket admin...')
  const adminSocket = await connectSocket(adminToken)
  logA(`Socket OK (${adminSocket.id})`)

  const stats = {
    pedidosEnviados: 0,
    pedidosFallidos: 0,
    despachos: 0,
    despachosFallidos: 0,
    pagos: 0,
    pagosFallidos: 0,
    socketNuevoPedido: 0,
    socketDespachado: 0,
    socketCuentaPagada: 0,
    tiemposCrear: [],
    tiemposDespachar: [],
    tiemposPagar: [],
    errores: [],
    cuentasTotalCheck: [],
  }

  const pedidoIds = []

  adminSocket.on('nuevo_pedido', () => { stats.socketNuevoPedido++ })
  adminSocket.on('pedido_despachado', () => { stats.socketDespachado++ })
  adminSocket.on('cuenta_pagada', () => { stats.socketCuentaPagada++ })

  logI('Atendiendo mesas...')
  const asignaciones = []
  const atencionStart = Date.now()

  const batchSize = 10
  for (let b = 0; b < CONFIG.NUM_MESEROS; b += batchSize) {
    const batch = []
    for (let i = b; i < Math.min(b + batchSize, CONFIG.NUM_MESEROS); i++) {
      const mesa = mesas[i]
      const mesero = meseros[i % meseros.length]
      batch.push(
        authedApi(`${CONFIG.API_URL}/pedidos/mesas/${mesa.id}/atender`, adminToken, {
          method: 'POST',
          body: JSON.stringify({ meseroId: mesero.id, nombreCliente: `Stress-${i + 1}` }),
        }).then(async res => {
          if (!res.ok) {
            const body = await res.text()
            stats.errores.push(`Atender ${mesa.nombre}: ${body}`)
          }
          asignaciones[i] = { mesaId: mesa.id, meseroId: mesero.id, mesa: mesa.nombre, mesero: mesero.nombre }
        }).catch(err => {
          stats.errores.push(`Atender ${mesa.nombre}: ${err.message}`)
          asignaciones[i] = { mesaId: mesa.id, meseroId: mesero.id, mesa: mesa.nombre, mesero: mesero.nombre }
        })
      )
    }
    await Promise.all(batch)
  }

  const atencionTime = Date.now() - atencionStart
  logOk(`${asignaciones.length} mesas atendidas en ${atencionTime}ms`)
  console.log('')

  console.log(`${C.bold}${C.yellow}  FASE 1: RAFAGA DE PEDIDOS${C.reset}`)
  console.log('')

  const pedidoStart = Date.now()

  async function simularMesero(idx) {
    const asig = asignaciones[idx]
    const label = idx + 1

    for (let p = 0; p < CONFIG.PEDIDOS_POR_MESERO; p++) {
      try {
        const numProd = rand(1, CONFIG.PRODUCTOS_POR_PEDIDO + 1)
        const usados = new Set()
        const lineas = []
        for (let j = 0; j < numProd && j < productos.length; j++) {
          let idx2
          do { idx2 = rand(0, productos.length) } while (usados.has(idx2))
          usados.add(idx2)
          lineas.push({ productoId: productos[idx2].id, cantidad: rand(1, 5) })
        }

        const t0 = Date.now()
        const res = await authedApi(`${CONFIG.API_URL}/pedidos`, adminToken, {
          method: 'POST',
          body: JSON.stringify({ mesaId: asig.mesaId, meseroId: asig.meseroId, lineas }),
        })
        const elapsed = Date.now() - t0

        if (!res.ok) {
          stats.pedidosFallidos++
          const body = await res.text()
          stats.errores.push(`M${label} pedido ${p + 1}: ${body}`)
          logErr(`M${label} pedido ${p + 1} FALLO (${elapsed}ms)`)
        } else {
          const pedido = await res.json()
          stats.pedidosEnviados++
          stats.tiemposCrear.push(elapsed)
          pedidoIds.push({ id: pedido.id, mesaId: asig.mesaId, total: pedido.total })
          if (label <= 5 || p === 0) {
            logM(label, `Ticket #${pedido.ticketDia} — $${Number(pedido.total).toLocaleString('es-CO')} (${elapsed}ms)`)
          }
        }

        if (p < CONFIG.PEDIDOS_POR_MESERO - 1) {
          await sleep(rand(CONFIG.DELAY_MIN_MS, CONFIG.DELAY_MAX_MS))
        }
      } catch (err) {
        stats.pedidosFallidos++
        stats.errores.push(`M${label} pedido ${p + 1}: ${err.message}`)
      }
    }
  }

  const concurrencyBatch = 10
  for (let b = 0; b < CONFIG.NUM_MESEROS; b += concurrencyBatch) {
    const batch = []
    for (let i = b; i < Math.min(b + concurrencyBatch, CONFIG.NUM_MESEROS); i++) {
      batch.push(simularMesero(i))
    }
    await Promise.all(batch)
    if (b + concurrencyBatch < CONFIG.NUM_MESEROS) {
      logI(`Lote ${Math.floor(b / concurrencyBatch) + 1}/${Math.ceil(CONFIG.NUM_MESEROS / concurrencyBatch)} completado (${stats.pedidosEnviados} enviados)`)
    }
  }

  const pedidoTime = Date.now() - pedidoStart
  logOk(`Fase 1 completada: ${stats.pedidosEnviados} pedidos en ${(pedidoTime / 1000).toFixed(1)}s`)
  console.log('')

  if (CONFIG.DESPACHAR_PEDIDOS && pedidoIds.length > 0) {
    console.log(`${C.bold}${C.yellow}  FASE 2: DESPACHAR PEDIDOS (admin)${C.reset}`)
    console.log('')

    const despacharStart = Date.now()
    const despachBatch = 15

    for (let b = 0; b < pedidoIds.length; b += despachBatch) {
      const batch = pedidoIds.slice(b, b + despachBatch).map(async p => {
        try {
          const t0 = Date.now()
          const res = await authedApi(`${CONFIG.API_URL}/pedidos/${p.id}/despachar`, adminToken, { method: 'PATCH' })
          const elapsed = Date.now() - t0
          if (res.ok) {
            stats.despachos++
            stats.tiemposDespachar.push(elapsed)
          } else {
            stats.despachosFallidos++
            const body = await res.text()
            stats.errores.push(`Despachar ${p.id}: ${body}`)
          }
        } catch (err) {
          stats.despachosFallidos++
          stats.errores.push(`Despachar ${p.id}: ${err.message}`)
        }
      })
      await Promise.all(batch)
    }

    const despacharTime = Date.now() - despacharStart
    logOk(`Fase 2: ${stats.despachos} despachados en ${(despacharTime / 1000).toFixed(1)}s`)
    console.log('')
  }

  if (CONFIG.PAGAR_CUENTAS && pedidoIds.length > 0) {
    console.log(`${C.bold}${C.yellow}  FASE 3: PAGAR CUENTAS + VERIFICAR TOTALES${C.reset}`)
    console.log('')

    await sleep(1000)

    const mesaIds = [...new Set(pedidoIds.map(p => p.mesaId))]
    const pagarStart = Date.now()

    for (const mesaId of mesaIds) {
      try {
        const cuentaRes = await authedApi(`${CONFIG.API_URL}/pedidos/mesas/${mesaId}/cuenta`, adminToken)
        if (cuentaRes.ok) {
          const cuenta = await cuentaRes.json()
          if (cuenta && !cuenta.message) {
            const expectedTotal = pedidoIds
              .filter(p => p.mesaId === mesaId)
              .reduce((s, p) => s + p.total, 0)

            const actualTotal = cuenta.pedidos
              ? cuenta.pedidos.reduce((s, p) => s + p.total, 0)
              : cuenta.total

            stats.cuentasTotalCheck.push({
              mesaId,
              expected: expectedTotal,
              actual: actualTotal,
              match: expectedTotal === actualTotal,
            })

            if (expectedTotal !== actualTotal) {
              logErr(`Mesa ${mesaId}: total esperado $${expectedTotal} != actual $${actualTotal} (BUG!)`)
            }

            const t0 = Date.now()
            const pagarRes = await authedApi(`${CONFIG.API_URL}/pedidos/mesas/${mesaId}/pagar`, adminToken, { method: 'POST' })
            const elapsed = Date.now() - t0
            if (pagarRes.ok) {
              stats.pagos++
              stats.tiemposPagar.push(elapsed)
            } else {
              stats.pagosFallidos++
              stats.errores.push(`Pagar mesa ${mesaId}: ${await pagarRes.text()}`)
            }
          }
        }
      } catch (err) {
        stats.pagosFallidos++
        stats.errores.push(`Pagar mesa ${mesaId}: ${err.message}`)
      }
    }

    const pagarTime = Date.now() - pagarStart
    logOk(`Fase 3: ${stats.pagos} cuentas pagadas en ${(pagarTime / 1000).toFixed(1)}s`)
    console.log('')
  }

  logA('Esperando eventos socket...')
  const waitStart = Date.now()
  const expectedSocket = stats.pedidosEnviados
  while (stats.socketNuevoPedido < expectedSocket && (Date.now() - waitStart) < 10000) {
    await sleep(200)
  }
  adminSocket.disconnect()

  const totalTime = Date.now() - pedidoStart

  console.log('')
  console.log(`${C.bold}${C.yellow}${'='.repeat(65)}${C.reset}`)
  console.log(`${C.bold}${C.yellow}  RESULTADOS${C.reset}`)
  console.log(`${C.bold}${C.yellow}${'='.repeat(65)}${C.reset}`)
  console.log('')

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  const p95 = arr => arr.length ? arr.sort((a, b) => a - b)[Math.floor(arr.length * 0.95)] : 0
  const max = arr => arr.length ? Math.max(...arr) : 0
  const min = arr => arr.length ? Math.min(...arr) : 0

  const col = (label, val) => `  ${C.bold}${label.padEnd(28)}${C.reset} ${val}`
  const ok = v => `${C.green}${v}${C.reset}`
  const fail = v => `${C.red}${v}${C.reset}`
  const warn = v => `${C.yellow}${v}${C.reset}`

  console.log(`${C.bold}  PEDIDOS${C.reset}`)
  console.log(col('Enviados:', `${stats.pedidosEnviados} / ${total}`))
  console.log(col('Fallidos:', stats.pedidosFallidos > 0 ? fail(stats.pedidosFallidos) : ok(0)))
  console.log(col('Throughput:', `${(stats.pedidosEnviados / (pedidoTime / 1000)).toFixed(1)} pedidos/seg`))
  console.log(col('Latencia min/avg/p95/max:', `${min(stats.tiemposCrear)}/${avg(stats.tiemposCrear)}/${p95(stats.tiemposCrear)}/${max(stats.tiemposCrear)}ms`))
  console.log('')

  if (CONFIG.DESPACHAR_PEDIDOS) {
    console.log(`${C.bold}  DESPACHOS${C.reset}`)
    console.log(col('Despachados:', `${stats.despachos} / ${stats.pedidosEnviados}`))
    console.log(col('Fallidos:', stats.despachosFallidos > 0 ? fail(stats.despachosFallidos) : ok(0)))
    console.log(col('Latencia min/avg/p95/max:', `${min(stats.tiemposDespachar)}/${avg(stats.tiemposDespachar)}/${p95(stats.tiemposDespachar)}/${max(stats.tiemposDespachar)}ms`))
    console.log('')
  }

  if (CONFIG.PAGAR_CUENTAS) {
    console.log(`${C.bold}  PAGOS + INTEGRIDAD${C.reset}`)
    console.log(col('Cuentas pagadas:', `${stats.pagos} / ${CONFIG.NUM_MESEROS}`))
    console.log(col('Pagos fallidos:', stats.pagosFallidos > 0 ? fail(stats.pagosFallidos) : ok(0)))
    const totalChecks = stats.cuentasTotalCheck.length
    const matchCount = stats.cuentasTotalCheck.filter(c => c.match).length
    const mismatch = totalChecks - matchCount
    console.log(col('Totales correctos:', mismatch > 0 ? fail(`${matchCount}/${totalChecks} (${mismatch} ERRORES)`) : ok(`${matchCount}/${totalChecks}`)))
    if (mismatch > 0) {
      stats.cuentasTotalCheck.filter(c => !c.match).forEach(c => {
        console.log(`    ${C.red}Mesa ${c.mesaId}: esperado $${c.expected} vs actual $${c.actual}${C.reset}`)
      })
    }
    console.log(col('Latencia min/avg/p95/max:', `${min(stats.tiemposPagar)}/${avg(stats.tiemposPagar)}/${p95(stats.tiemposPagar)}/${max(stats.tiemposPagar)}ms`))
    console.log('')
  }

  console.log(`${C.bold}  SOCKET.IO${C.reset}`)
  const socketPct = stats.pedidosEnviados > 0 ? Math.round(stats.socketNuevoPedido / stats.pedidosEnviados * 100) : 0
  console.log(col('nuevo_pedido:', `${stats.socketNuevoPedido}/${stats.pedidosEnviados} (${socketPct}%)`))
  if (CONFIG.DESPACHAR_PEDIDOS) {
    const dPct = stats.despachos > 0 ? Math.round(stats.socketDespachado / stats.despachos * 100) : 0
    console.log(col('pedido_despachado:', `${stats.socketDespachado}/${stats.despachos} (${dPct}%)`))
  }
  if (CONFIG.PAGAR_CUENTAS) {
    console.log(col('cuenta_pagada:', `${stats.socketCuentaPagada}/${stats.pagos}`))
  }
  console.log('')

  console.log(col('Tiempo total:', `${(totalTime / 1000).toFixed(1)}s`))
  console.log('')

  if (stats.errores.length > 0 && stats.errores.length <= 10) {
    console.log(`${C.bold}  ERRORES (${stats.errores.length})${C.reset}`)
    stats.errores.forEach(e => console.log(`    ${C.red}${e}${C.reset}`))
    console.log('')
  } else if (stats.errores.length > 10) {
    console.log(`${C.bold}  ERRORES (${stats.errores.length}, mostrando 10)${C.reset}`)
    stats.errores.slice(0, 10).forEach(e => console.log(`    ${C.red}${e}${C.reset}`))
    console.log(`    ${C.dim}... y ${stats.errores.length - 10} mas${C.reset}`)
    console.log('')
  }

  const hasFails = stats.pedidosFallidos > 0 || stats.despachosFallidos > 0 || stats.pagosFallidos > 0
  const hasDataBugs = stats.cuentasTotalCheck.some(c => !c.match)
  const hasSocketLoss = stats.socketNuevoPedido < stats.pedidosEnviados

  if (!hasFails && !hasDataBugs && !hasSocketLoss) {
    console.log(`  ${C.green}${C.bold}PERFECTO — 0 errores, 0 datos corruptos, 0 eventos perdidos${C.reset}`)
  } else if (hasDataBugs) {
    console.log(`  ${C.red}${C.bold}FALLO CRITICO — Totales de cuentas no coinciden (race condition?)${C.reset}`)
  } else if (hasFails) {
    console.log(`  ${C.red}${C.bold}FALLOS — Revisar errores arriba${C.reset}`)
  } else if (hasSocketLoss) {
    console.log(`  ${C.yellow}${C.bold}API OK pero Socket.IO perdio ${stats.pedidosEnviados - stats.socketNuevoPedido} eventos${C.reset}`)
  }
  console.log('')

  process.exit(hasFails || hasDataBugs ? 1 : 0)
}

main().catch(err => {
  logErr(`Fatal: ${err.message}`)
  process.exit(1)
})
