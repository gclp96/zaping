# Dashboard — Zaping ERP

**Módulo:** Dashboard
**Producto:** Zaping ERP Core
**Versión:** 2.2.0
**Estado:** Aprobado
**Estado de implementación:** DASHBOARD V1 IMPLEMENTED / VALIDATED
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Dashboard proporciona una vista consolidada del estado operativo y comercial de
una Company.

Su responsabilidad principal es responder:

```text
¿Qué está ocurriendo?

¿Qué información importante debo revisar?

¿Qué cambió recientemente?

¿A qué módulo necesito ir?
```

Dashboard funciona principalmente como:

```text
Read Model
+
Operational Overview
+
Navigation Context
```

No constituye un dominio transaccional independiente.

---

# 2. Principio fundamental

La evolución deseada es:

```text
Data
↓
Context
↓
Attention
↓
Action
```

Sin embargo, debe distinguirse:

```text
CURRENT
→ Operational Overview
```

de:

```text
TARGET
→ Action Dashboard
```

---

# 3. Ownership

Dashboard puede ser propietario de:

```text
read-model composition

aggregations

presentation-oriented metrics

summary DTOs

navigation context

widget composition
```

No es propietario del lifecycle de los dominios que consulta.

---

# 4. Fuera del alcance

Dashboard no administra directamente:

```text
Customer lifecycle

Supplier lifecycle

Product lifecycle

Purchase lifecycle

PurchaseReceipt creation

Quote lifecycle

Sale lifecycle

Inventory mutations

Equipment lifecycle

Healthcare Case lifecycle
```

---

# 5. Read Model principle

Debe mantenerse:

```text
Domain Modules
↓
Dashboard Read Model
↓
Dashboard UI
```

No:

```text
Dashboard
↓
redefines domain rules
```

Dashboard puede agregar información.

No debe reinventar el significado de esa información.

---

# 6. Ejemplo

Correcto:

```text
Inventory / Products
→ defines low-stock semantics

Dashboard
→ presents Low Stock Products
```

Incorrecto:

```text
Dashboard
→ invents a second low-stock rule
```

---

# 7. CURRENT vs TARGET vs FUTURE

Este documento distingue:

## CURRENT

Capacidades implementadas actualmente.

## TARGET

Mejoras aprobadas para evolucionar Dashboard hacia una experiencia más
accionable.

## FUTURE

Capacidades posteriores que requieren nuevos dominios, métricas o infraestructura.

---

# 8. Estado CURRENT

Dashboard V1 implementa actualmente:

```text
GET /dashboard

real tenant-scoped metrics

Customers metric

Suppliers metric

Products metric

Quotes metric

Purchases metric

Sales metric

Inventory Value

Low Stock Products

Recent Sales

KPI navigation

main loading state

main error state

retry

empty-state handling

localized Recent Sales failure
```

No utiliza datos mock para representar Sales actuales.

---

# 9. Dashboard CURRENT

La experiencia vigente es principalmente:

```text
Operational Overview
```

y presenta:

```text
catalog context

commercial context

procurement context

inventory context

recent commercial activity
```

No constituye todavía el Action Dashboard completo definido como dirección de
producto.

---

# 10. API CURRENT

Actualmente existe:

```text
GET /dashboard
```

como endpoint agregado principal.

Dashboard frontend también utiliza:

```text
GET /sales
```

para construir el bloque CURRENT de Recent Sales.

---

# 11. Current request composition

La implementación actual utiliza principalmente:

```text
GET /dashboard
+
GET /sales
```

Esto no equivale al anti-patrón de que frontend consulte individualmente cada
dominio para reconstruir todas las métricas.

La agregación principal continúa concentrada en:

```text
GET /dashboard
```

---

# 12. DashboardService

`DashboardService` puede encargarse de:

```text
coordinating read queries

aggregating counts

calculating read-model values

building presentation DTOs
```

Puede contener lógica de agregación.

No debe contener reglas que modifiquen lifecycle de otros módulos.

---

# 13. Valid aggregation logic

Ejemplo válido:

```text
DashboardService
→ calculate / retrieve a metric
→ return presentation-oriented value
```

