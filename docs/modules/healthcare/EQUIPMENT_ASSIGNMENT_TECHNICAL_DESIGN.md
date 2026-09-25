# Healthcare Equipment Assignment — Technical Design

**Módulo:** Healthcare Equipment Assignment
**Producto:** Zaping Healthcare
**Slices aprobados:** HC-NEXT-03B.1 — Persistence & Availability Design; HC-NEXT-03B.2 — API / DTO / Authorization Contract; HC-NEXT-03B.3 — Implementation Slicing / Acceptance Contract
**Versión:** 1.2.0
**Estado HC-NEXT-03B.1:** APPROVED / DOCUMENTED
**Estado HC-NEXT-03B.2:** APPROVED / DOCUMENTED
**Estado HC-NEXT-03B.3:** APPROVED / DOCUMENTED
**Estado de HC-NEXT-03B:** COMPLETE / APPROVED
**Estado HC-NEXT-03C1:** COMPLETE / MERGED
**Estado HC-NEXT-03C2:** COMPLETE / MERGED
**Estado HC-NEXT-03C3:** COMPLETE / MERGED
**Estado HC-NEXT-03C4:** COMPLETE / MERGED — MANUAL RELEASE HC-LOCK-03B, REPLACE, REQUIREMENT RETIRE C4-C1 AND CASE CANCEL C4-C2 IN MAIN; HC-LOCK-04 FINAL CLOSED / ACCEPTED
**Estado de implementación:** PARTIALLY IMPLEMENTED — BACKEND C1–C4 COMPLETE / MERGED; C5-A COMPLETE / MERGED; C6-A READ-ONLY CASE VIEW PLANNED AS NEXT PRODUCT INCREMENT; C5-B PLANNED — B0 NOT READY; B1–B3 NOT IMPLEMENTED
**Última actualización:** 2026-09-24
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito y autoridad

Este documento define el diseño técnico aprobado de persistencia, integridad,
Availability, concurrencia, API, DTOs, autorización, errores, slices de
implementación y acceptance para Equipment Assignment.

Parte del contrato de dominio cerrado en `EQUIPMENT_ASSIGNMENT.md` y no lo
reabre. B.1 y B.2 no modifican Prisma, no crean migrations y no implementan
backend, frontend ni tests.

Quedan fuera de B.1:

- rutas y métodos HTTP;
- DTOs y transformation/validation de transporte;
- códigos HTTP y stable error codes;
- response shaping, pagination y filtros API;
- guards/decorators concretos;
- frontend UX;
- integración concreta con los comandos de cancelación del Case y
  retiro/cancelación de Requirement.

Esos contratos, salvo frontend, quedan resueltos por HC-NEXT-03B.2 en las
secciones 21 a 33. HC-NEXT-03B.3 descompone la implementación y fija su
acceptance en las secciones 34 a 39; no implementa ninguno de esos slices.

---

# 2. Decisiones estructurales

La unidad persistente es una fila histórica por EquipmentAsset concreto:

```text
one Equipment Assignment row
→ one HealthcareCase
→ one concrete EquipmentAsset
→ zero or one HealthcareCaseRequirement
```

Si una Requirement solicita cantidad 3, tres EquipmentAsset distintos pueden
producir tres filas `RESERVED` relacionadas con esa Requirement.

No se persisten automáticamente estados agregados como `COVERED`, `PARTIAL`,
`PENDING` o `CONFLICT`. Coverage se calcula desde la Requirement, las
Assignments vigentes, la elegibilidad de cada activo y sus conflictos.

---

# 3. Entidades propuestas

B.1 propone cuatro entidades especializadas:

```text
HealthcareEquipmentAssignment
HealthcareEquipmentAssignmentConflictOverride
HealthcareEquipmentRequirementCoverageNote
HealthcareEquipmentAssignmentSettings
```

No constituyen un audit framework genérico. Cada una conserva hechos propios de
Equipment Assignment.

---

# 4. HealthcareEquipmentAssignment

## 4.1 Campos

| Campo | Tipo conceptual | Regla |
| --- | --- | --- |
| `id` | UUID | Identidad inmutable. |
| `companyId` | UUID | Tenant owner; nunca proviene como autoridad del cliente. |
| `caseId` | UUID | HealthcareCase requerido e inmutable. |
| `equipmentAssetId` | UUID | EquipmentAsset concreto requerido e inmutable. |
| `requirementId` | UUID nullable | Requerido sólo para origen `REQUIREMENT`. |
| `origin` | enum | `REQUIREMENT` o `DIRECT`. |
| `lifecycle` | enum | `RESERVED`, `RELEASED` o `REPLACED`. |
| `replacesAssignmentId` | UUID nullable | Predecesora reemplazada por esta fila. |
| `directAssignmentReason` | string nullable | Obligatoria y no blank para origen `DIRECT`. |
| `createdById` | UUID | Actor que reservó el activo. |
| `createdAt` | timestamp | Inicio de la reserva lógica. |
| `updatedAt` | timestamp | Timestamp técnico de última mutación. |
| `releasedAt` | timestamp nullable | Momento de transición a `RELEASED`. |
| `releasedById` | UUID nullable | Actor del release manual o de la cancelación. |
| `releaseCause` | enum nullable | `MANUAL`, `CASE_CANCELLED` o `REQUIREMENT_WITHDRAWN`. |
| `releaseReason` | string nullable | Obligatoria y no blank para release manual; opcional para releases internos con cause explícita. |
| `replacedAt` | timestamp nullable | Momento de transición a `REPLACED`. |
| `replacedById` | UUID nullable | Actor que ejecutó el reemplazo. |
| `replacementReason` | string nullable | Obligatoria y no blank cuando lifecycle es `REPLACED`. |

No se agregan:

```text
DISPATCHED
RETURNED
IN_CUSTODY
```

ni campos de posición física. Esos hechos pertenecen a Dispatch/Custody/Return.

## 4.2 Inmutabilidad

Después de crear una fila no se sobrescriben:

- `companyId`;
- `caseId`;
- `equipmentAssetId`;
- `requirementId`;
- `origin`;
- `replacesAssignmentId`;
- `directAssignmentReason`.

Las operaciones posteriores cambian lifecycle y sus metadatos explícitos. Un
nuevo período de reserva usa una fila nueva; no reactiva una fila histórica.

---

# 5. Lifecycle mínimo

```text
RESERVED
├── manual/cancellation release → RELEASED
└── replacement               → REPLACED
```

`RELEASED` y `REPLACED` son terminales.

Semántica:

| Lifecycle | Significado |
| --- | --- |
| `RESERVED` | El activo está lógicamente reservado o previsto para el Case. |
| `RELEASED` | La reserva terminó sin ser sustituida mediante esta operación. |
| `REPLACED` | La fila fue sustituida por otra Assignment con otro activo. |

Ningún lifecycle afirma Dispatch, Return o Custody.

---

# 6. Origin y relación con Requirement

## 6.1 REQUIREMENT

```text
origin = REQUIREMENT
requirementId = required
directAssignmentReason = null
```

La Requirement debe pertenecer al mismo Case y Company. El Product de la
Requirement debe coincidir con el Product propietario del EquipmentAsset. Esta
última igualdad se valida en service para no duplicar `productId` dentro de
Assignment.

Las Assignments `REQUIREMENT` participan en coverage de esa Requirement.

El service permite como máximo `requestedQty` filas activas `RESERVED` de origen
`REQUIREMENT` para la misma Requirement. Cuando ese límite ya está cubierto, una
unidad adicional debe usar origen `DIRECT`, con `directAssignmentReason`, y no
cuenta hacia la cobertura de la Requirement.

Una Requirement retirada/cancelada no admite nuevas Assignments de origen
`REQUIREMENT`; conserva únicamente sus filas históricas.

## 6.2 DIRECT

```text
origin = DIRECT
requirementId = null
directAssignmentReason = required non-blank
```

El EquipmentAsset continúa proporcionando el vínculo estructural al Product de
catálogo. `directAssignmentReason` explica la excepción urgente o de último
minuto; no reemplaza Product ni crea una Requirement free-text.

Las Assignments `DIRECT` pertenecen al Case, pero no cuentan como cobertura de
una Requirement no relacionada.

---

# 7. Replacement y lineage

Reemplazar A por B se ejecuta como una sola transacción de dominio:

```text
A lifecycle = RESERVED
↓
create B lifecycle = RESERVED
B.replacesAssignmentId = A.id
↓
A lifecycle = REPLACED
A.replacedAt / replacedById / replacementReason = required
```

La self-relation apunta desde la nueva fila hacia su predecesora. Una Assignment
puede tener como máximo una sucesora directa, evitando ramas accidentales.

La relación debe cumplir:

- predecesora y sucesora pertenecen al mismo Company y Case;
- B usa un EquipmentAsset diferente de A;
- B conserva `origin`, `requirementId` y, cuando aplica, el contexto directo de A;
- A estaba `RESERVED` al iniciar la transición;
- B se valida como una asignación nueva;
- ninguna fila puede reemplazarse a sí misma;
- toda la transición es atómica.

A deja de contribuir conflictos como reserva lógica al quedar `REPLACED`. El
activo sólo se considera disponible si lifecycle, condition y hechos físicos
posteriores también lo permiten.

Cuando un futuro Dispatch/Custody pruebe que A salió físicamente de Warehouse,
ese productor deberá impedir que el simple reemplazo se interprete como retorno
o disponibilidad física. B.1 documenta el guard cross-domain, pero no lo
implementa.

---

# 8. Conflict override persistente

`HealthcareEquipmentAssignmentConflictOverride` conserva una fila por conflicto
concretamente revisado y aceptado.

| Campo | Tipo conceptual | Regla |
| --- | --- | --- |
| `id` | UUID | Identidad del hecho de override. |
| `companyId` | UUID | Tenant owner. |
| `assignmentId` | UUID | Assignment creada/confirmada con conflicto. |
| `conflictingAssignmentId` | UUID | Assignment `RESERVED` revisada. |
| `assignmentWindowStart` | timestamp | Snapshot de la ventana confirmada. |
| `assignmentWindowEnd` | timestamp | Snapshot de la ventana confirmada. |
| `conflictingWindowStart` | timestamp | Snapshot de la otra ventana. |
| `conflictingWindowEnd` | timestamp | Snapshot de la otra ventana. |
| `approvedById` | UUID | ADMIN/MANAGER/WAREHOUSE que confirmó. |
| `reason` | string | Justificación obligatoria y no blank. |
| `createdAt` | timestamp | Momento del override. |

Los snapshots evitan que una aprobación antigua cubra silenciosamente un
conflicto diferente después de reschedule o cambio de buffers. Si las ventanas o
el conjunto de conflictos cambian, se requiere una revisión nueva.

No se impone unique por par de Assignments: el mismo par puede requerir una nueva
aprobación histórica tras cambiar su ventana. Sí se indexa para reconstruir la
auditoría.

Una reserva same-asset cuyo Case tiene schedule incompleto no es un conflicto
confirmado porque no existe una ventana contra la cual demostrar overlap. No se
crea `HealthcareEquipmentAssignmentConflictOverride` por esa incertidumbre. Las
filas de override se crean únicamente para overlaps confirmados entre ventanas
completas y conservan una fila por cada conflicto concretamente revisado.

---

# 9. Coverage derivado y notas operacionales

## 9.1 Conteo válido

Para una Requirement de equipo:

```text
required = requirement.requestedQty
assigned = count(valid RESERVED REQUIREMENT assignments)
```

Una Assignment cuenta cuando:

- refiere exactamente esa Requirement;
- pertenece al mismo Case/Company;
- el EquipmentAsset corresponde al mismo Product;
- lifecycle es `RESERVED`;
- el activo conserva elegibilidad;
- no tiene un conflicto actual sin revisar/confirmar para las ventanas vigentes.

`RELEASED`, `REPLACED` y `DIRECT` no cuentan para esa Requirement.

La respuesta puede derivar, sin persistir un único status:

```text
assigned >= required and no unresolved conflict → COVERED
0 < assigned < required                        → PARTIAL
assigned = 0 and no unavailable declaration    → PENDING
assigned = 0 and open unavailable note         → UNAVAILABLE
any current unresolved overlap                 → CONFLICT alert
```

`CONFLICT` puede coexistir con el conteo base; no se fuerza un enum agregado y
mutuamente excluyente.

Si el Case no permite derivar una ventana completa, la fila `RESERVED` puede
existir y contar como relación nominal, pero Availability permanece pendiente /
no completamente verificable. El sistema no puede reportar la cobertura como
conflict-free solamente por alcanzar `requestedQty`; debe acompañarla con un
warning/review-needed derivado hasta completar y reevaluar el schedule.

## 9.2 HealthcareEquipmentRequirementCoverageNote

Las declaraciones humanas no se confunden con el cálculo. Se propone un registro
especializado e histórico:

| Campo | Tipo conceptual | Regla |
| --- | --- | --- |
| `id` | UUID | Identidad de la nota. |
| `companyId` | UUID | Tenant owner. |
| `requirementId` | UUID | Requirement de equipo. |
| `kind` | enum | `UNAVAILABLE` o `PARTIAL_CONTEXT`. |
| `comment` | string | Siempre obligatorio y no blank. |
| `recordedById` | UUID | Actor ADMIN/MANAGER/WAREHOUSE autorizado dentro del workflow Warehouse. |
| `createdAt` | timestamp | Momento de registro. |
| `resolvedAt` | timestamp nullable | Cierre de la nota vigente. |
| `resolvedById` | UUID nullable | Actor que la cerró. |

