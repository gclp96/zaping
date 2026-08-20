# ADR-011 — Separación entre Sales Order y Delivery

**Estado:** ACCEPTED
**Estado de implementación:** PLANNED
**Fecha:** 2026-08-19
**Responsable:** Zaping Architecture Team
**Reemplaza:** ADR-010 — Conversión Directa Quote → Sale

---

# 1. Contexto

El modelo inicial de Zaping simplificaba el proceso comercial mediante:

```text
Quote
↓
Sale
↓
Inventory OUT
```

Este modelo resulta insuficiente para operaciones donde:

* la venta se confirma antes de entregar;
* existen entregas parciales;
* el producto se envía posteriormente;
* la factura no coincide temporalmente con la entrega;
* una operación Healthcare requiere material temporalmente fuera del almacén.

Se requiere separar hechos comerciales de hechos físicos.

---

# 2. Problema

Una venta contiene al menos dos conceptos distintos:

## Compromiso comercial

El cliente acordó adquirir determinados productos.

## Cumplimiento físico

Los productos fueron efectivamente entregados.

Ambos hechos pueden ocurrir:

* en momentos distintos;
* parcialmente;
* mediante múltiples entregas.

---

# 3. Decisión

La arquitectura objetivo adopta:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory OUT
```

con responsabilidades separadas.

---

# 4. Quote

Una `Quote` representa una propuesta comercial.

Contiene información como:

* cliente;
* productos;
* cantidades;
* precios;
* descuentos;
* impuestos;
* vigencia.

### Regla

> Quote no modifica inventario físico.

---

# 5. SalesOrder

Una `SalesOrder` representa un compromiso comercial confirmado.

Define:

* qué se vende;
* a quién;
* cantidades;
* precios;
* condiciones comerciales;
* estado del pedido.

### Regla

> SalesOrder no representa por sí sola una salida física de inventario.

---

# 6. Delivery

Una `Delivery` representa cumplimiento físico.

Registra qué artículos fueron realmente entregados.

Puede contener:

* SalesOrder;
* fecha;
* productos;
* cantidades;
* lotes;
* números de serie;
* responsable;
* destino;
* modalidad;
* observaciones.

---

# 7. Regla de inventario

La salida definitiva debe ocurrir cuando existe el evento físico apropiado.

Conceptualmente:

```text
Delivery CONFIRMED
↓
Inventory OUT
```

No:

```text
SalesOrder CONFIRMED
↓
Inventory OUT
```

---

# 8. Entregas parciales

Una SalesOrder puede tener múltiples Deliveries.

Ejemplo:

```text
SalesOrder
100 unidades
│
├── Delivery 1
│   40
│
├── Delivery 2
│   30
│
└── Pending
    30
```

El sistema debe poder conocer:

```text
Ordered
Delivered
Pending
```

---

# 9. Cantidad entregable

Conceptualmente:

```text
Pending Delivery Quantity
=
Ordered Quantity
-
Confirmed Delivered Quantity
```

Una Delivery no debe exceder la cantidad pendiente salvo que exista posteriormente una regla explícita de negocio que lo permita.

---

# 10. Confirmación de Delivery

Una Delivery debe distinguir entre preparación y confirmación.

Únicamente el evento confirmado debe provocar el efecto físico definitivo.

La implementación exacta del lifecycle será definida dentro del módulo.

---

# 11. Atomicidad

Cuando confirmar una Delivery implique:

* cambiar estado;
* registrar Delivery Items;
* generar movimientos;
* actualizar saldo;
* consumir lotes;

la operación debe preservar consistencia transaccional.

---

# 12. Idempotencia

La misma Delivery no debe provocar dos salidas de inventario por repetir accidentalmente una confirmación.

El sistema debe impedir dobles efectos sobre inventario.

---

# 13. Lotes

Los lotes realmente entregados deben conocerse como máximo al confirmar la Delivery.

Esto permite mantener trazabilidad:

```text
Receipt
↓
Lot
↓
Inventory
↓
Delivery
↓
Customer
```

---

# 14. Series

Para productos serializados, la Delivery debe identificar las unidades físicas entregadas.

Una misma unidad serializada no puede entregarse simultáneamente a dos destinos.

---

# 15. Disponibilidad

Antes de confirmar una Delivery debe validarse inventario suficiente.

La lógica pertenece a Inventory.

Sales no debe recalcular de forma independiente reglas de disponibilidad.

---

# 16. Stock negativo

Cuando las reglas de Inventory prohíban stock negativo, una Delivery que exceda disponibilidad debe rechazarse.

---

# 17. Reserva

La creación o confirmación de SalesOrder **no implica actualmente reserva automática**.

En el futuro podrá existir:

```text
Available
Reserved
Physical
```

pero Reservation requerirá una decisión propia si adquiere complejidad relevante.

---

# 18. Facturación

Invoice es un concepto distinto.

```text
SalesOrder
≠
Delivery
≠
Invoice
```

Dependiendo de la operación:

```text
Invoice
→ Delivery
```

o:

```text
Delivery
→ Invoice
```

pueden ser válidos.

Facturación no debe modificar stock por sí misma.

---

# 19. Venta directa

Zaping debe permitir flujos donde el usuario no necesita crear Quote previamente.

Ejemplo:

```text
SalesOrder
↓
Delivery
```

Quote es opcional cuando el negocio lo permita.

---

# 20. Operación inmediata

Para una venta de mostrador o entrega inmediata, la UX puede presentar un proceso prácticamente continuo:

```text
Crear venta
+
Confirmar entrega
```

aunque arquitectónicamente continúen siendo eventos distintos.

La separación de dominio no obliga a complicar la experiencia del usuario.

---

# 21. Envíos

Shipment representa una modalidad de fulfillment.

Puede evolucionar como información asociada a Delivery.

Ejemplo:

```text
SalesOrder
↓
Delivery
↓
Shipment
↓
Carrier
```

La separación exacta se definirá cuando se implemente logística de envíos.

---

# 22. Returns

Una devolución debe referenciar la operación física correspondiente.

Conceptualmente:

```text
Delivery
↓
Return
↓
Inventory Return / Inspection
```

No debe corregirse una Delivery confirmada simplemente editando su cantidad histórica.

---

# 23. Cancelaciones

## SalesOrder sin entrega

Puede cancelarse según reglas del módulo sin movimiento inverso de inventario.

## SalesOrder parcialmente entregada

La parte ya entregada conserva su historia.

No debe desaparecer al cancelar la cantidad pendiente.

---

# 24. Modificación posterior

Una Delivery confirmada no debe editarse para reescribir historia física.

Los errores deben resolverse mediante:

* Return;
* reversal;
* adjustment;
* mecanismo compensatorio adecuado.

---

# 25. Responsabilidades de dominio

## Sales

Propietario de:

* Quote;
* SalesOrder;
* pricing comercial;
* ciclo comercial.

## Fulfillment / Delivery

Responsable del evento físico de entrega.

Inicialmente puede formar parte del módulo Sales mientras mantenga una responsabilidad separada.

## Inventory

Propietario de:

* disponibilidad;
* lotes;
* series;
* movimientos;
* stock.

---

# 26. Comunicación

Ejemplo conceptual:

```text
Sales
↓
Delivery confirmation
↓
Inventory contract
↓
InventoryMovement OUT
```

Sales no debe escribir directamente:

```text
Product.stock = stock - quantity
```

---

# 27. Healthcare

El flujo Healthcare introduce una distinción adicional.

```text
CaseDispatch
≠
Delivery
```

`CaseDispatch` representa salida temporal/custodia.

`Delivery` representa una salida definitiva asociada al cumplimiento comercial.

---

# 28. Conciliación Healthcare

Conceptualmente:

```text
CaseDispatch
↓
Procedure
↓
CaseReturn
↓
Reconciliation
├── Returned
│   → continúa siendo inventory
│
└── Used
    → puede convertirse en Delivery / Sale
       → Inventory OUT definitivo
