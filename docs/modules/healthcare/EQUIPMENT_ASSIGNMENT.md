# Healthcare Equipment Assignment — Zaping Healthcare

**Módulo:** Healthcare Equipment Assignment
**Producto:** Zaping Healthcare
**Slice:** HC-NEXT-03A — Equipment Assignment Domain Discovery
**Versión:** 1.0.0
**Estado de dominio:** APPROVED
**Estado del discovery:** COMPLETE / DOCUMENTED
**Estado del technical design:** HC-NEXT-03B — IN PROGRESS
**Estado HC-NEXT-03B.1:** PERSISTENCE & AVAILABILITY DESIGN — APPROVED / DOCUMENTED
**Estado HC-NEXT-03B.2:** API / DTO / AUTHORIZATION CONTRACT — APPROVED / DOCUMENTED
**Siguiente:** B.3 Implementation Slicing / Acceptance Contract — NEXT / READY
**Estado de implementación:** NOT IMPLEMENTED / NOT STARTED
**Última actualización:** 2026-09-15
**Responsable:** Zaping Healthcare Team

---

# 1. Propósito

Este documento define el contrato funcional de dominio aprobado para asignar
unidades físicas de Equipment a un Healthcare Case.

Equipment Assignment responde:

> **¿Qué EquipmentAsset concreto está reservado o previsto para atender el
> Case?**

No diseña Prisma, migrations, DTOs, endpoints, frontend, locking ni detalles de
implementación. Esas decisiones pertenecen a HC-NEXT-03B.

---

# 2. Ownership y flujo operacional

El flujo conceptual es:

```text
Technician
→ solicita material, consumible o equipo mediante un item de catálogo/Inventory,
  su nombre o tipo y la cantidad requerida

Warehouse
→ decide qué EquipmentAsset concreto satisface cada necesidad de equipo
→ normalmente lo hace al procesar la Requirement
→ puede reemplazar posteriormente el activo seleccionado
```

`Technician` describe al actor operacional. La correspondencia futura con roles,
usuarios o permisos autenticados no se define en este discovery.

ERP Core conserva ownership sobre:

- Product e Inventory;
- la identidad de EquipmentAsset;
- lifecycle y condition propios del activo.

Healthcare conserva ownership sobre la relación operacional entre Case y
EquipmentAsset.

---

# 3. Distinciones obligatorias

```text
Requirement
→ qué se necesita

Equipment Assignment
→ qué EquipmentAsset concreto se reserva o prevé para el Case

Dispatch / Custody
→ movimiento físico y quién tiene realmente el equipo

Equipment lifecycle / condition
→ estado intrínseco del activo
```

Por tanto:

```text
Assignment ≠ Requirement
Assignment ≠ Dispatch
Assignment ≠ Custody
Assignment ≠ Inventory Movement
Assignment ≠ Equipment lifecycle / condition
```

Una asignación no significa que el equipo haya salido físicamente de Warehouse,
no cambia por sí sola la custodia y no debe introducir estados como `ASSIGNED`
en el lifecycle de EquipmentAsset.

---

# 4. Relación con Healthcare Requirements

Todo lo solicitado mediante Healthcare Requirements permanece vinculado a un
Product existente del catálogo/Inventory. Equipment Assignment no crea un
catálogo paralelo ni una Requirement libre de Product.

Una Requirement de equipo puede expresar varias unidades requeridas para un
Case. Una Assignment normalmente debe resolver, total o parcialmente, esa
Requirement mediante EquipmentAsset concretos.

También se admite una asignación directa a un Case sin Requirement previa cuando
Warehouse atiende una necesidad urgente o de último minuto. Esta asignación
manual debe quedar identificada y ser claramente trazable.

B.1 define una fila de Assignment por EquipmentAsset concreto: tres unidades
requeridas pueden cubrirse con tres filas. `REQUIREMENT` exige `requirementId` y
`DIRECT` exige razón con `requirementId = null`. El detalle vive en
`EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md`.

Las Assignments activas con origin `REQUIREMENT` no pueden exceder
`requestedQty` para esa Requirement. Una unidad adicional de respaldo o por una
necesidad operacional de último momento debe usar origin `DIRECT`, exigir
`directAssignmentReason` y no cuenta hacia la cobertura de la Requirement. Esta
regla se valida en dominio/service; no se modela como un constraint SQL amplio.

---

# 5. Cobertura parcial y disponibilidad declarada

La cobertura incompleta de equipo no impide por sí sola que el Case continúe.
Case Status y Case Readiness son dimensiones distintas; un Case `SCHEDULED`
puede conservar alertas operacionales pendientes.

Los estados conceptuales de cobertura pueden incluir:

```text
PENDING
COVERED
PARTIAL
UNAVAILABLE
CONFLICT
```

No quedan aprobados en este discovery como enums persistidos. La cobertura debe
preferiblemente derivarse de:

- cantidad requerida;
- Assignments válidas;
- disponibilidad de los EquipmentAsset;
- conflictos operacionales.

Ejemplo:

```text
requiredQty = 3
validAssignments = 2
→ PARTIAL + warning visible
```

Warehouse puede registrar que el equipo requerido no está disponible.
`UNAVAILABLE` exige comentario o razón de Warehouse. `PARTIAL` debe admitir un
comentario explicativo.

B.1 mantiene coverage derivado y propone notas operacionales especializadas e
históricas para `UNAVAILABLE`/contexto parcial, sin persistir coverage como
status automático.

---

# 6. Disponibilidad para una nueva Assignment

Como mínimo, un EquipmentAsset no está disponible para una asignación nueva
cuando:

```text
lifecycle = RETIRED
condition = INSPECTION_PENDING
condition = DAMAGED
condition = OUT_OF_SERVICE
```

Un activo devuelto en `INSPECTION_PENDING` permanece no disponible hasta que una
inspección restablezca una condición aceptable.

Availability es derivada, contextual y explicable; no es un boolean manual ni
un nuevo lifecycle del activo.

La evaluación debe considerar una ventana operacional, no sólo
`scheduledStart` y `scheduledEnd`. Conceptualmente puede incluir:

- preparación;
- transporte;
- horario programado del Case;
- retorno;
- limpieza o esterilización;
- inspección cuando aplique.

B.1 define `preCaseBufferMinutes` y `postCaseBufferMinutes` Company-scoped en una
configuración Healthcare 1:1. Los defaults exactos siguen TBD.

Una Assignment puede registrarse aunque la ventana operacional del Case todavía
no sea completamente derivable, por ejemplo cuando `scheduledEnd = null`. En
ese estado la disponibilidad queda pendiente/no completamente verificable: no
puede presentarse como libre de conflictos y la UI/API posterior debe mostrar
warning o revisión necesaria. Este estado es derivado y no introduce un enum
persistido. Cada alta o cambio del horario reevalúa automáticamente las
Assignments activas: si el schedule sigue incompleto permanecen pendientes y,
cuando permite derivar la nueva ventana completa, pueden pasar a `CONFLICT`.

---

# 7. Solapamientos, conflictos y override

Cases simultáneos son válidos cuando el inventario de EquipmentAsset disponible
permite cubrirlos.

Si el mismo EquipmentAsset se superpone con la ventana operacional de otro Case:

- se muestra un warning de conflicto visible;
- la Assignment no se bloquea automáticamente;
- un usuario autorizado puede confirmar un override;
- el override exige justificación o comentario obligatorio;
- la decisión conserva trazabilidad de auditoría.

Un override de conflicto no marca el activo como globalmente disponible ni
elimina el conflicto. Registra una decisión operacional explícita y auditable.

B.1 define review sin write, confirmación explícita con revalidación y locks
estrechos por EquipmentAsset. HC-NEXT-03B.2 aprueba el contrato
HTTP/DTO/error/fingerprint: review normal 200 sin write y confirmación vigente
con write atómico.

---

# 8. Reassignment e historia

Una Assignment puede cambiar antes del Case. Reemplazar EquipmentAsset A por B
debe preservar como mínimo la historia conceptual de:

- activo original;
- activo sustituto;
- actor que realizó el cambio;
- fecha y hora;
- razón.

El estado actual no puede sobrescribir o borrar la historia anterior. B.1 define
filas históricas con lifecycle `RESERVED` / `RELEASED` / `REPLACED` y una
self-relation de lineage hacia la Assignment reemplazada.

Si ya existe Dispatch o Custody, modificar la Assignment no reescribe la realidad
física: cualquier cambio adicional debe coordinarse con los workflows futuros
correspondientes.

---

# 9. Reschedule, cancelación y retiro de Requirement

## 9.1 Reschedule

Reprogramar un Case no descarta automáticamente sus Assignments.

El sistema debe reevaluar su disponibilidad contra la nueva ventana operacional.
Según el resultado, el usuario puede:

- conservar Assignments válidas;
- ajustar o reasignar equipo;
- reprogramar nuevamente;
- cancelar cuando corresponda.

Los nuevos conflictos se presentan como alertas operacionales que requieren
atención; no se ocultan ni borran la asignación histórica.

## 9.2 Cancelación

Cuando un Case pasa a `CANCELLED`, sus Assignments activas o reservadas se liberan
automáticamente.

Los activos liberados vuelven a estar disponibles únicamente si su lifecycle,
condition y demás hechos operacionales lo permiten.

La liberación de Assignment no revierte Dispatch ni Custody. Si el equipo ya
salió físicamente de Warehouse, Return/Reconciliation sigue siendo necesario y
la cancelación no debe falsear esa realidad.

## 9.3 Retiro o cancelación de Requirement

Cuando una Equipment Requirement se retira o cancela, sus Assignments activas
con lifecycle `RESERVED` y origin `REQUIREMENT` se liberan automáticamente. Las
filas históricas se conservan y las Assignments originadas como `DIRECT` no se
liberan por esta regla.

