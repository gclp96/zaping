# Identity & Access — Zaping

**Módulo:** Identity & Access
**Producto:** Zaping Platform / ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** AUTH IMPLEMENTED / RBAC PARTIAL / PERMISSIONS TARGET
**Última actualización:** 2026-08-19
**Responsable:** Zaping Platform & Security Team

---

# 1. Propósito

Identity & Access administra:

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

Este dominio reúne conceptualmente:

```text
Authentication
Users
Roles
Permissions
Authorization
Tenant Context
```

Estas capacidades se documentan juntas porque forman una sola cadena de seguridad.

---

# 2. Principio fundamental

Toda operación protegida debe responder, en orden:

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

---

# 3. Arquitectura de seguridad

La secuencia conceptual es:

```text
Authentication
↓
Tenant Context
↓
Authorization
↓
Business Validation
↓
Persistence
↓
Audit
```

---

# 4. Responsabilidades

Identity & Access es propietario de:

* identidad interna de usuario;
* autenticación;
* password hashing;
* JWT;
* estado de usuario;
* roles actuales;
* futura resolución de permisos;
* Guards de autenticación/autorización;
* contexto de usuario autenticado;
* integración entre User y Company.

---

# 5. Fuera del alcance

Identity & Access no es propietario de:

* lifecycle de Customers;
* Inventory;
* Purchases;
* Sales;
* Healthcare;
* reglas comerciales;
* lógica de stock;
* Customer Portal externo completo;
* OAuth empresarial;
* SSO;
* MFA.

Estas capacidades pueden integrarse posteriormente.

---

# 6. User

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

La definición técnica exacta permanece en `schema.prisma`.

---

# 7. Identificador

User utiliza:

```text
id
→ UUID
```

como identidad técnica.

---

# 8. User y Company

Actualmente:

```text
User
→ belongs to one Company
```

mediante:

```text
companyId
```

---

# 9. Regla multi-tenant

La Company del User define su contexto empresarial actual.

Conceptualmente:

```text
Authenticated User
↓
companyId
↓
Tenant-owned resources
```

---

# 10. companyId no proviene del frontend

Frontend no debe poder elevar o cambiar su tenant mediante:

```json
{
  "companyId": "otra-company"
}
```

El tenant debe derivarse de la identidad autenticada.

---

# 11. User de otra Company

Conocer:

```text
userId
resourceId
companyId
```

de otra Company no concede acceso.

---

# 12. Email

Actualmente:

```text
User.email
```

es único globalmente.

Conceptualmente:

```text
email @unique
```

---

# 13. Consecuencia de email global

El modelo actual no permite naturalmente:

```text
same email
→ User Company A

same email
→ User Company B
```

como dos Users independientes.

---

# 14. Relación con multi-company futuro

Si posteriormente una misma persona necesita acceso a múltiples Companies, la solución recomendada no es duplicar Users con el mismo email.

Debe diseñarse un modelo explícito de memberships.

Conceptualmente:

```text
Identity
↓
CompanyMembership
↓
Company
```

Este modelo no existe actualmente.

---

# 15. firstName y lastName

Representan la identidad visible del usuario interno.

No deben utilizarse como identificadores únicos.

---

# 16. locale

User contiene actualmente:

```text
locale
```

con default:

```text
es
```

Esto permite una preferencia individual distinta del idioma por defecto de Company.

---

# 17. Company language vs User locale

Conceptualmente:

```text
Company.language
→ default empresarial
```

```text
User.locale
→ preferencia personal
```

La precedencia completa deberá formalizarse cuando i18n esté implementado integralmente.

---

# 18. isActive

User utiliza:

```text
isActive
```

para representar disponibilidad de acceso.

---

# 19. User activo

Un User activo puede autenticarse cuando cumple las demás condiciones de seguridad.

---

# 20. User inactivo

Un User inactivo debe conservarse históricamente.

Conceptualmente:

```text
ACTIVE
↓
INACTIVE
```

No:

```text
User
↓
DELETE
```

como mecanismo normal para retirar acceso.

---

# 21. Desactivar usuario

La operación empresarial recomendada es:

```text
Desactivar usuario
```

cuando una persona deja de trabajar o deja de requerir acceso.

---

# 22. User histórico

Desactivar un User no debe borrar referencias como:

```text
createdBy
receivedBy
confirmedBy
cancelledBy
audit events
```

