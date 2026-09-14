# Healthcare Requirements — Technical Design

**Módulo:** Healthcare Requirements
**Producto:** Zaping Healthcare
**Versión:** 0.1.0
**Estado:** APPROVED
**Estado de implementación:** NOT IMPLEMENTED / NOT STARTED
**Última actualización:** 2026-09-13
**Responsable:** Zaping Healthcare Team

---

## 1. Propósito

Este documento traduce el domain discovery aprobado de Healthcare Requirements
V1 al diseño técnico aprobado para PostgreSQL, Prisma, NestJS y el frontend
actual de Zaping.

Define:

- persistencia e integridad relacional;
- lifecycle y auditoría básica;
- rutas, DTOs y response shaping;
- tenant isolation;
- fixed-role RBAC;
- validaciones y errores estables;
- protocolo de transacción y concurrencia;
- boundary para la protección RQ-006;
- alcance frontend y secuencia de implementación.

Este documento no implementa la capacidad. Constituye el diseño técnico
aprobado, mientras el contrato de dominio RQ-001 a RQ-030 permanece bajo la
autoridad de `REQUIREMENTS.md`.

---

## 2. Estado y autoridad

```text
Requirements Domain Discovery
→ COMPLETE / DOCUMENTED

Requirements Technical Design
→ APPROVED

Requirements Implementation
→ NOT IMPLEMENTED / NOT STARTED
```

No existe todavía un identificador de milestone o slice para implementar
Requirements. Este documento no crea uno.

Las decisiones `TD-RQ-001` a `TD-RQ-014` son el contrato técnico aprobado que
debe implementarse como unidad mediante slices secuenciales.

---

## 3. Fuentes de verdad

El diseño usa como entradas:

- `docs/modules/healthcare/REQUIREMENTS.md`;
- `docs/modules/healthcare/CASES.md`;
- `docs/modules/healthcare/DOMAIN_MODEL.md`;
- `docs/modules/healthcare/HEALTHCARE.md`;
- `docs/modules/healthcare/DOCTORS_HOSPITALS_TECHNICAL_DESIGN.md`;
- `docs/modules/erp/PRODUCTS.md`;
- documentación CURRENT y TARGET de Inventory y Equipment;
- `app/api/prisma/schema.prisma`;
- guards, DTOs, Services y errores Healthcare CURRENT.

Cuando exista tensión entre una convención técnica actual y RQ-001 a RQ-030,
prevalece el contrato de dominio aprobado de Requirements.

---

## 4. Baseline técnico CURRENT

El runtime actual ya aporta las siguientes bases:

1. `Product` es Company-scoped, usa UUID, tiene `isActive`, cantidades `Int` y
   `@@unique([id, companyId])`.
2. `HealthcareCase` es Company-scoped, usa UUID, tiene
   `@@unique([id, companyId])` y estados `DRAFT`, `SCHEDULED`, `CANCELLED`.
3. Doctor, Hospital, affiliation y HealthcareCase muestran relaciones compuestas
   `[resourceId, companyId] -> [id, companyId]` para impedir cruces de tenant.
4. `User.id` es PK global, pero `User` aún no declara
   `@@unique([id, companyId])`.
5. Los actores de auditoría CURRENT se validan por `id + companyId` en Service,
   aunque varios FKs existentes referencian sólo `User.id`.
6. Mutaciones Healthcare usan `updateMany` tenant-scoped y predicates del estado
   esperado como defensa contra lost races.
7. Los errores Healthcare ya exponen códigos estables para cambios de estado,
   cambios relacionales y fallos de persistencia.
8. El ValidationPipe global usa `whitelist`, `forbidNonWhitelisted` y
   `transform`.

El baseline no contiene todavía Requirement, Preparation, Dispatch, Healthcare
Inventory OUT/consumption, Equipment Assignment ni Custody relacionada con Case.

---

## 5. Invariantes de dominio preservados

El diseño mantiene:

- una Requirement pertenece a una Company y a un HealthcareCase;
- cada Requirement referencia exactamente un Product de la misma Company;
- sólo existe una fila por Company + Case + Product, incluso retirada;
- `caseId` y `productId` son inmutables;
- `requestedQty` es `Int` y estrictamente mayor que cero;
- `type` sólo puede ser `REQUIRED` o `BACKUP`;
- `sortOrder` es requerido, manual y no unique;
- no existe hard delete;
- retirement y reactivation son comandos explícitos;
- un Product inactivo no puede usarse en create o reactivate;
- un Product posteriormente inactivo sigue visible en relaciones existentes;
- `DRAFT` y `SCHEDULED` permiten mutación sujeta a las demás reglas;
- `CANCELLED` vuelve las Requirements read-only;
- ninguna mutación de Requirement crea o modifica Inventory;
- no se persiste estado de fulfillment en Requirement.

