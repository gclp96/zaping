# HC-INVENTORY-CUSTODY-01D — Reconciliation, Opening Baseline & Coordinated Cutover

## A. Executive summary

TECHNICAL DESIGN: APPROVED — TD-INV-01D-01..32, 32/32 human approved.
IMPLEMENTATION: 01D-A COMPLETE / MERGED — PR #82; 01D-B IMPLEMENTED / TESTED — pending human review/merge — NON-ACTIVATING; 01D-C BLOCKED.
DESIGN APPROVED no significa CUTOVER READY.
Baseline: `c3d0824e64152ae26c0d891d203b5fa8ebb80899`, rama
`docs/hc-inventory-custody-01d-technical-design`; DEF/01A/B/C merged PR#75/#77/#79/#80.
01A/B/C permanecen DORMANT; M-HC1 OPEN.
Autoridad QUANTITY activa por Company completa; apply secuencial por Product.
Persistencia DB dedicada aprobada: InventoryCutover, InventoryCutoverProduct,
InventoryCutoverLegacySale implementadas en01D-A; una migración schema-only, validada sólo en PostgreSQL efímero aislado.
Manifest externo determinista, inmutable, SHA-256 y retención segura; no Git por defecto.
Initializer opening-only conserva owned vencido/inactivo sin cambiar identidad/eligibilidad;
CUSTODY sólo con contexto durable válido representable; no inventar ubicaciones/transfers.
Adapter opening-only mantiene stock=owned sin doble incremento y normaliza batch baseline auditado.
Freeze tenant sólo con aislamiento demostrado; si no, GLOBAL APPLICATION WRITE FREEZE obligatorio.
Router único Company LEGACY/FROZEN/PHYSICAL desde control durable; sin fallback físico→legacy.
Membership Sales DB exacto; UNKNOWN falla cerrado; sin replay OUT histórico.
OPTIONAL accessibility y discrepancias reales bloquean toda Company.
Original TARGET8SP SUPERSEDED BY HUMAN RE-ESTIMATION:01D-A5 +01D-B8 +01D-C8 =21SP.
01D-A COMPLETE / MERGED — PR #82;01D-B IMPLEMENTED / TESTED — pending human review/merge;01D-C BLOCKED hasta aceptación/merge01D-B. Sin fechas/Forecast/Commitment/Actual.
Writer certification, manifest real, reconciliation y freeze son gates futuros, no TD pendientes.
DATABASE ACTIVITY: sólo aceptación en DB efímera vacía; migración nueva schema-only.
01D ACTIVATION: NOT STARTED; no DB dev/qa/producción ni apertura real.

## A.1 Implementación local01D-A y evidencia de validación

Baseline de implementación: `3afe613d1887987e5f564d78a731d126758f6bad`, rama
`feat/hc-inventory-custody-01d-a-cutover-control`; TD merged PR#81.
TARGET5SP conservado. Fundación interna únicamente; no declarar CUTOVER READY.

- Una fila permanente InventoryCutover por Company; actores tenant-scoped RESTRICT;
  checkpoints QUANTITY incluidos ceros y membership exacto CONFIRMED.
- Migración `20261014000200_add_inventory_cutover_control`: dos enums, tres tablas,
  Quote UNIQUE(id,companyId), FKs tenant, CHECKs y unicidad del vínculo openingEffect.
  Ningún seed/backfill ni cambio de stock/batches/Sale/Quote de negocio.
- Control transaccional caller-owned: crear, registrar freeze acreditado externamente,
  registrar conjunto revisado completo atómicamente, bloquear manifest, marcar recovery
  y resume acotado. CAS con revisión/estado/digest; replay coherente cero escrituras.
  No API de edición parcial/unlock/delete, APPLY, VERIFY ni transición a PHYSICAL_ACTIVE.
  OPENING_APPLYING sólo fija el bloqueo durable; no crea opening ni ejecuta APPLY.
- manifestLockedAt y evidencia sobreviven recovery. expectedAvailable es elegible:
  available <= owned-custody; no se impone igualdad. projectionEvidence JSONB versionado.
- Sales fingerprint SHA-256 versionado comparte evidencia con01C; excluye timestamps,
  returnedQuantity y catálogo mutable. Membership+Effect bloquea incluso en replay.
  Replay por actor y protocolo01C preservados. Harness01C requiere la nueva migración
  y sólo SELECT en control/membership; no amplía permisos de mutación.
- Resolver interno LEGACY/CUTOVER/PHYSICAL; ningún caller productivo ni controller.
  PHYSICAL_ACTIVE sólo se lee; pruebas lo crean como fixture directo.

Validación: focal inicial99/99 en4 suites, más tres regresiones finales incluidas en
full API1896/1896 en113 suites; PostgreSQL16/16 (incluye conexiones independientes),
Prisma format/validate, typecheck soportado, lint TS modificados y build PASS.
PostgreSQL final: `127.0.0.1:63921/zaping_cutover_test`, contenedor único postgres:16,
loopback, tmpfs nuevo y DB comprobada vacía antes de migraciones; rol runtime no superuser.
37 migraciones de schema aplicadas al entorno vacío, incluida la nueva; sólo fixtures
identificados. Cleanup de fixtures/contenedor/tmpfs PASS. No acceso a zaping_spike_test,
zaping_dev, zaping_qa o producción; .env intacto.

Comprobación adicional `tsc --noEmit -p tsconfig.spec.json`:70 diagnósticos tanto en
baseline como en working tree, cero nuevos mediante comparación de fuentes en memoria.
No se repararon tests ajenos. Prisma generate no completó reemplazo de DLL Windows
ocupada (EPERM); tipos generados y motor existente ejecutaron la aceptación real.
El SHA-256 del motor DLL existente coincide con el motor instalado de Prisma.
No se detuvieron procesos ajenos; no afirmar generate PASS.

01D-A COMPLETE / MERGED — PR #82;01D-B IMPLEMENTED / TESTED — pending human review/merge;01D-C BLOCKED hasta aceptación/merge01D-B.01A/B/C DORMANT;01D ACTIVATION NOT STARTED;M-HC1 OPEN.

## A.2 Implementación local01D-B y evidencia de validación

01D-A COMPLETE / MERGED — PR #82. 01D-B IMPLEMENTED / TESTED — pending human review/merge.
TARGET 8 SP — CONFIRMED. Baseline `351bbc9272740cdea9042ad5ceb7448648045c99`,
rama `feat/hc-inventory-custody-01d-b-opening-baseline`. 01D-C BLOCKED hasta aceptación/merge01D-B.

- OPENING interno en InventoryPhysicalEffectKind; migraciones separadas
  `20261014000300_inventory_opening_enum` y `20261014000400_inventory_opening_constraints`.
  Función/trigger diferido conserva CREDIT/TRANSFER/DEFINITIVE_OUT/COUNT_CORRECTION;
  valida namespace, Product único, delta positivo, cantidades0→delta y revisiones0→1.
  Sin backfill, apertura real ni activación. Workflow autorizado en aplicación, no trigger.
- Reconciliación con evidencia durable explícita: stock/counters/historia no inventan
  pools, lineage o custodia. Manifest estricto canónico SHA-256, Products QUANTITY completos
  incluidos ceros/inactivos; ADJUSTMENT absoluto y Receipt/Movement no se duplican.
  OPTIONAL batched históricamente vendible o ambiguo bloquea dry-run y VERIFY.
- Preview/finalDryRun en transacción PostgreSQL READ ONLY; final exige WRITERS_FROZEN
  y adapter de evidencia de freeze. Review separado, import completo atómico01D-A;
  reemplazo completo CAS sólo antes del lock y sin opening; nunca edición de hijos.
- Registry CUSTODY vacío por defecto; namespace requiere resolver real registrado.
  Tests usan resolver TEST_ONLY inyectado; ningún namespace ficticio queda habilitado
  en producción. Providers de evidencia/freeze son contratos internos explícitos,
  sin adapter permisivo ni infraestructura freeze incluida.
- APPLY secuencial por Product ID, transacción por Product; locks control→checkpoint→
  Product→todos batches ASC→Positions ASC. Un Effect por Product positivo; cero sin
  Effect/Position. Stock sin UPDATE; batch AVAILABLE-state guardado old→expected;
  initialQuantity/metadatos intactos; ningún InventoryMovement/IN económico.
- Replay exige evidencia física/checkpoint/proyección exacta y cero writes/timestamps.
  VERIFY recarga manifest por digest en lectura nueva y certifica mediante CAS separado;
  sólo OPENING_APPLIED y VERIFIED. Transiciones finales viven en servicio opening/verify
  para no exponer un setter o transición01D-A sin validación de hechos.
- Servicios internos no registrados en módulos/callers productivos. Harness opt-in
  `node test/helpers/inventory-opening-postgres-runner.cjs --run-isolated`; Company,
  cutover, manifest/digest explícitos en cada operación de fixture. Artefactos reales
  sólo ruta absoluta externa indicada por operador; sin default repo/output/tmp.

Validación: focal77/77 en3 suites; full API1918/1918 en114 suites; PostgreSQL43/43,
incluye conexiones independientes, fault injection, response loss/resume, no doble
stock, contextos/tenant, manifest incompleto, VERIFY/tampering y regresiones SQL.
Prisma format/validate/generate, typecheck, lint TS tocados y build PASS.
Generate inicialmente EPERM por DLL Windows ocupada; reintento posterior PASS, sin borrar motores.
Última aceptación: `127.0.0.1:60595/zaping_opening_test`, PostgreSQL16 nuevo,
loopback/tmpfs, DB vacía verificada, rol opening_test no superuser;39 migraciones.
Run `2b5b5d4b-89fb-421a-b802-668bc22f682b`. Cleanup contenedor/fixtures/tmpfs PASS.
Sin DB dev/QA/producción/prior spike; .env sin cambios. No deployment.
01A/01B/01C DORMANT;01D ACTIVATION NOT STARTED;M-HC1 OPEN. No CUTOVER READY.

## B. Current-state evidence map

Referencias relativas al repo, inspeccionadas en el baseline anterior. Los símbolos
son anclas de búsqueda estables; los números identifican los sitios observados.
La búsqueda de writers abarcó `app/api/src`, `app/api/prisma`, `app/api/test` y
`scripts`; caller tracing incluyó controllers, módulos, servicios y asignaciones raw SQL.
No se inspeccionaron `output/`, `tmp/`, credenciales ni bases de datos.
El inventario de código no acredita topología de deployment ni ausencia de SQL externo:
operaciones debe completar ese inventario antes del freeze.

### B.1 Evidencia canónica

| Ref | Fuente / evidencia |
| --- | --- |
| E01 | [DEF](INVENTORY_CUSTODY_DEFINITION.md), DEC-INV-CUST-01..14, §§4–7: owned, elegibilidad, opening reconciliado y autoridad única. |
| E02 | [01A](INVENTORY_CUSTODY_TECHNICAL_DESIGN.md), TD-10/14/19 y §§2–8: origen único, locks, append-only, pool lógico sin location master, elegibilidad de CREDIT. |
| E03 | [01B](INVENTORY_CUSTODY_01B_TECHNICAL_DESIGN.md), TD-03/12–16/19/22–30: replay Receipt, manual aditivo, batch AVAILABLE, subconjuntos de tracking. |
| E04 | [01C](INVENTORY_CUSTODY_01C_TECHNICAL_DESIGN.md), TD-09/17/24–26/31/34: Candidate C, locks, mismo actor, legacy UNKNOWN. |
| E05 | [schema](../../../app/api/prisma/schema.prisma), Product:28, Movement:64, Batch:90, Position:139, Effect:163, Line:185, Company:429, Sequence:473, IdempotencyRecord:488, Sale:1046. Campo físico real `inventoryBatchId`; Movement usa `batchId`. No modelo cutover/manifest/epoch. |
| E06 | [InventoryService](../../../app/api/src/inventory/inventory.service.ts), createMovement:61, write:96/115, registerPurchaseEntry:151; [controller](../../../app/api/src/inventory/inventory.controller.ts):40 y módulo. |
| E07 | [Receipt legacy](../../../app/api/src/purchases-receipts/purchases-receipts.service.ts), create stock:258, Movement:267, registerBatch:754/786; controller y PurchaseReceiptsModule lo conectan. |
| E08 | [Sales legacy](../../../app/api/src/sales/sales.service.ts), approve stock:339 / Movement:380, createFromQuote stock:698 / Movement:736; SalesController:57/75 y SalesModule. |
| E09 | [Core](../../../app/api/src/inventory/physical/physical-inventory.service.ts), mutate / validateKey; [repository](../../../app/api/src/inventory/physical/physical-inventory.repository.ts), locks / claimEffect / createPosition / mutatePosition / appendLine; [read](../../../app/api/src/inventory/physical/physical-inventory-read.service.ts), agregado single-statement. |
| E10 | [Projection](../../../app/api/src/inventory/physical/inventory-compatibility-projection.service.ts):71/92 aplica incrementos desde líneas persistidas; [history](../../../app/api/src/inventory/physical/inventory-compatibility-history.service.ts):83/155 escribe Movement compatible. |
| E11 | [Receipt physical](../../../app/api/src/inventory/physical/receipt-physical-integration.service.ts), execute; [manual](../../../app/api/src/inventory/physical/manual-physical-inventory.service.ts), execute; [Sales physical](../../../app/api/src/inventory/physical/sales-physical-integration.service.ts), run / classify / convert; [resolver](../../../app/api/src/inventory/physical/sales-physical-source-resolver.ts); [classifier](../../../app/api/src/inventory/physical/sales-legacy-classifier.ts) devuelve UNKNOWN siempre. |
| E12 | [AppModule](../../../app/api/src/app.module.ts), InventoryModule, SalesModule, PurchaseReceiptsModule y [config](../../../app/api/src/config/env.validation.ts): sin wiring físico, guard de corte ni switch de autoridad. No mecanismo de freeze suficiente encontrado en estos caminos. |
| E13 | [Products](../../../app/api/src/products/products.service.ts), create omite stock (default 0), update no escribe tracking/stock, remove desactiva; lowStock:153 es filtro. [Dashboard](../../../app/api/src/dashboard/dashboard.service.ts):60/72 lee stock para alertas/valoración. |
| E14 | [Purchase](../../../app/api/src/purchases/purchases.service.ts), approve sólo estado, findInventoryMovements read; Quotes approve/cancel sin inventory. Sale create DRAFT / cancel no debitan. Equipment provisioning escribe Assets y secuencias, no Positions de material. |
| E15 | Migraciones [01A](../../../app/api/prisma/migrations/20261013000000_add_inventory_physical_authority/migration.sql) y [01B constraints](../../../app/api/prisma/migrations/20261014000100_inventory_count_constraints/migration.sql): cuatro índices canónicos, FKs tenant, lineCount>0, CREDIT positivo AVAILABLE, count cero estrecho. Sólo lectura de SQL. |
| E16 | [QA seed](../../../scripts/qa/seed.cjs):27/96/98; specs Inventory/physical/Sales y runners `app/api/test/helpers/*physical*postgres-runner.cjs`: fixtures y cleanup aislados, opt-in. Evidencia histórica de cleanup no prueba que un entorno futuro esté vacío. |
| E17 | [ADR-002](../../architecture/adr/ADR-002-inventory-movements.md), [ADR-013](../../architecture/adr/ADR-013-inventory-custody-case-logistics.md), [ADR-014](<../../architecture/adr/ADR-014 — Inventory Locations and Internal Transfers>): ledger histórico, transfer ≠ OUT, ubicaciones target; refinamientos 01A no crean warehouse master. [Inventory](INVENTORY.md), [Advanced Inventory](ADVANCED_INVENTORY.md), [Sales](SALES.md), [PurchaseReceipt](PURCHASE_RECEIPTS.md). |
| E18 | [Audit](AUDIT.md) REQUIREMENT APPROVED / NOT IMPLEMENTED. [Returns](RETURNS.md) y SaleReturn schema no equivalen a writer activo: no servicio/controller restock registrado encontrado en src/AppModule. |
| E19 | [Sequence allocator](../../../app/api/src/company-sequences/company-sequence-allocator.service.ts), SalesFolioService, EquipmentProvisioningService.prepareReceiptCodes: locks de secuencias antes de roots en adapters; Receipt toma Purchase antes de ASSET codes. |

### B.2 Writers, readers y disposición al corte

