# Módulo de Inventario — Zaping ERP

**Módulo:** Inventory
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / EN EVOLUCIÓN
**Última actualización:** 2026-08-19
**Responsable:** Zaping ERP Team

---

# 1. Propósito

El módulo Inventory administra las existencias físicas y su trazabilidad dentro de Zaping.

Su responsabilidad principal es responder de manera confiable:

```text
¿Qué existe?
¿Cuánto existe?
¿Por qué existe esa cantidad?
¿De dónde llegó?
¿Qué movimientos la afectaron?
¿Qué lote está involucrado?
¿Cuándo caduca?
¿Qué puede utilizarse?
¿Qué ocurrió históricamente?
```

Inventory no debe limitarse a almacenar un número llamado `stock`.

Debe conservar la historia que explica ese número.

---

# 2. Principio fundamental

> **Todo cambio de inventario debe tener una causa empresarial trazable.**

Conceptualmente:

```text
Business Event
↓
Inventory Operation
↓
InventoryMovement
↓
Balance / Projection
```

No:

```text
User
↓
edita Product.stock directamente
```

---

# 3. Fuente de verdad

La arquitectura adoptada establece:

```text
InventoryMovement
=
historial de cambios de inventario
```

mientras:

```text
Product.stock
=
proyección operacional
```

utilizada para consultas rápidas.

Por tanto:

> `Product.stock` no constituye un registro histórico independiente.

Debe ser consistente con las operaciones de inventario que lo originaron.

---

# 4. Responsabilidades

Inventory es propietario de:

* existencias;
* movimientos;
* validación de stock;
* lotes;
* cantidades disponibles por lote;
* trazabilidad;
* consecuencias físicas de Receipts;
* consecuencias físicas de Deliveries;
* ajustes;
* futuras ubicaciones;
* futuras series;
* futura lógica FEFO.

---

# 5. Fuera del alcance de Inventory

Inventory no es propietario de:

* Supplier;
* Purchase lifecycle;
* Sales pricing;
* Customer;
* Quote;
* SalesOrder;
* Case;
* Billing;
* Invoice;
* condiciones comerciales.

Otros dominios producen eventos que requieren cambios de inventario.

Inventory ejecuta y registra la consecuencia física correspondiente.

---

# 6. Flujos principales

## Entrada por compra

```text
Purchase
↓
PurchaseReceipt
↓
Inventory IN
```

---

## Salida comercial objetivo

```text
SalesOrder
↓
Delivery
↓
Inventory OUT
```

---

## Retorno

Conceptualmente:

```text
Return confirmado
↓
Inspection / Restock decision
↓
Inventory IN
```

cuando el producto realmente puede reintegrarse.

---

## Ajuste

```text
Stock discrepancy
↓
Authorized Adjustment
↓
InventoryMovement ADJUSTMENT
```

---

## Healthcare

```text
CaseDispatch
↓
Custody
```

no debe interpretarse automáticamente como:

```text
Inventory OUT definitivo
```

La semántica completa se encuentra en ADR-013.

---

# 7. Purchase no aumenta inventario

Regla obligatoria:

```text
Purchase created
→ no stock change
```

```text
Purchase confirmed
→ no stock change
```

```text
PurchaseReceipt registered
→ Inventory IN
```

La mercancía ordenada todavía no forma parte de las existencias físicas hasta que se recibe.

---

# 8. SalesOrder no disminuye inventario

Arquitectura objetivo:

```text
SalesOrder created
→ no stock change
```

```text
SalesOrder confirmed
→ no stock change
```

```text
Delivery confirmed
→ Inventory OUT
```

El compromiso comercial y la entrega física son hechos distintos.

---

# 9. InventoryMovement

`InventoryMovement` registra un cambio de inventario.

Información relevante puede incluir:

```text
id
companyId
productId
movementType
quantity
balance
referenceType
referenceId
notes
createdBy
unitCost
batchId
createdAt
```

La definición técnica exacta debe verificarse contra el schema y la implementación vigentes.

---

# 10. Tipos implementados

La implementación consolidada utiliza el modelo genérico:

```text
IN
OUT
ADJUSTMENT
```

---

# 11. IN

Representa un incremento físico válido.

Ejemplos:

```text
PurchaseReceipt
Return reintegrable
Positive correction
Initial inventory import controlado
```

