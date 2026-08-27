# Equipment — Zaping ERP

**Módulo:** Core Equipment
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** EQUIPMENT V1 IMPLEMENTED / VALIDATED
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Core Equipment administra la identidad, condición y ciclo de vida de activos
físicos reutilizables.

Su responsabilidad principal es responder:

```text
¿Qué unidad física exacta existe?
```

y no únicamente:

```text
¿Qué Product representa?
```

Debe mantenerse:

```text
Product
≠
EquipmentAsset
```

`Product` representa catálogo/modelo.

`EquipmentAsset` representa una unidad física individual.

---

# 2. Alcance

Core Equipment es responsable de:

```text
EquipmentAsset identity

assetCode

serialNumber

serial normalization

lifecycle

condition

origin

InventoryBatch association when applicable

Purchase Receipt provenance

Inspection history

Retirement

Current Availability
```

También proporciona las capacidades Core que posteriormente utilizará
Zaping Healthcare.

Core Equipment no es propietario de:

```text
Healthcare Case

Equipment Requirement

Case Equipment Assignment

Case Availability

CaseKit

Dispatch

Custody

Case Return

Case Reconciliation
```

Estas capacidades pertenecen a Healthcare.

---

# 3. Estado actual

Actualmente están implementados y validados:

```text
Equipment registration

Equipment list

Equipment detail

automatic assetCode generation

serial normalization

serial duplicate validation

Purchase Receipt → EquipmentAsset provisioning

Current Availability

Inspection

Inspection history

Retirement

tenant-scoped Equipment operations

frontend Equipment workspace

Equipment deep-link
```

Estado:

```text
Core Equipment V1
→ IMPLEMENTED / VALIDATED
```

---

# 4. Deuda y capacidades no implementadas

Actualmente permanecen pendientes dentro o alrededor de Core Equipment:

```text
serial correction workflow

manual frontend batch selector

Product.stock ↔ EquipmentAsset formal reconciliation

Equipment-specific Audit integration

server-side pagination

bulk/list Availability if required

retired actor display enrichment
```

Pertenecen a Healthcare TARGET:

```text
Equipment Requirement

Case Equipment Assignment

Case Availability

Dispatch

Custody

Return

Case logistics
```

Pertenecen a evolución futura:

```text
Maintenance

Calibration

Equipment 360 / advanced read experience

multi-warehouse integration
```

---

# 5. Ownership del dominio

`EquipmentAsset` pertenece a ERP Core.

```text
Zaping ERP Core
│
├── Products
├── Inventory
└── Equipment
    └── EquipmentAsset
```

Healthcare consume Equipment:

```text
Healthcare
↓
references
↓
EquipmentAsset
```

Debe mantenerse:

```text
EquipmentAsset
→ Core physical identity
```

mientras:

```text
Assignment
Custody
Dispatch
Return
Case Availability
→ Healthcare operational facts
```

Healthcare no debe crear una definición paralela de `EquipmentAsset`.

---

# 6. Relación Product → EquipmentAsset

Todo `EquipmentAsset` pertenece a un `Product`.

```text
Product
1
│
└── *
    EquipmentAsset
```

Debe cumplirse:

```text
EquipmentAsset.productId
→ REQUIRED
```

y:

```text
EquipmentAsset.companyId
=
Product.companyId
```

Conceptualmente:

```text
Product
→ what the model/resource is

EquipmentAsset
→ which exact physical unit it is
```

Equipment no debe duplicar campos de catálogo como:

```text
name
brand
category
description
```

cuando pertenecen a Product.

---

# 7. ProductInventoryTracking

La estrategia de tracking contempla:

```text
QUANTITY

SERIALIZED

ASSET
```

Semántica:

```text
QUANTITY
→ units represented primarily through quantities
```

```text
SERIALIZED
→ individually serialized commercial inventory
```

```text
ASSET
→ persistent reusable physical units represented by EquipmentAsset
```

Debe mantenerse:

```text
SERIALIZED
≠
ASSET
```

Ejemplos conceptuales:

```text
Consumible
→ QUANTITY
```

```text
Unidad comercial serializada
→ SERIALIZED
```

```text
Equipo reutilizable
→ ASSET
```

Un `EquipmentAsset` solo puede crearse para:

```text
Product.inventoryTracking = ASSET
```

La creación Core rechaza Products con otra estrategia.

---

# 8. SERIALIZED

`SERIALIZED` no utiliza actualmente `EquipmentAsset` como representación automática
durante Purchase Receipts.

Actualmente:

```text
SERIALIZED Receipt provisioning
→ NOT IMPLEMENTED
```

Su semántica individual completa permanece como deuda de Inventory.

No debe reutilizarse `EquipmentAsset` para resolver SERIALIZED únicamente porque
ambos conceptos pueden utilizar números de serie.

---

# 9. ProductLotTracking

Lot Tracking es una dimensión independiente de Inventory Tracking.

Valores:

```text
NONE

OPTIONAL

REQUIRED
```

Debe mantenerse:

```text
batch
≠
serial
≠
asset identity
```

Las reglas completas de recepción:

```text
NONE
OPTIONAL
REQUIRED
```

están implementadas en Purchase Receipts.

La fuente funcional de esas reglas es:

```text
PURCHASE_RECEIPTS.md
```

---

# 10. Equipment y lotes

Un `EquipmentAsset` puede relacionarse con:

```text
InventoryBatch
```

cuando exista una asociación válida.

En creación manual, si backend recibe:

```text
batchId
```

debe validar:

```text
same Company

same Product
```

El backend soporta esta asociación.

Actualmente el frontend de creación manual no expone un selector de lote seguro.

Por tanto:

```text
backend batch association
→ SUPPORTED

manual frontend batch selector
→ PENDING
```

---

# 11. EquipmentAsset como identidad física

Para Products:

```text
inventoryTracking = ASSET
```

cada fila:

```text
EquipmentAsset
```

representa una unidad física específica.

Conceptualmente:

```text
EquipmentAsset records
→ physical identity truth
```

Mientras:

```text
Product.stock
→ aggregate inventory projection
```

