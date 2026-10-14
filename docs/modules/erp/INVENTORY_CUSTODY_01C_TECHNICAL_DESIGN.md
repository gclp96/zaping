# HC-INVENTORY-CUSTODY-01C — Technical Design — Human Review Closeout

## A. Resumen ejecutivo

HC-INVENTORY-CUSTODY-01C — TECHNICAL DESIGN: APPROVED, con restricciones humanas vinculantes.
IMPLEMENTATION: COMPLETE — IMPLEMENTED / TESTED. Integración backend interna, DORMANT UNTIL 01D.
TARGET: 8 SP; no Forecast, Commitment ni Actual.
ACTIVATION: DORMANT UNTIL 01D, incluso después de implementación, pruebas y merge futuros.
01B COMPLETE / MERGED — PR #79; base `b70c2063cc4a5ef2184d80cbc1d4a645ba1d7b55`.
Rama `docs/hc-inventory-custody-01c-technical-design`; TD-INV-01C-01..36 aprobadas.
NONE y OPTIONAL sólo consumen el pool canónico AVAILABLE sin lote; REQUIRED conserva rechazo.
Candidate C restringe V1 de01C, no redefine permanentemente OPTIONAL.
01D debe detener cutover si stock OPTIONAL real batched históricamente vendible queda inaccesible.
No FEFO/FIFO comercial, selección oculta por ID, lot picker, CUSTODY ni OPTIONAL batched.
Retry coherente por mismo actor original: autorización actual, éxito canónico y ZERO WRITES.
Otro actor conserva semántica ya aprobada/ya convertida, ZERO WRITES; actor histórico no necesita seguir activo.
Identidad natural sin Idempotency-Key; UNIQUE Effect origen y Sale.quoteId respaldan DB.
Business locks → TODOS Products ASC → discovery → TODOS Batches ASC → TODAS Positions ASC → revalidar.
READ COMMITTED; máximo tres intentos sólo de aborts transitorios confirmados; colisión Effect aborta y relee fresco.
Un Effect SALE/sale.id/CONFIRM DEFINITIVE_OUT; adapter01B y Movement por partida sólo Candidate-C.
Manifest legacy, accessibility gate y reaudit locks son dependencias de activación01D, no blockers de01C dormido.
Implementación y aceptación local completadas; sin schema/migraciones, activación, staging ni commit. M-HC1 OPEN.

## B. Tabla completa de decisiones aprobadas

La aprobación humana del delta es vinculante. Los sufijos WITH identifican
restricciones obligatorias; no representan decisiones pendientes.
Evidencia repo bajo `app/api/src`, salvo schema/migrations; rutas completas en §2.

| TD-ID | Decisión | Decisión aprobada | Evidencia repo | Riesgo controlado | Estado |
| --- | --- | --- | --- | --- | --- |
| TD-INV-01C-01 | Activation model | Mantener approve/createFromQuote actuales; nuevos servicios internos sin callers productivos, flags ni shadow writes hasta 01D. | Sales service approve/createFromQuote; guard de dormancia físico | Rutas físicas activadas aisladamente | APPROVED |
| TD-INV-01C-02 | Evento físico | Una PhysicalEffect por confirmación física Sale: originType=SALE, originId=sale.id, originOperation=CONFIRM, kind=DEFINITIVE_OUT. Todas las partidas/fuentes comparten el Effect; UNIQUE Company/origen arbitra en DB. INSERT normal; colisión aborta tx y el outer owner relee fresco. | schema Effect @@unique; migration20261013000000; repository.claimEffect | Dos requests ven ausencia antes de INSERT | APPROVED |
| TD-INV-01C-03 | Actor | Propagar actorId JWT real a integración interna approve/createFromQuote, Effect y Movement.createdBy. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo. | SalesController + JwtStrategy.validate | Actor falsificado o ausente | APPROVED WITH ACTOR CONSTRAINT |
| TD-INV-01C-04 | Idempotencia approve | Idempotencia lógica con identidad natural Company+sale.id+CONFIRM, sin Idempotency-Key. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo. | sales.service.ts:245 y :309; schema Sale/Effect | Cambio público limitado al mismo actor | APPROVED WITH ACTOR-REPLAY CONSTRAINT |
| TD-INV-01C-05 | Idempotencia Quote | Identidad natural Company+quoteId; UNIQUE Sale.quoteId garantiza como máximo una Sale Y. Resolver Y y su Effect SALE/Y/CONFIRM al repetir, sin nuevo folio ni Sale. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo. | sales.service.ts:569/:641; schema Sale.quoteId; migration20260813233404 | Recrear Sale ante respuesta perdida | APPROVED WITH ACTOR-REPLAY CONSTRAINT |
| TD-INV-01C-06 | Tracking | QUANTITY exclusivamente; revalidar productos activos del tenant dentro de la transacción. | assertGenericSaleProductEligibility; sales.service.spec tracking | Ampliar tracking sin contrato | APPROVED |
| TD-INV-01C-07 | NONE | NONE consume sólo el pool canónico AVAILABLE unbatched de Company/Product, suficiente y con revision exacta; jamás batch ni CUSTODY. | migration position_available_unbatched_uq; repository | Seleccionar lote para NONE | APPROVED |
| TD-INV-01C-08 | REQUIRED | Preservar rechazo actual de REQUIRED en generic Sales. Sin lot picker, FEFO ni batch-aware fulfillment en01C. | sales.service.ts:34; tracking specs | Pull-in de UI/fulfillment | APPROVED |
| TD-INV-01C-09 | OPTIONAL | Candidato C aprobado para V1: OPTIONAL consume automáticamente sólo el pool canónico AVAILABLE unbatched. Inventory conserva pools batched/unbatched, pero Sales01C no consume batches ni CUSTODY, ni selecciona por FEFO/FIFO/IDs. Restricción de alcance01C, no redefinición permanente de OPTIONAL. 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible. | Sales API sin sources; schema OPTIONAL | Saldo batch inaccesible comercialmente | APPROVED WITH 01D ACCESSIBILITY GATE |
| TD-INV-01C-10 | Resolver | SalesPhysicalSourceResolver interno read-only: business aggregate lock → conjunto completo Products → TODOS Product roots ASC → discovery → TODOS Batches ASC → TODAS Positions ASC → revalidar → PhysicalInventoryService. Lecturas antes del root sólo identifican IDs, nunca autorizan gasto; Product es frontera estable incluso si Receipt crea Position. | physical repository.lockProducts/lockPositions | Plan obsoleto antes del lock | APPROVED |
| TD-INV-01C-11 | Plan normalizado | Plan interno {saleItemId,productId,requestedQuantity,sources:[{positionId,quantity,expectedRevision}]}; enteros positivos, suma exacta y fuentes únicas. Conjunto completo de Product roots antes de discovery; canonicalización para locks, no selección comercial por ID. | SaleItem schema; create/Quote duplicate validation | Confundir Product único de servicio con constraint DB | APPROVED |
| TD-INV-01C-12 | Multi-position | Conservar soporte estructural del core para varias fuentes y EffectLines exactas (6+4 para partida10). Candidate C NO habilita sourcing comercial multi-batch ni selección pública/automática por lotes; no duplicar SaleItems. Una partida Candidate-C sólo consume su pool canónico sin lote. | PhysicalOperation DEFINITIVE_OUT.debits; EffectLine unique Position | Confundir ejemplo multi-source con alcance comercial aprobado | APPROVED WITH STRUCTURAL-ONLY MULTI-SOURCE CONSTRAINT |
| TD-INV-01C-13 | Disponibilidad | availableForSale=sum(quantity de AVAILABLE elegibles bajo política Sales), leído bajo roots; C cuenta sólo unbatched. | Physical read/core; projection01B | Usar owned como spendable | APPROVED |
| TD-INV-01C-14 | Batch eligibility | Conservar predicados de elegibilidad existentes del core (isActive, expirationDate>now o null), sin nuevas reglas de expiración. Candidate C no consume batches; sin FEFO/FIFO comercial. | physical-inventory.service.validateKey; InventoryBatch schema | Inventar regla comercial de vencimiento | APPROVED |
| TD-INV-01C-15 | Orden de confirmación | Claim business bajo lock, TODOS Products ASC → discovery → TODOS Batches ASC → TODAS Positions ASC → revalidación → core Effect claim antes de balances → proyección → history → readback → commit único. READ COMMITTED explícito con locks/claims, no SERIALIZABLE por defecto. | Sales conditional claim + core claimEffect | Commit de CONFIRMED sin OUT | APPROVED |
| TD-INV-01C-16 | Locks approve/cancel | approve: Sale tenant → Products → Batches → Positions. Cancel conserva claim sólo DRAFT, nunca solicita Product y no revierte venta confirmada. | Sale approve/cancel updateMany DRAFT | Inversión Sale/Product | APPROVED |
| TD-INV-01C-17 | Locks Quote/Folio | createFromQuote: SALE_FOLIO CompanySequence → Quote → nueva Sale → TODOS Products ASC → TODOS Batches ASC → TODAS Positions ASC. Retener Folio-before-Quote: no se identificó ruta activa inversa en el baseline. 01D debe reauditar jerarquía global antes del cutover. | sales-folio.service; allocator; createFromQuote; Quotes approve/cancel | Quote→Folio inverso de ruta vigente | APPROVED WITH 01D LOCK-ORDER REAUDIT |
| TD-INV-01C-18 | Grouping | Un DEFINITIVE_OUT para todos los debits normalizados, una línea negativa por Position; UNIQUE (companyId, originType, originId, originOperation) respalda SALE/sale.id/CONFIRM. Ningún Effect independiente por partida/batch. | Effect/Line schema y definitiveOut | Partir confirmación entre Effects | APPROVED |
| TD-INV-01C-19 | OUT definitivo | DEFINITIVE_OUT reduce owned; Dispatch futuro usa TRANSFER AVAILABLE→CUSTODY preservando owned. | Current Sale OUT; physical kind DEFINITIVE_OUT | Confundir salida con custodia | APPROVED |
| TD-INV-01C-20 | Proyecciones | Reutilizar InventoryCompatibilityProjectionService en la misma transacción después del core, desde hechos físicos persistidos. Sales no implementa matemática de stock ni segundo decremento directo de Product.stock. | inventory-compatibility-projection.service.ts | Doble decremento stock | APPROVED |
| TD-INV-01C-21 | Movement | Para Candidate C, extensión estrecha del helper01B: un InventoryMovement OUT por SaleItem/Product; quantity partida, balance final Product.stock, unitCost Product.cost bajo root, SALE/sale.id, createdBy=Effect.actorId, batchId=null. EffectLines preservan fuentes. batchId=null aprobado sólo para alcance unbatched Candidate-C; soporte futuro batched debe revisar granularidad. | inventory-compatibility-history.service.ts:write | Default manual produce referencia/granularidad equivocadas | APPROVED WITH CANDIDATE-C HISTORY CONSTRAINT |
| TD-INV-01C-22 | Balance Movement | Candidate C: quantity=SaleItem.quantity; balance=Product.stock final proyectado; unitCost=Product.cost bajo root, no precio Sale; referenceType=SALE, referenceId=sale.id, createdBy=Effect.actorId, batchId=null. Validar sumas contra EffectLines; regla batchId=null no se extiende a futuras Sales batched. | Sales Product.cost y saldo posterior; helper01B | Duplicar cantidades por fuente | APPROVED |
| TD-INV-01C-23 | Auditoría | Actor histórico canónico en PhysicalEffect.actorId y Movement.createdBy; no nuevo campo Sale ni overwrite en retry. El actor histórico no necesita seguir activo; sólo el actor del NUEVO request debe autenticar/autorizarse actualmente. | Sale schema sin confirmedBy; Effect.actorId; Movement.createdBy | Ampliación de auditoría | APPROVED WITH HISTORICAL-ACTOR CONSTRAINT |
| TD-INV-01C-24 | Replay approve | Aplicar matriz §7: Sale CONFIRMED+Effect coherente permite éxito canónico ZERO WRITES sólo al mismo actor original autenticado/autorizado actualmente. Otro actor conserva error ya aprobada. Legacy certificado conserva error; ausencia inesperada/unknown/mismatch/inversión produce error de integridad sin reparación. | Sales error CONFIRMED; Effect origin lookup | Confundir legacy con corrupción | APPROVED WITH ACTOR-REPLAY CONSTRAINT |
| TD-INV-01C-25 | Replay conversión | Resolver Sale Y canónica por Company+quoteId y validar flag/estado/Effect. Mismo actor original autenticado/autorizado actualmente recibe éxito lógico ZERO WRITES; otro actor conserva error ya convertida. No nuevo Sale.id/folio/Effect ni reset flag; incoherencia falla cerrado. | Sale.quoteId único + Quote.convertedToSale | Flag incoherente crea segunda identidad | APPROVED WITH ACTOR-REPLAY CONSTRAINT |
| TD-INV-01C-26 | Atomicidad | READ COMMITTED explícito y caller tx única; rollback completo business/físico/proyecciones/history. Outer retry máximo TRES intentos totales sólo ante abort confirmado transitorio (40001/40P01). No retry genérico de insuficiencia, stale business, fuente inválida, mismatch, P2002/unique arbitrario ni business errors. Effect UNIQUE: abort+fresh readback; commit incierto: readback business antes de nueva mutación. | Tx Sales y TransactionClient01A/B | Efectos parciales o retry en tx abortada | APPROVED WITH BOUNDED-RETRY CONSTRAINT |
| TD-INV-01C-27 | Concurrencia | Matriz §8 con Sale/Sale, manual OUT, count, Receipt, Dispatch futuro, mismo Sale/Quote y cancel. | Core locks y mutatePosition revision/quantity | Oversell entre writers diferentes | APPROVED |
| TD-INV-01C-28 | Compatibilidad locks | Orden físico vinculante repository DB: TODOS Product IDs ASC → TODOS Batch IDs ASC → TODAS Position IDs ASC. Nunca Product A→Batch A→Product B. Sale/Manual/Receipt y futuro Dispatch comparten frontera Product; parents business antes, nunca locks tardíos inversos. | repository ORDER BY id FOR UPDATE; Receipt locks | Orden total ambiguo o phantom de pool nuevo | APPROVED |
| TD-INV-01C-29 | Writer inventory | 01D redirige ambos caminos; helper purchase deprecado sin callers debe retirarse/inhibirse en cutover; tests/fixtures no son writers productivos. | Sales stock:339/:698; Inventory legacy y Receipt | Writer legacy omitido | APPROVED |
| TD-INV-01C-30 | API | Mismas rutas/body/shape sin Idempotency-Key ni selección pública de fuentes. Cambio público aprobado al activar: mismo actor original y estado coherente reciben éxito lógico ZERO WRITES; otro actor conserva rechazo ya aprobado/convertido. Sin frontend ni controller implementation en esta tarea. | Controller y hooks Sales/Quote sin body/key | Éxito replay tratado como cambio inocuo | APPROVED WITH ACTOR-REPLAY CONSTRAINT |
| TD-INV-01C-31 | Tabla OPTIONAL | Candidate C aprobado: los seis escenarios de §4 usan sólo AVAILABLE unbatched; cualquier saldo batch queda fuera del pool Sales01C, sin FEFO/FIFO/ID selection/lot picker. 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible. | Tabla §4; OPTIONAL actual sin lote seleccionado | Regla automática encubierta | APPROVED — CANDIDATE C |
| TD-INV-01C-32 | Error REQUIRED | Preservar texto: El producto ${product.name} requiere selección de lote para completar la venta; mismo rechazo en create/approve/conversión. | assertGenericSaleProductEligibility REQUIRED | Regresión del rechazo | APPROVED |
| TD-INV-01C-33 | Read model | Read helper tenant-scoped por origen SALE/sale.id/CONFIRM con lines/Position para auditoría y clasificación; sin ampliar respuesta pública. | Sale response include; Effect origin/Lines | Expandir Sale360/API por conveniencia | APPROVED |
| TD-INV-01C-34 | Legacy | No backfill de Effects históricos ni replay OUT. Ausencia de Effect no prueba legacy y timestamps solos están prohibidos. Unknown falla cerrado. 01D define manifest durable/barrera/classification; mecanismo exacto diferido intencionalmente NO bloquea implementación dormida01C y sí es gate de activación. | Legacy Sales sin Effect; baseline actual | Ausencia interpretada como legacy | APPROVED WITH 01D LEGACY-MANIFEST GATE |
| TD-INV-01C-35 | Handoff | 01C entrega integración/resolver/compatibilidad/pruebas internas y permanece DORMANT UNTIL01D incluso IMPLEMENTED/TESTED/MERGED. 01D posee reconciliation, opening Positions, legacy classification, parity validation, writer barrier y cutover QUANTITY coordinado. | 01A/B dormidos y board | Merge interpretado como activación | APPROVED |
| TD-INV-01C-36 | TARGET | TARGET=8 SP aprobado sólo para backend bounded Candidate-C, replay natural por actor y reuso01A/B; TARGET no es Forecast/Commitment/Actual. FEFO, FIFO comercial, lot picker, frontend, Delivery, SalesOrder, CaseDispatch, Return/Reconciliation, nuevas reglas regulatorias o OPTIONAL batched allocation requieren STOP + SCOPE IMPACT / RE-ESTIMATION. | TARGET8 en DEF/board; alcance actual | Absorber producto nuevo dentro de8 | APPROVED |

