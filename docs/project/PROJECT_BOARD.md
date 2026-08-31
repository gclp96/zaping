Project Board — Zaping

Producto: Zaping Platform
Estado: Desarrollo activo
Fase actual: H8 — Documentación, regresión y preparación de cierre de ERP Core V1
Última actualización: 2026-08-29
Responsable: Zaping Team

0. Snapshot vigente

Este documento representa el estado operativo actual del proyecto.

Debe responder principalmente:

qué está implementado;

qué está validado;

qué trabajo está activo;

qué sigue;

qué bloquea un release;

qué deuda técnica permanece;

cuál es la siguiente decisión correcta para avanzar Zaping.

Los detalles históricos de implementación y snapshots antiguos deben conservarse en:

docs/project/CHANGELOG.md

y no duplicarse dentro de este Board.

IMPLEMENTED / VALIDATED

ERP Core

├── Authentication / JWT foundation
├── Authenticated App Shell
├── Navigation
├── UX-01 App Shell v2 / frontend foundations
│   ├── semantic tokens
│   ├── layout primitives
│   ├── responsive Sidebar / AppHeader
│   ├── authenticated Home V1
│   └── Categories normalization
├── Dashboard 2.0
├── Customers V1
├── Suppliers V1
├── Products / Categories V1
├── Inventory Movement Ledger V1
├── Equipment V1
├── Quotes V1
├── Sales V1
├── Purchases V1
│   ├── Purchase 360 canonical detail
│   ├── folio navigation to /purchases/:id
│   ├── timezone-aware date filters
│   └── legacy purchaseId compatibility redirect
├── Purchase Receipts V1
│   ├── partial / full receiving
│   ├── lot tracking
│   ├── idempotency
│   ├── Inventory IN
│   ├── Equipment provisioning
│   └── cross-module traceability
└── Healthcare Case Foundation

CURRENT

H8 — ERP Core release preparation

├── H8A Documentation synchronization
│   └── final cross-document synchronization in progress
│
└── H8B Full technical regression
    └── next technical block

Frontend UX workstream

├── UX-01 Foundations / App Shell v2
│   └── COMPLETED / VALIDATED
│
└── UX-02 DataTable / operational lists
    ├── COMPLETE / VALIDATED
    ├── DataTable para listas operativas
    └── StaticTable para detalle/documentación

NEXT

UX-B.6 — Full ERP end-to-end QA
        ↓
ERP Core V1 closure
        ↓
Healthcare specialization

RELEASE BLOCKERS — P0

Antes de pilot/commercial production deben resolverse o verificarse formalmente:

secure password recovery

inactive-user enforcement

default ADMIN / safe role provisioning review

systematic tenant-isolation regression

critical authorization review

protected-route / session architecture

authentication abuse protection / rate limiting

production secrets / configuration review

ERP Core funcional validado:

≠
production-ready

1. Propósito del Project Board

El Project Board representa exclusivamente el estado vigente del trabajo.

Separación documental:

PROJECT_BOARD.md

→ estado actual
→ prioridades
→ trabajo activo
→ siguiente trabajo
→ blockers
→ deuda

ROADMAP.md

→ dirección futura
→ secuencia estratégica
→ evolución de producto

CHANGELOG.md

→ historia de trabajo completado
→ entregas anteriores
→ snapshots históricos

El Project Board no debe convertirse en un historial de implementación.

2. Estado general de Zaping

Zaping Platform
│
├── ERP Core
│   ├── Foundation estable
│   ├── Comercial V1 operativo
│   ├── Compras / Recepciones operativas
│   ├── Inventario transaccional
│   ├── Equipment Core
│   ├── trazabilidad entre módulos
│   └── preparación de cierre V1
│
├── Healthcare
│   ├── Case Foundation implementado
│   ├── Equipment boundary definido
│   └── operational workflows TARGET
│
├── Radar
│   └── producto futuro
│
└── AI
    └── evolución futura

3. ERP Core — Estado actual

Dominio

Estado vigente

Companies

✅ IMPLEMENTED

Identity & Access

🟡 IMPLEMENTED / P0 security evolution pending

Dashboard

✅ IMPLEMENTED / VALIDATED

Customers

✅ V1 IMPLEMENTED / VALIDATED

