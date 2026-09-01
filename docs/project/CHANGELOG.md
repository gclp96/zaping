# Changelog — Zaping

**Documento:** Historial consolidado del proyecto
**Versión:** 1.3.0
**Estado:** Activo
**Última actualización:** 2026-09-01
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento conserva la historia relevante de evolución de Zaping.

Su función es responder:

```text
¿Qué se construyó?

¿Qué cambió?

¿Qué decisiones anteriores fueron sustituidas?

¿Cuándo evolucionó la arquitectura?

¿Qué limitaciones existían al cierre de cada entrega?

¿Qué problemas fueron resueltos posteriormente?
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

Una deuda registrada dentro de una entrega histórica puede haber sido resuelta posteriormente.

Cuando esto ocurra, el Changelog debe conservar el hecho histórico y aclarar su evolución.

---

# 2. Regla documental

```text
CHANGELOG
→ lo que ocurrió

PROJECT_BOARD
→ lo que estamos haciendo

ROADMAP
→ hacia dónde queremos evolucionar
```

Una funcionalidad completada debe dejar de vivir únicamente en un Sprint, ticket o backlog temporal y pasar a formar parte de la historia consolidada del proyecto.

El Changelog puede conservar:

```text
snapshots históricos de tests
QA manual
migraciones
bugs encontrados
decisiones superseded
deuda existente al cierre de una entrega
```

sin convertir esos hechos históricos en reglas vigentes.

---

# 3. 2026-08 — ERP Core, Equipment, Healthcare Foundation y consolidación documental

## 3.16 Auth + Users V1 closure — ERP-V1-CLOSE-B1C

**Estado:** IMPLEMENTED / VALIDATED
**Fecha:** 2026-09-01

Se consolidó Identity & Access para Users V1:

```text
secure Users V1 backend
ADMIN-only user administration
tenant-safe Users API
GET /users
GET /users/:id
POST /users
PATCH /users/:id
activate/deactivate through PATCH isActive
last active ADMIN protection
DB-backed active/current-role revalidation
Users frontend at /users
responsive Users management
```

También se retiró el reset-password inseguro anterior.

Secure password recovery no fue anunciado como implementado. Queda pendiente
para `ERP-V1-CLOSE-B1D`.

---

## 3.0 Purchase 360 canonical detail closure — UX-03.5C4F

**Estado:** IMPLEMENTED / VALIDATED
**Fecha:** 2026-08-31

Se cerró la migración de Purchases hacia una superficie dedicada de detalle:

```text
Purchase List
↓
/purchases/:id
↓
Purchase 360
```

El cierre consolidó:

```text
dedicated Purchase 360
canonical folio navigation
simplified row actions
timezone-aware Desde / Hasta filters
Receipt Detail → Ver compra → /purchases/:id
retired PurchaseDetailModal
safe receipt-preparation hook
```

La URL histórica:

```text
/purchases?purchaseId=<id>
```

quedó limitada a compatibility redirect temporal hacia `/purchases/<id>`.
No representa una segunda UI/API de detalle.

No hubo cambios backend, Prisma ni contrato API.

---

## 3.1 ERP Core Functional Normalization — H7

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

H7 cerró la normalización funcional, operacional y de navegación del ERP Core sobre el modelo actual.

Se consolidaron:

```text
Authenticated App Shell
grouped navigation
Dashboard 2.0 backed by real API data

Customers lifecycle
Suppliers lifecycle

Products V1
Inventory Movement Ledger V1
Equipment V1

Quotes V1
Sales V1

Purchases V1
Purchase Receipts V1
```

Se completaron las fases finales:

```text
H7A0
→ Sales detail deep-link

H7A
→ Quotes normalization
→ Quote → Sale handoff

H7B
→ Purchases normalization
```

Handoffs y deep-links consolidados:

```text
Quote
→ created Sale
→ /sales?saleId=<id>

Purchase
→ Receipt
→ /purchase-receipts/<id>

Receipt
→ Purchase
→ /purchases/<id>

Receipt
→ Inventory movements
→ /inventory?tab=movements
  &referenceType=PURCHASE_RECEIPT
  &referenceId=<id>

Receipt
→ Equipment
→ /equipment?assetId=<id>
```

El detalle de Sales continuó utilizando el modal existente y se añadió soporte direccionable mediante:

```text
/sales?saleId=<id>
```

sin introducir una nueva ruta `/sales/[id]`.

La normalización final de Quotes incorporó:

```text
search
status filter
loading
error
retry
empty states
structured action errors
Quote → Sale success state
generated Sale folio visibility
Ver venta
double-conversion protection
```

La normalización final de Purchases incorporó:

```text
search
status filter
Supplier filter
combined filtering
filter reset
loading
error
retry
empty states
structured action errors
```

sin modificar el backend ni romper Purchase Receipts.

Snapshot frontend registrado al cierre de H7B:

```text
29 test files

402 / 402 tests PASS

frontend build
PASS

full frontend ESLint
PASS

git diff --check
PASS
```

H7 no presentó como implementados los workflows operacionales futuros de Healthcare.

---

## 3.2 Purchase Receipts V1 Hardening

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Purchase Receipts evolucionó desde una recepción funcional básica hacia un dominio con reglas explícitas de lote, idempotencia, trazabilidad y experiencia frontend propia.

### Lot Tracking Enforcement

Se formalizaron las reglas de:

```text
ProductLotTracking

NONE
OPTIONAL
REQUIRED
```

Contrato implementado:

```text
NONE
→ no permite lotNumber
→ no permite expirationDate

OPTIONAL
→ puede recibirse sin lote
→ expirationDate requiere lotNumber

