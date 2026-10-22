# HC-DSP-COR-01C — MATERIAL QUANTITY Compensation

**Estado actual:** HC-DSP-COR-01C permanece como ticket principal activo, con el siguiente foco en el refinamiento de 01C-C. **01C-A: DONE / MERGED — PR #105, Target 5 SP completados. 01C-B: DONE / MERGED — PR #109, Target 5 SP completados. 01C-C: PENDIENTE / NOT READY FOR IMPLEMENTATION — 3 SP preliminares.** Corrección operativa de Dispatch deshabilitada.
**Base del refinamiento:** main@0953883, integrado por PR #104. **Implementación A:** rama feat/hc-dsp-cor-01c-a-inventory-contract desde main@519f0dc.
**Milestone:** M-HC1 OPEN. **Prioridad:** P0 release gate del conjunto.
**Dependencias integradas:** 01A PR #101; 01B PR #102; cierre documental PR #103; refinement PR #104; 01C-A PR #105 (main@2db5d64); cierre A PR #106 (main@10a5327).
**Fuentes:** [TD §19](../modules/healthcare/CASE_DISPATCH_CORRECTION_TECHNICAL_DESIGN.md#19-refinement-01c--decisiones-y-límites-vigentes), [Board](PROJECT_BOARD.md), [workflow](../engineering/DEVELOPMENT_WORKFLOW.md#241-delivery-incremental-y-preparación-verificable).

## Objetivo y alcance

Implementar y revisar, conforme a la DoR específica autorizada, compensación completa MATERIAL CUSTODY → AVAILABLE mediante Inventory Physical y persistencia 01B. Owned total conservado, Product.stock sin incremento, Effects/Lines y testigos auditables, Dispatch original intacto y CaseKit sin restauración automática.

Fuera de alcance: Equipment, ejecución parcial mixta, callers públicos, endpoints, activación, cutover y producción. No implementar aquí guards/read model de 01E ni reemplazar QA integral 01F. La formalización de PR #104 fue documental. La autorización de A permitió su adapter y QA acotada. La autorización posterior de 01C-B permite exclusivamente el comando interno MATERIAL-only y sus once archivos; no permite ejecutar PostgreSQL automáticamente ni habilitar la operación. Estado actual de B y requisitos de QA manual al final.

## Decisiones vinculantes

- Adapter interno específico de hash/fecha; sin overrides generales ni cambios de comportamiento en writers existentes. Comprobar creación, búsqueda y replay de Effects conjuntamente.
- Locks candidatos y detalle transaccional en TD §19; orden final pendiente de validación real PostgreSQL. Inspección no equivale a aprobación del orden.
- Product/Batch no elegibles siguen rechazándose. Vencimiento/desactivación después de Dispatch puede impedir compensar; no hay bypass autorizado.
- Replay entre actores sólo con autorización actual válida, misma Company e intención idéntica, conservando actor histórico. Distinta key sobre Dispatch corregido: conflicto estable, cero nueva compensación.
- Rechazo íntegro de Equipment ACTIVE; ninguna corrección parcial ni caller público. Sin activar flujo hasta integrar 01D, 01E y 01F.

## Slices secuenciales y estimación

| Slice | Alcance / Acceptance Criteria | DoR específica | DoD específica | Riesgo / SP y estado actual |
| --- | --- | --- | --- | --- |
| 01C-A | Contrato Inventory/evidencia: adapter específico; hash/fecha compatibles con 01B en creación, búsqueda y replay; agrupación y conservación; writers existentes sin cambio. Fixtures y negativas definidas antes de implementar. | Cumplir la lista de preparación siguiente. | Contrato implementado y revisado; unitarias e integración focal/PG autorizada acreditan compatibilidad con 01B; regresiones de writers existentes; sin caller productivo. | Core compartido y dos contratos de hash; **DONE / MERGED — PR #105; 5 SP completados (Target 5)**. |
| 01C-B | Orquestación MATERIAL-only: autoridad, locks, claim, transferencia agrupada, proyecciones y witness atómicos; tenant/source/cantidad/revisión exactos; replay; rechazo mixto y RR incompatible; rollback total. | A integrado; contrato de errores y plan de locks/concurrencia revisados; fixtures/negativas de B definidas. | AC probados por unitarias e integración PG autorizada; dormancia verificada; documentación/evidencia revisadas. | Composición transaccional y carreras; **DONE / MERGED — PR #109**; Target **5 SP aprobado y completado**; sin Actual SP recalculados. |
| 01C-C | Concurrencia y cierre: dos conexiones, duplicados, movimientos competidores, rollback, regresiones y evidencia; validar orden final de locks. | B integrado; barreras/diagnósticos y matriz concurrente revisados; entorno PG autorizado. | Matriz focal/concurrente y CI requeridas PASS, o no cerrar el slice; evidencia por commit y límites documentados. Sin atribuir gates 01D/01E/01F. | Sincronización y diagnóstico; **PENDIENTE**; 3 SP preliminares. |

Estimación de referencia original: 13 SP (5/5/3); al cierre, A y B cuentan con Target aprobado de 5 SP cada uno, completados tras DoD y merge; C conserva 3 SP preliminares. Autorizaciones posteriores: A y B tienen Target aprobado de 5 SP cada uno; C conserva 3 SP preliminares. Sin Commitment, Forecast ni Actual. No equivalen a horas ni compromiso de completar los tres slices en un sprint. La estimación responde a adaptación del core compartido (A), transacción de dominio (B) y evidencia concurrente (C). Revisar si cambia el alcance; preservar historial de la estimación. Cada slice lleva QA propia; C no difiere la validación esencial de A/B.

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
| Started | A = 2026-10-20 registrado previamente. B = 2026-10-20, implementación en esta sesión autorizada (America/Hermosillo); no reconstruido de commits. |
| Merged | 01C-A: PR #105, main@2db5d64, 2026-10-20 16:25:23 America/Hermosillo (2026-10-20T23:25:23Z), verificado en Git y GitHub. B/C sin merge. |
| Target SP | A = 5 aprobado y completado. B = 5 aprobado; C = 3 preliminares. |
| Actual SP | Sin reestimación Actual. Se registran **5 SP completados del Target de A**, únicamente por DoD acreditada; no se convierten en horas. |
| Forecast / Commitment | No establecidos. |
| Tiempo estimado / real | No registrados; no convertir SP a horas. Separar esfuerzo y tiempo transcurrido. |
| Bloqueo | Sin medición registrada; capturar inicio/fin, causa, dependencia y resolución cuando existan. Pendientes DoR no implican duración inventada. |
| Retrabajo | Sin medición registrada; capturar motivo, cambio y esfuerzo cuando consten. |
| Evidencia QA | A: 253/253 locales y 13/13 PG externo, CI API/Web SUCCESS, PR #105 merged; cierre abajo. B: 260/260 locales sobre el fix, PostgreSQL externo final 31/31 PASS, 0 skipped, exit 0; CODE REVIEW / QA PASSED / NOT MERGED. Historial completo al final, sin trasladar el PASS de A a B. |

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

## Estado histórico previo al merge — QA externa y cierre del P2

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

## Cierre post-merge de 01C-A — DONE / MERGED

**DoD del slice A acreditada. 01C-A: DONE / MERGED, 5 SP completados correspondientes al Target aprobado de 5 SP.** No se establece Commitment, Forecast, reestimación Actual ni horas trabajadas. Started conserva la fecha ya registrada de 2026-10-20; no se reconstruye ni se añaden tiempos sin evidencia.

[PR #105](https://github.com/gclp96/zaping/pull/105) verificado merged hacia main mediante GitHub y Git local. Commit de integración: **2db5d64596552cb8802cce9c64fac93876dfc251**; commit funcional: **adbbdb63849b4cfd40e7b137f8c7aeacc207ead7**, segundo padre del merge. HEAD de docs/hc-dsp-cor-01c-a-post-merge y main coinciden con la integración al verificar este cierre. Merge confirmado el 2026-10-20T23:25:23Z (16:25:23 America/Hermosillo).

### Comprobación de la DoD de A

| Criterio de DoD del slice | Evidencia y conclusión |
| --- | --- |
| Contrato Inventory/evidencia implementado y revisado | Diez archivos integrados en PR #105; adapter interno específico, compatibilidad 01B, sin cambio de contrato de writers existentes ni caller productivo. Revisión técnica final aprobada en la sesión, sin bloqueos funcionales; también registrada en la descripción del PR. |
| Unitarias, integración focal y regresiones | **253/253 PASS, 11 suites**, ejecutadas localmente por Codex y registradas antes del merge; incluyen 37 pruebas del adapter. No reejecutadas en este cierre. |
| Compatibilidad PostgreSQL real con 01B | **13/13 PASS, exit code 0**, ejecución manual externa del usuario: PostgreSQL 16.15, 127.0.0.1:5436, zaping_hc_dsp_cor_01c_a_test. Codex no ejecutó PostgreSQL. Se conserva arriba el primer intento con 13 FAIL por INCOMPATIBLE_BUILD y la posterior configuración de runtime Inventory. |
| Checks aplicables y CI | Build, lint, formato y typecheck focal/productivo locales PASS reportados. [CI #327](https://github.com/gclp96/zaping/actions/runs/39514031375), sobre adbbdb63849b4cfd40e7b137f8c7aeacc207ead7: completed/success verificado en GitHub; jobs [API](https://github.com/gclp96/zaping/actions/runs/39514031375/job/118941751820) y [Web](https://github.com/gclp96/zaping/actions/runs/39514031375/job/118941752053) completed/success. No atribuir esa ejecución a Codex ni inferir certificación de concurrencia global de corrección. |
| Seguridad, tenant, errores y dormancia | Revisión final y pruebas del alcance A acreditadas; sin endpoints públicos, nueva activación o corrección parcial mixta. No se requiere migración nueva para este slice. |
| Documentación y P2 | P2 documental corregido e integrado en PR #105; QA externa y checkpoint histórico diferenciados. Este cierre sincroniza únicamente ticket y Board. |
| Integración | PR #105 merged, SHAs verificados; por ello se satisface la dependencia de integración de A para refinar B. |

El cierre es del contrato interno A y representa **backend integrado de ese alcance**. No acredita flujo completo demostrable, release-ready o producción habilitada. El typecheck global de specs conserva su historial **FAIL con 70 errores reportados**; los PASS focales y CI no dispensan ni aceptan automáticamente esa deuda. M-HC1 permanece **OPEN**; RISK-006 **OPEN / NOT REPRODUCED**; intermitencia EQUIPMENT sin causa confirmada.

### Transición administrativa histórica hacia 01C-B — cierre PR #106

HC-DSP-COR-01C conserva la condición de único ticket principal activo. **01C-B: REFINEMENT, NO READY FOR IMPLEMENTATION**; ningún nuevo slice se inicia por este cierre. A integrado satisface una dependencia, no toda la DoR de B. Antes de código, concretar orquestación caller-owned y prefijo de autoridad/fence/locks, contrato de errores e idempotencia, persistencia/sello/proyecciones atómicos y fixtures/negativas propias. Revisar el plan de concurrencia y estrategia PostgreSQL autorizada y aprobar el alcance/Target de B. Sus 5 SP siguen preliminares; sin Started ni Commitment/Forecast/Actual nuevos. **01C-C permanece pendiente**, con 3 SP preliminares.

El orden global de locks, carreras reales con escritores Inventory/Dispatch/RR y gates de 01D/01E/01F siguen pendientes. **Corrección operativa de Dispatch deshabilitada**, sin cutover ni autorización de producción. Este cierre documental no modifica código, pruebas o schema; no ejecuta PostgreSQL ni realiza staging, commit, push o PR. Los estados de integración pendiente y bloqueo anteriores se conservan exclusivamente como historia.

## 01C-B — implementación local y gate PostgreSQL

**Estado actual: CODE REVIEW / QA PASSED / NOT MERGED; sin DONE. PostgreSQL externo final 31/31 PASS, 0 skipped, exit code 0.** Rama `feat/hc-dsp-cor-01c-b-material-orchestration`, base verificada `main@10a532714a1634b0fd82e79d82827bfd191cbc1b` (PR #106). Started: **2026-10-20**, fecha local America/Hermosillo de esta sesión. **Target aprobado: 5 SP**; sin Commitment, Forecast, Actual, puntos completados ni tiempo estimado/real registrados. A conserva DONE / MERGED y 5 SP completados; C permanece pendiente. Un principal activo (01C) y un slice en implementación (B).

### Contrato y aceptación local — checkpoint histórico anterior al fix

`HealthcareCaseDispatchCorrectionCommandService.execute(context, intent): Promise<MaterialCorrectionResult>` controla su transacción exterior; no acepta un cliente transaccional externo. Context: companyId, caseId, dispatchId, requesterId, idempotencyKey; intent: attestedNoHandoff:true, reason. Result: replay y witness sellado con items. Contexto/intención se reconstruyen explícitamente; no se trasladan overrides de cantidades, revisiones, posiciones, actor histórico, timestamp ni hash. Clave normalizada de 1–128 caracteres y motivo de 1–1000 puntos de código, hash v1 de 01B.

La secuencia implementada y los límites de sus pruebas están en [TD §21](../modules/healthcare/CASE_DISPATCH_CORRECTION_TECHNICAL_DESIGN.md#21-01c-b--orquestación-interna-material-only). Incluye replay autorizado consistente, fence y autoridad antes de claim/locks de negocio, claim con resourceId definitivo desde INSERT, transacción READ COMMITTED con política HC vigente, adapter A, proyecciones y mappings desde Lines persistidas, snapshots de items y sello final 01B. Una colisión única exacta se clasifica sólo tras rollback en una lectura nueva; errores de transporte, timeout, deadlock y sello nunca se adoptan como un ganador.

| Acceptance Criteria de B | Evidencia local / gate pendiente |
| --- | --- |
| Intención/Unicode, secuencia, autorización y errores; resolver sólo después del commit | Suite del comando PASS. Las transacciones y fallos de secuencia locales son simulados; no prueban commit PostgreSQL. |
| Integrar persistencia 01B y classifier A sin escribir durante replay | Integración focal con clases reales B/01B/A y delegates de lectura simulados PASS; conserva actor/fecha históricos. SQL de snapshots simulado; prueba real en E2E pendiente. |
| MATERIAL completo, conservación owned/Product.stock, Batch AVAILABLE, fuentes y mapping exactos, sello | Implementado usando A sin cambios; tests locales de mapping y discrepancia entre resultado y Lines persistidas PASS. Casos PostgreSQL simple/agrupado/Batch preparados; no acreditados todavía. |
| Tenant, autorización vigente, estado, RR y Equipment ACTIVE | Negativas locales y regresiones PASS. RR no filtra por lifecycle de items: también examina Effects de excluidos; no auto-cancelación. Negativas PostgreSQL preparadas. |
| Claim inmutable, idempotencia, rollback por fase y duplicado básico | Unitarias PASS; rollback total real y dos conexiones con barrera/PID distintos pendientes de suite PostgreSQL B. No diferir estos gates esenciales de B a C. |
| Dormancia y compatibilidad de writers existentes | Guard de integración extendido sólo a los tres archivos internos nuevos; ausencia de registro en App/Dispatch/RR modules comprobada. Regresiones Inventory/Dispatch/RR PASS; ningún writer existente modificado. |

### QA histórica ejecutada por Codex en la implementación inicial — anterior al fix

Resultados sobre base indicada + diff local sin commit; **ninguna ejecución PostgreSQL**.

| Validación | Resultado |
| --- | --- |
| Comando B, integración focal B/01B/A y guard Physical | **62/62 PASS, 2 suites**; 37 del comando B y 25 Physical. Incluidas en el total siguiente, no sumar dos veces. |
| Inventory Physical + corrección + Dispatch + Reconciliation | Primera ejecución: **711 PASS / 136 FAIL, 29 suites**; los 136 fallos corresponden exclusivamente a dos suites HTTP con `connect EACCES 127.0.0.1`, restricción de sockets del sandbox. |
| Repetición exclusiva de ambas suites HTTP con permiso de sockets | **136/136 PASS, 2 suites**, exit 0. Con los 711 anteriores: **847/847 casos únicos PASS, 29 suites**, en dos ejecuciones; no afirmar una ejecución conjunta totalmente PASS. |
| Typecheck focal specs + E2E preparados | PASS: `node node_modules/typescript/bin/tsc --noEmit -p test/tsconfig.dispatch-correction.json`. |
| Typecheck productivo | PASS: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.build.json`. |
| ESLint / Prettier del inventario TypeScript | PASS, ocho archivos; ESLint sin `--fix`. |
| Build API | PASS: `node node_modules/@nestjs/cli/bin/nest.js build`. |
| PostgreSQL B / CI nueva / integración | **BLOCKED / NOT EXECUTED** para PG; CI no ejecutada por esta sesión, integración pendiente. El PASS PostgreSQL externo 13/13 de A no acredita B. |
| Typecheck global specs | No reejecutado: **FAIL histórico, 70 errores reportados**; el PASS focal no elimina ni acepta la excepción. |

Comando de regresión desde `app/api`:

```powershell
node node_modules/jest/bin/jest.js --runInBand --no-cache --cacheDirectory C:/dev/zaping/app/api/node_modules/.cache/hc-cor-01c-b src/inventory/physical src/healthcare/case-dispatch-corrections src/healthcare/case-dispatches src/healthcare/case-reconciliations
```

La repetición HTTP usó el mismo prefijo y `--runTestsByPath src/healthcare/case-dispatches/healthcare-case-dispatches.controller.spec.ts src/healthcare/case-reconciliations/healthcare-case-reconciliations.controller.spec.ts`. Los tests de controllers usan persistencia simulada; no conectan a PostgreSQL.

### PostgreSQL B — preparación histórica anterior a la ejecución externa

**31 casos expandidos preparados y compilados, no ejecutados.** Positivos simple/agrupado/Batch y sello real 01B; actor/tenant/estado; LEGACY/sin control, CUTOVER y RECOVERY_REQUIRED; replay autorizado con Unicode/actor histórico y cambios vivos, conflictos de key; RR DRAFT/CONFIRMED/CANCELLED; Equipment puro/mixto; cantidad/revisión alteradas, salida y reposición intermedia, Product/Batch no elegibles; fallos inyectados después de claim/root/Effect/proyección/items/sello; Effect huérfano; dos conexiones reales previstas con barrera previa al INSERT del claim y PIDs distintos, un solo witness/Effect persistido. Rollback y replay comparan estado completo, no sólo conteos. Los spies de fallo existen exclusivamente en tests.

RR CANCELLED con Effects no es una fixture persistida válida bajo el SQL vigente: no desactivar constraints para construirla. El rechazo defensivo de B incluye items excluidos y se comprueba en la consulta local; los E2E usan episodios RR válidos creados con sus comandos actuales. El caso de autoridad LEGACY usa ausencia de control persistido y debe rechazar antes de claims. Las fixtures reutilizan únicamente builders sintéticos A/01B sin modificarlos; la autorización y conexión son exclusivamente B. No realizan limpieza, reset ni cutover operativo.

Se comprobó sólo presencia, sin imprimir valores: están ausentes las cuatro variables propias `RUN_CASE_DISPATCH_CORRECTION_ORCHESTRATION_POSTGRES`, `HC_DSP_COR_01C_B_DATABASE_AUTHORIZATION`, `CASE_DISPATCH_CORRECTION_ORCHESTRATION_TEST_RUN`, `CASE_DISPATCH_CORRECTION_ORCHESTRATION_TEST_DATABASE_URL`. También faltan en este proceso las tres variables de compatibilidad Inventory. No se consultaron `.env` ni credenciales.

Requisitos para preparación manual autorizada: PostgreSQL **16**, destino dedicado **127.0.0.1:5437**, DB `zaping_hc_dsp_cor_01c_b_test`, owner `hc_dsp_cor_01c_b_test` sin privilegios elevados; comentario de DB `HC-DSP-COR-01C-B isolated QA authorized`; sólo Companies del ticket. El preflight lee identidad/versión/owner/permisos/marcador y rechaza destinos o datos ajenos. Se requiere esquema vigente preparado manualmente; B no necesita migración y esta sesión no aplica ninguna. Esos requisitos no afirman que el entorno ya exista ni autorizan aprovisionarlo.

Opt-in propio `RUN_CASE_DISPATCH_CORRECTION_ORCHESTRATION_POSTGRES=1`, autorización igual al marcador, run identificable y URL propia suministrada externamente. Sin fallback a DATABASE_URL, `.env`, variables/base/credenciales de A o 01B. Configurar `INVENTORY_RUNTIME_BUILD`, `INVENTORY_RUNTIME_ENVIRONMENT` e `INVENTORY_AUTHORITY_PROTOCOL=inventory-authority-v1` conforme al contrato Inventory, y la política HC de integración vigente. Tras autorización/preparación manual, desde `app/api`:

```powershell
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --bail=1 --no-cache --cacheDirectory C:/dev/zaping/app/api/node_modules/.cache/hc-cor-01c-b-pg --runTestsByPath test/case-dispatch-correction-material-orchestration.postgres.e2e-spec.ts
```

Registrar preflight saneado, versión, commit+diff, comando, resultados y exit code. No contar skips como aceptación ni registrar credenciales. **No cerrar B sin su PostgreSQL de atomicidad/duplicados, revisión y CI/integración correspondientes.** Orden global de locks y carreras completas Inventory/Dispatch/RR siguen en C; guards y read models de RR en 01E.

### Inventario y seguimiento

Inventario autorizado: **11 archivos, 7 nuevos y 4 modificados**.

- Nuevos en `app/api/src/healthcare/case-dispatch-corrections/`: `healthcare-case-dispatch-correction-command.contract.ts`, `healthcare-case-dispatch-correction-command.repository.ts`, `healthcare-case-dispatch-correction-command.service.ts`, `healthcare-case-dispatch-correction-command.spec.ts`.
- Nuevos en `app/api/test/`: `case-dispatch-correction-material-orchestration.postgres.e2e-spec.ts`, `helpers/dispatch-correction-material-orchestration-fixture.ts`, `helpers/dispatch-correction-material-orchestration-postgres-authorization.ts`.
- Modificados: `app/api/src/inventory/physical/physical-inventory.contract.spec.ts` y únicamente este ticket, Project Board y Technical Design de corrección.

Bloqueo histórico inicial: entorno/autorización PG B ausentes; duración no medida. Superado por QA manual externa posterior, registrada a continuación. Retrabajo local: corrección de mocks, tipos/formatos de fixtures y repetición HTTP por EACCES, sin esfuerzo/horas medidos. No se repitieron ciclos sin evidencia nueva. No hay nueva retrospectiva de sprint cerrado ni métricas reconstruidas.

Sin ampliación del inventario; sin cambios de schema, SQL, adapter A, módulos, endpoints o writers Dispatch/RR. Sin staging, commit, push, PR, despliegue ni cutover. **M-HC1 OPEN; RISK-006 OPEN / NOT REPRODUCED; intermitencia EQUIPMENT sin causa raíz confirmada; typecheck global histórico FAIL con 70 errores. Corrección operativa deshabilitada** hasta 01D/01E/01F y gates humanos.

## Cierre de evidencia y Code Review final de 01C-B

**Estado actual: CODE REVIEW / QA PASSED / NOT MERGED.** Revisión documental y técnica focal del 2026-10-21 sobre los once archivos del inventario anterior, incluidos los siete nuevos sin seguimiento. Target **5 SP**; sin DONE, Actual SP, puntos completados, Commitment/Forecast ni horas inferidas. HC-DSP-COR-01C sigue como único principal activo; C pendiente. No se modifica código durante esta revisión.

### Cronología de QA — fuentes separadas

| Orden | Ejecución / cambio | Evidencia y límite |
| --- | --- | --- |
| 1 | Implementación inicial; validación local Codex | **847/847 casos únicos PASS en 29 suites**, antes del fix. Primera ejecución: 711 PASS / 136 FAIL por EACCES en dos suites HTTP; repetición con sockets autorizados: 136/136 PASS. No presentar esas 847 como reejecutadas sobre el código corregido. Build API, typecheck focal/productivo, lint y formato iniciales PASS reportados. |
| 2 | Primera suite PostgreSQL manual del usuario | **25 PASS / 6 FAIL, una suite fallida, Jest exit code 1.** La impresión manual posterior `POSTGRESQL QA 01C-B: PASS` no acredita éxito. La investigación identificó el caso RR CANCELLED y el duplicado; no se dispone aquí del detalle individual de los otros cuatro fallos. No inventar su atribución causal. |
| 3 | Investigación y fix B → 01B | B entregaba el contexto completo a 01B, cuyo spread introducía requesterId/idempotencyKey inválidos en el where Prisma. Corregidos exclusivamente command.repository.ts y command.spec.ts: ambos lookups reconstruyen companyId/caseId/dispatchId, sin cambiar autorización, claim, key/hash, adapter o clasificación de concurrencia. |
| 4 | Regresión local del fix, Codex | Aserciones reforzadas reprodujeron la fuga: **8 FAIL / 37 PASS** antes del cambio; después **45/45 PASS** focales y **260/260 PASS, ocho suites afectadas**. Incluye filtros exactos Prisma, identidad claim/witness, intención incompatible y propagación del error original; replay real B/01B/A con delegates de lectura simulados. Typecheck focal/productivo, lint y formato PASS. No PostgreSQL ejecutado por Codex. |
| 5 | Repetición focal PostgreSQL manual del usuario | **2/2 PASS**, confirmados por el usuario; no se reconstruyen nombres, tiempos ni exit code no comunicados para esta ejecución focal. |
| 6 | Ejecución PostgreSQL completa final manual del usuario | **31/31 PASS, 0 skipped, exit code 0**, PostgreSQL **16**, base aislada `zaping_hc_dsp_cor_01c_b_test`, **127.0.0.1:5437**. Fuente: confirmación expresa del usuario. No inventar versión menor, timestamp o SHA de ejecución; evidencia asociada al diff corregido aún sin commit. |
| 7 | Code Review final, Codex | Reejecución local necesaria sobre la versión corregida: **260/260 PASS, ocho suites**, incluye 45 del comando. No sumar ejecuciones repetidas ni mezclar las 847 iniciales. No se ejecutó ni repitió PostgreSQL. Typecheck focal/productivo y build API reejecutados PASS; ESLint y Prettier PASS en los ocho archivos TypeScript, sin --fix. |

El bloqueo PG por variables ausentes del checkpoint inicial es histórico: la ejecución externa posterior acredita el entorno manual del usuario, no disponibilidad ni autorización para ejecutarlo desde Codex. El 31/31 final supera el estado QA FAIL anterior; no demuestra por sí solo que los seis fallos compartían una única causa. A conserva su evidencia externa separada 13/13, no sumada al resultado B.

### Acceptance Criteria revisados

| AC | Resultado del review y evidencia |
| --- | --- |
| Autoridad y secuencia | PASS del alcance B: shared fence → control/PHYSICAL/runtime → claim definitivo → HC Company lock → Case/Dispatch/items → A/evidencia/sello. Comprobación local de orden y negativos de autoridad en PG; no certificar ausencia global de inversiones ni carrera con cutover exclusivo. |
| Atomicidad y conservación | PASS: misma transacción exterior READ COMMITTED; proyecciones/items/snapshots/sello y constraints antes de commit; positivos simple/agrupado/Batch y negativos por fase en el 31/31 externo; owned/Product.stock e historia original conservados. |
| Adapter A / metadatos | PASS: se reutiliza sin cambios; hash v1, fecha y actor históricos del root, Unicode y evidencia 01B. Sin overrides generales, migraciones o cambios de contrato de writers existentes. |
| Lookup B → 01B | PASS tras fix: exactamente cinco campos en where de witness (companyId/caseId/dispatchId/status/snapshot); autorización y key en sus operaciones separadas. Aserciones exactas sobre argumentos construidos y comprobación de las identidades claim/witness. |
| Replay e idempotencia | PASS: autorización actual ADMIN/MANAGER/Company, misma intención/key, actor histórico conservado; sin nueva compensación. Intención incompatible y distinta key rechazan; no adoptar errores genéricos como éxito. |
| Colisión y rollback | PASS básico B: clasificación estricta después del rollback, nueva lectura del ganador, sin cliente abortado/retry genérico. Dos conexiones y PIDs diferentes con barrera anterior al INSERT; un resultado nuevo/un replay, una Correction y un Effect en el caso externo PASS. |
| Tenant, cantidades/revisiones/batches, RR y Equipment | PASS del alcance B: fuentes exactas, elegibilidad sin bypass, movimiento/reposición rechazados; RR DRAFT/CONFIRMED bloquean, CANCELLED compatible admitido sin auto-cancelación; Equipment ACTIVE puro/mixto rechaza íntegramente. |
| Dormancia | PASS: clases internas sin decorator/registro Nest/caller público, sin endpoints, schema/SQL/migraciones nuevos, ni modificación de Dispatch/RR writers. No habilitación operativa. |

### Hallazgo y límites de cobertura

No se encontraron hallazgos funcionales P0/P1/P2 que bloqueen B. **P3 no bloqueante — precisión diagnóstica de fault injection:** `app/api/test/case-dispatch-correction-material-orchestration.postgres.e2e-spec.ts:432` define el fallo y `:496` sólo comprueba el error genérico de persistencia y la igualdad del estado. Cada spy llama primero a su fase real, pero no hay aserción explícita de que se alcanzó el throw inyectado; otro fallo previo con el mismo código podría satisfacer la negativa. Los positivos y el 31/31 externo aportan contexto, sin eliminar este límite. Mejora propuesta para revisión humana: comprobar llegada/alcance de cada inyección; no aplicada ni añadida como nuevo ticket durante este review.

La suite acredita los casos listados, no la matriz global de carreras. El duplicado prueba misma key; no sustituye carreras con distinta key/intención, revocación concurrente, Inventory/Dispatch/RR competidores, cutover exclusivo, deadlocks/transportes reales o timeout en todas las fases. Esas extensiones y la validación final del orden pertenecen a C; los guards/admission/read models RR siguen en 01E, Equipment en 01D y aceptación integral en 01F. La clasificación de errores sigue siendo conservadora y no devuelve replay para cualquier excepción.

**Pendientes administrativos de B:** aprobación humana, CI aplicable e integración; sin commit/PR ni DONE todavía. No hay bloqueo funcional nuevo identificado. M-HC1 **OPEN**, RISK-006 **OPEN / NOT REPRODUCED**, EQUIPMENT intermitente sin causa raíz confirmada y **70 errores históricos del typecheck global**, no reejecutado ni dispensado. **Corrección operativa deshabilitada.**

Validación documental final: `git diff --check` sin diagnósticos de whitespace, incluidos los siete archivos nuevos mediante comparación no-index; inventario exacto de once archivos. Sólo se editaron los tres documentos autorizados en esta revisión; los ocho archivos TypeScript se conservaron byte a byte. **Veredicto: READY FOR COMMIT APPROVAL**, sin preparar staging, commit o PR. No equivale a DONE ni a aprobación de producción.

## Cierre post-merge de 01C-B — DONE / MERGED (2026-10-22)

**Confirmación de integración:** [PR #109](https://github.com/gclp96/zaping/pull/109) MERGED a `main`, merge SHA `7ee270b6a11cadea284801ab76d634226b7add36`; commit funcional tras rebase `1fd9b004817b5c1c0caf3927258e5f77d541d86b`. Started 2026-10-20, Merged 2026-10-22 (America/Hermosillo). El Target previamente aprobado de **5 SP** se registra como **5 SP completados** por DoD/integración; no se imputan Commitment, Forecast, Actual como reestimación ni horas trabajadas.

**Evidencia conservada, sin reejecución en este cierre documental:** revisión humana del inventario exacto de once archivos y `git diff --cached --check` PASS; QA focal final **260/260 PASS** (ocho suites, incluyendo 45 del comando); PostgreSQL 16 aislado **31/31 PASS**, 0 skipped, exit code 0, ejecución manual declarada por el responsable en `127.0.0.1:5437 / zaping_hc_dsp_cor_01c_b_test`; TypeScript focal/productivo, ESLint, Prettier y build API PASS según el checkpoint previo. [CI #341](https://github.com/gclp96/zaping/actions/runs/39818610916) completó **API SUCCESS / Web SUCCESS** sobre el commit del PR. GitHub confirmó PR mergeable y ausencia de review threads abiertos antes del merge. No se atribuyen las pruebas PostgreSQL a CI ni a Codex.

**Límite de entrega:** B integra exclusivamente el comando interno MATERIAL-only; no registra caller/controlador/endpoints productivos, no ejecuta cutover y no activa Dispatch Correction. El hallazgo **P3 no bloqueante** de precisión de fault injection permanece documentado. Las carreras globales, orden final de locks y QA concurrente pertenecen a **01C-C**, que permanece pendiente de DoR, alcance/Target y autorización para PostgreSQL. Equipment (01D), RR/read models (01E) y release gate integral (01F) siguen en backlog. **M-HC1 OPEN; RISK-006 OPEN / NOT REPRODUCED; intermitencia EQUIPMENT sin causa raíz confirmada; typecheck global histórico con 70 errores sin dispensa formal.** Los checkpoints previos de «NOT MERGED» se conservan arriba como historial anterior a esta integración.
