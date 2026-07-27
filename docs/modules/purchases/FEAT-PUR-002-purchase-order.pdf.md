# FEAT-PUR-002 - PDF de orden de compra

## Estado

Completado

## Objetivo

Mejorar el PDF de orden de compra para que represente un documento operativo real, usando información de la empresa, proveedor, compra, partidas y productos.

## Alcance

Incluye:

- Generar PDF desde una compra existente.
- Mostrar datos reales de la empresa.
- Mostrar datos reales del proveedor.
- Mostrar folio, fecha y estado de la compra.
- Mostrar partidas de productos.
- Mostrar SKU, nombre, cantidad, costo unitario y subtotal.
- Mostrar subtotal, IVA y total.
- Descargar el archivo con nombre basado en el folio.
- Mantener aislamiento por companyId.

No incluye:

- Envío por correo.
- Firma digital.
- CFDI.
- Plantillas personalizadas por empresa.
- Logo de empresa.
- Conversión a XML.

## Endpoint

```http
GET /purchases/:id/pdf

## Resultado de implementación

FEAT-PUR-002 fue implementada y validada correctamente.

Resultados:

- El PDF muestra datos reales de la empresa.
- El PDF muestra datos reales del proveedor.
- El PDF muestra folio, fecha y estado de la compra.
- El PDF muestra tabla de productos.
- El PDF muestra SKU, producto, cantidad, costo y subtotal.
- El PDF muestra subtotal, IVA y total.
- Se eliminó texto hardcoded de empresa específica.
- El archivo se descarga usando el folio de la compra.
- El endpoint mantiene aislamiento por companyId.
- El PDF fue validado visualmente desde la interfaz.

## Estado final

FEAT-PUR-002 se considera completada.