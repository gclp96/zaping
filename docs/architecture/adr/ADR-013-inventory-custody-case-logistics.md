# ADR-013 — Custodia de Inventario y Logística de Case

**Estado:** ACCEPTED
**Estado de implementación:** PLANNED
**Fecha:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Contexto

Zaping Healthcare debe soportar operaciones donde productos, materiales y equipos salen físicamente del almacén para participar en un procedimiento médico.

Un flujo típico puede ser:

```text
Case programado
↓
Almacén prepara material/equipo
↓
Material se entrega a técnico
↓
Técnico transporta material al hospital
↓
Se realiza procedimiento
↓
Parte del material se utiliza
↓
Parte regresa
↓
Equipo reutilizable regresa
↓
Almacén inspecciona
↓
Se concilia la operación
```

Durante este proceso existen varios cambios físicos.

Sin embargo, no todos representan una salida definitiva del inventario propiedad de la empresa.

---

# 2. Problema

Un modelo simple podría interpretar:

```text
Producto sale del almacén
=
Inventory OUT
```

Esto es incorrecto para Zaping Healthcare.

Cuando material o equipo es entregado temporalmente a un técnico:

* ya no está físicamente en el almacén;
* puede no estar disponible para otra operación;
* continúa siendo propiedad de la empresa;
* debe regresar si no se utiliza;
* continúa requiriendo trazabilidad.

Por lo tanto, deben distinguirse:

```text
ubicación física
custodia
disponibilidad
propiedad
consumo
venta
```

---

# 3. Decisión

Zaping distingue formalmente entre:

## Movimiento de custodia

Cambio temporal de ubicación o responsable manteniendo la propiedad de la empresa.

y:

## Inventory OUT definitivo

Evento mediante el cual una existencia deja definitivamente el inventario de la empresa por una causa empresarial válida.

Ejemplos:

* entrega al cliente;
* consumo confirmado;
* baja;
* pérdida ajustada;
* otro evento autorizado.

---

# 4. Principio fundamental

```text
Salir del almacén
≠
Salir del inventario propiedad de la empresa
```

Un producto puede encontrarse fuera del almacén y continuar perteneciendo a la empresa.

---

# 5. Modelo conceptual de existencia

Zaping debe poder evolucionar hacia una visión semejante a:

```text
Company-Owned Inventory
│
├── Warehouse
│   └── Available
│
├── Field / Custody
│   └── Assigned to Case / Technician
│
├── Return Processing
│   ├── Pending Inspection
│   └── Quarantine
│
├── Maintenance
│
└── Other Controlled States
```

Estos nombres representan conceptos arquitectónicos.

No obligan todavía a crear enums o tablas específicas con esos nombres.

---

# 6. Physical Stock

`Physical Stock` representa existencia física que continúa siendo propiedad de la empresa.

Conceptualmente puede incluir:

```text
Warehouse
+
Field Custody
+
Return Pending
+
Maintenance
+
otros estados controlados
```

dependiendo de las reglas del producto.

---

# 7. Available Stock

`Available Stock` representa lo que realmente puede utilizarse para una nueva operación.

Por ejemplo:

```text
100 unidades propiedad de la empresa

70 disponibles en almacén
20 bajo custodia en Cases
10 pendientes de inspección
```

Entonces:

```text
Physical Company-Owned Stock = 100
```

pero:

```text
Available Stock = 70
```

La fórmula definitiva deberá formalizarse cuando se diseñe el modelo avanzado de ubicaciones/disponibilidad.

---

# 8. CaseDispatch

`CaseDispatch` representa la entrega temporal de material o equipo desde almacén hacia un Case.

Conceptualmente:

```text
Warehouse
↓
Technician Custody
↓
Case
```

---

# 9. Regla de CaseDispatch

> Confirmar un CaseDispatch no debe generar automáticamente un Inventory OUT comercial definitivo.

Debe representar:

* cambio de custodia;
* cambio de ubicación operacional;
* disminución de disponibilidad en almacén;
* mantenimiento de propiedad empresarial;
* trazabilidad.

