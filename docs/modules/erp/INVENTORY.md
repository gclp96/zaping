# Inventory — Zaping ERP

**Módulo:** Inventory
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / EVOLVING
**Última actualización:** 2026-08-20
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Inventory administra la verdad física y trazable de las existencias controladas por una Company.

Debe responder:

```text
¿Qué inventario posee la empresa?
¿Qué producto?
¿Qué cantidad?
¿Qué lote?
¿Qué caducidad?
¿Dónde se encuentra?
¿Cuánto está disponible?
¿Qué movimiento produjo ese estado?
```

Inventory es un dominio central de Zaping ERP.

---

# 2. Principio fundamental

> **Stock es consecuencia de movimientos confirmados. Nunca debe ser un dato que el usuario modifique directamente como operación ordinaria.**

La dirección conceptual es:

```text
Business Document
↓
Confirmed Physical Event
↓
Inventory Movement
↓
Inventory Position / Stock Projection
```

---

# 3. Estado actual

Actualmente Zaping cuenta con capacidades funcionales de Inventory basadas principalmente en:

```text
Product.stock

InventoryMovement

InventoryBatch

PurchaseReceipt
```

Se encuentran implementadas capacidades como:

* movimientos de entrada y salida;
* actualización de stock;
* inventario por lote;
* caducidad;
* integración con Purchase Receipts;
* validaciones de cantidades;
* transacciones Prisma para operaciones críticas.

---

# 4. Limitación del modelo actual

El modelo actual responde principalmente:

```text
¿Cuántas unidades tiene la Company?
```

pero todavía no representa completamente:

```text
¿Dónde están esas unidades?
```

ni distingue de forma general entre:

```text
Warehouse Available
Case Staging
Temporary Custody
Inspection
Quarantine
Damaged
```

---

# 5. Arquitectura objetivo aprobada

ADR-014 aprueba la evolución de Inventory hacia:

```text
InventoryLocation

InventoryPosition

InventoryMovement
├── IN
├── TRANSFER
├── OUT
└── ADJUSTMENT / correction semantics
```

Estas capacidades pertenecen a:

```text
ERP Core
```

y no exclusivamente a Healthcare.

---

# 6. CURRENT vs TARGET

## CURRENT

Actualmente:

```text
Product.stock
→ aggregate stock projection

InventoryMovement
→ movement history

InventoryBatch
→ lot / expiration traceability
```

## TARGET

Inventory evolucionará hacia:

```text
InventoryMovement
→ historical physical ledger

InventoryPosition
→ current quantity by location

Product.stock
→ transitional aggregate Company-owned projection

InventoryLocation
→ physical/logical position
```

---

# 7. Product.stock

Actualmente:

```text
Product.stock
```

representa la proyección agregada de existencia.

Debe continuar tratándose como:

```text
derived value
```

y no como input manual ordinario.

---

# 8. Semántica futura de Product.stock

Con Inventory Locations:

```text
Product.stock
```

deberá representar conceptualmente:

```text
Company-owned aggregate quantity
```

no necesariamente:

```text
immediately available warehouse quantity
```

---

# 9. Ejemplo

```text
Product A

Product.stock:
20
```

puede significar en arquitectura TARGET:

```text
Warehouse Available:   12
Case Staging:            3
Custody:                 4
Inspection:              1

Company-owned:
20
```

---

# 10. Owned vs Available

Debe mantenerse:

```text
Company-owned quantity
≠
Available quantity
```

---

# 11. Company-owned

Representa inventario que continúa perteneciendo a la Company independientemente de su posición física.

---

# 12. Available

Representa inventario elegible para una nueva operación.

Puede depender de:

```text
Location
Batch status
Expiration
Reservation future
Condition
Other business rules
```

---

# 13. Ejemplo

Una unidad puede:

```text
existir físicamente
+
pertenecer a Company
```

pero no estar disponible porque se encuentra:

```text
en custodia
en inspección
en cuarentena
vencida
dañada
```

---

# 14. InventoryMovement

`InventoryMovement` representa un hecho físico confirmado que modifica una o más posiciones de inventario.

Es parte del ledger histórico de Inventory.

---

# 15. Movimiento confirmado

Un movimiento confirmado debe considerarse:

```text
historical fact
```

y no debe reescribirse silenciosamente.

---

# 16. Correcciones

Si un movimiento confirmado es incorrecto:

```text
→ compensating / corrective movement
```

No:

```text
→ edit historical quantity
```

---

# 17. Tipos TARGET

La semántica objetivo aprobada es:

```text
IN
TRANSFER
OUT
ADJUSTMENT / correction
```

---

# 18. IN

`IN` significa que inventario entra al control/propiedad de la Company.

Ejemplo:

```text
Supplier
↓
Purchase Receipt
↓
IN
↓
Warehouse
```

Un `IN` incrementa:

```text
Company-owned quantity
```

---

# 19. TRANSFER

`TRANSFER` significa que el inventario cambia de posición interna sin abandonar la propiedad de la Company.

Ejemplo:

```text
Warehouse
↓
TRANSFER
↓
Case Staging
```

---

# 20. Otro TRANSFER

```text
Case Staging
↓
TRANSFER
↓
Temporary Custody
```

---

# 21. Invariante TRANSFER

```text
Company-owned before
=
Company-owned after
```

---

# 22. OUT

`OUT` representa una disposición física definitiva que reduce la existencia propiedad/controlada por la Company.

Ejemplo normal:

```text
Warehouse
↓
Delivery
↓
OUT
↓
Customer
```

---

# 23. Healthcare OUT futuro

También podrá ocurrir:

```text
Temporary Custody
↓
Used Material
↓
Delivery / final disposition
↓
OUT
```

sin volver a descontar inventario que previamente solo había sido transferido.

---

# 24. Regla crítica

```text
TRANSFER
≠
OUT
```

---

# 25. InventoryLocation

`InventoryLocation` representa una posición física o lógica donde puede encontrarse inventario.

Es una capacidad `TARGET` aprobada por ADR-014.

---

# 26. Ejemplos conceptuales

```text
WAREHOUSE
STAGING
CUSTODY
INSPECTION
QUARANTINE
DAMAGED
OTHER
```

Los nombres de enum definitivos se decidirán durante Prisma Design.

---

# 27. Core, no Healthcare

Inventory no debe incluir tipos como:

```text
SURGERY
CASE
CASE_KIT
```

como conceptos internos del ERP Core.

Healthcare utiliza Locations genéricas.

---

# 28. Responsabilidad

Inventory responde:

```text
¿Dónde está el inventario?
```

El módulo que originó la operación responde:

```text
¿Por qué está ahí?
¿Para qué documento?
¿Quién es responsable?
```

---

# 29. Default Warehouse

Toda Company que utiliza Inventory necesitará conceptualmente una ubicación base.

Ejemplo:

```text
Main Warehouse
```

---

# 30. Multi-Warehouse

ADR-014 no declara Multi-Warehouse completo implementado.

Sin embargo, `InventoryLocation` debe diseñarse de forma compatible con esa evolución.

---

# 31. InventoryPosition

`InventoryPosition` representa la cantidad actual de un Product en una Location.

Cuando exista lote:

```text
Product
+
InventoryBatch
+
InventoryLocation
=
InventoryPosition
```

---

# 32. Ejemplo

```text
Product A
Lot L001
Main Warehouse
Quantity 8
```

y:

```text
Product A
Lot L001
Custody
Quantity 2
```

---

# 33. InventoryPosition no es input libre

Nunca:

```text
User
→ InventoryPosition.quantity = 500
```

como operación normal.

Position debe ser consecuencia del ledger.

---

# 34. Ledger vs Position

Debe mantenerse:

```text
InventoryMovement
→ historical source of truth
```

```text
InventoryPosition
→ current operational projection
```

---

# 35. Persistencia de Position

Puede persistirse para:

```text
performance
availability queries
transactions
concurrency
```

siempre que permanezca reconciliable contra los movimientos.

---

# 36. InventoryBatch

`InventoryBatch` representa trazabilidad física por lote.

Puede contener información como:

```text
Product
Lot Number
Expiration Date
Quantity / position relationships
```

según el modelo técnico vigente/evolucionado.

---

# 37. Lot consistency

Debe cumplirse:

```text
InventoryBatch.product
=
Movement.product
```

---

# 38. Tenant consistency

