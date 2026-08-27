# ERP Core UI / UX Completion — Zaping ERP

**Módulo:** ERP Core UI / UX
**Producto:** Zaping ERP Core
**Versión:** 1.3.0
**Estado:** Approved milestone scope
**Estado de implementación:** ERP CORE FUNCTIONAL NORMALIZATION H7 COMPLETED / VALIDATED
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

ERP Core UI / UX Completion estabiliza y normaliza la experiencia base de Zaping
ERP antes de ampliar los workflows especializados Healthcare.

Healthcare Case Foundation existe como capacidad backend separada.

Los siguientes dominios Healthcare permanecen posteriores:

```text
Hospital / Doctor

Requirements

Equipment Assignment

Case Availability

Dispatch / Custody

Return

CaseKit / Maletín

Calendar

Case 360

Mobile technician experience
```

Este documento actúa como fuente de verdad transversal para la experiencia
frontend del ERP Core dentro de los hitos UX-A.5 y UX-B.

---

# 2. Objetivo del milestone

El objetivo del trabajo ERP Core UI / UX es conseguir:

```text
consistent navigation

consistent page anatomy

real backend data

normalized loading/error/empty states

usable cross-module journeys

safe lifecycle actions

consistent deep-links

responsive authenticated shell

technical regression

end-to-end operational validation
```

antes de ampliar significativamente Healthcare.

---

# 3. CURRENT vs TARGET vs FUTURE

Este documento distingue:

## CURRENT

Funcionalidad implementada actualmente.

## VALIDATED

Funcionalidad cubierta por QA automatizado y/o manual según el hito
correspondiente.

## TECHNICAL DEBT

Capacidades o problemas conocidos que permanecen abiertos.

## TARGET

Mejoras aprobadas para etapas posteriores.

## FUTURE

Capacidades que no pertenecen al cierre inmediato del ERP Core V1.

---

# 4. Stack frontend CURRENT

Stack vigente en:

```text
web/
```

```text
Next.js 16.2.9

React 19.2.4

App Router

Tailwind v4

Vitest

axios
```

---

# 5. Route groups CURRENT

La aplicación utiliza:

```text
web/app/layout.tsx

web/app/(public)/

web/app/(app)/layout.tsx
```

Los route groups permiten separar layouts sin cambiar las URLs públicas.

Ejemplo:

```text
web/app/(app)/products
↓
/products
```

---

# 6. Estructura principal CURRENT

Conceptualmente:

```text
web/app/

├── layout.tsx
│
├── (public)/
│   ├── login/
│   ├── register/
│   └── forgot-password/
│
└── (app)/
    ├── layout.tsx
    ├── dashboard/
    ├── customers/
    ├── suppliers/
    ├── products/
    ├── inventory/
    ├── quotes/
    ├── purchases/
    ├── purchase-receipts/
    ├── sales/
    ├── equipment/
    └── categories/
```

---

# 7. Authenticated App Shell CURRENT

`(app)/layout.tsx` administra la estructura autenticada compartida.

Incluye:

```text
Sidebar

Header

main content region
```

Las páginas individuales no deben volver a montar:

```text
Sidebar

Header
```

de forma independiente.

Estado:

```text
Authenticated App Shell
✅ IMPLEMENTED / VALIDATED
```

---

# 8. App Shell responsive behavior

El App Shell implementa:

```text
persistent Sidebar on desktop

mobile navigation drawer

mobile drawer close behavior

shared Header

active navigation state

route-derived page title
```

Estado:

```text
responsive shell
✅ IMPLEMENTED / VALIDATED
```

---

# 9. Public routes

Rutas públicas como:

```text
/login

/register

/forgot-password
```

permanecen fuera del authenticated App Shell.

No deben mostrar:

```text
Sidebar

authenticated Header
```

---

# 10. Authentication client CURRENT

El cliente frontend utiliza actualmente:

```text
JWT
↓
localStorage
```

Axios adjunta el token a las requests autenticadas.

Ante:

```text
401
```

el comportamiento actual incluye:

```text
remove token
↓
redirect /login
```

---

# 11. Authentication architecture debt

La estrategia CURRENT no constituye todavía una arquitectura de sesión
preproducción completamente cerrada.

Permanecen abiertos:

```text
global protected-route enforcement

session bootstrap before private render

deep-link refresh behavior

protected-page flash

logout lifecycle consistency

inactive-user session enforcement

review of localStorage token strategy
```

---

# 12. Secure password recovery — P0

Existe actualmente una experiencia pública de recuperación/reset de contraseña.

Antes de pilot o producción debe existir un mecanismo seguro que verifique control
de la cuenta mediante un flujo como:

```text
recovery request
↓
secure one-time / expiring recovery proof
↓
password reset
```

Un reset público que permita cambiar una contraseña sin una prueba segura de
control de cuenta constituye:

```text
P0 PREPRODUCTION SECURITY BLOCKER
```

No debe considerarse resuelto únicamente porque exista:

```text
/forgot-password
```

en frontend.

---

# 13. Authentication abuse protection — P0

Antes de producción deben revisarse mecanismos básicos de protección contra abuso
en endpoints sensibles de Auth.

Incluye según corresponda:

```text
login

password recovery

password reset

registration
```

La dirección incluye:

```text
rate limiting

abuse protection

safe error behavior
```

Estado:

```text
PREPRODUCTION SECURITY WORK
```

