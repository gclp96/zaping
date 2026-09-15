# Healthcare Requirements — Zaping Healthcare

**Módulo:** Healthcare Requirements
**Producto:** Zaping Healthcare
**Versión:** 1.0.0
**Estado:** APPROVED DOMAIN DISCOVERY
**Estado de implementación:** DOMAIN DISCOVERY COMPLETE / DOCUMENTED — TECHNICAL DESIGN APPROVED — PERSISTENCE / BACKEND / FRONTEND COMPLETE / MERGED — ACCEPTANCE COMPLETE / ACCEPTED
**Última actualización:** 2026-09-14
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Healthcare Requirements define la necesidad planeada de Products para un
Healthcare Case antes de seleccionar recursos físicos o producir efectos
operacionales.

Debe responder:

```text
¿Qué Product necesita el Case?
¿Qué cantidad planeada necesita?
¿Es una línea REQUIRED o BACKUP?
¿En qué orden debe presentarse?
¿Sigue vigente o fue retirada con trazabilidad?
```

---

# 2. Autoridad y estado

Este documento cerró el **domain discovery** de Requirements V1 y aprobó las
decisiones RQ-001 a RQ-030 y sus límites conceptuales. La implementación y la
aceptación posteriores respetaron ese contrato.

Este documento de discovery no aprueba ni implementa:

```text
Prisma schema
migrations
HTTP routes
DTOs
response shapes
stable error codes
service/concurrency design
frontend
tests
runtime behavior
```

Este documento de discovery no creó un identificador de implementación para
Requirements.

El diseño técnico se encuentra en `REQUIREMENTS_TECHNICAL_DESIGN.md` con estado
`APPROVED`; la evidencia automatizada, runtime y manual del resultado aceptado
se registra en `REQUIREMENTS_ACCEPTANCE.md`.

---

# 3. Principio fundamental

```text
Requirement
→ what the Case needs
```

Requirement no representa:

```text
inventory reservation
stock availability
preparation
lot/batch selection
serial selection
storage location selection
specific Equipment assignment
Dispatch
Inventory OUT
Return
Reconciliation
```

Crear, editar, retirar o reactivar una Requirement no modifica Inventory por sí
mismo.

---

# 4. Relación principal

Cada Requirement V1:

- pertenece a una Company;
- pertenece a un Healthcare Case existente de esa Company;
- referencia un Product existente de esa Company;
- expresa una cantidad planeada para ese Product;
- conserva trazabilidad aun cuando deja de estar vigente.

Un Healthcare Case puede tener múltiples Requirements, pero sólo una línea por
Product. La unicidad Case + Product incluye líneas retiradas.

---

# 5. Datos de dominio aprobados

El discovery aprueba los siguientes hechos conceptuales:

| Dato | Semántica V1 |
| --- | --- |
| `caseId` | Relación requerida e inmutable con Healthcare Case. |
| `productId` | Relación requerida e inmutable con Product. |
| `requestedQty` | Cantidad planeada entera y estrictamente mayor que cero. |
| classification | `REQUIRED` o `BACKUP`; no implica prioridad ni fulfillment. |
| notes | Notas opcionales propias de la línea, independientes de las notas del Case. |
| `sortOrder` | Orden interno de presentación; se asigna automáticamente y no es prioridad operacional ni valor único. |
| `createdById` | Actor que creó la línea. |
| `createdAt` | Momento de creación. |
| `updatedAt` | Última actualización. |
| `retiredAt?` | Momento de retiro lógico. |
| `retiredById?` | Actor que retiró la línea. |
| `retirementReason?` | Razón obligatoria cuando la línea se retira. |

La forma concreta de persistencia, nombres técnicos adicionales, defaults y
constraints está aprobada en `REQUIREMENTS_TECHNICAL_DESIGN.md` e implementada
en Requirements V1.

No se aprueba un campo `isActive` ni otra representación técnica de lifecycle
en este discovery.

---

# 6. Product y unidad implícita V1

Cada Requirement referencia un Product existente. Para crear una línea o una
nueva relación, el Product debe estar activo.

Un Product inactivo:

- no puede seleccionarse para una Requirement nueva;
- no puede utilizarse como reemplazo de una relación;
- no invalida ni oculta Requirements históricas que ya lo referencian.

Requirement V1 no tiene un campo de unidad independiente. `requestedQty` se
interpreta usando la unidad implícita actual con la que el Product es gestionado
por el modelo ERP/Product/Inventory existente.

```text
requestedQty
→ integer > 0
```

V1 no introduce:

```text
Units of Measure
Product unit field
unit conversion
packaging conversion
decimal quantities
```

Units of Measure y cantidades decimales permanecen FUTURE y sólo pueden
revisarse cuando Units of Measure esté formalmente diseñado e implementado de
forma transversal en Product/Inventory.

---

# 7. Clasificación y orden

La clasificación V1 es deliberadamente simple:

```text
REQUIRED
BACKUP
```

Una línea BACKUP es una Requirement independiente. Puede explicar su uso en
notes, pero no crea una relación formal de sustitución o equivalencia.

`sortOrder` controla únicamente la presentación dentro del Case. Es requerido,
pero no es unique. La UI V1 lo asigna automáticamente con espaciado estable y
no presenta input ni controles manuales de reorder. No expresa prioridad,
agrupación ni secuencia operacional.

Preparation / CaseKit / Maletín podrá reconsiderar una secuencia operacional
cuando esos dominios sean diseñados; Requirements V1 no la anticipa.

---

# 8. Edición y protección histórica

Requirements pueden editarse en estados operacionales editables del Case, como
DRAFT y SCHEDULED, siempre que no exista fulfillment operacional real asociado.

La línea queda protegida contra reescritura histórica silenciosa cuando existe
evidencia real asociada de cualquiera de estos hechos:

```text
Dispatch
Inventory output / consumption
effective custody / Equipment assignment
```

Ningún role puede ignorar esta protección.

Preparation por sí sola no congela una Requirement. Antes de Dispatch,
consumption, Inventory OUT o custody efectiva, la línea puede cambiar conforme
a las demás reglas. Preparation deberá reconciliarse posteriormente con esos
cambios sin crear movimientos de Inventory sólo porque cambió la Requirement.

El contrato `RequirementOperationalEvidencePolicy` y su invocación desde las
mutaciones reales existen. La integración con evidencia operacional real
continúa diferida hasta que productores Healthcare como Dispatch, Equipment
Assignment o Custody proporcionen relaciones estructurales tenant-safe.

---

# 9. Lifecycle

No existe hard delete.

```text
vigente
↓ explicit retirement + mandatory reason
retirada / historical
↓ explicit reactivation
vigente
```

Retirement conserva la línea y exige razón auditable. Reactivation reutiliza la
misma línea Case + Product; no crea un duplicado ni reactiva silenciosamente
durante create.

Una línea retirada continúa incluida en la unicidad Case + Product.

CANCELLED vuelve históricas y read-only todas las Requirements del Case. La
cancelación nunca las elimina.

Si Case reopening se agrega en el futuro, las mismas líneas podrán volver a ser
editables bajo las reglas normales y sin duplicación. Reopening no pertenece a
Requirements V1.

La representación persistente del lifecycle y los contratos de comandos están
definidos en `REQUIREMENTS_TECHNICAL_DESIGN.md` e implementados en Requirements
V1.

---

# 10. RBAC fijo aprobado

Mientras las reglas de Case, Product y protección histórica lo permitan:

| Role | Read | Create | Edit |
| --- | --- | --- | --- |
| ADMIN | allowed | allowed | allowed |
| MANAGER | allowed | allowed | allowed |
| SALES | allowed | allowed | allowed |
| WAREHOUSE | allowed | allowed | allowed |

WAREHOUSE puede ajustar Requirements cuando sea operacionalmente necesario.
Esto no le permite omitir la protección de RQ-006 ni alterar Inventory mediante
la Requirement.

El discovery no asignó retirement/reactivation a roles concretos ni definió
rutas o guards. El technical design aprobado completa esa matriz por acción sin
contradecir RQ-010; esa matriz está implementada y validada.

