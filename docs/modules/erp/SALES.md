# Sales — Zaping ERP

**Módulo:** Sales
**Producto:** Zaping ERP Core
**Versión:** 2.2.0
**Estado:** Aprobado
**Estado de implementación:** SALES V1 IMPLEMENTED / VALIDATED
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Sales administra el workflow comercial CURRENT mediante el cual una Company
registra una venta para un Customer y, al confirmarla, produce la salida física
correspondiente de Inventory.

Su responsabilidad actual es responder:

```text
¿Quién compra?

¿Qué Products se venden?

¿Qué cantidades?

¿A qué precios?

¿Cuál es el total?

¿En qué estado está la Sale?

¿Ya produjo Inventory OUT?

¿Provino de una Quote?
```

La arquitectura futura separará explícitamente:

```text
commercial commitment
```

de:

```text
physical fulfillment
```

mediante SalesOrder y Delivery.

---

# 2. Ownership CURRENT

Sales es propietario actualmente de:

```text
Sale

SaleItem

Sale folio

Customer relationship

commercial quantities

commercial prices

subtotal

iva

total

Sale lifecycle

Quote-origin relationship when applicable
```

Sales coordina con Inventory la consecuencia física de una Sale confirmada.

---

# 3. Fuera del alcance

Sales no es propietario de:

```text
Product master data

Inventory stock model

InventoryBatch semantics

Purchase

PurchaseReceipt

Customer master lifecycle

Equipment lifecycle

Billing

Invoice

Payment

Accounts Receivable

Healthcare custody
```

---

# 4. CURRENT vs TARGET vs FUTURE

Este documento distingue:

## CURRENT

Comportamiento implementado y validado mediante `Sale`.

## TARGET

Arquitectura futura basada en:

```text
SalesOrder
↓
Delivery
```

## FUTURE

Capacidades posteriores como:

```text
Returns

Reservations

Shipments

Billing

advanced fulfillment
```

---

# 5. Estado CURRENT

Sales V1 soporta actualmente:

```text
Sale persistence

SaleItem

direct Sale creation

DRAFT

CONFIRMED

CANCELLED

DRAFT approval

DRAFT cancellation

Customer active validation

Product active validation

Generic Sales eligibility

Inventory OUT on confirmation

Quote → Sale conversion

server-generated sequential folio

Sale detail

Sale deep-link

Sale PDF

frontend list/create/detail/lifecycle
```

---

# 6. Modelo Sale actual

Conceptualmente:

```text
Sale

id
companyId

folio

customerId
quoteId?

subtotal
iva
total

status

createdAt
updatedAt

customer
items
```

La definición técnica exacta pertenece a:

```text
schema.prisma
```

---

# 7. SaleItem

Conceptualmente:

```text
Sale
└── SaleItem
    ├── id
    ├── saleId
    ├── productId
    ├── quantity
    ├── price
    └── subtotal
```

`SaleItem` conserva los valores comerciales de la transacción.

---

# 8. Sale como modelo CURRENT

Debe mantenerse:

```text
Sale
→ CURRENT ERP Core V1
```

Aunque ADR-011 define una arquitectura futura diferente.

La terminología recomendada es:

```text
CURRENT transitional commercial model
```

y no:

```text
historical-only model
```

---

# 9. Lifecycle CURRENT

Sale utiliza:

```text
DRAFT

CONFIRMED

CANCELLED
```

Flujo principal:

```text
DRAFT
├── approve → CONFIRMED
└── cancel  → CANCELLED
```

Actualmente no existe un flujo normal:

```text
CONFIRMED
→ CANCELLED
```

---

# 10. DRAFT

Una Sale creada directamente comienza como:

```text
DRAFT
```

Representa una venta todavía no confirmada físicamente.

Debe mantenerse:

```text
Create direct Sale
→ DRAFT
→ no Inventory mutation
```

---

# 11. DRAFT no implica edición genérica

Actualmente no existe un endpoint genérico documentado:

```text
PATCH /sales/:id
```

ni una UI general de edición de Sale.

Por tanto:

```text
generic Sale editing
→ NOT IMPLEMENTED
```

El estado DRAFT no debe interpretarse automáticamente como una capacidad CRUD
completa.

---

# 12. CONFIRMED

Una Sale pasa:

```text
DRAFT
↓
approve
↓
CONFIRMED
```

Actualmente `CONFIRMED` representa:

```text
commercial confirmation
+
physical Inventory OUT
```

dentro de Sales V1.

---

# 13. CONFIRMED es terminal en el flujo normal

Actualmente una Sale CONFIRMED:

```text
→ no normal cancellation
```

y:

```text
→ no generic reversal workflow
```

La restauración del Inventory después de una Sale confirmada no está implementada.

---

# 14. CANCELLED

Una Sale DRAFT puede pasar a:

```text
CANCELLED
```

Debe mantenerse:

```text
DRAFT
↓
cancel
↓
CANCELLED
```

sin:

```text
InventoryMovement
```

y sin:

```text
Product.stock mutation
```

---

# 15. CANCELLED no significa deleted

Debe mantenerse:

```text
CANCELLED
≠
DELETED
```

La Sale permanece como documento histórico con:

```text
folio

Customer

items

prices

totals

status
```

---

# 16. Direct Sale CURRENT

La creación directa utiliza:

```text
POST /sales
```

Flujo:

```text
validate request
↓
allocate Sale folio
↓
create Sale
↓
DRAFT
```

No modifica Inventory.

---

# 17. Direct Sale create no mueve stock

Debe mantenerse:

```text
POST /sales
→ Sale DRAFT
→ Product.stock unchanged
```

y:

```text
POST /sales
→ no InventoryMovement OUT
```

---

