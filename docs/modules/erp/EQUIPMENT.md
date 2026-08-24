# Equipment — Zaping ERP

**Módulo:** Core Equipment
**Producto:** Zaping ERP
**Versión:** 1.5.0
**Estado:** Approved
**Estado de implementación:** PARTIALLY IMPLEMENTED — CORE BACKEND + INSPECTION + RETIREMENT + AUTOMATIC ASSET CODE
**Última actualización:** 2026-08-23
**Responsable:** Zaping Team

---

# Estado de esta versión

Esta versión consolida las decisiones de dominio aprobadas en `EQUIPMENT.md v1.2.0` y registra la primera implementación técnica de Core Equipment.

A partir de esta versión deben distinguirse claramente:

```text
DOMAIN DECISION
→ approved business / architecture rule

PERSISTENCE
→ Prisma / PostgreSQL implemented

BACKEND
→ NestJS API implemented

OPERATIONAL WORKFLOW
→ future or pending implementation
```

Estado general:

```text
Equipment Core Domain
→ APPROVED

Equipment Persistence Baseline
→ IMPLEMENTED

Equipment Core Backend — Registration / Read
→ IMPLEMENTED

Automatic assetCode Generation
→ IMPLEMENTED / VALIDATED

Equipment Operational Workflows
→ PARTIAL / PENDING

Equipment Frontend
→ NOT IMPLEMENTED

Healthcare Equipment Integration
→ NOT IMPLEMENTED
```

---

# Implementación entregada en v1.3.0

Se encuentran implementados:

```text
ProductInventoryTracking
ProductLotTracking

EquipmentLifecycle
EquipmentCondition
EquipmentOrigin
EquipmentRetirementReason

EquipmentAsset persistence
EquipmentInspection persistence baseline

Equipment NestJS Module
Equipment Controller
Equipment Service
CreateEquipmentDto

GET /equipment
GET /equipment/:id
POST /equipment

JWT protection
companyId tenant isolation
Product ASSET validation
Product active validation
Batch ownership validation
server-generated assetCode
CompanySequence assetCode allocation
assetCode duplicate protection
serial normalization
serial duplicate validation
DTO validation
400 / 404 / 409 error handling
```

También se actualizó Products para permitir definir durante creación:

```text
inventoryTracking
lotTracking
```

La modificación genérica de esas estrategias mediante `UpdateProductDto` no forma parte de la edición normal.

---

# Capacidades todavía pendientes

No deben considerarse implementadas todavía:

```text
serial correction operation
assetCode correction operation
automatic creation from Purchase Receipt
Inventory / Equipment synchronization policy
Availability Evaluator
Case Equipment Assignment
Custody
Dispatch
Return
Maintenance
Calibration
Equipment Registry frontend
Equipment 360
Healthcare operational integration
Equipment-specific audit workflow
```

---

# 1. Ownership del dominio

`EquipmentAsset` pertenece a Zaping ERP/Core.

```text
Zaping ERP / Core
│
└── Equipment
    └── EquipmentAsset
```

Healthcare consume Equipment mediante:

```text
Zaping Healthcare
│
├── HealthcareCase
├── CaseKit
├── Equipment Requirement
├── Case Equipment Assignment
└── Case Logistics
    ├── Preparation
    ├── Dispatch
    ├── Custody
    ├── Return
    └── Inspection
```

Debe mantenerse:

```text
EquipmentAsset
→ generic reusable physical asset
```

mientras:

```text
Case Equipment Assignment
CaseKit Equipment requirements
Healthcare Dispatch
Healthcare Return
Healthcare Inspection
```

pertenecen al dominio Healthcare.

La fuente de verdad documental de la identidad física del activo es:

```text
modules/erp/EQUIPMENT.md
```

Healthcare deberá referenciar este documento y no crear una definición paralela de `EquipmentAsset`.

**Estado:** APPROVED / IMPLEMENTED AT CORE DOMAIN.

---

# 2. Product relationship

Todo `EquipmentAsset` pertenece obligatoriamente a un `Product`.

```text
Product
1
│
└── *
    EquipmentAsset
```

Debe mantenerse:

```text
Product
→ what the resource/model is

EquipmentAsset
→ which exact physical unit it is
```

Por tanto:

```text
EquipmentAsset.productId
→ REQUIRED
```

y debe cumplirse:

```text
EquipmentAsset.companyId
=
Product.companyId
```

No debe existir dentro de Equipment un catálogo paralelo para:

```text
name
brand
model
category
description
```

cuando estos datos pertenecen a Product.

Los recursos internos no vendibles deberán resolverse mediante capacidades/configuración de Product y no haciendo `productId` opcional.

La creación actual del backend valida que el Product:

```text
exists
belongs to the authenticated Company
uses ASSET tracking
is active
```

**Estado:** APPROVED / IMPLEMENTED.

---

# 3. Product inventory tracking

La estrategia técnica definitiva es:

```text
enum ProductInventoryTracking {
  QUANTITY
  SERIALIZED
  ASSET
}
```

Semántica:

```text
QUANTITY
→ units represented primarily through quantities

SERIALIZED
→ individually serialized commercial units

ASSET
→ reusable physical assets represented by EquipmentAsset
```

Debe mantenerse:

```text
SERIALIZED
≠
ASSET
```

Ejemplos:

```text
Catéter
→ QUANTITY
```

```text
Marcapasos
→ SERIALIZED
```

```text
Programador reutilizable
→ ASSET
```

Un `EquipmentAsset` solo puede crearse cuando:

```text
Product.inventoryTracking = ASSET
```

La API rechaza productos con cualquier otra estrategia.

**Estado:** APPROVED / PERSISTED / BACKEND ENFORCED.

---

# 4. Lot tracking

Lot tracking es una dimensión independiente.

La estrategia técnica definitiva es:

```text
enum ProductLotTracking {
  NONE
  OPTIONAL
  REQUIRED
}
```

Puede coexistir con diferentes estrategias de identidad.

Ejemplo:

```text
EquipmentAsset
+
serialNumber
+
InventoryBatch
```

Debe mantenerse:

```text
batch
≠
serial
≠
asset identity
```

En creación manual, cuando se proporciona `batchId`, el backend valida que el lote pertenezca:

```text
same Company
+
same Product
```

La política completa entre `lotTracking` y obligatoriedad del `batchId` deberá cerrarse dentro de la futura integración Inventory / Purchase Receipt / Equipment.

**Estado:** APPROVED / PERSISTED / PARTIALLY ENFORCED.

---

# 5. EquipmentAsset como verdad física

Para Products con:

```text
inventoryTracking = ASSET
```

los registros:

```text
EquipmentAsset
```

representan las unidades físicas individuales.

Conceptualmente:

```text
EquipmentAsset records
→ physical unit truth
```

`Product.stock` puede mantenerse temporalmente por compatibilidad con el sistema existente, pero deberá evolucionar hacia:

```text
aggregate / projection
```

y no:

```text
independent source of truth
```

Debe impedirse eventualmente:

```text
Product.stock = 6
```

cuando solamente existen:

```text
4 valid EquipmentAssets
```

sin una operación de dominio que explique la diferencia.

Regla:

> **Un Product controlado mediante EquipmentAsset no puede incrementar su cantidad física sin crear las identidades físicas correspondientes.**

La sincronización completa `Product.stock ↔ EquipmentAsset` todavía no está implementada.

**Estado:** DOMAIN APPROVED / ENFORCEMENT PENDING.

---

# 6. Inventory relationship

Equipment extiende Inventory.

No lo reemplaza.

```text
Inventory
│
├── Quantity tracked Products
├── Serialized Products
└── Asset tracked Products
    │
    └── EquipmentAsset
```

Las operaciones futuras de:

```text
acquisition
receipt
creation
retirement
disposition
```

deberán mantener consistencia entre:

```text
Inventory
Product
EquipmentAsset
```

Cuando varias escrituras formen una sola operación de negocio deberán ejecutarse transaccionalmente.

La integración completa con Inventory todavía está pendiente.

**Estado:** APPROVED / INTEGRATION PENDING.

---

# 7. Healthcare Dispatch no es Inventory OUT

Debe mantenerse:

```text
Reusable Equipment Dispatch
≠
Commercial Inventory OUT
```

Cuando:

```text
Warehouse
↓
Technician
```

la propiedad física del activo no cambia.

Lo que cambia es:

```text
Custody
```

No:

```text
owned quantity
```

Igualmente:

```text
Return
≠
Commercial Inventory IN
```

El Equipment nunca dejó de pertenecer a la Company.

**Estado:** APPROVED / HEALTHCARE WORKFLOW PENDING.

---

# 8. Lifecycle

La estrategia técnica definitiva es:

```text
enum EquipmentLifecycle {
  ACTIVE
  RETIRED
}
```

`ACTIVE` significa:

```text
The asset remains part of the managed fleet.
```

No significa:

```text
AVAILABLE
```

`RETIRED` significa:

```text
The asset permanently left normal operational use.
```

Debe mantenerse:

```text
RETIRED
→ historical record remains
```

Los nuevos Equipment creados usan:

```text
lifecycle = ACTIVE
```

por defecto.

No existe edición genérica de lifecycle mediante la API actual.

**Estado:** APPROVED / PERSISTED / RETIREMENT WORKFLOW PENDING.

---

# 9. Disposition

La estrategia técnica definitiva para razones de retiro es:

```text
enum EquipmentRetirementReason {
  SOLD
  LOST
  DESTROYED
  END_OF_LIFE
  REPLACED
  OTHER
}
```

Estas razones no son Lifecycle states.

Conceptualmente:

```text
ACTIVE
↓
Retirement / Disposition
↓
RETIRED

Reason:
SOLD
LOST
DESTROYED
END_OF_LIFE
REPLACED
OTHER
```

