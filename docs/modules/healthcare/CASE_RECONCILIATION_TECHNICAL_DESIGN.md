# HC-RETURN-RECONCILIATION — Healthcare Return / Reconciliation V1

TECHNICAL DESIGN: **APPROVED**.
IMPLEMENTATION: **NOT STARTED**. Esta aprobación no autoriza implementación.

Baseline: `446e9528127afb59803c25441b1d7069fae3ce1d` — merge PR #92.
Rama: `feat/hc-return-reconciliation-foundation`.
Autoridad: Technical Design Approval Delta humano de HC-RETURN-RECONCILIATION.
Este documento registra las decisiones aprobadas; Prisma/DTOs exactos corresponden
a readiness HC-RR-01A y de los slices siguientes, sin implementar aquí.

## 1. Estado, dependencias y alcance

HC-CASE-DISPATCH BACKEND: **COMPLETE / MERGED**, hasta PR #92.
HC-DSP-01A/01B/LOCK-01/01C: COMPLETE / MERGED — PR #89/#90/#91/#92.
HC-INVENTORY-CUSTODY-01D y 01E: **COMPLETE / MERGED**.
REAL COMPANY CUTOVER: **NOT EXECUTED**.
REAL EQUIPMENT RECONCILIATION: **NOT EXECUTED**. M-HC1: **OPEN**.

Return/Reconciliation cierra o clasifica custodia con provenance Dispatch durable.
No implementa frontend, billing, SalesOrder/Delivery, replenishment/procurement,
generic warehouse returns, rediseño SERIALIZED/counting ni adopción operativa real.
La reconciliación inicial real de Equipment es distinta de estos episodios de negocio.

Referencias:

