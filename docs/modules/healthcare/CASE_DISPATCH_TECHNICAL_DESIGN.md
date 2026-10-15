# HC-CASE-DISPATCH — Case Dispatch Foundation / Physical Handoff

TECHNICAL DESIGN: APPROVED.
IMPLEMENTATION: NOT STARTED.
QUANTITY SOURCING BLOCKER: RESOLVED.

Baseline: `8b6a883d5a5a2b7c5cbef001428fb478051f81f5`.
Rama: `feat/hc-case-dispatch-foundation`.
Autoridad: Technical Design Approval Delta humano de HC-CASE-DISPATCH.
Este cierre es DOCUMENTATION ONLY; no implementa modelos, migraciones, APIs ni adapters.

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
sourcePositionId, expectedSourceRevision, batchId explícito nullable y expectedRevision
del Dispatch. Los nombres/DTOs exactos se concretan en HC-DSP-01A/01B sin relajar identidad.

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
-> Cases afectados en orden determinista
-> CaseKit
-> Dispatch / items
-> Requirements / Assignments
-> Products ASC
-> Batches ASC
-> Positions ASC
-> EquipmentAssets ASC
-> authoritative reread / CAS / physical mutations
```

La implementación debe validar el orden contra los caminos reales antes de cambiar
código; no es una acreditación de concurrencia ejecutada. Nunca adquirir Inventory
fence después de HC. Bloquear también Cases relacionados necesarios para agenda.

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
del comando, expectedRevision, custodio, identidades/revisiones de fuente, quantity,
batch nullable y razón aplicables. Excluir tiempo servidor, IDs generados que no son
intención y actor del retry. No construir el hash desde hechos vivos cambiantes.

Misma key/request: replay lógico sin escrituras físicas duplicadas. Mismatch:
IDEMPOTENCY_KEY_REUSED / 409. Respuesta perdida: readback durable fresco.
Reintento de actor autorizado diferente devuelve evidencia original sin reatribuir
dispatchedBy, efecto ni episodio. CONFIRMED replay lee snapshot histórico y no
vuelve a validar disponibilidad viva. Nunca sobrescribir actor original.

## 10. Snapshot, persistencia y Return seam

Dirección aprobada: HealthcareCaseDispatch, HealthcareCaseDispatchItem y
HealthcareCaseDispatchAudit. Tenant-safe, revisionados, auditables, idempotentes y
trazables para Return; sin generic event sourcing. Prisma, FKs/índices/CHECKs exactos
y protección de inmutabilidad pertenecen al readiness de HC-DSP-01A, no se implementan aquí.

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
| HC-DSP-01A | Persistence, invariants & reads | 5 SP | READY; entrada a implementación tras merge de este Technical Design |
| HC-DSP-01B | DRAFT commands & idempotency | 5 SP | BLOCKED BY HC-DSP-01A |
| HC-DSP-01C | Atomic confirm, physical adapters & concurrency | 8 SP | BLOCKED BY HC-DSP-01B |
| BACKEND TOTAL | Backend aprobado | 18 SP | IMPLEMENTATION NOT STARTED |
| HC-DSP-01D | Frontend | Candidate 5 SP | OUT OF CURRENT BACKEND SCOPE |

Sólo TARGET: sin Forecast, Commitment, Actual ni fechas asignadas. READY no declara
este diseño merged ni autoriza implementar dentro del presente delta documental.
QUANTITY SOURCING BLOCKER: RESOLVED. No queda una decisión FEFO/FIFO por inferir.

## 13. Validación futura y estado del cierre

Implementación futura: suites focales de contrato/RBAC/tenant/capacidad/replay y
PostgreSQL nuevo aislado con conexiones independientes y barreras observables.
Cubrir duplicados, sourcing NONE/REQUIRED/OPTIONAL sin fallback, revisiones stale,
agenda estricta, Inspection/Retirement/Replace/release, competencia por Asset/Position,
rollback cruzado, autoridad LEGACY/CUTOVER/PHYSICAL, provenance y owned sin doble descuento.
Ninguna ejecución DB o pruebas de aplicación pertenece a este cierre.

TECHNICAL DESIGN: APPROVED. IMPLEMENTATION: NOT STARTED.
REAL COMPANY CUTOVER: NOT EXECUTED. REAL EQUIPMENT RECONCILIATION: NOT EXECUTED.
PRODUCTIVE EQUIPMENT CUSTODY: NOT ENABLED. RETURN: NOT IMPLEMENTED. M-HC1: OPEN.
