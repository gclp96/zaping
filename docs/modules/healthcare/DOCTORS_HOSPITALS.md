# Doctors & Hospitals — Zaping Healthcare

**Módulo:** Healthcare Doctors & Hospitals
**Producto:** Zaping Healthcare
**Versión:** 1.0.0
**Estado:** Aprobado
**Estado de implementación:** PARTIALLY IMPLEMENTED — BACKEND C1-C4 MERGED; C5 GATES PASS / PRE-COMMIT
**Última actualización:** 2026-09-11
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Doctors & Hospitals define las identidades y relaciones operacionales utilizadas por Zaping Healthcare para representar profesionales médicos y lugares donde ocurren Healthcare Cases.

El objetivo es responder correctamente:

```text
¿Quién es el Doctor?
¿En qué Hospitals trabaja?
¿Dónde ocurrirá el Case?
¿Quién solicita el material?
¿Quién compra?
¿Quién paga?
¿Son realmente la misma entidad?
```

sin convertir esas relaciones en equivalencias incorrectas.

---

# 1.1 Scope y límites de decisión

Este documento corresponde a:

```text
HC-NEXT-01 — Hospital / Doctor Domain Design
APPROVED DOMAIN DESIGN
```

Define dominio y comportamiento conceptual. Durante la fase HC-NEXT-01A no
implementó ni aprobó por sí solo:

```text
Prisma models
migrations
database constraints
backend / API / DTOs
frontend
RBAC
enums
seeds
tests
```

El technical design y los slices C1-C5 posteriores son la autoridad para los
nombres Prisma, contratos API y estado de implementación.

Estado CURRENT por concepto:

```text
Doctor
→ BACKEND IMPLEMENTED

Hospital
→ BACKEND IMPLEMENTED

Doctor / Hospital affiliation
→ BACKEND IMPLEMENTED

HealthcareCase Doctor / Hospital relationships
→ BACKEND IMPLEMENTED

Backend hardening
→ C5 GATES PASS / PRE-COMMIT

Frontend master data, Case selectors and duplicate-review UX
→ NOT IMPLEMENTED / FUTURE
```

---

# 2. Principio fundamental

Zaping debe mantener separados:

```text
Doctor
Hospital
Customer
Payer
Technician
```

porque representan responsabilidades distintas.

Debe mantenerse además:

```text
HealthcareCase ≠ Clinical Record
Doctor ≠ Customer
Doctor ≠ User
Doctor ≠ Technician identity
Doctor ≠ clinical record
Hospital ≠ Customer
Hospital ≠ Company
Affiliation ≠ HealthcareCase
Technician → User acting operationally in Healthcare
```

---

# 3. Regla principal

```text
Doctor
≠
Hospital
≠
Customer
≠
Payer
```

Aunque en determinadas operaciones algunas relaciones puedan coincidir.

---

# 4. Ejemplo

Un Case puede tener:

```text
Doctor
Dr. Juan Pérez

Hospital
Hospital San José

Customer
Distribuciones Médicas ABC

Payer
Aseguradora XYZ
```

Cada entidad responde una pregunta diferente.

---

# 5. Doctor

Doctor representa al profesional médico relacionado operacionalmente con Opportunities y Healthcare Cases.

Puede participar como:

```text
source of demand
decision influencer
procedure participant
commercial relationship
```

sin convertirse automáticamente en Customer.

---

# 6. Doctor no es Customer

Debe mantenerse:

```text
Doctor
≠
Customer
```

```text
Doctor
≠
User
≠
Technician identity
```

---

# 7. Razón

Un Doctor puede solicitar o preferir determinado producto sin:

```text
comprarlo directamente
recibir factura
realizar el pago
```

---

# 8. Ejemplo

```text
Doctor
→ solicita dispositivo

Hospital
→ realiza procedimiento

Insurance
→ paga

Customer
→ entidad con relación comercial
```

---

# 9. No crear Customer artificial

Incorrecto:

```text
Doctor Juan Pérez
↓
crear Customer "Juan Pérez"
```

únicamente porque el sistema necesita relacionarlo con un Case.

---

# 10. Doctor como Master Data Healthcare

Doctor debe comportarse conceptualmente como:

```text
Healthcare Master Data
```

reutilizable entre múltiples:

```text
Opportunities
Cases
Hospitals
Commercial interactions
```

---

# 11. Doctor no pertenece a un Case

El Doctor existe independientemente de un Case.

Debe evitarse:

```text
HealthcareCase
├── doctorName
├── doctorPhone
└── doctorEmail
```

como única representación.

---

# 12. Razón

Eso produciría:

```text
CASE-001
Dr. Juan Perez

CASE-002
Juan Pérez

CASE-003
Dr Juan P.
```

sin identidad común ni historial confiable.

---

# 13. Identidad del Doctor

Doctor V1 representa conceptualmente:

```text
Doctor
├── id
├── companyId
├── firstName
├── lastName
├── specialty
├── phone?
├── email?
├── notes?
├── active / inactive
├── createdAt
└── updatedAt
```

`firstName`, `lastName` y `specialty` son requeridos. Los demás datos de
contacto y operación son opcionales. No constituye schema Prisma aprobado.

---

# 14. UUID

Debe seguir ADR-004:

```text
HealthcareDoctor.id
→ UUID
```

---

# 15. Company ownership

La decisión V1 es:

```text
Doctor
→ Company-scoped Healthcare Master Data
```

`companyId` representa tenant ownership/context derivado de la Company
autenticada. Nunca se selecciona manualmente y no representa employer,
Hospital affiliation ni un campo empresarial visible.

---

# 16. Razón

Cada Company administra:

* sus relaciones comerciales;
* sus contactos;
* sus notas;
* sus Hospitals relacionados;
* su historial operativo.

---

# 17. Misma persona en varias Companies

Puede existir:

```text
Company A
→ Doctor Juan Pérez

Company B
→ Doctor Juan Pérez
```

como registros tenant-isolated independientes.

---

# 18. No identidad global en V1

