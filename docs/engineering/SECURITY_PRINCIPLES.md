# Principios de Seguridad — Zaping

**Producto:** Zaping Platform
**Versión:** 2.2.0
**Estado:** Aprobado
**Última actualización:** 2026-09-02
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento define los principios, requisitos y límites de seguridad aplicables al ecosistema Zaping.

Su objetivo es proteger:

```text
cuentas de usuario

datos empresariales

aislamiento entre Companies

inventario

información comercial

operaciones financieras

Equipment

información Healthcare

documentos

integraciones

infraestructura
```

La seguridad debe formar parte del diseño de cada funcionalidad.

No debe tratarse como una revisión opcional al final del desarrollo.

---

# 2. Alcance

Estas reglas aplican a:

```text
Zaping ERP Core

Zaping Healthcare

Zaping Radar future

Zaping AI future

Frontend

Backend

Database

Public endpoints

Integrations

Infrastructure

Development workflow
```

Este documento establece principios y requisitos.

El estado operativo y los blockers vigentes pertenecen a:

```text
docs/project/PROJECT_BOARD.md
```

La arquitectura general pertenece a:

```text
docs/architecture/ARCHITECTURE.md
```

---

# 3. Principio fundamental

Zaping utiliza:

> **Security by Design y Secure by Default.**

Toda funcionalidad debe asumir que:

```text
inputs may be malicious

frontend data is untrusted

identifiers may be manipulated

authenticated users may attempt unauthorized actions

tenants must remain isolated

external integrations are trust boundaries

errors may expose sensitive information if poorly handled
```

Principio adicional:

```text
Authorization uncertainty
→ DENY
```

No:

```text
Authorization uncertainty
→ ALLOW
```

Cuando identidad, tenant o permiso no puedan determinarse con seguridad, la operación debe fallar de forma cerrada.

---

# 4. Objetivos de seguridad

## Confidencialidad

La información debe ser visible únicamente para usuarios autorizados.

---

## Integridad

La información no debe poder modificarse sin autorización ni reglas apropiadas.

---

## Disponibilidad

Los servicios deben mantenerse disponibles de acuerdo con los objetivos operacionales definidos.

---

## Trazabilidad

Las acciones relevantes deben poder atribuirse cuando el dominio lo requiera a:

```text
User
process
integration
business operation
```

---

# 5. Estado actual de seguridad

La documentación debe distinguir entre:

```text
IMPLEMENTED

VALIDATED

P0 / P1 DEBT

FUTURE
```

No debe presentarse una capacidad futura como si ya protegiera el sistema actual.

---

## 5.1 Implementado

Actualmente Zaping incorpora:

```text
bcrypt para passwordHash

JWT firmado

JWT con expiración

JWT secret mediante configuración de entorno

Passport JWT

JwtAuthGuard en endpoints privados inspeccionados

companyId derivado del usuario autenticado

ValidationPipe global

whitelist = true

forbidNonWhitelisted = true

transform = true

DTOs por operación

register/login sanitizados sin passwordHash

secure password recovery with one-time hashed tokens

authVersion-based invalidation after password change/reset

RolesGuard

@Roles en Healthcare Cases

tenant-scoped operations en módulos normalizados

UUID como identidad técnica

non-destructive lifecycle en varios master data

server-side ownership de campos sensibles en workflows normalizados
```

La eliminación de `passwordHash` de las respuestas de autenticación es una corrección ya implementada.

No debe mantenerse como deuda abierta.

---

## 5.2 Validado

Los módulos normalizados cuentan con cobertura relacionada con:

```text
DTO validation

business rules

tenant scoping

invalid relations

forbidden fields

lifecycle behavior
```

La evidencia cuantitativa vigente pertenece a:

```text
PROJECT_BOARD.md
```

y no debe duplicarse permanentemente en este documento.

---

## 5.3 P0 — Security Release Blockers

Password Security V1 está implementado. Antes de un piloto externo o una
exposición productiva deben resolverse o verificarse como mínimo:

```text
systematic tenant-isolation regression

authorization review of critical ERP endpoints

basic authentication endpoint abuse protection

production secrets/configuration review

real password-recovery email delivery/configuration
```

Estos puntos son blockers de seguridad para una exposición real.

---

## 5.4 P1 — Security Hardening

Después de los blockers P0 deben fortalecerse:

```text
session / token strategy

refresh / revocation

frontend authenticated-route hardening

business audit foundation

dependency security review

security observability

legacy tenant-safe write hardening
```

---

## 5.5 Future

Capacidades posteriores:

```text
permission-based RBAC

MFA

advanced anomaly detection

enterprise session controls

advanced security analytics

SIEM-class integrations
```

---

# 6. Principio de mínimo privilegio

Todo usuario, servicio o integración debe recibir únicamente los permisos necesarios para cumplir su función.

No deben otorgarse privilegios amplios por comodidad.

Ejemplo:

Un usuario que puede consultar Inventory no debería automáticamente poder:

```text
adjust stock

approve Purchases

manage Users

change roles

access Billing

access another Company
```

---

# 7. Autenticación

Toda operación privada debe exigir autenticación.

Actualmente Zaping utiliza JWT.

Flujo:

```text
Credentials
↓
Authentication
↓
JWT
↓
JwtAuthGuard
↓
Authenticated User
↓
Protected Operation
```

El sistema debe validar:

```text
credentials

token signature

token expiration

required claims

User identity

Company context
```

---

# 8. Usuario activo

## Estado actual

Existe una deuda de seguridad:

```text
User.isActive = false
→ login / JwtStrategy enforcement incompleto
```

Por tanto, el sistema todavía no debe afirmar que un usuario inactivo está completamente bloqueado.

---

## Requisito

Debe garantizarse:

```text
User.isActive = false
↓
authentication denied
```

y, cuando la estrategia de sesiones lo permita:

```text
existing access
↓
revoked / rejected
```

Un usuario deshabilitado no debe continuar utilizando normalmente la aplicación.

---

# 9. Contraseñas

Las contraseñas deben:

```text
be stored only as secure hashes

use an appropriate password hashing algorithm

never be stored as plaintext

never be written to logs

never be returned by API

never be sent back to frontend
```

Actualmente:

```text
bcrypt
```

es utilizado para `passwordHash`.

Los contratos de registro, creación interna y reset exigen una longitud mínima
de 8 caracteres, sin imponer requisitos artificiales de mayúsculas o símbolos.

La aplicación no debe exponer:

```text
password
passwordHash
```

ni equivalentes innecesarios.

---

# 10. Respuestas de autenticación

Los endpoints de autenticación deben devolver únicamente información necesaria.

Ejemplo conceptual:

```json
{
  "accessToken": "...",
  "user": {
    "id": "...",
    "companyId": "...",
    "name": "...",
    "email": "...",
    "role": "..."
  }
}
```

No debe devolverse automáticamente el objeto completo persistido de `User`.

La sanitización de `register` y `login` para evitar exposición de `passwordHash` ya fue implementada.

---

# 11. Recuperación de contraseña

## Estado actual

Existe un flujo seguro implementado para recuperar el control de la cuenta:

```text
POST /auth/forgot-password
→ generic response, no account enumeration

POST /auth/reset-password
→ token + newPassword only
```

El token es aleatorio de 256 bits, se persiste únicamente como hash SHA-256,
expira en 30 minutos y es de un solo uso. Los tokens pendientes anteriores se
invalidan al emitir uno nuevo y los demás se invalidan al completar el reset.
Las cuentas desconocidas o inactivas no reciben token y mantienen la misma
respuesta genérica.

La entrega se orquesta mediante `PasswordRecoveryService` y `EmailService` con
Resend. Si falla la entrega, la configuración o la construcción de la URL tras
emitir el token, se invalida el token recién creado. No se registran tokens,
reset URLs, contraseñas ni `passwordHash`.

Los casos inválido, expirado, usado o inactivo usan el mensaje genérico. Un
reset concurrente consume como máximo una vez mediante actualización
condicional y transacción.

La implementación está completa; la verificación de sender/domain, variables
válidas y flujo real forgot → email → reset → login sigue siendo un gate de
producción.

---

## Arquitectura objetivo

La recuperación segura deberá utilizar un mecanismo equivalente a:

```text
Recovery request
↓
temporary random token
↓
verified account control
↓
token validation
↓
password change
↓
token invalidation
```

Los tokens de recuperación deben:

```text
have expiration

be difficult to predict

be single-use when practical

not reveal unnecessary account-existence information

be invalidated after use

not be logged
```

No debe permitirse cambiar una contraseña únicamente con conocimiento del email u otro identificador público.

---

# 12. Tokens JWT

Los JWT deben:

```text
be signed

have expiration

use secrets from external configuration

be validated on protected requests

contain only necessary claims
```

Nunca deben:

```text
be hardcoded

be committed to repository

be logged completely

be shared between users

be treated as encrypted data
```

Principio:

```text
Signed JWT
≠
Encrypted JWT
```

El payload puede ser legible aunque la firma impida modificaciones válidas.

---

# 13. Sesiones y revocación

## Estado actual

El sistema utiliza access tokens JWT.

No existe todavía una arquitectura completa de:

```text
refresh tokens

session registry

remote logout

token revocation

device sessions
```

Sin embargo, password change y password reset incrementan `authVersion`; el
JWT lleva ese claim y `JwtStrategy` lo compara con la base de datos en cada
request protegida. Un JWT legado sin claim se interpreta como `0`. Al aumentar
el valor persistido, los JWT anteriores dejan de autorizar. Esto no equivale a
un session registry, refresh tokens o remote logout generales.

---

## Evolución requerida

La estrategia debe permitir responder a escenarios como:

```text
User disabled

password changed

credential compromise

remote logout

administrative revocation
```

Esto debe evaluarse antes de una madurez productiva mayor.

---

# 14. Seguridad del token en frontend

## Estado actual

El frontend conserva actualmente el JWT en:

```text
localStorage
```

Esto debe documentarse explícitamente.

Riesgo principal:

```text
successful XSS
→ possible token theft
```

`localStorage` no es por sí mismo una vulnerabilidad automática, pero aumenta la importancia de proteger el frontend contra ejecución de JavaScript no confiable.

---

## Evolución

Antes de producción debe revisarse formalmente la estrategia de sesión.

Si en el futuro se utilizan cookies de autenticación:

```text
HttpOnly
Secure
SameSite
```

deberán evaluarse conjuntamente con protección CSRF.

---

# 15. Secretos

Los secretos deben permanecer fuera del código fuente.

Ejemplos:

```text
JWT_SECRET

DATABASE_URL

API_KEYS

SMTP_PASSWORD

THIRD_PARTY_SECRETS
```

Usar:

```text
environment variables

secret manager
when production infrastructure exists

environment-specific configuration
```

Nunca deben versionarse secretos reales.

---

# 16. Autorización

Autenticación y autorización son controles diferentes.

```text
Authentication
→ Who are you?

Authorization
→ What are you allowed to do?
```

Estar autenticado no otorga acceso universal.

---

# 17. Backend como autoridad

Frontend puede ocultar acciones para mejorar UX.

Sin embargo:

> **El backend es la autoridad final.**

No confiar únicamente en:

```text
hidden buttons

disabled fields

frontend routes

navigation guards

client-side role checks
```

Todo endpoint sensible debe validar sus reglas en servidor.

---

# 18. Roles

Zaping utiliza RBAC como base.

Actualmente existen roles base utilizados por el sistema.

`RolesGuard` y `@Roles` se encuentran implementados, con uso explícito en Healthcare Cases.

Esto no significa que exista autorización granular homogénea en todo ERP Core.

---

# 19. Safe Role Provisioning

Existe un riesgo relevante relacionado con:

```text
User.role @default(ADMIN)
```

La persistencia no debe otorgar privilegios administrativos accidentalmente.

Requisito:

```text
User creation
↓
explicit authorized role assignment
```

No:

```text
missing role
↓
implicit ADMIN
```

La creación y administración de Users debe impedir privilege escalation.

Este punto es:

> **P0 antes de exposición real.**

---

# 20. Permission-Based Authorization

La arquitectura futura puede evolucionar hacia:

```text
User
↓
Role
↓
Permissions
```

Ejemplos:

```text
customers.read
customers.write

inventory.read
inventory.adjust

purchases.create
purchases.approve

receipts.create

sales.create
sales.approve

cases.view
cases.manage

equipment.inspect
equipment.retire

billing.view
```

Los permisos deben definirse progresivamente según necesidades reales.

No implementar una matriz excesivamente compleja antes de necesitarla.

---

# 21. Multi-tenancy

El aislamiento entre Companies es una propiedad de seguridad crítica.

Conceptualmente:

```text
Company A
≠
Company B
```

Un usuario nunca debe poder utilizar acceso autorizado a Company A para:

```text
read

modify

delete

relate

export

aggregate

infer
```

datos de Company B.

---

# 22. CompanyId confiable

