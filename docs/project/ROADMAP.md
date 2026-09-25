Producto: Zaping Platform
Versión del documento: 1.3.0
Estado: Activo
Última actualización: 2026-09-25
Responsable: Zaping Team

1. Propósito
Este documento define la dirección futura de Zaping.

Debe responder:

¿Qué capacidades necesitamos después?

¿Por qué son importantes?

¿Qué depende de qué?

¿Qué pertenece al ERP Core?

¿Qué pertenece a Healthcare?

¿Qué debe esperar?

¿Qué líneas de producto vienen después?
El Roadmap representa intención estratégica, prioridad y dependencias.

No representa:

el estado diario de tareas;

el historial de desarrollo;

compromisos contractuales;

fechas garantizadas;

una lista exhaustiva de tickets;

snapshots de cada implementación.

2. Responsabilidades documentales
ROADMAP.md

→ dirección futura

→ prioridades estratégicas

→ dependencias

→ evolución del producto
PROJECT_BOARD.md

→ ejecución actual

→ estado vigente

→ blockers

→ deuda activa

→ siguiente trabajo
CHANGELOG.md

→ historia completada

→ entregas cerradas

→ snapshots históricos
Cuando una iniciativa pase a ejecución:

ROADMAP
↓
PROJECT_BOARD
Cuando quede completada:

PROJECT_BOARD
↓
CHANGELOG
3. Secuencia estratégica vigente
La normalización funcional H7 del ERP Core está completada.

La posición actual es:

ERP Core V1 — CLOSED / ACCEPTED on canonical baseline `a4434a6`
↓
M-HC1 — Healthcare Operations Foundation — ACTIVE — P1
↓
HC-NEXT-01 — Hospital / Doctor — CLOSED / ACCEPTED on current main baseline `fbf29b6`
↓
Requirements V1 — COMPLETE / ACCEPTED
↓
HC-NEXT-03A — Healthcare Equipment Assignment Domain Discovery — COMPLETE / DOCUMENTED
↓
HC-NEXT-03B Equipment Assignment Technical Design — COMPLETE / APPROVED
↓
HC-NEXT-03C1 Equipment Assignment Persistence / Migration — COMPLETE / MERGED
↓
HC-NEXT-03C2 Assignment Backend Base — COMPLETE / MERGED
↓
HC-NEXT-03C3 Availability / Conflict Review / Concurrency — COMPLETE / MERGED
↓
HC-NEXT-03C4 Replace / Release / Parent Integrations — COMPLETE / MERGED — MANUAL RELEASE, REPLACE, REQUIREMENT RETIRE C4-C1 AND CASE CANCEL C4-C2 IN MAIN — HC-LOCK-04 FINAL CLOSED / ACCEPTED IN main@be73bc4
↓
HC-NEXT-03C5-A Contract Alignment & Safe PostgreSQL Harness — COMPLETE / MERGED — PR #36 + #37 — main@5ec9f67
↓
HC-NEXT-03C6-A Case Equipment Assignments Read-only View — COMPLETE / MERGED — PR #38 — main@8a67d5a — Actual 25-sep-2026
↓
HC-NEXT-03C6-B Create Assignment UI — COMPLETE / MERGED — PR #40 — main@4805128 — Actual 25-sep-2026
↓
HC-NEXT-03C6-C Release Assignment UI — COMPLETE / MERGED — PR #42 — main@9bade4d — Actual 25-sep-2026
↓
HC-NEXT-03C6-D Replace Assignment UI — NEXT FUNCTIONAL CANDIDATE / NOT READY
↓
HC-NEXT-03C5-B Integrated Backend Validation — PLANNED — B0 NOT READY; B1–B3 NOT IMPLEMENTED
↓
HC-NEXT-03C5-COVERAGE CoverageNote / Aggregated Coverage Backend — CONTRACT PENDING / REQUIRED BEFORE C6 SLICES THAT DEPEND ON COVERAGE

DEFERRED — OPS-RC-B5C real staging acceptance
→ READY WHEN NEEDED; no staging deployment is claimed

PR #3 is merged at `a4434a6`. DEV-NEXT-03B terminó en PASS con la matriz manual
ADMIN / MANAGER / SALES / WAREHOUSE y QA-001 a QA-008 CLOSED / PASS. Esto
representa aceptación local del ERP Core V1, no staging ni producción.

Healthcare Case Foundation y EquipmentAsset / Equipment V1 ya están
IMPLEMENTED / VALIDATED.

HC-NEXT-01C1-C8 están completos; C8 está CLOSED / MERGED / ACCEPTED. La
acceptance automatizada y la QA manual de ADMIN, MANAGER, SALES y WAREHOUSE
están PASS. PR #14 está merged.

Requirements V1 está COMPLETE / ACCEPTED y HC-NEXT-03A Equipment Assignment
Domain Discovery está COMPLETE / DOCUMENTED. El siguiente item de M-HC1 es:

HC-NEXT-03B — COMPLETE / APPROVED; HC-NEXT-03B.1 Persistence & Availability
Design, HC-NEXT-03B.2 API / DTO / Authorization Contract y HC-NEXT-03B.3
Implementation Slicing / Acceptance Contract APPROVED / DOCUMENTED;
HC-NEXT-03C1 Equipment Assignment Persistence / Migration COMPLETE / MERGED;
HC-NEXT-03C2 Assignment Backend Base COMPLETE / MERGED;
HC-NEXT-03C3 Availability / Conflict Review / Concurrency COMPLETE / MERGED;
HC-NEXT-03C4 Replace / Release / Parent Integrations está COMPLETE / MERGED:
Manual Release, Replace, Requirement Retire C4-C1 y Case Cancel C4-C2 están en
`main`; HC-LOCK-04 final está CLOSED / ACCEPTED en `main@be73bc4`.
DEC-C5-02 divide HC-NEXT-03C5: C5-A queda COMPLETE / MERGED mediante PR #36 y #37
en `main@5ec9f67`; C5-B queda PLANNED con B0 NOT READY y B1–B3 NOT IMPLEMENTED.
C5-A ejecutó PostgreSQL real
27/27 PASS, 0 skipped, exit 0, con preflight y teardown sin errores reportados;
el harness está contenido en `85b480d` y `02d7a6e`. La identidad dedicada y los
permisos mínimos quedaron verificados. La excepción aprobada conserva
`CONNECT`/`TEMPORARY` y `USAGE` heredados de `PUBLIC`, sin cambiar ACL compartidas.
La exclusividad se comprobó al inicio, no durante toda la ejecución; no se declara
la base globalmente vacía.
DEC-C5-01 separa CoverageNote y cobertura agregada en HC-NEXT-03C5-COVERAGE,
ticket backend independiente con contrato pendiente y requerido antes de slices
posteriores de C6 que dependan de coverage; no bloquea C6-A/C6-B.

DEC-C5B-01 diseña el rol dedicado `zaping_hc_c5b`, sin autorizar su creación ni
cambios ACL. DEC-C5B-02 acepta evidencia compuesta del error sanitizado: mapping
unitario, fallo PostgreSQL/HTTP real 2H con auth guard de test y una comprobación
HTTP C5-B representativa con JWT real; no demuestra PG+JWT real en la misma
petición. DEC-C5B-03 actualiza directamente el fixture Case y acredita por
List/Detail HTTP el recálculo, no Case Update API.

Sprint 1: 24-sep–07-oct-2026; capacidad bruta 20 h/semana, sin equivalencia a
velocidad o Commitment; C5-A quedó completado el 24-sep y C6-A/C6-B/C6-C el
25-sep, mediante PR #38 en `main@8a67d5a`, PR #40 en `main@4805128` y PR #42 en
`main@9bade4d`. El Forecast del trabajo restante sigue pendiente. C6-D se registra
sólo como siguiente candidato funcional y permanece NOT READY; C5-B conserva
B0/B1/B2/B3 por 3/5/5/3 SP, con B0 NOT READY.