# 18. Approval CURRENT

La aprobación utiliza:

```text
PATCH /sales/:id/approve
```

y conceptualmente ejecuta:

```text
Sale DRAFT validation

+

Customer validation

+

Product validation

+

Generic Sales eligibility validation

+

stock availability validation

+

Sale → CONFIRMED

+

Product.stock decrement

+

InventoryMovement OUT
```

---

# 19. Approval atomicity

La aprobación debe mantener consistencia transaccional.

No debe ocurrir:

```text
Sale CONFIRMED
✓

Inventory OUT
✗
```

ni:

```text
Inventory OUT
✓

Sale still DRAFT
✗
```

---

# 20. Inventory OUT CURRENT

En Sales V1:

```text
Sale CONFIRMED
↓
Inventory OUT
```

La semántica exacta del movimiento pertenece a:

```text
INVENTORY.md
```

Sales determina el evento empresarial que origina esa salida.

---

# 21. InventoryMovement reference

Los movimientos generados por una Sale confirmada deben conservar referencia a la
operación de origen.

Conceptualmente:

```text
InventoryMovement

type = OUT

reference
→ Sale
```

Esto permite trazabilidad:

```text
Sale
↓
InventoryMovement OUT
```

---

# 22. Customer relationship

Toda Sale pertenece a un Customer.

```text
Customer
↓
Sale
```

Customer identifica la contraparte comercial.

---

# 23. Customer validation CURRENT

Para nuevas Sales backend valida:

```text
Customer exists

+

Customer belongs to authenticated Company

+

Customer.isActive = true
```

Estado:

```text
same-tenant validation
✅
```

```text
active Customer validation
✅
```

---

# 24. Inactive Customer

Debe mantenerse:

```text
Inactive Customer
↓
New Sale
→ BLOCK
```

mientras:

```text
Customer becomes inactive later
↓
Historical Sale
→ remains valid
```

---

# 25. Product relationship

Cada `SaleItem` referencia un Product.

Debe mantenerse:

```text
Product
↓
SaleItem
```

Product proporciona la identidad de catálogo.

SaleItem conserva:

```text
quantity

price
```

de la transacción comercial.

---

# 26. Product validation CURRENT

Para Sales nuevas backend debe validar:

```text
Product exists

+

Product belongs to authenticated Company

+

Product.isActive = true

+

Product is Generic-Sales compatible
```

Frontend puede filtrar Products incompatibles, pero backend continúa siendo la
fuente de verdad.

---

# 27. Generic Sales eligibility

El flujo Generic Sales CURRENT permite:

```text
QUANTITY + NONE
```

y:

```text
QUANTITY + OPTIONAL
```

---

# 28. Generic Sales rejected Products

El flujo CURRENT rechaza:

```text
QUANTITY + REQUIRED
```

y cualquier Product con:

```text
inventoryTracking != QUANTITY
```

Por tanto actualmente Generic Sales rechaza:

```text
SERIALIZED

ASSET
```

---

# 29. SERIALIZED ≠ ASSET

Debe mantenerse:

```text
SERIALIZED
≠
ASSET
```

Son estrategias distintas de tracking.

Sin embargo:

```text
Generic Sales
→ supports neither currently
```

No debe utilizarse EquipmentAsset como sustituto automático de un futuro flujo
SERIALIZED.

---

# 30. QUANTITY + NONE

Este flujo es compatible con Generic Sales CURRENT.

Conceptualmente:

```text
QUANTITY
+
NONE
↓
Sale
↓
Inventory OUT
```

sin selección obligatoria de lote.

---

# 31. QUANTITY + OPTIONAL

También es compatible:

```text
QUANTITY
+
OPTIONAL
```

pero debe distinguirse:

```text
Sale allowed
✅
```

de:

```text
batch allocation / batch picking
❌ NOT IMPLEMENTED
```

Generic Sales actualmente no exige seleccionar un InventoryBatch para Products
OPTIONAL.

---

# 32. REQUIRED lot restriction

Debe mantenerse:

```text
QUANTITY
+
REQUIRED
→ BLOCK
```

porque el Generic Sales flow actual no posee todavía:

```text
required lot selection

batch allocation

lot-specific fulfillment
```

---

# 33. ASSET restriction

Debe mantenerse:

```text
inventoryTracking = ASSET
→ Generic Sales BLOCK
```

Generic Sales no implementa actualmente:

```text
EquipmentAsset selection

Equipment dispatch

asset-specific commercial fulfillment
```

---

# 34. SERIALIZED restriction

Debe mantenerse:

```text
inventoryTracking = SERIALIZED
→ Generic Sales BLOCK
```

porque todavía no existe:

```text
serialized picking

serial allocation

serialized fulfillment workflow
```

---

# 35. Eligibility enforcement points

Las reglas Generic Sales se aplican en:

```text
direct Sale create

Sale approval

Quote → Sale conversion
```

Esto evita que una incompatibilidad se salte mediante otro punto de entrada.

---

# 36. Frontend filtering ≠ backend authority

Debe mantenerse:

```text
frontend
→ filters incompatible Products
```

pero:

```text
backend
→ authoritative eligibility validation
```

Nunca debe confiarse únicamente en la UI.

---

# 37. Quantity

`SaleItem.quantity` utiliza actualmente:

```text
Int
```

Por tanto:

```text
quantity >= 1
```

dentro del flujo normal.

---

# 38. Fractional quantities — FUTURE

Una futura implementación de Units of Measure deberá revisar de forma transversal:

```text
Products

Sales

Quotes

Purchases

Inventory
```

No debe cambiarse solamente Sale.

---

# 39. SaleItem.price

`SaleItem.price` representa el precio comercial persistido dentro de la Sale.

