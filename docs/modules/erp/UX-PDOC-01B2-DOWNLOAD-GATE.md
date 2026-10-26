# UX-PDOC-01B2 — Download authorization & integrity gate

**Estado:** Implementación parcial, PR draft. **El almacenamiento privado real no está conectado**. Ticket: #132. Base: PR #145 y #140.

## Alcance implementado

`GET /supplier-documents/:documentId/attachments/:attachmentId/download` usa los guardias JWT y RBAC ADMIN/MANAGER del controlador de documentos.

- Recepción de **IDs**, no de URLs ni paths aportados por el cliente.
- Confirma que `SupplierDocument` pertenece a `companyId`, que el archivo pertenece a ese mismo documento y empresa, tiene `status=AVAILABLE` y `removedAt=null`. Todas las consultas van filtradas antes de acceder al almacenamiento.
- La clave `storageKey` permanece en el servidor. No aparece en la respuesta ni se construye ningún link público.
- Antes de devolver contenido, comprueba tamaño exacto (hasta 10 MiB) y SHA-256 contra los metadatos registrados. Una lectura con bytes de más, incompleta o modificada no emite archivo parcial al cliente.
- La respuesta es descarga forzada (`Content-Disposition: attachment`) con nombre codificado según RFC 5987, tipo estricto PDF/JPEG, `nosniff`, `Cache-Control: private, no-store`, `CSP: sandbox` y `Cross-Origin-Resource-Policy: same-origin`.
- Las solicitudes sin permisos permanecen bloqueadas por los guardias; los documentos inexistentes de otra empresa no revelan su existencia.

## Fail closed explícito

El puerto `PrivateAttachmentObjectStore` define `openReadOnly(storageKey): Promise<Readable>`. Su implementación registrada **`UnconfiguredPrivateAttachmentStore`** responde 503 intencionalmente. Esto evita servir bytes o prometer disponibilidad mientras no exista almacenamiento real y antivirus obligatorio. Una fila marcada `AVAILABLE` manualmente en CI **no constituye** un escaneo real de malware.

**El PR NO habilita descargas funcionales ni carga de archivos en producción.** El endpoint se mantiene cerrado hasta instalar y probar un adaptador privado de object storage compatible con S3 y un flujo antimalware verificado.

## Gate siguiente (B3)

1. Instalar SDK mantenido y lockfile revisado; proveedor cloud privado con credenciales de servidor, cifrado, bloqueo de acceso público, versionado/retención y permisos mínimos de bucket.
2. Implementar `openReadOnly` con conexión real, observabilidad de errores, timeout y control de límites. Nunca permitir entrada de URL/clave del usuario ni redirect a objetos públicos.
3. Integrar servicio de carga mediante streaming limitado ANTES de buffer, claves aleatorias creadas en servidor, cuota máxima por empresa/documento y transacciones sin carreras.
4. Aislar motor real de malware/PDF para procesar objetos `PENDING_SCAN` desde cuarentena; solo el proceso autorizado puede transicionar a `AVAILABLE`. Rechazar si el escáner no responde; no incluir endpoint administrativo genérico que promueva el estado.
5. Registrar auditoría de lecturas (actor, Company, documento, adjunto, timestamp y resultado sin datos sensibles); alertas y retención.
6. Pruebas de integración con S3 compatible privado, escáner y usuario real; controles de revocación, pertenencia tenant, MIME, objetos manipulados y abuso de tamaño.
7. UI debe usar `api.get(..., { responseType: 'blob' })` autenticado con bearer JWT. **No** usar links `<a href=/...>` si requieren token del interceptor Axios, ni exponer tokens en URL.

No tocar `zaping_dev` o `zaping_qa` ni `main` mientras estén pendientes los gates.
