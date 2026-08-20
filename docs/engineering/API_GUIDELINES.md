# Guía de APIs — Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Engineering Team

---

# 1. Propósito

Este documento define las convenciones generales para diseñar y mantener las APIs de Zaping.

Su objetivo es mantener contratos:

* consistentes;
* seguros;
* predecibles;
* comprensibles;
* extensibles;
* y alineados con los dominios del producto.

Este documento define reglas transversales.

No pretende mantener manualmente una referencia completa de cada endpoint.

La documentación detallada de endpoints deberá evolucionar hacia **OpenAPI / Swagger generado desde el backend**.

---

# 2. Alcance

Estas reglas aplican principalmente a la **Application API** utilizada por las aplicaciones oficiales de Zaping.

También proporcionan la base para una futura **Public API**.

---

# 3. Principio API First

Zaping adopta API First.

Esto significa:

> Las capacidades de negocio pertenecen a la plataforma y no a una interfaz específica.

Actualmente:

```text
Web Application
↓
Application API
↓
Business Logic
```

En el futuro otros consumidores podrán reutilizar contratos apropiados:

```text
Mobile App
Customer Portal
External Integrations
Public API
```

API First no significa que todas las APIs sean públicas.

---

# 4. Application API vs Public API

## Application API

API utilizada por aplicaciones oficiales de Zaping.

Ejemplos:

* Web Application;
* futura Mobile App;
* futuro Customer Portal.

Puede evolucionar coordinadamente con estos consumidores.

---

## Public API

Interfaz futura destinada a terceros.

Requerirá controles adicionales como:

* versionado estable;
* API credentials;
* scopes;
* rate limiting;
* documentación pública;
* políticas de deprecación;
* auditoría;
* lifecycle contractual.

La Public API no debe asumirse implementada actualmente.

---

# 5. Estilo actual

La API principal utiliza:

```text
REST
HTTP
JSON
```

REST continúa siendo la opción predeterminada mientras resuelva adecuadamente las necesidades del producto.

No introducir:

* GraphQL;
* gRPC;
* RPC personalizado;

sin una necesidad clara.

---

# 6. URLs

Las URLs deben representar recursos o acciones empresariales comprensibles.

Preferir:

```text
/customers
/products
/purchases
/sales-orders
```

sobre nombres técnicos internos.

---

# 7. Recursos en plural

Los recursos utilizan nombres en plural.

Correcto:

```text
/customers
/products
/purchases
```

Evitar:

```text
/customer
/product
/purchase
```

---

# 8. Nombres compuestos

Para recursos compuestos se prefiere `kebab-case`.

Ejemplos:

```text
/sales-orders
/purchase-receipts
/inventory-movements
```

Cuando una relación natural sea más clara mediante nesting, puede utilizarse una ruta anidada.

Ejemplo:

```text
/purchases/:purchaseId/receipts
```

---

# 9. No utilizar verbos CRUD en rutas

Evitar:

```text
/createCustomer
/updateProduct
/deleteSupplier
/getPurchases
```

Preferir:

```text
POST   /customers
PATCH  /products/:id
DELETE /suppliers/:id
GET    /purchases
```

El método HTTP ya expresa la operación CRUD.

---

# 10. Acciones de negocio

No todas las operaciones empresariales son CRUD.

Cuando exista una transición o comando de negocio relevante, se permite una acción explícita.

Ejemplos:

```text
POST /purchases/:id/approve
POST /deliveries/:id/confirm
POST /sales-orders/:id/cancel
```

Esto es preferible a ocultar una transición importante dentro de un `PATCH` genérico cuando perjudica la claridad.

---

# 11. Recursos anidados

Utilizar nesting cuando existe una relación fuerte y mejora el significado.

Ejemplo:

```text
POST /purchases/:purchaseId/receipts
GET  /purchases/:purchaseId/receipts
```

Evitar nesting excesivo como:

```text
/companies/:companyId/purchases/:purchaseId/receipts/:receiptId/items/:itemId
```

cuando el recurso puede identificarse de manera más simple y segura.

