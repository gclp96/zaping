# DEV-NEXT-03A — Local Core QA preparation

Baseline inspeccionado: `b36d237fae73e44d7e1c03c03a99ad4dc6a0dc5a` (2026-09-06).
Enablement DEV-NEXT-03A1 verificado: 2026-09-07.
Este documento prepara DEV-NEXT-03B; no certifica ejecución manual ni aceptación funcional.
Todos los casos manuales permanecen **NOT RUN**. DEV-NEXT-03A1 sólo habilitó y verificó técnicamente el entorno QA aislado, sus fixtures y autenticación local.

## A. Branch / preflight

- Preflight original: `main`, working tree limpio, HEAD igual a `origin/main` y al baseline indicado.
- Rama creada desde ese baseline: `qa/erp-core-v1-local-acceptance`.
- HEAD y `origin/main` siguen en el baseline.
- Cambios acotados de 03A1: harness Docker/fixtures QA, logout frontend, pruebas y este documento. Sin commit/push/deploy.

## B. Local startup procedure

### Inventario observado

| Componente | Estado / contrato |
| --- | --- |
| Host | Node 24.16.0 / npm 11.13.0: no cumple el contrato del proyecto |
| Proyecto | `.nvmrc`: 24.20.0; API/Web: Node >=24.20.0 <25.0.0, npm 11.19.0 |
| Docker | Disponible; imagen local `node:24.20.0-bookworm-slim` verificada con Node 24.20.0 / npm 11.19.0 |
| PostgreSQL QA | Proyecto Compose `zaping-local-qa`, volumen propio, `127.0.0.1:5433`, healthy; no comparte DB/volumen con `zaping-postgres` |
| API QA | `http://127.0.0.1:3001`; `/health/live` y `/health/ready` verificados HTTP 200 |
| Web QA | `http://127.0.0.1:3000`; `/login` verificado HTTP 200 |
| Base de datos | `zaping_qa`; 25 migraciones existentes aplicadas con `prisma migrate deploy` |

API y Web ejecutan Node 24.20.0 / npm 11.19.0 desde la imagen local fijada. NVM/NVM for Windows no se encontró en PATH ni en sus ubicaciones habituales; si se instala después, el usuario puede usar `nvm install 24.20.0` y `nvm use 24.20.0`, pero 03A1 no cambió el host. No usar el scaffold raíz como frontend: las aplicaciones son `app/api` y `web`.

### Variables (sin valores de secrets)

| Variable | Uso local / estado |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` | Sólo `.qa/postgres.env`; generadas localmente y no versionadas |
| `NODE_ENV` | `development` explícito en `.qa/api.env` y `.qa/web.env` |
| `QA_ENABLE` | Guard explícito `local-only`; requerido por herramientas mutantes |
| `DATABASE_URL` | Sólo `.qa/api.env`; apunta por red privada Compose al usuario y DB `zaping_qa` |
| `JWT_SECRET` | Aleatorio local >=32 caracteres, sólo `.qa/api.env` |
| `QA_PASSWORD` | Password común sintético de fixtures, sólo `.qa/api.env`; no imprimir ni versionar |
| `PORT`, `TRUST_PROXY_HOPS` | 3001 y 0 para QA local |
| `FRONTEND_ORIGIN`, `FRONTEND_BASE_URL` | http://127.0.0.1:3000 para QA local |
| `RESEND_API_KEY`, `EMAIL_FROM` | Opcionales en development/test; omitir aquí; envío real fuera de scope |
| `NEXT_PUBLIC_API_URL` | Web QA: http://127.0.0.1:3001; producción exige URL HTTPS explícita |

Los valores reales viven exclusivamente bajo `.qa/`, ignorado por Git. No se alteraron los `.env` normales. Resend queda omitido en development. La API conserva su validación fail-closed.

### Procedimiento habilitado y verificado

Requiere Docker Desktop Linux containers. Todo el runtime usa `node:24.20.0-bookworm-slim`; el checkout se monta read-only y API/Web trabajan en volúmenes Compose aislados. PostgreSQL QA publica sólo en loopback 5433 y no toca el contenedor/volumen normal de desarrollo.

Inicialización única de secrets sintéticos (aborta si ya existen y nunca muestra valores):

```powershell
Set-Location C:\dev\zaping
docker run --rm --pull=never --mount type=bind,source=C:\dev\zaping,target=/repo -w /repo node:24.20.0-bookworm-slim node scripts/qa/init.cjs
```

Arranque diario, una sola terminal:

```powershell
docker compose -f docker-compose.qa.yml up -d
docker compose -f docker-compose.qa.yml ps
```

Preparación inicial o restauración controlada de fixtures, siempre explícita y nunca automática en startup:

```powershell
docker compose -f docker-compose.qa.yml exec -T api node /qa-tools/migrate.cjs
docker compose -f docker-compose.qa.yml exec -T api node /qa-tools/seed.cjs
docker compose -f docker-compose.qa.yml exec -T api node /qa-tools/tokens.cjs --restore-auth
```

`migrate.cjs`, `seed.cjs` y `tokens.cjs` abortan salvo NODE_ENV development/test, `QA_ENABLE=local-only`, hostname local/servicio Compose, puerto 5432/5433, usuario `zaping_qa`, pathname exacto `/zaping_qa`, password presente y QA_PASSWORD suficiente. Además consultan `current_database()`/`current_user`; seed aborta si encuentra una company ajena a sus dos fixtures y no borra registros.

URLs: Web `http://127.0.0.1:3000`; API `http://127.0.0.1:3001`; live `http://127.0.0.1:3001/health/live`; readiness `http://127.0.0.1:3001/health/ready`. Las tres fueron verificadas. Usar exactamente 127.0.0.1: un servidor Node preexistente del host escucha `::`:3000 y puede capturar `localhost` por IPv6; no fue detenido. GET `/` no es health.

