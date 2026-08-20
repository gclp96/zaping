# Módulo de Ventas — Zaping ERP

**Módulo:** Sales
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** LEGACY IMPLEMENTED / TARGET REFACTOR APPROVED
**Última actualización:** 2026-08-19
**Responsable:** Zaping ERP Team

---

# 1. Propósito

El módulo Sales administra el proceso mediante el cual una intención comercial se convierte en un compromiso de venta y posteriormente en cumplimiento físico.

La arquitectura objetivo debe permitir responder:

```text
¿Qué pidió el cliente?
¿Qué cantidades se comprometieron?
¿Qué precios se acordaron?
¿Qué se ha entregado?
¿Qué falta entregar?
¿Qué inventario salió?
¿De qué operación provino?
¿Qué devoluciones existen?
```

---

# 2. Principio fundamental

Zaping distingue tres hechos:

```text
SalesOrder
=
compromiso comercial
```

```text
Delivery
=
cumplimiento físico
```

```text
InventoryMovement OUT
=
consecuencia física definitiva
```

Por tanto:

> **Confirmar una intención comercial no debe equivaler automáticamente a mover inventario.**

---

# 3. Arquitectura objetivo

La arquitectura aprobada mediante ADR-011 es:

```text
Quote
   ↓ opcional
SalesOrder
   ↓
Delivery
   ↓
Inventory OUT
```

---

# 4. Venta directa

Quote no es obligatoria.

Debe ser válido:

```text
Customer
↓
SalesOrder
↓
Delivery
```

cuando la operación comercial comienza directamente como pedido o venta.

---

# 5. Arquitectura actual legacy

La implementación histórica de Zaping utiliza:

```text
Sale
```

como entidad central.

El flujo manual documentado es:

```text
Create Sale
↓
DRAFT
├── approve
│      ↓
│   CONFIRMED
│      ↓
│   Inventory OUT
│
└── cancel
       ↓
    CANCELLED
```

---

# 6. Por qué el modelo actual es legacy

`Sale` combina actualmente responsabilidades que en la arquitectura objetivo pertenecen a conceptos diferentes.

Principalmente:

```text
Commercial Commitment
+
Physical Fulfillment
```

Esto limita escenarios como:

* entregas parciales;
* múltiples entregas;
* entrega posterior;
* envío;
* selección de lote en Delivery;
* facturación independiente;
* devoluciones físicas;
* Healthcare custody.

---

# 7. Estrategia de transición

El sistema no debe romper el modelo actual de inmediato.

La evolución será:

```text
Sale legacy
↓
documentar comportamiento actual
↓
diseñar SalesOrder
↓
diseñar Delivery
↓
definir migración
↓
implementar
↓
migrar frontend/API
↓
retirar comportamiento legacy
```

---

# 8. Responsabilidades objetivo de Sales

Sales será propietario de:

* SalesOrder;
* SalesOrderItem;
* Customer del pedido;
* cantidades comprometidas;
* precios;
* subtotal;
* impuestos;
* total;
* lifecycle comercial;
* relación con Quote;
* cantidades entregadas/pending como información derivada.

---

# 9. Responsabilidades de Delivery

Delivery será responsable de:

* cumplimiento físico;
* cantidades realmente entregadas;
* lotes;
* series;
* destino;
* responsable;
* fecha;
* confirmación;
* integración con Inventory.

Inicialmente Delivery puede permanecer dentro del dominio Sales sin perder esta separación conceptual.

---

# 10. Fuera del alcance

Sales no es propietario de:

* Product stock;
* InventoryMovement;
* InventoryBatch;
* Purchase;
* PurchaseReceipt;
* Customer master data;
* Invoice;
* Payment;
* Healthcare custody;
* Equipment lifecycle.

---

# 11. Modelo `Sale` actual

El schema vigente contiene:

```text
Sale
├── id
├── companyId
├── folio
├── customerId
├── subtotal
├── iva
├── total
├── status
├── createdAt
├── updatedAt
└── items
```

---

# 12. Modelo `SaleItem` actual

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

La definición técnica exacta permanece en `schema.prisma`.

---

# 13. Tenant

`Sale` pertenece directamente a:

```text
Company
```

mediante:

```text
companyId
```

`SaleItem` hereda actualmente su pertenencia al tenant mediante:

```text
SaleItem
↓
Sale
↓
companyId
```

No necesita necesariamente duplicar `companyId` mientras la relación sea segura.

---

# 14. Folio

Sale utiliza actualmente un folio único por Company.

Conceptualmente:

```text
id
→ UUID técnico
```

```text
folio
→ referencia empresarial
```

---

# 15. Unicidad

