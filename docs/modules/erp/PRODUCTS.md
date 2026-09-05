# Products — Zaping ERP

**Módulo:** Products
**Producto:** Zaping ERP Core
**Versión:** 2.2.0
**Estado:** Aprobado
**Estado de implementación:** PRODUCTS V1 IMPLEMENTED / VALIDATED
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Products administra el catálogo maestro de productos de una Company.

Su responsabilidad principal es responder:

```text
¿Qué producto es?

¿Cómo lo identifica la Company?

¿Cómo se describe?

¿A qué Category pertenece?

¿Cuál es su marca?

¿Cuáles son sus valores comerciales de referencia?

¿Cómo debe rastrearse en Inventory?

¿Puede utilizarse en nuevas operaciones?
```

Products representa:

```text
catalog identity
+
tracking configuration
+
master-data lifecycle
```

No representa por sí mismo una existencia física específica.

---

# 2. Ownership

Products es propietario de:

```text
Product identity

SKU

name

description

brand

Category relationship

barcode

reference cost

reference price

minStock

inventoryTracking

lotTracking

active / inactive lifecycle
```

`Product.stock` existe en el modelo, pero su mutación pertenece a Inventory.

---

# 3. Fronteras de dominio

Debe mantenerse:

```text
Product
→ catalog identity
```

```text
Inventory
→ quantities
→ batches
→ movement history
```

```text
Equipment
→ individual physical identity
   for reusable ASSET products
```

Por tanto:

```text
Product
≠
InventoryBatch
```

```text
Product
≠
InventoryMovement
```

```text
Product
≠
EquipmentAsset
```

---

# 4. CURRENT vs TARGET vs FUTURE

Este documento distingue:

## CURRENT

Capacidad implementada actualmente.

## TARGET

Evolución aprobada pendiente de implementación.

## FUTURE

Capacidad posible cuya implementación dependerá de necesidad real.

---

# 5. Estado CURRENT

Products V1 administra actualmente:

```text
Product CRUD

Category integration

SKU

name

description

brand

barcode

cost

price

stock read-only projection

minStock

inventoryTracking

lotTracking

active / inactive lifecycle

ProductSelector integration

tenant-safe Category validation
```

Estado:

```text
PRODUCTS V1
→ IMPLEMENTED / VALIDATED
```

---

# 6. Modelo Product actual

Conceptualmente:

```text
Product

id
companyId

sku
name
description
brand

categoryId
barcode

cost
price

stock
minStock

inventoryTracking
lotTracking

isActive

createdAt
updatedAt
```

La definición técnica exacta pertenece a:

```text
schema.prisma
```

---

# 7. Category

Category organiza Products dentro del tenant.

Conceptualmente:

```text
Category

id
companyId

name
description

isActive

createdAt
updatedAt
```

Relación:

```text
Category
1
│
└── *
    Product
```

La relación Product → Category puede ser opcional.

---

# 8. Product como Master Data

Product sigue un lifecycle de Master Data.

Flujo normal:

```text
ACTIVE
↓
INACTIVE
```

No:

```text
ACTIVE
↓
physical DELETE
```

como mecanismo empresarial ordinario.

---

# 9. Product activo

Un Product activo puede ser utilizado por workflows compatibles como:

```text
Purchase

Purchase Receipt

Quote

Sale

Equipment creation when ASSET
```

y posteriormente por capacidades Healthcare que consuman Product.

La compatibilidad final depende también de:

```text
inventoryTracking

lotTracking

workflow rules
```

---

# 10. Product inactivo

Un Product inactivo:

```text
remains persisted

remains historically referenceable

must not disappear from existing documents
```

Puede seguir apareciendo dentro de:

```text
Purchases

Purchase Receipts

Quotes

Sales

Inventory Movements

Equipment history

future Healthcare history
```

pero normalmente no debe ofrecerse como opción para nuevas operaciones.

---

# 11. Desactivación CURRENT

Actualmente:

```text
DELETE /products/:id
```

implementa:

```text
isActive = false
```

No elimina físicamente el registro.

Debe interpretarse como:

```text
Deactivate Product
```

y no como hard delete.

---

# 12. Desactivación idempotente

Si el Product ya está inactivo, repetir la operación de desactivación no debe
crear un nuevo efecto destructivo.

La historia existente permanece intacta.

---

# 13. Reactivación

Actualmente:

```text
Product reactivation
→ NOT IMPLEMENTED
```

Una futura transición:

```text
INACTIVE
↓
ACTIVE
```

deberá ser una operación explícita y autorizada.

No debe aparecer accidentalmente mediante un PATCH genérico.

---

# 14. Hard Delete

Products V1 no expone hard delete.

