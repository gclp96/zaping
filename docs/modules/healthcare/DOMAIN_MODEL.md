# Healthcare Domain Model — Zaping

**Producto:** Zaping Healthcare
**Documento:** Modelo de dominio transversal
**Versión:** 1.0.0
**Estado:** Aprobado
**Estado de implementación:** DOMAIN FOUNDATION / NOT IMPLEMENTED
**Última actualización:** 2026-08-20
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Este documento consolida el modelo de dominio descubierto en:

```text
HEALTHCARE.md
OPPORTUNITIES.md
CASES.md
CASE_CALENDAR.md
CASE_KITS.md
CASE_LOGISTICS.md
EQUIPMENT.md
DOCTORS_HOSPITALS.md
```

Su objetivo es definir antes de Prisma:

```text
qué entidades existen
qué conceptos no deben convertirse en entidades
qué módulo posee cada concepto
cómo se relacionan
qué información es derivada
qué decisiones técnicas siguen pendientes
```

---

# 2. Principio arquitectónico

Zaping Healthcare debe construirse como vertical sobre ERP Core.

```text
ERP Core
│
├── Identity
├── Customers
├── Products
├── Inventory
├── Purchases
├── Sales
└── Assets / Equipment target
        ↑
        │
Healthcare
│
├── Doctors
├── Hospitals
├── Opportunities
├── Cases
├── Case Kits
├── Case Logistics
└── Case Equipment Usage
```

La dependencia correcta es:

```text
Healthcare
↓ uses
ERP Core
```

No:

```text
ERP Core
↓ depends on
Healthcare
```

---

# 3. Resultado de la revisión transversal

Los ocho documentos Healthcare son conceptualmente compatibles.

Se identificaron refinamientos deliberados, no contradicciones.

---

# 4. Refinamiento: READY

`HEALTHCARE.md` utilizó inicialmente:

```text
READY
```

como ejemplo de lifecycle.

`CASES.md` refinó correctamente el concepto.

La decisión consolidada es:

```text
Case Status
≠
Readiness
```

---

# 5. Consecuencia

Un Case puede estar:

```text
Status:
SCHEDULED

Readiness:
NOT_READY
```

Por tanto `READY` no debe introducirse inicialmente como estado principal de `HealthcareCase`.

---

# 6. Refinamiento: Equipment Status

`HEALTHCARE.md` presentó inicialmente estados como:

```text
AVAILABLE
ASSIGNED
IN_CUSTODY
MAINTENANCE
```

`EQUIPMENT.md` refinó correctamente esta idea.

La decisión consolidada es:

```text
Lifecycle
≠
Condition
≠
Assignment
≠
Custody
≠
Availability
```

---

# 7. Refinamiento: CaseKit y Reservation

`CASE_KITS.md` estableció correctamente que:

```text
CaseKit
≠
Inventory OUT
```

y que el modelo actual todavía no garantiza Reservation.

La revisión transversal revela una solución objetivo más precisa:

```text
CaseKit preparation confirmed
↓
internal staging
```

en lugar de:

```text
commercial OUT
```

---

# 8. Refinamiento: Inventory Location

La preparación física de un maletín sí debe dejar de mostrar esas unidades como libremente disponibles para otra operación.

Por tanto el modelo objetivo debe soportar:

```text
Warehouse Available
↓
Case Staging
```

como movimiento interno.

---

# 9. No contradicción

Esto no cambia la regla:

```text
CaseKit PREPARED
≠
Commercial Inventory OUT
```

La refina:

```text
CaseKit PREPARED
→ may produce internal inventory positioning
```

cuando la preparación física es confirmada.

---

# 10. Entidades ERP Core existentes

Healthcare debe reutilizar conceptos Core como:

```text
Company
User
Customer
Product
InventoryBatch
InventoryMovement
Quote
SalesOrder target
Delivery target
Purchase
PurchaseReceipt
```

según disponibilidad de cada módulo.

---

# 11. Nuevas capacidades Core requeridas

La revisión identifica como capacidades transversales:

```text
InventoryLocation
InventoryPosition
Internal Inventory Transfer

EquipmentAsset
```

o conceptos técnicos equivalentes.

---

# 12. InventoryLocation

`InventoryLocation` debe representar un lugar lógico o físico donde puede encontrarse inventario propiedad de la Company.

Tipos conceptuales pueden incluir:

```text
WAREHOUSE
CASE_STAGING
USER_CUSTODY
INSPECTION
QUARANTINE
DAMAGED
```

Los valores definitivos requieren ADR.

---

# 13. No confundir con Multi-Warehouse

Agregar posiciones internas no implica necesariamente implementar inmediatamente:

```text
multiple commercial warehouses
```

La primera necesidad es representar:

```text
dónde se encuentra el inventario
```

dentro de la operación.

---

# 14. InventoryPosition

Debe existir una forma confiable de responder:

```text
Product A
Lot L001

Warehouse:          10
Case Staging:        3
Technician Custody:  2
Inspection:          1
```

sin reducir todo a:

```text
Product.stock
```

---

# 15. Product.stock

`Product.stock` puede continuar temporalmente como:

```text
company-owned aggregate projection
```

mientras las posiciones determinan:

```text
where that stock is
```

---

# 16. Invariante de posición

Conceptualmente:

```text
Company-owned stock
=
sum of company-owned inventory positions
```

