Healthcare Cases — Zaping

Módulo: Healthcare Cases
Producto: Zaping Healthcare
Versión: 1.1.0
Estado: Aprobado
Estado de implementación: CASE FOUNDATION IMPLEMENTED / VALIDATED — OPERATIONAL CASE WORKFLOWS TARGET
Última actualización: 2026-08-27
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

La evolución TARGET permitirá que el Case coordine además:

Doctor / Hospital

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

Doctor relation

Hospital relation

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

Ejemplos válidos pueden describir la operación sin convertirse en sustituto permanente de relaciones estructuradas futuras.

28. Title ≠ Doctor / Hospital relation

No debe utilizarse únicamente:

"Cirugía Dr. X Hospital ABC"

como sustituto definitivo de futuras relaciones con Doctor y Hospital.

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

64. Doctor TARGET

HealthcareCase podrá relacionarse con Doctor cuando Doctor master data exista.

Actualmente:

doctorId
→ DEFERRED

65. Doctor ≠ Customer

Debe mantenerse:

Doctor
≠
Customer

66. Hospital TARGET

HealthcareCase podrá relacionarse con Hospital cuando Hospital master data exista.

Actualmente:

hospitalId
→ DEFERRED

67. Hospital ≠ Customer

Debe mantenerse:

Hospital
≠
Customer

68. Doctor / Hospital ownership TBD

La estrategia tenant de Doctor/Hospital debe decidirse antes de implementación.

No debe asumirse todavía un modelo global o Company-owned definitivo sin esa decisión.

69. Do not persist Doctor/Hospital as permanent text truth

No debe reemplazarse master data futuro mediante campos permanentes como:

doctorName

hospitalName

dentro del Case.

El title continúa siendo únicamente resumen operacional.

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

73. Case Requirements TARGET

Case Requirements representa:

what the Case needs

Puede incluir conceptualmente:

material

quantity

Equipment need

support material

special logistics context

Actualmente:

Requirements
→ NOT IMPLEMENTED

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

79. CaseKit TARGET

CaseKit representa el conjunto realmente preparado para el Case.

Actualmente:

CaseKit
→ NOT IMPLEMENTED

80. CaseKit ≠ JSON inside Case

No debe utilizarse permanentemente:

HealthcareCase.caseKitJson

como sustituto de un dominio CaseKit real si el workflow requiere lifecycle e integridad propios.

81. CaseKit cardinality TBD

No se fija todavía:

one CaseKit

multiple CaseKits

como cardinalidad Prisma.

La estructura se decidirá en el slice correspondiente.

82. EquipmentAsset CURRENT

Equipment reutilizable utiliza:

EquipmentAsset

del ERP Core.

Debe mantenerse:

EquipmentAsset
→ CURRENT ERP Core identity

83. Equipment Assignment TARGET

Healthcare necesita relacionar:

HealthcareCase
↔
EquipmentAsset

mediante un concepto de Assignment.

Actualmente:

Equipment Assignment
→ NOT IMPLEMENTED

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

86. Case Availability TARGET

La futura disponibilidad Healthcare podrá considerar:

Equipment lifecycle

Equipment condition

active Assignment

schedule overlap

other blockers

sin almacenar un flag contradictorio independiente.

87. Equipment conflict TARGET

La futura Calendar/Case Availability puede detectar:

same EquipmentAsset
+
overlapping Cases

Actualmente:

Equipment Assignment
❌

conflict detection
❌

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

CompanySequence folio allocation

HealthcareCase create

107. Read CURRENT

GET /healthcare/cases
→ tenant scoped
→ createdAt DESC

GET /healthcare/cases/:caseId
→ id + companyId

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

future relationships

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

cuando esas relaciones existan.

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

Después del cierre ERP Core V1, Healthcare evolucionará progresivamente hacia:

Doctor / Hospital

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

La secuencia de implementación de referencia es:

Hospital / Doctor
↓
Requirements
↓
Equipment Assignment
↓
Case Availability
↓
Dispatch / Custody
↓
Return
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

139. Project sequence global

Healthcare specialization se expande después de:

H8A
Documentation Synchronization

↓

H8B
Full Automated Regression / Technical Health

↓

UX-B.6
Full ERP End-to-End QA

↓

ERP Core V1 Closure

↓

Healthcare specialization

140. No Prisma expansion during H8

Este documento no autoriza durante H8:

Doctor / Hospital models

Requirements models

Equipment Assignment models

CaseKit models

Dispatch models

Return models

Reconciliation models

advanced Case statuses

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

Doctor / Hospital relationships

Case Requirements

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

No usar doctorName / hospitalName permanentes como sustituto de master data futuro.

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

Documentos especializados futuros pueden incluir:

DOCTORS_HOSPITALS.md

CASE_REQUIREMENTS.md

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
