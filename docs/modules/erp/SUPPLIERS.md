# Suppliers — Zaping ERP

**Módulo:** Suppliers
**Producto:** Zaping ERP Core
**Versión:** 2.2.0
**Estado:** Aprobado
**Estado de implementación:** SUPPLIERS V1 IMPLEMENTED / VALIDATED
**Última actualización:** 2026-08-27
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Suppliers administra el catálogo maestro de proveedores de una Company.

Su responsabilidad principal es responder:

```text
¿Quién suministra a la Company?

¿Cómo podemos contactarlo?

¿Está habilitado para nuevas operaciones?

¿Qué Purchases históricas están relacionadas con él?
```

Supplier representa:

```text
procurement counterpart
+
master-data identity
+
master-data lifecycle
```

No representa una Purchase ni una recepción física.

---

# 2. Ownership

Suppliers es propietario de información maestra como:

```text
name

contactName

email

phone

address

notes

isActive

tenant ownership
```

No es propietario de:

```text
Purchase lifecycle

Purchase quantities

Purchase commercial values

PurchaseReceipt

Inventory stock

InventoryMovement

InventoryBatch semantics

Product

Accounts Payable

Supplier invoices

Healthcare Case Logistics
```

---

# 3. Fronteras de dominio

Debe mantenerse:

```text
Supplier
→ who supplies
```

```text
Purchase
→ what was ordered from Supplier
```

```text
PurchaseReceipt
→ what physically arrived
```

```text
Inventory
→ resulting quantity / movement effects
```

Por tanto:

```text
Supplier
≠
Purchase
```

```text
Supplier
≠
Product
```

```text
Supplier
≠
Inventory
```

---

# 4. CURRENT vs TARGET vs FUTURE

Este documento distingue:

## CURRENT

Capacidades implementadas actualmente.

## TARGET

Evoluciones aprobadas o de deuda inmediata.

## FUTURE

Capacidades posteriores cuya implementación dependerá de necesidades reales.

---

# 5. Estado CURRENT

Actualmente Suppliers V1 soporta:

```text
Supplier create

Supplier list

Supplier detail

Supplier master-data update

soft-deactivation

active-only list

inactive historical detail

tenant-scoped operations

name uniqueness per Company

duplicate handling

NotFound handling
```

Lifecycle vigente:

```text
ACTIVE
↓
INACTIVE
```

---

# 6. Modelo Supplier actual

Conceptualmente:

```text
Supplier

id
companyId

name

email
phone
address
contactName
notes

isActive

createdAt
updatedAt

purchases
```

La definición técnica exacta pertenece a:

```text
schema.prisma
```

---

# 7. Supplier como Master Data

Supplier utiliza un lifecycle de Master Data.

La transición principal es:

```text
ACTIVE
↓
INACTIVE
```

No:

```text
ACTIVE
↓
physical DELETE
```

como comportamiento empresarial normal.

---

# 8. Supplier ACTIVE

Un Supplier activo puede utilizarse normalmente en nuevas operaciones compatibles,
principalmente:

```text
Purchase
```

La utilización final depende de validaciones backend del workflow consumidor.

---

# 9. Supplier INACTIVE

Un Supplier inactivo:

```text
remains persisted

remains historically referenceable

retains Purchase history

must not disappear from historical documents
```

Normalmente no debe utilizarse para nuevas Purchases.

---

# 10. Desactivación CURRENT

Actualmente:

```text
DELETE /suppliers/:id
```

implementa:

```text
isActive = false
```

No elimina físicamente el Supplier.

Debe interpretarse como:

```text
Deactivate Supplier
```

y no como:

```text
Hard Delete Supplier
```

---

# 11. Desactivación tenant-scoped

La operación de desactivación debe ejecutarse dentro de:

```text
authenticated Company
```

No debe ser posible:

```text
Company A User
↓
DELETE Supplier Company B
```

---

# 12. Desactivación idempotente

La desactivación actual es idempotente.

Si Supplier ya está:

```text
isActive = false
```

repetir la operación no debe eliminar historia ni producir un efecto destructivo
adicional.

---

# 13. Reactivación

Actualmente:

```text
Supplier reactivation
→ NOT IMPLEMENTED
```

Una futura transición:

```text
INACTIVE
↓
ACTIVE
```

deberá realizarse mediante un workflow explícito que valide:

```text
tenant

authorization

name uniqueness

current business rules
```

No debe introducirse accidentalmente mediante un PATCH genérico.

---

# 14. Hard Delete

Suppliers V1 no expone hard delete.

Una futura eliminación física requeriría una decisión específica sobre:

```text
historical relationships

retention

auditability

foreign-key dependencies
```

No forma parte del lifecycle normal.

---

# 15. Name

`name` constituye la identidad empresarial principal del Supplier dentro de una
Company.

Ejemplos:

```text
Distribuidora Médica del Norte
```

```text
Terumo México
```

---

# 16. Name uniqueness

La regla técnica actual es:

```text
companyId
+
name
→ UNIQUE
```

La misma organización puede existir como Supplier en Companies diferentes.

Ejemplo válido:

```text
Company A
→ Supplier ABC

Company B
→ Supplier ABC
```

---

# 17. Duplicate handling

Cuando ya existe un Supplier con el mismo nombre dentro de la Company, backend
debe responder con un error empresarial comprensible.

Ejemplo:

```text
Ya existe un proveedor con este nombre.
```

No debe exponerse directamente al usuario un error interno de constraint Prisma.

---

# 18. UUID

Supplier utiliza:

```text
id
→ UUID
```

como identificador técnico.

El usuario normalmente opera utilizando:

```text
name

contact data

Purchase context
```

y no necesita conocer el UUID.

---

# 19. Contact Name

`contactName` representa actualmente el contacto principal conocido del Supplier.

Ejemplo:

```text
Supplier
Distribuidora ABC

Contact
María López
```

---

# 20. Contact Name ≠ User

Debe mantenerse:

```text
Supplier.contactName
≠
Zaping User
```

`contactName` es información descriptiva del proveedor.

No representa una identidad autenticada dentro de Zaping.

---

# 21. Email

`email` es opcional.

Puede utilizarse para:

```text
contact

documentation

future Purchase communication

future notifications
```

Cuando se proporcione, debe respetar las validaciones del DTO vigente.

---

# 22. Phone

`phone` es opcional.

Actualmente no debe sobrearquitecturarse con un modelo internacional complejo sin
una necesidad funcional real.

---

# 23. Address

Supplier utiliza actualmente:

```text
address
```

como campo simple de dirección.

La UI puede presentarlo en una sección:

```text
Dirección
```

sin afirmar que exista una entidad Address separada.

---

# 24. Structured Address — FUTURE

Si posteriormente se requieren campos estructurados como:

```text
street

externalNumber

internalNumber

neighborhood

city

state

postalCode

country
```

deberá diseñarse una evolución específica.

No deben agregarse únicamente para anticipar necesidades futuras.

---

# 25. Notes

`notes` permite almacenar contexto administrativo no estructurado.

Ejemplos:

```text
Entrega normalmente en 48 horas.
```

```text
Contactar por correo antes de enviar OC.
```

---

# 26. Notes no sustituye datos estructurados

No debe utilizarse `notes` como sustituto permanente de información que el sistema
necesite:

```text
validate

filter

calculate

automate
```

Ejemplo:

```text
payment terms

lead time

RFC

bank information
```

deben convertirse en campos o dominios estructurados cuando empiecen a afectar
workflows reales.

---

# 27. Create Supplier

La creación requiere al menos:

```text
name
```

según el modelo actual.

Otros campos vigentes son opcionales según DTO.

Backend debe determinar:

```text
companyId
```

desde el contexto autenticado.

---

# 28. Tenant authority

Debe mantenerse:

```text
JWT / authenticated context
↓
companyId
↓
Supplier operation
```

