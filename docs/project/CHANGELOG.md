# Changelog — Zaping

**Documento:** Historial consolidado del proyecto
**Versión:** 1.0.0
**Estado:** Activo
**Última actualización:** 2026-08-24

---

# 1. Propósito

Este documento conserva la historia relevante de evolución de Zaping.

Su función es responder:

```text
¿Qué se construyó?
¿Qué cambió?
¿Qué decisiones anteriores fueron sustituidas?
¿Cuándo evolucionó la arquitectura?
```

El Changelog registra hechos históricos.

No representa:

```text
trabajo actual
```

ni:

```text
planes futuros
```

Esas responsabilidades pertenecen respectivamente a:

```text
PROJECT_BOARD.md
ROADMAP.md
```

---

# 2. Regla documental

```text
CHANGELOG
→ lo que ocurrió

PROJECT_BOARD
→ lo que estamos haciendo

ROADMAP
→ lo que queremos hacer
```

Una funcionalidad completada debe dejar de vivir únicamente en un Sprint o Backlog y pasar a formar parte de la historia consolidada del proyecto.

---
# 3. 2026-08 — Documentation Consolidation & Core Equipment Baseline

## Current Equipment Availability — EQ-AVL-001

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Core Equipment incorporó un evaluator de Current Availability para responder:

```text
Can this EquipmentAsset be used now according to currently implemented Core Equipment facts?
```

Arquitectura implementada:

```text
equipment-availability.types.ts
→ runtime TypeScript reason constants
→ derived TypeScript reason union

equipment-availability.evaluator.ts
→ pure deterministic evaluator
→ lifecycle + condition facts only
→ no PrismaService
→ no database lookup
→ no I/O
→ no clock access
→ no evaluatedAt
→ no Inspection history requirement

EquipmentAvailabilityService
→ tenant-safe Equipment lookup
→ invokes pure evaluator
→ adds evaluatedAt
→ no Inspection-history query
→ no Product.stock query
→ no writes
→ no Prisma transaction
→ no cache

EquipmentController
→ GET /equipment/:equipmentId/availability
→ delegates to EquipmentAvailabilityService
→ no Availability business logic
```

Hechos usados en Fase 1:

```text
EquipmentAsset.lifecycle
EquipmentAsset.condition
```

Reglas entregadas:

```text
ACTIVE + GOOD
→ available true

ACTIVE + INSPECTION_PENDING
→ available false
→ INSPECTION_PENDING

ACTIVE + DAMAGED
→ available false
→ DAMAGED

ACTIVE + OUT_OF_SERVICE
→ available false
→ OUT_OF_SERVICE

RETIRED
→ available false
→ RETIRED
```

Reason codes implementados:

```text
RETIRED
INSPECTION_PENDING
DAMAGED
OUT_OF_SERVICE
```

No se implementaron reason codes futuros:

```text
EXTERNAL_CUSTODY
CASE_CONFLICT
MAINTENANCE_BLOCKED
CALIBRATION_BLOCKED
```

Orden determinístico de blockers:

```text
1. RETIRED
2. INSPECTION_PENDING
3. DAMAGED
4. OUT_OF_SERVICE
```

Ejemplo validado:

```text
RETIRED + DAMAGED
→ available false
→ primaryReason RETIRED
→ reasons [RETIRED, DAMAGED]
```

Resultado externo:

```json
{
  "available": false,
  "primaryReason": "INSPECTION_PENDING",
  "reasons": ["INSPECTION_PENDING"],
  "evaluatedAt": "2026-08-24T00:00:00.000Z"
}
```

El resultado es derivado al momento del request. No se persiste ni se cachea Availability.

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

ACTIVE + INSPECTION_PENDING
→ available false
→ primaryReason INSPECTION_PENDING
→ reasons [INSPECTION_PENDING]
→ PASS

Inspection INSPECTION_PENDING → GOOD
→ available true
→ primaryReason null
→ reasons []
→ PASS

Inspection GOOD → DAMAGED
→ available false
→ primaryReason DAMAGED
→ reasons [DAMAGED]
→ PASS

