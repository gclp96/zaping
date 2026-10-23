# PR preparado — INT-AB-01

**Título:** `feat(inventory): physical expiry foundation and receipts`
**Base:** `main`
**Head:** `codex/insap-auto-01b-foundation-receipts`
**Modalidad:** DRAFT, preparado localmente; publicación y apertura remota requieren autorización expresa.

## Problema y solución

La identidad histórica de Inventory Physical agrupa existencias sin lote en un único pool y no permite conservar caducidades diferentes. Foundation A separa fecha desconocida (`NULL`) de cada fecha conocida (`DATE`), conserva la identidad histórica y compara caducidad contra el día calendario local de Company bajo los locks existentes. Recepciones W1 reconstruye un crédito autorizado desde la OC, recepción, partidas y claim persistidos dentro de la misma transacción.

Permite recibir QUANTITY con lote/caducidad opcionales en PHYSICAL para NONE/OPTIONAL/REQUIRED, sin inventar Batch ni perder la fecha conocida. Conserva documentos del proveedor de PR #114, parciales/totales, permisos, tenant, idempotencia, CAS, auditoría y proyecciones.

## Alcance y exclusiones

- A: identidad DATE/NULL, migración aditiva de InventoryPosition, política temporal y lecturas físicas consistentes.
- B: crédito W1 autorizado exclusivamente por evidencia durable de recepción; un texto `origin.type` no concede permiso.
- Adaptación mínima de Ventas históricas: filtro NULL y comprobación NULL de la Position bloqueada. No hay planificador ni consumo FEFO.
- Se excluyen S3b-S/W2a, Healthcare W2b/SQL v2, transferencias fechadas, salidas REQUIRED sin lote (#120), custodia vencida (#121), UI OX-PUR-05, endpoints y cutover de Companies reales. ASSET/SERIALIZED y LEGACY conservan sus reglas.
- Referencias: ADR-015, #115/#116 y extracción independiente de PR #119; no reemplaza ni integra sus incrementos fuera de A+B.

## QA y compatibilidad histórica

- API: 2921/2921 PASS, 150 suites.
- Web: 882/882 PASS en la revalidación completa, 71 archivos. Se conserva la incidencia inicial: 881 PASS/1 FAIL en `inventory/page.test.tsx:860`, por consulta síncrona de una fila después de esperar un encabezado independiente de la carga. La suite focal pasó 21/21; no se modificó frontend ni sus aserciones.
- PostgreSQL 16 efímero: Foundation 31/31, W1 23/23 y LEGACY 5/5 PASS, 0 skipped; contenedores nuevos en tmpfs, identidad verificada, roles/credenciales exclusivos y destrucción posterior.
- Upgrade histórico: 46 migraciones previas a S1, fixtures v1 confirmados antes de aplicar A y 9/9 checks PASS. Conserva IDs, cantidades, revisiones, referencias de Effects, auditoría, claims, documentos y funciones SQL; golden fijo y replays reales sin escrituras nuevas; UNIQUE NULLS NOT DISTINCT, separación de fechas y CHECK de fuente única.
- Runner: 9/9 controles PASS, incluido HEAD desacoplado de GitHub Actions y exit code 1 ante una aserción fallida antes de provisionar.
- API typecheck productivo/focal, ESLint y build: PASS. Web typecheck/lint/build: PASS. Prettier y whitespace se verifican antes de los commits.

[Informe QA y actualización INT](QA_AB_01_REPORT.md) y [ADR-015](../architecture/adr/ADR-015-unbatched-expiry-physical-identity.md).

## CI preparado; evidencia remota pendiente

El job `historical-upgrade` usa checkout con historia completa, Node del repositorio y dependencias instaladas desde lockfile. Construye el candidato y ejecuta el mismo launcher con `--upgrade-only` en un PostgreSQL 16 nuevo con tmpfs, separado del servicio del job API. Las migraciones históricas se recuperan del commit base fijo y se comparan antes de aplicarlas. No usa copias locales ni bases existentes. Cada aserción falla el proceso; se exige exactamente 9 checks completados.

Se conservan en API las suites PostgreSQL A+B/LEGACY, typecheck focal y los gates API/Web. **Los checks remotos API, Web e Historical upgrade siguen PENDING hasta publicar el SHA final.** Los resultados locales no se atribuyen a GitHub Actions ni a CI #424 de PR #119.

## Migración y despliegue

Aplicar `20261023000001_inventory_position_unbatched_expiry` con PostgreSQL 16 antes de desplegar el binario con el nuevo Prisma client. Añade una columna DATE nullable, un CHECK de fuente única y sustituye únicamente los índices sin Batch por UNIQUE NULLS NOT DISTINCT. No modifica migraciones anteriores ni reescribe Positions, Effects o snapshots históricos. Revisar el bloqueo DDL de los índices y la secuencia de despliegue. INT no ejecuta migraciones en bases persistentes ni autoriza un despliegue.

## Riesgos y límites

`owned` incluye todo el saldo físico y `available` es disponibilidad física temporalmente elegible; no equivale a disponibilidad utilizable por cualquier operación. REQUIRED sin lote puede aparecer en available aunque su consumo siga rechazado. No se cambia la semántica pública para ocultar esa diferencia.

La autoridad del fixture W1 se fija a PHYSICAL y adquiere el shared fence real; no acredita un cutover operativo completo. El upgrade contiene evidencia v1 de Inventory/Receipt, no un fixture completo Healthcare v1/v2. Los gates Healthcare fechados permanecen cerrados. La incidencia de sincronización Web sigue como riesgo de estabilidad de tests y debe observarse en CI; no se ocultó con un cambio de expectativa.

M-HC1 OPEN, RISK-006 OPEN / NOT REPRODUCED e intermitencia EQUIPMENT sin causa confirmada permanecen iguales. El typecheck productivo/focal PASS no declara resueltos los 70 errores históricos del typecheck global de specs.

## Checklist de aprobación humana

- [x] Scope A+B y adaptación NULL mínima revisados; sin FEFO/Healthcare productivos.
- [x] QA local y PostgreSQL efímero acreditados, con historial de fallos y límites.
- [ ] Revisar el diff final y autorizar push de esta rama y apertura como DRAFT.
- [ ] Verificar API, Web e Historical upgrade sobre el SHA publicado; revisar cualquier repetición del fallo Web.
- [ ] Aprobar migración y orden de despliegue por separado.
- [ ] Autorizar merge únicamente tras revisión humana y CI verde; no declarar V1 completa.