---

# 12. `companyId` en rutas

Para operaciones normales de usuarios empresariales no debe ser necesario exponer:

```text
/companies/:companyId/...
```

en cada endpoint.

El tenant debe derivarse principalmente del contexto autenticado.

Conceptualmente:

```text
JWT
↓
Authenticated User
↓
companyId
↓
Business Operation
```

Esto reduce el riesgo de manipulación de tenant.

---

# 13. Métodos HTTP

Las convenciones generales son:

| Método | Uso principal                                          |
| ------ | ------------------------------------------------------ |
| GET    | consultar                                              |
| POST   | crear o ejecutar comando                               |
| PATCH  | modificar parcialmente                                 |
| PUT    | reemplazo completo cuando realmente aplique            |
| DELETE | eliminar cuando la semántica sea realmente eliminación |

`PUT` no debe utilizarse automáticamente.

En la mayoría de formularios empresariales, `PATCH` será suficiente.

---

# 14. GET

`GET` debe ser seguro desde perspectiva de efectos empresariales.

No debe:

* modificar stock;
* confirmar documentos;
* cancelar operaciones;
* crear auditoría de negocio que altere estado;
* ejecutar acciones destructivas.

Puede generar logs técnicos de lectura cuando corresponda.

---

# 15. POST

Utilizar `POST` para:

* crear recursos;
* registrar eventos;
* ejecutar comandos.

Ejemplos:

```text
POST /customers
POST /purchases/:id/receipts
POST /deliveries/:id/confirm
```

---

# 16. PATCH

Utilizar `PATCH` para modificaciones parciales permitidas.

Ejemplo:

```text
PATCH /products/:id
```

No debe utilizarse para reescribir silenciosamente un documento histórico confirmado.

---

# 17. DELETE

`DELETE` no significa necesariamente:

```sql
DELETE FROM table
```

La semántica depende del recurso.

Sin embargo, si el comportamiento real es una acción empresarial como:

```text
Cancelar compra
Desactivar producto
```

se debe preferir una API que exprese esa intención.

Ejemplos:

```text
POST /purchases/:id/cancel
```

o:

```text
PATCH /products/:id
{
  "isActive": false
}
```

---

# 18. Versionado

La documentación anterior establecía:

```text
/api/v1
```

como requisito global.

Esta convención no se considera actualmente obligatoria para toda la Application API.

La decisión vigente es:

> Introducir versionado cuando exista una necesidad contractual real de mantener versiones incompatibles simultáneamente.

La futura Public API sí deberá utilizar una estrategia explícita de versionado.

Hasta entonces no deben agregarse prefijos únicamente para aparentar madurez de API.

---

# 19. Compatibilidad

Un cambio en:

```text
schema.prisma
```

no debe provocar automáticamente un cambio en el contrato HTTP.

Persistencia y API son capas diferentes.

Antes de modificar un contrato consumido debe revisarse:

* frontend;
* integraciones;
* tests;
* compatibilidad;
* posibilidad de migración progresiva.

---

# 20. DTOs

La entrada HTTP debe definirse mediante DTOs.

Ejemplos:

```text
CreateCustomerDto
UpdateCustomerDto
CreatePurchaseDto
CreatePurchaseReceiptDto
```

Los DTO deben aceptar únicamente campos permitidos por esa operación.

---

# 21. DTO no equivale a modelo Prisma

No utilizar automáticamente los modelos Prisma como contratos públicos.

Ejemplo conceptual:

```text
Prisma User
```

puede contener:

```text
passwordHash
```

que no pertenece al contrato de respuesta.

---

# 22. Validación

Los requests deben validarse.

Actualmente se utilizan:

```text
class-validator
class-transformer
ValidationPipe
```

La validación HTTP debe verificar:

* tipo;
* formato;
* requeridos;
* valores permitidos;
* estructura.

Las reglas empresariales complejas pertenecen al Service o dominio.

---

# 23. Whitelist

Los DTO deben impedir Mass Assignment.

