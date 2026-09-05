Zaping Healthcare

Producto: Zaping Healthcare
Plataforma: Zaping
Versión: 1.2.0
Estado: Aprobado
Estado de implementación: HEALTHCARE CASE FOUNDATION IMPLEMENTED / VALIDATED — OPERATIONAL LOGISTICS TARGET
Última actualización: 2026-08-27
Responsable: Zaping Healthcare Team

1. Propósito

Zaping Healthcare es la primera vertical especializada construida sobre Zaping ERP Core.

Su objetivo es resolver la operación comercial, logística y de trazabilidad de empresas que suministran:

dispositivos médicos;

implantes;

consumibles;

instrumental;

equipos reutilizables;

materiales utilizados en procedimientos;

servicios de asistencia técnica asociados a procedimientos.

Healthcare no sustituye al ERP Core.

Lo especializa.

2. Principio fundamental

Zaping ERP Core
=
operación empresarial genérica

Zaping Healthcare
=
workflow especializado del sector salud

Por tanto:

Healthcare debe construirse sobre las capacidades del ERP Core sin contaminar los módulos genéricos con reglas específicas de procedimientos médicos.

3. CURRENT vs TARGET vs FUTURE

Este documento distingue tres niveles.

CURRENT

Capacidades ya implementadas y validadas.

Actualmente:

HealthcareCase Foundation
✅

EquipmentAsset ERP Core
✅

EquipmentInspection ERP Core
✅

TARGET

Capacidades Healthcare aprobadas como dirección funcional, pero todavía no implementadas.

Incluyen:

Doctor / Hospital

Case Requirements

Equipment Assignment

Case Availability

Preparation

CaseKit / Maletín

CaseDispatch / Custody

CaseReturn

Healthcare material inspection

Reconciliation

Case Calendar UI / Read Model

Case 360

Warehouse Operations integration

FUTURE

Capacidades posteriores que requieren validación adicional o nuevos dominios.

Incluyen:

Opportunity CRM

Payer / Insurance workflows

KitTemplate

Reservations

Maintenance / Calibration expansion

QR workflows

Mobile technician app

Electronic signatures

Notifications

Advanced analytics

AI assistance

4. Estado CURRENT consolidado

Actualmente Zaping Healthcare contiene una Foundation funcional de Healthcare Case.

Estado:

HealthcareCase
✅ IMPLEMENTED / VALIDATED

Capacidades CURRENT:

Case folio

scheduled start / schedule context

responsible User

HealthcareCaseStatus

DRAFT

SCHEDULED

CANCELLED

tenant-scoped persistence

RBAC

Case creation

Case list

Case detail

Case update

Case cancellation

No existe todavía una vertical Healthcare operacional completa.

5. API CURRENT

Healthcare Case Foundation implementa:

POST  /healthcare/cases

GET   /healthcare/cases

GET   /healthcare/cases/:caseId

PATCH /healthcare/cases/:caseId

POST  /healthcare/cases/:caseId/cancel

Los endpoints utilizan:

JwtAuthGuard

RolesGuard

explicit roles

authenticated companyId

tenant-scoped access

6. HealthcareCaseStatus CURRENT

El lifecycle CURRENT utiliza:

DRAFT

SCHEDULED

CANCELLED

Estos valores constituyen el contrato vigente.

No deben confundirse con estados operacionales futuros todavía no implementados.

7. Lifecycle avanzado TARGET

En el futuro Healthcare Case podrá requerir una semántica operacional más rica para representar preparación, ejecución, retorno y reconciliación.

Sin embargo:

PLANNED

READY

IN_PROGRESS

RETURNED

RECONCILIATION_PENDING

COMPLETED

u otros nombres posibles no están aprobados todavía como enum CURRENT.

La definición definitiva deberá realizarse cuando existan los workflows logísticos que necesiten esos estados.

8. Case create idempotency

Actualmente:

POST /healthcare/cases
→ no formal request-level idempotency contract

Por tanto:

Healthcare Case create idempotency
→ TECHNICAL DEBT

Debe resolverse cuando el riesgo operacional o el workflow requiera protección explícita contra retries o double-submit.

9. Problema que resuelve Healthcare

En distribuidores médicos, una operación no siempre comienza con una Quote o Sale convencional.

Puede comenzar cuando:

Doctor
↓
contacta al Technician
↓
solicita material / Equipment
↓
se agenda un procedimiento

También puede comenzar mediante:

Technician
↓
identifica una oportunidad
↓
coordina Doctor / Hospital
↓
se agenda un procedimiento

Después puede requerirse:

definir requerimientos
↓
preparar material
↓
asignar Equipment
↓
armar maletín
↓
transferir custodia
↓
llevar material al Hospital
↓
utilizar una parte
↓
regresar lo no utilizado
↓
inspeccionar
↓
reconciliar
↓
resolver consecuencia comercial

