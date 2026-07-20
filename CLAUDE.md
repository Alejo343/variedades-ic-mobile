@AGENTS.md

Guía para Claude Code al trabajar en este repositorio. Léela antes de tocar código.

## Qué es este proyecto

App móvil (Expo/React Native) para administrar el negocio **IC Variedades**:
productos, inventario y (en fases futuras) vendedores, ventas, liquidaciones
y caja. Es la versión móvil del sistema de gestión que también existe como
panel web en el repo hermano `variedades-ic` (`c:\Users\David\Documents\variedades-ic\variedades-ic`),
pero **es un proyecto totalmente independiente**: repo propio, sin compartir
backend ni base de datos con la web. No lo abras esperando encontrar un
`app/api/` que llamar — no existe.

## Decisión de arquitectura: 100% offline, sin servidor

Dos restricciones reales llevaron a este diseño (decidido en la sesión que
originó este repo, ver el repo web para el historial completo de esa
conversación si hace falta contexto):

1. Sin presupuesto todavía para desplegar un backend con dominio + HTTPS.
2. Necesidad de usar la app sin conexión a internet.

Por eso **todos los datos viven en SQLite local, en el propio teléfono**.
No hay login, no hay token, no hay llamada de red para el uso normal de la
app. El día que haya presupuesto, se agrega sincronización remota como una
fase aparte — el diseño en capas de abajo deja ese camino abierto sin
haberlo construido todavía.

```
Pantallas (React Native / Expo Router)
      │
      ▼
lib/domain/*      ← lógica pura, sin I/O, con tests (portada del repo web)
      │
      ▼
lib/data/*        ← interfaz de acceso a datos (ProductsRepo, InventoryRepo)
      │
      ▼
lib/data/local/*  ← ÚNICA implementación hoy: SQLite (expo-sqlite + drizzle-orm)
      │
      · lib/data/remote/*  ← NO existe todavía; futuro segundo implementador
                              de la misma interfaz, hablando con una API
                              remota. Las pantallas NUNCA importan
                              `local/` ni `remote/` directo, solo la
                              interfaz de `lib/data/` — así agregar sync
                              remoto no toca UI ni dominio.
```

