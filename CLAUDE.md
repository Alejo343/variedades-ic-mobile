@AGENTS.md

Guía para Claude Code al trabajar en este repositorio. Léela antes de tocar código.

> El detalle de cómo se construyó cada fase (bitácoras de verificación, bugs
> ya corregidos, decisiones descartadas) está en
> [`docs/historial.md`](docs/historial.md). Consultarlo solo cuando haga falta
> el porqué de algo; **lo vigente es este archivo**. Si algo de aquí choca con
> el historial, gana este archivo.

## Qué es este proyecto

App móvil (Expo SDK 57 / React Native) para administrar el negocio **IC
Variedades**: productos, inventario, caja, ventas en local, vendedores
(consignación y tienda), entregas, devoluciones/pérdidas, liquidaciones,
compras a distribuidores, reportes.

Es la versión móvil del panel web del repo hermano `variedades-ic`
(`c:\Users\David\Documents\variedades-ic\variedades-ic`), desplegado en
`https://icvariedades.com` (VPS + Postgres 16). Repos separados, sin código
compartido: lo que deba coincidir (lista de operaciones de sync, dominio
como `cash.ts`) se copia a mano en los dos lados.

## Arquitectura

**Offline-first con sync en segundo plano.** Las pantallas siempre leen y
escriben SQLite local; cuando hay red, un motor aparte sincroniza con el
servidor. Cada persona entra con su usuario (dueño o vendedor).

```
Pantallas (app/, Expo Router)
      │
      ▼
lib/domain/*      ← lógica pura, sin I/O, cada función con su test
      │
      ▼
lib/data/*        ← interfaces de repos (ProductsRepo, CashRepo, ...)
      │
      ▼
lib/data/local/*  ← implementación SQLite (expo-sqlite + drizzle-orm)
      │              cada escritura encola su operación en sync_outbox
      ▼
lib/sync/*        ← motor de sync: fotos → push → pull, disparadores, sesión
```

- Las pantallas **nunca** importan `expo-sqlite`/Drizzle ni `lib/data/local/*`
  directo: siempre `lib/data/index.ts`.
- `lib/validations.ts`: schemas Zod (portados del repo web).
- Las columnas `updatedAt`/`syncStatus` de cada tabla son de la Fase 1 y
  `syncStatus` **no se usa** (la sync terminó usando `uuid` + `sync_outbox`).
  No construir nada encima de ella.

## Cómo trabajamos aquí (spec-driven + tests)

Para cada módulo, en este orden estricto:

1. **Contrato primero**: entrada, salida e invariantes (tipos + comentario).
2. **Test de solución conocida**, escrito ANTES que la implementación.
3. **Implementación** mínima hasta que el test pase.
4. **Verificar antes de seguir**: `npm run test` + `npx tsc --noEmit` en verde.

- Si el código y la spec discrepan, gana la spec.
- Trocear: avanzar en partes pequeñas y autocontenidas.
- Decisiones que cambian la calidad del producto o el alcance no se toman
  solas: se presentan trade-offs y se le pregunta al usuario.
- Toda función de `lib/domain/*` llega con su test.
- No diseñar para requisitos hipotéticos.
- **Pruebas manuales**: darle al usuario una lista de pasos concretos (qué
  tocar, qué escribir, qué verificar) y esperar su reporte; no manejar taps
  por ADB. ADB sí vale para pasos no interactivos (arrancar emulador, abrir
  Expo Go con un intent).
- Una funcionalidad no se da por terminada hasta verificarla en el celular
  (typecheck y tests no garantizan APIs nativas como `expo-file-system`,
  `NetInfo`, `File.upload`).

## Reglas de negocio vigentes

Criterio general: **derivar, no duplicar**. Saldos e inventarios se calculan
con agregaciones sobre los ledgers, nunca se guardan.

**Inventario**
- `inventory_movements` es un solo ledger con `ownerType`
  (`principal`|`seller`) + `sellerId`. El inventario del vendedor es
  `SUM(quantityDelta)` de sus filas `seller`; `products.stock` es el del
  principal.
- Helpers transaccionales en `local/stock-movements.ts`:
  `recordProductMovement` (principal, toca `products.stock`) y
  `recordSellerMovement` (ledger del vendedor). Ambos usan `applyMovement` del
  dominio (fail-fast "Stock insuficiente" en el celular).
