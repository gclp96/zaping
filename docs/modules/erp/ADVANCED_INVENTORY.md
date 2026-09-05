# Advanced Inventory — Zaping ERP

**Módulo:** ERP Core / Inventory
**Alcance:** Inventory, Equipment y Healthcare Case Logistics
**STATUS:** `DESIGNED / APPROVED`
**IMPLEMENTATION:** `NOT IMPLEMENTED`
**Responsable:** Zaping ERP Team

---

# 1. Propósito y estado

Este documento es la fuente canónica del diseño aprobado para Advanced
Inventory. Define el modelo objetivo para representar ubicación, existencia,
disponibilidad, transferencias, activos reutilizables y trazabilidad.

La aprobación del diseño no cambia el comportamiento actual ni autoriza una
migración. La capacidad completa permanece:

```text
DESIGNED / APPROVED
NOT IMPLEMENTED
```

El comportamiento CURRENT continúa gobernado por `INVENTORY.md`,
`EQUIPMENT.md` y los ADR aplicables. Este documento no implica cambios en
frontend, backend, Prisma, migrations, tests ni dependencias.

---

# 2. Jerarquía organizacional y física

La jerarquía operacional objetivo es:

```text
Company
└── Branch
    └── Warehouse
        └── StorageLocation
```

Ejemplo:

```text
INSAP
├── Hermosillo
│   └── Almacén Principal
└── Nogales
    └── Almacén Principal
```

Reglas:

```text
Company
→ propietaria de la operación y de la existencia

Branch
→ unidad operacional de la Company

Warehouse
→ instalación logística perteneciente a una Branch

StorageLocation
→ ubicación física o lógica operativa dentro de un Warehouse
```

`InventoryLocation` es la capacidad arquitectónica de ubicación aceptada por
ADR-014. `StorageLocation` es el término operacional visible para una
ubicación de almacenamiento.

La ubicación física pertenece a la existencia, no al catálogo de Product.
Nunca deben utilizarse como fuente de ubicación real:

```text
Product.location
Product.locationId
```

---

# 3. Product, SKU y uso operacional

`Product` continúa representando el catálogo y el modelo comercial. `SKU` es
el identificador operativo visible que debe acompañar las experiencias de
inventario, recepción, surtido, transferencia y trazabilidad.

Cuando aplique, la existencia debe conservar:

```text
lot
expirationDate
```

Los lotes no deben mezclarse en una posición que elimine la trazabilidad
requerida por el Product.

El uso operacional del Product se clasifica como:

```text
ProductOperationalUse
├── SALE
├── CASE_USE
└── BOTH
```

```text
SALE
→ consumo o fulfillment comercial

CASE_USE
→ preparación, uso o logística de Healthcare Case

BOTH
→ puede participar en ambos workflows
```

Esta clasificación orienta el workflow; no convierte un uso de Case en una
salida comercial.

---

# 4. Storage Locations e InventoryPosition

Una `StorageLocation` identifica dónde puede encontrarse físicamente una
existencia propiedad de la Company. Puede representar, según el diseño
operacional aprobado, almacén, staging, inspección, cuarentena u otra
ubicación controlada.

`InventoryPosition` es el saldo operacional actual de una existencia en una
ubicación. Conceptualmente conserva:

```text
Company / Branch / Warehouse / StorageLocation
+ Product / SKU
+ lot cuando aplique
+ expirationDate cuando aplique
+ asset cuando aplique
= current operational balance
```

`InventoryPosition` responde cuánto existe ahora en una ubicación. No
reemplaza el historial de movimientos y no es un input libre para editar
stock.

Para activos reutilizables, la identidad individual de `EquipmentAsset` se
conserva aunque la cantidad operacional sea unitaria o no se modele como una
posición cuantitativa ordinaria.

---

# 5. InventoryMovement y Inventory Ledger V2

`InventoryMovement` es el ledger histórico inmutable. Una vez confirmado, no
se edita ni se elimina para cambiar la historia; una corrección se expresa
mediante nuevos movimientos autorizados.

El ledger debe preservar como mínimo:

```text
SKU
Product
lot cuando aplique
expirationDate cuando aplique
branch
warehouse
storage location
quantity
direction
sourceType
sourceId
user
date
```

La dirección de cada entrada del ledger es únicamente:

```text
IN
OUT
```

```text
IN
→ la existencia entra a una posición

OUT
→ la existencia sale de una posición o deja la propiedad de la Company
```

`sourceType` y `sourceId` expresan el significado de negocio y el documento u
operación que originó el movimiento. No se debe crear un enum gigante de tipos
de movimiento específicos para cada workflow.

`InventoryPosition` es el balance actual; `InventoryMovement` es la evidencia
histórica. El balance debe poder reconciliarse contra el ledger.

---

# 6. Relocation, Transfer y recepción

`InventoryRelocation` representa un movimiento físico interno, normalmente
dentro del mismo Warehouse, entre dos StorageLocations. `InventoryTransfer`
representa el traslado entre Warehouses, Branches o contextos de custodia que
requieren una operación de transferencia explícita.

Ambos conservan la propiedad de la Company y se materializan en el ledger
mediante entradas relacionadas:

```text
origen
→ OUT

destino
→ IN
```

