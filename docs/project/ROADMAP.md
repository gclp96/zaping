# Roadmap — Zaping

**Producto:** Zaping Platform
**Versión del documento:** 1.0.0
**Estado:** Activo
**Última actualización:** 2026-08-19
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento define la dirección futura de Zaping.

Debe responder:

```text
¿Qué capacidades necesitamos después?
¿Por qué son importantes?
¿Qué depende de qué?
¿Qué pertenece al Core?
¿Qué pertenece a Healthcare?
¿Qué debe esperar?
```

El Roadmap representa intención y prioridad.

No representa:

* estado diario de tareas;
* historial de desarrollo;
* compromisos contractuales;
* fechas garantizadas;
* una lista exhaustiva de tickets.

---

# 2. Responsabilidades documentales

```text
ROADMAP.md
→ dirección futura
```

```text
PROJECT_BOARD.md
→ ejecución y estado actual
```

```text
CHANGELOG.md
→ historia completada
```

Cuando una iniciativa pase a ejecución:

```text
ROADMAP
↓
PROJECT_BOARD
```

Cuando quede completada:

```text
PROJECT_BOARD
↓
CHANGELOG
```

---

# 3. Visión de evolución

La dirección general es:

```text
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
```

El desarrollo debe preservar esta jerarquía.

---

# 4. Principio de prioridad

La prioridad no es construir la mayor cantidad de módulos.

La prioridad es construir:

> **un ERP confiable, comercializable y claramente diferenciado.**

Por tanto, el orden general es:

```text
Stability
↓
Commercial Readiness
↓
Healthcare Differentiation
↓
ERP Expansion
↓
External Intelligence
↓
AI
```

---

# 5. Regla de enfoque

Mientras el ERP Core todavía tenga riesgos importantes de:

* seguridad;
* consistencia;
* onboarding;
* migración de datos;
* UX operativa;
* ventas/inventario;

no debe desplazarse esfuerzo significativo hacia funcionalidades experimentales.

Una guía estratégica razonable durante esta etapa es:

```text
≈ 80 %
ERP comercializable y workflows principales

≈ 15 %
UX, onboarding e implementación inicial de Healthcare

≈ 5 %
investigación / definición de Radar

≈ 0 %
desarrollo productivo de AI
```

La distribución es orientativa, no contractual.

---

# 6. Etapa 0 — Documentation & Architecture Baseline

**Estado:** En cierre

Objetivo:

> establecer una fuente documental única y coherente antes de continuar ampliando el producto.

Incluye:

```text
Product
Architecture
ADR
Engineering
UX
ERP Modules
Project Planning
Templates
```

Resultado esperado:

```text
Documentación vigente
+
sin duplicados
+
sin archivos vacíos
+
sin arquitectura legacy presentada como actual
```

---

# 7. Salida de Etapa 0

Para considerar cerrada esta etapa:

* documentación raíz saneada;
* Project Board consolidado;
* Roadmap consolidado;
* Changelog consolidado;
* templates corregidos;
* auditoría completa de `docs/`;
* referencias internas verificadas;
* diferencias documentación ↔ código identificadas;
* commit del refactor documental.

---

# 8. Etapa 1 — ERP Core Release Readiness

**Prioridad:** P0

Objetivo:

> transformar la base funcional actual en un Core suficientemente seguro, consistente y verificable para comenzar pilotos reales.

---

# 9. Security Hardening

Capacidades prioritarias:

```text
Safe authentication responses
↓
Explicit user roles
↓
Inactive-user enforcement
↓
Tenant isolation regression tests
↓
Authorization review
```

---

# 10. Authentication Response Safety

Debe eliminarse cualquier exposición de:

```text
passwordHash
```

desde:

* login;
* `/auth/me`;
* Users API;
* serializers;
* otros contratos.

---

# 11. Safe User Provisioning

Debe revisarse:

```text
User.role @default(ADMIN)
```

para impedir elevación accidental de privilegios.

La creación normal de usuarios debe utilizar roles explícitos y autorizados.

---

# 12. Tenant Isolation

Debe existir una cobertura sistemática que pruebe:

```text
Company A
↛
Company B resources
```

en:

* Customers;
* Suppliers;
* Products;
* Purchases;
* Inventory;
* Quotes;
* Sales;
* Returns;
* archivos;
* exports;
* futuros módulos.

