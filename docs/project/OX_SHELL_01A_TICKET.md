# OX-SHELL-01A — Menú de usuario y reubicación de acciones de cuenta

**Estado vigente:** DONE / MERGED — OX-SHELL-01A. **Cierre administrativo documental:** preparado para revisión, sin commit documental todavía.
**Workstream:** M-OX1 — Great Operational Experience — OPEN; no se inicia otro incremento UX.
**Started:** 2026-10-21. **Merged:** 2026-10-22. **Actualización de cierre:** 2026-10-22.
**PR integrado:** [#107](https://github.com/gclp96/zaping/pull/107).
**Commit funcional:** `27a5c6c0c4ab7ecc78cb534aba3cef1e5b802792`.
**Merge SHA:** `a5b46f1c683a8aa581ef9b295fad2a7ee67e1149`, verificado como integrado en origin/main.

## Cierre post-merge — estado actual

La implementación de UserMenu y la navegación exclusivamente operativa está integrada. Los criterios de aceptación están aceptados, Code Review realizado y ambos hallazgos **P2-01 CLOSED / P2-02 CLOSED**. Se conserva el alcance mínimo aprobado: AppHeader persistente desktop/móvil, acciones de contraseña/logout fuera de Sidebar, ruta y título /change-password, y el mecanismo de sesión/logout existente. No se declara completado M-OX1, DEC-OX-050 ni Stage 3 general.

| Gate | Evidencia de cierre |
| --- | --- |
| QA automatizada local posterior a los fixes | **111/111 PASS en ocho suites**: 32 UserMenu/AppShell y 79 regresiones relacionadas; cuatro roles cubiertos. |
| Checks locales | **Typecheck frontend, ESLint, build Next.js, Prettier focal y whitespace PASS**, conservados de la versión funcional aprobada. |
| QA manual | **PASS reportado y aceptado por el usuario**: desktop, responsive, zoom 200 %, accesibilidad, teclado, foco, logout y roles; transición xl y nombre accesible acreditados en el reporte. Codex no ejecutó esa QA manual. |
| Code Review | Realizado; P2-01/P2-02 corregidos, con regresiones y aceptación posterior. |
| CI remota del PR | [CI #333](https://github.com/gclp96/zaping/actions/runs/39746006362): jobs **API SUCCESS / Web SUCCESS**, sobre el commit funcional. No se atribuyen cantidades locales de pruebas a CI ni se afirma una ejecución post-merge adicional. |
| Integración | PR #107 MERGED, merge SHA verificado en origin/main; fecha 2026-10-22. |

La deuda histórica del **focus trap completo del drawer permanece OPEN e independiente**, registrada en [UX Improvement Backlog, accesibilidad del drawer](../ux/UX_IMPROVEMENT_BACKLOG.md#4-accesibilidad--drawer). No se resolvió ni se aceptó formalmente su cierre por integrar este slice. [CURRENT del shell](../ux/UX_DECISIONS.md#4-appshell-v2) y [Project Board](PROJECT_BOARD.md) se sincronizan en este cierre documental.

**Métricas vigentes:** 5 SP exclusivamente **preliminares**. Sin Target, Forecast, Commitment, Actual SP, velocidad ni asignación Sprint 01 aprobados. No imputar OX-SHELL-01A al Sprint 1 histórico de Healthcare. Se conserva Started acreditado y se registra Merged verificado; no se deducen horas/esfuerzo de fechas Git. Tiempo estimado/real y duración de bloqueo/retrabajo siguen sin registro cuantificado.

**Límites y autorización actuales:** este cierre sólo modifica los tres documentos aprobados, en rama documental independiente desde origin/main. Sin staging, commit, push o PR documental todavía. El merge funcional ya ocurrió; las restricciones previas de no commit/push/merge que aparecen más abajo son historia de cada etapa, no restricciones actuales de la implementación integrada. La autorización Stage 3 sigue limitada únicamente a OX-SHELL-01A. DONE / MERGED no equivale a despliegue o habilitación general de producción.

## Historial conservado de preparación, correcciones y aceptación

Los registros siguientes reflejan lo conocido y autorizado en cada momento. Sus estados NOT MERGED, QA PENDING, READY FOR PR y restricciones de entrega fueron históricos y están supersedidos por el cierre post-merge anterior; no se eliminan ni reescriben sus evidencias.

**Estado histórico al preparar el commit funcional:** QA ACCEPTED / CODE REVIEW COMPLETED / P2-01 CLOSED / P2-02 CLOSED / LOCAL COMMIT AUTHORIZED / NOT MERGED.
**Preparación documental:** 2026-10-21. **Consolidación de QA reportada:** 2026-10-22.
**Base:** main@10a532714a1634b0fd82e79d82827bfd191cbc1b; coincidencia con refs/heads/main remoto comprobada durante esta preparación.
**Aislamiento histórico de implementación:** worktree ox-shell-01a-readiness; rama feat/ox-shell-01a-account-menu desde la base main indicada. Ningún cambio Healthcare sin integrar copiado, modificado ni incorporado.
**Entrega histórica previa a la publicación:** implementación local acotada a once archivos frontend del inventario y actualización de este ticket; validaciones locales PASS y QA manual aceptada por reporte del usuario (§15); staging explícito de las doce rutas y commit local autorizados. Sin autorización de push, PR o merge. El Board y el workflow existentes siguen gobernando ejecución y prioridades.

## Estado registrado durante la implementación — histórico

El responsable autorizó explícitamente **OX-SHELL-01A — Account Menu & Operational Navigation**, workstream **M-OX1 — Great Operational Experience**, mediante la instrucción «Authorized Implementation». Esta autorización posterior al readiness **levanta el gate de discovery únicamente para este incremento**. No habilita la implementación general de Stage 3 ni declara completada DEC-OX-050. Los apartados 1–11 conservan el análisis y las decisiones propuestas durante el readiness histórico; cualquier referencia allí a falta de autorización corresponde a ese momento y queda resuelta por esta autorización específica.

Se aceptó el host **AppHeader mínimo persistente en desktop y móvil**, el componente reutilizable UserMenu y el inventario de once archivos frontend como punto de partida. Se comprobó la necesidad de cada archivo: tres componentes existentes para alojamiento/integración/retiro de acciones, metadata de navegación para conservar el título, un componente nuevo y seis archivos de pruebas para cubrir interacción y contratos afectados. No fue necesario ampliar arquitectura, sesión ni permisos. Se actualiza además este ticket preexistente; no se modifican Board, UX_DECISIONS ni otros documentos.

Implementado: una sola instancia de UserMenu en AppHeader; nombre con fallback email/Cuenta; enlace real a /change-password y callback de logout existente; disclosure con Enter/Espacio, Tab/Shift+Tab, Escape y restauración de foco, click exterior y cierre al cambiar de pathname. El menú se desmonta al abrir drawer y vuelve cerrado; el drawer conserva sus mecanismos existentes. Sidebar ya no contiene acciones de cuenta, expandida, colapsada ni móvil. El contexto de /change-password se conserva separado de navigationGroups. AppHeader mantiene altura/tokens y no añade otro h1/main; sólo el botón del drawer queda oculto desde xl.

**DoR registrada durante implementación:** alcance y footprint autorizados, inventario validado, contrato de sesión conservado, AC y estrategia QA definidos antes de implementar, dependencias disponibles mediante instalación aislada. La estimación sigue siendo **5 SP preliminares**, sin Target aprobado, Commitment, Forecast ni Actual. No se condiciona artificialmente esta autorización de implementación a convertir la estimación en un compromiso.

**Métricas registradas antes de la integración:** Started de implementación registrado en esta sesión (2026-10-21, fecha de trabajo comunicada por el entorno); Merged no ocurrido; Target SP, Actual SP y tiempo estimado/real no establecidos. Descarga inicial de dependencias lenta: impedimento temporal de QA, duración no medida. No se inventan horas, fechas de integración ni retrabajo.

**QA local registrada tras los fixes P2:** 111/111 PASS en ocho suites (32 en UserMenu/AppShell y 79 en las seis suites relacionadas), con --maxWorkers=1; typecheck frontend, ESLint, Prettier focal y build Next.js PASS. La evidencia anterior de 106/106 se conserva como histórica en §12; la cronología del fix está en §13. QA manual aceptada mediante el reporte final del usuario (§15), que cierra los pendientes de evidencia identificados en §14. Se conserva separada la evidencia automatizada de la manual externa: jsdom no sustituye el navegador y Codex no ejecutó esa QA manual. No se repitieron suites para este cierre documental y commit local.

## Historial de readiness — apartados 1–11

Se conserva a continuación la preparación anterior a la autorización. CURRENT describe la base main inspeccionada; TARGET, riesgos y AC siguen siendo referencia de alcance. El estado vigente se expresa en el bloque anterior y en el cierre QA posterior.

## 1. Fuente, decisiones y límite de autorización

Fuente externa: **ZAPING_UX_Workflow_Blueprint_V0.6R.docx**, versión del **19 de octubre de 2026**, sección **Decision Log — Global Shell**, páginas **19–20**. El responsable proporcionó en la conversación los siguientes extractos verificados. No se afirma haber abierto el DOCX completo, disponer de él localmente ni haberlo integrado al repositorio; no se inventa una ruta al documento.

| Decisión | Estado de producto comunicado | Contenido aprobado y consecuencia aplicable |
| --- | --- | --- |
| DEC-OX-049 | APPROVED | Sacar acciones de cuenta de la navegación operativa: password/profile/logout son tareas de cuenta y van al menú de usuario/perfil. |
| DEC-OX-050 | APPROVED | Top bar autenticada persistente como diseño objetivo, con contexto de página, Company, fecha/hora, notificaciones y menú de usuario. No autoriza construir todas esas capacidades en 01A. |
| DEC-OX-055 | APPROVED | Sidebar exclusivamente operativa: expresa dónde trabajar; las acciones de cuenta salen de ella. |
| DEC-OX-056 | APPROVED | Retirar Change Password y Logout de Sidebar y ubicarlos en el menú de usuario/perfil. |

Son **decisiones PRODUCTO TARGET**, no evidencia de funcionalidades CURRENT. Blueprint V0.6R permanece **DRAFT / Product Discovery** y originalmente limita la implementación productiva de Stage 3. La aclaración del responsable autoriza continuar el análisis y preparar este ticket, **no implementar**. Iniciar código requiere autorización separada que levante expresamente ese gate para el slice acotado.

Historial del readiness: inicialmente faltaban los textos DEC-OX y se propuso provisionalmente un menú en el pie de Sidebar. La aclaración resuelve la falta de fuente y **descarta aquella propuesta**: un menú de cuenta alojado en Sidebar no satisface el límite operativo aprobado. Este ticket actualizado sustituye esa alternativa, sin implementar ninguna.

Fuentes CURRENT inspeccionadas: [AppShell](../../web/app/components/AppShell.tsx), [Sidebar](../../web/app/components/sidebar.tsx), [navigation](../../web/app/components/navigation.ts), [AppHeader](../../web/app/components/AppHeader.tsx), [sesión](../../web/app/auth-session.ts), layout y tests asociados, change-password y cliente frontend API. Contexto vigente: [UX Decisions](../ux/UX_DECISIONS.md), [backlog UX](../ux/UX_IMPROVEMENT_BACKLOG.md), [workflow §24–25](../engineering/DEVELOPMENT_WORKFLOW.md#24-definition-of-ready). AGENTS raíz/web y guía local Next de navegación consultados. Esta base fija Next 16.3.4 y React 19.2.4; no se agregan librerías.

## 2. Objetivo y alcance mínimo propuesto

Un único componente UserMenu reutilizable en los modos responsive, ubicado fuera de Sidebar, con las dos acciones CURRENT que se reubican: **Cambiar contraseña** y **Cerrar sesión**. Reutilizar sesión, autorización, navegación y logout existentes. Ofrecer acceso autenticado desktop y móvil sin depender de abrir el drawer.

Para tener un host desktop, que hoy no existe, la propuesta técnica es ampliar **sólo el contenedor AppHeader existente** a todas las anchuras, con su contexto de página y el menú de cuenta. El botón de navegación conserva visibilidad sólo por debajo de xl. Es un soporte mínimo para el menú, no una entrega completa de DEC-OX-050. Confirmar este footprint junto con la autorización separada antes de código; si se pide otro host, revisar inventario y estimación.

Fuera de alcance: centro de notificaciones, calendario, reloj/fecha, Company selector o carga de nombre Company, branding/rediseño global, búsqueda, Dashboard, perfil editable, rutas nuevas de cuenta, cambios backend, API, Prisma, migraciones, Healthcare, JWT/storage o permisos backend. No añadir placeholders o acciones deshabilitadas para aparentar capacidades pendientes.

## 3. Inventario CURRENT / TARGET aprobado

| Área | CURRENT verificado en main | TARGET de producto / consecuencia para 01A |
| --- | --- | --- |
| Cambiar contraseña | Item INICIO en navigation.ts hacia /change-password, sin filtro por rol. getRouteTitle deriva títulos de esa misma lista. | DEC-049/055/056: retirar de Sidebar y mover al menú. Conservar ruta y título mediante metadata de cuenta separada de navegación operativa. No duplicar el item en Sidebar. |
| Logout | Botón independiente al pie de las Sidebar desktop/móvil, onLogout proporcionado por AppShell. | DEC-049/055/056: retirar botón y prop de Sidebar; botón Cerrar sesión en UserMenu, mismo callback de AppShell. |
| Sidebar | Desde xl persistente y colapsable; debajo de xl vive en drawer. Mezcla enlaces operativos con contraseña/logout. | Sólo navegación operativa en ambos modos. Conservar los demás grupos, orden, hrefs, roles, aria-current y preferencia `zaping.sidebar.collapsed`. |
| Host de usuario desktop | AppHeader tiene xl:hidden: no hay top bar ni acceso de identidad persistente desktop fuera de Sidebar. | DEC-050 identifica esa carencia. Propuesta 01A: hacer visible el AppHeader mínimo en desktop para alojar UserMenu; no desarrollar el resto de la top bar. |
| Host de usuario móvil | Header sticky h-14, título compacto y botón de drawer; cuenta accesible sólo dentro del drawer por logout/nav. | Menú de cuenta en el header, fuera del drawer/Sidebar. Conservar contexto y apertura/cierre de navegación; evitar overlays simultáneos. |
| Datos de sesión | AppShell ya conoce id/companyId/email/firstName/lastName/role/companyTimezone; Sidebar sólo recibe role. No hay nombre Company en ese contrato. | Reusar la sesión cargada; UI candidata con nombre y fallback email/Cuenta. No inventar nombre Company, perfil o permisos. Campos/textos de presentación son propuesta técnica, no citas del Blueprint. |
| Perfil | No se encontró ruta CURRENT profile/account en el árbol de páginas; sí /change-password. | DEC-049 ubica conceptualmente las tareas de perfil, pero no crea su funcionalidad. 01A no añade item ni ruta de perfil; cualquier perfil editable requiere contrato y slice separados. |
| Sesión/logout | Gate AppShell, /auth/me cacheado/deduplicado; logout limpia token/caché, cierra drawer, oculta hijos y replace('/login'). | Sin cambios semánticos ni requests nuevos. UserMenu sólo invoca callback; no introduce otra sesión o invalidación. |
| Accesibilidad | Header sin h1; un main. Drawer dialog/modal con Escape, scroll lock y restore focus; focus trap completo sigue OPEN. | Mantener esas invariantes; control de cuenta accesible y no interactuable detrás de drawer abierto. No atribuir resolución del focus trap histórico. |

La fuente aprobada resuelve que las acciones salen de Sidebar. Ya no es una decisión pendiente conservarlas allí. Lo que resta revisar es el detalle técnico/visual del host mínimo y la autorización de implementación; no reconstruir todo el Blueprint a partir de cuatro extractos.

## 4. Contrato técnico propuesto

### Propiedad de estado y acciones

- **AppShell** conserva `useAuthenticatedSession({ requireToken: true })`, gate, rol, logout y estado drawer. Pasa datos mínimos y callbacks a AppHeader. No modificar auth-session.ts, services/api.ts, contratos API ni reglas de roles.
- **AppHeader** muestra contexto y UserMenu en todas las anchuras; sólo su botón de navegación conserva `xl:hidden`. No introduce h1 ni otro main. El alto/sticky/tokens existentes son la base; revisar el desplazamiento vertical adicional de 56 px en desktop, sin compensaciones improvisadas en cada página.
- **UserMenu** es componente cliente presentacional/interactivo, independiente de Sidebar: props candidatas `user` (firstName/lastName/email), `onLogout` y señal de disponibilidad ligada al drawer. No carga /auth/me, JWT ni Company. Un único montaje en AppHeader con presentación responsive evita duplicar sesión, triggers y listeners.
- Acciones: **Cambiar contraseña** como Next Link real a `/change-password`; **Cerrar sesión** como botón nativo que cierra el panel y llama al callback una vez. No usar un anchor de logout ni reimplementar clearAuthenticatedSession dentro del componente.
- Antes de abrir drawer se cierra el menú; mientras el drawer está abierto, el control de cuenta del header no es interactuable ni deja un panel detrás del dialog. Esta protección acotada no equivale a implementar el focus trap global histórico.

### Navegación y título

Eliminar el item e import de icono de contraseña de navigationGroups. Mantener `getRouteTitle('/change-password') === 'Cambiar contraseña'` con un registro mínimo de títulos de rutas de cuenta separado de los grupos operativos. Conservar el algoritmo de rutas exactas/hijas y fallback para las demás rutas. No crear otro sidebar, router ni un framework general de navegación.

Dependencia técnica demostrada: borrar únicamente el item actual quitaría también su fuente de título y produciría fallback Zaping ERP. Debe corregirse dentro del mismo slice al reubicarlo, no diferirse como regresión aceptable.

### Interacción y presentación

Propuesta accesible mínima: **disclosure** con botón nativo, nombre accesible Cuenta, aria-expanded/aria-controls, ID estable useId, enlace y botón nativos. Enter/Espacio activan trigger; Tab/Shift+Tab conservan orden natural; Escape cierra panel y restaura foco cuando corresponde; click exterior cierra sin ejecutar acciones ni robar foco al elemento pulsado. Cerrar al navegar y al abrir drawer. No usar role=menu/menuitem sin implementar su patrón completo; no agregar una dependencia UI para este slice.

Datos visibles propuestos: nombre compuesto si existe; fallback email y, si no es utilizable, Cuenta; no nombres estáticos, CompanyId disfrazado de Company, rol como permiso nuevo ni avatar remoto. Textos/host se revisan como propuesta al autorizar; no se presentan como especificados por las cuatro DEC.

Posicionamiento: panel alineado al trigger en header, contenido dentro del viewport y fuera del scroll/clipping de Sidebar. Respetar tokens z-sticky 10 / z-popover 30 / z-drawer 40. No renderizar el menú simultáneamente con drawer; no elevar su z-index por encima del dialog para evitar el problema. Si se necesita portal, limitarlo al panel y cubrirlo en QA, sin refactor de otros overlays.

RowActionsMenu de DataTable sólo se usó como referencia de interacción: su contrato row/actions y botones no se reutiliza como menú de cuenta ni se modifica. No refactor genérico de menús o DataTable.

## 5. Inventario candidato — once archivos de implementación

Ninguno de estos cambios productivos se realiza en este readiness. Sustituye la propuesta provisional anterior de seis archivos: retirar acciones y soportar host fuera de Sidebar requiere también AppHeader, navigation y regresiones del layout.

| Operación | Archivo | Cambio acotado propuesto |
| --- | --- | --- |
| Crear | web/app/components/UserMenu.tsx | Menú de cuenta presentacional/accesible, acciones existentes. |
| Crear | web/app/components/UserMenu.test.tsx | Teclado, foco, cierre, callbacks, datos y responsive. |
| Crear | web/app/components/navigation.test.ts | Título de cuenta fuera de grupos, active matching/fallback conservados. |
| Modificar | web/app/components/AppShell.tsx | Pasar usuario/logout al header, retirar onLogout de Sidebar, coordinar overlays. |
| Modificar | web/app/components/AppHeader.tsx | Host mínimo visible desktop/móvil, navegación móvil separada y menú. |
| Modificar | web/app/components/sidebar.tsx | Retirar botón/prop onLogout y su icono; conservar navegación operativa y colapso. |
| Modificar | web/app/components/navigation.ts | Retirar contraseña de grupos, conservar título de ruta fuera de ellos. |
| Modificar | web/app/components/AppShell.test.tsx | Logout vía UserMenu y gates/sesión/drawer sin cambios semánticos. |
| Modificar | web/app/components/AppHeader.test.tsx | Host persistente, trigger sólo móvil, título sin h1 y control de cuenta. |
| Modificar | web/app/components/sidebar.test.tsx | Ausencia de ambas acciones y mismos enlaces/roles operativos. |
| Modificar | web/app/(app)/layout.test.tsx | Actualizar expectativas Cuenta ausente y grupo INICIO con contraseña; preservar layout/headings/drawer. |

Ficheros sólo de regresión, no de cambio previsto: auth-session.ts, erp-role-access.ts, services/api.ts, páginas de login y change-password y sus tests. Sin cambios de estilos globales, PageHeader, API ni Healthcare. Si otro archivo resulta necesario, revisar inventario antes de ampliar alcance.

Al implementar hará falta sincronizar los apartados históricos AppHeader/Sidebar de UX_DECISIONS.md y el seguimiento del workflow/Board de forma acotada, conservando la fuente externa y sin afirmar que todo DEC-050 está terminado. Esa actualización se propondrá en la autorización de implementación; **no se modifica ninguno aquí**. En esta preparación se edita únicamente este ticket.

## 6. Definition of Ready y gate de autorización

- [x] Main verificado y worktree aislado sin cambios Healthcare.
- [x] CURRENT y consumidores focales inspeccionados; las DEC aprobadas recibidas y distinguidas de CURRENT.
- [x] Contrato de alcance: sacar contraseña/logout de Sidebar; no perfil nuevo ni capacidades adicionales DEC-050.
- [x] Dependencias técnicas identificadas: host desktop inexistente, título derivado de navegación y tests que codifican el contrato anterior.
- [x] Solución mínima, inventario, AC, riesgos, QA y estimación preliminar documentados como propuesta.
- [ ] Revisar/aceptar el footprint propuesto: AppHeader persistente mínimo para usuario/contexto, visibilidad del trigger móvil y tratamiento de overlays, sin top bar completo.
- [ ] Aprobar inventario de implementación y actualizaciones documentales necesarias; revisar Target sobre la estimación preliminar.
- [ ] **Autorización separada explícita para iniciar 01A productivo**, compatible con el gate DRAFT/Product Discovery/Stage 3 del Blueprint.

Los textos externos ya no están pendientes. No exigir integrar el DOCX entero para analizar o revisar este ticket: registrar la trazabilidad de los extractos aportados basta para esta preparación. Su aprobación de producto no sustituye los tres puntos de revisión/autorización anteriores.

## 7. Acceptance Criteria verificables propuestos

1. Ninguna Sidebar (desktop expandida/colapsada ni móvil) contiene link Cambiar contraseña, botón Logout, trigger de cuenta ni menú de cuenta. INICIO conserva Inicio y Dashboard; los demás grupos/enlaces/roles no cambian.
2. UserMenu es alcanzable desde el header autenticado en desktop y móvil sin abrir drawer. Sólo contiene las dos acciones existentes, sin Perfil/Company/calendario/notificaciones u otros placeholders.
3. Cambiar contraseña mantiene el href `/change-password` y título correcto aunque ya no esté en navigationGroups. Se conservan matcher de rutas hijas, aria-current y fallback de otras rutas; no hay cambios de rutas de negocio.
4. Logout para ADMIN/MANAGER/SALES/WAREHOUSE invoca una vez el callback actual, elimina token/caché, retira hijos protegidos y replace('/login'); ninguna llamada API adicional. No se altera el logout tras cambio exitoso de contraseña.
5. AppShell sigue siendo único dueño del bootstrap. /auth/me no se duplica al abrir/cerrar menú; loading/sin token/401 no exponen identidad ni contenido, 403/red/5xx conservan token/error/retry y no hay flash ADMIN ni repoblación de caché desde petición vieja.
6. Un montaje UserMenu responsive; nombre accesible, aria-controls/expanded e ID coherentes, enlace/botón nativos, foco visible. Ratón/Enter/Espacio, Tab/Shift+Tab, Escape y click exterior funcionan sin callbacks espurios.
7. Menú se cierra al navegar, abrir drawer o perder su disponibilidad; nunca queda interactuable detrás del dialog. Drawer conserva cierre por backdrop/Escape/link, scroll lock y restore focus. No declarar resuelta su deuda de focus trap global.
8. Header conserva contexto compacto sin h1, un único main y heading de página; trigger navegación sólo debajo de xl. Account action no modifica preferencia de Sidebar ni otras claves locales.
9. Panel y trigger usables con nombres largos, ancho móvil, viewport corto y zoom 200 %, sin clipping/scroll horizontal ni conflicto de z-index. Validar en browser real, no inferir geometría de jsdom.
10. Sin centro de notificaciones, fecha/reloj/calendario, branding, Company, Dashboard, perfil, nueva ruta, cambios de JWT, API, Prisma, migración, Healthcare o permisos backend. No declarar DEC-050 completo al cerrar 01A.

## 8. Estrategia QA

| Nivel | Casos / evidencia necesaria |
| --- | --- |
| UserMenu | Normal/compacto por viewport, texto largo/fallback, acciones/hrefs reales, onLogout una vez, click exterior, Escape/foco y Tab. Ningún rol requiere una acción de cuenta distinta. |
| Navigation | Sin cuenta en grupos; `/change-password` y título preservados; coincidencia exacta/hija de negocio y fallback; grupos/roles intactos. No convertir tests en simple copia de implementación. |
| AppHeader/Sidebar | Header visible en los dos modos y botón drawer sólo móvil; Sidebar sin cuenta en ninguna instancia/colapso; menú no depende de Sidebar. Tests del contrato anterior deben actualizarse al TARGET, no debilitarse. |
| AppShell/sesión | Cuatro roles, callback existente, caché/generation y token, late response, sin token/401, 403/red/5xx/retry y no requests extra; coordinación drawer/menú y ausencia de contenido protegido. |
| Layout/rutas | Un main/h1; sin shell de cuenta en rutas públicas; contraseña alcanzable y título conservado; Home/Dashboard y navegación de negocio preservados sin implementar cambios allí. Regresiones login y change-password existentes. |
| Browser/accesibilidad | Móvil 390 px y ambos lados de xl (1279/1280 si no hay override), desktop Sidebar colapsada/expandida, resize, nombres largos, viewport corto, zoom 200 %, teclado y smoke lector. Verificar header añadido a desktop, foco, visibilidad, scroll y z-index. No atribuir a jsdom la prueba de breakpoints. |
| Checks | Unitarias → integración focal → regresiones afectadas → typecheck/lint/build web → CI aplicable. No PostgreSQL ni API/Healthcare. Workers limitados según deuda runner vigente; no subir timeouts globales sin diagnóstico. |

Comando focal propuesto desde web, después de preparar dependencias por el procedimiento habitual autorizado:

- npm test -- --maxWorkers=1 app/components/UserMenu.test.tsx app/components/navigation.test.ts app/components/AppShell.test.tsx app/components/sidebar.test.tsx app/components/AppHeader.test.tsx "app/(app)/layout.test.tsx" "app/(app)/change-password/page.test.tsx" "app/(public)/login/page.test.tsx"
- npm run typecheck
- npm run lint
- npm run build

Esta preparación no ejecuta suites/build ni instala dependencias. Sólo se inspeccionaron las pruebas existentes; no hay PASS nuevo ni cantidad de pruebas futuras inventada. El worktree no contiene node_modules. Al implementar, consultar las guías Next de su versión como exige AGENTS; mantener Next Link y router.replace existentes.

## 9. Definition of Done

AC aprobados satisfechos con evidencia por versión; unitarias/regresiones y typecheck/lint/build/CI aplicables PASS; QA responsive/teclado/browser real registrada; review sin bloqueos; docs existentes sincronizados sin normas paralelas, trazabilidad del Blueprint y límite DEC-050 conservados. Integración verificada por PR/SHA cuando ocurra; no marcar DONE por haber preparado el ticket. Ninguna aprobación de release/producción se deriva de este slice UI. Sin staging/commit/push/PR autorizados por esta preparación.

## 10. Estimación, riesgos y métricas

**5 SP preliminares**, a revisar con el alcance mínimo propuesto: componente accesible + host responsive fuera de Sidebar + separación del título de cuenta + regresión sensible de sesión/layout y QA browser. El inventario aumenta de seis a once archivos respecto a la hipótesis anterior porque aquella no cumplía DEC-055/056; no se implementó ni hubo retrabajo productivo. No equivale a horas, Target, Commitment, Forecast ni Actual. Top bar completo o perfil nuevo exigirían refinamiento propio, no absorberlos aquí.

Riesgos acotados: pérdida de título al retirar navegación; duplicar logout o /auth/me; menú tras drawer; cambio de espacio vertical desktop; assertions antiguas que impiden la reubicación; dar por implementadas decisiones de producto. Mitigaciones y pruebas arriba. La deuda histórica de focus trap global permanece OPEN; no ampliarla.

Started de implementación: no iniciado. Merged, Target/Actual SP, tiempo estimado/real: no establecidos. Refinamiento documental realizado; no promueve otro ticket principal a ejecución mientras Healthcare permanece sin integrar. Bloqueo previo por ausencia de DEC: resuelto con los extractos del usuario. Gate restante: revisión del footprint e inventario y autorización separada Stage 3. Duración/horas/retrabajo productivo no medidos ni inventados. Prioridad y asignación de sprint pendientes.

## 11. Pendientes y veredicto

El traslado fuera de Sidebar está resuelto por producto. No falta ni se inventa contrato de perfil: esa funcionalidad no existe CURRENT y queda excluida. Tampoco hay dependencia demostrada de implementar notificaciones/calendario/Company/branding/Dashboard o de integrar Healthcare para preparar este slice sobre main.

Sí requiere confirmación dentro de la autorización separada la **superficie mínima persistente AppHeader desktop/móvil**: hoy desktop no tiene otro host fuera de Sidebar y dejar el menú sólo en móvil incumpliría el alcance. La propuesta está definida para revisión; no se ejecuta bajo la mera aprobación de las DEC. Si se rechaza ese footprint, acordar otra ubicación visible fuera de Sidebar antes del código, sin inventarla silenciosamente.

**Veredicto de inicio: CHANGES REQUIRED / IMPLEMENTATION NOT AUTHORIZED.** El análisis CURRENT/TARGET y el ticket técnico están preparados; resta revisar el footprint propuesto, fijar alcance/Target y autorizar expresamente Stage 3 para 01A. Detenerse para revisión humana, sin cambios productivos, staging, commit, push o PR.


## 12. Evidencia histórica de implementación inicial — anterior a los fixes P2

### Trazabilidad de cambios

| Archivo frontend | Necesidad validada y resultado implementado |
| --- | --- |
| web/app/components/UserMenu.tsx | Nuevo disclosure accesible y reutilizable, dos acciones existentes; no conoce token, router de logout ni endpoint. |
| web/app/components/AppHeader.tsx | Host mínimo persistente; recibe datos mínimos/callback; sólo el trigger del drawer es móvil. Oculta UserMenu durante el dialog y reinicia su estado al cambiar pathname. |
| web/app/components/AppShell.tsx | Conecta sesión/callback existentes al header y retira onLogout de ambas Sidebar. No modifica bootstrap, limpieza de sesión ni autorización. |
| web/app/components/sidebar.tsx | Retira botón, icono y prop de logout, sin cambiar enlaces operativos ni colapso. |
| web/app/components/navigation.ts | Retira contraseña de INICIO; metadata independiente conserva su título y matcher. |
| web/app/components/UserMenu.test.tsx | 10 pruebas: disclosure, Enter/Espacio, Tab/Shift+Tab, Escape/foco, click fuera, salida por Tab, href real/cierre, logout una vez, fallbacks e IDs independientes. |
| web/app/components/navigation.test.ts | 6 pruebas: cuatro roles sin acciones de cuenta, título de contraseña y límites de matching/fallback. |
| web/app/components/AppShell.test.tsx | Actualiza logout de cuatro roles al menú; añade cierre por navegación sin /auth/me extra y coordinación con drawer/restauración de foco. Conserva regresiones del gate. |
| web/app/components/AppHeader.test.tsx | Actualiza contrato del host persistente, trigger móvil y ausencia de placeholders/h1 adicional. |
| web/app/components/sidebar.test.tsx | Ausencia de cuenta expandida/colapsada; expectativas operativas por rol preservadas. |
| web/app/(app)/layout.test.tsx | Cuenta presente en header, INICIO sin contraseña; preserva tests de rutas, headings, main, colapso y drawer. |

Se actualiza además el ticket preexistente docs/project/OX_SHELL_01A_TICKET.md para registrar autorización y evidencia. Ningún cambio en auth-session, services/api, páginas de contraseña/login, package.json/lockfile, estilos globales, API, Healthcare, schema o migraciones.

### Alcance de la evidencia

Las ocho suites ejecutadas comprueban AC 1–8 y 10 en los límites de jsdom y mocks existentes: hrefs y títulos, cuatro roles, callback y limpieza real del almacenamiento/caché de sesión bajo el cliente API simulado, redirección, estados protegidos/error, cierre del menú, drawer y foco. No son una sesión de navegador contra backend real ni demuestran geometría de AC 9. Los tests de las páginas de login y contraseña se ejecutaron sin modificarlos. No se ejecutaron PostgreSQL ni suites API/Healthcare.

Comandos realmente ejecutados desde web:

- npm test -- --maxWorkers=1 app/components/UserMenu.test.tsx app/components/navigation.test.ts — 16/16 PASS, dos suites.
- npm test -- --maxWorkers=1 app/components/AppShell.test.tsx app/components/sidebar.test.tsx app/components/AppHeader.test.tsx "app/(app)/layout.test.tsx" "app/(app)/change-password/page.test.tsx" "app/(public)/login/page.test.tsx" — 90/90 PASS, seis suites.
- npm run typecheck — PASS.
- npm run lint — PASS, exit 0.
- npm run build — PASS, exit 0; compilación, TypeScript y generación de páginas completadas. NEXT_PUBLIC_API_URL=https://api.example.invalid y NEXT_TELEMETRY_DISABLED=1 sólo en el proceso del build; URL pública sintética para satisfacer la validación HTTPS de producción, sin .env ni conexión al backend. No es configuración de despliegue.

Instalación aislada npm ci --prefer-offline --no-audit --no-fund finalizada, exit 0, sin cambios de manifiesto/lock. Avisos informativos: tsconfck deprecado, install script unrs-resolver sin aprobación automática y recomendación de Vite sobre vite-tsconfig-paths. No se cambiaron dependencias/configuración ni se aprobó el script para resolver estos avisos.

### QA visual/manual que falta

**No ejecutada en navegador real; no hay screenshots ni evidencia visual responsive acreditada.** En el entorno QA frontend habitual, con cuentas existentes y sesión autenticada:

1. Revisar a 390 px, 1279 px y 1280 px o más: header/menú accesibles, un solo trigger Cuenta, drawer sólo bajo xl; Sidebar expandida y colapsada exclusivamente operativas. Redimensionar con menú abierto.
2. Probar nombre/email largos, viewport corto y zoom 200 %: panel desplazable, textos legibles, sin recorte, scroll horizontal ni superposición incorrecta. Revisar el espacio adicional de 56 px del header en desktop y páginas con contenido largo.
3. Con teclado, abrir con Enter/Espacio, recorrer enlace y botón por Tab/Shift+Tab, Escape y foco de vuelta; click fuera cierra sin robar foco. Abrir drawer mientras el menú estaba abierto, cerrarlo por Escape/backdrop/enlace y comprobar que la cuenta vuelve cerrada y el foco habitual se conserva. Smoke de lector de pantalla: Cuenta expandida/contraída y acciones nativas.
4. Para ADMIN, MANAGER, SALES y WAREHOUSE: navegar a /change-password, comprobar título/protección y volver; logout retira contenido protegido y dirige a /login. Verificar que refresh/back no expone contenido sin sesión. No implica cambiar contraseñas reales para revisar el menú.

La deuda histórica del focus trap completo del drawer sigue OPEN; no se declara resuelta. El alcance mínimo de DEC-OX-050 deja deliberadamente fuera Company, branding, fecha/reloj, calendario, notificaciones, mensajes y Dashboard. No se crean placeholders.

**Cierre local histórico, anterior al Code Review y fixes P2:** READY FOR CODE REVIEW. Pruebas focales, typecheck, lint y build PASS; git diff --check sin errores. Inventario final: ocho archivos frontend modificados, tres frontend nuevos y este ticket preexistente sin seguimiento (doce rutas en total); ningún archivo staged. Review humana, QA visual, CI e integración siguen pendientes. No DONE, no Actual SP ni autorización de release/producción. Sin staging, commit, push, PR ni merge.


## 13. Code Review P2 — corrección y revalidación anteriores al reporte manual

El Code Review posterior a la implementación inicial señaló dos P2, sin P0/P1, y dejó CHANGES REQUIRED. El responsable autorizó después corregir exclusivamente ambos hallazgos en la misma rama/worktree. No se amplió OX-SHELL-01A ni el gate específico de Stage 3.

### P2-01: drawer abierto al cruzar xl

Causa: xl:hidden ocultaba el drawer sin cerrar mobileNavigationOpen; AppHeader seguía desmontando UserMenu. El bloqueo de scroll del drawer también permanecía activo.

Corrección: AppShell consulta matchMedia('(min-width: 80rem)'), alineado con el xl del CSS construido. Sólo mientras el drawer está abierto registra el listener change. Al entrar a desktop cierra el estado del drawer; el cleanup restaura exactamente el overflow anterior y retira los listeners de media/teclado. Al volver a móvil no se reabre el drawer. Una comprobación inmediata cubre el cambio de viewport entre el click y la ejecución del efecto, sin timeouts, sleeps ni estado responsive global adicional. No se requiere otra instancia de UserMenu ni cambios adicionales en AppHeader.

Foco: el cierre normal en móvil sigue restaurándolo al botón del drawer. En desktop no se enfoca ese botón oculto. Si el foco está en el drawer, su trigger o body, se mueve al main existente, ahora con ref y tabIndex=-1 (fuera del recorrido normal por Tab). Un foco que ya esté en otro control se conserva. Esto no implementa ni cierra la deuda del focus trap global.

Regresiones nuevas de AppShell, mediante matchMedia controlado: (1) 1279 → 1280 → 1279, sin drawer residual, un UserMenu, overflow anterior restaurado, foco en main y ninguna llamada a focus del trigger oculto; además menú/drawer/Escape móviles siguen funcionando; (2) foco externo conservado al entrar a desktop; (3) listener retirado y scroll restaurado al desmontar con drawer abierto; (4) breakpoint cambia entre click y efecto, sin foco oculto ni listener residual. El primer caso comprueba también sesión/token conservados y una sola llamada /auth/me. Son pruebas de estado/DOM/eventos, no demostración de geometría CSS real.

### P2-02: nombre accesible y etiqueta visible

Causa: aria-label fijo Cuenta sustituía el nombre/email visible. UserMenu ahora usa Cuenta de <identidad> cuando existe nombre o email y Cuenta cuando no hay identidad. El texto mostrado usa la misma identidad/fallback; el contexto de cuenta permanece sin duplicar el fallback. Se conservan disclosure, ID, aria-expanded, enlace/botón nativos, teclado y Escape; no se introduce role=menu.

La tabla de pruebas de identidad ahora cubre explícitamente nombre, fallback email y ausencia de ambos: busca el botón por su nombre accesible completo, comprueba el texto del trigger y abre el panel. Las demás regresiones de interacción usan los nombres completos actualizados. La aserción negativa de Sidebar rechaza cualquier trigger cuyo nombre comience por Cuenta, para evitar un falso positivo tras cambiar el nombre.

### Archivos tocados por este fix

- AppShell.tsx y UserMenu.tsx: únicas modificaciones productivas adicionales respecto a la implementación anterior.
- AppShell.test.tsx y UserMenu.test.tsx: cuatro regresiones responsive nuevas y ampliación de la tabla de identidad; mocks con cleanup y nombres accesibles actualizados.
- AppHeader.test.tsx, sidebar.test.tsx y (app)/layout.test.tsx: consultas adaptadas; layout simula matchMedia para sus regresiones existentes. Prettier normaliza los tests tocados (se conservan comillas simples en Header/layout); parte del diff es formato.
- Este ticket: cronología, evidencia vigente y límites. No se añaden rutas al inventario: siguen siendo once archivos frontend y el ticket.

### Cronología QA y resultados actuales

- Histórico inicial, antes de P2: 106/106 PASS; typecheck/lint/build PASS (§12).
- Regresiones primero contra la versión anterior: fallan la identidad con nombre/email y la coordinación responsive. La prueba focal ajustada para verificar el resultado observable confirma que el dialog permanece tras el cambio simulado a desktop. No es reproducción en navegador ni fallo nuevo independiente.
- Después del fix: npm test -- --maxWorkers=1 app/components/UserMenu.test.tsx app/components/AppShell.test.tsx — **32/32 PASS**, dos suites.
- Regresiones relacionadas: npm test -- --maxWorkers=1 app/components/navigation.test.ts app/components/sidebar.test.tsx app/components/AppHeader.test.tsx "app/(app)/layout.test.tsx" "app/(app)/change-password/page.test.tsx" "app/(public)/login/page.test.tsx" — **79/79 PASS**, seis suites. Total vigente **111/111 PASS** en ocho suites, sin skipped en estas ejecuciones completas.
- npm run typecheck — PASS, exit 0.
- npm run lint — PASS, exit 0.
- Prettier --check de los siete archivos frontend tocados por el fix — PASS (opción --single-quote para Header/layout; defaults en los otros cinco). Se utilizó el binario local ya instalado; sin agregar dependencias.
- npm run build — PASS, exit 0; incluye TypeScript y generación de páginas. Mismas variables públicas sintéticas de §12 sólo en el proceso, sin .env ni backend real.
- git diff --check y comprobación de whitespace de los cuatro archivos sin seguimiento — PASS. Inventario exacto conservado, nada staged.

**Límites y pendientes:** ejecutar la matriz manual de §12 en navegador real, especialmente 1279 → 1280 → 1279 con drawer abierto, scroll, foco y disponibilidad de Cuenta; nombre accesible coherente con texto visible, zoom, viewport corto, sidebar colapsada y cuatro roles. Verificar geometría/solapamientos y navegación real a /change-password: los tests existentes cancelan navegación y simulan pathname. Si cambia el breakpoint xl del tema, revisar también la media query interna y sus pruebas. Focus trap global sigue OPEN. Sin cambios en sesión/autenticación, permisos, backend, API, Healthcare, Prisma o capacidades adicionales de Top Bar.

**Veredicto local tras el fix: READY FOR MANUAL UX QA.** P2-01/P2-02 corregidos con evidencia automatizada; review humana y QA visual pendientes. No DONE/MERGED, Actual SP ni habilitación general de Stage 3. Sin staging, commit, push, PR ni merge.


## 14. Historial de closeout parcial — anterior a la aceptación final del usuario

### Origen y límites de la evidencia

Reporte manual proporcionado por el usuario en «OX-SHELL-01A: Final UX QA Closeout», recibido el **2026-10-22**. La fecha de recepción no se usa para inventar fecha/hora de ejecución, navegador, dispositivos, cuentas o rol. Codex no ejecutó esta QA manual ni inspeccionó directamente su DevTools; no se aportaron aquí capturas ni se exigen como condición nueva. Se registra como reporte del usuario, no como observación independiente de Codex.

Evidencia manual expresamente reportada:

- **P2-01:** transición 1279 → 1280 → 1279 validada; drawer, scroll y UserMenu correctos.
- **P2-02:** nombre accesible **Cuenta de Leonardo Garnica** confirmado en DevTools.
- Inspección visual favorable en desktop, móvil/tablet y zoom 200 %.
- Apertura de UserMenu, Escape y navegación real a /change-password verificadas.

No se infiere el rol de Leonardo a partir de su nombre. No se atribuye a este reporte logout, refresh/back posterior al logout, recorrido completo de teclado/foco, nombres extremos, viewport corto o Sidebar colapsada si no se indicaron expresamente.

La evidencia automatizada vigente se conserva de las ejecuciones posteriores al fix en §13: **111/111 PASS en ocho suites**, typecheck, ESLint, build y Prettier focal PASS. **No se repitieron suites/checks de ejecución en este closeout**: sólo se auditaron las aserciones existentes y se actualizó este ticket, sin cambios de implementación que requieran revalidación. Se comprueban whitespace, estado Git y huellas del frontend para confirmar ese límite.

### Auditoría focal de roles y logout

| Evidencia existente | Qué demuestra | Límite |
| --- | --- | --- |
| AppShell.test.tsx:180 — it.each ADMIN/MANAGER/SALES/WAREHOUSE | Cuatro casos de logout desde UserMenu: elimina token, retira hijos protegidos, muestra redirección y llama replace('/login'); loader con requireToken devuelve null; una sesión nueva puede cargarse sin reutilizar la anterior. | React/jsdom con /auth/me y router simulados. El nombre de la fixture es Admin Test en los cuatro casos, pero role cambia explícitamente; no son cuatro sesiones reales ni evidencia manual por rol. |
| sidebar.test.tsx:71 — cuatro escenarios en un test | Enlaces operativos visibles/ocultos para ADMIN, MANAGER, SALES y WAREHOUSE; Usuarios sólo ADMIN. | No afirmar cuatro tests separados ni autorización backend real. |
| navigation.test.ts:9 — it.each de cuatro roles | Cuenta/contraseña ausentes de navegación operativa; Inicio/Dashboard conservados y Usuarios restringido en metadata. | No es navegación de navegador ni ejecución de permisos backend. |
| UserMenu.test.tsx:122 | onLogout llamado exactamente una vez y panel cerrado. | Es un callback espía; por sí solo no acredita limpieza de sesión. |
| AppShell.tsx:166 y conexión a AppHeader/UserMenu | Continúa delegando al mismo logout existente y clearAuthenticatedSession; UserMenu no implementa almacenamiento ni otro mecanismo de sesión. | La reutilización se acredita por código y se complementa con las aserciones de AppShell; falta el smoke real de logout reportado. |
| (app)/change-password/page.test.tsx:146 | Tras respuesta simulada exitosa, vacía campos, elimina token y redirige a /login. El archivo productivo y su test permanecen sin cambios. | No afirmar invalidación de servidor ni cambio real de contraseña; no se requiere efectuar cambios de contraseña reales para aceptar este incremento. |

La compatibilidad automatizada de los **cuatro roles** está acreditada. El reporte manual no identifica roles probados ni confirma logout real; no se convierte esa cobertura automatizada en un PASS manual.

### Matriz AC → evidencia → resultado de aceptación

Los AC mantienen su numeración y alcance de §7. «Acreditado» se limita a la evidencia indicada; no equivale a DONE, merge o habilitación de Stage 3.

| AC | Evidencia consolidada | Resultado |
| --- | --- | --- |
| 1 — Sidebar operativa | Código y tests Sidebar/navigation/layout: cuenta retirada, grupos/hrefs y cuatro roles conservados. Inspección visual general favorable reportada. | ACREDITADO en alcance de código/tests; revisión visual específica de colapso se mantiene en pendiente visual de AC9. |
| 2 — UserMenu desktop/móvil y dos acciones | Una instancia en AppHeader, tests de acciones únicas; apertura e inspección desktop/móvil/tablet reportadas; transición xl manual favorable. | ACREDITADO. |
| 3 — /change-password y título | Metadata independiente, pruebas navigation/AppShell y página sin cambios; navegación real reportada por el usuario. | ACREDITADO, sin atribuir al usuario una comprobación de título no expresada; el título tiene evidencia automatizada. |
| 4 — Logout reutilizado y cuatro roles | Callback único probado; AppShell comprueba token/caché, contenido protegido y redirección para los cuatro roles; regresión de contraseña sin cambios. | PENDIENTE del smoke real de logout/refresh/back previsto en la matriz manual; no reportado. |
| 5 — Bootstrap y gate de sesión | Tests de /auth/me único, loading, sin token/401, 403/red/5xx/retry, caché anterior y navegación SALES sin flash ADMIN. Implementación de sesión intacta. | ACREDITADO por evidencia automatizada y revisión focal; no se añade una nueva auditoría backend. |
| 6 — Disclosure accesible | Tests de nombre/email/fallback, ID/expanded, callback, Enter/Espacio, Tab/Shift+Tab, Escape/foco y click exterior; DevTools confirma nombre accesible real; apertura/Escape manuales reportados. | PARCIAL: falta reporte del recorrido manual de teclado, foco visible/restaurado y cierre exterior; no se presume a partir de Escape. |
| 7 — Coordinación drawer/menú | Tests de cierre al navegar/abrir drawer, backdrop/Escape/enlace, scroll/foco y lifecycle; transición xl con drawer/scroll/UserMenu validada manualmente. | PARCIAL: falta confirmar foco manual al cruzar xl y al cerrar drawer. Focus trap global OPEN, fuera del fix. |
| 8 — Contexto y estructura | Tests Header/layout: títulos, un main/h1, trigger móvil y persistencia de colapso; código de logout sólo elimina su token mediante mecanismo existente. Inspección general favorable reportada. | ACREDITADO en alcance estructural/automatizado; sin inferir pruebas manuales adicionales. |
| 9 — Usabilidad visual extrema | Reporte favorable desktop/móvil/tablet y zoom 200 %; nombre real de usuario disponible. | PARCIAL: faltan casos específicos de nombre/email largos, viewport corto y Sidebar colapsada/expandida con menú, sin recorte ni scroll horizontal. No se infieren del reporte general. |
| 10 — Límites del incremento | Inventario de once archivos frontend y ticket; sin backend, Healthcare, permisos, rutas nuevas, sesión nueva ni capacidades adicionales de Top Bar. Autorización limitada de Stage 3 conservada. | ACREDITADO por inventario e inspección focal. |

### Sólo pendientes para la aceptación previa al commit

1. **AC4 — Smoke de logout en navegador:** completar el recorrido ya previsto en §12 para ADMIN/MANAGER/SALES/WAREHOUSE y reportar qué rol se verificó: cerrar sesión desde UserMenu, comprobar /login y ausencia de contenido protegido; refresh/back y acceso directo a /change-password sin sesión no deben exponer contenido protegido. No se exige reejecutar las suites ni cambiar contraseñas reales. La evidencia automatizada de cuatro roles ya existe; el smoke real sigue sin reporte.
2. **AC6–7 — Teclado y foco:** reportar Enter/Espacio, Tab/Shift+Tab, foco visible, Escape con foco devuelto al trigger, click fuera sin robo de foco y foco correcto al cerrar drawer/cruzar xl sin enfocar el botón oculto. Apertura/Escape y drawer/scroll/UserMenu en la transición ya están reportados; sólo falta el detalle de teclado/foco, sin repetir por defecto toda la QA visual.
3. **AC9 — Extremos visuales:** confirmar nombre/email largos, viewport corto y menú con Sidebar expandida/colapsada, sin recorte/scroll horizontal y con acciones alcanzables. Zoom 200 % y revisión desktop/móvil/tablet general ya están reportados; no se marcan como pendientes de nuevo.

Puede completarse con un reporte textual de los resultados y roles/casos efectivamente probados; no se inventan parámetros ni se pide infraestructura nueva. Si algún caso no se realizó, conservarlo pendiente. No se exige smoke de lector/control por voz adicional como gate nuevo: DevTools acredita el nombre accesible y las demás interacciones siguen los AC acordados.

### Estado técnico y veredicto

**P2-01 y P2-02 corregidos**, con regresiones automatizadas y confirmación manual del usuario para sus manifestaciones principales. Esta comprobación de cobertura no identifica nuevos hallazgos funcionales bloqueantes; los pendientes anteriores son evidencia de aceptación aún no reportada. La deuda histórica del **focus trap completo del drawer permanece OPEN**, sin atribuirle resolución o aceptación formal nueva.

**Veredicto: QA PENDING.** Falta exclusivamente la evidencia de AC4, detalles manuales de AC6–7 y extremos de AC9 listados arriba para emitir READY FOR COMMIT APPROVAL. CI e integración no se afirman realizados: corresponden a gates posteriores según workflow y no se exige crear un PR en este closeout previo al commit. No se marca DONE, Merged o Actual SP; se conservan 5 SP preliminares sin Target/Commitment/Forecast/Actual inventados.

Único archivo editado en esta consolidación: este ticket. Sin código productivo, tests, autenticación, backend, Healthcare ni otras ramas; sin staging, commit, push, PR ni merge.


## 15. QA Acceptance & Local Commit — aceptación final

**Aceptación recibida el 2026-10-22**, mediante la instrucción del usuario «OX-SHELL-01A: QA Acceptance & Local Commit». El usuario confirma **PASS de QA manual desktop, responsive, zoom 200 %, accesibilidad, teclado, foco, logout y roles**, declara **P2-01 y P2-02 CLOSED**, y autoriza actualizar este ticket, revisar el diff completo, hacer staging explícito únicamente de las doce rutas aprobadas y crear un commit local convencional. La restricción anterior de no staging/commit queda levantada sólo para esta entrega; permanecen prohibidos push, PR y merge hasta nueva autorización.

### Cierre de evidencia y Acceptance Criteria

La QA manual es **reporte del usuario**, no ejecución de Codex. Su aceptación final cierra los pendientes de §14 al nivel declarado; no se inventan navegadores/versiones, dispositivos, horas, capturas, detalle individual de cada caso ni correspondencia de identidades con roles. No se reabre una auditoría ni se exige repetir pruebas ya aceptadas.

| AC | Evidencia que se conserva | Estado de aceptación actual |
| --- | --- | --- |
| 1–3 | Tests de Sidebar/navigation/Header/layout y reporte manual de presentación responsive y navegación a contraseña. | ACCEPTED. |
| 4 | Tests de callback único y logout integrado para ADMIN/MANAGER/SALES/WAREHOUSE; regresión de contraseña intacta; PASS manual de logout y roles reportado por el usuario. | ACCEPTED; pendiente de §14 cerrado por aceptación final. |
| 5 | Regresiones automatizadas de bootstrap, errores, token/caché y gate; sesión sin cambios. | ACCEPTED. |
| 6–7 | Regresiones de disclosure, nombre accesible, teclado, foco, drawer y cleanup; reportes de DevTools/transición xl y PASS manual final de accesibilidad, teclado y foco. | ACCEPTED; pendientes de §14 cerrados por aceptación final. |
| 8–9 | Tests estructurales y reporte manual favorable desktop/responsive/zoom 200 %, ratificado con la aceptación final de QA. | ACCEPTED al nivel de evidencia reportado, sin inventar resultados individuales no aportados. |
| 10 | Inventario exacto y revisión de límites del incremento; sin backend, Healthcare, permisos ni capacidades adicionales de Top Bar. | ACCEPTED. |

Evidencia automatizada posterior a los fixes, conservada de §13: **111/111 PASS en ocho suites**, typecheck frontend, ESLint, build Next.js y formato focal **PASS**. No hubo cambio productivo ni causa nueva que requiera repetir suites. **Code Review realizado, sin bloqueos pendientes; P2-01 CLOSED y P2-02 CLOSED** según declaración final del usuario y evidencia registrada.

La deuda histórica del **focus trap completo del drawer permanece OPEN**. No se declara implementado el focus trap, el resto de DEC-OX-050 ni Stage 3 general. No se modifican contratos de sesión ni permisos/backend.

### Preparación del commit local autorizado

Worktree ox-shell-01a-readiness y rama feat/ox-shell-01a-account-menu verificados. El inventario coincide exactamente con once archivos frontend y este ticket, sin archivos temporales, .env, credenciales, output/ o tmp/. Revisión del diff incluye las cuatro rutas inicialmente untracked. Las huellas SHA-256 del frontend coinciden con la versión ya validada; sólo cambia este ticket durante la aceptación. No se detectaron patrones de secretos en los archivos autorizados revisados. git diff --check y whitespace de nuevos archivos comprobados antes del staging; el índice se verifica nuevamente antes de crear el commit.

Mensaje convencional previsto: **feat(web): add accessible account menu to app shell**. Staging exclusivamente mediante las doce rutas explícitas de §5 y este ticket; no git add . ni git add -A. La identidad del commit y su inventario definitivo se informarán con el resultado real de Git después de crearlo; no se inventa un SHA ni se añade al propio commit una referencia autorreferencial.

**Veredicto de QA: READY FOR COMMIT APPROVAL; commit local expresamente autorizado por el usuario.** Sin pendientes de aceptación de QA para este incremento. CI remota, PR, integración y merge siguen sin ejecutarse y no se declaran cumplidos. No marcar DONE/MERGED ni establecer Actual SP; se mantienen las estimaciones y métricas anteriores sin inventar valores. La entrega local quedará **READY FOR PR** una vez verificados el commit y el estado Git posterior, sin crear ni publicar un PR en esta sesión.