---

# 10. Información mínima de custodia

Una salida debe poder identificar, según corresponda:

* Company;
* Case;
* CaseKit;
* técnico responsable;
* usuario de almacén que entrega;
* fecha y hora;
* hospital;
* productos;
* cantidades;
* lotes;
* series;
* equipos;
* referencias;
* observaciones.

---

# 11. Cadena de custodia

Zaping debe ser capaz de responder:

```text
¿Qué salió?
¿Quién lo entregó?
¿Quién lo recibió?
¿Cuándo?
¿Para qué Case?
¿Dónde se espera que esté?
¿Qué debe regresar?
```

La cadena de custodia constituye parte de la trazabilidad operacional.

---

# 12. Usuario que entrega

Debe distinguirse entre:

```text
dispatchedBy
```

y:

```text
custodian
```

El primero representa quién realizó la entrega desde almacén.

El segundo representa quién quedó responsable del material o equipo.

No necesariamente son la misma persona.

---

# 13. CaseKit

Un `CaseKit` puede agrupar los artículos preparados para un procedimiento.

Ejemplo:

```text
Case
└── CaseKit
    ├── Product A
    ├── Product B
    ├── Lot C
    └── Equipment D
```

El CaseKit es una instancia operacional real.

No debe confundirse con `KitTemplate`.

---

# 14. KitTemplate

`KitTemplate` representa una configuración reutilizable.

Ejemplo:

```text
Procedimiento X
↓
Kit Template
├── Producto A × 2
├── Producto B × 1
└── Equipo C × 1
```

No representa inventario físico.

---

# 15. Preparación vs Dispatch

Preparar material no significa todavía haberlo entregado a un técnico.

Debe distinguirse:

```text
PREPARING
↓
READY
↓
DISPATCHED
```

La preparación puede reservar o identificar recursos en una evolución posterior, pero esa semántica no se asume automáticamente en este ADR.

---

# 16. CaseReturn

`CaseReturn` registra el retorno de material y equipo después del procedimiento.

Debe estar relacionado con la salida original.

Conceptualmente:

```text
CaseDispatch
↓
CaseReturn
```

El sistema debe mostrar lo que originalmente fue entregado para evitar reconstruir manualmente la información.

---

# 17. Responsable de retorno

Debe distinguirse cuando corresponda:

```text
returnedBy
receivedBy
returnedAt
```

Esto permite conservar la cadena de custodia.

---

# 18. Inspección

El retorno físico no implica automáticamente que un artículo vuelva a estar disponible.

Puede requerirse inspección.

Ejemplo:

```text
Returned
↓
Inspection
├── Available
├── Quarantine
├── Maintenance
├── Damaged
└── Incident
```

Los estados definitivos se establecerán durante el diseño del módulo.

---

# 19. Material retornado

Material consumible no utilizado puede regresar al inventario disponible cuando:

* corresponde al mismo artículo;
* mantiene integridad;
* lote/serie son correctos;
* condición permite reutilización o venta;
* las reglas del producto lo autorizan.

---

# 20. Material con empaque dañado

Un artículo retornado con empaque o condición comprometida no debe considerarse automáticamente disponible.

Puede requerir:

```text
Return
↓
Inspection
↓
Quarantine / Non-Sellable
```

hasta resolver su condición.

---

# 21. Equipo reutilizable

El equipo propiedad de la empresa no debe convertirse en venta únicamente por haber participado en un Case.

Ejemplo:

```text
Equipment Asset
AVAILABLE
↓
ASSIGNED
↓
Case
↓
RETURN_PENDING
↓
INSPECTION
↓
AVAILABLE
```

o:

```text
INSPECTION
↓
MAINTENANCE
```

según su condición.

---

# 22. Equipment Asset

El equipo reutilizable debe poder evolucionar hacia una identidad individual.

Información posible:

```text
assetCode
product/model
serialNumber
status
condition
custodian
currentCase
location
history
```

Este ADR no define todavía el schema definitivo.

---

# 23. Reconciliación