---

# 23. Reactivación

Cuando sea apropiado:

```text
INACTIVE
↓
ACTIVE
```

puede restaurarse acceso.

La operación debe requerir autorización administrativa.

---

# 24. Password

La contraseña en texto plano:

> nunca debe persistirse.

---

# 25. passwordHash

El modelo conserva:

```text
passwordHash
```

como representación derivada mediante hashing.

---

# 26. Hashing

La arquitectura actual utiliza:

```text
bcrypt
```

para almacenar y verificar contraseñas.

---

# 27. PasswordHash es sensible

`passwordHash` nunca debe aparecer en:

* respuestas API;
* JWT;
* logs;
* errores;
* frontend;
* archivos exportados.

---

# 28. Regla crítica

Debe cumplirse:

```text
User stored in database
→ contains passwordHash
```

pero:

```text
User returned by API
→ never contains passwordHash
```

---

# 29. Deuda de seguridad conocida

Existe una mejora de seguridad registrada:

> `AuthService.login()` no debe devolver el objeto User completo si contiene `passwordHash`.

La respuesta debe incluir únicamente información necesaria.

---

# 30. Respuesta segura de User

Conceptualmente puede incluir:

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

según el contrato necesario.

Nunca:

```text
passwordHash
```

---

# 31. Sanitización centralizada

La solución no debe depender de recordar manualmente:

```ts
delete user.passwordHash
```

en cada Controller.

Debe existir una estrategia consistente de:

* DTO de respuesta;
* mapping;
* serializer;
* selección Prisma segura;

según el patrón adoptado.

---

# 32. Authentication

La implementación actual utiliza JWT para Authentication.

Conceptualmente:

```text
Email + Password
↓
Credential Validation
↓
JWT
↓
Authenticated Requests
```

---

# 33. Login

El endpoint de login debe:

1. validar credenciales;
2. verificar el estado del User;
3. construir identidad autenticada;
4. emitir token;
5. devolver únicamente datos seguros.

---

# 34. Credenciales inválidas

La API no debe revelar información innecesaria como:

```text
El usuario existe pero la contraseña es incorrecta.
```

cuando esto facilite enumeración de usuarios.

Preferir un mensaje suficientemente genérico para credenciales inválidas.

---

# 35. Contraseña durante Login

La contraseña recibida debe utilizarse únicamente para validación.

No debe:

* almacenarse;
* registrarse;
* incluirse en logs;
* incluirse en excepciones.

---

# 36. JWT Access Token

La implementación actual utiliza:

```text
JWT Access Token
```

para autenticar solicitudes.

---

# 37. Bearer Token

Las solicitudes protegidas utilizan conceptualmente:

```http
Authorization: Bearer <token>
```

---

# 38. JwtStrategy

La estrategia JWT actual obtiene la identidad desde el Bearer Token y reconstruye:

```text
req.user
```

o contexto equivalente.

---

# 39. JWT_SECRET

La firma del token depende de una configuración secreta.

Debe provenir de:

```text
Environment / Secret Management
```

Nunca del código fuente.

---

# 40. Secrets

No deben almacenarse en Git:

```text
JWT_SECRET
DATABASE_URL
API keys
passwords
private credentials
```

---

# 41. JWT Payload

El token debe contener únicamente información necesaria para Authentication/Authorization.

Puede necesitar conceptos como:

```text
userId
companyId
role / authorization context
```

según la implementación.

---

# 42. No incluir información sensible

Nunca incluir:

```text
passwordHash
password
secrets
unnecessary personal data
```

en el JWT.

---

# 43. JWT no es almacenamiento privado

El contenido de un JWT firmado normalmente puede ser leído por quien posea el token.

Por tanto:

> Firmado no significa secreto.

---

# 44. Token expiration

Los Access Tokens deben tener expiración.

No deben diseñarse como credenciales permanentes.

La duración exacta pertenece a configuración de seguridad.

---

# 45. Refresh Tokens

La arquitectura histórica contempla:

```text
Refresh Tokens
```

como capacidad futura.

No deben documentarse como implementados actualmente.

---

# 46. Estrategia futura de sesión

Una evolución puede introducir:

```text
Short-lived Access Token
+
Refresh Token
```

pero deberá definir:

* almacenamiento;
* rotación;
* revocación;
* expiración;
* logout;
* detección de reuse.

