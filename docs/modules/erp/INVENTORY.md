# Inventory — Zaping ERP

**Módulo:** Inventory
**Producto:** Zaping ERP Core
**Versión:** 2.2.0
**Estado:** Aprobado
**Estado de implementación:** INVENTORY V1 LEDGER IMPLEMENTED / VALIDATED; LOCATION-AWARE INVENTORY TARGET
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Inventory administra la cantidad, trazabilidad y movimientos de las existencias
controladas por una Company.

Actualmente debe responder principalmente:

```text
¿Qué Product existe en inventario?

¿Cuántas unidades existen?

¿Qué movimiento produjo ese cambio?

¿Qué lote corresponde cuando aplica?

¿Qué caducidad posee ese lote?
```

La evolución aprobada deberá permitir además responder:

```text
¿Dónde está esa cantidad?

¿Cuánto está disponible?

¿Cuánto continúa perteneciendo a la Company?

¿Qué movimiento explica cada cambio de posición?
```

Inventory es un dominio central de Zaping ERP Core.

---

# 2. Ownership

Inventory es propietario de conceptos como:

```text
Product.stock projection

InventoryMovement

InventoryBatch

inventory quantity semantics

inventory IN

inventory OUT

approved target InventoryLocation

approved target InventoryPosition

approved target TRANSFER
```

Inventory no es propietario de:

```text
Product catalog definition

EquipmentAsset physical identity

Equipment lifecycle

Equipment condition

Equipment Inspection

Equipment Retirement

Healthcare Case

Case Equipment Assignment

Healthcare Custody
```

Debe mantenerse:

```text
Inventory
→ quantity / batch / movement truth
```

mientras:

```text
Equipment
→ individual reusable ASSET identity
```

---

# 3. Principio fundamental

> **Stock debe ser consecuencia de operaciones controladas de inventario y no un
> valor que el usuario edite libremente como operación ordinaria.**

Conceptualmente:

```text
Business Operation
↓
Confirmed Inventory Effect
↓
InventoryMovement
+
Stock Projection
```

Cuando una misma operación modifica ambos:

```text
Product.stock
+
InventoryMovement
```

deben mantenerse consistentes dentro de la misma unidad de negocio.

---

# 4. CURRENT vs TARGET vs FUTURE

Este documento distingue:

## CURRENT

Capacidad implementada actualmente.

## TARGET

Arquitectura aprobada pero todavía no implementada.

## FUTURE

Capacidades posteriores cuya implementación dependerá de necesidad y prioridad.

No debe interpretarse una arquitectura TARGET como una capacidad disponible hoy.

---

# 5. Estado CURRENT

Actualmente Inventory utiliza principalmente:

```text
Product.stock

InventoryMovement

InventoryBatch

PurchaseReceipt

Sale
```

Están implementados:

```text
aggregate stock projection

InventoryMovement ledger

IN

OUT

ADJUSTMENT movement type

InventoryBatch

lot / expiration traceability

PurchaseReceipt → Inventory IN

Sale CONFIRMED → Inventory OUT

transactional stock mutation in supported workflows

frontend Inventory workspace

movement history

reference-based Receipt deep-link
```

---

# 6. Modelo CURRENT simplificado

```text
Product
├── stock
├── inventoryTracking
└── lotTracking

InventoryBatch
├── Product
├── lotNumber
└── expirationDate

InventoryMovement
├── Product
├── movementType
├── quantity
├── balance
├── unitCost
├── referenceType
├── referenceId
└── notes
```

La definición técnica exacta pertenece a:

```text
schema.prisma
```

---

# 7. Product.stock

Actualmente:

```text
Product.stock
```

es un campo persistido que funciona como:

```text
aggregate inventory projection
```

No debe interpretarse como una entrada libre del usuario.

La arquitectura actual mantiene esta proyección mediante operaciones controladas
como:

```text
Purchase Receipt

Sale approval
```

---

# 8. Product.stock no es ledger

Debe distinguirse:

```text
Product.stock
→ current aggregate projection
```

de:

```text
InventoryMovement
→ history explaining inventory changes
```

Actualmente `Product.stock` no se reconstruye automáticamente desde cero
reproduciendo todo el ledger en cada consulta.

Por tanto debe mantenerse consistente mediante las operaciones de dominio que lo
modifican.

---

# 9. Product.stock no es disponibilidad futura

Actualmente:

```text
Product.stock
```

representa una cantidad agregada.

En la arquitectura TARGET podrá representar:

```text
Company-owned aggregate quantity
```

y no necesariamente:

```text
immediately available warehouse quantity
```

Debe mantenerse conceptualmente:

```text
Owned
≠
Available
```

---

# 10. InventoryMovement — CURRENT

Actualmente `InventoryMovement` representa el historial de mutaciones de
inventario agregado.

Tipos observados/implementados:

```text
IN

OUT

ADJUSTMENT
```

Actualmente no existe:

```text
TRANSFER
```

como semántica completa location-aware implementada.

`TRANSFER` pertenece a TARGET.

---

# 11. Ledger histórico

Un `InventoryMovement` confirmado debe tratarse como un hecho histórico.

Principio:

```text
Confirmed InventoryMovement
→ historical fact
```

No debe editarse silenciosamente para cambiar el pasado.

---

# 12. Correcciones

Si una mutación histórica fue incorrecta, la dirección arquitectónica es:

```text
corrective / compensating operation
```

y no:

```text
rewrite confirmed historical movement
```

El workflow completo de correcciones todavía requiere diseño específico.

---

# 13. ADJUSTMENT

El tipo:

```text
ADJUSTMENT
```

forma parte del ledger actual y puede mostrarse en Inventory.

Sin embargo:

```text
Manual Adjustment UI / workflow
→ NOT IMPLEMENTED as normal Inventory V1 operation
```

No debe confundirse:

```text
movement type exists
```

con:

```text
complete manual adjustment workflow exists
```

---

# 14. Manual stock editing

No debe existir como operación ordinaria:

```text
User
↓
product.stock = arbitrary value
```

Si el inventario físico difiere del sistema, debe existir una operación explícita
y trazable que explique la corrección.

---

# 15. Balance

Los movimientos actuales conservan:

```text
balance
```

como el stock posterior a la mutación correspondiente.

Esto permite reconstruir y auditar el efecto de operaciones como:

```text
PurchaseReceipt IN

Sale OUT
```

---

# 16. InventoryBatch

`InventoryBatch` representa trazabilidad por lote.

Conceptualmente contiene información relacionada con:

```text
Company

Product

lotNumber

expirationDate

quantity / cost information according to current schema
```

Debe mantenerse:

```text
Batch
≠
Product
```

y:

```text
Batch
≠
EquipmentAsset
```

---

# 17. Lot Tracking

Product utiliza:

```text
NONE

OPTIONAL

REQUIRED
```

como estrategia de `ProductLotTracking`.

Las reglas actuales completas de recepción pertenecen a:

```text
PURCHASE_RECEIPTS.md
```

Inventory consume esa trazabilidad mediante `InventoryBatch`.

---

# 18. Lot consistency

Debe cumplirse:

```text
InventoryBatch.product
=
Inventory operation Product
```

y:

```text
InventoryBatch.company
=
authenticated Company
```

cuando el workflow utiliza Batch.

---

# 19. Expiration

Un lote puede seguir existiendo físicamente aunque esté vencido.

Debe mantenerse conceptualmente:

```text
Exists
≠
Eligible for new use
```

La política completa de elegibilidad basada en caducidad pertenece a la evolución
de Availability/FEFO de Inventory.

---

# 20. Purchase ≠ Inventory IN

Debe mantenerse:

```text
Purchase
≠
Inventory receipt
```

Crear o confirmar una Purchase:

```text
→ does not increase Product.stock
```

y:

```text
→ does not create the physical Inventory IN
```

---

# 21. PurchaseReceipt → Inventory IN

La entrada física ocurre mediante:

```text
PurchaseReceipt
```

Flujo CURRENT:

```text
Purchase CONFIRMED / PARTIALLY_RECEIVED
↓
PurchaseReceipt
↓
InventoryMovement IN
+
Product.stock increment
```

La Receipt es el documento que explica la entrada física.

---

# 22. Partial Receipts

Una Purchase puede recibirse mediante múltiples Receipts.

Ejemplo:

```text
Purchase quantity = 10

Receipt A = 4

Receipt B = 3

Receipt C = 3
```

El stock aumenta únicamente por las cantidades efectivamente recibidas.

---

# 23. Over-receipt

Actualmente se bloquea recibir una cantidad superior al pendiente.

Debe mantenerse:

```text
quantityReceived
≤
quantityPending
```

salvo que en el futuro exista un workflow explícito distinto.

---

# 24. PurchaseReceipt + Batch

Cuando una partida recibida utiliza lote:

```text
PurchaseReceiptItem
↓
InventoryBatch
↓
InventoryMovement IN
```

deben mantener:

```text
same Company

same Product
```

---

# 25. Atomicidad de Receipt

Purchase Receipt coordina en una sola transacción los efectos que corresponden a
la recepción.

Puede incluir:

```text
PurchaseReceipt

PurchaseReceiptItems

InventoryBatch

Equipment provisioning when ASSET

Product.stock

InventoryMovement IN

Purchase status
```

Debe evitarse:

```text
Receipt created
+
Inventory mutation missing
```

o:

```text
Inventory mutation committed
+
Receipt missing
```

---

# 26. PurchaseReceipt idempotency

La creación de Purchase Receipts utiliza actualmente:

```text
Idempotency-Key
```

con protección implementada para:

```text
same logical retry
→ replay same Receipt
```

```text
same key + different payload
→ conflict
```

```text
same key in another Company
→ independent scope
```

La operación utiliza transacción `Serializable` y cuenta con manejo del camino
de conflicto idempotente.

Permanece como deuda de QA:

```text
real simultaneous PostgreSQL concurrency race
```

La especificación completa pertenece a:

```text
PURCHASE_RECEIPTS.md
```

---

# 27. Sale — CURRENT

Actualmente el flujo comercial implementado utiliza:

```text
Sale
```

No:

```text
SalesOrder + Delivery
```

como workflow operativo actual.

Flujo:

```text
Sale DRAFT
→ no Inventory OUT
```

```text
Sale approval
↓
Sale CONFIRMED
↓
Product.stock decrement
+
InventoryMovement OUT
```

---

# 28. Sale DRAFT

Crear:

```text
Sale DRAFT
```

no debe modificar stock.

Debe mantenerse:

```text
Commercial intention
≠
physical Inventory OUT
```

aunque en el modelo V1 la salida física se materialice al confirmar la Sale.

---

# 29. Sale CONFIRMED

En Sales V1:

```text
DRAFT
↓
Approve
↓
CONFIRMED
↓
Inventory OUT
```

La aprobación produce el decremento correspondiente de `Product.stock` y el
movimiento `OUT`.

---

# 30. Limitaciones de Sales V1

El flujo genérico actual de Sale soporta inventario compatible con:

```text
inventoryTracking = QUANTITY
```

y no resuelve todavía de forma completa:

```text
ASSET commercial fulfillment

SERIALIZED commercial fulfillment

REQUIRED-lot allocation
```

Estas capacidades necesitan workflows específicos antes de ampliarse.

---

# 31. Sale cancellation

Cancelar una Sale mientras permanece en:

```text
DRAFT
```

no produce mutación de Inventory.

La reversa genérica de una Sale ya confirmada no forma parte del workflow actual.

No debe corregirse una salida histórica mediante eliminación silenciosa.

---

# 32. Sales TARGET

La arquitectura futura aprobada podrá evolucionar hacia:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

En ese modelo:

```text
SalesOrder
→ commercial commitment
```

mientras:

```text
Delivery
→ physical fulfillment
```

y será Delivery quien origine el `OUT`.

---

# 33. CURRENT Sale vs TARGET Delivery

Debe mantenerse claramente:

```text
CURRENT

Sale CONFIRMED
→ Inventory OUT
```

```text
TARGET

SalesOrder
→ no physical OUT by itself

Delivery
→ Inventory OUT
```

La arquitectura TARGET no debe documentarse como si ya estuviera implementada.

---

# 34. No double OUT durante evolución

Cuando el sistema evolucione hacia Delivery debe garantizarse:

```text
same physical quantity
→ exactly one definitive OUT
```

No deberá ocurrir:

```text
Sale confirmation OUT
+
Delivery OUT
```

para el mismo hecho físico.

La migración deberá cambiar ownership de la mutación de forma controlada.

---

# 35. Movement references

`InventoryMovement` conserva referencias hacia la operación que originó el
cambio.

En el estado actual pueden observarse valores como:

```text
PURCHASE_RECEIPT

SALE

PURCHASE

null
```

---

# 36. Semántica actual de referencias

Para nuevas Recepciones:

```text
PURCHASE_RECEIPT
→ current physical Purchase IN reference
```

Para Sales V1:

```text
SALE
→ current physical commercial OUT reference
```

`PURCHASE` puede existir por compatibilidad o historia, pero no significa que
confirmar una Purchase deba generar Inventory IN actualmente.

Debe mantenerse:

```text
PurchaseReceipt
→ preferred current Receipt-origin reference
```

---

# 37. Reference no es autorización

Debe mantenerse:

```text
referenceType
+
referenceId
```

como trazabilidad.

No como mecanismo de autorización.

Una referencia no puede:

```text
bypass tenant isolation

authorize cross-company relation

justify invalid Inventory mutation
```

---

# 38. Inventory frontend CURRENT

La ruta:

```text
/inventory
```

ofrece dos vistas:

```text
Existencias

Movimientos
```

---

# 39. Existencias

La vista:

```text
Existencias
```

presenta el estado actual basado en la proyección disponible del inventario.

Actualmente continúa utilizando principalmente:

```text
Product.stock
```

como cantidad agregada.

---

# 40. Movimientos

La vista:

```text
Movimientos
```

consume:

```text
GET /inventory/movements
```

y muestra información equivalente a:

```text
Fecha

Producto

Tipo

Cantidad

Balance posterior

Referencia

Notas
```

---

# 41. Mapping de movimientos

Frontend presenta:

```text
IN
→ Entrada
```

```text
OUT
→ Salida
```

```text
ADJUSTMENT
→ Ajuste
```

---

# 42. Reference deep-link

Purchase Receipt puede navegar hacia Inventory mediante:

```text
/inventory?tab=movements
&referenceType=PURCHASE_RECEIPT
&referenceId=<receiptId>
```

La vista:

```text
opens Movimientos
+
filters the loaded ledger by reference
```

según la implementación actual.

---

# 43. Search y filters CURRENT

Movimientos soporta búsqueda y filtros client-side sobre los movimientos
cargados.

Existen estados separados de:

```text
loading

error

retry

empty result
```

para las superficies principales.

Actualmente los endpoints no cuentan con paginación server-side completa.

---

# 44. Frontend read-only

Inventory V1 es principalmente:

```text
read-only operational workspace
```

No existe actualmente una UI normal para:

```text
Manual Inventory Adjustment
```

La introducción de esa operación requerirá revisión separada.

---

# 45. Equipment boundary

`EquipmentAsset` pertenece a ERP Core y está:

```text
IMPLEMENTED / VALIDATED
```

Debe mantenerse:

```text
Inventory
→ aggregate quantity / batch / movement
```

y:

```text
Equipment
→ physical reusable ASSET identity
```

---

# 46. ASSET tracking

Para:

```text
Product.inventoryTracking = ASSET
```

Purchase Receipt puede:

```text
increase Product.stock
+
create corresponding EquipmentAsset identities
```

Equipment provisioning no vuelve a incrementar stock.

Debe mantenerse:

```text
PurchaseReceipt
→ owns Inventory IN
```

```text
Equipment provisioning
→ owns physical ASSET identity creation
```

---

# 47. Product.stock ↔ EquipmentAsset

Para Products ASSET:

```text
EquipmentAsset
→ physical unit identity
```

mientras:

```text
Product.stock
→ aggregate inventory projection
```

La reconciliación formal:

```text
Product.stock
↔
EquipmentAsset
```

continúa como deuda conocida.

Inventory no debe declarar `Product.stock` como única verdad física de las
unidades ASSET.

---

# 48. SERIALIZED

El tracking:

```text
SERIALIZED
```

continúa requiriendo semántica específica.

Debe mantenerse:

```text
SERIALIZED
≠
ASSET
```

No debe resolverse automáticamente utilizando `EquipmentAsset`.

---

# 49. Multi-tenancy

Las operaciones Inventory deben ejecutarse dentro del tenant autenticado.

Debe mantenerse:

```text
Movement.company
=
Product.company
=
Batch.company
```

cuando esas relaciones existan.

Futuras Locations/Positions deberán cumplir la misma regla.

---

# 50. Backend tenant authority

Frontend no debe decidir arbitrariamente:

```text
companyId

stock result

Batch ownership

future source Location

future destination Location
```

sin validación backend.

La Company debe derivarse del contexto autenticado.

---

# 51. Autorización

Inventory utiliza la arquitectura actual de Identity & Access.

El Permission-Based RBAC completo permanece como TARGET.

Permisos conceptuales futuros pueden incluir:

```text
inventory.read

inventory.adjust

inventory.transfers.create

inventory.transfers.confirm

inventory.locations.read

inventory.locations.manage
```

Estos nombres no significan que exista actualmente un catálogo persistido de
Permissions.

---

# 52. Seguridad transversal

Antes de producción, Inventory participa en las revisiones generales de:

```text
critical endpoint authorization

systematic tenant-isolation regression

inactive-user enforcement

safe role provisioning
```

No debe crear un sistema de autorización independiente del resto de Zaping.

---

# 53. Atomicidad

Toda operación crítica que modifique múltiples hechos relacionados debe ser
atómica.

Ejemplos CURRENT:

```text
PurchaseReceipt
+
stock
+
InventoryMovement
```

```text
Sale approval
+
stock
+
InventoryMovement
```

Debe evitarse:

```text
stock changed
+
movement missing
```

y:

```text
movement created
+
stock unchanged
```

---

# 54. Concurrencia

Inventory debe proteger operaciones donde dos requests puedan consumir o
incrementar la misma cantidad de forma incompatible.

Debe utilizar según el caso:

```text
transactions

database constraints

state validation

atomic writes

idempotency
```

La estrategia exacta pertenece a cada workflow propietario.

---

# 55. Negative stock

La arquitectura debe impedir que una operación válida produzca stock negativo
cuando el workflow exige cantidad disponible.

Conceptualmente:

```text
available aggregate quantity = 3

requested OUT = 5
→ BLOCK
```

Las futuras Positions deberán mantener la misma regla por posición.

---

# 56. Idempotencia

Operaciones de negocio susceptibles a retries deben evitar efectos duplicados.

Ejemplos:

```text
double click

network timeout

request retry
```

Purchase Receipt ya implementa idempotencia explícita.

Otros workflows deberán incorporar protección cuando su riesgo lo justifique.

---

# 57. TARGET — Location-aware Inventory

ADR-014 y `ADVANCED_INVENTORY.md` aprueban el diseño objetivo hacia:

```text
InventoryLocation

InventoryPosition

InventoryMovement
├── direction = IN
└── direction = OUT

TRANSFER
→ operación interna relacionada con una entrada y una salida

ADJUSTMENT / correction
→ workflow explícito cuando corresponda
```

Estas capacidades pertenecen a:

```text
ERP Core
```

y no exclusivamente a Healthcare.

Actualmente:

```text
InventoryLocation
→ NOT IMPLEMENTED

InventoryPosition
→ NOT IMPLEMENTED

TRANSFER
→ NOT IMPLEMENTED
```

---

# 58. Owned vs Available — TARGET

La arquitectura futura debe distinguir:

```text
Company-owned quantity
```

de:

```text
Available quantity
```

Ejemplo conceptual:

```text
Owned
20

Available
12
```

La diferencia puede corresponder a cantidades físicamente separadas, en otra
posición o no elegibles para una nueva operación.

---

# 59. Company-owned quantity — TARGET

Representará inventario que sigue bajo propiedad/control de la Company aunque no
esté disponible en el almacén normal.

Conceptualmente:

```text
Company-owned
=
sum of relevant Company-owned positions
```