Después del procedimiento debe existir una conciliación entre lo entregado y el resultado real.

Conceptualmente:

```text
Dispatched
=
Used
+
Returned
+
Unresolved
```

La ecuación debe conservar consistencia.

---

# 24. Returned no equivale necesariamente a Available

Un artículo puede estar:

```text
Returned
```

pero después de inspección quedar:

```text
Quarantine
Maintenance
Damaged
Unavailable
```

Por lo tanto:

```text
Returned
≠
automáticamente Available
```

---

# 25. Material utilizado

El material confirmado como utilizado durante el procedimiento deja de estar bajo custodia temporal.

Conceptualmente:

```text
CaseDispatch
↓
Used
↓
Reconciliation
↓
Definitive Inventory OUT
```

La relación exacta con Sales y Delivery se define en ADR-011.

---

# 26. Used → operación comercial

Cuando el material utilizado debe cobrarse:

```text
Case
↓
Reconciliation
↓
Used Material
↓
SalesOrder / Delivery
↓
Inventory OUT definitivo
↓
Billing
```

La implementación puede simplificar algunos pasos desde UX.

La separación conceptual debe mantenerse.

---

# 27. No crear ventas automáticamente sin control

La conciliación puede generar:

* propuesta;
* borrador;
* información precargada;

para una operación comercial.

Pero no debe asumir automáticamente:

* cliente;
* precio;
* descuentos;
* impuestos;
* pagador;

sin reglas de negocio válidas.

---

# 28. Inventory OUT definitivo

Una salida definitiva debe representar un hecho claramente identificado.

Ejemplos:

```text
Customer Delivery
Case Consumption confirmado
Write-off
Loss Adjustment
Supplier Return
```

El tipo final depende del dominio.

---

# 29. Material faltante

Si durante la conciliación existe material faltante:

```text
Dispatched = 10
Used = 4
Returned = 5
Unresolved = 1
```

el sistema no debe convertir automáticamente esa unidad en:

```text
Sale
```

ni:

```text
Inventory OUT por consumo
```

Debe generar una incidencia o estado pendiente de resolución.

---

# 30. Resolución de faltantes

Un faltante podría posteriormente resolverse como:

* encontrado;
* retorno tardío;
* utilizado;
* pérdida;
* daño;
* ajuste autorizado.

Cada resultado produce una consecuencia diferente.

---

# 31. Material dañado

Daño no implica automáticamente pérdida de propiedad.

Dependiendo del artículo puede:

```text
Damaged
↓
Quarantine
```

o:

```text
Damaged
↓
Maintenance
```

o:

```text
Damaged
↓
Write-off
↓
Inventory OUT
```

La baja definitiva debe ser explícita.

---

# 32. Incidencias

Diferencias de conciliación deben poder generar una `Incident` o mecanismo equivalente.

Ejemplos:

* faltante;
* equipo incompleto;
* daño;
* lote incorrecto;
* cantidad inconsistente;
* retorno no recibido.

No deben cerrarse silenciosamente.

---

# 33. Lotes

La custodia debe mantener trazabilidad por lote.

Ejemplo:

```text
Receipt
↓
Lot L-001
↓
Warehouse
↓
CaseDispatch
↓
Case
↓
Returned / Used
```

No debe perderse la identidad del lote cuando cruza almacén → campo → almacén.

---

# 34. Series

Para productos o equipos serializados debe mantenerse identidad individual.

Ejemplo:

```text
Serial ABC123
↓
Warehouse
↓
Technician A
↓
Case 245
↓
Return
↓
Inspection
```

Zaping debe poder conocer su historial.

---

# 35. Caducidad

La preparación de Case debe respetar reglas de caducidad.

Productos vencidos no deben seleccionarse como disponibles cuando el dominio los considere no utilizables.

FEFO podrá participar en la recomendación de lote.

---

# 36. FEFO

Cuando varios lotes son válidos, Inventory puede sugerir:

```text
First Expired
First Out
```

La selección concreta debe respetar requerimientos del Case y excepciones permitidas.

---