- Cada tabla SQLite reserva desde ya columnas `updatedAt`/`syncStatus`
  (sin usar todavía, default `'local'`) para que, si algún día se agrega
  sync, se pueda saber qué cambió localmente sin migrar datos existentes.
  Si en unos meses el sync nunca se construye, esas columnas se eliminan
  igual que se hizo en el repo web con columnas reservadas "por si acaso"
  que nunca se usaron (ver `CLAUDE.md` del repo web, sección "Fase 10 —
  descartada", como precedente de esa limpieza).
- Sin autenticación: un solo usuario, datos solo en su propio dispositivo,
  protegidos por el bloqueo del teléfono.

## Cómo trabajamos aquí (spec-driven + tests)

Mismo método que en el repo web hermano — esto **no es "vibe coding"**.
Para cada módulo, en este orden estricto:

1. **Contrato primero**: definir entrada, salida e invariantes (tipos +
   comentario). Nada de escribir implementación antes de saber qué debe
   cumplir.
2. **Test de solución conocida**: un caso pequeño cuya respuesta se sepa a
   mano, escrito ANTES que la implementación.
3. **Implementación**: el mínimo código hasta que el test pase.
4. **Verificar antes de seguir**: `npm run test` en verde + typecheck. No
   se avanza al siguiente módulo con algo en rojo.

La spec y los tests son la verdad; el código es solo el _cómo_. Principios
que lo refuerzan (idénticos a los del repo web):

- Si el código y la spec discrepan, gana la spec.
- Trocear: avanzar en partes pequeñas y autocontenidas, no todo de golpe.
- Decisiones que cambian la calidad del producto o el alcance no se toman
  solas — se presentan trade-offs y se le pregunta al usuario.
- Toda función de `lib/domain/*` llega con su test.
- No diseñar para requisitos hipotéticos futuros más allá de lo ya
  decidido explícitamente arriba (las columnas `updatedAt`/`syncStatus`
  son la única excepción consciente, y está documentada como tal).

## Arquitectura y reglas duras

- **`lib/domain/`** — lógica pura portada tal cual del repo web:
  `stock.ts` (`receiveStock`/`deductStock`), `inventory-movement.ts`
  (`applyMovement`/`validateAdjustmentReason`), `sku.ts`
  (`getSkuPrefix`/`formatSku`), cada uno con su `.test.ts`. Sin
  dependencias de React Native ni de la base de datos.
- **`lib/validations.ts`** — schemas Zod portados del repo web
  (`productSchema`, `inventoryAdjustmentSchema`).
- **`lib/data/`** — interfaces (`ProductsRepo`, `InventoryRepo`) que las
  pantallas consumen. `lib/data/index.ts` exporta la implementación activa
  (hoy siempre SQLite).
- **`lib/data/local/`** — implementación real con `expo-sqlite` +
  `drizzle-orm/expo-sqlite`, migraciones vía `drizzle-kit` (dialecto
  sqlite).
- Las pantallas (`app/`) solo manejan UI e interacción — nunca importan
  `expo-sqlite`/Drizzle directo, siempre pasan por `lib/data/`.

## Alcance — Fase 1: Productos e Inventario

Sub-pasos (cada uno: contrato/schema → test si aplica → implementación
mínima → `npm run test` en verde antes de seguir):

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Setup: dependencias (`expo-sqlite`, `drizzle-orm`, `drizzle-kit`, `zod`, `vitest`, `expo-image-picker`, `expo-file-system`, `expo-sharing`) + config de Vitest | ✅ listo |
| 2 | Portar `lib/domain/` (stock, inventory-movement, sku) + tests desde el repo web; `npm run test` en verde | ✅ listo |
| 3 | Portar subset de `lib/validations.ts` (productSchema, categorySchema, inventoryAdjustmentSchema, toSlug) | ✅ listo |
| 4 | Schema SQLite (`categories`, `products`, `inventory_movements`) con `updatedAt`/`syncStatus` reservados + migración drizzle-kit | ✅ listo |
| 5 | `lib/data/`: interfaces `ProductsRepo`/`InventoryRepo` + implementación local SQLite | ✅ listo |
| 6 | CRUD de categorías (pantalla + lógica) | ✅ listo |
| 7 | CRUD de productos (listado, detalle/edición, creación, foto con `expo-image-picker`) | ✅ listo |
| 8 | Inventario: ledger de movimientos, ajuste manual, alertas de stock mínimo/agotado | ✅ listo |
| 9 | Pantalla de Respaldo (exportar/importar el archivo SQLite vía `expo-file-system`/`expo-sharing`) | ✅ listo |
| 10 | Verificación end-to-end manual, **en modo avión** (confirmar que de verdad no depende de red) | ✅ listo |

**Fase 1 completa (10/10 sub-pasos).** Fase 2 (Caja y Ventas en local) también completa — ver "Alcance — Fase 2" más abajo. Próximo: Fase 3 (Vendedores) u otra fase del roadmap, o sincronización remota — ver "Roadmap — Fases 2-9" para el diseño de alcance de cada una.

**Notas de implementación (sub-pasos 1-6, completados):**

- Metro necesita dos ajustes que no son obvios para que `drizzle-orm/expo-sqlite/migrator` funcione: `metro.config.js` agrega `"sql"` a `resolver.sourceExts`, y `babel.config.js` agrega el plugin `babel-plugin-inline-import` (`{ extensions: ['.sql'] }`) — sin el plugin de Babel, Metro encuentra el `.sql` pero intenta parsearlo como JS y falla. Ambos archivos ya están en el repo.
- Se reemplazaron las pantallas de demo del template (`index.tsx`/`explore.tsx`, tabs "Home"/"Explore") por la navegación real: tabs "Productos"/"Inventario" (`app-tabs.tsx`), con categorías anidadas dentro del stack de Productos (`products/categories/*`, accesible desde un botón "Gestionar categorías").
- `products/index.tsx` e `inventory/index.tsx` son stubs "Próximamente" — los reemplaza el sub-paso 7 y 8 respectivamente. `products/_layout.tsx` ya declara las rutas `new`/`[id]` que esos sub-pasos van a crear (por ahora generan un warning de Expo Router inofensivo, "No route named... exists", porque los archivos aún no existen).
- Verificado en vivo en el emulador Android (AVD "CelularBanco"): crear categoría → aparece en la lista con slug autogenerado; editar → prefill correcto; desactivar → aparece "· inactiva". Confirma que las migraciones de SQLite corren solas al abrir la app y que el CRUD contra la base local funciona de punta a punta, no solo a nivel de tipos.
- Conectar Expo Go al Metro del emulador fue más manual de lo esperado: fue necesario forzar `am start -a android.intent.action.VIEW -d "exp://localhost:8081"` (usando el túnel de `adb reverse` en vez de la IP LAN que Expo intenta primero) y hacer `force-stop` + relanzar limpio una vez — quedó documentado aquí por si se repite en la siguiente sesión.
- `lib/format.ts#formatCOP` formatea pesos a mano (separador de miles con regex) en vez de `Intl.NumberFormat('es-CO', {style:'currency'})` — el soporte de `Intl` con estilo moneda en Hermes/Android no está garantizado en todos los builds, y esto evita ese riesgo sin dependencias nuevas.
- `lib/images.ts#pickAndPersistProductImage` usa la API nueva de `expo-file-system` (`File`/`Paths`, no la API "legacy" con funciones sueltas) — SDK 57 la trae por defecto. Copia la foto elegida al `Paths.document` de la app porque el URI que devuelve el picker no está garantizado que sobreviva un reinicio.
- Verificado en vivo: crear producto ("Audifonos Bluetooth", sin categoría, precio 50000) → aparece en la lista con SKU autogenerado `GEN-00001` y precio formateado `$50.000`, stock 0 mostrando "· agotado"; abrir el detalle → todos los campos prellenados correctamente, incluido el SKU (solo lectura); editar precio a 55000 → guarda y la lista refleja `$55.000`. **No** se probó en vivo seleccionar una foto real del picker (la interacción con la galería del emulador vía `adb` es más compleja) — sí se verificó que el código compila y sigue la API documentada de `expo-image-picker`/`expo-file-system`; probarlo con una foto real queda pendiente la próxima vez que se abra la app.
- El warning `[Layout children]: No route named "[id]" exists...` puede aparecer una vez en el log después de agregar un archivo de ruta nuevo (`products/[id].tsx`) mientras el Fast Refresh todavía no había registrado el árbol de rutas — es transitorio, no bloquea nada; si persiste tras recargar, ahí sí investigar.
- `inventory/index.tsx` resuelve `productId → nombre` en memoria (un `Record` armado con `productsRepo.list()` en el mismo `useFocusEffect`) en vez de que `InventoryRepo` devuelva el nombre ya unido — mantiene `InventoryMovement` desacoplado de `Product` en la interfaz, igual criterio que las queries del repo web que evitan joins innecesarios.
- `inventory/adjust.tsx` reutiliza `lib/domain/inventory-movement.ts#applyMovement`/`validateAdjustmentReason` tal cual (sin adaptar nada) — la pantalla solo arma el `InventoryAdjustmentInput` y delega en `inventoryRepo.recordAdjustment`.
- Verificado en vivo: producto recién creado con stock 0 apareció en "Agotados"; ajuste manual `+10` con motivo "Recepcion inicial de stock" → la alerta desapareció (pasó a "Sin alertas de stock") y el movimiento quedó en "Movimientos recientes" como `+10 · Recepcion inicial de stock`. Confirma `applyMovement` + el ledger local funcionando de punta a punta.
- **Nota para pruebas manuales futuras con ADB**: al leer coordenadas de un screenshot mostrado en el chat, hay que multiplicarlas por el factor de escala indicado (ej. "displayed at 900x2000" sobre un dispositivo de 1080x2400 real es ×1.2) antes de pasarlas a `adb shell input tap`. Es más confiable sacar las coordenadas de un `uiautomator dump` (bounds en píxeles reales) que estimarlas a ojo del screenshot — varias pruebas de esta fase fallaron o dispararon menús de desarrollador por mezclar ambos sistemas de coordenadas.
- **`inventory/backup.tsx`** — exportar usa `VACUUM INTO` sobre el `sqliteDb` crudo (no vía Drizzle) para generar un snapshot consistente en `Paths.cache`, sin importar si la conexión viva está en modo WAL con escrituras aún no volcadas al `.db` principal — copiar el archivo `.db` tal cual habría sido incorrecto. Importar pide confirmación (`Alert.alert`, acción destructiva) antes de `sqliteDb.closeAsync()` + reemplazar el archivo vivo con el elegido vía `File.pickFileAsync()`; como la conexión ya no se puede "reabrir" sola en caliente, el mensaje final le pide al usuario cerrar y reabrir la app.
- **Bug real encontrado y corregido en vivo**: `backupFile.uri` (bajo Expo Go) viene con partes de la ruta *doblemente* percent-encoded (la carpeta de sandbox de la experiencia incluye `%2540`/`%252F` por el `@`/`/` del nombre del paquete `@anonymous/variedades-ic-mobile`). Pasar ese string tal cual a `VACUUM INTO '<path>'` fallaba con "unable to open database" porque SQLite espera una ruta de archivo literal, no una URI codificada — hace falta `decodeURIComponent()` después de quitar el prefijo `file://`. Confirmado en el emulador: sin el fix, error visible en pantalla; con el fix, `VACUUM INTO` genera el archivo y se abre la hoja de compartir nativa de Android con el `.db` real.
- **No verificado en vivo**: el flujo de "Importar respaldo" completo (elegir un archivo real desde el picker del sistema y confirmar que los datos se restauran) — orquestar el selector de archivos nativo de Android vía ADB es bastante más involucrado que los demás flujos probados. El código sigue la misma API ya verificada (`File.pickFileAsync`, `copy`, `closeAsync`) y compila limpio, pero probarlo con un archivo real queda pendiente para cuando se use la app de verdad.
- **Sub-paso 10 — verificación en modo avión, confirmada**: con WiFi y datos móviles del emulador apagados (`adb shell svc wifi disable` / `svc data disable` — el broadcast estándar `ACTION_AIRPLANE_MODE` está bloqueado por permisos en Android moderno, hubo que forzar los radios directamente), se probó lectura (listado de productos con datos reales) y escritura (crear una categoría nueva, "Belleza") — ambas funcionaron exactamente igual que con red, confirmando que la app no depende de ninguna conexión para su operación normal (la única conexión de red en todo este proceso es la del propio Metro/Expo Go, que es solo de desarrollo y no existe en una build de producción).

## Alcance — Fase 2: Caja y Ventas en local

En construcción (sesión 2026-07-19). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que la Fase 1
(cada uno: contrato/schema → test si aplica → implementación mínima →
`npm run test` en verde antes de seguir).

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema SQLite (`cash_movements`, `direct_sales`, `direct_sale_items`) + migración drizzle-kit | ✅ listo |
| 2 | Validaciones Zod (`cashMovementSchema`, `directSaleItemSchema`, `directSaleSchema`) | ✅ listo |
| 3 | `lib/data/cash-repo.ts` (interfaz) + `lib/data/local/cash-repo.ts` (saldo derivado, listado, registrar movimiento) + wiring en `lib/data/index.ts` | ✅ listo |
| 4 | `lib/data/direct-sales-repo.ts` (interfaz) + `lib/data/local/direct-sales-repo.ts` (creación transaccional fail-fast, reutiliza `applyMovement` + inserta ingreso en caja) + wiring | ✅ listo |
| 5 | Pantallas de Caja: tab nuevo, listado + saldo, registrar movimiento manual (ingreso/gasto) | ✅ listo |
| 6 | Pantallas de Ventas en local: tab nuevo, listado de ventas pasadas, nueva venta tipo POS (filas producto/cantidad/precio, total corriendo) | ✅ listo |
| 7 | Verificación end-to-end manual en el emulador (venta descuenta stock + genera ingreso en caja; movimiento manual de gasto; saldo consistente) | ✅ listo |

**Fase 2 completa (7/7 sub-pasos).** Verificado con `npm run test` (27/27) + `npm run lint` + `npx tsc --noEmit` en verde, más flujo manual en el emulador Android.

**Notas de implementación (sub-pasos 1-6):**

- `recordProductMovement` (nuevo, extraído de `local/inventory-repo.ts`) y `recordCashMovementTx` (nuevo, en `local/cash-repo.ts`) son helpers transaccionales reutilizables — mismo rol que `recordPrincipalMovement`/`recordCashMovement` en el repo web. `recordAdjustment` (Fase 1) se refactorizó para usar el primero sin cambiar su comportamiento. `direct-sales-repo.ts` usa ambos dentro de una sola transacción Drizzle: por cada item descuenta stock (tipo `venta`, lanza y hace rollback si no alcanza — mismo patrón fail-fast que el resto del proyecto, apoyado en que `db.transaction` revierte todo ante una excepción), inserta el item, y al final inserta el ingreso en caja si el total es mayor a 0.
- Nuevo tipo `Tx` en `local/db.ts` (`Parameters<Parameters<typeof db.transaction>[0]>[0]`) para tipar estos helpers sin redefinir los genéricos de Drizzle.
- `paymentMethod` en `direct_sales` (que sí existe en el repo web, agregado ahí después del diseño original de la Fase 2) **no se portó** — el diseño de esta fase para el móvil lo dejó explícitamente diferido (ver "Roadmap — Fases 2-9" más arriba), y se mantuvo esa decisión.
- Tabs nuevos "Caja"/"Ventas" usan `<NativeTabs.Trigger.Icon md="payments" />` / `md="point_of_sale"` (nombres de Material Icons vía `expo-symbols`) en vez de assets PNG nuevos — no hay iconos propios para estas dos secciones todavía (los tabs existentes si tienen `home.png`/`explore.png`). Suficiente para Android (única plataforma probada hasta ahora); sin `sf` (SF Symbols) para iOS, no evaluado.
- `direct-sales/new.tsx` es un formulario tipo POS de una sola pantalla: buscar producto → tocar para agregarlo al carrito (si ya estaba, suma 1 a la cantidad) → cantidad/precio editables por fila con el precio de venta del producto precargado → total corriendo → "Cobrar".
- **Bug real encontrado y corregido durante la verificación manual (no de código, de entorno)**: al probar el primer movimiento de caja, la app devolvió en pantalla "Failed to run the query 'begin'" — la conexión SQLite había quedado con una transacción abierta de una sesión de Metro que llevaba corriendo desde antes de esta sesión (huérfana, en el puerto 8081, sobrevivió a un intento fallido de backgroundearla con `nohup ... &` que el tooling mató de todos modos). Un `force-stop` + relanzar Expo Go (nueva conexión SQLite desde cero) resolvió el error sin tocar código; el mismo movimiento se registró correctamente después. No es un bug de `recordCashMovementTx`/`db.transaction` — quedó documentado aquí porque es fácil de confundir con uno.
- **Nota de tooling para sesiones futuras**: `npx expo start` con `run_in_background: true` debe lanzarse *directo* (sin envolver en `nohup ... &` dentro de un subshell) — envolverlo mata el proceso en cuanto el comando wrapper retorna. Además, el tipado de rutas de Expo Router (`.expo/types/router.d.ts`) puede quedar inconsistente (rutas nuevas aparecen solo como `/carpeta/index` en vez de `/carpeta`) si el archivo se generó de forma incremental mientras Metro seguía corriendo desde antes de que existieran esas rutas — un `expo start --clear` completo (cache limpio) más un reload de la app lo corrige; no es necesario para que la app funcione en tiempo de ejecución (la navegación real nunca falló), solo para que `npx tsc --noEmit` quede en verde.
- Verificado en vivo en el emulador Android: registrar un gasto manual "Pago de arriendo" $20.000 → saldo pasó de $0 a -$20.000 y apareció en el historial; venta en local de "Audifonos Bluetooth" (precio precargado $55.000, cantidad 1) → aparece en el listado de ventas como "Venta #1 · 1 producto · $55.000", el stock del producto bajó de 10 a 9 (confirmado en `/products`), y el saldo de caja subió a $35.000 (-$20.000 + $55.000) con el ingreso automático "Venta en local #1" en el historial — confirma `direct-sales-repo.ts` descontando stock y generando el ingreso en caja en la misma transacción, de punta a punta.

## Alcance — Fase 3: Vendedores

En construcción (sesión 2026-07-19). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que las Fases 1 y 2.

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema SQLite (`sellers`: `name`, `phone`, `city`, `commissionType`, `commissionValue`, `active`, `notes`) + migración drizzle-kit | ⬜ pendiente |
| 2 | Dominio: portar `lib/domain/commission.ts#calculateCommission` + test desde el repo web | ⬜ pendiente |
| 3 | Validaciones Zod (`sellerSchema`) | ⬜ pendiente |
| 4 | `lib/data/sellers-repo.ts` (interfaz) + `lib/data/local/sellers-repo.ts` (CRUD, mismo patrón que `categories-repo.ts`) + wiring en `lib/data/index.ts` | ⬜ pendiente |
| 5 | Pantallas: tab nuevo "Vendedores" — listado, crear, editar (mismo patrón que categorías de la Fase 1) | ⬜ pendiente |
| 6 | Verificación end-to-end manual en el emulador (crear/editar/desactivar vendedor, comisión guardada correctamente) | ⬜ pendiente |

No se consume todavía en esta fase (las Fases 4-7 lo consumen) — solo
establece el catálogo de vendedores y su configuración de comisión, igual
que en el repo web.

## Roadmap — Fases 2-9 (diseñado, sin construir)

Mismo orden y dependencias que el pivote del repo web (ver su `CLAUDE.md`,
sección "Roadmap: pivote a gestión integral de la empresa", fases 2-9) —
cada fase se apoya en la anterior. Decisiones tomadas al diseñar este
roadmap (sesión 2026-07-18): ese orden se confirmó tal cual, y la Fase 8
(compras a distribuidores) replica el flujo **completo** de la web
(`distributors` + `purchase_orders` con estados, no solo un registro de
deuda simple) — a diferencia de la web, donde ese módulo ya existía antes
del pivote, en el móvil hay que construirlo desde cero.

Cuando se aborde cada fase, se trocea en sub-pasos concretos igual que se
hizo con la Fase 1 (tabla de estado en este archivo) — lo de abajo es el
diseño a nivel de alcance, no la implementación. La Fase 2 ya tiene su
troceo activo arriba, en "Alcance — Fase 2".

**Fase 2 — Caja (`cash_movements`) + Ventas en local (`direct_sales`)**
- Schema: `cash_movements` (`type` ingreso/gasto, `amount` CHECK>0,
  `concept` NOT NULL, `movementDate`, `sourceType`/`sourceId`, `notes`);
  `direct_sales`/`direct_sale_items` (venta tipo POS, sin estados —nace ya
  cerrada—, igual que la web).
- Saldo de caja derivado (`SUM(ingreso) - SUM(gasto)`), calculado en
  consulta, nunca guardado — mismo criterio que el resto del proyecto.
- `createDirectSale`: transacción única fail-fast (valida stock de todos
  los items antes de escribir cualquiera, reutilizando `applyMovement`),
  inserta la venta + un movimiento `type: 'venta'` por item + el ingreso
  correspondiente en caja.
- Pantallas: `/cash` (listado + saldo + registrar movimiento manual),
  `/direct-sales/new` (filas de producto/cantidad/precio, precio
  precargado desde el producto, total corriendo).
- Diferido a propósito (igual que en la web): `paymentMethod`
  (efectivo/tarjeta), apertura/cierre de caja.

**Fase 3 — Vendedores (`sellers`)**
- Schema: `name`, `phone`, `city`, `commissionType`
  (`percentage`|`fixed_per_unit`), `commissionValue`, `active`, `notes`.
- Dominio: portar `commission.ts#calculateCommission` + test.
- CRUD simple, mismo patrón exacto que categorías (Fase 1). No se
  consume todavía — solo establece el catálogo para las fases 4-7.

**Fase 4 — Entregas a vendedores (`seller_deliveries`)**
- **Requiere migrar una tabla que ya tiene datos reales**: `inventory_movements`
  (de la Fase 1) gana `ownerType` (`'principal'|'seller'`, default
  `'principal'`) y `sellerId` (nullable) — primera migración del proyecto
  sobre una tabla no vacía. SQLite soporta `ALTER TABLE ADD COLUMN` con
  default sin reconstruir la tabla, así que no debería perder nada, pero
  vale la pena exportar un respaldo (Fase 1, sub-paso 9) antes de
  aplicarla, justo para eso existe.
- Schema nuevo: `seller_deliveries`/`seller_delivery_items` (sellerId,
  deliveryDate, notes; items con productId/quantity/unitCost).
- Transacción: descuenta el inventario principal (`type: 'entrega_vendedor'`)
  + inserta un movimiento `ownerType: 'seller'` positivo — igual que la
  web, dos filas en el mismo ledger.
- Pantalla: selector de vendedor + filas de producto/cantidad/costo
  (autocompletado con `purchasePrice`).

**Fase 5 — Inventario por vendedor + Ventas de vendedor (`seller_sales`)**
- Sin tabla nueva para el inventario: `getSellerBalance`/`getSellerInventory`
  agregan sobre el mismo ledger filtrando `ownerType='seller'` — mismo
  criterio "derivar, no duplicar" de siempre.
- Schema: `seller_sales`/`seller_sale_items` (sellerId, saleDate,
  totalAmount, commissionAmount, settlementId nullable — se conecta en la
  Fase 7).
- `createSellerSale`: fail-fast (valida saldo del vendedor +
  `deductStock` antes de escribir), calcula comisión con
  `commission.ts`, descuenta **solo** el inventario del vendedor, nunca
  el principal.
- Pantalla: detalle de vendedor con su inventario actual; formulario de
  venta limitado a lo que el vendedor tiene disponible.

**Fase 6 — Devoluciones y pérdidas de vendedor**
- Schema: `seller_returns`/`seller_return_items` (sin precio — no es una
  transacción monetaria); `seller_losses`/`seller_loss_items` (`type`
  perdida/daño/robo, `unitCost` NOT NULL).
- Devolución: descuenta del vendedor + regresa al principal (dos
  movimientos). Pérdida: descuenta solo del vendedor — el costo lo asume
  él, nunca toca el principal.
- Reutiliza el mismo selector de vendedor/producto de las fases 4-5.

**Fase 7 — Liquidaciones (`settlements`)**
- Schema: `sellerId`, `periodDate` con `UNIQUE(sellerId, periodDate)`,
  `totalSales`, `totalCommission`, `totalLosses`, `amountDue`, `status`,
  `settledAt`.
- Dominio: portar `settlement.ts#calculateSettlement` (`amountDue =
  totalSales - totalCommission + totalLosses`) + `settlement-status.ts#canTransitionSettlement`,
  ambos con tests.
- Al liquidar: genera un ingreso en `cash_movements` (Fase 2) — cierra el
  arco completo de consignación empezado en la Fase 3.

**Fase 8 — Compras a distribuidores + cuentas por pagar (alcance completo)**
- A diferencia de la web (donde este módulo ya existía antes del
  pivote), en el móvil se construye desde cero: `distributors` (CRUD
  simple) + `purchase_orders`/`purchase_order_items` (con estados
  `pendiente`→`en_viaje`→`recibido`|`cancelado`) + `purchase_payments`.
- Dominio: portar `order-status.ts#canTransitionPurchaseOrder` (no hizo
  falta en la Fase 1) + test.
- Al recibir un pedido: transacción que suma stock (`type: 'compra'`) —
  único camino a `recibido`, igual que la web.
- Saldo pendiente derivado (`totalCost - SUM(pagos)`), no guardado.
- Es la fase más grande de todo el roadmap — trocear en sub-pasos como la
  Fase 1 cuando se aborde, probablemente la que más beneficio saque de
  dividirse bien.

**Fase 9 — Reportes consolidados**
- Sin tabla nueva, solo agregaciones de solo lectura sobre todo lo
  anterior — los mismos reportes de la web (inventario, compras, ventas,
  utilidad, caja, cuentas por pagar, inventario/ventas por vendedor,
  productos devueltos), adaptados: el móvil no tiene pedidos por
  WhatsApp (`salesOrders`), así que el reporte de ventas solo une
  `direct_sales` + `seller_sales`.

**Aparte de todo esto** (no es una fase de negocio): sincronización
remota (`lib/data/remote/`) — solo cuando haya presupuesto para el VPS,
diseño en capas ya preparado desde la Fase 1 pero sin construir nada
todavía.

## Comandos

```bash
npm install          # instalar dependencias
npx expo start        # arranque en dev
npm run android        # abrir en emulador/dispositivo Android
npm run test           # Vitest — lib/domain/* y lib/validations.ts
npm run lint            # expo lint
```

## Convenciones

- Tipado estricto en todo el proyecto.
- Código y comentarios en inglés; docs y explicaciones al usuario, en español.
- No introducir dependencias pesadas en `lib/domain/` sin justificarlo —
  debe seguir siendo pura y portable.
- Verificar siempre antes de dar algo por terminado: `npm run test` en
  verde, más una pasada manual en el emulador/dispositivo (en modo avión
  cuando se trate de confirmar que algo funciona offline).
