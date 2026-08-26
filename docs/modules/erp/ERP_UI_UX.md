# ERP Core UI / UX Completion - Zaping ERP

**Modulo:** ERP Core UI / UX
**Producto:** Zaping ERP Core
**Version:** 1.1.0
**Estado:** Approved milestone scope
**Estado de implementacion:** UX-B.5 PRODUCTS / INVENTORY / EQUIPMENT V1 COMPLETED / VALIDATED
**Ultima actualizacion:** 2026-08-25
**Responsable:** Zaping ERP Team

---

# 1. Proposito

ERP Core UI / UX Completion estabiliza la experiencia base de Zaping ERP antes de expandir mas workflows Healthcare.

Healthcare Case Foundation esta completo. Los dominios Healthcare futuros siguen en cola y no se cancelan.

Este documento es la fuente de verdad frontend para el alcance UX-A.5 y las fases UX-B del hito.

---

# 2. Estado frontend confirmado

Frontend:

```text
web/
```

Stack:

```text
Next.js 16.2.9
React 19.2.4
App Router
Tailwind v4
Vitest
axios
```

Layout raiz actual:

```text
web/app/layout.tsx
```

Shell autenticado-like actual:

```text
web/app/dashboard/layout.tsx
```

Sidebar y Header estan montados solo bajo:

```text
/dashboard
```

Por eso rutas ERP top-level como `/customers`, `/products`, `/quotes`, `/purchases`, `/inventory` y `/suppliers` no comparten el shell de Dashboard.

Esta es la causa arquitectonica confirmada del Sidebar que desaparece al navegar fuera de Dashboard.

---

# 3. Direccion aprobada de App Shell

La direccion aprobada es usar route groups de Next.js App Router.

Target conceptual:

```text
web/app/
|-- layout.tsx
|-- (public)/
|   |-- login/
|   |-- register/
|   `-- forgot-password/
`-- (app)/
    |-- layout.tsx
    |-- dashboard/
    |-- customers/
    |-- suppliers/
    |-- products/
    |-- inventory/
    |-- quotes/
    |-- purchases/
    |-- purchase-receipts/
    |-- sales/
    |-- equipment/
    `-- categories/
```

La migracion exacta de archivos se revisara durante implementacion.

Los route groups no deben cambiar URLs publicas:

```text
(app)/products
→ /products
```

El futuro `(app)/layout.tsx` debe ser dueno de:

```text
Sidebar
Header
main content region
```

Sidebar y Header no deben duplicarse dentro de paginas individuales.

---

# 4. Rutas publicas y autenticacion

Login, Register, Forgot Password y otras rutas publicas de autenticacion deben permanecer fuera del App Shell autenticado.

Las pantallas publicas/auth no deben envolverse con Sidebar/Header.

La implementacion posterior del shell debe revisar:

```text
protected route behavior
expired JWT
401 handling
logout
deep-link refresh
protected-page flash
```

No hay rediseño aprobado de backend Auth dentro de este hito.

---

# 5. Sidebar e IA de navegacion

Sidebar debe evolucionar para soportar:

```text
persistent presence on authenticated routes
active route state
clear module grouping
responsive/mobile behavior
future permission-aware behavior where appropriate
```

IA conceptual aprobada:

```text
INICIO
- Dashboard

COMERCIAL
- Customers
- Quotes
- Sales

COMPRAS
- Suppliers
- Purchases
- Purchase Receipts

INVENTARIO
- Products
- Inventory
- Equipment

ADMINISTRACION
- Categories
- future Company
- future Users
- future Settings

