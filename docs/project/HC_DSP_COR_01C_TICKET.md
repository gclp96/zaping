# HC-DSP-COR-01C — MATERIAL QUANTITY Compensation

**Estado:** único ticket principal activo. 01C-A: POSTGRESQL QA 13/13 PASS / CODE REVIEW SIN BLOQUEOS FUNCIONALES / INTEGRACIÓN PENDIENTE. 01C-B y 01C-C pendientes; sin flujo operativo habilitado.
**Base del refinamiento:** main@0953883, integrado por PR #104. **Implementación A:** rama feat/hc-dsp-cor-01c-a-inventory-contract desde main@519f0dc.
**Milestone:** M-HC1 OPEN. **Prioridad:** P0 release gate del conjunto.
**Dependencias integradas:** 01A PR #101; 01B PR #102; cierre documental PR #103.
**Fuentes:** [TD §19](../modules/healthcare/CASE_DISPATCH_CORRECTION_TECHNICAL_DESIGN.md#19-refinement-01c--decisiones-y-límites-vigentes), [Board](PROJECT_BOARD.md), [workflow](../engineering/DEVELOPMENT_WORKFLOW.md#241-delivery-incremental-y-preparación-verificable).

## Objetivo y alcance

Preparar e implementar posteriormente, tras DoR específica, compensación completa MATERIAL CUSTODY → AVAILABLE mediante Inventory Physical y persistencia 01B. Owned total conservado, Product.stock sin incremento, Effects/Lines y testigos auditables, Dispatch original intacto y CaseKit sin restauración automática.

Fuera de alcance: Equipment, ejecución parcial mixta, callers públicos, endpoints, activación, cutover y producción. No implementar aquí guards/read model de 01E ni reemplazar QA integral 01F. La formalización de PR #104 fue documental. La autorización posterior permite exclusivamente el adapter y QA de 01C-A en el inventario acotado; no autoriza el comando completo ni ejecución PostgreSQL sin preflight y autorización propios de A.

## Decisiones vinculantes

- Adapter interno específico de hash/fecha; sin overrides generales ni cambios de comportamiento en writers existentes. Comprobar creación, búsqueda y replay de Effects conjuntamente.
- Locks candidatos y detalle transaccional en TD §19; orden final pendiente de validación real PostgreSQL. Inspección no equivale a aprobación del orden.
- Product/Batch no elegibles siguen rechazándose. Vencimiento/desactivación después de Dispatch puede impedir compensar; no hay bypass autorizado.
- Replay entre actores sólo con autorización actual válida, misma Company e intención idéntica, conservando actor histórico. Distinta key sobre Dispatch corregido: conflicto estable, cero nueva compensación.
- Rechazo íntegro de Equipment ACTIVE; ninguna corrección parcial ni caller público. Sin activar flujo hasta integrar 01D, 01E y 01F.

## Slices secuenciales y estimación

| Slice | Alcance / Acceptance Criteria | DoR específica | DoD específica | Riesgo / SP preliminares |
| --- | --- | --- | --- | --- |
| 01C-A | Contrato Inventory/evidencia: adapter específico; hash/fecha compatibles con 01B en creación, búsqueda y replay; agrupación y conservación; writers existentes sin cambio. Fixtures y negativas definidas antes de implementar. | Cumplir la lista de preparación siguiente. | Contrato implementado y revisado; unitarias e integración focal/PG autorizada acreditan compatibilidad con 01B; regresiones de writers existentes; sin caller productivo. | Core compartido y dos contratos de hash; Target aprobado 5 SP. |
| 01C-B | Orquestación MATERIAL-only: autoridad, locks, claim, transferencia agrupada, proyecciones y witness atómicos; tenant/source/cantidad/revisión exactos; replay; rechazo mixto y RR incompatible; rollback total. | A integrado; contrato de errores y plan de locks/concurrencia revisados; fixtures/negativas de B definidas. | AC probados por unitarias e integración PG autorizada; dormancia verificada; documentación/evidencia revisadas. | Composición transaccional y carreras; 5 SP. |
| 01C-C | Concurrencia y cierre: dos conexiones, duplicados, movimientos competidores, rollback, regresiones y evidencia; validar orden final de locks. | B integrado; barreras/diagnósticos y matriz concurrente revisados; entorno PG autorizado. | Matriz focal/concurrente y CI requeridas PASS, o no cerrar el slice; evidencia por commit y límites documentados. Sin atribuir gates 01D/01E/01F. | Sincronización y diagnóstico; 3 SP. |

Referencia de refinamiento: 13 SP preliminares totales (5/5/3). Autorización posterior: únicamente 01C-A tiene Target aprobado de 5 SP; B/C conservan 5/3 preliminares. Sin Commitment, Forecast ni Actual. No equivalen a horas ni compromiso de completar los tres slices en un sprint. La estimación responde a adaptación del core compartido (A), transacción de dominio (B) y evidencia concurrente (C). Revisar si cambia el alcance; preservar historial de la estimación. Cada slice lleva QA propia; C no difiere la validación esencial de A/B.

## DoR de 01C-A — checkpoint de refinamiento PR #104

- [ ] Especificar y revisar interfaz interna del adapter, acceso al root staged y validaciones tenant/intención/transacción.
- [ ] Resolver cómo creación, findEffect y classifyCommittedEffect usan hash/fecha sin romper hashing/replay de writers actuales; prohibir adopción de Effects huérfanos.
- [ ] Revisar contratos de errores, límites de tamaño/cantidad y política de rechazo vigente de Product/Batch.
- [ ] Definir fixtures válidas y negativas antes del código: hash/fecha, tenant extranjero, fuente/revisión cambiada, agrupación, duplicados y rollback. Evitar combinaciones prohibidas por Dispatch.
- [ ] Revisar estrategia de locks y matriz de validación PostgreSQL con escritores competidores; orden candidato explícitamente no validado. La validación real final es gate de cierre, no evidencia ya obtenida.
- [ ] Revisar si hace falta migración nueva: origen string no la exige por sí mismo; no modificar migraciones existentes.
- [ ] Aprobar alcance y estimación Target de A; acordar estrategia QA y autorización del entorno PG antes de cualquier ejecución.

Este checklist conserva el estado histórico previo a la autorización de implementación; en aquel checkpoint la autorización específica de la base PostgreSQL estaba pendiente. El estado actual y la evidencia externa posterior se registran al final. No implica integración ni habilitación operativa.

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
| Started | 2026-10-20, inicio real de implementación de A en esta sesión autorizada; no reconstruido de commits. |
| Merged | Ningún merge de implementación 01C acreditado. Registrar PR/SHA cuando ocurra. |
| Target SP | A = 5 aprobado. B/C = 5/3 preliminares, sin Target aprobado. |
| Actual SP | No registrado; no copiar Target. |
| Forecast / Commitment | No establecidos. |
| Tiempo estimado / real | No registrados; no convertir SP a horas. Separar esfuerzo y tiempo transcurrido. |
| Bloqueo | Sin medición registrada; capturar inicio/fin, causa, dependencia y resolución cuando existan. Pendientes DoR no implican duración inventada. |
| Retrabajo | Sin medición registrada; capturar motivo, cambio y esfuerzo cuando consten. |
| Evidencia QA | Codex: 253/253 PASS locales, build/lint/typecheck focal y productivo PASS reportados. Usuario: PostgreSQL QA 13/13 PASS, exit 0; evidencia externa posterior registrada abajo. Integración pendiente. |

Mantener sprints de dos semanas y un principal/un slice en implementación. Retrospectiva breve en el registro del sprint existente, con evidencia y acción concreta; no crear otro sistema de gestión.

## Riesgos residuales

M-HC1: **OPEN**. RISK-006: **OPEN / NOT REPRODUCED**. Incidente intermitente EQUIPMENT: sin causa raíz confirmada ni resolución demostrada. Typecheck global de specs: **FAIL, 70 errores históricos reportados**, sin nuevas localizaciones reportadas en la evidencia 01B; no se reejecutó ni se dispensa su excepción pendiente de aceptación humana. Sin cutover ni autorización de producción.

La evidencia histórica de 01B no certifica el writer 01C futuro. Este ticket no autoriza resolver ni aceptar formalmente esos riesgos por el mero avance documental.

## 01C-A — implementación autorizada y checkpoint local

Target 5 SP; no Commitment, Forecast, Actual ni tiempo estimado/real establecidos. Inicio: 2026-10-20. No merged ni DONE. Inventario limitado a cinco archivos nuevos y cinco modificados según la revisión aprobada.

Entradas implementadas: `transferDispatchCorrectionMaterial(tx, input)` y `classifyCommittedDispatchCorrectionMaterial(tx, input)` en PhysicalInventoryService. Input: Company/Case/Dispatch/Correction, requester, key, atestación y motivo; sin overrides de hash/fecha/actor histórico, cantidades, destinos o revisiones. Contexto específico en `dispatch-correction-physical.adapter.ts`; header dedicado en el repository. Se conserva el contrato genérico de los writers.

La entrada específica verifica autorización actual, intención/hash v1, claim y root; crea evidencia sólo con root sin snapshot de la transacción creadora, READ COMMITTED, fence retenido y control PHYSICAL válido/runtime compatible. No adquiere el fence tardíamente: el caller debe adquirirlo y comprobar autoridad antes de crear claim/root y locks de negocio. La comprobación de posesión actual no demuestra por sí sola el orden temporal global; B/C deben acreditar el protocolo completo. Relee cantidades/revisiones e historia bajo locks; rechaza Equipment ACTIVE y RR incompatible. El motor privado conserva Product → Batch → Positions, transferencia agrupada y owned neto cero. Las proyecciones y el sellado se componen sólo en el harness de A; el comando productivo es B.

Hash/fecha/actor/motivo se derivan del root. La geometría pasa por el validador físico sin motivo; el motivo Unicode conserva la semántica de puntos de código de 01B. Todas las búsquedas/clasificaciones de la ruta específica usan evidencia 01B, también antes/después de locks. Replay exige witness sellado, metadatos/Lines/snapshots coherentes y autorización actual; no consulta saldos/elegibilidad. La relación inmutable del claim permite resolver el commit de un ganador entre lecturas READ COMMITTED; su prueba local es simulada, no evidencia de carrera real. Huérfanos y distinta key rechazan.

### Estado histórico — QA local y gate PostgreSQL

Validación local sobre main@519f0dc + diff de esta sesión (sin commit):

| Gate | Resultado observado |
| --- | --- |
| Adapter, unitarias e integración simulada | 37/37 PASS, 1 suite; repetición focal tras reforzar la validación del snapshot |
| Adapter + regresiones Inventory Physical/01B | 253/253 PASS, 11 suites; incluye las 37 del adapter, no sumar dos veces |
| Typecheck focal specs | PASS: node node_modules/typescript/bin/tsc --noEmit -p test/tsconfig.dispatch-correction.json |
| Typecheck productivo API | PASS: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.build.json |
| ESLint archivos TypeScript del inventario | PASS, cero errores/warnings, sin --fix |
| Formato ocho archivos TypeScript | PASS, prettier --check |
| Build API | PASS: node node_modules/@nestjs/cli/bin/nest.js build |
| PostgreSQL 16 A | BLOCKED / NOT EXECUTED; 13 casos preparados, ningún PASS PostgreSQL nuevo |
| Typecheck global specs | No reejecutado: se conserva FAIL histórico, 70 errores reportados; el PASS focal no lo dispensa |

Comando focal ejecutado desde app/api:

```powershell
node node_modules/jest/bin/jest.js --runInBand --no-cache --cacheDirectory C:/dev/zaping/app/api/node_modules/.cache/hc-cor-01c-a --runTestsByPath src/inventory/physical/dispatch-correction-physical.adapter.spec.ts
```

La ejecución conjunta usó el mismo prefijo y --runTestsByPath con el adapter, inventory/physical/{physical-inventory.contract,inventory-integration,inventory-authority,physical-writer-batching,inventory-writer-boundary}.spec.ts y healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.{contract,repository,authorization,pg-failure,hardening-structure}.spec.ts. Las llaves aquí enumeran rutas, no son un comando PowerShell. Caché absoluta en node_modules/.cache; ninguna salida en output/ o tmp/. Los checks de compilación no ejecutan la suite PostgreSQL.

No se ejecutó PostgreSQL. Las cuatro variables específicas de A estaban ausentes (sólo se verificó presencia, sin imprimir valores): `RUN_CASE_DISPATCH_CORRECTION_MATERIAL_POSTGRES`, `HC_DSP_COR_01C_A_DATABASE_AUTHORIZATION`, `CASE_DISPATCH_CORRECTION_MATERIAL_TEST_RUN`, `CASE_DISPATCH_CORRECTION_MATERIAL_TEST_DATABASE_URL`. **PostgreSQL BLOCKED / NOT EXECUTED; no DONE.**

El preflight de A exige opt-in = 1, marcador `HC-DSP-COR-01C-A isolated QA authorized`, run explícito y URL externa propia; nunca usa DATABASE_URL, dotenv o autorización/credenciales 01B. Destino dedicado definido para preparación manual: PostgreSQL 16, 127.0.0.1:5436, DB `zaping_hc_dsp_cor_01c_a_test`, rol owner sin privilegios elevados `hc_dsp_cor_01c_a_test`, comentario de DB igual al marcador y sin Companies ajenas al ticket. Esto define requisitos; no afirma que ese entorno exista ni autoriza aprovisionarlo. Esquema/migraciones deben estar disponibles por preparación manual autorizada; esta sesión no los aplica.

Suite preparada: `test/case-dispatch-correction-material-contract.postgres.e2e-spec.ts`, 13 casos expandidos de simple/agrupado, sello 01B, Unicode, batches/proyección, rechazo inactivo/vencido, replay entre actores y negativos/rollback/mixto. Compilada; no ejecutada ni contada como PASS. Fixtures reutilizan constructores sintéticos históricos sin modificarlos; el control PHYSICAL es sólo fixture en DB dedicada, nunca cutover operativo. Conservan datos QA sin limpiar/resetear tablas.

Tras verificar y autorizar explícitamente el entorno propio de A y establecer las variables y runtime compatibles en la terminal manual, desde app/api:

```powershell
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --bail=1 --no-cache --cacheDirectory C:/dev/zaping/app/api/node_modules/.cache/hc-cor-01c-a-pg --runTestsByPath test/case-dispatch-correction-material-contract.postgres.e2e-spec.ts
```

Registrar preflight saneado, identidad/versión, commit+diff, comando y resultados. No imprimir credenciales. Orden global, carreras reales B/C y gates 01D/01E/01F siguen pendientes.

### Estado histórico — bloqueos, retrabajo y desviaciones

Bloqueo: no hay entorno/autorización PostgreSQL A disponible; causa comprobada por variables ausentes. Duración bloqueada no medida. Retrabajo local: caché Jest por defecto falló con EPERM; se configuró ruta absoluta en node_modules/.cache. Se corrigieron asignación de fixture, formato/lint y clasificación de la ventana entre lecturas; esfuerzo no medido. No se repitieron diagnósticos sin evidencia nueva.

No se amplió el inventario autorizado ni se modificó schema, SQL, módulos, rutas, servicios Dispatch/RR o helpers históricos. No se realizó staging, commit, push, PR, cutover ni activación. M-HC1 OPEN, RISK-006 OPEN / NOT REPRODUCED, EQUIPMENT sin causa confirmada y typecheck global histórico FAIL con 70 errores reportados se conservan.

Veredicto histórico local: **READY FOR POSTGRESQL QA**, ejecución real **BLOCKED / NOT EXECUTED** hasta preparación y autorización manual del entorno A. No DONE. git diff --check e inventario exacto de diez archivos verificados al entregar; cinco nuevos sin staging no aparecen en git diff --stat normal.

## Estado actual de 01C-A — QA externa y cierre del P2

**PostgreSQL QA: 13/13 PASS, exit code 0. Code Review final: sin bloqueos funcionales. Integración pendiente. P2 documental resuelto mediante esta actualización.** No se ha realizado staging, commit, push o PR; no declarar MERGED ni habilitación operativa.

Ejecución manual externa del usuario, confirmada por salida de terminal comunicada en esta conversación: PostgreSQL 16.15, 127.0.0.1:5436, base aislada zaping_hc_dsp_cor_01c_a_test. Se conserva la secuencia de QA:

| Ejecución externa | Resultado y contexto |
| --- | --- |
| Primer intento manual del usuario | **13 FAIL**, InventoryAuthorityError: INCOMPATIBLE_BUILD, por ausencia de variables de compatibilidad Inventory. |
| Ejecución manual posterior del usuario | **13/13 PASS**, **exit code 0**, con INVENTORY_RUNTIME_BUILD, INVENTORY_RUNTIME_ENVIRONMENT e INVENTORY_AUTHORITY_PROTOCOL configurados. |

**Codex no ejecutó PostgreSQL.** Sus validaciones locales previamente realizadas se conservan: **253/253 PASS en 11 suites**, build API, lint, formato y typecheck focal/productivo PASS. El resultado externo posterior supera el bloqueo de entorno del checkpoint histórico, sin borrar aquel historial ni atribuir a Codex la ejecución manual. En esta corrección documental no se ejecutaron suites ni PostgreSQL.

Target aprobado de A: **5 SP**; sin Commitment, Forecast ni Actual establecidos. 01C-B y 01C-C permanecen pendientes, al igual que el orden global de locks y los gates de concurrencia. El 13/13 corresponde al contrato de A y no acredita esos gates ni activa la corrección de Dispatch. Habilitación operativa pendiente de 01D/01E/01F y gates humanos correspondientes.

M-HC1 **OPEN**; RISK-006 **OPEN / NOT REPRODUCED**; incidente intermitente EQUIPMENT sin causa confirmada; typecheck global conserva el historial **FAIL con 70 errores reportados**, sin nueva ejecución ni aceptación automática. Sin cutover ni producción habilitada.

**Veredicto documental: READY.** P2 resuelto; integración pendiente.