Suppliers

✅ V1 IMPLEMENTED / VALIDATED

Products

✅ V1 IMPLEMENTED / VALIDATED

Categories

✅ IMPLEMENTED / VALIDATED

Inventory

✅ Movement Ledger V1 IMPLEMENTED / VALIDATED

Equipment

✅ Equipment V1 IMPLEMENTED / VALIDATED

Quotes

✅ V1 IMPLEMENTED / VALIDATED

Sales

✅ V1 IMPLEMENTED / VALIDATED sobre modelo Sale CURRENT

Purchases

✅ V1 IMPLEMENTED / VALIDATED

Purchase Receipts

✅ V1 IMPLEMENTED / VALIDATED

Returns

⏳ P1 DEFERRED — diseño/persistencia parcial; backend operacional no CURRENT

Audit

⏳ FUTURE foundation

Healthcare Cases

✅ Foundation backend IMPLEMENTED / VALIDATED

4. Trabajo cerrado recientemente

H7 — ERP Core Functional Normalization

Estado: ✅ COMPLETED / VALIDATED

Incluye:

Authenticated App Shell

Navigation

Dashboard

Customers

Suppliers

Products

Inventory

Equipment

Quotes

Sales

Purchases

Purchase Receipts

Subfases finales:

H7A0
→ Sales detail deep-link

H7A
→ Quotes normalization
→ Quote → Sale handoff

H7B
→ Purchases normalization

Resultado:

ERP Core functional normalization
→ COMPLETED

Purchase Receipts V1

Estado: ✅ IMPLEMENTED / VALIDATED

Implementado:

Purchase Receipt creation

partial receiving

full receiving

lot tracking

InventoryBatch integration

Product.stock increment

InventoryMovement IN

EquipmentAsset provisioning for ASSET Products

idempotency

receipt detail

cross-module traceability

dedicated frontend

Contrato idempotente:

Idempotency-Key
+
companyId
+
PURCHASE_RECEIPT_CREATE

Comportamiento:

same key + same payload
→ replay same Receipt

same key + different payload
→ 409 Conflict

same key + another Company
→ independent identity

La idempotencia de Purchase Receipts ya no es deuda funcional.

Permanece como deuda de QA:

real simultaneous PostgreSQL concurrency test

Equipment V1

Estado: ✅ IMPLEMENTED / VALIDATED

Incluye:

EquipmentAsset identity

automatic assetCode

serialNumber

normalized serial key

lifecycle

condition

origin

manual creation

Purchase Receipt provisioning

inspection

retirement

current availability

detail frontend

search / filters

deep-link

Lifecycle:

ACTIVE

RETIRED

Condition:

GOOD

INSPECTION_PENDING

DAMAGED

OUT_OF_SERVICE

Origin:

MANUAL

PURCHASE_RECEIPT

IMPORT

INITIAL_MIGRATION

Current Availability:

ACTIVE + GOOD
→ available

INSPECTION_PENDING
→ unavailable

DAMAGED
→ unavailable

OUT_OF_SERVICE
→ unavailable

RETIRED
→ unavailable

Availability representa únicamente hechos actualmente implementados en Equipment Core.

No representa todavía:

Case Assignment

Custody

Maintenance

Calibration

Case conflicts

Dispatch

Return

5. Customers / Suppliers

Customers

Estado: ✅ IMPLEMENTED / VALIDATED

Lifecycle:

active by default
        ↓
DELETE
        ↓
isActive = false

DELETE representa desactivación y no hard delete.

Reglas actuales:

active list

historical detail preserved

historical Quotes preserved

historical Sales preserved

Customer activo para nuevas Quotes/Sales:

backend validation
→ IMPLEMENTED

Pendiente:

reactivation workflow

inactive-record administration

Suppliers

Estado: ✅ IMPLEMENTED / VALIDATED

Lifecycle equivalente:

active
  ↓
deactivate
  ↓
isActive = false

Las Purchases históricas conservan su Supplier.

Pendiente:

backend validation of active Supplier
for new / edited Purchase

La ausencia de esta validación permanece deuda de integridad.

6. Products

Estado: ✅ IMPLEMENTED / VALIDATED

Campos principales:

SKU