No:

```text
client-provided companyId
→ tenant authority
```

Frontend no decide arbitrariamente el tenant.

---

# 29. Update Supplier

La edición normal puede modificar, según el contrato vigente:

```text
name

email

phone

address

contactName

notes
```

Lifecycle debe mantenerse separado.

No debe tratarse:

```text
isActive
```

como un campo ordinario para reactivar o desactivar libremente mediante PATCH.

---

# 30. Update name uniqueness

Cuando cambia:

```text
name
```

backend debe volver a validar:

```text
companyId + name
→ UNIQUE
```

excluyendo al Supplier actual.

---

# 31. Lifecycle separado de PATCH

Debe mantenerse:

```text
PATCH /suppliers/:id
→ master-data update
```

```text
DELETE /suppliers/:id
→ ACTIVE → INACTIVE
```

```text
INACTIVE → ACTIVE
→ NOT IMPLEMENTED
```

Esto evita que el lifecycle se convierta en una modificación genérica difícil de
auditar.

---

# 32. Active list

Actualmente:

```text
GET /suppliers
→ active Suppliers
```

Esto permite utilizar el listado principal como catálogo operativo para nuevas
operaciones.

---

# 33. Historical detail

Un Supplier inactivo continúa siendo consultable mediante detalle tenant-scoped
cuando sea necesario preservar:

```text
Purchase history

historical document context

audit context
```

Debe mantenerse:

```text
Inactive
≠
historically invisible
```

---

# 34. Not Found

Solicitar un Supplier inexistente debe devolver un error apropiado.

La implementación actual contempla manejo explícito de recurso no encontrado.

---

# 35. Wrong Tenant

Un Supplier perteneciente a otra Company debe tratarse como recurso no accesible.

Debe mantenerse:

```text
Supplier exists globally
≠
authenticated tenant may access it
```

---

# 36. API CURRENT

Endpoints actuales:

```text
GET    /suppliers

GET    /suppliers/:id

POST   /suppliers

PATCH  /suppliers/:id

DELETE /suppliers/:id
```

Semántica:

```text
DELETE
→ deactivate
→ not hard delete
```

---

# 37. Supplier ↔ Product

Supplier no es propietario del Product.

Debe mantenerse:

```text
Supplier
→ procurement source
```

```text
Product
→ catalog identity
```

La relación actual ocurre principalmente mediante:

```text
Supplier
↓
Purchase
↓
PurchaseItem
↓
Product
```

---

# 38. No fixed Supplier on Product

No debe asumirse:

```text
Product.supplierId
```

como única relación posible de abastecimiento.

Un Product puede adquirirse desde:

```text
Supplier A

Supplier B

Supplier C
```

según operación.

---

# 39. SupplierProduct — FUTURE

En una evolución posterior puede resultar útil un modelo como:

```text
SupplierProduct
```

para representar:

```text
supplier-specific product code

supplier-specific cost

presentation

minimum order

lead time

availability

preferred relationship
```

Actualmente:

```text
SupplierProduct
→ NOT IMPLEMENTED
```

No forma parte de Supplier V1.

---

# 40. Preferred Supplier — FUTURE

No debe agregarse automáticamente:

```text
Product.preferredSupplierId
```

sin definir cómo se determina y mantiene esa preferencia.

Una futura decisión puede considerar:

```text
price

availability

lead time

performance

commercial agreement
```

---

# 41. Supplier ↔ Purchase

Purchases es el consumidor principal de Supplier dentro del ERP Core actual.

Relación:

```text
Supplier
↓
Purchase
```

Toda Purchase debe referenciar un Supplier perteneciente al mismo tenant.

---

# 42. Purchase Supplier validation — CURRENT

Actualmente `PurchasesService.create()` y `update()` validan:

```text
Supplier exists

+

Supplier belongs to authenticated Company
```

Esto protege la relación tenant-scoped.

---

# 43. Inactive Supplier business invariant

La regla empresarial es:

```text
New Purchase
→ requires active Supplier
```

Por tanto:

```text
Inactive Supplier
→ unavailable for new Purchase
```

---

# 44. Current backend gap

Aunque la UI utiliza Suppliers activos, actualmente Purchase backend no exige de
forma completa:

```text
Supplier.isActive = true
```

en create/update.

Estado:

```text
same-tenant Supplier validation
✅ IMPLEMENTED
```

```text
active Supplier backend enforcement
⏳ TECHNICAL DEBT
```

La validación debe cerrarse antes de considerar definitiva esa frontera.

---

# 45. Historical Purchase with inactive Supplier

Una Purchase histórica continúa siendo válida aunque posteriormente:

```text
Supplier.isActive = false
```

No debe ocurrir:

```text
Supplier deactivated
↓
historical Purchase becomes invalid
```

La desactivación afecta nuevas operaciones, no reescribe historia.

---

# 46. PurchaseReceipt provenance

PurchaseReceipt obtiene su Supplier mediante la Purchase asociada.

Conceptualmente:

```text
PurchaseReceipt
↓
Purchase
↓
Supplier
```

No es necesario duplicar Supplier en todas las entidades si la relación puede
resolverse de manera íntegra.

---

# 47. Supplier provenance

La procedencia Core puede reconstruirse conceptualmente mediante:

```text
Supplier
↓
Purchase
↓
PurchaseReceipt
↓
Inventory
```

y, cuando corresponde:

```text
PurchaseReceipt
↓
EquipmentAsset
```

No debe asumirse una relación específica adicional en `InventoryBatch` salvo que
el schema vigente la defina explícitamente.

---

# 48. Inventory boundary

Inventory puede utilizar Supplier como contexto indirecto de procedencia.

Pero Inventory continúa siendo propietario de:

```text
stock

InventoryMovement

InventoryBatch semantics
```

Supplier sigue siendo propietario únicamente de sus datos maestros.

---

# 49. Supplier ≠ Manufacturer

Debe mantenerse:

```text
Supplier
≠
Manufacturer
```

Supplier:

```text
sells / supplies Product to Company
```

Manufacturer:

```text
manufactures Product
```

Una misma organización puede desempeñar ambos roles, pero no deben modelarse como
sinónimos.

---

# 50. Supplier ≠ Brand

También:

```text
Supplier
≠
Brand
```

Ejemplo válido:

```text
Brand
Terumo

Supplier
Distribuidora ABC
```

Products administra Brand como dato de catálogo vigente.

Supplier administra la contraparte de abastecimiento.

---

# 51. Frontend Suppliers V1

La experiencia actual organiza datos en secciones como:

```text
General

Contacto

Dirección

Notas
```

y utiliza patrones coherentes con el diseño general del ERP.

Puede incluir:

```text
Supplier list

create

edit

deactivate

active state

contact data

empty states

loading / error states
```

según la implementación vigente.

---

# 52. Main list

La tabla puede priorizar información operativa como:

```text
Supplier

Contact

Phone

Email

Status

Actions
```

La composición exacta puede evolucionar mediante UX sin cambiar el dominio.

---

# 53. Empty State

Una experiencia adecuada puede mostrar:

```text
Todavía no hay proveedores.

Registra tu primer proveedor para comenzar
a crear órdenes de compra.

[Agregar proveedor]
```

El texto exacto pertenece a UX.

---

# 54. Status presentation

Supplier puede representarse visualmente mediante:

```text
Active

Inactive
```

utilizando `StatusBadge` o un equivalente del Design System.

El componente visual no define el lifecycle.

---

# 55. Search

Criterios útiles para localizar Suppliers incluyen:

```text
name

contactName

email
```

cuando la implementación correspondiente lo soporte.

La evolución server-side dependerá de escala y UX.

---

# 56. Searchable SupplierSelector — TARGET

Una futura Business Component Library puede incorporar:

```text
SupplierSelector
```

con flujo:

```text
Search
↓
Identify
↓
Select Supplier
```

No debe marcarse como `IMPLEMENTED` sin verificar que exista como componente
reutilizable formal en frontend.

Por tanto:

```text
Searchable SupplierSelector
→ TARGET UX
```

---

# 57. Contextual Supplier creation — FUTURE UX

Una evolución útil puede permitir:

```text
New Purchase
↓
Supplier not found
↓
Create Supplier
↓
Return to Purchase
```

sin perder el formulario original.

Actualmente:

```text
Contextual Supplier creation
→ NOT REQUIRED FOR SUPPLIERS V1
```

---

# 58. Supplier 360 — FUTURE UX

Una futura experiencia:

```text
Supplier 360
```

puede responder:

```text
Who is this Supplier?

How do we contact them?

Are they active?

What have we purchased?

What remains pending?

What has been received?
```

---

# 59. Supplier 360 content

Puede integrar como read model:

```text
General

Contact

Purchases

Receipts

Products

Documents

History
```

Esto no cambia ownership.

Debe mantenerse:

```text
Supplier 360
→ contextual read experience
```

No:

```text
Supplier
→ owns Purchase lifecycle
```

---

# 60. Audit — TARGET

Una futura capacidad transversal de Audit puede registrar:

```text
Supplier created

Supplier updated

Supplier deactivated

Supplier reactivated
```

Actualmente no existe un Audit transversal completo.

Por tanto:

```text
Supplier Audit integration
→ TARGET
```

---

# 61. Authorization

Suppliers utiliza el modelo transversal de Identity & Access.

Permisos conceptuales futuros pueden incluir:

```text
suppliers.read

suppliers.create

suppliers.update

suppliers.deactivate
```

El Permission-Based RBAC completo continúa como TARGET.

---

# 62. Security before production

Suppliers participa en revisiones transversales como:

```text
critical endpoint authorization

systematic tenant-isolation regression

inactive-user enforcement

safe role provisioning
```

Además, Purchases debe cerrar:

```text
inactive Supplier backend enforcement
```

antes de producción.

---

# 63. Sensitive information

No deben almacenarse innecesariamente secretos o información bancaria dentro de:

```text
notes
```

sin un modelo y controles adecuados.

---

# 64. Banking information — FUTURE

Si posteriormente se administran:

```text
bank accounts

CLABE

payment information
```

deberán evaluarse:

```text
permissions

auditability

data minimization

API exposure

encryption where appropriate
```

No pertenece al Supplier Core actual.

---

# 65. Fiscal profile — FUTURE

Una futura integración con Billing/CFDI puede necesitar:

```text
RFC

legal name

tax regime

fiscal postal code
```

Estos datos deberán diseñarse coordinadamente con Billing.

No deben agregarse de forma aislada únicamente desde Suppliers.

---

# 66. Payment Terms — FUTURE

Pueden existir conceptos como:

```text
Cash

Net 15

Net 30
```

Si comienzan a determinar vencimientos o Accounts Payable, deberán modelarse como
datos estructurados.

No deben permanecer escondidos dentro de `notes`.

---

# 67. Lead Time — FUTURE

Supplier lead time puede ser útil para:

```text
replenishment recommendations

purchase planning

supplier comparison
```

Conceptualmente:

```text
Supplier lead time
+
Inventory
+
Demand
↓
Recommendation
```

No forma parte de Supplier V1.

---

# 68. Supplier Performance — FUTURE

Una futura capacidad puede medir:

```text
on-time delivery

average lead time

receipt discrepancies

price competitiveness

quality incidents
```

Preferentemente derivada de datos reales.

No debe implementarse como un rating arbitrario sin una definición funcional.

---

# 69. AI recommendations — FUTURE

Información histórica podrá alimentar recomendaciones como:

```text
Supplier A has lower cost
but longer delivery time.
```

Cualquier recomendación deberá basarse en datos disponibles y trazables.

La IA no debe inventar métricas inexistentes.

---

# 70. Import — FUTURE

