# INV-003B - Arquitectura de recepción de mercancía con lotes

## Estado

Completado

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

## Resultado de implementación de modelo Prisma

Se implementó la base del modelo de recepción de mercancía.

Resultados:

- Se agregó `PurchaseStatus`.
- `Purchase.status` ahora usa `PurchaseStatus`.
- Se agregaron estados futuros:
  - DRAFT
  - CONFIRMED
  - PARTIALLY_RECEIVED
  - RECEIVED
  - CANCELLED
- Se creó `PurchaseReceipt`.
- Se creó `PurchaseReceiptItem`.
- Se relacionó `Purchase` con `PurchaseReceipt`.
- Se relacionó `PurchaseItem` con `PurchaseReceiptItem`.
- Se relacionó `InventoryBatch` con `PurchaseReceipt`.
- Se relacionó `PurchaseReceiptItem` con `InventoryBatch`.
- Se mantuvo compatibilidad con `InventoryBatch`.
- La migración Prisma fue aplicada correctamente sin reset.

## Estado final

INV-003C se considera completado a nivel de modelo de datos.