Una futura eliminación física requeriría una decisión específica de dominio,
retención y dependencias históricas.

No forma parte del contrato normal.

---

# 15. SKU

`sku` es el identificador comercial interno principal del Product dentro de una
Company.

Ejemplo:

```text
CAT-15MM-001
```

Debe ser:

```text
required

operationally readable

unique within Company
```

---

# 16. SKU y UUID

Debe distinguirse:

```text
Product.id
→ technical UUID
```

de:

```text
Product.sku
→ business/catalog identifier
```

El UUID preserva identidad técnica aunque un dato maestro editable cambie.

---

# 17. Unicidad del SKU

La regla es:

```text
companyId
+
sku
→ UNIQUE
```

Por tanto:

```text
Company A → SKU-001
Company B → SKU-001
```

puede ser válido.

---

# 18. Cambio de SKU

Modificar SKU debe hacerse con precaución porque puede utilizarse en:

```text
search

documents

reports

labels

integrations

physical workflows
```

El cambio no modifica:

```text
Product.id
```

Los documentos históricos no deben reinterpretarse silenciosamente debido a un
cambio posterior de datos maestros.

---

# 19. Name

`name` representa el nombre corto y reconocible del Product.

Debe ser adecuado para:

```text
tables

selectors

search

documents

operational UI
```

---

# 20. Description

`description` permite información extendida.

No debe utilizarse como sustituto de datos estructurados que posteriormente
necesiten:

```text
validation

filtering

business rules

reporting
```

---

# 21. Brand

`brand` pertenece actualmente directamente a Product.

Es opcional.

Ejemplo:

```text
Product A
Brand: Terumo

Product B
Brand: Cordis
```

pueden representar productos comerciales distintos.

---

# 22. Brand no es entidad independiente

Actualmente no existe una necesidad aprobada para crear:

```text
Brand

Brand API

Brand lifecycle

Brand permissions
```

como dominio separado.

No debe sobrearquitecturarse sin necesidad funcional.

---

# 23. Category ownership

Category pertenece a una Company.

Debe mantenerse:

```text
Category.companyId
=
Product.companyId
```

cuando Product utiliza Category.

---

# 24. Category uniqueness

Conceptualmente:

```text
companyId
+
Category.name
→ UNIQUE
```

La misma categoría textual puede existir en tenants distintos.

---

# 25. Category lifecycle

Category también utiliza:

```text
ACTIVE
↓
INACTIVE
```

como estrategia de Master Data.

Una Category inactiva:

```text
does not delete Products

does not erase historical relations
```

---

# 26. Category validation CURRENT

Cuando Product recibe:

```text
categoryId
```

backend debe validar:

```text
Category exists

+

same authenticated Company

+

Category.isActive = true
```

para nuevas asociaciones.

---

# 27. Category PATCH semantics

En actualización:

```text
categoryId omitted
→ preserve current Category
```

```text
categoryId = null
→ remove Category association
```

```text
categoryId = uuid
→ validate active same-tenant Category
```

---

# 28. Inactive Category history

Un Product histórico no debe desaparecer únicamente porque su Category haya sido
desactivada.

La UI debe representar esa relación de forma segura cuando sea necesaria para
contexto histórico.

---

# 29. Barcode

`barcode` identifica el Product cuando existe un código comercial escaneable.

Puede utilizarse para:

```text
search

receiving

inventory

future picking

future scanner workflows
```

---

# 30. Barcode optional

Actualmente:

```text
barcode
→ optional
```

No todos los Products necesitan uno.

---

# 31. Barcode uniqueness

Cuando existe:

```text
companyId
+
barcode
→ UNIQUE
```

El mismo barcode no debe corresponder a dos Products distintos dentro del mismo
tenant.

---

# 32. Barcode ≠ Lot

Debe mantenerse:

```text
Product.barcode
→ identifies catalog Product
```

```text
InventoryBatch.lotNumber
→ identifies physical lot
```

Un Product puede tener múltiples lotes conservando el mismo barcode de catálogo.

---

# 33. Cost

`Product.cost` representa actualmente:

```text
reference purchase cost
```

No representa obligatoriamente un valor histórico universal.

Puede utilizarse como referencia inicial para operaciones comerciales de compra.

---

# 34. Historical purchase value

Cuando una Purchase guarda el valor de una partida:

```text
PurchaseItem persisted unit value
→ historical transaction snapshot
```

Cambiar posteriormente:

```text
Product.cost
```

no debe reescribir una Purchase histórica.

La representación exacta del costo en Purchase/PurchaseReceipt pertenece a esos
dominios.

---

# 35. Price

`Product.price` representa actualmente:

```text
reference sale price
```

