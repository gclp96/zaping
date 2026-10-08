# Case Kits — Zaping Healthcare

**Módulo:** Healthcare Case Kits
**Producto:** Zaping Healthcare
**Versión:** 2.4.0
**Estado:** Aprobado
**Estado de implementación:** HC-OPS-01A COMPLETE / MERGED — PR #50 — main@bb530e8 — Actual 27-sep-2026; HC-OPS-01A.1 COMPLETE / MERGED — PR #53 — main@54a5d79 — Actual 28-sep-2026; HC-OPS-01B COMPLETE / VALIDATED / READY FOR FINAL REVIEW — UNCOMMITTED — DoD PASS — DoR COMPLETE
**Última actualización:** 2026-10-07
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Case Kits administra la definición y preparación de materiales y Equipment necesarios para atender un Healthcare Case.

Representa digitalmente el proceso operativo de:

```text
Healthcare Case
↓
Requirements
↓
Warehouse Preparation
↓
Physical Staging
↓
CaseDispatch
---

# 2. Principio fundamental

Debe mantenerse:

```text
KitTemplate
≠
CaseKit
≠
CaseDispatch
```

Donde:

```text
KitTemplate
→ configuración reusable
```

```text
CaseKit
→ preparación específica de un Case
```

```text
CaseDispatch
→ transferencia física de custodia
```

---

# 3. El concepto de “maletín”

En operación cotidiana puede utilizarse el término:

```text
maletín
```

para describir el conjunto de:

* productos;
* implantes;
* consumibles;
* material de apoyo;
* instrumental;
* Equipment;

preparado para un procedimiento.

Zaping puede utilizar `CaseKit` como concepto funcional interno sin perder el lenguaje empresarial de la UI.

---

# 4. Lenguaje de usuario

La interfaz puede mostrar:

```text
Maletín del Case
Preparación
Material preparado
```

aunque la entidad técnica futura se denomine:

```text
CaseKit
```

---

# 5. CaseKit no es necesariamente un contenedor físico

Un CaseKit representa conceptualmente:

> **el conjunto lógico preparado para atender el Case.**

No debe asumirse que siempre corresponde exactamente a:

```text
1 CaseKit
=
1 maleta física
```

---

# 6. Ejemplo

Un Case puede requerir:

```text
Maletín 1
→ consumibles

Caja 2
→ instrumental

Equipment
→ monitor
```

y seguir perteneciendo a la misma preparación lógica.

---

# 7. Contenedores físicos futuros

Si posteriormente existe necesidad de identificar cada maletín/caja individualmente mediante:

```text
QR
barcode
seal
container number
```

podrá introducirse un concepto como:

```text
CaseKitContainer
```

o equivalente.

No se requiere para la Foundation.

---

# 8. Alcance

Case Kits debe permitir conceptualmente:

* definir requerimientos;
* reutilizar plantillas;
* preparar un Case específico;
* modificar cantidades antes del despacho;
* seleccionar Products;
* seleccionar lotes cuando corresponda;
* seleccionar seriales cuando corresponda;
* asignar Equipment;
* registrar faltantes;
* registrar sustituciones;
* distinguir requerido vs preparado;
* calcular readiness;
* conocer quién preparó;
* conocer cuándo quedó preparado;
* permitir revisión antes de Dispatch.

---

# 9. Fuera del alcance

CaseKit no es responsable de:

* vender productos;
* facturar;
* registrar Customer Return;
* confirmar consumo;
* producir automáticamente Inventory OUT comercial;
* administrar mantenimiento de Equipment;
* gobernar SalesOrder;
* sustituir Inventory;
* sustituir Case Logistics.

---

# 10. Flujo general

```text
Healthcare Case
↓
Requirements
↓
Apply KitTemplate optional
↓
CaseKit
↓
Preparation
↓
Prepared
↓
CaseDispatch
```

---

# 11. KitTemplate

`KitTemplate` representa una configuración reusable de materiales y recursos típicamente utilizados para un tipo de procedimiento.

---

# 12. Ejemplo

```text
KitTemplate
Marcapasos estándar

├── Product A × 1
├── Product B × 2
├── Product C × 4
├── Support Material D × 1
└── Equipment E × 1
```

---

# 13. KitTemplate no representa stock

Debe cumplirse:

```text
KitTemplate quantity
≠
inventory quantity
```

---

# 14. KitTemplate no reserva

Crear o modificar un KitTemplate:

```text
→ no reserva stock
→ no crea InventoryMovement
→ no asigna Equipment real
```

---

# 15. KitTemplate como receta

Conceptualmente:

```text
KitTemplate
=
recipe / preparation guide
```

---

# 16. Template y Procedure

Un `ProcedureType` futuro puede recomendar:

```text
default KitTemplate
```

---

# 17. Relación no obligatoria

No todo Case necesita originarse desde KitTemplate.

Debe ser válido:

```text
Case
↓
Create CaseKit manually
```

---

# 18. Razón

En Healthcare existen procedimientos:

* especiales;
* urgentes;
* poco frecuentes;
* personalizados por Doctor;

donde una plantilla puede no representar correctamente lo requerido.

---

# 19. Template opcional

Debe ser posible:

```text
Case
↓
Select KitTemplate
↓
Generate CaseKit starting point
```

---

# 20. Aplicar Template no crea dependencia viva

Regla importante:

> **Una vez creado el CaseKit, los cambios posteriores al KitTemplate no deben modificar silenciosamente el CaseKit existente.**

---

# 21. Ejemplo

Hoy:

```text
Template
Product A × 2
```

se crea:

```text
CASE-001
CaseKit
Product A × 2
```

Mañana alguien cambia Template:

```text
Product A × 3
```

El CaseKit de `CASE-001` no debe cambiar automáticamente.

---

# 22. Razón

El CaseKit representa una decisión operacional concreta tomada en un momento específico.

---

# 23. Template versioning futuro

Si el historial de plantillas se vuelve importante, podrá evaluarse:

```text
Template Version
```

No es necesario inicialmente.

---

# 24. Template activo/inactivo

Como configuración reusable, KitTemplate puede requerir lifecycle tipo Master Data.

Conceptualmente:

```text
ACTIVE
INACTIVE
```

o `isActive`.

La decisión final se tomará al diseñar schema.

---

# 25. No borrar Template usado

Un KitTemplate históricamente utilizado no debería eliminarse si eso destruye contexto útil.

---

# 26. Template Item

Cada entrada conceptual de una plantilla puede contener:

```text
Product
default quantity
required / optional
notes
```

y posteriormente reglas adicionales.

---

# 27. Required vs Optional

Una plantilla puede diferenciar:

```text
REQUIRED
```

de:

```text
OPTIONAL
```

---

# 28. Ejemplo

```text
Product A × 1
Required

Product B × 2
Optional / backup
```

---

# 29. Readiness

Los items opcionales no deben necesariamente impedir que el CaseKit esté completo.

---

# 30. Product Alternatives futuro

Puede ser útil permitir:

```text
Product A
OR
Product B
```

como alternativas equivalentes.

Pero debe diseñarse con cuidado.

---

# 31. No asumir equivalencia médica

Zaping no debe decidir automáticamente que dos productos son clínicamente intercambiables.

---

# 32. Regla

Una sustitución debe provenir de una regla empresarial/configuración autorizada o decisión humana.

No de una inferencia arbitraria del sistema.

---

# 33. CaseKit

`CaseKit` representa la preparación real y específica asociada a un Healthcare Case.

---

# 34. Relación

Conceptualmente:

```text
Healthcare Case
↓
CaseKit
```

---

# 35. Cardinalidad inicial

Una primera implementación puede utilizar:

```text
1 Case
→ 1 logical CaseKit
```

si cubre correctamente la operación.

---

# 36. No confundir con contenedores

Ese CaseKit puede representar varios contenedores físicos.

---

# 37. Evolución

Si posteriormente se demuestra que existen preparaciones independientes con lifecycle propio, podrá revisarse la cardinalidad.

---

# 38. CaseKit sin Template

Debe permitirse:

```text
CaseKit.templateId = null
```

conceptualmente.

---

# 39. Información conceptual

Un CaseKit puede necesitar:

```text
id
companyId
caseId
templateId?
status
notes
preparedBy?
preparedAt?
reviewedBy?
reviewedAt?
items
equipment assignments
createdAt
updatedAt
```

La estructura exacta no está aprobada como Prisma.

---

# 40. CaseKit Status

La preparación necesita distinguir su progreso.

Para HC-OPS-01B la semántica aprobada es:

```text
DRAFT
↓
PREPARED
```

`IN_PREPARATION` no se incorpora. Posibles estados posteriores como:

```text
CANCELLED
```

si se requiere.

---

# 41. Llevar a Prisma sólo estados aprobados

HC-OPS-01B añade exclusivamente `PREPARED` al enum vigente. Otros estados
conceptuales requieren contrato propio.

---

# 42. DRAFT

Representa requerimientos todavía modificables.

---

# 43. IN_PREPARATION

Permanece como concepto futuro y no se implementa en HC-OPS-01B.

---

# 44. PREPARED

Representa que la preparación requerida ha sido completada y validada conforme a las reglas vigentes.

---

# 45. PREPARED no significa Dispatch

Debe mantenerse:

```text
CaseKit PREPARED
↓
material preparado
```

no:

```text
material entregado al Technician
```

---

# 46. PREPARED no significa Inventory OUT

También:

```text
CaseKit PREPARED
→ no commercial Inventory OUT
```

---

# 47. Readiness vs CaseKit Status

Debe distinguirse:

```text
CaseKit status
→ progreso de preparación
```

de:

```text
Case readiness
→ preparación integral del Case
```

---

# 48. Ejemplo

```text
CaseKit PREPARED
```

pero:

```text
Equipment unavailable
```

puede resultar en:

```text
Case NOT READY
```

---

# 49. Requested Quantity

Debe existir conceptualmente una cantidad que represente:

```text
qué se necesita / solicitó
```

---

# 50. Prepared Quantity

También:

```text
qué se preparó realmente
```

---

# 51. Diferencia

```text
requestedQuantity
≠
preparedQuantity
```

---

# 52. Ejemplo

```text
Product A
Requested: 5
Prepared: 4
Missing: 1
```

---

# 53. Missing Quantity

Conceptualmente:

```text
Missing
=
Required
-
Prepared
```

cuando no existan sustituciones u otras reglas.

---

# 54. No usar un único `quantity`

Un solo campo:

```text
quantity = 5
```

puede resultar ambiguo.

¿Significa:

```text
requested?
prepared?
dispatched?
used?
returned?
```

Estas cantidades representan hechos distintos.

---

# 55. Separación de cantidades

Healthcare debe preservar:

```text
Required / Requested
↓
Prepared
↓
Dispatched
↓
Used
Returned
Unresolved
```

---

# 56. CaseKit gobierna hasta Prepared

CaseKit es propietario principalmente de:

```text
required / requested
prepared
```

---

# 57. Case Logistics gobierna Dispatch

`CASE_LOGISTICS.md` será propietario de:

```text
dispatched
returned
used
unresolved
```

---

# 58. Requested by Technician

El requerimiento puede originarse desde Technician o proceso operativo.

---

# 59. Warehouse prepares

Warehouse determina qué stock físico puede asignarse a la preparación siguiendo reglas autorizadas.

---

# 60. No permitir preparación negativa

Debe cumplirse:

```text
requestedQuantity > 0
```

cuando exista un requerimiento.

Y:

```text
preparedQuantity >= 0
```

---

# 61. Over-preparation

Puede existir una situación válida donde:

```text
Prepared > Requested
```

por material backup.

---

# 62. No bloquear universalmente

Ejemplo:

```text
Requested: 2
Prepared: 3
```

puede ser intencional.

---

# 63. Razón

En Healthcare puede prepararse material adicional por contingencia.

---

# 64. Debe quedar explícito

Si se permite over-preparation, la UI debe mostrar la diferencia claramente.

---

# 65. Extra / Backup

Una futura propiedad puede identificar:

```text
BACKUP
```

o:

```text
EXTRA
```

sin necesitar duplicar Products.

---

# 66. Required vs Backup

Ejemplo:

```text
Product A
Required 1

