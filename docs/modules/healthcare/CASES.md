# Healthcare Cases — Zaping

**Módulo:** Healthcare Cases
**Producto:** Zaping Healthcare
**Versión:** 1.0.0
**Estado:** Aprobado
**Estado de implementación:** DOMAIN DESIGN / NOT IMPLEMENTED
**Última actualización:** 2026-08-20
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Healthcare Case representa la unidad operacional principal de Zaping Healthcare.

Un Case permite coordinar una operación Healthcare concreta relacionada con un procedimiento o evento que requiere combinar:

```text
agenda
+
personas
+
Hospital
+
material
+
Equipment
+
custodia
+
reconciliación
+
contexto comercial
```

Su objetivo es responder:

```text
¿Qué operación estamos coordinando?
¿Cuándo ocurrirá?
¿Dónde?
¿Con qué Doctor?
¿Quién es responsable?
¿Qué necesita prepararse?
¿Qué salió del almacén?
¿Qué ocurrió con el material?
¿Qué falta resolver?
¿La operación ya está cerrada?
```

---

# 2. Principio fundamental

Healthcare Case representa:

> **la coordinación operacional de un procedimiento Healthcare.**

No representa por sí mismo:

```text
una oportunidad
una cotización
una venta
una entrega comercial
una factura
un expediente clínico
```

---

# 3. Case como agregado operacional

Conceptualmente:

```text
Healthcare Case
│
├── Schedule
├── Doctor
├── Hospital
├── Technician
├── Procedure Context
├── Commercial Context
├── Preparation
├── CaseKit
├── Dispatches
├── Returns
├── Reconciliation
└── Equipment
```

No todos estos conceptos necesariamente serán columnas directas del mismo modelo.

---

# 4. Case no es un modelo gigante

El Case debe funcionar como punto de coordinación.

No debe absorber dentro de una sola tabla toda la información de:

```text
CaseKit
Dispatch
Inventory
Return
Equipment
Sales
Billing
Audit
```

Cada subdominio debe conservar su propia responsabilidad.

---

# 5. Relación con Opportunity

Un Case puede originarse desde:

```text
Healthcare Opportunity
```

pero esa relación es opcional.

Flujo válido:

```text
Opportunity
↓
Case
```

---

# 6. Case directo

También debe ser válido:

```text
Doctor contacts Technician
↓
procedure confirmed
↓
Case
```

sin crear una Opportunity artificial.

---

# 7. Regla

> **Opportunity es útil cuando existe incertidumbre comercial; Case es correcto cuando ya existe una operación suficientemente concreta que coordinar.**

---

# 8. Case no requiere Opportunity

No debe existir una regla:

```text
Every Case
→ must have Opportunity
```

---

# 9. Case y Quote

Un Case puede relacionarse posteriormente con una Quote.

Ejemplos válidos:

```text
Opportunity
↓
Quote
↓
Case
```

```text
Opportunity
↓
Case
↓
Quote
```

```text
Case
↓
Quote
```

---

# 10. Case y SalesOrder

También puede relacionarse con una operación comercial ya confirmada:

```text
SalesOrder
↓
Case
```

cuando el proceso comercial ocurre antes del procedimiento.

---

# 11. Case antes de SalesOrder

En otras operaciones:

```text
Case
↓
Procedure
↓
Reconciliation
↓
SalesOrder / Delivery
```

puede representar mejor el proceso real.

---

# 12. No imponer un único orden comercial

Healthcare no debe asumir que siempre existe:

```text
Quote
↓
SalesOrder
↓
Case
```

ni:

```text
Case
↓
Quote
↓
SalesOrder
```

El proceso comercial puede variar.

---

# 13. El Case continúa siendo operacional

Independientemente del orden comercial:

```text
Case
→ coordina la operación Healthcare
```

mientras:

```text
Quote
SalesOrder
Delivery
Invoice
```

pertenecen a sus respectivos dominios.

---

# 14. Información conceptual del Case

Un Case puede requerir información semejante a:

```text
id
companyId
folio
title / summary

opportunityId?
doctorId?
hospitalId?
technicianId?

procedureType?
scheduledStart?
scheduledEnd?

status
readiness

customerId?
payer context?

operational notes

createdAt
updatedAt
```

La estructura anterior no representa todavía el schema Prisma definitivo.

---

# 15. UUID

El identificador técnico seguirá ADR-004:

```text
Case.id
→ UUID
```

---

# 16. Folio

Para operación humana es recomendable contar con un folio.

Ejemplo:

```text
CASE-000145
```

o una convención empresarial futura.

---

# 17. UUID vs folio

```text
UUID
→ identity técnica
```

```text
folio
→ identity operacional
```

No deben confundirse.

---

# 18. Folio tenant-aware

Si se implementa folio secuencial:

```text
Company A
CASE-000001
```

y:

```text
Company B
CASE-000001
```

podrían coexistir si esa estrategia se aprueba.

La definición técnica debe seguir las reglas de folios empresariales de Zaping.

---

# 19. Título

Puede existir un resumen legible como:

```text
Implante — Dr. X — Hospital ABC
```

sin depender únicamente de notas libres.

---

# 20. El título no sustituye relaciones

No debe almacenarse únicamente:

```text
"Cirugía Dr. X Hospital ABC"
```

y perder relaciones estructuradas con Doctor y Hospital.

---

# 21. Doctor

Case puede relacionarse con el Doctor principal del procedimiento.

---

# 22. Doctor como contexto operacional

Doctor ayuda a:

* identificar el Case;
* preparar material;
* comprender preferencias;
* buscar historial;
* organizar agenda;
* relacionar futuras oportunidades.

---

# 23. Doctor no es Customer

Se mantiene:

```text
Doctor
≠
Customer
```

---

# 24. Doctor requerido

En la operación Healthcare típica, Doctor probablemente será un dato muy importante.

Sin embargo, este documento no declara todavía:

```text
doctorId NOT NULL
```

hasta cerrar el modelo específico de Doctors/Hospitals.

---

# 25. Razón

Puede existir un Case originado por un Hospital donde inicialmente:

```text
Doctor
→ pendiente de asignar
```

---

# 26. Requisito operacional posterior

Aunque Doctor pueda faltar inicialmente, el workflow puede exigirlo antes de determinadas etapas.

Ejemplo:

```text
Case Draft
→ Doctor pendiente permitido

Case scheduled / prepared
→ Doctor requerido
```

si los casos reales confirman esa necesidad.

---

# 27. Hospital

Case debe relacionarse con el lugar u organización donde ocurrirá la operación cuando se conozca.

---

# 28. Hospital no es Customer

Se mantiene:

```text
Hospital
≠
Customer
```

---

# 29. Hospital como contexto logístico

Hospital puede influir en:

* ubicación;
* horario;
* acceso;
* preparación;
* Equipment;
* documentos;
* contactos;
* tiempos de traslado.

---

# 30. Customer

Case puede relacionarse con Customer cuando se conozca la contraparte comercial.

---

# 31. Customer opcional inicialmente

Un Case no debe quedar bloqueado únicamente porque todavía no esté determinado:

```text
quién será facturado
```

si la operación Healthcare ya necesita coordinarse.

---

# 32. Payer

Payer también puede conocerse antes o después.

---

# 33. Payer no bloquea operación logística

No debe impedirse preparar un Case porque:

```text
insurance authorization
```

o el Payer definitivo todavía estén pendientes, salvo que la empresa defina explícitamente esa regla.

---

# 34. Separación

```text
Doctor
→ medical demand context

Hospital
→ procedure location / organization

Customer
→ commercial counterpart

Payer
→ economic responsibility

Technician
→ operational responsibility
```

Estas relaciones pueden coincidir parcialmente en una operación, pero no son conceptualmente equivalentes.

---

# 35. Technician

Case debe tener un responsable operacional principal cuando corresponda.

En el modelo inicial se denomina conceptualmente:

```text
Technician
```

---

# 36. Technician y User

El Technician probablemente deberá relacionarse con una identidad interna de Zaping.

Pero aún debe decidirse si será:

```text
User with Healthcare profile
```

o:

```text
separate Technician entity linked to User
```

---

# 37. No crear un User duplicado

No debe existir:

```text
User Leonardo
+
Technician Leonardo
```

como identidades desconectadas para la misma persona sin una razón de dominio.

---

# 38. Technician principal

Case debería permitir identificar claramente:

```text
responsible technician
```

---

# 39. Participantes adicionales

En el futuro podría existir:

```text
secondary technician
support personnel
salesperson
```

pero no debe sobrearquitectarse la primera versión.

---

# 40. Procedure Context

Case debe describir qué tipo de procedimiento o necesidad operacional se atenderá.

---

# 41. Procedure no es información clínica profunda

Ejemplo válido:

```text
Implante de marcapasos
```

como categoría operacional.

No implica almacenar:

```text
diagnóstico completo
tratamiento médico
historia clínica
```

---

# 42. Procedure Catalog futuro

Puede ser útil un catálogo:

```text
ProcedureType
```

que permita definir posteriormente:

* nombre;
* categoría;
* KitTemplate sugerido;
* Equipment frecuente;
* duración estimada.

---

# 43. No bloquear Foundation

Un catálogo ProcedureType no debe ser requisito para comenzar la primera implementación si texto estructurado/simple es suficiente.

---

# 44. Patient Data

La primera versión de Healthcare Case **no debe requerir datos personales de paciente**.

---

# 45. Regla de minimización