La nota no persiste `COVERED/PARTIAL` como verdad. `UNAVAILABLE` registra la
declaración requerida por negocio; `PARTIAL_CONTEXT` explica una cobertura
parcial derivada. Una nueva situación cierra la nota vigente y conserva la
historia, en vez de sobrescribirla.

Se permite como máximo una nota abierta por Company + Requirement + kind mediante
un partial unique index `WHERE resolvedAt IS NULL`.

---

# 10. Configuración Company-scoped

## 10.1 Alternativas

### A. Campos directos en Company

```text
Company.preCaseBufferMinutes
Company.postCaseBufferMinutes
```

Es simple inicialmente, pero convierte gradualmente Company en un settings dump
y acopla un dominio Healthcare al núcleo compartido. No se recomienda.

### B. JSON o key/value genérico

Es extensible, pero debilita tipos, constraints, discoverability y migrations.
No se recomienda para dos settings críticos.

### C. Entidad 1:1 especializada — recomendada

`HealthcareEquipmentAssignmentSettings`:

| Campo | Tipo conceptual | Regla |
| --- | --- | --- |
| `companyId` | UUID PK/FK | Una configuración opcional por Company. |
| `preCaseBufferMinutes` | integer | Requerido, `>= 0`, cuando existe la fila. |
| `postCaseBufferMinutes` | integer | Requerido, `>= 0`, cuando existe la fila. |
| `createdAt` | timestamp | Auditoría básica. |
| `updatedAt` | timestamp | Última actualización. |

Esta opción mantiene el scope Healthcare, es type-safe y permite incorporar
posteriormente settings propios del mismo bounded context sin contaminar
Company.

Si no existe la fila, el evaluator usa los defaults de sistema aprobados:
`preCaseBufferMinutes = 120` y `postCaseBufferMinutes = 180`. Estos valores son
fallbacks de aplicación: no crean automáticamente una fila de settings ni se
persisten como defaults PostgreSQL. Si existe una fila Company-scoped, ambos
valores deben estar definidos y sustituyen el fallback completo; no se mezclan
defaults parciales con overrides parciales. El valor cero es un override válido.

---

# 11. Ventana operacional

Para un Case con `scheduledStart` y `scheduledEnd` completos:

```text
windowStart = scheduledStart - preCaseBufferMinutes
windowEnd   = scheduledEnd   + postCaseBufferMinutes
```

Se modela como intervalo half-open:

```text
[windowStart, windowEnd)
```

Dos ventanas que sólo se tocan en el límite no se superponen. Los buffers pueden
hacer que Cases sin overlap clínico sí tengan conflicto operacional.

No se persisten `windowStart`/`windowEnd` en Assignment como fuente de verdad.
Se derivan del schedule actual del Case y la configuración Company actual. Los
snapshots sólo viven en el hecho histórico de override.

`scheduledStart`/`scheduledEnd` son instantes absolutos; sumar/restar minutos no
requiere conversiones de timezone.

V1 no introduce settings separados para preparación, transporte, limpieza,
esterilización o inspección. Los dos buffers agregados representan ese margen.

Cuando el Case no tiene `scheduledStart` o tiene `scheduledEnd = null`, no puede
probarse una ventana completa. La Assignment está permitida, pero Availability
queda pendiente / no completamente verificable y nunca se reporta como
conflict-free. API/UI deberán presentar posteriormente un warning y estado de
review-needed derivados; B.1 no introduce un enum persistido para ello.

Cada alta o cambio de schedule dispara la reevaluación automática de todas las
Assignments `RESERVED` del Case. Si el schedule sigue incompleto, Availability
permanece pendiente; cuando permite derivar la nueva ventana completa, la
reevaluación puede producir `CONFLICT` y exigir atención u override. No elimina
ni reemplaza silenciosamente la Assignment.

Si el Case candidato tiene ventana completa, pero otra Assignment `RESERVED` del
mismo EquipmentAsset pertenece a un Case con schedule incompleto, esa reserva no
se ignora ni se clasifica como overlap confirmado. Create continúa permitido y
Availability devuelve:

```json
{
  "fullyVerifiable": false,
  "conflictFree": null,
  "warnings": [
    {
      "code": "RELATED_RESERVATION_SCHEDULE_INCOMPLETE",
      "message": "Existe una reserva activa del mismo equipo con horario incompleto; la disponibilidad no puede verificarse completamente."
    }
  ]
}
```

Si además existen reservas evaluables con overlap confirmado, el resultado es
`CONFLICT_REVIEW_REQUIRED` para esos overlaps, conserva el warning anterior y
reporta `fullyVerifiable=false` y `conflictFree=false`: existe al menos un
conflicto real, pero el conjunto completo todavía no es verificable.

Cuando el Case relacionado incompleto recibe o cambia su schedule, Availability
se deriva nuevamente con el estado vigente. C3 no requiere notificación
automática ni background job para ejecutar esa reevaluación.

---

# 12. Elegibilidad del EquipmentAsset

Una nueva reserva requiere como mínimo:

```text
lifecycle != RETIRED
condition not in {
  INSPECTION_PENDING,
  DAMAGED,
  OUT_OF_SERVICE
}
```

En el contrato vigente, `lifecycle = ACTIVE` y una condición aceptable como
`GOOD` continúan a la evaluación temporal.

Un activo retornado con `INSPECTION_PENDING` no puede reservarse hasta que una
Inspection lo devuelva a una condición aceptable.

La elegibilidad se reevalúa al confirmar, reemplazar y recalcular coverage. No se
copia lifecycle/condition como fuente de verdad dentro de Assignment.

---

# 13. Detección y confirmación de conflictos

Existe overlap cuando, para el mismo EquipmentAsset y otra Assignment
`RESERVED`:

```text
other.windowStart < requested.windowEnd
AND
other.windowEnd > requested.windowStart
```

La consulta excluye la Assignment que se está mutando y no considera filas
`RELEASED` o `REPLACED`.

Las reservas same-asset `RESERVED` se separan en dos conjuntos deterministas:

- evaluables, con ventana completa, que participan en la fórmula de overlap;
- no evaluables, con schedule incompleto, que no se ignoran ni se presentan como
  conflicto confirmado y producen
  `RELATED_RESERVATION_SCHEDULE_INCOMPLETE`.

Sólo el primer conjunto genera `conflicts` y filas de override. La presencia del
segundo conjunto fuerza `fullyVerifiable=false`; si no hay overlaps confirmados,
`conflictFree=null`, y si también hay overlaps confirmados,
`conflictFree=false` y el outcome continúa siendo
`CONFLICT_REVIEW_REQUIRED`.

## 13.1 Primera solicitud

```text
evaluate asset + window
→ conflict found
→ NO WRITE
→ review-required result with current conflicts
```

No se crea Assignment ni override parcial.

## 13.2 Confirmación explícita

```text
explicit confirmation + mandatory reason
→ re-read Case/settings/asset/current RESERVED assignments
→ recompute window and conflict set
→ if review is stale: NO WRITE + new review-required result
→ if review still matches: create Assignment + override rows atomically
```

HC-NEXT-03B.2 define en la sección 25 cómo el cliente devuelve la confirmación y
cómo se representa el fingerprint del conjunto revisado. Una confirmación vieja
no autoriza conflictos nuevos ni ventanas distintas.

No existe exclusion constraint ni unique temporal que impida overlaps entre
Cases; el override aprobado debe poder persistirse.

---

# 14. Release, Case cancellation y Requirement withdrawal

Manual Release implementa el protocolo Company-first y la idempotencia de
HC-LOCK-03B. La primera transición aplica únicamente a una fila `RESERVED` y la
lleva a `RELEASED` con `releaseCause = MANUAL`; no debe confundirse con el replay
válido de una fila ya liberada manualmente, que sólo admite la misma razón
normalizada y no realiza writes. El incremento fue validado y quedó merged en
`main@8a3b189`.

La Parent Integration C4-C2 de Case Cancel lleva sus filas `RESERVED` aplicables
a `RELEASED` con `releaseCause = CASE_CANCELLED` y conserva los datos de
auditoría del actor que ejecutó la cancelación. Está integrada en
`main@f429e9f`.

La Parent Integration de Requirement Retire C4-C1 lleva sus filas `RESERVED` de
origen `REQUIREMENT` a `RELEASED` con
`releaseCause = REQUIREMENT_WITHDRAWN`. Conserva filas históricas y no libera
Assignments `DIRECT`. Está integrada en `main@3e1810f`.

El release:

- termina la reserva lógica;
- excluye la fila de conflictos y coverage futuros;
- no elimina historia;
- no fabrica Return;
- no cambia Custody;
- no cambia EquipmentAsset lifecycle/condition.

Requirement Retire comparte el `Prisma.TransactionClient` del padre y conserva
`Company → Case → Requirement → Assignments por ID ASC`. Case Cancel comparte el
cliente del padre y conserva `Company → Case → Assignments por ID ASC`. Un futuro
productor Dispatch/Custody debe
impedir que cualquier release automático se interprete como disponibilidad
física cuando el activo ya salió de Warehouse o está gobernado por Custody.

---

# 15. Tenant-safe relational integrity

Cada entidad expone `@@unique([id, companyId])` cuando tiene `id`, siguiendo el
patrón tenant-safe existente.

Relaciones propuestas:

```text
Assignment [caseId, companyId]
→ HealthcareCase [id, companyId]

Assignment [equipmentAssetId, companyId]
→ EquipmentAsset [id, companyId]

Assignment [requirementId, companyId, caseId]
→ HealthcareCaseRequirement [id, companyId, caseId]

Assignment [replacesAssignmentId, companyId]
→ Assignment [id, companyId]

ConflictOverride [assignmentId, companyId]
→ Assignment [id, companyId]

ConflictOverride [conflictingAssignmentId, companyId]
→ Assignment [id, companyId]

CoverageNote [requirementId, companyId]
→ HealthcareCaseRequirement [id, companyId]

Settings.companyId
→ Company.id
```

La FK triple de Requirement requiere un candidate key adicional
`@@unique([id, companyId, caseId])` en HealthcareCaseRequirement. Así la base
garantiza que la Requirement relacionada pertenece al mismo Case y Company sin
duplicar `caseId` bajo otro nombre.

Las referencias de actor deben usar relaciones tenant-safe a User cuando el
modelo User disponga del candidate key correspondiente.

Todas las relaciones usan `RESTRICT` o la política explícita equivalente que
preserve historia; no se diseña cascade delete de Assignments, overrides o notas.

---

# 16. Invariantes de base de datos

La base debe proteger:

- enums válidos para origin, lifecycle, release cause y note kind;
- FKs tenant-safe;
- consistencia `REQUIREMENT`/`DIRECT`:
  - REQUIREMENT exige `requirementId` y prohíbe `directAssignmentReason`;
  - DIRECT exige `requirementId = null` y razón no blank;
- consistencia de metadata lifecycle:
  - RESERVED no tiene metadata de release/replacement;
  - RELEASED exige `releasedAt`, `releasedById` y `releaseCause`;
  - REPLACED exige `replacedAt`, `replacedById` y `replacementReason` no blank;
- `replacesAssignmentId != id`;
- `assignmentId != conflictingAssignmentId` en cada override;
- cada snapshot de override cumple `windowStart < windowEnd`;
- máximo una sucesora directa mediante unique Company + replacesAssignmentId;
- buffers enteros `>= 0`;
- reasons/comments requeridos no blank;
- `resolvedAt` y `resolvedById` ambos null o ambos presentes en CoverageNote;
- una sola CoverageNote abierta por Company + Requirement + kind;
- como máximo una fila `RESERVED` para el mismo Company + Case +
  EquipmentAsset mediante partial unique index.

El último índice impide duplicar el mismo activo dentro del mismo Case, pero no
impide reservar el activo en Cases distintos con overlap y override.

No se implementa una constraint SQL para:

- overlap temporal;
- elegibilidad dinámica por lifecycle/condition;
- coverage;
- Case schedule;
- conflicto o override vigente;
- Product match entre Requirement y EquipmentAsset;
- límite dinámico `RESERVED REQUIREMENT assignments <= requestedQty`;
- guard físico futuro de Dispatch/Custody.

Esas reglas cruzan filas/entidades mutables y pertenecen al service.

---

# 17. Reglas de service

El service debe controlar:

- Case existente, tenant-scoped y en estado que permita la operación;
- EquipmentAsset tenant-scoped y elegible;
- Requirement tenant-scoped, del mismo Case y con Product compatible;
- Requirement activa/no retirada para una nueva relación;
- prevención de over-coverage antes de crear una Assignment `REQUIREMENT`;
- origin consistency antes de escribir;
- cálculo de ventana con settings/defaults vigentes;
- búsqueda de todas las reservas del mismo activo;
- verificación de que cada override relaciona Assignments del mismo activo con
  overlap real para los snapshots confirmados;
- review-required sin write;
- confirmación explícita y no stale;
- transiciones lifecycle válidas;
- replacement atómico;
- release manual;
- release masivo por cancelación;
- release de reservas `REQUIREMENT` por retiro/cancelación de la Requirement;
- reevaluación automática al completar o modificar el schedule del Case;
- derivación de coverage y resolución de notas vigentes;
- futura evidencia operacional que impida falsear Custody/Return.

