# Monastery Club - Sistema de Gestion

Sistema de gestion operativa para discoteca **Monastery Club** en Baranoa, Colombia.
Control de liquidaciones diarias/semanales, inventario, comparativo de ventas, mesas de billar y cuadre de caja.

## Stack

| Tecnologia | Version | Uso |
|---|---|---|
| React | 19 | Frontend SPA |
| TypeScript | 5.9 | Tipado estatico |
| Vite | 8 | Build tool |
| Tailwind CSS | 4 | Estilos |
| Recharts | 3.8 | Graficos dashboard |
| Firebase | 12 | Hosting + Auth |
| Spring Boot | 3.2 | Backend API REST |
| PostgreSQL | 16 | Base de datos |
| Socket.IO | — | Notificaciones tiempo real |

## Arquitectura

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  Firebase        │     │  Spring Boot :8081    │     │ PostgreSQL   │
│  Hosting + Auth  │────▶│  REST API + JWT       │────▶│ :5432        │
│  (Frontend)      │     │  Socket.IO :3001      │     │ monastery    │
└─────────────────┘     └──────────────────────┘     └──────────────┘
```

## Requisitos

- Node.js 18+
- Java 17+
- PostgreSQL 16+
- Backend corriendo en `http://localhost:8081` ([DiscoSoftBack](https://github.com/Edwin950821/DiscoSoftBack))

## Instalacion

```bash
git clone https://github.com/Edwin950821/DiscoSoftware.git
cd DiscoSoftware
npm install
```

## Variables de entorno

Crear archivo `.env.local` en la raiz:

```env
VITE_API_URL=http://localhost:8081/api/disco
VITE_SOCKET_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
```

## Ejecutar

```bash
npm run dev
```

Abre en `http://localhost:5173`

## Estructura del proyecto

```
src/
├── components/
│   ├── ui/                 Btn, Card, Input, Badge, DateRangeFilter
│   ├── Login.tsx           Autenticacion con roles (Admin/Dueno/Mesero)
│   ├── Dashboard.tsx       KPIs, graficos mensuales, pie de pagos, ranking trabajadores, top productos
│   ├── Liquidacion.tsx     Liquidacion diaria, semanal, inventario, comparativo
│   ├── Jornadas.tsx        Calendario de dias de apertura
│   ├── MesasBillar.tsx     Gestion de mesas de billar y partidas
│   ├── Ventas.tsx          Cuentas por mesa, historial de pedidos y pagos
│   ├── PedidosAdmin.tsx    Vista admin: pedidos entrantes en tiempo real
│   ├── PedidosMesero.tsx   Vista mesero: toma de pedidos por mesa
│   ├── Productos.tsx       Catalogo de productos con precios
│   ├── Configuracion.tsx   Trabajadores, seguridad y modulos
│   ├── DashboardConsolidado.tsx Dashboard multi-negocio del rol SUPER
│   ├── NotificationBell.tsx     Campana de notificaciones tiempo real (rol SUPER)
│   ├── ErrorBoundary.tsx   Captura de errores de React
│   ├── TerminosCondiciones.tsx  Pagina legal
│   └── PoliticaPrivacidad.tsx   Pagina legal
├── hooks/
│   ├── useProductos.ts     CRUD productos via API
│   ├── useTrabajadores.ts  CRUD meseros/trabajadores via API
│   ├── useJornadas.ts      Jornadas y liquidaciones (Dexie + calcularCuadreDia)
│   ├── useInventarios.ts   Inventario semanal via API
│   ├── useComparativos.ts  Comparativo conteo vs tiquets via API
│   ├── usePromociones.ts   CRUD promociones (compra X lleva Y)
│   ├── useMesas.ts         Gestion de mesas y asignacion de meseros
│   ├── usePedidos.ts       Pedidos en tiempo real con Socket.IO
│   ├── useVentas.ts        Cuentas por mesa, pagos y descuentos
│   ├── useJornadaDiaria.ts Resumen del dia: ventas + billar + cierre
│   ├── useBillar.ts        Mesas de billar y partidas via API
│   ├── useConsolidado.ts   Dashboard SUPER (acepta filtro tipo / negocio / rango temporal)
│   ├── useSuperNotifications.ts  Socket.IO para notificaciones SUPER en tiempo real
│   └── useIsReadOnly.ts    Detecta rol SUPER (modo solo lectura)
├── lib/
│   ├── config.ts           URL del API + fetch wrapper con JWT
│   ├── db.ts               Base de datos local Dexie (IndexedDB)
│   ├── socket.ts           Conexion Socket.IO (notificaciones tiempo real)
│   ├── firebase.ts         Configuracion Firebase
│   ├── utils.ts            fmtCOP, fmtFull, calcularLiquidacion, calcularCuadreDia
│   ├── sound.ts            Sonidos de notificacion
│   ├── notification.ts     Notificaciones del navegador
│   └── seedData.ts         Datos semilla
├── types/
│   └── index.ts            Tipos TypeScript
└── App.tsx                 Layout, sidebar, routing por estado
```

