# Oportunidades Healthcare — Zaping

**Módulo:** Healthcare Opportunities
**Producto:** Zaping Healthcare
**Versión:** 1.0.0
**Estado:** Aprobado
**Estado de implementación:** DOMAIN DESIGN / NOT IMPLEMENTED
**Última actualización:** 2026-08-20
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Healthcare Opportunity representa una posibilidad comercial relacionada con una futura operación del sector salud.

Permite registrar una oportunidad antes de que exista suficiente certeza para crear:

```text
Healthcare Case
Quote
SalesOrder
```

Su objetivo es responder:

```text
¿Existe una oportunidad?
¿De dónde surgió?
¿Quién la está trabajando?
¿Con qué Doctor/Hospital se relaciona?
¿Qué sabemos hasta ahora?
¿Qué debería ocurrir después?
¿Terminó convirtiéndose en una operación real?
```

---

# 2. Principio fundamental

Una Opportunity representa:

```text
posibilidad
```

no:

```text
operación confirmada
```

Por tanto:

> **Opportunity permite registrar intención comercial sin obligar al sistema a fingir que ya existe una cirugía, venta, pedido o compromiso definitivo.**

---

# 3. Problema operativo

En la operación Healthcare real, el trabajo puede comenzar antes de contar con todos los datos necesarios.

Ejemplo:

```text
Doctor llama al Technician
↓
pregunta por material
↓
posible procedimiento
↓
todavía no existe fecha definitiva
↓
todavía no se conoce quién facturará
```

Sin Opportunity, el usuario tendría que:

```text
crear un Case incompleto
```

o:

```text
no registrar nada
```

Ambas opciones son deficientes.

---

# 4. Segundo origen común

También puede ocurrir:

```text
Technician
↓
visita / contacta Doctor
↓
presenta producto
↓
Doctor muestra interés
↓
posible procedimiento futuro
```

Aquí tampoco existe todavía necesariamente un Case.

---

# 5. Opportunity como etapa previa

Conceptualmente:

```text
Lead / Signal
↓
Opportunity
↓
qualification
↓
Case and/or Quote
```

No toda señal necesita convertirse en Opportunity.

No toda Opportunity necesita convertirse en Case.

---

# 6. Alcance

Healthcare Opportunities debe permitir representar inicialmente:

* origen de la oportunidad;
* Doctor relacionado cuando se conozca;
* Hospital relacionado cuando se conozca;
* Customer cuando se conozca;
* responsable comercial/Technician;
* información resumida;
* fecha estimada cuando exista;
* productos o interés general cuando resulte útil;
* estado;
* notas operativas;
* resultado;
* relaciones posteriores con Case y Quote.

---

# 7. Fuera del alcance

La primera versión no pretende convertirse en:

* CRM empresarial completo;
* marketing automation;
* email marketing;
* campañas;
* lead scoring avanzado;
* pipeline configurable arbitrariamente;
* call center;
* sistema de comisiones;
* pronóstico financiero sofisticado.

Estas capacidades solo deberían añadirse si existe una necesidad comercial demostrada.

---

# 8. Opportunity no es un CRM genérico

Healthcare Opportunity existe porque el proceso operativo Healthcare necesita una etapa previa al Case.

No porque Zaping necesite replicar inmediatamente:

```text
Salesforce
HubSpot
Dynamics CRM
```

---

# 9. Orígenes

Una oportunidad puede surgir de diferentes fuentes.

Conceptualmente:

```text
DOCTOR_REQUEST
TECHNICIAN_PROSPECTING
HOSPITAL_REQUEST
CUSTOMER_REQUEST
REFERRAL
EXISTING_RELATIONSHIP
OTHER
```

Los valores definitivos deberán diseñarse antes de Prisma.

---

# 10. Doctor Request

Ejemplo:

```text
Doctor
↓
contacta Technician
↓
necesita material para posible procedimiento
```

Debe poder registrarse incluso si todavía faltan:

* fecha;
* Hospital;
* Customer;
* Payer;
* productos definitivos.

---

# 11. Technician Prospecting

Ejemplo:

```text
Technician
↓
contacta Doctor
↓
presenta producto / solución
↓
detecta posible procedimiento
```

El sistema debe distinguir este origen de una solicitud directa.

---

# 12. Hospital Request

Una Opportunity también puede originarse directamente desde:

```text
Hospital
```

o personal de la organización.

Esto no convierte automáticamente al Hospital en Customer.

---

# 13. Customer Request

Un Customer existente puede originar una Opportunity.

En ese caso ya puede conocerse:

```text
Customer
```

aunque todavía no exista Case.

---

# 14. Referral

Puede existir una oportunidad originada por:

```text
Doctor A
↓
recomienda contacto con Doctor B
```

o mediante otra relación comercial.

No se necesita inicialmente un sistema avanzado de referrals.

---

# 15. Opportunity Source

Conviene mantener un concepto explícito de:

```text
source
```

porque posteriormente permitirá comprender:

```text
¿de dónde vienen las oportunidades?
```

sin depender exclusivamente de notas libres.

---

# 16. Source no es Owner

Debe distinguirse:

```text
source
→ cómo nació la oportunidad
```

de:

```text
owner / responsible
→ quién la está trabajando
```

---

# 17. Responsable

Toda Opportunity activa debería tener un responsable claro cuando sea operacionalmente posible.

Conceptualmente:

```text
Opportunity
↓
Responsible User / Technician
```

---

# 18. Technician como responsable

En empresas como la operación que originó este diseño, el técnico puede participar simultáneamente en:

```text
prospección
venta
coordinación
asistencia
```

Por eso puede ser el responsable natural de la Opportunity.

---

# 19. Responsible User vs Technician

No debe asumirse necesariamente:

```text
Opportunity.ownerId
=
Technician-specific table
```

La identidad y autorización del responsable debe diseñarse junto con el modelo Healthcare definitivo.

---

# 20. Opportunity y Doctor

Una Opportunity puede relacionarse con Doctor cuando se conozca.

Ejemplo:

```text
Opportunity OPP-001
Doctor
Dr. X
```

---

# 21. Doctor opcional al inicio

Debe ser posible registrar una Opportunity sin Doctor si el origen todavía no permite identificarlo.

Ejemplo:

```text
Hospital solicita información
↓
Doctor pendiente
```

---

# 22. Doctor no es Customer

Se mantiene la invariancia definida en `HEALTHCARE.md`:

```text
Doctor
≠
Customer
```

No debe crearse un Customer falso únicamente para poder registrar la Opportunity.

---

# 23. Opportunity y Hospital

Hospital puede conocerse desde el inicio o posteriormente.

Ejemplo:

```text
Doctor confirma interés
Hospital todavía pendiente
```

debe seguir siendo una Opportunity válida.

---

# 24. Hospital no es obligatorio al inicio

No debemos exigir:

```text
hospitalId NOT NULL
```

antes de conocer el workflow real.

---

# 25. Hospital no es Customer

También:

```text
Hospital
≠
Customer
```

La contraparte comercial puede definirse después.

---

# 26. Opportunity y Customer

Customer puede relacionarse cuando la contraparte comercial ya sea conocida.

Pero:

```text
Opportunity
```

no debe requerir Customer para existir.

---

# 27. Razón

En Healthcare puede conocerse primero:

```text
Doctor
+
Hospital
+
posible procedimiento
```

y determinar después:

```text
quién compra
```

---

# 28. Opportunity y Payer

Payer tampoco debe ser obligatorio durante las primeras etapas.

Puede conocerse mucho más tarde.

---

# 29. Opportunity no resuelve Billing

Registrar:

```text
payer = insurer
```

en el futuro no significa que Opportunity deba implementar:

* autorización de seguro;
* claims;
* invoice;
* payment;
* reimbursement.

---

# 30. Información mínima

La primera versión debería permitir crear una Opportunity con información mínima suficiente para que sea útil.

Conceptualmente:

```text
title / summary
source
responsible
notes or context
```

más las relaciones disponibles.

---

# 31. No exigir falsa precisión

Incorrecto:

```text
Doctor required
Hospital required
Customer required
Payer required
Procedure required
Exact date required
Products required
```

para registrar una señal comercial temprana.

---

# 32. Progressive Enrichment

La Opportunity debe seguir:

> **capturar poco al inicio y enriquecer conforme se conoce más información.**

---

# 33. Ejemplo

Inicio:

```text
Dr. X interesado en marcapasos
Hospital pendiente
Fecha pendiente
```

Posteriormente:

```text
Hospital ABC
12 septiembre
Procedure confirmed
Customer identified
```