No debe aceptar `companyId`, lifecycle, lineage, audit actor/timestamps ni
override metadata como campos libremente asignables por cliente.

---

# 18. Concurrencia

## 18.1 Principio

El flujo usa review optimista y revalidación inmediatamente antes del write. Los
comandos participantes usan además el advisory lock transaccional exclusivo por
Company aprobado en
[ADR-HC-LOCK-001](../../architecture/adr/ADR-HC-LOCK-001-healthcare-company-scoped-transaction-coordination.md)
como primera adquisición relevante dentro de la transacción.

La coordinación Company-scoped no equivale a `Serializable` global ni implica
que toda mutación de Healthcare participe. Tampoco introduce retries amplios.
RBAC, filtros tenant-scoped, constraints, idempotencia, validaciones de negocio y
los locks de fila estrechos continúan siendo obligatorios.

Pure optimistic read no cierra por sí solo la carrera donde dos transacciones
ven el mismo activo sin reservas y ambas escriben. Por ello, la confirmación final
usa un lock estrecho por EquipmentAsset dentro de la transacción.

## 18.2 Assign concurrente

```text
lock Company advisory identity
→ lock candidate EquipmentAsset row
→ for REQUIREMENT origin, lock Requirement row
→ acquire settings coordination and relevant Case locks
→ re-read Case/settings/current RESERVED assignments
→ recompute conflicts
→ re-count Requirement coverage
→ review or write
```

La segunda transacción observa la primera Assignment y debe iniciar review antes
de persistir un overlap.

El lock de Requirement es necesario aunque dos usuarios seleccionen activos
distintos: serializa el conteo final y evita superar `requestedQty`. Las
Assignments `DIRECT` no usan ese lock para coverage porque no cuentan hacia la
Requirement.

## 18.3 Stale review

La confirmación vuelve a calcular ventanas y conjunto de conflictos dentro del
lock. Si difieren del review del cliente, no escribe y devuelve el outcome
estable `CONFLICT_REVIEW_REQUIRED` con un review renovado.

## 18.4 Replace y release

Replace sigue el orden principal aprobado:

```text
Company
→ EquipmentAsset destino
→ Requirement
→ Assignment fuente
→ coordinación de settings
→ Cases relevantes en orden determinista
```

No se agrega un lock del EquipmentAsset de origen. Los rereads autoritativos y
la decisión de review o write ocurren después de establecer esta frontera.

Release implementa el orden `Company → EquipmentAsset → Assignment`, junto con
el conditional write, la semántica idempotente y el error público de lifecycle.
HC-LOCK-04 acreditó esta secuencia y el checkpoint integrado final. Manual
Release B4-B1 ejecutó 14/14 E2E PostgreSQL/HTTP PASS, exit 0, en
`fix/hc-lock-04-jwt-isolation@9cc76ce`; Parent Integrations 2H ejecutó 28/28
PASS, exit 0, sobre `main@f429e9f`. PR #34 llevó únicamente el ajuste de
aislamiento JWT del harness a `main@be73bc4`, sin cambios productivos entre ambas
baselines. Ambos harnesses acreditaron cleanup de sus fixtures propios; no una
base globalmente vacía.

Requirement withdrawal implementa y valida el orden
`Company → Case → Requirement → Assignments por ID ASC` dentro de una sola
transacción. Case cancellation implementa y valida
`Company → Case → Assignments RESERVED por ID ASC` dentro de una sola
transacción.

---

# 19. Índices propuestos

## Assignment

```text
@@unique([id, companyId])
@@unique([companyId, replacesAssignmentId])
@@index([companyId, caseId, lifecycle])
@@index([companyId, equipmentAssetId, lifecycle])
@@index([companyId, requirementId, lifecycle])
partial unique [companyId, caseId, equipmentAssetId]
  WHERE lifecycle = RESERVED
```

## ConflictOverride

```text
@@unique([id, companyId])
@@index([companyId, assignmentId, createdAt])
@@index([companyId, conflictingAssignmentId, createdAt])
```

## CoverageNote

```text
@@unique([id, companyId])
@@index([companyId, requirementId, createdAt])
partial unique [companyId, requirementId, kind]
  WHERE resolvedAt IS NULL
```

## Settings

```text
companyId PRIMARY KEY
```

No se agrega un índice temporal global ni una exclusion constraint que bloquee
overlaps.

---

# 20. Alternativas rechazadas

## Una fila agregada por Requirement

No identifica cada EquipmentAsset ni preserva reemplazos por unidad.

## Sobrescribir equipmentAssetId al reemplazar

Destruye historia y hace imposible reconstruir A → B.

## Persistir coverage como status automático

Duplica datos derivados y puede quedar stale ante condition, reschedule, release
o nuevos conflictos.

## Lifecycle con DISPATCHED/RETURNED/IN_CUSTODY

Fusiona reserva lógica con realidad física y contamina límites posteriores.

## Unique/exclusion constraint para overlaps

Contradice el override autorizado.

## Campos de buffers directamente en Company

Acopla Healthcare al modelo Core y favorece un settings dump.

## JSON/key-value de settings

Pierde typing y constraints sin aportar valor para dos campos V1.

## Audit framework genérico

Amplía el alcance. Lineage, lifecycle metadata, override y CoverageNote conservan
la historia específica necesaria.

---

# 21. HC-NEXT-03B.2 — autoridad y convenciones

HC-NEXT-03B.2 aprueba el contrato público de API, DTO, response shaping,
fixed-role RBAC, errores, idempotencia y atomicidad de Equipment Assignment.
No implementa esas decisiones.

Se reutilizan las convenciones vigentes:

- `JwtAuthGuard`, `RolesGuard` y `@Roles(...)` por handler;
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y
  `transform`;
- UUIDs de path mediante `ParseUUIDPipe`;
- errores Healthcare con forma Nest y `code` estable cuando el cliente debe
  decidir;
- listas con `page`, `pageSize`, `items` y `pagination`;
- comandos lifecycle como `POST`;
- review advisory con HTTP 200 y cero writes;
- `Idempotency-Key` tenant-scoped, request hash y replay para comandos
  mutables.

La matriz específica de este documento prevalece sobre referencias preliminares
anteriores que intentaban heredar los writes de Assignment desde Case update.
Equipment Assignment es un dominio independiente: WAREHOUSE muta Assignments y
SALES sólo las lee.

---

# 22. Recurso, rutas y lista

El recurso primario es:

```text
/healthcare/equipment-assignments
```

No se crean nested mutation routes ni un endpoint general de Case Availability.

| Método | Path | Propósito | Resultado normal | Roles |
| --- | --- | --- | --- | --- |
| GET | `/healthcare/equipment-assignments` | Lista tenant-scoped con filtros. | 200 paginado | ADMIN, MANAGER, SALES, WAREHOUSE |
| GET | `/healthcare/equipment-assignments/:assignmentId` | Detail actual o histórico. | 200 | ADMIN, MANAGER, SALES, WAREHOUSE |
| POST | `/healthcare/equipment-assignments` | Crear una reserva lógica. | 201 o review 200 | ADMIN, MANAGER, WAREHOUSE |
| POST | `/healthcare/equipment-assignments/:assignmentId/replace` | Reemplazar una reserva preservando lineage. | 200 para `REPLACED` o review | ADMIN, MANAGER, WAREHOUSE |
| POST | `/healthcare/equipment-assignments/:assignmentId/release` | Liberación manual lógica. | 200 | ADMIN, MANAGER, WAREHOUSE |

## 22.1 Query DTO

```text
caseId?          UUID
requirementId?   UUID
equipmentAssetId? UUID
status?          RESERVED | RELEASED | REPLACED | ALL   default RESERVED
origin?          REQUIREMENT | DIRECT
page             integer >= 1                          default 1
pageSize         integer 1..100                        default 25
```

Todos los filtros presentes se combinan con AND. Omitir `origin` incluye ambos
orígenes. `status` es el nombre público del lifecycle persistente; no crea otro
estado.

Los filtros de relación se validan tenant-scoped. Un `caseId`,
`requirementId` o `equipmentAssetId` inexistente o foreign produce el mismo 404
que el recurso ausente correspondiente. Cuando se combinan IDs válidos pero
incompatibles, se usa el error de mismatch aplicable.

No existe sort arbitrario en V1. El orden es:

```text
createdAt DESC, id ASC
```

`createdAt` es también la fuente del alias semántico `assignedAt`. El ID final
evita inestabilidad entre páginas. Una página posterior al total devuelve 200
con `items: []`.

Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

---

# 23. DTOs y campos protegidos

## 23.1 CreateEquipmentAssignmentDto

| Campo | Tipo | Requerido | Validación |
| --- | --- | --- | --- |
| `caseId` | UUID | sí | UUID válido. |
| `equipmentAssetId` | UUID | sí | UUID válido. |
| `requirementId` | UUID/null | no | UUID no-null implica origin `REQUIREMENT`; omitted/null implica `DIRECT`. |
| `directAssignmentReason` | string/null | condicional | Obligatoria, normalizada, no blank y máximo 1000 para `DIRECT`; omitted/null para `REQUIREMENT`. |
| `conflictReviewFingerprint` | string | condicional | Fingerprint SHA-256 lowercase de 64 caracteres, sólo en confirmación. |
| `confirmConflictOverride` | boolean | no | Default false; workflow-only. |
| `conflictOverrideReason` | string | condicional | Obligatoria, normalizada, no blank y máximo 1000 cuando se confirma override. |

Derivación server-side:

```text
requirementId is a non-null UUID → origin = REQUIREMENT
requirementId omitted or null    → origin = DIRECT
```

Para `REQUIREMENT` el service valida, dentro de Company:

- Requirement existente y `ACTIVE`;
- mismo Case;
- Product de la Requirement compatible con el Product del EquipmentAsset;
- EquipmentAsset elegible;
- capacity actual menor que `requestedQty`;
- locks y revalidación definidos en B.1.

Create y Replace se permiten sólo mientras el Case está `DRAFT` o `SCHEDULED`.
Un Case `CANCELLED` conserva reads/history pero rechaza nuevas mutaciones con el
error estable de read-only. Requirement debe estar `ACTIVE` para Create; Replace
preserva la relación y revalida que continúe activa.

Para `DIRECT` exige `directAssignmentReason` y no acepta
`requirementId` no-null.

`confirmConflictOverride = true` exige simultáneamente fingerprint y razón.
Fingerprint/razón enviados sin confirmación, confirmación incompleta o campos de
review con formato inválido producen 400. Ningún campo workflow-only se
persiste dentro de Assignment.

## 23.2 ReplaceEquipmentAssignmentDto

| Campo | Tipo | Requerido | Validación |
| --- | --- | --- | --- |
| `equipmentAssetId` | UUID | sí | UUID válido y distinto del activo original. |
| `replacementReason` | string | sí | Normalizada, no blank, máximo 1000. |
| `conflictReviewFingerprint` | string | condicional | Mismo contrato de Create. |
| `confirmConflictOverride` | boolean | no | Default false. |
| `conflictOverrideReason` | string | condicional | Mismo contrato de Create. |

No acepta cambios a Case, Requirement, origin ni contexto DIRECT.

## 23.3 ReleaseEquipmentAssignmentDto

```text
reason string required, normalized, non-blank, max 1000
```

## 23.4 Server-protected fields

Los mutation bodies nunca aceptan:

- `companyId`;
- `origin`;
- `status`/`lifecycle`;
- `assignedById`/`createdById`;
- `assignedAt`/`createdAt`;
- `releasedById`, `releasedAt`, `releaseCause`;
- `replacedById`, `replacedAt`, `replacesAssignmentId` o metadata de lineage;
- metadata o snapshots de override;
- `updatedAt`;
- cualquier actor, timestamp o field de sistema.

Actor y Company derivan exclusivamente del principal autenticado. Los DTOs
declaran allowlists explícitas; las propiedades inesperadas se rechazan, no se
ignoran silenciosamente. El list query acepta `status` y `origin` únicamente
como filtros según la sección 22.1; nunca acepta `companyId`, actor IDs ni
metadata de sistema.

---

# 24. Create y outcomes

## 24.1 Sin conflicto

```text
POST /healthcare/equipment-assignments
→ 201 Created
→ Assignment RESERVED persistida
```

Response:

```json
{
  "outcome": "CREATED",
  "data": {}
}
```

`data` usa `EquipmentAssignmentResponse` de la sección 28.

## 24.2 Schedule incompleto

La creación continúa permitida y devuelve 201 `CREATED`. La respuesta debe
indicar:

```json
{
  "availability": {
    "fullyVerifiable": false,
    "conflictFree": null,
    "warnings": [
      {
        "code": "INCOMPLETE_CASE_SCHEDULE",
        "message": "La disponibilidad requiere revisar el horario del caso"
      }
    ]
  }
}
```

No se afirma disponibilidad conflict-free. El warning es derivado y no agrega
un enum persistente. Una alta o cambio posterior del schedule dispara la
reevaluación definida en B.1.

## 24.3 Primer conflicto

La primera solicitud sin confirmación:

```text
conflict found
→ NO WRITE
→ 200 OK
→ outcome = CONFLICT_REVIEW_REQUIRED
```