- **Editar un producto nunca cambia su stock**: `products-repo.ts#update`
  ignora `stock`. El stock inicial al crear se registra como ajuste "Stock
  inicial". Cualquier cambio de stock es un movimiento (el servidor nunca
  toma `stock` del celular).
- Movimientos por flujo: entrega a vendedor (−principal, +vendedor),
  devolución (−vendedor, +principal), pérdida/daño/robo (solo −vendedor, el
  costo lo asume él), compra recibida (+principal, `type: 'compra'`), venta
  en local (−principal), venta de vendedor (−vendedor).
- El stock puede quedar **negativo** por ventas sincronizadas sin conexión
  (decisión del usuario: la venta ya ocurrió). Agotados = `stock <= 0`.

**Caja**
- `cash_movements` (ingreso/gasto) siempre con `accountId` de `cash_accounts`
  (catálogo editable). Saldo por cuenta derivado.
- Escriben en caja: movimiento manual, venta en local (ingreso), liquidación
  (ingreso al marcarla liquidada), pago a distribuidor (gasto), pago de
  comisiones (gasto), transferencia entre cuentas y ajustes de caja (web).
- **Transferencias** (`sourceType = 'transferencia'`, dos filas) y **ajustes**
  (`sourceType = 'ajuste'`) no son ingreso/gasto del negocio: todo flujo
  (Inicio, Caja, Reportes) filtra con `lib/domain/cash.ts#isBusinessCashMovement`.

**Ventas**
- Venta en local (`direct_sales`): POS, descuenta stock + ingreso en caja en
  una transacción. El descuento se reparte proporcionalmente entre los
  `unitPrice` de las líneas (no hay columna de descuento).
- Venta de vendedor de consignación (`seller_sales`): descuenta solo su
  inventario, calcula comisión (`commission.ts`), **no toca caja** (entra al
  liquidar).
- `commissionValue` en porcentaje va en puntos base (`1500` = 15%).

**Vendedores**: `sellers.inventory_mode` = `consignment` | `store`.
- **Tienda**: vende del inventario principal con el mismo POS; su venta es una
  `direct_sales` con `sellerId` + `commissionAmount` y entra a caja ya. No
  recibe entregas. No se pasa a `store` si su ledger de consignación no está
  en cero.
- **Pago de comisiones** (`commission_payments`) y **liquidaciones**
  (`settlements`, `UNIQUE(sellerId, periodDate)`) siguen la misma regla:
  cubren **todo lo pendiente hasta la fecha** que ningún pago/liquidación
  anterior incluyó (ventas y pérdidas llevan `settlement_id`, ventas de tienda
  `commission_payment_id`). Lo que llega tarde entra en el siguiente.
- Liquidación: `amountDue = totalSales − totalCommission + totalLosses`;
  transición con `canTransitionSettlement`; al liquidar se elige cuenta.

**Compras**: `purchase_orders` `pendiente → en_viaje → recibido | cancelado`
(`canTransitionPurchaseOrder`; `recibido` es terminal, por eso no hay
`stockUpdated`). `totalCost` se calcula de los items. Pagos solo a crédito,
no cancelado y nunca más de lo pendiente. Importación desde Excel
(`lib/purchase-import.ts`): columnas por posición A=código, B=nombre,
C=cantidad, D=valor unitario; empareja por nombre normalizado y crea productos
nuevos si no hay coincidencia (riesgo conocido de duplicados). En "Nuevo
pedido" también se crea un producto a mano ("Producto nuevo"), con el **mismo
formulario** de Productos → Nuevo producto (`components/new-product-form.tsx`,
modo `order`: sin stock inicial — llega al recibir el pedido —, con cantidad
para el pedido, costo obligatorio y precio de venta opcional = costo). Hay un
solo formulario de creación de producto en toda la app; no duplicarlo. Ese
formulario y la importación de Excel usan la misma regla de duplicados
(`purchase-import.ts#planNewProduct`: un nombre que ya existe ofrece ese
producto en vez de crear otro) y comparan contra **todo** el catálogo,
incluidos los desactivados (el slug es único en la base).

**Productos**: varias fotos (`product_images`, una principal garantizada por
índice único parcial y por `lib/domain/product-images.ts`).
`products.distributor_code` opcional y único (código del proveedor, no una FK
a `distributors`). SKU lo asigna el servidor; se muestra "(pendiente)" hasta
sincronizar.

