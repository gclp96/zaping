# Calendario de Healthcare Cases — Zaping

**Módulo:** Healthcare Case Calendar
**Producto:** Zaping Healthcare
**Versión:** 1.0.0
**Estado:** Aprobado
**Estado de implementación:** DOMAIN DESIGN / NOT IMPLEMENTED
**Última actualización:** 2026-08-20
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Case Calendar proporciona la vista temporal y operacional de los Healthcare Cases.

Su objetivo es responder rápidamente:

```text
¿Qué Cases tenemos hoy?
¿Qué tenemos mañana?
¿A qué hora?
¿En qué Hospital?
¿Qué Doctor participa?
¿Qué Technician está asignado?
¿Está preparado el Case?
¿Existe algún conflicto?
¿Qué requiere atención antes del procedimiento?
```

Calendar convierte el schedule de los Cases en una herramienta operativa.

---

# 2. Principio fundamental

```text
Healthcare Case
→ source of truth del schedule
```

```text
Case Calendar
→ read model / operational workspace
```

Por tanto:

> **El Calendar organiza y visualiza Cases; no crea una segunda verdad temporal independiente.**

---

# 3. Problema operativo

En una operación Healthcare, conocer que existen Cases no es suficiente.

El equipo necesita comprenderlos en contexto temporal.

Ejemplo:

```text
Hoy
│
├── 08:00
│   └── Hospital A
│       Dr. X
│       Technician Carlos
│
├── 11:30
│   └── Hospital B
│       Dr. Y
│       Technician Ana
│
└── 16:00
    └── Hospital C
        Dr. Z
        Technician Carlos
```

Esta vista permite detectar problemas que una tabla tradicional no muestra fácilmente.

---

# 4. Calendar no es simplemente una lista ordenada

Una página:

```text
Cases
sort by scheduledStart
```

es útil.

Pero no sustituye completamente:

```text
Calendar
```

porque el usuario necesita visualizar:

* proximidad temporal;
* solapamientos;
* carga por Technician;
* uso de Equipment;
* readiness;
* distribución por Hospital.

---

# 5. Source of Truth

El horario pertenece al Case.

Conceptualmente:

```text
HealthcareCase
├── scheduledStart
└── scheduledEnd
```

o su representación técnica equivalente.

Calendar consume esos valores.

---

# 6. Anti-patrón crítico

Nunca:

```text
CalendarEvent
├── start
├── end
└── caseId
```

como fuente paralela de verdad si `HealthcareCase` mantiene otros horarios.

Eso produciría:

```text
Case says 08:00
Calendar says 09:00
```

---

# 7. Regla

Una modificación desde Calendar debe significar conceptualmente:

```text
Calendar action
↓
Case scheduling operation
↓
Case updated
↓
Calendar reflects new schedule
```

---

# 8. Calendar como Read Model

Case Calendar puede componerse a partir de:

```text
Healthcare Cases
+
Readiness
+
Technician assignment
+
Equipment assignment
+
CaseKit status
+
Logistics state
```

sin convertirse en propietario de esas reglas.

---

# 9. Alcance inicial

La primera versión debe permitir como mínimo:

* visualizar Cases por fecha;
* identificar hora;
* Hospital;
* Doctor;
* Technician;
* status;
* readiness;
* abrir Case 360;
* filtrar;
* detectar conflictos básicos;
* identificar Cases que requieren atención.

---

# 10. Fuera del alcance inicial

No necesitamos inicialmente:

* calendario personal completo;
* reuniones internas;
* Google Calendar replacement;
* Outlook replacement;
* agenda médica de pacientes;
* booking público;
* recordatorios omnicanal complejos;
* optimización automática por IA.

---

# 11. Calendar Healthcare vs Calendar genérico

Case Calendar existe específicamente para responder preguntas operativas Healthcare.

No pretende ser:

```text
Company Calendar
```

para todo tipo de eventos.

---

# 12. Qué aparece en Calendar

El elemento principal es:

```text
Healthcare Case
```

con schedule operativo.

---

# 13. Opportunity no aparece como Case confirmado

Una:

```text
Healthcare Opportunity
```

con fecha estimada no debe aparecer visualmente como si fuera un Case confirmado.

---

# 14. Razón

Debe mantenerse:

```text
Opportunity.expectedDate
→ commercial estimate
```

```text
Case.scheduledStart
→ operational schedule
```

---

# 15. Agenda comercial futura

Las Opportunities podrían tener otra vista futura.

