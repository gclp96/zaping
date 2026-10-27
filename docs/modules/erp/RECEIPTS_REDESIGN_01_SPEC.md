# RECEIPTS-REDESIGN-01 — Especificación funcional y UX

**Producto:** Zaping ERP · Recepciones de compras  
**Tipo:** contrato de diseño (sin implementación)  
**Estado:** DRAFT / para revisión, no aprobado para despliegue  
**Referencia visual:** boceto de pantalla de Recepciones compartido el 27-oct-2026  
**Base técnica inspeccionada:** `main` del repositorio `gclp96/zaping` y documentación `PURCHASE_RECEIPTS.md`, `PURCHASES.md`; **UX-FILES-01 está en el PR #167 Draft, todavía no en main.**

## 1. Decisión de producto

Transformar la captura de recepciones de un modal limitado en un **workspace de trabajo con panel ancho**. La pantalla conserva la lista de recepciones a la izquierda y un área de captura a la derecha. La zona inferior del **panel de captura** se divide en:

- **Izquierda:** `Adjuntos de la recepción` (compacto y opcional).
- **Derecha:** `Resumen de recepción` (calculado con los campos ya soportados).

La referencia ilustra futuras capacidades que **no se deben fingir**: rechazo de mercancía, motivos, guardado persistente de borradores, selección de almacén y confirmación de un estado documental separado de crear la recepción. Esas capacidades quedan fuera del MVP de rediseño.

El objetivo de este contrato es preservar que **registrar una recepción válida = registrar una entrada física**. No separar la creación en dos comandos `guardar` y `confirmar` sin cambios aprobados de dominio.

## 2. Alcance comprobado hoy (CURRENT)

| Concepto | CURRENT | Comportamiento en rediseño inicial |
| --- | --- | --- |
| Compra origen | Compras CONFIRMED / PARTIALLY_RECEIVED elegibles | Selector de compras y datos de origen verificados antes de captura |
| Cantidad pedida, recibida, pendiente | Existentes | Tabla legible; pendiente derivada del historial, no editable |
| Recibir ahora | Existente, validado con límite de pendiente | Input numérico por partida, no permitir sobrerrecepción |
| Lote / caducidad | Existentes, reglas según tracking / autoridad LEGACY/PHYSICAL | Reutilizar controles y reglas actuales, jamás inferir obligatoriedad global |
| Documento del proveedor | Tipo, número | Mantener ambos campos accesibles |
| Notas | Existente | Mantener captura y validación |
| Registrar recepción | POST idempotente; genera inventario y cuando aplica equipos | Un solo comando «Registrar recepción», con feedback de operación y error |
| Listado / detalle | Existentes | Mantener tablas y rutas /purchase-receipts y /purchase-receipts/:id |
| Roles | ADMIN, MANAGER, WAREHOUSE para captura; otros según matriz actual | No ampliar ni simular permisos desde el frontend |
| Adjuntos | PR #167 Draft: solo vista previa local PDF/JPEG, sin transferencia | Reutilizar cuando se integre; nunca mostrar «guardado/subido» sin respaldo real |

**Fuente de verdad operacional:** `usePurchaseReceipts`, `usePurchaseReceiptPreparation`, DTO/API de Purchase Receipts y la autoridad del backend. La pantalla no calculará una segunda lógica de validación ni creará movimientos.

## 3. Estructura de la interfaz

### Escritorio ancho

