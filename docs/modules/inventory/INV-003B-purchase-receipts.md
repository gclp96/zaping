# INV-003B - Arquitectura de recepción de mercancía con lotes

## Estado

En progreso

## Objetivo

Definir la arquitectura para recibir mercancía de una compra aprobada, capturando número de lote, fecha de caducidad y cantidades realmente recibidas.

## Decisión principal

El número de lote y la fecha de caducidad no se capturan al crear la compra.

Estos datos deben capturarse durante la recepción de mercancía, porque son datos proporcionados por el proveedor al entregar físicamente el producto.

La compra representa lo solicitado.

La recepción representa lo recibido.

El lote representa la existencia física generada por esa recepción.

## Flujo actual

Actualmente el sistema hace:

```text
Crear compra
  ↓
Aprobar compra
  ↓
Incrementar inventario
  ↓
Crear InventoryMovement IN