| Superficie / caller probado | Clasificación | Mutación / disposición futura |
| --- | --- | --- |
| InventoryController → createMovement | CURRENT PRODUCTIVE LEGACY | Product.stock IN/OUT/ADJUSTMENT + Movement; rechazar QUANTITY en ruta legacy al activar, ofrecer contrato físico explícito. |
| PurchaseReceiptsController → legacy create/registerBatch | CURRENT PRODUCTIVE LEGACY | stock+, batch initial+/available+, IN; sustituir orquestación QUANTITY por 01B, sin llamar ambos caminos. |
| SalesController → approve | CURRENT PRODUCTIVE LEGACY | DRAFT→CONFIRMED, stock−, OUT; conectar 01C con actor JWT. |
| SalesController → createFromQuote | CURRENT PRODUCTIVE LEGACY | Quote flag, nueva Sale, folio, stock−, OUT; conectar 01C conjuntamente con approve. |
| registerPurchaseEntry | DEPRECATED / NO CALLER | Puede escribir stock+/IN si se invoca; búsqueda src encuentra sólo definición. Retirar/inhibir, jamás alias legacy físico. |
| Product create / update / remove | CURRENT PRODUCTIVE LEGACY (catálogo) | Default stock=0 no es ingreso; cambios de elegibilidad afectan manifest, por eso entran al freeze. No writer oculto de stock positivo. |
| Core/repository 01A | DORMANT PHYSICAL | Único mutador de Position y creador Effect/Line por adapters soportados; sin controller/import productivo. |
| Receipt/manual/Sales adapters 01B/C | DORMANT PHYSICAL | Orquestación física atómica; Receipt mantiene rama ASSET/SERIALIZED legacy disjunta. |
| Projection + history 01B/C | DORMANT PHYSICAL | stock y batch available por delta; Movement compatible, jamás autoridad paralela. |
| Inventory GET, Product GET/lowStock, Dashboard, consulta Movement Purchase/Sale | READ ONLY | Hoy agregados legacy. Conservar stock=owned; availability de surtido requiere lectura física explícita, no renombrar semántica en silencio. |
| PhysicalInventoryReadService y resolver | READ ONLY (dormant) | Sumas Positions; resolver toma locks para planificación pero no muta stock. |
| Purchase approve, Quote approve/cancel, Sale create/cancel | CURRENT PRODUCTIVE LEGACY (negocio) | Sin write de inventario; congelar mutaciones de negocio que afectan snapshot/clasificación; cancel no revierte CONFIRMED. |
| Equipment provisioning / Healthcare CaseKit / Assignment | CURRENT PRODUCTIVE LEGACY (otros dominios) | Assets o preparación/reserva lógica, no balances QUANTITY. No contarlos como Positions. |
| Seeds QA, unit mocks, e2e fixtures y teardown | TEST/FIXTURE ONLY | Pueden escribir/borrar directamente; no son plan de apertura ni herramientas autorizadas en destino real. |
| SQL de migraciones | EVIDENCIA DE SCHEMA; fuera de writers online | Revisado sin ejecución; no usar schema migration como backfill de datos. |
| Dispatch/Return físico, locations/transfers de negocio, custodia Equipment | FUTURE / NOT IMPLEMENTED | No crear consumidores para este corte. Tablas/ADR no demuestran caller. |

No se encontró otro writer QUANTITY en los árboles auditados. SQL privilegiado,
jobs externos y réplicas/versiones desplegadas quedan como inventario operacional obligatorio,
no como ausencia demostrada. Ningún fixture autoriza limpiar filas desconocidas.

### B.3 Qué significan los datos actuales

- Product.stock: saldo agregado operativo actual; es evidencia para conciliar, no prueba de lotes ni custodia.
- Batch.initialQuantity: acumulado recibido, también base histórica de costo ponderado; no saldo remanente.
- Batch.availableQuantity: Receipt legacy incrementa; Sales/manual no lo decrementan. No fuente física confiable por sí sola.
- InventoryMovement: historia de IN/OUT y saldo absoluto ADJUSTMENT; batch nullable y balance nullable. No reconstruye fuente de OUT sin lote ni ubicaciones.
- Receipt/Items: hecho recibido, quantities y lote cuando registrado; no demuestra dónde permanecen las unidades.
- Sale/Items: demanda y OUT agregado confirmado; no demuestra lote consumido. Quote/DRAFT no es OUT.
- ADJUSTMENT: quantity es saldo final; si se calcula delta histórico, requiere balance anterior demostrado y orden total probado; no sumar quantity como delta.
- Positions/Effects: implementación dormida; vacíos esperados no se presuponen. Filas preexistentes desconocidas bloquean; sólo rerun del mismo manifest certificado puede reutilizarse.
- Tras el corte, Positions son autoridad actual; Effects explican cambios desde apertura; Movement conserva historia compatible. No reconstruir linaje por proximidad temporal.

### B.4 Límites del baseline resueltos por revisión humana

1. La validación normal01A exige elegibilidad para CREDIT AVAILABLE. TD-09 aprueba
   un initializer exclusivo de apertura01D-B que puede conservar owned inactivo/vencido
   sin modificar active/expiry/identidad. AVAILABLE-state no asegura consumo elegible.
   No cambia CREDIT normal ni lo convierte en bypass productivo.
2. CUSTODY puede abrirse exactamente mediante contrato opening-only cuando modelo
   actual y contexto durable válido lo soporten. Missing/ambiguo => BLOCK; estado o
   contexto no representable => STOP y revisión futura schema/scope. No inventar
   Dispatch, transfers, warehouses ni ubicar custody en AVAILABLE.
3. El baseline no tiene control/epoch/membership dedicados. TD-12 cierra DB-vs-file:
   persistencia dedicada aprobada conceptualmente en F.1, a implementar en01D-A
   tras autorización. Ya no es una decisión pendiente ni bloqueo del diseño.
4. CREDIT actual y su constraint sólo permiten líneas AVAILABLE; el initializer no
   promete llamar ese comando para CUSTODY. La forma de persistir la evidencia
   opening y validar sus líneas se concreta en implementación01D-A/B bajo TD-09/10,
   preservando constraints y reglas operativas01A. No raw SQL para evadir checks.
5. Candidate C permanece aprobado; inaccesibilidad OPTIONAL real/ambigua es hard
   gate de cutover, no permiso para fuentes batched automáticas.
6. Encabezados históricos01A/B/C no reflejan todos los merges posteriores: prevalece
   estado autoritativo PR#77/#79/#80; no se reabren decisiones aprobadas.

## C. Full TD decision table — 32/32 human approved

| TD-ID | Decision | Binding human decision | Repo evidence | Main risk | Status |
| --- | --- | --- | --- | --- | --- |
| TD-INV-01D-01 | Frontera de activación por Company | Cortar todo QUANTITY de una Company como unidad de activación, aunque apply avance por Product; ASSET/SERIALIZED fuera. | E01/E03/E11 | Un corte por Product deja Receipt/Sale multiproducto con autoridades diferentes. | APPROVED |
| TD-INV-01D-02 | Inventario exhaustivo de writers | Inventario de código aprobado con certificación operacional obligatoria antes del cutover. | E06–E16 | Un bypass legacy rompe parity inmediatamente. | APPROVED WITH OPERATIONS CERTIFICATION |
| TD-INV-01D-03 | Fuentes y límites de reconciliación | Triangular stock, batches, movimientos, Receipt y Sale con conteo/evidencia física revisada; registrar ausencias explícitas. | E01/E05/E06/E07/E08 | Ledger legacy no conserva lotes salientes ni custodia. | APPROVED |
| TD-INV-01D-04 | Ecuaciones y semántica de parity | Adoptar ecuaciones de E: stock=owned; batch.availableQuantity=suma AVAILABLE del batch, sin filtro de caducidad; available elegible separado; Sale Candidate C sólo unbatched.. | E01/E03 TD-25/E09/E10 | Owned, AVAILABLE-state y eligible available son distintos. | APPROVED |
| TD-INV-01D-05 | Apertura NONE y cero | NONE conciliado y realmente libre: un pool AVAILABLE con inventoryBatchId/contextos null. | E01 §7/E02/E05/E09 | Un stock agregado no prueba automáticamente un pool libre. | APPROVED |
| TD-INV-01D-06 | Apertura REQUIRED por batch real | Una fila de manifest por batch existente y coherente del tenant con cantidad física conciliada. | E01/E03/E04 TD-08/E05 | REQUIRED no admite residual sin identidad. | APPROVED |
| TD-INV-01D-07 | Gate OPTIONAL Candidate C | Preservar pools batched y unbatched reales. | E04 TD-09/31/E11 resolver | Apertura honesta puede hacer inaccesible stock antes vendible. | APPROVED WITH OPTIONAL ACCESSIBILITY HARD GATE |
| TD-INV-01D-08 | Discrepancias y resolución explícita | Estados de reporte RECONCILED, DISCREPANCY, MANUAL_RESOLUTION_REQUIRED, BLOCKING_DISCREPANCY. | E01 §7/E06/E07 | Product.stock puede diferir de hechos físicos o contadores batch. | APPROVED WITH COMPANY-BLOCKING POLICY |
| TD-INV-01D-09 | Initializer interno exclusivo de apertura | Initializer opening-only aprobado; validación operacional01A queda intacta. | E02 §7/E09 validateKey/E15 | El baseline debe conservar propiedad no elegible y custody representable sin convertirlas en disponibilidad operativa. | APPROVED WITH OPENING-ONLY INITIALIZER CONSTRAINT |
| TD-INV-01D-10 | Identidad y evidencia opening con schema existente | Namespace opening y Effect por Product positivo aprobados; productos cero sólo checkpoint. | E02/E05/E09/E15 | Apertura debe distinguirse de ingreso operativo. | APPROVED |
| TD-INV-01D-11 | Manifest determinista como artefacto | Artefacto externo controlado + digest/control/membership/progreso en DB dedicada. | E01/E02 physicalRequestHash/E05 | El plan debe revisarse y luego aplicarse exactamente. | APPROVED WITH SECURE RETENTION CONSTRAINT |
| TD-INV-01D-12 | Persistencia dedicada de cutover | Usar las tres estructuras dedicadas conceptuales; decisión DB-vs-file cerrada. | E05 Company/Sequence/IdempotencyRecord/E11 classifier/E12 | Control durable, checkpoint y membership necesitan autoridad tenant-scoped explícita. | APPROVED WITH DEDICATED CUTOVER PERSISTENCE |
| TD-INV-01D-13 | Dry-run obligatorio read-only | Permitir preview informativo online; sólo dry-run final bajo freeze sirve para APPLY. | E01/E06–E12 | Un plan generado con writers vivos puede quedar obsoleto. | APPROVED |
| TD-INV-01D-14 | Granularidad de APPLY | Aplicar una tx por Product completo, secuencial, ReadCommitted con roots/batches/positions ordenados; progreso durable mismo commit. | E02 límites1000/E09/E11 | Una tx Company puede retener demasiados locks; chunks pueden ocultar parcialidad. | APPROVED |
| TD-INV-01D-15 | Inicialización de proyecciones sin doble conteo | Adapter de baseline exclusivo aprobado; stock10 + opening10 permanece10. | E10 apply:71/92 | El adapter01B incrementa stock existente desde deltas opening. | APPROVED WITH OPENING-ONLY BASELINE ADAPTER |
| TD-INV-01D-16 | Exactly-once, crash y respuesta perdida | APPLY exige epoch/digest fijados. | E02 TD-10/14/E05/E09 | No basta que operador no repita comando. | APPROVED |
| TD-INV-01D-17 | Barrera de writers verificable | Freeze tenant demostrado o fallback global obligatorio; barrera no depende de cooperación legacy. | E06–E12/E19 | Locks físicos no detienen legacy ni sobreviven entre tx de apply. | APPROVED WITH GLOBAL-FREEZE FALLBACK |
| TD-INV-01D-18 | Router único de autoridad por Company | Single Company authority router DB-backed aprobado;01D-A fundamento no activante,01D-C integración. | E03 TD-21/30/E04 TD-35/E12 | Flags separados permiten Sales físico y Receipt legacy simultáneos. | APPROVED WITH SINGLE AUTHORITY ROUTER |
| TD-INV-01D-19 | Contrato manual y readers al activar | Contrato backend-only y preservación de semántica de readers aprobados. | E03 TD-12/28/29/E06/E13 | Endpoint legacy no tiene actor/key/sources; stock no equivale a available. | APPROVED WITH BACKEND-ONLY CONTRACT |
| TD-INV-01D-20 | Clasificación durable de Sales confirmadas | Exact durable DB legacy membership aprobada. | E04 TD-24/34/E05/E11 classifier | Falta de Effect no prueba venta legacy. | APPROVED WITH DB LEGACY MEMBERSHIP |
| TD-INV-01D-21 | DRAFT y Quote anteriores al corte | Excluir DRAFT y Quotes no convertidas del conjunto legacy. | E08/E11 classify/convert/E04 | createdAt antiguo no determina cuándo ocurrió OUT. | APPROVED |
| TD-INV-01D-22 | Receipt legacy e idempotencia al cruzar epoch | Retener IdempotencyRecord PURCHASE_RECEIPT_CREATE y vínculo Receipt; mismo key/hash devuelve Receipt previo antes de credit/provisioning. | E03 TD-03/E07/E11 Receipt execute | Retry de Receipt anterior no debe acreditar inventario otra vez. | APPROVED |
| TD-INV-01D-23 | Matriz PASS / WARN / BLOCK | Strict WARN policy aprobada; datos inciertos nunca best-effort. | E01/E05/E09/E15 | Una suma coincidente puede esconder doble crédito o linaje inventado. | APPROVED WITH STRICT WARN POLICY |
| TD-INV-01D-24 | VERIFY independiente pre-activación | Nueva sesión read-only recarga manifest por digest y DB; compara todos Products/checkpoints/Effects/Lines, ausencia de otras posiciones/efectos y paridad. | E09/E10/E15/E16 | APPLY exitoso no demuestra persistencia completa tras respuesta perdida. | APPROVED |
| TD-INV-01D-25 | Fallo antes de activación | Tx fallida se revierte; Products ya committed se conservan y reanudan bajo mismo epoch. | E02 TD-19/E05 restrict/E09 | Append-only impide prometer reset libre de aperturas committed. | APPROVED |
| TD-INV-01D-26 | Fallo durante activación | Traffic gate permanece cerrado hasta que todas atestigüen mismo build/epoch/routing; fallo => RECOVERY_REQUIRED y stop de instancias incompatibles. | E12/E04 TD-35 | Algunas instancias pueden arrancar con wiring distinto. | APPROVED |
| TD-INV-01D-27 | Frontera de rollback tras primer efecto | Primer Effect empresarial post-cutover committed marca límite: sólo freeze, diagnose y forward-fix compatible. | E01 §7/E03 TD-30/E04 TD-35 | Volver a legacy pierde sourcing/revision/idempotencia física. | APPROVED |
| TD-INV-01D-28 | Auditoría mínima operacional | Artefactos restringidos JSON/JSONL con operador y actor de negocio cuando aplica, UTC, Company/build/epoch/digest/snapshot, discrepancias, aprobación y resultados apply/verify/activate/failures; storage seguro, sin Git por defecto. | E05 Effect.actorId/E18/E16 | Audit genérico no está implementado. | APPROVED WITH SECURE-STORAGE CONSTRAINT |
| TD-INV-01D-29 | CLI estrecha y separación operador/actor | CLI estrecha con OPERATOR/ACTOR SEPARATION aprobada; auditar ambas identidades donde aplica. | E05 tenant FKs/E09/E16 | CLI privilegiada puede apuntar a Company equivocada. | APPROVED WITH OPERATOR/ACTOR SEPARATION |
| TD-INV-01D-30 | Reaudit de orden global y competencia de operadores | Control del cutover sólo tooling y antes de roots. | E02/E03 TD-22/E04 TD-17/E11/E19 | Introducir control del corte puede invertir locks existentes. | APPROVED |
| TD-INV-01D-31 | Aceptación antes y después del corte | Plan J: unit/integration + PostgreSQL aislado + ensayo de runbook y aceptación operativa. | E15/E16/E04 §F | Unit tests no prueban barrera ni conexiones antiguas. | APPROVED |
| TD-INV-01D-32 | Reestimación humana y split01D-A/B/C | APPROVED — RE-ESTIMATED / SPLIT 5 + 8 + 8 = 21 SP. | E05/E11/E12 y TD-09/12/15/17/19 | TARGET original8SP no cubre el control durable, apertura, verificación y corte operacional. | APPROVED — RE-ESTIMATED / SPLIT 5 + 8 + 8 = 21 SP |

## D. Full TD records — binding human review closeout

Las 32 decisiones están aprobadas por CTO/Architecture/Product, con las restricciones
indicadas. Los campos de propuesta/recomendación expresan ahora el contrato vinculante.
Open question registra el cierre humano; evidencia operacional futura es gate de corte.
Implementación01D-A local completada; B/C NOT STARTED. Las referencias E01..E19 mantienen el inventario aceptado.

### TD-INV-01D-01 — Frontera de activación por Company

- **ID:** TD-INV-01D-01
- **Title:** Frontera de activación por Company
- **Problem:** Un corte por Product deja Receipt/Sale multiproducto con autoridades diferentes.
- **Current repo evidence:** E01/E03/E11; mapa B.1/B.2.
- **Proposed design:** Cortar todo QUANTITY de una Company como unidad de activación, aunque apply avance por Product; ASSET/SERIALIZED fuera. Cualquier Product bloqueado impide activar esa Company.
- **Alternatives considered:** Corte global de todas las Companies; parcial por Product; Company completa.
- **Recommendation:** Cortar todo QUANTITY de una Company como unidad de activación, aunque apply avance por Product; ASSET/SERIALIZED fuera.
- **Trade-offs:** Mayor ventana de mantenimiento; evita routing mixto por partida.
- **Data integrity impact:** No excluir silenciosamente Products inactivos o saldo cero del inventario.
- **Concurrency impact:** Freeze de Company y activación sólo tras verificar todos sus Products.
- **Idempotency/rerun impact:** Rerun parcial de apply no equivale a activación parcial.
- **01A compatibility:** 01A conserva roots por Product
- **01B compatibility:** 01B mixto disjunto
- **01C compatibility:** 01C Sale completa física.
- **Cutover dependency:** Base de TD-17/18; si se aborta ningún Product se declara activo solo.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Base de TD-17/18; si se aborta ningún Product se declara activo solo.
- **Scope impact:** Activación QUANTITY por Company aprobada; apply por Product no permite activación parcial.
- **Test implications:** Probar Sale/Receipt con dos Products, uno bloqueado. Véase J; no ejecutado.
- **Open question:** Resuelta: la Company puede quedar parcialmente APPLIED, nunca parcialmente PHYSICAL_ACTIVE; ASSET/SERIALIZED fuera.
- **Status:** APPROVED

### TD-INV-01D-02 — Inventario exhaustivo de writers