name

description

brand

category

barcode

cost

price

stock

minStock

isActive

inventoryTracking

lotTracking

Inventory tracking:

QUANTITY

SERIALIZED

ASSET

Lot tracking:

NONE

OPTIONAL

REQUIRED

Reglas actuales:

Product.stock
→ no se modifica mediante Product CRUD

Product creation
→ stock inicial gestionado por backend

tracking
→ no se modifica arbitrariamente después de existir historia operacional

DELETE
→ deactivation

Pendiente:

Product 360

reactivation

formal tracking migration workflow

imports

future unit-of-measure model

Healthcare Product Profile

Deuda de integridad relacionada con Purchases:

active Product backend validation
for new / edited Purchase

7. Inventory

Estado: ✅ Movement Ledger V1 IMPLEMENTED / VALIDATED

Frontend:

Inventory

├── Existencias

└── Movimientos

Movement types CURRENT:

IN

OUT

ADJUSTMENT

Trazabilidad:

referenceType

referenceId

balance

unitCost

Product

createdAt

Flujos principales:

Purchase Receipt
→ InventoryMovement IN

Sale approval
→ InventoryMovement OUT

Pendiente:

backend pagination

server-side search / filtering

date-range filtering

server-side reference filtering

manual adjustment workflow review

multi-warehouse

locations

transfers

physical counts

barcode / QR

Location, Position e internal TRANSFER están aprobados como capacidades
TARGET de Advanced Inventory, pero no son CURRENT.

No son CURRENT.

8. Quotes

Estado: ✅ V1 IMPLEMENTED / VALIDATED

Estados:

DRAFT

CONFIRMED

CANCELLED

Funcionalidad:

create

list

search

status filter

detail from current loaded data

approve

cancel

PDF

Quote → Sale conversion

Conversión:

POST /sales/from-quote/:quoteId

El backend devuelve la Sale creada con:

id

folio

Frontend handoff:

Quote
  ↓
Convert to Sale
  ↓
Venta creada correctamente
  ↓
/sales?saleId=<Sale.id>

Deuda vigente:

historical converted Quote
→ convertedToSale is known
→ original Sale identity is not exposed

Por lo tanto una Quote histórica convertida todavía no puede navegar a su Sale original.

También permanece deuda futura:

dedicated GET /quotes/:id strategy
for server-side pagination/deep-link robustness

9. Sales

Estado: ✅ V1 IMPLEMENTED / VALIDATED

Estados principales:

DRAFT

CONFIRMED

CANCELLED

Folios:

V-000001

V-000002

...

Generados mediante:

CompanySequence

key = SALE_FOLIO

Flujo:

Create Sale
→ DRAFT
→ no stock mutation

Approve
→ CONFIRMED
→ Product.stock decrement
→ InventoryMovement OUT

Cancel DRAFT
→ CANCELLED
→ no stock mutation

Generic Sales eligibility:

inventoryTracking === QUANTITY

AND

lotTracking !== REQUIRED

Productos incompatibles con Sales genérico son rechazados por backend.

Deep-link:

/sales?saleId=<id>

Pendiente:

Sale create idempotency

confirmed Sale reversal

generic DRAFT edit only if product requirements justify it

pagination

server-side filtering

required-lot fulfillment

ASSET / SERIALIZED fulfillment

SalesOrder / Delivery TARGET architecture

payments

invoice

10. Purchases

Estado: ✅ V1 IMPLEMENTED / VALIDATED

Estados:

DRAFT

CONFIRMED

PARTIALLY_RECEIVED

RECEIVED

CANCELLED

Funcionalidad:

create

edit DRAFT

approve

cancel DRAFT

Purchase 360 canonical detail

folio navigation to /purchases/:id

PDF

search

status filter

Supplier filter

Desde / Hasta date filter with Company.timezone

Receipt creation

Receipt history

partial receiving

full receiving

deep-link

Deep-link:

/purchases/:id

Legacy compatibility:

/purchases?purchaseId=<id>
→ /purchases/<id>

Este redirect es temporal y no representa una segunda UI de detalle.

Deuda:

active Supplier backend validation

active Product backend validation

pagination

server-side filtering

future cleanup of legacy purchaseId compatibility redirect