excepto cualquier categoría formalmente excluida por la política futura.

---

# 17. Internal Transfer

Debe existir semántica para:

```text
Location A
↓
Location B
```

sin modificar el total propiedad de la Company.

---

# 18. Diferencia

```text
IN
→ inventory enters Company ownership
```

```text
TRANSFER
→ inventory changes internal position/custody
```

```text
OUT
→ inventory leaves Company ownership / definitive availability
```

---

# 19. Flujo físico objetivo

Para un consumible Healthcare:

```text
Supplier / External
↓
Purchase Receipt
↓ IN
Warehouse Available
↓ TRANSFER
Case Staging
↓ TRANSFER
Technician Custody
```

Después existen dos caminos principales.

---

# 20. Camino Returned

```text
Technician Custody
↓ TRANSFER
Inspection
↓ TRANSFER after approval
Warehouse Available
```

---

# 21. Camino Used

```text
Technician Custody
↓
Used
↓
Commercial / other final disposition
↓ OUT
External / consumed
```

---

# 22. Beneficio

Esta arquitectura evita:

```text
Dispatch
→ OUT

Delivery
→ OUT again
```

---

# 23. Regla crítica

Para material Healthcare:

> **Dispatch es un TRANSFER interno; la disposición definitiva produce el OUT.**

---

# 24. Case Staging

`CASE_STAGING` representa material físicamente separado/preparado para un Case.

---

# 25. Preparación

Mientras CaseKit está:

```text
DRAFT
IN_PREPARATION
```

seleccionar productos no necesita producir inmediatamente un movimiento físico.

---

# 26. Confirm Preparation

Al confirmar físicamente la preparación:

```text
Warehouse
↓
Case Staging
```

puede convertirse en la operación que garantiza que esas unidades dejan de estar disponibles para otros workflows.

---

# 27. Consecuencia

Esto puede eliminar inicialmente la necesidad de un sistema abstracto de Reservation para el material ya físicamente preparado.

---

# 28. Reservation futura

Reservation sigue siendo útil para:

```text
stock promised
but not physically staged yet
```

y puede diseñarse posteriormente.

---

# 29. InventoryLocation ownership

`InventoryLocation` pertenece a ERP Core.

Healthcare puede crear/utilizar ubicaciones especializadas sin que Inventory conozca `HealthcareCase` como dependencia obligatoria.

---

# 30. Ejemplo de dependencia limpia

Healthcare:

```text
CaseKit
├── caseId
└── stagingLocationId
```

Inventory:

```text
InventoryLocation
└── id
```

Inventory no necesita:

```text
healthcareCaseId
```

para conocer la ubicación.

---

# 31. Technician

La revisión concluye que no existe todavía una necesidad suficiente para crear una identidad separada:

```text
HealthcareTechnician
```

---

# 32. Decisión inicial

```text
Technician
→ User acting in Healthcare
```

---

# 33. Case Technician

Conceptualmente:

```text
HealthcareCase
└── technicianUserId?
```

---

# 34. Custodian

También:

```text
CaseDispatch
└── custodianUserId
```

---

# 35. Razón

Esto evita:

```text
User Carlos
+
Technician Carlos
```

como identidades duplicadas.

---

# 36. Role no es identidad

Que Technician utilice `User` no significa introducir inmediatamente:

```text
UserRole.TECHNICIAN
```

---

# 37. Authorization

La autorización deberá evolucionar mediante roles/permisos.

La responsabilidad operacional puede existir independientemente del enum actual de `UserRole`.

---

# 38. Healthcare Technician Profile futuro

Si posteriormente se necesitan atributos como:

```text
certifications
territory
specialties
availability rules
```

puede agregarse:

```text
HealthcareTechnicianProfile
↓
User
```

sin duplicar la identidad principal.

---

# 39. Doctors

Healthcare necesita:

```text
HealthcareDoctor
```

como Master Data tenant-scoped.

---

# 40. Hospitals

Healthcare necesita:

```text
HealthcareHospital
```

como Master Data tenant-scoped.

---

# 41. Doctor-Hospital

La cardinalidad aprobada es:

```text
HealthcareDoctor
N
↕
N
HealthcareHospital
```

mediante una relación explícita.

---

# 42. Entidad candidata

```text
DoctorHospitalAffiliation
```

---

# 43. Hospital en primera versión

Hospital representa:

> **la sede física/operacional donde ocurre el Healthcare Case.**

---

# 44. Future

Si posteriormente aparecen organizaciones con múltiples sedes:

```text
HealthcareOrganization
↓
HealthcareFacility
```

podrá introducirse sin redefinir Customer.

---

# 45. Doctor ownership

Primera implementación:

```text
HealthcareDoctor
→ Company-scoped
```

---

# 46. Hospital ownership

También:

```text
HealthcareHospital
→ Company-scoped
```

---

# 47. No directorio global

No se implementará inicialmente un catálogo global compartido de Doctors/Hospitals entre tenants.

---

# 48. Healthcare Opportunity

Entidad Healthcare.

Responsabilidad:

```text
commercial possibility before concrete operation
```

---

# 49. Relaciones principales Opportunity

Conceptualmente:

```text
HealthcareOpportunity
├── company
├── responsibleUser?
├── doctor?
├── hospital?
├── customer?
└── Cases
```