Persistencia disponible en `EquipmentAsset`:

```text
retiredAt
retiredById
retiredReason
retirementNotes
```

La operación de Retirement todavía no está expuesta mediante API.

**Estado:** APPROVED / PERSISTED / WORKFLOW PENDING.

---

# 10. Missing no significa Lost

Debe mantenerse:

```text
Overdue
≠
Lost
```

```text
Missing
≠
Lost
```

```text
Open incident
≠
Lost
```

Un activo solo puede considerarse perdido mediante resolución explícita y autorizada.

Resultado final:

```text
Lifecycle:
RETIRED

Disposition:
LOST
```

**Estado:** APPROVED / WORKFLOW PENDING.

---

# 11. Retirement

Retirement será una operación explícita, autorizada y auditable.

Antes de retirar normalmente deberán resolverse:

```text
active assignments
active custody
open operational dependencies
```

Una pérdida confirmada puede requerir un flujo excepcional para cerrar custodia sin retorno físico.

Un activo `RETIRED`:

```text
cannot receive new assignments
cannot be dispatched
cannot become available
```

pero conservará:

```text
Case history
Custody history
Inspection history
Audit
Purchase origin
Disposition history
```

No existe:

```text
DELETE /equipment/:id
```

La eliminación física de un Equipment no forma parte del contrato normal.

**Estado:** APPROVED / API PENDING.

---

# 12. Reactivation

Fase 1 no tendrá una operación normal:

```text
Reactivate Equipment
```

Retirement representa una decisión definitiva.

Una corrección administrativa futura requerirá una operación:

```text
exceptional
authorized
audited
```

**Estado:** APPROVED / NOT IMPLEMENTED.

---

# 13. Condition

La estrategia técnica definitiva es:

```text
enum EquipmentCondition {
  GOOD
  INSPECTION_PENDING
  DAMAGED
  OUT_OF_SERVICE
}
```

Condition representa el snapshot operacional actual del activo.

Durante creación manual se exige una condición inicial válida.

No existe una operación genérica de edición de Condition.

**Estado:** APPROVED / PERSISTED / INSPECTION WORKFLOW PENDING.

---

# 14. GOOD

```text
GOOD
```

significa que no existe una condición física u operacional conocida que impida el uso normal.

No garantiza Availability.

Puede coexistir con blockers externos como:

```text
active assignment
external custody
maintenance
calibration
```

**Estado:** APPROVED.

---

# 15. INSPECTION_PENDING

Representa:

```text
Physical condition has not yet been validated.
```

Debe utilizarse especialmente después de Return cuando la política exige Inspection.

También puede utilizarse durante migraciones o altas iniciales cuando la condición del activo aún no ha sido validada.

La API de creación manual permite registrar esta condición.

**Estado:** APPROVED / PERSISTED.

---

# 16. DAMAGED

Representa daño conocido.

En Fase 1:

```text
DAMAGED
→ NOT AVAILABLE
```

No crea automáticamente:

```text
Maintenance work order
```

**Estado:** APPROVED / PERSISTED / AVAILABILITY PENDING.

---

# 17. OUT_OF_SERVICE

Representa una decisión operacional de impedir utilización.

Puede existir:

```text
Lifecycle:
ACTIVE

Condition:
OUT_OF_SERVICE
```

porque la unidad continúa perteneciendo a la Company.

**Estado:** APPROVED / PERSISTED.

---

# 18. Maintenance no es Condition

No debe existir dentro de Condition una semántica como:

```text
MAINTENANCE_REQUIRED
```

Maintenance será una capacidad independiente.

Debe poder existir:

```text
Condition:
GOOD

Maintenance blocker:
YES
```

**Estado:** APPROVED / FUTURE DOMAIN.

---

# 19. Calibration no es Condition

No debe existir dentro de Condition una semántica como:

```text
CALIBRATION_REQUIRED
```

Debe poder existir:

```text
Condition:
GOOD

Calibration:
OVERDUE

Availability:
NO
```

No todos los Equipment estarán sujetos a calibración.

**Estado:** APPROVED / FUTURE DOMAIN.

---

# 20. Maintenance boundary

Equipment Fase 1 no implementará:

```text
CMMS
work orders
service providers
maintenance costs
spare parts
preventive maintenance schedules
```

Un futuro dominio `EquipmentMaintenance` administrará esas capacidades.

No deben agregarse campos improvisados a `EquipmentAsset` para sustituir dicho dominio.

**Estado:** APPROVED.

---

# 21. Calibration boundary

Fase 1 no implementará un sistema completo de calibración.

Futuras capacidades podrán administrar:

```text
calibration requirements
calibration records
next due date
providers
certificates
results
```

Equipment deberá estar preparado para consumir un:

```text
Calibration blocker
```

dentro de Availability.

**Estado:** APPROVED.

---

# 22. No blocker booleans manuales

No deben convertirse en fuente de verdad campos manuales como:

```text
maintenanceBlocked Boolean
calibrationBlocked Boolean
available Boolean
```

Los blockers deberán derivarse de los dominios correspondientes.

**Estado:** APPROVED.

---

# 23. Custody

Custody responde:

```text
¿Quién posee actualmente responsabilidad física sobre el activo?
```

La custodia cambia mediante transferencias físicas confirmadas.

No mediante edición de master data.

Debe mantenerse:

```text
Assignment
≠
Custody
```

```text
Preparation
≠
Custody
```

```text
Case schedule
≠
Custody
```

**Estado:** APPROVED / HEALTHCARE WORKFLOW PENDING.

---

# 24. Dispatch cambia Custody

Cuando un Dispatch se confirma:

```text
Warehouse
↓
Technician
```

se inicia una custodia externa.

El Dispatch debe conservar:

```text
EquipmentAsset
Case
Custodian
Timestamp
Actor
Condition at dispatch
```

según el contrato final de Case Logistics.

Debe mantenerse:

```text
Actor performing Dispatch
≠
Custodian
```

**Estado:** APPROVED / PENDING.

---

# 25. Return cambia Custody

Cuando Return se confirma:

```text
Technician
↓
Warehouse
```

la custodia externa termina.

Esto no significa:

```text
AVAILABLE
```

**Estado:** APPROVED / PENDING.

---

# 26. Custodia única

Invariante:

> **Un EquipmentAsset no puede poseer más de una custodia física activa simultáneamente.**

Una transferencia futura:

```text
Carlos
↓
Ana
```

deberá conservar historia.

No deberá implementarse mediante un simple overwrite del custodian actual.

**Estado:** APPROVED / PENDING.

---

# 27. Location

Fase 1 utilizará Location de manera conservadora.

Principalmente:

```text
Warehouse
External Custody
```

Case, hospital y técnico podrán proporcionar contexto.

Ejemplo UI:

```text
EQ-0041

With:
Carlos

Case:
CASE-0145

Destination:
Hospital ABC
```

Esto no implica que Zaping conozca ubicación GPS exacta.

**Estado:** APPROVED / PENDING.

---

# 28. Multi-Warehouse

Cuando ERP implemente múltiples almacenes:

```text
Equipment
→ must reuse Core Warehouse infrastructure
```

No deberá existir:

```text
HealthcareWarehouse
```

como catálogo paralelo.

**Estado:** APPROVED / FUTURE.

---

# 29. Case Equipment Assignment

`CaseEquipmentAssignment` representa:

> **La reserva operacional de un EquipmentAsset específico para un Healthcare Case.**

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

**Estado:** APPROVED / HEALTHCARE PENDING.

---

# 30. Assignment creation

Assignment nace cuando:

```text
User selects asset
↓
Backend validates
↓
Assignment confirmed
```

No cuando el usuario simplemente lo visualiza o selecciona temporalmente en frontend.

Backend deberá revalidar Availability al confirmar.

**Estado:** APPROVED / PENDING.

---

# 31. Assignment conflict

Una misma unidad física no puede poseer Assignments temporalmente incompatibles.

Ejemplo:

```text
CASE-0145
08:00–11:00
EQ-0041

CASE-0146
09:00–12:00
EQ-0041
```

Resultado:

```text
BLOCK
```

No warning.

**Estado:** APPROVED / PENDING.

---

# 32. Turnaround

Un riesgo sin overlap directo puede producir inicialmente:

```text
WARNING
```

Ejemplo:

```text
Case A ends:
11:00

Case B starts:
11:15
```

por tiempo insuficiente para:

```text
transport
return
inspection
preparation
dispatch
```

Fase 1 no requiere todavía una política automática de:

```text
minimumTurnaroundMinutes
```

**Estado:** APPROVED / FUTURE.

---

# 33. Case without schedule

Cuando no exista horario completo:

```text
Assignment may be allowed
+
schedule verification warning
```

en Fase 1.

El sistema deberá comunicar que el conflicto temporal no pudo validarse completamente.

**Estado:** APPROVED / PENDING.

---

# 34. Reassignment

Antes del Dispatch:

```text
EQ-0041
↓
Reassign
↓
EQ-0042
```

puede permitirse.

Debe conservarse historia.

Después del Dispatch no puede reescribirse cuál activo salió.

Una sustitución requiere:

```text
new assignment
+
new physical operation
```

según corresponda.

**Estado:** APPROVED / PENDING.

---

# 35. Release Assignment

Antes de Dispatch:

```text
Case cancelled
↓
Release Assignment
```

puede devolver disponibilidad si no existen otros blockers.

Después de Dispatch:

```text
Release alone
→ forbidden
```

Debe resolverse primero la realidad física mediante Return.

**Estado:** APPROVED / PENDING.

---

# 36. Availability

Availability será:

```text
derived
contextual
explainable
```

Nunca será un status manual independiente.

