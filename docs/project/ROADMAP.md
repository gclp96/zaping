Producto: Zaping Platform
Versión del documento: 1.3.0
Estado: Activo
Última actualización: 2026-08-27
Responsable: Zaping Team

1. Propósito
Este documento define la dirección futura de Zaping.

Debe responder:

¿Qué capacidades necesitamos después?

¿Por qué son importantes?

¿Qué depende de qué?

¿Qué pertenece al ERP Core?

¿Qué pertenece a Healthcare?

¿Qué debe esperar?

¿Qué líneas de producto vienen después?
El Roadmap representa intención estratégica, prioridad y dependencias.

No representa:

el estado diario de tareas;

el historial de desarrollo;

compromisos contractuales;

fechas garantizadas;

una lista exhaustiva de tickets;

snapshots de cada implementación.

2. Responsabilidades documentales
ROADMAP.md

→ dirección futura

→ prioridades estratégicas

→ dependencias

→ evolución del producto
PROJECT_BOARD.md

→ ejecución actual

→ estado vigente

→ blockers

→ deuda activa

→ siguiente trabajo
CHANGELOG.md

→ historia completada

→ entregas cerradas

→ snapshots históricos
Cuando una iniciativa pase a ejecución:

ROADMAP
↓
PROJECT_BOARD
Cuando quede completada:

PROJECT_BOARD
↓
CHANGELOG
3. Secuencia estratégica vigente
La normalización funcional H7 del ERP Core está completada.

La secuencia inmediata actual es:

H8A — Documentation Synchronization
↓
H8B — Full Automated Regression / Technical Health
↓
UX-B.6 — Full ERP End-to-End QA
↓
ERP Core V1 Closure
↓
Zaping Healthcare
Healthcare Case Foundation ya existe en backend.

Permanecen como TARGET Healthcare:

Hospital / Doctor

Requirements

Equipment Assignment

Case Availability

Dispatch / Custody

Return

CaseKit / Maletín

Calendar

Case 360

Mobile Technician
Después del cierre del ERP Core V1, Healthcare se convierte en el workstream principal de producto.

4. Visión de evolución
La dirección general es:

Zaping Platform
│
├── ERP Core
│   └── base empresarial reutilizable
│
├── Zaping Healthcare
│   └── vertical especializada inicial
│
├── Zaping Radar
│   └── inteligencia de oportunidades externas
│
└── Zaping AI
    └── capa futura de inteligencia
El desarrollo debe preservar esta jerarquía.

Healthcare debe construirse sobre ERP Core.

Radar debe mantener una identidad propia dentro del ecosistema.

AI debe construirse sobre dominios y datos confiables.

5. Principio de prioridad
La prioridad no es construir la mayor cantidad posible de módulos.

La prioridad es construir:

un ERP confiable, comercializable y claramente diferenciado.

Orden estratégico:

Stability
↓
Security / Release Readiness
↓
Healthcare Differentiation
↓
ERP Expansion
↓
External Intelligence
↓
AI
6. Regla de enfoque
Mientras el ERP Core tenga riesgos importantes de:

seguridad;

consistencia;

aislamiento tenant;

UX operativa;

migración de datos;

confiabilidad;

ventas/inventario;

release readiness;

no debe desplazarse esfuerzo significativo hacia funcionalidades experimentales.

Durante la fase actual de cierre del ERP Core, una distribución orientativa puede ser:

≈ 80 %

ERP stability

release readiness

QA

security

documentation
≈ 15 %

UX

Healthcare design readiness

product preparation
≈ 5 %

Radar research / definition
≈ 0 %

AI product implementation
Esta distribución no es contractual.

Después del cierre del ERP Core V1:

Healthcare
→ principal workstream estratégico
7. Etapa 0 — Documentation & Architecture Baseline
Estado: En cierre

Objetivo:

establecer una fuente documental coherente antes de ampliar nuevamente el producto.

Incluye:

Product

Architecture

ADR

Engineering

Security

UX

ERP Modules

Healthcare Modules

Project Planning

Templates
Resultado esperado:

Documentación vigente

+

sin duplicados críticos

+

sin arquitectura legacy presentada como actual

+

fuentes de verdad claras

+

CURRENT / TARGET / FUTURE diferenciados

+

deuda separada de implementación
Salida de esta etapa:

docs/README saneado

PROJECT_BOARD consolidado

ROADMAP consolidado

CHANGELOG consolidado

módulos sincronizados

arquitectura revisada

seguridad revisada

referencias internas verificadas
Cierre H8A requiere además:

final cross-document synchronization

security blocker synchronization

Markdown consistency

git status review

git diff --check

credential / .env backup review
8. Etapa 1 — ERP Core Release Readiness
Prioridad: P0