---

# 11. Auditoría

Requirements V1 conserva auditoría explícita básica:

```text
createdById
createdAt
updatedAt
retiredAt?
retiredById?
retirementReason?
```

`createdById`, `retiredById` y timestamps son hechos controlados por el sistema,
no campos confiados libremente al cliente.

No se incluye historial field-by-field, versioning ni snapshots completos de
cada edición.

---

# 12. Tenant isolation

Requirement es Company-scoped.

```text
Requirement.company
= HealthcareCase.company
= Product.company
```

Todas las relaciones, lecturas y mutaciones deberán ser tenant-safe. Un cliente
no puede elegir ni sobrescribir `companyId`; el contexto autenticado es la
autoridad.

No puede persistirse una relación cross-tenant. La forma exacta de composite
keys, predicates, not-found semantics y errores está definida en el diseño
aprobado `REQUIREMENTS_TECHNICAL_DESIGN.md`, preservando las convenciones de
aislamiento existentes.

---

# 13. Fulfillment y trazabilidad futura

Requirement representa planeación y no crea fulfillment.

La evolución operacional deberá mantener trazabilidad:

```text
Requirement
→ Preparation / Equipment Assignment
→ Dispatch / custody
→ actual use
→ Inventory Movement / Return / Reconciliation
```

Los hechos reales de uso o fulfillment deben terminar relacionados con impacto
real de Inventory o custody de Equipment, sin convertir la Requirement en ese
hecho.

No se persisten estados de fulfillment propios de Requirement como:

```text
PENDING
PARTIALLY_FULFILLED
FULFILLED
```

Fulfillment se derivará posteriormente desde evidencia de Preparation,
Assignment, Dispatch, Return y Reconciliation.

HC-NEXT-03A documenta en `EQUIPMENT_ASSIGNMENT.md` que una Assignment de equipo
normalmente resuelve una Requirement, pero permite una asignación directa y
trazable de Warehouse para una necesidad urgente o de último minuto. Esa
excepción no convierte Assignment en Requirement ni modifica el contrato de
Requirements V1.

---

# 14. Availability y stock

Requirements V1 no:

- consulta ni bloquea por stock disponible;
- calcula shortages;
- reserva Inventory;
- selecciona lot, batch, serial, storage location o EquipmentAsset;
- crea movimientos de Inventory.

Una Requirement sigue siendo válida aunque el stock sea insuficiente.
Availability, shortage y reservation pertenecen a Case Availability y
capacidades posteriores.

---

# 15. Scope explícitamente diferido

Prisma, migrations, API, DTOs, errors, services, frontend y tests no fueron
implementados por este discovery. Su diseño target está `APPROVED` en
`REQUIREMENTS_TECHNICAL_DESIGN.md`.

Permanecen fuera de Requirements V1:

- Equipment Assignment;
- Case Availability, shortage calculation y reservation;
- Preparation;
- Dispatch / Custody;
- Inventory OUT / consumption;
- Return / Reconciliation;
- CaseKit / Maletín;
- formal substitute/equivalent relationships;
- compatibility or prioritization engines;
- lot, batch, serial, location o specific Equipment selection;
- Product Units of Measure, decimal quantities y conversions;
- Requirement-specific required-at date/time;
- templates, procedure templates y copy-from-case;
- controlled adjustment/reconciliation after real fulfillment;
- full edit history, snapshots y versioning;
- Case reopening.

---

# 16. Registro de decisiones aprobadas