```json
{
  "outcome": "CONFLICT_REVIEW_REQUIRED",
  "conflictReviewFingerprint": "64-char-lowercase-sha256",
  "overrideRequired": true,
  "conflicts": [
    {
      "assignmentId": "uuid",
      "caseId": "uuid",
      "caseFolio": "HC-000001",
      "windowStart": "2026-09-15T15:00:00.000Z",
      "windowEnd": "2026-09-15T18:00:00.000Z"
    }
  ],
  "candidate": {
    "caseId": "uuid",
    "requirementId": null,
    "origin": "DIRECT",
    "equipmentAsset": {},
    "operationalWindow": {
      "start": "2026-09-15T16:00:00.000Z",
      "end": "2026-09-15T19:00:00.000Z"
    }
  }
}
```

Candidate y conflicts usan selects compactos y sólo contienen datos same-tenant
necesarios para decidir. No incluyen Company, notas clínicas ni detalles
internos.

## 24.4 Confirmación

El segundo request reenvía el comando completo con:

```text
confirmConflictOverride = true
conflictReviewFingerprint = required
conflictOverrideReason = required
```

Antes del write, dentro de los locks de B.1, el service revalida:

- tenant relations;
- Case y schedule;
- settings Company-scoped;
- lifecycle/condition y elegibilidad del EquipmentAsset;
- Requirement activa, misma Case/Product y capacity;
- ventana candidata;
- conjunto completo de conflictos.

Si el fingerprint coincide, Assignment y auditoría de override se persisten
atómicamente y Create devuelve 201 `CREATED`.

Si no coincide, no escribe y devuelve 200 `CONFLICT_REVIEW_REQUIRED` con la
representación y fingerprint recién calculados. Si el conflicto desapareció,
`conflicts` queda vacío y `overrideRequired = false`; el cliente descarta la
confirmación anterior y reenvía el comando base sin campos de override. No se
autoriza un write con una revisión stale.

El review normal y el review renovado no son errores 409.

---

# 25. Conflict review fingerprint

El fingerprint es un detector determinista de staleness, no autenticación, un
capability token ni un sustituto de RBAC.

El server construye una representación canónica versionada:

```text
contractVersion = equipment-assignment-conflict-review:v1
companyId
command = CREATE | REPLACE
candidate caseId/equipmentAssetId/requirementId/origin
candidate operational window in UTC ISO-8601
candidate Case/EquipmentAsset/Requirement relevant updatedAt or version inputs
Requirement lifecycle/requestedQty when applicable
preCaseBufferMinutes/postCaseBufferMinutes
conflicts sorted by assignmentId
  assignmentId
  caseId
  operational window in UTC ISO-8601
  relevant updatedAt/version inputs
unresolvedReservations sorted by assignmentId
  assignmentId
  caseId
  Assignment relevant updatedAt/version inputs
  Case scheduledStart/scheduledEnd and relevant updatedAt/version inputs
```

Reglas:

1. keys y arrays tienen orden canónico;
2. null y ausencia no se intercambian fuera de la normalización DTO aprobada;
3. timestamps usan UTC con precisión estable;
4. el server serializa la forma canónica y calcula SHA-256;
5. la API expone 64 caracteres hex lowercase;
6. el server siempre recomputa inmediatamente antes del write.

`unresolvedReservations` representa Assignments same-asset `RESERVED` sin
ventana derivable. Su firma no contiene snapshots de ventana inexistentes, pero
incluye suficiente estado del Case y Assignment para que completar o cambiar el
schedule vuelva stale cualquier review anterior.

`companyId` participa en el hash para separar tenants, aunque no se expone en
la respuesta. El fingerprint no contiene secretos; su posesión nunca concede
permiso ni evita revalidaciones.

---

# 26. Replace command

`POST /healthcare/equipment-assignments/:assignmentId/replace`:

- carga la original por `assignmentId + companyId`;
- exige lifecycle `RESERVED`;
- exige un EquipmentAsset distinto, same-tenant y elegible;
- preserva Case, Requirement, origin y `directAssignmentReason`;
- aplica el mismo flujo de Availability, review, fingerprint y override al
  nuevo activo;
- para origin `REQUIREMENT`, calcula capacity sustituyendo a la predecesora, no
  sumándola como una unidad adicional;
- crea la sucesora `RESERVED` con `replacesAssignmentId`;
- transiciona la original a `REPLACED`;
- conserva actor, tiempo y `reason`.

Sin conflicto:

```text
→ 200 OK
→ outcome = REPLACED
```

```json
{
  "outcome": "REPLACED",
  "data": {
    "replacedAssignment": {
      "id": "source-assignment-uuid",
      "status": "REPLACED"
    },
    "replacementAssignment": {
      "id": "successor-assignment-uuid",
      "status": "RESERVED",
      "replacesAssignmentId": "source-assignment-uuid"
    }
  }
}
```

Con conflicto devuelve el mismo 200 `CONFLICT_REVIEW_REQUIRED` antes de
cualquier write. La respuesta incluye `sourceAssignmentId`, candidate,
fingerprint, conflictos, reservas no verificables y warnings vigentes.

Una original `RELEASED` o `REPLACED` no se vuelve a reemplazar con otra key:
devuelve 409 `EQUIPMENT_ASSIGNMENT_NOT_RESERVED`. Un replay con la misma
`Idempotency-Key` y payload del reemplazo exitoso devuelve el resultado
original. La unique de lineage y el lock de la original evitan múltiples
sucesoras activas.

Usar el mismo EquipmentAsset devuelve 400
`EQUIPMENT_ASSIGNMENT_REPLACEMENT_SAME_ASSET`. Una razón ausente o vacía se
rechaza por `ValidationPipe` en HTTP; el guard de dominio conserva 400
`EQUIPMENT_ASSIGNMENT_REPLACEMENT_REASON_REQUIRED` para invocaciones directas.
Estos códigos reflejan el contrato implementado y validado de HC-NEXT-03C4-B.

El reemplazo no fabrica Return ni disponibilidad física. El guard futuro de
Dispatch/Custody continúa diferido.

---

# 27. Release e integraciones internas

## 27.1 Release manual

`POST /healthcare/equipment-assignments/:assignmentId/release`:

- carga por `assignmentId + companyId`;
- exige y normaliza `reason`;
- `RESERVED → RELEASED` con `releaseCause = MANUAL`;
- deriva actor y timestamp del principal/server y preserva esos valores junto
  con la razón y la historia;
- termina sólo la reserva lógica;
- no crea Inventory Movement, Return ni cambio de Custody.

HC-LOCK-03 no agrega una nueva restricción por status del Case. Un replay
completado válido conserva precedencia sobre cambios posteriores del Case.

El orden transaccional implementado es:

```text
Company → EquipmentAsset → Assignment
```

El Asset se descubre de forma ligera y tenant-scoped antes de la transacción. La
lectura no bloquea ni escribe. Dentro de la transacción se adquieren Company,
timeouts posteriores, Asset `FOR UPDATE` y Assignment `FOR UPDATE`, en ese orden,
y se revalida la relación Assignment-to-Asset. Un cambio de relación devuelve
409 `RESOURCE_STATE_CHANGED` sin writes.

Resultado:

```text
→ 200 OK
→ `HealthcareEquipmentAssignmentResponse` directo, sin wrapper `outcome/data`
```

Una repetición válida del release manual con la misma razón normalizada devuelve
200 sin nuevos writes, no cambia razón/actor/timestamp y no duplica historia.
Una razón diferente sobre un release manual ya completado devuelve 409 sin
alterar historia. Deben preservarse tanto la idempotencia por estado como
`Idempotency-Key + payload`. Una Assignment `REPLACED` no puede transicionar a
`RELEASED` mediante release manual.

Una Assignment liberada por `CASE_CANCELLED` o `REQUIREMENT_WITHDRAWN`, o una
Assignment `REPLACED`, devuelve 409 `EQUIPMENT_ASSIGNMENT_NOT_RESERVED`. Para un
release `MANUAL`, la misma razón normalizada es replay aunque cambie el actor que
solicita; una razón distinta devuelve el mismo 409 y nunca sobrescribe auditoría.

`Idempotency-Key` es opcional para compatibilidad. Cuando se envía, se trimmea,
debe ser non-empty y tener máximo 128 caracteres. El fingerprint SHA-256 incluye
`assignmentId` y la razón normalizada, bajo scope
`HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE`. Un claim completado se valida antes
del replay por estado: mismo key/payload relee la respuesta canónica y payload
distinto devuelve 409 `IDEMPOTENCY_KEY_REUSED`. Un replay por estado con key
nueva ejecuta cero writes y no consume esa key.

## 27.2 Case cancellation

El comando público existente
`POST /healthcare/cases/:caseId/cancel` mantiene su RBAC ADMIN/MANAGER. Dentro de
la integración padre C4-C2, Case Cancel adquiere primero Company, bloquea el Case
y después sus Assignments `RESERVED` por ID ascendente. Libera ambos origins con
`releaseCause = CASE_CANCELLED`, el actor y la razón persistida del comando, y un
timestamp compartido con `cancelledAt`. No se crea otro endpoint público de
cancelación o bulk release en Assignment. La implementación está validada en
PostgreSQL y está integrada en `main@f429e9f`.

La evidencia técnica de C4-C2 registra Jest focal 346/346 PASS; typecheck,
`lint:check`, Prettier focal, API build y `git diff --check` PASS; y
PostgreSQL/HTTP E2E focal
16/16 PASS, 26 skipped por filtro, exit 0, sobre `zaping_spike_test`. La selección
incluyó 15 escenarios C4-C2 y la regresión C4-C1 que preserva `DIRECT`. El
teardown limita cleanup a los Company IDs del run, verifica conteos cero y
propaga fallos. La aceptación no acredita frontend, logística física, una base
globalmente vacía ni readiness productiva.

## 27.3 Requirement withdrawal/cancellation

El comando existente
`POST /healthcare/requirements/:requirementId/retire` mantiene su RBAC
ADMIN/MANAGER/SALES/WAREHOUSE y sus errores. “Withdrawal/cancellation” en este
documento corresponde al retiro lógico vigente; no crea otro lifecycle ni otra
ruta. C4-C1 implementa la integración padre con el orden
`Company → Case → Requirement → Assignments por ID ASC` y el mismo
`Prisma.TransactionClient`:

- libera todas las Assignments `RESERVED` de origin `REQUIREMENT` para esa
  Requirement;
- usa `releaseCause = REQUIREMENT_WITHDRAWN` y el actor del comando;
- no modifica Assignments `DIRECT`;
- conserva todas las filas históricas.

Esta mutación derivada se autoriza por el comando padre de Requirement; no
concede a SALES acceso al endpoint manual de Assignment release.

Requirement Retire está integrado en `main@3e1810f` y Case Cancel C4-C2 en
`main@f429e9f`. Ambos releases son lógicos;
cuando Dispatch/Custody exista, su guard deberá impedir que se presenten como
disponibilidad física falsa.

---

# 28. Response shaping

`EquipmentAssignmentResponse`:

```json
{
  "id": "uuid",
  "caseId": "uuid",
  "requirementId": null,
  "origin": "DIRECT",
  "status": "RESERVED",
  "equipmentAsset": {
    "id": "uuid",
    "productId": "uuid",
    "assetCode": "EQ-000001",
    "serialNumber": null,
    "lifecycle": "ACTIVE",
    "condition": "GOOD",
    "product": {
      "id": "uuid",
      "sku": "EQ-PRODUCT-01",
      "name": "Equipo",
      "isActive": true
    }
  },
  "assignedAt": "2026-09-15T15:00:00.000Z",
  "assignedBy": {
    "id": "uuid",
    "firstName": "Ana",
    "lastName": "Pérez"
  },
  "directAssignmentReason": "Respaldo de último minuto",
  "replacesAssignmentId": null,
  "replacement": null,
  "release": null,
  "availability": {
    "fullyVerifiable": true,
    "conflictFree": true,
    "warnings": []
  },
  "conflictOverrides": [],
  "createdAt": "2026-09-15T15:00:00.000Z",
  "updatedAt": "2026-09-15T15:00:00.000Z"
}
```

Reglas:

- `status` refleja `RESERVED`, `RELEASED` o `REPLACED`; no expone el nombre
  interno `lifecycle` de Assignment;
- `assignedAt` es el alias semántico de `createdAt` y `assignedBy` se obtiene de
  `createdById`; no exige columnas duplicadas;
- `directAssignmentReason` sólo se muestra para `DIRECT`;
- `replacement` en la fila predecesora incluye `successorAssignmentId`,
  `reason`, `replacedAt` y actor compacto;
- `release` incluye `cause`, `reason`, `releasedAt` y actor compacto;
- `availability` es null para filas terminales; para `RESERVED` es derivada del
  contexto vigente;
- `fullyVerifiable` es false cuando falta la ventana candidata o existe al menos
  una reserva relacionada no evaluable por schedule incompleto;
- `conflictFree` es null cuando no puede concluirse si hay conflicto, true sólo
  si todo el conjunto relevante es verificable y no tiene overlap, y false si
  existe al menos un conflicto actual, incluso si fue overridden;
- `warnings` usa códigos de presentación estables como
  `INCOMPLETE_CASE_SCHEDULE`, `RELATED_RESERVATION_SCHEDULE_INCOMPLETE`,
  `CURRENT_ASSIGNMENT_CONFLICT` y `CONFLICT_OVERRIDE_CONFIRMED`, sin persistir
  un availability enum;
- `conflictOverrides` contiene summaries
  `{ conflictingAssignmentId, approvedAt, approvedBy, reason }`, sin snapshots
  internos de cálculo;
