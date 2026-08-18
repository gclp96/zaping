# RET-002: Diseño del modelo Prisma de devoluciones

**Versión:** 1.0.0  
**Estado:** Completado
**Sprint:** Sprint 09  
**Prioridad:** Alta  
**Responsable:** Zaping Team  
**Fecha de inicio:** 2026-08-18  

---

## 1. Objetivo

Definir el modelo de datos Prisma necesario para implementar el módulo de Devoluciones de Zaping ERP.

El diseño debe soportar:

- devoluciones asociadas a ventas confirmadas;
- devoluciones totales;
- devoluciones parciales;
- múltiples devoluciones sobre una misma venta;
- control de cantidades previamente devueltas;
- estados de devolución;
- condición del producto;
- reintegración opcional a inventario;
- trazabilidad de usuarios;
- concurrencia;
- seguridad multiempresa;
- futura trazabilidad por lote.

RET-002 define únicamente el modelo de datos.

La migración y la lógica de backend se realizarán después de aprobar este diseño.

---

## 2. Dependencias existentes

El diseño se integra con los modelos actuales:

```text
Company
User
Product
Sale
SaleItem
InventoryMovement
InventoryBatch
```

El módulo de ventas ya maneja:

```text
Sale
├── DRAFT
├── CONFIRMED
└── CANCELLED
```

Una devolución solo podrá originarse desde:

```text
Sale CONFIRMED
```

---

## 3. Decisión de nomenclatura

El modelo Prisma principal se llamará:

```text
SaleReturn
```

en lugar de:

```text
Return
```

Motivos:

- evita un nombre excesivamente genérico;
- expresa explícitamente que se trata de una devolución de venta;
- reduce ambigüedad en services, DTOs y Prisma Client;
- permite diferenciar futuras devoluciones a proveedores.

Funcionalmente el módulo continuará llamándose:

```text
Returns
Devoluciones
```

---

## 4. Estados de devolución

Se creará un enum independiente:

```prisma
enum ReturnStatus {
  DRAFT
  CONFIRMED
  CANCELLED
}
```

No se reutilizará:

```prisma
DocumentStatus
```

aunque actualmente contenga los mismos estados.

La razón es que Returns tiene un ciclo de vida independiente y podrá evolucionar posteriormente sin afectar Quotes o Sales.

---

## 5. Condición del producto

Se creará:

```prisma
enum ReturnItemCondition {
  SELLABLE
  DAMAGED
  EXPIRED
  OPENED
  OTHER
}
```

Significado:

```text
SELLABLE
→ producto potencialmente reintegrable

DAMAGED
→ producto dañado

EXPIRED
→ producto caducado

OPENED
→ empaque abierto o comprometido

OTHER
→ condición distinta que debe explicarse mediante notas
```

La compatibilidad entre `condition` y `restock` será validada por el backend.

---

## 6. Modelo SaleReturn

Diseño propuesto:

```prisma
model SaleReturn {
  id        String @id @default(uuid())
  companyId String
  saleId    String

  folio  String
  reason String

  status ReturnStatus @default(DRAFT)

  createdById   String
  confirmedById String?
  cancelledById String?

  confirmedAt DateTime?
  cancelledAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(
    fields: [companyId],
    references: [id]
  )

  sale Sale @relation(
    fields: [saleId],
    references: [id]
  )

  createdBy User @relation(
    "SaleReturnCreatedBy",
    fields: [createdById],
    references: [id]
  )

  confirmedBy User? @relation(
    "SaleReturnConfirmedBy",
    fields: [confirmedById],
    references: [id]
  )

  cancelledBy User? @relation(
    "SaleReturnCancelledBy",
    fields: [cancelledById],
    references: [id]
  )

  items ReturnItem[]

  @@unique([companyId, folio])

  @@index([companyId, saleId])
  @@index([companyId, status])
  @@index([companyId, createdAt])
  @@index([createdById])
}
```

---

## 7. Campos de SaleReturn

### id

UUID de la devolución.

```prisma
id String @id @default(uuid())
```

---

### companyId

Tenant propietario de la devolución.