V1 no construye un:

```text
Global Doctor Registry
```

compartido por todas las Companies.

---

# 19. Razón

Eso introduciría problemas innecesarios de:

```text
identity matching
privacy
data ownership
data synchronization
tenant boundaries
```

---

# 20. Doctor name

Debe almacenarse estructuradamente en la medida razonable.

---

# 21. Professional Name

Puede ser útil presentar:

```text
Dr. Juan Pérez
```

sin guardar obligatoriamente `"Dr."` como parte del nombre legal.

Puede derivarse para display; no añade un campo requerido a Doctor V1.

---

# 22. Specialty

`specialty` es requerido en Doctor V1 y aporta contexto operacional/comercial.

Ejemplos:

```text
Cardiología
Traumatología
Neurocirugía
Electrofisiología
```

---

# 23. Specialty no es diagnóstico

Especialidad profesional no representa información clínica de paciente.

---

# 24. Specialty V1 y catálogo futuro

V1 utiliza:

```text
normalized text / string
```

No utiliza Prisma enum. Un catálogo formal `MedicalSpecialty` permanece FUTURE.

---

# 25. No sobrearquitectar

No necesitamos inicialmente:

```text
MedicalSpecialty
MedicalSubspecialty
Certification
LicenseAuthority
ProfessionalAssociation
```

salvo necesidad real.

---

# 26. Professional License

Puede surgir en el futuro la necesidad de almacenar:

```text
professional license / cédula
```

para identificación.

No forma parte de Doctor V1 y no debe hacerse obligatorio sin requisito
operacional documentado.

---

# 27. Contact information

Puede ser útil:

```text
phone
email
```

para coordinación comercial.

---

# 28. Contact data minimization

Solo almacenar información necesaria para el negocio.

---

# 29. Personal phone

Si se almacena un teléfono personal/profesional, debe respetarse la política de seguridad y privacidad de Zaping.

---

# 30. Notes

Puede existir contexto como:

```text
Prefiere contacto por WhatsApp.
Normalmente trabaja por las mañanas.
```

si es operacionalmente relevante.

---

# 31. Notes no debe almacenar historia clínica

Nunca utilizar Doctor notes para registrar:

```text
patient diagnoses
clinical histories
medical observations about patients
```

Doctor V1 tampoco introduce por defecto:

```text
RFC
CURP
date of birth
private address
patient information
clinical information
mandatory professional license
```

---

# 32. Doctor Status

Doctor V1 utiliza lifecycle:

```text
active / inactive
```

siguiendo ADR-012.

---

# 33. Inactive Doctor

Un Doctor inactivo:

```text
→ remains historically referenced
```

pero puede dejar de aparecer por defecto en nuevos formularios.

---

# 34. No borrar historia

Si un Doctor tiene Cases históricos:

```text
→ do not hard delete
```

como comportamiento normal.

No existe normal hard delete en V1.

---

# 35. Doctor 360

Healthcare debería evolucionar hacia una vista Doctor 360.

---

# 36. Doctor 360 — Identity

Puede mostrar:

```text
Name
Specialty
Phone
Email
Status
```

---

# 37. Doctor 360 — Hospitals

```text
Hospitals
├── Hospital A
├── Hospital B
└── Hospital C
```

---

# 38. Doctor 360 — Opportunities

Debe poder mostrar oportunidades relacionadas.

---

# 39. Doctor 360 — Cases

También:

```text
Recent Cases
Upcoming Cases
Historical Cases
```

---

# 40. Doctor 360 — Commercial Context

Puede mostrar posteriormente:

```text
Quotes
Products of interest
Opportunity history
```

sin duplicar esos documentos.

---

# 41. Doctor preferences futuro

Puede existir una capacidad futura para preferencias operacionales.

Ejemplos:

```text
frequent Products
preferred KitTemplate
common Equipment
```

---

# 42. Preferencia no es instrucción clínica

Zaping puede recordar patrones logísticos/comerciales.

No debe producir recomendaciones médicas.

---

# 43. Doctor preferences no deben alterar automáticamente CaseKit

Puede sugerirse:

```text
Dr. X normally uses Product A
```

pero Warehouse/Technician debe confirmar la preparación real.

---

# 44. Hospital

Hospital representa el lugar u organización operacional donde puede realizarse un Healthcare Case.

---

# 45. Hospital como contexto operativo

Hospital puede aportar:

```text
name
location
contacts
access instructions
logistics requirements
schedule context
```

---

# 46. Hospital no es Customer

Debe mantenerse:

```text
Hospital
≠
Customer
```

```text
Hospital
≠
Company
```

---

# 47. Ejemplo

El procedimiento ocurre en:

```text
Hospital San José
```

pero la entidad que compra puede ser:

```text
Distribuidora ABC
```

---

# 48. Otro escenario

También puede ocurrir:

```text
Hospital San José
=
Customer Hospital San José
```

en una operación concreta.

Pero la relación debe ser explícita.

---

# 49. No equivalencia por nombre

Nunca asumir:

```text
Hospital.name == Customer.name
→ same business entity
```

---

# 50. Hospital como Master Data Healthcare

La decisión V1 es:

```text
Hospital
→ Company-scoped Healthcare Master Data
```

`companyId` tiene la misma semántica interna de tenant ownership/context que en
Doctor. Hospital no representa Company.

---

# 51. Hospital entity conceptual

Hospital V1 representa conceptualmente:

```text
Hospital
├── id
├── companyId
├── name
├── city
├── state
├── address?
├── phone?
├── email?
├── contactName?
├── notes?
├── active / inactive
├── createdAt
└── updatedAt
```

`name`, `city` y `state` son requeridos. Los demás datos de ubicación, contacto
y operación son opcionales. No constituye schema Prisma aprobado.

---

# 52. Hospital vs Facility

Existe una distinción importante entre:

```text
Hospital organization
```

y:

```text
physical facility / campus
```

---

# 53. Ejemplo

```text
Hospital ABC Group
├── Campus Norte
└── Campus Centro
```

