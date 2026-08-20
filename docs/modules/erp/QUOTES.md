# Módulo de Cotizaciones — Zaping ERP

**Módulo:** Quotes
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / REQUIERE EVOLUCIÓN COMERCIAL
**Última actualización:** 2026-08-19
**Responsable:** Zaping ERP Team

---

# 1. Propósito

El módulo Quotes administra las propuestas comerciales que una Company presenta a sus Customers.

Su responsabilidad principal es responder:

```text
¿Qué estamos ofreciendo?
¿A qué cliente?
¿Qué productos?
¿Qué cantidades?
¿A qué precio?
¿Cuál es el total?
¿En qué estado se encuentra la propuesta?
¿Generó posteriormente una operación comercial?
```

Una Quote representa una **propuesta comercial**.

No representa:

* una entrega;
* una salida física;
* una factura;
* un movimiento de inventario.

---

# 2. Principio fundamental

```text
Quote
=
propuesta comercial
```

Por tanto:

> **Crear, editar o confirmar una cotización no debe modificar inventario.**

---

# 3. Arquitectura comercial objetivo

La dirección aprobada es:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

Quote puede ser opcional.

Una operación comercial también puede comenzar directamente mediante:

```text
SalesOrder
↓
Delivery
```

cuando el negocio no requiera cotización previa.

---

# 4. Responsabilidades

Quotes es propietario de:

* Quote;
* QuoteItem;
* folio de cotización;
* Customer de la propuesta;
* productos ofrecidos;
* cantidades;
* precios de la propuesta;
* subtotal;
* impuestos calculados;
* total;
* lifecycle de Quote;
* conversión comercial de la propuesta.

---

# 5. Fuera del alcance

Quotes no es propietario de:

* stock;
* InventoryMovement;
* lotes;
* disponibilidad física;
* SalesOrder lifecycle;
* Delivery;
* Invoice;
* Payment;
* Case Logistics;
* cuentas por cobrar.

---

# 6. Modelo actual

El modelo técnico actual contiene conceptualmente:

```text
Quote
├── id
├── companyId
├── customerId
├── folio
├── subtotal
├── iva
├── total
├── status
├── convertedToSale
├── createdAt
├── updatedAt
├── customer
└── items
```

La definición exacta permanece en `schema.prisma`.

---

# 7. QuoteItem

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

---

# 8. Quote como documento transaccional

Quote no es Master Data.

Su lifecycle se expresa principalmente mediante estados de negocio.

Actualmente utiliza:

```text
DRAFT
CONFIRMED
CANCELLED
```

mediante `DocumentStatus`.

---

# 9. DRAFT

Una nueva Quote comienza como:

```text
DRAFT
```

Representa una propuesta todavía editable.

---

# 10. Capacidades de DRAFT

Mientras una Quote se encuentre en borrador puede permitir:

* cambiar Customer;
* agregar Products;
* quitar Products;
* modificar cantidades;
* modificar precios permitidos;
* recalcular totales;
* confirmar;
* cancelar.

---

# 11. CONFIRMED

Una Quote confirmada representa una propuesta comercial que dejó su fase editable normal.

Conceptualmente:

```text
DRAFT
↓
CONFIRMED
```

---

# 12. Qué no significa CONFIRMED

`CONFIRMED` no debe interpretarse automáticamente como:

```text
mercancía entregada
```

ni:

```text
inventario descontado
```

ni:

```text
factura emitida
```

Tampoco debe asumirse necesariamente que existe aceptación formal del cliente si el módulo aún no registra ese hecho por separado.

---

# 13. Inmutabilidad comercial

Una vez confirmada, los valores que definen la propuesta no deben modificarse silenciosamente.

Especialmente:

* Customer;
* Products;
* quantities;
* prices;
* totals.

Si la cotización debe cambiar sustancialmente, puede requerirse posteriormente:

* revisión;
* duplicado;
* nueva versión;
* nueva Quote.

La estrategia de versiones todavía no forma parte del Core actual.

---

# 14. CANCELLED

Una Quote cancelada representa una propuesta que ya no continuará mediante su flujo normal.

```text
DRAFT / CONFIRMED
↓
CANCELLED
```

Las transiciones exactas permitidas deben corresponder a la implementación vigente.

---

# 15. Cancelar no elimina

Una Quote cancelada debe conservar:

* folio;
* Customer;
* items;
* precios;
* totales;
* fechas;
* historial.

```text
CANCELLED
≠
DELETED
```

---

# 16. Lifecycle conceptual

```text
DRAFT
├──→ CANCELLED
│
└──→ CONFIRMED
       │
       ├──→ Commercial conversion
       │
       └──→ CANCELLED
            cuando las reglas lo permitan
```

La conversión comercial no debe confundirse con un movimiento de inventario.

---

# 17. Folio

Quote utiliza un folio empresarial independiente del UUID.

Ejemplo:

```text
id
→ UUID

folio
→ COT-000421
```

El formato concreto pertenece a la implementación.

---

# 18. Folio vs UUID

El UUID sirve para identidad técnica.

El folio sirve para:

* usuarios;
* búsqueda;
* documentos;
* comunicación comercial;
* referencias.

---

# 19. Unicidad del folio

Arquitectónicamente, un folio empresarial debe evitar ambigüedad dentro de su Company.

Sin embargo, cualquier nueva restricción de base de datos debe validarse contra el schema y los datos existentes antes de crear una migración.

Este documento no ordena una migración inmediata.

---

# 20. Customer

Toda Quote pertenece a un Customer.

Conceptualmente:

```text
Customer
↓
Quote
```

---

# 21. Validación de Customer

Backend debe comprobar:

```text
Customer exists
AND
Customer belongs to authenticated Company
```

y, para nuevas propuestas cuando corresponda:

```text
Customer is active
```

---

# 22. Customer inactivo histórico

Si un Customer se desactiva posteriormente, una Quote histórica continúa siendo válida.

No debe desaparecer ni cambiar automáticamente.

---

# 23. CustomerSelector

La UI puede utilizar:

```text
CustomerSelector
```

para localizar y seleccionar clientes.

La selección visual no reemplaza la validación backend.

---

# 24. Creación contextual de Customer

El flujo objetivo puede permitir:

```text
Nueva cotización
↓
CustomerSelector
↓
Cliente no existe
↓
Crear cliente
↓
Seleccionarlo
↓
Continuar cotización
```

sin perder los datos del formulario.

---

# 25. Products

Cada QuoteItem referencia un Product.

Backend debe verificar:

```text
Product exists
AND
Product belongs to Company
```

---

# 26. Producto inactivo

Un Product inactivo normalmente no debe agregarse a nuevas Quotes.

Pero debe seguir mostrándose correctamente dentro de Quotes históricas.

---

# 27. ProductSelector

La UI puede utilizar:

```text
ProductSelector
```

para localizar productos por información como:

* SKU;
* nombre;
* marca;
* barcode;

según las capacidades implementadas.

---

# 28. Productos duplicados

Una Quote no debería contener partidas duplicadas del mismo producto sin una razón explícita.

Preferir:

```text
Product A × 10
```

sobre:

```text
Product A × 4
Product A × 6
```

cuando representan exactamente la misma condición comercial.

---

# 29. Quantity

La cantidad debe ser positiva.

Actualmente el modelo utiliza:

```text
Int
```

por lo que conceptualmente:

```text
quantity >= 1
```

---

# 30. Unidades fraccionarias

Si posteriormente Zaping soporta unidades fraccionarias, deberá revisarse de manera conjunta:

* Products;
* Quotes;
* Purchases;
* Sales;
* Inventory.

No debe modificarse exclusivamente Quote.

---

# 31. Price

`QuoteItem.price` representa el precio ofrecido dentro de esa cotización.

Constituye un snapshot comercial.

---

# 32. Precio de Product vs precio de Quote

Al crear una partida puede utilizarse como referencia:

```text
Product.price
```

pero una vez guardado:

```text
QuoteItem.price
```

representa el precio específico de esa propuesta.

---

# 33. Cambio posterior del precio

Si posteriormente:

```text
Product.price = 120
```

una Quote anterior que fue creada con:

```text
QuoteItem.price = 100
```

debe conservar:

```text
100
```

---

# 34. Precio editable

Quotes puede permitir al usuario autorizado ajustar el precio de una propuesta.

Esto no implica que todos los usuarios deban tener permiso para modificar precios arbitrariamente.

Una futura estrategia RBAC puede separar esa capacidad.

---

# 35. Pricing futuro