---

# 34. Título

Puede existir un título legible.

Ejemplo:

```text
Posible procedimiento — Dr. X — Hospital ABC
```

No debe depender únicamente de UUID.

---

# 35. Folio

También puede resultar útil un folio empresarial:

```text
OPP-000001
```

La necesidad definitiva deberá evaluarse.

---

# 36. UUID

Si existe entidad persistida deberá seguir ADR-004:

```text
id
→ UUID técnico
```

---

# 37. Descripción / Notes

Opportunity necesita espacio para contexto comercial operativo.

Ejemplos:

```text
Doctor solicita disponibilidad para próxima semana.

Interesado en sistema X.

Pendiente confirmar Hospital y fecha.
```

---

# 38. Notes no reemplaza campos estructurados

No debe dependerse de:

```text
notes = "Dr. X, Hospital Y, 20/09, producto Z"
```

para toda consulta futura.

Cuando un dato sea importante para workflows, deberá estructurarse.

---

# 39. Fecha estimada

Puede ser útil conocer:

```text
expectedDate
```

o concepto equivalente cuando el procedimiento todavía no está confirmado.

---

# 40. Fecha estimada no es Case schedule

Debe distinguirse:

```text
Opportunity.expectedDate
→ estimación comercial
```

de:

```text
Case.scheduledStart
→ planificación operacional
```

---

# 41. Cambio de fecha

Modificar una fecha estimada de Opportunity no debe considerarse equivalente a reprogramar un Case confirmado.

---

# 42. Valor estimado

Puede surgir la necesidad de:

```text
estimatedValue
```

para priorización comercial.

No es requisito para la primera implementación.

---

# 43. Valor estimado no es Quote

Aunque exista:

```text
estimatedValue
```

debe mantenerse:

```text
Opportunity estimate
≠
Quote total
```

---

# 44. Productos de interés

Una Opportunity puede relacionarse conceptualmente con:

```text
Products
```

o categorías de interés.

---

# 45. No crear Order Items

Productos interesados no son:

```text
SalesOrderItem
```

ni:

```text
CaseKitItem
```

---

# 46. Cantidad tentativa

Si se permite registrar cantidades estimadas:

```text
estimated quantity
```

no deben interpretarse como:

* reservadas;
* comprometidas;
* vendidas;
* despachadas.

---

# 47. Inventory

Crear o modificar Opportunity:

```text
→ no InventoryMovement
```

---

# 48. No reservation

También:

```text
Opportunity
→ no reservation automática
```

---

# 49. No availability guarantee

Que un producto aparezca en una Opportunity no significa:

```text
stock guaranteed
```

---

# 50. Lifecycle conceptual

La primera versión puede necesitar estados equivalentes a:

```text
OPEN
↓
QUALIFIED
↓
CONVERTED
```

o:

```text
LOST
```

---

# 51. Enum todavía no aprobado

Los nombres anteriores son semántica funcional.

No deben copiarse directamente a Prisma antes de diseñar `OPPORTUNITIES` como feature.

---

# 52. OPEN

Representa una posibilidad activa todavía en evaluación.

---

# 53. QUALIFIED

Representa una Opportunity con suficiente evidencia para considerarla una oportunidad real.

Puede incluir:

* Doctor interesado;
* procedimiento probable;
* Hospital conocido;
* fecha aproximada;
* necesidad identificada.

No todos deben ser obligatorios.

---

# 54. CONVERTED

Representa que la Opportunity produjo una operación posterior relevante.

La conversión debe conservar una relación explícita.

---

# 55. LOST

Representa que la Opportunity dejó de ser viable.

Ejemplos:

```text
Doctor no interesado
Procedure cancelled
Competitor selected
No availability
Commercial conditions rejected
Other
```

---

# 56. Lost Reason

Puede resultar útil registrar:

```text
lostReason
```

o un catálogo futuro.

Inicialmente puede ser texto estructurado suficientemente simple.

---

# 57. No borrar oportunidades perdidas

Una Opportunity `LOST` aporta conocimiento comercial.

No debería eliminarse para hacer desaparecer el resultado.

---

# 58. Cancelled vs Lost

Puede existir una diferencia entre:

```text
LOST
→ oportunidad comercial no conseguida
```

y:

```text
CANCELLED
→ registro creado por error / operación retirada
```

