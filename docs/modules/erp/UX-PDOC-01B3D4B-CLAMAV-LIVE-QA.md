# UX-PDOC-01B3d4b — Prueba real aislada de ClamAV con EICAR

**Corte:** 26/10/2026.  
**Tipo:** laboratorio de integración real por GitHub Actions, **NO servicio desplegado**.  
**Dependencia:** PR #154 (B3d4a adaptador ClamAV simulado en CI).

## Decisión operativa de QA

Se usa un contenedor oficial **`clamav/clamav:1.4`** sobre GitHub Actions hospedado por GitHub, con máximo 4 GiB RAM, CPU limitada y Docker network dedicada, **sin puertos publicados**. Las firmas se cargan desde la imagen oficial y se pueden actualizar mediante `freshclam` incorporado (dependiente de conectividad y disponibilidad de firmas). La selección de rama exacta evita pagar el costo del contenedor en cada PR.

El cliente de prueba usa **otro contenedor Node 24** con `--network none`, sin Docker socket, sin credenciales ni permisos GitHub, sin escrituras al repositorio, montando solo volumen de socket de ClamAV y el código en modo lectura. El contenedor ClamAV no recibe secretos de R2 ni conexiones PostgreSQL.

ClamAV 1.4 LTS tiene soporte esperado hasta agosto de 2027. La imagen 1.4 actualiza parches dentro de esa rama; el script verifica que el motor real sea **1.4.6 o superior** y exige firmas con fecha válida y edad máxima **72 horas**. Cualquier fallo detiene la prueba.

## Pruebas reales (no mocks)

Archivo `scripts/r2/clamav-live-smoke.mjs`, ejecutado por `.github/workflows/clamav-b3d4b-live-qa.yml`:

1. `zPING` / `zVERSION`: disponibilidad real de daemon, versión segura, firmas cargadas y vigencia. Hasta 5 minutos de preparación por carga/actualización de definiciones.
2. `zINSTREAM`: PDF sintético de bytes pequeños debe devolver `stream: OK`.
3. `zINSTREAM`: JPEG sintético de bytes pequeños debe devolver `stream: OK`.
4. `zINSTREAM`: **EICAR** (firma oficial de prueba **inofensiva**, generada solo en memoria) debe devolver un resultado `FOUND` y nunca `OK`.
5. Socket inexistente: la conexión falla y no existe ruta de escape que lo interprete como limpio.
6. El pipeline retira contenedor, volumen de socket y Docker network con `if: always()`, aun si el smoke falla; limita los diagnósticos de logs.

## Ejecución y costos

- El workflow ejecuta **automáticamente solo** en pushes de la rama `test/ux-pdoc-01b3d4b-clamav-live-qa` cuando cambian el workflow o su script. Tras integración posterior en `main`, `workflow_dispatch` permitirá ejecutar a demanda; no activar temporalmente en ramas de producción.
- El laboratorio usa los minutos de GitHub Actions y recursos del runner; **no implica contratar un servidor ClamAV de producción**.
- No toca los buckets de Cloudflare, ni `zaping_qa`, `zaping_dev`, ni archivos reales. No se crean tokens.
- Aun con éxito de EICAR, el clamd activo **no queda disponible** para el backend de Zaping fuera de este trabajo de CI.

## Interpretación de evidencia

Un resultado verde prueba que la **imagen oficial** puede cargar firmas actualizadas y detectar EICAR con el mismo protocolo `INSTREAM` sobre socket Unix usando el código del laboratorio. **NO** acredita por sí solo que el adaptador TypeScript del PR #154 esté configurado en producción; ese adaptador cuenta con pruebas unitarias aparte. Tampoco garantiza detección universal de malware.

No aceptar `CLAMD_OK_UNATTESTED` como autorización de descarga. Sin autenticación de worker, medición confiable de versión y edad de firmas, auditoría append-only de escaneo, copia verificada y bloqueo SQL de transición a `AVAILABLE`, los archivos seguirán en cuarentena.

## Siguiente B3d4c y B3d5

1. Especificar atestación duradera: Company, Reservation, hash SHA-256, tamaño, **scan policy version**, engine version, signature DB version/updatedAt, scanner worker principal, atestación de identidad y firma/verificación de resultado.
2. Acceso exclusivamente del worker a registrar resultados, bloqueo SQL y estados `SCAN_PENDING/CLEAN/INFECTED/SCAN_ERROR` independientes de los adjuntos. Las transiciones deben ser reconciliables y no reversibles sin auditoría.
3. Promoción segura con lectura desde cuarentena, copia de bytes idénticos al bucket privado, verificación SHA y transacción DB que solo marque `AVAILABLE` tras confirmación.
4. Desplegar un worker real con frescura de firmas, recursos, retención y monitoreo, bajo control presupuestal; posteriormente usar credenciales R2 temporales limitadas por bucket y roles DB mínimos.
5. Ejecutar QA E2E real R2/quarantine → scanner → audit → approved private → descarga con ADMIN/MANAGER/WAREHOUSE y pruebas cross-tenant.

## Fuentes oficiales

- https://docs.clamav.net/manual/Installing/Docker.html
- https://docs.clamav.net/manual/Usage/ClamdProtocol.html
- https://docs.clamav.net/faq/faq-eol.html
