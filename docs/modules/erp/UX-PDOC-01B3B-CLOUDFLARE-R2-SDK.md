# UX-PDOC-01B3b — Cloudflare R2 SDK GetObject bridge

**Estado:** PR draft, conectividad preparada en código y pruebas simuladas; **sin bucket real conectado, ni upload/download activados**.
**Dependencia:** ADR-016, PR #145/#146 y #148; el scanner antimalware operativo es gate obligatorio.

## Implementado

- Dependencia directa `@aws-sdk/client-s3`, con versión exacta y `app/api/package-lock.json` generados juntos mediante npm. Validar ambos en `npm ci` durante CI.
- `createCloudflareR2S3Client(config)`: cliente oficial S3 v3, región `auto`, `forcePathStyle`, endpoint derivado de R2, credenciales de servidor explícitas y máximo 2 intentos.
- `CloudflareR2SdkTransport`: lectura con `GetObjectCommand({ Bucket, Key })`, señal de aborto tras 10 segundos y validación de stream Node.js (la ausencia de body se rechaza).
- `CloudflareR2ReadStore` de B3a continúa validando clave `private/{companyId}/{documentId}/{attachmentId}`, rechaza claves de cuarentena o tenant ajeno y transforma errores de proveedor en respuesta genérica.
- Servicio de B2 verifica tamaño y SHA256 del objeto íntegro antes de devolver bytes; el controller NestJS mantiene JWT/RBAC y descarga forzada con cabeceras defensivas.
- Pruebas unitarias del SDK con `S3Client.send` simulado para verificar `GetObject` exacto y rechazo de respuestas no-stream y fallos.

## Lo que NO está habilitado

`SupplierDocumentsModule` **sigue registrando `UnconfiguredPrivateAttachmentStore` (HTTP 503)**. Instalar el SDK o establecer `R2_STORAGE_MODE=r2` no habilita acceso. No hay credenciales Cloudflare, buckets creados o endpoint real configurado. Este PR no debe activar el SDK como provider de producción mientras falte el flujo de cuarentena → escáner real → `AVAILABLE`, ni sustituir el token de lectura por permisos de escritura.

## Gate siguiente

1. En una cuenta administrada de Cloudflare, crear buckets **privados** separados para cuarentena y documentos liberados en **QA**, Standard; deshabilitar r2.dev y custom domains públicos.
2. Emitir token **Object Read** limitado solo al bucket privado QA; guardar Access Key ID y Secret Access Key en gestor de secretos fuera de Git y fuera del chat. Otros tokens para cuarentena y escáner deben ser distintos.
3. Configurar las variables `R2_*` documentadas en B3a y probar el adaptador con un objeto **sintético no sensible** subido y escaneado por canal controlado. No modificar estado en base operativa.
4. Integrar escáner real con health gate, promoción restringida, atestación verificada, cuotas atómicas, retención y auditoría antes de activar cualquier descarga en entorno de usuarios.
5. Añadir pruebas de integración reales Cloudflare R2 con objeto erróneo, ausente, corrupto, credenciales revocadas, timeout, aislamiento entre empresas y liberación de streams.
6. Revisar `npm audit`, permisología/rotación de secretos, pruebas de carga y gates de release antes de merge.

**Fuente:** https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/ y https://developers.cloudflare.com/r2/api/tokens/.

Este PR no ejecuta migraciones locales ni modifica `main`, `zaping_dev` ni `zaping_qa`.
