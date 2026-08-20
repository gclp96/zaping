# Módulo de Empresas — Zaping

**Módulo:** Companies
**Producto:** Zaping Platform / ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / FOUNDATION
**Última actualización:** 2026-08-19
**Responsable:** Zaping Platform Team

---

# 1. Propósito

El módulo Companies representa las empresas que utilizan Zaping.

Una `Company` constituye actualmente la principal frontera de aislamiento de datos de la plataforma.

Su responsabilidad principal es responder:

```text
¿A qué empresa pertenece este usuario?
¿Qué información pertenece a esa empresa?
¿Qué configuración base utiliza?
¿Qué datos puede consultar o modificar ese usuario?
```

---

# 2. Principio fundamental

En Zaping:

```text
Company
=
Tenant
```

dentro de la arquitectura actual.

Por tanto:

> **Los datos de una Company nunca deben quedar accesibles desde otra Company sin una capacidad explícita, autorizada y diseñada para ello.**

---

# 3. Arquitectura multi-tenant

Conceptualmente:

```text
Zaping Platform
│
├── Company A
│   ├── Users
│   ├── Customers
│   ├── Suppliers
│   ├── Products
│   ├── Inventory
│   ├── Purchases
│   ├── Quotes
│   └── Sales
│
└── Company B
    ├── Users
    ├── Customers
    ├── Suppliers
    ├── Products
    ├── Inventory
    ├── Purchases
    ├── Quotes
    └── Sales
```

Los dos tenants permanecen aislados.

---

# 4. Company no es Customer

Debe distinguirse:

```text
Company
→ empresa que utiliza Zaping
```

de:

```text
Customer
→ cliente comercial administrado por esa Company
```

Ejemplo:

```text
Company
INSAP
```

puede administrar:

```text
Customer
Hospital ABC
```

INSAP es el tenant.

Hospital ABC es un cliente dentro del tenant.

---

# 5. Company no es Supplier

También:

```text
Company
≠
Supplier
```

Supplier representa una contraparte de abastecimiento administrada dentro de la Company.

---

# 6. Company no es Hospital

Dentro de Healthcare:

```text
Company
≠
Hospital
```

La Company utiliza Zaping.

El Hospital puede ser:

* lugar de un Case;
* Customer;
* Payer;
* Organization externa;

dependiendo del contexto.

---

# 7. Company no es Organization externa

Si en el futuro Healthcare introduce:

```text
Organization
```

para representar hospitales, clínicas, aseguradoras u otras organizaciones externas, esa entidad debe permanecer conceptualmente separada de:

```text
Company
```

que representa el tenant de Zaping.

---

# 8. Modelo actual

El modelo vigente de referencia contiene conceptualmente:

```text
Company
├── id
├── name
├── tradeName
├── rfc
├── email
├── phone
├── language
├── timezone
├── currency
├── createdAt
├── updatedAt
└── relaciones empresariales
```

La definición exacta permanece en `schema.prisma`.

---

# 9. Identificador

Company utiliza:

```text
id
→ UUID
```

como identificador técnico.

El UUID no debe utilizarse como nombre empresarial visible para el usuario.

---

# 10. UUID no es control de acceso

Conocer:

```text
companyId
```

no concede autorización.

Un UUID difícil de adivinar no sustituye:

* Authentication;
* Authorization;
* Tenant Isolation.

---

# 11. `name`

`name` representa el nombre principal de la Company dentro de Zaping.

Debe utilizarse como identidad empresarial primaria cuando corresponda.

---

# 12. `tradeName`

El modelo también contiene:

```text
tradeName
```

opcional.

Permite distinguir un nombre comercial del nombre principal registrado.

---

# 13. No asumir todavía perfil fiscal completo

Aunque existen:

```text
name
tradeName
rfc
```

el modelo actual no debe interpretarse automáticamente como un perfil CFDI completo.

La facturación futura probablemente necesitará información adicional.

---

# 14. RFC

Actualmente:

```text
rfc
```

es obligatorio.

---

# 15. Unicidad de RFC

El schema de referencia utiliza:

```text
rfc @unique
```

Por tanto, actualmente:

> Un mismo RFC no puede existir en dos registros Company diferentes.

---

# 16. Unicidad global

La regla actual no es:

```text
unique(companyId, rfc)
```

porque Company es precisamente la raíz del tenant.

La unicidad de RFC es global dentro de la instalación de Zaping.

---