Campos no permitidos no deben poder modificarse simplemente enviándolos desde frontend.

Ejemplos especialmente sensibles:

```text
companyId
passwordHash
role
permissions
approvedBy
createdBy
internalStatus
```

cuando la operación no permita modificarlos.

---

# 24. Authentication

Los endpoints privados requieren autenticación.

Actualmente:

```text
Authorization: Bearer <JWT>
```

El token debe validarse en backend.

La ausencia o invalidez de autenticación debe producir una respuesta apropiada.

---

# 25. Authorization

Authentication no concede acceso completo.

Cada operación debe evaluar los permisos correspondientes.

Conceptualmente:

```text
Authenticated
+
Authorized
+
Correct Tenant
```

---

# 26. Multi-tenancy

Todas las operaciones empresariales deben garantizar aislamiento por Company.

Esto incluye:

* GET;
* POST;
* PATCH;
* DELETE;
* búsquedas;
* relaciones;
* reportes;
* exportaciones.

---

# 27. UUID no es autorización

Un endpoint como:

```text
GET /customers/:id
```

no debe devolver el recurso únicamente porque el UUID exista.

Debe comprobar:

```text
resource belongs to authenticated tenant
```

y los permisos requeridos.

---

# 28. Relaciones

Cuando un request relaciona recursos, todos deben validarse dentro del tenant.

Ejemplo:

```text
CreatePurchase
supplierId
productId
```

no debe permitir utilizar un Supplier o Product perteneciente a otra Company.

---

# 29. Respuestas JSON

Las APIs utilizan JSON como formato predeterminado.

Las respuestas deben contener únicamente información necesaria para el consumidor.

No devolver objetos enormes por comodidad.

---

# 30. Recurso creado

Una creación exitosa utiliza normalmente:

```text
201 Created
```

y devuelve el recurso o representación necesaria para continuar el workflow.

---

# 31. Operación exitosa

Una consulta o modificación exitosa utiliza normalmente:

```text
200 OK
```

cuando existe contenido de respuesta.

---

# 32. Sin contenido

Puede utilizarse:

```text
204 No Content
```

cuando una operación exitosa no necesita devolver contenido.

Debe utilizarse consistentemente y solo cuando facilite el contrato.

---

# 33. Errores

La API debe utilizar errores consistentes.

La estructura objetivo es:

```json
{
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Ya existe un producto con este SKU.",
  "details": {}
}
```

`details` puede omitirse cuando no exista información adicional útil.

---

# 34. Catálogo base de errores

Categorías iniciales:

| HTTP | Code                    | Significado                          |
| ---: | ----------------------- | ------------------------------------ |
|  400 | `VALIDATION_ERROR`      | Request inválido                     |
|  401 | `UNAUTHORIZED`          | Autenticación faltante o inválida    |
|  403 | `FORBIDDEN`             | Usuario autenticado sin autorización |
|  404 | `NOT_FOUND`             | Recurso inexistente o no accesible   |
|  409 | `CONFLICT`              | Conflicto de estado o unicidad       |
|  422 | `BUSINESS_RULE_FAILED`  | Regla empresarial no satisfecha      |
|  500 | `INTERNAL_SERVER_ERROR` | Error inesperado                     |

El catálogo puede ampliarse cuando exista valor real.

---

# 35. 400 Bad Request

Utilizar principalmente para errores estructurales de request.

Ejemplos:

* tipo inválido;
* campo requerido faltante;
* formato inválido.

---

# 36. 401 Unauthorized

Representa:

> no existe una identidad autenticada válida.

No significa:

> el usuario existe pero carece del permiso.

Ese escenario corresponde a `403`.

---

# 37. 403 Forbidden

Representa:

> el usuario está autenticado, pero no puede realizar la operación.

---

# 38. 404 Not Found

Puede utilizarse cuando:

* el recurso no existe;
* el recurso no pertenece al tenant y revelar su existencia representaría un riesgo.

La estrategia concreta debe mantenerse consistente.

---

# 39. 409 Conflict

