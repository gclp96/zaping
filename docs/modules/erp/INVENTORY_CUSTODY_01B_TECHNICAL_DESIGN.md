# HC-INVENTORY-CUSTODY-01B — Receipts, Manual Inventory & Compatibility Projections

**TECHNICAL DESIGN APPROVED / PR PENDING — TARGET 8 SP.**
TD-INV-01B-01..30 **APPROVED** por revisión humana.
Implementation: **NOT STARTED**. Activation: **DORMANT UNTIL 01D**.

Baseline: `47fd68a409906b3a5981bd7f7cd30a48e08714b0`.
01A COMPLETE / MERGED — PR #77 — main@47fd68a, dormido.
TD-INV-01A-01..20 APPROVED / MERGED — PR #76; DEF merged PR #75.
01C..01E y HC-DSP-01A/B/C/D BLOCKED; M-HC1 OPEN.
Sin Forecast, Commitment, Actual ni fechas nuevos.

## 1. Autoridad y cierre humano

Se conservan [DEF](INVENTORY_CUSTODY_DEFINITION.md), el
[contrato 01A](INVENTORY_CUSTODY_TECHNICAL_DESIGN.md),
[CURRENT Inventory](INVENTORY.md) y [Advanced Inventory](ADVANCED_INVENTORY.md).
Código baseline determina CURRENT. Las recomendaciones iniciales quedan sustituidas
por estas decisiones aprobadas: Receipt mixto permitido con subconjuntos disjuntos;
OUT con múltiples fuentes explícitas; COUNT_CORRECTION cero conserva Effect+Line,
sin cambio de revision ni proyección; no entidad manual adicional para un no-op.
La extensión kind/constraints de COUNT_CORRECTION es futura implementación 01B,
no modificación de schema/migración en este cierre documental.

No se encontró conflicto material adicional tras aplicar la revisión. La
compatibilidad ADJUSTMENT conserva quantity=balance=owned resultante, incluido
cero; los consumidores inspeccionados muestran saldo absoluto. No se redefine
ADJUSTMENT histórico como delta. El orden de locks mixto se explicita en TD-04/22;
si implementación descubre una inversión no resoluble dentro del contrato, STOP.
8 SP se conserva para el alcance backend dormido aprobado, sin frontend/cutover.

## 2. Mapa CURRENT de escritores y consumidores

Rutas relativas al repositorio; números de línea corresponden al baseline.
Se buscaron referencias en código, tests, scripts y schema, excluyendo artefactos
generados y los directorios ajenos output/tmp. Ninguna consulta a datos reales.

| Escritor / sitio exacto | Escritura actual | Clasificación / disposición |
| --- | --- | --- |
| `app/api/src/inventory/inventory.service.ts:61`, `:96`, `:115` — createMovement | IN suma, OUT resta, ADJUSTMENT fija stock; crea Movement con balance. Serializable, hasta 3 intentos P2034. No batch ni actor ni key. | 01B: reemplazo dormido; retirar routing legacy sólo en 01D. |
| Mismo archivo `:150`, `:183`, `:192` — registerPurchaseEntry | Increment stock + Movement IN, referenceType PURCHASE; tx del caller. | Helper legacy sin caller productivo encontrado; deprecar/retirar en implementación 01B con búsqueda y regresión. No alias al nuevo writer. |
| `app/api/src/purchases-receipts/purchases-receipts.service.ts:258`, `:267` — create | Increment stock por ReceiptItem + Movement IN PURCHASE_RECEIPT, balance, costo, createdBy. | 01B para QUANTITY; ASSET/SERIALIZED pendientes TD-19. |
| Mismo archivo `:753`, `:754`, `:783`, `:786` — registerBatch | Crea initialQuantity/availableQuantity=q o incrementa ambos; costo ponderado sobre initialQuantity; completa expiration y reactiva batch. | 01B: separar contador histórico de proyección física. Único escritor productivo de esos contadores encontrado. |
| `app/api/src/sales/sales.service.ts:329`, `:339`, `:380` — approve | updateMany condicionado stock>=q, decrement + Movement OUT SALE. | 01C; no se migra aquí. |
| Mismo archivo `:688`, `:698`, `:736` — createFromQuote | Segundo decrement condicional + Movement OUT SALE. | 01C; nombre real del método, aunque dominio lo llama conversión. |
| `app/api/src/products/products.service.ts:59` + `app/api/prisma/schema.prisma` Product.stock | Product create omite stock: default 0. Update DTO no asigna stock. `:153` es filtro lowStock, no write. | Inicialización catálogo compatible; auditar en 01D, no writer de saldo positivo. |
| `scripts/qa/seed.cjs:27`, `:96`, `:98`, `:108` | Stock explícito y Movement sintético QA_OPENING/PURCHASE_RECEIPT. | Sólo fixtures QA, no opening/backfill productivo; adaptar fixtures post-cutover separadamente. No ejecutar aquí. |
| `app/api/test/inventory.concurrency.e2e-spec.ts:51`, `:271`; `app/api/test/inventory-physical.postgres.e2e-spec.ts:76`, `:90` | Fixtures de stock y batch; prueba legacy y prueba de no escritura desde core. | Test only; conservar separación legacy/physical. |
| `app/api/test/healthcare-case-availability.c5b.postgres.e2e-spec.ts:58`, `healthcare-equipment-assignments.c5b-create.postgres.e2e-spec.ts:79`, `healthcare-equipment-assignments.c5b-conflict-override.postgres.e2e-spec.ts:40` | Stock fixture; specs unitarios mockean writes en sus servicios respectivos. | Test only, no autoridad productiva. |