HEALTHCARE
- future Cases
- future Calendar
- future logistics
```

No se deben crear working links para pantallas futuras inexistentes.

Healthcare debe permanecer oculto o deshabilitado hasta que su frontend exista.

---

# 6. Dashboard 2.0

Dashboard 2.0 es parte del hito.

Problema confirmado:

```text
"Ventas recientes" usa datos hardcoded/mock.
```

Regla aprobada:

```text
El Dashboard de produccion no debe presentar datos operacionales falsos.
```

El rediseño debe usar hechos reales disponibles desde APIs backend existentes.

Datos potenciales actuales:

```text
sales
purchases
inventory value
low stock
quotes
purchase receipts
equipment
inspection/availability
Healthcare Cases where backend APIs already exist
```

No se deben prometer KPIs que requieran APIs backend inexistentes.

---

# 7. Sales V1

Sales frontend completion esta implementado y validado como Sales V1 sobre el modelo `Sale` actual.

Backend actual soporta:

```text
POST /sales
GET /sales
GET /sales/:id
PATCH /sales/:id/approve
PATCH /sales/:id/cancel
GET /sales/:id/pdf
POST /sales/from-quote/:quoteId
```

`GET /sales/:id`:

```text
JwtAuthGuard
req.user.companyId
ParseUUIDPipe
SalesService.findOne(companyId, id)
tenant scoped
missing / cross-tenant → Venta no encontrada
response includes customer and items.product
Prisma schema changes → none
```

Frontend implementado:

```text
/sales route
Sidebar navigation under COMERCIAL
Sales list
search by folio / customer
status filter
loading / error / retry
empty and filtered-empty states

Nueva venta modal
Customer selection
generic-Sales-compatible Product selection
stock visibility
read-only current price
quantity
item add / remove
duplicate prevention
subtotal
IVA 16%
total preview
POST /sales
list refresh after success

Sale detail modal
GET /sales/:id
approve
cancel
PDF action
terminal-state action visibility
```

Generic Sales safety:

```text
Allowed:
QUANTITY + NONE
QUANTITY + OPTIONAL

Rejected:
QUANTITY + REQUIRED
any non-QUANTITY inventory tracking
```

Enforcement exists in:

```text
direct Sale create
Sale approval
Quote → Sale conversion
```

The frontend New Sale product selector filters incompatible Products for UX, but backend remains the source of truth.

Generic Sales does not implement:

```text
EquipmentAsset selection
serialized picking
required-lot selection
lot allocation
Equipment dispatch
Healthcare Assignment
```

Sale folios:

```text
V-000001
V-000002
...
server generated
tenant scoped
sequential
minimum six digits
no six-digit maximum
immutable
historical / cancelled folios remain occupied
legacy timestamp-style folios remain unchanged
```

Implementation:

```text
SalesFolioService
→ CompanySequenceAllocatorService

Sequence key:
SALE_FOLIO

Direct Sale and Quote-converted Sale use the same sequence.
```

Direct Sale transaction:

```text
validation
→ transaction
→ Sales folio allocation
→ Sale create
→ DRAFT
```

No stock mutation occurs on direct create.

Quote conversion:

```text
confirmed Quote
→ conversion
→ confirmed Sale
→ InventoryMovement OUT
```

Quote conversion uses the same Sales folio sequence and preserves the existing duplicate-conversion guard. Request-level idempotency is not implemented.

Lifecycle:

```text
DRAFT
→ approve
→ CONFIRMED
→ Product.stock decrement
→ InventoryMovement OUT

DRAFT
→ cancel
→ CANCELLED
→ no InventoryMovement
→ no stock mutation
```

Confirmed Sale cancellation is not exposed as a supported reversal workflow. Returns / reversal remain future domain work.

Frontend status labels:

```text
DRAFT → Borrador
CONFIRMED → Confirmada
CANCELLED → Cancelada
```

PDF:

```text
GET /sales/:id/pdf
frontend responseType blob
download filename venta-{folio}.pdf
```

Status:

```text
IMPLEMENTED / AUTOMATED
manual browser PDF verification pending
```

Manual QA evidence:

```text
Generic Sales safety
ASSET Product EQ-TEST-001 / EQUIPO DE PRUEBA
inventoryTracking ASSET
lotTracking NONE
POST /sales → 400
message indicated incompatible generic Sales inventory tracking
Sales count unchanged
PASS

Compatible Product LF1837 / BLUNT TIP
inventoryTracking QUANTITY
lotTracking OPTIONAL
direct Sale creation → DRAFT
stock unchanged
PASS

Sequential folios observed in PostgreSQL/API:
V-000005 ... V-000011
cancelled folios were not reused
PASS

UI-created Sale:
V-000011
Miguel Sahuaro
LF1837 / BLUNT TIP
quantity 1
subtotal 215
IVA 34.4
total 249.4
initial status DRAFT
detail response confirmed customer and items.product relations
creating DRAFT did not mutate Product.stock
PASS