**Estado:** APPROVED / EVALUATOR PENDING.

---

# 37. Availability evaluator

Debe existir una única lógica de dominio utilizada por:

```text
Equipment Registry
Equipment 360
Equipment Selector
CaseKit
Case Calendar
Warehouse Operations
Mobile
API
```

Todos deben obtener el mismo resultado bajo los mismos hechos.

**Estado:** APPROVED / NOT IMPLEMENTED.

---

# 38. Current Availability

Pregunta:

```text
¿Puede utilizarse esta unidad ahora?
```

Conceptualmente requiere:

```text
Lifecycle ACTIVE
+
Condition GOOD
+
No blocking custody
+
Inspection satisfied
+
No maintenance blocker
+
No calibration blocker
+
No immediate operational blocker
```

**Estado:** APPROVED / NOT IMPLEMENTED.

---

# 39. Availability for Case

Pregunta:

```text
¿Puede asignarse esta unidad a este Case?
```

Necesita además:

```text
Target Case
Target schedule
Existing assignments
Conflict rules
```

Por tanto Availability no debe reducirse a:

```text
available Boolean
```

persistido permanentemente.

**Estado:** APPROVED / NOT IMPLEMENTED.

---

# 40. Availability result

La evaluación deberá devolver razones explicables.

Ejemplo:

```text
available: false
reason:
INSPECTION_PENDING
```

o:

```text
available: false
reason:
EXTERNAL_CUSTODY
```

o:

```text
available: false
reason:
CASE_CONFLICT
```

Los reason codes definitivos se definirán durante API design.

**Estado:** APPROVED / API DESIGN PENDING.

---

# 41. Availability blockers conceptuales

Pueden incluir:

```text
RETIRED
DAMAGED
OUT_OF_SERVICE
INSPECTION_PENDING
EXTERNAL_CUSTODY
CASE_CONFLICT
MAINTENANCE_BLOCKED
CALIBRATION_BLOCKED
```

Estos nombres no se consideran enums Prisma hasta que el Availability design los formalice.

**Estado:** APPROVED CONCEPTUALLY.

---

# 42. No Force Available

No debe existir una operación ordinaria:

```text
Force Available
```

Las excepciones deberán resolver la causa real.

Ejemplos:

```text
Inspection pending
→ Complete Inspection
```

```text
Active Assignment
→ Release Assignment
```

```text
OUT_OF_SERVICE
→ Authorized Condition resolution
```

**Estado:** APPROVED.

---

# 43. Return

Return responde:

```text
¿La unidad física regresó bajo control de la Company?
```

Debe procesarse por `EquipmentAsset`.

Un Return general del Case no puede ocultar unidades faltantes.

**Estado:** APPROVED / HEALTHCARE PENDING.

---

# 44. Return parcial

Ejemplo:

```text
Dispatched:
EQ-0041
EQ-0042

Returned:
EQ-0041

Pending:
EQ-0042
```

Resultado:

```text
EQ-0041
→ returned

EQ-0042
→ remains in external custody
```

**Estado:** APPROVED / PENDING.

---

# 45. Return no significa Available

En Healthcare Fase 1:

```text
Return confirmed
↓
Warehouse custody
↓
Condition = INSPECTION_PENDING
↓
Availability = NO
```

hasta completar Inspection.

**Estado:** APPROVED / PENDING.

---

# 46. Inspection policy Fase 1

Todo Equipment despachado para un Healthcare Case requerirá Inspection después de Return.

Más adelante podrá existir política configurable según:

```text
Product
Equipment type
Company
workflow
```

**Estado:** APPROVED / WORKFLOW PENDING.

---

# 47. Inspection

Inspection debe poder validar al menos:

```text
correct asset
serial
physical condition
operational condition
required accessories/support items
incident
notes
```

La persistencia base para `EquipmentInspection` existe.

La API y reglas completas de Inspection todavía están pendientes.

**Estado:** PERSISTENCE BASELINE IMPLEMENTED / WORKFLOW PENDING.

---

# 48. Inspection result

Flujo:

```text
INSPECTION_PENDING
↓
Inspection
├── GOOD
├── DAMAGED
└── OUT_OF_SERVICE
```

Inspection actualiza Condition.

No Availability directamente.

**Estado:** APPROVED / PENDING.

---

# 49. Availability después de Inspection

Debe mantenerse:

```text
Inspection GOOD
↓
Availability evaluator
```

No:

```text
Inspection GOOD
↓
available = true
```

porque pueden existir otros blockers.

**Estado:** APPROVED / PENDING.

---

# 50. Serial mismatch

Si:

```text
Expected:
EQ-0041 / SN-99102
```

pero se recibe:

```text
EQ-0042 / SN-99103
```

debe producirse:

```text
RETURN EXCEPTION
```

Nunca una sustitución silenciosa.

**Estado:** APPROVED / PENDING.

---

# 51. Inspection history

Condition actual funciona como snapshot operacional.

Las inspecciones deberán conservar historia.

Ejemplo:

```text
Aug 13
CASE-0101
Inspection GOOD

Sep 12
CASE-0145
Inspection DAMAGED
```

No deberá reescribirse una Inspection histórica para alterar el pasado.

**Estado:** APPROVED / PERSISTENCE BASELINE AVAILABLE.

---

# 52. assetCode

Todo `EquipmentAsset` posee obligatoriamente:

```text
assetCode
```

La restricción técnica implementada es:

```text
companyId + assetCode
→ UNIQUE
```

`assetCode` es:

```text
unique inside Company
stable
immutable through normal operations
never reused after Retirement
operational identity only
```

No codifica:

```text
Product
category
brand
warehouse
location
condition
```

**Estado:** APPROVED / IMPLEMENTED.

---

# 53. assetCode generation

Zaping genera `assetCode` automáticamente por defecto durante el registro normal de Equipment.

Formato implementado:

```text
EQ-000001
EQ-000002
...
EQ-999999
EQ-1000000
```

Los seis dígitos son ancho mínimo de presentación, no límite máximo.

El registro normal:

```text
POST /equipment
→ does not accept client-controlled assetCode
```

`CreateEquipmentDto` no expone `assetCode`.

La generación utiliza la persistencia existente:

```text
CompanySequence
companyId + key = EQUIPMENT_ASSET_CODE
```

`CompanySequence.nextValue` representa el siguiente valor numérico disponible para asignación.

Bootstrap:

```text
createMany
data:
  companyId
  key = EQUIPMENT_ASSET_CODE
  nextValue = 1
skipDuplicates = true
```

Asignación:

```text
atomic update:
  nextValue += 1

allocatedValue = returned nextValue - 1
```

Formato:

```text
EQ-${value.toString().padStart(6, '0')}
```

La asignación de secuencia y la creación de `EquipmentAsset` ocurren dentro de la misma transacción Prisma.

Antes del insert se verifica si el candidato ya está ocupado:

```text
companyId + assetCode
```

Si el candidato ya existe:

```text
allocate next sequence value
↓
check next candidate
↓
continue until free
```

Esto permite saltar códigos históricos o manuales con forma generada.

Los códigos de Equipment retirado permanecen reservados. La verificación de ocupación no filtra por Lifecycle.

Si `EquipmentAsset.create` produce un `P2002`, no se reintenta dentro de la misma transacción PostgreSQL. El error sigue el manejo normal y la transacción revierte.

No se requirió cambio de Prisma schema.

No se requirió migración.

Los gaps de secuencia son aceptables. La numeración gapless no es requisito de dominio.

Validación:

```text
Equipment tests
3 suites
42 tests
42 passed

Full backend
29 suites
154 tests
154 passed

npx prisma validate
PASS

npm run build
PASS

ESLint
PASS
```

QA PostgreSQL real:

```text
10 simultaneous POST /equipment requests
10 successes
10 unique assetCodes
0 failures

5 simultaneous POST /equipment requests after transaction correction
5 successes
5 unique assetCodes
0 failures
```

QA HTTP:

```text
assetCode = CUSTOM-001
→ 400 Bad Request
→ property assetCode should not exist

POST /equipment without assetCode
→ 201 Created
→ server-generated assetCode
```

**Estado:** IMPLEMENTED / VALIDATED.

---

# 54. Imported assetCode

Importaciones y migraciones podrán preservar un código existente cuando sea:

```text
valid
unique inside Company
```

Esto evita obligar a clientes a reetiquetar activos existentes durante onboarding.

La persistencia permite esta estrategia.

El workflow específico de importación todavía no está implementado.

**Estado:** APPROVED / IMPORT WORKFLOW PENDING.

---

# 55. assetCode immutability

`assetCode` será identidad operacional estable.

Una corrección excepcional futura deberá ser:

```text
authorized
validated
audited
```

y no una edición normal.

Por esta razón la API Core actual no expone:

```text
PATCH /equipment/:id
```

para modificación genérica del activo.

Una futura corrección deberá diseñarse como operación explícita.

**Estado:** APPROVED / API ALIGNED.

---

# 56. assetCode reuse

Un `assetCode` nunca podrá reutilizarse.

Incluso cuando:

```text
Lifecycle = RETIRED
```

Ejemplo inválido:

```text
Old Equipment:
EQ-0041
RETIRED

New Equipment:
EQ-0041
```

La combinación:

```text
companyId + assetCode
```

es única en persistencia.

Mientras los activos retirados conserven su registro histórico, el código no puede reutilizarse.

**Estado:** APPROVED / DATABASE ENFORCED.

---

# 57. serialNumber

`serialNumber` es:

```text
optional
```

Debe conservarse cuando exista.

No posee restricción global:

```text
serialNumber @unique
```

El sistema utiliza además:

```text
serialNumberKey
```

como representación normalizada para detección consistente de duplicados.

Ejemplo:

```text
serialNumber:
sn-test-001

serialNumberKey:
SN-TEST-001
```

Un Equipment puede existir correctamente con:

```text
serialNumber = null
serialNumberKey = null
```

**Estado:** APPROVED / IMPLEMENTED.

---

# 58. Serial duplicate validation

La restricción técnica definitiva es:

```text
companyId
+
productId
+
serialNumberKey
→ UNIQUE
```

En operación normal:

```text
SN-TEST-001
sn-test-001
```

se consideran el mismo serial normalizado para el mismo Product dentro de la misma Company.

La API responde:

```text
409 Conflict
```

cuando detecta el duplicado.

El serial no es globalmente único entre Products o Companies.

**Estado:** APPROVED / DATABASE + BACKEND ENFORCED.

---

# 59. Serial correction

`serialNumber` podrá corregirse cuando exista error de captura.

La futura corrección deberá:

```text
require authorization
validate duplicates
generate audit
```

y no cambiará la identidad del `EquipmentAsset`.

No existe actualmente un endpoint genérico para modificar serial.

Una futura implementación deberá utilizar una operación explícita, por ejemplo conceptualmente:

```text
Correct Equipment Serial
```

y no un PATCH genérico de master data.

**Estado:** APPROVED / NOT IMPLEMENTED.

---

# 60. Asset creation

El backend implementa registro normal de Equipment con `assetCode` generado por servidor.

Flujo actual:

```text
Authenticated User
↓
POST /equipment
↓
Read companyId from authenticated context
↓
Validate CreateEquipmentDto
  assetCode is not accepted
↓
Find Product inside same Company
↓
Validate Product exists
↓
Validate Product.inventoryTracking = ASSET
↓
Validate Product.isActive = true
↓
If batchId exists:
  validate same Company
  validate same Product
↓
Normalize optional serialNumber
↓
Generate serialNumberKey
↓
Validate companyId + productId + serialNumberKey uniqueness
↓
BEGIN Prisma transaction
↓
Ensure CompanySequence:
  companyId
  key = EQUIPMENT_ASSET_CODE
↓
Allocate next sequence value atomically
↓
Format assetCode
↓
Validate candidate is not already occupied inside Company
↓
If occupied:
  allocate next value
  check next candidate
↓
Create EquipmentAsset
↓
origin = MANUAL
lifecycle = ACTIVE
↓
COMMIT
↓
Return Equipment + Product + optional Batch
```

Datos aceptados por el endpoint:

```text
productId
serialNumber?
condition
batchId?
```

Datos que no son controlados directamente por el cliente:

```text
companyId
assetCode
serialNumberKey
lifecycle
origin
purchaseReceiptItemId
retiredAt
retiredById
retiredReason
retirementNotes
```

Resultado:

```text
EquipmentAsset created
```

**Estado:** IMPLEMENTED.

---

# 61. EquipmentAsset persistence baseline

La persistencia Core contempla al menos:

```text
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

Constraints e índices implementados incluyen:

```text
UNIQUE id + companyId
UNIQUE companyId + assetCode
UNIQUE companyId + productId + serialNumberKey

INDEX companyId + productId
INDEX companyId + serialNumberKey
INDEX companyId + lifecycle
INDEX companyId + condition
INDEX batchId
INDEX purchaseReceiptItemId
INDEX retiredById
```

**Estado:** IMPLEMENTED.

---

# 62. EquipmentOrigin

La estrategia técnica definitiva es:

```text
enum EquipmentOrigin {
  MANUAL
  PURCHASE_RECEIPT
  IMPORT
  INITIAL_MIGRATION
}
```

La baseline actual implementa:

```text
POST /equipment
→ origin = MANUAL
```

Todavía están pendientes los workflows:

```text
PURCHASE_RECEIPT
IMPORT
INITIAL_MIGRATION
```

**Estado:** PERSISTED / MANUAL FLOW IMPLEMENTED.

---

# 63. Core Equipment API v1.3.0

Endpoints implementados:

```text
GET /equipment
GET /equipment/:id
POST /equipment
```

No existen actualmente:

```text
PATCH /equipment/:id
DELETE /equipment/:id
```

La ausencia de `DELETE` protege el historial del activo.

La ausencia de PATCH genérico protege:

```text
asset identity
condition
lifecycle
origin
retirement data
product relationship
```

hasta disponer de operaciones específicas y auditables.

---

# 64. Multi-tenant security

Todas las operaciones Core implementadas están aisladas mediante:

```text
companyId
```

obtenido del usuario autenticado.

El cliente no envía:

```text
companyId
```

como parte de `CreateEquipmentDto`.

Las consultas utilizan el tenant autenticado.

Un Product perteneciente a otra Company se considera no accesible.

La misma regla se aplica al `InventoryBatch` utilizado durante creación.

Debe mantenerse:

> **Nunca confiar en un companyId enviado por el cliente para autorizar acceso a Equipment.**

**Estado:** IMPLEMENTED.

---

# 65. Validation and error contract

La aplicación utiliza globalmente:

```text
ValidationPipe

whitelist = true
forbidNonWhitelisted = true
transform = true
```

Por tanto campos no permitidos son rechazados.

Errores validados durante QA:

```text
400 Bad Request
→ invalid DTO
→ Product not ASSET
→ invalid business input

404 Not Found
→ Equipment not found
→ Product not found
→ Batch not found for Product

409 Conflict
→ duplicate assetCode
→ duplicate normalized serial
```

Errores de unicidad de Prisma también son protegidos para evitar convertir conflictos esperados en errores `500`.

**Estado:** IMPLEMENTED.

---

# 66. QA baseline

QA manual ejecutado durante la primera implementación:

```text
01 GET /equipment
→ PASS

02 POST /equipment valid ASSET
→ PASS

03 duplicate assetCode
→ 409 PASS

04 duplicate normalized serial
→ 409 PASS

05 Product QUANTITY
→ 400 PASS

06 GET /equipment/:id
→ PASS

07 DTO protected operational fields
→ 400 PASS

08 nonexistent Equipment
→ 404 PASS

09 invalid CreateEquipmentDto
→ 400 PASS

10 Equipment without serial
→ PASS

11 assetCode normalization during creation
→ PASS
```

Nota:

Durante el desarrollo se validó temporalmente edición genérica mediante PATCH.

Ese endpoint fue posteriormente retirado para mantener consistencia con las reglas de identidad y auditoría de Equipment.

El QA vigente de v1.3.0 corresponde al contrato final:

```text
GET
GET by ID
POST
```

---

# 67. Automated tests

Tests vigentes de Equipment:

```text
EquipmentService
8 / 8 PASS

EquipmentController
4 / 4 PASS

Equipment total
12 / 12 PASS
```

Regression suite completa del backend después de la limpieza final:

```text
Test Suites:
28 passed / 28 total

Tests:
124 passed / 124 total
```

Quality Gates finales:

```text
Prisma migrate status
→ Database schema up to date

Prisma validate
→ PASS

Prisma generate
→ PASS

npm test
→ 124 / 124 PASS

npm run build
→ PASS

