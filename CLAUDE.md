# DiscoManager — CLAUDE.md

## Contexto del negocio

Discoteca en Baranoa, Colombia. Abre fines de semana (sábados, domingos, lunes festivos).
Cada noche que abre = **jornada**. Las jornadas se numeran libremente por el admin: SI-1, SI-2...

**Flujo físico real (no cambiar):**
1. Mesero trabaja la noche con cartón físico — anota ventas y forma de pago.
2. Un mesero puede tener varios cartones por noche — cada cartón = un **tiquete**.
3. Al cerrar, el **ADMIN** ingresa todos los cartones al sistema.
4. El sistema calcula el cuadre de caja automáticamente.
5. El **DUEÑO** solo consulta el dashboard — no ingresa datos.

Los meseros NO usan la app. Solo ADMIN y DUEÑO.

---

## Stack

```
React 18 + TypeScript + Vite + Firebase 10 (Firestore) + Recharts + Tailwind CSS
```

Instalación:
```bash
npm create vite@latest disco-manager -- --template react-ts
npm install firebase recharts tailwindcss @tailwindcss/vite
```

---

## Árbol de archivos

```
disco-manager/
├── src/
│   ├── components/
│   │   ├── ui/           Btn, Card, Input, Badge
│   │   ├── Dashboard.tsx
│   │   ├── NuevaJornada.tsx
│   │   ├── Jornadas.tsx
│   │   └── Configuracion.tsx
│   ├── hooks/
│   │   ├── useProductos.ts
│   │   ├── useMeseros.ts
│   │   └── useJornadas.ts
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── utils.ts
│   │   └── initFirebase.ts
│   ├── types/
│   │   └── index.ts
│   └── App.tsx
├── CLAUDE.md
├── .env.local
├── tailwind.config.ts
└── package.json
```

---

## Modelo de datos (`src/types/index.ts`)

```typescript
export type MedioPago = 'Efectivo' | 'QR' | 'Nequi' | 'Datafono' | 'Vales'

export interface Producto {
  id: string
  nombre: string
  precio: number    // pesos COP, sin decimales
  activo: boolean   // false = no aparece en ingreso de tiquetes
}

export interface Mesero {
  id: string
  nombre: string
  color: string     // hex, ej: '#FF6B35'
  avatar: string    // 2 letras mayúsculas, ej: 'GA'
  activo: boolean
}

export interface LineaTiquete {
  id: string
  productoId: string
  nombre: string    // SNAPSHOT del nombre al ingresar (inmutable)
  precio: number    // SNAPSHOT del precio al ingresar (inmutable)
  cantidad: number
  subtotal: number  // precio × cantidad — recalcular al instante
}

export interface Tiquete {
  id: string
  lineas: LineaTiquete[]
  medioPago: MedioPago   // un solo medio por tiquete físico
  total: number          // suma de subtotales — recalcular al instante
}

export interface MeseroJornada {
  meseroId: string
  nombre: string         // desnormalizado
  color: string          // desnormalizado
  avatar: string         // desnormalizado
  tiquetes: Tiquete[]
  totalMesero: number    // suma de totales de tiquetes — recalcular al instante
}

export interface Jornada {
  id: string
  sesion: string              // 'SI-7', 'SI-8'... libre
  fecha: string               // 'YYYY-MM-DD'
  meseros: MeseroJornada[]
  pagos: Record<MedioPago, number>
  cortesias: number           // gasto del ADMIN (tragos de la casa), no del mesero
  gastos: number              // otros egresos de la noche
  totalVendido: number        // desnormalizado — suma de totalMesero
  totalRecibido: number       // desnormalizado — suma de pagos
  saldo: number               // desnormalizado — ver fórmula abajo
  creadoEn?: any              // serverTimestamp()
}
```

---

## Fórmula del cuadre de caja (CRÍTICA — nunca cambiar)

```
esperado      = totalVendido - cortesias - gastos
totalRecibido = pagos.Efectivo + pagos.QR + pagos.Nequi + pagos.Datafono + pagos.Vales
saldo         = totalRecibido - esperado

saldo > 0  → sobró plata (a favor del negocio)
saldo < 0  → faltó plata (en contra)
saldo = 0  → cuadre perfecto
```

---

## Cálculo en cascada (inmediato, sin esperar guardado)