- [Case Logistics — contrato V1](CASE_LOGISTICS.md#259-hc-return-reconciliation--v1-approved-contract).
- [Dispatch TD](CASE_DISPATCH_TECHNICAL_DESIGN.md), con evidencia de implementación
  local; el estado de merge vigente es el indicado arriba, posterior a ese cierre.
- [Inventory Custody Definition](../erp/INVENTORY_CUSTODY_DEFINITION.md).
- [Equipment 01E TD](../erp/INVENTORY_CUSTODY_01E_TECHNICAL_DESIGN.md#seam-futuro-de-return).
- [Project Board](../../project/PROJECT_BOARD.md).

## 2. Un agregado, episodios y lifecycle

Se aprueba **HealthcareCaseReconciliation**, sin agregados Return/Reconciliation separados.
Return describe el regreso físico; Reconciliation es la autoridad más amplia sobre
material returned/restockable, used, recursos unresolved y condición Equipment.

CaseDispatch 1:N Reconciliation episodes. Cada episodio pertenece exactamente a un
Dispatch CONFIRMED. Una visita con recursos de varios Dispatches produce varios
episodios en V1. Se admiten episodios parciales sucesivos.

```text
DRAFT -> CONFIRMED
DRAFT -> CANCELLED
```

DRAFT tiene cero efectos físicos. Sólo CONFIRM clasifica y aplica resultados físicos.
CONFIRMED y CANCELLED son terminales e inmutables; no cancelación posterior a efectos.
Otros DRAFTs no consumen ni reservan capacidad durable.

## 3. Fuente de verdad y capacidad

Siempre partir de provenance durable de Dispatch CONFIRMED y sus items ACTIVE.

| Recurso | Autoridad de origen |
| --- | --- |
| MATERIAL | HealthcareCaseDispatchItem, destinationPositionId CUSTODY creado por Confirm, physicalEffectId original, Product, batch nullable, dispatched quantity y snapshots históricos |
| Equipment | HealthcareCaseDispatchItem, equipmentCustodyId, equipmentPhysicalEventId de apertura, Asset, Assignment histórico y snapshots Dispatch |

No reconstruir cantidad/identidad desde CaseKit, preparedQuantity, Product.stock,
Assignment solo ni la antigua Position AVAILABLE. Dispatch y sus snapshots no se mutan.
La revisión física esperada de Reconciliation se obtiene para este episodio;
no reutilizar la revisión anterior al handoff almacenada por Dispatch.

Una línea ACTIVE por reconciliation/sourceDispatchItem. MATERIAL expresa intención
mediante returnedQty y usedQty, enteros no negativos:

```text
dispatchedQty = confirmedReturnedQty + confirmedUsedQty + unresolvedQty
unresolvedQty = dispatchedQty - confirmedReturnedQty - confirmedUsedQty
```

Unresolved es DERIVED, sin contador mutable. Sólo items ACTIVE de episodios CONFIRMED
consumen capacidad. Lo confirmado más el candidato nunca excede dispatchedQty.
La raíz estable de capacidad es source DispatchItem, bloqueada al confirmar;
la Position CUSTODY exacta protege el saldo físico. No es un CHECK ordinario entre filas.

Ejemplo: dispatched10; episodio1 returned3/used5 deja unresolved2; episodio2 returned2
deja unresolved0. No restaurar prepared Dispatch capacity tras devolver recursos.

## 4. MATERIAL RETURNED, USED y proyección

**returnedQty = físicamente retornado Y explícitamente aprobado RESTOCKABLE**.
No basta con que haya llegado físicamente al almacén.

| Resultado | Operación y origen conceptual | Compatibilidad |
| --- | --- | --- |
| RETURNED | TRANSFER desde CUSTODY exacta a AVAILABLE; CASE_RECONCILIATION/reconciliationId/CONFIRM_RETURNED | Product.stock owned sin cambio; Batch.availableQuantity exacto aumenta si existe batch |
| USED | definitiveOut, kind DEFINITIVE_OUT, directamente desde CUSTODY; CASE_RECONCILIATION/reconciliationId/CONFIRM_USED | Product.stock disminuye una vez en usedQty; Batch.availableQuantity no disminuye porque el débito sale de CUSTODY |

Destino returned: mismo Company/Product/batch original o null, state AVAILABLE,
contextType/contextId nulos. Resolver la Position canónica; no forzar el ID AVAILABLE
anterior al Dispatch. Batch REQUIRED/OPTIONAL loteado conserva el lote exacto;
unbatched conserva null. Sin sustitución, FEFO/FIFO ni fallback.

RETURNED y USED tienen Effects separados por sus kinds distintos. Aplicar cada
proyección en el mismo tx. USED no pasa primero por AVAILABLE; no reutilizar Sales,
fabricar Sales history ni descontar Product.stock nuevamente fuera de proyección.
Readiness de Confirm debe concretar el avance de revisión al aplicar ambos Effects
contra una misma CUSTODY, sin relajar la precondición física inicial.

## 5. Unresolved, observaciones y limitación MATERIAL V1

Unresolved no crea movimiento: mantiene saldo en la CUSTODY exacta del DispatchItem.
**Decisión vinculante V1:** material físicamente recibido pero todavía no aprobado
para restock no se clasifica como returnedQty ni usedQty. Hasta resolver disposición,
permanece unresolved y su Inventory permanece CUSTODY.

El episodio puede dejar observación/razón de que fue recibido o revisado y su
disposición sigue pendiente. En V1 unresolved no significa necesariamente que
nadie lo haya recibido físicamente. Esta precisión prevalece para V1 sobre la
distinción conceptual histórica de Case Logistics entre daño y ubicación desconocida.

No introducir QUARANTINE ni otro estado de unavailable return en este milestone.
No mover falsamente a AVAILABLE. Una extensión futura podrá representar recepción
no disponible/cuarentena; no ampliar este alcance silenciosamente.

Confirmación observacional, sin mutación física, sólo si existe al menos un recurso
referenciado con saldo unresolved/custody abierta y una observación/razón explícita
acotada. Un episodio vacío o sin recurso pendiente no confirma. Produce historia
empresarial durable, sin Inventory Effects ni eventos/mutaciones Equipment.

## 6. Equipment outcome, condición y cierre

Outcome aprobado: **RETURNED / UNRESOLVED**. No codificar condition en ese enum.
reportedCondition es obligatorio sólo para RETURNED: GOOD, INSPECTION_PENDING,
DAMAGED u OUT_OF_SERVICE; sin condición de retorno fabricada para UNRESOLVED.

RETURNED aplica atómicamente:

```text
EquipmentAssetCustody exacta OPEN -> CLOSED
Asset CUSTODY -> WAREHOUSE
activeCustodyId -> null
condition -> reportedCondition
physicalRevision N -> N+1
exactamente un evento CUSTODY_CLOSE con hechos antes/después, incluida condition
```

No añadir CONDITION_CHANGE por la misma transición. UNRESOLVED conserva custody
OPEN, location CUSTODY, pointer, condition y physicalRevision, sin retorno ficticio.

RETIRED+CUSTODY es retornable: termina RETIRED+WAREHOUSE, conservando lifecycle
RETIRED y condición independiente. No reactivar. Return puede registrar condición
observada sin fabricar EquipmentInspection. INSPECTION_PENDING deja la resolución
posterior a Inspection; sus restricciones vigentes no cambian.

## 7. Assignment, Case y CaseKit

No liberar/reemplazar Assignment ni restaurar capacidad preparada. La referencia
Assignment es histórica y puede estar RESERVED, RELEASED o REPLACED. Posesión física
y asignación/agenda siguen siendo hechos diferentes.

No cambiar lifecycle Case/CaseKit ni exigir Case SCHEDULED, Kit PREPARED, readiness
o agenda actuales. Debe poder recibirse/reconciliarse un recurso ya despachado
después de cambios operacionales de planificación.

## 8. Primitiva interna y contexto de cierre

Se aprueba añadir en un slice posterior una primitiva interna caller-owned
`returnFromCustody(tx, ...)` que cierre el episodio exacto, aplique pointer/location/
condition/revision y un CUSTODY_CLOSE atómicamente. Sin endpoint Equipment de cierre
ni tx anidado. CUSTODY_CLOSE ya existe: no necesita nuevo EquipmentPhysicalOperation.

Contexto productivo **CASE_RECONCILIATION_ITEM**; contrato/registry dedicados al cierre,
sin cambiar semántica del registry de apertura. Debe probar en el mismo tx:
Reconciliation/item ACTIVE, Dispatch CONFIRMED, source DispatchItem exacto,
custody abierta exacta, Asset, Company/Case, expected physicalRevision, actor y
origen durable de reconciliación. Strings arbitrarios no son evidencia.

DI debe conservar adapters de evidencia estrechos y readonly en el tx del caller,
sin dependencia circular ni adquisición tardía de raíces. El wiring productivo
pertenece a HC-RR-01D; la primitiva/registry y pruebas internas, a HC-RR-01C.

## 9. Dirección de persistencia y constraints

Modelos conceptuales aprobados:

| Modelo | Contenido |
| --- | --- |
| HealthcareCaseReconciliation | Company, Case, Dispatch, relación CaseKit derivada, status/revision, actores/tiempos, confirmedFromRevision, cancelación, snapshot versionado |
| HealthcareCaseReconciliationItem | sourceDispatchItem, tipo/lifecycle, intención MATERIAL o Equipment, revisiones esperadas, evidence y snapshot |
| HealthcareCaseReconciliationAudit | Operaciones tipadas, actor/tiempo, revisiones before/after y cambio versionado acotado |

MATERIAL conceptual: sourceDispatchItemId, sourceCustodyPositionId,
expectedSourceRevision, returnedQty, usedQty, returnedDestinationPositionId nullable,
returnedPhysicalEffectId nullable y usedPhysicalEffectId nullable.

Equipment conceptual: sourceDispatchItemId, equipmentCustodyId, assetId,
assignmentId histórico, expectedPhysicalRevision, outcome, reportedCondition nullable
y closePhysicalEventId nullable. No duplicar estado mutable Asset/Product como autoridad.

FKs tenant-safe y RESTRICT; una línea ACTIVE por reconciliation/sourceDispatchItem.
No UNIQUE global sobre custody para simples observaciones UNRESOLVED. Con evidencia
física de cierre, cada custody exacta sólo puede cerrarse una vez. Capacidad MATERIAL
bajo locks; historia terminal inmutable; audit append-only; final-evidence constraints
diferidos donde hagan falta. Prisma/índices/SQL exactos corresponden a HC-RR-01A readiness.

Snapshots y audit deben preservar hechos históricos, intentos de mutación y evidence
sin reconstruirlos con estado vivo. No reescribir la historia Dispatch ni episodios anteriores.

## 10. Idempotencia y autoridad

CREATE, ITEM_ADD, OUTCOME_SET, ITEM_EXCLUDE, CONFIRM y CANCEL requieren Idempotency-Key.
Reutilizar IdempotencyRecord; HC-RR-01A podrá añadir scopes por migración. Sin framework
paralelo. Replay precede gates vivos y devuelve witness original durable más readback
actual del agregado, sin duplicar efectos físicos ni reatribuir el comando original.

Sólo returnedQty>0 o usedQty>0 de MATERIAL ACTIVE exige QUANTITY PHYSICAL authority:
shared Inventory fence primero y runtime compatible; LEGACY/CUTOVER/recovery rechazan.
Observación MATERIAL sin mutación positiva y Equipment-only no activan ese gate.

## 11. Orden conceptual de Confirm y atomicidad

```text
historical replay -> un tx ReadCommitted
-> Inventory shared fence si MATERIAL positivo
-> idempotency claim -> authority/runtime -> HC Company exclusivo
-> Case SHARE -> source Dispatch SHARE -> source DispatchItems UPDATE ordenados
-> Reconciliation root UPDATE -> Reconciliation items ordenados
-> Products UPDATE -> Batches UPDATE -> Positions UPDATE
-> Assets UPDATE -> Custodies UPDATE -> authoritative reread
-> CONFIRM audit -> RETURNED transfer/projection -> USED definitiveOut/projection
-> Equipment closes -> evidence/snapshots -> terminal root CAS -> idempotency completion
```

Revalidar el orden exacto contra el repo merged antes de cambios de código; no es
aceptación de concurrencia ejecutada. No mutar Dispatch ni requerir CaseKit lock/readiness.
Conservar orden determinista en conjuntos de raíces físicas y timeouts HC existentes.

Se admiten episodios MATERIAL-only, Equipment-only y mixtos. Todo resultado físico
del episodio confirma o revierte junto: transfers, definitive outs, proyecciones,
custody closes, eventos, evidence/snapshots, audit, terminal y completion idempotente.

## 12. Estado derivado y lecturas

No persistir fullyReconciled mutable en Dispatch, Case ni CaseKit. Derivar por Dispatch:
UNRECONCILED, PARTIALLY_RECONCILED o FULLY_RECONCILED.
Sólo cuentan fuentes ACTIVE del Dispatch CONFIRMED; EXCLUDED no representa handoff físico.
FULLY exige en cada MATERIAL confirmedReturned+confirmedUsed=dispatchedQty y en cada
Equipment custody exacta cerrada con evidencia física válida. Inspection pendiente
no impide reconciliación física completa; condición/disponibilidad son dimensiones separadas.

Reads exponen dispatched/returned/used/unresolved por Dispatch/source; Equipment
open/closed y última evidencia de retorno, más episodios. Desacuerdo entre saldo
empresarial y CUSTODY física: fallar cerrado/exponer integridad, sin inventar outcomes,
reparar contadores ni N+1.

## 13. API y RBAC aprobados

Base: `/healthcare/cases/:caseId/reconciliations`.

| Método | Ruta |
| --- | --- |
| GET | colección y `:id` detail |
| POST | colección |
| POST | `:id/items` |
| POST | `:id/items/:itemId/outcome` |
| POST | `:id/items/:itemId/exclude` |
| POST | `:id/confirm` |
| POST | `:id/cancel` |
| GET | `/healthcare/cases/:caseId/dispatches/:dispatchId/reconciliation-summary` |

DTOs exactos pertenecen a readiness, sin aprobar schema/API implementado aquí.
Reads ADMIN/MANAGER/WAREHOUSE/SALES; mutaciones ADMIN/MANAGER/WAREHOUSE.
SALES read-only. Custodio/receiver no concede autorización.

## 14. Slices, TARGET y siguiente paso

| Slice | Alcance | TARGET | Estado |
| --- | --- | --- | --- |
| HC-RR-01A | Persistence, invariants & reads | 5 SP | READY AFTER TECHNICAL DESIGN MERGE |
| HC-RR-01B | DRAFT commands, outcomes & idempotency | 5 SP | BLOCKED BY 01A |
| HC-RR-01C | Equipment custody close primitive, close registry & internal tests | 5 SP | BLOCKED / DEPENDS ON APPROVED FOUNDATION |
| HC-RR-01D | Atomic Confirm, productive adapter & cross-domain PostgreSQL acceptance | 8 SP | BLOCKED |
| BACKEND TOTAL | Return / Reconciliation backend | 23 SP | IMPLEMENTATION NOT STARTED |

Sólo planning TARGET; sin Forecast/Commitment/Actual ni fechas. Siguiente paso:
revisar/mergear este TD, luego readiness HC-RR-01A y autorización de implementación.
Las pruebas de negocio y aceptación PostgreSQL con conexiones/barreras observables
son trabajo futuro de los slices; no se ejecutaron ni se accedió a DB en este delta.

## 15. Limitaciones, riesgos y cierre

1. MATERIAL recibido pero sin aprobación restock queda unresolved/CUSTODY, con observación.
   No hay QUARANTINE/unavailable-return Position en este milestone.
2. RETURNED/USED confirmados son historia física inmutable. No USED->RETURNED,
   RETURNED->USED ni modificación de cantidades confirmadas; la corrección exige
   workflow futuro explícito de ajuste/corrección, fuera de alcance.
3. Reconsiderar ambas limitaciones antes de production readiness si la operación
   exige cuarentena o corrección. No resolverlas ampliando este milestone sin aprobación.

TECHNICAL DESIGN: **APPROVED**. IMPLEMENTATION: **NOT STARTED**.
HC-CASE-DISPATCH: **COMPLETE / MERGED — through PR #92**.
REAL COMPANY CUTOVER / REAL EQUIPMENT RECONCILIATION: **NOT EXECUTED**.
M-HC1: **OPEN**. Aprobación documental, sin código, schema, migración ni activación.
