# Zaping Healthcare

**Producto:** Zaping Healthcare
**Plataforma:** Zaping
**Versión:** 1.0.0
**Estado:** Aprobado
**Estado de implementación:** DOMAIN FOUNDATION / NOT IMPLEMENTED
**Última actualización:** 2026-08-20
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Zaping Healthcare es la primera vertical especializada construida sobre Zaping ERP Core.

Su objetivo es resolver la operación comercial, logística y de trazabilidad de empresas que suministran:

* dispositivos médicos;
* implantes;
* consumibles;
* instrumental;
* equipos reutilizables;
* materiales utilizados en procedimientos;
* servicios de asistencia técnica asociados a procedimientos.

Healthcare no sustituye al ERP Core.

Lo especializa.

---

# 2. Principio fundamental

```text
Zaping ERP Core
=
operación empresarial genérica
```

```text
Zaping Healthcare
=
workflow especializado del sector salud
```

Por tanto:

> **Healthcare debe construirse sobre las capacidades del ERP Core sin contaminar los módulos genéricos con reglas específicas de procedimientos médicos.**

---

# 3. Problema que resuelve

En distribuidores médicos, una venta no siempre comienza con una cotización o un pedido convencional.

Una operación puede comenzar cuando:

```text
Doctor
↓
contacta al técnico
↓
solicita material para un procedimiento
```

o:

```text
Técnico
↓
identifica una oportunidad
↓
contacta al Doctor / Hospital
↓
se agenda un procedimiento
```

Posteriormente puede requerirse:

```text
preparar material
↓
armar maletín
↓
entregarlo a un técnico
↓
llevarlo al Hospital
↓
utilizar una parte
↓
regresar material no utilizado
↓
inspeccionarlo
↓
reconciliarlo
↓
convertir consumo en operación comercial
```

Un ERP genérico normalmente no modela correctamente este ciclo.

---

# 4. Alcance de Healthcare

Healthcare será responsable de conceptos como:

```text
Opportunity

Healthcare Case

Doctor

Hospital

Procedure context

Case Calendar

Preparation

KitTemplate

CaseKit

CaseDispatch

Custody

CaseReturn

Inspection

Reconciliation

Equipment / Assets
```

cuando cada capacidad sea implementada.

---

# 5. Fuera del alcance

Zaping Healthcare no pretende convertirse en:

* expediente clínico electrónico;
* sistema hospitalario HIS;
* sistema PACS;
* sistema de diagnóstico;
* sistema de prescripción médica;
* sistema de notas clínicas;
* repositorio de historia clínica.

La plataforma debe limitarse a información necesaria para:

```text
operación
logística
comercialización
trazabilidad
custodia
inventario
```

---

# 6. Principio de minimización clínica

Debe evitarse almacenar datos clínicos de pacientes salvo que exista una necesidad operacional concreta, documentada y aprobada.

En particular, Healthcare no debe comenzar recopilando:

```text
diagnóstico
historia clínica
resultados médicos
tratamientos
datos sensibles innecesarios
```

solo porque técnicamente sea posible.

---

# 7. Flujo maestro

La dirección funcional general es:

```text
Opportunity
↓
Healthcare Case
↓
Schedule / Calendar
↓
Preparation
↓
CaseKit
↓
Dispatch
↓
Technician Custody
↓
Procedure
↓
Return
↓
Inspection
↓
Reconciliation
```

Después de Reconciliation pueden producirse consecuencias comerciales y de inventario.

---

# 8. Flujo comercial relacionado

Healthcare puede integrarse con:

```text
Opportunity
↓
Quote
↓
SalesOrder
↓
Delivery
```

pero estas operaciones no son obligatoriamente lineales en todos los casos.

---

# 9. Caso sin Quote previa

Debe ser posible:

```text
Doctor request
↓
Healthcare Case
↓
Procedure
↓
Used Material
↓
Commercial operation
```

cuando el proceso real así ocurra.

---

# 10. Caso originado por oportunidad comercial

También:

```text
Technician prospecting
↓
Opportunity
↓
Doctor / Hospital interest
↓
Healthcare Case
```

---

# 11. Separación de actores

Healthcare debe mantener separados:

```text
Doctor
Hospital
Customer
Payer
Technician
```

aunque en una operación concreta algunos puedan relacionarse.

---

# 12. Doctor

Doctor representa al profesional relacionado con la oportunidad o procedimiento.

Puede:

* solicitar material;
* influir en la selección de producto;
* participar en múltiples Hospitals;
* generar futuras Opportunities.

---

# 13. Doctor no es Customer

Debe cumplirse:

```text
Doctor
≠
Customer
```

El Doctor puede generar demanda sin ser la entidad que compra o recibe factura.

---

# 14. Doctor multi-hospital

Un Doctor puede trabajar o realizar procedimientos en múltiples Hospitals.

Por tanto no debe modelarse como una simple propiedad fija:

```text
Doctor.hospitalId
```

sin analizar esa relación.

---

# 15. Hospital

Hospital representa el lugar u organización donde puede realizarse un procedimiento.

Puede aportar:

* ubicación;
* contexto logístico;
* requerimientos;
* contactos;
* agenda;
* restricciones.

---

# 16. Hospital no es necesariamente Customer

Debe cumplirse:

```text
Hospital
≠
Customer
```

En algunos casos pueden representar la misma organización empresarial.

En otros:

```text
Hospital
→ lugar del procedimiento

Customer
→ empresa que compra
```

---

# 17. Payer

Payer representa quién asume económicamente la operación cuando corresponda.

Puede ser:

```text
Hospital
Insurance Company
Patient / Private
Government entity
Other organization
```

según el caso real.

---

# 18. Payer no es Customer

Debe distinguirse:

```text
Customer
→ contraparte comercial
```

de:

```text
Payer
→ responsable económico
```

Pueden coincidir.

No tienen que hacerlo.

---

# 19. Insurance

Healthcare debe estar preparado para operaciones donde una aseguradora intervenga en el proceso económico.

No se debe introducir todavía lógica compleja de seguros hasta documentar los workflows reales.

---

# 20. Technician

Technician representa al usuario o colaborador que participa en operaciones Healthcare.

Puede tener funciones:

```text
comerciales
+
operativas
+
asistencia en procedimiento
```

dependiendo de la empresa.

---

# 21. Technician no es necesariamente un rol único

El concepto empresarial:

```text
Technician
```

no debe confundirse automáticamente con un enum rígido de autorización.

Un User puede tener responsabilidades Healthcare mediante roles/permisos adecuados.

---

# 22. Opportunity

Opportunity representa una posibilidad comercial previa a una operación confirmada.

Puede originarse por:

```text
Doctor request
Technician prospecting
Hospital request
Commercial lead
Existing Customer
Other source
```

---

# 23. Opportunity puede existir antes de Case

Debe ser válido:

```text
Opportunity
↓
qualification
↓
Healthcare Case
```

---

# 24. Opportunity no reserva inventario

Crear una oportunidad:

```text
→ no Inventory movement
→ no reservation automática
```

---

# 25. Opportunity no es Quote

Debe distinguirse:

```text
Opportunity
→ posibilidad comercial
```

de:

```text
Quote
→ propuesta económica
```

---

# 26. Opportunity no es Case

También:

```text
Opportunity
→ posibilidad
```

```text
Case
→ operación/procedimiento concreto
```

Una Opportunity puede no convertirse en Case.

---

# 27. Healthcare Case

Healthcare Case es el agregado operacional principal de la vertical.

Representa:

> una operación relacionada con un procedimiento o evento Healthcare que requiere coordinación comercial, logística y de materiales.

---

# 28. Case no es expediente clínico

Healthcare Case no debe almacenar por defecto:

* diagnóstico detallado;
* historia médica;
* tratamiento clínico;
* notas médicas;
* estudios;
* datos clínicos extensos.

---

# 29. Información operacional de Case

Un Case puede necesitar conceptualmente:

```text
identifier / folio
Company
scheduled start
scheduled end
Doctor
Hospital
procedure type
Technician
status
commercial context
logistics readiness
notes operativas
```

El modelo definitivo se diseñará posteriormente.

---

# 30. Procedure

`Procedure` representa el tipo o contexto operativo del procedimiento.

Ejemplos pueden incluir categorías empresariales utilizadas por la distribuidora.

No debe utilizarse para construir un sistema clínico.

---

# 31. Procedure Catalog

Puede existir posteriormente un catálogo reusable que ayude a:

* preparación;
* CaseKit;
* tiempos;
* Equipment;
* productos frecuentes.

No se define todavía su schema.

---

# 32. Lifecycle de Case

El lifecycle exacto será definido en `CASES.md`.

Conceptualmente debe poder representar etapas como:

```text
PLANNED
↓
READY
↓
IN_PROGRESS
↓
RECONCILIATION_PENDING
↓
COMPLETED
```

además de cancelación cuando corresponda.

---

# 33. Estados no aprobados como enum

Los nombres anteriores describen semántica funcional.

Este documento **no ordena todavía crear esos valores en Prisma**.

---

# 34. Case Calendar

Healthcare necesita una lectura temporal especializada:

```text
Case Calendar
```

que permita visualizar Cases por fecha y hora.

---

# 35. Calendar como Read Model

Case Calendar no necesita ser un agregado independiente.

Conceptualmente:

```text
Healthcare Cases
↓
Calendar Read Model
```

---

# 36. Información del Calendar

Debe permitir visualizar información como:

```text
Date / Time
Case
Hospital
Doctor
Technician
Procedure
Status
Readiness
```

---

# 37. Filtros

Capacidades objetivo:

```text
Technician
Hospital
Doctor
Status
Procedure
Date range
```

---

# 38. Conflictos

Calendar deberá evolucionar hacia detección de conflictos.

Ejemplos:

```text
same Technician
+
overlapping Cases
```

o:

```text
same Equipment
+
overlapping Cases
```

---

# 39. Readiness

Calendar debe ayudar a detectar:

```text
Case scheduled
+
material not prepared
```

antes de que se convierta en un problema operativo.

---

# 40. Preparation

Preparation representa el trabajo previo necesario para que un Case esté listo.

Puede incluir:

```text
material review
availability check
CaseKit assembly
Equipment assignment
batch selection
documentation
warehouse preparation
```

---

# 41. Preparation no cambia automáticamente ownership

Preparar material:

```text
→ no significa venta
```

ni:

```text
→ salida comercial definitiva
```

---

# 42. KitTemplate

`KitTemplate` representa una configuración reutilizable.

Ejemplo:

```text
Procedure Type A
├── Product X × 2
├── Product Y × 4
└── Equipment Z
```

---

# 43. KitTemplate no es inventario

Debe cumplirse:

```text
KitTemplate
→ recipe / configuration
```

no:

```text
KitTemplate
→ physical stock
```

---

# 44. CaseKit

`CaseKit` representa la preparación real para un Case concreto.

```text
KitTemplate
↓ optional basis
CaseKit
```

---

# 45. CaseKit puede modificarse

El material requerido para un Case real puede diferir del template.

Por tanto:

```text
CaseKit
≠
immutable copy of KitTemplate
```

antes del Dispatch.

---

# 46. Contenido de CaseKit

Puede incluir conceptualmente:

```text
Product
Quantity
Batch
Serial
Equipment
Preparation status
```

según la trazabilidad del producto.

---

# 47. CaseKit es instancia

Debe mantenerse:

```text
KitTemplate
→ reusable definition
```

```text
CaseKit
→ actual prepared set
```

---

# 48. CaseKit y disponibilidad

Agregar una partida a CaseKit no implica necesariamente:

```text
Inventory OUT
```

---

# 49. Reserva futura

Puede existir una futura estrategia de Reservation.

Pero:

```text
CaseKit
≠
automatic reservation
```

hasta que exista una decisión formal.

---

# 50. Dispatch

`CaseDispatch` representa la entrega física de material de la Company a un responsable para atender un Case.

---

# 51. Caso operativo típico

```text
Warehouse
↓
prepares CaseKit
↓
Technician receives it
↓
takes material to Hospital
```

---

# 52. Principio de Custody

El material despachado puede:

```text
estar físicamente fuera del almacén
```

mientras sigue siendo:

```text
propiedad de la Company
```

---

# 53. CaseDispatch no es Delivery

Regla crítica:

```text
CaseDispatch
≠
Sales Delivery
```

---

# 54. Razón

Delivery significa:

```text
fulfillment comercial definitivo
```

CaseDispatch significa:

```text
custodia temporal para un Case
```

---

# 55. CaseDispatch no es Inventory OUT comercial

También:

```text
CaseDispatch
≠
commercial Inventory OUT
```

El material puede regresar sin haber sido vendido ni consumido.

---

# 56. Disponibilidad física

Healthcare introduce una distinción importante entre:

```text
Company-owned physical inventory
```

y:

```text
available warehouse inventory
```

---

# 57. Ejemplo

```text
Product A
Company-owned quantity: 10

Warehouse available: 6
Technician custody: 4
```

