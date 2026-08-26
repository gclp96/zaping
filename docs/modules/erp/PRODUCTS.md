# Módulo de Productos — Zaping ERP

**Módulo:** Products
**Producto:** Zaping ERP Core
**Versión:** 2.1.0
**Estado:** Aprobado
**Estado de implementación:** PRODUCTS V1 IMPLEMENTED / VALIDATED
**Última actualización:** 2026-08-25
**Responsable:** Zaping ERP Team

---

# 1. Propósito

El módulo Products administra el catálogo maestro de productos de una Company.

Su responsabilidad principal es responder:

```text
¿Qué producto es?
¿Cómo lo identifica la empresa?
¿Cómo debe describirse?
¿A qué categoría pertenece?
¿Cuál es su marca?
¿Cuáles son sus valores comerciales de referencia?
¿Puede utilizarse en nuevas operaciones?
```

Products representa **identidad comercial y de catálogo**.

No representa una existencia física específica.

---

# 2. Principio fundamental

```text
Product
=
qué producto es
```

mientras:

```text
Inventory
=
cuánto existe
cómo llegó
qué lote existe
qué movimientos ocurrieron
```

Por tanto:

> Product define el catálogo. Inventory define las existencias.

---

# 3. Responsabilidades

Products es propietario de información maestra como:

* SKU;
* nombre;
* descripción;
* marca;
* categoría;
* código de barras;
* costo de referencia;
* precio de referencia;
* stock resumido mientras exista esa proyección;
* mínimo de stock;
* estado activo/inactivo.

---

# 4. Fuera del alcance

Products no es propietario de:

* Supplier de una compra específica;
* lote;
* caducidad;
* InventoryMovement;
* Purchase;
* PurchaseReceipt;
* SalesOrder;
* Delivery;
* Customer;
* Case;
* custodia;
* factura;
* precio histórico de una operación.

---

# 5. Entidades principales

El dominio contiene actualmente dos conceptos principales:

```text
Products
├── Product
└── Category
```

---

# 6. Product

`Product` representa un artículo comercial dentro de una Company.

Conceptualmente puede contener:

```text
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
isActive
createdAt
updatedAt
```

La definición técnica exacta debe verificarse contra el `schema.prisma` vigente.

---

# 7. Category

`Category` permite organizar productos dentro del catálogo.

Conceptualmente:

```text
Category
├── id
├── companyId
├── name
├── description
├── isActive
└── products
```

---

# 8. Product es Master Data

Product sigue la estrategia de lifecycle de Master Data establecida en ADR-012.

La transición principal es:

```text
ACTIVE
↓
INACTIVE
```

No:

```text
EXISTS
↓
DELETED
```

como comportamiento empresarial predeterminado.

---

# 9. Producto activo

Un producto activo puede utilizarse normalmente en nuevas operaciones como:

* Purchase;
* Quote;
* SalesOrder;
* Receipt;
* otros workflows autorizados.

---

# 10. Producto inactivo

Un producto inactivo continúa existiendo históricamente.

Debe permanecer visible cuando ya forma parte de:

* compras;
* recepciones;
* movimientos;
* cotizaciones;
* ventas;
* devoluciones;
* Cases.

Pero normalmente no debe aparecer como opción predeterminada para nuevas operaciones.

---

# 11. Desactivación

La acción empresarial recomendada es:

```text
Desactivar producto
```

no:

```text
Eliminar producto
```

cuando el objetivo real es impedir su uso futuro.

---

# 12. Implementación legacy de eliminación

Versiones anteriores de Products pueden contener un flujo CRUD con acción de eliminación.

Ese comportamiento debe auditarse contra ADR-012.

No debe utilizarse como precedente para implementar nuevas eliminaciones físicas de productos con historia relacionada.

---

# 13. Hard Delete

La eliminación física puede considerarse únicamente cuando un producto:

* fue creado accidentalmente;
* no participa en documentos;
* no tiene movimientos;
* no tiene lotes;
* no tiene relaciones históricas relevantes;
* y la operación está explícitamente permitida.

No es la estrategia normal.

---

# 14. SKU

`sku` constituye el identificador comercial interno principal del Product dentro de una Company.

Ejemplo:

```text
CAT-15MM-001
```

Debe ser:

* obligatorio;
* estable;
* legible;
* único dentro de la Company.

---

# 15. Unicidad del SKU

La regla es:

```text
Company A
SKU XYZ
→ único
```

Otra Company puede utilizar el mismo SKU.

Por tanto:

```text
unique(companyId, sku)
```

representa correctamente la semántica multi-tenant.

---

# 16. SKU no es UUID

Debe distinguirse:

```text
id
→ identificador técnico UUID
```

de:

```text
sku
→ identificador comercial
```

El usuario normalmente busca y reconoce el SKU, no el UUID.

---

# 17. Cambio de SKU

Modificar un SKU debe realizarse con precaución porque puede ser utilizado:

* en documentos;
* búsquedas;
* integraciones;
* reportes;
* etiquetas;
* procesos físicos.

El UUID continúa proporcionando identidad técnica aunque cambie el SKU.

---

# 18. Nombre

`name` representa el nombre corto y reconocible del producto.

Ejemplo:

```text
Catéter diagnóstico 15 mm
```

Debe ser adecuado para:

* tablas;
* selectores;
* documentos;
* búsquedas.

---

# 19. Descripción

`description` permite guardar información más extensa o técnica.

No debe utilizarse para almacenar datos estructurados que posteriormente necesiten:

* búsqueda;
* validación;
* filtros;
* reglas.

---

# 20. Marca

`brand` pertenece al Product maestro.

Ejemplo:

```text
Catéter 15 mm
Marca: Terumo
```

y:

```text
Catéter 15 mm
Marca: Cordis
```

pueden representar productos comerciales diferentes.

---

# 21. Regla de marca

`brand` es:

```text
opcional
```

El Product continúa siendo válido aunque no tenga marca registrada.

---

# 22. Marca editable

La marca puede modificarse como parte de los datos maestros del producto cuando el usuario tenga autorización.

Los documentos históricos pueden conservar su propia información contextual si posteriormente es necesario congelarla.

---

# 23. Catálogo de marcas

Actualmente:

```text
brand
→ campo de Product
```

No existe necesidad aprobada de introducir:

```text
Brand
→ entidad independiente
```

---

# 24. No sobrearquitecturar Brand

No crear por anticipado:

* Brand table;
* Brand permissions;
* Brand lifecycle;
* Brand API;
* Brand admin module;

sin una necesidad funcional concreta.

---

# 25. Category

Una Category agrupa productos con propósitos de:

* organización;
* búsqueda;
* navegación;
* clasificación;
* futuros reportes.

---

# 26. Category opcional

La relación Product → Category puede ser opcional.

Un Product no debe quedar inválido únicamente porque todavía no haya sido clasificado, salvo que una futura configuración empresarial establezca lo contrario.

---

# 27. Category por Company

Las categorías pertenecen al tenant.

Conceptualmente:

```text
Company A
├── Cardiología
└── Hemodinamia
```

es independiente de:

```text
Company B
├── Cardiología
└── Hemodinamia
```

---

# 28. Nombre de Category

El nombre debe ser único dentro de la Company.

Conceptualmente:

```text
unique(companyId, name)
```

---

# 29. Lifecycle de Category

Category es también Master Data.

La estrategia principal es:

```text
ACTIVE
↓
INACTIVE
```

---

# 30. Category inactiva

Desactivar una Category:

* no elimina sus Products;
* no elimina historia;
* no modifica documentos anteriores.

Normalmente debe impedir utilizarla para nuevas clasificaciones mientras permanezca inactiva.

---

# 31. Producto dentro de Category inactiva

Un Product no debe desaparecer únicamente porque su Category haya sido desactivada.

La interfaz debe representar la relación histórica correctamente.

---

# 32. Barcode

`barcode` identifica el Product mediante código de barras cuando existe.

Es útil para:

* búsqueda;
* recepción;
* inventario;
* picking;
* futuras operaciones de scanner.

---

# 33. Barcode opcional

No todos los productos necesitan actualmente un barcode.

Por tanto:

```text
barcode
→ optional
```

---

# 34. Unicidad del Barcode

Cuando existe, debe mantenerse único dentro de la Company.

Conceptualmente:

```text
unique(companyId, barcode)
```

---

# 35. Barcode no es lote

Debe distinguirse:

```text
Product.barcode
→ identifica producto
```

de:

```text
InventoryBatch.lotNumber
→ identifica lote físico
```

Un mismo Product puede tener muchas existencias por lote conservando el mismo código de producto.

---

# 36. QR futuro

El uso de QR podrá complementar Barcode para:

* inventario;
* Cases;
* Equipment;
* documentos;
* tracking.

No requiere convertir QR en un atributo universal del Product.

---

# 37. Cost

`cost` representa actualmente un costo de referencia del Product.

Puede utilizarse como valor inicial para operaciones como Purchase.

---

# 38. Costo histórico

Cuando un Product participa en una Purchase:

```text
Product.cost
↓
PurchaseItem.price / unitCost snapshot
```

el documento debe conservar su valor histórico.

Cambiar posteriormente:

```text
Product.cost
```

no debe modificar una Purchase existente.

---

# 39. Price

`price` representa actualmente un precio de venta de referencia.

Puede utilizarse para precargar:

* Quote;
* SalesOrder;
* otros documentos comerciales.

---

# 40. Precio histórico

Cuando un documento comercial guarda su precio:

```text
Product.price changes
```

no debe reescribir automáticamente:

```text
QuoteItem.price
SalesOrderItem.price
historical SaleItem.price
```

Los documentos representan la operación realizada en ese momento.

---

# 41. Price no es pricing engine

El campo `price` no debe interpretarse como un sistema completo de pricing.

Una evolución futura puede necesitar:

* listas de precios;
* precios por cliente;
* descuentos;
* monedas;
* vigencias;
* reglas comerciales.

No deben añadirse hasta que el dominio lo requiera.

---

# 42. Dinero

Los campos actuales de costo y precio utilizan el modelo monetario existente.

Antes de ampliar significativamente capacidades financieras deberá revisarse:

* precisión;
* redondeo;
* moneda;
* representación en Prisma.

Products no resuelve por sí solo esa decisión.

---

# 43. Stock

`Product.stock` existe como resumen operativo de inventario.

Pero la regla arquitectónica es:

```text
Product.stock
=
projection / summary
```

no:

```text
Product.stock
=
manual catalog property
```

---

# 44. Stock no pertenece al formulario maestro

Crear o editar Product no debe utilizarse para cambiar arbitrariamente su existencia física.

Incorrecto:

```text
Editar producto
↓
stock = 100
```

como operación cotidiana.

---

# 45. Fuente del stock

El stock debe modificarse mediante Inventory.

Ejemplos:

```text
PurchaseReceipt
Delivery
Return
Adjustment
```

---

# 46. Relación con Inventory

Products proporciona:

```text
Product identity
```

Inventory proporciona:

```text
Product quantity
Product history
Product batches
Product availability
```

---

# 47. minStock

`minStock` representa el nivel mínimo operativo configurado para el Product.

Puede utilizarse para detectar:

```text
Low Stock
```

---

# 48. minStock no crea compras

La regla:

```text
stock <= minStock
```

puede producir:

* alerta;
* indicador;
* recomendación futura.

No debe generar una Purchase automáticamente sin una decisión explícita del workflow.

---

# 49. Estado de inventario

Actualmente Product puede presentarse mediante estados como:

```text
Sin stock
Bajo stock
En stock
```

La lógica pertenece a Inventory.

Products aporta los datos necesarios como `minStock`.

---

# 50. Lote

`lotNumber` **no pertenece a Product**.

Un mismo Product puede existir en:

```text
Lot A
Lot B
Lot C
```

simultáneamente.

---

# 51. Caducidad

`expirationDate` **no pertenece a Product**.

Pertenece a la existencia física correspondiente, actualmente representada mediante `InventoryBatch`.

---

# 52. Supplier

Supplier tampoco constituye una propiedad universal del Product.

Un producto puede comprarse a diferentes proveedores.

La relación ocurre mediante contextos como:

```text
Purchase
PurchaseReceipt
InventoryBatch
```

según el diseño vigente.

---

# 53. Product comercial vs existencia

Ejemplo:

```text
Product

SKU: CAT-15MM-001
Nombre: Catéter 15 mm
Marca: Terumo
```

puede tener:

```text
Batch L001
Proveedor A
Caduca 2027
20 unidades
```

y:

```text
Batch L002
Proveedor B
Caduca 2028
30 unidades
```

---

# 54. Identidad de Product

La identidad comercial no debe depender del lote.

Correcto:

```text
1 Product
N InventoryBatches
```

No:

```text
1 Product nuevo
por cada lote recibido
```

---

# 55. Serialización

Los números de serie tampoco deben convertirse en campos simples del Product maestro.

Conceptualmente:

```text
Product
→ modelo o tipo de artículo

Serial
→ unidad física específica
```

---

# 56. Configuración futura de trazabilidad

El modelo futuro puede necesitar distinguir productos:

```text
sin tracking especial
con lote obligatorio
con caducidad
serializados
reutilizables
```

Una posible dirección podría utilizar capacidades como:

```text
requiresLotTracking
requiresExpirationTracking
requiresSerialTracking
```

pero los nombres y estructura **no están aprobados como schema** en este documento.

---

# 57. No cambiar Prisma todavía

No deben agregarse estos flags únicamente porque aparecen como necesidad futura.

Primero debe diseñarse:

* Inventory;
* Delivery;
* Returns;
* Healthcare;
* Equipment;

de manera conjunta.

---

# 58. Healthcare

Products continúa siendo genérico aun cuando Healthcare sea la primera vertical.

Información médica especializada no debe incorporarse al Core automáticamente.

---

# 59. Datos regulatorios

Capacidades futuras pueden necesitar información como:

* registro sanitario;
* fabricante;
* clasificación;
* documentación regulatoria.

Debe decidirse si esos datos pertenecen a:

```text
Product Core
```

o a:

```text
Healthcare Product Extension
```

antes de modificar el modelo.

---

# 60. Principio de no contaminación

Incorrecto:

```text
Product
├── doctorId
├── surgeryType
└── hospitalId
```

solo porque Healthcare utilice Products.

Product debe seguir siendo reutilizable por otras verticales.

---

# 61. Equipment

Un equipo reutilizable puede tener un Product asociado.

Ejemplo:

```text
Product
Angiógrafo modelo X
```

mientras cada equipo físico podría representarse posteriormente como:

```text
EquipmentAsset
Serial 001

EquipmentAsset
Serial 002
```

No deben confundirse catálogo y activo físico.

---

# 62. Create Product

La creación de Product debe validar como mínimo:

* Company autenticada;
* SKU;
* nombre;
* campos numéricos;
* Category si existe;
* unicidad;
* Barcode si existe.

---

# 63. companyId

Frontend no debe determinar arbitrariamente el tenant.

Conceptualmente:

```text
JWT
↓
Authenticated User
↓
companyId
↓
Create Product
```

---

# 64. Duplicado de SKU

Debe rechazarse:

```text
Company A
SKU CAT-001
```

si ya existe otro Product de Company A con el mismo SKU.

---

# 65. SKU entre Companies

Sí puede existir:

```text
Company A → CAT-001
Company B → CAT-001
```

porque los tenants son independientes.

---

# 66. Barcode duplicado

Cuando se captura Barcode, debe verificarse su unicidad dentro de la Company.

El mensaje debe ser empresarial y comprensible.

Ejemplo:

```text
Ya existe un producto con este código de barras.
```

---

# 67. Category validation

Si se envía `categoryId`, backend debe verificar:

```text
Category exists
AND
Category belongs to authenticated Company
```

No basta con que el UUID exista.

---

# 68. Update Product

La edición puede permitir modificar, según las reglas actuales:

* SKU;
* nombre;
* descripción;
* marca;
* Category;
* Barcode;
* costo;
* precio;
* mínimo;
* estado.

Stock físico debe quedar fuera de edición arbitraria.

---

# 69. Actualización y unicidad

Al modificar:

```text
sku
barcode
```

deben ejecutarse nuevamente las validaciones de unicidad excluyendo al Product actual.

---

# 70. Reactivación

Cuando un Product inactivo vuelva a utilizarse:

```text
INACTIVE
↓
ACTIVE
```

debe verificarse que continúe cumpliendo las reglas aplicables.

---

# 71. ProductSelector

`ProductSelector` es un Business Component implementado para localizar Products dentro de workflows.

Conceptualmente:

```text
Purchase
Quote
Sales
Healthcare
↓
ProductSelector
↓
Product
```

---

# 72. ProductSelector no valida el dominio

Seleccionar un Product desde UI no elimina la necesidad de verificar en backend:

* tenant;
* existencia;
* estado;
* reglas del workflow.

---

# 73. Productos inactivos en selector

Normalmente:

```text
Product.isActive = false
```

debe excluirlo de nuevas selecciones.

Pero debe seguir mostrándose correctamente dentro de documentos históricos.

---

# 74. Búsqueda

El catálogo debe poder localizar productos utilizando datos operativos relevantes.

Especialmente:

```text
SKU
Nombre
Marca
Barcode
```

y posteriormente otros criterios cuando exista necesidad.

---

# 75. Búsqueda Healthcare

Para empresas de suministros médicos resulta especialmente útil identificar un producto combinando:

```text
SKU
Nombre
Marca
```

porque productos técnicamente similares pueden representar artículos comerciales distintos.

---

# 76. Filtros

Filtros útiles pueden incluir progresivamente:

* Category;
* Active / Inactive;
* Brand;
* stock status.

No todos necesitan estar implementados inmediatamente.

---

# 77. Listado

La tabla principal debe priorizar información útil para identificación.

Ejemplo:

```text
SKU
Producto
Marca
Categoría
Precio
Stock
Estado
Acciones
```

La composición exacta puede evolucionar con UX.

---

# 78. Product 360

La arquitectura objetivo contempla una vista `Product 360`.

Debe responder:

```text
¿Qué producto es?
¿Cuánto existe?
¿Dónde está?
¿Qué lotes tiene?
¿Qué está por caducar?
¿Cómo se compra?
¿Cómo se vende?
¿Qué ocurrió históricamente?
```

---

# 79. Tabs conceptuales de Product 360

Una evolución posible:

```text
General
Inventario
Lotes
Movimientos
Compras
Ventas
Historial
```

No todas deben implementarse simultáneamente.

---

# 80. Product 360 no absorbe dominios

Mostrar Purchases o Inventory dentro de Product 360 no convierte Products en propietario de esas reglas.

La vista es un Read Model / experiencia contextual.

---

# 81. API

Conceptualmente Products utiliza operaciones como:

```text
GET    /products
GET    /products/:id
POST   /products
PATCH  /products/:id
```

La operación de lifecycle debe alinearse progresivamente con ADR-012.

---

# 82. Desactivación API objetivo

Preferir una semántica explícita como:

```text
PATCH /products/:id

{
  "isActive": false
}
```

o una acción equivalente claramente documentada.

No utilizar `DELETE` para aparentar que un Product histórico dejó de existir.

---

# 83. Categories API

Category constituye un recurso propio dentro del catálogo.

Puede utilizar operaciones conceptuales como:

```text
GET   /categories
POST  /categories
PATCH /categories/:id
```

respetando tenant y lifecycle.

---

# 84. Multi-tenancy

Todas las operaciones de Products y Categories deben filtrar por Company.

Debe impedirse:

```text
Company A user
↓
GET Product Company B
```

y:

```text
Company A user
↓
PATCH Product Company B
```

---

# 85. Relaciones cross-tenant

Debe rechazarse:

```text
Product Company A
↓
Category Company B
```

aunque ambos IDs existan.

---

# 86. RBAC

Permisos futuros pueden incluir:

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

La granularidad se implementará progresivamente según ADR-007.

---

# 87. Auditoría

Cambios relevantes podrán registrar:

```text
Product created
Product updated
Product deactivated
Product reactivated
```

especialmente modificaciones sensibles como:

* SKU;
* precio;
* costo;
* estado.

---

# 88. Cambios de precio

Una futura auditoría de precios puede necesitar registrar:

```text
Price 100
↓
Price 120
```

en lugar de conocer únicamente el valor actual.

No se introduce todavía un historial de precios sin un caso funcional aprobado.

---

# 89. Importación

Products es una de las entidades prioritarias del futuro módulo de Data Import.

Debe soportarse posteriormente importación desde:

* CSV;
* XLSX;
* sistemas externos.

---

# 90. Flujo de importación

Conceptualmente:

```text
File
↓
Column mapping
↓
Validation
↓
Duplicate detection
↓
Preview
↓
Import
```

No debe insertarse directamente información inválida en Product.

---

# 91. Identificación de duplicados en importación

Debe evaluarse al menos:

```text
SKU
Barcode
```

dentro del tenant.

La estrategia exacta para merge/update deberá definirse en el módulo de importaciones.

---

# 92. Initial Stock durante importación

Importar Products no debe significar automáticamente:

```text
Product.stock = imported value
```

sin una operación controlada de Initial Inventory.

Catálogo e inventario continúan siendo conceptos distintos.

---

# 93. Integración con Purchases

Purchases consume Products para definir:

```text
qué se está ordenando
```

y conserva snapshots de información comercial necesaria.

---

# 94. Integración con Inventory

Inventory consume Product como identidad maestra.