---

# 60. Available quantity — TARGET

Available deberá calcularse desde cantidades elegibles.

Puede depender de:

```text
InventoryLocation

Batch

expiration

reservation future

other inventory eligibility rules
```

Para Equipment ASSET, la elegibilidad también dependerá de reglas propias del
dominio Equipment y no exclusivamente de Inventory quantities.

---

# 61. InventoryLocation — TARGET

`InventoryLocation` representará una posición física o lógica útil para Inventory.

Ejemplos conceptuales posibles:

```text
Main Warehouse

Staging Area

Inspection Area

Quarantine Area

Other Inventory Location
```

Los nombres, tipos y enums definitivos:

```text
→ NOT DECIDED
```

hasta realizar el diseño técnico correspondiente.

---

# 62. Location no es Condition

No debe introducirse una Location como:

```text
DAMAGED
```

solo para representar una condición física.

Debe mantenerse:

```text
Location
→ where inventory is
```

y:

```text
Condition / eligibility
→ why it may or may not be usable
```

cuando corresponda.

---

# 63. Location no sustituye Custody

Una futura Position puede indicar dónde se encuentra una cantidad.

No debe sustituir un registro operacional que responda:

```text
who has custody?

for which Case?

since when?

who dispatched it?
```

Debe mantenerse:

```text
Inventory Position
≠
Healthcare Custody record
```

---

# 64. InventoryPosition — TARGET

`InventoryPosition` representará conceptualmente:

```text
Product
+
InventoryLocation
+
optional Batch
+
quantity
```

Ejemplo:

```text
Product A

Lot L001

Main Warehouse

Quantity 8
```

---

# 65. InventoryPosition no es input libre

Debe mantenerse:

```text
InventoryPosition.quantity
→ consequence of Inventory operations
```

No:

```text
user types arbitrary position quantity
```

como operación normal.

---

# 66. Ledger vs Position — TARGET

La arquitectura futura deberá distinguir:

```text
InventoryMovement
→ historical ledger
```

de:

```text
InventoryPosition
→ current position projection
```

Una Position persistida deberá permanecer reconciliable contra los movimientos
que la produjeron.

---

# 67. TRANSFER — TARGET

`TRANSFER` representa cambio de posición sin salida definitiva de propiedad.

Conceptualmente:

```text
Location A
↓
TRANSFER
↓
Location B
```

Invariante:

```text
Company-owned before
=
Company-owned after
```

---

# 68. TRANSFER ≠ OUT

Debe mantenerse:

```text
TRANSFER
≠
OUT
```

`TRANSFER` cambia:

```text
where inventory is
```

`OUT` cambia:

```text
how much inventory remains Company-owned
```

---

# 69. TRANSFER atomicity — TARGET

Una transferencia deberá coordinar:

```text
decrease source Position

increase destination Position

create Movement
```

dentro de una operación consistente.

No debe existir:

```text
source decreased
+
destination not increased
```

---

# 70. Location-aware IN — TARGET

Una futura entrada podrá expresarse como:

```text
PurchaseReceipt
↓
InventoryMovement IN
↓
Warehouse Location
```

sin cambiar la regla actual:

```text
PurchaseReceipt
→ physical Inventory entry
```

---

# 71. Location-aware OUT — TARGET

Una futura salida podrá conocer:

```text
source InventoryLocation
```

y disminuir la Position correcta.

Para el modelo comercial futuro:

```text
Delivery
↓
OUT
↓
from actual fulfillment position
```

---

# 72. SalesOrder + Delivery — TARGET

La evolución comercial aprobada podrá ser:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

Debe mantenerse:

```text
SalesOrder
→ no physical OUT by itself
```

y:

```text
Delivery
→ physical OUT
```

cuando ese modelo sustituya de forma controlada al comportamiento V1 de Sale.

---

# 73. Healthcare integration boundary

Healthcare será un consumidor futuro de capacidades de Inventory.

Debe mantenerse:

```text
Healthcare workflow
↓
Inventory capability
↓
Inventory invariants
↓
Persistence
```

No:

```text
Healthcare
↓
direct uncontrolled mutation of Inventory tables
```

---

# 74. Healthcare Preparation — TARGET principle

Cuando material físico sea separado para un Case, la arquitectura futura puede
requerir una transferencia interna.

Conceptualmente:

```text
Warehouse
↓
internal transfer
↓
Staging
```

Esto no cambia la propiedad de la Company.

El workflow detallado pertenece a Healthcare.

---

# 75. Healthcare Dispatch

Debe mantenerse:

```text
Healthcare Dispatch
≠
Commercial Inventory OUT
```

Para material todavía propiedad de la Company, un Dispatch representa movimiento
operacional/custodia, no una salida comercial definitiva.

La implementación exacta dependerá del futuro diseño Core Inventory + Healthcare.

---

# 76. Healthcare Return

Debe mantenerse:

```text
Healthcare Return
≠
Commercial Inventory IN
```

El material reutilizable o no consumido ya pertenecía a la Company.

Return cambia la realidad operacional/custodia, no crea una nueva adquisición.

---

# 77. Return ≠ Available

También:

```text
Returned
≠
Automatically Available
```

