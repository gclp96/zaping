# RR-007 — Release Gate de rediseño de recepciones

**Estado: BLOCKED / sin autorización de liberar**  
**Referencia de cambios:** PR #169 → #170 → #171 → #172 → #173.  
**Banderas:** `NEXT_PUBLIC_ZAPING_RECEIPTS_WORKSPACE` y `NEXT_PUBLIC_ZAPING_FILES_RECEIPTS_UI`, ambas OFF por defecto.

## Evidencia verificable (27-oct-2026)
- RR-003 CI #1031: Web, API, PostgreSQL PASS.
- RR-004 CI #1042: Web, API, PostgreSQL PASS.
- RR-005 CI #40545865470: Web, API, PostgreSQL PASS.
- RR-006 CI #40546371032: Web, API, PostgreSQL PASS (commit d0b15084). Un nuevo cambio de pruebas, commit 6b4735de, necesita CI propia.
- PR #167 de vista previa local de archivos continúa Draft y **no** implementa carga real, escaneo o persistencia.

## Matriz de aceptación manual (pendiente)
Para ambos accesos, **Compras → Recibir** y **Recepciones → Registrar recepción**, ejecutar en navegador real con una sesión QA no productiva:

| Gate | Verificación | Estado |
|---|---|---|
| VIS-01 | 1440 px: sheet a derecha, tabla y dos tarjetas inferiores sin recorte | NO EJECUTADO |
| VIS-02 | 1366, 1024 y 820 px: pantalla completa, tabla/tarjetas responsive, sin overflow vertical del viewport | NO EJECUTADO |
| VIS-03 | 390 px y zoom 200%: formularios legibles, footer accesible, sin doble scroll vertical | NO EJECUTADO |
| VIS-04 | Muchas líneas, lotes REQUIRED/OPTIONAL/NONE, errores largos y scroll horizontal de tabla | NO EJECUTADO |
| A11Y-01 | Tab/Shift+Tab, Escape, botón X, Cancelar, foco dentro de diálogos y retorno al opener | NO EJECUTADO |
| DISC-01 | Con cantidades, lote, fecha, documento, notas o archivos, pedir confirmación; Continuar mantiene datos | NO EJECUTADO |
| DISC-02 | Descartar limpia cambios; sin cambios cierra directamente; guardando no permite salida | NO EJECUTADO |
| FILE-01 | PDF/JPG/JPEG metadata-only; 5 archivos máximo; bloqueo de registro mientras exista selección | NO EJECUTADO |
| FILE-02 | Limpiar/Quitar vuelve a permitir registrar; no se envían bytes ni hay promesa falsa de guardado | NO EJECUTADO |
| BACK-01 | Autoridad PHYSICAL/LEGACY, traceability y errores 4xx; recepciones parciales y stock íntegro | NO EJECUTADO |
| LEG-01 | Ambas flags OFF conservan comportamiento clásico | NO EJECUTADO |

## Gates de seguridad antes de activar archivos reales
1. Autorización por rol y aislamiento por companyId comprobados a nivel API y objeto.
2. Bucket R2 privado, políticas de signed URLs con expiración y mínima exposición.
3. Ingesta segura (validación de contenido y MIME real, límites), antivirus ClamAV y cuarentena; fail-closed.
4. Estados consistentes del archivo; no declarar disponible hasta escaneo y persistencia confirmados.
5. Auditoría de carga, enlace a recepción y descarga; protección contra IDOR.
6. Tests de errores, borrado, reintentos, huérfanos e idempotencia; recovery y rollback documentados.

## Procedimiento de cierre
- Confirmar CI verde **del HEAD final** de PR #173 y cualquier descendiente.
- Capturar screenshots por viewport y resultados del checklist. Registrar defectos como tickets y bloquear release ante severidad alta/crítica.
- Revisar diferencias de ramas apiladas, incluido solapamiento con PR #167, para evitar duplicar componentes y perder protecciones.
- Revisar explícitamente permisos, auditoría, a11y y regresiones.
- Recién con evidencias y aprobación, planificar integración ordenada; no fusionar, desplegar ni activar banderas durante este gate.

**Decisión:** REDISEÑO NO LIBERABLE. CI automatizada por sí sola no acredita los checks manuales ni la seguridad del pipeline real de archivos.