También permanecen como TARGET Healthcare:

Equipment Assignment

Case Availability

Dispatch / Custody

Return

CaseKit / Maletín

Calendar

Case 360

Mobile Technician
Healthcare es el siguiente workstream estratégico seleccionado. Hospital /
Doctor inicia como diseño de dominio; el resto de la secuencia conserva sus
dependencias y no pertenece necesariamente al mismo slice.

4. Visión de evolución
La dirección general es:

Zaping Platform
│
├── ERP Core
│   └── base empresarial reutilizable
│
├── Zaping Healthcare
│   └── vertical especializada inicial
│
├── Zaping Radar
│   └── inteligencia de oportunidades externas
│
└── Zaping AI
    └── capa futura de inteligencia
El desarrollo debe preservar esta jerarquía.

Healthcare debe construirse sobre ERP Core.

Radar debe mantener una identidad propia dentro del ecosistema.

AI debe construirse sobre dominios y datos confiables.

5. Principio de prioridad
La prioridad no es construir la mayor cantidad posible de módulos.

La prioridad es construir:

un ERP confiable, comercializable y claramente diferenciado.

Orden estratégico:

Stability
↓
Security / Release Readiness
↓
Healthcare Differentiation
↓
ERP Expansion
↓
External Intelligence
↓
AI
6. Regla de enfoque
Mientras el ERP Core tenga riesgos importantes de:

seguridad;

consistencia;

aislamiento tenant;

UX operativa;

migración de datos;

confiabilidad;

ventas/inventario;

release readiness;

no debe desplazarse esfuerzo significativo hacia funcionalidades experimentales.

Durante la fase actual de cierre del ERP Core, una distribución orientativa puede ser:

≈ 80 %

ERP stability

release readiness

QA

security

documentation
≈ 15 %

UX

Healthcare design readiness

product preparation
≈ 5 %

Radar research / definition
≈ 0 %

AI product implementation
Esta distribución no es contractual.

Después del cierre del ERP Core V1:

Healthcare Operations Foundation
→ siguiente milestone estratégico seleccionado — P1

Advanced Inventory
→ diseño objetivo aprobado, no implementado — P2
7. Etapa 0 — Documentation & Architecture Baseline
Estado: CURRENT — post-acceptance synchronization

Objetivo:

establecer una fuente documental coherente antes de ampliar nuevamente el producto.

Incluye:

Product

Architecture

ADR

Engineering

Security

UX

ERP Modules

Healthcare Modules

Project Planning

Templates
Resultado esperado:

Documentación vigente

+

sin duplicados críticos

+

sin arquitectura legacy presentada como actual

+

fuentes de verdad claras

+

CURRENT / TARGET / FUTURE diferenciados

+

deuda separada de implementación
Salida de esta etapa:

docs/README saneado

PROJECT_BOARD consolidado

ROADMAP consolidado

CHANGELOG consolidado

módulos sincronizados

arquitectura revisada

seguridad revisada

referencias internas verificadas
Cierre H8A requiere además:

final cross-document synchronization

security blocker synchronization

Markdown consistency

git status review

git diff --check

credential / .env backup review
8. Etapa 1 — ERP Core Release Readiness
Prioridad: P0

Estado local: CLOSED / ACCEPTED; los gates operativos pre-piloto permanecen.

Objetivo:

La baseline local ya es segura, consistente y verificable. Antes de comenzar
pilotos reales permanecen las validaciones operativas indicadas en esta etapa.

La secuencia cerrada para la baseline local comprendió:

H8A
↓
H8B
↓
UX-B.6
↓
ERP Core V1 Closure
8.1 Security Hardening
Estado de los checkpoints de seguridad:

Secure password recovery — ✅ CLOSED / VERIFIED

↓

Explicit user role safety — ✅ CLOSED / VERIFIED

↓

Inactive-user enforcement — ✅ CLOSED / VERIFIED

↓

Tenant isolation regression — ✅ CLOSED / VALIDATED in B2D

↓

Critical authorization review — ✅ CLOSED / VALIDATED in B2D

↓

Protected-route / session hardening — ✅ IMPLEMENTED / VALIDATED in B3B4

↓

Authentication abuse protection / rate limiting — ✅ IMPLEMENTED / VALIDATED in B3B1

↓

Production secrets / configuration review — ✅ IMPLEMENTED / VALIDATED in B3B2

↓

Real password-recovery email/configuration — ⏳ OPERATIONAL VALIDATION PENDING

↓

Dependency hardening — integrado en B3B3A; `deepmerge-ts` remediado en
OPS-RC-B5B.10B1 (`bac9ab5`). El mantenimiento periódico continúa.
La sanitización histórica de passwordHash ya fue resuelta y no forma parte del trabajo futuro.

8.2 Secure Password Recovery — CLOSED / CURRENT
El flujo CURRENT de password recovery demuestra control de la cuenta mediante
un token seguro, de un solo uso y con expiración corta antes de permitir el
restablecimiento.

La implementación vigente cubre:

recovery request

↓

secure random token

↓

single use

↓

short expiration

↓

account-control proof

↓

password reset

↓

token invalidation

authVersion increment and JWT invalidation

generic anti-enumeration response

delivery-failure token invalidation

La implementación está completa. Fuera de este workstream permanece la
verificación operativa de email real y la aceptación de staging cuando
OPS-RC-B5C sea reactivado.
Regla de seguridad:

public password reset
without secure recovery proof
→ P0 blocker
8.3 Safe User Provisioning
Estado: CLOSED / CURRENT

El riesgo histórico:

User.role @default(ADMIN)

fue retirado. El primer administrador de Company y los usuarios internos
requieren rol explícito según su flujo autorizado.

La revisión transversal de autorización quedó cerrada y validada en B2D.

Objetivo:

normal user creation
→ explicit authorized role
Debe evitarse cualquier elevación accidental de privilegios.

Cobertura validada:

user creation flows

role assignment

authorization

privilege escalation regression
8.4 Inactive User Enforcement
Estado: CLOSED / CURRENT

Debe mantenerse:

User.isActive = false
↓
no normal application access
La desactivación debe afectar autenticación y sesión de manera consistente.

8.5 Tenant Isolation — CLOSED / VALIDATED
B2D validó cobertura sistemática:

Company A
↛
Company B resources
Para operaciones críticas de:

Customers

Suppliers

Products

Purchases

Purchase Receipts

Inventory

Equipment

Quotes

Sales

Healthcare Cases

future resources
La cobertura incluyó:

read

create

update

lifecycle actions

exports where applicable

cross-module navigation
8.6 Critical Authorization Review — CLOSED / VALIDATED
B2D verificó:

sensitive endpoints

RolesGuard / authorization coverage

server-side authorization

business-action authorization

no frontend-only access assumptions

La matriz CURRENT utiliza sólo `ADMIN`, `MANAGER`, `SALES` y `WAREHOUSE`.
Permission-based RBAC permanece diferido P1.

8.7 Protected Route / Session Architecture — CLOSED / VALIDATED
CURRENT frontend utiliza:

authenticated route group

AppShell

JWT client-side storage

API interceptor / 401 handling
La implementación B3B4 validó:

session bootstrap

protected deep-link refresh

unauthenticated access behavior

logout consistency

protected-page flash prevention

401 redirect and network/5xx session preservation
La estrategia CURRENT de JWT en localStorage no debe tratarse como irreversible para producción.

8.8 Authentication Abuse Protection — CLOSED / VALIDATED
Los endpoints sensibles quedaron protegidos especialmente:

/auth/login

/auth/register

POST /auth/forgot-password

POST /auth/reset-password
mediante controles apropiados como:

rate limiting

retry controls where appropriate

monitoring