---

# 54. Primera versión

Para evitar sobrearquitectura, `Hospital` puede representar inicialmente:

> **la unidad física/operacional donde ocurre el Case.**

---

# 55. Razón

Para Calendar y Logistics necesitamos responder:

```text
¿A dónde tiene que ir el Technician?
```

---

# 56. Future Organization/Facility split

Si aparecen grupos hospitalarios con múltiples sedes, podremos evolucionar hacia:

```text
HealthcareOrganization
↓
HealthcareFacility
```

---

# 57. No introducir todavía

No se necesita esta separación antes de demostrar que genera valor real.

---

# 58. Hospital address

La ubicación es especialmente relevante porque afecta:

```text
Calendar
Technician logistics
Equipment logistics
Dispatch
```

---

# 59. Dirección V1 y estructura futura

V1 conserva `address` como dato conceptual opcional y requiere `city` y
`state`. Una estructura posterior puede evaluar:

```text
street
externalNumber
internalNumber?
neighborhood?
city
state
postalCode
country
```

según la convención general de Zaping.

---

# 60. No guardar todo en una cadena si será utilizada operacionalmente

Un único:

```text
address = "..."
```

puede ser suficiente inicialmente, pero limita búsquedas y futuras integraciones.

La implementación y normalización exactas deberán alinearse con otros módulos;
este documento no aprueba persistencia de búsqueda o dirección.

---

# 61. Coordinates futuro

Podrían almacenarse:

```text
latitude
longitude
```

si posteriormente necesitamos:

```text
maps
routing
travel estimates
```

---

# 62. No requisito inicial

Calendar no necesita mapas para funcionar en primera versión.

---

# 63. Hospital contacts

Hospital V1 puede conservar como datos opcionales:

```text
phone
email
contactName
```

---

# 64. No asumir un único contacto

Ejemplo:

```text
Purchasing
Operating Room
Warehouse
Accounts Payable
Administration
```

---

# 65. Contact model futuro

Podría evolucionar hacia un modelo transversal:

```text
Contact
```

o relaciones específicas.

Un dominio `HospitalContact` permanece FUTURE.

---

# 66. Primera versión

Hospital V1 requiere:

```text
name
city
state
```

y permite `address`, `phone`, `email`, `contactName` y `notes` opcionales.

---

# 67. Hospital operational requirements

Algunos Hospitals pueden tener requisitos como:

```text
arrival instructions
access hours
required documents
receiving point
parking/loading instructions
```

---

# 68. Hospital Notes

Estos datos pueden almacenarse inicialmente como contexto operativo.

Ejemplos incluyen access instructions, material delivery location, technician
registration requirements y logistics constraints. No deben contener
información clínica o de pacientes innecesaria.

---

# 69. No confundir con Case notes

Debe distinguirse:

```text
Hospital instruction
→ reusable across Cases
```

de:

```text
Case-specific note
→ only this procedure
```

---

# 70. Ejemplo

Hospital:

```text
Entrar por acceso de proveedores.
```

Case:

```text
Para este procedimiento ingresar por quirófano 3.
```

---

# 71. Hospital Status

Hospital V1 utiliza lifecycle:

```text
active / inactive
```

es una estrategia razonable.

---

# 72. Hospital inactivo

Permanece disponible para historia.

No debería seleccionarse normalmente para nuevos Cases.

No existe normal hard delete en V1.

---

# 73. Hospital 360

Puede mostrar:

```text
Identity
Address
Contacts
Doctors
Upcoming Cases
Historical Cases
Operational Notes
```

---

# 74. Hospital 360 no es Customer 360

Aunque tengan una relación comercial:

```text
Hospital 360
→ operational Healthcare context
```

```text
Customer 360
→ commercial/fiscal context
```

---

# 75. Doctor ↔ Hospital

La relación natural es:

```text
many-to-many
```

---

# 76. Regla

Un Doctor puede trabajar en:

```text
multiple Hospitals
```

y un Hospital puede relacionarse con:

```text
multiple Doctors
```

Ambas entidades pueden existir sin affiliations. La relación es opcional en
ambos sentidos.

---

# 77. Anti-patrón crítico

No utilizar:

```text
Doctor.hospitalId
```

como única relación permanente.

---

# 78. Problema

Eso impediría representar:

```text
Dr. X
├── Hospital A
├── Hospital B
└── Hospital C
```

---

# 79. Relación explícita

Conceptualmente puede existir:

```text
DoctorHospitalAffiliation
```

---

# 80. Modelo conceptual

```text
DoctorHospitalAffiliation
├── Doctor
├── Hospital
├── active / inactive
├── notes?
├── createdAt
└── updatedAt
```

No duplica `Doctor.specialty` en V1. Los identificadores y nombres técnicos
permanecen deliberadamente pendientes.

---

# 81. Nombre no definitivo

`DoctorHospitalAffiliation` representa el concepto.

El nombre técnico final puede ser diferente.

---

# 82. No implica relación laboral formal

La palabra `Affiliation` significa:

> existe una relación operacional conocida entre Doctor y Hospital.

No necesariamente:

```text
employment contract
```

---

# 83. Razón

Un Doctor puede realizar procedimientos ocasionales en un Hospital sin ser empleado permanente.

---

# 84. Affiliation duplicate handling

Conceptualmente debería evitarse duplicar:

```text
Doctor X + Hospital A
Doctor X + Hospital A
Doctor X + Hospital A
```

sin necesidad.

---

# 85. Duplicate relationship handling

El dominio debe evitar relaciones activas duplicadas, pero este documento no
aprueba un unique constraint. La estrategia técnica se decidirá con Prisma y
concurrency behavior en un slice posterior.

---

# 86. Historical affiliation

Puede surgir necesidad de conocer:

```text
Doctor worked at Hospital A previously
```

---

# 87. Primera versión

V1 utiliza conceptualmente:

```text
active / inactive
```

en la relación.

---

# 88. Future effective dates

Posteriormente:

```text
effectiveFrom
effectiveTo
```

pueden aportar historial más preciso.

No son prioridad inicial.

---

# 89. Doctor affiliation no limita Case

Una regla importante:

> **La ausencia de una affiliation activa no debe bloquear por sí sola un Case.**

---

# 90. Ejemplo

Si el usuario selecciona:

```text
Dr. X
+
Hospital Nuevo
```

Zaping puede permitir el Case y ofrecer:

```text
Agregar Hospital a relaciones del Doctor
```

Esto puede generar un warning y una acción explícita. No debe crear affiliation
automáticamente ni como side effect invisible de guardar HealthcareCase.

---

# 91. No bloquear operación por Master Data incompleto

El sistema debe ayudar a mantener datos limpios sin dificultar innecesariamente una operación real.

---

# 92. Autocomplete

Al seleccionar Doctor en Case:

```text
Hospital selector
```

puede priorizar sus Hospitals relacionados.

---

# 93. No ocultar otros Hospitals

Debe ser posible seleccionar otro Hospital autorizado.

---

# 94. UX example

```text
Hospital

Frecuentes con Dr. X:
- Hospital A
- Hospital B

Otros Hospitals:
- Hospital C
- Hospital D
```

---

# 95. Doctor + Hospital history

Zaping podrá conocer:

```text
Dr. X
Hospital A
12 Cases

Dr. X
Hospital B
4 Cases
```

sin duplicar Doctors.

---

# 96. Opportunity relationship

Opportunity puede contener:

```text
doctorId?
hospitalId?
```

cuando se conozcan.

---

# 97. Opportunity Doctor without Hospital

Debe ser válido:

```text
Doctor ✓
Hospital pending
```

---

# 98. Opportunity Hospital without Doctor

También:

```text
Hospital ✓
Doctor pending
```

---

# 99. Opportunity enrichment

Al conocer ambos:

```text
Opportunity
↓
Doctor + Hospital
```

puede sugerirse registrar la relación si no existe.

---

# 100. Case relationship

HealthcareCase permanece como operational root. TARGET V1 puede vincular:

```text
HealthcareCase
├── doctorId? — optional primary Doctor
├── hospitalId? — optional procedure Hospital
└── responsibleUserId? — existing Company User
```

Los nombres son conceptuales y no aprueban fields Prisma o DTOs. Doctor y
Hospital son opcionales; multiple Doctors per HealthcareCase permanece FUTURE.

Un Case puede estar `SCHEDULED` sin Doctor y/o Hospital. Debe mantenerse:

```text
Case Status
≠
Case Readiness
```

---

# 101. Case relation remains historical

Si posteriormente el Doctor deja de trabajar en el Hospital:

```text
CASE-0145
```

debe continuar indicando que ocurrió allí.

La desactivación posterior de Doctor u Hospital tampoco elimina ni null la
relación histórica del Case.

---

# 102. Master Data changes

Desactivar una afiliación:

```text
Doctor X ↔ Hospital A
```

no debe eliminar ni modificar Cases históricos.

---

# 102A. Master identity y snapshots V1

Un master record no debe reutilizarse para representar otra entidad real.

Cambiar la misma identidad de:

```text
Hospital CIMA
→ Hospital San José
```

no es una corrección cuando son organizaciones distintas. Debe desactivarse el
registro anterior cuando corresponda y crearse una nueva entidad. Correcciones
simples de ortografía o contacto sí pueden actualizar la misma identidad.

V1 utiliza master-data references y no requiere:

```text
doctorNameSnapshot
hospitalNameSnapshot
```

Las correcciones simples se reflejan en display. Snapshots inmutables permanecen
FUTURE para documentos operacionales o legales confirmados —por ejemplo
Dispatch, signed records o PDFs— cuando el dominio dueño los justifique.

---

# 103. Case Doctor change

Antes del procedimiento puede ser necesario cambiar Doctor.

---

# 104. Audit

El cambio:

```text
Doctor A
↓
Doctor B
```

en un Case programado es candidato a Audit.

---

# 105. Case Hospital change

También puede ocurrir:

```text
Hospital A
↓
Hospital B
```

por reprogramación o cambio operacional.

---

# 106. Impact assessment

Cambiar Hospital puede afectar:

```text
schedule
travel
Equipment
CaseKit
warehouse instructions
```

Reschedule del mismo Case preserva Doctor y Hospital salvo que el usuario los
cambie explícitamente. Un cambio de schedule no crea por sí solo un nuevo Case.

---

# 107. Calendar

Hospital y Doctor son filtros naturales de Calendar.

---

# 108. Calendar card

Puede mostrar:

```text
Hospital ABC
Dr. Juan Pérez
```

como contexto principal.

---

# 109. Hospital conflict

No debemos asumir inicialmente que un Hospital tiene capacidad limitada modelada por Zaping.

---

# 110. No OR scheduling

Zaping no necesita administrar disponibilidad de quirófanos del Hospital salvo integración/requisito futuro.

---

# 111. Doctor conflict

Puede surgir la pregunta:

```text
same Doctor
+
overlapping Cases
```

---

# 112. Potential conflict

Conceptualmente también es una inconsistencia posible.

---

# 113. Primera prioridad de Calendar

Los conflictos inicialmente priorizados fueron:

```text
Technician
Equipment
```

---

# 114. Doctor overlap futuro

Puede agregarse como:

```text
warning
```

si la información de schedule es confiable.

---

# 115. Hospital requirements and readiness

Algunos requisitos hospitalarios pueden afectar readiness.

Ejemplo:

```text
required document missing
```

---

# 116. No implementar rule engine todavía

Primera versión puede mostrar notas/checklists operacionales.

---

# 117. Customer relationship

Hospital puede estar relacionado con un Customer.

---

# 118. Ejemplo simple

```text
Hospital ABC
↓
Customer
Hospital ABC, S.A. de C.V.
```

---

# 119. Pero no siempre 1:1

Puede existir:

```text
Hospital Group ABC
├── Hospital Norte
├── Hospital Centro
└── Hospital Sur
```

mientras:

```text
Customer
Grupo Hospitalario ABC S.A.
```

representa la relación comercial.

---

# 120. Por tanto

No deberíamos imponer:

```text
Hospital.customerId UNIQUE
```

sin analizar las cardinalidades reales.

---

# 121. Primera estrategia conceptual

Puede permitirse:

```text
Hospital
→ defaultCustomerId?
```

o una relación equivalente si aporta valor.

---

# 122. No aprobar todavía

La relación Hospital ↔ Customer debe validarse con casos reales antes del schema.

---

# 123. Case Customer

Incluso si Hospital tiene un Customer sugerido:

```text
Case.customerId
```

debe conservarse como decisión comercial del Case cuando corresponda.

---

# 124. Razón

El mismo Hospital puede producir operaciones facturadas a entidades distintas.

---

# 125. Ejemplo

Case 1:

```text
Hospital ABC
Customer:
Hospital ABC
```

Case 2:

```text
Hospital ABC
Customer:
Insurance Administrator XYZ
```

según estructura contractual real.

---

# 126. Payer relationship

Hospital tampoco determina automáticamente Payer.

---

# 127. Ejemplo

Mismo Hospital:

```text
Case A
Payer: Insurance A

Case B
Payer: Insurance B

Case C
Payer: Private
```

---

# 128. Payer model

El modelo completo de Payer/Billing pertenece a una etapa posterior.

---

# 129. No crear Payer como texto permanente

Aunque Foundation pueda comenzar con contexto simple, una futura operación financiera requerirá identidad estructurada.

---

# 130. Customer vs Payer

Se mantiene:

```text
Customer
→ commercial counterpart
```

```text
Payer
→ economic responsibility
```

---

# 131. Hospital vs Payer

```text
Hospital
→ operational place/organization
```

---

# 132. Doctor vs Payer

```text
Doctor
→ professional / demand context
```

---

# 133. Technician relationship

Technician puede mantener relaciones frecuentes con Doctors.

Ejemplo:

```text
Carlos
→ usually works with Dr. X
```

---

# 134. No modelar territory system todavía

No necesitamos introducir inmediatamente:

```text
DoctorOwner
SalesTerritory
AccountTeam
```

---

# 135. Opportunity Owner

La relación comercial puede deducirse inicialmente de Opportunities/Cases.

---

# 136. Future Doctor account ownership

Si la operación comercial lo requiere, podría existir:

```text
primaryCommercialOwner
```

o asignación equivalente.

No es prioridad Foundation.

---

# 137. Doctor deduplication

Crear Doctors duplicados destruiría historial.

---

# 138. Duplicate detection

Un probable duplicate de Doctor puede considerar:

```text
normalized firstName
+
normalized lastName
+
specialty
```

Debe advertir, permitir revisar el registro existente y permitir creación
deliberada cuando corresponda. No aprueba rigid uniqueness ni un database
constraint.

---

# 139. No auto-merge

Una coincidencia aproximada:

```text
Juan Pérez
```

no es evidencia suficiente para fusionar automáticamente registros.

---

# 140. Merge futuro

Puede ser necesario un workflow administrativo para unir duplicados.

No forma parte de primera versión.

---

# 141. Hospital deduplication

Un probable duplicate de Hospital puede considerar:

```text
normalized name
+
city
+
state
```

Debe advertir, permitir revisar el registro existente y permitir creación
deliberada cuando corresponda. No aprueba rigid uniqueness por Hospital name.

---

# 142. Similar names

Ejemplo:

```text
Hospital San José
Hospital San Jose
H. San José
```

pueden ser el mismo lugar.

---

# 143. No auto-merge Hospitals

Debe requerirse revisión humana.

---

# 144. Search

Doctor debe poder buscarse por:

```text
first name
last name
specialty
```

Search debe ser case-insensitive y preferiblemente accent-tolerant donde sea
técnicamente práctico. La implementación de persistencia/búsqueda permanece
pendiente.

---

# 145. Hospital Search

Por:

```text
name
city
state
```

con las mismas expectativas de case-insensitive y accent-tolerant search.

---

# 146. Global Search

Doctor y Hospital son candidatos para Global Search.

---

# 147. Search result context

Ejemplo:

```text
Dr. Juan Pérez
Doctor · Cardiología

Hospital ABC
Hospital · Hermosillo
```

---

# 148. Master Data lists

Doctors y Hospitals necesitan páginas de administración simples.

---

# 149. Doctors List

Conceptualmente:

```text
Doctor
Specialty
Hospitals
Upcoming Cases
Status
```

---

# 150. Hospitals List

Conceptualmente:

```text
Hospital
Location
Doctors
Upcoming Cases
Status
```

---

# 151. No llenar tablas de métricas

Las listas deben priorizar información útil para identificar y actuar.

---

# 152. Create Doctor UX

Primera captura debe ser rápida.

Doctor V1 debe requerir:

```text
firstName
lastName
specialty
```

como datos requeridos de V1, y después permitir enriquecer phone, email y notes.

---

# 153. Progressive Enrichment

Siguiendo Zaping Way:

```text
Create quickly
↓
Use in operation
↓
Enrich over time
```

---

# 154. Create Hospital UX

Hospital V1 debe requerir:

```text
name
city
state
```

con address, phone, email, contactName y notes opcionales.

---

# 155. Pero Case readiness

Si se requiere dirección para Logistics:

```text
Hospital missing address
```

puede convertirse en un readiness warning/blocker según Company policy.

---

# 156. Address optional

`address` no es requerido para crear Hospital V1. `city` y `state` sí son
requeridos como contexto mínimo de ubicación.

---

# 156A. HealthcareCase selector UX

Los selectors TARGET deben:

```text
show only active same-Company master data for new selection
be searchable
be clearable
preserve inactive historical values when viewing existing Cases
```

Quick creation puede ofrecerse como una acción explícita:

```text
+ Create Doctor
+ Create Hospital
```

