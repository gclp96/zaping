# HC-DSP-COR-01B — Persistence & Witness

Fecha de actualización: 2026-10-20. Rama: `feat/hc-dsp-cor-01b-persistence`. Base: `619c9b6` (PR #101 integrado).

Estado: Persistence & Witness implementado. QA externo PostgreSQL 16.15 aislado: **Persistence 29/29 PASS**; **Hardening 37/37 PASS sin instrumentación en dos ejecuciones completas consecutivas**. Persistence y Hardening completaron **66/66 PASS sobre la versión final**, según evidencia comunicada por el responsable. NOWAIT y rechazo específico 55P03 validados. El incidente EQUIPMENT intermitente sigue observado, sin causa raíz confirmada ni resolución demostrada. Revisión humana y PR pendientes; no DONE ni habilitación operativa. Sin commit, push, PR, despliegue o cutover; Codex no ejecutó PostgreSQL.

Contrato: `HC_DSP_COR_01B_TICKET.md`, TD V0.8 y aprobación 01A, más autorización de implementación con condiciones. `RISK-006`: **OPEN / NOT REPRODUCED**, causa desconocida. Pasar tests no cambia ese estado.

## Alcance implementado

- Prisma: `HealthcareCaseDispatchCorrection` y `HealthcareCaseDispatchCorrectionItem`, inversas explícitas, status exclusivo `CONFIRMED` y kind exclusivo `NO_PHYSICAL_HANDOFF`.
- Migración nueva `20261019000000_case_dispatch_correction_persistence`, forward-only y transaccional; sin reconstruir datos ni reemplazar funciones existentes.
- FKs compuestas: Company, Case, Dispatch/CaseKit, fuente DispatchItem, actor, idempotencia, Effects, Positions, Asset, Custody y Events. `RESTRICT` en actualizaciones/borrados de identidades referenciadas.
- Una corrección por `(companyId, dispatchId)` y un item por fuente de esa corrección. No hay UNIQUE de Effect por item: un Effect puede agrupar materiales.
- Contrato SHA-256 v1, comprobación de replay y consulta interna tenant-safe. No se registra provider, módulo, controller, ruta ni writer.
- Fixtures sintéticas y suite PostgreSQL protegida por preflight. Las escrituras físicas están únicamente en helpers de prueba, nunca en código productivo.

No se cambian estado, snapshot, items o auditoría de Dispatch; tampoco servicios ni contratos productivos de Dispatch, RR, Inventory o Equipment. No se implementan compensaciones, devoluciones, cierres productivos, proyecciones, summary o recuperación de capacidad CaseKit.

## Persistencia terminal y staging

Secuencia interna en una sola transacción:

1. Reservar IDs y crear `IdempotencyRecord` con resourceId final, hash y scope propio.
2. Insertar root con snapshot SQL NULL y metadatos definitivos. Son inmutables desde ese INSERT.
3. Insertar exactamente los items de fuentes ACTIVE. Es posible completar campos nullable antes de sellar.
4. Los slices futuros crearán evidencia mediante sus writers autorizados; 01B no los llama.
5. Capturar snapshots de items y asignar el snapshot root **al final**. Ese UPDATE es el único permitido para el root.
6. Los constraints diferidos releen el estado final. Si se fuerzan con `SET CONSTRAINTS ALL IMMEDIATE`, las dependencias ya selladas permanecen congeladas hasta el commit. Un root sin sellar, sin items o sin evidencia completa aborta toda la transacción.

No existe DRAFT de corrección ni bandera provisional durable. El status de staging ya es `CONFIRMED`, pero la fila incompleta no puede superar el commit. Los lectores internos filtran snapshot SQL NULL y no se registran en una ruta pública. No se debe leer staging mediante este repositorio dentro de un comando futuro.

Los guards de items bloquean el root con `FOR UPDATE`; rechazan inserciones o cambios posteriores al sello, cambios de identidad y todo DELETE. Root/items rechazan TRUNCATE. Los registros del nuevo scope de idempotencia son inmutables: resourceId debe conocerse antes del INSERT. No se amplían guards para scopes existentes.

`DispatchCorrection_complete` valida el agregado final en los eventos de INSERT y sello del root (dos evaluaciones por transacción normal, independientes del número de items). `DispatchCorrectionItem_complete` hace comprobación local del item/sello. No se ejecuta un barrido completo por evento de item. Los totales MATERIAL originales y compensatorios se agrupan en CTEs materializadas; cada snapshot captura sólo sus líneas fuente/destino, incluyendo la línea compartida agregada cuando corresponda.

### Hardening HIGH — cierre de la ventana IMMEDIATE

La auditoría Pre-QA encontró que drenar los eventos del root con `SET CONSTRAINTS ALL IMMEDIATE` permitía intentar cambios posteriores de dependencias sin otra validación del root. Se conserva la relectura diferida y se cierra esa ventana mediante un sello transaccional localizado:

- `creationTransactionId xid8`, default `pg_current_xact_id()`, inmutable y comprobado por trigger BEFORE INSERT. Prisma lo declara `Unsupported("xid8")` con default SQL: no aparece como estado/campo público en el cliente generado. Se rechaza el INSERT de un root ya sellado o con identificador de otra transacción.
- Se exige READ COMMITTED sólo para crear correcciones. Coincide con el protocolo mutador existente de Dispatch/RR/Physical Inventory y evita lecturas de RR/dependencias anteriores al lock bajo RepeatableRead. Las lecturas históricas RepeatableRead siguen admitidas.
- Al sellar, se toman locks deterministas `NOWAIT`: Dispatch; actor con `FOR NO KEY UPDATE`; Positions, Effects, Lines, Asset y Custody referenciados. Un conflicto devuelve `55P03` y obliga a rollback; no se interpreta como duplicado ni se introduce una espera circular. Los FKs existentes sobre Asset/Effect/Dispatch también serializan inserciones concurrentes de Events/Lines/RR. No se activa todavía el protocolo operacional completo de 01C–01F.
- Triggers nuevos, independientes de los existentes, comprueban únicamente la cohorte `creationTransactionId = pg_current_xact_id_if_assigned()` con snapshot sellado y la referencia afectada. Protegen Effect/Line/Position, Asset/Custody/Event, rol/identidad del actor y RR del Dispatch. UPDATE de otros datos del actor sigue permitido. No recalculan el agregado por cada fila física.
- Las Lines no tienen FK entrante desde el witness: su TRUNCATE también se rechaza sólo si hay material sellado de una corrección creada en esa transacción. En los otros casos se conserva el contrato Inventory existente; no se añade inmutabilidad general de historial.
- Antes del sello se permiten staging y completitud. Después del commit, el `xid8` ya no coincide con otra transacción y estos triggers no bloquean operaciones físicas legítimas posteriores. No se utiliza `xmin` de 32 bits, contadores mutables, tablas de registro ni variables de sesión manipulables.

La elección de `xid8` cubre creación y mutaciones dentro de SAVEPOINTs, ya que PostgreSQL devuelve el identificador de la transacción superior y conserva la época. Referencias: [funciones de transacción PG16](https://www.postgresql.org/docs/16/functions-info.html#FUNCTIONS-PG-SNAPSHOT), [implementación oficial de `pg_current_xact_id`](https://raw.githubusercontent.com/postgres/postgres/REL_16_STABLE/src/backend/utils/adt/xid8funcs.c).

Además, el validator rechaza Effects del namespace de la corrección que no estén referenciados por ningún item. SQL NULL, JSON null, escalares/arrays y fecha malformada se rechazan explícitamente antes de operar o castear el snapshot root, con `23514`.

Justificación del cierre: o bien el testigo no está sellado y sigue pendiente su validación completa, o está sellado y las dependencias relevantes ya no pueden cambiar dentro de su transacción. Forzar las constraints a IMMEDIATE no elimina esa protección. Los locks cubren cambios concurrentes de las referencias; el testigo histórico se libera de la protección transaccional al commit. La migración y los casos de hardening originales superaron el QA externo aislado. La contención NOWAIT entre conexiones y el rechazo específico 55P03 superaron el QA externo de Persistence (29/29). La versión final completó 66/66 PASS; Hardening obtuvo además dos ejecuciones completas consecutivas PASS sin instrumentación.

## Evidencia e identidad histórica

El actor original se obtiene del Dispatch confirmado; el actor de corrección tiene FK tenant-safe propia. Al finalizar, se exige rol actual ADMIN/MANAGER del corrector y se fija ese rol en su snapshot; una modificación futura del rol no reautoriza ni reescribe el testigo.

- MATERIAL original: `CASE_DISPATCH / CONFIRM_QUANTITY`, actor original, identidad Product/batch, AVAILABLE original, CUSTODY con contexto del DispatchItem, revisión y cantidades originales.
- MATERIAL compensatorio: `CASE_DISPATCH_CORRECTION / COMPENSATE_NO_HANDOFF_QUANTITY`, actor/hash/fecha de corrección, débito exacto de cada CUSTODY original hasta cero, revisión consecutiva y crédito AVAILABLE agregado por Effect/Position. Se rechazan líneas ajenas aunque estén balanceadas.
- EQUIPMENT original: Asset/Case/Assignment/episodio exactos, `CUSTODY_OPEN / CASE_DISPATCH_ITEM / CONFIRM_EQUIPMENT`, actor de Dispatch y revisión original.
- EQUIPMENT compensatorio: `CUSTODY_CLOSE / CASE_DISPATCH_CORRECTION_ITEM / COMPENSATE_NO_HANDOFF_EQUIPMENT`, actor/hash/fecha de corrección, cierre del episodio exacto, CUSTODY→WAREHOUSE y revisión consecutiva. Condición y lifecycle se preservan. Cualquier otro evento posterior a la apertura presente al commit hace fallar el testigo.

Al commit, las posiciones MATERIAL deben concordar con cantidades y revisiones posteriores de las líneas compensatorias; CUSTODY queda en cero. El Asset debe concordar con el cierre: WAREHOUSE, sin activeCustodyId, revisión, condición y lifecycle posteriores exactos. Estas comprobaciones son de creación del testigo; las lecturas/replays futuros siguen siendo históricos y no dependen de ese estado mutable.

Los snapshots de items contienen historia original del DispatchItem, Effect y líneas relevantes, o apertura de custodia/evento, más la evidencia compensatoria exacta. La copia del episodio original excluye `closedAt/closedById`; esos datos pertenecen a la compensación y a su actor. La función SQL `dispatch_correction_item_snapshot` sólo construye JSON histórico; no sustituye los checks de evidencia. Límite por snapshot de item: 256 KiB.

La validación requiere ausencia de RR DRAFT/CONFIRMED y rechaza evidencia física de RR CANCELLED. No cancela ni cambia RR. El lock de Dispatch durante validación no acredita la serialización completa con escritores RR existentes: esa integración sigue pendiente.

## Hash, idempotencia y lectura interna

Scope: `HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF`.

Bytes canónicos: `JSON.stringify` con orden `version:1`, `operation:CORRECT_NO_HANDOFF`, `companyId`, `caseId`, `dispatchId`, `attestedNoHandoff:true`, `reason` normalizado con `trim()`, codificados UTF-8 y SHA-256 hexadecimal. No se incluyen actor actual, key, tokens ni estado físico mutable. Una declaración distinta de true, identidades vacías o motivo inválido se rechazan antes de calcular el hash. SQL también exige atestación, motivo, versión y formato hash, además de enlace exacto de registro/recurso/empresa/hash/scope.

El repositorio busca por Company/Case/Dispatch, devuelve snapshots persistidos y no une balances o Asset actuales. Mismo key/hash devuelve el testigo original; distinto hash produce `ConflictException` 409. Enlace inconsistente falla cerrado. No se implementa aún adquisición de claims ni comando de escritura. Una nueva key no autoriza otra corrección: UNIQUE por Dispatch sigue siendo la barrera durable.

## Compatibilidad y decisiones para revisión humana

1. Se conservaron literalmente los validators y triggers de `20261016000000_deferred_validation_scalability`. No hay modificación global de contratos físicos.
2. Inventory declara historial append-only por caminos soportados, sin guards generales UPDATE/DELETE/TRUNCATE. 01B conserva esa decisión: el snapshot del testigo es inmutable y la evidencia se verifica al commit, pero no promete impedir reconstrucciones SQL no soportadas sobre tablas físicas. Endurecerlas globalmente requiere contrato y aprobación separados.
3. Equipment mantiene sus constraints de custodia/Asset y eventos append-only. Las fixtures actualizan estado físico sintético en la misma transacción; 01D debe hacerlo mediante su adapter, preservando el guard temporal existente. No se modifica RISK-006.
4. Prisma requiere índices únicos compuestos adicionales para reconocer relaciones uno-a-uno de Dispatch e idempotencia. Son redundantes respecto de la unicidad empresarial, deliberados y documentados; no se relajan FKs existentes.
5. Se agregan nombres concretos de scope/orígenes, estructura exacta de snapshots, sello por snapshot y límite de 256 KiB. Quedan sujetos a revisión humana del diff y evidencia PostgreSQL; no autorizan activación de writers o cambios de API.
6. La fecha tiene default servidor y comprobación de rango histórico; el writer futuro debe asignar la misma fecha servidor a root, Effect/Event y cierre, como hacen las fixtures. La DB no puede probar el hecho humano negativo de ausencia física de entrega.
7. Fences, autoridad PHYSICAL, locks operativos, carreras RR, read model y gates integrales 01C–01F siguen pendientes. No existe certificación operativa ni release gate satisfecho.

## QA y remediación final Pre-PR — 2026-10-20

La evidencia PostgreSQL siguiente fue comunicada por el responsable desde PowerShell autorizado; Codex no ejecutó PostgreSQL durante esta remediación. No se convierten pruebas preparadas, omitidas o simulaciones unitarias en PASS PostgreSQL.

| Gate                                             | Resultado y alcance                                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Migraciones PostgreSQL                           | PASS histórico externo, PostgreSQL 16.15 en contenedor zaping-hc-cor-01b-pg, 127.0.0.1:5435, DB zaping_hc_dsp_cor_01b_test |
| Persistence PostgreSQL original                  | 27/27 PASS histórico externo, anterior a la remediación de aserciones                                                      |
| Hardening PostgreSQL original                    | 37/37 PASS histórico externo; instrumentación temporal retirada                                                            |
| QA PostgreSQL histórico total                    | 64/64 PASS en las dos ejecuciones comunicadas                                                                              |
| Versión remediada de Persistence                 | **29/29 PASS**, QA externo comunicado                                                                                      |
| Hardening final sin instrumentación              | **37/37 PASS en dos ejecuciones completas consecutivas**, QA externo comunicado                                            |
| QA PostgreSQL final                              | **29 Persistence + 37 Hardening = 66/66 PASS**, versión final sin instrumentación                                          |
| NOWAIT de dos conexiones                         | PASS externo en Persistence; rechazo específico **55P03**                                                                  |
| Unitarios 01B actuales                           | PASS, 153 tests / 5 suites; sin PostgreSQL                                                                                 |
| Regresión Dispatch/RR y unitarios 01B            | PASS, 330 tests / 11 suites, sin PostgreSQL                                                                                |
| Typecheck focal                                  | PASS, test/tsconfig.dispatch-correction.json                                                                               |
| ESLint focal y global API                        | PASS, cero errores/warnings; ejecución sin --fix                                                                           |
| Build API                                        | PASS, nest build ejecutado en esta remediación                                                                             |
| Typecheck global de specs                        | **FAIL**, 70 diagnósticos preexistentes, sin nuevas localizaciones; excepción **PENDIENTE DE ACEPTACIÓN HUMANA**           |
| Prisma validate/generate y build/lint anteriores | PASS histórico documentado en el checkpoint previo; no equivalen a una nueva ejecución PG                                  |

### Rechazos estrictos y clasificador Prisma

Persistence usa assertCorrectionRejection del helper compartido. Cada escenario exige un diagnóstico contractual exacto o una constraint concreta (y target exacto de P2002 cuando corresponde). No basta con que una excepción mencione Correction. Unitarios prueban explícitamente que P2028, P2024, P1001, P2034, 55P03, 40P01, 57014 y 42702 no satisfacen un rechazo de integridad, aunque el mensaje contenga el modelo o el diagnóstico esperado. También se rechazan otros FKs/CHECKs, targets ajenos y operaciones resueltas.

Para PrismaClientUnknownRequestError sin SQLSTATE se exige una instancia real y una cadena completa permitida: diagnóstico exacto, o el prefijo exacto "Error in connector: Error querying the database: ERROR: " seguido del diagnóstico exacto. Se rechazan prefijos falsos, espacios/saltos de línea adicionales, contenido extra y errores genéricos. No se inventa 23514: code permanece null. El prefijo fue contrastado con Prisma 6.19.3 y el motor instalado c2990dca591cba766e3b7ef5d9e8a84796e47ab7 (formatters CoreError, QueryError y PostgresError); 56 caracteres de prefijo + 52 del diagnóstico observado = 108.

Los CHECK nombrados dentro de envelopes serializados se reconocen por el identificador completo del diagnóstico decodificado y su contexto sintáctico, conservando SQLSTATE y procedencia Prisma; metadata contradictoria, nombres parciales y errores de transporte se rechazan. Las regresiones unitarias reproducen las constraints DispatchCorrectionItem_shape y DispatchCorrection_shape.

### Casos PostgreSQL de remediación validados externamente

1. Fuente DispatchItem de otro Dispatch dentro de la misma Company/Case/CaseKit: dos confirmaciones válidas mediante la fixture existente, identidades comprobadas y un INSERT raw que debe fallar específicamente por HealthcareCaseDispatchCorrectionItem_sourceDispatchItemId__fkey (23503). La variante foreign-tenant también exige esa FK, evitando dos fallos de identidad simultáneos. Se conserva por separado el intento de adjuntar un hijo de otra empresa a nuestro root, con rechazo exacto del guard Correction sealed or missing parent. Se verifica rollback y posiciones intactas.
2. NOWAIT real del sello: dos PrismaClient de conexión única, PIDs distintos, barreras de adquisición/liberación y observación de pg_locks. El titular mantiene FOR NO KEY UPDATE sobre el corrector: es compatible con las FKs KEY SHARE del staging, pero incompatible con el lock del sello. El contendiente demuestra root/items/claim/Effect presentes provisionalmente y solicita el sello real mediante UPDATE raw; se exige SQLSTATE 55P03 y el diagnóstico específico de imposibilidad de obtener el lock de la fila User. lock_timeout se desactiva para no confundir su expiración con NOWAIT. Se comprueban cero parciales, restauración de posiciones/historia, finalización exitosa de la transacción titular y reacquisición del lock tras liberarla. Los deadlines sólo limitan la sincronización; nunca se aceptan como rechazo válido. No hay sleeps arbitrarios ni modificación SQL productiva.

Los 37 casos de hardening conservan sus aserciones: conjunto ACTIVE/EXCLUDED exacto, NULL SQL/JSON, snapshots, evidencia ajena, ALL IMMEDIATE, savepoints, xid8, lecturas RepeatableRead históricas y operaciones legítimas posteriores. La carrera de duplicados conserva conexiones independientes, pg_blocking_pids y rechazo específico por unicidad.

### Incidente EQUIPMENT y retirada del diagnóstico

Se observó una ejecución completa Hardening con 36 PASS / 1 FAIL: Correction equipment evidence incompatible durante la creación inicial del witness del caso allows later physical operations in a new transaction and replays the unchanged witness. El mismo caso aislado obtuvo 1/1 PASS. No hay causa raíz confirmada; no se declara resuelta la intermitencia.

Ejecuciones externas posteriores con instrumentación: suite completa 37/37 PASS, subconjunto de nueve mutaciones previas más el caso EQUIPMENT 10/10 PASS y caso aislado 1/1 PASS. Última observación: observedRows=1, falseOrUnknownPredicates=[], additionalEvents=0; custodyElapsedMs=+33, eventElapsedMs=+26, closeToConfirmationMs=0 y custodyToConfirmationMs=0. Todos los predicados observados fueron válidos; estos datos no explican el fallo anterior ni demuestran ausencia de intermitencia. La consulta añadida podía modificar los tiempos de ejecución.

Se retiró completamente el hook afterSeal de diagnóstico y sus logs temporales, restaurando la llamada original con key. Se mantienen fixtures, fechas, invariantes y aserciones, con 29 casos Persistence y 37 Hardening. Posteriormente, Hardening obtuvo **37/37 PASS en dos ejecuciones completas consecutivas sin instrumentación**; Persistence obtuvo **29/29 PASS**, completando **66/66 PASS sobre la versión final**. Esto acredita los resultados observados y no identifica causa raíz ni demuestra resuelta la intermitencia. Revisión humana y PR pendientes.

### Evidencia TypeScript

[Artefacto baseline/current con diagnósticos completos](CASE_DISPATCH_CORRECTION_01B_TYPECHECK_BASELINE.json): baseline 619c9b6, mismas dependencias instaladas, tipos Prisma generados sólo en memoria. Comparación reproducible sin escrituras ni PostgreSQL mediante node --expose-gc test/helpers/dispatch-correction-typecheck-baseline.cjs. El exit 0 del comparador indica ausencia de nuevas localizaciones, **no** typecheck global PASS. Comparación repetida tras esta remediación: 70 baseline / 70 actuales, cero localizaciones añadidas o eliminadas, tipos instalados idénticos a los actuales en memoria y arrays guardados coincidentes. Se mantienen 70 errores; 69 mensajes idénticos y una variación de relaciones Prisma en el TS2345 preexistente de test/inventory-opening.postgres.e2e-spec.ts:476. No se corrigen archivos ajenos a 01B. **Excepción pendiente de aceptación humana:** el gate global permanece FAIL y no se considera dispensado por los PASS focales. La revisión debe aceptar expresamente esta deuda preexistente antes de autorizar commit/PR; esta preparación documental no concede la excepción.

### QA final externo y comandos de reproducción

Preflight obligatorio: CASE_DISPATCH_CORRECTION_TEST_DATABASE_URL, autorización HC_DSP_COR_01B_DATABASE_AUTHORIZATION con el marcador HC-DSP-COR-01B isolated QA authorized, CASE_DISPATCH_CORRECTION_TEST_RUN y RUN_CASE_DISPATCH_CORRECTION_POSTGRES=1. Sin fallback a DATABASE_URL ni .env. El helper fija host 127.0.0.1, puerto 5435, DB zaping_hc_dsp_cor_01b_test y rol hc_dsp_cor_01b_test. La conexión real verifica DB/rol/owner, PostgreSQL 16, marcador, ausencia de privilegios elevados y Companies ajenas. Unitarios rechazan 5432, 5434 y otros puertos.

Las cuatro variables estaban ausentes en el proceso Codex al preparar este checkpoint. Ejecutar desde la terminal local ya autorizada, sin imprimir valores de credenciales ni URLs. No requiere nuevas migraciones ni reset.

Desde app/api, los dos casos de remediación ya superaron QA externo; este comando permite su repetición focal:

```powershell
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --no-cache --cacheDirectory C:/dev/zaping/app/api/node_modules/.cache/hc-dsp-cor-01b-jest --runTestsByPath test/case-dispatch-correction-persistence.postgres.e2e-spec.ts --testNamePattern 'same-tenant-other-dispatch|seal NOWAIT'
```

La regresión focal final sin instrumentación completó 66/66 PASS, según el responsable; comando de reproducción (no ejecutado por Codex):

```powershell
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --bail=1 --no-cache --cacheDirectory C:/dev/zaping/app/api/node_modules/.cache/hc-dsp-cor-01b-jest --runTestsByPath test/case-dispatch-correction-persistence.postgres.e2e-spec.ts test/case-dispatch-correction-hardening.postgres.e2e-spec.ts
```

Conservar salida saneada de preflight, versiones, fecha, comandos, conteos y checksum de la migración aplicada. Si falla un caso, registrar el código/constraint observado antes de modificar expectations. Las fixtures permanecen exclusivamente en la DB QA; la liberación de locks usa finally y desconexión de clientes, sin borrados ni TRUNCATE de limpieza.

### Límites y decisiones pendientes

- La instalación aislada no acredita tiempos ni locks sobre una base poblada. El CREATE UNIQUE INDEX no concurrente sobre IdempotencyRecord y los nuevos triggers requieren ensayo con volumen representativo, presupuesto de locks y plan de despliegue autorizado; este ticket no autoriza ejecutarlo.
- Verificar checksum final de la migración y coordinar cliente Prisma regenerado/nuevo enum antes de futuros writers. Editar el archivo fuente no actualiza funciones ya instaladas.
- Las carreras completas contra Inventory, Equipment Inspection/Retirement y RR CREATE/CANCEL/CONFIRM, nuevas evidencias de otro escritor y proyecciones pertenecen a 01C–01F. Los resultados PostgreSQL comunicados y la prueba NOWAIT no certifican esa integración ni el release operativo.
- Fixtures MATERIAL actuales usan lotTracking NONE; batches, condiciones Equipment distintas de GOOD y cargas grandes requieren cobertura integral posterior.
- Effects agrupados válidos están cubiertos. Una línea AVAILABLE compartida por dos fuentes del mismo Product/batch no está admitida por el comando actual (Requirement Company/Case/Product único, Kit/item únicos y Dispatch_material_active_source_key). No se fabrican fuentes incoherentes para forzar ese caso; los SUM defensivos permanecen.
- No hay endpoints, providers registrados, writers productivos, transferencias ni cierres Equipment activados. No se modifican Dispatch/RR/Inventory/Equipment productivos ni Project Board. Revisión humana pendiente; no DONE. RISK-006 permanece **OPEN / NOT REPRODUCED**.

## Archivos del cambio

Modificados: `app/api/prisma/schema.prisma`, `docs/project/HC_DSP_COR_01B_TICKET.md`.

Creados:

- `app/api/prisma/migrations/20261019000000_case_dispatch_correction_persistence/migration.sql`.
- `app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.contract.ts` y `.contract.spec.ts`.
- `app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.repository.ts` y `.repository.spec.ts`.
- `app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.authorization.spec.ts`.
- `app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.pg-failure.spec.ts`.
- `app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.hardening-structure.spec.ts`.
- `app/api/test/case-dispatch-correction-persistence.postgres.e2e-spec.ts`.
- `app/api/test/case-dispatch-correction-hardening.postgres.e2e-spec.ts`.
- `app/api/test/helpers/dispatch-correction-fixture.ts`, `dispatch-correction-grouped-fixture.ts`, `dispatch-correction-postgres-authorization.ts`, `dispatch-correction-witness.ts`.
- `app/api/test/helpers/dispatch-correction-pg-failure.ts`, `dispatch-correction-typecheck-baseline.cjs`.
- `app/api/test/tsconfig.dispatch-correction.json`.
- `docs/modules/healthcare/CASE_DISPATCH_CORRECTION_01B_TYPECHECK_BASELINE.json`.
- Este documento.

`output/`, `tmp/`, credenciales, `.env` y stash anterior no se modificaron. No se hicieron commit, push o PR. Los archivos nuevos siguen sin staging; `git diff --stat` normal sólo enumera archivos tracked, por lo que debe acompañarse con `git status --short`.

## Preparación para aprobación humana y staging

Inventario auditado: **21 archivos (2 tracked modificados y 19 untracked)**. Sólo los dos documentos de 01B se modificaron en este checkpoint. La revisión del diff Prisma y de todos los archivos nuevos no encontró endpoints públicos, registros de módulo/provider ni writers productivos. Los únicos archivos nuevos productivos son contrato/hash y repositorio de lectura interno; el resto es persistencia, pruebas, helpers y evidencia. Los servicios existentes no están modificados.

Excluir output/, tmp/, .env, credenciales, stash, dependencias instaladas, caches y dist. No usar git add . ni git add -A. El estado global contiene output/ y tmp/ sin seguimiento; no se inspeccionan ni incorporan al PR.

Comandos propuestos desde C:/dev/zaping, **sólo después de aprobación humana** (no ejecutados):

```powershell
$hc01bFiles = @(
  'app/api/prisma/schema.prisma',
  'docs/project/HC_DSP_COR_01B_TICKET.md',
  'app/api/prisma/migrations/20261019000000_case_dispatch_correction_persistence/migration.sql',
  'app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.authorization.spec.ts',
  'app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.contract.spec.ts',
  'app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.contract.ts',
  'app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.hardening-structure.spec.ts',
  'app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.pg-failure.spec.ts',
  'app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.repository.spec.ts',
  'app/api/src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.repository.ts',
  'app/api/test/case-dispatch-correction-hardening.postgres.e2e-spec.ts',
  'app/api/test/case-dispatch-correction-persistence.postgres.e2e-spec.ts',
  'app/api/test/helpers/dispatch-correction-fixture.ts',
  'app/api/test/helpers/dispatch-correction-grouped-fixture.ts',
  'app/api/test/helpers/dispatch-correction-pg-failure.ts',
  'app/api/test/helpers/dispatch-correction-postgres-authorization.ts',
  'app/api/test/helpers/dispatch-correction-typecheck-baseline.cjs',
  'app/api/test/helpers/dispatch-correction-witness.ts',
  'app/api/test/tsconfig.dispatch-correction.json',
  'docs/modules/healthcare/CASE_DISPATCH_CORRECTION_01B_TYPECHECK_BASELINE.json',
  'docs/modules/healthcare/CASE_DISPATCH_CORRECTION_PERSISTENCE_01B.md'
)
git add -- $hc01bFiles
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached
git commit -m "feat(healthcare): persist immutable dispatch correction witnesses"
```

Antes del commit, comprobar que el staging contiene exclusivamente este inventario y aceptar expresamente la excepción de typecheck global FAIL y el riesgo EQUIPMENT sin causa raíz confirmada. No ejecutar commit si aparece un archivo ajeno o si la revisión no está aprobada. No se propone push ni creación automática de PR.

Resumen de PR propuesto:

- Título: HC-DSP-COR-01B: Persistence & Witness terminal tenant-safe.
- Cambio: testigo completo e inmutable de corrección de Dispatch sin entrega física, fuentes ACTIVE exactas, evidencia MATERIAL/EQUIPMENT, FKs compuestas, unicidad, staging y validación diferida. Hash/idempotencia y lectura interna, sin endpoint ni writer productivo.
- Validación: PostgreSQL 16.15 aislado, Persistence 29/29 y Hardening 37/37; Hardening limpio PASS en dos ejecuciones consecutivas; NOWAIT 55P03. Unitarias 153/153; typecheck focal, lint y build API PASS previamente reportados. Typecheck global specs FAIL (70 preexistentes, sin nuevas localizaciones), excepción pendiente de aceptación humana.
- Riesgos: incidente EQUIPMENT anterior sin causa raíz, aunque las repeticiones limpias pasan; base poblada y locks de despliegue no acreditados; futuros writers físicos/RR requieren integración posterior. RISK-006 OPEN / NOT REPRODUCED. No DONE ni cierre de M-HC1.
