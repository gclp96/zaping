# Equipment — Zaping Healthcare

**Módulo:** Healthcare Equipment Operations
**Producto:** Zaping Healthcare
**Versión:** 1.0.0
**Estado:** Approved
**Estado de implementación:** DOMAIN DESIGN / NOT IMPLEMENTED
**Última actualización:** 2026-08-21
**Responsable:** Zaping Team

---

# 1. Purpose

Este documento define cómo Zaping Healthcare utiliza Equipment dentro de la operación de casos médicos.

Healthcare no es propietario de la identidad física del activo.

La fuente de verdad para:

```text
EquipmentAsset
Product relationship
assetCode
serialNumber
Lifecycle
Condition
Origin
Retirement
Core persistence
Core Equipment API
```

es:

```text
modules/erp/EQUIPMENT.md
```

Este documento define exclusivamente capacidades Healthcare relacionadas con:

```text
Equipment Requirement
Case Equipment Assignment
Preparation
Dispatch
Custody
Return
Inspection
Case Availability
Equipment history inside Cases
```

---

# 2. Domain boundary

Debe mantenerse la siguiente separación:

```text
Zaping ERP / Core
│
├── Product
├── Inventory
└── EquipmentAsset
```

```text
Zaping Healthcare
│
├── HealthcareCase
├── CaseKit
├── Equipment Requirement
├── Case Equipment Assignment
└── Case Logistics
    ├── Preparation
    ├── Dispatch
    ├── Custody
    ├── Return
    └── Inspection
```

Regla:

> **Healthcare consume EquipmentAsset; no redefine EquipmentAsset.**

No debe crearse dentro de Healthcare un catálogo paralelo para:

```text
assetCode
serialNumber
brand
model
Product
Lifecycle
Condition
```

---

# 3. Core Equipment dependency

Healthcare deberá utilizar el contrato Core Equipment para identificar una unidad física.

Conceptualmente:

```text
HealthcareCase
↓
Case Equipment Assignment
↓
EquipmentAsset
↓
Product
```

Healthcare puede consultar:

```text
assetCode
serialNumber
Product
Lifecycle
Condition
```

pero no debe duplicar estos valores como fuente de verdad.

Snapshots históricos podrán almacenarse cuando sean necesarios para auditoría de una operación.

---

# 4. Equipment Requirement

`Equipment Requirement` representa:

> **Qué tipo de equipo necesita un Healthcare Case.**

Ejemplo:

```text
CASE-0145

Requires:
1 Programador Medtronic
```

Esto todavía no identifica qué unidad física será utilizada.

Debe mantenerse:

```text
Equipment Requirement
≠
Equipment Assignment
```

Conceptualmente:

```text
Requirement
→ what is needed

Assignment
→ which exact EquipmentAsset will be used
```

---

# 5. Case Equipment Assignment

`CaseEquipmentAssignment` representa:

> **La reserva operacional de un EquipmentAsset específico para un Healthcare Case.**

Ejemplo:

```text
Requirement:
Programador Medtronic

Assigned:
EQ-0041
```

Debe mantenerse:

```text
Assignment
≠
Dispatch
```

y:

```text
Assignment
≠
Custody
```

Asignar una unidad no significa que el activo haya salido físicamente del almacén.

---

# 6. Assignment creation

Un Assignment nace cuando:

```text
User selects EquipmentAsset
↓
Backend validates
↓
Availability for Case evaluated
↓
Assignment confirmed
```

No debe considerarse Assignment cuando el usuario:

```text
opens selector
views equipment
temporarily selects row
previews availability
```

La confirmación debe ocurrir en backend.

---

# 7. Assignment validation

Antes de confirmar un Assignment deberán validarse como mínimo:

```text
same Company
EquipmentAsset exists
Lifecycle = ACTIVE
Condition allows use
no incompatible active custody
no blocking assignment conflict
target Case exists
target Case belongs to same Company
```

Cuando exista calendario suficiente también deberán evaluarse conflictos temporales.

---

# 8. Assignment conflict

Una misma unidad física no puede reservarse para Cases temporalmente incompatibles.

Ejemplo:

```text
CASE-0145
08:00–11:00
EQ-0041
```

```text
CASE-0146
09:00–12:00
EQ-0041
```

Resultado:

```text
BLOCK
```

No:

```text
WARNING
```

La validación debe ejecutarse nuevamente al confirmar la operación.

---

# 9. Case without complete schedule

Cuando el Case no tenga horario suficiente para evaluar conflictos:

```text
Assignment may be allowed
+
schedule verification warning
```