Pero no deben contaminar el Case Calendar principal.

---

# 16. Cases sin schedule

Un Case `DRAFT` sin fecha no tiene una posición natural en Calendar.

Puede aparecer en una sección complementaria como:

```text
Cases pendientes de agendar
```

---

# 17. Unscheduled Cases

Ejemplo:

```text
Pendientes de agendar

CASE-001
Dr. X
Hospital pendiente

CASE-005
Hospital ABC
Technician pendiente
```

---

# 18. Calendar View

La UI debería permitir inicialmente vistas como:

```text
Day
Week
```

---

# 19. Vista diaria

Ideal para:

* almacén;
* Technician;
* operación del día;
* preparación inmediata.

---

# 20. Vista semanal

Ideal para:

* planeación;
* carga;
* conflictos;
* Equipment;
* anticipación de preparación.

---

# 21. Vista mensual

Puede ser útil posteriormente para planificación general.

No es necesariamente prioridad de primera versión.

---

# 22. Timeline operativo

Una vista diaria puede funcionar como:

```text
07:00 ─────────────────

08:00  CASE-0145
       Hospital ABC
       Dr. X
       Carlos
       READY

09:00 ─────────────────

10:30  CASE-0146
       Hospital XYZ
       Dr. Y
       Ana
       NOT READY
```

---

# 23. Información mínima en cada Case Card

Una tarjeta de Calendar debe mostrar suficiente contexto sin obligar a abrir el Case.

Conceptualmente:

```text
Time
Case folio
Hospital
Doctor
Technician
Procedure
Status
Readiness
Conflict indicator
```

---

# 24. Evitar saturación

No mostrar dentro de cada tarjeta:

* todos los Products;
* todas las notas;
* todos los Dispatches;
* todos los datos comerciales.

Ese detalle pertenece a Case 360.

---

# 25. Click / Open

La interacción natural es:

```text
Calendar Case
↓
Case 360
```

---

# 26. Primary Calendar Action

Dependiendo del rol y contexto puede existir:

```text
Crear Case
```

desde Calendar.

---

# 27. Crear desde Calendar

Seleccionar:

```text
Sep 12
08:00
```

puede prellenar:

```text
scheduledStart
```

en Create Case.

---

# 28. Calendar no salta validaciones

Aunque la creación comience visualmente desde Calendar, backend debe ejecutar exactamente las mismas reglas que:

```text
Create Case
```

desde cualquier otra pantalla.

---

# 29. Scheduling

Calendar necesita representar:

```text
scheduledStart
scheduledEnd
```

o duración equivalente.

---

# 30. Inicio obligatorio para Calendar

Para posicionar un Case en la línea temporal debe conocerse:

```text
scheduledStart
```

---

# 31. End desconocido

Puede existir:

```text
scheduledStart = 08:00
scheduledEnd = null
```

si todavía no se conoce duración.

---

# 32. Limitación

Sin `scheduledEnd` el sistema no puede determinar con precisión:

```text
overlap
```

---

# 33. Duración default futura

Un `ProcedureType` podría proporcionar:

```text
estimatedDuration
```

como ayuda.

Ejemplo:

```text
Procedure Type
Pacemaker Implant

Estimated Duration
120 min
```

---

# 34. Default no sustituye dato real

Si Procedure Type sugiere 120 minutos:

```text
Case
```

debe poder utilizar otra duración.

---

# 35. Timezone

Todo Calendar debe respetar:

```text
Company.timezone
```

---

# 36. Regla

El usuario debe ver:

```text
08:00
```

en el contexto temporal de su Company/operación.

---

# 37. Almacenamiento

La política exacta de persistencia temporal pertenece a la arquitectura general.

Calendar no define una política distinta.

---

# 38. Fecha local

El agrupamiento por:

```text
Hoy
Mañana
Viernes
```

debe calcularse según timezone correcto.

---

# 39. Reprogramación

Calendar es una ubicación natural para:

```text
Reschedule Case
```

---

# 40. Reschedule

Conceptualmente:

```text
Case
Sep 12 08:00
↓
Reschedule
↓
Sep 12 11:00
```

---

# 41. El mismo Case

Debe preservarse:

```text
same Case id
same folio
```

---

# 42. Drag & Drop futuro

La UI podría permitir:

```text
drag Case
↓
new time
```

pero no debería ser la primera implementación si complica validaciones.

---

# 43. Acción explícita inicial