## Modulos

| Modulo | Descripcion |
|---|---|
| **Liquidacion diaria** | Registro de ventas por trabajador con medios de pago, vales, cortesias y gastos. Cuadre de caja automatico |
| **Liquidacion semanal** | Corte por rango de fechas con desglose por jornada, medios de pago y totales acumulados |
| **Inventario** | Conteo semanal: inv. inicial, entradas, inv. fisico, saldo y valor total |
| **Comparativo** | Ventas segun conteo vs ventas segun tiquets con diferencia |
| **Mesas de billar** | Control de partidas activas, tiempo, cobro por hora y traslados |
| **Dias de apertura** | Calendario mensual con sesiones programadas |
| **Dashboard** | KPIs (vendido, recibido, gastos, saldo global), grafico mensual, pie de medios de pago, ranking de trabajadores y top productos |
| **Pedidos (Admin)** | Pedidos entrantes en tiempo real via Socket.IO, despacho y notificaciones sonoras |
| **Pedidos (Mesero)** | Toma de pedidos por mesa desde dispositivo movil del mesero |
| **Ventas** | Cuentas por mesa, historial de pedidos, descuentos por promocion y cierre de cuenta |
| **Promociones** | Reglas tipo "compra X unidades, lleva Y gratis" con descuento automatico |
| **Configuracion** | CRUD de trabajadores con usuario/contrasena, productos y seguridad |
| **Dashboard Consolidado (SUPER)** | Vista multi-negocio: KPIs globales filtrables por tipo de negocio, negocio individual y rango temporal (Hoy / 7d / 30d / Este mes / Este año / Todo). Comparativos por negocio, tendencia 30d, sparkline 7d, top productos, top meseros (excluye Barras), Comparativo de Barras dedicado, ranking |
| **Notificaciones tiempo real (SUPER)** | Campana en header con notificaciones via Socket.IO cuando un negocio crea o elimina una **liquidación** o un **inventario**. Click navega al módulo recién actualizado del negocio |

## Vistas y acceso

| Vista | Acceso |
|---|---|
| Login | Publico |
| Dashboard | Admin + Dueno |
| Liquidacion (diaria, semanal, inventario, comparativo) | Solo Admin |
| Dias de Apertura | Solo Admin |
| Mesas de Billar | Solo Admin |
| Ventas (cuentas por mesa) | Solo Admin |
| Pedidos Admin (entrantes en tiempo real) | Solo Admin |
| Pedidos Mesero (toma de pedidos) | Solo Mesero |
| Productos | Solo Admin |
| Configuracion | Solo Admin |
| Dashboard Consolidado | Solo SUPER |
| Drill-in a un negocio (vista admin solo lectura) | Solo SUPER |

## Roles

- **ADMINISTRADOR**: Acceso completo. Ingresa liquidaciones, gestiona productos, trabajadores, inventario, mesas y pedidos.
- **DUENO**: Solo ve el Dashboard con KPIs y graficos.
- **MESERO**: Toma pedidos desde su dispositivo movil, asignado a mesas por el admin.
- **SUPER**: Vista consolidada multi-negocio (2 discotecas + 1 billar). Puede entrar a cualquier negocio en **modo solo lectura** (drill-in) — el filtro `SuperReadOnlyFilter` del backend rechaza cualquier mutación. Recibe notificaciones en tiempo real de liquidaciones e inventarios.

### Caso especial: mesero "Barra"

Por convención, cada negocio tiene un mesero llamado `Barra` que representa el punto de venta principal (mostrador / caja), no una persona. Se identifica por `LOWER(nombre) = 'barra'` en la base. El dashboard SUPER tiene una sección dedicada **"Comparativo de Barras"** que cruza las barras de los 3 negocios; el "Top 5 meseros" las **excluye** para que no copen el ranking.

## Tema

Tema oscuro con acentos dorados:

| Elemento | Color |
|---|---|
| Fondo app | `#0A0A0A` |
| Fondo tarjetas | `#141414` |
| Acento dorado | `#CDA52F` |
| Exito/Teal | `#4ECDC4` |
| Datos/Amarillo | `#FFE66D` |
| Error/Rojo | `#FF5050` |

## Formulas de liquidacion (cuadre de caja)

Las formulas replican exactamente la logica del Excel de liquidacion del negocio.

### Por trabajador (`calcularLiquidacion`)