Retirement ACTIVE → RETIRED
condition remained DAMAGED
→ available false
→ primaryReason RETIRED
→ reasons [RETIRED, DAMAGED]
→ PASS

Nonexistent Equipment
→ 404 Equipo no encontrado
→ PASS
```

Cross-tenant real manual second-company QA was not performed; tenant-scoped lookup behavior is covered by automated tests.

No se requirieron cambios de Prisma schema ni migración.

Permanecen como trabajo futuro:

```text
Case Availability
Custody
Assignment
Case conflict
Maintenance
Calibration
Turnaround
batch/list Availability
```

Deuda no resuelta por esta entrega:

```text
Purchase Receipt idempotency
Product.stock ↔ EquipmentAsset reconciliation
serial assignment/correction
broader ProductLotTracking enforcement
tenant-safe write hardening
```

---

## Purchase Receipt → EquipmentAsset — EQ-PR-001

**Estado:** Completed / Validated
**Periodo:** 2026-08

Se integró la creación automática de `EquipmentAsset` desde Purchase Receipts para productos físicos administrados como activos:

```text
Product.inventoryTracking = ASSET
PurchaseReceiptItem.quantityReceived = N
→ create exactly N EquipmentAsset rows
```

Arquitectura implementada:

```text
EquipmentAssetCodeService
→ owns CompanySequence allocation
→ owns assetCode formatting
→ owns historical / retired generated-looking code reservation

EquipmentProvisioningService
→ owns PurchaseReceiptItem lookup
→ owns tenant-safe provisioning
→ owns inventoryTracking decision
→ owns Equipment identity creation

PurchaseReceiptsService
→ owns Purchase Receipt orchestration
→ owns the Prisma transaction boundary
```

La integración quedó dentro de la transacción existente de Purchase Receipt:

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

Reglas entregadas:

```text
ASSET
→ provisioned from quantityReceived

QUANTITY
→ no EquipmentAsset creation

SERIALIZED
→ no EquipmentAsset creation in this phase

Receipt-created EquipmentAsset
→ lifecycle = ACTIVE
→ condition = INSPECTION_PENDING
→ origin = PURCHASE_RECEIPT
→ serialNumber = null
→ serialNumberKey = null
→ purchaseReceiptItemId preserved
→ batchId copied from PurchaseReceiptItem when available
```

No se duplican proyecciones de inventario:

```text
Product.stock
→ mutated only by PurchaseReceipt

InventoryMovement
→ no extra movement per EquipmentAsset
```

Validación registrada:

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
Purchase quantity 5
Receipt A quantityReceived 2
→ created 2 EquipmentAssets
→ Purchase status CONFIRMED → PARTIALLY_RECEIVED
→ one InventoryMovement IN, quantity 2, balance 2
→ Product.stock = 2

Receipt B quantityReceived 3
→ created 3 EquipmentAssets
→ Purchase status PARTIALLY_RECEIVED → RECEIVED
→ one InventoryMovement IN, quantity 3, balance 5
→ Product.stock = 5

Final
→ EquipmentAssets = 5
→ InventoryMovements = 2
→ Total IN = 5
→ Product.stock = 5
```

Traceability QA:

```text
PurchaseReceiptItem 4a93d639-e25e-4018-98a7-46e5aa36a422
→ linked exactly 2 EquipmentAsset rows

PurchaseReceiptItem 86319c8a-0e79-451c-84cb-b1471c9ffe4b
→ linked exactly 3 EquipmentAsset rows
```

Over-receipt protection:

```text
Additional receipt after Purchase status RECEIVED
→ 400 Bad Request
→ La compra ya fue recibida completamente

After failed request
→ Product.stock remained 5
→ InventoryMovements remained exactly 2
→ valid EquipmentAssets remained exactly 5
```

Rollback evidence:

```text
transaction rollback behavior
→ structurally implemented and unit-tested

manual forced database provisioning failure
→ NOT PERFORMED
```

No se requirieron cambios de Prisma schema ni migración.

Deuda que permanece abierta:

```text
Purchase Receipt request idempotency
Purchase Receipt correction / reversal
Product.stock ↔ EquipmentAsset formal reconciliation invariant
serial assignment / correction workflow
SERIALIZED receipt provisioning
broader ProductLotTracking REQUIRED / NONE enforcement
tenant-safe write hardening
```

---

## Equipment Automatic assetCode Generation — EQ-ASSETCODE-001

**Estado:** Completed / Validated
**Periodo:** 2026-08

Core Equipment incorporó generación automática de `assetCode` para el registro normal:

```text
POST /equipment
→ server-generated assetCode
```

Cambios principales:

```text
CreateEquipmentDto
→ no longer exposes assetCode

Client-provided assetCode
→ rejected by ValidationPipe

CompanySequence
→ reused for tenant-scoped allocation

Sequence key
→ EQUIPMENT_ASSET_CODE

Format
→ EQ-000001, EQ-000002, ..., EQ-1000000
```

La asignación utiliza:

```text
companyId + key = EQUIPMENT_ASSET_CODE
atomic nextValue increment
allocatedValue = returned nextValue - 1
```

La generación ocurre dentro de la misma transacción Prisma que crea `EquipmentAsset`.

Los códigos históricos, manuales o generados previamente se verifican antes del insert. Si el candidato ya existe, la secuencia avanza y se evalúa el siguiente.

Los `assetCode` de Equipment retirado permanecen reservados permanentemente.

Los gaps de secuencia son aceptados explícitamente; no se implementó numeración gapless.

Validación:

```text
Equipment tests
42/42 passed

Backend tests
154/154 passed
29/29 suites passed

npx prisma validate
PASS

npm run build
PASS

ESLint
PASS

Real PostgreSQL concurrency QA
PASS
```

No se requirieron cambios de Prisma schema ni migración.

En la entrega de EQ-ASSETCODE-001, Importación de Equipment y Purchase Receipt → EquipmentAsset permanecieron fuera de alcance.

---

## Documentation Architecture Refactor

**Estado:** Completed
**Periodo:** 2026-08

Se completó una reconstrucción de la documentación oficial de Zaping con el objetivo de eliminar:

* documentos vacíos;
* duplicados;
* fuentes contradictorias;
* arquitectura obsoleta;
* documentación fragmentada por Sprint;
* reglas históricas presentadas como vigentes.

Se adoptó y aplicó el principio:

> **Una verdad → un documento responsable.**

---

# Equipment Inspection Workflow — EQ-INS-001

# Equipment Retirement Workflow — EQ-RET-001

Después de implementar Equipment Inspection, Core Equipment incorporó una operación explícita para retirar permanentemente activos de la flota operacional.

Estado:

```text
EQ-RET-001
Equipment Retirement
→ IMPLEMENTED / VALIDATED
```

## Product Documentation

Se consolidaron:

```text
product/PRODUCT_VISION.md
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md
```

El ecosistema quedó estructurado conceptualmente como:

```text
Zaping Platform
├── Zaping ERP Core
├── Zaping Healthcare
├── Zaping Radar
└── Zaping AI
```

Healthcare se mantiene como la primera vertical especializada.

---

## Architecture Documentation

Se consolidaron:

```text
architecture/ARCHITECTURE.md
architecture/c4/
architecture/adr/
```

El catálogo ADR vigente quedó consolidado hasta ADR-013.

Se eliminaron ubicaciones legacy y documentos arquitectónicos redundantes.

---

## Engineering Documentation

Se consolidaron:

```text
ENGINEERING_GUIDE.md
DEVELOPMENT_WORKFLOW.md
QUALITY_STANDARDS.md
SECURITY_PRINCIPLES.md
API_GUIDELINES.md
```

Se corrigieron duplicaciones entre Quality y Security y se formalizó nuevamente el flujo:

```text
Business Analysis
↓
Documentation
↓
Architecture Review
↓
Implementation
↓
Tests
↓
QA
↓
Documentation Update
```

---

## UX Documentation

Se consolidaron:

```text
ux/DESIGN_SYSTEM.md
ux/BUSINESS_COMPONENTS.md
product/ZAPING_WAY.md
```

Se mantuvo como principio:

> **Simple por defecto. Poderoso cuando se necesita.**

Y:

```text
Data
↓
Context
↓
Action
```

como dirección general de experiencia.

---

## ERP Module Documentation

La documentación funcional fue consolidada bajo:

```text
docs/modules/erp/
```

incluyendo fuentes responsables para:

```text
AUDIT
COMPANIES
CUSTOMERS
DASHBOARD
IDENTITY_ACCESS
INVENTORY
PRODUCTS
PURCHASES
QUOTES
RETURNS
SALES
SUPPLIERS
EQUIPMENT
```

Se eliminaron o sustituyeron documentos duplicados y snapshots que ya no representaban el estado vigente.

---

# Core Equipment Domain

Durante agosto de 2026 se formalizó e implementó la primera baseline técnica de Core Equipment.

La responsabilidad quedó separada de la siguiente manera:

```text
Zaping ERP / Core
→ EquipmentAsset identity and lifecycle

Zaping Healthcare
→ operational use of Equipment inside Cases
```

Documentación vigente:

```text
docs/modules/erp/EQUIPMENT.md
→ v1.3.0

docs/modules/healthcare/EQUIPMENT.md
→ v1.0.0
```

---

## Product Tracking Evolution

`Product` evolucionó para distinguir la estrategia principal de seguimiento físico.

Se incorporó:

```text
ProductInventoryTracking
├── QUANTITY
├── SERIALIZED
└── ASSET
```

También se formalizó lot tracking como dimensión independiente:

```text
ProductLotTracking
├── NONE
├── OPTIONAL
└── REQUIRED
```

Debe mantenerse:

```text
SERIALIZED
≠
ASSET
```

Para:

```text
inventoryTracking = ASSET
```

la identidad de cada unidad física pertenece a:

```text
EquipmentAsset
```

---

## Equipment Persistence Baseline

Se incorporaron en Prisma:

```text
EquipmentAsset
EquipmentInspection
```

junto con:

```text
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

---

## Equipment Identity

Se formalizó:

```text
Product
→ what the resource/model is

EquipmentAsset
→ which exact physical unit it is
```

Todo `EquipmentAsset` requiere:

```text
productId
companyId
assetCode
```

`serialNumber` es opcional.

Se incorporó:

```text
serialNumberKey
```

para normalización y detección consistente de duplicados.

Restricciones principales:

```text
companyId + assetCode
→ UNIQUE
```

y:

```text
companyId + productId + serialNumberKey
→ UNIQUE
```

---

## Core Equipment Backend

Se implementó el módulo NestJS de Equipment.

Contrato API vigente:

```text
GET  /equipment
GET  /equipment/:id
POST /equipment
```

No forman parte del contrato actual:

```text
PATCH /equipment/:id
DELETE /equipment/:id
```

La ausencia de `DELETE` preserva la historia del activo.

La ausencia de un `PATCH` genérico protege la identidad operacional y reserva cambios sensibles para futuras operaciones explícitas y auditables.

---

## Equipment Registration

El flujo implementado para registro manual es:

```text
Authenticated User
↓
companyId from authentication context
↓
Validate DTO
↓
Validate Product belongs to Company
↓
Validate Product.inventoryTracking = ASSET
↓
Validate Product.isActive
↓
Validate optional Batch
↓
Normalize assetCode
↓
Validate assetCode uniqueness
↓
Normalize optional serialNumber
↓
Generate serialNumberKey
↓
Validate serial uniqueness
↓
Create EquipmentAsset
```

Los Equipment creados mediante este flujo utilizan:

```text
origin = MANUAL
lifecycle = ACTIVE
```

---

## Multi-Tenant Protection

Equipment utiliza:

```text
companyId
```

del usuario autenticado como frontera del tenant.

El cliente no controla `companyId` mediante el DTO.

También se valida tenant ownership para:

```text
Product
InventoryBatch
EquipmentAsset
```

según corresponda.

---

## Error Handling

Durante esta implementación se validaron respuestas explícitas:

```text
400 Bad Request
→ invalid DTO
→ incompatible Product tracking
→ invalid business input