Pueden existir reglas posteriores de:

```text
inspection

quarantine

batch eligibility

Equipment condition
```

antes de una nueva utilización.

---

# 78. Healthcare consumption / fulfillment

Cuando material deje definitivamente de formar parte del inventario Company-owned,
deberá existir un único `OUT` que represente ese hecho.

Debe mantenerse:

```text
same physical quantity
→ at most one definitive OUT for same disposition
```

No debe descontarse una vez por Dispatch y otra vez por Delivery/consumo.

---

# 79. Equipment y Healthcare

Equipment reutilizable mantiene su identidad en:

```text
EquipmentAsset
```

Healthcare podrá registrar:

```text
Assignment

Dispatch

Custody

Return
```

sin obligar a que la identidad física del activo dependa de
`InventoryPosition.quantity`.

Debe mantenerse:

```text
Equipment identity
≠
quantity-only tracking
```

---

# 80. InventoryReservation — TARGET

`InventoryReservation` representará conceptualmente:

```text
inventory committed
but not yet physically moved
```

Debe distinguirse de Staging:

```text
InventoryReservation
→ logical claim
```

```text
Staging
→ physical separation / position change
```

Actualmente:

```text
InventoryReservation
→ NOT IMPLEMENTED
```

---

# 81. FEFO — FUTURE

FEFO podrá priorizar inventario elegible considerando:

```text
expirationDate
```

sobre batches/positions adecuados.

Actualmente:

```text
advanced FEFO
→ NOT IMPLEMENTED
```

---

# 82. Multi-Warehouse — TARGET

La jerarquía Company → Branch → Warehouse → StorageLocation está definida en
`ADVANCED_INVENTORY.md` como diseño objetivo aprobado.

Sin embargo:

```text
Full Multi-Warehouse
→ NOT IMPLEMENTED
```

No debe crearse un catálogo Healthcare de almacenes paralelo al futuro Core.

---

# 83. Migration principles — TARGET

La evolución hacia Locations/Positions deberá ser incremental.

Principios:

```text
no big-bang rewrite
```

```text
reconcile current data before backfill
```

```text
do not invent historical locations
```

```text
preserve backward compatibility while transitioning
```

---

# 84. Default Warehouse — TARGET

Una implementación futura location-aware podrá requerir una ubicación inicial para
las existencias existentes.

Conceptualmente:

```text
Default Warehouse Location
```

El diseño exacto se decidirá cuando se implemente InventoryLocation.

No constituye trabajo CURRENT.

---

# 85. Historical migration

Si no existe evidencia suficiente para reconstruir ubicación histórica:

```text
do not fabricate history
```

Los movimientos legacy podrán conservarse con semántica histórica sin inventar
una Location retrospectiva falsa.

---

# 86. Product.stock durante transición

Durante una migración futura hacia Positions:

```text
Product.stock
```

podrá mantenerse temporalmente como proyección agregada de compatibilidad.

Su eventual retiro solo podrá evaluarse cuando:

```text
operational modules

reports

queries

tests
```

ya no dependan incorrectamente de él.

---

# 87. Inventory 360 — FUTURE

Una futura vista puede presentar:

```text
Product

Owned

Available

Warehouse

Staged

Other positions

Batch breakdown
```

sin crear fuentes paralelas de stock.

---

# 88. Movement history — TARGET evolution

Con Locations, el ledger podrá evolucionar para mostrar:

```text
IN
External → Warehouse

TRANSFER
Warehouse → Staging

TRANSFER
Staging → Another Position

OUT
Position → External
```

Actualmente source/destination Location no forman parte del modelo completo
implementado.

---

# 89. Traceability

La dirección general debe permitir reconstruir, según los dominios aplicables:

```text
Business Document
↓
InventoryMovement
↓
Batch
↓
current projection
```

y, en arquitectura futura:

```text
Movement
↓
Location / Position
```

sin perder el documento que originó cada hecho.

---

# 90. Dashboard

Dashboard puede consumir las proyecciones de Inventory.

No debe mantener una segunda lógica independiente para decidir:

```text
stock

availability

movement meaning
```

---

# 91. Warehouse Operations

Futuros workflows de Warehouse podrán consumir Inventory para:

```text
receiving

preparation

internal transfer

delivery

return processing
```

sin convertirse en un segundo ledger de cantidades.

---

# 92. Testing CURRENT

Inventory V1 debe cubrir al menos comportamiento sobre:

```text
PurchaseReceipt IN

Sale OUT

stock mutation

movement balance

referenceType / referenceId

tenant scope

invalid quantity protection

PurchaseReceipt over-receipt protection
```

---

# 93. Ledger frontend validation

La validación actual incluye:

```text
real PurchaseReceipt IN movements

real Sale OUT movements

balance presentation

reference presentation

search

filters

Receipt deep-link

browser behavior
```

Los snapshots cuantitativos pertenecen a:

```text
PROJECT_BOARD.md

CHANGELOG.md
```

---

# 94. Testing TARGET

Cuando existan Locations/Positions deberán añadirse pruebas para:

```text
IN to correct Position

TRANSFER source decrease

TRANSFER destination increase

Owned unchanged after TRANSFER

negative Position blocked

cross-tenant Position blocked

Batch mismatch blocked

duplicate retry blocked

OUT from correct source Position

Position reconciliation
```

---

# 95. Healthcare integration testing — TARGET

Cuando Healthcare consuma Inventory deberán existir pruebas que garanticen
invariantes como:

```text
Preparation
→ does not create definitive OUT
```

```text
Dispatch
→ does not double-decrement Company-owned quantity
```

```text
Return
→ does not create commercial IN
```

```text
Consumption / Delivery
→ definitive OUT exactly once
```

El workflow detallado pertenece a Healthcare.

---

# 96. IMPLEMENTED

Actualmente:

```text
Product.stock aggregate projection

InventoryMovement ledger

IN

OUT

ADJUSTMENT movement type

InventoryBatch

lot / expiration persistence

PurchaseReceipt → IN

partial Receipt stock mutation

over-receipt protection

Sale CONFIRMED → OUT

Inventory frontend

Existencias view

Movimientos view

client-side movement search/filter

Receipt reference deep-link

transactional stock updates in supported workflows
```

---

# 97. VALIDATED

La validación registrada cubre:

```text
PurchaseReceipt IN

Sale OUT

InventoryMovement references

stock balances

partial receipts

over-receipt protection

frontend Existencias / Movimientos

search / filters

Receipt deep-link

related backend/frontend regression
```

Los gates técnicos incluyen según el hito:

```text
tests

build

lint

git diff --check

Prisma validation/status when applicable
```

Los totales específicos no deben fijarse permanentemente en este documento.

---

# 98. TECHNICAL DEBT

Permanece pendiente:

```text
backend pagination
```

```text
server-side movement filtering
```

```text
date-range filtering
```

```text
server-side reference filtering
```

```text
deep-link compatibility after server pagination
```

```text
manual Inventory Adjustment workflow
```

```text
SERIALIZED inventory semantics
```

```text
Product.stock ↔ EquipmentAsset reconciliation
```

```text
formal Sale reversal / corrective Inventory workflow
```

```text
legacy tenant-safe write hardening where applicable
```

---

# 99. APPROVED TARGET

Está aprobado arquitectónicamente, pero no implementado:

```text
InventoryLocation

InventoryPosition

Company → Branch → Warehouse → StorageLocation

InventoryReservation

InventoryRelocation

InventoryTransfer

TRANSFER

Owned vs Available

location-aware IN

location-aware OUT

position-aware availability

incremental location migration

SalesOrder → Delivery → OUT
```

---

# 100. FUTURE / OUTSIDE APPROVED ADVANCED INVENTORY DESIGN

Fuera del Inventory V1 actual:

```text
advanced FEFO

bins

warehouse routes

barcode / QR

advanced inventory valuation

WMS capabilities

advanced reconciliation

generic serial tracking
```

---

# 101. Invariantes CURRENT

## Stock

```text
Product.stock
→ controlled aggregate projection
```

No:

```text
arbitrary user input
```

---

## Purchase

```text
Purchase
≠
Inventory IN
```

---

## Receipt

```text
PurchaseReceipt
→ Inventory IN
```

---

## Sale V1

```text
Sale DRAFT
→ no Inventory OUT
```

```text
Sale CONFIRMED
→ Inventory OUT
```

---

## Movement history

```text
Confirmed InventoryMovement
→ historical fact
```

---

## Correction

```text
Correction
→ explicit / compensating operation
```

No:

```text
silent historical rewrite
```

---

## Tenant

```text
Cross-tenant Inventory mutation
→ forbidden
```

---

## Equipment

```text
Inventory quantity
≠
EquipmentAsset identity
```

---

# 102. Invariantes TARGET

## Owned vs Available

```text
Owned
≠
Available
```

---

## TRANSFER

```text
TRANSFER
→ changes position
→ does not change Company-owned quantity
```

---

## OUT

```text
OUT
→ decreases Company-owned quantity
```

---

## Position

```text
InventoryPosition
→ never negative
```

---

## Healthcare Dispatch

```text
Dispatch
≠
commercial OUT
```

---

## Healthcare Return

```text
Return
≠
commercial IN
```

---

## Definitive disposition

```text
Same physical quantity
→ cannot be OUT twice for same disposition
```

---

# 103. Anti-patrones

## Direct stock editing

```text
product.stock = userInput
```

como operación ordinaria.

---

## Purchase = Inventory

```text
Purchase CONFIRMED
→ stock increment
```

Incorrecto.

---

## Sale DRAFT = OUT

```text
Sale DRAFT
→ stock decrement
```

Incorrecto.

---

## Future SalesOrder = OUT

```text
SalesOrder
→ physical decrement
```

Incorrecto en la arquitectura Target.

---

## Dispatch = OUT

```text
Healthcare Dispatch
→ definitive commercial OUT
```

Incorrecto para inventario todavía Company-owned.

---

## Return = IN

```text
Healthcare Return
→ new commercial Inventory IN
```

Incorrecto para inventario que nunca dejó de pertenecer a la Company.

---

## Return = Available

```text
Returned
→ immediately available
```

Incorrecto.

---

## One stock number for everything