La necesidad de ambos estados deberá evaluarse antes del schema.

---

# 59. Outcome

La Opportunity debería preservar el resultado.

Conceptualmente:

```text
Converted
Lost
Cancelled
```

cuando corresponda.

---

# 60. Opportunity → Case

Cuando existe suficiente certeza operacional:

```text
Opportunity
↓
Create Healthcare Case
```

---

# 61. Conversión a Case

La acción debe reutilizar información ya conocida.

Ejemplo:

```text
Opportunity
Doctor: Dr. X
Hospital: ABC
Expected date: Sep 12
Technician: Y
```

al crear Case:

```text
pre-fill
Doctor
Hospital
Technician
schedule
```

según corresponda.

---

# 62. No recapturar

El usuario no debería introducir nuevamente datos que Zaping ya conoce.

Esto sigue `ZAPING_WAY.md`.

---

# 63. Case creado no borra Opportunity

La relación debe conservarse:

```text
Opportunity
↓
Case
```

para poder responder:

```text
¿de dónde surgió este Case?
```

---

# 64. Opportunity → Quote

También puede existir:

```text
Opportunity
↓
Quote
```

si se requiere propuesta económica antes de confirmar el Case.

---

# 65. Quote no obliga a Case

Debe ser posible:

```text
Opportunity
↓
Quote
```

sin Case inmediato.

---

# 66. Case no obliga a Quote

También:

```text
Opportunity
↓
Case
```

sin Quote previa.

---

# 67. Flujo no lineal

Por tanto, Healthcare no debe forzar únicamente:

```text
Opportunity
↓
Quote
↓
Case
```

---

# 68. Ejemplos válidos

```text
Opportunity
↓
Case
```

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

según operación real.

---

# 69. Quote pertenece al ERP Core

Healthcare puede originar una Quote.

No debe crear un segundo modelo:

```text
HealthcareQuote
```

sin necesidad.

---

# 70. SalesOrder pertenece al ERP Core

Lo mismo aplica a:

```text
SalesOrder
```

---

# 71. Opportunity no es SalesOrder

Crear Opportunity nunca representa compromiso de venta.

---

# 72. Conversion semantics

Una Opportunity puede considerarse convertida cuando produzca un resultado acordado.

La primera versión probablemente debería utilizar:

```text
Case created
```

como conversión Healthcare principal.

---

# 73. Quote como conversión parcial

Crear una Quote puede ser progreso comercial, pero no necesariamente una conversión final.

---

# 74. Conversión medible

Mantener la relación permitirá posteriormente calcular:

```text
Opportunities
↓
Cases
```

sin depender de heurísticas.

---

# 75. Conversion Rate

En el futuro:

```text
Converted Opportunities
/
Qualified Opportunities
```

puede ser una métrica útil.

La definición exacta deberá establecer período y estados incluidos.

---

# 76. Una Opportunity y múltiples Cases

Puede ocurrir que una relación comercial inicial produzca más de un procedimiento.

No debemos asumir prematuramente:

```text
Opportunity
→ exactly one Case forever
```

---

# 77. Primera versión

Sin embargo, para mantener simplicidad, la primera implementación puede tratar la conversión principal como:

```text
Opportunity
→ initial Case
```

y permitir nuevas Opportunities para procedimientos posteriores cuando sean oportunidades distintas.

La cardinalidad definitiva se decidirá con los casos reales antes de Prisma.

---

# 78. Opportunity recurrente

No debe utilizarse una Opportunity indefinidamente abierta para representar:

```text
todas las futuras cirugías del Doctor
```

---

# 79. Relación comercial permanente

Una relación duradera con Doctor debe modelarse mediante la identidad/historial del Doctor, no manteniendo una Opportunity eterna.

---

# 80. Opportunity concreta

Preferir:

```text
Posible Case / necesidad identificable
```

sobre:

```text
Dr. X podría comprar algo algún día
```

---

# 81. Duplicate Opportunities

Debe existir UX para reducir duplicados.

Ejemplo:

```text
Doctor X
Hospital ABC
similar expected date
open Opportunity exists
```

puede generar advertencia.

---

# 82. No bloquear por heurística

Una coincidencia aproximada no debería impedir automáticamente crear una nueva Opportunity.

Puede haber dos procedimientos reales distintos.

---

# 83. Search