No decrement productivo de Batch.availableQuantity encontrado: Sales/manual OUT
gastan el agregado. Las migraciones históricas crean/normalizan esquema; no son
writers online que deban enrutarse. 01A no escribe balances legacy ni Movement.
Purchase approve cambia estado, no ingresa inventario. Equipment provisioning
crea Assets; no escribe esos tres balances directamente. Dashboard sólo lee.

`POST /inventory/movements`: productId string, movementType IN/OUT/ADJUSTMENT,
quantity Int >=1, notes opcional. ADMIN/MANAGER/WAREHOUSE; ADJUSTMENT sólo
ADMIN/MANAGER. No batch, Position, expectedRevision ni Idempotency-Key.
JWT valida usuario activo de Company, pero InventoryController no transmite id.
No ruta productiva legítima actorless identificada: la pérdida del actor ocurre
en el contrato interno. Receipt controller sí envía user.id; su service acepta
`string | undefined`, más permisivo que la ruta protegida.

`web/app/(app)/inventory/page.tsx:491` hace GET de movements; la pantalla muestra
historial/balance/filtros, no se encontró POST manual desde web. No inferir que
no existan clientes externos. ProductSelector, Sales, Inventory y Dashboard leen
stock; no deben ver Positions incompletas. Equipment/purchases types exponen batch
availableQuantity: cambiar su significado exige documentación en el corte.

Pruebas existentes inspeccionadas: Inventory service conserva ADJUSTMENT absoluto
y retries; controller conserva RBAC; Receipt service valida lot matrix, pendientes,
provisioning, rollback, stock/Movement; request-hash/idempotency specs preservan
replay. Son contratos CURRENT a mantener hasta cutover, no pruebas ejecutadas aquí.


## 3. Decisiones técnicas aprobadas

### TD-INV-01B-01 — Activación

**CURRENT:** Core dormido; stock legacy sigue operativo.

**PROBLEM:** Evitar autoridad híbrida.

**OPTIONS:** Activación inmediata, shadow o integración dormida.

**RECOMMENDATION:** Integración/orquestación 01B implementable y testeable pero sin routing productivo tras merge. No runtime flag nuevo por defecto. 01D controla barrera de writers, baseline, backfill, route switch y activación coordinada.

**CONSEQUENCE:** El mismo Product QUANTITY nunca se gasta por stock y Positions a la vez; ningún controller actual cambia autoridad en 01B.

**STATUS:** APPROVED.

### TD-INV-01B-02 — Evento Receipt

**CURRENT:** Receipt crea Movement por item; core exige líneas significativas.

**PROBLEM:** Separar subconjuntos de tracking sin efectos vacíos.

**OPTIONS:** Effect por item o por Receipt.

**RECOMMENDATION:** A lo sumo UN Effect material por Receipt, con todos los créditos QUANTITY elegibles; origin PURCHASE_RECEIPT / receipt.id persistido / RECEIVE_QUANTITY. Sin QUANTITY no hay Effect material.

**CONSEQUENCE:** ASSET provisioning y compatibilidad SERIALIZED pueden coexistir en la misma tx con conjuntos disjuntos; no Position para esos tracking. Hash físico canónico distinto del hash HTTP.

**STATUS:** APPROVED.

### TD-INV-01B-03 — Idempotencia Receipt

**CURRENT:** PURCHASE_RECEIPT_CREATE, Company/scope/key, hash canónico del DTO y resourceId Receipt.

**PROBLEM:** Respuesta perdida no debe duplicar ningún subconjunto.

**OPTIONS:** Reemplazar key por Effect o conservar defensas coordinadas.

**RECOMMENDATION:** Conservar ambas. Replay HTTP retorna Receipt antes de physical credit, proyección y provisioning. Mismatch rechaza; colisión aborta y se clasifica desde lectura fresca.