El schema actual contiene:

```text
@@unique([companyId, folio])
```

Esta regla debe preservarse conceptualmente para la futura SalesOrder.

---

# 16. Lifecycle legacy

La entidad Sale utiliza actualmente:

```text
DRAFT
CONFIRMED
CANCELLED
```

---

# 17. DRAFT legacy

Representa una venta manual todavía no confirmada.

Puede permitir:

* edición;
* cambio de Customer;
* modificación de items;
* modificación de cantidades;
* aprobación;
* cancelación.

---

# 18. CONFIRMED legacy

Actualmente:

```text
Sale CONFIRMED
```

representa tanto confirmación comercial como la operación que desencadena la salida de inventario.

Este comportamiento debe considerarse:

**LEGACY**

---

# 19. CANCELLED legacy

La documentación histórica permite cancelar principalmente Sales todavía en:

```text
DRAFT
```

Una Sale confirmada no debe simplemente cancelarse si ya produjo movimientos físicos.

---

# 20. Sale confirmada con efectos

Cuando:

```text
Sale
↓
CONFIRMED
↓
Inventory OUT
```

ya ocurrió, no debe permitirse:

```text
status = CANCELLED
```

sin resolver también los efectos físicos.

---

# 21. Returns como compensación

La estrategia histórica correcta para mercancía ya vendida es:

```text
Sale CONFIRMED
↓
Return
```

en lugar de eliminar o cancelar retrospectivamente la Sale.

Este principio continúa siendo válido después del refactor.

---

# 22. Lifecycle objetivo de SalesOrder

SalesOrder representará el pedido o compromiso comercial.

Un lifecycle conceptual puede incluir:

```text
DRAFT
↓
CONFIRMED
↓
PARTIALLY_DELIVERED
↓
DELIVERED
```

además de:

```text
CANCELLED
```

cuando corresponda.

---

# 23. Estados no aprobados todavía como enum

Los nombres:

```text
PARTIALLY_DELIVERED
DELIVERED
```

representan semántica funcional objetivo.

Este documento **no ordena agregarlos todavía a `DocumentStatus`**.

El diseño técnico se realizará durante el refactor.

---

# 24. Estado derivado

Cuando sea posible, el estado de fulfillment debe derivarse de las cantidades realmente entregadas.

Ejemplo:

```text
Ordered = 100
Delivered = 40
Pending = 60
```

representa una operación parcialmente cumplida.

---

# 25. SalesOrder DRAFT

Representa un pedido todavía editable.

Puede permitir:

* Customer;
* items;
* quantities;
* prices;
* terms;
* confirmación;
* cancelación.

---

# 26. SalesOrder CONFIRMED

Significa:

> Existe un compromiso comercial válido.

No significa:

> La mercancía ya salió.

---

# 27. Regla crítica

Debe cumplirse:

```text
SalesOrder CONFIRMED
→ no Inventory OUT
```

---

# 28. Delivery

`Delivery` representa qué mercancía fue efectivamente entregada.

Una SalesOrder puede producir:

```text
0..N Deliveries
```

---

# 29. Ejemplo de entrega parcial

```text
SalesOrder SO-001
100 unidades
│
├── Delivery DEL-001
│   40
│
├── Delivery DEL-002
│   30
│
└── Pending
    30
```

---

# 30. Ordered Quantity

Para una SalesOrderItem:

```text
Ordered Quantity
=
SalesOrderItem.quantity
```

---

# 31. Delivered Quantity

Conceptualmente:

```text
Delivered Quantity
=
Σ confirmed DeliveryItems
```

relacionados con la misma partida.

---

# 32. Pending Quantity

```text
Pending Quantity
=
Ordered Quantity
-
Delivered Quantity
```

---

# 33. No sobreentrega

Dentro del flujo normal:

```text
newDeliveryQuantity
<=
pendingQuantity
```

No debe permitirse:

```text
Delivered
>
Ordered
```

sin una operación excepcional explícita.

---

# 34. Validación backend

Aunque frontend muestre:

```text
Pendiente: 6
```

backend debe recalcular el valor antes de confirmar Delivery.

---

# 35. Delivery DRAFT

Puede ser útil permitir preparar una entrega antes de producir efectos físicos.

Conceptualmente:

```text
DRAFT
↓
CONFIRMED
```

---

# 36. Delivery CONFIRMED

Solo la confirmación definitiva debe producir:

```text
Inventory OUT
```

---

# 37. Regla de inventario

Correcto:

```text
Delivery CONFIRMED
↓
Inventory OUT
```

Incorrecto:

```text
SalesOrder CONFIRMED
↓
Inventory OUT
```

---