Al cambiar cantidad o producto en una línea:
```
1. linea.subtotal     = linea.precio × linea.cantidad
2. tiquete.total      = suma(lineas.subtotal)
3. mesero.totalMesero = suma(tiquetes.total)
```
Estos 3 campos se actualizan siempre en cascada, en tiempo real.

---

## Colecciones Firestore

| Colección    | Contenido     | Query                              |
|-------------|---------------|------------------------------------|
| `/productos` | Producto[]    | onSnapshot (sin orden específico)  |
| `/meseros`   | Mesero[]      | onSnapshot (sin orden específico)  |
| `/jornadas`  | Jornada[]     | onSnapshot + orderBy('creadoEn', 'desc') |

**Regla:** Cada Jornada = **un solo documento** con todo embebido. Sin sub-colecciones.

---

## Reglas de código

**Siempre:**
- Toda lógica de Firestore (`addDoc`, `onSnapshot`, `updateDoc`, `deleteDoc`) en `src/hooks/` — nunca en componentes.
- Todos los tipos en `src/types/index.ts` — nunca tipos inline en componentes.
- IDs locales (antes de guardar): `newId()` de `utils.ts`.
- Moneda: siempre `fmtCOP()` o `fmtFull()` de `utils.ts` — nunca formatear inline.
- Guardar Jornada con `totalVendido`, `totalRecibido` y `saldo` ya calculados (desnormalizados).
- Hacer snapshot del precio al ingresar la línea — cambios futuros de precio no afectan jornadas pasadas.

**Nunca:**
- `localStorage` ni `sessionStorage`.
- Sub-colecciones en Firestore.
- Guardar una jornada sin al menos 1 mesero con 1 tiquete con 1 línea completa.
- Formatear moneda manualmente.
- Tipos inline en componentes.

---

## Firebase (`src/lib/firebase.ts`)

```typescript
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

export const app = initializeApp(firebaseConfig)
export const db  = getFirestore(app)
```

Variables en `.env.local`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

---

## Utils (`src/lib/utils.ts`)

```typescript
// Formato compacto: $1.5M, $500K, $3.000
export const fmtCOP = (n: number): string => {
  if (!n && n !== 0) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

// Formato completo: $1.500.000
export const fmtFull = (n: number): string =>
  '$' + Number(n || 0).toLocaleString('es-CO')

// ID local temporal
export const newId = (): string => String(Date.now() + Math.random())

// Calcular campos derivados antes de guardar
export function calcularCuadre(jornada: Omit<Jornada, 'id' | 'creadoEn'>) {
  const totalVendido   = jornada.meseros.reduce((s, m) =>
    s + m.tiquetes.reduce((ts, t) =>
      ts + t.lineas.reduce((ls, l) => ls + l.subtotal, 0), 0), 0)
  const totalRecibido  = Object.values(jornada.pagos).reduce((s, v) => s + v, 0)
  const esperado       = totalVendido - jornada.cortesias - jornada.gastos
  const saldo          = totalRecibido - esperado
  return { totalVendido, totalRecibido, saldo }
}
```

---

## Productos precargados (23 items)

| Producto | Precio |
|---|---|
| Aguila Negra 330ml | $5.000 |
| Aguila Light | $5.000 |
| Costeñita 330ml | $5.000 |
| Coronita 355ml | $6.000 |
| Club Colombia | $6.000 |
| Heineken | $6.000 |
| Budweiser | $6.000 |
| Stella Artois | $10.000 |
| Smirnoff Ice | $14.000 |
| Antioqueño Litro Tapa Verde | $150.000 |
| Antioqueño 750ml Verde | $120.000 |
| Antioqueño Litro Amarillo | $150.000 |
| Old Parr 1 Litro | $280.000 |
| Agua | $5.000 |
| Coca Cola | $5.000 |
| Soda | $5.000 |
| Gatorade | $7.000 |
| Electrolit | $12.000 |
| Redbull | $15.000 |
| Vaso Michelado | $3.000 |
| Bombon | $1.000 |
| Detodito | $7.000 |
| Mani | $3.000 |

## Meseros precargados (5)

| Nombre | Color | Avatar |
|---|---|---|
| Gabriel | #FF6B35 | GA |
| Carlos | #4ECDC4 | CA |
| Loraine | #FFE66D | LO |
| Luis | #A8E6CF | LU |
| Barra | #C3B1E1 | BA |