---

# 13. Returns Completion

Completar:

```text
RET-004
```

y la primera versión operacional de Returns.

Debe incluir:

```text
Create
Read
Confirm
Cancel
Quantity validation
Concurrency
Inventory integration
Tenant isolation
Tests
```

sin profundizar innecesariamente dependencias legacy que serán reemplazadas por Delivery.

---

# 14. Core Regression

Antes de pilotos:

```text
Backend tests
Frontend tests
Lint
Build
Critical flows
Manual QA
Tenant isolation
Authorization
Error handling
```

deben ejecutarse como un paquete de readiness.

---

# 15. Operational Reliability

Los workflows principales deben quedar suficientemente sólidos:

```text
Customer
Product
Supplier

Purchase
↓
PurchaseReceipt
↓
Inventory

Quote
↓
Sales legacy temporal

Return
```

antes de ampliar agresivamente el alcance.

---

# 16. Etapa 2 — Commercial ERP Experience

**Prioridad:** P1

Objetivo:

> reducir fricción y convertir módulos funcionales en una experiencia ERP coherente.

---

# 17. 360 Views

Prioridad inicial:

```text
Customer 360
Product 360
Supplier 360
Purchase 360
```

posteriormente:

```text
SalesOrder 360
Return 360
Healthcare Case 360
```

---

# 18. Principio 360

Una vista 360 debe proporcionar:

```text
Identity
↓
Current state
↓
Related activity
↓
Next actions
```

sin trasladar ownership de los dominios.

---

# 19. Action Dashboard

Evolucionar:

```text
Counters
↓
Operational Context
↓
Attention
↓
Action
```

Ejemplo:

```text
3 compras pendientes de recepción
[Revisar]

5 productos con bajo stock
[Reabastecer]

2 pedidos pendientes de entrega
[Preparar]
```

---

# 20. Global Search

Implementar búsqueda transversal para recursos empresariales relevantes.

Debe respetar:

```text
Tenant
+
Permissions
+
Resource lifecycle
```

Resultados iniciales candidatos:

```text
Customers
Suppliers
Products
Purchases
Quotes
SalesOrders
```

según disponibilidad.

---

# 21. Contextual Creation

Reducir navegación innecesaria.

Ejemplo:

```text
New Purchase
↓
SupplierSelector
↓
Supplier does not exist
↓
Create Supplier
↓
continue Purchase
```

Sin perder el formulario actual.

---

# 22. UX Consistency

Continuar estandarizando:

```text
Page layout
Actions
Forms
Tables
Filters
Statuses
Confirmation
Loading
Empty
Error
```

mediante:

```text
DESIGN_SYSTEM.md
BUSINESS_COMPONENTS.md
ZAPING_WAY.md
```

---

# 23. Onboarding

Una Company nueva debe poder pasar rápidamente de:

```text
Account created
```

a:

```text
Useful ERP
```

---

# 24. Onboarding Flow

Conceptualmente:

```text
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
```

---

# 25. Setup Checklist

El Dashboard puede evolucionar para mostrar:

```text
Configura tu empresa      ✓
Agrega productos          ○
Importa clientes          ○
Registra proveedores      ○
Crea primera cotización   ○
```

en Companies nuevas.

---

# 26. Etapa 3 — Data Import & Migration

**Prioridad:** P1

Objetivo:

> reducir significativamente el costo de adopción de Zaping.

Una PyME con años de información no puede depender de captura manual para comenzar.

---

# 27. Importaciones iniciales

Primera prioridad:

```text
Customers
Suppliers
Products
Inventory
```

---

# 28. Formatos

Soportar inicialmente:

```text
CSV
XLSX
```

---

# 29. Flujo

```text
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
```

---

# 30. Sistemas de origen

La arquitectura debe permitir migraciones desde escenarios como:

```text
Excel
CONTPAQi
Aspel
Microsip
Odoo
SAP
otros ERP
```

sin construir un conector completo para todos desde la primera versión.

---

# 31. Initial Inventory

Importar Products debe mantenerse separado de:

```text
Initial Inventory
```

El inventario inicial requiere una operación controlada y trazable.

No debe traducirse en:

```text
Product.stock = spreadsheet value
```

sin contexto.

---

