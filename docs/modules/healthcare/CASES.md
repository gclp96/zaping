Healthcare Cases — Zaping

Módulo: Healthcare Cases
Producto: Zaping Healthcare
Versión: 1.6.0
Estado: Aprobado
Estado de implementación: CASE FOUNDATION + DOCTOR/HOSPITAL WORKFLOW IMPLEMENTED / VALIDATED — HC-NEXT-01 CLOSED / ACCEPTED; EQUIPMENT ASSIGNMENT C1–C6-E COMPLETE / MERGED; HC-OPS-01A COMPLETE / MERGED — PR #50 — main@bb530e8 — Actual 27-sep-2026; HC-OPS-01A.1 COMPLETE / MERGED — PR #53 — main@54a5d79 — Actual 28-sep-2026; HC-OPS-01B COMPLETE / VALIDATED / READY FOR FINAL REVIEW — UNCOMMITTED — DoD PASS — DoR COMPLETE
Última actualización: 2026-10-07
Responsable: Zaping Healthcare Team

1. Propósito

Healthcare Case representa la unidad operacional principal de Zaping Healthcare.

Su objetivo CURRENT es proporcionar una referencia estable para coordinar una operación Healthcare concreta mediante:

identity

tenant context

operational title

procedure description

planning schedule

responsible User

minimal lifecycle

creation / cancellation audit facts

La integración backend CURRENT permite que el Case coordine Doctor y Hospital
como referencias opcionales. La evolución TARGET permitirá coordinar además:

Requirements

Equipment Assignment

Case Availability

Preparation

CaseKit / Maletín

Dispatch / Custody

Return

Inspection

Reconciliation

Calendar

Case 360

commercial context

Healthcare Case no debe convertirse en un modelo gigante ni absorber responsabilidades que pertenecen a otros dominios.

2. Principio fundamental

Healthcare Case representa:

la coordinación operacional de un procedimiento o evento Healthcare.

No representa por sí mismo:

Opportunity

Quote

Sale

SalesOrder

Delivery

Invoice

Inventory

EquipmentAsset identity

clinical record

3. CURRENT vs TARGET vs FUTURE

Este documento distingue tres niveles.

CURRENT

Capacidades implementadas y validadas en Healthcare Case Foundation.

TARGET

Capacidades operacionales Healthcare aprobadas como dirección, pero todavía no implementadas.

FUTURE

Capacidades posteriores que no pertenecen al primer cierre operacional Healthcare.

4. Estado CURRENT consolidado

Actualmente:

HealthcareCase Foundation
✅ IMPLEMENTED / VALIDATED

Incluye:

UUID technical identity

CASE-* operational folio

tenant ownership

title

procedureDescription?

planning schedule

responsible User

optional Doctor / Hospital references and compact API context

DRAFT / SCHEDULED / CANCELLED

createdBy audit fact

cancellation audit facts

create

list

detail

planning update

cancel

tenant-scoped API

RBAC

5. Fuera de CURRENT Foundation

No existen todavía como parte implementada de HealthcareCase:

Customer relation

Payer relation

Opportunity relation

Case Requirements

Equipment Assignment

Case Availability

Preparation

CaseKit

Dispatch

Custody

Return

Healthcare material inspection

Reconciliation

advanced lifecycle

Case Calendar UI

Case 360

Healthcare frontend

6. HealthcareCase como agregado operacional

HealthcareCase debe funcionar como punto de coordinación.

Conceptualmente podrá conectar:

Schedule

Actors

Requirements

Preparation

Equipment

CaseKit

Dispatch

Return

Reconciliation

Commercial context

sin convertir todos esos conceptos en columnas directas del mismo modelo.

7. Case no es un modelo gigante

No debe absorber dentro de una sola tabla:

CaseKit items

Inventory positions

Dispatch items

Return items

Equipment history

Sales

Billing

Audit

Cada módulo conserva ownership sobre sus propios hechos.

8. HealthcareCase ≠ clinical record

Debe mantenerse:

HealthcareCase
≠
Clinical Record

Case representa una operación empresarial y logística.

No representa expediente médico.

9. Minimización clínica

HealthcareCase Foundation no debe almacenar por defecto:

patientName

patientId

patientDOB

diagnosis

treatment history

medical history

clinical notes

clinical record identifiers

Los campos CURRENT:

title

procedureDescription

son operacionales, no clínicos.

10. Modelo Prisma CURRENT

Foundation implementa:

HealthcareCase

con campos:

id

companyId

folio

title

procedureDescription?

status

scheduledStart?

scheduledEnd?

responsibleUserId?

createdById

cancelledAt?

cancelledById?

cancellationReason?

createdAt

updatedAt

11. Migración CURRENT

Healthcare Case Foundation fue persistido mediante:

20260824162849_add_healthcare_case_foundation

La migración introdujo únicamente el alcance Foundation aprobado:

HealthcareCaseStatus enum

HealthcareCase table

Company relation

responsible User relation

creator User relation

cancellation actor User relation

constraints

indexes

No incluyó:

Doctor

Hospital

CaseKit

Dispatch

Return

Equipment Assignment

12. Delete policy CURRENT

HealthcareCase Foundation utiliza una política conservadora para relaciones críticas de auditoría.

Las relaciones relevantes utilizan comportamiento restrictivo según la implementación documentada.

El Case no debe perder historia automáticamente por eliminación de actores relacionados.

13. Identidad técnica

Debe mantenerse:

HealthcareCase.id
→ UUID

El UUID es:

technical identity

immutable

14. Folio operacional CURRENT

HealthcareCase utiliza folio generado por servidor.

Formato CURRENT:

CASE-000001

Debe mantenerse:

folio
→ human operational identity
→ immutable
→ unique per Company
→ not submitted by client

15. CompanySequence CURRENT

Healthcare Case utiliza:

CompanySequence

mediante infraestructura compartida:

CompanySequenceAllocatorService

con key:

HEALTHCARE_CASE_FOLIO

La asignación ocurre dentro de la transacción de creación del Case.

16. Shared sequence infrastructure

Healthcare y Equipment pueden reutilizar el allocator numérico.

Pero cada dominio conserva:

own sequence key

own code formatting

own collision behavior

own operational identity

Healthcare no depende de Equipment para generar folios.

17. Constraints / indexes CURRENT

HealthcareCase Foundation implementa:

@@unique([companyId, folio])

@@unique([id, companyId])

@@index([companyId, status])

@@index([companyId, scheduledStart])

@@index([companyId, responsibleUserId])

18. Lifecycle CURRENT

HealthcareCaseStatus CURRENT:

DRAFT

SCHEDULED

CANCELLED

No deben tratarse como CURRENT:

READY

IN_PROGRESS

RECONCILIATION_PENDING

RETURN_PENDING

DISPATCHED

COMPLETED

19. Status server-managed

status no debe ser libremente modificable desde DTOs.

Debe derivarse de business actions y reglas del service.

20. Semántica DRAFT / SCHEDULED

CURRENT:

scheduledStart absent
→ DRAFT

scheduledStart present
→ SCHEDULED

Mientras no exista Equipment Assignment ni otros workflows dependientes, planning PATCH puede permitir:

DRAFT ↔ SCHEDULED

según scheduledStart.

21. CANCELLED CURRENT

Cancel command produce:

DRAFT / SCHEDULED
↓
CANCELLED

CANCELLED es terminal en Foundation.

No existe comando CURRENT de reopen.

22. Advanced lifecycle TARGET

Healthcare podrá necesitar posteriormente semántica para:

procedure execution

post-procedure logistics

return

reconciliation

operational closure

Los nombres exactos del futuro lifecycle no están aprobados todavía.

23. Case Status ≠ Readiness

Debe mantenerse:

Case Status
≠
Case Readiness

Ejemplo conceptual:

Status:
SCHEDULED

Readiness:
NOT READY

sin convertir READY en status principal.

24. Readiness TARGET

Readiness responde:

¿Está este Case preparado para ejecutarse?

Debe considerarse inicialmente:

DERIVED

No como verdad manual independiente.

25. Readiness inputs TARGET

Podrá derivarse de hechos como:

schedule

Doctor / Hospital context

responsible User

Requirements

Preparation state

CaseKit

Equipment Assignment

Case Availability

blockers

según los workflows implementados.

26. No manual READY fiction

Debe evitarse:

User clicks READY

cuando siguen faltando requisitos reales.

La UI futura debe explicar:

what is missing

what blocks the Case

what requires attention

27. Title CURRENT

title es requerido.

Representa:

operational title / summary

Ejemplos válidos pueden describir la operación sin convertirse en sustituto
permanente de relaciones estructuradas CURRENT o futuras.

28. Title ≠ Doctor / Hospital relation

No debe utilizarse únicamente:

"Cirugía Dr. X Hospital ABC"

como sustituto definitivo de las relaciones CURRENT con Doctor y Hospital.

29. procedureDescription CURRENT

procedureDescription es opcional.

Representa:

operational procedure description

No un diagnóstico ni historia clínica.

30. No procedure taxonomy CURRENT

Foundation no introduce:

procedureType enum

surgeryType enum

specialty taxonomy

clinical taxonomy

Una capacidad reusable de Procedure Catalog permanece FUTURE si se justifica.

31. Scheduling CURRENT

HealthcareCase es propietario de su planificación temporal.

Campos CURRENT:

scheduledStart DateTime?

scheduledEnd DateTime?

32. Schedule invariants CURRENT

Debe mantenerse:

start null
end null
→ valid unscheduled Case

start present
end null
→ valid scheduled Case with unknown end/duration

start present
end present
→ valid only when end > start

start null
end present
→ invalid

33. Timestamp semantics