La Company continúa siendo propietaria de las 10 unidades.

---

# 58. Consecuencia arquitectónica

El modelo actual basado principalmente en:

```text
Product.stock
```

eventualmente necesitará representar mejor:

```text
location
custody
availability
state
```

---

# 59. No cambiar Inventory todavía

Healthcare documenta esta necesidad.

No autoriza todavía modificar el schema de Inventory.

---

# 60. Chain of Custody

Dispatch debe poder responder:

```text
¿Qué salió?
¿Cuánto?
¿Qué lote?
¿Qué serie?
¿Quién lo entregó?
¿Quién lo recibió?
¿Cuándo?
¿Para qué Case?
```

---

# 61. Responsable

Debe existir una identidad clara de:

```text
responsible Technician
```

o responsable equivalente.

---

# 62. Warehouse actor

También debe conocerse quién preparó/entregó el material cuando la operación lo requiera.

---

# 63. Dispatch timestamp

Debe conservarse cuándo se produjo la transferencia de custodia.

---

# 64. Hoja de salida

El flujo actual de empresas como INSAP utiliza documentos físicos de salida.

Healthcare deberá digitalizar progresivamente esa información.

Campos operativos importantes incluyen:

```text
entrada / salida
clave producto
descripción
material de apoyo
referencias
responsable
Hospital
procedimiento
fecha
```

---

# 65. Documento digital futuro

CaseDispatch puede generar posteriormente:

```text
Dispatch document
PDF
QR
signature
```

sin que el documento se convierta en la fuente de inventario.

---

# 66. Procedure Execution

Durante el procedimiento pueden ocurrir resultados distintos para cada partida:

```text
Used
Returned
Unresolved
```

---

# 67. Used

Representa material que efectivamente fue utilizado/consumido.

---

# 68. Returned

Representa material que regresa a custodia del almacén.

---

# 69. Unresolved

Representa diferencia todavía no explicada.

Ejemplos:

```text
missing
pending verification
incident
damaged
unknown disposition
```

---

# 70. Reconciliation

Reconciliation compara:

```text
qué salió
```

contra:

```text
qué ocurrió
```

---

# 71. Invariante central

Debe cumplirse:

```text
Dispatched Quantity
=
Used
+
Returned
+
Unresolved
```

para toda partida reconciliada.

---

# 72. Ejemplo

```text
Dispatched: 10

Used:       3
Returned:   6
Unresolved: 1

10 = 3 + 6 + 1
```

---

# 73. Reconciliation completa

Un Case no debería considerarse completamente cerrado desde el punto de vista logístico mientras exista:

```text
Unresolved > 0
```

salvo workflow excepcional documentado.

---

# 74. CaseReturn

`CaseReturn` representa el regreso de material previamente despachado bajo custodia.

---

# 75. CaseReturn no es SaleReturn

Debe cumplirse:

```text
CaseReturn
≠
Customer Return
```

---

# 76. Diferencia

```text
CaseReturn
→ company-owned material comes back
```

```text
SaleReturn
→ previously commercially delivered material returns
```

---

# 77. Inspection

El material retornado puede necesitar inspección antes de recuperar disponibilidad.

---

# 78. Razón

Especialmente en Healthcare:

```text
Returned
≠
Automatically Sellable
```

---

# 79. Resultados conceptuales de Inspection

Una inspección futura puede determinar estados como:

```text
AVAILABLE
QUARANTINE
DAMAGED
EXPIRED
MAINTENANCE
OTHER
```

No se aprueba todavía un enum.

---

# 80. Productos abiertos

Un producto abierto o con empaque comprometido no debe retornar automáticamente a disponibilidad.

---

# 81. Productos vencidos

Un producto vencido puede existir físicamente, pero:

```text
expired
→ not sellable
```

---

# 82. Material dañado

Material dañado tampoco debe convertirse automáticamente en disponible.

---

# 83. Equipment

Healthcare necesita distinguir productos consumibles de activos reutilizables.

---

# 84. Product vs EquipmentAsset

Conceptualmente:

```text
Product
→ catálogo / modelo
```

```text
EquipmentAsset
→ physical reusable unit
```

---

# 85. Ejemplo

```text
Product
Monitor XYZ

EquipmentAsset
EQ-00041
Serial SN-99102
```

---

# 86. Stock no es suficiente para Equipment

No debe modelarse un equipo reutilizable únicamente como:

```text
Product.stock = 3
```

cuando necesitamos saber:

```text
qué unidad
dónde está
quién la tiene
en qué condición
```

---

# 87. Equipment lifecycle

Una evolución puede incluir:

```text
AVAILABLE
ASSIGNED
IN_CUSTODY
MAINTENANCE
CALIBRATION
OUT_OF_SERVICE
```

Los estados definitivos se diseñarán en `EQUIPMENT.md`.

---

# 88. Equipment history

Debe poder reconstruirse:

```text
Asset
↓
Cases
↓
Custody
↓
Returns
↓
Condition
↓
Maintenance
```

---

# 89. Serial

Equipment es un candidato natural para seguimiento por serial.

---

# 90. Maintenance

Mantenimiento pertenece a una evolución posterior.

No debe bloquear la primera implementación de Equipment identity/custody.

---

# 91. Calibration

Algunos equipos pueden requerir calibración.

Esta capacidad puede ser relevante para Healthcare futuro, pero debe implementarse según necesidad real y requisitos aplicables.

---

# 92. Sales integration

Healthcare no reemplaza Sales.

Después de reconciliar material utilizado:

```text
Used Material
↓
Commercial fulfillment
```

puede integrarse con:

```text
SalesOrder / Delivery
```

según el workflow comercial.

---

# 93. Riesgo de doble decremento

Debe evitarse:

```text
CaseDispatch
↓
stock decrement

Used Material
↓
Delivery
↓
second stock decrement
```

para la misma unidad física.

---

# 94. Regla

> **El sistema nunca debe descontar dos veces la misma existencia por confundir custodia con consumo comercial.**

---

# 95. Estrategia conceptual

La arquitectura deberá distinguir entre:

```text
Location / Custody movement
```

y:

```text
Ownership / commercial disposition
```

---

# 96. Inventory integration

Inventory continúa siendo propietario de la verdad física general.

Healthcare proporciona eventos especializados como:

```text
CaseDispatch
CaseReturn
Reconciliation
```

---

# 97. InventoryMovement

No todo evento Healthcare necesita convertirse automáticamente en un:

```text
InventoryMovement OUT
```

del modelo comercial actual.

La integración exacta se diseñará con Inventory.

---

# 98. SalesOrder antes del Case

También puede existir:

```text
Quote
↓
SalesOrder
↓
Healthcare Case
```

si la operación comercial se confirma previamente.

---

# 99. SalesOrder después del Case

En otros escenarios:

```text
Healthcare Case
↓
Procedure
↓
Reconciliation
↓
SalesOrder / Delivery
```

puede reflejar mejor la operación real.

---

# 100. Invoice

La facturación puede ocurrir:

```text
antes
durante
después
```

del fulfillment físico según el proceso.

Healthcare no debe acoplar el cierre del Case a la existencia de Invoice.

---

# 101. Payer y Billing

La presencia de Payer deberá integrarse posteriormente con Billing.

No se debe implementar ahora un workflow de seguros improvisado dentro de Case.

---

# 102. Warehouse Operations

Healthcare necesita una experiencia operacional para almacén.

Conceptualmente:

```text
Warehouse Operations
```

puede coordinar:

```text
Purchase Receipts
Case Preparation
Case Dispatch
Case Returns
Inspection
Deliveries
Customer Returns
Equipment
```

---

# 103. Workspace, no nuevo dominio

Warehouse Operations debe considerarse principalmente:

```text
task-oriented workspace
```

que coordina dominios existentes.

No necesita duplicar sus reglas.

---

# 104. Ejemplo de atención

```text
Hoy

3 recepciones por procesar
2 Cases por preparar
1 CaseKit pendiente
2 devoluciones pendientes de inspección
1 Equipment sin regresar
```

---

# 105. Healthcare Dashboard

El Dashboard principal puede mostrar resumen Healthcare cuando la Company utilice la vertical.

Ejemplo:

```text
Cases today
Cases tomorrow
Cases not ready
Equipment conflicts
Pending reconciliation
```

---

# 106. Core Dashboard no contaminado

Una Company que no utiliza Healthcare no necesita esas métricas.

---

# 107. Case 360

La vista principal de un Case debe evolucionar hacia:

```text
Case identity
↓
Schedule
↓
Actors
↓
Commercial context
↓
Preparation
↓
CaseKit
↓
Dispatch
↓
Return
↓
Reconciliation
↓
Timeline
```

---

# 108. Acción contextual

Ejemplos:

```text
PLANNED
→ Preparar
```

```text
READY
→ Despachar
```

```text
IN PROCEDURE
→ Registrar resultado
```

```text
RETURNED
→ Inspeccionar
```

```text
RECONCILIATION PENDING
→ Reconciliar
```

según lifecycle final.

---

# 109. No pedir información repetida

Si Case ya conoce:

```text
Doctor
Hospital
Technician
```

Preparation y Dispatch no deben pedir nuevamente esos datos sin razón.

---

# 110. Identificadores

Healthcare utilizará UUID como identificadores técnicos, siguiendo ADR-004.

Cuando sea útil, Case, Dispatch u otros documentos pueden tener folios empresariales independientes.

---

# 111. Multi-tenancy

Todo dato Healthcare debe pertenecer directa o indirectamente a:

```text
Company
```

---

# 112. Regla cross-tenant

Debe rechazarse cualquier relación como:

```text
Case Company A
→ Doctor / Hospital / Product / Technician Company B
```

si esos recursos son tenant-owned.

---

# 113. Doctors/Hospitals y tenant ownership

El diseño exacto de Doctor y Hospital deberá decidir si son:

```text
Company-owned master data
```

o entidades más generales con relación tenant específica.

No se decide todavía en este documento.

---

# 114. Authorization

Healthcare deberá evolucionar hacia permisos conceptuales como:

```text
healthcare.cases.read
healthcare.cases.create
healthcare.cases.update

healthcare.casekits.prepare

healthcare.dispatch.create
healthcare.dispatch.confirm

healthcare.return.create
healthcare.inspect
healthcare.reconcile

healthcare.equipment.read
healthcare.equipment.assign
```

Los nombres definitivos se definirán con RBAC.

---

# 115. Separación de funciones

Una empresa puede requerir:

```text
Technician
→ request / receive custody
```

```text
Warehouse
→ prepare / dispatch / receive
```

```text
Manager
→ resolve incidents
```

---

# 116. Backend como autoridad

Frontend puede facilitar el workflow.

Backend debe validar:

```text
tenant
permissions
status
quantities
batches
serials
custody
reconciliation
```

---

# 117. Concurrencia

Healthcare deberá contemplar escenarios como:

```text
same Equipment
→ assigned to two overlapping Cases
```

o:

```text
same batch quantity
→ prepared for multiple operations
```

cuando existan reservas/asignaciones.

---

# 118. Idempotencia

Operaciones críticas como:

```text
confirm Dispatch
confirm Return
confirm Reconciliation
```

deben evitar duplicación ante retries.

---

# 119. Audit

Acciones candidatas a auditoría:

```text
Case created
Case scheduled
Case technician changed
CaseKit prepared
Dispatch confirmed
Custody accepted
Return registered
Inspection completed
Reconciliation confirmed
Equipment assigned
Incident resolved
```

---

# 120. Audit minimization

Los eventos de Audit deben guardar únicamente contexto operativo necesario.

---

# 121. Incident

Cuando:

```text
Unresolved > 0
```

puede requerirse un Incident o excepción operacional.

---

# 122. Incident no significa pérdida automáticamente

`Unresolved` puede representar:

```text
pending verification
documentation mismatch
missing item
damaged item
other discrepancy
```

---

# 123. Resolution

El workflow futuro debe permitir convertir:

```text
Unresolved
↓
Resolved disposition
```

sin reescribir la reconciliación histórica original de forma silenciosa.

---

# 124. Current State

Actualmente Zaping Healthcare se encuentra en:

```text
DOMAIN DISCOVERY
+
ARCHITECTURE APPROVED
+
DOCUMENTATION FOUNDATION
```

No debe marcarse como módulo implementado.

---

# 125. Capacidades ya definidas conceptualmente

Se consideran aprobadas las siguientes decisiones:

```text
Healthcare as vertical over ERP Core

Opportunity before Case

Doctor ≠ Customer

Hospital ≠ Customer

Payer ≠ Customer

Case Calendar

KitTemplate ≠ CaseKit

CaseDispatch = temporary custody

CaseDispatch ≠ Delivery

CaseReturn ≠ SaleReturn

Inspection before availability when required

Reconciliation:
Dispatched = Used + Returned + Unresolved

EquipmentAsset identity
```

---

# 126. Target inicial

La primera versión Healthcare debe enfocarse en:

```text
Case
Calendar
Preparation
CaseKit
Dispatch
Custody
Return
Reconciliation
Equipment identity
```