# 32. Etapa 4 — SalesOrder + Delivery

**Prioridad:** P1 estratégica

Objetivo:

> separar compromiso comercial de fulfillment físico.

---

# 33. Modelo objetivo

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

# 34. SalesOrder

Debe representar:

* Customer;
* Products;
* quantities;
* prices;
* totals;
* compromiso comercial;
* cantidades pendientes;
* relación opcional con Quote.

---

# 35. Delivery

Debe representar:

* fulfillment físico;
* cantidades realmente entregadas;
* entregas parciales;
* lotes;
* series cuando corresponda;
* fecha;
* destino;
* responsable;
* efecto Inventory OUT.

---

# 36. Entregas parciales

Debe soportarse:

```text
Ordered 100
↓
Delivery 40
↓
Delivery 30
↓
Pending 30
```

---

# 37. Quote Conversion

La conversión debe evolucionar de:

```text
Quote
↓
Sale
↓
Inventory OUT
```

a:

```text
Quote
↓
SalesOrder
```

sin modificar inventario.

---

# 38. Legacy Migration

La migración deberá conservar:

* folios;
* Customers;
* items;
* precios;
* status;
* InventoryMovement histórico;
* Quote relationships;
* Returns.

No debe producir nuevamente OUT para Sales ya procesadas.

---

# 39. Returns Migration

Returns deberá evolucionar:

```text
SaleItem
↓
ReturnItem
```

hacia:

```text
DeliveryItem
↓
ReturnItem
```

de forma coordinada con Sales.

---

# 40. Etapa 5 — Inventory Traceability

**Prioridad:** P1

Objetivo:

> convertir Inventory en una ventaja competitiva clara para distribuidores de suministros médicos.

---

# 41. FEFO

Implementar:

> **First Expired, First Out**

para productos con caducidad.

Debe considerar:

```text
Expiration
Availability
Batch state
Quantity
Location future
Custody future
```

---

# 42. Expiration Management

Incluir progresivamente:

```text
Expired
Near Expiration
30 / 60 / 90 day visibility
Sellability
Alerts
Dashboard integration
```

---

# 43. Batch Allocation

Delivery debe conocer:

```text
qué lote
+
qué cantidad
```

fue entregado.

Esto desbloquea:

* Returns confiables;
* Healthcare traceability;
* FEFO;
* lot history.

---

# 44. Serial Tracking

Después de estabilizar lotes:

```text
Product
↓
Serialized Unit
```

permitirá seguimiento unitario.

Especialmente importante para Equipment.

---

# 45. Kardex

Inventory debe proporcionar una lectura operativa como:

```text
Date
Origin
IN
OUT
Balance
Lot
User
```

sin sustituir la fuente histórica de InventoryMovement.

---

# 46. Etapa 6 — Zaping Healthcare

**Prioridad:** P1 estratégica

Objetivo:

> convertir la especialización Healthcare en el principal diferenciador inicial de Zaping frente a ERP genéricos.

---

# 47. Frontera

Healthcare se construye:

```text
sobre ERP Core
```

no:

```text
dentro de cada tabla del ERP Core
```

Debe evitarse contaminación del modelo genérico.

---

# 48. Flujo general

```text
Opportunity
↓
Healthcare Case
↓
Calendar
↓
Preparation
↓
CaseKit
↓
Dispatch
↓
Technician Custody
↓
Procedure
↓
Return
↓
Inspection
↓
Reconciliation
```

---

# 49. Opportunity

Debe soportar oportunidades originadas por:

```text
Doctor request
Technician prospecting
Commercial lead
```

Puede existir antes de conocer todos los datos comerciales definitivos.

---

# 50. Healthcare Case

Case representa un procedimiento desde el punto de vista:

```text
operacional
+
logístico
+
comercial
```

No debe convertirse en un expediente clínico.

---

# 51. Relaciones Healthcare

Mantener separados:

```text
Doctor
Hospital
Customer
Payer
Technician
```

porque pueden representar actores diferentes.

---

# 52. Case Calendar

Debe proporcionar una lectura temporal de Cases.

Filtros relevantes:

```text
Technician
Hospital
Doctor
Status
Procedure
```

y permitir detectar:

* conflictos de técnico;
* conflictos de Equipment;
* readiness.

---

# 53. CaseKit

Separar:

```text
KitTemplate
```

de:

```text
CaseKit
```

---

# 54. KitTemplate

Representa una configuración reusable.

Ejemplo:

```text
Procedimiento X
├── Product A × 2
├── Product B × 4
└── Equipment C
```

---

# 55. CaseKit

Representa la preparación real para un Case específico.

Puede contener:

* quantities;
* batches;
* serials;
* Equipment;
* estado de preparación.

---

# 56. Case Logistics

Debe formalizar:

```text
Preparation
↓
Dispatch
↓
Custody
↓
Return
↓
Inspection
↓
Reconciliation
```

---

# 57. Regla crítica Healthcare

```text
CaseDispatch
≠
Delivery
```

y:

```text
CaseDispatch
≠
definitive Inventory OUT
```

---

# 58. Technician Custody

El material puede encontrarse:

```text
fuera del almacén
```

pero continuar siendo:

```text
propiedad de la Company
```

---

# 59. Reconciliation

Debe cumplirse:

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

# 60. Used

La cantidad utilizada puede generar posteriormente la consecuencia comercial apropiada.

Debe evitarse decremento doble de Inventory.

---

# 61. Returned

Material regresado puede requerir:

```text
Inspection
↓
Available
Quarantine
Damaged
Maintenance
```

antes de volver a disponibilidad.

---

# 62. Equipment

Healthcare necesita identidad física individual para equipos reutilizables.

Conceptualmente:

```text
EquipmentAsset
├── assetCode
├── Product / Model
├── serial
├── status
├── custodian
├── Case
├── condition
└── history
```

---

# 63. Equipment evolución

Posteriormente:

```text
Maintenance
Calibration
Service history
Availability
Scheduling
```

---

# 64. Warehouse Operations Workspace

Healthcare y ERP deben converger en una experiencia operacional de almacén.

Puede reunir:

```text
Purchase Receipts
Case Preparation
Deliveries
Returns
Equipment
Inventory alerts
```

sin crear un nuevo dominio que duplique reglas.

---

# 65. Etapa 7 — Audit & Advanced Authorization

**Prioridad:** P1/P2

Objetivo:

> aumentar trazabilidad y control conforme Zaping entre a operaciones empresariales más sensibles.

---

# 66. Audit Foundation

Primera versión:

```text
AuditEvent
companyId
actor
action
resource
timestamp
safe metadata
```

con comportamiento append-only.

---

# 67. Cobertura inicial de Audit

Prioridad:

```text
Identity
Company
Inventory
Purchases
Receipts
Sales / Deliveries
Returns
```

---

# 68. Permission-Based RBAC

Evolucionar:

```text
UserRole
```

hacia:

```text
Role
↓
Permissions
```

---

# 69. Default Roles

Los roles existentes pueden convertirse en presets:

```text
Administrator
Manager
Sales
Warehouse
```

sin depender permanentemente del enum para todas las decisiones.

---

# 70. Custom Roles

Posteriormente puede permitirse:

```text
Compras
Supervisor de Almacén
Auditor
Ventas Junior
```

basándose en Permissions.

---

# 71. Etapa 8 — Multi-Warehouse & Advanced Inventory

**Prioridad:** P2

Objetivo:

> soportar empresas con mayor complejidad logística.

---

# 72. Warehouses

Introducir explícitamente:

```text
Warehouse
```

como unidad de almacenamiento empresarial.

---

# 73. Locations

Dentro de Warehouse pueden existir posteriormente:

```text
Zone
Rack
Bin
Quarantine
Staging
```

según las necesidades reales.

---

# 74. Inventory Balance

El modelo deberá distinguir:

```text
Product
+
Batch
+
Location
+
State
```

cuando corresponda.

---

# 75. Transfers

```text
Warehouse A
↓
Transfer
↓
Warehouse B
```

cambia ubicación.

No necesariamente cambia propiedad de la Company.

---

# 76. Stock Counts

Incluir:

```text
System Quantity
vs
Physical Quantity
↓
Difference
↓
Authorized Adjustment
```

---

# 77. Reservations

Antes de implementarlas debe definirse:

```text
Physical
Reserved
Available
```

y su interacción con:

* SalesOrder;
* Healthcare;
* Warehouse;
* Delivery.

---

