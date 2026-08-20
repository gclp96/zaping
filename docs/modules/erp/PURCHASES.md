# Módulo de Compras — Zaping ERP

**Módulo:** Purchases
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / EN EVOLUCIÓN
**Última actualización:** 2026-08-19
**Responsable:** Zaping ERP Team

---

# 1. Propósito

El módulo de Compras administra el proceso mediante el cual una Company solicita productos a un Supplier y posteriormente registra su recepción física.

El dominio debe distinguir claramente:

```text
Ordenar mercancía
```

de:

```text
Recibir mercancía
```

Por lo tanto, la regla fundamental es:

> **Una Purchase no aumenta inventario. Una PurchaseReceipt confirmada representa la entrada física.**

---

# 2. Alcance

El módulo cubre:

* creación de Purchase;
* edición en borrador;
* aprobación;
* cancelación;
* Purchase Items;
* cálculo de totales;
* generación de folio;
* generación de PDF;
* recepciones parciales;
* múltiples recepciones;
* cantidades pendientes;
* lotes;
* caducidades;
* relación con Inventory;
* trazabilidad de recepción.

---

# 3. Responsabilidades

Purchases es propietario de:

```text
Purchase
PurchaseItem
Purchase lifecycle
Supplier selection
Ordered quantities
Purchase commercial values
Received vs Pending calculation
```

Purchase Receipts coordinan el hecho físico de recepción con Inventory.

---

# 4. Fuera del alcance

Purchases no es propietario de:

* stock;
* disponibilidad;
* InventoryMovement;
* balances;
* consumo de lotes;
* Sales;
* Customer Delivery;
* Healthcare Case Logistics;
* facturación de proveedor completa;
* cuentas por pagar.

---

# 5. Flujo principal

```text
Supplier
↓
Purchase
↓
Approve
↓
Purchase CONFIRMED
↓
Receive goods
↓
PurchaseReceipt
↓
Inventory IN
```

---

# 6. Regla central

Incorrecto:

```text
Purchase APPROVED
↓
Inventory IN
```

Correcto:

```text
Purchase APPROVED
↓
mercancía esperada
```

y posteriormente:

```text
PurchaseReceipt
↓
mercancía físicamente recibida
↓
Inventory IN
```

---

# 7. Razón de la separación

Una orden de compra puede:

* aprobarse hoy;
* enviarse al proveedor;
* tardar varios días;
* recibirse parcialmente;
* recibirse mediante varios embarques;
* contener diferencias.

Por tanto:

```text
Commercial commitment
≠
Physical receipt
```

---

# 8. Entidades principales

El dominio utiliza principalmente:

```text
Purchase
PurchaseItem
PurchaseReceipt
PurchaseReceiptItem
```

y se integra con:

```text
Supplier
Product
InventoryBatch
InventoryMovement
User
Company
```

---

# 9. Purchase

`Purchase` representa una orden de compra.

Conceptualmente contiene:

```text
id
companyId
folio
supplierId
subtotal
iva
total
status
createdAt
updatedAt
items
receipts
```

El schema real continúa siendo la fuente técnica para campos exactos.

---

# 10. PurchaseItem

Cada Purchase contiene una o más partidas.

Conceptualmente:

```text
Purchase
└── PurchaseItem
    ├── productId
    ├── quantity
    ├── price
    └── subtotal
```

---

# 11. PurchaseReceipt

`PurchaseReceipt` representa un evento real de recepción.

Información actual relevante:

```text
companyId
purchaseId
folio
receivedAt
receivedBy
notes
items
```

---

# 12. PurchaseReceiptItem

Representa lo realmente recibido de una partida de compra.

Conceptualmente:

```text
purchaseItemId
productId
quantityReceived
lotNumber
expirationDate
unitCost
batchId
```

---

# 13. Lifecycle de Purchase

El lifecycle actual utiliza:

```text
DRAFT
CONFIRMED
PARTIALLY_RECEIVED
RECEIVED
CANCELLED
```

---

# 14. DRAFT

Una Purchase nueva comienza como:

```text
DRAFT
```

Representa una orden todavía no confirmada.

---

# 15. Capacidades de DRAFT

Mientras se encuentre en borrador puede permitirse:

* modificar Supplier;
* modificar productos;
* modificar cantidades;
* recalcular importes;
* aprobar;
* cancelar.

---

# 16. Edición después de DRAFT

Una vez que la compra deja de ser `DRAFT`, sus datos comerciales principales no deben modificarse libremente.

Esto protege:

* cantidades ordenadas;
* costos;
* Supplier;
* trazabilidad;
* relación con recepciones.

---

# 17. CONFIRMED

La aprobación produce:

```text
DRAFT
↓
CONFIRMED
```

Significa:

> La orden de compra ha sido confirmada y puede comenzar a recibir mercancía.

No significa:

> La mercancía ya se recibió.

---

# 18. Aprobar no mueve inventario

La aprobación no debe generar por sí misma:

```text
Product.stock increment
InventoryMovement IN
InventoryBatch
```

Esos efectos pertenecen al Receipt.

---

# 19. PARTIALLY_RECEIVED

Cuando una compra ha recibido alguna mercancía, pero todavía existen cantidades pendientes:

```text
CONFIRMED
↓
PARTIALLY_RECEIVED
```

---

# 20. RECEIVED

Cuando todas las cantidades ordenadas han sido recibidas:

```text
PARTIALLY_RECEIVED
↓
RECEIVED
```

o, si todo llega en una sola recepción:

```text
CONFIRMED
↓
RECEIVED
```

---

# 21. CANCELLED

Una Purchase puede pasar a:

```text
CANCELLED
```

cuando las reglas de lifecycle lo permitan.

La implementación actual permite cancelar principalmente una compra todavía en `DRAFT`.

---

# 22. Compra recibida

Una Purchase `RECEIVED` ya no debe aceptar nueva recepción normal.

Esto evita:

```text
Ordered = 10
Received = 10
+
another Receipt = 2
```

---

# 23. Compra cancelada

Una Purchase `CANCELLED` no puede recibir mercancía mediante el flujo normal.

Si físicamente llega material relacionado con una orden cancelada, se requiere una decisión operacional explícita en lugar de forzar una recepción inconsistente.

---

# 24. Compra en borrador

No puede recibirse una Purchase `DRAFT`.

Primero debe existir una orden confirmada.

---

# 25. Purchase lifecycle

Vista completa:

```text
                 ┌──────────────→ CANCELLED
                 │
DRAFT ───────────┤
                 │
                 ↓
             CONFIRMED
                 ↓
       PARTIALLY_RECEIVED
                 ↓
              RECEIVED
```

Una recepción completa puede provocar:

```text
CONFIRMED
↓
RECEIVED
```

directamente.

---

# 26. Creación de Purchase

Para crear una Purchase se requiere como mínimo:

* Supplier válido;
* uno o más productos;
* cantidades válidas.

El backend debe validar todos los recursos dentro de la Company autenticada.

---

# 27. Supplier

El Supplier seleccionado debe:

* existir;
* pertenecer a la Company;
* ser válido para la operación.

Un Supplier de otro tenant nunca puede utilizarse.

---

# 28. Products

Todos los productos deben pertenecer a la misma Company.

Una Purchase no puede incorporar un Product de otro tenant.

---

# 29. Productos duplicados

Una misma Purchase no debe contener la misma partida de Product duplicada sin una razón de negocio explícita.

La implementación actual rechaza productos duplicados.

Preferir:

```text
Product A × 10
```

sobre:

```text
Product A × 4
Product A × 6
```

dentro de la misma Purchase.

---

# 30. Quantity

La cantidad ordenada debe ser:

```text
integer >= 1
```

salvo que en el futuro el dominio soporte unidades fraccionarias.

Ese cambio requerirá revisar el modelo completo de Inventory.

---

# 31. Unit Cost

Actualmente el costo de cada PurchaseItem se obtiene del costo conocido del Product durante la creación/edición de la compra.

El PurchaseItem conserva ese valor histórico.

Por tanto:

```text
Product.cost changes later
```

no debe reescribir automáticamente:

```text
historical PurchaseItem.price
```

---

# 32. Totales

Conceptualmente:

```text
Item Subtotal
=
Quantity × Unit Cost
```

```text
Purchase Subtotal
=
Σ Item Subtotal
```

Actualmente el sistema utiliza IVA del 16 % en el flujo implementado.

La estrategia fiscal completa deberá evolucionar cuando Billing y configuración tributaria sean implementados.

---

# 33. Dinero

Los cálculos monetarios deben seguir las reglas generales de calidad financiera.

La implementación actual utiliza `Float` en varias entidades históricas.

La estrategia definitiva de precisión monetaria deberá revisarse antes de ampliar significativamente:

* Billing;
* CFDI;
* accounting;
* financial reporting.

Este documento no redefine todavía el modelo monetario.

---

# 34. Folio

