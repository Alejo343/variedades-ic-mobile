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

**Fase 1 completa (10/10 sub-pasos).** Fases 2 (Caja y Ventas en local), 3 (Vendedores), 4 (Entregas a vendedores), 5 (Inventario por vendedor + Ventas de vendedor), 6 (Devoluciones y pérdidas de vendedor), 7 (Liquidaciones) y 8 (Compras a distribuidores + cuentas por pagar) también completas — ver sus respectivas secciones "Alcance — Fase N" más abajo. Fase 9 (Reportes consolidados) — la única fase de negocio que quedaba del roadmap — en construcción, ver su sección más abajo. Después de esa, solo queda sincronización remota.

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

Completada (sesión 2026-07-20). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que las Fases 1 y 2.

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema SQLite (`sellers`: `name`, `phone`, `city`, `commissionType`, `commissionValue`, `active`, `notes`) + migración drizzle-kit | ✅ listo |
| 2 | Dominio: portar `lib/domain/commission.ts#calculateCommission` + test desde el repo web | ✅ listo |
| 3 | Validaciones Zod (`sellerSchema`) | ✅ listo |
| 4 | `lib/data/sellers-repo.ts` (interfaz) + `lib/data/local/sellers-repo.ts` (CRUD, mismo patrón que `categories-repo.ts`) + wiring en `lib/data/index.ts` | ✅ listo |
| 5 | Pantallas: tab nuevo "Vendedores" — listado, crear, editar (mismo patrón que categorías de la Fase 1) | ✅ listo |
| 6 | Verificación end-to-end manual en el emulador (crear/editar/desactivar vendedor, comisión guardada correctamente) | ✅ listo |

**Fase 3 completa (6/6 sub-pasos).** Verificado con `npm run test` (31/31) + `npx tsc --noEmit` en verde (el error de `npm run lint` es preexistente en `use-color-scheme.web.ts`, del commit inicial, no relacionado con esta fase), más flujo manual en el emulador Android.

No se consume todavía en esta fase (las Fases 4-7 lo consumen) — solo
establece el catálogo de vendedores y su configuración de comisión, igual
que en el repo web.

**Notas de implementación:**

