# HC-INVENTORY-CUSTODY-01E — EquipmentAsset Custody Integration

TECHNICAL DESIGN: APPROVED / MERGED — PR #85
IMPLEMENTATION: 01E-A IMPLEMENTED / TESTED — pending human review/merge; 01E-B NOT STARTED.

Baseline: `77a83539dc3a2069bf0b3085cbd6f32e55fffb79`.
Rama: `feat/hc-inventory-custody-01e-equipment-custody`.
Autoridad: aprobación humana del Technical Design Approval Delta 01E.
Las decisiones están APPROVED / MERGED. El cierre local01E-A figura al final;
la implementación01E-B y la adopción operativa siguen pendientes.

| Slice                      | Alcance                                                                     | TARGET        | Estado                                                   |
| -------------------------- | --------------------------------------------------------------------------- | ------------- | -------------------------------------------------------- |
| HC-INVENTORY-CUSTODY-01E-A | Persistence, invariants, baseline & physical history                        | 5 SP          | IMPLEMENTED / TESTED — pending human review/merge       |
| HC-INVENTORY-CUSTODY-01E-B | Physical primitives, Equipment/Assignment/readers & cross-domain acceptance | 8 SP          | BLOCKED BY HC-INVENTORY-CUSTODY-01E-A                    |
| HC-INVENTORY-CUSTODY-01E   | EquipmentAsset custody foundation                                           | 13 SP = 5 + 8 | TECHNICAL DESIGN: APPROVED / MERGED — PR #85 — 01E-A IMPLEMENTED / TESTED; 01E-B BLOCKED |

01E-A: IMPLEMENTED / TESTED — pending human review/merge — TARGET 5 SP. Technical Design MERGED — PR #85.
01E-B: BLOCKED BY 01E-A — TARGET 8 SP. El TARGET anterior de 8 SP para 01E
queda sustituido por el split humano aprobado de 13 SP. Sólo planificación TARGET;
sin Forecast, Commitment, Actual ni fechas asignadas.

01D-A / 01D-B / 01D-C: COMPLETE / MERGED.
HC-INVENTORY-CUSTODY-01D IMPLEMENTATION: COMPLETE / MERGED.
REAL COMPANY CUTOVER: NOT EXECUTED.
EXTERNAL OPERATIONAL FENCE: NOT CERTIFIED.
01A/01B/01C ACTIVATION: DORMANT. M-HC1: OPEN.

## Alcance aprobado y límites

01E cubre EquipmentAsset y Product.inventoryTracking = ASSET, incluido el
serialNumber opcional de EquipmentAsset. SERIALIZED material queda excluido:
actualmente carece de identidad individual equivalente. Su soporte exige diseño
separado; no se añade arquitectura de unidades SERIALIZED.

Se establece el fundamento de posesión física de Equipment, sin implementar
CaseDispatch, Return/Reconciliation, Delivery, SalesOrder, frontend, nuevos
comportamientos de agenda o políticas Assignment, nuevos estados Case, adopción
operativa real, cutover productivo ni activación01D. No se crea un framework
genérico de custodia.

## Modelo físico actual aprobado

EquipmentAsset permanece como root del estado físico actual. Dimensiones independientes:

| Dimensión        | Valores / contrato                                                                 |
| ---------------- | ---------------------------------------------------------------------------------- |
| lifecycle        | ACTIVE / RETIRED; conserva autoridad existente                                     |
| condition        | GOOD / INSPECTION_PENDING / DAMAGED / OUT_OF_SERVICE; conserva autoridad existente |
| physicalLocation | UNVERIFIED / WAREHOUSE / CUSTODY                                                   |
| physicalRevision | Revisión física monotónica; updatedAt no la sustituye                              |
| activeCustodyId  | Nullable; apunta al episodio activo del mismo Company/Asset                        |

AVAILABLE es DERIVED; no se persiste como estado independiente.
Elegibilidad física = ACTIVE + GOOD + WAREHOUSE, con estado/puntero coherentes.
CUSTODY + DAMAGED es válido y conserva ambos hechos. Cambios de condition o
lifecycle no borran ubicación, episodio ni provenance. UNVERIFIED o estado
incoherente falla cerrado.

