Healthcare Domain Model — Zaping

Producto: Zaping Healthcare
Documento: Modelo de dominio transversal
Versión: 1.2.0
Estado: Aprobado
Estado de implementación: HEALTHCARE CASE FOUNDATION IMPLEMENTED / VALIDATED — BROADER DOMAIN TARGET / FUTURE
Última actualización: 2026-08-27
Responsable: Zaping Healthcare Team

1. Propósito

Este documento consolida el modelo de dominio transversal de Zaping Healthcare.

Su objetivo es distinguir con claridad:

qué existe actualmente

qué pertenece al ERP Core

qué pertenece a Healthcare

qué conceptos son TARGET

qué conceptos permanecen FUTURE

qué información debe derivarse

qué decisiones técnicas siguen pendientes

Este documento no sustituye las especificaciones especializadas de cada módulo.

Funciona como mapa transversal de ownership, relaciones e invariantes.

2. Principio arquitectónico

Zaping Healthcare se construye como vertical sobre Zaping ERP Core.

ERP Core
↓
provides shared business capabilities

Healthcare
↓
adds specialized operational workflows

La dependencia correcta es:

Healthcare
↓ uses
ERP Core

No:

ERP Core
↓ depends on
Healthcare

3. CURRENT vs TARGET vs FUTURE

Este documento utiliza cuatro categorías.

CURRENT

Capacidades implementadas y validadas.

TARGET

Conceptos funcionales aprobados como dirección, pero todavía no implementados.

FUTURE

Capacidades posteriores que no pertenecen al primer slice Healthcare operativo.

ARCHITECTURAL CANDIDATE

Soluciones técnicas posibles que requieren un ADR o diseño específico antes de considerarse aprobadas.

4. CURRENT — ERP Core utilizado por Healthcare

Healthcare reutiliza actualmente capacidades ERP Core como:

Company

User

Customer

Product

InventoryBatch

InventoryMovement

Quote

Sale

Purchase

PurchaseReceipt

EquipmentAsset

EquipmentInspection

Debe mantenerse:

EquipmentAsset
→ CURRENT ERP Core

No:

EquipmentAsset
→ Healthcare-only model

5. CURRENT — Healthcare Case Foundation

Actualmente existe:

HealthcareCase
✅

con:

folio

Company relation

responsible User relation

schedule context

HealthcareCaseStatus

DRAFT

SCHEDULED

CANCELLED

tenant-scoped API

RBAC

create

list

detail

update

cancel

6. API CURRENT

Healthcare Case Foundation implementa:

POST  /healthcare/cases

GET   /healthcare/cases

GET   /healthcare/cases/:caseId

PATCH /healthcare/cases/:caseId

POST  /healthcare/cases/:caseId/cancel

Los endpoints utilizan:

JwtAuthGuard

RolesGuard

authenticated companyId

tenant-scoped access

7. HealthcareCaseStatus CURRENT

El lifecycle CURRENT es:

DRAFT

SCHEDULED

CANCELLED

Estos son los únicos estados que deben considerarse contrato vigente.

8. Lifecycle avanzado TARGET

Healthcare podrá requerir posteriormente estados adicionales para representar:

execution

return

reconciliation

operational closure

Los nombres exactos no están aprobados todavía.

Por tanto no deben tratarse como CURRENT enums valores como:

IN_PROGRESS

RECONCILIATION_PENDING

COMPLETED

READY

hasta que los workflows correspondientes sean implementados y validados.

9. Case Status ≠ Readiness

Debe mantenerse:

Case Status
≠
Case Readiness

Un Case puede estar, por ejemplo:

Status:
SCHEDULED

mientras:

Readiness:
NOT READY

sin que READY necesite convertirse en estado principal de HealthcareCase.

10. Readiness TARGET

Readiness debe considerarse inicialmente:

DERIVED

No debe crearse automáticamente:

HealthcareCaseReadiness

ni almacenarse:

case.readiness = READY

como fuente independiente.

11. Readiness inputs TARGET

Conceptualmente puede derivarse de:

schedule

required context

Doctor / Hospital context

responsible User

Case Requirements

CaseKit / Preparation

Equipment Assignment

availability

blockers

según los workflows que existan.

12. HealthcareCase ≠ clinical record

Debe mantenerse:

HealthcareCase
≠
Clinical Record

Healthcare Case representa una operación empresarial y logística alrededor de un procedimiento.

No representa expediente médico.

13. Minimización de información clínica

Healthcare no debe almacenar por defecto:

diagnosis

clinical history

treatments

medical notes

medical test results

unnecessary sensitive patient data

La información debe limitarse a la necesaria para:

operations

logistics

commercial context

custody

traceability

14. Domain ownership consolidado — CURRENT ERP Core

Actualmente pertenecen al ERP Core:

Company

User

Customer

Product

InventoryBatch

InventoryMovement

Quote

Sale

Purchase

PurchaseReceipt

EquipmentAsset

EquipmentInspection

Healthcare puede relacionarse con estos conceptos.

No debe duplicarlos.

15. Domain ownership consolidado — CURRENT Healthcare

