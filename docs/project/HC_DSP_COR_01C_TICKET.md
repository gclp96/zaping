# HC-DSP-COR-01C — MATERIAL QUANTITY Compensation

**Estado:** único ticket principal activo, REFINEMENT DOCUMENTAL / NOT READY FOR IMPLEMENTATION. Ningún slice en implementación.
**Base:** main@0953883; rama feat/hc-dsp-cor-01c-material-compensation.
**Milestone:** M-HC1 OPEN. **Prioridad:** P0 release gate del conjunto.
**Dependencias integradas:** 01A PR #101; 01B PR #102; cierre documental PR #103.
**Fuentes:** [TD §19](../modules/healthcare/CASE_DISPATCH_CORRECTION_TECHNICAL_DESIGN.md#19-refinement-01c--decisiones-y-límites-vigentes), [Board](PROJECT_BOARD.md), [workflow](../engineering/DEVELOPMENT_WORKFLOW.md#241-delivery-incremental-y-preparación-verificable).

## Objetivo y alcance

Preparar e implementar posteriormente, tras DoR específica, compensación completa MATERIAL CUSTODY → AVAILABLE mediante Inventory Physical y persistencia 01B. Owned total conservado, Product.stock sin incremento, Effects/Lines y testigos auditables, Dispatch original intacto y CaseKit sin restauración automática.

Fuera de alcance: Equipment, ejecución parcial mixta, callers públicos, endpoints, activación, cutover y producción. No implementar aquí guards/read model de 01E ni reemplazar QA integral 01F. En esta formalización sólo se modifican documentos; no código, pruebas o fixtures ni ejecución PostgreSQL.

## Decisiones vinculantes

- Adapter interno específico de hash/fecha; sin overrides generales ni cambios de comportamiento en writers existentes. Comprobar creación, búsqueda y replay de Effects conjuntamente.
- Locks candidatos y detalle transaccional en TD §19; orden final pendiente de validación real PostgreSQL. Inspección no equivale a aprobación del orden.
- Product/Batch no elegibles siguen rechazándose. Vencimiento/desactivación después de Dispatch puede impedir compensar; no hay bypass autorizado.
- Replay entre actores sólo con autorización actual válida, misma Company e intención idéntica, conservando actor histórico. Distinta key sobre Dispatch corregido: conflicto estable, cero nueva compensación.
- Rechazo íntegro de Equipment ACTIVE; ninguna corrección parcial ni caller público. Sin activar flujo hasta integrar 01D, 01E y 01F.

## Slices secuenciales y estimación

| Slice | Alcance / Acceptance Criteria | DoR específica | DoD específica | Riesgo / SP preliminares |
| --- | --- | --- | --- | --- |
| 01C-A | Contrato Inventory/evidencia: adapter específico; hash/fecha compatibles con 01B en creación, búsqueda y replay; agrupación y conservación; writers existentes sin cambio. Fixtures y negativas definidas antes de implementar. | Cumplir la lista de preparación siguiente. | Contrato implementado y revisado; unitarias e integración focal/PG autorizada acreditan compatibilidad con 01B; regresiones de writers existentes; sin caller productivo. | Core compartido y dos contratos de hash; 5 SP. |
| 01C-B | Orquestación MATERIAL-only: autoridad, locks, claim, transferencia agrupada, proyecciones y witness atómicos; tenant/source/cantidad/revisión exactos; replay; rechazo mixto y RR incompatible; rollback total. | A integrado; contrato de errores y plan de locks/concurrencia revisados; fixtures/negativas de B definidas. | AC probados por unitarias e integración PG autorizada; dormancia verificada; documentación/evidencia revisadas. | Composición transaccional y carreras; 5 SP. |
| 01C-C | Concurrencia y cierre: dos conexiones, duplicados, movimientos competidores, rollback, regresiones y evidencia; validar orden final de locks. | B integrado; barreras/diagnósticos y matriz concurrente revisados; entorno PG autorizado. | Matriz focal/concurrente y CI requeridas PASS, o no cerrar el slice; evidencia por commit y límites documentados. Sin atribuir gates 01D/01E/01F. | Sincronización y diagnóstico; 3 SP. |

13 SP preliminares totales, sin Commitment, Forecast, Actual ni Target aprobado. No equivalen a horas ni compromiso de completar los tres slices en un sprint. La estimación responde a adaptación del core compartido (A), transacción de dominio (B) y evidencia concurrente (C). Revisar si cambia el alcance; preservar historial de la estimación. Cada slice lleva QA propia; C no difiere la validación esencial de A/B.

## DoR pendiente para iniciar 01C-A

- [ ] Especificar y revisar interfaz interna del adapter, acceso al root staged y validaciones tenant/intención/transacción.
- [ ] Resolver cómo creación, findEffect y classifyCommittedEffect usan hash/fecha sin romper hashing/replay de writers actuales; prohibir adopción de Effects huérfanos.
- [ ] Revisar contratos de errores, límites de tamaño/cantidad y política de rechazo vigente de Product/Batch.
- [ ] Definir fixtures válidas y negativas antes del código: hash/fecha, tenant extranjero, fuente/revisión cambiada, agrupación, duplicados y rollback. Evitar combinaciones prohibidas por Dispatch.
- [ ] Revisar estrategia de locks y matriz de validación PostgreSQL con escritores competidores; orden candidato explícitamente no validado. La validación real final es gate de cierre, no evidencia ya obtenida.
- [ ] Revisar si hace falta migración nueva: origen string no la exige por sí mismo; no modificar migraciones existentes.
- [ ] Aprobar alcance y estimación Target de A; acordar estrategia QA y autorización del entorno PG antes de cualquier ejecución.

Formalizar estas decisiones no satisface automáticamente la DoR. No declarar READY FOR IMPLEMENTATION mientras queden pendientes técnicos de A.

## Acceptance Criteria comunes

1. PHYSICAL con control persistido, shared fence y runtime compatible; rechazar LEGACY/CUTOVER/RECOVERY_REQUIRED sin bypass.
2. Usar exclusivamente CUSTODY original tenant-safe con Product/Batch/cantidad exactos y revisión/historia verificadas bajo locks; saldo repuesto no permite compensar movimientos posteriores.
3. AVAILABLE canónica; un Effect puede agrupar fuentes, con Lines y mapping por item coherentes. Owned conservado y Batch proyectado desde hechos persistidos.
4. Claim/resourceId, root/items, Effects/Lines, proyecciones y snapshots en una sola transacción; sello final y validación diferida; rollback completo ante cualquier error.
5. Replay histórico cero-write con autorización vigente, sin exigir saldos actuales; key/hash incompatibles y distinta key sobre Dispatch corregido rechazan establemente.
6. RR DRAFT/CONFIRMED bloquea; CANCELLED coherente sin efectos puede admitirse. No cancelación automática. Guards y lecturas de 01E siguen pendientes.
7. Dispatch con Equipment ACTIVE rechaza íntegramente antes de efectos; sin endpoints, callers públicos o activación.

## Estrategia QA y fixtures previas

| Área | Unitarias / integración focal | PostgreSQL 16 aislado y autorizado |
| --- | --- | --- |
| Simple y agrupado | Plan, mapping, sumas y límites | Effect/Lines, revisión, sello y constraints reales |
| Batches/proyecciones | NONE/OPTIONAL/REQUIRED, vencido/inactivo | AVAILABLE Batch correcto; owned intacto |
| Autoridad | LEGACY/CUTOVER/RECOVERY_REQUIRED | Shared fence frente a cutover exclusivo |
| Negativas de identidad/estado | Tenant/source/contexto/revisión/saldo | FK/diagnóstico esperado; movimiento y reposición rechazados |
| Adapter/Effects | Hash/fecha y creación/búsqueda/replay coherentes | Witness 01B acepta evidencia real; huérfano rechaza |
| Duplicados/replay | Intención, actores y conflicto distinta key | Dos conexiones; un solo witness/Effect; replay histórico tras cambios vivos |
| Rollback | Propagación de fallos | Fallo tras Effect/proyección y antes del sello: cero parciales |
| RR y mixto | DRAFT/CONFIRMED/CANCELLED; rechazo Equipment ACTIVE | Serialización disponible, cero parcial; carreras completas RR dependen de 01E, mixto exitoso de 01D |
| Regresiones | Writers Inventory, Dispatch/RR y 01B afectados | Competidores físicos, orden final de locks y CI correspondiente |

Orden: unitarias → integración focal → PG → concurrencia → regresiones → CI. Diseñar fixtures/barreras y negativas primero; no ejecutar contra base no autorizada. Diagnóstico contractual exacto: timeout/deadlock/transporte no pasan por rechazo de integridad. Tras dos intentos diagnósticos sin nueva evidencia, detener el ciclo y revisar estrategia, registrando bloqueo/retrabajo; no relajar aserciones para conseguir PASS.

## Definition of Done común y niveles de entrega

AC cumplidos, revisión de seguridad/tenant/errores, checks aplicables (typecheck, lint, build), pruebas relevantes y evidencia por commit, documentación sincronizada. Excepciones deben registrarse y aceptarse expresamente cuando corresponda; no convertir el typecheck global histórico en PASS. Integración de cada slice verificada por PR/SHA cuando suceda, sin staging/commit/PR autorizados por esta formalización.

Backend integrado no equivale a flujo demostrable, release-ready o producción habilitada, conforme al workflow. Sin activar el flujo hasta integrar 01D Equipment, 01E admission/read model RR y 01F QA/release gate, más revisión humana requerida.

## Métricas iniciales y seguimiento

| Campo | Estado inicial / regla |
| --- | --- |
| Started | Implementación no iniciada; fecha no registrada. Refinamiento documental no cuenta como Started de código. |
| Merged | Ningún merge de implementación 01C acreditado. Registrar PR/SHA cuando ocurra. |
| Target SP | Pendiente de aprobación; estimación preliminar A/B/C = 5/5/3. |
| Actual SP | No registrado; no copiar Target. |
| Forecast / Commitment | No establecidos. |
| Tiempo estimado / real | No registrados; no convertir SP a horas. Separar esfuerzo y tiempo transcurrido. |
| Bloqueo | Sin medición registrada; capturar inicio/fin, causa, dependencia y resolución cuando existan. Pendientes DoR no implican duración inventada. |
| Retrabajo | Sin medición registrada; capturar motivo, cambio y esfuerzo cuando consten. |
| Evidencia QA | Ninguna ejecución nueva de 01C; registrar commit/comando/entorno/resultado/duración acreditados. |

Mantener sprints de dos semanas y un principal/un slice en implementación. Retrospectiva breve en el registro del sprint existente, con evidencia y acción concreta; no crear otro sistema de gestión.

## Riesgos residuales

M-HC1: **OPEN**. RISK-006: **OPEN / NOT REPRODUCED**. Incidente intermitente EQUIPMENT: sin causa raíz confirmada ni resolución demostrada. Typecheck global de specs: **FAIL, 70 errores históricos reportados**, sin nuevas localizaciones reportadas en la evidencia 01B; no se reejecutó ni se dispensa su excepción pendiente de aceptación humana. Sin cutover ni autorización de producción.

La evidencia histórica de 01B no certifica el writer 01C futuro. Este ticket no autoriza resolver ni aceptar formalmente esos riesgos por el mero avance documental.
