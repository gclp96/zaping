# ADR-015 — Identidad física de existencias sin lote con caducidad

**Estado de decisión:** ACCEPTED (OX-PUR-05B; issues #115 y #116)
**Estado de implementación:** IN PROGRESS — contrato inicial; código y migración todavía no implementados
**Fecha:** 2026-10-22
**Área:** Zaping ERP / Compras, Recepciones e Inventory Physical
**PR base:** #114 integrado en `main`

## 1. Problema comprobado

En INSAP se recibe material válido sin que el proveedor informe lote, número de serie o caducidad. No debemos fabricar estos datos ni impedir una recepción válida sólo porque falten.

Actualmente `ProductLotTracking.REQUIRED` bloquea las entradas sin lote en el writer PHYSICAL y `PhysicalInventoryService.validateKey` exige un Batch también en movimientos posteriores. `SalesPhysicalSourceResolver` rechaza ventas de REQUIRED antes de resolver existencias.

La identidad de `InventoryPosition` y los índices UNIQUE actuales sólo permiten un pool AVAILABLE sin lote por Company/Product; cuando dos recepciones sin lote tienen fechas de caducidad distintas, sumar ambas cantidades hace imposible conocer cuántas unidades de cada fecha se conservan después de una salida parcial.

Guardar la fecha sólo en `PurchaseReceiptItem` NO soluciona la disponibilidad física ni la trazabilidad de consumos.

## 2. Decisión

Ampliar **`InventoryPosition`**, no crear un subledger independiente en esta etapa:

- Para QUANTITY sin lote de fabricante, `inventoryBatchId = NULL`. La identidad se discrimina adicionalmente por **caducidad opcional** (día calendario), separando fecha desconocida (`NULL`) de cada fecha conocida. `NULL` significa *dato desconocido*, no *no caduca*.
- Para existencias con lote real, `inventoryBatchId` apunta a `InventoryBatch`; su caducidad se conserva en ese Batch. La nueva fecha de Position queda `NULL` para evitar dos fuentes de verdad.
- El número de lote de fabricante nunca se sintetiza a partir de recepción, fecha u otro dato interno.
- Preservar permanentemente el ID y los efectos históricos de posiciones anteriores; sus caducidades no informadas se representarán como `NULL` sin reescribir evidencias.
- `ProductLotTracking` permanece como metadato de configuración; la política opcional de ingreso OX-PUR-05B se aplica explícitamente en la recepción autorizada, no mediante cambio masivo a `NONE`.

## 3. Contrato de fechas

- Persistir fecha calendario como `DATE` PostgreSQL (Prisma `DateTime? @db.Date` si compatible con el esquema existente), sin tratar el día de caducidad como timestamp UTC de expiración.
- Elegibilidad evaluada respecto al **día local de la Company**, a través de su zona horaria configurada, no el huso horario del servidor.
- Una unidad con caducidad `D` conserva elegibilidad durante el día local `D`; a partir del día local siguiente NO puede seleccionarse para ventas ni nuevas entregas ordinarias.
- Un material con fecha de caducidad conocida **anterior al día de recepción** no ingresa al pool comercial disponible. El contrato de mercancía rechazada/aislada se resolverá en su ticket propio.
- Fecha desconocida permanece distinguible de fecha futura y fecha vencida; un producto sin fecha no debe ser marcado como vencido automáticamente.

## 4. Identidad, persistencia y migración

Implementar mediante una migración **nueva, aditiva y explícita** (no editar migraciones ya aplicadas):

1. Agregar campo nullable de caducidad a `InventoryPosition`.
2. Establecer CHECK de fuente única: Position con `inventoryBatchId IS NOT NULL` no repite caducidad; posición sin Batch puede conservarla.
3. Sustituir sólo los índices UNIQUE parciales de posiciones **sin Batch** (AVAILABLE y CUSTODY) por claves que incluyen caducidad; preservar unicidad de `NULL` con índices `NULLS NOT DISTINCT` PostgreSQL 16 o una estrategia equivalente **probada**. No cambiar los índices para posiciones con Batch.
4. Conservar cantidades, revisiones, relaciones, contextos, IDs y efectos existentes. No eliminar ni fusionar posiciones históricas.
5. Validar ejecución en PostgreSQL efímero con migraciones históricas, constraints y rollback de cambios transaccionales. No ejecutar contra bases locales o productivas.

Los detalles exactos de DDL e índices quedan sujetos a revisión del diff antes de aplicar.

## 5. Contrato del motor Physical

- Actualizar `PositionKey`, normalización, identidad y búsqueda/lock de posiciones para distinguir fechas, incluyendo `NULL` explícito en predicados de posiciones sin lote. Un filtro sin fecha NO debe coincidir accidentalmente con todas las posiciones del mismo producto.
- Mantener compatibilidad de la serialización de solicitudes anteriores **sin caducidad** y su `physicalRequestHash`: no invalidar replays o evidencias históricas por añadir un campo nulo nuevo. Cualquier cambio de esquema del hash requiere versionado o canonización retrocompatible y pruebas de replay.
- Validar caducidad tanto al seleccionar la fuente como bajo el lock del movimiento, para evitar que un pool vencido se consuma por una condición de carrera.
- Transferencia/custodia debe preservar exactamente la dimensión de caducidad. No se pueden mezclar dos fechas diferentes dentro de la misma posición de destino.
- Mantener `owned` incluyendo vencidos; computar `available/usable` excluyendo material vencido. No confundir saldo físico con vendible.
- Nunca permitir que una excepción destinada a recepciones abra créditos físicos arbitrarios. Conservar el origen `PURCHASE_RECEIPT`, tenant, actor, permisos, idempotencia, CAS revision, atomicidad y evidencia de efecto.
- Mantener una vía auditada para gestionar material vencido/no conforme sin habilitar su consumo comercial; no inferir que un `DEFINITIVE_OUT` ordinario de material vencido ya está permitido.

## 6. Consumidores que deben examinarse y regresiones

- `ReceiptPhysicalIntegrationService` + `PurchaseReceiptsService` (LEGACY/PHYSICAL y documento del proveedor del PR #114).
- `PhysicalInventoryService`, `PhysicalInventoryRepository`, `physical-inventory.contract`, proyecciones y read service.
- `SalesPhysicalSourceResolver` y flujos genéricos: múltiples pools sin lote, fechas diferentes y selección determinista de fuentes elegibles; lotes conocidos no se deben consumir silenciosamente.
- Inventario manual; opening/cutover; healthcare dispatch, custody, reconciliation y correction.
- SERIALIZED/ASSET: sin regresión; no equiparar lote opcional con obligatoriedad de serie individual.

## 7. Casos mínimos de aceptación / QA

- Mismo Product con (sin lote/sin fecha), (sin lote/fecha A), (sin lote/fecha B), (lote real/fecha C): cuatro saldos/identidades independientes.
- Dos ingresos de la misma identidad reutilizan posición; fechas distintas no colisionan; reintentos no duplican stock, movimiento ni efecto.
- Movimientos parciales y transferencias preservan las fechas; no mezclan cantidades.
- Venta/consumo de `REQUIRED` sin lote es posible sólo para pools sin lote **elegibles**; cuando existan varios se define orden determinista de asignación (FEFO para conocidos no vencidos, desconocidos en último lugar) con evidencia por `sourceId`; lotes reales siguen bajo selección autorizada.
- A partir del día posterior a D, pool vencido sigue en `owned` pero se excluye de `available/usable` y operaciones comerciales.
- CONTROLES: saldo insuficiente, revision stale, concurrencia, rollback, tenant cruzado, replay hash histórico, lecturas, cutover/opening/healthcare y migración histórica.
- API test, PostgreSQL E2E en CI efímera, typecheck, lint, build y smoke de regresión del documento de proveedor.

## 8. Scope y gates

**Primero:** contrato/migración + motor e índices con QA específico. **Después:** integración de receipt y consumidores, seguida por Web (issue #115).

No tocar `main`, `.env`, credenciales, DB local `zaping_dev`, `zaping_qa`, `zaping_spike_test` o producción. No realizar merge automático.

**STOP obligatorio** sólo ante inconsistencia nueva: necesidad de reescribir evidencia histórica, imposibilidad de garantizar no mezcla de fechas o control bajo lock, o incompatibilidad no resuelta con opening/cutover/healthcare.

## 9. Consecuencias

**Beneficio:** entradas rápidas sin lote ficticio y control real de vencimiento por unidad de inventario agregada.

**Costo:** migración de identidad física y ajuste de contratos compartidos, índices, lecturas, selección de fuentes, pruebas y compatibilidad histórica.

**No incluido:** multialmacén, remisiones de venta, captura de múltiples lotes en una misma partida, control completo de rechazos ni anexos posteriores de factura (#118).