- **ID:** TD-INV-01D-02
- **Title:** Inventario exhaustivo de writers
- **Problem:** Un bypass legacy rompe parity inmediatamente.
- **Current repo evidence:** E06–E16; mapa B.1/B.2.
- **Proposed design:** Aceptar B.2 como inventario de código. Antes del corte, operaciones certifica KNOWN WRITERS = COMPLETE y UNKNOWN WRITERS = 0, cubriendo instancias desplegadas, jobs, workers internos/externos, identidades/procesos SQL directo, versiones antiguas y toda mutación ajena al repo. Code search no acredita esa completitud.
- **Alternatives considered:** Auditar sólo Sales; buscar nombres sin seguir módulos; tracing completo.
- **Recommendation:** Inventario de código aprobado con certificación operacional obligatoria antes del cutover.
- **Trade-offs:** Más revisión; cobertura verificable de todos los caminos.
- **Data integrity impact:** Sin writer desconocido ni helper legacy QUANTITY invocable tras corte.
- **Concurrency impact:** Incluye procesos con conexiones abiertas y comandos programados.
- **Idempotency/rerun impact:** No se considera rerun seguro si cambia build o lista de writers.
- **01A compatibility:** 01A único core
- **01B compatibility:** 01B reemplaza Receipt/manual
- **01C compatibility:** 01C ambos endpoints.
- **Cutover dependency:** STOP por caller sin clasificación; rollback no revive bypass.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; STOP por caller sin clasificación; rollback no revive bypass.
- **Scope impact:** Auditoría y wiring de01D; no módulo nuevo.
- **Test implications:** Guard de imports/writers más prueba HTTP de cada entrada. Véase J; no ejecutado.
- **Open question:** Resuelta por aprobación con Operations Certification; la certificación real es gate de corte.
- **Status:** APPROVED WITH OPERATIONS CERTIFICATION

### TD-INV-01D-03 — Fuentes y límites de reconciliación

- **ID:** TD-INV-01D-03
- **Title:** Fuentes y límites de reconciliación
- **Problem:** Ledger legacy no conserva lotes salientes ni custodia.
- **Current repo evidence:** E01/E05/E06/E07/E08; mapa B.1/B.2.
- **Proposed design:** Triangular stock, batches, movimientos, Receipt y Sale con conteo/evidencia física revisada; registrar ausencias explícitas. Preservar initialQuantity e historia. ADJUSTMENT es saldo absoluto.
- **Alternatives considered:** Replay histórico automático; confiar en batch counter; hechos físicos conciliados.
- **Recommendation:** Triangular stock, batches, movimientos, Receipt y Sale con conteo/evidencia física revisada; registrar ausencias explícitas.
- **Trade-offs:** Requiere evidencia humana cuando el repo no conserva el hecho.
- **Data integrity impact:** No inferir lote por fechas ni sumar ajustes absolutos como deltas.
- **Concurrency impact:** Snapshot coherente bajo freeze; cambiar fuentes invalida revisión.
- **Idempotency/rerun impact:** Misma evidencia produce mismo plan; evidencia nueva requiere nueva revisión.
- **01A compatibility:** 01A inicia historia actual
- **01B compatibility:** 01B initialQuantity histórico
- **01C compatibility:** 01C no fuente de batch retroactiva.
- **Cutover dependency:** Discrepancia detiene apply; no borrar historia para reconciliar.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Discrepancia detiene apply; no borrar historia para reconciliar.
- **Scope impact:** Reconciliación operacional; no reconstrucción histórica.
- **Test implications:** Historial con ADJUSTMENT 10 tras saldo 7 no genera +10. Véase J; no ejecutado.
- **Open question:** Resuelta por revisión humana: APPROVED. La evidencia real de Company y operaciones es gate de cutover.
- **Status:** APPROVED

### TD-INV-01D-04 — Ecuaciones y semántica de parity

- **ID:** TD-INV-01D-04
- **Title:** Ecuaciones y semántica de parity
- **Problem:** Owned, AVAILABLE-state y eligible available son distintos.
- **Current repo evidence:** E01/E03 TD-25/E09/E10; mapa B.1/B.2.
- **Proposed design:** Adoptar ecuaciones de E: stock=owned; batch.availableQuantity=suma AVAILABLE del batch, sin filtro de caducidad; available elegible separado; Sale Candidate C sólo unbatched.
- **Alternatives considered:** Igualar stock a spendable; recalcular initialQuantity; mantener magnitudes distintas.
- **Recommendation:** Adoptar ecuaciones de E: stock=owned; batch.availableQuantity=suma AVAILABLE del batch, sin filtro de caducidad; available elegible separado; Sale Candidate C sólo unbatched..
- **Trade-offs:** Readers deben explicar la diferencia sin cambiar stock público.
- **Data integrity impact:** Custodia y unidades vencidas propias no desaparecen de owned.
- **Concurrency impact:** VERIFY fija asOf para elegibilidad y recalcula antes de abrir tráfico.
- **Idempotency/rerun impact:** Paridad de estado no basta: comparar también origen y líneas de apertura.
- **01A compatibility:** 01A read agrega elegibilidad
- **01B compatibility:** 01B batch estado
- **01C compatibility:** 01C política más estrecha.
- **Cutover dependency:** STOP ante mismatch; recovery conserva evidencia de sumas.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; STOP ante mismatch; recovery conserva evidencia de sumas.
- **Scope impact:** Semántica del corte; sin modelo nuevo de reservas.
- **Test implications:** Caducidad cambia available, no owned ni batch AVAILABLE-state. Véase J; no ejecutado.
- **Open question:** Resuelta por revisión humana: APPROVED. La evidencia real de Company y operaciones es gate de cutover.
- **Status:** APPROVED

### TD-INV-01D-05 — Apertura NONE y cero

- **ID:** TD-INV-01D-05
- **Title:** Apertura NONE y cero
- **Problem:** Un stock agregado no prueba automáticamente un pool libre.
- **Current repo evidence:** E01 §7/E02/E05/E09; mapa B.1/B.2.
- **Proposed design:** NONE conciliado y físicamente libre: pool canónico AVAILABLE unbatched, contextos null. q>0 se abre una vez mediante initializer exclusivo; en pool nuevo, before0/revision0→afterq/revision1. q=0 sólo manifest y InventoryCutoverProduct checkpoint, sin Position sintética ni Effect vacío.
- **Alternatives considered:** Lote UNKNOWN; Position cero con Effect vacío; registro cero en manifest.
- **Recommendation:** NONE conciliado y realmente libre: un pool AVAILABLE con inventoryBatchId/contextos null.
- **Trade-offs:** No genera filas inútiles; requiere control durable que certifique productos cero.
- **Data integrity impact:** No batch inventado; stock conciliado debe igualar q, no sólo copiarse sin revisión.
- **Concurrency impact:** Root protege identidad canónica y comprobación de ausencia.
- **Idempotency/rerun impact:** Origen estable y hash; q=0 certificado en control del manifest.
- **01A compatibility:** 01A CREDIT positivo
- **01B compatibility:** 01B stock no se suma otra vez
- **01C compatibility:** 01C unbatched.
- **Cutover dependency:** Depende TD-10/12/15; antes de activar puede reanudarse mismo plan.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Depende TD-10/12/15; antes de activar puede reanudarse mismo plan.
- **Scope impact:** Apertura en01D-B; checkpoint durable incluido en01D-A.
- **Test implications:** NONE q=9, q=0, negativo/overflow y pool inesperado. Véase J; no ejecutado.
- **Open question:** Resuelta por revisión humana: APPROVED. La evidencia real de Company y operaciones es gate de cutover.
- **Status:** APPROVED

### TD-INV-01D-06 — Apertura REQUIRED por batch real

- **ID:** TD-INV-01D-06
- **Title:** Apertura REQUIRED por batch real
- **Problem:** REQUIRED no admite residual sin identidad.
- **Current repo evidence:** E01/E03/E04 TD-08/E05; mapa B.1/B.2.
- **Proposed design:** Todo owned REQUIRED conserva identidad batch real, tenant/Product coherentes. Missing o ambigüedad bloquea toda Company; sin UNKNOWN batch, residual proporcional ni lotNumber fabricado. El initializer reproduce hechos soportados, incluidos no elegibles, sin volver REQUIRED vendible por Sales.
- **Alternatives considered:** Distribuir stock proporcionalmente; lote UNKNOWN; conteo por lote.
- **Recommendation:** Una fila de manifest por batch existente y coherente del tenant con cantidad física conciliada.
- **Trade-offs:** Puede bloquearse inventario aunque agregado parezca correcto.
- **Data integrity impact:** No alterar initialQuantity ni inventar lotNumber para cerrar suma.
- **Concurrency impact:** Root Product, todos Batches ASC, todas Positions ASC.
- **Idempotency/rerun impact:** Un Effect opening por Product con líneas batch ordenadas.
- **01A compatibility:** 01A FK/tracking
- **01B compatibility:** 01B batch AVAILABLE
- **01C compatibility:** 01C REQUIRED no se habilita.
- **Cutover dependency:** Initializer TD-09 y checkpoints01D-A; identidad no probada bloquea la Company.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; TD-09 para ineligible; no crear lotes de reparación en apply.
- **Scope impact:** Backfill por batch; sin alta automática de lotes.
- **Test implications:** Dos batches 3+5; residual2 bloqueado; foreign batch bloqueado. Véase J; no ejecutado.
- **Open question:** Resuelta: sólo lote real demostrado; alta/corrección necesaria debe ser trabajo explícitamente autorizado previo al manifest final.
- **Status:** APPROVED

### TD-INV-01D-07 — Gate OPTIONAL Candidate C

- **ID:** TD-INV-01D-07
- **Title:** Gate OPTIONAL Candidate C
- **Problem:** Apertura honesta puede hacer inaccesible stock antes vendible.
- **Current repo evidence:** E04 TD-09/31/E11 resolver; mapa B.1/B.2.
- **Proposed design:** Preservar pools batched y unbatched reales. Reportar por Product stock legacy, owned, unbatched elegible, batched físico/elegible, demanda abierta y evidencia de uso comercial. Batch identificado históricamente vendible inaccesible => STOP CUTOVER; ambigüedad => BLOCK, nunca waiver silencioso.
- **Alternatives considered:** Quitar lote; FEFO; ampliar Sales; mantener gate aprobado.
- **Recommendation:** Preservar pools batched y unbatched reales.
- **Trade-offs:** Company queda detenida si hard gate falla; cualquier ampliación comercial requiere revisión posterior fuera del alcance aprobado.
- **Data integrity impact:** No trasladar batch a unbatched ni usar residual algebraico como prueba.
- **Concurrency impact:** Congelar y revalidar metadata/elegibilidad antes de activar.
- **Idempotency/rerun impact:** Gate debe pasar en dry-run y verify con mismo manifest.
- **01A compatibility:** 01A pools intactos
- **01B compatibility:** 01B receipts lotes intactos
- **01C compatibility:** 01C Candidate C sin cambios.
- **Cutover dependency:** Producto resuelve fuera de este diseño; no activar parcialmente para sortear gate.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Producto resuelve fuera de este diseño; no activar parcialmente para sortear gate.
- **Scope impact:** Restricción01C intacta; ampliación exige reestimación.
- **Test implications:** OPTIONAL unbatched, batch-only, mixto y condición desconocida. Véase J; no ejecutado.
- **Open question:** Resuelta por revisión humana: APPROVED WITH OPTIONAL ACCESSIBILITY HARD GATE. La evidencia real de Company y operaciones es gate de cutover.
- **Status:** APPROVED WITH OPTIONAL ACCESSIBILITY HARD GATE

### TD-INV-01D-08 — Discrepancias y resolución explícita

- **ID:** TD-INV-01D-08
- **Title:** Discrepancias y resolución explícita
- **Problem:** Product.stock puede diferir de hechos físicos o contadores batch.
- **Current repo evidence:** E01 §7/E06/E07; mapa B.1/B.2.
- **Proposed design:** Clasificar RECONCILED, DISCREPANCY, MANUAL_RESOLUTION_REQUIRED y BLOCKING_DISCREPANCY. Discrepancia de cantidad/identidad física bloquea Company antes de apply/activación. Correcciones sólo como trabajo explícitamente autorizado previo al manifest final; regenerar snapshot/dry-run/revisión. 01D no fuerza parity silenciosamente.
- **Alternatives considered:** Ajuste silencioso; residual repartido; corrección explícita revisada.
- **Recommendation:** Estados de reporte RECONCILED, DISCREPANCY, MANUAL_RESOLUTION_REQUIRED, BLOCKING_DISCREPANCY.
- **Trade-offs:** No automatiza inventario dudoso; contador batch obsoleto puede normalizarse con evidencia.
- **Data integrity impact:** Diferencia batch legacy vs físico puede ser resolución documentada; diferencia física sin explicar nunca WARN.
- **Concurrency impact:** Toda corrección previa invalida snapshot y obliga nuevo freeze/dry-run.
- **Idempotency/rerun impact:** No editar manifest después del primer commit; recovery requiere decisión.
- **01A compatibility:** 01A sin corrección arbitraria
- **01B compatibility:** 01B COUNT no reinterpreta historia
- **01C compatibility:** 01C no cambia fuentes.
- **Cutover dependency:** Company BLOCK por TD-01; recuperar sin inventar efectos.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Company BLOCK por TD-01; recuperar sin inventar efectos.
- **Scope impact:** Resolución física previa autorizada; no motor de ajustes silenciosos en01D.
- **Test implications:** Stock10, lotes6: BLOCK; OPTIONAL6+unbatched4 sólo con conteo real. Véase J; no ejecutado.
- **Open question:** Resuelta: stock10/owned probado6 => BLOCK Company; corrección previa autorizada y nueva revisión.
- **Status:** APPROVED WITH COMPANY-BLOCKING POLICY

### TD-INV-01D-09 — Initializer interno exclusivo de apertura

- **ID:** TD-INV-01D-09
- **Title:** Initializer interno exclusivo de apertura
- **Problem:** El baseline debe conservar propiedad no elegible y custody representable sin convertirlas en disponibilidad operativa.
- **Current repo evidence:** E02 §7/E09 validateKey/E15; mapa B.1/B.2.
- **Proposed design:** Diseñar en01D-B un OPENING-ONLY initializer interno: sólo APPLY aprobado, Company/Product exactos, cutover state/manifest/digest válidos, tx con checkpoint/evidencia. Puede abrir owned vencido/inactivo sin cambiar Product/Batch.isActive, expirationDate ni batch identity; AVAILABLE-state no implica eligible=true. CUSTODY sólo reproduce contexto durable válido y soportado. Contexto ausente/ambiguo => BLOCK; estado/contexto no representable => STOP y revisión futura schema/scope.
- **Alternatives considered:** Usar CREDIT operativo; alterar active/expiry; SQL bypass; initializer opening-only.
- **Recommendation:** Initializer opening-only aprobado; validación operacional01A queda intacta.
- **Trade-offs:** Añade camino interno estrecho en01D-B; ninguna ruta productiva ni CLI genérica puede usarlo como bypass.
- **Data integrity impact:** No perder unidades propias por ineligibilidad; no inventar Dispatch, transfers, warehouse/location facts ni mover custody a AVAILABLE. Persistencia debe cumplir constraints, sin raw SQL para evadirlos.
- **Concurrency impact:** Control/checkpoint antes de Product→Batches→Positions; snapshot y contexto revalidados en la misma tx.
- **Idempotency/rerun impact:** Mismo epoch/digest/checkpoint coherente => ZERO WRITES; initializer no reabre ni resetea una Position existente.
- **01A compatibility:** CREDIT normal y sus reglas de elegibilidad no se relajan. Initializer usa contrato específico de apertura, no crédito operativo disfrazado.
- **01B compatibility:** Adapter TD-15 inicializa proyecciones, sin delta incremental de01B ni history IN ficticia.
- **01C compatibility:** Read/use policy mantiene eligible0 para vencido/inactivo y Sales excluye CUSTODY; Candidate C intacto.
- **Cutover dependency:** 01D-A control durable,01D-B initializer/evidencia/VERIFY; representabilidad y contexto reales son gates.
- **Rollback/recovery impact:** Apertura committed append-only; resume mismo epoch; matriz I, sin delete ni transfer ficticio.
- **Scope impact:** Incluido en01D-B8SP; estados/contextos fuera del modelo requieren revisión de alcance específica.
- **Test implications:** Owned7 vencido/inactivo→owned7/eligible0; metadata intacta; CUSTODY válida exacta; missing context bloquea; invocación productiva rechazada.
- **Open question:** Resuelta por OPENING-ONLY INITIALIZER CONSTRAINT. Detalles de implementación/constraints se validan en01D-A/B preservando01A operativo.
- **Status:** APPROVED WITH OPENING-ONLY INITIALIZER CONSTRAINT

### TD-INV-01D-10 — Identidad y evidencia opening con schema existente