Debe evitarse que ambas representaciones evolucionen independientemente sin una
regla que explique sus diferencias.

---

# 12. Product.stock y EquipmentAsset

Actualmente `Product.stock` continúa siendo utilizado por Inventory.

Para Products ASSET:

```text
EquipmentAsset
→ physical identity layer
```

```text
Product.stock
→ aggregate quantity projection
```

La política formal de reconciliación:

```text
Product.stock
↔
EquipmentAsset
```

todavía no está implementada completamente.

Esto permanece como deuda importante.

Principio:

> Una operación que incremente físicamente unidades ASSET debe producir también
> las identidades físicas correspondientes cuando el workflow así lo requiere.

---

# 13. Relación con Inventory

Equipment se integra con Inventory, pero mantiene ownership independiente.

```text
ERP Core

├── Products
│   └── catalog + tracking configuration
│
├── Inventory
│   ├── Product.stock
│   ├── InventoryMovement
│   └── InventoryBatch
│
└── Equipment
    ├── EquipmentAsset
    ├── lifecycle
    ├── condition
    ├── Inspection
    ├── Retirement
    └── Current Availability
```

Debe mantenerse:

```text
Inventory access
≠
Equipment domain ownership
```

Inventory no es propietario de:

```text
Equipment lifecycle

Equipment condition

Equipment retirement

Equipment Current Availability
```

---

# 14. Modelo EquipmentAsset

La persistencia Core contempla conceptualmente:

```text
EquipmentAsset

id
companyId
productId

assetCode

serialNumber
serialNumberKey

lifecycle
condition
origin

batchId
purchaseReceiptItemId

retiredAt
retiredById
retiredReason
retirementNotes

createdAt
updatedAt
```

Relaciones principales:

```text
Company

Product

InventoryBatch?

PurchaseReceiptItem?

User? as retiredBy

EquipmentInspection[]
```

La definición exacta pertenece a:

```text
schema.prisma
```

---

# 15. Constraints principales

La persistencia implementa constraints equivalentes a:

```text
UNIQUE id + companyId

UNIQUE companyId + assetCode

UNIQUE companyId + productId + serialNumberKey
```

También existen índices para soportar consultas operacionales.

Estas constraints complementan, pero no sustituyen, las validaciones de dominio.

---

# 16. EquipmentOrigin

Valores:

```text
MANUAL

PURCHASE_RECEIPT

IMPORT

INITIAL_MIGRATION
```

Actualmente:

```text
POST /equipment
→ MANUAL
```

```text
Purchase Receipt provisioning
→ PURCHASE_RECEIPT
```

Los workflows específicos para:

```text
IMPORT

INITIAL_MIGRATION
```

todavía no están implementados.

---

# 17. Lifecycle

Valores:

```text
ACTIVE

RETIRED
```

`ACTIVE` significa:

```text
asset remains part of the managed fleet
```

No significa:

```text
AVAILABLE
```

`RETIRED` significa:

```text
asset permanently left normal operational use
```

Debe mantenerse:

```text
Lifecycle
≠
Availability
```

---

# 18. Retirement es terminal

El flujo normal es:

```text
ACTIVE
↓
Retirement
↓
RETIRED
```

En Equipment V1:

```text
RETIRED
→ terminal normal state
```

No existe una operación normal de:

```text
Reactivate Equipment
```

Una corrección futura tendría que ser:

```text
explicit

authorized

audited

exceptional
```

No un `PATCH lifecycle`.

---

# 19. Condition

Valores:

```text
GOOD

INSPECTION_PENDING

DAMAGED

OUT_OF_SERVICE
```

`Condition` representa el snapshot físico u operacional actual.

Debe mantenerse:

```text
Lifecycle
≠
Condition
```

Ejemplos válidos:

```text
ACTIVE + GOOD

ACTIVE + DAMAGED

ACTIVE + OUT_OF_SERVICE

RETIRED + GOOD

RETIRED + DAMAGED
```

Retirement no necesita falsificar Condition para expresar indisponibilidad.

---

# 20. GOOD

```text
GOOD
```

significa que no existe una condición Core conocida que impida el uso normal.

En Current Availability:

```text
ACTIVE + GOOD
→ available = true
```

Esto significa únicamente:

```text
available according to currently implemented Core Equipment facts
```

No significa:

```text
guaranteed available for a Healthcare Case
```

---

# 21. INSPECTION_PENDING

Significa:

```text
physical/operational condition
has not yet been validated
```

Puede utilizarse, entre otros casos:

```text
Purchase Receipt provisioning

initial registration

future Healthcare Return
```

Current Availability devuelve:

```text
available = false
```

para esta condición.

---

# 22. DAMAGED

Representa daño conocido.

Actualmente:

```text
DAMAGED
→ Current Availability = false
```

No crea automáticamente:

```text
Maintenance work order
```

Maintenance permanece como dominio futuro.

---

# 23. OUT_OF_SERVICE

Representa una decisión operacional de impedir utilización.

Puede existir:

```text
Lifecycle = ACTIVE

Condition = OUT_OF_SERVICE
```

porque el activo continúa perteneciendo a la Company.

Current Availability:

```text
OUT_OF_SERVICE
→ unavailable
```

---

# 24. Maintenance y Calibration

Maintenance y Calibration no son `EquipmentCondition`.

No deben introducirse artificialmente valores como:

```text
MAINTENANCE_REQUIRED

CALIBRATION_REQUIRED
```

dentro del enum Condition únicamente para representar esos dominios.

Futuro:

```text
EquipmentMaintenance

Calibration
```

pueden proporcionar blockers adicionales para Availability.

Actualmente:

```text
Maintenance
→ NOT IMPLEMENTED

Calibration
→ NOT IMPLEMENTED
```

---

# 25. assetCode

Todo `EquipmentAsset` posee un:

```text
assetCode
```

operacional.

Constraint:

```text
companyId
+
assetCode
→ UNIQUE
```

Características:

```text
server generated during normal creation

unique inside Company

stable

not normally editable

never reused

preserved after Retirement
```

No debe codificar:

```text
Product

category

warehouse

condition

location

lifecycle
```

---

# 26. Generación de assetCode

El formato actual utiliza:

```text
EQ-000001
EQ-000002
...
```

El ancho de seis dígitos es mínimo visual, no límite máximo.

La generación utiliza:

```text
CompanySequence
```

con una clave específica de Equipment.

Conceptualmente:

```text
Company
+
EQUIPMENT_ASSET_CODE sequence
↓
atomic allocation
↓
EQ-xxxxxx
```

La asignación es:

```text
tenant-scoped

transaction-aware

collision-safe
```

Los gaps son aceptables.

No existe requerimiento:

```text
gapless sequence
```

---

# 27. assetCode no pertenece al cliente

El flujo normal:

```text
POST /equipment
```

no permite que frontend controle:

```text
assetCode
```

`CreateEquipmentDto` no debe aceptar ese campo.

Debe mantenerse:

```text
server
→ owns assetCode allocation
```

---

# 28. assetCode después de Retirement

Retirement no modifica:

```text
assetCode
```

Debe mantenerse:

```text
RETIRED EQ-0041
↓
EQ-0041 remains permanently reserved
```

No debe crearse otro activo con el mismo código dentro de la Company.

---

# 29. Importación futura de assetCode

Un futuro workflow de importación o migración puede necesitar conservar códigos
existentes.

Esto deberá requerir:

```text
valid code

unique inside Company

explicit import workflow
```

No forma parte de la creación manual normal.

---

# 30. serialNumber

`serialNumber` es opcional.

Puede existir:

```text
serialNumber = null
serialNumberKey = null
```

El sistema utiliza:

```text
serialNumberKey
```

como representación normalizada para detección de duplicados.

Ejemplo:

```text
serialNumber
→ sn-test-001

serialNumberKey
→ SN-TEST-001
```

---

# 31. Unicidad de serial

La regla técnica es:

```text
companyId
+
productId
+
serialNumberKey
→ UNIQUE
```

Por tanto:

```text
SN-TEST-001
```

y:

```text
sn-test-001
```

se consideran equivalentes para el mismo Product dentro de la misma Company.

El serial no es globalmente único entre:

```text
different Products

different Companies
```

Conflictos válidos se traducen a:

```text
409 Conflict
```

---

# 32. Corrección de serial

La corrección de `serialNumber` permanece pendiente.

Una futura operación deberá ser:

```text
explicit

authorized

duplicate-safe

auditable
```

Debe mantener la misma identidad:

```text
EquipmentAsset.id
```

No debe resolverse mediante un `PATCH` genérico de master data.

Estado:

```text
Serial correction
→ TECHNICAL DEBT
```

---

# 33. Creación manual

Endpoint:

```text
POST /equipment
```

Datos aceptados conceptualmente:

```text
productId

condition

serialNumber?

batchId?
```

El backend controla:

```text
companyId

assetCode

serialNumberKey

lifecycle

origin

purchaseReceiptItemId

retirement fields

timestamps
```

Flujo:

```text
Authenticated User
↓
companyId from authenticated context
↓
Validate DTO
↓
Find Product inside same Company
↓
Product exists?
↓
Product active?
↓
inventoryTracking = ASSET?
↓
Validate optional Batch
↓
Normalize optional serial
↓
Validate duplicate serial
↓
Allocate assetCode
↓
Create EquipmentAsset
```

Valores iniciales:

```text
origin = MANUAL

lifecycle = ACTIVE
```

La condición inicial es proporcionada mediante el contrato permitido.

---

# 34. Purchase Receipt → EquipmentAsset

Purchase Receipts integra Equipment automáticamente para Products:

```text
inventoryTracking = ASSET
```

Regla:

```text
PurchaseReceiptItem.quantityReceived = N
↓
create exactly N EquipmentAsset
```

No debe utilizarse:

```text
PurchaseItem.quantity
```

para determinar cuántos activos crear.

---

# 35. Tracking durante Receipt provisioning

Actualmente:

```text
QUANTITY
→ no EquipmentAsset
```

```text
SERIALIZED
→ no EquipmentAsset
```

```text
ASSET
→ one EquipmentAsset per received unit
```

Esto mantiene:

```text
SERIALIZED
≠
ASSET
```

---

# 36. Estado inicial de Equipment recibido

Cada Equipment creado desde Purchase Receipt utiliza:

```text
lifecycle = ACTIVE

condition = INSPECTION_PENDING

origin = PURCHASE_RECEIPT

serialNumber = null

serialNumberKey = null
```

Principio:

```text
physical receipt
≠
successful Equipment inspection
```

La Recepción no debe bloquearse únicamente porque todavía no se conozca el serial.

---

# 37. Trazabilidad de origen

Cada activo aprovisionado conserva:

```text
purchaseReceiptItemId
```

permitiendo:

```text
EquipmentAsset
↓
PurchaseReceiptItem
↓
PurchaseReceipt
↓
Purchase
↓
Supplier
```

Si el Receipt Item utiliza `InventoryBatch`:

```text
EquipmentAsset.batchId
=
PurchaseReceiptItem.batchId
```

cuando corresponde.

---

# 38. No duplicar stock

Purchase Receipt es propietario de la mutación de Inventory.

```text
PurchaseReceipt
→ Product.stock += quantityReceived
```

y:

```text
PurchaseReceipt
→ InventoryMovement IN
```

Equipment provisioning:

```text
→ creates physical identities
```

pero:

```text
does not increment Product.stock again
```

y:

```text
does not create one additional InventoryMovement per EquipmentAsset
```

Principio:

```text
Receipt
→ Inventory mutation

Equipment provisioning
→ physical identity creation
```

---

# 39. Transacción de Purchase Receipt

Equipment provisioning participa en la transacción propiedad de Purchase Receipts.

Conceptualmente:

```text
PurchaseReceipt

+

PurchaseReceiptItems

+

InventoryBatch when applicable

+

EquipmentAsset provisioning when ASSET

+

Product.stock

+

InventoryMovement IN

+

Purchase status
```

se coordinan atómicamente cuando forman parte de la misma operación.

