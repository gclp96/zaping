# Arquitectura de Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Propósito

Este documento describe la arquitectura técnica vigente y la dirección arquitectónica de Zaping.

Su objetivo es explicar:

* cómo está organizada la plataforma;
* qué responsabilidades existen;
* cómo se relacionan los dominios;
* cuáles son los límites principales;
* qué tecnologías forman parte actualmente del sistema;
* qué reglas arquitectónicas deben respetarse;
* y cómo puede evolucionar la plataforma sin sobreingeniería.

Las razones detrás de decisiones arquitectónicas específicas se documentan mediante ADR.

---

# 2. Alcance

Este documento cubre la arquitectura general de:

* Zaping Platform;
* Zaping ERP Core;
* Zaping Healthcare;
* frontend;
* backend;
* persistencia;
* APIs;
* seguridad;
* multi-tenancy;
* inventario;
* integraciones;
* despliegue;
* y evolución futura.

No reemplaza:

* `PRODUCT_REQUIREMENTS.md`;
* documentación específica de módulos;
* ADR;
* `SECURITY_PRINCIPLES.md`;
* `API_GUIDELINES.md`;
* `ZAPING_WAY.md`.

---

# 3. Principio arquitectónico

La arquitectura existe para soportar el negocio.

Zaping prioriza:

```text
Business
↓
Domain
↓
Architecture
↓
Technology
```

y no:

```text
Technology
↓
Business forced into implementation
```

Las decisiones técnicas deben facilitar la evolución del producto sin introducir complejidad que todavía no sea necesaria.

---

# 4. Principios arquitectónicos

Zaping utiliza los siguientes principios.

## Business First

Las reglas del negocio tienen prioridad sobre conveniencias técnicas.

## Modular Monolith

Los dominios viven actualmente dentro de una aplicación modular desplegable como unidad.

## Multi-Tenant

La plataforma atiende múltiples Companies manteniendo aislamiento lógico.

## API First

Las capacidades empresariales deben poder consumirse mediante contratos independientes de una interfaz concreta.

## Layered Architecture

Las responsabilidades deben separarse mediante capas pragmáticas.

## Domain Ownership

Cada dominio es propietario de sus reglas.

## Security by Design

Autenticación, autorización, tenant y protección de datos forman parte del diseño.

## Documentation First

Las decisiones relevantes deben comprenderse y documentarse antes de comprometer la implementación.

## Event Ready

La arquitectura puede incorporar eventos de dominio cuando aporten valor sin exigir una infraestructura distribuida.

## Simplicity First

No se introducen patrones, servicios o infraestructura sin una necesidad concreta.

---

# 5. Arquitectura conceptual de producto

La visión de plataforma es:

```text
                     Zaping Platform
                           │
              ┌────────────┴────────────┐
              │                         │
          ERP Core                Verticales
              │                         │
              │                   Healthcare
              │
              ├───────────────┐
              │               │
            Radar       Business Intelligence
              │               │
              └───────┬───────┘
                      │
                     AI
```

Los canales pueden evolucionar hacia:

```text
Web Application
Customer Portal
Mobile Application
Public API
External Integrations
```

No todos estos componentes están implementados actualmente.

El diagrama representa la dirección conceptual de la plataforma.

---

# 6. Arquitectura técnica actual

La arquitectura principal actual sigue:

```text
Browser
   ↓
Next.js Frontend
   ↓
REST API
   ↓
NestJS Backend
   ↓
Application / Domain Logic
   ↓
Prisma
   ↓
PostgreSQL
```

La aplicación se mantiene como un **Modular Monolith**.

---

# 7. Stack tecnológico actual

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

## Backend

* NestJS
* Node.js
* TypeScript

## Persistencia

* PostgreSQL
* Prisma ORM

## Autenticación

* JWT
* Passport
* bcrypt

## Validación

* class-validator
* class-transformer

## Infraestructura de desarrollo

* Docker
* variables de entorno

Las tecnologías futuras deben incorporarse únicamente cuando exista una necesidad arquitectónica o de producto clara.

---

# 8. Capas del sistema

La separación conceptual es:

```text
Presentation
      ↓
Application
      ↓
Domain
      ↓
Infrastructure
      ↓
Persistence
```

Estas capas representan responsabilidades.

No es obligatorio crear una carpeta física por cada capa en cada módulo.

---

# 9. Presentation Layer

