# Changelog — Zaping

**Documento:** Historial consolidado del proyecto
**Versión:** 1.0.0
**Estado:** Activo
**Última actualización:** 2026-08-19
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento conserva la historia relevante de evolución de Zaping.

Su función es responder:

```text
¿Qué se construyó?
¿Qué cambió?
¿Qué decisiones anteriores fueron sustituidas?
¿Cuándo evolucionó la arquitectura?
```

El Changelog registra hechos históricos.

No representa:

```text
trabajo actual
```

ni:

```text
planes futuros
```

Esas responsabilidades pertenecen respectivamente a:

```text
PROJECT_BOARD.md
ROADMAP.md
```

---

# 2. Regla documental

```text
CHANGELOG
→ lo que ocurrió

PROJECT_BOARD
→ lo que estamos haciendo

ROADMAP
→ lo que queremos hacer
```

Una funcionalidad completada debe dejar de vivir únicamente en un Sprint o Backlog y pasar a formar parte de la historia consolidada del proyecto.

---

# 3. Estado actual — Unreleased

## Documentation Architecture Refactor

**Estado:** En progreso
**Inicio:** 2026-08

Se inició una reconstrucción completa de la documentación oficial de Zaping para eliminar:

* documentos vacíos;
* duplicados;
* fuentes contradictorias;
* arquitectura obsoleta;
* documentación fragmentada por Sprint;
* reglas históricas presentadas como vigentes.

Se adoptó el principio:

> **Una verdad → un documento responsable.**

---

## Product Documentation

Se consolidaron:

```text
product/PRODUCT_VISION.md
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md
```

El producto quedó estructurado conceptualmente como:

```text
Zaping Platform
├── Zaping ERP Core
├── Zaping Healthcare
├── Zaping Radar
└── Zaping AI
```

Healthcare se mantiene como la primera vertical especializada.

---

## Architecture Documentation

Se consolidó:

```text
architecture/ARCHITECTURE.md
```

y la arquitectura C4:

```text
C1 — System Context
C2 — Containers
C3 — Components
```

Se retiraron documentos arquitectónicos vacíos o redundantes.

---

## ADR Consolidation

Los ADR fueron reorganizados bajo:

```text
docs/architecture/adr/
```

Se reconstruyeron decisiones históricas inconsistentes y se añadieron decisiones necesarias para la arquitectura actual.

El catálogo vigente comprende:

```text
ADR-001 Multi-Tenant
ADR-002 Inventory Movements
ADR-003 Global Soft Delete — SUPERSEDED
ADR-004 UUID Strategy
ADR-005 Layered Architecture
ADR-006 API First
ADR-007 RBAC
ADR-008 Documentation First
ADR-009 Modular Monolith
ADR-010 Quote → Sale — SUPERSEDED
ADR-011 SalesOrder + Delivery
ADR-012 Entity Lifecycle Strategy
ADR-013 Inventory Custody & Case Logistics
```

---

## Engineering Documentation

Se consolidaron:

```text
ENGINEERING_GUIDE.md
DEVELOPMENT_WORKFLOW.md
QUALITY_STANDARDS.md
SECURITY_PRINCIPLES.md
API_GUIDELINES.md
```

Se corrigió la separación entre:

```text
Quality
```

y:

```text
Security
```

que anteriormente se encontraban duplicadas.

---

## UX Documentation

Se consolidaron:

```text
ux/DESIGN_SYSTEM.md
ux/BUSINESS_COMPONENTS.md
product/ZAPING_WAY.md
```

Se formalizó como principio de experiencia:

> **Simple por defecto. Poderoso cuando se necesita.**

Y:

```text
Data
↓
Context
↓
Action
```

como dirección general de UX.

---

## ERP Core Documentation

La documentación funcional fue reorganizada bajo:

```text
docs/modules/erp/
```

con fuentes únicas para:

```text
AUDIT
COMPANIES
CUSTOMERS
DASHBOARD
IDENTITY_ACCESS
INVENTORY
PRODUCTS
PURCHASES
QUOTES
RETURNS
SALES
SUPPLIERS
```

Se eliminaron las antiguas carpetas y documentos fragmentados de Purchases, Inventory y Returns.

---

# 4. 2026-07 — Purchase Receipts & Advanced Inventory

## Estado

Implementado y validado en el proyecto.

---

## Objetivo

Separar correctamente:

```text
lo ordenado
```

de:

```text
lo físicamente recibido
```

y preparar Inventory para trazabilidad avanzada de suministros médicos.

---

## PurchaseReceipt

Se introdujo el concepto:

```text
Purchase
↓
PurchaseReceipt
```

para registrar lo que realmente llega al almacén.

---

## Nueva regla de inventario

La arquitectura cambió de:

```text
Purchase approved
↓
Inventory IN
```

a:

```text
Purchase confirmed
↓
no inventory effect

PurchaseReceipt registered
↓
Inventory IN
```

Esta decisión reemplaza oficialmente el comportamiento implementado durante etapas anteriores.

---

## Partial Receipts

Purchases evolucionó para soportar:

```text
CONFIRMED
↓
PARTIALLY_RECEIVED
↓
RECEIVED
```

permitiendo múltiples recepciones sobre una misma compra.

---

## Validación de cantidades

Se estableció:

```text
quantityReceived
<=
quantityPending
```

y se bloqueó la recepción por encima de lo ordenado.

---

## InventoryBatch

Se incorporó soporte para existencia por lote.

Conceptualmente:

```text
Product
↓
InventoryBatch
```

con información como:

```text
lotNumber
expirationDate
availableQuantity
unitCost
```

según la implementación vigente.

---

## Captura de lote

Se formalizó que:

```text
Purchase
→ no conoce necesariamente lote/caducidad
```

mientras:

```text
PurchaseReceipt
→ conoce lo realmente entregado
```

Por tanto lote y caducidad se capturan durante la recepción.

---

## Inventory Integration

Registrar una recepción válida puede producir dentro de una transacción:

```text
PurchaseReceipt
+
PurchaseReceiptItems
+
InventoryBatch
+
InventoryMovement IN
+
Stock update
+
Purchase status update
```

---

## Validaciones adicionales

Se incorporaron reglas como:

```text
expirationDate
→ requires lotNumber
```

y protección contra fechas de caducidad inválidas respecto de la recepción.

---

## Frontend

Se implementó flujo de recepción con:

* cantidades ordenadas;
* cantidades recibidas;
* cantidades pendientes;
* captura de lote;
* captura de caducidad;
* notas;
* validaciones;
* actualización posterior del listado.

---

## QA

La funcionalidad fue validada mediante:

* tests;
* lint;
* build;
* pruebas manuales;
* validaciones transaccionales.

---

# 5. Sprint 10 — Advanced Inventory

## Estado histórico

Originalmente planeado.

Gran parte de la arquitectura planteada durante este Sprint posteriormente fue implementada mediante Purchase Receipts e InventoryBatch.

---

## Objetivo original

Fortalecer Inventory para conocer:

```text
qué producto existe
cuánto existe
de qué lote proviene
cuándo caduca
de qué compra entró
qué movimientos afectaron el stock
```

---

## Decisiones que permanecen vigentes

Se establecieron correctamente estas fronteras:

```text
Product
→ catálogo maestro
```

```text
InventoryBatch
→ existencia por lote
```

```text
Purchase
→ qué se pidió
```

```text
PurchaseReceipt
→ qué llegó
```

```text
InventoryMovement
→ qué modificó el inventario
```

---

## Decisiones que evolucionaron

El Sprint planteaba todavía como trabajo futuro varias capacidades.

Posteriormente:

```text
PurchaseReceipt
InventoryBatch
partial receipts
lot capture
expiration capture
```

avanzaron a implementación.

Otras capacidades continúan como evolución:

```text
FEFO
serial tracking
automatic expired-stock blocking
QR / barcode workflows
advanced audit
multi-warehouse
```

---

# 6. Sprint 09 — Purchases & Business Components

## Estado

Completado.

---

## Objetivo

Fortalecer la base frontend mediante componentes reutilizables y completar el primer flujo funcional de Purchases.

---

## Business Components

Durante esta etapa se reportaron como completados componentes reutilizables relacionados con:

```text
StatusBadge
MoneyInput
SupplierSelector
ProductSelector
```

La numeración histórica de los Business Components posteriormente fue reorganizada durante la consolidación documental.

La fuente vigente es:

```text
ux/BUSINESS_COMPONENTS.md
```

---

## Purchases

Se completaron capacidades como:

```text
Create Purchase
Edit Draft Purchase
Approve Purchase
Purchase Detail
Purchase PDF
Inventory traceability
```

---

## Calidad

El cierre registró:

```text
Frontend tests
Frontend lint
Frontend build
Backend build
Purchases ESLint
Inventory ESLint
Manual endpoint validation
Manual UI validation
```

como aprobados.

---

## Arquitectura histórica importante

En Sprint 09 el flujo implementado era:

```text
Create Purchase
↓
Edit Draft
↓
Approve Purchase
↓
Inventory IN
↓
InventoryMovement IN
```

Este comportamiento es un **hecho histórico**.

No representa la arquitectura vigente.

---

## Superseded

Posteriormente fue reemplazado por:

```text
Create Purchase
↓
Confirm Purchase
↓
Receive Merchandise
↓
PurchaseReceipt
↓
Inventory IN
```

La fuente vigente de esta regla es:

```text
modules/erp/PURCHASES.md
modules/erp/INVENTORY.md
ADR-002
```

---

# 7. Foundation v1.0

## Estado

