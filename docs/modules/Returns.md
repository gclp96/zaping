# Returns Module

## Estado

Completado.

Última actualización: 2026-08-18.

---

## 1. Objetivo

El módulo Returns administra devoluciones asociadas a ventas confirmadas.

Una devolución no modifica ni cancela la venta original.

Su objetivo es mantener trazabilidad completa sobre:

- venta origen;
- productos devueltos;
- cantidades;
- motivo;
- condición del producto;
- usuario responsable;
- fecha;
- reintegración o no al inventario;
- movimientos de inventario generados.

---

## 2. Principio principal

Una venta confirmada no puede cancelarse directamente.

```text
Sale CONFIRMED
      ↓
   Return
```

La devolución funciona como una operación independiente y trazable.

La venta original permanece:

```text
CONFIRMED
```

Esto permite conservar íntegramente el historial comercial y de inventario de la operación original.

---

## 3. Alcance inicial

La primera versión debe soportar:

- devoluciones totales;
- devoluciones parciales;
- múltiples devoluciones sobre una misma venta;
- uno o varios productos por devolución;
- motivo obligatorio;
- condición por producto;
- decisión explícita de reintegración a inventario;
- movimientos de inventario `IN` cuando corresponda;
- historial de devoluciones por venta;
- aislamiento multiempresa;
- protección contra devoluciones concurrentes que excedan lo vendido.

---

## 4. Estados

Una devolución tendrá inicialmente los estados:

```text
DRAFT
CONFIRMED
CANCELLED
```

Flujo:

```text
             ┌── cancel ──> CANCELLED
             │
DRAFT ───────┤
             │
             └── confirm ─> CONFIRMED
                                ↓
                       efectos de inventario
```

Reglas:

- `DRAFT` puede confirmarse.
- `DRAFT` puede cancelarse.
- `CONFIRMED` no puede cancelarse directamente.
- `CANCELLED` no puede volver a activarse.
- una futura reversión de una devolución confirmada deberá realizarse mediante una operación compensatoria trazable.

---

## 5. Reglas de creación

Solo puede crearse una devolución cuando la venta:

- existe;
- pertenece a la misma empresa;
- tiene estado `CONFIRMED`.

No podrán generarse devoluciones sobre ventas:

```text
DRAFT
CANCELLED
```

La creación de una devolución no deberá modificar inventario.

Toda devolución nueva deberá comenzar en:

```text
DRAFT
```

---

## 6. Cantidades

La cantidad devuelta de un producto nunca puede superar la cantidad disponible para devolución.

La cantidad disponible se calcula como:

```text
cantidad vendida
-
cantidad previamente devuelta y confirmada
=
cantidad todavía retornable
```

Ejemplo:

```text
Venta original:      10
Devolución 1:         3
Devolución 2:         2
------------------------
Disponible:           5
```

Una devolución puede ser parcial.

Una misma venta puede tener múltiples devoluciones mientras exista cantidad disponible.

Las devoluciones en estado:

```text
DRAFT
CANCELLED
```

no deben considerarse como cantidades definitivamente devueltas para el cálculo histórico.

Las cantidades ya incluidas en devoluciones `CONFIRMED` sí deberán descontarse de la cantidad disponible.

---

## 7. Items de devolución

Cada item deberá relacionarse con el item original de la venta.

Información mínima prevista:

```text
saleItemId
productId
quantity
condition
restock
notes
```

`productId` deberá derivarse o validarse contra el `SaleItem` original.

El backend no deberá confiar únicamente en el `productId` enviado por el frontend.

Esto evita devolver productos que no pertenecen a la venta original.

Cada item deberá tener:

- cantidad mayor o igual a 1;
- relación válida con un `SaleItem`;
- condición definida;
- decisión explícita de `restock`.

No deberá permitirse incluir el mismo `SaleItem` más de una vez dentro de la misma devolución.

---

## 8. Condición del producto

Cada item deberá registrar la condición del producto devuelto.

Estados iniciales propuestos:

```text
SELLABLE
DAMAGED
EXPIRED
OPENED
OTHER
```

### SELLABLE

Producto en condiciones de regresar al inventario disponible.

Puede utilizar:

```text
restock = true
```

si las demás reglas de trazabilidad lo permiten.

### DAMAGED

Producto dañado.

No deberá regresar al inventario disponible.

