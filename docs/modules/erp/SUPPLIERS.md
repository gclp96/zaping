# Módulo de Proveedores — Zaping ERP

**Módulo:** Suppliers
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / EN EVOLUCIÓN
**Última actualización:** 2026-08-19
**Responsable:** Zaping ERP Team

---

# 1. Propósito

El módulo Suppliers administra el catálogo maestro de proveedores de una Company.

Su responsabilidad principal es responder:

```text
¿Quién nos suministra?
¿Cómo podemos contactarlo?
¿Puede utilizarse actualmente?
¿Qué compras se han realizado con él?
```

Supplier representa una organización o persona utilizada como contraparte de abastecimiento.

---

# 2. Principio fundamental

```text
Supplier
=
quién suministra
```

mientras:

```text
Purchase
=
qué se ordena al Supplier
```

y:

```text
PurchaseReceipt
=
qué se recibió físicamente
```

Por tanto:

> Supplier define al proveedor. Purchases define las operaciones realizadas con él.

---

# 3. Responsabilidades

Suppliers es propietario de información maestra como:

* nombre;
* contacto;
* email;
* teléfono;
* dirección;
* notas;
* estado activo/inactivo;
* identidad dentro de la Company.

---

# 4. Fuera del alcance

Suppliers no es propietario de:

* Purchase lifecycle;
* cantidades compradas;
* Inventory;
* lotes;
* caducidades;
* Products;
* pagos;
* cuentas por pagar;
* facturas de proveedor;
* movimientos de inventario.

---

# 5. Modelo actual

El modelo actual de `Supplier` contiene conceptualmente:

```text
Supplier
├── id
├── companyId
├── name
├── email
├── phone
├── address
├── contactName
├── notes
├── isActive
├── createdAt
├── updatedAt
└── purchases
```

La definición técnica exacta permanece en `schema.prisma`.

---

# 6. Identificador

Supplier utiliza UUID como identificador técnico.

Conceptualmente:

```text
id
→ UUID
```

El usuario no necesita conocerlo para operar normalmente.

---

# 7. Multi-tenancy

Cada Supplier pertenece a una Company.

```text
Company
↓
Supplier
```

No debe existir acceso cruzado entre tenants.

---

# 8. Nombre

`name` constituye actualmente la identidad empresarial principal del Supplier.

Ejemplos:

```text
Distribuidora Médica del Norte
```

```text
Terumo México
```

---

# 9. Unicidad del nombre

Actualmente la regla técnica es:

```text
unique(companyId, name)
```

Por tanto, dentro de una Company no deben existir dos Suppliers con exactamente el mismo nombre según la comparación aplicada por la base de datos.

---

# 10. Nombre entre Companies

Sí puede existir:

```text
Company A
→ Supplier "Proveedor ABC"
```

y:

```text
Company B
→ Supplier "Proveedor ABC"
```

porque los tenants son independientes.

---

# 11. Duplicados

El backend debe detectar conflictos de nombre dentro de la Company.

El mensaje debe ser comprensible.

Ejemplo:

```text
Ya existe un proveedor con este nombre.
```

No debe exponerse directamente un error de constraint de Prisma.

---

# 12. Lifecycle

Supplier es Master Data.

Por tanto sigue ADR-012:

```text
ACTIVE
↓
INACTIVE
```

como estrategia principal.

---

# 13. Supplier activo

Un Supplier activo puede utilizarse normalmente en:

```text
Purchase
```

y otros futuros workflows de abastecimiento.

---

# 14. Supplier inactivo

Un Supplier inactivo:

* continúa existiendo;
* conserva sus compras históricas;
* conserva referencias;
* puede consultarse;
* normalmente no debe utilizarse para nuevas Purchases.

---

# 15. Desactivación

La acción empresarial correcta es:

```text
Desactivar proveedor
```

cuando el objetivo es dejar de utilizarlo.

No:

```text
Eliminar proveedor
```

si posee historia empresarial.

---

# 16. Reactivación

Cuando sea válido:

