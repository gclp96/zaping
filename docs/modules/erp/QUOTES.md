# Quotes — Zaping ERP

**Módulo:** Quotes
**Producto:** Zaping ERP Core
**Versión:** 2.2.0
**Estado:** Aprobado
**Estado de implementación:** QUOTES V1 IMPLEMENTED / VALIDATED
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Quotes administra las propuestas comerciales que una Company presenta a sus
Customers.

Su responsabilidad principal es responder:

```text
¿Qué estamos ofreciendo?

¿A qué Customer?

¿Qué Products?

¿Qué cantidades?

¿A qué precios?

¿Cuál es el total?

¿En qué estado está la propuesta?

¿Fue convertida posteriormente en una Sale?
```

Quote representa:

```text
commercial proposal
+
commercial snapshot
+
proposal lifecycle
```

No representa por sí misma:

```text
physical delivery

Invoice

Payment

Inventory movement
```

---

# 2. Ownership

Quotes es propietario de:

```text
Quote

QuoteItem

Quote folio

Customer relationship

offered Products

quoted quantities

quoted prices

subtotal

iva

total

Quote lifecycle

current conversion state
```

Quotes no es propietario de:

```text
Inventory stock

InventoryMovement

InventoryBatch

Equipment lifecycle

Sale lifecycle

future SalesOrder lifecycle

future Delivery

Billing

Accounts Receivable

Healthcare Case Logistics
```

---

# 3. Principio fundamental

Debe mantenerse:

```text
Quote
=
commercial proposal
```

Por tanto:

```text
Create Quote
→ no Inventory mutation
```

```text
Approve Quote
→ no Inventory mutation
```

```text
Cancel Quote
→ no Inventory mutation
```

Una Quote puede participar posteriormente en una operación que sí afecte
Inventory, pero ese efecto pertenece al dominio comercial resultante.

---

# 4. CURRENT vs TARGET vs FUTURE

Este documento distingue:

## CURRENT

Comportamiento implementado actualmente en ERP Core V1.

## TARGET

Arquitectura comercial aprobada para una evolución posterior.

## FUTURE

Capacidades adicionales cuya necesidad deberá validarse antes de implementarse.

---

# 5. Estado CURRENT

Quotes V1 soporta actualmente:

```text
Quote creation

Quote list

DRAFT

CONFIRMED

CANCELLED

approval

cancellation

Quote PDF

client-side search

status filter

Quote detail from loaded list

Customer active validation

Product active validation

Quote → Sale conversion

conversion state tracking

Sale handoff after conversion
```

---

# 6. Lifecycle CURRENT

Quote utiliza actualmente:

```text
DocumentStatus

DRAFT
CONFIRMED
CANCELLED
```

La existencia de estos tres estados no implica que todas las transiciones entre
ellos estén permitidas arbitrariamente.

Las operaciones deben respetar siempre las reglas del backend vigente.

---

# 7. DRAFT

Una nueva Quote comienza como:

```text
DRAFT
```

Representa una propuesta todavía no confirmada.

Debe distinguirse entre:

```text
DRAFT state
```

y:

```text
generic Quote editing workflow
```

Actualmente no existe un endpoint genérico:

```text
PATCH /quotes/:id
```

como parte de la API CURRENT documentada.

Por tanto, no debe afirmarse que la edición completa de Quotes DRAFT ya forma
parte del contrato vigente.

---

# 8. Quote editing

Una futura evolución puede permitir editar una Quote DRAFT para modificar:

```text
Customer

Products

quantities

prices
```

antes de confirmarla.

Actualmente:

```text
generic Quote editing
→ NOT PART OF CURRENT API
```

No debe confundirse con:

```text
approve

cancel
```

que sí poseen endpoints específicos.

---

# 9. CONFIRMED

La aprobación produce:

```text
DRAFT
↓
CONFIRMED
```

mediante:

```text
PATCH /quotes/:id/approve
```

Una Quote CONFIRMED representa una propuesta que dejó la etapa inicial de
borrador.

---

# 10. CONFIRMED no significa fulfillment

Debe mantenerse:

```text
Quote CONFIRMED
≠
goods delivered
```

```text
Quote CONFIRMED
≠
Inventory OUT
```

```text
Quote CONFIRMED
≠
Invoice issued
```

```text
Quote CONFIRMED
≠
Customer acceptance event
```

si esa aceptación no está modelada explícitamente.

---

# 11. Quote approval no modifica Inventory

La aprobación normal debe mantener:

```text
Quote DRAFT
↓
Approve
↓
Quote CONFIRMED
```

sin:

```text
Product.stock decrement
```

sin:

```text
InventoryMovement OUT
```

y sin:

```text
Equipment mutation
```

---

# 12. CANCELLED

Quote utiliza actualmente:

```text
CANCELLED
```

como estado terminal para propuestas que dejan de continuar mediante el flujo
normal.

La API CURRENT expone:

```text
PATCH /quotes/:id/cancel
```

Las transiciones exactas admitidas desde otros estados deben corresponder al
backend vigente.