en Fase 1.

El sistema deberá comunicar claramente:

```text
Temporal availability could not be fully verified.
```

No debe presentarse como disponibilidad temporal garantizada.

---

# 10. Turnaround risk

Puede existir riesgo aunque no haya overlap directo.

Ejemplo:

```text
Case A ends:
11:00

Case B starts:
11:15
```

Puede no existir tiempo suficiente para:

```text
transport
return
inspection
preparation
dispatch
```

En una primera fase:

```text
Turnaround risk
→ WARNING
```

La política automática de:

```text
minimumTurnaroundMinutes
```

queda para una evolución posterior.

---

# 11. Reassignment

Antes de Dispatch puede permitirse:

```text
EQ-0041
↓
Reassign
↓
EQ-0042
```

Debe conservarse historia de la sustitución.

Después de Dispatch no puede reescribirse cuál unidad salió físicamente.

Una sustitución posterior requiere:

```text
new assignment
+
required physical operation
```

según el estado real del Case.

---

# 12. Release Assignment

Antes de Dispatch:

```text
Case cancelled
↓
Release Assignment
```

puede liberar la reserva operacional.

Después de Dispatch:

```text
Release Assignment alone
→ forbidden
```

porque debe resolverse primero la realidad física mediante Return u otro flujo excepcional autorizado.

---

# 13. Preparation

Preparation representa que almacén está preparando material y Equipment para el Case.

Debe mantenerse:

```text
Preparation
≠
Assignment
```

```text
Preparation
≠
Custody
```

El equipo puede estar:

```text
assigned
+
prepared
```

y seguir físicamente bajo custodia del almacén.

Preparation podrá relacionarse con:

```text
Case
CaseKit
EquipmentAsset
material
support items
responsible warehouse user
```

---

# 14. Dispatch

Dispatch representa una salida física confirmada para atender un Healthcare Case.

Debe mantenerse:

```text
Reusable Equipment Dispatch
≠
Commercial Inventory OUT
```

El Equipment continúa siendo propiedad de la Company.

Cuando:

```text
Warehouse
↓
Technician
```

lo que cambia es:

```text
Custody
```

No:

```text
owned inventory quantity
```

---

# 15. Dispatch requirements

Antes de confirmar Dispatch deberán validarse como mínimo:

```text
Case
Equipment Assignment
EquipmentAsset
Lifecycle
Condition
Availability
current custody
dispatch responsible
custodian
```

El backend debe revalidar los hechos al momento de confirmar.

No debe confiar exclusivamente en una validación realizada previamente por frontend.

---

# 16. Dispatch record

El Dispatch deberá conservar al menos:

```text
HealthcareCase
EquipmentAsset
Assignment
Custodian
Actor
Timestamp
Condition at dispatch
Origin location
Destination context
```

Cuando corresponda también podrá relacionarse con:

```text
CaseKit
support material
hospital
procedure
scheduled time
```

Debe mantenerse:

```text
Actor performing Dispatch
≠
Custodian
```

Ejemplo:

```text
Warehouse user:
Ana

Technician receiving equipment:
Carlos
```

Ana ejecuta la operación.

Carlos obtiene la custodia.

---

# 17. Custody

Custody responde:

> **¿Quién posee actualmente responsabilidad física sobre el EquipmentAsset?**

Debe mantenerse:

```text
Assignment
≠
Custody

Preparation
≠
Custody

Case schedule
≠
Custody
```

Custody cambia únicamente como resultado de una operación física confirmada.

---

# 18. Unique active custody

Invariante:

> **Un EquipmentAsset no puede poseer más de una custodia física activa simultáneamente.**

Ejemplo futuro:

```text
Carlos
↓
Ana
```

deberá registrarse como transferencia con historia.

Nunca mediante:

```text
currentCustodian = Ana
```

sobrescribiendo silenciosamente el pasado.

---

# 19. Location semantics

Healthcare utilizará Location de forma conservadora.

Ejemplos:

```text
Warehouse
External Custody
Hospital context
Case destination
```

UI conceptual:

```text
EQ-0041

With:
Carlos

Case:
CASE-0145

Destination:
Hospital ABC
```

Esto no implica:

```text
GPS tracking
precise physical coordinates
```

---

# 20. Return

Return responde:

> **¿La unidad física regresó bajo control de la Company?**

Debe procesarse individualmente por `EquipmentAsset`.

Debe mantenerse:

```text
Return
≠
Commercial Inventory IN
```

porque el activo nunca dejó de pertenecer a la Company.

También debe mantenerse:

```text
Return
≠
Available
```