**CONSEQUENCE:** Receipt/items, batches históricos, Equipment, QUANTITY Effect/Positions, proyecciones, Movement, Purchase status y completion commit juntos o ninguno.

**STATUS:** APPROVED.

### TD-INV-01B-04 — Orden transaccional Receipt

**CURRENT:** CURRENT intercala batch/item/Equipment/stock/Movement por item.

**PROBLEM:** Preparar todos los roots antes de Batch y coordinar Receipt mixto.

**OPTIONS:** Procesar item a item o planificar conjuntos completos.

**RECOMMENDATION:** Owner tx: claim key; lock Purchase tenant-safe antes de pendientes; validar/normalizar y particionar tracking; determinar TODOS los Products; locks Product por id; resolver todos los batches, bloquear existentes por id y crear ausentes por clave ordenada; crear Receipt/items; crédito único del subconjunto QUANTITY; proyección compartida; contadores históricos/costo Receipt; provisioning ASSET y compatibilidad legacy no-QUANTITY; Movement; Purchase status; completion; commit.

**CONSEQUENCE:** Toda operación usa mismo tx. Helper estrecho Inventory permite pre-lock; core puede reacquirir roots ya retenidos sin ampliar conjunto. Para Receipt mixto reservar códigos ASSET mediante CompanySequence antes de Product roots y pasarlos al provisioning preparado: ningún lock nuevo de sequence/Company se adquiere después de roots. Debe verificarse el orden padre/sequence -> Product -> Batch -> Position en implementación, sin cambiar identidad Equipment ni activar rutas.

**STATUS:** APPROVED.

### TD-INV-01B-05 — Batch bajo Product

**CURRENT:** Lookup Company/Product/lotNumber y create/update normales.

**PROBLEM:** No invertir locks ni recuperar tx abortada.

**OPTIONS:** Upsert/conflito local o root serialization.

**RECOMMENDATION:** Bajo todos los Product roots, lookup exacto, lock batches existentes en orden id, INSERT normal de faltantes; unique es backstop. Colisión inesperada aborta; owner puede reintentar operación completa tras clasificación fresca.

**CONSEQUENCE:** QUANTITY batch nuevo empieza availableQuantity=0 antes de crédito/proyección; Receipt asigna initialQuantity recibido y costo una vez. Metadata/caducidad contradictoria rechaza. ASSET/SERIALIZED conservan compatibilidad legacy sin Position.

**STATUS:** APPROVED.

### TD-INV-01B-06 — initialQuantity

**CURRENT:** Acumulado recibido y base del costo ponderado.

**PROBLEM:** No confundir histórico con disponibilidad.

**OPTIONS:** Saldo físico o contador Receipt.

**RECOMMENDATION:** Conservar cantidad histórica acumulada recibida por batch, administrada por Receipt una vez por operación. Costo ponderado preserva semántica existente.

**CONSEQUENCE:** No deriva de Positions; manual IN/OUT/conteo no cambia initialQuantity.

**STATUS:** APPROVED.

### TD-INV-01B-07 — availableQuantity

**CURRENT:** Legacy sólo incrementa con Receipt.

**PROBLEM:** Proyección futura no equivale a elegibilidad temporal.

**OPTIONS:** Saldo estado AVAILABLE o filtro por caducidad.

**RECOMMENDATION:** Tras QUANTITY cutover: SUM quantity de Positions AVAILABLE del batch. CREDIT +5 suma 5; transfer AVAILABLE->CUSTODY resta batch pero no owned; OUT AVAILABLE resta ambos.

**CONSEQUENCE:** Sin batch no hay proyección batch. Expiración/isActive afectan read model elegible, no este saldo de estado. Fuera de QUANTITY no se extiende la ecuación.

**STATUS:** APPROVED.

### TD-INV-01B-08 — Product.stock

**CURRENT:** Saldo productivo legacy.

**PROBLEM:** Evitar matemática independiente por módulo.

**OPTIONS:** Writes locales o adapter compartido.

**RECOMMENDATION:** Después de QUANTITY cutover, proyección Company-owned derivada del resultado físico persistido. Actualizar mismo tx después de physical apply y antes de completion/commit, sólo fresh.

**CONSEQUENCE:** Fallo o overflow revierte todo. Receipt/manual nunca incrementan además con su cálculo propio. No afirmar autoridad stock para ASSET.

**STATUS:** APPROVED.

### TD-INV-01B-09 — Adapter compartido

**CURRENT:** 01A expone projectionDeltas Product desde líneas aplicadas.

**PROBLEM:** Evitar cálculo divergente Receipt/manual/Sales/Dispatch.

**OPTIONS:** Adapters locales o InventoryCompatibilityProjectionService.