No agregar inicialmente campos como:

```text
patientName
patientBirthDate
diagnosis
medicalRecord
```

sin un requisito operacional real.

---

# 46. Referencia externa futura

Si posteriormente se demuestra que la empresa necesita identificar un procedimiento contra un sistema hospitalario, puede evaluarse:

```text
externalCaseReference
```

u otra referencia mínima.

---

# 47. Revisión de privacidad

Cualquier incorporación futura de datos de paciente debe pasar por revisión específica de:

```text
necessity
privacy
security
retention
permissions
audit
```

---

# 48. Scheduling

Case es propietario de su planificación temporal.

Conceptualmente puede necesitar:

```text
scheduledStart
scheduledEnd
```

---

# 49. Case Calendar

`Case Calendar` consume estos datos.

Conceptualmente:

```text
Case.schedule
↓
Case Calendar Read Model
```

---

# 50. Calendar no es propietario del schedule

No debe ocurrir:

```text
CalendarEvent
→ source of truth
```

mientras:

```text
Case
```

desconoce cuándo ocurre.

---

# 51. Fecha y hora

Los procedimientos requieren timestamps, no únicamente fechas.

Ejemplo:

```text
2026-09-12
08:30
```

---

# 52. Timezone

La interpretación deberá respetar:

```text
Company.timezone
```

según la política temporal de Zaping.

---

# 53. scheduledStart

Representa el inicio planificado.

---

# 54. scheduledEnd

Puede representar:

* duración esperada;
* ventana de uso del Technician;
* ventana de Equipment;
* detección de conflictos.

---

# 55. End opcional

La primera versión puede permitir que `scheduledEnd` sea opcional si la empresa no lo conoce con precisión.

Pero eso limita detección de conflictos.

---

# 56. Duración estimada

Otra estrategia futura puede utilizar:

```text
scheduledStart
+
estimatedDuration
```

La decisión final pertenece al diseño técnico.

---

# 57. Expected Date vs Schedule

Debe mantenerse:

```text
Opportunity.expectedDate
≠
Case.scheduledStart
```

---

# 58. Schedule confirmado

Cuando se crea Case desde Opportunity, una fecha estimada puede prellenar el schedule.

Pero el usuario debe poder confirmar/corregirla.

---

# 59. Reprogramación

Debe existir un workflow explícito para:

```text
Reschedule Case
```

---

# 60. Reprogramar no crea nuevo Case

Si el mismo procedimiento cambia de horario:

```text
Case 145
Sep 12
↓
rescheduled
↓
Sep 13
```

sigue siendo:

```text
Case 145
```

---

# 61. Historial de reprogramación

Idealmente debe conservarse posteriormente información como:

```text
old schedule
new schedule
actor
timestamp
reason?
```

mediante Audit o un historial apropiado.

---

# 62. No reescribir historia silenciosamente

Cambiar el schedule no debería hacer imposible saber que hubo una reprogramación cuando esa información sea operacionalmente relevante.

---

# 63. Cases recurrentes

Cada procedimiento real debe representarse como un Case independiente.

---

# 64. Anti-patrón

No crear:

```text
Case "Cirugías Dr. X"
```

y utilizarlo durante meses para múltiples procedimientos.

---

# 65. Un procedimiento → un Case

Como regla conceptual inicial:

> **Cada ocurrencia operacional relevante debe tener su propio Case.**

---

# 66. Lifecycle vs Readiness

Esta separación es fundamental.

```text
Lifecycle Status
→ en qué etapa está el Case
```

```text
Readiness
→ si está preparado para ejecutarse
```

---

# 67. Refinamiento de HEALTHCARE.md

`HEALTHCARE.md` utilizó conceptualmente:

```text
READY
```

dentro del lifecycle inicial.

Este documento refina esa idea.

La recomendación actual es:

> **READY debe tratarse preferentemente como una condición de readiness, no necesariamente como un estado principal del lifecycle.**

---

# 68. Razón

Un Case puede estar:

```text
SCHEDULED
```

pero:

```text
NOT_READY
```

---

# 69. Ejemplo

```text
Case
Status: SCHEDULED

Readiness:
Technician        ✓
Hospital          ✓
CaseKit           ✗
Equipment         ✓
Documents         ✗
```

---

# 70. Lifecycle conceptual

Una primera semántica puede ser:

```text
DRAFT
↓
SCHEDULED
↓
IN_PROGRESS
↓
RECONCILIATION_PENDING
↓
COMPLETED
```

con:

```text
CANCELLED
```

como salida alternativa.

---

# 71. No es enum Prisma aprobado

Los nombres anteriores representan el comportamiento que necesitamos.

No se deben crear aún automáticamente en `schema.prisma`.

---

# 72. DRAFT

Case existe pero todavía puede faltar información necesaria para planificación operacional.