Conceptualmente:

```text
Product
↓
InventoryBatch
↓
InventoryMovement
```

---

# 95. Integración con Quotes

Quotes utiliza Products para construir propuestas comerciales.

QuoteItem debe conservar la información económica de la propuesta sin depender permanentemente del precio actual del Product.

---

# 96. Integración con Sales

SalesOrder utiliza Product para identificar qué artículo se está vendiendo.

Delivery e Inventory determinan qué existencia física se entrega.

---

# 97. Integración con Returns

Returns debe vincularse a la operación original.

No debe utilizar únicamente:

```text
productId
```

para asumir qué existencia física regresó cuando existe trazabilidad por lote.

---

# 98. Integración con Healthcare

Healthcare puede utilizar Product para construir:

* KitTemplate;
* CaseKit;
* CaseDispatch;
* Reconciliation.

La vertical puede añadir contexto especializado sin modificar la identidad genérica del catálogo.

---

# 99. Dashboard

Dashboard puede consumir Products para métricas como:

```text
total products
low stock products
inactive products
```

pero no es propietario de sus reglas.

---

# 100. Estado CURRENT

La documentación consolidada identifica como actuales:

```text
Product CRUD
Category support
SKU
Name
Description
Brand
Barcode
Cost
Price
Stock projection
minStock
isActive
ProductSelector
multi-tenant uniqueness
```

El estado técnico exacto debe validarse contra el repositorio vigente durante la auditoría final.

---

# 101. Estado TARGET

Evolución aprobada:

```text
Correct deactivate lifecycle
Product 360
Improved search
Brand filtering
Category filtering
OpenAPI documentation
Audit improvements
Inventory context
Import support
Tracking configuration
```

---

# 102. Estado FUTURE

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

Estas capacidades no deben considerarse comprometidas únicamente por aparecer aquí.

---

# 103. Units of Measure

El modelo actual utiliza cantidades enteras.

Antes de introducir productos vendidos por:

```text
kg
litros
metros
cajas con conversiones
```

debe diseñarse una estrategia de unidades consistente con:

* Products;
* Purchases;
* Inventory;
* Sales.

---

# 104. Variants

No debe agregarse un sistema complejo de variantes hasta que exista una necesidad real.

Ejemplo futuro:

```text
Product Family
↓
Size / Presentation / Variant
```

requiere una decisión específica.

---

# 105. Manufacturer

Marca y fabricante pueden representar conceptos distintos.

Actualmente no deben crearse entidades nuevas únicamente para anticipar esta distinción.

Healthcare podrá requerir formalizarla posteriormente.

---

# 106. Nombre comercial vs descripción técnica

Zaping debe permitir que el usuario identifique rápidamente el Product sin convertir el nombre en una ficha técnica completa.

Preferir:

```text
Name
→ corto y operativo

Description
→ información extendida
```

---

# 107. Invariantes

```text
Product
→ belongs to one Company
```

```text
SKU
→ unique within Company
```

```text
Barcode
→ unique within Company when present
```

```text
Category relation
→ same Company
```

```text
Product stock
→ not arbitrary master-data input
```

```text
Lot
→ not Product field
```

```text
Expiration
→ not Product field
```

```text
Historical documents
→ not rewritten when Product changes
```

```text
Inactive Product
→ remains historically visible
```

---

# 108. Anti-patrones

## Lote dentro de Product

```text
Product.lotNumber
```

Incorrecto para productos con múltiples lotes.

---

## Caducidad dentro de Product

```text
Product.expirationDate
```

Incorrecto porque cada lote puede caducar en una fecha distinta.

---

## Proveedor fijo

```text
Product.supplierId
```

como única fuente universal de proveedor.

Un Product puede obtenerse desde proveedores distintos.

---

## Stock editable

```text
Edit Product
↓
stock = arbitrary value
```

---

## Duplicar Product por lote

Crear un Product nuevo cada vez que llega otro lote.

---

## Borrar historia

Eliminar Product porque ya no se vende.

Preferir desactivarlo.

---

## Healthcare contamination

Agregar campos exclusivos de Cases directamente al Product Core sin analizar la frontera vertical.

---

# 109. Relación con Category

```text
Category
→ organiza Products
```

pero no determina:

* Inventory;
* precio;
* disponibilidad;
* Supplier.

---

# 110. Relación con Inventory

```text
Product
=
identity
```

