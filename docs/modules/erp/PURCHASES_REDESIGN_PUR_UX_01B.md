# PUR-UX-01B — Workspace visual del listado de Compras

**Referencia UX:** captura proporcionada por el usuario en conversación, con lista de órdenes a la izquierda y detalle contextual a la derecha. Contrato de producto: [issue #178](https://github.com/gclp96/zaping/issues/178).

## Alcance de esta entrega
- Composición visual nueva de `/purchases`: encabezado con descripción operativa, espacio de filtros por búsqueda/estado/proveedor/fechas, sección **Historial de compras** y tabla existente.
- `NEXT_PUBLIC_ZAPING_PURCHASES_WORKSPACE=true` habilita la nueva presentación; sin valor o con `false`, conserva el listado anterior. **OFF por defecto**.
- La tabla reutiliza los mismos datos, filtros, enlaces `/purchases/:id`, paginación, ordenamiento, progreso, botones y lógica de permisos.
- No introduce campos inexistentes en `Purchase` (almacén destino, sede solicitante, condiciones de pago).
- Sin cambios API, RBAC, Prisma, inventario, estados o transacciones.
- `Nueva compra` y `Recibir` conservan sus modales y acciones.

## Pendiente — PUR-UX-01C
- Sheet contextual **derecho** al seleccionar compra, con vista previa de información general, partidas, progreso real de recepción, importes y acciones por rol.
- Mantener también la ruta de detalle completo `/purchases/:id` para deep links, historial y trazabilidad.
- Reutilizar y extraer presentación read-only del detalle actual, sin duplicar lógica ni abrir el sheet cuando no esté autorizado.
- Responsive 390/820/1024/1440, zoom 200%, foco, Escape y acciones con estados reales.

## Release gates
1. CI Web/API/PostgreSQL y regresión de página Compras verdes para el HEAD final.
2. Pruebas visuales con flag ON y OFF, desktop/tablet/mobile; keyboard y a11y.
3. Comparar filtros, búsqueda, estado, ordenamiento, paginación, permisos y entradas a Recepciones con el comportamiento V1.
4. **No fusionar sin CI y revisión; no activar banderas globalmente antes del gate de rollout.**

Nota: el prototipo de adjuntos y la integración real R2 son iniciativas distintas y quedan desactivadas.