**RECOMMENDATION:** Servicio interno compartido apply(tx, companyId, freshPhysicalResult). Owned delta del core como equivalente estrecho de hechos persistidos; batches desde EffectLines + dimensiones Position. initialQuantity queda fuera.

**CONSEQUENCE:** Sin tx/retry propia; una invocación por Effect fresh. No confiar en deltas adicionales del DTO; replay y count delta=0 no mutan proyecciones.

**STATUS:** APPROVED.

### TD-INV-01B-10 — Fuente física de proyecciones

**CURRENT:** Líneas incluyen positionId, delta y before/after; dimensiones Position inmutables.

**PROBLEM:** Usar hechos aplicados, no intención duplicada.

**OPTIONS:** Deltas core o líneas/Positions.

**RECOMMENDATION:** Product usa ownedDelta del core comprobable por líneas; batch delta = SUM line.delta donde Position.state=AVAILABLE y batch exacto. Adapter puede materializar batch como SUM de Positions AVAILABLE bajo roots, conforme 01A, para efectos con delta no cero.

**CONSEQUENCE:** Sin replay de ledger completo; no filtrar elegibilidad. Efecto y proyección aún no committed comparten único commit; count cero omite UPDATE incluso si recomputar daría mismo valor.

**STATUS:** APPROVED.

### TD-INV-01B-11 — InventoryMovement compatible

**CURRENT:** UI expone type/quantity/balance y referencias.

**PROBLEM:** Conservar significado histórico externo.

**OPTIONS:** Retirar filas o mantener compatibilidad atómica.

**RECOMMENDATION:** Receipt QUANTITY IN por item con PURCHASE_RECEIPT/receipt.id; manual IN/OUT filas por fuentes/targets normalizados, referencia INVENTORY_MANUAL_PHYSICAL_MUTATION/effect.id. Balance por Product es previo bajo lock + prefijo estable de deltas; final coincide con stock proyectado. COUNT_CORRECTION conserva ADJUSTMENT: quantity=balance=Product.stock owned resultante; notes/reference indican Position y conteo.

**CONSEQUENCE:** También count cero puede escribir esa fila auditada una sola vez, sin mutar stock/batch. Datos exactos en Effect/Line. No reinterpretar filas antiguas; consumidor actual muestra ADJUSTMENT como saldo absoluto, sin conflicto identificado. No segunda autoridad.

**STATUS:** APPROVED.

### TD-INV-01B-12 — Contrato manual actual

**CURRENT:** POST /inventory/movements Product-only, quantity>=1, sin key ni identidad física.

**PROBLEM:** No retrofit silencioso.

**OPTIONS:** Cambiar DTO legacy o contrato adicional.

**RECOMMENDATION:** Nuevo contrato interno dormido; legacy permanece productivo hasta corte 01D. Actor, key, identidad y razón cuando requerida.

**CONSEQUENCE:** 01D migra caller y deshabilita/rechaza antiguo writer QUANTITY; GET histórico permanece.

**STATUS:** APPROVED.

### TD-INV-01B-13 — Manual IN

**CURRENT:** CURRENT incrementa agregado.

**PROBLEM:** Target físico inequívoco.

**OPTIONS:** Inferir/crear lote o batch existente.

**RECOMMENDATION:** creditAvailable QUANTITY con productId, batchId explícito o ausencia, quantity>0. NONE prohíbe batch; OPTIONAL admite ambos; REQUIRED exige batch exacto existente. Contrato mínimo no crea batch manualmente.

**CONSEQUENCE:** Crear nuevos lotes corresponde a Receipt/admin workflow futuro explícito, nunca lote arbitrario. No increment initialQuantity manual.

**STATUS:** APPROVED.

### TD-INV-01B-14 — Manual OUT

**CURRENT:** CURRENT Product+quantity.

**PROBLEM:** Puede haber varios pools/batches.

**OPTIONS:** Source implícito/FEFO o sources explícitas.

**RECOMMENDATION:** sources:[{positionId,quantity,expectedRevision}], una o varias fuentes, todas Company autenticada, QUANTITY, AVAILABLE, elegibles, suficientes y con revisión exacta; definitiveOut en una llamada con todos los Products.

**CONSEQUENCE:** Sin gasto CUSTODY, stock-only, FEFO silencioso ni batch inferido. Normalizar fuentes repetidas y rechazar revisiones incompatibles; hash incluye fuentes normalizadas y revisiones.

**STATUS:** APPROVED.

### TD-INV-01B-15 — COUNT_CORRECTION

**CURRENT:** 01A prohíbe delta cero y sólo conoce tres kinds.

**PROBLEM:** Conteo físico necesita evidencia incluso sin cambio.

**OPTIONS:** Wrapper de delta observado o primitive de conteo.