---

# 50. Opportunity → Case

La relación debe soportar conceptualmente:

```text
1 Opportunity
→ N Cases
```

aunque la primera UX normalmente produzca un Case inicial.

---

# 51. Razón

No conviene imponer en base de datos:

```text
Opportunity
→ exactly one Case forever
```

sin necesidad.

---

# 52. Opportunity conversion

Se considera convertida cuando existe al menos una operación acordada según el workflow aprobado.

---

# 53. Quote links

Opportunity puede originar Quotes.

Pero no se recomienda agregar:

```text
healthcareOpportunityId
```

a todas las entidades Core únicamente por Healthcare.

---

# 54. Direction of dependency

Healthcare puede mantener una relación/link hacia documentos Core.

Core no debería necesitar campos Healthcare para funcionar.

---

# 55. Commercial Link

La representación exacta de:

```text
Opportunity ↔ Quote
Case ↔ SalesOrder
Case ↔ Delivery
```

se definirá durante la integración comercial.

---

# 56. No generic polymorphic links todavía

No crear prematuramente:

```text
DocumentLink
referenceType
referenceId
```

como solución universal sin integridad referencial.

---

# 57. Healthcare Case

`HealthcareCase` es el agregado operacional principal de la vertical.

---

# 58. Relaciones principales Case

Conceptualmente:

```text
HealthcareCase
├── Company
├── Opportunity?
├── Doctor?
├── Hospital?
├── Technician User?
├── Customer?
├── Schedule
├── CaseKit
├── Dispatches
├── Returns
└── Reconciliation state
```

---

# 59. Payer

Payer continúa siendo una frontera real del dominio.

Pero la revisión confirma que su identidad definitiva todavía no está suficientemente diseñada.

---

# 60. Decisión

No introducir todavía:

```text
HealthcarePayer
InsuranceCompany
BusinessParty
```

dentro del primer schema Healthcare únicamente para cerrar esta incertidumbre.

---

# 61. Razón

Payer interactuará posteriormente con:

```text
Billing
Invoice
Insurance
Customer
Hospital
Government entities
```

y merece un diseño específico.

---

# 62. Regla

Payer queda:

```text
DOMAIN RECOGNIZED
IMPLEMENTATION DEFERRED
```

---

# 63. No inferencia

Mientras tanto:

```text
Hospital
Customer
Doctor
```

no deben utilizarse automáticamente como Payer.

---

# 64. Case Status

Lifecycle conceptual consolidado:

```text
DRAFT
SCHEDULED
IN_PROGRESS
RECONCILIATION_PENDING
COMPLETED
CANCELLED
```

---

# 65. Case Readiness

Readiness debe ser inicialmente:

```text
DERIVED
```

---

# 66. No Readiness table

No crear inicialmente:

```text
HealthcareCaseReadiness
```

ni guardar manualmente:

```text
case.readiness = READY
```

como fuente independiente.

---

# 67. Readiness inputs

Puede derivarse de:

```text
schedule
Doctor/Hospital context
Technician
CaseKit
Equipment
blockers
```

según las reglas aprobadas.

---

# 68. Calendar

`Case Calendar` no necesita tabla.

---

# 69. Calendar

Es:

```text
HealthcareCase
+
schedule
+
readiness
+
conflicts
=
Calendar Read Model
```

---

# 70. No CalendarEvent Healthcare

No crear inicialmente:

```text
HealthcareCalendarEvent
```

solo para copiar `scheduledStart` y `scheduledEnd`.

---

# 71. KitTemplate

Entidad Healthcare tenant-scoped.

---

# 72. KitTemplate structure

Conceptualmente:

```text
KitTemplate
└── KitTemplateItem[]
```

---

# 73. Template item

Relaciona:

```text
Product
default quantity
required/optional
notes
```

---

# 74. CaseKit

Entidad Healthcare asociada a un Case.

Primera cardinalidad recomendada:

```text
HealthcareCase
1
↓
0..1
CaseKit
```

---

# 75. Razón

Un CaseKit lógico puede contener múltiples:

```text
boxes
maletines
equipment
```

sin requerir múltiples agregados inicialmente.

---

# 76. CaseKit Items

Conceptualmente:

```text
CaseKit
└── CaseKitItem[]
```

---

# 77. CaseKitItem responsibility

Debe representar:

```text
requested Product
requested quantity
required/optional context
substitution context
```

---

# 78. Prepared quantity

No conviene crear varias fuentes de verdad.

Cuando exista staging real:

```text
prepared quantity
```

puede derivarse de las asignaciones/posiciones efectivamente movidas a `CASE_STAGING`.

---

# 79. Stock Allocation

La implementación necesitará una asociación entre:

```text
CaseKitItem
```

y:

```text
Product
Batch
Quantity
Inventory Position
```

---

# 80. Nombre técnico pendiente

Puede terminar como:

```text
CaseKitStockAllocation
```

o equivalente.

No se aprueba todavía el nombre Prisma.

---

# 81. Batch

La asignación debe conservar `InventoryBatch` cuando aplique.

---

# 82. Serial

Serial tracking requiere primero una representación Core de unidad individual.

No debe improvisarse únicamente dentro de CaseKit.

---

# 83. Equipment Requirement

Los requerimientos Equipment no deberían confundirse con `CaseKitItem` de cantidad.

---