Purchase utiliza un folio empresarial independiente del UUID técnico.

Ejemplo:

```text
id
→ UUID

folio
→ OC-...
```

---

# 35. PDF

La orden de compra puede generar un documento PDF.

El PDF representa la Purchase.

Puede incluir información como:

* Company;
* RFC;
* Supplier;
* folio;
* fecha;
* estado;
* productos;
* cantidades;
* costos;
* subtotal;
* IVA;
* total.

---

# 36. PDF no representa Receipt

La orden de compra PDF no debe utilizarse como evidencia de que la mercancía fue recibida.

Son hechos distintos.

En el futuro puede existir un documento específico de recepción.

---

# 37. Recepción

La operación de recepción comienza desde una Purchase confirmada o parcialmente recibida.

La interfaz debe mostrar al usuario las partidas todavía pendientes.

---

# 38. Ordered Quantity

Para una PurchaseItem:

```text
Ordered Quantity
=
PurchaseItem.quantity
```

---

# 39. Received Quantity

La cantidad recibida se deriva de las recepciones registradas.

Conceptualmente:

```text
Received Quantity
=
Σ PurchaseReceiptItem.quantityReceived
```

para la misma `purchaseItemId`.

---

# 40. Pending Quantity

Regla:

```text
Pending Quantity
=
Ordered Quantity
-
Received Quantity
```

---

# 41. Ejemplo

```text
Ordenado: 10
Recibido: 4
Pendiente: 6
```

Una nueva Receipt para esa partida puede registrar como máximo:

```text
6
```

---

# 42. No sobre-recepción

Debe cumplirse:

```text
new quantityReceived
<=
pendingQuantity
```

Nunca:

```text
received total
>
ordered total
```

dentro del flujo normal.

---

# 43. Validación backend

Aunque frontend limite la cantidad mediante UI, backend debe recalcular la cantidad pendiente.

Nunca debe confiar únicamente en:

```text
max="6"
```

del input.

---

# 44. Recepciones parciales

Una Purchase puede tener múltiples receipts.

Ejemplo:

```text
Purchase
100 unidades
│
├── Receipt 1
│   40
│
├── Receipt 2
│   30
│
└── Pending
    30
```

---

# 45. Receipt de múltiples partidas

Una misma PurchaseReceipt puede contener varias partidas recibidas.

Ejemplo:

```text
REC-001
├── Product A × 10
├── Product B × 4
└── Product C × 2
```

---

# 46. Partidas repetidas dentro de Receipt

La misma `purchaseItemId` no debe repetirse dentro de una sola recepción.

Incorrecto:

```text
Receipt
├── PurchaseItem A × 2
└── PurchaseItem A × 3
```

Preferir:

```text
Receipt
└── PurchaseItem A × 5
```

---

# 47. Pertenencia de partida

Toda `purchaseItemId` recibida debe pertenecer a la Purchase indicada.

Debe rechazarse:

```text
Purchase A
↓
Receipt
↓
PurchaseItem belonging to Purchase B
```

---

# 48. Receipt como hecho físico

En la implementación actual, registrar la recepción constituye directamente el evento físico confirmado.

No existe actualmente un lifecycle separado:

```text
Receipt DRAFT
↓
Receipt CONFIRMED
```

como requisito general.

Por tanto:

```text
Create PurchaseReceipt
↓
Inventory effect
```

es el comportamiento vigente.

---

# 49. Evolución futura de Receipt

Si el workflow operativo requiere preparar o revisar una recepción antes de aplicarla, podrá evolucionar hacia:

```text
DRAFT
↓
CONFIRMED
```

pero esa complejidad no debe agregarse sin necesidad.

---

# 50. Lote

`lotNumber` permite identificar el lote físico recibido.

Cuando el producto requiere trazabilidad por lote, la recepción constituye el punto natural de captura.

---

# 51. Caducidad

`expirationDate` puede registrarse durante Receipt.

Regla vigente:

```text
expirationDate
→ requires lotNumber
```

No debe existir una caducidad desconectada de un lote cuando se utiliza el modelo actual.

---

# 52. Caducidad inválida

La recepción debe rechazar una fecha de caducidad anterior a la fecha de recepción.

Conceptualmente:

```text
expirationDate
>=
receivedAt date
```

según las reglas implementadas.

---

# 53. Producto sin lote

No todos los productos necesitan obligatoriamente lote en la implementación actual.

La política futura debe evolucionar hacia configuración por Product, por ejemplo:

```text
requiresLotTracking
requiresExpirationTracking
requiresSerialTracking
```