Debe mantenerse:

```text
Product.price
→ reference at transaction time
```

```text
SaleItem.price
→ historical transaction value
```

---

# 40. Historical price

Debe mantenerse:

```text
Product.price changes later
≠
historical SaleItem.price changes
```

Una Sale histórica conserva su precio persistido.

---

# 41. Pricing — FUTURE

Una futura arquitectura puede incorporar:

```text
Price Lists

Customer-specific prices

Discounts

Promotions

Contracts

Currencies

Price approvals
```

No forman parte del motor actual de Sales V1.

---

# 42. Item subtotal

Conceptualmente:

```text
Item Subtotal
=
quantity × price
```

---

# 43. Sale subtotal

Conceptualmente:

```text
Sale Subtotal
=
Σ SaleItem subtotals
```

---

# 44. IVA

El flujo actual utiliza:

```text
IVA = 16%
```

según la implementación vigente.

No debe considerarse política fiscal universal permanente.

---

# 45. Total

Conceptualmente:

```text
total
=
subtotal
+
iva
```

según las reglas vigentes.

---

# 46. Backend como autoridad

Frontend puede mostrar una vista previa.

Backend debe continuar siendo autoridad sobre:

```text
eligible Product

quantity

price handling

subtotal

iva

total
```

según el contrato actual.

---

# 47. Monetary representation

El modelo Sale actual utiliza la representación monetaria histórica basada en:

```text
Float
```

Antes de ampliar:

```text
Billing

CFDI

Accounting

financial reporting
```

deberá revisarse transversalmente:

```text
precision

rounding

currency representation
```

---

# 48. Sale folio CURRENT

Las nuevas Sales utilizan folios como:

```text
V-000001

V-000002

V-000003
```

La generación es:

```text
server-generated

tenant-scoped

sequential

minimum six digits

no six-digit maximum

immutable
```

---

# 49. Folio no se reutiliza

Debe mantenerse:

```text
cancelled folio
→ remains occupied
```

```text
historical folio
→ remains occupied
```

No debe reciclarse un folio empresarial.

---

# 50. Legacy folios históricos

Folios históricos creados con estrategias anteriores:

```text
→ remain unchanged
```

La nueva estrategia no debe reescribir identidad histórica.

---

# 51. Folio implementation

La implementación utiliza:

```text
SalesFolioService
↓
CompanySequenceAllocatorService
```

con:

```text
key = SALE_FOLIO
```

---

# 52. Shared Sale sequence

Utilizan la misma secuencia:

```text
Direct Sale
```

y:

```text
Quote-converted Sale
```

Esto evita espacios de numeración separados para el mismo documento empresarial.

---

# 53. Quote relationship CURRENT

Una Sale puede originarse en una Quote.

Conceptualmente:

```text
Quote
↓
Sale
```

cuando:

```text
quoteId
```

está presente.

Quote continúa siendo el documento de propuesta.

Sale representa la operación comercial resultante CURRENT.

---

# 54. Quote conversion CURRENT

Actualmente:

```text
Quote CONFIRMED
↓
POST /sales/from-quote/:quoteId
↓
Sale CONFIRMED
↓
Inventory OUT
```

Este es comportamiento CURRENT del ERP Core V1.

---

# 55. Direct Sale vs Quote conversion

Debe mantenerse explícita la diferencia:

```text
Direct Sale
→ DRAFT
→ no Inventory OUT at creation
```

frente a:

```text
Quote conversion
→ Sale CONFIRMED
→ Inventory OUT immediately
```

Son dos entry points diferentes del modelo CURRENT.

---

# 56. Quote conversion eligibility

La conversión debe respetar:

```text
Quote exists

Quote belongs to Company

Quote is CONFIRMED

Quote not already converted

Customer valid

Products valid

Generic Sales eligibility
```

Las restricciones de Sales continúan siendo autoridad durante la conversión.

---

# 57. Duplicate conversion guard

Una misma Quote no debe crear dos Sales mediante el flujo normal.

Debe mantenerse:

```text
Quote already converted
→ second conversion rejected
```

Estado:

```text
duplicate conversion protection
✅
```

---

# 58. Conversion guard ≠ request idempotency

Debe distinguirse:

```text
single-conversion protection
✅
```

de:

```text
formal request-level idempotent replay
```

Un retry no necesariamente devuelve la misma respuesta previa de forma
determinista.

Por tanto:

```text
formal conversion replay idempotency
→ not guaranteed as general contract
```

---

# 59. Sale create request idempotency

Actualmente:

```text
POST /sales
→ no Idempotency-Key contract
```

Por tanto:

```text
Sale create request idempotency
→ TECHNICAL DEBT
```

Debe considerarse antes de escenarios de producción donde retries o double-submit
puedan producir operaciones duplicadas.

---

# 60. Quote conversion handoff

Después de convertir una Quote, el frontend recibe:

```text
Sale.id

Sale.folio
```

y permite:

```text
Ver venta
```

con navegación:

```text
/sales?saleId=<id>
```

Estado:

```text
same-session handoff
✅ IMPLEMENTED / VALIDATED
```

---

# 61. Historical Quote conversion identity

La deuda histórica pertenece principalmente al response model de Quotes.

Una Quote convertida en una sesión anterior conoce:

```text
convertedToSale = true
```

pero actualmente no puede reconstruir necesariamente:

```text
Sale.id

Sale.folio
```

desde `GET /quotes`.

Sales sí puede resolver una Sale cuando conoce su `id`.

---

# 62. Sale detail CURRENT

Existe:

```text
GET /sales/:id
```

La operación es tenant-scoped.

Conceptualmente:

```text
authenticated companyId
+
Sale id
↓
Sale detail
```