Actualmente Healthcare posee:

HealthcareCase

junto con su:

folio

schedule context

responsible User relation

lifecycle CURRENT

tenant ownership

16. TARGET Healthcare concepts

La dirección funcional Healthcare incluye:

Doctor

Hospital

Case Requirements

Equipment Assignment

Case Availability

Preparation

CaseKit / Maletín

CaseDispatch / Custody

CaseReturn

returned-material inspection

Reconciliation

Case Calendar

Case 360

Estos conceptos no deben interpretarse como tablas Prisma ya aprobadas.

17. FUTURE Healthcare concepts

Permanecen FUTURE:

Opportunity

Payer / Insurance

KitTemplate

Reservation

LogisticsIncident formal lifecycle

advanced maintenance / calibration integration

QR workflows

Mobile technician app

Notifications

Advanced analytics

AI assistance

18. Technician

No existe actualmente una necesidad suficiente para crear una identidad separada:

HealthcareTechnician

La decisión inicial es:

Technician
→ User acting in Healthcare

19. Technician ≠ role enum

Que Technician utilice User no significa introducir automáticamente:

UserRole.TECHNICIAN

La responsabilidad operacional y la autorización son conceptos distintos.

20. Healthcare Technician Profile FUTURE

Si posteriormente se requieren atributos como:

certifications

territory

specialties

availability rules

puede diseñarse:

HealthcareTechnicianProfile
↓
User

sin duplicar la identidad principal.

21. Doctor TARGET

Healthcare necesita representar Doctor como master data especializado.

Debe mantenerse:

Doctor
≠
Customer

Actualmente:

Doctor persistence/API
→ NOT IMPLEMENTED

22. Hospital TARGET

Healthcare necesita representar Hospital como contexto operacional del procedimiento.

Debe mantenerse:

Hospital
≠
Customer

Actualmente:

Hospital persistence/API
→ NOT IMPLEMENTED

23. Doctor ↔ Hospital relationship

Un Doctor puede participar en múltiples Hospitals.

Un Hospital puede relacionarse con múltiples Doctors.

Por tanto existe un requirement conceptual:

Doctor
N ↔ N
Hospital

Una entidad como:

DoctorHospitalAffiliation

es un candidato técnico razonable.

No es todavía una tabla Prisma aprobada.

24. Doctor / Hospital tenant ownership

La estrategia de ownership todavía debe decidirse antes de implementación.

Opciones conceptuales:

Company-owned master data

o:

shared identity
+
Company-specific relationship

No debe cerrarse esta decisión prematuramente.

25. No global Doctor/Hospital directory yet

No existe actualmente un requerimiento aprobado para crear:

global Doctor directory

global Hospital directory

compartido automáticamente entre tenants.

26. Customer boundary

Debe mantenerse:

Customer
→ ERP commercial counterpart

mientras:

Doctor
Hospital
→ Healthcare operational master data

No deben forzarse a ser Customer únicamente para reutilizar una entidad existente.

27. Payer FUTURE

Payer es una frontera reconocida del dominio.

Debe mantenerse:

Payer
≠
Customer

pero actualmente:

Payer
→ DOMAIN RECOGNIZED
→ IMPLEMENTATION DEFERRED

28. No premature Payer model

No deben introducirse todavía modelos como:

HealthcarePayer

InsuranceCompany

BusinessParty

únicamente para cerrar la incertidumbre.

Payer requiere un diseño coordinado con:

Billing

Invoice

Insurance

Customer

Hospital

Government entities

29. Opportunity FUTURE

Opportunity representa una posibilidad comercial previa.

Actualmente:

Opportunity
→ FUTURE

HealthcareCase no debe depender de Opportunity para existir.

30. Opportunity is optional

Debe mantenerse:

Opportunity
→ optional commercial precursor

Ejemplo válido:

Doctor request
↓
Healthcare Case

sin Opportunity previa.

31. Opportunity ≠ Case

Debe mantenerse:

Opportunity
≠
HealthcareCase

Opportunity representa una posibilidad.

HealthcareCase representa una operación concreta.

32. Opportunity relationships TBD

Relaciones futuras como:

Opportunity ↔ Doctor

Opportunity ↔ Hospital

Opportunity ↔ Customer

Opportunity ↔ Quote

Opportunity → Cases

se definirán cuando se diseñe Opportunity CRM.

No debe fijarse todavía una cardinalidad Prisma definitiva.

33. Commercial link boundary

Healthcare podrá relacionarse con documentos ERP comerciales.

Pero no debe agregarse automáticamente:

healthcareCaseId

healthcareOpportunityId

a todas las entidades Core.

La dirección de dependencia debe mantenerse:

Healthcare
→ links to Core

sin volver Core dependiente de Healthcare.

34. No generic polymorphic links yet

No debe crearse prematuramente una solución universal como:

DocumentLink

referenceType

referenceId

si sacrifica integridad referencial sin una necesidad clara.

35. Case Requirements TARGET

Requirements representa:

what the Case needs

Puede incluir conceptualmente:

Product

quantity

Equipment need

support material

special logistics context

