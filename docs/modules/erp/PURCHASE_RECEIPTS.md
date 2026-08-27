# Recepciones de compra — Zaping ERP

**Módulo:** Purchase Receipts
**Producto:** Zaping ERP Core
**Versión:** 1.0.1
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / VALIDATED
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Una `PurchaseReceipt` registra el hecho físico de recibir mercancía contra una
Compra confirmada.

La Compra expresa lo ordenado; la Recepción expresa lo que realmente ingresó.

```text
Purchase CONFIRMED / PARTIALLY_RECEIVED
        |
        v
PurchaseReceipt + PurchaseReceiptItem
        |
        +--> Product.stock increment
        |
        +--> InventoryMovement IN
        |
        +--> InventoryBatch, cuando corresponde
        |
        +--> EquipmentAsset, para Products ASSET
        |
        v
Purchase PARTIALLY_RECEIVED / RECEIVED
```

Las mutaciones que forman parte de la operación de Recepción se ejecutan dentro
de la misma transacción Prisma.

Principio:

```text
Purchase
≠
Inventory IN
```

La entrada física ocurre mediante:

```text
PurchaseReceipt
→ Inventory IN
```

---

# 2. Modelo implementado

`PurchaseReceipt` conserva información como:

```text
companyId

purchaseId

folio

receivedAt

receivedBy

notes

items
```

Cada `PurchaseReceiptItem` referencia:

```text
PurchaseItem de origen

Product

quantityReceived

unitCost

lotNumber, cuando corresponde

expirationDate, cuando corresponde

InventoryBatch, cuando corresponde
```

Las relaciones históricas no se eliminan al desactivar recursos como:

```text
Supplier

Product
```

La Recepción permanece como documento histórico de la operación física realizada.

---

# 3. API actual

```text
POST /purchase-receipts

GET /purchase-receipts

GET /purchase-receipts/:id

GET /purchase-receipts/purchase/:purchaseId
```

Los endpoints utilizan autenticación mediante:

```text
JwtAuthGuard
```

y el tenant se obtiene desde:

```text
req.user.companyId
```

Una Recepción o Compra inexistente o perteneciente a otra Company no debe
exponerse como recurso accesible para el tenant autenticado.

Principio:

```text
Client companyId
≠
Tenant authority
```

---

# 4. Recepción parcial y completa

Solo pueden recibirse Compras en estados compatibles con recepción:

```text
CONFIRMED

PARTIALLY_RECEIVED
```

Se rechazan Compras:

```text
DRAFT

CANCELLED

RECEIVED
```

También se rechazan situaciones como:

```text
PurchaseItem ajeno a la Compra

PurchaseItem duplicado dentro de la misma solicitud

quantityReceived inválida

quantityReceived superior a cantidad pendiente

over-receipt
```

La cantidad pendiente se deriva conceptualmente de:

```text
ordered
-
previously received
=
pending
```

Al finalizar una Recepción válida:

```text
queda cantidad pendiente
→ Purchase.PARTIALLY_RECEIVED
```

```text
todas las partidas completas
→ Purchase.RECEIVED
```

Confirmar una Compra:

```text
does not modify Inventory
```

El stock aumenta únicamente cuando se registra físicamente una Recepción válida.

---

# 5. Inventario y lotes

Por cada partida recibida se incrementa:

```text
Product.stock
```

y se crea un:

```text
InventoryMovement
```

con semántica:

```text
movementType  = IN

referenceType = PURCHASE_RECEIPT

referenceId   = PurchaseReceipt.id

balance       = stock posterior

unitCost      = costo persistido de la partida de Compra
```

La Recepción es el origen trazable del movimiento.

---

## ProductLotTracking

Reglas vigentes:

### NONE

```text
lotNumber
→ not allowed

expirationDate
→ not allowed
```

---

### OPTIONAL

```text
lotNumber
→ optional
```

Si existe:

```text
expirationDate
```

debe existir también:

```text
lotNumber
```

---

### REQUIRED

```text
lotNumber
→ required
```

```text
expirationDate
→ optional
```

---

## InventoryBatch

Cuando corresponde utilizar lote:

```text
PurchaseReceiptItem
↓
InventoryBatch
```