---

# 14. Production readiness boundary

Debe distinguirse:

```text
H7 COMPLETED / VALIDATED
```

de:

```text
PRODUCTION READY
```

H7 confirma la normalización funcional del ERP frontend.

No significa que se hayan cerrado todavía:

```text
H8 regression

UX-B.6 E2E QA

security P0 blockers

authorization review

tenant isolation regression

session architecture
```

---

# 15. Navigation IA CURRENT

Sidebar utiliza actualmente:

```text
INICIO
- Dashboard

COMERCIAL
- Clientes
- Cotizaciones
- Ventas

COMPRAS
- Proveedores
- Compras
- Recepciones

INVENTARIO
- Productos
- Inventario
- Equipos

ADMINISTRACION
- Categorias
```

---

# 16. Navigation behavior

La navegación implementa:

```text
active route state

responsive behavior

shared navigation source

desktop Sidebar

mobile navigation
```

No deben mostrarse rutas inexistentes únicamente porque aparezcan en roadmap.

---

# 17. Permission-aware navigation

Actualmente:

```text
permission-aware navigation
→ TARGET
```

La Sidebar no debe considerarse todavía una frontera completa de autorización.

Debe mantenerse:

```text
navigation visibility
≠
backend authorization
```

---

# 18. Healthcare navigation

Los módulos Healthcare futuros no deben agregarse a navegación principal hasta que
sus rutas y workflows correspondientes existan.

Estado:

```text
Healthcare navigation expansion
→ FUTURE
```

---

# 19. Anatomía estándar de página ERP

Patrón aprobado:

```text
Authenticated App Shell
↓
PageContainer
↓
PageHeader
↓
primary actions
↓
search / filters
↓
page content
↓
loading / error / empty / data states
```

Las páginas deben reutilizar primitivas compartidas siempre que sea razonable.

---

# 20. Shared UI primitives CURRENT

Primitivas existentes:

```text
PageContainer

PageHeader

Section

Button

Card

Table

Badge

StatusBadge

Input

Select

Modal

ConfirmDialog

Loading

EmptyState
```

No debe introducirse un segundo Design System o framework externo de componentes
sin una decisión separada.

---

# 21. Dashboard CURRENT

Estado:

```text
DASHBOARD V1
✅ IMPLEMENTED / VALIDATED
```

`/dashboard` consume:

```text
GET /dashboard
+
GET /sales
```

con información real.

No utiliza Sales mock.

---

# 22. Dashboard CURRENT metrics

El Dashboard vigente presenta información relacionada con:

```text
Customers

Suppliers

Products

Quotes

Purchases

Sales

Inventory Value

Low Stock Products

Recent Sales
```

---

# 23. Dashboard error isolation

La carga principal y Recent Sales mantienen errores independientes.

Conceptualmente:

```text
GET /dashboard
✅

GET /sales
❌

→ main Dashboard remains usable
```

cuando la degradación es segura.

---

# 24. Dashboard TARGET

La evolución futura es:

```text
Operational Overview
↓
Action Dashboard
```

con:

```text
attention

tasks

context

navigation
```

No deben presentarse como CURRENT widgets aún no implementados de:

```text
SalesOrder

Delivery

Commercial Returns

advanced Healthcare

Audit

Notifications
```

---

# 25. Customers CURRENT

Estado:

```text
CUSTOMERS V1
✅ IMPLEMENTED / VALIDATED
```

Frontend soporta:

```text
active list

search

create

edit master data

detail

soft deactivation
```

No existe:

```text
hard delete

reactivation
```

---

# 26. Customer lifecycle in commercial UX

Para nuevas operaciones:

```text
inactive Customer
→ excluded / blocked
```

Backend valida Customer activo en:

```text
new Quote

new Sale
```

Las operaciones históricas continúan visibles después de una futura desactivación
del Customer.

---

# 27. Suppliers CURRENT

Estado:

```text
SUPPLIERS V1
✅ IMPLEMENTED / VALIDATED
```

Frontend soporta:

```text
active list

search

create

edit

detail

soft deactivation
```

No existe:

```text
hard delete

reactivation
```

---

# 28. Supplier active validation debt

Debe distinguirse de Customers:

```text
Customer active validation
for new Quote/Sale
✅
```

mientras:

```text
inactive Supplier rejection
for new Purchase
⏳ BACKEND DEBT
```

La UI no debe considerarse autoridad suficiente para esta regla.

---

# 29. Products CURRENT

Estado:

```text
PRODUCTS V1
✅ IMPLEMENTED / VALIDATED
```

`/products` soporta master data y tracking configuration.

Incluye:

```text
SKU

name

brand

Category

inventoryTracking

lotTracking

stock

minStock
```

según la experiencia actual.

---

# 30. Product tracking CURRENT

Al crear Product pueden definirse:

```text
inventoryTracking

QUANTITY
SERIALIZED
ASSET
```

y:

```text
lotTracking

NONE
OPTIONAL
REQUIRED
```

---

# 31. Product tracking immutability

En el PATCH normal:

```text
inventoryTracking
→ read-only
```

```text
lotTracking
→ read-only
```

Una futura migración de tracking requiere un workflow explícito.

---

# 32. Product stock UX

Debe mantenerse:

```text
Product.stock
→ read-only through Product CRUD
```

Crear Product no permite definir stock arbitrario.

CURRENT:

```text
new Product
→ stock = 0
```