Una primera versión más segura puede utilizar:

```text
[Reprogramar]
↓
modal/form
↓
new date/time
↓
confirm
```

---

# 44. Confirmación

Antes de reprogramar debe mostrarse impacto relevante.

Ejemplo:

```text
Nuevo horario:
12 Sep, 11:00–13:00

Conflictos:
Technician Carlos ya tiene CASE-0147 a las 12:00.
```

---

# 45. Reschedule History

Reprogramar es una acción candidata a Audit.

Conceptualmente:

```text
case.rescheduled

before:
08:00

after:
11:00
```

---

# 46. Reason

Puede ser útil registrar:

```text
rescheduleReason
```

sin hacerlo obligatorio desde la primera versión.

---

# 47. Conflictos

Calendar debe ayudar a detectar recursos asignados simultáneamente.

Los primeros conflictos relevantes son:

```text
Technician
Equipment
```

---

# 48. Technician Conflict

Existe potencial conflicto cuando:

```text
Case A
Technician X
08:00–10:00
```

y:

```text
Case B
Technician X
09:00–11:00
```

---

# 49. Condición conceptual

Dos intervalos se solapan cuando:

```text
A.start < B.end
AND
B.start < A.end
```

cuando ambos extremos son conocidos.

---

# 50. Mismo inicio

También es conflicto:

```text
Case A 08:00
Case B 08:00
same Technician
```

---

# 51. End desconocido

Cuando alguna duración sea desconocida, la UI puede mostrar:

```text
Possible conflict
```

en lugar de afirmar certeza.

---

# 52. Buffer futuro

En operación real puede necesitarse tiempo para:

* traslado;
* preparación;
* limpieza;
* Equipment turnaround.

---

# 53. Travel Conflict

Ejemplo:

```text
Case A
Hospital Norte
ends 10:00

Case B
Hospital Sur
starts 10:15
same Technician
```

Puede ser técnicamente no-overlap pero operacionalmente imposible.

---

# 54. No implementar routing todavía

La primera versión no necesita calcular automáticamente:

```text
travel time
```

entre Hospitals.

Puede evolucionar posteriormente.

---

# 55. Buffer configurable futuro

Puede existir:

```text
minimum technician transition time
```

o reglas equivalentes.

No forma parte del Core inicial.

---

# 56. Equipment Conflict

Conceptualmente:

```text
EquipmentAsset EQ-001
↓
Case A 08:00–10:00
+
Case B 09:00–11:00
```

debe generar conflicto.

---

# 57. Product quantity no es Equipment conflict

No debe confundirse:

```text
EquipmentAsset
→ individual physical unit
```

con:

```text
Product
→ quantity availability
```

---

# 58. Material availability

La disponibilidad de Products debe aparecer dentro de Readiness, no necesariamente como conflicto temporal.

---

# 59. CaseKit conflict

Dos Cases pueden competir por inventario limitado.

Ejemplo:

```text
Product A available = 1

Case A requires 1
Case B requires 1
```

---

# 60. Sin Reservations

Mientras no exista un modelo formal de Reservations:

> Calendar no debe afirmar que existe un conflicto definitivo solo porque dos CaseKits requieren el mismo producto.

---

# 61. Advertencia

Puede mostrar:

```text
Potential material shortage
```

como señal operacional.

---

# 62. Reservation futura

Cuando Inventory implemente Reservations, Calendar podrá utilizar esa fuente para detectar conflictos de disponibilidad más confiables.

---

# 63. Conflict Severity

Puede ser útil distinguir:

```text
WARNING
BLOCKING
```

---

# 64. Ejemplo Warning

```text
CaseKit incompleto
```

puede ser warning varios días antes.

---

# 65. Ejemplo Blocking

```text
Required Equipment unavailable
```

pocas horas antes del Case puede representar blocker.

---

# 66. No definir severity rígida todavía

La clasificación final debe diseñarse con la experiencia real del almacén y Technicians.

---

# 67. Conflicto no es Case Status

Debe mantenerse:

```text
Conflict
≠
Case lifecycle status
```

---

# 68. Ejemplo

```text
Status:
SCHEDULED

Readiness:
PARTIALLY_READY

Conflict:
TECHNICIAN_OVERLAP
```

---

# 69. Readiness

Calendar debe mostrar Readiness de manera visible.

---

# 70. Readiness no es lifecycle

Se mantiene:

```text
Case Status
≠
Readiness
```

---

# 71. Ejemplos visuales