---

# 47. Logout con JWT stateless

Con únicamente Access Tokens stateless, logout del frontend puede significar eliminar su copia local.

Eso no revoca automáticamente un token previamente emitido.

Una estrategia de revocación requiere diseño adicional.

---

# 48. Token storage en frontend

La estrategia exacta de almacenamiento debe evaluarse de acuerdo con:

* XSS;
* CSRF;
* arquitectura Next.js;
* expiración;
* refresh tokens.

Este documento no impone todavía `localStorage`, cookies u otra estrategia específica.

---

# 49. Regla

No debe elegirse almacenamiento de token únicamente por comodidad.

La decisión pertenece a seguridad de frontend.

---

# 50. Auth endpoints actuales

El estado validado del proyecto contempla capacidades bajo:

```text
/auth
```

incluyendo:

```text
register
login
reset-password
me
```

La implementación exacta continúa siendo la fuente técnica para DTOs y contratos.

---

# 51. `/auth/me`

Una capacidad `me` permite recuperar la identidad del usuario autenticado.

Debe devolver únicamente información segura y necesaria.

---

# 52. `me` no consulta otro usuario

Conceptualmente:

```text
GET /auth/me
```

debe derivar el User desde la identidad autenticada.

No debe aceptar arbitrariamente:

```text
userId
```

para consultar otra identidad.

---

# 53. Registration

El significado de:

```text
/auth/register
```

debe distinguirse según el workflow.

Puede representar actualmente provisioning inicial o registro permitido por la aplicación.

No debe convertirse automáticamente en un endpoint público para crear Users privilegiados.

---

# 54. Riesgo crítico: role default ADMIN

El schema actual define:

```text
role UserRole @default(ADMIN)
```

Esto debe tratarse con especial cuidado.

---

# 55. Consecuencia

Si una operación genérica crea un User sin especificar explícitamente su rol:

```text
new User
↓
ADMIN
```

puede producir una elevación de privilegios accidental.

---

# 56. Regla objetivo de menor privilegio

> **Nunca debe utilizarse el default `ADMIN` como mecanismo de autorización para creación genérica de usuarios.**

Todo flujo de creación debe asignar explícitamente un rol autorizado.

---

# 57. Recomendación de evolución

Durante el refactor de Identity & Access debe evaluarse:

```text
eliminar @default(ADMIN)
```

o sustituirlo por una estrategia segura de provisioning.

No se modifica Prisma únicamente desde este documento.

---

# 58. Initial Administrator

La creación del primer administrador de una Company es diferente de crear un usuario interno adicional.

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

---

# 59. Additional User

La creación posterior de otro usuario debe requerir:

```text
authorized administrator
+
explicit role assignment
```

---

# 60. Password Reset

Existe una capacidad actual denominada:

```text
reset-password
```

pero su semántica completa debe revisarse antes de considerarla un sistema completo de recuperación de contraseña.

---

# 61. Dos casos distintos

Debe distinguirse conceptualmente:

```text
Change Password
```

usuario autenticado conoce su contraseña o posee sesión válida.

de:

```text
Forgot Password
```

usuario perdió acceso y requiere recuperación segura.

---

# 62. Forgot Password futuro

Un workflow robusto puede requerir:

```text
Request reset
↓
single-use token
↓
expiration
↓
password change
↓
token invalidation
```

No debe afirmarse que esta infraestructura existe actualmente.

---

# 63. No enviar passwords por email

Nunca debe enviarse:

```text
your password is...
```

por correo.

Las contraseñas deben ser elegidas/reestablecidas mediante un proceso seguro.

---

# 64. UserRole actual

El schema actual define:

```text
ADMIN
MANAGER
SALES
WAREHOUSE
```

---

# 65. Estado de UserRole

Este enum representa el modelo de autorización **CURRENT**.

Actualmente:

```text
User
↓
one UserRole
```

---

# 66. ADMIN

Conceptualmente representa el mayor nivel operativo dentro del tenant.

No debe confundirse automáticamente con:

```text
Platform Administrator
```

de Zaping.

---

# 67. MANAGER

Representa un rol empresarial con capacidades de gestión.

La matriz exacta de acciones permitidas debe mantenerse explícita en la implementación.

---

# 68. SALES

Representa funciones relacionadas con workflows comerciales.

No debe tener acceso automático a toda capacidad únicamente porque un Controller olvidó protección.