Toda operación deberá estar aislada por empresa.

---

### saleId

Venta que origina la devolución.

La venta deberá:

- existir;
- pertenecer a `companyId`;
- estar `CONFIRMED`.

Estas reglas se validarán en el backend.

---

### folio

Identificador comercial de la devolución.

Ejemplo:

```text
DEV-000001
```

Debe ser único dentro de cada empresa:

```prisma
@@unique([companyId, folio])
```

La estrategia definitiva de generación de folios se implementará posteriormente.

No se utilizará el folio como clave primaria.

---

### reason

Motivo general obligatorio de la devolución.

Primera versión:

```prisma
reason String
```

En versiones posteriores podrá convertirse en una relación con un catálogo configurable.

---

### status

Estado inicial:

```text
DRAFT
```

Transiciones permitidas:

```text
DRAFT → CONFIRMED
DRAFT → CANCELLED
```

No se permitirá:

```text
CONFIRMED → CANCELLED
CANCELLED → DRAFT
CANCELLED → CONFIRMED
```

---

## 8. Auditoría de usuarios

La devolución registrará tres responsabilidades diferentes.

### createdById

Usuario que registra inicialmente la devolución.

Será obligatorio:

```prisma
createdById String
```

---

### confirmedById

Usuario que confirma la devolución.

Será opcional hasta que ocurra la confirmación.

```prisma
confirmedById String?
```

---

### cancelledById

Usuario que cancela una devolución borrador.

```prisma
cancelledById String?
```

---

## 9. Fechas de transición

Además de `createdAt` y `updatedAt`, se registrarán:

```prisma
confirmedAt DateTime?
cancelledAt DateTime?
```

Reglas:

```text
DRAFT
confirmedAt = null
cancelledAt = null
```

```text
CONFIRMED
confirmedAt != null
cancelledAt = null
```

```text
CANCELLED
confirmedAt = null
cancelledAt != null
```

Estas reglas deberán ser controladas por el service.

---

## 10. Modelo ReturnItem

Diseño propuesto:

```prisma
model ReturnItem {
  id String @id @default(uuid())

  companyId String
  returnId  String

  saleItemId String
  productId  String

  quantity Int

  condition ReturnItemCondition
  restock   Boolean @default(false)

  notes String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(
    fields: [companyId],
    references: [id]
  )

  saleReturn SaleReturn @relation(
    fields: [returnId],
    references: [id]
  )

  saleItem SaleItem @relation(
    fields: [saleItemId],
    references: [id]
  )

  product Product @relation(
    fields: [productId],
    references: [id]
  )

  @@unique([returnId, saleItemId])

  @@index([companyId, returnId])
  @@index([companyId, saleItemId])
  @@index([companyId, productId])
  @@index([condition])
}
```

---

## 11. Relación con SaleItem

`ReturnItem` se relacionará directamente con el `SaleItem` original.

```text
SaleItem
   ↓
ReturnItem
```

Esto permite conocer:

- cantidad originalmente vendida;
- precio registrado en la venta;
- producto original;
- devoluciones asociadas.

La relación principal para validar cantidades será:

```text
saleItemId
```

---

## 12. productId en ReturnItem

Aunque `productId` podría obtenerse mediante:

```text
ReturnItem
→ SaleItem
→ Product
```

se conservará explícitamente en `ReturnItem`.

Motivos:

- consultas más simples;
- integración con inventario;
- trazabilidad;
- índices directos por producto;
- futura integración con lotes.

Sin embargo, el backend deberá comprobar siempre:

```text
ReturnItem.productId
==
SaleItem.productId
```

Nunca se confiará únicamente en el `productId` recibido desde el frontend.

---

## 13. Cantidad

```prisma
quantity Int
```

La cantidad deberá ser:

```text
entero
>= 1
```

La base de datos almacena el valor.

El DTO y el Service aplicarán la validación funcional.

---

## 14. Evitar items duplicados

Dentro de una misma devolución no se permitirá registrar dos veces el mismo `SaleItem`.

Se utilizará:

```prisma
@@unique([returnId, saleItemId])
```

Ejemplo inválido:

```text
Return DEV-001

SaleItem A → 2 unidades
SaleItem A → 1 unidad
```

Deberá capturarse como:

```text
SaleItem A → 3 unidades
```

Una misma partida sí podrá aparecer en devoluciones distintas.

---

## 15. Control de cantidades previamente devueltas

Se agregará a `SaleItem`:

```prisma
returnedQuantity Int @default(0)
```

El modelo quedará conceptualmente:

```text
SaleItem
├── quantity
└── returnedQuantity
```

La cantidad disponible para devolución será:

```text
quantity - returnedQuantity
```

Ejemplo:

```text
quantity         = 10
returnedQuantity = 4

availableToReturn = 6
```

---

## 16. Motivo de returnedQuantity

`returnedQuantity` permite:

- consultar rápidamente cuánto queda disponible;
- evitar recalcular todas las devoluciones históricas en cada operación;
- proteger devoluciones concurrentes;
- simplificar consultas frontend;
- mantener una restricción transaccional sobre la cantidad vendida.

Este campo será mantenido exclusivamente por el backend.

El frontend nunca podrá modificarlo directamente.

---

## 17. Protección contra sobredevolución concurrente

Supongamos:

```text
SaleItem.quantity = 10
SaleItem.returnedQuantity = 0
```

Dos devoluciones intentan confirmar simultáneamente:

```text
Return A = 7
Return B = 7
```

Ambas no pueden confirmarse.

Dentro de la transacción se utilizará conceptualmente una actualización condicional:

```text
WHERE
  SaleItem.id = saleItemId
  returnedQuantity <= quantityVendida - cantidadADevolver
```

y:

```text
returnedQuantity += cantidadADevolver
```

Ejemplo para devolver 7 de 10:

```text
WHERE returnedQuantity <= 3
```

La primera operación:

```text
0 <= 3
→ incrementa a 7
```

La segunda operación:

```text
7 <= 3
→ falso
→ count = 0
→ rechazar
```

Esto evita que dos devoluciones concurrentes superen la cantidad vendida.

---

## 18. Fuente de verdad de cantidades devueltas

La fuente operativa será:

```text
SaleItem.returnedQuantity
```

Los `ReturnItem` confirmados constituyen el historial auditable.

Ambos valores deberán permanecer consistentes.

Conceptualmente:

```text
SaleItem.returnedQuantity
==
SUM(
  ReturnItem.quantity
  WHERE SaleReturn.status = CONFIRMED
)
```

Las pruebas de integración deberán verificar esta invariancia.

---

## 19. Cambios en SaleItem

Se propone modificar:

```prisma
model SaleItem {
  ...
  returnedQuantity Int @default(0)

  returnItems ReturnItem[]
}
```

`returnedQuantity` comienza en:

```text
0
```

para todas las ventas actuales.

Por lo tanto, la migración futura podrá aplicarse sin perder compatibilidad con registros existentes.

---

## 20. Cambios en Sale

Agregar:

```prisma
returns SaleReturn[]
```

Relación:

```text
Sale 1 ─── N SaleReturn
```

Una venta confirmada puede tener múltiples devoluciones.

---

## 21. Cambios en Product

Agregar:

```prisma
returnItems ReturnItem[]
```

Esto habilitará consultas como:

```text
devoluciones por producto
cantidades devueltas
motivos
condiciones
```

---

## 22. Cambios en Company

Agregar:

```prisma
saleReturns SaleReturn[]
returnItems ReturnItem[]
```

Esto permite las relaciones inversas necesarias para:

```text
SaleReturn.company
ReturnItem.company
```

---

## 23. Cambios en User

Agregar:

```prisma
createdSaleReturns SaleReturn[]
  @relation("SaleReturnCreatedBy")

confirmedSaleReturns SaleReturn[]
  @relation("SaleReturnConfirmedBy")

cancelledSaleReturns SaleReturn[]
  @relation("SaleReturnCancelledBy")
```

Esto permite diferenciar:

```text
quién creó
quién confirmó
quién canceló
```

---

## 24. Seguridad multiempresa

Los modelos almacenarán explícitamente:

```text
companyId
```

tanto en:

```text
SaleReturn
ReturnItem
```

El backend deberá validar que:

```text
SaleReturn.companyId
==
Sale.companyId
```

y:

```text
ReturnItem.companyId
==
SaleReturn.companyId
==
Sale.companyId
==
Product.companyId
```

El modelo actual `SaleItem` no contiene `companyId`.

Por lo tanto, la pertenencia multiempresa de un `SaleItem` deberá verificarse inicialmente mediante:

```text
SaleItem
→ Sale
→ companyId
```

No se agregará `companyId` a `SaleItem` dentro de RET-002 únicamente para resolver Returns, evitando ampliar innecesariamente el alcance de la migración.

Esta decisión podrá reevaluarse dentro de un hardening global de entidades hijas multi-tenant.

---

## 25. Índices

### SaleReturn

```prisma
@@unique([companyId, folio])

@@index([companyId, saleId])
@@index([companyId, status])
@@index([companyId, createdAt])
@@index([createdById])
```

Casos optimizados:

```text
devoluciones de una venta
devoluciones por empresa
devoluciones por estado
historial cronológico
devoluciones registradas por usuario
```

---

### ReturnItem

```prisma
@@unique([returnId, saleItemId])

@@index([companyId, returnId])
@@index([companyId, saleItemId])
@@index([companyId, productId])
@@index([condition])
```

Casos optimizados:

```text
items de devolución
historial por SaleItem
historial por producto
análisis por condición
```

---

## 26. Restock

`ReturnItem` incluirá:

```prisma
restock Boolean @default(false)
```

El default será:

```text
false
```

por seguridad.

Esto evita incrementar inventario accidentalmente cuando no se tomó una decisión explícita.

---

## 27. Relación condition + restock

Prisma almacenará ambos campos independientemente.

La consistencia será responsabilidad del Service.

Ejemplos que deberán rechazarse:

```text
EXPIRED + restock=true
DAMAGED + restock=true
```

Ejemplo normalmente válido:

```text
SELLABLE + restock=true
```

No se utilizará lógica automática dentro del modelo Prisma para inferir `restock`.

---

## 28. Efectos de inventario

Los modelos `SaleReturn` y `ReturnItem` no modificarán inventario automáticamente.

La lógica deberá ejecutarse al confirmar la devolución.

Cuando:

```text
restock = true
```

el backend deberá:

```text
Product.stock += quantity
```

y crear:

```text
InventoryMovement
movementType = IN
referenceType = RETURN
referenceId = SaleReturn.id
```

Cuando:

```text
restock = false
```

no habrá modificación de inventario disponible.

---

## 29. Costo del movimiento de devolución

El `InventoryMovement IN` no deberá utilizar ciegamente:

```text
Product.cost actual
```

cuando exista información suficiente para recuperar el costo del movimiento original de venta.

La estrategia objetivo será restaurar el costo relacionado con la salida original.

En la primera implementación se deberá revisar:

```text
InventoryMovement
referenceType = SALE
referenceId = saleId
productId = productId
```

para determinar el costo utilizado en la venta.

La lógica definitiva será definida durante la implementación del Service.

---

## 30. Lotes y InventoryBatch

RET-002 no agregará una relación directa:

```text
ReturnItem → InventoryBatch
```

en esta primera versión.

Razón:

el sistema actual conoce los lotes recibidos, pero `SaleItem` todavía no registra qué lote fue utilizado durante la venta.

Crear una relación directa desde ReturnItem permitiría afirmar una trazabilidad que el sistema actualmente no puede demostrar.

---

## 31. Arquitectura futura por lote

La arquitectura objetivo será:

```text
InventoryBatch
      ↓
SaleItemBatchAllocation
      ↓
SaleItem
      ↓
ReturnItem
```

Modelo conceptual futuro:

```prisma
model SaleItemBatchAllocation {
  id String @id @default(uuid())

  saleItemId String
  batchId    String
  quantity   Int

  saleItem SaleItem
  batch    InventoryBatch
}
```

La versión definitiva se diseñará en una tarea independiente.

---