REQUIRED
→ lotNumber obligatorio
→ expirationDate opcional
```

Esto resolvió la deuda histórica de enforcement general de `ProductLotTracking` dentro del flujo de Purchase Receipts.

La semántica operacional de:

```text
ProductInventoryTracking.SERIALIZED
```

permanece como una deuda independiente.

---

### Idempotencia

`POST /purchase-receipts` evolucionó para exigir:

```text
Idempotency-Key
```

Reglas:

```text
key
→ trimmed
→ non-empty
→ maximum 128 characters
```

Scope:

```text
PURCHASE_RECEIPT_CREATE
```

Identidad:

```text
companyId
+
scope
+
key
```

Hash:

```text
normalized request payload
→ SHA-256 requestHash
```

Comportamiento:

```text
same key + same payload
→ replay existing Receipt

same key + different payload
→ 409 Conflict

same key in another Company
→ independent identity
```

El claim idempotente y las mutaciones de Receipt se integraron dentro de una transacción Prisma con aislamiento:

```text
Serializable
```

La recuperación de una colisión `P2002` se realiza después de finalizar la transacción abortada.

No se continúan consultas dentro de una transacción PostgreSQL que haya fallado.

Se cubrió automáticamente:

```text
replay
payload conflict
tenant isolation
rollback
P2002 recovery path
```

La idempotencia de Purchase Receipts dejó de ser deuda funcional.

Permanece como deuda de validación:

```text
real simultaneous PostgreSQL concurrency race QA
```

---

### Traceability Read Model

El detalle de Receipt evolucionó para exponer un grafo tenant-scoped:

```text
Receipt
├── Purchase
│   └── Supplier
├── receivedByUser
├── Items
│   ├── Product
│   ├── Batch
│   └── EquipmentAssets
└── InventoryMovements
```

Los movimientos se obtienen por referencia exacta:

```text
referenceType = PURCHASE_RECEIPT
referenceId   = Receipt.id
```

---

### Dedicated Frontend

Se implementaron rutas dedicadas:

```text
/purchase-receipts

/purchase-receipts/<id>
```

La lista presenta información operacional como:

```text
Folio
Compra
Proveedor
Fecha
Responsable
Partidas
Unidades
```

El detalle presenta:

```text
General
Compra / Proveedor
Items
Inventory Movements
Equipment Assets
```

---

### Purchase → Receipt Handoff

Después de crear una recepción, el frontend dejó de limitarse a cerrar el modal.

Se añadió un success state estable:

```text
Recepción registrada correctamente

<folio>

[Ver recepción]
[Cerrar]
```

El `id` y `folio` proceden de la respuesta real del backend.

La navegación utiliza:

```text
/purchase-receipts/<id>
```

---

### Cross-Module Traceability

Se conectaron:

```text
Purchase → Receipt
Receipt → Purchase
Receipt → Inventory
Receipt → Equipment
```

El sistema comenzó a ofrecer trazabilidad navegable, no únicamente relaciones persistidas en base de datos.

---

## 3.3 Products V1 Normalization

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Products V1 quedó alineado con su frontera de catálogo.

Se consolidó:

```text
Brand display

Category selector

tenant-safe Category validation

inventoryTracking
lotTracking

tracking selectable on create

tracking read-only on normal edit

current stock read-only

minStock editable

active Product list

non-destructive Product deactivation

responsive table / form behavior
```

Product CRUD dejó de aceptar:

```text
stock
```

como mutación arbitraria.

Product nuevo utiliza:

```text
stock = 0
```

según default backend/Prisma.

El `PATCH` normal dejó de permitir cambios arbitrarios de:

```text
inventoryTracking
lotTracking
```

cuando ya existe historia operacional.

`GET /products/:id` quedó tenant-scoped mediante:

```text
findOne(companyId, productId)
```

La ruta:

```text
GET /products/low-stock
```

se ubicó antes de la ruta dinámica `/:id` para evitar shadowing.

`DELETE /products/:id` adoptó semántica de desactivación:

```text
isActive = false
```

de forma idempotente.

No existe:

```text
hard delete
reactivation workflow
```

en Products V1.

Snapshot histórico registrado durante esta entrega:

```text
Products backend regression snapshot

43 suites
413 tests PASS

Products frontend

14 tests PASS
```

Durante una QA anterior de Sales se había detectado:

```text
GET /products/:id
→ 404 Producto no encontrado

para un Product visible mediante otras APIs
```

Ese hallazgo fue posteriormente resuelto durante Products V1 mediante la normalización tenant-safe del detalle.

---

## 3.4 Inventory Movement Ledger V1

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

`/inventory` incorporó:

```text
Existencias
Movimientos
```

El ledger expone:

```text
fecha
Product
movement type
quantity
balance posterior
reference
notes
```

Tipos:

```text
IN
OUT
ADJUSTMENT
```

Se incorporaron:

```text
client-side search
movement type filter
filtered empty states
independent loading/error/retry
```

Mapeos de referencia:

```text
PURCHASE_RECEIPT
→ Recepción de compra

SALE
→ Venta

PURCHASE
→ Compra

null
→ Movimiento manual
```

QA real verificó:

```text
Purchase Receipt
→ InventoryMovement IN

Sale approval
→ InventoryMovement OUT
```

con balances y referencias coincidentes con API.

No se añadió durante esta fase:

```text
manual adjustment creation
backend pagination
server-side filtering
date-range filtering
```

Snapshot histórico:

```text
Inventory frontend

23 tests PASS
```

---

## 3.5 Equipment V1 Frontend

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Se completó `/equipment` dentro de:

```text
INVENTARIO
```

con:

```text
list
search
lifecycle filters
condition filters
origin filters
detail
Current Availability
inspection history
inspection registration
manual Equipment creation
terminal retirement
deep-link
```

La creación manual utiliza:

```text
active ASSET Products
productId
condition
serialNumber?
```

y deja al servidor:

```text
assetCode
companyId
lifecycle
origin
audit facts
```

`batchId` no se expuso mientras no existiera un selector seguro.

El retiro utiliza:

```text
retiredReason
retirementNotes?
```

`OTHER` requiere notas útiles.

Retirement:

```text
preserves EquipmentAsset
preserves identity
preserves Product
preserves condition
preserves history