Utilizar cuando la operación entra en conflicto con el estado actual.

Ejemplos:

* SKU duplicado;
* email duplicado;
* documento ya confirmado;
* transición incompatible.

---

# 40. 422 Business Rule Failed

Puede utilizarse para reglas empresariales válidamente formadas pero imposibles de ejecutar.

Ejemplo conceptual:

```text
Confirm Delivery
↓
insufficient available inventory
```

La frontera exacta entre `409` y `422` debe mantenerse consistente por tipo de error.

No utilizar ambos aleatoriamente para el mismo escenario.

---

# 41. 500 Internal Server Error

Debe reservarse para errores inesperados.

El response no debe exponer:

* stack trace;
* SQL;
* Prisma internals;
* secretos;
* infraestructura.

El detalle técnico pertenece a logs seguros.

---

# 42. Mensajes de error

Los mensajes deben ser:

* comprensibles;
* específicos;
* útiles.

Preferir:

```text
No hay inventario suficiente para confirmar la entrega.
```

sobre:

```text
Operation failed.
```

Pero no deben revelar información sensible.

---

# 43. Business Error Codes

Los códigos permiten al frontend interpretar errores sin depender del texto.

Ejemplo futuro:

```text
INSUFFICIENT_STOCK
PURCHASE_ALREADY_CONFIRMED
DELIVERY_ALREADY_CONFIRMED
DUPLICATE_SKU
```

No es necesario crear cientos de códigos anticipadamente.

Deben introducirse cuando exista una necesidad de comportamiento cliente diferenciable.

---

# 44. Paginación

Los listados que pueden crecer deben soportar paginación.

Convención inicial:

```text
?page=1&pageSize=20
```

---

# 45. Respuesta paginada