La respuesta incluye las relaciones requeridas por la experiencia actual, como:

```text
customer

items.product
```

---

# 63. Sale detail y tenant isolation

Debe mantenerse:

```text
Sale from another Company
→ not accessible
```

El conocimiento del UUID no concede acceso.

---

# 64. Sale deep-link CURRENT

Existe:

```text
/sales?saleId=<id>
```

Flujo:

```text
URL saleId
↓
GET /sales/:id
↓
Sale detail
```

Esto no depende de que la Sale esté contenida en:

```text
GET /sales
```

---

# 65. Deep-link y future pagination

Debido a que el detalle utiliza:

```text
GET /sales/:id
```

el deep-link es compatible conceptualmente con futura paginación del listado.

Sales no posee la misma deuda de detalle list-based existente actualmente en
Quotes y Purchases.

---

# 66. API CURRENT

Endpoints actuales:

```text
POST  /sales

GET   /sales

GET   /sales/:id

PATCH /sales/:id/approve

PATCH /sales/:id/cancel

GET   /sales/:id/pdf

POST  /sales/from-quote/:quoteId
```

Este documento no introduce endpoints inexistentes únicamente por estética de API.

---

# 67. API no CURRENT

No deben marcarse como implementados actualmente:

```text
PATCH /sales/:id
```

genérico,

ni:

```text
DELETE /sales/:id
```

ni endpoints de SalesOrder / Delivery.

---

# 68. Sale PDF CURRENT

Actualmente existe:

```text
GET /sales/:id/pdf
```

con:

```text
Content-Type: application/pdf
```

y descarga basada en:

```text
venta-{folio}.pdf
```

Estado:

```text
IMPLEMENTED / AUTOMATED
```

La validación manual final en navegador puede mantenerse como QA si todavía
corresponde.

---

# 69. Sale PDF semantics

El PDF representa la Sale actual.

Puede incluir información como:

```text
Company

Customer

folio

status

items

quantities

prices

subtotal

iva

total
```

No representa:

```text
Invoice

Purchase Receipt

Healthcare Dispatch
```

---

# 70. Frontend Sales V1

La experiencia `/sales` soporta actualmente:

```text
Sales list

search

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

current price display

quantity

item add/remove

duplicate prevention

subtotal

IVA

total preview

Sale detail modal

approve

cancel

PDF

deep-link

terminal-state action visibility
```

---

# 71. Search CURRENT

El frontend permite buscar Sales mediante información reconocible como:

```text
folio

Customer
```

según la implementación actual.

---

# 72. Status filter CURRENT

El frontend permite filtrar por:

```text
DRAFT

CONFIRMED

CANCELLED
```

con etiquetas:

```text
DRAFT
→ Borrador

CONFIRMED
→ Confirmada

CANCELLED
→ Cancelada
```

---

# 73. Pagination / filtering debt

Actualmente:

```text
GET /sales
→ no server pagination
```

y:

```text
server-side search/filtering
→ not implemented
```

Por tanto:

```text
Sales list scalability
→ TECHNICAL DEBT
```

---

# 74. Inventory availability

Sales puede consultar o mostrar Inventory disponible para ayudar al usuario.

Ejemplo:

```text
Requested: 10

Current stock: 6
```

La validación definitiva debe seguir realizándose backend-side cuando se confirma
la salida.

---

# 75. Stock negativo

Debe mantenerse:

```text
requested OUT
<=
available inventory
```

dentro del flujo Generic Sales normal.

Una Sale no debe producir stock negativo mediante el comportamiento estándar.

---

# 76. Optional-lot limitation

Aunque:

```text
QUANTITY + OPTIONAL
```

pueda venderse actualmente, Generic Sales no implementa:

```text
specific InventoryBatch selection

FEFO allocation

lot-level Sale fulfillment
```

Esto constituye una limitación conocida.

---

# 77. Required-lot future flow

Para soportar:

```text
lotTracking = REQUIRED
```

deberá existir un workflow físico explícito capaz de seleccionar y validar:

```text
InventoryBatch

available quantity

lot identity
```

Generic Sales actual no lo hace.

---

# 78. ASSET commercial fulfillment — FUTURE

Para soportar Products ASSET en una venta comercial futura se necesitará una
operación explícita sobre:

```text
EquipmentAsset
```

que preserve:

```text
asset identity

lifecycle

commercial disposition

Inventory consistency
```

No debe resolverse simplemente decrementando una cantidad genérica.

---

# 79. SERIALIZED commercial fulfillment — FUTURE

Un futuro flujo SERIALIZED deberá identificar las unidades concretas o seriales
que salen.

No debe asumirse que su implementación será idéntica a ASSET.

---

# 80. Confirmed Sale reversal

Actualmente:

```text
Sale CONFIRMED
→ Inventory OUT already occurred
```

y no existe:

```text
confirmed Sale reversal
```

como workflow normal.

Estado:

```text
confirmed Sale reversal
→ NOT IMPLEMENTED
```

---

# 81. No silent confirmed cancellation

Debe evitarse:

```text
Sale CONFIRMED
↓
status = CANCELLED
```

sin una operación explícita que resuelva también:

```text
Inventory history

commercial history
```

---

# 82. Commercial Returns — DEFERRED

Una devolución comercial es conceptualmente diferente de cancelar una Sale.

Debe mantenerse:

```text
Confirmed commercial fulfillment
↓
Commercial Return
```

sin reescribir la Sale original.

Actualmente:

```text
Generic Commercial Returns
→ P1 / DEFERRED
```

No es un bloqueo P0 del ERP Core V1 actual.

---

# 83. Commercial Return ≠ Healthcare Return

Debe mantenerse:

```text
Commercial Return
≠
Healthcare custody Return
```

