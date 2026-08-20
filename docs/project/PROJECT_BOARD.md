# Project Board — Zaping

**Producto:** Zaping Platform
**Estado:** Desarrollo activo
**Fase actual:** Consolidación documental y preparación del ERP Core para evolución comercial
**Última actualización:** 2026-08-20
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento representa el **estado actual del trabajo** en Zaping.

Debe responder:

```text
¿Qué está terminado?
¿Qué estamos haciendo ahora?
¿Qué está pendiente?
¿Qué tiene prioridad?
¿Qué bloquea el siguiente paso?
```

No representa la historia completa del proyecto.

Para eso existe:

```text
CHANGELOG.md
```

Tampoco representa toda la visión futura.

Para eso existe:

```text
ROADMAP.md
```

---

# 2. Regla documental

```text
PROJECT_BOARD
→ trabajo y estado actual

ROADMAP
→ dirección futura

CHANGELOG
→ trabajo completado e historia
```

Cuando un trabajo termina:

```text
PROJECT_BOARD
↓
Completed
↓
CHANGELOG
```

El Board no debe convertirse en un archivo histórico infinito.

---

# 3. Estado general

```text
Zaping Platform
│
├── ERP Core
│   ├── Base funcional importante implementada
│   ├── Inventario avanzado en evolución
│   ├── Recepciones de compra implementadas
│   ├── Sales legacy funcional
│   ├── Returns parcialmente implementado
│   └── Preparación para comercialización
│
├── Healthcare
│   └── Arquitectura aprobada / documentación funcional pendiente
│
├── Radar
│   └── Concepto aprobado / desarrollo futuro
│
└── AI
    └── Visión futura / no prioridad actual
```

---

# 4. Objetivo actual

La prioridad inmediata es:

> **Terminar de consolidar una única fuente documental coherente para Zaping y utilizarla como base para continuar el desarrollo sin arrastrar arquitectura obsoleta.**

La fase actual incluye:

```text
Documentation cleanup
↓
Project planning cleanup
↓
Templates cleanup
↓
Full documentation audit
↓
Healthcare documentation
↓
Resume product implementation
```

---

# 5. Trabajo actual

## DOC-REF — Documentation Architecture Refactor

**Estado:** 🟢 En progreso
**Prioridad:** P0

### Objetivo

Eliminar:

* documentación vacía;
* duplicados;
* fuentes contradictorias;
* reglas obsoletas;
* carpetas legacy;
* planificación histórica presentada como vigente.

Y establecer:

> **Una verdad → un documento responsable.**

---

## Completado dentro de DOC-REF

### Product

* [x] `PRODUCT_VISION.md`
* [x] `PRODUCT_REQUIREMENTS.md`
* [x] `ZAPING_WAY.md`

---

### Architecture

* [x] `ARCHITECTURE.md`
* [x] C1 System Context
* [x] C2 Containers
* [x] C3 Components
* [x] Consolidación ADR-001 → ADR-013
* [x] Eliminación de ubicación legacy `docs/adr/`

---

### Engineering

* [x] `ENGINEERING_GUIDE.md`
* [x] `DEVELOPMENT_WORKFLOW.md`
* [x] `QUALITY_STANDARDS.md`
* [x] `SECURITY_PRINCIPLES.md`
* [x] `API_GUIDELINES.md`

---

### UX

* [x] `DESIGN_SYSTEM.md`
* [x] `BUSINESS_COMPONENTS.md`

---

### ERP Modules

* [x] `AUDIT.md`
* [x] `COMPANIES.md`
* [x] `IDENTITY_ACCESS.md`
* [x] `CUSTOMERS.md`
* [x] `SUPPLIERS.md`
* [x] `PRODUCTS.md`
* [x] `PURCHASES.md`
* [x] `INVENTORY.md`
* [x] `QUOTES.md`
* [x] `SALES.md`
* [x] `RETURNS.md`
* [x] `DASHBOARD.md`

---

### Project

* [x] Crear `docs/project/`
* [x] Crear `CHANGELOG.md`
* [x] Crear `PROJECT_BOARD.md`
* [x] Crear `ROADMAP.md`
* [x] Eliminar `docs/releases/`
* [x] Eliminar `docs/roadmap/`