La UI debería permitir buscar Opportunities por:

```text
folio
Doctor
Hospital
Customer
responsible
```

cuando esos datos existan.

---

# 84. Filters

Filtros iniciales útiles:

```text
status
responsible
source
date
Doctor
Hospital
```

según implementación.

---

# 85. Opportunity List

Una lista debería priorizar contexto.

Ejemplo:

```text
Opportunity
Doctor
Hospital
Expected Date
Responsible
Status
Next Action
```

---

# 86. Next Action

Healthcare Opportunities se beneficia especialmente de registrar:

```text
qué falta hacer
```

---

# 87. Ejemplos

```text
Confirmar fecha
Contactar Doctor
Enviar Quote
Confirmar Hospital
Crear Case
```

---

# 88. No construir Task Manager completo

La primera versión puede manejar el siguiente paso mediante:

* estado;
* contexto;
* acción sugerida;

sin introducir un sistema universal de tareas.

---

# 89. Aging

En el futuro puede resultar útil mostrar cuánto tiempo lleva abierta una Opportunity.

---

# 90. Stale Opportunity

Una oportunidad sin actividad durante mucho tiempo puede requerir revisión.

No debe cerrarse automáticamente sin una política definida.

---

# 91. Activity

El historial puede mostrar eventos relevantes:

```text
Opportunity created
Doctor linked
Hospital linked
Quote created
Case created
Opportunity lost
```

---

# 92. Audit

Acciones candidatas:

```text
opportunity.created
opportunity.updated
opportunity.assigned
opportunity.converted
opportunity.lost
```

cuando Audit exista.

---

# 93. Notes vs Audit

Debe distinguirse:

```text
Opportunity notes
→ business context
```

de:

```text
Audit
→ evidence of system actions
```

---

# 94. Comments futuro

Si se necesita colaboración más compleja, puede existir un sistema de comentarios.

No se requiere para la Foundation.

---

# 95. Attachments futuro

También podrían adjuntarse:

* documentos;
* imágenes;
* requerimientos;
* información comercial.

Esto dependerá del futuro Document Management.

---

# 96. Datos clínicos

Attachments relacionados con Healthcare deben seguir las mismas restricciones de minimización clínica.

---

# 97. Multi-tenancy

Toda Opportunity debe pertenecer a una Company.

Conceptualmente:

```text
Opportunity.companyId
=
authenticated Company
```

si se utiliza ownership directo.

---

# 98. Relaciones tenant

Cuando exista relación con:

```text
Customer
Doctor
Hospital
User
Product
```

debe validarse que pertenezcan al contexto autorizado según el modelo definitivo.

---

# 99. companyId desde contexto

No debe confiarse en:

```text
companyId
```

enviado arbitrariamente por frontend.

---

# 100. Authorization

Permisos conceptuales futuros pueden incluir:

```text
healthcare.opportunities.read
healthcare.opportunities.create
healthcare.opportunities.update
healthcare.opportunities.assign
healthcare.opportunities.convert
healthcare.opportunities.close
```

---

# 101. Sales / Technician

Usuarios comerciales y Technicians pueden necesitar crear y actualizar Opportunities.

---

# 102. Manager

Puede necesitar:

* reasignar;
* revisar pipeline;
* cerrar;
* analizar resultados.

---

# 103. Warehouse

Warehouse normalmente no necesita administrar Opportunities.

Debe acceder al proceso cuando exista:

```text
Case
Preparation
```

---

# 104. Dashboard

Dashboard puede mostrar posteriormente:

```text
Open Opportunities
Opportunities requiring follow-up
Upcoming opportunities
```

cuando sea útil.

---

# 105. Healthcare Dashboard

Un Dashboard especializado puede mostrar información comercial Healthcare junto con Cases.

Debe evitar mezclar:

```text
Opportunity
```

con:

```text
confirmed Case
```

en un único contador ambiguo.

---

# 106. Pipeline

Una primera visualización futura podría ser:

```text
Open
Qualified
Converted
Lost
```

---

# 107. Kanban

Un Kanban puede resultar útil en el futuro.

No debe construirse como prioridad antes de validar el workflow real.

---

# 108. Calendar

Opportunity no debe aparecer automáticamente como Case confirmado en `Case Calendar`.

---

# 109. Opportunity Date