```text
INACTIVE
↓
ACTIVE
```

puede restaurarse su uso en nuevas operaciones.

La reactivación debe mantener las reglas de:

* tenant;
* unicidad;
* autorización.

---

# 17. Eliminación física

Hard Delete no debe ser la estrategia normal.

Solo puede considerarse cuando el Supplier:

* fue creado por error;
* nunca participó en una Purchase;
* no tiene relaciones históricas;
* y el módulo permite explícitamente eliminarlo.

---

# 18. Compras históricas

Desactivar un Supplier no debe afectar:

```text
Purchase
PurchaseReceipt
InventoryMovement
InventoryBatch
```

que ya se encuentren relacionados histórica o indirectamente con él.

---

# 19. Contact Name

`contactName` representa la persona de contacto principal conocida.

Ejemplo:

```text
Proveedor
Distribuidora ABC

Contacto
María López
```

---

# 20. Contacto no es User

El contacto de un Supplier no debe confundirse con:

```text
User
```

de Zaping.

Actualmente es información descriptiva del proveedor.

---

# 21. Múltiples contactos

El modelo actual contempla un contacto principal.

En el futuro podría requerirse:

```text
Supplier
└── Contacts[]
```

si las empresas necesitan administrar:

* ventas;
* cobranza;
* logística;
* soporte;
* dirección administrativa.

No debe implementarse antes de validar la necesidad.

---

# 22. Email

`email` es opcional.

Puede utilizarse para:

* contacto;
* futuras órdenes enviadas por correo;
* documentación;
* comunicación empresarial.

---

# 23. Validación de email

Cuando exista un valor, debe validarse su formato en el DTO correspondiente.

No debe asumirse que el frontend siempre enviará información válida.

---

# 24. Phone

`phone` es opcional.

El modelo no debe imponer prematuramente un formato internacional complejo mientras las necesidades reales no lo requieran.

---

# 25. Address

Actualmente Supplier utiliza:

```text
address
```

como un campo de dirección.

La UI puede organizarlo visualmente dentro de una sección:

```text
Dirección
```

sin asumir que ya existe un modelo estructurado de direcciones.

---

# 26. Dirección estructurada futura

Si el producto necesita posteriormente:

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

debe evaluarse una evolución específica.

No crear múltiples campos únicamente para anticipar integraciones futuras.

---

# 27. Notes

`notes` permite conservar contexto administrativo no estructurado.

Ejemplos:

```text
Entrega normalmente en 48 horas.
```

o:

```text
Contactar por correo antes de enviar OC.
```

---

# 28. Notes no sustituye campos estructurados

No debe utilizarse `notes` para almacenar información que Zaping necesite posteriormente:

* filtrar;
* validar;
* calcular;
* automatizar.

Ejemplo incorrecto:

```text
notes =
"crédito 30 días, RFC ABC..., lead time 5 días"
```

si esas propiedades se convierten en reglas operativas reales.

---

# 29. Supplier y Product

Actualmente:

```text
Supplier
≠
owner of Product
```

Un mismo Product puede adquirirse desde diferentes proveedores.

---

# 30. No utilizar supplierId fijo en Product

No debe asumirse:

```text
Product
└── supplierId
```

como única relación posible de abastecimiento.

Esto bloquearía escenarios donde:

```text
Product A
├── Supplier 1
├── Supplier 2
└── Supplier 3
```

son válidos.

---

# 31. Relación actual con Products

La relación entre Supplier y Product ocurre principalmente mediante documentos:

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

# 32. Supplier Catalog futuro

En una etapa posterior puede resultar útil una entidad conceptual como:

```text
SupplierProduct
```

para representar:

* código del proveedor;
* costo;
* presentación;
* lead time;
* mínimo de compra;
* disponibilidad;
* preferencia.

No forma parte actualmente del Core aprobado.

---

# 33. Supplier Product Code

Un proveedor puede identificar un Product utilizando un código diferente al SKU interno de Zaping.

Ejemplo futuro:

```text
Zaping SKU
CAT-001

Supplier ABC Code
TRM-15X-22
```

Esta capacidad deberá diseñarse si los workflows reales la requieren.

---

# 34. Supplier preferido

No debe agregarse automáticamente:

```text
Product.preferredSupplierId
```

sin definir cómo se decide y mantiene esa preferencia.

Una evolución futura puede utilizar factores como:

* precio;
* disponibilidad;
* lead time;
* desempeño;
* contrato.

---

# 35. Integración con Purchases

Supplier participa directamente en:

```text
Supplier
↓
Purchase
```

Toda Purchase debe referenciar un Supplier válido.

---

# 36. Validación de Purchase

Cuando Purchases recibe:

```text
supplierId
```

debe comprobar:

```text
Supplier exists
AND
Supplier belongs to Company
```

y, cuando la regla sea exigida:

```text
Supplier isActive = true
```

---

# 37. Supplier inactivo y Purchase histórica

Una Purchase existente continúa siendo válida aunque después:

```text
Supplier.isActive = false
```

---

# 38. Supplier inactivo y nueva Purchase

Normalmente debe rechazarse o impedirse:

```text
New Purchase
↓
Inactive Supplier
```

porque el Supplier ya no está habilitado para nuevas operaciones.

---

# 39. PurchaseReceipt

PurchaseReceipt deriva su relación con Supplier principalmente a través de:

```text
Purchase
```

No es necesario duplicar el Supplier en todas las entidades si la relación puede determinarse de manera segura.

---

# 40. InventoryBatch

Actualmente algunos modelos de Inventory pueden conservar contexto de Supplier.

Esto permite trazabilidad de origen.

Sin embargo, Inventory no debe convertirse en propietario de los datos maestros del proveedor.

---

# 41. Trazabilidad

Una cadena futura puede responder:

```text
Batch L001
↓
Received from
Supplier ABC
↓
Purchase OC-001
↓
Receipt REC-001
```

---

# 42. Supplier 360

La arquitectura objetivo contempla una futura vista:

```text
Supplier 360
```

que reúna contexto operativo.

---

# 43. Objetivo de Supplier 360

Debe permitir responder:

```text
¿Quién es?
¿Cómo lo contacto?
¿Está activo?
¿Qué le compramos?
¿Qué compras están pendientes?
¿Qué hemos recibido?
¿Cuánto compramos?
```

sin navegar manualmente por múltiples módulos.

---

# 44. Información conceptual de Supplier 360

Puede incluir progresivamente:

```text
General
Contacto
Compras
Recepciones
Productos
Documentos
Historial
```

---

# 45. Supplier 360 no absorbe Purchases

Mostrar Purchases dentro de Supplier 360 no significa que Suppliers sea propietario de su lifecycle.

La vista únicamente combina contexto.

---

# 46. UX actual

La interfaz implementada utiliza una organización por secciones semejante a:

```text
General

Contacto

Dirección

Notas
```

Este patrón es compatible con `ZAPING_WAY.md`.

---

# 47. General

Puede incluir principalmente:

```text
Nombre
Estado
```

y otros datos maestros futuros.

---

# 48. Contacto

Puede incluir:

```text
Nombre del contacto
Email
Teléfono
```

---

# 49. Dirección

Actualmente representa el campo:

```text
address
```

sin afirmar que exista una entidad Address independiente.

---

# 50. Notas

Debe mantenerse como información secundaria.

No debe competir visualmente con los datos necesarios para identificar al Supplier.

---

# 51. Listado

La tabla principal puede priorizar:

```text
Proveedor
Contacto
Teléfono
Email
Estado
Acciones
```

La composición exacta puede evolucionar con UX.

---

# 52. Empty State

Ejemplo:

```text
Todavía no hay proveedores.

Registra tu primer proveedor para comenzar
a crear órdenes de compra.

[Agregar proveedor]
```

---

# 53. Estado

Supplier debe utilizar un patrón visual consistente mediante:

```text
StatusBadge
```

o equivalente.

Ejemplo:

```text
Activo
Inactivo
```

---

# 54. Crear Supplier

Para crear un Supplier se requiere al menos:

```text
name
```

según el modelo actual.

Otros campos son opcionales.

---

# 55. Create y tenant

El backend debe asignar:

```text
companyId
```

utilizando el contexto autenticado.

No debe aceptar el tenant desde frontend como autoridad.

---

# 56. Update Supplier

Puede permitir modificar:

* name;
* email;
* phone;
* address;
* contactName;
* notes;
* isActive;

según DTO y reglas actuales.

---

# 57. Cambio de nombre

Al cambiar `name` debe verificarse nuevamente:

```text
unique(companyId, name)
```

excluyendo al Supplier actual.

---

# 58. Not Found

Solicitar un Supplier inexistente debe devolver un error apropiado.

La implementación actual ya contempla manejo explícito de `NotFound`.

---

# 59. Wrong Tenant

Un Supplier perteneciente a otra Company debe tratarse como recurso no accesible.

No debe devolverse simplemente porque el UUID exista.

---

# 60. API

El módulo implementado utiliza un CRUD de Suppliers protegido mediante autenticación.

Conceptualmente:

```text
GET    /suppliers
GET    /suppliers/:id
POST   /suppliers
PATCH  /suppliers/:id
```

La operación actual o histórica de eliminación/desactivación debe revisarse progresivamente contra ADR-012.

---

# 61. API de lifecycle objetivo

Preferir una operación cuyo significado sea:

```text
isActive = false
```

cuando el usuario realmente desea dejar de utilizar al Supplier.

No es necesario cambiar inmediatamente la API únicamente por estilo si el comportamiento actual todavía está siendo migrado.

---

# 62. SupplierSelector

La dirección UX contempla:

```text
SupplierSelector
```

como Business Component reutilizable.

Debe permitir:

```text
Search
↓
Identify
↓
Select Supplier
```

dentro de workflows como Purchases.

---

# 63. Estado de SupplierSelector

La documentación histórica lo identificaba como componente planeado dentro de la Business Components Library.

Su existencia técnica actual deberá confirmarse directamente en el frontend antes de marcarlo documentalmente como `IMPLEMENTED`.

---

# 64. Select tradicional

Para pocos Suppliers puede funcionar inicialmente un `<select>`.

Pero conforme crezca el catálogo debe preferirse:

```text
Searchable SupplierSelector
```

para mantener escalabilidad de UX.

---

# 65. Creación contextual

Una evolución útil puede permitir:

```text
Nueva Purchase
↓
SupplierSelector
↓
Proveedor no existe
↓
[Crear proveedor]
↓
Supplier creado
↓
continuar Purchase
```

sin perder el formulario original.

---

# 66. Búsqueda

La búsqueda debe priorizar información reconocible.

Ejemplos:

```text
name
contactName
email
```

cuando la implementación lo soporte.

---

# 67. Filtros

Filtros futuros pueden incluir:

```text
Active
Inactive
```

y posteriormente otros criterios si aparecen necesidades reales.

---

# 68. Multi-tenancy

Todas las búsquedas deben incorporar el tenant.

Conceptualmente:

```text
WHERE companyId = authenticatedCompanyId
```

---

# 69. Seguridad

El módulo debe respetar:

```text
Authentication
+
Authorization
+
Tenant Isolation
+
Validation
```

como todos los módulos empresariales.

---

# 70. RBAC

Una futura granularidad puede incluir:

```text
suppliers.read
suppliers.create
suppliers.update
suppliers.deactivate
```

Los permisos definitivos se implementarán progresivamente según ADR-007.

---

# 71. Auditoría

Cambios relevantes pueden requerir eventos como:

```text
Supplier created
Supplier updated
Supplier deactivated
Supplier reactivated
```

---

# 72. Datos sensibles

No deben almacenarse innecesariamente secretos o información bancaria dentro de:

```text
notes
```

sin un modelo y controles adecuados.

---

# 73. Información bancaria futura

