# RR-003 — Presentación de captura dentro del workspace

**Estado:** implementación en Draft. No hay cambios de dominio, API ni persistencia.
**Base:** PR #169 / `feat/receipts-redesign-01-rr002-workspace-shell`.
**Flag:** `NEXT_PUBLIC_ZAPING_RECEIPTS_WORKSPACE=true` (apagada por defecto).

## Implementado

- Agrupación visual de la misma captura en tres secciones del workspace:
  **Compra origen**, **Partidas pendientes**, **Documento del proveedor y notas**.
- La sección Compra origen usa el folio y nombre del proveedor que ya estaban
  presentes en el modelo de `PurchaseReceiptModal`; no inventa responsable,
  almacén ni estado.
- Partidas pendientes mantiene siete columnas: Producto, Pedido, Recibido,
  Pendiente, Recibir ahora, Lote y Caducidad; las tres cantidades históricas
  permanecen de solo lectura, sin reescribir el cálculo de pendientes.
- Se amplía el ancho mínimo de la tabla workspace a **940px** con
  `overflow-x:auto` exclusivamente horizontal, y cambia a tarjetas
  en viewport menor a 1024px. El layout clásico conserva sus umbrales
  (`xl`) y mínimo anterior de **760px**.
- La sección de documento conserva selector FACTURA/REMISION/NOTA_ENTREGA,
  número, longitud máxima, notas y callbacks anteriores. Se añade solo un
  encabezado y descripción visuales en modo workspace.
- Todas las reglas de PHYSICAL/LEGACY para cantidades, lote, caducidad
  y generación de equipos quedan en los componentes existentes, sin
  modificación de `usePurchaseReceipts`, POST, Idempotency-Key,
  roles, backend ni esquemas.
- El modo nuevo utiliza el mismo componente tanto desde Compras → Recibir
  como desde Recepciones → Registrar recepción, por herencia de RR-002.

## Pruebas automatizadas

- Verificar las tres secciones y encabezados del workspace.
- Verificar que la tabla muestre todas las columnas, siga accesible con
  scroll horizontal y tenga tarjetas en el breakpoint reducido.
- Verificar callbacks de recibir cantidad, cambiar documento y editar notas.
- Asegurar que no aparecen acciones no implementadas como rechazos o
  borradores.
- Con la flag desactivada, el formulario antiguo conserva su presentación
  y comportamiento; ejecutar las pruebas históricas de lote/caducidad
  y `PurchaseReceiptModal` existentes.

## Límites declarados

Este cambio **no** implementa el resumen derivado (RR-004), el bloque compacto
de adjuntos (RR-005), ni la confirmación de descarte/QA visual total
(RR-006). Tampoco incorpora el PR #167, que permanece Draft.

En el futuro, cuando se integre `ReceiptFilesPreview`, una selección local
de archivos **debe bloquear Registrar recepción** hasta limpiarse; nunca
hacer creer que se asociaron a la recepción.

La flag de workspace permanece OFF hasta completar la versión final, QA
responsive manual, revisión de permisos y gates de seguridad correspondientes.

**QA visual pendiente:** probar los anchos 1440, 1366, 1024, 820 y 390 CSS px,
zoom 200%, filas numerosas, lote REQUIRED/OPTIONAL/NONE, errores largos,
scroll del panel y footer sin superposición. No declarar PASS visual por tests
jsdom.
