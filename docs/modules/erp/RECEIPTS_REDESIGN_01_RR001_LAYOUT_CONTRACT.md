# RR-001 — Contrato responsive y accesibilidad del workspace de recepciones

**Estado:** DISEÑO DEFINIDO / pendiente de aprobación visual y QA manual.
**PR de especificación:** #168 (Draft). **Implementación:** NO iniciada.
**Referencia:** boceto compartido por el usuario el 27-oct-2026 y `RECEIPTS_REDESIGN_01_SPEC.md`.
**Tecnología real:** Next.js + React + Tailwind CSS v4; `PageContainer`, `Section`, `Modal`, `PurchaseReceiptModal`, `CreateReceiptFlow`, `usePurchaseReceipts`.

## 1. Patrón de interacción

- **Elegido:** workspace de captura tipo *side sheet* / diálogo modal ancho. La lista de recepciones permanece visible en el fondo únicamente cuando el ancho lo permite; durante la captura **no es interactiva**.
- **Descartado en RR-001:** dos páginas paralelas navegables o dos formularios editables a la vez. No abrir una tercera instancia con estado de negocio separado.
- Entrada de `Recepciones → Nueva recepción`: seleccionar OC elegible y capturar dentro de un mismo flujo, sin perder verificación de historial y autoridad. Entrada de `Compras → Recibir`: precargar OC verificada y abrir exactamente **el mismo formulario de captura**.
- El diálogo no cambia la URL de la página subyacente en el MVP. La navegación al detalle de la recepción **solo** se realiza después de una respuesta exitosa real.
- **Selector de OC**: puede ser un paso dentro del workspace con búsqueda y estados `cargando / elegible / error / sin pendientes`; no se inventan datos de proveedor ni una confirmación falsa.

## 2. Breakpoints y dimensiones objetivo

Se usan breakpoints por **ancho de viewport**, no por tipo de dispositivo; un viewport estrecho o zoom 200% debe recibir layout de una columna. Las medidas son **targets de diseño para implementar y probar**, no propiedades que ya existan en el código.

| Ancho de viewport | Workspace | Historial tras abrir | Partidas | Bloques inferiores |
|---|---|---|---|---|
| **≥ 1440 px** | Panel derecho `width: min(1040px, 65vw)` y `height: 100dvh` | Visible como contexto (inert, sin clicks) | Tabla densa con desbordamiento horizontal solo si imprescindible | Adjuntos a la izquierda (55%), resumen a la derecha (45%) |
| **1024–1439 px** | Diálogo tipo hoja a pantalla completa, `width: 100vw`, `height: 100dvh` | Oculto por overlay; no interactivo | Tabla de partidas con ancho mínimo suficiente; scroll horizontal localizado | Dos columnas si el **contenedor** mide al menos 900 px; de lo contrario apilar |
| **768–1023 px** | Pantalla completa | Oculto | Tarjetas por partida con etiquetas persistentes | Adjuntos primero, resumen después |
| **≤ 767 px** | Pantalla completa con padding compacto | Oculto | Tarjetas verticales por partida | Adjuntos primero, resumen después; botones de ancho apropiado |

- `100dvh` con fallback a `100vh`. Respetar `env(safe-area-inset-bottom)` en footer móvil.
- En desktop ancho, el panel tiene **padding interno 24 px**, encabezado de 64–72 px y footer de acciones mínimo 72 px según contenido. En móvil, padding 16 px.
- El panel no debe quedar más angosto de 850 px **cuando se use tabla desktop**; si la distribución no alcanza, cambiar a modo full-screen o tarjetas en lugar de achicar columnas a la fuerza.
- `PurchaseReceiptModal` existente tiene `max-w-4xl` y `max-h-[90vh]`; ese ancho **no** debe reutilizarse sin adaptar. Se propone un `ReceiptWorkspaceDialog` que comparta la infraestructura de foco de `Modal` o una variante documentada del componente base, sin alterar el tamaño predeterminado para otros modales.
- Los umbrales exactos de tabla/tarjetas podrán utilizar **container queries** si el layout real demuestra mejor comportamiento; mantener equivalencia funcional y prueba responsive.

## 3. Anatomía visual del panel

