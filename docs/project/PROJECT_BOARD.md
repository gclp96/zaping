# Project Board — Zaping

**Producto:** Zaping Platform
**Estado:** Desarrollo activo
**Fase actual:** ERP Core UI/UX Completion after Healthcare Case Foundation validation
**Última actualización:** 2026-08-24
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento representa exclusivamente el estado actual de trabajo de Zaping.

Debe responder:

```text
¿Qué está terminado recientemente?
¿Qué está activo?
¿Qué sigue?
¿Qué tiene prioridad?
¿Qué bloquea el avance?
```

Separación documental:

```text
PROJECT_BOARD
→ estado y trabajo actual

ROADMAP
→ dirección futura

CHANGELOG
→ historia de trabajo completado
```

El Board no debe convertirse en un backlog histórico.

---

# 2. Estado general

```text
Zaping Platform
│
├── ERP Core
│   ├── Foundation estable
│   ├── Compras + Recepciones funcionales
│   ├── Inventory avanzado en evolución
│   ├── Core Equipment baseline implementado
│   ├── Returns parcialmente implementado
│   ├── Sales legacy funcional
│   └── Seguridad pre-release pendiente
│
├── Healthcare
│   ├── Arquitectura de dominio en evolución
│   ├── Case Foundation implemented / validated
│   ├── Equipment boundary documentado
│   └── Workflows operacionales pendientes
│
├── Radar
│   └── Producto futuro aprobado
│
└── AI
    └── Visión futura
```

---

# 3. Trabajo completado recientemente

Los siguientes bloques ya no deben tratarse como trabajo activo.

## DOC-REF — Documentation Architecture Refactor

**Estado:** ✅ Completed

Completado:

```text
Product documentation
Architecture documentation
Engineering documentation
UX documentation
ERP module documentation
docs/project structure
templates cleanup
global documentation audit
legacy documentation cleanup
```

Este trabajo debe conservarse históricamente en `CHANGELOG.md`.

---

## EQ-CORE-001 — Core Equipment Domain

**Estado:** ✅ Completed

**Prioridad:** P1 estratégica

Completado:

```text
ERP Equipment domain
Product ↔ EquipmentAsset relationship
tracking strategy
lot tracking strategy
lifecycle
condition
origin
retirement reasons
asset identity rules
serial rules
Inventory boundary
Healthcare/Core ownership boundary
```

Documento:

```text
docs/modules/erp/EQUIPMENT.md
v1.3.0
```

---

## EQ-DATA-001 — Equipment Persistence Baseline

**Estado:** ✅ Completed

Implementado en Prisma:

```text
ProductInventoryTracking
├── QUANTITY
├── SERIALIZED
└── ASSET

ProductLotTracking
├── NONE
├── OPTIONAL
└── REQUIRED

EquipmentLifecycle
├── ACTIVE
└── RETIRED

EquipmentCondition
├── GOOD
├── INSPECTION_PENDING
├── DAMAGED
└── OUT_OF_SERVICE

EquipmentOrigin
├── MANUAL
├── PURCHASE_RECEIPT
├── IMPORT
└── INITIAL_MIGRATION

EquipmentRetirementReason
├── SOLD
├── LOST
├── DESTROYED
├── END_OF_LIFE
├── REPLACED
└── OTHER
```

Persistencia:

```text
EquipmentAsset
EquipmentInspection baseline
```

Constraints principales:

```text
companyId + assetCode
→ UNIQUE

companyId + productId + serialNumberKey
→ UNIQUE
```

Validaciones:

```text
Prisma migrate status
→ database up to date

Prisma validate
→ PASS

Prisma generate
→ PASS
```

---

## EQ-BE-001 — Equipment Core Backend Baseline

**Estado:** ✅ Completed

API implementada:

```text
GET  /equipment
GET  /equipment/:id
POST /equipment
```

Deliberadamente no implementado:

```text
PATCH /equipment/:id
DELETE /equipment/:id
```

Reglas implementadas:

```text
JWT protection
tenant isolation
Product must belong to Company
Product must use ASSET tracking
Product must be active
optional Batch validation
assetCode normalization
assetCode duplicate protection
optional serialNumber
serialNumberKey normalization
serial duplicate protection
DTO validation
400 / 404 / 409 handling
```

---

## EQ-QA-001 — Equipment Backend Quality Baseline

**Estado:** ✅ Completed

Resultados:

```text
EquipmentService
8 / 8 PASS

EquipmentController
4 / 4 PASS

Equipment total
12 / 12 PASS
```

Regression suite:

```text
Test Suites
28 / 28 PASS

Tests
124 / 124 PASS
```

Quality Gates:

```text
npm test
✅

npm run build
✅

ESLint
✅
```

QA manual del contrato final:

```text
GET equipment
✅

GET equipment by ID
✅

POST valid ASSET
✅

duplicate assetCode
→ 409

duplicate normalized serial
→ 409

QUANTITY Product
→ 400

nonexistent Equipment
→ 404

invalid DTO
→ 400

optional serial
✅

assetCode normalization
✅
```

---

## HC-EQ-DOC-001 — Healthcare Equipment Boundary

**Estado:** ✅ Completed

Documento:

```text
docs/modules/healthcare/EQUIPMENT.md
v1.0.0
```