10. Healthcare no es un sistema clínico

Zaping Healthcare no pretende convertirse en:

expediente clínico electrónico;

HIS;

PACS;

sistema de diagnóstico;

sistema de prescripción;

sistema de notas clínicas;

repositorio de historia clínica.

La plataforma se limita a información necesaria para:

operación

logística

comercialización

trazabilidad

custodia

inventario

11. Minimización de información clínica

Debe evitarse almacenar información clínica de pacientes salvo que exista una necesidad operacional concreta, documentada y aprobada.

No debe recopilarse por defecto:

diagnosis

clinical history

treatments

medical notes

medical test results

unnecessary sensitive patient data

únicamente porque técnicamente sea posible.

12. HealthcareCase ≠ clinical record

Debe mantenerse:

HealthcareCase
≠
Clinical Record

Healthcare Case representa una operación coordinada alrededor de un procedimiento o evento Healthcare.

No representa el expediente médico del paciente.

13. Healthcare Case

Healthcare Case es el agregado operacional principal CURRENT de la vertical.

Representa:

una operación relacionada con un procedimiento o evento Healthcare que requiere coordinación empresarial, logística y de materiales.

Puede contener o relacionarse progresivamente con contexto como:

folio

Company

schedule

responsible User

future Doctor

future Hospital

future operational requirements

future commercial context

14. Scheduling CURRENT

HealthcareCase ya conserva contexto de programación.

Por tanto:

Case scheduling data
✅ CURRENT

Esto no equivale todavía a:

Case Calendar UI

ni a:

Calendar conflict detection

15. Case Calendar TARGET

Healthcare necesita una experiencia temporal especializada:

Case Calendar

Conceptualmente:

Healthcare Cases
↓
Calendar Read Model

La Calendar UI / Read Model no está implementada todavía.

16. Calendar TARGET information

Cuando se implemente podrá presentar:

Date / Time

Case

Hospital

Doctor

responsible Technician / User

Procedure context

Case status

Readiness

según las entidades disponibles en ese momento.

17. Calendar filters TARGET

Filtros futuros pueden incluir:

Technician

Hospital

Doctor

Status

Procedure

Date range

No forman parte del CURRENT Case Foundation.

18. Calendar conflict detection TARGET

La evolución futura deberá considerar conflictos como:

same responsible User
+
overlapping Cases

y posteriormente:

same EquipmentAsset
+
overlapping Case Assignments

cuando Equipment Assignment exista.

19. Actores Healthcare

Healthcare debe mantener conceptualmente separados:

Doctor

Hospital

Customer

Payer

Technician / responsible User

aunque algunas relaciones puedan coincidir en una operación concreta.

20. Doctor TARGET

Doctor representa al profesional relacionado con el procedimiento o la oportunidad operacional.

Conceptualmente puede:

solicitar material;

influir en la selección de producto;

relacionarse con múltiples Hospitals;

relacionarse con múltiples Cases.

Actualmente:

Doctor model
→ NOT IMPLEMENTED

21. Doctor ≠ Customer

Debe mantenerse:

Doctor
≠
Customer

Doctor puede generar demanda sin ser la contraparte comercial que compra o recibe factura.

22. Doctor multi-hospital

Un Doctor puede trabajar o realizar procedimientos en múltiples Hospitals.

Por tanto no debe modelarse automáticamente como:

Doctor.hospitalId

sin diseñar primero la cardinalidad correcta.

23. Hospital TARGET

Hospital representa el lugar u organización donde puede realizarse un procedimiento.

Puede aportar contexto como:

location

logistics context

requirements

contacts

schedule constraints

Actualmente:

Hospital model
→ NOT IMPLEMENTED

24. Hospital ≠ Customer

Debe mantenerse:

Hospital
≠
Customer

En algunos casos ambos conceptos pueden coincidir empresarialmente.

En otros:

Hospital
→ procedure location

Customer
→ commercial counterpart

25. Doctor / Hospital tenancy decision

Antes de diseñar Prisma debe resolverse si Doctor y Hospital serán:

Company-owned master data

o:

shared identity
+
Company-specific relationship

Este documento no toma todavía esa decisión.

26. Technician / responsible User

El concepto empresarial Technician puede representar a un colaborador que participa en:

commercial activity

operational coordination

procedure assistance

Actualmente Healthcare Case ya puede relacionarse con un User responsable.

27. Technician ≠ rigid authorization enum

Debe mantenerse:

Technician
≠
single hard-coded authorization role

Un User puede tener responsabilidades Healthcare mediante roles y permisos apropiados.