Después de una creación explícita exitosa, la nueva entidad puede seleccionarse
en el Case. Nunca debe crearse master data como side effect invisible de guardar
HealthcareCase o escribir una etiqueta.

---

# 157. Importación

El futuro Import Module debería soportar:

```text
Doctors
Hospitals
Doctor-Hospital relationships
```

cuando Healthcare se implemente.

---

# 158. Excel migration

Es probable que empresas tengan esta información en:

```text
Excel
contacts lists
CRM
ERP notes
```

---

# 159. Import Doctor

Debe validar:

```text
Company
Name
Duplicate candidates
Contact format
```

---

# 160. Import Hospital

Debe validar:

```text
Company
Name
Address
Duplicate candidates
```

---

# 161. Relationship import

Debe evitar crear relaciones cross-tenant.

---

# 162. Multi-tenancy

Todo Doctor y Hospital de primera versión pertenece a una Company.

---

# 163. Invariante

```text
Doctor.companyId
=
authenticatedCompany
```

---

# 164. Hospital

```text
Hospital.companyId
=
authenticatedCompany
```

---

# 165. Affiliation

```text
Affiliation.company
=
Doctor.company
=
Hospital.company
```

---

# 166. Case

```text
Case.company
=
Doctor.company
=
Hospital.company
```

cuando esas relaciones estén presentes.

---

# 167. Cross-tenant

Debe rechazarse:

```text
Case Company A
→ Doctor Company B
```

---

# 168. API companyId

Frontend no debe decidir arbitrariamente tenant ownership.

---

# 169. Authorization — Doctors

Toda operación futura requiere autenticación, tenant isolation y autorización
server-side. Los permission names y la matriz RBAC se decidirán en el slice de
implementación; este documento no los aprueba.

---

# 170. Authorization — Hospitals

Aplica el mismo boundary server-side. Los permisos exactos permanecen
deliberadamente pendientes.

---

# 171. Relationship permissions

Link/unlink o activate/deactivate affiliation requiere autorización explícita.
La acción y su granularidad no se definen aquí.

---

# 172. Technician access

Technicians pueden necesitar leer:

```text
Doctors
Hospitals
```

asociados a sus Cases, sujeto a la futura matriz autorizada.

---

# 173. Commercial access

Los actores comerciales pueden necesitar administrar master data, sujeto a la
futura matriz autorizada.

---

# 174. Warehouse access

Warehouse puede necesitar leer contexto suficiente:

```text
Doctor
Hospital
Address
Operational Instructions
```

sin necesariamente modificar Master Data. Esto no aprueba todavía acceso por
rol.

---

# 175. Sensitive fields

Si posteriormente se agregan campos sensibles, permisos pueden necesitar mayor granularidad.

---

# 176. Audit

Eventos candidatos:

```text
doctor.created
doctor.updated
doctor.deactivated

hospital.created
hospital.updated
hospital.deactivated

doctor_hospital.linked
doctor_hospital.unlinked
```

---

# 177. Master Data updates

No toda corrección tipográfica necesita un Business Event complejo.

Pero cambios relevantes pueden quedar en Audit general.

---

# 178. Contact updates

La estrategia de Audit deberá equilibrar:

```text
traceability
vs
noise
```

---

# 179. API

Actualmente no existen endpoints Doctor/Hospital implementados. HealthcareCase
Foundation sí conserva su API CURRENT separada.

---

# 180. API conceptual Doctors

Capacidades futuras:

```text
List Doctors
Create Doctor
Read Doctor
Update Doctor
Deactivate Doctor
Read Doctor Cases
Read Doctor Hospitals
```

---

# 181. API conceptual Hospitals

```text
List Hospitals
Create Hospital
Read Hospital
Update Hospital
Deactivate Hospital
Read Hospital Cases
Read Hospital Doctors
```

---

# 182. Affiliation Actions

Podría existir:

```text
Link Doctor to Hospital
Unlink / deactivate relationship
```

---

# 183. REST exacto pendiente

No se definen rutas finales hasta diseño de API.

---

# 184. Performance

Doctor/Hospital lists deben filtrar por:

```text
companyId
```

y utilizar índices relevantes.

---

# 185. Many-to-many queries

Queries comunes:

```text
Hospitals for Doctor
Doctors for Hospital
```

deben ser eficientes.

---

# 186. Upcoming Cases

Doctor 360 y Hospital 360 pueden consultar Cases por:

```text
doctorId
hospitalId
scheduledStart
```

---

# 187. Historical index-design boundary

Durante la fase de domain design, índices, constraints, normalized keys,
collation y estrategia de búsqueda quedaron diferidos a Prisma/API design. Las
decisiones implementadas y su evidencia CURRENT están en
`DOCTORS_HOSPITALS_TECHNICAL_DESIGN.md`; este documento de dominio no las
redefine.

---

# 188. CURRENT

Actualmente:

```text
HealthcareCase Foundation
→ IMPLEMENTED / VALIDATED

EquipmentAsset / Equipment V1
→ IMPLEMENTED / VALIDATED in ERP Core

HC-NEXT-01
→ BACKEND VALIDATED THROUGH C5 / PRE-COMMIT
```

Backend CURRENT:

```text
Doctor
→ PERSISTENCE + API IMPLEMENTED

Hospital
→ PERSISTENCE + API IMPLEMENTED

Doctor-Hospital relationship
→ PERSISTENCE + API IMPLEMENTED

HealthcareCase Doctor/Hospital relationships
→ BACKEND INTEGRATION IMPLEMENTED

Frontend master-data workflows, Case selectors and duplicate-review UX
→ NOT IMPLEMENTED / FUTURE
```

---

# 189. TARGET V1 workflow

El backend C1-C5 ya soporta la base técnica de este flujo. C6-C8 deben completar
la experiencia frontend y acceptance:

```text
Create Doctor
↓
Create Hospital
↓
Link Doctor ↔ Hospital
↓
Use both in Case
↓
Search / Filter
↓
Duplicate warning / review
↓
View history
```