---

# 14. Invalid domain logic

Ejemplo inválido:

```text
DashboardService
→ decides that a Purchase becomes RECEIVED
```

Ese comportamiento pertenece a Purchases.

---

# 15. Current metrics

El Dashboard vigente presenta información real relacionada con:

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

# 16. Customers metric CURRENT

Dashboard presenta una métrica de Customers.

La semántica exacta de:

```text
all Customers
```

frente a:

```text
active Customers only
```

debe corresponder al query CURRENT implementado en DashboardService.

Este documento no inventa una semántica distinta.

---

# 17. Suppliers metric CURRENT

Dashboard presenta una métrica de Suppliers.

Al igual que Customers, la definición exacta debe corresponder al query CURRENT y
no inferirse únicamente desde el lifecycle del módulo Suppliers.

---

# 18. Products metric CURRENT

Dashboard presenta una métrica de Products.

Si posteriormente se requiere diferenciar:

```text
active Products

inactive Products
```

deberá definirse explícitamente la métrica correspondiente.

---

# 19. Quotes metric CURRENT

Dashboard presenta actualmente contexto de Quotes.

Las métricas más avanzadas como:

```text
Draft Quotes

Confirmed Quotes

conversion rate

follow-up required
```

no deben considerarse CURRENT salvo implementación específica.

---

# 20. Purchases metric CURRENT

Dashboard presenta actualmente contexto general de Purchases.

No debe confundirse con una experiencia operativa completa de:

```text
pending receipts

partial receipts

receipts today
```

Estas métricas pueden añadirse posteriormente.

---

# 21. Sales metric CURRENT

Dashboard consume actualmente el modelo:

```text
Sale
```

que continúa siendo:

```text
CURRENT ERP Core V1
```

Debe describirse como:

```text
CURRENT transitional commercial model
```

y no como un modelo meramente histórico.

---

# 22. SalesOrder / Delivery

La futura arquitectura:

```text
SalesOrder
↓
Delivery
```

pertenece a:

```text
TARGET
```

No debe utilizarse actualmente como fuente de métricas reales del Dashboard.

---

# 23. Inventory Value CURRENT

Dashboard incluye:

```text
inventoryValue
```

como métrica operativa.

Debe mantenerse:

```text
Inventory Value
→ operational indicator
```

No:

```text
Inventory Value
→ audited accounting valuation
```

---

# 24. Inventory Value boundary

Antes de utilizar `inventoryValue` como cifra contable oficial deberán existir
reglas explícitas de:

```text
valuation

cost methodology

financial reporting

accounting semantics
```

Actualmente esa formalización no forma parte de Dashboard V1.

---

# 25. Low Stock CURRENT

Dashboard presenta Products con bajo stock según la semántica CURRENT:

```text
stock <= minStock
```

Debe mantenerse alineado con Products / Inventory.

---

# 26. Low Stock ownership

Debe mantenerse:

```text
Products / Inventory
→ source semantics
```

```text
Dashboard
→ presentation
```

Dashboard no debe crear una segunda definición incompatible.

---

# 27. Recent Sales CURRENT

Dashboard incluye un bloque de:

```text
Recent Sales
```

utilizando el response CURRENT de:

```text
GET /sales
```

---

# 28. Recent Sales selection

La implementación CURRENT utiliza:

```text
first five Sales
returned by the current Sales list response
```

No debe afirmarse una garantía más fuerte de orden temporal si el contrato del
backend no la define explícitamente.

---

# 29. Recent Sales failure isolation

La consulta de Recent Sales está aislada del resumen principal.

Debe mantenerse conceptualmente:

```text
GET /dashboard
✓

GET /sales
✗

→ main Dashboard remains usable
```

cuando la degradación sea segura.

---

# 30. Main Dashboard failure

Si falla información fundamental de:

```text
GET /dashboard
```

la UI debe comunicar el error principal.

No debe sustituir un fallo por valores ficticios.

---

# 31. Zero vs unavailable

Debe mantenerse:

```text
0
≠
query failed
```

Ejemplo:

```text
0 Purchases
```

no equivale a:

```text
Purchases query unavailable
```

---

# 32. Loading CURRENT

Dashboard implementa estado de carga.

La UI no debe presentar una pantalla vacía mientras espera información.

Puede utilizar:

```text
loading state

spinner

skeleton
```

según Design System.

---

# 33. Error CURRENT

Dashboard implementa:

```text
error state

retry
```

para la carga principal.

Los mensajes deben distinguir:

```text
empty valid data
```

de:

```text
failed data retrieval
```

---

# 34. Empty states

Una Company nueva puede tener métricas:

```text
0
```

de forma completamente válida.

Dashboard debe presentar ese estado sin sugerir que ocurrió un error.

---

# 35. KPI navigation CURRENT

Los KPIs enlazables pueden navegar a sus módulos propietarios.

Debe mantenerse:

```text
Dashboard
→ context
→ module navigation
```

No:

```text
Dashboard
→ duplicates module workflow
```

---

# 36. Quick Actions

Quick Actions son una dirección UX válida, pero no deben marcarse como CURRENT
salvo verificación específica de cada acción en Dashboard.

Por tanto:

```text
Quick Actions
→ TARGET UX
```

---

# 37. Quick Actions TARGET

Posibles acciones:

```text
Nueva cotización

Nueva venta

Nueva compra

Registrar recepción

Registrar cliente

Registrar producto

Revisar bajo stock
```

Cada acción debe delegar al workflow propietario.

---

# 38. Sensitive Quick Actions

Acciones como:

```text
Inventory Adjustment
```

no deben exponerse universalmente desde Dashboard.

Requieren:

```text
business need
+
authorization
+
validated Inventory workflow
```

---

# 39. Action Dashboard TARGET

La dirección de producto es evolucionar hacia:

```text
Action Dashboard
```

con prioridad en:

```text
attention

tasks

context

navigation
```

por encima de mostrar únicamente contadores.

---

# 40. Attention blocks TARGET

Un futuro Dashboard puede presentar:

```text
Low Stock Products

Purchases requiring receipt

commercial operations requiring action

expiration alerts

Healthcare operational attention
```

únicamente cuando cada fuente esté implementada y tenga reglas claras.

---

# 41. Purchase Receipt indicators TARGET

PurchaseReceipt ya existe como dominio.

Sin embargo, Dashboard no debe afirmar actualmente widgets como:

```text
Purchases pending receipt

Partially received Purchases

Recent receipts
```

si todavía no están implementados en el Read Model actual.

Estado:

```text
Purchase Receipt Dashboard indicators
→ TARGET
```

---

# 42. Sales attention TARGET

Cuando exista SalesOrder / Delivery, Dashboard podrá mostrar:

```text
SalesOrders pending fulfillment

Partially delivered orders

Deliveries requiring action
```

Actualmente:

```text
SalesOrder / Delivery indicators
→ TARGET
```

---

# 43. Commercial Returns

Generic Commercial Returns permanece:

```text
P1 / DEFERRED
```

Por tanto:

```text
Return pending

Return rate

Returns confirmed
```

no deben presentarse como métricas CURRENT.

---

# 44. Commercial Returns Dashboard

Cuando Commercial Returns sea implementado podrá aportar métricas específicas.

Debe mantenerse:

```text
Commercial Returns
→ future Dashboard consumer
```

No:

```text
Dashboard currently consumes Returns
```

---

# 45. Commercial Return ≠ Healthcare Return

Debe mantenerse:

```text
Commercial Return
≠
Healthcare custody Return
```

Los futuros widgets tampoco deben mezclar ambas semánticas.

---

# 46. Expiration alerts TARGET

La existencia de:

```text
expirationDate
```

en InventoryBatch no significa que Dashboard ya soporte alertas de caducidad.

Hace falta definir:

```text
expiration window

eligible batches

expired semantics

query

UX
```

Por tanto:

```text
Near Expiration
→ TARGET
```

---

# 47. Trends TARGET

Dashboard puede evolucionar hacia:

```text
current period

previous period

variation

trend
```

pero:

```text
trends
→ NOT CURRENT
```

---

# 48. No inventar trends