Si posteriormente se administran:

* cuentas bancarias;
* CLABE;
* condiciones de pago;

debe evaluarse:

* permisos;
* cifrado cuando corresponda;
* auditoría;
* minimización;
* exposición API.

No pertenece actualmente al modelo base de Supplier.

---

# 74. RFC / información fiscal

El Supplier actual no contiene un modelo fiscal completo.

La futura facturación/compras fiscales puede necesitar:

```text
RFC
Razón social
Régimen
Código postal fiscal
```

Estos datos deberán diseñarse junto con Billing/CFDI y no agregarse de manera aislada.

---

# 75. Condiciones de pago

Conceptos futuros pueden incluir:

```text
Contado
Crédito 15 días
Crédito 30 días
```

Si comienzan a determinar vencimientos o cuentas por pagar, deben convertirse en información estructurada.

---

# 76. Lead Time

El tiempo habitual de entrega puede ser útil posteriormente para recomendaciones de compra.

Conceptualmente:

```text
Supplier lead time
+
stock
+
demand
↓
replenishment recommendation
```

No forma parte todavía de la lógica obligatoria.

---

# 77. Evaluación de proveedores

Una evolución futura puede medir:

* puntualidad;
* precio;
* diferencias de recepción;
* calidad;
* incidencias.

No debe implementarse como un simple rating manual sin definir primero qué significa.

---

# 78. Supplier Performance

Ejemplo futuro:

```text
Supplier ABC

On-time delivery      92%
Average lead time     4.8 días
Receipt discrepancies 2%
```

Esto debe derivarse de operaciones reales cuando sea posible.

---

# 79. Zaping AI futuro

La información histórica de Supplier puede alimentar recomendaciones como:

```text
Proveedor A es 8 % más económico,
pero tarda en promedio 4 días más.
```

La IA no debe inventar métricas que Zaping no pueda respaldar con datos.

---

# 80. Importación

Suppliers forma parte de las entidades prioritarias para futura importación masiva.

Debe contemplarse:

```text
CSV / XLSX
↓
Mapping
↓
Validation
↓
Duplicate detection
↓
Import
```

---

# 81. Duplicados durante importación

Actualmente el principal identificador de duplicado disponible es:

```text
name within Company
```

Una futura estructura fiscal puede proporcionar identificadores más sólidos como RFC.

---

# 82. Migraciones desde otros ERP

En migraciones desde:

```text
CONTPAQi
Aspel
Microsip
Odoo
SAP
Excel
```

debe preservarse, cuando exista:

* identificador externo;
* nombre;
* contacto;
* estado;
* historial relevante.

No debe mezclarse automáticamente el identificador externo con el UUID interno.

---

# 83. External ID futuro

El módulo de importaciones puede requerir una estrategia de referencia externa.

No se agrega `externalId` a Supplier únicamente desde este documento.

---

# 84. Dashboard

Dashboard puede consumir información de Suppliers para métricas o tareas.

Ejemplo futuro:

```text
Suppliers activos
Purchases por Supplier
Pending receipts
```

Dashboard no es propietario de las reglas.

---

# 85. Warehouse Operations

Warehouse normalmente consume Purchases y Receipts.

El Supplier puede mostrarse como contexto:

```text
OC-001
Supplier: ABC Medical
```

sin requerir que Warehouse administre directamente el catálogo.

---

# 86. Healthcare

Healthcare puede necesitar conocer el origen de determinados productos o lotes.

La trazabilidad correcta continúa siendo:

```text
Supplier
↓
Purchase
↓
PurchaseReceipt
↓
InventoryBatch
↓
Case
```

Healthcare no debe crear su propio catálogo duplicado de Suppliers.

---

# 87. Supplier vs Manufacturer

Supplier y Manufacturer son conceptos distintos.

Un Supplier:

> vende o suministra el producto a la Company.

Un Manufacturer:

> fabrica el producto.

Una misma organización puede desempeñar ambos roles, pero el dominio no debe asumir que siempre son equivalentes.

---

