# Healthcare Equipment Assignment — Zaping Healthcare

**Módulo:** Healthcare Equipment Assignment
**Producto:** Zaping Healthcare
**Slice:** HC-NEXT-03A — Equipment Assignment Domain Discovery
**Versión:** 1.0.0
**Estado de dominio:** APPROVED
**Estado del discovery:** COMPLETE / DOCUMENTED
**Estado del technical design:** HC-NEXT-03B — COMPLETE / APPROVED
**Estado HC-NEXT-03B.1:** PERSISTENCE & AVAILABILITY DESIGN — APPROVED / DOCUMENTED
**Estado HC-NEXT-03B.2:** API / DTO / AUTHORIZATION CONTRACT — APPROVED / DOCUMENTED
**Estado HC-NEXT-03B.3:** IMPLEMENTATION SLICING / ACCEPTANCE CONTRACT — APPROVED / DOCUMENTED
**Estado HC-NEXT-03C1:** PERSISTENCE / MIGRATION — COMPLETE / MERGED
**Estado HC-NEXT-03C2:** ASSIGNMENT BACKEND BASE — COMPLETE / MERGED
**Estado HC-NEXT-03C3:** AVAILABILITY / CONFLICT REVIEW / CONCURRENCY — COMPLETE / MERGED
**Estado HC-NEXT-03C4:** IN PROGRESS — MANUAL RELEASE, REPLACE AND HC-NEXT-03C4-C1 REQUIREMENT RETIRE MERGED; HC-NEXT-03C4-C2 CASE CANCEL TECHNICALLY COMPLETE / VALIDATED ON BRANCH / PENDING INTEGRATION
**Estado de implementación:** PARTIALLY IMPLEMENTED — C1–C3 + MANUAL RELEASE + REPLACE + REQUIREMENT RETIRE C4-C1 MERGED; CASE CANCEL VALIDATED ON BRANCH / PENDING INTEGRATION; FRONTEND PENDING
**Última actualización:** 2026-09-23
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Este documento define el contrato funcional de dominio aprobado para asignar
unidades físicas de Equipment a un Healthcare Case.

Equipment Assignment responde:

> **¿Qué EquipmentAsset concreto está reservado o previsto para atender el
> Case?**

No diseña Prisma, migrations, DTOs, endpoints, frontend, locking ni detalles de
implementación. Esas decisiones pertenecen a HC-NEXT-03B.

---

# 2. Ownership y flujo operacional

El flujo conceptual es:

```text
Technician
→ solicita material, consumible o equipo mediante un item de catálogo/Inventory,
  su nombre o tipo y la cantidad requerida

Warehouse
→ decide qué EquipmentAsset concreto satisface cada necesidad de equipo
→ normalmente lo hace al procesar la Requirement
→ puede reemplazar posteriormente el activo seleccionado
```

`Technician` describe al actor operacional. La correspondencia futura con roles,
usuarios o permisos autenticados no se define en este discovery.

ERP Core conserva ownership sobre:

- Product e Inventory;
- la identidad de EquipmentAsset;
- lifecycle y condition propios del activo.

Healthcare conserva ownership sobre la relación operacional entre Case y
EquipmentAsset.

---

# 3. Distinciones obligatorias

```text
Requirement
→ qué se necesita

Equipment Assignment
→ qué EquipmentAsset concreto se reserva o prevé para el Case

Dispatch / Custody
→ movimiento físico y quién tiene realmente el equipo

Equipment lifecycle / condition
→ estado intrínseco del activo
```

Por tanto:

```text
Assignment ≠ Requirement
Assignment ≠ Dispatch
Assignment ≠ Custody
Assignment ≠ Inventory Movement
Assignment ≠ Equipment lifecycle / condition
```

Una asignación no significa que el equipo haya salido físicamente de Warehouse,
no cambia por sí sola la custodia y no debe introducir estados como `ASSIGNED`
en el lifecycle de EquipmentAsset.

---

# 4. Relación con Healthcare Requirements

Todo lo solicitado mediante Healthcare Requirements permanece vinculado a un
Product existente del catálogo/Inventory. Equipment Assignment no crea un
catálogo paralelo ni una Requirement libre de Product.

Una Requirement de equipo puede expresar varias unidades requeridas para un
Case. Una Assignment normalmente debe resolver, total o parcialmente, esa
Requirement mediante EquipmentAsset concretos.

También se admite una asignación directa a un Case sin Requirement previa cuando
Warehouse atiende una necesidad urgente o de último minuto. Esta asignación
manual debe quedar identificada y ser claramente trazable.