Logs opcionales y parada preservando datos:

```powershell
docker compose -f docker-compose.qa.yml logs -f api web
docker compose -f docker-compose.qa.yml down
```

No usar `down -v` salvo decisión explícita de recrear exclusivamente los volúmenes del proyecto `zaping-local-qa`. No usar migrate reset/dev, db push ni el Compose normal para esta matriz.

## C. QA data readiness

Fixtures sintéticas creadas sólo en `zaping_qa`. El seed determinista usa UUIDs estables, una transacción atómica inicial y es idempotente de forma conservadora: si ambas companies ya existen, preserva el trabajo manual; nunca borra datos. La verificación confirmó relaciones internas de cada tenant.

| Recurso | Company A | Company B |
| --- | --- | --- |
| Identificación | Zaping QA Company A | Zaping QA Company B |
| Usuarios activos | ADMIN 1, MANAGER 1, SALES 1, WAREHOUSE 1 | ADMIN 1 |
| Categorías / productos | 1 / 3 (normal, low, ASSET) | 1 / 3 (normal, low, ASSET) |
| Customers / suppliers | 1 / 1 | 1 / 1 |
| Purchases / receipts | DRAFT + PARTIALLY_RECEIVED / 1 | DRAFT + PARTIALLY_RECEIVED / 1 |
| Quotes / sales | DRAFT + CONFIRMED / DRAFT | DRAFT + CONFIRMED / DRAFT |
| Equipment | GOOD + INSPECTION_PENDING | GOOD + INSPECTION_PENDING |

Emails QA:

- `admin.a@qa.example.test` — ADMIN A
- `manager.a@qa.example.test` — MANAGER A
- `sales.a@qa.example.test` — SALES A
- `warehouse.a@qa.example.test` — WAREHOUSE A
- `admin.b@qa.example.test` — ADMIN B

La password común se consulta localmente como `QA_PASSWORD` en `.qa/api.env`; no copiarla al documento, tickets, capturas o logs. Los cinco logins y roles fueron comprobados contra API sin imprimir JWTs. El smoke restauró la password base de todas las cuentas e incrementó authVersion para invalidar tokens temporales.

Los IDs exactos se consultan en `.qa/fixtures.json`, generado localmente y Git-ignored. Los códigos visibles empiezan con `QA-A-` o `QA-B-`. Reset tokens raw viven sólo en `.qa/reset-tokens.local.json`. Ambos archivos pueden regenerarse con los comandos de B y no son secretos reales, pero se manejan como privados para no normalizar fugas de credenciales/tokens.

## D. Actual role permission matrix

Fuente: controllers y `@Roles`, `RolesGuard`, `web/app/erp-role-access.ts`, navegación y páginas. A=ADMIN, M=MANAGER, S=SALES, W=WAREHOUSE. V=view, C=create, E=edit, D=delete/deactivate, X=special action, —=NO ACCESS. Las acciones dependen además del estado y tenant; V no implica permiso de escritura.

| Módulo | ADMIN | MANAGER | SALES | WAREHOUSE | Particularidad |
| --- | --- | --- | --- | --- | --- |
| Home | V | V | V | V | Landing UI, consultas/atajos por rol |
| Dashboard | V | V | V | V | GET dashboard admite todos; ver discrepancias E |
| Users | V C E D | — | — | — | D=desactivar vía PATCH; no DELETE |
| Customers | V C E D | V C E D | V C E D | — | Desactivación |
| Suppliers | V C E D | V C E D | — | V | W sólo lectura |
| Products | V C E D | V C E D | V | V | Desactivación; tracking no editable |
| Categories | V C E D | V C E D | V | V | DELETE real sólo sin productos relacionados |
| Inventory | V X | V X | V | V X | S sólo Existencias; Movimientos A/M/W; escrituras sólo API; W no ADJUSTMENT |
| Purchases | V C E X | V C E X | — | V C E X | W recibe, no confirma/cancela |
| Purchase Receipts | V C | V C | — | V C | Sin edit/delete; cierre compra automático |
| Quotes | V C X | V C X | V C X | — | Confirmar/cancelar/convertir; sin edit/delete genérico |
| Sales | V C X | V C X | V C X | — | Confirmar/cancelar; sin edit/delete genérico |
| Equipment | V C X | V C X | — | V C X | Inspeccionar/retirar; sin edit/delete genérico |