**RECOMMENDATION:** Extensión estrecha kind COUNT_CORRECTION: Position exacta existente AVAILABLE, countedQuantity>=0, expectedRevision, actor autenticado, reason REQUIRED; ADMIN/MANAGER. Hash incluye conteo/revisión solicitados, no delta/saldo observado. Replay antes de validar revisión actual. Bajo locks claim Effect normal antes de mutar; siempre exactamente una EffectLine.

**CONSEQUENCE:** delta=countedQuantity-quantityBefore. No cero: quantityAfter=countedQuantity, revisionAfter=revisionBefore+1. Cero: Effect+Line persistidos, quantity/revision sin cambio, sin UPDATE Position ni proyección; actor/razón evidencian observación. No CUSTODY reconciliation ni cambio de estado. Constraints futuros: checks locales permiten sólo pares delta!=0/revision+1 o delta=0/revision igual con ecuación quantity; validación diferida por kind prohíbe cero salvo COUNT_CORRECTION de una línea AVAILABLE. CREDIT positivo, OUT negativo y TRANSFER balanceado mantienen revision+1 y reglas previas. No triggers UPDATE/DELETE. No nueva entidad manual para no-op: esa propuesta queda sustituida por Effect/Line.

**STATUS:** APPROVED.

### TD-INV-01B-16 — Idempotencia manual

**CURRENT:** Legacy no key.

**PROBLEM:** Separar replay empresarial de origen físico.

**OPTIONS:** Key business más origen durable.

**RECOMMENDATION:** Scope INVENTORY_MANUAL_PHYSICAL_MUTATION, key trim 1..128; hash versionado operation, fuentes/targets explícitos normalizados, cantidades/conteo, revisiones esperadas y razón significativa. Claim IdempotencyRecord; commandId UUID estable para intento confirmado, origin INVENTORY_MANUAL_PHYSICAL_MUTATION / commandId / IN|OUT|COUNT_CORRECTION; resourceId=effect.id, incluido count cero. Completion en mismo tx.

**CONSEQUENCE:** Misma key/hash retorna Effect/resultado histórico y compatibilidad existente; mismatch rechaza. Ninguna segunda proyección/observación. Actor no redefine intención pero se conserva el original; no UUID nuevo para eludir replay committed.

**STATUS:** APPROVED.

### TD-INV-01B-17 — Actor manual

**CURRENT:** JWT tiene id; contrato Inventory actual lo pierde.

**PROBLEM:** Auditoría física obligatoria.

**OPTIONS:** Actor ficticio o autenticado.

**RECOMMENDATION:** Propagar request.user.id al comando, Effect y createdBy de Movement; validar Company. Permisos existentes; COUNT_CORRECTION ADMIN/MANAGER.

**CONSEQUENCE:** Sin actor sistema inventado. Falta de actor se rechaza; replay preserva actor original.

**STATUS:** APPROVED.

### TD-INV-01B-18 — Actor Receipt

**CURRENT:** Controller autenticado pasa user.id; tipo service admite undefined.

**PROBLEM:** Tipo interno demasiado permisivo.

**OPTIONS:** Nullable o requerido.

**RECOMMENDATION:** Actor requerido internamente, recibido de User autenticado; mismo id en Receipt/Effect/Movement. No es decisión producto sin resolver.

**CONSEQUENCE:** No fake user; futura ingesta sin actor requiere contrato explícito separado.

**STATUS:** APPROVED.

### TD-INV-01B-19 — Equipment y SERIALIZED

**CURRENT:** Receipt ASSET provisiona Assets e incrementa stock; SERIALIZED sólo compatibilidad agregada.

**PROBLEM:** No duplicar identidad física.

**OPTIONS:** Rechazar mixtos o separar conjuntos por tracking.

**RECOMMENDATION:** Aceptar Receipt mixto en orquestación dormida: QUANTITY -> Effect/Positions; ASSET -> EquipmentProvisioningService/EquipmentAsset, nunca Position; SERIALIZED -> sin Position ni conversión automática a Equipment. Compatibilidad stock/batch/history no-QUANTITY puede permanecer legacy dentro de misma tx.

**CONSEQUENCE:** ASSET identidad física pertenece Equipment/01E; SERIALIZED requiere decisión/slice futuro explícito, no 01E por inferencia. Sólo subconjunto QUANTITY usa adapter de proyecciones. 01D excluye ASSET/SERIALIZED del backfill quantity.

**STATUS:** APPROVED.

### TD-INV-01B-20 — Matriz tracking

**CURRENT:** Receipt aplica lot rules a todos; manual legacy no.

**PROBLEM:** No generalizar cantidad a Assets/seriales.

**OPTIONS:** Una autoridad para todos o dominio por tracking.