según backend/Prisma.

---

# 33. Product deactivation

Actualmente:

```text
DELETE /products/:id
```

realiza:

```text
soft deactivation
```

de forma tenant-safe e idempotente.

No existe reactivación normal.

---

# 34. Product detail

La consulta de detalle es tenant-scoped mediante comportamiento equivalente a:

```text
findOne(companyId, productId)
```

La ruta estática:

```text
/products/low-stock
```

no debe quedar sombreada por:

```text
/products/:id
```

---

# 35. Inventory CURRENT

Estado:

```text
INVENTORY MOVEMENT LEDGER
✅ IMPLEMENTED / VALIDATED
```

`/inventory` ofrece:

```text
Existencias

Movimientos
```

---

# 36. Inventory movements UI

Movimientos presenta contexto como:

```text
date

Product

type

quantity

balance after

reference

notes
```

y soporta según implementación actual:

```text
search

type filter
```

---

# 37. Inventory state handling

Existencias y Movimientos poseen:

```text
loading

error

retry
```

independientes.

---

# 38. Manual Inventory adjustment

Actualmente:

```text
manual adjustment workflow
→ NOT IMPLEMENTED / REQUIRES REVIEW
```

Por tanto no debe presentarse como una capacidad CURRENT ni como Quick Action
universal.

---

# 39. Equipment CURRENT

Estado:

```text
EQUIPMENT V1
✅ IMPLEMENTED / VALIDATED
```

Ruta:

```text
/equipment
```

Navegación:

```text
INVENTARIO
→ Equipos
```

---

# 40. Equipment frontend CURRENT

Incluye:

```text
list

search

lifecycle filter

condition filter

origin filter

detail

Availability

inspection history

new inspection

manual Equipment creation

terminal retirement
```

---

# 41. Equipment identity

`assetCode` es generado por servidor.

Debe mantenerse:

```text
assetCode
→ primary operational UX identity
```

mientras:

```text
UUID
→ technical identity
```

---

# 42. Equipment Availability

La lista no realiza N+1 requests de Availability.

El detalle puede consultar:

```text
GET /equipment/:equipmentId/availability
```

según la experiencia vigente.

Availability CURRENT deriva principalmente de:

```text
lifecycle

condition
```

No representa todavía Case Assignment.

---

# 43. Retired Equipment

Equipment retirado permanece visible para historia.

No debe ofrecer:

```text
repeat retirement

new inspection
```

cuando el lifecycle vigente lo impida.

---

# 44. Purchase Receipts CURRENT

Estado:

```text
PURCHASE RECEIPTS V1
✅ IMPLEMENTED / VALIDATED
```

Rutas:

```text
/purchase-receipts

/purchase-receipts/:id
```

---

# 45. Purchase Receipts list

La lista implementa:

```text
loading

error

retry

empty state

detail navigation
```

---

# 46. Purchase Receipt detail

El detalle puede presentar:

```text
Purchase

Supplier

receiver

Receipt items

InventoryBatch

EquipmentAssets

InventoryMovements
```

según el recurso correspondiente.

También puede enlazar hacia:

```text
Purchase

Inventory

Equipment
```

---

# 47. Purchase → Receipt handoff

Debe mantenerse:

```text
Purchase
↓
Receipt workflow
↓
created PurchaseReceipt
↓
open returned resource
```

Esto se refiere a creación contextual del Receipt desde el flujo Purchase.

No implica:

```text
contextual Supplier creation
```

---

# 48. Purchase Receipt idempotency UX

Frontend genera un:

```text
Idempotency-Key
```

por intento lógico.

Debe conservarse durante:

```text
retry of same logical payload
```

y regenerarse para una operación nueva.

La semántica backend completa pertenece a:

```text
PURCHASE_RECEIPTS.md
```

---

# 49. Purchases CURRENT

Estado:

```text
PURCHASES V1
✅ IMPLEMENTED / VALIDATED
```

Frontend incluye:

```text
search

status filters

Supplier filter

detail

lifecycle actions

Receipt handoff

historical visibility
```

---

# 50. Purchase deep-link CURRENT

Existe:

```text
/purchases?purchaseId=<id>
```

pero actualmente el detalle depende del Purchase presente en el listado cargado.

Por tanto:

```text
Purchase deep-link
→ CURRENT
```

pero:

```text
pagination-safe dedicated detail resolution
→ TECHNICAL DEBT
```

---

# 51. Quotes CURRENT

Estado:

```text
QUOTES V1
✅ IMPLEMENTED / VALIDATED
```

Frontend incluye:

```text
search

status filter

detail from loaded list

approve

cancel

PDF

Quote → Sale conversion
```

---

# 52. Quote conversion handoff

Después de una conversión exitosa:

```text
Quote CONFIRMED
↓
Sale CONFIRMED
```

frontend conserva:

```text
Sale.id

Sale.folio
```

y ofrece:

```text
Ver venta
↓
/sales?saleId=<id>
```

Estado:

```text
same-session handoff
✅ IMPLEMENTED / VALIDATED
```

---

# 53. Historical Quote → Sale debt

Actualmente una Quote convertida históricamente conoce:

```text
convertedToSale = true
```

pero `GET /quotes` no proporciona todavía suficiente identidad de la Sale
resultante para reconstruir siempre:

```text
/sales?saleId=<id>
```

Por tanto:

```text
historical Quote → Sale identity/navigation
→ TECHNICAL DEBT
```

---

# 54. Quote detail debt

Quote detail sigue dependiendo del dataset cargado.

Actualmente no existe un endpoint dedicado:

```text
GET /quotes/:id
```

en el contrato documentado.

Con futura paginación deberá implementarse un endpoint de detalle o estrategia
equivalente.

---

# 55. Sales CURRENT

Estado:

```text
SALES V1
✅ IMPLEMENTED / VALIDATED
```

Sales utiliza actualmente:

```text
Sale
```

como modelo comercial CURRENT del ERP Core V1.

Debe describirse como:

```text
CURRENT transitional commercial model
```

No como una entidad únicamente histórica.

---

# 56. Sales API CURRENT

Backend soporta:

```text
POST /sales

GET /sales

GET /sales/:id

PATCH /sales/:id/approve

PATCH /sales/:id/cancel

GET /sales/:id/pdf

POST /sales/from-quote/:quoteId
```

---

# 57. Sales frontend CURRENT

`/sales` implementa:

```text
Sales list

search by folio / Customer

status filter

loading

error

retry

empty state

filtered-empty state

New Sale modal

Customer selection

compatible Product selection

stock visibility

price display

quantity

item add/remove

duplicate prevention

subtotal

IVA

total preview

Sale detail

approve

cancel

PDF

deep-link

terminal-state action visibility
```

---

# 58. Generic Sales eligibility

CURRENT permite:

```text
QUANTITY + NONE
✅
```

```text
QUANTITY + OPTIONAL
✅
```

CURRENT bloquea:

```text
QUANTITY + REQUIRED
❌
```

y:

```text
SERIALIZED
❌

ASSET
❌
```

---

# 59. Generic Sales backend authority

La validación se ejecuta en:

```text
direct Sale create

Sale approval

Quote → Sale conversion
```

Frontend filtra Products incompatibles como ayuda UX.

Debe mantenerse:

```text
frontend filtering
≠
backend authority
```

---

# 60. Generic Sales physical limitations

Generic Sales CURRENT no implementa:

```text
EquipmentAsset selection

serialized picking

required-lot selection

batch allocation

Equipment dispatch

Healthcare Assignment
```

Para:

```text
QUANTITY + OPTIONAL
```

la Sale puede existir, pero no existe todavía batch allocation explícita.

---

# 61. Direct Sale lifecycle

CURRENT:

```text
POST /sales
↓
Sale DRAFT
↓
no Inventory mutation
```

Después:

```text
DRAFT
↓ approve
CONFIRMED
↓
Product.stock decrement
+
InventoryMovement OUT
```

O:

```text
DRAFT
↓ cancel
CANCELLED
↓
no Inventory mutation
```

---

# 62. Quote → Sale lifecycle

CURRENT:

```text
Quote CONFIRMED
↓
conversion
↓
Sale CONFIRMED
↓
InventoryMovement OUT
```

Esto es comportamiento CURRENT.

La futura arquitectura SalesOrder / Delivery permanece TARGET.

---

# 63. Sale folio CURRENT

Folios actuales:

```text
V-000001

V-000002

...
```

Características:

```text
server generated

tenant scoped

sequential

minimum six digits

no six-digit maximum

immutable

not reused
```

Ventas directas y convertidas desde Quote utilizan:

```text
CompanySequence
key = SALE_FOLIO
```

---

# 64. Sale deep-link CURRENT

Existe:

```text
/sales?saleId=<id>
```

y resuelve mediante:

```text
GET /sales/:id
```

Por tanto no depende de que la Sale se encuentre en el listado actual.

Estado:

```text
pagination-compatible detail resolution
✅
```

---

# 65. Sale PDF CURRENT

Existe:

```text
GET /sales/:id/pdf
```

Frontend utiliza:

```text
responseType = blob
```

y descarga:

```text
venta-{folio}.pdf
```

Estado:

```text
IMPLEMENTED / AUTOMATED
```

La comprobación manual final en navegador puede mantenerse como QA si sigue
pendiente.

---

# 66. Sale editing

Actualmente no existe:

```text
generic Sale update UI
```

ni:

```text
PATCH /sales/:id
```

genérico.

Tampoco existe:

```text
DELETE /sales/:id
```

---

# 67. Confirmed Sale reversal

Actualmente:

```text
Sale CONFIRMED
→ no normal cancellation
```

y:

```text
confirmed Sale reversal
→ NOT IMPLEMENTED
```

Debe mantenerse separado de Commercial Returns.

---

# 68. Commercial Returns

Generic Commercial Returns permanece:

```text
P1 / DEFERRED
```

No constituye actualmente un blocker P0 del cierre ERP Core V1.

Debe mantenerse:

```text
Commercial Return
≠
Healthcare custody Return
```

---

# 69. Sales validation summary

La validación registrada cubre de forma resumida:

```text
ASSET rejection

compatible QUANTITY Sale creation

DRAFT creation without stock mutation

sequential folio allocation

folio non-reuse

DRAFT → CONFIRMED

stock decrement

InventoryMovement OUT

DRAFT cancellation without OUT

Quote conversion

Sale detail

deep-link

frontend lifecycle
```

Los IDs, folios y deltas concretos de QA pertenecen a:

```text
PROJECT_BOARD.md

CHANGELOG.md

QA evidence
```

no a este documento permanente.

---

# 70. Shared loading / error / empty normalization