safe error semantics
La configuración y las ventanas de rate limiting fueron validadas en B3B1. La
verificación operativa de observabilidad queda pendiente para staging.

8.9 Production Secrets / Configuration — IMPLEMENTED / VALIDATED
La implementación exige `NODE_ENV` explícito, valida la presencia de variables
requeridas y la longitud mínima de `JWT_SECRET`, y exige URLs frontend HTTPS
en producción. CORS utiliza el origin configurado por entorno.

Pendiente de aceptación operativa:

gestión de secretos, configuración real de la base de datos y revisión de
credenciales versionadas en cada release

sender/domain verificado y credenciales Resend válidas ante el proveedor

real forgot → email → reset → login E2E

configuración final del host de staging/producción, incluido debug/dev settings

La validación de variables no verifica el sender/domain ni la entrega real.
8.10 Core Regression
B2D completó la regresión automatizada de autorización y tenant isolation.

La implementación B3 y el gate técnico pre-merge OPS-RC-B5B quedaron
integrados. DEV-NEXT-03B completó después la matriz manual de roles y la
aceptación local ERP Core V1. Email real y staging permanecen como validaciones
operativas separadas.

La validación B2D incluyó:

Backend tests

Frontend tests

Backend lint

Frontend lint

Backend build

Frontend build

Prisma validate

Prisma migrate status

Git health
Si la ejecución paralela de frontend tests falla por agotamiento de workers/recursos:

infrastructure/resource failure
≠
application test failure
y la suite completa puede ejecutarse de forma serial para obtener un resultado confiable.

8.11 Operational Reliability
DEV-NEXT-03B validó localmente los workflows V1 principales:

Supplier
↓
Purchase
↓
Purchase Receipt
↓
Inventory IN
Customer
↓
Quote
↓
Sale
↓
Inventory OUT
Purchase Receipt ASSET
↓
Equipment
↓
Inspection
↓
Current Availability
También:

folios

statuses

deep-links

PDFs

lifecycle

traceability

tenant isolation

authorization

idempotency replay/conflict where implemented

historical deactivation behavior
8.12 ERP Core V1 Closure
Estado: CLOSED / ACCEPTED — local V1 baseline

DEV-NEXT-03B terminó en PASS. La matriz manual de roles cerró ADMIN, MANAGER,
SALES y WAREHOUSE en PASS; QA-001 a QA-008 quedaron CLOSED / PASS. La evidencia
automatizada final registró 65 suites / 705 tests API y 57 files / 696 tests
Web con un worker, además de lint, typecheck, production builds, 22/22 rutas y
Git diff checks en PASS.

La salida de esta etapa significa:

ERP Core
→ functionally closed for V1

→ documented

→ regression validated

→ end-to-end QA validated

→ security P0 resolved or formally closed

→ known debt explicitly recorded
El cierre local no acredita entrega real por Resend, aceptación de staging ni
despliegue de producción. Esos gates pre-piloto/pre-producción permanecen
separados.
No significa que el ERP esté terminado para siempre.

Significa que la base V1 es suficientemente estable para dejar de abrir nuevas funcionalidades Core de manera indiscriminada.

9. Etapa 2 — M-HC1 — Healthcare Operations Foundation
Prioridad: P1 estratégica — ACTIVE

Objetivo:

convertir la especialización Healthcare en el principal diferenciador inicial de Zaping frente a ERP genéricos.

Healthcare se construye:

sobre ERP Core
no:

dentro de cada tabla del ERP Core
Debe evitarse contaminar el modelo genérico con conceptos específicos del vertical.

9.1 Estado de partida
Healthcare Case Foundation ya está:

IMPLEMENTED / VALIDATED
Incluye:

HealthcareCase

folio

planning schedule

responsible User

minimal lifecycle

cancellation

tenant context

localized audit facts
Estados CURRENT:

DRAFT

SCHEDULED

CANCELLED
También está IMPLEMENTED / VALIDATED en ERP Core:

EquipmentAsset

EquipmentInspection

Equipment V1
En este baseline original permanecían fuera de Foundation:

Hospital

Doctor

Requirements

Equipment Assignment

Case Availability

Preparation

Dispatch

Custody

Return

CaseKit

Calendar

Case 360

Mobile Technician
9.2 Orden recomendado Healthcare
1. Hospital / Doctor

2. Requirements

3. Equipment Assignment

4. Case Availability

5. Architecture gate for physical logistics

6. Dispatch / Custody

7. Return / Reconciliation

8. CaseKit / Maletín

9. Case Calendar

10. Case 360

11. Mobile Technician
El orden puede ajustarse cuando aparezca evidencia operacional real, pero deben respetarse las dependencias.

El gate anterior a Dispatch / Custody debe resolver, mediante diseño/ADR
explícito si es necesario, physical positioning, custody, location y transfer
semantics. No bloquea Hospital / Doctor, Requirements, Equipment Assignment o
Case Availability, ni exige implementar todo Advanced Inventory como parte de
M-HC1.

9.3 Healthcare Actors
Mantener conceptualmente separados:

Doctor

Hospital

Customer

Payer

responsible User / Technician function
porque representan responsabilidades distintas.

No asumir:

Customer
=
Hospital
=
Doctor
=
Payer
Technician utiliza inicialmente:

User
como identidad operacional.

No debe crearse una identidad Healthcare separada sin una necesidad real de dominio.

9.4 Healthcare Case
HealthcareCase representa una operación desde el punto de vista:

operacional

+

logístico
y puede relacionarse posteriormente con contexto comercial.

No debe convertirse en:

clinical record

patient record

PHI repository
9.5 Hospital / Doctor
Hospital y Doctor son master data Healthcare CURRENT.

HC-NEXT-01 — Hospital / Doctor Domain Design

Estado: CLOSED / ACCEPTED

C1-C8 están completos. C8 está CLOSED / MERGED / ACCEPTED, con acceptance
automatizada PASS y QA manual PASS para ADMIN, MANAGER, SALES y WAREHOUSE. PR
#14 está merged en el baseline canónico `fbf29b6`.

Contexto histórico de diseño:

El objetivo original fue definir el boundary de master data Healthcare para
Hospital y Doctor antes de elegir o implementar la persistencia.

Debía mantenerse:

Doctor
≠
Customer
Hospital
≠
Customer
La estrategia exacta de tenant ownership debía decidirse antes de implementación:

Company-owned master data
vs:

shared identity
+
tenant-specific relation
En esa fase no debía asumirse todavía una estrategia definitiva en Prisma.

HC-NEXT-01 comenzó como Documentation / Domain Design. Esa fase inicial no
marcaba Hospital, Doctor ni los workflows posteriores como implementados.

9.6 Requirements
Estado: DOMAIN DISCOVERY COMPLETE / DOCUMENTED — TECHNICAL DESIGN APPROVED —
PERSISTENCE / BACKEND / FRONTEND COMPLETE / MERGED — ACCEPTANCE COMPLETE /
ACCEPTED.

El contrato aprobado de dominio V1 se documenta en
`docs/modules/healthcare/REQUIREMENTS.md`. Ese discovery no creó un identificador
de implementación.

El diseño técnico se documenta en
`docs/modules/healthcare/REQUIREMENTS_TECHNICAL_DESIGN.md`. Está `APPROVED` y
su implementación V1 está completa y aceptada.

La UI no expone reorder manual: `sortOrder` permanece como orden interno de
presentación asignado automáticamente. Una futura secuencia operacional
pertenece a Preparation / CaseKit / Maletín. El contrato
`RequirementOperationalEvidencePolicy` existe, pero su integración con
evidencia real permanece diferida hasta que haya productores Healthcare.

Un Case debe poder expresar qué necesita antes de seleccionar recursos físicos.

Conceptualmente:

Case
↓
Requirements

└── existing Product lines with integer requestedQty > 0

