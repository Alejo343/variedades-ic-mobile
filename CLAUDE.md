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

> **Actualización 2026-09-25**: la web ya está desplegada y se decidió
> unificar las bases. El móvil sigue siendo offline-first, pero gana sync
> con el servidor y login por roles — ver "Fase 10" más abajo. Lo que
> sigue describe el diseño original (Fases 1-9); la capa de sync se
> construye como un motor aparte (`lib/sync/*`), no como un
> `lib/data/remote/*` que reemplace a SQLite.

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

## Fase 10 — Sincronización con el servidor + roles (dueño / vendedor)

En construcción (desde la sesión 2026-09-25). Une el móvil con la web
desplegada (`https://icvariedades.com`, VPS con Postgres 16 — ver sección
"Despliegue a producción (VPS)" del `CLAUDE.md` del repo web) para que
exista **una sola base de datos en producción**. Reemplaza la premisa
"sin servidor, sin login" de "Decisión de arquitectura" más arriba: el
móvil **sigue siendo offline-first** (las pantallas siguen leyendo SQLite
local siempre), pero ahora sincroniza con el servidor cuando hay red, y
cada persona entra con su usuario. Este es el plan maestro — la web
también cambia (sub-pasos marcados "web"), y su `CLAUDE.md` tiene una
sección que apunta aquí.

**Decisiones tomadas con el usuario (sesión 2026-09-25):**

- **Offline-first + sync en segundo plano**, no "siempre en línea" — el
  uso sin conexión fue la razón de ser del móvil.
- **La base unificada arranca vacía**: producción está vacía y los datos
  del celular son de prueba — se descartan. El primer login en un celular
  borra su base local y descarga todo del servidor. No hay reconciliación
  de datos existentes.
- **Varios vendedores con la app en su propio celular → dos roles**:
  - **Dueño**: ve y hace todo, como hasta ahora.
  - **Vendedor**: entra con su usuario (ligado a su fila de `sellers`),
    ve solo su inventario asignado y registra solo sus ventas,
    devoluciones y pérdidas. No ve caja, compras, cuentas por pagar,
    utilidad ni a los otros vendedores. Su celular descarga el catálogo y
    lo suyo, no la base completa.
  - Solo el dueño crea/edita productos y categorías, y registra entregas
    y liquidaciones (el vendedor solo las ve).
- **Venta sin conexión del último producto en stock**: se **acepta** (la
  venta ya ocurrió en la realidad); el stock queda negativo y aparece una
  alerta para corregirlo. Las operaciones que llegan por sync no aplican
  el fail-fast de "Stock insuficiente" — es la única excepción a esa
  regla en todo el proyecto.

**Diseño técnico (decidido al trocear, no preguntado — cambiable si algo
choca en la implementación):**

- **Identidad por `uuid`**: cada tabla sincronizable gana una columna
  `uuid` única, generada donde nace el registro (celular o servidor). Los
  `id` numéricos siguen existiendo pero son **locales a cada base** — la
  sync nunca los usa, solo habla en `uuid` (incluidas las referencias:
  "venta `3f2a…` del producto `a81c…`"). Números que el usuario ve (SKU
  `GEN-00012`, "Venta #7") los asigna el servidor; mientras un registro no
  se sincroniza se muestra como pendiente.