Commercial Return trata mercancía vendida/entregada.

Healthcare Return trata material o Equipment que regresa de una operación de
custodia temporal.

Son dominios diferentes.

---

# 84. Returns y arquitectura futura

Cuando se implemente la arquitectura TARGET:

```text
SalesOrder
↓
Delivery
```

la devolución comercial deberá referenciar preferentemente el fulfillment físico
real:

```text
Delivery
↓
Return
```

y no una cantidad meramente ordenada.

---

# 85. No construir nueva trazabilidad permanente sobre SaleItem

No debe introducirse apresuradamente un modelo como:

```text
SaleItemBatchAllocation
```

como arquitectura definitiva si el fulfillment futuro será propiedad de:

```text
DeliveryItem
```

Cualquier diseño deberá coordinarse con SalesOrder / Delivery.

---

# 86. Billing boundary

Debe mantenerse:

```text
Sale
≠
Invoice
```

y, en el futuro:

```text
SalesOrder
≠
Delivery
≠
Invoice
```

Invoice pertenece al dominio Billing.

---

# 87. Invoice no mueve Inventory por sí misma

La futura emisión de Invoice no debe convertirse automáticamente en:

```text
Inventory OUT
```

La consecuencia física debe permanecer ligada al evento de fulfillment
correspondiente.

---

# 88. Payments — FUTURE

Sales V1 no implementa:

```text
Payment

Accounts Receivable

payment reconciliation
```

Estos conceptos pertenecen a dominios financieros futuros.

---

# 89. Healthcare boundary

Sales pertenece a ERP Core.

Healthcare no debe utilizar automáticamente:

```text
CaseDispatch
```

como equivalente de:

```text
Sale
```

o:

```text
Delivery
```

---

# 90. CaseDispatch ≠ Commercial Fulfillment

En la arquitectura Healthcare TARGET:

```text
CaseDispatch
→ temporary custody / operational dispatch
```

mientras:

```text
Commercial fulfillment
→ definitive commercial disposition
```

Debe mantenerse:

```text
CaseDispatch
≠
Sale
```

y:

```text
CaseDispatch
≠
Delivery
```

---

# 91. Healthcare double-decrement invariant

Cuando se diseñe Healthcare Dispatch/Reconciliation, deberá evitarse:

```text
custody movement
+
commercial fulfillment
→ double decrement
```

La integración exacta pertenece a Healthcare e Inventory.

---

# 92. Healthcare status

Actualmente el Healthcare Case Foundation existe, pero no deben documentarse como
CURRENT dentro de Sales:

```text
CaseDispatch

Reconciliation

Healthcare Return

Equipment Assignment
```

mientras esos workflows no estén implementados.

---

# 93. Authorization

Sales utiliza la arquitectura transversal de:

```text
Authentication

Authorization

Tenant Isolation

Validation

Business Rules
```

Los endpoints críticos deberán seguir incluidos en la revisión de autorización
antes de producción.

---

# 94. Multi-tenancy

Debe mantenerse:

```text
Sale.companyId
```

alineado con:

```text
Customer.companyId

Product company
```

según las relaciones utilizadas.

---

# 95. Cross-tenant Customer

Debe rechazarse:

```text
Company A Sale
↓
Customer Company B
```

aunque el UUID exista.

---

# 96. Cross-tenant Product

Debe rechazarse:

```text
Company A Sale
↓
Product Company B
```

---

# 97. Permission granularity — TARGET

Una futura arquitectura RBAC puede incluir permisos conceptuales como:

```text
sales.read

sales.create

sales.approve

sales.cancel

sales.price.override
```

y, con Delivery:

```text
deliveries.read

deliveries.create

deliveries.confirm
```

No deben considerarse completamente implementados solo por estar documentados.

---

# 98. Audit — TARGET

Una futura plataforma transversal de Audit puede registrar:

```text
Sale created

Sale approved

Sale cancelled

Quote converted to Sale
```

y posteriormente:

```text
SalesOrder created

Delivery confirmed

Commercial Return created
```

Actualmente no existe un Audit transversal completo.

---

# 99. TARGET commercial architecture

ADR-011 define como dirección futura:

```text
Quote
   ↓ optional
SalesOrder
   ↓
Delivery
   ↓
Inventory OUT
```

Esta arquitectura separará:

```text
commercial commitment
```

de:

```text
physical fulfillment
```

---

# 100. SalesOrder TARGET

SalesOrder representará:

```text
commercial commitment
```

Debe mantenerse como principio:

```text
SalesOrder confirmation
→ no Inventory OUT
```

SalesOrder no existe todavía como reemplazo operativo de Sale.

---

# 101. Delivery TARGET

Delivery representará:

```text
physical fulfillment
```

Debe mantenerse como principio futuro:

```text
Delivery confirmed
→ Inventory OUT
```

---

# 102. Partial Delivery TARGET

La arquitectura futura deberá poder soportar:

```text
Ordered
>
Delivered
```

con:

```text
Pending Quantity
=
Ordered
-
Delivered
```

sin obligar a entregar toda la SalesOrder en un solo evento.

---

# 103. Delivery quantity invariant TARGET

Debe mantenerse:

```text
Delivered Quantity
<=
Ordered Quantity
```

dentro del flujo normal.

Backend deberá recalcular la cantidad pendiente.

---

# 104. Delivery atomicity TARGET

La confirmación física futura deberá ser transaccional.

Conceptualmente:

```text
Delivery

+

DeliveryItems

+

physical allocation

+

Inventory OUT

+

SalesOrder fulfillment update
```

debe completarse o revertirse como una unidad.

---

# 105. Delivery duplicate protection TARGET

