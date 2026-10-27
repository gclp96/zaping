# UX-FILES-01 — Vista previa local de adjuntos en recepciones

**Estado:** UI V1 experimental, sin almacenamiento ni transferencia. PR independiente basado en `main`; **no depende** de integrar los PR Draft del escáner/R2.

## Alcance

El componente reutilizable `web/app/components/files/ReceiptFilesPreview.tsx` se monta **solo si** la variable `NEXT_PUBLIC_ZAPING_FILES_RECEIPTS_UI` es exactamente `true`, tanto:
- En el formulario **Registrar recepción** tanto de **Compras → Recibir** como de **Recepciones → Registrar recepción**, después de Documento del proveedor/Número del documento y antes de Notas, asociado a la orden de compra seleccionada.
- En `web/app/(app)/purchase-receipts/[id]/page.tsx`, debajo de "Partidas recibidas", para una recepción ya registrada.

**Seguridad del formulario:** el backend no soporta todavía adjuntar documentos al crear la recepción. Para evitar pérdida silenciosa o la impresión de que se guardaron, **si hay archivos seleccionados solo para vista previa, el botón "Registrar recepción" permanece deshabilitado** y aparece una advertencia para quitar/limpiar la selección. Si no hay archivos, el flujo actual funciona sin cambios. El contador se reinicia al cerrar, reabrir o cambiar de orden de compra. Ningún archivo se añade al payload de la recepción.

El componente usa los estilos y componentes compartidos de Zaping ERP. Incluye:

- Zona de arrastrar/soltar con indicador visual durante el arrastre y selector mediante botón accesible con teclado.
- Lista local con nombre, tamaño y tipo; opciones para quitar un archivo o **limpiar toda la selección**.
- Reglas UX preliminares PDF/JPG/JPEG, hasta 10 MiB por archivo y 5 archivos por vista previa; rechazo de archivos vacíos, extensión/MIME discordantes, duplicados (incluso con lista llena) y exceso.
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

Luego abrir **Registrar recepción** en `/purchase-receipts` y seleccionar una OC elegible para visualizar la sección dentro del formulario. También se muestra en el detalle de una recepción existente (`/purchase-receipts/<id>`). Si el puerto 3000 ya está ocupado y Next.js ofrece 3002, abre el puerto **del proceso nuevo** y detén los servidores duplicados para evitar comparar una versión anterior de la aplicación.

Para ocultarla, eliminar la variable o asignar cualquier valor distinto de `true` y reiniciar Next.js. Las variables `NEXT_PUBLIC_*` se integran en el cliente durante build: este flag **no es** un control de autorización ni un mecanismo seguro para activar uploads. Por defecto permanece oculto.

## QA y Definition of Done para esta fase

- Componente y validador con pruebas unitarias y UI para selección, arrastre con resaltado y recuperación visual, drop, límite, errores, duplicados a máxima capacidad, quitar, limpiar toda la lista y ausencia de tráfico.
- Página de detalle probada con flag deshabilitado y habilitado. Modal de registro probado con y sin selección temporal; no se permite confirmar si existen archivos sin persistencia.
- Contador al formulario probado para seleccionar, quitar y limpiar, sin lectura de bytes.
- `npm run test`, `npm run typecheck`, `npm run lint` y `npm run build` del frontend; CI backend existente no debe cambiar.
- PR Draft independiente sin merge automático a `main`.

## Siguientes etapas antes de carga REAL

1. Resolver B3d5b3c2b: permisos positivos mínimos, interfaces SQL autenticadas y sesiones no propietarias, más prueba de emisión y verificación.
2. Resolver B3d5c: R2 cuarentena privada, scan real con firma fresca, promoción segura con comprobación de bytes origen/destino, transición auditada y reconciliación.
3. Definir contrato HTTP con RBAC y aislamiento tenant para recepciones: reservar, subir con URL firmada corta, confirmar/quarantena, estado, cancelar, listar y descargar solo si `AVAILABLE`.
4. **Únicamente entonces** conectar upload real y estados provenientes del servidor. Nunca mostrar un progreso falso, jamás confiar en el flag UI como permiso, nunca exponer URLs R2 privadas ni interpretar `CLEAN_CANDIDATE` como archivo disponible.

## Fuera de alcance

No hay nuevas rutas API, datos de ejemplo inventados en la respuesta de la recepción, campos de adjuntos añadidos a su DTO, cambios Prisma, conexión Cloudflare R2, ni posibilidad de descargar documentos. Las secciones del ERP siguen funcionando igual cuando el flag está deshabilitado.

## Diagnóstico de una UI local que no muestra la sección

- El botón **Registrar recepción** de la página de Recepciones solo está disponible a perfiles `ADMIN`, `MANAGER` y `WAREHOUSE`, y una sesión confirmada; en Compras, la acción **Recibir** usa la misma matriz. No se alteran permisos para mostrar la vista preliminar.
- La ruta `/purchases` usa un punto de entrada distinto de `/purchase-receipts`; **ambos deben estar actualizados** con la misma rama y el mismo feature flag.
- Comprueba `git branch --show-current` y `git rev-parse --short HEAD`. Tras actualizar una rama, **reinicia Next.js** desde la carpeta `web` con el flag establecido en el **mismo proceso**.
- Si existe otro `next dev` en el puerto 3000 y el nuevo arranca en 3002, detén el proceso anterior; el navegador que sigue en `:3000` no está mostrando la compilación nueva. Comprueba los puertos que escucha Windows con `Get-NetTCPConnection -State Listen -LocalPort 3000,3002 | Select LocalPort,OwningProcess`. Si es necesario, inspecciona el proceso con `Get-Process -Id <PID>` antes de cerrarlo.
- Verifica dentro del modal de Compras que aparece **Adjuntos de la recepción**. Con un archivo local seleccionado, **Registrar recepción** debe estar bloqueado; tras quitarlo, debe recuperarse el registro normal.