Equipment needs y support material se expresan mediante Products existentes.
No existe un Requirement V1 libre de Product.
Debe mantenerse:

Requirements
→ what is needed
Preparation
→ work performed to satisfy the need
CaseKit
→ actual prepared set
Estos conceptos no deben confundirse.

9.7 Equipment Assignment
Estado: HC-NEXT-03A DOMAIN DISCOVERY COMPLETE / DOCUMENTED — HC-NEXT-03B
TECHNICAL DESIGN COMPLETE / APPROVED — HC-NEXT-03B.1 PERSISTENCE & AVAILABILITY,
HC-NEXT-03B.2 API / DTO / AUTHORIZATION Y HC-NEXT-03B.3 IMPLEMENTATION SLICING /
ACCEPTANCE CONTRACT APPROVED / DOCUMENTED — HC-NEXT-03C1 PERSISTENCE / MIGRATION
COMPLETE / MERGED — HC-NEXT-03C2 BACKEND BASE COMPLETE / MERGED — HC-NEXT-03C3
COMPLETE / MERGED — HC-NEXT-03C4 COMPLETE / MERGED: MANUAL RELEASE, REPLACE,
REQUIREMENT RETIRE C4-C1 AND CASE CANCEL C4-C2 IN MAIN — HC-LOCK-04 FINAL CLOSED /
ACCEPTED IN main@be73bc4 — HC-NEXT-03C5-A COMPLETE / MERGED IN main@5ec9f67 VIA
PR #36 + #37 — HC-NEXT-03C5-B PLANNED — B0 NOT READY; B1–B3 NOT IMPLEMENTED — PARTIALLY
IMPLEMENTED: BACKEND C1–C4 COMPLETE; C6-A READ-ONLY VIEW COMPLETE / MERGED IN
main@8a67d5a; C6-B CREATE UI COMPLETE / MERGED IN main@4805128.

El contrato canónico aprobado se documenta en
`docs/modules/healthcare/EQUIPMENT_ASSIGNMENT.md`.

El diseño HC-NEXT-03B.1 se documenta en
`docs/modules/healthcare/EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md`.

Debe relacionar:

HealthcareCase

+

EquipmentAsset
sin duplicar la identidad física del Equipment.

Principio:

ERP Core
→ EquipmentAsset identity

Healthcare
→ operational Assignment

Assignment normalmente resuelve una Requirement de equipo, pero Warehouse puede
crear una asignación directa urgente si su origen permanece trazable. Una
Requirement puede necesitar varias unidades y la cobertura puede permanecer
parcial sin bloquear el Case.

Availability se deriva sobre una ventana operacional que incluye más que el
horario del procedimiento. `RETIRED`, `INSPECTION_PENDING`, `DAMAGED` y
`OUT_OF_SERVICE` impiden una nueva Assignment. Un overlap del mismo activo genera
un warning visible, no un hard block; un override autorizado exige justificación
y auditoría.

Reassignment debe preservar activo original, reemplazo, actor, momento y razón.
Reschedule conserva Assignments y reevalúa conflictos. `CANCELLED` libera
automáticamente Assignments activas/reservadas sin reescribir Dispatch o Custody.

Intención RBAC: ADMIN, MANAGER y WAREHOUSE pueden leer y mutar; SALES conserva
sólo lectura/contexto. API, DTOs, guards y permission-based RBAC no se diseñan en
HC-NEXT-03A.

HC-NEXT-03B.1 define una fila histórica por EquipmentAsset, lifecycle `RESERVED` /
`RELEASED` / `REPLACED`, origins `REQUIREMENT` / `DIRECT`, lineage, override
auditable, notas operacionales de coverage, configuración 1:1 Company-scoped,
ventana half-open, composite FKs y revalidación concurrente con lock estrecho por
activo. Coverage permanece derivado y no existe DB prohibition de overlaps.

El diseño permite Assignment con schedule incompleto como disponibilidad
pendiente, libera reservas `REQUIREMENT` al retirar/cancelar la Requirement y
evita over-coverage mediante validación de dominio, usando `DIRECT` para extras.

HC-NEXT-03B.2 aprueba el recurso top-level, filtros/paginación, DTOs allowlisted,
response shaping, guards/decorators, stable errors, review 200/no-write con
fingerprint, `Idempotency-Key` y fronteras atómicas. ADMIN/MANAGER/WAREHOUSE
mutan; SALES conserva read-only. Frontend UX y los slices posteriores
permanecen diferidos. HC-NEXT-03B.3 aprueba la secuencia C1–C7, sus
dependencias/gates y el acceptance A–P. HC-NEXT-03C1 Persistence / Migration
está COMPLETE / MERGED, HC-NEXT-03C2 Assignment Backend Base está COMPLETE /
MERGED y HC-NEXT-03C3 Availability / Conflict Review / Concurrency queda
COMPLETE / MERGED. HC-NEXT-03C4 Replace / Release / Parent Integrations está
COMPLETE / MERGED, incluidas C4-C1 y C4-C2. HC-LOCK-04 final está CLOSED /
ACCEPTED sobre `main@be73bc4`. DEC-C5-02 divide hardening en C5-A Contract
Alignment & Safe PostgreSQL Harness y C5-B Integrated Backend Validation. C5-A
está COMPLETE / MERGED mediante PR #36 y #37 en `main@5ec9f67`; C5-B está
planificado como B0/B1/B2/B3 (3/5/5/3 SP), con B0 NOT READY y B1–B3 NOT
IMPLEMENTED. DEC-C5B-01/02/03 fijan rol dedicado sin autorización de provisioning,
evidencia compuesta del error sanitizado y readback tras mutar el fixture Case.
DEC-C5-01 deja CoverageNote
y cobertura agregada fuera de C5 en HC-NEXT-03C5-COVERAGE, con contrato funcional
pendiente y como prerequisito de slices posteriores de C6 que requieran coverage
pero no de C6-A/C6-B/C6-C. C6-A está COMPLETE / MERGED mediante PR #38 en
`main@8a67d5a`, con Actual 25-sep-2026. Vitest focal 29/29, ESLint, TypeScript,
Next.js build y CI API/Web pasaron; la validación manual cubrió empty state,
DIRECT/RESERVED real, Detail modal y disponibilidad “No verificable” con
`INCOMPLETE_CASE_SCHEDULE`. El mojibake observado sólo en datos de desarrollo
(“Cirug�a”/“Demostraci�n”) es un known non-blocker; la UI estática UTF-8 es
correcta. C6-B está COMPLETE / MERGED mediante PR #40 en `main@4805128`, con
Actual 25-sep-2026: Vitest focal 19/19, TypeScript Web, ESLint Web, Next.js build
y CI API/Web pasaron. La validación manual acreditó MANAGER Create DIRECT, éxito
con refresh de List, nueva RESERVED visible, disponibilidad/warning renderizados
y SALES sin acción Create. C6-C está COMPLETE / MERGED mediante PR #42 en
`main@9bade4d`, con Actual 25-sep-2026: Vitest focal 26/26, TypeScript Web, ESLint
Web, Next.js build y CI API/Web pasaron. La validación manual acreditó MANAGER con
Release sobre RESERVED, motivo requerido, transición a RELEASED, feedback con
refresh, disponibilidad “No aplica (histórico)” y desaparición de Release. SALES
read-only conserva sólo evidencia automatizada. C6-D Replace Assignment UI queda
como siguiente candidato funcional / NOT READY, sin SP, Forecast ni Commitment.
Este corte no declara Healthcare Core ni producción terminados.

Debe mantenerse:

Assignment
≠
EquipmentLifecycle
y:

Assignment
≠
Custody
9.8 Case Availability
Current Equipment Availability ya está implementado en ERP Core.

Actualmente:

ACTIVE + GOOD
→ available

INSPECTION_PENDING
→ unavailable

DAMAGED
→ unavailable

