# PUR-UX-01D — cierre de acciones contextuales y QA del rediseño Compras

**Alcance:** continuación apilada de PUR-UX-01B (#179) y PUR-UX-01C (#180). Esta etapa no modifica API, Prisma, inventario, recepción, taxonomía de estados ni permisos.

## Cambios comprobables en código
- Con `NEXT_PUBLIC_ZAPING_PURCHASES_WORKSPACE=true`, **clic y Enter sobre folio** abren el panel lateral de `Compra {folio}` sin abandonar `/purchases`.
- El folio conserva la apariencia de enlace, pero es un `button` accesible (`aria-haspopup="dialog"`, `aria-expanded`), no una navegación que produce salto de página.
- El enlace **Ver detalle completo** sigue disponible en el panel con `/purchases/:id`. Flag OFF: el folio sigue siendo un `Link` clásico.
- Descargas PDF fallidas se notifican dentro del diálogo, en vez de quedar escondidas por el backdrop, con opción de cerrar el mensaje.
- No se ha cambiado el preflight de recepción, la verificación de recibidos ni el comportamiento fail-closed del panel.
- Los botones de aprobar/editar/cancelar/recibir se delegan a handlers existentes y siguen sujetos a sus condiciones por rol y estado.

## QA automatizado en Vitest + CI
- Flag OFF: enlace del folio y listado clásico.
- Flag ON: folio abre el diálogo, no dispara mutaciones ni router.push.
- Enter y clic activan el panel; Escape/X cierran y devuelven el foco al folio.
- Filtros y lista permanecen tras el cierre; reapertura renueva datos, sin POST/PATCH involuntarios.
- La descarga PDF errónea se muestra dentro del diálogo y se puede descartar.
- DRAFT: combinaciones de permiso canEdit/canApprove no ofrecen acciones no autorizadas.
- Detalle 403 y fallo del historial: sin datos sensibles, sin recibidos inventados, recepción bloqueada.
- API/Web/Historical upgrade CI deben estar PASS para el commit final.

## QA visual que requiere navegador real (PENDIENTE)
No hay una sesión de navegador conectada al localhost del usuario. Las pruebas de jsdom y CI **NO** constituyen captura visual ni medición real de layouts; no declarar PASS sin capturas o navegación real.

| Vista | Resolución | Comprobar |
| --- | --- | --- |
| Escritorio | 1440×900 | Header, filtros y tabla a la izquierda; panel a la derecha, footer y scroll del cuerpo |
| Laptop | 1366×768 | Tabla usable detrás del panel, botones y subtotales accesibles |
| Tablet | 1024×900 | Panel lateral, texto largo, tabla de partidas desplazable |
| Tablet angosta | 820×900 | Panel a ancho completo, sin scroll horizontal global |
| Móvil | 390×844 | Panel full width, encabezado/footer visibles, scroll interno y lector de tabla |
| Móvil pequeño | 360×800 | Acciones responsivas y sin recorte permanente |
| Zoom | 200% | Foco Tab/Shift+Tab y controles accesibles sin pérdida de contenido |

### Revisión operativa/UAT
1. En entorno **QA local aislado** y con bandera activada, comprobar que el folio abre el panel; cerrar con X, Escape y botón de navegación. El foco regresa al disparador.
2. Con rol ADMIN/MANAGER: comprobar DRAFT/CONFIRMED/PARTIALLY_RECEIVED/RECEIVED/CANCELLED; solo estados elegibles ofrecen Registrar recepción.
3. Con WAREHOUSE: confirmar ausencia de Aprobar/Cancelar si ese rol no los autoriza. Con SALES: comprobar que no aparece acceso a Compras si así define RBAC actual.
4. Error/timeout de GET compra: no se muestran datos. Error/timeout GET historial: recibido/pendiente deben decir «—», recepción bloqueada, botón de reintentar visible.
5. Sin modificar datos: probar abrir/cerrar, filtrar, ordenar, paginar, descargar PDF válido, PDF fallido y navegación a detalle completo.
6. **No** ejecutar una recepción ni aprobar/cancelar una orden real durante el QA visual; para operaciones E2E usar fixtures aislados con revisión humana.

## Gate de integración
- PR #179 primero, PR #180 después, y este PR al final. Revisar la base de cada PR si se reencadenan tras merges.
- Bandera de workspace permanece OFF en `main` hasta UAT visual y decisión humana de activación.
- No afirmar que un PR Draft, una CI verde o un test de DOM prueban por sí solos calidad visual, operación INSAP o seguridad de un despliegue.