---

# 127. Future

Capacidades posteriores pueden incluir:

```text
Opportunity CRM
Advanced doctor relationships
Hospital requirements
Payer workflows
Insurance authorization
Equipment maintenance
Calibration
QR workflows
Mobile technician app
Electronic signatures
Document management
Advanced analytics
Notifications
AI assistance
```

---

# 128. No implementar todo simultáneamente

La existencia de estas capacidades en el diseño no implica construirlas en una sola entrega.

---

# 129. Secuencia documental

Después de `HEALTHCARE.md`, se documentarán:

```text
OPPORTUNITIES.md
CASES.md
CASE_CALENDAR.md
CASE_KITS.md
CASE_LOGISTICS.md
EQUIPMENT.md
```

---

# 130. Posible documento adicional

Durante el diseño puede resultar necesario separar posteriormente:

```text
DOCTORS_HOSPITALS.md
```

o un módulo equivalente si la complejidad de esas entidades lo justifica.

No se crea todavía.

---

# 131. Secuencia técnica

Después de completar documentación Healthcare:

```text
Domain model
↓
Entity boundaries
↓
ADR if required
↓
Feature plan
↓
Prisma design
↓
Migration
↓
Backend
↓
Frontend
↓
Tests
↓
QA
```

---

# 132. No Prisma todavía

Este documento no autoriza:

```text
model HealthcareCase
model Doctor
model Hospital
model CaseKit
model CaseDispatch
model EquipmentAsset
```

todavía.

Primero deben consolidarse sus reglas específicas.

---

# 133. API

No existen todavía endpoints Healthcare implementados.

Por tanto este documento no declara rutas reales.

---

# 134. API objetivo conceptual

En el futuro podrán existir capacidades equivalentes a:

```text
Cases
Case Calendar
CaseKit preparation
Dispatch
Return
Reconciliation
Equipment
```

siguiendo `API_GUIDELINES.md`.

---

# 135. OpenAPI

Cuando exista implementación, los contratos detallados deberán documentarse mediante OpenAPI.

---

# 136. UX

Healthcare seguirá los mismos principios de Zaping:

> **Simple por defecto. Poderoso cuando se necesita.**

---

# 137. Workflow UX

La experiencia debe priorizar:

```text
context
↓
next task
↓
action
```

en lugar de obligar a navegar por tablas desconectadas.

---

# 138. Mobile future

Healthcare es un candidato especialmente fuerte para una experiencia móvil debido al trabajo de técnicos fuera del almacén.

---

# 139. QR future

QR puede ayudar posteriormente con:

```text
CaseKit
Equipment
Dispatch
Return
Batch
Serial
```

pero no es requisito para definir correctamente el dominio.

---

# 140. Notifications

Podrán existir alertas como:

```text
Case tomorrow not prepared
Equipment conflict
CaseKit incomplete
Return pending
Reconciliation unresolved
```

---

# 141. Integración con Products

Healthcare utiliza `Product` como catálogo común.

No debe crear un segundo catálogo completo de productos.

---

# 142. Healthcare Product Profile

Si algunos productos requieren atributos específicos Healthcare, podrá diseñarse posteriormente una extensión.

No debe llenar `Product` de campos especializados sin evaluar esa frontera.

---

# 143. Integración con InventoryBatch

Healthcare deberá reutilizar:

```text
InventoryBatch
```

para trazabilidad por lote.

---

# 144. Integración con seriales

Cuando serial tracking exista, Healthcare deberá reutilizar esa identidad física.

No crear un segundo sistema de seriales solamente para Healthcare.

---

# 145. Integración con Customers

Customer permanece como contraparte comercial.

Case puede relacionarse con Customer cuando se conozca.

No debe exigirse Customer para crear Opportunity o Case si el proceso real todavía no lo conoce.

---

# 146. Integración con Sales

Sales continúa siendo propietario del compromiso y fulfillment comercial.

Healthcare no debe duplicar:

```text
SalesOrder
Delivery
```

---

# 147. Integración con Returns

`SaleReturn`/Return continúa siendo devolución comercial.

Healthcare utiliza:

```text
CaseReturn
```

para custodia temporal.

---

# 148. Integración con Audit

Healthcare proporcionará eventos empresariales importantes a Audit cuando esa infraestructura exista.

---

# 149. Integración con Dashboard

Dashboard puede consumir Healthcare Read Models.