Una fecha estimada puede visualizarse en una agenda comercial futura, pero debe quedar claramente diferenciada.

---

# 110. Case Calendar

Solo Cases con planificación operacional pertenecen al Case Calendar principal.

---

# 111. Product availability

Opportunity puede consultar disponibilidad como contexto.

Ejemplo:

```text
Product A
Available: 4
```

pero no altera Inventory.

---

# 112. Availability is informational

La disponibilidad observada hoy no constituye garantía para un procedimiento futuro.

---

# 113. Quoting

Desde Opportunity puede existir una acción:

```text
[Crear cotización]
```

---

# 114. Case Creation

También:

```text
[Crear Case]
```

cuando la oportunidad esté suficientemente definida.

---

# 115. Conversion UX

Al convertir:

```text
Opportunity
↓
Case
```

Zaping debe mostrar claramente qué datos serán reutilizados y cuáles faltan.

---

# 116. Missing information

Ejemplo:

```text
Doctor       ✓
Hospital     ✓
Technician   ✓
Date         pendiente
Procedure    pendiente
```

---

# 117. No bloquear innecesariamente

Si Case permite completar determinados datos después, Opportunity conversion no debe exigir perfección prematura.

---

# 118. Pero proteger requisitos del Case

Opportunity tampoco puede utilizarse para saltarse las invariantes que `CASES.md` defina.

---

# 119. Cancellation

Si un procedimiento potencial simplemente desaparece:

```text
Opportunity LOST
```

puede ser más preciso que borrar el registro.

---

# 120. Duplicate created by mistake

Un registro creado accidentalmente puede requerir otra política.

Esto se definirá con ADR-012 antes de implementar lifecycle definitivo.

---

# 121. Soft Delete

No debe agregarse automáticamente:

```text
deletedAt
```

a Opportunity.

Su lifecycle debe diseñarse según su semántica.

---

# 122. Historical value

Opportunities convertidas o perdidas aportan información histórica comercial.

Por tanto, conservarlas suele ser más útil que eliminarlas.

---

# 123. Modelo conceptual

Una futura entidad podría requerir conceptos semejantes a:

```text
HealthcareOpportunity
├── id
├── companyId
├── folio?
├── title
├── source
├── status
├── responsibleUserId?
├── doctorId?
├── hospitalId?
├── customerId?
├── expectedDate?
├── notes?
├── convertedAt?
├── lostReason?
├── createdAt
└── updatedAt
```

---

# 124. No es schema aprobado

La estructura anterior es únicamente:

```text
DOMAIN CONCEPT
```

No debe copiarse todavía a `schema.prisma`.

---

# 125. Campos adicionales

Antes del diseño Prisma deberá evaluarse si realmente se requieren:

```text
payerId
procedureTypeId
estimatedValue
probability
nextAction
nextActionAt
```

---

# 126. Evitar CRM overengineering

No añadir inmediatamente:

```text
pipelineId
stageId
leadScore
forecastCategory
campaignId
territoryId
commissionPlan
```

sin un caso real.

---

# 127. API

No existen endpoints implementados.

Una futura API puede necesitar capacidades equivalentes a:

```text
list opportunities
create opportunity
read opportunity
update opportunity
qualify
convert
mark lost
```

---

# 128. Business Actions

Las transiciones importantes deben preferir acciones explícitas cuando aporten claridad.

Ejemplo conceptual:

```text
POST /healthcare/opportunities/:id/convert
```

en lugar de depender únicamente de un:

```text
PATCH status = CONVERTED
```

si la conversión produce relaciones adicionales.

---

# 129. Conversion transaction

Cuando crear Case y convertir Opportunity ocurra conjuntamente, deberá garantizarse consistencia.

No debe quedar:

```text
Opportunity CONVERTED
✓

Case creation
✗
```

---

# 130. Atomicity

Una opción futura:

```text
validate opportunity
+
create Case
+
link Opportunity
+
mark converted
```

dentro de una operación consistente.

---

# 131. Idempotencia

Reintentar una conversión no debe crear múltiples Cases accidentalmente.

---

# 132. Concurrent conversion

Dos usuarios tampoco deberían poder convertir la misma Opportunity simultáneamente creando duplicados.

---

# 133. Quote relationship

Si existe Quote vinculada, crear Case no debe duplicarla.

---

# 134. Case relationship