La autoridad del tenant debe provenir del contexto autenticado.

```text
JWT
↓
Authenticated User
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

Un `companyId` enviado por cliente no debe sustituir el tenant autenticado.

---

# 23. Queries multi-tenant

Tenant isolation debe aplicarse a:

```text
find

findMany

create relations

update

lifecycle operations

delete where allowed

search

reports

exports

dashboards

deep-linked resources
```

No basta con proteger únicamente los listados.

---

# 24. Relaciones entre tenants

Antes de relacionar entidades debe comprobarse tenant ownership.

Ejemplo:

```text
Purchase from Company A

Supplier from Company B

→ DENY
```

También:

```text
EquipmentAsset Company A

HealthcareCase Company B

→ DENY
```

Conocer el UUID de una entidad no debe permitir utilizarla.

---

# 25. UUID no es autorización

Zaping utiliza UUID.

Esto dificulta algunas formas triviales de enumeración, pero:

> **UUID no sustituye autorización ni tenant isolation.**

Todo recurso debe verificar contexto y permisos independientemente de lo difícil que sea adivinar su identificador.

---

# 26. Testing multi-tenant

Los módulos críticos deben validar explícitamente:

```text
Company A
↓
read Company B resource
↓
DENY
```

y:

```text
Company A
↓
modify Company B resource
↓
DENY
```

También deben probarse cuando corresponda:

```text
cross-tenant relation injection

cross-tenant nested resource access

cross-tenant exports

cross-tenant lifecycle command
```

La regresión sistemática completa permanece como trabajo P0 del cierre de seguridad.

---

# 27. Validación de entrada

Toda entrada externa debe considerarse no confiable.

Validar:

```text
type

format

length

required values

enums

ranges

relationships

business constraints
```

DTO + `ValidationPipe` representan la primera capa.

Las reglas empresariales adicionales pertenecen al Service o dominio responsable.

---

# 28. Mass Assignment

El cliente no debe poder modificar campos internos únicamente enviándolos en el payload.

Ejemplos sensibles:

```text
companyId

role

permissions

createdById

approvedById

retiredById

status internal

passwordHash

assetCode when server-owned

folio when server-generated
```

Los DTOs deben permitir únicamente los campos válidos para la operación correspondiente.

---

# 29. Whitelisting

La API mantiene:

```text
whitelist = true

forbidNonWhitelisted = true

transform = true
```

Esto debe conservarse salvo decisión explícita.

Campos inesperados deben ser rechazados en operaciones sensibles.

---

# 30. Manejo de errores

Los errores deben ser útiles sin revelar detalles internos innecesarios.

No exponer:

```text
stack traces

raw SQL

full Prisma internals

filesystem paths

environment variables

secrets

tokens

data from another tenant
```

También debe evitarse que una diferencia innecesaria de mensajes permita enumerar recursos restringidos.

---

# 31. Logging seguro

Los logs deben apoyar troubleshooting sin convertirse en una fuente de exposición.

No registrar:

```text
passwords

full JWTs

recovery tokens

API secrets

database credentials

sensitive payloads without need
```

Preferir:

```text
requestId

resourceId

companyId when appropriate

safe actorId

operation name

safe error category
```

---

# 32. Auditoría de negocio

Debe distinguirse:

```text
Technical Logging
≠
Business Audit
```

---

## Estado actual

Algunos dominios ya preservan hechos específicos como:

```text
createdBy

receivedBy

inspectedBy

retiredBy

cancelledBy

timestamps
```

cuando el workflow lo requiere.

No existe todavía un audit trail transversal completo para toda la plataforma.

---

## Objetivo

Una capacidad futura de auditoría puede registrar:

```text
actor

companyId

action

resource

timestamp

result

safe metadata
```

Especialmente para:

```text
user administration

role changes

inventory adjustments

receipts

deliveries

returns

Equipment lifecycle

Healthcare custody

billing
```

---

# 33. Inventario

Inventory es un dominio de alta sensibilidad.

No debe permitirse:

```text
arbitrary direct stock editing

untraceable stock changes

silent deletion of InventoryMovement

rewriting confirmed history
```

`Product.stock` debe cambiar mediante operaciones controladas.

Ejemplos actuales:

```text
Purchase Receipt
→ Inventory IN