**Reportes** (`more/reports.tsx`, `lib/report-periods.ts`): utilidad **bruta**
= ventas − cantidad × `purchasePrice` *actual* (sin comisión ni gastos, igual
que la web). El filtro de período solo afecta reportes de flujo; los de estado
(inventario, saldos, cuentas por pagar) muestran siempre el momento actual.

**Fechas**: las columnas de SQLite guardan texto UTC `"YYYY-MM-DD HH:MM:SS"`.
- **Nunca `DATE(col)` ni `startsWith(hoy)` contra una fecha local.** Usar
  `format.ts#startOfLocalDayUtc`/`endOfLocalDayUtc` en SQL e `isOnLocalDay` en
  memoria.
- Timestamps armados en JS para un payload de sync: `toSqliteUtcTimestamp(date)`,
  nunca `toISOString()` (el servidor rechaza la `T…Z`).

## Sincronización (Fase 10)

Contrato con el servidor (detalle del lado web en el `CLAUDE.md` del repo web).

- **Identidad por `uuid`**: toda tabla sincronizable tiene `uuid` único
  (`syncUuid()` en `schema.ts`). Los `id` numéricos son locales a cada base y
  nunca viajan; las referencias viajan como `productUuid`, `sellerUuid`, etc.
  "Venta #7" es el id local, solo una etiqueta de este teléfono.
- **Push = operaciones**: cada repo llama `outbox.ts#enqueueOperation(tx, type,
  payload)` **en la misma transacción** que su escritura, con los `uuid` de
  todas las filas que crea. Tipos en `lib/sync/operation-types.ts` (copia
  exacta de `SYNC_OPERATION_TYPES` del servidor; una operación nueva se agrega
  primero en el servidor). Una fila en `sync_outbox` = pendiente; se borra con
  `applied`/`rejected`; un `rejected` pasa a `sync_rejections` (visible en
  Configuración, con Descartar/Reintentar); `error`/`skipped` se reintenta.
- **Pull = filas, el servidor manda**: `GET /api/sync/pull?since=<cursor>`,
  upsert por `uuid` en `pull-apply.ts` (orden padres → hijos, `cash_movements`
  al final), lápidas al final de la página. El cursor (kv-store) avanza solo
  después de confirmar la página. `products.stock` siempre viene del servidor.
- **Orden de una corrida** (`engine.ts#runSync`): subir fotos `file:` → push →
  pull. Corridas simultáneas comparten la misma promesa.
- **Reiniciar el cursor** (`resetCursor`) siempre que los datos locales se
  reemplazan: primer login (`wipeAllTables`), cambio de
  alcance del pull (`scope.ts`). Botón "Forzar resincronización completa" en
  Configuración.
- **Disparadores** (`scheduler.ts` + `hooks/use-auto-sync.ts`): login
  (inmediato), arranque, volver a primer plano, reconexión, cada 60 s con la
  app activa (freno de 30 s) y 2 s después de una escritura local.
- **Pantallas reactivas**: usar `hooks/use-data-focus-effect.ts`
  (`useDataFocusEffect`) en vez de `useFocusEffect` en pantallas que muestran
  datos. Los formularios de edición que precargan campos usan
  `useFocusEffect` a propósito (para no pisar lo que se escribe).
- **Fotos**: la URL se guarda tal cual la da el servidor (relativa,
  `/uploads/...`); `image-url.ts#resolveImageUri` la vuelve absoluta solo al
  mostrarla. `expo-image` cachea en disco.
- **Sesión**: token en `expo-secure-store`; URL del servidor solo en
  `lib/sync/config.ts`. El primer login de un celular borra la base local.
- No hay respaldo local (se eliminó): la copia de verdad es la base del
  servidor. La app abre una sola conexión SQLite al arrancar y nunca la
  cierra.
- Las contraseñas de vendedores no pasan por la cola: "Acceso a la app" en la
  ficha del vendedor llama directo a la API (requiere internet).

## Roles

- **Dueño**: tabs Inicio / Buscar / Vender / Más; ve y hace todo.
- **Vendedor de consignación**: tabs Vender (venta de consignación,
  `components/seller-sale-form.tsx`) y Más (su inventario, sus ventas,
  devoluciones, pérdidas, sus liquidaciones, Configuración).