Healthcare no debe crear una segunda identidad de usuario innecesaria.

28. Payer FUTURE

Payer representa quién asume económicamente una operación cuando corresponda.

Conceptualmente puede ser:

Hospital

Insurance Company

Private payer

Government entity

Other organization

Actualmente:

Payer model
→ NOT IMPLEMENTED

29. Payer ≠ Customer

Debe distinguirse:

Customer
→ commercial counterpart

de:

Payer
→ economic responsibility

Pueden coincidir.

No tienen que hacerlo.

30. Insurance FUTURE

Healthcare podrá soportar workflows donde intervenga una aseguradora.

No debe introducirse todavía:

insurance authorization workflow

clinical insurance data

complex payer logic

sin documentar primero el proceso real.

31. No Patient model by default

La existencia futura de un payer privado no obliga a crear un modelo Patient.

Debe mantenerse:

operational need
→ determines minimum required data

No:

Healthcare vertical
→ automatically stores patient profile

32. Opportunity FUTURE

Opportunity representa una posibilidad comercial previa.

Puede originarse por:

Doctor request

Technician prospecting

Hospital request

commercial lead

existing Customer

Actualmente:

Opportunity
→ NOT IMPLEMENTED

33. Opportunity is optional

Debe mantenerse:

Opportunity
→ optional future commercial precursor

Healthcare Case debe poder existir sin Opportunity.

Ejemplo válido:

Doctor request
↓
Healthcare Case

34. Opportunity ≠ Quote

Debe distinguirse:

Opportunity
→ commercial possibility

de:

Quote
→ economic proposal

35. Opportunity ≠ Case

También:

Opportunity
→ possibility

Healthcare Case
→ concrete operational event

Una Opportunity futura puede no convertirse en Case.

36. Workflow operacional TARGET

El workflow objetivo de la operación puede expresarse conceptualmente como:

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

Este es un workflow operativo conceptual.

No debe confundirse con el orden técnico de implementación del roadmap.

37. Case Requirements TARGET

Requirements representa:

what the Case needs

Puede incluir conceptualmente:

Products

quantities

Equipment needs

support material

special logistics requirements

Actualmente:

Case Requirements
→ NOT IMPLEMENTED

38. Requirements ≠ Preparation

Debe mantenerse:

Requirements
→ what is needed

Preparation
→ work performed to satisfy those needs

No son el mismo concepto.

39. Requirements ≠ CaseKit

También:

Requirements
→ requested / needed

CaseKit
→ actual prepared set

Ejemplo:

Required Product A: 10
Prepared Product A: 8

Esto permite representar readiness sin reescribir el requerimiento original.

40. Preparation TARGET

Preparation representa el trabajo previo para dejar un Case listo.

Puede incluir:

requirements review

availability check

material picking

Equipment Assignment

CaseKit assembly

documentation

warehouse preparation

Actualmente:

Preparation workflow
→ NOT IMPLEMENTED

41. Preparation does not mean Sale

Debe mantenerse:

Preparation
≠
Sale

y:

Preparation
≠
commercial Inventory OUT

Preparar material no significa que ya fue vendido o consumido.

42. KitTemplate FUTURE

KitTemplate puede representar una definición reusable.

Ejemplo:

Procedure Type A

Product X × 2

Product Y × 4

Equipment Z

Debe mantenerse:

KitTemplate
→ reusable recipe

No:

KitTemplate
→ physical inventory

Actualmente:

KitTemplate
→ FUTURE

No debe bloquear Requirements ni CaseKit.

43. CaseKit TARGET

CaseKit representa el conjunto real preparado para un Case concreto.

Debe mantenerse:

CaseKit
≠
KitTemplate

y:

CaseKit
≠
automatic Inventory OUT

Actualmente:

CaseKit model
→ NOT IMPLEMENTED

44. CaseKit may differ from Requirements

Debe poder ocurrir:

Requirements
↓
Preparation
↓
CaseKit

sin exigir que CaseKit sea una copia idéntica de Requirements o KitTemplate.

45. CaseKit content TARGET

Puede incluir conceptualmente:

Product

prepared quantity

InventoryBatch when required

serial identity when applicable

EquipmentAsset

preparation status

La estructura técnica se definirá durante el diseño correspondiente.

46. Reservation FUTURE

Agregar una partida a Requirements o CaseKit no implica automáticamente:

Inventory reservation

Debe mantenerse:

CaseKit
≠
automatic Reservation

hasta que exista una estrategia formal de disponibilidad/reserva.

47. Equipment Core CURRENT

Healthcare reutiliza Equipment del ERP Core.

Actualmente existen:

EquipmentAsset
✅

EquipmentInspection
✅

Healthcare no debe crear un segundo sistema de identidad para activos reutilizables.