```text
SCHEDULED
READY
```

```text
SCHEDULED
NOT READY
```

```text
SCHEDULED
BLOCKED
```

---

# 72. Readiness derivado

Calendar debería obtenerlo desde hechos reales.

Ejemplo conceptual:

```text
Technician assigned       ✓
Hospital known            ✓
Schedule complete         ✓
CaseKit prepared          ✗
Equipment assigned        ✓
```

Resultado:

```text
NOT READY
```

---

# 73. Readiness Component

No debe estar hardcodeado únicamente en Calendar.

Puede existir un:

```text
HealthcareReadinessService
```

o read model equivalente en el futuro.

---

# 74. Ownership

Las reglas pertenecen a los dominios responsables.

Ejemplo:

```text
CaseKit
→ sabe si preparation está completa
```

```text
Equipment
→ sabe si asset está disponible/asignado
```

```text
Case
→ sabe si schedule/context requerido existe
```

Calendar compone esos resultados.

---

# 75. Checklist

Al abrir Readiness:

```text
CASE-0145

✓ Schedule
✓ Hospital
✓ Doctor
✓ Technician
✗ CaseKit
✓ Equipment
```

---

# 76. Readiness Explanation

Una propiedad crítica de la UX es que el usuario pueda responder:

```text
¿Por qué no está listo?
```

---

# 77. No solo semáforo

Mostrar únicamente:

```text
red
yellow
green
```

sin explicación es insuficiente.

---

# 78. Accessibility

Readiness y conflictos no deben depender únicamente del color.

Utilizar:

* texto;
* icono;
* label;
* tooltip/context.

---

# 79. Filtros

La primera versión debería permitir filtrar por:

```text
Technician
Hospital
Doctor
Status
Readiness
Date range
```

---

# 80. Procedure Filter

También puede ser útil:

```text
Procedure
```

cuando exista representación estructurada.

---

# 81. Customer Filter

Puede incorporarse si tiene valor operacional.

No es necesariamente filtro prioritario de Calendar.

---

# 82. Payer Filter

Probablemente pertenece más a contexto comercial que a planificación diaria.

No es prioridad inicial.

---

# 83. Search

Dentro del Calendar puede ser útil buscar:

```text
Case folio
Doctor
Hospital
Technician
```

---

# 84. Combinación de filtros

Debe permitirse conceptualmente:

```text
This week
+
Technician Carlos
+
Not Ready
```

---

# 85. Persistencia de filtros

Una evolución UX puede conservar filtros del usuario.

No es requisito de dominio.

---

# 86. Technician View

Un filtro rápido:

```text
Mis Cases
```

puede utilizar la identidad autenticada cuando el User representa al Technician.

---

# 87. Warehouse View

Warehouse puede preferir:

```text
Cases requiring preparation
```

sobre todos los Cases.

---

# 88. Manager View

Manager puede necesitar:

```text
All Cases
Conflicts
Not Ready
Reconciliation Pending
```

---

# 89. Role-specific defaults

El mismo Calendar puede presentar defaults distintos según función.

No es necesario crear múltiples módulos de agenda.

---

# 90. Calendar Grouping

Además de tiempo, puede ser útil agrupar por:

```text
Technician
Hospital
```

en vistas futuras.

---

# 91. Technician Lane

Ejemplo conceptual:

```text
Carlos
├── 08:00 CASE-01
└── 14:00 CASE-05

Ana
├── 09:00 CASE-02
└── 12:00 CASE-03
```

---

# 92. Equipment Lane futuro

Puede resultar útil para responsables de Equipment.

No es prioridad inicial.

---

# 93. Hospital Lane futuro

También puede ayudar cuando existen múltiples procedimientos simultáneos.

---

# 94. Today View

Healthcare debería proporcionar acceso rápido a:

```text
Hoy
```

---

# 95. Próximas 24 horas

Una vista orientada a atención puede listar:

```text
Cases next 24h
+
Readiness
+
Blockers
```

---

# 96. Tomorrow Preparation

Warehouse puede necesitar especialmente:

```text
Tomorrow Cases
↓
prepare today
```

---

# 97. Readiness Horizon

Un Case dentro de 30 días no necesita el mismo nivel de urgencia que uno dentro de 4 horas.

---

# 98. Attention Model

Conceptualmente:

```text
Case not ready
+
time until procedure
↓
urgency
```

---

# 99. No inventar score ahora

No necesitamos inicialmente una fórmula compleja.