El campo `Product.price` y el precio capturado en Quote no constituyen todavía un motor avanzado de pricing.

Capacidades futuras pueden incluir:

```text
Price Lists
Customer-specific Prices
Discounts
Promotions
Contracts
Currency
Validity
```

Estas reglas deberán diseñarse cuando exista necesidad.

---

# 36. Item Subtotal

Conceptualmente:

```text
Item Subtotal
=
quantity × price
```

El backend debe ser autoridad sobre el cálculo final.

---

# 37. Quote Subtotal

```text
Quote Subtotal
=
Σ QuoteItem subtotal
```

---

# 38. IVA

El modelo actual conserva:

```text
iva
```

como importe calculado.

El flujo histórico de Zaping utiliza 16 % en operaciones actuales.

Esto no debe convertirse en una política fiscal universal permanente.

---

# 39. Fiscalidad futura

En el futuro podrán existir:

* productos exentos;
* tasas diferentes;
* impuestos adicionales;
* configuraciones por empresa;
* reglas CFDI.

Billing y el modelo fiscal deberán formalizar esa arquitectura.

---

# 40. Total

Conceptualmente:

```text
total
=
subtotal
+
iva
```

según la lógica fiscal implementada actualmente.

---

# 41. Backend como autoridad

Frontend puede calcular una vista previa para UX.

Pero backend debe recalcular o validar los importes antes de persistir una Quote.

No debe confiar en:

```text
subtotal enviado por cliente
```

como autoridad absoluta.

---

# 42. Dinero

Actualmente Quote utiliza `Float`.

Antes de ampliar significativamente:

* Billing;
* CFDI;
* accounting;
* financial reporting;

debe revisarse la estrategia de precisión monetaria.

Este documento no ordena todavía ese cambio.

---

# 43. Quote no reserva stock

Regla actual:

```text
Quote
→ no stock movement
```

y además:

```text
Quote
→ no reservation automática
```

---

# 44. Cotizar sin disponibilidad

Dependiendo de la política comercial, puede ser válido cotizar un producto que no se encuentra físicamente disponible en ese instante.

Esto es diferente a:

```text
Delivery
```

que sí debe validar la existencia necesaria antes de confirmar la salida.

---

# 45. Información de disponibilidad

La UI puede mostrar contexto como:

```text
Stock actual: 4
Cantidad cotizada: 10
```

para ayudar al vendedor.

Pero no debe tratar ese indicador como una reserva.

---

# 46. Quote nunca produce InventoryMovement

Debe cumplirse:

```text
Create Quote
→ no InventoryMovement
```

```text
Confirm Quote
→ no InventoryMovement
```

```text
Cancel Quote
→ no InventoryMovement
```

---

# 47. Modelo comercial legacy

Actualmente el schema contiene:

```text
convertedToSale Boolean
```

Este campo pertenece al modelo histórico:

```text
Quote
↓
Sale
↓
Inventory OUT
```

---

# 48. Estado de `convertedToSale`

A partir de ADR-011:

```text
convertedToSale
```

debe considerarse:

**LEGACY**

No debe convertirse en fundamento para nuevas funcionalidades.

---

# 49. Por qué queda legacy

El campo representa una arquitectura que mezclaba:

```text
conversión comercial
+
venta
+
salida física
```

en un mismo flujo.