Puede utilizarse como valor inicial para:

```text
Quote

Sale
```

según el workflow.

---

# 36. Historical sale price

Una vez un documento comercial guarda su propio valor:

```text
Product.price changes
```

no debe modificar automáticamente:

```text
QuoteItem historical value

SaleItem historical value
```

Los documentos conservan la operación realizada en ese momento.

---

# 37. Price no es Pricing Engine

`Product.price` no representa todavía:

```text
price lists

customer-specific prices

discount engine

currencies

effective dates

complex commercial rules
```

Estas capacidades requieren dominio propio si se implementan.

---

# 38. Monetary model

Antes de ampliar capacidades financieras deberá revisarse transversalmente:

```text
precision

rounding

currency

Prisma representation
```

Products por sí solo no define la arquitectura monetaria completa.

---

# 39. minStock

`minStock` representa un umbral operativo configurado.

Puede utilizarse para:

```text
low-stock indicators

alerts

future recommendations
```

---

# 40. minStock no crea Purchase

Debe mantenerse:

```text
stock <= minStock
→ signal / warning
```

No:

```text
stock <= minStock
→ automatically create Purchase
```

sin un workflow aprobado.

---

# 41. Product.stock

`Product.stock` existe actualmente como campo persistido.

Su semántica es:

```text
persisted aggregate Inventory projection
```

No:

```text
catalog master-data value
```

---

# 42. Product CRUD no controla stock

Actualmente:

```text
POST /products
→ does not accept stock from client
```

Un nuevo Product utiliza:

```text
stock = 0
```

según el default vigente.

También:

```text
PATCH /products/:id
→ does not accept stock
```

Frontend muestra stock como:

```text
read-only
```

---

# 43. Stock ownership

Debe mantenerse:

```text
Products
→ exposes stock projection
```

mientras:

```text
Inventory workflows
→ mutate stock
```

Ejemplos CURRENT:

```text
PurchaseReceipt
→ Inventory IN
→ stock increase
```

```text
Sale CONFIRMED
→ Inventory OUT
→ stock decrease
```

---

# 44. Sources of stock CURRENT

Actualmente:

```text
PurchaseReceipt
→ IN
```

y:

```text
Sale approval / CONFIRMED
→ OUT
```

son workflows implementados que afectan stock.

No deben documentarse como CURRENT:

```text
Delivery

generic Return
```

porque pertenecen a evolución posterior.

---

# 45. Stock ≠ Availability

Actualmente `Product.stock` es una cantidad agregada.

No debe asumirse permanentemente:

```text
Product.stock
=
available quantity
```

La futura evolución location-aware de Inventory podrá separar:

```text
Owned

Available
```

---

# 46. inventoryTracking

Product contiene actualmente:

```text
inventoryTracking
```

con valores:

```text
QUANTITY

SERIALIZED

ASSET
```

Esta configuración está:

```text
IMPLEMENTED
```

---

# 47. Semántica de inventoryTracking

```text
QUANTITY
→ represented primarily as quantity
```

```text
SERIALIZED
→ commercial inventory requiring individual serial semantics
```

```text
ASSET
→ reusable physical units represented through EquipmentAsset
```

Debe mantenerse:

```text
SERIALIZED
≠
ASSET
```

---

# 48. QUANTITY

`QUANTITY` representa Products administrados principalmente mediante cantidades.

Es compatible con los workflows genéricos actuales de Inventory y, sujeto a otras
reglas, Sales V1.

---

# 49. SERIALIZED

`SERIALIZED` representa productos comerciales individualizados por serial.

Actualmente:

```text
complete SERIALIZED operational semantics
→ NOT IMPLEMENTED
```

No debe resolverse automáticamente mediante `EquipmentAsset`.

---

# 50. ASSET

`ASSET` representa Products cuyas unidades reutilizables tienen identidad física
individual mediante:

```text
EquipmentAsset
```

Debe mantenerse:

```text
Product
→ catalog/model
```

```text
EquipmentAsset
→ exact reusable physical unit
```

Core Equipment está actualmente:

```text
IMPLEMENTED / VALIDATED
```

---

# 51. lotTracking

Product contiene actualmente:

```text
lotTracking
```

con valores:

```text
NONE

OPTIONAL

REQUIRED
```

Esta configuración está:

```text
IMPLEMENTED
```

---

# 52. inventoryTracking y lotTracking son dimensiones distintas

Debe mantenerse:

```text
inventoryTracking
→ how units are represented
```

mientras:

```text
lotTracking
→ how lot traceability is required
```

No son flags intercambiables.

---

# 53. Lot tracking semantics

Las reglas operativas completas actualmente implementadas para Purchase Receipts
pertenecen a:

```text
PURCHASE_RECEIPTS.md
```

Resumen:

```text
NONE
→ lot / expiration not accepted
```

```text
OPTIONAL
→ lot optional
→ expiration requires lot
```

```text
REQUIRED
→ lot required
→ expiration optional
```

Products únicamente conserva la configuración.

---

# 54. Tracking configuration CURRENT

Durante:

```text
POST /products
```

pueden seleccionarse:

```text
inventoryTracking

lotTracking
```

El backend persiste ambas estrategias según el contrato vigente.

---

# 55. Tracking inmutable en PATCH normal

Actualmente:

```text
PATCH /products/:id
```

no permite modificar normalmente:

```text
inventoryTracking

lotTracking
```

Esto es deliberado.

Cambiar:

```text
QUANTITY → ASSET
```

o:

```text
OPTIONAL → REQUIRED
```

cuando existen operaciones históricas puede requerir migración de datos y reglas
de dominio.

---

# 56. Tracking migration workflow

Una futura modificación de tracking deberá diseñarse como:

```text
explicit migration workflow
```

con validaciones sobre:

```text
stock

InventoryMovement

InventoryBatch

Purchase Receipts

Sales

EquipmentAsset
```

Actualmente:

```text
Tracking migration
→ NOT IMPLEMENTED
```

---

# 57. Lot no pertenece a Product

Debe mantenerse:

```text
Product.lotNumber
→ incorrect
```

Un Product puede existir simultáneamente en:

```text
Lot A

Lot B

Lot C
```

---

# 58. Expiration no pertenece a Product

Debe mantenerse:

```text
Product.expirationDate
→ incorrect
```

La caducidad corresponde a la existencia física representada mediante lote cuando
aplica.

---

# 59. Serial no pertenece al Product maestro

Debe mantenerse:

```text
Product
→ model/catalog identity
```

mientras una identidad individual puede pertenecer a:

```text
SERIALIZED inventory future
```

o:

```text
EquipmentAsset when ASSET
```

según estrategia.

---

# 60. Supplier no es propiedad universal de Product

Un Product puede adquirirse a distintos Suppliers.

No debe modelarse:

```text
Product.supplierId
```

como una única relación universal si el negocio permite varios proveedores.

La relación ocurre mediante operaciones como:

```text
Purchase

PurchaseReceipt
```

---

# 61. Create Product

La creación debe validar al menos:

```text
authenticated Company

SKU

name

numeric fields

optional Category

SKU uniqueness

optional Barcode uniqueness

inventoryTracking

lotTracking
```

Cuando existe Category:

```text
same Company
+
active Category
```

---

# 62. companyId

Frontend no controla arbitrariamente:

```text
companyId
```

Debe derivarse de:

```text
authenticated context
```

Conceptualmente:

```text
JWT
↓
authenticated User
↓
companyId
↓
Product operation
```

---

# 63. Update Product

La edición normal puede modificar, según contrato:

```text
sku

name

description

brand

categoryId

barcode

cost

price

minStock
```

No controla:

```text
stock
```

ni cambia normalmente:

```text
inventoryTracking

lotTracking
```

---

# 64. Update uniqueness

Al modificar:

```text
sku

barcode
```

deben volver a aplicarse reglas tenant-scoped de unicidad excluyendo al Product
actual.

---

# 65. Lifecycle separado de master-data PATCH

Debe mantenerse:

```text
PATCH /products/:id
→ master-data edit
```

y:

```text
DELETE /products/:id
→ deactivate
```

No conviene mezclar el lifecycle con un PATCH arbitrario de todos los campos.

---

# 66. API CURRENT

Endpoints Products incluyen:

```text
GET    /products

GET    /products/low-stock

GET    /products/:id

POST   /products

PATCH  /products/:id

DELETE /products/:id
```

Semántica:

```text
DELETE
→ soft-deactivation
→ not physical deletion
```

Los contratos exactos pertenecen al backend vigente.

---

# 67. Product detail

La consulta individual utiliza el tenant autenticado.

Conceptualmente:

```text
find Product
by
id + companyId
```

Un Product de otra Company no debe exponerse al usuario autenticado.

---

# 68. Active list vs historical detail

La convención actual es:

```text
GET /products
→ active Products
```

mientras:

```text
GET /products/:id
→ may recover inactive Product for history/audit context
```

Esto permite preservar relaciones históricas sin ofrecer Products inactivos como
opciones nuevas.

---

# 69. Multi-tenancy

Products y Categories deben mantenerse tenant-scoped.

Debe impedirse:

```text
Company A User
→ read Product Company B
```

```text
Company A User
→ modify Product Company B
```

```text
Product Company A
→ Category Company B
```

---