```

La arquitectura detallada de custodia se documentará mediante un ADR independiente.

---

# 29. Hospital, cliente y pagador

SalesOrder debe relacionarse con la parte comercial adecuada.

La arquitectura no debe asumir:

```text
Hospital = Customer = Payer
```

La resolución definitiva de Billing Responsibility pertenece a una decisión posterior.

---

# 30. Impacto sobre el modelo actual `Sale`

Existe actualmente un concepto `Sale`.

Este ADR no decide automáticamente si la entidad existente debe:

* renombrarse a `SalesOrder`;
* evolucionar manteniendo su nombre;
* ser reemplazada;
* coexistir temporalmente.

Esa decisión requiere revisar:

* Prisma;
* backend;
* frontend;
* datos existentes;
* migraciones;
* APIs.

Debe resolverse durante el diseño del refactor de Sales.

---

# 31. Estrategia de migración

La evolución debe evitar un cambio destructivo grande.

Dirección recomendada:

```text
1. Documentar dominio objetivo
2. Revisar Sale actual
3. Diseñar modelo SalesOrder
4. Diseñar Delivery
5. Definir compatibilidad/migración
6. Implementar backend
7. Migrar frontend
8. Validar datos
9. Retirar comportamiento legacy
```

---

# 32. API objetivo

Ejemplos conceptuales:

```text
POST /sales-orders
GET  /sales-orders/:id

POST /sales-orders/:id/deliveries
GET  /sales-orders/:id/deliveries

POST /deliveries/:id/confirm
```

Los endpoints definitivos se decidirán durante diseño de API.

---

# 33. UX

La separación técnica no debe generar complejidad innecesaria.

El usuario debe poder comprender rápidamente:

```text
Pedido
Entregado
Pendiente
```

y ejecutar la siguiente acción desde el mismo contexto.

---

# 34. Vistas 360

`SalesOrder 360` puede mostrar:

* cliente;
* productos;
* cantidades;
* estado;
* entregas;
* pendiente;
* documentos;
* facturación;
* devoluciones;
* historial.

Esto reduce navegación entre módulos.

---

# 35. Consecuencias positivas

* representa mejor la operación real;
* permite entregas parciales;
* mejora trazabilidad;
* habilita envíos;
* desacopla inventario de ventas;
* soporta Healthcare;
* habilita facturación flexible;
* facilita devoluciones.

---

# 36. Consecuencias negativas

* más entidades;
* más estados;
* migración del modelo actual;
* mayor complejidad backend;
* mayor complejidad de UX si no se diseña correctamente.

---

# 37. Riesgo principal

El riesgo es convertir una separación arquitectónica necesaria en una experiencia burocrática.

Mitigación:

> mantener el dominio correcto y simplificar la interfaz.

---

# 38. ADR relacionados

* ADR-002 — Inventory Movements.
* ADR-009 — Modular Monolith.
* ADR-010 — Quote → Sale — SUPERSEDED.
* ADR-013 — Inventory Custody & Case Logistics
* futuro ADR — Entity Lifecycle.

---

# 39. Decisión final

Zaping separa:

```text
Intención comercial
↓
SalesOrder

Cumplimiento físico
↓
Delivery

Consecuencia sobre existencias
↓
InventoryMovement
```

Por tanto, la arquitectura comercial objetivo es:

```text
Quote
   ↓
SalesOrder
   ↓
Delivery
   ↓
Inventory OUT
```

sin impedir ventas directas ni obligar al usuario a realizar pasos innecesarios cuando la operación pueda simplificarse desde UX.