---

# 21. Partial Return

Un Case puede devolver Equipment parcialmente.

Ejemplo:

```text
Dispatched:
EQ-0041
EQ-0042

Returned:
EQ-0041

Pending:
EQ-0042
```

Resultado:

```text
EQ-0041
→ returned to Company control

EQ-0042
→ remains in external custody
```

Un Return general del Case no debe ocultar Equipment pendiente.

---

# 22. Return and custody

Cuando Return se confirma:

```text
Technician
↓
Warehouse
```

termina la custodia externa correspondiente.

Debe registrarse:

```text
EquipmentAsset
Case
returning custodian
receiving actor
timestamp
condition observation
exceptions
notes
```

---

# 23. Return does not mean Available

Política Healthcare Fase 1:

```text
Return confirmed
↓
Warehouse custody restored
↓
Condition = INSPECTION_PENDING
↓
Availability = NO
```

hasta completar Inspection.

Esta regla es crítica.

Debe mantenerse:

> **Returned ≠ Available**

---

# 24. Missing Equipment during Return

Si una unidad esperada no regresa:

```text
Missing
≠
Lost
```

Debe permanecer registrada como pendiente o excepción operacional.

No puede convertirse automáticamente en:

```text
Lifecycle = RETIRED
Reason = LOST
```

La declaración formal de pérdida pertenece al workflow Core Equipment correspondiente.

---

# 25. Inspection policy

En Healthcare Fase 1:

> **Todo Equipment despachado para un Healthcare Case requiere Inspection después de Return.**

Más adelante podrá configurarse según:

```text
Product
Equipment type
Company
workflow
```

pero no forma parte de Fase 1.

---

# 26. Inspection

Inspection debe poder validar al menos:

```text
correct EquipmentAsset
assetCode
serial consistency
physical condition
operational condition
required accessories
support items
incident
notes
```

La identidad y Condition actuales pertenecen al contrato Core Equipment.

Healthcare genera el contexto operacional que origina la inspección.

---

# 27. Inspection result

Flujo:

```text
INSPECTION_PENDING
↓
Inspection
├── GOOD
├── DAMAGED
└── OUT_OF_SERVICE
```

Inspection actualiza:

```text
EquipmentCondition
```

No actualiza directamente:

```text
Availability
```

---

# 28. Availability after Inspection

Debe mantenerse:

```text
Inspection GOOD
↓
Availability Evaluator
```

No:

```text
Inspection GOOD
↓
available = true
```

porque pueden continuar otros blockers:

```text
assignment
custody
maintenance
calibration
other operational conflicts
```

---

# 29. Serial mismatch

Si se esperaba:

```text
EQ-0041 / SN-99102
```

y se recibe:

```text
EQ-0042 / SN-99103
```

debe generarse:

```text
RETURN EXCEPTION
```

Nunca debe hacerse una sustitución silenciosa.

El sistema debe conservar qué activo:

```text
was dispatched
was expected
was returned
```

---

# 30. Inspection history

Condition actual funciona como snapshot operacional.

Cada Inspection debe conservar historia.

Ejemplo:

```text
2026-08-13
CASE-0101
EQ-0041
Inspection GOOD

2026-09-12
CASE-0145
EQ-0041
Inspection DAMAGED
```

Una Inspection histórica no debe modificarse para alterar el pasado.

---

# 31. Availability

Availability es:

```text
derived
contextual
explainable
```

Nunca:

```text
manual boolean
```

Debe existir una lógica única utilizada por:

```text
Equipment Registry
Equipment 360
Equipment Selector
CaseKit
Case Calendar
Warehouse Operations
Mobile
API
```

Healthcare consume esa evaluación dentro del contexto del Case.

---

# 32. Current Availability

Pregunta:

```text
¿Puede utilizarse esta unidad ahora?
```

Puede depender de:

```text
Lifecycle ACTIVE
Condition GOOD
no blocking custody
Inspection satisfied
no maintenance blocker
no calibration blocker
no immediate operational blocker
```

La implementación del evaluator pertenece al diseño conjunto Core Equipment + consumidores.

---

# 33. Availability for Case

Healthcare agrega contexto:

```text
Target Case
Target schedule
Existing assignments
Conflict rules
```

Por tanto:

```text
Current Availability
≠
Availability for Case
```

Un Equipment actualmente libre puede no ser asignable a un Case futuro por conflicto temporal.

---

# 34. Availability result

La evaluación debe ser explicable.

Ejemplos:

```text
available: false
reason: INSPECTION_PENDING
```