> "Barra" es el punto de venta principal, no una persona. Se trata igual que un mesero.

Cargar con `initFirebase()` en `src/lib/initFirebase.ts` — llamar una sola vez desde `App.tsx` si las colecciones están vacías.

---

## Tema oscuro

```
Fondo app:          #0A0A0A
Fondo tarjetas:     #141414
Borde tarjetas:     rgba(255,255,255,0.07)
Texto principal:    #FFFFFF
Texto secundario:   rgba(255,255,255,0.45)
Naranja (acento):   #FF6B35  — botones primarios, highlights
Teal (éxito):       #4ECDC4  — KPIs positivos
Amarillo (datos):   #FFE66D  — montos grandes, totales
Rojo (negativo):    #FF5050  — saldos negativos, errores
```

Colores por medio de pago (para PieChart):
- Efectivo: #FF6B35
- QR: #4ECDC4
- Nequi: #FFE66D
- Datafono: #A8E6CF
- Vales: #C3B1E1

Paleta de colores para meseros (rotar en orden):
```
['#FF6B35','#4ECDC4','#FFE66D','#A8E6CF','#C3B1E1','#FF8FA3','#98D8C8','#FFB347']
```

---

## Vistas

### App.tsx — Layout
- Sidebar 220px fijo. Fondo `#0A0A0A`.
- Logo "DiscoManager" + "Baranoa".
- Reloj en tiempo real (useEffect + setInterval cada segundo).
- 4 links: Dashboard / Nueva Jornada / Jornadas (badge con count) / Configuración.
- Llama `initFirebase()` una vez en el primer useEffect.

### Configuracion.tsx — Dos tabs
- **Productos:** form (nombre + precio), lista con eliminar, toggle activo/inactivo.
- **Meseros:** form (nombre), asigna color rotando, avatar = 2 primeras letras, lista con eliminar.

### NuevaJornada.tsx — Stepper 3 pasos

**Paso 1 — Datos básicos:**
- Input: ID sesión (libre, ej: SI-7).
- Input date: fecha.
- Cards de meseros activos: clic = toggle. Borde del color del mesero si seleccionado.
- Siguiente habilitado solo si sesion ≠ '' y al menos 1 mesero seleccionado.

**Paso 2 — Tiquetes:**
- Panel izquierdo (35%): lista de meseros con total en tiempo real. Clic = mesero activo.
- Panel derecho (65%): tiquetes del mesero activo.
  - "+ Agregar Tiquete" → tiquete vacío.
  - Cada tiquete: header (número + selector MedioPago + eliminar), líneas, footer con subtotal.
  - Cada línea: select producto, input cantidad, subtotal (solo lectura), eliminar.
  - Al seleccionar producto: copiar nombre y precio como snapshot.
  - "+ Agregar Producto" → línea vacía al tiquete.
  - Recalcular en cascada al instante con cada cambio.
- Siguiente habilitado solo si todos los meseros tienen ≥1 tiquete con ≥1 línea.

**Paso 3 — Cuadre:**
- Resumen de ventas por mesero (solo lectura).
- Inputs: Cortesías, Otros gastos.
- Inputs: Efectivo, QR, Nequi, Datafono, Vales.
- Cuadre en tiempo real:
  ```
  Total vendido:           $X
  (-) Cortesías:          -$X
  (-) Gastos:             -$X
  ─────────────────────────
  Lo que debería ingresar: $X
  Total recibido:          $X
  ─────────────────────────
  SALDO:                   $X  ← verde ≥0, rojo <0
  ```
- "Guardar Jornada" → validar → `calcularCuadre()` → `useJornadas().guardar()` → navegar a Jornadas.

### Jornadas.tsx — Historial
Cards colapsables, más reciente primero.
- Colapsada: tag sesión (naranja), fecha, # meseros, total vendido, saldo (color).
- Expandida: grid de meseros, chips de medios de pago (solo los > 0), cuadre, botón eliminar con confirmación.

### Dashboard.tsx — Vista del dueño
Empty state si no hay jornadas.

**4 KPIs:**
1. Total Vendido (naranja)
2. Total Recibido (teal)
3. Gastos + Cortesías (amarillo)
4. Saldo Global (verde/rojo)

**AreaChart (recharts):**
- X: sesion (SI-1, SI-2...)
- Serie "Vendido": naranja con fill degradado
- Serie "Recibido": teal punteada