si el dominio lo requiere.

No se agregan esos campos únicamente desde este documento.

---

# 54. InventoryBatch

Cuando existe lote, Receipt puede crear o actualizar un `InventoryBatch`.

Conceptualmente:

```text
PurchaseReceipt
↓
PurchaseReceiptItem
↓
InventoryBatch
```

---

# 55. Información del Batch

Un InventoryBatch puede conservar información como:

```text
product
lotNumber
expirationDate
initialQuantity
availableQuantity
unitCost
receivedAt
```

La definición completa pertenece a `INVENTORY.md`.

---

# 56. Unidad de costo

El Receipt conserva el costo asociado a la PurchaseItem.

Esto permite mantener trazabilidad entre:

```text
Purchase
↓
Receipt
↓
Batch
↓
Inventory Movement
```

---

# 57. Integración con Inventory

La recepción coordina con Inventory para producir:

```text
InventoryBatch
+
InventoryMovement IN
+
Stock / balance update
```

cuando corresponda.

---

# 58. Fuente del movimiento

El InventoryMovement generado debe estar relacionado con el evento que realmente produjo el cambio físico.

La dirección arquitectónica es preferir:

```text
referenceType = PURCHASE_RECEIPT
referenceId   = receiptId
```

o una referencia equivalente al Receipt.

No debe continuar conceptualizando la Purchase aprobada como el evento físico.

La implementación concreta de referencias deberá revisarse durante la consolidación de Inventory.

---

# 59. Transacción

Registrar una Receipt es una operación crítica.

Conceptualmente:

```text
Create PurchaseReceipt
+
Create Receipt Items
+
Create / Update InventoryBatch
+
Update Inventory
+
Create InventoryMovement
+
Update Purchase Status
```

debe conservar consistencia transaccional.

---

# 60. Regla atómica

No debe ocurrir:

```text
Receipt created
✓

Inventory update
✗
```

ni:

```text
Inventory increased
✓

Receipt missing
✗
```

La operación debe completarse o revertirse como unidad.

---

# 61. Purchase status después de Receipt

Después de registrar la recepción debe recalcularse el estado de la Purchase.

Si existe pendiente:

```text
PARTIALLY_RECEIVED
```

Si todo fue recibido:

```text
RECEIVED
```

---

# 62. Estado derivado del progreso

El cambio de estado debe responder a las cantidades reales.

No debe depender de que el usuario manualmente seleccione:

```text
"Parcialmente recibida"
```

o:

```text
"Recibida"
```

---

# 63. Usuario que recibe

La recepción debe conservar, cuando esté disponible:

```text
receivedBy
```

derivado del usuario autenticado.

Frontend no debe elegir arbitrariamente otro usuario como autoridad de auditoría.

---

# 64. Fecha de recepción

La operación conserva:

```text
receivedAt
```

La fecha representa cuándo el sistema reconoce la recepción.

Si posteriormente se necesita registrar una fecha física histórica diferente de `createdAt`, debe mantenerse esa distinción.

---

# 65. Notas

Las notas pueden proporcionar contexto administrativo.

No deben utilizarse para sustituir campos estructurados importantes como:

* lote;
* cantidad;
* caducidad;
* responsable.

---

# 66. Multi-tenancy

Todas las operaciones deben mantenerse dentro de una Company.

Debe validarse al menos:

```text
Purchase.companyId
Supplier.companyId
Product.companyId
Receipt.companyId
Inventory data companyId
```

según la estructura de relaciones correspondiente.

---

# 67. Seguridad de IDs

Conocer un:

```text
purchaseId
purchaseItemId
productId
```

de otra Company no concede acceso.

Todos los recursos deben validarse en el contexto autenticado.

---

# 68. Roles

El módulo debe respetar RBAC.

Conceptualmente pueden existir permisos como:

```text
purchases.read
purchases.create
purchases.update
purchases.approve
purchases.cancel
purchaseReceipts.create
```

La matriz granular es arquitectura objetivo y se implementará progresivamente según ADR-007.

---

# 69. Auditoría

Acciones relevantes deben ser auditables cuando se incorpore el sistema completo de auditoría.

Especialmente:

```text
Purchase created
Purchase approved
Purchase cancelled
Receipt registered
```

---

# 70. Inmutabilidad de Receipt

Una Receipt registrada que ya generó efectos de Inventory no debe editarse libremente para modificar:

* quantityReceived;
* lotNumber;
* product;
* batch;
* unitCost;

si hacerlo reescribe historia física.