# 38. Atomicidad de Delivery

Confirmar una Delivery puede involucrar:

```text
Delivery
+
DeliveryItems
+
Batch allocations
+
InventoryMovement OUT
+
Stock update
+
SalesOrder fulfillment status
```

La operación debe mantener consistencia transaccional.

---

# 39. Idempotencia

Debe impedirse:

```text
Confirm Delivery
↓
network retry
↓
Confirm Delivery again
```

generando dos movimientos OUT.

---

# 40. Customer

Toda SalesOrder pertenece a una contraparte comercial válida.

Conceptualmente:

```text
Customer
↓
SalesOrder
```

---

# 41. Customer validation

Backend debe verificar:

```text
Customer exists
AND
Customer belongs to Company
```

y para nuevas operaciones normalmente:

```text
Customer is active
```

---

# 42. Customer histórico

Desactivar posteriormente al Customer no invalida:

* SalesOrder;
* Delivery;
* Return;
* documentos históricos.

---

# 43. Products

Cada partida comercial referencia un Product.

Backend debe validar:

```text
Product exists
AND
Product belongs to Company
```

---

# 44. Product inactivo

Un Product inactivo normalmente no debe agregarse a una nueva SalesOrder.

Pero continúa apareciendo en operaciones históricas.

---

# 45. Quantity

Actualmente `SaleItem.quantity` utiliza:

```text
Int
```

Por tanto las cantidades actuales son enteras.

Una futura estrategia de Units of Measure deberá revisarse en todo el ERP.

---

# 46. Price

El precio de una partida comercial constituye un snapshot.

Conceptualmente:

```text
Product.price
↓ initial reference
SalesOrderItem.price
↓ historical commercial value
```

---

# 47. Cambio posterior del precio

Si:

```text
Product.price = 150
```

una venta histórica realizada a:

```text
100
```

debe conservar:

```text
100
```

---

# 48. Price override

Modificar el precio puede requerir posteriormente permisos granulares.

Ejemplo futuro:

```text
sales.create
sales.price.override
```

---

# 49. Subtotal de partida

Conceptualmente:

```text
Item Subtotal
=
quantity × price
```

---

# 50. Subtotal

```text
SalesOrder Subtotal
=
Σ Item Subtotal
```

---

# 51. IVA

El modelo legacy utiliza:

```text
iva
```

y actualmente se ha utilizado 16 % en varios workflows.

Esto no debe considerarse una política fiscal universal permanente.

---

# 52. Total

Conceptualmente:

```text
total
=
subtotal
+
iva
```

según las reglas fiscales actuales.

---

# 53. Backend como autoridad

Frontend puede mostrar una previsualización.

Backend debe validar/calcular los valores definitivos.

No debe confiar en totales arbitrarios enviados desde frontend.

---

# 54. Dinero

El modelo actual de Sale utiliza:

```text
Float
```

para importes.

Antes de ampliar Billing/CFDI debe revisarse la estrategia monetaria.

Este documento no ordena modificar Prisma todavía.

---

# 55. Quote como origen

Una SalesOrder puede originarse en una Quote.

Arquitectura objetivo:

```text
Quote CONFIRMED
↓
SalesOrder
```

---

# 56. Quote opcional

También debe ser válido:

```text
SalesOrder
```

sin Quote previa.

---

# 57. Limitación actual de relación

El modelo actual no contiene una relación estructurada:

```text
Sale
→ Quote
```

En cambio, Quote conserva:

```text
convertedToSale
```

como booleano legacy.

---

# 58. Problema del booleano

Un booleano responde:

```text
¿fue convertida?
```

pero no responde:

```text
¿en qué operación?
```

La arquitectura futura debe permitir una relación explícita.

---

# 59. Relación objetivo

Debe poder navegarse:

```text
Quote
↓
SalesOrder
```

y viceversa cuando el SalesOrder provenga de Quote.

---

# 60. No diseñar FK todavía

La implementación puede utilizar posteriormente:

```text
sourceQuoteId
```

o una relación equivalente.

Este documento no define todavía el campo exacto.

---

# 61. Conversión

Convertir una Quote debe copiar de forma controlada:

* Customer;
* items;
* quantities;
* prices;
* totals;
* contexto comercial necesario.

---

# 62. Conversión no produce OUT

Debe cumplirse:

```text
Quote
↓
SalesOrder
```

sin:

```text
Inventory OUT
```

---

# 63. Conversión legacy

La implementación actual puede continuar temporalmente con:

```text
Quote
↓
Sale CONFIRMED
↓
Inventory OUT
```

mientras se realiza el refactor.

Este comportamiento es compatibilidad histórica, no arquitectura objetivo.