11. Purchase Receipts

Estado: ✅ V1 IMPLEMENTED / VALIDATED

Documento canónico:

docs/modules/erp/PURCHASE_RECEIPTS.md

Flujo:

Purchase CONFIRMED / PARTIALLY_RECEIVED
        ↓
PurchaseReceipt
        ↓
PurchaseReceiptItem
        ├── Product.stock increment
        ├── InventoryMovement IN
        ├── InventoryBatch when applicable
        └── EquipmentAsset for ASSET Product
        ↓
Purchase PARTIALLY_RECEIVED / RECEIVED

Lot tracking implementado:

NONE

OPTIONAL

REQUIRED

Equipment provisioning:

QUANTITY
→ no EquipmentAsset

SERIALIZED
→ no EquipmentAsset currently

ASSET
→ one EquipmentAsset per unit received

Frontend:

/purchase-receipts

/purchase-receipts/<id>

Cross-module navigation:

Purchase → Receipt

Receipt → Purchase

Receipt → Inventory

Receipt → Equipment

Deuda:

real simultaneous PostgreSQL idempotency race QA

SERIALIZED receipt semantics

Receipt PDF

Receipt correction / cancellation / reversal

server-side pagination / filtering

Product.stock ↔ EquipmentAsset reconciliation

12. Identity & Access

Estado: 🟡 IMPLEMENTED / P0 SECURITY EVOLUTION PENDING

Implementado:

JWT

JwtStrategy

JwtAuthGuard

RolesGuard where configured

companyId tenant context

ValidationPipe

ValidationPipe:

whitelist = true

forbidNonWhitelisted = true

transform = true

Endpoints principales:

/auth/register

/auth/login

/auth/reset-password

/auth/me

SEC-001 — Authentication Response Sanitization

Estado: ✅ COMPLETED / VERIFIED

Regla:

API response
→ no passwordHash exposure

La deuda histórica de exposición de passwordHash en register/login fue resuelta.

No debe mantenerse como riesgo activo.

SEC-002 — Default ADMIN / Safe Role Provisioning Review

Estado: ⏳ PENDING
Prioridad: P0

Riesgo actual a revisar:

User.role
@default(ADMIN)

Debe validarse:

all user creation flows

explicit role assignment

privilege escalation protection

safe provisioning defaults

regression tests

No debe asumirse que el default es seguro para producción sin revisión formal.

SEC-003 — Inactive User Enforcement

Estado: 🔎 VERIFY / FIX IF NEEDED
Prioridad: P0

Debe garantizarse:

User.isActive = false
→ no normal application access

Debe verificarse tanto en:

authentication

authenticated request lifecycle

según la estrategia final.

SEC-004 — Tenant Isolation Regression

Estado: ⏳ PENDING / PARTIAL
Prioridad: P0

Objetivo:

Company A
→ cannot read/write Company B resources

Debe cubrir sistemáticamente las operaciones críticas.

La existencia de filtros tenant en múltiples services no sustituye una regresión transversal.

SEC-005 — Secure Password Recovery

Estado: ⛔ P0 BLOCKER
Prioridad: P0

El endpoint CURRENT:

/auth/reset-password

no puede considerarse apto para pilot/commercial production si permite restablecer una contraseña sin demostrar control de la cuenta mediante un mecanismo seguro.

Debe existir una estrategia equivalente a:

recovery request

secure random single-use token

short expiration

account-control proof

token invalidation after use

safe response semantics

no account enumeration

audit / abuse controls where applicable

Regla:

public password reset
without secure recovery proof
→ P0 security blocker

No debe cerrarse ERP Core para producción comercial sin resolver este punto.

SEC-006 — Authentication Abuse Protection / Rate Limiting

Estado: ⏳ PENDING
Prioridad: P0 preproduction

Endpoints sensibles como:

/auth/login

/auth/register

password recovery endpoints

deben contar con protección básica contra abuso antes de producción.

Debe definirse según arquitectura:

rate limiting

retry / lockout policy where appropriate

monitoring

safe error responses

No aplicar una estrategia de lockout que permita denegación de servicio trivial sin análisis.

SEC-007 — Protected Route / Session Architecture

Estado: ⏳ PENDING REVIEW
Prioridad: P0 preproduction

