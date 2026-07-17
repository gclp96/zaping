# 📋 Zaping ERP - Project Board

| Proyecto | Zaping ERP |
|----------|------------|
| Estado | 🟢 Desarrollo Activo |
| Versión | v0.9.0-alpha.1 |
| Sprint Actual | Sprint 09 |
| Milestone | Business Components Library |

---

# Milestones

| ID | Milestone | Estado |
|---|---|---|
| M1 | Foundation v1.0 | ✅ Completado — 2026-07-11 |
| M2 | Business Components Library | 🟢 En progreso |
| M3 | Purchases Module | 🟢 In Progress |
| M4 | Quotes Module | ⏳ Pendiente |
| M5 | Sales Module | ⏳ Pendiente |
| M6 | MVP Comercial | ⏳ Pendiente |

---

# Foundation v1.0

**Estado:** Completado  
**Fecha de cierre:** 2026-07-11  

## Decisiones aceptadas

| ID | Decisión | Estado |
|---|---|---|
| ADR-001 | Arquitectura Multiempresa | ✅ Aceptado |
| ADR-002 | Inventario basado en movimientos | ✅ Aceptado |
| ADR-003 | Eliminación lógica | ✅ Aceptado |
| BC-004 | SupplierSelector | 🚧 Implemented — Pending integration | Alta |
| ADR-005 | Arquitectura por capas | ✅ Aceptado |
| ADR-006 | Arquitectura API First | ✅ Aceptado |
| ADR-007 | Control de acceso basado en roles | ✅ Aceptado |
| ADR-008 | Desarrollo Documentation First | ✅ Aceptado |
| ADR-009 | Arquitectura de Monolito Modular | ✅ Aceptado |
| ADR-010 | Arquitectura de Componentes de Negocio | ✅ Aceptado |

## Resultado

Foundation v1.0 establece las bases obligatorias de arquitectura, seguridad,
documentación, multi-tenancy, persistencia y organización del frontend.

El siguiente milestone activo es Business Components Library.

------------

# Sprint 09

## Objetivo

Construir la primera versión de la Business Components Library e integrar
sus componentes iniciales en los módulos existentes.

## Business Components Library

| ID | Componente | Estado | Prioridad |
|---|---|---|---|
| BC-001 | StatusBadge | ✅ Completed | Alta |
| BC-002 | MoneyInput | ✅ Completed | Alta |
| BC-003 | DateInput | ⏸️ Deferred | Alta |
| BC-004 | SupplierSelector | ✅ Completed | Alta |
| BC-005 | CustomerSelector | ⬜ Pending | Alta |
| BC-006 | ProductSelector | ✅ Completed | Alta |

BC-003 se difiere hasta definir e implementar un campo de fecha de negocio,
como fecha de compra, vigencia de cotización o fecha estimada de entrega.
No se crearán componentes sin un caso de uso real.

---

# Riesgos

- Definir correctamente la API de los selectores.
- Evitar duplicación entre módulos.
- Mantener consistencia del Design System.

---

| ID      | Tipo         | Nombre              | Estado         | Sprint     | Prioridad |
| ------- | ------------ | ------------------- | -------------- | ---------- | --------- |
| MOD-001 | Module       | Customers           | ✅ Released     | Sprint 05  | High      |
| MOD-002 | Module       | Products            | ✅ Released     | Sprint 06  | High      |
| MOD-003 | Module       | Inventory           | 🚧 In Progress | Sprint 09  | Critical  |
| DOC-001 | Document     | Vision              | ✅ Approved     | Foundation | High      |
| ADR-002 | Architecture | Inventory Movements | ✅ Accepted     | Foundation | Critical  |
| UI-014  | Component    | StatusBadge         | 🚧 Ready       | Sprint 09  | Medium    |
| BC-001  | Business Component | StatusBadge   | ✅ Completed    | Sprint 09 | High |
| FEAT-PUR-001 | Feature | Crear compra | ✅ Completed | Sprint 09 | High |
| FEAT-PUR-002 | Feature | PDF de orden de compra | ✅ Completed | Sprint 09 | Medium |
| FEAT-PUR-003 | Feature | Vista de detalle de compra | ✅ Completed | Sprint 09 | Medium |
| FEAT-PUR-004 | Feature | Editar compra en borrador | ✅ Completed | Sprint 09 | High |
| FEAT-PUR-005 | Feature | Trazabilidad de movimientos por compra | ✅ Completed | Sprint 09 | Medium |
| DOC-PUR-001 | Docs | Documentación final del módulo Compras | ✅ Completed | Sprint 09 | High |
| Sprint 09 | Business Components + Purchases | ✅ Completed |
| DOC-S09-001 | Docs | Cierre formal de Sprint 09 | ✅ Completed | Sprint 09 | High |

# Próximo Objetivo

refinar el modulo Purchases:
ADR-009