## C. TD-INV-01C-01..36 — registro final aprobado

### TD-INV-01C-01 — Activation model

- **ID:** TD-INV-01C-01
- **Title:** Activation model
- **Problem:** Activar sólo Sales produciría autoridad dividida.
- **Current repo behavior:** Sales productivo todavía descuenta stock legacy. Evidencia: Sales service approve/createFromQuote; guard de dormancia físico.
- **Proposed design:** Mantener approve/createFromQuote actuales; nuevos servicios internos sin callers productivos, flags ni shadow writes hasta 01D.
- **Alternatives considered:** Activar ahora; flag; integración interna dormida.
- **Recommendation:** Decisión humana vinculante: Mantener approve/createFromQuote actuales; nuevos servicios internos sin callers productivos, flags ni shadow writes hasta 01D.
- **Trade-offs:** 01C valida capacidad, no acredita seguridad productiva conjunta. Riesgo específico: Rutas físicas activadas aisladamente.
- **Concurrency impact:** Sin efectos desde controllers antes de01D.
- **Idempotency impact:** Rutas legacy conservan duplicate-safe actual.
- **01B compatibility:** Componer internos sin tocar routing.
- **01D dependency:** Activación coordinada obligatoria.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Estático callers + ruta sin Effect. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-02 — Evento físico

- **ID:** TD-INV-01C-02
- **Title:** Evento físico
- **Problem:** Hace falta una identidad común para todas las partidas.
- **Current repo behavior:** Confirmación actual produce OUT inmediato. Evidencia: schema Effect @@unique; migration20261013000000; repository.claimEffect.
- **Proposed design:** Una PhysicalEffect por confirmación física Sale: originType=SALE, originId=sale.id, originOperation=CONFIRM, kind=DEFINITIVE_OUT. Todas las partidas/fuentes comparten el Effect; UNIQUE Company/origen arbitra en DB. INSERT normal; colisión aborta tx y el outer owner relee fresco.
- **Alternatives considered:** Effect por partida/fuente; Effect por Sale.
- **Recommendation:** Decisión humana vinculante: Una PhysicalEffect por confirmación física Sale: originType=SALE, originId=sale.id, originOperation=CONFIRM, kind=DEFINITIVE_OUT. Todas las partidas/fuentes comparten el Effect; UNIQUE Company/origen arbitra en DB. INSERT normal; colisión aborta tx y el outer owner relee fresco.
- **Trade-offs:** Ambos caminos convergen en el mismo origen; todas las líneas se confirman juntas. Riesgo específico: Dos requests ven ausencia antes de INSERT.
- **Concurrency impact:** UNIQUE Company/origen arbitra; perdedor aborta completo.
- **Idempotency impact:** Sólo una confirmación lógica por Sale.
- **01B compatibility:** Mismo INSERT normal y error de claim01A/B.
- **01D dependency:** Origen sólo se usa en ventas físicas post-cutover.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Dos INSERT de origen idéntico; un commit. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-03 — Actor

- **ID:** TD-INV-01C-03
- **Title:** Actor
- **Problem:** El core exige actor real.
- **Current repo behavior:** JWT valida User activo del tenant; controller tiene user.id pero no lo pasa a approve/conversión. Evidencia: SalesController + JwtStrategy.validate.
- **Proposed design:** Propagar actorId JWT real a integración interna approve/createFromQuote, Effect y Movement.createdBy. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **Alternatives considered:** Actor JWT; usuario sintético; actor opcional.
- **Recommendation:** Decisión humana vinculante: Propagar actorId JWT real a integración interna approve/createFromQuote, Effect y Movement.createdBy. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **Trade-offs:** Preserva auditoría original sin ampliar schema. El actor histórico no debe seguir activo; sólo quien hace el nuevo request debe autenticar y autorizarse actualmente.
- **Concurrency impact:** Actor no altera orden locks.
- **Idempotency impact:** Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **01B compatibility:** Effect.actorId y history.createdBy existentes.
- **01D dependency:** 01D conecta actor JWT al servicio interno.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Mismo actor autorizado tras respuesta perdida y concurrencia: éxito canónico ZERO WRITES; otro actor autorizado: error histórico ZERO WRITES; actor original desactivado no invalida historia; request sin autorización actual rechazado; actorId original intacto. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH ACTOR CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH ACTOR CONSTRAINT

### TD-INV-01C-04 — Idempotencia approve

- **ID:** TD-INV-01C-04
- **Title:** Idempotencia approve
- **Problem:** Exactly-once físico no determina respuesta HTTP.
- **Current repo behavior:** Repetir CONFIRMED devuelve error ya aprobada. Evidencia: sales.service.ts:245 y :309; schema Sale/Effect.
- **Proposed design:** Idempotencia lógica con identidad natural Company+sale.id+CONFIRM, sin Idempotency-Key. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **Alternatives considered:** A: Idempotency-Key/scope nuevo; B: estado+origen; C: conservar error legacy.
- **Recommendation:** Decisión humana vinculante: Idempotencia lógica con identidad natural Company+sale.id+CONFIRM, sin Idempotency-Key. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **Trade-offs:** Cambio público aprobado respecto al error histórico sólo para retry coherente del mismo actorId del Effect. Otro actor conserva error business. Éxito lógico no garantiza JSON byte-for-byte y nunca sobrescribe auditoría.
- **Concurrency impact:** Sale lock seguido roots; perdedor relee fresco.
- **Idempotency impact:** Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **01B compatibility:** No cambiar hash físico ni scopes01B.
- **01D dependency:** Sólo after-cutover con evidencia coherente.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Mismo actor autorizado tras respuesta perdida y concurrencia: éxito canónico ZERO WRITES; otro actor autorizado: error histórico ZERO WRITES; actor original desactivado no invalida historia; request sin autorización actual rechazado; actorId original intacto. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH ACTOR-REPLAY CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH ACTOR-REPLAY CONSTRAINT

### TD-INV-01C-05 — Idempotencia Quote

- **ID:** TD-INV-01C-05
- **Title:** Idempotencia Quote
- **Problem:** El origen físico usa Sale.id, no quoteId.
- **Current repo behavior:** convertedToSale condicional y Sale.quoteId único protegen conversión. Evidencia: sales.service.ts:569/:641; schema Sale.quoteId; migration20260813233404.
- **Proposed design:** Identidad natural Company+quoteId; UNIQUE Sale.quoteId garantiza como máximo una Sale Y. Resolver Y y su Effect SALE/Y/CONFIRM al repetir, sin nuevo folio ni Sale. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **Alternatives considered:** Key/scope; identidad quoteId más relación única.
- **Recommendation:** Decisión humana vinculante: Identidad natural Company+quoteId; UNIQUE Sale.quoteId garantiza como máximo una Sale Y. Resolver Y y su Effect SALE/Y/CONFIRM al repetir, sin nuevo folio ni Sale. Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **Trade-offs:** Cambio público aprobado respecto al error histórico sólo para retry coherente del mismo actorId del Effect. Otro actor conserva error business. Éxito lógico no garantiza JSON byte-for-byte y nunca sobrescribe auditoría.
- **Concurrency impact:** Folio→Quote claim; UNIQUE quoteId defensa DB.
- **Idempotency impact:** Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **01B compatibility:** Core/projection/history una sola vez.
- **01D dependency:** Legacy convertido necesita clasificación01D.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Mismo actor autorizado tras respuesta perdida y concurrencia: éxito canónico ZERO WRITES; otro actor autorizado: error histórico ZERO WRITES; actor original desactivado no invalida historia; request sin autorización actual rechazado; actorId original intacto. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH ACTOR-REPLAY CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH ACTOR-REPLAY CONSTRAINT

### TD-INV-01C-06 — Tracking

- **ID:** TD-INV-01C-06
- **Title:** Tracking
- **Problem:** Evitar ampliar fulfillment.
- **Current repo behavior:** Generic Sales admite QUANTITY; rechaza ASSET/SERIALIZED. Evidencia: assertGenericSaleProductEligibility; sales.service.spec tracking.
- **Proposed design:** QUANTITY exclusivamente; revalidar productos activos del tenant dentro de la transacción.
- **Alternatives considered:** Preservar; ampliar.
- **Recommendation:** Decisión humana vinculante: QUANTITY exclusivamente; revalidar productos activos del tenant dentro de la transacción.
- **Trade-offs:** No integración Equipment ni ventas serializadas. Riesgo específico: Ampliar tracking sin contrato.
- **Concurrency impact:** Validación bajo roots antes de consumo.
- **Idempotency impact:** Retry no habilita producto incompatible nuevo.
- **01B compatibility:** QUANTITY core; ASSET separado01B.
- **01D dependency:** No activar otros tracking.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** ASSET/SERIALIZED y mixtos rechazados. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-07 — NONE

