Zaping

Zaping es una plataforma empresarial SaaS multi-tenant orientada a construir un ERP confiable, trazable y extensible, con una primera especialización vertical en el sector Healthcare.

El repositorio contiene actualmente:

Zaping Platform

├── Zaping ERP Core
│   └── base empresarial operativa
│
└── Zaping Healthcare
    └── Case Foundation backend implementado

Estado actual: desarrollo activo.

La normalización funcional del ERP Core correspondiente a H7 está implementada y validada.

La secuencia inmediata del proyecto es:

H8A — Documentation Synchronization
↓
H8B — Full Automated Regression / Technical Health
↓
UX-B.6 — Full ERP End-to-End QA
↓
ERP Core V1 Closure
↓
Zaping Healthcare

ERP Core funcionalmente validado:

≠
production-ready

El cierre productivo depende también de completar los gates de seguridad, regresión y QA definidos en la documentación del proyecto.

Arquitectura actual

Next.js App Router
web/
        │
        │ REST + JWT
        ▼
NestJS Modular Monolith
app/api/
        │
        │ Prisma ORM
        ▼
PostgreSQL

Stack principal:

Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS y Vitest.

Backend: NestJS 11, TypeScript, Jest, Passport JWT y PDFKit.

Persistencia: PostgreSQL y Prisma 6.

Arquitectura backend: modular monolith.

API: REST.

Autenticación: JWT.

Modelo multi-tenant: Company.

El companyId obtenido del usuario autenticado constituye la frontera principal de tenant para los recursos empresariales.

Los módulos actuales implementan tenant scoping sobre sus operaciones principales. La cobertura sistemática de aislamiento entre Companies y el hardening de operaciones legacy permanecen como trabajo P0 previo a producción.

La validación global de NestJS utiliza:

whitelist = true

forbidNonWhitelisted = true

transform = true

Módulos

ERP Core

Actualmente están implementados y validados los principales módulos del ERP Core.

Dashboard

Incluye:

datos operacionales reales

KPIs

inventario bajo

ventas recientes

contexto operacional

Clientes y Proveedores

Incluyen:

creación

consulta

edición

búsqueda

desactivación no destructiva

preservación de relaciones históricas

La desactivación utiliza:

isActive = false

y no elimina físicamente los registros.

Productos y Categorías

Products soporta:

SKU

nombre

descripción

marca

categoría

barcode

costo

precio

stock

stock mínimo

estado activo

inventoryTracking

lotTracking

Estrategias de inventario:

QUANTITY

SERIALIZED

ASSET

Estrategias de lote:

NONE

OPTIONAL

REQUIRED

Product.stock no se modifica mediante el CRUD normal de Products.

Inventario

Inventory incorpora un ledger de movimientos con:

IN

OUT

ADJUSTMENT

y trazabilidad mediante:

referenceType

referenceId

balance

unitCost

createdAt

Product

La experiencia frontend incluye:

Existencias

Movimientos

Capacidades como:

InventoryLocation

InventoryPosition

internal transfer semantics

permanecen como TARGET / architectural candidates cuando una necesidad futura lo requiera.

No son comportamiento CURRENT.

Equipment

EquipmentAsset representa la identidad física de equipos reutilizables.

Equipment V1 incluye:

assetCode automático

serialNumber opcional

lifecycle

condition

origin

Current Availability

inspection history

inspection workflow

retirement

manual creation

Purchase Receipt provisioning

search / filters

detail

deep-link

Estados principales:

Lifecycle

ACTIVE

RETIRED

Condition

GOOD

INSPECTION_PENDING

DAMAGED

OUT_OF_SERVICE

La disponibilidad actual se deriva de hechos Core y no se persiste como un boolean manual.

Healthcare extenderá posteriormente este dominio mediante:

Equipment Assignment

Case Availability

Dispatch

Custody

Return

sin duplicar EquipmentAsset.

Debe mantenerse:

Equipment Assignment / Custody
≠
EquipmentLifecycle

Cotizaciones

Quotes V1 incluye:

creación

consulta

búsqueda

filtro por estado

detalle basado en datos cargados actualmente

aprobación

cancelación

PDF

conversión Quote → Sale

Estados actuales:

DRAFT

CONFIRMED

CANCELLED