Objetivo:

transformar el ERP Core funcional actual en una base suficientemente segura, consistente y verificable para comenzar pilotos reales.

Esta etapa comprende:

H8A
↓
H8B
↓
UX-B.6
↓
ERP Core V1 Closure
8.1 Security Hardening
Capacidades P0 pendientes:

Secure password recovery

↓

Explicit user role safety

↓

Inactive-user enforcement

↓

Tenant isolation regression

↓

Critical authorization review

↓

Protected-route / session hardening

↓

Authentication abuse protection / rate limiting

↓

Production secrets / configuration review
La sanitización histórica de passwordHash ya fue resuelta y no forma parte del trabajo futuro.

8.2 Secure Password Recovery
El endpoint CURRENT de password reset no debe considerarse apto para pilot/commercial production si permite restablecer una contraseña sin demostrar control de la cuenta.

Debe existir una estrategia equivalente a:

recovery request

↓

secure random token

↓

single use

↓

short expiration

↓

account-control proof

↓

password reset

↓

token invalidation
Además debe contemplar:

safe response semantics

no account enumeration

abuse protection

audit where appropriate
Regla:

public password reset
without secure recovery proof
→ P0 blocker
8.3 Safe User Provisioning
Debe revisarse:

User.role @default(ADMIN)
Objetivo:

normal user creation
→ explicit authorized role
Debe evitarse cualquier elevación accidental de privilegios.

Cobertura necesaria:

user creation flows

role assignment

authorization

privilege escalation regression
8.4 Inactive User Enforcement
Debe garantizarse:

User.isActive = false
↓
no normal application access
La desactivación debe afectar autenticación y sesión de manera consistente.

8.5 Tenant Isolation
Debe existir cobertura sistemática:

Company A
↛
Company B resources
Para operaciones críticas de:

Customers

Suppliers

Products

Purchases

Purchase Receipts

Inventory

Equipment

Quotes

Sales

Healthcare Cases

future resources
Debe cubrir:

read

create

update

lifecycle actions

exports where applicable

cross-module navigation
8.6 Critical Authorization Review
Debe verificarse:

sensitive endpoints

RolesGuard / authorization coverage

server-side authorization

business-action permissions

no frontend-only access assumptions
antes de release productivo.

8.7 Protected Route / Session Architecture
CURRENT frontend utiliza:

authenticated route group

AppShell

JWT client-side storage

API interceptor / 401 handling
Antes de producción debe revisarse formalmente:

session bootstrap

protected deep-link refresh

unauthenticated access behavior

logout consistency

token/session storage strategy

protected-page flash
La estrategia CURRENT de JWT en localStorage no debe tratarse como irreversible para producción.

8.8 Authentication Abuse Protection
Antes de producción deben protegerse especialmente:

/auth/login

/auth/register

password recovery endpoints
mediante controles apropiados como:

rate limiting

retry controls where appropriate

monitoring

safe error semantics
La estrategia debe evitar introducir un lockout fácilmente explotable como denial-of-service.

8.9 Production Secrets / Configuration
Antes de pilot/commercial production debe revisarse:

JWT_SECRET / secrets management

environment separation

no committed credentials

production database configuration

debug/dev settings

production-safe defaults
8.10 Core Regression
H8B debe ejecutar:

Backend tests

Frontend tests

Backend lint

Frontend lint

Backend build

Frontend build

Prisma validate

Prisma migrate status

Git health
Si la ejecución paralela de frontend tests falla por agotamiento de workers/recursos:

infrastructure/resource failure
≠
application test failure
y la suite completa puede ejecutarse de forma serial para obtener un resultado confiable.

8.11 Operational Reliability
UX-B.6 debe validar los workflows V1 principales:

Supplier
↓
Purchase
↓
Purchase Receipt
↓
Inventory IN
Customer
↓
Quote
↓
Sale
↓
Inventory OUT
Purchase Receipt ASSET
↓
Equipment
↓
Inspection
↓
Current Availability
También:

folios

statuses

deep-links

PDFs

lifecycle

traceability

tenant isolation

authorization

idempotency replay/conflict where implemented

historical deactivation behavior
8.12 ERP Core V1 Closure
La salida de esta etapa debe significar:

ERP Core
→ functionally closed for V1

→ documented

→ regression validated

→ end-to-end QA validated

→ security P0 resolved or formally closed

→ known debt explicitly recorded
No significa que el ERP esté terminado para siempre.

Significa que la base V1 es suficientemente estable para dejar de abrir nuevas funcionalidades Core de manera indiscriminada.

9. Etapa 2 — Zaping Healthcare
Prioridad: P1 estratégica inmediata después del cierre ERP Core V1