# 78. Etapa 9 — Billing & Mexican Commercial Requirements

**Prioridad:** P2 / necesaria para madurez comercial en México

Objetivo:

> completar el ciclo económico sin mezclarlo con fulfillment físico.

---

# 79. Invoice

Mantener:

```text
SalesOrder
≠
Delivery
≠
Invoice
```

---

# 80. CFDI

La implementación mexicana requerirá revisar:

* RFC;
* razón social;
* régimen fiscal;
* código postal;
* uso CFDI;
* impuestos;
* timbrado;
* cancelación;
* XML;
* PDF.

---

# 81. Fiscal Profiles

Customer y Company necesitarán una estructura fiscal más completa.

No debe improvisarse agregando campos aislados antes de diseñar Billing.

---

# 82. Accounts Receivable

Después de Invoice podrá evolucionarse hacia:

```text
Invoice
↓
Balance
↓
Payment
↓
Accounts Receivable
```

---

# 83. Credit Management

Solo cuando existan saldos confiables tendrá sentido utilizar:

```text
Customer.creditLimit
```

como parte de controles operativos reales.

---

# 84. Supplier Finance

Posteriormente:

```text
Accounts Payable
Supplier Invoices
Payments
```

si el alcance comercial lo requiere.

---

# 85. Etapa 10 — Portals & Mobile

**Prioridad:** P2

Objetivo:

> extender Zaping fuera de la interfaz interna de escritorio.

---

# 86. Customer Portal

Permitirá progresivamente:

```text
Quotes
Orders
Deliveries
Invoices
Documents
```

según permisos.

---

# 87. External Identity

Customer Portal necesita un modelo de identidad externo seguro.

No debe utilizar:

```text
Customer.email
```

como login implícito.

---

# 88. Sales Mobile App

Aplicación móvil para vendedores.

Capacidades candidatas:

```text
Customers
Products
Quotes
SalesOrders
Field activity
```

---

# 89. Healthcare Mobile

Una evolución especializada puede ayudar a técnicos con:

```text
Cases
CaseKit
Custody
Return
Reconciliation
Equipment
```

---

# 90. API reutilizable

Portal y Mobile deben consumir las mismas capacidades de negocio mediante APIs bien diseñadas.

No crear reglas independientes por canal.

---

# 91. Etapa 11 — Zaping Radar

**Prioridad:** Future / exploración estratégica

Objetivo:

> convertir oportunidades externas en inteligencia accionable para empresas que venden al sector público y Healthcare.

---

# 92. Alcance inicial

Radar se ha identificado inicialmente para:

```text
Sonora
Baja California
Baja California Sur
Nuevo León
Sinaloa
```

con énfasis en:

```text
licitaciones y oportunidades del sector salud
```

---

# 93. Radar como producto

Radar debe mantener identidad propia dentro del ecosistema.

Puede funcionar:

```text
Standalone
```

y:

```text
Integrated with Zaping ERP
```

cuando exista valor.

---

# 94. Integración potencial

Conceptualmente:

```text
Tender / Opportunity
↓
Radar
↓
ERP Opportunity
↓
Quote
↓
Sales process
```

sin acoplar directamente Radar al dominio transaccional.

---

# 95. Capacidades futuras

```text
Source Monitoring
Opportunity Normalization
Filters
Alerts
Saved Searches
Tender Workspace
Document Analysis
Commercial Fit
ERP Integration
```

---

# 96. No construir Radar antes del Core

El valor estratégico de Radar es alto.

Sin embargo, no debe retrasar:

* seguridad;
* Sales refactor;
* importaciones;
* onboarding;
* Healthcare;
* release readiness.

---

# 97. Etapa 12 — Zaping AI

**Prioridad:** Future

Objetivo:

> convertir información operacional confiable en asistencia y automatización explicable.

---

# 98. Principio

```text
Reliable Data
+
Reliable Workflows
↓
Useful AI
```

No al revés.

---

# 99. Capacidades candidatas

```text
Natural Language Queries
Operational Summaries
Replenishment Suggestions
Sales Insights
Anomaly Detection
Tender Analysis
Document Assistance
Workflow Recommendations
```

---

# 100. AI explicable

Toda recomendación debe poder relacionarse con datos reales.

Ejemplo:

```text
Revisar Product CAT-001

Stock actual: 4
MinStock: 10
Pending Purchases: 0
```