---

# 69. WAREHOUSE

Representa operaciones relacionadas principalmente con:

* Inventory;
* Receipts;
* Deliveries;
* Warehouse workflows.

La matriz concreta debe evolucionar con Permissions.

---

# 70. Role no es tenant

Debe distinguirse:

```text
role
→ qué puede hacer
```

de:

```text
companyId
→ dónde puede hacerlo
```

---

# 71. Authentication vs Authorization

```text
Valid JWT
```

solo responde:

```text
Who are you?
```

No:

```text
Can you do this?
```

---

# 72. JwtAuthGuard

Las rutas protegidas deben requerir Authentication mediante:

```text
JwtAuthGuard
```

o el mecanismo equivalente adoptado.

---

# 73. Public routes

Solo endpoints explícitamente públicos deben omitir Authentication.

Ejemplos potenciales:

```text
login
password recovery request
```

según su diseño.

---

# 74. Default secure posture

Una nueva operación sensible no debe quedar pública accidentalmente.

La protección debe ser visible y verificable.

---

# 75. RolesGuard actual

La implementación actual utiliza una estrategia basada en roles.

Conceptualmente:

```text
@Roles(...)
↓
RolesGuard
↓
user.role
↓
allow / deny
```

---

# 76. Comportamiento actual

Si una ruta declara roles requeridos:

```text
requiredRoles
```

el Guard compara contra:

```text
user.role
```

---

# 77. Limitación del modelo actual

Esto funciona para una primera versión, pero conduce a reglas como:

```text
ADMIN can
MANAGER can
SALES cannot
```

distribuidas en múltiples Controllers.

---

# 78. Problema de Role-Only RBAC

Conforme crece el producto puede producir:

* role explosion;
* reglas duplicadas;
* excepciones;
* dificultad para custom roles;
* poca granularidad.

---

# 79. Arquitectura objetivo ADR-007

El modelo objetivo es:

```text
User
↓
Role
↓
Permissions
↓
Business Action
```

---

# 80. Principio objetivo

> **Las operaciones deben autorizar capacidades, no depender permanentemente de nombres de roles.**

---

# 81. Permission

Un Permission representa una acción autorizable.

Convención:

```text
resource.action
```

---

# 82. Ejemplos

```text
customers.read
customers.create
customers.update
customers.deactivate

purchases.read
purchases.create
purchases.approve

inventory.read
inventory.adjust

sales.read
sales.create

deliveries.confirm

returns.confirm

dashboard.read
```

---

# 83. Roles objetivo

Un Role debe funcionar principalmente como:

```text
permission group
```

Ejemplo:

```text
WAREHOUSE
├── inventory.read
├── purchaseReceipts.create
├── deliveries.read
└── deliveries.confirm
```

---

# 84. Business code no debe depender del nombre

Evitar arquitectura permanente como:

```ts
if (user.role === 'ADMIN') {
  ...
}
```

dentro de lógica empresarial.

---

# 85. Excepción razonable

El rol puede seguir utilizándose:

* en administración;
* presentación;
* agrupación;
* defaults;

pero la autorización de acciones objetivo debe resolverse mediante Permissions.

---

# 86. Modelo Prisma TARGET

Actualmente no existen necesariamente modelos persistidos como:

```text
Role
Permission
RolePermission
```

porque el sistema utiliza `UserRole`.

---

# 87. No crear tablas todavía por documentación

Este documento no ordena crear inmediatamente:

```text
Role
Permission
UserRoleAssignment
RolePermission
```

---

# 88. Secuencia correcta

La migración deberá seguir:

```text
Permission catalog
↓
Role model
↓
Default role mappings
↓
Authorization Guard
↓
Migrate Controllers
↓
Administration UI
↓
Retire static role-only checks where appropriate
```

---

# 89. Compatibilidad

Durante la transición:

```text
UserRole enum
```

puede seguir funcionando.

No debe existir un período donde rutas críticas queden sin autorización debido a una migración incompleta.

---

# 90. Default Roles

Los roles actuales pueden convertirse posteriormente en roles predefinidos:

```text
Administrator
Manager
Sales
Warehouse
```

con conjuntos iniciales de Permissions.

---

# 91. Custom Roles

TARGET/FUTURE puede permitir:

```text
Compras Senior
Almacén Recepción
Almacén Supervisor
Ventas Junior
Auditor
```