```text
┌─────────────────────────────── Zaping Recepciones ───────────────────────────────┐
│ Header y botón Nueva recepción                                                  │
├───────────────────────┬─────────────────────────────────────────────────────────┤
│ HISTORIAL             │ CAPTURAR RECEPCIÓN                                      │
│ filtros / tabla       │ Compra origen + estado real                             │
│ estado actual         │ Proveedor, folio, fecha real disponible, responsable    │
│ acciones autorizadas  │ Partidas pendientes: pedido, recibido, pendiente,       │
│                       │ recibir ahora, lote y caducidad                        │
│                       │ Documento del proveedor / número y notas               │
│                       │ ┌──────────────────────┬─────────────────────────┐    │
│                       │ │ ADJUNTOS             │ RESUMEN                 │    │
│                       │ │ compacto             │ Unidades que ingresarán │    │
│                       │ │ vista previa local   │ Pendientes restantes   │    │
│                       │ └──────────────────────┴─────────────────────────┘    │
│                       │ Cancelar                         Registrar recepción  │
└───────────────────────┴─────────────────────────────────────────────────────────┘
```

- Panel de captura suficientemente ancho para filas y controles, sin truncamiento de SKU, cantidades o errores; el layout no debe reservar ancho excesivo al listado.
- Aumentar densidad de información de la tabla de partidas antes de agregar nuevas capacidades.
- Footer de acciones visible con scroll del contenido; nunca superponer controles ni lista de archivos. El scroll principal debe ser del panel, no múltiples scrolls anidados innecesarios.
- El listado puede quedar visualmente atenuado mientras está abierto el workspace; controlar foco y navegación de teclado.
- El boceto es **dirección visual**, no fuente de datos: cifras, marcas, estados, almacenes y motivos ilustrados no deberán hardcodearse.

### Tableta / móvil

- En anchos reducidos, el área de captura ocupa pantalla completa con encabezado y navegación «Volver»; no mantener dos columnas comprimidas.
- Las partidas pasan a tarjetas o tabla horizontal con información esencial visible y encabezados por campo.
- Los bloques «Adjuntos» y «Resumen» se apilan (adjuntos primero).
- Footer legible y fijo solo cuando no tape controles. Escalado a 200%, teclado y contenido largo deben funcionar.

### Jerarquía en el panel de captura

1. Título `Nueva recepción` y salida claramente identificada.
2. Compra origen y status real de compra.
3. Información verificable del proveedor y compra, sin inventar sede/almacén/moneda/responsable ausentes.
4. Partidas pendientes con cantidades capturables, lote/caducidad con requisitos según producto.
5. Documento del proveedor, número, notas.
6. Adjuntos (izquierda) + resumen (derecha).
7. Cancelar + **Registrar recepción**. No mostrar `Guardar borrador` ni `Confirmar recepción` separados en la primera entrega.

## 4. Flujos de usuario

### A. Desde Recepciones

`/purchase-receipts` → acción autorizada `Nueva recepción` → seleccionar compra elegible → verificar historial y autoridad → captura → resumen → registrar → respuesta real del servidor → `Ver recepción` o regresar al historial.

### B. Desde Compras

`/purchases` → `Recibir` sobre compra elegible → **mismo componente y estado de captura**, precargando contexto verificado → registrar → resultado real → detalle de recepción. No mantener dos formularios que diverjan en validación/adjuntos.

### C. Parciales y múltiples recepciones

Mostrar pedido, recibido previo y pendiente, todos derivados de estado/historial autorizado. Permitir recibir menos del pendiente. Al abrir otra recepción, volver a comprobar disponibilidad en servidor para evitar usar datos obsoletos.

### D. Error, salida y confirmación

- Cancelar o cerrar con cambios sin guardar: advertir antes de perder cantidades/notas/selección local. No prometer un borrador persistido.
- Error o conflicto al crear: conservar campos locales y mensajes, permitir reintento respetando el comportamiento de la `Idempotency-Key`.
- Después de éxito: mostrar folio real y acciones existentes, sin crear un estado adicional `CONFIRMED`.
- Si el backend rechaza permisos o no se puede verificar la compra/autoridad, bloquear la operación. No asumir éxito ni permitir envío por un flag UI.

## 5. Adjuntos: diseño aprobado, seguridad bloqueada

**Posición aprobada:** tarjeta compacta en la **esquina inferior izquierda del panel de captura**, a la izquierda del resumen, no en el listado lateral de recepciones.

