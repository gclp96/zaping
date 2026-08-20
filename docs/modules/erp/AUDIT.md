# Módulo de Auditoría — Zaping

**Módulo:** Audit
**Producto:** Zaping Platform / ERP Core
**Versión:** 1.0.0
**Estado:** Aprobado
**Estado de implementación:** REQUIREMENT APPROVED / NOT IMPLEMENTED
**Última actualización:** 2026-08-19
**Responsable:** Zaping Platform & Security Team

---

# 1. Propósito

El módulo Audit proporciona trazabilidad sobre acciones relevantes realizadas dentro de Zaping.

Su objetivo principal es permitir responder:

```text
¿Qué ocurrió?
¿Quién lo hizo?
¿Cuándo ocurrió?
¿Dentro de qué Company?
¿Sobre qué recurso?
¿Qué acción se ejecutó?
¿Qué cambió?
¿De qué operación provino?
```

Audit constituye una capacidad transversal de la plataforma.

---

# 2. Principio fundamental

La visión de Zaping establece:

> **Toda acción empresarial importante debe ser auditable.**

Esto no significa registrar indiscriminadamente cada operación técnica.

Significa preservar evidencia suficiente sobre eventos relevantes para:

* trazabilidad;
* seguridad;
* soporte;
* investigación;
* operación;
* cumplimiento;
* reconstrucción histórica.

---

# 3. Estado actual

Audit aparece definido como módulo Core dentro de los requerimientos y arquitectura de Zaping.

También forma parte de la secuencia arquitectónica:

```text
Authentication
↓
Authorization
↓
Business Validation
↓
Data Access
↓
Audit
```

Sin embargo, la documentación disponible no confirma actualmente:

* modelo Prisma de Audit;
* AuditService implementado;
* Controller de Audit;
* API funcional;
* UI de auditoría;
* persistencia de Audit Events.

Por tanto:

```text
Audit
→ REQUIRED / TARGET
```

no:

```text
Audit
→ IMPLEMENTED
```

---

# 4. Fuente histórica

La documentación anterior contiene referencias conceptuales a:

```text
Audit
Audit Logs
Audit Trail
createAuditLog()
audit.read
```

pero el antiguo:

```text
docs/api/Audit.md
```

estaba vacío.

No existía una especificación funcional consolidada.

Este documento pasa a ser la fuente principal del diseño de Audit.

---

# 5. Responsabilidades

Audit será responsable de:

* registrar acciones relevantes;
* preservar identidad del actor;
* preservar Company;
* identificar el recurso afectado;
* identificar la acción;
* registrar momento del evento;
* conservar contexto seguro;
* ofrecer consultas de auditoría;
* soportar trazabilidad transversal;
* alimentar futuras vistas de actividad.

---

# 6. Fuera del alcance

Audit no es responsable de:

* aplicar reglas de negocio;
* autenticar usuarios;
* decidir permisos;
* actualizar Inventory;
* cambiar estados;
* reemplazar logs técnicos;
* reemplazar InventoryMovement;
* reemplazar historiales específicos de dominio;
* almacenar secretos;
* almacenar snapshots completos indiscriminadamente.

---

# 7. Audit no es Business Logic

Ejemplo incorrecto:

```text
AuditService
↓
decide si Purchase puede aprobarse
```

Correcto:

```text
Purchases
↓
valida y ejecuta Approval
↓
Audit registra el hecho relevante
```

---

# 8. Propiedad de reglas

Cada módulo continúa siendo propietario de sus decisiones.

Ejemplo:

```text
Purchases
→ sabe qué significa aprobar una Purchase

Audit
→ registra que ocurrió
```

---

# 9. Audit vs Application Logs

Debe distinguirse:

```text
Application Log
```

de:

```text
Audit Event
```

---

# 10. Application Log

Un Application Log existe principalmente para:

* debugging;
* observabilidad;
* errores;
* performance;
* infraestructura.

Ejemplo:

```text
Database query failed after 280 ms
```

---

# 11. Audit Event

Un Audit Event existe para registrar un hecho relevante del sistema o negocio.

Ejemplo:

```text
Purchase OC-001 confirmed
by User U-001
at 2026-08-19 14:30
```

---

# 12. Diferencia

```text
Logs
→ ¿qué hizo el software?
```

```text
Audit
→ ¿qué acción relevante ocurrió?
```

Pueden relacionarse, pero no son equivalentes.

---

# 13. Audit vs InventoryMovement

También debe distinguirse:

```text
AuditEvent
≠
InventoryMovement
```

---

# 14. InventoryMovement

InventoryMovement representa:

> un hecho físico de inventario.

Ejemplo:

```text
Product A
OUT 5
Balance 20
Reference DELIVERY
```

---

# 15. AuditEvent

Audit podría registrar:

```text
User X confirmed Delivery DEL-001
```

---

# 16. Ambos son necesarios

En un flujo:

```text
Delivery confirmed
↓
InventoryMovement OUT
+
Audit Event
```