---

## 6. Decisiones técnicas

### TD-RQ-001 — Fixed-role RBAC y lifecycle

ADMIN, MANAGER, SALES y WAREHOUSE pueden:

- leer;
- crear;
- actualizar;
- reordenar;
- retirar;
- reactivar.

Todas las acciones permanecen sujetas a tenant isolation, estado del Case,
lifecycle de la línea y RQ-006. Ningún role puede omitir esas reglas.

La autorización continuará usando `JwtAuthGuard`, `RolesGuard` y `@Roles(...)`.
No se crea un sistema paralelo de permisos.

### TD-RQ-002 — Actores de auditoría tenant-safe

El target agrega a `User`:

```prisma
@@unique([id, companyId])
```

`User.id` permanece como PK global. El composite unique sólo habilita FKs que
demuestran estructuralmente que el actor de auditoría pertenece a la misma
Company que la Requirement.

`createdById`, `retiredById` y `reactivatedById` se obtienen del usuario
autenticado. Nunca se aceptan desde el cliente.

### TD-RQ-003 — Límite actual de RQ-006

Requirements V1 puede implementarse y aceptarse antes de que existan productores
reales de fulfillment Healthcare.

Mientras no existan esos productores:

- el policy de evidencia no encuentra evidencia y permite la mutación;
- RQ-006 no se describe como plenamente implementado o probado;
- no se infiere fulfillment desde Preparation;
- no se usan `InventoryMovement.referenceType/referenceId` como relación
  Healthcare informal;
- no se persisten flags ficticios como `hasFulfillment`, `fulfilled` o
  `isLocked`.

### TD-RQ-004 — Auditoría de reactivation

El modelo conserva el retiro más reciente y agrega:

- `reactivatedAt?`;
- `reactivatedById?`.

V1 conserva únicamente el último retirement y la última reactivation. No crea
un event log ni historial field-by-field.

### TD-RQ-005 — Lifecycle

Se usa:

```prisma
enum HealthcareRequirementLifecycle {
  ACTIVE
  RETIRED
}
```

Este lifecycle expresa la vigencia de la Requirement. No representa
Preparation, fulfillment, availability, dispatch, consumption ni custody.

Un enum es preferible a `isActive` porque `RETIRED` tiene auditoría y semántica
propias. El modelo sigue siendo de dos estados y no introduce estados de
fulfillment.

### TD-RQ-006 — Identidad persistente

El modelo target es `HealthcareCaseRequirement`.

La identidad e integridad usan:

```prisma
@@unique([id, companyId])
@@unique([companyId, caseId, productId])
```

La segunda constraint incluye filas retiradas y hace imposible recrear
silenciosamente la misma relación. Create debe dirigir al usuario al comando de
reactivation cuando la fila existente está retirada.

### TD-RQ-007 — Semántica de auditoría lifecycle

Retire:

```text
ACTIVE
→ RETIRED
→ retiredAt = now
→ retiredById = authenticated user
→ retirementReason = normalized nonblank reason
```

Reactivate:

```text
RETIRED
→ ACTIVE
→ preserve retiredAt / retiredById / retirementReason
→ reactivatedAt = now
→ reactivatedById = authenticated user
```

Si la línea se retira otra vez, `retired*` pasa a representar el retiro más
reciente y `reactivated*` conserva la reactivation más reciente.

### TD-RQ-008 — Integridad PostgreSQL

La migración deberá agregar constraints manuales para:

- `requestedQty > 0`;
- exigir que el audit triple de retirement esté completo o totalmente ausente;
- exigir `retirementReason` no blank cuando exista retirement audit;
- exigir que `reactivatedAt` y `reactivatedById` aparezcan juntos;
- impedir reactivation audit sin retirement audit previo;
- exigir retirement audit cuando lifecycle sea `RETIRED`;
- validar la combinación y orden temporal del último retirement/reactivation.

`sortOrder` no es unique y no tiene constraint de signo.

### TD-RQ-009 — API

La colección pertenece al Case y los recursos individuales usan un path
top-level estable:

```text
GET   /healthcare/cases/:caseId/requirements
POST  /healthcare/cases/:caseId/requirements
PATCH /healthcare/cases/:caseId/requirements/reorder

GET   /healthcare/requirements/:requirementId
PATCH /healthcare/requirements/:requirementId
POST  /healthcare/requirements/:requirementId/retire
POST  /healthcare/requirements/:requirementId/reactivate
```

No existe listado global V1. La lista anidada no usa paginación ni búsqueda.

### TD-RQ-010 — Errores estables

El API usa los códigos descritos en la Sección 17. Los recursos missing y
foreign son indistinguibles y ningún error expone constraints, SQL o detalles de
Prisma.

### TD-RQ-011 — Protocolo de transacción y locking

Toda mutación que cambia Requirement sigue este orden:

1. iniciar transacción;
2. bloquear HealthcareCase;
3. validar tenant y estado editable del Case;
4. bloquear Product cuando create/reactivate necesita comprobar actividad;
5. bloquear la Requirement o Requirements target en orden determinista;
6. ejecutar `RequirementOperationalEvidencePolicy.assertMutable(...)`;
7. aplicar la mutación con predicate de estado esperado;
8. releer mediante explicit select y devolver el estado final.

El row locking puede encapsularse en helpers internos del futuro módulo
Requirements mediante queries PostgreSQL parametrizadas dentro de la
transacción Prisma. No requiere una abstracción repository-wide.

La semántica es linearizable:

- si cancelación ya confirmó o adquiere primero el lock del Case, la mutación ve
  `CANCELLED` y falla;
- si la mutación adquiere primero el lock, puede terminar antes de que la
  cancelación deje el Case read-only;
- si Product deactivation confirma o adquiere primero su lock, create/reactivate
  falla con `PRODUCT_INACTIVE`;
- si create/reactivate se lineariza primero, la deactivation posterior no borra
  ni oculta la Requirement ya creada.

Future fulfillment producers deberán adquirir los mismos locks, en el mismo
orden, antes de persistir evidencia.

### TD-RQ-012 — Idempotencia de comandos lifecycle

Retire:

- `ACTIVE -> RETIRED` aplica el audit;
- si ya está `RETIRED`, devuelve HTTP 200 con el estado persistido y no
  sobrescribe auditoría.

Reactivate:

- `RETIRED -> ACTIVE` aplica reactivation audit;
- si ya está `ACTIVE`, devuelve HTTP 200 con el estado persistido y no
  sobrescribe auditoría.

Todos los comandos retire/reactivate invocan el policy RQ-006 después de
bloquear y releer el target. Cuando el lifecycle ya coincide con el solicitado,
el comando conserva su resultado idempotente HTTP 200 y no ejecuta write ni
sobrescribe auditoría. Todo path que cambie datos exige que el policy permita la
mutación antes del write.

`REQUIREMENT_ALREADY_ACTIVE` se reserva para create sobre Company + Case +
Product ya activo. `REQUIREMENT_RETIRED` se usa cuando create, update o reorder
encuentra una línea retirada que requiere reactivation explícita.

### TD-RQ-013 — Response shaping

El Service usa un explicit select estable con los campos descritos en la
Sección 16. No se expanden actores User ni se exponen datos de stock o
fulfillment.

### TD-RQ-014 — Operational evidence port

El target define:

```ts
RequirementOperationalEvidencePolicy.assertMutable(
  transaction,
  {
    companyId,
    caseId,
    requirementId,
    productId,
  },
)
```

En V1, mientras no existan fuentes reales Healthcare, la implementación no
encuentra evidencia y permite la mutación.

Todo update, retire, reactivate y reorder llama al policy; create también lo usa
una vez que existe identidad suficiente para evaluar el intento. Los reintentos
lifecycle que ya alcanzaron el estado solicitado siguen siendo no-op
idempotentes y no escriben. Preparation por sí sola nunca genera un bloqueo.

El primer productor real de Dispatch, Healthcare consumption/Inventory OUT o
Equipment Assignment/Custody debe:

1. persistir una relación explícita y tenant-safe con Case/Requirement;
2. integrarse con el policy;
3. participar en el protocolo de locks TD-RQ-011;
4. permitir que el policy emita `REQUIREMENT_FULFILLMENT_LOCKED`.

---

## 7. Prisma target

### 7.1 Enums

```prisma
enum HealthcareRequirementType {
  REQUIRED
  BACKUP
}

enum HealthcareRequirementLifecycle {
  ACTIVE
  RETIRED
}
```