| ID | Decisión |
| --- | --- |
| RQ-001 | Cada Requirement referencia un Product existente. |
| RQ-002 | La necesidad planeada no modifica Inventory; fulfillment real debe ser trazable a Inventory o custody. |
| RQ-003 | Sólo `requestedQty` pertenece a Requirement; cantidades preparadas, enviadas, usadas o retornadas son posteriores. |
| RQ-004 | Existe una sola línea por Product y Case. |
| RQ-005 | Product inactivo bloquea selección nueva/reemplazo, no la historia existente. |
| RQ-006 | La edición termina ante fulfillment real; no se reescribe historia silenciosamente. |
| RQ-007 | Clasificación limitada a REQUIRED/BACKUP. |
| RQ-008 | Notes de línea opcionales e independientes. |
| RQ-009 | No existe lifecycle de fulfillment persistido en Requirement. |
| RQ-010 | ADMIN, MANAGER, SALES y WAREHOUSE leen/crean/editan sujeto a reglas; nadie omite RQ-006. |
| RQ-011 | No hard delete; retirement lógico e histórico. |
| RQ-012 | Retirement exige razón auditable. |
| RQ-013 | Auditoría básica; sin versioning field-by-field. |
| RQ-014 | DRAFT/SCHEDULED editables según reglas; CANCELLED histórico/read-only y no elimina líneas. |
| RQ-015 | Sin sustitución formal; alternativas son líneas BACKUP independientes con notes. |
| RQ-016 | Sin unidad propia; cantidad usa la unidad implícita actual de Product. UoM/conversions permanecen FUTURE. |
| RQ-017 | Requirement no selecciona lot, batch, serial, location ni EquipmentAsset. |
| RQ-018 | `sortOrder` requerido, de presentación y no unique. |
| RQ-019 | Templates y copy-from-case quedan fuera. |
| RQ-020 | Reactivation explícita reutiliza la línea retirada. |
| RQ-021 | `requestedQty` es integer estrictamente mayor que cero; no decimals en V1. |
| RQ-022 | Sin fecha/hora propia; hereda contexto temporal del Case. |
| RQ-023 | `productId` es immutable; corregir implica retire + create/reactivate. |
| RQ-024 | `caseId` es immutable; no se mueve una línea entre Cases. |
| RQ-025 | Unicidad Case + Product incluye líneas retiradas. |
| RQ-026 | `sortOrder` no es database-unique; 10/20/30 no es invariante. |
| RQ-027 | Company scope y relaciones Case/Product tenant-safe; nunca confiar en `companyId` del cliente. |
| RQ-028 | Preparation sola no congela ni crea Inventory movement por cambios. |
| RQ-029 | Sin availability, shortage o reservation; falta de stock no invalida la Requirement. |
| RQ-030 | CANCELLED es histórico/read-only; reopening futuro reutilizaría líneas bajo reglas normales. |

---

# 17. Decisiones trasladadas al technical design aprobado

`REQUIREMENTS_TECHNICAL_DESIGN.md` define, sin reabrir este dominio salvo
conflicto real:

- modelo Prisma, constraints y relaciones tenant-safe;
- rutas, DTOs, response shapes y stable error codes;
- representación técnica de retirement/reactivation;
- RBAC exacto para acciones lifecycle;
- detección race-safe de fulfillment que bloquea edición;
- concurrencia para unique Case + Product y reactivation;
- contratos de reorder y normalización de notes;
- estrategia de auditoría y selects de respuesta;
- tests unitarios, integración PostgreSQL, HTTP y frontend;
- UX de líneas activas/históricas y protección operacional.

Estado de esas decisiones: `APPROVED — IMPLEMENTED / ACCEPTED`.

---

# 18. Resumen final

```text
Requirements domain discovery
→ COMPLETE / DOCUMENTED

Requirements technical design
→ APPROVED

Requirements persistence / backend / frontend
→ COMPLETE / MERGED

Requirements acceptance
→ COMPLETE / ACCEPTED
```

HC-NEXT-03A — Healthcare Equipment Assignment Domain Discovery está COMPLETE /
DOCUMENTED. HC-NEXT-03B está COMPLETE / APPROVED: HC-NEXT-03B.1 Persistence &
Availability Design, HC-NEXT-03B.2 API / DTO / Authorization Contract y
HC-NEXT-03B.3 Implementation Slicing / Acceptance Contract están APPROVED /
DOCUMENTED. HC-NEXT-03C1 Persistence / Migration está COMPLETE / READY FOR
REVIEW; HC-NEXT-03C2 Assignment Backend Base queda NEXT / BLOCKED UNTIL C1
MERGED. Assignment está parcialmente implementado sólo en persistencia; su
backend permanece NOT IMPLEMENTED.