ESLint
→ PASS
```

---

# 68. Known technical debt

No forma parte del alcance inmediato de Equipment, pero se observaron patrones existentes que deberán corregirse mediante trabajo técnico separado:

```text
req.user currently typed as any in controllers
```

Debe evolucionar hacia un tipo autenticado común.

También deberá revisarse de forma transversal:

```text
PrismaService module/provider consistency
```

sin introducir un patrón exclusivo para Equipment.

La actualización de Prisma:

```text
6.x
→
7.x
```

es un cambio mayor y deberá evaluarse como iniciativa separada.

No debe mezclarse con esta implementación.

---

# 69. EQ-INS-001 — Equipment Inspection Workflow

Equipment Inspection representa una operación explícita de dominio mediante la cual se evalúa el estado físico u operacional actual de un `EquipmentAsset`.

Debe mantenerse:

```text
Inspection
→ evaluates Equipment condition
```

y:

```text
Inspection
→ may update EquipmentCondition
```

pero nunca:

```text
Inspection
→ directly sets Availability
```

Availability continúa siendo una evaluación derivada.

Estado: IMPLEMENTED / VALIDATED.

---

# 70. Inspection ownership

La inspección base pertenece a Core Equipment.

Core es responsable de:

```text
EquipmentInspection
EquipmentAsset
conditionBefore
conditionAfter
inspector
inspection timestamp
notes
inspection history
```

Healthcare puede originar una Inspection como consecuencia de:

```text
Case Return
Case Logistics
Warehouse Return
```

pero no redefine la inspección Core.

Debe mantenerse:

```text
Core EquipmentInspection
→ physical condition event
```

mientras:

```text
Healthcare
→ operational context that caused the inspection
```

Por tanto, Core `EquipmentInspection` no debe incorporar directamente campos como:

```text
caseId
hospitalId
technicianId
caseReturnId
```

solo para satisfacer un workflow Healthcare.

Cuando sea necesario, Healthcare deberá relacionar su contexto con la Inspection Core mediante su propio contrato.

**Estado:** APPROVED.

---

# 71. When Inspection is allowed

En Fase 1 una Inspection puede ejecutarse sobre cualquier Equipment activo.

Regla:

```text
Lifecycle = ACTIVE
→ Inspection may be allowed
```

Esto incluye Equipment actualmente en:

```text
GOOD
INSPECTION_PENDING
DAMAGED
OUT_OF_SERVICE
```

Ejemplos válidos:

```text
INSPECTION_PENDING
↓
Inspection
↓
GOOD
```

```text
GOOD
↓
Ad-hoc Inspection
↓
DAMAGED
```

```text
DAMAGED
↓
Reinspection
↓
GOOD
```

```text
OUT_OF_SERVICE
↓
Reinspection
↓
GOOD
```

No debe limitarse Inspection exclusivamente a:

```text
condition = INSPECTION_PENDING
```

porque también debe permitir:

```text
periodic inspection
ad-hoc inspection
damage verification
post-repair reinspection
operational reinspection
```

Un Equipment:

```text
Lifecycle = RETIRED
```

no puede recibir una nueva Inspection operacional normal.

Resultado:

```text
RETIRED
→ Inspection BLOCKED
```

Las inspecciones históricas existentes permanecen disponibles.

**Estado:** APPROVED.

---

# 72. Inspection result

Una Inspection completada debe finalizar con una condición conocida.

Resultados permitidos en Fase 1:

```text
GOOD
DAMAGED
OUT_OF_SERVICE
```

No se permite como resultado final:

```text
INSPECTION_PENDING
```

porque:

```text
Inspection completed
+
INSPECTION_PENDING
```

representaría una contradicción operacional.

Por tanto:

```text
conditionAfter
∈
GOOD
DAMAGED
OUT_OF_SERVICE
```

**Estado:** APPROVED.

---

# 73. conditionBefore

`conditionBefore` representa la condición real almacenada inmediatamente antes de ejecutar la Inspection.

Debe obtenerse exclusivamente desde:

```text
EquipmentAsset.condition
```

por el backend.

El cliente no debe proporcionar:

```text
conditionBefore
```

mediante DTO.

Flujo:

```text
Load EquipmentAsset
↓
Read current condition
↓
conditionBefore
```

Esto evita que el cliente pueda reconstruir o falsificar el estado histórico anterior.

**Estado:** APPROVED.

---

# 74. conditionAfter

`conditionAfter` representa el resultado de la Inspection.

Será proporcionado como resultado operacional validado.

El backend deberá aceptar únicamente:

```text
GOOD
DAMAGED
OUT_OF_SERVICE
```

Una vez confirmada la Inspection:

```text
EquipmentInspection.conditionAfter
=
EquipmentAsset.condition
```

al finalizar la misma transacción.

**Estado:** APPROVED.

---

# 75. Inspector

El inspector será siempre el usuario autenticado que confirma la operación.

Debe derivarse de:

```text
JWT / authenticated request context
```

y no de un campo libre enviado por el cliente.

Por tanto:

```text
inspectedById
→ SERVER DERIVED
```

No:

```text
POST body
→ inspectedById
```

La relación actual utiliza:

```text
EquipmentInspection.inspectedById
→ User.id
```

El backend deberá validar que el usuario autenticado pertenece al mismo tenant.

**Estado:** APPROVED.

---

# 76. Inspection timestamp

En Fase 1:

```text
inspectedAt
→ SERVER GENERATED
```

utilizando el tiempo de confirmación de la operación.

El cliente no podrá proporcionar libremente una fecha histórica durante la operación normal.

Importaciones o migraciones históricas futuras deberán utilizar un workflow diferente y explícito.

**Estado:** APPROVED.

---

# 77. Inspection notes

Inspection podrá aceptar:

```text
notes?
```

como información opcional.

Las notas pueden utilizarse para registrar:

```text
physical observations
damage description
operational observations
inspection comments
relevant exceptions
```

No deben utilizarse como sustituto de futuros dominios estructurados como:

```text
Maintenance
Calibration
Incident Management
```

**Estado:** APPROVED.

---

# 78. Atomic Inspection transaction

Completar una Inspection constituye una sola operación de negocio.

Debe ejecutarse transaccionalmente:

```text
BEGIN TRANSACTION

Read EquipmentAsset
↓
Validate Lifecycle
↓
Capture conditionBefore
↓
Create EquipmentInspection
↓
Update EquipmentAsset.condition
↓
COMMIT
```

No debe ser posible:

```text
Inspection created
+
Equipment condition not updated
```

ni:

```text
Equipment condition updated
+
Inspection history missing
```

Si cualquier escritura falla:

```text
ROLLBACK
```

**Estado:** APPROVED.

---

# 79. Inspection history

`EquipmentInspection` constituye historia operacional.

Una Inspection confirmada no debe modificarse posteriormente mediante CRUD genérico.

No debe existir una operación ordinaria:

```text
PATCH EquipmentInspection
```

ni:

```text
DELETE EquipmentInspection
```

para alterar un evento histórico.

Si una evaluación posterior cambia el conocimiento sobre el activo:

```text
New Inspection
```

debe registrar el nuevo hecho.

Ejemplo:

```text
10:00
Inspection
GOOD
```

```text
15:00
Inspection
DAMAGED
```

Ambos eventos permanecen en historia.

`EquipmentAsset.condition` representa únicamente el snapshot actual.

**Estado:** APPROVED.

---

# 80. Inspection and Availability

Debe mantenerse estrictamente:

```text
Inspection
≠
Availability
```

Ejemplo:

```text
Inspection result:
GOOD
```

no implica automáticamente:

```text
available = true
```

Después de una Inspection:

```text
Equipment condition updated
↓
Availability Evaluator
↓
Current Availability determined
```

Otros blockers pueden continuar activos:

```text
external custody
case assignment
maintenance
calibration
other operational constraints
```

**Estado:** APPROVED.

---

# 81. Healthcare Return integration

La política Healthcare Fase 1 continúa siendo:

```text
Case Dispatch
↓
External Custody
↓
Case Return
↓
Warehouse Custody
↓
Condition = INSPECTION_PENDING
↓
Core Equipment Inspection
↓
GOOD / DAMAGED / OUT_OF_SERVICE
↓
Availability Evaluator
```

El workflow Healthcare podrá posteriormente relacionar:

```text
Case
Return
EquipmentAsset
EquipmentInspection
```

sin trasladar la identidad del Case al modelo Core.

**Estado:** APPROVED / HEALTHCARE INTEGRATION PENDING.

---

# 82. Prisma baseline

La persistencia actual de `EquipmentInspection` contiene:

```text
id
companyId
equipmentAssetId
conditionBefore
conditionAfter
inspectedAt
inspectedById
notes
createdAt
```

y relaciones con:

```text
Company
EquipmentAsset
User
```

La estructura es suficiente para la primera versión del workflow Core.

No se requieren nuevos campos para `EQ-INS-001`.

**Estado:** PERSISTENCE BASELINE AVAILABLE.

---

# 83. Tenant integrity

Debe cumplirse:

```text
EquipmentInspection.companyId
=
EquipmentAsset.companyId
=
Authenticated User.companyId
```

La aplicación deberá validar esta regla.

Adicionalmente, la relación:

```text
EquipmentInspection
→ EquipmentAsset
```

deberá reforzarse a nivel de base de datos mediante la clave compuesta existente:

```text
EquipmentAsset
@@unique([id, companyId])
```

Dirección Prisma:

```text
fields:
[equipmentAssetId, companyId]

references:
[id, companyId]
```

Esto impide relacionar accidentalmente una Inspection de una Company con Equipment perteneciente a otra.

La relación con `User` continuará inicialmente utilizando:

```text
inspectedById
→ User.id
```

junto con validación de tenant en el backend.

No se modificará el modelo global `User` únicamente para este workflow.

**Estado:** IMPLEMENTED / DATABASE ENFORCED.

Migration:

20260821221133_equipment_inspection_tenant_fk

---

# 84. Inspection API direction

Contrato inicial propuesto:

```text
POST /equipment/:equipmentId/inspections
GET  /equipment/:equipmentId/inspections
```

No se implementarán inicialmente:

```text
PATCH /equipment/:equipmentId/inspections/:inspectionId
DELETE /equipment/:equipmentId/inspections/:inspectionId
```

porque Inspection representa historia operacional.

Implementation status:

POST /equipment/:equipmentId/inspections
→ IMPLEMENTED

GET /equipment/:equipmentId/inspections
→ IMPLEMENTED

---

# 85. Create Inspection input

El DTO conceptual aceptará únicamente:

```text
conditionAfter
notes?
```

No aceptará:

```text
companyId
equipmentAssetId
conditionBefore
inspectedById
inspectedAt
createdAt
```

Estos valores serán obtenidos o generados por backend.

Conceptualmente:

```text
POST /equipment/:equipmentId/inspections

{
  "conditionAfter": "GOOD",
  "notes": "Inspección física y funcional correcta"
}
```

**Estado:** APPROVED.

---

# 86. Create Inspection validation flow

Flujo esperado:

```text
Authenticated User
↓
Read companyId + userId
↓
Validate DTO
↓
Find EquipmentAsset by:
  id
  companyId
↓
Equipment exists?
├── NO → 404
└── YES
↓
Lifecycle = ACTIVE?
├── NO → 400
└── YES
↓
conditionAfter valid?
├── NO → 400
└── YES
↓
conditionAfter != INSPECTION_PENDING?
├── NO → 400
└── YES
↓
conditionBefore =
EquipmentAsset.condition
↓
BEGIN TRANSACTION
↓
Create EquipmentInspection
↓
Update EquipmentAsset.condition
↓
COMMIT
↓
Return Inspection
```

**Estado:** APPROVED.

---

# 87. Inspection query

El historial deberá poder consultarse por Equipment.

Conceptualmente:

```text
GET /equipment/:equipmentId/inspections
```

deberá:

```text
validate authenticated Company
↓
validate Equipment exists in Company
↓
return inspections
↓
order by inspectedAt DESC
```

Una Company nunca deberá poder consultar inspecciones de Equipment perteneciente a otro tenant.

**Estado:** APPROVED.

---

# 88. Error contract

Errores esperados:

```text
400 Bad Request
→ invalid DTO
→ invalid conditionAfter
→ INSPECTION_PENDING used as final result
→ RETIRED Equipment inspection attempt
```

```text
404 Not Found
→ Equipment not found inside authenticated Company
```

Errores inesperados de persistencia no deberán exponer detalles internos de Prisma o PostgreSQL.

**Estado:** APPROVED.

---

# 89. Authorization

La baseline actual de Equipment dispone de autenticación JWT, pero el Permission-Based RBAC completo todavía no está implementado.

Fase inicial:

```text
JwtAuthGuard
+
tenant validation
```

Antes de producción deberá existir autorización explícita para Inspection.

Permiso conceptual futuro:

```text
equipment.inspect
```

Los nombres definitivos deberán alinearse con el diseño global de Permissions.

**Estado:** AUTHENTICATION AVAILABLE / AUTHORIZATION EVOLUTION PENDING.

---

# 90. EQ-INS-001 acceptance criteria

La primera versión ha sido implementada y validada.

```text
POST Inspection works
✅