Este documento no amplía artificialmente esas transiciones.

---

# 13. CANCELLED no significa deleted

Debe mantenerse:

```text
CANCELLED
≠
DELETED
```

Una Quote cancelada conserva:

```text
folio

Customer

items

prices

totals

status

timestamps
```

como documento histórico.

---

# 14. Quote como documento transaccional

Quote no es Master Data.

Por tanto, su identidad histórica se conserva mediante:

```text
document lifecycle
+
persisted items
+
persisted commercial values
```

y no mediante un simple active/inactive lifecycle.

---

# 15. Modelo Quote actual

Conceptualmente:

```text
Quote

id
companyId
customerId

folio

subtotal
iva
total

status

convertedToSale

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

# 16. QuoteItem

Cada Quote contiene una o más partidas.

Conceptualmente:

```text
Quote
└── QuoteItem
    ├── productId
    ├── quantity
    ├── price
    └── subtotal
```

La estructura técnica exacta pertenece al schema vigente.

---

# 17. Folio

Quote utiliza un folio empresarial separado de su UUID técnico.

Debe mantenerse:

```text
id
→ technical identity
```

```text
folio
→ business-facing identity
```

El formato exacto pertenece a la implementación vigente.

---

# 18. Folio en UX

El folio puede utilizarse para:

```text
search

PDF

business communication

support

cross-module references
```

El usuario no necesita trabajar normalmente con el UUID.

---

# 19. Customer relationship

Toda Quote pertenece a un Customer.

```text
Customer
↓
Quote
```

Customer identifica la contraparte comercial de la propuesta.

---

# 20. Customer validation — CURRENT

Al crear una nueva Quote, backend valida:

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

# 21. Inactive Customer

Debe mantenerse:

```text
Inactive Customer
↓
New Quote
→ BLOCK
```

pero:

```text
Customer later becomes inactive
↓
Historical Quote
→ remains valid
```

La desactivación no reescribe documentos históricos.

---

# 22. CustomerSelector

La UI puede utilizar:

```text
CustomerSelector
```

para seleccionar la contraparte comercial.

Debe mantenerse:

```text
CustomerSelector
→ UX convenience
```

mientras:

```text
backend
→ authoritative Customer validation
```

---

# 23. CustomerSelector y Customers activos

Para nuevas Quotes:

```text
Inactive Customer
→ excluded from normal selection
```

Esto complementa, pero no sustituye, la validación backend.

---

# 24. Contextual Customer creation — TARGET UX

Una futura experiencia puede permitir:

```text
New Quote
↓
Customer not found
↓
Create Customer
↓
Select Customer
↓
Continue Quote
```

sin perder el estado del formulario.

Actualmente no debe considerarse requisito de Quotes V1 sin implementación
verificada.

---

# 25. Product relationship

Cada `QuoteItem` referencia un Product.

Debe mantenerse:

```text
Product
↓
QuoteItem
```

Product identifica lo ofrecido.

QuoteItem conserva las condiciones comerciales de esa propuesta.

---

# 26. Product validation — CURRENT

Al crear una Quote, backend debe validar:

```text
Product exists

+

Product belongs to authenticated Company

+

Product.isActive = true
```

Estado:

```text
same-tenant Product validation
✅
```

```text
active Product validation
✅
```

---

# 27. Inactive Product

Debe mantenerse:

```text
Inactive Product
↓
New Quote
→ BLOCK
```

mientras:

```text
Product becomes inactive later
↓
Historical Quote
→ remains valid
```

---

# 28. ProductSelector

La UI puede utilizar un ProductSelector o experiencia equivalente para localizar
Products mediante información como:

```text
SKU

name

brand

barcode
```

según las capacidades frontend vigentes.

El backend continúa siendo autoridad sobre existencia, tenant y actividad.

---

# 29. Product tracking

Quote representa una propuesta comercial y no ejecuta por sí misma la semántica
física de:

```text
inventoryTracking

lotTracking
```

Debe mantenerse:

```text
Quote
→ proposed Product
```

frente a:

```text
Sale / future fulfillment workflow
→ physical eligibility rules
```

---

# 30. Quote eligibility ≠ Generic Sale eligibility

Un Product válido para ser identificado dentro del catálogo comercial no implica
automáticamente que el Generic Sales flow actual pueda realizar su salida física.

Generic Sales CURRENT está limitado a Products compatibles con:

```text
inventoryTracking = QUANTITY
```

y:

```text
lotTracking != REQUIRED
```

Por tanto, la conversión Quote → Sale debe respetar las reglas vigentes de
`SALES.md`.

---

# 31. Products no compatibles con Generic Sales

El flujo Generic Sales CURRENT no debe utilizarse para cumplir directamente
Products con semánticas como:

```text
ASSET

SERIALIZED