Todos pueden cambiar su propia contraseña. RolesGuard usa metadata handler/class; ausencia de metadata no impone roles por sí sola. Los módulos core examinados usan JWT y los roles indicados. La estrategia JWT consulta el usuario actual, actividad y authVersion en DB. No hay CRUD general de Companies en el controller vacío. Healthcare queda fuera de este bloque.

## E. Route matrix / discrepancies

| Ruta Web | Visible y admitida con sesión | Rol denegado | Acceso directo |
| --- | --- | --- | --- |
| `/home`, `/dashboard`, `/change-password` | A M S W | Ninguno | Preservar ruta solicitada |
| `/products`, `/categories`, `/inventory` | A M S W | Ninguno | S/W catálogos read-only |
| `/users` | A | M S W | ForbiddenState; API 403 |
| `/customers`, `/quotes`, `/sales` | A M S | W | ForbiddenState; API 403 |
| `/suppliers` | A M W | S | ForbiddenState; API 403 |
| `/purchases`, `/purchases/[id]` | A M W | S | Gate por rol; ownership en API |
| `/purchase-receipts` | A M W | S | ForbiddenState; API 403 |
| `/purchase-receipts/[id]` | A M W | S | S llega a fetch; API 403 y alerta genérica con retry |
| `/equipment` | A M W | S | ForbiddenState; API 403 |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Públicas | N/A | No requieren sesión |

Las rutas de detalle no son entradas independientes del sidebar. Customers/products/etc. usan modales donde corresponde: no inventar páginas `/:id`. Quotes no ofrece GET API `/:id`; detalle proviene de la lista y PDF. Purchase legacy query `purchaseId` se normaliza al detalle; sales `saleId` y equipment `assetId` abren su detalle en la página. Inventory admite referencia a recepción para filtros.

Sin token, cualquier ruta protegida pasa por AppShell y redirige a `/login`, sin montar children ni emitir sus requests prematuramente. Login correcto usa `/home`, no `/dashboard`; no hay garantía de restaurar una deep link tras login. Una página Next con ForbiddenState no tiene necesariamente HTTP 403 para su HTML: verificar separadamente UI y API.

Discrepancias observadas por código, pendientes de reproducción:

- **P2 UX:** Dashboard hace GET `/sales` también para W: backend devuelve 403, muestra ventas no disponibles y mantiene sesión. KPIs enlazan compras para S y cotizaciones para W, que después deniegan acceso.
- **P2 UX:** detalle de recepción no tiene el mismo gate de rol que su lista; S obtiene error genérico/retry en vez de ForbiddenState específico. No expone el recurso por ese hecho.
- **P2 accesibilidad potencial:** drawer implementa Escape/focus inicial/restauración/scroll lock, pero no se encontró trampa de Tab como la del componente Modal.
- **Logout resuelto en 03A1:** Sidebar desktop/drawer ofrece `Cerrar sesión` a todos los roles, elimina token y caché, retira inmediatamente el contenido protegido y usa `router.replace('/login')`. Pruebas automatizadas cubren los cuatro roles, drawer móvil y una request anterior que resuelve después del logout. Su QA visual permanece NOT RUN.
- No se confirmó bypass de autorización en esta revisión focal. Cualquier reproducción de autorización incorrecta o acceso cross-tenant se clasifica **P1/HIGH como mínimo**, aunque el botón estuviera oculto.

### QA-005 — SALES podía consultar Inventory Movements

- Hallazgo manual: SALES veía `Inventario -> Movimientos` y el ledger seguía cargando después de Ctrl+F5.
- Causa: `GET /inventory/movements` incluía SALES en `@Roles(...)`, mientras la página siempre mostraba la pestaña y solicitaba el ledger sin consultar el rol autenticado.
- Corrección implementada: el backend limita la lectura del ledger a ADMIN/MANAGER/WAREHOUSE y conserva las restricciones vigentes de sus mutaciones; el frontend mantiene Existencias para SALES, oculta Movimientos, evita su request y normaliza deep links de Movimientos a `/inventory`.
- Estado: **FIX IMPLEMENTED / MANUAL RETEST REQUIRED**. No marcar PASS hasta completar la nueva prueba manual en navegador.

## F. Action matrix

