# Monastery Club - Frontend

Sistema de gestion operativa para discoteca **Monastery Club** en Baranoa, Colombia.
Control de jornadas nocturnas, liquidaciones por trabajador, inventario y cuadre de caja.

## Stack

| Tecnologia | Version |
|---|---|
| React | 19 |
| TypeScript | 5.9 |
| Vite | 8 |
| Tailwind CSS | 4 |
| Recharts | 3.8 |
| Firebase | 12 (Firestore) |

## Requisitos

- Node.js 18+
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
│   ├── ui/              Btn, Card, Input, Badge, DateRangeFilter
│   ├── Login.tsx        Autenticacion con roles
│   ├── Dashboard.tsx    KPIs, graficos, ranking
│   ├── Liquidacion.tsx  Liquidacion diaria + inventario + comparativo
│   ├── Jornadas.tsx     Historial de sesiones
│   ├── Productos.tsx    Catalogo de productos
│   └── Configuracion.tsx Trabajadores y seguridad
├── hooks/
│   ├── useProductos.ts
│   ├── useTrabajadores.ts
│   ├── useJornadas.ts
│   ├── useInventarios.ts
│   └── useComparativos.ts
├── lib/
│   ├── config.ts        URL del API
│   ├── firebase.ts      Configuracion Firebase
│   ├── utils.ts         fmtCOP, fmtFull, calcularLiquidacion
│   └── initFirebase.ts  Datos semilla
├── types/
│   └── index.ts         Tipos TypeScript
└── App.tsx              Layout, sidebar, routing por estado
```

## Vistas

| Vista | Ruta | Acceso |
|---|---|---|
| Login | `login` | Publico |
| Dashboard | `dashboard` | Admin + Dueno |
| Liquidacion | `liquidacion` | Solo Admin |
| Jornadas | `jornadas` | Solo Admin |
| Inventario | `inventario` | Solo Admin |
| Comparativo | `comparativo` | Solo Admin |
| Productos | `productos` | Solo Admin |
| Configuracion | `configuracion` | Solo Admin |

## Roles

- **ADMINISTRADOR**: Acceso completo. Ingresa liquidaciones, gestiona productos y trabajadores.
- **DUENO**: Solo ve el Dashboard con KPIs y graficos.

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

## Build para produccion

```bash
npm run build
```

Los archivos generados quedan en `dist/`.

## Repositorios

- **Frontend**: [DiscoSoftware](https://github.com/Edwin950821/DiscoSoftware)
- **Backend**: [DiscoSoftBack](https://github.com/Edwin950821/DiscoSoftBack)
