# RR-002A — Workspace de captura reversible (implementación inicial)

**Estado:** IMPLEMENTADO EN RAMA / validación de CI pendiente.
**Base:** PR #168 (especificación), NO `main`.
**Objetivo limitado:** ampliar el contenedor del editor existente a una hoja de trabajo
responsive sin duplicar su lógica de negocio.

## Cambios

- `Modal` acepta `layout="workspace"` y un `footer` opcional. Por defecto
  mantiene exactamente `layout="default"`, ancho `max-w-4xl` y sin footer separado.
- El modo workspace coloca la hoja a la derecha en viewport ≥1440px:
  `width: 65vw` limitado a `max-width:1040px`. En viewport menor usa
  pantalla completa con `100dvh` y fallback `100vh`.
- Cuerpo central con un único scroll vertical y pie independiente que no puede
  tapar Notas, lote/caducidad u otros campos. El pie respeta safe-area inferior.
- Se reutiliza el foco, Escape, Tab/Shift+Tab y restauración del
  `Modal` accesible existente. No se copian mecanismos de modal.
- `PurchaseReceiptModal` usa esta disposición solo cuando
  `NEXT_PUBLIC_ZAPING_RECEIPTS_WORKSPACE=true` **y** la recepción aún se está
  capturando. La pantalla de éxito conserva el diseño existente.
- Ambos puntos de entrada (Compras → Recibir y Recepciones → Registrar) ya
  renderizan `PurchaseReceiptModal`; por tanto usan la misma bandera y los mismos
  callbacks, `usePurchaseReceipts`, autoridad de recepción y validaciones.
- La cantidad, tipos de lote, caducidad, notas, documento del proveedor, respuesta
  de servidor e Idempotency-Key conservan su implementación previa.

## Ver localmente (solamente QA de interfaz)

En la rama del PR de implementación, desde PowerShell:

```powershell
cd C:\dev\zaping\web
$env:NEXT_PUBLIC_ZAPING_RECEIPTS_WORKSPACE="true"
npm run dev -- -p 3000
```

El puerto 3000 debe estar **libre**; no iniciar un segundo servidor web que
colisione con Docker. No modificar API, PostgreSQL QA ni otros contenedores para
hacer un screenshot. Si el único puerto disponible es alternativo, verificar
antes CORS y sesión de la API.

Para regresar al modal anterior, cerrar el servidor, quitar la variable o
establecerla en `false` y volver a iniciarlo.

Esta bandera `NEXT_PUBLIC_*` es de compilación/UX, **no** es permiso.

## Alcance intencionalmente pendiente

- Este cambio NO implementa aún el diseño interior de partidas densas ni el
  bloque dual Adjuntos/Resumen de RR-003, RR-004 y RR-005.
- No implementa confirmación de descarte con campos dirty; la UX definitiva
  y la prueba correspondiente son pendientes en RR-003/RR-006, por lo que la
  bandera se mantiene **OFF por defecto**.
- No incorpora `ReceiptFilesPreview`, todavía en PR #167 Draft. Integrar
  bajo base coordinada, sin borrar/alterar el trabajo de INSAP.
- No hay rechazos, borradores persistentes, cambio de almacén, nuevo
  comando de confirmación, endpoints, migraciones, grants SQL, R2 ni ClamAV.

## Pruebas necesarias para continuar

- `Modal`: variante workspace con footer fuera del scroll, foco y semántica;
  variante clásica sin regresión.
- `PurchaseReceiptModal`: flag ON/OFF, mismo callback de registro,
  edición desktop/móvil y permisos de autoridad.
- CI Web: test, typecheck, build, lint; CI API/historical intactas.
- Prueba manual posterior: 1920, 1440, 1366, 1024, 768, 390 px y zoom 200%;
  verificar que pie no tape notas y que la tabla se navegue sin recorte.
- No fusionar ni desplegar hasta completar diseño, descarte seguro,
  integración de adjuntos demo y QA de RR-003..RR-007.

**Este es un shell controlado, no el rediseño final ni la activación de Zaping Files.**