B.1 define una fila de Assignment por EquipmentAsset concreto: tres unidades
requeridas pueden cubrirse con tres filas. `REQUIREMENT` exige `requirementId` y
`DIRECT` exige razón con `requirementId = null`. El detalle vive en
`EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md`.

Las Assignments activas con origin `REQUIREMENT` no pueden exceder
`requestedQty` para esa Requirement. Una unidad adicional de respaldo o por una
necesidad operacional de último momento debe usar origin `DIRECT`, exigir
`directAssignmentReason` y no cuenta hacia la cobertura de la Requirement. Esta
regla se valida en dominio/service; no se modela como un constraint SQL amplio.

---

# 5. Cobertura parcial y disponibilidad declarada

La cobertura incompleta de equipo no impide por sí sola que el Case continúe.
Case Status y Case Readiness son dimensiones distintas; un Case `SCHEDULED`
puede conservar alertas operacionales pendientes.

Los estados conceptuales de cobertura pueden incluir:

```text
PENDING
COVERED
PARTIAL
UNAVAILABLE
CONFLICT
```

No quedan aprobados en este discovery como enums persistidos. La cobertura debe
preferiblemente derivarse de:

- cantidad requerida;
- Assignments válidas;
- disponibilidad de los EquipmentAsset;
- conflictos operacionales.

Ejemplo:

```text
requiredQty = 3
validAssignments = 2
→ PARTIAL + warning visible
```

Warehouse puede registrar que el equipo requerido no está disponible.
`UNAVAILABLE` exige comentario o razón de Warehouse. `PARTIAL` debe admitir un
comentario explicativo.

B.1 mantiene coverage derivado y propone notas operacionales especializadas e
históricas para `UNAVAILABLE`/contexto parcial, sin persistir coverage como
status automático.

---

# 6. Disponibilidad para una nueva Assignment

Como mínimo, un EquipmentAsset no está disponible para una asignación nueva
cuando:

```text
lifecycle = RETIRED
condition = INSPECTION_PENDING
condition = DAMAGED
condition = OUT_OF_SERVICE
```

Un activo devuelto en `INSPECTION_PENDING` permanece no disponible hasta que una
inspección restablezca una condición aceptable.

Availability es derivada, contextual y explicable; no es un boolean manual ni
un nuevo lifecycle del activo.

La evaluación debe considerar una ventana operacional, no sólo
`scheduledStart` y `scheduledEnd`. Conceptualmente puede incluir:

- preparación;
- transporte;
- horario programado del Case;
- retorno;
- limpieza o esterilización;
- inspección cuando aplique.

B.1 define `preCaseBufferMinutes` y `postCaseBufferMinutes` Company-scoped en una
configuración Healthcare 1:1. Sin fila configurada se aplican los fallbacks de
sistema `120` minutos antes y `180` minutos después. Una fila Company-scoped
sustituye ambos valores, incluido cero; no se crea automáticamente ni usa
defaults PostgreSQL.

Una Assignment puede registrarse aunque la ventana operacional del Case todavía
no sea completamente derivable, por ejemplo cuando `scheduledEnd = null`. En
ese estado la disponibilidad queda pendiente/no completamente verificable: no
puede presentarse como libre de conflictos y la UI/API posterior debe mostrar
warning o revisión necesaria. Este estado es derivado y no introduce un enum
persistido. Cada alta o cambio del horario reevalúa automáticamente las
Assignments activas: si el schedule sigue incompleto permanecen pendientes y,
cuando permite derivar la nueva ventana completa, pueden pasar a `CONFLICT`.

La misma cautela aplica cuando el candidato sí tiene ventana completa, pero otra
Assignment `RESERVED` del mismo EquipmentAsset pertenece a un Case con schedule
incompleto. Esa reserva no se ignora ni se declara overlap: Create sigue
permitido, Availability devuelve `fullyVerifiable=false` y `conflictFree=null`,
y expone el warning estable
`RELATED_RESERVATION_SCHEDULE_INCOMPLETE`: “Existe una reserva activa del mismo
equipo con horario incompleto; la disponibilidad no puede verificarse
completamente.”

---

# 7. Solapamientos, conflictos y override

Cases simultáneos son válidos cuando el inventario de EquipmentAsset disponible
permite cubrirlos.

Si el mismo EquipmentAsset se superpone con la ventana operacional de otro Case:

- se muestra un warning de conflicto visible;
- la Assignment no se bloquea automáticamente;
- un usuario autorizado puede confirmar un override;
- el override exige justificación o comentario obligatorio;
- la decisión conserva trazabilidad de auditoría.

Un override de conflicto no marca el activo como globalmente disponible ni
elimina el conflicto. Registra una decisión operacional explícita y auditable.

Si coexisten overlaps confirmados y reservas same-asset no evaluables por
schedule incompleto, la API devuelve `CONFLICT_REVIEW_REQUIRED` únicamente por
los overlaps confirmados, conserva
`RELATED_RESERVATION_SCHEDULE_INCOMPLETE`, reporta
`fullyVerifiable=false` / `conflictFree=false` y crea auditoría de override sólo
para los conflictos con ventanas conocidas. La incertidumbre por sí sola no
crea `ConflictOverride`.

B.1 define review sin write, confirmación explícita con revalidación y locks
estrechos por EquipmentAsset. HC-NEXT-03B.2 aprueba el contrato
HTTP/DTO/error/fingerprint: review normal 200 sin write y confirmación vigente
con write atómico. El fingerprint incluye una firma determinista de las reservas
same-asset no evaluables, con estado suficiente del Case/Assignment para quedar
stale cuando el Case incompleto recibe o cambia su schedule; no inventa snapshots
de ventana para esas reservas.

---

# 8. Reassignment e historia

Una Assignment puede cambiar antes del Case. Reemplazar EquipmentAsset A por B
debe preservar como mínimo la historia conceptual de:

- activo original;
- activo sustituto;
- actor que realizó el cambio;
- fecha y hora;
- razón.

El estado actual no puede sobrescribir o borrar la historia anterior. B.1 define
filas históricas con lifecycle `RESERVED` / `RELEASED` / `REPLACED` y una
self-relation de lineage hacia la Assignment reemplazada.

Si ya existe Dispatch o Custody, modificar la Assignment no reescribe la realidad
física: cualquier cambio adicional debe coordinarse con los workflows futuros
correspondientes.

---

# 9. Reschedule, cancelación y retiro de Requirement

## 9.1 Reschedule

Reprogramar un Case no descarta automáticamente sus Assignments.

El sistema debe reevaluar su disponibilidad contra la nueva ventana operacional.
Según el resultado, el usuario puede:

- conservar Assignments válidas;
- ajustar o reasignar equipo;
- reprogramar nuevamente;
- cancelar cuando corresponda.

Los nuevos conflictos se presentan como alertas operacionales que requieren
atención; no se ocultan ni borran la asignación histórica.

La reevaluación también aplica cuando un Case relacionado que antes tenía
schedule incompleto recibe o cambia su horario. C3 no requiere una notificación
automática ni un background job para esta derivación.

## 9.2 Cancelación

Cuando un Case pasa a `CANCELLED`, sus Assignments activas o reservadas se liberan
automáticamente.

Los activos liberados vuelven a estar disponibles únicamente si su lifecycle,
condition y demás hechos operacionales lo permiten.

La liberación de Assignment no revierte Dispatch ni Custody. Si el equipo ya
salió físicamente de Warehouse, Return/Reconciliation sigue siendo necesario y
la cancelación no debe falsear esa realidad.

## 9.3 Retiro o cancelación de Requirement

Cuando una Equipment Requirement se retira o cancela, sus Assignments activas
con lifecycle `RESERVED` y origin `REQUIREMENT` se liberan automáticamente. Las
filas históricas se conservan y las Assignments originadas como `DIRECT` no se
liberan por esta regla.

La liberación afecta sólo la reserva lógica. La integración futura con
Dispatch/Custody debe impedir que esta transición presente como físicamente
disponible un activo que ya salió de Warehouse o está gobernado por esos
dominios. El guard concreto de esa integración permanece diferido.

---

# 10. Intención RBAC de dominio

La matriz fija aprobada para Equipment Assignment es:

| Rol | Leer contexto | Assign | Replace | Release | Conflict override |
| --- | --- | --- | --- | --- | --- |
| ADMIN | Sí | Sí | Sí | Sí | Sí |
| MANAGER | Sí | Sí | Sí | Sí | Sí |
| WAREHOUSE | Sí | Sí | Sí | Sí | Sí |
| SALES | Sí | No | No | No | No |

SALES conserva acceso de lectura/contexto, sin mutaciones.

Esta matriz expresa intención de dominio. Decorators, guards, rutas y cualquier
autorización exacta de API pertenecen a HC-NEXT-03B. Permission-based RBAC no se
introduce en este slice.

---