Los módulos principales normalizados utilizan patrones consistentes para:

```text
loading

error

retry

empty state

filtered-empty state
```

cuando corresponda.

Los errores de acciones normalizadas deben ser visibles al usuario y no depender
de comportamiento silencioso.

---

# 71. Shared UI debt

Deuda confirmada o suficientemente estable:

```text
Table
→ Object.values(row) makes column ordering fragile
```

```text
Modal
→ focus management incomplete
```

```text
Modal
→ Escape handling incomplete
```

```text
Modal
→ dialog accessibility semantics incomplete
```

```text
global server pagination
→ not standardized
```

```text
forms
→ mixed local vs extracted patterns
```

```text
Header
→ limited user/session context
```

```text
Sidebar
→ permission awareness pending
```

---

# 72. UI findings requiring revalidation

Hallazgos históricos como:

```text
Button fullWidth implementation suspicious

alert() usage in specific older screens

fixed EmptyState emoji
```

deben tratarse como:

```text
inspection findings
→ verify during H8B / UX-B.6
```

si no fueron revalidados recientemente.

No deben convertirse automáticamente en deuda permanente sin inspección actual.

---

# 73. Table debt

La implementación compartida basada en:

```text
Object.values(row)
```

puede volver frágil:

```text
column ordering

data shape changes

column customization
```

Debe evaluarse posteriormente una API explícita de columnas.

---

# 74. Modal accessibility debt

Modal requiere una revisión específica de:

```text
focus trap

initial focus

focus return

Escape handling

dialog semantics

keyboard interaction
```

Este trabajo no debe darse por cerrado únicamente porque los modales sean
funcionales visualmente.

---

# 75. Accessibility CURRENT boundary

H7 validó principalmente:

```text
responsive navigation

usable forms

shared state patterns

basic semantic structure
```

pero no certifica:

```text
full keyboard coverage

complete modal accessibility

WCAG compliance
```

---

# 76. Accessibility TARGET

Antes de considerar la experiencia madura debe revisarse:

```text
keyboard navigation

semantic buttons / links

form labels

focus management

Escape behavior

dialog semantics

responsive behavior

reasonable contrast
```

No se afirma certificación WCAG completa dentro de este milestone.

---

# 77. Route consistency

No deben renombrarse URLs existentes únicamente por reorganización interna de
Next.js.

Route groups pueden mover archivos sin cambiar:

```text
/products

/sales

/purchases
```

Cualquier breaking URL change requiere decisión separada.

---

# 78. Deep-link conventions CURRENT

Convenciones actuales:

```text
/sales?saleId=<id>
→ GET /sales/:id
```

```text
/equipment?assetId=<id>
→ dedicated Equipment detail resolution
```

```text
/purchases?purchaseId=<id>
→ resolved from current Purchase list
```

```text
/purchase-receipts/<id>
→ dedicated detail page
```

```text
/inventory?tab=movements
&referenceType=PURCHASE_RECEIPT
&referenceId=<id>
→ movement tab + reference filter
```

---

# 79. Deep-link robustness

Actualmente:

```text
Sales
→ dedicated detail endpoint
✅
```

```text
Equipment
→ dedicated detail endpoint
✅
```

```text
Purchase Receipt
→ dedicated detail route
✅
```

Mientras:

```text
Purchases
→ list-based detail dependency
⏳
```

```text
Quotes
→ list-based detail / historical conversion identity debt
⏳
```

---

# 80. Backend pagination boundary

La normalización H7 no implementó una estrategia global de:

```text
server pagination

server search

server filtering
```

en todos los módulos.

Debe abordarse de forma coordinada y no mediante soluciones distintas por página
sin necesidad.

---

# 81. Backend change boundary

ERP UI / UX Completion es principalmente frontend.

Cambios backend mayores requieren decisión específica.

Los cambios backend ya realizados para cerrar flujos concretos como:

```text
Products

Sales

Purchase Receipts

Equipment
```

se consideran parte de la capacidad CURRENT.

No constituyen autorización para un rediseño backend general.

---

# 82. H7 completion

Las fases cerradas incluyen:

```text
UX-B.1
Authenticated App Shell
✅

UX-B.2
Navigation IA + responsive shell
✅

UX-B.3
Dashboard with real data
✅

UX-B.4
Sales frontend completion
✅

UX-B.5
ERP screen completion / normalization
✅

UX-B.5H
Purchase Receipts + remaining ERP normalization
✅
```

Resultado:

```text
H7
ERP Functional Normalization
✅ COMPLETED / VALIDATED
```

---

# 83. H8 structure

H8 se divide en dos partes distintas.

## H8A

```text
Documentation Synchronization
```

Estado actual:

```text
CURRENT
```

## H8B

```text
Full Automated Regression
+
Technical Health
```

Estado:

```text
NEXT
```

---

# 84. H8A — Documentation Synchronization

H8A debe:

```text
align CURRENT vs TARGET

remove obsolete contradictions

synchronize ERP module docs

synchronize Healthcare docs

synchronize architecture/security/project docs

document technical debt accurately
```

No modifica producto automáticamente.

---

# 85. H8B — Full Automated Regression

Después de H8A debe ejecutarse una regresión técnica completa.

Incluye según scripts disponibles:

```text
backend tests

frontend tests

frontend tests serially if worker resources require it

backend build

frontend build

backend lint

frontend lint

Prisma validation

Prisma migrate status

git health

git diff --check
```