changes lifecycle
→ RETIRED
```

Equipment retirado no admite nuevas inspecciones.

No se añadió:

```text
DELETE
reactivation
generic PATCH
```

QA registrada:

```text
Equipment list / detail
PASS

Inspection workflow
PASS

Manual creation
PASS

Retirement workflow
PASS
```

Snapshot frontend histórico:

```text
Equipment
61 tests PASS

Full frontend
25 files
336 tests PASS

build
PASS

lint
PASS

git diff --check
PASS
```

---

## 3.6 Sales V1 Frontend y endurecimiento del modelo Sale actual

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Sales V1 completó el frontend actual de:

```text
/sales
```

sobre el backend `Sale` existente.

La implementación V1 conserva la dirección futura:

```text
SalesOrder
≠
Delivery
```

sin bloquear el funcionamiento actual.

Implementado:

```text
/sales route

COMERCIAL navigation

Sales list

search by folio / customer

status filter

loading
error
retry

empty states
filtered empty states

Nueva venta

Customer selection

generic-Sales-compatible Product selection

stock visibility

read-only current price

quantity

item add/remove

duplicate prevention

subtotal

IVA 16 %

total preview

POST /sales

list refresh

Sale detail modal

GET /sales/:id

DRAFT approve

DRAFT cancel

PDF blob download

terminal-state action visibility
```

---

### Tenant-Safe Detail

Se expuso:

```text
GET /sales/:id
```

mediante:

```text
JwtAuthGuard

req.user.companyId

ParseUUIDPipe

SalesService.findOne(companyId, id)
```

Missing o cross-tenant:

```text
Venta no encontrada
```

La respuesta incluye:

```text
customer
items.product
```

No requirió cambios de Prisma schema.

---

### Generic Sales Eligibility

Backend permite:

```text
QUANTITY + NONE

QUANTITY + OPTIONAL
```

y rechaza:

```text
QUANTITY + REQUIRED

non-QUANTITY inventory tracking
```

Esta regla aplica a:

```text
direct Sale create
Sale approval
Quote → Sale conversion
```

Frontend filtra productos incompatibles para UX, pero backend permanece como fuente de verdad.

Generic Sales no implementa:

```text
EquipmentAsset selection
serialized picking
required-lot picking
lot allocation
Equipment dispatch
Healthcare Assignment
```

---

### Sales Folios

La generación nueva dejó de usar:

```text
V-${Date.now()}
```

y adoptó:

```text
V-000001
V-000002
...
```

mediante:

```text
SalesFolioService
→ CompanySequenceAllocatorService

key = SALE_FOLIO
```

Reglas:

```text
server-generated

tenant-scoped

sequential

minimum six digits

no fixed six-digit maximum

immutable

cancelled/historical folios remain occupied

legacy timestamp-style folios remain unchanged
```

Direct Sale y Quote-converted Sale utilizan la misma secuencia.

---

### Inventory Semantics

```text
Direct Sale create
→ DRAFT
→ no stock mutation

DRAFT approve
→ CONFIRMED
→ Product.stock decrement
→ InventoryMovement OUT

DRAFT cancel
→ CANCELLED
→ no stock mutation
→ no InventoryMovement
```

Confirmed Sale reversal continúa fuera de Sales V1.

---

### Manual QA

Se validó:

```text
ASSET Product
→ rejected from generic Sales

compatible QUANTITY + OPTIONAL Product
→ created as DRAFT
→ stock unchanged

sequential Sale folios
→ observed

cancelled folios
→ not reused
```

QA de Sale V-000011:

```text
Customer
→ Miguel Sahuaro

Product
→ LF1837 / BLUNT TIP

quantity
→ 1

subtotal
→ 215

IVA
→ 34.4

total
→ 249.4

status
→ DRAFT
```

Approval:

```text
stock
50 → 49

status
DRAFT → CONFIRMED

InventoryMovement OUT
quantity 1
balance 49
```

Cancelación DRAFT independiente:

```text
status
→ CANCELLED

stock
→ unchanged

InventoryMovement
→ none
```

---

### Deep-Link de Sales

Posteriormente, durante H7A0, se añadió:

```text
/sales?saleId=<id>
```

para abrir directamente el modal de detalle existente.

No se creó:

```text
/sales/[id]
```

---

### Quote → Sale Handoff

Durante H7A, Quotes comenzó a consumir la Sale real devuelta por:

```text
POST /sales/from-quote/:quoteId
```

incluyendo:

```text
id
folio
```

Después de convertir:

```text
Venta creada correctamente

V-XXXXXX

[Ver venta]
```

navega hacia:

```text
/sales?saleId=<Sale.id>
```

Las Quotes históricas convertidas continúan sin poder navegar a la Sale original porque el contrato de lectura actual no expone su identidad.

---

### PDF

```text
GET /sales/:id/pdf
```

Frontend:

```text
responseType = blob
```

Nombre:

```text
venta-{folio}.pdf
```

Estado histórico:

```text
IMPLEMENTED / AUTOMATED
```

La verificación manual del navegador permanecía pendiente en el snapshot original de esta entrega.

---

### Snapshot de validación

```text
Backend Sales tests
76 PASS

Shared sequence regressions
32 PASS

Full backend
41 suites
374 tests PASS

Prisma validate
PASS

backend build
PASS

backend lint
PASS

Frontend Sales
40 tests PASS

Navigation
29 tests PASS

Full frontend
20 files
240 tests PASS

frontend build
PASS

frontend lint
PASS

