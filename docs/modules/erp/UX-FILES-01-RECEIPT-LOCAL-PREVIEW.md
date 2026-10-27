# UX-FILES-01 — Vista previa local de adjuntos en recepciones

**Estado:** UI V1 experimental, sin almacenamiento ni transferencia. PR independiente basado en `main`; **no depende** de integrar los PR Draft del escáner/R2.

## Alcance

En `web/app/(app)/purchase-receipts/[id]/page.tsx`, después de "Partidas recibidas", se monta el componente reutilizable `web/app/components/files/ReceiptFilesPreview.tsx` **solo si** la variable `NEXT_PUBLIC_ZAPING_FILES_RECEIPTS_UI` es exactamente `true`.

El componente usa los estilos y componentes compartidos de Zaping ERP. Incluye:

- Zona de arrastrar/soltar y selector accesible con teclado.
- Lista local con nombre, tamaño y tipo; opción de quitar.
- Reglas UX preliminares PDF/JPG/JPEG, hasta 10 MiB por archivo y 5 archivos por vista previa; rechazo de archivos vacíos, extensión/MIME discordantes, duplicados y exceso.
- Mensajes accesibles de validación y advertencias visibles: **los archivos NO se guardan, suben, analizan ni descargan**.
- Sin uso de `FileReader`, `Blob`, `URL.createObjectURL`, localStorage, IndexedDB, cookies, fetch, Axios, formularios de envío o endpoint API. Después de seleccionar, React conserva únicamente nombre, tamaño, categoría e ID efímero. Todo se pierde al recargar, cambiar de recepción o desmontar el componente.

**Esta interfaz no garantiza el contenido del archivo.** La revisión del MIME/extension es solo informativa; el backend deberá validar bytes reales, límites, tenant/RBAC y SHA-256 antes de cualquier flujo de cuarentena.

## Habilitar para revisión LOCAL

En PowerShell, antes de ejecutar Next.js:

```powershell
cd C:\dev\zaping\web
$env:NEXT_PUBLIC_ZAPING_FILES_RECEIPTS_UI="true"
npm run dev
```

Luego abrir una recepción existente en `/purchase-receipts/<id>`. La sección se mostrará en esa página solo si la recepción carga correctamente.

Para ocultarla, eliminar la variable o asignar cualquier valor distinto de `true` y reiniciar Next.js. Las variables `NEXT_PUBLIC_*` se integran en el cliente durante build: este flag **no es** un control de autorización ni un mecanismo seguro para activar uploads. Por defecto permanece oculto.

## QA y Definition of Done para esta fase

- Componente y validador con pruebas unitarias y UI para selección, drop, límite, errores, duplicados, quitar y ausencia de tráfico.
- Página de detalle probada con flag deshabilitado y habilitado.
- `npm run test`, `npm run typecheck`, `npm run lint` y `npm run build` del frontend; CI backend existente no debe cambiar.
- PR Draft independiente sin merge automático a `main`.

## Siguientes etapas antes de carga REAL

1. Resolver B3d5b3c2b: permisos positivos mínimos, interfaces SQL autenticadas y sesiones no propietarias, más prueba de emisión y verificación.
2. Resolver B3d5c: R2 cuarentena privada, scan real con firma fresca, promoción segura con comprobación de bytes origen/destino, transición auditada y reconciliación.
3. Definir contrato HTTP con RBAC y aislamiento tenant para recepciones: reservar, subir con URL firmada corta, confirmar/quarantena, estado, cancelar, listar y descargar solo si `AVAILABLE`.
4. **Únicamente entonces** conectar upload real y estados provenientes del servidor. Nunca mostrar un progreso falso, jamás confiar en el flag UI como permiso, nunca exponer URLs R2 privadas ni interpretar `CLEAN_CANDIDATE` como archivo disponible.

## Fuera de alcance

No hay nuevas rutas API, datos de ejemplo inventados en la respuesta de la recepción, campos de adjuntos añadidos a su DTO, cambios Prisma, conexión Cloudflare R2, ni posibilidad de descargar documentos. Las secciones del ERP siguen funcionando igual cuando el flag está deshabilitado.
