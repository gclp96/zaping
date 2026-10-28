# PUR-UX-02A — Nueva compra: workspace de captura

## Objetivo
Unificar **Nueva compra** con la arquitectura visual aprobada en **Registrar recepción**, sin cambiar las reglas de negocio, montos, endpoints, inventario ni el modo **Editar compra**.

## Decisiones de alcance
- Activación **solo** si `NEXT_PUBLIC_ZAPING_PURCHASES_WORKSPACE=true` y `editing=false`. En `main`, la bandera sigue desactivada por defecto.
- Usar variante compartida `Modal.layout="workspace"` con scroll interno y pie de acciones propio mediante `Modal.footer`, siguiendo Recepciones.
- Crear cuatro zonas de lectura: **Proveedor de la compra**, **Agregar productos**, **Partidas de la compra** y **Revisión de la orden + Resumen financiero**.
- Tabla de partidas en escritorio y tarjetas de edición de cantidades en móvil, sin duplicar estado ni crear lógica de negocio.
- Revisar proveedor, número de partidas y subtotal/IVA/total sin reimplementar sus fórmulas.
- Conserva las etiquetas y layout legados en `Editar compra` y cuando la bandera está apagada.
- Reutiliza `SupplierSelector`, `ProductSelector`, callbacks, validaciones y estados `saving`, `itemsError`. No se añaden campos de almacén, moneda, condiciones ni impuestos por línea que el modelo actual no soporta.

## Criterios de aceptación automatizados
- Flag ON + crear → modal `workspace`, pie bajo `data-modal-footer` y solo una instancia de botones.
- Flag ON + editar → modal `default`, datos originales, `Guardar cambios` y mismos callbacks.
- Flag OFF + crear → comportamiento legado.
- CTA inhabilitado sin proveedor/partidas o durante `saving`.
- Error de partidas sigue visible en footer.
- Agregar producto, Cancelar y Crear compra siguen llamando los handlers originales; las cantidades de la tabla y tarjetas se editan igual.
- La CI Web/API/PostgreSQL es obligatoria antes de revisión funcional.

## Evidencia y gates
Las capturas anteriores de RR-007 y PUR-UX-01D sirven como **referencia de diseño**, pero NO validan esta pantalla nueva. Se documenta el QA visual real como **pendiente**; el usuario decidió cerrar las pruebas visuales previas y pasar al diseño.

Antes de cualquier merge o encendido de flag: comprobar diseño responsive, scroll/foco, edición de partida, selección de proveedor, agregados, importes, cancelación y pérdida de cambios; completar o registrar separadamente el resto del QA de PUR-UX-01D.

Cadena de PR: #179 → #180 → #181 → PR de este ticket. Ninguno se fusiona automáticamente.
