# UX Decisions — Zaping

**Estado:** Aprobado
**Última actualización:** 2026-10-22
**CURRENT:** OX-SHELL-01A integrado — shell mínimo y navegación operativa.
**Baseline histórica:** UX-01 — App Shell v2 y consolidación de fundamentos (2026-08-28).

---

Este documento conserva el objetivo, historia y evidencia de UX-01 como baseline. Las secciones 4–7 distinguen esa baseline del CURRENT posterior a [OX-SHELL-01A](../project/OX_SHELL_01A_TICKET.md), integrado por [PR #107](https://github.com/gclp96/zaping/pull/107), funcional `27a5c6c0c4ab7ecc78cb534aba3cef1e5b802792`, merge `a5b46f1c683a8aa581ef9b295fad2a7ee67e1149` (2026-10-22). No reinterpreta la evidencia histórica como pruebas de la versión actual.

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

**Baseline UX-01:** consolidó un único main autenticado, Sidebar desktop, AppHeader responsive, drawer mobile/tablet, preferencia de colapso persistida y título derivado de navegación centralizada. Las páginas de módulo no montan Sidebar, Header o main propios.

**CURRENT posterior a OX-SHELL-01A:** AppShell conserva esas responsabilidades y el bootstrap de sesión; aloja un **AppHeader mínimo persistente en escritorio y móvil**. Una sola instancia de **UserMenu accesible, fuera de Sidebar**, recibe identidad y el callback de logout existente. Cambiar contraseña conserva /change-password y su título mediante metadata de cuenta independiente de los grupos operativos. No se crean otra sesión, autenticación ni permisos backend.

## 5. Sidebar

La baseline UX-01 aportó expansión por defecto, colapso desktop, preferencia en localStorage, labels accesibles al colapsar, aria-current, agrupación en navigation.ts y hrefs históricos.

**CURRENT:** esas capacidades se conservan, con Sidebar **exclusivamente operativa**. Cambiar contraseña y Cerrar sesión están en UserMenu, no en Sidebar desktop expandida/colapsada ni en el drawer. Los demás grupos, rutas y filtros por rol se conservan.

El **focus trap completo del drawer permanece OPEN como deuda histórica independiente**; véase [UX Improvement Backlog](UX_IMPROVEMENT_BACKLOG.md#4-accesibilidad--drawer). OX-SHELL-01A mejora el cierre al cruzar xl y el foco asociado, pero no implementa ni cierra esa deuda.

## 6. AppHeader

**Baseline UX-01 (histórica):** aparecía por debajo de xl, mostraba contexto compacto, abría el drawer con aria-controls/aria-expanded, no introducía un segundo h1 y no reservaba espacio en desktop xl o superior.

**CURRENT posterior a OX-SHELL-01A:**

- AppHeader mínimo persistente desktop y móvil, con contexto compacto de página y UserMenu; no introduce otro h1 ni main.
- El botón de navegación sólo está disponible por debajo de xl; conserva relación y estado accesibles del drawer.
- UserMenu es un disclosure con botón nativo, nombre accesible que incluye la identidad visible, aria-expanded/aria-controls, enlace real a Cambiar contraseña y botón Cerrar sesión. Conserva teclado, Escape y restauración de foco; delega en el logout existente.
- Con drawer móvil abierto, UserMenu se retira temporalmente para evitar un control interactuable detrás del dialog; vuelve cerrado al cerrar el drawer.

**DEC-OX-050: PARCIALMENTE IMPLEMENTADA.** DEC-OX-049/055/056 sustentan la reubicación de cuenta y la navegación operativa. La autorización Stage 3 fue exclusiva de este slice, no de toda la top bar ni de Stage 3 general. No se implementaron Company selector, notificaciones, calendario, reloj, branding, mensajes, perfil editable ni cambios de Dashboard derivados de este incremento.

## 7. Estrategia responsive

**Baseline UX-01 (histórica):**

```text
mobile / tablet / laptop menor a xl
→ AppHeader + drawer

desktop xl o superior
→ Sidebar persistente + sin AppHeader
```

**CURRENT posterior a OX-SHELL-01A:**

```text
por debajo de xl
→ AppHeader persistente + UserMenu + navegación mediante drawer
  (UserMenu temporalmente retirado mientras el drawer esté abierto)

desde xl
→ Sidebar operativa persistente, expandida/colapsada + AppHeader + UserMenu
```

El xl construido corresponde a 80rem. Al entrar a desktop con drawer abierto, se cierra su estado, se restaura el scroll y se retiran listeners; no se restaura foco al botón móvil oculto. Si el foco queda en el drawer/su trigger/body se mueve al main existente, conservando un foco que ya esté en otro control. Volver a móvil no reabre el drawer. La media query interna debe mantenerse alineada si cambia el breakpoint del tema.

Los breakpoints usan las clases compartidas; la sincronización de estado del drawer usa matchMedia. No se rediseñó Table ni se resolvieron tablas responsive avanzadas. La evidencia de OX-SHELL-01A —111/111 locales, checks y CI API/Web PASS, QA manual PASS reportado por el usuario— y su historial se registran en el [ticket](../project/OX_SHELL_01A_TICKET.md). No se atribuye esta evidencia nueva al cierre UX-01.6 de 2026-08-28 que se conserva más abajo.

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