Objetivo:

convertir la especialización Healthcare en el principal diferenciador inicial de Zaping frente a ERP genéricos.

Healthcare se construye:

sobre ERP Core
no:

dentro de cada tabla del ERP Core
Debe evitarse contaminar el modelo genérico con conceptos específicos del vertical.

9.1 Estado de partida
Healthcare Case Foundation ya está:

IMPLEMENTED / VALIDATED
Incluye:

HealthcareCase

folio

planning schedule

responsible User

minimal lifecycle

cancellation

tenant context

localized audit facts
Estados CURRENT:

DRAFT

SCHEDULED

CANCELLED
También existe en ERP Core:

EquipmentAsset

EquipmentInspection
Permanecen fuera de Foundation:

Hospital

Doctor

Requirements

Equipment Assignment

Case Availability

Preparation

Dispatch

Custody

Return

CaseKit

Calendar

Case 360

Mobile Technician
9.2 Orden recomendado Healthcare
1. Hospital / Doctor

2. Requirements

3. Equipment Assignment

4. Case Availability

5. Dispatch / Custody

6. Return

7. CaseKit / Maletín

8. Case Calendar

9. Case 360

10. Mobile Technician
El orden puede ajustarse cuando aparezca evidencia operacional real, pero deben respetarse las dependencias.

9.3 Healthcare Actors
Mantener conceptualmente separados:

Doctor

Hospital

Customer

Payer

responsible User / Technician function
porque representan responsabilidades distintas.

No asumir:

Customer
=
Hospital
=
Doctor
=
Payer
Technician utiliza inicialmente:

User
como identidad operacional.

No debe crearse una identidad Healthcare separada sin una necesidad real de dominio.

9.4 Healthcare Case
HealthcareCase representa una operación desde el punto de vista:

operacional

+

logístico
y puede relacionarse posteriormente con contexto comercial.

No debe convertirse en:

clinical record

patient record

PHI repository
9.5 Hospital / Doctor
Hospital y Doctor serán master data Healthcare TARGET.

Debe mantenerse:

Doctor
≠
Customer
Hospital
≠
Customer
La estrategia exacta de tenant ownership debe decidirse antes de implementación:

Company-owned master data
vs:

shared identity
+
tenant-specific relation
No debe asumirse todavía una estrategia definitiva en Prisma.

9.6 Requirements
Un Case debe poder expresar qué necesita antes de seleccionar recursos físicos.

Conceptualmente:

Case
↓
Requirements

├── Products / Materials

└── Equipment needs
Debe mantenerse:

Requirements
→ what is needed
Preparation
→ work performed to satisfy the need
CaseKit
→ actual prepared set
Estos conceptos no deben confundirse.

9.7 Equipment Assignment
Debe relacionar:

HealthcareCase

+

EquipmentAsset
sin duplicar la identidad física del Equipment.

Principio:

ERP Core
→ EquipmentAsset identity

Healthcare
→ operational Assignment
Assignment deberá considerar los hechos necesarios para evitar conflictos, pero el schema exacto se decidirá en su slice.

Debe mantenerse:

Assignment
≠
EquipmentLifecycle
y:

Assignment
≠
Custody
9.8 Case Availability
Current Equipment Availability ya está implementado en ERP Core.

Actualmente:

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
Healthcare deberá extender esta evaluación hacia:

Case Availability
considerando cuando existan:

Assignment conflicts

Case schedule

active custody

other operational blockers
No debe reemplazarse Availability con un boolean persistido manualmente.

Maintenance, Calibration y Turnaround permanecen evoluciones posteriores.

9.9 Preparation
Preparation representa el trabajo necesario para satisfacer Requirements.

Puede incluir:

requirements review

availability checks

material picking

Equipment Assignment

CaseKit assembly

documentation
Preparation no debe implicar automáticamente:

commercial Inventory OUT
9.10 CaseKit / Maletín
CaseKit representa la preparación real de material para un Case específico.

Puede contener conceptualmente:

Products

quantities

batches

Equipment

preparation state
La cardinalidad y schema exactos se definirán posteriormente.

Debe mantenerse:

CaseKit
≠
Requirements
y:

CaseKit
≠
automatic Inventory OUT
KitTemplate permanece FUTURE como capacidad de productividad reutilizable y no debe bloquear la primera implementación de CaseKit.

9.11 Dispatch / Custody
Debe formalizar:

Preparation
↓
Dispatch
↓
Custody
Regla crítica:

CaseDispatch
≠
Delivery
y:

CaseDispatch
≠
commercial Inventory OUT
El material puede estar:

fuera del almacén
pero continuar siendo propiedad de la Company.

