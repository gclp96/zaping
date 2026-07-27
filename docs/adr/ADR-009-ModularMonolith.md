# ADR-009: Modular Monolith Architecture

**Status:** Proposed  
**Date:** 2026-07-11  
**Decision Owners:** Zaping Team  
**Scope:** Zaping Ecosystem Backend Architecture  

---

## 1. Context

Zaping is evolving into a business software ecosystem composed of:

- Zaping ERP
- Zaping Radar
- Zaping AI
- Customer Portal
- Mobile Applications
- Public API

The platform requires clear module boundaries, long-term maintainability
and the ability to evolve without introducing unnecessary operational
complexity during its early development stages.

The current engineering capacity, product maturity and deployment
requirements do not justify adopting a distributed microservices
architecture.

However, implementing Zaping as an unstructured traditional monolith
would create excessive coupling between modules and make future evolution
more difficult.

A balanced architecture is required.

---

## 2. Decision

Zaping will use a Modular Monolith architecture.

The backend will remain a single deployable application while being
internally divided into independent business modules with explicit
responsibilities and public contracts.

Initial backend structure:

Application
│
├── Auth
├── Companies
├── Users
├── Roles and Permissions
├── Customers
├── Suppliers
├── Products
├── Inventory
├── Purchases
├── Quotes
├── Sales
├── Dashboard
└── Audit

Each module owns its business rules and its application operations.

---

## 3. Module Ownership

Every business capability must have one owning module.

Examples:

- Inventory owns stock calculations and inventory movements.
- Purchases owns the purchasing lifecycle.
- Sales owns the sales lifecycle.
- Quotes owns quotation states and conversion rules.
- Auth owns authentication.
- Users and Permissions own access-control configuration.
- Dashboard only consumes information and never owns business rules.

Business rules must not be duplicated across modules.

---

## 4. Communication Between Modules

Modules must communicate through explicit public contracts.

Allowed communication mechanisms:

- Application services
- Public service methods
- Defined interfaces
- Domain events in future stages
- REST APIs for external applications

A module must not access another module's persistence implementation
directly.

Example:

```text
Purchases
    ↓
InventoryApplicationService
    ↓
Inventory

ADR-009 — Arquitectura de Monolito Modular

Estado inicial: Propuesto
Alcance: Backend de Zaping ERP y evolución del ecosistema
Decisión principal: Zaping se desarrollará como un monolito modular.

1. Contexto

Zaping ya cuenta con varios módulos de negocio dentro de una sola aplicación NestJS: autenticación, empresas, clientes, proveedores, productos, inventario, compras, cotizaciones, ventas y dashboard.

La documentación arquitectónica establece que la plataforma debe ser modular, multiempresa, API First y orientada a capacidades de negocio. También define como evolución futura los eventos de dominio y una posible arquitectura orientada a servicios, pero solo antes de llegar a microservicios cuando esté justificado.

2. Problema

Debemos evitar dos extremos:

Un monolito tradicional donde todos los módulos accedan directamente a datos y reglas ajenas.
Una arquitectura de microservicios prematura que aumente costos, complejidad operativa, despliegues, comunicación de red y transacciones distribuidas.

Para la etapa actual, microservicios sería sobreingeniería. El proyecto debe priorizar simplicidad, mantenibilidad, consistencia y valor de negocio.

3. Decisión propuesta

Zaping tendrá:

Una aplicación NestJS
        ↓
Módulos de negocio independientes
        ↓
Un esquema Prisma
        ↓
Una base de datos PostgreSQL

Cada módulo conservará la propiedad exclusiva de sus reglas de negocio.

Ejemplo:

Purchases
    ↓ solicita una entrada
InventoryService
    ↓ aplica reglas de inventario
InventoryMovement

PurchasesService no debería crear movimientos de inventario directamente mediante Prisma. Debe solicitar la operación al módulo de inventario.

4. Reglas obligatorias
Cada capacidad tendrá un módulo propietario.
Ningún módulo accederá directamente al repositorio de otro módulo.
Los módulos se comunicarán mediante servicios públicos, interfaces o eventos futuros.
Las reglas de negocio no se duplicarán.
Los controladores permanecerán delgados.
Prisma se utilizará únicamente desde la capa de persistencia correspondiente.
Se evitarán dependencias circulares.
Las carpetas compartidas no contendrán reglas específicas de negocio.
Toda consulta mantendrá el aislamiento por companyId.
La separación en microservicios requerirá un nuevo ADR y evidencia medible.
5. Propiedad inicial de módulos
Módulo	Responsabilidad principal
Auth	Autenticación y generación de tokens
Companies	Empresas y contexto multiempresa
Users/RBAC	Usuarios, roles y permisos
Customers	Clientes
Suppliers	Proveedores
Products	Catálogo de productos
Inventory	Existencias y movimientos
Purchases	Ciclo de compras
Quotes	Ciclo de cotizaciones
Sales	Ciclo de ventas
Dashboard	Consulta y presentación de indicadores
Audit	Registro de acciones relevantes

El dashboard podrá consumir información, pero no será propietario de reglas de clientes, ventas, compras o inventario.

6. Consecuencias positivas
Menor complejidad de infraestructura.
Un solo despliegue.
Transacciones más sencillas.
Desarrollo local más fácil.
Límites claros entre módulos.
Mejor preparación para separar servicios en el futuro.
Arquitectura adecuada para el tamaño actual del equipo.
7. Consecuencias negativas
Todos los módulos comparten el ciclo de despliegue.
Una falla grave puede afectar toda la aplicación.
Los límites modulares dependen de disciplina técnica.
La base de datos compartida puede generar acoplamiento si no se respetan las reglas.
No habrá escalamiento independiente por módulo inicialmente.
8. Criterios para extraer un servicio en el futuro

Un módulo podrá separarse únicamente cuando exista una necesidad comprobable, como:

Escalamiento independiente.
Requisitos de disponibilidad diferentes.
Carga de trabajo especializada.
Necesidad de aislamiento de seguridad.
Equipo responsable independiente.
Problemas medibles causados por el despliegue conjunto.
Necesidad real de contener fallos.

El crecimiento hipotético no será suficiente.

9. Criterios de aceptación

ADR-009 podrá marcarse como aceptado cuando:

Se declare formalmente el monolito modular como arquitectura vigente.
Se documenten las responsabilidades de cada módulo.
Se prohíba el acceso directo entre repositorios de distintos módulos.
Se documente la estrategia de base de datos compartida.
Se establezcan criterios objetivos para una futura separación.
Se revise el código actual para identificar violaciones.
Se sincronice ARCHITECTURE.md.
Se actualice PROJECT_BOARD.md.