# 11. Tenant isolation y auditoría

Como invariante transversal existente:

```text
HealthcareCase.companyId
= Requirement.companyId when related
= EquipmentAsset.companyId
= Assignment company ownership
```

No se permiten relaciones cross-tenant. B.1 propone composite foreign keys para
Case, EquipmentAsset, Requirement, lineage y hechos de override.
HC-NEXT-03B.2 exige lookups `id + companyId`, IDs foreign indistinguibles de
missing mediante 404 tenant-safe y actores derivados del principal autenticado.

Deben ser auditables, como mínimo:

- Assign;
- direct/manual Assign;
- Replace;
- Release;
- conflict override;
- liberación automática por cancelación de Case;
- liberación automática por retiro/cancelación de Requirement.

La auditoría debe poder explicar actor, momento, acción, razón cuando sea
obligatoria y contexto relevante antes/después, sin definir todavía campos o
infraestructura exactos.

---

# 12. Límites de HC-NEXT-03

HC-NEXT-03 se concentra en la selección de EquipmentAsset concretos para un
Case.

No implementa ni absorbe:

- fulfillment de materiales o consumibles;
- Dispatch o Custody;
- Inventory Movement;
- Return/Reconciliation;
- Equipment lifecycle o condition;
- Preparation o CaseKit/Maletín;
- reglas de movimiento físico;
- un catálogo Healthcare paralelo de equipos.

Material/consumable fulfillment está relacionado operacionalmente, pero queda
fuera del foco de Equipment Assignment.

Advanced Dispatch/Custody permanece en un slice posterior y requiere su propio
gate arquitectónico sobre posicionamiento físico, custodia, ubicación y
transferencias.

---

# 13. Estado del technical design

`EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md` aprueba en B.1:

- una fila histórica por EquipmentAsset;
- lifecycle `RESERVED` / `RELEASED` / `REPLACED`;
- origin `REQUIREMENT` / `DIRECT`;
- lineage de reemplazo;
- persistencia especializada de override y notas de cobertura;
- configuración Company-scoped para buffers pre/post Case;
- ventana y overlap derivados;
- Assignment permitida con schedule incompleto, con disponibilidad pendiente y
  revalidación automática al completar o cambiar la ventana;
- liberación automática de reservas originadas por Requirement cuando ésta se
  retira/cancela, preservando historia;
- límite de cobertura por `requestedQty`, con extras originados como `DIRECT` y
  validación de dominio/service;
- composite foreign keys tenant-safe;
- revalidación optimista con locks estrechos justificados;
- separación entre invariantes DB y reglas de service.

HC-NEXT-03B.2 aprueba el recurso
`/healthcare/equipment-assignments`, list/detail, Create, Replace y Release;
DTOs allowlisted, response shaping, paginación, stable errors, fingerprint de
review, `Idempotency-Key`, fronteras atómicas y la matriz fixed-role. ADMIN,
MANAGER y WAREHOUSE pueden crear/reemplazar/liberar/confirmar overrides; SALES
conserva lectura. Frontend UX continúa diferido.

La implementación concreta del guard futuro con Dispatch/Custody permanece
diferida. HC-NEXT-03C1 implementa la persistencia, HC-NEXT-03C2 el backend base
de lectura y creación, y HC-NEXT-03C3 Availability/conflict review y la
concurrencia de Create. En HC-NEXT-03C4, Manual Release, Replace y C4-C1
Requirement Retire están merged. C4-C2 Case Cancel está implementado y validado
técnicamente en rama, pendiente de integración; frontend permanece pendiente.

## 13.1 Corte de implementación HC-NEXT-03C4-B — Replace

`POST /healthcare/equipment-assignments/:assignmentId/replace` devuelve HTTP 200
tanto para `REPLACED` como para `CONFLICT_REVIEW_REQUIRED`. ADMIN, MANAGER y
WAREHOUSE pueden ejecutar el comando; SALES conserva acceso read-only.

Replace sólo acepta una fuente `RESERVED`: conserva A y su activo original como
historia `REPLACED`, crea B `RESERVED` con `replacesAssignmentId = A.id` y hereda
Case, Requirement, origin y `directAssignmentReason`. Actor, timestamp y razón
quedan en A; cualquier `ConflictOverride` confirmado queda asociado a B. Claim,
B, overrides y transición de A comparten una transacción, y el claim completado
de scope `HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE` apunta a B.