Si el provisioning requerido falla:

```text
Receipt transaction
→ rollback
```

Debe evitarse:

```text
stock committed
+
missing required EquipmentAsset identities
```

---

# 40. Servicios de provisioning

La implementación utiliza responsabilidades separadas equivalentes a:

```text
EquipmentAssetCodeService
→ Equipment assetCode allocation
```

```text
EquipmentProvisioningService
→ Equipment creation from PurchaseReceiptItem
```

Purchase Receipts conserva:

```text
transaction ownership
```

El servicio de provisioning participa mediante:

```text
Prisma.TransactionClient
```

y no abre una transacción independiente.

Esto evita:

```text
nested independent business transactions
```

---

# 41. Purchase Receipt idempotency

La idempotencia de Purchase Receipts está actualmente:

```text
IMPLEMENTED / VALIDATED
```

mediante:

```text
Idempotency-Key

tenant-scoped identity

request hash

replay

409 conflict

Serializable transaction

P2002 recovery path
```

Esto protege también contra duplicación accidental del provisioning de Equipment
cuando el mismo request lógico es reintentado correctamente.

Permanece como deuda de QA:

```text
real simultaneous PostgreSQL race
for PurchaseReceipt idempotency
```

La fuente funcional de esta capacidad es:

```text
PURCHASE_RECEIPTS.md
```

---

# 42. Current Availability

Core Equipment implementa:

```text
Current Availability
```

Pregunta:

```text
¿Puede utilizarse esta unidad ahora
según los hechos Core actualmente implementados?
```

Endpoint:

```text
GET /equipment/:equipmentId/availability
```

---

# 43. Availability es derivada

Availability no se almacena como:

```text
available Boolean
```

Es:

```text
derived

contextual

explainable
```

Actualmente utiliza:

```text
EquipmentAsset.lifecycle

EquipmentAsset.condition
```

No consulta directamente Inspection history.

`EquipmentAsset.condition` representa el snapshot operacional actual.

---

# 44. Reglas actuales de Availability

```text
ACTIVE + GOOD
→ available = true
```

```text
ACTIVE + INSPECTION_PENDING
→ available = false
→ INSPECTION_PENDING
```

```text
ACTIVE + DAMAGED
→ available = false
→ DAMAGED
```

```text
ACTIVE + OUT_OF_SERVICE
→ available = false
→ OUT_OF_SERVICE
```

```text
RETIRED
→ available = false
→ RETIRED
```

---

# 45. Availability result

Respuesta:

```text
available

primaryReason

reasons

evaluatedAt
```

Reason codes actuales:

```text
RETIRED

INSPECTION_PENDING

DAMAGED

OUT_OF_SERVICE
```

Cuando existen múltiples blockers:

```text
reasons
→ contains all applicable Core blockers
```

La prioridad actual es determinística:

```text
1. RETIRED
2. INSPECTION_PENDING
3. DAMAGED
4. OUT_OF_SERVICE
```

`primaryReason` corresponde al primer reason aplicable.

---

# 46. Arquitectura de Availability

La implementación separa:

```text
pure evaluator
```

de:

```text
application service
```

Conceptualmente:

```text
Equipment Availability Evaluator
→ lifecycle + condition
→ pure
→ deterministic
→ no database
→ no clock
```

```text
EquipmentAvailabilityService
→ tenant-safe lookup
→ orchestration
→ evaluatedAt
```

```text
EquipmentController
→ HTTP boundary
```

No se requiere actualmente infraestructura de plugins o providers dinámicos.

---

# 47. Availability no se calcula en frontend

Frontend no debe inferir Availability utilizando:

```text
condition
```

por su cuenta.

Debe consumir el resultado backend.

Esto evita divergencias entre:

```text
list/detail UI logic

future Healthcare selectors

other clients
```

---

# 48. Availability en lista

Current Availability no se agrega automáticamente a:

```text
GET /equipment
```

para evitar consultas adicionales implícitas por activo.

Actualmente se consulta cuando la experiencia necesita el detalle.

Un futuro endpoint bulk puede evaluarse si existe necesidad real.

---

# 49. Current Availability ≠ Case Availability

Debe mantenerse:

```text
Current Equipment Availability
→ Core Equipment
```

y:

```text
Case Availability
→ Healthcare
```

Current Availability responde utilizando hechos Core actuales.

Case Availability deberá considerar además, cuando existan:

```text
Target Case

schedule

Assignments

Custody

Dispatch state

turnaround

Maintenance

Calibration
```

Por tanto:

```text
ACTIVE + GOOD
→ Current Availability = true
```

no garantiza:

```text
Case Availability = true
```

---

# 50. No Force Available

No debe existir una operación ordinaria:

```text
Force Available
```

Para cambiar Availability debe cambiarse la causa real.

Ejemplos:

```text
INSPECTION_PENDING
→ perform Inspection
```

```text
OUT_OF_SERVICE
→ valid future condition resolution
```

```text
RETIRED
→ remains unavailable
```

Futuros blockers deberán resolverse en su dominio propietario.

---

# 51. EquipmentInspection

Inspection pertenece a Core Equipment.

Representa:

```text
physical / operational condition event
```

Healthcare puede originar una Inspection como consecuencia de un Return, pero no
debe redefinir la entidad Core.

Por tanto `EquipmentInspection` no debe incorporar directamente por conveniencia:

```text
caseId

hospitalId

technicianId

caseReturnId
```

El contexto Healthcare deberá relacionarse mediante su propio dominio cuando se
implemente.

---

# 52. Inspection API

Endpoints implementados:

```text
GET  /equipment/:equipmentId/inspections

POST /equipment/:equipmentId/inspections
```

No existen operaciones normales:

```text
PATCH EquipmentInspection

DELETE EquipmentInspection
```

porque Inspection representa historia operacional.

---

# 53. Inspection input

La creación acepta conceptualmente:

```text
conditionAfter

notes?
```

No acepta desde cliente:

```text
companyId

equipmentAssetId

conditionBefore

inspectedById

inspectedAt

createdAt
```

Estos valores son determinados por backend.

---

