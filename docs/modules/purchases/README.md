# Módulo Purchases

## Estado

Funcional

## Objetivo

Gestionar órdenes de compra dentro de Zaping ERP, permitiendo crear, editar, aprobar, cancelar, consultar, exportar y rastrear compras de proveedores.

## Alcance actual

El módulo permite:

- Crear compras en estado borrador.
- Editar compras en estado borrador.
- Ver detalle de compra.
- Aprobar compras.
- Cancelar compras en borrador.
- Generar PDF de orden de compra.
- Registrar entrada de inventario al aprobar una compra.
- Consultar movimientos de inventario generados por una compra.
- Mantener aislamiento por companyId.

## Estados de compra

| Estado | Descripción | Acciones permitidas |
|---|---|---|
| DRAFT | Compra en borrador | Ver, Editar, Aprobar, Cancelar, PDF |
| CONFIRMED | Compra aprobada | Ver, PDF, consultar movimientos |
| CANCELLED | Compra cancelada | Ver, PDF |

## Reglas de negocio

- Solo las compras DRAFT pueden editarse.
- Solo las compras DRAFT pueden aprobarse.
- Solo las compras DRAFT pueden cancelarse.
- Una compra CONFIRMED no puede editarse ni cancelarse.
- Una compra CANCELLED no puede aprobarse ni editarse.
- Aprobar una compra incrementa inventario.
- Cancelar una compra no modifica inventario.
- Editar una compra DRAFT no modifica inventario.
- Los costos unitarios se toman desde Product.cost.
- Los totales se calculan en backend.
- No se permiten productos duplicados en una compra.
- Cada compra pertenece a una empresa mediante companyId.

## Flujo principal

```text
Crear compra
  ↓
DRAFT
  ↓
Editar / Aprobar / Cancelar
  ↓
CONFIRMED → genera movimientos IN de inventario
  ↓
PDF / detalle / trazabilidad