Una futura confirmación Delivery deberá impedir que retries produzcan:

```text
Inventory OUT
+
same Inventory OUT again
```

La estrategia técnica de idempotencia se diseñará durante esa implementación.

---

# 106. Batch allocation TARGET

Cuando corresponda, Delivery podrá resolver:

```text
DeliveryItem
↓
InventoryBatch allocation
```

permitiendo:

```text
required-lot fulfillment

partial batch allocation

future FEFO support
```

---

# 107. Serial / ASSET fulfillment TARGET

La futura capa física deberá soportar mecanismos distintos según:

```text
QUANTITY

SERIALIZED

ASSET
```

sin asumir que todos se resuelven mediante cantidades agregadas.

---

# 108. Reservation — FUTURE

SalesOrder podrá evaluar posteriormente:

```text
Reservation
```

pero debe mantenerse:

```text
Reservation
≠
Inventory OUT
```

y:

```text
Reservation
≠
Batch Allocation
```

como conceptos separados.

---

# 109. Shipment — FUTURE

Una futura logística de envío puede incorporar:

```text
Carrier

Tracking Number

Ship Date

Delivery Date
```

sin alterar la frontera:

```text
SalesOrder
→ commitment

Delivery
→ fulfillment
```

---

# 110. Proof of Delivery — FUTURE

Una futura Delivery puede requerir:

```text
recipient

signature

photo

timestamp

location
```

No forma parte del ERP Core V1 actual.

---

# 111. SalesOrder / Delivery migration

La futura migración desde `Sale` deberá preservar:

```text
historical folios

historical commercial values

InventoryMovement history

Quote relationships

tenant ownership
```

No debe reconstruir movimientos físicos ya existentes.

---

# 112. Confirmed Sale migration principle

Conceptualmente una Sale CONFIRMED histórica podría corresponder en el futuro a:

```text
SalesOrder
+
confirmed Delivery
```

porque el modelo CURRENT concentra ambos hechos.

Esto es una hipótesis de migración, no una instrucción inmediata.

---

# 113. DRAFT Sale migration principle

Conceptualmente:

```text
Sale DRAFT
→ SalesOrder DRAFT
```

podría ser una equivalencia futura.

Debe validarse contra datos y workflows reales antes de migrar.

---

# 114. CANCELLED Sale migration principle

Una Sale CANCELLED histórica podría mapearse a una SalesOrder cancelada sin
fulfillment cuando corresponda.

No debe asumirse universalmente sin revisar su historia real.

---

# 115. No Prisma refactor now

Este documento no autoriza actualmente:

```text
rename Sale → SalesOrder
```

ni:

```text
create Delivery as immediate implementation
```

ni:

```text
remove Sale
```

ni:

```text
change DocumentStatus
```

La evolución deberá ser un refactor deliberado posterior.

---

# 116. IMPLEMENTED — Sales

Actualmente:

```text
Sale persistence

SaleItem persistence

direct Sale create

DRAFT

CONFIRMED

CANCELLED

DRAFT approval

DRAFT cancellation

Customer active validation

Product active validation

Generic Sales eligibility

Inventory OUT on approval

InventoryMovement Sale reference

server-generated Sale folio

Quote → Sale conversion

GET /sales/:id

deep-link

Sale PDF

Sales frontend
```

---

# 117. VALIDATED

La validación registrada cubre según los hitos correspondientes:

```text
ASSET Product rejection

compatible QUANTITY Product creation

DRAFT creation without stock mutation

sequential folio allocation

folio non-reuse

DRAFT → CONFIRMED

stock decrement

InventoryMovement OUT

Sale reference traceability

DRAFT cancellation without stock mutation

DRAFT cancellation without InventoryMovement

Quote conversion

Sale detail

Sales deep-link

PDF automated flow

frontend lifecycle
```

Los casos concretos y IDs de QA pertenecen a:

```text
PROJECT_BOARD.md

CHANGELOG.md

QA evidence
```

y no a esta especificación permanente.

---

# 118. TECHNICAL DEBT — CURRENT

Permanece pendiente:

```text
Sale create request idempotency
```

```text
server-side Sales pagination
```

```text
server-side Sales search/filtering
```

```text
generic Sale editing if product requirements eventually need it
```

```text
confirmed Sale reversal
```

```text
OPTIONAL-lot batch allocation
```

```text
REQUIRED-lot fulfillment
```

```text
SERIALIZED fulfillment
```

```text
ASSET commercial fulfillment
```

```text
Audit integration
```

---

# 119. Deferred commercial capabilities

Actualmente se consideran diferidas:

```text
Commercial Returns
```

```text
Billing / Invoice
```

```text
Payments
```

```text
Accounts Receivable
```

Commercial Returns es una capacidad estratégica posterior, no un P0 blocker del
ERP Core V1 actual.

---

# 120. TARGET

La evolución comercial aprobada incluye:

```text
SalesOrder

SalesOrderItem

Delivery

DeliveryItem

partial deliveries

pending quantities

Delivery-based Inventory OUT

lot / batch allocation

serial / ASSET fulfillment strategy

explicit Quote relationship

SalesOrder 360

delivery history
```

Estas capacidades no están implementadas todavía.

---

# 121. FUTURE

Capacidades posteriores pueden incluir:

```text
Reservations

Shipments

Backorders

Proof of Delivery

Multiple Delivery Addresses

Price Lists

Discount approvals

Payment Terms

Billing / CFDI

Accounts Receivable

Sales commissions

Sales representative ownership

Customer Portal

Mobile fulfillment

Advanced analytics

AI recommendations
```

No forman parte automáticamente del siguiente sprint.

---

# 122. Invariantes CURRENT

## Tenant

```text
Sale
→ belongs to one Company
```