CURRENT frontend utiliza:

(app) route group

AppShell

JWT stored client-side

axios interceptor

401 clear / redirect

Esto no constituye todavía un global protected-route/session contract completo.

Debe revisarse:

session bootstrap

protected deep-link refresh

protected-page flash

logout consistency

unauthenticated navigation behavior

storage strategy before production

JWT en localStorage es estrategia CURRENT, no una decisión que deba asumirse irreversible para producción.

SEC-008 — Critical Authorization Review

Estado: ⏳ PENDING
Prioridad: P0

Debe verificarse sistemáticamente:

sensitive endpoints

RolesGuard / authorization coverage

server-side business authorization

no frontend-only authorization assumptions

antes de production release.

SEC-009 — Production Secrets / Configuration Review

Estado: ⏳ PENDING
Prioridad: P0 preproduction

Debe verificarse:

JWT_SECRET / secrets management

production environment variables

no committed credentials

safe environment separation

production database configuration

debug/dev settings disabled where appropriate

13. Release Readiness

QA-CORE — Commercial Core Regression

Estado: ⏳ PENDING
Prioridad: P0

Se ejecutará durante:

H8B
+
UX-B.6

H8B debe incluir:

backend tests

frontend tests

backend build

frontend build

backend lint

frontend lint

Prisma validate

Prisma migrate status

git health

UX-B.6 debe incluir el QA funcional transversal real:

critical business flows

tenant isolation

authorization

lifecycle

folios

stock effects

movement references

PDFs

deep-links

idempotency replay/conflict

historical deactivation behavior

Release readiness también requiere cerrar los P0 de seguridad de §12.

14. Returns

RET-004 — Returns Backend

Estado: ⏳ DEFERRED
Prioridad: P1 estratégica

Diseño existente:

RET-001 Functional Design
→ completed

RET-002 Prisma Design
→ completed

RET-003 Schema + Migration
→ completed

Backend operacional:

RET-004
→ pending

Returns no es blocker P0 para el cierre funcional del ERP Core V1 actual.

Debe evolucionar coordinadamente con la futura separación:

SalesOrder
        ↓
Delivery
        ↓
Commercial Return
        ↓
Inspection / Disposition
        ↓
Inventory

Debe distinguirse siempre:

Commercial Return
≠
Healthcare CaseReturn

Evitar profundizar nuevas dependencias físicas sobre Sale CURRENT.

15. Sales Evolution

SALES-REF — SalesOrder + Delivery

Estado: ⏳ TARGET
Prioridad: P1 estratégica

Arquitectura objetivo:

Quote
  ↓ optional
SalesOrder
  ↓
Delivery
  ↓
Inventory OUT

Debe separar:

commercial commitment
≠
physical fulfillment

Scope futuro:

SalesOrder

SalesOrderItem

Delivery

DeliveryItem

partial deliveries

pending quantities

batch allocation

Quote conversion

Commercial Returns integration

legacy migration

CURRENT continúa siendo:

Sale

hasta que exista una migración formal.

16. Inventory Evolution

INV-FEFO

Estado: ⏳ PENDING
Prioridad: P1

Objetivo:

First Expired
First Out

INV-EXP

Estado: ⏳ PENDING
Prioridad: P1

Incluye:

expired inventory

near-expiration inventory

operational availability

alerts

Dashboard integration

Advanced Inventory — approved target (not implemented)

Necesidades futuras:

Multi-Warehouse

Locations

Positions

Internal Transfers / custody semantics

Serialized operational tracking

Physical Counts

Barcode / QR

Prioridad general:

P2

salvo cuando una capacidad sea prerequisite para un workflow P0/P1.

Advanced Inventory cuenta con diseño aprobado y permanece no implementado.
La fuente canónica es:

```text
docs/modules/erp/ADVANCED_INVENTORY.md
```

Backlog aprobado:

| ID | Item | Estado |
| --- | --- | --- |
| INV-WH-001 | Branch / Warehouse foundation | 🎯 TARGET |
| INV-LOC-001 | Storage Locations | 🎯 TARGET |
| INV-LOC-002 | Inventory by Location | 🎯 TARGET |
| INV-LOC-003 | Preferred Storage Location | 🎯 TARGET |
| INV-LOC-004 | Receipt Put-away | 🎯 TARGET |
| INV-LOC-005 | Internal Relocation | 🎯 TARGET |
| INV-TRF-001 | Warehouse Transfers | 🎯 TARGET |
| INV-RES-001 | Inventory Reservations | 🎯 TARGET |
| INV-CNT-001 | Physical / Cycle Counts | 🎯 TARGET |
| INV-SCN-001 | Location QR / Barcode | 🎯 TARGET |
| INV-LED-001 | Inventory Ledger V2 | 🎯 TARGET |
| EQ-AVL-001 | Derived Equipment Availability | 🎯 TARGET |
| EQ-MNT-001 | Equipment Maintenance | 🎯 TARGET |

Estos items no implican ejecución inmediata, versión ni fecha de entrega.

17. Healthcare — Estado actual

Estado: ✅ Case Foundation IMPLEMENTED / VALIDATED
Prioridad: P1 estratégica después del cierre ERP Core V1

Healthcare Case Foundation está implementado.

Modelo actual:

HealthcareCase

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

Lifecycle Foundation CURRENT:

DRAFT

SCHEDULED

CANCELLED

Reglas:

scheduledStart exists
→ SCHEDULED

scheduledStart absent
→ DRAFT

CANCELLED
→ terminal in Foundation

Folio:

CASE-000001

Generado mediante:

CompanySequence

key = HEALTHCARE_CASE_FOLIO

API:

POST /healthcare/cases

GET  /healthcare/cases

GET  /healthcare/cases/:id

PATCH /healthcare/cases/:id

POST /healthcare/cases/:id/cancel

Foundation no incluye:

Hospital

Doctor

Case Requirements

Equipment Assignment

Case Availability

Preparation

CaseKit

Dispatch

Custody

CaseReturn

Healthcare material inspection

Reconciliation

Billing

Insurance

Patient records

Clinical records

Reliability debt:

Healthcare Case creation idempotency
→ NOT IMPLEMENTED

Un retry después de una respuesta exitosa perdida puede crear otro Case y consumir otro folio.

18. Healthcare — Orden TARGET

Después del cierre del ERP Core V1:

1. Hospital / Doctor

2. Requirements

3. Equipment Assignment

4. Case Availability

5. Dispatch / Custody

6. Return

7. CaseKit / Maletín

8. Calendar

9. Case 360

10. Mobile technician experience

Principios:

Healthcare
→ consumes ERP Core EquipmentAsset

Equipment Assignment / Custody
≠
EquipmentLifecycle

Healthcare no debe duplicar la identidad física de Equipment.

19. Otros P1 estratégicos

IMP-001 — Data Import

Estado: ⏳ PENDING

Customers

Suppliers

Products

Inventory

CSV

XLSX

UX-360 — 360 Views

Estado: ⏳ PARTIAL / ACTIVE

Product 360

Customer 360

Supplier 360

Purchase 360
✅ COMPLETED / CLOSED

SalesOrder 360 TARGET

Equipment 360

Case 360

UX-DASH — Action Dashboard Evolution

Estado: ⏳ TARGET

Dirección:

Attention
↓
Action
↓
KPIs
↓
Trends

Dashboard CURRENT ya está implementado.

Esta tarea representa evolución posterior, no carencia del Dashboard actual.

UX-SEARCH — Global Search

Estado: ⏳ PENDING

Debe respetar:

tenant

permissions

resources

context

AUTH-PERM — Permission-Based RBAC

Estado: ⏳ TARGET

Evolución:

UserRole
↓
RolesGuard

hacia:

Role
↓
Permissions
↓
PermissionsGuard

AUD-001 — Audit Foundation

Estado: ⏳ PENDING

Primera fase conceptual:

AuditEvent

AuditService

tenant

actor

action

resource

safe metadata

append-only

critical integrations

20. Future Products

Zaping Radar

Estado: 🔮 FUTURE

Dirección inicial:

public procurement

healthcare opportunities

Sonora

Baja California

Baja California Sur

Nuevo León

Sinaloa

Zaping AI

Estado: 🔮 FUTURE

Principio:

AI debe construirse sobre dominios confiables, workflows explícitos y datos trazables.