La liberación afecta sólo la reserva lógica. La integración futura con
Dispatch/Custody debe impedir que esta transición presente como físicamente
disponible un activo que ya salió de Warehouse o está gobernado por esos
dominios. El guard concreto de esa integración permanece diferido.

---

# 10. Intención RBAC de dominio

La matriz fija aprobada para Equipment Assignment es:

| Rol | Leer contexto | Assign | Replace | Release | Conflict override |
| --- | --- | --- | --- | --- | --- |
| ADMIN | Sí | Sí | Sí | Sí | Sí |
| MANAGER | Sí | Sí | Sí | Sí | Sí |
| WAREHOUSE | Sí | Sí | Sí | Sí | Sí |
| SALES | Sí | No | No | No | No |

SALES conserva acceso de lectura/contexto, sin mutaciones.

Esta matriz expresa intención de dominio. Decorators, guards, rutas y cualquier
autorización exacta de API pertenecen a HC-NEXT-03B. Permission-based RBAC no se
introduce en este slice.

---

# 11. Tenant isolation y auditoría

Como invariante transversal existente:

```text
HealthcareCase.companyId
= Requirement.companyId when related
= EquipmentAsset.companyId
= Assignment company ownership
```

No se permiten relaciones cross-tenant. B.1 propone composite foreign keys para
Case, EquipmentAsset, Requirement, lineage y hechos de override.
HC-NEXT-03B.2 exige lookups `id + companyId`, IDs foreign indistinguibles de
missing mediante 404 tenant-safe y actores derivados del principal autenticado.

Deben ser auditables, como mínimo:

- Assign;
- direct/manual Assign;
- Replace;
- Release;
- conflict override;
- liberación automática por cancelación de Case;
- liberación automática por retiro/cancelación de Requirement.

La auditoría debe poder explicar actor, momento, acción, razón cuando sea
obligatoria y contexto relevante antes/después, sin definir todavía campos o
infraestructura exactos.

---

# 12. Límites de HC-NEXT-03

HC-NEXT-03 se concentra en la selección de EquipmentAsset concretos para un
Case.

No implementa ni absorbe:

- fulfillment de materiales o consumibles;
- Dispatch o Custody;
- Inventory Movement;
- Return/Reconciliation;
- Equipment lifecycle o condition;
- Preparation o CaseKit/Maletín;
- reglas de movimiento físico;
- un catálogo Healthcare paralelo de equipos.

Material/consumable fulfillment está relacionado operacionalmente, pero queda
fuera del foco de Equipment Assignment.

Advanced Dispatch/Custody permanece en un slice posterior y requiere su propio
gate arquitectónico sobre posicionamiento físico, custodia, ubicación y
transferencias.

---

# 13. Estado del technical design

`EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md` aprueba en B.1:

- una fila histórica por EquipmentAsset;
- lifecycle `RESERVED` / `RELEASED` / `REPLACED`;
- origin `REQUIREMENT` / `DIRECT`;
- lineage de reemplazo;
- persistencia especializada de override y notas de cobertura;
- configuración Company-scoped para buffers pre/post Case;
- ventana y overlap derivados;
- Assignment permitida con schedule incompleto, con disponibilidad pendiente y
  revalidación automática al completar o cambiar la ventana;
- liberación automática de reservas originadas por Requirement cuando ésta se
  retira/cancela, preservando historia;
- límite de cobertura por `requestedQty`, con extras originados como `DIRECT` y
  validación de dominio/service;
- composite foreign keys tenant-safe;
- revalidación optimista con locks estrechos justificados;
- separación entre invariantes DB y reglas de service.

HC-NEXT-03B.2 aprueba el recurso
`/healthcare/equipment-assignments`, list/detail, Create, Replace y Release;
DTOs allowlisted, response shaping, paginación, stable errors, fingerprint de
review, `Idempotency-Key`, fronteras atómicas y la matriz fixed-role. ADMIN,
MANAGER y WAREHOUSE pueden crear/reemplazar/liberar/confirmar overrides; SALES
conserva lectura. Frontend UX continúa diferido.

Los valores numéricos default de buffers y la implementación concreta del guard
futuro con Dispatch/Custody permanecen diferidos. Nada de este technical design
está implementado todavía.

---

# 14. Estado final

```text
HC-NEXT-03A — Equipment Assignment Domain Discovery
→ COMPLETE / DOCUMENTED

HC-NEXT-03B — Equipment Assignment Technical Design
→ IN PROGRESS

HC-NEXT-03B.1 — Persistence & Availability Design
→ APPROVED / DOCUMENTED

HC-NEXT-03B.2 — API / DTO / Authorization Contract
→ APPROVED / DOCUMENTED

Next
→ B.3 Implementation Slicing / Acceptance Contract — NEXT / READY

Equipment Assignment implementation
→ NOT IMPLEMENTED / NOT STARTED
```

El contrato aprobado mantiene la secuencia:

```text
Requirement
→ Assignment
→ derived availability / coverage
→ Dispatch / Custody when physical movement occurs
```

sin fusionar planeación, reserva operacional, disponibilidad, movimiento físico,
custodia ni estado intrínseco del activo.
