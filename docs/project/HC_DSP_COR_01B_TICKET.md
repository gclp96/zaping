# HC-DSP-COR-01B — Persistence & Witness

**Milestone:** M-HC1 · **Prioridad:** P0
**Workflow propuesto:** REFINEMENT → READY cuando 01A esté documentado e integrado
**Story Points:** TBD tras inspección de constraints/migraciones
**Dependencia:** HC-DSP-COR-01A — contrato V0.7 aprobado, pendiente merge documental de la aprobación y TD. Al merge, 01B puede pasar a READY tras refinamiento de SP/DoR.

## Objetivo

Crear la estructura persistente e inmutable que documente una corrección **completa** de Dispatch confirmado por error **sin entrega física**, sin ejecutar aún ninguna compensación ni habilitar el endpoint público. Preparar un testigo confiable para los slices físicos 01C/01D y el read model 01E.

## Alcance

- Modelo root `HealthcareCaseDispatchCorrection`, con Company/Case/Dispatch, tipo `NO_PHYSICAL_HANDOFF`, motivo, declaración, actor, fecha servidor, snapshot/version y vinculación a idempotencia.
- Modelo `HealthcareCaseDispatchCorrectionItem` por cada fuente ACTIVE del Dispatch original, tipado MATERIAL/EQUIPMENT y con campos de evidencia física compensatoria nullable hasta el commit terminal controlado. El formato SQL exacto debe estar autorizado por restricciones de completitud.
- FKs compuestas tenant-safe para Company, Case, Dispatch, DispatchItem y referencias de Effects/Custody/Event; unicidad durable de corrección por Dispatch.
- Estado terminal `CONFIRMED` solamente después de completar atómicamente el conjunto; no permitir filas incompletas commiteadas. Diseñar validación diferida/transaccional de completitud sin bloquear el staging legítimo dentro de la transacción.
- Scope de `IdempotencyRecord` exclusivo; hash versionado con intención de atestación y motivo; mismo key+hash retorna testigo original; key+hash distinto → 409. No introducir material/equipment writer en este ticket.
- Consulta interna tenant-safe del testigo, con referencias explícitas y trazabilidad histórica; nunca inferir corrección a partir de un saldo físico.
- Migración exclusivamente en DB aislada de desarrollo/QA autorizada; no afectar cutover de Company real.

## Fuera de alcance

No compensar balances, transferir CUSTODY, cerrar custodia Equipment, modificar origen Dispatch, admitir públicamente comando, integrar RR summary, modificar CaseKit/capacidad, desplegar producción o ejecutar cutover.

## Criterios de aceptación

1. Schema Prisma, migración SQL y checks/FKs/unique documentados; `prisma validate` y ejecución sobre PostgreSQL aislado PASS.
2. Prohibidos duplicados (incluso con concurrencia) de corrección para un Dispatch; FK foreign tenant/item rechazada.
3. No se puede confirmar testigo incompleto, con item faltante, referencia física incoherente o atestación ausente. La secuencia de staging válida dentro de la misma tx debe ser posible.
4. Dispatch original y su historial permanecen byte-for-byte sin mutación atribuible al slice.
5. Integridad e inmutabilidad probadas; pruebas de rollback dejan cero registros parciales.
6. Aún no existe ruta productiva de compensación ni efectos físicos activados; los consumers Dispatch/RR no cambian todavía de comportamiento.
7. Unit tests + PostgreSQL integration focal, lint/typecheck/build/Prisma/diff-check PASS según los gates del repo.
8. `RISK-006` permanece abierto y la documentación reporta explícitamente funcionalidad no operativa hasta completar 01C–01F.

## Riesgos/revisiones obligatorias antes de escribir código

- Elegir esquema que permita terminar el testigo **en una única transacción**, sin introducir estados persistentes provisionales o violar CHECKs.
- Garantizar que el testigo persiste referencias exactas para un `transfer` QUANTITY y un `CUSTODY_CLOSE` Equipment; no añadir supuestos falsos de una misma Effect por cada item si el core agrupa líneas.
- Verificar compatibilidad de snapshots, idempotency scopes y FK/constraints diferidos existentes.
- Si los cambios requieren alterar un servicio productivo de Dispatch/RR/Inventory/Equipment, detener el scope 01B y documentar dependencia hacia 01C/01D/01E.

## Definition of Done

PR focal de schema/migración/tests/docs revisado y merged en main; sin rutas expuestas ni cambios reales de inventario; evidencia de QA reproducible. Hasta ese merge, estado no puede ser `DONE`.