Product A
Backup 1
```

o una representación consolidada equivalente.

---

# 67. Modelo definitivo pendiente

Debe evitarse sobrecomplicar la primera versión antes de revisar casos reales de preparación.

---

# 68. Material de apoyo

El documento físico actual contempla:

```text
material de apoyo
```

---

# 69. Dos posibilidades

Material de apoyo puede ser:

```text
Product tracked in Inventory
```

o:

```text
descripción operacional sin control de stock
```

dependiendo de lo que realmente represente.

---

# 70. Preferencia

Si el material posee existencia, costo o trazabilidad relevante:

```text
→ Product
```

es preferible.

---

# 71. No inventar Products artificiales

Si algo es únicamente una instrucción:

```text
llevar documentación
llevar adaptador externo
```

puede pertenecer a checklist/notas, no necesariamente al catálogo Product.

---

# 72. Product

CaseKit debe reutilizar:

```text
ERP Product
```

---

# 73. No HealthcareProduct duplicado

No crear:

```text
HealthcareProduct
```

como segundo catálogo general.

---

# 74. Product snapshot

Debe evaluarse si el CaseKit necesita conservar datos históricos como:

```text
product name
SKU
```

en snapshots documentales.

La fuente funcional continúa siendo Product + relaciones históricas adecuadas.

---

# 75. Category / Brand

Puede mostrarse como contexto.

No necesariamente necesita duplicarse dentro de CaseKitItem.

---

# 76. Inventory availability

Durante preparación, Warehouse necesita consultar:

```text
available inventory
```

---

# 77. Available no es total Company-owned

Con custodia futura:

```text
Company-owned
≠
Warehouse available
```

---

# 78. Ejemplo

```text
Product A

Company-owned: 20
Warehouse available: 12
Technician custody: 8
```

CaseKit solo debería seleccionar cantidades físicamente preparables.

---

# 79. Limitación del modelo actual

Mientras Inventory todavía no represente completamente:

```text
location
reservation
custody
```

Zaping no puede garantizar toda disponibilidad Healthcare únicamente mediante `Product.stock`.

---

# 80. Regla documental

Este documento identifica la necesidad.

No ordena todavía rediseñar Inventory.

---

# 81. Lots

Cuando Product requiere tracking por lote, Preparation debe poder seleccionar:

```text
InventoryBatch
```

---

# 82. Por qué seleccionar lote durante preparación

Warehouse necesita saber exactamente:

```text
qué unidad/lote
```

está colocando en el maletín.

---

# 83. Ejemplo

```text
Product A
Required: 5

Prepared:
Lot L001 × 3
Lot L002 × 2
```

---

# 84. Lot allocation conceptual

Puede existir conceptualmente:

```text
CaseKitItem
↓
Batch Allocations
```

---

# 85. No aprobar nombre técnico todavía

No se define aún un modelo Prisma como:

```text
CaseKitItemBatchAllocation
```

aunque el concepto de asignación sea necesario.

---

# 86. Batch validity

Solo deben seleccionarse lotes:

* de la misma Company;
* del mismo Product;
* con cantidad disponible;
* no bloqueados;
* no vencidos para uso cuando aplique.

---

# 87. Expired lots

Un lote vencido:

```text
physically exists
```

pero normalmente:

```text
not eligible for preparation
```

---

# 88. FEFO

Cuando FEFO esté implementado, Preparation puede sugerir:

```text
First Expired
First Out
```

---

# 89. FEFO como sugerencia / política

La UX puede recomendar lotes apropiados.

La obligatoriedad dependerá de reglas empresariales.

---

# 90. User override futuro

Si se permite elegir otro lote, podría requerirse:

```text
reason
```

en determinados escenarios.

No es requisito Foundation.

---

# 91. Expiration visibility

Warehouse debe poder ver:

```text
lot
expiration date
available quantity
```

al preparar.

---

# 92. Lot selection no es Dispatch todavía

Seleccionar:

```text
L001 × 3
```

en CaseKit no significa que ya salió físicamente.

---

# 93. Reservation question

Aquí aparece una frontera importante:

```text
seleccionar stock para preparación
```

puede necesitar impedir que otro workflow use el mismo stock.

---

# 94. CURRENT

Zaping no tiene todavía un sistema formal de Reservations documentado como implementado.

---

# 95. Regla inicial

Por tanto:

> **CaseKit preparation no debe presentarse todavía como una reserva de inventario garantizada.**

---

# 96. Consecuencia

Mientras no exista Reservation, puede ocurrir:

```text
CaseKit A selects Batch L001 × 3
CaseKit B also sees Batch L001 available
```

si no se construye otra protección.

---

# 97. Riesgo

Esto debe resolverse antes de considerar Healthcare production-ready.

---

# 98. Opciones futuras

Podrá diseñarse:

```text
Inventory Reservation
```

o:

```text
Prepared / Staging location
```

según la evolución del modelo físico.

---

# 99. Reservation futura

Conceptualmente:

```text
Physical stock
↓
Reserved for Case
↓
Unavailable for other commitments
```

---

# 100. Reservation no es Inventory OUT

Debe mantenerse:

```text
Reserved
≠
OUT
```

---

# 101. Staging futuro

Otra representación posible:

```text
Warehouse shelf
↓
Case staging area
```

como cambio interno de ubicación.

---

# 102. No decidir aquí

Reservation/Location pertenece a una decisión transversal de Inventory.

No debe resolverse únicamente dentro de CaseKit.

---

# 103. Serials

Cuando Product requiera serial tracking, Preparation debe seleccionar unidades físicas específicas.

---

# 104. Ejemplo

```text
Product X
Required: 2

Prepared:
SN-001
SN-002
```

---

# 105. Serial uniqueness

La misma unidad serializada no puede prepararse simultáneamente para dos Cases incompatibles.

---

# 106. Serial tracking TARGET

Esta capacidad depende del futuro modelo de unidades serializadas de Inventory.

---

# 107. Equipment

CaseKit también puede incluir requerimientos de Equipment.

---

# 108. Equipment no es CaseKit Product normal

Debe mantenerse:

```text
EquipmentAsset
≠
Product quantity item
```

---

# 109. Ejemplo

```text
CaseKit

Consumables
├── Product A × 2
└── Product B × 4

Equipment
├── EQ-001
└── EQ-003
```

---

# 110. Equipment Requirement

Un Template puede indicar:

```text
1 unit of Equipment model X
```

---

# 111. Equipment Assignment

El CaseKit real debe resolverlo posteriormente a una unidad física:

```text
EquipmentAsset EQ-041
```

---

# 112. Requirement vs Assignment

Debe distinguirse:

```text
Need
→ 1 monitor model X
```

de:

```text
Assigned
→ EQ-041 / SN-99102
```

---

# 113. Calendar conflict

Equipment Assignment alimentará:

```text
Case Calendar conflict detection
```

---

# 114. Equipment unavailable

Puede generar:

```text
Case readiness
→ BLOCKED / NOT READY
```

según regla.

---

# 115. Substitutions

Warehouse puede encontrar que el Product solicitado no está disponible.

---

# 116. Ejemplo

```text
Requested:
Product A × 1