Ejemplos:

```text
Hospital pendiente
schedule pendiente
Technician pendiente
```

---

# 73. DRAFT no significa Opportunity

Un Case Draft sigue siendo una operación identificable.

Una Opportunity representa todavía incertidumbre sobre si la operación ocurrirá.

---

# 74. Cuándo crear Case

La pregunta recomendada es:

> **¿Ya existe una operación que alguien necesita coordinar?**

Si sí:

```text
Case
```

Si todavía estamos evaluando una posibilidad:

```text
Opportunity
```

---

# 75. SCHEDULED

Representa que existe una fecha/hora operacional aceptada.

---

# 76. SCHEDULED no significa preparado

Puede existir:

```text
SCHEDULED
+
NOT_READY
```

---

# 77. IN_PROGRESS

Representa que la operación/procedimiento está ocurriendo o ha iniciado desde el punto de vista operacional.

---

# 78. No registrar información clínica

`IN_PROGRESS` no requiere documentar lo que médicamente está sucediendo.

Solo su estado operacional.

---

# 79. Procedure Completion

Al concluir el procedimiento puede ocurrir:

```text
Case
↓
procedure completed
↓
material reconciliation required
```

---

# 80. RECONCILIATION_PENDING

Representa que el procedimiento operativo terminó, pero todavía deben resolverse:

* material utilizado;
* material devuelto;
* Equipment;
* inspecciones;
* diferencias;
* incidencias.

---

# 81. Importancia

El Case no debe considerarse completamente cerrado únicamente porque:

```text
la cirugía terminó
```

si todavía existe material bajo custodia o sin reconciliar.

---

# 82. COMPLETED

Case puede considerarse operacionalmente completado cuando:

```text
procedure ended
+
custody resolved
+
returns processed
+
reconciliation complete
+
no blocking unresolved items
```

según las reglas de `CASE_LOGISTICS.md`.

---

# 83. COMPLETED no significa facturado

Debe mantenerse:

```text
Case COMPLETED
≠
Invoice paid
```

---

# 84. COMPLETED no significa Sales closed

También puede existir:

```text
Case COMPLETED
+
commercial follow-up pending
```

---

# 85. Separación

```text
Case closure
→ operational/logistical closure
```

```text
Sales closure
→ commercial lifecycle
```

```text
Invoice/payment
→ financial lifecycle
```

---

# 86. CANCELLED

Representa que el procedimiento/operación ya no ocurrirá.

---

# 87. Cancelación conserva historia

Un Case cancelado:

```text
→ remains in system
```

No debe eliminarse para desaparecer del Calendar.

---

# 88. Cancel reason

Puede ser útil registrar:

```text
cancelReason
```

o un reason code futuro.

---

# 89. Ejemplos

```text
Procedure cancelled
Doctor unavailable
Hospital rescheduled indefinitely
Patient no longer proceeds
Material unavailable
Commercial cancellation
Other
```

Debe evitarse almacenar detalle clínico innecesario.

---

# 90. Cancelación antes de Dispatch

Conceptualmente:

```text
Case
↓
CANCELLED
```

es relativamente simple si todavía no existe material bajo custodia.

---

# 91. Cancelación después de Dispatch

Si ya existe:

```text
CaseDispatch
```

la cancelación no puede ignorar el material que salió.

Debe primero garantizar:

```text
custody
↓
return
↓
inspection
↓
reconciliation
```

según corresponda.

---

# 92. Regla

> **Cancelar el Case no elimina obligaciones logísticas existentes.**

---

# 93. Readiness

Readiness responde:

```text
¿Está este Case preparado para ejecutarse?
```

---

# 94. Readiness conceptual

Puede representarse inicialmente como:

```text
NOT_READY
PARTIALLY_READY
READY
BLOCKED
```

o mediante indicadores derivados.

El modelo definitivo se definirá en `CASE_CALENDAR.md` y `CASE_KITS.md`.

---

# 95. Preferencia por derivación

Siempre que sea posible, Readiness debería derivarse de hechos reales.

Ejemplo:

```text
required CaseKit prepared
+
required Equipment assigned
+
Technician assigned
+
required data complete
=
READY
```

---

# 96. Evitar status manual falso

Incorrecto:

```text
User clicks "READY"
```

aunque:

```text
CaseKit incomplete
Equipment missing
```

---

# 97. Readiness checklist

Una futura vista puede mostrar:

```text
Schedule        ✓
Hospital        ✓
Doctor          ✓
Technician      ✓
CaseKit         ✗
Equipment       ✓
Documents       ○
```

---

# 98. Bloqueadores

Readiness debe poder explicar:

```text
¿Por qué no está listo?
```

---

# 99. Ejemplo

```text
NOT READY

Missing:
- CaseKit preparation
- Equipment EQ-004 unavailable
```