REQUIRED lot fulfillment
```

mientras sus workflows correspondientes no estén implementados en Generic Sales.

La existencia de una Quote no elimina esa restricción.

---

# 32. Duplicate QuoteItems

Una Quote no debería contener el mismo Product repetido innecesariamente bajo las
mismas condiciones comerciales.

Preferir:

```text
Product A × 10
```

sobre:

```text
Product A × 4

Product A × 6
```

si representan exactamente la misma partida.

---

# 33. Quantity

Actualmente:

```text
quantity
→ Int
```

y conceptualmente debe mantenerse:

```text
quantity >= 1
```

---

# 34. Fractional quantities — FUTURE

Si Zaping soporta posteriormente cantidades fraccionarias, deberá revisarse de
manera transversal:

```text
Products

Quotes

Purchases

Sales

Inventory
```

No debe modificarse únicamente Quotes.

---

# 35. QuoteItem.price

`QuoteItem.price` representa el precio ofrecido dentro de la Quote.

Debe considerarse un valor comercial persistido del documento.

---

# 36. Product.price vs QuoteItem.price

Durante creación puede utilizarse:

```text
Product.price
```

como referencia.

Una vez persistida la Quote:

```text
QuoteItem.price
```

representa el valor específico de esa propuesta.

---

# 37. Historical price

Debe mantenerse:

```text
Product.price changes later
≠
historical QuoteItem.price changes
```

Ejemplo:

```text
QuoteItem.price = 100

later Product.price = 120
```

La Quote histórica conserva:

```text
100
```

---

# 38. Price override

Si el workflow permite capturar un precio diferente al valor base del Product,
esa capacidad debe respetar las reglas actuales de autorización.

Una futura política podrá introducir permisos como:

```text
quotes.price.override
```

pero Permission-Based RBAC granular no debe darse por implementado únicamente
desde este documento.

---

# 39. Pricing — FUTURE

Una futura arquitectura puede incorporar:

```text
Price Lists

Customer-specific pricing

Discounts

Promotions

Contracts

Currencies

Validity
```

No forman parte del pricing avanzado CURRENT.

---

# 40. Item subtotal

Conceptualmente:

```text
Item Subtotal
=
quantity × price
```

Backend debe permanecer como autoridad sobre los valores persistidos.

---

# 41. Quote subtotal

Conceptualmente:

```text
Quote Subtotal
=
Σ QuoteItem subtotals
```

---

# 42. IVA

El flujo vigente utiliza:

```text
IVA = 16%
```

según la implementación actual.

No debe convertirse en una política fiscal universal permanente.

---

# 43. Total

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

# 44. Backend as authority

Frontend puede calcular valores para UX.

Backend debe validar o recalcular los importes necesarios antes de persistir la
Quote.

No debe confiar ciegamente en valores como:

```text
subtotal

iva

total
```

enviados por cliente.

---

# 45. Monetary representation

Quote utiliza actualmente la representación monetaria histórica del modelo
vigente.

Antes de ampliar significativamente:

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

Este documento no redefine todavía esa arquitectura.

---

# 46. Quote no reserva stock

Debe mantenerse:

```text
Quote
→ no Inventory reservation
```

Una propuesta comercial no garantiza que esa cantidad siga físicamente disponible
cuando posteriormente se convierta en una operación.

---

# 47. Quote puede consultar Inventory

La UI puede utilizar Inventory como contexto.

Ejemplo:

```text
Current stock: 4

Quoted quantity: 10
```

Esto puede ayudar al usuario, pero:

```text
displayed stock
≠
reservation
```

---

# 48. Quote lifecycle no produce InventoryMovement

Debe mantenerse:

```text
Create Quote
→ no InventoryMovement
```

```text
Approve Quote
→ no InventoryMovement
```

```text
Cancel Quote
→ no InventoryMovement
```

Esta regla se refiere al lifecycle propio de Quote.

---

# 49. CURRENT commercial conversion

Actualmente existe:

```text
Quote CONFIRMED
↓
POST /sales/from-quote/:quoteId
↓
Sale CONFIRMED
```

Este flujo forma parte del ERP Core V1 vigente.

No debe describirse simplemente como comportamiento histórico ya reemplazado.

---

# 50. Sale como modelo CURRENT

Debe mantenerse:

```text
Sale
→ CURRENT ERP Core V1
```

aunque exista una arquitectura futura basada en:

```text
SalesOrder
+
Delivery
```

La terminología recomendada es:

```text
CURRENT transitional commercial model
```

y no:

```text
obsolete model
```

---

# 51. convertedToSale — CURRENT transitional field

El schema actual utiliza:

```text
convertedToSale
```

para representar que una Quote ya pasó por el workflow actual de conversión.

Debe considerarse:

```text
CURRENT V1 conversion marker
```

y al mismo tiempo:

```text
future replacement candidate
```

cuando exista una relación comercial explícita basada en SalesOrder/Delivery.

---

# 52. convertedToSale no es destino arquitectónico final

Aunque el campo siga siendo CURRENT, un booleano por sí solo no resuelve de forma
ideal preguntas como:

```text
¿Qué Sale produjo esta Quote?