| Acción / contrato | Roles | Condición / efecto esperado |
| --- | --- | --- |
| Users crear/editar/activar/desactivar, POST/PATCH `/users` | A | No desactivar propio usuario; no eliminar último ADMIN activo; sin editar password aquí |
| Customers CRUD; suppliers CRUD | A M S; A M | DELETE desactiva; W lee suppliers |
| Products/categories crear/editar | A M | S/W sin botones de gestión; categorías permiten actividad; tracking producto inmutable |
| Categories eliminar | A M | Hard delete sólo fixture sin productos; relación existente rechaza |
| Inventory POST `/inventory/movements` IN/OUT | A M W | API-only; sin botón de alta en UI Inventory |
| Inventory ADJUSTMENT | A M | Cantidad es stock objetivo, no delta; W=403 |
| Purchases crear/editar | A M W | Edición sólo DRAFT; W tiene control de edición fuera del menú management |
| Purchases approve/cancel | A M | Confirmar DRAFT no mueve stock; cancelar sólo DRAFT; no DELETE |
| Recepción POST `/purchase-receipts` | A M W | Compra CONFIRMED/PARTIALLY_RECEIVED, Idempotency-Key obligatorio; mismo payload/key no duplica; distinto payload/key reutilizado=409 |
| Completar compra | A M W mediante recepción | Automático al recibir todo; no botón/endpoint separado de complete |
| Quotes crear/approve/cancel | A M S | DRAFT para aprobar/cancelar; no edición genérica |
| Convertir quote POST `/sales/from-quote/:quoteId` | A M S | Confirmada, no convertida; venta confirmada y OUT; no duplicar efectos |
| Sales crear/approve/cancel | A M S | DRAFT al crear; confirmar descuenta stock; cancelar sólo DRAFT |
| Equipment crear/inspeccionar/retirar | A M W | Producto ASSET; inspección/retiro sólo ACTIVE; retiro no reversible por UI ni decrementa stock |
| Password POST `/auth/change-password` | A M S W | Propio usuario; éxito termina sesión local e invalida JWT anterior mediante authVersion |

Lecturas PDF deben respetar rol y tenant igual que datos JSON. Pruebas API-only se ejecutarán con cliente local autorizado y tokens sólo en memoria; no añadir endpoints/UI para facilitar QA. No confundir disponibilidad de acción con permiso de ejecutarla sobre cualquier estado o company.

## G. 401 / 403 contract

Responsables: `web/services/api.ts`, `web/app/auth-session.ts`, `web/app/components/AppShell.tsx` y gates de páginas.

- Token de sesión existente se guarda en localStorage; esto es distinto del reset token, que sólo vive en memoria.
- Token ausente: gate evita `/auth/me` y children, luego `/login`.
- API 401: interceptor elimina token; `/auth/me` deja que AppShell redirija; otras peticiones dirigen a login, evitando repetir si ya está allí.
- API 403: no borra token ni hace logout. Páginas suelen mostrar ForbiddenState/error. Un 403 de bootstrap se trata como error de verificación con retry, sin habilitar children.
- Network/5xx durante bootstrap: conserva sesión, bloquea children, muestra retry. Recuperación no debe navegar a otra ruta protegida distinta de la solicitada.
- Credenciales inválidas no deben navegar al ERP. Un 429 no es 401: no diagnosticar rate limit como credenciales inválidas.

## H. Tenant isolation plan

Usar perfiles de navegador separados por cuenta, identificando A/B sin copiar tokens a documentación. Antes de cada ataque, demostrar que el propietario sí ve el recurso; comparar listas, detalle, stock, movimientos y estado antes/después. Usar ADMIN de ambas compañías para evitar que un 403 de rol enmascare ownership.

1. Listados A excluyen B y viceversa, incluidos dashboard/inventory y PDFs.
2. Abrir IDs conocidos ajenos en API detalle y rutas Web existentes. Lo normal para lookup scoped es 404; nunca contenido ajeno. Quotes se comprueba mediante lista/PDF, no endpoint inexistente.
3. PATCH/DELETE ajenos sólo sobre fixtures descartables aprobadas. Exigir rechazo y ausencia de efectos, no únicamente un status. No ejecutar DELETE en datos comerciales existentes.
4. Acciones operativas ajenas: aprobar/cancelar compra o venta, recibir compra, convertir quote, inspeccionar/retirar equipo. Deben fallar sin stock/ledger/documentos nuevos.
5. Relaciones cruzadas: customer B en quote/sale A, supplier B en purchase A, product/batch B en movimiento/recepción/equipo A. Según validación el rechazo puede ser 400/404; no tratar cualquier 400 como prueba suficiente: verificar invariantes.
6. Inyectar `companyId` en payload DTO no permitido debe rechazarse por whitelist/forbidNonWhitelisted, no cambiar tenant. Nunca sustituir el JWT por uno de B y llamar eso aislamiento A.

Detener inmediatamente la rama afectada ante lectura ajena, mutación inesperada o stock/ledger corrupto. Guardar evidencia sanitizada, no continuar pruebas destructivas. La matriz bidireccional completa queda pendiente de fixtures B y credenciales.