- **ID:** TD-INV-01C-07
- **Title:** NONE
- **Problem:** Stock agregado no identifica fuente física.
- **Current repo behavior:** Índice parcial único Company/Product AVAILABLE sin batch. Evidencia: migration position_available_unbatched_uq; repository.
- **Proposed design:** NONE consume sólo el pool canónico AVAILABLE unbatched de Company/Product, suficiente y con revision exacta; jamás batch ni CUSTODY.
- **Alternatives considered:** Pool canónico; lote automático.
- **Recommendation:** Decisión humana vinculante: NONE consume sólo el pool canónico AVAILABLE unbatched de Company/Product, suficiente y con revision exacta; jamás batch ni CUSTODY.
- **Trade-offs:** Cero o una Position canónica; ausencia equivale a disponibilidad cero. Riesgo específico: Seleccionar lote para NONE.
- **Concurrency impact:** Product root protege descubrimiento de pool ausente.
- **Idempotency impact:** Revision sólo para primera ejecución; no re-resolver éxito.
- **01B compatibility:** Pool canónico01A/B.
- **01D dependency:** Opening correcto por Company/Product.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Suficiente/ausente/CUSTODY/insuficiente. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-08 — REQUIRED

- **ID:** TD-INV-01C-08
- **Title:** REQUIRED
- **Problem:** Seleccionar lote requeriría otro contrato.
- **Current repo behavior:** Se rechaza en create, approve y conversión. Evidencia: sales.service.ts:34; tracking specs.
- **Proposed design:** Preservar rechazo actual de REQUIRED en generic Sales. Sin lot picker, FEFO ni batch-aware fulfillment en01C.
- **Alternatives considered:** Preservar rechazo; UI explícita; fulfillment posterior.
- **Recommendation:** Decisión humana vinculante: Preservar rechazo actual de REQUIRED en generic Sales. Sin lot picker, FEFO ni batch-aware fulfillment en01C.
- **Trade-offs:** TARGET 8 no incluye UI ni soporte REQUIRED. Riesgo específico: Pull-in de UI/fulfillment.
- **Concurrency impact:** Rechazo anterior a mutación.
- **Idempotency impact:** Repetición rechazada sin writes.
- **01B compatibility:** No cambiar política core genérica para otros callers.
- **01D dependency:** 01D preserva restricción Sales.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Texto exacto en create/approve/conversión. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-09 — OPTIONAL

- **ID:** TD-INV-01C-09
- **Title:** OPTIONAL
- **Problem:** Puede existir saldo en múltiples pools físicamente distintos.
- **Current repo behavior:** Se admite sin batch/source en API actual. Evidencia: Sales API sin sources; schema OPTIONAL.
- **Proposed design:** Candidato C aprobado para V1: OPTIONAL consume automáticamente sólo el pool canónico AVAILABLE unbatched. Inventory conserva pools batched/unbatched, pero Sales01C no consume batches ni CUSTODY, ni selecciona por FEFO/FIFO/IDs. Restricción de alcance01C, no redefinición permanente de OPTIONAL. 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible.
- **Alternatives considered:** A explícito; B orden automático; C sólo unbatched; D sólo pool elegible único.
- **Recommendation:** Decisión humana vinculante: Candidato C aprobado para V1: OPTIONAL consume automáticamente sólo el pool canónico AVAILABLE unbatched. Inventory conserva pools batched/unbatched, pero Sales01C no consume batches ni CUSTODY, ni selecciona por FEFO/FIFO/IDs. Restricción de alcance01C, no redefinición permanente de OPTIONAL. 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible.
- **Trade-offs:** Stock OPTIONAL batched queda fuera del pool Sales01C; restricción V1, no redefinición permanente. 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible.
- **Concurrency impact:** Discovery bajo Product; jamás elegir primer batch.
- **Idempotency impact:** Política estable para primera ejecución; retry usa evidencia.
- **01B compatibility:** Inventory conserva lotes y pools sin lote.
- **01D dependency:** 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible.
- **Scope impact:** Mantener TARGET8 sólo para alcance backend aprobado; ampliación comercial, fuentes públicas/UI o batched OPTIONAL requieren STOP + SCOPE IMPACT / RE-ESTIMATION.
- **Test implications:** OPTIONAL unbatched; batch-only rechazado. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH 01D ACCESSIBILITY GATE. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH 01D ACCESSIBILITY GATE

### TD-INV-01C-10 — Resolver

- **ID:** TD-INV-01C-10
- **Title:** Resolver
- **Problem:** No mezclar política comercial con autoridad física.
- **Current repo behavior:** 01A muta y 01B proyecta; Sales todavía no resuelve fuentes. Evidencia: physical repository.lockProducts/lockPositions.
- **Proposed design:** SalesPhysicalSourceResolver interno read-only: business aggregate lock → conjunto completo Products → TODOS Product roots ASC → discovery → TODOS Batches ASC → TODAS Positions ASC → revalidar → PhysicalInventoryService. Lecturas antes del root sólo identifican IDs, nunca autorizan gasto; Product es frontera estable incluso si Receipt crea Position.
- **Alternatives considered:** Resolver Sales específico; framework outbound genérico.
- **Recommendation:** Decisión humana vinculante: SalesPhysicalSourceResolver interno read-only: business aggregate lock → conjunto completo Products → TODOS Product roots ASC → discovery → TODOS Batches ASC → TODAS Positions ASC → revalidar → PhysicalInventoryService. Lecturas antes del root sólo identifican IDs, nunca autorizan gasto; Product es frontera estable incluso si Receipt crea Position.
- **Trade-offs:** PhysicalInventoryService sigue siendo única autoridad de mutación; no framework genérico prematuro. Riesgo específico: Plan obsoleto antes del lock.
- **Concurrency impact:** Product root antes de discovery; locks dependientes después.
- **Idempotency impact:** Resolver no corre para éxito ya comprometido.
- **01B compatibility:** Core muta; resolver no crea segunda autoridad.
- **01D dependency:** Todos writers deben respetar roots.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Receipt crea pool mientras Sale intenta resolver. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-11 — Plan normalizado

- **ID:** TD-INV-01C-11
- **Title:** Plan normalizado
- **Problem:** Se necesita validar mapping sin confiar sólo en DTO.
- **Current repo behavior:** Servicio rechaza Product duplicado; schema no tiene UNIQUE Sale/Product. Evidencia: SaleItem schema; create/Quote duplicate validation.
- **Proposed design:** Plan interno {saleItemId,productId,requestedQuantity,sources:[{positionId,quantity,expectedRevision}]}; enteros positivos, suma exacta y fuentes únicas. Conjunto completo de Product roots antes de discovery; canonicalización para locks, no selección comercial por ID.
- **Alternatives considered:** Map por Product; plan con SaleItem.
- **Recommendation:** Decisión humana vinculante: Plan interno {saleItemId,productId,requestedQuantity,sources:[{positionId,quantity,expectedRevision}]}; enteros positivos, suma exacta y fuentes únicas. Conjunto completo de Product roots antes de discovery; canonicalización para locks, no selección comercial por ID.
- **Trade-offs:** Conservar saleItemId para trazabilidad de mapping; comprobar unicidad Product al cargar Sale/Quote y rechazar inconsistencia, sin reescribir partidas. Riesgo específico: Confundir Product único de servicio con constraint DB.
- **Concurrency impact:** Cargar partidas consistentes bajo aggregate lock.
- **Idempotency impact:** No recalcular plan de retry confirmado.
- **01B compatibility:** Plan traduce a debits core normalizados.
- **01D dependency:** No backfill del plan histórico.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Duplicados/sumas/revision/tenant y sources repetidas. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-12 — Multi-position

- **ID:** TD-INV-01C-12
- **Title:** Multi-position
- **Problem:** Una partida puede requerir varios lotes.
- **Current repo behavior:** Core admite varios debits por Effect. Evidencia: PhysicalOperation DEFINITIVE_OUT.debits; EffectLine unique Position.
- **Proposed design:** Conservar soporte estructural del core para varias fuentes y EffectLines exactas (6+4 para partida10). Candidate C NO habilita sourcing comercial multi-batch ni selección pública/automática por lotes; no duplicar SaleItems. Una partida Candidate-C sólo consume su pool canónico sin lote.
- **Alternatives considered:** Multi-source automático; explícito; restringido.
- **Recommendation:** Decisión humana vinculante: Conservar soporte estructural del core para varias fuentes y EffectLines exactas (6+4 para partida10). Candidate C NO habilita sourcing comercial multi-batch ni selección pública/automática por lotes; no duplicar SaleItems. Una partida Candidate-C sólo consume su pool canónico sin lote.
- **Trade-offs:** Core conserva trazabilidad estructural6+4 en Lines, pero Candidate C no permite allocation comercial multi-batch. Una partida usa sólo el pool canónico unbatched; no UI ni plan público.
- **Concurrency impact:** Todos roots/batches/positions antes de 6+4.
- **Idempotency impact:** Una Effect y un historial agregado, nunca dos confirmations.
- **01B compatibility:** Core/Lines soportan split; history default necesita mapping Sales.
- **01D dependency:** C no habilita split batch por partida.
- **Scope impact:** Mantener TARGET8 sólo para alcance backend aprobado; ampliación comercial, fuentes públicas/UI o batched OPTIONAL requieren STOP + SCOPE IMPACT / RE-ESTIMATION.
- **Test implications:** 6+4 preservado en Lines; C rechaza caso comercial. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH STRUCTURAL-ONLY MULTI-SOURCE CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH STRUCTURAL-ONLY MULTI-SOURCE CONSTRAINT

### TD-INV-01C-13 — Disponibilidad

- **ID:** TD-INV-01C-13
- **Title:** Disponibilidad
- **Problem:** Owned no es cantidad vendible.
- **Current repo behavior:** Product.stock será owned, incluye CUSTODY. Evidencia: Physical read/core; projection01B.
- **Proposed design:** availableForSale=sum(quantity de AVAILABLE elegibles bajo política Sales), leído bajo roots; C cuenta sólo unbatched.
- **Alternatives considered:** stock; todas AVAILABLE; elegibles por política.
- **Recommendation:** Decisión humana vinculante: availableForSale=sum(quantity de AVAILABLE elegibles bajo política Sales), leído bajo roots; C cuenta sólo unbatched.
- **Trade-offs:** Errores hablan de disponibilidad física; jamás fallback a stock ni a CUSTODY. Riesgo específico: Usar owned como spendable.
- **Concurrency impact:** Revalidación cantidad bajo locks + update condicional.
- **Idempotency impact:** Retry no recalcula disponibilidad consumida.
- **01B compatibility:** Proyección no autoriza gasto.
- **01D dependency:** Lectores owned/vendible deben distinguirse.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Owned10/CUSTODY10 no vendible. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-14 — Batch eligibility

- **ID:** TD-INV-01C-14
- **Title:** Batch eligibility
- **Problem:** AVAILABLE no garantiza elegibilidad comercial.
- **Current repo behavior:** Batch tiene isActive y expirationDate; core exige expirationDate>now para AVAILABLE. Evidencia: physical-inventory.service.validateKey; InventoryBatch schema.
- **Proposed design:** Conservar predicados de elegibilidad existentes del core (isActive, expirationDate>now o null), sin nuevas reglas de expiración. Candidate C no consume batches; sin FEFO/FIFO comercial.
- **Alternatives considered:** Ignorar fecha; excluir vencidos/inactivos; FEFO.
- **Recommendation:** Decisión humana vinculante: Conservar predicados de elegibilidad existentes del core (isActive, expirationDate>now o null), sin nuevas reglas de expiración. Candidate C no consume batches; sin FEFO/FIFO comercial.
- **Trade-offs:** Filtro no es FEFO. Bajo C no se gastan batches; alternativas A/B/D deben pasar mismo filtro. Riesgo específico: Inventar regla comercial de vencimiento.
- **Concurrency impact:** Revalidar predicado existente bajo locks/core.
- **Idempotency impact:** Retry exitoso no depende de expiración posterior.
- **01B compatibility:** Conservar01A/B sin nuevas reglas.
- **01D dependency:** No transformación de expiración en cutover01C.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Boundary <=now existente; no nuevas reglas. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-15 — Orden de confirmación

- **ID:** TD-INV-01C-15
- **Title:** Orden de confirmación
- **Problem:** No puede persistir CONFIRMED sin OUT.
- **Current repo behavior:** Legacy reclama DRAFT antes de decremento dentro de tx. Evidencia: Sales conditional claim + core claimEffect.
- **Proposed design:** Claim business bajo lock, TODOS Products ASC → discovery → TODOS Batches ASC → TODAS Positions ASC → revalidación → core Effect claim antes de balances → proyección → history → readback → commit único. READ COMMITTED explícito con locks/claims, no SERIALIZABLE por defecto.
- **Alternatives considered:** Estado antes/después del físico.
- **Recommendation:** Decisión humana vinculante: Claim business bajo lock, TODOS Products ASC → discovery → TODOS Batches ASC → TODAS Positions ASC → revalidación → core Effect claim antes de balances → proyección → history → readback → commit único. READ COMMITTED explícito con locks/claims, no SERIALIZABLE por defecto.
- **Trade-offs:** Cualquier fallo revierte también estado y efectos. Riesgo específico: Commit de CONFIRMED sin OUT.
- **Concurrency impact:** Business claim → roots → core → projection → history.
- **Idempotency impact:** Claim físico antes de balances, readback después de abort.
- **01B compatibility:** Una caller-owned tx.
- **01D dependency:** Routing01D; no tx física productiva ahora.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Fault injection cada etapa. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-16 — Locks approve/cancel

