# Identity & Access — Zaping

**Módulo:** Identity & Access
**Producto:** Zaping Platform / ERP Core
**Versión:** 2.2.0
**Estado:** Aprobado
**Estado de implementación:** AUTH IMPLEMENTED / RBAC PARTIAL / PERMISSIONS TARGET
**Última actualización:** 2026-08-27
**Responsable:** Zaping Platform & Security Team

---

# 1. Propósito

Identity & Access administra conceptualmente:

```text
quién es el usuario
↓
a qué Company pertenece
↓
cómo demuestra su identidad
↓
qué puede hacer
↓
sobre qué recursos puede hacerlo
```

Este dominio reúne:

```text
Authentication

Users

Roles

Authorization

Tenant Context

Permissions future
```

Estas capacidades se documentan juntas porque forman una sola cadena de seguridad.

---

# 2. Alcance

Identity & Access es responsable de:

```text
internal User identity

authentication

password hashing

JWT

authenticated user context

Company membership current model

User lifecycle

current roles

RolesGuard

future permissions

future secure user administration

future session/revocation capabilities
```

No es propietario de:

```text
Customer lifecycle

Inventory rules

Purchases

Sales

Equipment business rules

Healthcare business rules

Billing

Customer Portal identity

SSO

MFA
```

Estos dominios consumen Identity & Access, pero mantienen ownership de sus propias reglas.

---

# 3. Principio fundamental

Toda operación protegida debe responder:

```text
¿Quién eres?
↓
¿A qué Company perteneces?
↓
¿Tienes autorización?
↓
¿El recurso pertenece a tu Company?
↓
¿La operación cumple las reglas de negocio?
```

Por tanto:

> **Authentication no implica Authorization, y Authorization nunca debe ignorar Tenant Isolation.**

También:

```text
Authorization uncertainty
→ DENY
```

No:

```text
Authorization uncertainty
→ ALLOW
```

---

# 4. Current vs Target vs Future

Este documento distingue:

## CURRENT

Capacidad realmente implementada.

## P0 / P1

Deuda de seguridad o hardening pendiente.

## TARGET

Arquitectura aprobada hacia la que debe evolucionar el módulo.

## FUTURE

Capacidad posible que todavía no forma parte del compromiso inmediato.

---

# 5. Arquitectura actual de Identity & Access

```text
Credentials
↓
AuthService
↓
bcrypt validation
↓
JWT
↓
Passport JWT / JwtStrategy
↓
JwtAuthGuard
↓
request.user
├── user identity
├── companyId
└── role
↓
RolesGuard where configured
↓
Tenant-scoped business operation
```

Actualmente:

```text
Authentication
→ implemented

Tenant context
→ implemented

Static role model
→ implemented

RolesGuard
→ implemented

ERP-wide granular authorization
→ NOT implemented

Permission model
→ TARGET
```

---

# 6. Modelo User actual

El modelo técnico actual contiene conceptualmente:

```text
User
├── id
├── companyId
├── firstName
├── lastName
├── email
├── passwordHash
├── locale
├── isActive
├── role
├── createdAt
├── updatedAt
└── company
```

La definición técnica exacta pertenece a:

```text
schema.prisma
```

---

# 7. User identity

`User.id` utiliza:

```text
UUID
```

como identidad técnica.

Principio:

```text
UUID
≠
Authorization
```

Conocer un UUID no concede acceso al recurso.

---

# 8. User y Company

El modelo actual es:

```text
User
→ belongs to one Company
```

mediante:

```text
companyId
```

Conceptualmente:

```text
Authenticated User
↓
Company
↓
Tenant-owned resources
```

---

# 9. Tenant authority

La autoridad del tenant debe provenir del contexto autenticado validado.

```text
Validated JWT
↓
Authenticated User context
↓
companyId
↓
Tenant-scoped operation
```

No:

```text
Frontend sends companyId
↓
Backend trusts it
```

Un `companyId` enviado arbitrariamente por cliente nunca debe convertirse en autoridad de seguridad.

---

# 10. Tenant Isolation

Debe cumplirse:

```text
Company A User
+
Company B resource
=
DENY
```

Esto aplica aunque el usuario conozca:

```text
resourceId
userId
companyId
folio
```

de otra Company.

Tenant isolation debe proteger:

```text
reads

writes

relations

lifecycle commands

search

reports

exports

deep-links

nested resources
```

