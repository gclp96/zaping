# HC-INVENTORY-CUSTODY-01A — Core Physical Authority Technical Design

**TECHNICAL DESIGN APPROVED / PR PENDING — TARGET 8 SP.**
**TD-INV-01A-01..20 APPROVED. IMPLEMENTATION NOT STARTED.**

Baseline `51363f566c8c6656f1653f03f11d9489ab4d082b`; DEF COMPLETE / MERGED,
PR #75, main@51363f5. [DEC-INV-CUST-01..14](INVENTORY_CUSTODY_DEFINITION.md) son
autoridad aprobada; TD-INV-01A-01..20 quedan APPROVED tras revisión humana y las
sustituciones autoritativas de TD-INV-01A-10/14/19. El modelo siguiente es el
diseño técnico aprobado para implementación futura, no schema aplicado.
M-HC1 OPEN. No implementation COMPLETE, producción habilitada ni tests ejecutados.

## 1. Evidencia y frontera

Inspeccionados [schema](../../../app/api/prisma/schema.prisma), migraciones de
InventoryMovement, receipts, batch normalization, IdempotencyRecord, CaseKit y
exclusión; módulos Inventory/Products/Receipts/Sales, repositorios Healthcare,
helpers de hash/error y pruebas Inventory. Hechos que condicionan este diseño:

- UUID lógico se persiste como String/TEXT con `@default(uuid())`, timestamps
  DateTime `now()`/`@updatedAt`; no convertir FKs existentes a PostgreSQL uuid.
- Stock, cantidades receipt/batch/Sales son Int. Product y User tienen unique
  `[id,companyId]`; Batch tiene `[id,companyId]` y Company/Product/lotNumber,
  pero no FK compuesta que pruebe Company+Product para una posición nueva.
- InventoryMovement legacy sólo IN/OUT/ADJUSTMENT, batch opcional y balance;
  ADJUSTMENT es saldo absoluto. No contexto/pareja física ni posición actual.
- Inventory manual abre Serializable con tres intentos P2034; Receipt tiene
  transacción Serializable y claim/completion; Sales usa decremento condicional
  agregado y no consume batches. No son consumidores de posiciones actuales.
- Repositorios Healthcare reciben `Prisma.TransactionClient`, usan raw SQL
  parametrizado `FOR UPDATE` y updates condicionales. Hash SHA-256 versionado y
  errores estables sanitizados tienen precedentes. SQL CHECK/índices parciales
  complementan Prisma en migraciones CaseKit.
- Pruebas Inventory actuales cubren tenant, rollback, ADJUSTMENT absoluto y retry;
  mocks no acreditan concurrencia PostgreSQL del nuevo fundamento.

