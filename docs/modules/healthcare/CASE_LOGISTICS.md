# Case Logistics — Zaping Healthcare

**Módulo:** Healthcare Case Logistics  
**Producto:** Zaping Healthcare  
**Versión:** 2.0.0  
**Estado:** Aprobado  
**Estado de implementación:** DOMAIN DESIGN / APPROVED TARGET / NOT IMPLEMENTED  
**Última actualización:** 2026-08-20  
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Case Logistics administra la cadena de custodia de Products y Equipment asociados a un Healthcare Case desde que abandonan Preparation hasta que su destino físico queda completamente resuelto.

El flujo principal es:

```text
CaseKit / Staging
↓
Dispatch
↓
Custody
↓
Procedure
↓
Return / Consumption
↓
Inspection
↓
Reconciliation
↓
Operational Closure

Su objetivo es responder de forma confiable:

¿Qué salió?
¿Cuánto?
¿Qué lote?
¿Qué activo físico?
¿Desde dónde salió?
¿Quién recibió la custodia?
¿Qué regresó?
¿Qué se utilizó?
¿Qué falta explicar?
¿En qué condición regresó?
¿Qué movimiento de Inventory representa cada hecho?
```

---

# 2. Principio fundamental

Case Logistics debe distinguir siempre entre:

movimiento interno
≠
disposición definitiva

Por tanto:

CaseDispatch
≠
Inventory OUT

y:

CaseDispatch
≠
Sales Delivery
```

---

# 3. Razón

Cuando Warehouse entrega un maletín a un Technician:

```text
Warehouse
↓
Technician
↓
Hospital
```

el material puede encontrarse físicamente fuera del almacén sin haber sido:

```text
vendido
consumido
facturado
transferido definitivamente
```

La Company continúa siendo propietaria del material mientras su disposición permanezca pendiente.

---

# 4. Flujo físico

Ejemplo:

Purchase Receipt
↓ IN
WAREHOUSE
↓ TRANSFER
STAGING
↓ TRANSFER
CUSTODY

Posteriormente:

CUSTODY
├── TRANSFER → INSPECTION → WAREHOUSE / other controlled location
└── OUT      → definitive consumption / disposition

el resultado conceptual sería:

```text
Company-owned total: 97

Warehouse / inspection / available:
7 returned units

Definitively consumed/disposed:
3
```

La representación técnica exacta de estas cantidades se definirá con Inventory.

---

# 5. Limitación del Inventory actual

El modelo actual de Zaping todavía se apoya en conceptos simples como:

```text
Product.stock
```

y movimientos de inventario orientados principalmente a entradas y salidas.

Healthcare requiere distinguir mejor:

```text
company-owned quantity
warehouse available
reserved
staged
technician custody
inspection
quarantine
definitive OUT
```

Este documento define la necesidad de dominio.

No autoriza todavía modificar `schema.prisma`.

---

# 6. Regla crítica

> **Un mismo hecho físico debe afectar una sola vez la existencia correspondiente.**

Nunca:

```text
Dispatch
↓
stock - 1

Used Material
↓
Delivery
↓
stock - 1 otra vez
```

para la misma unidad física.

---

# 7. ADR principal

La decisión arquitectónica relacionada está documentada en:

```text
ADR-013
Inventory Custody & Case Logistics
```

Case Logistics debe implementarse de acuerdo con esa decisión.

---

# 8. Alcance

Case Logistics incluye conceptualmente:

```text
CaseDispatch
Dispatch Items

Custody
Custodian

CaseReturn
Return Items

Inspection

Reconciliation

Unresolved discrepancies

Operational incidents

Final disposition integration
```

---

# 9. Fuera del alcance

Case Logistics no es responsable directamente de:

* crear Quotes;
* crear invoices;
* administrar Accounts Receivable;
* administrar pagos;
* reemplazar Sales;
* reemplazar Inventory;
* administrar mantenimiento completo de Equipment;
* decidir equivalencias clínicas;
* almacenar expediente médico.

---

# 10. Flujo maestro

```text
Healthcare Case
↓
CaseKit Prepared
↓
Dispatch Confirmed
↓
Custody Active
↓
Procedure
↓
Usage / Return information
↓
Physical Return
↓
Inspection
↓
Reconciliation
↓
Resolved
```

---

# 11. CaseKit vs Dispatch

Debe mantenerse:

```text
CaseKit
→ qué se preparó
```

```text
CaseDispatch
→ qué realmente salió físicamente
```

---

# 12. Diferencias válidas

Puede ocurrir:

```text
Prepared Product A: 5
Dispatched Product A: 4
```

porque una unidad fue retirada antes de la salida.

Eso debe ser válido si ocurre antes de confirmar Dispatch.

---

# 13. Dispatch como hecho físico

Una vez confirmado:

```text
CaseDispatch
```

se convierte en evidencia histórica de:

> **lo que físicamente salió bajo custodia.**

---

# 14. CaseDispatch

CaseDispatch representa una transferencia temporal de custodia relacionada con un Healthcare Case.

---

# 15. Información conceptual

Una futura entidad podría necesitar conceptos semejantes a:

```text
CaseDispatch
├── id
├── companyId
├── caseId
├── folio?
├── status
├── custodianUserId / technicianId
├── dispatchedBy
├── dispatchedAt
├── receivedBy?
├── acknowledgedAt?
├── notes?
├── items[]
├── createdAt
└── updatedAt
```

Esto no constituye todavía un schema Prisma aprobado.

---

# 16. Folio

Puede ser útil un identificador operacional como:

```text
DSP-000123
```

independiente del UUID técnico.

---

# 17. Lifecycle conceptual de Dispatch

Una semántica inicial puede ser:

```text
DRAFT
↓
CONFIRMED
```

con:

```text
CANCELLED
```

solo cuando todavía no ocurrió la transferencia física.

---

# 18. DRAFT

Representa una salida todavía modificable.

No significa que el material ya esté bajo custodia del Technician.

---

# 19. CONFIRMED

Representa:

```text
material physically handed over
+
custody transferred
```

---

# 20. Confirmación

La acción:

```text
Confirm Dispatch
```

debe ser una operación empresarial explícita.

No un simple:

```text
PATCH status = CONFIRMED
```

sin validaciones.

---

# 21. Validaciones de Dispatch

Antes de confirmar deben comprobarse, según el modelo disponible:

```text
Company
Case
permissions
Case status
custodian
items
quantities
batches
serials
Equipment
availability
```

---

# 22. Cantidades

Debe cumplirse:

```text
dispatchQuantity > 0
```

---

# 23. No over-dispatch accidental

El sistema debe mostrar claramente cuando Dispatch excede lo preparado.

Ejemplo:

```text
Prepared: 3
Dispatch requested: 5
```

---

# 24. Excepción válida

Material adicional puede ser necesario.

Pero debe incorporarse explícitamente al proceso, no mediante una inconsistencia silenciosa.

---

# 25. Additional Dispatch

Debe permitirse:

```text
Case
├── Dispatch 1
└── Dispatch 2
```

---

# 26. Ejemplo

```text
08:00
Initial Dispatch