404 Not Found
→ missing Equipment
→ missing Product
→ invalid Batch relationship

409 Conflict
→ duplicate assetCode
→ duplicate normalized serial
```

Los conflictos esperados no deben convertirse en errores `500`.

---

## Equipment QA

La baseline final fue validada mediante QA manual sobre:

```text
GET equipment
GET equipment by ID
valid Equipment creation
duplicate assetCode
duplicate normalized serial
QUANTITY Product rejection
nonexistent Equipment
invalid DTO
optional serialNumber
assetCode normalization
protected operational fields during development
```

Durante el desarrollo se exploró temporalmente:

```text
PATCH /equipment/:id
```

para validar normalización y protección de campos.

Después de revisar las reglas de identidad del dominio, dicho endpoint fue retirado antes del cierre de la baseline.

Por tanto:

```text
PATCH /equipment/:id
→ NOT part of the final v1.3.0 contract
```

---

## Automated Tests

Estado final de Equipment:

```text
EquipmentService
8 / 8 PASS

EquipmentController
4 / 4 PASS

Equipment total
12 / 12 PASS
```

Regression suite completa del backend:

```text
Test Suites
28 / 28 PASS

Tests
124 / 124 PASS
```

Quality Gates:

```text
Prisma migrate status
→ Database schema up to date

Prisma validate
→ PASS

Prisma generate
→ PASS

npm test
→ PASS

npm run build
→ PASS

ESLint
→ PASS
```

---

## Healthcare Equipment Boundary

Se eliminó la duplicación documental entre Core y Healthcare.

La responsabilidad vigente es:

```text
ERP/Core Equipment
→ physical identity
→ Product relationship
→ assetCode
→ serial
→ lifecycle
→ condition
→ retirement
```

Healthcare conserva responsabilidad sobre:

```text
Equipment Requirement
Case Equipment Assignment
Preparation
Dispatch
Custody
Return
Inspection context
Availability for Case
Case Equipment history
```

Debe mantenerse:

```text
EquipmentAsset
→ one Core identity

Healthcare
→ consumes that identity
```

---

## Equipment Architecture Principles Established

Quedaron formalizadas las siguientes separaciones:

```text
Product
≠
EquipmentAsset
```

```text
Lifecycle
≠
Condition
```

```text
Condition
≠
Availability
```

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

```text
Inspection GOOD
≠
Available
```

```text
Missing
≠
Lost
```

Estas reglas constituyen la base para la futura integración de Equipment con Zaping Healthcare.

---

## Resultado de agosto 2026

Al cierre de esta baseline:

```text
Documentation Architecture Refactor
→ COMPLETED

Core Equipment Domain
→ APPROVED

Equipment Persistence Baseline
→ IMPLEMENTED

Equipment Registration / Read Backend
→ IMPLEMENTED

Equipment Automated Tests
→ PASS

Healthcare Equipment Boundary
→ APPROVED