OUT_OF_SERVICE
→ unavailable

RETIRED
→ unavailable
Healthcare deberá extender esta evaluación hacia:

Case Availability
considerando cuando existan:

Assignment conflicts

Case schedule

active custody

other operational blockers
No debe reemplazarse Availability con un boolean persistido manualmente.

Maintenance, Calibration y Turnaround permanecen evoluciones posteriores.

9.9 Preparation
Preparation representa el trabajo necesario para satisfacer Requirements.

Puede incluir:

requirements review

availability checks

material picking

Equipment Assignment

CaseKit assembly

documentation
Preparation no debe implicar automáticamente:

commercial Inventory OUT
9.10 CaseKit / Maletín
CaseKit representa la preparación real de material para un Case específico.

Puede contener conceptualmente:

Products

quantities

batches

Equipment

preparation state
La cardinalidad y schema exactos se definirán posteriormente.

Debe mantenerse:

CaseKit
≠
Requirements
y:

CaseKit
≠
automatic Inventory OUT
KitTemplate permanece FUTURE como capacidad de productividad reutilizable y no debe bloquear la primera implementación de CaseKit.

9.11 Dispatch / Custody
Debe formalizar:

Preparation
↓
Dispatch
↓
Custody
Regla crítica:

CaseDispatch
≠
Delivery
y:

CaseDispatch
≠
commercial Inventory OUT
El material puede estar:

fuera del almacén
pero continuar siendo propiedad de la Company.

La semántica técnica exacta de ubicación/custodia deberá resolverse mediante diseño/ADR antes de Dispatch real.

No debe asumirse de forma anticipada:

Dispatch
→ InventoryMovement TRANSFER
como contrato CURRENT.

9.12 Return
Después del Case:

Custody
↓
Return
↓
Inspection where required
↓
Reconciliation
El Return Healthcare no debe confundirse con Commercial Return.

Debe mantenerse:

CaseReturn
≠
Commercial Return
y:

Returned
≠
Automatically Available
cuando se requiera inspección.

9.13 Reconciliation
Debe cumplirse conceptualmente:

Dispatched
=
Consumed
+
Returned
+
Unresolved
Unresolved debe preferirse como valor derivado.

Consumed
La cantidad consumida representa verdad operacional.

No debe significar automáticamente:

Sale

Delivery

Invoice
La consecuencia comercial debe diseñarse por separado.

Returned
Puede requerir inspección y disposición antes de recuperar disponibilidad.

Para EquipmentAsset debe reutilizarse EquipmentInspection cuando la semántica aplique.

9.14 Equipment Boundary
EquipmentAsset debe conservar identidad física ERP Core:

EquipmentAsset

├── assetCode
├── Product
├── serialNumber
├── lifecycle
├── condition
├── origin
├── batch
└── history
Healthcare debe ser responsable de:

Assignment

Custody

Dispatch

Return

Case relation
No agregar directamente a EquipmentAsset campos específicos como:

currentCase

currentCustodian
si esos hechos pertenecen a workflows Healthcare.

9.15 Inventory / Custody Architecture Candidate
Healthcare introduce una necesidad futura de representar:

physical positioning

custody

availability

staging
Soluciones posibles incluyen:

InventoryLocation

InventoryPosition

internal transfer semantics
pero permanecen:

ARCHITECTURAL CANDIDATES
hasta que un ADR o diseño específico los apruebe.

9.16 Case Calendar
Debe proporcionar una lectura temporal de Cases.

Puede consumir:

Case schedule

responsible User

Hospital / Doctor context

Readiness

conflicts
Calendar debe ser inicialmente:

Read Model
y no una segunda fuente del schedule.

9.17 Case 360
Debe concentrar:

Case identity

Schedule

Hospital

Doctor

Responsible User

Requirements

Preparation

CaseKit

Equipment Assignment

Dispatch

Custody

Return

Reconciliation

Commercial references
sin duplicar ownership de cada dominio.

9.18 Healthcare Mobile
Una experiencia móvil especializada puede apoyar a técnicos con:

Cases

Schedule

CaseKit

Custody

Return

Reconciliation

Equipment
Debe consumir las mismas APIs y reglas de negocio.

9.19 Healthcare Opportunity
Una capa comercial previa puede existir posteriormente:

Doctor request

Technician prospecting

Commercial lead

↓

Opportunity

↓

Healthcare Case
Opportunity permanece:

FUTURE / optional
No es requisito para crear un HealthcareCase.

9.20 Payer / Insurance
Payer es un concepto reconocido, pero permanece FUTURE.

Debe mantenerse:

Payer
≠
Customer
y no debe introducirse un Patient model por defecto.

10. Etapa 3 — Commercial ERP Experience
Prioridad: P1

Objetivo:

reducir fricción y convertir módulos funcionales en una experiencia ERP más eficiente.

Healthcare ya fue seleccionado como siguiente workstream P1. Advanced Inventory
permanece como target P2 aprobado y no implementado; mejoras UX seleccionadas
pueden ejecutarse en paralelo si no crean dependencias nuevas.

10.1 360 Views
Prioridad:

Customer 360

Product 360

Supplier 360

Purchase 360

Equipment 360
Posteriormente:

SalesOrder 360

Commercial Return 360

Healthcare Case 360
Principio:

Identity
↓
Current state
↓
Related activity
↓
Next actions
10.2 Action Dashboard
Dashboard 2.0 ya existe.

La evolución futura busca pasar de:

Counters
a:

Operational Context
↓
Attention
↓
Action
Ejemplo:

3 compras pendientes de recepción
[Revisar]

5 productos con bajo stock
[Reabastecer]

2 casos pendientes de retorno
[Revisar]
10.3 Global Search
Búsqueda transversal para:

Customers

Suppliers

Products

Purchases

Quotes

Sales / SalesOrders

Equipment

Healthcare Cases
según disponibilidad.

Debe respetar:

Tenant
+
Permissions
+
Resource lifecycle
10.4 Contextual Creation
Reducir navegación innecesaria.

Ejemplo:

New Purchase
↓
SupplierSelector
↓
Supplier does not exist
↓
Create Supplier
↓
continue Purchase
Sin perder formularios independientes.

10.5 UX Consistency
Continuar estandarizando:

Page layout

Actions

Forms

Tables

Filters

Statuses

Confirmation

Loading

Empty states

Errors

Modals

Navigation

Responsive behavior

Accessibility
Sin introducir un rediseño total innecesario.

10.6 Onboarding
Una Company nueva debe poder pasar rápidamente de:

Account created
a:

Useful ERP
Flujo conceptual:

Company setup
↓
Users
↓
Products
↓
Customers
↓
Suppliers
↓
Initial Inventory / Purchases
↓
First commercial operation
10.7 Setup Checklist
Dashboard puede mostrar:

Configura tu empresa      ✓
Agrega productos          ○
Importa clientes          ○
Registra proveedores      ○
Crea primera cotización   ○
para tenants nuevos.

11. Etapa 4 — Data Import & Migration
Prioridad: P1

Objetivo:

reducir significativamente el costo de adopción de Zaping.

Una PyME con años de información no puede depender exclusivamente de captura manual.

11.1 Importaciones iniciales
Prioridad:

Customers

Suppliers

Products

Inventory
11.2 Formatos
Inicialmente:

CSV

XLSX
11.3 Flujo de importación
Upload
↓
Column Mapping
↓
Validation
↓
Duplicate Detection
↓
Preview
↓
Batch Import
↓
Result Report
11.4 Sistemas de origen
La arquitectura debe permitir migraciones desde:

Excel

CONTPAQi

Aspel

Microsip

Odoo

SAP

otros ERP
sin construir un conector completo para cada sistema desde la primera versión.

11.5 Initial Inventory
Importar Products debe mantenerse separado de:

Initial Inventory
El inventario inicial requiere una operación:

controlled