```text
┌──────────────────────────────────────────────────────────────┐
│ Nueva recepción                     [Indicador]       [×]   │  HEADER FIJO
├──────────────────────────────────────────────────────────────┤
│ Compra origen [OC verificada]  ·  Estado de compra            │
│ Proveedor / información realmente disponible                 │
│                                                             │
│ Partidas pendientes                                         │
│ SKU   Pedido   Recibido   Pendiente   Recibir   Lote   Cad.  │
│ ...                                                         │
│                                                             │
│ Documento proveedor  |  Número del documento                 │
│ Notas                                                       │
│                                                             │  ÚNICO SCROLL VERTICAL
│ ┌──────────────────────────┬────────────────────────────────┐ │
│ │ Adjuntos (opcional)      │ Resumen de esta recepción      │ │
│ │ Solamente vista previa   │ Recibir ahora: X unidades     │ │
│ │ [Seleccionar PDF/JPG]    │ Pendiente tras: Y unidades    │ │
│ │ lista compacta           │ Datos derivados de la captura │ │
│ └──────────────────────────┴────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ [Cancelar]                        [Registrar recepción]     │  FOOTER FIJO
└──────────────────────────────────────────────────────────────┘
```

- El orden del DOM y de tabulación coincide con el orden visual.
- **No** insertar controles del boceto aún no soportados: `Guardar borrador`, `Rechazado`, `Motivo`, `Almacén destino`, ni `Confirmar recepción` como segundo comando.
- Mostrar en el resumen **solo** valores válidos inferibles del formulario actual. `Unidades a ingresar = suma de quantityReceived numéricas válidas`; `Pendiente después = suma del pendingQuantity menos las cantidades válidas a recibir`. Si existen entradas no válidas, mostrar aviso de revisión y **no** generar totales engañosos. La aprobación final continúa en el backend.
- El resumen es una proyección visual, nunca un sustituto de las verificaciones de la API.

## 4. Scroll, footer, errores y overlays

- **Un scroll vertical en el contenido del workspace**: contenedor `display:flex; flex-direction:column; height:100dvh; overflow:hidden`; contenido central `flex:1; min-height:0; overflow-y:auto`.
- Header y footer `flex-shrink:0`, fondo opaco y separación de borde. Footer no debe ser hijo sticky de una sección que pueda colocarlo encima de Notas/Adjuntos.
- La tabla puede tener `overflow-x:auto` propio **horizontal**, pero no un segundo scroll vertical. Nunca cortar controles de lote/caducidad por una altura fija en filas.
- Cuando el usuario intenta registrar con errores, mostrar el resumen del error y llevar foco al **primer campo inválido dentro del panel**, con `aria-describedby` y mensaje próximo a su input.
- Botón `Registrar recepción` deshabilitado durante envío, sin autoridad verificada, sin partidas válidas o con archivos locales pendientes no persistidos. Conservar feedback visible para explicar el bloqueo.
- En dispositivos reducidos con teclado en pantalla, se debe poder desplazar al campo activo sin que el footer lo tape. No forzar altura de contenido ni animación que bloquee el teclado.

## 5. Teclado, foco y confirmación de salida

- Contenedor con `role="dialog"`, `aria-modal="true"`, título enlazado a `aria-labelledby`, descripción opcional. Fondo **inert** mientras el modal esté abierto. `Tab` y `Shift+Tab` no escapan del diálogo; `Escape` sigue la misma lógica que el botón X.
- Foco al entrar desde Recepciones: selector de OC. Desde Compras: primer control editable de `Recibir ahora` después de verificar datos; durante carga, foco en título/status hasta que los controles estén listos.
- Al cerrar, devolver foco al botón que abrió la captura si todavía existe. Si desapareció por actualización del listado, colocarlo en el encabezado de la página o una alternativa visible.
- **Con cambios no guardados** (cantidad, lote, caducidad, documento/número, notas o archivos seleccionados), mostrar diálogo accesible de confirmación: `Seguir editando` / `Descartar cambios`. Evitar cerrar accidentalmente con Escape/click afuera. Durante `saving`, no permitir cierre ni doble envío.
- Si el usuario descarta cambios, el estado local se limpia de forma explícita. **No** se guarda un borrador persistente; no implicar eso en texto de UI.
- En éxito, mostrar folio de recepción **devuelto por API** y acciones `Ver recepción` / `Ver inventario`, preservando idempotencia/reintentos actuales.

## 6. Adjuntos, compactación y variantes

