# RR-004 — Resumen informativo de la recepción

**Estado:** Implementado en PR Draft, pendiente de validación CI y QA visual.
**Base:** `feat/receipts-redesign-01-rr003-capture-layout` (PR #170).
**Flag:** `NEXT_PUBLIC_ZAPING_RECEIPTS_WORKSPACE=true` (apagada por defecto).

## Objetivo

Mostrar un resumen de cantidades fiable dentro del nuevo workspace,
sin reinterpretar la entrada física ni modificar el flujo de creación
de recepciones.

## Datos y cálculo

Se usa exclusivamente `PurchaseReceiptFormItem.pendingQuantity` y
`PurchaseReceiptFormItem.quantityReceived` que ya utiliza
`usePurchaseReceipts`; no se consulta una API nueva ni se recalcula
`receivedQuantity` desde una segunda fuente.

- **Pendientes antes:** suma de `pendingQuantity` verificados de las partidas
  aún pendientes.
- **Recibir ahora:** suma de cantidades con captura no vacía que sean enteros
  seguros dentro de `1..pendingQuantity`.
- **Pendientes después (proyección):** pendientes antes menos recibir ahora.
- **Partidas capturadas:** cuenta las filas con valor no vacío; otras filas
  permanecen omitidas y se soportan recepciones parciales.

Si **cualquier** cantidad capturada es inválida, `Recibir ahora` y
`Pendientes después` pasan a `—` con aviso visible. No se suman únicamente
las filas válidas para fabricar un resultado parcial engañoso. Si los pendientes
de origen son incoherentes/no enteros o una suma excede
`Number.MAX_SAFE_INTEGER`, también se ocultan los totales afectados.

Sin capturas, estado `empty`: `Recibir ahora = 0`, pendientes después
igual a pendientes antes y aviso de captura incompleta. No se interpreta
como registro válido ni se altera el estado de los botones.

**Nota de seguridad:** esto es **solo información visual**. No confirma que
se pueda registrar: lote requerido, caducidad, documento del proveedor,
autoridad PHYSICAL/LEGACY y demás condiciones continúan verificándose
mediante la misma lógica preexistente y finalmente en el backend.

## Diseño

- Archivo puro: `web/app/(app)/purchases/receipt-quantity-summary.ts`.
- Tarjeta de presentación: `ReceiptCaptureSummary.tsx`.
- Solo modo workspace y solamente durante la captura. Se ubica **a la derecha**
  dentro del área inferior, con un layout de dos columnas `11fr / 9fr` en
  escritorio y tarjeta de ancho completo en móvil.
- La mitad izquierda permanece libre en este PR: se ocupará con la
  tarjeta real de **Adjuntos de la recepción** en RR-005, con el componente
  del PR #167 cuando se coordinen las bases Draft.
- No hay controles nuevos para modificar stock, confirmar recepción,
  guardar borrador o rechazar mercancía.
- Con workspace OFF, el modal anterior **no** muestra la tarjeta ni
  cambia su flujo.

## QA

Pruebas automáticas propuestas:
- Parcial (filas seleccionadas + filas vacías).
- Completo, sin cantidades, inválidos cero/negativo/decimal/sobrependiente/
  no numérico, pendiente corrupto y overflow.
- Render, recálculo al cambiar props, aviso explícito de preview.
- Integración en `PurchaseReceiptModal` workspace ON/OFF y
  ubicación de la tarjeta a la derecha.

QA manual posterior:
- Comparar cantidad en resumen con tabla y submit real en entorno QA
  autorizado sin adjuntos.
- Probar 1 y ≥15 partidas, diversos tamaños y zoom 200%.
- Visualizar error, contenido largo y scroll sin que el footer tape la tarjeta.
- Verificar que los avisos no comuniquen stock modificado antes de POST.

Sin cambios de API, permisos, PostgreSQL/Prisma, movimientos, R2, ClamAV,
uploads ni descarga. El feature flag permanece **OFF por defecto** y
el PR **Draft, no fusionar/desplegar** sin gates de RR-005 a RR-007.
