Documentación de Zaping

Producto: Zaping
Versión del índice: 2.2.0
Última actualización: 2026-08-27
Estado: H8A DOCUMENTATION SYNCHRONIZATION — IN PROGRESS

1. Propósito

Esta carpeta contiene la documentación oficial del ecosistema Zaping.

La documentación debe permitir comprender:

qué es Zaping;

qué problemas resuelve;

cómo está estructurado;

cómo funcionan sus dominios;

qué decisiones arquitectónicas se han tomado;

cuáles son los estándares de ingeniería;

cómo debe funcionar la experiencia de usuario;

qué se está desarrollando actualmente;

y hacia dónde evoluciona el producto.

La documentación debe representar el comportamiento real del sistema y distinguir con claridad entre:

CURRENT

TARGET

FUTURE

TECHNICAL DEBT

ARCHITECTURAL CANDIDATE

2. Principio documental

Zaping utiliza el principio:

Una verdad → una fuente responsable.

No deben existir varios documentos activos definiendo versiones diferentes de la misma regla.

Ejemplos:

Visión del producto
→ PRODUCT_VISION.md

Requerimientos
→ PRODUCT_REQUIREMENTS.md

Arquitectura
→ ARCHITECTURE.md

Decisiones arquitectónicas
→ ADR

Reglas de negocio específicas
→ documentación del módulo

Experiencia de usuario
→ ZAPING_WAY.md / ERP_UI_UX.md según alcance

Estado actual
→ PROJECT_BOARD.md

Dirección futura
→ ROADMAP.md

Cambios realizados
→ CHANGELOG.md

2.1 Estados de implementación y documentación

La documentación distingue las siguientes categorías:

CURRENT / IMPLEMENTED
→ existe en código y persistencia cuando corresponde

VALIDATED
→ cuenta con evidencia automatizada o QA registrada

TECHNICAL DEBT
→ existe una limitación conocida pendiente

TARGET
→ dirección funcional o técnica aprobada, todavía no implementada

FUTURE
→ capacidad posterior o todavía no priorizada para implementación

ARCHITECTURAL CANDIDATE
→ solución técnica posible que requiere ADR o diseño antes de aprobarse

No todo lo no implementado debe etiquetarse simplemente como FUTURE.

2.2 Mapa de fuentes CURRENT

Fuentes principales:

ERP Core frontend y navegación
→ modules/erp/ERP_UI_UX.md

Recepciones e idempotencia
→ modules/erp/PURCHASE_RECEIPTS.md

Equipment identity / lifecycle / condition
→ modules/erp/EQUIPMENT.md

Inventory CURRENT
→ modules/erp/INVENTORY.md

Advanced Inventory target design
→ modules/erp/ADVANCED_INVENTORY.md

Sales CURRENT
→ modules/erp/SALES.md

Quotes CURRENT
→ modules/erp/QUOTES.md

Estado de ejecución
→ project/PROJECT_BOARD.md

Healthcare boundaries
→ modules/healthcare/HEALTHCARE.md

Healthcare cross-domain model
→ modules/healthcare/DOMAIN_MODEL.md

Healthcare Case Foundation
→ modules/healthcare/CASES.md

2.3 Healthcare status

Actualmente:

HealthcareCase Foundation
✅ CURRENT / IMPLEMENTED / VALIDATED

También existe en ERP Core:

EquipmentAsset
✅ CURRENT

EquipmentInspection
✅ CURRENT

Healthcare operational workflows permanecen TARGET:

Hospital / Doctor

Requirements

Equipment Assignment

Case Availability

Dispatch / Custody

Return

CaseKit / Maletín

Calendar

Case 360

Capacidades posteriores permanecen FUTURE:

Opportunity

Payer / Insurance

KitTemplate

advanced Mobile / offline

QR

Notifications

Analytics

AI

2.4 Production readiness boundary

Debe mantenerse:

functional validation
≠
production readiness

La preparación preproducción depende también de cerrar blockers de seguridad y arquitectura de sesión.

Las fuentes responsables son:

engineering/SECURITY_PRINCIPLES.md