---

# 101. AI no debe saltarse autorización

Una consulta AI debe aplicar:

```text
Identity
Tenant
Permissions
Domain Rules
```

igual que cualquier otra interfaz.

---

# 102. AI no debe ejecutar silenciosamente

Debe distinguirse:

```text
Recommendation
```

de:

```text
Automated Business Action
```

Las acciones automáticas requerirán controles, permisos y Audit.

---

# 103. Capacidades transversales futuras

Algunas capacidades afectan varias etapas y se implementarán cuando sus dependencias estén maduras.

Incluyen:

```text
Notifications
Document Management
Advanced Reporting
Advanced Analytics
Integrations
Public API
Webhooks
Localization
Internationalization
```

---

# 104. Notifications

Pueden incluir:

```text
Low Stock
Expiration
Pending Receipt
Pending Delivery
Healthcare Case
Return
Tender Opportunity
```

según producto y preferencias.

---

# 105. Document Management

Puede dar soporte a:

* cotizaciones;
* órdenes;
* licitaciones;
* contratos;
* certificados;
* documentos regulatorios;
* PDFs;
* attachments.

Debe incluir tenant isolation.

---

# 106. Reporting

La evolución puede incluir:

```text
Operational Reports
Commercial Reports
Inventory Reports
Healthcare Reports
Exports
```

sin convertir Dashboard en una plataforma BI completa prematuramente.

---

# 107. Integraciones

Conforme el mercado lo requiera pueden aparecer:

```text
CONTPAQi
email
CFDI/PAC
carriers
supplier systems
public procurement sources
```

Cada integración deberá tener:

* ownership;
* security;
* retries;
* audit;
* failure handling.

---

# 108. Public API

Debe distinguirse:

```text
Application API
```

de:

```text
Public API
```

La segunda puede requerir:

* versioning;
* credentials;
* quotas;
* webhooks;
* stronger compatibility guarantees.

---

# 109. Lo que no debe priorizarse todavía

No invertir significativamente en:

```text
Microservices
Kubernetes
Complex Event Bus
Data Warehouse
Advanced ML infrastructure
Marketplace
Plugin ecosystem
Global multi-region
```

sin una necesidad demostrada.

---

# 110. Principio arquitectónico

Zaping continúa con:

> **Modular Monolith until evidence says otherwise.**

La evolución del producto no exige transformar cada capacidad en un servicio independiente.

---

# 111. Dependencias principales

La secuencia de capacidades no es arbitraria.

Ejemplos:

```text
SalesOrder
↓
Delivery
↓
Batch Allocation
↓
Reliable Returns
```

---

```text
InventoryBatch
↓
Expiration
↓
FEFO
```

---

```text
Delivery
+
Inventory Traceability
↓
Healthcare Reconciliation
```

---

```text
Reliable Domains
↓
Audit
↓
Advanced Automation
```

---

```text
Reliable Operational Data
↓
Analytics
↓
AI
```

---

# 112. Priorización comercial

Al evaluar una nueva iniciativa deben considerarse:

```text
Customer Value
Operational Risk
Revenue Potential
Differentiation
Dependencies
Development Cost
Security Impact
Migration Impact
UX Impact
```

---

# 113. Regla para nuevas ideas

Una nueva idea no entra automáticamente a desarrollo.

Debe pasar conceptualmente por:

```text
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
```

---

# 114. Features de competidores

Zaping no debe intentar copiar feature por feature a:

```text
Odoo
CONTPAQi
Bind ERP
Microsip
Dynamics
NetSuite
SAP
```

---

# 115. Estrategia competitiva

La dirección es competir mediante:

```text
ERP Core sólido
+
UX más simple
+
Healthcare specialization
+
Traceability
+
Faster adoption
```

y posteriormente:

```text
Radar
+
AI
```

como ventajas adicionales.

---

# 116. Comercialización

El producto debe avanzar progresivamente hacia:

```text
Internal use
↓
Controlled pilot
↓
Early customers
↓
Repeatable onboarding
↓
Scalable SaaS
```

---

# 117. Pilotos

Antes de pilotos externos debe existir al menos:

* seguridad P0 resuelta;
* flows principales estables;
* data isolation validada;
* backups básicos;
* error handling;
* QA;
* onboarding razonable;
* soporte operativo;
* documentación interna confiable.