# 84. Razón

```text
Product A × 5
```

y:

```text
EquipmentAsset EQ-0041
```

tienen semánticas diferentes.

---

# 85. Case Equipment Assignment

La vertical necesita una asociación explícita:

```text
HealthcareCase
↔
EquipmentAsset
```

---

# 86. Entidad candidata

```text
CaseEquipmentAssignment
```

---

# 87. Ownership

```text
EquipmentAsset
→ ERP Core target

CaseEquipmentAssignment
→ Healthcare
```

---

# 88. EquipmentAsset como Core

La revisión concluye que:

```text
identity
assetCode
serial
condition
location
availability
history
```

no son conceptos exclusivamente médicos.

---

# 89. Decisión arquitectónica preliminar

`EquipmentAsset` debe diseñarse como capacidad transversal del ERP Core.

Healthcare será su primer consumidor especializado.

---

# 90. Healthcare-specific Equipment

Permanecen en Healthcare:

```text
Case assignment
Case readiness contribution
Case Dispatch context
Healthcare Case history
```

---

# 91. Equipment lifecycle

Lifecycle y condition deben mantenerse separados.

---

# 92. Equipment availability

Debe ser derivada, no un status manual independiente.

---

# 93. CaseDispatch

Entidad Healthcare.

Representa:

```text
physical transfer
Case Staging / Warehouse
↓
Technician Custody
```

---

# 94. Dispatch cardinality

```text
HealthcareCase
1
↓
N
CaseDispatch
```

---

# 95. Multiple Dispatches

La cardinalidad N es necesaria para material adicional.

---

# 96. Dispatch Item

Para Products cuantificables:

```text
CaseDispatch
└── CaseDispatchItem[]
```

---

# 97. Dispatch Equipment

Para Equipment individualizado conviene no mezclarlo mediante nullable fields con productos cuantitativos.

Conceptualmente:

```text
CaseDispatch
└── CaseDispatchAsset[]
```

---

# 98. Razón

Evita estructuras ambiguas como:

```text
productId?
equipmentAssetId?
quantity?
```

en un único registro que representa dos tipos de recurso diferentes.

---

# 99. Dispatch confirmed

Produce:

```text
Inventory TRANSFER
Case Staging / Warehouse
↓
User Custody
```

para consumibles.

---

# 100. Equipment Dispatch

Produce cambio de:

```text
Equipment location / custody
```

sin consumo del activo.

---

# 101. Custody

No se recomienda inicialmente crear una tabla Healthcare independiente:

```text
CaseCustody
```

si la combinación de:

```text
Inventory Positions
Internal Transfers
Dispatch
Equipment location
Custodian
```

puede reconstruir la verdad.

---

# 102. Regla

No convertir cada concepto del lenguaje de dominio en una tabla.

---

# 103. CaseReturn

Entidad Healthcare.

Cardinalidad:

```text
HealthcareCase
1
↓
N
CaseReturn
```

---

# 104. Return Item

Para Product:

```text
CaseReturn
└── CaseReturnItem[]
```

cada item debe mantener referencia al Dispatch Item correspondiente.

---

# 105. Return Asset

Para Equipment:

```text
CaseReturn
└── CaseReturnAsset[]
```

con referencia al activo despachado.

---

# 106. Return movement

Para consumibles:

```text
Technician Custody
↓ TRANSFER
Inspection
```

---

# 107. Return does not restore availability

No se realiza:

```text
Technician Custody
↓
Warehouse Available
```

directamente cuando Inspection sea requerida.

---

# 108. Inspection

`Inspection` es un concepto real.

Pero la revisión todavía no exige necesariamente una tabla global:

```text
Inspection
```

---

# 109. Primera implementación posible

La información de inspección puede pertenecer inicialmente a:

```text
CaseReturnItem
CaseReturnAsset / Equipment inspection record
```

si mantiene correctamente:

```text
result
actor
timestamp
notes
```

---

# 110. Extraer entidad cuando sea necesario

Si aparecen:

```text
multiple inspections
inspection workflow
different reviewers
inspection documents
```

entonces una entidad `Inspection` separada tendrá justificación.

---

# 111. Returned disposition

Después de Inspection:

```text
AVAILABLE
→ transfer to Warehouse Available
```

```text
QUARANTINE
→ transfer/remain in Quarantine
```

```text
DAMAGED
→ Damaged position / workflow
```

---

# 112. Case Consumption

Para representar material utilizado necesitamos un hecho separado de Return.

---

# 113. Entidad candidata

```text
CaseConsumption
```

o un nombre funcional equivalente.

---

# 114. Responsibility

Representa:

```text
Dispatch Item
↓
quantity actually consumed / used
```

---

# 115. Por qué no guardar solamente `usedQuantity`

Un hecho de consumo debe poder conservar:

```text
source Dispatch Item
quantity
actor
timestamp
correction history
commercial linkage future
```

---

# 116. CaseConsumption

Conceptualmente:

```text
CaseConsumption
├── companyId
├── caseId
├── dispatchItemId
├── quantity
├── recordedBy
├── recordedAt
└── commercial linkage future
```

---

# 117. Equipment no utiliza CaseConsumption

El Equipment reutilizable:

```text
participated in Case
```

pero normalmente no fue consumido.

Su uso se deriva de Assignment/Dispatch/Return history.

---