- **ID:** TD-INV-01D-10
- **Title:** Identidad y evidencia opening con schema existente
- **Problem:** Apertura debe distinguirse de ingreso operativo.
- **Current repo evidence:** E02/E05/E09/E15; mapa B.1/B.2.
- **Proposed design:** Origen físico exclusivo conceptualmente INVENTORY_OPENING / stable cutoverId / OPEN_<productId>. Un opening Effect por Product con baseline positivo y todas sus líneas. Es evidencia de baseline, nunca Receipt económico ni InventoryMovement IN de compra. Longitudes/namespace y forma de persistencia del initializer se validan contra contratos en01D-A/B; no forzar CREDIT normal sobre CUSTODY.
- **Alternatives considered:** Nuevo kind OPENING; reutilizar Receipt; namespace interno explícito.
- **Recommendation:** Namespace opening y Effect por Product positivo aprobados; productos cero sólo checkpoint.
- **Trade-offs:** Namespace opening aprobado; implementación valida strings/longitudes y evidencia específica sin alterar operaciones normales01A.
- **Data integrity impact:** Initializer establece baseline físico, no nuevo aumento económico; Effect positivo por Product y líneas before0/afterq; ningún Effect vacío.
- **Concurrency impact:** INSERT normal con unique origen; perdedor aborta y clasifica fresco.
- **Idempotency/rerun impact:** Mismo cutover/Product, payload distinto => mismatch; nueva versión no permite segundo crédito.
- **01A compatibility:** Unique origen, hash, append-only y constraints preservados; initializer no promete que CREDIT actual soporte todos los estados.
- **01B compatibility:** 01B apertura requiere adapter TD-15
- **01C compatibility:** 01C históricos sin Effect SALE.
- **Cutover dependency:** Sólo después de TD-12; no borrar Effect confirmado ni cambiar actor.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Sólo después de TD-12; no borrar Effect confirmado ni cambiar actor.
- **Scope impact:** Contrato opening en01D-B; detalles schema/constraints en implementación autorizada01D-A/B.
- **Test implications:** Retry idéntico/diferente, claim conflict, composición de UUID y longitudes. Véase J; no ejecutado.
- **Open question:** Resuelta: origen opening dedicado; validación de strings y persistencia pertenece a implementación.
- **Status:** APPROVED

### TD-INV-01D-11 — Manifest determinista como artefacto

- **ID:** TD-INV-01D-11
- **Title:** Manifest determinista como artefacto
- **Problem:** El plan debe revisarse y luego aplicarse exactamente.
- **Current repo evidence:** E01/E02 physicalRequestHash/E05; mapa B.1/B.2.
- **Proposed design:** Manifest JSON determinista inmutable, orden canónico, SHA-256 y resumen legible opcional. Full manifest externo con acceso controlado, backup, recuperación y verificación de integridad; no guardar manifests reales automáticamente en Git. DB dedicada conserva control, digest, membership y progreso; archivo local no decide autoridad.
- **Alternatives considered:** Archivo como autoridad; staging completo en DB; artefacto controlado más control dedicado DB.
- **Recommendation:** Artefacto externo controlado + digest/control/membership/progreso en DB dedicada.
- **Trade-offs:** Archivo completo fuera de DB facilita revisión; requiere retención y disponibilidad verificadas, sin Git por defecto.
- **Data integrity impact:** Snapshot/evidencia y Sales membership incluidos; ninguna cifra derivada sin fuente.
- **Concurrency impact:** Snapshot congelado; dos operadores usan mismo digest o son rechazados.
- **Idempotency/rerun impact:** CutoverId estable, digest inmutable; timestamp de ejecución fuera del hash del plan.
- **01A compatibility:** 01A hash de request separado
- **01B compatibility:** 01B facts referenciados
- **01C compatibility:** 01C IDs confirmados.
- **Cutover dependency:** Pérdida del archivo => BLOCK hasta recuperar copia verificada, no regeneración heurística.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Pérdida del archivo => BLOCK hasta recuperar copia verificada, no regeneración heurística.
- **Scope impact:** Manifest01D-B, persistencia01D-A; sin plataforma nueva.
- **Test implications:** Orden de filas no cambia digest; cambio cantidad/miembro sí. Véase J; no ejecutado.
- **Open question:** Resuelta: secure retention es requisito; evidencia real de almacenamiento/backup es gate operacional.
- **Status:** APPROVED WITH SECURE RETENTION CONSTRAINT

### TD-INV-01D-12 — Persistencia dedicada de cutover

- **ID:** TD-INV-01D-12
- **Title:** Persistencia dedicada de cutover
- **Problem:** Control durable, checkpoint y membership necesitan autoridad tenant-scoped explícita.
- **Current repo evidence:** E05 Company/Sequence/IdempotencyRecord/E11 classifier/E12; mapa B.1/B.2.
- **Proposed design:** Persistencia DB dedicada aprobada: InventoryCutover, InventoryCutoverProduct e InventoryCutoverLegacySale, definidos conceptualmente en F.1. Company-scoped, epoch estable y como máximo uno activo, digest immutable desde APPLY, lifecycle con CAS/revision fail-closed. Product checkpoint incluye ceros y commit atómico con apertura. Membership exacto e inmutable para epoch aplicado/verificado. PHYSICAL_ACTIVE es fuente durable del router.
- **Alternatives considered:** DB dedicada; archivos locales; reutilizar Sequence/IdempotencyRecord/Effect vacío; timestamps.
- **Recommendation:** Usar las tres estructuras dedicadas conceptuales; decisión DB-vs-file cerrada.
- **Trade-offs:** Schema/migración necesarios en01D-A después de autorización de implementación; ninguna edición Prisma/migración aquí.
- **Data integrity impact:** No sobrecargar CompanySequence, IdempotencyRecord, resourceId arbitrario, timestamps ni PhysicalEffect vacío. Manifest externo se vincula por digest.
- **Concurrency impact:** CAS de transiciones, unicidad de epoch activo y Product checkpoint; claim de control antes de roots.
- **Idempotency/rerun impact:** Identidad no se regenera; digest no cambia al empezar APPLY; checkpoint coherente ZERO WRITES, parcial/incoherente BLOCK.
- **01A compatibility:** Effect conserva sólo hechos físicos y origen único; append-only intacto.
- **01B compatibility:** Scopes Receipt/manual conservados; checkpoints no usan IdempotencyRecord prestado.
- **01C compatibility:** SalesLegacyClassifier lee exact membership DB y epoch Company, sin heurística temporal.
- **Cutover dependency:** 01D-A implementa fundamento no activante; luego01D-B aplica/verifica y01D-C cablea/activa.
- **Rollback/recovery impact:** Control y before/expected evidence sobreviven crash; resume mismo epoch y matriz I.
- **Scope impact:** Incluido en01D-A TARGET5SP; exactos Prisma, FKs, indexes y migration se diseñan/implementan tras autorización.
- **Test implications:** CAS stale, dos epochs activos, digest mutation, ceros, checkpoints atómicos y membership immutable.
- **Open question:** Resuelta: DEDICATED CUTOVER PERSISTENCE aprobada. Schema01D-A COMPLETE / MERGED — PR #82.
- **Status:** APPROVED WITH DEDICATED CUTOVER PERSISTENCE

### TD-INV-01D-13 — Dry-run obligatorio read-only

- **ID:** TD-INV-01D-13
- **Title:** Dry-run obligatorio read-only
- **Problem:** Un plan generado con writers vivos puede quedar obsoleto.
- **Current repo evidence:** E01/E06–E12; mapa B.1/B.2.
- **Proposed design:** Permitir preview informativo online; sólo dry-run final bajo freeze sirve para APPLY. Snapshot RepeatableRead read-only Company-scoped, sin claims/locks de escritura, genera plan completo, discrepancias, fuentes ambiguas, OPTIONAL gate, expected parity y blockers.
- **Alternatives considered:** Online snapshot suficiente; freeze final; delta capture nuevo.
- **Recommendation:** Permitir preview informativo online; sólo dry-run final bajo freeze sirve para APPLY.
- **Trade-offs:** Downtime de revisión; evita diseñar captura incremental fuera de alcance.
- **Data integrity impact:** No consultas a DB en esta tarea; futura herramienta no corrige ni crea control durante dry-run.
- **Concurrency impact:** Ninguna mutación entre snapshot final y apply; fence operacional externo al read-only.
- **Idempotency/rerun impact:** Mismo snapshot/evidencia/cutoverId genera igual plan; envelope de ejecución separado.
- **01A compatibility:** 01A no apply
- **01B compatibility:** Dry-run no invoca Receipt/manual ni proyecciones mutadoras.
- **01C compatibility:** Dry-run no confirma Sales, convierte Quotes ni crea Effects.
- **Cutover dependency:** Drift => descartar autorización de apply y repetir revisión.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Drift => descartar autorización de apply y repetir revisión.
- **Scope impact:** CLI read-only; no delta capture online.
- **Test implications:** Instrumentar SQL para demostrar cero INSERT/UPDATE/DELETE; repetir dry-run. Véase J; no ejecutado.
- **Open question:** Resuelta por revisión humana: APPROVED. La evidencia real de Company y operaciones es gate de cutover.
- **Status:** APPROVED

### TD-INV-01D-14 — Granularidad de APPLY

- **ID:** TD-INV-01D-14
- **Title:** Granularidad de APPLY
- **Problem:** Una tx Company puede retener demasiados locks; chunks pueden ocultar parcialidad.
- **Current repo evidence:** E02 límites1000/E09/E11; mapa B.1/B.2.
- **Proposed design:** Company congelada; APPLY secuencial Product-by-Product. Cada tx completa incluye claim de control/checkpoint→Product root→Batch/Position locks→opening Effect/Lines y baseline→adapter opening→InventoryCutoverProduct checkpoint. Product committed puede permanecer aplicado si falla otro; resume mismo epoch/manifest. Sin tx Company gigante ni chunks ocultos; Product excede límites => STOP/rediseño.
- **Alternatives considered:** Tx gigante Company; chunks arbitrarios; por Product; staging DB.
- **Recommendation:** Aplicar una tx por Product completo, secuencial, ReadCommitted con roots/batches/positions ordenados; progreso durable mismo commit.
- **Trade-offs:** Rerun local simple y locks acotados; Company puede quedar parcialmente aplicada, nunca activa.
- **Data integrity impact:** Effect/Lines/baseline projection/checkpoint son atómicos por Product.
- **Concurrency impact:** Sin paralelización inicial; locks de control antes de Product; timeout y tres intentos sólo aborto transitorio confirmado.
- **Idempotency/rerun impact:** Products committed se verifican; pendientes se aplican; no reiniciar desde cero.
- **01A compatibility:** 01A max1000 y caller tx
- **01B compatibility:** 01B proyección normal fuera de opening
- **01C compatibility:** 01C no toca negocio.
- **Cutover dependency:** Fallo mantiene freeze y reanuda mismo manifest; no promete rollback global.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Fallo mantiene freeze y reanuda mismo manifest; no promete rollback global.
- **Scope impact:** Apply01D-B8SP; control/checkpoint01D-A5SP.
- **Test implications:** Crash entre Products y dentro de tx; límite de1000. Véase J; no ejecutado.
- **Open question:** Resuelta: por Product completo, Company nunca parcialmente activa; capacidad/límites reales son gates.
- **Status:** APPROVED

### TD-INV-01D-15 — Inicialización de proyecciones sin doble conteo

- **ID:** TD-INV-01D-15
- **Title:** Inicialización de proyecciones sin doble conteo
- **Problem:** El adapter01B incrementa stock existente desde deltas opening.
- **Current repo evidence:** E10 apply:71/92; mapa B.1/B.2.
- **Proposed design:** Adapter OPENING-ONLY bajo APPLY aprobado e inaccesible desde runtime normal. Verifica Product.stock=expectedOwned conciliado y conserva stock; mismatch BLOCK. Establece Batch.availableQuantity al AVAILABLE-state exacto con evidencia old→new revisada, initialQuantity intacto, sin IN de compra ficticio. Adapter/checkpoint/apertura comparten tx;01B incremental sólo después del baseline.
- **Alternatives considered:** Poner stock a0 y sumar; sumar al legacy; verify stock y establecer batch baseline.
- **Recommendation:** Adapter de baseline exclusivo aprobado; stock10 + opening10 permanece10.
- **Trade-offs:** Excepción estrecha de inicialización, no segundo writer permanente.
- **Data integrity impact:** stock10 + opening10 termina10, no20; batch initial/costo/historia intactos; ninguna corrección silenciosa.
- **Concurrency impact:** Root lock, compare snapshot y before-images; fallo revierte Product entero.
- **Idempotency/rerun impact:** Replay retorna evidencia y verifica parity, cero UPDATE incluso si assignment sería igual.
- **01A compatibility:** 01A no proyecciones
- **01B compatibility:** 01B deltas sólo operaciones posteriores
- **01C compatibility:** 01C consume baseline listo.
- **Cutover dependency:** 01D-A control/checkpoint y01D-B apertura/adapter; mismatch stock bloquea Company.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Si stock difiere del plan, STOP; batch before-image retenido para recovery revisado.
- **Scope impact:** Incluido01D-B; no writer alternativo normal.
- **Test implications:** Apertura10 con stock10, batch stale12→real10, fallo tras crédito. Véase J; no ejecutado.
- **Open question:** Resuelta: OPENING-ONLY BASELINE ADAPTER aprobado.
- **Status:** APPROVED WITH OPENING-ONLY BASELINE ADAPTER

### TD-INV-01D-16 — Exactly-once, crash y respuesta perdida

- **ID:** TD-INV-01D-16
- **Title:** Exactly-once, crash y respuesta perdida
- **Problem:** No basta que operador no repita comando.
- **Current repo evidence:** E02 TD-10/14/E05/E09; mapa B.1/B.2.
- **Proposed design:** APPLY exige epoch/digest fijados. Relee progreso y Effect bajo locks. Existing coherent => ZERO WRITES; ausencia => apply; parcial/incoherente => BLOCK. Tras commit incierto, nueva lectura antes de mutar. Nuevo cutoverId no esquiva existencia de baseline.
- **Alternatives considered:** Check en memoria; delete/recreate; origen y checkpoint atómicos.
- **Recommendation:** APPLY exige epoch/digest fijados.
- **Trade-offs:** Más validaciones; detecta corrupción en vez de repararla.
- **Data integrity impact:** No duplicar Position, Effect, Line ni proyección; cero Products también tienen checkpoint.
- **Concurrency impact:** Unique origen arbitra; no recuperar dentro de tx abortada; lock de control serializa operadores.
- **Idempotency/rerun impact:** Mismo payload éxito histórico; cambio digest/cantidades rechazo; three-attempt sólo abort transitorio.
- **01A compatibility:** 01A claim protocol
- **01B compatibility:** 01B replay sin proyección
- **01C compatibility:** 01C criterio de lectura fresca.
- **Cutover dependency:** Unknown result => VERIFY fresco; sin evidencia suficiente permanece congelado.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Unknown result => VERIFY fresco; sin evidencia suficiente permanece congelado.
- **Scope impact:** Control de rerun obligatorio dentro del tooling.
- **Test implications:** Doble apply, distinto payload, kill tras commit y pérdida respuesta. Véase J; no ejecutado.
- **Open question:** Resuelta por revisión humana: APPROVED. La evidencia real de Company y operaciones es gate de cutover.
- **Status:** APPROVED

### TD-INV-01D-17 — Barrera de writers verificable

- **ID:** TD-INV-01D-17
- **Title:** Barrera de writers verificable
- **Problem:** Locks físicos no detienen legacy ni sobreviven entre tx de apply.
- **Current repo evidence:** E06–E12/E19; mapa B.1/B.2.
- **Proposed design:** Activación lógica por Company; freeze por Company sólo si infraestructura prueba aislamiento tenant de TODOS los writers. Si no se puede probar, GLOBAL APPLICATION WRITE FREEZE obligatorio. Incluir tráfico, instancias/jobs/workers, versiones stale, SQL directo y catálogo/negocio relevante. Maintenance HTTP solo insuficiente; advisory/table locks no son barrera única entre tx por Product. Exclusión no demostrada => STOP.
- **Alternatives considered:** A freeze; B rolling switch; C DB lock; D mecanismo repo existente (no encontrado). Detalle G.
- **Recommendation:** Freeze tenant demostrado o fallback global obligatorio; barrera no depende de cooperación legacy.
- **Trade-offs:** Downtime global si no hay aislamiento probado; alcance real del fence es gate de operaciones, no decisión de diseño pendiente.
- **Data integrity impact:** Snapshot final sólo después de drenar todas tx; backup y audit no sustituyen fence.
- **Concurrency impact:** No usar advisory lock no cooperativo; table locks transitorios no protegen entre Products. Reanudar instancias antiguas sigue impedido.
- **Idempotency/rerun impact:** BarrierId y evidencia por fase; crash no libera tráfico automáticamente.
- **01A compatibility:** 01A locks locales siguen iguales
- **01B compatibility:** Receipt/manual permanecen congelados hasta el cambio conjunto.
- **01C compatibility:** Sales legacy debe quedar cercado antes de abrir Sales físico.
- **Cutover dependency:** TD-12/18; ante pérdida de fence detener apply/activation y revalidar.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; TD-12/18; ante pérdida de fence detener apply/activation y revalidar.
- **Scope impact:** Barrera/runbook01D-C; no locks globales permanentes por request.
- **Test implications:** Writer en vuelo, conexión antigua, job directo y expiración del proceso operador. Véase J; no ejecutado.
- **Open question:** Resuelta: GLOBAL-FREEZE FALLBACK aprobado; freeze feasibility real se acredita antes de corte.
- **Status:** APPROVED WITH GLOBAL-FREEZE FALLBACK

### TD-INV-01D-18 — Router único de autoridad por Company