- Mismo patrón exacto que `categories-repo.ts`/`categories/*` de la Fase 1: interfaz `SellersRepo` en `lib/data/sellers-repo.ts`, implementación en `lib/data/local/sellers-repo.ts`, pantallas `app/sellers/{index,new,[id]}.tsx` con el mismo look (picker de tipo con dos botones, igual que el picker ingreso/gasto de `cash/new.tsx`).
- `commissionValue` para `commissionType: 'percentage'` se guarda en puntos base (ej. `1500` = 15%), igual que `commission.ts#calculateCommission` del repo web (divide entre `10000`). Las pantallas lo dejan explícito con un texto de ayuda ("ej. 1000 = 10%") y el listado lo muestra ya convertido (`commissionValue / 100`, con dos decimales).
- Tab nuevo "Vendedores" en `app-tabs.tsx` usa `<NativeTabs.Trigger.Icon md="groups" />` (Material Symbol), mismo criterio que los tabs de Caja/Ventas de la Fase 2 — sin ícono PNG propio.
- **Nota de tooling reconfirmada**: igual que en la Fase 2, agregar rutas nuevas (`app/sellers/*`) sin que Metro estuviera corriendo dejó `.expo/types/router.d.ts` desactualizado (`npx tsc --noEmit` fallaba con rutas `/sellers/*` no reconocidas por `expo-router`'s tipado). Se resolvió lanzando `npx expo start --clear` en segundo plano el tiempo suficiente para que regenerara el archivo de tipos, sin necesidad de abrir la app — confirma que el fix documentado en la Fase 2 es reproducible y no requiere tocar código.
- Verificado en vivo en el emulador Android (AVD "CelularBanco", boot en frío tomó ~13 minutos esta sesión — mucho más lento que en sesiones anteriores, sin causa aparente en el log del emulador más allá de warnings de OpenGL no fatales): crear vendedor "Maria Gomez" (teléfono, ciudad "Bogota", comisión `% por venta` con valor `1500`) → aparece en la lista como `15.00% por venta · Bogota`; editar → todos los campos precargados correctamente, cambiar ciudad a "Medellin" → el listado refleja el cambio; crear un segundo vendedor con `Fija por unidad` y valor `2000` → aparece como `$2000 por unidad`; desactivar "Maria Gomez" → aparece `· inactivo` en el listado. Confirma el CRUD completo contra SQLite local funcionando de punta a punta.
- **Cambio de flujo para pruebas manuales, a partir de esta sesión**: en vez de operar los taps en el emulador vía `adb shell input`/`uiautomator dump` directamente, el criterio ahora es darle al usuario una lista de pasos concretos (qué tocar, qué escribir, qué verificar) y que él la ejecute y reporte el resultado — decisión explícita del usuario tras que el driving por ADB mostrara fricción real (coordenadas que se corrían con el teclado abierto, aterrizando taps en el tab bar en vez del campo esperado). Sigue siendo válido usar ADB para pasos no interactivos (arrancar el emulador, esperar el boot, abrir Expo Go vía intent).

## Alcance — Fase 4: Entregas a vendedores

Completada (sesión 2026-07-20). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que las Fases 1-3.
Los datos actuales en la base local son de prueba (confirmado por el
usuario), así que esta sesión no exportó respaldo antes de la migración de
`inventory_movements` — a diferencia de lo que sugiere el roadmap para un
escenario con datos reales.

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema: `inventory_movements` gana `ownerType`/`sellerId`; tablas nuevas `seller_deliveries`/`seller_delivery_items` + migración drizzle-kit | ✅ listo |
| 2 | Validaciones Zod (`sellerDeliveryItemSchema`, `sellerDeliverySchema`) | ✅ listo |
| 3 | `lib/data/seller-deliveries-repo.ts` (interfaz) + `lib/data/local/seller-deliveries-repo.ts` (transacción fail-fast: descuenta principal + inserta fila `ownerType: 'seller'`) + wiring en `lib/data/index.ts` | ✅ listo |
| 4 | Pantallas: `sellers/deliveries/index` (listado) + `sellers/deliveries/new` (selector de vendedor + filas de producto/cantidad/costo, autocompletado con `purchasePrice`), anidadas en el stack de `sellers/_layout.tsx` | ✅ listo |
| 5 | Verificación end-to-end manual en el emulador (entrega descuenta el inventario principal y no toca `product.stock` del lado del vendedor — se confirma solo por el ledger, `getSellerInventory` llega en la Fase 5) | ✅ listo |

**Fase 4 completa (5/5 sub-pasos).** Verificado con `npm run test` (31/31) + `npx tsc --noEmit` en verde (mismo error preexistente de `npm run lint` en `use-color-scheme.web.ts`, no relacionado), más flujo manual en el emulador Android.

`MovementType` (`entrega_vendedor`) y `OwnerType` (`principal`/`seller`) del
dominio (`lib/domain/inventory-movement.ts`) ya existían desde la Fase 1 —
no requieren cambios en esta fase.

**Notas de implementación:**

- La tabla `sellers` se reordenó en `schema.ts` para quedar antes de `inventoryMovements` (ya que ahora la referencia vía `sellerId`), mismo criterio de "el referenciado va primero en el archivo" que ya seguían `categories`→`products`.
- `recordProductMovement` (helper de la Fase 2, en `local/inventory-repo.ts`) se reutilizó tal cual para el lado principal del movimiento — no necesitó cambios porque el default de `ownerType` en el schema (`'principal'`) y `sellerId` nulo ya son el comportamiento correcto para ese lado. El lado del vendedor (`ownerType: 'seller'`, `sellerId`, cantidad positiva, sin tocar `products.stock`) se inserta con un segundo `tx.insert(inventoryMovements)` directo dentro de `local/seller-deliveries-repo.ts#create` — mismo patrón de "dos filas en el mismo ledger dentro de una transacción" que describe el roadmap.
- Sin pantalla de inventario por vendedor todavía (`getSellerInventory` es Fase 5) — la única forma de confirmar la entrega en esta fase es ver el descuento del lado principal (`/products/[id]`, `/inventory`) y el registro en `/sellers/deliveries`.
- Rutas nuevas (`sellers/deliveries/index`, `sellers/deliveries/new`) anidadas en el stack existente de `sellers/_layout.tsx` en vez de un tab nuevo — evita saturar la tab bar (ya tiene 5 tabs) y sigue el mismo patrón que `products/categories/*` de la Fase 1.
- **Bug real encontrado y corregido durante la verificación manual**: `products/[id].tsx`, `products/categories/[id].tsx` y `sellers/[id].tsx` cargaban sus datos con `useEffect(..., [id])` — solo se ejecuta al montar. Como los tabs nativos mantienen cada stack vivo en segundo plano, si el usuario dejaba una de estas pantallas abierta, cambiaba de tab, modificaba ese mismo registro por otro camino (ej. una entrega a vendedor descontando el stock de un producto cuyo detalle seguía montado) y volvía, la pantalla seguía mostrando los valores con los que se había montado — no los actuales en SQLite. Las tres se cambiaron a `useFocusEffect` (con bandera `cancelled` para evitar `setState` tras desmontar), mismo patrón que ya usaban las pantallas de listado (`products/index.tsx`, `sellers/index.tsx`, etc.), así que ahora recargan cada vez que la pantalla vuelve a tener foco. Confirmado en vivo: reproducido el bug (detalle de producto abierto, entrega descontando su stock desde otra pantalla, stock mostrado seguía igual) y confirmado el fix (mismo flujo, stock ya actualizado al volver).
- Verificado en vivo en el emulador Android: entrega a "Maria Gomez" de 3 unidades de "Audifonos Bluetooth" (costo unitario autocompletado con `purchasePrice`) → aparece en `/sellers/deliveries` como "Maria Gomez · 3 unidades · [costo total] · [fecha]"; el stock del producto bajó exactamente en 3 (confirmado en `/products/[id]`) y quedó un movimiento `-3 · entrega_vendedor` en `/inventory`; segunda entrega con cantidad mayor al stock restante → error en pantalla, sin crear la entrega ni descontar nada (fail-fast confirmado). Confirma la transacción de dos filas en el mismo ledger funcionando de punta a punta.

## Alcance — Fase 5: Inventario por vendedor + Ventas de vendedor

Completada (sesión 2026-07-20). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que las Fases 1-4.

Una decisión de diseño no explícita en el roadmap original: `seller_sales`
**no** genera un movimiento en `cash_movements` (a diferencia de
`direct_sales` en la Fase 2) — el dinero de una venta de vendedor lo retiene
el vendedor hasta que liquide, y ese ingreso a caja ocurre recién en la
Fase 7 ("Al liquidar: genera un ingreso en `cash_movements`"). Tampoco se
agrega la columna `settlementId` a `seller_sales` todavía — `settlements`
no existe hasta la Fase 7, así que esa columna se agrega ahí vía migración
(mismo patrón que `ownerType`/`sellerId` se agregaron a
`inventory_movements` en la Fase 4, cuando `sellers` ya existía).

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema: `seller_sales`/`seller_sale_items` (sin `settlementId` todavía) + migración drizzle-kit | ✅ listo |
| 2 | Validaciones Zod (`sellerSaleItemSchema`, `sellerSaleSchema`) | ✅ listo |
| 3 | `local/inventory-repo.ts`: nuevo helper `recordSellerMovement` (ledger del vendedor, sin tocar `products.stock`) — reutilizado también para refactorizar el insert del lado del vendedor de la Fase 4; `SellersRepo#getInventory` (agregación derivada del ledger, sin tabla nueva) | ✅ listo |
| 4 | `lib/data/seller-sales-repo.ts` (interfaz) + `lib/data/local/seller-sales-repo.ts` (transacción fail-fast: valida y descuenta SOLO el inventario del vendedor, calcula comisión con `commission.ts#calculateCommission`) + wiring en `lib/data/index.ts` | ✅ listo |
| 5 | Pantallas: `sellers/[id].tsx` gana sección "Inventario actual" + botón "Registrar venta"; `sellers/sales/index` (listado) + `sellers/sales/new` (recibe `sellerId`, producto limitado al inventario del vendedor, muestra comisión estimada) | ✅ listo |
| 6 | Verificación end-to-end manual en el emulador (venta de vendedor descuenta solo su inventario, nunca el principal; comisión calculada correctamente; sin ingreso automático en caja) | ✅ listo |

**Fase 5 completa (6/6 sub-pasos).** Verificado con `npm run test` (31/31) + `npx tsc --noEmit` en verde (mismo error preexistente de `npm run lint` en `use-color-scheme.web.ts`, no relacionado), más flujo manual en el emulador Android.

**Notas de implementación:**

- `recordSellerMovement` (nuevo, en `local/inventory-repo.ts`) es el equivalente de `recordProductMovement` pero para el ledger del vendedor: valida contra `SUM(quantityDelta)` de sus propias filas (`ownerType='seller' AND sellerId=X AND productId=Y`) en vez de `products.stock`, usando el mismo `applyMovement` del dominio para el fail-fast ("Stock insuficiente"). Se aprovechó para refactorizar el insert directo que la Fase 4 hacía a mano en `seller-deliveries-repo.ts` — mismo comportamiento (un delta positivo con `applyMovement` siempre tiene éxito), código compartido.
- `SellersRepo#getInventory(sellerId)` agrega el ledger con `GROUP BY productId` + `SUM(quantityDelta)`, filtrando a cantidades `> 0` — sin tabla nueva, tal como especifica el roadmap ("derivar, no duplicar").
- `seller-sales-repo.ts#create` calcula la comisión con `commission.ts#calculateCommission` usando la cantidad total de unidades de la venta completa (no por línea) — coincide con la firma `(config, saleTotal, quantity)` del dominio, donde `quantity` solo importa para el tipo `fixed_per_unit`.
- A diferencia de `direct-sales-repo.ts` (Fase 2), **no** se inserta un movimiento en `cash_movements` — decisión de diseño documentada arriba: el dinero de una venta de vendedor se liquida en la Fase 7, no al momento de la venta.
- La pantalla `sellers/sales/new.tsx` restringe el buscador de productos al inventario propio del vendedor (`sellersRepo.getInventory` + join en memoria con `productsRepo.list()`, igual patrón que `inventory/index.tsx` resolviendo nombres) — no al catálogo completo como sí hace `sellers/deliveries/new.tsx`, ya que una venta de vendedor solo puede ser de lo que ese vendedor ya tiene consigo.
- `sellers/index.tsx` reorganizó su fila de acciones: `[Entregas] [Ventas]` como fila secundaria arriba de `[+ Nuevo vendedor]` (antes solo tenía `[Entregas] [+ Nuevo vendedor]` en una sola fila) — sin botón "+ Nueva venta" directo en `sellers/sales/index.tsx`, porque toda venta nace desde el detalle de un vendedor específico (`sellers/[id].tsx` → "Registrar venta", visible solo si tiene inventario).
- Verificado en vivo en el emulador Android: detalle de "Maria Gomez" mostró su inventario actual (el producto entregado en la Fase 4); "Registrar venta" limitó el buscador a ese inventario y mostró "disponible: N"; al registrar la venta, "Comisión estimada" se calculó correctamente antes de guardar y la venta apareció en `/sellers/sales`; confirmado que el stock principal (`/products/[id]`) y el saldo de caja (`/cash`) no cambiaron; el inventario del vendedor bajó exactamente en lo vendido; una segunda venta con cantidad mayor a lo disponible falló sin crear nada (fail-fast confirmado).

## Alcance — Fase 6: Devoluciones y pérdidas de vendedor

Completada (sesión 2026-07-20). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que las Fases 1-5.

`type` en `seller_losses` (`perdida`/`dano`/`robo`) va a nivel de cabecera
(todo el reporte de pérdida comparte un solo tipo), no por línea — mismo
criterio que `direct_sales`/`seller_deliveries`/`seller_sales`, donde los
atributos de la transacción viven en la cabecera y los items solo llevan
producto/cantidad. Los tres valores ya existen como `MovementType` del
dominio desde la Fase 1, igual que `devolucion`.

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema: `seller_returns`/`seller_return_items` (sin precio) + `seller_losses`/`seller_loss_items` (`type` en la cabecera, `unitCost` NOT NULL en los items) + migración drizzle-kit | ✅ listo |
| 2 | Validaciones Zod (`sellerReturnItemSchema`, `sellerReturnSchema`, `sellerLossItemSchema`, `sellerLossSchema`) | ✅ listo |
| 3 | `lib/data/seller-returns-repo.ts` (interfaz) + `lib/data/local/seller-returns-repo.ts` (transacción: descuenta del vendedor con `recordSellerMovement` + regresa al principal con `recordProductMovement`, dos filas del mismo ledger) + wiring | ✅ listo |
| 4 | `lib/data/seller-losses-repo.ts` (interfaz) + `lib/data/local/seller-losses-repo.ts` (transacción: descuenta SOLO del vendedor con `recordSellerMovement`, nunca el principal) + wiring | ✅ listo |
| 5 | Pantallas: `sellers/[id].tsx` gana botones "Registrar devolución"/"Registrar pérdida" (visibles solo con inventario); `sellers/returns/{index,new}` + `sellers/losses/{index,new}`, reutilizando el selector de producto limitado al inventario del vendedor de la Fase 5 | ✅ listo |
| 6 | Verificación end-to-end manual en el emulador (devolución descuenta al vendedor y regresa al principal; pérdida descuenta solo al vendedor y nunca toca el principal) | ✅ listo |

**Fase 6 completa (6/6 sub-pasos).** Verificado con `npm run test` (31/31) + `npx tsc --noEmit` en verde (mismo error preexistente de `npm run lint` en `use-color-scheme.web.ts`, no relacionado), más flujo manual en el emulador Android.

**Notas de implementación:**

- `seller-returns-repo.ts#create` combina los dos helpers existentes en la misma transacción: `recordSellerMovement` (descuenta al vendedor, `type: 'devolucion'`) + `recordProductMovement` (regresa al principal, mismo `type`) — sin helper nuevo, reutiliza tal cual lo construido en las Fases 4-5.
- `seller-losses-repo.ts#create` usa solo `recordSellerMovement` con `type: data.type` (`perdida`/`dano`/`robo`, ya existentes en `MovementType` del dominio desde la Fase 1) — nunca toca `products.stock`, el costo lo asume el vendedor.
- `sellers/returns/new.tsx` es igual a `sellers/sales/new.tsx` pero sin campo de precio (las filas del carrito solo llevan cantidad) — coincide con que `seller_return_items` no tiene columna de precio/costo.
- `sellers/losses/new.tsx` agrega un selector de tipo de tres botones (Pérdida/Daño/Robo) arriba del carrito, mismo patrón visual que el picker de tipo de comisión (Fase 3) y el de ingreso/gasto (Fase 2); el costo unitario se autocompleta con `purchasePrice`, igual que `sellers/deliveries/new.tsx`.
- `sellers/[id].tsx` ahora tiene tres acciones condicionadas a tener inventario: "Registrar venta" (fila completa) y, debajo, "Registrar devolución"/"Registrar pérdida" en una fila de dos columnas — se mantuvo "Registrar venta" como la acción principal (con más uso esperado) y las otras dos como secundarias.
- Verificado en vivo en el emulador Android: devolución de 1 unidad del inventario de "Maria Gomez" → aparece en `/sellers/returns`, su inventario bajó en 1 y el stock del producto en `/products/[id]` **subió** en 1 (confirma el regreso al principal); pérdida por "Daño" de otra unidad → aparece en `/sellers/losses` con el tipo y costo total, su inventario bajó en 1 y el stock principal **no cambió**; intentos de devolución/pérdida con cantidad mayor a lo disponible fallaron sin crear ni descontar nada (fail-fast confirmado en ambos flujos).

## Alcance — Fase 7: Liquidaciones

Completada (sesión 2026-07-20). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que las Fases 1-6.
`periodDate` se guarda como texto `'YYYY-MM-DD'` (sin hora) — SQLite no
tiene tipo `date` nativo como Postgres, y las comparaciones contra
`saleDate`/`lossDate` (que sí son timestamps completos) usan `DATE(...)`
para extraer solo la parte de fecha, igual que en el repo web.

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema: `settlements` (`UNIQUE(sellerId, periodDate)`) + agrega `settlementId` a `seller_sales` (ahora que `settlements` existe — columna diferida desde la Fase 5) + migración drizzle-kit | ✅ listo |
| 2 | Dominio: portar `settlement.ts#calculateSettlement` + `settlement-status.ts#canTransitionSettlement` + tests desde el repo web | ✅ listo |
| 3 | Validaciones Zod (`settlementSchema`: `sellerId` + `periodDate`) | ✅ listo |
| 4 | `lib/data/settlements-repo.ts` (interfaz: `list`, `preview`, `create`, `markSettled`) + `lib/data/local/settlements-repo.ts` (agrega ventas/comisión/pérdidas del período, crea la liquidación, marca las `seller_sales` incluidas con `settlementId`; al liquidar, transición vía `canTransitionSettlement` + ingreso en `cash_movements` si `amountDue > 0`, reutilizando `recordCashMovementTx` de la Fase 2) + wiring | ✅ listo |
| 5 | Pantallas: `sellers/[id].tsx` gana botón "Liquidar"; `sellers/settlements/{index,new,[id]}` (preview de totales antes de crear, marcar como liquidada desde el detalle) | ✅ listo |
| 6 | Verificación end-to-end manual en el emulador (liquidación agrega los totales correctos del período, genera el ingreso en caja al liquidar, y una segunda liquidación del mismo vendedor/período falla por el `UNIQUE`) | ✅ listo |

**Fase 7 completa (6/6 sub-pasos).** Verificado con `npm run test` (37/37) + `npx tsc --noEmit` en verde (mismo error preexistente de `npm run lint` en `use-color-scheme.web.ts`, no relacionado), más flujo manual en el emulador Android.

**Notas de implementación:**

- `settlements-repo.ts#aggregatePeriod` acepta `db` o `Tx` (mismo criterio que el repo web) para poder llamarse tanto desde `preview` (fuera de transacción, solo lectura) como desde `create` (dentro de la transacción que también inserta la liquidación) sin duplicar la consulta.
- La agregación de ventas usa `isNull(sellerSales.settlementId)` para no contar dos veces una venta ya incluida en una liquidación anterior — así una liquidación posterior del mismo vendedor en otra fecha no vuelve a sumar ventas ya liquidadas, aunque su `saleDate` cayera en el rango por error de captura.
- `create` valida explícitamente que no exista ya una liquidación para `(sellerId, periodDate)` antes de insertar (mensaje de error legible), en vez de depender solo de que el `UNIQUE` de SQLite lance una excepción críptica — mismo criterio que el repo web.
- `markSettled` es el único lugar de todo el proyecto que genera un `cash_movements` fuera de una venta directa (Fase 2) — cierra el arco que la Fase 5 dejó abierto a propósito (las ventas de vendedor no tocan caja al momento de venderse).
- Se corrigió un lint error real introducido en esta fase (no preexistente): `sellers/settlements/new.tsx` inicialmente llamaba `setPreview(null)` de forma síncrona dentro de un `useEffect` cuando la fecha no tenía el formato válido — el linter de React (`react-hooks/set-state-in-effect`) lo marca porque ese valor se puede derivar en el render sin necesidad de estado ni efecto. Se resolvió calculando `isValidPeriodDate` como variable derivada en el cuerpo del componente y condicionando el render y el efecto (que sí hace una consulta async legítima) en base a ella, en vez de sincronizar ese caso con `setState`.
- Verificado en vivo en el emulador Android: al abrir "Liquidar" para un vendedor con una venta y una pérdida registradas el mismo día, el preview mostró automáticamente los totales correctos (Ventas/Comisión/Pérdidas/A entregar); al crear la liquidación y marcarla como liquidada, el saldo de caja subió exactamente en el monto "A entregar" con un nuevo ingreso "Liquidación vendedor #N — [fecha]"; un segundo intento de liquidación para el mismo vendedor y fecha falló con el mensaje esperado sin crear nada.

## Alcance — Fase 8: Compras a distribuidores + cuentas por pagar

Completada (sesión 2026-07-20). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que las Fases 1-7.
Es la fase más grande del roadmap — se trocea más fino que las anteriores,
como ya anticipaba esa sección.

Cuatro decisiones que se apartan a propósito del schema/flujo exacto del
repo web (adaptando al mismo criterio ya usado en el resto del móvil, no
un port literal):

- `totalCost` de `purchase_orders` se calcula sumando los items al crear
  el pedido (un solo formulario tipo carrito, como `direct_sales`), no un
  campo que el usuario escribe a mano y luego agrega items por separado
  como hace la web.
- Sin columna `stockUpdated`: la transición de estado ya es suficiente
  guardia contra recibir un pedido dos veces (`recibido` es terminal en
  `canTransitionPurchaseOrder`, así que un segundo intento falla solo con
  eso) — una columna menos que sincronizar.
- `unitCost` vive solo en `purchase_order_items`, no se duplica en
  `inventory_movements` (que en el móvil no tiene columna `unitCost`, a
  diferencia de la web) — mismo criterio que `seller_delivery_items`/
  `seller_loss_items`, que ya guardan el costo a nivel de item.
- De `order-status.ts` del repo web solo se porta `PurchaseOrderStatus`/
  `canTransitionPurchaseOrder` — `SalesOrderStatus`/`canTransitionSalesOrder`
  se queda afuera porque el móvil no tiene `salesOrders` (pedidos por
  WhatsApp), decisión ya tomada en el pivote original (ver "Fase 9" más
  abajo).

`getAccountsPayableSummary` (agregación de saldo por distribuidor) se
difiere a la Fase 9 (Reportes consolidados) — esta fase solo necesita el
saldo derivado por pedido individual.

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema: `distributors` + `purchase_orders`/`purchase_order_items` + `purchase_payments` + migración drizzle-kit | ✅ listo |
| 2 | Dominio: portar `order-status.ts` (solo `PurchaseOrderStatus`/`canTransitionPurchaseOrder`) + test desde el repo web | ✅ listo |
| 3 | Validaciones Zod (`distributorSchema`, `purchaseOrderSchema` + items combinados para creación, `purchasePaymentSchema`) | ✅ listo |
| 4 | `lib/data/distributors-repo.ts` (interfaz + local, CRUD simple mismo patrón que `sellers-repo.ts`) + wiring | ✅ listo |
| 5 | `lib/data/purchase-orders-repo.ts` (interfaz: `list`, `getById`, `create`, `markInTransit`, `markReceived`, `cancel`) + `lib/data/local/purchase-orders-repo.ts` (creación transaccional con total calculado de los items; recepción transaccional que suma stock vía `recordProductMovement` con `type: 'compra'`, solo si `canTransitionPurchaseOrder` lo permite) + wiring | ✅ listo |
| 6 | `lib/data/purchase-payments-repo.ts` (interfaz: `listForOrder`, `getBalance`, `create`) + `lib/data/local/purchase-payments-repo.ts` (saldo derivado `totalCost - SUM(pagos)`, valida `purchaseType === 'credito'` y estado distinto de cancelado, fail-fast si el pago excede el saldo pendiente) + wiring | ✅ listo |
| 7 | Pantallas: tab nuevo "Compras" — `purchases/index` (listado + acceso a distribuidores), `purchases/distributors/{index,new,[id]}` (CRUD), `purchases/new` (selector de distribuidor + carrito de productos + tipo contado/crédito), `purchases/[id]` (detalle: items, estado, acciones de transición, saldo y pagos si es a crédito), `purchases/payments/new` | ✅ listo |
| 8 | Verificación end-to-end manual en el emulador (crear pedido → marcar en camino → recibir sube el stock; pedido a crédito con pagos parciales baja el saldo correctamente; pago mayor al saldo falla; cancelar un pedido pendiente) | ✅ listo |

**Fase 8 completa (8/8 sub-pasos).** Verificado con `npm run test` (44/44) + `npx tsc --noEmit` en verde (mismo error preexistente de `npm run lint` en `use-color-scheme.web.ts`, no relacionado), más flujo manual en el emulador Android.

**Notas de implementación:**

- Nuevo 6º tab "Compras" (`md="local_shipping"`) en `app-tabs.tsx` — a diferencia de Liquidaciones (que quedó anidado dentro de Vendedores), Compras es un flujo de uso frecuente y recurrente, no una acción ocasional por vendedor, así que ameritaba su propio tab.
- `purchase-orders-repo.ts#create` sigue el mismo patrón transaccional que `direct-sales-repo.ts`/`seller-deliveries-repo.ts`: inserta la cabecera, recorre los items sumando `totalCost`, y actualiza la cabecera al final con el total ya calculado.
- `markReceived` es el único lugar de la Fase 8 que toca `products.stock` (vía `recordProductMovement` con `type: 'compra'`, ya existente desde la Fase 1) — `markInTransit` y `cancel` solo cambian `status`, ambos protegidos por la misma función `requireTransition` (envuelve `canTransitionPurchaseOrder` con un error legible) para no duplicar la validación en cada método.
- Se confirmó en la práctica la decisión de omitir `stockUpdated`: como `recibido` es un estado terminal en `canTransitionPurchaseOrder`, un segundo intento de `markReceived` sobre un pedido ya recibido falla en `requireTransition` antes de tocar el inventario — no hubo necesidad de la columna extra que sí tiene la web.
- `purchase-payments-repo.ts#create` valida `purchaseType === 'credito'`, `status !== 'cancelado'` y `amount <= pending` con un `throw` directo (mensaje propio "Saldo insuficiente: hay X pendiente...") en vez de reutilizar `deductStock` del dominio como hace la web — `deductStock` es para inventario y su mensaje de error ("Stock insuficiente") no encajaba para un saldo monetario.
- **Bug de tooling reconfirmado (mismo de la Fase 2)**: agregar de una sola vez todas las rutas nuevas de `app/purchases/**` con Metro corriendo desde hacía rato dejó `.expo/types/router.d.ts` en un estado corrupto — no solo desactualizado, sino con entradas sin sentido (rutas apuntando a archivos de `lib/data/*.ts` que no son pantallas). `npx tsc --noEmit` fallaba con errores de tipos de ruta ininteligibles. Se resolvió igual que antes: matar el proceso de Metro y relanzar con `npx expo start --clear`, esperar a que regenerara el archivo desde cero, y recargar la app — confirma que el fix ya documentado sigue siendo válido incluso cuando la corrupción es más severa que un simple desfase.
- Verificado en vivo en el emulador Android: pedido de contado a un distribuidor de prueba → "Marcar en camino" → "Marcar recibido" subió el stock del producto exactamente en la cantidad pedida; pedido a crédito de $100.000 → pago parcial de $40.000 dejó "Pendiente: $60.000"; intento de pago de $200.000 (mayor al pendiente) falló con el mensaje de saldo insuficiente sin registrar nada; un tercer pedido cancelado desde "pendiente" pasó a "cancelado" sin más acciones disponibles.

## Alcance — Fase 9: Reportes consolidados

En construcción (sesión 2026-07-20). Diseño de alcance en "Roadmap — Fases
2-9" más abajo; troceo en sub-pasos aquí, mismo criterio que las Fases 1-8.
Sin tabla nueva — todo se deriva por agregación sobre lo ya construido,
mismo criterio "derivar, no duplicar" de siempre. A diferencia del repo web
(que tiene `salesOrders` de WhatsApp como tercer canal), el móvil solo une
`direct_sales` + `seller_sales` para "Ventas"/"Utilidad".

Antes de trocear se le preguntó al usuario dónde ubicar la pantalla nueva
en la navegación (7º tab dedicado vs. anidado sin tab propio, dado que la
tab bar ya tenía 6 iconos tras la Fase 8) — eligió el 7º tab. **Esa
decisión resultó inviable por una restricción real de la plataforma, no
de diseño**: `BottomNavigationView` de Android (lo que usa `NativeTabs` por
debajo) soporta un máximo de 6 ítems — un 7º tab crashea la app en el
momento de montar (`[RNScreens] Attempt to insert TabsScreen at index 6;
BottomNavigationView supports at most 6 items`), no es negociable con
config. Se le devolvió la pregunta al usuario con esa limitación explicada
y eligió anidar Reportes dentro del stack de Caja (`/cash/reports`,
accesible con un botón "Ver reportes" junto a "+ Registrar movimiento") —
Caja ya es la pantalla más parecida a un panel financiero.

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Extender repos existentes con agregaciones de solo lectura: `sellersRepo.getAllInventory`, `sellerSalesRepo.getSummaryBySeller`, `sellerReturnsRepo.getReturnedProductsSummary`, `purchasePaymentsRepo.getAccountsPayableSummary` | ✅ listo |
| 2 | `lib/data/reports-repo.ts` (interfaz) + `lib/data/local/reports-repo.ts` (`getInventorySummary`, `getPurchasesReport`, `getSalesReport`, `getProfitReport`) + wiring en `lib/data/index.ts` | ✅ listo |
| 3 | Pantalla: `cash/reports.tsx` (anidada en el stack de Caja, no un tab propio — ver nota de la limitación de 6 tabs arriba), filtro de fecha opcional (`from`/`to`, texto `YYYY-MM-DD`) + una tarjeta por reporte; botón "Ver reportes" en `cash/index.tsx` | ✅ listo |
| 4 | Verificación end-to-end manual en el emulador (los totales de cada reporte coinciden con los datos ya acumulados en fases anteriores; el filtro de fecha solo afecta Compras/Ventas/Utilidad/Caja del período, el resto de reportes se mantiene igual) | ⏳ pendiente |

**Notas de implementación (sub-pasos 1-3):**

- **Decisión de negocio heredada del repo web sin volver a preguntarla**: la
  fórmula de "Utilidad" usa el mismo criterio de **utilidad bruta** que el
  repo web adoptó en su propia Fase 9 (`ventas − cantidad × products.purchasePrice`,
  sumado sobre las dos fuentes de venta) — no resta comisión de vendedor ni
  gastos de caja sueltos. Ya era una decisión de negocio explícita y
  documentada con su razonamiento en el `CLAUDE.md` del repo hermano, así
  que se replica tal cual en vez de volver a interrumpir al usuario por
  algo ya resuelto. Misma limitación conocida heredada: el costo usado es
  el `purchasePrice` *actual* del producto, no un snapshot histórico al
  momento de cada venta (ese snapshot no existe en `direct_sale_items`/
  `seller_sale_items`, solo `purchase_order_items` guarda `unitCost`).
- **Distinción "estado" vs "flujo"**, mismo criterio que el repo web: el
  filtro de fecha solo afecta a los reportes de flujo (Compras, Ventas,
  Utilidad, Caja del período). Los de estado (Inventario actual, Stock
  mínimo, Agotados, Cuentas por pagar, saldo de Caja, Inventario por
  vendedor) siempre muestran el momento actual. Ventas por vendedor y
  Productos devueltos quedaron sin filtro de fecha (histórico completo) por
  la misma razón que en la web: no amerita la complejidad de conectar
  `seller_sales`/`seller_return_items` al rango en la primera versión.
- Las nuevas funciones de agregación se repartieron entre extender los
  repos de dominio ya existentes (`sellersRepo`, `sellerSalesRepo`,
  `sellerReturnsRepo`, `purchasePaymentsRepo` ganan un método de resumen
  cada uno) y un `reports-repo.ts` nuevo solo para lo que cruza varias
  tablas sin dueño natural (inventario general, compras, ventas, utilidad)
  — mismo criterio "un archivo por dominio de query" que el repo web usó en
  su propia Fase 9.
  `sellersRepo.getAllInventory()` agrupa el ledger completo (`ownerType='seller'`)
  por `sellerId`+`productId` en una sola consulta en vez de N llamadas a
  `getInventory` (una por vendedor) — mismo motivo N+1 que ya evitaba
  `getAllSellersInventory` en el repo web.
- `reports-repo.ts#getProfitReport` reutiliza `localReportsRepo.getSalesReport`
  desde dentro del mismo objeto literal (auto-referencia diferida a tiempo
  de ejecución, no de inicialización) en vez de duplicar el cálculo de
  ingresos — funciona porque la llamada ocurre dentro del cuerpo de una
  función async, no en el momento en que se construye el objeto.
- `getInventorySummary` se escribió con un `WHERE active = 1` normal en vez
  de `COUNT(*) FILTER (WHERE ...)` (que sí usa el repo web sobre Postgres)
  — más simple y sin depender de que el SQLite embebido en `expo-sqlite`
  soporte la cláusula `FILTER` en agregados.
- Los nombres de producto/vendedor/distribuidor se resuelven en memoria en
  la pantalla (`productsRepo.list()`/`sellersRepo.list()`/`distributorsRepo.list()`
  cargados una vez y unidos con los reportes vía `Record<number, string>`)
  — mismo patrón ya usado en `inventory/index.tsx`, `purchases/index.tsx`,
  etc., en vez de que cada repo de reporte devuelva el nombre ya unido.
- Caja es el único reporte que combina "estado" (`cashRepo.getBalance()`,
  siempre el saldo actual) con "flujo" (ingresos/gastos del período,
  filtrados en memoria sobre `cashRepo.list()` ya traída) — mismo criterio
  que el repo web ("volumen bajo, no amerita una query nueva").
- Sin test nuevo en `lib/domain/*` — Fase 9 no agrega lógica de dominio
  pura, solo agregaciones SQL de solo lectura en `lib/data/*`, igual que el
  repo web tampoco tiene tests para su propio `reports.ts`.

**Pendiente para continuar la próxima sesión (o al retomar esta)**: sub-paso
4, verificación manual en el emulador — dar al usuario el checklist de
pasos concretos (mismo criterio ya vigente desde la Fase 3, ver feedback
guardado en memoria) y esperar su confirmación antes de marcar la fase
completa.

## Rediseño de navegación: de 6 tabs planos a 4 tabs (Inicio / Buscar / Vender / Más)

Completado (sesión 2026-07-27). No es una fase de negocio nueva —
reorganiza la navegación ya construida por las Fases 1-9, sin agregar
lógica de dominio ni tocar `lib/domain`/`lib/data` (salvo lectura vía
`.list()` ya existente). Motivo: la barra de tabs nativos ya había llegado
al límite real de `BottomNavigationView` en Android (máx. 6 ítems,
confirmado por el crash documentado en la Fase 9 al intentar un 7º tab), y
la organización por módulo de datos (Productos/Inventario/Caja/Ventas/
Vendedores/Compras) no reflejaba la frecuencia de uso real del negocio.

Diseño acordado con el usuario: **Inicio** (accesos rápidos, contenido del
dashboard diferido a una sesión futura), **Buscar** (búsqueda universal:
productos, vendedores, distribuidores, ventas y compras desde un solo
lugar), **Vender** (abre el POS de venta en local directo, sin pantallas
intermedias — la acción más frecuente del negocio; las ventas de
consignación siguen registrándose desde el detalle del vendedor, flujo sin
cambios) y **Más**, que el usuario pidió explícitamente tratar como un
pequeño módulo contenedor (no un menú plano) con su propia jerarquía
interna: Reportes, Caja, Compras, Vendedores, Inventario, Categorías,
Respaldo y Configuración (placeholder nuevo, "Próximamente").

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Mover `products/inventory/cash/sellers/purchases` bajo `src/app/more/` (sin tocar su lógica interna) y anteponer `/more` a sus `~25` `<Link href>` internos | ✅ listo |
| 2 | Extraer `cash/reports.tsx` → `more/reports.tsx` y `inventory/backup.tsx` → `more/backup.tsx` como archivos de primer nivel dentro de `more/` (no anidados en `cash`/`inventory`) | ✅ listo |
| 3 | Renombrar `direct-sales/` → `sell/`, intercambiando roles: el POS (antes `new.tsx`) pasa a ser `index.tsx` (raíz del tab); el listado (antes `index.tsx`) pasa a ser `history.tsx` | ✅ listo |
| 4 | Nuevo tab "Inicio" (`src/app/home/`) — acceso rápido a Productos | ✅ listo |
| 5 | Nuevo tab "Buscar" (`src/app/search/`) — búsqueda universal en memoria sobre 6 repos | ✅ listo |
| 6 | Nuevo `more/_layout.tsx` + `more/index.tsx` (menú de 8 accesos) + `more/settings.tsx` (placeholder) | ✅ listo |
| 7 | Actualizar `app-tabs.tsx`/`app-tabs.web.tsx` a los 4 tabs nuevos (la versión web ya estaba desactualizada — le faltaban Vendedores/Compras — se corrigió a la vez) | ✅ listo |
| 8 | Verificación end-to-end manual en el emulador (Inicio, Buscar contra las 6 categorías, Vender sin pantalla intermedia, Más con sus 8 accesos) | ✅ listo |

**Fase completa (8/8 sub-pasos).** Verificado con `npm run test` (44/44) +
`npx tsc --noEmit` en verde + `npm run lint` (mismo error preexistente de
`use-color-scheme.web.ts`, no relacionado), más flujo manual en el
emulador Android.

**Notas de implementación:**

- Investigación técnica previa al troceo (leyendo
  `node_modules/expo-router/build/native-tabs/types.d.ts`): `NativeTabs`
  no soporta "tab oculto pero navegable" — la prop `hidden` de
  `NativeTabs.Trigger` dice explícitamente *"cannot be navigated to in any
  way"*. La única forma de sacar una sección de la tab bar sin perder la
  capacidad de navegar a ella es que deje de ser una carpeta de primer
  nivel bajo `src/app/` y pase a vivir anidada dentro de la carpeta de
  otro tab — mismo patrón que ya usaba este proyecto para Reportes
  (anidado dentro de `cash/`, Fase 9), aplicado ahora a escala completa.
- Todos los imports del proyecto usan el alias `@/...` (nunca rutas
  relativas profundas), así que mover/renombrar carpetas no rompió ningún
  import — sólo las rutas de navegación (`<Link href="...">`), todas
  actualizadas a mano archivo por archivo tras un inventario exhaustivo
  (sin `router.push`/`router.replace`/`useSegments`/`usePathname` en todo
  el proyecto, sólo `<Link href>` y `router.back()`, este último ajeno al
  prefijo por ser navegación relativa).
- `more/_layout.tsx` anida un `Stack` dentro de otro: cada carpeta movida
  (`products`, `inventory`, `cash`, `sellers`, `purchases`) conserva su
  propio `_layout.tsx` sin cambios de contenido, y `more/_layout.tsx` sólo
  declara esas cinco entradas con `headerShown: false` (el header real lo
  pone el `_layout.tsx` interno de cada una) más `reports`/`backup`/
  `settings` como pantallas únicas con su propio título.
- `sell/index.tsx` (antes `direct-sales/new.tsx`) cambió un comportamiento
  real, no sólo de ubicación: al ser ahora la raíz del stack del tab, ya
  no hay a dónde volver con `router.back()` tras guardar la venta — se
  reemplazó por limpiar el estado local (`cart`, `notes`, `search`),
  dejando el POS listo para la siguiente venta sin salir de la pantalla.
  Gana además un enlace "Ver historial de ventas" hacia `/sell/history`
  para no perder el acceso al listado de ventas pasadas (que perdió su
  botón "+ Nueva venta", ya innecesario).
- `search/index.tsx` no agrega ningún método `search()` nuevo a los repos
  (ninguno existe hoy — todos sólo tienen `list()`); reutiliza el mismo
  patrón ya usado en `inventory/index.tsx`/`purchases/index.tsx` de cargar
  listas completas (`productsRepo`, `sellersRepo`, `distributorsRepo`,
  `directSalesRepo`, `sellerSalesRepo`, `purchaseOrdersRepo`, las seis en
  paralelo) y filtrar/resolver en memoria — razonable a esta escala
  (comercio pequeño). Ventas en local y de vendedor no tienen pantalla de
  detalle propia hoy, así que sus resultados navegan al listado
  correspondiente (`/sell/history`, `/more/sellers/sales`) en vez de a un
  registro específico; compras sí tiene detalle propio (`purchases/[id]`)
  y navega directo a él.
- **Bug real encontrado y corregido durante la verificación manual (de
  entorno, no de lógica)**: tras mover/renombrar tantos archivos, Fast
  Refresh dejó una instancia vieja de la pantalla de Vender con el estado
  de productos vacío (el buscador de productos del POS no mostraba
  resultados) — un recargo completo de la app (no Fast Refresh) lo
  resolvió; el código en sí no tenía ningún cambio de lógica en esa parte
  respecto al `direct-sales/new.tsx` ya verificado en la Fase 2.
- Verificado en vivo en el emulador Android: los 4 tabs aparecen
  correctamente; Inicio navega a Productos; Buscar encuentra coincidencias
  en las seis categorías y cada una navega a donde corresponde; Vender
  abre el POS directo (no una lista), cobrar una venta limpia el carrito
  sin sacar de la pantalla, y "Ver historial de ventas" muestra las ventas
  pasadas incluida la recién creada; Más navega correctamente a sus 8
  secciones y cada una conserva su funcionalidad previa.

## Métodos de pago (`paymentMethod`) — superseded, ver "Cuentas de caja"

Construida en la primera mitad de la sesión 2026-07-28: un campo
`paymentMethod` (`efectivo`/`transferencia`, texto libre sin cuenta real
detrás) en `direct_sales` y `cash_movements`. **Duró poco** — al preguntarle
al usuario cómo quería seguir usándolo, pidió llevarlo a un modelo de
cuentas reales con saldo propio en la misma sesión. La columna
`payment_method` ya no existe (se eliminó en la migración
`drizzle/0011_conscious_magik.sql`); todo lo que decía este apartado sobre
`paymentMethodSchema`/`PaymentMethod`/`localByPaymentMethod`/
`cashPeriodByMethod` fue reemplazado por lo descrito en "Cuentas de caja"
justo abajo. Se deja esta nota corta en vez de borrar la sección completa,
como registro de que se pasó por ahí antes de llegar al diseño final.

## Cuentas de caja (`cash_accounts`)

Completada (sesión 2026-07-28, segunda mitad — reemplaza "Métodos de pago"
de arriba). El usuario pidió explícitamente comparar contra este modelo:

```
Cuenta { id, nombre, tipo, saldo (calculado) }
Movimiento { cuenta_id, tipo, monto, fecha, origen }
```

y decidir si se podía mejorar antes de construirlo. Se detectó un hueco
real durante el diseño (no de esta sesión, preexistente desde la Fase 8):
`purchase_payments` (pagos a distribuidores) **nunca generaba un
`cash_movements`** — pagarle a un distribuidor no descontaba ningún saldo.
Se le presentó al usuario como parte del alcance a decidir, junto con si
las cuentas son un catálogo fijo o editable, si liquidar a un vendedor
pide elegir cuenta, y si se agregaba ya transferencias entre cuentas.
Decisiones tomadas: **corregir el hueco de `purchase_payments` ahora**,
**catálogo de cuentas editable** (CRUD, no fijo), **el usuario elige la
cuenta al liquidar**, y **transferencias entre cuentas diferidas** (no
construidas esta sesión — pendiente si se necesitan más adelante). Los
datos existentes en el dispositivo eran de prueba (confirmado con el
usuario), así que el backfill de la migración usa un mapeo simple sin
preocuparse por preservar cada valor exacto de texto libre.

- Schema: tabla nueva `cash_accounts` (`name`, `type`: `efectivo`|`banco`,
  `active`, `notes` — mismas columnas reservadas `updatedAt`/`syncStatus`
  que el resto del proyecto). `cash_movements.account_id`,
  `direct_sales.account_id` y `purchase_payments.account_id` — los tres
  `NOT NULL REFERENCES cash_accounts(id)`, porque las cuatro fuentes que
  escriben en ellas (movimiento manual, venta en local, pago a
  distribuidor, liquidación de vendedor) ahora siempre exigen elegir una
  cuenta — a diferencia del `paymentMethod` anterior, que era nullable en
  `cash_movements` porque algunas fuentes no tenían uno.
- **Migración en tres pasos** (`drizzle/0009_bizarre_randall_flagg.sql` →
  `0010_early_hawkeye.sql` → `0011_conscious_magik.sql`), deliberadamente
  separada así para que `drizzle-kit generate` nunca viera "una columna
  agregada + una quitada" en la misma tabla en la misma corrida — esa
  combinación dispara un prompt interactivo de "¿es un rename?" que no
  tiene forma de responderse en un entorno no interactivo (sin TTY). Orden:
  (1) crear `cash_accounts` + sembrar a mano las dos cuentas iniciales
  (`id=1` "Efectivo", `id=2` "Transferencia", INSERT agregado a mano al
  archivo generado); (2) agregar `account_id` nullable a las tres tablas +
  backfill a mano agregado al final del mismo archivo (mapea
  `payment_method`/`method` existentes a `account_id`, todo lo demás —
  incluyendo cualquier texto libre en `purchase_payments.method` que no
  fuera exactamente "transferencia" — cae a la cuenta 1 "Efectivo"); (3)
  quitar `payment_method`/`method` y marcar `account_id` `NOT NULL` (SQLite
  reconstruye la tabla internamente para esto, generado limpio por
  `drizzle-kit` sin edición a mano). Este patrón de tres pasos queda como
  referencia para la próxima vez que una migración necesite dropear una
  columna y agregar otra en la misma tabla.
- `lib/data/cash-accounts-repo.ts` (interfaz) + `local/cash-accounts-repo.ts`
  — CRUD igual que `sellers-repo.ts`/`distributors-repo.ts`, más
  `listWithBalances()` (agregación derivada sobre `cash_movements` agrupada
  por `accountId`, mismo criterio "derivar, no duplicar" que el resto del
  proyecto — el saldo nunca se guarda).
- **Corrección del hueco de `purchase_payments`**:
  `local/purchase-payments-repo.ts#create` ahora llama a
  `recordCashMovementTx` (reutilizado de `cash-repo.ts`, Fase 2) dentro de
  la misma transacción, generando un `gasto` en la cuenta elegida — antes
  de esta sesión, pagar a un distribuidor no dejaba ningún rastro en
  `cash_movements`.
- `settlements-repo.ts#markSettled` cambia de firma: ahora recibe
  `(id, accountId)` — la pantalla `sellers/settlements/[id].tsx` agrega un
  picker de cuenta (mismo patrón visual de dos/tres botones) antes de
  habilitar "Marcar como liquidada".
- Pantallas CRUD nuevas: `more/cash/accounts/{index,new,[id]}.tsx`
  (mismo patrón que vendedores/distribuidores), accesibles desde un botón
  "Gestionar cuentas" en `more/cash/index.tsx`. El picker fijo de dos
  botones "Efectivo"/"Transferencia" en `sell/index.tsx`,
  `more/cash/new.tsx` y `more/purchases/payments/new.tsx` se reemplazó por
  un mapeo dinámico sobre las cuentas activas (`cashAccountsRepo.list()`),
  ya no hay una lista fija de dos en el código.
- Reportes (`more/reports.tsx`): la tarjeta "Ventas" desglosa por cuenta
  (dinámico, vía `reportsRepo.getSalesReport().localByAccount`, solo ventas
  en local); la tarjeta "Caja" desglosa ingresos/gastos del período por
  cuenta (calculado en memoria, igual que antes); tarjeta nueva "Cuentas"
  muestra el saldo actual de cada una (`cashAccountsRepo.listWithBalances()`).
- Verificado con `npm run test` (44/44) + `npx tsc --noEmit` en verde
  (incluyendo la regeneración de `.expo/types/router.d.ts` para las rutas
  nuevas de `more/cash/accounts/*`, mismo fix de tooling ya documentado en
  fases anteriores) + `npm run lint` (mismo error preexistente de
  `use-color-scheme.web.ts`, no relacionado). **Verificado en vivo en el
  celular del usuario** (no en el emulador esta vez): CRUD de cuentas
  (crear, editar, desactivar) funcionando; venta en local y movimiento
  manual de caja cada uno reflejando la cuenta elegida en su listado; pago
  a distribuidor descontando correctamente el saldo de la cuenta elegida
  (confirma la corrección del hueco de `purchase_payments`); liquidación
  de vendedor pidiendo cuenta y subiendo su saldo en el monto "A entregar";
  Reportes mostrando el desglose por cuenta en las tarjetas "Ventas",
  "Cuentas" y "Caja". Todo confirmado sin fallos por el usuario.

## Preferencia de tema (claro/oscuro/sistema)

Completada (sesión 2026-07-30). Antes de esta sesión la app seguía siempre
el modo claro/oscuro del sistema operativo (`useColorScheme` de React
Native, sin override posible) — el usuario pidió poder fijar el tema desde
la app, con **claro como predeterminado** aunque el teléfono esté en modo
oscuro.

- `lib/theme-preference.ts`: store módulo (`getSnapshot`/`subscribe`/
  `setPreference`, patrón para `useSyncExternalStore`) que persiste la
  preferencia (`'light'|'dark'|'system'`) vía `expo-sqlite/kv-store`
  (`Storage.getItemSync`/`setItemSync` — un key-value store SQLite
  aparte, no la base de datos de Drizzle) — sobrevive a reinicios sin
  tabla ni migración nueva. Default `'light'` si no hay nada guardado.
- `hooks/use-app-color-scheme.ts`: `useAppColorScheme()` (resuelve
  `'light'|'dark'` combinando la preferencia con `useColorScheme()` del
  sistema solo cuando la preferencia es `'system'`) + `useThemePreference()`
  (para la pantalla de ajustes). `use-theme.ts`, `app-tabs.tsx` y
  `app/_layout.tsx` (el `ThemeProvider` de `expo-router` y el color de los
  tabs nativos) se migraron de `useColorScheme` crudo a este hook — es el
  único punto de verdad de qué tema se está mostrando.
- `more/settings.tsx` (antes placeholder "Próximamente"): picker de tres
  botones Claro/Oscuro/Sistema, mismo patrón visual que el resto de la app.
- Verificado con `npm run test` (44/44) + `npx tsc --noEmit` en verde +
  `npm run lint` (mismo error preexistente de `use-color-scheme.web.ts`).

## Identidad visual — fundaciones + panel de Inicio

En construcción (sesión 2026-07-30, continúa la misma sesión que la
preferencia de tema de arriba). El usuario definió una identidad visual
completa desde cero ("el tablero del negocio": rapidez, confianza,
claridad, cercanía — ver la conversación de esa sesión para el brief
completo con paleta, tipografía, grid, radios, sombras y mockups ASCII de
cada componente) y pidió construirla. Dado el tamaño real del brief
(paleta + tipografía + grid + iconografía + rediseño de Inicio con seis
secciones nuevas), esta sesión trocea así: **fundaciones del design
system + la pantalla de Inicio como implementación de referencia**, dejando
el rollout al resto de pantallas (Productos, Inventario, Caja, Vendedores,
Compras, Reportes) como trabajo pendiente explícito, no asumido.

- `constants/theme.ts`: paleta reconstruida sobre los mismos 5 tokens que
  ya consumía toda la app (`text`, `background`, `backgroundElement`,
  `backgroundSelected`, `textSecondary`) — se les cambió el valor, no el
  nombre, así que las ~40 pantallas existentes heredan la nueva paleta
  sin tocarlas. Se agregaron tokens nuevos (`primary`, `primaryHover`,
  `primaryLight`, `border`, `error`, `warning`, `info`, `success`,
  `purple`) para las pantallas nuevas. `withAlpha(hex, alpha)` (helper
  nuevo) genera los fondos suaves de alerta (8% de opacidad) pedidos en
  el brief sin tener que mantener variantes hex separadas por tema. Modo
  oscuro: paleta derivada a mano (el brief solo daba colores claros) —
  fondos/superficies en escala slate, y el verde primario pasa a `#22C55E`
  (más claro que el `#16A34A` del modo claro) por legibilidad sobre fondo
  oscuro; queda documentado aquí como decisión propia, no pedida
  explícitamente.
- Grid de 8px ya lo seguía `Spacing` desde la Fase 1; se agregaron
  `Layout` (`screenPadding: 20`, `cardGap: 16` — los dos valores que el
  grid de 8px no cubre exacto) y `Radii` (`card: 16`, `button: 18`,
  `buttonPrimary: 24`, `chip: 999`) y `Shadow.subtle` tal cual el spec.
- Tipografía: **Inter** (`@expo-google-fonts/inter`, pesos Regular/Medium/
  SemiBold/Bold) cargada con `useFonts` en `app/_layout.tsx`, gateado
  junto con las migraciones de la base de datos antes de ocultar el splash
  (si la carga de fuentes falla, se sigue con la fuente del sistema en vez
  de bloquear la app para siempre). `components/themed-text.tsx` mapea
  cada `type` a un `fontFamily` de Inter en vez de `fontWeight` (las
  fuentes de Google Fonts vienen como archivos discretos por peso, no
  variables — RN/Android no sintetiza negrita de forma confiable sobre una
  fuente custom vía `fontWeight` solo) — esto retina automáticamente las
  ~40 pantallas existentes a Inter sin tocarlas. Se agregaron los tipos
  nuevos de la escala del brief (`greeting` 30/SemiBold, `sectionTitle`
  20/Bold, `bigNumber` 42/Bold con `tabular-nums`, `cardTitle` 18/SemiBold,
  `secondary` 14/Regular, `caption` 12/Medium) sin tocar los tipos
  existentes (`default`/`small`/`link`/etc.), para no arriesgar el layout
  de pantallas no revisadas esta sesión.
- **Limitación real de plataforma encontrada** (mismo tipo de hallazgo que
  el límite de 6 tabs de Android en la Fase 9): el brief pide iconografía
  Lucide en toda la app, incluida la barra inferior. `NativeTabs` (Android/
  iOS nativos) solo acepta iconos de fuente de sistema (`md=`/`sf=`) o,
  para librerías de iconos vectoriales, componentes de `@expo/vector-icons`
  con un método estático `getImageSource()` que las rasteriza a imagen —
  Lucide son componentes SVG puros (`react-native-svg`) sin ese método, así
  que no se pueden usar directo ahí. Decisión (sin bloquear para
  preguntarle al usuario, mismo criterio que el límite de tabs): **Lucide
  en toda la interfaz normal** (tarjetas, botones, alertas, timeline) y **se
  mantienen los Material Symbols nativos solo en la barra de tabs**,
  retinados con los colores nuevos (`iconColor`/`tintColor`/`labelStyle` =
  verde primario activo, gris secundario inactivo, `disableIndicator` para
  quitar el "pill" de fondo detrás del ícono seleccionado — el "sin fondos,
  solo el activo en verde" del brief).
- Nuevas dependencias: `@expo-google-fonts/inter`, `lucide-react-native`,
  `react-native-svg` (peer de Lucide).
- **Pantalla de Inicio** (`app/home/index.tsx`, antes un stub con un solo
  link a Productos) es la primera implementación completa del sistema:
  saludo (según hora del día) + tarjeta de ingresos de hoy (`bigNumber`,
  filtra `cash_movements` tipo ingreso por fecha **local** del dispositivo,
  no UTC — ver `lib/format.ts#todayLocalDateString`, SQLite guarda
  `CURRENT_TIMESTAMP` en UTC sin marca de zona) + botón "VENTA RÁPIDA"
  (`components/primary-action-button.tsx`, ~90px, verde sólido, pulso
  sutil una sola vez al montar vía Reanimated, no en loop) + grid de 4
  acciones rápidas + alertas en bloques suaves (agotados/stock bajo/por
  pagar a distribuidores, ocultas si no hay ninguna) + timeline de
  actividad reciente (une ventas en local, ventas de vendedor, compras
  recibidas, ajustes de inventario y liquidaciones — las cinco fuentes que
  ya existían, sin repo nuevo, solo unidas y ordenadas en memoria) +
  "Productos favoritos" (sin tracking de favoritos real: proxy derivado de
  las unidades más vendidas en todo el historial de `direct_sales` +
  `seller_sales`, documentado como simplificación consciente igual que
  otras de este proyecto).
- `lib/format.ts` ganó `formatRelativeTime` ("Hace 4 min", con el mismo
  ajuste de zona horaria de arriba) y `todayLocalDateString`.
- Verificado con `npm run test` (44/44) + `npx tsc --noEmit` en verde +
  `npm run lint` (mismo error preexistente). **No verificado todavía en
  el celular del usuario** — pendiente antes de dar la pantalla de Inicio
  por terminada, especialmente por ser la primera pantalla en usar
  `expo-sqlite/kv-store`, Inter y Lucide/`react-native-svg` juntos en
  tiempo de ejecución real (typecheck/lint no lo garantizan).
- **Pendiente, explícitamente fuera de esta sesión**: aplicar el mismo
  lenguaje visual (tarjetas con `Radii`/`Shadow`, botones primarios verdes
  en vez del `backgroundSelected` gris genérico, iconos Lucide) al resto
  de pantallas — Productos, Inventario, Caja, Vendedores, Compras,
  Reportes, formularios en general. Se decidió no tocarlas de una sola vez
  para no romper ~40 archivos sin poder verificarlos todos en la misma
  sesión — queda como la siguiente sesión de esta misma fase.

### Rollout — pantalla de Vender (catálogo con búsqueda + categorías + grid)

Segundo incremento del rollout (misma sesión). El usuario pidió
específicamente rediseñar la parte de "agregar producto" de `sell/index.tsx`
(antes un buscador de texto que solo mostraba una lista cuando se escribía)
como un catálogo siempre visible: barra de búsqueda con ícono (`Search` de
Lucide) y placeholder "Buscar productos", cápsulas de categoría en
horizontal (`categoriesRepo.list()`, "Todos" primero y seleccionada por
defecto, cápsula activa en verde sólido — `Radii.chip`), y grid de 3
columnas (ancho de tarjeta calculado con `useWindowDimensions` en vez de
`%` fijo, para que los 3 huecos de `Layout.cardGap` encajen exacto) con 6
productos visibles (`PAGE_SIZE`) + botón "Ver más productos" que suma 6 más.

- Cambio de comportamiento real, no solo visual: **tocar una tarjeta ahora
  es un toggle** (agrega al carrito si no estaba, lo quita si ya estaba —
  `toggleProduct`, reemplaza el `addProduct` que antes solo acumulaba
  cantidad) — así el fondo "seleccionado" (`backgroundSelected`, el verde
  claro del tema) refleja de verdad si el producto está en la venta. Pedir
  más de 1 unidad del mismo producto se sigue haciendo desde la fila del
  carrito más abajo (sin cambios, `updateItem`), no repitiendo el toque.
  Buscador y categoría filtran el mismo catálogo en conjunto (AND, no
  reemplazo uno del otro).
- El resto de la pantalla (carrito, selector de cuenta, notas, total,
  botón Cobrar) no se tocó esta vuelta — sigue con los mismos componentes
  de antes, ya retintados automáticamente por la paleta global de la
  sección de arriba.
- Verificado con `npm run test` (44/44) + `npx tsc --noEmit` + `npm run
  lint` en verde (mismo error preexistente). **No verificado todavía en
  el celular del usuario.**

Tercer incremento, misma sesión: se quitó el link "Ver historial de
ventas" de arriba de la pantalla (la ruta `/sell/history` sigue
existiendo, solo ya no tiene acceso directo desde el POS) y se rediseñó
el carrito. "Productos en la venta" pasó a llamarse **"Carrito"**, y cada
fila ahora es horizontal: miniatura (`item.imageUri`, con el mismo
ícono `Package` de respaldo que las tarjetas del catálogo) + nombre +
selector de cantidad (`-`/`+` con `Minus`/`Plus` de Lucide, en vez del
`TextInput` numérico anterior) + precio total de la línea + botón `X`
para quitarla. `CartItem` ganó el campo `imageUri`; `toggleProduct`
(antes `addProduct`) ya lo guarda al agregar el producto desde el grid.
El campo "Precio unitario" editable por línea **se quitó** — el precio
de línea ahora es fijo al `product.price` del momento en que se agregó,
solo la cantidad es ajustable desde el carrito (con la cápsula +/-, no
repitiendo el toque sobre la tarjeta). Verificado con `npm run test`
(44/44) + `npx tsc --noEmit` + `npm run lint` en verde. **No verificado
todavía en el celular del usuario.**

Cuarto incremento, misma sesión: varias rondas de pulido visual del
carrito y de la tarjeta de cobro (tarjeta única con separador tenue entre
filas en vez de cajas sueltas, "Cuenta" renombrado a "Método de pago" y
envuelto en su propia tarjeta, "Total" + botón "Cobrar" unificados en una
sola tarjeta) — sin cambios de lógica, solo estilo. Luego se agregó
**descuento en la venta**: botón "Descuento" (ícono `Tag`, contorno verde,
misma forma alargada que "Cobrar" pero sin relleno — menos protagonismo)
arriba de "Total"; al tocarlo aparecen filas de "Subtotal" y "Descuento"
(esta última con un `TextInput` numérico) antes del "Total" final.

- El selector de cantidad del carrito ahora respeta el stock: `CartItem`
  guarda `stock` (capturado al agregar el producto) y `changeQuantity`
  hace `Math.min(item.stock, ...)` — el botón `+` se deshabilita y atenúa
  al llegar al máximo, con un texto "Stock máximo alcanzado".
- `direct_sale_items` no tiene columna de descuento — en vez de agregar
  una (migración nueva solo para esto), `applyDiscount` (función pura,
  arriba del componente) reparte el descuento proporcionalmente entre las
  líneas del carrito ajustando cada `unitPrice` (`ratio = grandTotal /
  subtotal`), con el remanente de redondeo absorbido por la línea de
  mayor subtotal para que ningún precio quede negativo. Así el monto que
  de verdad queda en `cash_movements` coincide con lo cobrado en pantalla
  — el descuento nunca es solo cosmético.
- Verificado con `npm run test` (44/44) + `npx tsc --noEmit` + `npm run
  lint` en verde. **No verificado todavía en el celular del usuario.**

## Importación de compras desde Excel (.xlsx)

Construida en la sesión 2026-08-01. El cliente de IC Variedades arma cada
pedido a un proveedor copiando a mano en Excel: código del proveedor,
nombre, cantidad, valor unitario y total por línea. Se agregó un botón
"Importar desde Excel" en `more/purchases/new.tsx` (Fase 8) para subir ese
mismo archivo en vez de teclear cada producto en el carrito.

Dos decisiones tomadas explícitamente por el usuario, sin las cuales el
diseño habría sido distinto:

- **Columnas fijas por posición, no por nombre de encabezado**: el usuario
  no sabe (o no le importa) cómo está literalmente rotulada cada columna
  en el Excel de su cliente, solo su posición — A=código, B=nombre,
  C=cantidad, D=valor unitario, E=total. `lib/purchase-import.ts` lee por
  índice de columna (`sheet_to_json(sheet, { header: 1 })`, arreglo de
  arreglos) en vez de matchear sinónimos de encabezado — más simple y es
  lo que el usuario pidió. La columna E (total) no se usa para nada, se
  recalcula `cantidad × valor` igual que en el resto de la app; la columna
  A (código del proveedor) tampoco se usa para nada — ver la limitación
  de abajo.
- **Cada archivo subido crea productos nuevos automáticamente** si el
  nombre no matchea ningún producto activo del catálogo — no hay pantalla
  de revisión manual fila por fila. Precio de venta (`price`) del producto
  nuevo se inicializa igual al valor unitario importado (no hay precio de
  venta en el Excel, solo costo) — queda editable después desde el
  detalle del producto, documentado como simplificación consciente.

**Limitación real, explicada al usuario, no resuelta en esta sesión**: el
código de columna A es el código del *proveedor*, mientras que
`products.sku` se autogenera (`GEN-00001`, `lib/data/local/products-repo.ts`)
y nunca acepta un valor externo — no hay forma de que ese código coincida
con nuestro SKU interno. Por eso el emparejamiento de cada fila contra el
catálogo propio es **por nombre normalizado** (sin tildes, minúsculas,
trim), no por código. Si el nombre en el Excel no coincide *exactamente*
con el nombre ya guardado en la app (típicamente porque el cliente lo
escribe distinto de una vez a otra), se crea un producto nuevo en vez de
reutilizar el existente — riesgo conocido, no hay fuzzy matching todavía.
Si en la práctica esto genera muchos duplicados, la alternativa es el
catálogo de productos por proveedor que se había planteado y se descartó
para esta primera versión (código real del proveedor ↔ producto propio,
mapeado una sola vez).

- `lib/purchase-import.ts` (con test de caso conocido en
  `lib/purchase-import.test.ts`, mismo criterio spec-first del resto del
  proyecto): `parseCOPNumber` (acepta celdas numéricas o texto con
  separador de miles, ej. `"8.500"` → `8500`), `parseImportSheet` (fila 1
  se asume encabezado y se descarta en silencio; cualquier otra fila
  inválida — ej. una fila de "TOTAL" al final — se reporta en `skipped`
  con motivo, no se descarta sin explicación) y `resolveImportRows` (
  empareja por nombre contra los productos ya cargados en la pantalla;
  filas que resuelven al mismo producto — existente o nuevo — se
  fusionan sumando cantidad, mismo comportamiento que ya tenía el carrito
  al tocar dos veces el mismo producto; genera slug único para productos
  nuevos, evitando colisión tanto contra `products.slug` existente como
  contra otros productos nuevos del mismo archivo).
- Lectura de archivo: `File.pickFileAsync({ mimeTypes: [...] })` +
  `picked.result.arrayBuffer()` (API `File`/`Paths` nueva de
  `expo-file-system`, mismo patrón ya usado en `more/backup.tsx` y
  `lib/images.ts`) → `XLSX.read(buffer, { type: 'array' })` de la
  dependencia nueva `xlsx` (SheetJS) → `utils.sheet_to_json(sheet, {
  header: 1 })` sobre la primera hoja del libro (`workbook.SheetNames[0]`,
  sin selector de hoja si el archivo tiene varias pestañas).
- Los productos nuevos se crean secuencialmente con `await` dentro de un
  `for` (no en paralelo) — mismo criterio que documenta el comentario de
  `generateSku` en `products-repo.ts` (single device, sin condición de
  carrera real, pero el conteo que genera el SKU sí depende de que cada
  insert termine antes del siguiente).
- Sin transacción que abarque la creación de productos: si `productsRepo.create`
  falla a mitad de la importación, los productos ya creados antes del
  error quedan en la base (no hay rollback) — aceptado como limitación de
  esta primera versión, ya que crear un producto de más con stock 0 es
  inofensivo (no aparece en ninguna alerta hasta tener una compra
  recibida).
- Verificado con `npm run test` (55/55, 11 tests nuevos) + `npx tsc
  --noEmit` + `npm run lint` en verde (mismo error preexistente de
  `use-color-scheme.web.ts`, no relacionado). **No verificado todavía en
  el celular del usuario** — pendiente antes de dar la funcionalidad por
  terminada, sobre todo por ser la primera vez que se lee un archivo
  binario real con `arrayBuffer()` + `xlsx` en tiempo de ejecución
  (typecheck/lint no lo garantizan).

## Código de proveedor único por producto

Construido en la sesión 2026-08-01 (misma sesión que la importación de
Excel de arriba). Complementa la limitación documentada en esa sección:
en vez de un catálogo de productos por proveedor aparte, es la versión
ligera — un solo campo opcional en `products` que actúa como guardia
contra duplicados al crear/editar un producto a mano.

- Schema: `products.distributor_code` (`text`, nullable, `.unique()` —
  SQLite permite múltiples `NULL`, así que no afecta a los productos sin
  código). Migración `drizzle/0012_pale_captain_midlands.sql`, `ALTER
  TABLE ADD COLUMN` simple sobre una tabla con datos reales.
- **No es una referencia a `distributors.id`** (la tabla de la Fase 8) —
  es el código que el proveedor le puso a ESE producto puntual (como su
  propio SKU), texto libre, sin selector de distribuidor asociado. Mismo
  criterio de nombres que ya generó confusión al diseñar esto: se dejó
  documentado explícitamente para la próxima sesión.
- `ProductsRepo` gana `findByDistributorCode(code)` — primer método
  "finder" dedicado de este repo (el resto de pantallas resuelve por
  nombre/SKU filtrando en memoria sobre `list()`, ver `purchases/new.tsx`,
  `sell/index.tsx`). Se justifica acá porque la validación tiene que ser
  autoritativa contra toda la tabla (incluye productos inactivos, que
  igual "reservan" su código) y porque la pantalla necesita el producto
  completo (id + nombre) para el link "Ir a editar". Comparación
  case-insensitive vía `sql\`lower(...)\``, sin filtrar por `active`.
- `products/new.tsx` y `products/[id].tsx`: nuevo campo "Código del
  proveedor (opcional)" entre Descripción y Precio de venta. En
  `handleSubmit`, si el campo no está vacío, se llama
  `findByDistributorCode` antes de guardar; si devuelve un producto
  (distinto al propio, en el caso de editar), se bloquea el guardado, se
  muestra su nombre en el error y aparece un link "Ir a editar {nombre}"
  que navega a `/more/products/${id}` — así el flujo pedido ("que le diga
  que vaya a editar ese producto") queda con una acción directa, no solo
  un mensaje.
- Se encontró y corrigió un segundo `toProduct` duplicado en
  `local/inventory-repo.ts` (mapea filas de `products` a `Product` para
  devolver el stock actualizado tras un movimiento) que no tenía
  `distributorCode` — typecheck lo marcó de inmediato al agregar el campo
  al tipo `Product`. Queda como recordatorio de que hay dos mapeos
  `products` → `Product` en el proyecto, no uno solo.
- Fuera de alcance, documentado para no repreguntar: este campo no se usa
  todavía para mejorar el emparejamiento de la importación de Excel (que
  sigue emparejando por nombre) — sería la mejora natural si los
  duplicados por nombre distinto resultan un problema real en la
  práctica.
- Verificado con `npm run test` (55/55) + `npx tsc --noEmit` + `npm run
  lint` en verde (mismo error preexistente de `use-color-scheme.web.ts`).
  **No verificado todavía en el celular del usuario.**

## Varias fotos por producto (`product_images`)

Completada (sesión 2026-09-25). Prepara la unificación futura con la
base de datos del repo web: una auditoría encontró que el modelo de fotos era
incompatible (el móvil guardaba una sola foto en `products.image_uri`; la web
guarda varias en `product_images`, con orden y una principal). El móvil
adopta el mismo modelo que la web.

Decisiones tomadas con el usuario antes de construir: **`products.image_uri`
se elimina de una vez** (opción A, en vez de dejarla un tiempo como
obsoleta — no la escribiría nadie, así que quedaría desactualizada en cuanto
se editara un producto y solo daría una falsa sensación de seguridad), y **no
se exportó respaldo antes de migrar** porque los datos del dispositivo son de
prueba (confirmado por el usuario).

| # | Sub-paso | Estado |
|---|----------|--------|
| 1 | Schema `product_images` (mismas columnas que la web + `createdAt`/`updatedAt`/`syncStatus` reservados) + migración `0013` con backfill a mano (cada `image_uri` no vacío → una fila `is_primary = 1`) | ✅ listo |
| 2 | Dominio `lib/domain/product-images.ts` (`normalizeImages`, `addImage`, `removeImage`, `setPrimaryImage`, `primaryImageUrl`) + test | ✅ listo |
| 3 | `ProductsRepo`: `Product.primaryImageUri` (derivado), `getById` → `ProductWithImages` con `images[]`, `create`/`update` con `images?` transaccional; mapeo `products → Product` unificado | ✅ listo |
| 4 | UI: `components/product-image-gallery.tsx` en crear/editar producto; miniaturas de Productos/Inicio/Vender pasan a `primaryImageUri` | ✅ listo |
| 5 | Migración `0014`: `DROP COLUMN image_uri` | ✅ listo |
| 6 | Verificación manual en el celular del usuario | ✅ listo |

**Completo (6/6 sub-pasos).**

**Notas de implementación:**

- **Invariante**: una galería vacía no tiene principal; una no vacía tiene
  exactamente una. Se garantiza en dos niveles: el dominio
  (`normalizeImages`, que aplica `ProductsRepo` antes de guardar) y la propia
  base de datos, con un índice único parcial
  (`product_images_one_primary ON product_images(product_id) WHERE is_primary = 1`).
  La web no tiene esa garantía (depende de la lógica de su formulario).
  Quitar la principal promueve la primera foto restante.
- **Migración en dos archivos** (`0013_bumpy_unicorn.sql` crea la tabla y
  copia los datos; `0014_freezing_korath.sql` elimina la columna), en vez de
  uno solo: así la copia de datos corre garantizado antes del `DROP`. Un
  respaldo viejo importado también queda cubierto, porque las migraciones
  corren al reabrir la app. Se verificó la cadena completa `0000`→`0014`
  sobre SQLite real (`node:sqlite`): un producto con foto termina con una
  fila principal, los productos con `NULL`/`''` no generan filas, la columna
  desaparece y el índice rechaza una segunda principal.
- **La cascada `ON DELETE` está declarada pero no se aplica**: SQLite solo
  la cumple con `PRAGMA foreign_keys = ON`, y el proyecto nunca lo activa (eso
  aplica a todas las FKs de la base, no solo a esta). Hoy no importa, porque
  los productos solo se desactivan y nunca se borran. Activar el pragma
  afecta a toda la base, así que queda como decisión aparte.
- `ProductsRepo.list()` (y todo lo que devuelve `Product`) trae
  `primaryImageUri` con una subconsulta con el mismo orden que la web
  (`is_primary DESC, display_order ASC`), en vez de cargar la galería completa
  de cada producto solo para las miniaturas. La galería completa sale solo de
  `getById`.
- **Bug real encontrado antes de llegar al emulador**: dentro de un `select`
  de una sola tabla, Drizzle escribe `${products.id}` como `"id"` a secas, y
  dentro de la subconsulta SQLite lo resolvía contra `product_images.id`.
  Todos los productos mostraban la foto del producto 1. Se corrigió escribiendo
  `"products"."id"` explícito (con comentario en el código). Lo encontró
  `lib/data/local/products-repo.test.ts`, el **primer test de la capa
  `lib/data/`** del proyecto: corre el repo real contra SQLite en memoria
  (`node:sqlite` + driver `drizzle-orm/sqlite-proxy`, porque `expo-sqlite` no
  corre en Node) con todas las migraciones aplicadas. Se dejó como test
  permanente porque este tipo de error no lo detectan ni `tsc` ni los tests
  de dominio.
- Se eliminó el `toProduct` duplicado de `local/inventory-repo.ts` (ver la
  nota de "Código de proveedor único" más arriba): ahora importa
  `productColumns`/`toProduct` de `local/products-repo.ts`, así que queda un
  solo mapeo en todo el proyecto.
- **Guardado**: la galería se edita como borrador en la pantalla y se guarda
  junto con el producto al tocar Guardar, en la misma transacción
  (`replaceImages`). Las filas cuya URL se mantiene se actualizan en su lugar
  y conservan su `id` (útil para un futuro sync); el resto se borra o se
  inserta. Antes de reasignar la principal se limpian todas, para no chocar
  con el índice único a mitad del proceso. `update` sin `images` no toca la
  galería (la importación de Excel de compras sigue creando productos sin
  fotos, sin cambios).
- **Archivos de fotos**: `pickAndPersistProductImages` permite elegir varias
  a la vez (`allowsMultipleSelection`) y copia cada una a `Paths.document`.
  Al quitar una foto: si ya estaba guardada, `ProductsRepo.update` borra su
  archivo después del commit (un guardado que falla no pierde archivos); si
  se acababa de elegir sin guardar, la galería borra el archivo de inmediato.
  **Limitación conocida**: si se eligen fotos y se sale de la pantalla sin
  guardar, esos archivos quedan huérfanos en disco (solo ocupan espacio).
- **Fuera de alcance, documentado para la unificación**: (1) el respaldo
  (`VACUUM INTO`) sigue sin incluir los archivos de fotos, solo el `.db`, y
  con varias fotos por producto eso pesa más; (2) `url` en el móvil es una
  ruta local `file://` absoluta y en la web una URL remota, así que la tabla
  es compatible pero los valores no. Para unificar habrá que subir las fotos
  a algún lado. (3) No se pueden reordenar fotos arrastrándolas (el orden es
  el de agregado) y `alt` queda siempre `null`.
- Verificado con `npm run test` (75/75: 15 de dominio + 5 de integración del
  repo) + `npx tsc --noEmit` en verde + `npm run lint` (mismo error
  preexistente de `use-color-scheme.web.ts`). **Verificado en vivo en el
  celular del usuario** (Expo Go): foto existente migrada como principal,
  agregar varias fotos a la vez, cambiar la principal, quitar la principal
  (promueve la siguiente), vaciar la galería, crear producto con varias
  fotos, y miniaturas correctas en Productos/Inicio/Vender. Todo confirmado
  sin fallos por el usuario.
- **Problema de entorno encontrado al verificar (no de esta fase)**: el
  Expo Go recién instalado desde la tienda cerraba la app de golpe al
  abrirla, sin pantalla roja. La causa: las dependencias del proyecto se
  habían quedado en parches viejos del SDK 57 (29 paquetes, entre ellos
  `react-native-worklets` 0.10.0 contra el 0.10.1 nativo de Expo Go; si
  worklets/reanimated no coinciden entre el JS y el binario nativo, la app
  se cierra sin mostrar error). `npx expo install --fix` + `npx expo start
  --clear` lo resolvió (también agregó `expo-image`/`expo-web-browser` a
  los plugins de `app.json`). **Para sesiones futuras**: si Expo Go se
  cierra sin error al abrir la app, correr primero `npx expo install
  --check` antes de buscar un bug en el código.

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