No mostrar:

```text
+25%
```

sin poder definir:

```text
current period

comparison period

included records

status filters

calculation
```

---

# 49. Charts TARGET

Charts pueden utilizarse cuando respondan una pregunta real.

Ejemplos futuros:

```text
Sales over time

Purchases by month

Purchases by Supplier

Sales by Customer

Inventory trends
```

No son requisito para Dashboard V1.

---

# 50. Decorative charts anti-pattern

No debe agregarse una gráfica únicamente porque visualmente haga parecer más
completo al producto.

Debe aportar:

```text
comparison

trend

anomaly detection

decision support
```

---

# 51. KPI definitions

Cada métrica futura debe tener una definición explícita.

Por ejemplo:

```text
Active Customers
```

puede significar:

```text
isActive = true
```

o:

```text
Customers with recent commercial activity
```

Estas dos definiciones no deben mezclarse.

---

# 52. Metric labels

Las etiquetas deben comunicar su significado.

Ejemplo:

```text
Clientes habilitados
```

si significa:

```text
isActive = true
```

frente a:

```text
Clientes con compra en 90 días
```

si mide actividad comercial.

---

# 53. Ambiguous metrics

Métricas como:

```text
Top Customers

Top Products

Average Ticket

Conversion Rate
```

requieren definir antes:

```text
period

measure

included lifecycle states

denominator when applicable
```

---

# 54. Salesperson metrics FUTURE

Actualmente no existe ownership comercial suficientemente formalizado para tratar:

```text
Sales by Salesperson
```

como métrica confiable.

Debe permanecer:

```text
FUTURE
```

hasta que exista la relación correspondiente.

---

# 55. Recent Activity TARGET

Una futura sección de Recent Activity puede mostrar eventos como:

```text
Purchase created

PurchaseReceipt registered

Quote approved

Sale confirmed

Customer created
```

cuando exista una fuente adecuada.

---

# 56. Audit boundary

Debe mantenerse:

```text
Dashboard Recent Activity
≠
Audit System
```

Dashboard puede consumir Audit en el futuro.

No sustituye un registro completo de auditoría.

---

# 57. Audit CURRENT status

Actualmente no existe una plataforma transversal de Audit completamente
implementada.

Por tanto:

```text
Audit-fed Dashboard Timeline
→ TARGET
```

No debe describirse como fuente CURRENT.

---

# 58. Notifications boundary

Debe mantenerse:

```text
Dashboard Alert
≠
Notification
```

Dashboard Alert:

```text
visible context when user opens Dashboard
```

Notification:

```text
directed communication to a user
```

Notifications continúa siendo una capacidad separada/futura salvo implementación
específica.

---

# 59. Operational alerts TARGET

Un futuro sistema de alertas puede incluir:

```text
Low Stock

Out of Stock

Near Expiration

Pending Receipt

Operational exceptions
```

Debe existir una semántica consistente de severidad.

---

# 60. Severity

No debe diseñarse un segundo sistema visual dentro de Dashboard.

La representación visual debe alinearse con:

```text
Design System
```

La prioridad empresarial puede mantenerse separada de la presentación visual si
es necesario.

---

# 61. Role-aware Dashboard TARGET

Una futura evolución puede adaptar información según responsabilidades.

Ejemplo conceptual:

```text
Sales
→ commercial work

Warehouse
→ receipts / fulfillment / stock attention

Management
→ KPIs / trends / exceptions
```

Actualmente:

```text
role-aware widget composition
→ TARGET
```

---

# 62. Widget permissions TARGET

El Dashboard CURRENT no debe afirmar granularidad de permisos por widget.

Una futura estrategia puede requerir:

```text
dashboard.read

domain permissions

sensitive-metric permissions
```

según la arquitectura RBAC final.

---

# 63. Sensitive metrics

Información como:

```text
inventory value

cost

revenue

margin

activity of other users
```

puede requerir autorización específica.

El acceso al Dashboard no debe asumirse automáticamente como permiso para toda
información sensible.

---

# 64. Authorization

Dashboard debe respetar:

```text
Authentication

Authorization

Tenant Isolation

Data minimization
```