sin modificar código para cada nuevo nombre.

---

# 92. Permissions por Company

Cuando existan Custom Roles, deberá definirse claramente cuáles son:

```text
system-defined
```

y cuáles:

```text
company-defined
```

No se decide aún el schema exacto.

---

# 93. Guard objetivo

Conceptualmente:

```text
@RequirePermissions('inventory.adjust')
↓
PermissionsGuard
↓
resolved user permissions
↓
allow / deny
```

---

# 94. Controller

Controller declara la autorización necesaria.

Ejemplo conceptual:

```text
POST /inventory-adjustments
requires inventory.adjust
```

---

# 95. Service

Los Services pueden asumir que la autorización de endpoint fue realizada para casos normales.

Pero deben continuar protegiendo:

* tenant;
* invariantes;
* reglas empresariales.

---

# 96. Authorization no sustituye business rule

Un usuario con:

```text
inventory.adjust
```

no puede crear un ajuste inválido.

---

# 97. Business rule no sustituye authorization

Una operación empresarialmente válida tampoco puede ejecutarse si el usuario no está autorizado.

---

# 98. Repository / Prisma

La capa de persistencia no debe convertirse en el lugar primario para decidir Permissions.

Su responsabilidad principal es acceso a datos.

---

# 99. Tenant Isolation siempre aplica

Debe cumplirse:

```text
User has permission
+
resource belongs to another Company
=
DENY
```

---

# 100. ADMIN no bypass tenant

También:

```text
role = ADMIN
```

no significa:

```text
access every Company
```

ADMIN es actualmente un rol del tenant.

---

# 101. Platform Administrator

Una futura capacidad administrativa interna de Zaping debe modelarse separadamente.

No debe lograrse mediante:

```text
ADMIN
+
skip company filter
```

---

# 102. User management

Un administrador autorizado debe poder gestionar usuarios de su propia Company.

Conceptualmente:

```text
Company
↓
Users
```

---

# 103. Create User

Al crear otro User deben validarse:

```text
authenticated admin/permission
Company scope
email uniqueness
role assignment
password policy
input validation
```

---

# 104. No permitir companyId arbitrario

Un administrador de Company A no debe poder crear:

```text
User
companyId = Company B
```

---

# 105. Role assignment

Un User no debe poder asignarse a sí mismo privilegios superiores mediante:

```text
PATCH /users/me
{
  "role": "ADMIN"
}
```

---

# 106. Mass Assignment

DTOs de actualización deben evitar aceptar campos sensibles indiscriminadamente.

Especialmente:

```text
companyId
passwordHash
role
isActive
```

cuando el endpoint no está diseñado para modificarlos.

---

# 107. Separar operaciones sensibles

Puede ser preferible disponer conceptualmente de acciones distintas:

```text
Update Profile
Change Role
Deactivate User
Reset Password
```

en lugar de un:

```text
PATCH User
```

que permita modificar cualquier propiedad.

---

# 108. Self Profile

Un usuario puede necesitar modificar información personal limitada.

Ejemplos:

```text
firstName
lastName
locale
```

según las reglas aprobadas.

---

# 109. Self Profile no es Administration

Modificar el propio perfil no debe permitir:

```text
role
companyId
isActive
```

---

# 110. Deactivate User

Desactivar a un User debe impedir nuevo acceso.

---

# 111. Access Token de User desactivado

Con JWT stateless, existe una consideración importante:

> un token emitido antes de la desactivación puede continuar siendo criptográficamente válido hasta expirar.

---

# 112. Estrategia de invalidación

Si el sistema necesita revocación inmediata deberá considerar mecanismos como:

* verificar estado del User;
* token version;
* session store;
* revocation strategy;

según el nivel de riesgo y performance.

No está definido todavía como infraestructura obligatoria.

---

# 113. Password Change y sesiones

Cuando cambia una contraseña puede existir la misma necesidad:

```text
¿deben invalidarse los demás tokens?
```

La estrategia debe definirse antes de producción si el riesgo lo requiere.

---

# 114. Password Policy

La política mínima de contraseña debe evitar credenciales triviales.

La definición exacta debe configurarse mediante requerimientos de seguridad y UX.

---

# 115. No imponer reglas arbitrarias

Una política como:

```text
1 uppercase
1 lowercase
1 symbol
1 number
exactly 14 chars
```