La evaluación autoritativa reutiliza C3 bajo locks, excluye la fuente cuando
corresponde, no fabrica conflictos ante horarios incompletos y retorna review sin
writes antes de una confirmación válida. Replace sustituye una unidad de
cobertura: incluso con el Requirement ya cubierto, la cobertura `RESERVED` neta
no aumenta.

Validación de cierre B5: backend unitario 85 suites / 1353 tests PASS; foco
Equipment Assignment/RBAC 8 suites / 268 tests PASS; PostgreSQL QA real B4-A
6/6, B4-B1 7/7 y B4-B2 HTTP/JWT 8/8 PASS; typecheck, lint y build PASS.

Limitaciones conocidas: el E2E HTTP usa una app NestJS in-process con Supertest,
no un puerto/proxy externo; cancelación del cliente mientras espera locks no fue
ejercitada. Parent integrations, frontend y los guards futuros de
Dispatch/Custody continúan fuera de C4-B.

## 13.2 HC-NEXT-03C4-C1 — Requirement Retire Parent Integration

**Estado:** COMPLETE / MERGED IN `main@3e1810f`

### Objetivo y alcance

El comando existente
`POST /healthcare/requirements/:requirementId/retire` debe retirar la Requirement
y liberar atómicamente todas sus Equipment Assignments que continúen
`RESERVED`, tengan `origin = REQUIREMENT` y pertenezcan al mismo tenant, Case y
Requirement. No se crea una ruta nueva ni cambia la respuesta pública del
Requirement.

El comando padre conserva su RBAC, validación, normalización, errores e
idempotencia por estado. El release derivado se ejecuta con el mismo
`Prisma.TransactionClient`; no invoca la ruta pública de Manual Release ni abre
una segunda transacción.

### Dependencias y Definition of Ready

- `main@8a3b189` integra HC-LOCK-02 y HC-LOCK-03.
- El prerequisite checkpoint de HC-LOCK-04 está acreditado; el checkpoint final
  permanece pendiente.
- Existen `origin = REQUIREMENT`, `lifecycle = RESERVED/RELEASED`,
  `releaseCause = REQUIREMENT_WITHDRAWN` y el índice tenant-scoped por
  Requirement/lifecycle; no se requiere migración.
- El comando padre ya aplica la política compartida de transacción, Company lock,
  subsequent timeouts y locks tenant-scoped de Case y Requirement.
- Las decisiones funcionales y transaccionales de esta sección están aprobadas.

Estas dependencias formaron el DoR aprobado y quedaron satisfechas para la
implementación y validación técnica de C4-C1.

### Reglas funcionales y de auditoría

1. Sólo transicionan Assignments que, bajo lock, sigan siendo `RESERVED`, tengan
   `origin = REQUIREMENT` y estén relacionadas con el `companyId`, `caseId` y
   `requirementId` del comando padre.
2. `DIRECT`, Assignments de otra Requirement, Case o Company, y filas ya
   `RELEASED` o `REPLACED` permanecen intactas.
3. Cada transición derivada persiste `releaseCause = REQUIREMENT_WITHDRAWN`,
   `releasedById = retiredById` y `releaseReason = retirementReason` ya
   normalizada por el comando padre.
4. `retiredAt` y todos los `releasedAt` de la operación comparten un único
   timestamp creado para esa operación.
5. Un replay sobre una Requirement ya `RETIRED` devuelve la respuesta histórica
   vigente con cero writes: no sobrescribe auditoría, no vuelve a liberar filas y
   no repara Assignments históricas rezagadas.
6. Retire no incorpora `Idempotency-Key` ni crea claims de Assignment. Su replay
   continúa determinado por el lifecycle del Requirement.
7. Todas las filas históricas permanecen legibles.

### Frontera transaccional y orden

La única transacción sigue este orden:

```text
Company advisory lock
→ subsequent transaction timeouts
→ HealthcareCase FOR UPDATE
→ HealthcareCaseRequirement FOR UPDATE
→ revalidación de lifecycle y policy del Requirement
→ Assignments aplicables FOR UPDATE, ORDER BY id ASC
→ transición condicional del Requirement
→ releases condicionales de Assignments
→ readback del Requirement
→ commit
```

El reread/lock de Assignments revalida tenant, Case, Requirement, origin y
lifecycle antes de escribir. Los updates conservan esos predicados; si una fila
bloqueada no puede transicionar como se esperaba, la operación falla con el
conflicto estable de cambio de estado y toda la transacción revierte. Cero
Assignments aplicables es un retiro válido.

No se adquieren locks de EquipmentAsset: el Company lock serializa los comandos
participantes de la misma Company y esta integración sólo termina reservas
lógicas. Las Assignments múltiples se bloquean por ID ascendente para conservar
un orden determinista.