## I. Responsive matrix

| Viewport | Énfasis |
| --- | --- |
| 1440x900 | Sidebar desktop expandido/colapsado; headers y tablas |
| 1280x720 | Límite xl: sidebar desktop, altura reducida de modales |
| 1279x720 | Justo debajo de xl: drawer/header mobile |
| 768x1024 | Tablet, columnas terciarias md, forms/modales |
| 390x844 | Mobile, sólo columnas prioritarias, menús y scroll |

Complementar 639/640 y 767/768 al revisar columnas: DataTable usa secondary `sm` y tertiary `md`; shell desktop usa `xl`. Verificar overflow horizontal contenido en tabla, no pérdida de acciones; estado vacío/error/loading, títulos largos, foco visible, botones alcanzables, menú no cortado, cierre Escape y foco restaurado. Modal contiene lógica de focus trap y scroll: validar, no asumir PASS. Drawer requiere especial atención al Tab. Repetir navegación restringida con S y W, no sólo ADMIN.

## J. Authentication test scope

Login correcto/incorrecto, ausencia/invalidación/expiración de token, logout, cambio de contraseña sólo de cuenta QA y forgot genérico forman parte del plan. El smoke local verificó los cinco logins, roles, login incorrecto 401, token ausente/inválido/expirado 401, SALES en `/users` 403 con sesión todavía válida y cambio de password con invalidación del JWT anterior. Restauró después la password fixture. Esto es enablement técnico, no ejecución de la matriz manual.

Reset captura query token en memoria y ejecuta `router.replace('/reset-password')`. Refresh/missing pasa a invalid-link. Éxito limpia token/passwords; inválido/expirado elimina token; same-password y network/5xx lo conservan para retry. POST contiene sólo `{ token, newPassword }`.

**REAL RESEND FLOW = DEFERRED.** No se creó transport falso ni endpoint de debug. `tokens.cjs` reproduce exactamente token raw aleatorio de 32 bytes en base64url y hash SHA-256 hex, guarda sólo los raw en `.qa/reset-tokens.local.json` y crea variantes válida, expirada y usada en la DB QA. El smoke verificó expirado/usado 400, same-password 400 conservando token, válido 201, reutilizado 400, JWT anterior 401 y login con password nueva; luego restauró credenciales y regeneró tokens. La ejecución manual sigue NOT RUN.

Planificar límites por IP: login 10/60s; register 5/60min; forgot 5/15min; reset 10/15min; change-password 5/15min. No cambiar rate limits ni reiniciar para ocultar fallos.

### DEV-NEXT-03A1 automated enablement evidence

Todo se ejecutó con Node 24.20.0 / npm 11.19.0 en Docker:

- Guard QA: 14/14 pruebas; URLs/hosts/users/DB/flags inseguros rechazados e identidad DB comprobada.
- Seed repetido una vez: sin duplicados; roles, recursos y relaciones tenant volvieron a verificar.
- API auth smoke: A ADMIN/MANAGER/SALES/WAREHOUSE y B ADMIN login 201 con rol correcto; `/auth/me` 200; credenciales incorrectas y tokens ausente/inválido/expirado 401; SALES `/users` 403 seguido de `/auth/me` 200; change-password/reset completos y restauración final.
- API quality: lint no mutante PASS; typecheck PASS; 65 suites / 676 tests PASS; build PASS.
- Web focal: AppShell/logout 16/16 PASS.
- Web quality: lint PASS; typecheck PASS; 57 files / 680 tests PASS; build production PASS con `NEXT_PUBLIC_API_URL=https://api.example.test`.
- Seguridad: `.qa/` ignorado; escaneo de valores exactos confirmó que DB URL, JWT, password y tres reset tokens no aparecen fuera de `.qa/`.

El primer intento focal se lanzó mientras `npm ci` del reinicio aún trabajaba y `npx` intentó resolver una versión externa; fue interrumpido antes de instalarla. Los quality gates efectivos usaron después `./node_modules/.bin/vitest` 4.1.10 fijado por el lockfile. El startup exige que `/app` sea un mount aislado, elimina allí sólo artefactos/copia anteriores (preserva `node_modules`), copia el checkout read-only y reutiliza dependencias únicamente cuando el hash de package+lock coincide.

## K. Executable manual QA cases

Convenciones: Q=fixtures descartables previamente autorizadas; API=cliente local autorizado, no cambios de código. Registrar resultado real después con evidencia sanitizada y ID de defecto. Prioridad indica impacto si falla, no un fallo confirmado. Casos parametrizados se registran una vez por rol/recurso indicado, sin marcar PASS global por ejecutar sólo uno.

### ADMIN