¿Qué Quote originó esta Sale?
```

Por tanto, existe una deuda de identidad histórica entre ambos documentos.

---

# 53. Conversión elegible

La conversión CURRENT acepta una Quote que cumpla las reglas vigentes, incluyendo:

```text
Quote exists

Quote belongs to Company

Quote is CONFIRMED

Quote has not already been converted

Customer is valid

Products satisfy current Sales rules
```

La implementación de Sales continúa siendo la fuente canónica de las restricciones
de fulfillment.

---

# 54. Conversión no equivale a Quote approval

Debe distinguirse:

```text
Approve Quote
→ Quote CONFIRMED
→ no Inventory mutation
```

de:

```text
Convert Quote
→ creates Sale CONFIRMED
→ inventory consequence through Sales
```

Son dos acciones diferentes.

---

# 55. Inventory effect during CURRENT conversion

La conversión vigente produce:

```text
Quote CONFIRMED
↓
Sale CONFIRMED
↓
Product.stock decrement
↓
InventoryMovement OUT
```

dentro del workflow correspondiente.

Esto no significa que Quote sea propietario de Inventory.

Debe interpretarse como:

```text
Quote conversion
→ delegates commercial fulfillment to Sales
```

y:

```text
Sales
→ owns Inventory OUT consequence
```

---

# 56. Conversion atomicity

La conversión es una operación crítica.

No debe producir un estado como:

```text
Sale created
✓

Inventory mutation
✗
```

ni:

```text
Inventory OUT
✓

Sale missing
✗
```

La implementación debe conservar consistencia transaccional.

---

# 57. Conversion is physically significant CURRENT

Actualmente la acción:

```text
Convert to Sale
```

no es simplemente una navegación o creación administrativa.

Produce una:

```text
Sale CONFIRMED
```

con efecto físico sobre Inventory.

Por tanto, la UX debe tratarla como una operación significativa.

---

# 58. No confirmed Sale reversal CURRENT

Una Sale confirmada no posee actualmente un workflow genérico de reversión.

Por tanto, una conversión Quote → Sale debe ejecutarse con intención clara.

La corrección/reversión de una Sale confirmada permanece fuera del flujo normal
actual.

---

# 59. Duplicate conversion protection

Una Quote ya convertida no puede convertirse normalmente una segunda vez.

Debe mantenerse:

```text
converted Quote
↓
second conversion attempt
→ rejected
```

Esto protege contra múltiples Sales para la misma Quote mediante el workflow
normal.

---

# 60. Conversion idempotency distinction

Debe distinguirse:

```text
duplicate conversion prevention
✅
```

de:

```text
formal idempotent replay contract
```

Un contrato idempotente completo implicaría que un retry pudiera identificar y
devolver de forma determinista la misma operación resultante.

Ese contrato no debe afirmarse como implementado sin una garantía explícita.

---

# 61. Quote remains after conversion

Convertir una Quote no elimina el documento original.

Debe mantenerse:

```text
Quote
→ remains persisted
```

```text
QuoteItems
→ remain persisted
```

```text
Quote commercial values
→ remain historical
```

---

# 62. Current conversion handoff

Después de una conversión exitosa, frontend conserva actualmente:

```text
Sale.id

Sale.folio
```

devueltos por la operación.

Esto permite mostrar:

```text
Ver venta
```

y navegar a:

```text
/sales?saleId=<id>
```

Estado:

```text
same-session Quote → Sale handoff
✅ IMPLEMENTED / VALIDATED
```

---

# 63. Historical Quote → Sale identity debt

Actualmente:

```text
GET /quotes
```

expone:

```text
convertedToSale
```

pero no proporciona de forma suficiente:

```text
related Sale.id

related Sale.folio
```

para reconstruir posteriormente la navegación.

Por tanto:

```text
Quote converted in previous session
→ conversion known
→ resulting Sale identity unavailable from Quote response
```

Estado:

```text
historical Quote → Sale identity
→ TECHNICAL DEBT
```

---

# 64. Future explicit conversion relationship

La arquitectura futura deberá permitir responder directamente:

```text
Which commercial document resulted from this Quote?
```

sin depender únicamente de:

```text
convertedToSale Boolean
```

La estructura técnica exacta se definirá durante la futura evolución comercial.

---

# 65. TARGET commercial architecture

La arquitectura aprobada a largo plazo es:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

En este modelo:

```text
Quote
→ proposal
```

```text
SalesOrder
→ commercial commitment
```

```text
Delivery
→ physical fulfillment
```

```text
Inventory
→ physical consequence
```

---

# 66. TARGET conversion

La futura conversión será conceptualmente:

```text
Quote CONFIRMED
↓
SalesOrder
```

sin Inventory OUT inmediato.

---

# 67. TARGET inventory boundary

Debe mantenerse en la arquitectura futura:

```text
Quote → SalesOrder
→ no Inventory OUT
```

y:

```text
Delivery confirmed
↓
Inventory OUT
```

Esto sustituirá progresivamente la frontera física actualmente concentrada en
Sale.

---

# 68. CURRENT vs TARGET

Debe mantenerse explícitamente:

```text
CURRENT

