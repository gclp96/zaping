# FEAT-PUR-004 - Editar compra en borrador

## Estado

Completado

## Objetivo

Permitir editar una compra mientras se encuentre en estado borrador.

## Alcance

Incluye:

- Editar proveedor de una compra en borrador.
- Editar productos de una compra en borrador.
- Editar cantidades.
- Recalcular subtotal, IVA y total desde backend.
- Reemplazar partidas anteriores por las nuevas.
- Mantener el folio original.
- Mantener aislamiento por companyId.

No incluye:

- Editar compras confirmadas.
- Editar compras canceladas.
- Editar compras después de mover inventario.
- Historial de cambios.
- Recepción parcial.
- Edición directa de costos desde frontend.

## Endpoint

```http
PATCH /purchases/:id

## Resultado de implementación

FEAT-PUR-004 fue implementada y validada correctamente.

Resultados:

- Se agregó edición de compras en estado DRAFT.
- Se reutilizó el modal de creación de compra.
- Se puede cambiar proveedor.
- Se pueden agregar productos.
- Se pueden quitar productos.
- Se pueden modificar cantidades.
- Se conserva el folio original.
- Los totales se recalculan en backend.
- La edición no modifica inventario.
- Las compras CONFIRMED no muestran acción Editar.
- Las compras CANCELLED no muestran acción Editar.
- Backend compiló correctamente.
- Frontend compiló correctamente.
- La funcionalidad fue validada manualmente desde la interfaz.

## Estado final

FEAT-PUR-004 se considera completada.