La arquitectura nueva separa:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory
```

---

# 50. No eliminar el campo todavía

Este documento **no ordena eliminar `convertedToSale` del schema ahora**.

Primero debe revisarse:

* código backend;
* frontend;
* tests;
* datos existentes;
* relaciones con Sale;
* migración hacia SalesOrder.

---

# 51. Migración comercial

La secuencia correcta es:

```text
Documentar modelo objetivo
↓
Auditar Sale actual
↓
Diseñar SalesOrder
↓
Diseñar Delivery
↓
Diseñar migración
↓
Implementar
↓
Migrar consumidores
↓
Retirar legacy
```

No debemos romper el flujo existente simplemente cambiando un campo.

---

# 52. Conversión histórica

El comportamiento implementado actualmente puede permitir:

```text
Quote CONFIRMED
↓
Convert to Sale
```

y generar un `Sale` confirmado.

Ese comportamiento constituye compatibilidad legacy mientras se implementa ADR-011.

---

# 53. Arquitectura objetivo de conversión

El destino aprobado es:

```text
Quote CONFIRMED
↓
Convert
↓
SalesOrder
```

---

# 54. Conversión objetivo no mueve inventario

Debe cumplirse:

```text
Quote
→ SalesOrder
→ no Inventory OUT
```

La salida definitiva ocurre posteriormente:

```text
Delivery CONFIRMED
↓
Inventory OUT
```

---

# 55. Idempotencia de conversión

Una misma Quote no debe crear múltiples operaciones comerciales por doble click, retry o request repetido.

Conceptualmente:

```text
Quote Q-001
↓ convert
SalesOrder SO-001
```

un segundo intento debe detectar que la conversión ya ocurrió.

---

# 56. Relación explícita

La arquitectura futura debe poder responder:

```text
¿De qué Quote nació este SalesOrder?
```

y:

```text
¿Qué SalesOrder generó esta Quote?
```

sin depender únicamente de un booleano.

---

# 57. No diseñar la FK todavía

La relación futura puede resolverse mediante:

* `sourceQuoteId`;
* relación Quote ↔ SalesOrder;
* registro de conversión;

u otra estructura coherente.

El modelo técnico se decidirá durante el refactor de Sales.

No se modifica Prisma desde este documento.

---

# 58. Conversion no significa eliminación

Después de convertir una Quote, la Quote original debe permanecer como documento histórico.

No debe:

* borrarse;
* convertirse físicamente en otra fila;
* perder sus items.

---

# 59. Snapshot al convertir

Cuando una Quote origina un SalesOrder, deben transferirse los datos comerciales necesarios.

Conceptualmente:

```text
Quote
├── Customer
├── Items
├── Quantities
├── Prices
└── Totals
       ↓
SalesOrder
```

---

# 60. Independencia posterior

Después de la conversión debe definirse claramente qué cambios posteriores son independientes.

Por ejemplo, si una futura SalesOrder cambia mediante un proceso autorizado, no debe reescribir la Quote histórica que la originó.

---

# 61. Quote convertida y Customer

La operación convertida debe conservar correctamente la contraparte comercial.

Backend debe validar tenant y consistencia durante la conversión.

---

# 62. Conversión transaccional

La creación de la operación comercial resultante debe mantener consistencia.

No debe ocurrir:

```text
SalesOrder created
✓

Quote conversion relationship
✗
```

o viceversa.

---

# 63. Conversión legacy con inventario

La implementación histórica:

```text
Quote
↓
Sale
↓
Inventory OUT
```

puede seguir existiendo temporalmente.

Pero no debe utilizarse como arquitectura para nuevas funciones.

---

# 64. PDF

Una Quote puede necesitar representación documental para entregarse al Customer.

Conceptualmente el PDF puede incluir:

```text
Company
Customer
Folio
Fecha
Products
Quantities
Prices
Subtotal
Taxes
Total
Status
```

---

# 65. Estado de PDF

La capacidad concreta de PDF debe verificarse contra el código vigente durante la auditoría final.

Este documento define su lugar funcional, pero no debe utilizarse para afirmar que un endpoint específico existe si la implementación actual no lo confirma.

---

# 66. Quote document

El PDF representa la propuesta comercial.

No representa:

* Delivery;
* Invoice;
* Receipt;
* Inventory document.

---

# 67. Vigencia

Una cotización comercial normalmente puede necesitar fecha de vigencia.

El modelo actual revisado no contiene un campo estructurado de vigencia.

Por tanto, no debe documentarse como funcionalidad implementada.

---

# 68. Vigencia futura

Puede evolucionarse hacia un campo como concepto:

```text
validUntil
```

cuando el proceso comercial lo requiera.

Su nombre y tipo deberán definirse durante diseño.

---

# 69. Notas y términos

Quotes puede necesitar posteriormente:

* notas;
* condiciones;
* términos comerciales;
* tiempo de entrega;
* condiciones de pago.

Estos campos deben añadirse cuando existan necesidades reales.

No deben almacenarse indiscriminadamente en campos genéricos sin estructura.

---

# 70. Sales representative

Una Quote puede necesitar saber qué vendedor la gestiona.

El modelo actual revisado no formaliza todavía esa relación.

Debe diseñarse junto con:

* ownership comercial;
* RBAC;
* Sales;
* reporting.

---

# 71. Quote 360

La arquitectura objetivo contempla una vista contextual:

```text
Quote 360
```

---

# 72. Objetivo de Quote 360

Debe responder:

```text
¿A quién cotizamos?
¿Qué ofrecimos?
¿A qué precio?
¿En qué estado está?
¿Se convirtió?
¿Qué operación resultó?
¿Qué puedo hacer ahora?
```

---

# 73. Vista conceptual

Puede incluir progresivamente:

```text
Resumen
Productos
Customer
Totales
Actividad
Documentos
Operación resultante
Historial
```

---

# 74. Acción principal por estado

Conceptualmente:

```text
DRAFT
→ Editar / Confirmar
```

```text
CONFIRMED
→ Convertir a SalesOrder
```

```text
CONVERTED
→ Abrir SalesOrder
```

```text
CANCELLED
→ Ver historial
```

`CONVERTED` en este ejemplo representa una condición UX, no un nuevo `DocumentStatus` aprobado.

---

# 75. No agregar `CONVERTED` al enum todavía

No debe modificarse:

```text
DocumentStatus
```

únicamente para reflejar este documento.

La conversión puede representarse mediante una relación o condición derivada.

---

# 76. Listado

La tabla principal puede priorizar:

```text
Folio
Customer
Fecha
Total
Estado
Conversión
Acciones
```

según la experiencia implementada.

---

# 77. Filtros

Filtros útiles pueden incluir:

```text
Status
Customer
Date
Search
```

y posteriormente:

```text
Converted / Not Converted
Sales representative
Validity
```

cuando existan esos conceptos.

---

# 78. Search

La búsqueda debe permitir localizar Quotes mediante información empresarial reconocible.

Especialmente:

```text
folio
customer name
```

y otros campos cuando el API lo soporte.

---

# 79. Empty State

Ejemplo:

```text
Todavía no hay cotizaciones.