**PieChart / Doughnut (recharts):**
- Datos: suma de pagos por MedioPago de todas las jornadas.
- `innerRadius={50} outerRadius={80}`
- Solo incluir medios con valor > 0.

**Ranking meseros:**
```typescript
// Cruzar todas las jornadas para acumular por meseroId
const ranking = Object.values(rankingMap).sort((a, b) => b.total - a.total)
// Mostrar: posición, avatar, nombre, total, noches, promedio/noche
```

**Top 6 productos:**
```typescript
// Cruzar jornadas → meseros → tiquetes → lineas para acumular por productoId
const topProductos = Object.values(productosMap).sort((a, b) => b.total - a.total).slice(0, 6)
// Mostrar: posición, nombre, total en fmtCOP(), unidades vendidas
```

---

## Orden de construcción (seguir en este orden)

1. `npm create vite@latest` + instalar deps + configurar Tailwind
2. `src/types/index.ts`
3. `src/lib/firebase.ts` + `utils.ts` + `initFirebase.ts`
4. Los 3 hooks (`useProductos`, `useMeseros`, `useJornadas`)
5. Componentes UI (`Btn`, `Card`, `Input`, `Badge`)
6. `Configuracion.tsx` — verificar que Firestore conecta
7. `NuevaJornada.tsx` Paso 1
8. `NuevaJornada.tsx` Paso 2 — cálculo en cascada
9. `NuevaJornada.tsx` Paso 3 — guardado
10. `Jornadas.tsx`
11. `Dashboard.tsx`
12. `App.tsx` — sidebar + routing + `initFirebase()`

---

## MVP vs Fases futuras

**MVP (esta versión):**
- 4 vistas + Firestore + sin autenticación

**Fase 2:**
- Autenticación Firebase Auth (roles: admin, dueño)

**Fuera del MVP:**
- Inventario (hoja "INVENTARIO MONASTERY")
- Comparativo físico vs cartones (hoja "Comparativo ventas")
- Exportar a Excel

---

## Configuración Tailwind (`tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app:     '#0A0A0A',
        card:    '#141414',
        orange:  '#FF6B35',
        teal:    '#4ECDC4',
        yellow:  '#FFE66D',
        red:     '#FF5050',
      },
    },
  },
  plugins: [],
} satisfies Config
```

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

`src/index.css` (mínimo):
```css
@import "tailwindcss";

body {
  background-color: #0A0A0A;
  color: #fff;
  margin: 0;
}
```

---

## Routing (sin react-router)

No se usa react-router. El routing es por estado en `App.tsx`:

```typescript
type View = 'dashboard' | 'nueva-jornada' | 'jornadas' | 'configuracion'

const [view, setView] = useState<View>('dashboard')
```

La función `navigate` se pasa como prop a los componentes que necesiten redirigir (ej: NuevaJornada redirige a 'jornadas' al guardar).

```typescript
// App.tsx — renderizado condicional
{view === 'dashboard'      && <Dashboard jornadas={jornadas} />}
{view === 'nueva-jornada'  && <NuevaJornada ... navigate={setView} />}
{view === 'jornadas'       && <Jornadas jornadas={jornadas} ... />}
{view === 'configuracion'  && <Configuracion ... />}
```

---

## Hooks — Implementación de referencia

### `useProductos.ts`

```typescript
import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Producto } from '../types'

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([])

  useEffect(() => {
    return onSnapshot(collection(db, 'productos'), snap => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)))
    })
  }, [])

  const agregar = (p: Omit<Producto, 'id'>) => addDoc(collection(db, 'productos'), p)
  const actualizar = (id: string, data: Partial<Producto>) => updateDoc(doc(db, 'productos', id), data)
  const eliminar = (id: string) => deleteDoc(doc(db, 'productos', id))

  return { productos, agregar, actualizar, eliminar }
}
```

### `useMeseros.ts`

```typescript
import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Mesero } from '../types'

export function useMeseros() {
  const [meseros, setMeseros] = useState<Mesero[]>([])

  useEffect(() => {
    return onSnapshot(collection(db, 'meseros'), snap => {
      setMeseros(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mesero)))
    })
  }, [])

  const agregar = (m: Omit<Mesero, 'id'>) => addDoc(collection(db, 'meseros'), m)
  const actualizar = (id: string, data: Partial<Mesero>) => updateDoc(doc(db, 'meseros', id), data)
  const eliminar = (id: string) => deleteDoc(doc(db, 'meseros', id))

  return { meseros, agregar, actualizar, eliminar }
}
```

### `useJornadas.ts`

```typescript
import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  orderBy, query, serverTimestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Jornada } from '../types'
import { calcularCuadre } from '../lib/utils'