Actualmente:

Case Requirements
→ NOT IMPLEMENTED

36. Requirements ≠ Preparation

Debe mantenerse:

Requirements
→ what is needed

Preparation
→ work performed to satisfy that need

37. Requirements ≠ CaseKit

También:

Requirements
→ requested / needed

CaseKit
→ actual prepared set

Ejemplo:

Required Product A: 10

Prepared Product A: 8

Esto permite evaluar readiness sin reescribir el requerimiento original.

38. Requirement model name TBD

Un modelo como:

CaseRequirement

o equivalente es conceptualmente razonable.

El nombre y estructura Prisma no están aprobados todavía.

39. Preparation TARGET

Preparation representa el trabajo previo para dejar un Case listo.

Puede incluir:

requirements review

availability checks

material picking

Equipment Assignment

CaseKit assembly

documentation

warehouse preparation

Actualmente:

Preparation workflow
→ NOT IMPLEMENTED

40. Preparation ≠ commercial OUT

Debe mantenerse:

Preparation
≠
Sale

y:

Preparation
≠
commercial Inventory OUT

41. KitTemplate FUTURE

KitTemplate puede representar una receta reusable.

Pero actualmente:

KitTemplate
→ FUTURE productivity capability

No debe bloquear la primera implementación de Requirements, Assignment o CaseKit.

42. KitTemplate ≠ CaseKit

Debe mantenerse:

KitTemplate
→ reusable definition

CaseKit
→ actual prepared set for a Case

43. CaseKit TARGET

CaseKit representa el conjunto real preparado para un Case.

Actualmente:

CaseKit
→ NOT IMPLEMENTED

Debe mantenerse:

CaseKit
≠
automatic Inventory OUT

44. CaseKit cardinality TBD

Una estructura conceptual:

HealthcareCase
→ CaseKit

es válida.

Sin embargo la cardinalidad exacta, por ejemplo:

1 Case
→ 0..1 CaseKit

no debe considerarse todavía decisión de schema.

45. CaseKit items TARGET

CaseKit puede requerir items de Products cuantificables.

Pero no debe convertirse en la única fuente de Requirements.

Debe mantenerse la diferencia:

Requirement
→ what is needed

CaseKitItem
→ what is physically prepared

46. Stock allocation TARGET

CaseKit podrá necesitar asociarse con existencia física concreta.

Conceptualmente:

CaseKit prepared item
↓
Product
Batch
Quantity
Physical availability source

Una entidad como:

CaseKitStockAllocation

es candidata.

No es un nombre Prisma aprobado.

47. InventoryBatch reuse

Cuando aplique tracking por lote, Healthcare debe reutilizar:

InventoryBatch

No debe crear un sistema paralelo de lotes.

48. SERIALIZED tracking boundary

Healthcare no debe improvisar un modelo serializado independiente.

Debe reutilizar la representación Core que corresponda cuando SERIALIZED tenga semántica completa.

49. EquipmentAsset CURRENT

Debe mantenerse:

EquipmentAsset
→ CURRENT ERP Core

Healthcare será consumidor especializado.

No propietario de su identidad base.

50. EquipmentInspection CURRENT

Debe mantenerse:

EquipmentInspection
→ CURRENT ERP Core

No debe crearse un segundo sistema de inspección de Equipment únicamente para Healthcare.

51. Product vs EquipmentAsset

Debe mantenerse:

Product
→ catalog / model

EquipmentAsset
→ concrete reusable physical unit

52. Equipment lifecycle / condition

CURRENT Equipment Core mantiene separadas dimensiones como:

Lifecycle

Condition

Healthcare no debe redefinirlas.

53. Equipment Assignment ≠ lifecycle

Debe mantenerse:

Assignment
≠
EquipmentLifecycle

No deben agregarse automáticamente estados como:

ASSIGNED

IN_CUSTODY

al lifecycle del activo.

54. Equipment Assignment TARGET

Healthcare necesita una relación explícita entre:

HealthcareCase
↔
EquipmentAsset

Un candidato técnico razonable es:

CaseEquipmentAssignment

Actualmente:

Equipment Assignment
→ NOT IMPLEMENTED

55. Assignment ownership

Debe mantenerse:

EquipmentAsset
→ ERP Core

Equipment Assignment
→ Healthcare

56. Assignment must not contaminate EquipmentAsset

No deben agregarse como atajo permanente:

currentCaseId

currentTechnicianId

currentCustodianId

a EquipmentAsset.

Case relationship, Assignment y Custody deben pertenecer al dominio Healthcare o a Read Models derivados.

57. Assignment ≠ Custody

Debe mantenerse:

Equipment Assignment
≠
Custody

Un Equipment puede estar asignado a un Case antes de cambiar físicamente de responsable.

58. Equipment Availability

Availability debe mantenerse como:

DERIVED

No como flag manual independiente.

59. Equipment Availability CURRENT

CURRENT Equipment Core deriva Availability principalmente a partir de:

lifecycle

condition

60. Case Availability TARGET

Healthcare podrá extender el contexto de disponibilidad considerando:

Equipment lifecycle

Equipment condition

active Case Assignment

schedule overlap

other blockers

sin cambiar EquipmentLifecycle.

61. Case Calendar TARGET

Case Calendar debe considerarse:

Read Model

y no necesariamente una tabla.

Conceptualmente:

HealthcareCase schedule

+

Doctor / Hospital context

+

responsible User

+

Readiness

+

conflicts

=

Calendar Read Model

62. No HealthcareCalendarEvent by default

No debe crearse inicialmente:

HealthcareCalendarEvent

únicamente para duplicar:

scheduledStart

scheduledEnd

ya presentes en HealthcareCase.

63. CaseDispatch TARGET

CaseDispatch representa:

temporary physical custody / repositioning

para atender un Healthcare Case.

Actualmente:

CaseDispatch
→ NOT IMPLEMENTED

64. CaseDispatch ≠ Delivery

Debe mantenerse:

CaseDispatch
≠
commercial Delivery

65. CaseDispatch ≠ commercial OUT

También:

CaseDispatch
≠
commercial Inventory OUT

porque el material puede regresar sin haber sido vendido o consumido.

66. Dispatch cardinality

Es razonable que un Case pueda requerir múltiples Dispatches.

Conceptualmente:

HealthcareCase
→ 0..N CaseDispatch

por material adicional o correcciones.

La estructura exacta se decidirá durante el slice correspondiente.

67. Product vs Equipment dispatch representation

Productos cuantificables y Equipment individualizado tienen semántica distinta.

Debe evitarse una estructura ambigua basada únicamente en:

productId?

equipmentAssetId?

quantity?

en un mismo tipo de item sin una razón fuerte.

68. Dispatch item candidates

Entidades como:

CaseDispatchItem

CaseDispatchAsset

son candidatos razonables para separar:

quantifiable Product

de:

individual EquipmentAsset

No constituyen todavía schema aprobado.

69. Custody

Custody es un concepto real del dominio.

Sin embargo:

Custody
→ does not necessarily require its own table

Puede derivarse de hechos como:

Dispatch

Return

Assignment

responsible User

future physical-position history

70. Not every domain word becomes a table

Debe mantenerse:

domain concept
≠
automatic Prisma model

Las entidades se crean cuando representan un hecho propio, lifecycle propio o integridad que no puede expresarse de forma más simple.

71. CaseReturn TARGET

CaseReturn representa el regreso de material o Equipment previamente despachado bajo custodia Healthcare.

Actualmente:

CaseReturn
→ NOT IMPLEMENTED

72. CaseReturn ≠ Commercial Return

Debe mantenerse:

Healthcare CaseReturn
≠
Commercial Return

Commercial Return pertenece al dominio comercial ERP y permanece diferido.

73. Return cardinality

Es razonable permitir:

HealthcareCase
→ 0..N CaseReturn

para soportar retornos parciales o múltiples.

La cardinalidad técnica final se confirmará al diseñar el workflow.

74. Return item candidates

Conceptos como:

CaseReturnItem

CaseReturnAsset

son candidatos razonables.

No son todavía modelos Prisma aprobados.

75. Return traceability

Un Return futuro debe poder relacionarse con el recurso despachado correspondiente.

Conceptualmente:

CaseReturn
→ references prior Dispatch fact

para evitar devolver más de lo que estuvo en custodia.

76. Returned ≠ Available

Debe mantenerse:

Returned
≠
Automatically Available

cuando el recurso requiera inspección.

77. Returned-material inspection TARGET

Healthcare podrá necesitar inspección específica de material retornado.

Puede incluir:

packaging condition

expiration

damage

other disposition

Actualmente:

Healthcare returned-material inspection
→ NOT IMPLEMENTED

78. Equipment inspection reuse

Cuando el recurso sea EquipmentAsset y la semántica corresponda, Healthcare debe reutilizar:

EquipmentInspection

del ERP Core.

No debe duplicar esa capacidad.

79. Do not mix inspection dimensions

Conceptos como:

AVAILABLE

QUARANTINE

DAMAGED

EXPIRED

MAINTENANCE

pueden pertenecer a dimensiones distintas.

No deben convertirse automáticamente en un único enum general.

80. Procedure outcome TARGET

Después de un procedimiento, para material cuantificable se necesita distinguir:

Used

Returned

Unresolved

como hechos o valores derivados.

81. Case Consumption concept

Para representar material utilizado puede ser útil un hecho explícito de consumo.

Un candidato es:

CaseConsumption

o equivalente.

Actualmente:

CaseConsumption
→ TARGET candidate

No es todavía un modelo Prisma aprobado.

82. Why consumption may deserve a fact

Un hecho de consumo puede conservar:

source Dispatch context

quantity

actor

timestamp

correction history

future commercial linkage

mejor que una única columna mutable:

usedQuantity

83. Equipment is not consumed

Equipment reutilizable normalmente:

participated in Case

pero no:

consumed

Su historia se deriva de:

Assignment

Dispatch

Return

Inspection

84. Returned Quantity derived

La cantidad retornada debe derivarse de los hechos de Return cuando existan.