---

# 11. ADMIN no bypass tenant

Actualmente:

```text
ADMIN
```

es un rol dentro de la Company.

No significa:

```text
Platform Administrator
```

ni:

```text
access every Company
```

Debe cumplirse:

```text
ADMIN Company A
↛
Company B resources
```

---

# 12. Multi-company futuro

Actualmente:

```text
User
→ one Company
```

Además:

```text
User.email
→ globally unique
```

Por tanto, una misma identidad no puede representarse naturalmente como Users independientes con el mismo email en múltiples Companies.

Si posteriormente se necesita acceso multi-company, debe diseñarse explícitamente algo equivalente a:

```text
Identity
↓
CompanyMembership
↓
Company
```

Este modelo:

```text
DOES NOT EXIST CURRENTLY
```

---

# 13. Email

Actualmente:

```text
User.email
→ globally unique
```

El email no debe utilizarse como sustituto de autorización ni tenant ownership.

---

# 14. Nombre y locale

`firstName` y `lastName` representan identidad visible.

No son identificadores técnicos.

`locale` permite preferencia individual de idioma.

Actualmente:

```text
User.locale
→ default "es"
```

Conceptualmente:

```text
Company language
→ default empresarial

User.locale
→ preferencia personal
```

La precedencia completa se definirá cuando i18n esté formalizado integralmente.

---

# 15. User lifecycle

User utiliza:

```text
isActive
```

como estado principal de acceso.

Conceptualmente:

```text
ACTIVE
↓
INACTIVE
```

La desactivación debe preservar historia.

No debe utilizarse:

```text
hard DELETE
```

como mecanismo normal de retiro de acceso.

---

# 16. User histórico

Desactivar un User no debe eliminar referencias históricas como:

```text
createdBy

receivedBy

inspectedBy

retiredBy

cancelledBy

future audit records
```

Identity debe preservarse aunque el usuario ya no pueda acceder al sistema.

---

# 17. Inactive User — CURRENT GAP

Actualmente existe una deuda de seguridad importante:

```text
login
→ does not fully enforce User.isActive

JwtStrategy
→ does not revalidate User.isActive against database
```

Por tanto:

```text
User.isActive = false
```

todavía no representa una garantía completa de bloqueo de acceso.

---

# 18. Inactive User — requisito P0

Debe garantizarse:

```text
User.isActive = false
↓
no new authentication
```

y debe definirse el comportamiento sobre tokens previamente emitidos.

Como mínimo antes de exposición real:

```text
inactive User
→ no normal protected application access
```

Este punto es:

> **P0 — Release Blocker**

---

# 19. User reactivation

La posible transición:

```text
INACTIVE
↓
ACTIVE
```

debe tratarse como una operación administrativa explícita.

Actualmente:

```text
User reactivation workflow
→ TARGET / NOT VERIFIED AS IMPLEMENTED
```

No debe inferirse desde un `PATCH` genérico.

---

# 20. Password handling

La contraseña en texto plano:

```text
must never be persisted
```

Actualmente se utiliza:

```text
bcrypt
```

para generar y validar:

```text
passwordHash
```

---

# 21. passwordHash

`passwordHash` es información sensible.

Debe cumplirse:

```text
User persisted
→ may contain passwordHash

User returned by API
→ must not contain passwordHash
```

Nunca debe aparecer en:

```text
API responses

JWT

frontend

logs

exceptions

exports

audit metadata
```

---

# 22. Estado de sanitización

Actualmente:

```text
AuthService.register()
→ returns sanitized user

AuthService.login()
→ returns sanitized user

/auth/me
→ uses sanitized authenticated claims/context
```

La exposición histórica de `passwordHash` en respuestas de Auth:

```text
RESOLVED
```

No debe continuar apareciendo como deuda vigente.

---

# 23. Respuesta segura de User

Una representación segura puede incluir, según contrato:

```text
id

companyId

firstName

lastName

email

role

locale

isActive
```

Nunca:

```text
passwordHash
```

---

# 24. No exponer Prisma User directamente

Anti-patrón:

```ts
return user;
```

cuando `user` contiene campos internos sensibles.

La arquitectura debe preferir estrategias como:

```text
safe selection

mapping

response DTO

serializer
```

No debe depender de recordar manualmente eliminar `passwordHash` en cada Controller.

---

# 25. Authentication

La implementación actual utiliza:

```text
Email + Password
↓
Credential Validation
↓
JWT Access Token
↓
Authenticated Requests
```

Authentication responde:

```text
Who are you?
```

No:

```text
Can you execute every action?
```

---

# 26. Login

Un login seguro debe:

```text
validate credentials

validate account access state

construct safe authenticated identity

issue token

return safe response
```

Actualmente existe deuda en:

```text
User.isActive enforcement
```

---

# 27. Invalid credentials

Errores de login no deben revelar innecesariamente:

```text
email exists but password is wrong
```

Preferir mensajes suficientemente genéricos para reducir user enumeration.

La contraseña recibida no debe:

```text
be stored

be logged

appear in exception metadata
```

---

# 28. JWT Access Token

Actualmente Zaping utiliza:

```text
JWT Access Token
```

Las solicitudes protegidas utilizan:

```http
Authorization: Bearer <token>
```

---

# 29. JwtStrategy

`JwtStrategy` reconstruye el contexto autenticado utilizado por la aplicación.

El contexto actual incluye conceptos como:

```text
User id

companyId

email

role
```

según el payload implementado.

Actualmente existe una limitación:

```text
JwtStrategy
→ does not fully revalidate active User state against database
```

---

# 30. JWT_SECRET

La firma depende de:

```text
JWT_SECRET
```

Debe provenir de:

```text
environment configuration

future secret management
```

Nunca:

```text
source code

Git

documentation

screenshots

shared fixtures
```

---

# 31. JWT payload

El JWT debe contener únicamente claims necesarios.

Puede incluir:

```text
userId / sub

companyId

email

role
```

según contrato.

Nunca:

```text
password

passwordHash

secrets

unnecessary sensitive data
```

Principio:

```text
Signed JWT
≠
Encrypted data
```

Quien posee el token normalmente puede leer su payload.

---

# 32. Token expiration

Los Access Tokens deben tener expiración.

No deben actuar como credenciales permanentes.

La duración exacta pertenece a configuración de seguridad.

---

# 33. Frontend token storage — CURRENT

Actualmente el frontend conserva el JWT en:

```text
localStorage
```

Este es el estado real del sistema.

Riesgo relevante:

```text
successful XSS
→ token may be compromised
```

Esto hace especialmente importante proteger el frontend contra ejecución de JavaScript no confiable.

---

# 34. Session strategy — P1

Antes de mayor madurez productiva debe revisarse formalmente:

```text
token lifetime

frontend storage

logout behavior

refresh tokens

revocation

User deactivation

password-change invalidation
```

El sistema no debe asumir que eliminar el token de `localStorage` equivale a revocarlo en servidor.

---

# 35. Stateless logout

Con Access JWT stateless:

```text
Frontend logout
→ deletes local token
```

pero:

```text
previously issued token
→ may remain cryptographically valid until expiration
```

Una revocación inmediata requiere infraestructura adicional.

---

# 36. Refresh Tokens

Actualmente:

```text
Refresh Tokens
→ NOT IMPLEMENTED
```

Una arquitectura futura puede utilizar:

```text
short-lived Access Token
+
Refresh Token
```

pero deberá definir:

```text
storage

rotation

expiration

reuse detection

revocation

logout
```

---

# 37. Current Auth endpoints

Actualmente existen capacidades bajo:

```text
/auth
```

incluyendo:

```text
POST /auth/register

POST /auth/login

POST /auth/reset-password

GET /auth/me
```

Los DTOs y contratos exactos pertenecen al código vigente.

---

# 38. `/auth/me`

Conceptualmente:

```text
GET /auth/me
↓
authenticated identity
```

No debe utilizarse para consultar arbitrariamente otro User.

No debe aceptar:

```text
userId of another account
```

como sustituto de la identidad autenticada.

---

# 39. Registration

`/auth/register` existe actualmente.

Su semántica debe tratarse con cuidado.

No debe asumirse:

```text
public registration
→ permission to create privileged Users
```

El provisioning inicial de una Company es diferente de la creación posterior de usuarios internos.

---

# 40. Initial Administrator

Conceptualmente:

```text
Company Provisioning
↓
Initial Administrator
```

puede asignar explícitamente:

```text
ADMIN
```

porque forma parte de un flujo controlado de bootstrap.

Esto no justifica que usuarios posteriores hereden `ADMIN` por default.

---