Responsable de interacción con usuarios o consumidores externos.

Actualmente incluye principalmente:

```text
Next.js Web Application
REST Controllers
```

Futuros consumidores pueden incluir:

* Customer Portal;
* Mobile App;
* Public API;
* integraciones.

La presentación no debe ser propietaria de reglas centrales del negocio.

---

# 10. Application Layer

Coordina casos de uso.

Ejemplos:

```text
Create Purchase
Register Purchase Receipt
Create Quote
Confirm Delivery
Prepare Case
Reconcile Case
```

Actualmente gran parte de esta responsabilidad vive en los Services de NestJS.

La capa de aplicación puede:

* coordinar dominios;
* validar precondiciones;
* abrir transacciones;
* invocar contratos públicos.

---

# 11. Domain Layer

Contiene las reglas que definen el comportamiento empresarial.

Ejemplos:

* disponibilidad de inventario;
* cantidades pendientes de recepción;
* lifecycle de documentos;
* reglas de entrega;
* conciliación de Case;
* trazabilidad por lote.

El dominio debe permanecer conceptualmente independiente de detalles de interfaz.

---

# 12. Infrastructure Layer

Contiene capacidades técnicas necesarias para ejecutar el sistema.

Ejemplos:

* autenticación;
* email;
* almacenamiento;
* logging;
* configuración;
* servicios externos;
* Docker;
* adapters futuros.

Infraestructura no debe determinar las reglas fundamentales del negocio.

---

# 13. Persistence Layer

Actualmente:

```text
Prisma
↓
PostgreSQL
```

Responsable de:

* persistencia;
* relaciones;
* constraints;
* índices;
* migraciones;
* transacciones.

La capacidad técnica de acceder a una tabla no significa tener propiedad arquitectónica sobre ella.

---

# 14. Arquitectura backend

La dirección general es:

```text
Controller
    ↓
Service
    ↓
Prisma / Repository cuando aporta valor
    ↓
PostgreSQL
```

Repository es opcional.

No debe introducirse una capa únicamente para cumplir una estructura predeterminada.

---

# 15. Controllers

Los Controllers deben principalmente:

* recibir requests;
* resolver parámetros;
* aplicar Guards;
* aplicar decoradores;
* delegar;
* devolver respuestas.

No deben contener lógica compleja de negocio.

---

# 16. Services

Los Services son actualmente la principal capa de coordinación.

Pueden contener:

* casos de uso;
* validaciones;
* reglas;
* coordinación;
* transacciones;
* llamadas permitidas a otros módulos.

Cuando un Service crece excesivamente debe evaluarse si existen responsabilidades diferentes que deben separarse.

---

# 17. Repository

Repository puede utilizarse cuando proporciona:

* aislamiento de persistencia;
* reutilización de queries;
* claridad;
* testabilidad.

No es obligatorio para todos los módulos.

Prisma puede utilizarse directamente desde Services cuando esto mantenga responsabilidades claras.

---

# 18. Arquitectura frontend

La dirección conceptual del frontend es:

```text
Pages / Routes
      ↓
Features
      ↓
Business Components
      ↓
UI Components
```

Layouts y elementos compartidos pueden participar transversalmente.

---

# 19. Pages

Las páginas organizan:

* routing;
* composición;
* contexto;
* estructura del workflow.

No deben acumular toda la lógica de interacción ni reglas empresariales.

---

# 20. Features

Una Feature representa una capacidad funcional.

Puede contener:

* hooks;
* formularios;
* lógica de interacción;
* componentes específicos;
* tipos;
* integración con API.

Ejemplos:

```text
Purchase Form
Receipt Registration
Case Preparation
Delivery Confirmation
```

---

# 21. Business Components

Representan componentes reutilizables con conocimiento empresarial controlado.

Ejemplos:

```text
ProductSelector
CustomerSelector
SupplierSelector
StatusBadge
MoneyInput
```

---

# 22. UI Components

Representan componentes visuales genéricos.

Ejemplos:

```text
Button
Modal
Input
Table
Badge
LoadingSpinner
ConfirmDialog
```

No deben conocer reglas específicas de dominio.

---

# 23. Arquitectura modular

El backend se organiza mediante módulos orientados a capacidades de negocio.

El objetivo no es replicar tablas.

Un módulo existe porque posee una responsabilidad empresarial.

---

# 24. Dominios principales

La arquitectura reconoce actualmente o contempla los siguientes dominios principales:

| Dominio         | Responsabilidad principal            |
| --------------- | ------------------------------------ |
| Auth / Identity | autenticación e identidad            |
| Companies       | contexto de tenant                   |
| Customers       | clientes                             |
| Suppliers       | proveedores                          |
| Products        | catálogo de productos                |
| Purchases       | abastecimiento                       |
| Inventory       | existencias y trazabilidad           |
| Quotes / Sales  | proceso comercial                    |
| Returns         | devoluciones                         |
| Dashboard       | lectura y contexto operacional       |
| Healthcare      | Case Logistics                       |
| Equipment       | activos reutilizables especializados |
| Billing         | facturación futura                   |
| Radar           | inteligencia externa                 |
| AI              | inteligencia futura                  |

El estado concreto de implementación se registra en `PROJECT_BOARD.md`, no en este documento.

---

# 25. Propiedad de dominio

Cada dominio debe controlar sus reglas.

Ejemplo:

```text
Inventory
├── stock
├── movimientos
├── lotes
├── series
└── disponibilidad
```

Otros dominios pueden solicitar operaciones a Inventory.

No deben modificar directamente sus estructuras evitando las reglas correspondientes.

---

# 26. Comunicación entre módulos

Preferir:

```text
Purchases
↓
Inventory Contract
↓
Inventory
```

sobre:

```text
Purchases
↓
Direct Prisma access to Inventory internals
```

La misma regla aplica entre:

* Sales e Inventory;
* Healthcare e Inventory;
* Healthcare y Sales;
* Billing y Sales;
* otros dominios.

---

# 27. Modular Monolith

Zaping se despliega inicialmente como una unidad lógica principal.

```text
Zaping Backend
│
├── Auth
├── Customers
├── Products
├── Purchases
├── Inventory
├── Sales
├── Healthcare
└── ...
```

Esto permite:

* transacciones locales;
* debugging sencillo;
* infraestructura reducida;
* desarrollo rápido.

Los límites modulares continúan siendo obligatorios aunque exista una base de datos compartida.

---

# 28. Base de datos compartida

Los módulos pueden compartir PostgreSQL.

Sin embargo:

```text
Shared Database
≠
Shared Domain Ownership
```

Prisma proporciona acceso técnico.

La arquitectura determina quién puede modificar qué información.

---

# 29. Multi-tenancy

Zaping utiliza arquitectura multi-tenant.

Conceptualmente:

```text
Zaping
│
├── Company A
│
├── Company B
└── Company C
```

Las entidades empresariales pertenecen a una Company directa o indirectamente.

El aislamiento debe aplicarse en:

* consultas;
* mutaciones;
* relaciones;
* reportes;
* exportaciones;
* dashboards;
* documentos.

---

# 30. Contexto del tenant

El tenant debe derivarse principalmente del usuario autenticado.

```text
JWT
↓
Authenticated User
↓
companyId
↓
Business Operation
```

Un `companyId` enviado por frontend no debe convertirse en la autoridad de seguridad.

---

# 31. Identificadores

Las entidades principales utilizan UUID como identificadores técnicos.

Ejemplo:

```prisma
id String @id @default(uuid())
```

Los documentos pueden utilizar además folios legibles.

```text
UUID
→ identidad técnica

OC-000421
→ identidad de negocio
```

---

# 32. Ciclo de vida de entidades

No existe Soft Delete universal.

La estrategia depende del tipo de entidad.

Conceptualmente:

```text
Master Data
→ ACTIVE / INACTIVE

Transactional Document
→ DRAFT / CONFIRMED / CANCELLED

Historical Event
→ IMMUTABLE

Temporary Data
→ EXPIRE / DELETE
```

La decisión completa se encuentra en ADR-012.

---

# 33. Arquitectura de inventario

Inventario se basa en operaciones trazables.

```text
Business Event
↓
Inventory Movement
↓
Balance / Projection
```

`Product.stock` puede funcionar como proyección optimizada mientras siga siendo necesario.

No debe tratarse como una entrada independiente editable libremente.

---

# 34. Entrada de inventario

El flujo correcto de abastecimiento es:

```text
Purchase
↓
PurchaseReceipt
↓
Inventory IN
```

Por lo tanto:

```text
Purchase
≠
Inventory IN
```

---

# 35. Recepciones parciales

Una Purchase puede tener múltiples Purchase Receipts.

Conceptualmente:

```text
Ordered
-
Received
=
Pending
```

La recepción confirmada representa el evento físico.

---

# 36. Trazabilidad

Inventory debe poder evolucionar para rastrear:

```text
Receipt
↓
Batch / Serial
↓
Inventory
↓
Delivery / Consumption / Return
```

---

# 37. Flujo comercial objetivo

La arquitectura comercial objetivo es:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

Quote es opcional cuando el negocio permite una venta directa.

---

# 38. SalesOrder

SalesOrder representa:

> compromiso comercial.

No representa:

> salida física.

---

# 39. Delivery

Delivery representa:

> cumplimiento físico definitivo.

Una SalesOrder puede tener varias Deliveries.

Esto permite entregas parciales.

---

# 40. Inventory OUT

La salida definitiva ocurre cuando existe el evento físico aprobado.

Conceptualmente:

```text
Delivery CONFIRMED
↓
Inventory Movement OUT
```

No simplemente al confirmar un pedido.

---

# 41. Facturación

Arquitectónicamente:

```text
SalesOrder
≠
Delivery
≠
Invoice
```

Facturación puede ocurrir en momentos diferentes dependiendo del proceso comercial.

La integración fiscal será diseñada como una capacidad específica.

---

# 42. Arquitectura Healthcare

Healthcare extiende ERP Core mediante procesos especializados.

No debe reemplazar las capacidades genéricas.

Conceptualmente:

```text
ERP Core
        │
        └── Healthcare
```

Una venta normal no requiere Case.

---

# 43. Case

`Case` representa el contexto operacional de un procedimiento Healthcare.

Puede relacionarse con:

* médico;
* hospital;
* técnico;
* fecha;
* material;
* equipo;
* oportunidad;
* venta;
* pagador.

---

# 44. Case Logistics

El flujo conceptual es:

```text
Case
↓
Preparation
↓
CaseKit
↓
CaseDispatch
↓
Custody
↓
Procedure
↓
CaseReturn
↓
Inspection
↓
Reconciliation
```

---

# 45. Custodia

Una salida hacia un Case no significa automáticamente una salida definitiva de inventario.

```text
Warehouse
↓
Technician Custody
```

El material puede continuar siendo propiedad de la Company.

Por tanto:

```text
CaseDispatch
≠
Customer Delivery
```

---

# 46. Conciliación Healthcare

La conciliación determina el destino final.

```text
Dispatched
=
Used
+
Returned
+
Unresolved
```

El material utilizado puede generar posteriormente una operación comercial y salida definitiva.

---

# 47. Ubicación, custodia y propiedad

La arquitectura distingue:

```text
Location
Custodian
Availability
Ownership
```

como conceptos diferentes.

El modelo Prisma definitivo para representar estas dimensiones todavía debe diseñarse antes de implementación.

---

# 48. Equipment

El equipo reutilizable debe poder evolucionar hacia activos identificables individualmente.

Conceptualmente:

```text
Equipment Asset
├── serial
├── status
├── location
├── custodian
├── condition
└── history
```

La definición detallada pertenece a Healthcare/Equipment.

---

# 49. API Architecture

La aplicación utiliza REST como interfaz principal entre frontend y backend.

API First significa:

> la capacidad pertenece al backend y puede ser utilizada por múltiples clientes.

No significa que todas las APIs sean públicas.

---

# 50. Application API y Public API

Se distingue entre:

## Application API

Utilizada por aplicaciones oficiales de Zaping.

## Public API

Futura interfaz estable para terceros.

La Public API requerirá adicionalmente:

* versionado;
* scopes;
* rate limits;
* credenciales;
* documentación;
* lifecycle.

---

# 51. Versionado de API

La documentación histórica proponía:

```text
/api/v1/
```

como estándar universal.

Esta decisión **no se considera actualmente formalizada para todas las APIs internas**.

El versionado será obligatorio cuando exista un contrato externo que requiera estabilidad independiente.

Los lineamientos definitivos se establecerán en `API_GUIDELINES.md`.

---

# 52. API orientada al negocio

Los endpoints pueden representar acciones explícitas.

Ejemplo:

```text
POST /purchases/:id/receipts
```

o:

```text
POST /deliveries/:id/confirm
```

cuando expresen mejor el negocio que una operación CRUD genérica.

---

# 53. Validación

Los límites HTTP deben utilizar DTOs.

Actualmente Zaping utiliza:

* `class-validator`;
* `class-transformer`;
* `ValidationPipe`.

La validación estructural pertenece al boundary.

Las reglas complejas pertenecen al dominio.

---

# 54. Seguridad

El flujo conceptual de seguridad es:

```text
Request
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
Audit
```

Las capas concretas pueden ejecutarse en distinto orden técnico cuando el framework lo requiera.

El principio es que ninguna operación crítica dependa de una sola barrera.

---

# 55. Autenticación

Actualmente:

```text
Credentials
↓
Authentication
↓
JWT
↓
Protected Request
```

La estrategia puede evolucionar sin modificar las reglas fundamentales de autorización.

---

# 56. Autorización

Zaping utiliza RBAC como base.

La arquitectura objetivo evoluciona hacia permisos granulares.

```text
User
↓
Role
↓
Permissions
```

RBAC y tenant son controles diferentes.

---

# 57. Protección de datos

No deben exponerse:

* `passwordHash`;
* secretos;
* tokens internos;
* información de otro tenant;
* stack traces;
* detalles internos innecesarios.

Las reglas completas se encuentran en `SECURITY_PRINCIPLES.md`.

---

# 58. Datos Healthcare

Zaping Healthcare no debe convertirse inicialmente en un Electronic Medical Record.

La plataforma debe guardar solamente la información necesaria para logística, operación y proceso comercial.

Información clínica sensible requiere evaluación específica antes de incorporarse.

---

# 59. Transacciones

Las operaciones que producen múltiples efectos inseparables deben ejecutarse atómicamente.

Ejemplo:

```text
PurchaseReceipt
+
ReceiptItems
+
InventoryBatch
+
InventoryMovement
+
Stock
```

Si falla una operación crítica, la transacción debe revertirse.

---

# 60. Idempotencia

Las operaciones confirmables que puedan repetirse por:

* retry;
* doble click;
* red;

deben evitar producir efectos duplicados.

Especialmente:

* Receipts;
* Deliveries;
* Dispatches;
* Returns;
* Reconciliations;
* operaciones financieras.

---

# 61. Integridad histórica

Eventos confirmados no deben reescribirse para ocultar errores.

Preferir:

```text
Original Event
+
Compensating Event
```

sobre modificar silenciosamente la historia.

---

# 62. Dashboard y lectura

Dashboard es principalmente consumidor de información.

No debe convertirse en propietario de reglas empresariales.

Puede utilizar:

* agregaciones;
* read models;
* consultas optimizadas.

---

# 63. Read Models

Cuando los workflows crezcan puede resultar útil construir representaciones optimizadas para lectura.

Ejemplos futuros:

```text
Action Dashboard
Warehouse Operations
Case Calendar
Customer 360
Product 360
```

Estas vistas pueden combinar múltiples dominios sin apropiarse de sus reglas.

---

# 64. Workspaces

Un Workspace representa una experiencia orientada a tareas.

Ejemplo:

```text
Warehouse Operations
```

puede mostrar:

* compras por recibir;
* Cases por preparar;
* Deliveries;
* Returns;
* incidencias.

No necesita convertirse en un nuevo dominio backend.

---

# 65. Eventos de dominio

Zaping está preparado conceptualmente para utilizar Domain Events.

Ejemplos:

```text
PurchaseReceived
DeliveryConfirmed
CaseReconciled
```

Los eventos pueden inicialmente ejecutarse dentro del mismo proceso.

---

# 66. Event Driven no es requisito actual

Zaping **no adopta actualmente** una arquitectura distribuida basada en eventos.

No existe una obligación arquitectónica de introducir:

* Kafka;
* RabbitMQ;
* message brokers;
* event sourcing.

Se utilizarán únicamente si una necesidad futura lo justifica.

---

# 67. Integraciones externas

La arquitectura puede evolucionar hacia integraciones con:

* SAT / CFDI;
* email;
* almacenamiento;
* paqueterías;
* sistemas contables;
* APIs de clientes;
* portales de licitaciones;
* otros proveedores.

Cada integración constituye un límite de confianza.

---

# 68. Radar

Zaping Radar representa una capacidad de inteligencia externa.

Puede requerir arquitectónicamente:

* jobs;
* conectores;
* procesamiento asíncrono;
* normalización de fuentes;
* alertas.

Su despliegue independiente se decidirá cuando exista una necesidad concreta.

---

# 69. AI

