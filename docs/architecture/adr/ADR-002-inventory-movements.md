# ADR-002 — Inventory Movements como Fuente de Verdad

**Estado:** ACCEPTED
**Fecha original:** 2026-07-10
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Contexto

Inventario es una de las capacidades más críticas de Zaping.

Una implementación sencilla podría almacenar únicamente un número mutable:

```text
Product.stock = 150
```

y modificarlo directamente cada vez que ocurre una operación.

Aunque esta solución es simple, dificulta responder preguntas como:

* ¿por qué hay 150 unidades?;
* ¿de dónde llegaron?;
* ¿quién realizó el movimiento?;
* ¿qué documento lo originó?;
* ¿qué stock existía hace una semana?;
* ¿qué lote estuvo involucrado?;
* ¿qué corrección se realizó?;
* ¿por qué cambió la existencia?

Estas preguntas son especialmente importantes para sectores que requieren alta trazabilidad.

---

# 2. Problema

Se debe decidir si:

### Opción A

el inventario es principalmente un número mutable;

o:

### Opción B

el inventario es el resultado de eventos y movimientos empresariales trazables.

---

# 3. Opción A — Stock mutable como única verdad

Cada operación modifica directamente el saldo actual.

### Ventajas

* implementación sencilla;
* consultas rápidas;
* menor complejidad inicial.

### Desventajas

* baja trazabilidad;
* difícil reconstrucción histórica;
* correcciones pueden borrar historia;
* mayor riesgo de inconsistencias;
* poca capacidad de auditoría.

---

# 4. Opción B — Inventory Movements

Cada cambio de inventario genera un evento trazable.

El saldo actual puede mantenerse como una proyección o valor optimizado, pero debe ser explicable mediante movimientos válidos.

### Ventajas

* trazabilidad;
* auditoría;
* reconstrucción histórica;
* lotes;
* series;
* caducidades;
* devoluciones;
* conciliación;
* soporte futuro multi-almacén.

### Desventajas

* mayor complejidad;
* necesidad de transacciones;
* consultas y proyecciones;
* mayor disciplina de implementación.

---

# 5. Decisión

Zaping adopta **Inventory Movements como fuente operacional de verdad para los cambios de inventario**.

El saldo actual puede existir como una proyección optimizada.

Por ejemplo:

```text
Product.stock
```

puede mantenerse para consultas rápidas.

Sin embargo:

> `stock` no debe modificarse como una entrada independiente del usuario.

Cada modificación debe estar respaldada por una operación de inventario trazable.

---

# 6. Principio central

```text
Evento de negocio
↓
Inventory Movement
↓
Actualización/proyección de saldo
↓
Stock actual
```

No:

```text
Usuario
↓
edita Product.stock
```

---

# 7. Ejemplo — Recepción de compra

```text
Purchase
↓
Purchase Receipt
↓
Inventory Movement IN
↓
Inventory Batch cuando aplica
↓
Stock actualizado
```

La compra por sí misma no representa entrada física.

---

# 8. Ejemplo — Venta

La arquitectura objetivo distingue compromiso comercial de movimiento físico:

```text
Quote
↓
SalesOrder
↓
Delivery
↓
Inventory Movement OUT
```

Una Quote no mueve inventario.

Una SalesOrder tampoco debe reducir stock físico automáticamente.

La Delivery definitiva es el evento físico relevante.

Esta evolución debe formalizarse adicionalmente mediante un ADR específico del flujo comercial.

---

# 9. Correcciones

Un movimiento confirmado no debe reescribirse arbitrariamente para ocultar un error.

Cuando una corrección sea necesaria debe utilizarse:

* movimiento compensatorio;
* reversión explícita;
* ajuste trazable;
* mecanismo equivalente aprobado.

La historia debe permanecer explicable.

---

# 10. Inmutabilidad

Los movimientos confirmados deben considerarse registros históricos.

No deben eliminarse o modificarse libremente.

Campos puramente administrativos podrán evaluarse por separado siempre que no alteren el significado histórico del movimiento.

---

# 11. Implementación actual

La implementación disponible utiliza actualmente tipos generales equivalentes a:

```text
IN
OUT
ADJUSTMENT
```

Estos tipos pueden mantenerse mientras representen correctamente el dominio actual.

No significa que todos los eventos futuros deban reducirse permanentemente a esos tres conceptos.

---

# 12. Evolución de tipos

En el futuro puede ser necesario distinguir semánticamente eventos como:

* Purchase Receipt;
* Customer Delivery;
* Customer Return;
* Supplier Return;
* Stock Adjustment;
* Transfer;
* Case Consumption;
* Case Custody;
* Stock Count.

No deben añadirse enums o tipos anticipadamente sin una necesidad de negocio validada.

---

# 13. Custodia Healthcare

Zaping Healthcare introduce una distinción importante.

```text
Salida del almacén
≠
Salida definitiva de propiedad
```

Cuando material se entrega temporalmente a un técnico para un Case:

```text
Warehouse
↓
Case / Technician Custody
```

la empresa puede continuar siendo propietaria del material.

Por esta razón un `CaseDispatch` no debe modelarse automáticamente como un `OUT` comercial definitivo.

La arquitectura de custodia se formalizará en un ADR independiente antes de modificar Inventory.

---

# 14. Existencia física y disponibilidad

La arquitectura debe evolucionar para poder distinguir conceptos como:

```text
Company-owned stock
├── Warehouse available
├── Field / custody
├── Return pending
├── Maintenance
└── Other controlled states
```

El saldo total propiedad de la empresa y la cantidad disponible para venta pueden no ser iguales.

---

# 15. Lotes

Los productos trazables deben permitir relacionar movimientos con lotes cuando corresponda.

El lote debe poder explicar:

* origen;
* cantidad;
* caducidad;
* movimientos;
* destino.

---

# 16. Series

Los artículos serializados deben poder relacionar una unidad física concreta con sus movimientos.

---

# 17. Transacciones

Cuando una operación afecte simultáneamente:

* documento;
* items;
* lotes;
* movimientos;
* saldo;

debe realizarse atómicamente cuando la consistencia lo requiera.

Ejemplo:

```text
PurchaseReceipt
+
PurchaseReceiptItems
+
InventoryBatch
+
InventoryMovement
+
Stock
```

Si una parte crítica falla, la operación completa debe revertirse.

---

# 18. Propiedad del dominio

Inventory es propietario de:

* reglas de stock;
* movimientos;
* validación de existencia;
* trazabilidad de existencias;
* ajustes.

Otros módulos no deben modificar directamente el stock evitando Inventory.

---

# 19. Rendimiento

Mantener movimientos históricos puede requerir:

* índices;
* paginación;
* agregaciones;
* proyecciones;
* consultas optimizadas.

La necesidad de optimización no justifica eliminar trazabilidad.

---

# 20. Consecuencias positivas

* inventario explicable;
* auditoría;
* historial;
* soporte de lotes;
* soporte de series;
* soporte de caducidad;
* mejor base para Healthcare;
* soporte futuro de múltiples ubicaciones;
* analytics más confiable.

---

# 21. Consecuencias negativas

* mayor complejidad;
* necesidad de transacciones;
* mayor volumen histórico;
* consultas más cuidadosas;
* disciplina en todos los módulos que afectan stock.

---

# 22. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-009 — Modular Monolith.
* futuro ADR — Sales Order / Delivery.
* ADR-013 — Inventory Custody & Case Logistics    

---

# 23. Decisión final

> Inventario no es solamente un número.

El saldo es el resultado de operaciones empresariales trazables.

Toda modificación de stock debe poder explicar su origen.