Los valores API deben utilizar timestamps ISO-8601 no ambiguos.

Persistencia utiliza:

DateTime

como instante absoluto.

Company.timezone puede proporcionar contexto operacional/display cuando corresponda.

34. Case owns schedule

Debe mantenerse:

HealthcareCase
→ schedule source of truth

Case Calendar
→ future Read Model

No:

CalendarEvent
→ independent source of truth for Case schedule

35. Planning update CURRENT

Existe:

PATCH /healthcare/cases/:caseId

para planeación del Case.

Campos editables CURRENT:

title

procedureDescription

scheduledStart

scheduledEnd

responsibleUserId

36. Partial PATCH semantics CURRENT

Debe mantenerse:

omitted / undefined
→ retain persisted value

explicit null where allowed
→ clear value

Los campos server-managed no deben aceptarse desde cliente.

37. Reschedule CURRENT

Modificar:

scheduledStart

scheduledEnd

sobre el mismo Case representa una reprogramación.

Debe mantenerse:

same operational occurrence
→ same HealthcareCase

No debe crearse un nuevo Case solamente porque cambió la fecha.

Reschedule preserva Doctor y Hospital salvo que el usuario cambie explícitamente
esas relaciones mediante PATCH.

38. Reschedule history TARGET

Actualmente no existe un historial formal de reprogramaciones.

Futuro:

old schedule

new schedule

actor

timestamp

reason?

podrá integrarse con Audit o historial especializado.

39. One occurrence → one Case

Como regla conceptual inicial:

Cada ocurrencia operacional relevante debe tener su propio HealthcareCase.

No debe reutilizarse un mismo Case durante meses para procedimientos distintos.

40. responsibleUser CURRENT

HealthcareCase Foundation implementa:

responsibleUserId
→ nullable
→ references User

El responsable operacional CURRENT se representa mediante User.

41. Technician initially maps to User

Debe mantenerse:

Technician
→ User acting in Healthcare

No crear en Foundation:

HealthcareTechnician identity

TECHNICIAN role

únicamente para representar responsabilidad operacional.

42. Authorization role ≠ operational function

Debe mantenerse:

User role
≠
Healthcare operational function

Un User puede actuar operacionalmente como Technician sin requerir una identidad duplicada.

43. Healthcare Technician Profile FUTURE

Si posteriormente se requieren atributos como:

certifications

specialties

territory

availability rules

puede existir un profile ligado a User.

No cambia la identidad principal CURRENT.

44. responsibleUser validation CURRENT

Cuando responsibleUserId se proporciona, backend debe validar:

exists

belongs to authenticated Company

is active

45. createdBy CURRENT

createdById:

required

derived from authenticated User

never accepted from client payload

46. Cancellation audit facts CURRENT

Cancel command administra:

cancelledAt

cancelledById

cancellationReason

Estos campos no deben establecerse mediante generic PATCH.

47. Cancellation endpoint CURRENT

Existe:

POST /healthcare/cases/:caseId/cancel

Create y PATCH aceptan `doctorId?`/`hospitalId?` nullable. Las cinco respuestas
conservan todos los campos Case y añaden ambos IDs más objetos compactos
`doctor`/`hospital`; ausencia se representa como ID y objeto `null`. Cancel
preserva las relaciones y devuelve la misma forma enriquecida sin cambiar su
DTO, validaciones, transición de estado ni audit de cancelación.

48. Cancellation source states CURRENT

Origen permitido:

DRAFT

SCHEDULED

Destino:

CANCELLED

49. Cancellation reason CURRENT

Cancel command requiere:

non-empty operational cancellationReason

No existe un segundo campo de cancellation notes aprobado para Foundation.

50. Cancellation preserves history

Un Case cancelado permanece en el sistema.

Debe mantenerse:

cancel
≠
delete

51. DELETE CURRENT

No existe:

DELETE /healthcare/cases/:caseId

como workflow normal.

Cancellation es la operación terminal soportada por Foundation.

51.1 C4-C2 Equipment Assignment release IMPLEMENTED / VALIDATED ON BRANCH

La primera transición válida de Case `DRAFT` o `SCHEDULED` a `CANCELLED` debe
liberar en la misma transacción todas las Equipment Assignments del Case que bajo
lock continúen `RESERVED`, incluyendo origins `DIRECT` y `REQUIREMENT`.

Cada release derivado conserva la fila histórica y persiste:

```text
releaseCause = CASE_CANCELLED
releasedById = cancelledById
releaseReason = cancellationReason persistida por el Case
releasedAt = cancelledAt
```

No se aplica normalización adicional a `releaseReason`; `cancelledAt` y
`releasedAt` comparten un timestamp único. Cero reservas elegibles es éxito.

La frontera usa una transacción y un `Prisma.TransactionClient`, con orden
`Company → Case → Assignments RESERVED por ID ASC`, revalidaciones tenant-scoped,
updates condicionales y rollback conjunto. Reutiliza primitivas internas de
Equipment Assignment y no llama al endpoint público de Manual Release.

Un Case ya `CANCELLED` conserva la semántica vigente: HTTP 409, cero writes y sin
reparación de Assignments históricas. C4-C2 no cambia la ruta, DTO, status HTTP,
respuesta pública directa, RBAC ADMIN/MANAGER, tenant isolation ni precedencia de
errores de Cancel.

Esta integración sólo termina reservas lógicas. No crea idempotency claims,
Inventory Movement, Return o Custody, ni cambia lifecycle/condition del
EquipmentAsset. La implementación está validada en rama y pendiente de
integración.

La evidencia de cierre técnico registra Jest focal 346/346 PASS; typecheck,
`lint:check`, Prettier focal, API build y `git diff --check` PASS; y 16/16 E2E
PostgreSQL/HTTP PASS sobre `zaping_spike_test`, con 26 tests skipped por filtro y
exit 0. La selección cubrió 15 escenarios C4-C2 y la regresión C4-C1 que preserva
`DIRECT`. El harness limita cleanup a los Company IDs del run, verifica conteos
cero y propaga sus fallos. La integración en `main` y el checkpoint integrado
final de HC-LOCK-04 permanecen pendientes.

52. Completion CURRENT

Actualmente:

COMPLETED
→ NOT IMPLEMENTED

y:

complete command
→ NOT IMPLEMENTED

53. Procedure ended ≠ Case complete

Debe mantenerse:

procedure occurred
≠
Case operationally closed

porque futuros workflows pueden mantener pendientes:

custody

Return

Inspection

Reconciliation

54. Operational closure ≠ commercial closure

Debe mantenerse:

Case operational closure
≠
Sale lifecycle

y:

Case operational closure
≠
Invoice / payment lifecycle

55. Cancellation after Dispatch TARGET

Cuando Case Logistics exista, cancelar un Case no deberá eliminar obligaciones ya creadas.

Futuro:

Case cancelled
+
existing custody
→ logistics obligations still require resolution

Esta regla no altera el comportamiento CURRENT de Foundation mientras Dispatch no exista.

56. Opportunity FUTURE

Opportunity puede representar una posibilidad comercial previa.

Actualmente:

Opportunity
→ FUTURE / optional

HealthcareCase no requiere Opportunity.

57. Direct Case is valid

Debe mantenerse válido:

Doctor / Hospital operational request
↓
HealthcareCase

sin crear una Opportunity artificial.

58. Case ≠ Opportunity

Debe mantenerse:

Opportunity
→ possibility

HealthcareCase
→ concrete operation requiring coordination

59. Commercial context CURRENT boundary

HealthcareCase Foundation no persiste todavía relaciones con:

Quote

Sale

SalesOrder

Delivery

Invoice

60. Sale CURRENT

ERP Core utiliza actualmente:

Sale

como modelo comercial vigente.

No existe hoy un handoff automático:

HealthcareCase
↓
Sale

como parte de Foundation.

61. SalesOrder / Delivery TARGET

ADR-011 define como arquitectura comercial futura:

SalesOrder
↓
Delivery

Por tanto:

SalesOrder
→ TARGET

Delivery
→ TARGET

No deben presentarse como relaciones CURRENT de HealthcareCase.

62. No single mandatory commercial ordering

En el futuro puede haber operaciones donde:

commercial commitment
↓
HealthcareCase

y otras donde:

HealthcareCase
↓
procedure / reconciliation
↓
commercial consequence

Healthcare no debe imponer un único orden universal.

63. Case does not own commercial totals

No debe almacenar copias permanentes como:

quoteTotal

saleTotal

invoiceTotal

si esos valores pertenecen a documentos ERP.

64. Doctor CURRENT backend relation

HealthcareCase puede relacionarse opcionalmente con Doctor mediante
`doctorId`. Create/PATCH validan el master activo con `id + companyId`; list,
detail, create, update y cancel devuelven contexto compacto. Un master que se
desactiva después permanece visible como referencia histórica.

65. Doctor ≠ Customer

Debe mantenerse:

Doctor
≠
Customer

66. Hospital CURRENT backend relation

HealthcareCase puede relacionarse opcionalmente con Hospital mediante
`hospitalId`, con la misma validación tenant-safe/active y response compacta.

67. Hospital ≠ Customer

Debe mantenerse:

Hospital
≠
Customer

68. Doctor / Hospital ownership V1

Doctor y Hospital son Company-scoped master data en V1. `companyId` se deriva
de la Company autenticada y toda relación cross-tenant está prohibida.

No existe global Doctor/Hospital directory en V1. La persistencia, API de
masters/affiliation y la integración backend de Case se gobiernan por
`DOCTORS_HOSPITALS.md` y `DOCTORS_HOSPITALS_TECHNICAL_DESIGN.md` y están
implementadas en backend y frontend hasta C7.