# 70. ProductSelector

`ProductSelector` es un Business Component utilizado por varios workflows.

Conceptualmente:

```text
Purchase
Quote
Sale
future Healthcare
↓
ProductSelector
↓
Product
```

---

# 71. ProductSelector no es autoridad de dominio

Aunque frontend filtre opciones:

```text
backend
→ still validates Product
```

según:

```text
tenant

existence

isActive

tracking configuration

workflow-specific rules
```

UI filtering nunca sustituye validación backend.

---

# 72. Inactive Products en selectores

Para nuevas operaciones:

```text
Product.isActive = false
→ normally excluded
```

Pero documentos históricos deben poder seguir mostrando correctamente ese Product.

---

# 73. Search

Los criterios operativos más útiles incluyen:

```text
SKU

name

brand

barcode
```

Otros filtros pueden añadirse cuando exista necesidad real.

---

# 74. Filters

Filtros útiles pueden incluir:

```text
Category

active state

brand

stock status
```

Su implementación puede evolucionar progresivamente.

---

# 75. Frontend Products V1

La ruta:

```text
/products
```

incluye actualmente capacidades como:

```text
Product list

create Product

edit Product

deactivate Product

Category selector

brand

inventoryTracking selector on create

lotTracking selector on create

tracking read-only during edit

stock read-only

minStock editable

non-destructive lifecycle language

responsive table/form behavior
```

---

# 76. Purchase integration — CURRENT

Purchases consume Product para definir:

```text
what is being ordered
```

El documento comercial conserva sus propios valores necesarios para mantener
historia.

Cambios posteriores en Product no deben reescribir una Purchase ya creada.

---

# 77. Purchase Receipt integration — CURRENT

Purchase Receipts consume:

```text
Product

inventoryTracking

lotTracking
```

para decidir reglas como:

```text
Inventory IN

lot validation

EquipmentAsset provisioning when ASSET
```

Products configura.

Purchase Receipts ejecuta el workflow físico.

---

# 78. Quote integration — CURRENT

Quotes utiliza Product para construir propuestas comerciales.

Quote Item debe conservar el valor de la propuesta sin depender permanentemente de:

```text
current Product.price
```

---

# 79. Sale integration — CURRENT

Sales V1 utiliza Product para identificar el artículo vendido.

Actualmente el flujo genérico soporta Products compatibles con:

```text
inventoryTracking = QUANTITY
```

y:

```text
lotTracking != REQUIRED
```

según las reglas vigentes de Sales.

---

# 80. Sale tracking limitations

Sales V1 no resuelve completamente:

```text
ASSET commercial fulfillment

SERIALIZED commercial fulfillment

REQUIRED-lot allocation
```

Estas limitaciones deben permanecer visibles.

Principio:

```text
Product tracking configuration
→ constrains downstream workflow compatibility
```

---

# 81. SalesOrder / Delivery — TARGET

La evolución comercial futura puede utilizar:

```text
SalesOrder
↓
Delivery
↓
Inventory OUT
```

Actualmente:

```text
Sale
→ CURRENT
```

mientras:

```text
SalesOrder / Delivery
→ TARGET
```

No deben mezclarse como si fueran el mismo estado de implementación.

---

# 82. Equipment integration — CURRENT

Para:

```text
inventoryTracking = ASSET
```

Core Equipment utiliza Product como catálogo/modelo.

Conceptualmente:

```text
Product
↓
EquipmentAsset
EquipmentAsset
EquipmentAsset
```

Cada `EquipmentAsset` representa una unidad física específica.

---

# 83. Product.stock ↔ EquipmentAsset

Para Products ASSET:

```text
EquipmentAsset
→ physical unit identity
```

mientras:

```text
Product.stock
→ aggregate Inventory projection
```

La reconciliación formal:

```text
Product.stock
↔
EquipmentAsset
```

continúa como deuda conocida.

---

# 84. Healthcare boundary

Products debe permanecer genérico aunque Healthcare sea una vertical principal.

No debe incorporar campos como:

```text
doctorId

hospitalId

surgeryType

caseId
```

únicamente porque Healthcare utiliza Products.

---

# 85. Healthcare TARGET

Healthcare podrá utilizar Product en capacidades como:

```text
Requirements

CaseKit

Case preparation

Dispatch

Reconciliation
```

cuando esos workflows sean implementados.

Products sigue siendo únicamente la identidad Core del artículo.

---

# 86. Regulatory extension — FUTURE

Healthcare puede requerir posteriormente información como:

```text
regulatory registration

manufacturer

classification

regulatory documents
```

Antes de modificar Product deberá decidirse si pertenece a:

```text
Product Core
```

o:

```text
Healthcare Product Extension
```