48. Product vs EquipmentAsset

Debe mantenerse:

Product
→ catalog / model

EquipmentAsset
→ concrete reusable physical unit

Ejemplo:

Product
Monitor XYZ

EquipmentAsset
EQ-00041
Serial SN-99102

49. Equipment identity is already implemented

Debe mantenerse:

EquipmentAsset identity
→ CURRENT ERP Core

Por tanto Equipment identity no es una capacidad TARGET de Healthcare.

Healthcare construirá relaciones operativas encima de esa identidad.

50. Equipment lifecycle remains ERP Core

Healthcare no debe redefinir EquipmentLifecycle.

CURRENT Equipment Core mantiene su propio lifecycle y condition.

Conceptualmente:

EquipmentAsset
→ lifecycle / condition

Healthcare debe reutilizarlos.

51. Assignment is not Equipment lifecycle

No debe agregarse automáticamente al lifecycle del activo:

ASSIGNED

IN_CUSTODY

porque representan contexto operacional temporal.

Debe mantenerse:

EquipmentAsset
→ intrinsic asset state

frente a:

Equipment Assignment
→ Healthcare operational relationship

52. Equipment Assignment TARGET

Equipment Assignment representará la relación entre:

Healthcare Case

and

EquipmentAsset

cuando una unidad concreta sea destinada a un Case.

Actualmente:

Equipment Assignment
→ NOT IMPLEMENTED

53. Equipment Assignment must not contaminate EquipmentAsset

No deben agregarse como atajo permanente campos como:

currentCaseId

currentTechnicianId

currentCustodianId

a EquipmentAsset para reemplazar el dominio Healthcare.

La relación debe vivir en entidades o Read Models apropiados.

54. Case Availability TARGET

Healthcare deberá evaluar disponibilidad contextual considerando progresivamente:

Equipment lifecycle

Equipment condition

active Assignments

schedule overlaps

Case requirements

Esto puede producir un:

Case Availability

o Read Model equivalente.

55. Equipment Availability CURRENT vs Healthcare availability TARGET

CURRENT Equipment Availability deriva principalmente de:

lifecycle

condition

TARGET Healthcare podrá agregar:

Case assignment

schedule conflicts

No debe convertir:

Equipment.lifecycle = ASSIGNED

para resolver disponibilidad.

56. Equipment history TARGET

Healthcare deberá permitir reconstruir relaciones como:

EquipmentAsset
↓
Assignments
↓
Cases
↓
Custody
↓
Returns

sin reescribir la historia base del Equipment Core.

57. EquipmentInspection CURRENT

EquipmentInspection ya existe como capacidad del ERP Core.

Debe distinguirse de una futura inspección de material retornado Healthcare.

58. Healthcare material inspection TARGET

CaseReturn podrá requerir inspección de:

returned consumables

packaging condition

expiration

damage

other disposition

según el tipo de material.

Actualmente:

general Healthcare returned-material inspection
→ NOT IMPLEMENTED

59. Returned ≠ automatically available

Debe mantenerse:

Returned
≠
Automatically Available

cuando el tipo de material o activo requiera inspección.

60. Do not create one mixed inspection enum

Conceptos como:

AVAILABLE

QUARANTINE

DAMAGED

EXPIRED

MAINTENANCE

pueden pertenecer a dimensiones diferentes.

No deben convertirse automáticamente en un único enum general sin diseño explícito.

61. CaseDispatch TARGET

CaseDispatch representa la transferencia física de material o Equipment desde la Company hacia un responsable para atender un Case.

Actualmente:

CaseDispatch
→ NOT IMPLEMENTED

62. CaseDispatch = temporary custody

Debe mantenerse:

CaseDispatch
→ temporary custody

El material puede estar físicamente fuera del almacén mientras sigue siendo propiedad de la Company.

63. CaseDispatch ≠ Delivery

Regla crítica:

CaseDispatch
≠
commercial Delivery

Delivery representa fulfillment comercial definitivo.

CaseDispatch representa custodia operacional temporal.

64. CaseDispatch ≠ commercial OUT

Debe mantenerse:

CaseDispatch
≠
commercial Inventory OUT

El material puede regresar sin haber sido vendido ni consumido.

65. Inventory custody gap CURRENT

Inventory Core no representa todavía formalmente toda la semántica de:

Location

Custody

TRANSFER

Reserved

Available

Healthcare documenta esta necesidad.

No autoriza por sí mismo una modificación inmediata del schema.

66. Owned vs available TARGET

Healthcare necesita distinguir en el futuro:

Company-owned quantity

de:

Warehouse available quantity

y:

Technician custody quantity

Ejemplo conceptual:

Product A

Company-owned: 10
Warehouse available: 6
Technician custody: 4