Se estableció:

```text
ERP/Core
→ physical Equipment identity

Healthcare
→ operational use inside Cases
```

Healthcare es responsable de:

```text
Equipment Requirement
Case Equipment Assignment
Preparation
Dispatch
Custody
Return
Inspection context
Availability for Case
```

No redefine `EquipmentAsset`.

---

# 4. ERP Core — estado actual

| Dominio           | Estado                                          |
| ----------------- | ----------------------------------------------- |
| Companies         | ✅ Implementado                                  |
| Identity & Access | 🟡 Implementado / security evolution pending    |
| Customers         | ✅ Implementado                                  |
| Suppliers         | ✅ Implementado                                  |
| Products          | ✅ Implementado / tracking baseline integrated   |
| Purchases         | ✅ Implementado / avanzado                       |
| Purchase Receipts | ✅ Implementado                                  |
| Inventory         | ✅ Implementado / avanzado / evolución pendiente |
| Equipment Core    |  ✅ Registration + Read + Inspection + Retirement + Purchase Receipt provisioning implementados |
| Quotes            | ✅ Legacy funcional                              |
| Sales             | 🟡 Legacy funcional / refactor pendiente        |
| Returns           | 🟡 Parcialmente implementado                    |
| Dashboard         | ✅ Implementado / evolución UX pendiente         |
| Audit             | ⏳ Requerimiento aprobado                        |

---

# 5. Products — estado actualizado

**Estado:** ✅ Implementado / en evolución

Actualmente:

```text
CRUD
SKU
name
description
brand
Category
barcode
cost
price
stock
minStock
isActive
ProductSelector
inventoryTracking
lotTracking
```

Tracking disponible:

```text
QUANTITY
SERIALIZED
ASSET
```

Lot tracking:

```text
NONE
OPTIONAL
REQUIRED
```

La creación permite definir estas estrategias.

La modificación genérica mediante `UpdateProductDto` no debe utilizarse para cambiar arbitrariamente el tracking después de existir historia operacional.

Pendiente:

```text
Product 360
formal tracking transition workflow if ever required
imports
future units of measure
Healthcare product profile
```

---

# 6. Equipment Core — siguiente evolución

## EQ-INS-001 — Equipment Inspection Workflow

**Estado:** ✅ Completed

**Prioridad:** P1 estratégica

Implementado:
POST /equipment/:equipmentId/inspections
GET  /equipment/:equipmentId/inspections

conditionBefore
→ derived from EquipmentAsset

conditionAfter
→ GOOD
→ DAMAGED
→ OUT_OF_SERVICE

INSPECTION_PENDING
→ invalid final result

RETIRED Equipment
→ inspection blocked

inspectedById
→ authenticated User

inspectedAt
→ server generated

Inspection history
→ preserved

EquipmentAsset.condition
→ updated atomically

Objetivo:

Implementar el primer workflow operacional explícito sobre `EquipmentAsset`.

Debe cubrir:

```text
Inspection creation
Equipment validation
current Condition validation
inspection result
GOOD
DAMAGED
OUT_OF_SERVICE
Condition update
inspection history
actor
timestamp
notes
tenant isolation
authorization
tests
QA
```

Principio:

```text
Inspection
→ updates Condition

Inspection
≠
direct Availability mutation
```

Migration:
20260821221133_equipment_inspection_tenant_fk

---

## EQ-RET-001 — Equipment Retirement

**Estado:** ✅ Completed

**Prioridad:** P1 estratégica

Implementado:

```text
ACTIVE
→ RETIRED

RETIRED
→ terminal lifecycle state

Retirement
≠ DELETE

retiredReason
→ required + enum validated

OTHER
→ retirementNotes required

retirementNotes
→ normalized

retiredAt
→ server generated

retiredById
→ authenticated User

Condition
→ preserved

assetCode
→ preserved

serialNumber
→ preserved

Inspection history
→ preserved

RETIRED Equipment
→ new Inspection blocked

Retirement
→ changes Lifecycle

second Retirement
→ 409 Conflict

concurrent lifecycle change
→ 409 Conflict

Existing EquipmentAsset schema reused
✅

New Prisma migration
→ NOT REQUIRED

EquipmentService
25 / 25 PASS

EquipmentController
7 / 7 PASS

Equipment total
32 / 32 PASS

Test Suites
28 / 28 PASS

Tests
144 / 144 PASS

Manual QA
✅

npm test
✅

npm run build
✅

ESLint
✅

Retirement
≠ Condition mutation
Retirement
≠ DELETE

```

No debe existir `DELETE` como sustituto del Retirement.

---

## EQ-ASSETCODE-001 — Automatic Asset Code

**Estado:** ✅ Completed

**Prioridad:** P1

Objetivo:

```text
POST /equipment
↓
automatic assetCode
```

Formato inicial recomendado:

```text
EQ-000041
```

Debe garantizar:

```text
tenant uniqueness
concurrency safety
no reuse
import compatibility
```

Resultado:

```text
Normal POST /equipment
→ server-generated assetCode

CreateEquipmentDto
→ no longer accepts assetCode

CompanySequence
→ reused with key EQUIPMENT_ASSET_CODE

Prisma schema changes
→ none

Migration
→ none
```

