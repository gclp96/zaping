# UX-PDOC-01B — Base segura para adjuntos de proveedor

Ticket: #132 · Rama: `feat/ux-pdoc-01b-attachment-foundation` · Estado: **Draft, sin carga/descarga habilitada**.

## Decisión de arquitectura (propuesta técnica)
Zaping almacenará binarios fuera de PostgreSQL, en **object storage privado compatible con S3**. Los accesos requerirán JWT, rol ADMIN/MANAGER y scope de Company antes de solicitar el objeto. La clave interna nunca será una URL pública ni una entrada manipulable por usuarios.

- Tipos admitidos: **PDF y JPEG**, validados por extensión, MIME declarado y firma de bytes.
- Máximo por archivo: **10 MiB**. Máximo planeado por documento: **10 archivos** y cuota agregada inicial **100 MiB**; la cuota debe verificarse de forma atómica en el servicio de upload.
- Clave de objeto: aleatoria generada en el servidor; nunca aceptar rutas del cliente. Mantener cifrado del bucket y denegar acceso público.
- Fases de estado: `PENDING_SCAN` → `AVAILABLE` o `REJECTED` → opcional `REMOVED`. El trigger SQL impide crear directamente un registro `AVAILABLE`, alterar su clave o reutilizar metadatos.
- Las respuestas públicas solamente muestran metadatos inocuos de los elementos `AVAILABLE`, sin `storageKey`, SHA-256 ni detalles de escaneo.
- Ningún archivo debe servirse mientras no exista motor antimalware **funcional, verificado y obligatorio**, con políticas de PDF no confiable. En caso de caída del escáner: negar disponibilidad, no saltar el gate.
- Conservación y eliminación lógica: ningún archivo ni metadato debe eliminarse físicamente desde flujos ordinarios. Se requiere diseño de retención, auditoría y procesos de limpieza con autorización antes del release.
- Diferenciar evidencia del proveedor de CFDI emitido/validado por SAT. Adjuntar un PDF no valida su autenticidad fiscal.

## Entregado en B1
1. Modelo Prisma `SupplierDocumentAttachment` aislado por empresa, documento y actor; migración aditiva con FKs compuestas y límites de contenido.
2. Estados y trigger que impide metadata mutable, borrado físico, transición inválida y bypass de registro pendiente de escaneo.
3. Inspección estricta del archivo en memoria (no se ha conectado a un endpoint).
4. Endpoint de listado **solo metadatos disponibles**: `GET /supplier-documents/:id/attachments` con autenticación y RBAC existentes.
5. Pruebas unitarias de firmas, tamaño, nombres, aislamiento y campos privados; PostgreSQL E2E en CI aislado.

## Pendiente (no declarar el ticket completo)
- Implementar adaptador de storage, credenciales seguras, versionado de bucket y pruebas de integración con objeto real.
- Implementar streaming/upload con límites antes de bufferizar y cuotas atómicas; validar checksum servidor contra bytes reales y escanear antes de pasar a `AVAILABLE`.
- Endpoint de descarga con autorización por objeto/tenant, `Content-Disposition: attachment`, cabeceras de seguridad, auditoría de lectura y pruebas de no exposición de storage keys.
- Escáner obligatorio y cuarentena real, políticas de antivirus y métricas/alertas.
- Auditoría de eventos, política de retención y UI de adjuntos; pruebas de navegador, seguridad y performance.

**Gates:** no ejecutar en `zaping_dev` ni `zaping_qa`, no habilitar upload/download y no hacer merge antes de CI, revisión y QA integrada. El trabajo parte de #140 para evitar dependencia de los PR Web apilados #141/#142/#144.