Equipment Operational Workflows
→ NOT YET IMPLEMENTED
```

Los siguientes workflows deberán construirse como operaciones explícitas de dominio y no como extensiones indiscriminadas de un CRUD.


## Documentation Architecture Refactor

**Estado:** En progreso
**Inicio:** 2026-08

Se inició una reconstrucción completa de la documentación oficial de Zaping para eliminar:

* documentos vacíos;
* duplicados;
* fuentes contradictorias;
* arquitectura obsoleta;
* documentación fragmentada por Sprint;
* reglas históricas presentadas como vigentes.

Se adoptó el principio:

> **Una verdad → un documento responsable.**

---

## Product Documentation

Se consolidaron:

```text
product/PRODUCT_VISION.md
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md
```

El producto quedó estructurado conceptualmente como:

```text
Zaping Platform
├── Zaping ERP Core
├── Zaping Healthcare
├── Zaping Radar
└── Zaping AI
```

Healthcare se mantiene como la primera vertical especializada.

---

## Architecture Documentation

Se consolidó:

```text
architecture/ARCHITECTURE.md
```

y la arquitectura C4:

```text
C1 — System Context
C2 — Containers
C3 — Components
```

Se retiraron documentos arquitectónicos vacíos o redundantes.

---

## ADR Consolidation

Los ADR fueron reorganizados bajo:

```text
docs/architecture/adr/
```

Se reconstruyeron decisiones históricas inconsistentes y se añadieron decisiones necesarias para la arquitectura actual.

El catálogo vigente comprende:

```text
ADR-001 Multi-Tenant
ADR-002 Inventory Movements
ADR-003 Global Soft Delete — SUPERSEDED
ADR-004 UUID Strategy
ADR-005 Layered Architecture
ADR-006 API First
ADR-007 RBAC
ADR-008 Documentation First
ADR-009 Modular Monolith
ADR-010 Quote → Sale — SUPERSEDED
ADR-011 SalesOrder + Delivery
ADR-012 Entity Lifecycle Strategy
ADR-013 Inventory Custody & Case Logistics
```

---

## Engineering Documentation

Se consolidaron:

```text
ENGINEERING_GUIDE.md
DEVELOPMENT_WORKFLOW.md
QUALITY_STANDARDS.md
SECURITY_PRINCIPLES.md
API_GUIDELINES.md
```

Se corrigió la separación entre:

```text
Quality
```

y:

```text
Security
```

que anteriormente se encontraban duplicadas.

---

## UX Documentation

Se consolidaron:

```text
ux/DESIGN_SYSTEM.md
ux/BUSINESS_COMPONENTS.md
product/ZAPING_WAY.md
```

Se formalizó como principio de experiencia:

> **Simple por defecto. Poderoso cuando se necesita.**

Y:

```text
Data
↓
Context
↓
Action
```

como dirección general de UX.

---

## ERP Core Documentation

La documentación funcional fue reorganizada bajo:

```text
docs/modules/erp/
```

con fuentes únicas para:

```text
AUDIT
COMPANIES
CUSTOMERS
DASHBOARD
IDENTITY_ACCESS
INVENTORY
PRODUCTS
PURCHASES
QUOTES
RETURNS
SALES
SUPPLIERS
```

Se eliminaron las antiguas carpetas y documentos fragmentados de Purchases, Inventory y Returns.

---

# 4. 2026-07 — Purchase Receipts & Advanced Inventory

## Estado

Implementado y validado en el proyecto.

---

## Objetivo

Separar correctamente:

```text
lo ordenado
```

de:

```text
lo físicamente recibido
```

y preparar Inventory para trazabilidad avanzada de suministros médicos.

---

## PurchaseReceipt

Se introdujo el concepto:

```text
Purchase
↓
PurchaseReceipt
```

para registrar lo que realmente llega al almacén.

---

## Nueva regla de inventario

La arquitectura cambió de:

```text
Purchase approved
↓
Inventory IN
```

a:

```text
Purchase confirmed
↓
no inventory effect

