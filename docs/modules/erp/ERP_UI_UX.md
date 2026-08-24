# ERP Core UI / UX Completion - Zaping ERP

**Modulo:** ERP Core UI / UX
**Producto:** Zaping ERP Core
**Version:** 1.0.0
**Estado:** Approved milestone scope
**Estado de implementacion:** UX-A.5 DOCUMENTED / IMPLEMENTATION NOT STARTED
**Ultima actualizacion:** 2026-08-24
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

Sales frontend completion es requisito P1 del hito.

Backend actual soporta:

```text
POST /sales
GET /sales
approve
cancel
PDF
POST /sales/from-quote/:quoteId
```

Hallazgo actual:

```text
SalesService tiene findOne
SalesController no expone GET /sales/:id
```

Direccion aprobada:

```text
Build Sales V1 against the current Sales backend.
Do not wait for a future SalesOrder/Delivery refactor.
Do not refactor SalesOrder/Delivery in this milestone.
```

Un endpoint backend pequeño y aislado `GET /sales/:id` puede evaluarse cuando la UI de Sales llegue al requisito de detalle, sujeto a revision enfocada.

Sales V1 debe soportar conceptualmente:

```text
Sales list
New Sale
Sale detail
Customer
Items
quantities
prices
IVA/totals
status
approve
cancel
PDF
Quote → Sale relationship where currently supported
```

No debe sobreconstruir workflows no soportados por backend.

---

# 8. Purchase Receipts

Una ruta frontend dedicada de Purchase Receipts debe existir eventualmente.

La funcionalidad embebida actual dentro de Purchases sigue siendo valida hasta esa fase.

La ruta dedicada es P2 y no bloquea App Shell.

No se debe implementar en UX-B.1.

---

# 9. Equipment

Equipment frontend si forma parte de ERP Core UI / UX Completion.

Razon:

```text
Core Equipment backend is already implemented and validated,
but the frontend journey is currently broken.
```

Prioridad Equipment UX:

```text
1. Equipment list
2. Equipment detail
3. Current Availability display
4. Inspection workflow
```

Retirement puede implementarse despues del workflow primario si el alcance requiere staging.

No se debe implementar Equipment en UX-B.1.

---

# 10. Products e Inventory

Products frontend esta stale frente al backend.

Normalizacion futura debe exponer apropiadamente:

```text
inventoryTracking
lotTracking
```

Bug de display confirmado:

```text
brand currently displays product.name
```

Inventory UI actual es principalmente una stock table.

El hito futuro debe considerar Inventory Movement UI usando capacidad backend existente.

Inventory Movement UI no es P0.

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
persistent Authenticated App Shell
broken navigation architecture
/sales link currently points to missing route
protected-route/session UX review
```

P1:

```text
Sales frontend
Dashboard 2.0
Products tracking-field alignment
Equipment list/detail/current workflow
```

P2:

```text
Purchase Receipts dedicated route
Inventory movements frontend
search/filter/table consistency
form/error/loading/empty-state normalization
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

Cambios backend requieren aprobacion enfocada separada.

Bloqueador potencial conocido:

```text
GET /sales/:id
```

No hay rediseño backend amplio aprobado.