---

# 86. Test infrastructure failures

Debe distinguirse:

```text
application failure
```

de:

```text
test-runner / worker resource exhaustion
```

Si el pool paralelo de frontend agota recursos pero la ejecución serial pasa,
debe registrarse como problema de infraestructura/test execution y no inventarse
un fallo funcional.

---

# 87. H8B change policy

H8B es principalmente:

```text
verification
```

No debe utilizarse automáticamente para iniciar refactors grandes.

Si aparece un fallo real:

```text
stop
↓
classify
↓
decide correction separately
```

---

# 88. UX-B.6

Después de cerrar H8:

```text
UX-B.6
FULL ERP END-TO-END QA
```

Debe validar journeys reales de extremo a extremo.

No es lo mismo que H8B.

---

# 89. H8B vs UX-B.6

Debe mantenerse:

```text
H8B
→ automated / technical regression
```

frente a:

```text
UX-B.6
→ real end-to-end ERP operational QA
```

Ambos son necesarios.

---

# 90. End-to-End Journey — Procurement

Debe validarse:

```text
Supplier
↓
Purchase
↓
Confirm
↓
Purchase Receipt
↓
Inventory IN
```

y, cuando corresponda:

```text
ASSET Product
↓
Purchase Receipt
↓
EquipmentAsset provisioning
```

---

# 91. End-to-End Journey — Commercial

Debe validarse:

```text
Customer
↓
Quote
↓
Approve
↓
Convert
↓
Sale
↓
Inventory OUT
```

incluyendo:

```text
Sale deep-link

folio

status

Inventory reference
```

---

# 92. End-to-End Journey — Direct Sale

También:

```text
Customer
↓
Direct Sale DRAFT
↓
Approve
↓
CONFIRMED
↓
Inventory OUT
```

y:

```text
DRAFT
↓
Cancel
↓
no Inventory mutation
```

---

# 93. End-to-End Journey — Equipment

Debe validarse:

```text
ASSET Product
↓
Purchase Receipt
↓
EquipmentAsset
↓
Inspection
↓
Availability
```

sin introducir todavía Healthcare Assignment.

---

# 94. B6 validation concerns

UX-B.6 debe revisar de forma controlada:

```text
folios

statuses

stock deltas

InventoryMovement balances

referenceId / referenceType

PDF actions

deep-links

soft-deactivation history

tenant isolation

Receipt idempotency replay

Receipt idempotency conflict

Equipment lifecycle
```

---

# 95. Controlled QA data

La QA E2E debe utilizar:

```text
known baseline
↓
controlled operation
↓
expected delta
↓
verification
```

para evitar confundir datos preexistentes con el efecto de la prueba actual.

---

# 96. Security priorities

Antes de pilot/production deben cerrarse o decidirse formalmente al menos:

```text
secure password recovery

inactive-user enforcement

safe role provisioning

default ADMIN review

critical authorization review

systematic tenant-isolation regression

protected-route/session architecture

authentication abuse protection / rate limiting

production secrets/configuration review
```

Estas tareas no son meramente visuales.

---

# 97. Priority matrix

## P0 — PREPRODUCTION SECURITY

```text
secure password recovery

inactive-user enforcement

protected-route/session architecture review

critical authorization review

tenant-isolation regression

safe role provisioning

default ADMIN review

authentication endpoint abuse protection

production secrets/configuration
```

---

## P1 — CORE CLOSURE

```text
H8B full technical regression

UX-B.6 full ERP E2E QA

critical shared UX consistency

critical accessibility corrections

confirmed functional bugs found during QA
```

---

## P2 — SCALABILITY / ADVANCED UX

```text
server pagination

server filtering/search

date-range filters

advanced cross-module navigation

optional-lot allocation evolution

additional read models
```

---

## P3 — POLISH

```text
icons

animation

visual refinements

advanced responsive polish

optional micro-interactions
```

---

# 98. Technical debt — Identity / Session

```text
secure password recovery
P0
```

```text
protected-route/session architecture
P0 review
```

```text
inactive-user enforcement
P0
```

```text
JWT localStorage strategy
preproduction review
```

```text
logout/session consistency
open
```

---

# 99. Technical debt — Shared UI

```text
Table Object.values(row) fragility

Modal focus management

Modal Escape handling

dialog semantics

global pagination strategy

mixed form architecture

limited Header user/session context

permission-aware Sidebar
```

---

# 100. Technical debt — Products / Inventory

```text
Product reactivation

Product tracking migration workflow

Inventory server pagination/filtering

Inventory date-range filtering

manual adjustment workflow review
```

---

# 101. Technical debt — Equipment

```text
serial correction / edit workflow

manual Equipment batch selector

retired actor name resolution

Product.stock ↔ EquipmentAsset reconciliation

Equipment pagination

bulk/list Availability if later required
```

---

# 102. Technical debt — Sales / Quotes

```text
Sale create request idempotency

confirmed Sale reversal

historical Quote → Sale identity

Quote dedicated detail strategy

Sales server pagination/filtering

required-lot Sale flow

OPTIONAL-lot batch allocation

SERIALIZED fulfillment

ASSET commercial fulfillment
```

Commercial Returns remains:

```text
P1 / DEFERRED strategic capability
```

rather than an automatic Core V1 blocker.

---

# 103. Technical debt — Purchases / Receipts