# 54. Inspection eligibility

Una Inspection normal puede ejecutarse sobre Equipment:

```text
Lifecycle = ACTIVE
```

Esto incluye condiciones actuales:

```text
GOOD

INSPECTION_PENDING

DAMAGED

OUT_OF_SERVICE
```

Ejemplos válidos:

```text
INSPECTION_PENDING
→ GOOD
```

```text
GOOD
→ DAMAGED
```

```text
DAMAGED
→ GOOD
```

```text
OUT_OF_SERVICE
→ GOOD
```

Un Equipment:

```text
RETIRED
```

no puede recibir una nueva Inspection operacional normal.

---

# 55. Inspection result

Resultados finales permitidos:

```text
GOOD

DAMAGED

OUT_OF_SERVICE
```

No:

```text
INSPECTION_PENDING
```

porque una Inspection completada debe finalizar con una condición conocida.

---

# 56. conditionBefore

`conditionBefore` se deriva desde:

```text
EquipmentAsset.condition
```

inmediatamente antes de ejecutar la operación.

El cliente no controla este valor.

Esto protege la integridad del historial.

---

# 57. conditionAfter

Después de una Inspection exitosa:

```text
EquipmentInspection.conditionAfter
=
EquipmentAsset.condition
```

al finalizar la operación.

Debe ejecutarse atómicamente.

---

# 58. Inspector y timestamp

Backend deriva:

```text
inspectedById
→ authenticated User
```

y:

```text
inspectedAt
→ server time
```

El cliente no debe elegir libremente:

```text
inspector

historical timestamp
```

durante la operación normal.

---

# 59. Atomic Inspection

Inspection es una sola operación de negocio.

Conceptualmente:

```text
BEGIN

load tenant-scoped EquipmentAsset

validate Lifecycle

capture conditionBefore

create EquipmentInspection

update EquipmentAsset.condition

COMMIT
```

Debe evitarse:

```text
Inspection history created
+
condition snapshot unchanged
```

y:

```text
condition changed
+
Inspection history missing
```

Si ocurre un error:

```text
ROLLBACK
```

---

# 60. Inspection history

Inspection confirmada debe permanecer histórica.

Si una inspección posterior encuentra otra condición:

```text
new EquipmentInspection
```

debe registrar ese nuevo hecho.

No debe reescribirse una Inspection anterior.

`EquipmentAsset.condition` representa:

```text
current snapshot
```

mientras:

```text
EquipmentInspection[]
→ history
```

---

# 61. Inspection y Availability

Debe mantenerse:

```text
Inspection
≠
Availability
```

En el modelo Core actual:

```text
Inspection
↓
updates Condition
↓
Current Availability evaluator
```

Por ejemplo:

```text
ACTIVE
+
Inspection result GOOD
↓
Current Core Availability = true
```

pero esto no implica:

```text
Healthcare Case Availability = true
```

porque Healthcare podrá incorporar blockers adicionales.

---

# 62. Equipment Retirement

Retirement representa la salida permanente del activo de la flota operacional
normal.

Endpoint:

```text
POST /equipment/:equipmentId/retirement
```

Debe mantenerse:

```text
Retirement
≠
DELETE
```

Flujo:

```text
ACTIVE
↓
Retirement
↓
RETIRED
```

---

# 63. Retirement reasons

Valores:

```text
SOLD

LOST

DESTROYED

END_OF_LIFE

REPLACED

OTHER
```

Reason:

```text
≠
Lifecycle
```

Lifecycle final:

```text
RETIRED
```

---

# 64. Missing no significa LOST

Debe mantenerse:

```text
Missing
≠
LOST
```

```text
Overdue
≠
LOST
```

```text
Open custody exception
≠
LOST
```

`LOST` requiere una resolución explícita.

Futuros workflows Healthcare/Custody no deben retirar automáticamente un activo
como `LOST` únicamente porque no fue devuelto a tiempo.

---

# 65. Retirement input

El cliente proporciona:

```text
retiredReason

retirementNotes?
```

Backend controla:

```text
equipmentId from route

companyId

lifecycle transition

retiredAt

retiredById
```

Para:

```text
retiredReason = OTHER
```

se requieren notas con contenido real después de normalización.

---

# 66. Retirement server-owned fields

Una operación exitosa establece:

```text
lifecycle = RETIRED

retiredAt = server timestamp

retiredById = authenticated User

retiredReason = validated input

retirementNotes = normalized input
```

El cliente no controla:

```text
retiredAt

retiredById

lifecycle
```

---

# 67. Retirement preserva Condition

Retirement modifica:

```text
Lifecycle
```

No necesita modificar automáticamente:

```text
Condition
```

Ejemplo válido:

```text
Before

ACTIVE
DAMAGED

After

RETIRED
DAMAGED
```

También:

```text
ACTIVE
GOOD
↓
SOLD
↓
RETIRED
GOOD
```

Condition conserva el último estado conocido.

---

# 68. Retirement preserva identidad e historia

Retirement no elimina ni modifica automáticamente:

```text
EquipmentAsset

assetCode

serialNumber

serialNumberKey

Product relationship

Purchase origin

InventoryBatch relation

Inspection history
```

Los datos de retiro también permanecen históricos.

---

# 69. Segundo Retirement

Una vez:

```text
RETIRED
```

una nueva solicitud de Retirement no debe sobrescribir la primera.

Ejemplo:

```text
ACTIVE
→ RETIRED / END_OF_LIFE
✅
```

después:

```text
RETIRED
→ RETIRED / SOLD
❌
```

Resultado esperado:

```text
409 Conflict
```

La primera decisión permanece intacta.

---

# 70. Retirement y concurrencia

La transición debe protegerse contra solicitudes concurrentes.

La escritura debe exigir conceptualmente:

```text
id

companyId

lifecycle = ACTIVE
```

Solo una transición:

```text
ACTIVE → RETIRED
```

puede ganar.

Una segunda operación debe detectar el cambio de estado y no sobrescribir los
datos del primer retiro.

---

# 71. Retirement y Availability

Debe mantenerse:

```text
RETIRED
↓
Current Availability
↓
available = false
```