Approval QA:
V-000011 DRAFT → CONFIRMED
BLUNT TIP stock 50 → 49
InventoryMovement OUT quantity 1 balance 49
referenceId 7d295999-714a-450e-b7c6-e8092e2e9993 matched approved Sale
PASS

Cancellation QA:
DRAFT cancellation
stock 49 → 49
Sales InventoryMovements for that Sale: 0
PASS
```

Automated validation:

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

Frontend focused Sales
40 tests PASS

navigation
29 tests PASS

full frontend
20 files
240 tests PASS

frontend build
PASS

frontend lint
PASS

git diff --check
PASS
```

No Sale edit/update UI exists. No Sale DELETE exists.

Reliability debt remains:

```text
Sale create request idempotency
GET /sales pagination / server filtering
confirmed Sale reversal / returns workflow
payments
invoice
delivery
SalesOrder future architecture
required-lot Sale flow
ASSET / serialized physical Sale flow
```

---

# 8. Purchase Receipts

Una ruta frontend dedicada de Purchase Receipts debe existir eventualmente.

La funcionalidad embebida actual dentro de Purchases sigue siendo valida hasta esa fase.

La ruta dedicada es P2 y no bloquea App Shell.

No se debe implementar en UX-B.1.

---

# 9. Equipment

**Estado:** EQUIPMENT V1 IMPLEMENTED / VALIDATED.

`/equipment`, accesible como **Equipos** bajo **INVENTARIO**, incluye lista, búsqueda, filtros de lifecycle/condition/origin, detalle, Availability evaluada por backend, historial y registro de inspecciones, creación manual y retiro terminal.

`assetCode` es generado por servidor y funciona como identidad operacional visible. El UUID no es el identificador principal de UX.

La lista no ejecuta llamadas N+1 de Availability; `GET /equipment/:equipmentId/availability` se consulta en detalle. Los equipos retirados permanecen visibles para historia, sin acciones de retiro repetido ni nuevas inspecciones.

---

# 10. Products e Inventory

**Estado:** PRODUCTS V1 + INVENTORY MOVEMENT LEDGER IMPLEMENTED / VALIDATED.

`/products` corrige Brand e incorpora Category y tracking. `inventoryTracking` (`QUANTITY`, `SERIALIZED`, `ASSET`) y `lotTracking` (`NONE`, `OPTIONAL`, `REQUIRED`) se seleccionan al crear y permanecen de solo lectura al editar. Stock actual es de solo lectura y stock mínimo continúa editable.

Product CRUD no acepta `stock`. La creación usa `stock = 0` por default de backend/Prisma. El `PATCH` tampoco permite cambiar tracking. `DELETE /products/:id` desactiva de forma idempotente y no borra físicamente.

La consulta de detalle quedó tenant-scoped mediante `findOne(companyId, productId)` y la ruta estática `/products/low-stock` ya no queda sombreada por `/:id`.

`/inventory` ofrece dos tabs operacionales:

```text
Existencias
Movimientos
```

Movimientos presenta fecha, Product, tipo, cantidad, balance posterior, referencia y notas; permite búsqueda y filtro por tipo. Existencias y movimientos tienen carga, error y retry independientes. Inventory V1 permanece read-only y no incluye ajuste manual.

---

# 11. Primitivas UI existentes

El hito debe reutilizar y mejorar las primitivas existentes:

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

No se debe introducir un nuevo design system o framework externo de componentes sin aprobacion humana separada.

---

# 12. Deuda UI compartida conocida

Hallazgos actuales:

```text
Table
→ Object.values(row) makes column ordering fragile

Button
→ fullWidth class implementation appears suspicious / likely incorrect

Modal
→ focus handling / Escape / accessibility incomplete

EmptyState
→ fixed package emoji

Errors
→ inconsistent alert / inline / console patterns

Tables
→ horizontal scroll only, limited filtering/search/pagination

Forms
→ mixed page-local and extracted hook/component patterns

Header
→ hardcoded Dashboard / user name behavior

Sidebar
→ no active state / responsive / collapse / permission awareness
```

Estos son hallazgos documentados, no correcciones aplicadas.

---

# 13. Anatomia estandar de pagina ERP

Patron conceptual aprobado:

```text
Authenticated App Shell
→ PageContainer
→ PageHeader
→ page actions
→ filters/search
→ page content
→ loading/error/empty/data states
```

Las primitivas existentes deben reutilizarse siempre que sea razonable.