- **ID:** TD-INV-01C-16
- **Title:** Locks approve/cancel
- **Problem:** Preservar exclusión sin invertir locks físicos.
- **Current repo behavior:** Ambos usan updateMany DRAFT; cancel sólo toca Sale. Evidencia: Sale approve/cancel updateMany DRAFT.
- **Proposed design:** approve: Sale tenant → Products → Batches → Positions. Cancel conserva claim sólo DRAFT, nunca solicita Product y no revierte venta confirmada.
- **Alternatives considered:** Sale antes de Product; Product antes de Sale.
- **Recommendation:** Decisión humana vinculante: approve: Sale tenant → Products → Batches → Positions. Cancel conserva claim sólo DRAFT, nunca solicita Product y no revierte venta confirmada.
- **Trade-offs:** Ganador determina estado; perdedor relee tras rollback/bajo lock. Ningún camino físico debe adquirir Sale después de Product. Riesgo específico: Inversión Sale/Product.
- **Concurrency impact:** Sale antes de Products; cancel nunca pide Product.
- **Idempotency impact:** Mismo Sale serializa; perdedor clasifica.
- **01B compatibility:** Orden físico intacto.
- **01D dependency:** Ningún otro writer adquiere Sale después de roots.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Approve vs cancel y dos approvals. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-17 — Locks Quote/Folio

- **ID:** TD-INV-01C-17
- **Title:** Locks Quote/Folio
- **Problem:** Invertir Quote/sequence sin revisar sería riesgoso.
- **Current repo behavior:** Conversión actual asigna SALE_FOLIO antes de update Quote; create usa sequence antes de nueva Sale. Evidencia: sales-folio.service; allocator; createFromQuote; Quotes approve/cancel.
- **Proposed design:** createFromQuote: SALE_FOLIO CompanySequence → Quote → nueva Sale → TODOS Products ASC → TODOS Batches ASC → TODAS Positions ASC. Retener Folio-before-Quote: no se identificó ruta activa inversa en el baseline. 01D debe reauditar jerarquía global antes del cutover.
- **Alternatives considered:** Quote primero; conservar sequence primero.
- **Recommendation:** Decisión humana vinculante: createFromQuote: SALE_FOLIO CompanySequence → Quote → nueva Sale → TODOS Products ASC → TODOS Batches ASC → TODAS Positions ASC. Retener Folio-before-Quote: no se identificó ruta activa inversa en el baseline. 01D debe reauditar jerarquía global antes del cutover.
- **Trade-offs:** No se encontró inversión actual: approve/cancel Quote no toman sequence/Products. Replay temprano es read-only; no asigna folio si ya convertido. Riesgo específico: Quote→Folio inverso de ruta vigente.
- **Concurrency impact:** Folio→Quote→nueva Sale→Products→Batches→Positions.
- **Idempotency impact:** Readback duplicado sin nuevo folio.
- **01B compatibility:** No cambiar secuencias Equipment01B.
- **01D dependency:** Reauditar jerarquía global de locks antes del cutover; dependencia vinculante de01D, no bloqueo del backend dormido01C.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Dos conversiones; rollback folio; Quote cambios. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH 01D LOCK-ORDER REAUDIT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH 01D LOCK-ORDER REAUDIT

### TD-INV-01C-18 — Grouping

- **ID:** TD-INV-01C-18
- **Title:** Grouping
- **Problem:** Efectos separados permitirían resultados parciales conceptuales.
- **Current repo behavior:** Effect admite múltiples Products y una línea por Position. Evidencia: Effect/Line schema y definitiveOut.
- **Proposed design:** Un DEFINITIVE_OUT para todos los debits normalizados, una línea negativa por Position; UNIQUE (companyId, originType, originId, originOperation) respalda SALE/sale.id/CONFIRM. Ningún Effect independiente por partida/batch.
- **Alternatives considered:** Por Position; por Sale.
- **Recommendation:** Decisión humana vinculante: Un DEFINITIVE_OUT para todos los debits normalizados, una línea negativa por Position; UNIQUE (companyId, originType, originId, originOperation) respalda SALE/sale.id/CONFIRM. Ningún Effect independiente por partida/batch.
- **Trade-offs:** Suma negativa por Product debe igualar SaleItem.quantity; consolidar una misma fuente antes del core o rechazar duplicación. Riesgo específico: Partir confirmación entre Effects.
- **Concurrency impact:** Una tx para conjunto completo.
- **Idempotency impact:** UNIQUE origen único por Sale.
- **01B compatibility:** Multi-product/debits existente.
- **01D dependency:** Un sólo evento por Sale física.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Dos Products y varias Lines; rollback total. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-19 — OUT definitivo

- **ID:** TD-INV-01C-19
- **Title:** OUT definitivo
- **Problem:** No confundir venta con custodia Dispatch.
- **Current repo behavior:** Venta confirmada actual sale de inventario. Evidencia: Current Sale OUT; physical kind DEFINITIVE_OUT.
- **Proposed design:** DEFINITIVE_OUT reduce owned; Dispatch futuro usa TRANSFER AVAILABLE→CUSTODY preservando owned.
- **Alternatives considered:** DEFINITIVE_OUT; TRANSFER.
- **Recommendation:** Decisión humana vinculante: DEFINITIVE_OUT reduce owned; Dispatch futuro usa TRANSFER AVAILABLE→CUSTODY preservando owned.
- **Trade-offs:** No reserva física nueva ni reversal de ventas confirmadas. Riesgo específico: Confundir salida con custodia.
- **Concurrency impact:** Compite por AVAILABLE con futuro TRANSFER.
- **Idempotency impact:** Una CONFIRM, sin reserva adicional.
- **01B compatibility:** OwnedDelta negativo adapter.
- **01D dependency:** Dispatch futuro debe integrar mismo protocolo.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Owned baja; CUSTODY nunca gastada. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-20 — Proyecciones

- **ID:** TD-INV-01C-20
- **Title:** Proyecciones
- **Problem:** Duplicar matemática reintroduciría autoridad dual.
- **Current repo behavior:** 01B adapter aplica hechos persistidos y omite replay. Evidencia: inventory-compatibility-projection.service.ts.
- **Proposed design:** Reutilizar InventoryCompatibilityProjectionService en la misma transacción después del core, desde hechos físicos persistidos. Sales no implementa matemática de stock ni segundo decremento directo de Product.stock.
- **Alternatives considered:** Adapter existente; lógica Sales separada.
- **Recommendation:** Decisión humana vinculante: Reutilizar InventoryCompatibilityProjectionService en la misma transacción después del core, desde hechos físicos persistidos. Sales no implementa matemática de stock ni segundo decremento directo de Product.stock.
- **Trade-offs:** Nunca hacer decremento directo adicional en Sales físico ni usar saldo proyectado para autorizar gasto. Riesgo específico: Doble decremento stock.
- **Concurrency impact:** Aplicar después de core bajo roots retenidos.
- **Idempotency impact:** Replay omite adapter.
- **01B compatibility:** Reuso literal del adapter desde hechos persistidos.
- **01D dependency:** Paridad y desactivación decrementos legacy.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Proyección una vez y rollback. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-21 — Movement

- **ID:** TD-INV-01C-21
- **Title:** Movement
- **Problem:** Invocarlo sin mapping cambiaría historia Sales.
- **Current repo behavior:** Helper default 01B usa referencia manual y una fila por EffectLine. Evidencia: inventory-compatibility-history.service.ts:write.
- **Proposed design:** Para Candidate C, extensión estrecha del helper01B: un InventoryMovement OUT por SaleItem/Product; quantity partida, balance final Product.stock, unitCost Product.cost bajo root, SALE/sale.id, createdBy=Effect.actorId, batchId=null. EffectLines preservan fuentes. batchId=null aprobado sólo para alcance unbatched Candidate-C; soporte futuro batched debe revisar granularidad.
- **Alternatives considered:** Una fila/fuente; una fila/SaleItem.
- **Recommendation:** Decisión humana vinculante: Para Candidate C, extensión estrecha del helper01B: un InventoryMovement OUT por SaleItem/Product; quantity partida, balance final Product.stock, unitCost Product.cost bajo root, SALE/sale.id, createdBy=Effect.actorId, batchId=null. EffectLines preservan fuentes. batchId=null aprobado sólo para alcance unbatched Candidate-C; soporte futuro batched debe revisar granularidad.
- **Trade-offs:** Un OUT por partida es compatibilidad agregada para Candidate-C unbatched; allocations exactas quedan en EffectLines. Futuro soporte batched debe revisar granularidad, no heredar batchId=null automáticamente.
- **Concurrency impact:** History dentro de tx después de projection.
- **Idempotency impact:** Zero Movement nuevo en retry.
- **01B compatibility:** Extensión estrecha writeSale, no helper duplicado.
- **01D dependency:** Sólo rutas físicas al activar.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** SALE/ref/actor/costo/balance; no filas extra. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH CANDIDATE-C HISTORY CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH CANDIDATE-C HISTORY CONSTRAINT

### TD-INV-01C-22 — Balance Movement

- **ID:** TD-INV-01C-22
- **Title:** Balance Movement
- **Problem:** Multi-source no debe duplicar quantity ni costo.
- **Current repo behavior:** Legacy usa stock real después del decremento y Product.cost. Evidencia: Sales Product.cost y saldo posterior; helper01B.
- **Proposed design:** Candidate C: quantity=SaleItem.quantity; balance=Product.stock final proyectado; unitCost=Product.cost bajo root, no precio Sale; referenceType=SALE, referenceId=sale.id, createdBy=Effect.actorId, batchId=null. Validar sumas contra EffectLines; regla batchId=null no se extiende a futuras Sales batched.
- **Alternatives considered:** Saldo por fuente; saldo final Product.
- **Recommendation:** Decisión humana vinculante: Candidate C: quantity=SaleItem.quantity; balance=Product.stock final proyectado; unitCost=Product.cost bajo root, no precio Sale; referenceType=SALE, referenceId=sale.id, createdBy=Effect.actorId, batchId=null. Validar sumas contra EffectLines; regla batchId=null no se extiende a futuras Sales batched.
- **Trade-offs:** Un OUT por partida es compatibilidad agregada para Candidate-C unbatched; allocations exactas quedan en EffectLines. Futuro soporte batched debe revisar granularidad, no heredar batchId=null automáticamente.
- **Concurrency impact:** Snapshot costo bajo root; balance tras proyección.
- **Idempotency impact:** No refrescar Movement en retry.
- **01B compatibility:** Valida deltas persistidos igual a partidas.
- **01D dependency:** No recomponer historia legacy.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** 6+4 → Movement10; saldo final único. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-23 — Auditoría

- **ID:** TD-INV-01C-23
- **Title:** Auditoría
- **Problem:** Agregar campos innecesarios ampliaría schema.
- **Current repo behavior:** Sale no tiene approvedBy/confirmedBy; Movement.createdBy no se llena hoy. Evidencia: Sale schema sin confirmedBy; Effect.actorId; Movement.createdBy.
- **Proposed design:** Actor histórico canónico en PhysicalEffect.actorId y Movement.createdBy; no nuevo campo Sale ni overwrite en retry. El actor histórico no necesita seguir activo; sólo el actor del NUEVO request debe autenticar/autorizarse actualmente.
- **Alternatives considered:** Campos Sale; Effect actor.
- **Recommendation:** Decisión humana vinculante: Actor histórico canónico en PhysicalEffect.actorId y Movement.createdBy; no nuevo campo Sale ni overwrite en retry. El actor histórico no necesita seguir activo; sólo el actor del NUEVO request debe autenticar/autorizarse actualmente.
- **Trade-offs:** Preserva auditoría original sin ampliar schema. El actor histórico no debe seguir activo; sólo quien hace el nuevo request debe autenticar y autorizarse actualmente.
- **Concurrency impact:** No nuevo lock de auditoría tardío propuesto.
- **Idempotency impact:** Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **01B compatibility:** Campos existentes suficientes.
- **01D dependency:** Actor se propaga en routing01D.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Mismo actor autorizado tras respuesta perdida y concurrencia: éxito canónico ZERO WRITES; otro actor autorizado: error histórico ZERO WRITES; actor original desactivado no invalida historia; request sin autorización actual rechazado; actorId original intacto. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH HISTORICAL-ACTOR CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH HISTORICAL-ACTOR CONSTRAINT

### TD-INV-01C-24 — Replay approve

- **ID:** TD-INV-01C-24
- **Title:** Replay approve
- **Problem:** Ausencia por historia e inconsistencia post-cutover son distintas.
- **Current repo behavior:** CONFIRMED legacy no tiene Effect. Evidencia: Sales error CONFIRMED; Effect origin lookup.
- **Proposed design:** Aplicar matriz §7: Sale CONFIRMED+Effect coherente permite éxito canónico ZERO WRITES sólo al mismo actor original autenticado/autorizado actualmente. Otro actor conserva error ya aprobada. Legacy certificado conserva error; ausencia inesperada/unknown/mismatch/inversión produce error de integridad sin reparación.
- **Alternatives considered:** Reparar; clasificar.
- **Recommendation:** Decisión humana vinculante: Aplicar matriz §7: Sale CONFIRMED+Effect coherente permite éxito canónico ZERO WRITES sólo al mismo actor original autenticado/autorizado actualmente. Otro actor conserva error ya aprobada. Legacy certificado conserva error; ausencia inesperada/unknown/mismatch/inversión produce error de integridad sin reparación.
- **Trade-offs:** Cambio público aprobado respecto al error histórico sólo para retry coherente del mismo actorId del Effect. Otro actor conserva error business. Éxito lógico no garantiza JSON byte-for-byte y nunca sobrescribe auditoría.
- **Concurrency impact:** Clasificar desde lectura consistente; jamás reparar bajo request.
- **Idempotency impact:** Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **01B compatibility:** No rehacer hash con revisions actuales.
- **01D dependency:** Manifest/cutover classification requerida.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Mismo actor autorizado tras respuesta perdida y concurrencia: éxito canónico ZERO WRITES; otro actor autorizado: error histórico ZERO WRITES; actor original desactivado no invalida historia; request sin autorización actual rechazado; actorId original intacto. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH ACTOR-REPLAY CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH ACTOR-REPLAY CONSTRAINT