---

# 100. Preparation eligibility

Un Case puede pasar a Preparation cuando exista suficiente información para que almacén sepa:

```text
qué operación
cuándo
dónde
quién es responsable
qué se necesita preparar
```

---

# 101. Datos mínimos conceptuales para Preparation

Normalmente:

```text
Case identity
schedule sufficiently known
Hospital / destination
responsible Technician
material/equipment requirements
```

---

# 102. Doctor para Preparation

Doctor puede ser importante para preferencias y contexto.

La obligatoriedad exacta deberá validarse con el workflow Healthcare real.

---

# 103. Customer no requerido para Preparation

Debe ser posible preparar material aunque todavía esté pendiente:

```text
Customer
```

si la operación lo permite.

---

# 104. Payer no requerido para Preparation

También:

```text
Payer
```

no debe bloquear preparación por defecto.

---

# 105. Business blockers configurables

En el futuro una Company podría decidir:

```text
No preparar sin autorización comercial
```

pero esto debe ser una política explícita.

No una dependencia universal de Healthcare.

---

# 106. CaseKit

Un Case puede tener un CaseKit específico.

---

# 107. CaseKit no debe vivir como JSON dentro de Case

Incorrecto:

```text
HealthcareCase.caseKitJson
```

como sustituto permanente de un agregado CaseKit real.

---

# 108. Multiple CaseKits

Debe evaluarse si un Case puede requerir más de un CaseKit.

Ejemplos:

```text
consumables kit
instrument kit
backup kit
```

La primera versión puede mantener simplicidad si un solo CaseKit agregado es suficiente.

---

# 109. Dispatch

Un Case puede tener uno o más Dispatches.

---

# 110. Múltiples Dispatches

Debe permitirse conceptualmente:

```text
Initial Dispatch
+
Additional Dispatch
```

si durante el procedimiento se requiere material extra.

---

# 111. No asumir un único maletín

La operación real puede requerir:

```text
Case
↓
multiple physical movements
```

---

# 112. CaseReturn

De igual forma puede haber más de un retorno físico relacionado con el mismo Case.

---

# 113. Reconciliation agregada

El Case debe poder conocer si todas sus operaciones logísticas están reconciliadas.

---

# 114. Case closure invariant

Para cierre normal:

```text
all Dispatch quantities resolved
+
all Equipment custody resolved
+
required inspections completed
```

---

# 115. Unresolved

Si existe:

```text
Unresolved > 0
```

el Case debería permanecer:

```text
RECONCILIATION_PENDING
```

salvo resolución autorizada.

---

# 116. Equipment

Case puede requerir Equipment reutilizable.

---

# 117. Equipment assignment

Asignar Equipment debe permitir verificar:

```text
availability
schedule conflict
condition
custody
```

cuando esas capacidades existan.

---

# 118. Equipment no es consumible

No debe mezclarse:

```text
Product quantity
```

con:

```text
EquipmentAsset identity
```

---

# 119. Calendar conflict

Un Case puede estar correctamente agendado y aun así presentar:

```text
Equipment conflict
```

---

# 120. Technician conflict

También:

```text
same Technician
+
overlapping Cases
```

debe ser detectable.

---

# 121. Conflicto no necesariamente bloquea creación

Puede permitirse crear el Case y marcar:

```text
BLOCKED / CONFLICT
```

en lugar de impedir capturarlo completamente.

---

# 122. Razón

La operación puede estar confirmada aunque todavía deba resolverse la asignación.

---

# 123. Commercial Context

Case debe permitir navegar a su información comercial sin duplicarla.

Puede mostrar:

```text
Opportunity
Quote
SalesOrder
Delivery
Invoice future
```

cuando existan.

---

# 124. No copiar totales

Case no debe almacenar permanentemente copias como:

```text
quoteTotal
salesTotal
invoiceTotal
```

si esos valores pertenecen a otros documentos.

---

# 125. Used Material

Después del procedimiento, la reconciliación determinará material utilizado.

---

# 126. Used no significa Invoice

Debe mantenerse:

```text
Used Material
→ operational truth
```

separado de:

```text
Invoice
→ financial document
```

---

# 127. Used y Delivery

La arquitectura deberá definir cómo material utilizado genera o se relaciona con Delivery sin producir doble movimiento.

---

# 128. Case no modifica stock directamente

Nunca:

```text
CaseService
↓
product.stock -= quantity
```

---

# 129. Inventory integration

Las consecuencias físicas deben pasar por la arquitectura Inventory/Custody aprobada.

---

# 130. Ownership

Todo Case pertenece a una Company.

---

# 131. Tenant Context

Conceptualmente:

```text
Authenticated User
↓
Company
↓
Healthcare Case
```

---

# 132. Relaciones cross-tenant

