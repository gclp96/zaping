# Módulo de Devoluciones — Zaping ERP

**Módulo:** Returns
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** MODELO DE DATOS IMPLEMENTADO / BACKEND PENDIENTE / EVOLUCIÓN A DELIVERY APROBADA
**Última actualización:** 2026-08-19
**Responsable:** Zaping ERP Team

---

# 1. Propósito

El módulo Returns administra las devoluciones comerciales y físicas posteriores a una venta o entrega.

Su responsabilidad principal es responder:

```text
¿Qué fue devuelto?
¿De qué operación provino?
¿Qué cantidad puede devolverse?
¿Por qué se devuelve?
¿En qué condición regresó?
¿Quién registró y confirmó la devolución?
¿Puede volver a estar disponible?
¿Qué efecto tuvo sobre Inventory?
```

Una devolución constituye un evento independiente y trazable.

No reescribe ni elimina la operación comercial original.

---

# 2. Principio fundamental

La historia original debe conservarse.

```text
Original Fulfillment
↓
Return
```

No:

```text
Original Fulfillment
↓
edit / delete
```

Por tanto:

> **Una devolución corrige o complementa la historia mediante un nuevo evento; no modifica retrospectivamente lo que ya ocurrió.**

---

# 3. Arquitectura objetivo

La arquitectura aprobada es:

```text
SalesOrder
↓
Delivery
↓
Return
↓
Inspection / Disposition
↓
Inventory
```

La referencia física natural de una devolución es aquello que realmente fue entregado.

---

# 4. Arquitectura actual de transición

El modelo actualmente diseñado e incorporado mediante RET-002/RET-003 se encuentra construido alrededor de:

```text
Sale
↓
SaleItem
↓
SaleReturn
↓
ReturnItem
```

Esto corresponde al modelo comercial legacy existente.

Por tanto:

```text
Sale / SaleItem
→ CURRENT / TRANSITIONAL
```

mientras:

```text
Delivery / DeliveryItem
→ TARGET
```

---

# 5. Estado actual del trabajo

El proyecto registra:

```text
RET-001
Diseño funcional
→ COMPLETED

RET-002
Diseño Prisma
→ COMPLETED

RET-003
Schema + migration
→ COMPLETED

RET-004
Backend
→ PENDING
```

Por tanto, el módulo Returns **no debe describirse todavía como funcionalmente completo**.

---

# 6. Importante sobre el schema de referencia

El snapshot documental de `schema.prisma` disponible para la auditoría es anterior a parte del trabajo reciente de Returns.

El estado del proyecto registra que RET-003 ya fue migrado.

Por ello:

> antes de cualquier cambio adicional en Prisma debe utilizarse el `schema.prisma` real del branch actual como fuente técnica.

No debe recrearse RET-003 únicamente porque un snapshot documental anterior no muestre los modelos.

---

# 7. Alcance

Returns debe soportar:

* devoluciones totales;
* devoluciones parciales;
* múltiples devoluciones sobre un mismo fulfillment;
* uno o varios productos;
* motivo obligatorio;
* condición por producto;
* decisión de disposición;
* reintegración cuando sea válida;
* trazabilidad de usuarios;
* historial;
* aislamiento multiempresa;
* concurrencia;
* protección contra sobredevolución;
* futura trazabilidad completa por lote y serie.

---

# 8. Fuera del alcance inicial

Returns no constituye todavía un módulo completo de:

* reembolsos;
* notas de crédito;
* CFDI;
* Accounts Receivable;
* pagos;
* warranty management;
* supplier returns;
* RMA avanzado.

Esos procesos pueden relacionarse posteriormente, pero mantienen responsabilidades propias.

---

# 9. SaleReturn

El diseño actual utiliza:

```text
SaleReturn
```

en lugar de:

```text
Return
```

como nombre del modelo Prisma.

La razón original es válida:

* `Return` es demasiado genérico;
* diferencia devolución de venta de futuras devoluciones a proveedor;
* evita ambigüedad en código.

Funcionalmente el módulo continúa llamándose:

```text
Returns
Devoluciones
```

---

# 10. Evolución futura del nombre

Cuando Sales migre completamente hacia:

```text
SalesOrder
+
Delivery
```

deberá evaluarse si:

```text
SaleReturn
```

continúa siendo un nombre adecuado.

No debe renombrarse ahora sin diseñar previamente la migración.

---

# 11. Modelo actual de SaleReturn

El diseño implementado mediante RET-002/RET-003 contempla conceptualmente:

```text
SaleReturn
├── id
├── companyId
├── saleId
├── folio
├── reason
├── status
├── createdById
├── confirmedById
├── cancelledById
├── confirmedAt
├── cancelledAt
├── createdAt
├── updatedAt
└── items
```

La definición técnica exacta debe verificarse contra el schema vigente del branch actual.

---

# 12. ReturnItem

Cada devolución contiene una o más partidas.

El diseño actual contempla:

```text
ReturnItem
├── id
├── companyId
├── returnId
├── saleItemId
├── productId
├── quantity
├── condition
├── restock
├── notes
├── createdAt
└── updatedAt
```

---

# 13. Relación actual con SaleItem