Formato objetivo:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 520,
    "totalPages": 26
  }
}
```

---

# 46. Límites de página

El backend debe definir un `pageSize` máximo razonable.

No debe confiarse en que frontend enviará siempre valores pequeños.

El límite concreto puede configurarse según el tipo de recurso.

---

# 47. Paginación no obligatoria para todo

Catálogos muy pequeños o endpoints especializados pueden no requerir paginación.

No debe añadirse artificialmente cuando no aporta valor.

Pero una colección con crecimiento potencial no debe cargar miles de registros sin límites.

---

# 48. Búsqueda

Convención inicial:

```text
?search=
```

Ejemplo:

```text
GET /customers?search=medical
```

El significado concreto de `search` debe documentarse por recurso cuando no sea evidente.

---

# 49. Filtros

Filtros simples pueden utilizar query parameters.

Ejemplos:

```text
?status=
?isActive=
?supplierId=
?customerId=
```

No crear sistemas genéricos de filtros complejos hasta que exista una necesidad real.

---

# 50. Ordenamiento

Convención inicial:

```text
?sort=name&order=asc
```

Valores típicos:

```text
asc
desc
```

El backend debe validar qué campos pueden utilizarse para ordenar.

No debe aceptar nombres arbitrarios de columnas de base de datos.

---

# 51. Fechas

Las fechas intercambiadas mediante API deben utilizar ISO 8601.

Ejemplo:

```text
2026-08-19T22:30:00Z
```

Cuando exista una fecha sin hora, el contrato debe indicar claramente que se trata de una fecha calendario.

Ejemplo:

```text
2026-08-19
```

---

# 52. Timezones

Los timestamps persistidos deben seguir una estrategia consistente.

Cuando el negocio dependa de la zona horaria local —por ejemplo un Case programado— debe conservarse suficiente contexto para representar correctamente el horario.

La estrategia detallada de calendario se definirá con Healthcare.

---

# 53. Enums

Los valores de enums deben mantenerse consistentes con el dominio.

Ejemplo:

```text
DRAFT
CONFIRMED
CANCELLED
```

No cambiar valores públicos de enum sin revisar consumidores y datos existentes.

---

# 54. Booleanos

Preferir valores booleanos explícitos:

```json
{
  "isActive": true
}
```

en lugar de strings ambiguos:

```json
{
  "isActive": "yes"
}
```

---

# 55. Dinero

Las APIs que manejen dinero deben mantener una estrategia consistente.

Deben evitar:

* formatos locales dentro del JSON;
* símbolos de moneda dentro de campos numéricos.

Ejemplo conceptual:

```json
{
  "subtotal": 1000,
  "tax": 160,
  "total": 1160,
  "currency": "MXN"
}
```

La estrategia definitiva de precisión monetaria debe definirse antes de ampliar capacidades financieras.

---

# 56. IDs y folios

No confundir:

```text
id
```

con:

```text
folio
```

Ejemplo:

```json
{
  "id": "uuid...",
  "folio": "OC-000421"
}
```

`id` representa identidad técnica.

`folio` representa referencia empresarial.

---

# 57. Recursos históricos

Una API no debe permitir reescribir libremente entidades históricas confirmadas.

Ejemplo:

```text
PurchaseReceipt CONFIRMED
```

no debe aceptar un PATCH genérico que modifique cantidades que ya afectaron Inventory.

Debe respetarse ADR-012.

---

# 58. Confirmaciones

Cuando una operación tenga efectos empresariales importantes, debe existir una transición explícita.

Ejemplo:

```text
POST /deliveries/:id/confirm
```

El backend debe verificar:

* estado actual;
* permisos;
* tenant;
* reglas;
* disponibilidad;
* consistencia.

---

# 59. Idempotencia de efectos

Una operación confirmable no debe generar dos efectos por repetirse accidentalmente.

Ejemplo:

```text
Delivery D-001
confirm
↓
Inventory OUT
```

un segundo request de confirmación no debe producir otro `OUT`.

En la Application API esto puede protegerse inicialmente mediante estado y transacciones.

Una futura Public API podrá requerir mecanismos adicionales como idempotency keys.

---

# 60. Transacciones

Una API que ejecuta un caso de uso compuesto debe asegurar consistencia.

Ejemplo:

```text
POST /purchases/:id/receipts
```

puede involucrar:

```text
PurchaseReceipt
+
Items
+
Batch
+
InventoryMovement
+
Stock
```

La respuesta exitosa solo debe producirse cuando la operación haya quedado consistentemente aplicada.

---

# 61. Optimistic assumptions

No debe confiarse en que el estado observado por frontend continúa siendo válido al enviar la operación.

El backend debe verificar nuevamente precondiciones críticas.

Ejemplo:

Frontend muestra 10 unidades disponibles.

Antes de confirmar Delivery, backend debe volver a validar disponibilidad.

---

# 62. Inventario

Ninguna API externa a Inventory debe permitir modificar:

```text
stock
```

como un valor arbitrario.

Debe utilizarse una operación de negocio.

Ejemplos:

```text
PurchaseReceipt
Delivery
Return
Adjustment
Case Reconciliation
```

---

# 63. Compras

La arquitectura correcta es:

```text
Purchase
≠
Inventory IN
```

Por tanto:

```text
POST /purchases
```

no debe aumentar inventario.

La entrada ocurre mediante Receipt confirmado.

---

# 64. Recepciones

La forma recomendada conceptualmente es:

```text
POST /purchases/:purchaseId/receipts
```

La implementación definitiva puede incluir posteriormente acciones como:

```text
POST /purchase-receipts/:id/confirm
```

si el lifecycle distingue Draft de Confirmed.

---

# 65. Ventas

La arquitectura objetivo distingue:

```text
SalesOrder
≠
Delivery
```

Una API futura de Sales no debe volver a introducir implícitamente:

```text
Create Sale
→ Inventory OUT
```

como única semántica.

---

# 66. Delivery

La salida definitiva ocurre mediante Delivery confirmada.

API conceptual:

```text
POST /sales-orders/:salesOrderId/deliveries
POST /deliveries/:id/confirm
```

Los endpoints definitivos se formalizarán al implementar ADR-011.

---

# 67. Healthcare

La API Healthcare debe mantener separados:

```text
Case
CaseKit
CaseDispatch
CaseReturn
Reconciliation
```

No debe representar `CaseDispatch` mediante una Delivery comercial.

---

# 68. Custodia

Una API de Dispatch debe representar cambio de custodia.

No debe producir automáticamente un `Inventory OUT` definitivo.

Esto está definido en ADR-013.

---

# 69. API de reportes

Reportes y dashboards deben respetar exactamente:

* tenant;
* autorización;
* filtros;
* información sensible.

Un endpoint de reportes no puede convertirse en una vía alternativa para saltarse permisos.

---

# 70. Exportaciones

Las exportaciones siguen las mismas reglas de seguridad que los listados normales.

Nunca deben exportar datos de otro tenant o información que el usuario no puede consultar.

---

# 71. Rate Limiting

No es requisito universal inmediato para cada endpoint interno.

Debe priorizarse en:

* login;
* password reset;
* endpoints públicos;
* Public API;
* operaciones costosas expuestas.

---

# 72. CORS

CORS debe configurarse por entorno.

No debe utilizarse una política excesivamente abierta en producción sin justificación.

---

# 73. Logging

La API puede registrar información técnica como:

* método;
* ruta;
* status;
* duración;
* request ID.

No debe registrar:

* contraseñas;
* JWT completos;
* secretos;
* datos sensibles innecesarios.

---

# 74. Request ID / Correlation ID

En una etapa posterior puede incorporarse un identificador por request para facilitar:

* logs;
* debugging;
* integraciones;
* observabilidad.

No constituye requisito inmediato del Core.

---

# 75. Audit

Los eventos empresariales sensibles deben generar auditoría cuando corresponda.

Ejemplo:

```text
POST /deliveries/:id/confirm
```

puede requerir registrar:

* usuario;
* fecha;
* Delivery;
* resultado.

Audit y HTTP logging son conceptos distintos.

---

# 76. Documentación detallada de endpoints

No se mantendrá indefinidamente un archivo Markdown manual por cada módulo API.

La referencia técnica detallada debe evolucionar hacia:

```text
NestJS decorators / DTOs
↓
OpenAPI / Swagger
↓
Generated API Reference
```

Esto reduce discrepancias entre documentación y código.

---

# 77. Swagger / OpenAPI

**Estado:** objetivo de ingeniería.

Cuando se implemente de forma completa debe documentar:

* endpoints;
* DTOs;
* parámetros;
* responses;
* authentication;
* schemas.

La documentación funcional de negocio continuará viviendo en los documentos de módulos.

---

# 78. División de responsabilidades documentales

```text
API_GUIDELINES.md
→ convenciones transversales