La conversión utiliza la Sale creada realmente por backend y permite navegar hacia:

/sales?saleId=<id>

Permanece deuda futura alrededor de detalle/deep-link cuando exista paginación server-side.

Ventas

Sales V1 utiliza actualmente el modelo Sale.

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

Los folios se generan mediante CompanySequence:

V-000001

V-000002

...

El flujo genérico actual admite Products:

inventoryTracking = QUANTITY

AND

lotTracking != REQUIRED

SalesOrder + Delivery permanece como arquitectura TARGET para separar compromiso comercial de fulfillment físico.

Compras

Purchases V1 soporta:

DRAFT

CONFIRMED

PARTIALLY_RECEIVED

RECEIVED

CANCELLED

Incluye:

creación

edición de DRAFT

confirmación

cancelación

detalle

PDF

búsqueda

filtros

Purchase Receipts

recepción parcial

recepción completa

Confirmar una Purchase:

no modifica inventario

El inventario cambia cuando se registra físicamente una recepción.

Permanece deuda de integridad para validar backend:

active Supplier
+
active Product

en nuevas/edited Purchases.

Recepciones de compra

Purchase Receipts V1 incluye:

partial receiving

full receiving

lot tracking

InventoryBatch integration

Product.stock increment

InventoryMovement IN

EquipmentAsset provisioning

idempotency

dedicated list/detail frontend

cross-module traceability

Flujo:

Purchase CONFIRMED / PARTIALLY_RECEIVED
        ↓
PurchaseReceipt
        ↓
PurchaseReceiptItem
        ├── Product.stock increment
        ├── InventoryMovement IN
        ├── InventoryBatch when applicable
        └── EquipmentAsset for ASSET Products
        ↓
Purchase PARTIALLY_RECEIVED / RECEIVED

POST /purchase-receipts utiliza:

Idempotency-Key

con protección contra:

duplicate retry

same key + different payload

cross-tenant key collision

La idempotencia funcional está implementada.

Permanece como deuda de QA:

real simultaneous PostgreSQL concurrency test

Zaping Healthcare

Healthcare Case Foundation está implementado y validado en backend.

Actualmente incluye:

HealthcareCase

folio

planning schedule

responsible User

minimal lifecycle

cancellation

tenant context

creation/cancellation audit facts

Estados CURRENT:

DRAFT

SCHEDULED

CANCELLED

API:

POST /healthcare/cases

GET /healthcare/cases

GET /healthcare/cases/:id

PATCH /healthcare/cases/:id

POST /healthcare/cases/:id/cancel

Healthcare Case Foundation no contiene información clínica ni expediente de paciente.

La evolución Healthcare TARGET es:

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

Debe mantenerse:

Requirements
≠
Preparation
≠
CaseKit

Healthcare consumirá las capacidades del ERP Core y no duplicará la identidad física de Equipment.

Opportunity, Payer / Insurance y KitTemplate permanecen FUTURE.

Organización del repositorio

app/api/

→ NestJS API

→ Prisma schema

→ migrations

→ backend tests

web/

→ Next.js App Router

→ frontend components

→ frontend tests

docs/

→ product

→ architecture

→ engineering

→ security

→ ERP modules

→ Healthcare modules

→ project state

Documentación

Fuentes principales:

Índice documental

Arquitectura

Security Principles

ERP Core UI/UX

Identity & Access

Equipment

Inventario

Recepciones de compra

Healthcare

Healthcare Domain Model

Healthcare Cases

Project Board

Roadmap

Changelog

Responsabilidades:

PROJECT_BOARD.md
→ estado actual / blockers / deuda

ROADMAP.md
→ dirección futura

CHANGELOG.md
→ historia consolidada

docs/modules/
→ comportamiento funcional vigente

ADR
→ decisiones arquitectónicas

Desarrollo local

Requisitos

Se requiere:

Node.js

npm

Docker

PostgreSQL mediante Docker Compose

La configuración sensible debe proporcionarse mediante variables de entorno.

No deben agregarse al repositorio:

passwords

JWT secrets

database credentials

API secrets

tokens

.env backups containing credentials

1. Levantar infraestructura

Desde la raíz del repositorio:

docker compose up -d

2. Backend

En una terminal independiente:

cd app/api

npm install

npx prisma generate

npm run start:dev

