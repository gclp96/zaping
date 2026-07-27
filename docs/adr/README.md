# Architecture Decision Records

**Proyecto:** Zaping  
**Versión de Foundation:** 1.0.0  
**Estado:** Completado  
**Última actualización:** 2026-07-11  

---

## Propósito

Este directorio contiene los Architecture Decision Records del ecosistema
Zaping.

Los ADR documentan decisiones arquitectónicas importantes, su contexto,
alternativas consideradas, consecuencias y estado de aprobación.

Las decisiones aceptadas son vinculantes para el desarrollo del sistema.

---

## Estados

| Estado | Descripción |
|---|---|
| Propuesto | La decisión está en análisis. |
| Aceptado | La decisión fue aprobada y debe aplicarse. |
| Rechazado | La propuesta fue evaluada y descartada. |
| Reemplazado | Una decisión posterior sustituyó al ADR. |
| Obsoleto | La decisión ya no aplica al sistema actual. |

---

## ADR aceptados

| ID | Decisión | Estado |
|---|---|---|
| ADR-001 | Arquitectura Multiempresa | Aceptado |
| ADR-002 | Inventario basado en movimientos | Aceptado |
| ADR-003 | Eliminación lógica | Aceptado |
| ADR-004 | Estrategia de identificadores UUID | Aceptado |
| ADR-005 | Arquitectura por capas | Aceptado |
| ADR-006 | Arquitectura API First | Aceptado |
| ADR-007 | Control de acceso basado en roles | Aceptado |
| ADR-008 | Desarrollo Documentation First | Aceptado |
| ADR-009 | Arquitectura de Monolito Modular | Aceptado |
| ADR-010 | Arquitectura de Componentes de Negocio | Aceptado |

---

## Resumen de Foundation v1.0

Foundation v1.0 establece las bases arquitectónicas de Zaping:

- Arquitectura SaaS multiempresa.
- Aislamiento de información mediante `companyId`.
- Inventario basado en movimientos.
- Eliminación lógica.
- Identificadores UUID.
- Arquitectura por capas.
- Diseño API First.
- Autorización mediante roles y permisos.
- Documentación previa a la implementación.
- Backend organizado como monolito modular.
- Frontend separado en páginas, features, componentes de negocio y
  componentes UI.

---

## Reglas

1. Las decisiones aceptadas deben respetarse en nuevas implementaciones.
2. Una modificación arquitectónica significativa requiere un nuevo ADR.
3. Los ADR aceptados no deben editarse para ocultar decisiones anteriores.
4. Una decisión reemplazada debe conservarse y enlazar al ADR sucesor.
5. Cada ADR debe registrar contexto, decisión, alternativas y consecuencias.
6. El Project Board y la documentación arquitectónica deben mantenerse
   sincronizados.

---

## Próxima etapa

Con Foundation v1.0 completado, el siguiente milestone es:

**Business Components Library**

Primer componente:

**BC-001 — StatusBadge**