# INV-002 - Modelo de lotes y caducidades

## Estado

En progreso

## Objetivo

Diseñar la arquitectura de inventario por lote para soportar número de lote, fecha de caducidad, cantidad disponible, costo unitario y trazabilidad completa entre compras, movimientos de inventario y futuras ventas.

## Justificación

Zaping está orientado a empresas de suministros médicos. En este contexto, el inventario no puede depender únicamente del stock general del producto.

El sistema debe permitir responder:

- Qué producto existe.
- Cuánto stock total existe.
- Qué lotes componen ese stock.
- Cuándo caduca cada lote.
- De qué compra provino cada lote.
- Qué movimientos afectaron cada lote.
- Qué lote debe salir primero bajo regla FEFO.

## Decisión principal

El lote no será un campo directo de Product.

Product seguirá representando el catálogo maestro del producto.

El stock por lote se manejará mediante un nuevo modelo: InventoryBatch

Product
  ↓
InventoryBatch
  ↓
InventoryMovement

## Datos operativos clave para suministros médicos

El inventario debe permitir ubicar productos usando los datos más comunes en operación médica:

- SKU o código interno del producto.
- Nombre o descripción corta.
- Descripción técnica.
- Marca.
- Proveedor.
- Número de lote.
- Fecha de caducidad.

Distribución de responsabilidad:

| Dato | Modelo | Motivo |
|---|---|---|
| SKU | Product | Identifica el producto maestro dentro de la empresa |
| Nombre / descripción corta | Product | Uso operativo en tablas, búsquedas y documentos |
| Descripción técnica | Product | Información extendida del producto |
| Marca | Product | La marca define el producto comercial |
| Proveedor | Supplier / Purchase / InventoryBatch | El proveedor puede variar por compra o lote |
| Lote | InventoryBatch | Cada existencia puede tener lote diferente |
| Caducidad | InventoryBatch | Cada lote puede caducar en fecha diferente |

## Consideración sobre marca

La marca debe pertenecer al producto maestro.

Ejemplo:

```text
Catéter 15 mm marca Terumo
Catéter 15 mm marca Cordis

## Datos operativos clave para suministros médicos

El inventario debe permitir ubicar productos usando los datos más comunes en operación médica:

- SKU o código interno del producto.
- Nombre o descripción corta.
- Descripción técnica.
- Marca.
- Proveedor.
- Número de lote.
- Fecha de caducidad.

Campos recomendados adicionales:

- brand
SKU
Nombre / descripción
Marca
Proveedor
Lote
Fecha de caducidad

## Product 

Representa el producto maestro.

Campos clave:

- sku
- name
- description
- brand
- barcode
- cost
- price
- stock
- minStock

Ejemplo:

```text
SKU: CAT-15MM-001
Nombre: Catéter 15 mm
Descripción: Catéter diagnóstico 15 mm estéril
Marca: Terumo
Stock total: 120

## InventoryBatch

Representa una existencia específica de un producto.

Campos propuestos:

- id
- companyId
- productId
- supplierId
- purchaseId
- lotNumber
- expirationDate
- initialQuantity
- availableQuantity
- unitCost
- receivedAt
- notes
- isActive
- createdAt
- updatedAt

Product = qué producto es
InventoryBatch = qué lote físico existe
Supplier = de quién viene
Purchase = documento que originó la entrada

-----------------------------------------
Distribución de responsabilidad:

| Dato | Modelo | Motivo |
|---|---|---|
| SKU | Product | Identifica el producto maestro |
| Nombre / descripción corta | Product | Uso operativo en tablas, búsquedas y documentos |
| Descripción técnica | Product | Información extendida del producto |
| Marca | Product | La marca define el producto comercial |
| Proveedor | Supplier / Purchase / InventoryBatch | El proveedor puede variar por compra o lote |
| Lote | InventoryBatch | Cada existencia puede tener lote diferente |
| Caducidad | InventoryBatch | Cada lote puede caducar en fecha diferente |