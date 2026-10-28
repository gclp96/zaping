# RR-007 — Release Gate de rediseño de recepciones

**Estado: código INTEGRADO en `main` (PR #176); ACTIVACIÓN GENERAL BLOQUEADA hasta completar gates de rollout**  
**Referencia de cambios:** PR #168 → #169 → #170 → #171 → #172 → #173 → #174 → #175; integración `main` PR #176, merge `83ce41e`. PR paralela #167 subsumida y cerrada.  
**Banderas:** `NEXT_PUBLIC_ZAPING_RECEIPTS_WORKSPACE` y `NEXT_PUBLIC_ZAPING_FILES_RECEIPTS_UI`, ambas OFF por defecto.

## Evidencia verificable (27-oct-2026)
- Integración de diseño RR-001–RR-007 y corrección de URL API en PR #176, fusionado a `main`; el HEAD final `6e08288` incorporó vista previa local en detalle, tests y documentación de #167. Cualquier nuevo cambio requiere CI propia.
- CI HEAD final `6e08288a81b25ad1f93870d7cf3cb8d2a7f8315f`: [run 40612272176](https://github.com/gclp96/zaping/actions/runs/40612272176), Web/API/Historical upgrade pre-S1 **3/3 PASS**.
- El navegador QA usó Next.js :3002, NestJS :3003; `GET /health/ready` devolvió HTTP 200 con protocolo `inventory-authority-v1`. Esta evidencia es de entorno local, no de producción.
- Los resultados de QA manual, capturas y límites se documentaron progresivamente en el hilo de PR #174. No se ejecutó una recepción real ni un cutover.
- PR #167 quedó cerrado como superseded por #176: incorpora vistas de captura y detalle, tests y contrato de preview local. No implementa carga real, escaneo o persistencia.

## Matriz de aceptación manual (evidencia parcial, NO release aprobado)
La evidencia proviene del navegador local con una sesión QA; distinguir **PASS visual / manual reportado**, **PARCIAL** y **PENDIENTE**. La prueba manual no sustituye pruebas de seguridad backend.

| Gate | Verificación | Estado / evidencia |
|---|---|---|
| VIS-01 | 1440 px: sheet derecho, tarjetas inferiores y footer | **PARCIAL:** adjuntos izquierda/resumen derecha y footer visibles; cobertura superior incompleta |
| VIS-02 | 1366, 1024, 820 px: responsive, scroll, selector e historial | **PARCIAL:** zonas observadas correctas; 960 px adicional comprobado; faltan todas las interacciones por viewport |
| VIS-03 | 390 px y zoom 200% | **PARCIAL:** tarjetas y footer visibles a 390; zoom 200% permite ver encabezado/resumen/acciones; no todos los campos ni a11y total |
| VIS-04 | Muchas líneas, lotes REQUIRED/OPTIONAL/NONE, errores largos | **PARCIAL:** OPTIONAL (KIT ANGIOGRAFICO) y NONE (OC QA) vistos; muchas líneas/REQUIRED/errores largos pendientes |
| A11Y-01 | Tab/Shift+Tab, Escape, X, Cancelar, trampa/retorno de foco | **PARCIAL:** usuario confirma navegación y descartes; falta comprobar foco restaurado/focus trap completo |
| DISC-01 | Cambios sin guardar → confirmar y Continuar mantiene datos | **PARCIAL:** cantidades y archivos comprobados; cobertura de todos los campos pendiente |
| DISC-02 | Descartar limpia; sin cambios cierra; guardando no permite salir | **PARCIAL:** reabrir limpia cantidades y adjuntos; guardar en progreso/no cambios no verificados completamente |
| FILE-01 | Vista previa PDF/JPG/JPEG, máximo 5 y bloqueo registro | **PARCIAL:** PDF 1/5 y bloqueo de submit visibles; JPG/JPEG y límites por tamaño/número pendientes |
| FILE-02 | Quitar/Limpiar, no-network / no-persistencia | **PARCIAL:** quitar restablece 0/5 y el botón; la no-transmisión está garantizada por el código del prototipo, no por una captura de red exhaustiva |
| BACK-01 | PHYSICAL/LEGACY, 4xx, trazabilidad y stock íntegro | **PARCIAL:** resumen de recepción parcial 5/2/3, inválida y recuperación; caducidad requiere lote y se corrige; backend conserva cobertura CI, sin prueba manual de POST |
| LEG-01 | Ambas flags OFF y formulario clásico en ambos puntos | **PARCIAL:** fallback clásico confirmado visualmente desde Compras → Recibir; otro acceso pendiente |
| RBAC-01 | ADMIN/MANAGER/WAREHOUSE/SALES, accesos directos y multiempresa | **PARCIAL:** ADMIN en workspace, WAREHOUSE menú de compras/recepciones, SALES menú restringido y URLs directas denegadas según usuario; MANAGER y flujo WAREHOUSE aún pendientes |

### Invariantes comprobados en UI (sin registro)
- OC-26-00002: pendiente 5, recibir 2, posterior 3; cantidad mayor que pendiente invalida el resumen y al corregirlo recupera 5/2/3.
- OC-26-00004: lote opcional, caducidad introducida sin lote muestra error contextual; al capturar un lote de prueba desaparece el error; pendiente 20, recibir 1, posterior 19.
- Archivo local PDF de ejemplo: 1/5 y registro bloqueado; al quitarlo 0/5 y acción rehabilitada. **No hay archivos reales en servidor/R2**.

## Gates de seguridad antes de activar archivos reales
1. Autorización por rol y aislamiento por companyId comprobados a nivel API y objeto.
2. Bucket R2 privado, políticas de signed URLs con expiración y mínima exposición.
3. Ingesta segura (validación de contenido y MIME real, límites), antivirus ClamAV y cuarentena; fail-closed.
4. Estados consistentes del archivo; no declarar disponible hasta escaneo y persistencia confirmados.
5. Auditoría de carga, enlace a recepción y descarga; protección contra IDOR.
6. Tests de errores, borrado, reintentos, huérfanos e idempotencia; recovery y rollback documentados.

## Procedimiento de cierre
- CI verde del HEAD final de #176 **confirmada** (3/3 PASS); mantener habilitación/rollout bloqueado hasta completar los controles manuales faltantes.
- Capturar screenshots por viewport y resultados del checklist. Registrar defectos como tickets y bloquear release ante severidad alta/crítica.
- Revisar diferencias de ramas apiladas, incluido solapamiento con PR #167, para evitar duplicar componentes y perder protecciones.
- Revisar explícitamente permisos, auditoría, a11y y regresiones.
- El código ya está fusionado en `main` con banderas OFF; no desplegar configuraciones que activen los flags ni habilitar adjuntos reales sin cierre documentado del gate.

**Decisión:** INTEGRACIÓN DE CÓDIGO COMPLETA / ROLLOUT UI AÚN NO AUTORIZADO. La matriz visual principal tiene evidencia parcial suficiente para revisión, pero faltan gates de regresión/seguridad para activar flags. Los archivos reales permanecen fuera de alcance y desactivados hasta aprobar pipeline seguro.
