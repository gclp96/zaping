# UX Decisions — Zaping

**Estado:** Aprobado
**Última actualización:** 2026-08-28
**Decisión vigente:** UX-01 — App Shell v2 y consolidación de fundamentos

---

## 1. Objetivo de UX-01

UX-01 consolidó una base frontend estable antes de iniciar componentes de datos
más avanzados.

El alcance fue:

- estabilizar primitives existentes;
- introducir semantic tokens;
- evolucionar layout primitives;
- implementar AppShell y Sidebar v2;
- crear Home autenticado;
- normalizar outliers estructurales claros;
- cerrar con regresión y documentación.

UX-01 no agregó nuevos workflows de negocio.

## 2. Historial de implementación

| Fase | Resultado | Commit |
| --- | --- | --- |
| UX-01.0 | Freeze y estabilización de primitives/semántica | `4247ab0` |
| UX-01.1 | Semantic Tokens Foundation | `0170682` |
| UX-01.2 | Layout Primitives Evolution | `2e0ec46` |
| UX-01.3 | AppShell, Sidebar v2 y AppHeader | `4b32899` |
| UX-01.4 | Authenticated Home V1 | `c0689d1` |
| UX-01.5 | Categories outlier normalization | `3e67b53` |
| UX-01.6 | Regresión final y cierre documental | sin commit al redactar este cierre |

## 3. Semantic tokens

La interfaz compartida utiliza tokens semánticos para superficie, texto,
borde, foco, estados y movimiento.

Decisión:

- los componentes compartidos expresan intención semántica;
- los módulos no deben crear un sistema visual paralelo;
- la migración puede ser progresiva cuando no exista riesgo funcional.

Fuente técnica: `docs/ux/DESIGN_SYSTEM.md`.

## 4. AppShell v2

`AppShell` es propietario de:

- el único `main` autenticado;
- Sidebar desktop;
- AppHeader responsive;
- drawer mobile/tablet;
- estado colapsado persistente;
- título de ruta derivado de navegación centralizada.

Las páginas de módulo no montan Sidebar, Header o `main` propios.

## 5. Sidebar

Decisiones vigentes:

- expandido por defecto;
- colapsable en desktop;
- preferencia persistida en `localStorage`;
- labels accesibles cuando está colapsado;
- `aria-current="page"` para active state;
- navegación agrupada desde `navigation.ts`;
- hrefs históricos conservados.

El focus trap completo del drawer queda diferido como deuda de accesibilidad.

## 6. AppHeader

AppHeader:

- aparece por debajo de `xl`;
- muestra contexto compacto de la ruta;
- controla la apertura del drawer;
- expone `aria-controls` y `aria-expanded`;
- no introduce un segundo `h1`;
- no reserva espacio en desktop `xl` o superior.

## 7. Estrategia responsive

```text
mobile / tablet / laptop menor a xl
→ AppHeader + drawer

desktop xl o superior
→ Sidebar persistente + sin AppHeader
```

Los breakpoints están expresados en clases compartidas. UX-01 no rediseñó
Table ni resolvió todavía tablas responsive avanzadas.

## 8. Layout primitives

### PageContainer

- `default`: conserva el ancho compatible sin max-width global nuevo;
- `wide`: contenido sin restricción de max-width;
- `narrow`: `max-w-3xl`;
- padding responsive compartido;
- no renderiza `main`.

### PageHeader

- título como `h1`;
- descripción opcional;
- action responsive con wrapping seguro.

### Section

- título opcional como `h2`;
- descripción con o sin título;
- action responsive;
- contenido sin framing visual obligatorio.

## 9. Home vs Dashboard

Se mantienen como superficies diferentes:

- `/home`: acciones rápidas, pendientes y resumen operativo breve;
- `/dashboard`: métricas y lectura analítica existente.

Home consume exactamente:

- `GET /dashboard`;
- `GET /equipment`;
- `GET /purchases`.

`useHomeData` concentra estado remoto, carga y retries. `HomeAttentionSection`
deriva y presenta alertas. Las reglas de recepción siguen reutilizando
`canRegisterPurchaseReceipt`.

## 10. Outlier normalization

Categories fue el único `NORMALIZE NOW` de UX-01.5.

Adoptó:

- PageContainer;
- PageHeader;
- Section;
- Loading;
- EmptyState existente.

Su CRUD, APIs, textos y reglas permanecieron intactos.

Inventory tabs se conservaron y su posible migración se difirió. `KpiCard` de
Dashboard se confirmó como componente local de negocio legítimo.

## 11. Componentes afectados

UX-01 modificó principalmente:

- semantic tokens en `globals.css`;
- PageContainer, PageHeader y Section;
- AppShell, Sidebar, AppHeader y navegación;
- Home y sus componentes locales;
- layout de Categories;
- tests de shell, primitives, Home y Categories.

## 12. Definition of Done

UX-01 se considera completado cuando:

- las rutas aprobadas existen y compilan;
- AppShell mantiene un único `main`;
- cada página mantiene un `h1` normal;
- Sidebar y drawer conservan sus contratos responsive;
- Home usa datos reales y no duplica Dashboard;
- layout primitives conservan sus variantes;
- Categories usa primitives compartidos;
- tests con workers limitados y seriales pasan;
- build y lint pasan;
- deuda UX-02 y accesibilidad queda documentada;
- no se introducen cambios backend o de negocio.

## 13. Evidencia de cierre

Validación UX-01.6 del 2026-08-28:

- shell/primitives/Home focal: `75 / 75`;
- frontend completo con cuatro workers: `469 / 469`;
- frontend serial: `469 / 469`;
- build Next.js: PASS, 19 páginas generadas;
- frontend lint: PASS;
- rutas aprobadas: presentes.

El pool automático puede agotar el timeout de algunos tests UI. Esta diferencia
está clasificada como deuda de infraestructura del runner porque las mismas
pruebas pasan con concurrencia limitada y en serial.

## 14. Límite del cierre

UX-01 completado no significa:

- H8 completado;
- ERP Core V1 cerrado;
- listo para pilot o producción;
- deudas P0 de seguridad resueltas.

Es un cierre del workstream de fundamentos UX. El estado general del proyecto
continúa gobernado por `docs/project/PROJECT_BOARD.md`.

## 15. Estado

```text
UX-01
COMPLETED
```

UX-02 no se inicia mediante este documento.