Nunca:

```text
Case Company A
→ Product Company B
```

o:

```text
Case Company A
→ Technician Company B
```

---

# 133. Doctor/Hospital ownership pendiente

Cuando diseñemos Doctors/Hospitals deberá definirse cómo se garantiza esta frontera.

---

# 134. Authorization

Permisos conceptuales futuros pueden incluir:

```text
healthcare.cases.read
healthcare.cases.create
healthcare.cases.update
healthcare.cases.schedule
healthcare.cases.assign
healthcare.cases.start
healthcare.cases.cancel
healthcare.cases.complete
```

---

# 135. Warehouse permissions

Warehouse puede necesitar:

```text
read Case operational context
prepare CaseKit
dispatch
receive return
inspect
```

sin permiso para modificar toda la información comercial.

---

# 136. Technician permissions

Technician puede requerir:

```text
read assigned Cases
acknowledge custody
view CaseKit
register operational result
```

según el diseño final.

---

# 137. Manager

Puede requerir:

* reassign;
* cancel;
* resolve blockers;
* oversee reconciliation.

---

# 138. Least Privilege

No todo usuario Healthcare debe poder modificar:

```text
schedule
commercial links
custody
reconciliation
```

indistintamente.

---

# 139. API

No existen endpoints Healthcare implementados actualmente.

---

# 140. Acciones conceptuales

Una API futura necesitará capacidades equivalentes a:

```text
Create Case
Read Case
Update Draft/allowed fields
Schedule
Reschedule
Assign Technician
Cancel
Start
Register Procedure Completion
Close
```

---

# 141. Business Actions

Las transiciones relevantes deberían preferir acciones empresariales explícitas sobre un:

```text
PATCH status = ...
```

sin reglas.

---

# 142. Ejemplo conceptual

```text
Schedule Case
```

debe validar:

```text
tenant
permissions
date
relationships
current status
```

---

# 143. Start Case

Debe impedirse iniciar un Case:

```text
CANCELLED
COMPLETED
```

---

# 144. Complete Case

No debería permitirse cerrar si existen obligaciones logísticas pendientes.

---

# 145. Idempotencia

Acciones como:

```text
start
cancel
complete
```

deben manejar retries sin producir estados inconsistentes.

---

# 146. Concurrencia

Dos usuarios pueden intentar:

```text
reschedule
assign technician
cancel
```

simultáneamente.

La implementación debe evitar pérdida silenciosa de información crítica.

---

# 147. Optimistic concurrency futuro

Puede evaluarse:

```text
updatedAt
version
```

u otra estrategia si el uso real lo requiere.

---

# 148. Audit

Acciones candidatas:

```text
case.created
case.updated
case.scheduled
case.rescheduled
case.technician_assigned
case.started
case.procedure_completed
case.cancelled
case.completed
```

---

# 149. Datos sensibles en Audit

No registrar información clínica o personal innecesaria.

---

# 150. Case Timeline

Case 360 puede combinar:

```text
Domain events
Audit
Logistics
Commercial documents
```

para mostrar una línea de tiempo útil.

---

# 151. Ejemplo

```text
08:30 Case created
09:10 Technician assigned
10:45 Schedule confirmed
Sep 12 07:00 CaseKit prepared
Sep 12 07:30 Dispatch confirmed
Sep 12 12:20 Procedure completed
Sep 12 14:00 Material returned
Sep 12 15:10 Reconciliation completed
```

---

# 152. Timeline no es fuente de verdad

La línea de tiempo es una vista.

Los documentos de dominio continúan siendo la fuente real.

---

# 153. UX principal

Case debe tener una vista:

```text
Case 360
```

---

# 154. Header

Puede mostrar:

```text
CASE-000145
Status
Readiness
Date / Time
Hospital
Doctor
Technician
Primary Action
```

---

# 155. Sección Context

```text
Procedure
Doctor
Hospital
Technician
Customer
Payer
Opportunity
```

---

# 156. Sección Preparation

```text
Requirements
CaseKit
Equipment
Readiness
Blockers
```

---

# 157. Sección Logistics

```text
Dispatches
Current Custody
Returns
Inspection
Reconciliation
```

---

# 158. Sección Commercial

```text
Opportunity
Quote
SalesOrder
Delivery
Invoice future
```

---

# 159. Sección Timeline

Actividad relevante en orden cronológico.

---

# 160. Primary Action

La acción principal debe depender del estado y contexto.

Ejemplos:

```text
DRAFT
→ Agendar
```

```text
SCHEDULED + NOT_READY
→ Preparar
```

```text
SCHEDULED + READY
→ Ver preparación / Despachar
```

```text
IN_PROGRESS
→ Registrar finalización
```

```text
RECONCILIATION_PENDING
→ Reconciliar
```

```text
COMPLETED
→ Ver resumen
```

