Project Board — Zaping

Producto: Zaping Platform
Estado: Desarrollo activo
Fase actual: Post-merge ERP Core V1 — sincronización documental, QA local y hardening
Última actualización: 2026-09-05
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

POST-MERGE BASELINE

Canonical branch: `main`

Canonical baseline: `f17f88123da9ed0c96dbf6a0c7ef0ec9f3df8c6d`

PR #1: MERGED

Post-merge CI: PASS

ERP Core V1: INTEGRATED

OPS-RC-B5B: CLOSED

OPS-RC-B5C real staging acceptance: DEFERRED / READY WHEN NEEDED

No staging or production deployment is claimed by this baseline.

IMPLEMENTED / VALIDATED

ERP Core

├── Authentication / JWT foundation
├── Users V1 administration
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
├── Secure password recovery
├── Authorization + Tenant Isolation V1
│   ├── fixed-role ERP Core authorization
│   ├── tenant-safe reads and mutations
│   ├── cross-company relation hardening
│   └── frontend role-aware UX / 403 handling
└── Healthcare Case Foundation

CURRENT

ERP Core V1 integrated in `main`

├── documentation baseline synchronization
│
├── local QA / hardening
│
└── next functional initiative still to be approved

Frontend UX workstream

├── UX-01 Foundations / App Shell v2
│   └── COMPLETED / VALIDATED
│
└── UX-02 DataTable / operational lists
    ├── COMPLETE / VALIDATED
    ├── DataTable para listas operativas
    └── StaticTable para detalle/documentación

NEXT

documentation sync
        ↓
local QA / hardening
        ↓
next functional initiative — decision pending

DEFERRED

OPS-RC-B5C — real staging acceptance
        → READY WHEN NEEDED; not executed by this baseline

RELEASE BLOCKERS — P0

Antes de pilot/commercial production deben resolverse o verificarse formalmente
los pendientes operativos:

manual role QA

real password-recovery email delivery/configuration

staging acceptance when OPS-RC-B5C is reactivated

backup / restore provider validation

formal pilot acceptance evidence

Authorization + Tenant Isolation V1:

IMPLEMENTED / VALIDATED

ERP Core funcional y su cierre B2:

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

✅ AUTH + USERS + PASSWORD SECURITY + ROLE AUTHORIZATION + TENANT ISOLATION V1 IMPLEMENTED / VALIDATED

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

Estado: ✅ AUTH + USERS + PASSWORD SECURITY + ROLE AUTHORIZATION + TENANT ISOLATION V1 IMPLEMENTED / VALIDATED

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

/auth/me

/users

/users/:id

SEC-001 — Authentication Response Sanitization

Estado: ✅ COMPLETED / VERIFIED

Regla:

API response
→ no passwordHash exposure

La deuda histórica de exposición de passwordHash en register/login fue resuelta.

No debe mantenerse como riesgo activo.

SEC-002 — Default ADMIN / Safe Role Provisioning Review

Estado: ✅ COMPLETED / VERIFIED

Resuelto para el código vigente:

User.role
→ no @default(ADMIN)

Company sign-up

→ first ADMIN explicit

Users V1 create

→ ADMIN-only

→ explicit role required

SEC-003 — Inactive User Enforcement

Estado: ✅ COMPLETED / VERIFIED

Implementado:

User.isActive = false
→ login rejected

JWT vigente
→ revalidated against DB on subsequent requests

role current
→ loaded from DB for protected requests

AUTH-USERS-V1 — Users V1 Administration

Estado: ✅ COMPLETE

Closed checkpoints:

ERP-V1-CLOSE-B1C-A

ERP-V1-CLOSE-B1C-B

ERP-V1-CLOSE-B1C-C

Implementado:

GET /users

GET /users/:id

POST /users

PATCH /users/:id

No DELETE /users.

ADMIN-only, tenant-safe, no passwordHash in responses.

SEC-004 — Tenant Isolation Regression

Estado: ✅ CLOSED / VERIFIED
Prioridad: P0

Validado en B2D:

```text
Company A
→ cannot read/write Company B resources

tenant-safe list/detail/mutation behavior
→ validated across critical ERP modules

mixed-tenant relations
→ rejected without business side effects

final tenant predicates
→ validated for sensitive writes
```

La cobertura automatizada es la evidencia de este cierre; no se presenta como
penetration testing.

SEC-005 — Secure Password Recovery

Estado: ✅ IMPLEMENTED / VERIFIED
Prioridad: P0

Workstream:

AUTH-PASSWORD-SECURITY-V1
→ IMPLEMENTED