Puede utilizarse prioridad basada en:

```text
Today
Tomorrow
Later
```

---

# 100. Action Dashboard integration

Calendar debe integrarse con la filosofía:

```text
Attention
↓
Context
↓
Action
```

---

# 101. Ejemplo

```text
2 Cases mañana no están listos

[Revisar]
```

puede abrir Calendar filtrado:

```text
Tomorrow
+
Not Ready
```

---

# 102. Calendar Deep Link

Las vistas deberían poder enlazar con filtros/contexto cuando sea práctico.

---

# 103. Status display

Calendar debe mostrar el estado del Case.

Ejemplos conceptuales:

```text
DRAFT
SCHEDULED
IN_PROGRESS
RECONCILIATION_PENDING
COMPLETED
CANCELLED
```

---

# 104. DRAFT

Cases sin schedule pueden vivir fuera del grid principal.

---

# 105. SCHEDULED

Representa el principal conjunto visible en agenda futura.

---

# 106. IN_PROGRESS

Debe diferenciarse visualmente.

Puede permitir responder:

```text
¿Qué procedimientos están ocurriendo ahora?
```

---

# 107. RECONCILIATION_PENDING

Después del horario del procedimiento, Calendar puede seguir mostrando el Case con una señal de seguimiento.

---

# 108. COMPLETED

Puede ocultarse por defecto en vistas futuras, pero seguir disponible.

---

# 109. CANCELLED

Debe conservarse.

Dependiendo de UX puede aparecer:

```text
tachado
dimmed
cancelled label
```

sin borrar el slot histórico.

---

# 110. Cancelled visibility

En vista operativa futura podría ocultarse por defecto con un filtro:

```text
Show cancelled
```

---

# 111. Calendar History

Si el usuario revisa una fecha pasada, debe poder entender qué ocurrió.

---

# 112. No reescribir pasado

Un Case cancelado o reprogramado debe conservar suficiente historia mediante Audit/historial.

---

# 113. Reprogramado

Si un Case cambió de fecha, la vista actual debe mostrar la nueva fecha.

---

# 114. Historical schedule

Para reconstruir:

```text
antes estaba el martes
```

se utilizará Audit o historial especializado.

No un segundo CalendarEvent vigente.

---

# 115. Preparation Shortcut

Desde una tarjeta puede existir:

```text
[Preparar]
```

si el Case necesita CaseKit.

---

# 116. Dispatch Shortcut

Si el Case está preparado:

```text
[Despachar]
```

puede abrir Logistics.

---

# 117. Contextual Actions

Calendar no debe presentar veinte botones por tarjeta.

Mantener una acción principal o menú contextual.

---

# 118. No duplicar Case 360

Calendar no debe convertirse en la interfaz completa del Case.

---

# 119. Calendar → Case 360

El detalle siempre debe estar a un click/tap.

---

# 120. Mobile

Calendar es altamente relevante para Technician móvil.

---

# 121. Mobile default

En pantallas pequeñas puede ser mejor:

```text
Agenda / list timeline
```

que un grid semanal reducido ilegible.

---

# 122. Ejemplo Mobile

```text
HOY

08:00
CASE-0145
Hospital ABC
Dr. X
READY

11:00
CASE-0146
Hospital XYZ
NOT READY
```

---

# 123. Desktop

Desktop puede ofrecer:

```text
week grid
```

y panel lateral de detalle rápido.

---

# 124. Responsive strategy

No intentar comprimir exactamente la misma UI desktop en móvil.

---

# 125. Technician Mobile

Una futura app puede tener:

```text
Today
Upcoming
Assigned to me
```

como accesos principales.

---

# 126. Notifications

Calendar puede ser fuente para futuras notificaciones.

Ejemplos:

```text
Case tomorrow not ready
Case rescheduled
Technician assignment changed
Equipment conflict
Case starting soon
```

---

# 127. Notificación no es Calendar ownership

Notification Service consume eventos/estado.

Calendar no debe enviar directamente mensajes como responsabilidad principal.

---

# 128. External Calendar Integration futuro

Puede existir sincronización futura con:

```text
Google Calendar
Microsoft Outlook
```

---

# 129. Regla de integración

Incluso con integración externa:

```text
Healthcare Case
→ source of truth
```

---

# 130. No importar cambios automáticamente sin política

Si un usuario mueve un evento en Google Calendar:

```text
¿debe reprogramarse el Case?
```