---

# 64. Venta manual legacy

Las ventas creadas manualmente continuarán funcionando durante la transición.

El refactor debe ofrecer un equivalente natural:

```text
Create Sale
```

actualmente

hacia:

```text
Create SalesOrder
```

en la arquitectura futura.

---

# 65. UX de venta inmediata

La separación técnica no debe obligar al usuario a realizar pasos innecesarios.

Para una venta inmediata, la interfaz puede permitir:

```text
Nueva venta
↓
Guardar y entregar
```

mientras internamente se producen:

```text
SalesOrder
+
Delivery
```

de manera controlada.

---

# 66. Principio UX

```text
Correct domain model
≠
More user friction
```

La interfaz puede simplificar el proceso sin falsear los hechos empresariales.

---

# 67. Inventario disponible

Sales puede consultar disponibilidad para ayudar al usuario.

Ejemplo:

```text
Product A
Requested: 10
Available: 6
```

---

# 68. SalesOrder no reserva automáticamente

Actualmente:

```text
SalesOrder
→ no automatic reservation
```

Reservation requerirá una decisión específica.

---

# 69. Disponibilidad en Delivery

La validación física definitiva ocurre al confirmar Delivery.

El stock pudo cambiar desde que se creó la SalesOrder.

---

# 70. Stock negativo

Delivery debe respetar la regla de Inventory:

```text
requested OUT
<=
available inventory
```

---

# 71. Lotes

Para productos trazables, Delivery debe identificar qué Batch salió.

Conceptualmente:

```text
InventoryBatch
↓
DeliveryItem
↓
Customer
```

---

# 72. FEFO

Cuando aplique, Inventory puede sugerir lotes usando FEFO.

Sales no debe implementar una segunda lógica independiente de selección de lotes.

---

# 73. Batch allocation

La arquitectura futura necesitará representar qué cantidad de cada lote fue utilizada en cada DeliveryItem.

Conceptualmente:

```text
DeliveryItem
└── Batch Allocations
    ├── Batch A × 3
    └── Batch B × 2
```

---

# 74. No crear `SaleItemBatchAllocation` legacy

La documentación histórica de Returns propone una entidad:

```text
SaleItemBatchAllocation
```

para resolver trazabilidad de devoluciones.

Con ADR-011, la asignación correcta debe diseñarse sobre:

```text
DeliveryItem
```

no sobre `SaleItem` legacy.

---

# 75. Importancia para Returns

Una devolución debe poder responder:

```text
¿Qué se entregó?
¿Qué lote salió?
¿Cuánto puede regresar?
```

Por ello Delivery se convierte en la referencia física natural para Returns.

---

# 76. Seriales

Para productos serializados, Delivery deberá registrar la unidad física concreta.

Ejemplo:

```text
DeliveryItem
↓
Serial SN-00021
```

---

# 77. Shipment

Shipment y Delivery no son necesariamente lo mismo.

Conceptualmente:

```text
SalesOrder
↓
Delivery
↓
Shipment
```

puede ser una evolución futura.

---

# 78. Delivery Address

El destino físico puede diferir de:

```text
Customer.address
```

Por tanto no debe dependerse permanentemente del Customer master para reconstruir una entrega histórica.

---

# 79. Proof of Delivery

Una evolución futura puede incluir:

* receptor;
* firma;
* fotografía;
* fecha;
* evidencia;
* ubicación.

No forma parte todavía del MVP.

---

# 80. Invoice

Arquitectónicamente:

```text
SalesOrder
≠
Delivery
≠
Invoice
```

---

# 81. Facturación antes de Delivery

Algunos procesos pueden requerir:

```text
SalesOrder
↓
Invoice
↓
Delivery
```

---

# 82. Facturación después de Delivery

Otros pueden utilizar:

```text
SalesOrder
↓
Delivery
↓
Invoice
```

El dominio Billing definirá esas reglas.

---

# 83. Invoice no mueve stock

Debe cumplirse:

```text
Invoice
→ no Inventory OUT
```

El efecto físico pertenece a Delivery.

---

# 84. Returns

Una devolución comercial debe originarse en lo efectivamente entregado.

Arquitectura objetivo:

```text
Delivery
↓
Return
```

---

# 85. Modelo legacy de Returns

Actualmente Returns ha sido diseñado alrededor de:

```text
Sale
↓
SaleItem
↓
Return
```

Esto deberá evolucionar junto con Sales.

---

# 86. Regla que permanece válida

Aunque cambie el origen técnico:

> una devolución no debe reescribir la operación original.

La historia debe conservar:

```text
Original Delivery
+
Return
```

---

# 87. Cantidad retornable