## Assignment, disponibilidad y Replace

Assignment conserva autoridad de agenda/asignación lógica:

- RESERVED != delivered; un Asset RESERVED puede seguir WAREHOUSE.
- RELEASED != returned.
- REPLACED != physically released.

Assignment no transfiere custodia. CaseKit PREPARED sigue siendo preparación
lógica y nunca crea custodia. El handoff confirmado de CaseDispatch futuro es la
frontera WAREHOUSE → CUSTODY; Return/Reconciliation futuro es dueño de la recepción
CUSTODY → WAREHOUSE con resultado de condición.

El predicado físico adicional aplica a nuevas reservas y al destino de Replace,
sin rediseñar la política Assignment. Con ACTIVE + GOOD + WAREHOUSE se aplican
después las reglas vigentes de agenda, capacidad, conflictos y override.
Destino CUSTODY, UNVERIFIED, INSPECTION_PENDING, DAMAGED, OUT_OF_SERVICE o RETIRED
se rechaza. Ningún override de scheduling supera custodia o condición.

Si origen A ya está CUSTODY, el reemplazo lógico puede proceder conforme a la
política vigente, conservando custodia/provenance de A. Replace nunca cierra
implícitamente un episodio. Preservar HC-NEXT, HC-LOCK y contratos Coverage/Case
Availability; no convertir el predicado físico en un cambio global silencioso
de poblaciones informacionales ni en un verdict general de Case readiness.

## Episodio de custodia y contexto validado

Se aprueba EquipmentAssetCustody, con campos conceptuales:

```text
id, companyId, equipmentAssetId, caseId, assignmentId
openedAt, openedById
closedAt nullable, closedById nullable
```

A lo sumo un episodio abierto por Company/Asset. Relaciones durables tenant-safe;
Case, Assignment y Asset deben ser coherentes. Case por sí solo NO acredita
provenance de entregas futuras ni distingue Dispatches sucesivos.

01E prepara un seam interno de contexto validado. No almacena strings arbitrarios
contextType/contextId como prueba suficiente, ni fabrica Dispatch records.
Ningún caller productivo puede abrir CUSTODY hasta que exista un registro/contexto
real CaseDispatch y pueda validarse dentro del mismo tenant.
01E NO registra un adapter Dispatch productivo; ninguna ruta normal puede crear
custodia real antes de existir ese dominio. Custodio/snapshots de handoff siguen
perteneciendo al dominio Dispatch futuro.

## Invariantes de persistencia y tenant

- physicalLocation = CUSTODY exige activeCustodyId no nulo.
- WAREHOUSE o UNVERIFIED exigen activeCustodyId nulo.
- Puntero y episodio abierto describen exactamente el mismo Company/Asset.
- Un índice único parcial limita episodios abiertos por (companyId, equipmentAssetId).
- FKs compuestas y UNIQUEs de soporte para Custody → EquipmentAsset, Case y
  Assignment; la relación Assignment debe conservar coherencia Case/Asset/Company.
- activeCustody se vincula al mismo Company/Asset; constraints y validación
  diferida mantienen consistencia al commit cuando corresponda.
- Evidencia durable usa RESTRICT para delete/update de identidades referenciadas.

El SQL/Prisma concreto se refina durante implementación sin relajar invariantes.
Las relaciones EquipmentAsset existentes que sólo tienen validación tenant en
aplicación se preflightan antes de cualquier endurecimiento FK opcional. No se
auto-reasignan filas históricas inconsistentes ni se aprueba una limpieza genérica.

## Revisión, atomicidad y locking

physicalRevision cambia cuando cambian hechos físicos autoritativos: ubicación,
custodia, condition o lifecycle. No last-write-wins:

```text
expected physical revision + expected current facts
→ conditional mutation → revision + 1 → append event → commit
```

Para mutaciones físicas de EquipmentAsset existente:

```text
READ COMMITTED
→ HC Company advisory lock
→ locks empresariales del comando vigente
→ EquipmentAsset locks determinísticos
→ authoritative reread / CAS
→ estado + custodia + evento atomic commit
```

Preservar protocolo y timeouts HC-LOCK. No imponer una jerarquía universal nueva
que rompa CaseKit o Assignment. Inspection/Retirement deben participar de la
revisión física y coordinación correspondiente sin borrar custodia.

Para Dispatch mixto futuro:

```text
Inventory authority fence → HC Company lock → business / Assignment / Asset locks
```

Ningún participante adquiere Inventory fence después de sostener HC lock.
Receipt provisioning de Assets NUEVOS no adquiere HC Company lock después de
Product locks: inicializa hechos físicos en su transacción Receipt existente,
sin introducir inversión de locks ni transacción anidada.

## Historia física e idempotencia

Se aprueba EquipmentAssetPhysicalEvent dedicado y append-only. Registra Company,
Asset, custodia/contexto aplicable, operación, origen durable, location/condition/
lifecycle antes/después, physicalRevision antes/después, actor, razón estructurada,
createdAt y hash versionado de request/evidencia.

Unicidad suficiente para replay idempotente; una transición autoritativa exitosa
produce un evento. EquipmentInspection sigue siendo documento de dominio propio
y puede ser origen del evento, sin duplicar su contenido semántico.

BASELINE_RECONCILIATION — o equivalente exacto consistente con el repo — identifica
la reconciliación física inicial. No inventa Dispatch/Return históricos ni actor
de negocio. Sólo para baseline puede admitirse actor nullable si es necesario,
con evidencia durable de reconciliación/operador. Transiciones productivas normales
requieren actor de negocio real autenticado.

Decisión APPROVED: DO NOT REUSE InventoryPhysicalEffect. Ese modelo es QUANTITY /
Position / delta; Equipment es identidad/transición. Se comparten tenant safety,
atomicidad, actor, origen, idempotencia y audit, con persistencia especializada.

## Migración, baseline y adopción

Las dos migraciones01E-A están implementadas y validadas sólo en PostgreSQL efímero;
su detalle y límites están en el cierre local al final del documento.
EquipmentAssets existentes comienzan physicalLocation = UNVERIFIED, conservando
condition, lifecycle, serial, origin, batch y provenance Receipt.

No inferir WAREHOUSE desde GOOD, ACTIVE, RESERVED, PREPARED, Product.stock, ausencia
de Dispatch ni ausencia de custodia conocida. Una reconciliación física explícita
separada debe acreditar WAREHOUSE. UNVERIFIED no es elegible para nueva reserva,
reemplazo o dispatch. No inventar historia física.

Nuevos Receipt-created Assets: WAREHOUSE + INSPECTION_PENDING en la transacción
de provisioning existente. Alta manual exige evidencia explícita de entrada al
almacén y actor; nunca default silencioso de identidad histórica desconocida a
WAREHOUSE. Adopción operativa real y reconciliación empresarial quedan fuera del
TARGET de implementación.

## Seam futuro de Dispatch

Primitiva caller-owned equivalente a la siguiente; firma exacta refinable:

```text
transferToCustody(tx, {
  companyId, assetId, assignmentId, caseId,
  expectedPhysicalRevision, validatedDispatchContext,
  actorId, durableOrigin
})
```

Revalida Assignment RESERVED/coherente, Asset ACTIVE + GOOD + WAREHOUSE, revisión,
contexto real tenant-safe y ausencia de custodia activa. Resultado atómico:
episodio + location/revision/puntero + evento, en la transacción empresarial,
sin nested transaction. Mismo origen durable y hash: replay lógico sin transición
duplicada; mismo origen con contenido distinto: conflicto.
No implementar CaseDispatch ni registrar contexto productivo en01E.

## Seam futuro de Return