## 32. Productos que requieren lote

El modelo actual `Product` no contiene una propiedad explícita que permita distinguir:

```text
producto sin lote
producto con lote obligatorio
producto serializado
```

No deberá inferirse esta regla basándose únicamente en la existencia de registros en `InventoryBatch`.

La arquitectura futura deberá considerar un campo equivalente a:

```prisma
enum InventoryTrackingMode {
  NONE
  LOT
  SERIAL
}
```

y:

```prisma
trackingMode InventoryTrackingMode @default(NONE)
```

en `Product`.

Esta mejora se tratará como una evolución independiente del módulo de inventario.

---

## 33. Restricción temporal de restock por lote

Hasta implementar trazabilidad de salida por lote:

```text
producto sujeto a lote
+
restock = true
```

no deberá habilitarse cuando el backend no pueda demostrar qué lote participó en la venta.

La devolución comercial podrá registrarse.

La reintegración automática al inventario por lote deberá permanecer bloqueada.

---

## 34. Eliminaciones

Las devoluciones forman parte del historial comercial y de inventario.

No deberán eliminarse físicamente después de haber sido confirmadas.

La primera versión utilizará estados:

```text
DRAFT
CONFIRMED
CANCELLED
```

en lugar de borrar registros para representar cambios de ciclo de vida.

No se diseñará `DELETE` como operación normal del módulo.

---

## 35. Folios

La base de datos garantizará:

```prisma
@@unique([companyId, folio])
```

La generación inicial deberá producir un folio único por empresa.

La estrategia definitiva deberá evitar depender exclusivamente de:

```text
Date.now()
```

como garantía de unicidad.

La restricción de base de datos será la última línea de defensa ante colisiones.

---

## 36. Datos financieros

RET-002 no agregará:

```text
refundAmount
subtotal
iva
total
creditNoteId
paymentRefundId
```

Las devoluciones financieras, reembolsos y notas de crédito permanecen fuera del alcance de la primera versión.

El módulo inicial representa:

```text
devolución comercial
+
devolución física
+
trazabilidad de inventario
```

---

## 37. Modelo completo propuesto

```prisma
enum ReturnStatus {
  DRAFT
  CONFIRMED
  CANCELLED
}

enum ReturnItemCondition {
  SELLABLE
  DAMAGED
  EXPIRED
  OPENED
  OTHER
}

model SaleReturn {
  id        String @id @default(uuid())
  companyId String
  saleId    String

  folio  String
  reason String

  status ReturnStatus @default(DRAFT)

  createdById   String
  confirmedById String?
  cancelledById String?

  confirmedAt DateTime?
  cancelledAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(
    fields: [companyId],
    references: [id]
  )

  sale Sale @relation(
    fields: [saleId],
    references: [id]
  )

  createdBy User @relation(
    "SaleReturnCreatedBy",
    fields: [createdById],
    references: [id]
  )

  confirmedBy User? @relation(
    "SaleReturnConfirmedBy",
    fields: [confirmedById],
    references: [id]
  )

  cancelledBy User? @relation(
    "SaleReturnCancelledBy",
    fields: [cancelledById],
    references: [id]
  )

  items ReturnItem[]

  @@unique([companyId, folio])

  @@index([companyId, saleId])
  @@index([companyId, status])
  @@index([companyId, createdAt])
  @@index([createdById])
}

model ReturnItem {
  id String @id @default(uuid())

  companyId String
  returnId  String

  saleItemId String
  productId  String

  quantity Int

  condition ReturnItemCondition
  restock   Boolean @default(false)

  notes String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(
    fields: [companyId],
    references: [id]
  )

  saleReturn SaleReturn @relation(
    fields: [returnId],
    references: [id]
  )

  saleItem SaleItem @relation(
    fields: [saleItemId],
    references: [id]
  )

  product Product @relation(
    fields: [productId],
    references: [id]
  )

  @@unique([returnId, saleItemId])

  @@index([companyId, returnId])
  @@index([companyId, saleItemId])
  @@index([companyId, productId])
  @@index([condition])
}
```

---

## 38. Cambios previstos en modelos existentes