# 41. Riesgo P0 — `role @default(ADMIN)`

Actualmente Prisma define:

```text
User.role
→ default ADMIN
```

Esto crea un riesgo:

```text
generic User creation
+
role omitted
↓
ADMIN
```

Una operación de creación de usuarios no debe depender de este default.

---

# 42. Safe role provisioning

Debe cumplirse:

```text
Initial Company Administrator
→ ADMIN assigned explicitly
```

y:

```text
Additional User
→ authorized actor
+
explicit authorized role
```

No:

```text
role omitted
↓
implicit ADMIN
```

Este punto es:

> **P0 — Release Blocker**

Debe evaluarse posteriormente si el default Prisma debe eliminarse o sustituirse por una estrategia más segura.

---

# 43. Password Reset — CURRENT

Actualmente existe:

```text
POST /auth/reset-password
```

y el flujo actual no utiliza todavía una infraestructura segura de recovery token que demuestre control de la cuenta.

Por tanto:

```text
current reset-password
→ NOT production-safe as full forgot-password recovery
```

Este punto es:

> **P0 — Release Blocker**

---

# 44. Forgot Password — TARGET

Un flujo seguro deberá ser equivalente a:

```text
Request password recovery
↓
Generate temporary random token
↓
Verify account control
↓
Validate expiration
↓
Reset password
↓
Invalidate token
```

El token debe ser:

```text
random

hard to predict

temporary

single-use when practical

not logged
```

No debe permitirse cambiar una contraseña únicamente con conocimiento del email.

---

# 45. Change Password

Debe distinguirse de Forgot Password.

Conceptualmente:

```text
Authenticated User
↓
Change Password
```

es distinto de:

```text
Lost Account Access
↓
Forgot Password Recovery
```

Estos workflows no deben mezclarse en un endpoint genérico sin reglas claras.

---

# 46. UserRole actual

Actualmente:

```text
User
↓
one UserRole
```

Enum:

```text
ADMIN

MANAGER

SALES

WAREHOUSE
```

Este es el modelo:

```text
CURRENT
```

---

# 47. ADMIN

Representa el mayor nivel empresarial actual dentro del tenant.

No significa:

```text
Zaping Platform Administrator
```

No elimina tenant isolation.

---

# 48. MANAGER

Representa gestión empresarial dentro del tenant.

La matriz exacta de autorización debe ser explícita en implementación.

---

# 49. SALES

Representa operaciones comerciales.

No debe obtener acceso a otras capacidades simplemente porque una ruta carezca de protección apropiada.

---

# 50. WAREHOUSE

Actualmente se relaciona principalmente con capacidades como:

```text
Inventory

Purchase Receipts

selected operational reads
```

Capacidades como:

```text
Delivery
advanced Warehouse Operations
```

pertenecen a arquitectura TARGET/FUTURE y no deben presentarse como implementadas actualmente.

---

# 51. Role y tenant son controles distintos

```text
role
→ what can you do?
```

```text
companyId
→ where can you do it?
```

Debe cumplirse:

```text
has role/permission
+
resource belongs to another Company
=
DENY
```

---

# 52. JwtAuthGuard

Las rutas privadas deben utilizar:

```text
JwtAuthGuard
```

o el mecanismo equivalente aprobado.

Solo rutas deliberadamente públicas deben omitir Authentication.

---

# 53. Public endpoints

Ejemplos actuales o potenciales:

```text
login

register depending on provisioning strategy

password recovery request
```

Toda ruta pública aumenta superficie de ataque y debe revisarse proporcionalmente.

---

# 54. Default secure posture

Una operación sensible nueva no debe quedar pública por accidente.

La protección debe ser:

```text
explicit

reviewable

testable
```

---

# 55. RolesGuard — CURRENT

Actualmente existen:

```text
@Roles(...)

RolesGuard
```

Conceptualmente:

```text
required roles
↓
RolesGuard
↓
request.user.role
↓
allow / deny
```

Su uso está verificado explícitamente en Healthcare Cases.

No existe todavía una política RBAC granular aplicada homogéneamente a todo ERP Core.

---

# 56. Limitaciones de Role-Only RBAC

Un modelo basado únicamente en:

```text
ADMIN
MANAGER
SALES
WAREHOUSE
```

puede producir:

```text
role explosion

duplicated controller rules

exceptions

limited customization

weak granularity
```

Conforme el producto crece.