git diff --check
PASS
```

---

## 3.7 Healthcare Case Foundation

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Healthcare Case Foundation incorporó el root persistido:

```text
HealthcareCase
HealthcareCaseStatus
```

Campos:

```text
id
companyId
folio
title
procedureDescription
status
scheduledStart
scheduledEnd
responsibleUserId
createdById
cancelledAt
cancelledById
cancellationReason
createdAt
updatedAt
```

Migración:

```text
20260824162849_add_healthcare_case_foundation
```

Características:

```text
focused migration
no reset
no unrelated destructive SQL
```

Relaciones con política audit-preserving:

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

---

### Folios

```text
CASE-000001
CASE-000002
...
```

Reglas:

```text
server-generated
immutable
tenant-scoped
minimum six digits
historical/cancelled folios remain occupied
```

Sequence key:

```text
HEALTHCARE_CASE_FOLIO
```

Se extrajo infraestructura compartida:

```text
src/company-sequences

CompanySequenceAllocatorService

allocateNext(
  tx,
  companyId,
  key
)
```

con:

```text
caller-owned transaction
race-safe bootstrap
atomic nextValue increment
numeric allocation only
```

Equipment conserva ownership sobre:

```text
EQ-
```

Healthcare Case conserva ownership sobre:

```text
CASE-
```

---

### Lifecycle

Implementado:

```text
DRAFT
SCHEDULED
CANCELLED
```

Derivación:

```text
scheduledStart exists
→ SCHEDULED

scheduledStart absent
→ DRAFT
```

`CANCELLED` es terminal en Foundation.

No existen todavía:

```text
IN_PROGRESS
COMPLETED
RETURN_PENDING
RECONCILIATION_PENDING
DISPATCHED
```

---

### API

```text
POST /healthcare/cases

GET /healthcare/cases

GET /healthcare/cases/:caseId

PATCH /healthcare/cases/:caseId

POST /healthcare/cases/:caseId/cancel
```

No existe:

```text
DELETE
complete command
reopen command
```

---

### Create Transaction

Contiene:

```text
creator validation

responsible-user validation when supplied

CompanySequence allocation

HealthcareCase create
```

Creator y responsible user se validan con:

```text
id
companyId
isActive
```

Tenant y actor provienen del contexto autenticado.

---

### PATCH Semantics

```text
omitted / undefined
→ retain existing value

explicit null where allowed
→ clear value

schedule validation
→ merged final state
```

Durante B.4.1 se detectó:

```text
schedule-only PATCH
+
title omitted
→ 400 El título del caso es obligatorio
```

Root cause:

```text
undefined
→ incorrectly interpreted as supplied value
```

Fix:

```text
undefined / omitted
→ preserve persisted value

explicit supplied value
→ normalize and apply
```

Manual retest:

```text
PASS
```

---

### Cancellation

```text
DRAFT
→ CANCELLED

SCHEDULED
→ CANCELLED
```

`cancellationReason`:

```text
required
trimmed
```

Audit:

```text
cancelledAt
→ server generated

cancelledById
→ authenticated User
```

Schedule y datos de planeación se preservan.

---

### PHI Boundary

HealthcareCase no almacena:

```text
patient name
patient identifiers
diagnosis
medical history
clinical notes
clinical record fields
```

Hospital y Doctor quedaron diferidos como master data Healthcare de primera clase.

Foundation no incluye:

```text
Equipment Assignment
Equipment Requirement
CaseKit
Dispatch
Custody
Return
Inventory state
Billing
Insurance
```

---

### RBAC

```text
POST
→ ADMIN / MANAGER / SALES

GET
→ ADMIN / MANAGER / SALES / WAREHOUSE

PATCH
→ ADMIN / MANAGER / SALES

CANCEL
→ ADMIN / MANAGER
```

---

### Snapshot de validación

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

Manual QA:

```text
CASE-000001 / CASE-000002 generation
PASS

GET one
PASS

GET list
PASS

DRAFT → SCHEDULED
PASS

reschedule
PASS

invalid schedule rejected without mutation
PASS

SCHEDULED → DRAFT
PASS

reschedule again
PASS

SCHEDULED → CANCELLED
PASS

PATCH CANCELLED
→ 409 PASS

second cancel
→ 409 PASS

cancellation audit preservation
PASS
```

Límites de QA:

```text
manual real second-company cross-tenant QA
→ NOT PERFORMED

real simultaneous cancellation race QA
→ NOT PERFORMED
```

Healthcare Case create idempotency permaneció sin implementar:

```text
same logical create submitted twice
→ two valid Cases
→ two folios
```

Esto es comportamiento esperado de la API no idempotente actual y no representa un bug de secuencia.

En el momento de esta entrega, Purchase Receipt idempotency todavía no estaba disponible.

Posteriormente fue implementada durante Purchase Receipts V1 Hardening.

---

## 3.8 Current Equipment Availability — EQ-AVL-001

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Core Equipment incorporó un evaluator de Current Availability para responder:

```text
Can this EquipmentAsset be used now
according to currently implemented
Core Equipment facts?
```

Arquitectura:

```text
equipment-availability.types.ts
→ runtime reason constants
→ derived TypeScript union

equipment-availability.evaluator.ts
→ pure deterministic evaluator
→ lifecycle + condition
→ no Prisma
→ no DB
→ no I/O
→ no clock
→ no evaluatedAt

EquipmentAvailabilityService
→ tenant-safe Equipment lookup
→ invokes evaluator
→ adds evaluatedAt

EquipmentController
→ GET /equipment/:equipmentId/availability
```

Hechos utilizados:

```text
EquipmentAsset.lifecycle
EquipmentAsset.condition
```

Reglas:

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

Reason codes:

```text
RETIRED
INSPECTION_PENDING
DAMAGED
OUT_OF_SERVICE
```

Orden determinístico:

```text
1. RETIRED
2. INSPECTION_PENDING
3. DAMAGED
4. OUT_OF_SERVICE
```

Ejemplo:

```text
RETIRED + DAMAGED