### 7.2 Modelo

```prisma
model HealthcareCaseRequirement {
  id        String @id @default(uuid())
  companyId String
  caseId    String
  productId String

  requestedQty Int
  type         HealthcareRequirementType
  notes        String?
  sortOrder    Int

  lifecycle HealthcareRequirementLifecycle @default(ACTIVE)

  createdById String

  retiredAt       DateTime?
  retiredById     String?
  retirementReason String?

  reactivatedAt   DateTime?
  reactivatedById String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Restrict)

  healthcareCase HealthcareCase @relation(
    fields: [caseId, companyId],
    references: [id, companyId],
    onDelete: Restrict
  )

  product Product @relation(
    fields: [productId, companyId],
    references: [id, companyId],
    onDelete: Restrict
  )

  createdBy User @relation(
    "HealthcareRequirementCreatedBy",
    fields: [createdById, companyId],
    references: [id, companyId],
    onDelete: Restrict
  )

  retiredBy User? @relation(
    "HealthcareRequirementRetiredBy",
    fields: [retiredById, companyId],
    references: [id, companyId],
    onDelete: Restrict
  )

  reactivatedBy User? @relation(
    "HealthcareRequirementReactivatedBy",
    fields: [reactivatedById, companyId],
    references: [id, companyId],
    onDelete: Restrict
  )

  @@unique([id, companyId])
  @@unique([companyId, caseId, productId])
  @@index([companyId, caseId, lifecycle, sortOrder])
}
```

El formato multilínea de `@relation` es conceptual; la implementación deberá
usar sintaxis Prisma válida y el formatter del repositorio.

### 7.3 Back-relations requeridas

El target agrega las colecciones Prisma correspondientes a:

- `Company.healthcareCaseRequirements`;
- `HealthcareCase.requirements`;
- `Product.healthcareCaseRequirements`;
- `User.createdHealthcareCaseRequirements`;
- `User.retiredHealthcareCaseRequirements`;
- `User.reactivatedHealthcareCaseRequirements`.

Además agrega `@@unique([id, companyId])` a `User` para soportar las tres FKs
compuestas de auditoría.

### 7.4 Índices

Se recomiendan únicamente:

1. `@@unique([id, companyId])` para identidad tenant-safe;
2. `@@unique([companyId, caseId, productId])` para la unicidad de dominio;
3. `@@index([companyId, caseId, lifecycle, sortOrder])` para el único listado V1.

No se agregan índices por actor, Product o timestamps sin un query real que los
justifique. El orden estable puede resolver ties por `createdAt` e `id` sin
sobredimensionar el índice inicial.

---

## 8. Constraints PostgreSQL

La migración deberá incluir checks equivalentes a los siguientes. Los nombres
exactos pueden adaptarse al límite de identificadores PostgreSQL.

```sql
ALTER TABLE "HealthcareCaseRequirement"
ADD CONSTRAINT "HealthcareCaseRequirement_requestedQty_positive_check"
CHECK ("requestedQty" > 0);
```

El audit de retirement es all-or-none y la razón no puede ser blank:

```sql
CHECK (
  (
    "retiredAt" IS NULL
    AND "retiredById" IS NULL
    AND "retirementReason" IS NULL
  )
  OR
  (
    "retiredAt" IS NOT NULL
    AND "retiredById" IS NOT NULL
    AND "retirementReason" IS NOT NULL
    AND btrim("retirementReason") <> ''
  )
)
```

El audit de reactivation es all-or-none:

```sql
CHECK (
  ("reactivatedAt" IS NULL AND "reactivatedById" IS NULL)
  OR
  ("reactivatedAt" IS NOT NULL AND "reactivatedById" IS NOT NULL)
)
```

La combinación lifecycle/audit válida es:

```sql
CHECK (
  (
    "lifecycle" = 'ACTIVE'
    AND (
      (
        "retiredAt" IS NULL
        AND "reactivatedAt" IS NULL
      )
      OR
      (
        "retiredAt" IS NOT NULL
        AND "reactivatedAt" IS NOT NULL
        AND "reactivatedAt" >= "retiredAt"
      )
    )
  )
  OR
  (
    "lifecycle" = 'RETIRED'
    AND "retiredAt" IS NOT NULL
    AND (
      "reactivatedAt" IS NULL
      OR "retiredAt" >= "reactivatedAt"
    )
  )
)
```

Esta tabla de verdad permite:

| Lifecycle | Retirement audit | Reactivation audit | Válido |
| --- | --- | --- | --- |
| ACTIVE inicial | ausente | ausente | sí |
| RETIRED primera vez | presente | ausente | sí |
| ACTIVE reactivada | presente | presente y posterior/al mismo instante | sí |
| RETIRED nuevamente | presente y posterior/al mismo instante | presente | sí |

No se crea un CHECK para Product activo ni Case editable: ambos son estados
mutables en otras tablas y deben resolverse con transacción y locking.

---

## 9. Tenant isolation y delete policy

Las relaciones estructurales son:

```text
Requirement.companyId
= HealthcareCase.companyId
= Product.companyId
= createdBy.companyId
= retiredBy.companyId cuando existe
= reactivatedBy.companyId cuando existe
```

Reglas obligatorias:

- `companyId` proviene exclusivamente del contexto autenticado;
- `caseId`, `productId` y actor IDs se consultan siempre junto con `companyId`;
- todos los reads y writes incluyen predicate de `companyId`;
- IDs foreign producen el mismo 404 que IDs inexistentes;
- no se hace lookup global para distinguir ownership;
- todos los FKs usan `onDelete: Restrict`;
- no existe cascade ni hard delete de Requirements.

La validación Service mejora mensajes y reglas de estado; los FKs compuestos son
la defensa final contra persistencia cross-tenant.

---

## 10. Case state y Product lifecycle

Estados Case CURRENT:

| Estado | Requirements |
| --- | --- |
| DRAFT | editable sujeto a lifecycle y RQ-006 |
| SCHEDULED | editable sujeto a lifecycle y RQ-006 |
| CANCELLED | read-only; create/update/reorder/retire/reactivate bloqueados |

No existe Case reopen en el runtime actual. Si se agrega posteriormente, las
líneas existentes se reutilizarán sin duplicación y volverán a someterse a las
reglas normales.

Product:

- create requiere Product activo;
- reactivate requiere Product activo;
- update/retire de una relación existente no falla sólo porque Product quedó
  inactivo;
- detail/list conserva el Product compacto inactivo para historia;
- `productId` nunca cambia mediante PATCH.

---

## 11. API routes

### 11.1 Colección de un Case

| Método | Ruta | Propósito | HTTP exitoso |
| --- | --- | --- | --- |
| GET | `/healthcare/cases/:caseId/requirements` | Lista activa o histórica ordenada | 200 |
| POST | `/healthcare/cases/:caseId/requirements` | Crear una línea | 201 |
| PATCH | `/healthcare/cases/:caseId/requirements/reorder` | Actualizar posiciones atómicamente | 200 |

### 11.2 Recurso individual

| Método | Ruta | Propósito | HTTP exitoso |
| --- | --- | --- | --- |
| GET | `/healthcare/requirements/:requirementId` | Detail activo o histórico | 200 |
| PATCH | `/healthcare/requirements/:requirementId` | Partial update | 200 |
| POST | `/healthcare/requirements/:requirementId/retire` | Retirement explícito | 200 |
| POST | `/healthcare/requirements/:requirementId/reactivate` | Reactivation explícita | 200 |

No se agrega DELETE ni mutation anidada por Product. No existe un listado global
de Requirements V1.

---

## 12. List contract

Query:

```text
status=ACTIVE | RETIRED | ALL
default=ACTIVE
```

El query DTO rechaza propiedades inesperadas. No incluye `page`, `pageSize` ni
`search`.

Orden estable:

```text
sortOrder ASC
createdAt ASC
id ASC
```

Respuesta:

```ts
type HealthcareRequirementListResponse = {
  items: HealthcareRequirementResponse[];
};
```

No se pagina porque el query está acotado por Case y el cliente necesita la
colección completa para el orden manual. Esta decisión puede revisarse con datos
medidos sin agregar paginación especulativa.

---

## 13. DTO contract

### 13.1 CreateHealthcareRequirementDto

```text
productId      UUID required
requestedQty   integer required, min 1
type           REQUIRED | BACKUP required
notes?         string | null, max 1000
sortOrder      integer required, sin min/max de dominio
```

`caseId` proviene del path y `companyId` del usuario autenticado.

### 13.2 UpdateHealthcareRequirementDto

```text
requestedQty?  integer, min 1
type?          REQUIRED | BACKUP
notes?         string | null, max 1000
sortOrder?     integer
```

Omitted conserva el valor. `notes: null` o blank normalizado limpia notes.
`caseId` y `productId` son inmutables.