Crea una propuesta comercial para comenzar
a trabajar con tus clientes.

[Nueva cotización]
```

---

# 80. Customer 360

Desde Customer 360 podrán mostrarse sus Quotes.

Ejemplo:

```text
Customer ABC

Cotizaciones
COT-001   $10,000   Confirmada
COT-002   $25,000   Borrador
```

Customers no se convierte por ello en propietario de Quotes.

---

# 81. Dashboard

Dashboard puede utilizar información de Quotes para mostrar:

```text
Quotes abiertas
Quotes recientes
Quotes pendientes de seguimiento
```

cuando exista una semántica suficientemente definida.

---

# 82. Quote acceptance futura

Un proceso comercial más avanzado puede distinguir:

```text
Created
Sent
Viewed
Accepted
Rejected
Expired
```

Pero el modelo actual no posee ese lifecycle.

No debemos agregar esos estados anticipadamente.

---

# 83. CRM futuro

Cuando Zaping incorpore un CRM más completo, Quote puede relacionarse con:

```text
Opportunity
↓
Quote
↓
SalesOrder
```

Esto no modifica el Core actual.

---

# 84. Healthcare

Healthcare puede generar una necesidad comercial mediante:

```text
Opportunity
Case
Doctor request
Reconciliation
```

y posteriormente relacionarse con Quote cuando corresponda.

No todos los Cases requieren Quote.

---

# 85. Quote no requiere Case

ERP Core debe permitir:

```text
Customer
↓
Quote
```

sin:

* Hospital;
* Doctor;
* Case;
* Technician.

---

# 86. Reconciliation Healthcare

Una conciliación puede generar la necesidad de comercializar material consumido.

Dependiendo del workflow puede producir:

```text
Sales draft
```

o utilizar una operación comercial previamente acordada.

No debe crearse una Quote retrospectiva artificial únicamente para completar una cadena.

---

# 87. Multi-tenancy

Toda Quote pertenece a una Company.

Debe validarse:

```text
Quote.companyId
Customer.companyId
Product company
```

dentro del mismo tenant.

---

# 88. Cross-tenant Customer

Debe rechazarse:

```text
Company A Quote
↓
Customer Company B
```

aunque el UUID del Customer exista.

---

# 89. Cross-tenant Product

También debe rechazarse:

```text
Company A Quote
↓
Product Company B
```

---

# 90. Authorization

El módulo debe aplicar:

```text
Authentication
+
Authorization
+
Tenant Isolation
+
Validation
```

---

# 91. RBAC

Permisos conceptuales pueden evolucionar hacia:

```text
quotes.read
quotes.create
quotes.update
quotes.confirm
quotes.cancel
quotes.convert
quotes.price.override
```

No todos están implementados actualmente.

---

# 92. Price override

Modificar el precio comercial puede convertirse en una capacidad sensible.

Una empresa puede posteriormente requerir:

```text
Salesperson
→ puede cotizar