```text
restock = false
```

### EXPIRED

Producto caducado.

No deberá regresar al inventario disponible.

```text
restock = false
```

### OPENED

Producto abierto o con empaque comprometido.

La decisión dependerá de las reglas comerciales y sanitarias aplicables.

Por defecto deberá tratarse de forma conservadora.

### OTHER

Cualquier condición no cubierta por los estados anteriores.

Debe complementarse mediante notas.

---

## 9. Reintegración a inventario

Cada item tendrá una decisión explícita:

```text
restock = true
restock = false
```

### restock = true

Al confirmar la devolución:

```text
Product.stock += quantity
```

y debe generarse:

```text
InventoryMovement
movementType = IN
referenceType = RETURN
referenceId = return.id
```

El movimiento deberá registrar:

- empresa;
- producto;
- cantidad;
- costo correspondiente;
- saldo posterior;
- tipo de referencia;
- identificador de la devolución;
- notas de trazabilidad.

### restock = false

La devolución queda registrada comercialmente y para trazabilidad, pero:

```text
Product.stock
```

no cambia.

No se genera movimiento `IN` de inventario disponible.

---

## 10. Regla de consistencia entre condición y restock

La condición no decidirá automáticamente el inventario en todos los escenarios.

La decisión principal será explícita mediante:

```text
restock
```

Sin embargo, el backend deberá rechazar combinaciones claramente inválidas.

Ejemplos:

```text
EXPIRED + restock=true
→ inválido
```

```text
DAMAGED + restock=true
→ inválido
```

Para:

```text
SELLABLE
```

podrá permitirse:

```text
restock=true
```

si la trazabilidad del producto lo permite.

Para:

```text
OPENED
OTHER
```

la regla podrá evolucionar posteriormente según políticas configurables.

---

## 11. Efectos de una devolución DRAFT

Crear una devolución:

```text
Return DRAFT
```

no modifica inventario.

No genera movimientos.

No modifica la venta original.

Esto permite revisar la devolución antes de aplicar efectos permanentes.

---

## 12. Confirmación

Solo una devolución `DRAFT` puede confirmarse.

La transición:

```text
DRAFT -> CONFIRMED
```

debe realizarse de forma atómica.

La confirmación deberá:

1. verificar que la devolución continúa en `DRAFT`;
2. verificar que la venta original existe;
3. verificar que la venta pertenece a la misma empresa;
4. verificar que la venta continúa `CONFIRMED`;
5. recalcular cantidades previamente devueltas;
6. comprobar que ninguna cantidad supera lo disponible;
7. validar los `SaleItem`;
8. validar los productos;
9. validar condición y `restock`;
10. incrementar stock donde `restock = true`;
11. crear movimientos `InventoryMovement IN`;
12. registrar la fecha de confirmación;
13. cambiar la devolución a `CONFIRMED`.

Toda la operación deberá ejecutarse dentro de una transacción.

Si cualquier operación falla:

```text
rollback completo
```

No deberá existir un escenario donde:

- la devolución quede confirmada pero el inventario no se actualice;
- el inventario aumente pero la devolución permanezca `DRAFT`;
- solo una parte de los items sea aplicada.

---

## 13. Concurrencia

Dos devoluciones simultáneas no deben poder devolver más producto del originalmente vendido.

Ejemplo:

```text
Disponible para devolver: 5

Solicitud A: 4
Solicitud B: 4
```

No pueden confirmarse ambas.

El backend deberá recalcular las cantidades confirmadas durante la operación de confirmación y proteger la transición contra concurrencia.

También deberá impedir:

- doble confirmación de la misma devolución;
- confirmación y cancelación simultáneas;
- sobredevolución provocada por dos devoluciones concurrentes.

La transición crítica deberá utilizar una condición equivalente a:

```text
WHERE
  return.id = id
  companyId = company
  status = DRAFT
```

Solo una operación podrá cambiar exitosamente el estado `DRAFT`.

---

## 14. Cancelación

Solo una devolución `DRAFT` puede cancelarse:

```text
DRAFT -> CANCELLED
```

Cancelar una devolución borrador:

- no modifica inventario;
- no crea movimientos;
- no modifica la venta original.

La transición deberá ser condicional para evitar conflictos concurrentes entre confirmar y cancelar.

Una devolución:

```text
CONFIRMED
```