es una decisión futura que requiere autorización y reglas.

---

# 131. Export iCal futuro

Una opción más simple puede ser:

```text
read-only calendar feed
```

antes de sincronización bidireccional.

---

# 132. Hospital Calendar externo

No asumimos acceso a agendas internas del Hospital.

---

# 133. Doctor Schedule

Tampoco pretendemos convertir Zaping en el sistema de agenda personal del Doctor.

---

# 134. Resource conflict scope

Los conflictos se calculan únicamente sobre recursos conocidos dentro de Zaping.

---

# 135. Example limitation

Que Zaping indique:

```text
Technician available
```

significa:

```text
no overlapping Zaping Case known
```

No garantiza que la persona no tenga compromisos externos.

---

# 136. Equipment availability

La misma regla aplica a Equipment:

```text
available according to Zaping records
```

---

# 137. Calendar Read API

No existe actualmente API Healthcare.

Una futura capacidad puede ser conceptualmente:

```text
GET /healthcare/cases
?from=
&to=
&technicianId=
&hospitalId=
&status=
&readiness=
```

---

# 138. Endpoint dedicado

También podría existir:

```text
GET /healthcare/case-calendar
```

si se necesita un Read Model optimizado.

La decisión se tomará durante implementación.

---

# 139. Regla API

No duplicar lógica empresarial solo porque exista endpoint dedicado para Calendar.

---

# 140. Read Model performance

Con mayor volumen puede ser útil devolver directamente:

```text
case summary
readiness
conflicts
```

sin obligar al frontend a realizar decenas de requests.

---

# 141. N+1

La API de Calendar debe evitar patrones donde cada Case provoque consultas adicionales independientes para:

```text
Doctor
Hospital
Technician
Readiness
Equipment
```

---

# 142. Índices futuros

Probablemente resultarán útiles índices sobre:

```text
companyId + scheduledStart
```

y otros campos utilizados en filtros.

La decisión se hará sobre queries reales.

---

# 143. Multi-tenancy

Calendar siempre opera dentro de una Company.

---

# 144. Consulta

Conceptualmente:

```text
WHERE companyId = authenticatedCompanyId
AND schedule intersects requested range
```

---

# 145. Cross-tenant

Nunca debe aparecer en Calendar:

```text
Case Company B
```

para un usuario de Company A.

---

# 146. Authorization

Permisos conceptuales:

```text
healthcare.calendar.read
healthcare.cases.schedule
healthcare.cases.reschedule
```

---

# 147. Read Case permission

Debe evaluarse si:

```text
healthcare.calendar.read
```

implica acceso a la información resumida de los Cases.

---

# 148. Detail permission

Abrir Case 360 puede requerir:

```text
healthcare.cases.read
```

---

# 149. Warehouse access

Warehouse puede recibir acceso a Calendar operativo sin acceso a información comercial sensible que no necesite.

---

# 150. Data minimization

Una Calendar card no debería mostrar:

* información financiera innecesaria;
* datos personales sensibles;
* información clínica.

---

# 151. Doctor/Hospital names

Son contexto operacional relevante y pueden mostrarse según permisos.

---

# 152. Customer/Payer

No necesitan aparecer por defecto en Calendar.

---

# 153. Audit

Acciones relacionadas:

```text
case.scheduled
case.rescheduled
case.cancelled
case.technician_assigned
```

pertenecen a Audit del Case.

---

# 154. Calendar no genera Audit por lectura

Abrir Calendar normalmente:

```text
→ no Business Audit Event
```

salvo requerimiento específico.

---

# 155. Concurrencia

Dos usuarios podrían reprogramar el mismo Case simultáneamente.

---

# 156. Backend validation

Debe impedirse que una actualización posterior sobrescriba silenciosamente un cambio relevante si existe riesgo operativo.

---

# 157. Conflict validation

La primera versión puede:

```text
warn
```

en determinados conflictos.

---

# 158. Hard blocking

Solo debe bloquear automáticamente cuando exista una regla empresarial suficientemente segura.

---

# 159. Ejemplo

Technician overlap podría comenzar como:

```text
warning requiring confirmation
```

si la operación real admite excepciones.

---

# 160. Equipment same asset overlap

Puede ser un blocker más fuerte porque la misma unidad física no puede estar en dos lugares.

---

# 161. Pero estados importan

Si Case B está:

```text
CANCELLED
```

no debería generar conflicto activo.

---

# 162. Case status filtering for conflicts