Composición mínima:
- Título `Adjuntos de la recepción` y etiqueta `Opcional`.
- Selector y zona drag/drop de bajo perfil.
- Lista de nombre, tamaño y opción de eliminar; scroll interno solo si realmente es necesario.
- En modo actual, mensaje visible `Vista previa local · No se guarda ningún archivo`.
- Máximo y tipos tomados del contrato real o, mientras no exista, del prototipo #167 (PDF/JPG/JPEG, hasta 10 MiB, cinco ítems). No convertirlos en límites definitivos del backend sin revisión.

**Regla no negociable mientras siga sin almacenamiento:** seleccionar archivos en la vista previa **bloquea registrar** y ofrece `Limpiar selección`. No registrar mercancía dejando al usuario creer que la remisión quedó vinculada.

**No** existen estados de carga ni descarga operativos; `CLEAN_CANDIDATE`, `CONSUMED` o cualquier metadato no equivalen a archivo `AVAILABLE`. Cloudflare R2 y escaneo siguen sujetos a los PR Draft de seguridad B3d5b3c2b/B3d5c.

## 6. Fuera de alcance — tickets de dominio separados

| Elemento del boceto | Motivo | Requisito antes de habilitar |
| --- | --- | --- |
| `Rechazado`, motivo y «con diferencias» | No consta recepción de rechazados en la API actual | Modelo de eventos de rechazo, impacto en cantidades, trazabilidad y reglas de inventario |
| `Guardar borrador` | No hay lifecycle `PurchaseReceipt DRAFT` | Definición de persistencia, expiración, permisos, edición, conflictos y recovery |
| `Confirmar recepción` como segundo paso | Crear receipt actualmente materializa el ingreso | Definir estado y comando explícitos, integridad e idempotencia |
| Almacén destino/selección múltiple | Purchase Receipts V1 no declara multi-warehouse | Contrato Branch/Warehouse, autorización y stock por ubicación |
| Filtros de almacén/estado de receipt no existentes | UI no sustituye modelo | DTO/campos server-side y migraciones de dominio |
| Adjuntar archivos reales | R2/promoción/scan/roles aún no liberados | Backend y contratos R2 verificables, RBAC tenant-scoped, análisis vigente |
| Trazabilidad de rechazos en movimientos | Semántica no aprobada | Decisión de inventario: rechazado nunca genera `IN` normal |

Estas funciones pueden mostrarse en un concepto de diseño **marcadas como futuras**, pero no en una interfaz funcional que induzca a pulsarlas.

## 7. Arquitectura de componentes prevista

- **Nuevo contenedor** `ReceiptWorkspace` (nombre provisional), orquesta visibilidad, compra seleccionada, foco, panel responsive y aviso de cambios sin guardar.
- **Reutilizar** `usePurchaseReceipts` y `usePurchaseReceiptPreparation` (no duplicar estado de negocio).
- **Extraer / reutilizar** la presentación de partidas que hoy existe en `web/app/(app)/purchases/components/PurchaseReceiptModal.tsx`; evitar mantener una tercera versión de las mismas reglas.
- **Entradas:** Recepciones (actual `CreateReceiptFlow`) y Compras (actual invocación de `PurchaseReceiptModal`) convergen en el mismo workspace.
- **Adjuntos:** integrar el `ReceiptFilesPreview` de PR #167 **solo después de coordinar la base de ramas**; #167 no está fusionado a `main`.
- **Detalle:** `/purchase-receipts/[id]` conserva sus secciones de inventario, lotes y activos, y la sección de archivos del #167 cuando proceda.
- **RBAC:** la sesión y guardias del servidor prevalecen. No habilitar rutas nuevas a roles excluidos mediante deep links.
- **Switch reversible:** feature flag propio del rediseño, OFF por defecto, independiente del flag de archivos; al desactivarse conserva la experiencia actual.

Las rutas, flags definitivas y estrategia de navegación con URL deberán resolverse en el diseño técnico de implementación; este documento no crea una ruta ficticia ni un endpoint.