- **ID:** TD-INV-01D-18
- **Title:** Router único de autoridad por Company
- **Problem:** Flags separados permiten Sales físico y Receipt legacy simultáneos.
- **Current repo evidence:** E03 TD-21/30/E04 TD-35/E12; mapa B.1/B.2.
- **Proposed design:** Un InventoryAuthorityResolver(companyId) decide LEGACY / FROZEN-CUTOVER / PHYSICAL desde InventoryCutover durable. LEGACY→writers legacy existentes; FROZEN/CUTOVER→rechazo/unavailable de mutaciones QUANTITY; PHYSICAL→sólo01A/B/C aprobados, jamás fallback legacy ante error. Activación cambia todos los writers juntos; checkpoint Product nunca determina routing.
- **Alternatives considered:** Flags independientes Receipt/manual/approve/convert; routing Product; resolver único Company.
- **Recommendation:** Single Company authority router DB-backed aprobado;01D-A fundamento no activante,01D-C integración.
- **Trade-offs:** Release coordinado con control durable; no promesa de atomicidad de varios deploys.
- **Data integrity impact:** Receipt/manual/ambos Sales/proyecciones/readers compatibles usan misma autoridad; missing/incoherent control falla cerrado.
- **Concurrency impact:** Freeze/drain y protección stale runtime antes de activar; ningún request en espera ejecuta decisión legacy antigua.
- **Idempotency/rerun impact:** activate reintenta mismo epoch y CAS; errores físicos no cambian autoridad.
- **01A compatibility:** 01A único core
- **01B compatibility:** 01B Receipt/manual juntas
- **01C compatibility:** 01C Sales juntas.
- **Cutover dependency:** 01D-A control/resolver foundation→01D-B VERIFIED→01D-C wiring/activación conjunta.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Fallo parcial de réplicas => todas sin tráfico, RECOVERY_REQUIRED.
- **Scope impact:** 01D-A no activa rutas;01D-C8SP integra router, sin flags independientes ni frontend.
- **Test implications:** Instancia stale, activación perdida, waiting writer y ruta mal cableada. Véase J; no ejecutado.
- **Open question:** Resuelta: SINGLE AUTHORITY ROUTER aprobado. Cutover ready requiere gates operativos efectivos.
- **Status:** APPROVED WITH SINGLE AUTHORITY ROUTER

### TD-INV-01D-19 — Contrato manual y readers al activar

- **ID:** TD-INV-01D-19
- **Title:** Contrato manual y readers al activar
- **Problem:** Endpoint legacy no tiene actor/key/sources; stock no equivale a available.
- **Current repo evidence:** E03 TD-12/28/29/E06/E13; mapa B.1/B.2.
- **Proposed design:** Contrato backend manual físico01B explícito con actor autenticado, key, sources/revision, reason/count según operación. En Company PHYSICAL rechazar mutación legacy Product-only QUANTITY; no inferir fuentes. Sin frontend. Product.stock sigue owned; lowStock/Dashboard/existing stock readers conservan semántica, sin renombrarlos a disponibilidad gastable.
- **Alternatives considered:** Traducir Product-only a fuentes inferidas; deshabilitar todo manual; API física explícita.
- **Recommendation:** Contrato backend-only y preservación de semántica de readers aprobados.
- **Trade-offs:** Clientes de manual deben usar contrato explícito; nuevas reglas de low-stock/fulfillment quedan fuera de01D.
- **Data integrity impact:** No usar stock owned para autorizar OUT ni batch counter como eligible.
- **Concurrency impact:** Contrato ejecuta adapters en tx y respeta parents→roots; lecturas no exponen apertura parcial.
- **Idempotency/rerun impact:** Key manual obligatoria; no key Sales; HTTP retry legacy no se traduce en intent nuevo.
- **01A compatibility:** 01A read core
- **01B compatibility:** 01B contrato exacto
- **01C compatibility:** 01C shapes/rutas aprobadas.
- **Cutover dependency:** Si operación necesita UI nueva => SCOPE IMPACT; no implementarla aquí.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Si operación necesita UI nueva => SCOPE IMPACT; no implementarla aquí.
- **Scope impact:** 01D-C backend solamente; nueva semántica de low-stock/fulfillment requiere producto/scope posterior.
- **Test implications:** RBAC, actor, key, legacy rechazado, stock owned vs available. Véase J; no ejecutado.
- **Open question:** Resuelta: BACKEND-ONLY CONTRACT; no queda decisión de redefinir lowStock en01D.
- **Status:** APPROVED WITH BACKEND-ONLY CONTRACT

### TD-INV-01D-20 — Clasificación durable de Sales confirmadas

- **ID:** TD-INV-01D-20
- **Title:** Clasificación durable de Sales confirmadas
- **Problem:** Falta de Effect no prueba venta legacy.
- **Current repo evidence:** E04 TD-24/34/E05/E11 classifier; mapa B.1/B.2.
- **Proposed design:** Bajo freeze final capturar exact Company+CONFIRMED Sale.id legítimamente sin SALE CONFIRM Effect y fingerprint determinista de negocio/items/Quote. Persistir InventoryCutoverLegacySale. Classifier consulta Company+active cutover epoch+exact membership+coherence. Fuera membership y missing Effect requerido=>UNKNOWN/integridad; miembro con Effect contradictorio=>BLOCK. Sin OUT histórico.
- **Alternatives considered:** createdAt; missing Effect implica legacy; archivo local autoridad; membership dedicada DB.
- **Recommendation:** Exact durable DB legacy membership aprobada.
- **Trade-offs:** Membership persistida tenant-scoped, completa e immutable tras apply/verify; full manifest externo retenido.
- **Data integrity impact:** Si hay Effect presente, validar coherencia antes; membership+Effect inesperado bloquea. Sale ausente del conjunto sin Effect no es LEGACY.
- **Concurrency impact:** Freeze de Sale/Quote durante captura; insert tardío invalida snapshot.
- **Idempotency/rerun impact:** Repetir legacy devuelve error histórico cero writes; mismo actor físico conserva 01C.
- **01A compatibility:** 01A no synthetic Effects
- **01B compatibility:** 01B sin cambio
- **01C compatibility:** SalesLegacyClassifier conecta seam01C con InventoryCutoverLegacySale en01D-A, sin activar rutas.
- **Cutover dependency:** Membership01D-A capturada bajo freeze;01D-B VERIFY;01D-C router activo.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; TD-12; archivo perdido/corrupto produce UNKNOWN, no replay.
- **Scope impact:** 01D-A classifier durable; sin backfill histórico.
- **Test implications:** Histórico certificado, missing membership, cross-tenant y Effect contradictorio. Véase J; no ejecutado.
- **Open question:** Resuelta: DB LEGACY MEMBERSHIP obligatoria; archivo/timestamp no son autoridad.
- **Status:** APPROVED WITH DB LEGACY MEMBERSHIP

### TD-INV-01D-21 — DRAFT y Quote anteriores al corte

- **ID:** TD-INV-01D-21
- **Title:** DRAFT y Quote anteriores al corte
- **Problem:** createdAt antiguo no determina cuándo ocurrió OUT.
- **Current repo evidence:** E08/E11 classify/convert/E04; mapa B.1/B.2.
- **Proposed design:** Excluir DRAFT y Quotes no convertidas del conjunto legacy. Al confirmar/convertir después de activación pasan por 01C y crean Effect; Quote ya convertida apunta a Sale canónica y usa clasificación de esa Sale. Validar flag/relación sin reparar.
- **Alternatives considered:** Clasificar por fecha de creación; capturar estado al freeze.
- **Recommendation:** Excluir DRAFT y Quotes no convertidas del conjunto legacy.
- **Trade-offs:** Exige snapshot exacto de relaciones y estado.
- **Data integrity impact:** Nunca debitar de nuevo Sale histórica; DRAFT viejo sí debita una vez al confirmar.
- **Concurrency impact:** Folio→Quote→Sale→Products; cancel sólo DRAFT; sin inversión.
- **Idempotency/rerun impact:** Retry mismo actor+Effect coherente éxito cero writes; otro actor error histórico.
- **01A compatibility:** 01A OUT exacto
- **01B compatibility:** 01B proyección una vez
- **01C compatibility:** 01C matriz intacta.
- **Cutover dependency:** Sin flag/relación coherente => BLOCK, no reset Quote.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Sin flag/relación coherente => BLOCK, no reset Quote.
- **Scope impact:** Reuso01C, ninguna regla temporal nueva.
- **Test implications:** DRAFT viejo, Quote vieja sin convertir, Quote convertida legacy. Véase J; no ejecutado.
- **Open question:** Resuelta por revisión humana: APPROVED. La evidencia real de Company y operaciones es gate de cutover.
- **Status:** APPROVED

### TD-INV-01D-22 — Receipt legacy e idempotencia al cruzar epoch

- **ID:** TD-INV-01D-22
- **Title:** Receipt legacy e idempotencia al cruzar epoch
- **Problem:** Retry de Receipt anterior no debe acreditar inventario otra vez.
- **Current repo evidence:** E03 TD-03/E07/E11 Receipt execute; mapa B.1/B.2.
- **Proposed design:** Retener IdempotencyRecord PURCHASE_RECEIPT_CREATE y vínculo Receipt; mismo key/hash devuelve Receipt previo antes de credit/provisioning. Inventariar completions inconsistentes como BLOCK; nunca crear Effect retroactivo para Receipt legacy.
- **Alternatives considered:** Backfill Effects de receipts; nuevo scope de replay; conservar scope existente.
- **Recommendation:** Retener IdempotencyRecord PURCHASE_RECEIPT_CREATE y vínculo Receipt; mismo key/hash devuelve Receipt previo antes de credit/provisioning.
- **Trade-offs:** No arregla receipts legacy sin idempotencia/evidencia; esas anomalías requieren revisión.
- **Data integrity impact:** No repetir initialQuantity, Equipment, Movement ni stock; no borrar keys para migrar.
- **Concurrency impact:** Barrier drena claims en vuelo; no pending committed inconsistente aceptado.
- **Idempotency/rerun impact:** Key antigua coherente cero writes; key nueva representa request nuevo y valida pendientes Purchase.
- **01A compatibility:** 01A ningún crédito histórico
- **01B compatibility:** 01B scope preservado
- **01C compatibility:** 01C sin cambio.
- **Cutover dependency:** Legacy receipts acreditados en baseline actual, no por replay.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Legacy receipts acreditados en baseline actual, no por replay.
- **Scope impact:** Reuso01B, sin migrar claves ni crear Effects históricos.
- **Test implications:** Retry receipt pre-corte, mixto ASSET/QUANTITY, mismatch y resource ausente. Véase J; no ejecutado.
- **Open question:** Resuelta por revisión humana: APPROVED. La evidencia real de Company y operaciones es gate de cutover.
- **Status:** APPROVED

### TD-INV-01D-23 — Matriz PASS / WARN / BLOCK

- **ID:** TD-INV-01D-23
- **Title:** Matriz PASS / WARN / BLOCK
- **Problem:** Una suma coincidente puede esconder doble crédito o linaje inventado.
- **Current repo evidence:** E01/E05/E09/E15; mapa B.1/B.2.
- **Proposed design:** PASS/WARN/BLOCK estricto. WARN sólo documentación histórica no esencial cuya ausencia no afecta quantity/identity/authority/cutover safety. Nunca WARN: stock≠owned, cantidad/lote actual ambiguo, OPTIONAL failure/unknown, writer desconocido, manifest/control missing/alterado, UNKNOWN Sales, tenant/idempotency/barrier/parity fallidos. Sin override que convierta BLOCK a WARN.
- **Alternatives considered:** Sólo sum(stock); tolerancia numérica; verificación exacta.
- **Recommendation:** Strict WARN policy aprobada; datos inciertos nunca best-effort.
- **Trade-offs:** Más comprobaciones; reporte accionable por Product/pool.
- **Data integrity impact:** Match exacto de líneas, origen y quantities; no tolerancia en enteros.
- **Concurrency impact:** Snapshot de verify congelado; reevaluar expiry antes de activar.
- **Idempotency/rerun impact:** CHECK PASS repetido no modifica audit ni balances.
- **01A compatibility:** 01A constraints más app invariants
- **01B compatibility:** 01B parity
- **01C compatibility:** 01C accessibility.
- **Cutover dependency:** Cualquier BLOCK impide Company PHYSICAL_ACTIVE.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Cualquier BLOCK impide Company PHYSICAL_ACTIVE.
- **Scope impact:** Checks operacionales exactos; sin repair automático.
- **Test implications:** Suma igual con lote equivocado debe fallar. Véase J; no ejecutado.
- **Open question:** Resuelta: WARN restringido a documentación histórica no esencial; ningún override de seguridad del corte.
- **Status:** APPROVED WITH STRICT WARN POLICY

### TD-INV-01D-24 — VERIFY independiente pre-activación

- **ID:** TD-INV-01D-24
- **Title:** VERIFY independiente pre-activación
- **Problem:** APPLY exitoso no demuestra persistencia completa tras respuesta perdida.
- **Current repo evidence:** E09/E10/E15/E16; mapa B.1/B.2.
- **Proposed design:** VERIFY fresco independiente read-only: recargar manifest por digest exacto, control, checkpoints, Effects/Lines/Positions/proyecciones, DB legacy membership y evidencia writer/fence. Compara todo y no repara inventario. Sólo VERIFIED permite transición hacia PHYSICAL_ACTIVE; registrar resultado controlado fuera de lectura de inventario.
- **Alternatives considered:** Confiar stdout APPLY; misma memoria; lectura independiente.
- **Recommendation:** Nueva sesión read-only recarga manifest por digest y DB; compara todos Products/checkpoints/Effects/Lines, ausencia de otras posiciones/efectos y paridad.
- **Trade-offs:** Tiempo extra bajo freeze; evidencia reproducible.
- **Data integrity impact:** No usar projection adapter para reparar durante verify.
- **Concurrency impact:** Sin tráfico; otro operador no puede cambiar manifest mientras se verifica.
- **Idempotency/rerun impact:** VERIFY repetible cero writes a inventario; discrepancia abre recovery.
- **01A compatibility:** 01A fuentes persistidas
- **01B compatibility:** 01B balances verificados
- **01C compatibility:** 01C no efecto productivo aún.
- **Cutover dependency:** Sólo VERIFIED habilita TD-18; fallo retiene freeze.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Sólo VERIFIED habilita TD-18; fallo retiene freeze.
- **Scope impact:** Verificación independiente; no nuevo reader público genérico.
- **Test implications:** Apply parcial, checkpoints false positive, foreign rows. Véase J; no ejecutado.
- **Open question:** Resuelta: VERIFY independiente obligatorio; firmas/roles efectivos son evidencia operacional.
- **Status:** APPROVED

### TD-INV-01D-25 — Fallo antes de activación

- **ID:** TD-INV-01D-25
- **Title:** Fallo antes de activación
- **Problem:** Append-only impide prometer reset libre de aperturas committed.
- **Current repo evidence:** E02 TD-19/E05 restrict/E09; mapa B.1/B.2.
- **Proposed design:** Tx fallida se revierte; Products ya committed se conservan y reanudan bajo mismo epoch. No delete/reset de Position/Effect. Si hay que cambiar baseline tras commits, STOP y plan de recovery explícito; apertura queda no productiva, nunca duplicada.
- **Alternatives considered:** TRUNCATE; borrar por origin; resume/forward recovery.
- **Recommendation:** Tx fallida se revierte; Products ya committed se conservan y reanudan bajo mismo epoch.
- **Trade-offs:** No rollback Company automático por diseño por Product.
- **Data integrity impact:** No usar teardown fixtures como procedimiento real; compensación no aprobada aquí.
- **Concurrency impact:** Freeze persiste durante recovery; reabrir legacy invalida snapshot y exige rediseño.
- **Idempotency/rerun impact:** Checkpoint y Effect coherentes permiten retomar; manifest nuevo no elude saldo existente.
- **01A compatibility:** 01A append-only
- **01B compatibility:** 01B antes-imágenes
- **01C compatibility:** 01C sin rutas físicas abiertas.
- **Cutover dependency:** I define cuándo volver legacy puede siquiera considerarse.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; I define cuándo volver legacy puede siquiera considerarse.
- **Scope impact:** No tooling destructivo; recovery especial requiere revisión.
- **Test implications:** Crash intermedio, falla projection, rechazo de reset automático. Véase J; no ejecutado.
- **Open question:** Resuelta: resume mismo epoch/manifest antes de activar; no DELETE/TRUNCATE/reset de apertura committed.
- **Status:** APPROVED

### TD-INV-01D-26 — Fallo durante activación

- **ID:** TD-INV-01D-26
- **Title:** Fallo durante activación
- **Problem:** Algunas instancias pueden arrancar con wiring distinto.
- **Current repo evidence:** E12/E04 TD-35; mapa B.1/B.2.
- **Proposed design:** Traffic gate permanece cerrado hasta que todas atestigüen mismo build/epoch/routing; fallo => RECOVERY_REQUIRED y stop de instancias incompatibles. Reintentar preparación; no dejar subset atendiendo ni fallback.
- **Alternatives considered:** Rolling flags; abrir cada ruta cuando esté lista; barrera conjunta.
- **Recommendation:** Traffic gate permanece cerrado hasta que todas atestigüen mismo build/epoch/routing; fallo => RECOVERY_REQUIRED y stop de instancias incompatibles.
- **Trade-offs:** Sacrifica disponibilidad durante fallo para preservar autoridad.
- **Data integrity impact:** Estado durable no basta sin deployment fence; ambos deben verificarse.
- **Concurrency impact:** Requests esperando no conservan permiso legacy: rechazar y requerir nuevo request bajo epoch vigente.
- **Idempotency/rerun impact:** Repetir transición sólo si versión esperada; respuesta perdida requiere readback.
- **01A compatibility:** Core sólo con baseline verificado y todos los consumidores compatibles.
- **01B compatibility:** Receipt/manual no se activan por separado ni dejan stock legacy QUANTITY operativo.
- **01C compatibility:** Ambos caminos Sales comparten el mismo epoch y barrera que Receipt/manual.
- **Cutover dependency:** Antes de primer Effect puede evaluarse rollback I; después sólo forward recovery.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Antes de primer Effect puede evaluarse rollback I; después sólo forward recovery.
- **Scope impact:** Coordinar deployment, no inventar HA/rolling framework.
- **Test implications:** Una réplica legacy, otra física, caída entre activate y unfreeze. Véase J; no ejecutado.
- **Open question:** Resuelta: failure de activación mantiene tráfico cerrado, detiene instancias incompatibles y conserva RECOVERY_REQUIRED.
- **Status:** APPROVED

