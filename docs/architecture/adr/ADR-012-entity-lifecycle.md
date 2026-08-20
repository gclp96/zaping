# ADR-012 — Estrategia de Ciclo de Vida de Entidades

**Estado:** ACCEPTED
**Estado de implementación:** PARTIAL
**Fecha:** 2026-08-19
**Responsable:** Zaping Architecture Team
**Reemplaza:** ADR-003 — Estrategia Global de Soft Delete

---

# 1. Contexto

Las entidades de Zaping representan diferentes tipos de información.

Algunas representan catálogos:

* Product;
* Customer;
* Supplier;
* Category;
* User.

Otras representan documentos transaccionales:

* Quote;
* Purchase;
* PurchaseReceipt;
* SalesOrder;
* Delivery;
* Return;
* Case.

Otras representan historia operacional:

* InventoryMovement;
* AuditLog;
* eventos de custodia;
* conciliaciones.

Aplicar la misma estrategia de eliminación a todos estos conceptos produce semántica incorrecta.

---

# 2. Problema

El ADR-003 original establecía una estrategia global:

```text
deletedAt DateTime?
```

para prácticamente todas las entidades empresariales.

Durante la evolución del producto se comprobó que existen diferentes necesidades:

```text
Desactivar
≠
Cancelar
≠
Eliminar
≠
Revertir
≠
Corregir
```

Cada acción representa un significado empresarial diferente.

---

# 3. Decisión

Zaping adopta una estrategia de **Entity Lifecycle basada en semántica de dominio**.

No existe una única política de eliminación aplicable a todas las entidades.

Cada entidad debe clasificarse según su función antes de definir su lifecycle.

---

# 4. Categorías principales

La estrategia distingue inicialmente:

```text
1. Master Data / Catálogos
2. Transactional Documents
3. Historical Ledgers
4. Temporary / Technical Data
5. Sensitive or Retention-Controlled Data
```

Cada categoría utiliza mecanismos diferentes.

---

# 5. Master Data

Ejemplos:

* Product;
* Customer;
* Supplier;
* Category;
* User;
* futuros Doctors;
* Organizations;
* Equipment definitions.

Estas entidades normalmente representan información reutilizable.

Su comportamiento principal debe ser:

```text
ACTIVE
↓
INACTIVE
```

en lugar de:

```text
EXISTS
↓
DELETED
```

---

# 6. `isActive`

Para Master Data, la estrategia preferida es:

```text
isActive Boolean
```

cuando el concepto pueda dejar de utilizarse sin perder su historia.

Ejemplo:

```text
Product.isActive = false
```

significa:

> El producto continúa existiendo históricamente, pero ya no debe utilizarse normalmente para nuevas operaciones.

No significa:

> El producto nunca existió.

---

# 7. Efecto de desactivación

Desactivar una entidad debe impedir normalmente su selección en nuevas operaciones.

Ejemplo:

```text
Product INACTIVE
→ no aparece por defecto al crear nueva Purchase
→ no aparece por defecto al crear nueva SalesOrder
```

pero continúa visible dentro de documentos históricos.

---

# 8. Relaciones históricas

Una entidad desactivada no invalida automáticamente operaciones anteriores.

Ejemplo:

```text
Supplier
isActive = false
```

no debe provocar que desaparezcan:

* Purchases históricas;
* Purchase Receipts;
* documentos;
* auditoría.

---

# 9. Reactivación

Cuando el dominio lo permita, un Master Data puede reactivarse.

Ejemplo:

```text
INACTIVE
↓
ACTIVE
```

La reactivación debe validar nuevamente reglas relevantes como:

* unicidad;
* permisos;
* estado de la empresa;
* restricciones de negocio.

---

# 10. User

`User` utiliza también un concepto de activación.

```text
User.isActive = false
```

debe impedir nuevas operaciones autenticadas según la estrategia de seguridad implementada.

La desactivación no debe eliminar:

* auditoría;
* documentos creados;
* referencias históricas;
* identidad asociada a acciones previas.

---

# 11. Transactional Documents

Los documentos empresariales no deben tratarse como catálogos.

Ejemplos:

* Quote;
* Purchase;
* PurchaseReceipt;
* SalesOrder;
* Delivery;
* Return;
* Invoice;
* Case.

Su lifecycle debe expresarse principalmente mediante **estados de negocio**.

---

# 12. Estados

Ejemplo actual:

```text
DRAFT
CONFIRMED
CANCELLED
```

Otros dominios pueden requerir estados adicionales.

Los estados deben representar hechos empresariales reales.

No deben agregarse únicamente para resolver problemas técnicos.

---

# 13. Draft

Un documento `DRAFT` representa una operación todavía no confirmada.

Puede permitir:

* edición;
* modificación de items;
* corrección;
* y, en algunos dominios, eliminación física.