También:

```text
InventoryBatch.company
=
InventoryMovement.company
=
InventoryLocation.company
```

---

# 39. Expiration

Un lote vencido:

```text
continúa existiendo físicamente
```

pero normalmente:

```text
no está disponible para venta o preparación
```

---

# 40. FEFO

FEFO permanece como capacidad objetivo prioritaria.

Debe seleccionar entre:

```text
eligible InventoryPositions
```

considerando:

```text
expirationDate
```

---

# 41. Purchase Receipt

La regla existente permanece:

```text
Purchase
≠
Inventory
```

---

# 42. Regla

Crear o confirmar una Purchase por sí sola:

```text
→ no genera Inventory IN
```

---

# 43. Entrada física

La entrada ocurre mediante:

```text
PurchaseReceipt
```

---

# 44. TARGET Receipt

Con ADR-014:

```text
PurchaseReceipt
↓
InventoryMovement IN
↓
Default Warehouse Location
```

---

# 45. Partial Receipts

Una Purchase puede recibir:

```text
Receipt 1
Receipt 2
Receipt 3
```

hasta completar cantidades.

---

# 46. Over-receipt

No debe permitirse recibir cantidades superiores a las pendientes salvo un workflow explícito futuro.

---

# 47. Receipt + Batch

Cuando existe lote:

```text
PurchaseReceiptItem
↓
InventoryBatch
↓
Inventory IN
↓
Warehouse Position
```

debe ocurrir consistentemente.

---

# 48. Atomicidad de Receipt

La operación debe garantizar conjuntamente:

```text
Receipt
+
Batch
+
InventoryMovement
+
InventoryPosition TARGET
+
Product.stock projection
```

---

# 49. Failure

Nunca:

```text
Receipt created
✓

Inventory update
✗
```

---

# 50. Sales

La arquitectura objetivo continúa siguiendo ADR-011:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

---

# 51. Quote

Crear Quote:

```text
→ no Inventory movement
```

---

# 52. SalesOrder

Crear o confirmar SalesOrder:

```text
→ no physical Inventory OUT
```

por sí mismo.

La Reservation futura es una decisión separada.

---

# 53. Delivery

La salida física comercial ocurre mediante:

```text
Delivery
↓
Inventory OUT
```

---

# 54. Source Location TARGET

Delivery deberá poder conocer:

```text
from which Inventory Location
```

se realiza el fulfillment.

---

# 55. Venta normal

```text
Warehouse
↓ OUT
Delivery
```

---

# 56. Healthcare commercial fulfillment

Cuando el material ya se encuentra bajo custodia:

```text
Custody
↓ OUT
Delivery
```

---

# 57. Regla crítica de integración

> **La misma unidad física nunca puede sufrir dos OUT definitivos por el mismo hecho comercial.**

---

# 58. Healthcare Preparation

Healthcare descubre una nueva operación física:

```text
Warehouse
↓
Case Staging
```

---

# 59. CaseKit Draft

Crear requerimientos:

```text
→ no Inventory movement
```

---

# 60. Confirm Preparation TARGET

Cuando Warehouse físicamente separa material:

```text
Warehouse
↓ TRANSFER
Staging
```

---

# 61. Consecuencia

Las unidades:

```text
continúan siendo Company-owned
```

pero:

```text
dejan de estar disponibles para operaciones no relacionadas
```

---

# 62. Healthcare Dispatch TARGET

```text
Staging
↓ TRANSFER
Custody
```

o, cuando corresponda:

```text
Warehouse
↓ TRANSFER
Custody
```

---

# 63. Dispatch no es OUT

Se mantiene:

```text
CaseDispatch
≠
Commercial Inventory OUT
```

---

# 64. Healthcare Return TARGET

```text
Custody
↓ TRANSFER
Inspection
```

---

# 65. Return no significa Available

Se mantiene:

```text
Returned
≠
Automatically Available
```

---

# 66. Inspection approved

```text
Inspection
↓ TRANSFER
Warehouse Available
```

---

# 67. Inspection exception

También puede ocurrir:

```text
Inspection
↓
Quarantine
```

o:

```text
Inspection
↓
Damaged
```

según disposition.

---

# 68. Healthcare Consumption TARGET