no debe adoptarse únicamente por tradición.

Debe priorizarse:

* longitud adecuada;
* bloqueo de passwords débiles;
* almacenamiento seguro;
* rate limiting;
* MFA futuro.

---

# 116. Login brute force

Antes de producción debe existir protección apropiada contra intentos automatizados.

Puede incluir:

```text
rate limiting
temporary throttling
monitoring
```

según arquitectura.

---

# 117. Account Lockout

Un bloqueo permanente después de pocos intentos puede convertirse en mecanismo de denial-of-service.

La estrategia deberá balancear seguridad y disponibilidad.

---

# 118. User enumeration

Los flujos de:

```text
login
forgot password
registration
```

no deben revelar innecesariamente qué cuentas existen.

---

# 119. Reset tokens

Los futuros tokens de recuperación deben ser:

* aleatorios;
* de uso único;
* con expiración;
* protegidos en almacenamiento.

No deben reutilizar Access JWT normales como token de recuperación sin diseño específico.

---

# 120. MFA

Multi-Factor Authentication es una evolución futura recomendable para:

* administradores;
* usuarios sensibles;
* operaciones críticas.

No está implementado actualmente.

---

# 121. SSO

Empresas mayores pueden requerir posteriormente:

```text
Microsoft Entra ID
Google Workspace
OIDC
SAML
```

No pertenece al Core actual.

---

# 122. External Identities

Customer Portal y aplicaciones externas pueden necesitar identidades diferentes de `User` interno.

No debe asumirse que:

```text
Customer contact
=
internal User
```

---

# 123. Customer Portal futuro

Conceptualmente:

```text
External Identity
↓
Customer Access
↓
Company Context
↓
Authorized Customer Resources
```

---

# 124. API Clients

La futura Public API puede utilizar:

```text
API Keys
OAuth Client Credentials
Service Accounts
```

u otro modelo.

No deben reutilizarse cuentas humanas con contraseña para integraciones automatizadas por defecto.

---

# 125. Service Accounts

Si posteriormente existen, deberán tener:

* identidad propia;
* tenant;
* permissions;
* lifecycle;
* audit.

---

# 126. Audit

Identity & Access debe integrarse con Audit para acciones sensibles.

Ejemplos:

```text
Login success
Login failure
User created
User deactivated
Role changed
Permission changed
Password changed
```

según la política de auditoría.

---

# 127. Password en Audit

Nunca registrar:

```text
password
passwordHash
reset token
JWT
```

en Audit.

---

# 128. Security logging

Los eventos de seguridad deben proporcionar suficiente contexto para investigación sin capturar secretos.

---

# 129. Authentication errors

Errores deben ser comprensibles para el cliente pero no revelar información sensible.

---

# 130. HTTP semantics

Conceptualmente:

```text
401
→ Authentication missing / invalid
```

```text
403
→ Authenticated but not authorized
```

---

# 131. 404 y tenant isolation

En algunos casos cross-tenant puede ser preferible responder:

```text
404
```

para no revelar que el recurso existe en otra Company.

La estrategia debe ser consistente.

---

# 132. Frontend Authorization

Frontend puede:

* esconder acciones;
* deshabilitar controles;
* adaptar navegación;

según Permissions.

---

# 133. Frontend no es autoridad

Aunque frontend oculte:

```text
[Eliminar]
```

backend debe continuar bloqueando la operación.

---

# 134. Navigation by role/permission

Una UX más limpia puede ocultar módulos que el usuario nunca podrá utilizar.

Ejemplo:

```text
WAREHOUSE
→ no necesita administración de Users
```

---

# 135. Disabled vs hidden

Una acción puede ocultarse cuando nunca pertenece al User.

Puede deshabilitarse cuando pertenece al usuario pero el estado del recurso la impide.

---

# 136. Permissions source

En la arquitectura TARGET, frontend debería poder obtener capacidades autorizadas de forma segura.

No mantener una segunda matriz hardcodeada incompatible con backend.

---

# 137. Frontend role checks CURRENT

Mientras exista Role-only RBAC, pueden existir controles como:

```text
role === ADMIN
```

en UI.

Deben considerarse lógica de presentación temporal.

La autoridad continúa siendo backend.

---

# 138. Authentication state

Frontend necesita conocer al menos:

```text
authenticated
user
authorization context
```