project/PROJECT_BOARD.md

Entre los temas críticos deben permanecer visibles:

protected-route / session architecture

authorization review

tenant isolation regression

authentication abuse protection / rate limiting

production secrets / configuration

real password-recovery email delivery/configuration

dependency/security maintenance before RC

Password Security V1 está implementado; estos temas son gates independientes y
no deben presentarse como parte de un recovery inseguro pendiente.

3. Idioma oficial

La documentación oficial de Zaping se mantiene en español.

Se conservan en inglés cuando resulte apropiado:

nombres de clases;

entidades de código;

endpoints;

nombres de tecnologías;

patrones reconocidos;

términos técnicos;

conceptos cuyo nombre oficial se utilice directamente en implementación.

Ejemplos:

Sale

SalesOrder

PurchaseReceipt

HealthcareCase

CaseKit

DTO

JWT

RBAC

Soft Delete

API First

4. Estructura documental objetivo

La estructura oficial evoluciona hacia:

docs/
│
├── README.md
├── GLOSSARY.md
│
├── product/
│   ├── PRODUCT_VISION.md
│   ├── PRODUCT_REQUIREMENTS.md
│   └── ZAPING_WAY.md
│
├── architecture/
│   ├── ARCHITECTURE.md
│   │
│   ├── c4/
│   │   ├── C1-SystemContext.md
│   │   ├── C2-Containers.md
│   │   └── C3-Components.md
│   │
│   └── adr/
│       ├── README.md
│       └── ADR-XXX-...
│
├── engineering/
│   ├── ENGINEERING_GUIDE.md
│   ├── DEVELOPMENT_WORKFLOW.md
│   ├── QUALITY_STANDARDS.md
│   ├── SECURITY_PRINCIPLES.md
│   └── API_GUIDELINES.md
│
├── ux/
│   ├── DESIGN_SYSTEM.md
│   ├── BUSINESS_COMPONENTS.md
│   ├── UX_PRINCIPLES.md
│   ├── UX_DECISIONS.md
│   └── UX_IMPROVEMENT_BACKLOG.md
│
├── modules/
│   ├── erp/
│   ├── healthcare/
│   └── radar/
│
├── project/
│   ├── ROADMAP.md
│   ├── PROJECT_BOARD.md
│   └── CHANGELOG.md
│
└── templates/
    ├── ADR_TEMPLATE.md
    ├── FEATURE_TEMPLATE.md
    ├── MODULE_TEMPLATE.md
    ├── POSTMORTEM_TEMPLATE.md
    └── RELEASE_TEMPLATE.md

Las carpetas deben crearse únicamente cuando exista documentación real que guardar en ellas.

No deben mantenerse estructuras vacías únicamente para anticipar funcionalidades futuras.

5. Estado de consolidación

La documentación se encuentra en la fase final de H8A Documentation Synchronization.

5.1 Producto

Consolidado

product/

├── PRODUCT_VISION.md
└── PRODUCT_REQUIREMENTS.md

Pendiente / por consolidar

product/

└── ZAPING_WAY.md

ZAPING_WAY.md permanece como fuente objetivo para principios generales de experiencia de producto cuando su consolidación formal se complete.

5.2 Glosario

Consolidado

GLOSSARY.md

Debe mantenerse sincronizado con:

ERP Core

Healthcare

architecture

UX

security

inventory

sales

purchases

5.3 Ingeniería

Consolidado / vigente

engineering/

├── ENGINEERING_GUIDE.md
├── DEVELOPMENT_WORKFLOW.md
├── QUALITY_STANDARDS.md
└── SECURITY_PRINCIPLES.md

API Guidelines

API_GUIDELINES.md debe considerarse una fuente de ingeniería cuando exista y haya sido consolidado formalmente.

Este índice no debe asumir su ausencia ni crear una versión duplicada sin verificar primero el repositorio.

5.4 Arquitectura

Core architecture consolidated

architecture/

└── ARCHITECTURE.md

ARCHITECTURE.md fue sincronizado durante H8A.

Los ADR continúan evolucionando por decisión arquitectónica.

Debe mantenerse:

architecture/adr/
→ ongoing architectural history

No toda la carpeta architecture/ debe considerarse “pendiente” solamente porque existan ADR o C4 futuros.

5.5 UX y Design System

La documentación UX dedicada está consolidada para la baseline UX-01.

Fuentes relevantes:

modules/erp/ERP_UI_UX.md
→ CURRENT ERP UI/UX state

product/ZAPING_WAY.md

ux/DESIGN_SYSTEM.md

ux/BUSINESS_COMPONENTS.md

ux/UX_PRINCIPLES.md

ux/UX_DECISIONS.md

ux/UX_IMPROVEMENT_BACKLOG.md

No deben crearse documentos vacíos únicamente para completar una estructura teórica.

5.6 ERP Core modules

Primary module documentation consolidated during H8A

Entre las fuentes principales se encuentran:

modules/erp/

├── CUSTOMERS.md
├── SUPPLIERS.md
├── PRODUCTS.md
├── PURCHASES.md
├── PURCHASE_RECEIPTS.md
├── INVENTORY.md
├── ADVANCED_INVENTORY.md
├── EQUIPMENT.md
├── QUOTES.md
├── SALES.md
├── DASHBOARD.md
├── IDENTITY_ACCESS.md
└── ERP_UI_UX.md

Cada documento debe mantener claramente:

CURRENT

VALIDATED behavior

TECHNICAL DEBT

TARGET / FUTURE

sin presentar arquitectura futura como comportamiento actual.

5.7 Healthcare

Root Healthcare documentation consolidated during H8A

modules/healthcare/

├── HEALTHCARE.md
├── DOMAIN_MODEL.md
└── CASES.md

Estado:

HEALTHCARE.md
✅ consolidated

DOMAIN_MODEL.md
✅ consolidated

CASES.md
✅ consolidated

Estos documentos distinguen:

CURRENT
→ HealthcareCase Foundation
→ Equipment Core reuse

TARGET
→ operational Healthcare workflows

FUTURE
→ CRM / payer / advanced capabilities

Los documentos especializados Healthcare futuros deberán mantenerse alineados con estas fuentes.

5.8 Radar

La documentación de Radar se mantiene separada del ERP Core y Healthcare.

No debe mezclarse su roadmap con el cierre ERP Core V1.

5.9 Estado del proyecto

Consolidado

project/

├── ROADMAP.md
├── PROJECT_BOARD.md
└── CHANGELOG.md

Responsabilidad:

PROJECT_BOARD.md
→ trabajo activo / blockers / debt

ROADMAP.md
→ secuencia futura

CHANGELOG.md
→ cambios ya completados

6. Estado actual del proyecto

Secuencia vigente:

H7
ERP Functional Normalization
✅ CLOSED

↓

H8A
Documentation Synchronization
→ CURRENT

↓

H8B
Full Automated Regression / Technical Health
→ NEXT

↓

UX-B.6
Full ERP End-to-End QA
→ AFTER H8

↓

ERP Core V1 Closure

↓

Healthcare specialization

La existencia de documentación Healthcare TARGET no autoriza a iniciar nuevos modelos Prisma antes del cierre correspondiente del ERP Core.

7. Documentos principales

PRODUCT_VISION.md

Responde:

¿Qué queremos que Zaping llegue a ser?

Contiene:

mission

vision

positioning

ERP Core

Zaping Healthcare

Zaping Radar

ecosystem evolution

PRODUCT_REQUIREMENTS.md

Responde:

¿Qué debe ser capaz de hacer Zaping?

Contiene:

requirements

actors

cross-cutting rules

priorities

success criteria

scope

constraints

ZAPING_WAY.md

Responde:

¿Cómo debe funcionar y sentirse Zaping?

Cuando esté consolidado formalmente deberá definir:

UX

navigation

forms

tables

actions

workspaces

360 views

Healthcare experience

interaction philosophy

ARCHITECTURE.md

Responde:

¿Cómo está estructurado técnicamente Zaping?

Contiene:

architectural style

layers

domains

boundaries

frontend

backend

persistence

multi-tenancy

technical evolution

ADR