Inventory responde:

```text
¿Qué ocurrió con las existencias?
```

Audit responde:

```text
¿Quién ejecutó la acción empresarial?
```

---

# 17. Audit no reemplaza historia de dominio

También:

```text
PurchaseReceipt
Return
Delivery
CaseDispatch
```

continúan siendo documentos históricos.

No deben reducirse a entradas de Audit.

---

# 18. Multi-tenancy

ADR-001 establece:

> **Every audit record includes CompanyId.**

Por tanto, para auditoría empresarial:

```text
AuditEvent
→ companyId required
```

---

# 19. Tenant isolation

Debe impedirse:

```text
User Company A
↓
Audit Company B
```

---

# 20. Audit queries

Toda consulta normal deberá ejecutarse dentro de:

```text
authenticatedCompanyId
```

igual que el resto de información empresarial.

---

# 21. companyId no proviene del cliente

El frontend no debe decidir arbitrariamente:

```text
companyId
```

de un Audit Event.

Debe derivarse del contexto de la operación original.

---

# 22. Eventos antes de resolver tenant

Algunos eventos técnicos o de seguridad pueden ocurrir antes de conocer una Company.

Ejemplo:

```text
invalid login attempt
```

cuando la identidad ni siquiera pudo resolverse.

Estos eventos pertenecen mejor a:

```text
Security Logging / Platform Observability
```

si no puede determinarse de forma segura el tenant.

No deben forzarse dentro del Business Audit destruyendo la invariancia de `companyId`.

---

# 23. Actor

Todo evento empresarial debe conservar quién produjo la acción cuando exista un actor identificable.

Conceptualmente:

```text
actorId
```

puede relacionarse inicialmente con:

```text
User.id
```

---

# 24. Ejemplo

```text
Actor
Leonardo

Action
purchase.confirmed

Resource
Purchase OC-001

Date
2026-08-19
```

---

# 25. Actor histórico

La auditoría no debe depender exclusivamente del estado actual del User para poder explicar quién realizó una acción histórica.

Si el User se desactiva posteriormente:

```text
Audit history
→ remains valid
```

---

# 26. Eliminación de User

Esta es otra razón por la que Users con historia relevante no deben eliminarse indiscriminadamente.

---

# 27. Actor futuro

En etapas posteriores el actor podría ser:

```text
User
System
API Client
Integration
Background Job
```

No se aprueba todavía un enum específico.

---

# 28. Acción

Cada Audit Event debe describir una acción concreta.

Preferir identificadores consistentes.

Ejemplos:

```text
customer.created
customer.updated
customer.deactivated

purchase.created
purchase.confirmed
purchase.cancelled

purchaseReceipt.created

inventory.adjusted

quote.confirmed
quote.cancelled
quote.converted

sale.confirmed
delivery.confirmed

return.confirmed

user.created
user.deactivated
user.role_changed
```

Los nombres definitivos deben normalizarse durante implementación.

---

# 29. Acción no debe ser texto libre solamente

Evitar utilizar únicamente:

```text
action = "Juan hizo algo con una compra"
```

como estructura.

Debe existir una clave procesable.

Ejemplo:

```text
action = "purchase.confirmed"
```

y opcionalmente una representación humana en UI.

---

# 30. Resource Type

Audit necesita identificar el tipo de recurso afectado.

Conceptualmente:

```text
resourceType
```

Ejemplos:

```text
Customer
Supplier
Product
Purchase
PurchaseReceipt
Quote
SalesOrder
Delivery
Return
User
Company
```

---

# 31. Resource ID

También:

```text
resourceId
```

debe permitir relacionar el evento con la entidad correspondiente cuando exista.

---

# 32. Ejemplo conceptual

```text
AuditEvent

companyId     = COMPANY_A
actorId       = USER_001
action        = purchase.confirmed
resourceType  = Purchase
resourceId    = PURCHASE_001
createdAt     = ...
```

---

# 33. Resource ID no sustituye tenant

Conocer:

```text
resourceId
```

nunca debe permitir consultar Audit de otra Company.

---

# 34. Descripción

Puede existir una descripción legible derivada.

Ejemplo:

```text
Compra OC-001 confirmada.
```

Pero no debe convertirse en la única información estructurada.

---

# 35. Metadata

Audit puede necesitar contexto adicional.

Conceptualmente:

```text
metadata
```

puede conservar datos seguros y limitados.

Ejemplo:

```json
{
  "folio": "OC-001",
  "previousStatus": "DRAFT",
  "newStatus": "CONFIRMED"
}
```

---

# 36. Metadata no es database dump

No debe utilizarse Audit para almacenar:

```text
entidad completa
request completo
response completo
JWT
DTO completo
```

sin necesidad.

---

# 37. Datos Before / After

Para determinadas modificaciones puede ser útil registrar:

```text
before
after
```

o un:

```text
changeSet
```

limitado.

---

# 38. Ejemplo

Cambio:

```text
Customer.creditLimit

Before
100,000

After
150,000
```

puede ser relevante.

---

# 39. No registrar todo indiscriminadamente

Cambiar:

```text
updatedAt
```

no necesita necesariamente aparecer como un cambio funcional independiente.

La auditoría debe priorizar información útil.

---

# 40. Lista permitida de campos

Cuando se auditen cambios de datos, es preferible registrar únicamente campos permitidos.

No serializar automáticamente todo el objeto.

---

# 41. Información prohibida

Audit nunca debe almacenar:

```text
password
passwordHash
JWT
refresh token
reset token
JWT_SECRET
DATABASE_URL
API secret
private key
full credentials
```

---

# 42. Datos personales

También debe aplicarse minimización a:

* email;
* teléfono;
* direcciones;
* nombres personales;
* datos Healthcare.

Registrar únicamente lo necesario.

---

# 43. Healthcare

Audit nunca debe convertirse en un repositorio indirecto de:

* diagnósticos;
* historia clínica;
* información de paciente;
* datos médicos innecesarios.

La política de minimización de Healthcare continúa aplicando.

---

# 44. Resultado

Para acciones empresariales exitosas, Audit debe registrar el hecho después de que la operación haya sido aceptada correctamente.

---

# 45. No registrar éxito antes del commit

Incorrecto:

```text
Audit
purchase.confirmed
✓

Database transaction
ROLLBACK
```

La auditoría terminaría afirmando algo que nunca ocurrió.

---

# 46. Consistencia

Para eventos críticos debe garantizarse:

```text
Business transaction succeeds
↓
Audit accurately reflects success
```

sin crear contradicciones históricas.

---

# 47. Estrategia transaccional

La implementación podrá resolverlo mediante:

* misma transacción;
* evento interno posterior al commit;
* mecanismo equivalente confiable.

La decisión técnica debe tomarse durante implementación.

---

# 48. Audit failure

También deberá definirse qué ocurre si:

```text
business operation succeeds
```

pero:

```text
audit persistence fails
```

para eventos considerados obligatorios.

No debe dejarse como comportamiento accidental.

---

# 49. Eventos fallidos

No toda operación rechazada necesita formar parte del Business Audit.

Por ejemplo:

```text
quantity = -1
```

rechazada por validación puede permanecer únicamente en logs operativos cuando corresponda.

---

# 50. Eventos de seguridad

Acciones como:

```text
login failures
permission denials
suspicious access
token errors
```

pueden requerir Security Logs.

No deben mezclarse indiscriminadamente con el historial empresarial visible a los usuarios.

---

# 51. Business Audit vs Security Audit

Conceptualmente:

```text
Business Audit
→ acciones sobre recursos empresariales
```

```text
Security Logging
→ eventos de autenticación/autorización/plataforma
```

Pueden compartir infraestructura en el futuro, pero sus requisitos de acceso y retención pueden ser distintos.

---

# 52. Inmutabilidad

Un Audit Event confirmado representa evidencia histórica.

Debe tratarse como:

```text
APPEND-ONLY
```

---

# 53. No Update

No debe existir una operación empresarial normal:

```text
PATCH /audit/:id
```

---

# 54. No Delete

Tampoco:

```text
DELETE /audit/:id
```

para usuarios ordinarios.

---

# 55. Corrección

Si un evento empresarial original fue incorrecto:

```text
Original event
+
Corrective business event
```

debe explicar la historia.

No modificar la auditoría anterior para fingir que nunca ocurrió.

---

# 56. Retención

La duración de Audit todavía no está definida.

Una política futura deberá considerar:

* obligaciones empresariales;
* seguridad;
* regulación;
* almacenamiento;
* contratos SaaS.

---

# 57. Retención no es DELETE normal

Si existe una política de expiración o archivo, deberá ejecutarse mediante infraestructura de plataforma controlada.

No mediante CRUD empresarial.

---

# 58. Timestamp

Todo evento debe conservar:

```text
createdAt
```

o equivalente.

---

# 59. Hora

Los timestamps deben seguir la política temporal general de Zaping.

La representación al usuario debe considerar:

```text
Company.timezone
```

cuando corresponda.

---

# 60. Fecha histórica

Cambiar posteriormente:

```text
Company.timezone
```

no debe cambiar el instante real en que ocurrió un Audit Event.

---

# 61. Correlation ID

Una evolución útil puede incluir:

```text
correlationId
```

o:

```text
requestId
```

para relacionar:

```text
API Request
↓
Business Operation
↓
Audit
↓
Application Logs
```

Esta capacidad es TARGET, no CURRENT.

---

# 62. Source

También puede ser útil identificar el origen:

```text
Web
Mobile
Public API
Background Job
Integration
```

cuando existan esos canales.

No se define todavía un enum.

---

# 63. Modelo conceptual TARGET

Una primera versión puede considerar conceptualmente:

```text
AuditEvent
├── id
├── companyId
├── actorId?
├── action
├── resourceType
├── resourceId?
├── metadata?
├── createdAt
└── correlationId?
```