Conceptualmente:

```text
Returnable Quantity
=
Delivered Quantity
-
Confirmed Returned Quantity
```

---

# 88. No devolver lo no entregado

Una SalesOrder de 10 unidades con solo 4 entregadas no puede permitir Return de 10.

La devolución máxima está ligada al fulfillment físico.

---

# 89. Healthcare

Healthcare introduce un flujo diferente.

```text
CaseDispatch
≠
Delivery
```

---

# 90. CaseDispatch

Representa:

```text
custodia temporal
```

No una venta ni una entrega definitiva.

---

# 91. Reconciliation

Después de un Case:

```text
Used
Returned
Unresolved
```

determinan el destino del material.

---

# 92. Material utilizado

El material usado puede originar un evento comercial o fulfillment definitivo.

Conceptualmente:

```text
Case Reconciliation
↓
Used Material
↓
Sales / Delivery
↓
Inventory OUT definitivo
```

La integración exacta se diseñará con Healthcare.

---

# 93. Importante sobre Inventory

Si el material ya salió del almacén bajo custodia, el OUT definitivo de Healthcare representa:

> cambio de disposición/propiedad empresarial

y no necesariamente otro desplazamiento físico desde el almacén en ese instante.

Inventory deberá evitar descontar dos veces la misma existencia.

---

# 94. Integración Healthcare pendiente

La implementación técnica deberá diseñar cuidadosamente:

```text
Custody
→ Consumption
```

sin:

```text
Custody movement
+
second physical OUT
=
double decrement
```

ADR-013 gobierna esta separación.

---

# 95. Sale PDF legacy

La documentación histórica indica generación de PDF para Sales.

Este documento conserva esa capacidad como parte del modelo actual.

---

# 96. SalesOrder PDF futuro

El documento comercial objetivo deberá decidir si representa:

* pedido;
* confirmación;
* nota de venta;

según los workflows reales.

---

# 97. Delivery document futuro

Delivery puede requerir un documento físico diferente.

Ejemplos:

* remisión;
* nota de entrega;
* comprobante.

No debe confundirse con SalesOrder PDF.

---

# 98. CFDI futuro

Invoice/CFDI será otro documento distinto.

```text
SalesOrder PDF
≠
Delivery Document
≠
Invoice CFDI
```

---

# 99. SalesOrder 360

La experiencia objetivo incluye:

```text
SalesOrder 360
```

---

# 100. Preguntas que debe responder

```text
¿Quién compra?
¿Qué pidió?
¿Cuánto?
¿A qué precio?
¿Qué se ha entregado?
¿Qué falta?
¿Qué devoluciones existen?
¿Qué factura existe?
¿Qué actividad ocurrió?
```

---

# 101. Vista conceptual

```text
SO-000421

Customer
ABC Medical

Status
Partially Delivered

Ordered
100

Delivered
70

Pending
30

Deliveries
DEL-001   40
DEL-002   30

[Registrar entrega]
```

---

# 102. Acción contextual

Conceptualmente:

```text
DRAFT
→ Editar / Confirmar
```

```text
CONFIRMED
→ Registrar Delivery
```

```text
PARTIALLY DELIVERED
→ Entregar pendiente
```

```text
FULLY DELIVERED
→ Ver historial / Facturación
```

---

# 103. Delivery UX

Al crear una Delivery desde SalesOrder, Zaping ya conoce:

* Customer;
* Products;
* ordered quantities;
* delivered quantities;
* pending quantities.

No debe pedir nuevamente información que ya existe.

---

# 104. Formulario de Delivery

Puede mostrar:

```text
Producto
Ordenado
Entregado
Pendiente
Entregar ahora
Lote
Serie
```

cuando corresponda.

---

# 105. Selección de lote

El usuario debe trabajar únicamente con lotes elegibles.

La UI puede sugerir FEFO.

Backend debe volver a validar.

---

# 106. Confirmación de Delivery

Antes de confirmar debe quedar claro que la operación:

```text
modificará inventario
```

Ejemplo UX:

```text
Confirmar entrega

Se entregarán 6 unidades
y el inventario se actualizará.

[Volver] [Confirmar]
```

---

# 107. Feedback

Después:

```text
Entrega DEL-002 confirmada.

Entregado: 70
Pendiente: 30
```

y, cuando aporte valor:

```text
Stock actualizado.
```

---

# 108. Listado de SalesOrders

Una tabla objetivo puede priorizar:

```text
Folio
Customer
Fecha
Total
Status
Delivered
Pending
Actions
```

---

# 109. Filtros

Puede incluir:

```text
Status
Customer
Date
Pending Delivery
Search
```

---

# 110. Search