Manager
→ puede autorizar descuento mayor
```

Ese workflow deberá diseñarse cuando exista necesidad.

---

# 93. Auditoría

Acciones relevantes pueden incluir:

```text
Quote created
Quote updated
Quote confirmed
Quote cancelled
Quote converted
```

---

# 94. Historial

Una Quote importante debería permitir comprender:

```text
quién la creó
cuándo
quién la modificó
cuándo se confirmó
si fue convertida
qué operación resultó
```

cuando la infraestructura de auditoría lo soporte.

---

# 95. API actual

Los endpoints exactos deben verificarse contra la implementación vigente.

Conceptualmente el módulo necesita capacidades equivalentes a:

```text
GET    /quotes
GET    /quotes/:id
POST   /quotes
PATCH  /quotes/:id
```

y acciones de lifecycle correspondientes.

---

# 96. API de confirmación

Una dirección explícita puede utilizar:

```text
POST /quotes/:id/confirm
```

si se alinea con el lifecycle implementado.

No debe hacerse un refactor únicamente por estética de URL.

---

# 97. API de conversión objetivo

Conceptualmente:

```text
POST /quotes/:id/convert
```

puede producir un SalesOrder.

El contrato exacto se definirá con Sales.

---

# 98. Respuesta de conversión

Una conversión exitosa debe permitir al frontend identificar claramente la operación resultante.

Ejemplo conceptual:

```json
{
  "quoteId": "...",
  "salesOrderId": "..."
}
```

El contrato definitivo se documentará mediante API/OpenAPI.

---

# 99. Validaciones de conversión

Antes de convertir deben comprobarse al menos:

```text
Quote exists
Quote belongs to Company
Quote is in convertible state
Quote has valid items
Customer is consistent
Products are valid
Quote was not already converted
User is authorized
```

---

# 100. Inventario durante conversión objetivo

No debe ejecutarse:

```text
Product.stock -= quantity
```

durante:

```text
Quote → SalesOrder
```

---

# 101. Validación de stock en Quote

Puede utilizarse para dar contexto comercial.

Pero la validación definitiva pertenece a Delivery.

Ejemplo:

```text
Quote today
stock = 20
```

no garantiza:

```text
Delivery next week
stock = 20
```

---

# 102. Integración con Sales

La frontera oficial es:

```text
Quotes
→ proposal

Sales
→ commercial commitment