La política exacta pertenece al módulo.

---

# 14. Eliminación de Draft

La eliminación física de un Draft puede ser aceptable únicamente cuando:

* no produjo efectos irreversibles;
* no generó movimientos confirmados;
* no es necesario conservarlo por auditoría;
* no existen relaciones históricas relevantes.

Ejemplo posible:

```text
Quote DRAFT
sin efectos
↓
DELETE
```

si las reglas del módulo lo permiten.

---

# 15. Confirmed

Un documento `CONFIRMED` representa un hecho empresarial reconocido.

Después de confirmar, los campos que determinan su significado histórico deben quedar protegidos.

Ejemplo:

```text
PurchaseReceipt CONFIRMED
```

no debería permitir cambiar silenciosamente:

```text
quantityReceived: 10
```

a:

```text
quantityReceived: 4
```

si ya generó efectos sobre Inventory.

---

# 16. Inmutabilidad después de confirmación

La inmutabilidad no significa necesariamente que absolutamente ningún campo pueda cambiar.

Debe distinguirse entre:

### Datos históricos esenciales

No deben reescribirse.

### Metadata administrativa segura

Puede permitir cambios si no altera el significado histórico.

Ejemplo posible:

* nota interna;
* referencia no financiera;

si el módulo lo autoriza.

---

# 17. Cancelación

Cancelar un documento es un evento empresarial.

```text
CONFIRMED
↓
CANCELLED
```

no equivale a eliminarlo.

El documento debe conservar:

* folio;
* usuario;
* fecha;
* items;
* totales;
* relaciones;
* historial.

---

# 18. Cancelación con efectos previos

Si un documento confirmado ya produjo efectos en otros dominios, cambiar únicamente:

```text
status = CANCELLED
```

puede ser insuficiente.

Debe resolverse también el efecto producido.

---

# 19. Ejemplo — Receipt

Si:

```text
PurchaseReceipt
↓
Inventory IN
```

la cancelación posterior no debe hacer:

```text
DELETE InventoryMovement
```

Debe utilizarse una operación compensatoria o mecanismo explícito.

---

# 20. Reversión

Una reversión representa la neutralización controlada de una operación previa.

Conceptualmente:

```text
Original Event
+
Compensating Event
=
Net effect corrected
```

sin borrar la historia.

---

# 21. Corrección

Una corrección debe distinguirse de una edición histórica.

Cuando un evento confirmado sea incorrecto, el sistema debe preferir:

* reversal;
* return;
* adjustment;
* compensating transaction;
* documento correctivo;

según el dominio.

---

# 22. Historical Ledgers

Algunas entidades existen principalmente para preservar historia.

Ejemplos:

```text
InventoryMovement
AuditLog
```

Estas entidades deben considerarse fundamentalmente:

**IMMUTABLE**

---

# 23. InventoryMovement

Un InventoryMovement confirmado no debe:

* eliminarse;
* editarse para modificar cantidad;
* cambiarse de IN a OUT;
* modificar su origen histórico.

Los errores deben resolverse mediante un nuevo evento.

---

# 24. AuditLog

Audit debe preservar lo ocurrido.

Un usuario normal no debe poder:

* editar;
* eliminar;
* reconstruir manualmente

registros de auditoría.

Las políticas de retención técnica pueden gestionarse posteriormente sin alterar la integridad lógica de la auditoría.

---

# 25. Entidades hijas

Las entidades que forman parte inseparable de un agregado siguen normalmente el lifecycle de su entidad raíz.

Ejemplo:

```text
Purchase
└── PurchaseItem
```

Un `PurchaseItem` no necesita un lifecycle independiente del Purchase cuando no tiene existencia empresarial separada.

---

# 26. Aggregate Root

Cuando un documento contiene items:

```text
SalesOrder
└── SalesOrderItem
```

las reglas de:

* modificación;
* eliminación;
* confirmación;
* cancelación;

deben controlarse mediante el agregado principal.

---

# 27. Temporary / Technical Data

Algunas entidades técnicas no requieren historia empresarial permanente.

Ejemplos futuros:

* password reset tokens;
* expired sessions;
* temporary import rows;
* temporary cache;
* transient processing records.

Estas entidades pueden utilizar:

* expiration;
* TTL;
* hard delete;
* cleanup jobs.

---

# 28. Hard Delete

La eliminación física está permitida cuando existe una razón clara.

Casos posibles:

* datos temporales;
* Draft descartable sin efectos;
* información de prueba;
* registros técnicos expirados;
* entidades creadas accidentalmente antes de participar en operaciones.

No debe utilizarse por defecto.

---

# 29. Hard Delete prohibido por defecto

Normalmente no debe aplicarse a:

* Inventory Movements;
* Audit;
* Purchase Receipts confirmadas;
* Deliveries confirmadas;
* Returns confirmadas;
* transacciones financieras;
* documentos fiscales;
* conciliaciones confirmadas.

---

# 30. Soft Delete

Soft Delete continúa siendo una herramienta disponible.

Sin embargo, debe utilizarse solamente cuando exista semántica real de:

> ocultar el recurso de la operación normal manteniendo posibilidad de recuperación o conservación.

No debe añadirse automáticamente a todo modelo.

---

# 31. Cuándo considerar Soft Delete

Puede ser apropiado cuando:

* `isActive` no representa correctamente el comportamiento;
* la recuperación tiene valor;
* la entidad puede ser “eliminada” desde perspectiva del usuario;
* existen relaciones históricas que impiden Hard Delete;
* no existe un estado de negocio mejor.

---

# 32. Estados vs Soft Delete

Preferir:

```text
Purchase CANCELLED
```

sobre:

```text
Purchase deletedAt = ...
```

cuando el negocio realmente quiere expresar:

> la compra fue cancelada.

Preferir lenguaje de negocio sobre lenguaje de persistencia.

---

# 33. `isActive` vs Soft Delete

Preferir:

```text
Product.isActive = false
```

cuando significa:

> ya no se comercializa.

Soft Delete puede utilizarse si existe además una necesidad diferente de eliminación lógica.

Ambos conceptos no deben confundirse.

---

# 34. Matriz de lifecycle

Dirección arquitectónica inicial:

| Tipo                      | Estrategia principal                   |
| ------------------------- | -------------------------------------- |
| Product                   | `isActive`                             |
| Category                  | `isActive`                             |
| Customer                  | `isActive`                             |
| Supplier                  | `isActive`                             |
| User                      | `isActive`                             |
| Quote Draft               | Editable / posible Delete según reglas |
| Quote Confirmed           | Estado / preservación                  |
| Purchase Draft            | Editable / posible Delete según reglas |
| Purchase Confirmed        | Estado / cancelación                   |
| PurchaseReceipt Confirmed | Inmutable + reversal                   |
| SalesOrder                | Estado                                 |
| Delivery Confirmed        | Inmutable + Return/Reversal            |
| Return Confirmed          | Inmutable                              |
| InventoryMovement         | Immutable                              |
| AuditLog                  | Immutable                              |
| Password Reset Token      | Expiration / Hard Delete               |
| Temporary Import Data     | Expiration / Hard Delete               |

La documentación específica de cada módulo puede restringir aún más estas reglas.

---

# 35. DELETE HTTP

El método HTTP:

```text
DELETE
```

no debe interpretarse automáticamente como:

```text
DELETE FROM database
```

La semántica depende del recurso.

Sin embargo, para evitar ambigüedad se debe preferir una API explícita cuando exista una acción empresarial.

Ejemplos:

```text
PATCH /products/:id
{ "isActive": false }
```

o:

```text
POST /purchases/:id/cancel
```

en lugar de utilizar `DELETE` para representar una cancelación.

---

# 36. APIs de cancelación

Las operaciones que representan una transición empresarial deben expresarse como tal.

Ejemplo:

```text
POST /sales-orders/:id/cancel
```

puede ser más claro que:

```text
DELETE /sales-orders/:id
```

si la entidad continúa existiendo históricamente.

---

# 37. UI

La interfaz debe utilizar el lenguaje correcto.

Ejemplos:

### Master Data

```text
Desactivar producto
```

no:

```text
Eliminar producto
```

si el sistema únicamente cambia `isActive`.

---

### Documento

```text
Cancelar compra
```

no:

```text
Eliminar compra
```

si el documento continuará existiendo.

---

# 38. Confirmaciones UX

La interfaz debe comunicar la consecuencia real.

Ejemplo:

> Desactivar este proveedor impedirá utilizarlo en nuevas compras. Las compras anteriores permanecerán disponibles.

Esto es preferible a:

> ¿Estás seguro de eliminar?

---

# 39. Permisos

Las acciones de lifecycle pueden tener permisos diferentes.

Ejemplos conceptuales:

```text
products.update
products.deactivate

purchases.update
purchases.confirm
purchases.cancel

inventory.adjust
```

La granularidad final se definirá con RBAC.

---

# 40. Auditoría

Las transiciones relevantes deben ser auditables.

Ejemplos:

```text
ACTIVE → INACTIVE
DRAFT → CONFIRMED
CONFIRMED → CANCELLED
```

Debe poder identificarse:

* usuario;
* fecha;
* entidad;
* transición;
* motivo cuando corresponda.

---

# 41. Motivo

Acciones sensibles pueden requerir un motivo.

Ejemplos:

* cancelación;
* reversión;
* ajuste;
* desactivación crítica.