La semántica técnica exacta de ubicación/custodia deberá resolverse mediante diseño/ADR antes de Dispatch real.

No debe asumirse de forma anticipada:

Dispatch
→ InventoryMovement TRANSFER
como contrato CURRENT.

9.12 Return
Después del Case:

Custody
↓
Return
↓
Inspection where required
↓
Reconciliation
El Return Healthcare no debe confundirse con Commercial Return.

Debe mantenerse:

CaseReturn
≠
Commercial Return
y:

Returned
≠
Automatically Available
cuando se requiera inspección.

9.13 Reconciliation
Debe cumplirse conceptualmente:

Dispatched
=
Consumed
+
Returned
+
Unresolved
Unresolved debe preferirse como valor derivado.

Consumed
La cantidad consumida representa verdad operacional.

No debe significar automáticamente:

Sale

Delivery

Invoice
La consecuencia comercial debe diseñarse por separado.

Returned
Puede requerir inspección y disposición antes de recuperar disponibilidad.

Para EquipmentAsset debe reutilizarse EquipmentInspection cuando la semántica aplique.

9.14 Equipment Boundary
EquipmentAsset debe conservar identidad física ERP Core:

EquipmentAsset

├── assetCode
├── Product
├── serialNumber
├── lifecycle
├── condition
├── origin
├── batch
└── history
Healthcare debe ser responsable de:

Assignment

Custody

Dispatch

Return

Case relation
No agregar directamente a EquipmentAsset campos específicos como:

currentCase

currentCustodian
si esos hechos pertenecen a workflows Healthcare.

9.15 Inventory / Custody Architecture Candidate
Healthcare introduce una necesidad futura de representar:

physical positioning

custody

availability

staging
Soluciones posibles incluyen:

InventoryLocation

InventoryPosition

internal transfer semantics
pero permanecen:

ARCHITECTURAL CANDIDATES
hasta que un ADR o diseño específico los apruebe.

9.16 Case Calendar
Debe proporcionar una lectura temporal de Cases.

Puede consumir:

Case schedule

responsible User

Hospital / Doctor context

Readiness

conflicts
Calendar debe ser inicialmente:

Read Model
y no una segunda fuente del schedule.

9.17 Case 360
Debe concentrar:

Case identity

Schedule

Hospital

Doctor

Responsible User

Requirements

Preparation

CaseKit

Equipment Assignment

Dispatch

Custody

Return

Reconciliation

Commercial references
sin duplicar ownership de cada dominio.

9.18 Healthcare Mobile
Una experiencia móvil especializada puede apoyar a técnicos con:

Cases

Schedule

CaseKit

Custody

Return

Reconciliation

Equipment
Debe consumir las mismas APIs y reglas de negocio.

9.19 Healthcare Opportunity
Una capa comercial previa puede existir posteriormente:

Doctor request

Technician prospecting

Commercial lead

↓

Opportunity

↓

Healthcare Case
Opportunity permanece:

FUTURE / optional
No es requisito para crear un HealthcareCase.

9.20 Payer / Insurance
Payer es un concepto reconocido, pero permanece FUTURE.

Debe mantenerse:

Payer
≠
Customer
y no debe introducirse un Patient model por defecto.

10. Etapa 3 — Commercial ERP Experience
Prioridad: P1

Objetivo:

reducir fricción y convertir módulos funcionales en una experiencia ERP más eficiente.

Healthcare será el workstream principal después del Core, pero mejoras UX seleccionadas pueden ejecutarse en paralelo si no retrasan dependencias Healthcare.

10.1 360 Views
Prioridad:

Customer 360

Product 360

Supplier 360

Purchase 360

Equipment 360
Posteriormente:

SalesOrder 360

Commercial Return 360

Healthcare Case 360
Principio:

Identity
↓
Current state
↓
Related activity
↓
Next actions
10.2 Action Dashboard
Dashboard 2.0 ya existe.

La evolución futura busca pasar de:

Counters
a:

Operational Context
↓
Attention
↓
Action
Ejemplo:

3 compras pendientes de recepción
[Revisar]

5 productos con bajo stock
[Reabastecer]

2 casos pendientes de retorno
[Revisar]
10.3 Global Search
Búsqueda transversal para:

Customers

Suppliers

Products

Purchases

Quotes

Sales / SalesOrders

Equipment

Healthcare Cases
según disponibilidad.

Debe respetar:

Tenant
+
Permissions
+
Resource lifecycle
10.4 Contextual Creation
Reducir navegación innecesaria.

Ejemplo:

New Purchase
↓
SupplierSelector
↓
Supplier does not exist
↓
Create Supplier
↓
continue Purchase
Sin perder formularios independientes.

10.5 UX Consistency
Continuar estandarizando:

Page layout

Actions

Forms

Tables

Filters

Statuses

Confirmation

Loading

Empty states

Errors

Modals

Navigation

Responsive behavior

Accessibility
Sin introducir un rediseño total innecesario.

10.6 Onboarding
Una Company nueva debe poder pasar rápidamente de:

Account created
a:

Useful ERP
Flujo conceptual:

Company setup
↓
Users
↓
Products
↓
Customers
↓
Suppliers
↓
Initial Inventory / Purchases
↓
First commercial operation
10.7 Setup Checklist
Dashboard puede mostrar:

Configura tu empresa      ✓
Agrega productos          ○
Importa clientes          ○
Registra proveedores      ○
Crea primera cotización   ○
para tenants nuevos.

11. Etapa 4 — Data Import & Migration
Prioridad: P1

Objetivo:

reducir significativamente el costo de adopción de Zaping.

Una PyME con años de información no puede depender exclusivamente de captura manual.

11.1 Importaciones iniciales
Prioridad:

Customers

Suppliers

Products

Inventory
11.2 Formatos
Inicialmente:

CSV

XLSX
11.3 Flujo de importación
Upload
↓
Column Mapping
↓
Validation
↓
Duplicate Detection
↓
Preview
↓
Batch Import
↓
Result Report
11.4 Sistemas de origen
La arquitectura debe permitir migraciones desde:

Excel

CONTPAQi

Aspel

Microsip

Odoo

SAP

otros ERP
sin construir un conector completo para cada sistema desde la primera versión.

11.5 Initial Inventory
Importar Products debe mantenerse separado de:

Initial Inventory
El inventario inicial requiere una operación:

controlled

traceable

auditable
No debe traducirse en:

Product.stock = spreadsheet value
sin origen ni contexto.

12. Etapa 5 — SalesOrder + Delivery
Prioridad: P1 estratégica

Objetivo:

separar compromiso comercial de fulfillment físico.

12.1 Modelo objetivo
Quote
↓ optional
SalesOrder
↓
Delivery
↓
Inventory OUT
12.2 SalesOrder
Debe representar:

Customer

Products

quantities

prices

totals

commercial commitment

pending quantities

optional Quote relation
12.3 Delivery
Debe representar:

physical fulfillment

actual delivered quantities

partial deliveries

batches

serialized units when applicable

date

destination

responsible actor

Inventory OUT
12.4 Entregas parciales
Ordered 100
↓
Delivery 40
↓
Delivery 30
↓
Pending 30
12.5 Quote Conversion
Evolución futura:

Quote
↓
SalesOrder
sin modificar inventario.

La implementación V1 CURRENT:

Quote
↓
Sale
permanece mientras no exista la nueva arquitectura.

12.6 Legacy Migration
La futura migración debe conservar:

folios

Customers

items

prices

statuses

InventoryMovement history

Quote relationships

Commercial Return relationships
No debe volver a producir:

Inventory OUT
para Sales ya procesadas.

12.7 Commercial Returns Evolution
Commercial Returns Backend no es blocker P0 del ERP Core V1.

Prioridad: P1 estratégica / Deferred

Diseño existente:

RET-001
→ completed

RET-002
→ completed

RET-003
→ schema/migration completed

RET-004
→ backend operational pending
Su evolución debe coordinarse con:

SalesOrder
↓
Delivery
↓
Commercial Return
↓
Inspection / Disposition
↓
Inventory
Debe mantenerse:

Commercial Return
≠
Healthcare CaseReturn
No profundizar innecesariamente dependencias físicas sobre Sale.

13. Etapa 6 — Inventory Traceability
Prioridad: P1

Objetivo:

convertir Inventory en una ventaja competitiva para distribuidores médicos.

13.1 FEFO
Implementar:

First Expired, First Out

Debe considerar:

Expiration

Availability

Batch state

Quantity

future location/custody context when implemented
13.2 Expiration Management
Incluir progresivamente:

Expired

Near Expiration

30 / 60 / 90 day visibility

Sellability

Alerts

Dashboard integration
13.3 Batch Allocation
Future Delivery debe conocer:

qué lote
+
qué cantidad
se entregó.

Esto habilita:

Commercial Returns

commercial traceability

FEFO

lot history
Healthcare tendrá su propia integración logística sin depender necesariamente de Delivery para reconciliar custodia.

13.4 SERIALIZED vs ASSET
Zaping distingue:

SERIALIZED
≠
ASSET
SERIALIZED representa inventario unitario serializado que no necesariamente es Equipment reutilizable.

ASSET representa identidad física persistente de Equipment.

Ambos pueden utilizar seriales, pero pertenecen a workflows distintos.