Available:
0
```

Puede existir una alternativa aprobada:

```text
Product B × 1
```

---

# 117. Sustitución debe quedar trazada

No debe cambiarse silenciosamente:

```text
Product A
→ Product B
```

sin conservar lo solicitado originalmente cuando esa información sea relevante.

---

# 118. Conceptos

Puede ser necesario distinguir:

```text
requestedProduct
```

de:

```text
preparedProduct
```

en casos de sustitución.

---

# 119. No decidir equivalencias automáticamente

Zaping puede mostrar alternativas previamente configuradas.

No debe afirmar equivalencia clínica por sí solo.

---

# 120. Authorization de sustitución

Puede requerir aprobación por:

```text
Technician
Manager
authorized user
```

dependiendo de la empresa.

---

# 121. Primera versión

La primera versión puede resolver sustitución mediante una acción explícita con:

```text
replacement Product
reason
actor
```

sin un catálogo avanzado.

---

# 122. Shortage

Cuando no puede prepararse todo lo requerido:

```text
shortage
```

debe ser visible.

---

# 123. Ejemplo

```text
Product A
Required: 5
Prepared: 3
Missing: 2
```

---

# 124. Shortage no debe ocultarse

No marcar:

```text
PREPARED
```

si faltan items obligatorios sin una excepción autorizada.

---

# 125. Partial Preparation

Puede existir conceptualmente:

```text
PARTIALLY_PREPARED
```

aunque no necesariamente como status persistido.

---

# 126. Preferencia

Puede ser más útil derivarlo:

```text
required items prepared / required items total
```

que mantener muchos estados manuales.

---

# 127. Preparation completeness

Conceptualmente:

```text
All mandatory requirements satisfied
=
Material Preparation Complete
```

---

# 128. Case readiness

Pero:

```text
Material Preparation Complete
≠
Case READY
```

si falta:

* Technician;
* Hospital;
* Equipment;
* otra condición operacional.

---

# 129. Prepared By

Debe registrarse quién realizó/completó la preparación cuando corresponda.

---

# 130. preparedBy

La identidad debe provenir de:

```text
Authenticated User
```

no de texto libre.

---

# 131. preparedAt

También debe conservarse el momento en que la preparación se confirmó.

---

# 132. Review / Double Check

En Healthcare puede ser valioso que otra persona revise el maletín.

Conceptualmente:

```text
Prepared By
↓
Reviewed By
```

---

# 133. No imponer desde Foundation

La doble revisión puede ser:

```text
Company policy
```

y no requisito universal.

---

# 134. Review future

Puede introducir:

```text
reviewedBy
reviewedAt
```

o evento equivalente cuando exista necesidad.

---

# 135. Preparation Confirmation

Una acción explícita:

```text
Confirm Preparation
```

puede validar:

```text
mandatory items
quantities
lots
serials
equipment
shortages
permissions
```

---

# 136. No usar PATCH status sin lógica

Evitar:

```text
PATCH CaseKit
status = PREPARED
```

sin validar contenido.

---

# 137. Atomicidad

Confirmar Preparation debe ser consistente con cualquier asignación/reserva que finalmente se implemente.

---

# 138. Caso sin Reservation

Si Preparation no modifica Inventory técnicamente, la confirmación puede principalmente:

* validar;
* congelar configuración;
* registrar actor;
* registrar timestamp.

---

# 139. Mutabilidad

Antes de Dispatch:

```text
CaseKit
→ editable under lifecycle rules
```

---

# 140. Después de Dispatch

Una vez que el material fue despachado, no debe poder reescribirse el CaseKit para fingir que otra cosa salió.

---

# 141. Regla

> **Preparation puede corregirse antes de que genere consecuencias físicas; después del Dispatch, las diferencias deben registrarse mediante nuevos eventos.**

---

# 142. Ejemplo incorrecto

Dispatch histórico:

```text
Product A × 5
```

Después alguien edita CaseKit:

```text
Product A × 3
```

y hace desaparecer dos unidades de la historia.

---

# 143. Dispatch snapshot

CaseDispatch debe conservar exactamente:

```text
what physically left
```

independientemente de cambios posteriores permitidos en preparación.

---

# 144. Additional Material

Durante el procedimiento puede solicitarse material adicional.

---

# 145. Flujo

```text
CaseKit initial
↓
Initial Dispatch
↓
Additional requirement
↓
Additional preparation
↓
Additional Dispatch
```

---

# 146. No reescribir Initial Dispatch

El material adicional debe producir una nueva operación logística.

---

# 147. CaseKit update

Puede ser válido agregar el nuevo requerimiento al CaseKit como contexto, pero el historial de Dispatch permanece independiente.

---

# 148. Multiple preparation rounds

El modelo debe tolerar conceptualmente:

```text
Preparation 1
Dispatch 1

Preparation 2
Dispatch 2
```

sin asumir que todo se resuelve una sola vez.

---

# 149. Reopen Preparation

Podría existir una acción:

```text
Reopen / Add Material
```

antes o después del primer Dispatch según lifecycle final.

---

# 150. No diseñar workflow excesivo todavía

La primera implementación puede permitir editar/agregar items bajo reglas simples, mientras Dispatch preserve los hechos físicos.

---

# 151. Removal before Dispatch

Si un item ya preparado deja de ser necesario y todavía no salió:

```text
remove / reduce
```

puede ser válido.

---

# 152. Removal after Dispatch

Si ya salió:

```text
→ CaseReturn / Reconciliation
```

no edición retroactiva.

---

# 153. Preparation Notes

CaseKit puede contener notas como:

```text
Llevar respaldo adicional.
Doctor solicita tamaño específico.
Verificar cable antes de salida.
```

---

# 154. Notes no sustituyen Items

Los requerimientos cuantificables deben permanecer estructurados.

---

# 155. Checklist

Además de productos, puede existir un checklist operacional.

Ejemplo:

```text
✓ Material principal
✓ Instrumental
✓ Equipment
○ Documentación
○ Accesorio externo
```

---

# 156. Checklist futuro

Puede resultar útil, pero no debe mezclarse artificialmente con Inventory Items.

---

# 157. Documents

Documentos requeridos pueden formar parte de Readiness, pero pertenecen a futura capacidad Document Management.

---

# 158. Preparation Workspace

La UX debe estar orientada a tarea.

---

# 159. Ejemplo

```text
CASE-0145
Hospital ABC
08:00 mañana

MATERIAL

Product A
Required 2
Prepared 2
Lot L001
✓

Product B
Required 4
Prepared 3
Missing 1
!

EQUIPMENT

EQ-041
Assigned
✓
```

---

# 160. Resumen superior

Debe responder rápidamente:

```text
Required items: 6
Prepared: 5
Missing: 1

Equipment:
1 / 1 assigned

Overall:
NOT READY
```

---

# 161. Acción principal

Ejemplos:

```text
[Iniciar preparación]
```

```text
[Confirmar preparación]
```

```text
[Resolver faltantes]
```

según contexto.

---

# 162. Product Selector

CaseKit debe reutilizar patrones/componentes del ERP cuando sea adecuado.

No necesita crear una biblioteca visual Healthcare paralela.

---

# 163. Batch Selector

Healthcare probablemente necesitará un Business Component futuro para selección de lote.

---

# 164. Requisitos de Batch Selector

Debe mostrar:

```text
lot
expiration
available quantity
```

y quizás:

```text
FEFO recommendation
```

---

# 165. Serial Selector futuro

Debe permitir seleccionar unidades físicas disponibles.

---

# 166. Equipment Selector

Debe mostrar:

```text
assetCode
serial
status
availability
possible schedule conflict
```

---

# 167. Warehouse workflow

Desde Warehouse Operations:

```text
Cases to Prepare
↓
CASE-0145
↓
Open CaseKit
```

---

# 168. Calendar integration

Desde Case Calendar:

```text
Case NOT READY
↓
[Preparar]
↓
CaseKit
```

---

# 169. Case 360 integration

Case 360 muestra:

```text
Preparation
CaseKit
Equipment
Readiness
```

---

# 170. Readiness contribution

CaseKit debe aportar una evaluación como:

```text
MATERIAL_READY
```

o información equivalente al Readiness global.

---

# 171. Readiness debe ser explicable

No solo:

```text
false
```

sino:

```text
Missing Product B × 1
```

---

# 172. Readiness no necesariamente persistido

Puede calcularse a partir de:

```text
requirements
prepared quantities
equipment assignments
blocking issues
```

---

# 173. Performance

Si el cálculo se vuelve costoso, podrá utilizarse un Read Model.

No debemos persistir estados derivados prematuramente.

---

# 174. Cancellation

Si Case se cancela antes de Dispatch:

```text
prepared resources
```

deben liberarse de cualquier Reservation/assignment futuro.

---

# 175. Sin Reservation actual

En Foundation, la cancelación no implica InventoryMovement.

---

# 176. Equipment assignment

Si Equipment ya había sido asignado al Case, debe liberarse correctamente.

---

# 177. Cancel after Dispatch

Si existe material bajo custodia:

```text
Case cancellation
≠
CaseKit deletion
```

---

# 178. Regla

Debe ejecutarse Case Logistics para resolver lo que salió.

---

# 179. Audit

Acciones candidatas:

```text
caseKit.created
caseKit.template_applied
caseKit.item_added
caseKit.item_removed
caseKit.substitution_registered
caseKit.preparation_started
caseKit.prepared
caseKit.reopened
```

según la cobertura futura.

---

# 180. No auditar cada click

Audit debe capturar acciones empresariales relevantes, no ruido de interfaz.

---

# 181. Multi-tenancy

Todo CaseKit pertenece al mismo Company context del Case.

---

# 182. Invariante

```text
CaseKit.company
=
Case.company
```

---

# 183. Product tenant

También:

```text
CaseKit Product
→ same Company
```

---

# 184. Batch tenant

```text
InventoryBatch
→ same Company
→ same Product
```

---

# 185. Equipment tenant

```text
EquipmentAsset
→ same Company
```

---

# 186. Template tenant

KitTemplates probablemente deberán ser configuraciones de una Company.

---

# 187. No global template by default

Un Template creado por Company A no debe aparecer automáticamente en Company B.

---

# 188. Platform Templates futuro

Si Zaping distribuye templates recomendados globales, eso requerirá una distinción explícita entre:

```text
platform template
```

y:

```text
company template
```

---

# 189. Authorization

Permisos conceptuales:

```text
healthcare.casekits.read
healthcare.casekits.create
healthcare.casekits.update
healthcare.casekits.prepare
healthcare.casekits.confirm

healthcare.kittemplates.read
healthcare.kittemplates.manage
```

---

# 190. Warehouse

Warehouse es candidato principal para:

```text
prepare
confirm
```

---

# 191. Technician

Technician puede necesitar:

```text
request requirements
review prepared kit
```

sin necesariamente modificar Inventory selections.

---

# 192. Manager

Puede resolver:

* shortages;
* substitutions;
* exceptional preparation.

---

# 193. Backend authority

Frontend no decide unilateralmente:

```text
PREPARED
```

Backend debe validar reglas.

---

# 194. Concurrencia

Dos usuarios podrían preparar el mismo CaseKit al mismo tiempo.

---

# 195. Riesgo

Puede ocurrir:

```text
User A selects Batch L001
User B selects Batch L002
```

o modificaciones perdidas.

---

# 196. Estrategia futura

Debe evaluarse:

```text
optimistic concurrency
version
updatedAt
locking
```

según experiencia real.

---

# 197. Stock concurrency

El problema es más crítico cuando Reservation exista.

---

# 198. Inventory transaction

Una futura reserva/asignación de stock deberá ser transaccional para impedir:

```text
available 5