para construir la experiencia.

---

# 139. Loading auth state

Mientras se determina la sesión, la UI debe evitar mostrar brevemente contenido protegido como si el usuario tuviera acceso.

---

# 140. Expired token UX

Cuando expira la sesión, el usuario debe recibir una experiencia consistente.

No múltiples errores HTTP dispersos sin explicación.

---

# 141. HTTPS

En producción, credenciales y tokens deben transmitirse únicamente mediante conexiones seguras.

---

# 142. CORS

CORS debe configurarse explícitamente para los clientes autorizados.

No debe utilizarse:

```text
allow everything
```

como configuración de producción por comodidad.

---

# 143. ValidationPipe

Los DTOs de Auth/Users deben aprovechar la validación global del backend.

Debe rechazarse información inesperada cuando la configuración del sistema así lo determine.

---

# 144. DTOs

Debe existir separación entre:

```text
CreateUserDto
LoginDto
ResetPasswordDto
UpdateUserDto
UserResponseDto
```

o contratos equivalentes.

No exponer Prisma User directamente como contrato público.

---

# 145. Never expose entities directly

Particularmente importante para `User`, porque el modelo persistido contiene:

```text
passwordHash
```

---

# 146. Select mínimo

Cuando un Service necesita validar User, debe evitar consultar columnas sensibles que no necesita cuando sea práctico.

---

# 147. Logs

Nunca:

```ts
console.log(loginDto);
```

si puede contener la contraseña.

---

# 148. Exceptions

Nunca incluir credenciales dentro de:

```text
BadRequestException
UnauthorizedException
logging metadata
```

---

# 149. Environment

Los secretos deben mantenerse fuera de:

* documentación pública;
* screenshots;
* commits;
* fixtures compartidas;
* respuestas de soporte.

---

# 150. Tests

Authentication debe probar como mínimo:

```text
valid login
invalid credentials
inactive user
safe response without passwordHash
JWT protection
invalid token
expired token
```

según las capacidades implementadas.

---

# 151. Tenant tests

Debe comprobarse:

```text
authenticated User Company A
→ cannot operate on Company B resources
```

en módulos críticos.

---

# 152. Authorization tests CURRENT

Mientras exista `RolesGuard`, deben probarse:

```text
allowed role
denied role
route without role requirement
missing authenticated user
```

según su comportamiento.

---

# 153. Authorization tests TARGET

Con Permissions deberán probarse:

```text
has permission
missing permission
permission through role
tenant still enforced
```

---

# 154. Security regression

Toda vulnerabilidad corregida debe producir una prueba que impida regresión cuando sea razonable.

---

# 155. Current endpoints

El estado validado del proyecto contiene actualmente capacidades equivalentes a:

```text
POST /auth/register
POST /auth/login
POST /auth/reset-password
GET  /auth/me
```

Los DTOs y contratos exactos pertenecen al código vigente.

---

# 156. Roles endpoints

Los antiguos archivos API de Roles y Permissions no contenían contratos implementados.

Por tanto, este documento no inventa endpoints como:

```text
POST /roles
POST /permissions
```

como capacidades actuales.

---

# 157. Users API

De igual manera, el contrato completo de administración de Users debe verificarse contra el backend vigente antes de declararlo implementado.

---

# 158. Current model

CURRENT:

```text
User
↓
UserRole enum
↓
RolesGuard
```

con:

```text
ADMIN
MANAGER
SALES
WAREHOUSE
```

---

# 159. Target model

TARGET:

```text
User
↓
Role
↓
Permissions
↓
PermissionsGuard
↓
Business Action
```

---

# 160. Future model

FUTURE puede incluir:

```text
Custom Roles
Multiple Roles
Temporary Permissions
Delegated Administration
Field-Level Security
Approval Workflows
MFA
SSO
Service Accounts
Multi-company memberships
```

Solo deben implementarse cuando exista necesidad.

---

# 161. Current capabilities

El estado consolidado permite identificar:

```text
JWT authentication
bcrypt password hashing
User model
Company ownership
UserRole enum
isActive
locale
RolesGuard
protected routes
authenticated user context
```

---

# 162. Current security debt

Debe mantenerse visible al menos:

```text
Remove passwordHash from login/API responses
```

y revisar:

```text
UserRole default ADMIN
```

antes de considerar Identity & Access listo para producción.

---