---

# 161. Una acción primaria

Seguir `ZAPING_WAY.md`:

> una acción principal clara y acciones secundarias contextuales.

---

# 162. Calendar navigation

Desde Calendar:

```text
Case card
↓
open Case 360
```

---

# 163. Warehouse navigation

Desde Warehouse Operations:

```text
Case requiring preparation
↓
open relevant preparation workspace
```

---

# 164. Doctor history

Desde Doctor futuro:

```text
Doctor 360
↓
Cases
```

sin duplicar Case.

---

# 165. Hospital history

También:

```text
Hospital
↓
Cases
```

---

# 166. Empty / Missing data

Case 360 debe mostrar datos faltantes claramente.

Ejemplo:

```text
Customer
Pendiente de definir
```

No ocultarlos como si fueran errores del sistema.

---

# 167. Blockers

Debe distinguirse:

```text
Missing information
```

de:

```text
Operational blocker
```

---

# 168. Ejemplo

```text
Customer pending
→ informational
```

```text
Required Equipment unavailable
→ operational blocker
```

---

# 169. Notifications futuro

Candidatos:

```text
Case tomorrow not ready
Technician conflict
Equipment conflict
Case rescheduled
Case cancelled
Reconciliation pending
```

---

# 170. Dashboard

Healthcare Dashboard puede mostrar:

```text
Cases today
Cases tomorrow
Not ready
In progress
Reconciliation pending
```

---

# 171. Dashboard metric semantics

No mezclar:

```text
Scheduled Cases
```

con:

```text
Opportunities expected this week
```

---

# 172. Search

Global Search futuro debería permitir localizar Case por:

```text
folio
Doctor
Hospital
Technician
```

respetando permisos.

---

# 173. Mobile

Case es candidato principal para futura experiencia móvil de Technicians.

---

# 174. Mobile priorities

En móvil sería especialmente importante:

```text
Today's Cases
Case details
CaseKit
Custody
Return
Reconciliation
```

---

# 175. Offline future

Trabajo hospitalario podría justificar capacidades offline en el futuro.

No forma parte de la primera implementación.

---

# 176. Attachments futuro

Case puede requerir documentos operativos.

Ejemplos:

```text
hospital instructions
commercial authorization
PDF
photos of returned equipment
```

---

# 177. Document Management

Attachments deberán integrarse con una capacidad transversal futura.

No guardar rutas arbitrarias dentro del Case sin estrategia.

---

# 178. Seguridad de archivos

Todo archivo Healthcare debe respetar:

```text
tenant
permissions
sensitive data minimization
```

---

# 179. Case deletion

Case es un documento operacional/histórico.

No debe utilizarse:

```text
hard delete
```

como lifecycle normal.

---

# 180. Draft creado por error

La política para Cases Draft creados accidentalmente deberá definirse con ADR-012.

Puede requerir:

```text
cancel
```

o una eliminación limitada antes de actividad relevante.

---

# 181. Confirmed Case

Una vez que exista historia operacional:

```text
schedule
dispatch
return
```

el Case debe preservarse.

---

# 182. CURRENT

Actualmente:

```text
Healthcare Case
→ domain design
```

No existe todavía evidencia de:

```text
Prisma model
migration
backend
API
frontend
tests
```

---

# 183. TARGET inicial

La primera implementación debería permitir:

```text
Create Case
↓
Add operational context
↓
Schedule
↓
Assign Technician
↓
Prepare
↓
Execute
↓
Reconcile
↓
Complete
```

---

# 184. Target de primera fase

No necesita incluir inmediatamente:

```text
Billing
Insurance workflows
Advanced patient data
Advanced analytics
Mobile offline
Maintenance
AI
```

---

# 185. FUTURE

Evoluciones posibles:

```text
multi-technician participation
advanced Hospital requirements
external case references
documents
notifications
mobile
AI assistance
performance metrics
advanced scheduling
```

---

# 186. Invariantes

```text
Case
→ one operational occurrence
```

```text
Case
≠
Opportunity
```

```text
Case
≠
Quote
```

```text
Case
≠
SalesOrder
```

```text
Case
≠
Delivery
```

```text
Case
≠
Invoice
```

```text
Case
≠
clinical record
```

```text
Doctor
≠
Customer
```

```text
Hospital
≠
Customer
```

```text
Payer
≠
Customer
```

```text
Case Status
≠
Readiness
```

```text
SCHEDULED
≠
READY
```

```text
Case cancelled
→ historical record remains
```

```text
Case completion
≠
commercial payment completion
```

```text
Case
→ never directly edits Product.stock
```

```text
CaseDispatch
≠
Delivery
```

```text
Unresolved logistics
→ prevents normal operational closure
```

```text
Cross-tenant Case relationships
→ forbidden
```