La causa concreta debe quedar identificada mediante la referencia o contexto correspondiente.

---

# 12. OUT

Representa una disminución definitiva válida.

Ejemplos objetivo:

```text
Delivery
Supplier Return
Write-off
Confirmed consumption
```

No todo artículo que sale físicamente de un almacén produce necesariamente `OUT`.

---

# 13. ADJUSTMENT

`ADJUSTMENT` representa una corrección autorizada de inventario.

No debe convertirse en:

> una forma genérica de editar stock.

Toda operación de ajuste debe poder explicar:

* motivo;
* usuario;
* fecha;
* producto;
* cantidad;
* balance resultante.

Antes de ampliar la funcionalidad de ajustes deberá formalizarse claramente la semántica de ajustes positivos y negativos en el contrato correspondiente.

---

# 14. Tipos históricos más específicos

La documentación antigua proponía valores como:

```text
INITIAL_BALANCE
PURCHASE
SALE
RETURN_IN
RETURN_OUT
ADJUSTMENT_IN
ADJUSTMENT_OUT
TRANSFER_IN
TRANSFER_OUT
STOCK_COUNT
```

Estos nombres representan causas empresariales útiles, pero **no corresponden al enum genérico actualmente adoptado**.

No deben agregarse nuevamente al enum únicamente para conservar la documentación antigua.

---

# 15. Dirección recomendada para causas

La causa empresarial puede expresarse mediante información como:

```text
movementType = IN
referenceType = PURCHASE_RECEIPT
```

o:

```text
movementType = OUT
referenceType = DELIVERY
```

Esto permite mantener:

```text
dirección física
```

separada de:

```text
motivo empresarial
```

---

# 16. Reference Type

`referenceType` identifica conceptualmente qué evento originó el movimiento.

Ejemplos objetivo:

```text
PURCHASE_RECEIPT
DELIVERY
RETURN
INVENTORY_ADJUSTMENT
SUPPLIER_RETURN
CASE_RECONCILIATION
```

Los valores definitivos deben mantenerse controlados por la implementación.

---

# 17. Reference ID

`referenceId` permite rastrear el movimiento hasta el documento que lo originó.

Ejemplo:

```text
InventoryMovement
movementType = IN
referenceType = PURCHASE_RECEIPT
referenceId = receiptId
```

---

# 18. Referencias legacy

Una parte de la implementación histórica generó movimientos relacionados directamente con:

```text
PURCHASE
```

al aprobar compras.

Esos registros pueden existir como comportamiento legacy.

No deben utilizarse como precedente para nuevas entradas.

La arquitectura vigente es:

```text
PurchaseReceipt
→ Inventory IN
```

---

# 19. Inmutabilidad

Un movimiento confirmado representa historia.

No debe editarse posteriormente para modificar:

* tipo;
* cantidad;
* producto;
* lote;
* referencia;
* balance;

de manera que reescriba lo ocurrido.

---

# 20. Correcciones

Un error de inventario debe resolverse mediante una nueva operación trazable.

Conceptualmente:

```text
Incorrect Movement
+
Corrective / Compensating Movement
```

No mediante:

```text
editar movimiento histórico
```

o:

```text
eliminar movimiento
```

---

# 21. Eliminación

Los movimientos históricos no deben eliminarse como parte de operaciones empresariales normales.

Su lifecycle sigue ADR-012:

```text
InventoryMovement
→ IMMUTABLE
```

---

# 22. Product.stock

Actualmente `Product` conserva:

```text
stock
```

como resumen operativo.

Esto proporciona consultas rápidas para:

* listados;
* Dashboard;
* validaciones;
* estados de stock.

---

# 23. Product.stock no se captura libremente

El usuario no debe modificar directamente:

```text
Product.stock = 50
```

desde un formulario de Product.

El stock debe cambiar mediante una operación de Inventory.

---

# 24. Actualización transaccional

Cuando una operación válida cambia inventario:

```text
Business operation
↓
Product.stock update
+
InventoryMovement
```

debe mantenerse consistencia.

No debe ocurrir:

```text
stock updated
✓

movement missing
✗
```

---

# 25. Balance

`InventoryMovement.balance` puede conservar el saldo resultante después del movimiento.

Ejemplo:

```text
Stock anterior: 10
IN: +5
Balance: 15
```

Esto facilita:

* auditoría;
* lectura;
* debugging;
* Kardex futuro.

---

# 26. Balance no sustituye movimientos

Guardar un balance en cada movimiento es una optimización y registro contextual.

La operación que produjo el cambio continúa siendo la información fundamental.

---

# 27. Stock negativo

Regla vigente de dominio:

> Inventory no debe permitir stock negativo en la operación normal.

Ejemplo:

```text
Available = 4
Requested OUT = 6
↓
REJECT
```

---

# 28. Validación backend

Frontend puede indicar:

```text
Solo hay 4 unidades disponibles.
```

pero backend debe verificar nuevamente antes de aplicar la salida.

Nunca debe confiar únicamente en el valor mostrado previamente en UI.

---

# 29. Concurrencia

La disponibilidad puede cambiar entre:

```text
usuario abre pantalla
```

y:

```text
usuario confirma operación
```

Por eso las operaciones críticas deben validar el estado actual dentro del proceso transaccional correspondiente.

---

# 30. InventoryBatch

`InventoryBatch` representa una existencia identificable por lote.

Conceptualmente:

```text
Product
↓
InventoryBatch
↓
InventoryMovement
```

---

# 31. Product vs InventoryBatch

```text
Product
=
qué producto es
```

```text
InventoryBatch
=
qué existencia física por lote existe
```

Ejemplo:

```text
Product
Catéter 15 mm Terumo
```

puede tener:

```text
Batch L001
Caduca 2027-01
30 unidades
```

y:

```text
Batch L002
Caduca 2028-05
50 unidades
```

---

# 32. Lote no pertenece a Product

`lotNumber` no debe almacenarse como propiedad única del Product.

Un mismo producto puede existir simultáneamente en múltiples lotes.

---

# 33. Datos conceptuales de InventoryBatch

La implementación consolidada contempla información como:

```text
id
companyId
productId
supplierId
purchaseId
lotNumber
expirationDate
initialQuantity
availableQuantity
unitCost
receivedAt
notes
isActive
```

además de sus relaciones correspondientes.

La estructura exacta se verifica en el modelo vigente.

---

# 34. Creación del lote

El lote se conoce normalmente durante:

```text
PurchaseReceipt
```

y no durante:

```text
Purchase
```

porque el proveedor puede entregar:

* lotes diferentes;
* cantidades parciales;
* caducidades distintas.

---

# 35. Regla de captura

```text
Purchase
→ lo solicitado

PurchaseReceipt
→ lo recibido

InventoryBatch
→ lote físico recibido
```

---

# 36. Lote existente

Cuando una recepción corresponde al mismo lote reconocido por la implementación, Inventory puede reutilizar el Batch existente e incrementar:

```text
initialQuantity
availableQuantity
```

según las reglas del servicio.

---

# 37. Costo del Batch

Al agregar nuevas cantidades a un Batch existente, la implementación de Receipts contempla costo promedio ponderado.

Conceptualmente:

```text
Nuevo costo =
(
  cantidad existente × costo existente
  +
  cantidad nueva × costo nuevo
)
/
cantidad total
```

Esta regla representa costo del lote, no una política contable completa de valuación de inventario.

---

# 38. Inventory valuation

La valuación financiera completa continúa siendo una capacidad futura.

Antes de soportar:

* FIFO financiero;
* average costing global;
* cost of goods sold;
* accounting;

debe diseñarse explícitamente su política.

---

# 39. Initial Quantity

`initialQuantity` representa cuánto ingresó históricamente al Batch a través de su formación/acumulación.

No debe reducirse al realizar salidas normales.

---

# 40. Available Quantity

`availableQuantity` representa actualmente la cantidad restante operativa dentro del Batch.

Conceptualmente:

```text
Initial / Received
-
Consumed / Delivered
+
Valid Returns
=
Remaining Batch Quantity
```

---

# 41. Precaución con `availableQuantity`

Con la futura arquitectura de:

* ubicaciones;
* custodia;
* quarantine;
* mantenimiento;
* expiración;

el concepto de “available” requerirá mayor precisión.

Por tanto, no debemos convertir el campo actual en una solución universal para todos los estados futuros.

---

# 42. Stock total y lotes

Para productos completamente trazados por Batch, la existencia agregada puede relacionarse conceptualmente con:

```text
Σ Batch quantities
```