- La **tarjeta Adjuntos** ocupa el cuadrante **inferior izquierdo del panel de captura**, inmediatamente junto al resumen a la derecha en escritorio amplio; en móvil se presenta antes del resumen.
- Modo compacto para modal: título y texto `Opcional · Vista previa local`, selector PDF/JPG/JPEG, área drag/drop no mayor a **110 px** inicialmente, lista compacta `nombre · tamaño · quitar`, sin mensajes redundantes.
- Aviso persistente, sencillo y visible: `Los archivos no se guardan todavía.` Al seleccionar archivos, **bloquear registrar** y proporcionar opción `Limpiar selección`. Esto hereda la protección del PR #167; el código de ese PR **no está** en `main`.
- Al integrar backend real en otra iniciativa, cambiar el estado visual por **estados informados por el servidor** (cuarentena, verificando, disponible, rechazado) solo tras completar B3d5b3c2b/B3d5c.
- En el MVP no se debe hacer lectura de bytes ni generar URLs, ni atribuir el documento a una recepción registrada.

## 7. Componentes y responsabilidades

| Pieza | Responsabilidad | Se puede reutilizar |
|---|---|---|
| `ReceiptWorkspaceDialog` (propuesto) | Presentación responsive, foco y cierre | Infraestructura accesible existente de `Modal` |
| `ReceiptPurchaseSelector` (propuesto) | Selección/verificación de compra origen | Flujo y validaciones de `CreateReceiptFlow` |
| `ReceiptItemCapture` (extraído) | Tabla/tarjetas existentes, lote, caducidad | `PurchaseReceiptModal` |
| `ReceiptSupplierDocumentFields` (extraído si útil) | Documento, número y notas | Validaciones actuales |
| `ReceiptCaptureSummary` (propuesto) | Resumen derivado, sin persistencia | Estado único de `usePurchaseReceipts` |
| `ReceiptFilesPreview` (PR #167, Draft) | Selección **solo local**, bloqueo al enviar | Reutilizable sin conexión R2 |
| `ReceiptWorkspaceEntry` (adaptador) | Iniciar desde Compras o Recepciones sin duplicar estado | Hooks actuales y matriz de roles |

No renombrar ni trasladar servicios de dominio por motivos estéticos. Evitar duplicar `usePurchaseReceipts` por cada entrada visible.

## 8. Matriz de QA visual de RR-001

| Escenario | Resultado verificable |
|---|---|
| 1920×1080 y 1600×900 | Panel derecho visible; lista subyacente legible como contexto e inerte; tabla sin campos superpuestos |
| 1440×900 | Diálogo derecho legible, ancho razonable para captura y scroll vertical único |
| 1366×768 y 1024×768 | Captura a pantalla completa, scroll único sin corte de notas ni botones |
| 820×1180 y 768×1024 | Captura a pantalla completa, partidas en tarjetas, adjuntos/resumen apilados |
| 390×844 y 360×740 | Controles accesibles sin zoom horizontal global ni footer tapando contenido |
| Zoom del navegador 200% | UI migra a disposición compacta según ancho CSS efectivo; foco y footer utilizables |
| 15 partidas; errores largos y nombres SKU largos | Filas o tarjetas crecen; no hay texto cortado ni botones ocultos |
| Tab / Shift+Tab / Escape / cierre | Foco contenido, confirmación de descarte si dirty, restauración al origen |
| Modos LEGACY y PHYSICAL | Mismos requisitos de lote/caducidad y sin segunda lógica de validación |
| Entradas Compras y Recepciones | Exactamente mismo formulario de captura; no se pierde una ruta autorizada |

**Salida de RR-001:** este contrato sirve como Definition of Ready de RR-002, pero la aprobación visual definitiva requiere ejecutar el prototipo en navegador y comparar capturas. No declarar PASS de UI ni de accesibilidad sin pruebas reales.

## 9. Puntos que deben verificarse en RR-002

1. En Tailwind v4, validar la combinación `65vw`/límite máximo sobre layout real con sidebar y 200% zoom.
2. Reutilizar foco/modal existente mediante abstracción limpia; **no** copiar y pegar el focus trap.
3. Comprobar visualmente el aviso de cambios sin guardar y el bloqueo de adjuntos en los dos flujos.
4. Determinar si el paso de selección de OC requiere compartir el workspace desde la apertura o puede mantenerse como paso accesible dentro del mismo contenedor.
5. Mantener la flag de rediseño **independiente** de `NEXT_PUBLIC_ZAPING_FILES_RECEIPTS_UI`, ambas OFF por defecto.
