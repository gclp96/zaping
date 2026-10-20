# HC-DSP-COR-01B — Persistence & Witness

**Milestone:** M-HC1 · **Prioridad:** P0
**Workflow propuesto:** REFINEMENT → READY cuando 01A esté documentado e integrado
**Story Points:** TBD tras inspección de constraints/migraciones
**Dependencia:** HC-DSP-COR-01A — aprobación y TD integrados en main mediante PR #101, base `619c9b6` de esta rama. La revisión humana de 01B sigue pendiente; este checkpoint no actualiza el Project Board.

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

## Checkpoint Pre-PR — 2026-10-20

Persistencia, migración forward-only, guards diferidos, hash/idempotencia y lectura interna implementados en feat/hc-dsp-cor-01b-persistence, base 619c9b6 (PR #101). Sin endpoints ni compensaciones productivas. Evidencia y comandos en [Persistence & Witness 01B](../modules/healthcare/CASE_DISPATCH_CORRECTION_PERSISTENCE_01B.md).

QA externo comunicado desde PostgreSQL 16.15 aislado (zaping-hc-cor-01b-pg, 127.0.0.1:5435, zaping_hc_dsp_cor_01b_test): migraciones PASS, **Persistence 29/29 PASS** y **Hardening 37/37 PASS sin instrumentación en dos ejecuciones completas consecutivas**. La versión final completó **66/66 PASS**. Codex no ejecutó PostgreSQL.

Remediación: rechazos específicos por diagnóstico/constraint (incluido el CHECK decodificado desde el envelope Prisma), DispatchItem de otro Dispatch de la misma Company/Case/CaseKit y autorización fija a 5435. NOWAIT de dos conexiones y rechazo específico 55P03 validados externamente en Persistence. Se conservan **29 Persistence + 37 Hardening = 66/66 PASS** sobre la versión final.

Unitarios 01B: 153 tests / 5 suites PASS. Regresión ampliada Dispatch/RR: 330 tests / 11 suites PASS. Typecheck focal y lint focal/global PASS. El typecheck global de specs permanece **FAIL: 70 errores preexistentes**, sin nuevas localizaciones; artefacto baseline/current conservado. Build API PASS previamente reportado; comparación global documentada y artefacto conservado. **La excepción del typecheck global FAIL está pendiente de aceptación humana expresa; los gates focales no la dispensan.** Comprobaciones finales en el documento de evidencia.

Incidente EQUIPMENT: una ejecución previa 36/37 falló durante la creación inicial del witness; causa raíz no confirmada e intermitencia no declarada resuelta. Con diagnóstico: Hardening 37/37, subconjunto 10/10 y caso aislado 1/1 PASS. Últimos predicados: una fila, ninguno falso/NULL, cero eventos adicionales, deltas temporales +33 ms / +26 ms y diferencias respecto de confirmación 0 ms / 0 ms. El hook temporal fue retirado sin modificar fixtures ni fechas; después, dos ejecuciones completas consecutivas sin instrumentación obtuvieron 37/37 PASS. Estos resultados no demuestran resuelta la intermitencia.

Revisión humana, PR y ensayos sobre bases pobladas pendientes. No se autoriza migración real, despliegue, cutover, activación de writers o actualización del Project Board. No declarar DONE. RISK-006 permanece **OPEN / NOT REPRODUCED**.