→ available false
→ primaryReason RETIRED
→ reasons [RETIRED, DAMAGED]
```

Availability:

```text
derived
not persisted
not cached
```

---

### Snapshot de validación

```text
Pure evaluator
12/12 PASS

EquipmentAvailabilityService
15/15 PASS

EquipmentController
12/12 PASS

All Equipment tests
100/100 PASS

Full backend
33 suites
216 tests PASS

Prisma validate
PASS

build
PASS

lint
PASS

git diff --check
PASS
```

Manual QA:

```text
ACTIVE + INSPECTION_PENDING
→ unavailable
PASS

Inspection → GOOD
→ available
PASS

GOOD → DAMAGED
→ unavailable
PASS

Retirement
→ primaryReason RETIRED
PASS

nonexistent Equipment
→ 404
PASS
```

Cross-tenant real manual second-company QA no se realizó.

Al cierre de esta entrega todavía estaban pendientes:

```text
Purchase Receipt idempotency
broader ProductLotTracking enforcement
Product.stock ↔ EquipmentAsset reconciliation
serial correction
tenant-safe legacy writes
```

Posteriormente:

```text
Purchase Receipt idempotency
→ IMPLEMENTED

ProductLotTracking NONE / OPTIONAL / REQUIRED
→ IMPLEMENTED for Purchase Receipts
```

Continúan vigentes:

```text
Product.stock ↔ EquipmentAsset reconciliation
serial assignment/correction
tenant-safe legacy write hardening
Case Availability
Custody
Assignment
Maintenance
Calibration
Turnaround
```

---

## 3.9 Purchase Receipt → EquipmentAsset — EQ-PR-001

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Se incorporó provisioning automático de Equipment desde Purchase Receipts para:

```text
Product.inventoryTracking = ASSET
```

Regla:

```text
PurchaseReceiptItem.quantityReceived = N
↓
create exactly N EquipmentAsset
```

No se utiliza:

```text
PurchaseItem.quantity
```

como cantidad de provisioning.

Comportamiento:

```text
QUANTITY
→ no EquipmentAsset

SERIALIZED
→ no EquipmentAsset en esta fase

ASSET
→ EquipmentAsset por unidad recibida
```

Arquitectura:

```text
EquipmentAssetCodeService
→ CompanySequence allocation
→ assetCode formatting
→ collision handling

EquipmentProvisioningService
→ PurchaseReceiptItem lookup
→ tenant-safe provisioning
→ inventoryTracking decision
→ Equipment identity creation

PurchaseReceiptsService
→ receipt orchestration
→ Prisma transaction boundary
```

Flujo:

```text
InventoryBatch create / resolve
↓
PurchaseReceiptItem.create
↓
EquipmentProvisioningService.provisionFromPurchaseReceiptItem(...)
↓
Product.stock += quantityReceived
↓
InventoryMovement IN
↓
Purchase status recalculation
↓
COMMIT
```

Receipt-created Equipment:

```text
lifecycle
→ ACTIVE

condition
→ INSPECTION_PENDING

origin
→ PURCHASE_RECEIPT

serialNumber
→ null

serialNumberKey
→ null

purchaseReceiptItemId
→ preserved

batchId
→ copied when applicable
```

No existe doble incremento:

```text
Product.stock
→ mutated by Purchase Receipt

EquipmentAsset creation
→ does not increment stock again

InventoryMovement
→ no extra movement per EquipmentAsset
```

---

### Snapshot de validación

```text
Purchase Receipt tests
26/26 PASS

Equipment tests
68/68 PASS

Full backend
31 suites
184 tests PASS

Prisma validate
PASS

build
PASS

lint
PASS

git diff --check
PASS
```

Manual PostgreSQL/API QA:

```text
Purchase quantity 5

Receipt A
quantityReceived = 2
→ 2 EquipmentAssets
→ stock 2
→ one IN movement
→ PARTIALLY_RECEIVED

Receipt B
quantityReceived = 3
→ 3 EquipmentAssets
→ stock 5
→ one IN movement
→ RECEIVED

Final
EquipmentAssets = 5
InventoryMovements = 2
Total IN = 5
Product.stock = 5
```

Traceability:

```text
ReceiptItem A
→ exactly 2 EquipmentAssets

ReceiptItem B
→ exactly 3 EquipmentAssets
```

Over-receipt:

```text
Receipt after Purchase RECEIVED
→ 400
→ no stock mutation
→ no extra movement
→ no extra Equipment
```

Rollback:

```text
structurally implemented
unit-tested

manual forced DB provisioning failure
→ NOT PERFORMED
```

Al cierre de EQ-PR-001 estaban pendientes:

```text
Purchase Receipt request idempotency
ProductLotTracking enforcement
Receipt correction/reversal
Product.stock ↔ EquipmentAsset reconciliation
serial correction
SERIALIZED provisioning
tenant-safe write hardening
```

Posteriormente:

```text
Purchase Receipt idempotency
→ IMPLEMENTED

ProductLotTracking NONE / OPTIONAL / REQUIRED
→ IMPLEMENTED for Purchase Receipts
```

Continúan vigentes:

```text
Receipt correction/reversal
Product.stock ↔ EquipmentAsset reconciliation
serial correction
SERIALIZED receipt semantics
tenant-safe legacy write hardening
```

---

## 3.10 Equipment Automatic assetCode — EQ-ASSETCODE-001

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Core Equipment incorporó generación automática de:

```text
assetCode
```

para:

```text
POST /equipment
```

Cambios:

```text
CreateEquipmentDto
→ no longer accepts assetCode

client-provided assetCode
→ rejected by ValidationPipe

CompanySequence
→ tenant-scoped allocation