- reads preservan y devuelven filas históricas `RELEASED`/`REPLACED`.

No se exponen `companyId`, FK de actores, search keys, constraint names,
fingerprint inputs, snapshots internos completos ni detalles Prisma.

---

# 29. RBAC y tenant isolation

Todos los handlers usan `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles`
explícito:

| Capability | ADMIN | MANAGER | WAREHOUSE | SALES |
| --- | --- | --- | --- | --- |
| List/detail/history | allow | allow | allow | allow |
| Create | allow | allow | allow | deny |
| Replace | allow | allow | allow | deny |
| Manual release | allow | allow | allow | deny |
| Conflict override dentro de Create/Replace | allow | allow | allow | deny |

SALES recibe 403 antes de cualquier lookup al intentar mutaciones. El
fingerprint no modifica esta decisión. WAREHOUSE no obtiene por ello permisos
generales de Case update, Requirement management, Inventory Movement,
Dispatch/Custody ni otros módulos.

Reglas obligatorias:

- `companyId` proviene sólo de `request.user.companyId`;
- actor proviene sólo de `request.user.id`;
- lists/counts/conflicts/coverage/overrides se filtran por Company;
- detail y comandos buscan `id + companyId`;
- Case, Requirement y EquipmentAsset se validan con Company;
- compact relations usan selects explícitos y no cruzan tenant;
- foreign y missing producen el mismo 404;
- no se realiza lookup global para revelar existencia;
- composite FKs de B.1 son la defensa final.

Un same-tenant resource con estado inválido puede producir 409 específico porque
su existencia ya es visible al rol autorizado.

---

# 30. Validación, HTTP y errores estables

Los errores con branching conservan la forma:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "code": "EQUIPMENT_ASSET_NOT_ELIGIBLE",
  "message": "El equipo no está disponible para una nueva asignación"
}
```

| Escenario | HTTP | Stable code/behavior |
| --- | --- | --- |
| Malformed path UUID | 400 | `ParseUUIDPipe` |
| Tipo, enum, length o propiedad inesperada | 400 | `ValidationPipe` |
| Payload DIRECT/REQUIREMENT inconsistente | 400 | `INVALID_ASSIGNMENT_ORIGIN` |
| Confirmación/fingerprint incompleto o malformado | 400 | `INVALID_CONFLICT_REVIEW_CONFIRMATION` |
| Razón de conflict override ausente/blank | 400 | `CONFLICT_OVERRIDE_REASON_REQUIRED` |
| Assignment missing/foreign | 404 | `EQUIPMENT_ASSIGNMENT_NOT_FOUND` |
| Case missing/foreign | 404 | `CASE_NOT_FOUND` |
| Requirement missing/foreign | 404 | `REQUIREMENT_NOT_FOUND` |
| EquipmentAsset missing/foreign | 404 | `EQUIPMENT_ASSET_NOT_FOUND` |
| Case no permite Assignment mutation | 409 | `CASE_EQUIPMENT_ASSIGNMENTS_READ_ONLY` |
| Requirement retirada | 409 | Existing `REQUIREMENT_RETIRED` |
| Requirement pertenece a otro Case same-tenant | 409 | `ASSIGNMENT_REQUIREMENT_CASE_MISMATCH` |
| Requirement Product y EquipmentAsset Product difieren | 409 | `ASSIGNMENT_PRODUCT_MISMATCH` |
| EquipmentAsset lifecycle/condition no elegible | 409 | `EQUIPMENT_ASSET_NOT_ELIGIBLE` |
| Capacity `requestedQty` ya cubierta | 409 | `REQUIREMENT_OVER_COVERAGE` |
| Mismo activo ya `RESERVED` en el mismo Case | 409 | `ASSIGNMENT_ALREADY_RESERVED` |
| Replacement usa el mismo activo | 400 | `EQUIPMENT_ASSIGNMENT_REPLACEMENT_SAME_ASSET` |
| Razón de Replacement ausente/blank | 400 | `ValidationPipe`; guard de dominio `EQUIPMENT_ASSIGNMENT_REPLACEMENT_REASON_REQUIRED` |
| Lifecycle no permite Replace | 409 | `EQUIPMENT_ASSIGNMENT_NOT_RESERVED` |
| Lifecycle incompatible en Manual Release | 409 | `EQUIPMENT_ASSIGNMENT_NOT_RESERVED` |
| Estado cambió durante conditional write | 409 | Existing `RESOURCE_STATE_CHANGED` |
| FK/recurso relacionado cambió durante write | 409 | Existing `RELATED_RESOURCE_CHANGED` |
| Misma idempotency key con payload distinto | 409 | `IDEMPOTENCY_KEY_REUSED` |
| Persistence failure no clasificada | 500 | Existing `HEALTHCARE_PERSISTENCE_ERROR` |
| Rol no autorizado | 403 | `RolesGuard`; no lookup |
| Sesión ausente/inválida | 401 | `JwtAuthGuard` |

`CONFLICT_REVIEW_REQUIRED` es un outcome HTTP 200, no error. Un fingerprint
bien formado pero stale/mismatched produce un review renovado HTTP 200, no
`INVALID_CONFLICT_REVIEW_CONFIRMATION`.

Los mappers de persistencia capturan sólo constraints conocidas. P2002 de la
partial unique de reserva se relee tenant-scoped y se traduce a
`ASSIGNMENT_ALREADY_RESERVED`; P2003 se traduce a
`RELATED_RESOURCE_CHANGED`. Nunca se exponen códigos Prisma/PostgreSQL,
constraint names, SQL ni mensajes raw.

---

# 31. Idempotencia

Existe un mecanismo reusable en Purchase Receipts:

```text
Idempotency-Key
companyId + scope + key
normalized request hash
same payload replay
different payload conflict
transactional claim
```

Create y Replace adoptan el mecanismo reusable sin crear otro subsistema. Para
esos comandos, el header es requerido, se trimmea, debe ser non-empty y tener
máximo 128 caracteres.

Para Manual Release el header es opcional por compatibilidad. Si se proporciona,
usa la misma normalización y límite de 128 caracteres que Create/Replace.

Scopes separados establecidos para Create, Replace y Release:

```text
HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE
HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE
HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE
```

Los hashes incluyen path parameters y body normalizado. Para Release, la forma
canónica contiene `assignmentId` y `reason` normalizada. La identidad conceptual
común es:

```text
companyId + scope + Idempotency-Key
```

Comportamiento establecido para Create, Replace y Release:

- same key + same normalized request → replay de la misma identidad/outcome sin
  reejecutar la mutación; la representación se relee tenant-scoped en su estado
  canónico vigente;
- same key + different request → 409 `IDEMPOTENCY_KEY_REUSED`;
- same key en otra Company o scope → identidad independiente;
- claim, mutation y resource/result identity se confirman atómicamente;
- recuperación de una colisión de claim relee fuera de la transacción abortada.

Un resultado `CONFLICT_REVIEW_REQUIRED` no consume ni finaliza el claim porque
no hubo write y el siguiente body agrega confirmación/fingerprint. Lo mismo
aplica a un review stale. El claim sólo se persiste con una mutación exitosa.

Protecciones naturales adicionales:

- la partial unique impide dos `RESERVED` del mismo activo/Case;
- Requirement lock + recount impide over-coverage;
- unique lineage + lock de predecesora impide sucesores múltiples;
- repeated Manual Release con la misma razón normalizada es no-op y no
  sobrescribe auditoría; un key nuevo no se consume para este replay por estado;
- los futuros releases derivados de Case/Requirement deberán usar estado
  esperado y no duplicar historia.

---

# 32. Atomicidad y orden de locks

| Operación | Frontera atómica |
| --- | --- |
| Create sin conflicto | Idempotency claim + Assignment `RESERVED`. |
| Create con override | Claim + Assignment + todas las ConflictOverride rows. |
| Review inicial/stale | Cero writes; no claim persistido. |
| Replace | Claim + original `REPLACED` + sucesora `RESERVED` + lineage + override rows. |
| Release | Claim opcional, sólo con `Idempotency-Key` en la primera transición, + status `RELEASED` + actor/time/reason/cause. |
| Case cancellation | Cambio de Case + releases lógicos aplicables dentro de una sola transacción; C4-C2 integrado en `main@f429e9f`. |
| Requirement withdrawal | Cambio de Requirement + releases `REQUIREMENT` aplicables en la misma transacción; C4-C1 integrado en `main@3e1810f`. |

Los comandos participantes aplican el siguiente orden principal dentro de la
misma transacción:

| Comando | Orden principal |
| --- | --- |
| Assignment Create | Company → EquipmentAsset → Requirement opcional → coordinación de settings → Cases relevantes. |
| Assignment Replace | Company → EquipmentAsset destino → Requirement → Assignment fuente → coordinación de settings → Cases relevantes. |
| Requirement Update | Company → Case → Requirement. |
| Requirement Retire | Company → Case → Requirement → Assignments aplicables por ID ASC. |
| Requirement Reactivate | Company → Case → Product → Requirement. |
| Requirement Reorder | Company → Case → Requirements en orden determinista por ID. |
| Manual Release | Company → EquipmentAsset → Assignment. |
| Case Cancel | Company → Case → Assignments RESERVED por ID ASC. |

La tabla expresa el orden principal y no elimina los detalles del comando:
settings conserva su advisory lock separado; los Cases múltiples se deduplican y
adquieren en orden por ID; se mantienen los modos de row lock definidos; y los
rereads autoritativos de Case, Asset, Requirement/capacity, Assignment, settings,
reservas, conflictos y fingerprint ocurren después de establecer la frontera de
locks. Sólo entonces se decide review sin write o mutación atómica.

La implementación debe evitar estado parcialmente visible. C4-C1 incorpora una
coordinación interna transaction-bound que permite al servicio padre ejecutar
su cambio y los releases con el mismo Prisma transaction client. C4-C2 reutiliza
esa primitiva para Case Cancel. Ninguno usa llamadas HTTP internas ni degrada el
contrato a best-effort silencioso.

Case Cancel adquiere Company antes de sus releases. Requirement Retire conserva
el orden aprobado y ejecuta sus releases derivados en C4-C1. Ambas Parent
Integrations están integradas y conservan una única frontera transaccional.

---

# 33. Scope diferido y siguiente etapa

Permanecen diferidos sin reabrir B.1/B.2:

1. implementación concreta del guard cross-domain Dispatch/Custody;
2. Dispatch/Custody API y physical positioning;
3. Inventory Movement API;
4. endpoint general de Case Availability;
5. frontend components, notifications y mobile workflows;
6. permission-based RBAC;
7. Prisma, migrations, services, controllers, tests y ejecución de acceptance,
   que comienzan sólo en HC-NEXT-03C1 y slices posteriores.

B.2 no diseña fuzzy search, nested mutations, DELETE ni hard delete. La
integración real de `RequirementOperationalEvidencePolicy` con futuros
fulfillment producers continúa bajo el contrato de Requirements y no se declara
resuelta por este diseño.

B.3 convierte el diseño aprobado en slices de implementación y contrato de
acceptance en las secciones siguientes. No rediseña rutas, DTOs, fixed-role
RBAC, review, idempotencia ni errores.

---

# 34. HC-NEXT-03B.3 — slicing y reglas de entrega

HC-NEXT-03B.3 es diseño y planificación aprobados. No crea schema, migrations,
runtime, frontend ni tests. El documento de ejecución de acceptance se abrirá
en C7, cuando exista un build integrado verificable; crear uno ahora sugeriría
evidencia que todavía no existe.

La secuencia vigente es:

```text
HC-NEXT-03C1 Persistence / Migration
→ HC-NEXT-03C2 Assignment Backend Base
→ HC-NEXT-03C3 Availability / Conflict Review / Concurrency
→ HC-NEXT-03C4 Replace / Release / Parent Integrations
→ HC-NEXT-03C5-A Contract Alignment & Safe PostgreSQL Harness
→ HC-NEXT-03C6-A Case Equipment Assignments Read-only View