traceable

auditable
No debe traducirse en:

Product.stock = spreadsheet value
sin origen ni contexto.

12. Etapa 5 — SalesOrder + Delivery
Prioridad: P1 estratégica

Objetivo:

separar compromiso comercial de fulfillment físico.

12.1 Modelo objetivo
Quote
↓ optional
SalesOrder
↓
Delivery
↓
Inventory OUT
12.2 SalesOrder
Debe representar:

Customer

Products

quantities

prices

totals

commercial commitment

pending quantities

optional Quote relation
12.3 Delivery
Debe representar:

physical fulfillment

actual delivered quantities

partial deliveries

batches

serialized units when applicable

date

destination

responsible actor

Inventory OUT
12.4 Entregas parciales
Ordered 100
↓
Delivery 40
↓
Delivery 30
↓
Pending 30
12.5 Quote Conversion
Evolución futura:

Quote
↓
SalesOrder
sin modificar inventario.

La implementación V1 CURRENT:

Quote
↓
Sale
permanece mientras no exista la nueva arquitectura.

12.6 Legacy Migration
La futura migración debe conservar:

folios

Customers

items

prices

statuses

InventoryMovement history

Quote relationships

Commercial Return relationships
No debe volver a producir:

Inventory OUT
para Sales ya procesadas.

12.7 Commercial Returns Evolution
Commercial Returns Backend no es blocker P0 del ERP Core V1.

Prioridad: P1 estratégica / Deferred

Diseño existente:

RET-001
→ completed

RET-002
→ completed

RET-003
→ schema/migration completed

RET-004
→ backend operational pending
Su evolución debe coordinarse con:

SalesOrder
↓
Delivery
↓
Commercial Return
↓
Inspection / Disposition
↓
Inventory
Debe mantenerse:

Commercial Return
≠
Healthcare CaseReturn
No profundizar innecesariamente dependencias físicas sobre Sale.

13. Etapa 6 — Inventory Traceability
Prioridad: P1

Objetivo:

convertir Inventory en una ventaja competitiva para distribuidores médicos.

13.1 FEFO
Implementar:

First Expired, First Out

Debe considerar:

Expiration

Availability

Batch state

Quantity

future location/custody context when implemented
13.2 Expiration Management
Incluir progresivamente:

Expired

Near Expiration

30 / 60 / 90 day visibility

Sellability

Alerts

Dashboard integration
13.3 Batch Allocation
Future Delivery debe conocer:

qué lote
+
qué cantidad
se entregó.

Esto habilita:

Commercial Returns

commercial traceability

FEFO

lot history
Healthcare tendrá su propia integración logística sin depender necesariamente de Delivery para reconciliar custodia.

13.4 SERIALIZED vs ASSET
Zaping distingue:

SERIALIZED
≠
ASSET
SERIALIZED representa inventario unitario serializado que no necesariamente es Equipment reutilizable.

ASSET representa identidad física persistente de Equipment.

Ambos pueden utilizar seriales, pero pertenecen a workflows distintos.

La semántica operacional de SERIALIZED permanece pendiente.

13.5 Kardex
Inventory debe proporcionar una lectura operativa:

Date

Origin

IN

OUT

Balance

Lot

User
sin sustituir InventoryMovement como fuente histórica.

14. Etapa 7 — Audit & Advanced Authorization
Prioridad: P1 / P2

Objetivo:

aumentar trazabilidad y control conforme Zaping entre a operaciones empresariales más sensibles.

14.1 Audit Foundation
Primera versión:

AuditEvent

companyId

actor

action

resource

timestamp

safe metadata
Comportamiento:

append-only
14.2 Cobertura inicial
Prioridad:

Identity

Company

Inventory

Purchases

Receipts

Sales / Deliveries

Commercial Returns

Healthcare Cases

Equipment
14.3 Permission-Based RBAC
Evolucionar:

UserRole
↓
RolesGuard
hacia:

Role
↓
Permissions
↓
PermissionsGuard
14.4 Default Roles
Los roles actuales pueden convertirse en presets:

Administrator

Manager

Sales

Warehouse
14.5 Custom Roles
Posteriormente:

Compras

Supervisor de Almacén

Auditor

Ventas Junior

Healthcare Technician
basados en Permissions.

15. Etapa 8 — Multi-Warehouse & Advanced Inventory
Prioridad: P2 / architectural evolution

Estado: DESIGNED / APPROVED TARGET — NOT IMPLEMENTED

Objetivo:

soportar empresas con mayor complejidad logística.

El diseño objetivo está aprobado por ADR-014 y consolidado en
`docs/modules/erp/ADVANCED_INVENTORY.md`. La implementación y el diseño técnico
de schema permanecen pendientes.

El target preserva Branch / Warehouse, Storage Locations, Inventory by
Location, Internal Transfers, Reservations, Physical Counts, QR / Barcode e
Inventory Ledger V2. No es el milestone principal actual.

Healthcare puede avanzar con Hospital / Doctor, Requirements, Equipment
Assignment y Case Availability sin esta etapa completa. Antes de Dispatch /
Custody real puede requerirse un gate de diseño/ADR sobre posición física,
custodia, ubicación y transferencias.

15.1 Warehouses
La fundación Branch / Warehouse es una capacidad TARGET aprobada para empresas
con múltiples almacenes.

El schema definitivo deberá diseñarse cuando exista prioridad real.

15.2 Locations
El diseño objetivo puede representar:

Zone

Rack

Bin

Quarantine

Staging
según necesidad real.

InventoryLocation / StorageLocation es una capacidad TARGET aprobada, todavía no
implementada.

15.3 Inventory Position
`InventoryPosition` objetivo puede requerir dimensiones como:

Product

+

Batch

+

Location

+

State
La semántica de la posición y su reconciliación contra el ledger están aprobadas;
la estrategia técnica de persistencia/source of truth se definirá durante el
diseño técnico previo a implementación.

15.4 Internal Transfers
El diseño objetivo define una semántica para:

Location A
↓
Location B
sin tratar automáticamente el hecho como una salida comercial.

La implementación exacta permanece pendiente y debe seguir el diseño canónico
de Advanced Inventory.

15.5 Stock Counts
System Quantity
vs
Physical Quantity
↓
Difference
↓
Authorized Adjustment
15.6 Reservations
El diseño aprobado distingue:

Physical

Reserved

Available
y su interacción con:

SalesOrder

Healthcare

Warehouse

Delivery

El backlog accionable de esta etapa se mantiene en `PROJECT_BOARD.md`.
16. Etapa 9 — Billing & Mexican Commercial Requirements
Prioridad: P2 / necesaria para madurez comercial en México

Objetivo:

completar el ciclo económico sin mezclarlo con fulfillment físico.

16.1 Separación de responsabilidades
SalesOrder
≠
Delivery
≠
Invoice
16.2 CFDI
La implementación mexicana requerirá revisar:

RFC

razón social

régimen fiscal

código postal

uso CFDI

impuestos

timbrado

cancelación

XML

PDF
16.3 Fiscal Profiles
Customer y Company requerirán estructuras fiscales diseñadas explícitamente.

No agregar campos fiscales aislados sin diseño de Billing.

16.4 Accounts Receivable
Invoice
↓
Balance
↓
Payment
↓
Accounts Receivable
16.5 Credit Management
Solo con saldos confiables tendrá sentido utilizar:

Customer.creditLimit
como control operacional real.

16.6 Supplier Finance
Posible evolución:

Accounts Payable

Supplier Invoices

Payments
si el alcance comercial lo requiere.

17. Etapa 10 — Portals & Mobile
Prioridad: P2

Objetivo:

extender Zaping fuera de la interfaz interna principal.

17.1 Customer Portal
Capacidades progresivas:

Quotes

Orders

Deliveries

Invoices

Documents
según permisos.