Esto es una necesidad TARGET de Inventory + Healthcare.

67. No invent TRANSFER now

Aunque Dispatch represente movimiento físico/custodia:

Dispatch
≠
automatically a TRANSFER InventoryMovement

porque TRANSFER no forma parte del modelo CURRENT documentado.

La integración exacta deberá diseñarse con Inventory cuando Case Logistics se implemente.

68. Chain of Custody TARGET

CaseDispatch futuro debe poder responder:

What left?

How much?

Which batch?

Which serial / EquipmentAsset?

Who handed it over?

Who received it?

When?

For which Case?

69. Warehouse actor

La futura cadena de custodia debe poder identificar al actor que preparó o entregó material cuando sea operacionalmente necesario.

70. Responsible custodian

Debe existir una identidad clara del responsable que recibe custodia.

Ese responsable podrá ser un User con responsabilidades de Technician u otro rol operacional.

71. Dispatch timestamp

La transferencia de custodia debe conservar:

when it occurred

como parte del hecho histórico.

72. Physical warehouse form as requirements source

Empresas como INSAP utilizan controles físicos de entrada/salida.

Campos observados incluyen:

entrada / salida

clave producto

descripción

material de apoyo

referencias

responsable

Hospital

procedimiento

fecha

Estos campos son:

source of operational requirements

No deben interpretarse automáticamente como el schema final.

73. Dispatch document FUTURE

CaseDispatch podrá generar posteriormente:

Dispatch document

PDF

QR

signature

sin que el documento se convierta en la fuente de verdad del Inventory.

74. Procedure outcome TARGET

Después del procedimiento cada partida despachada podrá terminar conceptualmente como:

Used

Returned

Unresolved

75. Used

Representa material efectivamente utilizado o consumido durante el Case.

76. Returned

Representa material que regresa desde la custodia Healthcare.

77. Unresolved

Representa una disposición todavía no explicada.

Puede significar:

pending verification

documentation mismatch

missing item

damaged item

unknown disposition

other discrepancy

No significa automáticamente pérdida definitiva.

78. CaseReturn TARGET

CaseReturn representa el regreso de material previamente despachado bajo custodia Healthcare.

Actualmente:

CaseReturn
→ NOT IMPLEMENTED

79. CaseReturn ≠ Commercial Return

Debe mantenerse:

Healthcare CaseReturn
≠
Commercial Return

Healthcare CaseReturn:

company-owned material returns from custody

Commercial Return:

previously sold / commercially fulfilled material returns

Generic Commercial Returns permanece P1 / deferred en ERP Core.

80. Reconciliation TARGET

Reconciliation compara:

what was dispatched

contra:

what actually happened

Actualmente:

Reconciliation
→ NOT IMPLEMENTED

81. Reconciliation invariant

Debe mantenerse como invariante arquitectónica:

Dispatched Quantity
=
Used
+
Returned
+
Unresolved

Ejemplo:

Dispatched: 10

Used:       3
Returned:   6
Unresolved: 1

10 = 3 + 6 + 1

82. Reconciliation closure

Un Case no debería considerarse logísticamente completamente reconciliado mientras exista:

Unresolved > 0

salvo workflow excepcional explícito.

83. Incident TARGET

Cuando exista:

Unresolved > 0

puede requerirse una excepción o Incident operacional.

Actualmente:

Incident workflow
→ NOT IMPLEMENTED

84. Incident resolution

Un futuro workflow deberá permitir:

Unresolved
↓
Resolved disposition

sin reescribir silenciosamente la reconciliación histórica original.

85. Inventory integration

Inventory continúa siendo propietario de la verdad física general.

Healthcare aportará eventos especializados como:

CaseDispatch

CaseReturn

Reconciliation

cuando sean implementados.

86. No automatic InventoryMovement semantics yet

No todo evento Healthcare debe convertirse automáticamente en:

InventoryMovement OUT

ni en otro tipo específico de movement sin diseño previo.

La integración exacta pertenece al diseño conjunto:

Healthcare
+
Inventory

87. Double-decrement invariant

Debe mantenerse:

El sistema nunca debe descontar dos veces la misma existencia física por confundir custodia temporal con consumo o disposición comercial.

Riesgo conceptual:

Dispatch custody handling
↓
physical availability changes

later commercial disposition
↓
must not decrement same physical inventory again incorrectly

88. Commercial integration CURRENT boundary

ERP Core utiliza actualmente:

Sale

como modelo comercial CURRENT.

Healthcare todavía no implementa:

Reconciliation
↓
Sale

ni otro handoff comercial automático.

89. Commercial integration TARGET

A largo plazo ADR-011 define:

SalesOrder
↓
Delivery

como arquitectura comercial objetivo.