---

### Templates

* [x] Corregir `ADR_TEMPLATE.md`
* [x] Revisar `FEATURE_TEMPLATE.md`
* [x] Revisar `MODULE_TEMPLATE.md`
* [x] Corregir `POSTMORTEM_TEMPLATE.md`
* [x] Revisar `RELEASE_TEMPLATE.md`
* [x] Eliminar `API_TEMPLATE.md`

---

### Cierre de refactor

* [ ] Auditoría global de `docs/`
* [ ] Validar links internos
* [ ] Validar nombres de archivos
* [ ] Detectar archivos vacíos
* [ ] Detectar duplicados
* [ ] Buscar referencias a arquitectura obsoleta
* [ ] Validar documentación contra código vigente
* [ ] Commit final del refactor documental

---

# 6. Estado funcional del ERP Core

## Companies

**Estado:** ✅ Implementado / Foundation

Capacidades base:

* Company;
* multi-tenancy;
* configuración base;
* relación con Users y datos empresariales.

Pendiente principalmente:

* UX de configuración más madura;
* auditoría;
* lifecycle SaaS futuro.

---

## Identity & Access

**Estado:** 🟡 Implementado parcialmente

Actualmente:

* [x] User
* [x] JWT Authentication
* [x] Login
* [x] Register
* [x] Reset Password endpoint
* [x] `/auth/me`
* [x] bcrypt
* [x] `JwtAuthGuard`
* [x] `RolesGuard`
* [x] UserRole
* [x] tenant context mediante `companyId`

Arquitectura actual:

```text
User
↓
UserRole
↓
RolesGuard
```

Arquitectura objetivo:

```text
User
↓
Role
↓
Permissions
↓
PermissionsGuard
```

---

## Customers

**Estado:** ✅ Implementado / en evolución UX

Actualmente:

* CRUD;
* tenant isolation;
* CustomerSelector;
* lifecycle mediante `isActive`;
* integración con Quotes/Sales legacy.

Pendiente futuro:

* Customer 360;
* información fiscal;
* múltiples contactos/direcciones;
* Customer Portal.

---

## Suppliers

**Estado:** ✅ Implementado / en evolución UX

Actualmente:

* CRUD;
* tenant isolation;
* contacto;
* dirección;
* notas;
* `isActive`;
* integración con Purchases;
* selector utilizado dentro del flujo de Purchases.

Pendiente futuro:

* Supplier 360;
* catálogo Supplier ↔ Product;
* lead times;
* términos de pago;
* métricas de desempeño.

---

## Products

**Estado:** ✅ Implementado / en evolución

Actualmente:

* CRUD;
* SKU;
* nombre;
* descripción;
* marca;
* Category;
* barcode;
* costo;
* precio;
* stock resumido;
* minStock;
* `isActive`;
* ProductSelector.

Pendiente:

* Product 360;
* configuración formal de tracking;
* importaciones;
* unidades de medida futuras;
* perfil Healthcare cuando corresponda.

---

## Purchases

**Estado:** ✅ Implementado / avanzado

Actualmente:

* creación;
* edición de Draft;
* confirmación/aprobación;
* cancelación;
* detalle;
* PDF;
* PurchaseItems;
* totales;
* PurchaseReceipt;
* recepciones parciales;
* múltiples recepciones;
* lotes;
* caducidad;
* integración transaccional con Inventory.

Regla vigente:

```text
Purchase
→ no Inventory IN

PurchaseReceipt
→ Inventory IN
```

---

## Inventory

**Estado:** ✅ Implementado / avanzado / en evolución

Actualmente:

* Product stock projection;
* InventoryMovement;
* `IN`;
* `OUT`;
* `ADJUSTMENT`;
* balance;
* referencias;
* InventoryBatch;
* lote;
* caducidad;
* cantidades disponibles;
* PurchaseReceipt → Inventory IN;
* bajo stock.

Pendiente:

* FEFO;
* seriales;
* multi-warehouse;
* ubicaciones;
* transferencias;
* conteos físicos;
* disponibilidad avanzada;
* expiración operacional;
* Kardex avanzado donde falte;
* integración futura con Delivery.

---

## Quotes

**Estado:** ✅ Legacy funcional / evolución aprobada

Actualmente:

* Quote;
* QuoteItem;
* Customer;
* Products;
* folio;
* precios;
* subtotal;
* IVA;
* total;
* estados;
* conversión legacy hacia Sale.

Campo legacy:

```text
convertedToSale
```

Arquitectura objetivo:

```text
Quote
↓
SalesOrder
```

sin movimiento de inventario.

---

## Sales

**Estado:** 🟡 Legacy funcional / refactor arquitectónico pendiente

Actualmente:

```text
Sale
↓
CONFIRMED
↓
Inventory OUT
```

La funcionalidad existente debe preservarse hasta realizar una migración segura.

Arquitectura aprobada:

```text
Quote
↓ optional
SalesOrder
↓
Delivery
↓
Inventory OUT
```

Pendiente:

* SalesOrder;
* SalesOrderItem;
* Delivery;
* DeliveryItem;
* entregas parciales;
* cantidades pendientes;
* batch allocation;
* migración de Sale;
* migración de Quote conversion;
* integración con Returns.

---

## Returns

**Estado:** 🟡 Parcialmente implementado

### Completado

```text
RET-001
Diseño funcional
✅
```

```text
RET-002
Diseño Prisma
✅
```

```text
RET-003
Schema + Migration
✅
```

### Pendiente

```text
RET-004
Backend
⏳
```

Posteriormente:

* frontend;
* integración;
* QA;
* evolución de SaleItem → DeliveryItem.

Arquitectura objetivo:

```text
Delivery
↓
Return
↓
Inspection / Disposition
↓
Inventory
```

---

## Dashboard

**Estado:** ✅ Implementado / UX objetivo pendiente

Actualmente incluye información como:

* Customers;
* Suppliers;
* Products;
* Quotes;
* Purchases;
* Sales;
* inventoryValue;
* lowStockProducts;
* recentSales.

Dirección objetivo:

```text
Metric Dashboard
↓
Action Dashboard
```

Pendiente:

* tareas operativas;
* mejores KPIs;
* SalesOrder/Delivery metrics;
* expiraciones;
* actividad;
* UX por rol cuando sea necesario.

---

## Audit

**Estado:** ⏳ Requerimiento aprobado / no implementado

Documentación funcional completada.

Pendiente implementación:

* AuditEvent/AuditLog;
* AuditService;
* persistencia;
* `audit.read`;
* API;
* integración con operaciones críticas;
* UI;
* tests.

---

# 7. Business Components

El antiguo Board estaba centrado casi completamente en esta librería.

Ese milestone ya no representa el estado actual del proyecto.

Estado documental consolidado:

| ID     | Componente       | Estado         |
| ------ | ---------------- | -------------- |
| BC-001 | StatusBadge      | ✅ Implementado |
| BC-002 | MoneyInput       | ✅ Implementado |
| BC-003 | DateInput        | ✅ Implementado |
| BC-005 | CustomerSelector | ✅ Implementado |
| BC-006 | ProductSelector  | ✅ Implementado |

`SupplierSelector` también existe en el flujo actual de Purchases y debe quedar alineado durante la auditoría final de `BUSINESS_COMPONENTS.md`.

La numeración histórica BC-004 no debe reutilizarse automáticamente hasta resolver la inconsistencia documental.

---

# 8. Prioridad P0 — antes de comercialización

Las siguientes tareas tienen impacto directo sobre seguridad, consistencia o capacidad de poner Zaping frente a usuarios reales.

---

## SEC-001 — Sanitizar respuestas de Authentication

**Estado:** ⏳ Pendiente
**Prioridad:** P0

Problema conocido:

```text
AuthService.login()
```

puede devolver el objeto User con:

```text
passwordHash
```

Regla:

```text
API Response
→ never passwordHash
```

Trabajo:

* crear respuesta segura;
* revisar login;
* revisar `/auth/me`;
* revisar endpoints User;
* agregar regression tests.

---

## SEC-002 — Revisar default ADMIN

**Estado:** ⏳ Pendiente
**Prioridad:** P0

El modelo actual contiene:

```text
User.role
@default(ADMIN)
```

Riesgo:

```text
generic user creation
↓
implicit ADMIN
```

Trabajo:

* revisar todos los puntos de creación de User;
* asignar roles explícitamente;
* evaluar eliminar el default;
* agregar pruebas de privilege escalation.

---

## SEC-003 — Validar usuario activo en Authentication

**Estado:** 🔎 Verificar
**Prioridad:** P0

Debe garantizarse:

```text
User.isActive = false
→ no normal application access
```

La implementación vigente debe verificarse antes de marcar esta protección como completa.

---

## SEC-004 — Tenant Isolation Regression Suite

**Estado:** ⏳ Pendiente / parcial
**Prioridad:** P0

Añadir cobertura sistemática para:

```text
Company A user
→ cannot access Company B resource
```

en operaciones críticas.

---

## RET-004 — Returns Backend

**Estado:** ⏳ Pendiente
**Prioridad:** P0

Implementar:

* create;
* read;
* confirm;
* cancel;
* validaciones;
* tenant isolation;
* quantity protection;
* concurrency;
* Inventory integration;
* tests.

Debe evitarse construir nueva infraestructura extensa sobre `SaleItemBatchAllocation`.

---

## QA-CORE — Core Regression Pass

**Estado:** ⏳ Pendiente
**Prioridad:** P0

Antes de release comercial:

* lint;
* build;
* backend tests;
* frontend tests;
* critical flows;
* tenant isolation;
* authorization;
* manual QA.

---

# 9. Prioridad P1 — producto comercializable

## SALES-REF — SalesOrder + Delivery

**Estado:** ⏳ Pendiente
**Prioridad:** P1 / estratégica

Implementar ADR-011.

Incluye:

```text
SalesOrder
SalesOrderItem
Delivery
DeliveryItem
Partial Deliveries
Delivery-based Inventory OUT
```

Además:

* migración legacy Sale;
* Quote conversion;
* Returns integration;
* lote/serie en Delivery;
* idempotencia.

---

## INV-FEFO — FEFO

**Estado:** ⏳ Pendiente
**Prioridad:** P1

Implementar selección/recomendación por:

```text
First Expired
First Out
```

considerando disponibilidad real.

---

## INV-EXP — Expiration Management

**Estado:** ⏳ Pendiente
**Prioridad:** P1

Incluye:

* vencidos;
* próximos a caducar;
* disponibilidad;
* alertas;
* Dashboard.

---

## IMP-001 — Data Import

**Estado:** ⏳ Pendiente
**Prioridad:** P1

Entidades iniciales:

* Customers;
* Suppliers;
* Products;
* Inventory.

Soportar:

```text
CSV
XLSX
```

con:

* mapping;
* preview;
* validation;
* batch import;
* duplicate handling.

---

## UX-360 — 360 Views

**Estado:** ⏳ Pendiente
**Prioridad:** P1

Prioridad inicial:

```text
Product 360
Customer 360
Supplier 360
Purchase 360
SalesOrder 360
```

---

## UX-DASH — Action Dashboard

**Estado:** ⏳ Pendiente
**Prioridad:** P1

Evolucionar hacia:

```text
Attention
↓
Action
↓
KPIs
↓
Trends
```

---

## UX-SEARCH — Global Search

**Estado:** ⏳ Pendiente
**Prioridad:** P1

Búsqueda transversal respetando:

* tenant;
* permissions;
* recursos;
* navegación contextual.

---

## AUTH-PERM — Permission-Based RBAC

**Estado:** ⏳ Target
**Prioridad:** P1

Evolucionar:

```text
UserRole
↓
RolesGuard
```

hacia:

```text
Role
↓
Permissions
↓
PermissionsGuard
```

sin romper autorización actual.

---

## AUD-001 — Audit Foundation

**Estado:** ⏳ Pendiente
**Prioridad:** P1