## 8. Criterios de aceptación MVP (AC)

- **AC-01:** ADMIN, MANAGER y WAREHOUSE autorizados pueden iniciar captura desde Recepciones y Compras; SALES no adquiere permisos.
- **AC-02:** ambas entradas utilizan el mismo estado/controladores y muestran el mismo comportamiento para parcial, lote, caducidad y errores.
- **AC-03:** ninguna compra DRAFT/CANCELLED/RECEIVED es recibible por ese flujo.
- **AC-04:** pedido/recibido/pendiente no son editables; `Recibir ahora` no admite cantidades mayores al pendiente ni valores inválidos.
- **AC-05:** modalidad PHYSICAL / LEGACY y tracking de lote/activo preservan las reglas actuales; cada operación válida genera exactamente los movimientos y equipos existentes, sin duplicación.
- **AC-06:** documento del proveedor y notas se conservan exactamente como en el formulario previo.
- **AC-07:** resumen informa exclusivamente cantidades derivables de los campos vigentes, sin calcular rechazos inexistentes.
- **AC-08:** tarjeta compacta de adjuntos aparece abajo a la izquierda del panel; lista, limpiar y advertencia local funcionan bajo flag; selección pendiente bloquea registrar.
- **AC-09:** footer, foco, escape, scroll, zoom y vista móvil permiten operar sin campos ocultos ni interacción inaccesible.
- **AC-10:** POST sigue usando la clave idempotente y la respuesta real; errores no crean recepciones fantasmas, no se registra `AVAILABLE` ni se suben bytes.
- **AC-11:** con flag OFF, flujo anterior funciona sin regresión en ambos puntos de entrada.
- **AC-12:** no hay cambios al esquema, API de recepciones, stock o privilegios como parte del rediseño MVP.

## 9. QA y release gates

Automatizadas: tests de componentes React + navegación desde Compras/Recepciones, role matrix, cálculos de pendiente, validaciones, éxito/reintento/idempotencia, regresión responsive y no-network para adjuntos; TypeScript, lint, build, CI existentes.

Manual: escritorio 1366/1440+, ventana estrecha, tablet y móvil, zoom 200%, recepción de una y muchas partidas, errores largos, teclado, escape, focus-trap/restauración, banner de seguridad de adjuntos, scroll hasta notas/footer, compra totalmente recibida y fallo de red.

Estrategia de corte: primero **PR Draft** con spec; después implementación controlada con flag OFF, QA local por rol, validación con datos sintéticos y reversión simple por flag. No desplegar la versión diseñada como «operativa» antes de cerrar gates y el stack de seguridad de archivos.

## 10. Resolución propuesta en RR-001 y validación pendiente

El contrato específico de medidas, breakpoints, comportamiento del panel, foco,
scroll, cierre con cambios y diseño compacto de archivos está en
[`RECEIPTS_REDESIGN_01_RR001_LAYOUT_CONTRACT.md`](./RECEIPTS_REDESIGN_01_RR001_LAYOUT_CONTRACT.md).

**Decisiones de diseño propuestas para la implementación:**
1. Panel derecho tipo diálogo modal para viewport ≥ 1440 px, ancho objetivo
   `min(1040px, 65vw)`; pantalla completa en viewport menor.
2. Historial **inerte** durante captura; datos de la compra previamente verificados.
3. Encabezado/footer fuera del único scroll vertical del cuerpo; sin superposición.
4. `Cancelar`, Escape y X: confirmación de descarte cuando existan cambios.
5. Se conserva la URL subyacente hasta registrar y recibir folio real.
6. `ReceiptFilesPreview` solo local, en esquina inferior izquierda; resumen a su derecha
   únicamente donde el ancho del panel lo permita.

**Pendiente:** aprobación visual en navegador en RR-002/RR-006 y coordinación técnica
con el PR #167 aún Draft. La propuesta no representa QA de interfaz ya realizado.