11:30
Procedure requests additional material

11:45
Additional Dispatch
```

Ambos pertenecen al mismo Case.

---

# 27. No modificar Initial Dispatch

El segundo envío no debe agregarse retroactivamente al primero como si hubiera salido desde el inicio.

---

# 28. Dispatch immutable after confirmation

Después de confirmar:

```text
CaseDispatch
→ historical physical fact
```

Por tanto, no debería permitirse reescribir silenciosamente:

```text
product
quantity
batch
serial
custodian
dispatch timestamp
```

---

# 29. Correcciones

Si existió un error operativo/documental después de confirmación, debe utilizarse una acción explícita de:

```text
correction
reversal
adjustment
```

según el diseño final.

---

# 30. No hard delete

Un Dispatch confirmado no debe eliminarse para ocultar un error.

---

# 31. Dispatch Item

Cada partida debe identificar qué producto o activo salió.

Conceptualmente:

```text
DispatchItem
├── productId
├── quantity
├── batchId?
├── serial?
└── sourceCaseKitItem?
```

---

# 32. Source CaseKit

Cuando el material provenga de un CaseKit:

```text
CaseKitItem
↓
DispatchItem
```

la relación es útil para trazabilidad.

---

# 33. Pero Dispatch conserva su propia verdad

Aunque CaseKit cambie posteriormente:

```text
Dispatch
```

debe continuar mostrando exactamente lo que salió.

---

# 34. Lots

Cuando exista tracking por lote:

```text
Dispatch Item
→ exact InventoryBatch
```

---

# 35. Ejemplo

```text
Product A
Total dispatched: 5

Lot L001 × 3
Lot L002 × 2
```

---

# 36. Lot validation

Debe comprobarse:

```text
Batch Product
=
Dispatch Product
```

y:

```text
Batch Company
=
Case Company
```

---

# 37. Expiration

No debería despacharse normalmente material vencido para uso.

La validación definitiva dependerá de las reglas de Inventory.

---

# 38. Serials

Productos serializados requieren identificar la unidad física exacta.

Ejemplo:

```text
Product X
Serial SN-00041
```

---

# 39. Equipment

Para Equipment reutilizable debe utilizarse:

```text
EquipmentAsset
```

no únicamente cantidad genérica.

---

# 40. Ejemplo

```text
Monitor Model X
Equipment Asset:
EQ-00041
Serial:
SN-99102
```

---

# 41. Custody

Custody representa quién tiene físicamente bajo responsabilidad un recurso propiedad de la Company.

---

# 42. Custodian

Conceptualmente:

```text
Custodian
→ Technician / authorized responsible person
```

---

# 43. Custody no significa ownership

Debe mantenerse:

```text
Custodian
≠
Owner
```

---

# 44. Company sigue siendo propietaria

Durante custodia:

```text
Owner:
Company

Custodian:
Technician
```

---

# 45. Chain of Custody

Zaping debe poder reconstruir:

```text
Warehouse
↓
Technician
↓
Return Reception
↓
Inspection
↓
Warehouse / other disposition
```

---

# 46. Custody start

La custodia inicia conceptualmente cuando:

```text
Dispatch CONFIRMED
```

---

# 47. Custody end

La custodia de una unidad termina cuando su disposición queda documentada.

Puede ser:

```text
Returned
Used
Resolved by incident
Other definitive disposition
```

según el tipo de recurso.

---

# 48. Custody acknowledgement

Puede ser útil que el responsable confirme:

```text
I received these items
```

---

# 49. Primera versión

La confirmación puede ser realizada por Warehouse registrando al responsable.

---

# 50. Future acknowledgement

Posteriormente puede existir:

```text
Technician acknowledgement
PIN
signature
QR
mobile confirmation
```

---

# 51. Custody timestamp

Debe conservarse el momento exacto en que inició la custodia.

---

# 52. Hoja de salida

La operación física actual puede producir un documento equivalente a:

```text
Hoja de salida
```

---

# 53. Datos útiles

El documento digital puede contener:

```text
Case
Hospital
Doctor
Procedure
Responsible Technician
Products
Quantities
Lots
Serials
Equipment
Dispatch timestamp
Warehouse actor
```

---

# 54. PDF

Puede generarse posteriormente un PDF de salida.

---

# 55. PDF no es source of truth

Debe mantenerse:

```text
database records
→ source of truth
```

```text
PDF
→ representation
```

---

# 56. Procedure result

Después del procedimiento, las partidas despachadas deben clasificarse operacionalmente.

La regla principal es:

```text
Dispatched
=
Used
+
Returned
+
Unresolved
```

---

# 57. Used

`Used` representa material que dejó de estar disponible bajo custodia porque efectivamente fue utilizado o consumido durante la operación.

---

# 58. Returned

`Returned` representa material que físicamente regresó a control de la Company.

---

# 59. Unresolved

`Unresolved` representa material cuyo destino todavía no ha sido satisfactoriamente explicado.

---

# 60. Invariante

Para cada partida:

```text
Used >= 0
Returned >= 0
Unresolved >= 0
```

y:

```text
Used + Returned + Unresolved
=
Dispatched
```

cuando la reconciliación está completa.

---

# 61. Ejemplo

```text
Dispatched: 10