La revisión transversal de permisos críticos continúa siendo necesaria antes de
producción.

---

# 65. Multi-tenancy

Dashboard opera dentro de:

```text
authenticated Company
```

Debe mantenerse:

```text
Dashboard
→ one tenant context
```

No debe aceptar un `companyId` arbitrario desde frontend para cambiar el scope del
usuario.

---

# 66. Cross-tenant aggregation

Nunca debe ocurrir:

```text
Company A metrics
+
Company B metrics
```

para un usuario que solo pertenece al contexto de Company A.

Toda agregación debe permanecer tenant-scoped.

---

# 67. Multi-company Dashboard FUTURE

Una futura experiencia multi-company requerirá:

```text
explicit membership

authorization

scope selection
```

No debe construirse simplemente retirando los filtros de tenant.

---

# 68. Read Model DTO

Dashboard debe preferir un response orientado a presentación.

Conceptualmente:

```text
DashboardResponse

totals

inventory

attention

activity
```

cuando esos bloques existan.

No necesita devolver entidades Prisma completas.

---

# 69. Frontend aggregation boundary

Debe evitarse que frontend tenga que ejecutar:

```text
GET customers

GET suppliers

GET products

GET purchases

GET quotes

GET inventory
```

y reconstruir la lógica completa.

CURRENT:

```text
GET /dashboard
+
GET /sales
```

es una composición controlada y no ese anti-patrón.

---

# 70. Performance

El objetivo histórico de:

```text
< 500 ms
```

puede mantenerse como:

```text
performance target
under representative normal conditions
```

No constituye:

```text
current SLA
```

ni garantía universal.

---

# 71. Performance evolution

Conforme el volumen crezca pueden evaluarse:

```text
aggregate queries

indexes

safe parallel reads

caching

pre-aggregation

optimized Read Models
```

solo cuando mediciones reales lo justifiquen.

---

# 72. No premature analytics infrastructure

No introducir automáticamente:

```text
Redis

materialized views

event streaming

analytics warehouse
```

sin evidencia de necesidad.

Debe mantenerse:

```text
measure
↓
identify bottleneck
↓
optimize
```

---

# 73. Cache

La estrategia de cache dependerá del tipo de dato.

Por ejemplo:

```text
monthly trend
```

puede tolerar más latencia que:

```text
critical operational attention
```

No toda métrica necesita la misma frescura.

---

# 74. Real-time semantics

En Dashboard CURRENT:

```text
real-time
```

no implica necesariamente:

```text
WebSockets

SSE

streaming
```

Significa información suficientemente actual para la operación cuando el usuario
consulta o refresca la vista.

---

# 75. Onboarding Dashboard FUTURE

Una Company nueva puede beneficiarse posteriormente de un flujo como:

```text
Add Products

Add Customers

Create first Quote

Create first Purchase
```

en lugar de recibir únicamente KPIs en cero.

Actualmente:

```text
Onboarding Dashboard
→ FUTURE UX
```

---

# 76. Healthcare boundary

Healthcare puede requerir posteriormente una experiencia especializada.

Debe mantenerse:

```text
ERP Dashboard
≠
Healthcare operational workspace
```

---

# 77. Healthcare CURRENT status

Healthcare Case Foundation existe, pero Dashboard no debe presentar como CURRENT
capacidades como:

```text
Case preparation

CaseKit

Equipment Assignment

CaseDispatch

Healthcare Return

Reconciliation
```

mientras esos workflows no estén implementados.

---

# 78. Healthcare Dashboard TARGET

Una futura experiencia especializada puede mostrar:

```text
Cases today

Cases requiring preparation

Equipment conflicts

Returns pending

Reconciliation incidents
```

según los dominios que realmente existan en ese momento.

---

# 79. Case Calendar boundary

Debe mantenerse:

```text
Dashboard
→ summary / attention
```

```text
Case Calendar
→ temporal Healthcare planning
```

Pueden enlazarse.

No son la misma experiencia.

---

# 80. Warehouse boundary

Debe mantenerse:

```text
Dashboard
→ overview / attention
```

frente a:

```text
Warehouse Operations
→ execution workspace
```

Un futuro Dashboard puede decir:

```text
3 operaciones requieren atención
```

y navegar al workspace correspondiente.

---

# 81. Radar boundary

Si Zaping Radar se integra posteriormente, debe mantenerse:

```text
ERP
→ internal operational data
```

```text
Radar
→ external opportunity data
```

El origen de cada información debe ser claro.

---

# 82. AI FUTURE

Una futura capa de AI puede aportar:

```text
insights

recommendations

anomaly detection

natural-language queries
```

pero debe estar basada en información real y autorizada.

---

# 83. Explainable AI

Una recomendación futura debe poder explicar el dato que la origina.

Ejemplo:

```text
Review Product X

stock = 4

minStock = 10
```

No:

```text
Buy 50 units
```

sin justificación trazable.

---

# 84. Financial boundary

Debe mantenerse:

```text
Sale total
≠
recognized revenue
```

```text
Sale total
≠
cash collected
```

```text
Sale total
≠
profit
```

Un futuro Financial Dashboard requerirá dominios financieros suficientemente
formalizados.

---

# 85. Executive Dashboard FUTURE

Una futura experiencia ejecutiva puede utilizar:

```text
trends

operational risk

commercial performance

inventory context

financial data
```

solo cuando cada métrica sea confiable y esté definida.

---

# 86. Custom Dashboard FUTURE

Capacidades como:

```text
Favorite Widgets

Saved Filters

Custom Dashboards

Drag & Drop

Exports
```

permanecen FUTURE.

No son prioritarias para Dashboard V1.

---

# 87. IMPLEMENTED

Actualmente:

```text
Dashboard page

GET /dashboard integration

GET /sales integration for Recent Sales

real metrics

Customers metric

Suppliers metric

Products metric

Quotes metric

Purchases metric

Sales metric

Inventory Value

Low Stock Products

Recent Sales

KPI links

main loading

main error

retry

empty-state handling

Recent Sales error isolation
```

---

# 88. VALIDATED

La validación registrada cubre según los hitos correspondientes:

```text
real Dashboard data

no mocked Sales data

Dashboard loading

main error handling

retry

empty states

KPI navigation

Low Stock presentation

Inventory Value presentation

Recent Sales

localized Recent Sales failure
```

Los detalles cuantitativos pertenecen a:

```text
PROJECT_BOARD.md

CHANGELOG.md
```

---

# 89. TECHNICAL DEBT

Permanece pendiente:

```text
more explicit metric definitions where semantics are ambiguous
```

```text
server-defined Recent Activity
```

```text
role-aware sensitive metric authorization
```

```text
Dashboard-level operational attention Read Models
```

```text
performance measurement under representative data volume
```

---

# 90. TARGET

La evolución aprobada incluye:

```text
Action Dashboard

task-oriented summaries

operational attention blocks

Purchase Receipt indicators

expiration alerts

Recent Activity

contextual Quick Actions

role-aware presentation

more precise KPI definitions

useful charts / trends

stronger sensitive-metric authorization
```

---

# 91. FUTURE

Capacidades posteriores:

```text
SalesOrder / Delivery indicators

Commercial Return indicators

Healthcare Dashboard

Custom Dashboards

Favorite Widgets

Saved Filters

Drag & Drop

Multi-company views

Executive Dashboard

Financial Dashboard

advanced analytics

exports

AI insights

predictive analytics

natural-language queries
```

No forman parte automáticamente del siguiente sprint.

---

# 92. Invariantes

## Tenant

```text
Dashboard
→ authenticated Company context
```

---

## Read Model

```text
Dashboard
→ consumes domain information
```

---

## Ownership

```text
Dashboard
→ does not own transactional lifecycle
```

---

## Inventory

```text
Dashboard
→ does not directly mutate Inventory
```

---

## Metrics

```text
Dashboard metric
→ must have explicit meaning
```

---

## Error semantics

```text
0
≠
query failure
```

---

## Navigation

```text
Dashboard action
→ delegates to owning workflow
```

---

## Domain rules

```text
Dashboard
→ must not duplicate domain business rules
```