Actualmente:

```text
SaleItem
↓
ReturnItem
```

permite identificar:

* producto original;
* cantidad vendida;
* cantidad ya devuelta;
* precio histórico;
* operación origen.

---

# 14. Relación objetivo

Después del refactor comercial:

```text
DeliveryItem
↓
ReturnItem
```

debe convertirse en la referencia física principal.

Esto permitirá saber exactamente:

```text
qué se entregó
qué lote salió
qué serie salió
cuánto puede regresar
```

---

# 15. No migrar Returns independientemente de Sales

La migración:

```text
SaleItem
→
DeliveryItem
```

debe diseñarse junto con:

* Sales;
* Inventory;
* lot allocations;
* Returns;
* datos existentes.

No debe modificarse Returns aisladamente.

---

# 16. ReturnStatus

Returns utiliza un lifecycle propio:

```text
DRAFT
CONFIRMED
CANCELLED
```

mediante:

```text
ReturnStatus
```

---

# 17. Enum independiente

La decisión de no reutilizar:

```text
DocumentStatus
```

es correcta.

Aunque actualmente tengan estados similares:

```text
DRAFT
CONFIRMED
CANCELLED
```

Returns puede evolucionar de manera independiente.

---

# 18. DRAFT

Toda nueva devolución comienza como:

```text
DRAFT
```

Crear el borrador:

* no modifica inventario;
* no genera InventoryMovement;
* no cambia la operación original;
* no aumenta cantidades definitivamente devueltas.

---

# 19. CONFIRMED

La transición:

```text
DRAFT
↓
CONFIRMED
```

representa la aceptación definitiva del Return.

Solo entonces pueden producirse efectos físicos permanentes.

---

# 20. CANCELLED

Una devolución borrador puede cancelarse:

```text
DRAFT
↓
CANCELLED
```

Cancelar un Draft:

* no modifica Inventory;
* no genera movimiento;
* no modifica la operación original.

---

# 21. Return confirmado no se cancela directamente

Debe cumplirse:

```text
CONFIRMED
↛
CANCELLED
```

como edición simple.

Si una devolución confirmada fue incorrecta deberá existir una operación compensatoria trazable.

---

# 22. Lifecycle

```text
             ┌──────→ CANCELLED
             │
DRAFT ───────┤
             │
             └──────→ CONFIRMED
                         ↓
                  physical effects
```

---

# 23. Lifecycle histórico

Una devolución confirmada forma parte de la historia empresarial.

No debe eliminarse físicamente como operación habitual.

---

# 24. Origen CURRENT

Mientras continúe el modelo legacy, solo puede crearse una devolución válida cuando:

```text
Sale exists
AND
Sale belongs to Company
AND
Sale.status = CONFIRMED
```

---

# 25. Origen TARGET

Después del refactor:

```text
Delivery exists
AND
Delivery belongs to Company
AND
Delivery is confirmed
```

debe ser la condición física principal.

---

# 26. Por qué Delivery es mejor origen

SalesOrder representa:

```text
lo comprometido
```

Delivery representa:

```text
lo realmente entregado
```

Solo puede devolverse físicamente lo que realmente salió.

---

# 27. Ejemplo

```text
SalesOrder
10 unidades

Delivery 1
4 unidades

Pending
6 unidades
```

La cantidad máxima físicamente retornable es:

```text
4
```

no:

```text
10
```

---

# 28. ReturnItemCondition

El diseño actual utiliza:

```text
SELLABLE
DAMAGED
EXPIRED
OPENED
OTHER
```

---

# 29. SELLABLE

Representa producto que potencialmente puede reintegrarse a disponibilidad.

Puede permitir:

```text
restock = true
```

si las demás reglas de trazabilidad y condición lo permiten.

---

# 30. DAMAGED

Representa producto dañado.

Regla conservadora:

```text
restock = false
```

para inventario disponible.

---

# 31. EXPIRED

Representa producto vencido.

Debe cumplirse:

```text
restock = false
```

para disponibilidad normal.

---

# 32. OPENED

Representa producto abierto o con empaque comprometido.

En Healthcare y suministros sensibles:

> no debe asumirse automáticamente que puede volver a venderse o utilizarse.

La política puede evolucionar según:

* tipo de producto;
* regulación;
* proceso sanitario;
* política empresarial.

---

# 33. OTHER

Representa una condición no cubierta.

Debe acompañarse de contexto suficiente mediante:

```text
notes
```

cuando corresponda.

---

# 34. Condition no equivale a disposición

La condición describe:

```text
cómo regresó
```

mientras la disposición describe:

```text
qué ocurrirá con esa existencia
```

Estos conceptos deben permanecer diferenciados.

---

# 35. `restock`

El diseño actual utiliza:

```text
restock Boolean
```

con default:

```text
false
```

La decisión conservadora por defecto es correcta.

---

# 36. Regla actual

```text
restock = true
```

significa:

> el producto debe reintegrarse al inventario disponible.

```text
restock = false
```

significa:

> la devolución queda registrada, pero no aumenta disponibilidad.

---

# 37. Combinaciones inválidas

El backend debe rechazar como mínimo:

```text
DAMAGED
+
restock = true
```

y:

```text
EXPIRED
+
restock = true
```

en el modelo actual.

---

# 38. SELLABLE + restock

Puede ser válido:

```text
SELLABLE
+
restock = true
```

solo si la trazabilidad necesaria puede demostrarse.

---

# 39. OPENED + restock

No debe considerarse automáticamente válido.

La decisión deberá seguir políticas específicas cuando se formalicen.

---

# 40. Evolución de `restock`

El booleano es suficiente para la primera versión, pero puede resultar demasiado limitado conforme Inventory incorpore estados como:

```text
AVAILABLE
QUARANTINE
DAMAGED
SCRAP
MAINTENANCE
```

---

# 41. Disposition futura

Una evolución más expresiva puede utilizar conceptualmente:

```text
Return Disposition

RESTOCK
QUARANTINE
SCRAP
REPAIR
OTHER
```

Este documento no ordena todavía introducir ese enum.

---

# 42. Regla de cantidad

La cantidad devuelta nunca puede superar la cantidad disponible para devolución.

---

# 43. Modelo CURRENT de cantidad

Con SaleItem:

```text
Returnable
=
SaleItem.quantity
-
confirmed returned quantity
```

---

# 44. `returnedQuantity`

RET-002 diseñó:

```text
SaleItem.returnedQuantity
```

como proyección operacional.

Conceptualmente:

```text
quantity = 10
returnedQuantity = 4
availableToReturn = 6
```

---

# 45. Historial vs proyección

La estrategia diseñada es:

```text
ReturnItem confirmed
→ historical evidence
```

y:

```text
SaleItem.returnedQuantity
→ operational projection
```

---

# 46. Invariante CURRENT

Debe cumplirse conceptualmente:

```text
SaleItem.returnedQuantity
=
SUM(
  confirmed ReturnItem quantities
)
```

para esa partida.

---

# 47. Evolución TARGET

Cuando Returns migre a Delivery:

```text
DeliveryItem.returnedQuantity
```

podría ser una proyección equivalente.

Sin embargo, no debe añadirse ese campo automáticamente sin revisar la estrategia completa.

---

# 48. Fuente derivada alternativa

También puede evaluarse si la cantidad retornada debe calcularse mediante:

```text
SUM(ReturnItem.quantity)
```

en lugar de almacenarse como proyección.

La decisión debe balancear:

* concurrencia;
* performance;
* complejidad;
* consistencia.

RET-002 eligió la proyección explícita para el modelo actual.

---

# 49. Devoluciones parciales

Debe soportarse:

```text
Delivered / Sold: 10

Return 1: 3
Return 2: 2

Remaining returnable: 5
```

---

# 50. Múltiples Returns

Una misma operación puede tener:

```text
1..N Returns
```

mientras exista cantidad físicamente retornable.

---

# 51. DRAFT no consume cantidad

Una devolución `DRAFT` no debe reducir definitivamente la cantidad retornable.

---

# 52. CANCELLED no consume cantidad

Una devolución `CANCELLED` tampoco debe afectar:

```text
returnedQuantity
```

ni la cantidad disponible.

---

# 53. CONFIRMED consume cantidad

Solo:

```text
Return CONFIRMED
```

debe contabilizarse como devolución efectiva.

---

# 54. Items duplicados

Dentro de una misma devolución no debe repetirse la misma partida origen.

El diseño actual utiliza:

```text
@@unique([returnId, saleItemId])
```

---

# 55. Ejemplo inválido

```text
Return DEV-001

SaleItem A → 2
SaleItem A → 1
```

Debe consolidarse como:

```text
SaleItem A → 3
```

---

# 56. TARGET de unicidad

Después de migrar a Delivery deberá existir una regla equivalente para la referencia física seleccionada.

La estructura exacta dependerá del diseño de `DeliveryItem` y lot allocation.

---

# 57. Product

`ReturnItem.productId` se conserva actualmente explícitamente.

Esto facilita:

* consultas;
* integración Inventory;
* índices;
* trazabilidad.

---

# 58. Product no es autoridad única

Backend debe comprobar actualmente:

```text
ReturnItem.productId
=
SaleItem.productId
```

No debe confiar únicamente en `productId` enviado por frontend.

---

# 59. TARGET

En el modelo futuro deberá validarse:

```text
ReturnItem product
=
DeliveryItem product
```

---

# 60. Reason

Toda devolución debe incluir:

```text
reason
```

obligatorio.

---

# 61. Ejemplos de motivo

```text
Producto incorrecto
Producto dañado
Producto defectuoso
Caducidad
Error de surtido
Rechazo del cliente
Otro
```

---

# 62. Reason inicial

La primera versión utiliza texto.

Esto permite implementar el módulo sin introducir inmediatamente un catálogo adicional.

---

# 63. Return Reasons futuro

Cuando existan suficientes patrones reales puede evolucionarse hacia un catálogo configurable.

Ejemplo:

```text
ReturnReason
├── code
├── name
├── isActive
└── requiresNotes
```

No debe implementarse antes de demostrar necesidad.

---

# 64. Folio

La devolución utiliza un folio empresarial.

Ejemplo:

```text
DEV-000001
```

---

# 65. Folio vs UUID

```text
id
→ UUID técnico

folio
→ identificador empresarial
```

---

# 66. Unicidad del folio

El diseño establece:

```text
unique(companyId, folio)
```

---

# 67. Generación de folio

No debe confiarse exclusivamente en:

```text
Date.now()
```

como garantía de unicidad.

La base de datos debe continuar proporcionando protección final contra colisiones.

---

# 68. Auditoría de usuarios

El modelo actual diferencia:

```text
createdById
confirmedById
cancelledById
```

---

# 69. `createdById`

Representa:

> quién registró inicialmente la devolución.

Debe derivarse del usuario autenticado.

---

# 70. `confirmedById`

Representa:

> quién confirmó y autorizó los efectos definitivos.

Puede diferir de quien creó el Draft.

---

# 71. `cancelledById`

Representa:

> quién canceló una devolución todavía en borrador.

---

# 72. No confiar en frontend

Los IDs de auditoría no deben aceptarse libremente como autoridad desde frontend.

La identidad debe provenir de:

```text
JWT
↓
Authenticated User
```

---

# 73. Fechas de transición

El diseño actual contiene:

```text
confirmedAt
cancelledAt
```

además de:

```text
createdAt
updatedAt
```

---

# 74. Invariantes temporales

Para `DRAFT`:

```text
confirmedAt = null
cancelledAt = null
```

Para `CONFIRMED`:

```text
confirmedAt != null
cancelledAt = null
```

Para `CANCELLED`:

```text
confirmedAt = null
cancelledAt != null
```

El Service debe proteger estas combinaciones.

---

# 75. Inventario

Crear un Return:

```text
DRAFT
```

no modifica Inventory.

---

# 76. Confirmación e Inventory

Solo al confirmar pueden aplicarse efectos.

En el modelo inicial:

```text
Return CONFIRMED
+
restock = true
↓
Inventory IN
```

---

# 77. InventoryMovement

Conceptualmente:

```text
movementType = IN
referenceType = RETURN
referenceId = return.id
```

cuando existe reintegración válida.

---

# 78. `restock = false`

Si la mercancía no vuelve a disponibilidad:

```text
Return CONFIRMED
↓
No available-stock IN
```

aunque el Return sí permanece registrado históricamente.

---

# 79. Inventario físico vs disponible

La arquitectura futura debe reconocer que un artículo retornado puede:

```text
haber regresado físicamente
```

sin:

```text
estar disponible para venta
```

---

# 80. Ejemplo futuro

```text
Return arrives
↓
Physical custody recovered
↓
Inspection
↓
Quarantine
↓
Approved
↓
Available
```

Esto es más preciso que asumir:

```text
Return confirmed
=
Available immediately
```

para todos los productos.

---

# 81. Inspection

La arquitectura objetivo introduce explícitamente la posibilidad de:

```text
Return
↓
Inspection
↓
Disposition
```

especialmente importante para:

* Healthcare;
* productos abiertos;
* equipo;
* productos dañados;
* productos con caducidad.

---

# 82. Estado de Inspection

Inspection es una capacidad TARGET.

El modelo actual `restock` representa una primera simplificación.

No debe afirmarse que existe un módulo de inspección implementado actualmente.

---

# 83. Atomicidad CURRENT

Confirmar un Return con efecto de inventario debe ser atómico.

Conceptualmente:

```text
validate Return
+
validate origin
+
validate quantities
+
update returned quantity
+
update stock
+
create InventoryMovement
+
set CONFIRMED
+
audit user/date
```

debe completarse o revertirse como una sola operación.

---

# 84. Rollback

No debe existir:

```text
Return = CONFIRMED
✓

Inventory IN
✗
```

ni:

```text
Inventory IN
✓

Return = DRAFT
✗
```

---

# 85. Concurrencia

Returns debe proteger contra dos confirmaciones simultáneas que excedan la cantidad permitida.

---

# 86. Ejemplo

```text
Available to return: 5

Return A: 4
Return B: 4
```

Solo una combinación válida puede confirmarse.

No pueden terminar:

```text
8 returned
```

sobre:

```text
5 available
```

---

# 87. Protección de `returnedQuantity`

RET-002 define una actualización condicional equivalente a:

```text
WHERE
returnedQuantity <= quantity - requestedReturn
```

antes de incrementar la proyección.

---

# 88. Doble confirmación

También debe impedirse:

```text
Confirm same Return
↓
request retry
↓
Confirm again
```

produciendo dos movimientos de inventario.

---

# 89. Confirmar vs cancelar

Una operación concurrente de:

```text
confirm
```

y:

```text
cancel
```

sobre el mismo Draft no puede ganar simultáneamente.

---

# 90. Condición de transición

La actualización crítica debe exigir conceptualmente:

```text
return.id = requestedId
AND
companyId = authenticatedCompany
AND
status = DRAFT
```

---

# 91. Multi-tenancy

`SaleReturn` y `ReturnItem` contienen explícitamente:

```text
companyId
```

en el diseño actual.

---

# 92. Cadena de tenant CURRENT

Debe cumplirse:

```text
SaleReturn.companyId
=
Sale.companyId
```

y:

```text
ReturnItem.companyId
=
SaleReturn.companyId
=
Sale.companyId
=
Product.companyId
```

---

# 93. SaleItem sin companyId

El diseño original decidió correctamente no agregar `companyId` a `SaleItem` únicamente para Returns.

Su tenant se valida mediante:

```text
SaleItem
↓
Sale
↓
companyId
```

Esto sigue ADR-001.

---

# 94. TARGET multi-tenant

La misma regla deberá mantenerse con:

```text
DeliveryItem
↓
Delivery / SalesOrder
↓
Company
```

según la estructura final.

---

# 95. Lotes

La trazabilidad por lote es crítica para devoluciones de productos médicos.

Debe aplicarse una regla estricta:

> **Nunca reintegrar un Return a un lote que el backend no pueda demostrar que participó en la entrega original.**

---

# 96. Limitación CURRENT

Inventory conoce lotes recibidos mediante:

```text
InventoryBatch
```

pero el modelo Sale legacy no registra de forma suficientemente estructurada qué Batch salió en cada SaleItem.

---

# 97. Consecuencia

No es seguro realizar:

```text
ReturnItem
↓
user types lot L001
↓
InventoryBatch L001 += quantity
```

simplemente porque el lote exista.

---

# 98. Trazabilidad no puede suponerse

Incorrecto:

```text
Product matches
+
Lot exists
=
must be original lot
```

La relación debe demostrarse.

---

# 99. Diseño legacy descartado como target

La documentación histórica proponía:

```text
SaleItem
↓
SaleItemBatchAllocation
↓
InventoryBatch
```

Esto resolvía correctamente la necesidad de trazabilidad dentro del modelo Sale.

Sin embargo, ADR-011 reemplaza esa frontera como arquitectura futura.

---

# 100. Arquitectura de lotes TARGET

La dirección correcta es:

```text
InventoryBatch
↓
Delivery allocation
↓
DeliveryItem
↓
ReturnItem
```

---

# 101. Ejemplo

```text
Delivery DEL-001
Product A × 5

Batch L001 × 3
Batch L002 × 2
```

Posteriormente:

```text
Return RET-001
Product A × 2

Original Batch L001 × 1
Original Batch L002 × 1
```

La trazabilidad puede demostrarse exactamente.

---

# 102. No crear SaleItemBatchAllocation nuevo

A partir de este documento:

> **No debe implementarse nueva infraestructura permanente basada en `SaleItemBatchAllocation`.**

Si aún no existe, debe omitirse.

Si ya existe parcialmente, deberá evaluarse durante la migración comercial.

---

# 103. Batch Return Quantity

La cantidad devuelta por Batch tampoco puede superar la cantidad originalmente entregada de ese Batch menos devoluciones previas.

---

# 104. Caducidad

Al retornar un lote debe preservarse su:

```text
expirationDate
```

original.

No debe crearse una nueva fecha de caducidad durante Return.

---

# 105. Lote vencido

Un lote vencido puede regresar físicamente.

Eso no significa:

```text
restock available = true
```

---

# 106. Batch inexistente

Returns no debe inventar un InventoryBatch solamente para poder reintegrar una devolución si no puede demostrar la relación histórica.

Debe existir una ruta de excepción/inspección apropiada.

---

# 107. Seriales

La misma regla aplica a productos serializados.

Una devolución debe identificar exactamente la unidad entregada.

Conceptualmente:

```text
Delivery
↓
Serial SN-001
↓
Return
↓
Serial SN-001
```

---

# 108. Product tracking configuration

El diseño histórico de RET-002 propuso un concepto como:

```text
InventoryTrackingMode
NONE
LOT
SERIAL
```

para Product.

La necesidad sigue siendo válida.

Pero el nombre y estructura exactos no están aprobados como schema en este documento.

---

# 109. No inferir tracking por existencia de Batch

Debe evitarse:

```text
Product has InventoryBatch rows
↓
therefore Product requires lot
```

como única regla.

El tracking debe convertirse posteriormente en configuración explícita.

---

# 110. Cost

Cuando un Return genera Inventory IN, no debería utilizar ciegamente:

```text
Product.cost actual
```

si existe información histórica del costo de la salida original.

---

# 111. Costo objetivo

Idealmente debe conservarse/restaurarse un costo trazable al fulfillment original.

Conceptualmente:

```text
Delivery InventoryMovement OUT
↓
historical unit cost
↓
Return InventoryMovement IN
```

según la política financiera definida.

---

# 112. Limitación CURRENT de costo

El diseño legacy proponía buscar:

```text
InventoryMovement
referenceType = SALE
referenceId = saleId
```

para recuperar el costo.

Esta estrategia pertenece al modelo actual y deberá evolucionar hacia Delivery.

---

# 113. Política contable

El tratamiento contable completo de una devolución requiere decisiones adicionales sobre:

* COGS;
* valoración;
* notas de crédito;
* impuestos;
* períodos.

Returns no debe inventar esas reglas antes de Billing/Accounting.

---

# 114. Return comercial vs reembolso

Debe distinguirse:

```text
Product Return
```

de:

```text
Money Refund
```

Puede existir uno sin que el otro ocurra inmediatamente.

---

# 115. Return vs Credit Note

También:

```text
Return
≠
Credit Note
```

Una devolución física puede originar posteriormente una nota de crédito.

Son eventos diferentes.

---

# 116. Datos financieros fuera del modelo inicial

El diseño RET-002 decidió correctamente no agregar en primera versión:

```text
refundAmount
subtotal
iva
total
creditNoteId
paymentRefundId
```

---

# 117. Supplier Returns

Una devolución a proveedor es otra operación.

Debe distinguirse:

```text
Customer Return
```

de:

```text
Supplier Return
```

---

# 118. Supplier Return futuro

Conceptualmente:

```text
Inventory
↓
Supplier Return
↓
Inventory OUT
```

con relación a:

* Supplier;
* PurchaseReceipt;
* Batch;

cuando sea posible.

No debe reutilizarse `SaleReturn` para esa operación.

---

# 119. Healthcare

Healthcare también tiene retornos físicos, pero:

```text
CaseReturn
≠
Customer Return
```

---

# 120. CaseReturn

En Healthcare:

```text
CaseDispatch
↓
CaseReturn
```

representa el regreso de material que permanecía bajo propiedad/custodia de la Company.

No representa necesariamente una devolución comercial.

---

# 121. Ejemplo Healthcare

```text
CaseKit
10 unidades
↓
Dispatch
↓
Procedure

Used       3
Returned   7
```

Las 7 retornadas:

```text
CaseReturn
```

no son `SaleReturn` porque nunca fueron vendidas.

---

# 122. Material consumido

Las 3 utilizadas pueden posteriormente participar en:

```text
Sales / Delivery
```

según la integración Healthcare aprobada.

---

# 123. Separación importante

```text
Customer Return
→ después de fulfillment comercial
```

```text
Case Return
→ después de custody temporal
```

No deben mezclarse.

---

# 124. UI futura de Returns

La experiencia debe partir del fulfillment original.

Ejemplo:

```text
Delivery DEL-001

Product A
Delivered: 10
Previously returned: 3
Returnable: 7

[Registrar devolución]
```

---

# 125. No recapturar contexto

Al iniciar Return desde Delivery, Zaping ya conoce:

* Customer;
* SalesOrder;
* Delivery;
* Product;
* delivered quantity;
* previous returns;
* lot/serial cuando exista.

No debe pedir al usuario reconstruir esos datos.

---

# 126. Formulario de Return

Conceptualmente debe mostrar:

```text
Producto
Entregado
Devuelto anteriormente
Disponible para devolver
Cantidad
Condición
Disposición / Restock
Notas
```

---

# 127. Lotes en UI

Cuando exista trazabilidad:

```text
Producto A
Lote L001
Entregado: 3
Devuelto: 1
Disponible: 2
```

debe ser más importante que pedir un lote manual sin contexto.

---

# 128. Confirmation UX

Al confirmar debe quedar clara la consecuencia.

Ejemplo:

```text
Confirmar devolución

2 unidades serán registradas como devueltas.
1 regresará a inventario disponible.
1 permanecerá fuera de disponibilidad.

[Volver] [Confirmar]
```

---

# 129. Success feedback

Después:

```text
Devolución DEV-001 confirmada.

2 unidades devueltas.
1 reintegrada a inventario.
```

---

# 130. Return 360

Una devolución puede utilizar una vista contextual que responda:

```text
¿De dónde provino?
¿Por qué ocurrió?
¿Qué regresó?
¿En qué condición?
¿Qué efecto produjo?
¿Quién la procesó?
```

---

# 131. SalesOrder 360

SalesOrder 360 debe mostrar Returns relacionados mediante sus Deliveries.

Ejemplo:

```text
SalesOrder SO-001
├── DEL-001
│   └── RET-001
└── DEL-002
```

---

# 132. Product 360

Product 360 podrá incluir:

```text
Returns
```

como historial relacionado.

Products no se convierte por ello en propietario del módulo.

---

# 133. Customer 360

Customer 360 también puede mostrar:

```text
Recent Returns
Return rate
```

cuando exista suficiente información.

---

# 134. Métricas futuras

Returns puede alimentar:

```text
Return rate
Returns by Product
Returns by Customer
Returns by reason
Returns by condition
```

---

# 135. Calidad y producto

Un volumen elevado de Returns puede revelar:

* errores de surtido;
* problemas de producto;
* problemas de proveedor;
* errores comerciales;
* problemas logísticos.

La analítica debe derivarse de datos reales.

---

# 136. No inferir causa automáticamente

No debe asumirse:

```text
DAMAGED
→ Supplier fault
```

sin evidencia.

La condición y el motivo representan conceptos distintos.

---

# 137. Multi-tenancy de usuario

Los usuarios que:

* crean;
* confirman;
* cancelan;

deben pertenecer al contexto autorizado de la Company.

---

# 138. RBAC

Permisos futuros pueden incluir:

```text
returns.read
returns.create
returns.confirm
returns.cancel
returns.restock
```

---

# 139. Separar create y confirm

Una Company puede necesitar:

```text
Sales / Support
→ create Return
```

y:

```text
Warehouse / Supervisor
→ inspect and confirm
```

La arquitectura del lifecycle permite esa separación.

---

# 140. `returns.restock`

Reintegrar inventario puede considerarse una capacidad sensible.

No debe concederse necesariamente a cualquier usuario que pueda registrar una devolución.

---

# 141. Backend pendiente

RET-004 debe implementar las reglas críticas del módulo antes de considerarlo operativo.

Como mínimo:

```text
create
read
confirm
cancel
quantity validation
tenant validation
condition/restock validation
concurrency
inventory integration
audit identity
```

---

# 142. Orden recomendado de implementación

Dado que SalesOrder/Delivery todavía es TARGET, RET-004 debe evitar profundizar innecesariamente dependencias legacy.

La implementación debe distinguir entre:

```text
funcionalidad necesaria para hacer Returns utilizable
```

y:

```text
infraestructura que pronto será reemplazada por Delivery
```

---

# 143. Decisión práctica para RET-004

Mientras Sales siga utilizando `Sale`, puede implementarse Returns sobre:

```text
Sale / SaleItem
```

si es necesario para completar el Core.

Pero debe:

* aislar la lógica de origen;
* evitar `SaleItemBatchAllocation` nuevo;
* mantener servicios cohesionados;
* preparar una migración posterior a Delivery.

---

# 144. No bloquear el Core indefinidamente

El futuro modelo de Sales no debe utilizarse como excusa para dejar Returns permanentemente incompleto.

Debe implementarse una versión coherente sobre el modelo actual si Returns es necesario antes del refactor completo.

---

# 145. Pero evitar deuda nueva innecesaria

No debe construirse ahora una arquitectura extensa alrededor de:

```text
SaleItem
```

si esa arquitectura ya fue formalmente sustituida por ADR-011.

---

# 146. API CURRENT prevista

El backend pendiente necesitará capacidades conceptuales como:

```text
GET  /returns
GET  /returns/:id
POST /returns
POST /returns/:id/confirm
POST /returns/:id/cancel
```

Los endpoints finales deben seguir `API_GUIDELINES.md`.

---

# 147. Consulta por origen

También será útil una consulta equivalente a:

```text
GET returns for Sale
```

CURRENT

y posteriormente:

```text
GET returns for Delivery
```

TARGET.

---

# 148. No usar DELETE

Returns forma parte de la historia.

No debe diseñarse:

```text
DELETE /returns/:id
```

como operación empresarial normal.

---

# 149. API TARGET

Después de Sales refactor puede evaluarse:

```text
POST /deliveries/:deliveryId/returns
```

o una estructura equivalente.

No se requiere decidir ahora el path definitivo.

---

# 150. Idempotencia

Confirmar un Return es una operación crítica.

La implementación inicial debe proteger la transición mediante estado/transacción.

Una futura Public API puede añadir mecanismos adicionales de idempotencia.

---

# 151. Tests necesarios

RET-004 debe incluir pruebas para al menos:

```text
create Draft
confirm valid Return
cancel Draft
reject Return from wrong tenant
reject invalid Sale state
reject invalid SaleItem
reject Product mismatch
reject zero quantity
reject quantity above returnable
reject duplicate item
reject invalid condition/restock
create Inventory IN when restock
no Inventory IN when not restock
prevent double confirmation
prevent concurrent over-return
```

---

# 152. Tests transaccionales

Debe verificarse que ante un error durante confirmación:

```text
Return
returnedQuantity
Product.stock
InventoryMovement
```

permanezcan consistentes.

---

# 153. Tests de invariancia

La suite debe verificar:

```text
returnedQuantity
=
confirmed ReturnItems
```

para el modelo actual.

---

# 154. Tests TARGET futuros

Cuando exista Delivery:

```text
return quantity
<=
delivered quantity - previous confirmed returns
```

debe convertirse en la invariancia física principal.

---

# 155. Estado CURRENT

Actualmente aprobado/realizado:

```text
Functional design
SaleReturn data model
ReturnItem data model
ReturnStatus
ReturnItemCondition
User audit relationships
returnedQuantity design
companyId isolation
folio uniqueness
restock model
Prisma migration
```

---

# 156. CURRENT pendiente

```text
Backend service
Controllers / API
Business validations
Inventory integration
Concurrency implementation
Frontend
Integration tests
Operational QA
```

El Project Board es la fuente principal para el estado puntual del trabajo.

---

# 157. TARGET

Arquitectura aprobada:

```text
Return based on Delivery
DeliveryItem traceability
Batch-aware returns
Serial-aware returns
Inspection
Disposition
Atomic Inventory integration
Return 360
SalesOrder 360 integration
Granular permissions
Audit
OpenAPI
```

---

# 158. FUTURE

Capacidades posteriores:

```text
Return Reasons catalog
RMA
Customer Return Portal
Credit Notes
Refunds
Warranty
Return labels
Carrier integration
Return analytics
Supplier quality feedback
AI anomaly detection
```

---

# 159. Invariantes CURRENT

```text
SaleReturn
→ belongs to one Company
```

```text
Return DRAFT
→ no Inventory change
```