Si ya existe Case asociado, la UI debe mostrarlo claramente.

---

# 135. Opportunity 360

La vista de detalle debería responder:

```text
¿Qué oportunidad es?
¿Quién la originó?
¿Quién la trabaja?
¿Con qué Doctor?
¿En qué Hospital?
¿Qué sabemos?
¿Qué falta?
¿Qué documentos produjo?
¿Se convirtió?
```

---

# 136. Estructura UX conceptual

```text
Header
├── Status
├── Responsible
└── Primary Action

Context
├── Source
├── Doctor
├── Hospital
├── Customer
└── Expected Date

Commercial
├── Products / Interest
└── Quote

Progress
├── Next Action
└── Activity

Conversion
└── Healthcare Case
```

---

# 137. Acción primaria por estado

Ejemplos conceptuales:

```text
OPEN
→ Calificar
```

```text
QUALIFIED
→ Crear Case
```

```text
CONVERTED
→ Ver Case
```

```text
LOST
→ Ver historial
```

---

# 138. Responsive

La experiencia debe ser usable por Technicians que pueden trabajar desde laptop o dispositivo móvil.

---

# 139. Mobile future

Opportunity es una capacidad candidata para la futura aplicación móvil comercial.

---

# 140. Notifications futuro

Posibles alertas:

```text
Follow-up due
Expected date approaching
Opportunity without responsible
Qualified opportunity without Case
```

---

# 141. Métricas futuras

Cuando exista suficiente volumen:

```text
Open Opportunities
Conversion Rate
Average Time to Conversion
Opportunities by Source
Opportunities by Technician
Opportunities by Doctor
Lost Reasons
```

---

# 142. Opportunity by Doctor

Puede ayudar a identificar relaciones comerciales activas.

Debe evitarse interpretar automáticamente volumen como calidad o éxito.

---

# 143. Opportunity by Source

Puede responder:

```text
¿qué genera más oportunidades?
```

---

# 144. Lost Reasons

Puede ayudar a detectar:

* disponibilidad;
* precio;
* competencia;
* cancelaciones;
* seguimiento deficiente.

---

# 145. No inferir causalidad

Ejemplo:

```text
Lost reason = price
```

no demuestra por sí solo que Zaping deba bajar precios.

Las métricas deben proporcionar información, no conclusiones automáticas.

---

# 146. AI futuro

Zaping AI podría ayudar posteriormente a:

* resumir oportunidades;
* detectar falta de seguimiento;
* sugerir próximos pasos;
* identificar patrones.

---

# 147. AI no cambia estados automáticamente

Una recomendación de IA no debe marcar una Opportunity como:

```text
LOST
CONVERTED
```

sin una acción autorizada.

---

# 148. Radar futuro

Zaping Radar puede convertirse en otra fuente de Opportunities.

Conceptualmente:

```text
Radar Opportunity
↓
ERP / Healthcare Opportunity
```

cuando corresponda.

---

# 149. No acoplar ahora

Healthcare Opportunity no debe depender de Radar para funcionar.

---

# 150. Importación futura

Puede existir importación de Opportunities desde fuentes externas.

Debe seguir tenant isolation y validación.

---

# 151. CURRENT

Actualmente:

```text
Healthcare Opportunity
→ documented domain concept
```

No existe evidencia de:

```text
Prisma model
backend
API
frontend
tests
```

implementados.

---

# 152. TARGET inicial

La primera versión debería resolver:

```text
Create Opportunity
↓
Assign responsible
↓
Add known context
↓
Qualify
↓
Create Case and/or Quote
↓
Close as Converted or Lost
```

---

# 153. FUTURE

Posibles evoluciones:

```text
pipeline analytics
advanced activities
commercial reminders
attachments
mobile workflows
Radar integration
AI assistance
forecasting
```

---

# 154. Invariantes

```text
Opportunity
≠
Healthcare Case
```

```text
Opportunity
≠
Quote
```

```text
Opportunity
≠
SalesOrder
```

```text
Opportunity
→ no Inventory movement
```

```text
Opportunity
→ no automatic stock reservation
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
Customer
→ optional until commercially known
```

```text
Expected Date
≠
confirmed Case schedule
```

```text
Estimated Value
≠
Quote total
```

```text
Converted Opportunity
→ historical record remains
```

```text
Cross-tenant relationships
→ forbidden
```