---

## Multi-tenancy

```text
cross-tenant aggregation
→ forbidden
```

---

# 93. Anti-patrones

## Database Counter Dashboard

Incorrecto limitar toda la experiencia a:

```text
Customers: 45

Products: 810

Sales: 92
```

sin contexto ni navegación.

---

## Duplicated Business Rules

Incorrecto redefinir:

```text
Low Stock

Purchase state

Sale state
```

dentro de Dashboard.

---

## Dashboard as Transaction Service

Incorrecto:

```text
POST /dashboard/adjust-stock
```

---

## Frontend Aggregation Explosion

Incorrecto reconstruir todo el ERP mediante múltiples requests independientes en
React.

---

## Metric Without Definition

Incorrecto mostrar:

```text
Active Customers
```

sin poder explicar qué significa.

---

## Decorative Charts

Incorrecto agregar gráficas sin una pregunta empresarial.

---

## False Zero

Incorrecto:

```text
query failed
↓
display 0
```

---

## Unprotected Sensitive Metrics

Incorrecto asumir:

```text
Dashboard access
→ access to every financial / cost metric
```

---

## Premature BI Platform

Incorrecto construir una infraestructura analítica compleja antes de medir la
necesidad.

---

## Target documented as Current

Incorrecto presentar:

```text
SalesOrder

Delivery

Commercial Returns

Healthcare operations

Audit Timeline

Notifications
```

como si fueran fuentes CURRENT del Dashboard.

---

# 94. Relación con Customers

Customers proporciona el catálogo maestro.

Dashboard puede presentar:

```text
counts

summary context
```

sin modificar Customers.

---

# 95. Relación con Suppliers

Suppliers proporciona contexto de abastecimiento.

Dashboard puede consumir métricas relacionadas sin administrar el lifecycle del
Supplier.

---

# 96. Relación con Products

Products proporciona identidad de catálogo.

Inventory proporciona información física.

Dashboard presenta ambas cuando corresponda.

---

# 97. Relación con Purchases

CURRENT:

```text
Purchase metric
```

TARGET:

```text
pending receipt attention

partial receipt attention

recent receipts
```

según el Read Model futuro.

---

# 98. Relación con Purchase Receipts

PurchaseReceipts puede alimentar métricas operativas futuras.

Dashboard no administra:

```text
receipt creation

receipt idempotency

Inventory effects
```

---

# 99. Relación con Inventory

Inventory es propietario de:

```text
stock

movements

batches

inventory semantics
```

Dashboard presenta contexto como:

```text
Inventory Value

Low Stock
```

---

# 100. Relación con Quotes

Quotes puede alimentar:

```text
counts

status summaries

future follow-up metrics
```

sin transferir lifecycle a Dashboard.

---

# 101. Relación con Sales

CURRENT:

```text
Sale metrics

Recent Sales
```

TARGET:

```text
SalesOrder metrics

Delivery metrics
```

Dashboard debe evolucionar junto con la arquitectura comercial.

---

# 102. Relación con Returns

Commercial Returns permanece:

```text
P1 / DEFERRED
```

Cuando exista, podrá proporcionar Read Models específicos.

No forma parte del Dashboard CURRENT.

---

# 103. Relación con Healthcare

Healthcare podrá aportar Read Models especializados.

Dashboard Core no debe convertirse en propietario de:

```text
Case

Dispatch

Return

Reconciliation

Equipment Assignment
```

---

# 104. Relación con Design System

Design System gobierna:

```text
Cards

Loading

Empty

Error

Status presentation

responsive behavior

accessibility

visual hierarchy
```

Dashboard no debe crear un sistema visual paralelo.

---

# 105. ADR relacionados

```text
ADR-001 — Multi-Tenant

ADR-005 — Layered Architecture

ADR-006 — API First

ADR-007 — RBAC

ADR-009 — Modular Monolith

ADR-011 — SalesOrder + Delivery

ADR-012 — Entity Lifecycle

ADR-013 — Inventory Custody & Case Logistics
```

---

# 106. Documentación relacionada