17.2 External Identity
Customer Portal requerirá identidad externa segura.

No debe utilizar:

Customer.email
como login implícito.

17.3 Sales Mobile
Capacidades candidatas:

Customers

Products

Quotes

SalesOrders

Field activity
17.4 Healthcare Mobile
Capacidades:

Cases

CaseKit

Custody

Return

Reconciliation

Equipment
17.5 API reutilizable
Portal y Mobile deben consumir las mismas capacidades de negocio.

No crear reglas independientes por canal.

18. Etapa 11 — Zaping Radar
Prioridad: Future / exploración estratégica

Objetivo:

convertir oportunidades externas en inteligencia accionable para empresas que venden al sector público y Healthcare.

18.1 Alcance inicial
Regiones iniciales consideradas:

Sonora

Baja California

Baja California Sur

Nuevo León

Sinaloa
con énfasis en:

licitaciones

oportunidades del sector salud
18.2 Radar como producto
Radar puede funcionar:

Standalone
y:

Integrated with Zaping ERP
cuando aporte valor.

18.3 Integración potencial
Tender / Opportunity
↓
Radar
↓
ERP Opportunity
↓
Quote
↓
Commercial process
sin acoplar Radar directamente al dominio transaccional.

18.4 Capacidades futuras
Source Monitoring

Opportunity Normalization

Filters

Alerts

Saved Searches

Tender Workspace

Document Analysis

Commercial Fit

ERP Integration
18.5 Regla
Radar no debe retrasar:

Security

Release readiness

Healthcare

Data adoption

Core reliability
19. Etapa 12 — Zaping AI
Prioridad: Future

Objetivo:

convertir información operacional confiable en asistencia y automatización explicable.

19.1 Principio
Reliable Data
+
Reliable Workflows
↓
Useful AI
No al revés.

19.2 Capacidades candidatas
Natural Language Queries

Operational Summaries

Replenishment Suggestions

Sales Insights

Anomaly Detection

Tender Analysis

Document Assistance

Workflow Recommendations
19.3 AI explicable
Toda recomendación debe poder relacionarse con datos reales.

Ejemplo:

Revisar Product CAT-001

Stock actual: 4

MinStock: 10

Pending Purchases: 0
19.4 Authorization
Una consulta AI debe aplicar:

Identity

Tenant

Permissions

Domain Rules
igual que cualquier otra interfaz.

19.5 Acciones automáticas
Debe distinguirse:

Recommendation
de:

Automated Business Action
Acciones automáticas futuras requerirán:

authorization

audit

confirmation

safe execution

failure handling
20. Capacidades transversales futuras
Algunas capacidades afectan varias etapas:

Notifications

Document Management

Advanced Reporting

Analytics

Integrations

Public API

Webhooks

Localization

Internationalization

Observability

Backups
Se implementarán cuando sus dependencias estén maduras.

20.1 Notifications
Ejemplos:

Low Stock

Expiration

Pending Receipt

Pending Delivery

Healthcare Case

Return

Tender Opportunity
20.2 Document Management
Puede soportar:

quotes

orders

licitaciones

contracts

certificates

regulatory documents

PDFs

attachments
Debe respetar tenant isolation.

20.3 Reporting
Evolución:

Operational Reports

Commercial Reports

Inventory Reports

Healthcare Reports

Exports
sin convertir prematuramente Dashboard en una plataforma BI.

20.4 Integrations
Posibles integraciones:

CONTPAQi

email

CFDI / PAC

carriers

supplier systems

public procurement sources
Cada integración deberá contemplar:

ownership

security

retries

audit

failure handling
20.5 Public API
Debe distinguirse:

Application API
de:

Public API
Una Public API futura puede requerir:

versioning

credentials

quotas

webhooks

compatibility guarantees
21. Lo que no debe priorizarse todavía
No invertir significativamente en:

Microservices

Kubernetes for product complexity alone

Complex Event Bus

Data Warehouse

Advanced ML infrastructure

Marketplace

Plugin ecosystem

Global multi-region
sin necesidad demostrada.

22. Principio arquitectónico
Zaping continúa con:

Modular Monolith until evidence says otherwise.

La evolución del producto no exige convertir cada capacidad en un servicio independiente.

Debe priorizarse:

clear domain boundaries

+

testability

+

tenant safety

+

reliable transactions

+

maintainability
antes que complejidad distribuida.

23. Dependencias principales
La secuencia de capacidades no es arbitraria.

HealthcareCase
+
EquipmentAsset
↓
Equipment Assignment
↓
Case Availability
↓
Dispatch / Custody
HealthcareCase
+
Requirements
↓
Preparation
↓
CaseKit
Dispatch / Custody
↓
Return
↓
Reconciliation
Healthcare Reconciliation no depende de que SalesOrder / Delivery estén implementados.

La consecuencia comercial posterior es un dominio separado.

SalesOrder
↓
Delivery
↓
Batch Allocation
↓
Reliable Commercial Returns
InventoryBatch
↓
Expiration
↓
FEFO
Reliable Domains
↓
Audit
↓
Advanced Automation
Reliable Operational Data
↓
Analytics
↓
AI
24. Priorización comercial
Al evaluar iniciativas considerar:

Customer Value

Operational Risk

Revenue Potential

Differentiation

Dependencies

Development Cost

Security Impact

Migration Impact

UX Impact
No priorizar únicamente por facilidad técnica.

25. Regla para nuevas ideas
Una idea no entra automáticamente a desarrollo.

Debe pasar por:

Idea
↓
Product fit
↓
Priority
↓
Dependencies
↓
Roadmap
↓
Project Board
↓
Implementation
26. Estrategia competitiva
Zaping no debe copiar feature por feature a:

Odoo

CONTPAQi

Bind ERP

Microsip

Dynamics

NetSuite

SAP
La estrategia es competir mediante:

ERP Core sólido

+

UX más simple

+

Healthcare specialization

+

Traceability

+

Faster adoption
y posteriormente:

Radar

+

AI
27. Comercialización
El producto debe avanzar progresivamente:

Internal Use
↓
Controlled Pilot
↓
Early Customers
↓
Repeatable Onboarding
↓
Scalable SaaS
27.1 Pilotos
Antes de pilotos externos debe existir al menos:

Password Security V1 implementation

real password-recovery email delivery/configuration verification

authentication abuse protection

safe role provisioning

inactive-user enforcement

critical flows stable

tenant isolation validated — ✅ B2D

critical authorization reviewed — ✅ B2D

protected-route/session behavior reviewed

production secrets/configuration reviewed

basic backups

error handling

QA

reasonable onboarding

operational support

internal documentation
27.2 SaaS Operations futuras
Posteriormente:

Subscriptions

Plans

Feature Entitlements

Tenant Provisioning

Tenant Suspension

Usage Limits

Support

Backups

Observability
No pertenecen todavía al ERP funcional principal.

28. Release Strategy
No utilizar números de versión como promesas de features futuras.

Una versión debe representar:

real

verifiable

completed

changes
Flujo de release:

Feature Complete
↓
Regression
↓
Security Review
↓
Migration Validation
↓
Release Candidate
↓
Release
29. Backlog y Sprints
No mantener un segundo backlog general dentro del Roadmap.

Trabajo accionable:

PROJECT_BOARD.md
o sistema de tickets.

Sprints pueden utilizarse operacionalmente, pero:

architecture

product behavior

roadmap
deben permanecer en sus fuentes responsables.

Trabajo histórico relevante:

CHANGELOG.md
30. Criterio de avance entre etapas
Las etapas no requieren completar el 100 % de todas las ideas.

La transición debe basarse en:

Critical dependencies resolved

+

Acceptable risk

+

Business value
El Roadmap no es lineal rígido.

Algunas iniciativas pueden ejecutarse en paralelo cuando no violen dependencias ni distraigan del workstream principal.