# 17. Consecuencia arquitectónica

El modelo actual representa aproximadamente:

```text
1 RFC
↓
1 Company
```

Esto es suficiente para la arquitectura vigente.

---

# 18. Posibles necesidades futuras

Si posteriormente Zaping necesita soportar escenarios como:

```text
misma entidad fiscal
+
varios espacios operativos
```

o:

```text
grupo empresarial
+
múltiples Companies
```

deberá revisarse esta restricción.

No debe modificarse ahora sin un caso funcional concreto.

---

# 19. Email

`email` es opcional.

Representa información de contacto de la Company.

---

# 20. Email de Company no es User

Debe distinguirse:

```text
Company.email
```

de:

```text
User.email
```

El email empresarial no constituye una credencial de autenticación.

---

# 21. Phone

`phone` es opcional.

Representa información de contacto empresarial.

No debe utilizarse como mecanismo de identificación técnica.

---

# 22. Language

El modelo contiene:

```text
language
```

con valor por defecto:

```text
es
```

Esto proporciona una base para internacionalización a nivel Company.

---

# 23. Language no sustituye preferencias de usuario

`User` también posee actualmente:

```text
locale
```

Por tanto, la plataforma debe mantener separadas conceptualmente:

```text
Company default language
```

y:

```text
User language / locale preference
```

La precedencia exacta debe formalizarse cuando se implemente completamente i18n.

---

# 24. Idioma de documentación

La documentación oficial del proyecto se mantiene actualmente en español.

Esto es independiente del soporte futuro multilenguaje de la aplicación.

---

# 25. Timezone

Company contiene:

```text
timezone
```

con default actual:

```text
America/Hermosillo
```

---

# 26. Propósito de Timezone

Timezone permite proporcionar contexto temporal de la empresa para información como:

* fechas operativas;
* calendarios;
* horarios;
* Dashboard;
* Healthcare Cases;
* reportes.

---

# 27. No depender del timezone del servidor

Una regla importante es:

> El comportamiento empresarial no debe depender accidentalmente de la zona horaria donde se encuentre ejecutándose el servidor.

---

# 28. Timestamp vs fecha de negocio

La existencia de `Company.timezone` no cambia la distinción ya establecida entre:

```text
Date
```

y:

```text
Timestamp
```

Ejemplo:

```text
expirationDate
→ fecha de negocio
```

mientras:

```text
Case scheduledStart
→ instante temporal
```

---

# 29. Política temporal

La política completa de almacenamiento y conversión temporal debe mantenerse consistente en toda la plataforma.

No debe implementarse una estrategia diferente por módulo.

---

# 30. Currency

Company contiene:

```text
currency
```

con default actual:

```text
MXN
```

---

# 31. Propósito de Currency

`currency` representa actualmente la moneda base/default de la Company.

Puede utilizarse para presentación y contexto empresarial.

---

# 32. Currency no constituye Multi-Currency

La existencia del campo:

```text
currency = "MXN"
```

no significa que Zaping ya implemente:

* conversiones;
* tipos de cambio;
* documentos multi-moneda;
* contabilidad multi-moneda;
* ganancias/pérdidas cambiarias.

---

# 33. Arquitectura monetaria futura

Si Zaping implementa Multi-Currency, deberán revisarse conjuntamente:

* Company;
* Products;
* Purchases;
* Quotes;
* Sales;
* Billing;
* reporting.

No debe resolverse simplemente cambiando `Company.currency`.

---

# 34. Company como raíz de datos

La arquitectura establece conceptualmente:

```text
Company
↓
Business Data
```

Cada operación debe tener una forma segura de determinar a qué Company pertenece.

---

# 35. Ownership directo

Algunas entidades contienen:

```text
companyId
```

directamente.

Ejemplos actuales incluyen:

```text
Customer
Supplier
Product
Category
Purchase
Quote
Sale
InventoryMovement
User
```

entre otras entidades conforme el modelo evoluciona.

---

# 36. Ownership heredado

No todas las tablas necesitan obligatoriamente duplicar:

```text
companyId
```

si su pertenencia puede demostrarse inequívocamente mediante su agregado.

Ejemplo conceptual:

```text
SaleItem
↓
Sale
↓
Company
```

---

# 37. Regla ADR-001

La pregunta correcta no es:

> ¿Todas las tablas tienen `companyId`?

La pregunta correcta es:

> ¿Podemos demostrar de forma segura a qué Company pertenece este recurso?