---

# 190. FUTURE enrichment

Después:

```text
Doctor 360
Hospital 360
Operational instructions
Import
Commercial insights
```

---

# 191. FUTURE

Posibles capacidades:

```text
Doctor preferences
Hospital requirements
Hospital contacts
organization/facility hierarchy
commercial ownership
territories
external integrations
maps
advanced analytics
AI relationship summaries
```

---

# 191A. Out of scope V1

Este slice no incluye:

```text
global Doctor directory
global Hospital directory
Patient model / PHI
Payer / Insurance
multiple Doctors per HealthcareCase
MedicalSpecialty catalog
HospitalContact domain
Procedure catalog
clinical record
Doctor employment management
hospital credentialing
detailed Doctor scheduling
Prisma implementation
API implementation
frontend implementation
```

---

# 192. AI futuro

Zaping AI puede ayudar a resumir:

```text
Dr. X has 8 Cases in the last 6 months,
mostly at Hospital A.
```

---

# 193. AI no inventa relationships

No debe inferir:

```text
Doctor works at Hospital A
```

únicamente porque existen señales ambiguas externas.

Debe basarse en datos Zaping o fuentes autorizadas.

---

# 194. Doctor analytics futuro

Puede resultar útil medir:

```text
Cases
Opportunities
Products frequently involved
Hospitals
```

---

# 195. No ranking clínico

Zaping no debe calificar:

```text
quality of Doctor
medical outcomes
clinical performance
```

a partir de datos comerciales.

---

# 196. Hospital analytics

Puede medir información operacional/comercial como:

```text
Cases
Preparation requirements
Return delays
Commercial volume
```

si existe base suficiente.

---

# 197. No evaluar calidad médica

Healthcare es ERP/logística/comercial.

No sistema de evaluación clínica hospitalaria.

---

# 198. Payer follow-up

El análisis de este documento confirma que Payer merece una frontera separada cuando Billing sea diseñada.

---

# 199. No bloquear Healthcare MVP

No necesitamos construir ahora un módulo completo:

```text
PAYERS.md
```

para poder implementar Doctors, Hospitals y Cases básicos.

---

# 200. Commercial Context inicial

Case puede mantener inicialmente:

```text
customerId?
payer context?
```

según el diseño aprobado posteriormente.

---

# 201. Decisión futura

Antes de Billing/CFDI deberá formalizarse:

```text
Customer
Payer
Insurer
Invoice recipient
```

porque pueden representar entidades diferentes.

---

# 202. Healthcare Organization future

Hospital puede ser el primer indicio de una abstracción más general:

```text
Organization
Facility
```

---

# 203. No generalizar prematuramente

No debemos crear una jerarquía universal de Organizations únicamente porque algún día podría utilizarse.

---

# 204. Regla

Primero resolver:

```text
Healthcare Hospital
```

de forma limpia.

Generalizar cuando exista un segundo caso real.

---

# 205. Core vs Healthcare

Doctor es claramente específico de Healthcare.

Hospital/Facility también pertenece inicialmente a Healthcare.

---

# 206. Customer sigue Core

No mover Customer dentro de Healthcare.

---

# 207. Payer boundary

Payer probablemente será una capacidad comercial/financial transversal con especialización Healthcare.

Se definirá posteriormente.

---

# 208. Invariantes principales

```text
Doctor
≠
Customer
```

```text
Doctor
≠
Hospital
```

```text
Hospital
≠
Customer
```

```text
Hospital
≠
Payer
```

```text
Customer
≠
Payer by definition
```

```text
Doctor
↔
Hospital
=
many-to-many
```

```text
Doctor
→ reusable Healthcare Master Data
```

```text
Hospital
→ reusable Healthcare Master Data
```

```text
Doctor
→ may exist without Hospital
```

```text
Hospital
→ may exist without Doctor
```

```text
Opportunity
→ may initially know only one of them
```

```text
Case historical relationships
→ remain even if Master Data later changes
```

```text
Inactive Doctor/Hospital
→ historical records remain
```

```text
Doctor/Hospital
→ Company-scoped master data in V1
```

```text
Cross-tenant relationships
→ forbidden
```

```text
Affiliation
≠
HealthcareCase
```

```text
HealthcareCase Doctor / Hospital
→ optional TARGET relationships
```

```text
Case Status
≠
Case Readiness
```

```text
new selection
→ active Doctor / Hospital only
```

```text
master-data deactivation
→ preserves historical Case relationships
```

---

# 209. Anti-patrones

## Doctor as Customer

Crear Customers artificiales para Doctors.

---

## Hospital as Customer by definition

Obligar a que todo Hospital tenga identidad comercial idéntica.

---

## One Hospital per Doctor

Utilizar:

```text
Doctor.hospitalId
```

como única relación.

---

## Doctor embedded in Case

Guardar solamente:

```text
doctorName
doctorPhone
```

dentro de cada Case.

---

## Hospital embedded in Case only

Guardar texto libre sin Master Data reutilizable.

---

## Global Doctor database prematurely

Compartir Doctors entre tenants en V1.

---

## Auto-merge by name

Fusionar dos personas únicamente porque tienen nombres similares.

---

## Rigid uniqueness by name

Bloquear Doctors u Hospitals legítimos mediante uniqueness rígida de nombre.

---

## Case creates affiliation silently

Crear affiliation como side effect invisible de seleccionar Doctor + Hospital
o guardar HealthcareCase.

---

## Master identity repurposing

Renombrar una identidad para convertirla en otra entidad real en lugar de
desactivar y crear el master data correcto.

---

## Hospital name matching Customer

Inferir relación comercial por coincidencia textual.

---

## Patient data in Doctor profile

Utilizar Doctor notes para guardar información clínica de pacientes.

---

## Doctor clinical scoring

Transformar métricas comerciales en evaluación médica.

---

## One giant HealthcareParty table

Introducir inmediatamente una abstracción universal para:

```text
Doctor
Hospital
Customer
Payer
Technician
```