Used:       4
Returned:   5
Unresolved: 1

10 = 4 + 5 + 1
```

---

# 62. Reconciliación no completa

Si el Technician reporta:

```text
Used: 4
Returned: 5
```

pero salieron 10:

```text
Unresolved: 1
```

hasta aclarar la diferencia.

---

# 63. No esconder diferencias

Nunca:

```text
Returned = Dispatched - Used
```

automáticamente si el sistema no confirmó que esas unidades regresaron físicamente.

---

# 64. Razón

Una unidad puede estar:

```text
missing
pending return
in another container
damaged and undocumented
still with Technician
```

---

# 65. Reported Use

Puede ser útil diferenciar:

```text
Technician reports used
```

de:

```text
Reconciliation confirms disposition
```

---

# 66. Primera versión

La separación exacta entre reporte y confirmación se diseñará antes de Prisma.

---

# 67. No confiar únicamente en diferencia matemática

`Used` representa un hecho operacional.

No debe calcularse ciegamente como:

```text
Dispatched - Returned
```

cuando existen diferencias sin explicar.

---

# 68. CaseReturn

CaseReturn representa el regreso físico de material o Equipment relacionado con un CaseDispatch.

---

# 69. CaseReturn no es SaleReturn

Debe cumplirse:

```text
CaseReturn
≠
Customer Return
```

---

# 70. Diferencia

```text
CaseReturn
→ Company-owned material returns from temporary custody
```

```text
SaleReturn
→ previously commercially fulfilled material comes back
```

---

# 71. Lifecycle conceptual de Return

Una semántica inicial puede ser:

```text
DRAFT
↓
RECEIVED
↓
INSPECTION_PENDING
↓
PROCESSED
```

aunque los estados definitivos pueden ser derivados o dividirse en entidades distintas.

---

# 72. DRAFT Return

Permite capturar qué está regresando antes de confirmar recepción física.

---

# 73. RECEIVED

Significa:

```text
Warehouse physically received the material
```

---

# 74. RECEIVED no significa AVAILABLE

Regla crítica:

```text
Returned
≠
Automatically Available
```

---

# 75. Razón

Material retornado puede estar:

```text
opened
damaged
expired
contaminated
incomplete
in need of maintenance
```

---

# 76. Return Item

Debe poder identificar:

```text
Product / Equipment
quantity
batch
serial
source Dispatch Item
condition observations
```

---

# 77. Source Dispatch

Cada Return Item debería poder rastrearse hasta el Dispatch del que salió.

---

# 78. Múltiples Dispatches

Un Case puede tener:

```text
Dispatch A
Dispatch B
```

y el retorno debe preservar de cuál salió cada recurso cuando sea necesario.

---

# 79. Un Return con múltiples sources

Una misma recepción física puede traer material perteneciente a varios Dispatches del mismo Case.

Una futura implementación puede permitirlo si cada Return Item conserva:

```text
sourceDispatchItemId
```

o relación equivalente.

---

# 80. Partial Return

Debe permitirse:

```text
Dispatched 10
Returned now 6
Still in custody 4
```

---

# 81. Multiple Returns

Después:

```text
Return 1: 6
Return 2: 4
```

si físicamente así sucede.

---

# 82. No exigir regreso único

La operación debe tolerar múltiples retornos para un mismo Case.

---

# 83. Over-return

No debe permitirse registrar más unidades retornadas que las que permanecen atribuibles a custodia, salvo una corrección formal.

---

# 84. Batch consistency

Si salió:

```text
Lot L001
```

no debe registrarse como regreso:

```text
Lot L999
```

para esa misma unidad sin una explicación/corrección.

---

# 85. Serial consistency

Para serial:

```text
SN-001 dispatched
```

el retorno debe ser:

```text
SN-001
```

no otro serial.

---

# 86. Return actor

Debe registrarse quién recibió material en Warehouse.

Conceptualmente:

```text
receivedBy
receivedAt
```

---

# 87. Custodian handoff

También puede resultar útil conocer quién entregó el retorno.

---

# 88. Return notes

Puede registrar observaciones operativas.

Ejemplo:

```text
Caja exterior dañada.
Equipo requiere revisión.
Producto sin abrir.
```

---

# 89. Inspection

Inspection determina qué puede ocurrir con los recursos que regresaron.

---

# 90. Principio

```text
Physical Return
↓
Inspection
↓
Availability / Other Disposition
```

---

# 91. Inspection no es optional conceptualmente para todo

No todos los productos necesitarán el mismo grado de inspección.

La política dependerá de:

```text
product type
company policy
regulatory requirements
condition
```

---

# 92. Reglas configurables futuras

Una Company puede marcar ciertos productos como:

```text
inspectionRequiredOnCaseReturn
```

o implementar una estrategia equivalente.

No se define todavía el schema.

---

# 93. Inspection Result

Resultados conceptuales pueden incluir:

```text
AVAILABLE
QUARANTINE
DAMAGED
EXPIRED
MAINTENANCE
OUT_OF_SERVICE
OTHER
```

---

# 94. No enum aprobado todavía

Estos valores representan semántica funcional.

El modelo definitivo puede variar según consumibles y Equipment.

---

# 95. AVAILABLE

Significa que el recurso puede regresar a disponibilidad normal.

---

# 96. QUARANTINE

Significa que el recurso se conserva físicamente pero no puede utilizarse todavía.

---

# 97. DAMAGED

Significa que la unidad regresó pero presenta daño.

---

# 98. EXPIRED

Significa que existe físicamente, pero no es utilizable para una operación normal.

---

# 99. MAINTENANCE

Especialmente relevante para Equipment.

---

# 100. OUT_OF_SERVICE

Puede aplicar a Equipment que ya no debe asignarse.

---

# 101. Returned + Damaged

Una unidad dañada sigue contando como:

```text
Returned
```

si físicamente regresó.

Después Inspection determina:

```text
Returned
↓
DAMAGED
```

---

# 102. No confundir daño con Unresolved

Debe mantenerse:

```text
Returned and damaged
→ resolved physical location
```

mientras:

```text
Unresolved
→ destination still unknown / unresolved
```

---

# 103. Ejemplo

```text
Dispatched: 5