Responde:

¿Por qué tomamos una decisión arquitectónica determinada?

Los ADR preservan historia.

Una decisión reemplazada debe marcarse:

SUPERSEDED

y no eliminarse.

ENGINEERING_GUIDE.md

Responde:

¿Cómo desarrollamos software en Zaping?

Incluye:

engineering principles

TypeScript

frontend

backend

Prisma

testing

maintainability

Definition of Done

DEVELOPMENT_WORKFLOW.md

Responde:

¿Qué proceso seguimos para desarrollar un cambio?

Define conceptualmente:

Idea
↓
Analysis
↓
Design
↓
Implementation
↓
Tests
↓
Documentation
↓
Release

El proceso es proporcional al riesgo.

QUALITY_STANDARDS.md

Responde:

¿Qué nivel mínimo de calidad debe cumplir un cambio?

Incluye Quality Gates para:

business rules

architecture

backend

frontend

database

security

multi-tenancy

inventory

tests

documentation

SECURITY_PRINCIPLES.md

Responde:

¿Cómo protegemos Zaping y sus datos?

Incluye:

authentication

JWT

authorization

RBAC

multi-tenancy

secrets

sensitive data

Healthcare

logging

audit

infrastructure

preproduction security

GLOSSARY.md

Responde:

¿Qué significa cada término dentro de Zaping?

Debe mantenerse sincronizado con el lenguaje real del producto y arquitectura.

ERP_UI_UX.md

Responde:

¿Cuál es el estado real de experiencia ERP Core?

Debe distinguir:

CURRENT frontend behavior

shared UI patterns

known UX debt

H7 normalization

H8 / B6 quality gates

HEALTHCARE.md

Responde:

¿Cuál es la frontera general de Zaping Healthcare?

Distingue:

CURRENT

TARGET

FUTURE

y protege la separación:

ERP Core
vs
Healthcare specialized workflow

DOMAIN_MODEL.md

Responde:

¿Cómo se relacionan los conceptos Healthcare y quién posee cada verdad?

Define:

domain ownership

entity boundaries

derived concepts

architectural candidates

CASES.md

Responde:

¿Qué es HealthcareCase y qué comportamiento existe hoy?

Es la fuente principal para:

HealthcareCase Foundation

CURRENT lifecycle

Case API

planning

cancellation

technical debt

PROJECT_BOARD.md

Responde:

¿En qué estamos trabajando actualmente?

No debe utilizarse como historial permanente.

ROADMAP.md

Responde:

¿Qué construiremos después y en qué orden?

CHANGELOG.md

Responde:

¿Qué cambios ya fueron completados?

8. Jerarquía de fuentes

Cuando exista una aparente contradicción, debe determinarse cuál documento es responsable del tema.

Ejemplo:

Inventory-specific rule

→ PRODUCT_REQUIREMENTS.md
+
modules/erp/INVENTORY.md
+
applicable ADR

No debe resolverse mediante una nota histórica de Sprint.

El código implementado debe compararse con la documentación aprobada.

Si difieren, no debe asumirse automáticamente que uno de los dos es correcto.

Debe revisarse:

intended decision

implemented behavior

tests

current documentation

y sincronizarlos.

9. Fuente responsable por dominio

Mapa recomendado:

Product vision
→ PRODUCT_VISION.md

Product requirements
→ PRODUCT_REQUIREMENTS.md

Architecture
→ ARCHITECTURE.md + ADR

Security
→ SECURITY_PRINCIPLES.md

ERP frontend / navigation
→ ERP_UI_UX.md

ERP domain behavior
→ module docs

Healthcare boundaries
→ HEALTHCARE.md

Healthcare domain model
→ DOMAIN_MODEL.md

HealthcareCase CURRENT
→ CASES.md

Active work / blockers
→ PROJECT_BOARD.md

Sequence / priorities
→ ROADMAP.md

Completed changes
→ CHANGELOG.md

10. Documentación histórica

Git es la principal fuente de historia técnica de archivos eliminados o modificados.

Por esta razón no es necesario conservar indefinidamente:

duplicate documents

temporary specifications