PurchaseReceipt registered
↓
Inventory IN
```

Esta decisión reemplaza oficialmente el comportamiento implementado durante etapas anteriores.

---

## Partial Receipts

Purchases evolucionó para soportar:

```text
CONFIRMED
↓
PARTIALLY_RECEIVED
↓
RECEIVED
```

permitiendo múltiples recepciones sobre una misma compra.

---

## Validación de cantidades

Se estableció:

```text
quantityReceived
<=
quantityPending
```

y se bloqueó la recepción por encima de lo ordenado.

---

## InventoryBatch

Se incorporó soporte para existencia por lote.

Conceptualmente:

```text
Product
↓
InventoryBatch
```

con información como:

```text
lotNumber
expirationDate
availableQuantity
unitCost
```

según la implementación vigente.

---

## Captura de lote

Se formalizó que:

```text
Purchase
→ no conoce necesariamente lote/caducidad
```

mientras:

```text
PurchaseReceipt
→ conoce lo realmente entregado
```

Por tanto lote y caducidad se capturan durante la recepción.

---

## Inventory Integration

Registrar una recepción válida puede producir dentro de una transacción:

```text
PurchaseReceipt
+
PurchaseReceiptItems
+
InventoryBatch
+
InventoryMovement IN
+
Stock update
+
Purchase status update
```

---

## Validaciones adicionales

Se incorporaron reglas como:

```text
expirationDate
→ requires lotNumber
```

y protección contra fechas de caducidad inválidas respecto de la recepción.

---

## Frontend

Se implementó flujo de recepción con:

* cantidades ordenadas;
* cantidades recibidas;
* cantidades pendientes;
* captura de lote;
* captura de caducidad;
* notas;
* validaciones;
* actualización posterior del listado.

---

## QA

La funcionalidad fue validada mediante:

* tests;
* lint;
* build;
* pruebas manuales;
* validaciones transaccionales.

---

# 5. Sprint 10 — Advanced Inventory

## Estado histórico

Originalmente planeado.

Gran parte de la arquitectura planteada durante este Sprint posteriormente fue implementada mediante Purchase Receipts e InventoryBatch.

---

## Objetivo original

Fortalecer Inventory para conocer:

```text
qué producto existe
cuánto existe
de qué lote proviene
cuándo caduca
de qué compra entró
qué movimientos afectaron el stock
```

---

## Decisiones que permanecen vigentes

Se establecieron correctamente estas fronteras:

```text
Product
→ catálogo maestro
```

```text
InventoryBatch
→ existencia por lote
```

```text
Purchase
→ qué se pidió
```

```text
PurchaseReceipt
→ qué llegó
```

```text
InventoryMovement
→ qué modificó el inventario
```

---

## Decisiones que evolucionaron

El Sprint planteaba todavía como trabajo futuro varias capacidades.

Posteriormente:

```text
PurchaseReceipt
InventoryBatch
partial receipts
lot capture
expiration capture
```

avanzaron a implementación.

Otras capacidades continúan como evolución:

```text
FEFO
serial tracking
automatic expired-stock blocking
QR / barcode workflows
advanced audit
multi-warehouse
```

---

# 6. Sprint 09 — Purchases & Business Components

## Estado

Completado.

---

## Objetivo

Fortalecer la base frontend mediante componentes reutilizables y completar el primer flujo funcional de Purchases.

---

## Business Components

Durante esta etapa se reportaron como completados componentes reutilizables relacionados con:

```text
StatusBadge
MoneyInput
SupplierSelector
ProductSelector
```

La numeración histórica de los Business Components posteriormente fue reorganizada durante la consolidación documental.

La fuente vigente es:

```text
ux/BUSINESS_COMPONENTS.md
```

---

## Purchases

Se completaron capacidades como:

```text
Create Purchase
Edit Draft Purchase
Approve Purchase
Purchase Detail
Purchase PDF
Inventory traceability
```

---

## Calidad

El cierre registró:

```text
Frontend tests
Frontend lint
Frontend build
Backend build
Purchases ESLint
Inventory ESLint
Manual endpoint validation
Manual UI validation
```

como aprobados.

---

## Arquitectura histórica importante

En Sprint 09 el flujo implementado era:

```text
Create Purchase
↓
Edit Draft
↓
Approve Purchase
↓
Inventory IN
↓
InventoryMovement IN
```

Este comportamiento es un **hecho histórico**.

No representa la arquitectura vigente.

---

## Superseded

Posteriormente fue reemplazado por:

```text
Create Purchase
↓
Confirm Purchase
↓
Receive Merchandise
↓
PurchaseReceipt
↓
Inventory IN
```

La fuente vigente de esta regla es:

```text
modules/erp/PURCHASES.md
modules/erp/INVENTORY.md
ADR-002
```

---

# 7. Foundation v1.0

## Estado

Released.

## Fecha

2026-07.

---

## Propósito

Foundation v1.0 estableció la primera línea base formal de:

```text
Product
Architecture
Engineering
Security
Quality
Documentation
ADR
```

para Zaping.

La release no estuvo enfocada principalmente en agregar nueva funcionalidad empresarial, sino en establecer una base de ingeniería sostenible.

---

## Entregables originales

Incluyó la formalización inicial de:

### Product

```text
Vision
Product Requirements
```

### Engineering

```text
Software Design
Engineering Guide
Development Workflow
Quality Standards
Security Principles
```

### Architecture

```text
Architecture Overview
C4
ADR Framework
Foundation ADRs
```

### Documentation

```text
Glossary
Templates
API Documentation Framework
```

---

## Principios establecidos

La Foundation formalizó principios como:

```text
API First
Multi-Tenant
Layered Architecture
Modular Monolith
Documentation First
Security by Design
Business Driven Development
```

Estos principios continúan formando la base arquitectónica de Zaping.

---

## Evolución posterior

La documentación de Foundation fue posteriormente consolidada y corregida.

Algunas decisiones iniciales cambiaron.

Ejemplos importantes:

```text
Global Soft Delete
→ superseded by Entity Lifecycle Strategy
```

```text
Quote → Sale
→ superseded by SalesOrder + Delivery
```

y:

```text
Purchase Approval → Inventory
→ superseded by PurchaseReceipt → Inventory
```

---

# 8. Primer ERP Core

Antes de la reconstrucción documental de 2026-08, Zaping ya había alcanzado una base funcional con módulos como:

```text
Companies
Customers
Products
Suppliers
Inventory
Purchases
Quotes
Sales
Dashboard
Authentication
```

con PostgreSQL, Prisma, NestJS y Next.js como base tecnológica.

---

# 9. Principales cambios arquitectónicos acumulados

Durante la evolución del proyecto se formalizaron separaciones importantes.

---

## Purchases

Antes:

```text
Purchase
→ Inventory
```

Ahora:

```text
Purchase
→ PurchaseReceipt
→ Inventory
```

---

## Sales

Antes:

```text
Quote
→ Sale
→ Inventory OUT
```

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

---

## Entity Lifecycle

Antes se proponía:

```text
global deletedAt
```

para múltiples recursos.

Ahora:

```text
Master Data
→ active / inactive