---

# 38. Tenant Context

Toda operación autenticada debe ejecutarse dentro de un Tenant Context.

Conceptualmente:

```text
Authenticated User
↓
Company Context
↓
Business Operation
```

---

# 39. companyId del frontend

En rutas normales de un usuario perteneciente a un tenant, frontend no debe actuar como autoridad enviando:

```json
{
  "companyId": "..."
}
```

para decidir qué Company utilizar.

---

# 40. Fuente de companyId

La Company debe derivarse del contexto autenticado.

Conceptualmente:

```text
JWT / Authentication
↓
User
↓
companyId
↓
Tenant Context
```

---

# 41. Payload enviado por cliente

Si el frontend envía un `companyId` para un recurso tenant-owned sin que el contrato lo requiera, backend no debe confiar en él.

---

# 42. Ejemplo incorrecto

```text
POST /products

companyId = Company B
```

enviado por un usuario autenticado perteneciente a Company A.

Nunca debe provocar creación dentro de Company B.

---

# 43. Ejemplo correcto

```text
Authenticated User
companyId = Company A
↓
POST /products
↓
Product.companyId = Company A
```

---

# 44. Queries

Las consultas tenant-owned deben respetar la frontera de Company.

Conceptualmente:

```text
WHERE companyId = authenticatedCompanyId
```

cuando la entidad posee ownership directo.

---

# 45. Query con ownership heredado

Cuando la entidad no posee `companyId` directo, el filtro debe aplicarse mediante su relación.

Ejemplo:

```text
SaleItem
WHERE
Sale.companyId = authenticatedCompanyId
```

o equivalente.

---

# 46. `findUnique` por ID

No debe asumirse que:

```text
findUnique({ id })
```

es suficiente para autorización tenant.

Después de localizar el recurso debe existir garantía de pertenencia a la Company.

---

# 47. UUID cross-tenant

Debe rechazarse:

```text
User Company A
↓
resourceId belonging to Company B
```

aunque el UUID sea técnicamente válido.

---

# 48. Nested relationships

También debe verificarse la pertenencia cuando una operación relaciona varias entidades.

Ejemplo:

```text
Purchase Company A
+
Supplier Company A
+
Products Company A
```

Nunca:

```text
Purchase Company A
+
Supplier Company B
```

---

# 49. Multi-tenant no es solo filtro de listado

Tenant Isolation debe proteger:

* list;
* read;
* create;
* update;
* state transitions;
* delete/deactivate;
* exports;
* PDFs;
* search;
* reports;
* Dashboard;
* file access;
* future Public API.

---

# 50. PDFs

Un endpoint PDF debe aplicar las mismas reglas de tenant que:

```text
GET resource
```

No debe considerarse seguro únicamente porque devuelve un archivo.

---

# 51. Exports

Lo mismo aplica a:

* CSV;
* XLSX;
* reports;
* backups;
* downloads.

---

# 52. Search

Una búsqueda nunca debe devolver resultados de otra Company.

Esto será especialmente importante para futura:

```text
Global Search
```

---

# 53. Dashboard

Todas las métricas deben estar calculadas en el contexto de la Company autenticada.

Nunca debe existir una agregación accidental global.

---

# 54. Background Jobs

Cuando en el futuro existan tareas asíncronas, cada job que opere datos empresariales deberá conservar un Tenant Context explícito.

No debe depender de:

```text
current logged-in request
```

si se ejecuta fuera de una request HTTP.

---

# 55. Domain Events

Un evento futuro relacionado con negocio debe conservar suficiente contexto para identificar la Company.

Conceptualmente:

```text
PurchaseReceiptRegistered
companyId
purchaseReceiptId
```

cuando resulte necesario.

---

# 56. Public API

La futura Public API deberá aplicar exactamente el mismo aislamiento.

Un API Key o token externo debe tener un scope de tenant claramente definido.

---

# 57. Customer Portal

El futuro Customer Portal también operará dentro de una Company.

Conceptualmente:

```text
External Customer User
↓
Company
↓
Authorized Customer Data
```

El usuario externo no debe poder elegir arbitrariamente otro tenant.

---

# 58. Mobile App

La futura aplicación móvil utilizará el mismo principio:

```text
Authenticated identity
↓
Company Context
↓
Authorized Resources
```

---

# 59. Radar

Zaping Radar puede manejar información externa al ERP.

Si Radar se integra con una Company deberá existir una frontera clara entre:

```text
global/external intelligence
```

y:

```text
company-specific configuration or opportunities
```

La arquitectura exacta se definirá dentro del módulo Radar.

---

# 60. Zaping AI

Zaping AI deberá respetar Tenant Isolation.

Una consulta como:

```text
¿Cuáles fueron mis ventas este mes?
```

solo puede utilizar información autorizada de la Company correspondiente.

---

# 61. AI no crea una excepción de seguridad

No debe existir:

```text
AI service
↓
global database access
↓
returns data from any Company
```

sin controles equivalentes o superiores a los del ERP.

---

# 62. Users

Actualmente cada User contiene:

```text
companyId
```

obligatorio.

Conceptualmente:

```text
Company
↓
Users[]
```

---

# 63. Un usuario pertenece actualmente a una Company

El modelo actual representa:

```text
User
→ one Company
```

No existe actualmente un modelo explícito de:

```text
User
↔ many Companies
```

---

# 64. No simular multi-company membership

No debe utilizarse:

* múltiples cuentas duplicadas;
* arrays de companyIds en JWT;
* excepciones manuales;

como sustituto improvisado de un modelo real de memberships si esa capacidad se necesita en el futuro.

---

# 65. Multi-company user futuro

Si posteriormente un usuario necesita acceder a varias Companies, requerirá diseño explícito.

Conceptualmente podría necesitarse una relación semejante a:

```text
User
↓
Company Membership
↓
Company
```

pero **no está aprobada como modelo Prisma actual**.

---

# 66. Company switching

Un futuro selector de Company solo deberá existir cuando el usuario tenga memberships autorizados.

No debe permitir introducir manualmente cualquier `companyId`.

---

# 67. Roles

Los roles actuales pertenecen al contexto de User.

Su semántica se documentará en:

```text
IDENTITY_ACCESS.md
```

---

# 68. Company y permisos

Company define la frontera:

```text
¿de qué tenant hablamos?
```

Authorization define:

```text
¿qué puede hacer este usuario dentro de ese tenant?
```

Son controles diferentes.

---

# 69. Regla de seguridad

Debe cumplirse:

```text
Authenticated
+
Correct role
+
Wrong tenant
=
DENY
```

---

# 70. Company Profile

Los campos actuales pueden proporcionar una primera configuración empresarial:

```text
name
tradeName
rfc
email
phone
language
timezone
currency
```

---

# 71. Settings

No es necesario crear actualmente una entidad:

```text
CompanySettings
```

solo para trasladar campos que ya funcionan correctamente en Company.

Debe aparecer cuando la cantidad o naturaleza de configuraciones justifique la separación.

---

# 72. Configuración no debe crecer sin control

Tampoco debe convertirse Company en una tabla con cientos de flags:

```text
enableX
enableY
enableZ
```

para cada feature futuro.

Cuando aparezca necesidad real de configuración modular deberá diseñarse una estrategia específica.

---

# 73. Feature configuration futura

Healthcare, Radar u otros productos pueden requerir determinar qué capacidades utiliza una Company.

La forma técnica de representar:

```text
enabled products / modules / features
```

no está definida todavía.

---

# 74. Company lifecycle actual

El modelo `Company` de referencia **no contiene actualmente**:

```text
isActive
deletedAt
status
```

Por tanto, este documento no inventa un lifecycle implementado.

---

# 75. No aplicar ADR-012 mecánicamente

Aunque muchas entidades Master Data utilizan `isActive`, no debe agregarse automáticamente:

```text
Company.isActive
```

solo por consistencia superficial.

La Company representa el tenant completo y necesita una semántica de lifecycle distinta.

---

# 76. Suspensión futura

Un SaaS puede necesitar posteriormente conceptos como:

```text
ACTIVE
SUSPENDED
CLOSED
```

pero deben diseñarse considerando:

* acceso de usuarios;
* retención de datos;
* billing;
* soporte;
* recuperación;
* cumplimiento.

---

# 77. Company no debe eliminarse fácilmente

Una Company puede contener:

* Users;
* Customers;
* Suppliers;
* Products;
* Purchases;
* Inventory;
* Quotes;
* Sales;
* Returns;
* Audit;
* Healthcare data.

Por tanto:

> El hard delete de Company no debe exponerse como operación administrativa cotidiana.

---

# 78. Borrado de tenant

Si en el futuro se requiere eliminación completa de una Company, debe tratarse como una operación de plataforma altamente sensible.