Validación:

```text
Equipment tests
42/42 passed

Backend tests
154/154 passed
29/29 suites passed

Build
PASS

ESLint
PASS

Prisma validate
PASS

Real PostgreSQL concurrency QA
PASS
```

---

## EQ-PR-001 — Purchase Receipt → EquipmentAsset

**Estado:** ✅ Completed / Validated

**Prioridad:** P1

**Repository analysis:** Approved

**Domain design:** Approved

**Implementation:** Implemented / Validated

Implementado para Products:

```text
inventoryTracking = ASSET
```

una recepción crea las identidades físicas correspondientes.

Regla implementada:

```text
PurchaseReceiptItem.quantityReceived = N
↓
create exactly N EquipmentAsset rows
```

No debe usarse `PurchaseItem.quantity` como conteo de creación de Equipment.

Para este ticket:

```text
QUANTITY
→ no EquipmentAsset creation

SERIALIZED
→ no EquipmentAsset creation

ASSET
→ EquipmentAsset creation
```

Consistencia mantenida entre:

```text
PurchaseReceipt
Inventory
Product
EquipmentAsset
```

Arquitectura implementada:

```text
EquipmentAssetCodeService
→ owns CompanySequence allocation
→ owns EQ assetCode formatting and collision reservation

EquipmentProvisioningService
→ owns PurchaseReceiptItem lookup
→ owns tenant-safe provisioning
→ owns inventoryTracking decision
→ owns Equipment identity creation

PurchaseReceiptsService
→ owns receipt orchestration
→ owns transaction boundary
```

Public API:

```text
provisionFromPurchaseReceiptItem(
  tx: Prisma.TransactionClient,
  companyId: string,
  purchaseReceiptItemId: string
): Promise<EquipmentAsset[]>
```

La operación acepta una transacción Prisma propiedad del caller y no abre una segunda transacción.

Flujo validado dentro de la misma transacción Prisma:

```text
InventoryBatch create / resolve
↓
PurchaseReceiptItem.create
↓
EquipmentProvisioningService.provisionFromPurchaseReceiptItem(tx, companyId, createdReceiptItem.id)
↓
Product.stock += quantityReceived
↓
InventoryMovement IN
↓
Purchase status recalculation
↓
COMMIT
```

Decisiones implementadas:

```text
Receipt-created EquipmentAsset
→ lifecycle = ACTIVE
→ condition = INSPECTION_PENDING
→ origin = PURCHASE_RECEIPT
→ purchaseReceiptItemId preserved

serialNumber
→ optional at receipt
→ serialNumber = null allowed

Product.stock
→ mutated only by PurchaseReceipt
→ EquipmentAsset creation does not increment stock again

InventoryMovement
→ no extra movement per EquipmentAsset

Prisma migration
→ not required for minimal implementation
```

Module dependency:

```text
PurchasesReceiptsModule
→ EquipmentModule
→ no forwardRef
→ no circular dependency
```

Mecanismo reutilizado:

```text
CompanySequence
key = EQUIPMENT_ASSET_CODE
```

Persistencia reutilizada:

```text
EquipmentAsset.purchaseReceiptItemId
EquipmentAsset.batchId
EquipmentAsset.origin
EquipmentOrigin.PURCHASE_RECEIPT
CompanySequence
companyId + assetCode uniqueness
```

Validación automatizada:

```text
Purchase Receipt tests
2 suites
26/26 passed

Equipment tests
5 suites
68/68 passed

Full backend tests
31 suites
184/184 passed

npx prisma validate
PASS

npm run build
PASS

ESLint changed TypeScript
PASS

Full backend ESLint
PASS

git diff --check
PASS
```

Manual PostgreSQL / API QA:

```text
Partial receipt
→ Purchase quantity 5
→ Receipt A quantityReceived 2 created 2 EquipmentAssets
→ Receipt B quantityReceived 3 created 3 EquipmentAssets
→ total EquipmentAssets 5

Product.stock
→ initial 0
→ after Receipt A 2
→ after Receipt B 5
→ no double counting

InventoryMovement
→ Receipt A one IN movement, quantity 2, balance 2
→ Receipt B one IN movement, quantity 3, balance 5
→ final movements 2
→ total IN 5

Traceability
→ PurchaseReceiptItem 4a93d639-e25e-4018-98a7-46e5aa36a422 linked exactly 2 assets
→ PurchaseReceiptItem 86319c8a-0e79-451c-84cb-b1471c9ffe4b linked exactly 3 assets

Receipt-created Equipment
→ origin PURCHASE_RECEIPT
→ lifecycle ACTIVE
→ condition INSPECTION_PENDING
→ batchId null when Product lotTracking = NONE

Over-receipt protection
→ extra receipt after RECEIVED returned 400 Bad Request
→ La compra ya fue recibida completamente
→ Product.stock remained 5
→ InventoryMovements remained exactly 2
→ valid EquipmentAssets remained exactly 5
```

Rollback evidence:

```text
transaction rollback behavior
→ structurally implemented and unit-tested

Provisioning errors
→ propagate through the existing receipt Prisma transaction
→ no second transaction is opened
→ downstream Product.stock and InventoryMovement operations are not executed after provisioning failure

manual forced database provisioning failure
→ NOT PERFORMED
```