El reset inseguro anterior fue retirado.

Estado actual:

secure recovery
→ IMPLEMENTED / VERIFIED

/forgot-password
→ recovery request with generic response

/reset-password
→ one-time token password reset

El flujo vigente cubre:

recovery request

secure random token

hashed token persistence

30-minute expiration

single-use atomic consumption

pending-token invalidation after password reset

password change authVersion invalidation

JWT revocation after password change/reset

safe response semantics


no account enumeration

auth session invalidation through authVersion

email delivery through Resend

token/plaintext/reset URL/password/passwordHash excluded from logs

Frontend coverage:

/forgot-password

/reset-password?token=...

La implementación fue validada en B1D-D2/D3. El snapshot cuantitativo de B2D
se conserva como evidencia histórica, anterior al gate pre-merge B5B.10.

Permanecen como validación operativa posterior:

real email delivery/configuration verification:
verified sender/domain, valid RESEND_API_KEY, EMAIL_FROM and
FRONTEND_BASE_URL, plus real forgot → email → reset → login E2E

manual role QA and staging acceptance when B5C is reactivated.

SEC-006 — Authentication Abuse Protection / Rate Limiting

Estado: ✅ IMPLEMENTED / VALIDATED — operational QA pending
Prioridad: P0 preproduction / B3

Endpoints sensibles como:

/auth/login

/auth/register

POST /auth/forgot-password

POST /auth/reset-password

deben contar con protección básica contra abuso antes de producción.

Debe definirse según arquitectura:

rate limiting

retry / lockout policy where appropriate

monitoring

safe error responses

No aplicar una estrategia de lockout que permita denegación de servicio trivial sin análisis.

Debe cubrir también cualquier otro endpoint auth-sensitive aprobado por la
política final.

La configuración de `@nestjs/throttler` y su cobertura focal fueron integradas
en B3B1. El pendiente restante es la verificación operativa en el entorno de
staging cuando OPS-RC-B5C sea reactivado.

SEC-007 — Protected Route / Session Architecture

Estado: ✅ IMPLEMENTED / VALIDATED — operational QA pending
Prioridad: P0 preproduction

CURRENT frontend utiliza:

(app) route group

AppShell

JWT stored client-side

axios interceptor

401 clear / redirect

El contrato de bootstrap de sesión, deep-link protegido, ausencia de flash,
redirect 401 y preservación ante network/5xx quedó validado en B3B4.

La aceptación operativa debe confirmar:

session bootstrap

protected deep-link refresh

protected-page flash

logout consistency

unauthenticated navigation behavior

storage strategy before production

JWT en localStorage sigue siendo la estrategia CURRENT y debe revisarse como
decisión operativa antes de producción; no es un blocker de implementación
pendiente en este baseline.

SEC-008 — Critical Authorization Review

Estado: ✅ CLOSED / VERIFIED
Prioridad: P0

Validado en B2D:

```text
JwtAuthGuard + RolesGuard + @Roles(...)

fixed-role matrix for ADMIN / MANAGER / SALES / WAREHOUSE

server-side business authorization

no frontend-only authorization assumptions

401 / 403 / 404 / 400 semantics
```

El frontend role-aware es UX; el backend mantiene la autoridad.

SEC-009 — Production Secrets / Configuration Review

Estado: ✅ IMPLEMENTED / VALIDATED — real provider QA pending
Prioridad: P0 preproduction

Debe verificarse:

JWT_SECRET / secrets management

production environment variables

no committed credentials

safe environment separation

production database configuration

debug/dev settings disabled where appropriate

CORS / environment-specific origins reviewed

La configuración fail-closed, CORS por entorno y la separación de variables
quedaron validadas en B3B2. El gate operativo todavía exige
sender/domain verificado, `RESEND_API_KEY`, `EMAIL_FROM` y
`FRONTEND_BASE_URL` válidos, y una prueba real forgot → email → reset → login.

DEPENDENCY AUDIT NOTE

La alerta de `deepmerge-ts` vía `@prisma/config` / Prisma tooling fue
remediada con un override compatible y la actualización correspondiente del
lockfile en OPS-RC-B5B.10B1 (`bac9ab5`, override `^8.0.1`). No queda como
blocker de este baseline; el mantenimiento periódico de dependencias continúa.

B2D VALIDATION SNAPSHOT

```text
Backend: 60 suites / 628 tests PASS
Frontend: 54 files / 653 tests PASS bounded
Frontend: 54 files / 653 tests PASS serial
Backend build/lint: PASS
Frontend build/lint: PASS
Prisma validate/status: PASS
25 migrations found; database schema up to date
```