85. Used Quantity derived

La cantidad utilizada debe derivarse de los hechos de Consumption cuando existan.

86. Unresolved Quantity derived

Debe mantenerse conceptualmente:

Unresolved
=
Dispatched
-
Returned
-
Consumed

87. Do not store unresolved as independent truth

Preferencia inicial:

Unresolved
→ derived

para evitar inconsistencias.

Ejemplo incorrecto:

Dispatched = 10

Returned = 5

Consumed = 4

Unresolved stored = 0

88. Reconciliation TARGET

Reconciliation valida el cierre logístico.

Actualmente:

Reconciliation
→ NOT IMPLEMENTED

89. Reconciliation invariant

Debe mantenerse:

Dispatched
=
Returned
+
Consumed
+
Unresolved

90. Reconciliation candidate entity

Puede ser útil una entidad como:

CaseReconciliation

que conserve:

caseId

confirmation state

confirmedBy

confirmedAt

notes

sin duplicar innecesariamente cantidades ya derivables.

No es todavía schema aprobado.

91. Reconciliation closure

En el flujo normal:

Unresolved = 0

más los requisitos de inspección y custodia resueltos deben permitir determinar:

Logistics Reconciled

La regla exacta se definirá con el workflow implementado.

92. Logistics Incident FUTURE

Cuando:

Unresolved > 0

puede requerirse un Incident.

Actualmente:

LogisticsIncident
→ FUTURE

No es indispensable para el primer schema si el Case puede permanecer pendiente de forma segura.

93. Commercial consequence

Debe mantenerse:

Used
≠
Sale

Used
≠
Invoice

CaseConsumption
≠
automatic commercial fulfillment

El hecho operacional y la consecuencia comercial son conceptos distintos.

94. Commercial integration CURRENT

ERP Core utiliza actualmente:

Sale

como modelo comercial CURRENT.

Healthcare todavía no implementa:

Case Reconciliation
↓
Sale

ni otro handoff automático.

95. Commercial integration TARGET

ADR-011 define como arquitectura comercial objetivo:

SalesOrder
↓
Delivery
↓
Inventory OUT

Healthcare podrá integrarse con esa arquitectura cuando exista.

Actualmente:

SalesOrder
→ TARGET

Delivery
→ TARGET

96. Do not use Sale CURRENT as permanent Healthcare logistics architecture

El comportamiento CURRENT:

Sale CONFIRMED
→ Inventory OUT

no debe convertirse automáticamente en la arquitectura definitiva para Healthcare Logistics.

97. Commercial source-location concept FUTURE

Si en el futuro existe un modelo formal de ubicación/custodia, un fulfillment podrá necesitar saber desde qué posición física sale el material.

Esto es una necesidad conceptual.

No es todavía un contrato aprobado de Delivery.

98. Inventory custody problem

Healthcare introduce una necesidad transversal:

material can remain Company-owned
while no longer being freely available in Warehouse

Ejemplo conceptual:

Company-owned: 10

Warehouse available: 6

Case preparation / custody: 4

99. Product.stock CURRENT

Actualmente:

Product.stock
→ persisted Inventory projection

No debe redefinirse todavía desde Healthcare como:

company-owned

o:

warehouse-available

sin una decisión arquitectónica específica.

100. Location / Position / Transfer — architectural candidates

Healthcare probablemente requerirá una forma de representar:

location

custody

availability

internal physical positioning

Soluciones candidatas incluyen:

InventoryLocation

InventoryPosition

internal transfer semantics

pero estas ideas requieren un ADR o diseño específico.

101. InventoryLocation candidate

InventoryLocation puede ser una solución para representar lugares lógicos o físicos.

Ejemplos conceptuales:

WAREHOUSE

CASE_STAGING

USER_CUSTODY

INSPECTION

QUARANTINE

Los valores y modelo exactos no están aprobados.

102. InventoryPosition candidate

Una posición podría permitir responder:

Product A

Lot L001

Warehouse: 10

Case staging: 3

User custody: 2

Inspection: 1

Pero la estrategia de persistencia y source of truth debe decidirse formalmente.

103. Internal transfer candidate

Healthcare requiere semántica para:

Location A
↓
Location B

sin tratar automáticamente el movimiento como:

commercial OUT

La representación técnica exacta está pendiente.

104. Do not declare TRANSFER CURRENT

No debe afirmarse actualmente:

Dispatch
→ InventoryMovement TRANSFER

porque TRANSFER no forma parte del contrato CURRENT documentado de Inventory.

La regla aprobada es únicamente:

Dispatch
→ temporary custody / physical repositioning

y:

Dispatch
≠
commercial OUT

105. Staging requirement

Cuando material esté físicamente preparado para un Case, el sistema deberá evitar que siga apareciendo libremente disponible para otra operación.

Debe existir una solución para:

Warehouse available
↓
Case staging / committed physical preparation

La solución técnica está pendiente.

106. CaseKit and physical staging

Debe mantenerse:

CaseKit
≠
Inventory OUT

y también:

CaseKit data entry
≠
automatic physical movement