# 37. Propiedad del dominio

## Healthcare

Es propietario de:

* Case;
* CaseKit;
* CaseDispatch;
* CaseReturn;
* Reconciliation;
* contexto operacional.

## Inventory

Es propietario de:

* cantidades;
* disponibilidad;
* movimientos;
* lotes;
* series;
* ubicaciones/estados de stock cuando sean implementados.

## Equipment

Será propietario del lifecycle específico de activos reutilizables cuando el dominio se formalice.

---

# 38. Regla de integración

Healthcare no debe actualizar directamente:

```text
Product.stock
```

ni crear movimientos evitando Inventory.

Conceptualmente:

```text
Healthcare
↓
Inventory Contract
↓
Inventory
```

---

# 39. Atomicidad de Dispatch

Una confirmación de CaseDispatch puede involucrar:

* documento de salida;
* items;
* lotes;
* series;
* estado de custodia;
* disponibilidad.

Cuando estas operaciones deban ser consistentes entre sí deben ejecutarse de manera transaccional.

---

# 40. Atomicidad de Return

El mismo principio aplica para:

```text
CaseReturn
+
ReturnItems
+
Custody
+
Inventory State
```

---

# 41. Atomicidad de Reconciliation

Una conciliación confirmada no debe quedar parcialmente aplicada.

Si genera:

* retorno;
* consumo;
* movimiento;
* incidencia;

el resultado debe mantener consistencia.

---

# 42. Idempotencia

Operaciones confirmables deben impedir dobles efectos.

Ejemplo:

```text
POST confirm CaseDispatch
↓
network retry
↓
POST confirm CaseDispatch
```

no debe duplicar:

* salida;
* custodia;
* movimientos;
* cantidades.

---

# 43. Inmutabilidad

Una salida confirmada constituye historia.

No debe reescribirse para ocultar errores.

Ejemplo incorrecto:

```text
Dispatched quantity
10
↓
editar históricamente
8
```

si realmente salieron 10.

Debe utilizarse un retorno o corrección trazable.

---

# 44. Lifecycle

La estrategia de estos documentos debe seguir ADR-012.

Ejemplo conceptual:

```text
CaseDispatch
DRAFT
↓
CONFIRMED
```

Una vez confirmado, su información histórica crítica debe protegerse.

---

# 45. Cancelación antes de confirmar

Un Dispatch todavía no confirmado puede cancelarse o eliminarse según las reglas del módulo si no produjo efectos.

---

# 46. Cancelación después de confirmar

Un Dispatch confirmado que realmente ocurrió no debe desaparecer.

Si el material regresa inmediatamente:

```text
CaseDispatch
↓
CaseReturn
```

preserva mejor la realidad que borrar ambos hechos.

---

# 47. Auditoría

Eventos de custodia deben ser auditables.

Como mínimo debe poder determinarse:

```text
qué ocurrió
quién lo realizó
cuándo
qué Case
qué técnico
qué material/equipo
qué cantidades
qué lote/serie
```

---

# 48. Permisos

Posibles permisos futuros:

```text
cases.prepare
caseKits.create
caseKits.modify
caseKits.dispatch
caseKits.return
caseKits.inspect
cases.reconcile
inventory.resolveIncident
```

La matriz definitiva pertenece a RBAC.

---

# 49. Segregación de responsabilidades

El usuario que prepara material no necesariamente debe poder:

* confirmar conciliación;
* realizar ajustes;
* modificar precios;
* cerrar incidentes.

La separación final dependerá del proceso del cliente.

---

# 50. Warehouse Operations

La interfaz de almacén debe presentar estas actividades como tareas.

Ejemplo:

```text
Cases por preparar
Kits listos
Dispatches pendientes
Returns pendientes
Returns por inspeccionar
Conciliaciones pendientes
Incidencias
```

`Warehouse Operations` es un Workspace.

No debe convertirse automáticamente en propietario de Inventory.

---

# 51. Case Calendar

El Calendar puede mostrar indicadores como:

```text
Case mañana
↓
Kit todavía no preparado
```