### 13.3 RetireHealthcareRequirementDto

```text
retirementReason string required, normalized, nonblank, max 1000
```

### 13.4 ReactivateHealthcareRequirementDto

Body vacío. Cualquier propiedad se rechaza por el ValidationPipe estricto.

### 13.5 ReorderHealthcareRequirementsDto

```ts
{
  items: Array<{
    requirementId: string; // UUID
    sortOrder: number;      // integer
  }>;
}
```

Reglas:

- no puede repetirse `requirementId` en el payload;
- la lista se aplica completa o no se aplica nada;
- puede actualizar un subconjunto de líneas activas;
- no renumera implícitamente líneas omitidas;
- `sortOrder` repetido es válido;
- todos los IDs deben pertenecer al Case y Company del path;
- una línea retirada produce `REQUIREMENT_RETIRED`;
- cada línea que cambiaría debe superar RQ-006.

### 13.6 Campos protegidos

Ningún DTO permite mutar directamente:

```text
id
companyId
caseId
productId en update
lifecycle
createdById
retiredAt
retiredById
retirementReason fuera de retire
reactivatedAt
reactivatedById
createdAt
updatedAt
```

---

## 14. Service semantics

### 14.1 Create

1. Obtiene `companyId` y `createdById` del contexto autenticado.
2. Bloquea y valida el Case.
3. Bloquea y valida Product del mismo tenant y activo.
4. Busca Company + Case + Product, incluyendo retiradas.
5. Si existe activa, responde `REQUIREMENT_ALREADY_ACTIVE`.
6. Si existe retirada, responde `REQUIREMENT_RETIRED`.
7. Crea una fila ACTIVE con audit de creación server-managed.
8. P2002 exacto relee el winner tenant-scoped y produce uno de los dos conflictos
   anteriores.

Create nunca reactiva silenciosamente.

### 14.2 Update

- sólo opera sobre una línea ACTIVE;
- no cambia Case ni Product;
- permite Product histórico inactivo;
- valida Case editable y RQ-006;
- usa `updateMany` con `id + companyId + lifecycle=ACTIVE`;
- un lost race relee tenant-scoped y distingue missing, retired o state changed.

### 14.3 Retire

- valida razón antes de escribir;
- una línea ya RETIRED devuelve 200 sin sobrescribir audit;
- una transición real valida Case y RQ-006;
- escribe el último retirement audit en una sola mutación condicional.

### 14.4 Reactivate

- una línea ya ACTIVE devuelve 200 sin sobrescribir audit;
- una transición real valida Case, Product activo y RQ-006;
- preserva `retired*` y escribe `reactivated*`;
- no crea una nueva fila.

### 14.5 Reorder

- bloquea targets en orden determinista de ID;
- valida todos los targets antes del primer write;
- aplica todos los `sortOrder` en la misma transacción;
- conserva duplicates de `sortOrder`;
- revierte todo ante cualquier fallo.

---

## 15. Concurrency y errores Prisma

El unique Company + Case + Product es la autoridad final ante dos creates.

Mapping:

| Condición | Resultado |
| --- | --- |
| P2002 del unique exacto y winner ACTIVE | `REQUIREMENT_ALREADY_ACTIVE` |
| P2002 del unique exacto y winner RETIRED | `REQUIREMENT_RETIRED` |
| P2003 | `RELATED_RESOURCE_CHANGED` |
| target desaparece/foreign tras lost race | not-found tenant-safe |
| target existe con estado inesperado | `RESOURCE_STATE_CHANGED` |
| otro Prisma known error | `HEALTHCARE_PERSISTENCE_ERROR` |

No se mapea cualquier P2002 como duplicate Requirement; debe verificarse el
target exacto de Company + Case + Product.

Los conditional writes son defensa secundaria. El lock del Case serializa las
mutaciones de Requirements del mismo Case contra cancelación y reorder. El lock
de Product protege create/reactivate contra deactivation concurrente.

---

## 16. Response shaping

`HealthcareRequirementResponse` contiene únicamente:

```text
id
companyId
caseId
productId
requestedQty
type
notes
sortOrder
lifecycle
createdById
retiredAt
retiredById
retirementReason
reactivatedAt
reactivatedById
createdAt
updatedAt

product:
  id
  sku
  name
  isActive
  inventoryTracking
```

No incluye:

```text
stock
availability
shortage
reservation
lot / batch
serial
EquipmentAsset
preparedQty
dispatchedQty
usedQty
returnedQty
expanded User actors
```

El Product compacto permite explicar una relación histórica aun cuando el
master quedó inactivo, sin exponer estado operacional no perteneciente a
Requirements.

---

## 17. Error contract

### 17.1 Not found — HTTP 404

```text
CASE_NOT_FOUND
PRODUCT_NOT_FOUND
REQUIREMENT_NOT_FOUND
```

Cada código cubre tanto missing como foreign ID sin revelar existencia en otro
tenant.

### 17.2 Conflict — HTTP 409

```text
PRODUCT_INACTIVE
CASE_REQUIREMENTS_READ_ONLY
REQUIREMENT_ALREADY_ACTIVE
REQUIREMENT_RETIRED
REQUIREMENT_FULFILLMENT_LOCKED
RESOURCE_STATE_CHANGED
RELATED_RESOURCE_CHANGED
```

`REQUIREMENT_FULFILLMENT_LOCKED` queda reservado y probado a nivel de contract,
pero no puede acreditarse con una fuente real hasta existir el primer productor
Healthcare de fulfillment.

### 17.3 Invalid reorder — HTTP 400

```text
INVALID_REQUIREMENT_REORDER
```

Se usa para shape inválido, IDs duplicados u otra inconsistencia interna del
payload. Missing/foreign y lifecycle conservan sus códigos específicos.

### 17.4 Persistence — HTTP 500

```text
HEALTHCARE_PERSISTENCE_ERROR
```

Nunca se devuelve el mensaje, constraint, query o metadata original de Prisma o
PostgreSQL.

Los guards continúan produciendo 401/403 según la infraestructura CURRENT; un
403 no invalida la sesión.

---

## 18. Fixed-role RBAC matrix

| Acción | ADMIN | MANAGER | SALES | WAREHOUSE |
| --- | --- | --- | --- | --- |
| List/detail | allowed | allowed | allowed | allowed |
| Create | allowed | allowed | allowed | allowed |
| Update | allowed | allowed | allowed | allowed |
| Reorder | allowed | allowed | allowed | allowed |
| Retire | allowed | allowed | allowed | allowed |
| Reactivate | allowed | allowed | allowed | allowed |

El controller debe declarar explícitamente los cuatro roles para cada handler y
la matriz RBAC debe probar metadata y comportamiento real de `RolesGuard`.

WAREHOUSE no obtiene por ello permiso para editar HealthcareCase, Product,
Inventory Movement u otros dominios. El permiso es exclusivo de Requirements.

Permission-based RBAC permanece diferido.

---

## 19. RQ-006 operational evidence policy

### 19.1 Estado CURRENT

No existe evidencia persistente capaz de relacionar inequívocamente una
Requirement con:

- Dispatch;
- Healthcare consumption / Inventory OUT;
- Equipment Assignment;
- effective Custody.

Los OUT actuales pertenecen a Sales. Los campos genéricos
`InventoryMovement.referenceType/referenceId` no tienen FK Healthcare y no deben
utilizarse como atajo.

### 19.2 Contrato target

El policy recibe el transaction client y claves tenant-scoped. Su contrato es:

```text
sin evidencia bloqueante
→ resolve / mutation may continue

evidencia bloqueante
→ throw 409 REQUIREMENT_FULFILLMENT_LOCKED
```

No devuelve cantidades derivadas ni modifica Requirement.

### 19.3 Integración futura obligatoria

El primer productor real deberá proporcionar una relación estructural con
Requirement o una cadena tenant-safe inequívoca desde Requirement y Case. No es
suficiente un reference string.

El productor y las mutaciones de Requirement deben compartir locks para cerrar
la carrera:

```text
Requirement edit checks no evidence
||
future producer creates evidence
```

Preparation no participa como evidencia bloqueante. Cambiar una Requirement
tampoco crea Inventory movement ni altera Preparation automáticamente.

---

## 20. Frontend target

La experiencia V1 agrega una sección Requirements dentro del detail actual de
HealthcareCase, sin exigir una nueva ruta standalone.

Debe incluir:

- lista ACTIVE ordenada manualmente;
- vista histórica RETIRED;
- add/edit para los cuatro roles;
- clasificación REQUIRED/BACKUP;
- diálogo de retirement reason;
- reactivation explícita;
- reorder atómico;
- Product histórico inactivo visible y etiquetado;
- selector de Product activo para create;
- helper RBAC específico de Requirements que incluya WAREHOUSE;
- manejo de 403 sin destruir sesión;
- refresh coherente ante conflictos de estado.