No debe competir actualmente con la estabilización del ERP Core ni con la construcción posterior del dominio Healthcare.

21. Technical Debt Consolidated

La siguiente deuda permanece vigente y debe revisarse periódicamente.

Security / Release

secure password recovery

authentication abuse protection / rate limiting

inactive-user enforcement

default ADMIN / safe role provisioning

systematic tenant-isolation regression

critical authorization review

protected-route / session architecture

production secrets / configuration review

Reliability / Integrity

Sales create idempotency

Healthcare Case create idempotency

real concurrent Purchase Receipt PostgreSQL idempotency test

Product.stock ↔ EquipmentAsset reconciliation

SERIALIZED receipt semantics

inactive Supplier validation
for new / edited Purchase

inactive Product validation
for new / edited Purchase

historical Quote → Sale identity

Scalability

backend pagination

server-side search / filtering

Inventory date filtering

Inventory reference filtering server-side

Purchase deep-link pagination compatibility

Quote detail/deep-link pagination compatibility

Equipment pagination / bulk availability if later required

Equipment

serial correction / edit workflow

manual batch selector

retired actor display/name resolution

Product.stock ↔ EquipmentAsset reconciliation

Lifecycle

Product reactivation

Customer reactivation

Supplier reactivation

inactive-record administration

Product tracking migration workflow

Purchase Receipts

Receipt PDF

Receipt correction / cancellation / reversal

real concurrent idempotency PostgreSQL QA

Frontend / Architecture

Inventory tabs primitive decision

Modal accessibility / focus management

drawer complete focus trap

authenticated Home post-login redirect

branch/context selector / notifications / global search

role-aware navigation / collaboration

auth protected-route / session architecture

global pagination strategy

frontend test worker resource exhaustion under parallel pool

22. Riesgos activos

RISK-001 — Security Hardening

Riesgos vigentes:

secure password recovery

ADMIN default / safe role provisioning

inactive-user enforcement

systematic tenant-isolation coverage

critical authorization review

protected-route / session architecture

authentication abuse protection

production secrets / configuration

passwordHash exposure ya no forma parte de este riesgo.

Mitigación:

complete P0 security work
before pilot / commercial production release

RISK-002 — Legacy Sales Architecture

Actualmente Sale concentra responsabilidades comerciales y parte del fulfillment físico.

Objetivo TARGET:

SalesOrder
≠
Delivery

Mitigación:

avoid deepening physical workflows directly inside Sale

hasta diseñar la evolución correspondiente.

RISK-003 — Returns Legacy Dependency

Commercial Returns depende parcialmente del modelo actual de Sales.

Mitigación:

defer operational expansion

+

coordinate with SalesOrder / Delivery evolution

RISK-004 — Equipment / Inventory Dual Truth

Actualmente existen:

Product.stock

+

EquipmentAsset records

Para Products ASSET, ambas representaciones no deben evolucionar como fuentes físicas independientes.

Mitigación:

define formal reconciliation/invariant strategy
before broader automation

RISK-005 — Product Scope Growth

Evitar desarrollar simultáneamente:

ERP

Healthcare

Radar

AI

Portal

Mobile

Billing

Prioridad actual:

stable ERP Core

+

differentiated Healthcare workflows after Core closure

23. Definition of Done

Una tarea no está completada únicamente porque:

code compiles

Según corresponda deberá incluir:

business rules approved

architecture review

implementation

migration when required

tests

lint

build

tenant isolation

authorization

manual QA

security review

documentation

CHANGELOG update

git health

24. Estados

✅ COMPLETED

→ terminado y validado

🟢 IN PROGRESS

→ trabajo activo

🟡 READY / PARTIAL

→ listo para comenzar o parcialmente implementado

⏳ PENDING

→ aprobado pero no implementado

⛔ BLOCKER

→ debe resolverse antes del gate indicado

🔎 VERIFY

→ requiere verificación

🎯 TARGET

→ dirección aprobada no implementada

🔮 FUTURE

→ dirección posterior

25. Prioridades

P0

→ security

→ integrity

→ release blocker

P1

→ strategic commercial capability

P2

→ important expansion

Future

→ long-term direction

26. Orden de trabajo inmediato

CURRENT