Primera fase:

* AuditEvent;
* AuditService;
* tenant;
* actor;
* action;
* resource;
* metadata segura;
* append-only;
* critical-event integrations.

---

# 10. Healthcare — siguiente frente funcional

**Estado:** 🟡 Arquitectura aprobada / documentación pendiente
**Prioridad:** P1 estratégica

Healthcare es la primera vertical especializada de Zaping.

Antes de implementar schema nuevo debe completarse su documentación funcional.

Orden propuesto:

```text
HEALTHCARE.md
↓
OPPORTUNITIES.md
↓
CASES.md
↓
CASE_CALENDAR.md
↓
CASE_KITS.md
↓
CASE_LOGISTICS.md
↓
EQUIPMENT.md
```

---

# 11. Healthcare — decisiones ya aprobadas

## Opportunity

Puede existir antes de un Case.

Origen posible:

```text
Doctor request
Technician prospecting
Commercial lead
```

---

## Case

Representa el contexto operacional de un procedimiento.

No debe convertirse en un expediente clínico.

---

## Doctor

```text
Doctor
≠
Customer
```

---

## Hospital

```text
Hospital
≠
Customer
```

---

## Payer

```text
Payer
≠
Customer
```

---

## CaseKit

Debe distinguirse:

```text
KitTemplate
→ configuración reutilizable
```

de:

```text
CaseKit
→ instancia preparada para un Case
```

---

## Custodia

```text
CaseDispatch
→ temporary custody
```

No:

```text
CaseDispatch
→ commercial Inventory OUT
```

---

## Reconciliation

```text
Dispatched
=
Used
+
Returned
+
Unresolved
```

---

## Equipment

Los equipos reutilizables requieren identidad física individual.

No deben modelarse únicamente como:

```text
Product.stock
```

---

# 12. Prioridad P2 — expansión del ERP

Las siguientes capacidades tienen valor, pero no deben desplazar los bloqueos P0/P1.

---

## Multi-Warehouse

Incluye:

* Warehouses;
* Locations;
* transfers;
* balances;
* permissions.

---

## Serial Tracking

Para unidades individualizadas y Equipment.

---

## Inventory Counts

Conteos físicos y ajustes trazables.

---

## Barcode / QR Workflows

Recepción, picking, inventario y Healthcare.

---

## Billing / CFDI

Incluye:

* perfil fiscal;
* Invoice;
* CFDI;
* impuestos;
* Customer fiscal data.

Debe mantener:

```text
Invoice
≠
Delivery
```

---

## Accounts Receivable

Posterior a Billing.

---

## Customer Portal

Consultar:

* Quotes;
* SalesOrders;
* Deliveries;
* Invoices;
* documentos.

---

## Mobile Sales App

Aplicación para vendedores y trabajo en campo.

---

## Notifications

Sistema transversal de notificaciones.

---

# 13. Future — no prioridad actual

Estas capacidades forman parte de la visión pero no deben competir actualmente por recursos del Core.

---

## Zaping Radar

Plataforma de inteligencia para oportunidades y licitaciones.

Dirección inicial:

* Sonora;
* Baja California;
* Baja California Sur;
* Nuevo León;
* Sinaloa;
* sector salud.

---

## Zaping AI

Capacidades futuras:

* recomendaciones;
* consultas naturales;
* análisis;
* automatización;
* detección de anomalías.

Regla:

> AI debe apoyarse en dominios confiables y datos trazables.

No debe construirse antes de estabilizar los workflows base.

---

# 14. Riesgos actuales

## RISK-001 — Documentación vs código

La reconstrucción documental ha identificado snapshots y documentos que no siempre reflejan el código más reciente.

Mitigación:

```text
final documentation audit
+
schema/code validation
```

---

## RISK-002 — Legacy Sales

Sales sigue combinando:

```text
commercial commitment
+
physical fulfillment
```

mientras la arquitectura objetivo ya los separa.

Mitigación:

* no profundizar deuda legacy;
* diseñar migración;
* preservar datos;
* implementar ADR-011.

---

## RISK-003 — Returns sobre SaleItem