---

# 155. Anti-patrones

## Crear Case demasiado pronto

Utilizar Case únicamente porque no existe un lugar donde guardar una posibilidad.

---

## Opportunity como CRM gigante

Agregar infraestructura comercial compleja antes de validar necesidades.

---

## Customer obligatorio

Forzar contraparte fiscal antes de conocerla.

---

## Doctor = Customer

Crear Customers artificiales para representar Doctors.

---

## Hospital = Customer

Crear Customers artificiales para representar Hospitals.

---

## Inventory reservation

Bloquear stock por una oportunidad todavía incierta.

---

## Quote automática

Crear cotización al registrar cualquier Opportunity aunque aún no exista información suficiente.

---

## Opportunity eterna

Mantener una Opportunity abierta indefinidamente para todas las futuras operaciones de un Doctor.

---

## Hard Delete de historia

Eliminar oportunidades perdidas para limpiar el pipeline.

---

## Notes as Database

Guardar toda la estructura en texto libre e impedir filtros/relaciones confiables.

---

## Artificial probability

Obligar al usuario a introducir:

```text
67 % probability
```

sin que exista un proceso comercial que haga útil esa cifra.

---

# 156. Relación con Healthcare Case

Opportunity responde:

```text
¿podría ocurrir?
```

Case responde:

```text
¿qué operación estamos coordinando?
```

---

# 157. Relación con Quotes

Opportunity puede originar una propuesta económica.

Quotes continúa siendo propietario de esa propuesta.

---

# 158. Relación con Sales

Opportunity no produce fulfillment ni Inventory OUT.

---

# 159. Relación con Doctors

Doctor puede ser uno de los principales generadores de oportunidad y contexto.

Su modelo se definirá antes de Prisma Healthcare.

---

# 160. Relación con Hospitals

Hospital proporciona contexto organizacional/logístico cuando se conoce.

---

# 161. Relación con Customers

Customer proporciona contexto comercial cuando se conoce.

No es un requisito para la existencia inicial de Opportunity.

---

# 162. Relación con Inventory

Opportunity puede consultar disponibilidad.

No modifica Inventory.

---

# 163. Relación con Calendar

Una Opportunity con fecha estimada no es todavía un evento operativo confirmado del Case Calendar.

---

# 164. Relación con Audit

Las transiciones comerciales importantes podrán producir Audit Events cuando el módulo Audit exista.

---

# 165. Relación con Zaping Way

Opportunity debe seguir:

```text
Capture quickly
↓
Enrich progressively
↓
Show missing context
↓
Offer next action
```

---

# 166. ADR relacionados

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

# 167. Documentos relacionados

```text
modules/healthcare/HEALTHCARE.md
modules/healthcare/CASES.md

modules/erp/CUSTOMERS.md
modules/erp/PRODUCTS.md
modules/erp/QUOTES.md
modules/erp/SALES.md
modules/erp/INVENTORY.md

product/ZAPING_WAY.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
```

---

# 168. Fuente de verdad

```text
OPPORTUNITIES.md
→ comportamiento de Healthcare Opportunity

HEALTHCARE.md
→ frontera general de la vertical

CASES.md
→ comportamiento de Healthcare Case

QUOTES.md
→ propuesta comercial

SALES.md
→ compromiso y fulfillment comercial

PROJECT_BOARD.md
→ estado de implementación

schema.prisma
→ modelo técnico cuando sea diseñado
```

---

# 169. Regla para el diseño Prisma

Antes de crear:

```text
model HealthcareOpportunity
```

deberán resolverse como mínimo:

```text
lifecycle definitivo
minimum required fields
Doctor ownership/model
Hospital ownership/model
responsible User relationship
Opportunity → Case cardinality
Opportunity → Quote relationship
folio strategy
```

---

# 170. Principio final

Healthcare Opportunity existe para capturar el espacio entre:

```text
“hay una posibilidad”
```

y:

```text
“ya tenemos una operación que coordinar”
```

El flujo correcto es:

```text
Signal
↓
Opportunity
↓
More certainty
↓
Case / Quote
```

sin producir antes de tiempo:

```text
Inventory movement
Stock reservation
Sale
Delivery
Invoice
```

> **La Opportunity debe permitir empezar con información incompleta sin convertir esa incertidumbre en datos empresariales falsamente definitivos.**
