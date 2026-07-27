# Sprint 10 - Inventory Advanced

## Estado

Planeado

## Objetivo del sprint

Fortalecer el módulo de Inventario para soportar trazabilidad avanzada, movimientos por producto, lotes, caducidades y preparación para operación real en suministros médicos.

## Justificación

Zaping está enfocado en empresas de suministros médicos. Por lo tanto, el inventario no puede limitarse únicamente a stock general por producto.

El sistema debe permitir conocer:

- Qué producto existe.
- Cuánto stock existe.
- De qué lote proviene.
- Cuándo caduca.
- De qué compra entró.
- A qué venta salió.
- Qué movimientos modificaron el stock.

## Alcance principal

Incluye:

- Kardex por producto.
- Filtros de movimientos de inventario.
- Modelo de inventario por lote.
- Número de lote.
- Fecha de caducidad.
- Cantidad disponible por lote.
- Costo unitario por lote.
- Relación lote-compra.
- Relación movimiento-lote.
- Preparación para FEFO.
- Alertas futuras de caducidad.

## No incluye todavía

- Recepción parcial de compras.
- Venta seleccionando lote manualmente.
- Bloqueo automático de producto vencido.
- Escáner QR/código de barras.
- Números de serie individuales.
- Auditoría avanzada.
- Reportes financieros de inventario.

## Features propuestas

| ID | Tipo | Nombre | Estado | Prioridad |
|---|---|---|---|---|
| INV-001 | Feature | Kardex por producto | Planned | High |
| INV-002 | Architecture | Modelo de lotes y caducidades | Planned | Critical |
| INV-003 | Feature | Stock por lote | Planned | High |
| INV-004 | Feature | Movimientos ligados a lote | Planned | High |
| INV-005 | Feature | Alertas de caducidad | Planned | Medium |
| INV-006 | Feature | Preparar compras para recepción con lote | Planned | High |

## Decisiones iniciales

- El lote no debe ser un campo directo de Product.
- La fecha de caducidad no debe ser un campo directo de Product.
- Product representa el catálogo maestro.
- InventoryBatch representa existencias específicas por lote.
- InventoryMovement debe poder relacionarse con un lote.
- El stock total de Product podrá mantenerse como resumen, pero la fuente operativa avanzada será el stock por lote.

## Arquitectura objetivo

Compra / Purchase
  → qué se pidió

Recepción / PurchaseReceipt
  → qué llegó realmente

Lote / InventoryBatch
  → lote, caducidad y cantidad disponible

Movimiento / InventoryMovement
  → entrada real al inventario

## Decisión sobre captura de lote y caducidad

El número de lote y la fecha de caducidad no se capturan al crear la compra.

Estos datos deben capturarse durante la recepción de mercancía, porque son datos proporcionados por el proveedor al entregar físicamente el producto.

La compra representa lo solicitado.

La recepción representa lo recibido.

El lote representa la existencia física generada por esa recepción.

## Flujo objetivo de compras con lotes

Crear compra
  ↓
Aprobar compra
  ↓
Compra confirmada
  ↓
Recibir mercancía
  ↓
Capturar lote, caducidad y cantidad recibida
  ↓
Crear InventoryBatch
  ↓
Crear InventoryMovement IN
  ↓
Actualizar Product.stock


## Nuevo bloque recomendado

Antes de implementar `INV-003B`, debemos abrir una pieza de arquitectura:

PUR-006 / INV-003B
Recepción de mercancía con lotes