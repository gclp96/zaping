# Case Kits — Zaping Healthcare

**Módulo:** Healthcare Case Kits
**Producto:** Zaping Healthcare
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** DOMAIN DESIGN / APPROVED TARGET / NOT IMPLEMENTED
**Última actualización:** 2026-08-20
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

Una semántica conceptual puede ser:

```text
DRAFT
↓
IN_PREPARATION
↓
PREPARED
```

con posibles estados como:

```text
CANCELLED
```

si se requiere.

---

# 41. No copiar a Prisma todavía

Estos nombres describen comportamiento.

El enum definitivo se resolverá durante diseño técnico.

---

# 42. DRAFT

Representa requerimientos todavía modificables.

---

# 43. IN_PREPARATION

Representa que Warehouse está preparando físicamente los recursos.

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

debemos resolver:

```text
Case ↔ CaseKit cardinality
KitTemplate lifecycle
required vs optional representation
requested vs prepared quantities
backup items
substitutions
batch allocation representation
serial allocation representation
Equipment requirement vs assignment
reservation strategy
preparation lifecycle
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