aunque tengan reglas y responsabilidades diferentes.

---

# 210. Relación con Opportunities

Opportunity puede conocer:

```text
Doctor?
Hospital?
Customer?
```

progresivamente.

---

# 211. Relación con Cases

Case utiliza Doctor y Hospital como contexto operacional principal.

---

# 212. Relación con Calendar

Doctor y Hospital proporcionan contexto y filtros.

---

# 213. Relación con CaseKit

Doctor puede influir en requerimientos/preferencias futuras.

Hospital puede aportar requisitos operacionales.

---

# 214. Relación con Case Logistics

Hospital proporciona destino operacional.

Doctor proporciona contexto del Case.

Ninguno sustituye Custodian.

---

# 215. Relación con Customers

Customer sigue siendo la contraparte comercial del ERP Core.

---

# 216. Relación con Payer

Payer indica responsabilidad económica cuando corresponda.

---

# 217. Relación con Identity

Technician/User es un actor interno.

Doctor normalmente es una persona externa al tenant.

---

# 218. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-008 — Documentation First.
* ADR-009 — Modular Monolith.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 219. Documentos relacionados

```text
modules/healthcare/HEALTHCARE.md
modules/healthcare/OPPORTUNITIES.md
modules/healthcare/CASES.md
modules/healthcare/CASE_CALENDAR.md
modules/healthcare/CASE_KITS.md
modules/healthcare/CASE_LOGISTICS.md
modules/healthcare/EQUIPMENT.md

modules/erp/CUSTOMERS.md
modules/erp/COMPANIES.md
modules/erp/IDENTITY_ACCESS.md

product/ZAPING_WAY.md
engineering/SECURITY_PRINCIPLES.md
engineering/API_GUIDELINES.md
```

---

# 220. Fuente de verdad

```text
DOCTORS_HOSPITALS.md
→ canonical Doctor / Hospital V1 domain specification
→ Company-scoped ownership and tenant invariants
→ lifecycle, affiliation and HealthcareCase integration

OPPORTUNITIES.md
→ early commercial relationship

CASES.md
→ Doctor/Hospital in concrete operation

CASE_CALENDAR.md
→ temporal views and filters

CUSTOMERS.md
→ commercial counterpart

IDENTITY_ACCESS.md
→ internal Users / permissions

PROJECT_BOARD.md
→ implementation status

schema.prisma
→ CURRENT persistence only; no Doctor/Hospital models yet
```

---

# 221. Decisiones pendientes antes de Prisma

Antes de crear modelos como:

```text
HealthcareDoctor
HealthcareHospital
DoctorHospitalAffiliation
```

permanecen deliberadamente pendientes:

```text
Prisma model and field names
relation and onDelete behavior
exact affiliation persistence model
indexes and database constraints
normalization storage strategy
duplicate-detection implementation
search implementation and collation
API routes and DTO shapes
RBAC matrix and permission names
frontend routes and components
audit and concurrency behavior
immutable snapshots for confirmed operational/legal documents
```

Los datos conceptuales mínimos, Company-scoped ownership, cardinalidad N ↔ N,
lifecycle y Case integration ya están aprobados como dominio V1.

---

# 222. Dirección conceptual — no schema approval

La relación conceptual aprobada es:

```text
Company
│
├── Doctor
└── Hospital
```

```text
Doctor
N ↔ N
Hospital
```

Una entidad de affiliation es candidato técnico razonable. Este diagrama no
aprueba modelos, tablas o nombres Prisma.

---

# 223. Opportunity FUTURE

```text
HealthcareOpportunity
├── doctorId?
└── hospitalId?
```

conceptualmente.

---

# 224. Case

```text
HealthcareCase
├── doctorId? — optional primary Doctor
├── hospitalId? — optional procedure Hospital
└── responsibleUserId? — existing Company User
```

Son nombres conceptuales TARGET, no fields Prisma aprobados. Customer/Payer y
multiple Doctors per Case permanecen fuera de este slice.

---

# 225. Primera decisión crítica — resuelta para V1

Decisión de dominio:

> **¿Hospital representa inicialmente la sede física operacional donde ocurre un Case, aunque más adelante pueda existir una Organization que agrupe varias sedes?**

La decisión V1 es:

```text
YES
```

para mantener el MVP simple y operacionalmente útil.

---

# 226. Segunda decisión crítica — resuelta para V1

> **¿Doctor y Hospital deben pertenecer al tenant en lugar de formar parte de un directorio global?**

La decisión de dominio V1 es:

```text
YES
```

porque protege aislamiento, simplifica ownership y evita complejidad prematura.

Una identidad compartida con relación tenant-specific permanece FUTURE.

---

# 227. Tercera decisión crítica

> **¿La relación Doctor ↔ Hospital debe ser many-to-many?**

La respuesta de dominio es:

```text
YES
```

---

# 228. Cuarta decisión crítica

> **¿Debe Customer inferirse automáticamente desde Hospital?**

La respuesta es:

```text
NO
```

Puede existir una sugerencia/default futuro, pero la relación comercial debe permanecer explícita.

---

# 229. Quinta decisión crítica

> **¿Debe Payer inferirse desde Hospital o Doctor?**

La respuesta es:

```text
NO
```

Payer pertenece a otra dimensión de la operación.

---

# 230. Principio final

Zaping Healthcare debe ser capaz de representar una operación como:

```text
Dr. Juan Pérez
↓
works across
Hospital A
Hospital B
Hospital C

Case
↓
Dr. Juan Pérez
+
Hospital B
+
Technician Carlos
+
Customer X
+
Payer Y
```

sin convertir automáticamente:

```text
Doctor
into
Customer

Hospital
into
Customer

Hospital
into
Payer
```

ni limitar al Doctor a una sola institución.

> **Doctor define quién participa profesionalmente; Hospital define dónde ocurre la operación; Customer define con quién existe la relación comercial; Payer define quién asume económicamente el caso. Zaping debe conectar estas identidades sin confundirlas.**