Debe contemplar:

* autorización;
* backups;
* retención;
* auditoría;
* relaciones;
* eliminación consistente;
* normativa aplicable.

---

# 79. No usar Cascade sin análisis

No debe configurarse:

```text
DELETE Company
↓
CASCADE EVERYTHING
```

como solución automática sin revisar los efectos empresariales.

---

# 80. Onboarding

Company es una pieza central del onboarding de una nueva organización.

La experiencia objetivo debe permitir pasar de:

```text
Crear cuenta / provisionar empresa
```

a:

```text
Company ready
↓
User access
↓
Core setup
↓
Business operation
```

---

# 81. Flujo exacto de provisioning

Los documentos consolidados confirman la existencia de:

* Companies;
* Authentication;
* Users;

pero no constituyen una especificación suficiente para fijar aquí el endpoint exacto de creación/provisionamiento de Company.

Ese flujo debe verificarse contra el backend vigente antes de documentarlo como contrato API actual.

---

# 82. Provisioning atómico

Como dirección arquitectónica, un flujo que cree una nueva Company y su identidad administrativa inicial debe evitar estados incompletos.

No debería quedar:

```text
Company created
✓

Initial access
✗
```

sin una estrategia clara de recuperación.

---

# 83. Configuración inicial

Una Company recién creada puede requerir datos esenciales como:

```text
name
rfc
language
timezone
currency
```

según el contrato de provisioning vigente.

No todas las configuraciones futuras deben bloquear el uso inicial.

---

# 84. Default values

El schema ya proporciona defaults para:

```text
language = es
timezone = America/Hermosillo
currency = MXN
```

Esto reduce captura inicial para el mercado actual.

---

# 85. Defaults no son restricciones permanentes

Que el default sea:

```text
MXN
```

no significa:

> Zaping solo puede utilizar pesos mexicanos para siempre.

Igualmente:

```text
America/Hermosillo
```

no debe convertirse en una zona horaria hardcodeada en toda la aplicación.

---

# 86. RFC y mercado inicial

La presencia de `rfc` refleja el contexto mexicano actual.

La expansión internacional futura puede requerir una estrategia de identificación fiscal más general.

No debe cambiarse antes de existir una necesidad comercial concreta.

---

# 87. Internationalization futura

Una evolución internacional puede requerir distinguir:

```text
country
tax identifier
currency
timezone
locale
```

de manera más estructurada.

No forma parte del modelo actual.

---

# 88. API

La documentación histórica de `api/Companies.md` no contenía un contrato útil.

Por tanto:

> Este documento no inventa endpoints actuales de Companies.

La API real debe comprobarse en backend/OpenAPI.

---

# 89. Capacidades conceptuales

El módulo necesita conceptualmente capacidades como:

```text
read own Company
update authorized Company profile
```

y una capacidad de provisioning administrada por el flujo correspondiente.

---

# 90. No exponer listado global a tenant users

Un usuario normal de Company A no necesita:

```text
GET all Companies
```

como parte de la operación del ERP.

---

# 91. Administración de plataforma

Una futura administración interna de Zaping puede requerir acceso a múltiples Companies.

Eso constituye:

```text
Platform Administration
```

no una capacidad ordinaria del tenant.

---

# 92. Separar Platform Admin

No debe implementarse un “super admin” eliminando filtros de `companyId` dentro de los Services existentes.

La administración cross-tenant requiere:

* autorización explícita;
* endpoints/controladores apropiados;
* auditoría reforzada;
* menor superficie de acceso.

---

# 93. Company update

Modificar información de Company puede afectar:

* documentos;
* PDFs;
* interfaces;
* defaults;
* presentación.

Debe protegerse mediante permisos apropiados.

---

# 94. Cambio de RFC

Modificar RFC debe considerarse una operación sensible.

Además de la restricción única, puede afectar posteriormente:

* CFDI;
* documentos fiscales;
* integraciones;
* historial.

La política definitiva deberá diseñarse con Billing.

---

# 95. Cambio de timezone

Modificar timezone no debe cambiar timestamps históricos almacenados.

Debe cambiar principalmente la interpretación/presentación de los instantes cuando corresponda.

---

# 96. Cambio de currency

Modificar la moneda por defecto de una Company con operaciones existentes no debe reinterpretar silenciosamente importes históricos.

Ejemplo incorrecto:

```text
Old Sale
100 MXN
↓
Company.currency = USD
↓
Old Sale displayed as 100 USD
```

Una arquitectura multi-moneda futura deberá evitar esa ambigüedad.

---

# 97. Audit

Los cambios importantes de configuración Company deberían poder auditarse.

Especialmente:

```text
RFC
name
currency
timezone
critical settings
```

cuando Audit esté implementado completamente.

---

# 98. Seguridad

Company contiene información empresarial.

Debe aplicarse:

```text
Authentication
+
Authorization
+
Validation
+
Audit
```

para cambios administrativos.

---

# 99. Datos sensibles

`Company` no debe convertirse en un lugar para almacenar:

* secrets;
* API keys en texto plano;
* contraseñas;
* credenciales fiscales privadas;
* certificados sensibles;

sin infraestructura diseñada específicamente para ello.

---

# 100. Integraciones futuras

Las credenciales de integraciones externas deben administrarse mediante mecanismos seguros.

No mediante campos genéricos como:

```text
Company.notes
```

o equivalentes.

---

# 101. Company y Customers

```text
Company
↓
Customers
```

Todos los Customers pertenecen al contexto de una Company.

---

# 102. Company y Suppliers

```text
Company
↓
Suppliers
```

Los proveedores son catálogos privados del tenant.

---

# 103. Company y Products

```text
Company
↓
Products
```

SKU y otros identificadores empresariales pueden utilizar unicidad dentro del tenant.

---

# 104. Company y Inventory

Inventory siempre debe estar contextualizado por Company.

Una existencia física de Company A nunca debe afectar balances de Company B.

---

# 105. Company y Purchases

```text
Company
↓
Purchase
↓
PurchaseReceipt
↓
Inventory
```

Toda la cadena debe permanecer dentro del mismo tenant.

---

# 106. Company y Quotes

```text
Company
↓
Quote
```

Customer y Products utilizados deben pertenecer al mismo contexto.

---

# 107. Company y Sales

CURRENT:

```text
Company
↓
Sale
```

TARGET:

```text
Company
↓
SalesOrder
↓
Delivery
```

---

# 108. Company y Returns

Las devoluciones deben permanecer dentro del tenant del fulfillment original.

Nunca debe relacionarse:

```text
Return Company A
→ Sale / Delivery Company B
```

---

# 109. Company y Healthcare

Healthcare debe operar dentro del mismo Tenant Context.

Conceptualmente:

```text
Company
↓
Healthcare Cases
↓
CaseKit / Equipment / Custody
```

cuando esos modelos sean implementados.

---

# 110. Company y Dashboard

Dashboard representa únicamente información de la Company autorizada.

---

# 111. Company y Audit

Audit debe incluir suficiente información de tenant para reconstruir quién realizó una acción y dentro de qué Company ocurrió.

---

# 112. Company y archivos

Cuando Zaping incorpore documentos o almacenamiento, los archivos también deberán tener ownership tenant seguro.

No basta con proteger solamente las filas de PostgreSQL.

---

# 113. Company y caches

Cuando exista caching, las claves deben mantener el contexto de tenant.

Ejemplo conceptual:

```text
dashboard:{companyId}
```

y no simplemente:

```text
dashboard
```

si ello pudiera mezclar datos.

---

# 114. Company y logs

Los logs pueden incluir identificadores de tenant para facilitar soporte y observabilidad.

Pero deben evitar exponer información sensible innecesaria.

---

# 115. Company y métricas operativas

La infraestructura de observabilidad puede agregar métricas técnicas globales.

Pero las métricas empresariales mostradas al usuario deben permanecer correctamente aisladas.

---

# 116. Testing obligatorio

La arquitectura multi-tenant exige pruebas específicas.

No basta con probar:

```text
User A can read Product A
```

También debe probarse:

```text
User A cannot read Product B
```

cuando Product B pertenece a otra Company.

---

# 117. Matriz mínima multi-tenant

Los módulos críticos deben probar:

```text
READ
CREATE relationships
UPDATE
business actions
exports/files
```

contra recursos de otro tenant cuando corresponda.

---

# 118. Regression tests

Un bug de aislamiento multi-tenant debe considerarse un problema de seguridad de alta prioridad.

Su corrección debe incluir una prueba que evite regresión.

---

# 119. Estado CURRENT

El modelo actual de referencia confirma:

```text
Company
UUID id
name
tradeName
unique RFC
email
phone
language
timezone
currency
createdAt
updatedAt
Users relation
business-data relations
```