Case A reserves 5
Case B reserves 5
```

simultáneamente.

---

# 199. Idempotencia

Confirmar preparación repetidamente no debe duplicar:

* reservations;
* allocations;
* Audit Events críticos;

si esas capacidades existen.

---

# 200. API

No existen endpoints Healthcare implementados.

---

# 201. API conceptual

Futuras capacidades:

```text
Create CaseKit
Apply KitTemplate
Add/Update/Remove requirement
Start Preparation
Assign Batch
Assign Serial
Assign Equipment
Register Substitution
Confirm Preparation
```

---

# 202. KitTemplate API conceptual

```text
List Templates
Create Template
Update Template
Deactivate Template
Apply Template
```

---

# 203. Acciones de negocio

Preferir operaciones explícitas cuando produzcan invariantes.

Ejemplo:

```text
Confirm Preparation
```

en lugar de:

```text
PATCH status
```

---

# 204. No endpoint por cada click

Tampoco convertir toda interacción UI en endpoint especial si un update normal seguro es suficiente.

---

# 205. CURRENT

Actualmente:

```text
KitTemplate
CaseKit
Preparation
→ documented domain design
```

No existe evidencia de:

```text
Prisma models
backend
API
frontend
reservation
batch allocation Healthcare
```

implementados.

---

# 206. TARGET inicial

La primera versión debería cubrir:

```text
Case
↓
Create CaseKit
↓
Add requirements
↓
Optional Template
↓
Prepare Products
↓
Select Batches when required
↓
Assign Equipment
↓
Expose shortages
↓
Confirm Preparation
↓
Feed Case Readiness
```

---

# 207. TARGET posterior

Después:

```text
Reservations
Serial tracking
Preparation review
Multiple containers
QR
Substitution rules
Advanced staging
```

---

# 208. FUTURE

Capacidades posibles:

```text
Template versions
Doctor-preference templates
Procedure-specific kits
Automatic FEFO suggestions
QR container scanning
Mobile preparation
Electronic checklist
Preparation analytics
Predictive preparation
AI suggestions
```

---

# 209. Doctor preference

En el futuro puede existir una preferencia como:

```text
Doctor X
usually uses Product A
```

---

# 210. No mezclar con Template global

Una preferencia de Doctor puede modificar/sugerir CaseKit.

No debería cambiar silenciosamente el KitTemplate general.

---

# 211. AI futuro

AI podría sugerir:

```text
Para este procedimiento y Doctor normalmente se preparan:
Product A × 2
Product B × 3
```

---

# 212. AI no prepara físicamente

La recomendación no sustituye validación de Warehouse.

---

# 213. Metrics futuro

CaseKit puede permitir medir:

```text
Preparation time
Cases with shortages
Most used templates
Substitutions
Unused prepared material
```

---

# 214. Unused prepared material

Debe distinguirse:

```text
prepared
```

de:

```text
dispatched
```

y posteriormente:

```text
used
```

---

# 215. No inferir desperdicio

Que un Product se prepare y no se use no significa automáticamente:

```text
waste
```

Puede haber sido backup necesario.

---

# 216. Invariantes principales

```text
KitTemplate
≠
CaseKit
```

```text
CaseKit
≠
CaseDispatch
```

```text
KitTemplate
→ no Inventory movement
```

```text
CaseKit preparation
→ no commercial Inventory OUT
```

```text
CaseKit PREPARED
≠
material dispatched
```

```text
Required Quantity
≠
Prepared Quantity
```

```text
Prepared Quantity
≠
Dispatched Quantity
```

```text
Dispatched Quantity
≠
Used Quantity
```

```text
CaseKit
→ may exist without KitTemplate
```

```text
Template change
→ does not silently rewrite existing CaseKit
```

```text
Product
→ reuse ERP Product catalog
```

```text
Batch selected
→ belongs to same Product and Company
```

```text
Equipment requirement
≠
EquipmentAsset assignment
```

```text
CaseKit material complete
≠
Case globally READY
```

```text
Preparation
≠
guaranteed Reservation until reservation exists
```

```text
After Dispatch
→ historical physical facts cannot be rewritten through CaseKit edits
```

---

# 217. Anti-patrones

## Template = physical kit

Tratar una plantilla como existencia física.

---

## CaseKit = Inventory OUT

Descontar stock definitivamente al preparar.

---

## One quantity for everything

Usar una misma cantidad para requerido, preparado, despachado y utilizado.

---

## Template live mutation

Cambiar un Template y modificar todos los Cases históricos.

---

## Invisible substitution

Sustituir Product A por Product B sin registro.

---

## Guess clinical equivalence

Hacer sustituciones automáticas por similitud de catálogo.

---

## Batch without validation

Asignar un lote de otro Product o Company.

---

## Expired batch preparation

Preparar lote vencido como material utilizable normal.

---

## Fake reservation

Mostrar material como “apartado” cuando Inventory todavía no garantiza esa reserva.

---

## Equipment as quantity

Preparar:

```text
Monitor × 1
```

sin identificar qué EquipmentAsset real se asignó cuando se requiere identidad física.

---

## Edit history after Dispatch

Modificar CaseKit para hacer coincidir retrospectivamente una salida.

---

## Giant JSON Kit

Guardar:

```text
CaseKit JSON
```

con toda la operación sin relaciones ni validaciones.

---

## Notes as requirements

Escribir todos los productos necesarios dentro de notas libres.

---

# 218. Relación con Healthcare Case

Case define:

```text
qué operación
```

CaseKit define:

```text
qué preparar
```

---

# 219. Relación con Case Calendar

CaseKit aporta Material Readiness.

Calendar lo presenta en contexto temporal.

---

# 220. Relación con Case Logistics

Case Logistics toma la preparación como base para registrar:

```text
what physically left
```

pero Dispatch conserva su propia verdad histórica.

---

# 221. Relación con Equipment

CaseKit expresa requerimiento/asignación de Equipment.

`EQUIPMENT.md` gobierna la identidad y disponibilidad del activo.

---

# 222. Relación con Inventory

Inventory proporciona:

```text
Products
Batches
Availability
future reservations
```

CaseKit coordina preparación.

---

# 223. Relación con Purchases

Una falta de material puede originar posteriormente acciones de reabastecimiento.

CaseKit no debe crear automáticamente Purchases sin workflow explícito.

---

# 224. Relación con Dashboard

Dashboard puede mostrar:

```text
Cases requiring preparation
CaseKits incomplete
Cases with shortage
```

---

# 225. Relación con Zaping Way

La UX debe seguir:

```text
Requirements
↓
Availability
↓
Preparation
↓
Missing items
↓
Next action
```

---

# 226. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 227. Documentos relacionados

```text
modules/healthcare/HEALTHCARE.md
modules/healthcare/CASES.md
modules/healthcare/CASE_CALENDAR.md
modules/healthcare/CASE_LOGISTICS.md
modules/healthcare/EQUIPMENT.md

modules/erp/PRODUCTS.md
modules/erp/INVENTORY.md
modules/erp/PURCHASES.md

product/ZAPING_WAY.md
ux/BUSINESS_COMPONENTS.md
engineering/API_GUIDELINES.md
```

---

# 228. Fuente de verdad

```text
CASE_KITS.md
→ requirements y preparation

CASES.md
→ contexto y lifecycle del Case

CASE_CALENDAR.md
→ readiness visible en el tiempo

CASE_LOGISTICS.md
→ Dispatch / Custody / Return / Reconciliation

EQUIPMENT.md
→ identidad física de Equipment

INVENTORY.md
→ stock, batches y disponibilidad

PROJECT_BOARD.md
→ estado de implementación

schema.prisma
→ modelo técnico cuando sea aprobado
```

---

# 229. Decisiones pendientes antes de Prisma

Antes de crear modelos como:

```text
KitTemplate
KitTemplateItem
CaseKit
CaseKitItem
```

HC-OPS-01A resuelve para su alcance la cardinalidad, la separación entre cantidad
solicitada y preparada, la referencia a Equipment Assignment y el lifecycle
inicial `DRAFT`. Permanecen pendientes para slices posteriores:

```text
KitTemplate lifecycle
required vs optional representation
backup items
substitutions
batch allocation representation
serial allocation representation
reservation strategy
preparation lifecycle posterior a DRAFT
post-Dispatch mutability
preparedBy / reviewedBy requirements
```

---

# 230. Principio final

CaseKit debe preservar la diferencia entre:

```text
lo que normalmente se usa
↓
KitTemplate
```

```text
lo que este Case necesita
↓
CaseKit Requirements
```

```text
lo que Warehouse preparó
↓
Prepared Material
```

```text
lo que realmente salió
↓
CaseDispatch
```

y posteriormente:

```text
lo que se utilizó
lo que regresó
lo que quedó pendiente
↓
Reconciliation
```

> **El maletín no es una venta ni una salida definitiva: es la preparación controlada de recursos para un Case, cuya historia debe permanecer separada de lo que finalmente salió y de lo que realmente se utilizó.**

---

# 231. HC-OPS-01A — CaseKit Draft & Contents

**Estado:** COMPLETE / MERGED — PR #50 — `main@bb530e8` — Actual 27-sep-2026.

HC-OPS-01A implementa el primer slice visible de Maletín. Su alcance termina en
la creación de un único CaseKit lógico `DRAFT` por HealthcareCase y el agregado de
contenido ya vinculado al Case. No confirma preparación ni produce hechos físicos.

## 231.1 Decisiones aprobadas

- **DEC-OPS01A-01:** un único `HealthcareCaseKit` lógico por
  `HealthcareCase`.
- **DEC-OPS01A-02:** el único status implementado es `DRAFT`.
- **DEC-OPS01A-03:** material `QUANTITY` puede agregarse mediante
  `requirementId + preparedQuantity` como preparación lógica no reservante.
- **DEC-OPS01A-04:** una fuente posteriormente inválida se conserva y se marca
  `stale` mediante warnings derivados; no se autoelimina ni adquiere un lifecycle
  persistido adicional.
- **DEC-OPS01A-05:** `Idempotency-Key` es obligatorio para Create CaseKit y Add
  CaseKitItem.
- **DEC-OPS01A-06:** la API utiliza errores estables y sanitizados.

## 231.2 Modelo Prisma mínimo aprobado

```prisma
enum HealthcareCaseKitStatus {
  DRAFT
}

model HealthcareCaseKit {
  id          String                  @id @default(uuid())
  companyId   String
  caseId      String
  status      HealthcareCaseKitStatus @default(DRAFT)
  createdById String
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  company        Company        @relation(fields: [companyId], references: [id], onDelete: Restrict)
  healthcareCase HealthcareCase @relation(fields: [caseId, companyId], references: [id, companyId], onDelete: Restrict)
  createdBy      User           @relation(fields: [createdById, companyId], references: [id, companyId], onDelete: Restrict)
  items          HealthcareCaseKitItem[]

  @@unique([id, companyId])
  @@unique([id, companyId, caseId])
  @@unique([companyId, caseId])
  @@index([companyId, status, updatedAt])
}

