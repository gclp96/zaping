# Healthcare Equipment Assignment — Technical Design

**Módulo:** Healthcare Equipment Assignment
**Producto:** Zaping Healthcare
**Slice:** HC-NEXT-03B.1 — Persistence & Availability Design
**Versión:** 1.0.0
**Estado:** APPROVED / DOCUMENTED
**Estado de HC-NEXT-03B:** IN PROGRESS
**Estado siguiente:** HC-NEXT-03B.2 API / DTO / Authorization Contract — NEXT / READY
**Estado de implementación:** NOT IMPLEMENTED / NOT STARTED
**Última actualización:** 2026-09-15
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito y autoridad

Este documento define el diseño técnico aprobado de persistencia, integridad,
Availability y concurrencia para Equipment Assignment.

Parte del contrato de dominio cerrado en `EQUIPMENT_ASSIGNMENT.md` y no lo
reabre. B.1 no modifica Prisma, no crea migrations y no implementa backend,
frontend ni tests.

Quedan fuera de B.1:

- rutas y métodos HTTP;
- DTOs y transformation/validation de transporte;
- códigos HTTP y stable error codes;
- response shaping, pagination y filtros API;
- guards/decorators concretos;
- frontend UX;
- integración concreta con los comandos de cancelación del Case y
  retiro/cancelación de Requirement.

Esos contratos pertenecen a B.2 o a slices posteriores según se indica al final.

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
| `releaseReason` | string nullable | Contexto opcional; B.2 decidirá cuándo exigirlo. |
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

Si no existe la fila, el evaluator usa defaults del sistema. Los valores exactos
de esos defaults continúan TBD. Si existe, ambos valores deben estar definidos;
no se mezclan defaults parciales con overrides parciales.

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

B.2 definirá cómo el cliente devuelve la confirmación y cómo se representa el
fingerprint/revision del conjunto revisado. La garantía B.1 es que una
confirmación vieja no autoriza conflictos nuevos o ventanas distintas.

No existe exclusion constraint ni unique temporal que impida overlaps entre
Cases; el override aprobado debe poder persistirse.

---

# 14. Release, Case cancellation y Requirement withdrawal

Manual release aplica únicamente a una fila `RESERVED` y la lleva a `RELEASED`
con `releaseCause = MANUAL`.

Cuando un HealthcareCase pasa a `CANCELLED`, todas sus filas `RESERVED` pasan a
`RELEASED` con `releaseCause = CASE_CANCELLED`. La operación conserva los datos
de auditoría del actor que ejecutó la cancelación.

Cuando una Equipment Requirement se retira/cancela, todas sus filas `RESERVED`
de origen `REQUIREMENT` pasan automáticamente a `RELEASED` con
`releaseCause = REQUIREMENT_WITHDRAWN`. Las filas históricas permanecen y las
Assignments `DIRECT` no se liberan por esta regla porque no pertenecen a esa
Requirement.

El release:

- termina la reserva lógica;
- excluye la fila de conflictos y coverage futuros;
- no elimina historia;
- no fabrica Return;
- no cambia Custody;
- no cambia EquipmentAsset lifecycle/condition.

La integración transaccional exacta dentro de los comandos existentes de Case y
Requirement queda para B.2/implementación. Un futuro productor Dispatch/Custody
debe impedir que cualquier release automático se interprete como disponibilidad
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

El flujo usa review optimista y revalidación inmediatamente antes del write. No
se propone `Serializable` global, retries amplios ni un lock de toda la Company.

Pure optimistic read no cierra por sí solo la carrera donde dos transacciones
ven el mismo activo sin reservas y ambas escriben. Por ello, la confirmación final
usa un lock estrecho por EquipmentAsset dentro de la transacción.

## 18.2 Assign concurrente

```text
lock candidate EquipmentAsset row
→ for REQUIREMENT origin, lock Requirement row
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
lock. Si difieren del review del cliente, no escribe y devuelve un resultado
estable de review renovado. B.2 nombrará el error/outcome.

## 18.4 Replace y release

Replace bloquea la Assignment original y los EquipmentAsset A/B en orden
determinista por ID. Release bloquea o hace conditional update sobre la fila
`RESERVED`. Si el count esperado es cero, re-lee estado tenant-scoped y devuelve
el resultado estable que B.2 defina.

Case cancellation y Requirement withdrawal deben adquirir/actualizar sus filas
`RESERVED` en orden determinista. La coordinación exacta con los comandos
existentes se cierra durante integración.

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

# 21. Decisiones abiertas para B.2 o implementación

HC-NEXT-03B.2 debe definir:

- rutas y métodos;
- DTOs y protected fields;
- códigos HTTP y stable error codes;
- response shaping;
- pagination/filtering;
- representación del review/fingerprint y confirmación explícita;
- guards/decorators para la matriz fixed-role;
- representación HTTP del warning/review-needed cuando falta una ventana
  completa, sin reabrir que Assignment está permitida;
- integración concreta con Case cancellation;
- integración concreta con Requirement withdrawal/cancellation;
- idempotency y outcomes exactos de release/replace;
- frontend-facing semantics, sin diseñar todavía la UI.

Permanecen diferidos explícitamente y no deben resolverse por inferencia:

1. valores default exactos de `preCaseBufferMinutes` y
   `postCaseBufferMinutes`;
2. mecanismo concreto por el que un futuro Dispatch/Custody participa en el
   guard de replace/release.

Estas preguntas no contradicen B.1 y no autorizan defaults o comportamiento
implícito.

---

# 22. Estado final

```text
HC-NEXT-03A — Equipment Assignment Domain Discovery
→ COMPLETE / DOCUMENTED

HC-NEXT-03B — Equipment Assignment Technical Design
→ IN PROGRESS

HC-NEXT-03B.1 — Persistence & Availability Design
→ APPROVED / DOCUMENTED

Next
→ HC-NEXT-03B.2 API / DTO / Authorization Contract — NEXT / READY

Equipment Assignment implementation
→ NOT IMPLEMENTED / NOT STARTED
```