```text
inactive Supplier backend validation for Purchase

Purchase deep-link pagination compatibility

real PostgreSQL simultaneous Receipt-idempotency QA

Receipt correction / reversal

Receipt PDF

Receipt list server pagination/filtering
```

---

# 104. Healthcare Case idempotency

Healthcare Case Foundation exists.

Still open:

```text
Healthcare Case create idempotency
```

This remains separate from ERP Core UI completion.

---

# 105. Healthcare scope boundary

No debe expandirse Healthcare UI dentro de H7/H8/B6 salvo correcciones necesarias
para mantener el sistema estable.

El objetivo actual es cerrar:

```text
ERP Core V1
```

antes de ampliar:

```text
Healthcare specialization
```

---

# 106. Healthcare sequence preserved

Secuencia futura:

```text
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
Mobile technician experience
```

---

# 107. Equipment / Healthcare boundary

Debe mantenerse:

```text
EquipmentAsset
→ ERP Core physical identity
```

mientras:

```text
Healthcare
→ assignment
→ custody
→ dispatch
→ return
```

No debe contaminarse `EquipmentAsset` con campos operativos de Case como sustituto
del dominio Healthcare.

---

# 108. Commercial Return / Healthcare Return boundary

Debe mantenerse:

```text
Commercial Return
→ commercial fulfillment reversal/disposition
```

frente a:

```text
Healthcare Return
→ custody return
```

Son conceptos diferentes y no deben compartir semántica únicamente por llamarse
"Return".

---

# 109. SalesOrder / Delivery

La arquitectura futura:

```text
SalesOrder
↓
Delivery
```

permanece TARGET.

CURRENT continúa utilizando:

```text
Sale
```

No debe modificarse el ERP Core durante H8 únicamente para adelantar ADR-011.

---

# 110. Action Dashboard

La futura evolución:

```text
Action Dashboard
```

permanece TARGET.

Dashboard CURRENT continúa siendo principalmente:

```text
Operational Overview
```

con datos reales.

No debe ampliarse en H8 con widgets de dominios aún no implementados.

---

# 111. Quality gates

Los gates técnicos deben incluir según el paquete:

```text
tests

build

lint

Prisma validation where applicable

git diff --check
```

Los snapshots cuantitativos pertenecen a:

```text
PROJECT_BOARD.md

CHANGELOG.md
```

y no deben duplicarse permanentemente aquí.

---

# 112. Git health

Antes de cerrar un milestone documental o técnico debe revisarse:

```text
git status --short

git diff --check
```

No deben incluirse accidentalmente:

```text
.env

.env.backup

tokens

passwords

temporary secrets
```

en commits.

---

# 113. H8A close conditions

H8A puede cerrarse cuando:

```text
all targeted docs reviewed

CURRENT / TARGET contradictions resolved

security P0s synchronized

project sequence synchronized

Healthcare boundaries synchronized

Markdown structure verified

git diff reviewed
```

---

# 114. H8B close conditions

H8B puede cerrarse cuando:

```text
backend automated suite passes

frontend automated suite passes

builds pass

lints pass

Prisma validates

migration status is understood

git health passes
```

o cuando cualquier excepción esté:

```text
identified

classified

documented

explicitly accepted
```

---

# 115. UX-B.6 close conditions

UX-B.6 debe cerrar únicamente después de validar los principales journeys ERP
contra datos reales controlados.

Debe existir evidencia suficiente de:

```text
commercial flow

procurement flow

Inventory consequences

Equipment provisioning

lifecycle transitions

deep-links

PDF actions

tenant safety

idempotency behavior where implemented
```

---

# 116. ERP Core V1 closure

Después de:

```text
H8
+
UX-B.6
```

puede evaluarse:

```text
ERP Core V1 Closure
```

Esto sigue siendo distinto de:

```text
pilot / production readiness
```

si permanecen P0 de seguridad abiertos.

---

# 117. Current project sequence

Debe mantenerse:

```text
H7
ERP Functional Normalization
✅ COMPLETED / VALIDATED

↓

H8A
Documentation Synchronization
→ CURRENT

↓

H8B
Full Automated Regression / Technical Health
→ NEXT

↓

UX-B.6
Full ERP End-to-End QA

↓

ERP Core V1 Closure

↓

Healthcare specialization
```

---

# 118. Anti-patrones

## Duplicate App Shell

Incorrecto montar:

```text
Sidebar

Header
```

dentro de cada página ERP.

---

## Route-group URL breakage

Incorrecto cambiar URLs públicas solo porque se reorganizó el filesystem.

---

## Frontend-only authorization

Incorrecto asumir:

```text
hidden button
→ secure operation
```

Backend continúa siendo autoridad.

---

## Frontend-only Product eligibility

Incorrecto depender únicamente del ProductSelector para Generic Sales.

---

## Fake Dashboard data

Incorrecto utilizar métricas mock cuando existen APIs reales.

---

## False successful state

Incorrecto mostrar:

```text
success
```

cuando una operación backend falló.

---

## False zero

Incorrecto representar:

```text
request failure
```

como:

```text
0
```

---

## Treat H7 as production ready

Incorrecto:

```text
H7 validated
=
production ready
```

---

## Target documented as Current

Incorrecto presentar como CURRENT:

```text
SalesOrder

Delivery

Commercial Returns

Healthcare Assignment

CaseDispatch

CaseKit

Healthcare Return

advanced Action Dashboard
```