H8 — Documentation + Regression

Subfases:

H8A

→ documentation synchronization

→ final cross-document sync

→ security blocker sync

→ final repository/doc health checks

H8B

→ full technical regression

→ technical health snapshot

NEXT

UX-B.6

→ Full ERP end-to-end QA

Flujos principales a validar:

Supplier
↓
Purchase
↓
Purchase Receipt
↓
Inventory IN

Purchase
↓
ASSET Receipt
↓
Equipment
↓
Inspection
↓
Availability

Customer
↓
Quote
↓
Sale
↓
Inventory OUT

Además:

folios

statuses

PDFs

deep-links

traceability

tenant isolation

lifecycle

authorization

idempotency replay / conflict

AFTER

ERP Core V1 closure
        ↓
Healthcare specialization

Inicio Healthcare recomendado:

Hospital / Doctor
↓
Requirements
↓
Equipment Assignment
↓
Case Availability
↓
Dispatch / Custody
↓
Return
↓
CaseKit / Maletín
↓
Calendar
↓
Case 360
↓
Mobile Technician

27. Snapshot de calidad vigente

Último snapshot frontend confirmado al cierre de UX-02:

41 test files

534 / 534 tests PASS

frontend tests with limited workers
PASS

frontend tests serially with one worker
PASS

frontend build
PASS

frontend ESLint
PASS

git diff --check
PASS

Este snapshot cierra UX-02 exclusivamente. H8B continúa siendo un bloque técnico
más amplio y no se declara completado por esta validación frontend.

El full Vitest pool puede presentar agotamiento de workers/recursos en ejecución paralela.

Si ocurre:

parallel infrastructure/resource failure
≠
application test failure

La suite completa puede ejecutarse con workers limitados o de forma serial para
obtener un resultado confiable.

El snapshot backend definitivo de release deberá obtenerse durante H8B y no debe inferirse desde resultados antiguos.

28. Fuente de verdad por dominio

ERP UX
→ docs/modules/erp/ERP_UI_UX.md

Purchase Receipts
→ docs/modules/erp/PURCHASE_RECEIPTS.md

Equipment
→ docs/modules/erp/EQUIPMENT.md

Inventory
→ docs/modules/erp/INVENTORY.md

Advanced Inventory target design
→ docs/modules/erp/ADVANCED_INVENTORY.md

Sales
→ docs/modules/erp/SALES.md

Identity / Access
→ docs/modules/erp/IDENTITY_ACCESS.md

Security
→ docs/engineering/SECURITY_PRINCIPLES.md

Healthcare boundaries
→ docs/modules/healthcare/HEALTHCARE.md

Healthcare domain model
→ docs/modules/healthcare/DOMAIN_MODEL.md

Healthcare Case
→ docs/modules/healthcare/CASES.md

Architecture
→ docs/architecture/

Project state
→ docs/project/PROJECT_BOARD.md

Future direction
→ docs/project/ROADMAP.md

Historical delivery record
→ docs/project/CHANGELOG.md

29. H8A close conditions

H8A puede cerrarse únicamente después de:

primary documentation reviewed

cross-document CURRENT / TARGET / FUTURE sync

secure password recovery P0 reflected

auth abuse protection P0 reflected

PROJECT_BOARD final sync

ROADMAP / root README security wording checked if needed

Markdown consistency reviewed

git status --short reviewed

git diff --check PASS

no secrets / credentials / .env backup committed

only intended documentation changes present

No realizar el commit final de H8A antes de estos checks.

30. Principio final

Este documento debe poder responder siempre:

¿Cuál es el siguiente trabajo correcto para avanzar Zaping hoy?

Respuesta vigente:

H8A
→ finish final cross-document / security synchronization
→ run final doc/repository health checks

Then:

H8B
→ full automated technical regression

Then:

UX-B.6
→ full ERP end-to-end QA

Then:

ERP Core V1
→ formal closure after quality + security gates

Then:

Healthcare specialization
→ next strategic product stage

No deben abrirse nuevas funcionalidades del ERP Core antes de completar H8 y UX-B.6, salvo que aparezca un defecto P0 que bloquee el cierre.

Healthcare TARGET tampoco debe expandirse en Prisma durante H8.