# 118. Returned Quantity

Debe derivarse de:

```text
CaseReturnItem
```

---

# 119. Used Quantity

Debe derivarse de:

```text
CaseConsumption
```

---

# 120. Unresolved Quantity

Debe derivarse:

```text
Unresolved
=
Dispatched
-
Consumed
-
Returned
```

---

# 121. No columna manual `unresolvedQuantity`

Preferencia inicial:

```text
Unresolved
→ derived fact
```

---

# 122. Beneficio

Evita inconsistencias como:

```text
Dispatched = 10
Used = 4
Returned = 5
Unresolved stored = 0
```

---

# 123. Reconciliation

Reconciliation es un proceso/agregado de validación, pero no necesita duplicar todas las cantidades.

---

# 124. Entidad candidata

Puede existir:

```text
CaseReconciliation
```

como confirmación del cierre logístico.

---

# 125. CaseReconciliation responsibility

Puede conservar:

```text
caseId
status / confirmation
confirmedBy
confirmedAt
notes
```

mientras sus cantidades se calculan desde hechos físicos.

---

# 126. Invariante

La reconciliación normal solo puede confirmarse cuando:

```text
for every Dispatch Item:

Dispatched
=
Consumed
+
Returned
```

si:

```text
Unresolved = 0
```

---

# 127. Exception workflow

Si existe diferencia:

```text
Unresolved > 0
```

el Case permanece pendiente o genera una excepción/incidente.

---

# 128. LogisticsIncident

Es una entidad candidata para una fase posterior.

No es indispensable para el primer schema si los pendientes pueden permanecer abiertos de forma segura.

---

# 129. Primera implementación

Puede comenzar con:

```text
Unresolved derived
+
reconciliation pending
+
notes
```

---

# 130. Incident entity

Debe agregarse cuando necesitemos lifecycle formal para:

```text
investigation
responsible
resolution
loss
damage
adjustment
```

---

# 131. Commercial disposition

`CaseConsumption` registra verdad operacional.

No significa automáticamente:

```text
Sale
Delivery
Invoice
```

---

# 132. Sales integration objetivo

Cuando un consumo sea comercial:

```text
CaseConsumption
↓
DeliveryItem
```

debe existir una relación explícita.

---

# 133. Out location

El `Inventory OUT` definitivo debe originarse desde la posición donde realmente se encuentra la unidad:

```text
Technician Custody
↓ OUT
External / consumed
```

---

# 134. No Warehouse OUT ficticio

No debe generarse:

```text
Warehouse
↓ OUT
```

para una unidad que salió del Warehouse horas antes y actualmente está bajo Technician Custody.

---

# 135. Beneficio

La historia física queda:

```text
Warehouse
↓ Transfer
Staging
↓ Transfer
Technician
↓ OUT
Consumed
```

---

# 136. Commercial link ownership

La relación con `DeliveryItem` puede residir en Healthcare.

Así Core Sales no necesita saber que todos sus Deliveries provienen de Healthcare.

---

# 137. Normal Sales

Sigue funcionando:

```text
Warehouse
↓ OUT
Delivery
```

---

# 138. Healthcare Sales

Puede funcionar:

```text
Technician Custody
↓ OUT
Delivery
```

para material previamente despachado internamente.

---

# 139. Same Delivery domain

Ambos siguen utilizando:

```text
ERP Delivery
```

No se crea `HealthcareDelivery`.

---

# 140. Source location

Esto implica que el futuro Delivery deberá poder determinar:

```text
from which Inventory Location
```

sale cada unidad.

---

# 141. Impacto Core

Por tanto Healthcare descubre una mejora general útil para Sales:

```text
Delivery
→ fulfillment from inventory position
```

no únicamente:

```text
Product.stock -= quantity
```

---

# 142. Inventory Movement target

La revisión sugiere evolucionar conceptualmente `InventoryMovement` para soportar:

```text
movement type
product
batch?
quantity

fromLocation?
toLocation?

referenceType
referenceId

actor
timestamp
```

---

# 143. Movement semantics

```text
IN
fromLocation = null
toLocation = Warehouse
```

```text
TRANSFER
fromLocation = A
toLocation = B
```

```text
OUT
fromLocation = current location
toLocation = null / external
```

---

# 144. Adjustment

```text
ADJUSTMENT
```

debe conservar reglas explícitas para correcciones.

---

# 145. Ledger

Confirmed movements continúan siendo:

```text
immutable historical facts
```

según ADR-002.

---

# 146. InventoryPosition

Es una proyección derivable del ledger.

Puede persistirse por rendimiento siempre que:

```text
ledger
→ source of truth
```

se mantenga.

---

# 147. Company stock

`Product.stock` también puede continuar como proyección agregada durante transición.

---

# 148. Migration strategy

No debemos migrar de:

```text
Product.stock
```

a nuevas posiciones en una sola modificación improvisada.

---

# 149. Fase técnica necesaria

Antes de Healthcare Dispatch:

```text
Inventory Location Foundation
↓
Position / Transfer semantics
↓
Existing Receipt integration
↓
Existing Sales integration
↓
Healthcare staging/custody
```

---

# 150. Purchase Receipt

Target:

```text
Purchase Receipt
↓ IN
Default Warehouse Location
```

---

# 151. Normal Delivery

Target:

```text
Warehouse Location
↓ OUT
Customer
```

