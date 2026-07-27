# Módulo de Recepciones de Compra

**Módulo:** Recepciones de Compra  
**Versión:** 1.0.0  
**Estado:** Implementado  
**Estado de la documentación:** Borrador para aprobación  
**Última actualización:** 2026-07-23  
**Responsable:** Equipo Zaping  

---

# 1. Descripción general

El módulo de Recepciones de Compra administra la recepción física de mercancía asociada con órdenes de compra confirmadas.

Su responsabilidad principal es separar la aprobación comercial de una compra de la llegada física de los productos al inventario.

Una compra puede ser:

- Creada.
- Editada mientras se encuentre en borrador.
- Confirmada.
- Recibida parcialmente.
- Recibida completamente.
- Cancelada mientras permanezca en borrador.

El inventario no aumenta cuando una compra es creada o confirmada.

El inventario aumenta únicamente cuando la mercancía es recibida físicamente mediante una recepción de compra.

---

# 2. Propósito

Este módulo proporciona trazabilidad entre:

- Orden de compra.
- Proveedor.
- Productos comprados.
- Cantidades recibidas.
- Cantidades pendientes.
- Lotes de inventario.
- Números de lote.
- Fechas de caducidad.
- Movimientos de inventario.
- Usuario responsable de la recepción.

El módulo garantiza que el inventario represente la mercancía recibida físicamente y no únicamente la mercancía solicitada.

---

# 3. Alcance

## Incluido

- Recepciones parciales de mercancía.
- Recepciones completas de mercancía.
- Validación de cantidades pendientes.
- Registro de lotes.
- Registro de fechas de caducidad.
- Creación de lotes de inventario.
- Actualización de lotes existentes.
- Incremento del stock de productos.
- Generación de movimientos de inventario.
- Actualización del estado de la compra.
- Historial de recepciones.
- Registro del usuario responsable.
- Aislamiento multiempresa mediante `companyId`.

## No incluido

- Cancelación de recepciones.
- Reversión de recepciones.
- Devoluciones a proveedores.
- Flujos para mercancía dañada.
- Flujos de inspección de calidad.
- Administración de números de serie.
- Asignación de ubicaciones de almacén.
- Conciliación de facturas electrónicas de proveedores.
- Pruebas automatizadas específicas del formulario frontend de recepción.

---

# 4. Flujo de negocio

```text
Compra en DRAFT
    ↓
Compra en CONFIRMED
    ↓
Llega la mercancía
    ↓
Recepción de compra
    ↓
Validar cantidades recibidas
    ↓
Crear o actualizar InventoryBatch
    ↓
Incrementar stock del producto
    ↓
Crear InventoryMovement de tipo IN
    ↓
Actualizar estado de la compra
```

Posibles resultados finales:

```text
Quedan cantidades pendientes
    → PARTIALLY_RECEIVED

No quedan cantidades pendientes
    → RECEIVED
```

---

# 5. Ciclo de vida de los estados de compra

```text
DRAFT
  ├── CONFIRMED
  └── CANCELLED

CONFIRMED
  ├── PARTIALLY_RECEIVED
  └── RECEIVED

PARTIALLY_RECEIVED
  ├── PARTIALLY_RECEIVED
  └── RECEIVED
```

## Definición de estados

### DRAFT

La compra todavía puede editarse o cancelarse.

El inventario no se modifica.

### CONFIRMED

La compra está aprobada y puede comenzar a recibir mercancía.

El inventario no se modifica durante la confirmación.

### PARTIALLY_RECEIVED

Se recibió al menos una unidad, pero una o más partidas de la compra todavía tienen cantidades pendientes.

### RECEIVED

Todas las cantidades de todas las partidas de la compra fueron recibidas.

No se permiten recepciones adicionales.

### CANCELLED

La compra fue cancelada antes de su confirmación.

No se puede recibir mercancía.

---

# 6. Reglas principales de negocio