Track pendiente, no bloqueante para iniciar C6-A:
HC-NEXT-03C5-B Integrated Backend Validation (B0 → B1/B2 → B3)
→ HC-NEXT-03C5-COVERAGE backend independiente
→ slices posteriores de HC-NEXT-03C6
→ HC-NEXT-03C7 Integrated Acceptance
```

Cada slice parte de `main` después de que sus dependencias aplicables estén merged
y green. C6-A consume List/Detail existentes y puede comenzar sin B0; su
aceptación integrada espera los gates aplicables de autenticación, permisos y
List/Detail. Los slices posteriores no adelantan CoverageNote ni mutaciones. Un
PR no mezcla el scope de su sucesor para ahorrar una integración.

Reglas comunes de entrada y salida:

| Gate | Regla |
| --- | --- |
| Entry | Predecesor merged; branch limpia desde el `main` vigente; B.1/B.2/B.3 todavía consistentes con el código CURRENT. |
| Scope | Sólo el capability del slice; sin refactors o dominios futuros no requeridos. |
| Security | Tenant scoping y fixed-role RBAC se prueban en el punto donde aparecen y permanecen en regresión. |
| Quality | Focales, regresiones afectadas, lint, typecheck, build y `git diff --check` verdes. |
| Delivery | Un branch y PR enfocados; CI green; merge antes de iniciar la dependencia siguiente. |
| Status | Ningún slice intermedio marca Equipment Assignment como aceptado. |

## 34.1 HC-NEXT-03C1 — Persistence / Migration

**Scope:**

- `HealthcareEquipmentAssignment`, lifecycle `RESERVED` / `RELEASED` /
  `REPLACED`, origin `REQUIREMENT` / `DIRECT` y replacement lineage;
- metadata de actor, timestamp, reason y cause aprobada en B.1;
- persistencia de `HealthcareEquipmentAssignmentConflictOverride`;
- `HealthcareEquipmentRequirementCoverageNote`, mientras el review de
  implementación no descubra una contradicción con B.1;
- settings Company-scoped de Equipment Assignment;
- composite foreign keys tenant-safe, CHECK/unique constraints e índices de
  lookups/conflict evaluation aprobados;
- extensión estrecha de los scopes del mecanismo idempotente existente para
  Create/Replace/Release, sin crear un subsistema paralelo.

**Out of scope:** repositories, services, controllers, Availability de negocio,
conflict review runtime, commands, frontend y acceptance.

**Gates:**

- `prisma format`, `prisma validate` y `prisma generate`;
- revisión manual del SQL y de toda operación destructiva;
- deploy completo en PostgreSQL disposable desde cero y, si aplica, upgrade
  desde la migration baseline anterior;
- schema/migration diff sin drift;
- pruebas PostgreSQL de CHECK, unique, partial unique, lineage, composite FKs e
  índices críticos;
- pruebas negativas de caminos relacionales cross-tenant;
- harness de integridad con opt-in, acknowledgement y nombre de DB disposable;
- API lint/typecheck/build y `git diff --check`.

**STOP:** migration destructiva no aprobada, FK no tenant-safe, constraint que
impida historia válida, drift, o tests capaces de apuntar a una DB no
demostrablemente disposable.

## 34.2 HC-NEXT-03C2 — Assignment Backend Base

**Scope:** módulo/repository/service/controller; GET list/detail; POST Create sin
override de conflictos; derivación `REQUIREMENT` versus `DIRECT`; validación de
Requirement/Product/EquipmentAsset, elegibilidad y over-coverage; warning de
schedule incompleto; selects/response shaping, filtros/paginación, RBAC,
tenant isolation, stable errors e `Idempotency-Key` mediante el mecanismo
existente.

Create mantiene el orden conceptual: cargar recursos tenant-scoped, validar
eligibilidad/compatibilidad/capacity, detectar schedule incompleto y persistir
atómicamente. Un schedule incompleto permite crear y devuelve
`fullyVerifiable=false` y `conflictFree=null`; no declara disponibilidad.

**Out of scope:** conflict override/fingerprint completo, Replace, Release,
integraciones de cancelación/retiro, frontend y Case Availability general.

**Gates:** focales DTO/controller/service/repository; tests reales de
`JwtAuthGuard` + `RolesGuard` + `@Roles`; Company A/B; foreign igual a missing;
Create 201 y warning incompleto; Requirement/DIRECT, incompatibilidad,
elegibilidad, over-coverage, campos protegidos, error mapping e idempotency
base; regresión Healthcare/Requirements/Equipment afectada; API full suite,
lint, typecheck, build y `git diff --check`.

**STOP:** `companyId` controlable por cliente, lookup global, SALES con write,
WAREHOUSE sin write, raw Prisma errors, write ante validación fallida o claim
idempotente fuera de la misma frontera que la mutación.

## 34.3 HC-NEXT-03C3 — Availability / Conflict Review / Concurrency

**Entry resuelto:** `preCaseBufferMinutes = 120` y
`postCaseBufferMinutes = 180` son los fallbacks de sistema aprobados; settings
Company-scoped los sustituyen sin crear filas automáticamente ni usar defaults
PostgreSQL.

**Scope:** resolución de settings Company-scoped, derivación de ventana
operacional, overlap detection, outcome `CONFLICT_REVIEW_REQUIRED` sin write,
fingerprint canónico, stale review regeneration, confirmación explícita con
reason, auditoría ConflictOverride, locks estrechos de EquipmentAsset y
Requirement, revalidación y atomicidad de Create.

**Out of scope:** Case Availability general, Replace/Release, parent release
integrations, Dispatch/Custody y frontend.

**Gates:** focales de buffers/ventanas/overlaps/fingerprint; review inicial y
stale con cero writes y cero claims; override confirmado con Assignment y todas
sus auditorías atómicas; revalidación dentro de transacción; PostgreSQL E2E
determinista para dos usuarios sobre el mismo EquipmentAsset y sobre capacidad
de una Requirement; replay/mismatch idempotente; regresión C2 y API completa;
lint, typecheck, build y `git diff --check`.

**STOP:** doble reserva silenciosa, over-coverage por race, fingerprint que
omite contexto determinante, review que escribe o consume claim, confirmación
implícita o auditoría parcial.

## 34.4 HC-NEXT-03C4 — Replace / Release / Parent Integrations

**Scope:** POST `/:assignmentId/replace`; POST `/:assignmentId/release`;
lineage/historia de replacement; audit de release; reutilización del conflict
review para el activo sucesor; idempotency/atomicity de commands; integración
interna que libera reservas por Case cancellation; integración que libera sólo
Assignments `REQUIREMENT` por Requirement withdrawal/cancellation y preserva
los `DIRECT`.

Replace y Manual Release existen como capabilities separadas. Las integraciones
padre descritas en este slice están implementadas e integradas: C4-C1 en
`main@3e1810f` y C4-C2 en `main@f429e9f`.

Las integraciones padre usan la coordinación interna transaction-bound de la
sección 32: el cambio de Case/Requirement y sus releases comparten transaction
client y commit/rollback. No invocan rutas HTTP ni una cadena best-effort.

Toda liberación es lógica. No representa devolución física, movimiento de
Inventory ni terminación de Custody. El guard concreto Dispatch/Custody queda
futuro hasta que exista ese producer domain.

**Out of scope:** DELETE/hard delete, nested mutations públicas, frontend,
Dispatch/Custody runtime y Case Availability general.

**Gates:** focales Replace/Release e integraciones padre; lineage único;
conflict review del sucesor; auditoría inmutable; repeated Release idempotente;
replay/mismatch de las tres scopes; rollback completo ante cualquier fallo;
Case cancellation libera las reservas aplicables; Requirement withdrawal
libera sólo `REQUIREMENT`; historial legible; regresiones Cases/Requirements/
C3, API completa, lint, typecheck, build y `git diff --check`.

**STOP:** estado parcialmente visible, sucesores múltiples, history overwrite,
release de un DIRECT por retiro de Requirement, semántica de devolución física
fabricada o parent command degradado a best-effort silencioso.

## 34.5 HC-NEXT-03C5 — Backend Hardening / Integrated E2E

Decisiones aprobadas:

- **DEC-C5-01:** CoverageNote y cobertura agregada quedan fuera de C5. El ticket
  backend independiente HC-NEXT-03C5-COVERAGE debe definir su contrato y
  completarse antes de C6.
- **DEC-C5-02:** C5 se divide en C5-A Contract Alignment & Safe PostgreSQL
  Harness y C5-B Integrated Backend Validation.
- **DEC-C5B-01:** se diseña la identidad dedicada `zaping_hc_c5b`. Esta decisión
  no autoriza crear el rol, establecer credenciales ni modificar ACL.
- **DEC-C5B-02:** la aceptación del error sanitizado será compuesta. Los unitarios
  prueban el mapping Prisma; 2H prueba fallos PostgreSQL reales y HTTP sanitizado
  usando un auth guard de test; C5-B agrega una comprobación HTTP representativa
  con JWT real y un error Prisma controlado. No acredita un fallo PostgreSQL nativo
  más JWT real dentro de la misma petición ni repite los timeouts de HC-LOCK-04.
- **DEC-C5B-03:** el test modifica directamente el fixture persistido de Case y
  hace readback por List/Detail HTTP. Acredita recálculo desde estado vigente, no
  Case Update API ni coordinación concurrente con la reprogramación.
- HC-LOCK-04 permanece CLOSED / ACCEPTED; no se reabre su protocolo ni su
  capability sin un defecto concreto demostrado.

### 34.5.1 C5-A — Contract Alignment & Safe PostgreSQL Harness

**Estado:** COMPLETE / MERGED — PR #36 + #37 — `main@5ec9f67`.

**Dependencias satisfechas:** baseline de inicio `main@5d33cb0`, integración por
PR #36 y cierre documental por PR #37 en `main@5ec9f67`; C1–C4 COMPLETE / MERGED;
HC-LOCK-04 CLOSED / ACCEPTED; alineación B.1/B.2/B.3 y matriz de gaps refinadas.

**Scope:** corregir divergencias documentales CURRENT y endurecer únicamente el
harness PostgreSQL C1. La configuración será opt-in mediante
`RUN_HC_C5_POSTGRES_TESTS=1` y URL explícita en `HC_C5_DATABASE_URL`, sin dotenv,
`.env`, `DATABASE_URL` genérica ni fallback. Antes de cualquier write debe validar:

- URL PostgreSQL explícita sin routing/options no autorizados;
- `current_database()`, `current_user`, host y puerto externo esperados, puerto
  del servidor, versión PostgreSQL y `current_schema()`;
- `CONNECT`, `USAGE` y `SELECT`/`INSERT`/`DELETE` únicamente sobre las diez tablas
  usadas; sin `UPDATE`, privilegios administrativos/globales ni secuencias;
- que todas las conexiones alcanzan la misma instancia y no hay sesiones ajenas
  al run antes de crear fixtures.

Los fixtures usan IDs aleatorios registrados por el run. El cleanup opera sólo
sobre esos Company IDs, respeta el orden referencial, hace readback de conteos
cero y agrega/propaga fallos de cleanup o disconnect.

**Infraestructura acreditada para C5-A:** usuario `zaping_hc_c5`, base
`zaping_spike_test` y host `127.0.0.1:5434`; identidad dedicada y permisos mínimos
verificados. La excepción ACL aprobada conserva `CONNECT`/`TEMPORARY` y `USAGE`
heredados de `PUBLIC`, sin modificar ACL compartidas. No se hereda la autorización
de los laboratorios B4-B1 o 2H.

**Out of scope:** producción, schema, migraciones, semántica C1–C4, secretos,
frontend y CoverageNote runtime.

**Definition of Ready:** contrato, baseline, identidad, variable explícita,
privilegios mínimos y preflight efectivo de conexión/schema/sesiones/cleanup
acreditados para la ejecución C1. El DoR técnico está satisfecho.

**Acceptance Criteria:** fail-closed antes de escribir ante cualquier mismatch;
cero configuración implícita; privilegios mínimos demostrados; fixtures y cleanup
propios con conteos cero; ningún cambio productivo o de contrato.

**Definition of Done:** harness focal implementado/revisado; preflight autorizado
documentado sin secretos; gates estáticos y `git diff --check` verdes; PostgreSQL
real 27/27 PASS; PR #36 y #37 integrados en `main@5ec9f67`. C5-A está COMPLETE /
MERGED.

**Evidencia:** harness C1 en `85b480d` y `02d7a6e`; 27/27 PASS, 0 skipped, exit 0;
preflight y teardown sin errores reportados. El teardown acredita sólo los fixtures
propios, no una base globalmente vacía. Riesgo residual: la exclusividad se
comprueba al inicio, pero no está garantizada durante toda la ejecución.

**Sprint 1:** 24-sep–07-oct-2026; capacidad bruta 20 h/semana, sin equivalencia a
velocidad, Forecast o Commitment. C5-A se completó el 24-sep. Se prioriza C6-A
como primer incremento visible; puede iniciarse sin B0. Sus SP, fecha y Forecast
permanecen pendientes de estimación y no existe Commitment. B0 conserva sus 3 SP
y estado NOT READY dentro del backlog C5-B.

### 34.5.2 C5-B — Integrated Backend Validation

**Estado:** PLANNED — B0 NOT READY; B1–B3 NOT IMPLEMENTED.

**Slicing y estimación:** B0 Safe Integrated Harness, 3 SP; B1 List/Detail HTTP
Readback, 5 SP; B2 Create HTTP/JWT, 5 SP; B3 Integrated Gate & Closeout, 3 SP.
Los 16 SP son complejidad relativa, no horas, capacidad ni Commitment.

**Scope:** añadir sólo E2E HTTP/PostgreSQL faltantes para list/detail/Create con
JWT real, Company A/B y ADMIN/MANAGER/SALES/WAREHOUSE; filtros/paginación,
historical reads, foreign igual a missing, reevaluación al cambiar schedule y
error de persistencia sanitizado. Ejecutar focales C1–C4 y full API sobre la
baseline integrada; los escenarios ya acreditados de locks, replay, races,
Replace, Manual Release y Parent Integrations se reutilizan sin rediseño.

#### 34.5.2.1 B0 — Safe Integrated Harness — 3 SP

**Estado:** NOT READY / CANDIDATE FOR SPRINT 1.

**DoR de identidad y configuración:** aprobar el diseño de `zaping_hc_c5b`, el
target propuesto `zaping_spike_test` vía `127.0.0.1:5434` (servidor 5432),
`RUN_HC_C5B_POSTGRES_TESTS=1` y `HC_C5B_DATABASE_URL`, sin dotenv, `.env`,
`DATABASE_URL` genérica ni fallback. La URL debe ser PostgreSQL, sin query/hash,
con contraseña no vacía; ningún valor sensible se imprime. Falta acreditar
existencia del rol, mecanismo de entrega de la URL, identidad conectada y ACL; no
existe autorización de provisioning.

**Operaciones SQL en scope:** `SELECT` para JWT, List/Detail, assertions y
disponibilidad; `INSERT` para fixtures, Assignment y claim; `UPDATE` sólo para
locks, horario del Case y completion del claim; `DELETE` sólo para cleanup propio;
`FOR UPDATE`/`FOR SHARE`, advisory locks y configuración local de timeouts. No se
requieren secuencias, DDL, migraciones ni operaciones administrativas.

**Manifiesto mínimo por objeto, pendiente de verificación efectiva:**
- `CONNECT` en `zaping_spike_test` y `USAGE` en `public`;
- `SELECT/INSERT/DELETE` en `Company`, `User`, `Product`, `HealthcareCase`,
  `HealthcareCaseRequirement`, `EquipmentAsset`,
  `HealthcareEquipmentAssignment` e `IdempotencyRecord`;
- `SELECT` en `HealthcareEquipmentAssignmentConflictOverride` y
  `HealthcareEquipmentAssignmentSettings`;
- row locks: `UPDATE(id)` en Case, Requirement y Asset, y `UPDATE(companyId)` en
  Settings;
- DEC-C5B-03: `UPDATE(scheduledStart, scheduledEnd, updatedAt)` en Case;
- claim: `UPDATE(resourceId, updatedAt)` en `IdempotencyRecord`;
- `USAGE` de enums efectivamente usados, incluido `IdempotencyScope`;
- `EXECUTE` de `btrim(text)`, `current_setting(text)`,
  `set_config(text,text,boolean)`, advisory locks y funciones de identidad/ACL del
  preflight. No se conceden privilegios administrativos, globales o de secuencia.

**Preflight antes del primer DML:** validar identidad de URL y conexión efectiva,
PostgreSQL 16, base/usuario/host, puerto host y servidor, schema `public`, PID,
rol LOGIN no administrativo y backend consistente; verificar tablas, columnas,
constraints, índices, ACL de tabla/columna, enums y funciones; exigir sólo las
sesiones propias esperadas y no terminar sesiones. Cualquier mismatch falla
cerrado y sanitizado.

**JWT e inyección:** capturar la existencia y valor previo de `JWT_SECRET` sin
mostrarlo, instalar un secreto efímero antes de construir `JwtStrategy`, mantener
`ignoreEnvFile: true`, registrar JWT explícitamente, inyectar el mismo Prisma
aislado y restaurar exactamente el estado anterior incluso si setup, app close o
teardown fallan.

**Propiedad y cleanup:** preasignar Company A/B; antes de escribir comprobar sus
IDs en todas las tablas tocadas; usar marcadores `id/name/rfc`; reacreditar
propiedad tras cada INSERT incluso ante resultado incierto. Cleanup sólo para IDs
acreditados, en orden referencial, con conteos cero por IDs/keys propios y
`AggregateError` que conserve errores funcionales, de app close, cleanup y
disconnect. Un fixture no acreditado se reporta y nunca se borra.

**AC:** fail-closed anterior al DML, cero configuración implícita o filtración de
secretos, permisos mínimos exactos, ninguna limpieza de datos ajenos y ciclo JWT
aislado. **DoD:** implementación/revisión focal, preflight PostgreSQL autorizado
PASS, teardown propio con conteos cero y TypeScript/ESLint/Prettier/
`git diff --check` verdes.

**Pendiente para completar DoR:** rol/URL, ACL efectivas, schema/catálogo,
funciones/enums, sesiones, collision check, ciclo JWT, ownership y cleanup todavía
no han sido acreditados. B0 no está READY.

#### 34.5.2.2 B1 — List/Detail HTTP Readback — 5 SP

**Estado:** PLANNED / BLOCKED BY B0 / NOT IMPLEMENTED. **AC:** JWT real para cuatro
roles, Company A/B, filtros/paginación, históricos, foreign igual a missing,
respuesta pública y DEC-C5B-03. **DoD:** E2E PG/HTTP focales verdes, readback
persistido, lecturas zero-write y cleanup acreditado. **Riesgos:** combinatoria y
orden/paginación frágiles.

#### 34.5.2.3 B2 — Create HTTP/JWT — 5 SP

**Estado:** PLANNED / BLOCKED BY B0 / NOT IMPLEMENTED. **AC:** 201 para
ADMIN/MANAGER/WAREHOUSE, 403 SALES, 401 sin JWT válido, tenant/foreign=missing,
Assignment y claim atómicos, wrapper público `outcome/data` y DEC-C5B-02. **DoD:**
E2E focales verdes, rechazos zero-write y cleanup acreditado. **Riesgos:**
sobreafirmar evidencia compuesta o duplicar HC-LOCK-04.

#### 34.5.2.4 B3 — Integrated Gate & Closeout — 3 SP

**Estado:** PLANNED / BLOCKED BY B1+B2 / NOT IMPLEMENTED. **AC:** matriz C5-B,
focales C1–C4 y full API, sin reejecutar HC-LOCK-04 por defecto. **DoD:** Prisma
validate/generate, lint, typecheck, build y `git diff --check` verdes; evidencia de
selected/skipped/no ejecutados, identidad no sensible y cleanup propio. **Riesgos:**
flakiness o ampliación de scope ante defectos no demostrados.

**Out of scope:** capabilities o rutas nuevas, CoverageNote/cobertura agregada,
frontend, Case Availability general, fuzzy search, permission-based RBAC,
Dispatch/Custody, efectos físicos y staging/producción.

**Acceptance Criteria:** matriz faltante verde con PostgreSQL/JWT reales; tenant
A/B y cuatro roles; respuestas históricas y errores sin información interna;
regresiones C1–C4 verdes sin flakiness no explicada.

**Definition of Done:** full API, Prisma validate/generate, lint, typecheck, build
y `git diff --check` verdes; evidencia separa seleccionados/skipped/no ejecutados,
registra identidad sin secretos y acredita cleanup propio. Un defecto productivo
requiere corrección focal; no amplía capability por inferencia.

### 34.5.3 HC-NEXT-03C5-COVERAGE

**Estado:** CONTRACT PENDING / NOT READY — PREREQUISITE FOR LATER C6 COVERAGE OR
MUTATION SLICES; NOT A BLOCKER FOR C6-A.

Ticket backend independiente para lectura agregada `PENDING` / `PARTIAL` /
`UNAVAILABLE` / `CONFLICT` y commands de registro/resolución de CoverageNotes.
Debe decidir contrato HTTP, tenant, RBAC, auditoría, concurrencia, replay y
pruebas. No forma parte de C5-A/C5-B.

## 34.6 HC-NEXT-03C6 — Frontend Equipment Assignment

### 34.6.1 HC-NEXT-03C6-A — Case Equipment Assignments Read-only View

**Estado:** PLANNED — NEXT PRODUCT INCREMENT — ESTIMATION / FORECAST / COMMITMENT
PENDING.

**Scope:** pantalla centrada en Case conectada a List/Detail existentes, con
listado, detalle, disponibilidad expuesta por la API y estados loading, empty,
error y RBAC. Es estrictamente read-only y puede iniciarse sin completar B0. Su
aceptación integrada requiere los gates aplicables de autenticación, permisos y
List/Detail; el inicio del frontend no acredita esos gates por sí mismo.

**AC/DoD:** navegación Case → listado → detalle; disponibilidad representada sin
reglas paralelas; estados loading/empty/error; permisos de los cuatro roles y
sesión preservada ante 403; pruebas focales de UI, Web lint/typecheck/build y
verificación integrada aplicable de auth/RBAC/List/Detail. Los SP, fecha Target y
Forecast se deciden tras refinamiento; no hay Commitment.

**Out of scope:** Create, Replace y Release en UI, CoverageNote, movimientos
físicos y cualquier cambio productivo de backend.

### 34.6.2 Slices posteriores de Frontend Equipment Assignment

La evolución posterior cubre UX centrada en Case para ver Requirements de equipo
y coverage, asignar EquipmentAsset concreto, crear Assignment DIRECT con reason,
mostrar contexto `PENDING` / `PARTIAL` / `UNAVAILABLE` / `CONFLICT`, advertir
schedule incompleto, revisar conflictos, confirmar override con reason
obligatorio, Replace, Release e historia. SALES conserva UI read-only; ADMIN,
MANAGER y WAREHOUSE conservan controles de mutación.

La entrada de esos slices posteriores exige que HC-NEXT-03C5-COVERAGE esté
contratado, implementado e integrado cuando usen coverage. La UI representa
estados derivados y respuestas aprobadas; no inventa prioridad, availability
persistida ni reglas paralelas. Un 403 no destruye la sesión.

**Out of scope:** screens de Dispatch/Custody, Case Availability general,
rediseño backend, permission-based RBAC y nuevos workflows de Equipment Core.

**Gates:** focales de section/page/forms/conflict review/history; tests de los
cuatro roles, ausencia de requests forbidden y sesión preservada; validación de
reason, retry con fingerprint vigente, stale review, schedule incompleto y
errores estables; regresión Healthcare Case y navigation/layout; full Web con
estrategia estable, Web lint/typecheck/build y `git diff --check`.

**STOP:** frontend antes de C5 green, mutación visible/solicitada por SALES,
override implícito, warning que afirma disponibilidad, raw internal fields o
regresión de Case/Requirements.

## 34.7 HC-NEXT-03C7 — Integrated Acceptance

**Scope:** preflight automatizado y acceptance manual con ADMIN, MANAGER,
WAREHOUSE y SALES sobre PostgreSQL/API/Web reales y datos deterministas de dos
Companies. C7 crea el documento de evidencia con estado inicial `IN PROGRESS /
PENDING MANUAL QA`; sólo lo promueve cuando pasan todos los escenarios de la
sección 36.

**Out of scope:** corregir findings dentro de un cambio QA no enfocado, ampliar
capability, inventar Dispatch/Custody, permission-based RBAC o marcar aceptación
parcial como completa.

**Gates:** migration deploy en QA; Prisma validate/generate; focales y
regresiones C1–C6; full API y full Web; PostgreSQL integrity/concurrency E2E;
API/Web lint, typecheck y build; runtime smoke real; tenant A/B; matriz manual
de cuatro roles; `git diff --check`; documento de acceptance con expected,
actual y evidencia de cada escenario.

**STOP:** migration drift, fixture inseguro, API/Web sin conexión real, cualquier
gate rojo, escenario A–P no ejecutable, finding funcional abierto o evidencia
manual incompleta.

---

# 35. Delivery y branches recomendados

| Slice | Branch recomendado |
| --- | --- |
| C1 | `feat/healthcare-equipment-assignment-persistence` |
| C2 | `feat/healthcare-equipment-assignment-backend` |
| C3 | `feat/healthcare-equipment-assignment-availability` |
| C4 | `feat/healthcare-equipment-assignment-commands` |
| C5 | `test/healthcare-equipment-assignment-backend-hardening` |
| C6 | `feat/healthcare-equipment-assignment-frontend` |
| C7 | `qa/healthcare-equipment-assignment-acceptance` |

Cada branch se crea desde el `main` actualizado después del merge anterior,
produce un PR enfocado, obtiene CI green y se integra antes de abrir el trabajo
dependiente. Un branch apilado puede usarse sólo para preparación segura; debe
actualizarse al predecessor merged y no altera el orden de aceptación.

---

# 36. Contrato de acceptance integrado

## A. Tenant isolation

- Company A no puede leer una Assignment de Company B.
- Company A no puede asignar un EquipmentAsset de Company B ni usar una
  Requirement o Case de Company B.
- Un ID foreign y uno inexistente producen la misma semántica 404 tenant-safe.

## B. RBAC

| Rol | Read | Create | Replace | Release | Conflict override |
| --- | --- | --- | --- | --- | --- |
| ADMIN | Sí | Sí | Sí | Sí | Sí |
| MANAGER | Sí | Sí | Sí | Sí | Sí |
| WAREHOUSE | Sí | Sí | Sí | Sí | Sí |
| SALES | Sí | No | No | No | No |

Las mutaciones SALES responden 403 sin logout ni destrucción de sesión. Los
guards de API siguen siendo la autoridad; role-aware frontend es defensa en
profundidad.

## C. Assignment origin REQUIREMENT y over-coverage

Con `requestedQty = 2`, el primer y segundo EquipmentAsset compatible se
reservan; un tercero con origin `REQUIREMENT` se rechaza por over-coverage. Un
equipo adicional puede registrarse como `DIRECT` con
`directAssignmentReason`, pero no aumenta la coverage de la Requirement.

## D. Assignment origin DIRECT

`requirementId` se omite y `directAssignmentReason` es obligatorio. El
EquipmentAsset y su Product continúan catalog-backed. Una Assignment `DIRECT`
no cuenta para coverage de Requirements.

## E. Eligibility

Una nueva reserva se rechaza para EquipmentAsset `RETIRED`,
`INSPECTION_PENDING`, `DAMAGED` u `OUT_OF_SERVICE`. Un activo `GOOD` y elegible
continúa hacia la evaluación de Availability.

## F. Schedule completo sin conflicto

Create devuelve 201, la Assignment queda `RESERVED` y el summary de
Availability es conflict-free para el contexto actualmente evaluado.

## G. Schedule incompleto

La Assignment se permite y devuelve 201 con `fullyVerifiable=false` y
`conflictFree=null` o el equivalente aprobado. API y UI muestran warning y no
afirman disponibilidad. Al completar o reprogramar el Case, la disponibilidad
se reevalúa automáticamente contra la nueva ventana y puede resultar en
`CONFLICT`.

Cuando el candidato tiene ventana completa pero una reserva same-asset vigente
no puede evaluarse por schedule incompleto, Create sigue permitido, se emite
`RELATED_RESERVATION_SCHEDULE_INCOMPLETE` y Availability devuelve
`fullyVerifiable=false` / `conflictFree=null`. Si coexiste un overlap confirmado,
el review incluye sólo los conflictos evaluables, conserva el warning y devuelve
`fullyVerifiable=false` / `conflictFree=false`.

## H. Conflict review

- Primer overlap: 200 `CONFLICT_REVIEW_REQUIRED`, cero Assignment writes, cero
  mutation claims, fingerprint y contexto conflictivo.
- Confirmación: explícita, fingerprint vigente y reason obligatorio; el server
  revalida antes del write y persiste Assignment + ConflictOverride
  atómicamente; devuelve 201.
- Fingerprint stale: cero writes y outcome de review nuevo con fingerprint y
  contexto actuales.
- El fingerprint incluye una firma determinista de las reservas same-asset no
  evaluables; completar o cambiar su schedule invalida el review. Esas reservas
  no generan filas de override sin un overlap confirmado y ventanas conocidas.

## I. Concurrency

Dos usuarios que intentan reservar el mismo EquipmentAsset no pueden obtener
dos éxitos silenciosamente conflict-free. La decisión final bloquea/revalida el
estado de reservas vigente y cualquier override requiere review y justificación
explícitos. Dos intentos concurrentes sobre la capacidad de una Requirement no
pueden exceder silenciosamente `requestedQty`.

### Coordinación Company-scoped V1

Los participantes adquieren primero y de forma exclusiva
`pg_advisory_xact_lock(bigint)` para la Company dentro del mismo
`Prisma.TransactionClient`. El input estable V1 es:

```text
zaping:healthcare:company-lock:v1:{companyId canónico en minúsculas}
```

Se codifica en UTF-8, se calcula SHA-256, se toman los primeros ocho bytes y se
interpretan como `int64` con signo en big-endian, sin seed, usando el overload de
un solo `bigint`. Los detalles normativos están en
[ADR-HC-LOCK-001](../../architecture/adr/ADR-HC-LOCK-001-healthcare-company-scoped-transaction-coordination.md).

El helper CURRENT implementa esta derivación SHA-256 y sus vectores normativos.
HC-LOCK-02 consolidó la identidad V1; HC-LOCK-04 permanece CLOSED / ACCEPTED.
La evidencia histórica del spike basada en `hashtextextended()` no describe el
runtime integrado y no debe usarse como contrato alternativo.

El Company lock no vuelve autoritativos los reads previos. El estado crítico se
relee después de adquirir Company y los locks específicos. Tampoco sustituye
autorización, tenant isolation, constraints, idempotencia o validación.

### Orden canónico de locks de Create

El orden objetivo protege la decisión final de Availability y la mutación contra
TOCTOU dentro de la misma transacción:

1. advisory lock transaccional exclusivo por Company.
2. `EquipmentAsset` tenant-scoped con `FOR UPDATE`.
3. `HealthcareCaseRequirement` con `FOR UPDATE` cuando el origen es REQUIREMENT.
4. advisory lock transaccional `SHARED`, Company-scoped, para
   `HealthcareEquipmentAssignmentSettings`.
5. Cases relevantes — candidato más Cases de todas las Assignments
   same-asset `RESERVED` relevantes — deduplicados y ordenados por id, con
   `FOR SHARE`.
6. fila `HealthcareEquipmentAssignmentSettings` con `FOR SHARE` cuando existe.
7. rereads autoritativos y revalidación de Case, Asset, Requirement/capacity,
   settings, reservas, conflictos, reservas no evaluables y fingerprint.
8. review sin write o mutación atómica.

El reread autoritativo ocurre después de adquirir la frontera de locks. Un cambio
de schedule/status/settings confirmado antes de adquirirla debe ser observado;
un cambio concurrente posterior queda bloqueado hasta terminar la transacción.

La ausencia de una fila de settings no puede protegerse con row locking. Por
ello, cualquier futura operación que inserte, actualice o elimine
`HealthcareEquipmentAssignmentSettings` MUST adquirir primero el mismo advisory
lock Company-scoped en modo transaccional `EXCLUSIVE`. C3 implementa y valida el
lado `SHARED`; el endpoint de mutación de settings permanece futuro.

### Espera acotada

El protocolo distingue `maxWait` para obtener la transacción, `lock_timeout` de
PostgreSQL para adquirir Company, límites del trabajo posterior —incluidos row
locks y statements— y el `timeout` total de la transacción interactiva. Un límite
de Zaping no puede debilitar otro heredado más estricto. `lock_timeout`,
`statement_timeout` y el timeout de Prisma tienen alcances distintos; un límite
por statement no garantiza por sí solo una duración absoluta de la transacción.

El `1000ms` del spike es experimental, no un valor aprobado para producción.
HC-LOCK-02 define implementación y calibración. HC-LOCK-04 acreditó Manual
Release y los releases derivados: Parent Integrations 2H 28/28 PASS sobre
`main@f429e9f` y Manual Release B4-B1 14/14 PASS sobre
`fix/hc-lock-04-jwt-isolation@9cc76ce`. PR #34 integró sólo el ajuste E2E JWT y
dejó la producción equivalente en `main@be73bc4`.

Replace conserva el lock del EquipmentAsset destino antes de alterar el conjunto
de reservas. Manual Release implementa la secuencia
`Company → EquipmentAsset → Assignment`; su validación PostgreSQL/HTTP real del
prerequisite está acreditada y HC-LOCK-03B está integrado en `main@8a3b189`.
Otras mutaciones se incorporan al protocolo sólo cuando exista una
dependencia concreta sobre los mismos recursos; no participan por el solo hecho
de pertenecer a Healthcare.

## J. Replacement

Al reemplazar una Assignment `RESERVED` del activo A por B, B queda en una fila
nueva `RESERVED`, A queda `REPLACED`, lineage y actor/time/reason se conservan,
A queda lógicamente disponible sujeto a las demás condiciones de dominio, y el
conflict review aplica a B. Toda la historia permanece legible.

Su orden principal es:

```text
Company
→ EquipmentAsset destino
→ Requirement
→ Assignment fuente
→ coordinación de settings
→ Cases relevantes en orden determinista
→ rereads autoritativos
→ review o write
```

## K. Release

Sólo `RESERVED` puede transicionar por release manual; reason es obligatorio y
normalizado; actor/time/reason se preservan. El resultado es `RELEASED` con causa
`MANUAL`. Repetir con la misma razón normalizada devuelve 200 sin writes;
repetir con otra razón devuelve 409 sin cambiar historia. Se conservan la
idempotencia por estado y por `Idempotency-Key + payload`. `REPLACED` no puede
transicionar a `RELEASED` por esta operación.

Manual Release usa `Company → EquipmentAsset → Assignment`, con timeouts
posteriores inmediatamente después de Company y revalidación de la relación
Assignment-to-Asset. Release sigue siendo lógico: no implica retorno, Inventory
Movement ni Custody.

## L. Case cancellation

La Parent Integration C4-C2 adquiere Company primero, cambia el Case y libera
consistentemente sus Assignments lógicas `RESERVED` aplicables en una frontera
atómica. Retiene historia y no fabrica una devolución física. Está integrada en
`main@f429e9f`.

## M. Requirement withdrawal/cancellation

C4-C1 implementa Requirement Retire con orden
`Company → Case → Requirement → Assignments por ID ASC`, una sola transacción y
updates condicionales. Libera las Assignments `RESERVED` de origin `REQUIREMENT`,
preserva `DIRECT` e historia y reutiliza actor, razón normalizada y timestamp del
padre. Replay `RETIRED` es zero-write y no repara historia. La implementación
está integrada en `main@3e1810f`.

Evidencia de cierre técnico C4-C1: Jest focal 429/429 PASS; typecheck, ESLint,
Prettier focal, API build y `git diff --check` PASS; PostgreSQL E2E 13/13 PASS,
exit 0, con 14 pruebas no seleccionadas por filtro, sobre `zaping_spike_test`
aislada. El teardown elimina por Company IDs del run, verifica conteos cero y
propaga fallos; no acredita una base globalmente vacía ni readiness productiva.
No hubo schema/migraciones, claims derivados ni efectos físicos nuevos.

## N. Idempotency

Para Create, Replace y Release, misma key + mismo payload reejecuta/relee el
outcome original; misma key + payload distinto produce el conflicto estable
aprobado. No se duplican mutaciones ni historia. Los outcomes de review sin
write no crean ni finalizan mutation claims, conforme a B.2.

## O. History y reads

Las filas `RELEASED` y `REPLACED` siguen legibles. Las respuestas incluyen las
entidades relacionadas compactas y summaries de auditoría aprobados, sin
exponer `companyId`, actor FKs internos, detalles Prisma/PostgreSQL ni nombres
de constraints.

## P. Error hardening

Se verifica semántica estable para recursos missing/foreign, DTO inválido,
payload DIRECT inválido, incompatibilidad Requirement/Product/Equipment,
Requirement inactive/retired, EquipmentAsset inelegible, over-coverage,
transición lifecycle inválida, reserva duplicada, idempotency mismatch y fallos
de persistencia. Nunca se filtran errores raw de Prisma/PostgreSQL.

Un timeout clasificado específicamente durante la adquisición de Company se
expone como HTTP 503 `HEALTHCARE_CONCURRENCY_TIMEOUT`, sin SQL, metadata,
conexión ni causas internas. `P2010`, `P2028`, `40P01`, `57014` y `55P03` no se
convierten automáticamente en ese error; la espera posterior de row locks exige
otra clasificación. V1 no incorpora retries automáticos y cualquier retry
explícito conserva la idempotencia aplicable.

---

# 37. Decision gates y fronteras futuras

## 37.1 Gate histórico antes de C3

Los valores exactos de:

```text
preCaseBufferMinutes
postCaseBufferMinutes
```

debían decidirse y quedar documentados antes de implementar Availability en C3.
B.3 no inventó valores. C1 podía persistir la forma Company-scoped y C2 podía
implementar el warning de schedule incompleto, pero C3 no debía iniciar hasta
cerrar ese gate. Esta subsección conserva el gate histórico de aquella fase; C3
ya está COMPLETE / MERGED.

## 37.2 Dispatch/Custody

El guard concreto de Dispatch/Custody no bloquea C1–C7 mientras esos producer
domains no estén implementados. La frontera sí es obligatoria: liberar una
reserva lógica nunca implica que el activo volvió físicamente a Warehouse ni
que está disponible si Dispatch/Custody llega a gobernar su posición.

Al cierre de B.3 no se identificaron otros blockers para iniciar C3. Esa
conclusión estaba limitada a aquella fase. HC-LOCK-02/03/04 y HC-NEXT-03C4-C ya
están cerrados; no elimina los gates pendientes propios de C5–C7. Si la
implementación descubre un blocker, el slice afectado se detiene y solicita una
decisión; no inventa semántica.

---

# 38. Status promotion durante implementación

| Hito | Estado documental permitido |
| --- | --- |
| B.3 aprobado | `HC-NEXT-03B COMPLETE / APPROVED — IMPLEMENTATION NOT STARTED` |
| C1 merged | `PARTIALLY IMPLEMENTED — PERSISTENCE` |
| C2–C4 merged | `PARTIALLY IMPLEMENTED — BACKEND IN PROGRESS`, enumerando slices reales |
| C5-A merged | `PARTIALLY IMPLEMENTED — C5-A COMPLETE / MERGED` |
| C5-B merged | `PARTIALLY IMPLEMENTED — BACKEND VALIDATED` |
| C6 merged | `IMPLEMENTED / INTEGRATED ACCEPTANCE REQUIRED` |
| C7 automated green, manual pendiente | `IN PROGRESS / PENDING MANUAL QA / NOT ACCEPTED` |
| C7 completo | `COMPLETE / ACCEPTED` sólo con escenarios A–P y matriz manual verdes |

---

# 39. Estado final

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
→ COMPLETE / MERGED
→ MANUAL RELEASE HC-LOCK-03B AND REPLACE BACKEND MERGED
→ REQUIREMENT RETIRE C4-C1 COMPLETE / MERGED IN main@3e1810f
→ CASE CANCEL C4-C2 COMPLETE / MERGED IN main@f429e9f
→ COMPANY LOCK ARCHITECTURE AND HC-LOCK-02 IMPLEMENTATION IN MAIN
→ HC-LOCK-04 FINAL CLOSED / ACCEPTED IN main@be73bc4

Equipment Assignment implementation
→ PARTIALLY IMPLEMENTED — BACKEND C1–C4 COMPLETE / MERGED
→ C5-A COMPLETE / MERGED — PR #36 + #37 — main@5ec9f67
→ C6-A READ-ONLY CASE VIEW PLANNED NEXT — ESTIMATION / FORECAST / COMMITMENT PENDING
→ C5-B PLANNED — B0 NOT READY; B1–B3 NOT IMPLEMENTED; C5-COVERAGE CONTRACT PENDING
```