Material utilizado puede producir:

```text
Custody
↓ OUT
Final disposition
```

---

# 69. Consumo comercial

Cuando existe fulfillment:

```text
CaseConsumption
↓
Delivery
↓
Inventory OUT
```

desde la posición física correcta.

---

# 70. Consumo no comercial

Puede existir otra disposition autorizada.

Ejemplos futuros:

```text
sample
internal consumption
loss
other
```

Cada una deberá seguir reglas de Inventory.

---

# 71. Custody

Inventory conoce la posición:

```text
CUSTODY
```

Healthcare conserva:

```text
Case
Dispatch
Custodian User
```

---

# 72. Separación modular

No debe agregarse:

```text
InventoryLocation.healthcareCaseId
```

como dependencia obligatoria.

---

# 73. Razón

La dependencia debe ser:

```text
Healthcare
↓
Inventory
```

y no:

```text
Inventory
↓
Healthcare
```

---

# 74. Staging

No se requiere inicialmente:

```text
one InventoryLocation per Case
```

---

# 75. Estrategia inicial

Puede existir una Location lógica:

```text
CASE STAGING
```

mientras Healthcare conserva asignaciones por Case.

---

# 76. Custody por User

Tampoco se requiere inicialmente:

```text
one InventoryLocation per Technician
```

---

# 77. Primera estrategia

Inventory registra:

```text
CUSTODY
```

Healthcare registra:

```text
custodianUserId
```

---

# 78. Evolución futura

Si el Core requiere consultas genéricas por custodio, podrá generalizarse la relación Location ↔ responsible actor.

---

# 79. Reservations

ADR-014 no introduce todavía un sistema completo de Reservation.

---

# 80. Diferencia

```text
Reservation
→ claim on inventory
```

```text
Staging
→ inventory physically separated
```

---

# 81. Reservation futura

Será útil cuando:

```text
inventory is committed
but still physically remains in normal Warehouse position
```

---

# 82. Staging como primera garantía física

Una vez material físicamente preparado:

```text
TRANSFER Warehouse → Staging
```

evita que permanezca disponible para otro workflow.

---

# 83. Negative stock

Debe mantenerse:

```text
No InventoryPosition may become negative
```

---

# 84. Ejemplo

```text
Warehouse available:
3
```

No puede ejecutarse:

```text
TRANSFER 5
```

---

# 85. Concurrencia

Inventory debe impedir:

```text
same quantity
→ Case A
+
→ Case B
```

simultáneamente.

---

# 86. Transacciones

Movimientos físicos críticos deben usar transacciones de base de datos.

---

# 87. TRANSFER atomicidad

```text
decrease source
+
increase destination
+
create movement
```

debe ser una sola operación consistente.

---

# 88. OUT atomicidad

```text
decrease source
+
create OUT movement
+
update aggregate projection
```

también.

---

# 89. Idempotencia

Confirmaciones originadas por documentos deben evitar duplicación por:

```text
double click
network retry
repeated request
```

---

# 90. Ejemplo

Reintentar:

```text
Confirm Dispatch
```

no debe generar:

```text
TRANSFER × 2
```

---

# 91. Reference

InventoryMovement debe conservar una referencia suficiente hacia el documento que originó el movimiento.

Ejemplos:

```text
PurchaseReceipt
Delivery
Case Preparation
CaseDispatch
CaseReturn
Adjustment
```

---

# 92. Referencia no sustituye integridad

`referenceType/referenceId` o una estrategia equivalente no autoriza relaciones cross-tenant ni operaciones inválidas.

---

# 93. Correcciones

Un movimiento físico confirmado no se corrige modificándolo.

---

# 94. Compensación

Ejemplo:

Se transfirieron por error:

```text
Warehouse
↓
Custody
5
```

pero correspondían 4.

La solución debe registrar una corrección, conceptualmente:

```text
Custody
↓
Warehouse
1
```

con contexto de corrección.

---

# 95. Adjustments

Adjustments deben utilizarse para diferencias físicas reales que no corresponden a un flujo normal.

---

# 96. No utilizar Adjustment para ocultar bugs

Nunca:

```text
system double decremented
↓
create arbitrary adjustment
```

sin corregir la causa y conservar trazabilidad.

