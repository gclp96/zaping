# PUR-UX-01C — Panel contextual de Compras

**Referencia:** imagen entregada por el usuario, definida en issue #178. **PR apilado sobre #179, no sobre main**; flag `NEXT_PUBLIC_ZAPING_PURCHASES_WORKSPACE` OFF por defecto.

## Entrega
- Acción «Ver resumen» en la fila (mientras se conserva el enlace canónico `/purchases/:id`).
- Variante aditiva `layout="side-panel"` sobre el modal existente: panel derecho desde 960 px y ancho completo por debajo. Conserva focus trap/Escape/retorno de foco y body-scroll comunes; la instancia permanece montada con `isOpen=false` al cerrar para garantizar restauración de foco.
- Selección resaltada en DataTable mediante prop opcional `getRowClassName`, sin afectar consumidores existentes.
- Consulta el recurso concreto `GET /purchases/:id` **al abrir**, no considera el snapshot del listado autoritativo. Si recibe 403/error, oculta los datos y ofrece reintento.
- Consulta `GET /purchase-receipts/purchase/:id` y deriva recibidos por `purchaseItemId` (misma suma del detalle completo). Si falla, no muestra cantidades inventadas y **deshabilita Registrar recepción** hasta verificar; la recepción existente de todos modos realiza su preflight de historiales y movimientos.
- Presenta proveedor, folio, estado real, fecha corporativa, progreso, SKU, producto, solicitado, recibido, pendiente, costo, subtotal, IVA y total.
- Acciones invocan callbacks existentes (Aprobar/Editar/Cancelar/Registrar recepción/PDF) con el status y rol originales; no se agregan mutaciones ni endpoints nuevos.
- La ruta completa `/purchases/[id]` se conserva para historial y trazabilidad profunda.
- Cancelación de promesas al cerrar el panel, evitando refrescar una selección desactualizada.

## Fuera de alcance
Almacén destino, sede solicitante, condiciones de pago y moneda variable del mockup no existen aún en el contrato; no se inventan. No cambiar backend, Prisma, lotes, inventario, multiempresa, documentos R2 ni facturación.

## Gates antes de merge / rollout
- CI Web/API/PostgreSQL **del HEAD final** y tests focalizados de componente e integración.
- QA responsive 390/820/1024/1440, zoom 200%, scroll de tabla y footer; comparar referencia visual del usuario.
- QA teclado: Escape/X, foco atrapado/restaurado; entrada por botones del listado.
- Flujo de roles ADMIN/MANAGER/WAREHOUSE/SALES y error 403: no elevar permisos desde el frontend.
- Acciones de mutación delegadas a código preexistente, no ejecutar recepciones reales en pruebas visuales.
- Revisar integridad del PR #179 y si fusionarlo antes del stacked PR #180; **ninguna rama activa banderas por defecto**.