La preparación física confirmada podrá requerir un cambio real de disponibilidad, según el diseño futuro.

107. Reservation FUTURE

Reservation puede ser útil para:

stock promised
but not physically staged

Pero:

Reservation
→ FUTURE

y:

Reservation
≠
commercial OUT

108. Proposed ADR

Cuando se retome Healthcare Logistics, puede ser apropiado crear un ADR específico para:

Inventory Locations

Inventory Positions

Internal Transfers

Custody integration

Un nombre posible:

ADR-014 — Inventory Locations and Internal Transfers

Este ADR es una propuesta futura, no una decisión ya implementada.

109. Future ADR questions

Un ADR de Location/Custody deberá decidir, como mínimo:

location model

location types

default warehouse semantics

position strategy

internal-transfer representation

Product.stock meaning

InventoryBatch positioning

staging behavior

user custody

inspection positioning

movement history

PurchaseReceipt integration

Sales / Delivery integration

migration strategy

110. Ledger source-of-truth decision TBD

No debe decidirse aquí de forma definitiva si:

InventoryMovement ledger
→ sole source of truth

y:

InventoryPosition
→ derived projection

o si se utilizará otra estrategia.

Eso pertenece al diseño de Inventory Location/Custody.

111. Equipment location / custody

Equipment también necesitará contexto de ubicación y custodia.

Debe mantenerse:

current Equipment location / custody
→ derived operational context where possible

No deben agregarse shortcuts directos a EquipmentAsset sin revisar historia e integridad.

112. Equipment movement candidate

Una futura solución puede utilizar:

EquipmentAssetMovement

o una infraestructura genérica equivalente.

No se decide todavía.

113. Do not force quantity inventory and assets into one model

Products cuantificables y EquipmentAsset individualizado tienen semántica diferente.

No deben forzarse al mismo modelo de movement/position si eso vuelve ambas soluciones incorrectas.

114. Derived / Read Models

Siempre que sea posible, no crear entidades independientes para:

Case Calendar

Case Readiness

Case Availability

Equipment Availability

Current Custody summary

Unresolved Quantity

Warehouse Operations Dashboard

Healthcare Dashboard

Estos conceptos pueden derivarse de hechos de dominio.

115. Calendar as Read Model

Debe mantenerse:

Case Calendar
→ Read Model

116. Readiness as derived

Debe mantenerse:

Case Readiness
→ derived

117. Availability as derived

Debe mantenerse:

Availability
→ derived

No deben almacenarse simultáneamente flags contradictorios como:

isAvailable

isAssigned

isInCustody

status

condition

sin una semántica clara.

118. Cross-tenant invariants

Toda relación tenant-owned debe conservar el mismo contexto de Company.

Debe rechazarse:

Case Company A
→ Product Company B

Case Company A
→ EquipmentAsset Company B

Case Company A
→ User Company B

y, cuando existan:

Case Company A
→ Doctor / Hospital Company B

si esas entidades son tenant-owned.

119. Backend authority

Las invariantes tenant y de negocio no dependen de filtros frontend.

Debe mantenerse:

frontend
→ usability

backend
→ authority

120. Immutability boundary

Master Data puede actualizarse.

Los hechos operacionales confirmados no deben reescribirse silenciosamente.

Ejemplos futuros:

Confirmed Dispatch

Confirmed Return

Definitive Consumption

Confirmed Reconciliation

deberán utilizar corrección, reversal o hechos compensatorios cuando corresponda.

121. Audit TARGET

Acciones críticas Healthcare podrán alimentar Audit cuando la infraestructura exista.

Pero debe mantenerse:

Audit
≠
Inventory Ledger

Audit
≠
Custody History

Audit
≠
Case Timeline

122. Case create idempotency CURRENT debt

Actualmente:

POST /healthcare/cases
→ no formal request-level idempotency

Estado:

Healthcare Case create idempotency
→ TECHNICAL DEBT

123. Critical future operation idempotency

Operaciones futuras como:

confirm Dispatch

confirm Return

confirm Reconciliation

deberán ser duplicate-safe ante retries.

Esto es un requirement TARGET de confiabilidad.

124. Concurrency TARGET

Healthcare deberá prevenir conflictos como:

same EquipmentAsset
→ overlapping Cases

y, si existe allocation/reservation:

same inventory quantity
→ committed to incompatible operations

La estrategia técnica se definirá cuando exista el slice.

125. Workflow operacional TARGET

El workflow operativo conceptual es:

Healthcare Case
↓
Requirements
↓
Preparation
↓
Equipment Assignment / CaseKit
↓
Dispatch / Custody
↓
Procedure
↓
Return
↓
Inspection
↓
Reconciliation
↓
Commercial consequence

Este flujo describe la operación.

No describe necesariamente el orden técnico de implementación.

126. Roadmap técnico Healthcare

Después de cerrar ERP Core V1, la secuencia de implementación aprobada es:

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

127. Existing foundations must not be reimplemented

Debe mantenerse:

HealthcareCase Foundation
✅ CURRENT

y:

EquipmentAsset / EquipmentInspection
✅ CURRENT ERP Core