No incluye UI de:

- stock o availability;
- shortages;
- reservations;
- fulfillment;
- Preparation;
- lot, batch, serial, ubicación o EquipmentAsset.

Frontend role-awareness es UX. El backend mantiene la autoridad.

---

## 21. Validation strategy

### 21.1 Prisma/migration

- Prisma validate/generate;
- migration desde la cadena completa en PostgreSQL disposable;
- composite FK Case/Product/User;
- unique Company + Case + Product incluyendo retiradas;
- todos los CHECK lifecycle/audit;
- `onDelete: Restrict`;
- rollback/down recovery documentado según el patrón del repositorio.

### 21.2 DTO/API

- required/optional/null/blank boundaries;
- integer `requestedQty > 0`;
- enum type y status filter;
- sortOrder entero sin unique/sign constraint;
- campos protegidos rechazados;
- IDs UUID;
- reorder sin IDs repetidos;
- empty body estricto para reactivate.

### 21.3 Service/concurrency

- tenant isolation en list/detail/todas las mutations;
- Case CANCELLED read-only;
- Product inactive bloquea create/reactivate;
- Product inactive histórico permanece visible;
- duplicate active/retired y P2002 concurrente;
- lifecycle idempotente sin overwrite de audit;
- update/retire/reactivate/reorder llaman siempre el evidence policy; los no-op
  lifecycle permanecen idempotentes y no escriben;
- Case cancel y Product deactivate concurrentes;
- reorder atómico y rollback total;
- P2003 y persistence errors sin leakage.

### 21.4 RBAC/frontend

- los cuatro roles leen y ejecutan todas las mutations Requirements;
- WAREHOUSE no hereda permisos de Case/Product/Inventory;
- 403 preserva sesión;
- active/historical UI;
- selector active-only;
- sin requests ni claims de availability/fulfillment.

La aceptación inicial debe registrar expresamente que RQ-006 sólo cubre el
contrato y el estado sin productores reales; no una integración real inexistente.

---

## 22. Implementation sequence

Sin asignar identificadores nuevos, la secuencia recomendada es:

1. persistence/migration;
2. backend;
3. concurrency/hardening;
4. frontend;
5. acceptance.

Cada slice debe cerrar sus tests focales y gates antes del siguiente. La
integración real de fulfillment queda diferida hasta el primer productor real y
no se incluye artificialmente en Requirements V1.

---

## 23. Out of scope

Este diseño no introduce:

- Units of Measure, Product unit field, conversion o decimal quantities;
- availability, shortage o reservation;
- Preparation;
- Equipment Assignment;
- Dispatch / Custody;
- Healthcare Inventory OUT / consumption;
- Return / Reconciliation;
- CaseKit o templates;
- lot, batch, serial, storage location o EquipmentAsset selection;
- estados persisted de fulfillment;
- full lifecycle event history o field-by-field audit;
- Case reopen;
- global Requirements search/list;
- fuzzy search;
- permission-based RBAC;
- frontend implementation;
- runtime implementation, Prisma schema o migrations.

---

## 24. Final decision summary

| Decisión | Target aprobado |
| --- | --- |
| Modelo | `HealthcareCaseRequirement` |
| Cantidad | `requestedQty Int > 0` |
| Tipo | `REQUIRED / BACKUP` |
| Lifecycle | `ACTIVE / RETIRED`, sin fulfillment state |
| Identidad | UUID + composite tenant key |
| Unicidad | Company + Case + Product, incluida historia |
| Tenant safety | Composite FKs para Case, Product y actores User |
| Delete policy | Restrict; no hard delete |
| Audit | creation + último retirement/reactivation |
| Case mutable | DRAFT/SCHEDULED |
| Case read-only | CANCELLED |
| Product activo | requerido en create/reactivate |
| RBAC | cuatro roles en read y todas las mutations |
| Lista | anidada, status filter, sin pagination/search |
| Orden | sortOrder, createdAt, id |
| Concurrencia | transaction + ordered row locks + conditional writes |
| RQ-006 | port definido; fuente real diferida |
| Implementación | NOT IMPLEMENTED / NOT STARTED |

```text
Requirements Domain Discovery
→ COMPLETE / DOCUMENTED

Requirements Technical Design
→ APPROVED

Requirements Implementation
→ NOT IMPLEMENTED / NOT STARTED
```