| ID | Role | Module | Precondition | Steps | Expected Result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | ADMIN | Login/Home | Runtime ready, cuenta A usable | Login válido; observar URL y requests | /home, sesión actual, sin /dashboard intermedio | P1 | NOT RUN |
| A02 | ADMIN | Navigation | Sesión A | Recorrer rutas de E, refrescar detalle permitido | Todas las entradas ADMIN; conserva ruta; sin flash protegido | P1 | NOT RUN |
| A03 | ADMIN | Users | Usuarios Q, no último admin real | Crear rol explícito; editar rol; desactivar/reactivar Q | Cambios persistentes; cuenta inactiva no autentica | P1 | NOT RUN |
| A04 | ADMIN | Users safeguards | Company Q aislada | Intentar autodesactivar y degradar último ADMIN activo vía API | Rechazo; sigue existiendo admin activo; no lockout | P1 | NOT RUN |
| A05 | ADMIN | Catalog | Categoría/producto Q | Crear, editar, desactivar producto; eliminar categoría libre y otra relacionada | Persistencia; DELETE relacionado rechazado; stock no alterado por catálogo | P1 | NOT RUN |
| A06 | ADMIN | Customers/Suppliers | Registros Q | Crear, editar y desactivar uno de cada tipo | Datos del tenant; desactivación sin afectar ajenos | P1 | NOT RUN |
| A07 | ADMIN | Purchases | Supplier/product Q | Crear DRAFT; editar; confirmar; intentar editar/cancelar confirmado | Confirmación sin IN; sólo DRAFT editable/cancelable | P1 | NOT RUN |
| A08 | ADMIN | Receipts | Compra Q confirmada con pendientes | Recibir parcial; luego resto; revisar inventario | PARTIALLY_RECEIVED -> RECEIVED; IN exacto; trazabilidad de recepción | P1 | NOT RUN |
| A09 | ADMIN | Inventory | Producto Q, stock conocido | API IN, OUT, ADJUSTMENT; intentar OUT mayor a stock | Deltas exactos; ajuste fija stock; insuficiente rechazado sin efectos | P1 | NOT RUN |
| A10 | ADMIN | Equipment | Producto ASSET Q | Crear equipo; inspeccionar; retirar; intentar operación posterior | Sólo ACTIVE operable; retiro persistente; no doble stock por alta/retiro manual | P1 | NOT RUN |

### MANAGER

| ID | Role | Module | Precondition | Steps | Expected Result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M01 | MANAGER | Navigation/Users | Cuenta M | Login; abrir /users directamente y GET /users | /home; sin Users; UI deniega/API403, sesión intacta | P1 | NOT RUN |
| M02 | MANAGER | Catalog | Fixtures Q | Crear/editar catálogos, customer y supplier | Permisos equivalentes a ADMIN en estos módulos, tenant correcto | P1 | NOT RUN |
| M03 | MANAGER | Purchases | Dos DRAFT Q | Editar/confirmar uno; cancelar otro | Acciones disponibles; estados correctos; sin stock por confirmar | P1 | NOT RUN |
| M04 | MANAGER | Receipts | Compra Q pendiente | Recibir con key; repetir mismo payload/key; repetir key con payload diferente | Una sola recepción/IN; replay seguro; conflicto distinto payload | P1 | NOT RUN |
| M05 | MANAGER | Inventory | Producto Q | Ajuste API a objetivo conocido; releer stock/movimientos | Ajuste permitido y coherente; sin UI inventada de ajuste | P1 | NOT RUN |
| M06 | MANAGER | Commercial/Equipment | Q con stock y ASSET | Crear venta DRAFT y confirmar; inspeccionar equipo Q | Ambas familias permitidas; stock OUT exacto y condición persistente | P1 | NOT RUN |

### SALES

| ID | Role | Module | Precondition | Steps | Expected Result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | SALES | Navigation | Cuenta S | Login; recorrer sidebar y rutas permitidas | Home, Dashboard, password, catálogos/inventory, customers/quotes/sales; no compras/equipos/users | P1 | NOT RUN |
| S02 | SALES | Catalog | Producto/categoría Q | Ver listas; buscar botones gestión; API POST/PATCH/DELETE con DTO válido | Lectura permitida; botones ocultos; escrituras403 sin efectos | P1 | NOT RUN |
| S03 | SALES | Customers | Customer Q | Crear, editar, desactivar | Acciones disponibles y tenant-scoped | P1 | NOT RUN |
| S04 | SALES | Quotes | Customer/product Q con stock | Crear DRAFT; confirmar; convertir; repetir intento | Una venta confirmada, OUT exacto, sin duplicación | P1 | NOT RUN |
| S05 | SALES | Sales | Dos ventas DRAFT Q | Confirmar una; cancelar otra; intentar cancelar confirmada | OUT sólo al confirmar; cancelación sólo DRAFT | P1 | NOT RUN |
| S06 | SALES | Forbidden routes | IDs propios de purchase/receipt/equipment | Abrir rutas E y API equivalentes; revisar token | Sin acceso; API403; receipt detail puede dar alerta genérica; no logout | P1 | NOT RUN |
| S07 | SALES | Dashboard | Sesión S | Abrir Dashboard; seguir KPI compras | Dashboard permitido; link conduce a denegación; registrar UX P2, no autorización concedida | P2 | NOT RUN |