Used: 2
Returned: 3
Unresolved: 0
```

Inspection:

```text
Returned 3
├── Available: 2
└── Damaged:   1
```

La reconciliación física puede estar completa aunque exista una unidad dañada que requiera otro workflow.

---

# 104. Segunda invariante

Para partidas retornadas que requieren clasificación:

```text
Returned
=
Available
+
Quarantine
+
Damaged
+
Expired
+
Other resolved dispositions
```

cuando las categorías sean mutuamente exclusivas y la Inspection esté terminada.

---

# 105. Equipment

Para Equipment esta clasificación puede necesitar identidad por asset en vez de cantidades agregadas.

---

# 106. Inspection record

Puede ser útil conservar:

```text
inspectedBy
inspectedAt
condition
result
notes
```

---

# 107. Fotos futuras

Para daño puede ser útil adjuntar:

```text
photos
```

mediante futura infraestructura documental.

---

# 108. No almacenar archivos directamente como blobs improvisados

Debe utilizarse la futura estrategia de Document Management.

---

# 109. Reconciliation

Reconciliation es el proceso que confirma que todos los recursos despachados tienen una disposición explicada.

---

# 110. Reconciliation no es Return

Debe distinguirse:

```text
Return
→ qué físicamente regresó
```

```text
Reconciliation
→ explicación completa de todo lo despachado
```

---

# 111. Reconciliation Scope

Puede realizarse:

```text
per Dispatch
```

o:

```text
per Case
```

según diseño técnico.

---

# 112. Preferencia funcional

La experiencia del usuario debería poder responder a nivel Case:

```text
¿Todo lo que salió para este Case está resuelto?
```

aunque internamente se preserve trazabilidad por Dispatch Item.

---

# 113. Ejemplo Case completo

```text
CASE-0145

Dispatch 1
Product A × 5

Dispatch 2
Product A × 2

Total dispatched: 7

Used: 3
Returned: 4
Unresolved: 0
```

---

# 114. Reconciliation Status

Puede necesitar semántica equivalente a:

```text
PENDING
IN_PROGRESS
COMPLETE
EXCEPTION
```

o derivarse de hechos.

---

# 115. Preferencia

Cuando sea posible:

```text
COMPLETE
```

debería resultar de invariantes reales, no de una casilla manual.

---

# 116. Reconciliation complete

Conceptualmente:

```text
all Dispatch Items resolved
+
all required Returns inspected
+
Equipment custody resolved
+
Unresolved = 0
```

---

# 117. Case completion

Entonces puede contribuir a:

```text
Healthcare Case
→ COMPLETED
```

---

# 118. Procedure completed ≠ Case completed

Debe mantenerse:

```text
Procedure finished
≠
Logistics resolved
```

---

# 119. Unresolved

Unresolved representa una obligación operacional pendiente.

---

# 120. Ejemplos

```text
1 unit still with Technician
```

```text
serial cannot be located
```

```text
quantity mismatch
```

```text
return pending verification
```

---

# 121. Incident

Una diferencia relevante puede generar conceptualmente:

```text
Logistics Incident
```

o una excepción equivalente.

---

# 122. Incident no es automáticamente pérdida

Debe distinguirse:

```text
Unresolved
```

de:

```text
Lost
```

---

# 123. Investigación

Puede ocurrir:

```text
Unresolved 1
↓
investigation
↓
found in Technician vehicle
↓
Return
↓
Unresolved 0
```

---

# 124. Resolución

La resolución debe preservar historia.

No debería reescribirse la reconciliación anterior silenciosamente.

---

# 125. Ejemplo de evento

```text
Aug 20 14:00
Unresolved: 1

Aug 21 09:15
Item located

Aug 21 10:05
Return received

