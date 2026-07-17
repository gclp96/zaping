# FEAT-PUR-005 - Trazabilidad de movimientos de inventario por compra

## Estado

Completado

## Objetivo

Mostrar los movimientos de inventario generados por una compra aprobada, permitiendo rastrear la relación entre una orden de compra y las entradas de inventario correspondientes.

## Alcance

Incluye:

- Consultar movimientos de inventario asociados a una compra.
- Mostrar movimientos dentro del detalle de compra.
- Mostrar producto, tipo, cantidad, balance, costo unitario y fecha.
- Mantener aislamiento por companyId.
- Usar referenceType PURCHASE y referenceId purchaseId.
- Mostrar estado vacío cuando la compra no tenga movimientos.

No incluye:

- Edición de movimientos.
- Eliminación de movimientos.
- Ajustes manuales desde compras.
- Historial avanzado de auditoría.
- Kardex completo por producto.
- Reportes de inventario.

## Endpoint

```http
GET /purchases/:id/inventory-movements

## Resultado de implementación

FEAT-PUR-005 fue implementada y validada correctamente.

Resultados:

- Se agregó endpoint GET /purchases/:id/inventory-movements.
- Se agregó consulta de movimientos por referenceType y referenceId.
- Se validó que la compra pertenezca a la empresa autenticada.
- Se integró la consulta en el modal de detalle de compra.
- Se muestran movimientos de inventario asociados a compras confirmadas.
- Se muestra estado vacío cuando la compra no tiene movimientos.
- Se muestran producto, tipo, cantidad, balance, costo unitario y fecha.
- Backend compiló correctamente.
- ESLint de Purchases e Inventory pasó correctamente.
- Frontend tests pasaron correctamente.
- Frontend lint pasó correctamente.
- Frontend build pasó correctamente.

## Estado final

FEAT-PUR-005 se considera completada.