La semántica operacional de SERIALIZED permanece pendiente.

13.5 Kardex
Inventory debe proporcionar una lectura operativa:

Date

Origin

IN

OUT

Balance

Lot

User
sin sustituir InventoryMovement como fuente histórica.

14. Etapa 7 — Audit & Advanced Authorization
Prioridad: P1 / P2

Objetivo:

aumentar trazabilidad y control conforme Zaping entre a operaciones empresariales más sensibles.

14.1 Audit Foundation
Primera versión:

AuditEvent

companyId

actor

action

resource

timestamp

safe metadata
Comportamiento:

append-only
14.2 Cobertura inicial
Prioridad:

Identity

Company

Inventory

Purchases

Receipts

Sales / Deliveries

Commercial Returns

Healthcare Cases

Equipment
14.3 Permission-Based RBAC
Evolucionar:

UserRole
↓
RolesGuard
hacia:

Role
↓
Permissions
↓
PermissionsGuard
14.4 Default Roles
Los roles actuales pueden convertirse en presets:

Administrator

Manager

Sales

Warehouse
14.5 Custom Roles
Posteriormente:

Compras

Supervisor de Almacén

Auditor

Ventas Junior

Healthcare Technician
basados en Permissions.

15. Etapa 8 — Multi-Warehouse & Advanced Inventory
Prioridad: P2 / architectural evolution

Objetivo:

soportar empresas con mayor complejidad logística.

Las estructuras exactas deben aprobarse mediante diseño/ADR antes de implementación.

15.1 Warehouses
Warehouse es una capacidad TARGET razonable para empresas con múltiples almacenes.

El schema definitivo deberá diseñarse cuando exista prioridad real.

15.2 Locations
Una futura estrategia puede representar:

Zone

Rack

Bin

Quarantine

Staging
según necesidad real.

InventoryLocation permanece architectural candidate hasta aprobación formal.

15.3 Inventory Position
Una futura posición puede requerir dimensiones como:

Product

+

Batch

+

Location

+

State
La estrategia de persistencia/source of truth debe definirse mediante ADR.

15.4 Internal Transfers
Debe existir en el futuro una semántica para:

Location A
↓
Location B
sin tratar automáticamente el hecho como una salida comercial.

La implementación exacta no se fija todavía.

15.5 Stock Counts
System Quantity
vs
Physical Quantity
↓
Difference
↓
Authorized Adjustment
15.6 Reservations
Antes de implementarlas debe definirse:

Physical

Reserved

Available
y su interacción con:

SalesOrder

Healthcare

Warehouse

Delivery
16. Etapa 9 — Billing & Mexican Commercial Requirements
Prioridad: P2 / necesaria para madurez comercial en México

Objetivo:

completar el ciclo económico sin mezclarlo con fulfillment físico.

16.1 Separación de responsabilidades
SalesOrder
≠
Delivery
≠
Invoice
16.2 CFDI
La implementación mexicana requerirá revisar:

RFC

razón social

régimen fiscal

código postal

uso CFDI

impuestos

timbrado

cancelación

XML

PDF
16.3 Fiscal Profiles
Customer y Company requerirán estructuras fiscales diseñadas explícitamente.

No agregar campos fiscales aislados sin diseño de Billing.

16.4 Accounts Receivable
Invoice
↓
Balance
↓
Payment
↓
Accounts Receivable
16.5 Credit Management
Solo con saldos confiables tendrá sentido utilizar:

Customer.creditLimit
como control operacional real.

16.6 Supplier Finance
Posible evolución:

Accounts Payable

Supplier Invoices

Payments
si el alcance comercial lo requiere.

17. Etapa 10 — Portals & Mobile
Prioridad: P2

Objetivo:

extender Zaping fuera de la interfaz interna principal.

17.1 Customer Portal
Capacidades progresivas:

Quotes

Orders

Deliveries

Invoices

Documents
según permisos.

17.2 External Identity
Customer Portal requerirá identidad externa segura.

No debe utilizar:

Customer.email
como login implícito.

17.3 Sales Mobile
Capacidades candidatas:

Customers

Products

Quotes

SalesOrders

Field activity
17.4 Healthcare Mobile
Capacidades:

Cases

CaseKit

Custody

Return

Reconciliation

Equipment
17.5 API reutilizable
Portal y Mobile deben consumir las mismas capacidades de negocio.

No crear reglas independientes por canal.

18. Etapa 11 — Zaping Radar
Prioridad: Future / exploración estratégica

Objetivo:

convertir oportunidades externas en inteligencia accionable para empresas que venden al sector público y Healthcare.

18.1 Alcance inicial
Regiones iniciales consideradas:

Sonora

Baja California

Baja California Sur

Nuevo León

