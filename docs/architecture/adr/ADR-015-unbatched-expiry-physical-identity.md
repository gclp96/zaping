# ADR-015 — Identidad física de existencias sin lote con caducidad

**Estado de decisión:** ACCEPTED (OX-PUR-05B; issues #115 y #116)
**Estado de implementación:** IN PROGRESS — S1–S3b-S validadas en CI; S3b-W1 recepción autorizada implementada, pendiente de revisión y checks del commit; S3b-W2 y S4 pendientes. Consumo y transferencias fechadas no habilitados.
**Fecha:** 2026-10-22
**Área:** Zaping ERP / Compras, Recepciones e Inventory Physical
**PR base:** #114 integrado en `main`

## 1. Problema comprobado (baseline previo a S1)

En INSAP se recibe material válido sin que el proveedor informe lote, número de serie o caducidad. No debemos fabricar estos datos ni impedir una recepción válida sólo porque falten.

Actualmente `ProductLotTracking.REQUIRED` bloquea las entradas sin lote en el writer PHYSICAL y `PhysicalInventoryService.validateKey` exige un Batch también en movimientos posteriores. `SalesPhysicalSourceResolver` rechaza ventas de REQUIRED antes de resolver existencias.

La identidad de `InventoryPosition` y los índices UNIQUE actuales sólo permiten un pool AVAILABLE sin lote por Company/Product; cuando dos recepciones sin lote tienen fechas de caducidad distintas, sumar ambas cantidades hace imposible conocer cuántas unidades de cada fecha se conservan después de una salida parcial.

Guardar la fecha sólo en `PurchaseReceiptItem` NO soluciona la disponibilidad física ni la trazabilidad de consumos.

## 2. Decisión

Ampliar **`InventoryPosition`**, no crear un subledger independiente en esta etapa:

- Para QUANTITY sin lote de fabricante, `inventoryBatchId = NULL`. La identidad se discrimina adicionalmente por **caducidad opcional** (día calendario), separando fecha desconocida (`NULL`) de cada fecha conocida. `NULL` significa _dato desconocido_, no _no caduca_.
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

## 10. Estado por fase y contrato entregado en S2

- **S1:** columna `InventoryPosition.expirationDate DATE NULL`, CHECK de fuente única e índices sin lote implementados en `20261023000001_inventory_position_unbatched_expiry`. CI API/Web SUCCESS sobre `4e6da4a223f2f76f6164868fa4a7950cda84cbc3` ([run #410](https://github.com/gclp96/zaping/actions/runs/39895257442)). No se aplicaron migraciones a bases locales.
- **S2:** `PositionKey.expirationDate?: string | null` acepta exclusivamente día calendario válido `YYYY-MM-DD`; rechaza timestamps, offsets, fechas imposibles y fecha de Position junto con Batch real. Una fecha conocida participa en identidad, agrupación y hash; fecha omitida o `null` conserva exactamente la serialización anterior, sin insertar campos nulos en el hash versión 1. Los hashes de las cuatro operaciones históricas se fijaron antes del cambio como constantes de regresión.
- Repository convierte el día a `DATE` mediante una representación a medianoche UTC exclusivamente para Prisma; esto **no determina elegibilidad ni convierte la caducidad en un instante de vencimiento**. Búsquedas de destino y creación expresan fecha exacta o `NULL` explícito. Fuentes por ID conservan su identidad, y el motor incorpora la fecha persistida al construir sus claves bajo lock.
- **Gate operativo cerrado:** CREDIT, TRANSFER, DEFINITIVE_OUT y COUNT_CORRECTION sobre posiciones con fecha conocida se rechazan antes del claim y de cualquier mutación. Transferencia exige igualdad de la dimensión de caducidad. La clasificación histórica de un Effect ya confirmado permanece anterior a la lectura del estado físico actual. No se habilitan recepción ni consumidores de pools con fecha conocida en esta fase.
- **QA S2:** pruebas unitarias focales y de regresión de motor, adapter de corrección, opening, ventas y recepción; TypeScript productivo y focal de tests; ESLint, Prettier y build API. La suite PostgreSQL de S1 se amplía con 10 casos S2: identidad AVAILABLE/CUSTODY NULL/A/B, crédito/replay histórico y revision stale, cuatro rechazos atómicos, dos verificaciones de locks con clientes/PIDs independientes y crédito concurrente con un único Effect. Se ejecuta exclusivamente sobre el servicio PostgreSQL efímero de CI; no admite ejecución local por su gate de entorno. Consultar los checks del commit S2 en [PR #119](https://github.com/gclp96/zaping/pull/119) para su resultado; preparación de pruebas no equivale a PostgreSQL PASS.
- **S3–S4 pendientes:** elegibilidad validada bajo lock respecto al día local de Company, conservación de fecha en consumidores, recepción autorizada sin lote, selección/FEFO, read models `owned` frente a `usable`, integración y QA completa. No se cambia la obligatoriedad de Batch de los writers actuales, ni se activa la política de ingreso opcional. El PR permanece DRAFT y no se declara el ADR completamente implementado.

## 11. S3a — Política temporal bajo los locks existentes

**Base verificada:** S2 `95940cd5842ae23537701998942a9fe072865519`, [CI #412 SUCCESS](https://github.com/gclp96/zaping/actions/runs/39897028170), incluida la suite PostgreSQL de identidad 14/14 PASS. El estado de pendientes de la sección 10 refleja el cierre de S2; esta sección registra el incremento S3a.

- `physical-expiration-policy` separa decodificación del día persistido, día local de Company y clasificación `UNKNOWN` / `NOT_EXPIRED` / `EXPIRED`. Fecha D permanece no vencida durante todo D en la zona de Company, incluido el cambio de horario; sólo D anterior al día local se considera vencido. No se transforma D en un instante UTC de vencimiento.
- `InventoryPosition.expirationDate @db.Date` se decodifica como `YYYY-MM-DD`. Para `InventoryBatch.expirationDate` histórico, que permanece `DateTime?`, se conserva su componente calendario UTC almacenado como día informado; no se desplaza ese día a la zona de Company ni se reescribe el dato. Su elegibilidad se compara contra el día local, sustituyendo el corte anterior por instante `expirationDate > now`. No se modifica schema ni migración.
- El motor conserva Product → Batch → Position. Tras adquirir esos locks obtiene `Company.timezone` mediante lectura por `request.companyId` y captura el instante de evaluación. No añade un lock de Company, no cambia el orden transaccional y no usa zona/hora recibidas del solicitante. La configuración se lee una vez para la decisión del comando; no se congela para otras transacciones. Si no interviene ninguna caducidad conocida, conserva el flujo histórico sin requerir una consulta temporal.
- La fecha de fuente procede de la Position bloqueada; la de lote procede del Batch bloqueado. Se valida antes de claim, CAS y líneas de Effect. Caducidad conocida vencida o configuración temporal inválida rechaza la operación; tampoco se infiere una excepción para salidas ordinarias de CUSTODY con Batch vencido. Una eventual vía auditada de material vencido continúa fuera de este incremento.
- **Gate S2 conservado:** incluso una Position con día conocido no vencido sigue rechazada hasta autorización S3b. No se habilitan recepción sin lote, selector de Ventas, read models ni rutas públicas. Los Batch existentes sí utilizan la política temporal local en el motor; los consumidores y read models restantes requieren alineación posterior y no se declaran migrados por S3a.
- Replay de evidencia histórica confirmada se clasifica antes de releer fecha/configuración actuales y no repite efectos. Zona, instante de evaluación y estado actual de caducidad no se incorporan a la intención ni a los hashes de idempotencia; las regresiones de hashes S2 se conservan.
- **QA S3a:** unitarias de medianoche, zonas distintas, DST, D inclusivo, NULL, configuración inválida, espera por lock que cruza medianoche y origen persistido de zona. Siete casos PostgreSQL adicionales en el servicio efímero de CI: D local en dos zonas y replay tras vencimiento, NULL, rechazo atómico de vencido, rollback real tras insertar líneas de Effect y dos esperas verificadas con clientes/PIDs independientes (Batch vence o cambia configuración antes de adquirir el lock). No se simula una medianoche real de PostgreSQL mediante hooks o reloj productivo; ese límite lo cubren las unitarias controlando exclusivamente el reloj del test. Resultado del commit S3a: consultar checks de [PR #119](https://github.com/gclp96/zaping/pull/119).

**Pendiente:** autorización de writers S3b, integración de recepción/consumidores, FEFO, read models y QA S4. El ADR continúa IN PROGRESS y el PR DRAFT, sin merge ni activación operativa de posiciones fechadas.

## 12. S3b-R — Lecturas consistentes por día local de Company

**Base verificada:** S3a `855f9908595d0c0e5ef345849e05374c0315af6d`, [CI #414 SUCCESS](https://github.com/gclp96/zaping/actions/runs/39908490562), PostgreSQL 21/21 PASS. Los pendientes de la sección 11 describen su cierre histórico; S3b-R completa sólo la alineación de `PhysicalInventoryReadService`.

- Se mantiene una única sentencia SQL para existencia de Product, pertenencia de Batch, Company, posiciones y agregados. `Company.timezone` procede del JOIN por Company del Product; no hay parámetro de zona o instante controlado por el solicitante ni lectura separada que mezcle snapshots.
- `owned` suma todas las posiciones físicas, incluidas vencidas, inactivas y CUSTODY. `inCustody` conserva todo el saldo CUSTODY, sin filtrarlo por caducidad. No se toma `Product.stock` como fallback ni se cambian autoridad, límites numéricos, `hasPositions` o errores de identidad existentes.
- `available` incluye sólo AVAILABLE con Product activo y, cuando hay Batch real, Batch activo. Para posiciones sin lote compara `InventoryPosition.expirationDate DATE` contra el día local; para Batch compara `expirationDate::date`, conservando el componente calendario almacenado de su `TIMESTAMP(3)` histórico sin zona. No se convierte la fecha de Batch a otro huso. `NULL` permanece desconocida y D conserva elegibilidad durante todo D local; D anterior se excluye únicamente de `available`.
- El día de evaluación es `(statement_timestamp() AT TIME ZONE Company.timezone)::date`: un único instante estable para todas las filas de esa sentencia y renovado para cada lectura. No se usa `CURRENT_DATE`, `now()` ni `transaction_timestamp()` como corte, porque quedan anclados al inicio de una transacción anterior; tampoco se usa un reloj volátil por fila. Cambiar el timezone de sesión no sustituye el de Company. Un error al interpretar configuración temporal no se transforma en stock cero o disponibilidad exitosa.
- La consulta por lote conserva la pertenencia Company/Product y usa exactamente la misma regla temporal que la consulta por Product. Un lote sin posiciones devuelve ceros explícitos; lote extranjero o incoherente conserva su rechazo.
- **QA S3b-R:** unitarias de SQL generado, predicados, reloj de sentencia, parámetros, mapeo, límites y errores; regresiones de la política S3a y hashes/gate S2. Ocho casos PostgreSQL adicionales cubren múltiples fechas sin lote, D−1/D/D+1 y NULL, lotes reales, Product/Batch inactivos, `owned`/`available`/`inCustody`, producto vacío, aislamiento por Company, coherencia por lote y timezone de sesión. Se usan zonas UTC−11/UTC+14 y días relativos para detectar un corte UTC incorrecto a cualquier hora. Una observación test-only delega en SQL real y verifica reloj de sentencia posterior al de transacción dentro de una transacción ya iniciada; no simula un cruce de medianoche real ni introduce hooks productivos. Ejecución PostgreSQL exclusivamente en CI efímero; resultado del commit: checks de [PR #119](https://github.com/gclp96/zaping/pull/119).

**Límites conservados:** gate S2 cerrado para créditos/salidas/movimientos de posiciones fechadas, incluso si la lectura las considera temporalmente disponibles. Lectura elegible no autoriza mutación. No se modifican Recepciones, Ventas, FEFO, writers, hashes, locks, schema o migraciones. Writers S3b, integración de consumidores y QA S4 continúan pendientes; ADR IN PROGRESS y PR DRAFT, sin merge.

## 13. S3b-S — Planificación interna FEFO sin habilitar consumo fechado

**Base verificada:** S3b-R `a0050b94faa5a58a302bc43150e3f2af5ca7e71d`, [CI #416 SUCCESS](https://github.com/gclp96/zaping/actions/runs/39910949740), PostgreSQL 29/29 PASS. Los apartados anteriores conservan el historial; este incremento prepara selección interna, no un nuevo caller productivo.

- `SalesPhysicalSourceResolver.planUnbatchedSources(tx, companyId, items)` es una entrada interna de planificación sin escrituras, Effect, auditoría, proyecciones ni reserva duradera. No se conecta a `SalesPhysicalIntegrationService` ni a rutas públicas. No recibe flags de autorización, zona horaria o instante desde el cliente.
- Comparte con `resolve` la validación y los locks existentes: Product → descubrimiento sólo de IDs → Batch vacío → Positions por ID. Las cantidades, fechas y revisiones definitivas proceden de las Positions bloqueadas. Company y su timezone se consultan después; el instante de evaluación se captura entonces. No se cambia el orden de raíces de Sale/Quote/Folio ni del motor Physical.
- Sólo planifica QUANTITY de Product activo, del tenant solicitado, en AVAILABLE sin Batch ni contexto. Omite stock cero, fecha vencida y revisión que ya no puede incrementarse; rechaza evidencia inválida o identidades duplicadas/ajenas. Ordena días conocidos de menor a mayor, fecha desconocida al final y Position ID como desempate lexical estable. Distribuye la cantidad solicitada parcialmente entre pools y conserva `expectedRevision` por fuente. Si falta stock elegible, falla sin asignar lotes reales ni producir un plan parcial utilizable.
- **REQUIRED permanece rechazado** antes del descubrimiento en ambas entradas, con el mensaje histórico. Lotes reales, ASSET y SERIALIZED no se convierten en candidatos automáticos. El diagnóstico histórico de shortfall/lote de la entrada productiva se conserva y no se amplía a selección automática de Batch.
- **Separación operativa:** `SalesPhysicalIntegrationService` continúa llamando exclusivamente `resolve`, que descubre sólo `expirationDate = NULL` y revalida bajo lock que la fuente no tenga fecha. El motor conserva el gate S2; intentar ejecutar un preview fechado sigue rechazado antes de persistir efectos. `planUnbatchedSources` puede describir stock fechado elegible, pero no autoriza consumirlo. Un plan fuera de su transacción no reserva stock ni sustituye CAS/replanificación.
- **QA S3b-S:** unitarias de tres fechas FEFO, NULL al final, D vigente/vencido, reparto parcial, insuficiencia, orden estable, Product independiente, cantidades/revisiones bloqueadas, tenant, REQUIRED y gate productivo. El desempate entre fechas iguales se prueba con filas sintéticas: los índices UNIQUE S1 impiden pools AVAILABLE del mismo Product con igual fecha, por lo que no se fabrica un caso PostgreSQL que viole esa restricción.
- Se añaden seis casos PostgreSQL en CI efímero: preview FEFO sin escrituras y ejecución fechada rechazada; insuficiencia pese a stock no elegible; entrada productiva sin fecha, REQUIRED y tenant; dos clientes/PIDs reales y espera observada por Product; CAS desactualizado; rollback íntegro de posiciones, Effect y líneas tras fallo test-only posterior a evidencia. La concurrencia cambia sólo stock **sin fecha** mediante el motor existente y comprueba que el segundo planner recibe la revisión ya confirmada, sin consumir las fuentes fechadas del preview. Replay, CAS y rollback se ejercen sobre ese camino permitido; no equivalen a QA de venta fechada end-to-end. Las regresiones de ventas actuales conservan replay y comportamiento anterior; se completa un stub histórico de proyecciones requerido para su typecheck focal. Resultados: checks del commit S3b-S en [PR #119](https://github.com/gclp96/zaping/pull/119).

**Pendiente:** autorización explícita S3b-W para writers/consumo fechado, integración y QA comercial completa, recepción y cierre S4. No cambian hashes, permisos, contratos públicos, schema, migraciones, autoridad ni saldos físicos. ADR IN PROGRESS, PR DRAFT y gate S2 cerrado; sin merge.

## 14. S3b-W1 — Crédito de recepción acreditado en su transacción

**Base verificada:** S3b-S `6eb6b4a3d3fe46527dd97c447ce82884c0a6d623`, [CI #418 SUCCESS](https://github.com/gclp96/zaping/actions/runs/39913698468), API 2910 pruebas y suite PostgreSQL ADR-015 35/35 PASS. Son resultados históricos; los checks del commit W1 en [PR #119](https://github.com/gclp96/zaping/pull/119) acreditan exclusivamente su ejecución posterior. Los pendientes de la sección 13 se conservan como historial.

- Se autoriza exclusivamente la recepción PHYSICAL de QUANTITY: sin lote/fecha usa Batch NULL y fecha NULL; sin lote con fecha conserva el DateTime recibido en `PurchaseReceiptItem` y su día calendario en la identidad DATE de Position; con lote real mantiene InventoryBatch y su caducidad histórica. No fabrica lotes. NONE, OPTIONAL y REQUIRED pueden conservar información disponible u omitirla en esta recepción; ASSET/SERIALIZED mantienen las validaciones anteriores. No se modifica DTO público, schema ni migraciones.
- `PhysicalInventoryService.creditPurchaseReceipt` recibe sólo Company, actor, Receipt ID y key. Reconstruye las cantidades y destinos a partir del root y sus partidas persistidas; no acepta overrides de hash, fecha, cantidad ni un flag de excepción. Valida actor activo ADMIN/MANAGER/WAREHOUSE, tenant, receptor, OC confirmada/parcial, pertenencia de partidas/productos, costo, cantidades positivas y total acumulado dentro de lo ordenado, Batch real coherente, par documental y claim vinculado cuya intención canónica coincide. Rechaza una recepción con auditoría previa. El crédito genérico rechaza el origen PURCHASE_RECEIPT: el texto del origen por sí solo no acredita autorización.
- La evidencia exige versiones de root, partidas y claim de la misma transacción PostgreSQL mediante `xmin = pg_current_xact_id()::xid`. `xmin` acredita la transacción de la **versión de fila**, no un registro inmutable de su inserción original. El flujo autorizado crea root/partidas y vincula el claim antes de invocar el crédito, todo en una transacción; una recepción ya confirmada no es un permiso reutilizable. Esto protege la frontera del caller interno, no pretende restringir a un operador con acceso SQL arbitrario. No se usan savepoints en esta ruta: evidencia creada en una subtransacción distinta se rechaza conservadoramente. Véanse [identidad de transacción PostgreSQL 16](https://www.postgresql.org/docs/16/transaction-id.html) y [funciones de información de transacción](https://www.postgresql.org/docs/16/functions-info.html).
- Se conserva authority/shared fence del caller existente y el orden claim de recepción → Purchase → Product → Batch → Position. La comprobación del permiso vuelve a adquirir el mismo Purchase ya bloqueado por la integración; es reentrante, no una nueva raíz adquirida después de Product. El motor conserva sus locks, CAS, límites y validación temporal después de bloquear. Company.timezone sigue siendo persistida; D es elegible durante D local, D anterior rechaza ingreso a AVAILABLE, tanto sin lote como con Batch. El claim, recepción, partidas, Batch, Effect/líneas, saldo, proyecciones, auditoría y estado de OC se confirman o revierten juntos.
- Se conservan sin cambios los algoritmos de hash de recepción y Physical. Para solicitudes históricas sin fecha o con Batch real se reconstruye la misma intención. Factura/remisión/nota de entrega del PR #114 se mantienen en el root y en el hash. El replay histórico utiliza la ruta existente de PurchaseReceiptsService/integración antes de crear otro crédito: no exige que el material siga disponible/no vencido ni repite proyecciones. La autorización de crédito nuevo no sustituye esa ruta de replay ni reclasifica errores como éxitos.
- **Gate restante:** la excepción sólo llega al CREDIT reconstruido de recepción. Crédito manual, salidas, transferencias y conteos de posiciones fechadas siguen rechazados; Ventas, su resolver productivo y FEFO no se modifican. REQUIRED continúa con sus reglas fuera de esta recepción. Una lectura `available` o un preview FEFO no habilitan consumo. Stock recibido que requiera esos consumidores permanece sujeto a W2/S4; no se declara el flujo comercial completo.
- **QA W1:** unitarias de autorización durable, roles/tenant, OC/cantidades, claim/hash, Batch, auditoría previa y origen falsificado; regresiones de documentos, hashes, motor, corrección, opening y Ventas. Se amplía la suite PostgreSQL efímera de recepción a 15 casos: tres fechas y NULL con NONE/OPTIONAL/REQUIRED, parcial/replay/intención distinta, lote real, vencimiento en ambos tipos de pool, rollback posterior a auditoría realmente escrita, identidad/roles, replay histórico tras cambio de día local, ASSET/SERIALIZED, origen falsificado/permiso confirmado y dos carreras con clientes/PIDs distintos para misma key y keys distintas. Las barreras test-only esperan bloqueo observado con `pg_blocking_pids`, sin sleeps ni mocks de Prisma. El selector de autoridad del smoke sigue fijado a PHYSICAL; la suite no acredita un cutover real. No se ejecuta PostgreSQL local. Preparar estos casos no equivale a PASS; consultar los checks del commit W1.

**Validaciones locales W1:** 241/241 pruebas en 12 suites PASS; TypeScript productivo y focal de los tests, ESLint, Prettier, build API y `git diff --check` PASS. PostgreSQL se reserva al servicio efímero de CI, sin conexiones a bases locales. El resultado CI del commit debe verificarse separadamente.

**Estado de entrega:** W1 implementado para revisión; PR #119 permanece DRAFT hasta W2/S4. Sin merge ni habilitación de consumidores fechados.