pero no debe asumirse esta igualdad universal mientras existan:

* productos sin lote;
* movimientos legacy;
* estados futuros;
* migraciones históricas.

---

# 43. Caducidad

`expirationDate` pertenece al Batch.

No al Product maestro.

Un mismo Product puede tener múltiples fechas de caducidad simultáneamente.

---

# 44. Regla de Receipt

La implementación actual no permite:

```text
expirationDate
```

sin:

```text
lotNumber
```

---

# 45. Producto vencido

Un producto vencido puede continuar físicamente existiendo.

Por tanto:

```text
Expired
≠
Does not exist
```

Pero normalmente:

```text
Expired
→ Not sellable / Not usable
```

según las reglas del dominio.

---

# 46. Physical vs Sellable

Zaping debe distinguir progresivamente:

```text
Physical Stock
```

de:

```text
Available / Sellable Stock
```

Ejemplo:

```text
100 unidades físicas

70 disponibles
20 en custodia
10 vencidas
```

No todas las 100 son necesariamente utilizables para una nueva operación.

---

# 47. FEFO

Healthcare y productos con caducidad requieren evolución hacia:

> **First Expired, First Out**

Conceptualmente:

```text
Batch A
expires 2026-12

Batch B
expires 2027-06

↓
suggest Batch A first
```

---

# 48. Estado de FEFO

FEFO es arquitectura objetivo.

No debe documentarse como completamente implementado hasta que Inventory pueda:

* determinar lotes elegibles;
* excluir vencidos;
* considerar disponibilidad;
* recomendar orden;
* respetar excepciones;
* asignar cantidades.

---

# 49. FEFO no debe ser ciego

FEFO no significa simplemente:

```text
ORDER BY expirationDate
```

sin considerar:

* stock disponible;
* estado del lote;
* ubicación;
* custodia;
* restricciones;
* cantidades.

---

# 50. Serial Numbers

El diseño original contempla trazabilidad por número de serie.

Esta capacidad sigue siendo objetivo, pero no debe confundirse con Batch.

---

# 51. Batch vs Serial

```text
Batch
→ grupo de unidades
```

```text
Serial
→ unidad individual
```

Ejemplo:

```text
Batch L001
100 catéteres
```

vs:

```text
Equipment Serial SN-10042
1 unidad específica
```

---

# 52. Serial uniqueness

Cuando se implemente serialización, una unidad serializada debe tener identidad única dentro del alcance adecuado.

No podrá estar simultáneamente:

```text
Warehouse A
```

y:

```text
Customer / Case B
```

---

# 53. Equipment

Los equipos reutilizables requerirán un lifecycle específico.

No deben representarse únicamente como:

```text
Product.stock = 3
```

si la operación necesita saber cuál unidad física está disponible.

---

# 54. Identificación de inventario

La operación puede utilizar información proveniente de Product como:

* SKU;
* nombre;
* descripción;
* marca;
* barcode.

Y de InventoryBatch como:

* lote;
* caducidad;
* cantidad.

Cada dato debe permanecer en el dominio correcto.

---

# 55. Barcode

Barcode pertenece principalmente a la identificación del Product.

En el futuro puede utilizarse para:

* recepción;
* picking;
* conteo;
* entrega.

No cambia las reglas fundamentales del dominio.

---

# 56. Inventory Entry

Una entrada debe tener cantidad:

```text
> 0
```

La operación debe identificar su causa.

---

# 57. Inventory Output

Una salida debe tener cantidad:

```text
> 0
```

y debe cumplir:

```text
requestedQuantity
<=
availableQuantity
```

según las reglas aplicables.

---

# 58. Ajustes

Un ajuste debe existir por una razón verificable.

Ejemplos:

* diferencia en conteo;
* daño confirmado;
* corrección documentada;
* pérdida;
* carga inicial controlada.

No debe utilizarse para evitar implementar el workflow correcto.

---

# 59. Ejemplo incorrecto

```text
Compra recibida
↓
usuario hace Adjustment +10
```

para evitar registrar PurchaseReceipt.

Incorrecto.

La causa real es:

```text
PurchaseReceipt
```

y debe registrarse como tal.

---

# 60. Initial Balance

La carga inicial de existencias puede requerir una operación especial durante:

* onboarding;
* migración;
* implementación inicial.

No debe simularse mediante una Purchase ficticia si no existió una compra real.