y la arquitectura del proyecto establece:

```text
Company
→ tenant boundary
```

---

# 120. Estado TARGET

La dirección aprobada incluye:

```text
Consistent Tenant Context
Complete tenant-isolation testing
Company profile UX
Audit for critical settings
Correct localization defaults
Secure provisioning
Company-aware future APIs
```

sin alterar innecesariamente el modelo actual.

---

# 121. Estado FUTURE

Capacidades que pueden requerir decisiones específicas posteriormente incluyen:

```text
international fiscal identity
multi-company user access
platform administration
company lifecycle / suspension
module enablement
advanced localization
subscription / SaaS administration
```

Ninguna se considera implementada por aparecer en este documento.

---

# 122. Invariantes

```text
Company
→ root tenant boundary
```

```text
User
→ belongs to one Company in current model
```

```text
Tenant-owned resource
→ belongs directly or indirectly to Company
```

```text
Authenticated company context
→ authoritative
```

```text
Client-provided companyId
→ not authorization
```

```text
Resource UUID
→ not authorization
```

```text
Cross-tenant access
→ forbidden
```

```text
Cross-tenant relationship
→ forbidden
```

```text
Company.rfc
→ globally unique in current schema
```

```text
Company deletion
→ not normal business operation
```

---

# 123. Anti-patrones

## Trust frontend companyId

```text
POST resource
companyId = whatever client sends
```

---

## UUID as security

```text
The ID is impossible to guess,
therefore authorization is unnecessary.
```

---

## Missing tenant filter

```text
findMany()
```

sobre datos empresariales sin scope correspondiente.

---

## Cross-tenant relation

```text
Purchase Company A
→ Supplier Company B
```

---

## Company = Customer

Utilizar el tenant como una contraparte comercial dentro de sus propios datos sin modelar correctamente la relación.

---

## Company = Hospital

Convertir todos los hospitales Healthcare en Companies.

---

## One giant Company table

Agregar cualquier configuración futura directamente a Company sin evaluar ownership y cohesión.

---

## Premature multi-company

Introducir memberships, groups o switching antes de existir un caso funcional.

---

## Hard Delete tenant

Eliminar una Company y toda su historia como una operación CRUD ordinaria.

---

## Global admin by bypass

Crear administración cross-tenant simplemente quitando filtros de seguridad.

---

# 124. Relación con Identity & Access

Company define:

```text
WHERE
```

opera el usuario.

Identity & Access define:

```text
WHO
```

es el usuario

y:

```text
WHAT
```

puede realizar.

---

# 125. Relación con ADR-001

ADR-001 constituye la decisión arquitectónica principal para Multi-Tenancy.

`COMPANIES.md` documenta cómo esa decisión se refleja funcionalmente en el módulo Company.

---

# 126. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-012 — Entity Lifecycle, donde aplique a recursos dependientes.

---

# 127. Documentos relacionados

```text
product/PRODUCT_VISION.md
product/PRODUCT_REQUIREMENTS.md

architecture/ARCHITECTURE.md
architecture/adr/ADR-001-*.md

engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md

modules/erp/CUSTOMERS.md
modules/erp/SUPPLIERS.md
modules/erp/PRODUCTS.md
modules/erp/INVENTORY.md
modules/erp/PURCHASES.md
modules/erp/QUOTES.md
modules/erp/SALES.md
modules/erp/RETURNS.md
modules/erp/DASHBOARD.md
```

Documento siguiente:

```text
modules/erp/IDENTITY_ACCESS.md
```

---

# 128. Fuente de verdad

```text
COMPANIES.md
→ comportamiento funcional de Company

ADR-001
→ decisión Multi-Tenant

IDENTITY_ACCESS.md
→ Authentication / Users / Roles / Permissions

SECURITY_PRINCIPLES.md
→ controles de seguridad

schema.prisma
→ modelo técnico vigente

backend
→ implementación actual

tests
→ comportamiento validado
```

---

# 129. Principio final

En Zaping, `Company` no es solamente otro registro empresarial.

Es la frontera que determina:

```text
qué datos pertenecen juntos
```

y:

```text
qué datos deben permanecer separados
```

La arquitectura debe proteger siempre:

```text
Identity
↓
Company
↓
Authorized Business Data
```

> **El aislamiento entre empresas no es una función adicional de Zaping. Es una propiedad fundamental de toda la plataforma.**