Quote
↓
Sale CONFIRMED
↓
Inventory OUT
```

frente a:

```text
TARGET

Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

No debe documentarse TARGET como si ya estuviera implementado.

---

# 69. Direct Sale CURRENT

El ERP Core actual también permite Sales que no provienen necesariamente de una
Quote.

Conceptualmente:

```text
Customer
↓
Sale
```

Por tanto:

```text
Quote
→ optional commercial predecessor
```

No toda Sale necesita provenir de Quote.

---

# 70. Quote PDF — CURRENT

Actualmente existe:

```text
GET /quotes/:id/pdf
```

Por tanto:

```text
Quote PDF
→ IMPLEMENTED
```

---

# 71. Quote PDF semantics

El PDF representa:

```text
commercial proposal
```

Puede contener información como:

```text
Company

Customer

folio

date

Products

quantities

prices

subtotal

IVA

total

status
```

No representa:

```text
Inventory document

Delivery

Invoice

Receipt
```

---

# 72. Validity — FUTURE

El modelo actual no formaliza un campo estructurado de vigencia como:

```text
validUntil
```

Por tanto:

```text
Quote expiration / validity
→ FUTURE
```

No debe documentarse como comportamiento CURRENT.

---

# 73. Terms — FUTURE

Una futura Quote puede necesitar campos estructurados para:

```text
terms

conditions

delivery estimate

payment conditions

commercial notes
```

Deben agregarse cuando exista necesidad funcional real.

---

# 74. Sales representative — FUTURE

Quote puede requerir posteriormente una relación formal con:

```text
Sales Representative
```

para:

```text
ownership

reporting

permissions

commission logic
```

Actualmente no debe asumirse esa relación si no está modelada.

---

# 75. Quote versions — FUTURE

Una futura estrategia puede introducir:

```text
revision

version

duplicate-and-revise
```

para modificar propuestas sin reescribir una Quote confirmada.

No forma parte de Quotes V1.

---

# 76. Advanced Quote lifecycle — FUTURE

Capacidades futuras pueden incorporar estados o eventos como:

```text
Sent

Viewed

Accepted

Rejected

Expired
```

Actualmente el lifecycle sigue siendo:

```text
DRAFT

CONFIRMED

CANCELLED
```

No deben agregarse estados anticipadamente.

---

# 77. Quote 360 — FUTURE UX

Una futura experiencia:

```text
Quote 360
```

puede reunir:

```text
Summary

Customer

Products

Totals

Documents

Conversion

Activity

History
```

No es requisito para cerrar Quotes V1.

---

# 78. Contextual CTA CURRENT

Las acciones CURRENT deben reflejar el flujo vigente.

Conceptualmente:

```text
DRAFT
→ Approve / Cancel according to current rules
```

```text
CONFIRMED
→ Convert to Sale when eligible
```

```text
Converted
→ View Sale when identity is available
```

```text
CANCELLED
→ Historical view
```

`Converted` representa una condición derivada y no un nuevo `DocumentStatus`.

---

# 79. No CONVERTED enum

No debe agregarse automáticamente:

```text
CONVERTED
```

a `DocumentStatus`.

Actualmente la condición de conversión se representa mediante el estado de
conversión vigente.

---

# 80. Quote list CURRENT

`/quotes` implementa una experiencia de listado con información como:

```text
folio

Customer

date

total

status

conversion state

actions
```

según el frontend vigente.

---

# 81. Search CURRENT

La búsqueda client-side soporta actualmente campos como:

```text
folio

Customer name

Customer email

SKU

Product name
```

sobre las relaciones cargadas.

---

# 82. Status filter CURRENT

El workspace soporta actualmente:

```text
status filter
```

combinado con búsqueda local.

---

# 83. Server-side filtering debt

Actualmente búsqueda y filtros funcionan sobre los datos cargados.

Por tanto:

```text
server-side search
→ NOT IMPLEMENTED
```

```text
server-side filtering
→ NOT IMPLEMENTED
```

```text
server-side pagination
→ NOT IMPLEMENTED
```

según la arquitectura actual documentada.

---

# 84. Quote detail CURRENT

La experiencia puede abrir el detalle de una Quote seleccionada desde el listado
cargado.

Actualmente no existe:

```text
GET /quotes/:id
```

como endpoint dedicado documentado.

---

# 85. Quote detail debt

El detalle basado en:

```text
GET /quotes
```

funciona mientras la Quote esté contenida en el dataset cargado.

Con futura paginación server-side deberá implementarse:

```text
GET /quotes/:id
```

o una estrategia equivalente.

Estado:

```text
dedicated Quote detail strategy
→ TECHNICAL DEBT
```

---

# 86. API CURRENT

Endpoints vigentes:

```text
POST  /quotes

GET   /quotes

PATCH /quotes/:id/approve

PATCH /quotes/:id/cancel

GET   /quotes/:id/pdf

POST  /sales/from-quote/:quoteId
```