---

# 97. Equipment

`EquipmentAsset` se considera actualmente candidato a capacidad ERP Core.

---

# 98. Equipment no es cantidad normal

Debe distinguirse:

```text
Product quantity
```

de:

```text
individual EquipmentAsset
```

---

# 99. Locations

Equipment puede reutilizar semántica de ubicación/custodia.

Pero no necesariamente debe utilizar:

```text
InventoryPosition.quantity
```

como fuente de identidad.

---

# 100. Serial tracking

El tracking serializado general todavía requiere diseño técnico específico.

No debe improvisarse exclusivamente para Healthcare.

---

# 101. Availability Query TARGET

Conceptualmente:

```text
Available Quantity
=
sum(
    eligible InventoryPositions
)
```

considerando:

```text
Company
Product
Location
Batch
Expiration
other eligibility rules
```

---

# 102. Owned Query TARGET

```text
Company-owned Quantity
=
sum(
    all company-owned positions
)
```

---

# 103. Product Inventory 360 futuro

Una vista debería poder mostrar:

```text
Product A

Owned:
20

Available:
12

Staging:
3

Custody:
4

Inspection:
1
```

---

# 104. Movement History

Debe mostrar origen/destino.

Ejemplo:

```text
IN
Supplier → Warehouse

TRANSFER
Warehouse → Staging

TRANSFER
Staging → Custody

TRANSFER
Custody → Inspection

TRANSFER
Inspection → Warehouse

OUT
Custody → External
```

---

# 105. Traceability

Debe poder reconstruirse:

```text
Receipt
↓
Batch
↓
Location
↓
Transfer
↓
Custody
↓
Return / Consumption
```

---

# 106. Multi-tenancy

Todo Inventory debe operar dentro del tenant autenticado.

---

# 107. Invariante

```text
Movement.company
=
Product.company
=
Location.company
=
Batch.company
```

cuando las relaciones existan.

---

# 108. Backend authority

Frontend no determina arbitrariamente:

```text
companyId
source Location
destination Location
stock result
```

sin validación.

---

# 109. Permissions TARGET

Capacidades futuras pueden incluir:

```text
inventory.read
inventory.adjust

inventory.locations.read
inventory.locations.manage

inventory.transfers.create
inventory.transfers.confirm
```

---

# 110. Workflows especializados

Un usuario puede confirmar:

```text
CaseDispatch
```

sin tener acceso a una pantalla genérica:

```text
Manual Inventory Transfer
```

si la Application Layer autoriza esa operación especializada.

---

# 111. Modular boundaries

Healthcare no debe modificar directamente tablas internas de Inventory desde su lógica de dominio.

---

# 112. Regla

Conceptualmente:

```text
Healthcare workflow
↓
Inventory capability
↓
Inventory invariants
↓
Persistence
```

---

# 113. Current Prisma

La existencia actual del schema no implica que las entidades TARGET estén implementadas.

Actualmente:

```text
InventoryLocation
InventoryPosition
TRANSFER semantics
```

deben considerarse:

```text
APPROVED TARGET
NOT IMPLEMENTED
```

hasta completar migración y código.

---

# 114. Migración

ADR-014 exige una migración incremental.

---

# 115. Paso inicial

Cada Company con Inventory deberá recibir una:

```text
Default Warehouse Location
```

---

# 116. Posiciones iniciales

El inventario existente deberá migrarse a esa ubicación.

---

# 117. Reconciliación previa

Antes de migrar debe compararse:

```text
Product.stock
InventoryBatch totals
InventoryMovement history
```

hasta donde los datos actuales permitan hacerlo.

---

# 118. Discrepancias

No deben corregirse silenciosamente.

Deben:

```text
detectarse
documentarse
resolverse
```

---

# 119. Historical movements

Los movimientos históricos anteriores a Locations pueden mantenerse como:

```text
legacy / location unknown
```

si no existe información confiable para reconstruir su posición.

---

# 120. No inventar historia

Nunca asignar retrospectivamente una Location histórica únicamente para hacer que el modelo nuevo parezca completo.

---

# 121. Backward compatibility

Durante transición:

```text
Product.stock
```

puede continuar actualizándose junto con las nuevas posiciones.

---

