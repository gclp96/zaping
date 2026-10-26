# UX-PDOC-01B3d1 — Puerto seguro de escritura en cuarentena

**Fecha:** 26/10/2026  
**Estado:** Implementación de infraestructura, PR draft; sin endpoint HTTP ni cargas reales habilitadas.  
**Dependencias:** #140, #145, #146, #148, #149 y #150; ADR-016 Cloudflare R2 Standard.

## Problema

Zaping debe aceptar PDF/JPEG sin exponer credenciales ni permitir acceso a archivos que no han sido analizados. La validación de lectura QA R2 pasó 3/3 pruebas reales (PR #150), pero su token **Object Read** es solo para el bucket `zaping-private-qa` y **no debe reutilizarse para escritura**.

## Entregado en B3d1

1. `consumeQuarantineUpload` procesa un stream binario de Node.js con límite **10 MiB mientras llegan los chunks**, antes de reunirlos en memoria. Comprueba longitud declarada (si existe), integridad del cuerpo completo, nombre, extensión, MIME, firma PDF/JPEG y SHA-256. Una subida truncada, desbordada o de tipo falso se rechaza.
2. `requireTenantQuarantineR2Key` valida `quarantine/{companyUUID}/{documentUUID}/{attachmentUUID}` y exige que el Company de la clave coincida con el Company autorizado.
3. `CloudflareR2QuarantineWriter` usa **`PutObjectCommand`** del SDK S3 v3 contra un bucket fijo de cuarentena, `ContentLength`, `ContentType`, un timeout y **`IfNoneMatch: '*'`** para impedir sobrescritura, validando hash y tamaño antes de invocar el SDK. Convierte errores potencialmente sensibles del proveedor a un mensaje genérico, sin exponer keys, bucket ni secretos.
4. Pruebas unitarias con cliente S3 simulado: streams maliciosos/truncados, archivo excesivo, chequeos de MIME/extensión, SHA manipulado, aislamiento por Company, rutas no autorizadas, no-overwrite y proveedor indisponible.
5. Se preservan los proveedores **fail-closed** de `SupplierDocumentsModule`: ninguna ruta HTTP llama al escritor ni concede `AVAILABLE`. No se agrega token de escritura al servicio activo.

## Decisiones de seguridad

- Usar **token separado Object Read & Write** restringido exclusivamente a `zaping-quarantine-qa`, nunca el `zaping-r2-qa-readonly`. Esta es la opción de escritura del panel R2; no concede permisos sobre `zaping-private-qa`. En una evolución posterior, derivar credenciales temporales restringidas a la acción `PutObject` y al prefijo específico mediante firma local confiable, si resulta operativo. Las credenciales deben permanecer en gestor de secretos y jamás imprimirse ni introducirse en Git/ChatGPT.
- La firma de bytes y SHA-256 detectan inconsistencias de formato, **NO** eliminan malware. El objeto solo existe en cuarentena hasta que haya escáner real; nunca se pone a disposición del usuario mediante descarga.
- `PutObject` condicional con `If-None-Match: *` usa semántica atómica de create-once documentada en R2. Un timeout/error de red puede dejar el resultado ambiguo: **no repetir la escritura con la misma clave sin conciliar su estado**.
- Los límites de memoria de este helper **no reemplazan** los límites HTTP a nivel proxy/multipart ni la cuota total de empresa/documento. Para habilitar carga deberá existir un parser streaming con límites de tamaño y cantidad de partes, tipo, autenticación y rechazo temprano.
- No utilizar una URL firmada para omitir validaciones del backend; no construir claves desde nombre de archivo, folio o ruta proporcionada por el usuario.

## Pendientes para B3d2: reserva y auditoría de subidas

**No activar B3d1 en producción sin resolver estos casos:**

1. Diseñar transacción atómica de reserva/cupo por Company/Document con `SELECT ... FOR UPDATE`, límite por documento y cuota total. Contar registros en proceso, aprobados y fallidos conforme a una política explícita; no confiar en un `count` concurrente sin lock.
2. Definir estados persistentes `RESERVED/UPLOADING/UPLOAD_FAILED/PENDING_SCAN` y sus migraciones, control de caducidad, reintentos idempotentes, deduplicación y recuperación. El esquema actual solo conoce `PENDING_SCAN` como estado inicial y no permite registrar una subida fallida sin inventar un escaneo.
3. Resolver fallos parciales **R2/DB**: si R2 confirma y DB falla, conciliar huérfanos sin borrar evidencia inadecuadamente; si hay timeout, usar verificación y reproceso seguro. Diseñar jobs de recuperación y retención.
4. Añadir auditoría `UPLOAD_STARTED/UPLOADED/FAILED` y bucket/scanner read permission separation. No permitir que el frontend o un usuario de BD ordinario marque archivos `AVAILABLE`.
5. Seleccionar e integrar escáner malware/PDF aislado, con atestación verificable por worker antes de copiar al bucket aprobado y marcar `AVAILABLE`.
6. Solo entonces implementar endpoint `POST /supplier-documents/:id/attachments` con JWT y RBAC, cuotas, multipart streaming y pruebas de Company A/B con usuarios reales.

## Gates pendientes

- CI (Jest, typecheck, build, lint, Historical upgrade).
- Revisar y evaluar separadamente R2 QA Object Write **por bucket de cuarentena**: no usar ni ampliar el token de lectura existente.
- Test de objeto sintético contra R2 QA con permiso `Object Read & Write` limitado al bucket de cuarentena y operación de escritura explícitamente aprobada (no incluido en este PR).
- QA HTTP, PostgreSQL concurrente, protección contra malware y auditoría de promociones.
- No cambiar `main`, `zaping_dev` ni `zaping_qa` mientras estos gates estén pendientes.

**Fuentes Cloudflare:**
https://developers.cloudflare.com/r2/objects/upload-objects/
https://developers.cloudflare.com/r2/reference/consistency/
https://developers.cloudflare.com/r2/api/s3/api/