### TD-INV-01D-27 — Frontera de rollback tras primer efecto

- **ID:** TD-INV-01D-27
- **Title:** Frontera de rollback tras primer efecto
- **Problem:** Volver a legacy pierde sourcing/revision/idempotencia física.
- **Current repo evidence:** E01 §7/E03 TD-30/E04 TD-35; mapa B.1/B.2.
- **Proposed design:** Primer Effect empresarial post-cutover committed marca límite: sólo freeze, diagnose y forward-fix compatible. Antes de ese límite, rollback requiere probar ausencia de todos los Effects no-opening y restauración/compatibilidad de before-images bajo fence; nunca simple redeploy.
- **Alternatives considered:** Rollback binario automático; reconstrucción legacy; forward-fix.
- **Recommendation:** Primer Effect empresarial post-cutover committed marca límite: sólo freeze, diagnose y forward-fix compatible.
- **Trade-offs:** Puede prolongar incidente; evita duplicar confirmaciones/receipts.
- **Data integrity impact:** Effect COUNT cero también cruza frontera; smoke committed real también. Opening no cuenta como negocio nuevo.
- **Concurrency impact:** Freeze/drain antes de verificar ausencia; cero observado con writers vivos no sirve.
- **Idempotency/rerun impact:** No reusar nuevo epoch para repetir opening; conservar auditoría y manifest.
- **01A compatibility:** 01A historia intacta
- **01B compatibility:** 01B keys/proyecciones
- **01C compatibility:** 01C Effect natural no replay legacy.
- **Cutover dependency:** Si duda sobre commit => tratar como post-effect hasta readback concluyente.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Si duda sobre commit => tratar como post-effect hasta readback concluyente.
- **Scope impact:** No módulo Return/Reconciliation ni compensaciones nuevas.
- **Test implications:** Fallo tras primer Sale/Receipt/count cero; rollback rechazado. Véase J; no ejecutado.
- **Open question:** Resuelta: antes del primer business Effect sólo considerar rollback bajo freeze y ausencia probada; después FREEZE→DIAGNOSE→FORWARD-FIX.
- **Status:** APPROVED

### TD-INV-01D-28 — Auditoría mínima operacional

- **ID:** TD-INV-01D-28
- **Title:** Auditoría mínima operacional
- **Problem:** Audit genérico no está implementado.
- **Current repo evidence:** E05 Effect.actorId/E18/E16; mapa B.1/B.2.
- **Proposed design:** Evidencia JSON/JSONL compacta en storage controlado/respaldado/recuperable: operador, actor de negocio cuando aplica, UTC, Company, build, cutoverId/digest/snapshotFingerprint, discrepancias, aprobación, apply/verify/activation/failures. Sin Audit genérico. No manifests/audit reales sensibles en Git por defecto, sin secretos ni datos clínicos.
- **Alternatives considered:** Nueva plataforma Audit; logs stdout efímeros; evidencias compactas retenidas.
- **Recommendation:** Artefactos restringidos JSON/JSONL con operador y actor de negocio cuando aplica, UTC, Company/build/epoch/digest/snapshot, discrepancias, aprobación y resultados apply/verify/activate/failures; storage seguro, sin Git por defecto.
- **Trade-offs:** Operaciones debe definir retención/acceso/backup; hash no prueba autorización por sí solo.
- **Data integrity impact:** No incluir secretos ni datos clínicos; referencias de evidencia con integridad.
- **Concurrency impact:** Cada intento tiene correlationId; resultado final se verifica con estado committed.
- **Idempotency/rerun impact:** Attempt log nuevo no implica nueva mutación; identidad de plan no cambia con hora de retry.
- **01A compatibility:** 01A actor histórico
- **01B compatibility:** 01B history intacta
- **01C compatibility:** 01C actor original preservado.
- **Cutover dependency:** Archivo faltante o aprobación no comprobable bloquea.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Archivo faltante o aprobación no comprobable bloquea.
- **Scope impact:** Artefactos/logs estrechos; Audit genérico fuera.
- **Test implications:** Crash sin stdout, archivo alterado y recuperación de copia. Véase J; no ejecutado.
- **Open question:** Resuelta: SECURE-STORAGE CONSTRAINT; retención/acceso/backup reales son gates operacionales.
- **Status:** APPROVED WITH SECURE-STORAGE CONSTRAINT

### TD-INV-01D-29 — CLI estrecha y separación operador/actor

- **ID:** TD-INV-01D-29
- **Title:** CLI estrecha y separación operador/actor
- **Problem:** CLI privilegiada puede apuntar a Company equivocada.
- **Current repo evidence:** E05 tenant FKs/E09/E16; mapa B.1/B.2.
- **Proposed design:** Tooling Nest-backed interno precheck/dry-run/apply/verify/activate; companyId/cutoverId/digest/destino explícitos según modo, sin --all/default Company/default environment, frontend/admin API/manual SQL apply. Separar TECHNICAL OPERATOR privilegiado de BUSINESS/AUDIT ACTOR: Company User existente autorizado cuando Effect requiere actorId. No fabricar User ni equiparar identidad DB/runtime al User.
- **Alternatives considered:** Script SQL; admin API; migration-style automática; CLI revisable.
- **Recommendation:** CLI estrecha con OPERATOR/ACTOR SEPARATION aprobada; auditar ambas identidades donde aplica.
- **Trade-offs:** Autorización concreta se diseña en implementación01D-A/C, conservando ambas identidades; no pendiente de aprobación del diseño.
- **Data integrity impact:** Tenant/FKs y autorización fail-closed; operator y business actor retenidos, sin credencial expuesta ni actor ficticio.
- **Concurrency impact:** Concurrente se arbitra por control durable y locks; no PID local como mutex.
- **Idempotency/rerun impact:** Comando requiere epoch/digest, no genera identidad nueva al reintentar.
- **01A compatibility:** Effect.actorId sigue User real autorizado del tenant; operador técnico no reemplaza ese actor.
- **01B compatibility:** 01B servicios reusados
- **01C compatibility:** 01C classifier tenant-scoped.
- **Cutover dependency:** Sin destino inequívoco o privilegios correctos => STOP antes de write.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Sin destino inequívoco o privilegios correctos => STOP antes de write.
- **Scope impact:** Fundamento/autorización01D-A/C; manifest/apply/verify01D-B; sin frontend/admin API.
- **Test implications:** Missing Company, foreign batch, all-company, modo dry-run con write prohibido. Véase J; no ejecutado.
- **Open question:** Resuelta: operador técnico y actor de negocio separados; mecanismo exacto autorizado pertenece a implementación y falla cerrado.
- **Status:** APPROVED WITH OPERATOR/ACTOR SEPARATION

### TD-INV-01D-30 — Reaudit de orden global y competencia de operadores

- **ID:** TD-INV-01D-30
- **Title:** Reaudit de orden global y competencia de operadores
- **Problem:** Introducir control del corte puede invertir locks existentes.
- **Current repo evidence:** E02/E03 TD-22/E04 TD-17/E11/E19; mapa B.1/B.2.
- **Proposed design:** Control del cutover sólo tooling y antes de roots. Con freeze no compite negocio; no añadir Company lock exclusivo por cada writer ordinario. Runtime conserva approve Sale→Products; convert SALE_FOLIO→Quote→Sale→Products; Receipt claim→Purchase→ASSET sequence→Products; Batch/Position siempre ASC.
- **Alternatives considered:** Advisory genérico; lock Company por request; preservar jerarquías + fence.
- **Recommendation:** Control del cutover sólo tooling y antes de roots.
- **Trade-offs:** Requiere auditar grafo de cada caller al cablear, no afirmar locks seguros sólo por nombres.
- **Data integrity impact:** Nunca Product→nueva sequence/padre; sources descubiertas tras roots.
- **Concurrency impact:** Dos apply compiten por control/epoch, perdedor relee fresco; legacy no coopera => necesita TD-17.
- **Idempotency/rerun impact:** Unique Effect más locks; no catch/continue de tx abortada.
- **01A compatibility:** 01A roots íntegros
- **01B compatibility:** 01B codes antes
- **01C compatibility:** 01C Folio-before-Quote intacto.
- **Cutover dependency:** Inversión material nueva detiene decisión de wiring, no se corrige reabriendo TD aprobadas.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Inversión material nueva detiene decisión de wiring, no se corrige reabriendo TD aprobadas.
- **Scope impact:** Reaudit y tests; no Company-lock global para negocio.
- **Test implications:** Grafo y PG con dos conexiones, pg_blocking_pids, no sleeps como evidencia. Véase J; no ejecutado.
- **Open question:** Resuelta: reaudit final obligatorio; control del tooling antes de roots, sin Company-exclusive lock permanente por request.
- **Status:** APPROVED

### TD-INV-01D-31 — Aceptación antes y después del corte

- **ID:** TD-INV-01D-31
- **Title:** Aceptación antes y después del corte
- **Problem:** Unit tests no prueban barrera ni conexiones antiguas.
- **Current repo evidence:** E15/E16/E04 §F; mapa B.1/B.2.
- **Proposed design:** Plan J: unit/integration + PostgreSQL aislado + ensayo de runbook y aceptación operativa. Tras activate con tráfico cerrado, primero checks read-only; pruebas reales de negocio sólo con autorización/evidencia, nunca datos sintéticos inventados en producción.
- **Alternatives considered:** Sólo mocks; smoke con stock real no autorizado; ensayo aislado y checks controlados.
- **Recommendation:** Plan J: unit/integration + PostgreSQL aislado + ensayo de runbook y aceptación operativa.
- **Trade-offs:** 01C histórico no acredita 01D; no tests ejecutados aquí.
- **Data integrity impact:** No compensaciones o cleanup productivo de smoke; primer commit marca TD-27.
- **Concurrency impact:** Probar writer bloqueado, duplicate apply, waiting writer y ausencia de doble write.
- **Idempotency/rerun impact:** Todos reruns y respuestas perdidas incluidos.
- **01A compatibility:** Regresión de constraints, locks, Effects y lectura de Positions.
- **01B compatibility:** Regresión Receipt mixto, manual, COUNT_CORRECTION y proyecciones atómicas.
- **01C compatibility:** Regresión Candidate C, actor/replay, sourcing y concurrencia Sales.
- **Cutover dependency:** Fallo mantiene freeze; después de business effect aplica forward-fix.
- **Rollback/recovery impact:** Aplicar matriz I sin borrar evidencia; Fallo mantiene freeze; después de business effect aplica forward-fix.
- **Scope impact:** Plan de aceptación, no ejecución en esta tarea.
- **Test implications:** Matriz J obligatoria sin timeout arbitrario. Véase J; no ejecutado.
- **Open question:** Resuelta: ensayo aislado completo obligatorio antes de corte real; aceptación efectiva es gate, no diseño pendiente.
- **Status:** APPROVED

### TD-INV-01D-32 — Reestimación humana y split01D-A/B/C

- **ID:** TD-INV-01D-32
- **Title:** Reestimación humana y split01D-A/B/C
- **Problem:** TARGET original8SP no cubre el control durable, apertura, verificación y corte operacional.
- **Current repo evidence:** E05/E11/E12 y TD-09/12/15/17/19; mapa B.1/B.2.
- **Proposed design:** Split aprobado:01D-A Durable Cutover Control & Legacy Classification Foundation TARGET5SP;01D-B Reconciliation, Opening Baseline & Verification TARGET8SP;01D-C Authority Cutover, Writer Wiring & Operational Activation TARGET8SP. Total21SP. Original8SP SUPERSEDED BY HUMAN RE-ESTIMATION.
- **Alternatives considered:** Mantener8SP; expansión silenciosa; split humano aprobado5+8+8.
- **Recommendation:** APPROVED — RE-ESTIMATED / SPLIT 5 + 8 + 8 = 21 SP.
- **Trade-offs:** Tres slices secuenciales revisables; ningún target es Forecast/Commitment/Actual y no hay fechas asignadas.
- **Data integrity impact:** 01D-A/B no activan;01D-C sólo activa tras controles/evidencia/VERIFY completos.
- **Concurrency impact:** Cada slice incluye pruebas de su protocolo;01D-C ensayo de barrier/waiting writers/stale runtime.
- **Idempotency/rerun impact:** 01D-A da control/checkpoints,01D-B resume exactly-once,01D-C CAS/autoridad conjunta.
- **01A compatibility:** Core aprobado permanece DORMANT hasta corte coordinado.
- **01B compatibility:** Receipt/manual/proyecciones permanecen DORMANT hasta01D-C autorizado.
- **01C compatibility:** Candidate C/replay/legacy gates aprobados preservados, DORMANT hasta corte.
- **Cutover dependency:** 01D-A COMPLETE / MERGED PR #82→01D-B IMPLEMENTED / TESTED (pending review/merge)→01D-C BLOCKED hasta aceptación/merge01D-B;01E sigue bloqueado por completion/activation01D.
- **Rollback/recovery impact:** Matriz I obligatoria, opening-only resume y forward-fix después de business Effect.
- **Scope impact:** A5+B8+C8=21SP TARGET; scopes detallados K; sin frontend/FEFO/Delivery/SalesOrder/Dispatch/Return.
- **Test implications:** Focused control/classifier tests A; isolated PostgreSQL opening/verify B; ensayo operacional completo C.
- **Open question:** Resuelta por reestimación y split humanos. 01D-A COMPLETE / MERGED — PR #82; 01D-B IMPLEMENTED / TESTED — pending human review/merge; 01D-C BLOCKED.
- **Status:** APPROVED — RE-ESTIMATED / SPLIT 5 + 8 + 8 = 21 SP

## E. Reconciliation model

### E.1 Ecuaciones exactas

Para cada Company C y Product P con inventoryTracking=QUANTITY, sea q(s) la
cantidad de cada Position propia de P. AVAILABLE y CUSTODY son los únicos estados
persistidos actuales; no existe estado terminal en Position.

```text
A_state(P,b) = Σ q(s) con state=AVAILABLE y inventoryBatchId=b (b puede ser null)
C(P,b)       = Σ q(s) con state=CUSTODY y inventoryBatchId=b
owned(P)     = Σ_b [A_state(P,b) + C(P,b)]
inCustody(P) = Σ_b C(P,b)
eligible(s,t)= Product.isActive AND
              (batch=null OR (Batch.isActive AND
               (expirationDate=null OR expirationDate>t)))
available(P,t) = Σ q(s) donde state=AVAILABLE AND eligible(s,t)
unbatchedOwned(P) = A_state(P,null) + C(P,null)
batchedOwned(P)   = Σ_b!=null [A_state(P,b) + C(P,b)]
owned(P) = unbatchedOwned(P) + batchedOwned(P)
Product.stock = owned(P)                       después del corte
Batch.availableQuantity(b) = A_state(P,b)       después del corte
Batch.initialQuantity = histórico recibido     sin reset ni backfill de apertura
availableForSale01C(P,t) =
  A_state(P,null) si P activo, QUANTITY y lotTracking NONE u OPTIONAL;
  0 / operación rechazada para REQUIRED, ASSET, SERIALIZED.
```

No siempre owned=available+inCustody: puede haber AVAILABLE-state no elegible, cuya apertura truthful autoriza TD-09.
El saldo batch compatible no filtra expiración; la lectura elegible sí. No
sumar EquipmentAsset como material QUANTITY. Los totales usan aritmética exacta
y límite Int 0..2147483647, no tolerancia aproximada.

Precondición propuesta de apply: stock legacy ya conciliado = owned del manifest.
Si no coincide, documentar/resolver en un trabajo autorizado y regenerar snapshot;
no hacer COUNT_CORRECTION encubierto. La diferencia entre availableQuantity legacy
y saldo físico batch puede resolverse explícitamente mediante el baseline TD-15
si hay evidencia real por batch y autorización old→new. Nunca resolver owned
por distribución proporcional ni asumir que initialQuantity es saldo.

### E.2 Ejemplos ilustrativos, no datos consultados

| Caso | Evidencia física revisada | Opening / ecuaciones | Resultado |
| --- | --- | --- | --- |
| NONE | stock9, 9 libres sin lote | unbatched9, owned9, available9, custody0; stock permanece9 | PASS si elegible y restantes gates pasan |
| NONE cero | stock0, conteo0, ninguna Position | manifest certificado0, sin CREDIT vacío; owned0 | PASS con control durable TD-12 |
| REQUIRED | stock8, batch A3 + B5 reales/elegibles | owned8, batch projections3/5, available8 | Física reconciliada; Sales REQUIRED sigue rechazado |
| OPTIONAL unbatched | stock8, 8 realmente sin lote | owned8, Sales pool8 | PASS |
| OPTIONAL batched | stock8, A8 reales, históricamente vendibles | owned8 y físico available8; Sales pool0 | BLOCK OPTIONAL_ACCESSIBILITY |
| OPTIONAL mixed | stock10, unbatched4 contadas + A6 contadas | owned10, available10, Sales pool4 | BLOCK si esas6 eran vendibles; si uso/evidencia desconocido, también BLOCK |
| OPTIONAL con residual no probado | stock10, batch A6 documentado, resto desconocido | no deducir unbatched4 de 10−6 | BLOCK MANUAL_RESOLUTION_REQUIRED |
| REQUIRED discrepancia | stock10, lotes conciliados6 | faltan4 de identidad/propiedad | BLOCK; no UNKNOWN batch |
| Batch counter legacy stale | stock6, lote A6 físico, availableQuantity10, initialQuantity12 | old10→baseline6 aprobado; initial12 intacto | Resolved discrepancy documentada; PASS sólo después de revisión, no silencio |
| Custodia real | stock10, libres6 + custody4 | owned10, available6, custody4 | Initializer opening-only reproduce contexto durable válido y representable; si falta/ambiguo, BLOCK; nunca ubicar10 en AVAILABLE |
| Vencido/inactivo propio | stock7, lote vencido7 propio en estado físico AVAILABLE | owned7; eligible available0; A_state7 | Apertura opening-only aprobada: metadata intacta; operaciones normales continúan rechazando consumo |
| Pool inesperado | stock5, Position previa5 sin opening certificado | sumar otro crédito produciría10 | BLOCK UNKNOWN_PHYSICAL_BASELINE |