**RECOMMENDATION:** Matriz §4: integración física sólo QUANTITY, Receipt mixto con conjuntos disjuntos, manual físico no-QUANTITY rechazado.

**CONSEQUENCE:** OPTIONAL sin batch identifica pool unbatched, no cualquier lote. No doble representación Position/Asset.

**STATUS:** APPROVED.

### TD-INV-01B-21 — Sales antes de 01C

**CURRENT:** Sales aún consume stock.

**PROBLEM:** Row update no demuestra protocolo físico compartido.

**OPTIONS:** Activar sólo inbound o permanecer dormido.

**RECOMMENDATION:** 01B no activa writers físicos QUANTITY antes de migración Sales/01C y secuencia 01D segura.

**CONSEQUENCE:** No afirmar seguridad Sale vs Receipt/manual actual; sólo compatibilidad de diseño futuro.

**STATUS:** APPROVED.

### TD-INV-01B-22 — Orden total futuro

**CURRENT:** 01A requiere Product -> Batch -> Position.

**PROBLEM:** Padres/sequence tardíos pueden invertir locks.

**OPTIONS:** Llamadas por item o planificación total.

**RECOMMENDATION:** Claim idempotente -> padres empresariales/sequence requeridos -> TODOS los Products ordenados -> Batches ordenados -> Positions ordenadas -> Effect/lines -> proyecciones/compatibilidad -> completion. Receipt Purchase antes de roots; ASSET codes reservados antes de roots y provisioning posterior no adquiere nuevo sequence lock. Futuro Dispatch Company/padres antes de roots.

**CONSEQUENCE:** Sin advisory ni Company lock global nuevo para QUANTITY. Reacquire mismo root permitido; no nuevos Products tras Batch. Implementación valida el protocolo con otros callers Equipment/Sales, y detiene si aparece inversión material.

**STATUS:** APPROVED.

### TD-INV-01B-23 — registerPurchaseEntry

**CURRENT:** Sin caller productivo encontrado.

**PROBLEM:** Writer residual después del corte.

**OPTIONS:** Migrar o retirar helper muerto.

**RECOMMENDATION:** Deprecar/retirar en implementación 01B tras búsqueda y regresión; no alias al writer legacy.

**CONSEQUENCE:** Purchase approve no se convierte en Receipt; gate 01D verifica ausencia de bypass QUANTITY.

**STATUS:** APPROVED.

### TD-INV-01B-24 — Inventario writers

**CURRENT:** Mapa §2 conserva hechos de baseline.

**PROBLEM:** No omitir un write.

**OPTIONS:** Sólo Receipt o inventario completo.

**RECOMMENDATION:** Mapa como checklist de 01B/01C/01D; separar defaults/predicates/fixtures de writers. No-QUANTITY permanece fuera del corte quantity.

**CONSEQUENCE:** 01D repite búsqueda final y deshabilita todos los writers legacy del MISMO Product QUANTITY. QA seed no es apertura productiva.

**STATUS:** APPROVED.

### TD-INV-01B-25 — Invariantes

**CURRENT:** Saldos legacy no garantizan distribución física.

**PROBLEM:** No convertir agregado histórico en baseline supuesto.

**OPTIONS:** Replay por lectura o invariantes transaccionales.

**RECOMMENDATION:** Para QUANTITY post-corte: Product.stock=SUM Positions propias; Batch.availableQuantity=SUM Positions AVAILABLE batch exacto; initialQuantity=histórico recibido. Count no cero cambia owned/batch por delta; cero no muta proyecciones.

**CONSEQUENCE:** Asserts integración/PG y reconciliación 01D; no ledger replay normal. ASSET stock no es autoridad y SERIALIZED queda fuera de ecuaciones.

**STATUS:** APPROVED.

### TD-INV-01B-26 — Replay y doble proyección

**CURRENT:** Core replay=true devuelve deltas vacíos.

**PROBLEM:** No repetir counters, Equipment ni negocio.

**OPTIONS:** Reaplicar histórico o devolver resultado confirmado.

**RECOMMENDATION:** Orígenes de integración sólo por orquestador atómico: Effect committed implica negocio/proyecciones/completion committed para ese namespace. Receipt replay retorna Receipt; manual retorna efecto/resultado persistido. Cero también tiene Effect/Line.

**CONSEQUENCE:** Clasificación fresca nunca muta. Effect sin negocio/completion es inconsistencia a diagnosticar, no reparación automática; Effect genérico 01A no implica proyecciones por sí mismo.

**STATUS:** APPROVED.

### TD-INV-01B-27 — Rollback

**CURRENT:** Caller owns tx.

**PROBLEM:** No commit parcial por subconjunto mixto.

**OPTIONS:** Postcommit async o tx única.