# 122. Retiro de Product.stock

Solo podrá evaluarse cuando:

```text
all operational modules
reports
queries
tests
```

utilicen correctamente la arquitectura location-aware.

---

# 123. Secuencia técnica aprobada

```text
InventoryLocation
↓
InventoryPosition
↓
TRANSFER semantics
↓
Default Warehouse migration
↓
PurchaseReceipt integration
↓
Existing OUT integration
↓
Healthcare Staging
↓
Healthcare Custody
↓
Return / Inspection
↓
Healthcare Consumption
↓
Delivery integration
```

---

# 124. No big-bang rewrite

No modificar simultáneamente todo Inventory + Sales + Healthcare en una sola migración.

---

# 125. Testing

Antes de producción deben probarse al menos:

```text
IN
TRANSFER
OUT
ADJUSTMENT
```

---

# 126. TRANSFER tests

Debe verificarse:

```text
source decreases
destination increases
Company-owned unchanged
negative source blocked
cross-tenant blocked
batch mismatch blocked
duplicate retry blocked
```

---

# 127. PurchaseReceipt regression

Debe verificarse:

```text
Receipt
→ one IN
→ correct Warehouse position
→ stock increases once
```

---

# 128. Sales regression

Debe verificarse:

```text
Delivery
→ one OUT
→ correct source position
→ Company stock decreases once
```

---

# 129. Healthcare Preparation test

```text
Warehouse
↓ TRANSFER
Staging
```

debe:

```text
decrease Available
preserve Owned
```

---

# 130. Healthcare Dispatch test

```text
Staging
↓ TRANSFER
Custody
```

debe:

```text
preserve Owned
```

---

# 131. Healthcare Return test

```text
Custody
↓ TRANSFER
Inspection
```

debe:

```text
not restore Available automatically
```

---

# 132. Inspection pass test

```text
Inspection
↓ TRANSFER
Warehouse
```

debe devolver disponibilidad cuando el lote/recurso sea elegible.

---

# 133. Healthcare Consumption test

```text
Custody
↓ OUT
```

debe reducir Company-owned una sola vez.

---

# 134. Double decrement regression

Debe existir una prueba explícita para garantizar:

```text
CaseDispatch
+
Commercial Delivery
```

sobre la misma unidad:

```text
→ exactly one definitive OUT
```

---

# 135. Métricas futuras

Inventory podrá responder:

```text
Owned
Available
Staged
In Custody
Inspection
Quarantine
Damaged
```

sin crear fuentes paralelas de stock.

---

# 136. Dashboard

Dashboard puede consumir estas proyecciones.

No debe recalcular sus propias reglas de Inventory.

---

# 137. Warehouse Operations

Warehouse puede utilizar Inventory como fuente para:

```text
receipts
preparation
dispatch
returns
inspection
deliveries
```

sin convertirse en otro ledger.

---

# 138. CURRENT

Implementado actualmente:

```text
Inventory movements
Product stock projection
Inventory batches
Purchase Receipt integration
transactional stock updates
```

---

# 139. APPROVED TARGET

Aprobado arquitectónicamente:

```text
InventoryLocation
InventoryPosition
TRANSFER
Location-aware IN/OUT
Owned vs Available
Healthcare Staging
Healthcare Custody
Inspection positions
Location-aware Delivery
```

---

# 140. FUTURE

Fuera del cambio inicial:

```text
advanced reservations
full multiwarehouse
bins
warehouse routes
serial tracking generalized
barcode / QR
advanced FEFO
inventory valuation
WMS
```

---

# 141. Invariantes principales

```text
Stock
→ consequence of movements
```

```text
Confirmed movement
→ immutable
```

```text
Correction
→ compensating event
```

```text
IN
→ increases Company-owned
```

```text
TRANSFER
→ does not change Company-owned
```

```text
OUT
→ decreases Company-owned
```

```text
InventoryPosition
→ never negative
```

```text
Available
≠
Owned
```

```text
Product.stock
→ not direct user input
```

```text
Purchase
≠
Inventory entry
```

```text
PurchaseReceipt
→ Inventory IN
```

```text
SalesOrder
→ no physical OUT
```

```text
Delivery
→ Inventory OUT
```

```text
CaseKit Draft
→ no Inventory movement
```