Por tanto no deben aparecer como futuros slices a construir desde cero.

128. Inventory/Custody prerequisite

Antes de habilitar Dispatch real debe existir una solución segura para:

availability

physical positioning

custody

double-use prevention

No puede permitirse que la UI marque material como preparado/custodiado mientras Inventory todavía lo considere libre para otra operación.

129. No Prisma Healthcare expansion during H8

Este documento no autoriza actualmente:

new Healthcare Prisma models

InventoryLocation implementation

InventoryPosition implementation

TRANSFER implementation

CaseDispatch schema

CaseReturn schema

durante H8.

130. Global project sequence

Debe mantenerse:

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

131. CURRENT consolidated model

ERP CORE CURRENT

Company

User

Customer

Product

InventoryBatch

InventoryMovement

Quote

Sale

Purchase

PurchaseReceipt

EquipmentAsset

EquipmentInspection

HEALTHCARE CURRENT

HealthcareCase

HealthcareCaseStatus
DRAFT / SCHEDULED / CANCELLED

Case folio

Case schedule context

responsible User

tenant-scoped API / RBAC

132. TARGET Healthcare model

Conceptos funcionales objetivo:

Doctor

Hospital

Doctor ↔ Hospital relationship

Case Requirements

Preparation

Equipment Assignment

Case Availability

CaseKit

CaseDispatch

Custody

CaseReturn

returned-material inspection

Consumption fact candidate

Reconciliation

Calendar Read Model

Case 360

Las tablas exactas se decidirán slice por slice.

133. TARGET Core architectural candidates

Healthcare puede requerir evolución del Core alrededor de:

Inventory Location

Inventory Position

internal physical transfer / custody semantics

Estas son soluciones candidatas sujetas a ADR.

No son CURRENT.

134. FUTURE model

Opportunity

Payer / Insurance

KitTemplate

Reservation

LogisticsIncident formal workflow

maintenance/calibration expansion

QR

Mobile

Notifications

Analytics

AI

135. Conceptual relationship map

                      ZAPING ERP CORE
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
        User             Product          Customer
          │                 │
          │             Inventory
          │          Batch / Movements
          │                 │
          │          EquipmentAsset
          │             CURRENT
          │
          └─────────────┬────────────────────────
                        │
                        ▼
                 ZAPING HEALTHCARE
                        │
              HealthcareCase CURRENT
                        │
        ┌───────────────┼────────────────────┐
        │               │                    │
     Doctor          Hospital          Requirements
     TARGET          TARGET             TARGET
        │               │                    │
        └─────── relationship ───────────────┘
                        │
                        ▼
                  Preparation
                     TARGET
                        │
              ┌─────────┴─────────┐
              │                   │
           CaseKit          Equipment Assignment
           TARGET                TARGET
              │                   │
              └─────────┬─────────┘
                        ▼
                 Dispatch / Custody
                      TARGET
                        │
               ┌────────┴────────┐
               │                 │
            Return          Consumption
            TARGET          CANDIDATE
               │                 │
           Inspection            │
             TARGET              │
               └────────┬────────┘
                        ▼
                  Reconciliation
                      TARGET
                        │
                        ▼
              Commercial consequence
                      FUTURE

136. Core architecture candidates map

Possible future Core support:

Inventory
↓
Location / Position / Custody semantics

This remains:

ARCHITECTURAL CANDIDATE

until a dedicated ADR is approved.

137. Invariantes consolidadas

HealthcareCase
≠
Clinical Record

Doctor
≠
Hospital
≠
Customer
≠
Payer

Technician
→ User initially

Opportunity
≠
Case

Opportunity
→ optional

Case Status
≠
Readiness

Case Calendar
→ Read Model

Requirements
≠
Preparation

Requirements
≠
CaseKit

KitTemplate
≠
CaseKit

CaseKit
≠
Dispatch

CaseKit
≠
automatic Inventory OUT

Preparation
≠
commercial OUT

EquipmentAsset
→ CURRENT ERP Core identity

Equipment Assignment
→ Healthcare relationship

Equipment Assignment
≠
Custody

Equipment Assignment / Custody
≠
EquipmentLifecycle

Availability
→ derived

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

Used
≠
Invoice

Used
≠
automatic Sale

Unresolved
→ derived

Dispatched
=
Returned + Consumed + Unresolved

same physical inventory
→ never decremented twice

138. Anti-patrones consolidados

HealthcareCase as clinical record

No almacenar información clínica innecesaria dentro de Case.

Doctor as Customer

No forzar:

Doctor
→ Customer

para crear Cases.

Hospital as Customer

No forzar:

Hospital
→ Customer

cuando el contexto comercial sea diferente.

Opportunity required before Case

No exigir Opportunity para crear un Case.

Duplicate Technician identity

No crear:

User Carlos
+
HealthcareTechnician Carlos

sin necesidad real.

Equipment identity duplicated in Healthcare

No crear un segundo activo Healthcare cuando ya existe EquipmentAsset.

Assignment as Equipment lifecycle

No utilizar:

ASSIGNED
IN_CUSTODY