export function useJornadas() {
  const [jornadas, setJornadas] = useState<Jornada[]>([])

  useEffect(() => {
    const q = query(collection(db, 'jornadas'), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => {
      setJornadas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Jornada)))
    })
  }, [])

  const guardar = async (jornada: Omit<Jornada, 'id' | 'creadoEn' | 'totalVendido' | 'totalRecibido' | 'saldo'>) => {
    const cuadre = calcularCuadre(jornada as any)
    await addDoc(collection(db, 'jornadas'), {
      ...jornada,
      ...cuadre,
      creadoEn: serverTimestamp(),
    })
  }

  const eliminar = (id: string) => deleteDoc(doc(db, 'jornadas', id))

  return { jornadas, guardar, eliminar }
}
```

---

## Componentes UI (`src/components/ui/`)

### `Btn.tsx`

```typescript
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Btn({ variant = 'primary', size = 'md', className = '', ...props }: BtnProps) {
  const base = 'rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary: 'bg-orange text-white hover:bg-orange/80',
    ghost:   'border border-white/10 text-white/70 hover:bg-white/5',
    danger:  'bg-red/10 text-red border border-red/20 hover:bg-red/20',
  }
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
}
```

### `Card.tsx`

```typescript
interface CardProps { children: React.ReactNode; className?: string }

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-card border border-white/[0.07] rounded-xl p-4 ${className}`}>
      {children}
    </div>
  )
}
```

### `Input.tsx`

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-white/45">{label}</label>}
      <input
        className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
          placeholder:text-white/20 focus:outline-none focus:border-orange/50 ${className}`}
        {...props}
      />
    </div>
  )
}
```

### `Badge.tsx`

```typescript
interface BadgeProps { children: React.ReactNode; color?: string }

export function Badge({ children, color = '#FF6B35' }: BadgeProps) {
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + '22', color }}
    >
      {children}
    </span>
  )
}
```

---

## `initFirebase.ts` — Carga inicial de datos

```typescript
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from './firebase'

const PRODUCTOS = [
  { nombre: 'Aguila Negra 330ml',        precio: 5000,   activo: true },
  { nombre: 'Aguila Light',              precio: 5000,   activo: true },
  { nombre: 'Costeñita 330ml',           precio: 5000,   activo: true },
  { nombre: 'Coronita 355ml',            precio: 6000,   activo: true },
  { nombre: 'Club Colombia',             precio: 6000,   activo: true },
  { nombre: 'Heineken',                  precio: 6000,   activo: true },
  { nombre: 'Budweiser',                 precio: 6000,   activo: true },
  { nombre: 'Stella Artois',             precio: 10000,  activo: true },
  { nombre: 'Smirnoff Ice',              precio: 14000,  activo: true },
  { nombre: 'Antioqueño Litro Tapa Verde', precio: 150000, activo: true },
  { nombre: 'Antioqueño 750ml Verde',    precio: 120000, activo: true },
  { nombre: 'Antioqueño Litro Amarillo', precio: 150000, activo: true },
  { nombre: 'Old Parr 1 Litro',          precio: 280000, activo: true },
  { nombre: 'Agua',                      precio: 5000,   activo: true },
  { nombre: 'Coca Cola',                 precio: 5000,   activo: true },
  { nombre: 'Soda',                      precio: 5000,   activo: true },
  { nombre: 'Gatorade',                  precio: 7000,   activo: true },
  { nombre: 'Electrolit',                precio: 12000,  activo: true },
  { nombre: 'Redbull',                   precio: 15000,  activo: true },
  { nombre: 'Vaso Michelado',            precio: 3000,   activo: true },
  { nombre: 'Bombon',                    precio: 1000,   activo: true },
  { nombre: 'Detodito',                  precio: 7000,   activo: true },
  { nombre: 'Mani',                      precio: 3000,   activo: true },
]

const MESEROS = [
  { nombre: 'Gabriel', color: '#FF6B35', avatar: 'GA', activo: true },
  { nombre: 'Carlos',  color: '#4ECDC4', avatar: 'CA', activo: true },
  { nombre: 'Loraine', color: '#FFE66D', avatar: 'LO', activo: true },
  { nombre: 'Luis',    color: '#A8E6CF', avatar: 'LU', activo: true },
  { nombre: 'Barra',   color: '#C3B1E1', avatar: 'BA', activo: true },
]

export async function initFirebase() {
  const [prodSnap, mesSnap] = await Promise.all([
    getDocs(collection(db, 'productos')),
    getDocs(collection(db, 'meseros')),
  ])
  if (prodSnap.empty) {
    await Promise.all(PRODUCTOS.map(p => addDoc(collection(db, 'productos'), p)))
  }
  if (mesSnap.empty) {
    await Promise.all(MESEROS.map(m => addDoc(collection(db, 'meseros'), m)))
  }
}
```