key
→ EQUIPMENT_ASSET_CODE

format
→ EQ-000001
→ EQ-000002
→ ...
```

La generación ocurre dentro de la misma transacción Prisma que crea `EquipmentAsset`.

Códigos históricos/manuales se verifican antes del insert.

Si un candidato existe:

```text
sequence advances
→ next candidate evaluated
```

Equipment retirado conserva permanentemente su `assetCode`.

Los gaps son aceptados.

No se implementó numeración gapless.

Snapshot:

```text
Equipment tests
42/42 PASS

Backend tests
154/154 PASS

29/29 suites PASS

Prisma validate
PASS

build
PASS

lint
PASS

Real PostgreSQL concurrency QA
PASS
```

No requirió cambios de Prisma schema ni migración.

---

## 3.11 Equipment Inspection Workflow — EQ-INS-001

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Core Equipment incorporó un workflow explícito de inspección.

API:

```text
POST /equipment/:equipmentId/inspections

GET /equipment/:equipmentId/inspections
```

La inspección registra:

```text
conditionBefore
conditionAfter
inspectedById
inspectedAt
notes
```

`conditionBefore` se deriva del estado actual de `EquipmentAsset`.

Resultados finales válidos:

```text
GOOD
DAMAGED
OUT_OF_SERVICE
```

`INSPECTION_PENDING` no representa un resultado final válido de inspección.

Flujo:

```text
Inspection
↓
EquipmentAsset.condition updated atomically
↓
Inspection history preserved
```

Equipment `RETIRED` no admite nuevas inspecciones.

Principio:

```text
Inspection
→ updates Condition

Inspection
≠ direct Availability mutation
```

Availability continúa siendo derivada.

---

## 3.12 Equipment Retirement — EQ-RET-001

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-08

Core Equipment incorporó una operación explícita para retirar activos.

Lifecycle:

```text
ACTIVE
↓
RETIRED
```

`RETIRED` es terminal.

Retirement:

```text
≠ DELETE
```

Datos:

```text
retiredReason
→ required

OTHER
→ retirementNotes required

retirementNotes
→ normalized

retiredAt
→ server generated

retiredById
→ authenticated User
```

Preserva:

```text
condition
assetCode
serialNumber
inspection history
EquipmentAsset identity
```

Bloquea:

```text
new inspections
```

Segundo Retirement:

```text
409 Conflict
```

Concurrent lifecycle change:

```text
409 Conflict
```

No requirió nueva migración Prisma.

Snapshot histórico:

```text
EquipmentService
25/25 PASS

EquipmentController
7/7 PASS

Equipment total
32/32 PASS

Full backend
28 suites
144 tests PASS

Manual QA
PASS

build
PASS

lint
PASS
```

---

## 3.13 Core Equipment Domain

**Estado:** APPROVED / IMPLEMENTED BASELINE
**Periodo:** 2026-08

Durante agosto se formalizó la primera baseline técnica de Core Equipment.

Boundary:

```text
Zaping ERP/Core
→ EquipmentAsset identity
→ lifecycle
→ condition
→ physical asset facts

Zaping Healthcare
→ operational use inside Cases
```

Principios:

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
```

---

### Product Tracking Evolution

Se incorporó:

```text
ProductInventoryTracking

QUANTITY
SERIALIZED
ASSET
```

y:

```text
ProductLotTracking

NONE
OPTIONAL
REQUIRED
```

Principio:

```text
SERIALIZED
≠
ASSET
```

Para:

```text
inventoryTracking = ASSET
```

la identidad física pertenece a:

```text
EquipmentAsset
```

---

### Equipment Persistence

Se incorporaron:

```text
EquipmentAsset
EquipmentInspection
```

Enums:

```text
EquipmentLifecycle

ACTIVE
RETIRED
```

```text
EquipmentCondition

GOOD
INSPECTION_PENDING
DAMAGED
OUT_OF_SERVICE
```

```text
EquipmentOrigin

MANUAL
PURCHASE_RECEIPT
IMPORT
INITIAL_MIGRATION
```

```text
EquipmentRetirementReason

SOLD
LOST
DESTROYED
END_OF_LIFE
REPLACED
OTHER
```

---

### Equipment Identity

```text
Product
→ what the resource/model is

EquipmentAsset
→ which exact physical unit it is
```

EquipmentAsset requiere:

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

para normalización.

Constraints principales:

```text
companyId + assetCode
→ UNIQUE

companyId + productId + serialNumberKey
→ UNIQUE
```

---

### Initial Backend Baseline

El contrato inicial fue:

```text
GET /equipment
GET /equipment/:id
POST /equipment
```

No se incorporó:

```text
DELETE /equipment/:id
```

La ausencia de DELETE protege la historia física del activo.

Tampoco se mantuvo un `PATCH` genérico de Equipment.

Cambios sensibles evolucionaron posteriormente hacia comandos explícitos:

```text
Inspection
Retirement
```

---

### Evolución posterior de la baseline

Al cierre de la baseline inicial:

```text
Equipment operational workflows
→ todavía no implementados
```

Posteriormente, durante agosto de 2026, se añadieron:

```text
Equipment Inspection
→ IMPLEMENTED

Equipment Retirement
→ IMPLEMENTED

Automatic assetCode
→ IMPLEMENTED

Purchase Receipt → EquipmentAsset
→ IMPLEMENTED

Current Availability
→ IMPLEMENTED

Equipment frontend V1
→ IMPLEMENTED
```

Por tanto, la afirmación histórica:

```text
operational workflows not yet implemented
```

aplica únicamente al momento de cierre de la baseline inicial.

---

## 3.14 Healthcare Equipment Boundary

**Estado:** APPROVED
**Periodo:** 2026-08

Se eliminó duplicación conceptual entre Core y Healthcare.

ERP/Core Equipment mantiene ownership sobre:

```text
physical identity
Product relationship
assetCode
serial
lifecycle
condition
origin
retirement
inspection history
```

Healthcare mantiene ownership futuro sobre:

```text
Equipment Requirement
Case Equipment Assignment
Preparation
Dispatch
Custody
Return
Inspection context
Case Availability
Case Equipment history
```

Principio:

```text
EquipmentAsset
→ one Core identity

Healthcare
→ consumes that identity
```

Healthcare no debe duplicar la identidad física.

---

## 3.15 Documentation Architecture Refactor

**Estado final:** COMPLETED
**Inicio:** 2026-08
**Cierre:** 2026-08

Se realizó una reconstrucción de la documentación oficial para eliminar:

```text
empty documents
duplicates
contradictory sources
obsolete architecture
Sprint-fragmented documentation
historical rules presented as current
```

Se adoptó:

> **Una verdad → un documento responsable.**

---

### Product Documentation

Se consolidaron:

```text
product/PRODUCT_VISION.md

product/PRODUCT_REQUIREMENTS.md

product/ZAPING_WAY.md
```

Ecosistema:

```text
Zaping Platform
├── Zaping ERP Core
├── Zaping Healthcare
├── Zaping Radar
└── Zaping AI
```

Healthcare se mantiene como la primera vertical especializada.

---

### Architecture Documentation

Se consolidaron:

```text
architecture/ARCHITECTURE.md
architecture/c4/
architecture/adr/
```

El catálogo ADR fue consolidado y las decisiones obsoletas se marcaron como superseded cuando correspondía.

---

### Engineering Documentation

Se consolidaron:

```text
ENGINEERING_GUIDE.md
DEVELOPMENT_WORKFLOW.md
QUALITY_STANDARDS.md
SECURITY_PRINCIPLES.md
API_GUIDELINES.md
```

Se reforzó:

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

### UX Documentation

Se consolidaron:

```text
ux/DESIGN_SYSTEM.md
ux/BUSINESS_COMPONENTS.md
product/ZAPING_WAY.md
```

Principios:

> **Simple por defecto. Poderoso cuando se necesita.**

y:

```text
Data
↓
Context
↓
Action
```

---

### ERP Module Documentation

Se consolidó:

```text
docs/modules/erp/
```

como ubicación responsable para módulos ERP.

Durante H8 se añadió además:

```text
PURCHASE_RECEIPTS.md
```

como documento canónico específico para Recepciones de compra.

---

# 4. 2026-07 — Purchase Receipts y Advanced Inventory

## 4.1 Purchase Receipts Foundation

**Estado:** IMPLEMENTED / VALIDATED
**Periodo:** 2026-07

Objetivo:

```text
separar lo ordenado
de
lo físicamente recibido
```

Se introdujo:

```text
Purchase
↓
PurchaseReceipt
```

como evento de entrada física.

---

### Cambio de regla de inventario

Antes:

```text
Purchase approved
↓
Inventory IN
```

Después:

```text
Purchase confirmed
↓
no Inventory effect

PurchaseReceipt registered
↓
Inventory IN
```

Esta decisión reemplazó oficialmente el comportamiento anterior.

---

### Partial Receipts

Purchases evolucionó:

```text
CONFIRMED
↓
PARTIALLY_RECEIVED
↓
RECEIVED
```

permitiendo múltiples Receipts para una misma Purchase.

---

### Quantity Protection

Se estableció:

```text
quantityReceived
<=
quantityPending
```

y se bloqueó over-receiving.

---

### InventoryBatch

Se incorporó:

```text
Product
↓
InventoryBatch
```

para representar existencia por lote.

Campos relevantes según implementación:

```text
lotNumber
expirationDate
availableQuantity
unitCost
```

---

### Lot Capture Boundary

```text
Purchase
→ what was ordered

PurchaseReceipt
→ what was physically delivered
```

Por tanto:

```text
lotNumber
expirationDate
```

se capturan durante Receipt y no durante Purchase.

---

### Inventory Integration

Una recepción válida puede producir dentro de una transacción:

```text
PurchaseReceipt
+
PurchaseReceiptItems
+
InventoryBatch
+
InventoryMovement IN
+
Product.stock update
+
Purchase status update
```

---

### Frontend inicial

Se implementó flujo de recepción con:

```text
ordered quantities
received quantities
pending quantities
lot capture
expiration capture
notes
validation
list refresh
```

---

### Evolución posterior

La implementación inicial de julio fue reforzada posteriormente con:

```text
ProductLotTracking enforcement
idempotency
traceability read model
dedicated frontend
cross-module navigation
Equipment ASSET provisioning
```

durante agosto de 2026.

---

## 4.2 Sprint 10 — Advanced Inventory

**Estado histórico:** Originalmente planeado; parcialmente materializado posteriormente.

Objetivo original:

```text
qué producto existe

cuánto existe

de qué lote proviene

cuándo caduca

de qué compra entró

qué movimientos afectaron stock
```

Fronteras que permanecieron vigentes:

```text
Product
→ master catalog

InventoryBatch
→ lot-level inventory

Purchase
→ what was ordered

PurchaseReceipt
→ what physically arrived

InventoryMovement
→ what changed inventory
```

Posteriormente fueron implementados:

```text
PurchaseReceipt
InventoryBatch
partial receipts
lot capture
expiration capture
lot tracking enforcement
```

Permanecieron como evolución posterior:

```text
FEFO
SERIALIZED semantics
automatic expired-stock policies
barcode / QR
advanced audit
multi-warehouse
```

---

## 4.3 Sprint 09 — Purchases & Business Components

**Estado:** COMPLETED
**Periodo:** 2026-07

Objetivo:

```text
strengthen reusable frontend components
+
complete first Purchases workflow
```

Business Components reportados:

```text
StatusBadge
MoneyInput
SupplierSelector
ProductSelector
```