Delivery
→ fulfillment
```

---

# 103. Integración con Inventory

Quotes puede consultar Inventory.

No debe modificarlo.

```text
Quotes
→ READ Inventory context
```

no:

```text
Quotes
→ WRITE stock
```

---

# 104. Integración con Billing

Invoice puede utilizar información derivada de SalesOrder y de la responsabilidad fiscal correspondiente.

Quote no debe producir factura automáticamente.

---

# 105. Importación

La importación masiva de Quotes no forma parte de las primeras prioridades del módulo Data Import.

Si posteriormente se requiere migrar historia comercial, deberá distinguirse entre:

```text
Historical Quote
```

y:

```text
Operational Quote
```

para evitar activar workflows de conversión accidentalmente.

---

# 106. Estado CURRENT

Confirmado por el modelo y documentación histórica:

```text
Quote
QuoteItem
Customer relation
Product relation
folio
subtotal
iva
total
DRAFT
CONFIRMED
CANCELLED
convertedToSale legacy flag
commercial conversion legacy flow
multi-tenant ownership
```

Las capacidades exactas de frontend, PDF y endpoints deben verificarse contra el código vigente cuando hagamos la auditoría final.

---

# 107. Estado TARGET

Arquitectura aprobada:

```text
Quote never changes stock
Quote → SalesOrder
Explicit conversion relationship
Conversion idempotency
Quote 360
Improved lifecycle UX
Audit
Granular permissions
OpenAPI
```

---

# 108. Estado FUTURE

Posibilidades posteriores:

```text
Validity / expiration
Quote versions
Sent status
Accepted / rejected
Customer signatures
Sales representative
Discount approvals
Price lists
Multiple currencies
Terms and conditions
Opportunity integration
Electronic acceptance
Customer Portal
Quote analytics
AI conversion probability
```

No representan alcance inmediato.

---

# 109. Invariantes

```text
Quote
→ belongs to one Company
```

```text
Quote Customer
→ same Company
```

```text
Quote Products
→ same Company
```

```text
Quote DRAFT
→ editable according to permissions
```

```text
Quote CONFIRMED
→ historical commercial values protected
```

```text
Quote
→ never Inventory IN
```

```text
Quote
→ never Inventory OUT
```

```text
Quote conversion target
→ SalesOrder
```

```text
Quote → SalesOrder
→ no inventory movement
```

```text
convertedToSale
→ legacy
```

---

# 110. Anti-patrones

## Inventory on Quote

```text
Confirm Quote
→ stock -= quantity
```

Incorrecto.

---

## Quote = Sale

Tratar la propuesta y el compromiso comercial como la misma entidad.

---

## Quote = Delivery

Asumir que una cotización confirmada significa que el producto fue entregado.

---

## Quote = Invoice

Utilizar Quote como documento fiscal.

---

## Current Product Price as Historical Price

Recalcular una Quote histórica utilizando el precio actual de Product.

---

## Boolean as Permanent Conversion Model

Mantener `convertedToSale` para siempre como única relación entre documentos comerciales.

---

## Cross-Tenant Quote

Utilizar Customer o Product de otra Company.

---

## Rewrite Confirmed Quote

Modificar silenciosamente una propuesta confirmada para evitar crear una revisión o nuevo documento.

---

# 111. Relación con Customers

```text
Customer
↓
Quote
```

Customer identifica a quién se realiza la propuesta.

---

# 112. Relación con Products

```text
Product
↓
QuoteItem
```

Product identifica lo ofrecido.

QuoteItem conserva el precio y cantidad de la propuesta.

---

# 113. Relación con Sales

Arquitectura objetivo:

```text
Quote
↓
SalesOrder
```

La conversión representa que una propuesta genera compromiso comercial.

---

# 114. Relación con Inventory

```text
Quote
→ puede consultar disponibilidad

Quote
→ no modifica disponibilidad física
```

---

# 115. Relación con Zaping Way

La experiencia debe permitir que el usuario pase naturalmente de:

```text
Quote 360
↓
[Convertir]
↓
SalesOrder 360
```

sin reconstruir información manualmente.

---

# 116. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-010 — Quote → Sale — SUPERSEDED.
* ADR-011 — SalesOrder y Delivery.
* ADR-012 — Entity Lifecycle.

---

# 117. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md
architecture/ARCHITECTURE.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
ux/BUSINESS_COMPONENTS.md
modules/erp/CUSTOMERS.md
modules/erp/PRODUCTS.md
modules/erp/INVENTORY.md
```

Futuro documento inmediato:

```text
modules/erp/SALES.md
```

---

# 118. Fuente de verdad

```text
QUOTES.md
→ reglas funcionales de cotizaciones

SALES.md
→ SalesOrder y Delivery

INVENTORY.md
→ existencias y movimientos

schema.prisma
→ modelo técnico vigente

backend
→ implementación CURRENT

tests
→ comportamiento validado

ADR-011
→ arquitectura comercial objetivo

PROJECT_BOARD.md
→ trabajo pendiente
```

---

# 119. Regla de transición

Mientras exista el modelo legacy:

```text
Quote
→ Sale
```

debe diferenciarse claramente:

```text
CURRENT IMPLEMENTATION
```

de:

```text
TARGET ARCHITECTURE
Quote
→ SalesOrder
→ Delivery
```

No debemos alterar la historia del proyecto ni fingir que el refactor ya ocurrió.

---

# 120. Principio final

Una cotización responde:

> **¿Qué estamos proponiendo comercialmente al cliente?**

No responde:

> ¿Qué se entregó?

ni:

> ¿Qué salió del inventario?

Por tanto:

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

InventoryMovement
↓
Physical consequence
```

> **Cotizar es proponer. Vender es comprometer. Entregar es cumplir. Inventory registra la consecuencia física.**