Transactional Documents
→ lifecycle states

Historical Ledgers
→ immutable

Temporary Data
→ delete / expire when appropriate
```

---

## Healthcare Inventory

Se formalizó:

```text
CaseDispatch
≠
commercial Delivery
```

y:

```text
CaseDispatch
≠
definitive Inventory OUT
```

para permitir custodia temporal y reconciliación posterior.

---

# 10. Correcciones documentales históricas

Durante la consolidación de 2026-08 se detectaron y corrigieron inconsistencias como:

* documentación duplicada;
* archivos vacíos;
* nombres incorrectos;
* ADR duplicados;
* ADR con títulos incorrectos;
* documentación API desactualizada;
* `QUALITY_STANDARS` mal escrito;
* documentación de Soft Delete incompatible con el modelo real;
* reglas antiguas de Purchase → Inventory;
* documentación de Sales basada únicamente en Sale;
* documentación de Returns dependiente de la frontera legacy;
* templates con metadata copiada de Inventory.

---

# 11. Versionado

Las versiones históricas de documentación no deben interpretarse automáticamente como versiones comerciales del producto.

Ejemplo:

```text
Foundation v1.0
```

representa una línea base de arquitectura/documentación.

La estrategia formal de releases comerciales deberá mantenerse en `ROADMAP.md` y en futuros releases reales.

---

# 12. Regla de actualización

Cuando una funcionalidad sea completada:

```text
PROJECT_BOARD
↓
Completed
↓
CHANGELOG
```

Cuando una decisión arquitectónica cambie:

```text
New ADR
↓
Old ADR superseded
↓
CHANGELOG records transition
```

Cuando un plan deje de ser futuro:

```text
ROADMAP
↓
implemented
↓
CHANGELOG
```

---

# 13. Fuente de verdad

```text
CHANGELOG.md
→ historia consolidada

PROJECT_BOARD.md
→ estado actual

ROADMAP.md
→ dirección futura

ADR
→ decisiones arquitectónicas

modules/
→ comportamiento funcional vigente
```

---

# 14. Principio final

El Changelog debe conservar la historia sin convertir decisiones antiguas en reglas actuales.

Por tanto:

> **Registrar que Zaping funcionó de una manera en el pasado no significa que esa arquitectura siga vigente hoy.**

La historia debe conservarse.

La fuente vigente debe mantenerse clara.