Suppliers es candidato natural para Data Import mediante:

```text
CSV

XLSX

external systems
```

Flujo conceptual:

```text
File
↓
Mapping
↓
Validation
↓
Duplicate detection
↓
Preview
↓
Import
```

---

# 71. Duplicate detection during Import

Actualmente el principal identificador disponible es:

```text
name within Company
```

Una futura estructura fiscal puede proporcionar identificadores adicionales.

La política exacta de:

```text
create

skip

merge

update
```

deberá definirse en Data Import.

---

# 72. External IDs — FUTURE

Migraciones desde otros sistemas pueden requerir conservar un identificador
externo.

Debe distinguirse:

```text
external system ID
≠
Zaping Supplier UUID
```

No se agrega `externalId` al schema únicamente desde este documento.

---

# 73. Dashboard

Dashboard puede consumir Supplier para métricas o contexto como:

```text
active Suppliers

Purchases by Supplier

pending Receipts
```

sin convertirse en propietario de Supplier.

---

# 74. Warehouse boundary

Warehouse puede mostrar Supplier como contexto de una Purchase o Receipt.

Ejemplo:

```text
OC-001

Supplier:
ABC Medical
```

Warehouse no administra el catálogo maestro de Suppliers.

---

# 75. Healthcare boundary

Healthcare no debe crear un catálogo paralelo de Suppliers.

La procedencia Core actual puede mantenerse como:

```text
Supplier
↓
Purchase
↓
PurchaseReceipt
↓
Inventory / Equipment
```

Healthcare podrá consumir esa procedencia posteriormente.

---

# 76. Healthcare TARGET

Futuros workflows Healthcare podrán relacionar Inventory o Equipment con:

```text
Case

Assignment

Dispatch

Custody

Return
```

sin agregar:

```text
caseId
```

o relaciones Healthcare directas dentro de Supplier.

Debe mantenerse:

```text
Supplier
→ Core master data
```

---

# 77. IMPLEMENTED

Actualmente:

```text
Supplier persistence

Supplier create

Supplier list

Supplier detail

Supplier update

soft-deactivation

active-only list

inactive historical detail

tenant-scoped operations

name uniqueness per Company

duplicate handling

NotFound handling

Purchase relationship
```

---

# 78. VALIDATED

La validación registrada cubre según los hitos correspondientes:

```text
Supplier create

Supplier update

name uniqueness

tenant isolation within Supplier operations

soft-deactivation

repeated deactivation

active-only list

inactive historical detail

Purchase historical compatibility

frontend Supplier workflows
```

Los gates técnicos pueden incluir:

```text
tests

build

lint

git diff --check
```

Los snapshots cuantitativos pertenecen a:

```text
PROJECT_BOARD.md

CHANGELOG.md
```

---

# 79. TECHNICAL DEBT

Permanece pendiente:

```text
Supplier reactivation workflow
```

```text
Purchases backend active-Supplier enforcement
```

```text
Searchable SupplierSelector formal verification / implementation
```

```text
server-side Supplier search / pagination when scale requires it
```

```text
Supplier Audit integration
```

---

# 80. TARGET

Evoluciones posteriores pueden incluir:

```text
Supplier reactivation

Purchase active-Supplier backend enforcement

Searchable SupplierSelector

Supplier 360

Audit integration

Data Import
```

No todas tienen la misma prioridad.

La validación backend de Supplier activo en Purchases es una deuda más inmediata
que las mejoras UX avanzadas.

---

# 81. FUTURE

Capacidades posibles:

```text
Multiple Contacts

Structured Addresses

Fiscal Profile

Payment Terms

SupplierProduct Catalog

Supplier-specific Product Codes

Lead Times

Price History

Performance Metrics

Supplier Documents

Banking Information

Supplier Portal

AI Recommendations
```

No forman parte automáticamente del ERP Core V1.

---

# 82. Invariantes

## Tenant

```text
Supplier
→ belongs to one Company
```

---

## Name