---

# 64. No es schema aprobado todavía

La estructura anterior es:

```text
TARGET CONCEPT
```

No:

```text
CURRENT PRISMA MODEL
```

---

# 65. No crear campos por copia directa

Antes de modificar `schema.prisma` deberá verificarse:

* casos de uso;
* volumen;
* consultas;
* metadata;
* relaciones;
* índices;
* retención;
* actor types;
* seguridad.

---

# 66. companyId

Para Business Audit:

```text
companyId
→ obligatorio
```

de acuerdo con ADR-001.

---

# 67. actorId nullable

Puede existir una razón válida para que ciertos eventos automáticos no posean un `User`.

Por eso conceptualmente:

```text
actorId
```

podría ser opcional si el diseño permite System Events.

La decisión se formalizará durante implementación.

---

# 68. Relation to User

Eliminar/desactivar un User no debe romper Audit.

La estrategia de relación deberá preservar la historia.

---

# 69. Resource relation

No es recomendable crear una FK polimórfica imposible directamente a:

```text
Customer
Purchase
Product
Delivery
...
```

desde una sola columna.

Una combinación:

```text
resourceType
+
resourceId
```

puede proporcionar flexibilidad.

La estrategia definitiva debe evaluarse técnicamente.

---

# 70. Metadata JSON

Un campo JSON puede ser útil para contexto variable.

Pero presenta riesgos:

* información sensible;
* tamaño;
* queries;
* falta de schema;
* cambios incompatibles.

Debe utilizarse con reglas explícitas.

---

# 71. AuditService

La arquitectura objetivo puede incluir:

```text
AuditService
```

como interfaz pública del módulo Audit.

---

# 72. Ejemplo conceptual

```text
PurchasesService
↓
business operation
↓
AuditService.record(...)
```

o mediante un evento interno equivalente.

---

# 73. Dependencia

Los módulos no deben utilizar directamente:

```text
prisma.auditEvent.create(...)
```

distribuido por todo el backend.

Preferir una única frontera de Audit.

---

# 74. Razón

Esto permite centralizar:

* estructura;
* sanitización;
* tenant;
* timestamps;
* metadata;
* naming;
* seguridad.

---

# 75. No introducir acoplamiento excesivo

Tampoco debe ocurrir:

```text
AuditService
↓
imports every domain service
```

Audit debe permanecer transversal y con dependencias mínimas.

---

# 76. Comunicación futura por eventos

Con la arquitectura event-ready del Modular Monolith puede resultar útil:

```text
PurchaseConfirmed
↓
Audit handler
```

para ciertos casos.

No implica Kafka, RabbitMQ o microservicios.

---

# 77. Eventos in-process

Una implementación inicial puede utilizar eventos internos en proceso cuando aporten desacoplamiento real.

No deben añadirse únicamente para aparentar arquitectura distribuida.

---

# 78. Eventos críticos y transacciones

Si se utilizan eventos internos, debe seguir garantizándose que Audit no afirme que una operación ocurrió cuando su transacción fue revertida.

---

# 79. Qué acciones auditar

No existe necesidad de registrar cada:

```text
GET
```

como Business Audit.

---

# 80. Acciones de lectura

Lecturas ordinarias normalmente pueden tratarse mediante:

* access logs;
* application logs;

cuando se necesite.

---

# 81. Lecturas sensibles

Algunas lecturas pueden requerir auditoría futura si existe un requisito de seguridad/regulación específico.

Ejemplo:

```text
export sensitive report
```

---

# 82. Criterios

Una acción debe considerarse candidata fuerte a Business Audit cuando:

* cambia estado empresarial;
* cambia información sensible;
* modifica inventario;
* modifica permisos;
* confirma/cancela un documento;
* produce un efecto irreversible;
* afecta configuración crítica;
* genera exportación sensible.

---

# 83. Customers

Eventos relevantes pueden incluir:

```text
customer.created
customer.updated
customer.deactivated
customer.reactivated
```

---

# 84. Suppliers

```text
supplier.created
supplier.updated
supplier.deactivated
supplier.reactivated
```

---

# 85. Products

```text
product.created
product.updated
product.deactivated
product.reactivated
```

Cambios especialmente relevantes:

```text
SKU
price
cost
status
```

según las reglas que finalmente se aprueben.

---

# 86. Purchases

Candidatos:

```text
purchase.created
purchase.updated
purchase.confirmed
purchase.cancelled
```

---

# 87. Purchase Receipts

Especialmente:

```text
purchaseReceipt.created
```

porque puede producir:

```text
Inventory IN
```

---

# 88. Inventory

Eventos críticos incluyen:

```text
inventory.adjusted
```

y futuras operaciones como:

```text
inventory.transferred
inventory.count_completed
inventory.write_off
```

---

# 89. Quote

```text
quote.created
quote.confirmed
quote.cancelled
quote.converted
```

---

# 90. Sales CURRENT