### Acceptance Criteria

- Retirar una Requirement `ACTIVE` confirma en un solo commit su auditoría y el
  release de todas las Assignments aplicables.
- Una, múltiples o cero Assignments aplicables producen el resultado definido,
  sin liberaciones parciales.
- Actor, razón normalizada y timestamp compartido quedan persistidos exactamente
  según este contrato.
- Repetir Retire sobre `RETIRED` devuelve HTTP 200 sin writes ni reparación.
- `DIRECT`, otros tenants/parents y lifecycles históricos no cambian.
- Create/Replace/Manual Release concurrentes observan el estado confirmado del
  ganador después de la serialización Company-first; no hay reserva huérfana ni
  auditoría sobrescrita.
- Un fallo en cualquier write o readback revierte Requirement y Assignments.
- Se preservan RBAC, aislamiento tenant, respuesta HTTP directa y precedencia de
  errores del comando padre.
- No se crean Inventory Movement, Return, Custody ni efectos físicos.

### Pruebas requeridas

- Unitarias de Requirements: orden, mismo transaction client, timestamp único,
  replay zero-write, cero/múltiples filas, propagación de errores y ausencia de
  writes posteriores al fallo.
- Unitarias de Assignment service/repository: selección y locks deterministas,
  filtros tenant/Case/Requirement/origin/lifecycle, auditoría y conditional
  update en cero.
- Regresiones de controller/RBAC y respuesta pública de Requirement.
- PostgreSQL E2E determinista para Retire con cero/una/múltiples reservas;
  Create/Retire, Replace/Retire y Manual Release/Retire en ambos órdenes de
  commit; rollback persistido; aislamiento tenant; replay; y ausencia de claims
  o efectos físicos.
- Gates estáticos y locales: suites focales, typecheck, ESLint, Prettier, build y
  `git diff --check`.

### Definition of Done

- Implementación limitada a la coordinación interna transaction-bound y sus
  primitivas repository/service.
- Acceptance Criteria y pruebas requeridas PASS, incluida evidencia PostgreSQL
  real aislada para concurrencia y rollback.
- Sin cambios de schema, migraciones, rutas, DTOs ni contrato HTTP.
- Documentación y Project Board alineados con la evidencia final.
- C4-C1 puede cerrarse sin declarar cerrado HC-NEXT-03C4-C ni HC-LOCK-04.

### Evidencia de cierre técnico

- Jest focal: 429/429 PASS.
- Typecheck, ESLint, Prettier focal, API build y `git diff --check`: PASS.
- PostgreSQL E2E C4-C1: 13/13 PASS, exit 0; 14 pruebas no seleccionadas por el
  filtro; ejecución sobre `zaping_spike_test` aislada.
- El E2E acreditó cero/una/múltiples reservas, auditoría y timestamp compartido,
  rollback persistido, replay zero-write, exclusiones, aislamiento tenant,
  HTTP/RBAC y ambos órdenes de commit frente a Create, Replace y Manual Release.
- No hubo cambios de schema o migraciones, claims nuevos ni efectos físicos.
- El cleanup acreditado está acotado a fixtures del run: el teardown elimina por
  sus Company IDs, verifica conteos cero y propaga fallos. No acredita una base
  globalmente vacía, staging, producción ni readiness productiva.

### Fuera de alcance y checkpoint posterior

Quedan fuera Case Cancel Parent Integration, reparación de datos históricos,
reactivación o recreación automática de reservas, Manual Release/Replace nuevos,
frontend, Dispatch, Return, Custody, movimiento o disponibilidad física y cambios
de inventario. Case Cancel será un incremento separado de HC-NEXT-03C4-C.

HC-NEXT-03C4-C1 aporta evidencia al checkpoint final de HC-LOCK-04, pero no lo
completa. Ese checkpoint sólo puede acreditarse después de implementar la Parent
Integration restante y ejecutar las regresiones integradas de ambos comandos.

---

## 13.3 HC-NEXT-03C4-C2 — Case Cancel Parent Integration

**Estado:** TECHNICALLY COMPLETE / VALIDATED ON BRANCH / PENDING INTEGRATION

### Objetivo y alcance

El comando existente `POST /healthcare/cases/:caseId/cancel` debe cancelar el
Healthcare Case y liberar atómicamente todas sus Equipment Assignments que bajo
lock continúen `RESERVED` y pertenezcan al mismo `companyId` y `caseId`. La regla
incluye ambos origins, `DIRECT` y `REQUIREMENT`; no crea una ruta nueva ni cambia
el DTO, RBAC, status HTTP o respuesta pública directa del Case.