Sinaloa
con énfasis en:

licitaciones

oportunidades del sector salud
18.2 Radar como producto
Radar puede funcionar:

Standalone
y:

Integrated with Zaping ERP
cuando aporte valor.

18.3 Integración potencial
Tender / Opportunity
↓
Radar
↓
ERP Opportunity
↓
Quote
↓
Commercial process
sin acoplar Radar directamente al dominio transaccional.

18.4 Capacidades futuras
Source Monitoring

Opportunity Normalization

Filters

Alerts

Saved Searches

Tender Workspace

Document Analysis

Commercial Fit

ERP Integration
18.5 Regla
Radar no debe retrasar:

Security

Release readiness

Healthcare

Data adoption

Core reliability
19. Etapa 12 — Zaping AI
Prioridad: Future

Objetivo:

convertir información operacional confiable en asistencia y automatización explicable.

19.1 Principio
Reliable Data
+
Reliable Workflows
↓
Useful AI
No al revés.

19.2 Capacidades candidatas
Natural Language Queries

Operational Summaries

Replenishment Suggestions

Sales Insights

Anomaly Detection

Tender Analysis

Document Assistance

Workflow Recommendations
19.3 AI explicable
Toda recomendación debe poder relacionarse con datos reales.

Ejemplo:

Revisar Product CAT-001

Stock actual: 4

MinStock: 10

Pending Purchases: 0
19.4 Authorization
Una consulta AI debe aplicar:

Identity

Tenant

Permissions

Domain Rules
igual que cualquier otra interfaz.

19.5 Acciones automáticas
Debe distinguirse:

Recommendation
de:

Automated Business Action
Acciones automáticas futuras requerirán:

authorization

audit

confirmation

safe execution

failure handling
20. Capacidades transversales futuras
Algunas capacidades afectan varias etapas:

Notifications

Document Management

Advanced Reporting

Analytics

Integrations

Public API

Webhooks

Localization

Internationalization

Observability

Backups
Se implementarán cuando sus dependencias estén maduras.

20.1 Notifications
Ejemplos:

Low Stock

Expiration

Pending Receipt

Pending Delivery

Healthcare Case

Return

Tender Opportunity
20.2 Document Management
Puede soportar:

quotes

orders

licitaciones

contracts

certificates

regulatory documents

PDFs

attachments
Debe respetar tenant isolation.

20.3 Reporting
Evolución:

Operational Reports

Commercial Reports

Inventory Reports

Healthcare Reports

Exports
sin convertir prematuramente Dashboard en una plataforma BI.

20.4 Integrations
Posibles integraciones:

CONTPAQi

email

CFDI / PAC

carriers

supplier systems

public procurement sources
Cada integración deberá contemplar:

ownership

security

retries

audit

failure handling
20.5 Public API
Debe distinguirse:

Application API
de:

Public API
Una Public API futura puede requerir:

versioning

credentials

quotas

webhooks

compatibility guarantees
21. Lo que no debe priorizarse todavía
No invertir significativamente en:

Microservices

Kubernetes for product complexity alone

Complex Event Bus

Data Warehouse

Advanced ML infrastructure

Marketplace

Plugin ecosystem

Global multi-region
sin necesidad demostrada.

22. Principio arquitectónico
Zaping continúa con:

Modular Monolith until evidence says otherwise.

La evolución del producto no exige convertir cada capacidad en un servicio independiente.

Debe priorizarse:

clear domain boundaries

+

testability

+

tenant safety

+

reliable transactions

+

maintainability
antes que complejidad distribuida.

23. Dependencias principales
La secuencia de capacidades no es arbitraria.

HealthcareCase
+
EquipmentAsset
↓
Equipment Assignment
↓
Case Availability
↓
Dispatch / Custody
HealthcareCase
+
Requirements
↓
Preparation
↓
CaseKit
Dispatch / Custody
↓
Return
↓
Reconciliation
Healthcare Reconciliation no depende de que SalesOrder / Delivery estén implementados.

La consecuencia comercial posterior es un dominio separado.

SalesOrder
↓
Delivery
↓
Batch Allocation
↓
Reliable Commercial Returns
InventoryBatch
↓
Expiration
↓
FEFO
Reliable Domains
↓
Audit
↓
Advanced Automation
Reliable Operational Data
↓
Analytics
↓
AI
24. Priorización comercial
Al evaluar iniciativas considerar:

Customer Value

Operational Risk

Revenue Potential

Differentiation

Dependencies

Development Cost

Security Impact

Migration Impact

UX Impact
No priorizar únicamente por facilidad técnica.

25. Regla para nuevas ideas
Una idea no entra automáticamente a desarrollo.

Debe pasar por:

Idea
↓
Product fit
↓
Priority
↓
Dependencies
↓
Roadmap
↓
Project Board
↓
Implementation
26. Estrategia competitiva
Zaping no debe copiar feature por feature a:

Odoo

CONTPAQi

Bind ERP

Microsip

Dynamics

NetSuite

SAP
La estrategia es competir mediante:

ERP Core sólido

+

UX más simple

+

Healthcare specialization

+

Traceability

+

Faster adoption
y posteriormente:

Radar

+

AI
27. Comercialización
El producto debe avanzar progresivamente:

Internal Use
↓
Controlled Pilot
↓
Early Customers
↓
Repeatable Onboarding
↓
Scalable SaaS
27.1 Pilotos
Antes de pilotos externos debe existir al menos:

secure password recovery

authentication abuse protection

safe role provisioning

inactive-user enforcement

critical flows stable

tenant isolation validated

critical authorization reviewed

protected-route/session behavior reviewed

production secrets/configuration reviewed

basic backups

error handling

QA

reasonable onboarding

operational support

internal documentation
27.2 SaaS Operations futuras
Posteriormente:

Subscriptions

Plans

Feature Entitlements

Tenant Provisioning

Tenant Suspension

Usage Limits

Support

Backups

Observability
No pertenecen todavía al ERP funcional principal.

28. Release Strategy
No utilizar números de versión como promesas de features futuras.

Una versión debe representar:

real

verifiable

completed

changes
Flujo de release:

Feature Complete
↓
Regression
↓
Security Review
↓
Migration Validation
↓
Release Candidate
↓
Release
29. Backlog y Sprints
No mantener un segundo backlog general dentro del Roadmap.

Trabajo accionable:

PROJECT_BOARD.md
o sistema de tickets.

Sprints pueden utilizarse operacionalmente, pero:

architecture

product behavior

roadmap
deben permanecer en sus fuentes responsables.

Trabajo histórico relevante:

CHANGELOG.md
30. Criterio de avance entre etapas
Las etapas no requieren completar el 100 % de todas las ideas.

La transición debe basarse en:

Critical dependencies resolved

+

Acceptable risk

+

Business value
El Roadmap no es lineal rígido.

Algunas iniciativas pueden ejecutarse en paralelo cuando no violen dependencias ni distraigan del workstream principal.

31. Prioridades actuales resumidas
P0 — Release / Integrity / Security
Documentation closure

Secure password recovery

Authentication abuse protection

Safe role provisioning

Inactive-user enforcement

Tenant isolation regression

Critical authorization review

Protected-route / session review

Production secrets / configuration

Core regression

ERP end-to-end QA

Release readiness
Commercial Returns Backend no es P0.

P1 estratégica inmediata
Zaping Healthcare

Hospital / Doctor

Requirements

Equipment Assignment

Case Availability

Dispatch / Custody

Return

CaseKit / Maletín

Calendar

Case 360

Mobile Technician
P1 posterior / paralelo
UX / 360

Action Dashboard

Global Search

Onboarding

Data Import

SalesOrder + Delivery

Commercial Returns evolution

Inventory Traceability

Audit

Permission-Based RBAC
P2
Multi-Warehouse

Advanced Inventory

Billing / CFDI

Accounts Receivable

Portals

Sales Mobile

Advanced Reporting

SaaS operations
Future
Healthcare Opportunity

Payer / Insurance

KitTemplate

Radar

AI

Advanced automation

Broader ecosystem
32. Fuente de verdad
ROADMAP.md
→ dirección futura
→ prioridades estratégicas
PROJECT_BOARD.md
→ estado actual
→ trabajo activo
→ blockers
CHANGELOG.md
→ historia
PRODUCT_VISION.md
→ visión de largo plazo
PRODUCT_REQUIREMENTS.md
→ capacidades esperadas
ADR
→ decisiones arquitectónicas
docs/modules/
→ comportamiento funcional por dominio
33. Regla de mantenimiento
Este Roadmap debe revisarse cuando:

cambie una prioridad estratégica;

se apruebe una nueva línea de producto;

una dependencia importante sea resuelta;

un aprendizaje real cambie el orden;

una capacidad deje de aportar valor;

se cierre una etapa estratégica importante.

No necesita modificarse con cada commit.

34. Principio final
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
External Intelligence
↓
AI
La prioridad inmediata es:

H8A
↓
H8B
↓
UX-B.6
↓
ERP Core V1 Closure
↓
Healthcare
No deben abrirse nuevas funcionalidades importantes del ERP Core antes de completar H8 y UX-B.6, salvo correcciones P0 necesarias para el cierre.

Healthcare TARGET tampoco debe expandirse en Prisma durante H8.