Retirement no escribe:

```text
available = false
```

como campo persistido.

Availability continúa siendo derivada.

---

# 72. Retirement y Inspection

Después de:

```text
Lifecycle = RETIRED
```

nuevas inspecciones operacionales normales son bloqueadas.

Las inspecciones históricas permanecen disponibles.

---

# 73. Dependencias operacionales futuras

Cuando existan:

```text
Case Assignment

external Custody

Dispatch

open Return
```

Retirement deberá validar blockers operacionales cuando corresponda.

Debe evitarse:

```text
Retirement
→ silently closes Assignment
```

```text
Retirement
→ silently closes Custody
```

```text
Retirement
→ fakes Return
```

Una pérdida real durante Custody podrá necesitar un workflow coordinado futuro.

Actualmente estos modelos Healthcare todavía no existen.

---

# 74. API actual

Endpoints Core implementados:

```text
GET  /equipment

GET  /equipment/:id

POST /equipment

GET  /equipment/:equipmentId/availability

GET  /equipment/:equipmentId/inspections

POST /equipment/:equipmentId/inspections

POST /equipment/:equipmentId/retirement
```

No existen actualmente:

```text
PATCH /equipment/:id

DELETE /equipment/:id
```

La ausencia de estas operaciones genéricas protege:

```text
identity

lifecycle

condition

origin

retirement history
```

Las modificaciones sensibles deben diseñarse como operaciones explícitas.

---

# 75. Frontend Equipment V1

Ruta principal:

```text
/equipment
```

Capacidades actuales:

```text
list

search

lifecycle filter

condition filter

origin filter

detail

Current Availability

Inspection history

Inspection creation

manual Equipment creation

Retirement

deep-link
```

Deep-link:

```text
/equipment?assetId=<id>
```

El detalle se resuelve mediante:

```text
GET /equipment/:id
```

y no requiere que el activo esté presente en la página actual de la lista.

---

# 76. Datos mostrados

La experiencia actual puede presentar:

```text
assetCode

Product

SKU

serialNumber

lifecycle

condition

origin

batch / lot when present

registration date
```

`assetCode` es el identificador operacional principal mostrado.

El UUID permanece como identidad técnica.

---

# 77. Frontend manual creation

La acción:

```text
Nuevo equipo
```

permite seleccionar Products:

```text
active
+
inventoryTracking = ASSET
```

Payload actual de frontend:

```json
{
  "productId": "uuid",
  "condition": "GOOD | INSPECTION_PENDING | DAMAGED | OUT_OF_SERVICE",
  "serialNumber": "optional"
}
```

Aunque backend soporta conceptualmente:

```text
batchId?
```

el selector frontend de Batch todavía no existe.

---

# 78. Multi-tenancy

Las operaciones Equipment implementadas utilizan:

```text
companyId
```

derivado del usuario autenticado.

Principio:

```text
Authenticated Company
→ Equipment scope
```

No:

```text
client companyId
→ trusted authorization
```

Product y Batch relacionados deben pertenecer al mismo tenant.

---

# 79. Tenant behavior

Un Equipment inexistente o perteneciente a otra Company debe tratarse como no
accesible para el tenant autenticado.

La API no debe revelar innecesariamente:

```text
cross-tenant existence

condition

lifecycle

Availability

Inspection history
```

La regresión sistemática cross-tenant de toda la plataforma continúa siendo una
prioridad de seguridad general, aunque Equipment tenga scoping implementado.

---

# 80. Authorization

Actualmente Equipment utiliza:

```text
JwtAuthGuard

tenant validation
```

Permission-Based RBAC completo todavía no está implementado globalmente.

Operaciones sensibles deberán formar parte de la revisión de autorización antes
de producción.

Permisos conceptuales futuros pueden incluir:

```text
equipment.read

equipment.create

equipment.inspect

equipment.retire
```

Estos nombres no deben interpretarse como Permissions actualmente persistidos.

---

# 81. Validación HTTP

La API utiliza globalmente:

```text
ValidationPipe

whitelist = true

forbidNonWhitelisted = true

transform = true
```

Los DTOs deben rechazar campos controlados por servidor.

Ejemplos:

```text
companyId

assetCode

serialNumberKey

lifecycle

origin

retiredAt

retiredById
```

cuando no forman parte del contrato permitido.

---

# 82. Error contract

Errores esperados incluyen:

```text
400 Bad Request
→ invalid DTO
→ Product not ASSET
→ invalid condition
→ invalid retirement reason
→ OTHER without notes
→ inspection invalid for current lifecycle
```

```text
404 Not Found
→ Equipment not found in tenant
→ Product not found
→ Batch not found / incompatible
```

```text
409 Conflict
→ duplicate normalized serial
→ duplicate assetCode
→ already RETIRED
→ concurrent lifecycle transition
```

Detalles internos de Prisma o PostgreSQL no deben exponerse.

---

# 83. Transactions y atomicidad

Operaciones con múltiples efectos inseparables deben ser atómicas.

Ejemplos:

```text
Purchase Receipt + Equipment provisioning
```

```text
Inspection + Equipment condition update
```

```text
Retirement state + retirement metadata
```

Debe mantenerse:

```text
partial business mutation
→ not acceptable
```

---

# 84. Concurrencia

Equipment contiene operaciones donde la concurrencia importa.

Ejemplos:

```text
assetCode allocation

normalized serial uniqueness

Retirement lifecycle transition
```

La combinación de:

```text
database constraints

atomic operations

state-aware writes

transactions
```

debe proteger la integridad.

La generación concurrente de `assetCode` fue validada contra PostgreSQL durante
la implementación.

Los detalles históricos de cada ejecución pertenecen a los registros de proyecto,
no a este documento funcional.

---

# 85. Healthcare boundary

Healthcare utiliza Equipment como fuente de identidad física.

Conceptualmente:

```text
Healthcare Case
↓
Equipment Requirement
↓
Case Equipment Assignment
↓
EquipmentAsset
```

Debe mantenerse:

```text
Equipment Requirement
≠
Equipment Assignment
```