OpenAPI
→ contratos técnicos concretos

Module Documentation
→ reglas de negocio

ADR
→ decisiones arquitectónicas
```

No deben duplicar información innecesariamente.

---

# 79. Testing de API

Los endpoints críticos deben probar escenarios como:

```text
Success
Validation failure
Unauthorized
Forbidden
Wrong tenant
Not found
Conflict
Business rule failure
```

según corresponda.

---

# 80. Testing multi-tenant

Ejemplo obligatorio en dominios críticos:

```text
Company A user
↓
GET resource belonging to Company B
↓
DENIED
```

y:

```text
Company A user
↓
PATCH resource belonging to Company B
↓
DENIED
```

---

# 81. Testing de acciones críticas

Para operaciones con efectos deben probarse:

* estado permitido;
* estado inválido;
* doble confirmación;
* error transaccional;
* permisos;
* tenant;
* reglas empresariales.

---

# 82. Deprecación

Una futura Public API deberá tener una política formal de deprecación.

Para Application API interna puede existir una migración coordinada entre frontend y backend.

No mantener endpoints obsoletos indefinidamente sin consumidores reales.

---

# 83. Naming consistente

Una vez que un concepto tenga un nombre oficial debe mantenerse consistente entre:

```text
Domain
API
Documentation
Frontend
```

Ejemplo:

si el concepto aprobado es:

```text
PurchaseReceipt
```

evitar utilizar indistintamente:

```text
Receiving
PurchaseEntry
StockReception
```

para representar la misma entidad.

---

# 84. Cambios de dominio

Cuando una evolución arquitectónica cambie un concepto fundamental, la API debe migrarse deliberadamente.

Ejemplo:

```text
legacy Sale
↓
SalesOrder + Delivery
```

No debe resolverse únicamente renombrando endpoints si la semántica interna continúa siendo incorrecta.

---

# 85. Principios de diseño

Una buena API de Zaping debe ser:

```text
Predictable
+
Business-Oriented
+
Secure
+
Tenant-Aware
+
Validated
+
Traceable
+
Simple
```

---

# 86. Anti-patrones

Evitar:

```text
POST /createCustomer
```

```text
GET /deleteProduct?id=...
```

```text
POST /inventory/setStock
```

```text
PATCH /purchase-receipts/:id
quantityReceived = arbitrary value
after confirmation
```

```text
GET /companies/:companyId/customers
```

cuando el usuario normal puede manipular libremente `companyId`.

---

# 87. Ejemplo — Customer

Conceptualmente:

```text
GET    /customers
GET    /customers/:id
POST   /customers
PATCH  /customers/:id
```

La desactivación deberá seguir el lifecycle aprobado.

No se considera vigente la antigua regla:

```text
DELETE /customers/:id
→ universal Soft Delete
```

sin revisar la semántica del módulo.

---

# 88. Ejemplo — Purchases

```text
GET  /purchases
GET  /purchases/:id
POST /purchases