### WAREHOUSE

| ID | Role | Module | Precondition | Steps | Expected Result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W01 | WAREHOUSE | Navigation/read-only | Cuenta W, catálogos Q | Login; leer suppliers/products/categories; intentar gestión API | Lecturas permitidas; gestión403 y sin botones | P1 | NOT RUN |
| W02 | WAREHOUSE | Purchases | DRAFT Q | Crear/editar; buscar approve/cancel; intentar ambos por API | Crear/editar permitido; approve/cancel403 | P1 | NOT RUN |
| W03 | WAREHOUSE | Receipts | Compra confirmada por A/M | Recibir parcial/resto; releer detalle/movimientos | Recepción permitida, cierre automático sin botón complete | P1 | NOT RUN |
| W04 | WAREHOUSE | Inventory | Producto Q | API IN/OUT; intentar ADJUSTMENT válido | IN/OUT permitidos; ajuste403 sin cambio de stock | P1 | NOT RUN |
| W05 | WAREHOUSE | Equipment | Equipo Q ACTIVE | Crear/inspeccionar/retirar fixtures; releer detalle | Acciones permitidas, lifecycle consistente | P1 | NOT RUN |
| W06 | WAREHOUSE | Commercial/Users | Sesión W | Abrir customers/quotes/sales/users y API; luego Dashboard | Rutas denegadas; Dashboard permite resumen y maneja sales403 sin logout | P1 | NOT RUN |

### Cross-role / auth / tenant / responsive

| ID | Role | Module | Precondition | Steps | Expected Result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| X01 | A/M/S/W | Login failure | Runtime ready; intentos bajo límite | Password incorrecta; observar URL/token; después válida | Sin redirect incorrecto; válida /home | P1 | NOT RUN |
| X02 | A/M/S/W | Session missing | Perfil limpio sin token | Abrir /inventory y una ruta restringida directamente | /login; sin children ni requests prematuros | P1 | NOT RUN |
| X03 | A/M/S/W | Session401 | Token Q inválido/expirado preparado sin exponerlo | Refrescar ruta; observar auth/me; repetir401 en petición de página | Token eliminado, login, sin contenido protegido | P1 | NOT RUN |
| X04 | A/M/S/W | Network/5xx | Sesión válida; fallo simulado sólo en cliente local | Fallar bootstrap; retry tras restauración | Token conservado, children bloqueados, ruta recuperada | P1 | NOT RUN |
| X05 | M/S/W | Authorization403 | Sesión válida | API /users sin permiso; seguir a /home; repetir bootstrap403 con mock local | Token conservado; no logout; bootstrap error no libera contenido | P1 | NOT RUN |
| X06 | A/M/S/W | Logout | Sesión válida | Pulsar Cerrar sesión en desktop y drawer; usar Back/refrescar | Token/caché eliminados, contenido retirado, /login; Back no restaura sesión | P1 | NOT RUN |
| X07 | A/M/S/W | Change password | Cuenta Q descartable, secretos privados | Actual incorrecta; nueva igual; cambio válido; probar password/JWT anteriores | Fallos conservan sesión; éxito login; credenciales/JWT anteriores inválidos | P1 | NOT RUN |
| X08 | Público | Forgot | Cuenta Q e email inexistente, proveedor omitido | Enviar ambos requests; observar respuesta sanitizada | Respuesta genérica, sin enumeración; no afirmar entrega | P1 | NOT RUN |
| X09 | Público | Reset missing | Sin token de recuperación | Abrir /reset-password; refrescar | Invalid-link, sin token persistido | P1 | NOT RUN |
| X10 | Público | Reset valid/retry | Fixture token local aprobada, aún pendiente | Capturar query; probar mismatch, same-password y network/5xx; retry válido | URL limpia; sólo token/newPassword en POST; token retenido para retries; éxito limpia todo | P1 | NOT RUN |
| X11 | Público | Reset expired/used | Fixtures locales aprobadas, aún pendientes | Usar expirado/usado; refrescar una captura válida | Rechazo y token eliminado; refresh invalid-link | P1 | NOT RUN |
| T01 | ADMIN A/B | Tenant lists | Cuentas utilizables; recursos conocidos ambos tenants | Listar cada módulo/summary por separado | Sin registros/agrupaciones del otro tenant | P1 | NOT RUN |
| T02 | ADMIN A/B | Tenant detail/PDF | Propietario confirma acceso primero | Abrir ID ajeno en detalle existente y PDF | No datos ajenos; normalmente404 scoped; sesión intacta | P1 | NOT RUN |
| T03 | ADMIN A/B | Tenant edit/delete | Sólo fixtures Q autorizadas | PATCH/DELETE ID ajeno en módulos con esos endpoints; releer como dueño | Rechazo, recurso/actividad intactos; no falsa prueba sobre endpoint inexistente | P1 | NOT RUN |
| T04 | ADMIN A/B | Tenant operations | Documentos/equipos Q en estado elegible | Aprobar/cancelar/recibir/convertir/inspeccionar/retirar ajenos | Rechazo; stock, movimientos y estado sin cambios | P1 | NOT RUN |
| T05 | ADMIN A/B | Tenant relations | IDs Q de ambos tenants | Cruzar customer/supplier/product/batch; enviar companyId extra | Validación rechaza, ninguna relación o documento creado | P1 | NOT RUN |
| R01 | A/M/S/W | Sidebar/header | Cinco viewports I | Abrir/cerrar drawer; colapsar desktop; navegar; Tab/Escape | Links por rol, foco usable y sin scroll global atrapado; registrar defecto Tab si reproduce | P2 | NOT RUN |
| R02 | A/S/W | DataTable | Datos suficientes, viewports I | Filtros/paginación/scroll; cambiar anchos sm/md; menú acciones | Datos/acciones alcanzables, sin overflow global ni permisos extra | P2 | NOT RUN |
| R03 | A/M/S/W | Modals/forms | Formulario permitido por rol | Abrir modal; teclado/Tab/ShiftTab/Escape; validaciones; pantalla baja | Foco contenido/restaurado, campos y submit visibles, no fondo interactivo | P2 | NOT RUN |
| R04 | S/W | Responsive forbidden | Mobile/tablet | Abrir deep links prohibidas y estados error/loading | Mensaje legible, sesión preservada, sin flash de datos | P1 | NOT RUN |

