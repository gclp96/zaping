# UX-PDOC-01B3c — prueba real de lectura de Cloudflare R2 (solo QA)

**Estado:** prueba preparada, **NO ejecutada contra R2** por falta de buckets y token QA. Base: PR #149 y ADR-016. **No habilita descarga/upload de usuarios**.

## Controles y alcance

El test opcional `test/cloudflare-r2-readonly.qa.e2e-spec.ts` usa el SDK S3 real solamente cuando `RUN_CLOUDFLARE_R2_QA_SMOKE=1`. Verifica buckets privados con nombres terminados en `-qa`, distingue objetos `private/` y `quarantine/`, confirma acceso de lectura mediante ListObjectsV2 sin imprimir claves, descarga una **muestra artificial** y valida su tamaño y SHA-256. Rechaza solicitudes con Company distinta antes de llamar a R2.

**Solo lectura:** no crea ni borra buckets/archivos; no utiliza PutObject, DeleteObject ni CopyObject. No modifica Prisma ni estados de escaneo. No demuestra por sí solo que el token tenga permisos exclusivamente de lectura o que el bucket no sea público: ambas propiedades se comprueban en Dashboard.

## Aprovisionamiento manual (QA)

1. Entrar a https://dash.cloudflare.com/ → Storage & databases → R2 → Overview. Crear dos buckets **Standard**, privados y separados: `zaping-quarantine-qa` y `zaping-private-qa`. No activar `r2.dev` ni dominios públicos.
2. En **Manage R2 API Tokens**, crear token S3 **Object Read only**, restringido **únicamente al bucket privado QA**. No incluir cuarentena ni utilizar permisos de administrador. Guardar Access Key ID y Secret Access Key en gestor de secretos, nunca en Git o chats. Cloudflare muestra el secreto una sola vez.
3. Crear un archivo sintético localmente desde la raíz del repo ejecutando `powershell -NoProfile -File scripts/r2/prepare-qa-fixture.ps1`. El script NO accede a la red; imprime ruta temporal, clave privada objetivo, Company ID, SHA-256 y tamaño.
4. En el bucket privado QA del Dashboard, usar **Create folder** para crear/navegar por `private/<companyUUID>/<documentUUID>/`, y **Upload** para el archivo llamado `<attachmentUUID>`. Verificar que la clave real coincide exactamente con la generada. Esta prueba NO equivale a una promoción antimalware; **no marcarla AVAILABLE en base de datos**.

Fuente oficial: https://developers.cloudflare.com/r2/objects/upload-objects/ y https://developers.cloudflare.com/r2/api/tokens/.

## Ejecución local Windows PowerShell

Desde `C:\dev\zaping\app\api` con la rama B3c activa, configurar secretos **solo en la terminal local**, sin escribirlos en comandos/history:

```powershell
npm ci
$env:RUN_CLOUDFLARE_R2_QA_SMOKE = '1'
$env:R2_STORAGE_MODE = 'r2'
$env:R2_ACCOUNT_ID = Read-Host 'Cloudflare Account ID'
$env:R2_JURISDICTION = 'default'
$env:R2_PRIVATE_BUCKET = 'zaping-private-qa'
$env:R2_QUARANTINE_BUCKET = 'zaping-quarantine-qa'
$env:R2_READ_ACCESS_KEY_ID = Read-Host 'R2 Object Read Access Key ID'
$secureSecret = Read-Host 'R2 Object Read Secret' -AsSecureString
$env:R2_READ_SECRET_ACCESS_KEY = ([pscredential]::new('r2', $secureSecret)).GetNetworkCredential().Password
Remove-Variable secureSecret
```

Configurar en la **misma terminal** las cuatro variables no secretas impresas por el script: `R2_QA_FIXTURE_COMPANY_ID`, `R2_QA_FIXTURE_OBJECT_KEY`, `R2_QA_FIXTURE_SHA256`, `R2_QA_FIXTURE_SIZE_BYTES`. Después ejecutar:

```powershell
npm run test:e2e -- --runInBand test/cloudflare-r2-readonly.qa.e2e-spec.ts
Remove-Item Env:\R2_READ_ACCESS_KEY_ID -ErrorAction SilentlyContinue
Remove-Item Env:\R2_READ_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
```

No guardar claves secretas en pruebas, commits, comentarios de PR, tickets ni capturas. **No colocar R2 secrets en GitHub Actions por ahora**; la ejecución local evita ese riesgo. Si la jurisdicción no es default, ajustar `R2_JURISDICTION` a la jurisdicción real, usando endpoint derivado del Account ID.

## Evidencia y gates restantes

Registrar solamente PASS/FAIL y fecha, sin copiar trazas con información sensible. Revisar en Dashboard que ambos buckets siguen privados y que el token está limitado a Object Read para `zaping-private-qa`.

**La integración productiva permanece cerrada:** faltan escáner real, subida autenticada con cuota y aislamiento, promoción segura, auditoría de lectura, permisos completos HTTP y pruebas de navegador. `SupplierDocumentsModule` continúa con `UnconfiguredPrivateAttachmentStore` (HTTP 503). No modificar `main`, `zaping_dev` ni `zaping_qa`.