```text
Confirmed physical Preparation
→ may TRANSFER to Staging
```

```text
CaseDispatch
→ TRANSFER, not commercial OUT
```

```text
CaseReturn
→ TRANSFER to Inspection
```

```text
Returned
≠
Available
```

```text
Healthcare Consumption
→ definitive OUT when applicable
```

```text
Same physical quantity
→ cannot exist in two positions
```

```text
Same physical quantity
→ cannot be OUT twice
```

```text
Cross-tenant movement
→ forbidden
```

---

# 142. Anti-patrones

## Direct Stock Editing

```text
product.stock = userInput
```

---

## Purchase = Inventory

Aumentar stock cuando se crea o aprueba una Purchase.

---

## SalesOrder = OUT

Descontar físicamente antes del Delivery.

---

## Dispatch = OUT

Tratar custodia Healthcare como venta.

---

## Return = Available

Reintegrar automáticamente material sin inspección.

---

## One stock number for everything

No distinguir ubicación/disponibilidad.

---

## HealthcareInventory

Crear un segundo stock exclusivo para Healthcare.

---

## UI-only custody

Mostrar material en custodia pero seguir permitiendo utilizarlo desde Warehouse.

---

## Fake reservation

Indicar “apartado” sin protección transaccional real.

---

## Manual Position Editing

Modificar posiciones directamente para cuadrar cantidades.

---

## Rewrite Movement History

Editar movimientos confirmados.

---

## Cross-module Prisma mutation

Healthcare modificando directamente posiciones sin aplicar reglas Inventory.

---

## Double OUT

Descontar en Dispatch y volver a descontar en Delivery.

---

# 143. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-011 — SalesOrder + Delivery.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.
* ADR-014 — Inventory Locations and Internal Transfers.

---

# 144. Documentos relacionados

```text
modules/erp/PRODUCTS.md
modules/erp/PURCHASES.md
modules/erp/SALES.md
modules/erp/RETURNS.md

modules/healthcare/DOMAIN_MODEL.md
modules/healthcare/CASE_KITS.md
modules/healthcare/CASE_LOGISTICS.md
modules/healthcare/EQUIPMENT.md

architecture/ARCHITECTURE.md
architecture/adr/ADR-002-*.md
architecture/adr/ADR-013-*.md
architecture/adr/ADR-014-inventory-locations-and-internal-transfers.md
```

---

# 145. Fuente de verdad

```text
INVENTORY.md
→ comportamiento funcional de Inventory

ADR-002
→ movements as inventory truth

ADR-014
→ locations / positions / transfers architecture

PURCHASES.md
→ physical inventory entry through Receipts

SALES.md
→ commercial fulfillment through Delivery

CASE_KITS.md
→ Healthcare Preparation

CASE_LOGISTICS.md
→ Healthcare Custody / Return / Consumption

schema.prisma
→ current technical implementation

PROJECT_BOARD.md
→ implementation status
```

---

# 146. Estado de implementación

La documentación distingue deliberadamente:

```text
CURRENT
```

de:

```text
APPROVED TARGET
```

La existencia de ADR-014 no significa que:

```text
InventoryLocation
InventoryPosition
TRANSFER
```

ya estén implementados.

---

# 147. Próximo paso técnico

Antes de modificar Prisma debe existir un diseño técnico específico que detalle:

```text
InventoryLocation schema
InventoryPosition uniqueness
Movement schema changes
Batch/location relationship
Default Warehouse creation
Migration/backfill
Product.stock compatibility
transaction boundaries
service boundaries
```

---

# 148. Principio final

Inventory debe dejar de responder únicamente:

```text
¿Cuánto tengo?
```

y evolucionar hacia:

```text
¿Cuánto tengo?
↓
¿Dónde está?
↓
¿Cuánto está disponible?
↓
¿Qué parte está comprometida físicamente?
↓
¿Qué parte está bajo custodia?
↓
¿Qué parte está en inspección?
↓
¿Qué movimiento explica cada cambio?
```

sin perder una única historia física coherente.

> **Una transferencia cambia dónde está el inventario; una salida cambia cuánto inventario continúa perteneciendo a la Company. Zaping debe preservar esa diferencia en todo momento.**