El modelo soporta CUSTODY → WAREHOUSE + GOOD / INSPECTION_PENDING / DAMAGED /
OUT_OF_SERVICE. Return futuro cierra el episodio activo exacto y registra el
resultado físico atómicamente. Cambiar condition mientras permanece CUSTODY no
significa devolución. No se implementa workflow Return/Reconciliation en01E.

## Relación con01D y compatibilidad

Autoridad Equipment independiente de QUANTITY InventoryCutover. No extender ese
control a EquipmentAsset. 01E puede implementarse sin activar01D; Dispatch mixto
futuro coordinará ambos dominios de autoridad/fence.

01D IMPLEMENTATION: COMPLETE / MERGED; REAL COMPANY CUTOVER: NOT EXECUTED;
EXTERNAL OPERATIONAL FENCE: NOT CERTIFIED. No certificación externa implícita.

Preservar formas API donde sea práctico. Availability puede añadir razones físicas
y revisión; CUSTODY y UNVERIFIED nunca devuelven physically available=true.
Regresión de compatibilidad con UI Equipment actual requerida; sin feature frontend.
Preservar RBAC Assignment existente y estilo de errores Healthcare, reutilizando
códigos equivalentes en lugar de crear aliases de errores existentes.

## Validación requerida para implementación futura

Pruebas focales: clasificación/backfill conservador; elegibilidad de todas las
dimensiones; reserve/PREPARED sin custodia; Replace destino bloqueado y origen
en custodia conservado; revisión stale; contexto real/inválido/foreign; replay/hash;
historia exacta; tenant; coherencia puntero/episodio; condition sin devolución;
compatibilidad API/UI y no regresión QUANTITY/Coverage/HC-NEXT.

Aceptación PostgreSQL sólo en DB/contenedor nuevo aislado, conexiones independientes
y barreras explícitas: reserve vs custody; Replace vs custody; dos claims mismo
Asset; stale revision; retirement vs custody; inspection/damaged vs custody;
duplicate replay; FKs tenant-safe; rollback atómico; PREPARED sin fake custody;
provisioning Receipt sin inversión. Adapters de fixture sólo en tests; ninguno
permisivo productivo. La ejecución01E-A se limita a la DB efímera descrita abajo.

## Cierre de aprobación

TECHNICAL DESIGN: APPROVED / MERGED — PR #85. 01E-A IMPLEMENTED / TESTED — pending human review/merge; 01E-B NOT STARTED.
01E-A: IMPLEMENTED / TESTED — pending human review/merge — TARGET 5 SP.
01E-B: BLOCKED BY 01E-A — TARGET 8 SP. TOTAL TARGET: 13 SP.
M-HC1 OPEN. Este cierre conserva sin staging/commit/push los cambios locales descritos abajo.