Los códigos de reporte y nombres conceptuales aprobados aún no son schema/API implementados.
RECONCILED significa igualdad física demostrada; DISCREPANCY es hallazgo,
MANUAL_RESOLUTION_REQUIRED exige evidencia/decisión, BLOCKING_DISCREPANCY impide
corte. Ninguna “excepción” puede autorizar diferencia persistente stock≠owned.
Excepciones aceptables sólo explican historia incompleta no necesaria para
linaje actual, con evidencia de conteo y revisión suficiente.

### E.3 Gates de parity

| Check | PASS | WARN permitido | BLOCK |
| --- | --- | --- | --- |
| Stock / owned | Igualdad exacta por Product y Company | Ninguno | Diferencia, negativo, overflow |
| Batches | AVAILABLE-state por batch igual proyección; initial intacto; diferencia legacy resuelta con evidencia old→new revisada | Sólo documentación histórica no esencial ausente | Cantidad física/identidad sin probar, residual distribuido o normalización no revisada |
| Canonical pools | Identidad exacta, cero o una por clave, FKs tenant | Ninguno | Duplicado, batch ajeno, estado/contexto inválido |
| Opening evidence | Un Effect por Product positivo, líneas desde0/revision0→1, origen/hash exactos; ceros certificados | Ninguno | Effect/Line/progreso ausente o incoherente |
| Elegibilidad | Initializer abre propiedad real sin alterar elegibilidad; uso normal respeta policy01A a asOf | Ninguno | Estado/contexto no representable o custody sin contexto durable; no elegibilidad no se oculta ni se cambia |
| OPTIONAL | Sin pérdida de acceso demostrada y revisión comercial completa | Ninguno | Stock batched históricamente vendible inaccesible o desconocido |
| Legacy Sales/Receipts | Membership DB exacto; relaciones/completions coherentes | Movimiento antiguo sin actor/nota sólo si es documentación no esencial y no afecta cantidad/identidad/autoridad/seguridad | UNKNOWN, Sale fuera del conjunto sin Effect cuando debería tenerlo, flag inconsistente |
| Writer inventory | Cada ruta/job cubierto, cero bypass | Ninguno | Writer desconocido, helper vivo, deployment no acreditado |
| Barrier | Procesos drained/fenced y build homogéneo | Ninguno | Nueva escritura o conexión antigua habilitada |
| Observability | Manifest externo y DB control/aprobación/results recuperables por digest | Nota histórica no esencial ausente | Archivo/control perdido, hash alterado |
| Dormancy pre-activate | Sólo opening aprobado; cero Effect empresarial nuevo | Ninguno | Effect desde ruta productiva antes de activación |
| Scope | Sólo QUANTITY y requisitos acordados | Ninguno | FEFO, fulfillment o UI imprescindibles para completar el corte |

WARN sólo documentación histórica no esencial, con razón/responsable; no degrada
un BLOCK ni habilita best-effort. Cantidad/identidad/autoridad/seguridad inciertas,
manifest/control missing, UNKNOWN Sales, tenant/idempotency/barrier/parity fallidos
jamás son WARN. Estados/checks conceptuales aprobados, todavía no implementados.

## F. Opening manifest proposal

Contrato aprobado: artefacto JSON canónico versionado, acompañado de resumen
Markdown/CSV opcional. Full manifest externo con acceso controlado, backup,
recuperación y comprobación de integridad; no almacenar automáticamente manifests
reales en Git. DB dedicada conserva control/digest/membership/progreso según TD-12
aprobada. Schema/migración01D-A implementados localmente y validados sólo en DB efímera aislada; no deployment productivo.

Campos requeridos del plan: formatVersion; cutoverId estable; companyId; baseline
build; snapshotFingerprint; referencia de freeze; evidencia física/revisor;
Product tracking/lotTracking/isActive y stock previo; batches exactos con metadata
y old counters; pools con contexto; quantity; sourceClassification; referencias
legacy; discrepancyStatus/resolution; expected owned/available/custody/projections;
legacyConfirmedSales completos y fingerprints; checkpoints esperados incluso cero.
No usar sólo una lista de Products con stock>0: conservar catálogo QUANTITY completo,
batches a cero incluidos en verificación y Sales confirmadas completas.

Ejemplo sólo ilustrativo permitido en documentación; no contiene datos reales.
Identificadores inventados de muestra; digest se calcula, no se proporciona uno falso:

```json
{
  "formatVersion": 1,
  "cutoverId": "11111111-1111-4111-8111-111111111111",
  "companyId": "22222222-2222-4222-8222-222222222222",
  "baselineBuild": "c3d0824",
  "freezeEvidenceRef": "example/freeze-evidence",
  "snapshotFingerprint": "<sha256-calculado-de-fuentes-congeladas>",
  "products": [{
    "productId": "33333333-3333-4333-8333-333333333333",
    "inventoryTracking": "QUANTITY",
    "lotTracking": "NONE",
    "stockBefore": 9,
    "sourceClassification": "RECONCILED_UNBATCHED",
    "evidenceRefs": ["example/reviewed-count"],
    "discrepancyStatus": "RECONCILED",
    "pools": [{
      "inventoryBatchId": null,
      "state": "AVAILABLE",
      "contextType": null,
      "contextId": null,
      "quantity": 9,
      "revisionBefore": 0,
      "revisionAfter": 1
    }],
    "expected": {"owned": 9, "available": 9, "inCustody": 0},
    "openingOrigin": {
      "type": "INVENTORY_OPENING",
      "id": "11111111-1111-4111-8111-111111111111",
      "operation": "OPEN_33333333-3333-4333-8333-333333333333"
    }
  }],
  "legacyConfirmedSales": [{
    "saleId": "44444444-4444-4444-8444-444444444444",
    "statusAtFreeze": "CONFIRMED",
    "quoteId": null,
    "evidenceRef": "example/confirmed-sale-fingerprint"
  }]
}
```

Esta muestra omite otras filas, metadata y fingerprints completos por legibilidad;
no es un archivo ejecutable. Location es el pool lógico 01A, sin afirmar warehouse
concreto. Evidencia de ubicación física real puede referenciarse en el artefacto;
si necesita varios pools distinguibles no soportados, STOP, no colapsarlos
silenciosamente para aparentar trazabilidad.

**Identidad determinista:** (Company,cutoverId,Product) identifica el opening;
(Product,batch,state,context) identifica pool. Los UUID de Position/Effect los asigna
el initializer una vez y el resultado los vincula al manifest; no se requiere que sean
hashes de los datos. Los nombres de origen deben validarse contra longitudes/contratos existentes durante implementación.
El hash del plan incluye cantidades, metadata, membership y decisiones; excluye
hora/correlationId de cada ejecución, firma externa y el propio digest para evitar
circularidad. El physicalRequestHash del core es distinto y conserva su versión
vigente; reason puede vincular digest. Actor histórico no se sobrescribe.

No regenerar cutoverId al repetir comando. Un plan revisado se conserva inmutable; si antes de APPLY se requiere otra versión,
se produce otro artefacto y se exige nueva aprobación explícita. Desde que APPLY
empieza, digest/control quedan fijos; después de cualquier Product committed no se
cambian cantidades/plan. Recovery conserva identidad, no crea un segundo baseline.
Hash determinista no equivale a autorización: conservar aprobación del revisor
sobre ese digest y destino.

Alternativas cerradas por revisión humana: stdout solo se pierde/no arbitra; archivo
local no será autoridad; staging DB completo del manifest no es requerido.
Full manifest externo seguro y DB dedicada de control/digest/membership/progreso
son la solución aprobada. No sobrecargar Sequence/IdempotencyRecord/Effects vacíos.

### F.1 Persistencia conceptual dedicada — decisión aprobada, implementación01D-A

Nombres conceptuales recomendados; no pseudocode Prisma ni migración en este delta.

| Estructura | Propósito / mínimo conceptual |
| --- | --- |
| InventoryCutover | id/cutoverId, companyId, manifestDigest, snapshotFingerprint, baselineBuild, status, revision, initiatedBy, approvedBy nullable según lifecycle, activatedBy nullable, createdAt, updatedAt, activatedAt nullable |
| InventoryCutoverProduct | cutoverId, companyId, productId, manifestProductFingerprint, status, expectedOwned, expectedAvailable, expectedCustody, openingEffectId nullable, appliedAt nullable, verifiedAt nullable y before/expected projection evidence necesaria para recovery |
| InventoryCutoverLegacySale | cutoverId, companyId, saleId, saleFingerprint, quoteId nullable, statusAtFreeze, capturedAt y evidence/fingerprint metadata necesaria |

**InventoryCutover:** autoridad Company-scoped de epoch legacy→physical; como máximo
un epoch activo por Company. Identidad estable, jamás regenerada por retry.
Lifecycle conceptual PRECHECK→WRITERS_FROZEN→DRY_RUN_REVIEWED→OPENING_APPLYING→
OPENING_APPLIED→VERIFIED→PHYSICAL_ACTIVE, con RECOVERY_REQUIRED ante failure.
Toda transición usa revision/CAS y precondiciones fail-closed. ManifestDigest
immutable al empezar APPLY; no cambiar quantities después de primer Product committed.
PHYSICAL_ACTIVE es fuente durable de routing Company. Estado missing/incoherente
no permite adivinar autoridad ni fallback; sólo ausencia válida del epoch de una
Company aún legacy puede resolverse LEGACY según contrato implementado/revisado.

**InventoryCutoverProduct:** UNIQUE(cutoverId,productId), tenant coherente y TODOS
los QUANTITY Products incluidos, también0. Checkpoint confirmado en MISMA tx que
opening Effect/Lines/Positions y baseline projection. Baseline0 usa checkpoint sin
Position/Effect sintético. Coherent rerun ZERO WRITES; parcial/incoherente BLOCK.
Before evidence incluye stock/batch counters revisados para recovery; expectedOwned,
expectedAvailable y expectedCustody no confunden saldo AVAILABLE-state batch con
available elegible. asOf/elegibilidad se vinculan al snapshot y se reevalúan en VERIFY.

**InventoryCutoverLegacySale:** UNIQUE(cutoverId,saleId), Company+Sale exactos;
statusAtFreeze CONFIRMED legítimo sin Effect físico, fingerprint de negocio/items y
relación Quote para detectar contradicción. Membership immutable para epoch aplicado/
verificado. DRAFT y Quotes no convertidas excluidas; Sale fuera sin Effect requerido
=> UNKNOWN/integridad; miembro con Effect contradictorio=>BLOCK. Sin timestamp-only.

El dry-run final sigue read-only: produce artefacto, no inserta membership ni control.
Persistir aprobación/digest/membership/checkpoints esperados corresponde a un comando
controlado posterior a revisión, bajo freeze y verificando snapshot vigente.
No mantener SQL tx esperando decisión humana. Enum names, FKs compuestas, relations, indexes y migration implementados en01D-A
tras autorización; véase §A.1 y schema/migration.
Resolver foundation01D-A no cambia rutas productivas ni activa nada.

La identidad técnica del operador se conserva además del business/audit actor User
autorizado en evidencia operacional, sin asumir que DB/runtime identity sea User.
Inventario de control no se usa como depósito de secretos ni datos clínicos.

## G. Cutover state machine / runbook

Lifecycle aprobado: enums/control/CAS implementados en01D-A, sin APPLY/VERIFY ni activación.
El schema se validó sólo en DB de aceptación efímera; no está desplegado en producción. InventoryCutover
es autoridad DB durable y el router único consume ese estado, nunca checkpoints Product.

```text
LEGACY_ACTIVE → PRECHECK → WRITERS_FROZEN
  → DRY_RUN_REVIEWED → OPENING_APPLYING → OPENING_APPLIED → VERIFIED
  → PHYSICAL_ACTIVE (tráfico aún cerrado) → ACCEPTED / UNFROZEN
Cualquier gate fallido → FAILED / RECOVERY_REQUIRED (tráfico cerrado)
```

### G.1 Alternativas de barrier y recomendación

| Opción | Ventaja | Límite / decisión |
| --- | --- | --- |
| A. Maintenance/write freeze | Simple, permite snapshot final y revisión | HTTP guard solo no detiene jobs/direct SQL; necesita stop/drain y fence de identidades escritoras |
| B. Deployment/runtime switch | Una versión puede cablear todas rutas | Rolling deploy/flags independientes producen ventanas híbridas; usar bajo A y control durable |
| C. Lock de DB | Locks de tablas pueden frenar writes mientras tx viva | No sobreviven entre tx por Product; pueden bloquear lecturas/FKs; advisory no obliga a legacy; no barrera única recomendada |
| D. Mecanismo repo existente | Reutilización si existiera | Config/módulos inspeccionados no ofrecen maintenance/epoch aplicable; autorización JWT no equivale a freeze |

Decisión aprobada A+B con global-freeze fallback: downtime explícito, bloquear tráfico mutador de Company
(o deployment completo si infraestructura no permite aislamiento tenant), detener
instancias/jobs, drenar tx existentes, impedir reconexión/escritura de la versión
legacy mediante fence operacional verificable. Identidades/ACL/routing concretos
se concretan con operaciones en01D-C. Sólo usar freeze Company si se prueba aislamiento
tenant de todos los writers. En caso contrario GLOBAL APPLICATION WRITE FREEZE
obligatorio, aunque manifests/applies/activación sigan Company-scoped.

Mantener sólo acceso del operador/control y herramientas autorizadas; no matar
transacciones desconocidas como rutina. Si no se puede demostrar exclusión total,
STOP. No inventar locks/advisory a los que legacy no obedece. Toda concesión/revocación
de permisos futura exige plan revisado; no se ejecuta aquí.

### G.2 Secuencia y STOP en cada gate

| Fase | Acción futura / evidencia obligatoria | STOP / recuperación |
| --- | --- | --- |
| PRECHECK | Diseño aprobado; acreditar control implementado, permisos/destino, KNOWN WRITERS=COMPLETE / UNKNOWN WRITERS=0, backup, build y recovery; preview read-only | Control requerido no implementado/verificado, writer desconocido, exclusión no garantizada o alcance fuera del aprobado |
| FREEZE | Cerrar tráfico, stop/drain, verificar cero tx mutadoras anteriores y fence que impida reconexión; congelar metadata y Sale/Quote/Receipt | No establecer snapshot hasta exclusión demostrada |
| DRY RUN | Snapshot final read-only, conteo/evidencia vigente, manifest completo, gates y digest | Discrepancia, OPTIONAL accessibility, opening no representable, residuos físicos desconocidos |
| HUMAN REVIEW | Revisar plan exacto/destino/digest, normalización batch old→new y legacy membership; guardar aprobación | Sin aprobación concreta no apply; si cambia cualquier fuente, repetir dry-run/revisión |
| APPLY OPENING | Epoch/digest fijos desde OPENING_APPLYING; Product a Product con control/initializer/Effect/adapter/InventoryCutoverProduct en misma tx | Failure parcial mantiene freeze; abort local y resume mismo plan; sin cambio de cantidades |
| VERIFY | Nueva sesión read-only, manifest↔DB exacto, paridad, no duplicados, cero Effect empresarial; comprobar fence | No reparar in-place desde VERIFY; abrir recovery |
| PREPARE ACTIVATION | Desplegar mismo binario compatible a todas instancias sin tráfico; wiring completo y classifier cargado | Una ruta legacy QUANTITY o instancia stale bloquea todas |
| ACTIVATE | CAS durable VERIFIED→PHYSICAL_ACTIVE; router único Company cambia todos los writers juntos; sin tráfico externo aún | Respuesta perdida => readback; estado ambiguo mantiene fence; ningún fallback a legacy |
| SMOKE / ACCEPTANCE | Checks read-only primero; ensayo de negocio ya aprobado en DB aislada; operación real controlada sólo si autorizada | Primer Effect empresarial committed cambia frontera rollback; fallo => forward-fix |
| UNFREEZE | Todas las instancias/paths atestiguados, parity/gates revalidados, fence antiguo sigue impidiendo legacy; abrir tráfico nuevo | Ningún request antiguo en cola ejecuta decisión legacy; debe reevaluar epoch |
| POST-CUTOVER VERIFY | Comprobar primeras operaciones, proyecciones y ausencia double writes; conservar evidencia y vigilancia operacional acordada | Mismatch => congelar de nuevo, diagnosticar con autoridad física intacta |

No esperar una revisión humana manteniendo una transacción SQL abierta: freeze
es operacional y durable; dry-run y apply usan transacciones acotadas.
No establecer límite temporal arbitrario del mantenimiento sin medir volumen.
Si vence la ventana, la salida no es unfreeze automático; aplicar matriz I.

### G.3 Single InventoryAuthorityResolver — contrato vinculante

Un resolver Company-scoped consulta InventoryCutover durable:
LEGACY permite writers legacy existentes; FROZEN/CUTOVER rechaza o declara
unavailable las mutaciones QUANTITY; PHYSICAL permite sólo writers físicos01A/B/C.
No flags separados para Receipt/manual/approve/createFromQuote. No routing desde
InventoryCutoverProduct. Error del path físico jamás habilita fallback legacy.
01D-A entrega foundation no activante; integración productiva sólo01D-C autorizado.
La ausencia válida de epoch antes de todo corte se distingue de control perdido/
incoherente; este último falla cerrado. Exactos caches/invalidation y protección
de requests stale deben mantener esta autoridad durable en implementación.