---

# 118. SaaS Operations futuro

Posteriormente deberán formalizarse:

```text
Subscriptions
Plans
Feature entitlement
Tenant provisioning
Tenant suspension
Usage limits
Support
Backups
Observability
```

No pertenecen aún al ERP funcional principal.

---

# 119. Release Strategy

No se utilizarán números de versión únicamente para asignar una feature futura.

Ejemplo antiguo:

```text
v0.10 Quotes
v0.11 Sales
```

queda descartado como estrategia vigente.

---

# 120. Versiones

Una versión debe representar un conjunto real y verificable de cambios.

No una promesa histórica desactualizada.

---

# 121. Release Candidate

Antes de una release importante puede utilizarse:

```text
Feature complete
↓
Regression
↓
Security review
↓
Migration validation
↓
Release candidate
↓
Release
```

---

# 122. Backlog

No se mantendrá un segundo Backlog general dentro de `docs/roadmap/`.

El trabajo aprobado y accionable debe vivir en:

```text
PROJECT_BOARD.md
```

o en el sistema de tickets utilizado por el proyecto.

---

# 123. Sprint Documents

No se crearán archivos permanentes como:

```text
Sprint-11.md
Sprint-12.md
Sprint-13.md
```

como principal fuente del estado del producto.

---

# 124. Sprints

Los Sprints pueden utilizarse operacionalmente para organizar trabajo.

Pero:

```text
architecture
product behavior
roadmap
```

deben permanecer en sus documentos responsables.

---

# 125. Historial de Sprint

Un Sprint completado puede aportar hechos relevantes a:

```text
CHANGELOG.md
```

No necesita conservarse indefinidamente como documentación oficial separada.

---

# 126. Criterio de avance entre etapas

Las etapas de este Roadmap no requieren terminar el 100 % de todas las ideas antes de comenzar la siguiente.

La transición se basa en:

```text
Critical dependencies resolved
+
acceptable risk
+
business value
```

---

# 127. Roadmap no lineal rígido

Algunas iniciativas pueden ejecutarse en paralelo.

Ejemplo:

```text
Healthcare documentation
```

puede avanzar mientras:

```text
Security hardening
```

se implementa.

Pero las dependencias técnicas deben respetarse.

---

# 128. Prioridades actuales resumidas

## P0

```text
Documentation closure
Security hardening
Returns backend
Core regression
Release readiness
```

---

## P1

```text
UX / 360
Action Dashboard
Global Search
Data Import
SalesOrder + Delivery
Inventory traceability
Healthcare
Audit
Permission-based RBAC
```

---

## P2

```text
Multi-Warehouse
Serial Tracking
Inventory Counts
Billing / CFDI
Accounts Receivable
Portals
Mobile
Advanced Reporting
```

---

## Future

```text
Radar
AI
Advanced automation
Broader ecosystem
```

---

# 129. Fuente de verdad

```text
ROADMAP.md
→ dirección futura y prioridades
```

```text
PROJECT_BOARD.md
→ iniciativas activas y estado
```

```text
CHANGELOG.md
→ historia
```

```text
PRODUCT_VISION.md
→ visión de largo plazo
```

```text
PRODUCT_REQUIREMENTS.md
→ capacidades que el producto debe satisfacer
```

```text
ADR
→ decisiones arquitectónicas
```

```text
modules/
→ comportamiento funcional
```

---

# 130. Regla de mantenimiento

Este Roadmap debe revisarse cuando:

* cambie una prioridad estratégica;
* se apruebe una nueva línea de producto;
* una dependencia importante sea resuelta;
* un aprendizaje real cambie el orden de implementación;
* una capacidad deje de tener valor.

No necesita modificarse con cada commit.

---

# 131. Principio final

Zaping debe crecer por capas.

```text
Reliable Core
↓
Great Operational Experience
↓
Healthcare Differentiation
↓
Broader ERP Capabilities
↓
External Intelligence
↓
AI
```

No debe crecer agregando features aisladas sin consolidar las capas anteriores.

> **La meta no es construir el ERP con más funciones. Es construir una plataforma que resuelva mejor el trabajo real de sus usuarios y pueda crecer sin perder claridad, seguridad ni trazabilidad.**