Pendientes fuera de EQ-PR-001:

```text
PurchaseReceipt request idempotency
→ unresolved high-priority reliability concern

Receipt correction / reversal
→ unresolved

Product.stock ↔ EquipmentAsset reconciliation
→ formal invariant unresolved

serial assignment / correction workflow
→ pending

broader lotTracking enforcement
→ pending

SERIALIZED receipt behavior
→ provisioning pending

tenant-safe write hardening
→ existing debt remains
```

Fases cerradas:

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

---

## EQ-AVL-001 — Availability Evaluator

**Estado:** ✅ IMPLEMENTED / VALIDATED

**Prioridad:** P1

**Repository analysis:** Complete

**Domain design:** Approved

**Implementation:** IMPLEMENTED / VALIDATED

**Validation:** Completed

Availability será:

```text
derived
contextual
explainable
```

Nunca:

```text
available Boolean
```

persistido manualmente.

Debe poder considerar:

```text
Lifecycle
Condition
Inspection
Custody
Assignment
Maintenance
Calibration
Case context
```

EQ-AVL-001 Fase 1 implementa:

```text
Current Equipment Availability
```

Pregunta:

```text
Can this EquipmentAsset be used now according to currently implemented Core Equipment facts?
```

Fase 1 no implementa:

```text
Case Availability
Case Assignment conflicts
Custody
Dispatch
Returns / Custody Return
Maintenance
Calibration
Turnaround
Case scheduling
```

No deben agregarse booleans manuales para simular esos dominios.

Hechos implementados que se usarán:

```text
EquipmentAsset.lifecycle
EquipmentAsset.condition
```

Inspection history existe, pero no será requerida directamente por el evaluator. `EquipmentAsset.condition` es el snapshot operacional actual.

Reglas aprobadas:

```text
ACTIVE + GOOD
→ available = true

ACTIVE + INSPECTION_PENDING
→ available = false
→ INSPECTION_PENDING

ACTIVE + DAMAGED
→ available = false
→ DAMAGED

ACTIVE + OUT_OF_SERVICE
→ available = false
→ OUT_OF_SERVICE

RETIRED
→ available = false
→ RETIRED
```

`ACTIVE + GOOD = available` significa:

```text
available according to currently implemented Core Equipment facts
```

No garantiza todavía:

```text
availability for a specific Case
absence of future Custody blocker
absence of Maintenance blocker
absence of Calibration blocker
absence of Assignment conflict
```

Contrato externo implementado:

```json
{
  "available": false,
  "primaryReason": "INSPECTION_PENDING",
  "reasons": ["INSPECTION_PENDING"],
  "evaluatedAt": "2026-08-24T00:00:00.000Z"
}
```

Contrato del evaluator puro:

```json
{
  "available": false,
  "primaryReason": "INSPECTION_PENDING",
  "reasons": ["INSPECTION_PENDING"]
}
```

Reason codes Fase 1:

```text
RETIRED
INSPECTION_PENDING
DAMAGED
OUT_OF_SERVICE
```

Prioridad determinística:

```text
1. RETIRED
2. INSPECTION_PENDING
3. DAMAGED
4. OUT_OF_SERVICE
```

No exponer todavía:

```text
EXTERNAL_CUSTODY
CASE_CONFLICT
MAINTENANCE_BLOCKED
CALIBRATION_BLOCKED
```

Arquitectura implementada:

```text
equipment-availability.types.ts
→ runtime TypeScript reason constants
→ derived TypeScript reason union

equipment-availability.evaluator.ts
→ pure deterministic evaluator
→ no PrismaService
→ no DB lookup
→ no I/O
→ no clock access
→ no evaluatedAt
→ no Inspection history requirement

EquipmentAvailabilityService
→ tenant-safe Equipment lookup
→ orchestration
→ evaluatedAt

pure Equipment Current Availability evaluator
→ consumes lifecycle + condition facts
→ no database dependency
→ deterministic

EquipmentController
→ GET /equipment/:equipmentId/availability
→ delegates to EquipmentAvailabilityService
→ no Availability business logic
```

API implementada:

```text
GET /equipment/:equipmentId/availability
```

Tenant behavior:

```text
Authenticated Company from JWT
lookup by equipmentId + companyId
cross-tenant or nonexistent Equipment → 404 Equipo no encontrado
```

No agregar Availability a `GET /equipment` en Fase 1 para evitar N+1 implícito.

Availability tampoco se agrega automáticamente a `GET /equipment/:id`.

Prisma:

```text
new Prisma model
→ NOT REQUIRED

new field
→ NOT REQUIRED

new enum
→ NOT REQUIRED

migration
→ NOT REQUIRED
```

Validación automatizada:

```text
Pure Availability evaluator
1 suite
12/12 passed

EquipmentAvailabilityService
1 suite
15/15 passed

EquipmentController
1 suite
12/12 passed

All Equipment tests
7 suites
100/100 passed

Full backend tests
33 suites
216/216 passed

npx prisma validate
PASS

npm run build
PASS

Changed TypeScript ESLint
PASS

Full backend ESLint
PASS

git diff --check
PASS
```

Manual PostgreSQL / API QA:

```text
Asset
→ EQ-000021
→ 9eac7f6a-45ad-49b7-a423-2b182f98860e
→ origin PURCHASE_RECEIPT

Purchase Receipt ACTIVE + INSPECTION_PENDING
→ false / INSPECTION_PENDING
→ PASS

Inspection: INSPECTION_PENDING → GOOD
→ available true
→ PASS

GOOD → DAMAGED
→ available false / DAMAGED
→ PASS

GOOD → RETIRED
→ unavailable / RETIRED
→ condition remained DAMAGED

RETIRED + DAMAGED
→ reasons [RETIRED, DAMAGED]
→ primaryReason RETIRED
→ PASS

Nonexistent Equipment
→ 404 Equipo no encontrado
→ PASS
```

Cross-tenant QA:

```text
real manual second-company QA
→ NOT PERFORMED

automated tenant-scoped lookup / null lookup coverage
→ exists
```

Invalid Retirement QA note:

```text
reason / notes payload
→ invalid

retiredReason / retirementNotes
→ expected

invalid request returned 400
→ no retirement occurred
→ Availability remained DAMAGED until valid Retirement request
```

Fases completadas:

```text
B.1
Pure evaluator + reason types/constants

B.2
EquipmentAvailabilityService with tenant-safe lookup

B.3
GET /equipment/:equipmentId/availability

B.4
Automated tests and technical validation

B.5
Manual PostgreSQL/API QA using real Equipment state transitions

C
Final documentation synchronization
```

Permanecen fuera de alcance:

```text
Case Availability
Custody
Assignment
Case conflict
Maintenance
Calibration
Turnaround
placeholder persisted booleans
Product.stock-based Equipment availability
```

Deuda no resuelta por EQ-AVL-001:

```text
Purchase Receipt idempotency
Product.stock ↔ EquipmentAsset reconciliation
serial assignment/correction
broader lotTracking enforcement
tenant-safe write hardening
```

---

# 7. P0 — Release / Security blockers

Estas tareas siguen siendo obligatorias antes de una exposición comercial real.

## SEC-001 — Sanitizar Authentication Responses

**Estado:** ⏳ Pending
**Prioridad:** P0

Regla:

```text
API Response
→ never passwordHash
```

Revisar:

```text
login
/auth/me
User endpoints
regression tests
```

---

## SEC-002 — Revisar default ADMIN

**Estado:** ⏳ Pending
**Prioridad:** P0

Riesgo:

```text
User.role
@default(ADMIN)
```

Debe revisarse:

```text
all user creation flows
explicit role assignment
privilege escalation tests
```

---

## SEC-003 — Inactive User Authentication

**Estado:** 🔎 Verify
**Prioridad:** P0

Debe garantizarse:

```text
User.isActive = false
→ no normal application access
```

---

## SEC-004 — Tenant Isolation Regression Suite

**Estado:** ⏳ Pending / partial
**Prioridad:** P0

Cobertura sistemática:

```text
Company A
→ cannot access Company B resources
```

para operaciones críticas.

---

## QA-CORE — Commercial Core Regression

**Estado:** ⏳ Pending
**Prioridad:** P0

Antes de release:

```text
backend lint
backend build
backend tests
frontend tests
critical flows
tenant isolation
authorization
manual QA
security review
```

---

# 8. Returns

## RET-004 — Returns Backend

**Estado:** ⏳ Pending
**Prioridad:** P0

Diseño completado:

```text
RET-001 Functional Design
✅

RET-002 Prisma Design
✅

RET-003 Schema + Migration
✅
```

Pendiente:

```text
RET-004 Backend
```

Debe incluir:

```text
create
read
confirm
cancel
validation
tenant isolation
quantity protection
concurrency
Inventory integration
tests
```

Arquitectura futura:

```text
Delivery
↓
Return
↓
Inspection / Disposition
↓
Inventory
```

---

# 9. Sales evolution

## SALES-REF — SalesOrder + Delivery

**Estado:** ⏳ Pending
**Prioridad:** P1 estratégica

Arquitectura objetivo:

```text
Quote
↓ optional
SalesOrder
↓
Delivery
↓
Inventory OUT
```

Debe reemplazar progresivamente la responsabilidad física actualmente contenida en `Sale`.

Incluye:

```text
SalesOrder
SalesOrderItem
Delivery
DeliveryItem
partial deliveries
pending quantities
batch allocation
legacy migration
Quote conversion
Returns integration
```

---

# 10. Inventory evolution

## INV-FEFO

**Estado:** ⏳ Pending
**Prioridad:** P1

```text
First Expired
First Out
```

---

## INV-EXP

**Estado:** ⏳ Pending
**Prioridad:** P1

Incluye:

```text
expired inventory
near-expiration
operational availability
alerts
Dashboard integration
```

---

## Future Inventory

```text
Multi-Warehouse
Locations
Transfers
Serial Tracking
Physical Counts
Barcode / QR workflows
```

Prioridad:

```text
P2
```

salvo que alguno sea necesario para un workflow P0/P1.

---

# 11. Healthcare — estado actual

**Estado:** ✅ Case Foundation completed / validated; Healthcare expansion deferred behind ERP Core UI/UX
**Prioridad:** P1 estratégica

Completado específicamente para Equipment:

```text
Core / Healthcare ownership boundary
✅

Healthcare Equipment domain document
✅
```

Healthcare Equipment todavía no está implementado.

Healthcare Case Foundation:

```text
IMPLEMENTED / VALIDATED

Repository analysis
→ COMPLETE

Domain design
→ APPROVED

Implementation
→ COMPLETE

Automated validation
→ PASS

Manual PostgreSQL / API QA
→ PASS within stated limits
```

Implementado:

```text
HealthcareCase

identity
tenant
planning schedule
minimal lifecycle
operational responsibility
creation / cancellation audit facts
stable references for future Healthcare domains
```

Persistencia implementada:

```text
id
companyId
folio

title
procedureDescription?

status

scheduledStart?
scheduledEnd?

responsibleUserId?

createdById

cancelledAt?
cancelledById?
cancellationReason?

createdAt
updatedAt
```

Migration:

```text
20260824162849_add_healthcare_case_foundation
→ focused Case Foundation migration
→ no reset
→ no unrelated destructive SQL
```

Relations preserve audit history:

```text
Company
→ onDelete Restrict

responsibleUser
→ onDelete Restrict

createdBy
→ onDelete Restrict

cancelledBy
→ onDelete Restrict
```

Lifecycle implemented:

```text
DRAFT
SCHEDULED
CANCELLED
```

Active status derivation:

```text
effective scheduledStart exists
→ SCHEDULED

effective scheduledStart absent
→ DRAFT
```

Cancelled is terminal in Foundation:

```text
PATCH CANCELLED
→ 409 El caso cancelado no puede modificarse

second cancel
→ 409 El caso ya está cancelado
```

Not implemented in Foundation:

```text
IN_PROGRESS
COMPLETED
RECONCILIATION_PENDING
RETURN_PENDING
DISPATCHED
```

HealthcareCase no posee:

```text
Equipment Assignment
Equipment Requirement
CaseKit
Dispatch
Custody
Return
Inventory
Billing
Insurance
Patient records
Clinical records
```

Folio:

```text
CASE-000001
→ generated server-side
→ immutable
→ unique per Company
→ CompanySequence-based
→ allocated inside Case creation transaction
```

Shared sequence infrastructure implemented:

```text
src/company-sequences
CompanySequenceAllocatorService

allocateNext(tx, companyId, key)
→ caller-owned Prisma transaction
→ race-safe sequence row bootstrap
→ atomic nextValue increment
→ numeric allocation only
```

Case folio key:

```text
HEALTHCARE_CASE_FOLIO
```

Equipment owns `EQ-` formatting and collision logic. Healthcare Case owns `CASE-` formatting and collision logic.

Constraints/indexes implemented:

```text
@@unique([companyId, folio])
@@unique([id, companyId])

@@index([companyId, status])
@@index([companyId, scheduledStart])
@@index([companyId, responsibleUserId])
```

Schedule invariants:

```text
start null + end null
→ valid unscheduled Case

start present + end null
→ valid scheduled Case with unknown duration/end

start present + end present
→ valid only when end > start

start null + end present
→ invalid
```

Hospital / Doctor:

```text
hospitalId
→ deferred

doctorId
→ deferred

Customer
≠
Hospital / Doctor / Payer
```

Responsible user:

```text
responsibleUserId
→ nullable
→ references User

Technician model / profile / TECHNICIAN role
→ not part of Foundation
```

Cancellation:

```text
POST /healthcare/cases/:id/cancel

DRAFT / SCHEDULED
→ CANCELLED

CANCELLED
→ terminal in Phase 1
```

No:

```text
DELETE endpoint
complete command
patient / PHI fields
clinical record fields
```

API namespace approved:

```text
/healthcare/cases
```

API implemented:

```text
POST /healthcare/cases
GET /healthcare/cases
GET /healthcare/cases/:id
PATCH /healthcare/cases/:id
POST /healthcare/cases/:id/cancel
```

Create:

```text
client supplies
→ title
→ procedureDescription?
→ scheduledStart?
→ scheduledEnd?
→ responsibleUserId?

server derives
→ companyId
→ createdById
→ folio
→ status
```

Create transaction:

```text
creator validation
responsible-user validation when supplied
CompanySequence folio allocation
HealthcareCase create
```

PATCH planning:

```text
omitted
→ retain persisted value

explicit null where allowed
→ clear value
```

B.4.1 regression and resolution:

```text
schedule-only PATCH with title omitted
→ originally returned 400 El título del caso es obligatorio

root cause
→ update normalization treated own undefined as supplied value

fix
→ undefined / omitted retains persisted value
→ explicit value applies normalization/update

manual retest
→ PASS
```

RBAC implemented:

```text
ADMIN
→ create / read / edit / cancel

MANAGER
→ create / read / edit / cancel

SALES
→ create / read / edit

WAREHOUSE
→ read
```

Reliability debt:

```text
Case creation idempotency
→ NOT IMPLEMENTED in Foundation
→ retry after lost successful response may create another Case and consume another folio
```

Prisma assessment:

```text
B.1 required one focused schema/migration change

B.2 / B.3 / B.4 / B.4.1
→ no additional schema changes
→ no additional migrations

Hospital and Doctor
→ not part of this migration
```

Automated validation:

```text
HealthcareCaseService
59 tests PASS

Controller + DTOs
46 tests PASS

Full Healthcare Case
6 suites
116 tests PASS

Full backend
40 suites
341 tests PASS

Prisma validate
PASS

Build
PASS

Changed TypeScript ESLint
PASS

Full backend ESLint
PASS

git diff --check
PASS
```

Manual PostgreSQL / API QA:

```text
two repeated Case creation requests
→ CASE-000001
→ CASE-000002
→ valid independent Cases

primary QA Case
→ CASE-000002
→ 99ca6093-7209-4152-af4d-37a9d774536d

GET one
→ PASS

GET list
→ PASS

schedule-only PATCH after B.4.1
→ DRAFT to SCHEDULED
→ existing title preserved
→ PASS

reschedule
→ SCHEDULED to SCHEDULED
→ PASS

invalid schedule
→ 400 La fecha de fin debe ser posterior a la fecha de inicio
→ subsequent GET confirmed no mutation
→ PASS

unschedule
→ SCHEDULED to DRAFT
→ PASS

reschedule before cancellation
→ DRAFT to SCHEDULED
→ PASS

cancel
→ SCHEDULED to CANCELLED
→ schedule preserved
→ cancellation audit set
→ PASS

terminal state checks
→ PATCH CANCELLED 409
→ second cancel 409
→ final GET preserved original cancellation audit facts
→ PASS
```

Manual QA limits:

```text
real manual second-company cross-tenant QA
→ NOT PERFORMED

real simultaneous concurrent cancellation race
→ NOT PERFORMED
```

Idempotency evidence/debt:

```text
same logical Case create submitted twice
→ two valid Cases
→ two folios

Case creation idempotency
→ unresolved
```

This is expected under the current non-idempotent API and is not a sequence bug.

Still pending for Healthcare, deferred behind ERP Core UI/UX Completion:

```text
Hospital/Doctor master data
Equipment Requirement
Case Equipment Assignment
Availability for Case
Preparation
Dispatch
Custody
Return
Inspection workflow
Case 360 integration
Warehouse Operations
Calendar integration
Technician Mobile
```

---

# 12. Healthcare — orden futuro recomendado

Healthcare expansion remains queued after ERP Core UI/UX Completion.

```text
1. Hospital / Doctor master data
2. Equipment / Material Requirements
3. Equipment Assignment
4. Case Availability
5. Dispatch / Custody
6. Return
7. Case Kit / Maletín
8. Case Calendar
9. Case 360
10. Mobile technician experience
```

Healthcare deberá consumir siempre:

```text
ERP/Core EquipmentAsset
```

y no duplicar identidad física.

---

# 13. Otros P1 comerciales

## IMP-001 — Data Import

**Estado:** ⏳ Pending

```text
Customers
Suppliers
Products
Inventory

CSV
XLSX
```

---

## UX-360 — 360 Views

**Estado:** ⏳ Pending

Prioridad futura:

```text
Product 360
Customer 360
Supplier 360
Purchase 360
SalesOrder 360
Equipment 360
```

---

## UX-DASH — Action Dashboard

**Estado:** ⏳ Pending

Dirección:

```text
Attention
↓
Action
↓
KPIs
↓
Trends
```

---

## UX-SEARCH — Global Search

**Estado:** ⏳ Pending

Debe respetar:

```text
tenant
permissions
resources
context
```

---

## AUTH-PERM — Permission-Based RBAC

**Estado:** ⏳ Target

Evolución:

```text
UserRole
↓
RolesGuard
```

hacia:

```text
Role
↓
Permissions
↓
PermissionsGuard
```

---

## AUD-001 — Audit Foundation

**Estado:** ⏳ Pending

Primera fase:

```text
AuditEvent
AuditService
tenant
actor
action
resource
safe metadata
append-only
critical integrations
```

---

# 14. Future products

## Zaping Radar

**Estado:** 🔮 Future

Primera dirección:

```text
public procurement
healthcare opportunities
Sonora
Baja California
Baja California Sur
Nuevo León
Sinaloa
```

---

## Zaping AI

**Estado:** 🔮 Future

Regla:

> **AI debe construirse sobre dominios confiables, workflows explícitos y datos trazables.**

No debe competir actualmente con la estabilización del ERP y Healthcare.

---

# 15. Riesgos activos

## RISK-001 — Security debt

```text
passwordHash exposure
ADMIN default
inactive-user enforcement
tenant isolation coverage
```

Mitigación:

```text
complete P0 security work before production
```

---

## RISK-002 — Legacy Sales architecture

Actualmente:

```text
Sale
→ commercial commitment
+
physical fulfillment
```

Objetivo:

```text
SalesOrder
≠
Delivery
```

---

## RISK-003 — Returns legacy dependency

Returns todavía depende del modelo legacy de Sales.

Mitigación:

```text
avoid new deep dependencies
+
coordinate future migration with Delivery
```

---

## RISK-004 — Equipment / Inventory dual truth

Durante la transición existe:

```text
Product.stock
+
EquipmentAsset records
```

Para Products `ASSET` no deben evolucionar como fuentes físicas independientes.

Mitigación:

```text
design Equipment / Inventory synchronization
before automating acquisition flows
```

---

## RISK-005 — Product scope growth