GET Inspection history works
✅

conditionBefore is server-derived
✅

conditionAfter is validated
✅

INSPECTION_PENDING cannot be final result
✅

RETIRED Equipment is blocked by domain logic
✅

Inspection creation
+
Equipment condition update
are atomic
✅

Inspection history is immutable through API
✅

tenant isolation is enforced
✅

composite Equipment FK is enforced
✅

service tests pass
✅

controller tests pass
✅

full regression passes
✅

build passes
✅

lint passes
✅

manual QA passes
✅
```

Automated validation:

```text
EquipmentService
18 / 18 PASS

EquipmentController
6 / 6 PASS

Equipment total
24 / 24 PASS
```

Backend regression:

```text
Test Suites
28 / 28 PASS

Tests
136 / 136 PASS
```

Quality Gates:

```text
Prisma validate
✅

Prisma migration
✅

Prisma migrate status
✅

npm test
✅

npm run build
✅

ESLint
✅
```

Manual QA validated:

```text
INSPECTION_PENDING → GOOD
✅

GOOD → DAMAGED
✅

DAMAGED → OUT_OF_SERVICE
✅

INSPECTION_PENDING as final result
→ 400 ✅

nonexistent Equipment
→ 404 ✅

inspection history
✅

history ordered newest → oldest
✅

inspector derived from JWT
✅

Equipment condition snapshot updated
✅

failed validation creates no history
✅
```

**Estado:** IMPLEMENTED / VALIDATED.

---

# 91. Pending Equipment workflows

Estado actualizado:

```text
Equipment Registration
✅

Equipment Read
✅

Equipment Inspection
✅

Equipment Retirement
✅

Automatic assetCode generation
✅

Purchase Receipt Equipment creation
⏳

Explicit identity correction operations
⏳

Equipment Audit
⏳

Availability Evaluator
⏳
```

Healthcare consumirá posteriormente estas capacidades mediante:

```text
Case Equipment Assignment
Case Logistics
Dispatch
Custody
Return
Inspection integration
```

---

# 92. Próxima prioridad recomendada

El próximo workflow Core es:

```text
EQ-PR-001
Purchase Receipt → EquipmentAsset
```

Orden:

```text
1. Business Analysis
2. Purchase Receipt / Equipment documentation
3. Architecture Review
4. Prisma review
5. Backend domain operation
6. Authorization review
7. Automated tests
8. Manual QA
9. Full regression
10. Build + lint
11. Documentation synchronization
```

Diseño de dominio aprobado para la primera implementación:

```text
Status
→ DOMAIN DESIGN APPROVED / READY FOR IMPLEMENTATION

Implementation
→ NOT IMPLEMENTED
→ NOT VALIDATED
```

Regla de creación:

```text
Product.inventoryTracking = ASSET
PurchaseReceiptItem.quantityReceived = N
↓
create exactly N EquipmentAsset rows
```

No debe usarse `PurchaseItem.quantity` para determinar cuántos `EquipmentAsset` crear.

Para EQ-PR-001:

```text
QUANTITY
→ no EquipmentAsset creation

SERIALIZED
→ no EquipmentAsset creation

ASSET
→ EquipmentAsset creation from PurchaseReceiptItem.quantityReceived
```

Los `EquipmentAsset` creados desde recepción pueden nacer sin serial:

```text
serialNumber = null
serialNumberKey = null
```

La recepción no debe bloquearse esperando números de serie. La asignación o corrección futura de serial deberá ocurrir mediante una operación explícita de identidad de Equipment fuera de EQ-PR-001.

Estado inicial aprobado:

```text
lifecycle = ACTIVE
condition = INSPECTION_PENDING
origin = PURCHASE_RECEIPT
```

Razón:

```text
physical receipt
≠
inspection successfully passed
```

Todo `EquipmentAsset` creado desde una recepción debe conservar permanentemente:

```text
purchaseReceiptItemId
```

La trazabilidad queda:

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

Si el `PurchaseReceiptItem` quedó asociado a un `InventoryBatch`:

```text
EquipmentAsset.batchId = InventoryBatch.id
```

Si no existe batch:

```text
batchId = null
```

EQ-PR-001 no redefine ni amplía la política general de:

```text
ProductLotTracking.REQUIRED
ProductLotTracking.OPTIONAL
ProductLotTracking.NONE
```

La aplicación completa de `lotTracking` queda como preocupación separada.

Política de stock aprobada:

```text
PurchaseReceipt
→ Product.stock += quantityReceived

EquipmentAsset creation
→ does not increment Product.stock again
```

Para Products `ASSET`:

```text
EquipmentAsset
→ physical unit identity truth

Product.stock
→ aggregate inventory projection maintained by Inventory / PurchaseReceipt
```

La reconciliación final `Product.stock ↔ EquipmentAsset` queda fuera de EQ-PR-001.

Unidad transaccional requerida:

```text
PurchaseReceipt
+
PurchaseReceiptItems
+
InventoryBatch
+
InventoryMovement
+
Product.stock mutation
+
CompanySequence allocation
+
EquipmentAsset creation
```

Todo debe ocurrir dentro de la misma transacción Prisma. Si falla la creación de cualquier `EquipmentAsset`, debe revertirse la recepción completa.

Debe evitarse:

```text
stock committed
+
missing required EquipmentAsset identities
```

y:

```text
EquipmentAsset identities
+
missing corresponding receipt
```

Los `assetCode` de Equipment creado desde recepción reutilizan el mecanismo ya implementado:

```text
CompanySequence
companyId + key = EQUIPMENT_ASSET_CODE

EQ-000001
EQ-000002
...
```

`PurchaseReceiptsService` no debe duplicar el algoritmo de secuencia. La lógica reutilizable del dominio Equipment deberá aceptar `Prisma.TransactionClient` para participar en la transacción propiedad de Receipt.

Propiedad arquitectónica:

```text
Equipment domain / application logic
→ Equipment identity generation
→ EquipmentAsset provisioning rules

PurchaseReceiptsService
→ Purchase Receipt orchestration
→ transaction boundary
```

Deben evitarse dependencias circulares de módulos NestJS.

Idempotencia:

```text
Formal PurchaseReceipt request idempotency
→ OUT OF SCOPE for EQ-PR-001
```

Riesgo existente:

```text
committed PurchaseReceipt
↓
client retries after timeout
↓
another legitimate receipt may be created if pending quantity remains
```

Este riesgo queda registrado como preocupación separada de confiabilidad de Purchase Receipt.

Correcciones y reversas:

```text
Purchase Receipt correction / reversal
→ OUT OF SCOPE
```

No debe usarse `DELETE` de `EquipmentAsset` para representar correcciones. Un diseño futuro deberá definir explícitamente efectos sobre Inventory, EquipmentAsset, Lifecycle e historia financiera/operativa.

Persistencia:

```text
new Prisma model
→ not required

new field
→ not required

new enum
→ not required

new migration
→ not required
```

La implementación mínima reutiliza:

```text
EquipmentAsset.purchaseReceiptItemId
EquipmentAsset.batchId
EquipmentAsset.origin
EquipmentOrigin.PURCHASE_RECEIPT
CompanySequence
UNIQUE companyId + assetCode
```

Fases previstas:

```text
Phase B.1
Extract / reuse transaction-aware Equipment assetCode allocation

Phase B.2
Add Equipment receipt provisioning capability

Phase B.3
Integrate provisioning into PurchaseReceiptsService transaction

Phase B.4
Tests and technical validation

Phase C
Manual QA and final documentation synchronization
```

Debe mantenerse:

```text
Retirement
≠
DELETE

ACTIVE
↓
Retirement
↓
RETIRED

RETIRED
→ historical record preserved
```

---

# 93. EQ-RET-001 — Equipment Retirement

Equipment Retirement representa la salida permanente de un `EquipmentAsset` de la flota operacional normal.

Debe mantenerse:

```text
Retirement
≠
DELETE
```

El flujo permitido en Fase 1 es:

```text
ACTIVE
↓
Retirement
↓
RETIRED
```

El registro físico y su historia permanecen en el sistema.

Retirement no elimina:

```text
EquipmentAsset
Inspection history
Purchase origin
serialNumber
assetCode
timestamps
future Case history
future Custody history
```

**Estado:** DOMAIN DESIGN APPROVED / VALIDATED.

---

# 94. Retirement finality

En Fase 1:

```text
RETIRED
→ terminal normal lifecycle state
```

No existirá una operación normal:

```text
Reactivate Equipment
```

Una corrección administrativa futura deberá ser:

```text
exceptional
authorized
audited
```

y diseñada como una operación independiente.

No deberá resolverse mediante:

```text
PATCH lifecycle = ACTIVE
```

**Estado:** APPROVED.

---

# 95. Retirement reasons

La razón de retiro utilizará el enum Core existente:

```text
EquipmentRetirementReason