La fuente vigente posterior quedó en:

```text
ux/BUSINESS_COMPONENTS.md
```

Purchases incorporó inicialmente:

```text
Create Purchase
Edit Draft Purchase
Approve Purchase
Purchase Detail
Purchase PDF
Inventory traceability
```

Calidad registrada:

```text
Frontend tests
Frontend lint
Frontend build
Backend build
Purchases ESLint
Inventory ESLint
Manual API validation
Manual UI validation
```

---

### Arquitectura histórica importante

En Sprint 09:

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

Este comportamiento es histórico.

Fue superseded por:

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

Fuentes actuales:

```text
modules/erp/PURCHASES.md
modules/erp/PURCHASE_RECEIPTS.md
modules/erp/INVENTORY.md
ADR-002
```

---

## 4.4 Foundation v1.0

**Estado:** RELEASED
**Periodo:** 2026-07

Foundation v1.0 estableció la primera baseline formal de:

```text
Product
Architecture
Engineering
Security
Quality
Documentation
ADR
```

No estuvo centrada principalmente en nueva funcionalidad empresarial.

Entregables originales:

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

Principios establecidos:

```text
API First
Multi-Tenant
Layered Architecture
Modular Monolith
Documentation First
Security by Design
Business Driven Development
```

---

### Decisiones que evolucionaron

```text
Global Soft Delete
→ superseded by Entity Lifecycle Strategy
```

```text
Quote → Sale
as long-term target architecture
→ superseded by SalesOrder + Delivery
```

La implementación ERP Core V1:

```text
Quote → Sale
```

continúa existiendo temporalmente mientras `SalesOrder + Delivery` permanezca como arquitectura futura.

También:

```text
Purchase Approval → Inventory
→ superseded by PurchaseReceipt → Inventory
```

---

# 5. Primer ERP Core

Antes de la consolidación documental de agosto de 2026, Zaping ya contaba con una base funcional:

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

Stack principal:

```text
Next.js
React
TypeScript
NestJS
Node.js
PostgreSQL
Prisma
JWT
```

La evolución posterior añadió reglas de dominio, trazabilidad, lifecycle, idempotencia y Equipment físico.

---

# 6. Principales transiciones arquitectónicas

## 6.1 Purchases

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

## 6.2 Sales

Implementación ERP Core V1:

```text
Quote
→ Sale
```

Arquitectura objetivo futura:

```text
Quote
↓ optional
SalesOrder
↓
Delivery
↓
Inventory OUT
```

La arquitectura futura separa:

```text
commercial commitment
≠
physical fulfillment
```

---

## 6.3 Returns

Diseño histórico inicial:

```text
SaleItem
↓
ReturnItem
```

Evolución futura objetivo:

```text
DeliveryItem
↓
ReturnItem
```

RET-004 backend operacional quedó diferido.

Returns no es blocker P0 del ERP Core V1 actual.

---

## 6.4 Entity Lifecycle

Antes se planteó:

```text
global deletedAt
```

como estrategia general.

Posteriormente se adoptó:

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

## 6.5 Healthcare Inventory

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

Esto permite representar:

```text
temporary custody
↓
procedure
↓
return
↓
reconciliation
```

sin confundir salida de almacén con consumo comercial definitivo.

---

## 6.6 Equipment

Se formalizó:

```text
Product
≠
EquipmentAsset
```

y:

```text
Current Equipment Availability
≠
Case Availability
```

ERP/Core es responsable de identidad física.

Healthcare será responsable de Assignment, Custody y Case context.

---

# 7. Correcciones documentales históricas

Durante la consolidación documental se detectaron y corrigieron:

```text
duplicated documents
empty files
incorrect names
duplicated ADRs
incorrect ADR titles
stale API documentation
QUALITY_STANDARS typo
Soft Delete documentation incompatible with domain
old Purchase → Inventory rule
Sales documentation treated as permanent architecture
Returns tied too strongly to legacy Sale
templates with copied Inventory metadata
stale Equipment pending states
stale Healthcare implementation states
```

También se corrigieron deudas históricas que ya no debían presentarse como vigentes:

```text
passwordHash exposure
→ resolved

Purchase Receipt idempotency
→ implemented

Purchase Receipt ProductLotTracking enforcement
→ implemented

Products detail tenant mismatch
→ resolved
```

El Changelog conserva cuándo existieron esos problemas sin presentarlos como deuda actual.

---

# 8. Versionado

Las versiones históricas de documentación no representan automáticamente releases comerciales.

Ejemplo:

```text
Foundation v1.0
```

representa una baseline arquitectónica/documental.

Una versión comercial debe representar:

```text
real
completed
verifiable
changes
```

La estrategia de release vigente pertenece a:

```text
ROADMAP.md
```

---

# 9. Regla de actualización

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

Cuando una iniciativa deje de ser futura:

```text
ROADMAP
↓
implementation
↓
PROJECT_BOARD
↓
completion
↓
CHANGELOG
```

---

# 10. Fuente de verdad

```text
CHANGELOG.md
→ historia consolidada

PROJECT_BOARD.md
→ estado actual

ROADMAP.md
→ dirección futura

ADR
→ decisiones arquitectónicas

docs/modules/
→ comportamiento funcional vigente

PRODUCT_VISION.md
→ visión de largo plazo

PRODUCT_REQUIREMENTS.md
→ capacidades del producto
```

---

# 11. Principio final

El Changelog debe conservar la historia sin convertir decisiones antiguas en reglas actuales.

Por tanto:

> **Registrar que Zaping funcionó de una manera en el pasado no significa que esa arquitectura siga vigente hoy.**

También:

> **Registrar una deuda en una entrega histórica no significa que esa deuda continúe abierta si fue resuelta posteriormente.**

La historia debe conservarse.

La fuente vigente debe mantenerse clara.