El módulo define cuándo es obligatorio.

---

# 42. Multi-tenancy

Las acciones de lifecycle continúan sujetas al ADR-001.

Un usuario no puede:

* desactivar;
* cancelar;
* eliminar;
* restaurar

una entidad de otro tenant.

---

# 43. Relaciones

Antes de Hard Delete debe analizarse:

* foreign keys;
* documentos asociados;
* auditoría;
* integridad;
* trazabilidad.

No deben utilizarse eliminaciones en cascada de forma indiscriminada sobre información empresarial.

---

# 44. Cascade Delete

`ON DELETE CASCADE` o equivalentes deben utilizarse solamente cuando la relación realmente represente datos que no tienen valor independiente.

Ejemplo posible:

```text
temporary record
└── temporary details
```

No debe utilizarse para borrar silenciosamente historia empresarial completa.

---

# 45. Privacidad y retención

Este ADR define lifecycle funcional.

No define todavía períodos legales concretos de retención.

La eliminación requerida por:

* privacidad;
* regulación;
* contratos;
* políticas de retención;

deberá documentarse mediante políticas específicas cuando el producto maneje información que lo requiera.

---

# 46. Healthcare

Healthcare deberá seguir las mismas categorías.

Ejemplos:

```text
Doctor
→ Active / Inactive

Case
→ Status lifecycle

CaseDispatch
→ Historical event

CaseReturn
→ Historical event

Reconciliation
→ Confirmed historical record

Equipment Asset
→ Operational status
```

Los estados definitivos se establecerán en la documentación de Healthcare.

---

# 47. Equipment

Los activos reutilizables no deben eliminarse cuando salen de servicio.

Deben poder evolucionar hacia estados como:

```text
AVAILABLE
ASSIGNED
MAINTENANCE
RETIRED
```

`RETIRED` preserva historia.

---

# 48. Importaciones

La futura importación de datos puede generar registros temporales antes de confirmar una importación.

Esos registros temporales pueden eliminarse.

Una vez convertidos en entidades empresariales, adoptan el lifecycle del dominio correspondiente.

---

# 49. Implementación actual

El modelo actual ya utiliza parcialmente esta estrategia:

```text
Product
Category
Customer
Supplier
User
→ isActive
```

y:

```text
Quote
Purchase
Sale
→ DocumentStatus
```

No existe actualmente una estrategia global de `deletedAt`.

Esto es compatible con la dirección de este ADR.

---

# 50. Migración

Este ADR no requiere agregar inmediatamente nuevos campos a todas las tablas.

La implementación debe realizarse módulo por módulo cuando exista necesidad.

No crear una migración exclusivamente para “cumplir el ADR” sin un caso funcional.

---

# 51. Revisión de módulos existentes

Al revisar cada módulo se deberá comprobar:

```text
¿Qué representa esta entidad?
↓
¿Qué lifecycle necesita?
↓
¿La implementación actual coincide?
```

Las correcciones se incorporarán progresivamente.

---

# 52. Consecuencias positivas

* semántica correcta;
* mejor trazabilidad;
* menor pérdida de historia;
* APIs más claras;
* UX más comprensible;
* menos `deletedAt` innecesarios;
* mejor soporte para documentos transaccionales.

---

# 53. Consecuencias negativas

* no existe una única regla universal;
* cada dominio debe definir transitions;
* requiere más análisis;
* algunas entidades actuales pueden necesitar refactor.

---

# 54. Decisiones que este ADR no toma

Este ADR no define:

* todos los estados de SalesOrder;
* todos los estados de Case;
* política fiscal de conservación;
* retención de logs;
* GDPR/LFPDPPP específica;
* proceso completo de anonimización;
* lifecycle de archivos.

Estos temas deberán definirse cuando exista necesidad real.

---

# 55. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-003 — Global Soft Delete — SUPERSEDED.
* ADR-007 — RBAC.
* ADR-011 — Sales Order y Delivery.
* `SECURITY_PRINCIPLES.md`.

---

# 56. Reemplazo de ADR-003

A partir de la aceptación de este documento:

```text
ADR-003
Soft Delete global
```

queda formalmente reemplazado por:

```text
ADR-012
Entity Lifecycle Strategy
```

La decisión histórica permanece documentada.

---

# 57. Principio final

Una entidad no debe desaparecer únicamente porque dejó de participar en la operación diaria.

Zaping debe representar explícitamente lo que realmente ocurrió:

```text
Dejó de utilizarse
→ INACTIVE

Fue cancelado
→ CANCELLED

Fue corregido
→ REVERSAL / CORRECTION

Ocurrió históricamente
→ IMMUTABLE

Era temporal
→ DELETE / EXPIRE
```

El lifecycle debe expresar el negocio, no únicamente la mecánica de la base de datos.