Debe permitir localizar operaciones mediante:

```text
folio
customer
```

y posteriormente otros identificadores útiles.

---

# 111. Dashboard

Dashboard podrá mostrar tareas como:

```text
SalesOrders pending delivery
Partially delivered orders
Deliveries today
```

en lugar de limitarse al total de Sales.

---

# 112. Action Dashboard

Ejemplo:

```text
2 pedidos listos para entregar
[Revisar]
```

Esto es más accionable que:

```text
Sales: 52
```

como único contexto.

---

# 113. Multi-tenancy

Toda operación comercial debe pertenecer a una Company.

Debe verificarse:

```text
SalesOrder company
Customer company
Product company
Delivery company
Inventory company
```

---

# 114. Cross-tenant Customer

Debe rechazarse:

```text
Company A SalesOrder
→ Customer Company B
```

---

# 115. Cross-tenant Product

También:

```text
Company A SalesOrder
→ Product Company B
```

---

# 116. Cross-tenant Batch

Delivery nunca debe consumir:

```text
InventoryBatch
```

de otra Company.

---

# 117. Authorization

Toda operación debe aplicar:

```text
Authentication
+
Authorization
+
Tenant Isolation
+
Validation
+
Business Rules
```

---

# 118. RBAC

Permisos conceptuales pueden incluir:

```text
sales.read
sales.create
sales.update
sales.confirm
sales.cancel

deliveries.read
deliveries.create
deliveries.confirm

sales.price.override
```

La implementación granular continúa evolucionando.

---

# 119. Cancel permission

Cancelar una operación comercial puede requerir permiso distinto de editarla.

Especialmente cuando ya existen relaciones posteriores.

---

# 120. Delivery permission

Confirmar una Delivery debe considerarse una operación sensible porque:

```text
Delivery CONFIRMED
→ Inventory OUT
```

---

# 121. Segregación futura

Una empresa puede requerir:

```text
Salesperson
→ creates SalesOrder

Warehouse
→ confirms Delivery
```

Esto permite separar:

```text
commercial authority
```

de:

```text
physical fulfillment authority
```

---

# 122. Auditoría

Eventos importantes:

```text
SalesOrder created
SalesOrder updated
SalesOrder confirmed
SalesOrder cancelled
Delivery created
Delivery confirmed
Return created
```

deberán ser auditables cuando la infraestructura correspondiente esté completa.

---

# 123. Historial

Una SalesOrder 360 debe poder evolucionar hacia un timeline:

```text
10:15  SalesOrder creada
10:40  Confirmada
14:20  Delivery DEL-001 confirmada
día 2  Delivery DEL-002 confirmada
día 5  Return RET-001
```

---

# 124. Inmutabilidad de Delivery

Una Delivery confirmada no debe editarse para reescribir:

* quantity;
* product;
* batch;
* serial;
* destination;

cuando esos campos determinan el hecho histórico.

---

# 125. Corrección de Delivery

Los errores deben resolverse mediante:

* Return;
* reversal;
* corrective operation;

según el caso.

No mediante edición histórica silenciosa.

---

# 126. SalesOrder cancelada sin Delivery

Si no existe fulfillment físico, cancelar una SalesOrder normalmente no necesita un movimiento de inventario inverso.

---

# 127. SalesOrder con Delivery

Si ya existen Deliveries, cancelar el pedido pendiente no debe borrar la historia de lo ya entregado.

Ejemplo:

```text
Ordered 10
Delivered 4
Pending 6
↓
Cancel remaining
```

Los 4 entregados siguen existiendo históricamente.

---

# 128. Modelo exacto de cancelación parcial

La semántica concreta de:

```text
cancel remaining
```

deberá diseñarse durante la implementación de SalesOrder.

No debe resolverse simplemente cambiando toda la operación a `CANCELLED`.

---

# 129. Reservation futura

SalesOrder puede eventualmente reservar inventario.

Conceptualmente:

```text
Physical
Reserved
Available
```

Pero:

```text
Reservation
≠
Inventory OUT
```

---

# 130. Allocation vs Reservation

También debe distinguirse:

```text
Reservation
→ cantidad comprometida
```

de:

```text
Batch Allocation
→ existencia física específica seleccionada
```

La estrategia se diseñará cuando sea necesaria.

---

# 131. Backorder futuro

Si una parte del pedido no puede entregarse, puede necesitarse:

```text
Backorder
```

como concepto futuro.

No se agrega todavía.

---

# 132. Shipment futuro

Logística de envío puede introducir:

```text
Carrier
Tracking Number
Ship Date
Delivery Date
```

sin cambiar la frontera principal SalesOrder / Delivery.