- **Push = operaciones, no filas**: el celular guarda una cola
  (`sync_outbox`) con operaciones ("crear venta en local con estos
  items"), escrita en la misma transacción que el cambio local. El
  servidor las ejecuta con su propia lógica de `lib/domain` (así nunca
  entra algo que la web no permitiría), son idempotentes (un id de
  operación aplicado dos veces no hace nada) y **cada operación lleva los
  `uuid` de todas las filas que crea** (cabecera, items, movimientos de
  inventario y de caja) para que el servidor use exactamente los mismos y
  el pull no duplique nada.
- **Pull = filas, el servidor manda**: el celular pide "lo que cambió
  desde la versión X" y hace upsert por `uuid` en SQLite. El stock
  (`products.stock`) siempre se toma del servidor; en el celular es
  provisional hasta sincronizar. Orden fijo: primero push, después pull.
- **Qué cambió desde X (web)**: columna `sync_version` en cada tabla,
  asignada por trigger desde una secuencia global, con los escritores
  serializados por un advisory lock para que las versiones se confirmen
  en orden (volumen de un comercio pequeño, no hay costo real). Borrados
  físicos (hoy solo `product_images`) dejan una "lápida" en
  `sync_tombstones`.
- **Conflictos**: catálogo editable → gana la última edición (registro
  completo); operaciones que solo agregan filas (ventas, movimientos,
  pagos...) → no hay conflicto; cambios de estado (pedidos, liquidaciones)
  → el servidor valida `canTransition*` y rechaza el segundo; la
  operación rechazada queda visible en el celular.
- **Autenticación del móvil**: `POST /api/sync/login` con usuario y
  contraseña devuelve un token de dispositivo de larga duración
  (revocable, guardado como hash en el servidor y en `expo-secure-store`
  en el celular). Con el token guardado, la app abre sin red como
  siempre.
- **Disparadores**: al recuperar conexión, al volver a la app y con un
  botón manual ("N pendientes · última sincronización"). Sin sync con la
  app cerrada (poco confiable en Android/iOS).
- **Fuera del alcance del móvil**: `sales_orders` (pedidos por WhatsApp)
  no se sincronizan al celular — solo sus efectos (los movimientos de
  stock que generan).

| # | Sub-paso | Lado | Estado |
|---|----------|------|--------|
| 1 | `uuid` en todas las tablas sincronizables, generado donde nace el registro | web + móvil | ✅ listo |
| 2 | `sync_version` (trigger + secuencia + advisory lock) y `sync_tombstones` | web | ✅ listo |
| 3 | Tablas `users` (rol `owner`/`seller`, `sellerId`) + `device_sessions`; NextAuth lee `users`; dueño sembrado desde `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` | web | ✅ listo |
| 4 | Pantalla admin: crear/desactivar usuarios vendedor ligados a un vendedor, revocar dispositivos | web | ✅ listo |
| 5 | `POST /api/sync/login` + verificación de token bearer y permisos por rol (con tests) | web | ✅ listo |
| 6 | `GET /api/sync/pull` (cursor por versión, lápidas, filtrado por rol) | web | ✅ listo |
| 7 | `POST /api/sync/push`: ejecutor de operaciones idempotente, permisos por rol, reusa `lib/domain`, ventas aceptan stock negativo | web | ✅ listo |
| 8 | Alerta de stock negativo en el panel + subida de fotos con token | web | ✅ listo |
| 9 | Pantalla de login + token en `expo-secure-store`; primer login borra la base local; cerrar sesión | móvil | ✅ listo |
| 10 | Cola `sync_outbox`: cada repo local anota su operación (con todos sus `uuid`) en la misma transacción | móvil | ✅ listo |
| 11 | Motor de sync: push → pull, upsert por `uuid`, lápidas, stock del servidor, operaciones rechazadas visibles | móvil | ✅ listo |
| 12 | Disparadores (reconexión, volver a la app, botón) + indicador de pendientes | móvil | ✅ listo |
| 13 | Fotos (subir antes del push, mostrar URL remota con caché) + SKU/números provisionales hasta sincronizar | móvil | ✅ listo |
| 14 | Navegación por rol (vendedor: su inventario, "Vender" = venta de vendedor, devoluciones/pérdidas, sus liquidaciones); Respaldo→Importar bloqueado con sesión activa | móvil | ✅ listo |
| 15 | Desplegar la web con las migraciones + verificación end-to-end: dueño + 2 vendedores, ventas sin conexión, stock negativo, la web muestra lo mismo | ambos | ⏳ pendiente |

**Notas de implementación:**

- **Sub-paso 1 (`uuid`)**: las mismas 22 tablas en los dos lados tienen
  `uuid` `NOT NULL UNIQUE` (en la web, todas menos `sales_orders`/
  `sales_order_items`, que nunca se sincronizan). Web: migración
  `drizzle/0019_mature_vertigo.sql`, un solo paso (`ADD COLUMN ... DEFAULT
  gen_random_uuid() NOT NULL` — Postgres evalúa el default fila por fila);
  aplicada y verificada en la base local, **todavía no en producción**
  (se despliega junto con el resto de la fase, o antes si hace falta).
  Móvil: helper `syncUuid()` en `schema.ts` con `$defaultFn(newUuid)`, así
  que Drizzle lo llena en cada insert sin tocar ningún repo;
  `lib/uuid.ts#newUuid` usa `crypto.randomUUID` global si existe (Node:
  Vitest y `drizzle-kit`) y si no `expo-crypto` (dependencia nueva, viene en
  Expo Go) — `require` diferido para que `schema.ts` se pueda cargar en
  Node.
- **Migración del móvil en dos pasos**, mismo motivo que la tríada
  `0009`-`0011`: SQLite no permite `ADD COLUMN ... NOT NULL` sin default
  constante. `0015_sturdy_chronomancer.sql` agrega la columna nullable +
  índice único + relleno a mano (un v4 por fila con `randomblob`);
  `0016_opposite_karnak.sql` la marca `NOT NULL`, lo que para SQLite
  significa **reconstruir las 22 tablas** (generado por `drizzle-kit`, sin
  edición; recrea también índices únicos, el índice parcial de foto
  principal y los `CHECK`).
- **Hallazgo al testear `0016`**: `drizzle-kit` emite `PRAGMA
  foreign_keys=ON` a mitad de la migración. Si ese PRAGMA surtiera efecto,
  el `DROP TABLE products` de la reconstrucción dispararía el `ON DELETE
  CASCADE` y borraría **todas las fotos**. En el celular no pasa: el
  migrador de Drizzle corre todo dentro de `BEGIN … COMMIT` (ahí SQLite
  ignora ese PRAGMA) y el build Android de `expo-sqlite` no activa las
  llaves foráneas por defecto (sin `SQLITE_DEFAULT_FOREIGN_KEYS`). El
  arnés de test no replicaba lo primero y por eso falló — se corrigió.
  **Regla para migraciones futuras que reconstruyan tablas**: no asumir que
  el PRAGMA las protege; lo que las protege es la transacción.
- El arnés de SQLite en memoria de `products-repo.test.ts` se sacó a
  `lib/data/local/test-db.ts#createMigratedTestDb` (llaves foráneas
  apagadas + cada migración en una transacción, igual que el dispositivo)
  para reutilizarlo. `lib/data/local/uuid.test.ts` cubre el contrato: 22
  tablas, relleno v4 distinto por fila en filas previas a `0015`, `NOT
  NULL`/`UNIQUE` a nivel de base, `CHECK` conservados tras la
  reconstrucción, y una venta en local creada por el repo real deja `uuid`
  en cabecera, items, movimientos de inventario y de caja.
- Verificado: móvil `npm run test` (80/80) + `npx tsc --noEmit` en verde
  (`npm run lint`: mismo error preexistente de `use-color-scheme.web.ts`);
  web `npm run test` (62/62) + `npm run lint` + `npm run build` en verde.
  **Verificado en vivo en el celular del usuario**: `0015`/`0016` corrieron
  sobre su base real sin fallos — la app abre, los productos conservan sus
  fotos y su principal, y una venta nueva baja el stock y genera el ingreso
  en caja.
- **Sub-paso 2 (`sync_version`)**, solo web: migración
  `drizzle/0020_sync_version.sql` — la parte generada agrega
  `sync_version bigint` a las 22 tablas, la secuencia global
  `sync_version_seq` y la tabla `sync_tombstones`; la parte **escrita a
  mano** al final crea las funciones `sync_bump_version()` (BEFORE
  INSERT/UPDATE) y `sync_record_tombstone()` (AFTER DELETE), las engancha
  a las 22 tablas con un `DO` que recorre un arreglo de nombres, y rellena
  las filas existentes con un `UPDATE` sin cambios que dispara el trigger.
  Todo vive en Postgres: **ninguna ruta del panel cambió**, y cualquier
  escritura (panel, sync, psql) queda versionada igual. `drizzle-kit` no
  conoce los triggers — una tabla sincronizable nueva hay que agregarla a
  mano al arreglo en una migración nueva. `TRUNCATE` no deja lápidas; no
  usarlo sobre tablas sincronizables.
- Los escritores se serializan con `pg_advisory_xact_lock(7390001)`, tomado
  **antes** de `nextval` y soltado al hacer commit: así una versión menor
  nunca se confirma después de una mayor, y un cursor `sync_version > X`
  no se salta filas. Costo: dos escrituras a tablas sincronizables no
  corren en paralelo — irrelevante al volumen de este negocio.
- **Requisito para el sub-paso 6 (pull)**: leer las 22 tablas dentro de
  **una sola transacción `REPEATABLE READ`** (una sola foto de la base). En
  `READ COMMITTED` cada consulta ve una foto distinta: si un escritor
  confirma entre la lectura de la tabla A y la de la B, el cursor
  devuelto avanzaría más allá de filas de A que el celular nunca recibió.
- Test nuevo contra Postgres real, `lib/db/sync-version.integration.test.ts`
  (primer test de base de datos del repo web): las 22 tablas tienen los dos
  triggers y ninguna fila quedó en versión 0; insert → update → delete dan
  versiones crecientes y dejan lápida; y con dos conexiones reales, un
  segundo escritor queda bloqueado hasta que el primero termina y recibe
  una versión mayor. Todo en transacciones con rollback (no toca los datos
  de desarrollo). Corre con `npm run test:db` (script nuevo, carga
  `.env.local` con `node --env-file`); `npm run test` lo salta si no hay
  `DATABASE_URL`, para seguir siendo solo lógica pura.
- Verificado: web `npm run test:db` (3/3, contra la base local ya
  migrada) + `npm run test` (62/62) + `npm run lint` + `npm run build` en
  verde. `0020` aún **no aplicada en producción**.
- **Sub-paso 3 (usuarios y roles)**, solo web: migración
  `drizzle/0021_users_roles.sql` con `users` (`username` único, `role`,
  `seller_id` único) y `device_sessions` (solo el SHA-256 del token, más
  `revokedAt` para revocar un celular sin tocar los demás). Las reglas del
  rol las hace cumplir la propia base con dos `CHECK`: `role IN
  ('owner','seller')` y `(role = 'seller') = (seller_id IS NOT NULL)`; con
  el `UNIQUE` de `seller_id`, cada vendedor tiene a lo sumo un usuario.
  `users` **no** lleva `uuid`/`sync_version`: no se sincroniza como tabla,
  el celular recibe su propio usuario en la respuesta del login.
- Dominio `lib/domain/users.ts` (con test): `normalizeUsername` (sin
  mayúsculas ni espacios — el usuario del dueño es su correo),
  `canSignInToPanel` (solo un dueño activo entra al panel web; los
  vendedores solo entran desde el celular) y `ownerSeedFromEnv`.
- `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` dejan de ser el login: ahora solo
  **siembran el primer dueño, una sola vez**, en `instrumentation.ts`
  justo después de migrar. Si ya existe un dueño, cambiar esas variables no
  hace nada — la contraseña se cambia en `users`.
- `lib/auth.ts#authorize` busca en `users`. El campo del formulario sigue
  llamándose `email` (no cambió la pantalla de login). Ninguna ruta de
  `/api/admin/*` cambió: todas exigen sesión, y ahora solo un dueño activo
  puede tener una. **Limitación conocida**: las sesiones del panel son JWT
  sin estado, así que desactivar a un dueño no cierra una sesión web ya
  abierta hasta que expira.
- Test nuevo contra Postgres, `lib/db/users.integration.test.ts`: acepta
  dueño sin vendedor y vendedor con vendedor; rechaza vendedor sin
  vendedor, dueño con vendedor, rol desconocido, dos usuarios para el mismo
  vendedor y un nombre de usuario repetido.
- Verificado: `npm run test:db` (6/6) + `npm run test` + `npm run lint` +
  `npm run build` en verde; con el build levantado sobre la base local, la
  siembra creó exactamente un dueño con el correo de `ADMIN_EMAIL`, un login
  con contraseña incorrecta se rechaza y `/admin` sin sesión redirige al
  login. El usuario no recordaba la contraseña local del dueño: se generó
  una nueva (aleatoria), se guardó su hash en `users` de la base local y en
  `ADMIN_PASSWORD_HASH`, y quedó en texto plano **comentada en
  `.env.local`** (no versionado), a pedido del usuario. Login con esa
  contraseña contra el build → entra a `/admin`; con una incorrecta →
  rechazado. `0021` aún **no aplicada en producción** — ojo: el
  `ADMIN_PASSWORD_HASH` del VPS es el viejo (la contraseña olvidada), y es
  el que sembrará el dueño de producción la primera vez que arranque con
  `0021`; cambiarlo antes de desplegar.
- **Sub-paso 4 (acceso de vendedores en el panel)**, solo web, sin
  migración nueva. Tarjeta "Acceso a la app"
  (`app/admin/sellers/_components/SellerAccessCard.tsx`) en el **detalle
  de cada vendedor** (`/admin/sellers/[id]`), no una sección aparte de
  "Usuarios": la relación es 1:1 y ahí el dueño ya ve el inventario del
  vendedor. Sin acceso muestra "Crear acceso" (usuario + contraseña); con
  acceso muestra el usuario, activar/desactivar, cambiar contraseña y la
  lista de celulares conectados con "Revocar" por celular.
- Rutas: `POST`/`PATCH /api/admin/sellers/[id]/user` (crear; cambiar
  contraseña y/o activo) y `DELETE /api/admin/sellers/[id]/devices/[sessionId]`
  (revocar = `revokedAt`, no borra la fila). La revocación se filtra por el
  usuario de ese vendedor, así que el id de sesión de otro vendedor da 404.
  Validación en `lib/validations.ts` (`sellerUserCreateSchema`/
  `sellerUserUpdateSchema`, con tests): usuario normalizado con
  `normalizeUsername`, 3-100 caracteres ASCII `[a-z0-9._@-]` (se teclea en
  un celular), contraseña de 8+; bcrypt costo 12, igual que el hash del
  dueño. Consultas en `lib/db/queries/users.ts`, que **nunca** devuelven
  `password_hash`.
- Cambiar la contraseña **no** revoca los celulares ya conectados (su
  token sigue siendo válido) — para cortar un celular está "Revocar", y
  para cortarlos todos "Desactivar acceso" (el sub-paso 5 revisa
  `users.active` en cada petición de sync). Fuera de alcance por ahora:
  que el dueño cambie su propia contraseña desde el panel.
- Verificado con el build contra la base local, logueado como dueño: crear
  acceso normaliza el usuario (`"  ZZ.Maria "` → `zz.maria`); segundo
  acceso para el mismo vendedor → 409; usuario repetido en otro vendedor →
  409; contraseña corta → 400; sin sesión → 401; cambiar contraseña deja un
  hash que valida la nueva y no la vieja; desactivar → `active: false`;
  un vendedor con usuario activo **no** puede entrar al panel; revocar con
  el id de otro vendedor → 404, revocar → 200, revocar de nuevo → 404; la
  página del vendedor muestra la tarjeta, el usuario, el celular y
  "Revocado". Datos de prueba borrados al terminar. `npm run test` (72) +
  `npm run test:db` (6) + `npm run lint` + `npm run build` en verde.
- **Sub-paso 5 (login del celular + token + permisos)**, solo web, sin
  migración nueva. Rutas públicas (fuera del `proxy.ts`, que solo cubre
  `/admin`): `POST /api/sync/login` (`{username, password, deviceName?}` →
  `201 {token, user: {username, name, role}, seller: {uuid, name} | null}`),
  `GET /api/sync/me` (valida el token y devuelve lo mismo sin token) y
  `POST /api/sync/logout` (revoca solo el token de ese celular). Tanto el
  dueño como los vendedores pueden entrar desde el celular. El celular
  nunca recibe `id` locales del servidor: se identifica al vendedor por
  `uuid`.
- `lib/sync/tokens.ts` (con test): token = 32 bytes aleatorios en
  base64url, enviado como `Authorization: Bearer`; el servidor guarda solo
  su SHA-256 (un hash simple basta porque el token es aleatorio y largo, a
  diferencia de una contraseña).
- `lib/sync/auth.ts#authenticateDevice`: en **cada** petición exige sesión
  no revocada + usuario activo + (dueño o vendedor con `sellers.active`), y
  actualiza `lastSeenAt` (lo que muestra "Última sincronización" en el
  panel). Así revocar un celular, desactivar el acceso o desactivar al
  vendedor en el panel corta la sync de inmediato, sin esperar a que el
  token expire (los tokens no expiran solos: el celular tiene que poder
  abrir y sincronizar después de semanas sin red).
- El login está expuesto en internet: mismo mensaje para usuario
  inexistente y contraseña incorrecta, `bcrypt.compare` contra un hash
  falso cuando el usuario no existe (mismo tiempo de respuesta), y freno de
  intentos `lib/domain/login-throttle.ts` (con test): 5 fallos en 15 min
  por usuario → `429` con `Retry-After`. En memoria a propósito (un solo
  proceso PM2; reiniciar olvida los contadores).
- `lib/domain/sync-permissions.ts` (con test) define el **catálogo de
  operaciones de push** que implementará el sub-paso 7
  (`SYNC_OPERATION_TYPES`: `upsertCategory`, `upsertProduct`, ...,
  `markSettlementSettled`) y `authorizeOperation`: el dueño puede todas; un
  vendedor solo `createSellerSale`/`createSellerReturn`/`createSellerLoss`
  y solo con su propio `sellerUuid`; un tipo desconocido se rechaza
  incluso al dueño. Si el sub-paso 7 necesita otra operación, se agrega
  aquí primero.
- Verificado con el build contra la base local: login de vendedor → 201
  con el `uuid` correcto de su vendedor y el hash guardado = SHA-256 del
  token; `me` con token → 200, sin token o con uno inventado → 401;
  contraseña incorrecta y usuario inexistente → mismo 401; vendedor
  desactivado → `me` y login 401, reactivado → 200; usuario desactivado →
  401; logout del celular 1 → su `me` 401 y el celular 2 sigue en 200; 6º
  intento tras 5 fallos → 429, sin afectar a otro usuario; login del dueño
  → 201 con `seller: null`. Datos de prueba borrados. `npm run test` (84)
  + `npm run test:db` (6) + `npm run lint` + `npm run build` en verde.
- **Sub-paso 6 (pull)**, solo web, sin migración nueva.
  `GET /api/sync/pull?since=<cursor>` → `{cursor, hasMore, changes:
  {tabla: filas[]}, tombstones: [{table, uuid}]}`. El celular arranca con
  `since=0` y repite con el `cursor` devuelto mientras `hasMore` sea
  `true`. Lógica en `lib/sync/pull.ts#pullChanges` (recibe un cliente `pg`
  ya dentro de la transacción); la ruta abre `BEGIN ISOLATION LEVEL
  REPEATABLE READ READ ONLY` sobre un cliente del pool (`db.$client`).
- **Formato de cada fila** — es el contrato que el sub-paso 11 del móvil
  va a consumir: claves = nombres de campo del Drizzle **del móvil**; sin
  `id` locales, cada llave foránea viaja como el `uuid` de la fila
  referida (`categoryUuid`, `productUuid`, `sellerUuid`, `saleUuid`,
  `accountUuid`, `settlementUuid`, ...); `cash_movements.source_id`
  (polimórfico) viaja como `sourceUuid` resuelto según `sourceType`
  (`direct_sale`/`settlement`/`purchase_payment`). Timestamps en UTC
  `"YYYY-MM-DD HH:MM:SS"` (lo mismo que guarda el SQLite del celular) y
  fechas `"YYYY-MM-DD"`. Columnas que solo existen en la web
  (`featured`, `whatsappText`, `color`, `stockUpdated`,
  `inventory_movements.unitCost`/`sourceId`...) no viajan. Cada tabla se
  declara una vez en `SPECS` (select + joins + filtro de vendedor).
- **Zona horaria**: los `timestamp` de la web no tienen zona y guardan la
  hora local de la sesión de Postgres (`now()`); el pull los interpreta en
  esa zona (`current_setting('TimeZone')`) y los pasa a UTC. Verificado
  con la base local (`America/Bogota`): una fila creada a las 00:43
  locales sale como 05:43, igual al UTC real. Supone que Node y Postgres
  escriben en la misma zona (cierto en local y en el VPS).
- **Páginas por versión**: el tope de cada página es la versión número 500
  pendiente entre las 22 tablas + lápidas (contada sin filtro de rol, así
  que la página de un vendedor puede traer menos filas, nunca saltarse
  ninguna).
- **Alcance del vendedor**: catálogo completo (categorías, productos,
  fotos) + solo lo suyo (su fila de `sellers`, su ledger `owner_type =
  'seller'`, sus entregas, ventas, devoluciones, pérdidas y
  liquidaciones, con sus items). Nada de caja, cuentas, ventas en local,
  distribuidores ni compras (esas tablas ni aparecen en `changes`). Costos
  de compra en `0` (`products.purchasePrice` y el `unitCost` de las
  entregas); el `unitCost` de sus pérdidas sí viaja, porque es lo que él
  debe. Recibe las lápidas de las tablas que ve.
- `npm run test:db` ahora corre todo archivo `*integration*` (antes solo
  `lib/db`). Test nuevo `lib/sync/pull.integration.test.ts`: referencias
  como `uuid` y sin `id`; con el cursor devuelto no trae nada más; por
  páginas de 5 cada fila llega exactamente una vez; el vendedor ve lo suyo
  y no lo del otro vendedor, sin caja/compras y con costos en 0; un borrado
  llega como lápida.
- Verificado con el build contra la base local: sync inicial completo como
  dueño → 94 filas, las 22 tablas cuadran exactamente con `count(*)` de la
  base y sin duplicados; un pull con el cursor final devuelve vacío;
  `since=-1` → 400, sin token → 401; como vendedor temporal (con su propia
  entrega) → catálogo completo, solo su ficha, su entrega y su movimiento,
  ninguna de las 5 ventas del otro vendedor, sin tablas de caja/compras y
  costos en 0. Datos de prueba borrados. `npm run test` (84) + `npm run
  test:db` (11) + `npm run lint` + `npm run build` en verde.
- **Sub-paso 7 (push)**, solo web, troceado en tres partes: (1) el
  mecanismo común, (2) las operaciones del vendedor (venta, devolución,
  pérdida), (3) las del dueño en tandas (catálogo; caja y ventas en local;
  entregas y liquidaciones; compras).
- **Parte 1 — mecanismo común** (migración `0022`, tabla
  `sync_applied_operations`: `op_id` uuid PK, sesión, usuario, tipo,
  `status` `applied`/`rejected`, `error`). `POST /api/sync/push` recibe
  `{operations: [{id, type, payload}]}` (1-100, `id` uuid generado en el
  celular, sin repetidos en el lote — `syncPushSchema`, con test) y
  responde siempre `200 {results: [{id, status, error?, duplicate?}]}` una
  vez que el sobre es válido. Lógica en `lib/sync/push.ts#applyOperations`:
  - cada operación en **su propia transacción**; lo primero que hace es
    reclamar su `id` en `sync_applied_operations` (`ON CONFLICT DO
    NOTHING`), así un reintento concurrente de la misma operación espera a
    que termine la primera y luego la encuentra registrada;
  - **idempotencia**: una operación ya registrada devuelve su primer
    resultado con `duplicate: true` y nunca se aplica dos veces;
  - **`rejected`** (definitivo, se registra y el celular lo muestra): tipo
    desconocido o prohibido para el rol, tipo sin handler todavía, payload
    que no pasa su esquema zod, `SyncRejection` lanzada por el handler, o
    error de Postgres de datos (clase `22`) o integridad (clase `23`,
    traducido a un mensaje legible). Lo que la operación alcanzó a escribir
    se deshace;
  - **`error`** (cualquier otra falla: bug, base caída): **no** se
    registra, se loguea en el servidor y el resto del lote queda
    `skipped`, porque las siguientes pueden depender de ella. El celular
    las reintenta después;
  - **permisos**: `authorizeOperation` por tipo antes de validar, y para un
    vendedor otra vez con el `sellerUuid` que el handler extrae del payload
    (debe ser el suyo).
- Cada operación se declara con `defineHandler({schema, sellerUuid?,
  apply(tx, payload, {principal})})` en el registro
  `lib/sync/operations/index.ts` (vacío en la parte 1). El `tx` es una
  transacción Drizzle.
- Test nuevo `lib/sync/push.integration.test.ts` con handlers de prueba:
  aplicar y reenviar sin duplicar; un rechazo deshace lo escrito y se
  recuerda; payload inválido, violación de unicidad, tipo desconocido y
  tipo sin handler → `rejected`; un vendedor aplica lo suyo y se le
  rechaza lo ajeno y lo del dueño; un error inesperado no se registra y
  deja el resto `skipped`. Verificado además contra el build: operación
  sin handler → `rejected` con mensaje claro, reenviada → mismo resultado
  con `duplicate: true`, sobre inválido → 400, sin token → 401.
  `npm run test` + `npm run test:db` (16) + `npm run lint` + `npm run
  build` en verde.
- **Parte 2 — operaciones del vendedor** (`lib/sync/operations/seller.ts`,
  sin migración). Payloads — el contrato que el celular arma en el
  sub-paso 10; toda fila viaja con el `uuid` que generó el celular, y las
  fechas en UTC `"YYYY-MM-DD HH:MM:SS"`:
  - `createSellerSale`: `{uuid, sellerUuid, saleDate, notes?, items:
    [{uuid, productUuid, quantity, unitPrice, movementUuid}]}`. El servidor
    calcula total y **comisión con la configuración actual del vendedor**
    (`calculateCommission` del dominio); el valor del celular se reemplaza
    en el siguiente pull.
  - `createSellerReturn`: `{uuid, sellerUuid, returnDate, notes?, items:
    [{uuid, productUuid, quantity, sellerMovementUuid,
    principalMovementUuid}]}` — descuenta al vendedor y regresa al
    principal (dos filas del mismo ledger + `products.stock`).
  - `createSellerLoss`: `{uuid, sellerUuid, type, lossDate, notes?, items:
    [{uuid, productUuid, quantity, unitCost?, movementUuid}]}`. El **costo
    lo pone el servidor** (`products.purchase_price`) cuando la envía un
    vendedor, porque su celular no conoce costos (el pull los manda en 0);
    si la envía el dueño, se respeta su `unitCost`.
- **No se reutilizan** `createSellerSale`/`Return`/`Loss` de
  `lib/db/queries/*` (las del panel): abren su propia transacción y son
  fail-fast. Los handlers de sync reusan el **dominio**
  (`calculateCommission`) y aceptan dejar el inventario del vendedor
  negativo (decisión del usuario: la venta ya ocurrió). El panel sigue
  siendo fail-fast porque opera en línea y en tiempo real.
- Utilidades compartidas en `lib/sync/operations/shared.ts`:
  `idByUuid` (resuelve un `uuid` a `id` local o rechaza con "X no existe
  en el servidor" — típico cuando dependía de otra operación rechazada),
  `fromUtc` (inversa de la conversión del pull: UTC del celular → hora
  local de la sesión de Postgres), `changePrincipalStock` y
  `recordSellerMovement` (nunca rechazan un saldo negativo). Los
  movimientos de inventario quedan con `created_at` = la fecha real de la
  operación (no la hora del push), para que el historial respete cuándo
  pasó cada cosa.
- Test nuevo `lib/sync/operations/seller.integration.test.ts` con el
  registro real: venta de 3 teniendo 2 → aplicada, saldo del vendedor
  `-1`, stock principal intacto, total `15000` y comisión `1500` (10%),
  filas con los `uuid` del celular, y **ida y vuelta**: el pull devuelve la
  venta con la misma hora UTC que mandó el celular; devolución → vendedor
  `-1`, principal `+1`; pérdida de un vendedor con `unitCost: 0` → se
  guarda `3000` (costo del servidor), del dueño con `1234` → `1234`; un
  producto inexistente rechaza la venta completa sin dejar nada escrito;
  fecha con formato ISO o cantidad `0` → rechazada. `npm run test` (86) +
  `npm run test:db` (21) + `npm run lint` + `npm run build` en verde.
- **Parte 3 — operaciones del dueño**, en cuatro tandas, cada una con su
  test de integración contra el registro real
  (`lib/sync/operations/*.integration.test.ts`). Payloads (contrato para
  el sub-paso 10 del celular):
  - **3a catálogo** (`catalog.ts`): `upsertCategory {uuid, name, slug,
    description?, active}`, `upsertProduct {uuid, name, slug,
    description?, price, purchasePrice, categoryUuid|null,
    distributorCode|null, minStock, warrantyMonths|null, active,
    images?: [{uuid, url, alt?, displayOrder, isPrimary}]}`,
    `upsertSeller`, `upsertDistributor`, `upsertCashAccount` (mismos
    campos que sus tablas). Crear o sobrescribir el registro completo por
    `uuid`; con dos ediciones del mismo registro **gana la que llega última
    al servidor** (un solo dueño edita el catálogo; comparar horas de
    edición habría exigido `updated_at` en cuatro tablas más y confiar en
    el reloj de cada celular). El servidor **asigna el SKU** de un producto
    nuevo (misma secuencia y prefijo que el panel) y **nunca toma el stock
    del celular**; los campos que solo tiene la web (`featured`,
    `whatsapp_text`, color de categoría) no se tocan al actualizar. `images`
    ausente = no tocar la galería; presente = galería completa (las filas
    que se quedan conservan su `uuid`, las quitadas dejan lápida); se
    rechaza una foto `file://` ("todavía no se ha subido") y una galería sin
    exactamente una principal.
  - **3b caja, ventas en local y ajustes** (`cash-sales.ts`):
    `createCashMovement {uuid, type, amount, concept, movementDate,
    accountUuid, notes?}` (manual); `createDirectSale {uuid, saleDate,
    accountUuid, notes?, cashMovementUuid, items: [{uuid, productUuid,
    quantity, unitPrice, movementUuid}]}` — descuenta stock aunque quede
    negativo y genera el ingreso con el mismo concepto que el panel
    (`Venta en local #<id del servidor>`); `createInventoryAdjustment
    {uuid, productUuid, quantityDelta ≠ 0, reason, occurredAt}` — exige
    motivo (`validateAdjustmentReason` del dominio).
  - **3c entregas y liquidaciones** (`deliveries-settlements.ts`):
    `createSellerDelivery {uuid, sellerUuid, deliveryDate, notes?, items:
    [{uuid, productUuid, quantity, unitCost, principalMovementUuid,
    sellerMovementUuid}]}`; `createSettlement {uuid, sellerUuid,
    periodDate}` — **el servidor calcula los totales** con sus propios
    datos (misma agregación que el panel) y marca las ventas incluidas;
    rechaza una segunda del mismo vendedor y día; `markSettlementSettled
    {settlementUuid, accountUuid, settledAt, cashMovementUuid}` — valida
    con `canTransitionSettlement` y genera el ingreso en caja.
  - **3d compras** (`purchases.ts`): `createPurchaseOrder {uuid,
    distributorUuid|null, purchaseType, orderDate, expectedDate|null,
    notes?, items: [{uuid, productUuid, quantity, unitCost}]}` (total
    calculado de los items); `transitionPurchaseOrder {purchaseOrderUuid,
    to, occurredAt, receivedMovements?: [{itemUuid, movementUuid}]}` —
    `canTransitionPurchaseOrder`, y recibir exige el movimiento de **todos**
    los items y marca `stock_updated` igual que el panel;
    `createPurchasePayment {uuid, purchaseOrderUuid, amount, paidAt,
    accountUuid, notes?, cashMovementUuid}` — **conserva las reglas del
    panel**: solo a crédito, no cancelado y **no más de lo pendiente**. Lo
    de "aceptar lo que ya pasó sin conexión" se decidió para el stock de
    productos, no para el dinero; este tope protege contra errores de
    digitación.
- `lib/sync/operations/index.test.ts` (unidad): el registro tiene
  exactamente un handler por cada tipo de `SYNC_OPERATION_TYPES`.
- Verificado de punta a punta por HTTP contra el build: login de vendedor
  → push de una venta de 2 teniendo 1 → `applied`; reenviar el mismo lote
  → `applied` + `duplicate` (una sola venta en la base); el pull la
  devuelve con el mismo `uuid`, la misma hora UTC y la comisión del
  servidor, y el saldo del vendedor sale `-1`. `npm run test` (87) +
  `npm run test:db` (37) + `npm run lint` + `npm run build` en verde.
- **Dos problemas que ya tenía la web, encontrados al portar las
  liquidaciones (no los introduce la sync, pero con varios celulares
  pesan más) — pendientes de decidir con el usuario:**
  1. **Zona horaria del día de liquidación**: la web agrupa ventas y
     pérdidas con `DATE(sale_date)` sobre la hora guardada por Postgres.
     Si el Postgres del VPS está en UTC, una venta a las 8 p. m. en
     Colombia cae en el día siguiente. Revisar `SHOW TimeZone` en el VPS
     antes del despliegue (sub-paso 15).
  2. **Ventas que llegan después de liquidar**: si el dueño liquida el día
     X antes de que el vendedor sincronice sus ventas de ese día, esas
     ventas quedan sin liquidar, y el `UNIQUE (seller_id, period_date)`
     impide una segunda liquidación de ese día para recogerlas.
- **Decisiones del usuario sobre esos dos puntos (sesión 2026-09-26):**
  1. Autoriza entrar al VPS en el despliegue (sub-paso 15) a revisar
     `SHOW TimeZone` y fijar la base de producción en `America/Bogota`
     (vacía, así que no afecta datos).
  2. **Resuelto**: una liquidación ahora cobra **todo lo pendiente del
     vendedor hasta su fecha** (ventas y pérdidas con fecha `<=
     periodDate` que ninguna liquidación anterior incluyó), no solo las
     del día. Lo que llega tarde entra en la siguiente liquidación. Para
     que las pérdidas no se cobraran en cada liquidación nueva, ganaron
     `settlement_id` igual que las ventas (web `0023`, móvil `0017`, las
     dos con relleno a mano que liga las pérdidas ya liquidadas con la
     regla vieja: mismo vendedor y mismo día). Web: `aggregatePeriod` y
     el nuevo `markIncludedInSettlement` en
     `lib/db/queries/settlements.ts` los usan **tanto el panel como el
     handler de sync** (antes el handler tenía una copia del SQL). Móvil:
     misma regla en `local/settlements-repo.ts`. El pull manda
     `settlementUuid` en `seller_losses`. Las dos pantallas de "nueva
     liquidación" explican la regla bajo la fecha. Tests: web (en
     `deliveries-settlements.integration.test.ts`) — venta de un día
     anterior incluida, venta posterior excluida, venta y pérdida tardías
     cobradas en la siguiente liquidación sin repetir nada; móvil (nuevo
     `local/settlements-repo.test.ts`) — lo mismo sobre SQLite más el
     relleno de `0017`. Web `npm run test` + `npm run test:db` (38) +
     `lint` + `build` en verde; móvil `npm run test` (83) + `tsc` en verde
     (lint: el error preexistente de siempre). **Verificado en vivo en el
     celular del usuario**: `0017` corrió sin fallos y "Liquidar" funcionó
     con la regla nueva (todo lo pendiente hasta la fecha).
  - Nota: el móvil agrupa por `DATE(saleDate)` sobre su texto en UTC (el
    día UTC, no el de Colombia) — solo afecta la vista previa local de
    una liquidación hecha de noche; el total real lo calcula el servidor
    al sincronizar (sub-paso 7), así que se deja así.
- **Sub-paso 8**, solo web, sin migración. Dos piezas independientes:
  - **Alerta de stock negativo**: `lib/db/queries/inventory.ts#getNegativeStock`
    (activos con `stock < 0`) + tarjeta nueva en `/admin` (solo se muestra
    si hay al menos uno — decisión del usuario: "que aparezca como
    tarjeta", no solo un color en la tabla), roja, con la lista de
    productos afectados (no solo un número, porque el siguiente paso del
    dueño siempre es "ir a corregir estos") y un link a Inventario; cada
    producto enlaza a su edición. La tabla de `/admin/products` también
    resalta en rojo el stock `<= 0` (antes solo `=== 0`) con la etiqueta
    "(negativo)".
  - **Subida de fotos con token**: `lib/sync/upload.ts#saveProductImage`
    saca la lógica que ya tenía `/api/admin/upload` (validar tipo/tamaño,
    convertir a WebP con sharp) a una función compartida, para que las dos
    rutas guarden el archivo exactamente igual. Ruta nueva
    `POST /api/sync/upload`, con `authenticateDevice` en vez de la sesión
    de NextAuth — **solo el dueño** puede subir (los vendedores nunca
    editan el catálogo). Sin esto, `upsertProduct` (sub-paso 7, parte 3a)
    rechazaría cualquier foto nueva del celular por venir como `file://`.
- Verificado con el build contra la base local: producto con stock -3 → la
  tarjeta aparece en `/admin` con su nombre; login del celular + subir una
  imagen real → `201` con una URL `.webp` que sí existe en disco; sin token
  → `401`; como vendedor → `403`. `npx tsc --noEmit` + `npm run lint` +
  `npm run test` (87) + `npm run test:db` (38) + `npm run build` en verde.
  Datos de prueba borrados.
- **Sub-paso 9 (login del celular)**, solo móvil. Nuevas dependencias:
  `expo-secure-store` (token, sensible) y se reutiliza `expo-device` (ya
  instalado) para el nombre del celular que ve el dueño en el panel.
- `lib/sync/config.ts#SYNC_BASE_URL`: único lugar donde vive la URL del
  servidor (producción por default; se cambia ahí mismo para probar contra
  un servidor de desarrollo, sin variables de entorno nuevas).
- `lib/sync/api.ts`: `loginRequest`/`logoutRequest` (nunca lanzan por un
  error de red — sin conexión es el caso esperado, no un bug) y
  `extractErrorMessage` (con test), el mismo parseo de los dos formatos de
  error del servidor que ya usa el panel web en `SellerAccessCard.tsx`.
- `lib/sync/session.ts`: store `subscribe`/`getSnapshot` (mismo patrón que
  `theme-preference.ts`) con `login`/`logout`. El token y los datos del
  usuario/vendedor se guardan con `expo-secure-store` (`getItem`/`setItem`
  síncronos — sin caveat de `requireAuthentication`, que este proyecto no
  usa). `shouldWipeOnLogin(hasLoggedInBefore)` (con test) es la única
  regla pura: borra **solo la primera vez que el celular inicia sesión**,
  nunca en logins posteriores (ej. tras cerrar sesión) — el marcador
  vive en `expo-sqlite/kv-store` (no sensible), separado del token, para
  que sobreviva un logout.
- **Revisión posterior (verificación en celulares reales, sesión
  2026-10-02)**: la versión original de `wipeLocalDatabase` pedía cerrar y
  volver a abrir la app tras el primer login — `sqliteDb.closeAsync()`
  dejaba la conexión módulo de `lib/data/local/db.ts` sin forma de
  "reabrirse" en caliente. Se cambió a `wipeAllTables()`
  (`lib/data/local/db.ts`): borra las filas de todas las tablas en la
  MISMA conexión ya abierta (sin tocar el archivo ni la conexión), así que
  no hay nada que remontar y el primer login ya no pide reiniciar — pasa
  directo a los tabs y el primer pull llena la base enseguida. `closeDb`/
  `reopenDb` (también en `db.ts`) se quedan como el mecanismo que sí
  necesita un reinicio en caliente (vía `generation`/`dbStore`, que
  `app/_layout.tsx` usa para remontar y correr las migraciones de nuevo) —
  lo sigue usando solo `more/backup.tsx#performImport`, que de verdad
  reemplaza el archivo `.db` completo.
- `components/login-screen.tsx` (componente, no ruta — mismo criterio que
  `app-tabs.tsx`) se muestra en vez de los tabs mientras no haya sesión;
  `app/_layout.tsx` decide cuál mostrar con `useSyncSession()`
  (`hooks/use-sync-session.ts`, envuelve `useSyncExternalStore`). Sin
  distinción de rol todavía (dueño y vendedor ven el mismo login y, tras
  entrar, los mismos tabs) — eso es el sub-paso 14.
- `more/settings.tsx` gana una sección "Cuenta" (nombre, usuario, rol) con
  "Cerrar sesión" (confirmación con `Alert`, mismo patrón que "Importar
  respaldo").
- **Prueba native-incompatible en Vitest**: `session.test.ts` solo puede
  probar `shouldWipeOnLogin` — importar `session.ts` sin mockear arrastra
  `expo-secure-store`, `expo-sqlite/kv-store` y, vía `reset-local-db.ts`,
  el propio `expo-sqlite` (código con sintaxis Flow que Vitest no puede
  parsear). Se resolvió con `vi.mock` de los tres módulos nativos, mismo
  patrón que ya usaba `local/products-repo.test.ts` para `./db`.
- Verificado: `npm run test` (89) + `npx tsc --noEmit` en verde; `npm run
  lint` con el mismo error preexistente de `use-color-scheme.web.ts`.
  **Pendiente probar en el celular del usuario**: login con usuario y
  contraseña reales contra la web ya desplegada localmente (o cuando esté
  en producción), primer login → mensaje de reiniciar → tras reabrir, base
  vacía y ya autenticado sin volver a pedir login; cerrar sesión y volver
  a entrar → esta vez **sin** borrar nada.
- **Sub-paso 10 (cola `sync_outbox`)**, solo móvil. Tabla nueva
  `sync_outbox` (`0018`): `opId` (uuid propio, generado aquí — no es un
  `syncUuid()` porque esta tabla nunca es una fila que el servidor guarde,
  describe operaciones, no datos), `type`, `payload` (JSON en texto),
  `createdAt`. **Sin columna de estado a propósito**: una fila en la cola
  ES lo pendiente; el sub-paso 11 la borra al recibir `applied` o
  `rejected` del servidor, y la deja para reintentar si la respuesta es
  `error`. `lib/sync/operation-types.ts#SYNC_OPERATION_TYPES` es una copia
  exacta de la lista del servidor (repos separados, no hay código
  compartido) — 17 tipos.
- `lib/sync/outbox.ts#enqueueOperation(dbOrTx, type, payload)` — se llama
  **dentro de la misma transacción Drizzle** que el cambio local que
  describe, así los dos siempre viven o mueren juntos. `payload` no se
  valida aquí (cada repo lo construye a mano calcando el esquema zod del
  handler correspondiente, documentado en la sección del sub-paso 7).
- **Se tocaron los 15 repos de `lib/data/local/*` que escriben algo**
  (los únicos de solo lectura — `reports-repo.ts` y los métodos
  `list`/`getBalance`/etc. de los demás — no cambiaron). Cada `create`/
  `update`/`deactivate`/transición ahora: (1) hace su escritura igual que
  antes, (2) resuelve el o los `uuid` que el payload necesita (de la fila
  recién escrita, vía `.returning()` sin consulta extra; de una fila
  referenciada, con un `SELECT ... WHERE id = ?` liviano si no se había
  cargado ya), (3) llama `enqueueOperation` con el mismo `tx`. Los que
  antes no usaban transacción (`categories-repo`, `sellers-repo`,
  `distributors-repo`, `cash-accounts-repo`, `products.deactivate`) ahora
  la usan, porque el encolado tiene que ser atómico con el cambio.
- `recordProductMovement`/`recordSellerMovement` (`inventory-repo.ts`)
  ahora devuelven también `productUuid`, `movementUuid` y
  `movementCreatedAt` (la hora **realmente guardada** en el movimiento,
  no una recalculada en JS, para que el historial no tenga un
  micro-desfase con lo que ve el servidor) — casi gratis, porque estas
  funciones ya cargaban esas filas para el fail-fast de siempre.
  `recordCashMovementTx` (`cash-repo.ts`) devuelve el `uuid` de la fila
  junto al `CashMovement` público (que no lo lleva).
- **`upsertProduct` nunca manda `images`** todavía: una foto recién
  elegida sigue siendo una ruta `file://` de este teléfono, y el `push`
  del servidor la rechaza de plano ("todavía no se ha subido"). El
  catálogo (nombre, precio, categoría, etc.) sí sincroniza ya; las fotos
  sincronizan cuando el sub-paso 13 suba el archivo y encole un
  `upsertProduct` de seguimiento con las URLs reales.
- **Dos bugs reales del servidor, encontrados al construir el payload
  exacto que cada operación necesita** (no bugs introducidos por esta
  sesión, preexistentes desde el sub-paso 7 parte 3, sin cobertura de
  prueba que los agarrara porque los tests de ahí siempre mandaban el
  campo): `createDirectSale.cashMovementUuid` y
  `markSettlementSettled.cashMovementUuid` eran **obligatorios** en el
  esquema zod, pero el handler solo inserta el movimiento de caja si el
  monto es mayor a 0 — una venta gratis (todos los items en $0) o una
  liquidación con saldo $0 habrían quedado imposibles de sincronizar
  desde el celular. Corregido en la web: los dos campos pasan a
  `.optional()`, con un rechazo explícito si el monto es mayor a 0 y el
  campo no llegó (para que un cliente con el bug real, no el caso
  legítimo de monto 0, siga fallando con un mensaje claro). Tests nuevos
  en `cash-sales.integration.test.ts` y
  `deliveries-settlements.integration.test.ts`.
- Test nuevo `lib/data/local/outbox-wiring.test.ts`: ejercita los 15 repos
  reales contra SQLite migrado y revisa la cola resultante — cada
  operación con el `type` correcto, las referencias resueltas a `uuid`
  real (no al id local), `sku`/`stock`/`images` ausentes de `upsertProduct`,
  sin `cashMovementUuid` en una venta gratis, `receivedMovements` con un
  ítem por cada línea recibida, y el conteo final de la cola coincide con
  las 20 operaciones hechas en la prueba. `lib/sync/outbox.test.ts` cubre
  el mecanismo en aislado (opId único, funciona dentro de una transacción
  ajena).
- Verificado: móvil `npm run test` (101) + `npx tsc --noEmit` en verde
  (`npm run lint`: el mismo error preexistente de siempre); web `npm run
  test` (87) + `npm run test:db` (40) + `npm run lint` + `npm run build`
  en verde tras los dos arreglos. **No verificado todavía en el celular
  del usuario** — no hay nada visible que probar aún (la cola no se
  muestra en ninguna pantalla; eso llega con el indicador de pendientes
  del sub-paso 12), así que la verificación real es que el flujo normal
  de la app (crear un producto, una venta, etc.) sigue funcionando igual
  que antes, sin errores nuevos en pantalla.
- **Sub-paso 11 (motor de sync)**, solo móvil. Migración `0019`: tabla
  `sync_rejections` (`opId`, `type`, `payload`, `error`, `createdAt`) —
  a diferencia de `sync_outbox`, esta sí guarda estado: es donde vive una
  operación rechazada hasta que el dueño la descarta, cumpliendo lo que
  pedía el plan ("operaciones rechazadas visibles").
- **Push** (`lib/sync/push-engine.ts#pushPendingOperations`): manda la
  cola en lotes de 100 (el tope del propio servidor) a `POST
  /api/sync/push`. Por resultado: `applied`/`rejected` → se borra de
  `sync_outbox` (un rechazo además queda en `sync_rejections` con el
  mensaje tal cual lo mandó el servidor, ya en español); `error`/`skipped`
  → se deja todo lo demás del lote sin tocar (las operaciones siguientes
  pueden depender de la que falló) para reintentar en la próxima
  sincronización. Un fallo de red no lanza excepción — se refleja como
  `summary.error`, y `pendingAfter` deja claro cuánto sigue en la cola.
- **Pull** (`lib/sync/pull-engine.ts#pullServerChanges` +
  `lib/sync/pull-apply.ts#applyPullPage`): repite `GET
  /api/sync/pull?since=<cursor>` mientras `hasMore` sea `true`. Cada
  página se aplica en **su propia transacción** y el cursor
  (`lib/sync/cursor.ts`, en `expo-sqlite/kv-store`, no sensible) solo
  avanza **después** de que esa transacción confirma — si la app se cierra
  a mitad de una sincronización larga, la próxima vez retoma esa misma
  página en vez de saltársela.
- **`applyPullPage` upsertea por `uuid`, nunca por `id`**: cada fila que
  llega hace `INSERT ... ON CONFLICT (uuid) DO UPDATE` (Drizzle
  `onConflictDoUpdate`), y toma **todos** los campos que manda el
  servidor tal cual — incluido `products.stock`, que en este dispositivo
  ya era solo provisional desde que se fue sin conexión. Las referencias
  (`categoryUuid`, `productUuid`, `sellerUuid`, `accountUuid`,
  `saleUuid`, `settlementUuid`, `sourceUuid`...) se resuelven a un `id`
  local con un `SELECT ... WHERE uuid = ?` liviano contra la misma
  transacción — barato a esta escala, mismo criterio que ya usa el
  servidor (`idByUuid`). Las 22 tablas se aplican en un **orden propio,
  distinto al orden de paginación del servidor** (que es por versión, no
  por dependencias): padres antes que hijos, y `cash_movements` al final
  porque su `sourceUuid` puede apuntar a `direct_sales`, `settlements` o
  `purchase_payments`, las tres ya resueltas para entonces. Las lápidas se
  aplican al final de la página (un `DELETE ... WHERE uuid = ?` genérico);
  borrar una fila que este dispositivo nunca tuvo no hace nada.
- **`lib/sync/engine.ts#runSync`**: push y **siempre en ese orden** pull
  (nunca al revés — el pull tiene que ver ya reflejado lo que este
  dispositivo acaba de mandar). Sin sesión, no toca la red. Dos llamadas
  a la vez comparten la misma corrida en curso en vez de pisarse (un
  `Promise` compartido mientras hay una activa), para que tocar
  "Sincronizar ahora" dos veces rápido no lea/borre la cola dos veces a
  la vez.
- **UI mínima para poder probar esto a mano** (no es el sub-paso 12
  todavía, que es el que trae los disparadores automáticos y el badge de
  pendientes pulido): en Más → Configuración, botón "Sincronizar ahora"
  con su resultado en una línea, y — solo si hay alguna — la lista de
  operaciones rechazadas con un botón "Descartar" por fila.
- Tests: `pull-apply.test.ts` (cadena completa de dependencias en una
  sola página + lápida + actualización idempotente + una referencia a un
  `uuid` inexistente rechaza la página); `push-engine.test.ts` (aplicada
  y rechazada se resuelven, un `error` detiene el resto del lote, sin
  conexión no revienta, un `duplicate` también resuelve); `pull-engine.test.ts`
  (dos páginas con `hasMore`, el cursor persiste, un fallo de red no
  avanza el cursor); `engine.test.ts` (sin sesión no llama a la red, push
  siempre antes que pull, dos llamadas simultáneas comparten la corrida).
- **Verificación de punta a punta contra el servidor real** (no solo
  mocks): se apuntó `SYNC_BASE_URL` a `http://localhost:3100` de forma
  temporal, se levantó el build de la web local, y un test desechable
  hizo: login real como dueño → pull inicial sin errores → crear una
  categoría local (la encola) → push real, `applied > 0` y `rejected ===
  0`, cola vacía → un "segundo dispositivo" simulado (base local vacía,
  mismo token) hizo pull y recibió esa misma categoría con el nombre
  correcto. Confirma que los nombres de campo de `pull-apply.ts` calcan
  los reales del servidor, no solo lo que yo creía que mandaba. Datos y
  sesión de prueba borrados del servidor al terminar; `config.ts` y el
  test desechable revertidos — no queda rastro en el repo.
- Verificado: `npm run test` (114) + `npx tsc --noEmit` en verde (`npm
  run lint`: el mismo error preexistente de siempre). **No verificado
  todavía en el celular real del usuario** — sí contra un servidor real,
  pero desde una base SQLite de prueba en Node, no desde la app instalada.
- **Sub-paso 12 (disparadores automáticos + indicador)**, solo móvil.
  Dependencia nueva `@react-native-community/netinfo` (sin plugin de
  config — no tocó `app.json`).
- `lib/sync/triggers.ts` (con test): la única lógica de decisión que vale
  la pena probar aislada de React Native. `withinThrottle` — un disparador
  **automático** no repite si ya corrió uno hace menos de 30 s (el botón
  manual nunca se frena, el usuario lo pidió a propósito).
  `shouldRunOnConnectivityChange` — dispara solo en la transición de sin
  internet a con internet, nunca en cada evento "sigue conectado" que
  vuelve a emitir NetInfo.
- `hooks/use-auto-sync.ts` (montado una vez en `app/_layout.tsx`, sin
  test — es puro cableado de `AppState`/`NetInfo`, mismo criterio que el
  resto del proyecto con código nativo): al arrancar en frío (cubre
  "abrir la app" con una sesión ya guardada), al volver a primer plano, y
  al recuperar internet — nunca con la app cerrada. `runSync()` ya no
  hace nada sin sesión, así que el hook no necesita revisarlo antes de
  llamarlo.
- **Indicador de pendientes**: `lib/sync/pending.ts#pendingStore` (con
  test) — un conteo en memoria, sin mecanismo reactivo propio sobre
  `sync_outbox` (sería tener que tocar los 15 repos otra vez solo para
  notificar un contador); se refresca donde ya importa: al final de
  `runSync` (éxito o error — un rechazo también saca una operación de la
  cola) y al enfocar la pantalla de Configuración. Ahí mismo se agregó
  "N pendiente(s) · última sincronización: hace X" (con
  `lib/format.ts#formatRelativeTime`, ya existente) encima del botón
  "Sincronizar ahora" de la Fase 10 anterior — el mismo botón sigue
  ahí, ya no como único disparador sino como el manual junto a los tres
  automáticos.
- Verificado: `npm run test` (120) + `npx tsc --noEmit` en verde (`npm
  run lint`: el mismo error preexistente). **No verificado todavía en el
  celular del usuario** — los disparadores automáticos dependen de
  `AppState`/`NetInfo` reales, que no corren en Node; hace falta abrir la
  app, cambiar de tab y volver, y probar con el WiFi para confirmarlos en
  vivo. Además la sync real contra producción sigue bloqueada hasta el
  despliegue (sub-paso 15).
- **Sub-paso 13 (fotos + números provisionales)**, solo móvil.
- **Fotos, encoladas junto con el catálogo, no aparte**: `upsertProduct`
  (sub-paso 10) ya decidía si el catálogo sincronizaba de una o esperaba
  — esta sesión completó esa decisión en vez de agregar un mecanismo
  nuevo. `products-repo.ts#toUpsertPayload` se volvió
  `buildUpsertProductPayload` (exportada) y ahora **siempre** relee la
  galería actual del producto: si algún `url` sigue siendo `file:` (una
  foto recién elegida, todavía no subida), el mensaje sale sin `images`
  (igual que antes); si no queda ninguna local, sale con la galería
  completa — incluida una **vacía** (`images: []`) para un producto
  creado sin fotos, que antes se omitía sin necesidad. Efecto real: quitar
  una foto ya subida, o reordenar la galería, ahora sincroniza de
  inmediato en vez de esperar sin motivo a que el sub-paso 13 "hiciera
  algo" — no hacía falta esperar, solo hacía falta esta función.
- **Qué hace falta para que una foto deje de estar "atascada"**:
  `lib/sync/photo-upload.ts#uploadPendingProductPhotos`, llamada por
  `engine.ts` **antes** del push. Busca en `product_images` cualquier
  `url` que empiece por `file:`, la sube con
  `File(uri).upload(...)` (API nueva de `expo-file-system`, con
  `UploadType.MULTIPART` y el MIME inferido de la extensión — mismo
  patrón ya usado en `images.ts`/`more/backup.tsx` para todo lo demás de
  archivos), guarda la ruta relativa que devuelve el servidor
  (`/uploads/products/x.webp`, tal cual, sin volverla absoluta) y, **solo
  cuando las fotos de un producto quedaron todas subidas**, encola un
  `upsertProduct` de seguimiento llamando a la misma
  `buildUpsertProductPayload` — sin duplicar la lógica de qué va en el
  mensaje. Va producto por producto: si una foto falla, ese producto se
  detiene ahí (lo ya subido queda subido, nada se repite) pero los demás
  productos siguen su curso; el error queda visible en el resultado de
  `runSync` (`photoUploadError`) sin frenar el push/pull de todo lo demás.
- **Por qué la URL vive igual en los dos lados, sin conversión**: el
  `url` de una foto sincronizada se guarda tal cual lo manda o lo recibe
  el servidor — una ruta relativa, `/uploads/products/x.webp` — tanto al
  subir como al recibir por `pull` (`pull-apply.ts` ya lo hacía así desde
  el sub-paso 11, sin cambios). La única conversión ocurre al **mostrar**
  la foto: `lib/sync/image-url.ts#resolveImageUri` (con test) le agrega
  el dominio del servidor a una ruta relativa, y deja intacta una que ya
  sea absoluta o una `file:` local. Los 5 lugares que pintan una foto de
  producto (`more/products/index.tsx`, `sell/index.tsx` ×2,
  `home/index.tsx`, `components/product-image-gallery.tsx`) pasan ahora
  por esta función antes de dársela a `<Image>`.
- **"Con caché" no fue código nuevo**: `expo-image` (ya en uso en las
  cinco pantallas de arriba, sin `cachePolicy` explícito en ninguna) cachea
  en disco por defecto (`cachePolicy: 'disk'`, confirmado en su propio
  tipo). En cuanto una foto pasa a ser una URL remota, `expo-image` ya la
  guarda localmente sola la primera vez que se muestra — es lo que hace
  que se vea sin conexión después. No hubo que construir nada para esto.
- **SKU provisional**: `Product` (interfaz pública, `lib/data/products-repo.ts`)
  gana el campo `uuid` — hacía falta exponerlo para poder cruzarlo contra
  la cola. `lib/sync/outbox.ts#pendingUuidsForType(type)` (con test)
  agrupa los `uuid` con una operación de ese tipo aún en `sync_outbox`. La
  lista de productos y el detalle/edición muestran "(pendiente)" /
  "(pendiente de confirmar al sincronizar)" junto al SKU cuando el `uuid`
  del producto aparece en `pendingUuidsForType('upsertProduct')` — deja
  de aparecer solo (sin ningún flag que limpiar a mano) en cuanto la
  operación se resuelve, porque en ese momento ya no está en la cola.
- **"Números provisionales" se acotó a lo que realmente cambia al
  sincronizar — decisión propia, no preguntada, documentada para no
  repreguntarla**: el SKU es el único identificador que el servidor
  **reasigna de verdad** (lo genera él, nunca lo manda el celular — sub-paso
  7, parte 3a) y que alguien podría escribir en una etiqueta de precio antes
  de tiempo. Los "Venta #7"/"Pedido #3" que muestran otras pantallas
  (`sell/history.tsx`, `sellers/sales`, `purchases`, etc.) son el `id`
  local de SQLite — un número que **nunca** viaja al servidor ni vuelve
  por el `pull` (la fila de `direct_sales`/`seller_sales`/etc. no manda
  ningún número de vuelta, solo su `uuid`), así que no hay nada que
  "confirmar" ahí: ese número siempre fue solo una etiqueta de este
  teléfono, no una promesa de que coincida con la de otro. Extender la
  misma alerta a esas pantallas es un cambio de UI mucho más amplio para
  un beneficio menor (confusión cosmética entre teléfonos, no un dato mal
  sincronizado) — queda fuera de esta sesión, sin construir.
- Tests nuevos: `photo-upload.test.ts` (sube cada foto pendiente y encola
  el seguimiento con la galería completa; nada pendiente no llama a la
  red; una foto que falla detiene solo ese producto y conserva lo ya
  subido); `image-url.test.ts`; ampliación de `outbox.test.ts` para
  `pendingUuidsForType`; `engine.test.ts` cubre que las fotos van antes
  del push y que un error de fotos no detiene push/pull.
  `outbox-wiring.test.ts` se actualizó: un producto sin fotos ahora
  espera `images: []` en el mensaje, no su ausencia.
- Verificado: `npm run test` (128) + `npx tsc --noEmit` en verde (`npm
  run lint`: el mismo error preexistente). **No verificado todavía en el
  celular del usuario** — `File.upload()` contra un servidor real y el
  cacheo de `expo-image` en la práctica son cosas que solo se confirman
  ahí; typecheck/tests no lo garantizan (mismo tipo de limitación ya
  documentada para otras piezas de `expo-file-system` en este proyecto).
- **Sub-paso 14 (navegación por rol)**, solo móvil. `hooks/use-my-seller.ts`
  (`useMySeller()` → `{isSeller, seller, loading}`) resuelve el vendedor de la
  sesión por `uuid` (`SellersRepo.getByUuid`, nuevo — los ids locales son de
  cada celular); `seller` es `null` hasta el primer pull.
  - **Tabs**: `app-tabs.tsx` oculta Inicio y Buscar (`hidden`, que además los
    hace inalcanzables) para un vendedor: solo ve **Vender** y **Más**. Esas
    dos pantallas leen datos de todo el negocio que su pull nunca trae.
  - **Vender**: `sell/index.tsx` se partió en `SellScreen` (elige por rol),
    `OwnerSellScreen` (el POS de siempre, sin cambios) y `SellerSellScreen`
    (venta de consignación con su propio inventario). El formulario se sacó de
    `more/sellers/sales/new.tsx` a `components/seller-sale-form.tsx`
    (`onSaved` distingue: el modal del dueño hace `router.back()`, el tab del
    vendedor remonta el formulario con una `key` para dejarlo listo para la
    siguiente venta). Ahora recarga con `useFocusEffect`, no solo al montar.
  - **Más** (vendedor): "Mi inventario" (→ `more/sellers/[id]` de su propio
    id, que para ese rol oculta el formulario de edición, comisión,
    "Liquidar" y "Desactivar" y conserva Registrar venta/devolución/pérdida),
    "Mis liquidaciones" (su pull solo trae las suyas; el detalle oculta
    "Marcar como liquidada" — solo el dueño liquida) y Configuración.
  - **Respaldo**: con sesión activa (siempre, la app exige login) "Importar"
    se reemplaza por un texto: sustituir el archivo dejaría el cursor y la cola
    de sync apuntando a datos que ya no existen. Exportar sigue igual.
  - **Límite honesto**: esto es navegación, no seguridad. Lo que protege de
    verdad al dueño es el servidor (el pull no manda caja/compras a un
    vendedor y el push rechaza operaciones fuera de su rol). No verificado en
    el celular: si `hidden` en `NativeTabs` deja bien elegido el tab inicial
    (Vender) para un vendedor; typecheck/tests no lo garantizan.
- Verificado: `npm run test` (128) + `npx tsc --noEmit` en verde (`npm run
  lint`: el mismo error preexistente).
- **Sub-paso 15 — en curso (sesión 2026-10-02): desplegado el servidor,
  primera ronda de pruebas con dos celulares reales (dueño + vendedor1
  contra producción).** Progreso: `git push` de los dos repos; en el VPS,
  `git pull` + `npm ci` + `npm run build` + `pm2 restart` (las migraciones
  corren solas al reiniciar, vía `instrumentation.ts`); zona horaria de
  Postgres fijada a `America/Bogota`. **Dos problemas reales encontrados
  al probar, ninguno del motor de sync en sí:**
  1. **Bug de despliegue (no de código, de cómo Next.js lee `.env.local`)**:
     al rotar `ADMIN_PASSWORD_HASH` del VPS y reiniciar, el login del
     dueño empezó a fallar. Causa: `@next/env` (el cargador de variables
     de Next, en build y en `next start`) expande `$NOMBRE` dentro de un
     valor como si fuera una referencia a otra variable — un hash de
     bcrypt como `$2b$12$Zx00…/y` se lee como tres referencias
     indefinidas que se vacían, y solo sobrevive el `/y` final. El archivo
     en disco queda intacto (se ve bien con `cat`); el bug es silencioso y
     el login falla con el mismo mensaje genérico de siempre. Corrección:
     escapar cada `$` como `\$` en `.env.local` (ya aplicado en el VPS y en
     el `.env.local` local) + un `UPDATE users SET password_hash = …` a
     mano para la fila que ya se había sembrado rota (`ownerSeedFromEnv`
     no resiembra si ya existe un dueño). Documentado también en el
     `CLAUDE.md` del repo web, sección "Despliegue a producción", con la
     advertencia de escapar cualquier secreto futuro que pueda tener `$`.
  2. **Bug de dominio real, encontrado al crear un producto con stock
     inicial y entregárselo a un vendedor**: el servidor terminó con
     `products.stock = -5` en vez de `5` (debía ser 10 inicial − 5
     entregados). Causa: `products-repo.ts#create` escribía el stock
     inicial como un campo suelto, sin ningún movimiento de
     `inventory_movements` que lo respalde — funcionaba bien mientras el
     dispositivo era la única fuente de verdad (Fases 1-9), pero
     `upsertProduct` (sub-paso 7, parte 3a) **nunca toma el stock del
     celular por diseño** (el servidor solo lo deriva de movimientos
     reales), así que el producto nace en el servidor con stock 0 sin
     importar lo que se haya escrito en el formulario — y la entrega
     posterior descuenta de ese 0, no del 10 que el celular creía tener.
     **Corregido** (con la aprobación del usuario sobre dos alternativas
     presentadas): si el formulario de creación lleva un stock inicial
     mayor a 0, `create()` inserta el producto con stock 0 y de inmediato
     registra un movimiento `ajuste`/"Stock inicial" vía
     `recordProductMovement` (mismo camino que un ajuste manual), que sí
     encola `createInventoryAdjustment` — el servidor lo acepta porque es
     un movimiento real, no un campo. El `upsertProduct` se sigue
     encolando primero (sin tocar `stock`, igual que siempre); el ajuste
     va justo después en la misma transacción, así que el producto ya
     existe en el servidor cuando el ajuste intenta resolver su
     `productUuid`. Test nuevo en `outbox-wiring.test.ts` (crear con
     `stock: 7` → dos operaciones encoladas, `upsertProduct` sin `stock` +
     `createInventoryAdjustment` con `quantityDelta: 7` y motivo "Stock
     inicial"). Los dos productos de prueba ya sembrados rotos en
     producción (`Rana`, `Gato`, ambos en `-5`) se corrigen igual, a mano,
     desde el celular del dueño: un ajuste de `+10` en cada uno vía
     Inventario → Ajustar (no se tocó la base de producción directo, para
     no reintroducir el mismo problema de un número sin ledger real
     detrás) — pendiente de que el usuario lo haga y confirme que quedan
     en `5`.
  - Aparte, se confirmó que el resto del ciclo sí funciona de punta a
    punta en producción real: `createSellerDelivery` llegó, se aplicó, y
    el pull del vendedor reflejó correctamente su inventario consignado
    (5 unidades) — el único número mal era el de `products.stock`, por el
    bug de arriba, no el ledger del vendedor.
  - Verificado: `npm run test` (129) + `npx tsc --noEmit` en verde (`npm
    run lint`: el mismo error preexistente).
  - **Bug de tooling encontrado al recargar la app tras el fix de arriba**:
    Metro avisó `Require cycle: products-repo.ts -> inventory-repo.ts ->
    products-repo.ts` — `products-repo.ts` importaba `recordProductMovement`
    de `inventory-repo.ts`, que a su vez importa `productColumns`/
    `toProduct` de `products-repo.ts`. Funcionaba (las dos llamadas están
    dentro de funciones, no al cargar el módulo), pero no se dejó así.
    Corregido sacando `recordProductMovement`/`recordSellerMovement` a un
    archivo nuevo sin dependencias hacia ninguno de los dos,
    `local/stock-movements.ts` — los 7 repos que los usaban (incluido
    `inventory-repo.ts`) ahora importan directo de ahí. Verificado con
    `npm run test` (129) + `npx tsc --noEmit` en verde.

**Checklist pendiente para continuar la verificación de la Fase 10**
(pensado para retomarse desde cualquier PC con este repo clonado — no
depende de ninguna conversación anterior):

1. **Corregir los dos productos de prueba ya sembrados mal en
   producción** (`Rana` y `Gato`, ambos en `-5`): desde el celular del
   dueño, Más → Inventario → abrir cada uno → Ajustar → `+10`, motivo
   libre (ej. "Corrección de prueba") → sincronizar. Deben quedar en `5`
   cada uno (10 inicial − 5 entregados). **El código ya está corregido**
   (ver nota de arriba) — este paso es solo para arreglar los datos que
   ya habían quedado mal con el código viejo; un producto nuevo creado
   con stock inicial ya no tiene este problema.
2. Con eso confirmado, seguir el resto del checklist de "Fase 10 —
   Sincronización": un segundo vendedor, una venta sin conexión (modo
   avión en el celular del vendedor, vender, reconectar, confirmar que
   sincroniza), forzar una venta que deje el inventario del vendedor en
   negativo y confirmar que **no** se bloquea (se acepta, por diseño) y
   que aparece la tarjeta roja de stock negativo en `/admin` de la web.
   Confirmar también una liquidación completa (vendedor con ventas +
   pérdidas pendientes → liquidar → sube el saldo de la cuenta elegida).
3. Acceso a producción: `https://icvariedades.com` (panel web) +
   `ssh mivps` para el servidor (detalles de despliegue en el `CLAUDE.md`
   del repo hermano `variedades-ic`, sección "Despliegue a producción
   (VPS)"). Para revisar el estado del servidor sin tocar nada: `ssh
   mivps` y consultar la base con `psql "$(grep -oP
   "(?<=DATABASE_URL=).*" /var/www/variedades-ic/.env.local)"`.
4. Si algo no sincroniza como se espera, el primer diagnóstico es
   siempre: ¿llegó la operación al servidor? (`SELECT * FROM
   sync_applied_operations ORDER BY created_at DESC LIMIT 20` en la base
   de producción) — si no aparece ahí ni como `applied` ni como
   `rejected`, el problema está en que el celular nunca la envió (revisar
   "Sincronizar ahora" en Más → Configuración de ese celular), no en el
   servidor.

**Bug real encontrado durante el checklist (sesión 2026-10-03), ya
corregido**: al liquidar, "Marcar como liquidada" no hacía nada —
`accountId` seguía en `null` porque el picker de cuentas (Efectivo/
Transferencia) aparecía vacío en el celular del dueño. Causa, nada que
ver con la pantalla de liquidación en sí: las `cash_accounts` del
servidor (con `sync_version` 1 y 2, de las más bajas de todo el sistema)
nunca habían llegado a ese dispositivo. El cursor de sync
(`lib/sync/cursor.ts`, en `expo-sqlite/kv-store`) **sobrevivía** al
borrado del primer login (`wipeAllTables()` solo limpia las tablas de
Drizzle, nunca toca kv-store) — si ese celular ya había hecho cualquier
sync antes (aunque fuera parcial, contra otro servidor, o de una sesión
de pruebas previa), su cursor quedó en un número alto, y el pull
siguiente arrancaba desde ahí, saltándose de entrada cualquier fila de
versión menor. No es exclusivo de `cash_accounts` — le puede pasar a
cualquier tabla, en cualquier dispositivo que borre sus datos locales
(primer login, o importar un respaldo) después de haber sincronizado
antes.
- **Corregido**: `cursor.ts#resetCursor()` (nuevo) se llama ahora en los
  dos puntos donde los datos locales se reemplazan por completo —
  `session.ts#login` (el wipe del primer login) y
  `more/backup.tsx#performImport` (importar un respaldo) — así el
  siguiente pull siempre arranca desde cero cuando corresponde, en vez de
  confiar en un cursor que puede ser viejo.
- **Herramienta de rescate agregada**, para este caso y cualquier futuro
  parecido sin tener que cerrar sesión: botón "Forzar resincronización
  completa" en Más → Configuración, debajo de "Sincronizar ahora" —
  llama `resetCursor()` + `runSync()`. No destructivo (el pull hace
  upsert por `uuid`, nunca duplica lo que ya está), solo puede tardar más
  por traer todo de nuevo. Usado para corregir el celular del dueño en
  esta misma sesión.
- Test nuevo `cursor.test.ts` (`resetCursor` vuelve el cursor a 0 sin
  importar en qué quedó) + `session.test.ts` (el primer login llama a
  `resetCursor` exactamente una vez). Verificado con `npm run test`
  (131/131) + `npx tsc --noEmit` en verde (`npm run lint`: el mismo error
  preexistente).

**Segundo bug real encontrado en la misma liquidación (sesión
2026-10-03), ya corregido**: una vez arregladas las cuentas, "Marcar
como liquidada" sí llamaba al servidor, pero este la rechazaba con
"Fecha con formato inválido". Causa: `settlements-repo.ts#markSettled`
armaba `settledAt` con `new Date().toISOString()`
(`"2026-10-03T16:30:00.000Z"`), y el esquema del servidor
(`utcTimestamp`) exige el mismo formato que ya usa el resto de la sync,
`"YYYY-MM-DD HH:MM:SS"` (el que SQLite escribe solo en sus columnas
`createdAt`). La distinción exacta: cualquier timestamp que viene de una
columna `createdAt` (con default `CURRENT_TIMESTAMP`) ya tenía el
formato correcto sin querer — el bug solo afecta a los campos armados a
mano en JS con `new Date()` para mandarlos directo en un payload de
sync, que antes de la Fase 10 solo se guardaban en columnas `updatedAt`
de uso puramente local (nunca viajaban, por eso nunca se notó).
- Se encontró un **segundo sitio con el mismo patrón, todavía sin
  disparar** (nadie había probado una transición de pedido de compra con
  sync activo): las tres transiciones de `purchase-orders-repo.ts`
  (`markInTransit`/`markReceived`/`cancel`) arman `occurredAt` a partir
  de `row.updatedAt`, escrito con el mismo `new Date().toISOString()` —
  mismo bug en potencia, corregido a la vez.
- **Corrección**: `lib/format.ts#toSqliteUtcTimestamp(date)` (nueva, con
  test) — inversa de `parseSqliteDate` ya existente, formatea un `Date`
  exactamente como SQLite escribe sus columnas `createdAt`. Los cuatro
  sitios afectados (`markSettled`'s `settledAt` + las tres transiciones
  de `purchase-orders-repo.ts`) la usan ahora en vez de
  `new Date().toISOString()` — el resto de los `updatedAt: new
  Date().toISOString()` del proyecto (categorías, productos, vendedores,
  distribuidores, cuentas) no se tocaron porque esos nunca viajan en un
  payload de sync, no tenían el bug.
- `outbox-wiring.test.ts` gana una aserción de formato (regex
  `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/`) en `settledAt` y en el
  `occurredAt` de `markInTransit`, para que este tipo de regresión no
  vuelva a pasar desapercibido.
- Verificado: `npm run test` (133/133) + `npx tsc --noEmit` en verde
  (`npm run lint`: el mismo error preexistente).
- **Hallazgo al pedirle al usuario que reintentara**: ya no se podía —
  el intento fallido (antes del fix) ya había consumido su `opId` como
  `rejected` y, encima, la liquidación local ya había pasado a estado
  `"liquidada"` en el celular (el guardado local siempre ocurre aunque
  el push después falle), así que la pantalla ya no mostraba ni el
  selector de cuenta ni el botón — no había ninguna forma de volver a
  intentarlo desde la UI normal. Mismo problema le pasaría a cualquier
  operación rechazada por un bug que se corrige después.
- **Corregido con una herramienta general, no un parche puntual**:
  `push-engine.ts#retryRejection(id)` (nuevo) reencola el payload de un
  rechazo bajo un `opId` nuevo — pero antes le aplica
  `fixKnownTimestampBug`, que busca campos de texto con la forma exacta
  `"...T...Z"` (el bug de arriba) y los reescribe con
  `toSqliteUtcTimestamp`; cualquier otro campo, o un rechazo por un
  motivo real distinto, vuelve intacto y fallará de nuevo igual (no es
  un "arregla cualquier cosa"). Botón "Reintentar" nuevo en Más →
  Configuración, junto a "Descartar" en la lista de rechazos — sincroniza
  de una vez al tocarlo. Usado para corregir la liquidación atascada del
  celular del dueño en esta misma sesión.
- Test nuevo en `push-engine.test.ts`: corrige un `settledAt` con forma
  ISO y lo reencola con un `opId` distinto al original, quitando el
  rechazo; un campo que no tiene esa forma exacta (`periodDate`, un
  mensaje de error cualquiera) vuelve sin tocar.
- Verificado: `npm run test` (135/135) + `npx tsc --noEmit` en verde
  (`npm run lint`: el mismo error preexistente).
- **El usuario ya había descartado el rechazo antes de ver el botón
  "Reintentar"** — sin la fila en `sync_rejections`, ese botón ya no
  tenía nada que reencolar. "Sincronizar ahora" tampoco hacía nada: la
  liquidación ya estaba `"liquidada"` localmente (ese guardado ocurre
  siempre, incluso si el push después falla) y no quedaba ninguna
  operación pendiente en la cola para esa liquidación en absoluto.
- **Corregido con una tercera herramienta de recuperación, más
  específica**: `SettlementsRepo#resyncSettled(id)` (nuevo) reconstruye
  el mensaje `markSettlementSettled` desde los datos que YA existen en
  el dispositivo (la propia liquidación, el movimiento de caja que
  `markSettled` ya había insertado localmente con `sourceType:
  'settlement'`, y la cuenta de ese movimiento) y lo reencola bajo un
  `opId` nuevo — corrige de paso el `settledAt` guardado si todavía
  tiene la forma `"...T...Z"` vieja. Botón nuevo en la pantalla de
  detalle de la liquidación ("¿No se refleja en la web? Reenviar
  sincronización"), visible solo cuando el estado ya es `"liquidada"` —
  reenviar una que el servidor ya tiene es inofensivo, se rechaza limpio
  (sin transición válida de `liquidada` a `liquidada`).
- Dos tests nuevos en `settlements-repo.test.ts`: reencola con los
  mismos datos tras borrar a mano la operación original de la cola
  (simulando el rechazo ya descartado); falla con un mensaje claro si la
  liquidación todavía no está en estado `liquidada`.
- Verificado: `npm run test` (137/137) + `npx tsc --noEmit` en verde
  (`npm run lint`: el mismo error preexistente). **Pendiente**: que el
  usuario, desde el celular del dueño, recargue la app, abra la
  liquidación (ya "liquidada" localmente) y toque "Reenviar
  sincronización", luego "Sincronizar ahora" en Configuración — y
  confirme que el saldo de "Efectivo" sube $55.000 en el servidor.

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