## 6.1 Validación de la compra

Una recepción solamente puede crearse cuando la compra:

- Existe.
- Pertenece a la empresa autenticada.
- Tiene estado `CONFIRMED` o `PARTIALLY_RECEIVED`.

La recepción debe rechazarse cuando la compra tenga alguno de estos estados:

- `DRAFT`
- `RECEIVED`
- `CANCELLED`

---

## 6.2 Aislamiento multiempresa

Cada compra, recepción, partida de recepción, lote y movimiento de inventario debe pertenecer al `companyId` autenticado.

La API nunca debe aceptar el `companyId` desde el cuerpo de la solicitud.

El identificador de la empresa se obtiene del payload del JWT autenticado.

---

## 6.3 Validación de partidas de compra

Cada `purchaseItemId` enviado en la recepción debe:

- Existir.
- Pertenecer a la compra seleccionada.
- Aparecer una sola vez dentro de la solicitud.

Las partidas duplicadas dentro de una misma recepción deben rechazarse.

---

## 6.4 Validación de cantidades

La cantidad recibida debe:

- Ser un número entero.
- Ser mayor que cero.
- Ser menor o igual que la cantidad pendiente.

La cantidad pendiente se calcula de la siguiente manera:

```text
Cantidad pendiente =
Cantidad comprada
− Suma de cantidades recibidas anteriormente
```

Ejemplo:

```text
Cantidad comprada: 10
Cantidad recibida anteriormente: 4
Cantidad pendiente: 6
```

Una nueva recepción mayor que `6` debe ser rechazada.

---

## 6.5 Reglas de lote y caducidad

Una partida de recepción puede incluir:

- Número de lote.
- Fecha de caducidad.
- Ambos.
- Ninguno.

No se puede registrar una fecha de caducidad sin proporcionar un número de lote.

La fecha de caducidad no puede ser anterior a la fecha de recepción.

---

## 6.6 Regla de actualización del inventario

Crear o confirmar una compra no debe modificar el inventario.

El inventario se modifica únicamente cuando una recepción de compra se crea correctamente.

Por cada partida recibida:

```text
Stock del producto += quantityReceived
```

---

## 6.7 Regla de lotes de inventario

Cuando todavía no existe un lote para la empresa y el producto:

- Se crea un nuevo `InventoryBatch`.
- Se establece `initialQuantity`.
- Se establece `availableQuantity`.
- Se almacena el costo unitario.
- Se almacena el número de lote.
- Se almacena la fecha de caducidad cuando fue proporcionada.

Cuando el mismo lote ya existe:

- Se reutiliza el lote existente.
- Se incrementa `initialQuantity`.
- Se incrementa `availableQuantity`.
- El lote se mantiene activo.
- Se recalcula el costo unitario promedio ponderado.

Fórmula del costo promedio ponderado:

```text
Nuevo costo promedio =
(
  Cantidad existente × Costo unitario existente
  +
  Cantidad recibida × Nuevo costo unitario
)
÷
Cantidad total
```

---

## 6.8 Regla de movimientos de inventario

Cada partida recibida genera un movimiento de inventario:

```text
movementType: IN
referenceType: PURCHASE_RECEIPT
referenceId: receiptId
quantity: quantityReceived
balance: stock resultante del producto
unitCost: costo unitario de la partida de compra
batchId: lote de inventario relacionado
createdBy: identificador del usuario autenticado
```

Los movimientos de inventario proporcionan el historial auditable de los cambios de stock.

---

## 6.9 Actualización del estado de la compra

Después de completar una recepción, el servicio calcula la cantidad restante de todas las partidas de la compra.

Cuando queda al menos una unidad pendiente:

```text
status = PARTIALLY_RECEIVED
```

Cuando no queda ninguna unidad pendiente:

```text
status = RECEIVED
```

---

## 6.10 Usuario responsable

El usuario responsable de la recepción se obtiene de:

```text
request.user.id
```