Este documento no agrega endpoints inexistentes únicamente por consistencia
estética.

---

# 87. API not CURRENT

No deben documentarse como implementados actualmente:

```text
GET /quotes/:id
```

```text
PATCH /quotes/:id
```

```text
POST /quotes/:id/confirm
```

```text
POST /quotes/:id/convert
```

salvo que la implementación cambie posteriormente.

---

# 88. Conversion response

La conversión CURRENT devuelve suficiente identidad de la Sale creada para que
frontend pueda conservar:

```text
Sale.id

Sale.folio
```

durante el handoff inmediato.

El contrato exacto pertenece al backend vigente.

---

# 89. Multi-tenancy

Toda Quote pertenece a una Company.

Debe mantenerse:

```text
Quote.companyId
```

alineado con:

```text
Customer.companyId

Product.companyId
```

según las relaciones utilizadas.

---

# 90. Cross-tenant Customer

Debe rechazarse:

```text
Company A Quote
↓
Customer Company B
```

aunque el UUID exista.

---

# 91. Cross-tenant Product

También debe rechazarse:

```text
Company A Quote
↓
Product Company B
```

---

# 92. Authorization

Quotes utiliza la arquitectura transversal de:

```text
Authentication

Authorization

Tenant Isolation

Validation
```

Los endpoints críticos deben continuar incluidos en la revisión transversal de
autorización antes de producción.

---

# 93. Permission granularity — TARGET

Una futura arquitectura RBAC puede incluir conceptos como:

```text
quotes.read

quotes.create

quotes.approve

quotes.cancel

quotes.convert

quotes.price.override
```

No deben considerarse permisos granulares completamente implementados únicamente
por estar documentados aquí.

---

# 94. Audit — TARGET

Una futura plataforma transversal de Audit puede registrar eventos como:

```text
Quote created

Quote approved

Quote cancelled

Quote converted
```

Actualmente no existe un Audit transversal completo.

---

# 95. Healthcare boundary

Quotes pertenece a ERP Core.

Debe ser posible:

```text
Customer
↓
Quote
```

sin requerir:

```text
Hospital

Doctor

Case

Technician
```

---

# 96. Healthcare TARGET

Futuros workflows Healthcare podrán:

```text
originate commercial demand

reference a Quote

reference a Sale / future SalesOrder
```

cuando corresponda.

Healthcare no debe convertirse en requisito del módulo Quotes.

---

# 97. Opportunity — FUTURE

Un futuro CRM puede incorporar:

```text
Opportunity
↓
Quote
```

o integrarse con Healthcare.

Actualmente:

```text
Opportunity
→ NOT IMPLEMENTED
```

No forma parte del ERP Core V1.

---

# 98. Quote does not require Case

Debe mantenerse:

```text
Quote
→ independent ERP Core document
```

No:

```text
Quote
→ requires Healthcare Case
```

---

# 99. Billing boundary

Quote no produce automáticamente:

```text
Invoice

Payment

Accounts Receivable
```

Billing podrá utilizar información comercial posteriormente.

La Quote continúa siendo una propuesta.

---

# 100. Dashboard

Dashboard puede consumir información de Quotes para mostrar contexto como:

```text
recent Quotes

Quote totals

commercial activity
```

cuando exista semántica suficiente.

Dashboard no es propietario del lifecycle.

---

# 101. Import — FUTURE

La importación masiva de Quotes no es una prioridad inicial de Data Import.

Si se implementa deberá distinguir:

```text
historical Quote
```

de:

```text
operational Quote
```

para evitar activar conversiones accidentalmente durante una migración.

---

# 102. IMPLEMENTED — Quotes

Actualmente:

```text
Quote persistence

QuoteItem persistence

Quote creation

Quote list

DRAFT

CONFIRMED

CANCELLED

Quote approval

Quote cancellation

Quote PDF

Customer relationship

Product relationship

Customer active validation

Product active validation

client-side search

status filter

detail from loaded list
```

---

# 103. IMPLEMENTED — conversion

Actualmente:

```text
CONFIRMED Quote → Sale

convertedToSale marker

duplicate conversion rejection

Sale CONFIRMED creation

Inventory OUT through Sales

Sale identity returned to frontend

Ver venta handoff

/sales?saleId=<id>
```

---

# 104. VALIDATED

La validación registrada cubre según los hitos correspondientes:

```text
Quote creation

Customer validation

Product validation

Quote approval

Quote cancellation

approval without Inventory mutation

Quote PDF

Quote list/search/filter UX

Quote → Sale conversion

converted Quote protection

Sale handoff

Sales deep-link
```

Los gates técnicos incluyen según el hito:

```text
tests

build

lint

git diff --check
```

Los snapshots cuantitativos pertenecen a:

```text
PROJECT_BOARD.md

CHANGELOG.md
```

---

# 105. TECHNICAL DEBT

Permanece pendiente:

```text
historical Quote → Sale identity
```

```text
historical converted Quote → direct Sale navigation
```

