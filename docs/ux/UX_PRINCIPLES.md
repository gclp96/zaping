# UX Principles — Zaping

**Estado:** Aprobado
**Última actualización:** 2026-08-29
**Alcance:** Principios transversales de experiencia para Zaping ERP

---

## 1. Propósito

Este documento consolida los principios aplicados durante UX-01.

No sustituye:

- `docs/ux/DESIGN_SYSTEM.md`, que define componentes y fundamentos visuales;
- `docs/product/ZAPING_WAY.md`, que define la filosofía de producto;
- `docs/modules/erp/ERP_UI_UX.md`, que describe el estado funcional del frontend ERP;
- la documentación de cada módulo, que conserva autoridad sobre sus reglas de negocio.

## 2. Simple por defecto

Cada pantalla debe presentar primero:

- contexto;
- estado actual;
- información necesaria;
- acción primaria;
- siguiente paso razonable.

La complejidad adicional debe aparecer sólo cuando el workflow la requiera.

## 3. Consistencia con propósito

Los patrones compartidos deben reutilizarse cuando representan la misma
responsabilidad.

La similitud visual por sí sola no justifica una abstracción. Los componentes
con semántica de negocio legítima, como `KpiCard` en Dashboard, pueden permanecer
locales al módulo.

## 4. Composición de páginas

Cuando corresponda, una página autenticada sigue esta estructura:

```text
AppShell
→ PageContainer
→ PageHeader
→ Section(s)
```

La página debe actuar principalmente como orchestrator. La lógica específica
puede permanecer en hooks o componentes locales cuando eso reduce
responsabilidades reales sin crear infraestructura genérica prematura.

## 5. Jerarquía semántica

Las páginas autenticadas deben mantener:

- un único landmark `main`, propiedad de `AppShell`;
- un `h1` normal por página;
- headings secundarios coherentes;
- labels accesibles para controles que sólo muestran iconos;
- estado activo que no dependa únicamente del color.

Las primitives de layout no deben crear landmarks adicionales.

## 6. Navegación estable

Las rutas públicas no deben cambiar por reorganizaciones internas.

La navegación autenticada debe:

- provenir de una configuración centralizada;
- conservar hrefs estables;
- exponer `aria-current` para la ruta activa;
- mantener labels accesibles en Sidebar colapsado;
- cerrar el drawer después de navegar en mobile/tablet.

## 7. Responsive por estructura

La estrategia responsive de UX-01 es:

- Sidebar persistente en desktop `xl` o superior;
- AppHeader y drawer por debajo de `xl`;
- PageContainer con padding responsive;
- acciones que pueden envolver sin desbordar;
- layouts que usan grids y restricciones explícitas.

La adaptación completa de tablas se resolvió en UX-02 mediante `DataTable`
para listas operativas y `StaticTable` para tablas documentales/de detalle.

## 8. Datos reales y estados honestos

Las pantallas operativas deben consumir APIs reales cuando existen.

No debe representarse:

- un error como cero;
- una petición fallida como éxito;
- una métrica mock como estado operativo real.

Loading, empty y error deben distinguirse. Los retries de fuentes independientes
deben permanecer aislados cuando la pantalla puede seguir siendo útil con datos
parciales.

## 9. Home y Dashboard

Home y Dashboard tienen responsabilidades distintas:

- Home prioriza acciones rápidas y pendientes operativos inmediatos;
- Dashboard presenta un resumen analítico de la operación.

Home no debe duplicar Dashboard ni sustituir sus métricas.

## 10. Accesibilidad progresiva

Cada fase debe preservar o mejorar:

- navegación por teclado;
- foco visible;
- labels;
- relaciones ARIA;
- cierre por Escape cuando corresponda;
- restauración de foco;
- bloqueo de scroll en overlays.

Las deudas conocidas deben documentarse explícitamente. UX-01 no declara
resueltos el focus trap completo del drawer ni la accesibilidad integral de
Modal.

## 11. Reglas de negocio

La normalización UX no debe duplicar ni reinterpretar reglas de dominio.

Los helpers existentes, los servicios backend y la documentación de módulo
continúan siendo las fuentes de verdad funcionales.

## 12. Validación proporcional

Los cambios en shell y primitives requieren cobertura focal y regresión
transversal. Los cambios de una pantalla deben proteger:

- render;
- estados de datos;
- semántica;
- acciones existentes;
- contratos responsive relevantes.

Los fallos por agotamiento del pool de tests deben distinguirse de fallos de
aplicación mediante ejecuciones con workers limitados y seriales.

## 13. Principio de cierre

Una fase UX está completa cuando su comportamiento, semántica, responsive,
tests y documentación están sincronizados, y su deuda diferida está registrada
sin implementarla silenciosamente.