```text
companyId + name
→ unique
```

---

## Lifecycle

```text
ACTIVE
→ may be used in new operations
```

```text
INACTIVE
→ remains historically visible
```

---

## Deactivation

```text
DELETE /suppliers/:id
→ isActive = false
```

No:

```text
physical deletion
```

---

## Reactivation

```text
INACTIVE → ACTIVE
→ not implemented currently
```

---

## Purchase tenant

```text
Purchase Supplier
→ same Company
```

---

## Purchase activity rule

Business invariant:

```text
New Purchase
→ active Supplier required
```

Current implementation gap:

```text
backend isActive enforcement
→ pending
```

---

## Historical Purchase

```text
Supplier deactivation
→ does not invalidate historical Purchase
```

---

## Supplier vs Product

```text
Supplier
≠
Product owner
```

---

## Supplier vs Manufacturer

```text
Supplier
≠
Manufacturer
```

---

## Supplier vs Brand

```text
Supplier
≠
Brand
```

---

# 83. Anti-patrones

## Hard Delete Historical Supplier

Eliminar físicamente un Supplier que ya forma parte de Purchases.

Incorrecto.

---

## isActive as arbitrary PATCH

```text
PATCH Supplier
isActive = true / false
```

como lifecycle genérico sin workflow explícito.

Incorrecto para el contrato actual.

---

## Cross-Tenant Supplier

```text
Company A Purchase
→ Supplier Company B
```

Incorrecto.

---

## Frontend-only active enforcement

Asumir:

```text
UI only shows active Suppliers
→ sufficient security/business validation
```

Incorrecto.

Backend también debe aplicar la regla.

---

## Fixed Supplier on Product

```text
Product.supplierId
```

como único proveedor posible.

Incorrecto.

---

## Supplier = Manufacturer

Asumir que quien suministra siempre es quien fabrica.

Incorrecto.

---

## Supplier = Brand

Asumir que Supplier y Brand representan la misma entidad.

Incorrecto.

---

## Notes as database

Guardar dentro de `notes` información estructurada que ya gobierna workflows.

Incorrecto.

---

## Duplicate Supplier catalog for Healthcare

Crear otra tabla de Suppliers exclusivamente para Healthcare.

Incorrecto.

---

## UI Security

Ocultar recursos de otros tenants solamente en frontend.

Incorrecto.

---

# 84. Relación con Products

Debe mantenerse:

```text
Supplier
→ procurement counterpart
```

```text
Product
→ catalog identity
```

Se relacionan mediante operaciones comerciales como Purchase.

---

# 85. Relación con Purchases

Debe mantenerse:

```text
Supplier
↓
Purchase
```

Purchases administra:

```text
ordered Products

quantities

commercial values

lifecycle
```

Supplier no administra esas reglas.

---

# 86. Relación con Purchase Receipts

PurchaseReceipt obtiene contexto de Supplier mediante Purchase.

Debe mantenerse:

```text
Supplier
↓
Purchase
↓
PurchaseReceipt
```

Purchase Receipt administra la recepción física.

---

# 87. Relación con Inventory

Inventory puede reconstruir la procedencia a partir del flujo de compras.

Debe mantenerse:

```text
Supplier
→ provenance context
```

```text
Inventory
→ physical quantity / movement semantics
```

---

# 88. Relación con Equipment

Cuando una PurchaseReceipt recibe Product ASSET:

```text
Supplier
↓
Purchase
↓
PurchaseReceipt
↓
EquipmentAsset
```

Supplier no es propietario de:

```text
Equipment lifecycle

condition

Inspection

Retirement
```

---

# 89. ADR relacionados

```text
ADR-001 — Multi-Tenant

ADR-004 — UUID

ADR-005 — Layered Architecture

ADR-006 — API First

ADR-007 — RBAC

ADR-009 — Modular Monolith

ADR-012 — Entity Lifecycle
```

---

# 90. Documentación relacionada