---

# 87. Returns — FUTURE

Generic Commercial Returns no forma parte del flujo actual de ERP Core V1.

Una futura implementación deberá relacionarse con la operación original y
preservar trazabilidad.

No debe inferir qué existencia regresó utilizando únicamente:

```text
productId
```

cuando existan:

```text
lot

serial

asset identity
```

---

# 88. Dashboard integration

Dashboard puede consumir Product para métricas como:

```text
total active Products

low-stock Products
```

sin convertirse en propietario de reglas de Products o Inventory.

---

# 89. Audit — TARGET

Una futura capacidad transversal de Audit puede registrar:

```text
Product created

Product updated

Product deactivated

Product reactivated

tracking migration

sensitive price/cost changes
```

Actualmente no existe un Audit transversal completo.

---

# 90. Price history — FUTURE

Si el negocio lo requiere podrá existir historia específica:

```text
Price 100
↓
Price 120
```

No debe agregarse anticipadamente sin caso funcional aprobado.

---

# 91. Import — FUTURE

Products es candidato natural para Data Import desde:

```text
CSV

XLSX

external systems
```

Conceptualmente:

```text
File
↓
Mapping
↓
Validation
↓
Duplicate detection
↓
Preview
↓
Import
```

---

# 92. Import duplicate detection

Un futuro import deberá considerar al menos:

```text
SKU

Barcode
```

dentro del tenant.

La política de:

```text
create

skip

merge

update
```

deberá definirse explícitamente.

---

# 93. Initial stock durante Import

Importar catálogo:

```text
≠
import physical inventory
```

No debe hacerse:

```text
Product import
↓
arbitrary Product.stock assignment
```

sin un workflow controlado de Initial Inventory.

---

# 94. Product 360 — FUTURE

Una futura experiencia Product 360 puede responder:

```text
¿Qué Product es?

¿Cuánto existe?

¿Qué lotes tiene?

¿Qué movimientos tiene?

¿Cómo se compra?

¿Cómo se vende?

¿Qué historia posee?
```

Tabs conceptuales podrían incluir:

```text
General

Inventory

Batches

Movements

Purchases

Sales

History
```

Esto representa:

```text
read model / contextual UX
```

y no transfiere ownership de otros dominios hacia Products.

---

# 95. Units of Measure — FUTURE

Actualmente las cantidades utilizan el modelo existente.

Antes de soportar plenamente:

```text
kg

liters

meters

boxes with conversion
```

debe diseñarse una estrategia coherente entre:

```text
Products

Purchases

Inventory

Sales
```

---

# 96. Variants — FUTURE

No debe introducirse un sistema complejo de variantes sin necesidad real.

Ejemplo futuro:

```text
Product Family
↓
Presentation / Size / Variant
```

requiere diseño propio.

---

# 97. Manufacturer — FUTURE

Brand y Manufacturer pueden ser conceptos distintos.

Actualmente no deben crearse nuevas entidades únicamente para anticipar esa
distinción.

Healthcare podrá hacerla relevante posteriormente.

---

# 98. QR — FUTURE

QR puede utilizarse posteriormente para:

```text
Products

Inventory

Equipment

Healthcare workflows
```

No requiere convertir QR en un campo universal adicional de Product desde ahora.

---

# 99. IMPLEMENTED

Actualmente están implementados:

```text
Product persistence

Category integration

SKU

name

description

brand

barcode

cost

price

stock projection

minStock

inventoryTracking

lotTracking

isActive

tenant-scoped Product detail

tenant-safe active Category validation

stock excluded from create/update input

tracking selection on creation

tracking protected from normal update

soft-deactivation through DELETE

inactive historical detail

Product frontend

ProductSelector integration

low-stock route
```

---

# 100. VALIDATED

La validación registrada incluye:

```text
Product create

Product update

SKU uniqueness

Barcode uniqueness

Category same-tenant validation

inactive Category rejection

stock read-only contract

tracking creation

tracking immutability

soft-deactivation

inactive historical lookup

frontend Product workflows

related regression
```

Los gates técnicos incluyen según el hito:

```text
tests

build

lint

git diff --check
```

Los snapshots cuantitativos se mantienen en:

```text
PROJECT_BOARD.md

CHANGELOG.md
```

---

# 101. TECHNICAL DEBT

Permanece abierto:

```text
Product reactivation workflow
```

```text
tracking migration workflow
```

```text
SERIALIZED operational semantics
```

```text
Product.stock
↔
EquipmentAsset reconciliation
```

```text
backend pagination
```

```text
server-side Product search/filtering
```

```text
Audit integration
```

---

# 102. TARGET

Evoluciones aprobadas o razonables posteriores incluyen:

```text
Product reactivation

tracking migration

Product 360

better server-side search

Audit integration

Data Import
```

Su prioridad debe definirse dentro del plan general del ERP y no únicamente desde
Products.

---

# 103. FUTURE

Capacidades posibles:

```text
Price Lists

Units of Measure

Product Variants

Multiple Barcodes

Images

Documents

Supplier Catalog Codes

Regulatory Product Profile

Advanced Search

QR workflows

AI classification

Demand recommendations
```

No deben considerarse comprometidas únicamente por aparecer en esta lista.

---

# 104. Seguridad y autorización

Products utiliza el modelo transversal de Identity & Access.

Debe mantenerse:

```text
authenticated companyId
→ tenant authority
```

No:

```text
client companyId
→ authorization
```

Permissions conceptuales futuras pueden incluir:

```text
products.read

products.create

products.update

products.deactivate

categories.read

categories.create

categories.update

categories.deactivate
```

Actualmente el Permission-Based RBAC completo permanece TARGET.

---

# 105. Trabajo de seguridad preproducción

Products participa en la revisión transversal de:

```text
critical endpoint authorization

systematic tenant-isolation regression

inactive-user enforcement

safe role provisioning
```

No debe crear una solución de seguridad aislada del resto de la plataforma.

---

# 106. Invariantes

## Tenant

```text
Product
→ belongs to one Company
```

---

## SKU

```text
companyId + sku
→ unique
```

---

## Barcode

```text
companyId + barcode
→ unique when present
```

---

## Category

```text
Product Category
→ same Company
```

Para una nueva asignación:

```text
Category
→ active
```

---

## Stock

```text
Product.stock
→ not arbitrary Product CRUD input
```

---

## Tracking

```text
inventoryTracking
→ selected at creation
```

```text
lotTracking
→ selected at creation
```

```text
normal PATCH
→ does not migrate tracking strategy
```

---

## Lot

```text
lotNumber
→ not Product master field
```

---

## Expiration

```text
expirationDate
→ not Product master field
```

---

## Equipment

```text
Product
≠
EquipmentAsset
```

---

## Serialization

```text
SERIALIZED
≠
ASSET
```

---

## Historical documents

```text
Product master-data change
→ does not rewrite historical transaction values
```

---

## Lifecycle

```text
Inactive Product
→ remains historically visible
```

---

# 107. Anti-patrones

## Editable stock

```text
Edit Product
↓
stock = arbitrary value
```

Incorrecto.

---

## Product per lot

```text
new lot
↓
new Product
```

Incorrecto.

---

## Lot inside Product

```text
Product.lotNumber
```

Incorrecto.

---

## Expiration inside Product

```text
Product.expirationDate
```

Incorrecto.

---

## Serial inside Product master

Utilizar un único `Product.serialNumber` para representar unidades físicas
individuales.

Incorrecto.

---

## Fixed Supplier

```text
Product.supplierId
```

como proveedor universal único.

Incorrecto si el producto puede adquirirse a varios Suppliers.

---

## Tracking PATCH

```text
PATCH Product
QUANTITY → ASSET
```

como simple edición de master data.

Incorrecto.

---

## ASSET as normal quantity only

Ignorar `EquipmentAsset` para Products reutilizables ASSET.

Incorrecto.

---

## SERIALIZED = ASSET

Utilizar Equipment automáticamente para cualquier Product serializado.

Incorrecto.

---

## Hard deleting history

Eliminar físicamente Product porque ya no se utiliza.

Preferir desactivación.

---

## Healthcare contamination

Agregar directamente a Product:

```text
doctorId

hospitalId

caseId

surgeryType
```

para resolver workflows Healthcare.

---

## Frontend-only validation

Confiar en que ProductSelector filtró correctamente y omitir validación backend.

---

# 108. Relación con Inventory

Debe mantenerse:

```text
Product
→ catalog identity + tracking configuration
```

```text
Inventory
→ quantity + batches + movement history
```

`Product.stock` es una proyección persistida de Inventory y no una propiedad
maestra libremente editable.

---

# 109. Relación con Equipment

Para Products:

```text
inventoryTracking = ASSET
```

Equipment administra:

```text
EquipmentAsset
```

como identidad física individual.

Products no administra:

```text
lifecycle

condition

Inspection

Retirement

Current Equipment Availability
```

---

# 110. Relación con Purchase Receipts

Products define:

```text
inventoryTracking

lotTracking
```

Purchase Receipts aplica esas configuraciones durante la entrada física.

Debe mantenerse:

```text
Product configuration
≠
Receipt execution
```

---

# 111. Relación con Sales

Products identifica el artículo.

Sales CURRENT decide el workflow comercial vigente.