Healthcare no debe trasladar lógica empresarial al Dashboard.

---

# 150. Invariantes principales

```text
Healthcare
→ belongs to one Company context
```

```text
Doctor
≠
Customer by definition
```

```text
Hospital
≠
Customer by definition
```

```text
Payer
≠
Customer by definition
```

```text
Opportunity
≠
Case
```

```text
Case
≠
clinical record
```

```text
KitTemplate
≠
CaseKit
```

```text
CaseKit
≠
automatic Inventory OUT
```

```text
CaseDispatch
≠
Delivery
```

```text
CaseDispatch
≠
commercial Inventory OUT
```

```text
CaseReturn
≠
SaleReturn
```

```text
Returned
≠
Automatically Available
```

```text
Dispatched
=
Used + Returned + Unresolved
```

```text
Same physical inventory
→ must never be decremented twice
```

```text
EquipmentAsset
≠
Product stock quantity
```

---

# 151. Anti-patrones

## Case as clinical record

Agregar historia clínica y diagnósticos sin necesidad operacional.

---

## Doctor as Customer

Forzar:

```text
Doctor
→ Customer
```

para poder crear Case.

---

## Hospital as Customer

Forzar:

```text
Hospital
→ Customer
```

aunque la contraparte comercial sea diferente.

---

## CaseDispatch as Sale

Convertir automáticamente cada salida a procedimiento en venta.

---

## Inventory OUT on Dispatch

Descontar definitivamente material antes de saber qué fue utilizado.

---

## Double Decrement

Descontar en Dispatch y volver a descontar al generar Delivery.

---

## CaseKit as Template

Modificar una plantilla compartida para representar un Case concreto.

---

## Product stock for Equipment identity

Intentar conocer custodia de equipo reutilizable solo mediante cantidad.

---

## Return directly available

Reintegrar automáticamente todo material retornado sin Inspection cuando sea necesaria.

---

## Healthcare logic inside ERP Core

Agregar campos como:

```text
doctorId
hospitalId
procedureId
```

a entidades genéricas únicamente porque Healthcare los utiliza.

---

## One giant Healthcare model

Crear:

```text
HealthcareCase
```

con decenas de responsabilidades:

```text
commercial
inventory
equipment
return
billing
insurance
audit
```

en una sola tabla.

---

# 152. ADR relacionados

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

ADR-013 es la decisión arquitectónica principal para la separación entre custodia Healthcare e Inventory OUT comercial.

---

# 153. Documentos relacionados

```text
product/PRODUCT_VISION.md
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md

architecture/ARCHITECTURE.md
architecture/adr/ADR-013-inventory-custody-case-logistics.md

engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md

modules/erp/COMPANIES.md
modules/erp/IDENTITY_ACCESS.md
modules/erp/PRODUCTS.md
modules/erp/INVENTORY.md
modules/erp/SALES.md
modules/erp/RETURNS.md
modules/erp/DASHBOARD.md
```

---

# 154. Fuente de verdad

```text
HEALTHCARE.md
→ fronteras y workflow general de Healthcare

OPPORTUNITIES.md
→ oportunidad comercial Healthcare

CASES.md
→ lifecycle y comportamiento de Healthcare Case

CASE_CALENDAR.md
→ planificación temporal

CASE_KITS.md
→ preparación y material requerido

CASE_LOGISTICS.md
→ Dispatch, Custody, Return, Inspection y Reconciliation

EQUIPMENT.md
→ activos reutilizables

ERP module docs
→ comportamiento del Core

ADR-013
→ decisión de custodia vs commercial OUT

PROJECT_BOARD.md
→ estado de implementación

schema.prisma
→ modelo técnico únicamente cuando sea implementado
```

---

# 155. Principio final

El centro de Zaping Healthcare no es simplemente:

```text
una cirugía
```

ni:

```text
una venta
```

ni:

```text
un movimiento de inventario
```

Es la coordinación de una operación completa:

```text
Opportunity
↓
Case
↓
Preparation
↓
Custody
↓
Procedure
↓
Return
↓
Reconciliation
↓
Commercial consequence
```

manteniendo separadas las verdades de:

```text
qué se planeó
qué se preparó
qué salió
quién lo tuvo
qué se utilizó
qué regresó
qué quedó pendiente
qué se vendió
```

> **Zaping Healthcare debe conectar operación, inventario y negocio sin confundir custodia temporal con consumo, ni contexto médico con información clínica innecesaria.**
