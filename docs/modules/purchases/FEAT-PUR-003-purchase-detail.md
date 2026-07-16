# FEAT-PUR-003 - Vista de detalle de compra

## Estado

Completado

## Objetivo

Implementar una vista de detalle para consultar la información completa de una compra desde el módulo de compras.

## Alcance

Incluye:

- Abrir detalle de compra desde la tabla principal.
- Mostrar folio, fecha y estado.
- Mostrar información del proveedor.
- Mostrar productos de la compra.
- Mostrar cantidad, costo unitario y subtotal por producto.
- Mostrar subtotal, IVA y total.
- Mostrar acciones disponibles según estado.
- Reutilizar StatusBadge.
- Reutilizar formato monetario existente.
- Mantener la información solo de lectura.

No incluye:

- Edición de compra.
- Eliminación de compra.
- Recepción parcial.
- Historial de cambios.
- Comentarios internos.
- Adjuntos.

## Reglas de negocio

- Una compra en borrador puede aprobarse, cancelarse o exportarse a PDF.
- Una compra confirmada solo puede exportarse a PDF.
- Una compra cancelada solo puede exportarse a PDF.
- El detalle no debe modificar información.
- El detalle debe usar la información ya cargada en frontend.
- El backend sigue siendo la fuente de verdad para totales.

## Criterios de aceptación

- Cada fila de compra muestra una acción Ver.
- Al hacer clic en Ver, se abre un modal de detalle.
- El modal muestra folio, fecha, estado y proveedor.
- El modal muestra tabla de productos.
- El modal muestra subtotal, IVA y total.
- El modal muestra acciones válidas según estado.
- El modal puede cerrarse sin alterar datos.
- Frontend build pasa correctamente.
- Frontend lint pasa correctamente.

----------
## Resultado de implementación

FEAT-PUR-003 fue implementada y validada correctamente.

Resultados:

- Se agregó acción Ver en la tabla de compras.
- Se implementó modal de detalle de compra.
- Se muestra folio, fecha, estado y proveedor.
- Se muestra tabla de productos.
- Se muestra cantidad, costo unitario y subtotal.
- Se muestran subtotal, IVA y total.
- Se muestran acciones disponibles según estado.
- Las compras en borrador pueden aprobarse, cancelarse o exportarse a PDF.
- Las compras confirmadas solo pueden exportarse a PDF.
- Las compras canceladas solo pueden exportarse a PDF.
- El detalle es solo de lectura.
- Frontend compiló correctamente.
- La funcionalidad fue validada manualmente desde la interfaz.

## Estado final

FEAT-PUR-003 se considera completada.