---

# 71. Corrección de Receipt

Si una recepción confirmada contiene un error, debe utilizarse un mecanismo trazable.

Ejemplos futuros:

```text
Receipt Reversal
Inventory Adjustment
Supplier Return
Corrective Receipt
```

según el caso.

No:

```text
editar 10 → 4
```

silenciosamente después de haber aumentado inventario.

---

# 72. Cancelación de Purchase con Receipts

Una Purchase con recepciones no debe simplemente desaparecer ni cancelar sus efectos históricos.

Cualquier lifecycle posterior debe considerar primero las Receipts existentes.

---

# 73. Supplier Return

Una devolución posterior al proveedor es un evento distinto.

Conceptualmente:

```text
PurchaseReceipt
↓
Inventory
↓
Supplier Return
↓
Inventory OUT
```

No debe modificarse la Receipt original para representar una devolución posterior.

---

# 74. UI actual

La experiencia de Purchases ya contempla patrones como:

* listado;
* estados;
* crear;
* editar Draft;
* aprobar;
* cancelar;
* detalle;
* descargar PDF;
* consultar recepciones;
* consultar movimientos;
* registrar recepción.

---

# 75. Detalle de compra

La vista de detalle debe evolucionar hacia `Purchase 360`.

Debe permitir comprender:

```text
Supplier
Ordered
Received
Pending
Receipts
Inventory impact
Status
Documents
History
```

---

# 76. Acción contextual

La acción principal depende del estado.

Conceptualmente:

```text
DRAFT
→ Aprobar / Editar
```

```text
CONFIRMED
→ Registrar recepción
```

```text
PARTIALLY_RECEIVED
→ Registrar recepción restante
```

```text
RECEIVED
→ Ver historial
```

---

# 77. Recepción desde contexto

Cuando el usuario inicia una Receipt desde una Purchase, Zaping ya conoce:

* Purchase;
* Supplier;
* Items;
* Ordered Quantity;
* Received Quantity;
* Pending Quantity.

No debe pedirle seleccionar nuevamente esos datos.

---

# 78. Formulario de Receipt

La interfaz debe mostrar por partida:

```text
Producto
Ordenado
Recibido
Pendiente
Cantidad recibida
Lote
Caducidad
```

cuando corresponda.

---

# 79. Validaciones UI

La UI puede prevenir errores como:

* ninguna cantidad capturada;
* cantidad < 1;
* cantidad > pendiente;
* caducidad sin lote.

El backend debe repetir las validaciones críticas.

---

# 80. Loading y errores

Crear Purchase, aprobar, cancelar, generar PDF y registrar Receipt deben proporcionar feedback independiente.

Una operación no debe dejar al usuario sin saber si:

```text
está procesando
terminó
falló
```

---

# 81. Success feedback

Después de una Receipt, idealmente debe mostrarse contexto como:

```text
Recepción REC-002 registrada.

Ordenado: 10
Recibido: 10
Pendiente: 0

Compra recibida completamente.
```

---

# 82. Endpoints actuales relevantes

La implementación existente utiliza contratos como:

```text
GET   /purchases
POST  /purchases
PATCH /purchases/:id
PATCH /purchases/:id/approve
PATCH /purchases/:id/cancel
GET   /purchases/:id/pdf
```

y para recepciones:

```text
POST /purchase-receipts
GET  /purchase-receipts/purchase/:purchaseId
```

Estos endpoints reflejan la implementación actual.

La convención objetivo puede evolucionar según `API_GUIDELINES.md` sin cambiar las reglas del dominio.

---

# 83. API objetivo

Una dirección futura más orientada al recurso podría utilizar:

```text
POST /purchases/:purchaseId/receipts
```

pero no se requiere un refactor únicamente por estética de URL.

Debe realizarse cuando exista una razón de consistencia o evolución contractual.

---

# 84. Current vs Target

## CURRENT

Implementado o validado actualmente:

```text
Purchase CRUD funcional
DRAFT
CONFIRMED
PARTIALLY_RECEIVED
RECEIVED
CANCELLED
Purchase approval
Purchase cancellation
Purchase PDF
Partial receipts
Multiple receipts
Pending quantity validation
Lot capture
Expiration capture
InventoryBatch integration
InventoryMovement IN
Frontend receipt flow
```

---

# 85. TARGET

Evolución aprobada:

```text
Purchase 360
Improved audit
Explicit receipt correction/reversal
Permission granularity
Advanced tracking configuration by Product
OpenAPI documentation
Multi-Warehouse integration
Supplier Returns
```