---

# 61. Migración de inventario

El futuro módulo de importaciones debe distinguir:

```text
Historical data import
```

de:

```text
Operational business transaction
```

La migración puede necesitar un tipo de origen específico para conservar trazabilidad sin inventar documentos comerciales inexistentes.

---

# 62. Inventory Count

El conteo físico es una capacidad futura.

Conceptualmente:

```text
System Quantity
vs
Physical Quantity
↓
Difference
↓
Authorized Adjustment
```

El conteo no debe sobrescribir silenciosamente la historia.

---

# 63. Kardex

Una evolución natural es un Kardex por Product.

Puede mostrar:

```text
Fecha
Tipo
Origen
Entrada
Salida
Balance
Lote
Costo
Usuario
```

---

# 64. Product 360

Inventory debe alimentar `Product 360` con información como:

```text
Stock
Estado
Lotes
Caducidades
Movimientos
Recepciones
Entregas
```

sin convertir Product en propietario de la historia.

---

# 65. Estado visual de stock

La UI actual utiliza estados como:

```text
Sin stock
Bajo stock
En stock
```

utilizando `StatusBadge`.

---

# 66. Sin stock

Conceptualmente:

```text
stock <= 0
```

debe representarse como ausencia de disponibilidad normal.

La lógica concreta debe mantenerse centralizada y consistente.

---

# 67. Bajo stock

`minStock` permite detectar productos con inventario bajo.

Conceptualmente:

```text
stock > 0
AND
stock <= minStock
```

según la regla vigente de UI/dominio.

---

# 68. En stock

Representa existencia superior al umbral operativo definido.

Estas categorías son indicadores.

No sustituyen el saldo numérico.

---

# 69. minStock

`Product.minStock` representa un umbral operativo.

Puede utilizarse para:

* alertas;
* Dashboard;
* recomendaciones futuras.

No genera automáticamente una Purchase.

---

# 70. Replenishment futuro

En etapas posteriores Zaping podrá considerar:

```text
Current Stock
Minimum Stock
Pending Purchases
Historical Demand
Lead Time
```

para recomendar abastecimiento.

Una recomendación no constituye inventario ni Purchase hasta que se cree el documento correspondiente.

---

# 71. Integración con Purchases

```text
Purchases
↓
PurchaseReceipt
↓
Inventory
```

Inventory no debe revisar simplemente el estado de una Purchase y aumentar stock.

Debe recibir un hecho físico específico.

---

# 72. PurchaseReceipt → Movement

Cada partida recibida genera conceptualmente:

```text
InventoryMovement
movementType = IN
referenceType = PURCHASE_RECEIPT
referenceId = receiptId
quantity = quantityReceived
batchId = related batch
```

cuando corresponda.

---

# 73. Atomicidad de Receipt

La operación puede incluir:

```text
PurchaseReceipt
+
ReceiptItem
+
InventoryBatch
+
Product.stock
+
InventoryMovement
+
Purchase.status
```

y debe conservar consistencia transaccional.

---

# 74. Integración con Sales

La arquitectura objetivo es:

```text
SalesOrder
↓
Delivery
↓
Inventory
```

Sales no debe modificar directamente:

```text
Product.stock
```

---

# 75. Lot allocation en Delivery

Para productos trazados por lote, la futura Delivery deberá conocer qué lotes fueron realmente entregados.

Esto permitirá:

```text
PurchaseReceipt
↓
InventoryBatch
↓
Delivery allocation
↓
Customer
```

---

# 76. Returns

Una devolución comercial no significa automáticamente que el producto esté nuevamente disponible.

Debe existir una decisión válida de:

```text
restock
```

y, cuando el producto sea trazable:

```text
batch verification
```

---

# 77. Trazabilidad de Return

Para reintegrar correctamente un producto por lote, Zaping debe poder demostrar de qué Batch salió originalmente.

No debe reconstruir la relación mediante suposiciones.

---

# 78. Supplier Return

Una devolución al proveedor es diferente de cancelar una PurchaseReceipt.

Conceptualmente:

```text
Inventory
↓
Supplier Return
↓
Inventory OUT
```

La Receipt original permanece en la historia.

---

# 79. Healthcare Custody

Healthcare agrega un nuevo estado operacional:

```text
Company-owned inventory
outside warehouse
```

---

# 80. CaseDispatch