---

# 152. Healthcare Preparation

Target:

```text
Warehouse Location
↓ TRANSFER
Case Staging
```

---

# 153. Healthcare Dispatch

Target:

```text
Case Staging
↓ TRANSFER
Technician Custody
```

---

# 154. Healthcare Return

Target:

```text
Technician Custody
↓ TRANSFER
Inspection
```

---

# 155. Inspection pass

Target:

```text
Inspection
↓ TRANSFER
Warehouse Available
```

---

# 156. Used material

Target:

```text
Technician Custody
↓ OUT
Commercial / final disposition
```

---

# 157. EquipmentAsset

Equipment puede utilizar la misma taxonomía de Locations.

---

# 158. Pero no necesariamente InventoryPosition quantity

Un EquipmentAsset es una unidad individual.

Puede almacenar/derivar:

```text
currentLocation
currentCustodian
```

a partir de su propio historial de movimientos.

---

# 159. Asset Movement

Puede ser necesario posteriormente:

```text
EquipmentAssetMovement
```

o reutilizar una infraestructura genérica de movimientos.

---

# 160. No decidir premature unificación

No debemos forzar Products cuantitativos y Assets individuales al mismo modelo si eso vuelve ambos más complejos.

---

# 161. Domain ownership consolidado

La dirección recomendada es:

```text
ERP CORE

Company
User
Customer
Product
InventoryBatch
InventoryMovement
InventoryLocation        TARGET
InventoryPosition        TARGET
EquipmentAsset           TARGET
Quote
SalesOrder               TARGET
Delivery                 TARGET
PurchaseReceipt
```

---

# 162. Healthcare ownership consolidado

```text
HEALTHCARE

HealthcareDoctor
HealthcareHospital
DoctorHospitalAffiliation

HealthcareOpportunity

HealthcareCase

KitTemplate
KitTemplateItem

CaseKit
CaseKitItem
CaseKitStockAllocation candidate

CaseEquipmentAssignment

CaseDispatch
CaseDispatchItem
CaseDispatchAsset

CaseReturn
CaseReturnItem
CaseReturnAsset

CaseConsumption

CaseReconciliation candidate
```

---

# 163. Derived / Read Models

No crear inicialmente entidades para:

```text
Case Calendar
Case Readiness
Equipment Availability
Current Custody summary
Unresolved Quantity
Warehouse Operations Dashboard
Healthcare Dashboard
```

---

# 164. Razón

Todos deben componerse desde hechos de dominio.

---

# 165. Relación general

```text
Company
│
├── Users
├── Customers
├── Products
├── Inventory
├── Equipment Assets
│
└── Healthcare
    │
    ├── Doctors
    ├── Hospitals
    │   ↕
    │ Doctors
    │
    ├── Opportunities
    │       ↓
    └── Cases
        │
        ├── CaseKit
        │   ├── Product Requirements
        │   ├── Stock Allocations
        │   └── Equipment Assignments
        │
        ├── Dispatches
        │   ├── Product Items
        │   └── Equipment Assets
        │
        ├── Returns
        │   ├── Product Items
        │   └── Equipment Assets
        │
        ├── Consumption
        │
        └── Reconciliation
```

---

# 166. Healthcare Case relationships

Conceptualmente:

```text
HealthcareOpportunity
        │
        │ optional
        ▼
HealthcareCase
├── Doctor?
├── Hospital?
├── Customer?
├── Technician User?
├── CaseKit
├── Equipment Assignments
├── Dispatches
├── Returns
└── Consumption
```

---

# 167. Doctor/Hospital

```text
HealthcareDoctor
        N
        │
        │ DoctorHospitalAffiliation
        │
        N
HealthcareHospital
```

---

# 168. CaseKit

```text
HealthcareCase
        │
        1
        │
        0..1
        ▼
CaseKit
        │
        N
        ▼
CaseKitItem
        │
        N
        ▼
Stock Allocation
```

---

# 169. Equipment

```text
HealthcareCase
        │
        N
        ▼
CaseEquipmentAssignment
        │
        N:1
        ▼
EquipmentAsset
```

---

# 170. Dispatch products

```text
HealthcareCase
        │
        N
        ▼
CaseDispatch
        │
        N
        ▼
CaseDispatchItem
        │
        ▼
Product / Batch
```

---

# 171. Dispatch assets

```text
CaseDispatch
        │
        N
        ▼
CaseDispatchAsset
        │
        ▼
EquipmentAsset
```

---

# 172. Returns

```text
CaseDispatchItem
        │
        1
        │
        N
        ▼
CaseReturnItem
```

Esto permite partial/multiple Returns.

---

# 173. Consumption

```text
CaseDispatchItem
        │
        1
        │
        N
        ▼
CaseConsumption
```

Esto permite consumos registrados/corregidos mediante hechos explícitos.

---

# 174. Reconciliation equation

Por cada Dispatch Item:

```text
Dispatched Quantity
-
sum(Return Items)
-
sum(Consumption)
=
Unresolved
```

---

# 175. Closure

Normalmente:

```text
Unresolved = 0
+
required inspections completed
+
Equipment custody resolved
=
Logistics Reconciled
```

---

# 176. Case Calendar

Se deriva:

```text
HealthcareCase Schedule
+
Doctor
+
Hospital
+
Technician
+
Readiness
+
Equipment conflicts
```