### TD-INV-01C-25 — Replay conversión

- **ID:** TD-INV-01C-25
- **Title:** Replay conversión
- **Problem:** Flags incoherentes no deben crear otra Sale.
- **Current repo behavior:** Quote.convertedToSale y Sale.quoteId enlazan identidad. Evidencia: Sale.quoteId único + Quote.convertedToSale.
- **Proposed design:** Resolver Sale Y canónica por Company+quoteId y validar flag/estado/Effect. Mismo actor original autenticado/autorizado actualmente recibe éxito lógico ZERO WRITES; otro actor conserva error ya convertida. No nuevo Sale.id/folio/Effect ni reset flag; incoherencia falla cerrado.
- **Alternatives considered:** Reset flag; reconstruir; lectura fresca.
- **Recommendation:** Decisión humana vinculante: Resolver Sale Y canónica por Company+quoteId y validar flag/estado/Effect. Mismo actor original autenticado/autorizado actualmente recibe éxito lógico ZERO WRITES; otro actor conserva error ya convertida. No nuevo Sale.id/folio/Effect ni reset flag; incoherencia falla cerrado.
- **Trade-offs:** Cambio público aprobado respecto al error histórico sólo para retry coherente del mismo actorId del Effect. Otro actor conserva error business. Éxito lógico no garantiza JSON byte-for-byte y nunca sobrescribe auditoría.
- **Concurrency impact:** Abort y readback fresco por tenant+quoteId.
- **Idempotency impact:** Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **01B compatibility:** Effect Y/CONFIRM verifica OUT.
- **01D dependency:** Certificación legacy también para Quote convertida.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Mismo actor autorizado tras respuesta perdida y concurrencia: éxito canónico ZERO WRITES; otro actor autorizado: error histórico ZERO WRITES; actor original desactivado no invalida historia; request sin autorización actual rechazado; actorId original intacto. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH ACTOR-REPLAY CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH ACTOR-REPLAY CONSTRAINT

### TD-INV-01C-26 — Atomicidad

- **ID:** TD-INV-01C-26
- **Title:** Atomicidad
- **Problem:** Integración agrega más puntos de fallo.
- **Current repo behavior:** Legacy business y stock ya comparten tx. Evidencia: Tx Sales y TransactionClient01A/B.
- **Proposed design:** READ COMMITTED explícito y caller tx única; rollback completo business/físico/proyecciones/history. Outer retry máximo TRES intentos totales sólo ante abort confirmado transitorio (40001/40P01). No retry genérico de insuficiencia, stale business, fuente inválida, mismatch, P2002/unique arbitrario ni business errors. Effect UNIQUE: abort+fresh readback; commit incierto: readback business antes de nueva mutación.
- **Alternatives considered:** Tx separadas; caller tx única.
- **Recommendation:** Decisión humana vinculante: READ COMMITTED explícito y caller tx única; rollback completo business/físico/proyecciones/history. Outer retry máximo TRES intentos totales sólo ante abort confirmado transitorio (40001/40P01). No retry genérico de insuficiencia, stale business, fuente inválida, mismatch, P2002/unique arbitrario ni business errors. Effect UNIQUE: abort+fresh readback; commit incierto: readback business antes de nueva mutación.
- **Trade-offs:** No completar idempotencia fuera de tx si luego se aprueba un scope; ningún resultado parcial visible. Riesgo específico: Efectos parciales o retry en tx abortada.
- **Concurrency impact:** Rollback completo antes de clasificar colisión.
- **Idempotency impact:** Effect unique collision: abort+fresh readback, sin blind retry ni ON CONFLICT. Resultado de commit incierto: readback de identidad business antes de mutar de nuevo; regla mismo actor para éxito.
- **01B compatibility:** Helpers no abren tx propia.
- **01D dependency:** Aceptación aislada previa al cutover.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Fallo claim/debits/proyecciones/history. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH BOUNDED-RETRY CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH BOUNDED-RETRY CONSTRAINT

### TD-INV-01C-27 — Concurrencia

- **ID:** TD-INV-01C-27
- **Title:** Concurrencia
- **Problem:** Interleavings reales exceden mocks.
- **Current repo behavior:** Writers físicos dormidos comparten Product roots. Evidencia: Core locks y mutatePosition revision/quantity.
- **Proposed design:** Matriz §8 con Sale/Sale, manual OUT, count, Receipt, Dispatch futuro, mismo Sale/Quote y cancel.
- **Alternatives considered:** Sólo unit tests; PG aislado.
- **Recommendation:** Decisión humana vinculante: Matriz §8 con Sale/Sale, manual OUT, count, Receipt, Dispatch futuro, mismo Sale/Quote y cancel.
- **Trade-offs:** No afirmar seguridad productiva hasta activación coordinada 01D. Riesgo específico: Oversell entre writers diferentes.
- **Concurrency impact:** Products ASC comunes; ejemplo10/7→3/insuficiente.
- **Idempotency impact:** Competencia mismo origen vs distinto origen se distingue.
- **01B compatibility:** Manual/Receipt internos comparten core.
- **01D dependency:** Legacy productivo no es seguro con físico hasta01D.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** 12 escenarios PG §8. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-28 — Compatibilidad locks

- **ID:** TD-INV-01C-28
- **Title:** Compatibilidad locks
- **Problem:** Ciclos por Batch/Position antes de Product.
- **Current repo behavior:** 01B Receipt prepara parent/secuencias Equipment antes de roots; manual comparte roots. Evidencia: repository ORDER BY id FOR UPDATE; Receipt locks.
- **Proposed design:** Orden físico vinculante repository DB: TODOS Product IDs ASC → TODOS Batch IDs ASC → TODAS Position IDs ASC. Nunca Product A→Batch A→Product B. Sale/Manual/Receipt y futuro Dispatch comparten frontera Product; parents business antes, nunca locks tardíos inversos.
- **Alternatives considered:** Orden local libre; protocolo común.
- **Recommendation:** Decisión humana vinculante: Orden físico vinculante repository DB: TODOS Product IDs ASC → TODOS Batch IDs ASC → TODAS Position IDs ASC. Nunca Product A→Batch A→Product B. Sale/Manual/Receipt y futuro Dispatch comparten frontera Product; parents business antes, nunca locks tardíos inversos.
- **Trade-offs:** Resolver usa repository/locks existentes dentro de tx; no adquirir un Product adicional tarde. Riesgo específico: Orden total ambiguo o phantom de pool nuevo.
- **Concurrency impact:** Todos Products ASC, luego Batches ASC, luego Positions ASC.
- **Idempotency impact:** Retry rehace reads en nueva tx.
- **01B compatibility:** Repository actual es autoridad de locks.
- **01D dependency:** Todo writer activo debe cumplirlo.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Orden inverso de input produce mismo lock order. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-29 — Writer inventory

- **ID:** TD-INV-01C-29
- **Title:** Writer inventory
- **Problem:** Un writer olvidado rompe cutover.
- **Current repo behavior:** Dos writes Sales actuales, ambos acompañados de OUT; ver §2. Evidencia: Sales stock:339/:698; Inventory legacy y Receipt.
- **Proposed design:** 01D redirige ambos caminos; helper purchase deprecado sin callers debe retirarse/inhibirse en cutover; tests/fixtures no son writers productivos.
- **Alternatives considered:** Migración parcial; inventario exhaustivo.
- **Recommendation:** Decisión humana vinculante: 01D redirige ambos caminos; helper purchase deprecado sin callers debe retirarse/inhibirse en cutover; tests/fixtures no son writers productivos.
- **Trade-offs:** No se encontró tercer writer Sales runtime; Returns sólo schema/futuro. Repetir inventario en implementación/cutover. Riesgo específico: Writer legacy omitido.
- **Concurrency impact:** Legacy manual no participa protocolo físico.
- **Idempotency impact:** No atribuir exactly-once al camino legacy.
- **01B compatibility:** Internos físicos01B compartidos.
- **01D dependency:** Inhibir/redirigir TODOS QUANTITY legacy writers.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Guard writer inventory y no activación. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-30 — API

- **ID:** TD-INV-01C-30
- **Title:** API
- **Problem:** Explicit sourcing o replay exitoso cambia contrato.
- **Current repo behavior:** Approve PATCH y conversión POST sin body/key; JWT ya aporta actor. Evidencia: Controller y hooks Sales/Quote sin body/key.
- **Proposed design:** Mismas rutas/body/shape sin Idempotency-Key ni selección pública de fuentes. Cambio público aprobado al activar: mismo actor original y estado coherente reciben éxito lógico ZERO WRITES; otro actor conserva rechazo ya aprobado/convertido. Sin frontend ni controller implementation en esta tarea.
- **Alternatives considered:** Sin cambio; key; sources; endpoint nuevo.
- **Recommendation:** Decisión humana vinculante: Mismas rutas/body/shape sin Idempotency-Key ni selección pública de fuentes. Cambio público aprobado al activar: mismo actor original y estado coherente reciben éxito lógico ZERO WRITES; otro actor conserva rechazo ya aprobado/convertido. Sin frontend ni controller implementation en esta tarea.
- **Trade-offs:** Cambio público aprobado respecto al error histórico sólo para retry coherente del mismo actorId del Effect. Otro actor conserva error business. Éxito lógico no garantiza JSON byte-for-byte y nunca sobrescribe auditoría.
- **Concurrency impact:** Mismas rutas; orden sólo interno dormido.
- **Idempotency impact:** Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **01B compatibility:** Ningún scope01B alterado.
- **01D dependency:** Cambio efectivo de contrato sólo al activar aprobado.
- **Scope impact:** Mantener TARGET8 sólo para alcance backend aprobado; ampliación comercial, fuentes públicas/UI o batched OPTIONAL requieren STOP + SCOPE IMPACT / RE-ESTIMATION.
- **Test implications:** Mismo actor autorizado tras respuesta perdida y concurrencia: éxito canónico ZERO WRITES; otro actor autorizado: error histórico ZERO WRITES; actor original desactivado no invalida historia; request sin autorización actual rechazado; actorId original intacto. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED WITH ACTOR-REPLAY CONSTRAINT. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED WITH ACTOR-REPLAY CONSTRAINT

### TD-INV-01C-31 — Tabla OPTIONAL

- **ID:** TD-INV-01C-31
- **Title:** Tabla OPTIONAL
- **Problem:** Una selección determinista puede no representar lo que sale físicamente.
- **Current repo behavior:** API no identifica lote. Evidencia: Tabla §4; OPTIONAL actual sin lote seleccionado.
- **Proposed design:** Candidate C aprobado: los seis escenarios de §4 usan sólo AVAILABLE unbatched; cualquier saldo batch queda fuera del pool Sales01C, sin FEFO/FIFO/ID selection/lot picker. 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible.
- **Alternatives considered:** A/B/C/D en §4.
- **Recommendation:** Decisión humana vinculante: Candidate C aprobado: los seis escenarios de §4 usan sólo AVAILABLE unbatched; cualquier saldo batch queda fuera del pool Sales01C, sin FEFO/FIFO/ID selection/lot picker. 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible.
- **Trade-offs:** Stock OPTIONAL batched queda fuera del pool Sales01C; restricción V1, no redefinición permanente. 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible.
- **Concurrency impact:** Selección después de frontera roots.
- **Idempotency impact:** Misma identidad natural no elige nuevas fuentes en retry.
- **01B compatibility:** Conservar posiciones batch de01B.
- **01D dependency:** 01D HARD GATE: si reconciliation/opening muestra stock OPTIONAL históricamente vendible cuya identidad real batched quedaría inaccesible, STOP CUTOVER y volver a producto/alcance. No eliminar trazabilidad, inventar batches, mover cantidades arbitrariamente a unbatched ni reclasificar stock real para hacerlo vendible.
- **Scope impact:** Mantener TARGET8 sólo para alcance backend aprobado; ampliación comercial, fuentes públicas/UI o batched OPTIONAL requieren STOP + SCOPE IMPACT / RE-ESTIMATION.
- **Test implications:** A-F y no selección automática. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED — CANDIDATE C. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED — CANDIDATE C

### TD-INV-01C-32 — Error REQUIRED