Reconciliation completed
```

---

# 126. Lost / Missing definitivo

Si una unidad finalmente se determina como pérdida:

```text
Unresolved
↓
authorized resolution
↓
Inventory loss / adjustment
```

según las reglas de Inventory/Audit.

---

# 127. No marcar como Used para cuadrar

Nunca:

```text
missing item
↓
mark Used
```

solo para hacer que la ecuación cierre.

---

# 128. Razón

Eso destruiría la verdad operativa.

---

# 129. Damaged disposition

Si material retornado está dañado, una futura resolución puede generar:

```text
Inventory adjustment
write-off
repair
quarantine
```

dependiendo del recurso.

---

# 130. Inventory authority

Case Logistics registra el contexto Healthcare.

Inventory continúa siendo el dominio responsable de las consecuencias de existencias.

---

# 131. Custody movement vs Inventory Movement

Healthcare requiere algún mecanismo para representar:

```text
Warehouse
↓
Technician custody
```

sin interpretarlo como:

```text
Company ownership OUT
```

---

# 132. Opciones arquitectónicas

La evolución de Inventory podría utilizar conceptos como:

```text
Inventory Location Transfer
Custody Ledger
Inventory Position
Stock Location
Internal Movement
```

---

# 133. No decidir el modelo aquí

La decisión concreta debe realizarse durante diseño conjunto:

```text
Healthcare
+
Inventory
```

y posiblemente requerir un ADR adicional si ADR-013 no es suficiente.

---

# 134. Regla semántica

Independientemente de la implementación:

> **Dispatch debe reducir disponibilidad del origen sin reducir dos veces la existencia total de la Company.**

---

# 135. Availability

Después de Dispatch:

```text
warehouse available
```

debe reflejar que esas unidades ya no pueden ser preparadas para otro Case.

---

# 136. Riesgo actual

Si el sistema solo mantiene:

```text
Product.stock
```

sin location/custody/reservation, podría mostrar material como disponible aunque esté en manos de un Technician.

---

# 137. Bloqueador de producción

Antes de poner Case Logistics en producción real, debe existir una solución técnica que impida vender/preparar la misma unidad física simultáneamente.

---

# 138. No fake custody

No debe implementarse Healthcare mostrando:

```text
"In custody"
```

solo como etiqueta mientras Inventory continúa permitiendo utilizar la misma existencia.

---

# 139. Commercial disposition

Una vez determinado:

```text
Used
```

puede surgir una consecuencia comercial.

---

# 140. Caso común

```text
Used Product
↓
Sales fulfillment
↓
Delivery
↓
Invoice
```

según la operación.

---

# 141. Pero Used ≠ Invoice

Debe mantenerse:

```text
Used
→ physical/operational truth
```

```text
Delivery
→ commercial fulfillment
```

```text
Invoice
→ financial document
```

---

# 142. Used no siempre implica venta

También puede existir material:

```text
consumed internally
sample
support material
non-billable
```

dependiendo del negocio.

---

# 143. Final disposition

La implementación deberá permitir indicar qué consecuencia corresponde al material utilizado sin mezclar esos conceptos.

---

# 144. Sales integration

Cuando material utilizado se convierte en Delivery:

```text
Case Reconciliation
↓
Used Material
↓
Sales Delivery
```

la integración debe reconocer que el material ya abandonó Warehouse previamente bajo custodia.

---

# 145. Regla de doble decremento

Nunca:

```text
Dispatch
→ total stock decrement
```

y luego:

```text
Delivery
→ same total stock decrement again
```

---

# 146. Estrategia objetivo

Conceptualmente:

```text
Dispatch
→ location/custody transition

Used + commercial fulfillment
→ definitive ownership/disposition transition
```

---

# 147. Delivery permanece en Sales

Healthcare no debe crear:

```text
HealthcareDelivery
```

como sustituto de ERP Delivery.

---

# 148. CaseDispatch permanece Healthcare

Sales tampoco debe utilizar:

```text
Delivery
```

para representar material que todavía puede regresar.

---

# 149. SalesOrder conocido antes

Puede existir:

```text
SalesOrder
↓
Case
↓
CaseDispatch
↓
Procedure
↓
Used
↓
Delivery
```

---

# 150. SalesOrder conocido después

También:

```text
Case
↓
CaseDispatch
↓
Procedure
↓
Reconciliation
↓
SalesOrder / Delivery
```

cuando el proceso real así funcione.

---

# 151. Commercial link

Debe conservarse la relación entre:

```text
Case
Used Material
Delivery
```

para evitar duplicados y permitir trazabilidad.

---

# 152. Idempotency comercial

Reprocesar la reconciliación no debe generar:

```text
Delivery 1
Delivery 2
Delivery 3
```

para el mismo consumo.

---

# 153. Link explícito

La futura implementación puede necesitar relacionar:

```text
Reconciliation disposition
↓
DeliveryItem
```

o estrategia equivalente.

---

# 154. No heurísticas

No detectar únicamente:

```text
same Product
same quantity
same date
```

y asumir que es la misma Delivery.

La relación debe ser explícita.

---

# 155. Customer pendiente

Puede existir material Used mientras todavía falta definir:

```text
Customer
Payer
billing data
```

---

# 156. Regla

La verdad física no debe bloquearse ni falsificarse porque el flujo comercial esté pendiente.

---

# 157. Commercial Pending

Puede resultar necesario mostrar:

```text
Logistically resolved
Commercially pending
```

---

# 158. Case closure

El Case podría estar operacionalmente completo aunque exista:

```text
invoice pending
payment pending
```

---

# 159. Pero fulfillment pendiente

Debe definirse si un Case puede marcarse `COMPLETED` cuando Used Material todavía no ha sido vinculado a su consecuencia comercial.

---

# 160. Recomendación inicial

Separar:

```text
Operational closure
```

de:

```text
Commercial follow-up
```

y mostrar cualquier pendiente comercial de forma explícita.

---

# 161. Case cancellation

Cancelar un Case antes de Dispatch:

```text
→ no custody obligations
```

---

# 162. Cancel after Dispatch

Si existe material bajo custodia:

```text
Case CANCELLED
```

no puede simplemente cerrar Logistics.

---

# 163. Flujo

```text
Case cancellation requested
↓
Active custody detected
↓
Return required
↓
Inspection
↓
Reconciliation
↓
Operational closure
```

---

# 164. Regla

> **Case cancellation never destroys active custody.**

---

# 165. Equipment custody

Equipment utiliza el mismo principio de cadena de custodia, pero con identidad individual.

---

# 166. Ejemplo

```text
EQ-0041
Warehouse
↓
Dispatch
↓
Technician Carlos
↓
Hospital ABC
↓
Return
↓
Inspection
↓
Available
```

---

# 167. Equipment no se consume normalmente

Para un activo reutilizable:

```text
Used during procedure
```

no significa:

```text
Inventory OUT
```

---

# 168. Equipment usage

El uso del Equipment debe registrarse como:

```text
Case assignment / usage history
```

y posteriormente retornar a su lifecycle.

---

# 169. Equipment missing

Si no regresa:

```text
EquipmentAsset
→ active custody / incident
```

y no debe aparecer disponible.

---

# 170. EQUIPMENT.md

El lifecycle detallado de activos se documentará en:

```text
EQUIPMENT.md
```

---

# 171. Warehouse Operations

Case Logistics debe alimentar un workspace operativo.

---

# 172. Ejemplo

```text
WAREHOUSE

To Dispatch
3 Cases

Expected Returns Today
4 Cases

Returns Pending Inspection
6

Reconciliation Pending
2