---

## Patrones de cálculo en cascada — NuevaJornada

```typescript
// Cada vez que cambia una línea:
function actualizarLinea(
  meseroId: string, tiqueteId: string, lineaId: string,
  campo: 'productoId' | 'cantidad', valor: string | number
) {
  setMeseros(prev => prev.map(m => {
    if (m.meseroId !== meseroId) return m
    const tiquetes = m.tiquetes.map(t => {
      if (t.id !== tiqueteId) return t
      const lineas = t.lineas.map(l => {
        if (l.id !== lineaId) return l
        if (campo === 'productoId') {
          const prod = productos.find(p => p.id === valor)
          if (!prod) return l
          return { ...l, productoId: prod.id, nombre: prod.nombre, precio: prod.precio,
                   subtotal: prod.precio * l.cantidad }
        }
        const cantidad = Number(valor) || 0
        return { ...l, cantidad, subtotal: l.precio * cantidad }
      })
      const total = lineas.reduce((s, l) => s + l.subtotal, 0)
      return { ...t, lineas, total }
    })
    const totalMesero = tiquetes.reduce((s, t) => s + t.total, 0)
    return { ...m, tiquetes, totalMesero }
  }))
}
```

---

## Login — Monastery Club (Fase 2)

### Diseño móvil (referencia — ver imagen)
- Fondo: negro con glow dorado en la parte inferior.
- Logo: círculo con borde dorado punteado + letra "M" dorada.
- Título: "Monastery Club" en blanco, bold, grande.
- Toggle de rol: pill con dos opciones — **Administrador** (activo, fondo dorado) / **Dueño**.
- Inputs: fondo semitransparente oscuro, borde sutil, iconos de usuario y candado, ojo para mostrar contraseña.
- Botón "Ingresar": ancho completo, fondo dorado degradado, texto bold negro.
- Pie de página: "Solo personal autorizado" en gris claro.

### Diseño desktop (PC)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [Panel izquierdo 55%]          [Panel derecho 45%]       │
│                                                             │
│   Imagen/video de la          ┌──────────────────────┐     │
│   discoteca con overlay       │        ⬤ M ⬤         │     │
│   oscuro + partículas         │   Monastery Club     │     │
│                               │                      │     │
│   "La mejor experiencia       │  [Admin]  [ Dueño ]  │     │
│    en Baranoa"                │                      │     │
│                               │  👤 Usuario          │     │
│                               │  🔒 Contraseña  👁   │     │
│                               │                      │     │
│                               │  ┌──────────────┐   │     │
│                               │  │   Ingresar   │   │     │
│                               │  └──────────────┘   │     │
│                               │                      │     │
│                               │  Solo personal       │     │
│                               │  autorizado          │     │
│                               └──────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Especificaciones del panel derecho (desktop):**
- Ancho: 420px fijo, centrado verticalmente.
- Fondo: `#0D0D0D` con borde `rgba(212,175,55,0.3)` (dorado suave), border-radius 20px.
- Box-shadow: `0 0 60px rgba(212,175,55,0.15)`.
- Logo "M": círculo 80px, borde dorado punteado, letra dorada 36px.
- Toggle: misma pill que móvil — activo con fondo `linear-gradient(135deg, #D4AF37, #F5D76E)`, texto negro.
- Inputs: `background: rgba(255,255,255,0.05)`, borde `rgba(212,175,55,0.2)`, focus borde dorado.
- Botón: `background: linear-gradient(135deg, #D4AF37, #F5D76E)`, color `#0D0D0D`, hover con brightness(1.1).
- Colores dorados del tema Monastery: `#D4AF37` (base) / `#F5D76E` (claro) / `#A07D20` (oscuro).