Released.

## Fecha

2026-07.

---

## Propósito

Foundation v1.0 estableció la primera línea base formal de:

```text
Product
Architecture
Engineering
Security
Quality
Documentation
ADR
```

para Zaping.

La release no estuvo enfocada principalmente en agregar nueva funcionalidad empresarial, sino en establecer una base de ingeniería sostenible.

---

## Entregables originales

Incluyó la formalización inicial de:

### Product

```text
Vision
Product Requirements
```

### Engineering

```text
Software Design
Engineering Guide
Development Workflow
Quality Standards
Security Principles
```

### Architecture

```text
Architecture Overview
C4
ADR Framework
Foundation ADRs
```

### Documentation

```text
Glossary
Templates
API Documentation Framework
```

---

## Principios establecidos

La Foundation formalizó principios como:

```text
API First
Multi-Tenant
Layered Architecture
Modular Monolith
Documentation First
Security by Design
Business Driven Development
```

Estos principios continúan formando la base arquitectónica de Zaping.

---

## Evolución posterior

La documentación de Foundation fue posteriormente consolidada y corregida.

Algunas decisiones iniciales cambiaron.

Ejemplos importantes:

```text
Global Soft Delete
→ superseded by Entity Lifecycle Strategy
```

```text
Quote → Sale
→ superseded by SalesOrder + Delivery
```

y:

```text
Purchase Approval → Inventory
→ superseded by PurchaseReceipt → Inventory
```

---

# 8. Primer ERP Core

Antes de la reconstrucción documental de 2026-08, Zaping ya había alcanzado una base funcional con módulos como:

```text
Companies
Customers
Products
Suppliers
Inventory
Purchases
Quotes
Sales
Dashboard
Authentication
```

con PostgreSQL, Prisma, NestJS y Next.js como base tecnológica.

---

# 9. Principales cambios arquitectónicos acumulados

Durante la evolución del proyecto se formalizaron separaciones importantes.

---

## Purchases

Antes:

```text
Purchase
→ Inventory
```

Ahora:

```text
Purchase
→ PurchaseReceipt
→ Inventory
```

---

## Sales

Antes:

```text
Quote
→ Sale
→ Inventory OUT
```

Arquitectura objetivo:

```text
Quote
↓ optional
SalesOrder
↓
Delivery
↓
Inventory OUT
```

---

## Entity Lifecycle

Antes se proponía:

```text
global deletedAt
```

para múltiples recursos.

Ahora:

```text
Master Data
→ active / inactive

Transactional Documents
→ lifecycle states

Historical Ledgers
→ immutable

Temporary Data
→ delete / expire when appropriate
```

---

## Healthcare Inventory

Se formalizó:

```text
CaseDispatch
≠
commercial Delivery
```

y:

```text
CaseDispatch
≠
definitive Inventory OUT
```

para permitir custodia temporal y reconciliación posterior.

---

# 10. Correcciones documentales históricas

Durante la consolidación de 2026-08 se detectaron y corrigieron inconsistencias como:

* documentación duplicada;
* archivos vacíos;
* nombres incorrectos;
* ADR duplicados;
* ADR con títulos incorrectos;
* documentación API desactualizada;
* `QUALITY_STANDARS` mal escrito;
* documentación de Soft Delete incompatible con el modelo real;
* reglas antiguas de Purchase → Inventory;
* documentación de Sales basada únicamente en Sale;
* documentación de Returns dependiente de la frontera legacy;
* templates con metadata copiada de Inventory.

---

# 11. Versionado

Las versiones históricas de documentación no deben interpretarse automáticamente como versiones comerciales del producto.

Ejemplo:

```text
Foundation v1.0
```

representa una línea base de arquitectura/documentación.

La estrategia formal de releases comerciales deberá mantenerse en `ROADMAP.md` y en futuros releases reales.

---

# 12. Regla de actualización

Cuando una funcionalidad sea completada:

```text
PROJECT_BOARD
↓
Completed
↓
CHANGELOG
```

Cuando una decisión arquitectónica cambie:

```text
New ADR
↓
Old ADR superseded
↓
CHANGELOG records transition
```

Cuando un plan deje de ser futuro:

```text
ROADMAP
↓
implemented
↓
CHANGELOG
```

---

# 13. Fuente de verdad

```text
CHANGELOG.md
→ historia consolidada

PROJECT_BOARD.md
→ estado actual

ROADMAP.md
→ dirección futura

ADR
→ decisiones arquitectónicas

modules/
→ comportamiento funcional vigente
```

---

# 14. Principio final

El Changelog debe conservar la historia sin convertir decisiones antiguas en reglas actuales.

Por tanto:

> **Registrar que Zaping funcionó de una manera en el pasado no significa que esa arquitectura siga vigente hoy.**

La historia debe conservarse.

La fuente vigente debe mantenerse clara.