SOLD
LOST
DESTROYED
END_OF_LIFE
REPLACED
OTHER
```

Semántica:

```text
SOLD
→ ownership or operational possession permanently transferred by sale
```

```text
LOST
→ asset formally resolved as lost after appropriate operational review
```

```text
DESTROYED
→ asset physically destroyed or permanently unusable
```

```text
END_OF_LIFE
→ asset intentionally retired because its useful operational life ended
```

```text
REPLACED
→ asset removed from normal operation because it was replaced
```

```text
OTHER
→ exceptional retirement reason not represented by another enum value
```

Debe mantenerse:

```text
Retirement reason
≠
Lifecycle
```

Lifecycle siempre termina en:

```text
RETIRED
```

**Estado:** APPROVED / PERSISTED.

---

# 96. Missing does not imply LOST

Debe mantenerse estrictamente:

```text
Missing
≠
LOST
```

```text
Overdue Return
≠
LOST
```

```text
Open Custody Exception
≠
LOST
```

La razón:

```text
LOST
```

solo podrá utilizarse cuando exista una decisión explícita de resolver el activo como perdido.

Healthcare o Custody podrán detectar:

```text
missing
unreturned
overdue
unresolved
```

pero no deberán cambiar automáticamente Core Equipment a:

```text
RETIRED / LOST
```

**Estado:** APPROVED.

---

# 97. Retirement input

El cliente proporcionará únicamente:

```text
retiredReason
retirementNotes?
```

No proporcionará:

```text
companyId
equipmentId
lifecycle
retiredAt
retiredById
```

Estos datos serán obtenidos o generados por backend.

Conceptualmente:

```json
{
  "retiredReason": "END_OF_LIFE",
  "retirementNotes": "Equipo sustituido después de finalizar su vida útil."
}
```

**Estado:** APPROVED.

---

# 98. retirementNotes policy

`retirementNotes` será opcional para:

```text
SOLD
LOST
DESTROYED
END_OF_LIFE
REPLACED
```

pero será obligatorio cuando:

```text
retiredReason = OTHER
```

Regla:

```text
OTHER
+
empty retirementNotes
→ 400 Bad Request
```

Las notas deberán almacenarse normalizadas:

```text
trim
```

Una cadena vacía deberá convertirse conceptualmente en:

```text
null
```

cuando la razón permita notas opcionales.

Para `OTHER`, después de `trim` deberá existir contenido real.

**Estado:** APPROVED.

---

# 99. Server-derived retirement data

Los siguientes campos son controlados por servidor:

```text
retiredAt
retiredById
lifecycle
```

Flujo:

```text
authenticated User
↓
retiredById

server timestamp
↓
retiredAt

successful Retirement
↓
lifecycle = RETIRED
```

El cliente no puede elegir quién retiró el activo ni alterar la fecha normal del evento.

**Estado:** APPROVED.

---

# 100. Equipment eligibility

La operación normal de Retirement solo puede ejecutarse cuando:

```text
Equipment exists
+
same Company
+
Lifecycle = ACTIVE
```

Si el activo no existe dentro del tenant:

```text
404 Not Found
```

Si ya está:

```text
Lifecycle = RETIRED
```

la nueva solicitud deberá rechazarse como conflicto de estado:

```text
409 Conflict
```

No deberá:

```text
overwrite retiredAt
overwrite retiredById
overwrite retiredReason
overwrite retirementNotes
```

**Estado:** APPROVED.

---

# 101. Retirement is not idempotent overwrite

Una segunda solicitud sobre un Equipment ya retirado no debe considerarse una nueva operación válida.

Ejemplo:

```text
First request
ACTIVE
→ RETIRED / END_OF_LIFE
✅
```

Después:

```text
Second request
RETIRED
→ RETIRED / SOLD
❌
```

Resultado:

```text
409 Conflict
```

La primera decisión histórica permanece intacta.

Esto protege:

```text
retiredAt
retiredById
retiredReason
retirementNotes
```

de sobrescritura accidental.

**Estado:** APPROVED.

---

# 102. Active operational dependencies

Antes de Retirement deberán resolverse dependencias operacionales activas cuando dichas capacidades existan.

Conceptualmente:

```text
active Case Assignment
active external Custody
active Dispatch
open Return
other blocking operational dependency
```

deberán producir:

```text
Retirement BLOCKED
```

hasta que la realidad operacional sea resuelta.

Debe mantenerse:

```text
Retire Equipment
≠
silently close Assignment
```

```text
Retire Equipment
≠
silently close Custody
```

```text
Retire Equipment
≠
fake Return
```

Excepción conceptual:

```text
LOST
```

podrá necesitar en el futuro un workflow coordinado para cerrar una custodia sin retorno físico.

Ese comportamiento pertenece a la futura integración Core + Healthcare/Custody y no deberá improvisarse dentro del primer endpoint Core.

En la implementación actual, estas dependencias todavía no existen como modelos Core integrados, por lo que no se crearán estructuras ficticias únicamente para EQ-RET-001.

**Estado:** RULE APPROVED / CROSS-DOMAIN ENFORCEMENT FUTURE.

---

# 103. Condition after Retirement

Retirement cambia:

```text
Lifecycle
```

No necesita modificar automáticamente:

```text
Condition
```

Ejemplo válido:

```text
Before:
Lifecycle = ACTIVE
Condition = OUT_OF_SERVICE

After:
Lifecycle = RETIRED
Condition = OUT_OF_SERVICE
```

También puede existir históricamente:

```text
Before:
Lifecycle = ACTIVE
Condition = GOOD

After:
Lifecycle = RETIRED
Condition = GOOD
Reason = SOLD
```

La razón es que:

```text
Condition
→ last known physical/operational condition
```

mientras:

```text
Lifecycle
→ whether asset remains part of active fleet
```

Retirement no debe falsificar Condition solo para expresar indisponibilidad.

**Estado:** APPROVED.

---

# 104. Retirement and Availability

Debe mantenerse:

```text
Lifecycle = RETIRED
→ Availability = NO
```

pero Retirement no escribirá:

```text
available = false
```

La futura lógica será:

```text
Lifecycle RETIRED
↓
Availability Evaluator
↓
not available
```

**Estado:** APPROVED / AVAILABILITY EVALUATOR PENDING.

---

# 105. Retirement and Inspection

Después de:

```text
Lifecycle = RETIRED
```

no deberán permitirse nuevas inspecciones operacionales normales.

Esto ya está protegido por el workflow de Inspection:

```text
RETIRED
→ Inspection blocked
```

Las Inspection históricas anteriores permanecen disponibles.

Retirement no deberá eliminarlas ni modificarlas.

**Estado:** APPROVED / INSPECTION ENFORCEMENT IMPLEMENTED.

---

# 106. assetCode after Retirement

Retirement no modifica:

```text
assetCode
```

El código continúa reservado permanentemente.

Debe mantenerse:

```text
RETIRED EQ-0041
↓
assetCode EQ-0041 remains owned by historical asset
```

No podrá crearse posteriormente otro Equipment con:

```text
EQ-0041
```

dentro de la misma Company.

La constraint existente:

```text
companyId + assetCode
→ UNIQUE
```

continúa protegiendo esta regla.

**Estado:** APPROVED / DATABASE ENFORCED.

---

# 107. Serial after Retirement

Retirement no modifica ni elimina:

```text
serialNumber
serialNumberKey
```

El serial registrado forma parte de la identidad histórica del activo.

No debe limpiarse para permitir reutilización artificial.

**Estado:** APPROVED.

---

# 108. Retirement persistence

La persistencia existente de `EquipmentAsset` ya dispone de:

```text
lifecycle
retiredAt
retiredById
retiredReason
retirementNotes
```

y de la relación:

```text
retiredBy
→ User
```

Por tanto, no se requieren nuevos campos conceptuales para la primera versión de EQ-RET-001.

Antes de implementar se revisará si las constraints y relaciones actuales son suficientes para tenant integrity.

Prisma review result:

No new columns required
✅

No new enums required
✅

No new relations required
✅

No migration required
✅

**Estado:** IMPLEMENTED / EXISTING PERSISTENCE REUSED.

---

# 109. Tenant integrity

Debe cumplirse:

```text
EquipmentAsset.companyId
=
Authenticated User.companyId
```

El Equipment deberá buscarse siempre mediante:

```text
id
+
companyId
```

El cliente nunca enviará `companyId` como mecanismo de autorización.

`retiredById` será tomado del usuario autenticado.

El backend deberá validar que dicho usuario pertenece al mismo tenant.

Debe evaluarse si la relación:

```text
retiredBy
→ User
```

continúa bajo el patrón actual de actor con FK simple o si una evolución transversal de User deberá reforzarla posteriormente.

EQ-RET-001 no deberá introducir cambios aislados al modelo global `User` salvo necesidad demostrada.

**Estado:** IMPLEMENTED AT SERVICE LAYER / GLOBAL USER FK EVOLUTION PENDING.

---

# 110. Concurrency protection

Retirement deberá protegerse contra dos solicitudes concurrentes.

Conceptualmente:

```text
Request A
reads ACTIVE

Request B
reads ACTIVE
```

solo una deberá poder completar:

```text
ACTIVE → RETIRED
```

La segunda deberá detectar que el estado esperado cambió y producir:

```text
409 Conflict
```

sin sobrescribir los datos del primer Retirement.

La implementación deberá utilizar una condición equivalente a:

```text
id
companyId
lifecycle = ACTIVE
```

en la escritura final.

**Estado:** APPROVED.

---

# 111. Atomic Retirement operation

Retirement constituye una única operación de negocio.

Conceptualmente:

```text
BEGIN TRANSACTION
↓
validate authenticated User
↓
load EquipmentAsset
↓
validate tenant
↓
validate Lifecycle ACTIVE
↓
validate retirement reason
↓
validate retirement notes policy
↓
validate current operational blockers
↓
update EquipmentAsset:
  lifecycle = RETIRED
  retiredAt = now
  retiredById = authenticated user
  retiredReason = input reason
  retirementNotes = normalized notes