Overdue Equipment
1
```

---

# 173. Dispatch Workspace

La pantalla debe permitir verificar claramente:

```text
Case
Hospital
Doctor
Technician
CaseKit
Products
Lots
Serials
Equipment
```

antes de confirmar.

---

# 174. Confirmation summary

Antes de confirmar:

```text
You are transferring custody of:

Product A
Lot L001 × 3

Product B
Lot L004 × 2

Equipment
EQ-041

Responsible:
Carlos

Case:
CASE-0145
```

---

# 175. Primary Action

```text
[Confirmar salida]
```

---

# 176. Destructive awareness

Confirmar Dispatch produce un hecho físico importante.

Debe existir una confirmación suficientemente clara sin hacer la UX innecesariamente pesada.

---

# 177. Return Workspace

Al regresar:

```text
Case
↓
Expected items
↓
Scan/select returned
↓
Quantities
↓
Condition
↓
Confirm reception
```

---

# 178. Expected vs Returned

Debe mostrarse:

```text
Product A
Dispatched: 5
Already Returned: 2
Remaining Custody: 3
Returning Now: 3
```

---

# 179. No reescribir previous returns

Cada Return mantiene su propia historia.

---

# 180. Inspection Workspace

Debe permitir:

```text
Returned Item
↓
Condition
↓
Disposition
```

---

# 181. Reconciliation Workspace

Debe mostrar la ecuación completa.

Ejemplo:

```text
CASE-0145

Product A
Dispatched     10
Used            4
Returned        5
Unresolved      1

Status
ACTION REQUIRED
```

---

# 182. Resolution UX

Debe señalar exactamente:

```text
1 unit pending resolution
```

---

# 183. No semáforo sin explicación

El usuario debe conocer:

```text
what
how much
which lot / serial
who has it
```

cuando sea posible.

---

# 184. Case 360

Case 360 debe incluir sección Logistics:

```text
Dispatches
Current Custody
Returns
Inspection
Reconciliation
Incidents
```

---

# 185. Timeline

Ejemplo:

```text
07:30 Dispatch confirmed
Carlos received custody

12:15 Procedure completed

13:20 Return received
5 items

14:00 Inspection completed

14:15 Reconciliation
1 item unresolved
```

---

# 186. Mobile

Case Logistics es candidato prioritario para futura app móvil.

Especialmente:

```text
custody acknowledgement
view CaseKit
scan Equipment
register usage
return confirmation
```

---

# 187. QR / Barcode future

Puede utilizarse para:

```text
Case
CaseKit
Product
Batch
Serial
Equipment
Dispatch
Return
```

---

# 188. QR no sustituye validación

Escanear identifica.

Backend continúa validando:

```text
tenant
ownership
product
batch
serial
status
custody
```

---

# 189. Offline futuro

Los Technicians podrían necesitar registrar operaciones con conectividad limitada.

No forma parte de la primera versión.

---

# 190. Offline complexity

No debe implementarse offline hasta resolver:

```text
conflicts
synchronization
idempotency
security
```

---

# 191. Multi-tenancy

Toda operación Case Logistics ocurre dentro de una Company.

---

# 192. Relaciones

Debe cumplirse:

```text
Dispatch.company
=
Case.company
```

```text
Return.company
=
Case.company
```

```text
Product.company
=
Case.company
```

según el ownership actual.

---

# 193. Batch

```text
Batch.company
=
Case.company
```

---

# 194. Equipment

```text
EquipmentAsset.company
=
Case.company
```

---

# 195. Custodian

El responsable debe estar autorizado dentro del contexto de esa Company.

---

# 196. companyId

Nunca debe confiarse ciegamente en:

```text
companyId
```

enviado por frontend.

Debe derivarse del contexto autenticado conforme ADR-001.

---

# 197. Authorization

Permisos conceptuales pueden incluir:

```text
healthcare.dispatch.read
healthcare.dispatch.create
healthcare.dispatch.confirm

healthcare.custody.read

healthcare.return.create
healthcare.return.receive

healthcare.inspection.read
healthcare.inspection.perform

healthcare.reconciliation.read
healthcare.reconciliation.confirm
healthcare.reconciliation.resolve

healthcare.logistics.incidents.resolve
```

---

# 198. Warehouse

Warehouse normalmente necesitará:

```text
dispatch
receive
inspect
reconcile
```

---

# 199. Technician

Technician puede necesitar:

```text
view assigned custody
acknowledge receipt
report use
report return
report incident
```

---

# 200. Manager

Manager puede necesitar:

```text
resolve discrepancies
authorize exceptional disposition
override under controlled rules
```

---

# 201. Separation of duties

En algunas Companies puede ser conveniente:

```text
Technician reports
↓
Warehouse verifies
↓
Manager resolves exceptions
```

---

# 202. No universal requirement

La segregación exacta debe poder adaptarse al tamaño y operación de la Company.

---

# 203. Backend authority

Backend debe validar:

```text
status
tenant
permissions
quantities
batches
serials
custody
source Dispatch
inspection state
reconciliation equation
```

---

# 204. Transactions

Confirmar operaciones físicas críticas debe utilizar transacciones cuando modifique múltiples fuentes de verdad.

---

# 205. Ejemplo Dispatch futuro

Una confirmación podría necesitar:

```text
create Dispatch
+
create custody positions
+
update availability/location
+
record Audit
```

consistentemente.

---

# 206. Failure

No debe quedar:

```text
Dispatch CONFIRMED
```

si falló el cambio de disponibilidad/custodia correspondiente.

---

# 207. Return transaction

Similarmente:

```text
receive Return
+
end/update custody
+
move to inspection state
```

debe ser consistente.

---

# 208. Idempotencia

Operaciones críticas:

```text
Confirm Dispatch
Receive Return
Confirm Inspection
Confirm Reconciliation
```

deben soportar retries sin duplicar consecuencias.

---

# 209. Double click

Dos clicks en:

```text
Confirmar salida
```

no deben crear dos Dispatches.

---

# 210. Network retry

Una respuesta perdida del servidor tampoco debe provocar duplicación al repetir la operación.

---

# 211. Concurrencia

Dos usuarios pueden intentar despachar la misma unidad simultáneamente.

---

# 212. Ejemplo

```text
Available: 1