Si ya existe un `InventoryBatch` compatible para:

```text
companyId
+
productId
+
lotNumber
```

la Recepción puede reutilizar ese batch y actualizar sus cantidades según la
implementación vigente.

La representación y actualización exacta del costo del batch debe mantenerse
alineada con la implementación de Inventory y Purchase Receipts.

No debe documentarse un algoritmo específico de actualización de costo como
invariante arquitectónica mientras no haya sido confirmado explícitamente contra
la implementación vigente.

---

# 6. Aprovisionamiento de Equipment

Después de crear cada `PurchaseReceiptItem`,
`EquipmentProvisioningService` revisa:

```text
Product.inventoryTracking
```

dentro de la misma operación transaccional.

Comportamiento actual:

```text
QUANTITY
→ no crea EquipmentAsset
```

```text
SERIALIZED
→ no crea EquipmentAsset en la implementación actual
```

```text
ASSET
→ crea un EquipmentAsset por unidad recibida
```

Por tanto:

```text
quantityReceived = N
+
inventoryTracking = ASSET
↓
N EquipmentAsset
```

---

## Datos del Equipment aprovisionado

Cada activo creado desde Receipt utiliza:

```text
assetCode
→ generado por CompanySequence

lifecycle
→ ACTIVE

condition
→ INSPECTION_PENDING

origin
→ PURCHASE_RECEIPT

purchaseReceiptItemId
→ ReceiptItem de origen

batchId
→ lote recibido cuando corresponde

serialNumber
→ null al aprovisionarse

serialNumberKey
→ null al aprovisionarse
```

La captura o corrección posterior del serial permanece pendiente de un workflow
específico de Equipment.

---

## No duplicación de inventario

La creación de `EquipmentAsset` no vuelve a incrementar:

```text
Product.stock
```

ni crea:

```text
InventoryMovement
```

adicional por cada unidad física.

Principio:

```text
PurchaseReceipt
→ owns Inventory IN
```

```text
Equipment provisioning
→ creates physical identities
→ does not duplicate Inventory mutation
```

---

# 7. Idempotencia

`POST /purchase-receipts` exige:

```text
Idempotency-Key
```

El backend:

```text
trims the key

rejects empty values

limits length to 128 characters
```

Scope implementado:

```text
PURCHASE_RECEIPT_CREATE
```

Identidad:

```text
companyId
+
scope
+
key
```

El request utiliza un hash derivado del payload normalizado.

Contrato:

```text
same key + same payload
→ replay del mismo PurchaseReceipt
```

```text
same key + different payload
→ 409 Conflict
```

```text
same key in another Company
→ independent identity
```

---

## Transaction boundary

El flujo idempotente puede incluir dentro de la misma operación:

```text
Idempotency claim

+

PurchaseReceipt

+

PurchaseReceiptItems

+

InventoryBatch when applicable

+

EquipmentAsset provisioning when ASSET

+

Product.stock

+

InventoryMovement IN

+

Purchase status

+

Idempotency resource association
```

La transacción utiliza aislamiento:

```text
Serializable
```

---

## P2002 recovery

Existe manejo específico para colisiones relacionadas con el claim idempotente.

La recuperación se realiza después de que la transacción que encontró:

```text
P2002
```

ha terminado.

No deben continuarse queries dentro de una transacción PostgreSQL abortada.

---

## Cobertura actual

Existe cobertura automatizada para:

```text
successful creation

same-key replay

same-key different-payload conflict

tenant isolation

rollback behavior

P2002 recovery path
```

Esta cobertura no demuestra por sí sola una carrera simultánea real entre
requests independientes contra PostgreSQL.

Permanece como deuda:

```text
real simultaneous PostgreSQL concurrency QA
```

---

# 8. Grafo de detalle y trazabilidad

`GET /purchase-receipts/:id` devuelve el grafo tenant-scoped necesario para la
experiencia actual.

Conceptualmente:

```text
Receipt
├── Purchase
│   └── Supplier
│
├── receivedByUser
│
├── Items
│   ├── Product
│   ├── Batch
│   └── EquipmentAssets
│
└── InventoryMovements
```

Los movimientos asociados se identifican mediante:

```text
referenceType = PURCHASE_RECEIPT

referenceId = PurchaseReceipt.id
```

---

# 9. Frontend

Rutas implementadas:

```text
/purchase-receipts

/purchase-receipts/<id>
```

La primera presenta el listado de Recepciones.

La segunda representa el detalle dedicado.

---

## Handoff desde Purchase

Después de registrar una Recepción, el frontend conserva la identidad real
devuelta por backend y presenta un estado de éxito equivalente a:

```text
Recepción registrada correctamente

<folio>

[Ver recepción]

[Cerrar]
```

`Ver recepción` navega hacia:

```text
/purchase-receipts/<id>
```

---

# 10. Navegación cruzada

La trazabilidad frontend permite:

```text
Purchase
→ Receipt detail
```

```text
Receipt
→ Purchase detail

/purchases?purchaseId=<id>
```

```text
Receipt
→ Equipment detail

/equipment?assetId=<id>
```

```text
Receipt
→ Inventory movements

/inventory?tab=movements
&referenceType=PURCHASE_RECEIPT
&referenceId=<receiptId>
```

Estas relaciones permiten seguir una operación desde abastecimiento hasta
Inventory y Equipment sin depender únicamente de inspección manual de base de
datos.

---

# 11. Límites actuales

Purchase Receipts V1 no implementa actualmente:

```text
Receipt lifecycle states

Receipt confirmation command

Receipt cancellation

Receipt correction

Receipt reversal

Receipt hard delete

Receipt PDF

SERIALIZED physical-unit provisioning

multi-warehouse
```

La creación válida de `PurchaseReceipt` representa actualmente el hecho físico.

No existe una operación adicional:

```text
PurchaseReceipt CONFIRMED
```

---

# 12. IMPLEMENTED

Actualmente están implementados:

```text
Purchase Receipt creation

partial receiving

full receiving

quantity pending validation

over-receipt protection

ProductLotTracking NONE

ProductLotTracking OPTIONAL

ProductLotTracking REQUIRED

InventoryBatch integration

Product.stock IN

InventoryMovement IN

Purchase status recalculation

ASSET Equipment provisioning

automatic Equipment assetCode integration

Idempotency-Key

request hashing

replay

payload conflict detection

tenant-scoped idempotency

Serializable transaction

P2002 recovery path

Receipt list

Receipt detail

Purchase → Receipt handoff

Receipt → Purchase traceability

Receipt → Inventory traceability

Receipt → Equipment traceability
```

---

# 13. VALIDATED

Existe cobertura automatizada backend y frontend para los flujos implementados,
junto con:

```text
tests

build

lint

git diff --check
```

También se validaron manualmente flujos principales relacionados con:

```text
partial/full receiving

stock mutation

InventoryMovement IN

Purchase status transitions

ASSET provisioning

idempotent replay

same-key payload conflict

cross-module traceability
```

La concurrencia simultánea real contra PostgreSQL permanece fuera del alcance
validado actual.

Los snapshots cuantitativos vigentes deben mantenerse en:

```text
docs/project/PROJECT_BOARD.md
```

y no duplicarse permanentemente en este documento funcional.

---

# 14. TECHNICAL DEBT

Permanece como deuda:

```text
real simultaneous PostgreSQL concurrency QA
```

```text
SERIALIZED inventory semantics
```

```text
Receipt correction / reversal
```

```text
Receipt PDF
```

```text
backend pagination
```

```text
server-side filters / search
```

```text
Product.stock
↔
EquipmentAsset formal reconciliation invariant
```

```text
legacy tenant-safe write hardening
```

```text
Equipment serial assignment / correction workflow
```

También:

```text
PurchaseReceiptItem.unitCost
```

depende actualmente de la representación de costo utilizada por `PurchaseItem`.

Si el dominio de Compras evoluciona, deberá revisarse y normalizarse
explícitamente la semántica de costo entre:

```text
PurchaseItem

PurchaseReceiptItem

InventoryBatch

InventoryMovement
```

---

# 15. FUTURE

Evoluciones futuras pueden incluir:

```text
Receipt correction workflow

Receipt reversal / compensating operations

Receipt PDF

Supplier Returns

multi-warehouse

barcode / QR workflows

advanced warehouse operations

SERIALIZED unit handling

advanced batch allocation

stronger inventory reconciliation
```

Las correcciones futuras deben preservar trazabilidad histórica.

Preferir:

```text
Original Receipt
+
corrective / compensating operation
```

sobre:

```text
silent historical rewrite
```

---

# 16. Invariantes

## Purchase

```text
Purchase
≠
Inventory IN
```

---

## Receipt

```text
Valid PurchaseReceipt creation
→ InventoryMovement IN
```

---

## Partial receiving

```text
quantityReceived
≤
quantityPending
```

---

## Stock

```text
Receipt
→ one controlled stock increment per received quantity
```

---

## Equipment

```text
ASSET quantityReceived = N
→ N EquipmentAsset
```

---

## No double inventory mutation

```text
EquipmentAsset provisioning
≠
second stock increment
```

---

## Lot tracking

```text
NONE
→ no lot / expiration
```

```text
OPTIONAL
→ lot optional
```

```text
REQUIRED
→ lot required
```

---

## Idempotency

```text
same key + same logical request
→ same Receipt
```

```text
same key + different logical request
→ conflict
```

---

## Tenant

```text
Company A
≠
Company B Receipt access
```

---

## History

```text
Receipt
→ historical business fact
→ no silent destructive rewrite
```

---

# 17. Anti-patrones

## Inventory on Purchase confirmation

```text
Purchase CONFIRMED
→ Inventory IN
```

Incorrecto.

---

## Double stock mutation

```text
Receipt increments stock
+
Equipment provisioning increments stock again
```

Incorrecto.

---

## Equipment movement per unit

```text
one InventoryMovement
per EquipmentAsset
```

Incorrecto para el provisioning actual.

---

## Client-owned tenant

```text
client companyId
→ trusted directly
```

Incorrecto.

---

## Client-generated Equipment assetCode

```text
Receipt frontend
→ sends arbitrary assetCode
```

Incorrecto.

---

## Silent correction

```text
edit historical Receipt
→ overwrite original physical event
```

Debe evitarse.

---

## Assuming retry means new operation

```text
network retry
→ create duplicate Receipt
```

La idempotencia existe precisamente para evitarlo cuando se reutiliza la misma
clave lógica.

---

# 18. Relaciones con otros dominios

## Purchases

```text
Purchase
→ ordered quantities

PurchaseReceipt
→ physically received quantities
```

---

## Inventory

```text
PurchaseReceipt
→ Inventory IN

InventoryMovement
→ traceable ledger
```

---

## Products

```text
Product
→ catalog identity

ProductLotTracking
→ lot rules

ProductInventoryTracking
→ inventory strategy
```

---

## Equipment

```text
ASSET Product Receipt
↓
EquipmentAsset provisioning
```

---

## Suppliers

Supplier pertenece a Purchase.

La desactivación futura/histórica del Supplier no elimina la trazabilidad de
Receipts existentes.

---

# 19. Documentación relacionada

```text
docs/modules/erp/PURCHASES.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/PRODUCTS.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/SUPPLIERS.md

docs/architecture/ARCHITECTURE.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/project/PROJECT_BOARD.md

docs/project/CHANGELOG.md
```

---

# 20. Fuente de verdad

```text
PURCHASE_RECEIPTS.md
→ comportamiento funcional de Purchase Receipts

PURCHASES.md
→ Purchase lifecycle

INVENTORY.md
→ Inventory semantics

EQUIPMENT.md
→ EquipmentAsset semantics

PRODUCTS.md
→ Product tracking configuration

schema.prisma
→ current persistence model

Purchase Receipts backend
→ CURRENT implementation

tests
→ validated behavior

PROJECT_BOARD.md
→ active debt / project status
```

---

# 21. Principio final

Purchase Receipt representa el momento en que una Compra se convierte en una
entrada física trazable.

La arquitectura debe preservar:

```text
what was ordered
≠
what was received
```

y:

```text
what was received
↓
Inventory
↓
Lot / Batch when applicable
↓
Equipment identity when ASSET
```

sin duplicar efectos ni perder trazabilidad.