---

# 86. FUTURE

Posibilidades posteriores:

```text
Purchase Requests
Approval workflows
Supplier quotations
Expected delivery dates
Backorders
Accounts Payable
Invoice matching
Purchase analytics
Automated replenishment recommendations
```

No deben interpretarse como alcance actual.

---

# 87. Replenishment

En el futuro Inventory podrá sugerir compras basándose en:

```text
stock
minStock
consumption
lead time
pending purchases
```

La recomendación genera intención de compra.

No aumenta inventario.

---

# 88. Multi-Warehouse

Cuando exista Multi-Warehouse, una Receipt deberá indicar el destino físico correspondiente.

Ejemplo:

```text
PurchaseReceipt
↓
Warehouse A
↓
InventoryBatch
```

Este cambio no debe alterar la regla central:

```text
Receipt
→ Inventory IN
```

---

# 89. Barcode / QR

En etapas futuras, la recepción podrá utilizar:

* barcode;
* QR;
* scanner;

para identificar productos, lotes o unidades.

Debe simplificar captura sin debilitar validaciones.

---

# 90. Importaciones

Las Purchases históricas pueden formar parte de procesos futuros de migración de datos.

Debe distinguirse entre:

```text
historical imported purchase
```

y:

```text
new operational receipt
```

para no generar inventario accidentalmente durante migraciones.

---

# 91. Integración con Dashboard

Dashboard puede mostrar:

```text
Purchases pending receipt
Partially received purchases
Recent receipts
```

pero no es propietario del lifecycle.

---

# 92. Integración con Warehouse Operations

El Workspace futuro puede mostrar:

```text
Por recibir
```

basado en Purchases:

```text
CONFIRMED
PARTIALLY_RECEIVED
```

con cantidades pendientes.

---

# 93. Integración con Healthcare

Healthcare puede consumir productos que originalmente ingresaron mediante Purchase Receipts.

El origen trazable puede ser:

```text
Purchase
↓
PurchaseReceipt
↓
InventoryBatch
↓
CaseDispatch
↓
Reconciliation
```

Purchases no necesita conocer el Case para mantener esa trazabilidad.

---

# 94. Invariantes

El módulo debe proteger como mínimo:

```text
Purchase DRAFT
→ no Inventory IN
```

```text
Purchase CONFIRMED
→ puede recibir
```

```text
Received Quantity
<=
Ordered Quantity
```

```text
PurchaseReceipt
→ belongs to same Company
```

```text
PurchaseReceiptItem
→ belongs to Purchase
```

```text
expirationDate
→ requires lotNumber
```

```text
Receipt inventory effects
→ atomic
```

---

# 95. Anti-patrones

No volver a introducir:

## Inventory on Approval

```text
Approve Purchase
→ stock += ordered
```

---

## Manual Received Status

```text
User selects "RECEIVED"
```

sin verificar cantidades.

---

## Over Receipt

```text
Ordered 10
Received 13
```

sin un proceso excepcional explícito.

---

## Editing History

Modificar una Receipt histórica después de haber generado stock.

---

## Cross-Tenant Purchase

Utilizar Supplier/Product de otra Company.

---

## Notes as Data Model

Guardar lote, cantidad o caducidad únicamente dentro de una nota.

---

# 96. Relación con Inventory

`PURCHASES.md` define:

> por qué y cuánto se compra y recibe.

`INVENTORY.md` define:

> cómo esa recepción se representa como existencia física trazable.

La frontera es:

```text
PurchaseReceipt
↓
Inventory
```

---

# 97. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-012 — Entity Lifecycle.

---

# 98. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
architecture/ARCHITECTURE.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
ux/DESIGN_SYSTEM.md
product/ZAPING_WAY.md
modules/erp/INVENTORY.md
```

---

# 99. Fuente de verdad

Este documento constituye la fuente de verdad documental para las reglas funcionales de Purchases y Purchase Receipts.

El código es la fuente técnica para:

* campos exactos;
* DTOs;
* endpoints actualmente disponibles;
* implementación;
* tests.

Los ADR constituyen la fuente para decisiones arquitectónicas.

---

# 100. Principio final

La operación debe representar la realidad:

```text
Comprar
≠
Recibir
```

Por tanto:

```text
Purchase
↓
confirma intención de abastecimiento

PurchaseReceipt
↓
confirma recepción física

Inventory
↓
registra la consecuencia
```

> **El inventario aumenta cuando la mercancía realmente entra, no cuando se ordena.**