Referencias: [Inventory Custody Definition](INVENTORY_CUSTODY_DEFINITION.md),
[01D Technical Design](INVENTORY_CUSTODY_01D_TECHNICAL_DESIGN.md),
[Equipment Assignment TD](../healthcare/EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md),
[CaseKit](../healthcare/CASE_KITS.md),
[Dispatch contract](../healthcare/CASE_LOGISTICS.md#258-hc-case-dispatch--v1-approved-contract),
[Project Board](../../project/PROJECT_BOARD.md).


## Implementación local 01E-A y evidencia de validación

01E-A IMPLEMENTED / TESTED — pending human review/merge — TARGET 5 SP.
Baseline de implementación: `4e491fdbda5ca6d41d24ed5d4c41fe15058256a8`, rama
`feat/hc-inventory-custody-01e-a-equipment-physical-foundation`.
01E-B BLOCKED hasta aceptación/merge01E-A; TOTAL01E TARGET13SP conservado.

- EquipmentAsset añade physicalLocation UNVERIFIED por defecto, physicalRevision0
  y activeCustodyId nullable; AVAILABLE no se persiste. Custody con FKs compuestas
  Company/Asset/Case/Assignment/actor y UNIQUE parcial de episodio abierto.
- PhysicalEvent dedicado: origen/hash v1, revisión consecutiva, actor/evidencia,
  snapshots independientes y protección DB append-only UPDATE/DELETE/TRUNCATE.
  No ACL de roles hardcodeada en migraciones.
- Dos migraciones: `20261015000000_equipment_physical_foundation` y
  `20261015000100_equipment_custody_coherence`. La segunda sólo valida estructura
  puntero/episodio al commit; no consulta estado empresarial, agenda ni permisos.
  No endurecimiento de FKs históricas Product/Batch/ReceiptItem/retiredBy.
- Baseline interno + CLI single-Asset, sin --all, HTTP ni startup automático.
  Campos explícitos Company/Asset/reconciliationId/revisión/target WAREHOUSE,
  operador y referencia/hash de evidencia; actor de negocio opcional sólo baseline.
  READ COMMITTED → HC lock/timeouts → Asset lock → replay/evidencia → CAS0→1/evento.
  El adapter cerrado rechaza por defecto. Sólo configuración privilegiada
  `EQUIPMENT_BASELINE_EVIDENCE_ADAPTER_PATH` absoluta puede cargar una factory
  `createEquipmentBaselineEvidenceAdapter`; nunca se toma código de CLI/evidencia.
  La factory debe autenticar prueba externa real y su binding al comando.
- Receipt propaga actor en ambos callers; inicializa identidades ASSET nuevas a
  WAREHOUSE + INSPECTION_PENDING/rev1 con un evento por Asset dentro de su tx,
  sin HC lock adicional, nested transaction ni InventoryPhysicalEffect. Replay
  histórico no crea identidades/eventos retroactivos. Manual conserva UNVERIFIED/0.
- Proyección omit explícita conserva respuestas Equipment públicas. Availability,
  Assignment, Replace, Coverage y CaseKit no cambian. Inspection/Retirement siguen
  sin integración de physicalRevision: 01E-B es dueño de ese wiring. No afirmar
  cobertura global de revisión física ni custody productiva en01E-A.

Validación: focal118/118 en5 suites; PostgreSQL23/23; full API1948/1948 en117 suites;
Web Equipment/Receipts87/87 en5 archivos. Typecheck productivo, noEmit tocado, lint
completo, build, Prisma format/validate, Prettier y git diff --check PASS.
Generate estándar encontró EPERM al reemplazar DLL Windows ocupada, también fuera
del sandbox. Generate en destino nuevo PASS; cliente actualizado conservando DLL
existente tras comprobar SHA-256 idéntico
`263946105f428384d2318dc3241b85b1c3dd98fbb1bfac62d3e81f513ab35897`.
No se detuvieron procesos ajenos ni se afirma éxito del reemplazo estándar de DLL.

Aceptación: PostgreSQL16 nuevo loopback/tmpfs, DB vacía verificada;39 migraciones
base → ocho Assets históricos ACTIVE/RETIRED × cuatro conditions y hechos RESERVED/
PREPARED → dos migraciones nuevas → snapshot histórico conservado y cero eventos
ficticios. Target de aceptación funcional `127.0.0.1:52779/zaping_equipment_physical_test`, run
`618714df-e00c-423a-ad43-da311fe4c3d2`; rol runtime no superuser. Barreras explícitas
y conexiones independientes acreditan arbitraje de custodia/origen/revisión,
baseline concurrente, rollback y Receipt completando mientras HC lock está retenido.
Cleanup de fixtures/contenedor/tmpfs y archivos temporales task-owned PASS.
Runner: `node test/helpers/equipment-physical-foundation-postgres-runner.cjs --run-isolated`.
Primera corrida se detuvo en un fixture histórico CaseKit; corregido antes del
resultado23/23; su cleanup también PASS. Sin DB dev/QA/prod/prior-task; .env intacto.

REAL EQUIPMENT RECONCILIATION: NOT EXECUTED. PRODUCTIVE EQUIPMENT CUSTODY: NOT ENABLED.
01D IMPLEMENTATION COMPLETE / MERGED; REAL COMPANY CUTOVER NOT EXECUTED;
EXTERNAL OPERATIONAL FENCE NOT CERTIFIED. M-HC1 OPEN.