---

# 133. Importación histórica

Una futura migración puede incluir Sales históricas.

Debe distinguirse:

```text
Historical Sale
```

de:

```text
Operational SalesOrder
```

para evitar generar Inventory OUT nuevamente al importar datos históricos.

---

# 134. Migración de Sale actual

Antes de modificar Prisma debe determinarse:

1. cuántas Sales existen;
2. qué estados tienen;
3. qué movimientos Inventory generaron;
4. cuáles provienen de Quotes;
5. qué Returns existen;
6. cómo mapearlas a SalesOrder/Delivery;
7. cómo conservar folios;
8. cómo evitar movimientos duplicados.

---

# 135. Posible estrategia de migración

Conceptualmente, una Sale confirmada legacy podría convertirse en:

```text
Sale legacy
↓
SalesOrder
+
Delivery confirmed
```

porque históricamente representaba ambos hechos.

---

# 136. Sale DRAFT legacy

Una Sale `DRAFT` podría mapear conceptualmente a:

```text
SalesOrder DRAFT
```

sin Delivery.

---

# 137. Sale CANCELLED legacy

Una Sale `CANCELLED` podría mapearse a una operación comercial cancelada sin fulfillment, dependiendo del historial real.

---

# 138. No ejecutar esta migración todavía

Las equivalencias anteriores son hipótesis de diseño.

Antes de una migración deben validarse contra:

* datos reales;
* código;
* Returns;
* InventoryMovement;
* Quote conversion.

---

# 139. Integridad de movimientos existentes

Una migración no debe recrear:

```text
Inventory OUT
```

para Sales ya confirmadas si ese OUT ya existe históricamente.

---

# 140. Relación con Returns durante migración

Returns existentes pueden depender de:

```text
SaleItem
```

Por tanto Sales y Returns deben migrarse coordinadamente.

No debe eliminarse `SaleItem` antes de resolver esas relaciones.

---

# 141. No modificar Prisma ahora

Este documento **no autoriza todavía**:

```text
rename Sale → SalesOrder
```

ni:

```text
create Delivery
```

ni:

```text
remove Sale
```

ni:

```text
change DocumentStatus
```

La implementación llegará mediante un feature/refactor documentado.

---

# 142. API legacy

La documentación histórica confirma capacidades equivalentes a:

```text
create Sale
approve Sale
cancel Draft Sale
convert Quote
generate PDF
```

Los endpoints exactos deben verificarse contra el backend vigente antes de documentarlos como contrato actual.

---

# 143. API objetivo

Conceptualmente:

```text
GET  /sales-orders
GET  /sales-orders/:id
POST /sales-orders

POST /sales-orders/:id/confirm
POST /sales-orders/:id/cancel

POST /sales-orders/:id/deliveries
GET  /sales-orders/:id/deliveries

POST /deliveries/:id/confirm
```

Los paths finales se definirán durante implementación/OpenAPI.

---

# 144. API no debe exponer persistencia

Evitar endpoints como:

```text
POST /sales/decrement-stock
```

El consumidor debe solicitar una operación de negocio.

---

# 145. Current vs Target

## CURRENT — legacy

```text
Sale
SaleItem
DRAFT
CONFIRMED
CANCELLED
Manual Sales
Sale approval
Draft cancellation
Quote conversion
Inventory OUT on confirmed Sale
Inventory movements
Sale PDF
```

---

# 146. TARGET

```text
SalesOrder
SalesOrderItem
Delivery
DeliveryItem
Partial deliveries
Pending quantities
Delivery-based Inventory OUT
Batch allocation
Explicit Quote relationship
SalesOrder 360
Delivery history
Granular permissions
Audit
OpenAPI
```

---

# 147. FUTURE

```text
Reservations
Shipments
Backorders
Multiple addresses
Proof of Delivery
Price Lists
Discount approvals
Payment terms
Billing / CFDI
Accounts Receivable
Sales commissions
Sales representative ownership
Customer Portal
Mobile fulfillment
Advanced analytics
AI recommendations
```

---

# 148. Invariantes CURRENT que deben preservarse durante transición

```text
Sale
→ belongs to one Company
```

```text
Sale Customer
→ same Company
```

```text
Sale Products
→ same Company
```

```text
Confirmed legacy Sale
→ historical inventory effect preserved
```

```text
Confirmed legacy Sale
→ should not be silently rewritten
```

---

# 149. Invariantes TARGET

```text
SalesOrder
→ no Inventory OUT
```

```text
Delivery CONFIRMED
→ Inventory OUT
```

```text
Delivered Quantity
<=
Ordered Quantity
```

```text
Delivery inventory effects
→ atomic
```