### Company

Agregar:

```prisma
saleReturns SaleReturn[]
returnItems ReturnItem[]
```

### User

Agregar:

```prisma
createdSaleReturns SaleReturn[]
  @relation("SaleReturnCreatedBy")

confirmedSaleReturns SaleReturn[]
  @relation("SaleReturnConfirmedBy")

cancelledSaleReturns SaleReturn[]
  @relation("SaleReturnCancelledBy")
```

### Sale

Agregar:

```prisma
returns SaleReturn[]
```

### SaleItem

Agregar:

```prisma
returnedQuantity Int @default(0)
returnItems      ReturnItem[]
```

### Product

Agregar:

```prisma
returnItems ReturnItem[]
```

---

## 39. Reglas que no serán responsabilidad de Prisma

El modelo garantiza estructura y relaciones.

El Service deberá validar:

- Sale `CONFIRMED`;
- pertenencia multiempresa;
- usuario perteneciente a la empresa;
- `SaleItem` perteneciente a la venta;
- `Product` coincidente con `SaleItem.productId`;
- cantidad entera positiva;
- cantidad disponible;
- combinaciones `condition/restock`;
- restricciones por lote;
- transiciones de estado;
- concurrencia;
- movimientos de inventario;
- fechas de confirmación/cancelación.

---

## 40. Estrategia de implementación posterior

Una vez aprobado RET-002, la implementación deberá seguir este orden:

```text
1. modificar schema.prisma
2. prisma format
3. prisma validate
4. revisar diff del schema
5. generar migración
6. revisar SQL generado
7. aplicar migración
8. prisma generate
9. npm run build
10. implementar DTOs
11. implementar Service
12. implementar Controller
13. pruebas unitarias
14. pruebas de concurrencia
15. pruebas manuales
```

No se generará una migración antes de validar el diseño.

---

## 41. Riesgos identificados

### Sobredevolución concurrente

Mitigación:

```text
SaleItem.returnedQuantity
+
actualización condicional
+
transacción
```

### Reintegración incorrecta de lote

Mitigación:

```text
bloquear restock por lote
hasta existir SaleItemBatchAllocation
```

### Cruce entre empresas

Mitigación:

```text
companyId
+
validaciones explícitas
+
consultas multi-tenant
```

### Doble confirmación

Mitigación:

```text
DRAFT → CONFIRMED
mediante actualización condicional
```

### Confirmación/cancelación simultánea

Mitigación:

```text
ambas operaciones compiten por status = DRAFT
```

---

## 42. Criterios de aceptación de RET-002

RET-002 estará completado cuando:

- exista un diseño aprobado para `SaleReturn`;
- exista un diseño aprobado para `ReturnItem`;
- estén definidos `ReturnStatus` y `ReturnItemCondition`;
- estén definidas relaciones con Company, User, Sale, SaleItem y Product;
- esté definida la estrategia de `returnedQuantity`;
- esté resuelta la protección contra sobredevolución concurrente;
- estén definidos índices y restricciones;
- esté documentada la estrategia multiempresa;
- esté documentado el tratamiento temporal de lotes;
- esté documentada la dependencia futura de `SaleItemBatchAllocation`;
- se haya revisado el impacto sobre modelos existentes;
- no exista todavía una migración sin revisión.

---

## 43. ## Estado final

RET-002 se considera completado.

El diseño Prisma de Devoluciones queda aprobado con:

- `SaleReturn`;
- `SaleReturnItem`;
- `ReturnStatus`;
- `ReturnItemCondition`;
- trazabilidad de creación, confirmación y cancelación;
- relaciones protegidas con Sale y SaleItem;
- aislamiento multiempresa;
- `returnedQuantity` para control operacional;
- protección contra sobredevolución concurrente;
- restricción CHECK para el rango de `returnedQuantity`;
- `restock=false` por defecto;
- índices y restricciones;
- política de eliminación restrictiva;
- tratamiento temporal de productos con lote;
- dependencia futura de `SaleItemBatchAllocation`.

El siguiente paso será implementar este diseño en `schema.prisma` y revisar la migración antes de aplicarla.