El comando padre y los releases derivados comparten una sola transacción y el
mismo `Prisma.TransactionClient`. La integración reutiliza las primitivas
internas introducidas por C4-C1; no invoca la ruta pública de Manual Release ni
abre una segunda transacción.

### Dependencias y Definition of Ready

- C4-C1 y sus primitivas transaction-bound están integradas en
  `main@3e1810f`.
- HC-LOCK-02 y HC-LOCK-03 están integrados; el prerequisite checkpoint de
  HC-LOCK-04 está acreditado y su checkpoint final permanece pendiente.
- Existen `origin = DIRECT/REQUIREMENT`, `lifecycle = RESERVED/RELEASED`,
  `releaseCause = CASE_CANCELLED` y el índice tenant-scoped por Case/lifecycle;
  no se requiere migración.
- El endpoint vigente ya autoriza sólo ADMIN/MANAGER, valida el actor y la razón
  y conserva la respuesta pública directa del Case.
- Las reglas funcionales, de replay, auditoría y atomicidad de esta sección
  están aprobadas.

**DoR:** READY.

### Reglas funcionales y de auditoría

1. Sólo transicionan Assignments que bajo lock sigan `RESERVED` y pertenezcan al
   `companyId` y `caseId` del comando padre. Se incluyen `DIRECT` y
   `REQUIREMENT`.
2. Assignments de otro Case o Company y filas ya `RELEASED` o `REPLACED`
   permanecen intactas; todas las filas históricas siguen legibles.
3. Cada transición derivada persiste `releaseCause = CASE_CANCELLED`,
   `releasedById = cancelledById` y `releaseReason` igual a la
   `cancellationReason` persistida por el Case, sin normalización adicional.
4. `cancelledAt` y todos los `releasedAt` de la operación comparten un único
   timestamp.
5. Repetir Cancel sobre un Case ya `CANCELLED` conserva el HTTP 409 vigente y
   ejecuta cero writes: no sobrescribe auditoría, no vuelve a liberar filas y no
   repara Assignments históricas rezagadas.
6. Cero Assignments elegibles es una cancelación válida.
7. Case Cancel no incorpora `Idempotency-Key` ni crea claims de Assignment.

### Frontera transaccional y orden

La única transacción sigue este orden:

```text
Company advisory lock
→ subsequent transaction timeouts
→ HealthcareCase FOR UPDATE
→ revalidación tenant-scoped de lifecycle y actor
→ Assignments RESERVED del Case FOR UPDATE, ORDER BY id ASC
→ transición condicional del Case
→ releases condicionales de Assignments
→ readback del Case
→ commit
```

Los locks y updates de Assignment revalidan `companyId`, `caseId` y lifecycle.
Si el Case o una fila bloqueada no puede transicionar como se esperaba, la
operación devuelve el conflicto estable aplicable y toda la transacción revierte.
No se adquieren locks de EquipmentAsset: el Company lock serializa los comandos
participantes de la misma Company y esta integración sólo termina reservas
lógicas.

### Acceptance Criteria

- Cancelar un Case elegible confirma en un solo commit su auditoría y el release
  de todas las Assignments `RESERVED` `DIRECT` y `REQUIREMENT` aplicables.
- Una, múltiples o cero Assignments aplicables producen el resultado definido,
  sin liberaciones parciales.
- Cause, actor, razón exacta del padre y timestamp compartido quedan persistidos
  según este contrato.
- Replay `CANCELLED` devuelve HTTP 409 con cero writes y sin reparación
  histórica.
- Otros tenants/Cases y lifecycles históricos permanecen intactos.
- Create/Replace/Manual Release/Requirement Retire concurrentes observan el
  estado confirmado del ganador después de la serialización Company-first.
- Un fallo en cualquier write o readback revierte Case y Assignments.
- Se preservan endpoint, DTO, RBAC ADMIN/MANAGER, status HTTP, tenant isolation,
  respuesta pública directa y precedencia de errores del comando padre.
- No se crean claims, Inventory Movement, Return, Custody ni efectos físicos.

### Pruebas requeridas

- Unitarias de Cases: orden, mismo transaction client, timestamp único, replay
  409 zero-write, cero/una/múltiples filas, rollback y propagación de errores.
- Unitarias de Assignment service/repository: locks deterministas, ambos
  origins, filtros tenant/Case/lifecycle, auditoría y conditional update en cero.