- **Vendedor de tienda**: Vender = mismo POS del dueño con su `sellerId`; Más
  con Mis ventas y Mis comisiones.
- `hooks/use-my-seller.ts` resuelve el vendedor de la sesión por `uuid`.
- La navegación por rol no es seguridad: lo que protege es el servidor (pull
  filtrado por rol, push con `authorizeOperation`).

## Navegación y UI

- 4 tabs (`components/app-tabs.tsx`): Inicio, Buscar, Vender, Más. El resto
  vive anidado en `app/more/*` (cada carpeta con su propio `_layout.tsx`).
- Límites de `NativeTabs` en Android: máximo **6** ítems (un 7º crashea);
  `hidden` hace el tab inalcanzable; los íconos de tab son Material Symbols
  (`md=`), no Lucide.
- Design system en `constants/theme.ts`: tokens `text`, `background`,
  `backgroundElement`, `backgroundSelected`, `textSecondary`, `primary`,
  `border`, `error`, `warning`, `info`, `success`...; `Spacing` (grid de 8),
  `Layout`, `Radii`, `Shadow.subtle`, `withAlpha`. Tema claro por defecto
  (`lib/theme-preference.ts`, `hooks/use-app-color-scheme.ts`).
- Tipografía Inter vía `ThemedText` (`type`: `greeting`, `sectionTitle`,
  `bigNumber`, `cardTitle`, `secondary`, `caption`...). Íconos Lucide en todo
  lo que no sea la tab bar.
- Componentes compartidos: `pos.tsx` (grid y carrito del POS), `form.tsx`
  (`FormSection`, `FormField`, `FormInput`, `FormChip`), `menu-row.tsx`,
  `sale-list.tsx`, `record-list.tsx` (historiales), `stock-cart-form.tsx`
  (entrega/devolución/pérdida: grid + carrito + costo opcional),
  `seller-form.tsx` (crear/editar vendedor), `date-choice.tsx` (Hoy / Ayer /
  otra fecha), `account-type-picker.tsx`, `sync-status.tsx`.
- Vendedores (lado dueño): la ficha `more/sellers/[id]/index.tsx` es un perfil
  (cifras, acciones, inventario, actividad, historial filtrado, acceso a la
  app); editar datos está en `[id]/edit.tsx`. Los historiales (entregas,
  ventas, devoluciones, pérdidas, liquidaciones, `sell/history`) aceptan
  `?sellerId=` para mostrar solo los de un vendedor. La comisión en porcentaje
  se escribe como porcentaje (`lib/seller-commission.ts` convierte a puntos
  base).
- Rediseñadas con el lenguaje visual nuevo: Inicio, Vender (POS), Reportes,
  pantallas del vendedor, Productos (lista/crear/editar), Inventario, Ajustar
  stock, Caja y Cuentas, Vendedores (lado dueño, todo), Compras,
  Distribuidores, Categorías y el menú Más del dueño (grupos Negocio /
  Catálogo con un dato en vivo por fila). **Pendiente**: Buscar.
- Categorías (`components/category-form.tsx`): muestran el prefijo de SKU que
  reciben sus productos (`domain/sku.ts#getSkuPrefix`) y bloquean un nombre o
  slug repetido antes de guardar (slug único en la base). Renombrar una
  categoría no cambia el SKU de sus productos; el servidor solo re-prefija
  cuando un producto se mueve de categoría. Productos acepta `?categoryId=`.
- Compras: `components/purchase-status.tsx` (etiqueta y color por estado);
  la lista acepta `?distributorId=` y "Nuevo pedido" también (distribuidor
  preseleccionado); "Distribuidores" está en el encabezado de Compras.
- `lib/format.ts#formatCOP` formatea a mano (sin `Intl` de moneda, poco
  confiable en Hermes); igual `formatDateTime`/`formatTime`.

## Migraciones (drizzle-kit, SQLite)

- `npm run db:generate`; corren solas al abrir la app.
- Para agregar una columna y quitar otra en la misma tabla, separarlo en
  migraciones distintas: si no, `drizzle-kit` abre un prompt interactivo de
  "¿es un rename?" que no se puede responder sin TTY (ejemplo: `0009`-`0011`).
- `ADD COLUMN ... NOT NULL` sin default constante: primero nullable + relleno
  a mano, después `NOT NULL` (lo que reconstruye la tabla).
