# RR-005 — Adjuntos compactos en recepción

**Estado:** Draft; requiere CI y QA real en navegador.
**Base:** RR-004 / PR #171.
**Banderas:** `NEXT_PUBLIC_ZAPING_RECEIPTS_WORKSPACE` (workspace) y `NEXT_PUBLIC_ZAPING_FILES_RECEIPTS_UI` (vista previa); ambas OFF por defecto.

## Alcance
- Reutilizar `ReceiptFilesPreview` (vista previa solamente de metadatos, sin subida, lectura de bytes, R2, ni ClamAV).
- Colocar el adjunto opcional en la columna izquierda inferior, junto al resumen RR-004 a la derecha. En pantallas estrechas las tarjetas se apilan.
- Conservar los dos puntos de entrada: Compras → Recibir y Recepciones → Registrar recepción.
- Bloquear el botón Registrar recepción cuando existe uno o más archivos seleccionados. No se envía ni persiste ningún archivo. El botón vuelve a habilitarse al limpiar la selección.
- Respetar el modo clásico y los controles de validación/autoridad existentes.

## Seguridad
La validación local de extensión, MIME declarado y tamaño es informativa y **no** implica análisis de contenido, verificación de malware ni almacenamiento. No liberar como upload hasta que gates Zaping Files/R2/ClamAV y permisos pasen.

## Verificación
- Pruebas unitarias y de integración React para ubicación, bloqueo y modo clásico.
- CI web/API/PostgreSQL antes de aprobación.
- QA navegador pendiente en anchos 1440/1366/1024/820/390 px y zoom 200%.
- Verificar navegación entre órdenes, cancelar, crear recepción, restaurar foco y scroll sin persistir selección local.

## Fuera de alcance
Cambios API/DB, inventario, RBAC, descarga/consulta real de archivos, persistencia, y el descarte seguro completo RR-006.