Evitar desarrollar simultáneamente:

```text
ERP
Healthcare
Radar
AI
Portal
Mobile
Billing
```

Prioridad:

```text
stable ERP Core
+
differentiated Healthcare workflows
```

---

# 16. Definition of Done

Una tarea no está completada únicamente porque:

```text
code compiles
```

Según corresponda deberá incluir:

```text
business rules approved
documentation
architecture review
migration
implementation
tests
lint
build
tenant isolation
authorization
manual QA
security review
documentation update
CHANGELOG update
```

---

# 17. Estados

```text
✅ Completed
→ terminado y validado
```

```text
🟢 In Progress
→ trabajo activo
```

```text
🟡 Ready / Partial
→ listo para comenzar o funcionalidad parcial
```

```text
⏳ Pending
→ aprobado pero no implementado
```

```text
🔎 Verify
→ necesita validación
```

```text
🔮 Future
→ dirección posterior
```

---

# 18. Prioridades

```text
P0
→ security / integrity / release blocker
```

```text
P1
→ strategic commercial capability
```

```text
P2
→ important expansion
```

```text
Future
→ long-term direction
```

---

# 19. Orden de trabajo inmediato

Para el workstream Healthcare + Equipment recientemente cerrado:

```text
1. Design Automatic assetCode generation
2. Implement Automatic assetCode generation
3. Purchase Receipt → EquipmentAsset
4. Availability Evaluator
5. Healthcare Case Foundation
```

Estado:

```text
1. Design Automatic assetCode generation
→ completed

2. Implement Automatic assetCode generation
→ completed

3. Purchase Receipt → EquipmentAsset
→ completed / validated

4. Availability Evaluator
→ completed / validated

5. Healthcare Case Foundation
→ completed / validated
```
Core Equipment baseline
✅

Equipment Inspection
✅

Equipment Retirement
✅

Purchase Receipt → EquipmentAsset
✅

Current Availability
✅

Healthcare Case Foundation
✅

Equipment Assignment is no longer blocked by absence of `HealthcareCase`, but it is not the immediate next implementation task.

Immediate next milestone:

```text
ERP CORE UI / UX COMPLETION
```

Purpose:

```text
finish and normalize Zaping's base ERP product experience
before adding more Healthcare-specific modules
```

Conceptual milestone areas:

```text
1. authenticated global App Shell
→ persistent sidebar across authenticated pages
→ consistent header/layout
→ active navigation state
→ responsive navigation

2. Dashboard / Home refinement
→ operational overview
→ meaningful KPIs
→ pending work / alerts
→ consistent visual hierarchy

3. Sales frontend completion
→ Sales listing
→ create Sale experience
→ Sale detail
→ status/actions
→ integration with existing backend

4. ERP module UX consistency
→ Products
→ Customers
→ Suppliers
→ Quotes
→ Purchases
→ Purchase Receipts
→ Inventory
→ Sales
→ Equipment

Review for:
→ PageContainer
→ PageHeader
→ filters
→ search
→ tables
→ badges
→ loading
→ empty states
→ errors
→ forms
→ dialogs
→ navigation

5. ERP end-to-end UX/QA
→ Supplier → Purchase → Receipt → Inventory → Quote → Sale
→ Purchase → Receipt ASSET → Equipment → Inspection → Availability
```

En paralelo, antes de release comercial deberán cerrarse los blockers:

```text
SEC-001
SEC-002
SEC-003
SEC-004
QA-CORE
```

No debe sacrificarse seguridad para acelerar un workflow funcional.

---

# 20. Próximo trabajo recomendado

El siguiente bloque es:

```text
ERP CORE UI / UX COMPLETION
```

Estado:

```text
Healthcare Case Foundation
→ COMPLETED / VALIDATED

ERP CORE UI / UX COMPLETION
→ NEXT MILESTONE
```

Este hito debe estabilizar la experiencia base del ERP antes de expandir Healthcare logistics.

Scope recomendado:

```text
authenticated global App Shell
Dashboard / Home refinement
Sales frontend completion
ERP module UX consistency
ERP end-to-end UX/QA
```

Healthcare futuro queda en cola posterior:

```text
Hospital / Doctor master data
Equipment / Material Requirements
Equipment Assignment
Case Availability
Dispatch / Custody
Return
Case Kit / Maletín
Case Calendar
Case 360
Mobile technician experience
```

Deuda no resuelta que debe seguir visible:

```text
Purchase Receipt idempotency
Healthcare Case creation idempotency
Product.stock ↔ EquipmentAsset reconciliation
serial assignment/correction
broader lotTracking enforcement
tenant-safe legacy write hardening
future Equipment Assignment concurrency design
```

---

# Final Principle

La pregunta que este documento debe poder responder siempre es:

> **¿Cuál es el siguiente trabajo correcto para avanzar Zaping hoy?**

Respuesta actual:

```text
Core Equipment baseline
✅

Purchase Receipt → EquipmentAsset
✅

Then:

Availability Evaluator
→ completed / validated

Then:

Healthcare Case Foundation
→ completed / validated

Then:

ERP CORE UI / UX COMPLETION
→ immediate next milestone

Then:

Healthcare logistics expansion
→ queued after ERP Core UI/UX Completion
```
