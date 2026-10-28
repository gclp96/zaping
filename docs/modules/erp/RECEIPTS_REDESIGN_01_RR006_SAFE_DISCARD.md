# RR-006 — Confirmación de descarte y QA responsive

**Estado:** Draft; CI y QA navegador pendientes.
**Base:** PR #172 (RR-005).
**Flag:** `NEXT_PUBLIC_ZAPING_RECEIPTS_WORKSPACE=true` (OFF por defecto).

## Implementación acotada
- Si hay edición local (cantidad, lote, caducidad, documento, notas o vista previa de adjuntos), cualquier intento de cerrar el workspace por Cancelar, X o Escape abre confirmación de descarte.
- Continuar captura cancela el descarte sin modificar los datos.
- Descartar cambios invoca el cierre original; el hook existente limpia el estado.
- Sin cambios, conserva cierre directo. Durante guardado se bloquea cerrar.
- Vista clásica OFF sin regresión. No cambia API, DB, inventario, permisos ni idempotencia.

## QA manual pendiente (NO PASS)
- Navegador real a 1440, 1366, 1024, 820 y 390 CSS px; zoom 200%.
- Longitud de filas, errores extensos, tablas con scroll horizontal, footer fijo y área de archivos.
- Teclado y accesibilidad: Tab/Shift+Tab, Escape, X, Cancelar, diálogo secundario, retorno de foco.
- Comprobar ambos flujos de entrada y que limpiar archivos reactiva envío.
- Confirmar que los archivos continúan siendo exclusivamente metadatos locales, sin persistencia.

## Puertas de salida
Web/API/PostgreSQL CI completos y revisión manual visual antes de marcar Done. Mantener PR Draft, flag OFF, sin merge ni despliegue.
