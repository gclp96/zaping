# RECEIPTS-REDESIGN-01 — Plan de implementación y control de alcance

**Estado:** PLAN / RR-001 documentado; RR-002 y siguientes aún no iniciados  
**Base:** `RECEIPTS_REDESIGN_01_SPEC.md`  
**Responsable de decisión:** revisión de producto/UX en chat  
**Política de ramas:** `feat/receipts-redesign-01` nace de `main`; **no modifica** PR #167 ni la cadena Draft R2/ClamAV.

## Contrato de layout RR-001

Medidas, breakpoints, navegación, scroll, focus management y ubicación compacta
de adjuntos: [`RECEIPTS_REDESIGN_01_RR001_LAYOUT_CONTRACT.md`](./RECEIPTS_REDESIGN_01_RR001_LAYOUT_CONTRACT.md).

El contrato está **documentado**, pero no validado en navegador; no se debe
dar por terminado el gate de implementación sin pruebas manuales de diseño.

## Objetivo de la iteración

Alinear la interfaz de captura de Purchase Receipts con el boceto aprobado: panel ancho, tabla de partidas operativa, zona compacta de adjuntos en la parte inferior izquierda y resumen a la derecha; conservar sin cambios la semántica y permisos de las recepciones actuales.

**Definition of Ready del MVP:** especificación firmada/aceptada en revisión; decisiones pendientes sobre ancho, navegación y ownership de los puntos de entrada resueltas; rama base correcta y sin cambios locales involuntarios; contratos existentes y matrices QA identificados; riesgos de duplicación de formularios evaluados. Los story points son **estimaciones iniciales**, no compromisos de fecha.

## Tickets propuestos

| ID | Ticket | SP | Dependencias | Acceptance / salida |
| --- | --- | ---: | --- | --- |
| RR-001 | Definir layout UX (desktop/móvil, panel, footer, foco y descarte) | 3 | Spec | **Contrato documentado** en RR001_LAYOUT_CONTRACT; **QA visual/aceptación pendiente** |
| RR-002 | Consolidar contenedor y estados compartidos de recepción | 5 | RR-001 | Dos entradas, mismo hook; ningún duplicado de reglas, flag OFF conserva modal |
| RR-003 | Construir captura responsive de partidas y metadatos | 5 | RR-002 | Cantidades, lotes, caducidad, documentos y notas funcionalmente equivalentes |
| RR-004 | Añadir resumen operativo derivado | 2 | RR-003 | Totales reales de unidades a ingresar y pendientes; cero campos de rechazo |
| RR-005 | Integrar Zaping Files UI compacto (solo vista previa) | 3 | RR-003 + coordinación #167 | Adjuntos izquierda, sin bytes/red; envío bloqueado con selección no guardada |
| RR-006 | QA automatizado + manual por rol y regresión | 5 | RR-002…005 | Tests, build, lint, teclado, móvil, reversión por flag, CI |
| RR-007 | Revisión de seguridad y readiness de rollout | 2 | RR-006 | Sign-off de NO upload y permisos; PR Draft con evidencia; rollout solo cuando aprobado |

**Estimación preliminar:** 25 SP; capacidad y forecast deben ajustarse en sprint planning. El plan puede dividirse en un sprint de maquetación/estado y otro de QA/integración, sin fijar fechas de entrega sin revisar capacidad.

## Criterios transversales de Definition of Done

- El flujo nuevo está protegido por una flag OFF por defecto e independiente del flag de Zaping Files.
- No se agrega ninguna operación real de rechazo de mercancía, borradores, múltiples almacenes ni confirmación separada.
- El formulario previo puede restaurarse con la flag; no se pierde el camino desde Compras ni desde Recepciones.
- Los usuarios autorizados pueden registrar parciales y completos igual que antes; no hay cambios en guardias backend, API, validación, idempotencia o mutaciones de inventario.
- No se guardan archivos localmente ni en Cloudflare R2; seleccionar vista previa no permite completar recepción mientras no exista persistencia.
- Pruebas unitarias e integración frontend verdes, build/typecheck/lint PASS, QA manual en desktop/tablet/móvil, incluyendo modal/panel scroll y accesibilidad.
- Documentación, screenshots de QA manual y resultado CI anexados al PR de implementación; ninguna afirmación de funcionalidad confirmada sin su prueba.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Duplicación de captura entre Compras/Recepciones | Reglas divergentes, bugs | Un componente/hook de captura compartido; doble entrada con tests |
| Referencia visual introduce rechazo/borrador/warehouse inexistentes | Datos falsos o inventario incorrecto | Ocultar acciones no soportadas; tickets de dominio independientes |
| UX de adjuntos promete persistencia | Evidencia documental perdida | Señalizar prototipo, bloquear confirmación con archivo seleccionado |
| PR #167 todavía no incluido en main | Imports inexistentes/conflictos | Separar especificación de integración; basar implementación en commit consciente o PR stacked coordinado |
| Panel denso en resoluciones pequeñas | Captura inaccesible | Diseño mobile-first, footer sin superposición, scroll único y test a 200% |
| Permisos o idempotencia alterados | Riesgo multiempresa y duplicados | Reusar guardias/API/hook; matriz por roles y pruebas de replay |
| Colisión con trabajo INSAP local/stash | Pérdida de cambios | No cambiar worktree del usuario remotamente; usar ramas/PR separados, preservar stash sin aplicar |

## Entregas / gates

**Gate 0 (este PR):** contrato de diseño y alcance. Ningún código de aplicación cambia.

**Gate 1:** layout compartido en pantalla con datos existentes detrás de flag; comparación visual con boceto; no rediseñar semántica.

**Gate 2:** pruebas y firma de regresión (compra elegible/ineligible, parcial, lotes, error de red, roles, datos reales solo en QA autorizado), cumplimiento de accesibilidad, no-network de archivos.

**Gate 3 (futuro, proyecto distinto):** backend R2 integrado y verificado (permisos positivos mínimos B3d5b3c2b, verificación antimalware, promoción segura B3d5c, API tenant-scoped); recién entonces habilitar adjuntos reales.

## Protocolo de implementación

1. Aprobar el contrato visual y el alcance de este PR Draft.
2. No mezclar con cambios locales de INSAP ni consumir su stash.
3. Antes de cada ticket: DoR, criterios verificables, alcance limitado y pruebas previstas.
4. Mantener commits pequeños, CI por bloque y reporte explícito PASS/FAIL.
5. Abrir PR de código solo después de definir cuál será su base con respecto a #167.
6. No fusionar ni desplegar automáticamente. El cierre requiere revisión funcional/manual y aprobación de seguridad según corresponda.

**Sin promesas de release:** el rediseño no convierte por sí solo Zaping Files en funcionalidad productiva.