```text
Assignment
≠
Dispatch
```

```text
Assignment
≠
Custody
```

```text
Dispatch
≠
Commercial Inventory OUT
```

```text
Return
≠
Commercial Inventory IN
```

Estas reglas pertenecen a la arquitectura Healthcare objetivo.

---

# 86. Dispatch y Custody

Core Equipment no debe almacenar directamente por conveniencia:

```text
currentCaseId

currentCustodianId

hospitalId

doctorId
```

Healthcare deberá modelar:

```text
Assignment

Dispatch

Custody

Return
```

mediante sus propias relaciones operacionales.

Esto evita contaminar `EquipmentAsset`.

---

# 87. Healthcare Return

Un futuro Return responde:

```text
¿La unidad física volvió bajo control de la Company?
```

No significa automáticamente:

```text
available
```

La política objetivo Healthcare es:

```text
Return
↓
Warehouse custody
↓
INSPECTION_PENDING
↓
Core Inspection
↓
Current Availability evaluation
```

La integración todavía no está implementada.

---

# 88. Current Availability vs Healthcare Availability

Debe mantenerse:

```text
Core Equipment
→ Current Availability
```

y:

```text
Healthcare
→ Case Availability
```

Una unidad puede ser:

```text
ACTIVE
GOOD
Current Availability = true
```

y aun así, en el futuro:

```text
Case Availability = false
```

por:

```text
schedule conflict

Assignment

Custody

turnaround

Maintenance

Calibration
```

---

# 89. Maintenance boundary

Core Equipment V1 no implementa:

```text
CMMS

work orders

service providers

maintenance cost

spare parts

preventive schedules
```

No deben agregarse campos improvisados a `EquipmentAsset` para simular estas
capacidades.

---

# 90. Calibration boundary

Core Equipment V1 tampoco implementa un dominio completo de Calibration.

Un futuro dominio podrá administrar:

```text
requirements

records

due dates

providers

certificates

results
```

y contribuir con blockers a Availability.

---

# 91. IMPLEMENTED

Actualmente:

```text
EquipmentAsset persistence

Product ASSET validation

manual Equipment creation

Equipment list

Equipment detail

automatic assetCode generation

CompanySequence integration

serial normalization

serial uniqueness protection

optional Batch validation

Purchase Receipt ASSET provisioning

Purchase Receipt traceability

Current Availability

Availability endpoint

Inspection creation

Inspection history

Condition update through Inspection

Retirement

Retirement metadata

frontend Equipment workspace

Equipment deep-link

tenant-scoped operations
```

---

# 92. VALIDATED

La validación registrada incluye comportamiento automatizado y QA manual sobre:

```text
Equipment creation

Product ASSET validation

serial conflicts

assetCode allocation

list / detail

Purchase Receipt provisioning

partial Purchase Receipts

no duplicate stock mutation

Current Availability transitions

Inspection

Inspection history

Retirement

Retirement finality

tenant-scoped lookups

invalid DTOs

error contracts
```

También forman parte de los gates técnicos:

```text
backend regression

Prisma validation/status when applicable

build

lint

git diff --check
```

Los totales de tests y snapshots históricos pertenecen a:

```text
PROJECT_BOARD.md

CHANGELOG.md
```

y no deben fijarse permanentemente en este documento.

---

# 93. TECHNICAL DEBT

Permanece abierto:

```text
serial correction workflow
```

```text
manual frontend Batch selector
```

```text
Product.stock
↔
EquipmentAsset reconciliation
```

```text
retired actor name enrichment
```

```text
server-side pagination
```

```text
bulk/list Availability if scale requires it
```

```text
Equipment Audit integration
```

```text
typed authenticated request context
instead of repeated req.user typing workarounds
```

Además:

```text
SERIALIZED inventory semantics
```

continúa pendiente dentro de la evolución Inventory/Product tracking.

---

# 94. PROJECT SECURITY WORK

Antes de producción, Equipment participa en la revisión transversal de:

```text
authorization for sensitive operations

systematic tenant-isolation regression

inactive-user enforcement

safe role provisioning
```

No deben resolverse creando un sistema de autorización aislado solo para
Equipment.

Identity & Access continúa siendo la fuente transversal.

---

# 95. HEALTHCARE TARGET

Después del cierre del ERP Core, Healthcare podrá consumir Equipment mediante:

```text
Equipment Requirements

Case Equipment Assignment

Case Availability

Preparation

Dispatch

Custody

Return

Inspection integration

Reconciliation

Calendar

Case 360
```

Estos workflows no forman parte de Equipment V1.

---

# 96. FUTURE

Capacidades posteriores pueden incluir:

```text
serial correction

Equipment Audit integration

Equipment 360

Maintenance

Calibration

multi-warehouse Equipment support

advanced availability composition

bulk availability

barcode / QR Equipment workflows

import / migration workflows

advanced reconciliation
```

Solo deben incorporarse cuando exista una necesidad clara.

---

# 97. Invariantes

## Product identity

```text
Product
≠
EquipmentAsset
```

---

## Tracking

```text
SERIALIZED
≠
ASSET
```

---

## Physical identity

```text
ASSET physical unit
→ EquipmentAsset
```

---

## Inventory

```text
EquipmentAsset provisioning
≠
second Product.stock increment
```

---

## Lifecycle

```text
Lifecycle
≠
Condition
```

---

## Availability

```text
Condition
≠
Availability
```

---

## Current vs Case Availability

```text
Current Availability
≠
Case Availability
```

---

## Inspection

```text
Inspection
→ Condition
```

```text
Inspection
≠
direct Availability mutation
```

---

## Retirement

```text
Retirement
≠
DELETE
```

```text
RETIRED
→ historical identity preserved
```

---

## Lost

```text
Missing
≠
LOST
```

---

## Healthcare

```text
Assignment
≠
Custody
```

```text
Dispatch
≠
Inventory OUT
```

```text
Return
≠
Inventory IN
```

```text
Return
≠
Available
```

---

## Tenant

```text
Company A Equipment
≠
Company B access
```

---

# 98. Anti-patrones

## Duplicar catálogo