```text
docs/modules/erp/PRODUCTS.md

docs/modules/erp/PURCHASES.md

docs/modules/erp/PURCHASE_RECEIPTS.md

docs/modules/erp/INVENTORY.md

docs/modules/erp/EQUIPMENT.md

docs/modules/erp/IDENTITY_ACCESS.md

docs/architecture/ARCHITECTURE.md

docs/engineering/API_GUIDELINES.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/product/PRODUCT_REQUIREMENTS.md

docs/product/ZAPING_WAY.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

---

# 91. Fuente de verdad

```text
SUPPLIERS.md
→ Supplier master-data behavior
→ Supplier lifecycle
```

```text
PURCHASES.md
→ use of Supplier in Purchase
→ active-Supplier business rule
```

```text
PURCHASE_RECEIPTS.md
→ physical receipt workflow
```

```text
PRODUCTS.md
→ Product catalog identity
```

```text
INVENTORY.md
→ inventory quantity and provenance consequences
```

```text
schema.prisma
→ CURRENT persistence
```

```text
Suppliers backend
→ CURRENT API/business implementation
```

```text
Suppliers frontend
→ CURRENT user experience
```

```text
tests
→ validated behavior
```

```text
PROJECT_BOARD.md
→ current status and active debt
```

```text
CHANGELOG.md
→ historical implementation evolution
```

---

# 92. Estado consolidado

```text
Supplier create
✅ IMPLEMENTED / VALIDATED

Supplier list
✅ IMPLEMENTED / VALIDATED

Supplier detail
✅ IMPLEMENTED / VALIDATED

Supplier master-data update
✅ IMPLEMENTED / VALIDATED

soft-deactivation
✅ IMPLEMENTED / VALIDATED

active-only default list
✅ IMPLEMENTED / VALIDATED

inactive historical detail
✅ IMPLEMENTED / VALIDATED

tenant-scoped operations
✅ IMPLEMENTED / VALIDATED

name uniqueness per Company
✅ IMPLEMENTED / VALIDATED
```

Pendiente:

```text
Supplier reactivation
⏳

Purchase backend active-Supplier enforcement
⏳

Searchable SupplierSelector verification / reusable component
⏳

server-side search / pagination when required
⏳

Audit integration
⏳
```

Future:

```text
Supplier 360

Contextual Supplier creation

SupplierProduct catalog

Multiple contacts

Structured addresses

Fiscal profile

Payment terms

Lead times

Performance metrics

Supplier Portal

AI recommendations
```

---

# 93. Secuencia de proyecto

Suppliers V1 forma parte del ERP Core ya normalizado.

La secuencia vigente es:

```text
H8 Documentation / Technical Regression
↓
UX-B.6 Full ERP End-to-End QA
↓
ERP Core V1 Closure
↓
Healthcare specialization
```

Por tanto, capacidades como:

```text
Supplier 360

SupplierProduct

Supplier Portal

advanced Supplier Performance
```

no deben convertirse automáticamente en el siguiente sprint únicamente porque
están documentadas.

La deuda más relevante para el flujo actual es:

```text
Purchases backend
→ enforce Supplier.isActive for new/edited Purchase
```

---

# 94. Principio final

Supplier debe responder:

```text
¿Quién nos suministra?
```

Purchase debe responder:

```text
¿Qué le ordenamos?
```

Purchase Receipt debe responder:

```text
¿Qué llegó físicamente?
```

Inventory debe responder:

```text
¿Qué consecuencia tuvo esa recepción?
```

La cadena correcta es:

```text
Supplier
↓
Purchase
↓
PurchaseReceipt
↓
Inventory
```

y, para Products ASSET:

```text
PurchaseReceipt
↓
EquipmentAsset
```

Debe mantenerse:

```text
Supplier identity
≠
Purchase transaction
≠
physical Receipt
≠
Inventory state
```

> **Supplier identifica la contraparte de abastecimiento; Purchases registra el
> compromiso comercial y Purchase Receipts confirma lo que realmente llegó.**