---

# 57. Permission-Based Authorization — TARGET

La dirección arquitectónica es:

```text
User
↓
Role
↓
Permissions
↓
Business Action
```

Principio:

> **Las operaciones deben evolucionar hacia capacidades autorizables, no depender permanentemente de nombres de roles.**

---

# 58. Permissions

Convención conceptual:

```text
resource.action
```

Ejemplos sobre dominios actuales:

```text
customers.read

customers.update

products.read

inventory.read

inventory.adjust

purchases.create

purchases.approve

purchaseReceipts.create

sales.read

sales.create

sales.approve

equipment.read

equipment.inspect

equipment.retire

cases.view

cases.manage
```

Ejemplos futuros:

```text
deliveries.confirm

returns.confirm

caseKits.prepare

caseKits.dispatch

billing.view
```

---

# 59. Roles TARGET

Un Role puede convertirse en:

```text
permission group
```

Ejemplo conceptual:

```text
WAREHOUSE
├── inventory.read
├── purchaseReceipts.create
└── equipment.read
```

Posteriormente podrían existir Custom Roles como:

```text
Compras Senior

Almacén Recepción

Almacén Supervisor

Ventas Junior

Auditor
```

sin requerir lógica específica por nombre.

---

# 60. PermissionsGuard — TARGET

Conceptualmente:

```text
@RequirePermissions('inventory.adjust')
↓
PermissionsGuard
↓
resolved User permissions
↓
allow / deny
```

Actualmente:

```text
PermissionsGuard
→ TARGET
```

No debe documentarse como implementado.

---

# 61. No crear tablas solo por documentación

Este documento no ordena crear inmediatamente:

```text
Role

Permission

RolePermission

UserRoleAssignment
```

La evolución debe producirse cuando exista una necesidad real y una migración aprobada.

---

# 62. Secuencia de evolución RBAC

Orden recomendado:

```text
Permission catalog
↓
Role model design
↓
Default role mappings
↓
Permission resolver
↓
PermissionsGuard
↓
Controller migration
↓
Administration UI
↓
retire static role-only checks where appropriate
```

Durante la transición:

```text
UserRole + RolesGuard
```

pueden continuar funcionando.

No debe existir un período donde rutas críticas queden sin protección.

---

# 63. User Administration — TARGET

La administración completa de Users debe considerarse una capacidad controlada.

Requisito:

```text
authorized administrator
↓
manage Users
↓
only inside own Company
```

El contrato completo de Users API debe verificarse contra backend antes de declararlo implementado.

---

# 64. Create User — requisito

Una operación futura/normalizada de creación de User debe validar:

```text
authenticated authorized actor

tenant scope

global email uniqueness

explicit role

password policy

input validation
```

No debe aceptar arbitrariamente:

```text
companyId
```

desde frontend como autoridad.

---

# 65. Role assignment

Un usuario no debe poder elevar sus propios privilegios mediante operaciones de perfil.

Ejemplo prohibido:

```text
PATCH /users/me

{
  "role": "ADMIN"
}
```

si esa operación no es explícitamente administrativa y autorizada.

---

# 66. Separar operaciones sensibles

Preferir capacidades explícitas:

```text
Update Profile

Change Password

Change Role

Deactivate User

Reactivate User future
```

sobre un:

```text
PATCH User
```

que permita modificar indiscriminadamente:

```text
role
companyId
isActive
passwordHash
```

---

# 67. Self Profile

Una operación de perfil personal puede permitir:

```text
firstName

lastName

locale
```

según contrato.

No debe permitir:

```text
companyId

role

isActive

passwordHash
```

---

# 68. Mass Assignment

DTOs deben impedir modificación accidental de campos internos.

Especialmente:

```text
companyId

role

permissions

passwordHash

isActive

createdById
```

cuando la operación no tenga ownership explícito sobre ellos.

---

# 69. Backend como autoridad

Frontend puede ocultar o deshabilitar acciones.

Sin embargo:

```text
Frontend
≠
security authority
```

Una acción oculta debe continuar protegida en backend.

---

# 70. Frontend authorization

Mientras exista Role-only RBAC, frontend puede utilizar:

```text
role === ADMIN
```

para presentación.

Esto es:

```text
temporary UI authorization context
```

No sustituye la validación backend.

---

# 71. Hidden vs disabled

Como guía UX:

```text
Hidden
→ User never has that capability

Disabled
→ User may have capability
  but current resource state prevents action
```

No es una regla de seguridad backend.

---

# 72. Protected-route architecture

El frontend utiliza un AppShell autenticado, pero:

```text
AppShell
≠
server-side authorization guard
```

La arquitectura de rutas/sesión frontend todavía requiere hardening.

Actualmente la API y su manejo de `401` continúan siendo una línea crítica de protección.

---

# 73. Auth state

Frontend necesita conocer:

```text
authenticated state

safe User identity

authorization context
```

Mientras se resuelve la sesión debe evitar mostrar innecesariamente contenido protegido.

---

# 74. Expired token UX

Cuando el token expira:

```text
session invalid
↓
consistent application handling
↓
authentication flow
```

No debe producir únicamente errores dispersos sin contexto.

---

# 75. Brute force y abuse protection

Antes de exposición externa deben protegerse endpoints como:

```text
login

register if public

password recovery
```

mediante controles básicos proporcionales al riesgo.

Ejemplos:

```text
rate limiting

throttling

monitoring
```

Este punto pertenece a:

> **P0 antes de piloto/producción.**

---

# 76. Account lockout

No debe utilizarse un bloqueo permanente demasiado agresivo que permita a terceros provocar denial-of-service sobre una cuenta.

La protección contra brute force debe balancear:

```text
security
+
availability
```

---

# 77. User enumeration

Los flujos de:

```text
login

password recovery

registration
```

no deben revelar innecesariamente qué cuentas existen.

---

# 78. Audit — CURRENT

Actualmente existen hechos de auditoría específicos en algunos dominios:

```text
createdBy

receivedBy

inspectedBy

retiredBy

cancelledBy
```

No existe todavía un sistema transversal completo de Identity & Access Audit.

---

# 79. Audit — TARGET

Identity & Access deberá integrarse con una capacidad general de Audit para eventos como:

```text
Login success

Login failure

User created

User deactivated

User reactivated

Role changed

Permission changed

Password changed

session revoked
```

cuando la política de auditoría lo requiera.

Nunca almacenar en Audit:

```text
password

passwordHash

JWT

recovery token

secret
```

---

# 80. Logging de seguridad

Los logs deben contener contexto suficiente para diagnóstico sin capturar secretos.

Nunca:

```text
console.log(loginDto)
```

si incluye contraseña.

Nunca registrar JWT completos activos.

---

# 81. HTTP semantics

Conceptualmente:

```text
401
→ Authentication missing / invalid
```

```text
403
→ Authenticated but not authorized
```

En escenarios cross-tenant puede utilizarse:

```text
404
```

cuando sea apropiado para no revelar la existencia del recurso.

La estrategia debe ser consistente.

---

# 82. DTOs

Los límites HTTP deben utilizar contratos específicos.

Conceptualmente:

```text
RegisterDto

LoginDto

ResetPasswordDto

CreateUserDto future

UpdateProfileDto future

ChangeRoleDto future

UserResponseDto
```

No exponer directamente Prisma `User` como contrato público.

---

# 83. Select mínimo

Cuando un Service necesita validar un User debe evitar consultar columnas sensibles innecesarias cuando sea práctico.

Ejemplo:

```text
need:
id
companyId
isActive
role

do not automatically fetch:
passwordHash
```

si no se necesita.

---

# 84. Services y autorización

Responsabilidades:

```text
Controller / Guard
→ endpoint authentication / authorization
```

```text
Service
→ tenant
→ business invariants
→ state validation
```

Si un caso de uso crítico puede ser invocado desde varios entry points, no debe depender ciegamente de que un único Controller haya aplicado autorización correctamente.

Debe preservarse el contexto necesario para protegerlo.

---

# 85. Authorization no sustituye business rule

Ejemplo:

```text
User has inventory.adjust
```

no significa que pueda crear:

```text
invalid inventory adjustment
```

La operación debe cumplir reglas de negocio.

---

# 86. Business rule no sustituye authorization

Una operación empresarialmente válida:

```text
≠
authorized operation
```

Ambas condiciones deben cumplirse.

---

# 87. External identities — FUTURE

Customer Portal y otras aplicaciones externas pueden necesitar identidades diferentes de `User`.

No asumir:

```text
Customer contact
=
internal User
```

Conceptualmente:

```text
External Identity
↓
Customer Access
↓
Company context
↓
Authorized resources
```

