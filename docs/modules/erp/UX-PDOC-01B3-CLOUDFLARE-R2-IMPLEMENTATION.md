# UX-PDOC-01B3a — Preparación de Cloudflare R2 para Zaping

**Estado:** Implementación parcial en PR draft; no es conexión de R2 en producción.
**Decisión:** ADR-016 (PR #147), Cloudflare R2 **Standard** como almacenamiento privado de adjuntos.
**Bases:** PR #145 (cuarentena) y #146 (descarga autenticada fail-closed).

## 1. Contrato de la integración actual

El código incorporado valida la configuración por ambiente y centraliza claves opacas. Tiene un boundary `CloudflareR2ReadStore` que recibe un `R2GetObjectTransport` inyectado, para ser adaptado al AWS SDK v3.

**Importante:** el `SupplierDocumentsModule` **mantiene `UnconfiguredPrivateAttachmentStore`**. No se conecta ni hace solicitudes a Cloudflare al iniciar la API. Los archivos no pueden descargarse todavía. No hay token R2 real, SDK ni proceso antivirus desplegado. Nunca marcar este PR como funcional en producción.

La API valida `R2_STORAGE_MODE` cuando es explícito, pero el hecho de configurar variables no habilita descargas. Los tests usan un transport simulado (ninguna conexión real).

## 2. Variables de entorno de servidor (NO subir valores al repositorio)

| Variable | Propósito |
|---|---|
| `R2_STORAGE_MODE` | `disabled` (predeterminado) o `r2` para verificar configuración |
| `R2_ACCOUNT_ID` | Account ID de Cloudflare (32 hex) |
| `R2_JURISDICTION` | `default`, `eu`, `us` o `fedramp`; el endpoint se deriva exclusivamente del Account ID y la jurisdicción |
| `R2_PRIVATE_BUCKET` | Bucket **privado** para objetos liberados |
| `R2_QUARANTINE_BUCKET` | Bucket **privado**, distinto del anterior, para cuarentena |
| `R2_READ_ACCESS_KEY_ID` | Token R2 con permisos de **lectura de objetos** limitado al bucket privado |
| `R2_READ_SECRET_ACCESS_KEY` | Secreto del token de lectura, alojado en gestor de secretos |

Nunca configurar un endpoint HTTP arbitrario desde el usuario. `region = auto`; `forcePathStyle = true` en el futuro cliente S3. Las jurisdicciones europeas/US/FedRAMP tienen hosts específicos: no basta cambiar el bucket de nombre.

## 3. Provisioning por entorno

Se requieren **ambos buckets separados** para cada ambiente:

| Ambiente | Cuarentena (ejemplo) | Privado (ejemplo) |
|---|---|---|
| DEV | `zaping-quarantine-dev` | `zaping-private-dev` |
| QA | `zaping-quarantine-qa` | `zaping-private-qa` |
| PROD | `zaping-quarantine-prod` | `zaping-private-prod` |

Los nombres son ejemplos, no buckets creados. No se creó ningún recurso externo.

1. En Cloudflare Dashboard: **Storage & databases > R2 > Overview > Create bucket**. Elegir la clase `Standard` y la jurisdicción requerida por cumplimiento antes de crear.
2. No habilitar acceso público (`r2.dev` ni Custom Domains). Verificar estado privado antes de copiar datos.
3. En **Manage R2 API Tokens** generar token **Object Read** restringido únicamente al bucket `zaping-private-{env}`. Copiar Access Key ID y Secret Access Key al gestor de secretos; jamás pegarlos en ChatGPT, en GitHub o capturas.
4. Preparar por separado los tokens para subir objetos a cuarentena y para el worker que lee cuarentena y promueve a privado, con mínimos permisos. No reutilizar el token de lectura en subida.
5. Establecer presupuestos, alertas, rotación, retención, y pruebas de restauración. Eliminar objetos de cuarentena abandonados únicamente mediante una política formal compatible con la retención de evidencias y registros.
6. Seleccionar un **escáner de malware/PDF confiable y operativo** antes de la primera carga productiva. Un registro `AVAILABLE` no debe crearse por un falso escáner, como el utilizado únicamente en QA PostgreSQL.

Documentación oficial:
- https://developers.cloudflare.com/r2/get-started/s3/
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.cloudflare.com/r2/buckets/create-buckets/

## 4. Integración del SDK pendiente (B3b)

No agregar imports de `@aws-sdk/client-s3` sin actualizar también `app/api/package-lock.json`. `npm ci` en el pipeline debe seguir siendo reproducible.

En la copia local del repositorio, con Node y npm de la versión fijada:

```powershell
cd C:\dev\zaping\app\api
npm install @aws-sdk/client-s3 --save-exact
npm run typecheck
npm run lint:check
npm test -- --runInBand cloudflare-r2
```

El resultado de la instalación debe incluir **ambos** `package.json` y `package-lock.json`, revisados por vulnerabilidades y versionados en la misma rama de implementación B3b. No usar un `npm install` dinámico como workaround en CI.

La adaptación será una clase tipo `R2GetObjectTransport` que invoque `S3Client.send(new GetObjectCommand({Bucket,Key}))`, valide que `Body` sea un flujo Node.js y use `AbortSignal`/timeout. El `CloudflareR2ReadStore` ya verifica que la clave tenga forma `private/{companyUuid}/{documentUuid}/{attachmentUuid}` y que su Company coincida con la autenticada. El servicio descarga, verifica tamaño/SHA-256 y responde únicamente después de leer el objeto completo.

Se requerirá un flag de release **distinto y protegido** del simple `R2_STORAGE_MODE` para activar el provider solo después de comprobar buckets, permisos, escaneo real, auditoría y pruebas integradas. La configuración NO es una prueba de que el escáner está disponible.

## 5. Gates que siguen pendientes

- SDK + lockfile, cliente conectado a endpoint Cloudflare, test de integración con R2 privado y endpoint jurisdiccional seleccionado.
- Bucket de cuarentena + subida autenticada limitada, cuota atómica por compañía/documento, almacenamiento verificable, escáner real y movimiento/liberación controlada.
- Solo el worker del escáner puede promover archivos a `AVAILABLE`. Proteger ese privilegio más allá de un campo `scanEngine` editable desde SQL.
- Auditoría de lecturas y de objetos eliminados/rechazados, rate limiting, lifecycle, alertas y manejo de errores del proveedor.
- E2E de JWT/RBAC `ADMIN/MANAGER`, `WAREHOUSE/SALES`, Company A/B, revocación de token, cambios de estado y objetos corruptos.
- QA manual navegador, gates de migración y aprobación final antes de integrar ramas. Mantener `main`, `zaping_dev` y `zaping_qa` intactos.

**Resultado de B3a:** configuración R2 validada, claves aisladas por compañía y contrato de lectura testeable; **sin activar almacenamiento real**.