Zaping AI será una capa consumidora de información.

Conceptualmente:

```text
Operational Systems
↓
Reliable Data
↓
Context
↓
AI
```

AI no debe convertirse en fuente de verdad para operaciones empresariales críticas.

---

# 70. Performance

La arquitectura debe evitar problemas conocidos como:

* N+1 queries;
* colecciones sin paginación cuando crecen;
* consultas sin índices necesarios;
* procesamiento repetido;
* payloads excesivos.

No se debe optimizar sin medir.

Los objetivos de rendimiento del PRD son referencias iniciales, no SLO productivos formales.

---

# 71. Caching

Caching puede incorporarse cuando exista una necesidad demostrable.

No debe agregarse automáticamente a operaciones cuyo comportamiento correcto depende de información altamente mutable sin una estrategia de invalidación clara.

---

# 72. Escalabilidad

La estrategia inicial de escalamiento puede mantener varias instancias del mismo backend:

```text
Load Balancer
│
├── Zaping Backend
├── Zaping Backend
└── Zaping Backend
```

cuando la infraestructura futura lo requiera.

No es necesario dividir dominios para conseguir escalamiento horizontal básico.

---

# 73. Observabilidad

La plataforma debe evolucionar progresivamente hacia:

* logs estructurados;
* métricas;
* monitoreo;
* alertas;
* tracing cuando sea útil.

La infraestructura concreta dependerá del entorno productivo.

---

# 74. Logging

Deben distinguirse:

```text
Technical Logs
```

de:

```text
Business Audit
```

Los logs ayudan a operar el sistema.

Audit preserva acciones relevantes del negocio.

No son intercambiables.

---

# 75. Deployment

La arquitectura está diseñada para despliegue cloud-native.

Actualmente el proyecto utiliza Docker como parte de su infraestructura técnica.

La topología definitiva de producción deberá formalizarse antes del primer despliegue productivo.

---

# 76. Configuración

La configuración dependiente del entorno debe utilizar variables externas.

Ejemplos:

```text
DATABASE_URL
JWT_SECRET
```

No debe incorporarse configuración sensible al código fuente.

---

# 77. Ambientes

La arquitectura debe distinguir progresivamente:

```text
development
test
staging
production
```

Los secretos y datos no deben compartirse indiscriminadamente entre ellos.

---

# 78. Testing

La arquitectura debe permitir pruebas en diferentes niveles.

Según la funcionalidad:

* unitarias;
* integración;
* componentes;
* E2E;
* QA manual;
* regresión.

Las reglas críticas merecen mayor cobertura.

---

# 79. Áreas de alto riesgo

Se consideran arquitectónicamente sensibles:

* Authentication;
* Authorization;
* Multi-Tenancy;
* Inventory;
* Money;
* Receipts;
* Deliveries;
* Returns;
* Healthcare Custody;
* Migrations;
* Billing.

Los cambios en estas áreas requieren controles adicionales.

---

# 80. C4 Model

La arquitectura utiliza C4 como herramienta de comunicación.

Se mantendrán:

```text
C1 — System Context
C2 — Containers
C3 — Components
```

cuando aporten valor.

---

# 81. C4 Level 4

No se mantendrá un documento manual global de:

```text
C4 — Code
```

porque el código cambia con demasiada frecuencia y produciría documentación rápidamente obsoleta.

El nivel de código se representa mejor mediante:

* source code;
* module documentation;
* tests;
* diagramas específicos cuando sean realmente necesarios.

---

# 82. ADR

Las decisiones arquitectónicas se mantienen en:

```text
docs/architecture/adr/
```

`ARCHITECTURE.md` describe el estado vigente.

ADR explica:

> por qué se eligió.

No debe duplicarse todo el contenido de los ADR dentro de este documento.

---

# 83. Decisiones arquitectónicas vigentes

Entre las decisiones principales se encuentran:

```text
ADR-001  Multi-Tenant
ADR-002  Inventory Movements
ADR-004  UUID
ADR-005  Layered Architecture
ADR-006  API First
ADR-007  RBAC
ADR-008  Documentation First
ADR-009  Modular Monolith
ADR-011  SalesOrder / Delivery
ADR-012  Entity Lifecycle
ADR-013  Inventory Custody / Case Logistics
```

ADR-003 y ADR-010 permanecen únicamente por historia después de haber sido reemplazados.

El índice oficial vive en `architecture/adr/README.md`.