model HealthcareCaseKitItem {
  id                    String   @id @default(uuid())
  companyId             String
  caseId                String
  caseKitId             String
  requirementId         String?
  equipmentAssignmentId String?
  preparedQuantity      Int?
  addedById             String
  createdAt             DateTime @default(now())

  caseKit             HealthcareCaseKit              @relation(fields: [caseKitId, companyId, caseId], references: [id, companyId, caseId], onDelete: Restrict)
  requirement         HealthcareCaseRequirement?     @relation(fields: [requirementId, companyId, caseId], references: [id, companyId, caseId], onDelete: Restrict)
  equipmentAssignment HealthcareEquipmentAssignment? @relation(fields: [equipmentAssignmentId, companyId, caseId], references: [id, companyId, caseId], onDelete: Restrict)
  addedBy             User                           @relation(fields: [addedById, companyId], references: [id, companyId], onDelete: Restrict)

  @@unique([id, companyId])
  @@index([companyId, caseKitId])
  @@index([companyId, caseId])
}
```

La implementación añadirá las relaciones inversas necesarias y
`@@unique([id, companyId, caseId])` a
`HealthcareEquipmentAssignment` exclusivamente para soportar el FK compuesto del
item; esto no cambia el contrato de Assignment.

También añadirá dos scopes a `IdempotencyScope`:

```text
HEALTHCARE_CASE_KIT_CREATE
HEALTHCARE_CASE_KIT_ITEM_ADD
```

No se crean modelos `Container`, `Dispatch`, `Custody`, `Return` o `Inspection`.

## 231.3 Constraints e índices exactos

La migration futura deberá crear y nombrar explícitamente:

- unique `HealthcareCaseKit_companyId_caseId_key` sobre `(companyId, caseId)`;
- unique compuesto de identidad/tenant/case para CaseKit y Assignment;
- índice parcial único `HealthcareCaseKitItem_requirement_source_key` sobre
  `(companyId, caseKitId, requirementId) WHERE requirementId IS NOT NULL`;
- índice parcial único `HealthcareCaseKitItem_assignment_source_key` sobre
  `(companyId, caseKitId, equipmentAssignmentId) WHERE equipmentAssignmentId IS NOT NULL`;
- CHECK `HealthcareCaseKitItem_source_shape_check`:
  - fuente Requirement: `requirementId IS NOT NULL`,
    `equipmentAssignmentId IS NULL`, `preparedQuantity > 0`;
  - fuente Equipment: `requirementId IS NULL`,
    `equipmentAssignmentId IS NOT NULL`, `preparedQuantity IS NULL`;
- FKs tenant/case compuestos con `ON DELETE RESTRICT` para Case, Requirement,
  Assignment y Users;
- índices `(companyId, status, updatedAt)`, `(companyId, caseKitId)` y
  `(companyId, caseId)`.

La regla `preparedQuantity <= requestedQty` se valida dentro de la transacción;
no puede expresarse como CHECK porque compara dos filas.

## 231.4 Elegibilidad y mutabilidad

- Case `DRAFT` o `SCHEDULED`: elegible.
- Case `CANCELLED`: lectura permitida; Create/Add rechazados con
  `CASE_NOT_ELIGIBLE`.
- CaseKit: sólo `DRAFT`; una futura fila con otro status se rechaza con
  `CASE_KIT_NOT_MUTABLE`.
- Material: Requirement del mismo tenant/Case, `ACTIVE`, Product activo,
  `inventoryTracking=QUANTITY` y `0 < preparedQuantity <= requestedQty`.
- Requirement `ASSET`: entra mediante una Assignment `RESERVED`, no como cantidad.
- `SERIALIZED`, selección de lote y batch allocation quedan fuera de 01A.
- Equipment: Assignment del mismo tenant/Case, `RESERVED`, con EquipmentAsset
  `ACTIVE + GOOD`.
- El mismo Requirement o Assignment no puede agregarse dos veces al CaseKit.
- 01A no expone update/remove de items. Su corrección y auditoría se contratarán
  en un slice posterior; no se hará hard delete implícito.

## 231.5 Contrato HTTP

### GET `/healthcare/cases/:caseId/case-kit`

- `200`: `HealthcareCaseKitResponse` directo.
- `404 CASE_NOT_FOUND`: Case ausente o foreign-tenant.
- `404 CASE_KIT_NOT_FOUND`: Case propio sin CaseKit.

### POST `/healthcare/cases/:caseId/case-kit`

- header obligatorio `Idempotency-Key`, trim, 1–128 caracteres;
- body `{}` allowlisted;
- `201`: primera creación;
- `200`: replay completado con misma key/payload;
- respuesta directa `HealthcareCaseKitResponse`, sin outcome/data wrapper.

### POST `/healthcare/case-kits/:caseKitId/items`

- header obligatorio `Idempotency-Key`, trim, 1–128 caracteres;
- DTO discriminado y allowlisted:

```text
{ sourceType: "REQUIREMENT", requirementId, preparedQuantity }
```

o:

```text
{ sourceType: "EQUIPMENT_ASSIGNMENT", equipmentAssignmentId }
```

- `201`: primer agregado;
- `200`: replay completado con misma key/payload;
- respuesta directa `HealthcareCaseKitItemResponse`.

No se añade endpoint de confirmación, cambio de status, Dispatch, Return,
Inspection, update o remove.

## 231.6 Response y warnings derivados

`HealthcareCaseKitResponse` expone:

```text
id, caseId, status, createdBy, createdAt, updatedAt, items[]
```

Cada item expone:

```text
id
sourceType
preparedQuantity?
requirement? / equipmentAssignment?
sourceValid
stale
warnings[]
addedBy
createdAt
```

`sourceType`, `sourceValid`, `stale` y `warnings` se derivan; no se persiste un
lifecycle nuevo de item. Warnings estables:

- `CASE_KIT_CASE_CANCELLED`;
- `CASE_KIT_REQUIREMENT_NOT_ACTIVE`;
- `CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE`;
- `CASE_KIT_PREPARED_QUANTITY_EXCEEDS_REQUESTED`;
- `CASE_KIT_ASSIGNMENT_NOT_RESERVED`;
- `CASE_KIT_EQUIPMENT_NOT_ACTIVE`;
- `CASE_KIT_EQUIPMENT_NOT_GOOD`.

Un warning vuelve `sourceValid=false` y `stale=true`. GET y replay recalculan el
estado actual sin escribir, eliminar ni reparar el item. Futuras transiciones de
preparación deberán rechazar cualquier item stale hasta una resolución explícita.

## 231.7 Errores estables

| HTTP | Code | Uso |
|---|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Falta el header obligatorio. |
| 400 | `INVALID_IDEMPOTENCY_KEY` | Header vacío o mayor a 128 caracteres. |
| 400 | `INVALID_CASE_KIT_SOURCE` | DTO ambiguo, tracking no soportado o combinación inválida. |
| 400 | `INVALID_PREPARED_QUANTITY` | Cantidad no entera, menor a 1 o mayor a la solicitada. |
| 403 | `FORBIDDEN` | Rol sin autorización. |
| 404 | `CASE_NOT_FOUND` | Case ausente o foreign-tenant. |
| 404 | `CASE_KIT_NOT_FOUND` | CaseKit ausente o foreign-tenant. |
| 404 | `CASE_KIT_SOURCE_NOT_FOUND` | Requirement/Assignment ausente o foreign-tenant. |
| 409 | `CASE_KIT_ALREADY_EXISTS` | Otro request/key ya creó el CaseKit del Case. |
| 409 | `CASE_KIT_NOT_MUTABLE` | El CaseKit no admite la mutación solicitada. |
| 409 | `CASE_NOT_ELIGIBLE` | Case CANCELLED o no elegible. |
| 409 | `CASE_KIT_ITEM_ALREADY_EXISTS` | La fuente ya pertenece al CaseKit. |
| 409 | `CASE_KIT_SOURCE_NOT_ELIGIBLE` | La fuente existe pero su estado ya no permite agregarla. |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Misma key con fingerprint distinto. |
| 409 | `RESOURCE_STATE_CHANGED` | Una update/insert condicional perdió la carrera. |
| 503 | `HEALTHCARE_CONCURRENCY_TIMEOUT` | Sólo timeout de adquisición del Company lock. |
| 500 | `HEALTHCARE_PERSISTENCE_ERROR` | Error de persistencia sanitizado. |

## 231.8 Tenant, transacción e idempotencia

- `companyId` y actor provienen del JWT; nunca del body.
- Un identificador foreign-tenant se presenta como missing y no revela estado.
- Cada comando usa una sola transacción y las primitivas Healthcare vigentes:
  Company advisory lock, subsequent timeouts, locks de Case/CaseKit/fuente y
  revalidación antes del insert.
- Create CaseKit, Create Item, claim y completion ocurren atómicamente; cualquier
  fallo revierte todo.
- El fingerprint canónico SHA-256 incluye versión, command, IDs y cantidad; no
  depende de orden JSON ni campos extra rechazados por DTO.
- Una key completada se comprueba primero: mismo fingerprint retorna el recurso
  existente aun si después el Case o la fuente quedaron inválidos; el read-model
  muestra los warnings actuales sin writes.
- Misma key con fingerprint distinto retorna `IDEMPOTENCY_KEY_REUSED` antes de
  cualquier replay por estado.
- Un duplicado estructural con key nueva retorna `CASE_KIT_ALREADY_EXISTS` o
  `CASE_KIT_ITEM_ALREADY_EXISTS` y no consume la key nueva.
- La colisión concurrente del claim debe recuperar el ganador de forma segura.

## 231.9 Semántica no reservante

Agregar material QUANTITY:

- no decrementa `Product.stock`;
- no modifica `InventoryBatch.availableQuantity`;
- no crea `InventoryMovement`;
- no garantiza disponibilidad física;
- no selecciona batch, serie, ubicación o custodio.

La UI debe mostrar esta limitación junto al formulario y al estado DRAFT. El
backend continúa siendo autoridad para elegibilidad y no debe presentar el
CaseKit como reserva o salida física.

## 231.10 RBAC

- READ: `ADMIN`, `MANAGER`, `SALES`, `WAREHOUSE`.
- CREATE CASEKIT / ADD ITEM: `ADMIN`, `MANAGER`, `WAREHOUSE`.
- `SALES`: read-only.

Se reutiliza fixed-role RBAC; permission-based RBAC y rol Technician quedan fuera.

## 231.11 Acceptance Criteria

- un Case propio DRAFT/SCHEDULED admite exactamente un CaseKit DRAFT;
- material QUANTITY y Assignment RESERVED elegibles se agregan y se leen con su
  relación al Case;
- constraints y revalidación impiden tenant/case mismatch, fuentes ambiguas,
  duplicados y cantidades inválidas;
- una fuente invalidada después del agregado permanece, se marca stale y no causa
  writes de reparación;
- Create/Add, claim y completion son atómicos; replay y conflicto de payload
  cumplen DEC-OPS01A-05;
- Case CANCELLED y roles no autorizados producen rechazo zero-write;
- UI Case → Maletín cubre loading/empty/error/403, creación, agregado, estado DRAFT
  y advertencia no reservante;
- no existe cambio en stock, batches, movimientos, Assignment lifecycle,
  Equipment condition ni efectos físicos.

## 231.12 Definition of Ready

- DEC-OPS01A-01 a DEC-OPS01A-06 aprobadas y documentadas;
- modelo, constraints, API, errores, tenant, warnings, idempotencia y RBAC cerrados;
- alcance de migration, backend, Web y suites focales identificable sin diseñar
  Dispatch/Custody;
- exclusiones explícitas y sin dependencia de C5-COVERAGE.

**Resultado DoR:** COMPLETE. HC-OPS-01A puede pasar a READY.

## 231.13 Definition of Done

- schema/migration Prisma con constraints e índices revisados;
- controller/service/repository y cliente/pantalla Web implementados;
- unit tests de DTO, hash, repository, service, controller y UI;
- PostgreSQL/HTTP focal para constraints, tenant, idempotencia, concurrencia,
  rollback, stale read-model y ausencia de efectos Inventory;
- Prisma validate/generate, Jest/Vitest focal, TypeScript API/Web, ESLint,
  Prettier, builds API/Web y `git diff --check` PASS;
- validación manual de create/add/warnings/RBAC; evidencia de cleanup propio para
  cualquier harness PostgreSQL.

## 231.14 Fuera de alcance y decisiones abiertas no bloqueantes

Quedan fuera y requieren contratos posteriores: update/remove/corrección auditada
de items, `IN_PREPARATION`/`PREPARED`, preparedBy/preparedAt, templates, backup y
substitutions, batch/serial allocation, reserva física, Container/QR, Dispatch,
Custody, Return, Inspection y Reconciliation. No bloquean 01A porque ninguno es
necesario para Create/Add/Read del borrador aprobado.

No se asignan SP, Forecast ni Commitment.

## 231.15 Cierre técnico

HC-OPS-01A quedó COMPLETE / MERGED mediante PR #50 sobre `main@bb530e8`, con
Actual 27-sep-2026.

Evidencia acreditada:

- API focal/regression: 382/382 PASS;
- Web focal: 26/26 PASS;
- Prisma validate: PASS;
- TypeScript API/Web: PASS;
- ESLint API/Web: PASS;
- API build y Next.js build: PASS;
- CI API/Web: PASS.

Validación manual acreditada para MANAGER: creación de CaseKit, estado `DRAFT`,
banner de no reservación, agregado de Requirement `QUANTITY`, agregado de Equipment
Assignment `RESERVED` y render correcto de las secciones Materials/Equipment. No se
registra validación manual de SALES.

El cierre conserva estrictamente Create/Get/Add y `DRAFT` only. No incorpora
Update/Remove Item, `InventoryMovement`, reserva o decremento de stock,
Dispatch/Custody/Return/Inspection ni otros efectos físicos.

## 231.16 Evolución inmediata

HC-OPS-01A.1 implementa la exclusión auditada de items `DRAFT` antes de abordar
la confirmación de preparación. El contrato normativo y su cierre se definen en
la sección 232.

## 231.17 Evolución implementada

**HC-OPS-01B — Preparation Confirmation & Readiness** está implementado y validado:
**COMPLETE / VALIDATED / READY FOR FINAL REVIEW — UNCOMMITTED — DoD PASS**, con DoR COMPLETE y sin SP,
Forecast ni Commitment. El blocker previo de corrección de items stale quedó
resuelto por HC-OPS-01A.1.

---

# 232. HC-OPS-01A.1 — Draft Item Exclusion

**Estado:** COMPLETE / MERGED — PR #53 — `main@54a5d79` — Actual 28-sep-2026.

## 232.1 Objetivo y decisión

Un item incorrecto o stale de un CaseKit `DRAFT` debe poder excluirse sin hard
delete ni pérdida de trazabilidad. HC-OPS-01A.1 introduce únicamente exclusión
auditada; no permite editar, restaurar o eliminar físicamente el item.

## 232.2 Delta Prisma

```prisma
enum HealthcareCaseKitItemLifecycle {
  ACTIVE
  EXCLUDED
}