Mientras exista Sale legacy pueden existir:

```text
sale.created
sale.confirmed
sale.cancelled
```

---

# 91. Sales TARGET

Después de ADR-011:

```text
salesOrder.created
salesOrder.confirmed
salesOrder.cancelled

delivery.created
delivery.confirmed
```

---

# 92. Returns

```text
return.created
return.confirmed
return.cancelled
```

especialmente cuando Confirm produce efecto en Inventory.

---

# 93. Company

Cambios administrativos relevantes:

```text
company.updated
```

con especial atención a:

```text
RFC
timezone
currency
critical configuration
```

---

# 94. Users

Identity & Access puede requerir:

```text
user.created
user.updated
user.deactivated
user.reactivated
user.role_changed
```

---

# 95. Password events

Puede registrarse:

```text
user.password_changed
```

sin registrar:

```text
old password
new password
passwordHash
```

---

# 96. Permission events TARGET

Cuando Permissions estén implementados:

```text
role.created
role.updated
role.permission_changed
user.role_assigned
```

pueden ser acciones altamente relevantes.

---

# 97. Healthcare

Futuros candidatos:

```text
case.created
case.updated
case.status_changed

caseKit.prepared
caseDispatch.confirmed
caseReturn.registered
caseReconciliation.confirmed

equipment.custody_changed
```

---

# 98. Healthcare y minimización

Aunque estos eventos sean auditables, Audit debe evitar replicar información clínica o sensible innecesaria.

Preferir identificadores y contexto operacional mínimo.

---

# 99. Audit Read Permission

ADR-007 ya contempla:

```text
audit.read
```

como permiso conceptual.

---

# 100. Escritura de Audit

Un usuario normal no debe necesitar:

```text
audit.create
```

porque Audit se genera automáticamente como consecuencia de otras acciones autorizadas.

---

# 101. Manipulación

Tampoco debería existir para usuarios normales:

```text
audit.update
audit.delete
```

---

# 102. Auditor Role

La arquitectura histórica contempla conceptualmente un perfil:

```text
Auditor
```

con acceso de lectura.

Esto corresponde al modelo TARGET de RBAC.

No existe actualmente como rol implementado dentro de `UserRole`.

---

# 103. ADMIN

Un ADMIN del tenant puede eventualmente disponer de `audit.read`.

Eso deberá definirse mediante Permissions, no por bypass especial dentro de Audit.

---

# 104. Warehouse

Un usuario Warehouse podría no necesitar acceso a toda la auditoría empresarial.

Puede ver el historial contextual necesario desde Inventory/Receipt/Delivery sin acceder al log global.

---

# 105. Least Privilege

Audit puede contener información sensible sobre múltiples áreas de la empresa.

El acceso debe seguir:

```text
Least Privilege
```

---

# 106. API

Actualmente no existe un contrato API de Audit confirmado.

Por tanto no deben documentarse endpoints como implementados.

---

# 107. API TARGET

Conceptualmente podría existir:

```text
GET /audit
GET /audit/:id
```

o una nomenclatura como:

```text
GET /audit-events
```

La decisión final pertenecerá a implementación/OpenAPI.

---

# 108. API Read-Only

La API empresarial de Audit debe ser esencialmente de lectura.

No exponer:

```text
POST arbitrary audit
PATCH audit
DELETE audit
```

a usuarios normales.

---

# 109. Filtros

La futura consulta puede necesitar filtros por:

```text
date range
actor
action
resource type
resource id
```

dentro de la Company.

---

# 110. Search

Puede permitir localizar actividad mediante:

```text
folio
resource
user
action
```

cuando exista un Read Model apropiado.

---

# 111. Pagination

Audit puede crecer rápidamente.

Toda consulta de listas deberá estar paginada.

---

# 112. Orden

El orden predeterminado natural es:

```text
createdAt DESC
```

mostrando primero los eventos recientes.

---

# 113. Date Range

Las consultas de auditoría deberían permitir limitar períodos para:

* rendimiento;
* investigación;
* UX.

---

# 114. Export

Una evolución futura puede permitir:

```text
CSV
XLSX
PDF
```

para auditorías autorizadas.

---

# 115. Export sensible

Exportar Audit debe considerarse una acción sensible.

Puede requerir permiso específico.

Ejemplo futuro:

```text
audit.export
```

---

# 116. Audit UI

Una interfaz futura puede ofrecer una pantalla:

```text
Auditoría
```

con:

```text
Fecha
Usuario
Acción
Recurso
Referencia
Detalles
```

---

# 117. Ejemplo

```text
19/08/2026 14:32
Leonardo Pérez
Compra confirmada
OC-000152
```

---

# 118. Detalle

Al abrir un evento puede mostrar únicamente contexto seguro:

```text
Acción
purchase.confirmed

Usuario
Leonardo Pérez

Fecha
19/08/2026 14:32

Compra
OC-000152

Estado anterior
DRAFT

Estado nuevo
CONFIRMED
```

---