[INVENTORY](INVENTORY.md), [ADVANCED_INVENTORY](ADVANCED_INVENTORY.md),
[ADR-002](../../architecture/adr/ADR-002-inventory-movements.md),
[ADR-013](../../architecture/adr/ADR-013-inventory-custody-case-logistics.md),
[ADR-014](<../../architecture/adr/ADR-014 — Inventory Locations and Internal Transfers>)
y [CASE_LOGISTICS §258](../healthcare/CASE_LOGISTICS.md#258-hc-case-dispatch--v1-approved-contract)
mantienen posiciones/ledger, transfer ≠ OUT y separación Equipment/material.

IN 01A: tablas/constraints nuevas, primitivas internas credit/transfer/out, reads,
identidad física y tests del núcleo. OUT: integrar receipts/manual/Sales, FEFO,
Dispatch, Equipment custody, count-correction empresarial, backfill/opening manifest,
cutover, Return/Inspection/Reconciliation. No endpoints ni módulo de warehouses.

## 2. TD-INV-01A-01..04: posición e identidad

Usar `InventoryPosition`, sólo para Product inventoryTracking=QUANTITY.
AVAILABLE y CUSTODY son los únicos estados persistidos 01A. Ambos Company-owned;
no posición OUT, RESERVED, STAGED, INSPECTION o QUARANTINE. Añadir estados futuros
requiere migración y reglas explícitas, no usar AVAILABLE para inspección.

Sin location master en 01A: AVAILABLE es pool lógico agregado de Company/Product/
batch, no aseveración de Warehouse físico identificado. Multi-location requerirá
evolución explícita antes de su uso; no deducir ubicación física de saldo legacy.
CUSTODY añade `(contextType, contextId)` obligatorio: namespace interno registrado
por el adapter y ID durable de contexto, no nombre de persona ni texto UI libre.
Futuro adapter Dispatch usará una referencia estable por handoff/item apropiada,
validando existencia/tenant en su misma transacción; 01A no crea FK a tablas futuras.
Este par es una clave opaca, no custodian FK ni snapshot de persona.

Lookup exacto AVAILABLE: `(companyId,productId,batchId|null,state=AVAILABLE,
contextType=null,contextId=null)`. Lookup exacto CUSTODY:
`(companyId,productId,batchId|null,state=CUSTODY,contextType,contextId)`.
`batchId` representa inventoryBatchId en esta candidata. Así dos entregas del mismo
lote conservan saldos separados. Context Type case-sensitive 1..64 ASCII uppercase
`[A-Z][A-Z0-9_]*`; contextId string opaca 1..128 sin espacios externos. Ambos NULL
en AVAILABLE, ambos NOT NULL en CUSTODY; jamás sentinels de UUID para NULL batch.
Identidad y estado de fila inmutables; transfer mueve cantidad entre filas.

quantity Int ≥0. Mantener filas cero, no borrar/recrear: ID y revision estables,
FK histórica retenida, carreras deterministas. revision Int inicia 0 y aumenta
exactamente 1 por posición modificada en un efecto (deltas agrupados). Creación
vacía revision0 seguida del primer crédito deja revision1, todo en la misma tx.
Rechazar operaciones netas cero, overflow Int y revision agotada con conflicto
sanitizado. No Decimal ni fractional units. Validar también owned por Product ≤
2147483647 bajo root lock para futura proyección Int, no sólo cada posición.

## 3. TD-INV-01A-05..10: persistence candidata

Comparación: extender InventoryMovement obliga a reinterpretar filas con semantics
legacy y añadir cabecera/grupo de todas formas; dual-write legacy desde 01A amplía
scope y crea ambigüedad. Usar cabecera `InventoryPhysicalEffect` + líneas
`InventoryPhysicalEffectLine`. Son ledger ERP compartido, nunca Healthcare shadow.
InventoryMovement queda válido e intacto; ningún write nuevo compatible en 01A.
Adapters 01B/01C decidirán compatibilidad, con origen único y sin segunda autoridad.

TECHNICAL CANDIDATE — NOT IMPLEMENTED (pseudocode Prisma; relaciones detalladas abajo):

```prisma
enum InventoryPositionState { AVAILABLE CUSTODY }
enum InventoryPhysicalEffectKind { CREDIT TRANSFER DEFINITIVE_OUT }

model InventoryPosition {
  id          String @id @default(uuid())
  companyId   String
  productId   String
  batchId     String?
  state       InventoryPositionState
  contextType String? @db.VarChar(64)
  contextId   String? @db.VarChar(128)
  quantity    Int @default(0)
  revision    Int @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([id, companyId])
  @@index([companyId, productId, state])
  @@index([companyId, batchId, state])
  @@index([companyId, contextType, contextId])
  // Four SQL partial unique indexes for nullable identity, below.
}
model InventoryPhysicalEffect {
  id              String @id @default(uuid())
  companyId       String
  originType      String @db.VarChar(64)
  originId        String @db.VarChar(128)
  originOperation String @db.VarChar(64)
  kind            InventoryPhysicalEffectKind
  requestHash     String @db.Char(64)
  lineCount       Int
  actorId         String
  reason          String? @db.VarChar(1000)
  occurredAt      DateTime @default(now())
  createdAt       DateTime @default(now())
  @@unique([id, companyId])
  @@unique([companyId, originType, originId, originOperation])
  @@index([companyId, occurredAt, id])
}
model InventoryPhysicalEffectLine {
  id             String @id @default(uuid())
  companyId      String
  effectId       String
  positionId     String
  ordinal        Int
  delta          Int
  quantityBefore Int
  quantityAfter  Int
  revisionBefore Int
  revisionAfter  Int
  @@unique([effectId, ordinal])
  @@unique([effectId, positionId])
  @@index([companyId, positionId, effectId])
}
```

Sin updatedAt/status mutable en Effect ni EffectLine. Effect conserva occurredAt
y createdAt; las líneas heredan occurredAt del efecto y no requieren createdAt
propio en esta candidata. Position conserva createdAt y updatedAt. Sin tiempo
cliente autoritativo. OriginType/Operation
namespaces internos 1..64, originId durable 1..128. Un origen agrupa todas las líneas
físicas de esa operación empresarial. Varias operaciones legítimas del mismo
documento usan originOperation distinto definido por adapter, nunca sufijo aleatorio
para eludir replay. No physicalEffectKey redundante: la tupla unique es la identidad.

FKs propuestas, todas ON DELETE RESTRICT y ON UPDATE RESTRICT en tablas nuevas:

- Position → Company(id); `(productId,companyId)` → Product(id,companyId).
- Añadir sólo unique Batch `(id,companyId,productId)`; Position
  `(batchId,companyId,productId)` → InventoryBatch(id,companyId,productId), MATCH SIMPLE
  admite batchId NULL sin saltarse FK Product. No rehacer FKs legacy.
- Effect → Company; `(actorId,companyId)` → User(id,companyId).
- Line `(effectId,companyId)` → Effect(id,companyId) y `(positionId,companyId)` →
  Position(id,companyId). Dimensiones físicas se recuperan de posición inmutable.
- Inversas Prisma en Company/Product/Batch/User/Position/Effect se añaden en futura
  implementación; ningún código Prisma se modifica en este diseño.

Si Prisma no representa limpiamente la relación compuesta Batch nullable con
columnas compartidas, mantener la FK completa en SQL de migración y documentar
esa representación/fallback Prisma. No sustituirla por validación sólo de servicio.

Servicio valida Product QUANTITY y batch Company/Product antes de cualquier efecto.
Batch NULL permitido para material realmente no loteado; REQUIRED exige batch,
NONE no acepta batch, OPTIONAL admite ambos. Dispatch añadirá su regla estricta
batch obligatorio después; core no inventa lotes. Cross-tenant como missing;
mismatch batch-product conocido del mismo tenant como conflicto específico.

## 4. TD-INV-01A-20: constraints SQL e inmutabilidad

TECHNICAL CANDIDATE — NOT IMPLEMENTED; SQL de índices que Prisma no expresa:

```sql
CREATE UNIQUE INDEX position_available_batch_uq
 ON "InventoryPosition" ("companyId","productId","batchId")
 WHERE state='AVAILABLE' AND "batchId" IS NOT NULL;
CREATE UNIQUE INDEX position_available_unbatched_uq
 ON "InventoryPosition" ("companyId","productId")
 WHERE state='AVAILABLE' AND "batchId" IS NULL;
CREATE UNIQUE INDEX position_custody_batch_uq
 ON "InventoryPosition" ("companyId","productId","batchId","contextType","contextId")
 WHERE state='CUSTODY' AND "batchId" IS NOT NULL;
CREATE UNIQUE INDEX position_custody_unbatched_uq
 ON "InventoryPosition" ("companyId","productId","contextType","contextId")
 WHERE state='CUSTODY' AND "batchId" IS NULL;
```

CHECKs SQL obligatorios: Position quantity/revision>=0; AVAILABLE contexto NULL,
CUSTODY ambos no nulos con longitudes/formato anteriores. Effect lineCount>0;
origin fields normalizados/no vacíos, requestHash 64 hex lowercase; reason NULL o
trim length1..1000. Line ordinal>0, delta!=0, before/after>=0,
`quantityAfter::bigint = quantityBefore::bigint + delta::bigint`,
revisionBefore>=0 y revisionAfter::bigint=revisionBefore::bigint+1.

**TD-INV-01A-19 — APPEND-ONLY APPLICATION CONTRACT — APPROVED.** La recomendación
anterior de triggers de bloqueo de mutaciones queda **SUPERSEDED BY HUMAN REVIEW**.
InventoryPhysicalEffect e InventoryPhysicalEffectLine son registros históricos
inmutables a través de los caminos de aplicación soportados. No existe método
productivo de repositorio/servicio para actualizar o borrar Effect ni EffectLine;
ningún comando empresarial puede mutar o eliminar un PhysicalEffect confirmado.
Correcciones/reversiones crean NUEVOS PhysicalEffects compensatorios en slices
futuros. Las relaciones históricas usan onDelete Restrict donde se requiere
preservar evidencia; los CHECK de EffectLine validan sus hechos al INSERT.

Garantía exacta: "append-only through supported application paths, reinforced by
relational integrity constraints." 01A no incluye triggers PostgreSQL BEFORE UPDATE
ni BEFORE DELETE, ni un trigger genérico de tabla inmutable. No se promete
protección contra SQL directo manual/privilegiado. Bloqueos mediante triggers o
políticas podrán evaluarse como hardening futuro según el threat model.
Position conserva dimensiones inmutables y filas cero a través del servicio;
sólo quantity/revision/updatedAt mutan. No hay camino normal de borrado de Position,
CASCADE ni corrección destructiva; sus referencias históricas permanecen RESTRICT.

Para impedir líneas tardías/agregados incompletos: constraint triggers DEFERRABLE
INITIALLY DEFERRED en INSERT de cabecera y líneas, ejecutados al commit (o SET
CONSTRAINTS al final de pruebas), validan count=lineCount y ordinals exactamente
1..lineCount. El contrato de aplicación inserta cabecera y líneas una sola vez y
prohíbe añadir líneas a efectos confirmados; estos checks de INSERT no constituyen
protección contra modificación SQL directa de la cabecera. Validan forma: CREDIT sólo deltas positivos a AVAILABLE;
DEFINITIVE_OUT sólo negativos; TRANSFER al menos un débito y crédito y suma=0 por
Product/batch (NULL agrupado separadamente), nunca cruza Product o lote entre patas.
No estado PREPARED/pendiente persistido de efecto. Servicio inserta cabecera completa
con lineCount final y todas las líneas en una tx. Prisma no expresa esos triggers;
especificarlos en SQL de la migración futura y probarlos con PostgreSQL real.

Balances vs ledger son invariantes del único servicio escritor y reconciliación;
un CHECK local no puede demostrar todas las sumas históricas. CHECK, UNIQUE,
índices parciales, FKs compuestas y RESTRICT refuerzan integridad; no bloquean toda
mutación SQL directa. Los constraint triggers de INSERT anteriores verifican
completitud/forma, no inmutabilidad por UPDATE/DELETE. Rol de aplicación sin privilegios DDL;
test de constraints con rol normal, teardown aislado mediante rollback/TRUNCATE de
fixtures dedicados autorizado en aceptación futura, no eliminar historia productiva.

## 5. TD-INV-01A-11..12: API interna y transacción del caller

Nuevo módulo candidato `InventoryPhysicalAuthorityModule`, repositorio, service y
read service bajo Inventory; sin controller, sin import en Sales/Receipts/Dispatch
ni reemplazo de InventoryService actual. No barrel export público desde módulo
legacy. Tests importan módulo directamente; no ruta productiva invoca primitivas.

```ts
type PositionKey = { productId: string; batchId: string | null } & (
  { state: 'AVAILABLE'; contextType: null; contextId: null } |
  { state: 'CUSTODY'; contextType: string; contextId: string }
);
type Origin = { type: string; id: string; operation: string };
type Request = {
  companyId: string; actorId: string; origin: Origin; reason?: string;
  operation:
    | { kind: 'CREDIT'; credits: { target: PositionKey; quantity: number }[] }
    | { kind: 'TRANSFER'; transfers: {
        sourceId: string; target: PositionKey; quantity: number;
        expectedSourceRevision?: number
      }[] }
    | { kind: 'DEFINITIVE_OUT'; debits: {
        sourceId: string; quantity: number; expectedSourceRevision?: number
      }[] };
};
apply(tx: Prisma.TransactionClient, request: Request): Promise<{
  replay: boolean; effect: ImmutableEffect;
  projectionDeltas: { productId: string; ownedDelta: number }[];
}>;
```

CREDIT targets sólo AVAILABLE, cantidades enteras positivas. TRANSFER permite
AVAILABLE↔CUSTODY y contextos CUSTODY distintos como álgebra interna, no workflow
Return ni endpoint de liberación. Source/target mismo Product/batch, claves distintas;
prohibir posición simultáneamente source y target en un batch para no ocultar
movimiento circular; agrupar patas repetidas de mismo signo. OUT puede consumir
posición own de cualquier estado admitido; adapter futuro autoriza la disposición.
No primitive arbitrary signed delta, ni countCorrection en 01A. REQUEST max1000
patas como límite técnico revisable; overflow y agregación se validan antes de SQL.

Caller abre UNA tx y pasa tx explícito, nunca PrismaService opcional/default para
mutaciones. Cualquier error propaga y aborta todo; caller no captura para commit
parcial. No nested $transaction en core. Preparar operación completa: una llamada
por evento con todos los Products; no llamadas sucesivas con adquisición inversa.
Domain mutation + apply + completion IdempotencyRecord son del mismo callback.

01A no cambia Product.stock ni Batch.availableQuantity, tampoco en apply. Resultado
projectionDeltas es neto por Product (TRANSFER=0, CREDIT=+q, OUT=-q), para diseño de
hook transaccional obligatorio 01B/01C; batch disponible se recalculará desde posiciones,
no se confunde con owned delta. Hook futuro se ejecuta con el mismo tx y sólo cuando
replay=false, antes de completion/commit. No evento asíncrono post-commit ni un
segundo tx. Probar composición con caller rollback sin migrar ningún writer real.

## 6. TD-INV-01A-10,13..16: locks, creación, replay y atomicidad

Protocolo aprobado PostgreSQL: caller transaction READ COMMITTED con row locks explícitos;
también soportar callers SERIALIZABLE, que deben reintentar todo callback cuando
conflicte. Núcleo no reintenta mitad de transacción. Límite tres intentos de owner
para P2034/deadlock reconocido; no retry por insuficiencia, mismatch o stale revision.
Timeout de lock candidato 5s y tx 10s configurados por owner/test harness, respetar
timeouts más estrictos del dominio; agotamiento estable 503. No advisory locks.

Secuencia exacta:

1. Validar shape/normalizar/hash; lookup replay tenant+origin. Si existe: mismo hash
   devuelve efecto histórico, distinto hash 409 antes de reevaluar fuentes actuales.
2. Resolver IDs source tenant-safe sólo para descubrir Products; identidades de
   Position son inmutables. Adquirir Product roots ordenados por id con SQL
   parametrizado `SELECT ... WHERE companyId=? AND id IN (...) ORDER BY id FOR UPDATE`.
   Verificar que están todos. Releer replay después de locks.
3. Bloquear batches afectados por id, validar, luego posiciones existentes por id.
   No adquirir nuevos Products después. Product lock serializa creación de posiciones
   ausentes y proyección agregada sin Company lock global. Padre empresarial/Company
   del caller se bloquea antes del core; nadie lo adquiere al volver desde core.
4. Resolver targets por lookup de todas sus dimensiones lógicas, en orden
   determinista, después de Product/Batch locks. Reutilizar la Position existente,
   incluso con quantity=0; si falta, planificar INSERT normal con quantity=0 y
   revision=0 después del claim de cabecera. Aplica a creditAvailable y al destino de TRANSFER por
   contexto exacto. No ON CONFLICT, upsert ni recuperación local get-or-create.
   findFirst/findMany-equivalente sólo con predicado completo y unicidad parcial
   DB que garantice como máximo una fila; no existe selector Prisma compuesto
   por el mero hecho de definir índices parciales. Sources ausentes 404, nunca
   crear para débito. expected revision se comprueba si fue enviada.
5. Reconsultar origen empresarial completo después de Product/Batch/Position locks,
   antes de crear targets o mutar saldos. Si existe: mismo hash devuelve efecto
   confirmado como replay; distinto hash PHYSICAL_EFFECT_MISMATCH. En ambos casos
   no crear Position, Effect ni líneas ni aplicar deltas. Si sigue ausente, INSERT
   normal de cabecera Effect; nunca ON CONFLICT DO NOTHING RETURNING ni readback
   local ante colisión. Cabecera siempre antes de cualquier mutación de Position.
6. Sólo después del claim exitoso, crear targets ausentes con INSERT normal según
   TD-INV-01A-14. Validar cantidades elegibles/suficientes bajo lock;
   condicional UPDATE tenant/id/
   revision/quantity>=debit, quantity+=delta, revision+=1, updatedAt=servidor.
   Cero filas → conflicto y rollback; no éxito parcial. Insertar líneas before/after
   y revision consistentes, comprobar forma diferida al commit.
7. Calcular projectionDeltas; caller futuro aplica proyecciones y completa key;
   commit único. Fallo tras débito o antes de completion revierte cabecera, targets
   nuevos, cantidades y líneas. Replay no vuelve a actualizar auditoría/revision.

**TD-INV-01A-10 — EFFECT ORIGIN CLAIM WITH ABORT-AND-FRESH-CLASSIFICATION — APPROVED.**
El claim anterior ON CONFLICT DO NOTHING RETURNING + readback en la misma tx queda
**SUPERSEDED BY HUMAN REVIEW**. La tupla UNIQUE Company/originType/originId/
originOperation es la autoridad final de identidad física: dos payloads del mismo
origen pueden afectar Products distintos y no compartir root locks. Por eso el
INSERT normal de cabecera precede a saldos, líneas y proyecciones.

Si INSERT de Effect colisiona por unicidad del origen, abortar toda la transacción.
Propagar un conflicto de claim estable equivalente a PHYSICAL_EFFECT_CLAIM_CONFLICT
o traducirlo en el límite transaccional, sin P2002/23505/nombres de constraints ni
detalles SQL públicos. Nunca continuar la tx fallida, hacer readback en ella ni
convertir localmente la colisión en replay. Ninguna mutación parcial sobrevive.

Tras finalizar completamente el rollback, la orquestación externa puede consultar
desde una lectura/transacción NUEVA por el mismo origen y hash:
- Effect confirmado + mismo hash: REPLAY SUCCESS del efecto original.
- Effect confirmado + distinto hash: PHYSICAL_EFFECT_MISMATCH, sin retry de ese intent.
- Ningún Effect: no hay claim durable (el competidor pudo revertir); el owner puede
  reintentar TODO el negocio con límite si su política lo permite, readquiriendo locks.

Core no reintenta ni reinicia la transacción del caller. Un replay no crea Effect,
EffectLines ni Positions, no cambia saldos/revisiones/auditoría y devuelve
projectionDeltas=[]; nunca reaplicar proyecciones de un efecto ya confirmado.

**TD-INV-01A-14 — POSITION CREATION UNDER PRODUCT-ROOT SERIALIZATION — APPROVED.**
La recomendación anterior ON CONFLICT DO NOTHING + readback en la misma tx para
crear Position queda **SUPERSEDED BY HUMAN REVIEW**. Dos writers conformes del
mismo Product no pueden crear simultáneamente el mismo pool porque comparten
Product-root FOR UPDATE. Los cuatro índices UNIQUE parciales siguen siendo
backstop obligatorio, no el algoritmo de sincronización.

Si INSERT de Position aun así produce unique violation/P2002/23505 equivalente,
la transacción actual aborta y el core propaga PHYSICAL_POSITION_CONFLICT
sanitizado. No capturar para continuar, leer en la tx fallida ni convertir el
conflicto en éxito local. Puede revelar writer no conforme, código legacy que
omite locks o bug de integridad/diseño; no es automáticamente retryable.
La orquestación externa decide si corresponde reintentar TODO el negocio en
una transacción nueva y con límite: readquirir locks y releer estado; el lookup
normal podrá reutilizar la Position ahora existente. Core no posee retry loop.
Nunca exponer P2002, 23505, nombres de constraints ni detalles PostgreSQL a futuros
callers públicos; el mapping HTTP pertenece a la integración.

Hash SHA-256 de JSON canónico version1: Company/origin/kind, targets/sourceIds,
cantidades normalizadas agrupadas y ordenadas, identidades Product/batch/contexto,
expectedSourceRevision explícita del request si existe y reason trim/null.
No incluir cantidad/revisión observada, quantityBefore/After ni revisionBefore/After.
La precondición de revisión enviada es intención del request, no estado observado;
se calcula el hash antes de reevaluar el saldo y la revisión actuales.
Excluir actor y tiempo servidor: retry por otro operador autorizado preserva actor
original. Cambiar cuerpo, contexto, cantidad o expected revision con mismo origin
es mismatch. IdempotencyRecord sigue identidad de request de cada dominio; effect
origin impide duplicación física incluso con otra HTTP key. Sin scope nuevo 01A.

## 7. TD-INV-01A-17..18: read authority y errores

Internal reads por Company+Product y por Company+Product+Batch; single aggregate
SELECT de posiciones, joins de elegibilidad en mismo snapshot de sentencia.
owned=sum todas las posiciones; inCustody=sum CUSTODY; available=sum AVAILABLE
elegibles. Product inactivo o batch inactivo/vencido → available0, owned permanece.
Batch expiration NULL válido; corte técnico recomendado `expirationDate > asOf`
(igual timestamp ya no elegible), asOf servidor capturado una vez; no timezone de
cliente ni FEFO. Es regla técnica aprobada, no conversión silenciosa
de lotes. CREDIT/TRANSFER hacia AVAILABLE requieren Product/batch elegibles; mover
hacia custodia requiere source AVAILABLE elegible; OUT desde AVAILABLE también
requiere esa elegibilidad. OUT de CUSTODY no pierde historia
por vencimiento posterior, pero exige autorización del adapter futuro.

No posición devuelve `{owned:0, available:0, inCustody:0, hasPositions:false}` para
Product existente del tenant; Product/Batch foreign/missing 404. No rellenar de
Product.stock ni afirmar stock productivo cero. Etiquetar `authority:'PHYSICAL_POSITIONS'`;
activación se decide fuera del read service. 01A no expone este dato a clientes.
Aggregates bigint SQL se validan/convierten a number dentro de límite Int aprobado;
no pérdida silenciosa de precisión. Lecturas multi-query futuras necesitarán tx
snapshot común, no mezclar contadores tomados en momentos distintos.

| Error estable candidato | Futuro HTTP | Semántica |
| --- | --- | --- |
| INVALID_PHYSICAL_REQUEST | 400 | Forma, cantidades, origen o hash inputs inválidos. |
| PRODUCT_NOT_FOUND / INVENTORY_BATCH_NOT_FOUND / PHYSICAL_POSITION_NOT_FOUND | 404 | Incluye recursos de otro tenant; no filtrar identidad ajena. |
| INVENTORY_BATCH_PRODUCT_MISMATCH | 409 | Recurso visible del tenant con Product incompatible. |
| INSUFFICIENT_PHYSICAL_AVAILABILITY / PHYSICAL_SOURCE_NOT_ELIGIBLE | 409 | Saldo/eligibilidad actual impide consumo. |
| PHYSICAL_POSITION_CONFLICT / STALE_INVENTORY_REVISION | 409 | Update condicional, revisión cambió o unicidad inesperada al crear Position; abortar tx, sin recuperación local ni retry automático. |
| PHYSICAL_EFFECT_MISMATCH | 409 | Mismo origin distinto payload. Igual payload es éxito replay, no ALREADY_EXISTS. |
| PHYSICAL_EFFECT_CLAIM_CONFLICT | Por adapter | Colisión de claim: abortar; owner clasifica desde lectura/tx fresca. No equivale por sí sola a mismatch ni replay. |
| PHYSICAL_QUANTITY_LIMIT | 409 | Overflow cantidad/agregado/revision. |
| PHYSICAL_CONCURRENCY_TIMEOUT | 503 | Retry/espera transaccional agotado según política. |
| INVENTORY_PHYSICAL_PERSISTENCE_ERROR | 500 | Fallo inesperado sanitizado; constraint interna inesperada no se disfraza de insuficiencia. |

Error typed del núcleo y mapping futuro del adapter; mantener patrón de códigos
estables de Healthcare, sin dependencia ERP→Healthcare. Tenant mismatch interno
no expone HTTP distinto de missing para recursos ajenos.

## 8. Migración 01A y activación segura

Sólo diseño: crear enums/tablas/índices/CHECKs y constraint triggers de INSERT para
completitud/forma; sin triggers de bloqueo UPDATE/DELETE. Añadir unique
Batch(id,companyId,productId); mismas columnas TEXT existentes, ningún backfill ni
conversión de saldo. Nuevo unique es redundante con id único y no requiere inferir
linaje; programar locks DDL en implementación. Migraciones previas no se editan.
Tablas vacías son seguras sólo con módulo dormido: ninguna ruta, job, handler o
writer legacy cambia lectura/escritura; no importar autoridad nueva en producción.
No flag runtime inventado para permitir activación accidental: alcance de imports
y ausencia de endpoints/callers constituye gate 01A verificable por tests/revisión.

01B/01C diseñan integración pero sólo 01D coordina opening manifest/cutover completo
por tenant. Antes de activación todos los writers concurrentes deben migrarse,
validarse baseline/compatibilidad, hook de proyecciones y prohibición writers legacy.
No Healthcare posiciones/Sales stock híbrido. Equipment custody permanece 01E.
Evidencia unit/focal en fixtures no declara activación ni disponibilidad productiva.

## 9. Test design, AC y DoD

Unit/service/repository: shape y hash determinista; scopes tenant; creditAvailable
nuevo/existente; suficientes/insuficientes; transfer conserva owned y cambia
available/custody; OUT disminuye owned; separación batch y contexto; actor/audit
original en replay; mismatch; expected revision; overflow; cero filas condicionales;
read elegibilidad/expiry/null/asOf; no posición ≠ legacy stock; cero writes a
Product.stock/InventoryBatch/InventoryMovement. Sin tests que sólo espejen código.

PostgreSQL acceptance futura con DB dedicada y fixtures propios:

- CHECK/partial uniqueness con batch NULL y real, contextos CUSTODY independientes.
- FK cross-tenant y batch de otro Product rechazadas por DB, no sólo mocks.
- Línea tardía, efecto incompleto y transfer no balanceado rechazados por los
  constraints de INSERT; rollback de constraint deferred comprobado al commit.
- Revisión de superficie de repositorio/servicio: no métodos productivos de
  UPDATE/DELETE de Effect/EffectLine ni comandos que alteren efectos confirmados;
  relaciones RESTRICT preservan evidencia. Sin tests de bloqueo SQL de UPDATE/DELETE.
- Dos debits por últimas unidades: uno gana, otro insuficiente, nunca negativo.
- Dos créditos/creaciones AVAILABLE: una fila, suma correcta, revisions/evidencia.
- Lookup completo y reutilización de Position cero para CREDIT y destino TRANSFER;
  INSERT normal sólo si falta. Conflicto inesperado de unicidad: error estable,
  rollback completo y ninguna lectura/recuperación en la tx fallida; retry fresco
  sólo si la política del caller lo autoriza, con locks readquiridos.
- Mismo origin/hash concurrente: exactamente un Effect, un conjunto de líneas y
  una mutación de saldos; perdedor que colisiona aborta y no continúa su tx;
  clasificación fresca del owner devuelve replay. Cubrir Products compartidos y
  distintos para comprobar UNIQUE de origen además de Product-root locks.
- Mismo origin/distinto hash: un Effect gana, clasificación fresca del perdedor
  produce PHYSICAL_EFFECT_MISMATCH, sin efecto físico duplicado.
- Sin Effect durable tras abort: clasificación fresca permite sólo retry completo
  acotado por política externa; replay retorna projectionDeltas=[] y no nuevos writes.
- Falla inyectada entre débito/crédito y después de efecto: rollback completo.
- Caller-owned tx con mutación empresarial fixture + core: falla caller revierte todo.
- Igualdad ledger neto/posiciones desde fixtures vacíos y ausencia de cambios legacy.

AC-01 persistence exacta/constraints documentadas y migración aditiva revisada.
AC-02 claves AVAILABLE/CUSTODY distinguen NULL/contextos sin duplicación.
AC-03 tenant/Product/Batch coherentes por servicio+DB.
AC-04 primitivas atómicas/replay, revisión y ledger append-only por caminos de
aplicación soportados, reforzado por constraints de integridad relacional.
AC-05 protocolo roots→batches→positions probado en PostgreSQL.
AC-06 reads typed correctos, sin replay total/fallback legacy.
AC-07 ningún caller productivo/cutover/proyección activada en 01A.
AC-08 tests focales y aceptación DB acreditados durante implementación futura.
AC-09 diseño/docs/errores sincronizados, sin absorber 01B–01E.

DoD futura: AC anteriores PASS; review SQL/Prisma y migration additive; validate/
generate, typecheck/lint/build y tests pertinentes según repo; PostgreSQL real
concurrencia/rollback/constraints; git diff --check; evidence sin claim de producción.
Este turno sólo documenta tests: no ejecuta ninguno, no DB.

## 10. Decisiones técnicas — TD-INV-01A-01..20 APPROVED

Cada decisión TD-INV-01A-01..20 tiene estado **APPROVED**. Las sustituciones humanas
10/14/19 se conservan explícitas; no queda conflicto material con la revisión.

| ID | Decisión aprobada |
| --- | --- |
| TD-INV-01A-01 | InventoryPosition material; sin location master 01A. |
| TD-INV-01A-02 | AVAILABLE agregado, CUSTODY contextType/contextId; cuatro partial uniques. |
| TD-INV-01A-03 | Int quantity/revision, filas cero retenidas, overflow explícito. |
| TD-INV-01A-04 | Sólo AVAILABLE/CUSTODY; ambos own, sin posición OUT. |
| TD-INV-01A-05 | Effect header + lines ERP nuevas, no extender/reinterpretar legacy. |
| TD-INV-01A-06 | Legacy InventoryMovement intacto; sin dual ledger writer 01A. |
| TD-INV-01A-07 | Proyecciones no activas; hook posterior mismo tx, delta=0 transfer. |
| TD-INV-01A-08 | Batch triple unique + FK compuesta y validación servicio. |
| TD-INV-01A-09 | FK tenant-safe actor/Products/position/effect/lines, RESTRICT. |
| TD-INV-01A-10 | APPROVED — EFFECT ORIGIN CLAIM WITH ABORT-AND-FRESH-CLASSIFICATION. Origin UNIQUE + hash versionado; INSERT normal de cabecera antes de saldos; colisión aborta, clasificación fresca externa. Claim ON CONFLICT anterior SUPERSEDED BY HUMAN REVIEW. |
| TD-INV-01A-11 | apply typed CREDIT/TRANSFER/OUT interno; sin countCorrection público. |
| TD-INV-01A-12 | Prisma.TransactionClient explícito; owner coordina commit/retry. |
| TD-INV-01A-13 | READ COMMITTED + FOR UPDATE ordenado + conditional updates; compatible Serializable. |
| TD-INV-01A-14 | APPROVED — POSITION CREATION UNDER PRODUCT-ROOT SERIALIZATION; lookup lógico completo, reutilizar existente/INSERT normal si falta; unicidad inesperada aborta tx, retry externo discrecional. ON CONFLICT + readback anterior SUPERSEDED BY HUMAN REVIEW. |
| TD-INV-01A-15 | Transfer único y balanceado por Product/batch, rollback completo. |
| TD-INV-01A-16 | OUT físico reduce posiciones; proyección posterior atómica sin segunda resta. |
| TD-INV-01A-17 | Read aggregates por posiciones/elegibilidad; cero explícito no producción. |
| TD-INV-01A-18 | Errores typed/sanitizados y mapping futuro. |
| TD-INV-01A-19 | APPROVED — APPEND-ONLY APPLICATION CONTRACT; recomendación anterior SUPERSEDED BY HUMAN REVIEW. Sin triggers BEFORE UPDATE/DELETE ni updatedAt en Effect/EffectLine; correcciones compensatorias futuras. |
| TD-INV-01A-20 | SQL parcial/CHECK/compound FK y constraint triggers en migración futura. |

**TECHNICAL DESIGN APPROVED — HC-INVENTORY-CUSTODY-01A / PR PENDING — TARGET 8 SP.**
Implementación NOT STARTED. Siguiente acción: revisión del delta documental,
staging selectivo → commit de diseño → PR técnico. Tras merge, iniciar implementación
01A desde main actualizado, manteniendo la autoridad dormida hasta el cutover posterior.
01A permanece dormido, 01B..01E BLOCKED, HC-DSP-01A/B/C/D BLOCKED BY INVENTORY
CUSTODY FOUNDATION y M-HC1 OPEN.