---

## Security hidden inside UX debt

Incorrecto tratar:

```text
insecure password recovery
```

como simple mejora visual.

Es un:

```text
P0 security blocker
```

---

# 119. Relación con Design System

Las primitivas y pantallas deben mantenerse alineadas con:

```text
DESIGN_SYSTEM.md
```

para:

```text
spacing

typography

buttons

states

forms

tables

modals

responsive behavior

accessibility
```

Este documento no crea un sistema visual paralelo.

---

# 120. Relación con module docs

Cada módulo conserva autoridad sobre su comportamiento funcional.

Ejemplo:

```text
CUSTOMERS.md
→ Customer lifecycle
```

```text
PURCHASES.md
→ Purchase lifecycle
```

```text
PURCHASE_RECEIPTS.md
→ Receipt semantics / idempotency
```

```text
INVENTORY.md
→ stock / movements
```

```text
EQUIPMENT.md
→ Equipment identity/lifecycle
```

```text
QUOTES.md
→ Quote behavior
```

```text
SALES.md
→ Sale behavior / Generic Sales eligibility
```

ERP_UI_UX documenta:

```text
cross-module frontend experience
```

y no reemplaza esas fuentes.

---

# 121. Documentación relacionada

```text
docs/modules/erp/CUSTOMERS.md

docs/modules/erp/SUPPLIERS.md

docs/modules/erp/PRODUCTS.md

docs/modules/erp/PURCHASES.md

docs/modules/erp/PURCHASE_RECEIPTS.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/QUOTES.md

docs/modules/erp/SALES.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/modules/erp/DASHBOARD.md

docs/architecture/ARCHITECTURE.md

docs/engineering/API_GUIDELINES.md

docs/engineering/QUALITY_STANDARDS.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/ux/DESIGN_SYSTEM.md

docs/product/PRODUCT_REQUIREMENTS.md

docs/product/ZAPING_WAY.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

---

# 122. Fuente de verdad

```text
ERP_UI_UX.md
→ cross-module ERP frontend status
→ UX milestone boundaries
→ shared UI debt
```

```text
module documentation
→ domain behavior
```

```text
frontend implementation
→ CURRENT UX behavior
```

```text
backend implementation
→ CURRENT API / business behavior
```

```text
tests
→ validated technical behavior
```

```text
SECURITY_PRINCIPLES.md
→ security requirements
```

```text
PROJECT_BOARD.md
→ active work / blockers / milestone state
```

```text
ROADMAP.md
→ project sequence
```

```text
CHANGELOG.md
→ implementation history
```

---

# 123. Estado consolidado CURRENT

```text
Authenticated App Shell
✅

responsive navigation
✅

navigation IA
✅

Dashboard real
✅

Customers
✅

Suppliers
✅

Products
✅

Inventory
✅

Equipment
✅

Quotes
✅

Purchases
✅

Purchase Receipts
✅

Sales
✅

Sales detail endpoint
✅

Sales deep-link
✅

Equipment detail/deep-link
✅

Purchase Receipt dedicated detail
✅

normalized loading/error/empty patterns
✅

Generic Sales backend safety
✅

Purchase Receipt idempotency UX
✅
```

---

# 124. Estado consolidado DEBT

```text
secure password recovery
P0

protected-route/session architecture
P0 review

inactive-user enforcement
P0

authorization / tenant regression
P0

auth abuse protection
P0

Table column fragility
⏳

Modal accessibility
⏳

server pagination/filtering
⏳

Purchase list-based deep-link
⏳

Quote detail / historical Sale identity
⏳

Sale create idempotency
⏳

confirmed Sale reversal
⏳

inactive Supplier validation for Purchase
⏳

real concurrent PostgreSQL Receipt-idempotency QA
⏳

Inventory / Equipment follow-up debts
⏳
```

---

# 125. Estado consolidado TARGET / FUTURE

```text
permission-aware navigation

advanced Action Dashboard

SalesOrder / Delivery

Commercial Returns

required-lot fulfillment

SERIALIZED fulfillment

ASSET commercial fulfillment

Healthcare logistics

Healthcare Calendar

Case 360

Mobile technician experience

advanced pagination UX

advanced accessibility polish
```

---

# 126. Principio final

El objetivo de ERP Core UI / UX no es únicamente que cada pantalla funcione de
forma aislada.

Debe conseguir:

```text
consistent shell
↓
consistent navigation
↓
consistent pages
↓
safe domain actions
↓
clear cross-module handoffs
↓
validated end-to-end workflows
```

CURRENT:

```text
H7
→ functional normalization complete
```

CURRENT project phase:

```text
H8A
→ documentation synchronization
```

NEXT:

```text
H8B
→ technical regression
```

THEN:

```text
UX-B.6
→ real ERP end-to-end QA
```

THEN:

```text
ERP Core V1 Closure
```

AND ONLY AFTER THAT:

```text
Healthcare specialization expansion
```

Debe mantenerse una diferencia explícita entre:

```text
functionally validated
```

y:

```text
ready for pilot / production
```

mientras existan security blockers P0.

> **La experiencia ERP Core debe ser consistente, trazable y segura antes de
> expandir nuevos dominios. H7 cerró la normalización funcional; H8 y UX-B.6
> deben demostrar que esa base también es técnicamente estable y operativamente
> coherente antes de continuar con Healthcare.**