Sale approval
→ Inventory OUT
```

---

# 34. Integridad histórica

Cuando una operación ya representa un hecho histórico confirmado, las correcciones deben preservar trazabilidad.

Preferir:

```text
Original operation
+
corrective / compensating operation
```

cuando corresponda.

No:

```text
silent rewrite of history
```

Esto es especialmente importante para:

```text
Inventory

Receipts

Deliveries future

Returns

Billing
```

---

# 35. Operaciones financieras

Operaciones relacionadas con:

```text
price

discount

sales

invoice

payment

tax

credit
```

deben utilizar autorización adecuada.

Los cambios posteriores a una operación confirmada deben preservar historia cuando el dominio lo requiera.

---

# 36. Idempotencia y seguridad operacional

La idempotencia también protege integridad frente a:

```text
double-click

retry

network timeout

response loss
```

## Implementado

Purchase Receipt create utiliza:

```text
Idempotency-Key

tenant-scoped identity

request hash

replay

conflict detection

transactional protection
```

---

## Pendiente

```text
Sale create
→ idempotency pending

Healthcare Case create
→ idempotency pending
```

---

## Futuro

Evaluar idempotencia para:

```text
Delivery

Dispatch

Return

Reconciliation

financial operations
```

---

# 37. Zaping Healthcare — Security Boundary

Healthcare introduce información operacional potencialmente más sensible.

Debe minimizarse su alcance.

---

## Current

Healthcare Case Foundation almacena información operacional de:

```text
Case

schedule

responsible User

procedure description

lifecycle

creation/cancellation audit facts
```

No almacena actualmente:

```text
patient name

patient identifier

diagnosis

medical history

clinical notes

clinical records
```

---

## Target

Healthcare podrá incorporar cuando sea necesario:

```text
Hospital

Doctor

Requirements

Equipment Assignment

Custody

CaseKit

Return

Payer / Insurance

commercial references
```

Estos conceptos deben implementarse con minimización de datos y autorización apropiada.

---

# 38. No convertirse en expediente clínico

Zaping Healthcare no debe convertirse por defecto en:

```text
Electronic Medical Record
```

No incorporar automáticamente:

```text
diagnosis

complete medical records

studies

treatment plans

clinical notes

medical history
```

Si una capacidad futura necesita información clínica, deberá realizarse una evaluación específica de:

```text
business necessity

privacy

regulation

authorization

encryption

retention

audit

incident impact
```

antes de implementarla.

---

# 39. Minimización de datos

Guardar únicamente datos necesarios para cumplir la función empresarial.

Antes de agregar un campo sensible preguntar:

```text
1. ¿Es realmente necesario?

2. ¿Quién necesita verlo?

3. ¿Qué operación depende de él?

4. ¿Durante cuánto tiempo debe conservarse?

5. ¿Qué impacto tendría una filtración?

6. ¿Existe una alternativa menos sensible?
```

---

# 40. Datos personales

La información personal debe limitarse a lo necesario.

Ejemplos:

```text
names

emails

phones

business contacts

responsible users
```

El acceso debe corresponder con la función del usuario.

---

# 41. Payers / Insurance

La información futura sobre:

```text
Insurance

authorization

payment reference

payer

coverage
```

puede tener sensibilidad adicional.

Debe definirse qué roles necesitan verla antes de exponerla ampliamente.

---

# 42. Segregación de responsabilidades

Algunas operaciones pueden requerir separación de funciones.

Ejemplo futuro:

```text
User A
→ creates Purchase

User B
→ approves Purchase
```

o:

```text
Warehouse
→ dispatches material

Administration
→ invoices
```

No debe imponerse separación artificial en cada workflow.

Debe utilizarse cuando exista riesgo financiero, operacional o regulatorio suficiente.

---

# 43. Lifecycle y acciones destructivas

No existe una estrategia universal de Soft Delete.

Debe utilizarse el lifecycle apropiado según el tipo de entidad.

```text
Master Data
→ deactivate

Transactional Document
→ cancel / explicit state transition

Historical Event
→ preserve / compensate

Temporary Data
→ delete / expire when appropriate
```

Ejemplos:

```text
Customer
Supplier
Product
→ deactivation

EquipmentAsset
→ retirement

Sale DRAFT
→ cancellation

InventoryMovement
→ preserve history
```

Una entidad con historia relevante no debe eliminarse físicamente sin evaluar impacto.

---

# 44. Confirmaciones de acciones críticas

Frontend debe solicitar confirmación cuando exista riesgo operacional significativo.

Preferir:

```text
Confirmar recepción.