# 88. Supplier vs Brand

También:

```text
Supplier
≠
Brand
```

Ejemplo:

```text
Brand: Terumo
Supplier: Distribuidora ABC
```

puede ser perfectamente válido.

---

# 89. Estado CURRENT

El módulo actual contempla:

```text
Supplier
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
Purchase relationship
name uniqueness per Company
authenticated CRUD
duplicate handling
NotFound handling
```

El schema y código son la fuente técnica exacta.

---

# 90. Estado TARGET

Evolución aprobada:

```text
Correct active/inactive lifecycle
Supplier 360
Searchable SupplierSelector
Contextual creation
Improved audit
OpenAPI documentation
Import support
```

---

# 91. Estado FUTURE

Capacidades posibles:

```text
Multiple contacts
Structured addresses
Fiscal profile
Payment terms
Supplier Product Catalog
Supplier-specific product codes
Lead times
Price history
Performance metrics
Supplier documents
Banking information
Supplier portal
AI recommendations
```

Estas capacidades no forman parte automáticamente del MVP.

---

# 92. Invariantes

```text
Supplier
→ belongs to one Company
```

```text
Supplier name
→ unique within Company
```

```text
Purchase supplier
→ same Company
```

```text
Inactive Supplier
→ remains historically visible
```

```text
Inactive Supplier
→ normally unavailable for new Purchases
```

```text
Supplier deactivation
→ does not delete Purchases
```

```text
Supplier
≠
Product owner
```

```text
Supplier
≠
Manufacturer
```

```text
Supplier
≠
Brand
```

---

# 93. Anti-patrones

## Fixed Supplier on Product

```text
Product.supplierId
```

como única fuente de abastecimiento.

---

## Hard Delete Historical Supplier

Borrar un Supplier que ya participa en Purchases.

---

## Cross-Tenant Supplier

```text
Company A Purchase
→ Supplier Company B
```

---

## Notes as Database

Guardar fiscal, crédito, lead time y múltiples contactos dentro de un solo campo `notes` cuando ya afectan workflows.

---

## Duplicate Supplier Catalogs

Crear un catálogo separado de proveedores únicamente para Healthcare.

---

## UI Security

Asumir que esconder Suppliers de otro tenant en frontend es suficiente.

---

# 94. Relación con Products

```text
Supplier
→ source of procurement

Product
→ catalog identity
```

Se conectan mediante operaciones de abastecimiento.

---

# 95. Relación con Purchases

```text
Supplier
↓
Purchase
```

Purchases es el consumidor principal del Supplier dentro del ERP Core actual.

---

# 96. Relación con Inventory

Supplier puede formar parte de la trazabilidad del origen.

Pero Inventory continúa siendo propietario de las existencias.

---

# 97. Relación con Zaping Way

La experiencia debe evitar que el usuario abandone una Purchase solo para consultar información básica del Supplier.

`Purchase 360` puede mostrar contexto suficiente y permitir navegar a `Supplier 360` cuando se necesite mayor detalle.

---

# 98. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-012 — Entity Lifecycle.

---

# 99. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md
architecture/ARCHITECTURE.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
ux/BUSINESS_COMPONENTS.md
modules/erp/PRODUCTS.md
modules/erp/PURCHASES.md
modules/erp/INVENTORY.md
```

---

# 100. Fuente de verdad

La división documental es:

```text
SUPPLIERS.md
→ reglas del catálogo de proveedores

PURCHASES.md
→ operaciones con proveedores

INVENTORY.md
→ consecuencia física y trazabilidad

schema.prisma
→ modelo técnico vigente

backend
→ implementación actual

tests
→ comportamiento validado

PROJECT_BOARD.md
→ estado del trabajo
```

---

# 101. Principio final

Supplier debe representar de forma estable:

```text
quién abastece a la empresa
```

sin absorber las reglas de compra o inventario.

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

> **El proveedor identifica la contraparte. La compra registra el compromiso. La recepción confirma lo que llegó. Inventory registra la consecuencia física.**