Regla:

```text
CaseDispatch
≠
Definitive Inventory OUT
```

Representa:

* salida física del almacén;
* cambio de custodia;
* menor disponibilidad local;
* propiedad todavía de la Company.

---

# 81. CaseReturn

El material puede regresar después del procedimiento.

El retorno resuelve custodia, pero puede requerir inspección antes de regresar a disponibilidad.

---

# 82. Reconciliation

Healthcare determina posteriormente:

```text
Used
Returned
Unresolved
```

sobre la cantidad despachada.

---

# 83. Used

El material confirmado como consumido puede producir posteriormente una salida definitiva.

Conceptualmente:

```text
Used
↓
Commercial / disposition process
↓
Inventory OUT
```

según ADR-011 y ADR-013.

---

# 84. Returned

```text
Returned
≠
automatically Available
```

Puede requerirse:

```text
Inspection
↓
Available
Quarantine
Damaged
Maintenance
```

---

# 85. Ubicaciones

Inventory debe poder evolucionar hacia múltiples ubicaciones.

Ejemplos:

```text
Warehouse A
Warehouse B
Field
Technician Custody
Quarantine
Maintenance
```

---

# 86. Estado de Multi-Warehouse

Multi-Warehouse es arquitectura objetivo.

No debe introducirse una tabla o modelo únicamente para anticiparlo sin diseñar:

* balances;
* transfers;
* locations;
* permissions;
* receiving;
* delivery;
* custody.

---

# 87. Transferencias

Cuando exista Multi-Warehouse:

```text
Warehouse A
↓
Transfer
↓
Warehouse B
```

representa movimiento interno de propiedad.

Normalmente:

```text
Company Physical Inventory
```

no cambia en total.

Cambian:

```text
location balances
```

---

# 88. InventoryLocation

Conceptos como:

```text
InventoryLocation
StockPosition
InventoryBalance
```

son candidatos futuros.

Este documento no decide todavía cuál modelo Prisma debe utilizarse.

---

# 89. No modificar schema prematuramente

No se debe agregar de inmediato:

```text
warehouseId
locationId
custodyId
```

a múltiples tablas únicamente porque aparezcan en la arquitectura objetivo.

Primero debe diseñarse el modelo operacional completo.

---

# 90. Physical Stock

Conceptualmente:

```text
Physical Stock
=
existencia todavía propiedad de Company
```

puede encontrarse en distintos estados o ubicaciones.

---

# 91. Available Stock

Conceptualmente:

```text
Available Stock
=
existencia elegible para una nueva operación
```

No necesariamente:

```text
Physical Stock
=
Available Stock
```

---

# 92. Ejemplo futuro

```text
Physical stock: 100

Warehouse available: 70
Technician custody: 20
Expired: 5
Quarantine: 5
```

Entonces una nueva Delivery no debería asumir disponibilidad de 100.

---

# 93. Inventory availability

La lógica futura de disponibilidad debe considerar progresivamente:

* ubicación;
* Batch;
* caducidad;
* reserva;
* custodia;
* condición;
* serial;
* estado.

No debe duplicarse entre Sales, Healthcare y Purchases.

---

# 94. Reserva

Reservation no forma parte todavía del modelo obligatorio.

En el futuro podría diferenciarse:

```text
Physical
Reserved
Available
```

pero requiere una decisión específica antes de implementarse.

---

# 95. Seguridad multiempresa

Toda operación debe estar aislada por Company.

Debe impedirse:

```text
Company A
↓
InventoryMovement Company B
```

o:

```text
Receipt A
↓
Batch from Company B
```

---

# 96. companyId

El `companyId` debe derivarse del contexto autenticado.

No debe confiarse en un `companyId` arbitrario enviado por frontend.

---

# 97. Relaciones cross-tenant

Cuando Inventory recibe:

* productId;
* batchId;
* referenceId;

debe verificar que las relaciones válidas pertenezcan al tenant correspondiente.

---

# 98. RBAC

Permisos conceptuales pueden incluir:

```text
inventory.read
inventory.adjust
inventory.count
inventory.transfer
inventory.export
```

y permisos específicos futuros para:

```text
inventory.quarantine
inventory.writeOff
```

La implementación granular continúa evolucionando.

---

# 99. Ajustes sensibles

`inventory.adjust` debe considerarse un permiso sensible.