---

# 88. Platform Administrator — FUTURE

Una futura capacidad administrativa interna de Zaping debe modelarse separadamente.

No:

```text
ADMIN
+
skip companyId filter
```

Debe existir una frontera explícita entre:

```text
Tenant Administrator
```

y:

```text
Platform Operator / Administrator
```

si algún día se necesita.

---

# 89. Service Accounts — FUTURE

Integraciones automatizadas no deberían reutilizar cuentas humanas por defecto.

Una futura identidad de servicio debe tener:

```text
own identity

Company / tenant context

permissions

lifecycle

audit
```

---

# 90. MFA — FUTURE

MFA puede incorporarse para:

```text
Administrators

high-privilege users

enterprise customers

sensitive actions
```

No está implementado actualmente.

---

# 91. SSO — FUTURE

Posibles integraciones futuras:

```text
Microsoft Entra ID

Google Workspace

OIDC

SAML
```

No pertenecen al ERP Core V1 actual.

---

# 92. API Clients — FUTURE

Una futura Public API puede utilizar:

```text
API Keys

OAuth Client Credentials

Service Accounts
```

No debe utilizar cuentas humanas con password como mecanismo universal para integraciones.

---

# 93. Testing de Authentication

Debe cubrir según capacidad implementada:

```text
valid login

invalid credentials

safe response without passwordHash

JWT protection

invalid token

expired token

inactive User enforcement once implemented
```

Una vulnerabilidad corregida debe recibir una prueba de regresión cuando sea razonable.

---

# 94. Testing de Tenant Isolation

Los módulos críticos deben probar:

```text
Company A User
→ read Company B resource
→ DENY
```

y:

```text
Company A User
→ mutate Company B resource
→ DENY
```

También relaciones cross-tenant cuando correspondan.

La matriz sistemática completa continúa siendo trabajo P0.

---

# 95. Testing de RolesGuard — CURRENT

Mientras exista Role-only RBAC deben probarse:

```text
allowed role

denied role

missing authenticated User

route with required roles

route without role restriction
```

según comportamiento del Guard.

---

# 96. Testing Permissions — TARGET

Cuando exista Permissions:

```text
has permission
→ allowed

missing permission
→ denied

permission via role
→ allowed

valid permission + wrong tenant
→ denied
```

---

# 97. Current capabilities

Actualmente Identity & Access cuenta con:

```text
User model

Company ownership

global unique email

bcrypt password hashing

JWT authentication

JwtStrategy

JwtAuthGuard

UserRole enum

ADMIN
MANAGER
SALES
WAREHOUSE

RolesGuard

@Roles where configured

isActive field

locale

safe register/login responses

/auth/register

/auth/login

/auth/reset-password

/auth/me
```

---

# 98. P0 — Release Blockers

Antes de un piloto externo o producción deben resolverse:

```text
1. Secure password recovery

2. User.isActive enforcement

3. Safe explicit role provisioning

4. Remove implicit ADMIN privilege risk

5. Systematic tenant-isolation regression

6. Authorization review for critical ERP endpoints

7. Basic abuse/rate-limit protection for Auth public endpoints

8. Security regression coverage for resolved blockers
```

`passwordHash` response sanitization:

```text
RESOLVED
```

No pertenece al backlog P0 actual.

---

# 99. P1 — Hardening

Después de P0:

```text
session/token strategy review

refresh / revocation

frontend protected-route hardening

User administration

business Audit integration

legacy tenant-safe write hardening

dependency security review

security observability
```

Permission-based RBAC puede avanzar dentro de esta evolución según prioridad de producto.

---

# 100. FUTURE

```text
Custom Roles

multiple role assignments if needed

MFA

SSO

external identities

service accounts

multi-company memberships

delegated administration

temporary permissions

advanced session management
```

No deben implementarse antes de existir una necesidad clara.

---

# 101. Invariantes

## Password

```text
Password
→ never persisted in plaintext
```

---

## PasswordHash

```text
passwordHash
→ never returned to client
```

```text
passwordHash
→ never inside JWT
```

---

## Tenant

```text
Validated authenticated context
→ authoritative Company context
```

```text
Client companyId
→ not authorization
```

---

## Authentication

```text
Valid JWT
≠
permission for every action
```

---

## Authorization

```text
Role / Permission
≠
Tenant bypass
```

---