---

# 14. Matriz de prioridad

P0:

```text
security pre-release blockers
protected-route/session UX review
```

P1:

```text
Purchase Receipts dedicated experience
remaining ERP module normalization
shared UX consistency
```

P2:

```text
backend pagination / filtering integration
date-range filtering
advanced cross-module journeys
```

P3:

```text
icons/polish
animation
advanced responsive refinements
optional visual enhancements
```

---

# 15. Orden de implementacion

Fases aprobadas:

```text
UX-B.1
Authenticated App Shell

UX-B.2
Navigation IA + active state + responsive shell

UX-B.3
Dashboard 2.0 using real current data

UX-B.4
Sales frontend completion

UX-B.5
ERP Core screen completion / normalization

Products V1
→ completed / validated

Inventory Movement Ledger
→ completed / validated

Equipment V1
→ completed / validated

UX-B.5H
Purchase Receipts + remaining ERP normalization
→ next

UX-B.6
End-to-end ERP UX QA
```

UX-B.5 debe hacerse por etapas, no como un cambio gigante.

Subareas esperadas de UX-B.5:

```text
Products
Equipment
Purchase Receipts
Inventory
Customers
Suppliers
Quotes
Purchases
shared UI cleanup
```

---

# 16. Journeys end-to-end

El hito debe terminar habilitando journeys UI coherentes:

```text
Supplier
→ Purchase
→ Approval
→ Purchase Receipt
→ Inventory

Customer
→ Quote
→ Sale
→ Inventory

Product
→ ASSET Purchase Receipt
→ Equipment
→ Inspection
→ Current Availability
```

---

# 17. Healthcare

No se debe expandir Healthcare UI dentro de este hito.

Los modulos Healthcare futuros se conectaran despues al mismo App Shell autenticado.

Orden futuro preservado:

```text
Hospital / Doctor
Equipment / Material Requirements
Equipment Assignment
Case Availability
Dispatch / Custody
Return
Case Kit / Maletin
Case Calendar
Case 360
Mobile technician experience
```

---

# 18. Consistencia de rutas

No se deben renombrar URLs publicas existentes en UX-A.5.

La reestructuracion de filesystem mediante route groups puede mover page files sin cambiar URLs.

Cualquier limpieza de URLs que implique breaking change debe evaluarse por separado.

---

# 19. Calidad y accesibilidad

Requisitos de calidad del hito:

```text
keyboard navigation
semantic buttons/links
form labels
modal focus
Escape behavior
responsive navigation
reasonable contrast
```

No se intenta certificar WCAG completo en este hito.

---

# 20. Limite backend

Este es principalmente un hito frontend.

Cambios backend requieren aprobacion enfocada separada. Los ajustes puntuales de Products y Sales ya entregados se documentan como capacidad vigente, no como autorización para un rediseño backend amplio.

No hay rediseño backend amplio aprobado.

---

# 21. Validacion vigente UX-B.5G3

```text
Products frontend
14 tests PASS

Inventory frontend
23 tests PASS

Equipment frontend
61 tests PASS

Full frontend
25 files / 336 tests PASS

build
PASS

lint
PASS

git diff --check
PASS
```

La QA histórica registrada cubre detalle y lifecycle de Products, movimientos reales de Purchase Receipt y Sale, Equipment list/detail, inspección, creación manual y retiro.

---

# 22. Deuda y siguiente hito

Permanece abierta:

```text
Products reactivation
Product tracking migration workflow
Inventory backend pagination / filtering
Inventory date-range filtering
manual adjustment workflow review
Equipment serial correction / edit
manual Equipment batch selector
retired actor name resolution
Product.stock ↔ EquipmentAsset reconciliation
Equipment bulk / list Availability if later required
Equipment pagination
request idempotency debts already recorded elsewhere
```

Siguiente bloque:

```text
UX-B.5H
PURCHASE RECEIPTS + REMAINING ERP NORMALIZATION
```

Foco inicial:

```text
dedicated /purchase-receipts experience
receipt list / detail
purchase → receipt traceability
ASSET provisioning visibility where useful
Customers / Suppliers / Quotes / Purchases normalization
shared UX inconsistencies
```

Equipment Assignment y Case logistics permanecen en la línea futura de Healthcare; no forman parte de UX-B.5H.