El valor se almacena en:

```text
PurchaseReceipt.receivedBy
```

Las consultas de recepciones incluyen al usuario relacionado con los siguientes campos:

- `id`
- `firstName`
- `lastName`
- `email`

Las recepciones históricas creadas antes de implementar esta relación pueden contener:

```text
receivedBy: null
receivedByUser: null
```

El frontend muestra estos registros como:

```text
No disponible
```

---

# 7. Atomicidad

La operación completa de recepción se ejecuta dentro de una transacción de Prisma.

La transacción incluye:

- Validación de la compra.
- Creación de la recepción.
- Creación de partidas de recepción.
- Creación o actualización de lotes.
- Actualización del stock del producto.
- Creación de movimientos de inventario.
- Actualización del estado de la compra.

Si alguna operación falla, todos los cambios deben revertirse.

Esto evita actualizaciones parciales del inventario y registros de recepción inconsistentes.

---

# 8. Modelo de datos

## PurchaseReceipt

Representa un evento de recepción de mercancía.

Campos principales:

```text
id
companyId
purchaseId
folio
receivedAt
receivedBy
notes
createdAt
updatedAt
```

Relaciones:

```text
Company
Purchase
Usuario responsable
PurchaseReceiptItem[]
```

---

## PurchaseReceiptItem

Representa una partida recibida de una compra.

Campos principales:

```text
id
companyId
receiptId
purchaseItemId
productId
quantityReceived
lotNumber
expirationDate
unitCost
batchId
createdAt
updatedAt
```

Relaciones:

```text
Company
PurchaseReceipt
PurchaseItem
Product
InventoryBatch
```

---

## InventoryBatch

Representa inventario agrupado por producto, lote y fecha de caducidad.

El módulo de recepciones puede crear un lote nuevo o actualizar uno existente.

---

## InventoryMovement

Representa la entrada auditable al inventario generada por una recepción.

La referencia del movimiento es la recepción de compra y no la orden de compra.

---

# 9. Endpoints de la API

Todos los endpoints requieren autenticación mediante JWT.

## Crear recepción

```http
POST /purchase-receipts
```

Ejemplo de solicitud:

```json
{
  "purchaseId": "purchase-uuid",
  "notes": "Recepción parcial",
  "items": [
    {
      "purchaseItemId": "purchase-item-uuid",
      "quantityReceived": 4,
      "lotNumber": "LOTE-001",
      "expirationDate": "2028-12-31"
    }
  ]
}
```

Posibles respuestas:

```text
201 Created
400 Bad Request
401 Unauthorized
404 Not Found
```

---

## Listar recepciones de la empresa

```http
GET /purchase-receipts
```

Devuelve las recepciones pertenecientes a la empresa autenticada.

Incluye:

- Compra.
- Proveedor.
- Partidas de recepción.
- Productos.
- Lotes.
- Usuario responsable.

---

## Obtener detalle de una recepción

```http
GET /purchase-receipts/:id
```

Devuelve una sola recepción filtrada por:

```text
receiptId
companyId
```

Cuando no existe un registro coincidente:

```text
404 Recepción no encontrada
```

---

## Listar recepciones de una compra

```http
GET /purchase-receipts/purchase/:purchaseId
```

Devuelve el historial completo de recepciones de una compra.

Antes de devolver las recepciones, el servicio verifica que la compra pertenezca a la empresa autenticada.

---

# 10. Comportamiento del frontend

El modal de detalle de compra muestra:

- Folio de la compra.
- Estado de la compra.
- Proveedor.
- Partidas compradas.
- Historial de recepciones.
- Movimientos de inventario.
- Totales de la compra.
- Usuario responsable.
- Información de lote y caducidad.

El modal permite desplazamiento vertical cuando el contenido supera la altura disponible.

El botón `Registrar recepción` solamente está disponible cuando la compra se encuentra en alguno de estos estados:

```text
CONFIRMED
PARTIALLY_RECEIVED
```

El botón permanece oculto cuando el estado es:

```text
DRAFT
RECEIVED
CANCELLED
```

---

# 11. Formulario de recepción

El formulario frontend de recepción muestra:

- Producto.
- Cantidad comprada.
- Cantidad recibida anteriormente.
- Cantidad pendiente.
- Cantidad que se recibirá en ese momento.
- Número de lote.
- Fecha de caducidad.
- Notas.

Las validaciones del frontend incluyen:

- Al menos un producto debe tener una cantidad recibida.
- La cantidad debe ser un número entero mayor que cero.
- La cantidad no puede superar la cantidad pendiente.
- La fecha de caducidad requiere un número de lote.
- Los valores opcionales vacíos no se envían al backend.

Las validaciones del backend siguen siendo la fuente de autoridad.

---

# 12. Permisos

## Implementación actual

Todos los usuarios autenticados con acceso a los endpoints de compras pueden registrar y consultar recepciones.

El aislamiento entre empresas se aplica mediante `companyId`.

## Implementación futura

El sistema RBAC deberá definir permisos explícitos, por ejemplo:

```text
purchases.read
purchases.receive
purchases.manage
inventory.read
```

Roles recomendados:

```text
ADMIN
PURCHASING_MANAGER
WAREHOUSE_MANAGER
WAREHOUSE_OPERATOR
```

---

# 13. Arquitectura

## Flujo del backend

```text
PurchaseReceiptsController
        ↓
PurchaseReceiptsService
        ↓
Transacción Prisma
        ↓
PurchaseReceipt
PurchaseReceiptItem
InventoryBatch
Product
InventoryMovement
Purchase
```

## Flujo del frontend

```text
PurchasesPage
    ↓
Modal de detalle de compra
    ↓
Modal de formulario de recepción
    ↓
POST /purchase-receipts
    ↓
Recargar compras
    ↓
Estado e inventario actualizados
```

Los controladores se mantienen ligeros.

Las reglas de negocio se implementan dentro de `PurchaseReceiptsService`.

El frontend coordina el flujo, pero no reemplaza las validaciones del backend.

---

# 14. Manejo de errores

Los errores de negocio esperados incluyen:

```text
Compra no encontrada
La compra debe confirmarse antes de recibir mercancía
La compra ya fue recibida completamente
No se puede recibir una compra cancelada
La partida no pertenece a la compra
La partida está repetida en la recepción
La cantidad recibida supera la cantidad pendiente
No se puede registrar una fecha de caducidad sin número de lote
La fecha de caducidad no puede ser anterior a la fecha de recepción
Recepción no encontrada
```

Los errores se devuelven mediante excepciones HTTP estándar de NestJS.

---

# 15. Pruebas

## Pruebas automatizadas del backend

Resultado actual del backend:

```text
Test Suites: 26 passed
Tests: 51 passed
```

La cobertura de Recepciones de Compra incluye:

- Creación desde el controlador.
- Listado desde el controlador.
- Consulta de detalle desde el controlador.
- Consulta del historial por compra desde el controlador.
- Partidas duplicadas en una recepción.
- Compra inexistente.
- Estados inválidos de compra.
- Cantidad mayor que la pendiente.
- Caducidad sin lote.
- Caducidad anterior a la recepción.
- Partida que no pertenece a la compra.
- Recepción parcial exitosa.
- Actualización de un lote existente.
- Recepción completa.
- Listado filtrado por empresa.
- Consulta de detalle de recepción.
- Recepción inexistente.
- Historial de una compra.
- Historial de una compra inexistente.

---

## Pruebas automatizadas del frontend

Resultado actual del frontend:

```text
Test Files: 7 passed
Tests: 47 passed
```

Las pruebas automatizadas específicas del formulario de recepción continúan pendientes.

---

## Control de calidad manual

El flujo completo fue validado manualmente.