```text
Return CONFIRMED
→ immutable historical event
```

```text
Return CANCELLED
→ no Inventory change
```

```text
Return quantity
<=
sold quantity - previous confirmed returns
```

```text
ReturnItem Product
=
origin SaleItem Product
```

```text
DAMAGED + restock true
→ invalid
```

```text
EXPIRED + restock true
→ invalid
```

```text
Inventory IN
→ only when valid restock occurs
```

---

# 160. Invariantes TARGET

```text
Return
→ references physical Delivery
```

```text
Return quantity
<=
delivered - previously returned
```

```text
Batch returned
→ must have been delivered
```

```text
Serial returned
→ must have been delivered
```

```text
Physical return
≠
automatically sellable
```

```text
Confirmed Return
→ immutable
```

```text
Return inventory effects
→ atomic
```

```text
Customer Return
≠
CaseReturn
```

```text
Customer Return
≠
Supplier Return
```

---

# 161. Anti-patrones

## Cancel original sale to represent Return

```text
Sale CONFIRMED
↓
CANCELLED
```

después de fulfillment físico.

---

## Rewrite original quantity

Cambiar una venta/Delivery histórica de:

```text
10
```

a:

```text
7
```

para representar que regresaron 3.

---

## Return against SalesOrder quantity

Permitir devolver mercancía que nunca fue entregada.

---

## Blind Restock

```text
Return
→ Product.stock += quantity
```

sin validar condición ni trazabilidad.

---

## Guess Batch

Seleccionar un lote únicamente porque pertenece al mismo Product.

---

## New SaleItemBatchAllocation architecture

Invertir nuevo trabajo importante en la frontera legacy cuando Delivery será la frontera definitiva.

---

## Financial assumptions

Asumir que Return automáticamente genera:

* reembolso;
* nota de crédito;
* CFDI;
* pago inverso.

---

## Delete Return history

Eliminar físicamente un Return confirmado.

---

## Cross-Tenant Return

Relacionar Sale, Product, Return o User de Companies diferentes.

---

## Customer Return = CaseReturn

Utilizar el mismo evento para dos procesos con semántica diferente.

---

# 162. Relación con Sales

CURRENT:

```text
Sale
↓
SaleReturn
```

TARGET:

```text
SalesOrder
↓
Delivery
↓
Return
```

`SALES.md` gobierna la transición.

---

# 163. Relación con Inventory

Returns determina:

```text
qué regresó
+
qué disposición se autorizó
```

Inventory determina:

```text
cómo se representa físicamente
```

---

# 164. Relación con Products

Product identifica el artículo.

Returns no modifica los datos maestros del Product.

---

# 165. Relación con Customers

Customer permite identificar la contraparte comercial del fulfillment original.

Returns no debe duplicar el Customer si puede derivarse correctamente de la operación origen.

---

# 166. Relación con Healthcare

```text
SaleReturn
→ customer/commercial return

CaseReturn
→ custody return
```

La vertical Healthcare tendrá su propio workflow.

---

# 167. Relación con Billing

Returns puede convertirse posteriormente en un evento relevante para:

```text
Credit Note
Refund
Accounts Receivable
```

pero Billing conserva la responsabilidad financiera.

---

# 168. Relación con Zaping Way

Returns debe sentirse como continuación natural del fulfillment original:

```text
Delivery 360
↓
[Registrar devolución]
↓
Return
↓
Inspection / Disposition
↓
resultado visible
```

No como un formulario aislado que obliga a buscar manualmente IDs y cantidades.

---

# 169. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-011 — SalesOrder y Delivery.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 170. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md

architecture/ARCHITECTURE.md

engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md

modules/erp/CUSTOMERS.md
modules/erp/PRODUCTS.md
modules/erp/SALES.md
modules/erp/INVENTORY.md
```

---

# 171. Fuente de verdad

```text
RETURNS.md
→ reglas funcionales de devoluciones

SALES.md
→ fulfillment comercial

INVENTORY.md
→ existencia física y movimientos

ADR-011
→ SalesOrder / Delivery

ADR-013
→ Healthcare custody

schema.prisma real del branch
→ modelo técnico vigente

backend
→ implementación disponible

tests
→ comportamiento validado

PROJECT_BOARD.md
→ estado actual del trabajo
```

---

# 172. Regla de transición

Mientras Returns dependa de:

```text
Sale
SaleItem
```

debe identificarse como:

```text
CURRENT / TRANSITIONAL
```

Cuando dependa de:

```text
Delivery
DeliveryItem
```

podrá considerarse alineado con:

```text
TARGET ARCHITECTURE
```

---

# 173. Principio final

Una devolución debe preservar tres verdades diferentes:

```text
¿Qué fue entregado?
↓
¿Qué regresó?
↓
¿Qué puede hacerse con lo que regresó?
```

Por tanto:

```text
Delivery
→ prueba del fulfillment

Return
→ prueba del regreso

Inspection / Disposition
→ determina disponibilidad

InventoryMovement
→ registra la consecuencia física
```

> **Que un producto regrese no significa automáticamente que vuelva a estar disponible. Y corregir una venta no significa borrar su historia.**