Esta operación aumentará inventario.
```

sobre:

```text
¿Estás seguro?
```

La confirmación del frontend no sustituye autorización ni validación backend.

---

# 45. Base de datos

PostgreSQL debe utilizar credenciales protegidas.

La base de datos no debe exponerse públicamente sin necesidad.

En producción deberán utilizarse controles apropiados de:

```text
network access

credentials

TLS when applicable

backups

least privilege

monitoring
```

---

# 46. Prisma y SQL

Prisma utiliza consultas parametrizadas para sus operaciones habituales.

SQL manual debe utilizarse únicamente cuando exista una necesidad concreta.

Debe revisarse:

```text
SQL injection

tenant isolation

permissions

performance

transaction semantics

migration compatibility
```

---

# 47. Migraciones

Las migraciones deben preservar integridad.

Antes de una migración crítica:

```text
evaluate impact

inspect affected data

review generated SQL

prepare backup when appropriate

validate rollback/recovery strategy

avoid unnecessary destructive operations
```

Nunca utilizar un reset de datos productivos como solución rutinaria.

---

# 48. Backups

Antes de producción debe existir una estrategia de backup.

Debe definir:

```text
frequency

retention

storage

access protection

restoration process

recovery testing
```

Principio:

> **Un backup no probado mediante restauración no debe considerarse una estrategia de recuperación validada.**

---

# 49. HTTPS y transporte

Todo tráfico productivo debe utilizar HTTPS.

No deben transmitirse:

```text
credentials

tokens

recovery secrets

sensitive application data
```

sobre conexiones inseguras.

---

# 50. CORS

CORS debe configurarse según los orígenes necesarios para cada ambiente.

Producción no debe utilizar configuración excesivamente abierta sin una justificación documentada.

---

# 51. Rate Limiting y endpoints públicos

Endpoints públicos requieren protección proporcional a su exposición.

Especial atención:

```text
login

register when public

password recovery

future Public API

expensive searches

external integrations
```

Antes de exposición productiva debe existir protección básica contra abuso de autenticación.

Esto puede incluir:

```text
rate limiting

temporary throttling

monitoring

abuse detection
```

No es necesario comenzar con infraestructura compleja.

---

# 52. Brute Force y Credential Stuffing

La plataforma debe reducir riesgo de:

```text
brute force

credential stuffing

password recovery abuse
```

Mecanismos posibles:

```text
rate limiting

progressive throttling

temporary lockout

security alerts

MFA

anomaly detection
```

La implementación debe ser proporcional al riesgo y madurez del sistema.

---

# 53. MFA

MFA no es requisito inmediato del ERP Core V1.

Debe considerarse posteriormente para:

```text
Administrators

enterprise customers

high-privilege accounts

high-risk operations
```

---

# 54. Dependencias

Antes de incorporar una librería evaluar:

```text
necessity

maintenance

reputation

known vulnerabilities

license

size

alternatives
```

No agregar dependencias para resolver problemas triviales que puedan manejarse de forma segura con capacidades existentes.

---

# 55. Vulnerabilidades de dependencias

Debe existir revisión periódica de dependencias.

Herramientas del ecosistema pueden incluir:

```bash
npm audit
```

Los hallazgos deben evaluarse considerando:

```text
severity

exploitability

application context

direct vs transitive dependency

available remediation

compatibility impact
```

No ejecutar automáticamente:

```text
major upgrades

forced audit fixes
```

sin revisar impacto.

Snapshot actual de `npm audit --audit-level=high`:

```text
5 vulnerabilities: 4 high, 1 moderate

deepmerge-ts < 8.0.0
→ high severity
→ transitive through @prisma/config / Prisma tooling

fast-uri
→ high severity

qs
→ moderate severity
```

El arreglo forzado propone instalar `prisma@6.12.0` con cambio rompedor. No se
ejecuta `npm audit fix --force`; el hallazgo queda clasificado como
dependency/security maintenance before RC. No se afirma exploitability ni
impacto runtime sin análisis separado.

---

# 56. Archivos y documentos

Cuando Zaping permita uploads deberán evaluarse:

```text
maximum size

allowed MIME types

content verification

safe file names

authorization

tenant ownership

storage isolation

malware scanning when risk justifies it

download authorization
```

No confiar únicamente en extensión o nombre enviado por cliente.

---

# 57. Integraciones externas

Toda integración es un trust boundary.

Debe evaluarse:

```text
authentication