# 119. Business Language

La UI no debe exigir al usuario interpretar:

```text
purchase.confirmed
```

si puede mostrar:

```text
Compra confirmada
```

La clave técnica puede mantenerse internamente.

---

# 120. Audit Timeline contextual

Además de una pantalla global, Audit puede alimentar timelines dentro de vistas 360.

Ejemplo:

```text
Purchase 360

10:20 Creada
10:45 Actualizada
11:00 Confirmada
15:30 Receipt REC-001 registrada
```

---

# 121. Timeline no cambia ownership

Purchase 360 puede mostrar Audit Events.

Purchases continúa siendo propietario de las reglas de Purchase.

---

# 122. Customer 360

Puede mostrar actividad relevante como:

```text
Customer created
Customer updated
Quote created
SalesOrder created
```

según el diseño del Read Model.

---

# 123. Product 360

Puede mostrar:

```text
Product updated
Inventory adjusted
Receipt
Delivery
Return
```

combinando Audit e historia de dominio cuando corresponda.

---

# 124. No usar Audit para reconstruir todo

La vista Product 360 no debe intentar reconstruir stock exclusivamente mediante Audit.

Para eso existe:

```text
InventoryMovement
```

---

# 125. Dashboard

Dashboard puede utilizar eventos de Audit para:

```text
Recent Activity
```

cuando Audit esté implementado.

---

# 126. Ejemplo

```text
Actividad reciente

Leonardo confirmó OC-001
María registró REC-003
Carlos actualizó Customer ABC
```

---

# 127. Dashboard no requiere Audit para funcionar

Mientras Audit no esté implementado, Dashboard puede continuar usando fuentes actuales.

No debe bloquearse el Dashboard existente.

---

# 128. Performance

Audit puede generar un volumen considerable.

Debe diseñarse para consultas eficientes.

---

# 129. Índices TARGET

Según los patrones de consulta, pueden resultar útiles índices conceptuales sobre:

```text
companyId + createdAt

companyId + actorId + createdAt

companyId + resourceType + resourceId

companyId + action + createdAt
```

La selección definitiva debe hacerse con el schema y queries reales.

---

# 130. No indexar todo

Cada índice agrega:

* almacenamiento;
* costo de escritura;
* mantenimiento.

Solo deben agregarse según consultas reales.

---

# 131. Metadata y búsquedas

No debe dependerse de búsquedas arbitrarias profundas sobre JSON para todas las consultas frecuentes.

Los campos necesarios para filtering habitual deben modelarse explícitamente cuando sea necesario.

---

# 132. Escalabilidad

En el tamaño actual de Zaping, Audit puede convivir dentro del Modular Monolith y PostgreSQL.

No se necesita inmediatamente:

```text
Elasticsearch
Kafka
Data Lake
SIEM propio
microservice de auditoría
```

---

# 133. Evolución

Si el volumen o cumplimiento lo requiere, Audit podrá evolucionar hacia infraestructura especializada.

Ese cambio requerirá evidencia y, potencialmente, un nuevo ADR.

---

# 134. Integridad

Los Audit Events no deben permitir cambios ordinarios posteriores a su creación.

---

# 135. Protección a nivel aplicación

La API no debe exponer acciones de modificación.

---

# 136. Protección a nivel base de datos

Durante implementación debe evaluarse si se requieren controles adicionales para reforzar append-only.

No se decide todavía una solución específica.

---

# 137. Administradores de base de datos

Ningún esquema de aplicación puede garantizar de forma absoluta inmutabilidad frente a un administrador con control total de infraestructura.

El objetivo es preservar integridad dentro de los controles operativos y de plataforma razonables.

---

# 138. Cumplimiento

Audit ayuda a trazabilidad y cumplimiento.

Pero:

> la existencia de Audit Logs no convierte automáticamente a Zaping en un sistema certificado bajo una regulación específica.

Cualquier requisito regulatorio deberá evaluarse por separado.

---

# 139. Healthcare Compliance

Especialmente en Healthcare, Audit puede apoyar:

* trazabilidad;
* custodia;
* movimientos;
* usuarios responsables.

Pero no debe afirmarse cumplimiento sanitario/regulatorio únicamente por disponer de logs.

---

# 140. Soporte

Audit será útil para investigar preguntas como:

```text
¿Por qué esta compra aparece confirmada?
```

```text
¿Quién hizo este ajuste?
```

```text
¿Cuándo se desactivó este producto?
```

```text
¿Quién cambió el rol del usuario?
```

---

# 141. No usar acceso directo a DB como UX

Los usuarios autorizados no deberían necesitar revisar PostgreSQL manualmente para responder preguntas operativas de auditoría.

---

# 142. Observabilidad

Logs y Audit pueden complementarse mediante:

```text
correlationId
```

para investigación técnica.

Ejemplo:

```text
AuditEvent
purchase.confirmed
correlationId ABC
```

puede relacionarse con logs internos del mismo request.

---

# 143. API Public futura