La operación de negocio —`InventoryRelocation` o `InventoryTransfer`— da el
significado; `direction` conserva la semántica mínima del ledger. Por ello un
traslado no es una venta ni una salida definitiva y no debe decrementar dos
veces la existencia agregada.

Una recepción física sigue el patrón:

```text
Purchase Receipt
→ IN
→ Warehouse / StorageLocation
```

Una salida comercial, consumo o disposición definitiva sigue el patrón:

```text
posición origen
→ OUT
→ Sale / Delivery / Case disposition según corresponda
```

---

# 7. InventoryReservation y disponibilidad

`InventoryReservation` representa una reclamación lógica sobre existencia
comprometida. Una reserva:

```text
afecta availability
no crea InventoryMovement
no cambia la posición física
```

El movimiento se crea únicamente cuando ocurre el movimiento físico real.
Una separación física o staging sí requiere la operación física
correspondiente, normalmente `InventoryRelocation` o `InventoryTransfer`.

La disponibilidad debe derivarse de la combinación de posiciones elegibles,
reservas, lote/caducidad, condición y reglas operacionales. `Product.stock`
no debe interpretarse como disponibilidad inmediata por ubicación.

---

# 8. Estrategia de transición de Product.stock

La transición debe ser incremental y reconciliable:

```text
1. conservar Product.stock como agregado CURRENT compatible;
2. introducir posiciones y movimientos location-aware;
3. reconciliar el agregado contra InventoryPosition / ledger;
4. migrar consumidores a consultas de posición y disponibilidad;
5. retirar la dependencia anterior solo después de paridad verificada.
```

Durante la transición:

```text
Product.stock
→ aggregate projection de existencia propiedad de la Company
```

No representa por sí solo Warehouse, StorageLocation, reserva, custodia,
condición ni disponibilidad inmediata.

---

# 9. Reusable assets y Equipment derived availability

`EquipmentAsset` representa una unidad física reutilizable y mantiene una
identidad individual distinta de `Product` y de la cantidad agregada.

La disponibilidad de Equipment es derivada. No existe un booleano
`isAvailable` como source of truth. El evaluador debe considerar, cuando
aplique:

```text
lifecycle
condition
warehouse / storage location / custody
case assignment
tender assignment
maintenance
transfer
reservation
```

El estado V1 actual de Core Equipment puede seguir respondiendo con sus hechos
implementados, principalmente `lifecycle` y `condition`. La disponibilidad
operacional avanzada compone además las restricciones de ubicación,
asignación, transferencia, reserva y mantenimiento.

`Equipment Maintenance` es un workflow independiente. Puede bloquear la
disponibilidad derivada, pero no debe simularse con un campo improvisado en
`EquipmentAsset` ni mezclarse con el ledger de inventario.

---

# 10. Healthcare traceability y Case Logistics

Healthcare consume Inventory mediante una frontera explícita de Case
Logistics. La preparación, staging, custodia, retorno e inspección conservan
la propiedad de la Company y se representan como cambios internos de posición
cuando exista la capacidad.

```text
Warehouse
→ InventoryTransfer / InventoryRelocation
→ Case staging
→ InventoryTransfer / InventoryRelocation
→ Technician custody
→ Return / Inspection
→ posición disponible o disposición
```

Solo el consumo o la disposición definitiva produce `OUT` cuando corresponda.
Las asignaciones de Case y el detalle de custodia siguen perteneciendo a
Healthcare; Inventory conserva la verdad de cantidad, posición y movimiento.

Toda experiencia operativa debe poder preservar y mostrar:

```text
SKU
Product
lot
expiration date
branch
warehouse
storage location
quantity
asset when applicable
operation source
user
date
```

---

# 11. Invariantes de diseño

```text
la ubicación pertenece a la existencia física;
Product.location y Product.locationId no son ubicación física real;
InventoryMovement es un ledger histórico inmutable;
InventoryPosition es el balance operacional actual;
reservations afectan availability, no el ledger físico;
la dirección del ledger es IN u OUT;
sourceType / sourceId expresan significado de negocio;
un traslado interno conserva ownership;
Equipment availability es derivada;
Equipment Maintenance es workflow independiente.
```

La implementación deberá conservar tenant isolation, autorización, atomicidad,
idempotencia y reconciliación. El detalle técnico, schema y migrations
requieren diseño posterior y revisión independiente.

---

# 12. Backlog y fuente de ejecución

Los items accionables de Advanced Inventory y Equipment se registran en
[`PROJECT_BOARD.md`](../../project/PROJECT_BOARD.md). La secuencia estratégica
se mantiene en [`ROADMAP.md`](../../project/ROADMAP.md). Este documento define
el diseño aprobado y no inventa versiones ni fechas de entrega.

Documentación relacionada:

```text
INVENTORY.md
EQUIPMENT.md
ADR-002 — Inventory Movements
ADR-013 — Inventory Custody & Case Logistics
ADR-014 — Inventory Locations and Internal Transfers
Healthcare Case Logistics
```

---

# 13. Estado final

```text
Advanced Inventory design
→ DESIGNED / APPROVED

Advanced Inventory implementation
→ NOT IMPLEMENTED

Product.stock transition
→ DESIGNED / NOT IMPLEMENTED

InventoryMovement immutability
→ required by design
```

Aceptar este documento no inicia UX, implementación, migraciones ni pruebas.