POST /purchases/:id/approve
POST /purchases/:id/receipts
```

Los endpoints exactos deben corresponder al lifecycle implementado.

---

# 89. Ejemplo — Sales objetivo

```text
GET  /sales-orders
GET  /sales-orders/:id
POST /sales-orders

POST /sales-orders/:id/cancel

POST /sales-orders/:id/deliveries
POST /deliveries/:id/confirm
```

Estos endpoints representan arquitectura objetivo y no deben interpretarse automáticamente como existentes actualmente.

---

# 90. Ejemplo — Healthcare objetivo

Conceptualmente:

```text
GET  /cases
POST /cases

POST /cases/:id/case-kits
POST /case-kits/:id/dispatch
POST /case-dispatches/:id/returns
POST /cases/:id/reconcile
```

El diseño definitivo se realizará con el módulo Healthcare.

---

# 91. Current vs Target

La documentación API debe distinguir cuando sea necesario:

```text
CURRENT
```

endpoint implementado actualmente.

```text
TARGET
```

contrato aprobado pero todavía pendiente.

```text
FUTURE
```

posibilidad no comprometida.

No debe presentarse arquitectura objetivo como si ya estuviera desplegada.

---

# 92. Fuente de verdad

Mientras OpenAPI completo no exista, la implementación backend es la fuente técnica para saber qué endpoints están actualmente disponibles.

Los documentos de módulo son la fuente de reglas empresariales.

Este archivo es la fuente de convenciones generales.

---

# 93. Documentos relacionados

* `PRODUCT_REQUIREMENTS.md`
* `ARCHITECTURE.md`
* `ENGINEERING_GUIDE.md`
* `SECURITY_PRINCIPLES.md`
* `QUALITY_STANDARDS.md`
* ADR-001 — Multi-Tenant
* ADR-005 — Layered Architecture
* ADR-006 — API First
* ADR-007 — RBAC
* ADR-009 — Modular Monolith
* ADR-011 — SalesOrder / Delivery
* ADR-012 — Entity Lifecycle
* ADR-013 — Inventory Custody / Case Logistics

---

# 94. Principio final

La API de Zaping debe expresar el negocio de forma clara.

Preferir:

```text
Register Purchase Receipt
Confirm Delivery
Cancel Sales Order
Reconcile Case
```

sobre operaciones técnicas que obliguen al consumidor a comprender cómo están almacenados los datos.

> **Una buena API expone capacidades del negocio, no detalles accidentales de la base de datos.**