↓
COMMIT
```

Si alguna validación o escritura falla:

```text
ROLLBACK
```

No debe existir un estado parcial como:

```text
lifecycle = RETIRED
+
retiredReason = null
```

producido por la operación normal.

**Estado:** APPROVED.

---

# 112. Retirement API direction

Contrato inicial:

```text
POST /equipment/:equipmentId/retirement
```

No se utilizará:

```text
DELETE /equipment/:equipmentId
```

ni:

```text
PATCH /equipment/:equipmentId
{
  "lifecycle": "RETIRED"
}
```

porque Retirement posee reglas de negocio propias.

Tampoco se implementará inicialmente:

```text
DELETE retirement
PATCH retirement
Reactivate Equipment
```
Implementation status:

POST /equipment/:equipmentId/retirement
→ IMPLEMENTED

**Estado:** APPROVED.

---

# 113. Retirement response

Después de una operación exitosa, el backend deberá devolver el Equipment actualizado con al menos:

```text
id
companyId
productId
assetCode
serialNumber
lifecycle
condition
retiredAt
retiredById
retiredReason
retirementNotes
```

Podrá incluir relaciones seguras necesarias para la experiencia de usuario.

Nunca debe exponer datos sensibles del usuario que ejecutó la operación.

**Estado:** APPROVED.

---

# 114. Error contract

Errores esperados:

```text
400 Bad Request
→ invalid retiredReason
→ OTHER without retirementNotes
→ invalid retirementNotes
```

```text
404 Not Found
→ Equipment not found inside authenticated Company
```

```text
403 Forbidden
→ authenticated actor fails tenant/authorization validation
```

```text
409 Conflict
→ Equipment already RETIRED
→ concurrent lifecycle change
→ unresolved operational blocker
```

Para blockers futuros puede evaluarse un reason code específico sin cambiar la semántica HTTP.

Detalles internos de Prisma/PostgreSQL no deberán exponerse.

**Estado:** APPROVED.

---

# 115. Authorization

Actualmente Core Equipment dispone de:

```text
JwtAuthGuard
tenant isolation
```

El Permission-Based RBAC completo todavía está pendiente.

Permiso conceptual:

```text
equipment.retire
```

Retirement es una operación sensible y antes de producción deberá requerir autorización explícita.

La implementación inicial no debe presentar JWT authentication como equivalente a autorización completa.

**Estado:** AUTHENTICATION AVAILABLE / AUTHORIZATION EVOLUTION PENDING.

---

# 116. Audit

La primera versión conservará dentro del Equipment:

```text
retiredAt
retiredById
retiredReason
retirementNotes
```

Esto proporciona trazabilidad básica del Retirement.

Sin embargo:

```text
Equipment Retirement
→ should eventually emit AuditEvent
```

cuando `AUD-001` esté disponible.

Debe mantenerse:

```text
retirement fields
≠
complete audit platform
```

**Estado:** BASELINE TRACEABILITY AVAILABLE / AUDIT INTEGRATION PENDING.

---

# 117. Retirement immutability

Una vez confirmado Retirement, los campos:

```text
retiredAt
retiredById
retiredReason
retirementNotes
```

no deberán editarse mediante operaciones normales.

Una corrección futura requerirá:

```text
explicit correction operation
authorization
reason
audit
```

No debe existir edición genérica del Retirement.

**Estado:** APPROVED.

---

# 118. Proposed DTO

El DTO conceptual será equivalente a:

```text
RetireEquipmentDto

retiredReason
retirementNotes?
```

Validaciones:

```text
retiredReason
→ EquipmentRetirementReason

retirementNotes
→ optional string
→ trim

OTHER
→ non-empty retirementNotes required
```

No debe incluir:

```text
companyId
equipmentId
retiredAt
retiredById
lifecycle
```

**Estado:** APPROVED.

---

# 119. Proposed backend flow

```text
POST /equipment/:equipmentId/retirement
↓
JwtAuthGuard
↓
companyId + userId from authenticated context
↓
validate DTO
↓
validate User belongs to Company
↓
find Equipment by id + companyId
↓
exists?
├── NO → 404
└── YES
↓
Lifecycle ACTIVE?
├── NO → 409
└── YES
↓
validate reason / notes
↓
validate current blockers
↓
atomic ACTIVE → RETIRED update
↓
store retirement metadata
↓
return updated Equipment
```

**Estado:** APPROVED.

---

# 120. EQ-RET-001 acceptance criteria

La primera implementación ha sido completada y validada.

```text
POST Retirement works
✅

only ACTIVE Equipment can retire
✅

already RETIRED returns 409
✅

retiredReason is required and validated
✅

OTHER requires retirementNotes
✅

retirementNotes are normalized
✅

retiredAt is server-generated
✅

retiredById comes from authenticated User
✅

Condition is preserved
✅

assetCode is preserved
✅

serial is preserved
✅

Equipment history remains available
✅

new Inspection is blocked after Retirement
✅

tenant isolation is enforced
✅

concurrent Retirement cannot overwrite first result
✅

no DELETE endpoint exists
✅

no generic lifecycle PATCH exists
✅

service tests pass
✅

controller tests pass
✅

manual QA passes
✅

full backend regression passes
✅

build passes
✅

lint passes
✅

La primera implementación se considerará completa cuando:

```text
POST Retirement works

only ACTIVE Equipment can retire

already RETIRED returns conflict

retiredReason is required and validated

OTHER requires retirementNotes

retirementNotes are normalized

retiredAt is server-generated

retiredById comes from authenticated User

Condition is preserved

assetCode is preserved

serial is preserved

Equipment history remains available

new Inspection is blocked after Retirement

tenant isolation is enforced

concurrent Retirement cannot overwrite first result

no DELETE endpoint exists

no generic lifecycle PATCH exists

service tests pass

controller tests pass

manual QA passes

full backend regression passes

build passes

lint passes

documentation is synchronized
```

**Estado:** APPROVED / IMPLEMENTATION PENDING.

---

# 121. Equipment workflow status

```text
Equipment Registration
✅

Equipment Read
✅

Equipment Inspection
✅

Equipment Retirement Design
✅

Equipment Retirement Implementation
✅

Automatic assetCode generation
✅

Purchase Receipt Equipment creation
⏳

Explicit identity correction operations
⏳

Equipment Audit
⏳

Availability Evaluator
⏳
```

---

# 122. Próximo paso técnico

Core Equipment actualmente dispone de:

```text
Registration
✅

Read
✅

Inspection
✅

Retirement
✅

Automatic assetCode Generation
✅
```

El siguiente paso técnico es:

```text
EQ-PR-001
Purchase Receipt → EquipmentAsset
```

# Final Principle

Equipment representa realidad física.

Debe mantenerse siempre:

```text
Product
≠
EquipmentAsset

Lifecycle
≠
Condition

Condition
≠
Availability

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

Inspection GOOD
≠
Available

Missing
≠
Lost

Retirement
≠
DELETE
```

La identidad, historia, custodia y condición de una unidad física nunca deben sacrificarse por simplificar un CRUD.


La primera versión ha sido implementada y validada.

```text
POST Inspection works
✅

GET Inspection history works
✅

conditionBefore is server-derived
✅

conditionAfter is validated
✅

INSPECTION_PENDING cannot be final result
✅

RETIRED Equipment is blocked by domain logic
✅

Inspection creation
+
Equipment condition update
are atomic
✅

Inspection history is immutable through API
✅

tenant isolation is enforced
✅

composite Equipment FK is enforced
✅

service tests pass
✅

controller tests pass
✅

full regression passes
✅

build passes
✅

lint passes
✅

manual QA passes
✅

---

# 91. Pending Equipment workflows

Estado actualizado:

```text
Equipment Registration
✅

Equipment Read
✅

Equipment Inspection
✅

Automatic assetCode generation
✅

Purchase Receipt Equipment creation
⏳

Equipment Retirement
✅

Explicit identity correction operations
⏳

Equipment Audit
⏳

Availability Evaluator
⏳
```

---

# 92. Próxima prioridad recomendada

El próximo paso técnico es:

```text
EQ-PR-001
Purchase Receipt → EquipmentAsset
```

Orden:

1. Business Analysis
2. Domain design approval
3. Purchase Receipt / Equipment documentation
4. Prisma review
5. Backend domain operation
6. Authorization review
7. Automated tests
8. Manual QA
9. Full regression
10. Build + lint
11. Documentation synchronization

Estado de diseño:

```text
DOMAIN DESIGN APPROVED / READY FOR IMPLEMENTATION
```

Estado de implementación:

```text
NOT IMPLEMENTED
```

Reglas aprobadas:

```text
Product.inventoryTracking = ASSET
PurchaseReceiptItem.quantityReceived = N
→ create exactly N EquipmentAsset rows

serialNumber = null
serialNumberKey = null
→ allowed at receipt

lifecycle = ACTIVE
condition = INSPECTION_PENDING
origin = PURCHASE_RECEIPT

Product.stock
→ still mutated by PurchaseReceipt only
→ EquipmentAsset creation does not increment stock again

CompanySequence
key = EQUIPMENT_ASSET_CODE
→ reused inside the receipt transaction
```

Fuera de alcance:

```text
PurchaseReceipt request idempotency
Receipt correction / reversal
Product.stock ↔ EquipmentAsset reconciliation
broader lotTracking enforcement
SERIALIZED receipt behavior
```

Debe mantenerse:

Retirement
≠
DELETE

RETIRED
→ historical record preserved