```text
EquipmentAsset
├── duplicated Product name
├── duplicated brand
└── duplicated category
```

como fuente paralela.

---

## Tratar ASSET como cantidad únicamente

```text
Product.stock += 5
without required Equipment identities
```

cuando el workflow debe representar unidades físicas.

---

## Duplicar Inventory mutation

```text
PurchaseReceipt increments stock
+
Equipment provisioning increments stock
```

Incorrecto.

---

## EquipmentAsset por SERIALIZED

```text
SERIALIZED
→ automatically create EquipmentAsset
```

Incorrecto en la implementación actual.

---

## available Boolean manual

```text
EquipmentAsset.available
→ manually edited
```

Incorrecto.

---

## Lifecycle como Availability

```text
ACTIVE
→ always available
```

Incorrecto.

---

## Condition como Case Availability

```text
GOOD
→ always assignable to Case
```

Incorrecto.

---

## Healthcare contamination

```text
EquipmentAsset.currentCaseId

EquipmentAsset.currentCustodianId

EquipmentAsset.hospitalId
```

agregados únicamente para resolver Healthcare.

---

## Generic lifecycle PATCH

```text
PATCH /equipment/:id

{
  "lifecycle": "RETIRED"
}
```

en lugar de Retirement explícito.

---

## Equipment DELETE

```text
DELETE EquipmentAsset
```

para representar retiro o corrección histórica.

---

## Silent Inspection rewrite

Editar una Inspection histórica en lugar de registrar un nuevo evento.

---

# 99. Relación con Products

`PRODUCTS.md` define:

```text
Product catalog

inventoryTracking

lotTracking
```

`EQUIPMENT.md` define:

```text
physical ASSET identity
```

---

# 100. Relación con Inventory

`INVENTORY.md` define:

```text
stock

InventoryMovement

InventoryBatch

inventory traceability
```

`EQUIPMENT.md` define:

```text
EquipmentAsset

lifecycle

condition

Inspection

Retirement

Current Availability
```

---

# 101. Relación con Purchase Receipts

`PURCHASE_RECEIPTS.md` define:

```text
physical receipt

Inventory IN

lot rules

idempotency

Receipt transaction
```

Equipment participa mediante:

```text
ASSET provisioning
```

sin apropiarse del transaction boundary completo de Receipt.

---

# 102. Relación con Healthcare

Healthcare debe referenciar `EquipmentAsset` como identidad Core.

Los detalles de:

```text
Requirement

Assignment

Case Availability

Dispatch

Custody

Return
```

deben documentarse en:

```text
docs/modules/healthcare/
```

y no duplicarse completamente dentro de Equipment.

---

# 103. Documentación relacionada

```text
docs/modules/erp/PRODUCTS.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/PURCHASES.md

docs/modules/erp/PURCHASE_RECEIPTS.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/modules/healthcare/HEALTHCARE.md

docs/modules/healthcare/CASES.md

docs/modules/healthcare/DOMAIN_MODEL.md

docs/architecture/ARCHITECTURE.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

---

# 104. Fuente de verdad

```text
EQUIPMENT.md
→ Core Equipment functional/domain behavior

PRODUCTS.md
→ Product tracking strategy

INVENTORY.md
→ Inventory semantics

PURCHASE_RECEIPTS.md
→ Receipt and provisioning orchestration

Healthcare documentation
→ Assignment / Custody / Case Logistics

ARCHITECTURE.md
→ architectural boundaries

schema.prisma
→ current persistence model

Equipment backend
→ CURRENT implementation

Equipment frontend
→ CURRENT user experience

tests
→ validated behavior

PROJECT_BOARD.md
→ current project state and active debt

CHANGELOG.md
→ historical implementation evolution
```

---

# 105. Estado consolidado

```text
Equipment Registration
✅ IMPLEMENTED / VALIDATED

Equipment Read
✅ IMPLEMENTED / VALIDATED

Automatic assetCode
✅ IMPLEMENTED / VALIDATED

Purchase Receipt → EquipmentAsset
✅ IMPLEMENTED / VALIDATED

Current Availability
✅ IMPLEMENTED / VALIDATED

Inspection
✅ IMPLEMENTED / VALIDATED

Retirement
✅ IMPLEMENTED / VALIDATED

Frontend Equipment V1
✅ IMPLEMENTED / VALIDATED
```

Pendiente:

```text
Serial correction
⏳

Manual Batch selector
⏳

Product.stock ↔ EquipmentAsset reconciliation
⏳

Equipment Audit integration
⏳

Pagination / scaling improvements
⏳
```

Healthcare:

```text
Case Equipment Assignment
⏳ TARGET

Case Availability
⏳ TARGET

Dispatch
⏳ TARGET

Custody
⏳ TARGET

Return
⏳ TARGET
```

---

# 106. Secuencia de proyecto

Equipment V1 forma parte del ERP Core ya normalizado.

La secuencia vigente del proyecto es:

```text
H8 Documentation / Technical Regression
↓
UX-B.6 Full ERP End-to-End QA
↓
ERP Core V1 Closure
↓
Healthcare specialization
```

Por tanto:

```text
Healthcare Equipment Assignment
```

es una capacidad futura de Healthcare después del cierre correspondiente del ERP
Core, no el siguiente cambio inmediato dentro de Core Equipment.

---

# 107. Principio final

Equipment representa realidad física.

Debe mantenerse:

```text
Product
≠
EquipmentAsset

SERIALIZED
≠
ASSET

Lifecycle
≠
Condition

Condition
≠
Availability

Current Availability
≠
Case Availability

Assignment
≠
Custody

Dispatch
≠
Inventory OUT

Return
≠
Inventory IN

Return
≠
Available

Inspection
≠
Availability

Missing
≠
LOST

Retirement
≠
DELETE
```

La dirección correcta es:

```text
Product
↓
Inventory strategy
↓
EquipmentAsset identity
↓
Condition / Lifecycle
↓
Core Availability
↓
Healthcare operational orchestration
```

sin sacrificar identidad física, historial, tenant isolation ni ownership de
dominio para simplificar un CRUD.