Escenarios aprobados:

1. La creación de una compra no modifica el inventario.
2. La confirmación de una compra no modifica el inventario.
3. Una recepción parcial incrementa únicamente la cantidad recibida.
4. La recepción final incrementa la cantidad restante.
5. El estado de la compra cambia correctamente.
6. La información de lote y caducidad se muestra correctamente.
7. Los escenarios inválidos del formulario son rechazados.

El stock final coincidió con la cantidad total de mercancía recibida físicamente.

---

# 16. Seguridad

Controles de seguridad implementados:

- Autenticación mediante JWT.
- `companyId` obtenido de la solicitud autenticada.
- ID del usuario obtenido de la solicitud autenticada.
- Consultas de base de datos filtradas por empresa.
- Validación mediante DTO.
- Transacción de base de datos.
- Los datos de contraseña nunca se exponen en las consultas de recepciones.

Mejoras futuras:

- Permisos RBAC explícitos.
- Eventos de auditoría.
- Limitación de solicitudes.
- Autorización para reversión de recepciones.
- Controles de acceso específicos por almacén.

---

# 17. Consideraciones de rendimiento

Las consultas actuales utilizan `include` de Prisma para:

- Compra.
- Proveedor.
- Producto.
- Lote.
- Usuario responsable.

Mejoras futuras:

- Paginación del historial general de recepciones.
- Filtros por fecha.
- Filtros por proveedor.
- Filtros por estado de compra.
- Filtros por producto y lote.
- Límites de resultados.
- Revisión de índices de rendimiento.
- Evitar cargar objetos completos de lotes cuando solo se necesite información resumida.

---

# 18. Limitaciones conocidas

- No existe cancelación de recepciones.
- No existe reversión de recepciones.
- No existe flujo de devoluciones a proveedores.
- No existe inspección de calidad.
- No existe campo para cantidades dañadas.
- No existe soporte para números de serie.
- No existe soporte para ubicaciones de almacén.
- Las recepciones antiguas pueden no tener usuario responsable.
- Los listados de recepciones no están paginados.

---

# 19. Hoja de ruta

## Corto plazo

- Mejorar la retroalimentación de éxito después de crear una recepción.
- Agregar vista individual de detalle de recepción.
- Agregar un estado de carga específico para la creación de recepciones.
- Agregar paginación y filtros.

## Mediano plazo

- Devoluciones a proveedores.
- Correcciones de recepciones.
- Registro de mercancía dañada.
- Inspección de calidad.
- Selección de almacén.
- Escaneo de códigos de barras y códigos QR.

## Largo plazo

- Trazabilidad mediante números de serie.
- Recepción móvil en almacén.
- Conciliación de facturas de compra.
- Métricas de desempeño de proveedores.
- Eventos de dominio para actualizaciones de inventario.
- Registros avanzados de auditoría.

---

# 20. Definición de terminado

La primera versión del módulo se considera terminada porque:

- Los modelos de base de datos están implementados.
- La migración fue aplicada.
- Prisma Client fue generado.
- Los endpoints del backend están implementados.
- El aislamiento multiempresa está aplicado.
- Se permiten recepciones parciales.
- Se permiten recepciones completas.
- El inventario se actualiza únicamente con la recepción física.
- Se admiten lotes y fechas de caducidad.
- Se generan movimientos de inventario.
- Se almacena el usuario responsable.
- El flujo frontend está implementado.
- Los estados de error son administrados.
- El control de calidad manual fue aprobado.
- Las pruebas del backend fueron aprobadas.
- Las pruebas del frontend fueron aprobadas.
- El lint fue aprobado.
- Las compilaciones de producción fueron aprobadas.
- La documentación del módulo fue creada.

---

# 21. Principio final de negocio

Una orden de compra representa la intención de adquirir mercancía.

Una recepción de compra representa la mercancía recibida físicamente.

Únicamente la recepción física puede incrementar el inventario.