```text
docs/modules/erp/CUSTOMERS.md

docs/modules/erp/SUPPLIERS.md

docs/modules/erp/PRODUCTS.md

docs/modules/erp/PURCHASES.md

docs/modules/erp/PURCHASE_RECEIPTS.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/QUOTES.md

docs/modules/erp/SALES.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/architecture/ARCHITECTURE.md

docs/engineering/API_GUIDELINES.md

docs/engineering/QUALITY_STANDARDS.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/product/PRODUCT_REQUIREMENTS.md

docs/product/ZAPING_WAY.md

docs/ux/DESIGN_SYSTEM.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

`RETURNS.md` puede permanecer como documentación estratégica/deferred, pero no
representa una dependencia CURRENT de Dashboard V1.

---

# 107. Fuente de verdad

```text
DASHBOARD.md
→ Dashboard Read Model behavior
→ Dashboard UX boundaries
```

```text
Dashboard backend
→ CURRENT metrics and aggregation
```

```text
Dashboard frontend
→ CURRENT presentation and error behavior
```

```text
ERP module documentation
→ source-domain semantics
```

```text
SALES.md
→ CURRENT Sale semantics
```

```text
INVENTORY.md
→ Inventory / Low Stock semantics
```

```text
ADR-011
→ TARGET SalesOrder / Delivery architecture
```

```text
Healthcare documentation
→ future Healthcare-specific operational context
```

```text
tests
→ validated Dashboard behavior
```

```text
PROJECT_BOARD.md
→ active status / technical debt
```

```text
CHANGELOG.md
→ historical implementation evolution
```

---

# 108. Estado consolidado

CURRENT:

```text
GET /dashboard
✅

real tenant-scoped data
✅

Customers metric
✅

Suppliers metric
✅

Products metric
✅

Quotes metric
✅

Purchases metric
✅

Sales metric
✅

Inventory Value
✅

Low Stock Products
✅

GET /sales for Recent Sales
✅

Recent Sales
✅

KPI navigation
✅

loading
✅

main error
✅

retry
✅

empty states
✅

Recent Sales error isolation
✅
```

TARGET:

```text
Action Dashboard
⏳

Purchase Receipt attention
⏳

operational alerts
⏳

expiration alerts
⏳

Recent Activity
⏳

Quick Actions
⏳

role-aware presentation
⏳

sensitive metric authorization improvements
⏳

charts / trends
⏳
```

FUTURE:

```text
SalesOrder / Delivery indicators

Commercial Return indicators

Healthcare Dashboard

custom widgets

exports

Executive Dashboard

Financial Dashboard

advanced analytics

AI insights

natural-language queries
```

---

# 109. Secuencia de proyecto

Dashboard V1 forma parte del ERP Core actual.

La secuencia vigente es:

```text
H8 Documentation / Technical Regression
↓
UX-B.6 Full ERP End-to-End QA
↓
ERP Core V1 Closure
↓
Healthcare specialization
```

Por tanto no deben introducirse automáticamente antes del cierre actual:

```text
SalesOrder / Delivery Dashboard

Commercial Returns Dashboard

Healthcare Action Dashboard

advanced analytics

AI
```

únicamente porque aparezcan como dirección futura en este documento.

---

# 110. Principio final

Dashboard no debe limitarse a responder:

```text
¿Cuántos registros existen?
```

La dirección de producto es evolucionar hacia:

```text
¿Qué está ocurriendo?
↓
¿Qué necesita atención?
↓
¿Por qué?
↓
¿A dónde debo ir?
```

CURRENT:

```text
Dashboard
→ real operational overview
→ real KPIs
→ Inventory context
→ Low Stock
→ Recent Sales
→ contextual navigation
```

TARGET:

```text
Dashboard
→ attention
→ tasks
→ context
→ action
```

Debe mantenerse:

```text
Dashboard
≠
transactional domain
```

y:

```text
Dashboard
≠
source of truth for domain rules
```

> **El Dashboard hace visible lo que los dominios ya saben. Su responsabilidad es
> agregar contexto, señalar información relevante y conducir al usuario hacia el
> workflow correcto sin apropiarse de la lógica transaccional.**