Utilizar una única cantidad futura como si significara simultáneamente:

```text
owned
available
staged
custody
inspection
```

---

## HealthcareInventory

Crear un ledger de stock paralelo exclusivo para Healthcare.

---

## Equipment as quantity only

Ignorar `EquipmentAsset` para Products ASSET.

---

## Location as Condition

Utilizar:

```text
DAMAGED
```

como Location únicamente para expresar Condition.

---

## Location as Custody

Pretender que una Position sustituya:

```text
custodian
Case
dispatch actor
timestamps
```

---

## Manual Position editing

Modificar Position directamente para “cuadrar” cantidades.

---

## Rewrite movement history

Editar movimientos confirmados para cambiar resultados anteriores.

---

## Cross-module Prisma mutation

Healthcare modificando directamente internals de Inventory sin pasar por las
reglas de la capacidad Inventory correspondiente.

---

## Double OUT

Descontar físicamente la misma cantidad dos veces por un solo hecho comercial.

---

# 104. ADR relacionados

```text
ADR-001 — Multi-Tenant

ADR-002 — Inventory Movements

ADR-004 — UUID

ADR-005 — Layered Architecture

ADR-006 — API First

ADR-007 — RBAC

ADR-009 — Modular Monolith

ADR-011 — SalesOrder + Delivery

ADR-012 — Entity Lifecycle

ADR-013 — Inventory Custody & Case Logistics

ADR-014 — Inventory Locations and Internal Transfers
```

Los ADR TARGET no significan automáticamente que sus modelos estén implementados.

---

# 105. Documentación relacionada

```text
docs/modules/erp/PRODUCTS.md

docs/modules/erp/PURCHASES.md

docs/modules/erp/PURCHASE_RECEIPTS.md

docs/modules/erp/SALES.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/ADVANCED_INVENTORY.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/modules/healthcare/DOMAIN_MODEL.md

docs/modules/healthcare/HEALTHCARE.md

docs/architecture/ARCHITECTURE.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

---

# 106. Fuente de verdad

```text
INVENTORY.md
→ Inventory functional/domain behavior

PRODUCTS.md
→ Product tracking configuration

PURCHASE_RECEIPTS.md
→ Purchase physical receipt and IN orchestration

SALES.md
→ CURRENT Sale inventory behavior

EQUIPMENT.md
→ ASSET physical identity

Healthcare documentation
→ Case Logistics / Custody workflows

ADR-002
→ Inventory Movement architecture

ADR-014
→ approved Locations / Positions / Transfers architecture

ADVANCED_INVENTORY.md
→ canonical Advanced Inventory target design

schema.prisma
→ CURRENT technical persistence

Inventory backend
→ CURRENT implementation

Inventory frontend
→ CURRENT user experience

tests
→ validated behavior

PROJECT_BOARD.md
→ current project state and debt

CHANGELOG.md
→ historical implementation evolution
```

---

# 107. Estado consolidado

```text
Product.stock
✅ CURRENT

InventoryMovement ledger
✅ CURRENT

InventoryBatch
✅ CURRENT

PurchaseReceipt → IN
✅ CURRENT

Sale CONFIRMED → OUT
✅ CURRENT

Inventory frontend
✅ CURRENT

Receipt reference deep-link
✅ CURRENT
```

Pendiente:

```text
backend pagination
⏳

server-side filtering
⏳

date-range filtering
⏳

manual Adjustment workflow
⏳

SERIALIZED semantics
⏳

Product.stock ↔ EquipmentAsset reconciliation
⏳
```

Target:

```text
InventoryLocation
⏳

InventoryPosition
⏳

InventoryReservation
⏳

InventoryRelocation / InventoryTransfer
⏳

TRANSFER
⏳

Owned vs Available
⏳

location-aware IN / OUT
⏳

SalesOrder → Delivery → OUT
⏳
```

---

# 108. Secuencia de proyecto

Advanced Inventory continúa siendo un diseño aprobado del ERP Core, pero no
representa el siguiente cambio inmediato del proyecto. Su diseño canónico es
`ADVANCED_INVENTORY.md` y su ejecución se registra en `PROJECT_BOARD.md`.

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

Después de esa etapa, las capacidades Inventory TARGET deberán priorizarse de
acuerdo con las necesidades reales de:

```text
Healthcare

Sales fulfillment

Warehouse operations

scale
```

No debe realizarse una migración location-aware únicamente porque el ADR ya
existe.

---

# 109. Principio final

Inventory debe preservar dos niveles claramente separados.

CURRENT:

```text
¿Cuánto tengo?
↓
¿Qué movimiento modificó esa cantidad?
↓
¿Qué lote corresponde?
```

TARGET:

```text
¿Cuánto tengo?
↓
¿Dónde está?
↓
¿Cuánto continúa siendo mío?
↓
¿Cuánto está disponible?
↓
¿Qué movimiento explica cada cambio de posición?
```

sin confundir:

```text
quantity
with
physical ASSET identity
```

ni:

```text
internal movement
with
definitive disposition
```

La regla central es:

```text
IN
→ increases Company-owned inventory

TRANSFER
→ changes where inventory is

OUT
→ decreases Company-owned inventory
```