Si se está preparando una base de datos nueva, deben aplicarse las migraciones existentes según el workflow de desarrollo definido por el proyecto.

La API escucha por defecto en:

http://localhost:3001

3. Frontend

En otra terminal:

cd web

npm install

npm run dev

El frontend escucha por defecto en:

http://localhost:3000

Calidad

Los cambios deben validar según su alcance:

backend tests

frontend tests

backend build

frontend build

backend lint

frontend lint

Prisma validate

Prisma migrate status when applicable

manual QA for operational workflows

tenant isolation when applicable

authorization when applicable

git diff --check

Una tarea no se considera terminada únicamente porque:

code compiles

La Definition of Done puede incluir:

business rules

architecture review

implementation

migration

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

El snapshot cuantitativo vigente de calidad se mantiene en:

docs/project/PROJECT_BOARD.md

y no debe duplicarse de forma permanente en documentos arquitectónicos o en este README.

Seguridad

La arquitectura actual incorpora:

JWT

JwtAuthGuard

RolesGuard where configured

tenant context through companyId

DTO validation

ValidationPipe

non-destructive lifecycle where applicable

La sanitización histórica de respuestas de autenticación para evitar exposición de passwordHash ya fue corregida.

Password Security V1:

IMPLEMENTED

La implementación cubre cambio autenticado de contraseña, invalidación por
`authVersion` y recovery seguro con token de un solo uso. No equivale a
production-ready ni RC-ready.

Antes de pilot/commercial production deben completarse o verificarse los P0
relacionados con:

systematic tenant-isolation regression

critical authorization review

protected-route / session architecture

authentication abuse protection / rate limiting

production secrets / configuration review

real password-recovery email delivery/configuration

dependency/security maintenance before RC

Regla:

public password reset
without secure recovery proof
→ P0 blocker

El flujo de password recovery implementado demuestra control de la cuenta
mediante un mecanismo seguro antes de permitir el cambio de contraseña. La
verificación de sender/domain, configuración válida y E2E real
forgot → email → reset → login sigue pendiente.

La arquitectura exacta se mantiene en:

docs/engineering/SECURITY_PRINCIPLES.md

docs/project/PROJECT_BOARD.md

La estrategia CURRENT de JWT almacenado en cliente debe revisarse antes de producción y no debe considerarse una decisión irreversible.

Deuda técnica visible

La deuda vigente se mantiene de forma autoritativa en:

docs/project/PROJECT_BOARD.md

Entre los temas principales permanecen:

authentication abuse protection / rate limiting

systematic tenant-isolation regression

critical authorization review

protected-route / session architecture

production secrets / configuration

real password-recovery email delivery/configuration

dependency/security maintenance before RC

Sales create idempotency

Healthcare Case create idempotency

real simultaneous PostgreSQL concurrency QA
for Purchase Receipt idempotency

Product.stock
↔
EquipmentAsset reconciliation

SERIALIZED receipt semantics

inactive Supplier validation
for new / edited Purchases

inactive Product validation
for new / edited Purchases

historical Quote
→ Sale identity

backend pagination

server-side filtering

Inventory date/reference filtering

Purchase / Quote deep-link-detail compatibility
with future pagination

Equipment pagination / serial correction

Receipt PDF

Receipt correction / reversal

Product / Customer / Supplier reactivation

Table Object.values(row) fragility

Modal accessibility / focus management

frontend test worker resource exhaustion

El detalle y prioridad de cada deuda debe consultarse en PROJECT_BOARD.md.

Estado inmediato

El orden vigente del proyecto es:

H8A
→ final documentation/security synchronization

H8B
→ full automated technical regression

UX-B.6
→ full ERP end-to-end QA

ERP Core V1
→ formal closure after quality + security gates

Zaping Healthcare
→ next strategic stage

Durante este cierre no deben abrirse nuevas funcionalidades importantes del ERP Core salvo que aparezca un defecto P0 que bloquee la release.

Healthcare TARGET tampoco debe expandirse en Prisma durante H8.

Principio del proyecto

Zaping debe crecer por capas:

Reliable Core
↓
Secure / Release-Ready Core
↓
Healthcare Differentiation
↓
Great Operational Experience
↓
Broader ERP Capabilities
↓
Radar
↓
AI