La detección debe considerar únicamente estados operacionalmente relevantes.

---

# 163. Reconciliation Case

Un Case `RECONCILIATION_PENDING` puede haber terminado temporalmente y no seguir bloqueando Technician.

---

# 164. Equipment exception

Sin embargo, Equipment todavía no devuelto sí puede seguir:

```text
unavailable
```

aunque el procedimiento haya terminado.

---

# 165. Regla

> **La disponibilidad temporal del Technician y la disponibilidad física del Equipment no necesariamente terminan al mismo tiempo.**

---

# 166. Equipment source of truth

Calendar debe consultar Equipment/Custody para conocer disponibilidad real.

No inferir únicamente desde `Case.scheduledEnd`.

---

# 167. Late-running Case futuro

Un Case puede extenderse más allá de su horario planificado.

---

# 168. In Progress conflict

Si:

```text
Case A
scheduled end 10:00
still IN_PROGRESS at 10:30
```

y Technician tiene otro Case:

```text
10:15
```

Calendar debería eventualmente mostrar riesgo.

---

# 169. Real-time future

No necesitamos inicialmente un motor real-time sofisticado.

Un refresh razonable puede ser suficiente.

---

# 170. Current time marker

La UI puede mostrar:

```text
now
```

dentro de la agenda diaria.

---

# 171. Past due

Un Case:

```text
scheduledStart < now
status = SCHEDULED
```

puede requerir atención.

---

# 172. Ejemplo

```text
08:00 Case
Current time 09:30
Status still SCHEDULED
```

puede indicar:

```text
Start not registered
```

o schedule desactualizado.

---

# 173. No auto-start

Calendar no debe cambiar automáticamente:

```text
SCHEDULED
→ IN_PROGRESS
```

solo porque llegó la hora.

---

# 174. Razón

El procedimiento puede:

* retrasarse;
* cancelarse;
* reprogramarse.

---

# 175. No auto-complete

Tampoco:

```text
scheduledEnd passed
→ COMPLETED
```

---

# 176. Operational Actions

El estado real debe resultar de acciones/reconciliación confirmadas.

---

# 177. Overdue signals

Calendar sí puede mostrar:

```text
Expected to have started
```

o:

```text
Expected to have ended
```

como señal.

---

# 178. Readiness update

Readiness debe reflejar cambios sin que el usuario tenga que modificar manualmente la tarjeta.

Ejemplo:

```text
CaseKit prepared
↓
Calendar readiness refresh
```

---

# 179. Event-ready architecture

En el futuro, eventos internos podrían invalidar/actualizar Read Models.

No requiere infraestructura distribuida.

---

# 180. Caching

Si Calendar se cachea, la clave debe incluir:

```text
companyId
date range
filters
```

y no mezclar tenants.

---

# 181. Search scale

La primera implementación puede consultar PostgreSQL directamente.

No necesita Elasticsearch.

---

# 182. History scale

Calendar operativo normalmente consulta ventanas limitadas.

Ejemplo:

```text
week
month
```

por lo que es razonable dentro del Modular Monolith.

---

# 183. CURRENT

Actualmente:

```text
Case Calendar
→ documented domain/read-model design
```

No existe evidencia actual de:

```text
Calendar UI
Calendar API
Healthcare Case model
conflict engine
readiness engine
```

implementados.

---

# 184. TARGET inicial

Primera versión:

```text
Day / Week Calendar
↓
Cases
↓
Filters
↓
Status
↓
Readiness
↓
Basic Technician conflicts
↓
Open Case 360
```

---

# 185. TARGET siguiente

Posteriormente:

```text
Equipment conflicts
Preparation shortcuts
Unscheduled Cases
Attention indicators
Warehouse-focused views
```

---

# 186. FUTURE

Posibles evoluciones:

```text
monthly view
drag-and-drop
travel-time warnings
resource lanes
external calendar sync
iCal feed
notifications
advanced scheduling
mobile optimization
AI scheduling assistance
```

---

# 187. No AI Scheduler inicialmente

No necesitamos un algoritmo que automáticamente decida:

```text
qué Technician
qué Equipment
qué horario
```

antes de contar con suficientes datos y reglas reales.

---

# 188. AI futuro

Más adelante podría sugerir:

```text
Technician Carlos tiene conflicto.
Ana aparece disponible.
```

pero la decisión continúa siendo autorizada por el usuario.

---

# 189. Invariantes

```text
Healthcare Case
→ owns schedule
```