authorization

credentials

tenant context

data sent

data received

input validation

retry behavior

logging

timeouts

availability

failure handling
```

Una integración no debe poder operar fuera del tenant autorizado.

---

# 58. Public API

Una futura Public API deberá incorporar:

```text
dedicated authentication

scopes

rate limits

versioning

revocation

audit

documentation

compatibility policy
```

Una API key no debe representar permiso ilimitado por defecto.

---

# 59. Separación por ambientes

Deben distinguirse:

```text
development

test

staging

production
```

No reutilizar indiscriminadamente:

```text
production database

production credentials

production secrets

production tokens
```

en ambientes de desarrollo.

---

# 60. Datos de prueba

Preferir:

```text
fictional data

sanitized data

purpose-built QA fixtures
```

en ambientes no productivos.

No copiar datos sensibles reales únicamente por conveniencia.

---

# 61. Seguridad frontend

Frontend no debe almacenar secretos de servidor.

Toda variable expuesta al navegador debe considerarse públicamente visible.

Evitar:

```text
private API secrets

database credentials

JWT secrets

internal service credentials
```

en bundles frontend.

También deben evitarse logs innecesarios de tokens o información sensible.

---

# 62. XSS

Todo contenido externo debe tratarse como dato.

Evitar renderizar HTML arbitrario.

No utilizar:

```text
dangerouslySetInnerHTML
```

sin una necesidad explícita y sanitización adecuada.

Dado que el JWT actual vive en `localStorage`, la prevención de XSS es especialmente relevante para la seguridad de sesión.

---

# 63. CSRF

Con el almacenamiento actual de JWT, CSRF no presenta exactamente el mismo modelo de riesgo que una autenticación automática basada en cookies.

Si en el futuro se utilizan cookies para autenticación, deberán evaluarse conjuntamente:

```text
HttpOnly

Secure

SameSite

CSRF token or equivalent controls
```

La estrategia de sesión y la estrategia CSRF deben diseñarse como un conjunto.

---

# 64. Redirects y URLs externas

No confiar en URLs proporcionadas por usuario sin validación.

Deben evitarse:

```text
open redirects

unsafe schemes

unvalidated external destinations
```

cuando representen un riesgo.

---

# 65. Exportaciones

Las exportaciones deben respetar:

```text
tenant

authorization

filters

data sensitivity
```

Un usuario no debe poder exportar información que normalmente no puede consultar.

---

# 66. Reportes y Dashboard

Reports y Dashboard deben aplicar las mismas reglas de acceso que los datos operacionales.

```text
aggregation
≠
permission bypass
```

Un indicador agregado puede seguir siendo información sensible.

---

# 67. Cuentas administrativas

Las cuentas administrativas requieren protección especial.

Evitar:

```text
shared accounts

generic admin users

common passwords

unnecessary ADMIN privileges
```

Cada persona debe utilizar su propia identidad.

---

# 68. Infraestructura productiva

Antes de producción deben evaluarse como mínimo:

```text
network exposure

firewall

database access

TLS

secret storage

backup

monitoring

logging

patching

administrative access

deployment permissions
```

La topología concreta deberá documentarse al formalizar producción.

---

# 69. Observabilidad de seguridad

La plataforma debe poder detectar progresivamente:

```text
repeated login failures

authorization failures

administrative operations

unexpected tenant access attempts

critical lifecycle operations

configuration changes

security-related errors
```

No es necesario construir un SIEM para el MVP.

Sí debe existir suficiente información para investigar incidentes.

---

# 70. Gestión de incidentes

Ante sospecha de incidente:

```text
Detect
↓
Contain
↓
Investigate
↓
Correct
↓
Recover
↓
Document
↓
Prevent recurrence
```

Acciones pueden incluir:

```text
revoke access

disable users

rotate secrets

isolate services

restore data

inspect logs

apply patches
```

---

# 71. Gestión de vulnerabilidades

Una vulnerabilidad no debe ocultarse.

Debe registrarse y priorizarse.

Clasificación orientativa:

```text
Critical

High

Medium

Low
```

Critical y High requieren atención prioritaria.

El nivel debe considerar no solo severidad teórica sino también:

```text
exposure

exploitability

data affected

tenant impact

business impact
```

---

# 72. Testing de seguridad

Áreas críticas deben incluir pruebas específicas cuando corresponda.

Ejemplos:

```text
missing token

