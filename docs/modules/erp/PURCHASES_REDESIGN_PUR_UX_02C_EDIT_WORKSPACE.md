# PUR-UX-02C — Workspace unificado para Editar compra

## Objetivo
Unificar la presentación de **Nueva compra** y **Editar compra (solo DRAFT)** con la variante `Modal.layout="workspace"` ya aprobada en PUR-UX-02A, sin modificar el contrato de la API, las validaciones, las reglas de edición ni los cálculos.

## Alcance
- Con `NEXT_PUBLIC_ZAPING_PURCHASES_WORKSPACE=true`, **crear y editar** usan el mismo workspace: Proveedor, Agregar productos, Partidas, Revisión y Resumen financiero, pie fijo con scroll independiente.
- El modo de edición mantiene título `Editar compra` y acción `Guardar cambios`; el guardado sigue siendo `PATCH /purchases/:id`.
- `openEditModal` en `usePurchaseForm` sigue rechazando estados distintos de `DRAFT`; se conservan pre-carga de proveedor, artículos, precio unitario histórico y cantidades originales.
- Se adapta el texto de revisión para referirse a **guardar cambios** al editar y a **crear compra** en alta.
- Ambos modos conservan los editores existentes desktop y móvil, validaciones, IVA y subtotal/total. No se reimplementan fórmulas ni se crean nuevas rutas.
- El modo legacy se conserva cuando la bandera está apagada.

## Detección de cambios reales (edición)
- El hook propietario de estado `usePurchaseForm` calcula `hasUnsavedChanges`.
- Para crear, es verdadero si existe proveedor, producto provisional, cantidad inicial modificada o partidas agregadas.
- Para editar, compara proveedor actual con `purchaseToEdit.supplier.id`, cantidad provisional o selección de producto con su estado limpio, y cada línea con el baseline original de `purchaseToEdit.items`: orden, producto, cantidad y costo original.
- **No** marca como cambios sin guardar la precarga del borrador original. Revertir valores al original restaura el estado limpio.
- Cancelar, X y Escape piden confirmación solo cuando el workspace está activo y hay cambios reales. El guardado bloquea cierres; **Continuar captura** conserva los valores y **Descartar cambios** utiliza el cierre/restablecimiento existente.
- No se ofrece autoguardado ni protección contra recarga/navegación fuera de la pantalla.

## Validación y gates
- Pruebas de hook: creación limpia, precarga DRAFT limpia, modificación y reversión de proveedor, producto, cantidad y artículos; exclusión no-DRAFT.
- Pruebas de componente: workspace en edición, títulos y CTA, footer externo al scroll, callbacks de partidas, protección contra descarte de cambios y `saving`, compatibilidad flag OFF.
- [ ] CI final Web, API, PostgreSQL en este PR.
- [ ] QA en navegador a posteriori: edición real de borrador, 390 / 820 / 1024 / 1366px, retención de datos y foco con confirmación, cantidades y total, patch correcto, roles y no-DRAFT. **Pendiente por decisión de suspender las pruebas visuales ahora**.

## Integración
PR Draft **stacked** sobre #183 → #182 → #181 → #180 → #179. No activar el flag por defecto en main ni fusionar automáticamente; validar la cadena de dependencias y las pruebas de cierre.