**RECOMMENDATION:** Fault injection tras Receipt, Batch histórico, claim, Position, stock, Movement, Equipment y completion, además de constraint diferida al commit; rollback de TODO el intento.

**CONSEQUENCE:** Retry completo externo máximo 3 para transitorios reconocidos; mismatch/stale/insuficiencia no se reintentan como conflicto técnico. No continuar tx abortada.

**STATUS:** APPROVED.

### TD-INV-01B-28 — API aditiva

**CURRENT:** Legacy Product-only publicado; web actual sólo lee.

**PROBLEM:** No preservar OUT inseguro post-corte.

**OPTIONS:** Retrofit o contrato físico nuevo.

**RECOMMENDATION:** Internals DTO/service primero, ruta física dormida sin controller público activo en 01B. Contrato aditivo IN/OUT/COUNT_CORRECTION con key/actor; OUT sources[]; count exacto/revisión/razón. Nombre candidato POST /inventory/physical-commands.

**CONSEQUENCE:** 01D cambia caller/frontend y deshabilita/rechaza legacy QUANTITY; no UI ni activación en 01B. Contrato Receipt conserva estructura pública, particionando internamente tracking.

**STATUS:** APPROVED.

### TD-INV-01B-29 — Lecturas pre-cutover

**CURRENT:** Inventory/Dashboard leen legacy; Positions incompletas.

**PROBLEM:** Falsos ceros si se expone verdad parcial.

**OPTIONS:** Físico parcial o CURRENT hasta corte.

**RECOMMENDATION:** Mantener CURRENT; ningún reader/productive endpoint nuevo cambia autoridad en 01B. 01D activa lecturas coherentes con baseline y writers QUANTITY.

**CONSEQUENCE:** Owned y eligible available se distinguen; batch saldo AVAILABLE no asegura elegibilidad. ASSET/SERIALIZED no se interpretan por Positions vacías.

**STATUS:** APPROVED.

### TD-INV-01B-30 — Handoff y alcance

**CURRENT:** 01A merged, implementación 01B NOT STARTED.

**PROBLEM:** Merge de adapters no es activación.

**OPTIONS:** Corte parcial por writer o corte por dominio coherente.

**RECOMMENDATION:** 01B TARGET 8 SP: backend QUANTITY, adapter, Receipt mixto con subconjunto QUANTITY, manual dormido, COUNT_CORRECTION estrecho, tests/docs. Fuera frontend, Sales, Dashboard switch, Healthcare, ASSET/SERIALIZED physical migration, backfill/reconciliación. 01D concilia opening, backfill sólo QUANTITY, reconcilia proyecciones, cambia routing y deshabilita legacy QUANTITY.

**CONSEQUENCE:** DORMANT UNTIL 01D. Cortar por inventoryTracking permite ASSET/SERIALIZED fuera, nunca dos autoridades para el mismo Product. Si implementación demuestra que alcance acotado no cabe, STOP por estimación, sin ampliar ni alterar 8 SP. No rollback a writer agregado tras efectos físicos nuevos sin procedimiento conciliado.

**STATUS:** APPROVED.

## 4. Matriz aprobada por tracking

Describe orquestación 01B dormida; no cambia routing CURRENT. R=Receipt,
M=manual físico. Compatibilidad legacy no-QUANTITY nunca acredita autoridad stock.

| Tracking / lot | R / batch | M físico | Position | EquipmentAsset | stock | batch available | Movement / dueño |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QUANTITY / NONE | Sí; lote prohibido | IN unbatched; OUT sources/count exactos unbatched | Sí | No | Proyección owned | No batch | Compatible atómico; 01B |
| QUANTITY / OPTIONAL | Sí; lote opcional | IN ausencia o batch explícito; OUT sources/count exactos | Sí | No | Proyección owned | Si batch, saldo AVAILABLE | Compatible atómico; 01B |
| QUANTITY / REQUIRED | Sí; lote requerido | IN batch existente; OUT sources/count exactos loteados | Sí | No | Proyección owned | Sí | Compatible atómico; 01B |
| ASSET / NONE | Sí; sin lote | No | No | Sí, provisioning existente | Legacy compatible, no autoridad | No batch | Legacy atómico; físico Equipment/01E |
| ASSET / OPTIONAL | Sí; lote opcional | No | No | Sí | Legacy compatible | Legacy si batch | Legacy atómico; Equipment/01E |
| ASSET / REQUIRED | Sí; lote requerido | No | No | Sí | Legacy compatible | Legacy batch | Legacy atómico; Equipment/01E |
| SERIALIZED / NONE | Sí; sin lote | No | No | No | Legacy compatible | No batch | Legacy; migración física decisión/slice futuro |
| SERIALIZED / OPTIONAL | Sí; lote opcional | No | No | No | Legacy compatible | Legacy si batch | Igual; no tratar como QUANTITY/ASSET |
| SERIALIZED / REQUIRED | Sí; lote requerido | No | No | No | Legacy compatible | Legacy batch | Igual; no foundation serial aprobada |