Healthcare deberá integrarse con esa arquitectura cuando exista.

No debe documentarse actualmente como flujo implementado.

90. Case before or after commercial commitment

El proceso real puede admitir distintos órdenes.

Ejemplo conceptual:

commercial operation
↓
Healthcare Case

o:

Healthcare Case
↓
Reconciliation
↓
commercial consequence

La integración exacta se diseñará posteriormente.

91. Billing boundary

Healthcare no reemplaza Billing.

Debe mantenerse:

Case
≠
Invoice

El cierre operativo de un Case no debe depender automáticamente de que exista una Invoice.

92. Payer / Billing FUTURE

La futura relación de Payer deberá diseñarse con Billing.

No debe introducirse un workflow de seguros improvisado dentro de HealthcareCase.

93. Warehouse Operations TARGET

Healthcare podrá beneficiarse de un workspace:

Warehouse Operations

orientado a tareas.

Puede coordinar progresivamente:

Purchase Receipts

Case Requirements

Preparation

Equipment Assignment

Dispatch

Return

Inspection

Equipment

según los dominios implementados.

94. Warehouse Operations is a workspace

Debe mantenerse:

Warehouse Operations
→ task-oriented workspace

No:

Warehouse Operations
→ new duplicated domain

Las reglas continúan perteneciendo a sus módulos propietarios.

95. Healthcare Dashboard TARGET

Una futura Company con Healthcare habilitado podrá tener contexto como:

Cases today

Cases tomorrow

Cases not ready

Equipment conflicts

Pending reconciliation

Actualmente:

Healthcare Dashboard widgets
→ NOT IMPLEMENTED

96. Core Dashboard boundary

Una Company que no utiliza Healthcare no debe recibir automáticamente widgets de:

Cases

Doctors

Hospitals

Case Logistics

en su Dashboard Core.

97. Case 360 TARGET

La futura experiencia principal de un Case podrá integrar:

Case identity

Schedule

Actors

Requirements

Commercial context

Preparation

Equipment Assignment

CaseKit

Dispatch

Return

Reconciliation

Timeline

Actualmente:

Case 360
→ NOT IMPLEMENTED

98. Case 360 actions

Las acciones contextuales deberán derivarse del lifecycle real que exista cuando se implementen los workflows logísticos.

No deben fijarse hoy CTAs basados en estados todavía no aprobados.

99. No repeated data entry

Debe mantenerse como principio UX:

known Case context
→ reused by downstream workflows

Si Case ya conoce información como responsable o schedule, los workflows posteriores no deben pedirla nuevamente sin necesidad.

100. UUID and business identifiers

Healthcare utiliza UUID para identidad técnica siguiendo ADR-004.

Cuando aporte valor operacional, entidades como Case o Dispatch podrán tener folios empresariales.

CURRENT HealthcareCase ya utiliza folio.

101. Multi-tenancy

Todo dato Healthcare debe pertenecer directa o indirectamente a:

Company

102. Cross-tenant relations

Debe rechazarse cualquier relación como:

Case Company A
↓
resource Company B

para recursos tenant-owned.

Esto aplicará progresivamente a:

Doctor

Hospital

Product

EquipmentAsset

responsible User

Assignments

según sus modelos definitivos.

103. Authorization

Healthcare deberá continuar aplicando:

Authentication

Authorization

Tenant Isolation

Validation

Business Rules

El backend permanece como autoridad.

104. Permission model TARGET

Permisos conceptuales futuros pueden incluir:

healthcare.cases.read

healthcare.cases.create

healthcare.cases.update

healthcare.requirements.manage

healthcare.equipment.assign

healthcare.dispatch.create

healthcare.dispatch.confirm

healthcare.return.create

healthcare.inspect

healthcare.reconcile

Los nombres definitivos deberán coordinarse con la arquitectura RBAC.

105. Separation of duties TARGET

Una Company puede requerir:

Technician
→ request / receive custody

Warehouse
→ prepare / dispatch / receive

Manager
→ resolve incidents

No debe asumirse un único rol para toda la operación.

106. Backend authority

Frontend podrá simplificar el workflow.

Backend deberá validar según corresponda:

tenant

permissions

Case status

quantities

batches

serials / assets

assignment

custody

reconciliation

107. Concurrency TARGET

Healthcare deberá contemplar conflictos como:

same EquipmentAsset
→ overlapping Cases

o, cuando existan reservas:

same inventory quantity
→ allocated to multiple Cases

La estrategia técnica de locking/reservation no se define todavía.

108. Idempotency TARGET

Operaciones futuras críticas como:

confirm Dispatch

confirm Return

confirm Reconciliation

deberán protegerse contra duplicación por retries.

Esto es un requirement TARGET de confiabilidad.