model HealthcareCaseKitItem {
  lifecycle       HealthcareCaseKitItemLifecycle @default(ACTIVE)
  excludedById    String?
  excludedAt      DateTime?
  exclusionReason String?

  excludedBy User? @relation(
    "HealthcareCaseKitItemExcludedBy",
    fields: [excludedById, companyId],
    references: [id, companyId],
    onDelete: Restrict
  )
}
```

La relación con User es tenant-safe y requiere la relación inversa correspondiente.
Las filas existentes migran a `ACTIVE`. `IdempotencyScope` añade exclusivamente:

```text
HEALTHCARE_CASE_KIT_ITEM_EXCLUDE
```

HC-OPS-01A.1 no añade `PREPARED` al enum del CaseKit.

## 232.3 Auditoría, constraints e índices

La integridad de auditoría exige:

```text
ACTIVE
→ excludedById, excludedAt y exclusionReason son NULL

EXCLUDED
→ excludedById, excludedAt y exclusionReason son NOT NULL
→ exclusionReason normalizada tiene entre 1 y 1000 caracteres
```

Los índices únicos actuales por fuente se sustituyen por índices parciales:

```sql
UNIQUE ("companyId", "caseKitId", "requirementId")
WHERE "requirementId" IS NOT NULL AND "lifecycle" = 'ACTIVE';

UNIQUE ("companyId", "caseKitId", "equipmentAssignmentId")
WHERE "equipmentAssignmentId" IS NOT NULL AND "lifecycle" = 'ACTIVE';
```

Filas históricas `EXCLUDED` de la misma fuente pueden coexistir. Se conservan los
índices vigentes y se añaden `(companyId, caseKitId, lifecycle, createdAt)` y
`(companyId, excludedById)`.

## 232.4 API

```http
POST /healthcare/case-kits/:caseKitId/items/:itemId/exclude
Idempotency-Key: <required>

{ "reason": "Motivo normalizado" }
```

- `reason` es obligatorio, normalizado y de 1 a 1000 caracteres;
- la primera exclusión y todos los replays válidos devuelven HTTP 200;
- la respuesta es `HealthcareCaseKitItemResponse` directa, sin outcome/data
  wrapper;
- la respuesta añade `lifecycle`, `excludedBy`, `excludedAt` y
  `exclusionReason`.

## 232.5 Reglas tenant, lifecycle y transacción

- sólo un item `ACTIVE` dentro de un CaseKit `DRAFT` puede excluirse por primera
  vez;
- cualquier item incorrecto o stale puede excluirse; no es necesario que ya tenga
  warnings;
- un Case `CANCELLED` rechaza una exclusión nueva con `CASE_NOT_ELIGIBLE`;
- `companyId` y actor proceden del JWT, nunca del body;
- item, CaseKit y Case deben pertenecer al mismo tenant y conservar sus relaciones
  compuestas; un identificador foreign-tenant se presenta como missing;
- no existe hard delete ni mutación de Requirement, Assignment, Inventory o stock;
- un futuro CaseKit `PREPARED` será inmutable porque el comando exige exactamente
  `DRAFT`.

Cada primera exclusión usa una sola transacción:

```text
Company advisory lock
→ subsequent timeouts
→ Case FOR UPDATE
→ CaseKit FOR UPDATE
→ CaseKitItem FOR UPDATE
→ key/state/lifecycle decision
→ conditional exclusion + idempotency claim completion
```

Exclusión, auditoría, claim y completion son atómicos. Si el update condicional
afecta cero filas, el servicio debe hacer readback y clasificar el estado ganador;
nunca puede asumir éxito.

## 232.6 Idempotencia y replay

- misma key + mismo CaseKit/item/razón normalizada: HTTP 200 replay;
- misma key con payload distinto: 409 `IDEMPOTENCY_KEY_REUSED`;
- item ya `EXCLUDED` + key nueva + misma razón normalizada: HTTP 200 zero-write,
  sin consumir la key nueva y preservando actor, timestamp y razón originales;
- item ya `EXCLUDED` + razón normalizada distinta: 409
  `CASE_KIT_ITEM_ALREADY_EXCLUDED`; nunca sobrescribe auditoría;
- un replay completado prevalece sobre cambios posteriores del Case o CaseKit;
- las colisiones concurrentes del claim recuperan al ganador de forma segura.

El fingerprint SHA-256 estable incluye versión, comando, `caseKitId`, `itemId` y
razón normalizada.

## 232.7 Lectura, duplicados y readiness futuro

- GET devuelve items `ACTIVE` y `EXCLUDED`;
- los excluidos permanecen visibles como historia con badge, actor, fecha y razón;
- duplicate detection y Add consideran únicamente filas `ACTIVE`;
- readiness y coverage futuros consideran únicamente filas `ACTIVE`;
- la misma Requirement o Assignment puede agregarse de nuevo después de excluir
  la fila anterior;
- los warnings actuales pueden seguir derivándose sobre la fila histórica, pero
  una fila `EXCLUDED` no contribuye al contenido operativo.

## 232.8 Errores estables

| HTTP | Code | Uso |
|---|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Falta el header obligatorio. |
| 400 | `INVALID_IDEMPOTENCY_KEY` | Header vacío o mayor a 128 caracteres. |
| 400 | `INVALID_CASE_KIT_ITEM_EXCLUSION_REASON` | Razón ausente o inválida. |
| 403 | `FORBIDDEN` | Rol no autorizado. |
| 404 | `CASE_KIT_NOT_FOUND` | CaseKit ausente o foreign-tenant. |
| 404 | `CASE_KIT_ITEM_NOT_FOUND` | Item ausente, foreign-tenant o ajeno al CaseKit. |
| 409 | `CASE_NOT_ELIGIBLE` | Case cancelado. |
| 409 | `CASE_KIT_NOT_MUTABLE` | CaseKit distinto de DRAFT. |
| 409 | `CASE_KIT_ITEM_ALREADY_EXCLUDED` | Replay de estado con razón distinta. |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Misma key con payload distinto. |
| 409 | `RESOURCE_STATE_CHANGED` | La transición condicional perdió la carrera. |
| 503 | `HEALTHCARE_CONCURRENCY_TIMEOUT` | Sólo timeout de adquisición del Company lock. |
| 500 | `HEALTHCARE_PERSISTENCE_ERROR` | Error de persistencia sanitizado. |

## 232.9 RBAC y UI mínima

- ADMIN, MANAGER y WAREHOUSE pueden excluir;
- SALES conserva lectura únicamente;
- la acción `Excluir` aparece sólo para item `ACTIVE`, CaseKit `DRAFT` y rol
  autorizado;
- el modal exige razón e informa que el historial se conservará;
- el éxito refresca el CaseKit y mueve visualmente el item a su historia excluida;
- no existen restore, edit, hard-delete ni controles de logística física.

## 232.10 Acceptance Criteria

- una exclusión válida persiste lifecycle y auditoría originales de forma atómica;
- no se elimina ninguna fila y GET conserva la historia;
- los índices parciales impiden duplicados `ACTIVE` y permiten re-agregar la fuente
  después de excluirla;
- Add, duplicate detection y futuros cálculos de readiness/coverage ignoran
  `EXCLUDED`;
- tenant/case/kit mismatch, Case cancelado, rol no autorizado y Kit no DRAFT se
  rechazan sin writes;
- replay, conflicto de payload/razón y concurrencia cumplen la sección 232.6;
- cualquier fallo revierte item, auditoría y claim;
- no existen efectos sobre Inventory, stock, Requirements o Assignments;
- Web presenta acción, confirmación, feedback e historia sin ofrecer edición o
  restauración.

## 232.11 Definition of Ready

- modelo, constraints, índices parciales, endpoint y response cerrados;
- reglas de tenant, lifecycle, transacción, idempotencia y replay cerradas;
- errores estables, RBAC, UI, AC y exclusiones documentados;
- no depende de implementar PREPARED, Dispatch o reserva física.

**Resultado DoR:** COMPLETE antes de la implementación aceptada en PR #53.

## 232.12 Definition of Done

- schema y migration implementan lifecycle, auditoría, FK tenant-safe, checks e
  índices parciales revisados;
- DTO, hash, controller, service, repository, responses y cliente/UI implementados;
- pruebas cubren happy path, razón, tenant/case/kit, RBAC, replay, razón distinta,
  colisión concurrente, conditional update, rollback, historia y re-agregado;
- PostgreSQL focal acredita índices parciales, atomicidad y concurrencia real;
- Prisma validate/generate, Jest/Vitest focal, TypeScript API/Web, ESLint,
  Prettier, builds y `git diff --check` PASS;
- validación manual acredita exclusión, historial visible y re-agregado sin efectos
  físicos.

**Evidencia de cierre:** Prisma validate/generate PASS; API focal 36/36 PASS;
Web focal 12/12 PASS; TypeScript API/Web, ESLint API/Web, API build y Next.js
build PASS; harness PostgreSQL 2H completo 45/45 PASS, 0 skipped; y
`git diff --check` PASS.

La validación manual acreditó como MANAGER la exclusión de un item `ACTIVE`, la
preservación de la historia `EXCLUDED` con actor/fecha/razón, el re-agregado de la
misma fuente y la coexistencia del histórico `EXCLUDED` con el nuevo `ACTIVE`.
No se registra validación manual de SALES.

## 232.13 Límites explícitos

HC-OPS-01A.1 no implementa `PREPARED`, update de item, restore, hard delete,
Dispatch, Custody, Return, Inventory Movement, reserva/decremento de stock ni
mutación de Equipment Assignment. No introduce versioning genérico de items.

No se asignan SP, Forecast ni Commitment.

---

# 233. HC-OPS-01B — Preparation Confirmation & Readiness

**Estado:** COMPLETE / VALIDATED / READY FOR FINAL REVIEW — UNCOMMITTED — DoD PASS.

**Prerequisito:** HC-OPS-01A.1 COMPLETE / MERGED; el blocker de corrección de
items stale está RESOLVED.

## 233.1 Lifecycle y semántica

- `HealthcareCaseKitStatus` añade únicamente `PREPARED`; no se introduce
  `IN_PREPARATION`;
- la única transición nueva es `DRAFT -> PREPARED`;
- `PREPARED` confirma preparación lógica y readiness, pero no reserva inventario,
  no representa Dispatch ni salida de Warehouse;
- el contenido de un CaseKit `PREPARED` es inmutable: Add y Exclude siguen
  exigiendo exactamente `DRAFT`;
- no existe reapertura a `DRAFT` en 01B;
- repetir Confirm Preparation sobre `PREPARED` retorna HTTP 200 zero-write y
  preserva `preparedBy` y `preparedAt` originales.

## 233.2 Delta de persistencia

```prisma
enum HealthcareCaseKitStatus {
  DRAFT
  PREPARED
}