Ambas relaciones son opcionales. Un Case puede permanecer SCHEDULED sin Doctor
y/o Hospital porque Case Status ≠ Case Readiness.

69. Doctor / Hospital references and snapshots V1

No debe reemplazarse master data mediante campos permanentes como:

doctorName

hospitalName

dentro del Case.

El title continúa siendo únicamente resumen operacional.

V1 utiliza referencias a master data y no requiere `doctorNameSnapshot` ni
`hospitalNameSnapshot`. Las correcciones simples al master data deben reflejarse
en display. Snapshots inmutables permanecen FUTURE para documentos operacionales
o legales confirmados cuando el dominio correspondiente los justifique.

70. Customer TARGET

HealthcareCase podrá relacionarse con Customer cuando el contexto comercial lo requiera.

Actualmente:

customerId
→ DEFERRED

71. Customer not required CURRENT

No debe bloquearse HealthcareCase Foundation únicamente porque no se conozca:

who will be billed

72. Payer FUTURE

Payer es una frontera reconocida, pero no implementada.

Debe mantenerse:

Payer
≠
Customer

y:

Payer
→ FUTURE

73. Case Requirements — DOMAIN DISCOVERY COMPLETE / TARGET / NOT IMPLEMENTED

Case Requirements representa:

what the Case needs

Cada línea V1 incluye conceptualmente:

existing Product

integer requestedQty > 0

REQUIRED / BACKUP classification

optional line notes

manual sortOrder

Equipment needs y support material sólo se expresan mediante Products
existentes; notes conserva el contexto específico de la línea.

Estado actual:

```text
Domain discovery
→ COMPLETE / DOCUMENTED

Technical design
→ NOT STARTED / NOT APPROVED

Implementation
→ NOT IMPLEMENTED
```

`REQUIREMENTS.md` es la autoridad del dominio V1. Requirements expresa la
necesidad planeada de Products del Case; no reserva stock, no selecciona
Inventory/Equipment y no produce fulfillment por sí misma.

74. Requirements ≠ Preparation

Debe mantenerse:

Requirements
→ what is needed

Preparation
→ work performed to satisfy those needs

75. Requirements ≠ CaseKit

También:

Requirements
→ requested / needed

CaseKit
→ actual prepared set

76. Preparation TARGET

Preparation representa el trabajo previo para dejar el Case listo.

Puede incluir:

requirements review

availability checks

material picking

Equipment Assignment

CaseKit assembly

documentation

Actualmente:

Preparation
→ NOT IMPLEMENTED

77. Preparation eligibility TARGET

Un futuro workflow puede permitir Preparation cuando exista suficiente contexto para responder:

what Case

when

where

who is responsible

what is required

La obligatoriedad exacta de Doctor, Hospital, Customer o Payer deberá validarse por workflow.

78. Customer / Payer must not block preparation by default

Healthcare no debe imponer universalmente:

Customer required before Preparation

ni:

Payer required before Preparation

salvo política empresarial explícita.

79. CaseKit COMPLETE / MERGED

CaseKit representa el conjunto realmente preparado para el Case.

Actualmente:

CaseKit
→ HC-OPS-01A COMPLETE / MERGED — PR #50 — main@bb530e8 — Actual 27-sep-2026

La implementación aceptada permanece limitada a Create/Get/Add y al estado
`DRAFT`. La preparación de material `QUANTITY` es lógica y no reservante: no crea
`InventoryMovement` ni reserva o decrementa stock. Tampoco expone Update/Remove
Item, Dispatch, Custody, Return o Inspection.

La validación manual acreditó para MANAGER la creación del CaseKit, el estado
`DRAFT`, el banner no reservante, el agregado de Requirement `QUANTITY` y de
Equipment Assignment `RESERVED`, y el render correcto de Materials/Equipment. No
se registra validación manual de SALES.

HC-OPS-01A.1 — Draft Item Exclusion está COMPLETE / MERGED mediante PR #53 en
`main@54a5d79`, con Actual 28-sep-2026. Permite excluir de forma auditada un item `ACTIVE` sólo mientras el
CaseKit permanece `DRAFT`; conserva la fila `EXCLUDED`, actor, fecha y razón, y
nunca ejecuta hard delete. Un Case `CANCELLED` rechaza una exclusión nueva.

Add, duplicate detection y futuros cálculos de readiness/coverage consideran sólo
items `ACTIVE`. Los índices únicos por fuente se limitan a `ACTIVE`, por lo que la
misma Requirement o Assignment puede agregarse nuevamente tras una exclusión. La
mutación exige Idempotency-Key, Company-first y atomicidad de exclusión/auditoría/
claim. ADMIN, MANAGER y WAREHOUSE mutan; SALES conserva lectura.

El contrato completo, incluidos replay, errores, AC, DoR y DoD, está en
`CASE_KITS.md`, sección 232. No implementa PREPARED, update/restore/hard delete,
Dispatch/Custody/Return ni efectos sobre Inventory, stock o Assignments.

Evidencia de cierre: Prisma validate/generate PASS; API focal 36/36 y Web focal
12/12 PASS; TypeScript y ESLint API/Web, API build, Next.js build y
`git diff --check` PASS; harness PostgreSQL 2H completo 45/45 PASS, 0 skipped. La
validación manual acreditó como MANAGER la exclusión de un item `ACTIVE`, la
historia `EXCLUDED` con actor/fecha/razón, el re-agregado de la misma fuente y la
coexistencia de la fila histórica `EXCLUDED` con la nueva `ACTIVE`. No se registra
validación manual de SALES.

HC-OPS-01B — Preparation Confirmation & Readiness queda COMPLETE / VALIDATED / READY FOR FINAL REVIEW — UNCOMMITTED — DoD PASS, con DoR COMPLETE. El blocker previo de corrección de
items stale fue resuelto por HC-OPS-01A.1.

01B añade exclusivamente `PREPARED` y permite sólo `DRAFT -> PREPARED`. La primera
confirmación exige Case `SCHEDULED` con `scheduledStart + scheduledEnd`, ninguna
fuente `ACTIVE` inválida y cobertura completa de Requirements `ACTIVE + REQUIRED`:
QUANTITY exacta, suficientes Assignments `REQUIREMENT + RESERVED` para ASSET y
bloqueo de SERIALIZED. BACKUP ausente no bloquea; DIRECT no satisface Requirements.

La confirmación persiste actor/fecha una sola vez. Repetir sobre `PREPARED` retorna
HTTP 200 zero-write y preserva la auditoría. Requirement retire, Assignment
release/replace o Case cancel conservan estado y auditoría `PREPARED`, pero el
read-model derivado cambia a `preparationReadiness=BLOCKED`; no existe reemplazo
automático.

El contrato canónico completo de lifecycle, modelo, API, blockers, Company-first,
idempotencia, RBAC, UI, AC, DoR y DoD está en `CASE_KITS.md`, sección 233. 01B no
implementa reserva física, lotes/seriales, Dispatch/Custody/Return, reopen ni
mutación de contenido `PREPARED`. No se asignan SP, Forecast ni Commitment.

Confirm adquiere también row locks tenant-scoped de Product y EquipmentAsset de
items ACTIVE y relee el Kit antes de evaluar readiness/transicionar. Web vuelve a
consultar el Kit ante conflictos de readiness/estado y conserva el error; nunca
presenta readiness anterior si falla el refresh. DoD PASS y evidencia final en
[CASE_KITS, secciones 233.14–233.15](CASE_KITS.md). El estado completo/validado
corresponde al working tree sin commit, pendiente de revisión final; no afirma
merge, release ni deployment.

80. CaseKit ≠ JSON inside Case

No debe utilizarse permanentemente:

HealthcareCase.caseKitJson

como sustituto de un dominio CaseKit real si el workflow requiere lifecycle e integridad propios.

81. CaseKit cardinality para HC-OPS-01A

DEC-OPS01A-01 fija:

one logical HealthcareCaseKit

per HealthcareCase

Los contenedores físicos múltiples permanecen fuera de 01A y no cambian esta
cardinalidad lógica.

82. EquipmentAsset CURRENT

Equipment reutilizable utiliza:

EquipmentAsset

del ERP Core.

Debe mantenerse:

EquipmentAsset
→ CURRENT ERP Core identity

83. Equipment Assignment CURRENT

Healthcare necesita relacionar:

HealthcareCase
↔
EquipmentAsset

mediante un concepto de Assignment.

Actualmente:

Equipment Assignment
→ COMPLETE / MERGED — backend, availability, concurrency, parent integrations y
frontend C6-A–C6-E integrados

84. Equipment Assignment ≠ lifecycle

Debe mantenerse:

Equipment Assignment
≠
EquipmentLifecycle

No utilizar estados como:

ASSIGNED

IN_CUSTODY

para reemplazar la relación Healthcare.

85. Equipment Assignment ≠ Custody

Debe mantenerse:

Assignment
≠
Custody

Un Equipment puede estar asignado antes de ser entregado físicamente.

86. Case Availability

Case Availability V1 implementa una proyección derivada e informacional de
schedule, requirements, coverage, equipment y preparation. Reutiliza Equipment
Assignment Availability y CaseKit readiness sin almacenar un flag independiente
ni emitir un veredicto global de disponibilidad o readiness.

### 86.1 Contrato aprobado V1 — Case-level projection