---

# 177. Readiness

Se deriva conceptualmente:

```text
Case required context
+
CaseKit material state
+
Equipment assignments
+
blocking operational rules
```

---

# 178. Equipment availability

Se deriva:

```text
ACTIVE lifecycle
+
usable condition
+
acceptable location
+
no active custody
+
no incompatible Case assignment
+
no maintenance/calibration blocker
```

---

# 179. No duplicated flags

Evitar simultáneamente:

```text
isAvailable
isAssigned
isInCustody
status
condition
```

cuando puedan contradecirse.

---

# 180. Cross-tenant invariants

Toda relación tenant-owned debe satisfacer:

```text
Company A
=
Company A
```

---

# 181. Ejemplo Case

Nunca:

```text
Case Company A
→ Doctor Company B
```

---

# 182. Ejemplo Product

Nunca:

```text
CaseKit Company A
→ Product Company B
```

---

# 183. Ejemplo Equipment

Nunca:

```text
Case Company A
→ EquipmentAsset Company B
```

---

# 184. Backend authority

Estas invariantes no dependen de filtros frontend.

Backend debe validarlas siempre.

---

# 185. Immutability boundary

Master Data puede actualizarse.

Documentos operacionales confirmados no deben reescribir hechos físicos.

---

# 186. Mutable examples

```text
Doctor phone
Hospital address
Draft CaseKit
Draft Dispatch
```

---

# 187. Immutable/compensated examples

```text
Confirmed Dispatch
Confirmed Inventory Movement
Confirmed Return reception
Definitive consumption
```

requieren corrección/reversal cuando ya produjeron hechos.

---

# 188. Audit

Las acciones críticas deben alimentar Audit cuando esa infraestructura exista.

---

# 189. Audit does not replace domain history

Debe mantenerse:

```text
Audit
≠
Inventory Ledger
≠
Custody History
≠
Case Timeline
```

---

# 190. Primera implementación Healthcare

No debe comenzar por todas las entidades simultáneamente.

La secuencia técnica recomendada es:

```text
Healthcare Master Data
↓
Cases
↓
Inventory Location Foundation
↓
CaseKit / Staging
↓
Equipment Assets
↓
Dispatch / Custody
↓
Return / Inspection
↓
Consumption / Reconciliation
↓
Sales integration
```

---

# 191. Master Data slice

Primera pieza Healthcare implementable:

```text
Doctors
Hospitals
Doctor ↔ Hospital
```

---

# 192. Case slice

Después:

```text
HealthcareCase
+
schedule
+
Technician User
+
Doctor
+
Hospital
+
Calendar
```

sin inventario todavía.

---

# 193. Inventory prerequisite

Antes de CaseKit PREPARED / Dispatch reales:

```text
Inventory Locations
Internal Transfers
Positions
```

deben estar diseñados.

---

# 194. Razón

Sin eso, Healthcare podría mostrar custodia correctamente en UI mientras el ERP permite volver a utilizar la misma existencia.

Eso es inaceptable para producción.

---

# 195. Equipment slice

EquipmentAsset puede desarrollarse en paralelo al Foundation de ubicaciones una vez fijada su frontera Core.

---

# 196. Logistics slice

Solo después:

```text
Dispatch
Return
Inspection
Consumption
Reconciliation
```

---

# 197. Sales integration

La integración con `SalesOrder + Delivery` debe implementarse después de contar con:

```text
source inventory location
```

para cada fulfillment.

---

# 198. No reutilizar Sale legacy como solución final

El flujo legacy:

```text
Sale confirm
→ Inventory OUT
```

no debe convertirse en base permanente de Healthcare Logistics.

---

# 199. Target Sales

Debe respetarse ADR-011:

```text
SalesOrder
↓
Delivery
↓
Inventory OUT
```

---

# 200. Healthcare target

Entonces:

```text
Case Consumption
↓
Delivery
↓
OUT from Technician Custody
```

para consumo comercial.

---

# 201. Documentos que necesitan refinamiento posterior

Después de aprobar la arquitectura de Inventory Locations deberán actualizarse ligeramente:

```text
HEALTHCARE.md
CASE_KITS.md
CASE_LOGISTICS.md
EQUIPMENT.md
modules/erp/INVENTORY.md
architecture/ARCHITECTURE.md
```

---

# 202. Razón

Actualmente estos documentos describen correctamente la necesidad, pero todavía no pueden nombrar una solución técnica aprobada para posiciones internas.

---

# 203. ADR requerido

La siguiente decisión arquitectónica debería documentar:

```text
Inventory Locations
Inventory Positions
Internal Transfers
Custody integration
```

---

# 204. ADR sugerido

```text
ADR-014
Inventory Locations and Internal Transfers
```

---

# 205. ADR-014 deberá decidir

Como mínimo:

```text
InventoryLocation model
location types
default warehouse location
InventoryPosition strategy
TRANSFER semantics
Product.stock relationship
InventoryBatch position
staging behavior
user custody behavior
inspection positions
movement immutability
Receipt integration
Delivery integration
migration strategy
```

---

# 206. Equipment architectural decision

Después debe formalizarse si:

```text
EquipmentAsset
→ ERP Core
```

como la revisión recomienda.

Esto puede integrarse al diseño del módulo Assets/Equipment o requerir otro ADR si modifica fronteras importantes.