Cuando exista Public API, las acciones ejecutadas mediante ella también deben conservar contexto de auditoría apropiado.

---

# 144. API Client

Conceptualmente podría mostrarse:

```text
Actor
Integration: CONTPAQi Connector
```

en lugar de fingir que fue ejecutado por un User humano.

Esta capacidad es futura.

---

# 145. Background Jobs

Acciones automáticas relevantes también pueden necesitar Audit.

Ejemplo futuro:

```text
System
→ expired Quote automatically
```

si alguna vez existe ese workflow.

---

# 146. Automatizaciones

Cuando Zaping AI o automatizaciones futuras realicen acciones:

```text
AI recommendation
```

no es lo mismo que:

```text
AI executed operation
```

---

# 147. AI Recommendation

Mostrar una recomendación normalmente no necesita ser un cambio empresarial.

---

# 148. AI Action

Si una automatización ejecuta una operación real:

```text
creates Purchase
changes status
```

debe existir trazabilidad del actor/sistema y contexto correspondiente.

---

# 149. No esconder acciones automáticas

Una operación automática no debe aparecer en Audit como si hubiera sido ejecutada manualmente por el usuario que casualmente estaba conectado.

---

# 150. Security Principles

Audit debe seguir:

```text
Minimization
Least Privilege
Tenant Isolation
Sensitive Data Protection
Traceability
```

---

# 151. Quality Standards

Un feature crítico que cambie información empresarial debe evaluar explícitamente:

```text
¿requiere Audit?
```

durante desarrollo.

---

# 152. Development Workflow

En cambios de nivel suficiente, la revisión debe considerar:

```text
Business action
↓
Audit impact
```

sin exigir un evento de auditoría para cada cambio trivial.

---

# 153. API Guidelines

Los endpoints que realizan acciones relevantes deben integrar Audit donde corresponda.

Esto no significa que Controllers escriban Audit manualmente en todas partes.

La integración debe respetar límites modulares.

---

# 154. Testing

Cuando Audit sea implementado, debe existir cobertura para:

```text
event created for critical operation
correct companyId
correct actor
correct resource
correct action
no sensitive values
tenant isolation
read permissions
pagination
```

---

# 155. Transaction tests

Para operaciones críticas deberá probarse:

```text
business transaction rollback
↓
no false successful Audit Event
```

---

# 156. Sensitive-data tests

Debe existir al menos protección contra persistir accidentalmente:

```text
password
passwordHash
JWT
```

dentro de metadata.

---

# 157. Cross-tenant tests

Debe probarse:

```text
User Company A
↓
GET Audit Company B
→ denied / inaccessible
```

---

# 158. Permission tests

Con RBAC TARGET:

```text
has audit.read
→ allowed
```

```text
missing audit.read
→ denied
```

siempre manteniendo tenant isolation.

---

# 159. Estado CURRENT

La documentación existente confirma actualmente:

```text
Audit
→ Core requirement

Audit Logs
→ security requirement

important business actions
→ should be auditable

Audit records
→ must include CompanyId

audit.read
→ target permission
```

---

# 160. CURRENT no confirmado

No existe evidencia documental suficiente para declarar actualmente implementados:

```text
AuditEvent Prisma model
AuditService
AuditController
Audit API
Audit UI
Audit persistence
```

---

# 161. Estado TARGET

La primera implementación deberá contemplar como mínimo:

```text
AuditEvent persistence
companyId
actor
action
resource type
resource id
timestamp
safe metadata
append-only behavior
tenant filtering
audit.read
pagination
critical business integrations
```

---

# 162. Integraciones TARGET prioritarias

Primera cobertura recomendada:

```text
Identity & Access
Inventory
Purchases
Purchase Receipts
Sales / Deliveries
Returns
Company critical changes
```

por su impacto operativo y de seguridad.

---

# 163. Segunda cobertura

Posteriormente:

```text
Customers
Suppliers
Products
Quotes
Healthcare
```

según implementación y prioridad.

---

# 164. Estado FUTURE

Capacidades posteriores pueden incluir:

```text
Advanced Audit UI
Exports
Retention policies
Archive
Security-event correlation
API Client actors
System actors
Correlation IDs
Advanced search
Compliance reports
SIEM integration
Anomaly detection
AI-assisted investigation
```

---

# 165. Implementación incremental

Audit no necesita aparecer completo en una sola feature.

Puede implementarse por fases:

```text
Foundation
↓
Critical Events
↓
Audit Read API
↓
UI
↓
Expanded Coverage
```

---

# 166. Evitar implementación parcial invisible

Aunque sea incremental, no debe existir una situación donde la UI haga creer:

```text
Aquí está todo el historial
```

si solo se auditan dos módulos.

La cobertura debe quedar clara.

---

# 167. Naming

Se recomienda utilizar un concepto consistente como:

```text
AuditEvent
```

o:

```text
AuditLog
```

pero no mezclar ambos nombres arbitrariamente en:

* Prisma;
* Services;
* DTOs;
* documentación.