---

# 84. Evolución arquitectónica

La evolución no debe seguir un calendario artificial.

La dirección es:

```text
Modular Monolith
        ↓
Mejores límites
        ↓
Domain Events cuando aporten valor
        ↓
Extracción selectiva de servicios
solo si existe necesidad
```

No existe obligación de llegar a microservicios.

---

# 85. Criterios para separar un servicio

Un dominio puede considerarse candidato cuando exista evidencia como:

* escala independiente;
* lifecycle independiente;
* infraestructura diferente;
* resiliencia específica;
* boundary estable;
* equipo independiente;
* carga especializada.

No porque “podría ser útil en el futuro”.

---

# 86. Compatibilidad con nuevas verticales

ERP Core debe permanecer suficientemente genérico para permitir otras verticales.

Healthcare debe utilizar contratos del Core.

No debe introducir reglas médicas dentro de módulos genéricos cuando esas reglas pertenecen únicamente a la vertical.

---

# 87. Principio de no contaminación

Ejemplo incorrecto:

```text
Inventory Product
├── surgeryId
├── doctorId
└── hospitalId
```

si esos conceptos únicamente existen para Healthcare.

Preferir:

```text
Inventory
↑
Healthcare relationships / orchestration
```

manteniendo separación de dominio.

---

# 88. Principio de extensibilidad

Extensible no significa configurable de manera infinita.

La arquitectura debe proporcionar puntos claros de evolución sin convertir todo en:

* plugins;
* metadata;
* dynamic schemas;
* reglas genéricas;

antes de necesitarlo.

---

# 89. Deuda arquitectónica

Cuando una implementación temporal contradiga la arquitectura objetivo debe registrarse.

Ejemplo actual:

```text
legacy Sale behavior
```

puede continuar existiendo mientras se prepara la transición hacia ADR-011.

El código existente no debe redefinir silenciosamente la arquitectura futura.

---

# 90. Revisión arquitectónica

Cambios que afecten:

* límites de dominio;
* modelo de inventario;
* multi-tenancy;
* seguridad;
* lifecycle;
* arquitectura de integración;
* persistencia fundamental;

deben pasar por revisión arquitectónica y ADR cuando corresponda.

---

# 91. Documentación relacionada

## Producto

```text
product/PRODUCT_VISION.md
product/PRODUCT_REQUIREMENTS.md
```

## Ingeniería

```text
engineering/ENGINEERING_GUIDE.md
engineering/DEVELOPMENT_WORKFLOW.md
engineering/QUALITY_STANDARDS.md
engineering/SECURITY_PRINCIPLES.md
```

## Arquitectura

```text
architecture/adr/
architecture/c4/
```

## Dominios

```text
modules/
```

---

# 92. Invariantes arquitectónicas

Las siguientes propiedades no deben romperse sin una nueva decisión explícita.

## Tenant

```text
Company A
≠
Company B data access
```

## Inventario

```text
Stock change
→ traceable operation
```

## Compra

```text
Purchase
≠
Inventory IN
```

## Recepción

```text
PurchaseReceipt CONFIRMED
→ Inventory IN
```

## Venta

```text
SalesOrder
≠
Inventory OUT
```

## Entrega

```text
Delivery CONFIRMED
→ Inventory OUT
```

## Healthcare

```text
CaseDispatch
≠
Definitive OUT
```

## Historia

```text
Confirmed historical event
→ no silent rewrite
```

## Dominios

```text
Technical DB access
≠
Domain ownership
```

---

# 93. Arquitectura actual vs arquitectura objetivo

Es importante distinguir tres estados.

## Current

Funcionalidad realmente implementada.

## Target

Arquitectura aprobada hacia la que está evolucionando el sistema.

## Future

Posibilidad todavía no comprometida.

Un documento arquitectónico puede describir `Target` sin afirmar que ya se encuentra implementado.

El estado operativo concreto debe consultarse en `PROJECT_BOARD.md`.

---

# 94. Principio final

La arquitectura de Zaping debe permitir que el producto crezca sin perder claridad.

La dirección es:

```text
Correct Domain Boundaries
+
Traceable Business Operations
+
Secure Multi-Tenancy
+
Simple Infrastructure
+
Stable Contracts
```

antes que:

```text
More Services
+
More Layers
+
More Technologies
```

La arquitectura debe volverse más compleja solamente cuando el negocio realmente lo necesite.