User A
→ Dispatch CASE-01

User B
→ Dispatch CASE-02
```

solo uno puede obtener esa unidad física.

---

# 213. Requisito

La futura implementación debe usar controles de concurrencia adecuados en Inventory/Custody.

---

# 214. Serial concurrency

Para seriales y Equipment es todavía más claro:

```text
SN-001
```

no puede estar simultáneamente bajo dos custodias incompatibles.

---

# 215. Audit

Eventos candidatos:

```text
dispatch.created
dispatch.confirmed
dispatch.corrected

custody.started
custody.acknowledged
custody.ended

return.received

inspection.completed

reconciliation.updated
reconciliation.completed
reconciliation.exception_detected
reconciliation.exception_resolved
```

---

# 216. Audit vs Ledger

Debe distinguirse:

```text
Audit
→ quién hizo qué
```

```text
Custody / Inventory Ledger
→ qué ocurrió físicamente
```

---

# 217. No sustituir ledger con logs

Los application logs no constituyen cadena de custodia.

---

# 218. Immutability

Los hechos confirmados deben preservarse.

Correcciones deben crear evidencia adicional.

---

# 219. Timestamps

Acciones críticas deben conservar timestamps del servidor.

---

# 220. Actor

Debe utilizarse la identidad autenticada.

No texto:

```text
"Juan"
```

cuando existe un User identificable.

---

# 221. Notes

Notes complementan.

No reemplazan campos de:

```text
quantity
batch
serial
responsible
status
```

---

# 222. Search

Debe ser posible localizar operaciones por:

```text
Case folio
Dispatch folio
Doctor
Hospital
Technician
Product
Batch
Serial
Equipment
```

cuando los permisos lo permitan.

---

# 223. Filters

Warehouse puede necesitar:

```text
Awaiting Dispatch
Active Custody
Expected Return
Inspection Pending
Reconciliation Pending
Unresolved
```

---

# 224. Overdue Custody

Puede existir una señal cuando:

```text
Case ended
+
material still in custody
```

---

# 225. No auto-loss

Que el retorno esté retrasado no significa automáticamente que el material esté perdido.

---

# 226. Alert

Puede mostrarse:

```text
Return overdue
```

hasta resolución.

---

# 227. Notifications futuras

Candidatos:

```text
Case starts soon and Dispatch pending
Material still in custody after Case
Return received pending inspection
Reconciliation unresolved
Equipment overdue
```

---

# 228. Dashboard

Healthcare Dashboard puede mostrar:

```text
Active Custody
Pending Returns
Pending Inspections
Pending Reconciliation
Unresolved Incidents
```

---

# 229. Warehouse Dashboard

Puede priorizar:

```text
qué debe hacerse ahora
```

en lugar de métricas abstractas.

---

# 230. Reporting futuro

Case Logistics permitirá analizar:

```text
dispatch volume
return delays
unresolved frequency
damaged returns
unused material
Technician custody duration
```

---

# 231. Cuidado con métricas

No debe asumirse automáticamente que:

```text
high returned quantity
=
bad performance
```

porque material backup puede ser parte normal de la operación.

---

# 232. CURRENT

Actualmente:

```text
CaseDispatch
CaseReturn
Inspection
Reconciliation
Custody
```

son diseños de dominio documentados.

No existe evidencia actual de implementación Healthcare de:

```text
Prisma models
migration
backend
API
frontend
custody ledger
location tracking
reconciliation engine
```

---

# 233. TARGET — Fase 1

La primera implementación debería resolver:

```text
CaseKit PREPARED
↓
Confirm Dispatch
↓
Identify Responsible Technician
↓
Active Custody
↓
Receive Return
↓
Inspect Returned Material
↓
Record Used / Returned / Unresolved
↓
Reconcile
↓
Close Logistics
```

---

# 234. TARGET — Fase 2

Posteriormente:

```text
multiple Dispatches
multiple Returns
serial tracking
Equipment integration
incidents
commercial fulfillment integration
advanced Warehouse Operations
```

---

# 235. TARGET transversal

Antes de producción debe resolverse adecuadamente:

```text
Inventory location / custody / availability
```

para impedir doble asignación de existencia.

---

# 236. FUTURE

Capacidades futuras:

```text
QR scanning
mobile custody confirmation
electronic signatures
photos
advanced incident workflow
warehouse staging locations
real-time notifications
route/transport tracking
advanced analytics
AI anomaly detection
```

---

# 237. AI futuro

AI podría detectar:

```text
This Case normally returns 5 units.
Only 3 have been registered.
```

como señal.

No debe inventar automáticamente la disposición faltante.

---

# 238. External signatures

Una futura firma electrónica puede confirmar entrega/recepción.

Debe evaluarse conforme a requisitos jurídicos y operativos reales.

---

# 239. Invariantes principales

```text
CaseDispatch
≠
CaseKit
```

```text
CaseDispatch
≠
Sales Delivery
```

```text
CaseDispatch
≠
Commercial Inventory OUT
```

```text
Dispatch CONFIRMED
→ custody begins
```

```text
Confirmed Dispatch
→ historical physical fact
```

```text
Confirmed Dispatch
→ not silently editable
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
Physical Return
→ may require Inspection
```

```text
Dispatched
=
Used + Returned + Unresolved
```

```text
Unresolved
→ not automatically Used
```

```text
Returned and Damaged
→ Returned, not Unresolved
```

```text
Used
≠
Invoice
```

```text
Used
≠
automatically Sale
```

```text
Equipment use
≠
Equipment consumption
```

```text
Case cancellation
→ does not destroy active custody
```

```text
Same physical unit
→ cannot have incompatible simultaneous custody
```

```text
Same physical inventory
→ must never be decremented twice
```

```text
Company A logistics
→ never references Company B resources
```

---

# 240. Anti-patrones

## Dispatch = Sale

Convertir toda salida quirúrgica en venta definitiva.

---

## Dispatch decrements and Delivery decrements again

Descontar dos veces la misma unidad.

---

## One stock number for everything

Intentar representar:

```text
warehouse
custody
inspection
available
```

con una sola cantidad sin semántica adicional.

---

## Return = Available

Reintegrar automáticamente material al stock vendible.

---

## Missing = Used

Clasificar diferencias como consumo para cuadrar.

---

## Damaged = Missing

Perder la información de que la unidad sí regresó físicamente.

---

## Edit confirmed Dispatch

Cambiar cantidades históricas después de la salida.

---

## Delete confirmed Dispatch

Eliminar evidencia de custodia.

---

## One Dispatch per Case forever

Impedir salidas adicionales reales.

---

## One Return per Case forever

Impedir retornos parciales.

---

## Free-text batch

Guardar:

```text
"Lote ABC"
```

cuando existe InventoryBatch identificable.

---

## Equipment as Product quantity only

Perder identidad física y custodia del activo.

---

## PDF as inventory source

Confiar en una hoja generada como única fuente de trazabilidad.

---

## Application logs as custody ledger

Intentar reconstruir cadena de custodia desde logs técnicos.

---

## Case completion while custody remains

Cerrar operación aunque material/equipos continúen pendientes.

---

## Invoice controls physical truth

No registrar consumo porque todavía falta información de facturación.

---

# 241. Relación con Healthcare Case

```text
Case
→ contexto operacional
```

Case Logistics registra lo que ocurrió físicamente durante ese Case.

---

# 242. Relación con CaseKit

```text
CaseKit
→ what was prepared
```

```text
Dispatch
→ what actually left
```

---

# 243. Relación con Case Calendar

Calendar puede mostrar señales como:

```text
Dispatch pending
Return pending
Reconciliation pending
```

sin gobernar Logistics.

---

# 244. Relación con Equipment

Equipment aporta identidad y lifecycle de los activos reutilizables.

Case Logistics controla su transferencia de custodia dentro del Case.

---

# 245. Relación con Inventory

Inventory debe conservar la verdad física general de:

```text
ownership
quantity
location
availability
batch
serial
```

según su evolución.

---

# 246. Relación con Sales

Sales mantiene:

```text
SalesOrder
Delivery
commercial fulfillment
```

Healthcare conserva:

```text
CaseDispatch
Custody
Reconciliation
```

---

# 247. Relación con Returns

ERP Returns continúa administrando:

```text
Customer / Sales Return
```

No debe reutilizarse para CaseReturn.

---

# 248. Relación con Audit

Audit registra actor y acción.

No sustituye los documentos logísticos.

---

# 249. Relación con Warehouse Operations

Warehouse Operations puede orquestar todas estas capacidades en una experiencia task-oriented.

---

# 250. ADR relacionados

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

# 251. Documentos relacionados

```text
modules/healthcare/HEALTHCARE.md
modules/healthcare/CASES.md
modules/healthcare/CASE_CALENDAR.md
modules/healthcare/CASE_KITS.md
modules/healthcare/EQUIPMENT.md