o:

```text
Case en 2 horas
↓
Equipment unavailable
```

pero el Calendar no es propietario de inventario ni custodia.

---

# 52. Disponibilidad para nuevos Cases

Material que está bajo custodia normalmente no debe presentarse como disponible para otro Case.

Ejemplo:

```text
Equipment E-100
↓
Assigned to Case A
```

no debe poder asignarse simultáneamente a Case B salvo que exista una regla que lo permita.

---

# 53. Detección de conflictos

La arquitectura debe permitir identificar conflictos como:

* mismo equipo;
* misma unidad serializada;
* mismo técnico;
* stock insuficiente;
* lote no disponible.

La lógica exacta se implementará progresivamente.

---

# 54. Multi-almacén

Este ADR no requiere implementar Multi-Warehouse completo.

Sin embargo, el modelo de custodia no debe diseñarse de forma que impida posteriormente distinguir:

```text
Warehouse A
Warehouse B
Field
Technician
Quarantine
Maintenance
```

---

# 55. Ubicación

La arquitectura deberá evolucionar hacia una representación explícita de ubicación o posición de stock cuando el alcance lo requiera.

Este ADR no decide todavía si se utilizarán entidades como:

```text
InventoryLocation
StockPosition
InventoryBalance
CustodyAssignment
```

Eso pertenece al diseño detallado futuro.

---

# 56. No sobrecargar `Product.stock`

El campo agregado:

```text
Product.stock
```

puede continuar temporalmente como proyección.

Pero no es suficiente para representar:

* ubicación;
* custodia;
* estado;
* disponibilidad.

La evolución debe realizarse sin convertir ese campo en fuente única de verdad.

---

# 57. Venta directa

Este ADR no modifica las ventas normales sin Case.

Zaping debe continuar permitiendo:

```text
SalesOrder
↓
Delivery
↓
Inventory OUT
```

sin requerir:

* Case;
* CaseKit;
* técnico;
* hospital.

Healthcare es una vertical, no una dependencia obligatoria del ERP Core.

---

# 58. Shipment

Una operación de envío a cliente también es distinta de CaseDispatch.

```text
Customer Shipment
→ fulfillment comercial

CaseDispatch
→ custodia temporal
```

No deben compartir semántica únicamente porque ambos físicamente salen del almacén.

---

# 59. Facturación

Mover material hacia un Case no debe generar factura automáticamente.

Facturación depende del resultado comercial y del pagador.

```text
CaseDispatch
≠
Invoice
```

---

# 60. Payer

El responsable económico puede ser distinto de:

* hospital;
* médico;
* cliente operativo;
* lugar del procedimiento.

La custodia no debe determinar automáticamente quién paga.

---

# 61. Datos clínicos

La logística de Case no requiere almacenar un expediente clínico.

El Case debe contener solamente información operacional necesaria.

No debe introducirse información clínica sensible para resolver trazabilidad de inventario.

---

# 62. Seguridad

La información de Case debe respetar:

* tenant;
* permisos;
* minimización de datos;
* auditoría;
* controles Healthcare definidos en `SECURITY_PRINCIPLES.md`.

---

# 63. Modelo conceptual completo

```text
Opportunity
    ↓
Case
    ↓
Preparation
    ↓
CaseKit
    ↓
CaseDispatch
    ↓
Technician Custody
    ↓
Procedure
    ↓
CaseReturn
    ↓
Inspection
    ↓
Reconciliation
    │
    ├── Returned usable
    │      ↓
    │   Available Inventory
    │
    ├── Returned with issue
    │      ↓
    │   Quarantine / Maintenance
    │
    ├── Used
    │      ↓
    │   Sales / Delivery
    │      ↓
    │   Definitive Inventory OUT
    │
    └── Unresolved
           ↓
        Incident
```

---

# 64. Invariantes principales

El diseño deberá proteger invariantes como:

```text
Dispatched quantity >= 0
Returned quantity >= 0
Used quantity >= 0
Unresolved quantity >= 0
```

y:

```text
Used
+
Returned
+
Unresolved
=
Dispatched
```

al cerrar una conciliación.

---

# 65. Invariantes de lote

No debe retornarse o consumir más cantidad de un lote que la cantidad efectivamente enviada o disponible según el contexto.

---

# 66. Invariantes de serie

Una misma unidad serializada no puede encontrarse simultáneamente bajo dos custodios activos.

---

# 67. Invariantes de equipo

Un Equipment Asset no puede estar:

```text
AVAILABLE
```

y:

```text
ASSIGNED
```

al mismo tiempo.

Su estado operacional debe ser coherente.

---

# 68. Cierre de Case

Un Case no debería cerrarse completamente mientras existan:

* Returns pendientes;
* custodia pendiente;
* diferencias sin resolver;
* incidencias críticas;

salvo que exista una transición explícita autorizada.

---

# 69. Reconciliation como punto de control

La conciliación constituye el momento donde Zaping determina el destino final de lo enviado.

No debe depender únicamente de memoria o captura manual sin referencia a Dispatch.

---

# 70. Implementación incremental

Este ADR no obliga a implementar toda la arquitectura Healthcare de una sola vez.

Dirección sugerida:

```text
1. Case
2. CaseKit
3. Dispatch
4. Return
5. Reconciliation
6. Equipment
7. Advanced availability
8. Multi-location
9. QR / barcode
```

Las etapas pueden ajustarse mediante roadmap.

---

# 71. Compatibilidad con ERP Core

ERP Core continúa utilizando:

```text
PurchaseReceipt
→ Inventory IN

Delivery
→ Inventory OUT
```

Healthcare incorpora además:

```text
CaseDispatch
→ Custody

CaseReturn
→ Custody resolution

Reconciliation
→ Final disposition
```

Esto extiende Inventory sin redefinir sus reglas fundamentales.

---

# 72. Consecuencias positivas

* representa correctamente la operación Healthcare;
* evita ventas falsas;
* evita pérdidas ficticias de stock;
* mantiene cadena de custodia;
* permite retornos;
* soporta material reutilizable;
* permite conciliación;
* mejora trazabilidad;
* prepara Multi-Warehouse;
* prepara Equipment;
* soporta QR futuro.

---

# 73. Consecuencias negativas

* mayor complejidad de inventario;
* necesidad futura de estados/ubicaciones;
* más eventos;
* más reglas transaccionales;
* más UX operacional;
* pruebas adicionales.

---

# 74. Riesgo principal

El mayor riesgo sería modelar:

```text
Custody
```

como:

```text
Inventory OUT
```

y posteriormente intentar reconstruir manualmente qué material realmente se vendió o regresó.

Este ADR evita esa ambigüedad desde arquitectura.

---

# 75. Decisiones que este ADR no toma

Este ADR no define todavía:

* schema Prisma definitivo;
* entidades exactas de ubicación;
* modelo Multi-Warehouse;
* reserva de inventario;
* estados definitivos de Case;
* estados definitivos de CaseKit;
* mantenimiento/calibración completo;
* QR;
* barcode workflow;
* reglas fiscales;
* proceso de aseguradoras.

Estos temas se definirán cuando corresponda.

---

# 76. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-002 — Inventory Movements.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-011 — Sales Order y Delivery.
* ADR-012 — Entity Lifecycle Strategy.
* `PRODUCT_REQUIREMENTS.md`.
* `SECURITY_PRINCIPLES.md`.

---

# 77. Decisión final

Zaping adopta la siguiente distinción:

```text
Warehouse Exit
        │
        ├── Customer Delivery
        │        ↓
        │   Definitive OUT
        │
        └── CaseDispatch
                 ↓
              Custody
                 ↓
             Procedure
                 ↓
           Reconciliation
             ├── Return
             ├── Consumption → Definitive OUT
             └── Incident
```

Por tanto:

> **La ubicación de un artículo, su custodio, su disponibilidad y su propiedad son conceptos diferentes.**

Esta separación constituye la base arquitectónica de Case Logistics en Zaping Healthcare.