- **ID:** TD-INV-01C-32
- **Title:** Error REQUIRED
- **Problem:** No debe aparecer selección automática de lote.
- **Current repo behavior:** Helper assertGenericSaleProductEligibility lanza BadRequestException. Evidencia: assertGenericSaleProductEligibility REQUIRED.
- **Proposed design:** Preservar texto: El producto ${product.name} requiere selección de lote para completar la venta; mismo rechazo en create/approve/conversión.
- **Alternatives considered:** Preservar; ampliar.
- **Recommendation:** Decisión humana vinculante: Preservar texto: El producto ${product.name} requiere selección de lote para completar la venta; mismo rechazo en create/approve/conversión.
- **Trade-offs:** Soporte posterior no entra como placeholder ni relajación silenciosa. Riesgo específico: Regresión del rechazo.
- **Concurrency impact:** Sin locks físicos necesarios al rechazo.
- **Idempotency impact:** Zero writes cada rechazo.
- **01B compatibility:** No cambiar elegibilidad Inventory global.
- **01D dependency:** Preservación al cutover.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Mensaje BadRequestException exacto. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-33 — Read model

- **ID:** TD-INV-01C-33
- **Title:** Read model
- **Problem:** No hace falta ampliar UI para evidencia interna.
- **Current repo behavior:** Respuestas actuales devuelven Sale/customer/items y Quote en conversión. Evidencia: Sale response include; Effect origin/Lines.
- **Proposed design:** Read helper tenant-scoped por origen SALE/sale.id/CONFIRM con lines/Position para auditoría y clasificación; sin ampliar respuesta pública.
- **Alternatives considered:** Sale360 público; helper interno.
- **Recommendation:** Decisión humana vinculante: Read helper tenant-scoped por origen SALE/sale.id/CONFIRM con lines/Position para auditoría y clasificación; sin ampliar respuesta pública.
- **Trade-offs:** La relación es por origen, no nueva FK Sale obligatoria. Riesgo específico: Expandir Sale360/API por conveniencia.
- **Concurrency impact:** Readback tenant-scoped coherente.
- **Idempotency impact:** Sólo un retry coherente del mismo actorId registrado en el Effect devuelve éxito lógico con la Sale canónica y ZERO WRITES, tras autenticar y autorizar el request actual. Otro actor autorizado recibe la semántica histórica ya aprobada/ya convertida, también con ZERO WRITES. No sobrescribir actorId ni exigir que el actor histórico siga activo.
- **01B compatibility:** Reusar evidencia existente.
- **01D dependency:** Audit interno no backfill.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Tenant read; datos Effect/Lines. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-34 — Legacy

- **ID:** TD-INV-01C-34
- **Title:** Legacy
- **Problem:** Reejecutarlas duplicaría OUT.
- **Current repo behavior:** Sales confirmadas anteriores carecen de Effect. Evidencia: Legacy Sales sin Effect; baseline actual.
- **Proposed design:** No backfill de Effects históricos ni replay OUT. Ausencia de Effect no prueba legacy y timestamps solos están prohibidos. Unknown falla cerrado. 01D define manifest durable/barrera/classification; mecanismo exacto diferido intencionalmente NO bloquea implementación dormida01C y sí es gate de activación.
- **Alternatives considered:** Backfill histórico; opening baseline.
- **Recommendation:** Decisión humana vinculante: No backfill de Effects históricos ni replay OUT. Ausencia de Effect no prueba legacy y timestamps solos están prohibidos. Unknown falla cerrado. 01D define manifest durable/barrera/classification; mecanismo exacto diferido intencionalmente NO bloquea implementación dormida01C y sí es gate de activación.
- **Trade-offs:** 01C exige esa clasificación como dependencia de activación; si desconocida falla cerrado. Riesgo específico: Ausencia interpretada como legacy.
- **Concurrency impact:** Barrera de cutover es externa a01C.
- **Idempotency impact:** No replay histórico OUT.
- **01B compatibility:** Opening Position en01D, no Effect retroactivo.
- **01D dependency:** Manifest durable, writer barrier y clasificación legacy a cargo01D. Mecanismo exacto diferido intencionalmente: no bloquea implementación dormida01C; unknown falla cerrado y timestamps solos están prohibidos.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** CONFIRMED viejo vs DRAFT viejo confirmado nuevo. Evidencia de validación y límites en §F.
- **Open question:** Sin pregunta bloqueante de01C: el mecanismo exacto del manifest es dependencia futura explícita de01D, no una solución temporal basada en createdAt.
- **Status:** APPROVED WITH 01D LEGACY-MANIFEST GATE

### TD-INV-01C-35 — Handoff

- **ID:** TD-INV-01C-35
- **Title:** Handoff
- **Problem:** Merge no equivale a cutover.
- **Current repo behavior:** 01A/B dormidos; 01C es diseño. Evidencia: 01A/B dormidos y board.
- **Proposed design:** 01C entrega integración/resolver/compatibilidad/pruebas internas y permanece DORMANT UNTIL01D incluso IMPLEMENTED/TESTED/MERGED. 01D posee reconciliation, opening Positions, legacy classification, parity validation, writer barrier y cutover QUANTITY coordinado.
- **Alternatives considered:** Activación aislada; coordinada.
- **Recommendation:** Decisión humana vinculante: 01C entrega integración/resolver/compatibilidad/pruebas internas y permanece DORMANT UNTIL01D incluso IMPLEMENTED/TESTED/MERGED. 01D posee reconciliation, opening Positions, legacy classification, parity validation, writer barrier y cutover QUANTITY coordinado.
- **Trade-offs:** Sin backfill, migración aplicada ni cambio productivo en este trabajo. Riesgo específico: Merge interpretado como activación.
- **Concurrency impact:** Switch conjunto después de reconciliar.
- **Idempotency impact:** Legacy/physical classification antes de habilitar retries.
- **01B compatibility:** Receipt/manual/Sales juntos.
- **01D dependency:** Backfill/opening/paridad/accesibilidad a cargo01D.
- **Scope impact:** Backend dormido dentro de TARGET8 aprobado; cualquier expansión excluida requiere STOP + SCOPE IMPACT / RE-ESTIMATION. Implementación interna dormida; no activa rutas productivas.
- **Test implications:** Ruta legacy sin Effect antes; acceptance handoff. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### TD-INV-01C-36 — TARGET

- **ID:** TD-INV-01C-36
- **Title:** TARGET
- **Problem:** OPTIONAL explícito y nueva API/UI pueden excederlo.
- **Current repo behavior:** TARGET aprobado 8 SP. Evidencia: TARGET8 en DEF/board; alcance actual.
- **Proposed design:** TARGET=8 SP aprobado sólo para backend bounded Candidate-C, replay natural por actor y reuso01A/B; TARGET no es Forecast/Commitment/Actual. FEFO, FIFO comercial, lot picker, frontend, Delivery, SalesOrder, CaseDispatch, Return/Reconciliation, nuevas reglas regulatorias o OPTIONAL batched allocation requieren STOP + SCOPE IMPACT / RE-ESTIMATION.
- **Alternatives considered:** Backend acotado; ampliación comercial.
- **Recommendation:** Decisión humana vinculante: TARGET=8 SP aprobado sólo para backend bounded Candidate-C, replay natural por actor y reuso01A/B; TARGET no es Forecast/Commitment/Actual. FEFO, FIFO comercial, lot picker, frontend, Delivery, SalesOrder, CaseDispatch, Return/Reconciliation, nuevas reglas regulatorias o OPTIONAL batched allocation requieren STOP + SCOPE IMPACT / RE-ESTIMATION.
- **Trade-offs:** La aprobación mantiene8 SP únicamente para el alcance acotado. No autoriza FEFO, FIFO comercial, selector, UI, Delivery, SalesOrder, CaseDispatch, Return/Reconciliation, sourcing regulatorio nuevo ni OPTIONAL batched.
- **Concurrency impact:** Pruebas cruzadas backend incluidas.
- **Idempotency impact:** Replay natural puede requerir revisión de esfuerzo.
- **01B compatibility:** Reuso01A/B, no framework nuevo.
- **01D dependency:** 01D separado.
- **Scope impact:** 8 SP TARGET sólo para alcance backend aprobado; no Forecast/Commitment/Actual. Requisito excluido exige STOP + SCOPE IMPACT / RE-ESTIMATION, sin absorberlo.
- **Test implications:** Plan unit/integration/PG ejecutado según §F. Evidencia de validación y límites en §F.
- **Open question:** Resuelta por revisión humana: APPROVED. Aplican las restricciones registradas en esta TD; ningún punto abierto bloquea implementación dormida01C.
- **Status:** APPROVED

### Evidencia complementaria y contratos aprobados

Las referencias §2..9 de las TD se desarrollan a continuación.
[DEF](INVENTORY_CUSTODY_DEFINITION.md), [01A](INVENTORY_CUSTODY_TECHNICAL_DESIGN.md)
y [01B](INVENTORY_CUSTODY_01B_TECHNICAL_DESIGN.md) conservan sus contratos aprobados.
DEF COMPLETE / MERGED — PR #75;01A COMPLETE / MERGED — PR #77;
01B COMPLETE / MERGED — PR #79. 01D BLOCKED BY01C,01E y Dispatch BLOCKED;
la implementación01C está COMPLETE / IMPLEMENTED / TESTED y permanece dormida. M-HC1 OPEN.

## 2. Mapa CURRENT y evidencia de repositorio

| Camino | Evidencia actual | Efecto |
| --- | --- | --- |
| create | sales.service.ts:40; validación tenant/customer/product, enteros positivos, sin duplicados; folio en tx | Sale DRAFT; sin OUT ni stock |
| approve | sales.service.ts:229; claim DRAFT→CONFIRMED:300; update Product:329/339; Movement:380 | Decremento condicional stock>=quantity y OUT por partida en la misma tx; costo Product.cost; saldo real posterior |
| createFromQuote | sales.service.ts:546; folio:620, claim Quote:630, stock:688/698, Movement:736 | Quote CONFIRMED no convertida → Sale CONFIRMED; copia importes/partidas; stock/OUT/conversión atómicos |
| cancel | sales.service.ts:773 | Sólo DRAFT→CANCELLED condicional; CONFIRMED no cancela; sin reversal |
| restricciones | sales.service.ts:26 | QUANTITY; NONE/OPTIONAL permitidos; REQUIRED y ASSET/SERIALIZED rechazados |
| actor/API | sales.controller.ts; auth/strategies/jwt.strategy.ts | JWT User activo/tenant y roles ADMIN/MANAGER/SALES; user.id disponible, no propagado a approve/conversión; sin Idempotency-Key |
| identidad | schema.prisma:1046 y :1141 | Sale.quoteId @unique; unique Company/folio; SaleItem sin unique Sale/Product; Sale sin approvedBy/confirmedBy |
| folio | sales-folio.service.ts; company-sequence-allocator.service.ts | SALE_FOLIO CompanySequence se actualiza dentro de tx; createMany skipDuplicates propio del allocator no es recuperación de Effect |

Referencias relativas al repositorio: [Sales service](../../../app/api/src/sales/sales.service.ts),
[controller](../../../app/api/src/sales/sales.controller.ts),
[Quotes](../../../app/api/src/quotes/quotes.service.ts),
[schema](../../../app/api/prisma/schema.prisma).
Las líneas son del baseline; no se atribuye aislamiento Serializable explícito a
Sales actual: sus transacciones no configuran isolationLevel/retry.
Quote approve/cancel reclaman sólo DRAFT, sin Product ni sequence; create Quote
valida duplicados. La validación de unicidad de partidas es de servicio, no DB.

Inventario de writers revisado con búsquedas en repo excluyendo output/tmp:
los dos decrementos Sales anteriores son targets 01C. Inventory.createMovement
es writer legacy (stock:115, Movement:96); registerPurchaseEntry (stock:184,
Movement:193) es helper deprecado sin caller productivo encontrado.
PurchaseReceipt legacy incrementa stock:258 y Movement:267. 01B projection
(stock:71), receipt physical (stock:296 sólo rama no QUANTITY) e history helper
son internos dormidos. Products filtra stock; Dashboard y frontend lo leen.
SalesReturn existe como schema/migración y roadmap, sin servicio operacional
en src: futuro, no writer Sales oculto. Fixtures/tests son no productivos.
Después de 01D ningún Sales QUANTITY podrá descontar stock independientemente.

Migraciones leídas/revisadas por contrato: inventory_movements
20260527190544 y mejoras 20260604; batches 20260717200219 y normalización
20260720172022; relación Sale/Quote 20260813233404 (UNIQUE quoteId);
SaleReturns 20260818233631; IdempotencyRecord 20260825231000;
autoridad física 20261013000000; COUNT enums/constraints 20261014000000/20261014000100.
El UNIQUE parcial AVAILABLE unbatched es Company/Product; batched agrega batch.
Effect único por Company/originType/originId/originOperation; línea única por
Effect/Position. No cambio propuesto a estas invariantes.

Tests actuales inspeccionados: sales.service.spec.ts (create, tracking, tenant,
stock insuficiente, claim concurrente simulado, cancel, conversión, costo/saldo);
sales.controller.spec.ts (JWT, tenant, UUID, delegación), sales-folio.service.spec.ts;
quotes.service/controller.spec.ts y auth guards/role matrix. Los mocks de claims
no acreditan serialización PostgreSQL real. Faltan los casos físicos diseñados §8.
Frontend: useSaleActions.ts PATCH approve y useQuoteActions.ts POST from-quote
sin body/key; no selección de fuente. No se cambia UI.
[INVENTORY](INVENTORY.md) conserva comportamiento CURRENT.
[ROADMAP](../../project/ROADMAP.md) §12.7/13.1 difiere Returns operacional y FEFO;
SalesOrder/Delivery y Great Operational Experience no se incorporan.

