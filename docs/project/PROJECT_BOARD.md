# Project Board — Zaping

**Producto:** Zaping Platform
**Estado:** Desarrollo activo
**Fase actual:** ERP Core + Equipment Foundation + Healthcare Preparation
**Última actualización:** 2026-08-21
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
| Equipment Core    |  ✅ Registration + Read + Inspection + Retirement implementados |
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

**Estado:** 🟡 Ready / Next

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

---

## EQ-PR-001 — Purchase Receipt → EquipmentAsset

**Estado:** ⏳ Pending

**Prioridad:** P1

Para Products:

```text
inventoryTracking = ASSET
```

una recepción deberá poder crear las identidades físicas correspondientes.

Debe mantener consistencia entre:

```text
PurchaseReceipt
Inventory
Product
EquipmentAsset
```

y ejecutarse transaccionalmente cuando corresponda.

---

## EQ-AVL-001 — Availability Evaluator

**Estado:** ⏳ Pending

**Prioridad:** P1

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

**Estado:** 🟡 Domain design in progress
**Prioridad:** P1 estratégica

Completado específicamente para Equipment:

```text
Core / Healthcare ownership boundary
✅

Healthcare Equipment domain document
✅
```

Healthcare Equipment todavía no está implementado.

Pendiente:

```text
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

# 12. Healthcare Equipment — orden recomendado

```text
1. Equipment Requirement contract
2. Case Equipment Assignment
3. Availability for Case
4. Preparation integration
5. Dispatch
6. Custody
7. Return
8. Inspection integration
9. Case 360
10. Warehouse Operations UI
11. Calendar integration
12. Technician Mobile
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

Para el workstream actual de Equipment:

```text
1. Design Automatic assetCode generation
2. Implement Automatic assetCode generation
3. Purchase Receipt → EquipmentAsset
4. Availability Evaluator
5. Healthcare Equipment Assignment
6. Healthcare Case Logistics integration
```
Core Equipment baseline
✅

Equipment Inspection
✅

Equipment Retirement
✅

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
EQ-ASSETCODE-001
Automatic assetCode Generation
```

Primero:

Business Analysis
↓
Documentation
↓
Architecture Review
```

Después:

CompanySequence review
↓
Concurrency design
↓
Prisma review
↓
Backend
↓
Tests
↓
QA
↓
Documentation Update
```
Debe manternerse:

```text
assetCode
→ stable operational identity

assetCode
→ unique inside Company

assetCode
→ never reused

generated identifier
≠
business meaning encoded in code
```

---

# Final Principle

La pregunta que este documento debe poder responder siempre es:

> **¿Cuál es el siguiente trabajo correcto para avanzar Zaping hoy?**

Respuesta actual:

```text
Core Equipment baseline
✅

Documentation synchronization
→ finish CHANGELOG

Then:

Equipment Inspection
→ next domain workflow
```
