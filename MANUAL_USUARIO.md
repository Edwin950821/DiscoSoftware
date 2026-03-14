# Manual de Usuario - Monastery Club

## Introduccion

Monastery Club es un sistema de gestion para discotecas que permite controlar las operaciones nocturnas: liquidaciones de trabajadores, cuadre de caja, inventario y comparativos de ventas.

El sistema tiene dos roles:
- **Administrador**: Acceso completo. Ingresa datos, gestiona productos y trabajadores.
- **Dueno**: Solo consulta el Dashboard con los resultados del negocio.

---

## 1. Inicio de Sesion

Al abrir la aplicacion se muestra la pantalla de login.

1. Selecciona tu rol: **Administrador** o **Dueno**.
2. Ingresa tu **usuario** y **contrasena**.
3. Presiona **Ingresar**.

> Credenciales iniciales:
> - Administrador: `admin` / `admin123`
> - Dueno: `dueno` / `dueno123`

La sesion se mantiene activa mientras uses la app. Se renueva automaticamente cada 15 minutos.

---

## 2. Dashboard (Todos los roles)

El Dashboard muestra un resumen general del negocio con datos de todas las jornadas registradas.

### KPIs (Indicadores principales)

| Indicador | Que muestra |
|---|---|
| **Total Vendido** | Suma de todas las ventas de todos los trabajadores |
| **Total Recibido** | Suma de todos los pagos recibidos (efectivo + electronico + vales) |
| **Gastos + Cortesias** | Total de gastos operativos y cortesias de la casa |
| **Saldo Global** | Diferencia entre lo recibido y lo esperado. Verde = a favor, Rojo = en contra |

### Graficos

- **Rendimiento mensual**: Grafico de lineas comparando ventas vs recibido mes a mes.
- **Pagos por medio**: Grafico circular con el desglose por tipo de pago (Efectivo, Datafono, QR, Nequi, Vales).

### Rankings

- **Ranking Trabajadores**: Lista de trabajadores ordenados por total de ventas. Muestra: posicion, avatar, nombre, total vendido, noches trabajadas y promedio por noche. Presiona **"Ver todo"** para desplegar la lista completa.
- **Top Productos**: Los productos mas vendidos ordenados por monto total. Presiona **"Ver todo"** para ver todos.

---

## 3. Liquidacion (Solo Administrador)

La liquidacion es el proceso principal del sistema. Aqui se registra todo lo que ocurrio en una noche.

### Como crear una liquidacion

1. Ve a **Liquidar** desde el menu inferior (movil) o el sidebar (escritorio).
2. Selecciona la **fecha** de la jornada.
3. Para cada trabajador que trabajo esa noche:

#### a) Ventas
- Presiona **"+ Agregar producto"** para agregar una linea de venta.
- Selecciona el **producto** del dropdown.
- Ingresa la **cantidad** vendida.
- El **precio** y **total** se calculan automaticamente.
- Puedes agregar tantas lineas como necesites.

#### b) Pagos electronicos
- Si el trabajador recibio pagos por **Datafono**, **QR** o **Nequi**, presiona **"+ Transaccion"**.
- Selecciona el **tipo** de pago e ingresa el **monto**.

#### c) Vales
- Si hubo ventas a credito (fiados), presiona **"+ Vale"**.
- Ingresa el **nombre del tercero** y el **monto**.

#### d) Cortesias
- Si se regalaron productos (tragos de la casa), presiona **"+ Cortesia"**.
- Ingresa el **concepto** y el **monto**.

#### e) Gastos
- Para gastos operativos de la noche (hielo, servilletas, etc.), presiona **"+ Gasto"**.
- Ingresa el **concepto** y el **monto**.

#### f) Efectivo entregado
- Ingresa el **total en efectivo** que el trabajador entrego al final de la noche.

### Cuadre de caja

Al ingresar los datos, el sistema calcula automaticamente:

```
Total vendido       = Suma de todas las lineas de venta
(-) Cortesias       = Lo que se regalo
(-) Gastos          = Gastos operativos
= Lo esperado       = Lo que deberia haber ingresado

Efectivo entregado  = Plata en mano
+ Datafono          = Pagos por datafono
+ QR                = Pagos por QR
+ Nequi             = Pagos por Nequi
+ Vales             = Creditos
= Total recibido    = Lo que realmente ingreso

SALDO = Total recibido - Lo esperado
```

- **Saldo positivo (verde)**: Sobro plata (a favor del negocio).
- **Saldo negativo (rojo)**: Falto plata (en contra).
- **Saldo cero**: Cuadre perfecto.

4. Presiona **"Guardar Jornada"** para registrar la liquidacion.

---

## 4. Jornadas (Solo Administrador)

Historial de todas las jornadas registradas.

- Las jornadas se muestran en tarjetas colapsables, de la mas reciente a la mas antigua.
- **Tarjeta colapsada**: Muestra sesion, fecha, numero de trabajadores, total vendido y saldo.
- **Tarjeta expandida**: Presiona para ver el detalle completo:
  - Desglose por trabajador
  - Medios de pago utilizados
  - Cuadre de caja completo
  - Boton **Eliminar** (con confirmacion)