---

# 187. Anti-patrones

## Case for every lead

Crear Case cuando todavía solo existe una posibilidad comercial.

---

## Opportunity forever

Mantener Opportunity cuando ya existe una operación concreta que coordinar.

---

## Case as clinical record

Agregar información clínica innecesaria.

---

## Customer required too early

Bloquear operación porque todavía no se sabe quién será facturado.

---

## One giant Case table

Guardar todos los items, dispatches, returns y equipment directamente dentro de Case.

---

## READY as manual fiction

Marcar Case listo aunque faltan requisitos.

---

## Schedule in Calendar only

Guardar fecha en un widget/evento independiente y no en Case.

---

## New Case on reschedule

Crear un Case nuevo cada vez que cambia la fecha.

---

## Delete cancelled Case

Eliminarlo del sistema para limpiar la agenda.

---

## Close after procedure only

Marcar `COMPLETED` aunque continúe material sin regresar o reconciliar.

---

## Case completion = invoice

Bloquear cierre operacional hasta recibir pago.

---

## Direct stock mutation

Modificar `Product.stock` desde Cases.

---

## Duplicate sales concepts

Crear:

```text
HealthcareSale
HealthcareDelivery
HealthcareInvoice
```

sin necesidad.

---

# 188. Relación con Opportunities

```text
Opportunity
→ possibility
```

```text
Case
→ concrete operation
```

---

# 189. Relación con Case Calendar

Case mantiene schedule.

Calendar organiza y visualiza Cases en el tiempo.

---

# 190. Relación con CaseKit

CaseKit representa material realmente preparado para ese Case.

---

# 191. Relación con Case Logistics

Case Logistics controla:

```text
Dispatch
Custody
Return
Inspection
Reconciliation
```

---

# 192. Relación con Equipment

Equipment permite asignar activos físicos reutilizables al Case.

---

# 193. Relación con ERP Customers

Customer representa la contraparte comercial.

Puede ser opcional inicialmente dentro del Case.

---

# 194. Relación con Quotes

Quote representa propuesta económica.

---

# 195. Relación con Sales

SalesOrder/Delivery representan compromiso y fulfillment comercial.

---

# 196. Relación con Inventory

Inventory conserva la verdad física general.

Healthcare coordina custodia especializada.

---

# 197. Relación con Dashboard

Dashboard consume el estado de Cases y readiness.

No los gobierna.

---

# 198. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-008 — Documentation First.
* ADR-009 — Modular Monolith.
* ADR-011 — SalesOrder + Delivery.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 199. Documentos relacionados

```text
modules/healthcare/HEALTHCARE.md
modules/healthcare/OPPORTUNITIES.md
modules/healthcare/CASE_CALENDAR.md
modules/healthcare/CASE_KITS.md
modules/healthcare/CASE_LOGISTICS.md
modules/healthcare/EQUIPMENT.md

modules/erp/CUSTOMERS.md
modules/erp/PRODUCTS.md
modules/erp/INVENTORY.md
modules/erp/QUOTES.md
modules/erp/SALES.md
modules/erp/RETURNS.md

product/ZAPING_WAY.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
```

---

# 200. Fuente de verdad

```text
CASES.md
→ lifecycle y comportamiento de Healthcare Case

HEALTHCARE.md
→ frontera general Healthcare

OPPORTUNITIES.md
→ etapa previa

CASE_CALENDAR.md
→ planificación y conflictos

CASE_KITS.md
→ preparación

CASE_LOGISTICS.md
→ custodia y reconciliación

EQUIPMENT.md
→ activos reutilizables

ERP docs
→ comportamiento del Core

schema.prisma
→ modelo técnico cuando sea aprobado

PROJECT_BOARD.md
→ estado de implementación
```

---

# 201. Decisiones pendientes antes de Prisma

Antes de crear:

```text
model HealthcareCase
```

debemos resolver:

```text
Doctor model
Hospital model
Technician model / User relationship
lifecycle enum final
readiness representation
minimum fields for creation
minimum fields for scheduling
procedure representation
folio strategy
Opportunity → Case cardinality
Customer/Payer relationship
schedule history strategy
```

---

# 202. Principio final

Healthcare Case debe responder siempre:

```text
¿Qué operación estamos coordinando?
↓
¿Cuándo y dónde?
↓
¿Quién es responsable?
↓
¿Está preparada?
↓
¿Qué ocurrió con los materiales y equipos?
↓
¿Queda algo por resolver?
```

sin confundir:

```text
operación
con
oportunidad

agenda
con
readiness

custodia
con
venta

cierre logístico
con
facturación
```

> **Un Case está realmente completo cuando la operación puede explicarse de principio a fin y todas sus obligaciones operativas y logísticas quedaron resueltas, no simplemente cuando terminó el procedimiento.**