# 163. Target priorities

La evolución recomendada es:

```text
P0
Safe Auth responses
Explicit safe user creation
Tenant isolation
Inactive-user enforcement
Security tests
```

```text
P1
Permission-based RBAC
User administration
Audit integration
Password recovery hardening
```

```text
P2
Custom roles
MFA
Session/revocation improvements
```

---

# 164. No sobrearquitecturar ahora

No necesitamos inmediatamente:

```text
IAM microservice
external identity provider
policy engine
distributed authorization service
```

El Modular Monolith puede manejar Identity & Access correctamente mientras la escala lo permita.

---

# 165. Invariantes

```text
Password
→ never persisted in plaintext
```

```text
passwordHash
→ never returned to client
```

```text
passwordHash
→ never inside JWT
```

```text
Authenticated User
→ belongs to one Company in current model
```

```text
companyId from JWT/context
→ authoritative tenant
```

```text
Client companyId
→ not authorization
```

```text
Valid JWT
≠
permission for every action
```

```text
ADMIN
≠
cross-tenant administrator
```

```text
Inactive User
→ should not receive normal application access
```

```text
Role
→ does not bypass tenant isolation
```

```text
User creation
→ must not accidentally escalate to ADMIN
```

---

# 166. Anti-patrones

## Returning Prisma User directly

```text
return user
```

cuando contiene:

```text
passwordHash
```

---

## ADMIN by default

Crear usuarios genéricos dependiendo silenciosamente de:

```text
@default(ADMIN)
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
→ endpoint considered protected
```

---

## Hardcoded roles everywhere

```text
if ADMIN...
if MANAGER...
if SALES...
```

distribuido por toda la lógica empresarial como arquitectura permanente.

---

## Password logging

Registrar DTOs o excepciones que contienen contraseña.

---

## JWT logging

Guardar tokens activos completos en logs.

---

## Public generic registration

Permitir crear usuarios privilegiados sin un flujo controlado de provisioning.

---

## User hard delete

Eliminar usuarios históricos que ya aparecen como responsables de operaciones.

---

## Secrets in repository

Guardar `JWT_SECRET` o credenciales en Git.

---

# 167. Relación con Companies

`COMPANIES.md` responde:

```text
¿Dentro de qué tenant?
```

`IDENTITY_ACCESS.md` responde:

```text
¿Quién?
¿Qué puede hacer?
```

---

# 168. Relación con módulos empresariales

Cada módulo debe utilizar Identity & Access.

Ejemplo:

```text
Authenticated User
↓
Permission
↓
Purchase Service
↓
Tenant validation
↓
Business rule
```

---

# 169. Relación con Audit

Audit deberá registrar acciones relevantes de identidad y autorización sin almacenar secretos.

---

# 170. Relación con API Guidelines

`API_GUIDELINES.md` define convenciones generales.

Identity & Access define la semántica específica de:

* Authentication;
* Authorization;
* User security;
* tenant context.

---

# 171. Relación con Security Principles

`SECURITY_PRINCIPLES.md` contiene reglas transversales de seguridad.

Este documento especifica cómo aplican al dominio Identity & Access.

---

# 172. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — Role-Based Access Control.
* ADR-009 — Modular Monolith.
* ADR-012 — Entity Lifecycle.

---

# 173. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md

architecture/ARCHITECTURE.md
architecture/adr/ADR-001-*.md
architecture/adr/ADR-007-*.md

engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
engineering/QUALITY_STANDARDS.md

modules/erp/COMPANIES.md
```

---

# 174. Fuente de verdad

```text
IDENTITY_ACCESS.md
→ comportamiento funcional de identidad y acceso

ADR-001
→ tenant isolation

ADR-007
→ arquitectura RBAC objetivo

SECURITY_PRINCIPLES.md
→ controles transversales

schema.prisma
→ modelo técnico actual

Auth / Users backend
→ implementación CURRENT

tests
→ comportamiento validado
```

---

# 175. Regla de transición

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

hasta que sea implementada y validada.

---

# 176. Principio final

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

La respuesta correcta nunca debe reducirse simplemente a:

```text
Tiene JWT
→ permitir
```

ni:

```text
Es ADMIN
→ permitir todo
```

> **La seguridad de Zaping depende de combinar identidad, tenant, autorización y reglas de negocio; ninguna de ellas sustituye a las demás.**