**HC-CASE-AVL — Case Availability umbrella capability.**
**Estado: PARTIALLY IMPLEMENTED.** HC-CASE-AVL-R está
IMPLEMENTED / LOCAL DoD PASS / PR PENDING sobre `feat/hc-case-avl-r`, base HEAD
`d7ce3cade2302e4f2bc75388f2183fa2fc2eef5e`; implementación unstaged/uncommitted.
El contrato se aprobó en `docs/hc-case-availability-contract`, base
`25d6017cdedc0036cf981acc095a48151a856533`. COVERAGE-R COMPLETE / MERGED
(PR #63), COVERAGE-N COMPLETE / MERGED (PR #65), umbrella COVERAGE COMPLETE /
MERGED; M-HC1 OPEN. DEC-CASE-AVL-01/02/03 aprobadas por producto y registradas
como autoridad del contrato V1. DEC-C5-COV-01..06 permanecen sin cambios;
Coverage sigue informacional. Este cierre sincroniza documentación y evidencia
local; no declara R COMPLETE/MERGED ni release/deployment.

Identificadores canónicos aprobados por producto:

| Identificador | Capability / slice | Estado | Estimación |
|---|---|---|---|
| HC-CASE-AVL | Case Availability umbrella capability | PARTIALLY IMPLEMENTED | — |
| HC-CASE-AVL-R | Derived Case Availability Read — Backend | IMPLEMENTED / LOCAL DoD PASS / PR PENDING | TARGET 5 SP |
| HC-CASE-AVL-UI | Case Availability Summary — Frontend | DEFINED / BLOCKED BY HC-CASE-AVL-R MERGE | TARGET 3 SP |

HC-NEXT-03C3 y HC-NEXT-03B.1 corresponden a Equipment Assignment Availability,
no a este agregado. `CASE_AVAILABILITY.md` aparece como referencia futura en
documentos de dominio, pero no existe como archivo. Se usa esta sección existente
sin asignar Forecast, Commitment, Actual o fechas. La aprobación de identificadores
cierra la brecha de naming; el estado de implementación vigente es el de la tabla anterior. Los encabezados históricos
de CASES/CASE_KITS aún describen checkpoints antiguos de HC-OPS-01B; para su estado
merged prevalecen BOARD/ROADMAP (PR #56) y para semántica, código y tests actuales.

### 86.2 Evidencia y significado CURRENT

| Fuente inspeccionada | Hecho relevante |
|---|---|
| [ROADMAP §9.8](../../project/ROADMAP.md), [PROJECT_BOARD](../../project/PROJECT_BOARD.md) | HC-CASE-AVL PARTIALLY IMPLEMENTED; R IMPLEMENTED / LOCAL DoD PASS / PR PENDING; UI bloqueada por R MERGE. M-HC1 OPEN. Contrato aprobado y evidencia local en §86. |
| [ARCHITECTURE §50](../../architecture/ARCHITECTURE.md), [HEALTHCARE §54](HEALTHCARE.md), [DOMAIN_MODEL §60](DOMAIN_MODEL.md) | Availability contextual al Case/horario pertenece a Healthcare; custody, maintenance, calibration y turnaround son evolución cuando existan. |
| [EQUIPMENT ERP §49](../erp/EQUIPMENT.md), [evaluator Core](../../../app/api/src/equipment/equipment-availability.evaluator.ts) | Current Asset Availability usa lifecycle/condition; ACTIVE + GOOD no acredita disponibilidad contextual ni física para un Case. |
| [Case service](../../../app/api/src/healthcare/cases/healthcare-case.service.ts), schema y su spec | Sólo DRAFT/SCHEDULED/CANCELLED. scheduledStart basta para SCHEDULED; scheduledEnd puede faltar. End sin start y end <= start se rechazan. No COMPLETED/CLOSED actual. |
| [Requirements service](../../../app/api/src/healthcare/requirements/healthcare-requirements.service.ts), schema | ACTIVE/RETIRED y REQUIRED/BACKUP son ejes distintos. Retire libera reservas vinculadas; reactivar no implica reasignación. Sin catálogo de procedimiento no puede detectarse un Requirement que nunca fue declarado. |
| [Coverage design §34.5.3](EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md#3453-hc-next-03c5-coverage), [Coverage service](../../../app/api/src/healthcare/equipment-assignments/healthcare-equipment-coverage.service.ts), [repository](../../../app/api/src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository.ts) | R incluye Requirements ACTIVE con Product ASSET, tanto REQUIRED como BACKUP. nominal cuenta REQUIREMENT/RESERVED; efectivo exige Product compatible y Asset ACTIVE/GOOD. DIRECT/RELEASED/REPLACED no aportan coverage. |
| [Assignment availability helpers](../../../app/api/src/healthcare/equipment-assignments/healthcare-equipment-assignment-availability.ts), [service](../../../app/api/src/healthcare/equipment-assignments/healthcare-equipment-assignments.service.ts) | Ventana start-preBuffer/end+postBuffer; defaults 120/180 minutos, settings Company prevalecen. Solapamiento estricto: extremos adyacentes no colisionan. Horarios incompletos generan incertidumbre. |
| [Coverage availability helper/spec](../../../app/api/src/healthcare/equipment-assignments/healthcare-equipment-coverage-availability.ts), [Coverage service spec](../../../app/api/src/healthcare/equipment-assignments/healthcare-equipment-coverage.service.spec.ts) | Vacío false/null/[]; conflictFree false > null > true. fullyVerifiable no significa conflictFree. Overrides requieren identidad y ambas ventanas actuales; confirmación parcial no emite override agregado. Notes stale visibles; cantidades y certainty independientes. |
| [Kit readiness/helper](../../../app/api/src/healthcare/case-kits/healthcare-case-kit-readiness.ts), [spec](../../../app/api/src/healthcare/case-kits/healthcare-case-kit-readiness.spec.ts), [Kit service](../../../app/api/src/healthcare/case-kits/healthcare-case-kits.service.ts) | PASS/BLOCKED deriva elegibilidad para confirmar preparación lógica; PREPARED persiste actor/fecha, no disponibilidad física. Kit vacío scheduled sin REQUIRED puede PASS. PREPARED puede después BLOCKED. |
| [CASE_KITS](CASE_KITS.md), [CASE_LOGISTICS](CASE_LOGISTICS.md), [CASE_CALENDAR](CASE_CALENDAR.md) | Kit lógico no equivale a stock reservado ni custodia. Dispatch/Return/Custody no implementados; Calendar organiza el schedule, no crea otra verdad temporal. |

Antecedente de discovery en app/web/docs/scripts/public y README: Case Availability,
availability, readiness, ready, coverage, CaseKit, Preparation, dispatch, custody,
scheduledStart, scheduledEnd, fullyVerifiable y conflictFree. Se inspeccionaron
implementaciones, selectores, lifecycle y specs pertinentes; durante ese discovery
no se ejecutaron tests. La validación posterior de R se registra en §86.10.
Los conceptos TARGET en diseños amplios no se consideran capabilities CURRENT.

### 86.3 Definición canónica y dimensiones

V1 responde: «¿Qué evidencia actual de planificación, cobertura de equipo y
preparación lógica tiene este Case, qué falta y qué requiere revisión?».
Permite evaluar preparación material con los hechos disponibles; no certifica
que el material esté físicamente listo para el procedimiento. No hay fuentes
CURRENT de custodia, lotes/seriales preparados, traslado, esterilidad o turnaround
que permitan emitir esa certificación.

| Dimensión | Fuente | Clasificación V1 | Interpretación |
|---|---|---|---|
| Schedule | HealthcareCase scheduledStart/End | WARNING si incompleto; resto INFORMATIONAL | Completo exige ambos extremos; SCHEDULED no basta. No evaluar staffing ni scheduling engine. |
| Requirements | ACTIVE y type | INFORMATIONAL | Contar ACTIVE, REQUIRED/BACKUP de todos los tracking. Cero significa ausencia registrada, nunca «no necesarios». RETIRED fuera del resumen actual. |
| Coverage | R: PENDING/UNAVAILABLE/PARTIAL/COVERED | WARNING por déficit cuantitativo; COVERED INFORMATIONAL | Conservar counts por estado; no transformar déficit en gate. No sumar unidades de Products distintos como disponibilidad global. |
| Equipment | Todas las Assignments RESERVED del Case, REQUIREMENT y DIRECT; horarios/settings/overrides | WARNING por conflicto/incertidumbre | Conflicto confirmado permanece conflicto. RELEASED/REPLACED excluidas; sin filtro de elegibilidad de Coverage en esta población diagnóstica. |
| CaseKit / Preparation | Kit, items ACTIVE y readiness existente | INFORMATIONAL con blockers locales de preparación | BLOCKING sólo en confirm-preparation, como ya existe. No nuevo bloqueo Case/Dispatch. Ausencia explícita sin inferir aplicabilidad. |
| CoverageNotes | Notes activas de Requirements ASSET ACTIVE | INFORMATIONAL | Contar contexto; UNAVAILABLE sólo modifica quantityState a cero como R. Stale no resta coverage ni resuelve automáticamente. Historia via GET existente. |
| Case lifecycle | DRAFT/SCHEDULED/CANCELLED | INFORMATIONAL | CANCELLED identifica Case fuera de planificación vigente; lectura aún 200, sin convertirlo a AVAILABLE ni ocultar historial. |
| Custody/Dispatch/Return/stock físico | Sin fuentes operacionales implementadas | NOT PART OF V1 | No flags sintéticos que impliquen readiness física. |

**BLOCKING nuevo en Case Availability: ninguno.** Los blockers existentes del kit
se exponen únicamente bajo preparation y conservan alcance de confirm-preparation.
Un gate nuevo por Coverage/availability exige decisión explícita adicional y otro
scope; DEC-C5-COV-04 permanece intacta.

### 86.4 Modelo de estado aprobado

| Alternativa | Evaluación |
|---|---|
| A: AVAILABLE/PARTIALLY_AVAILABLE/UNAVAILABLE/UNKNOWN | No adoptada en V1: «parcial» mezcla déficit e incertidumbre y requiere precedencia nueva. |
| B: READY/NOT_READY/NOT_VERIFIABLE | No adoptada en V1: confunde confirmación de kit con veredicto material del Case. |
| C: dimensiones sin enum global | APPROVED — DEC-CASE-AVL-01: proyección derivada e informacional; cada dimensión conserva su semántica. |

Omitir availabilityState, blockers y fullyVerifiable de nivel raíz. Verificabilidad
permanece en equipment y se refiere exclusivamente al análisis temporal de la
población explícita, no al Case completo. Un Case puede tener coverage COVERED,
equipment fullyVerifiable=true/conflictFree=false y kit PREPARED/readiness BLOCKED.
V1 no colapsa estas dimensiones en un veredicto único. Un futuro veredicto requiere
otra decisión explícita sobre completitud, precedencia y reglas de bloqueo.
No AVAILABLE/PARTIALLY_AVAILABLE/UNAVAILABLE/READY/NOT_READY/NOT_VERIFIABLE canónico
de Case; UNAVAILABLE sigue siendo válido exclusivamente en Coverage/notes.

### 86.5 Endpoint implementado y public response V1 final

`GET /healthcare/cases/:caseId/availability`, siguiendo controllers Healthcare
con JWT, RolesGuard y ParseUUIDPipe, implementado por HC-CASE-AVL-R.
ADMIN/MANAGER/SALES/WAREHOUSE, como Coverage y CaseKit GET; Company sólo de JWT.
401 sin JWT, 403 rol no permitido, 400 UUID inválido, mismo 404 público para Case
missing/foreign; fallos persistence sanitizados. Sin body, query companyId,
Idempotency-Key o writes. Kit ausente no vuelve 404 un Case válido.

Ejemplo contractual: Case SCHEDULED con horario completo, sin Requirements,
reservas ni kit. Vacío no se interpreta como listo:

```json
{
  "caseId": "11111111-1111-4111-8111-111111111111",
  "caseStatus": "SCHEDULED",
  "schedule": {
    "scheduledStart": "2026-10-13T16:00:00.000Z",
    "scheduledEnd": "2026-10-13T18:00:00.000Z",
    "complete": true,
    "warnings": []
  },
  "requirements": {
    "activeCount": 0,
    "requiredCount": 0,
    "backupCount": 0
  },
  "coverage": {
    "requirementCount": 0,
    "coveredCount": 0,
    "partialCount": 0,
    "pendingCount": 0,
    "unavailableCount": 0,
    "activeNoteCount": 0
  },
  "equipment": {
    "reservedAssignmentCount": 0,
    "fullyVerifiable": false,
    "conflictFree": null,
    "warnings": []
  },
  "preparation": {
    "caseKitId": null,
    "status": null,
    "readiness": null
  }
}
```

Public contract: caseStatus enum CURRENT; schedule.complete boolean; timestamps
ISO UTC/null. Counts enteros >=0, inicializar todos, incluso a cero.
requirements.activeCount = requiredCount + backupCount, para todas las Requirements
ACTIVE, independientemente de tracking. coverage.requirementCount cuenta sólo la
población R: ACTIVE con Product ASSET, tanto REQUIRED como BACKUP.
coveredCount/partialCount/pendingCount/unavailableCount cuentan Requirements en
COVERED/PARTIAL/PENDING/UNAVAILABLE; su suma es requirementCount.
activeNoteCount suma notes activas de esa misma población, sin historial resuelto.
Coverage resume R, sin payload completo ni nueva matemática; desglose de tracking
y REQUIRED/BACKUP disponible mediante Requirements drill-down.
No afirmar revisión completa de Requirements sólo porque activeCount>0.
equipment.reservedAssignmentCount cuenta todas las reservas actuales del Case
del mismo tenant con origin REQUIREMENT o DIRECT. Excluir RELEASED/REPLACED;
no filtrar DIRECT ni aplicar el filtro de Asset elegible de quantitative Coverage.
Cada reserva participa en diagnóstico temporal con la semántica existente de
Assignment Availability. DIRECT puede cambiar fullyVerifiable, conflictFree y
warnings, pero jamás assignedQty ni cantidades de Requirement Coverage.
Sin reservas: fullyVerifiable=false, conflictFree=null, warnings=[]. Con reservas,
agregar verificabilidad con every y conflictFree false > null > true como R.
Los flags sólo describen diagnóstico temporal de esa población: no garantizan
aptitud física del Asset, cantidades suficientes ni preparación.

Con kit: caseKitId público, status DRAFT/PREPARED y readiness
`{status:"PASS"|"BLOCKED",blockers:[{code,requirementId?}]}`. Resumir blockers
deduplicando code+requirementId; detalle de item y auditoría en GET CaseKit.
Sin kit: tres null, no fabricar PASS/BLOCKED. PREPARED es confirmación histórica;
readiness se recalcula incluso si ya está PREPARED. No replicar items ni audit.
No exponer companyId, hashes, claims, FKs privados, lock internals o Prisma records.
caseId/caseKitId/requirementId son identidades públicas existentes para drill-down.

Warnings schedule: reutilizar INCOMPLETE_CASE_SCHEDULE con mensaje público
existente incluso si no hay Assignments. Equipment reutiliza orden estable de R:
INCOMPLETE_CASE_SCHEDULE, RELATED_RESERVATION_SCHEDULE_INCOMPLETE,
CURRENT_ASSIGNMENT_CONFLICT, CONFLICT_OVERRIDE_CONFIRMED. Deduplicar por code
dentro de cada dimensión; no añadir lista raíz que duplique ambos scopes.
Usar instancias de conflictos actuales, nunca OR de flags/warnings por Requirement.
OVERRIDE agregado sólo con al menos un conflicto y todos los conflictos evaluados
confirmados por identidad/ventanas exactas. No vuelve conflictFree=true.
Sin códigos nuevos EQUIPMENT_REQUIREMENT_UNCOVERED/PARTIAL, EQUIPMENT_CONFLICT,
EQUIPMENT_AVAILABILITY_UNVERIFIABLE o CASEKIT_NOT_READY: counts/flags/readiness
existentes explican esas situaciones. Blockers CASE_KIT_* conservan su significado.

### 86.6 Derivación, snapshot y reuse

Controller → Service → Repository → Prisma. Un snapshot RepeatableRead, como R,
con un solo TransactionClient para Case, Requirements, Product/Asset, Assignments,
reservas relacionadas del mismo tenant (incluidos otros Cases que comparten Asset),
settings de buffers, ConflictOverrides, CoverageNotes y Kit/items/fuentes readiness.
Conservar filtros CURRENT de reservas relacionadas y relaciones tenant-safe.
No Company advisory lock, FOR UPDATE, claims, auto-resolve, mutaciones de inventario,
snapshot persistido o flag nuevo en HealthcareCase. GET refleja hechos actuales
consistentes, no promete que permanezcan vigentes después de la respuesta.

R mantiene su propia transacción en findCoverage. Case Availability reutiliza
findCoverageInSnapshot con el tx compartido; no llama endpoints HTTP ni combina
GET independientes. El wrapper GET R y su contrato permanecen intactos.
Para quantitative Coverage, reusar applicableCoverageAssignments y deriveCoverageQuantities;
para ambas dimensiones, reusar
evaluateCoverageAssignment, buffers/window/overlap y aggregateRequirementAvailability.
Para equipment Case-level, el agregado opera sobre inputs reales de la población
aprobada (todas las RESERVED REQUIREMENT/DIRECT del Case); no sobre warnings ya
resumidos de Requirements (pierden cardinalidad
y confirmación parcial). No duplicar fórmula ni cambiar semántica de R/Assignment.
Un mismo Assignment se evalúa una vez en el Case-level summary; mismo Asset en
varias reservas conserva sus hechos de conflicto sin contar Assets como unidades
de Requirements distintas. No añadir certificación stock o Asset nueva.

CaseKitRepository ya admite tx en findKitByCase. KitService.get actualmente lee
Case y Kit por separado sin wrapper RepeatableRead: no reutilizar ese GET como
si fuera snapshot común. Usar repository con el tx compartido y el helper puro
evaluateHealthcareCaseKitReadiness; no reproducir sus reglas.
No evidencia de necesidad de persistencia V1: auditoría existe en fuentes de
commands y confirmación; auditoría de un futuro veredicto/autorización sería otra
capability. Errores de lectura no se convierten a counts cero o null silenciosos.

### 86.7 CaseKit: límites de la dimensión preparation

Readiness exige SCHEDULED y ambos extremos; valida items ACTIVE y omite EXCLUDED.
Sólo Requirements ACTIVE REQUIRED exigen cobertura: QUANTITY debe tener item con
cantidad exacta y sin warnings; ASSET debe contar suficientes items con Assignment
REQUIREMENT/RESERVED y Asset válido; SERIALIZED REQUIRED bloquea por unsupported.
BACKUP ausente no bloquea, pero un item BACKUP incluido inválido sí. Product
inactivo, Requirement retirado, exceso preparado y Assignment/Asset inválido
pueden bloquear. El helper no evalúa conflictos temporales ni stock físico.
Un Kit PREPARED puede pasar a readiness BLOCKED por cambios posteriores sin perder
auditoría/status. PASS no implica PREPARED; PREPARED no implica PASS vigente.
Estos resultados se muestran junto a equipment, sin convertir preparation en
segunda fórmula de coverage ni extrapolar sus blockers a Case/Dispatch.

### 86.8 Decisiones de producto aprobadas — autoridad V1

**DEC-CASE-AVL-01 — Multidimensional Case Availability V1 — APPROVED.**
Case Availability V1 es una proyección DERIVED, INFORMATIONAL a nivel Case.
No persiste un status general de availability/readiness, no expone un veredicto
canónico AVAILABLE/UNAVAILABLE/READY/NOT_READY y no introduce workflow gates para
Case, CaseKit, Dispatch o Custody. Cada dimensión conserva su semántica de dominio.
Un futuro veredicto general requiere una decisión de producto explícita separada
que defina completeness, precedence y blocking rules. No inferirlas en V1.
DEC-C5-COV-01..06 permanecen sin cambios; Coverage sigue informacional.

**DEC-CASE-AVL-02 — Case Equipment diagnostic population — APPROVED WITH EXACT DISTINCTION.**
Coverage conserva íntegramente COVERAGE-R: DIRECT nunca se añade a assignedQty
ni a quantitative Coverage. La dimensión EQUIPMENT diagnóstica evalúa Assignments
actuales RESERVED pertenecientes al Case de ambos origins: REQUIREMENT y DIRECT.
Excluir RELEASED y REPLACED. Su propósito es diagnóstico temporal, de conflicto
y verificabilidad, no cobertura de Requirements. Una reserva DIRECT puede afectar
equipment.fullyVerifiable, conflictFree y warnings sin aumentar jamás cantidades
de Requirement Coverage. Reusar la semántica existente de Assignment Availability;
no crear una segunda fórmula. La selección diagnóstica no se reduce a efectivos R.

**DEC-CASE-AVL-03 — Explicit absence without readiness inference — APPROVED.**
Representar explícitamente ausencia de Requirements y CaseKit. Cero Requirements
ACTIVE no significa «no equipment required», ready ni not applicable.
caseKitId=null no significa preparation ready, preparation not required ni not
applicable. V1 sólo reporta ausencia; no inventa semántica de aplicabilidad.

No quedan decisiones de producto ni identificadores pendientes para este contrato
V1. HC-CASE-AVL, HC-CASE-AVL-R y HC-CASE-AVL-UI están aprobados según §86.1;
su semántica se conserva y el estado vigente de implementación se registra en §86.1.

### 86.9 Slices aprobados y UI mínima pendiente

HC-CASE-AVL-R — Derived Case Availability Read — Backend:
IMPLEMENTED / LOCAL DoD PASS / PR PENDING — TARGET 5 SP.
HC-CASE-AVL-UI — Case Availability Summary — Frontend:
DEFINED / BLOCKED BY HC-CASE-AVL-R MERGE — TARGET 3 SP.
Son targets provisionales exclusivamente; sin fechas ni valores
FORECAST/COMMITMENT/ACTUAL asignados. Backend incluye reuse con tx compartido y contratos de
población/agregación; no separar persistence porque no hay estado nuevo persistido.

UI mínima futura en Case detail: lifecycle, schedule completo/incompleto, counts
de estados Coverage, conflictos/incertidumbre Equipment, kit status/readiness y
blockers locales, notes count; enlaces a Requirements, Coverage/notes, Assignments
y CaseKit. Etiquetar ausencia «sin información registrada»; sin badge global verde
ni CTA de Dispatch. Errores/refresh no deben conservar datos stale como vigentes.

La aceptación persistida de R valida la proyección integrada con HTTP/JWT reales,
dos tenants, horarios completos/incompletos, ACTIVE REQUIRED/BACKUP y RETIRED
excluidos; Coverage COVERED/PARTIAL/PENDING/UNAVAILABLE y notes activas/resueltas,
con comparación contra COVERAGE-R. Incluye RESERVED REQUIREMENT/DIRECT,
RELEASED/REPLACED excluidas, conflicto temporal con override vigente e
incertidumbre; DIRECT afecta Equipment y nunca cantidades Coverage. Kit/Items
persistidos acreditan readiness PASS/BLOCKED, EXCLUDED y ausencia de Kit;
cero Requirements se representa con counts cero. No hay claim de concurrencia.

### 86.10 HC-CASE-AVL-R — Local DoD / PR pending

**IMPLEMENTED / LOCAL DoD PASS / PR PENDING.** Snapshot RepeatableRead único,
TransactionClient compartido para todos los inputs materiales, reuse de
Coverage-R, Assignment Availability y evaluateHealthcareCaseKitReadiness sin
fórmulas duplicadas. Sin advisory lock, FOR UPDATE, writes o auto-resolution.
JSON compacto de cinco dimensiones, sin campos privados de persistencia.

Evidencia previa conservada, sin reruns durante este cierre:

- Focal inicial Availability/Coverage/Assignment/readiness: 202 tests / 10 suites PASS.
- Availability: 34 tests / 2 suites PASS; helpers puros C5-B: 94 tests / 4 suites PASS.
- Full API: 1786 tests / 108 suites PASS.
- lint:check, typecheck, build, Prisma validate/generate, focal noEmit,
  Prettier y git diff --check PASS; disabled-mode safe skip PASS.
- PostgreSQL HC-CASE-AVL-R: 1 suite / 1 test PASS, aproximadamente 27 s total.

Comando focal acreditado desde `app/api`:

```sh
npm run test:e2e -- --runInBand test/healthcare-case-availability.c5b.postgres.e2e-spec.ts
```

Suite: `HC-CASE-AVL-R HTTP/JWT persisted read (no concurrency claim)`.
Test: `projects owned persisted dimensions, isolates tenants and performs zero writes`.
Sólo DB dedicada `127.0.0.1:5434/zaping_spike_test`, rol aplicación `zaping_hc_c5b`.
ACL adicional: SELECT únicamente en HealthcareCaseKit y HealthcareCaseKitItem;
sin INSERT/UPDATE/DELETE ni otros write privileges de aplicación en esas tablas.
La ACL previa de CoverageNote permanece sin cambios. No implica migración ni
deployment productivo.

Harness C5-B existente, sin segundo harness. Operador/control acreditado crea y
limpia sólo fixtures propios; no representa autorización de aplicación ni
expansión de privilegios para setup. Cleanup: CaseKitItem → CaseKit → dependencias
existentes; sesiones desconocidas siguen rechazándose. Tras desconectar control,
checks finales de sesiones y zero-residue. Teardown acreditado:
`[control.disconnect] PASS`, `[concurrency.disconnect] PASS`.

Comparación persistida antes/después acredita zero-write en Case, Requirements,
Assignments, ConflictOverrides, CoverageNotes, CaseKit/Items, Assets e
IdempotencyRecord, además de Product/stock y settings. InventoryBatch y
InventoryMovement observados por control sin nuevos grants de aplicación.
Sin mutaciones de inventario ni resolución automática de notes.

Después del runtime, RUN_HC_C5B_POSTGRES_TESTS, HC_C5B_DATABASE_URL y
HC_C5B_OPERATOR_DATABASE_URL ausentes; los tres Test-Path devolvieron False.
Este cierre registra la evidencia suministrada, sin reejecutar gates ni conectar DB.
**Actividad DB durante este cierre: NONE.**
HC-CASE-AVL PARTIALLY IMPLEMENTED; UI DEFINED / BLOCKED BY HC-CASE-AVL-R MERGE;
M-HC1 OPEN. Siguiente acción: revisión humana → staging selectivo → commit → PR.
R permanece PR PENDING hasta merge; no se declara COMPLETE/MERGED.

87. Equipment conflict CURRENT

Equipment Assignment ya detecta:

same EquipmentAsset
+
overlapping Cases

Actualmente:

Equipment Assignment
✅

conflict detection
✅

88. Responsible User conflict TARGET

También podrá detectarse:

same responsible User
+
overlapping Cases

cuando el scheduling avanzado exista.

89. CaseDispatch TARGET

CaseDispatch representa futura transferencia de custodia para atender el Case.

Actualmente:

CaseDispatch
→ NOT IMPLEMENTED

90. Multiple Dispatches TARGET

Un Case podrá requerir:

initial Dispatch

additional Dispatch

La operación no debe asumir un único movimiento físico.

91. CaseDispatch ≠ Delivery

Debe mantenerse:

CaseDispatch
≠
commercial Delivery

92. CaseDispatch ≠ commercial OUT

También:

CaseDispatch
≠
commercial Inventory OUT

CaseDispatch representa custodia temporal, no disposición comercial definitiva.

93. CaseReturn TARGET

Un mismo Case podrá requerir uno o más Returns.

Actualmente:

CaseReturn
→ NOT IMPLEMENTED

94. Returned ≠ automatically available

Debe mantenerse:

Returned
≠
Automatically Available

cuando exista necesidad de Inspection.

95. Returned-material inspection TARGET

Healthcare podrá requerir inspección de material retornado.

Para EquipmentAsset, cuando corresponda, debe reutilizar:

EquipmentInspection

del ERP Core.

96. Reconciliation TARGET

Reconciliation determina si todas las obligaciones logísticas del Case fueron explicadas.

Actualmente:

Reconciliation
→ NOT IMPLEMENTED

97. Reconciliation invariant

Debe mantenerse conceptualmente:

Dispatched
=
Returned
+
Consumed
+
Unresolved

98. Unresolved derived

Preferencia:

Unresolved
→ derived

No una cantidad manual independiente que pueda contradecir Dispatch / Return / Consumption.

99. Unresolved blocks normal closure

Debe mantenerse:

Unresolved > 0
→ normal logistical closure blocked

sin obligar todavía a un status específico como RECONCILIATION_PENDING.

100. Closure TARGET

En el futuro el cierre operacional deberá considerar:

all dispatched quantities resolved

Equipment custody resolved

required inspections completed

blocking discrepancies resolved

La regla exacta se definirá cuando existan esos dominios.

101. Case does not mutate stock directly

Nunca:

HealthcareCaseService
↓
product.stock -= quantity

HealthcareCase coordina la operación.

Inventory conserva ownership sobre las consecuencias físicas.

102. Inventory/Custody architecture boundary

Healthcare requerirá una forma segura de representar:

availability

physical positioning

custody

double-use prevention

La solución técnica exacta sigue siendo una decisión futura de Inventory/Healthcare.

No debe fijarse aquí como InventoryLocation/TRANSFER ya implementado.

103. No double decrement

Debe mantenerse:

same physical inventory
→ never decremented twice

por confundir:

custody

con:

commercial disposition

104. API CURRENT

Healthcare Case Foundation implementa:

POST /healthcare/cases

GET /healthcare/cases

GET /healthcare/cases/:caseId

PATCH /healthcare/cases/:caseId

POST /healthcare/cases/:caseId/cancel

Create/PATCH aceptan IDs nullable; todas las respuestas incluyen los IDs y el
contexto compacto Doctor/Hospital. La validación de replacements ocurre dentro
de la transacción, Doctor antes que Hospital, y no consulta affiliation.

105. API NOT CURRENT

No existe:

DELETE /healthcare/cases/:caseId

complete command

reopen command

start command

Equipment Assignment API

Dispatch API

Return API

Reconciliation API

106. Create transaction CURRENT

Create Case ejecuta dentro de una sola transacción:

creator validation

responsible User validation when supplied

selected Doctor validation by id + companyId + active, when supplied

selected Hospital validation by id + companyId + active, when supplied

CompanySequence folio allocation

HealthcareCase create

107. Read CURRENT

GET /healthcare/cases
→ tenant scoped
→ createdAt DESC

GET /healthcare/cases/:caseId
→ id + companyId

Las relaciones Doctor/Hospital se cargan en el mismo query mediante selects
acotados; no hay N+1 ni exposición de notes, contactos, searchKey o affiliation.

Missing o cross-tenant devuelve:

Caso no encontrado

según el contrato actual.

108. RBAC CURRENT

La implementación documentada utiliza roles explícitos.

CURRENT:

ADMIN
→ create / read / edit / cancel

MANAGER
→ create / read / edit / cancel

SALES
→ create / read / edit

WAREHOUSE
→ read

No existe:

TECHNICIAN role

agregado específicamente para Case Foundation.

109. Permission model TARGET

Permisos futuros pueden evolucionar hacia capacidades más granulares como:

healthcare.cases.read

healthcare.cases.create

healthcare.cases.update

healthcare.cases.schedule

healthcare.cases.assign

Los nombres definitivos deben coordinarse con la arquitectura RBAC.

110. Backend authority

Frontend puede facilitar el workflow.

Backend debe seguir siendo autoridad para:

tenant

authorization

status

schedule

responsible User

Doctor / Hospital relationships

future logistics invariants

111. Case create idempotency CURRENT debt

Actualmente:

same logical create request submitted twice
→ may create two Cases
→ may consume two folios

Esto es:

request idempotency not implemented

No es un bug del sequence allocator.

112. Idempotency future requirement

Además del create CURRENT, acciones críticas futuras como:

confirm Dispatch

confirm Return

confirm Reconciliation

deberán ser duplicate-safe.

113. Concurrency CURRENT

La asignación de folio utiliza infraestructura transaccional.

Cancel utiliza validación de estado y mutación condicional según el comportamiento documentado.

Planning concurrency Foundation es aceptable para el alcance actual.

114. Concurrency TARGET

Cuando existan:

Assignment

Case Availability

conflict-sensitive reschedule

será necesaria revalidación más fuerte.

Puede evaluarse:

updatedAt

version

locking / transactional checks

según el riesgo real.

115. Automated validation summary

La validación automatizada registrada cubre:

HealthcareCaseService

controller

DTO contracts

folio allocation

tenant-scoped access

planning updates

Doctor/Hospital assign/change/clear y preserve-on-omission

tenant-safe active-master validation y contexto histórico inactivo

cancellation lifecycle

backend regression

Los snapshots cuantitativos pertenecen a:

PROJECT_BOARD.md

CHANGELOG.md

116. Manual QA summary

La evidencia manual registrada validó de forma resumida:

sequential Case folios

create

detail

list

DRAFT → SCHEDULED

reschedule

invalid schedule rejection

SCHEDULED → DRAFT by clearing schedule

reschedule again

cancel

terminal CANCELLED protection

cancellation audit preservation

117. QA limitations CURRENT

Permanece pendiente:

real second-Company manual cross-tenant QA

real simultaneous concurrent cancellation race QA

Automated tests sí cubren tenant-scoped queries y conditional cancellation behavior.

118. Handoff to UX TARGET

No existe todavía frontend Healthcare.

La futura UI deberá consumir el Foundation existente sin duplicar lifecycle en frontend.

119. Case Calendar TARGET

CURRENT:

Case schedule data
✅

TARGET:

Calendar UI

Calendar Read Model

filters

readiness context

conflict detection

120. Case 360 TARGET

La futura vista Case 360 podrá presentar:

Case identity

Schedule

Actors

Requirements

Preparation

Equipment Assignment

CaseKit

Dispatch

Return

Reconciliation

Commercial context

Timeline

Actualmente:

Case 360
→ NOT IMPLEMENTED

121. Case 360 primary action

Debe mantenerse como principio UX futuro:

one clear primary action
+
contextual secondary actions

Los CTAs exactos deben derivarse del lifecycle real implementado.

No deben fijarse ahora usando estados todavía inexistentes.

122. Missing information vs blocker

Case 360 futuro deberá distinguir:

missing information

de:

operational blocker

Ejemplo:

Customer pending
→ informational

Required Equipment unavailable
→ blocker

cuando esas relaciones existan.

123. Dashboard TARGET

Healthcare Dashboard podrá consumir Read Models como:

Cases today

Cases tomorrow

Cases requiring attention

availability conflicts

pending reconciliation

Actualmente:

Healthcare Dashboard widgets
→ NOT IMPLEMENTED

124. Search FUTURE

Global Search futuro podrá localizar Case por:

folio

Doctor

Hospital

responsible User

cuando ese Global Search se implemente, reutilizando las relaciones CURRENT ya
disponibles.

125. Notifications FUTURE

Candidatos:

Case tomorrow requires attention

responsible User conflict

Equipment conflict

Case rescheduled

Case cancelled

reconciliation pending

Actualmente Notifications no es una dependencia CURRENT de Cases.

126. Mobile FUTURE

HealthcareCase es candidato fuerte para experiencia móvil.

Prioridades futuras:

Today's Cases

Case details

CaseKit

Custody

Return

Reconciliation

127. Offline FUTURE

Trabajo hospitalario puede justificar soporte offline.

No pertenece al alcance CURRENT ni al primer cierre Healthcare.

128. Attachments FUTURE

HealthcareCase podrá relacionarse posteriormente con documentos operativos.

Ejemplos:

hospital instructions

commercial authorization

photos of returned Equipment

PDF documents

Debe existir una estrategia transversal de documentos antes de almacenar referencias arbitrarias.

129. Attachment security

Todo archivo Healthcare futuro debe respetar:

tenant

permissions

data minimization

security

retention

130. Cross-tenant invariant

Todo Case pertenece a una Company.

Debe mantenerse:

Authenticated User
↓
Company
↓
HealthcareCase

131. Cross-tenant relationships TARGET

Nunca:

Case Company A
→ Product Company B

Case Company A
→ EquipmentAsset Company B

Case Company A
→ responsible User Company B

Y, cuando Doctor/Hospital existan, deberá preservarse la frontera tenant definida para esos modelos.

132. Audit TARGET

Acciones candidatas futuras:

case.created

case.updated

case.scheduled

case.rescheduled

case.responsible_user_changed

case.cancelled

y posteriormente eventos logísticos.

Actualmente no existe una plataforma transversal completa de Audit.

133. Audit ≠ domain history

Debe mantenerse:

Audit
≠
Inventory history

Audit
≠
Custody history

Audit
≠
Case Timeline

134. Case Timeline TARGET

Case 360 podrá combinar hechos de:

Case

future logistics

future commercial links

future Audit

como Read Model cronológico.

Timeline no sustituye las fuentes de dominio.

135. CURRENT technical debt

Permanece abierto:

Case create request idempotency

real manual second-Company cross-tenant QA

real simultaneous cancellation-race QA

formal reschedule history / audit

136. TARGET Healthcare Case capabilities

Después de C7, Doctor/Hospital y sus selectors son CURRENT en backend/frontend.
Healthcare evolucionará además hacia:

Requirements

Equipment Assignment

Case Availability

Preparation

Dispatch / Custody

Return

CaseKit / Maletín

Calendar

Case 360

137. FUTURE Case capabilities

Posteriormente pueden incluirse:

Opportunity integration

Payer / Insurance

Procedure Catalog

multi-technician participation

attachments

notifications

mobile / offline

advanced analytics

AI assistance

138. Roadmap Healthcare aprobado

La secuencia de implementación de referencia, cuyo tramo Hospital/Doctor C1-C7
ya está CLOSED / MERGED y cuya acceptance automatizada y manual C8 está PASS y
CLOSED / MERGED / ACCEPTED, es:

Hospital / Doctor
↓
Requirements
↓
Equipment Assignment
↓
Case Availability
↓
architecture gate for physical logistics
↓
Dispatch / Custody
↓
Return / Reconciliation
↓
CaseKit / Maletín
↓
Calendar
↓
Case 360
↓
Mobile technician experience

Este es un orden de implementación.

No representa necesariamente el orden temporal de cada Case real.

El architecture gate de logística física no bloquea Hospital / Doctor,
Requirements, Equipment Assignment o Case Availability. Los workflows
posteriores requieren slices propios.

139. Project sequence global

La progresión vigente es:

ERP Core V1
→ CLOSED / ACCEPTED

M-HC1 — Healthcare Operations Foundation
→ IN PROGRESS — P1

HC-NEXT-01C1 / C2 / C3 / C4 / C5 / C6 / C7
→ CLOSED / MERGED

HC-NEXT-01C8
→ CLOSED / MERGED / ACCEPTED — AUTOMATED + MANUAL ACCEPTANCE PASS

HC-NEXT-01
→ CLOSED / ACCEPTED

Los workflows posteriores requieren slices propios.

140. Implementation authority boundary

El diseño de dominio original no autorizó Prisma por sí solo. El technical
design aprobado y los slices C1-C4 posteriores sí implementaron los modelos,
APIs y relaciones Case de Doctor/Hospital. Este documento continúa sin
autorizar por sí solo:

Requirements models

Equipment Assignment models

CaseKit models

Dispatch models

Return models

Reconciliation models

advanced Case statuses

Cada implementación requiere su propio diseño técnico y gate.

141. Estado consolidado CURRENT

HealthcareCase model
✅

HealthcareCaseStatus
DRAFT / SCHEDULED / CANCELLED
✅

UUID identity
✅

CASE-* folio
✅

CompanySequence
✅

title
✅

procedureDescription?
✅

scheduledStart?
✅

scheduledEnd?
✅

responsibleUserId?
✅

doctorId? / hospitalId?
✅

compact Doctor / Hospital context in create/list/detail/update/cancel
✅

Case Doctor/Hospital selectors, quick-create and duplicate-review confirmation
✅ C7 WEB

createdById
✅

cancellation audit facts
✅

create/list/detail
✅

planning PATCH
✅

cancel
✅

tenant-scoped backend
✅

RBAC
✅

no DELETE
✅

no clinical/patient fields
✅

142. Estado consolidado TARGET

Case Requirements — DOMAIN DISCOVERY COMPLETE / NOT IMPLEMENTED

Equipment Assignment

Case Availability

Preparation

CaseKit

CaseDispatch / Custody

CaseReturn

returned-material inspection

Reconciliation

advanced operational lifecycle

Readiness

Calendar UI

Case 360

143. Estado consolidado FUTURE

Opportunity

Payer / Insurance

Procedure Catalog

multi-technician support

advanced attachments

Notifications

Mobile

Offline

Analytics

AI

144. Invariantes principales

HealthcareCase
→ one operational occurrence

HealthcareCase
≠
Opportunity

HealthcareCase
≠
Quote

HealthcareCase
≠
Sale

HealthcareCase
≠
SalesOrder

HealthcareCase
≠
Delivery

HealthcareCase
≠
Invoice

HealthcareCase
≠
Clinical Record

Doctor
≠
Customer

Hospital
≠
Customer

Payer
≠
Customer

Technician
→ User initially

Case Status
≠
Readiness

SCHEDULED
≠
READY

Requirements
≠
Preparation

Requirements
≠
CaseKit

EquipmentAsset
→ CURRENT ERP Core

Equipment Assignment
≠
EquipmentLifecycle

Equipment Assignment
≠
Custody

CaseDispatch
≠
Delivery

CaseDispatch
≠
commercial Inventory OUT

CaseReturn
≠
Commercial Return

Returned
≠
Automatically Available

Unresolved
→ derived

Unresolved logistics
→ blocks normal operational closure

HealthcareCase
→ never directly mutates Product.stock

same physical inventory
→ never decremented twice

cross-tenant Case relationships
→ forbidden

Doctor / Hospital
→ Company-scoped master data in V1

Doctor / Hospital relations
→ optional CURRENT backend integration; frontend selectors remain TARGET

inactive Doctor / Hospital
→ historical Case relationship preserved

145. Anti-patrones

Case for every lead

No crear HealthcareCase cuando todavía existe únicamente una posibilidad comercial.

Opportunity required forever

No obligar a crear Opportunity cuando ya existe una operación concreta que coordinar.

Case as clinical record

No agregar información clínica innecesaria.

Duplicate Technician identity

No crear una identidad paralela desconectada de User sin necesidad de dominio.

Customer required too early

No bloquear la operación porque todavía no se sabe quién será facturado.

Doctor/Hospital as free-text permanent truth

No usar doctorName / hospitalName permanentes como sustituto del master data
CURRENT de Doctor/Hospital.

One giant Case table

No guardar todos los Requirements, Dispatches, Returns, Equipment y Billing dentro de HealthcareCase.

READY as manual fiction

No marcar manualmente un Case listo cuando faltan requisitos reales.

Advanced status documented as CURRENT

No utilizar:

IN_PROGRESS

RECONCILIATION_PENDING

COMPLETED

como contrato CURRENT.

Schedule only in Calendar

No crear una fuente paralela del schedule fuera del Case.

New Case on reschedule

No crear un Case nuevo únicamente porque cambió la fecha.

Delete cancelled Case

No eliminar Case para limpiar la agenda.

Complete after procedure only

No asumir que el Case está cerrado cuando pueden quedar obligaciones logísticas.

Case completion = invoice

No acoplar cierre operacional con facturación/pago.

Direct stock mutation

No modificar Product.stock directamente desde HealthcareCase.

Duplicate commercial domains

No crear:

HealthcareSale

HealthcareDelivery

HealthcareInvoice

sin necesidad.

146. Relación con HEALTHCARE.md

HEALTHCARE.md gobierna:

vertical boundaries

CURRENT / TARGET / FUTURE separation

general Healthcare workflow

CASES.md gobierna:

HealthcareCase Foundation

Case lifecycle CURRENT

Case operational behavior

147. Relación con DOMAIN_MODEL.md

DOMAIN_MODEL.md gobierna:

cross-domain ownership

entity boundaries

derived concepts

architectural candidates

CASES.md no debe aprobar por sí solo nuevos modelos de Inventory, Equipment o Logistics.

148. Relación con ERP Core

HealthcareCase utiliza o podrá relacionarse con Core sin duplicarlo.

Ejemplos:

User

Customer

Product

Inventory

EquipmentAsset

Quote

Sale

y en TARGET:

SalesOrder

Delivery

149. Relación con Equipment

CURRENT:

EquipmentAsset
→ ERP Core

TARGET:

Case Equipment Assignment
→ Healthcare

150. Relación con Inventory

Inventory conserva la verdad física general.

HealthcareCase coordina el contexto operacional.

Healthcare Case Foundation no modifica stock.

151. Relación con Dashboard

Healthcare Dashboard podrá consumir estado/readiness de Cases.

Dashboard no gobierna lifecycle de HealthcareCase.

152. ADR relacionados

ADR-001 — Multi-Tenant

ADR-002 — Inventory Movements

ADR-004 — UUID

ADR-005 — Layered Architecture

ADR-006 — API First

ADR-007 — RBAC

ADR-008 — Documentation First

ADR-009 — Modular Monolith

ADR-011 — SalesOrder + Delivery

ADR-012 — Entity Lifecycle

ADR-013 — Inventory Custody & Case Logistics

153. Documentos relacionados

docs/modules/healthcare/HEALTHCARE.md

docs/modules/healthcare/DOMAIN_MODEL.md

docs/modules/healthcare/DOCTORS_HOSPITALS.md

docs/modules/erp/CUSTOMERS.md

docs/modules/erp/PRODUCTS.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/QUOTES.md

docs/modules/erp/SALES.md

docs/modules/erp/DASHBOARD.md

docs/product/ZAPING_WAY.md

docs/engineering/API_GUIDELINES.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md

docs/modules/healthcare/REQUIREMENTS.md

Documentos especializados futuros pueden incluir:

EQUIPMENT_ASSIGNMENT.md

CASE_AVAILABILITY.md

CASE_KITS.md

CASE_LOGISTICS.md

CASE_CALENDAR.md

154. Fuente de verdad

CASES.md
→ HealthcareCase Foundation
→ CURRENT lifecycle
→ Case behavior

HEALTHCARE.md
→ Healthcare vertical boundaries

DOMAIN_MODEL.md
→ cross-domain ownership / relationships

DOCTORS_HOSPITALS.md
→ Doctor / Hospital V1 domain specification
→ tenant ownership, lifecycle and affiliation
→ HealthcareCase relationship invariants

schema.prisma
→ CURRENT persistence only

backend
→ CURRENT Case API / behavior

tests
→ validated behavior

PROJECT_BOARD.md
→ active implementation state / debt

CHANGELOG.md
→ historical implementation evidence

155. Principio final

Healthcare Case debe responder CURRENT:

¿Qué operación estamos coordinando?

¿Cuál es su identidad?

¿Cuál es su estado de planeación?

¿Cuándo está programada?

¿Quién es responsable?

¿Fue cancelada?

Y debe evolucionar para responder TARGET:

¿Qué requiere?

¿Está preparada?

¿Qué Equipment fue asignado?

¿Qué salió bajo custodia?

¿Qué regresó?

¿Qué se utilizó?

¿Qué quedó pendiente?

¿La logística quedó reconciliada?

sin confundir:

operation
with
opportunity

status
with
readiness

custody
with
commercial fulfillment

operational closure
with
billing/payment

HealthcareCase es el root operacional de la vertical. Foundation ya proporciona identidad, planeación, responsabilidad y cancelación; los futuros dominios Healthcare deben conectarse a ese root sin convertirlo en una tabla gigante ni adelantar lifecycle, logística o información clínica que todavía no existen.