109. Audit TARGET

Eventos candidatos:

Case created

Case scheduled

Case responsible User changed

Requirement changed

Equipment assigned

CaseKit prepared

Dispatch confirmed

Custody accepted

Return registered

Inspection completed

Reconciliation confirmed

Incident resolved

Actualmente:

transversal Audit platform
→ NOT IMPLEMENTED

110. Audit minimization

Cuando Audit exista deberá almacenar únicamente contexto operacional necesario.

No debe convertirse en una vía para acumular información clínica innecesaria.

111. Integración con Products

Healthcare reutiliza:

Product

como catálogo común.

No debe crear un segundo catálogo Healthcare completo.

112. Healthcare Product Profile FUTURE

Si algunos Products requieren atributos específicos Healthcare, podrá diseñarse una extensión separada.

No debe llenarse Product de campos especializados sin revisar la frontera del dominio.

113. Integración con InventoryBatch

Healthcare deberá reutilizar:

InventoryBatch

para trazabilidad por lote cuando el workflow lo requiera.

No debe crear un segundo sistema de lotes.

114. Integración con serial identity

Cuando exista una identidad serializada aplicable, Healthcare deberá reutilizarla.

No debe crear un segundo sistema de seriales únicamente para Case Logistics.

115. Integración con Customers

Customer permanece como contraparte comercial.

Healthcare Case podrá relacionarse con Customer cuando el workflow lo requiera.

No debe exigirse Customer para crear un Case únicamente para forzar una relación comercial antes de tiempo.

116. Integración con Equipment

Healthcare reutiliza:

EquipmentAsset

para identidad física.

Healthcare es propietario futuro de:

Assignment

Case relationship

custody

dispatch / return operational context

No de la identidad base del EquipmentAsset.

117. Integración con Commercial Returns

Commercial Return y Healthcare CaseReturn son dominios distintos.

Debe mantenerse:

Commercial Return
→ ERP commercial domain

CaseReturn
→ Healthcare custody domain

118. Integración con Dashboard

Dashboard podrá consumir Healthcare Read Models.

Healthcare no debe mover reglas del dominio hacia Dashboard.

119. Roadmap de implementación Healthcare

El roadmap técnico aprobado después del cierre ERP Core es:

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

Este es un orden de implementación, no el orden temporal de una operación real.

120. Project sequence

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

La existencia de diseño Healthcare no autoriza a introducir nuevos modelos Prisma durante H8.

121. CURRENT

Actualmente:

HealthcareCase Foundation
✅

HealthcareCaseStatus
DRAFT / SCHEDULED / CANCELLED
✅

Case folio
✅

Case scheduling context
✅

responsible User
✅

tenant isolation
✅

RBAC
✅

Case cancellation
✅

EquipmentAsset ERP Core
✅

EquipmentInspection ERP Core
✅

122. CURRENT technical debt

Healthcare Case create idempotency
⏳

Doctor / Hospital tenancy model decision
⏳ before implementation

No deben confundirse con workflows TARGET todavía inexistentes.

123. TARGET

Capacidades Healthcare objetivo:

Doctor / Hospital

Case Requirements

Equipment Assignment

Case Availability

Preparation

CaseKit / Maletín

CaseDispatch / Custody

CaseReturn

Healthcare material inspection

Reconciliation

Incident handling

Case Calendar

Case 360

Warehouse Operations integration

Healthcare Dashboard context

124. FUTURE

Capacidades posteriores:

Opportunity CRM

Payer workflows

Insurance authorization

KitTemplate

Reservations

Equipment maintenance expansion

Calibration workflows

QR workflows

Mobile technician app

Electronic signatures

Document management

Notifications

Advanced analytics

AI assistance

125. Invariantes principales

Healthcare
→ belongs to one Company context

HealthcareCase
≠
clinical record

Doctor
≠
Customer by definition

Hospital
≠
Customer by definition

Payer
≠
Customer by definition

Opportunity
≠
HealthcareCase

Opportunity
→ optional

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
automatic Inventory OUT

EquipmentAsset
→ ERP Core identity

Equipment Assignment
→ Healthcare operational relationship

ASSIGNED / IN_CUSTODY
→ must not be forced into EquipmentLifecycle

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

Dispatched
=
Used + Returned + Unresolved

same physical inventory
→ must never be decremented twice

126. Anti-patrones

Case as clinical record

Incorrecto almacenar historia clínica detallada sin una necesidad operacional aprobada.

Doctor as Customer

Incorrecto forzar:

Doctor
→ Customer

para poder crear Case.

Hospital as Customer

Incorrecto forzar:

Hospital
→ Customer

cuando la contraparte comercial sea distinta.

Opportunity required before Case