no podrá cancelarse directamente.

---

## 15. Motivo

Toda devolución deberá registrar un motivo obligatorio.

Ejemplos:

```text
Producto incorrecto
Producto dañado
Producto defectuoso
Caducidad
Error de surtido
Rechazo del cliente
Otro
```

La primera versión puede almacenar el motivo como texto.

Una versión futura podrá utilizar un catálogo configurable de motivos de devolución.

---

## 16. Trazabilidad

Cada devolución deberá permitir identificar:

- empresa;
- venta origen;
- usuario que registró la devolución;
- fecha de creación;
- fecha de confirmación;
- motivo;
- productos;
- cantidades;
- condición;
- decisión de reintegración;
- movimientos de inventario relacionados.

La operación deberá conservarse como entidad independiente.

No deberá reemplazar ni sobrescribir la información histórica de la venta original.

---

## 17. Lotes y caducidad

La trazabilidad por lote es crítica para productos médicos.

Una devolución no deberá asociarse automáticamente a un lote únicamente a partir del producto o de un número de lote capturado manualmente.

Para reintegrar una devolución a inventario por lote, el sistema deberá poder comprobar qué lote o lotes participaron realmente en la venta original.

### Regla inicial

Para productos que no requieren trazabilidad por lote:

```text
restock = true
→ Product.stock += quantity
→ InventoryMovement IN
```

Para productos sujetos a trazabilidad por lote:

```text
restock = true
→ requiere identificación verificable del lote vendido
```

Si no existe esa trazabilidad, la devolución podrá registrarse comercialmente, pero no deberá reintegrarse automáticamente al inventario disponible.

### Arquitectura objetivo

Las ventas deberán registrar la distribución de cantidades por lote.

Modelo conceptual:

```text
SaleItem
   │
   └── SaleItemBatchAllocation
          │
          ├── InventoryBatch
          └── quantity
```

Una devolución podrá posteriormente referenciar la asignación correspondiente:

```text
ReturnItem
   │
   └── SaleItemBatchAllocation
```

Esto permitirá validar:

- que el lote perteneció a la venta original;
- cuánto se vendió de cada lote;
- cuánto fue devuelto previamente;
- cuánto continúa disponible para devolución;
- número de lote;
- fecha de caducidad;
- reintegración correcta al inventario.

### Restricción

No se permitirá aumentar inventario de un lote cuando el backend no pueda demostrar la relación entre ese lote y la venta original.

La trazabilidad nunca deberá reconstruirse mediante suposiciones.

---

## 18. Modelo conceptual inicial

```text
Company
   │
   └── Sale
        │
        ├── SaleItem
        │
        └── Return
             │
             └── ReturnItem
                  │
                  ├── SaleItem
                  └── Product
```

Relaciones previstas:

```text
Sale 1 ─── N Return

Return 1 ─── N ReturnItem

SaleItem 1 ─── N ReturnItem

Product 1 ─── N ReturnItem
```

Todas las relaciones estarán aisladas mediante `companyId`.

---

## 19. Modelo conceptual Return

Campos previstos:

```text
id
companyId
saleId
folio
reason
status
createdBy
confirmedAt
createdAt
updatedAt
```

### id

Identificador UUID.

### companyId

Empresa propietaria de la devolución.

### saleId

Venta confirmada que origina la devolución.

### folio

Identificador comercial de la devolución.

Ejemplo conceptual:

```text
DEV-000001
```

La estrategia definitiva de generación de folios se definirá durante el diseño técnico.

### reason

Motivo obligatorio de la devolución.

### status

Estado de la devolución:

```text
DRAFT
CONFIRMED
CANCELLED
```

### createdBy

Usuario responsable de registrar la devolución.

### confirmedAt

Fecha y hora en la que la devolución fue confirmada.

Debe permanecer vacía mientras la devolución esté en `DRAFT` o `CANCELLED`.

### createdAt

Fecha de creación.

### updatedAt

Última actualización.

---

## 20. Modelo conceptual ReturnItem

Campos previstos:

```text
id
companyId
returnId
saleItemId
productId
quantity
condition
restock
notes
createdAt
updatedAt
```

### returnId

Devolución propietaria del item.

### saleItemId

Item original de la venta.

Es la referencia principal utilizada para validar cantidades vendidas y previamente devueltas.

### productId