Modificar existencias mediante ajuste puede afectar:

* operación;
* costo;
* auditoría;
* disponibilidad.

No debe concederse indiscriminadamente.

---

# 100. Auditoría

Debe poder determinarse:

```text
qué cambió
cuánto
por qué
quién
cuándo
qué documento lo originó
qué lote estuvo involucrado
```

cuando corresponda.

---

# 101. createdBy

Los movimientos deben preservar el usuario responsable cuando exista.

El backend debe obtener esta identidad desde el contexto autenticado.

---

# 102. Notas

`notes` puede proporcionar contexto adicional.

No debe sustituir información estructurada crítica.

Incorrecto:

```text
notes = "lote L001, salieron 5"
```

si esos datos deben existir como campos/relaciones estructurados.

---

# 103. API

Inventory debe exponer capacidades del dominio, no edición arbitraria de sus tablas.

Evitar:

```text
POST /inventory/set-stock
```

como operación general.

---

# 104. Operaciones correctas

Preferir operaciones como:

```text
PurchaseReceipt
Delivery
Return
Adjustment
Transfer
Count
```

cada una con reglas propias.

---

# 105. Consultas

Inventory puede ofrecer consultas como:

```text
GET inventory
GET inventory movements
GET product inventory
GET batches
```

según la implementación.

La referencia exacta de endpoints debe evolucionar a OpenAPI.

---

# 106. Dashboard

Dashboard puede consumir Inventory para mostrar:

* valor de inventario;
* productos con bajo stock;
* movimientos recientes;
* alertas de caducidad futuras.

No debe modificar inventario.

---

# 107. Valor de inventario

`inventoryValue` puede proporcionar una métrica operacional.

Antes de utilizarla como cifra contable oficial debe existir una política definida de valuación.

---

# 108. Expiration Dashboard

La arquitectura futura puede mostrar:

```text
Caduca en 30 días
Caduca en 60 días
Caduca en 90 días
Vencido
```

priorizando lotes que requieren atención.

---

# 109. Notifications

Eventos como:

```text
Low Stock
Expiration approaching
Negative stock attempt
Reconciliation issue
```

pueden generar alertas futuras.

No todo movimiento debe generar una notificación al usuario.

---

# 110. Domain Events

Eventos conceptuales pueden incluir:

```text
InventoryMovementCreated
InventoryAdjusted
InventoryLowStock
InventoryExpired
InventoryNegativeAttemptBlocked
```

y posteriormente:

```text
InventoryTransferred
InventoryCountCompleted
```

Estos eventos no implican infraestructura distribuida obligatoria.

---

# 111. UI actual

La interfaz de Inventory debe mostrar como mínimo información útil como:

```text
Producto
SKU
Stock
Mínimo
Estado
```

según la implementación.

---

# 112. Evolución de la UI

Inventory debe evolucionar desde una tabla de stock hacia contexto más rico:

```text
Product
Stock
Available
Lots
Nearest Expiration
Status
Actions
```

cuando esas capacidades estén realmente disponibles.

---

# 113. Product 360

Desde Product debería ser posible acceder progresivamente a:

```text
Inventario
Lotes
Movimientos
Compras
Entregas
Returns
```

sin convertir la pantalla en un bloque único de información.

---

# 114. Warehouse Operations

El Workspace futuro puede consumir Inventory para mostrar:

```text
Bajo stock
Por recibir
Por preparar
Returns
Quarantine
Incidents
```

Inventory continúa siendo propietario de existencias.

---

# 115. Loading / Empty / Error

Las pantallas deben distinguir:

```text
Loading
Empty
Data
Error
```

y no confundir:

```text
No hay inventario
```

con:

```text
No fue posible cargar inventario
```

---

# 116. Trazabilidad

La meta arquitectónica es poder reconstruir cadenas como:

```text
Supplier
↓
Purchase
↓
PurchaseReceipt
↓
InventoryBatch
↓
InventoryMovement
↓
Delivery
↓
Customer
```

---

# 117. Trazabilidad Healthcare

También:

```text
PurchaseReceipt
↓
InventoryBatch
↓
CaseDispatch
↓
Technician Custody
↓
Case
↓
Return / Consumption
↓
Final disposition
```

---

# 118. Estado CURRENT

La documentación consolidada confirma capacidades relacionadas con:

```text
Product.stock
Product.minStock
InventoryMovement
IN
OUT
ADJUSTMENT
balance
referenceType
referenceId
unitCost
Purchase Receipts
InventoryBatch
lotNumber
expirationDate
availableQuantity
receipt-generated IN movements
low-stock state
```

La implementación técnica vigente debe seguir verificándose en código antes de realizar cambios de schema.

---

# 119. Estado TARGET

Arquitectura aprobada:

```text
Delivery-based OUT
FEFO
Expired-stock blocking
Batch allocation on Delivery
Return batch traceability
Advanced availability
Inventory correction/reversal
Healthcare custody integration
Equipment integration
```

---

# 120. Estado FUTURE

Capacidades posteriores:

```text
Multi-Warehouse
Locations
Transfers
Stock Counts
Serial tracking
Reservations
Barcode workflows
QR workflows
Inventory valuation
Advanced replenishment
Forecasting
Inventory analytics
AI recommendations
```

---

# 121. Invariantes principales

```text
Inventory change
→ traceable operation
```

```text
Purchase
≠
Inventory IN
```

```text
PurchaseReceipt
→ Inventory IN
```

```text
SalesOrder
≠
Inventory OUT
```

```text
Delivery
→ Inventory OUT
```

```text
CaseDispatch
≠
Definitive OUT
```

```text
Confirmed InventoryMovement
→ immutable
```

```text
Normal operation
→ no negative stock
```

```text
Expired inventory
→ may physically exist
→ not normally sellable
```

```text
Cross-tenant inventory
→ forbidden
```

---

# 122. Anti-patrones

## Direct Stock Editing

```text
Product.stock = arbitraryValue
```

---

## Inventory on Purchase Approval

```text
Purchase CONFIRMED
→ IN
```

---

## Inventory on SalesOrder

```text
SalesOrder CONFIRMED
→ OUT
```

---

## Delete Historical Movement

Eliminar un movimiento para corregir saldo.

---

## Rewrite Receipt

Editar una Receipt histórica para cambiar el inventario pasado.

---

## Assume Batch

Asignar una Return al lote que “parece correcto” sin trazabilidad.

---

## Treat Custody as Sale

```text
CaseDispatch
→ OUT / Sale
```

automáticamente.

---

## Add Future Fields Prematurely

Agregar Warehouse, Location, Reservation o Serial al schema sin diseñar el workflow correspondiente.

---

# 123. Relación con Products

`Product` define:

```text
qué producto es
```

Inventory define:

```text
cuánto existe
cómo llegó
dónde está conceptualmente
qué movimientos lo afectaron
```

---

# 124. Relación con Purchases

`PURCHASES.md` define:

```text
qué se ordenó
qué se recibió
```

Inventory aplica la consecuencia física de la recepción.

---

# 125. Relación con Sales

Sales define:

```text
qué se vende
```

Inventory define:

```text
si puede salir
qué existencia sale
cómo queda el saldo
```

---

# 126. Relación con Returns

Returns define:

```text
qué se devuelve
por qué
en qué condición
si debe reintegrarse
```

Inventory ejecuta la disposición física válida.

---

# 127. Relación con Healthcare

Healthcare define:

```text
Case
Dispatch
Custody
Return
Reconciliation
```

Inventory conserva la representación correcta de las existencias.

Healthcare no debe modificar stock directamente.

---

# 128. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-005 — Layered Architecture.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-011 — SalesOrder y Delivery.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 129. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
architecture/ARCHITECTURE.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
modules/erp/PURCHASES.md
product/ZAPING_WAY.md
```

---

# 130. Fuente de verdad

Este documento constituye la fuente documental principal de las reglas funcionales de Inventory.

La división de responsabilidades es:

```text
INVENTORY.md
→ comportamiento del dominio

ADR
→ decisiones arquitectónicas

schema.prisma
→ modelo técnico vigente

backend
→ implementación actual

tests
→ comportamiento validado

PROJECT_BOARD.md
→ estado del trabajo
```

---

# 131. Principio final

Inventory debe representar hechos físicos y conservar su historia.

La regla principal de Zaping es:

```text
Business Event
↓
Inventory Consequence
↓
Traceable Movement
```

Nunca:

```text
Need different stock
↓
edit the number
```

> **El stock es una consecuencia. La trazabilidad es la evidencia.**