**Panel izquierdo (desktop):**
- Fondo: imagen de fondo de la discoteca + `overlay: rgba(0,0,0,0.65)`.
- Texto centrado: nombre del local, tagline.
- Animación opcional: partículas doradas flotantes (CSS keyframes).

---

## Backend — Monastery Club Auth (`auth-backend` Kotlin/Spring Boot)

Archivos creados en `C:/Users/USUARIO/Downloads/auth-backend/`:

### `dto/DiscoAuthDTOs.kt`
```kotlin
enum class DiscoRol { ADMINISTRADOR, DUENO }

data class DiscoLoginRequest(
    val username: String,    // @NotBlank
    val password: String,    // @NotBlank
    val rol: DiscoRol = DiscoRol.ADMINISTRADOR
)

data class DiscoAuthResponse(
    val token: String,
    val nombre: String,
    val rol: DiscoRol,
    val mensaje: String = "Bienvenido a Monastery Club"
)
```

### `controller/DiscoAuthController.kt`
- Endpoint: `POST /api/disco/auth/login`
- Mapeo de roles: `ADMINISTRADOR → Role.ADMIN`, `DUENO → Role.OWNER`
- Valida: usuario activo, contraseña correcta, rol coincide.
- Devuelve JWT en cookie `httpOnly` + body `DiscoAuthResponse`.
- Endpoint: `POST /api/disco/auth/logout` — limpia cookie.

**Usuarios a crear en BD para Monastery Club:**
```sql
-- Administrador
INSERT INTO auth_users (email, username, password, name, role, is_active)
VALUES ('admin@monastery.co', 'admin', '<bcrypt>', 'Administrador', 'ADMIN', true);

-- Dueño
INSERT INTO auth_users (email, username, password, name, role, is_active)
VALUES ('dueno@monastery.co', 'dueno', '<bcrypt>', 'Dueño', 'OWNER', true);
```

---

## `Login.tsx` — Componente creado (`src/components/Login.tsx`)

Archivo listo. Integración en `App.tsx`:

```typescript
type View = 'login' | 'dashboard' | 'nueva-jornada' | 'jornadas' | 'configuracion'

// Estado de sesión
const [view, setView]   = useState<View>('login')
const [rol, setRol]     = useState<'ADMINISTRADOR' | 'DUENO' | null>(null)
const [nombre, setNombre] = useState('')

const handleLogin = (token: string, rol: 'ADMINISTRADOR' | 'DUENO', nombre: string) => {
  setRol(rol)
  setNombre(nombre)
  setView(rol === 'DUENO' ? 'dashboard' : 'dashboard')
}

// En el render:
if (view === 'login') return <Login onLogin={handleLogin} />

// DUENO solo ve Dashboard, ADMIN ve todo:
{rol === 'ADMINISTRADOR' && view === 'nueva-jornada' && <NuevaJornada ... />}
```

**Reglas de acceso por rol:**
- `ADMINISTRADOR` → acceso completo (Dashboard, Nueva Jornada, Jornadas, Configuración).
- `DUENO` → solo Dashboard (sidebar sin las otras opciones).

---

## Notas de implementación importantes

- **No usar `react-router-dom`** — el routing es por estado `useState<View>`.
- **`onSnapshot` siempre en `useEffect`** — retornar el unsubscribe para cleanup.
- **Avatar automático en Configuracion:** `nombre.slice(0,2).toUpperCase()`.
- **Color automático en Configuracion:** rotar por índice: `COLORES[meseros.length % COLORES.length]`.
- **El campo `sesion` en Jornada** es texto libre — no validar formato, solo que no esté vacío.
- **Chips de medios de pago en Jornadas.tsx:** `Object.entries(jornada.pagos).filter(([,v]) => v > 0)`.
- **Empty state en Dashboard:** `if (jornadas.length === 0) return <EmptyState />`.
- **El AreaChart debe ordenar por `creadoEn` ascendente** (opuesto al orderBy del hook) para que la línea de tiempo sea correcta: `[...jornadas].reverse()`.
- **Firestore reglas (modo desarrollo):** allow read, write: if true; — cambiar en Fase 2.