Returns está diseñado actualmente sobre `SaleItem`.

Mitigación:

* completar solamente la deuda necesaria;
* evitar nuevas dependencias complejas;
* migrar coordinadamente con Delivery.

---

## RISK-004 — Security debt

Puntos conocidos:

```text
passwordHash exposure
ADMIN default
tenant regression coverage
inactive-user enforcement
```

Deben resolverse antes de producción.

---

## RISK-005 — Product scope growth

Existe riesgo de intentar implementar simultáneamente:

```text
ERP
Healthcare
Radar
AI
Portal
Mobile
Billing
```

Mitigación:

> Priorizar un ERP Core comercializable y una primera vertical Healthcare claramente diferenciada.

---

## RISK-006 — Premature architecture

Evitar introducir antes de necesitarlos:

* microservices;
* queues;
* complex event infrastructure;
* warehouse schema incompleto;
* generic organization model;
* universal permissions framework excesivo.

---

# 15. Definition of Done

Una tarea no debe marcarse `Completed` únicamente porque:

```text
el código compila
```

Según el riesgo, debe considerar:

* implementación;
* tests;
* lint;
* build;
* validación funcional;
* documentación;
* security;
* migration;
* QA.

---

# 16. Estados del Board

Se utilizan:

```text
✅ Completed
```

Trabajo completado y validado.

```text
🟢 In Progress
```

Trabajo activo.

```text
🟡 Partial / Evolution
```

Existe funcionalidad pero requiere trabajo adicional significativo.

```text
⏳ Pending
```

Trabajo aprobado pero no iniciado/completado.

```text
🔎 Verify
```

Necesita validación contra implementación actual antes de asignar estado definitivo.

```text
🔮 Future
```

Dirección de producto sin compromiso inmediato.

---

# 17. Prioridades

```text
P0
→ blocker, seguridad, integridad o release readiness
```

```text
P1
→ capacidad comercial estratégica
```

```text
P2
→ expansión importante después de estabilizar P0/P1
```

```text
Future
→ visión posterior
```

---

# 18. Orden de trabajo inmediato

El orden actual recomendado es:

```text
1. Finalizar documentación project/
2. Limpiar templates/
3. Auditoría completa de docs/
4. Cerrar documentation-refactor
5. Documentar Healthcare
6. Resolver P0 Security
7. Completar RET-004
8. Revalidar ERP Core
9. Planificar SalesOrder + Delivery implementation
10. Continuar capacidades P1
```

El orden puede ajustarse ante un bloqueo real, pero no debe perderse la prioridad general.

---

# 19. Estado de documentación al cierre esperado del refactor

```text
docs/
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
│   ├── c4/
│   └── adr/
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
│   └── BUSINESS_COMPONENTS.md
│
├── modules/
│   ├── erp/
│   └── healthcare/
│
├── project/
│   ├── ROADMAP.md
│   ├── PROJECT_BOARD.md
│   └── CHANGELOG.md
│
└── templates/
```

`healthcare/` se creará cuando exista su primer documento.

---

# 20. Fuente de verdad por responsabilidad

```text
PRODUCT_VISION
→ dirección y propósito del producto
```

```text
PRODUCT_REQUIREMENTS
→ qué debe poder hacer
```

```text
ARCHITECTURE
→ cómo se estructura técnicamente
```

```text
ADR
→ por qué se tomó una decisión
```

```text
MODULE
→ cómo se comporta un dominio
```

```text
ZAPING_WAY
→ cómo debe sentirse la experiencia
```

```text
PROJECT_BOARD
→ estado actual
```

```text
ROADMAP
→ prioridades futuras
```

```text
CHANGELOG
→ historia completada
```

---

# 21. Principio final

El Project Board debe mantenerse pequeño, vigente y accionable.

No debe convertirse nuevamente en una mezcla de:

```text
sprint viejo
+
backlog histórico
+
roadmap
+
release notes
+
estado actual
```

La pregunta que este documento debe poder responder siempre es:

> **¿Cuál es el siguiente trabajo correcto para avanzar Zaping hoy?**