### G.4 Wiring y orden final

- Receipt: entrada pública conserva validaciones/RBAC/idempotencia; orquesta 01B
  con actor y tx owner. QUANTITY nunca ejecuta además legacy increment/registerBatch.
  ASSET/SERIALIZED conservan únicamente rama disjunta aprobada, incluida tx mixta.
- Manual: nueva frontera backend explícita; legacy QUANTITY se rechaza. Ninguna
  traducción silenciosa IN/OUT/ADJUSTMENT Product-only a fuente física.
- Sales: approve y createFromQuote ambos 01C, actor JWT, classifier durable,
  mismo shape/replay y REQUIRED rechazado. Create DRAFT/cancel no se convierten en OUT.
- Projection/history: sólo callbacks físicos transaccionales después del core;
  adapter opening inaccesible desde rutas de negocio.
- Readers: no exponer Positions parciales; stock owned no se usa para autorizar
  gasto. Lecturas de pools/revision manuales necesitan contrato tenant-safe.
  lowStock/Dashboard/existing stock readers conservan su semántica actual y no pasan a
  representar spendable availability. Nuevas reglas de low-stock/fulfillment quedan
  fuera de01D y requieren producto/scope posterior; no agregar UI.
- Retirar/inhibir registerPurchaseEntry; test estático de dormancia se sustituirá
  de forma selectiva por whitelist de wiring aprobado + prohibición de bypass, no
  se elimina toda protección.
- Jerarquías observadas: Receipt claim→Purchase→ASSET_CODE→Products;
  approve Sale→Products; convert SALE_FOLIO→Quote→Sale→Products;
  manual claim→Products. Después TODOS Batches ASC→TODAS Positions ASC.
  Quotes y Equipment inspeccionados no mostraron inversión de ese grafo; repetir
  auditoría del wiring final y probar concurrencia. No es aceptación ya ejecutada.
- Control del cutover precede roots sólo en tooling. No introducir Company lock
  exclusivo permanente para todas las ventas: contradice el alcance de los
  protocolos aprobados y requiere otra revisión.

## H. Legacy classification matrix

| Estado observado con epoch certificado | Clasificación / operación | Efecto y respuesta |
| --- | --- | --- |
| CONFIRMED al freeze, membership exacto, sin Effect | LEGACY | Error histórico ya aprobada/convertida; cero OUT nuevo, cero writes |
| DRAFT al freeze, confirmado después | Primera confirmación física | Effect SALE/id/CONFIRM atómico; createdAt antiguo irrelevante |
| Quote anterior no convertida, convertida después | Conversión física | Sale canónica nueva + un Effect; folio una vez |
| Quote ya convertida antes | Clasificar Sale relacionada | Membership legacy válido conserva error histórico; flag/relación incoherente falla |
| Post-cutover con Effect coherente | PHYSICAL | Mismo actor actualmente autorizado: éxito ZERO WRITES; otro actor: error histórico ZERO WRITES |
| CONFIRMED fuera del membership, sin Effect | Integrity failure / UNKNOWN | Falla cerrado, sin recrear OUT ni agregarla al manifest retroactivamente |
| Membership legacy pero Effect inesperado | Contradicción | BLOCK; investigar sin borrar evidencia |
| Manifest no disponible/hash erróneo/Company incorrecta | UNKNOWN | Falla cerrado; no fallback temporal ni “ausencia implica legacy” |
| DRAFT/CANCELLED con evidencia de confirmación física incompatible | Integrity failure | No reparar estado para que replay parezca válido |

Clasificador debe comprobar membership exacto y coherencia; timestamps son audit,
jamás criterio exclusivo. Sale confirmada antes de crear el cutover pero ajena al
snapshot final no se certifica por conjetura. COMPLETED IdempotencyRecord Receipt
previo conserva replay de Receipt; no inventar PhysicalEffect de ingreso histórico.

## I. Rollback matrix

| Punto | Comportamiento permitido propuesto | Prohibido / frontera |
| --- | --- | --- |
| Antes de opening committed | Abort tx; mantener o cerrar intento; volver LEGACY_ACTIVE sólo tras acreditar cero apertura y retirar fence de forma controlada | Reutilizar plan anterior tras nuevas escrituras legacy |
| Tras opening parcial/completo, antes de activar | Preferir resume del mismo plan con freeze; filas/Effects quedan append-only. Si se abandona, plan de recovery humano con before-images y verificación antes de habilitar legacy | DELETE/TRUNCATE de apertura, reset revision, segundo opening bajo nuevo ID; no asumir reversión total gratuita |
| Durante activación | Mantener tráfico cerrado, parar instancias incompatibles, leer control y completar/fijar forward. Rollback sólo con pruebas de ausencia de efectos empresariales | Mezcla de runtimes atendiendo clientes, fallback automático |
| PHYSICAL_ACTIVE antes del primer Effect empresarial | Bajo freeze/drain probar cero no-opening Effects desde boundary, misma realidad/compatibilidad y before-images revisados; posible rollback de routing sólo mediante plan explícito, no automático | Un simple redeploy legacy no acredita seguridad; cambios catálogo/negocio también se evalúan |
| Después del primer Effect empresarial committed | Freeze, diagnóstico, forward-fix compatible con autoridad física e idempotencia; eventual migración inversa exige nuevo diseño/reconciliación | Volver writers stock legacy; borrar Effects; simular replay histórico; auto-rollback de aplicación |

El límite incluye Receipt, Sale, manual IN/OUT y COUNT_CORRECTION delta0.
Un smoke real committed cuenta; una prueba aislada no. Resultado de commit
incierto se trata conservadoramente como posible efecto hasta leerlo de nuevo.
Una eventual reanudación legacy con apertura retained exige plan de recovery bajo
freeze y ausencia completa probada de nuevos hechos físicos empresariales; no se
autoriza un reset ni se suma otro crédito. Tras el primer business Effect, sólo
FREEZE→DIAGNOSE→FORWARD-FIX; la aprobación del diseño no autoriza ejecutar recovery real.

## J. Test plan — no ejecutado

### J.1 Unit / integration futura

| Grupo | Casos / aserciones |
| --- | --- |
| Reconciliación | NONE, REQUIRED batch, OPTIONAL unbatched/batch/mixed, owned vencido/inactivo conservado y custody válida exacta; missing/ambiguous context bloqueado; ADJUSTMENT absoluto; residual sin linaje; initialQuantity intacto |
| Manifest | Orden canónico, null/UUID/UTC, digest estable, referencias/evidencia, snapshot distinto invalida; todos Products incluso0 |
| Dry-run | Cero writes incluyendo claims/control; repetición mismo snapshot; preview online no autoriza apply |
| Apply | Initializer opening-only con state/eligibility separados, before0→q/revision1, stock no duplicado, batch baseline old→new aprobado; cero sin Effect vacío; límite1000 |
| Idempotencia | Duplicate apply, distinto digest, distinto cutoverId sobre baseline existente, respuesta perdida, lectura fresca tras claim conflict |
| Fallos | Antes/después de cabecera, Position, líneas, proyección batch, checkpoint y commit; tx revierte todo Product; resume parcial |
| Legacy | CONFIRMED certificado; UNKNOWN; DRAFT viejo; Quote vieja; flag incoherente; mismo/otro actor; actor histórico inactivo |
| Receipt boundary | Replay key legacy devuelve Receipt sin stock/batch/Equipment nuevos; mismatch y completion roto bloquean |
| Parity | Igualdad stock/owned; batch estado vs elegibilidad; cross-tenant, duplicados, negativos/overflow, líneas incorrectas aun suma igual |
| Routing | Inventario completo, legacy QUANTITY rechazado, helper inhibido, Receipt mixto, ambos Sales activos juntos, readers sin apertura parcial |
| Máquina de estados | Ninguna transición salta aprobación/VERIFY; dos operadores; stale build/epoch; freeze perdido impide activate |
| Recovery | Inmutabilidad de apertura; rollback antes/después primer efecto y count0; sin auto-unfreeze por timeout |
| Seguridad | Company requerida, sin all-company, destino errado, actor sin rol, error sanitizado, archivo alterado/faltante |
| Regresión | Suites01A/B/C, Sales legacy para Companies aún LEGACY según router Company aprobado; no cambios tracking/lot/FEFO |

### J.2 PostgreSQL futuro, exclusivamente aislado

- Dos conexiones independientes: writer legacy en vuelo al cerrar barrera; esperar
  drain y demostrar que no puede entrar otro antes del snapshot final.
- Receipt durante reconciliación, Sale confirm durante snapshot y manual OUT durante
  apply: bloqueados/rechazados por fence, nunca ejecución tardía con modo anterior.
- Mismo manifest concurrent apply: un opening por Product, única Position canónica,
  mismas líneas/revisiones; perdedor rollback + readback.
- Mismo origen/payload distinto, incluso Products distintos: UNIQUE origen y control
  rechazan sin saldos parciales; P2002 arbitrario no se vuelve éxito.
- Interrupción antes/después de commit y entre Products: progreso durable consistente,
  rerun no incrementa proyecciones; no control committed sin opening correspondiente.
- Falla de constraint diferida revierte Position/Effect/proyección/checkpoint.
- Activación con request esperando y réplica stale: ningún legacy write tras boundary.
- Primer Receipt/manual/Sale post-cutover: un Effect, Movement compatible y una
  proyección, sin escritura adicional legacy; REQUIRED rechazado y OPTIONAL gate intacto.
- Aceptación mixta ASSET/QUANTITY sin duplicar Assets/Positions.
- Forward recovery después de efecto y bloqueo del rollback legacy.
- Medir bloqueo material con PID/`pg_blocking_pids`, gates deterministas y evidencia
  de dos clientes; no sleeps como única prueba.
- DB aislada explicitada por tarea de implementación, destino verificado, roles
  adecuados sin superusuario de ejecución, fixtures identificadas, cleanup verificado.
  `127.0.0.1:5434 / zaping_spike_test` es sólo antecedente01C, **no autorización de
  reutilización**; esta tarea no la accedió.

### J.3 Cutover acceptance posterior

Antes de cualquier entorno real: ensayo completo del runbook sobre datos sintéticos
en DB aislada, incluyendo restart de operadores y aplicaciones, version skew,
rollback boundaries y recuperación desde artefacto retenido. Luego aprobación del
manifest específico de destino, fence demostrado y VERIFY independiente.

Después de activar: comprobar primeros Receipt, IN/OUT/count y Sale autorizados;
correlacionar negocio→Effect→Lines→Movement→proyecciones, ausencia de doble IN/OUT,
replay por key/origen, Product.stock parity, batch parity y prohibición legacy.
No inventar compras/ventas de prueba sobre stock real ni limpiar evidencia productiva.
Si todavía no hay operación autorizada de negocio, registrar aceptación de ese caso
PENDING, no PASS inventado. Cutover no se declara aceptado completamente hasta cubrir
los checks requeridos. Fallo relevante mantiene/repone freeze.

## K. Human review closeout, implementation slices & future cutover gates

### K.1 Design approval

CTO/Architecture/Product review complete. DOC DELTA aplicado: TECHNICAL DESIGN
APPROVED, TD-INV-01D-01..32 =32/32 human approved con restricciones vinculantes.
No queda decisión abierta de producto/arquitectura/persistencia para este diseño.
01D-A implementa Prisma/migración y control/resolver internos. CLI, routing productivo y opening siguen sin implementar.
DESIGN APPROVED y CUTOVER READY son estados diferentes.

Los siguientes son requisitos de implementación/gates futuros, no TD pendientes:
writer certification real; conciliación/evidencia de Company; factibilidad/fence
real; manifest/digest revisados; accesibilidad OPTIONAL efectiva; parity y rerun;
autorización de operador/actor y ensayo/aceptación. Si alguno falla, STOP CUTOVER.
Si aparece estado/contexto no representable o alcance nuevo, se abre revisión
posterior explícita sin fingir que este diseño lo aprobó.

### K.2 Split humano aprobado

Original HC-INVENTORY-CUSTODY-01D TARGET: **8 SP — SUPERSEDED BY HUMAN RE-ESTIMATION**.
Revised TOTAL01D TARGET: **21 SP**; sólo TARGET, sin Forecast/Commitment/Actual ni fechas.

| Slice | Título | TARGET | Estado |
| --- | --- | --- | --- |
| HC-INVENTORY-CUSTODY-01D-A | Durable Cutover Control & Legacy Classification Foundation | 5 SP | COMPLETE / MERGED — PR #82 — NON-ACTIVATING |
| HC-INVENTORY-CUSTODY-01D-B | Reconciliation, Opening Baseline & Verification | 8 SP | IMPLEMENTED / TESTED — pending human review/merge — NO PRODUCTIVE ACTIVATION |
| HC-INVENTORY-CUSTODY-01D-C | Authority Cutover, Writer Wiring & Operational Activation | 8 SP | BLOCKED BY HC-INVENTORY-CUSTODY-01D-B — IMPLEMENTATION: NOT STARTED |
| HC-INVENTORY-CUSTODY-01D umbrella | Re-estimated implementation split | 21 SP = 5 + 8 + 8 | TECHNICAL DESIGN: APPROVED — 01D-A IMPLEMENTED / TESTED; B/C BLOCKED |

**01D-A — TARGET5SP:** dedicated cutover persistence design/implementation,
InventoryCutover/Product/LegacySale y Prisma/schema/migration implementados tras
autorización de implementación; lifecycle/CAS, digest binding, Product checkpoints
incluidos ceros, DB legacy membership, SalesLegacyClassifier desde fuente durable,
authority resolver foundation sin routing/activación productiva y focused tests.
Debe permanecer non-activating.

**01D-B — TARGET8SP:** precheck/reconciliation, manifest determinista y dry-run,
discrepancias/OPTIONAL hard gate, opening-only initializer, owned vencido/inactivo
sin hacerlo elegible, CUSTODY representable sólo con contexto durable válido,
opening Effect baseline, adapter exclusivo de proyecciones, APPLY por Product,
exactly-once resume, VERIFY y PostgreSQL aislado. Sin activación productiva.

**01D-C — TARGET8SP:** integración del único InventoryAuthorityResolver,
Receipt QUANTITY→01B, manual backend físico/rechazo legacy QUANTITY,
approve/createFromQuote→01C, readers compatibles con semántica preservada,
writer barrier/runbook, activation transitions, stale runtime protection,
acceptance y gates de rollback/forward-recovery con ensayo operacional completo.
Sin frontend, FEFO/FIFO comercial, lot picker, Delivery, SalesOrder, Dispatch o Return.

**HC-INVENTORY-CUSTODY-01D-A COMPLETE / MERGED — PR #82.**
01D-B IMPLEMENTED / TESTED — pending human review/merge;01D-C continúa BLOCKED hasta aceptación/merge01D-B.
01E sigue BLOCKED por completion/activation01D según sus dependencias; Dispatch
también permanece bloqueado por el fundamento correspondiente. No marcar ningún
slice de implementación IN PROGRESS/COMPLETE por aprobación del diseño.

### K.3 Operational cutover gates

| Gate | Evidencia requerida / STOP |
| --- | --- |
| Writer certification | KNOWN WRITERS = COMPLETE; UNKNOWN WRITERS = 0; instancias, scheduled jobs, workers externos/internos, SQL directo, versiones antiguas y caminos fuera del repo |
| Company reconciliation | Cantidad/identidad actuales demostradas; correcciones necesarias previamente autorizadas y nuevo snapshot/dry-run/revisión |
| Opening representation | Initializer específico conserva propiedad no elegible; CUSTODY exacta con contexto durable; no inventar hechos/estados/contextos |
| OPTIONAL | Pool real preservado; vendible batched inaccesible o evidencia ambigua => BLOCK Company |
| Freeze | Tenant sólo con prueba de aislamiento total; si no GLOBAL APPLICATION WRITE FREEZE; no exclusión demostrable => STOP |
| Durable control & routing | DB control/membership/checkpoints implementados y verificados; Company authority única; nunca routing por Product ni fallback físico→legacy |
| Manifest / audit storage | Artefactos externos con acceso/backup/recovery/integridad, digest y aprobación; sin Git real por defecto, secretos ni clinical data |
| Rerun / parity / tenant | Coherencia exacta, ZERO WRITES en replay, stock=owned y batch=AVAILABLE-state; UNKNOWN/incoherencia no son WARN |
| VERIFY / activation | Fresh independent VERIFY sin reparación; sólo VERIFIED hacia PHYSICAL_ACTIVE, todos writers y réplicas homogéneos |
| Recovery / acceptance | Ensayo aislado completo; después primer business Effect FREEZE→DIAGNOSE→FORWARD-FIX; no cleanup productivo sintético |
| Operator / actor | Operador técnico distinto de Company User autorizado requerido por Effect; auditar ambos, no crear User ficticio |

WARN sólo documentación histórica no esencial que no afecte quantity, identity,
authority o seguridad del corte. No override de BLOCK.

Estado final: TECHNICAL DESIGN APPROVED32/32;01D-A COMPLETE / MERGED — PR #82;01D-B IMPLEMENTED / TESTED — pending human review/merge;
01A/01B/01C DORMANT;01D ACTIVATION NOT STARTED;M-HC1 OPEN.
Migraciones y pruebas01D-A/B completadas sólo en entornos efímeros aislados.
Reconciliation/APPLY/VERIFY internos implementados; sin activation, staging, commit ni push.
Próximo paso: revisión humana → staging selectivo → commit → PR01D-B.