```
Efectivo esperado = Venta Total - Datafono - QR - Nequi - Vales - Cortesias - Gastos
Total             = Gastos + Datafono + QR + Nequi + Vales + Cortesias + Efectivo Entregado
Saldo             = Total - Venta Total
```

- `Saldo > 0` = sobro plata (a favor del negocio)
- `Saldo < 0` = falto plata (en contra)
- `Saldo = 0` = cuadre perfecto

### Por jornada (`calcularCuadreDia`)

Agrega los valores de todos los trabajadores de la noche:

```
Venta Total  = suma(trabajadores.totalVenta)
Total        = Gastos + Datafono + QR + Nequi + Vales + Cortesias + Efectivo
Saldo        = Total - Venta Total
```

### Cascade de calculo (tiempo real)

Al cambiar cantidad o producto en una linea:

```
1. linea.total       = precioUnitario x cantidad
2. trabajador.totalVenta = suma(lineas.total)
```

Los campos derivados de nivel Jornada (`totalVendido`, `totalRecibido`, `saldo`, `cortesias`, `gastos`, `pagos`) se computan con `calcularCuadreDia()` al guardar y al leer de la base de datos.

## Seguridad

La app cuenta con headers de seguridad HTTP configurados en `firebase.json`:

| Header | Valor | Proteccion |
|---|---|---|
| Content-Security-Policy | Directivas completas | Previene XSS, inyeccion de scripts y recursos no autorizados |
| X-Frame-Options | `DENY` | Previene clickjacking (iframe) |
| X-Content-Type-Options | `nosniff` | Previene MIME sniffing |
| frame-ancestors | `'none'` | Refuerza anti-clickjacking via CSP |
| form-action | `'self'` | Formularios solo envian a dominio propio |
| base-uri | `'self'` | Previene inyeccion de URL base |
| object-src | `'none'` | Bloquea plugins (Flash, Java) |
| media-src | `'none'` | Bloquea multimedia externa |

Escaneo de vulnerabilidades realizado con **OWASP ZAP 2.17.0** (17/03/2026):
- 0 alertas altas
- 2 alertas medias (unsafe-inline requerido por Tailwind CSS e impresion de recibos)
- 0 alertas bajas
- 3 informativas (comportamiento normal de app web moderna)

## Cache y rendimiento

Configuracion de cache en `firebase.json` para optimizar carga en produccion:

| Recurso | Estrategia | Detalle |
|---|---|---|
| `index.html` | `no-cache, no-store, must-revalidate` | Siempre carga la version mas reciente |
| `assets/**` (JS, CSS, imagenes) | `max-age=31536000, immutable` | Cacheado 1 ano (Vite genera hashes unicos) |

## Pruebas de estres (Stress Testing)

Se realizaron pruebas de carga y estres para validar la estabilidad, rendimiento e integridad de datos del sistema bajo condiciones de alta concurrencia. Los scripts de prueba se encuentran en `tests/`.

### Escenario de prueba

Se simulo un escenario extremo donde **50 meseros trabajan simultaneamente** en la discoteca, cada uno atendiendo su propia mesa y enviando multiples pedidos al sistema al mismo tiempo. Esto supera ampliamente la operacion real del negocio (5 meseros), para garantizar que el sistema soporta picos de carga muy por encima de lo esperado.

### Configuracion del test

```
Meseros concurrentes:       50
Pedidos por mesero:         5
Total de pedidos:           250
Productos por pedido:       1-4 (aleatorio)
Delay entre pedidos:        50-500ms (aleatorio, simula comportamiento humano)
Concurrencia por lote:      10 meseros simultaneos
Timeout global:             120 segundos
```

### Fases del test

El stress test ejecuta 3 fases secuenciales que simulan el ciclo completo de una noche de operacion:

**Fase 1 — Rafaga de pedidos (creacion masiva)**
- Los 50 meseros se procesan en lotes de 10 concurrentes
- Cada mesero atiende una mesa y envia 5 pedidos con productos aleatorios
- Se mide latencia individual de cada peticion (min, avg, p95, max)
- Se calcula throughput (pedidos/segundo)

**Fase 2 — Despacho de pedidos (accion del admin)**
- El administrador despacha los 250 pedidos creados
- Se procesan en lotes de 15 despachos concurrentes
- Se mide latencia de cada operacion de despacho

**Fase 3 — Pago de cuentas + verificacion de integridad**
- Se solicita la cuenta de cada una de las 50 mesas
- Se compara el total calculado por el servidor vs la suma de pedidos enviados
- Se detectan race conditions o datos corruptos si los totales no coinciden
- Se procede al pago de cada cuenta

### Validaciones realizadas