### Filtrar jornadas

Usa los campos **Desde** y **Hasta** para filtrar por rango de fechas. Presiona **"Limpiar"** para quitar el filtro.

---

## 5. Inventario (Solo Administrador)

Control de inventario fisico de productos.

1. Ve a **Inventario** desde el menu.
2. Presiona **"Nuevo Inventario"**.
3. Para cada producto:
   - **Inv. Inicial**: Cantidad al inicio de la noche.
   - **Entradas**: Producto que ingreso durante la noche.
   - **Inv. Fisico**: Conteo fisico al cerrar.
   - **Saldo** y **Total**: Se calculan automaticamente.
4. Presiona **"Guardar"**.

---

## 6. Comparativo (Solo Administrador)

Compara el conteo fisico de productos contra lo registrado en los tiquetes.

1. Ve a **Comparativo** desde el menu (en "Mas" en movil).
2. Presiona **"Nuevo Comparativo"**.
3. Para cada producto:
   - **Conteo**: Cantidad contada fisicamente.
   - **Tiquets**: Cantidad registrada en tiquetes/sistema.
   - **Diferencia**: Se calcula automaticamente.
4. Presiona **"Guardar"**.

Esto ayuda a detectar perdidas, robos o errores en el registro.

---

## 7. Productos (Solo Administrador)

Gestion del catalogo de productos.

### Agregar producto
1. Ve a **Productos**.
2. Ingresa el **nombre** y el **precio** en pesos colombianos.
3. Presiona **"Agregar"**.

### Editar producto
- Presiona el icono de lapiz junto al producto.
- Modifica nombre o precio.
- Presiona **"Guardar"**.

### Desactivar/Activar producto
- Presiona el boton de toggle. Un producto desactivado no aparece en la liquidacion pero no se elimina.

### Eliminar producto
- Presiona el icono de basura. Confirma en el modal.

> **Nota**: Eliminar un producto no afecta las jornadas pasadas. Los datos historicos usan snapshots del precio y nombre al momento del registro.

---

## 8. Configuracion (Solo Administrador)

### Trabajadores

Gestiona los trabajadores que operan en la discoteca.

#### Agregar trabajador
1. Ve a **Configuracion > Trabajadores**.
2. Ingresa el **nombre**.
3. El sistema asigna automaticamente un **color** y un **avatar** (2 letras iniciales).
4. Presiona **"Agregar"**.

#### Editar trabajador
- Presiona el icono de lapiz. Modifica el nombre.

#### Eliminar trabajador
- Presiona el icono de basura. Confirma la accion.

### Seguridad

#### Cambiar contrasena
1. Ve a **Configuracion > Seguridad**.
2. Ingresa tu **contrasena actual**.
3. Ingresa la **nueva contrasena** (minimo 6 caracteres).
4. Confirma la nueva contrasena.
5. Presiona **"Cambiar contrasena"**.

---

## 9. Navegacion

### En escritorio (PC)
- **Sidebar izquierdo**: Links a todas las secciones. El nombre del usuario y rol aparecen abajo.
- **Boton "Cerrar sesion"**: Cierra la sesion y vuelve al login.

### En movil
- **Barra inferior**: Acceso rapido a Home, Liquidar, Jornadas, Inventario y Mas.
- **Menu "Mas"**: Se despliega desde abajo con las opciones adicionales (Comparativo, Productos, Configuracion, Cerrar sesion).
- **Header superior**: Logo de Monastery y boton de menu hamburguesa.

---

## 10. Formulas importantes

### Cuadre por trabajador
```
Esperado      = Total venta - Cortesias - Gastos
Total recibido = Efectivo + Datafono + QR + Nequi + Vales
Saldo         = Total recibido - Esperado
```

### Cuadre del dia (global)
```
Se suman los cuadres de todos los trabajadores de la jornada.
```

### Formato de moneda
- Valores grandes: `$1.5M` (millones), `$500K` (miles)
- Valor completo visible debajo en formato `$1.500.000`

---

## 11. Preguntas frecuentes

**P: ¿Que pasa si me equivoco en una liquidacion?**
R: Puedes eliminar la jornada completa desde la seccion Jornadas y volverla a crear.

**P: ¿El dueno puede modificar datos?**
R: No. El rol Dueno solo tiene acceso de lectura al Dashboard.

**P: ¿Que es "Barra" en los trabajadores?**
R: Barra es el punto de venta principal de la discoteca. Se trata como un trabajador mas para registrar sus ventas.

**P: ¿Puedo cambiar el precio de un producto sin afectar jornadas pasadas?**
R: Si. Al registrar una liquidacion, se guarda una copia (snapshot) del precio en ese momento. Cambios futuros no afectan el historico.

**P: ¿Que hago si mi sesion se cierra sola?**
R: Vuelve a iniciar sesion. El token de acceso dura 15 minutos y se renueva automaticamente, pero si cierras el navegador deberas ingresar de nuevo.