- Al reconstruir tablas, lo que protege los datos es que el migrador corra
  dentro de una transacción (ahí SQLite ignora `PRAGMA foreign_keys=ON`). Las
  FK `ON DELETE CASCADE` no se aplican en el celular (no se activa el pragma).
- Tests de repos contra SQLite real en memoria:
  `lib/data/local/test-db.ts#createMigratedTestDb`.

## Problemas conocidos de entorno

- **`npx tsc --noEmit` falla con rutas que no existen o son absurdas**: el
  archivo `.expo/types/router.d.ts` quedó desactualizado o corrupto. Matar
  Metro, correr `npx expo start --clear` y recargar.
- **Expo Go se cierra al abrir sin pantalla roja**: correr `npx expo install
  --check` / `--fix` (versión de worklets/reanimated distinta a la nativa).
- `npx expo start` en segundo plano se lanza directo (sin `nohup ... &`).
- Pantalla con estado viejo tras mover archivos: recarga completa, no Fast
  Refresh.
- "Failed to run the query 'begin'": transacción huérfana de un Metro viejo.
  `force-stop` de Expo Go y relanzar.
- Expo Go en el emulador: `adb reverse` + `am start -a
  android.intent.action.VIEW -d "exp://localhost:8081"`.
- **Vitest: "failed to find the current suite" en todos los archivos a la
  vez** = la terminal quedó en `c:\...` (unidad en minúscula). Correr desde
  `C:/Users/...` (mayúscula); no es un error del código.
- `npm run lint` tiene un error preexistente en
  `hooks/use-color-scheme.web.ts`, no relacionado con nada reciente.
- En el `.env.local` de la web, cada `$` va escapado como `\$` (Next lo
  expande).

## Pendiente

- **Fase 10, sub-paso 15**, verificación end-to-end con dos celulares contra
  producción:
  1. Rana y Gato (en −5 por un bug ya corregido): desde el dueño, ajuste de
     `+10` a cada uno, sincronizar y confirmar que quedan en 5.
  2. Segundo vendedor; venta en modo avión que sincroniza al reconectar; venta
     que deja negativo el inventario del vendedor (debe aceptarse) y aparece
     la tarjeta roja en `/admin`; liquidación completa que sube el saldo de la
     cuenta elegida.
  3. La liquidación reenviada con "Reenviar sincronización": confirmar que
     "Efectivo" subió $55.000 en el servidor.
  - Diagnóstico: `ssh mivps`, y en la base `SELECT * FROM
    sync_applied_operations ORDER BY created_at DESC LIMIT 20`. Si la
    operación no aparece, el celular nunca la envió.
- **Falta verificar en el celular**: Categorías (rediseño), Reportes (rediseño), pantallas del
  vendedor, POS rediseñado, editar/crear producto, Productos/Inventario/
  Ajustar stock, Caja y Cuentas, transferencias entre cuentas (desplegar
  primero la web), importación de Excel, código de proveedor, sync reactiva
  (login trae datos sin tocar nada; cambio en la web aparece en ≤ 1 min),
  disparadores automáticos, subida de fotos y fotos remotas.
- Fase 9 sub-paso 4 (verificación manual de Reportes) quedó sin cerrar
  formalmente.
- Diferido a propósito: catálogo de productos por proveedor (mejoraría la
  importación de Excel), reordenar fotos, fotos huérfanas al salir sin
  guardar.
- **El servidor no tiene respaldos de Postgres** (sin `pg_dump` en cron ni
  nada en `/var/backups`), y ahora es la única copia de los datos.

## Comandos

```bash
npm install
npx expo start          # dev
npm run android         # emulador/dispositivo Android
npm run test            # Vitest
npx tsc --noEmit        # typecheck
npm run lint            # expo lint
npm run db:generate     # nueva migración drizzle-kit
```

## Convenciones

- Tipado estricto en todo el proyecto.
- Código y comentarios en inglés; docs y explicaciones al usuario en español.
- Imports con el alias `@/...`; navegación con `<Link href>` y `router.back()`.
- No meter dependencias pesadas en `lib/domain/`: debe seguir siendo pura.
- Al terminar una sesión, documentar aquí solo lo que cambia cómo se trabaja
  (reglas, contratos, pendientes). La bitácora detallada, si hace falta, va al
  final de `docs/historial.md`.