```text
available: false
reason: EXTERNAL_CUSTODY
```

```text
available: false
reason: CASE_CONFLICT
```

```text
available: true
warnings:
- TURNAROUND_RISK
```

Los reason codes técnicos definitivos deberán cerrarse durante API design.

---

# 35. No Force Available

No debe existir una operación normal:

```text
Force Available
```

Debe resolverse la causa real.

Ejemplos:

```text
INSPECTION_PENDING
→ Complete Inspection
```

```text
CASE_CONFLICT
→ Reassign / Release Assignment
```

```text
EXTERNAL_CUSTODY
→ Return / Transfer Custody
```

```text
OUT_OF_SERVICE
→ Authorized Core Equipment resolution
```

---

# 36. Case lifecycle integration

Las operaciones de Equipment deberán reaccionar correctamente ante cambios del Case.

Ejemplos:

```text
Case scheduled
→ Equipment may be assigned
```

```text
Case rescheduled
→ assignment conflict must be re-evaluated
```

```text
Case cancelled before Dispatch
→ assignment may be released
```

```text
Case cancelled after Dispatch
→ physical Return still required
```

Nunca debe suponerse que cancelar un Case revierte automáticamente una operación física.

---

# 37. CaseKit integration

CaseKit puede declarar Equipment necesario para un Case.

Debe mantenerse:

```text
CaseKit requirement
≠
EquipmentAsset
```

Ejemplo:

```text
CaseKit:
Cardiac Procedure Kit

Requirement:
1 Programmer

Assignment:
EQ-0041
```

CaseKit describe necesidad.

Assignment identifica la unidad.

---

# 38. Warehouse Operations integration

Warehouse Operations utilizará Equipment para:

```text
view upcoming requirements
prepare assigned assets
confirm Dispatch
track external custody
receive Returns
identify pending Returns
trigger Inspection
```

El operador deberá poder identificar cada unidad mediante su:

```text
assetCode
Product
serialNumber when present
```

sin crear una identidad paralela.

---

# 39. Technician experience

La futura experiencia móvil del técnico deberá poder mostrar al menos:

```text
assigned Cases
assigned Equipment
assetCode
Product
serialNumber
hospital
schedule
custody state
pending Returns
```

Las acciones permitidas dependerán del workflow y permisos definidos.

El móvil no será fuente independiente de verdad.

---

# 40. Case 360

Case 360 deberá permitir visualizar:

```text
Equipment requirements
assigned EquipmentAssets
dispatch status
current custodian
return status
inspection status
exceptions
history
```

Sin duplicar la ficha maestra de Equipment.

Para detalles completos del activo deberá enlazar con Equipment 360/Core.

---

# 41. Equipment history inside Case

El Case deberá conservar una línea temporal explicable.

Ejemplo:

```text
08:10
EQ-0041 assigned

08:45
EQ-0041 prepared

09:00
EQ-0041 dispatched to Carlos

14:35
EQ-0041 returned

14:37
Inspection pending

15:05
Inspection GOOD
```

La historia debe representar eventos reales, no solamente el estado final.

---

# 42. Audit

Operaciones sensibles deberán ser auditables.

Como mínimo:

```text
assignment
reassignment
release
dispatch
custody transfer
return
return exception
inspection
```

El audit deberá conservar:

```text
Company
Actor
Timestamp
Entity
Action
Relevant before/after context
Reason when required
```

---

# 43. Permissions

Permisos conceptuales futuros:

```text
healthcare.equipment.read
healthcare.equipment.assign
healthcare.equipment.reassign
healthcare.equipment.release
healthcare.equipment.dispatch
healthcare.equipment.return
healthcare.equipment.inspect
```

Los nombres definitivos deberán alinearse con el RBAC general antes de implementación.

Healthcare no deberá otorgar mediante estos permisos capacidades Core como:

```text
Equipment retirement
assetCode correction
serial correction
```

sin pasar por los permisos y workflows Core correspondientes.

---

# 44. Multi-tenant rules

Toda relación deberá respetar:

```text
HealthcareCase.companyId
=
EquipmentAsset.companyId
=
Assignment.companyId
=
Dispatch.companyId
=
Return.companyId
=
Inspection.companyId
```

No deben existir operaciones cross-tenant.

`companyId` debe provenir del contexto autenticado y no utilizarse desde input del cliente como mecanismo de autorización.

---

# 45. Conceptual workflow

Flujo completo esperado:

```text
Healthcare Case
↓
Equipment Requirement
↓
Availability for Case
↓
Case Equipment Assignment
↓
Preparation
↓
Dispatch
↓
External Custody
↓
Procedure
↓
Return
↓
INSPECTION_PENDING
↓
Inspection
↓
EquipmentCondition updated
↓
Availability Evaluator
```

Este flujo no representa Inventory OUT / IN comercial.

---

# 46. Exception flow

Ejemplos que deberán soportarse:

```text
Assigned Equipment unavailable before Dispatch
→ Reassignment
```

```text
Case cancelled before Dispatch
→ Release Assignment
```

```text
Case cancelled after Dispatch
→ Return required
```

```text
Partial Return
→ remaining assets stay in external custody
```

```text
Serial mismatch
→ Return Exception
```

```text
Equipment not physically returned
→ Missing / unresolved custody
```

```text
Inspection detects damage
→ Condition DAMAGED
```

---

# 47. API design direction

No se consideran endpoints definitivos todavía.

Conceptualmente deberán existir operaciones orientadas al dominio, por ejemplo:

```text
Assign Equipment
Reassign Equipment
Release Assignment
Confirm Dispatch
Confirm Return
Complete Inspection
```

Debe evitarse modelar estos procesos como un CRUD genérico que permita sobrescribir estados.

Principio:

```text
Business operation
>
generic PATCH
```

---

# 48. Persistence direction

Los modelos técnicos definitivos deberán diseñarse después de cerrar los contratos de cada workflow.

Conceptualmente serán necesarias entidades o registros equivalentes a:

```text
CaseEquipmentRequirement
CaseEquipmentAssignment
EquipmentDispatch
EquipmentCustody
EquipmentReturn
EquipmentReturnItem / Asset Return
EquipmentInspection context
```

No deberán duplicar campos Core excepto snapshots históricos justificados.

---

# 49. Frontend direction

Experiencias previstas:

```text
Case 360
Equipment Selector
CaseKit preparation
Warehouse Dispatch
Return workspace
Inspection workspace
Case Calendar
Technician Mobile
```

Todas deberán utilizar los mismos contratos y Availability rules.

---

# 50. Current implementation status

Actualmente:

```text
Core Equipment persistence
→ IMPLEMENTED

Core Equipment registration/read API
→ IMPLEMENTED

EquipmentAsset identity
→ IMPLEMENTED IN ERP

Healthcare Equipment Assignment
→ NOT IMPLEMENTED

Healthcare Availability for Case
→ NOT IMPLEMENTED

Healthcare Preparation
→ NOT IMPLEMENTED

Healthcare Dispatch
→ NOT IMPLEMENTED

Healthcare Custody
→ NOT IMPLEMENTED

Healthcare Return
→ NOT IMPLEMENTED

Healthcare Inspection workflow
→ NOT IMPLEMENTED

Healthcare Equipment frontend
→ NOT IMPLEMENTED
```

Healthcare deberá construir sobre Core Equipment y no volver a implementar su identidad.

---

# 51. Implementation sequence

Orden recomendado:

```text
1. Equipment Requirement contract
2. Case Equipment Assignment
3. Availability for Case
4. Preparation integration
5. Dispatch
6. Custody
7. Return
8. Inspection workflow
9. Case 360 integration
10. Warehouse Operations UI
11. Calendar integration
12. Technician mobile integration
```

Cada bloque deberá seguir:

```text
Business Analysis
↓
Documentation
↓
Architecture Review
↓
Prisma Design when required
↓
Backend
↓
Tests
↓
QA
↓
Frontend
↓
Documentation Update
```

---

# 52. Acceptance principles

Healthcare Equipment deberá considerarse correcto únicamente cuando:

```text
no duplicate Equipment identity exists
no cross-tenant relationship is possible
assignment conflicts are blocked
physical Dispatch changes custody
Return can be partial
Returned does not imply Available
Inspection history is preserved
Condition and Availability remain separate
Case cancellation does not erase physical reality
all important operations are auditable
```

---

# Final Principle

Healthcare Equipment representa el uso operacional de una unidad física dentro de un Case.

Debe mantenerse siempre:

```text
Equipment Requirement
≠
Equipment Assignment

Assignment
≠
Dispatch

Assignment
≠
Custody

Dispatch
≠
Inventory OUT

Return
≠
Inventory IN

Return
≠
Available

Inspection GOOD
≠
Available

Missing
≠
Lost
```

`EquipmentAsset` pertenece a ERP/Core.

Healthcare debe registrar:

```text
why the asset is needed
which Case uses it
when it was assigned
when it physically left
who has custody
when it returned
what happened during inspection
```

sin redefinir la identidad física del activo.