Producto relacionado.

Debe coincidir con el producto del `SaleItem`.

### quantity

Cantidad devuelta.

Debe ser un entero mayor o igual a uno.

### condition

Condición física/comercial del producto devuelto.

### restock

Indica si el producto regresa al inventario disponible.

### notes

Observaciones opcionales del item.

---

## 21. Inventario

Resumen de efectos:

```text
Crear Return DRAFT
→ sin movimiento

Cancelar Return DRAFT
→ sin movimiento

Confirmar Return
  ├── restock=true
  │      ↓
  │   Product.stock aumenta
  │      ↓
  │   InventoryMovement IN
  │
  └── restock=false
         ↓
      sin cambio de stock
```

Cada movimiento generado deberá poder rastrearse hasta la devolución correspondiente.

---

## 22. Seguridad multiempresa

Todas las operaciones deberán validar:

```text
companyId
```

La devolución, venta, productos e items relacionados deberán pertenecer a la misma empresa.

Nunca se confiará únicamente en IDs proporcionados por el frontend.

Las consultas deberán estar acotadas por:

```text
companyId
```

cuando corresponda.

Ejemplos:

```text
Return.companyId
Sale.companyId
SaleItem → Sale.companyId
Product.companyId
InventoryBatch.companyId
```

Una empresa nunca deberá poder consultar, crear, confirmar o cancelar devoluciones pertenecientes a otro tenant.

---

## 23. Fuera de alcance inicial

RET-001 no implementará todavía:

- notas de crédito;
- reembolsos financieros;
- integración contable;
- métodos de devolución de dinero;
- devolución a proveedor;
- reemplazos automáticos;
- logística de recolección;
- aprobación multinivel;
- reintegración avanzada por lote;
- reglas configurables por motivo;
- autorización comercial multinivel.

Estas capacidades podrán añadirse posteriormente.

---

## 24. Criterios de aceptación de RET-001

El diseño funcional estará terminado cuando estén definidas:

- reglas de elegibilidad;
- estados;
- transiciones;
- devoluciones parciales;
- cantidades disponibles;
- múltiples devoluciones;
- condiciones;
- regla de `restock`;
- efectos sobre inventario;
- concurrencia;
- trazabilidad;
- seguridad multiempresa;
- modelo conceptual;
- tratamiento inicial de lotes y caducidad;
- alcance inicial;
- fuera de alcance;
- dependencia arquitectónica con trazabilidad de ventas por lote.

---

## 25. Dependencia arquitectónica

La reintegración completa de devoluciones de productos trazables por lote depende de que Sales registre las asignaciones de inventario utilizadas durante la venta.

Esta capacidad deberá implementarse antes de habilitar:

```text
restock = true
```

para productos sujetos a lote/caducidad.

El diseño previsto es:

```text
SaleItem
      ↓
SaleItemBatchAllocation
      ↓
InventoryBatch
```

Esto permitirá conocer exactamente de qué lote salió cada cantidad vendida.

Posteriormente:

```text
ReturnItem
      ↓
SaleItemBatchAllocation
      ↓
InventoryBatch
```

permitirá reintegrar una devolución únicamente al lote correspondiente.

Esta dependencia no impide diseñar ni implementar el flujo general de Returns.

Sin embargo, temporalmente limita la reintegración automática de productos trazables por lote.

El sistema deberá priorizar integridad de trazabilidad sobre automatización.

---

## 26. Estado final

RET-001 se considera completado.

El diseño funcional del módulo de Devoluciones define:

- reglas de elegibilidad;
- estados y transiciones;
- devoluciones totales y parciales;
- múltiples devoluciones sobre una venta;
- control de cantidades disponibles;
- condiciones del producto;
- decisión explícita de reintegración;
- efectos sobre inventario;
- movimientos `InventoryMovement IN`;
- protección contra concurrencia;
- cancelación segura;
- trazabilidad;
- seguridad multiempresa;
- modelo conceptual de `Return`;
- modelo conceptual de `ReturnItem`;
- tratamiento de productos con lote y caducidad;
- dependencia futura de `SaleItemBatchAllocation`;
- alcance inicial y capacidades fuera de alcance.

La implementación técnica comenzará en:

```text
RET-002
Diseño del modelo Prisma de devoluciones
```

antes de generar cualquier migración o implementar lógica de backend.