invalid token

expired token

inactive User

unauthorized role

cross-tenant resource

UUID manipulation

forbidden DTO field

invalid relationship

sensitive response fields

public endpoint abuse protections
```

---

# 73. Revisión de seguridad antes de release

Una release relevante debe revisar:

```text
authentication

authorization

tenant isolation

public endpoints

secrets

migration impact

dependencies

sensitive data exposure

error handling

session behavior
```

La profundidad depende del riesgo.

No todas las releases requieren un pentest formal.

Una release candidata a producción sí requiere una evaluación sustancialmente más profunda que una entrega local.

---

# 74. Seguridad en Definition of Done

Una funcionalidad no se considera terminada si introduce una vulnerabilidad crítica conocida dentro de su alcance.

Cuando corresponda, Definition of Done debe incluir:

```text
authentication

authorization

tenant isolation

DTO validation

mass-assignment protection

sensitive data review

logging review

audit facts

security tests
```

---

# 75. Deuda de seguridad

La deuda debe documentarse explícitamente.

Debe conocerse:

```text
risk

impact

priority

mitigation

desired resolution
```

No debe mantenerse únicamente en:

```text
comments

chat conversations

tribal knowledge
```

La fuente operativa es:

```text
PROJECT_BOARD.md
```

---

# 76. Prioridades actuales de seguridad

## P0 — Release Blockers

```text
1. Systematic tenant-isolation regression

2. Authorization review for critical ERP operations

3. Basic rate limiting / abuse protection for authentication endpoints

4. Production secret and configuration review

5. Real password-recovery email delivery/configuration verification
```

---

## P1 — Hardening

```text
session / token strategy

refresh / revocation

frontend protected-route hardening

business audit foundation

dependency security review

legacy tenant-safe writes

security observability

CORS / environment-specific hardening
```

---

## Future

```text
permission-based RBAC

MFA

advanced anomaly detection

enterprise session controls

SIEM integrations

advanced security analytics
```

---

# 77. Seguridad antes de producción

Antes del primer entorno productivo deben revisarse como mínimo:

```text
JWT configuration

session/token strategy

tenant isolation

authorization

public endpoint protection

rate limiting

CORS

HTTPS

database exposure

database credentials

secrets

backups

restore procedure

logs

dependency vulnerabilities

error handling

data sensitivity

Healthcare boundary

production configuration

verified recovery sender/domain and real email E2E

monitoring

incident response
```

No debe asumirse que una aplicación funcional está lista para producción únicamente porque:

```text
tests pass
```

---

# 78. Principios que no deben romperse

## Authentication

```text
Protected operation
→ authenticated identity
```

---

## Authorization

```text
Authenticated
≠
Authorized
```

---

## Tenant

```text
Company A
≠
Company B data access
```

---

## UUID

```text
UUID
≠
Authorization
```

---

## Passwords

```text
Password
→ never plaintext at rest
```

---

## Secrets

```text
Secret
→ never committed
```

---

## Input

```text
Client input
→ untrusted
```

---

## Historical Operations

```text
Confirmed history
→ no silent rewrite
```

---

## Healthcare

```text
Operational Healthcare
≠
Clinical record by default
```

---

## Failure Mode

```text
Uncertain authorization
→ DENY
```

---

# 79. Documentación relacionada

## Architecture

```text
docs/architecture/ARCHITECTURE.md
```

## Engineering

```text
docs/engineering/ENGINEERING_GUIDE.md

docs/engineering/DEVELOPMENT_WORKFLOW.md

docs/engineering/QUALITY_STANDARDS.md

docs/engineering/API_GUIDELINES.md
```

## Project

```text
docs/project/PROJECT_BOARD.md

docs/project/ROADMAP.md

docs/project/CHANGELOG.md
```

## Modules

```text
docs/modules/erp/

docs/modules/healthcare/
```

---

# 80. Principio final

La seguridad de Zaping depende de múltiples controles.

```text
User
↓
Authentication
↓
Authorization
↓
Tenant Isolation
↓
Validation
↓
Business Rules
↓
Persistence
↓
Audit / Observability
```

Ninguna capa individual es suficiente.

La prioridad es que:

```text
identity is trustworthy

permissions are explicit

tenant boundaries are enforced

inputs are untrusted

sensitive information is minimized

critical operations preserve integrity

security failures deny access safely
```