---

# 207. Payer

No bloquea ADR-014.

Permanece deliberadamente fuera del primer modelo técnico.

---

# 208. Opportunity

Tampoco bloquea Inventory foundation.

Puede implementarse antes o después del primer Case slice.

---

# 209. Prioridad

La pieza con mayor riesgo técnico actualmente es:

```text
Inventory Location / Custody
```

porque afecta directamente integridad de existencia.

---

# 210. Invariantes consolidadas

```text
Doctor
≠
Hospital
≠
Customer
≠
Payer
```

```text
Technician
→ User initially
```

```text
Opportunity
≠
Case
```

```text
Case Status
≠
Readiness
```

```text
Case Calendar
→ Read Model
```

```text
KitTemplate
≠
CaseKit
```

```text
CaseKit
≠
Dispatch
```

```text
Preparation
≠
Commercial OUT
```

```text
Dispatch
→ Internal Transfer / Custody
```

```text
Dispatch
≠
Delivery
```

```text
Return
≠
Available
```

```text
Used
≠
Invoice
```

```text
Used
≠
automatically commercial Sale
```

```text
Unresolved
→ derived
```

```text
Dispatched
=
Returned + Consumed + Unresolved
```

```text
EquipmentAsset
≠
Product
```

```text
Equipment Assignment
≠
Custody
```

```text
Equipment Return
≠
Availability
```

```text
Availability
→ derived
```

```text
Same physical inventory
→ never decremented twice
```

---

# 211. Anti-patrones consolidados

No crear una tabla para cada palabra del dominio.

No guardar estados derivados cuando pueden calcularse confiablemente.

No crear identidad Technician duplicada sin necesidad.

No agregar campos Healthcare a entidades Core solo para facilitar relaciones.

No utilizar Product.stock como única representación de custodia.

No simular Reservation únicamente en UI.

No convertir Dispatch en Inventory OUT.

No devolver directamente a Available sin Inspection cuando corresponda.

No utilizar un único enum para todas las dimensiones de Equipment.

No introducir Payer/Insurance apresuradamente dentro del Case.

No comenzar Prisma Healthcare antes de definir Inventory Location semantics.

---

# 212. Modelo conceptual final

```text
                         ZAPING ERP CORE
                               │
        ┌──────────────────────┼─────────────────────┐
        │                      │                     │
      User                  Product              Customer
        │                      │
        │                  Inventory
        │             ┌────────┴────────┐
        │          Batch             Location
        │                              │
        │                           Position
        │
        │                  EquipmentAsset
        │                       TARGET
        │
        └──────────────┬──────────────────────────────
                       │
                       ▼
                ZAPING HEALTHCARE
                       │
       ┌───────────────┼────────────────┐
       │               │                │
    Doctor          Hospital       Opportunity
       │               │                │
       └───────↔───────┘                │
                                        ▼
                                      Case
                                        │
              ┌─────────────────────────┼─────────────────────┐
              │                         │                     │
           CaseKit                  Equipment             Calendar
              │                    Assignment           Read Model
              │                         │
          Preparation               Asset
              │
              ▼
           Staging
              │
              ▼
           Dispatch
              │
              ▼
      Technician Custody
              │
        ┌─────┴─────────┐
        │               │
     Return         Consumption
        │               │
   Inspection           │
        │               │
        └──────┬────────┘
               ▼
         Reconciliation
               │
               ▼
      Operational Closure

Consumption
     │
     └────→ Sales Delivery / Final Disposition
```

---

# 213. Fuente de verdad

```text
DOMAIN_MODEL.md
→ mapa transversal de entidades y ownership

HEALTHCARE.md
→ frontera general de Healthcare

DOCTORS_HOSPITALS.md
→ Healthcare Master Data

OPPORTUNITIES.md
→ oportunidad comercial

CASES.md
→ Case lifecycle

CASE_CALENDAR.md
→ read model temporal

CASE_KITS.md
→ preparation

CASE_LOGISTICS.md
→ physical custody

EQUIPMENT.md
→ asset semantics

INVENTORY.md
→ inventory ledger and stock truth

ADR-013
→ custody vs commercial OUT

ADR-014 future
→ Inventory Locations and Internal Transfers
```

---

# 214. Estado actual

Con este documento queda suficientemente definido:

```text
Healthcare domain boundaries
Entity ownership
Core dependencies
Read models
Derived concepts
Physical inventory flow
Implementation order
```

pero todavía no:

```text
Prisma schema
DTOs
API routes
NestJS modules
migration
frontend
```

---

# 215. Próximo paso obligatorio

Antes de diseñar el schema Healthcare:

```text
Create ADR-014
Inventory Locations and Internal Transfers
```

---

# 216. Principio final

El diseño técnico de Healthcare debe conservar la diferencia entre:

```text
business intent
↓
Opportunity

operational commitment
↓
Case

preparation
↓
CaseKit

physical position
↓
Inventory Location

temporary responsibility
↓
Custody

physical consumption
↓
CaseConsumption

commercial fulfillment
↓
Delivery
```

> **Healthcare no necesita más tablas; necesita fronteras correctas. Cada entidad debe representar un hecho propio, cada valor derivado debe permanecer derivado y cada movimiento físico debe poder explicarse sin duplicar stock, ownership ni historia.**
