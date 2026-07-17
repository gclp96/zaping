# INV-003A - Agregar marca al módulo Products

## Estado

Completado

## Objetivo

Integrar el campo `brand` en el módulo Products para registrar la marca comercial del producto, especialmente útil en operación de suministros médicos.

## Justificación

En suministros médicos, la marca es un dato operativo importante para identificar correctamente un producto junto con SKU, descripción, lote, caducidad y proveedor.

Ejemplo:

- Catéter 15 mm marca Terumo.
- Catéter 15 mm marca Cordis.

Aunque sean productos similares, pueden tener distinto SKU, costo, proveedor, registro sanitario o presentación.

## Alcance

Incluye:

- Agregar `brand` en DTOs de Products.
- Permitir crear productos con marca.
- Permitir editar la marca.
- Mostrar marca en tabla/listado de productos.
- Mantener `brand` como campo opcional.
- Mantener compatibilidad con productos existentes.

No incluye:

- Catálogo separado de marcas.
- Validación avanzada de marcas.
- Relación con registro sanitario.
- Filtros por marca.
- Reportes por marca.

## Reglas

- `brand` es opcional.
- `brand` pertenece a Product.
- Si no se captura marca, el producto sigue siendo válido.
- La marca debe poder editarse.
- La marca debe mostrarse en la interfaz cuando exista.

## Criterios de aceptación

- El backend acepta `brand` al crear producto.
- El backend acepta `brand` al editar producto.
- El frontend permite capturar marca.
- El frontend permite editar marca.
- La tabla de productos muestra la marca.
- Frontend build pasa correctamente.
- Backend build pasa correctamente.

## Resultado de implementación

INV-003A fue implementado correctamente.

Resultados:

- Se agregó `brand` al DTO de creación de producto.
- Se habilitó `brand` automáticamente en edición mediante `PartialType`.
- ProductsService guarda `brand` al crear producto.
- ProductsService actualiza `brand` al editar producto.
- El frontend permite capturar marca.
- El frontend permite editar marca.
- La tabla de productos muestra la marca.
- El campo marca es opcional.
- Backend compiló correctamente.
- Frontend compiló correctamente.

## Estado final

INV-003A se considera completado.