old sprint plans

empty documentation

feature documents already fully consolidated

Los ADR son una excepción importante porque preservan decisiones arquitectónicas y sus razones.

11. Estados documentales

Cuando sea necesario se utilizarán estados como:

Draft

Documento en desarrollo.

Proposed

Propuesta todavía no aprobada.

Approved

Documento vigente y aprobado.

Deprecated

Documento todavía disponible pero que ya no debe utilizarse para nuevas decisiones.

Superseded

Documento o decisión reemplazada por otra.

12. Versiones

La versión de un documento representa cambios significativos de contenido.

No es necesario incrementar versión por:

typos

formatting

minor wording corrections

sin impacto conceptual.

Sí puede incrementarse por:

business-rule changes

scope changes

source-of-truth changes

architecture changes

CURRENT / TARGET classification changes

13. Convenciones de nombres

La convención dominante de documentación principal y modular es:

UPPER_SNAKE_CASE.md

Ejemplos:

PRODUCT_VISION.md

PRODUCT_REQUIREMENTS.md

ENGINEERING_GUIDE.md

PURCHASE_RECEIPTS.md

ERP_UI_UX.md

DOMAIN_MODEL.md

Los ADR utilizan:

ADR-XXX-descripcion.md

Ejemplo:

ADR-001-multi-tenant.md

Evitar:

spaces

ambiguous names

typos

mixed naming conventions within the same folder

14. Reglas de mantenimiento

Al modificar una funcionalidad relevante:

identificar su fuente documental;

actualizar esa fuente;

actualizar ADR si cambia una decisión arquitectónica;

actualizar PROJECT_BOARD si cambia trabajo activo o deuda;

actualizar ROADMAP si cambia el orden futuro;

actualizar CHANGELOG cuando corresponda;

evitar duplicar la misma información;

revisar que CURRENT / TARGET / FUTURE continúen siendo correctos.

15. Documentation First

Documentation First no significa:

crear más Markdown.

Significa:

comprender y registrar correctamente las decisiones importantes antes de implementarlas.

Un documento actualizado es preferible a múltiples documentos contradictorios.

16. Regla de no sobre-documentar

No toda idea necesita:

new Markdown file

new Prisma model

new ADR

Debe utilizarse el nivel documental proporcional a:

risk

scope

architectural impact

business importance

17. Architectural candidates

Cuando una necesidad del dominio sugiera una solución técnica todavía no aprobada, debe documentarse como:

ARCHITECTURAL CANDIDATE

Ejemplo Healthcare:

InventoryLocation

InventoryPosition

internal transfer semantics

pueden ser candidatos para resolver:

physical positioning

custody

availability

pero requieren decisión arquitectónica antes de implementarse.

18. Filosofía de la estructura

La documentación debe ser:

sufficient

clear

navigable

maintainable

consistent

current

useful

No se mide su calidad por la cantidad de archivos.

Se mide por la capacidad de responder correctamente preguntas sobre el producto y el sistema.

19. Cierre H8A

H8A puede cerrarse únicamente después de completar:

final cross-document synchronization

security blocker synchronization

PROJECT_BOARD final sync

ROADMAP / README wording review where needed

Markdown consistency

git status --short

git diff --check

credential / .env backup review

No debe realizarse commit final de H8A antes de esa validación.

20. Después de H8A

El siguiente gate es:

H8B
Full Automated Regression / Technical Health

Debe validar:

backend tests

frontend tests

builds

lints

Prisma validate

migration status

git health

Después:

UX-B.6
Full ERP End-to-End QA

21. Regla final

La documentación de Zaping debe permitir que una persona pueda comprender:

Qué es Zaping
↓
Qué debe hacer
↓
Cómo está construido
↓
Cómo funciona cada dominio
↓
Cómo se desarrolla
↓
Cómo se protege
↓
Cómo se usa
↓
Qué existe hoy
↓
Qué es TARGET
↓
Qué es FUTURE
↓
Qué se está construyendo
↓
Qué viene después

sin depender de conversaciones antiguas ni documentos contradictorios.

Ese es el objetivo de esta estructura documental.