## 3. Componentes, identidad y actor aprobados

SalesPhysicalIntegrationService interno dormido es dueño de la transacción
business y retry externo; recibe companyId, actorId JWT, SaleId/QuoteId.
SalesPhysicalSourceResolver es capa interna read-only de política/source discovery.
PhysicalInventoryService conserva única autoridad mutadora; repository centraliza
locks. InventoryCompatibilityProjectionService e InventoryCompatibilityHistoryService
comparten la misma TransactionClient; ningún inner helper abre una tx independiente.

Un Sale CONFIRM físico corresponde a una Effect SALE/sale.id/CONFIRM,
kind DEFINITIVE_OUT, con todas las partidas y fuentes. La DB ya contiene UNIQUE
InventoryPhysicalEffect_origin_key sobre Company/originType/originId/originOperation.
Dos tx que leyeron ausencia no están autorizadas ambas a crear: INSERT normal
compite por UNIQUE. Si A confirma, B aborta completo y el outer owner relee fresco;
si A aborta, B puede ser el único ganador. No continuar dentro de tx abortada,
no ON CONFLICT recovery, no tratar cualquier P2002 como replay.

Sale.quoteId @unique / Sale_quoteId_key garantiza como máximo una Sale por Quote.
Lookup siempre valida Company; UNIQUE quoteId es global porque Quote.id es global.
Quote.convertedToSale condicional y relación única respaldan identidad business,
mientras UNIQUE SALE/Y/CONFIRM respalda exactamente un OUT para Sale Y.
No Idempotency-Key ni scope nuevo; no recrear identidad Sale para responder retry.

Actor JWT real se propaga a Effect.actorId y Movement.createdBy.
Sólo el actor del NUEVO request debe autenticar/autorizarse actualmente.
El actor histórico no necesita permanecer activo; su identidad persistida nunca
se sobrescribe ni se reinterpreta como aprobación de otro actor.
Mismo actorId + estado/evidencia coherentes → éxito canónico y ZERO WRITES.
ActorId distinto autorizado → error histórico ya aprobada/ya convertida y ZERO WRITES.
Actor del request sin autorización actual → rechazo de acceso, sin replay.
El hash físico incluye actor/revisions según core existente; replay de negocio
lee evidencia, no reconstruye el request físico con revisions actuales.

## 4. Source policy — Candidate C APPROVED

NONE y OPTIONAL consumen exclusivamente el pool canónico AVAILABLE unbatched
Company/Product. El índice parcial único garantiza cero o una Position de ese pool.
Inventory puede contener pools con y sin lote, pero Sales01C no selecciona ni
consume batch OPTIONAL ni CUSTODY. No FEFO, FIFO comercial, selección oculta por
ID, lot picker ni reglas nuevas de expiración. Orden ID se usa sólo para locks.
REQUIRED conserva exactamente su rechazo actual.

Candidate C es restricción de V1 de01C, no redefinición permanente de OPTIONAL.
A (selección explícita), B (allocation automática por IDs) y D (pool único que
podría ser batched) se evaluaron y NO se aprueban dentro de01C; no hay fallback.
Cualquier futura allocation comercial batched exige STOP + SCOPE IMPACT / RE-ESTIMATION.

| Escenario OPTIONAL | Candidate C aprobado | Trazabilidad / elección / FEFO |
| --- | --- | --- |
| A sólo AVAILABLE unbatched | Consumir q si pool alcanza; si no, insuficiencia | EffectLine pool exacto; sin selección usuario ni FEFO |
| B sólo un batch AVAILABLE | No consumir; fuente fuera del pool Sales01C | Batch intacto; no picker ni selección automática |
| C varios batches | No consumir ni repartir6+4 automáticamente | Ningún orden ID como política comercial; batches intactos |
| D unbatched + batched | Sólo unbatched si alcanza; nunca completar con batch | Batch intacto; no FIFO/FEFO ni fallback |
| E parte CUSTODY | Excluir todo CUSTODY; consumir sólo AVAILABLE unbatched | Owned puede superar vendible; custody nunca se gasta |
| F vencido + válido batched | Ningún batch se consume; sólo eventual pool unbatched elegible | No regla nueva de expiración ni FEFO; predicados core existentes intactos |

availableForSale es cantidad del pool elegible bajo esa política, nunca Product.stock
owned. Ausencia del pool representa cero disponibilidad. Product activo se valida
bajo root; el core conserva sus validaciones actuales de elegibilidad.
01D HARD GATE: si reconciliation/opening revela stock OPTIONAL históricamente
vendible que quedaría inaccesible porque su identidad física real es batched,
STOP CUTOVER y regresar a producto/alcance. No borrar trazabilidad, inventar
batches, mover cantidades arbitrariamente a pools sin lote ni reclasificar stock
real para hacerlo vendible. Gate de activación01D, no blocker del backend dormido01C.

## 5. Locks, discovery, aislamiento y retry aprobados

Business aggregate locks preceden Inventory:
Antes de cualquier mutación (incluida asignación de folio), una lectura coherente
de identidad business clasifica los retries ya comprometidos y aplica actor-replay.
Ese camino retorna éxito/error con ZERO WRITES y no entra al flujo de nueva ejecución.
Si la petición concurrente aún no veía el commit, revalidar tras el lock business;
un intento perdedor aborta/revierte antes del fresh readback, sin writes duplicados
persistidos. El readback de replay tampoco asigna folio ni llama al core/adapter/history.
approve: Sale → Products → Batches → Positions.
createFromQuote: SALE_FOLIO CompanySequence → Quote → nueva Sale → Products →
Batches → Positions. Revalidar Quote tras su lock. Folio-before-Quote se conserva
porque no se identificó ruta activa inversa;01D debe reauditar jerarquía global
antes del cutover. Cancel sólo reclama DRAFT y nunca solicita Product.

Orden físico vinculante, usando DB ORDER BY id FOR UPDATE ya presente en
[PhysicalInventoryRepository](../../../app/api/src/inventory/physical/physical-inventory.repository.ts):
TODOS Product IDs ASC → TODOS Batch IDs ASC → TODAS Position IDs ASC.
Nunca Product A→Batch A→Product B; el orden de partidas del cliente no dicta locks.
Se reúne primero el conjunto completo Product desde el aggregate protegido,
se bloquean TODOS roots, se descubren fuentes dentro de tx, se bloquean dependientes
en orden total y se revalida antes de consumir por el core.
Lecturas anteriores al root sólo pueden identificar candidate IDs, jamás autorizar gasto.

Product existente es frontera estable para discovery y creación de Positions.
No puede bloquearse una Position inexistente: Receipt interno mantiene root antes
de crear pool mediante INSERT normal/UNIQUE parcial. Si Receipt gana root/commit,
Sale lee de nuevo en READ COMMITTED y ve pool/crédito nuevo. Si Sale gana primero,
Receipt espera; Sale usa saldo actual, sin reservar espera por ingreso futuro.
Receipt prepara sus parents/secuencias Equipment antes de roots.
Manual OUT físico01B, Receipt y Sales comparten repository/core. Manual legacy
productivo todavía existe mientras todos los físicos permanecen dormidos;01D
debe redirigir/inhibir writers QUANTITY legacy conjuntamente.
Futuro Dispatch debe usar misma disciplina al TRANSFER AVAILABLE→CUSTODY;
no se crean modelos/endpoints/reglas ni implementación Dispatch en01C.

Ejemplo AVAILABLE10, SaleA7 y SaleB7: ambas pueden bloquear su propia Sale,
pero sólo una mantiene Product compartido. A bloquea/lee10, revalida Position,
consume7 y confirma. B adquiere root después, descubre3 y falla insuficiencia,
revirtiendo su claim CONFIRMED. Si una precondición de revision corresponde a
estado anterior, falla stale business; no se refresca silenciosamente.
updateMany core exige revision y cantidad suficiente como defensa adicional.

Orden de writes en tx única:
claim Sale/Quote y creación Sale en conversión → todos locks/source plan →
Effect claim INSERT antes de balances → Position/Lines → adapter01B →
history Sales → readback → commit. Cualquier fallo revierte también status,
Quote flag, Sale, folio transaccional, Effect, Lines, balances, proyecciones e historial.

READ COMMITTED explícito aprobado con esos locks/claims; no SERIALIZABLE por defecto.
Outer retry: máximo TRES intentos totales, sólo ante aborts transitorios confirmados
como PostgreSQL40001 serialization failure o40P01 deadlock; cada intento nueva tx,
lecturas nuevas y backoff acotado. No retry genérico de insuficiencia, stale source
business, fuente inválida, mismatch, business errors ni arbitrary P2002/unique.
Effect UNIQUE collision usa abort+fresh readback, nunca blind retry.
Commit incierto exige fresh business identity readback antes de nueva mutación.
Core/shared helpers no tienen retry business interno.

## 6. Proyección, Movement y split estructural aprobados

Reutilizar InventoryCompatibilityProjectionService en la misma tx después de
mutación física. Sales no calcula stock ni ejecuta segundo decremento directo.
Product.stock es owned compatible; Batch.availableQuantity es AVAILABLE compatible,
no autoridad independiente para gastar. Replay no llama mutation/projection/history.

History01B default usa referencia manual y una fila por EffectLine; requiere
extensión tipada estrecha Sales, no copia de servicio/projection matemática.
Candidate C aprueba un InventoryMovement OUT por SaleItem/Product:
quantity=SaleItem.quantity; balance=Product.stock final proyectado;
unitCost=Product.cost leído bajo root; referenceType=SALE;
referenceId=sale.id; createdBy=Effect.actorId; batchId=null.
Notas conservan folio/contexto Quote según flujo actual. Validar suma de deltas
por Product contra partidas y rechazar corrupción/duplicados, sin reescribir SaleItems.

batchId=null aprobado SÓLO para Candidate-C unbatched Sales.
Futuro soporte batched debe revisar granularidad de Movement; no heredar esa regla.
Split6+4 para SaleItem10 es capacidad estructural core: dos Lines con Position,
delta, quantities/revisions before/after bajo una Effect. Movement10 sería evidencia
compatible agregada; Lines preservan fuentes exactas. Este ejemplo no habilita
allocation comercial multi-batch01C: un Product tiene un único pool canónico unbatched.
No source plan público ni selector; no SaleItems duplicadas para representar Positions.

Sale CONFIRM es DEFINITIVE_OUT y reduce owned. Dispatch futuro es TRANSFER
AVAILABLE→CUSTODY, preserva owned. Create sigue DRAFT con zero inventory effect;
cancel sólo DRAFT, zero reversal, sin cancelación de CONFIRMED ni Return/Reconciliation.

## 7. Replay e integridad aprobados

| Estado fresco y request autorizado actualmente | Resultado |
| --- | --- |
| Sale CONFIRMED + Effect SALE/CONFIRM coherente + mismo actorId | Éxito lógico con Sale canónica; ZERO WRITES; no nuevo plan/revisions ni efecto |
| Sale CONFIRMED + Effect coherente + otro actorId | Error business histórico ya aprobada; ZERO WRITES; no atribuir aprobación al actor nuevo |
| Quote convertida + Sale Y CONFIRMED + Effect coherente + mismo actorId | Resolver Y y devolver éxito canónico; ZERO WRITES, sin folio nuevo |
| Quote convertida + Y/Effect coherentes + otro actorId | Error business histórico ya convertida; ZERO WRITES |
| CONFIRMED sin Effect y legacy certificado01D | Error histórico; no OUT retroactivo |
| CONFIRMED sin Effect esperado físico o clasificación desconocida | STATE_INCONSISTENT / fail closed; no repair |
| Effect presente y Sale DRAFT/CANCELLED | STATE_INCONSISTENT; no confirmar/reparar automáticamente |
| Origen/kind/partidas/evidencia incompatibles | EFFECT_MISMATCH; no overwrite |
| Quote convertida sin Sale o Sale vinculada con flagfalse | STATE_INCONSISTENT; no reset flag ni nueva identidad |
| Actor histórico inactivo | No invalida evidencia; aplicar comparación actorId y autorización del NUEVO request |

Coherencia comprueba Company, origen/kind, líneas negativas y cantidades por
Product contra partidas. “Actor histórico” significa identidad persistida, sin
requisito de actividad actual. Éxito lógico no promete JSON snapshot byte-for-byte.
El cambio error→éxito está aprobado sólo para retry coherente del mismo actor;
se hará efectivo cuando01D active routing aprobado. Sin Idempotency-Key.

01D posee manifest durable/barrera/classification legacy; mecanismo exacto
intencionalmente diferido NO bloquea implementar01C dormido.
Ausencia de Effect no prueba legacy; timestamps solos (incluido createdAt) están
prohibidos como clasificador. Unknown falla cerrado. Una Sale DRAFT antigua
confirmada tras cutover necesita Effect, no se vuelve legacy por fecha de creación.
No backfill de Effects históricos ni replay del OUT antiguo.

Errores CURRENT vs contrato aprobado de integración futura:

| Caso | CURRENT | Integración01C aprobada, dormida |
| --- | --- | --- |
| Approve confirmado | BadRequestException: La venta ya fue aprobada | Mismo actor+coherencia: éxito ZERO WRITES; otro actor/legacy: error histórico |
| Approve pierde claim | La venta ya fue aprobada, cancelada o ya no puede aprobarse | Readback fresco; aplicar actor/regla replay o rechazo cancelado/integridad |
| Quote convertida | La cotización ya fue convertida a venta | Mismo actor+Y coherente: éxito ZERO WRITES; otro actor: rechazo histórico |
| Quote pierde claim | La cotización ya fue convertida o ya no puede convertirse | Readback Y; aplicar actor/regla o integridad; no duplicar |
| Insuficiencia | Stock insuficiente para ${product.name}. Disponible: ${currentProduct?.stock ?? 0} | INSUFFICIENT_PHYSICAL_AVAILABILITY basado en pool elegible |
| Fuente fuera del scope | Sin contrato físico; stock agregado | SALE_PHYSICAL_SOURCE_REQUIRED si sólo saldo batch fuera de C; sin sugerir picker disponible |
| Fuente inválida / inconsistencia / mismatch | No contrato de fuentes equivalente | SALE_PHYSICAL_SOURCE_INVALID / SALE_PHYSICAL_STATE_INCONSISTENT / SALE_PHYSICAL_EFFECT_MISMATCH |
| REQUIRED | El producto ${product.name} requiere selección de lote para completar la venta | Rechazo actual exacto, sin selector |
| Perdedor concurrencia | Claim/stock error, sin retry Sales explícito | Insuficiencia o STALE_INVENTORY_REVISION business sin retry genérico; abort transitorio confirmado máximo3 |

Seguir errores de dominio PhysicalInventoryError.code y traducción Nest existente;
no exponer P2002,23505,constraint names ni raw Prisma. Core conserva elegibilidad
actual; SALE_BATCH_EXPIRED sólo expresa predicado existente, sin nueva política
ni batch source permitido por C. Esta documentación no cambia HTTP productivo.

## 8. Plan de pruebas aprobado — evidencia ejecutada en §F

Unit/integration: NONE suficiente/ausente/insuficiente/CUSTODY; OPTIONAL seis
escenarios CandidateC; REQUIRED texto exacto; QUANTITY exclusivo; Product/actor/tenant;
enteros, duplicados Product, sumas/revisions/fuentes únicas; stock owned no vendible.
Create DRAFT sin inventario y cancel DRAFT sin reversal; CONFIRMED no cancela.
Mismo actor actual autorizado tras respuesta perdida: éxito zero writes; otro actor:
rechazo histórico zero writes; request sin autorización rechazado.
Desactivar actor original no invalida historia/replay classification; un actor
distinto activo no recibe éxito como autor original. No overwrite actorId.

Inyectar fallos después de status claim, Quote conversion, Sale creation, Effect
INSERT, primer/último débito, Product projection, Batch projection e history.
Comprobar estado completo antes/después, no sólo excepción. No IdempotencyRecord
nuevo ni etapa de completion inventada.

| PostgreSQL aislado futuro | Aserciones |
| --- | --- |
| 1 Sale vs Sale último AVAILABLE | Dos Sale distintas7 sobre pool10: un ganador, otro insuficiente/stale; nunca negativo ni doble gasto |
| 2 Sale vs Manual OUT misma Position | Product root compartido; revalidación bajo locks; perdedor sin efectos parciales |
| 3 Sale vs COUNT_CORRECTION | Revision evita pisar salida; delta0 conserva contrato01B; no generic retry stale |
| 4 Receipt vs Sale mismo Product/pool | Product boundary serializa crédito y discovery; probar creación de Position antes inexistente |
| 5 Approve duplicado secuencial/concurrente | Un claim/Effect/débito/proyección/Movement; mismo actor éxito ZERO WRITES; actor diferente error histórico ZERO WRITES; response-loss |
| 6 Approve vs cancel | Un estado ganador; cancel ganador cero OUT; approve ganador impide cancel/reversal |
| 7 createFromQuote duplicado secuencial/concurrente | Una Y por UNIQUE quoteId, una Effect; mismo actor resuelve Y sin writes; distinto actor error histórico; folio/flag atómicos |
| 8 Colisión origen Effect | INSERT normal aborta perdedor; fresh readback match/mismatch/actor; sin catch-and-continue ni ON CONFLICT |
| 9 Split estructural y rollback | Core6+4 conserva dos Lines; fallo segunda fuente revierte todo; caso comercial batched rechazado por C, history null sólo unbatched |
| 10 CUSTODY | Owned suficiente y AVAILABLE insuficiente jamás autoriza Sale; CUSTODY intacto |
| 11 Política/elegibilidad | OPTIONAL sólo sin lote; batch-only no consumido; REQUIRED rechazo; core predicados existentes sin ampliación |
| 12 Dormancia | Controllers actuales siguen legacy; cero Effect/Position de Sales productivo antes01D; sin shadow writes |

Tests de READ COMMITTED/retry deben inducir abort confirmado40001/40P01 y verificar
máximo3 intentos; business/unique/stale no gatillan retry genérico. Commit incierto
requiere readback antes de mutar otra vez.
Dos conexiones reales y barreras PG, no mocks concurrentes. Futuro Dispatch
comparte protocolo y aceptación cruzada posterior, no implementación en01C.
Guard estático de callers/imports y prueba funcional de ruta acreditarán dormancia.
Pruebas focales y PostgreSQL aislado ejecutados según §F; ninguna migración aplicada.

## 9. Handoff y límites aprobados

01C IMPLEMENTATION COMPLETE / IMPLEMENTED / TESTED localmente; revisión/commit/PR pendientes.
ACTIVATION permanece DORMANT UNTIL01D incluso después del merge futuro.
01D posee reconciliation, opening Positions/backfill, clasificación legacy,
paridad, writer barrier y coordinated QUANTITY cutover. Antes de activar:
verificar accessibility gate OPTIONAL, reaudit global de locks y manifest legacy;
redirigir/inhibir todos writers QUANTITY legacy juntos, sin autoridad dividida.
No borrar identidad batch ni reejecutar Sales históricas.

TARGET8 es creíble únicamente para alcance backend acotado aprobado:
orquestación dormida, resolver C, actor-replay natural, compatibilidad01B,
pruebas unit/integration/PG y documentación. Sólo TARGET, no Forecast/Commitment/Actual.
FEFO, FIFO comercial, lot picker, frontend, Delivery, SalesOrder, CaseDispatch
implementation, Return/Reconciliation, nuevas reglas regulatorias y OPTIONAL
batched commercial allocation exigen STOP + SCOPE IMPACT / RE-ESTIMATION.
No nuevas fechas, reglas comerciales ni modelos Dispatch.

## D. Decisiones humanas registradas y gates de01D

### 1. Product decisions — APPROVED

Candidate C sólo unbatched, NONE aprobado, REQUIRED rechazado.
Éxito lógico sólo al mismo actorId histórico con autorización actual; otro actor
conserva error, sin atribución falsa. Create/cancel sin cambios de alcance.
Accesibilidad real de OPTIONAL batched se revisa en01D: STOP CUTOVER si no se
preserva sin adulterar trazabilidad/identidad; nueva decisión de producto/alcance.

### 2. Architecture decisions — APPROVED

Una Effect Sale, UNIQUE DB y normal INSERT; fresh readback tras abort.
Roots como frontera discovery; todos niveles ordenados ASC; Folio-before-Quote.
READ COMMITTED y máximo3 intentos sólo de abort confirmado transitorio.
01D reaudita locks globales y define manifest durable; detalle futuro intencional
que no bloquea backend dormido01C. Unknown classification falla cerrado.

### 3. Compatibility decisions — APPROVED

Reutilizar adapter01B, extensión estrecha history por partida Candidate-C,
Product.cost/saldo final/SALE/ref/actor/batchId=null sólo para unbatched V1.
Futuro batched revisará granularidad. Actor histórico no necesita seguir activo.
Responses canónicas de retry mismo actor cambian el error actual bajo regla aprobada;
otro actor conserva rechazo. No key ni campo Sale nuevo.

### 4. Scope decisions — APPROVED

TARGET8 sólo backend aprobado; dormancia obligatoria hasta01D.
Exclusiones de §9 requieren STOP + SCOPE IMPACT / RE-ESTIMATION.
No quedan decisiones de01C pendientes de aprobación humana en este documento.
Las dependencias01D son gates de activación; la implementación interna y las pruebas
locales de01C están completas. No se activan rutas productivas.

## E. Confirmaciones

TECHNICAL DESIGN: APPROVED
IMPLEMENTATION: COMPLETE — IMPLEMENTED / TESTED
DATABASE ACTIVITY: isolated 127.0.0.1:5434 / zaping_spike_test — acceptance fixtures cleaned
MIGRATIONS: NONE
01C ACTIVATION: DORMANT UNTIL 01D
TARGET: 8 SP
M-HC1: OPEN
WORKTREE CHANGES: dormant backend + focused tests/harness + documentation
STAGED: NONE
COMMITTED: NONE

Siguiente acción: revisión humana → staging selectivo → commit → PR de implementación dormida.

## F. Evidencia de implementación local — DORMANT UNTIL 01D

IMPLEMENTATION COMPLETE / IMPLEMENTED / TESTED; TD01..36 conservan aprobación.
Base de trabajo b70c2063cc4a5ef2184d80cbc1d4a645ba1d7b55; sin commit/merge nuevo.

Servicios nuevos en app/api/src/inventory/physical:
SalesPhysicalIntegrationService (approve y createFromQuote, tx READ COMMITTED,
retry externo máximo3 sólo abort confirmado), SalesPhysicalSourceResolver
(Candidate C, roots antes de discovery) y SalesLegacyClassifier (seam01D que
devuelve UNKNOWN por defecto, sin timestamps). No providers/controllers productivos
importan la integración. El guard estático de dormancia cubre esos nuevos nombres.
SalesService y SalesController productivos conservan código y routing legacy.

Se reutiliza el core; writeSale en InventoryCompatibilityHistoryService valida
facts y agrega un OUT/partida con costo/saldo/ref/actor y batchId=null sólo Candidate C.
PhysicalInventoryError conserva clasificación interna transactionAborted para
40001/40P01 y P2034 confirmado, sin causa SQL cruda; 55P03 no autoriza retry.
Effect claim normal y UNIQUE permanecen; UNIQUE ajeno no se trata como replay.
Quote flag + Sale identity se leen en una sola consulta SQL para no cruzar commits
entre consultas de relaciones en READ COMMITTED. Replay mismo actor: cero writes;
otro actor: error histórico. No se exige actor histórico activo, sólo request actual autorizado.

Validaciones ejecutadas desde app/api:

- Jest focal: 133/133 PASS, 6 suites: sales-physical.spec.ts (29 tests),
  inventory-integration.spec.ts, physical-inventory.contract.spec.ts,
  sales.service.spec.ts, sales.controller.spec.ts y sales-folio.service.spec.ts.
- npm run typecheck PASS; ESLint sobre todos los archivos TS tocados PASS;
  npm run build PASS; Prettier aplicado al alcance modificado.
- node test/helpers/sales-physical-postgres-runner.cjs --run-isolated: 12/12 PASS.
  Destino fijado y verificado 127.0.0.1:5434 / zaping_spike_test,
  contenedor zaping-hc-spike-postgres. Último rol temporal
  zaping_inv01c_bab1379a855d sin superusuario; cleanup PASS, Company residue=0,
  rol eliminado. Runner no lee .env ni aplica migraciones; verifica schema01A/B existente.

| Escenario PostgreSQL | Resultado |
| --- | --- |
| 1 Sale vs Sale último AVAILABLE | PASS |
| 2 Manual OUT físico vs Sale | PASS |
| 3 COUNT_CORRECTION vs Sale | PASS |
| 4 Receipt crea Position vs Sales discovery | PASS |
| 5 Approve duplicado secuencial/concurrente y actor-replay | PASS |
| 6 Approve vs cancel / ausencia de reversal | PASS |
| 7 Quote duplicada secuencial/concurrente, Sale/folio únicos | PASS |
| 8 Colisión UNIQUE de origen, abort y readback fresco | PASS |
| 9 Split estructural6+4 y rollback débito/proyección/history + Quote | PASS |
| 10 CUSTODY no vendible | PASS |
| 11 OPTIONAL/REQUIRED y predicados batch existentes | PASS |
| 12 Controllers legacy, create/cancel sin efectos físicos | PASS |

Concurrencia usa conexiones independientes y pg_blocking_pids para observar
espera material antes de liberar locks. La primera corrida tuvo11 PASS/1 FAIL
por orden lexicográfico de números negativos en una aserción; se corrigió el
comparador numérico. Se amplió rollback para fallos después del primer débito,
proyección e historial. Corrida final12/12 PASS, sin alterar timeout por fallo.
No se ejecutó suite API global: validación limitada a suites afectadas y aceptación12.
Dispatch continúa como contrato futuro, no implementación ni aceptación de Dispatch productivo.

Auditoría writers: dos decrementos Sales legacy siguen productivos; integración01C
no escribe Product.stock directamente; adapter01B sigue centralizando proyección.
Receipt/manual internos conservan protocolo y dormancia. Sin tercer writer ni
shadow/dual write. Sin Prisma/schema/migración, frontend, Delivery/SalesOrder,
Dispatch/Return/Reconciliation ni cutover. TARGET8; M-HC1 OPEN.