```text
Inventory
=
physical state
```

Esta separación constituye una de las fronteras principales del ERP Core.

---

# 111. Relación con Business Components

`ProductSelector` pertenece a:

```text
ux/BUSINESS_COMPONENTS.md
```

Products proporciona los datos y reglas del recurso.

El selector proporciona una interacción reutilizable para encontrarlo.

---

# 112. Relación con Zaping Way

La experiencia debe reducir la necesidad de navegar manualmente.

Por ejemplo, desde `Product 360` el usuario podrá consultar Inventory o movimientos sin perder el contexto del Product.

---

# 113. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-012 — Entity Lifecycle.

---

# 114. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md
architecture/ARCHITECTURE.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
ux/BUSINESS_COMPONENTS.md
modules/erp/INVENTORY.md
modules/erp/PURCHASES.md
```

---

# 115. Fuente de verdad

La división de responsabilidades es:

```text
PRODUCTS.md
→ reglas funcionales de catálogo

INVENTORY.md
→ existencias y trazabilidad

schema.prisma
→ modelo técnico vigente

backend
→ implementación actual

tests
→ comportamiento validado

PROJECT_BOARD.md
→ estado de trabajo
```

---

# 116. Principio final

Products debe representar de forma estable **qué artículo comercial existe**.

Inventory representa **qué existencias físicas de ese artículo existen**.

Por tanto:

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
└── Catalog Lifecycle
```

mientras:

```text
Inventory
├── Stock
├── Batch
├── Expiration
├── Movement
├── Availability
└── Physical Traceability
```

> **El catálogo identifica el producto. El inventario explica sus existencias.**

---

# 117. Products V1 — estado vigente

**Estado:** IMPLEMENTED / VALIDATED.

Products V1 administra datos maestros de catálogo por Company:

```text
SKU
name
description
brand
Category
barcode
cost
price
minStock
inventoryTracking
lotTracking
active / inactive lifecycle
```

`Product.stock` continúa persistido como estado operacional, pero Product CRUD no es propietario de sus movimientos.

## 117.1 Política de stock

```text
POST /products
→ no acepta stock del cliente
→ Product nuevo usa el default backend / Prisma stock = 0

PATCH /products/:id
→ no acepta stock
```

El stock actual se muestra como solo lectura en `/products`. `minStock` permanece editable.

## 117.2 Estrategias de tracking

Valores implementados:

```text
inventoryTracking
├── QUANTITY
├── SERIALIZED
└── ASSET

lotTracking
├── NONE
├── OPTIONAL
└── REQUIRED
```

Ambas estrategias pueden elegirse al crear un Product. El `PATCH` normal no permite modificar `inventoryTracking` ni `lotTracking`; cualquier migración futura requiere un workflow explícito que todavía no existe.

## 117.3 Seguridad de Category

Cuando se proporciona `categoryId`, la Category debe pertenecer a la Company autenticada y estar activa. Se rechazan categorías inexistentes, inactivas o de otro tenant.

```text
categoryId = null
→ limpia la Category

categoryId omitido en PATCH
→ conserva la Category actual
```

## 117.4 Consulta y ciclo de vida

La convención vigente es:

```text
ProductsService.findOne(companyId, productId)
```

`GET /products/:id` está aislado por tenant. `GET /products/low-stock` se declara antes de la ruta dinámica y ya no queda sombreado por `GET /products/:id`.

La ruta pública `DELETE /products/:id` implementa desactivación, no eliminación física:

```text
ACTIVE Product
→ isActive = false

GET /products
→ sólo Products activos

GET /products/:id
→ Product inactivo recuperable para auditoría e historia
```

La desactivación repetida es segura e idempotente. No existe workflow de reactivación.

## 117.5 Frontend Products V1

`/products` incluye:

* Brand corregido;
* selector de Category;
* selectores de `inventoryTracking` y `lotTracking` en creación;
* tracking de solo lectura durante edición;
* stock actual de solo lectura;
* stock mínimo editable;
* lenguaje de desactivación no destructivo;
* lista de Products activos;
* tabla y formulario responsivos.

## 117.6 Validación y deuda

Evidencia registrada:

```text
Products backend
43 suites / 413 tests PASS

Products frontend
14 tests PASS

Frontend final vigente
25 files / 336 tests PASS

build / lint / git diff --check
PASS
```

Deuda abierta:

```text
Product reactivation workflow
tracking migration workflow
```