---

## Customer

```text
New Sale
→ active same-tenant Customer required
```

---

## Product

```text
New Sale
→ active same-tenant Product required
```

---

## Generic eligibility

```text
QUANTITY + NONE
→ allowed
```

```text
QUANTITY + OPTIONAL
→ allowed
```

```text
QUANTITY + REQUIRED
→ blocked
```

```text
SERIALIZED
→ blocked
```

```text
ASSET
→ blocked
```

---

## Direct create

```text
POST /sales
→ DRAFT
→ no Inventory OUT
```

---

## Approval

```text
DRAFT
↓
approve
↓
CONFIRMED
↓
Inventory OUT
```

---

## Cancellation

```text
DRAFT
↓
cancel
↓
CANCELLED
↓
no Inventory mutation
```

---

## Confirmed Sale

```text
CONFIRMED
→ no normal cancellation
```

---

## Quote conversion

```text
Quote CONFIRMED
↓
Sale CONFIRMED
↓
Inventory OUT
```

---

## Duplicate conversion

```text
already-converted Quote
→ cannot create another normal Sale
```

---

## Folio

```text
Sale folio
→ tenant-scoped
→ sequential
→ immutable
→ never reused
```

---

## Historical price

```text
Product.price changes
≠
historical SaleItem.price changes
```

---

# 123. Invariantes TARGET

## Commercial commitment

```text
SalesOrder CONFIRMED
→ no Inventory OUT
```

---

## Physical fulfillment

```text
Delivery CONFIRMED
→ Inventory OUT
```

---

## Fulfillment quantity

```text
Delivered
<=
Ordered
```

---

## Atomicity

```text
Delivery physical effects
→ atomic
```

---

## Returns

```text
Commercial Return
→ references physical fulfillment
```

---

## Healthcare

```text
CaseDispatch
≠
Delivery
```

---

# 124. Anti-patrones

## Inventory on direct Sale creation

Incorrecto:

```text
POST /sales
→ stock decrement
```

La Sale directa inicia DRAFT.

---

## Confirmed Sale without Inventory OUT

Incorrecto en el modelo CURRENT:

```text
Sale CONFIRMED
+
no Inventory consequence
```

si se trata de una confirmación válida del Generic Sales flow.

---

## Confirmed Sale cancellation without compensation

Incorrecto:

```text
CONFIRMED
→ CANCELLED
```

sin resolver el efecto físico previo.

---

## Frontend-only Product eligibility

Incorrecto depender únicamente del ProductSelector.

Backend debe validar.

---

## REQUIRED lot without allocation

Incorrecto:

```text
REQUIRED lot Product
→ Generic Sale OUT
```

sin seleccionar existencia física válida.

---

## ASSET as generic quantity

Incorrecto:

```text
ASSET
→ stock -= quantity
```

sin identificar el EquipmentAsset correspondiente.

---

## SERIALIZED = ASSET

Incorrecto asumir que ambos modelos son equivalentes.

---

## Duplicate Quote conversion

Incorrecto:

```text
Quote
→ Sale A

same Quote
→ Sale B
```

---

## Reusing folios

Incorrecto reutilizar folios de Sales canceladas o históricas.

---

## Invoice changes stock

Incorrecto:

```text
Invoice
→ Inventory OUT
```

como regla general.

---

## Healthcare Dispatch = Sale

Incorrecto:

```text
CaseDispatch
→ Sale
```

automáticamente.

---

## Commercial Return = Healthcare Return

Incorrecto mezclar ambos conceptos.

---

## Target documented as Current

Incorrecto presentar:

```text
SalesOrder
Delivery
```

como si ya hubieran sustituido a Sale.

---

# 125. Relación con Customers

CURRENT:

```text
Customer
↓
Sale
```

Customer administra la identidad maestra.

Sales administra la transacción comercial.

---

# 126. Relación con Quotes

CURRENT:

```text
Quote CONFIRMED
↓
Sale CONFIRMED
```

cuando se ejecuta la conversión.

`QUOTES.md` administra:

```text
proposal lifecycle

conversion entry point
```

Sales administra:

```text
resulting Sale

physical Inventory OUT
```

---

# 127. Relación con Products

CURRENT:

```text
Product
↓
SaleItem
```

Products administra:

```text
catalog identity

inventoryTracking

lotTracking
```

Sales aplica las restricciones compatibles con Generic Sales.

---

# 128. Relación con Inventory

CURRENT:

```text
Sale CONFIRMED
↓
Inventory OUT
```

Inventory administra:

```text
Product.stock consequence

InventoryMovement

movement traceability
```

Sales no redefine esas reglas internamente.

---

# 129. Relación con Equipment

Actualmente Generic Sales no soporta Products ASSET.

Una futura integración comercial deberá operar sobre:

```text
EquipmentAsset
```

sin contaminar el Core Equipment con lógica de Case o Sales innecesaria.

---

# 130. Relación con Returns

Commercial Returns permanece:

```text
P1 / DEFERRED
```

La arquitectura futura deberá coordinarse con:

```text
SalesOrder

Delivery

Inventory
```

y no reescribir la Sale o Delivery original.

---

# 131. Relación con Healthcare

Healthcare podrá originar o relacionarse con operaciones comerciales en el futuro.

Debe mantenerse:

```text
Sales
→ ERP Core commercial behavior
```

```text
Healthcare
→ operational Case / custody behavior
```

sin fusionarlos.

---

# 132. Relación con Billing

Billing podrá utilizar contexto de:

```text
Sale

future SalesOrder

future Delivery
```

pero administra:

```text
Invoice

Payment

financial responsibility
```

como dominios separados.

---

# 133. ADR relacionados