## ADMIN

```text
ADMIN
≠
Platform Administrator
```

---

## Inactive User

```text
User.isActive = false
→ must not have normal application access
```

---

## User Creation

```text
Additional User creation
→ explicit authorized role
```

Not:

```text
role omitted
→ accidental ADMIN
```

---

## Frontend

```text
Hidden button
≠
protected endpoint
```

---

## Failure mode

```text
Uncertain authorization
→ DENY
```

---

# 102. Anti-patrones

## Returning Prisma User directly

```ts
return user;
```

cuando puede contener:

```text
passwordHash
```

---

## ADMIN by default

```text
generic User create
↓
@default(ADMIN)
↓
privilege escalation
```

---

## Authentication = Authorization

```text
Has JWT
→ allow everything
```

---

## Role = Tenant

```text
ADMIN
→ access every Company
```

---

## Frontend-only security

```text
Button hidden
→ endpoint considered secure
```

---

## Generic User PATCH

```text
PATCH User

role
companyId
passwordHash
isActive
```

sin operaciones explícitas y autorizadas.

---

## Password logging

Registrar DTOs que incluyen contraseña.

---

## JWT logging

Registrar tokens completos.

---

## Public privileged registration

Permitir crear Users privilegiados mediante un flujo público no controlado.

---

## User hard delete

Eliminar físicamente Users con historia operacional.

---

## Secrets in repository

Versionar:

```text
JWT_SECRET

DATABASE_URL

API keys

passwords
```

---

# 103. Relación con Companies

`COMPANIES.md` responde:

```text
¿Dentro de qué tenant?
```

`IDENTITY_ACCESS.md` responde:

```text
¿Quién?
¿Qué puede hacer?
¿Cómo demuestra su identidad?
```

---

# 104. Relación con Security Principles

`SECURITY_PRINCIPLES.md` define controles transversales.

`IDENTITY_ACCESS.md` especifica su aplicación al dominio de:

```text
Authentication

Users

Roles

Tenant context

Authorization
```

---

# 105. Relación con Audit

Identity & Access deberá producir o colaborar con Audit para registrar eventos sensibles sin almacenar secretos.

Audit:

```text
≠
technical logs
```

---

# 106. ADR relacionados

```text
ADR-001 — Multi-Tenant

ADR-004 — UUID Strategy

ADR-005 — Layered Architecture

ADR-006 — API First

ADR-007 — Role-Based Access Control

ADR-009 — Modular Monolith

ADR-012 — Entity Lifecycle
```

---

# 107. Documentación relacionada

```text
docs/product/PRODUCT_REQUIREMENTS.md

docs/architecture/ARCHITECTURE.md

docs/architecture/adr/

docs/engineering/API_GUIDELINES.md

docs/engineering/SECURITY_PRINCIPLES.md

docs/engineering/QUALITY_STANDARDS.md

docs/modules/erp/COMPANIES.md

docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md
```

---

# 108. Fuente de verdad

```text
IDENTITY_ACCESS.md
→ comportamiento funcional y arquitectura de Identity & Access

SECURITY_PRINCIPLES.md
→ reglas transversales de seguridad

ADR-001
→ tenant architecture

ADR-007
→ RBAC architecture direction

schema.prisma
→ current persistence model

Auth / Users backend
→ CURRENT implementation

tests
→ validated behavior

PROJECT_BOARD.md
→ current security blockers and active work
```

---

# 109. Regla de transición RBAC

Mientras el código utilice:

```text
UserRole
+
RolesGuard
```

debe identificarse como:

```text
CURRENT RBAC
```

La arquitectura:

```text
Role
+
Permissions
+
PermissionsGuard
```

debe identificarse como:

```text
TARGET RBAC
```

hasta quedar implementada y validada.

---

# 110. Principio final

Identity & Access debe mantener separadas cuatro preguntas:

```text
Identity
→ ¿Quién eres?

Tenant
→ ¿Dónde operas?

Authorization
→ ¿Qué puedes hacer?

Business Rule
→ ¿Es válida esta operación?
```

La respuesta nunca debe reducirse a:

```text
Tiene JWT
→ permitir
```

ni:

```text
Es ADMIN
→ permitir todo
```

La dirección correcta es:

```text
Verified Identity
+
Trusted Tenant Context
+
Explicit Authorization
+
Valid Business Operation
=
Allowed Action
```