```text
Case Calendar
→ read model
```

```text
Calendar Event
≠
second source of truth
```

```text
Opportunity expected date
≠
Case schedule
```

```text
Case Status
≠
Readiness
```

```text
Conflict
≠
Case Status
```

```text
SCHEDULED
≠
READY
```

```text
Calendar
→ no Inventory movement
```

```text
Calendar
→ no automatic Case start
```

```text
Calendar
→ no automatic Case completion
```

```text
Reschedule
→ same Case
```

```text
Cancelled Case
→ historical schedule remains traceable
```

```text
Technician overlap
→ detectable
```

```text
Same EquipmentAsset overlap
→ detectable
```

```text
Cross-tenant Cases
→ never visible
```

---

# 190. Anti-patrones

## Second schedule database

Guardar horarios independientes en Case y Calendar.

---

## Opportunity as scheduled Case

Mostrar fechas estimadas comerciales como procedimientos confirmados.

---

## READY as lifecycle status only

Perder la distinción entre estado y preparación.

---

## Color-only readiness

Mostrar semáforo sin explicar el problema.

---

## Calendar as Case editor

Convertir cada tarjeta en una interfaz con toda la lógica del Case.

---

## Automatic start

Cambiar estado porque llegó la hora.

---

## Automatic completion

Cerrar Case porque pasó `scheduledEnd`.

---

## Hard block every warning

Impedir captura por cualquier posible conflicto.

---

## Ignore Equipment custody

Asumir Equipment disponible únicamente porque terminó el horario del Case.

---

## Desktop calendar squeezed into mobile

Mantener un grid semanal ilegible en pantallas pequeñas.

---

## External calendar as authority

Permitir que Google/Outlook se conviertan accidentalmente en la fuente principal del Case.

---

# 191. Relación con Cases

```text
CASES.md
→ schedule + lifecycle
```

```text
CASE_CALENDAR.md
→ visualization + coordination
```

---

# 192. Relación con CaseKit

CaseKit proporciona información de Preparation y Readiness.

---

# 193. Relación con Equipment

Equipment aporta:

```text
assignment
availability
custody
conflicts
```

---

# 194. Relación con Case Logistics

Un Case puede seguir requiriendo atención después de su horario debido a:

```text
Return
Inspection
Reconciliation
```

---

# 195. Relación con Dashboard

Dashboard puede enlazar Calendar con filtros específicos.

Ejemplo:

```text
Cases tomorrow not ready
↓
Calendar
Tomorrow + NOT READY
```

---

# 196. Relación con Identity

User/Technician determina filtros como:

```text
My Cases
```

y permisos.

---

# 197. Relación con Company

Timezone y tenant context provienen de Company.

---

# 198. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 199. Documentos relacionados

```text
modules/healthcare/HEALTHCARE.md
modules/healthcare/CASES.md
modules/healthcare/CASE_KITS.md
modules/healthcare/CASE_LOGISTICS.md
modules/healthcare/EQUIPMENT.md

modules/erp/COMPANIES.md
modules/erp/IDENTITY_ACCESS.md
modules/erp/INVENTORY.md
modules/erp/DASHBOARD.md

product/ZAPING_WAY.md
ux/DESIGN_SYSTEM.md
engineering/API_GUIDELINES.md
```

---

# 200. Fuente de verdad

```text
CASES.md
→ schedule del Case y lifecycle

CASE_CALENDAR.md
→ visualización temporal, filtros y conflictos

CASE_KITS.md
→ readiness de material

EQUIPMENT.md
→ disponibilidad física de activos

CASE_LOGISTICS.md
→ estado de custodia

COMPANIES.md
→ timezone / tenant

PROJECT_BOARD.md
→ estado de implementación
```

---

# 201. Decisiones pendientes antes de implementación

Antes de construir Calendar debemos resolver:

```text
HealthcareCase schema
scheduledStart / scheduledEnd strategy
Technician identity model
Hospital model
Doctor model
readiness calculation
Equipment assignment model
conflict severity rules
permissions
API read model
```

---

# 202. Principio final

El Calendar debe permitir que una persona mire la operación y comprenda:

```text
qué ocurre
↓
cuándo
↓
dónde
↓
con quién
↓
qué está listo
↓
qué está bloqueado
↓
qué necesita atención
```

sin crear otra fuente paralela para esa información.

> **El Case posee el tiempo; el Calendar convierte ese tiempo en contexto operacional y acción.**