## L. Severity / stop rules

- P0/BLOCKER: exposición crítica de secrets, pérdida/corrupción de datos o aplicación inutilizable. Detener ejecución, preservar evidencias sanitizadas, no intentar reparar con SQL o cambios de configuración.
- P1/HIGH: autorización incorrecta, tenant isolation roto o flujo core roto. Detener el flujo afectado y cualquier mutación dependiente; si puede afectar aislamiento/integridad, detener toda la matriz hasta triage. No repetir ataques destructivos para obtener más evidencia.
- P2/MEDIUM: función secundaria o UX importante incorrecta; registrar y continuar únicamente flujos independientes seguros.
- P3/LOW: copy, alineación o cosmética menor.

No confundir un fallo del harness/runtime con un defecto funcional reproducido. Logout ya tiene implementación y cobertura automatizada; una falla en su caso manual X06 se clasifica según impacto observado.

## M. Execution order

0. Ejecutar arranque de B, verificar health y abrir perfiles separados por cuenta.
1. ADMIN: navegación y protección; preparar compras/recepciones y stock para comercial usando sólo fixtures QA.
2. MANAGER: permisos compartidos, exclusión Users y compras/inventario.
3. SALES: comercial con stock ya preparado; negar módulos warehouse.
4. WAREHOUSE: recepción adicional y equipo; negar comercial y ajustes.
5. Cross-role/401/403/network. Cambio de contraseña al final del uso operativo de cada cuenta, para no invalidar sesiones necesarias.
6. Tenant isolation: primero lecturas, luego mutaciones exclusivamente Q. No continuar si faltan recursos B.
7. Responsive regression y auth reset con el archivo local preparado. Resend real sigue diferido.

Usar perfiles separados de navegador para mantener evidencia por rol; probar además el logout real en cada uno.

## N. Blockers before manual QA

| Condición | Estado / siguiente acción propuesta |
| --- | --- |
| Runtime host incompatible | Resuelto: Docker Node 24.20.0/npm 11.19.0; NVM no instalado y host intacto |
| API/Web/health | Resuelto: API/Web activos; live, ready y login HTTP 200 |
| Configuración QA privada | Resuelto: secrets aleatorios sólo en `.qa/`, validator normal intacto |
| Credenciales de roles | Resuelto: A (4 roles) y B ADMIN verificados por API |
| Seguridad de fixtures | Resuelto: DB/volumen exclusivos, guards URL+identidad, datos sintéticos mínimos |
| Tenant bidireccional | Preparado: ambos tenants contienen IDs reales por tipo; ejecución T01–T05 sigue NOT RUN |
| Logout | Resuelto en código y tests; ejecución visual X06 sigue NOT RUN |
| Reset válido/expirado/usado | Preparado y smoke verificado sin Resend; ejecución manual sigue NOT RUN |

## O. Decision

**DEV-NEXT-03A1: PASS — READY para iniciar DEV-NEXT-03B.**

Esto no es aceptación de la aplicación: todos los casos K permanecen NOT RUN y los P2 ya observados deben registrarse si se reproducen. El entorno, accounts, fixtures, tokens y logout necesarios para comenzar están habilitados. Resend real continúa DEFERRED. No commit, push, PR ni deploy.