como lifecycle del EquipmentAsset.

CaseKit as Requirements source

No utilizar el set preparado como única verdad de lo requerido.

UI-only Reservation

No simular disponibilidad/reserva únicamente ocultando unidades en frontend.

Dispatch as commercial OUT

No tratar custodia temporal como salida comercial definitiva.

Hard-code TRANSFER before architecture decision

No afirmar que Dispatch necesariamente produce un InventoryMovement TRANSFER antes del ADR correspondiente.

Return directly available

No devolver automáticamente a Available cuando sea necesaria inspección.

Commercial consequence from Used automatically

No convertir consumo operacional automáticamente en Sale, Delivery o Invoice.

Healthcare fields inside generic Core entities

No agregar campos como:

doctorId

hospitalId

currentCaseId

currentCustodianId

a entidades Core únicamente para evitar modelar la vertical.

One giant Healthcare model

No concentrar:

Case
Inventory
Equipment
Dispatch
Return
Billing
Insurance
Audit

en una única tabla.

Target documented as Current

No presentar como CURRENT:

Doctor

Hospital

Requirements

Assignment

Dispatch

Return

Reconciliation

Calendar UI

Case 360

Inventory Location

mientras no estén implementados.

139. ADR relacionados

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

ADR-013 continúa siendo la decisión principal que separa:

Healthcare custody

de:

commercial OUT

140. ADR future candidate

Cuando Healthcare Logistics vuelva a ser prioridad, puede evaluarse:

ADR-014
Inventory Locations and Internal Transfers

o una decisión equivalente.

Su propósito sería resolver formalmente:

locations

positions

custody

internal physical movement

Product.stock meaning

batch positioning

Receipt integration

Sales/Delivery integration

migration

141. Documentación relacionada

docs/modules/healthcare/HEALTHCARE.md

docs/modules/healthcare/CASES.md

docs/modules/erp/PRODUCTS.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/QUOTES.md

docs/modules/erp/SALES.md

docs/modules/erp/PURCHASE_RECEIPTS.md

docs/architecture/ARCHITECTURE.md

docs/architecture/adr/ADR-013-inventory-custody-case-logistics.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

Documentos especializados futuros pueden incluir:

DOCTORS_HOSPITALS.md

CASE_REQUIREMENTS.md

EQUIPMENT_ASSIGNMENT.md

CASE_AVAILABILITY.md

CASE_KITS.md

CASE_LOGISTICS.md

CASE_CALENDAR.md

142. Fuente de verdad

DOMAIN_MODEL.md
→ mapa transversal de entidades, ownership y relaciones

HEALTHCARE.md
→ frontera general CURRENT / TARGET / FUTURE

CASES.md
→ HealthcareCase CURRENT y lifecycle

EQUIPMENT.md
→ EquipmentAsset / EquipmentInspection CURRENT

INVENTORY.md
→ Inventory CURRENT

SALES.md
→ Sale CURRENT
→ SalesOrder / Delivery TARGET

ADR-013
→ custody vs commercial OUT

future ADR
→ Inventory Location / Position / internal transfer semantics

schema.prisma
→ CURRENT persistence only

backend
→ CURRENT implemented behavior

PROJECT_BOARD.md
→ active implementation status / technical debt

143. Estado actual

Actualmente está implementado:

HealthcareCase

HealthcareCaseStatus
DRAFT / SCHEDULED / CANCELLED

Company/User relations

tenant-scoped NestJS API

RBAC

Case scheduling foundation

También existe en ERP Core:

EquipmentAsset

EquipmentInspection

144. Pendiente Healthcare

Permanece sin implementar:

Healthcare frontend

Doctor / Hospital

Case Requirements

Equipment Assignment

Case Availability

Preparation

CaseKit

Dispatch / Custody

CaseReturn

returned-material inspection

Consumption event/entity

Reconciliation

Case Calendar UI

Case 360

Mobile technician

145. Pendiente Core relacionado

Healthcare puede requerir posteriormente una solución para:

Inventory location

inventory position

internal physical movement

custody-aware availability

pero el modelo técnico sigue pendiente de ADR.

146. Próximo paso de dominio

La ejecución inmediata del proyecto continúa:

H8A
↓
H8B
↓
UX-B.6
↓
ERP Core V1 Closure

Cuando Healthcare specialization se retome, deberán priorizarse:

Hospital / Doctor
↓
Requirements
↓
Equipment Assignment
↓
Case Availability

y antes de Dispatch real deberá existir una decisión segura sobre:

availability

physical positioning

custody

147. Principio final

Healthcare no necesita convertir cada concepto del negocio en una tabla.

Necesita mantener claras las fronteras entre:

business intent

operational Case

requirements

preparation

physical assignment

custody

return

consumption

reconciliation

commercial consequence

Debe distinguir siempre:

CURRENT

de:

TARGET

y:

architectural candidate

Cada entidad debe representar un hecho propio, cada valor derivado debe permanecer derivado cuando sea seguro hacerlo y cada movimiento físico debe poder explicarse sin duplicar identidad, stock, custodia ni historia.