Actualmente:

```text
Sale
→ CURRENT
```

Futuro:

```text
SalesOrder
+
Delivery
→ TARGET
```

Products no decide por sí solo cuándo se produce un Inventory OUT.

---

# 112. Relación con Healthcare

Healthcare consume Product como catálogo Core.

Las reglas específicas de:

```text
Case

Kit

Dispatch

Custody

Return
```

pertenecen a Healthcare.

---

# 113. ADR relacionados

```text
ADR-001 — Multi-Tenant

ADR-004 — UUID

ADR-005 — Layered Architecture

ADR-006 — API First

ADR-007 — RBAC

ADR-009 — Modular Monolith

ADR-012 — Entity Lifecycle
```

---

# 114. Documentación relacionada

```text
docs/product/PRODUCT_REQUIREMENTS.md

docs/product/ZAPING_WAY.md

docs/architecture/ARCHITECTURE.md

docs/engineering/API_GUIDELINES.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/ux/BUSINESS_COMPONENTS.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/PURCHASES.md

docs/modules/erp/PURCHASE_RECEIPTS.md

docs/modules/erp/QUOTES.md

docs/modules/erp/SALES.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

---

# 115. Fuente de verdad

```text
PRODUCTS.md
→ Product / Category functional behavior

INVENTORY.md
→ stock, batches and movement semantics

EQUIPMENT.md
→ reusable ASSET physical identity

PURCHASE_RECEIPTS.md
→ physical receipt behavior

SALES.md
→ CURRENT Sale behavior

Healthcare docs
→ vertical-specific Product usage

schema.prisma
→ CURRENT persistence model

Products backend
→ CURRENT API/business implementation

Products frontend
→ CURRENT UX

tests
→ validated behavior

PROJECT_BOARD.md
→ current status and active debt

CHANGELOG.md
→ historical implementation evolution
```

---

# 116. Estado consolidado

```text
Product CRUD
✅ IMPLEMENTED / VALIDATED

Category integration
✅ IMPLEMENTED / VALIDATED

SKU tenant uniqueness
✅ IMPLEMENTED / VALIDATED

Barcode tenant uniqueness
✅ IMPLEMENTED / VALIDATED

Product.stock read-only in Product CRUD
✅ IMPLEMENTED / VALIDATED

minStock
✅ IMPLEMENTED / VALIDATED

inventoryTracking
✅ IMPLEMENTED / VALIDATED

lotTracking
✅ IMPLEMENTED / VALIDATED

tracking immutable in normal PATCH
✅ IMPLEMENTED / VALIDATED

active tenant-safe Category validation
✅ IMPLEMENTED / VALIDATED

Product soft-deactivation
✅ IMPLEMENTED / VALIDATED

inactive historical Product retrieval
✅ IMPLEMENTED / VALIDATED

ProductSelector
✅ IMPLEMENTED

Products frontend V1
✅ IMPLEMENTED / VALIDATED
```

Pendiente:

```text
Product reactivation
⏳

tracking migration workflow
⏳

SERIALIZED operational semantics
⏳

Product.stock ↔ EquipmentAsset reconciliation
⏳

server-side pagination/search
⏳

Product Audit integration
⏳
```

---

# 117. Secuencia de proyecto

Products V1 forma parte del ERP Core ya normalizado.

La secuencia vigente del proyecto es:

```text
H8 Documentation / Technical Regression
↓
UX-B.6 Full ERP End-to-End QA
↓
ERP Core V1 Closure
↓
Healthcare specialization
```

Por tanto, capacidades como:

```text
Product 360

Data Import

advanced pricing

tracking migration
```

no deben convertirse automáticamente en el siguiente sprint únicamente por estar
documentadas.

Su prioridad deberá evaluarse después del cierre correspondiente del ERP Core.

---

# 118. Principio final

Products debe representar de forma estable:

```text
¿Qué artículo comercial es?
```

Inventory debe responder:

```text
¿Cuánto existe?
¿Qué lote existe?
¿Qué movimientos ocurrieron?
```

Equipment debe responder, cuando el Product es ASSET:

```text
¿Qué unidad física exacta es?
```

La separación correcta es:

```text
Product
├── SKU
├── Name
├── Description
├── Brand
├── Category
├── Barcode
├── Reference Cost
├── Reference Price
├── minStock
├── inventoryTracking
├── lotTracking
└── Catalog Lifecycle
```

```text
Inventory
├── Product.stock projection
├── InventoryBatch
└── InventoryMovement
```

```text
Equipment
└── EquipmentAsset
```

Debe mantenerse:

```text
Catalog identity
≠
Inventory quantity
≠
Physical ASSET identity
```