---

# 168. Decisión de naming pendiente

La documentación histórica utiliza principalmente:

```text
Audit
Audit Logs
```

No existe todavía un modelo implementado que obligue a uno de los nombres.

La decisión técnica se tomará durante el feature.

---

# 169. Invariantes

```text
Business Audit Event
→ belongs to one Company
```

```text
Audit companyId
→ comes from trusted context
```

```text
Audit Event
→ append-only
```

```text
Audit
→ does not rewrite business history
```

```text
Audit
≠
Application Log
```

```text
Audit
≠
InventoryMovement
```

```text
Audit
≠
Domain document
```

```text
Sensitive secret
→ never Audit metadata
```

```text
Successful Audit Event
→ must not describe rolled-back operation
```

```text
audit.read
→ does not bypass tenant isolation
```

---

# 170. Anti-patrones

## Audit Everything

Registrar cada request, query y render como evento empresarial.

---

## Audit Nothing

Confiar únicamente en:

```text
updatedAt
```

para explicar quién modificó un recurso.

---

## Full Payload Logging

Guardar request/response completo indiscriminadamente.

---

## Secrets in Metadata

Registrar:

```text
password
JWT
passwordHash
```

---

## Editable Audit

Permitir:

```text
PATCH Audit
```

---

## User-Deletable Audit

Permitir:

```text
DELETE Audit
```

como CRUD normal.

---

## Wrong Tenant

Permitir leer eventos de otra Company.

---

## Business Logic in Audit

Hacer que Audit decida si una Purchase, Delivery o Return es válida.

---

## Replace Domain History

Utilizar Audit en lugar de:

```text
InventoryMovement
PurchaseReceipt
Delivery
Return
```

---

## False Success Event

Registrar la acción antes de saber si la transacción realmente fue confirmada.

---

## Human-Only Actors

Asumir que todas las acciones futuras necesariamente serán ejecutadas por Users humanos.

---

# 171. Relación con Companies

Company define el tenant.

Audit conserva:

```text
companyId
```

en todo Business Audit Event.

---

# 172. Relación con Identity & Access

Identity & Access determina:

```text
quién ejecuta
```

y:

```text
qué puede ejecutar
```

Audit conserva evidencia de la acción resultante.

---

# 173. Relación con Inventory

Inventory conserva historia física mediante:

```text
InventoryMovement
```

Audit conserva actividad del actor.

Ambas fuentes son complementarias.

---

# 174. Relación con Purchases

Purchases decide lifecycle.

Audit puede registrar transiciones relevantes.

---

# 175. Relación con Sales

CURRENT puede registrar Sale.

TARGET debe evolucionar hacia SalesOrder + Delivery.

---

# 176. Relación con Returns

Confirmar una devolución es una operación altamente auditable debido a su posible efecto sobre Inventory.

---

# 177. Relación con Dashboard

Dashboard puede utilizar Audit como fuente futura para:

```text
Recent Activity
```

sin convertir Audit en dueño del Dashboard.

---

# 178. Relación con Healthcare

Audit debe soportar trazabilidad operacional de Healthcare aplicando estricta minimización de datos.

---

# 179. Relación con Zaping Way

La actividad histórica debe mostrarse en contexto cuando ayude a responder:

```text
¿Qué pasó?
```

sin obligar al usuario a revisar una tabla técnica global.

---

# 180. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-011 — SalesOrder y Delivery.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 181. Documentos relacionados

```text
product/PRODUCT_VISION.md
product/PRODUCT_REQUIREMENTS.md

architecture/ARCHITECTURE.md

engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
engineering/QUALITY_STANDARDS.md

modules/erp/COMPANIES.md
modules/erp/IDENTITY_ACCESS.md
modules/erp/INVENTORY.md
modules/erp/PURCHASES.md
modules/erp/SALES.md
modules/erp/RETURNS.md
modules/erp/DASHBOARD.md
```

---

# 182. Fuente de verdad

```text
AUDIT.md
→ comportamiento funcional objetivo de Audit

ADR-001
→ tenant isolation

ADR-007
→ audit.read / authorization

SECURITY_PRINCIPLES.md
→ protección de información

módulos de dominio
→ significado de las acciones auditadas

schema.prisma
→ modelo técnico cuando sea implementado

backend
→ comportamiento CURRENT

PROJECT_BOARD.md
→ estado del trabajo
```

---

# 183. Regla de implementación

Hasta que exista código real:

```text
Audit
→ TARGET
```

No debe marcarse:

```text
Audit
→ COMPLETED
```

únicamente porque este documento ya exista.

---

# 184. Principio final

Audit debe permitir reconstruir:

```text
Actor
↓
Action
↓
Business Resource
↓
Time
↓
Company
```

sin sustituir el historial propio de cada dominio.

La regla de Zaping es:

> **Los módulos conservan la verdad empresarial. Audit conserva evidencia de las acciones relevantes que ocurrieron sobre esa verdad.**