31. Prioridades actuales resumidas
P0 — Release / Integrity / Security

Completed / verified:

Password Security V1 implementation

Safe role provisioning

Inactive-user enforcement

Authorization + Tenant Isolation V1

Role-based authorization V1

DEV-NEXT-03B ERP Core V1 Local Acceptance — PASS

Manual role matrix — ADMIN / MANAGER / SALES / WAREHOUSE PASS

QA-001 through QA-008 — CLOSED / PASS

Remaining operational validation:

real email delivery/configuration and forgot → email → reset → login E2E

OPS-RC-B5C real staging acceptance — DEFERRED / READY WHEN NEEDED

backup / restore provider validation before pilot / production

Formal release-candidate acceptance remains a later decision.
Commercial Returns Backend no es P0.

P1 estratégica activa
M-HC1 — Healthcare Operations Foundation

HC-NEXT-01 — Hospital / Doctor — CLOSED / ACCEPTED

Hospital / Doctor — CLOSED / ACCEPTED

Requirements — COMPLETE / ACCEPTED

HC-NEXT-03A Healthcare Equipment Assignment Domain Discovery — COMPLETE / DOCUMENTED

HC-NEXT-03B Healthcare Equipment Assignment Technical Design — COMPLETE / APPROVED

HC-NEXT-03B.1 Persistence & Availability Design — APPROVED / DOCUMENTED

HC-NEXT-03B.2 API / DTO / Authorization Contract — APPROVED / DOCUMENTED

HC-NEXT-03B.3 Implementation Slicing / Acceptance Contract — APPROVED / DOCUMENTED

HC-NEXT-03C1 Equipment Assignment Persistence / Migration — COMPLETE / MERGED

HC-NEXT-03C2 Assignment Backend Base — COMPLETE / MERGED

HC-NEXT-03C3 Availability / Conflict Review / Concurrency — COMPLETE / MERGED

HC-NEXT-03C4 Replace / Release / Parent Integrations — COMPLETE / MERGED — PARENT INTEGRATIONS COMPLETE — HC-LOCK-04 FINAL CLOSED / ACCEPTED IN main@be73bc4

HC-NEXT-03C5-A Contract Alignment & Safe PostgreSQL Harness — COMPLETE / MERGED — PR #36 + #37 — main@5ec9f67

HC-NEXT-03C6-A Case Equipment Assignments Read-only View — COMPLETE / MERGED — PR #38 — main@8a67d5a — Actual 25-sep-2026

HC-NEXT-03C6-B Create Assignment UI — COMPLETE / MERGED — PR #40 — main@4805128 — Actual 25-sep-2026

HC-NEXT-03C6-C Release Assignment UI — COMPLETE / MERGED — PR #42 — main@9bade4d — Actual 25-sep-2026

HC-NEXT-03C6-D Replace Assignment UI — NEXT FUNCTIONAL CANDIDATE / NOT READY

HC-NEXT-03C5-B Integrated Backend Validation — PLANNED — B0 NOT READY; B1–B3 NOT IMPLEMENTED

HC-NEXT-03C5-COVERAGE — CONTRACT PENDING / REQUIRED BEFORE C6 SLICES THAT DEPEND ON COVERAGE

Case Availability

Dispatch / Custody

Return

CaseKit / Maletín

Calendar

Case 360

Mobile Technician

Los elementos posteriores a HC-NEXT-01 no pertenecen necesariamente al mismo
slice de implementación.
P1 posterior / paralelo
UX / 360

Action Dashboard

Global Search

Onboarding

Data Import

SalesOrder + Delivery

Commercial Returns evolution

Inventory Traceability

Audit

Permission-Based RBAC
P2
Multi-Warehouse

Advanced Inventory — DESIGNED / APPROVED / NOT IMPLEMENTED

Billing / CFDI

Accounts Receivable

Portals

Sales Mobile

Advanced Reporting

SaaS operations
Future
Healthcare Opportunity

Payer / Insurance

KitTemplate

Radar

AI

Advanced automation

Broader ecosystem
32. Fuente de verdad
ROADMAP.md
→ dirección futura
→ prioridades estratégicas
PROJECT_BOARD.md
→ estado actual
→ trabajo activo
→ blockers
CHANGELOG.md
→ historia
PRODUCT_VISION.md
→ visión de largo plazo
PRODUCT_REQUIREMENTS.md
→ capacidades esperadas
ADR
→ decisiones arquitectónicas
ADVANCED_INVENTORY.md
→ diseño objetivo aprobado de Advanced Inventory
docs/modules/
→ comportamiento funcional por dominio
33. Regla de mantenimiento
Este Roadmap debe revisarse cuando:

cambie una prioridad estratégica;

se apruebe una nueva línea de producto;

una dependencia importante sea resuelta;

un aprendizaje real cambie el orden;

una capacidad deje de aportar valor;

se cierre una etapa estratégica importante.

No necesita modificarse con cada commit.

34. Principio final
Zaping debe crecer por capas:

Reliable Core
↓
Secure / Release-Ready Core
↓
Healthcare Differentiation
↓
Great Operational Experience
↓
Broader ERP Capabilities
↓
External Intelligence
↓
AI
La prioridad inmediata es:

ERP Core V1 CLOSED / ACCEPTED en `main` (`a4434a6`)
↓
M-HC1 — Healthcare Operations Foundation — ACTIVE — P1
↓
HC-NEXT-01 Hospital / Doctor — CLOSED / ACCEPTED en el baseline canónico `fbf29b6`
↓
Requirements V1 — COMPLETE / ACCEPTED
↓
HC-NEXT-03A Equipment Assignment Domain Discovery — COMPLETE / DOCUMENTED
↓
HC-NEXT-03B Equipment Assignment Technical Design — COMPLETE / APPROVED
↓
HC-NEXT-03C1 Equipment Assignment Persistence / Migration — COMPLETE / MERGED
↓
HC-NEXT-03C2 Assignment Backend Base — COMPLETE / MERGED
↓
HC-NEXT-03C3 Availability / Conflict Review / Concurrency — COMPLETE / MERGED
↓
HC-NEXT-03C4 Replace / Release / Parent Integrations — COMPLETE / MERGED — PARENT INTEGRATIONS COMPLETE — HC-LOCK-04 FINAL CLOSED / ACCEPTED IN main@be73bc4
↓
HC-NEXT-03C5-A Contract Alignment & Safe PostgreSQL Harness — COMPLETE / MERGED — PR #36 + #37 — main@5ec9f67
↓
HC-NEXT-03C6-A Case Equipment Assignments Read-only View — COMPLETE / MERGED — PR #38 — main@8a67d5a — Actual 25-sep-2026
↓
HC-NEXT-03C6-B Create Assignment UI — COMPLETE / MERGED — PR #40 — main@4805128 — Actual 25-sep-2026
↓
HC-NEXT-03C6-C Release Assignment UI — COMPLETE / MERGED — PR #42 — main@9bade4d — Actual 25-sep-2026
↓
HC-NEXT-03C6-D Replace Assignment UI — NEXT FUNCTIONAL CANDIDATE / NOT READY
↓
HC-NEXT-03C5-B Integrated Backend Validation — PLANNED — B0 NOT READY; B1–B3 NOT IMPLEMENTED
↓
HC-NEXT-03C5-COVERAGE — CONTRACT PENDING / REQUIRED BEFORE C6 SLICES THAT DEPEND ON COVERAGE

Advanced Inventory permanece DESIGNED / APPROVED / NOT IMPLEMENTED como target
P2 y no es el milestone principal actual. SalesOrder + Delivery, Commercial
Returns evolution, FEFO, Expiration, Audit, Permission-Based RBAC, Data Import,
Advanced Inventory y Billing / CFDI continúan como evoluciones futuras; no
mantienen ERP Core V1 artificialmente abierto. No se afirma despliegue de
staging o producción.
