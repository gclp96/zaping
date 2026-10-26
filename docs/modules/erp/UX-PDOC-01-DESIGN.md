# UX-PDOC-01 — Diseño de vínculos de documentos y adjuntos

Estado: **Diseño propuesto — requiere revisión antes de implementar**  
Ticket: #132. Dependencia de entrega UI: PR #131 (R2A-03).

## Diagnóstico de código
- `PurchaseReceipt` registra `supplierDocumentType` y `supplierDocumentNumber` heredados, no una clave verificable hacia `SupplierDocument`.
- `SupplierDocument` posee identidad `id, companyId, supplierId`; pueden coexistir ocurrencias distintas del mismo folio (`identityOccurrence`).
- `PurchaseReceiptDocument` vincula cantidades monetarias para conciliación R2A-02. **No reutilizar** para una mera relación de evidencia.
- El detalle de recepción muestra actualmente texto de referencia y no debe construir una ruta por comparación de folio.

## Contrato funcional
1. Agregar relación no monetaria `PurchaseReceiptSupplierDocumentLink`, con `companyId`, `receiptId`, `documentId`, `createdById`, `createdAt`, `removedById`, `removedAt`, `reason` y unicidad del vínculo activo. Garantizar FKs compuestas que impidan referencias entre tenants; validar mismo `supplierId` mediante transacción previa a insertar. No hacer backfill ambiguo por folio.
2. Exponer `GET /purchase-receipts/:id/documents` y operación de vinculación/desvinculación explícita, con validación de la recepción y el documento por `companyId`, proveedor, roles e idempotencia cuando corresponda. La consulta nunca revela registros de otro tenant.
3. En detalle de recepción, si hay vínculo válido mostrar `Ver documento` que navegue a `/supplier-documents/:id`. Si solo existe referencia heredada: `Referencia documental sin vínculo`; ofrecer vinculación mediante selección autorizada, no resolver automáticamente coincidencias.
4. Adjuntos `SupplierDocumentAttachment`: metadatos vinculados a `companyId` y `documentId`, `storageKey` privado (no URL pública), `originalName`, MIME detectado, bytes, checksum SHA-256, actor y timestamps, estado y historial. Soportar múltiples PDF/JPEG, con límites de tamaño, cantidad y cuota definidos antes de exponer upload. Validar firma real, bloquear contenido malicioso y tratar los PDF como contenido no confiable.
5. Usar proveedor de object storage privado con credenciales exclusivamente servidor; upload y descarga autorizados, URLs firmadas breves o streaming; política de retención y versionado. Nunca almacenar binarios grandes en PostgreSQL, aceptar paths aportados por clientes, ni permitir acceso cruzado de empresas.
6. API y UI deben diferenciar documento interno recibido, adjunto escaneado, documento fiscal emitido por terceros y CFDI validado por SAT. Un PDF adjunto no constituye validación fiscal.

## Riesgos y restricciones
- No alterar el estado de recepción, inventario, `EquipmentAsset`, cobertura monetaria, compras ni conciliación.
- No migrar ni reescribir campos textuales históricos sin revisión explícita.
- La UI de documentos del PR #131 usa ADMIN/MANAGER; confirmar matriz de lectura operacional y mantener autorización real en NestJS antes de mostrar enlaces a otros roles.
- No considerar finalizado el ticket con solo la navegación: adjuntos y almacenamiento seguro forman una fase distinta del mismo alcance.

## Fases de entrega / pruebas
**A. Vínculo documental:** Prisma + SQL aditivo; endpoints transaccionales; lectura y vínculo/desvínculo; tests E2E PostgreSQL aislado. Cobertura de documentos con mismo folio, proveedores distintos, recepción compartida por varias remisiones, remisión vinculada a varias recepciones, roles y aislamiento por `companyId`.

**B. Adjuntos:** elegir storage y política de tamaño/cuota/escaneo, tabla de metadatos y auditoría; operaciones upload/download versionadas; pruebas MIME por firma, archivo vacío, exceso tamaño, abuso de ruta y acceso cruzado.

**C. UI:** selector de documentos, navegación segura por ID, manejo de referencias heredadas, vista previa/descarga, estados de error, pruebas de accesibilidad y navegador real.

**Gates:** primero revisar y cerrar PR #131, luego implementar A/B/C en PRs separados con CI, pruebas visuales y migración en DB efímera. No aplicar migraciones en `zaping_dev` o `zaping_qa` sin autorización y revisión explícita.