Authorization + Tenant Isolation V1 quedó `CLOSED / IMPLEMENTED`. La cobertura
validó autenticación, role denial, aislamiento de listados/detalles/mutaciones,
relaciones mixtas, ausencia de side effects en rechazos cross-tenant, predicados
finales, semántica de errores y preservación de sesión ante `403`.

El blocker `RC-DATA` de posible lost update en
`InventoryService.createMovement` fue resuelto mediante control de concurrencia
y su regresión quedó integrada antes del merge de PR #1.

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

Estado: ⏳ DEFERRED P1

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

B3 security implementation — CLOSED / VALIDATED

manual role QA

real password-recovery email delivery/configuration

OPS-RC-B5C staging acceptance — DEFERRED / READY WHEN NEEDED

backup / restore provider validation

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

branch/context selector / notifications / global search

collaboration

global pagination strategy

frontend test worker resource exhaustion under parallel pool

22. Riesgos activos

RISK-001 — Security Hardening

Riesgos vigentes:

B2 Authorization + Tenant Isolation V1
→ CLOSED / VERIFIED

B3 security implementation
→ CLOSED / VALIDATED

remaining operational validation: real Resend delivery, manual role QA and
staging acceptance when OPS-RC-B5C is reactivated

passwordHash exposure ya no forma parte de este riesgo.

Mitigación:

complete the remaining operational validation before pilot / commercial
production release

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

ERP Core V1 integrated in canonical `main`

→ documentation baseline synchronization

→ local QA / hardening

NEXT LOCAL WORK

→ next functional initiative still to be approved

DEFERRED

→ OPS-RC-B5C real staging acceptance — READY WHEN NEEDED

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

OPCIÓN FUTURA — sujeta a aprobación como siguiente iniciativa

Healthcare specialization

Secuencia orientativa si se aprueba Healthcare:

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

27. Calidad post-merge y snapshot histórico

Baseline vigente: gate pre-merge B5B.10 aprobado con hallazgos no bloqueantes
y CI post-merge PASS. La aceptación operativa sigue pendiente según §0.

Snapshot histórico al cierre de ERP-V1-CLOSE-B2D:

```text
Backend: 60 suites / 628 tests PASS
Frontend: 54 files / 653 tests PASS bounded
Frontend: 54 files / 653 tests PASS serial
Backend build/lint: PASS
Frontend build/lint: PASS
Prisma validate/status: PASS
25 migrations found; database schema up to date
```

Este snapshot es histórico de B2D y valida la regresión completa de autorización
y tenant isolation de ese cierre. Los controles B3 y la corrección RC-DATA fueron
integrados posteriormente; la validación operativa de Resend, roles y staging
permanece separada.

El full Vitest pool puede presentar agotamiento de workers/recursos en ejecución paralela.

Si ocurre:

parallel infrastructure/resource failure
≠
application test failure

La suite completa puede ejecutarse con workers limitados o de forma serial para
obtener un resultado confiable.

Los conteos de B2D no representan el total actual de tests; cualquier nuevo
snapshot cuantitativo debe basarse en su propia ejecución y evidencia.

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

29. B2E close conditions

Estado: ✅ CLOSED / VERIFIED

Condiciones documentales verificadas al cierre B2E:

primary documentation reviewed

cross-document CURRENT / TARGET / FUTURE sync

Authorization + Tenant Isolation V1 reflected

B3 gates and the then-open RC-DATA finding reflected (both superseded by the
post-merge baseline above)

PROJECT_BOARD final sync

ROADMAP / root README security wording checked if needed

Markdown consistency reviewed

git status --short reviewed

git diff --check PASS

no secrets / credentials / .env backup committed

only intended documentation changes present

Esta lista conserva la evidencia documental del cierre B2E; los checks fueron
completados antes de la integración de PR #1.

30. Principio final

Este documento debe poder responder siempre:

¿Cuál es el siguiente trabajo correcto para avanzar Zaping hoy?

Respuesta vigente:

ERP Core V1
→ INTEGRATED in canonical `main`

OPS-RC-B5B
→ CLOSED

Documentation synchronization
→ CURRENT

Local QA / hardening
→ NEXT LOCAL WORK

OPS-RC-B5C real staging acceptance
→ DEFERRED / READY WHEN NEEDED

Next functional initiative
→ decision pending; Healthcare and Advanced Inventory are not preselected

No staging or production deployment is claimed by this baseline.