```text
GET /quotes/:id
or equivalent detail strategy
```

```text
server-side pagination
```

```text
server-side search/filtering
```

```text
generic Quote DRAFT editing workflow if required
```

```text
formal conversion idempotent replay if required
```

```text
Audit integration
```

---

# 106. TARGET

La evolución comercial aprobada incluye:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

además de:

```text
explicit Quote → SalesOrder relationship

better historical conversion identity

Quote 360

server-side pagination/search

Audit integration

granular permissions

OpenAPI improvements
```

---

# 107. FUTURE

Capacidades posibles:

```text
Validity / expiration

Quote versions

Sent status

Viewed status

Accepted / rejected

Customer signatures

Sales representative

Discount approvals

Price Lists

Multiple currencies

Terms and conditions

Opportunity integration

Electronic acceptance

Customer Portal

Quote analytics

AI conversion probability
```

No forman parte automáticamente del ERP Core V1.

---

# 108. Invariantes

## Tenant

```text
Quote
→ belongs to one Company
```

---

## Customer

```text
New Quote
→ active same-tenant Customer required
```

---

## Product

```text
New Quote
→ active same-tenant Product required
```

---

## Lifecycle

```text
Quote
→ DRAFT / CONFIRMED / CANCELLED
```

---

## Approval

```text
Quote approval
→ no Inventory mutation
```

---

## Cancellation

```text
Quote cancellation
→ no Inventory mutation
```

---

## Quote Inventory ownership

```text
Quote lifecycle
→ no InventoryMovement
```

---

## CURRENT conversion

```text
Quote CONFIRMED
↓
Sale CONFIRMED
↓
Inventory OUT through Sales
```

---

## Conversion uniqueness

```text
Quote already converted
→ no second normal Sale conversion
```

---

## Historical Quote

```text
Quote conversion
→ does not delete Quote
```

---

## Price

```text
Product.price changes
≠
historical QuoteItem.price changes
```

---

## Reservation

```text
Quote
→ no automatic stock reservation
```

---

## CURRENT commercial model

```text
Quote
↓
Sale
```

---

## TARGET commercial model

```text
Quote
↓
SalesOrder
↓
Delivery
```

---

# 109. Anti-patrones

## Inventory on approval

Incorrecto:

```text
Approve Quote
→ stock -= quantity
```

---

## Quote = Sale

Incorrecto:

```text
Quote
=
Sale
```

Son documentos con responsabilidades diferentes.

---

## Quote = Delivery

Incorrecto:

```text
Quote CONFIRMED
→ goods delivered
```

---

## Quote = Invoice

Incorrecto:

```text
Quote
→ fiscal Invoice
```

---

## Current Product price as historical price

Incorrecto:

```text
historical Quote
→ recalculated from current Product.price
```

---

## convertedToSale as permanent architecture

Incorrecto asumir que:

```text
convertedToSale Boolean
```

será para siempre la única relación documental.

Sigue siendo CURRENT, pero es transicional.

---

## Sale marked as already obsolete

Incorrecto documentar:

```text
Sale
→ historical only
```

mientras continúa siendo el modelo comercial CURRENT.

---

## Target documented as Current

Incorrecto:

```text
Quote
→ SalesOrder
→ Delivery
```

como si ya estuviera implementado.

---

## Cross-tenant Quote

Incorrecto utilizar:

```text
Customer

or Product
```

de otra Company.

---

## Frontend-only validation

Incorrecto asumir que los selectores sustituyen:

```text
backend tenant validation

backend active-state validation
```

---

## Duplicate conversion

Incorrecto:

```text
Quote
→ Sale A

same Quote
→ Sale B
```

mediante el flujo normal.

---

# 110. Relación con Customers

CURRENT:

```text
Customer
↓
Quote
```

Customers administra:

```text
commercial counterpart master data
```

Quotes administra:

```text
proposal
```

El Customer activo es obligatorio para nuevas Quotes.

---

# 111. Relación con Products

CURRENT:

```text
Product
↓
QuoteItem
```

Product proporciona identidad de catálogo.

QuoteItem conserva:

```text
quantity

price
```

de la propuesta.

---

# 112. Relación con Sales

CURRENT:

```text
Quote CONFIRMED
↓
Sale CONFIRMED
```

cuando se ejecuta la conversión vigente.

`SALES.md` es la fuente canónica para:

```text
Sale lifecycle

Generic Sales eligibility

Inventory OUT

Sales deep-link
```

---

# 113. Relación con Inventory

Debe mantenerse:

```text
Quote lifecycle
→ may READ Inventory context
→ does not WRITE Inventory
```

pero:

```text
Quote → Sale conversion
→ invokes CURRENT Sales workflow
→ Sales produces Inventory OUT
```

---

# 114. Relación con SalesOrder / Delivery

TARGET:

```text
Quote
↓
SalesOrder
↓
Delivery
```

ADR-011 define la dirección arquitectónica futura.

No significa que SalesOrder/Delivery ya hayan sustituido a Sale.

