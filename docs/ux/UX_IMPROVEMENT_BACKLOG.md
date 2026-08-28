# UX Improvement Backlog — Zaping

**Estado:** Activo
**Última actualización:** 2026-08-28
**Baseline:** UX-01 completado

---

## 1. Propósito

Este documento registra deuda y oportunidades diferidas durante UX-01.

No constituye autorización para implementar los elementos. Cada bloque requiere
alcance, prioridad y criterios de aceptación propios.

## 2. UX-02 — DataTable y listas operativas

Estado: `DEFERRED / NOT STARTED`

Alcance candidato:

- DataTable;
- sorting;
- filtros consistentes;
- row action menu;
- tablas responsive;
- pagination;
- estados de tabla escalables;
- contratos de columnas que no dependan de `Object.values(row)`.

Debe resolverse antes de migrar módulos:

- modelo de columnas tipado;
- ownership entre UI y feature components;
- estrategia mobile;
- paginación client-side vs server-side;
- accesibilidad de headers, acciones y navegación de páginas.

No se debe migrar Table de forma masiva sin este contrato.

## 3. Inventory tabs

Estado: `DEFERRED`

Inventory mantiene tabs manuales funcionales y accesibles.

UX-02 deberá decidir si:

- se mantienen locales por semántica específica;
- se crea una primitive Tabs reutilizable;
- se integran con una evolución más amplia del workspace de Inventory.

No existe una decisión aprobada de crear Tabs global todavía.

## 4. Accesibilidad — Drawer

Estado: `OPEN`

Ya existe:

- `role="dialog"`;
- `aria-modal`;
- foco inicial en el drawer;
- cierre por Escape;
- scroll lock;
- restore focus al botón de menú.

Pendiente:

- focus trap completo;
- validación sistemática con teclado y lector de pantalla.

## 5. Accesibilidad — Modal

Estado: `OPEN`

Pendiente:

- semántica `dialog` / `aria-modal`;
- asociación accesible de título y descripción;
- foco inicial;
- focus trap;
- cierre por Escape;
- restore focus;
- revisión de scroll y contenido largo;
- pruebas directas de teclado.

Esta deuda aplica al primitive Modal y no debe resolverse mediante parches
inconsistentes en cada módulo.

## 6. Navegación y contexto futuros

Estado: `FUTURE`

- redirect post-login hacia Home autenticado;
- branch/context selector;
- notifications;
- global search;
- role-aware navigation;
- collaboration.

Estos elementos no forman parte de UX-01 ni de UX-02 DataTable por defecto.

La navegación role-aware no sustituye autorización backend.

## 7. Sesión y rutas protegidas

El redirect post-login es una decisión UX futura. La arquitectura de sesión,
rutas protegidas, almacenamiento JWT e invalidación es una revisión de seguridad
P0 separada y permanece gobernada por `PROJECT_BOARD.md` y
`SECURITY_PRINCIPLES.md`.

## 8. Infraestructura de tests frontend

Estado: `OPEN`

El pool automático de Vitest puede agotar el timeout de pruebas UI intensivas.

Baseline confiable de UX-01.6:

- cuatro workers: `469 / 469`;
- serial: `469 / 469`.

Trabajo futuro posible:

- perfilar duración y aislamiento de tests;
- revisar configuración de workers en CI;
- reducir operaciones de teclado simuladas innecesariamente costosas;
- evitar aumentar timeouts globales sin diagnóstico.

Este problema no debe registrarse como bug de aplicación mientras las mismas
pruebas pasen de forma limitada y serial.

## 9. Fuera de alcance

Este backlog UX no redefine:

- workflows de negocio;
- backend o Prisma;
- autorización;
- tenant isolation;
- prioridades P0 de release;
- módulos Healthcare futuros.

## 10. Criterio de entrada para UX-02

Antes de implementar UX-02 debe aprobarse:

- alcance exacto del DataTable;
- primer módulo piloto;
- estrategia responsive;
- contrato de paginación;
- cobertura de accesibilidad;
- plan de migración sin ruptura de workflows.