```text
Confirmed Delivery
→ immutable historical event
```

```text
Return
→ references physical fulfillment
```

```text
Quote conversion
→ SalesOrder
```

```text
Quote conversion
→ no Inventory OUT
```

```text
CaseDispatch
≠
Delivery
```

```text
Cross-tenant commercial relation
→ forbidden
```

---

# 150. Anti-patrones

## SalesOrder directly changes stock

```text
Confirm SalesOrder
→ stock -= quantity
```

---

## Quote directly changes stock

```text
Convert Quote
→ OUT
```

en la arquitectura objetivo.

---

## Delivery without original order context

Crear entregas sin validar cantidades comprometidas cuando pertenecen a una SalesOrder.

---

## Over Delivery

```text
Ordered 10
Delivered 14
```

sin flujo excepcional.

---

## Rewrite Delivery

Cambiar cantidades históricas después de confirmar.

---

## Return against unordered quantity

Devolver más de lo realmente entregado.

---

## Lot tracking on SaleItem legacy

Construir nueva trazabilidad permanente sobre `SaleItem` cuando el modelo objetivo es DeliveryItem.

---

## Invoice changes stock

```text
Invoice
→ Inventory OUT
```

---

## Customer address as permanent delivery snapshot

Depender del dato actual de Customer para reconstruir una entrega histórica.

---

## Healthcare Dispatch as Sale

```text
CaseDispatch
→ Delivery
```

automáticamente.

---

# 151. Relación con Customers

```text
Customer
↓
SalesOrder
```

Customer identifica la contraparte comercial.

---

# 152. Relación con Quotes

```text
Quote
↓ optional conversion
SalesOrder
```

Quote conserva la propuesta histórica.

---

# 153. Relación con Products

```text
Product
↓
SalesOrderItem
↓
DeliveryItem
```

Product identifica el artículo comercial.

Inventory identifica qué existencia física se entrega.

---

# 154. Relación con Inventory

La frontera oficial es:

```text
Delivery
↓
Inventory
```

Sales no debe actualizar directamente:

```text
Product.stock
```

evitando las reglas de Inventory.

---

# 155. Relación con Returns

Arquitectura objetivo:

```text
Delivery
↓
Return
↓
Inventory disposition
```

El documento `RETURNS.md` deberá reconstruirse sobre esta frontera.

---

# 156. Relación con Billing

```text
SalesOrder
Delivery
↓
Billing context
↓
Invoice
```

La factura conserva responsabilidades propias.

---

# 157. Relación con Healthcare

Healthcare puede producir o relacionarse con operaciones comerciales sin obligar a Sales a conocer lógica clínica o de custodia.

---

# 158. Relación con Zaping Way

Sales debe sentirse como un workflow continuo:

```text
Pedido
↓
Entrega
↓
Pendiente
↓
Devolución / Facturación
```

y no como tablas desconectadas.

---

# 159. ADR relacionados

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
* ADR-013 — Inventory Custody & Case Logistics.

---

# 160. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md
architecture/ARCHITECTURE.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md

modules/erp/CUSTOMERS.md
modules/erp/PRODUCTS.md
modules/erp/QUOTES.md
modules/erp/INVENTORY.md
```

Documento inmediato relacionado:

```text
modules/erp/RETURNS.md
```

---

# 161. Fuente de verdad

```text
SALES.md
→ reglas funcionales de ventas y fulfillment

QUOTES.md
→ propuesta comercial

INVENTORY.md
→ existencia física y movimientos

RETURNS.md
→ devolución de fulfillment

ADR-011
→ separación SalesOrder / Delivery

schema.prisma
→ modelo técnico CURRENT

backend
→ comportamiento implementado

tests
→ comportamiento validado

PROJECT_BOARD.md
→ trabajo pendiente
```

---

# 162. Regla de transición

Mientras exista:

```text
Sale
```

en el código, la documentación debe identificarlo claramente como:

```text
CURRENT / LEGACY
```

y cuando se hable de:

```text
SalesOrder
Delivery
```

debe identificarse como:

```text
TARGET
```

hasta que el refactor sea implementado y validado.

---

# 163. Principio final

El dominio comercial debe reflejar hechos distintos:

```text
Quote
→ lo que proponemos

SalesOrder
→ lo que el cliente compra

Delivery
→ lo que realmente entregamos

InventoryMovement
→ la consecuencia física

Return
→ lo que posteriormente regresa
```

Por tanto:

> **Vender no significa necesariamente entregar en ese mismo momento.**

La arquitectura debe preservar esa diferencia incluso cuando la interfaz permita realizar ambos pasos de forma rápida dentro de una venta inmediata.