| Validacion | Que verifica |
|---|---|
| Pedidos enviados vs esperados | Que ninguna peticion HTTP se pierda |
| Pedidos fallidos = 0 | Que el backend no rechace peticiones bajo carga |
| Totales de cuentas correctos | Integridad de datos — detecta race conditions |
| Eventos Socket.IO recibidos | Que el admin reciba notificaciones en tiempo real de TODOS los pedidos |
| Despachos exitosos | Que el flujo de despacho funcione bajo carga |
| Pagos exitosos | Que el cierre de cuentas no falle con multiples mesas simultaneas |

### Metricas medidas

```
PEDIDOS
  Enviados:                    250 / 250
  Fallidos:                    0
  Throughput:                  X pedidos/seg
  Latencia min/avg/p95/max:    Xms / Xms / Xms / Xms

DESPACHOS
  Despachados:                 250 / 250
  Fallidos:                    0
  Latencia min/avg/p95/max:    Xms / Xms / Xms / Xms

PAGOS + INTEGRIDAD
  Cuentas pagadas:             50 / 50
  Pagos fallidos:              0
  Totales correctos:           50 / 50

SOCKET.IO
  nuevo_pedido:                250/250 (100%)
  pedido_despachado:           250/250 (100%)
  cuenta_pagada:               50/50 (100%)
```

### Resultado

```
PERFECTO — 0 errores, 0 datos corruptos, 0 eventos perdidos
```

El sistema supero la prueba sin ningun fallo:
- **0 peticiones perdidas** — las 250 peticiones HTTP fueron procesadas correctamente
- **0 datos corruptos** — los totales de las 50 cuentas coincidieron exactamente con la suma de pedidos
- **0 eventos Socket.IO perdidos** — el administrador recibio las 250 notificaciones en tiempo real
- **0 race conditions** — la concurrencia no genero inconsistencias en los calculos monetarios

### Como ejecutar las pruebas

Requisitos: Backend y Socket.IO corriendo en localhost.

```bash
# Test con 50 meseros (estres maximo)
node tests/stress-meseros.cjs

# Test con 10 meseros (carga moderada)
node tests/stress-test.cjs
```

### Arquitectura del test

```
┌──────────────────────────────────────────────────────────┐
│                    STRESS TEST ENGINE                     │
│                                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     ┌─────────┐  │
│  │Mesero 01│ │Mesero 02│ │Mesero 03│ ... │Mesero 50│  │
│  └────┬────┘ └────┬────┘ └────┬────┘     └────┬────┘  │
│       │           │           │               │        │
│       ▼           ▼           ▼               ▼        │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Lotes de 10 meseros concurrentes         │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                               │
│              REST API (HTTP POST)                       │
│              + Socket.IO (WebSocket)                    │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                 BACKEND (Spring Boot)                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │ REST API │  │Socket.IO │  │   PostgreSQL (datos)   │ │
│  │ :8081    │  │  :3001   │  │   Integridad ACID      │ │
│  └──────────┘  └──────────┘  └───────────────────────┘ │
│                                                          │
│  Validaciones: totales, concurrencia, transacciones     │
└──────────────────────────────────────────────────────────┘
```

### Por que 50 meseros?

La discoteca opera normalmente con **5 meseros**. Probamos con **50 (10x la carga real)** para garantizar que:
- El sistema no se degrada bajo carga extrema
- No hay fugas de memoria ni conexiones colgadas
- Los calculos monetarios son correctos incluso con escrituras concurrentes
- Socket.IO no pierde eventos bajo alta frecuencia de mensajes
- El backend maneja transacciones ACID correctamente sin deadlocks

Esto da un **margen de seguridad de 10x** sobre la operacion real del negocio.

## Infraestructura de produccion

| Servicio | Proveedor | Plan | Funcion |
|---|---|---|---|
| Frontend | Firebase Hosting | Gratis (Spark) | SPA React, CDN global |
| Auth | Firebase Auth | Gratis (Spark) | Login JWT con roles |
| Backend | Render | Gratis | Spring Boot API + Socket.IO |
| Base de datos | Supabase | Gratis (500 MB) | PostgreSQL |

Costo total: **$0 USD/mes**

El backend se duerme tras 15 min de inactividad (Render free tier). El primer request del fin de semana tarda ~30 seg en despertar. Operacion normal el resto de la noche.

## Build para produccion

```bash
npm run build
```

Los archivos generados quedan en `dist/`.

## Deploy

```bash
firebase deploy --only hosting
```

Hosting: [https://monastery-club.web.app](https://monastery-club.web.app)

## Repositorios

- **Frontend**: [DiscoSoftware](https://github.com/Edwin950821/DiscoSoftware)
- **Backend**: [DiscoSoftBack](https://github.com/Edwin950821/DiscoSoftBack)