---

# 115. ADR relacionados

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
```

ADR-010 puede estar superado como dirección arquitectónica futura, pero el flujo
Quote → Sale continúa siendo CURRENT mientras no se complete la migración.

---

# 116. Documentación relacionada

```text
docs/modules/erp/CUSTOMERS.md

docs/modules/erp/PRODUCTS.md

docs/modules/erp/SALES.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/architecture/ARCHITECTURE.md

docs/engineering/API_GUIDELINES.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/product/PRODUCT_REQUIREMENTS.md

docs/product/ZAPING_WAY.md

docs/ux/BUSINESS_COMPONENTS.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

`SALES.md` es documentación CURRENT relacionada, no un documento futuro.

---

# 117. Fuente de verdad

```text
QUOTES.md
→ CURRENT Quote behavior
→ Quote lifecycle
→ Quote conversion entry point
```

```text
SALES.md
→ CURRENT Sale behavior
→ Generic Sales eligibility
→ Inventory OUT consequence
```

```text
CUSTOMERS.md
→ Customer master-data lifecycle
→ active Customer rules
```

```text
PRODUCTS.md
→ Product master-data lifecycle
→ tracking configuration
```

```text
INVENTORY.md
→ stock and InventoryMovement semantics
```

```text
ADR-011
→ TARGET SalesOrder / Delivery architecture
```

```text
schema.prisma
→ CURRENT persistence
```

```text
Quotes backend
→ CURRENT API and business implementation
```

```text
Quotes frontend
→ CURRENT user experience
```

```text
tests
→ validated behavior
```

```text
PROJECT_BOARD.md
→ current status and technical debt
```

```text
CHANGELOG.md
→ historical implementation evolution
```

---

# 118. Estado consolidado

Quotes CURRENT:

```text
Quote creation
✅ IMPLEMENTED / VALIDATED

Quote list
✅ IMPLEMENTED / VALIDATED

DRAFT
✅

CONFIRMED
✅

CANCELLED
✅

Quote approval
✅ IMPLEMENTED / VALIDATED

Quote cancellation
✅ IMPLEMENTED / VALIDATED

Quote PDF
✅ IMPLEMENTED

Customer active validation
✅ IMPLEMENTED / VALIDATED

Product active validation
✅ IMPLEMENTED / VALIDATED

client-side search
✅

status filter
✅

detail from loaded list
✅
```

Conversion CURRENT:

```text
CONFIRMED Quote → Sale
✅

duplicate conversion prevention
✅

Sale CONFIRMED
✅

Inventory OUT through Sales
✅

Sale identity returned
✅

Ver venta
✅

/sales?saleId=<id>
✅
```

Technical debt:

```text
historical Quote → Sale identity/navigation
⏳

dedicated Quote detail endpoint
⏳

server-side pagination
⏳

server-side search/filtering
⏳

generic DRAFT editing workflow
⏳ if required

formal conversion idempotent replay
⏳ if required

Audit integration
⏳
```

Target:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

Future:

```text
Quote versions

Validity

Sent / Viewed

Accepted / Rejected

Customer signatures

Sales representative

Discount approvals

CRM Opportunity

Customer Portal

Advanced pricing
```

---

# 119. Secuencia de proyecto

Quotes V1 forma parte del ERP Core actual.

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

Por tanto, la arquitectura:

```text
SalesOrder
↓
Delivery
```

no debe introducirse automáticamente durante la normalización documental.

Debe conservarse el flujo CURRENT hasta que exista un refactor comercial
deliberado y validado.

---

# 120. Regla de transición comercial

Mientras exista el modelo CURRENT:

```text
Quote
↓
Sale
```

debe documentarse y mantenerse correctamente.

La arquitectura futura:

```text
Quote
↓
SalesOrder
↓
Delivery
```

no debe utilizarse para fingir que la migración ya ocurrió.

La transición deberá realizarse deliberadamente, preservando:

```text
historical Quotes

historical Sales

Inventory history

document identities

tenant integrity
```

---

# 121. Principio final

Quote responde:

```text
¿Qué estamos proponiendo comercialmente al Customer?
```

No responde directamente:

```text
¿Qué se entregó?
```

ni:

```text
¿Qué salió del Inventory?
```

CURRENT:

```text
Quote
↓
Proposal

Quote conversion
↓
Sale
↓
Inventory OUT
```

TARGET:

```text
Quote
↓
Proposal

SalesOrder
↓
Commitment

Delivery
↓
Fulfillment

Inventory
↓
Physical consequence
```

Debe mantenerse:

```text
Quote lifecycle
≠
Inventory mutation
```

aunque el workflow CURRENT de:

```text
Quote → Sale
```

sí genere posteriormente una consecuencia física mediante Sales.

> **Cotizar es proponer. En el ERP Core actual, convertir una Quote crea una Sale
> confirmada que ejecuta la salida de inventario; en la arquitectura futura,
> SalesOrder y Delivery separarán explícitamente el compromiso comercial del
> cumplimiento físico.**
