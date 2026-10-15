# HC-CASE-DISPATCH — Case Dispatch Foundation / Physical Handoff

TECHNICAL DESIGN: APPROVED.
IMPLEMENTATION: HC-DSP-01A COMPLETE / MERGED — PR #89; HC-DSP-01B COMPLETE / MERGED — PR #90.
QUANTITY SOURCING BLOCKER: RESOLVED.

Baseline: `8b6a883d5a5a2b7c5cbef001428fb478051f81f5`.
Rama: `feat/hc-case-dispatch-foundation`.
Autoridad: Technical Design Approval Delta humano de HC-CASE-DISPATCH.
El Technical Design fue aprobado/merged por PR #88; 01A está merged por PR #89.
01B implementa comandos DRAFT e idempotencia, pendiente de revisión humana/merge.
Confirmación física y adapters productivos permanecen sin implementar.

## 1. Estado y dependencias

HC-INVENTORY-CUSTODY-01D: COMPLETE / MERGED. REAL COMPANY CUTOVER: NOT EXECUTED.
HC-INVENTORY-CUSTODY-01E: COMPLETE / MERGED; 01E-A PR #86 y 01E-B PR #87.
REAL EQUIPMENT RECONCILIATION: NOT EXECUTED.
PRODUCTIVE EQUIPMENT CUSTODY: NOT ENABLED: el registry productivo sigue cerrado
hasta implementar el contexto Dispatch real. RETURN: NOT IMPLEMENTED. M-HC1: OPEN.

La aprobación del diseño no activa 01D, no acredita Equipment y no habilita custodia productiva.
Las descripciones de discovery anteriores de CASE_LOGISTICS son históricas; este delta
refina DEC-DSP-05 y sustituye el bloqueo de implementación por Foundation pendiente.

Referencias canónicas:

- [Case Logistics §258](CASE_LOGISTICS.md#258-hc-case-dispatch--v1-approved-contract).
- [CaseKit](CASE_KITS.md), [Cases](CASES.md) y
  [Equipment Assignment TD](EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md).
- [Inventory Custody Definition](../erp/INVENTORY_CUSTODY_DEFINITION.md),
  [01E TD](../erp/INVENTORY_CUSTODY_01E_TECHNICAL_DESIGN.md) y
  [Project Board](../../project/PROJECT_BOARD.md).

## 2. Autoridad y lifecycle

CaseDispatch es la evidencia empresarial durable de una entrega física independiente.

```text
PREPARED != DISPATCHED
RESERVED != DELIVERED
Assignment != CUSTODY

Case 1:N Dispatches
DRAFT -> CONFIRMED
DRAFT -> CANCELLED
```

DRAFT no reserva stock ni capacidad preparada y puede quedar stale. CONFIRMED es
historia empresarial inmutable: sin edición, hard delete, cancelación o reversal
mediante comandos Dispatch. Return/Reconciliation futuro posee la reversión física
y su contabilización, conservando el hecho original.

Custodian híbrido: INTERNAL_USER / EXTERNAL_PERSON, ambos con nombre/displayName
histórico obligatorio. User FK opcional sólo para INTERNAL_USER y del mismo tenant;
EXTERNAL_PERSON no tiene User FK. Ser custodio no concede permisos del sistema.

## 3. Capacidad preparada, parcial y adicional

PARTIAL DISPATCH y múltiples episodios por Case: SUPPORTED. Sólo fuentes ACTIVE
del Kit preparado del mismo Company/Case. Para cada sourceCaseKitItemId:

```text
suma QUANTITY de Dispatches CONFIRMED + cantidad candidata <= preparedQuantity
```

Agrupar todas las líneas/fuentes físicas del mismo CaseKitItem antes de comparar.
No mutar preparedQuantity. Equipment puede despacharse una vez por fuente preparada.
Return no repone automáticamente capacidad. Material adicional o Equipment sustituto
que no figura en el Kit preparado requiere un contrato futuro de preparación;
no se añade al Dispatch mediante bypass.

## 4. DEC-DSP-05 refinada — fuentes QUANTITY explícitas

**Every QUANTITY Dispatch item must carry an exact physical source. A batch is
mandatory when the tracking policy or selected source is batched. Unbatched tracking
remains explicitly unbatched.**

Candidate C permanece SALES-ONLY. No se utiliza como política de sourcing Dispatch.
No FEFO, FIFO, primer batch/Position, asignación comercial ni fallback desde stock
agregado. El backend nunca elige un batch para completar una cantidad.

| Tracking | Fuente exacta requerida | Batch |
| --- | --- | --- |
| NONE | Position AVAILABLE canónica explícita, con revisión esperada | batchId = null; sin batch sintético |
| REQUIRED | Position AVAILABLE explícita y revisión esperada | Batch real exacto obligatorio |
| OPTIONAL | Una fuente física explícitamente elegida y revisión esperada | null si unbatched; Batch exacto si batched |

OPTIONAL no alterna automáticamente entre fuente loteada y sin lote. La Position
origen pertenece al mismo Company/Product, tiene state AVAILABLE y contextType/contextId
nulos. Batch, cuando aplica, pertenece al mismo Company/Product. Product y fuente
deben ser físicamente elegibles; validar actividad y caducidad aplicables bajo lock.
No autorizar desde Product.stock ni crear lotes para satisfacer Dispatch.

### Snapshot de fuente DRAFT

Al seleccionar una línea QUANTITY persistir Company, Dispatch/item,
sourceCaseKitItemId, productId derivado por backend, batchId nullable explícito,
source Position ID, expected Position revision y quantity positiva entera.
Backend deriva Product desde la fuente CaseKit y valida coherencia tenant/tracking.
Confirm relee y valida LA MISMA fuente y revisión bajo lock; no la sustituye.
Forma conceptual del comando add MATERIAL: sourceCaseKitItemId, quantity,
type MATERIAL, sourcePositionId, batchId explícito nullable y expectedRevision del Dispatch.
01B captura expectedPositionRevision del servidor bajo lock; el cliente no suministra
revisiones físicas. EQUIPMENT recibe sólo type, sourceCaseKitItemId y expectedRevision;
Assignment/Asset y expectedPhysicalRevision se derivan/capturan en backend.

## 5. Confirm QUANTITY

Reutilizar PhysicalInventory TRANSFER en la transacción del caller:

```text
AVAILABLE -q -> CUSTODY +q
owned sin cambio

originType      = CASE_DISPATCH
originId        = dispatch.id
originOperation = CONFIRM_QUANTITY
kind            = TRANSFER

destino.contextType = CASE_DISPATCH_ITEM
destino.contextId   = dispatchItem.id
```

Un Effect por confirmación puede incluir todas las transferencias QUANTITY.
Destino conserva Product y batch exacto del origen, incluido null. Validar el contexto
contra el Dispatch/item real, nunca aceptar strings como prueba de existencia.
No DEFINITIVE_OUT, CREDIT, OPENING ni COUNT_CORRECTION para handoff.
La proyección compatible preserva owned Product.stock; la proyección AVAILABLE del
batch disminuye sólo según las fuentes efectivamente loteadas transferidas.

## 6. Equipment y primer adapter productivo

Invocar EquipmentCustodyService.transferToCustody en la MISMA transacción Dispatch.
Revalidar Assignment RESERVED y mismo Company/Case/Asset; Asset ACTIVE + GOOD +
WAREHOUSE, activeCustodyId nulo, coherencia y expectedPhysicalRevision coincidente.
Agenda actual: fullyVerifiable=true y conflictFree=true; override de reserva no
omite dispatchability. Assignment sigue RESERVED, sin nuevo estado DISPATCHED.

```text
adapter/context = CASE_DISPATCH_ITEM / dispatchItem.id
originType      = CASE_DISPATCH_ITEM
originId        = dispatchItem.id
originOperation = CONFIRM_EQUIPMENT
```

Adapter real valida mediante el mismo tx Dispatch, revisión/estado, item ACTIVE,
Company, Case, Assignment, Asset, actor y origen durable. No contexto arbitrario,
config bypass ni evidencia ficticia. La implementación futura registrará este primer
adapter sin ciclos de módulos; este documento no cambia el registry actual vacío.
La revisión física observada queda ligada a la fuente DRAFT y se revalida al confirmar;
no se confía en la lectura PREPARED anterior.

## 7. Admisión y ausencia de estados duplicados

Case SCHEDULED, horario completo/ordenado; CaseKit PREPARED y readiness local actual
PASS. PREPARED solo tiene cero efecto físico. Confirm exitoso no cambia lifecycle
Case/CaseKit para duplicar provenance. Coverage y Case Availability no son gates
globales; DEC-CASE-AVL-01/02/03 y DEC-C5-COV-01..06 permanecen intactas.

Fuentes stale, Assignment released/replaced, revisión perdida, condición/lifecycle
inelegibles o capacidad agotada bloquean; no reparar Kit automáticamente ni cambiar
fuentes. Horario válido cambiado exige reevaluación de agenda y snapshot actual.

## 8. Atomicidad, locks y autoridad

CaseDispatchService posee una transacción. Estado empresarial, transferencias
QUANTITY, episodios/eventos Equipment, Positions/Effects, enlaces físicos, snapshot
inmutable, CONFIRMED, audit y completion idempotente se confirman juntos o se revierten
juntos. No nested physical transaction.

Orden conceptual vinculante:

```text
Inventory shared authority fence cuando existe QUANTITY
-> HC Company lock + timeouts
-> settings advisory shared si se requiere
-> Cases afectados FOR SHARE en orden determinista, sin upgrade
-> CaseKit
-> Dispatch / items
-> Products ASC
-> EquipmentAssets ASC
-> Requirements / Assignments ASC
-> otras raíces físicas según dominio (Batches / Positions)
-> authoritative reread / CAS / physical mutations
```

La implementación debe validar el orden contra los caminos reales antes de cambiar
código; no es una acreditación de concurrencia ejecutada. Nunca adquirir Inventory
fence después de HC. Bloquear también Cases relacionados necesarios para agenda.
HC-DSP-LOCK-01 acredita la dirección Case SHARE → Product → Asset → Assignment
para DRAFT. El orden exacto entre las demás raíces físicas de 01C sigue pendiente
de su aceptación específica; este delta no implementa ni acredita Confirm.

| Autoridad QUANTITY | Equipment-only | QUANTITY-only o mixto |
| --- | --- | --- |
| LEGACY | Permitido desde perspectiva QUANTITY, sujeto a admisión Equipment | Rechazar: requiere autoridad física |
| CUTOVER | Equipment independiente; respetar freeze/fencing operativo externo vigente | Rechazar; cero efectos físicos |
| PHYSICAL | Permitido | Permitido con runtime compatible y fuentes válidas |

Mixto exige PHYSICAL para QUANTITY y elegibilidad Equipment. Si cualquiera falla,
todo falla atómicamente. No activar 01D ni ejecutar adopción real en Dispatch.

## 9. Idempotencia y atribución

Idempotency-Key en CREATE, CUSTODIAN_SET, ITEM_ADD, ITEM_EXCLUDE, CONFIRM y CANCEL.
Reutilizar patrón Company/scope/key, claim/completion en la misma transacción.
Hash canónico versionado de intención: Company, target Dispatch cuando forma parte
del comando, expectedRevision del Dispatch, custodio, identidades de fuente, quantity,
batch nullable y razón aplicables. Excluir revisiones físicas observadas por servidor,
tiempo servidor, IDs generados que no son intención y actor del retry. No construir el hash desde hechos vivos cambiantes.

Misma key/request: replay lógico sin escrituras físicas duplicadas. Mismatch:
IDEMPOTENCY_KEY_REUSED / 409. Respuesta perdida: readback durable fresco.
Reintento de actor autorizado diferente devuelve evidencia original sin reatribuir
dispatchedBy, efecto ni episodio. CONFIRMED replay lee snapshot histórico y no
vuelve a validar disponibilidad viva. Nunca sobrescribir actor original.

## 10. Snapshot, persistencia y Return seam

Dirección aprobada: HealthcareCaseDispatch, HealthcareCaseDispatchItem y
HealthcareCaseDispatchAudit. Tenant-safe, revisionados, auditables, idempotentes y
trazables para Return; sin generic event sourcing. Prisma, FKs/índices/CHECKs exactos
y protección de inmutabilidad se concretan en HC-DSP-01A; el alcance local validado figura en §14.

CONFIRMED conserva snapshot histórico mínimo/versionado: Case/Kit/source item,
Requirement/Assignment, folio/horario, Product SKU/nombre/tracking, quantity, batch
si aplica, Positions origen/destino y revisiones, PhysicalEffect, Asset/code/serial,
revisión Equipment, custody/event IDs, custodio, actor e instante servidor del handoff.
FKs permiten navegar; snapshot conserva hechos ante cambios posteriores. Diagnóstico
actual separado. No copiar datos privados ni usar CaseKit mutable como única historia.

Dispatch sólo establece CUSTODY; no clasifica used/returned/unresolved. Return futuro
parte de DispatchItem y su pool CUSTODY/Effect QUANTITY o episodio Equipment exacto.
No cancellation/reversal de CONFIRMED en Dispatch. Recuperación/compensación futura
conserva historia; correction/reversal auditado sigue siendo gate de producción,
igual que recovery de PREPARED antes de uso amplio. No implementar Return aquí.

## 11. API, permisos y límites

Conservar comandos DRAFT y lectura de CASE_LOGISTICS §258.5; MATERIAL ahora recibe
Position/revisión explícitas y batch nullable según §4. Lectura ADMIN/MANAGER/SALES/
WAREHOUSE; mutaciones ADMIN/MANAGER/WAREHOUSE; Company y actor del JWT. Custodio no
autoriza. Foreign tenant como missing; errores estables sin internals DB.

Fuera: Return/Reconciliation, consumo, SalesOrder/Delivery, facturación, frontend,
SERIALIZED material, sourcing automático y reconciliación/cutover reales.

## 12. TARGET y secuencia aprobada

| Slice | Alcance | TARGET | Estado |
| --- | --- | --- | --- |
| HC-DSP-01A | Persistence, invariants & reads | 5 SP | COMPLETE / MERGED — PR #89 |
| HC-DSP-01B | DRAFT commands & idempotency | 5 SP | COMPLETE / MERGED — PR #90 |
| HC-DSP-LOCK-01 | DRAFT lock compatibility (delta adicional) | 3 SP | IMPLEMENTED / TESTED — pending human review/merge |
| HC-DSP-01C | Atomic confirm, physical adapters & concurrency | 8 SP | BLOCKED until HC-DSP-LOCK-01 merge |
| BACKEND TOTAL | Backend aprobado | 18 SP | 01A/01B MERGED; HC-DSP-LOCK-01 pending review/merge; 01C BLOCKED |
| HC-DSP-01D | Frontend | Candidate 5 SP | OUT OF CURRENT BACKEND SCOPE |

Sólo TARGET: sin Forecast, Commitment, Actual ni fechas asignadas. HC-DSP-LOCK-01
está pendiente de revisión humana/merge; 01C permanece bloqueado hasta ese merge.
QUANTITY SOURCING BLOCKER: RESOLVED. No queda una decisión FEFO/FIFO por inferir.

## 13. Validación futura y estado del cierre

Implementación futura: suites focales de contrato/RBAC/tenant/capacidad/replay y
PostgreSQL nuevo aislado con conexiones independientes y barreras observables.
Cubrir duplicados, sourcing NONE/REQUIRED/OPTIONAL sin fallback, revisiones stale,
agenda estricta, Inspection/Retirement/Replace/release, competencia por Asset/Position,
rollback cruzado, autoridad LEGACY/CUTOVER/PHYSICAL, provenance y owned sin doble descuento.
La aceptación estructural de 01A está registrada en §14; la concurrencia de confirmación
y la ejecución física de 01C permanecen pendientes.

TECHNICAL DESIGN: APPROVED. IMPLEMENTATION: HC-DSP-01A COMPLETE / MERGED — PR #89; HC-DSP-01B COMPLETE / MERGED — PR #90.
REAL COMPANY CUTOVER: NOT EXECUTED. REAL EQUIPMENT RECONCILIATION: NOT EXECUTED.
PRODUCTIVE EQUIPMENT CUSTODY: NOT ENABLED. RETURN: NOT IMPLEMENTED. M-HC1: OPEN.

## 14. HC-DSP-01A — implementación local validada

HC-DSP-01A: **COMPLETE / MERGED — PR #89**. TARGET: **5 SP**.
Baseline: `28de03737867d16116031f2688f048d61e168fd9` (PR #88).
Rama: `feat/hc-dsp-01a-persistence-reads`.

Una migración, `20261015000200_case_dispatch_persistence`, añade tres modelos
Dispatch, cinco enums, seis scopes del IdempotencyRecord existente, FKs tenant-safe,
CHECKs y uniques parciales. Sólo añade las dos claves parentales requeridas de
CaseKitItem y EquipmentAssetPhysicalEvent. Sin backfill ni activación real.

CONFIRMED y CANCELLED son terminales: root UPDATE/DELETE e item INSERT/UPDATE/DELETE
rechazados; el guard de items bloquea el parent antes de comprobar su estado.
Audit append-only y TRUNCATE rechazado en las tres tablas. Las comprobaciones
DEFERRABLE INITIALLY DEFERRED evalúan el estado final, permitiendo preparar snapshots
y enlaces mientras DRAFT, cambiar a CONFIRMED y añadir CONFIRM audit en el mismo tx.
DRAFT/CANCELLED terminan sin snapshots ni evidencia física; EXCLUDED confirmado
conserva snapshot descriptivo sin handoff. No se revalida balance/lifecycle/condición
mutable para acreditar la historia. La unicidad Equipment con custodia permanece
incluso después de cerrar el episodio; DRAFT no reserva Equipment.

Snapshots v1 tipados/limitados: root Case/folio/agenda, custodio y actor/fecha del
handoff; item Product/tracking, batch/Asset y referencias/hechos preparados.
Identidades, cantidades, revisiones y enlaces físicos permanecen normalizados.
JSON público se proyecta mediante whitelist. CONFIRMED inválido falla con
HEALTHCARE_PERSISTENCE_ERROR saneado; no reconstruye historia desde entidades vivas.
Audit change v1 tipado/limitado a operación/razón pública; sin producción de audit
empresarial ni claim/replay/conflict de comandos en este slice.

Sólo GET list y detail, ambos bajo `/healthcare/cases/:caseId/dispatches`.
JWT + RolesGuard, ADMIN/MANAGER/SALES/WAREHOUSE, UUID y Company exclusivamente de
sesión. Foreign Company/wrong Case: 404. List page=1/pageSize=25/max=100, status
opcional y createdAt DESC/id DESC; count/page en RepeatableRead. Detail usa consultas
acotadas sin N+1. HealthcareCaseDispatchModule importa sólo PrismaModule.

Validación local:

- Focal HTTP/JWT, parser/mapping, reads/repository y RBAC: **130/130**, 3 suites PASS.
- Full API: **2035/2035**, 121 suites PASS.
- PostgreSQL16 estructural: **59/59 PASS**; 42 migraciones aplicadas en DB nueva.
  Último target: `127.0.0.1:58070/zaping_case_dispatch_persistence_test`;
  loopback, contenedor nuevo, tmpfs sin volumen existente, rol no superusuario.
  Cleanup del contenedor/tmpfs: PASS. Ninguna DB dev/QA/producción utilizada.
- Typecheck del repositorio, noEmit focal de archivos 01A, lint, build, Prisma
  format/validate, Prettier/check y git diff --check: PASS.
- El noEmit adicional de todas las specs encuentra diagnósticos en suites ajenas
  a los archivos modificados; no sustituye el typecheck oficial ni el noEmit focal.
- Prisma generate estándar encontró EPERM de DLL Windows. Generación alternativa
  completada; SHA-256 de motor existente/generado idéntico:
  `263946105f428384d2318dc3241b85b1c3dd98fbb1bfac62d3e81f513ab35897`.
  Cliente actualizado conservando esa DLL. Sin cambios compartidos Web; no se requiere gate Web.

HC-DSP-01B: **COMPLETE / MERGED — PR #90**. HC-DSP-01C: **BLOCKED until HC-DSP-LOCK-01 merge**.
CASE DISPATCH PHYSICAL CONFIRMATION: **NOT IMPLEMENTED**.
PRODUCTIVE EQUIPMENT CUSTODY: **NOT ENABLED**. RETURN: **NOT IMPLEMENTED**.
REAL COMPANY CUTOVER / REAL EQUIPMENT RECONCILIATION: **NOT EXECUTED**. M-HC1: **OPEN**.

## 15. HC-DSP-01B — comandos DRAFT e idempotencia local validados

**COMPLETE / MERGED — PR #90**. TARGET **5 SP**.
Baseline: ecb41325bb9779eaf95866f956670b6f383cb577; rama
feat/hc-dsp-01b-draft-commands-idempotency. 01A COMPLETE / MERGED — PR #89.

Cinco POST case-scoped: create, custodian, items, items/:itemId/exclude y cancel,
bajo /healthcare/cases/:caseId/dispatches. CREATE produce DRAFT vacío con revisión 0,
Case SCHEDULED/horario ordenado, Kit PREPARED y readiness local PASS. Custodian,
exclude y cancel no dependen de readiness vivo; cancelar permite planificación degradada.
Custodio idéntico con key nueva es comando real revisionado. EXCLUDE nunca borra.
Nueva key sobre EXCLUDED/terminal produce conflicto; misma key/hash reproduce.

MATERIAL usa Position explícita, batchId nullable explícito y Product derivado.
NONE/REQUIRED/OPTIONAL sin fallback. Se valida saldo actual agregado por Position en
este Dispatch, incluso entre sources distintos; capacidad preparada suma CONFIRMED
ACTIVE + este DRAFT ACTIVE + candidato. Otros DRAFTs no reservan. EQUIPMENT deriva
Assignment/Asset/Product, exige RESERVED y elegibilidad física actual mediante helper
puro; captura revisión sin modificar Asset. Historia confirmada consume capacidad aun
tras cerrar custodia. Agenda/confirmación fuerte siguen siendo 01C.

Cada comando posee un tx ReadCommitted con timeouts: claim, locks ordenados, gates,
CAS, un audit y completion. Sin HC Company advisory lock, authority fence ni tx anidado.
Revisión stale: RESOURCE_STATE_CHANGED/409. DTOs estrictos rechazan identidades de
Company/actor, evidence y revisiones físicas del cliente. JWT/RolesGuard: mutaciones
ADMIN/MANAGER/WAREHOUSE; SALES read-only. Foreign tenant/wrong Case: 404.

Replay antes de gates vivos: hash canónico versionado de intención, sin actor/tiempo,
Kit resuelto ni revisiones físicas observadas. UNIQUE loser abandona el tx abortado
y consulta ganador en snapshot RepeatableRead nuevo. Respuesta uniforme
{ replay, command, data }: detalle ACTUAL + recibo del audit ORIGINAL (id, operación,
Dispatch/item, revisiones, actorId y occurredAt). No promete HTTP histórico idéntico.
Witness ausente/incoherente falla saneado. Audit JSON conserva exactamente versión,
operación y razón; no before/after arbitrarios. CREATE/ADD originales 201, replay 200;
otros 200. No nuevas tablas, migraciones, generate ni cambios de snapshot 01A.

Validación: focal **242/242** en 4 suites; PostgreSQL16 **40/40**, conexiones independientes
y barreras observables de lock; API **2147/2147** en 122 suites; typecheck, noEmit focal,
lint, build, Prisma validate, Prettier/check de código/arnés modificado y diff check PASS.
Último target nuevo: 127.0.0.1:60907/zaping_case_dispatch_commands_test, tmpfs,
loopback y rol no superusuario. Las 42 migraciones existentes se aplicaron sólo allí.
Cleanup PASS; ninguna DB dev/QA/producción. Fixtures históricos estructurales de test
permiten comprobar capacidad confirmada; los comandos tienen delta cero en Effects,
Custody, eventos, Positions, Assets y Assignments. Sin cambios Web compartidos.

01C **BLOCKED until HC-DSP-LOCK-01 merge**. CONFIRM **NOT IMPLEMENTED**. PRODUCTIVE EQUIPMENT
CUSTODY **NOT ENABLED**. RETURN **NOT IMPLEMENTED**. REAL COMPANY CUTOVER / REAL
EQUIPMENT RECONCILIATION **NOT EXECUTED**. M-HC1 **OPEN**.

## 16. HC-DSP-LOCK-01 — compatibilidad de locks DRAFT / Assignment

**IMPLEMENTED / TESTED — pending human review/merge**. TARGET **3 SP**.
Baseline: 69d4a9358dd90d6d44449aeef2c9056d3203b569; rama
fix/hc-dsp-lock-order-compatibility. 01A COMPLETE / MERGED — PR #89;
01B COMPLETE / MERGED — PR #90. 01C **BLOCKED until HC-DSP-LOCK-01 merge**,
TARGET **8 SP**.

Case se adquiere FOR SHARE al inicio de planificación, sin upgrade posterior.
CaseKit conserva FOR UPDATE; los comandos sobre Dispatch conservan su root
FOR UPDATE, revisión optimista, claim/completion y audit. No se añade HC Company
advisory lock ni autoridad física a DRAFT. Los writers de Assignment no cambian.

CREATE: Case SHARE → CaseKit UPDATE → items estructurales SHARE → Products SHARE
ordenados → Assets SHARE ordenados → Requirements SHARE ordenados → Assignments
SHARE ordenados → relectura autoritativa → readiness → creación. Se comprueba que
los bindings descubiertos corresponden al conjunto bloqueado; un cambio aborta
sin adquirir nuevas raíces fuera de orden. Case SCHEDULED, agenda completa y
ordenada, Kit PREPARED y readiness PASS siguen siendo obligatorios.

Equipment ITEM_ADD: Case SHARE → CaseKit UPDATE → Dispatch UPDATE → source SHARE
→ Product KEY SHARE → Asset SHARE → Assignment SHARE → relectura autoritativa
de source, Kit/Case, Dispatch, Assignment, Asset y Product → validación/persistencia.
Product KEY SHARE anticipa la protección de identidad/FK; actividad y tracking se
leen nuevamente. Los IDs iniciales sólo descubren locks, nunca autorizan. Binding
Assignment/Asset o Product/Asset distinto aborta sin bloquear otra raíz tardía.
La elegibilidad y physicalRevision se capturan del Asset bloqueado. DRAFT no
reserva, no modifica Assignment/Asset y no crea efectos, custodia ni eventos físicos.
Se conservan capacidad, duplicados, idempotencia, replay y auditoría de 01B.

Case SHARE es compatible con los Cases SHARE de Assignment CREATE/REPLACE.
Case update/cancel y CaseKit preparation, que requieren Case UPDATE, esperan
antes de tomar sus fuentes posteriores. RELEASE y REPLACE pueden esperar las
fuentes SHARE de DRAFT sin la inversión Assignment → Asset. CUSTODIAN_SET,
ITEM_EXCLUDE y CANCEL siguen serializando por Dispatch sin esperar Asset/Assignment.

Aceptación PostgreSQL16: **60/60 PASS** (40 regresiones 01B y 20 pruebas nuevas
que cubren los 19 escenarios solicitados). Servicios reales de Assignment,
CaseKit y Case; clientes independientes, observador, backend PIDs y
pg_blocking_pids() prueban las esperas, sin 40P01. Incluye ambos órdenes de
RELEASE/REPLACE, CREATE/readiness, roots Dispatch, rollback, tenants, preparación,
agenda/cancelación, múltiples Assets/Requirement y fuentes compartidas entre Cases.
Se verifican revisiones, auditoría y ausencia de efectos físicos de DRAFT.

Último entorno NUEVO: 127.0.0.1:52737/zaping_case_dispatch_commands_test,
run 1f189f81-33d2-4b45-ade5-b12bf622f77c, PostgreSQL16/tmpfs, puerto loopback
aleatorio y rol no superusuario. Las 42 migraciones existentes se aplicaron sólo
al contenedor vacío de aceptación. Cleanup del contenedor/tmpfs PASS.
Sin DB dev/QA/producción, cambios de .env, schema, nuevas migraciones ni generate.

Regresión focal Dispatch/Assignment **562/562** en 17 suites; comandos **87/87**;
API completa **2152/2152** en 122 suites. Typecheck oficial, noEmit focal, lint,
build, Prisma validate, Prettier/check del código/arnés modificado y diff check PASS.
El noEmit global adicional de tsconfig.spec.json presenta errores en specs ajenos
al delta; noEmit focal de los cuatro archivos TypeScript modificados PASS.

Confirm **NOT IMPLEMENTED**; PRODUCTIVE EQUIPMENT CUSTODY **NOT ENABLED**;
RETURN **NOT IMPLEMENTED**; M-HC1 **OPEN**. Revisión humana y merge de este delta
son prerrequisitos para desbloquear HC-DSP-01C.