modules/erp/PRODUCTS.md
modules/erp/INVENTORY.md
modules/erp/SALES.md
modules/erp/RETURNS.md

engineering/SECURITY_PRINCIPLES.md
engineering/API_GUIDELINES.md
product/ZAPING_WAY.md
```

---

# 252. Fuente de verdad

```text
CASE_LOGISTICS.md
→ Dispatch / Custody / Return / Inspection / Reconciliation

CASE_KITS.md
→ Preparation

CASES.md
→ Case lifecycle

EQUIPMENT.md
→ reusable asset lifecycle

INVENTORY.md
→ inventory physical truth

SALES.md
→ commercial fulfillment

RETURNS.md
→ commercial Customer Returns

ADR-013
→ custody architecture decision

PROJECT_BOARD.md
→ implementation status

schema.prisma
→ technical model when approved
```

---

# 253. Decisiones pendientes antes de Prisma

Antes de crear modelos como:

```text
CaseDispatch
CaseDispatchItem
CaseReturn
CaseReturnItem
Inspection
Reconciliation
```

debemos resolver:

```text
Inventory location/custody representation

Company-owned vs available quantity

Dispatch lifecycle final

Return lifecycle final

Inspection model

Reconciliation persistence vs derivation

reported Used vs confirmed Used

multiple Dispatch / Return relationships

batch allocation model

serial tracking model

Equipment integration

incident model

commercial disposition linkage

Delivery integration

idempotency strategy

correction/reversal strategy
```

---

# 254. Decisión especialmente crítica

Antes de implementar Dispatch debemos responder técnicamente:

> **¿Cómo deja de estar disponible una unidad en Warehouse y pasa a Technician Custody sin representar una salida definitiva de la Company?**

Esa respuesta debe quedar clara antes de escribir la migración Healthcare.

---

# 255. Segunda decisión crítica

También debemos responder:

> **Cuando una unidad utilizada genera una Delivery, ¿qué transición de inventario ocurre para registrar la disposición definitiva sin volver a descontar la misma unidad?**

---

# 256. Tercera decisión crítica

Y:

> **¿Cómo regresa una unidad físicamente sin convertirse automáticamente en disponible hasta completar la inspección requerida?**

---

# 257. Principio final

Case Logistics debe conservar cinco verdades diferentes:

```text
Prepared
↓
qué estaba listo para salir

Dispatched
↓
qué realmente salió

Custody
↓
quién tiene físicamente el recurso

Returned
↓
qué realmente regresó

Reconciled
↓
qué ocurrió finalmente con todo lo despachado
```

y después permitir que otros dominios determinen:

```text
Inventory availability
Commercial fulfillment
Billing
Equipment lifecycle
```

sin duplicar ni falsificar el hecho físico.

> **La cadena de custodia debe poder explicar cada unidad desde que abandona Warehouse hasta que regresa, se consume o se resuelve formalmente, sin confundir movimiento físico temporal con venta ni descontar dos veces el mismo inventario.**
