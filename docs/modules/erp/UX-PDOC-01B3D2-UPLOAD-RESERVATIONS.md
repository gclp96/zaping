# UX-PDOC-01B3d2 — Reservas y cuotas transaccionales para adjuntos

**Estado:** Implementado como fundamento de PostgreSQL (servicio **interno**, no registrado en API/HTTP). PR draft sin merge.  
**Dependencia:** PR #151 B3d1, PR #150 QA R2 real, ADR-016.

## Problema de integridad

Una subida PDF/JPEG involucra dos sistemas: PostgreSQL (referencia/estado/contabilidad de cuota) y R2 (bytes). No existe una única transacción ACID que abarque ambos. La tabla actual `SupplierDocumentAttachment` solo permite `PENDING_SCAN` / `AVAILABLE` / `REJECTED` / `REMOVED`, y obliga a vincular objeto y escáner correctamente. Registrar una reserva como `PENDING_SCAN` **antes** de recibir bytes sería engañoso; registrar el archivo **después** de recibirlo sin reserva permite superar cuotas concurrentemente.

## Decisión B3d2: ledger de reserva distinto del adjunto

Se agrega `SupplierAttachmentUploadReservation` con datos internos inmutables:

- Company, documento de proveedor, actor, clave de solicitud idempotente y ID de reserva.
- Clave opaca `quarantine/<companyUuid>/<documentUuid>/<reservationUuid>` derivada por servidor.
- Nombre, MIME PDF/JPEG, tamaño 1–10 MiB, SHA-256, estado y marcas de tiempo.
- Estados de dominio contemplados para el siguiente ciclo: `RESERVED`, `RECONCILE_REQUIRED`, `REGISTERED`, `RELEASED_VERIFIED_EMPTY`.

**Fail-closed:** esta migración **solo permite INSERT con estado RESERVED**, rechazando `UPDATE` o `DELETE` mediante trigger. Los otros estados son contratos futuros, no funcionalidades activas. De esta manera ninguna reserva se elimina o marca como resuelta sin implementar primero el protocolo auditado de conciliación.

Se conservan FKs por (documentId,companyId) y (createdById,companyId), unicidad idempotente (Company, Document, requestKey), unicidad de clave y CHECKs de clave tenant, tamaño, formato, hash y nombre.

## Reserva atómica y política de cuotas

`SupplierAttachmentUploadReservationsService.reserve`:

1. Valida metadatos ya inspeccionados (no recibe archivos a través de HTTP).
2. En una transacción `READ COMMITTED` adquiere `SELECT ... FOR UPDATE` sobre **un SupplierDocument activo de la Company autenticada**. No bloquea todo el ERP ni tablas de inventario.
3. Revisa actor activo con `ADMIN` o `MANAGER`.
4. Reproduce misma request key con mismos metadatos/actor sin duplicar reserva; si hay cambios responde conflicto.
5. Cuenta adjuntos registrados que no estén `REMOVED` y reservas pendientes `RESERVED`/`RECONCILE_REQUIRED`.
6. Rechaza cuando excedería **10 archivos** o **100 MiB por documento**. No hay límite empresarial global definido para B3d2; establecerlo más adelante con datos de consumo real.
7. Persiste reserva `RESERVED` y devuelve solo ID, estado, bytes y fecha; no revela bucket, hash, clave interna ni credenciales.

**Importante:** cualquier futuro worker que cambie el número/consumo de adjuntos debe tomar el **mismo lock sobre SupplierDocument**. Los agregados sin ese lock no garantizan cuotas frente a concurrencia de otros escritores.

## Recuperación de fallos y siguiente B3d3

Los estados de recuperación figuran en el enum **sin permiso de transición en esta migración**. Una reserva no caduca automáticamente ni libera espacio por reloj, porque un timeout de R2 puede haber almacenado bytes aunque el backend no haya recibido confirmación.

B3d3 deberá implementar bajo control de un worker y nueva migración auditada:

- `RESERVED` → solicitud de carga a cuarentena → confirmación o `RECONCILE_REQUIRED`.
- Si `PutObject` fue ambiguo, verificar objeto, tamaño y SHA, sin sobreescribir, antes de avanzar.
- Confirmar bytes cuarentenados y crear `SupplierDocumentAttachment(PENDING_SCAN)` **en la misma transacción** que cambia reserva a `REGISTERED`, con mismo lock sobre documento, evitando doble contabilización.
- `RELEASED_VERIFIED_EMPTY` solo tras verificar ausencia de objeto e historial auditado. Nunca borrar una reserva ni asumir que un timeout significa que no hay objeto.
- Scanner separado, sin privilegios de ADMIN/MANAGER para autoproclamarse limpio; luego promoción al bucket privado y `AVAILABLE` con atestación comprobable.
- Dejar definida la semántica de `storageKey` en adjunto: al promover el objeto, no modificar su clave inmutable sin una migración/control explícitos. Considerar identificadores distintos de cuarentena/privado o ancla inmutable derivable.
- Definir retención/cleanup, cuotas para documentos `REMOVED`, auditoría append-only y métrica de reservas atascadas.

## QA

CI contiene E2E PostgreSQL exclusivo de GitHub Actions en `localhost:5432/zaping_test`, usuario `ci`: concurrencia 12 reservas (máximo 10 aceptadas), replay idempotente concurrente, colisión distinta, aislamiento Company, actor SALES denegado, uso de cupo por adjuntos existentes y protección SQL ante mutación.

**NO** se ha conectado al servicio HTTP ni a R2 real: ninguna carga ni lectura cambia estado operativo; no requiere secretos Cloudflare. Mantener `SupplierDocumentsModule` fail-closed (HTTP 503). No ejecutar migraciones en `zaping_dev` ni `zaping_qa`, ni merge a `main` hasta QA+aprobación.