```text
ADR-001 — Multi-Tenant

ADR-002 — Inventory Movements

ADR-004 — UUID

ADR-005 — Layered Architecture

ADR-006 — API First

ADR-007 — RBAC

ADR-009 — Modular Monolith

ADR-010 — Quote → Sale — superseded as long-term architecture

ADR-011 — SalesOrder + Delivery

ADR-012 — Entity Lifecycle

ADR-013 — Inventory Custody & Case Logistics
```

ADR-010 puede estar superado como arquitectura futura, pero:

```text
Quote → Sale
```

continúa siendo CURRENT hasta que exista una migración real.

---

# 134. Documentación relacionada

```text
docs/modules/erp/CUSTOMERS.md

docs/modules/erp/PRODUCTS.md

docs/modules/erp/QUOTES.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/architecture/ARCHITECTURE.md

docs/engineering/API_GUIDELINES.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/product/PRODUCT_REQUIREMENTS.md

docs/product/ZAPING_WAY.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

`RETURNS.md` puede permanecer como documentación estratégica/deferred, pero no debe
interpretarse como el siguiente módulo obligatorio del ERP Core V1.

---

# 135. Fuente de verdad

```text
SALES.md
→ CURRENT Sale behavior
→ Sale lifecycle
→ Generic Sales eligibility
→ CURRENT Inventory OUT trigger
→ TARGET SalesOrder / Delivery direction
```

```text
QUOTES.md
→ Quote lifecycle
→ Quote → Sale conversion entry point
```

```text
CUSTOMERS.md
→ Customer master-data lifecycle
→ active Customer rules
```

```text
PRODUCTS.md
→ Product tracking configuration
→ Product master lifecycle
```

```text
INVENTORY.md
→ stock
→ InventoryMovement
→ physical Inventory semantics
```

```text
EQUIPMENT.md
→ EquipmentAsset identity
```

```text
ADR-011
→ TARGET SalesOrder / Delivery architecture
```

```text
ADR-013
→ Healthcare custody vs physical/commercial disposition
```

```text
schema.prisma
→ CURRENT persistence
```

```text
Sales backend
→ CURRENT API/business implementation
```

```text
Sales frontend
→ CURRENT user experience
```

```text
tests
→ validated behavior
```

```text
PROJECT_BOARD.md
→ current project status and technical debt
```

```text
CHANGELOG.md
→ historical implementation evolution
```

---

# 136. Estado consolidado

CURRENT:

```text
Sale persistence
✅

SaleItem
✅

direct Sale creation
✅

DRAFT
✅

CONFIRMED
✅

CANCELLED
✅

DRAFT → CONFIRMED
✅

DRAFT → CANCELLED
✅

DRAFT create without stock mutation
✅

CONFIRMED → Inventory OUT
✅

Customer active validation
✅

Product active validation
✅

QUANTITY + NONE
✅

QUANTITY + OPTIONAL
✅

QUANTITY + REQUIRED
❌ blocked

SERIALIZED
❌ blocked

ASSET
❌ blocked

CompanySequence SALE_FOLIO
✅

Quote → Sale conversion
✅

GET /sales/:id
✅

/sales?saleId=<id>
✅

Sale PDF
✅
```

CURRENT debt:

```text
Sale create request idempotency
⏳

server-side pagination
⏳

server-side search/filtering
⏳

generic DRAFT editing if required
⏳

confirmed Sale reversal
⏳

OPTIONAL-lot batch allocation
⏳

REQUIRED-lot fulfillment
⏳

SERIALIZED fulfillment
⏳

ASSET commercial fulfillment
⏳

Audit integration
⏳
```

Deferred:

```text
Commercial Returns
⏳ P1

Billing / Invoice
⏳

Payments / Accounts Receivable
⏳
```

TARGET:

```text
SalesOrder
↓
commercial commitment
↓
no Inventory OUT

Delivery
↓
physical fulfillment
↓
Inventory OUT
```

---

# 137. Secuencia de proyecto

Sales V1 forma parte del ERP Core actual.

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

Por tanto:

```text
SalesOrder / Delivery refactor
```

y:

```text
Generic Commercial Returns
```

no deben introducirse automáticamente antes de cerrar los gates actuales.

---

# 138. Regla de transición

Mientras `Sale` continúe siendo el modelo operativo:

```text
Sale
→ CURRENT
```

debe documentarse como comportamiento real.

Cuando se hable de:

```text
SalesOrder

Delivery
```

debe marcarse:

```text
TARGET
```

hasta que el refactor sea implementado, migrado y validado.

La futura transición deberá preservar:

```text
historical Sales

historical folios

Quote relationships

InventoryMovement history

tenant integrity
```

sin duplicar movimientos físicos.

---

# 139. Principio final

El modelo CURRENT es:

```text
Direct Sale

Customer
↓
Sale DRAFT
↓
Approve
↓
Sale CONFIRMED
↓
Inventory OUT
```

También:

```text
Quote CONFIRMED
↓
Convert
↓
Sale CONFIRMED
↓
Inventory OUT
```

La arquitectura TARGET será:

```text
SalesOrder
↓
Commercial Commitment

Delivery
↓
Physical Fulfillment

InventoryMovement OUT
↓
Physical Consequence
```

Debe mantenerse una distinción clara entre:

```text
CURRENT implementation
```

y:

```text
TARGET architecture
```

sin fingir que SalesOrder / Delivery ya sustituyeron a Sale.

> **En el ERP Core actual, una Sale confirmada representa tanto la confirmación
> comercial como la salida física de inventario. La arquitectura futura separará
> esos hechos mediante SalesOrder y Delivery, pero esa transición debe realizarse
> de forma deliberada sin alterar la historia ni duplicar movimientos.**