Incorrecto:

HealthcareCase
→ requires Opportunity

HealthcareCase debe poder existir de forma independiente.

Equipment identity duplicated in Healthcare

Incorrecto crear un segundo modelo de activo en Healthcare cuando ya existe:

EquipmentAsset

en ERP Core.

Assignment as Equipment lifecycle

Incorrecto:

EquipmentLifecycle = ASSIGNED

o:

EquipmentLifecycle = IN_CUSTODY

para representar una relación operacional temporal.

CaseDispatch as Sale

Incorrecto convertir automáticamente cada salida a procedimiento en una Sale.

CaseDispatch as Delivery

Incorrecto tratar custodia temporal como fulfillment comercial.

Commercial OUT on Dispatch

Incorrecto descontar definitivamente Inventory únicamente porque el material salió en custodia.

Double decrement

Incorrecto descontar la misma existencia en Dispatch y nuevamente al registrar su consecuencia comercial.

CaseKit as Inventory

Incorrecto tratar CaseKit como stock físico o movimiento por sí mismo.

Requirements as prepared quantity

Incorrecto reescribir el requerimiento porque Warehouse preparó menos o más.

Product stock as Equipment identity

Incorrecto intentar conocer qué Equipment está asignado únicamente mediante una cantidad agregada.

Return directly available

Incorrecto reintegrar automáticamente todo material retornado a disponibilidad cuando necesita inspección.

Healthcare logic inside ERP Core

Incorrecto agregar a entidades genéricas campos especializados como:

doctorId

hospitalId

currentCaseId

currentCustodianId

únicamente para evitar diseñar el dominio Healthcare.

One giant HealthcareCase model

Incorrecto convertir HealthcareCase en una tabla que contenga simultáneamente:

commercial

inventory

equipment

dispatch

return

billing

insurance

audit

sin fronteras de dominio.

Target documented as Current

Incorrecto presentar como CURRENT:

Doctor

Hospital

Requirements

Assignment

Dispatch

Return

Reconciliation

Calendar UI

Case 360

mientras no estén implementados.

127. ADR relacionados

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

ADR-013 es la decisión principal para separar:

Healthcare custody

de:

commercial Inventory OUT

128. Documentos relacionados

docs/product/PRODUCT_VISION.md

docs/product/PRODUCT_REQUIREMENTS.md

docs/product/ZAPING_WAY.md

docs/architecture/ARCHITECTURE.md

docs/architecture/adr/ADR-013-inventory-custody-case-logistics.md

docs/engineering/API_GUIDELINES.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/modules/erp/PRODUCTS.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/QUOTES.md

docs/modules/erp/SALES.md

docs/modules/erp/DASHBOARD.md

docs/modules/healthcare/DOMAIN_MODEL.md

docs/modules/healthcare/CASES.md

Documentos especializados futuros pueden incluir:

DOCTORS_HOSPITALS.md

CASE_REQUIREMENTS.md

EQUIPMENT_ASSIGNMENT.md

CASE_AVAILABILITY.md

CASE_KITS.md

CASE_LOGISTICS.md

CASE_CALENDAR.md

según la evolución real del proyecto.

129. Fuente de verdad

HEALTHCARE.md
→ Healthcare boundaries
→ CURRENT / TARGET / FUTURE split
→ general operational workflow

CASES.md
→ CURRENT HealthcareCase behavior
→ Case lifecycle

DOMAIN_MODEL.md
→ Healthcare entity boundaries

EQUIPMENT.md
→ ERP Core EquipmentAsset identity / lifecycle / condition

INVENTORY.md
→ physical inventory semantics

SALES.md
→ CURRENT Sale behavior
→ TARGET SalesOrder / Delivery direction

ADR-013
→ Healthcare custody vs commercial OUT architecture

schema.prisma
→ CURRENT implemented persistence only

backend
→ CURRENT Healthcare Case implementation

tests
→ validated behavior

PROJECT_BOARD.md
→ active implementation status / technical debt

130. Principio final

El centro de Zaping Healthcare no es únicamente:

a procedure

ni:

a Sale

ni:

an InventoryMovement

Es la coordinación de una operación completa.

CURRENT:

HealthcareCase Foundation
+
ERP Equipment identity

TARGET:

Case
↓
Requirements
↓
Preparation
↓
Assignment / CaseKit
↓
Custody
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

Debe mantenerse separada la verdad de:

what was planned

what was required

what was prepared

what was assigned

what left

who had custody

what was used

what returned

what remains unresolved

what became a commercial consequence

Zaping Healthcare debe conectar operación, inventario y negocio sin confundir custodia temporal con consumo, sin convertir Equipment Assignment en lifecycle del activo y sin transformar Healthcare Case en un expediente clínico.