model HealthcareCaseKit {
  preparedById String?
  preparedAt   DateTime?

  preparedBy User? @relation(
    "HealthcareCaseKitPreparedBy",
    fields: [preparedById, companyId],
    references: [id, companyId],
    onDelete: Restrict
  )
}
```

La relación User es tenant-safe y requiere su relación inversa. La migration debe
añadir `HEALTHCARE_CASE_KIT_CONFIRM_PREPARATION` a `IdempotencyScope`, el índice
`(companyId, preparedById)` y el CHECK
`HealthcareCaseKit_preparation_audit_check`:

```text
DRAFT    => preparedById y preparedAt son NULL
PREPARED => preparedById y preparedAt son NOT NULL
```

01B no persiste `readinessStatus`, blockers ni snapshot de readiness.

## 233.3 Readiness derivado

GET y Confirm exponen siempre:

```text
preparationReadiness: {
  status: PASS | BLOCKED,
  blockers: Array<{
    code,
    requirementId?,
    caseKitItemId?
  }>
}
```

Los blockers se derivan del estado actual; los IDs opcionales identifican la fuente
cuando aplica. Para la primera confirmación deben cumplirse todas estas reglas:

- Case exactamente `SCHEDULED`, con `scheduledStart` y `scheduledEnd` presentes;
- ningún item `ACTIVE` stale/inválido ni con warning bloqueante;
- cada Requirement `ACTIVE + REQUIRED` con tracking `QUANTITY` tiene su item
  `ACTIVE` y `preparedQuantity == requestedQty`;
- cada Requirement `ACTIVE + REQUIRED` con tracking `ASSET` tiene al menos
  `requestedQty` items `ACTIVE`, cada uno originado en una Equipment Assignment
  `REQUIREMENT + RESERVED` vinculada a ese Requirement;
- un Requirement `ACTIVE + REQUIRED` con tracking `SERIALIZED` bloquea 01B;
- la ausencia de un Requirement `BACKUP` no bloquea; si se incluye, su fuente debe
  seguir siendo válida;
- una Assignment `DIRECT` válida puede estar incluida, pero no cubre Requirements;
- un Kit vacío puede confirmar sólo cuando no existen Requirements
  `ACTIVE + REQUIRED`.

Blockers estables propios de readiness:

- `CASE_KIT_CASE_NOT_SCHEDULED`;
- `CASE_KIT_CASE_SCHEDULE_INCOMPLETE`;
- `CASE_KIT_REQUIRED_QUANTITY_NOT_COVERED`;
- `CASE_KIT_REQUIRED_ASSET_NOT_COVERED`;
- `CASE_KIT_SERIALIZED_REQUIREMENT_UNSUPPORTED`.

Los warnings estables de fuente definidos en 231.6 también actúan como blockers
cuando pertenecen a un item `ACTIVE`. Los items `EXCLUDED` no participan en
readiness ni coverage.

## 233.4 Invalidación posterior

Si después de confirmar se retira un Requirement, se libera o reemplaza una
Assignment, o se cancela el Case:

- el CaseKit permanece `PREPARED`;
- `preparedBy` y `preparedAt` originales permanecen intactos;
- el read-model recalcula `preparationReadiness=BLOCKED` y expone el warning o
  blocker actual;
- no se elimina, excluye, repara ni reemplaza automáticamente ninguna fuente.

## 233.5 Contrato HTTP

```http
POST /healthcare/case-kits/:caseKitId/confirm-preparation
Idempotency-Key: <required>