- Regresiones de controller/RBAC, validación, status y respuesta pública de Case.
- PostgreSQL E2E determinista para Cancel con cero/una/múltiples reservas;
  Create/Cancel, Replace/Cancel, Manual Release/Cancel y Requirement
  Retire/Cancel en ambos órdenes de commit; rollback persistido, aislamiento
  tenant, replay y ausencia de claims o efectos físicos.
- Gates estáticos y locales: suites focales, typecheck, ESLint, Prettier, build y
  `git diff --check`.

### Definition of Done

- Implementación limitada a Case Cancel y la coordinación interna
  transaction-bound reutilizable de Equipment Assignments.
- Acceptance Criteria y pruebas requeridas PASS, incluida evidencia PostgreSQL
  real aislada para concurrencia y rollback.
- Sin cambios de schema, migraciones, rutas, DTOs ni contratos públicos.
- Documentación y Project Board alineados con la evidencia final.
- C4-C2 puede cerrarse sin declarar cerrado HC-NEXT-03C4-C ni el checkpoint final
  de HC-LOCK-04 hasta completar la integración y validación conjunta.

### Evidencia de validación en rama

- Jest focal: 346/346 PASS.
- Typecheck, `lint:check`, Prettier focal, API build y `git diff --check`: PASS.
- PostgreSQL/HTTP E2E focal sobre la base aislada `zaping_spike_test`: 16/16
  PASS, 26 skipped por filtro, exit 0. La ejecución cubrió 15 escenarios C4-C2
  y la regresión C4-C1 que mantiene `DIRECT` al retirar una Requirement.
- El harness elimina únicamente fixtures de los Company IDs del run, verifica
  conteos cero y propaga cualquier fallo de cleanup.
- La aceptación en rama no sustituye la integración en `main` ni el checkpoint
  integrado final de HC-LOCK-04.

### Fuera de alcance y checkpoint posterior

Quedan fuera reparación histórica, reapertura de Cases, Case Availability,
frontend, Dispatch, Return, Custody, Inventory Movement, disponibilidad física y
cambios de lifecycle/condition del EquipmentAsset. C4-C2 no implementa nuevas
capacidades de Manual Release, Replace o Requirement Retire.

El prerequisite checkpoint de HC-LOCK-04 está acreditado. Su checkpoint final
permanece pendiente hasta integrar C4-C2 y ejecutar las regresiones integradas de
ambas Parent Integrations.

---

# 14. Estado final

```text
HC-NEXT-03A — Equipment Assignment Domain Discovery
→ COMPLETE / DOCUMENTED

HC-NEXT-03B — Equipment Assignment Technical Design
→ COMPLETE / APPROVED

HC-NEXT-03B.1 — Persistence & Availability Design
→ APPROVED / DOCUMENTED

HC-NEXT-03B.2 — API / DTO / Authorization Contract
→ APPROVED / DOCUMENTED

HC-NEXT-03B.3 — Implementation Slicing / Acceptance Contract
→ APPROVED / DOCUMENTED

HC-NEXT-03C1 — Equipment Assignment Persistence / Migration
→ COMPLETE / MERGED

HC-NEXT-03C2 — Assignment Backend Base
→ COMPLETE / MERGED

HC-NEXT-03C3 — Availability / Conflict Review / Concurrency
→ COMPLETE / MERGED

HC-NEXT-03C4 — Replace / Release / Parent Integrations
→ IN PROGRESS
→ MANUAL RELEASE AND REPLACE COMPLETE / MERGED
→ REQUIREMENT RETIRE C4-C1 COMPLETE / MERGED IN main@3e1810f
→ CASE CANCEL C4-C2 TECHNICALLY COMPLETE / VALIDATED ON BRANCH / PENDING INTEGRATION
→ HC-LOCK-04 FINAL INTEGRATED CHECKPOINT PENDING

Equipment Assignment implementation
→ PARTIALLY IMPLEMENTED — C1–C3 + MANUAL RELEASE + REPLACE + REQUIREMENT RETIRE C4-C1 MERGED; C4-C2 VALIDATED ON BRANCH
→ C4-C2 PENDING INTEGRATION; FRONTEND PENDING
```

El contrato aprobado mantiene la secuencia:

```text
Requirement
→ Assignment
→ derived availability / coverage
→ Dispatch / Custody when physical movement occurs
```

sin fusionar planeación, reserva operacional, disponibilidad, movimiento físico,
custodia ni estado intrínseco del activo.