Receipt mixto mantiene una tx y conjuntos disjuntos; si no hay QUANTITY, cero
Effects materiales. initialQuantity histórico Receipt sigue separado de las
proyecciones físicas para todos los batches aplicables. No crear Position ASSET
ni SERIALIZED en 01B ni en backfill QUANTITY 01D. No fallback legacy para un
Product QUANTITY después de activar su autoridad física.

OUT puede abarcar múltiples pools/batches explícitos; cada revisión debe coincidir.
Count sólo Position AVAILABLE exacta, razón obligatoria, actor y revisión esperada.
Delta cero conserva Effect/Line, quantity/revision sin cambio, cero UPDATE de
proyecciones; ADJUSTMENT compatible conserva saldo owned absoluto, no delta.

## 5. Implementación y aceptación futura

Checkpoints internos dentro de TARGET 8 SP, sin nuevas historias:
B1 proyección/pre-lock; B2 Receipt mixto con QUANTITY físico y Equipment disjunto;
B3 manual dormido + COUNT_CORRECTION estrecho; B4 aceptación/regresión/docs.
No frontend, cutover, Sales, Dashboard switch, backfill, Healthcare ni migración
física ASSET/SERIALIZED. Si discovery de implementación rompe ese límite, STOP.

| Suite futura | Casos obligatorios |
| --- | --- |
| Receipt | A lo sumo un Effect QUANTITY, múltiples productos, batched/unbatched, mismo target normalizado, Receipt sin QUANTITY sin Effect vacío, mixto sin doble identidad, metadata lote contradictoria. Key/hash replay y mismatch. |
| Exactly once | Receipt/items, histórico batch/costo, Equipment, Effect/Positions, proyecciones y Movement una vez. Replay retorna negocio y no llama credit/projection/provisioning. |
| Manual | IN lot matrix, OUT múltiples sources explícitas y revisiones, no CUSTODY/FEFO/batch inferido, actor/RBAC/key, insuficiencia/stale/mismatch, tenant y overflow. |
| Conteo | Delta positivo/negativo/cero; cero exactamente Effect+Line y revision igual, sin UPDATE Position/proyección; no cero revision+1. Hash conteo/revisión solicitados, replay tras cambios posteriores; razón obligatoria, ADMIN/MANAGER. |
| DB shape | COUNT_CORRECTION exactamente una línea AVAILABLE; cero permitido sólo ahí. CREDIT positivo, OUT negativo, TRANSFER balanceado y revisión+1 intactos. Rechazo cero de otros kinds, ecuaciones inválidas y constraints tenant/batch. Sin triggers UPDATE/DELETE. |
| Compatibilidad | ADJUSTMENT quantity=balance=owned resultante, incluyendo cero; notas/referencia de conteo; historia antigua intacta. OUT multi-source filas/balances deterministas. Batch state AVAILABLE distinto de disponibilidad elegible. |
| Rollback | Fallos tras Receipt, Batch, Effect, Position, stock, Movement, Equipment, completion y validación diferida: ningún estado parcial de ninguno de los subconjuntos. |
| PostgreSQL aislado futuro | Receipts concurrentes mismo batch existente/ausente, roots en orden opuesto, Receipt vs débito físico, origen/hash igual y distinto, retry sin drift; clientes distintos y bloqueo real observable. Conteo cero vs débito con revisión esperada. |
| Locks Equipment | Preasignación ASSET sequence antes de Product, provisioning sin nuevo lock tardío; Receipt mixto concurrente con otros callers Equipment, sin inversión. |
| Activación | Rutas legacy y Sales unchanged, ningún caller físico productivo nuevo ni lecturas parciales. Cutover posterior deshabilita writer legacy para mismo Product QUANTITY, excluye ASSET/SERIALIZED Positions. |

Estas suites son plan, no resultados ejecutados. En este cierre no hay tests,
Prisma, migración ni actividad DB. Sólo documentación y validación Git.

## 6. Estado final y siguiente acción

TD-INV-01B-01..30 APPROVED.
HC-INVENTORY-CUSTODY-01B TECHNICAL DESIGN APPROVED / PR PENDING — TARGET 8 SP.
Implementation NOT STARTED. Activation DORMANT UNTIL 01D.
01C..01E y HC-DSP-01A/B/C/D BLOCKED; M-HC1 OPEN.

Staging selectivo -> commit técnico -> PR; después del merge, iniciar implementación
01B de backend dormido dentro del alcance aprobado. Este cierre deja todo unstaged
y no ejecuta esos pasos Git.