{}
```

- body vacío y allowlisted;
- primera confirmación válida: HTTP 200;
- replay válido: HTTP 200;
- respuesta `HealthcareCaseKitResponse` directa, sin wrapper outcome/data;
- la respuesta incluye `status`, `preparedBy`, `preparedAt` y
  `preparationReadiness`;
- blockers de readiness: 409 `CASE_KIT_PREPARATION_BLOCKED`, zero-write y sin
  consumir la key.

## 233.6 Tenant, transacción e idempotencia

- `companyId` y actor provienen del JWT; un CaseKit foreign-tenant se presenta
  como missing;
- la primera confirmación usa una transacción y las primitivas Healthcare
  compartidas: Company advisory lock primero, subsequent timeouts, locks y
  revalidación tenant-safe de Case, CaseKit, items `ACTIVE` y fuentes antes de la
  decisión;
- ningún row lock precede al Company lock; las colecciones se procesan en orden
  determinista por ID;
- la transición condicional, auditoría, claim y completion son atómicos;
- si el update condicional afecta cero filas, el readback clasifica el estado
  ganador; nunca se asume éxito;
- fingerprint SHA-256 estable: versión, comando y `caseKitId`; el body es vacío;
- misma key y mismo CaseKit: HTTP 200 replay, incluso si el estado posterior ahora
  genera blockers;
- misma key reutilizada para otro CaseKit: 409 `IDEMPOTENCY_KEY_REUSED` antes de
  cualquier state replay;
- `PREPARED` con key nueva: HTTP 200 zero-write, preserva auditoría, no crea claim
  ni consume la key;
- colisiones concurrentes de claim recuperan al ganador de forma segura.

La frontera implementada de confirmación es Company advisory lock → límites de
trabajo posteriores → Case → CaseKit → items ACTIVE → Requirements del Case →
Assignments de items ACTIVE → Products de materiales ACTIVE → EquipmentAssets de
items ACTIVE. Los row locks son tenant-scoped `FOR UPDATE`, con colecciones en
orden determinista por ID. Después se relee el Kit autoritativamente antes de
evaluar readiness y ejecutar la transición condicional.

Product y EquipmentAsset se bloquean como fuentes de readiness porque sus
mutaciones vigentes no adquieren el Company lock. El protocolo aceptado de 01B
no cambia esas mutaciones ni sus reglas de negocio. Si la invalidación gana,
Confirm responde BLOCKED sin writes ni claim; si Confirm gana, la mutación espera
al commit y el GET posterior deriva el blocker sin reescribir PREPARED ni su
auditoría. Véase [ADR-HC-LOCK-001, sección 6.3](../../architecture/adr/ADR-HC-LOCK-001-healthcare-company-scoped-transaction-coordination.md).

## 233.7 Errores estables

| HTTP | Code | Uso |
|---|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Falta el header obligatorio. |
| 400 | `INVALID_IDEMPOTENCY_KEY` | Header vacío o mayor a 128 caracteres. |
| 400 | `INVALID_REQUEST_BODY` | El body no está vacío. |
| 403 | `FORBIDDEN` | Rol no autorizado. |
| 404 | `CASE_KIT_NOT_FOUND` | CaseKit ausente o foreign-tenant. |
| 409 | `CASE_KIT_PREPARATION_BLOCKED` | Readiness derivado BLOCKED; retorna `blockers[]`. |
| 409 | `CASE_KIT_NOT_MUTABLE` | Estado distinto de DRAFT/PREPARED o mutación incompatible. |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Misma key reutilizada para otro CaseKit. |
| 409 | `RESOURCE_STATE_CHANGED` | La transición condicional perdió la carrera y el readback no permite replay. |
| 503 | `HEALTHCARE_CONCURRENCY_TIMEOUT` | Sólo timeout de adquisición del Company lock. |
| 500 | `HEALTHCARE_PERSISTENCE_ERROR` | Error de persistencia sanitizado. |

## 233.8 Materiales y efectos físicos

`QUANTITY` continúa siendo preparación lógica no reservante. Confirmar:

- no selecciona batches, lotes o seriales;
- no decrementa `Product.stock`;
- no modifica `InventoryBatch.availableQuantity`;
- no crea `InventoryMovement`;
- no garantiza disponibilidad física.

## 233.9 RBAC y UI mínima

- READ: ADMIN, MANAGER, SALES y WAREHOUSE;
- CONFIRM: ADMIN, MANAGER y WAREHOUSE;
- SALES permanece read-only;
- la pantalla muestra checklist y blockers derivados;
- `Confirmar preparación` aparece sólo para `DRAFT` y rol autorizado;
- la confirmación advierte explícitamente que no reserva inventario;
- el éxito refresca el Kit y muestra badge `PREPARED`, actor y fecha; Add y Exclude
  quedan ocultos;
- una invalidación posterior conserva el badge `PREPARED` y muestra readiness
  `BLOCKED`;
- no existen controles de Dispatch.

Tras un 409 `CASE_KIT_PREPARATION_BLOCKED`, `CASE_KIT_NOT_MUTABLE` o
`RESOURCE_STATE_CHANGED`, Web vuelve a consultar Case/CaseKit y presenta readiness
y blockers autoritativos. Conserva el error de confirmación durante el refresh;
si la consulta falla, oculta la readiness anterior y ofrece Reintentar. No recarga
la página del navegador ni replica reglas de readiness en el cliente. La lista
derivada de blockers y los warnings por item satisfacen la UI mínima; no se exige
un checklist adicional ni mostrar IDs de fuente.

## 233.10 Acceptance Criteria

- sólo un CaseKit `DRAFT` propio y con Case `SCHEDULED` completo puede ejecutar la
  primera confirmación;
- las reglas REQUIRED QUANTITY/ASSET/SERIALIZED, BACKUP, DIRECT, empty Kit e items
  `EXCLUDED` producen exactamente el readiness documentado;
- ningún blocker permite writes ni consume una key nueva;
- una confirmación válida persiste `PREPARED`, actor y timestamp de forma atómica;
- replays por key y estado preservan la auditoría original y respetan conflictos
  de scope/payload;
- Add y Exclude rechazan contenido `PREPARED`; no existe reopen;
- invalidaciones posteriores conservan estado/auditoría y cambian sólo el
  read-model derivado a `BLOCKED`;
- tenant isolation, RBAC, respuesta directa, timeout exclusivo de Company y
  errores sanitizados permanecen intactos;
- no se producen writes de Inventory, stock, batches, Assignments ni movimientos;
- Web presenta checklist, confirmación, feedback, auditoría y estado posterior sin
  controles físicos.

## 233.11 Definition of Ready

- lifecycle, transición, inmutabilidad y replay cerrados;
- reglas de readiness y blockers estables cerrados;
- delta Prisma, auditoría y read-model cerrados;
- endpoint, response, idempotencia, transacción, tenant y errores cerrados;
- RBAC, UI, AC, DoD y límites documentados;
- HC-OPS-01A.1 está COMPLETE / MERGED y resolvió la corrección de items stale.

**Resultado DoR:** COMPLETE. Implementación y validación completadas; DoD PASS.

## 233.12 Definition of Done

- schema/migration implementan `PREPARED`, auditoría tenant-safe, CHECK, índice y
  scope idempotente revisados;
- controller/service/repository, DTO/read-model y cliente/UI implementan sólo el
  contrato 233;
- pruebas API/Web cubren todas las reglas de readiness, RBAC, tenant, response,
  inmutabilidad, replay y errores;
- PostgreSQL focal acredita constraint, lock order, colisión concurrente, update
  condicional, rollback atómico y cero efectos físicos;
- pruebas de invalidación acreditan Requirement retire, Assignment release/replace
  y Case cancel sin modificar estado/auditoría PREPARED;
- Prisma validate/generate, tests focales, TypeScript API/Web, ESLint, Prettier,
  builds API/Web y `git diff --check` PASS;
- validación manual acredita checklist, confirmación, badge/auditoría,
  inmutabilidad y BLOCKED derivado posterior.

## 233.13 Límites explícitos

HC-OPS-01B no implementa `IN_PREPARATION`, reopen, mutación de items después de
`PREPARED`, Dispatch, Custody, Return, reserva física, lotes, seriales,
`InventoryMovement`, decremento de stock ni arquitectura no relacionada.

No se asignan SP, Forecast ni Commitment.

## 233.14 Evidencia de cierre

Cierre documental: 2026-10-07. Baseline de revisión:
`feat/hc-ops-01b-preparation`, HEAD
`5865c63f605a74fcdc00a2590e4ab843b9df7a33`, implementación sin commit. COMPLETE
significa implementado y validado; no afirma merge, deployment, release ni cierre
del milestone M-HC1.

La evidencia siguiente procede del checkpoint aceptado de cierre proporcionado
por el usuario y de las validaciones focales del delta anterior. Los builds,
PostgreSQL y QA manual no se repitieron durante este cierre documental. Prisma
validate/generate PASS fue confirmado adicionalmente por el usuario.

| Categoría | Evidencia aceptada | Resultado |
| --- | --- | --- |
| API unit | 6 suites Case Kit, 69/69 tests: readiness, tenant, response, inmutabilidad, replay y errores. | PASS |
| HTTP E2E autenticado | `healthcare-case-kits.http.e2e-spec.ts`, 9/9: JWT/role guard reales, ADMIN/MANAGER/WAREHOUSE 200, SALES 403, sin autenticación 401, tenant ajeno 404, validación 400, blockers 409 y replay/key reuse. Controller y service reales; persistencia/locks con doubles. | PASS |
| Web | Tests de service Case Kits y página Case Kit, 20/20: estados, auditoría, controles y refresh autoritativo tras conflicto, fallo de refresh y retry. | PASS |
| PostgreSQL real | Suite integrada `healthcare-company-lock.consumers.postgres.e2e-spec.ts`, 52/52 en `zaping_spike_test`, PostgreSQL 16. | PASS |
| Carreras de fuentes | Product invalidation y Equipment retirement ganando; preparación ganando antes de ambas mutaciones. | PASS |
| Atomicidad | Confirmaciones concurrentes, constraint PREPARED, readback condicional y rollback tras fallo de completion del claim. | PASS |
| Frontera física | Comparaciones de stock, InventoryBatch, InventoryMovement y Assignments sin efectos de confirmación. | PASS |
| Invalidación posterior | Unit readiness: Requirement retire, Assignment RELEASED/REPLACED y Case cancel; PostgreSQL: Product/Equipment después de preparación, preservando estado/auditoría. | PASS |
| Prisma | Validate/generate; migrations separan enum y campos, CHECK de auditoría, índice y FK compuesta tenant-safe revisados. | PASS |
| Calidad API/Web | Production typecheck, ESLint focal API/Web y Prettier limitado a los archivos del delta UI/HTTP. | PASS |
| Build API | Production build. | PASS |
| Build Web | Production build con `NEXT_PUBLIC_API_URL=https://api.example.test` temporal, retirado después según el checkpoint. | PASS |
| QA manual | DRAFT carga; readiness/blockers/warnings; confirmación BLOCKED rechazada, conserva DRAFT, error y refetch; cantidades REQUIRED completas; Case scheduled/ready; confirmación exitosa; PREPARED/auditoría y controles por rol/estado correctos. | PASS |
| Git | `git diff --check`; trabajo sin stage ni commit. | PASS |

## 233.15 Evaluación final de DoD

Evaluación contra 233.12 y [Project Board, sección 23](../../project/PROJECT_BOARD.md).

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| Contrato aprobado | PASS | Sección 233; DoR COMPLETE. |
| Implementación completa | PASS | DRAFT → PREPARED, auditoría, readiness, HTTP y Web implementados. |
| Arquitectura respetada | PASS | Company-first, locks de fuentes y reread; sin efectos físicos ni ampliación de scope. |
| Tenant isolation | PASS | Unit/repository, JWT tenant propagation HTTP y FK compuesta de auditoría. |
| RBAC / revisión de acceso | PASS | HTTP E2E roles reales y tenant boundary; SALES read-only. No se declara auditoría de seguridad global. |
| Migrations revisadas | PASS | Enum/scope separados de campos/CHECK/índice/FK; Prisma validate/generate y constraint PostgreSQL. |
| API validation | PASS | Body vacío, key obligatoria, UUID, respuesta directa y errores estables; HTTP 9/9. |
| Frontend states | PASS | Web 20/20 y QA manual; loading, errors, blockers, refetch, audit e inmutabilidad. |
| Idempotencia | PASS | Replays por key/estado zero-write, auditoría original y key reuse 409. |
| Concurrencia | PASS | PostgreSQL 52/52, ambas precedencias Product/Equipment y concurrent confirmations. |
| Rollback | PASS | Fallo de completion revierte PREPARED, auditoría y claim. |
| Unit / integración / E2E | PASS | API 69/69, HTTP 9/9, Web 20/20 y PostgreSQL real 52/52. |
| Typecheck / lint / formato | PASS | Gates focales aceptados; no se afirma Prettier global. |
| Production builds | PASS | API/Web builds aceptados. |
| Manual QA | PASS | Flujo y estados validados en el checkpoint manual aceptado. |
| Documentación / changelog | PASS | CASE_KITS, CASES, ROADMAP, PROJECT_BOARD, CHANGELOG y ADR sincronizados. |
| Git health | PASS | Diff-check, implementación preservada, sin stage/commit. |
| Blockers / HIGH sin resolver | PASS | Ninguno pendiente dentro de HC-OPS-01B. |
| Release / deployment / métricas nuevas | NOT APPLICABLE | No se crea versión, PR, merge, SP, Forecast ni Commitment. |

**Resultado:** DoD PASS — COMPLETE / VALIDATED / READY FOR FINAL REVIEW —
UNCOMMITTED. Siguiente paso: revisión humana del diff antes de staging.

Fuera del ticket: drift Prettier en los cuatro archivos preexistentes de DTOs y
module, warnings LF/CRLF del entorno Windows, `output/`, `tmp/`, oportunidades de
hardening least-privilege del rol aislado HC_LOCK_2H y encoding de fixtures/datos.
No bloquean este cierre ni fueron corregidos.
