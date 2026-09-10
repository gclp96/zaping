# Doctors & Hospitals — Technical Design

**Módulo:** Healthcare Doctors & Hospitals

**Producto:** Zaping Healthcare

**Estado:** PROPOSED / NOT IMPLEMENTED

**Tipo de documento:** Persistence & relational-integrity design

**Fecha:** 2026-09-10

---

## 1. Purpose

Este documento traduce el contrato de dominio aprobado de Doctors & Hospitals
a un diseño concreto de persistencia para PostgreSQL, Prisma y la arquitectura
NestJS actual de Zaping.

El diseño decide la forma de los modelos, relaciones, invariantes tenant-safe,
lifecycle, constraints, índices, normalización, búsqueda, concurrencia y
migración. Su objetivo es permitir que un slice posterior implemente Prisma y
la migración sin reabrir decisiones básicas de arquitectura.

Nada descrito aquí está implementado por este documento.

---

## 2. Scope

Incluye:

- `HealthcareDoctor` como master data company-scoped;
- `HealthcareHospital` como master data company-scoped;
- `HealthcareDoctorHospitalAffiliation` como relación explícita N:N;
- relaciones opcionales de `HealthcareCase` con Doctor y Hospital;
- integridad relacional y tenant-safe a nivel de base de datos;
- lifecycle active/inactive y política de borrado;
- constraints, índices y normalización de búsqueda;
- soporte de warning de duplicados sin bloquear duplicados deliberados;
- comportamiento histórico, concurrencia y estrategia de migración.

No incluye diseño detallado de:

- rutas HTTP, DTOs o response shapes;
- matriz RBAC;
- componentes o navegación frontend;
- Patient, Payer, MedicalSpecialty o HospitalContact;
- múltiples Doctors por Case;
- snapshots legales u operacionales;
- implementación, migraciones o tests.

---

## 3. Inputs / source of truth

Fuentes de dominio:

- `docs/modules/healthcare/DOCTORS_HOSPITALS.md` — contrato canónico V1;
- `docs/modules/healthcare/HEALTHCARE.md` — límites de la vertical;
- `docs/modules/healthcare/DOMAIN_MODEL.md` — ownership entre dominios;
- `docs/modules/healthcare/CASES.md` — comportamiento CURRENT de Case y
  relaciones TARGET.

Fuentes arquitectónicas:

- `docs/architecture/ARCHITECTURE.md`;
- ADR-001 — Multi-Tenant;
- ADR-004 — UUID como identificador primario;
- ADR-005 — arquitectura por capas pragmática;
- ADR-009 — Modular Monolith;
- ADR-012 — lifecycle por semántica de dominio.

Fuentes de implementación CURRENT:

- `app/api/prisma/schema.prisma`;
- migraciones de HealthcareCase, Equipment, EquipmentInspection tenant FK,
  SaleReturn/SaleReturnItem, PurchaseReceipt y master data ERP;
- Services y tests de HealthcareCase, Customer, Supplier, Product y Equipment.

En caso de conflicto, `DOCTORS_HOSPITALS.md` gobierna el dominio aprobado;
`schema.prisma` y las migraciones gobiernan solamente el estado implementado
actual.

---

## 4. Current persistence baseline

El schema CURRENT usa PostgreSQL mediante Prisma 6.19.3. No contiene modelos
Doctor, Hospital o affiliation, ni `doctorId`/`hospitalId` en
`HealthcareCase`.

`HealthcareCase` ya contiene:

- UUID técnico;
- `companyId` obligatorio;
- folio único por Company;
- title y procedure description;
- `DRAFT`, `SCHEDULED`, `CANCELLED`;
- schedule nullable;
- responsible User nullable;
- datos de creación y cancelación;
- `@@unique([id, companyId])`;
- índices por Company/status, Company/scheduledStart y
  Company/responsibleUserId.

Patrones observados en el repositorio:

1. Las entidades principales usan `String @id @default(uuid())`.
2. Master data como Product, Customer y Supplier usa `isActive Boolean
   @default(true)` y la operación normal desactiva en lugar de borrar.
3. Los Services reciben `companyId` desde el contexto autenticado y consultan
   por `id + companyId`; el cliente no decide tenant ownership.
4. Mutaciones sensibles usan `updateMany` con predicates tenant-scoped y, en
   lifecycle concurrente, predicates del estado esperado.
5. `EquipmentInspection` referencia `EquipmentAsset` con
   `[equipmentAssetId, companyId] -> [id, companyId]`.
6. `SaleReturn` y `SaleReturnItem` muestran FKs compuestas que preservan
   ownership y consistencia estructural entre agregados relacionados.
7. Las relaciones empresariales históricas usan predominantemente
   `onDelete: Restrict`; `Cascade` está reservado a datos técnicos sin vida
   independiente, como password reset tokens.
8. `EquipmentAsset.serialNumberKey` demuestra un patrón de valor de display
   junto a una key normalizada mantenida por aplicación.
9. No se encontró uso de `citext`, `unaccent`, `pg_trgm`, collations especiales
   ni `CREATE EXTENSION` en schema o migraciones.
10. HealthcareCase usa Prisma directamente desde su Service; no existe un
    Repository obligatorio. Esto es coherente con ADR-005 mientras las
    responsabilidades sigan claras.

Hay relaciones CURRENT a User y otras entidades que aún dependen de validación
tenant del Service y de FKs por ID simple. Ese precedente no debe copiarse para
las nuevas relaciones: el requisito aprobado de este slice exige integridad
tenant en base de datos donde sea razonable, y el repositorio ya contiene el
patrón compuesto adecuado.

---

## 5. Approved domain invariants

El diseño preserva estas invariantes:

- Doctor y Hospital pertenecen exactamente a una Company en V1.
- Doctor no es Customer, User ni Technician.
- Hospital no es Customer ni Company.
- Doctor y Hospital pueden existir independientemente.
- Doctor N:N Hospital se representa mediante una relación operacional
  explícita y opcional.
- Una pareja Doctor/Hospital tiene una sola fila persistente de affiliation,
  reactivable.
- La affiliation no duplica `Doctor.specialty`.
- `HealthcareCase.doctor` y `HealthcareCase.hospital` son opcionales.
- Un Case puede permanecer `SCHEDULED` sin Doctor y/o Hospital.
- Case Status no representa Case Readiness.
- Guardar un Case no crea una affiliation implícita.
- Reprogramar conserva Doctor/Hospital salvo cambio explícito.
- Desactivar master data o affiliation no elimina ni anula referencias
  históricas de Case.
- V1 usa referencias a master data, sin snapshots de nombres.
- Ninguna relación cross-tenant es válida.
- No existe hard delete normal para Doctor, Hospital o affiliation.
- Nombres parecidos producen warning y revisión, no unicidad rígida ni merge
  automático.

---

## 6. Proposed persistence model

Se recomiendan tres modelos nuevos dentro del ownership de Healthcare:

```text
Company
├── HealthcareDoctor
├── HealthcareHospital
└── HealthcareDoctorHospitalAffiliation

HealthcareDoctor
N ↔ N
HealthcareHospital

HealthcareCase
├── healthcareDoctor? — primary Doctor
├── healthcareHospital? — procedure Hospital
└── responsibleUser? — existing relation
```

Nombres recomendados:

- Prisma model: `HealthcareDoctor`;
- Prisma model: `HealthcareHospital`;
- Prisma model: `HealthcareDoctorHospitalAffiliation`.

El prefijo `Healthcare` hace explícito el dominio propietario dentro del
Prisma Client compartido del Modular Monolith. Evita que nombres globales como
`Doctor` o `Hospital` parezcan identidades transversales y reduce colisiones
con futuros dominios. La longitud del nombre de affiliation es un costo menor
frente a esa claridad.

Las tablas conservan por defecto los mismos nombres de los modelos Prisma; no
se necesita `@@map` en V1.

---

## 7. Doctor technical design

### 7.1 Persisted fields

| Campo | Representación | Motivo |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Identidad técnica estable, ADR-004. |
| `companyId` | `String` | Ownership directo y componente de FKs tenant-safe. |
| `firstName` | `String` required | Nombre estructurado de display e identidad operacional. |
| `lastName` | `String` required | Apellido estructurado, búsqueda y display. |
| `specialty` | `String` required | Contexto operacional V1; deliberadamente no enum. |
| `phone` | `String?` | Contacto opcional, sin identidad ni unicidad. |
| `email` | `String?` | Contacto opcional, sin identidad ni unicidad. |
| `notes` | `String?` | Contexto operacional no clínico. |
| `searchKey` | `String` | Valor técnico derivado para búsqueda y candidatos duplicados. |
| `isActive` | `Boolean @default(true)` | Lifecycle de master data conforme ADR-012. |
| `createdAt` | `DateTime @default(now())` | Trazabilidad temporal mínima. |
| `updatedAt` | `DateTime @updatedAt` | Última modificación del master record. |

`searchKey` no es dato de usuario, no se acepta desde API y no es fuente de
display. Debe recalcularse atómicamente cada vez que cambien `firstName`,
`lastName` o `specialty`.

No se persisten en V1:

- honorific/title profesional;
- full name duplicado;
- professional license;
- specialty enum o FK;
- Customer/User IDs;
- campos clínicos o de paciente;
- `deletedAt`.

### 7.2 Relations

- Company required mediante `companyId`, `onDelete: Restrict`.
- Zero-to-many affiliations.
- Zero-to-many HealthcareCases donde actúa como primary Doctor.
- `@@unique([id, companyId])` habilita FKs compuestas tenant-safe.

---

## 8. Hospital technical design

### 8.1 Persisted fields

| Campo | Representación | Motivo |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Identidad técnica estable, ADR-004. |
| `companyId` | `String` | Ownership directo y componente de FKs tenant-safe. |
| `name` | `String` required | Identidad de display de la sede operacional. |
| `city` | `String` required | Contexto logístico y filtro V1. |
| `state` | `String` required | Contexto logístico y filtro V1. |
| `address` | `String?` | Dirección libre opcional V1. |
| `phone` | `String?` | Contacto opcional. |
| `email` | `String?` | Contacto opcional. |
| `contactName` | `String?` | Contacto operacional simple V1. |
| `notes` | `String?` | Instrucciones/contexto reusable no clínico. |
| `searchKey` | `String` | Valor técnico derivado para búsqueda y duplicados probables. |
| `isActive` | `Boolean @default(true)` | Lifecycle de master data. |
| `createdAt` | `DateTime @default(now())` | Trazabilidad temporal mínima. |
| `updatedAt` | `DateTime @updatedAt` | Última modificación. |

Hospital representa en V1 la unidad física/operacional donde ocurre el Case.
No se introduce todavía Organization/Facility, dirección estructurada,
coordenadas ni colección de contactos.

`searchKey` se deriva de `name`, `city` y `state`; no se acepta desde cliente.

### 8.2 Relations

- Company required mediante `companyId`, `onDelete: Restrict`.
- Zero-to-many affiliations.
- Zero-to-many HealthcareCases donde actúa como procedure Hospital.
- `@@unique([id, companyId])` habilita FKs compuestas tenant-safe.

---

## 9. Doctor-Hospital affiliation technical design

### 9.1 Dedicated relation model

Se recomienda una entidad explícita, no una relación many-to-many implícita de
Prisma. La relación tiene lifecycle, notes y timestamps propios, por lo que es
información de dominio y no una tabla join accidental.

Campos:

| Campo | Representación | Motivo |
| --- | --- | --- |
| `id` | UUID | Identidad técnica estable para futuras operaciones/audit. |
| `companyId` | required | Ownership directo y ancla común de las dos FKs. |
| `doctorId` | required | Doctor relacionado. |
| `hospitalId` | required | Hospital relacionado. |
| `isActive` | default `true` | Activar/desactivar/reactivar la relación. |
| `notes` | optional | Contexto operacional de la relación. |
| `createdAt` | default `now()` | Creación de la relación persistente. |
| `updatedAt` | `@updatedAt` | Último cambio de lifecycle/notas. |

### 9.2 Identity and uniqueness

La PK es UUID por consistencia con ADR-004. Además:

```prisma
@@unique([companyId, doctorId, hospitalId])
```

Esta constraint significa que una pareja dentro de una Company tiene una sola
fila persistente. Desactivar y volver a relacionar reactiva esa fila mediante
una acción explícita; no genera una cadena de duplicados históricos.

La constraint incluye `companyId` aunque las FKs compuestas ya lo validan:
expresa el aggregate key de negocio, proporciona el selector compuesto para
Prisma y resuelve carreras de creación simultánea.

No se agrega `specialty`, employment type, effective dates ni snapshot de
nombres.

### 9.3 Effective availability

Una affiliation es seleccionable solamente cuando:

```text
affiliation.isActive
AND doctor.isActive
AND hospital.isActive
```

Desactivar Doctor u Hospital no actualiza en cascada `isActive` de las
affiliations. Esas filas conservan el hecho operacional y su estado propio. Si
el master record se reactiva, la affiliation recupera su estado previo; una
affiliation desactivada explícitamente permanece desactivada.

---

## 10. HealthcareCase integration

Se agregan dos scalars nullable:

```text
doctorId String?
hospitalId String?
```

y dos relaciones opcionales:

```text
healthcareDoctor?
healthcareHospital?
```

Se prefieren nombres de relation field explícitos para evitar confundir el
modelo técnico `HealthcareDoctor` con otras identidades futuras. Los scalar FK
pueden conservar los nombres conceptuales cortos `doctorId` y `hospitalId`
porque están dentro de `HealthcareCase`; el nombre alternativo
`healthcareDoctorId` aporta poco y alarga contratos futuros.

Cada relación usa el `companyId` ya existente en Case:

```text
[doctorId, companyId]   -> HealthcareDoctor[id, companyId]
[hospitalId, companyId] -> HealthcareHospital[id, companyId]
```

Consecuencias:

- ambos IDs nulos son válidos;
- cualquiera puede estar presente sin el otro;
- `SCHEDULED` no exige ninguna de las dos relaciones;
- no se altera `HealthcareCaseStatus` ni su derivación actual desde schedule;
- el existing responsible User permanece independiente;
- el folio, constraints e índices existentes no cambian;
- un PATCH parcial omitido conserva las relaciones;
- `null` explícito puede limpiar una relación si el workflow futuro lo permite;
- un reschedule que sólo cambia fechas conserva Doctor/Hospital;
- una selección nueva o reemplazo requiere master data activa en el Service;
- conservar una referencia ya existente no falla porque luego el master quede
  inactivo;
- la pareja Doctor/Hospital no necesita affiliation activa;
- crear o actualizar Case nunca crea ni reactiva affiliation como side effect.

No se agregan `doctorName`, `hospitalName`, `doctorNameSnapshot` ni
`hospitalNameSnapshot`.

---

## 11. Tenant-safe relational integrity

La defensa se aplica en tres capas complementarias.

### 11.1 Database invariant

`HealthcareDoctor` y `HealthcareHospital` exponen:

```prisma
@@unique([id, companyId])
```

Case usa FKs compuestas hacia esas keys. Affiliation persiste un único
`companyId` y lo comparte en ambas FKs compuestas:

```text
[doctorId, companyId]   -> HealthcareDoctor[id, companyId]
[hospitalId, companyId] -> HealthcareHospital[id, companyId]
```

Por construcción, una fila de affiliation no puede enlazar Doctor A con
Hospital B si sus Companies difieren. Tampoco Case puede apuntar a un master
record de otra Company.

La semántica SQL de una FK compuesta nullable permite Case sin Doctor/Hospital:
si `doctorId` o `hospitalId` es `NULL`, esa relación opcional no se verifica;
`companyId` continúa required para el Case.

### 11.2 Service invariant

El Service debe continuar:

- recibiendo `companyId` del usuario autenticado;
- consultando por `id + companyId`;
- validando `isActive` al crear una relación nueva;
- usando predicates tenant-scoped en update/deactivate/reactivate;
- devolviendo errores de dominio en lugar de filtrar mensajes crudos de FK.

La validación del Service mejora UX y evita depender de errores de
persistencia, pero no reemplaza las FKs compuestas.

### 11.3 Input boundary

`companyId` nunca forma parte de un payload confiable de creación o update. Se
deriva del contexto autenticado, como en HealthcareCase CURRENT.

---

## 12. Lifecycle / delete policy

### 12.1 Representation

Doctor, Hospital y affiliation usan:

```prisma
isActive Boolean @default(true)
```

Un enum no aporta valor en V1: sólo existen active/inactive, la reactivación es
válida y ADR-012 recomienda boolean para master data con esa semántica.

### 12.2 Normal workflow

- Create produce `isActive = true` server-side.
- Deactivate realiza update tenant-scoped, no `DELETE`.
- Reactivate es una transición explícita y revalida reglas relevantes.
- Listas de nueva selección filtran activos.
- Detail/historial puede resolver registros inactivos.
- Generic update no debe aceptar `isActive` si el patrón del módulo separa la
  acción de lifecycle.

### 12.3 Recommended `onDelete`

| Relación | Política | Razón |
| --- | --- | --- |
| Company -> HealthcareDoctor | `Restrict` | No borrar master data empresarial con la Company. |
| Company -> HealthcareHospital | `Restrict` | Misma preservación. |
| Company -> Affiliation | `Restrict` | Relación empresarial persistente. |
| Doctor -> Affiliation | `Restrict` | Evita borrar historia relacional silenciosamente. |
| Hospital -> Affiliation | `Restrict` | Evita cascada de relaciones. |
| Doctor -> HealthcareCase | `Restrict` | Case no debe perder contexto histórico. |
| Hospital -> HealthcareCase | `Restrict` | Case no debe perder contexto histórico. |

No se usa `Cascade` ni `SetNull`. `SetNull` violaría el requisito de conservar
el contexto histórico; `Cascade` destruiría historia. El hard delete
administrativo excepcional, si alguna vez existe, debe exigir que no haya
referencias y pertenecer a un diseño separado.

---

## 13. Constraints

### 13.1 Prisma/database constraints

Obligatorias:

- PK UUID en los tres modelos;
- NOT NULL para ownership y campos requeridos;
- FK Company en Doctor, Hospital y affiliation;
- composite unique `[id, companyId]` en Doctor y Hospital;
- composite tenant-safe FKs en affiliation y HealthcareCase;
- unique `[companyId, doctorId, hospitalId]` en affiliation;
- defaults y timestamps descritos;
- `onDelete: Restrict` explícito.

### 13.2 Non-empty required strings

Prisma `String` required impide `NULL`, pero no `''` ni whitespace-only. El
Service/DTO debe normalizar y rechazar esos valores. La migración de
implementación debe agregar checks PostgreSQL para defensa estructural:

```sql
CHECK (btrim("firstName") <> '')
CHECK (btrim("lastName") <> '')
CHECK (btrim("specialty") <> '')
CHECK (btrim("name") <> '')
CHECK (btrim("city") <> '')
CHECK (btrim("state") <> '')
CHECK (btrim("searchKey") <> '')
```

Los nombres exactos de constraints se definen en la migración y deben ser
estables. Prisma no expresa actualmente estos checks en el model DSL del
proyecto, por lo que serán SQL explícito, como el check ya usado por
`SaleItem.returnedQuantity`.

### 13.3 Deliberately absent constraints

No hay unique constraint sobre:

- nombre o apellido de Doctor;
- specialty;
- nombre de Hospital;
- ciudad/estado;
- email o phone;
- `searchKey` de Doctor/Hospital.

Tampoco se valida formato de email/teléfono con CHECK: corresponde al boundary
de aplicación y puede evolucionar sin migración de base de datos.

---

## 14. Indexes

Los índices propuestos responden a queries V1 concretas.

### 14.1 HealthcareDoctor

```prisma
@@unique([id, companyId])
@@index([companyId, isActive, lastName, firstName])
@@index([companyId, searchKey])
```

- El primero soporta FKs tenant-safe.
- El segundo soporta listado activo tenant-scoped y orden por apellido/nombre.
- El tercero soporta igualdad de `searchKey` para candidatos duplicados; no se
  afirma que acelere arbitrary substring search.

### 14.2 HealthcareHospital

```prisma
@@unique([id, companyId])
@@index([companyId, isActive, name])
@@index([companyId, state, city])
@@index([companyId, searchKey])
```

- Listado activo por nombre.
- Filtro logístico por state/city dentro del tenant.
- Equality candidate lookup por `searchKey`.

Si el producto demuestra que city-only es un filtro frecuente y costoso, se
evaluará un índice `[companyId, city]`; no se agrega especulativamente.

### 14.3 Affiliation

```prisma
@@unique([companyId, doctorId, hospitalId])
@@index([companyId, doctorId, isActive])
@@index([companyId, hospitalId, isActive])
```

Los dos índices direccionales soportan Hospitals for Doctor y Doctors for
Hospital, incluyendo lookup de relaciones activas. La unique resuelve
identidad y carrera concurrente, no reemplaza ambos access paths.

### 14.4 HealthcareCase

Se conservan todos los índices existentes y se agregan:

```prisma
@@index([companyId, doctorId, scheduledStart])
@@index([companyId, hospitalId, scheduledStart])
```

Soportan historial/upcoming Cases por Doctor u Hospital. El prefijo
`companyId` mantiene todas las lecturas tenant-scoped. Los índices de Case
incluyen filas con FK nullable; las consultas de historial
deben filtrar por un ID no nulo concreto. No se proponen índices parciales,
GIN, trigram, full-text ni índices funcionales en V1.

---

## 15. Normalization strategy

Se recomienda la opción B: shadow key mantenida por aplicación, usando el
patrón ya presente de `EquipmentAsset.serialNumberKey`, sin introducir una
infraestructura genérica de búsqueda.

### 15.1 Display values

En create/update:

- trim en todos los strings;
- colapsar whitespace interno repetido en nombres, specialty, city, state y
  contact name;
- convertir optional blank a `null`;
- conservar acentos y capitalización razonable para display;
- no cambiar nombres a uppercase/lowercase como valor visible.

### 15.2 Search key algorithm

Una única función backend, propiedad del módulo Healthcare, debe:

1. aplicar Unicode NFKD;
2. remover combining marks;
3. convertir a lowercase de forma determinística;
4. trim y colapsar whitespace;
5. unir campos en orden canónico con un delimitador no ambiguo.

Composición:

```text
Doctor.searchKey
= normalize(firstName) + SEP + normalize(lastName) + SEP + normalize(specialty)

Hospital.searchKey
= normalize(name) + SEP + normalize(city) + SEP + normalize(state)
```

`SEP` debe ser una constante interna que no pueda aparecer tras normalización,
por ejemplo U+001F. La misma función se usa en create, update, import futuro,
search query y duplicate warning. Tests golden deben fijar casos con acentos,
`ñ`, whitespace y mayúsculas.

La derivación se escribe en la misma mutación que los display fields; nunca se
actualiza de forma independiente.

### 15.3 Email and phone

En V1 no se persisten `emailKey` ni `phoneKey`:

- email se normaliza con trim + lowercase y blank se convierte en `null`;
- phone aplica trim, colapsa whitespace y conserva prefijo internacional,
  puntuación significativa y extensión en lugar de inventar una canonización
  regional;
- ninguno es unique ni forma parte de una FK;
- una comparación secundaria para duplicate warning puede normalizar esos
  valores en memoria, sin convertirlos en identidad.

Si una integración futura requiere matching telefónico internacional, deberá
definir país, parser y formato E.164 antes de agregar una key persistida.

---

## 16. Search strategy

### 16.1 V1 recommendation

La query normaliza el texto con el mismo algoritmo, separa términos y exige que
cada término aparezca en `searchKey`. Esto permite búsqueda:

- case-insensitive;
- accent-tolerant;
- por firstName, lastName o specialty para Doctor;
- por name, city o state para Hospital;
- con términos en diferente orden cuando se expresen como predicates
  independientes.

El filtro siempre incluye `companyId`; para selectores nuevos incluye además
`isActive: true`.

Prisma `contains` sobre `searchKey` genera substring matching. Un B-tree común
no acelera un patrón `%term%`; el costo es aceptable para el volumen V1 de
master data por Company y debe medirse antes de agregar infraestructura.

### 16.2 Why not database extensions now

El repositorio no usa `citext`, `unaccent` ni `pg_trgm`. Introducirlos implicaría
operación de extensión, diferencias de ambientes, SQL/Prisma adicional y una
estrategia de índices nueva. No se justifica sólo para este primer catálogo.

`citext` resolvería case-insensitive equality, no accent-insensitive search.
`unaccent` por sí solo tampoco resuelve índices de contains. Una solución con
generated columns/functions + trigram debe evaluarse como evolución medida, no
como requisito de esta migración.

---

## 17. Duplicate-warning support

Duplicate detection es advisory, no una invariant de identidad.

Antes de crear:

- Doctor consulta por `companyId + searchKey` en activos e inactivos;
- Hospital consulta por `companyId + searchKey` en activos e inactivos;
- coincidencias de email/phone normalizados pueden mostrarse como evidencia
  secundaria, nunca como bloqueo ni identidad suficiente.

La aplicación devuelve candidatos y requiere que el usuario revise. Debe
existir un mecanismo explícito de “crear de todos modos” cuando el duplicado sea
válido. Un match inactivo debe sugerir revisar/reactivar antes de duplicar.

No se hace auto-merge y no hay unique sobre `searchKey`. En consecuencia, dos
creates concurrentes pueden producir dos registros aunque ambos checks previos
no encuentren candidato. Eso es compatible con el contrato: duplicate warning
no es garantía transaccional. Resolverlo con locks amplios bloquearía duplicados
deliberados y convertiría un warning en una constraint no aprobada.

La affiliation sí tiene unicidad rígida porque representa una relación
estructural inequívoca, no una inferencia por nombre.

---

## 18. Historical-reference behavior

- Deactivar Doctor/Hospital no toca `HealthcareCase.doctorId` ni
  `HealthcareCase.hospitalId`.
- Deactivar affiliation no modifica Cases existentes ni futuros; Case no
  depende de affiliation.
- Las vistas históricas incluyen master data inactiva al resolver una FK.
- Los selectores de una relación nueva excluyen inactivos por defecto.
- Correcciones de ortografía/contacto actualizan el master y se reflejan en
  Cases porque V1 no usa snapshots.
- Cambiar la identidad real de un registro para representar otra persona/sede
  está prohibido por regla de Service y proceso; no es expresable mediante una
  constraint relacional.
- Si la identidad cambia realmente, se desactiva el registro anterior y se crea
  uno nuevo.

No se requiere mecanismo adicional de base de datos más allá de FKs `Restrict`
y ausencia de hard delete normal. Audit detallado y snapshots pertenecen a
slices futuros.

---

## 19. Concurrency / race analysis

| Race | Database invariant | Service behavior | Resultado V1 |
| --- | --- | --- | --- |
| Dos creates de la misma affiliation | Unique Company+Doctor+Hospital | Capturar P2002 y releer la fila ganadora; no crear otra. Reactivar sólo por acción explícita. | Una fila persistente. |
| Duplicate warning + dos creates de Doctor/Hospital | Sin unique deliberadamente | Ambos pueden recibir warning vacío y crear. | Duplicado posible y permitido; revisión/merge futuro. |
| Case intenta relación cross-tenant | Composite FK rechaza | Validación previa por `id + companyId` devuelve error de dominio. | Nunca queda persistido el cruce. |
| Affiliation intenta Doctor/Hospital de Companies distintas | Dos composite FKs comparten `companyId` | Validación previa de ambos masters. | Nunca queda persistida. |
| Deactivate mientras Case asigna master activo | FK preserva existencia, no `isActive` | Validar active en el command transaction. | El resultado Case + master inactive es históricamente válido y se puede linearizar como assignment antes de deactivate. |
| Dos deactivates/reactivates | Estado en predicate de `updateMany` | Una transición gana; la otra relee o devuelve conflicto/idempotencia según command. | Sin pérdida de integridad. |
| Dos updates de master fields | Ninguna constraint de versión V1 | Last-write-wins, como master data CURRENT. | Aceptado V1; optimistic versioning deferred. |

No debe intentarse una CHECK/FK contra `isActive`: PostgreSQL no puede expresar
de forma segura ese requisito mutable mediante una FK común, y la historia
requiere que una FK válida pueda apuntar a master data inactiva.

Si más adelante se exige que deactivate y assignment tengan orden estricto de
commit, ambos commands deberán bloquear la fila master en una transacción o
usar `Serializable` con retry. No es necesario para la invariant histórica V1.

---

## 20. Migration strategy

La migración futura debe ser aditiva.

Orden recomendado:

1. Crear `HealthcareDoctor` y `HealthcareHospital` con campos, checks, Company
   FKs, composite unique e índices.
2. Crear `HealthcareDoctorHospitalAffiliation` con Company FK, unique del par,
   FKs compuestas e índices direccionales.
3. Agregar `doctorId TEXT NULL` y `hospitalId TEXT NULL` a
   `HealthcareCase`.
4. Agregar las dos composite FKs `Restrict`.
5. Agregar los dos índices de Case.
6. Ejecutar `prisma validate`, `prisma format`, migration diff review y pruebas
   PostgreSQL reales antes de desplegar aplicación consumidora.

No hay backfill: todas las filas actuales de HealthcareCase permanecen válidas
con ambos IDs nulos. No cambia el status, schedule, folio ni responsible User.

### 20.1 Operational risk

- Crear tablas nuevas tiene riesgo bajo.
- Agregar columnas nullable sin default es una operación ligera en PostgreSQL.
- Agregar FKs e índices puede tomar locks sobre `HealthcareCase`; debe medirse
  el tamaño real y ejecutar en ventana adecuada.
- Los índices de tablas nuevas no afectan datos previos.
- La aplicación debe desplegarse después de la migración; una versión anterior
  ignora columnas nullable nuevas.
- La primera escritura debe calcular `searchKey`; no existe legacy row que
  requiera backfill en tablas nuevas.

### 20.2 Rollback

Antes de almacenar Doctors/Hospitals, rollback puede eliminar columnas y tablas
nuevas. Después de producir datos o referencias, ese rollback es destructivo;
se prefiere una migración forward que deshabilite el uso o corrija constraints.
Nunca debe dropearse una FK/columna con referencias sin backup y plan explícito.

No se crea migración en este task.

---

## 21. Alternatives considered

### 21.1 Short model names

`Doctor`, `Hospital`, `DoctorHospitalAffiliation` son legibles, pero ocultan el
ownership Healthcare dentro de un Prisma Client global. Se prefiere el prefijo
consistente.

### 21.2 Implicit Prisma many-to-many

Es más corta, pero no puede representar lifecycle, notes, timestamps ni una
identidad operable de affiliation. Se descarta.

### 21.3 Enum lifecycle

Un enum ACTIVE/INACTIVE agrega migración y branching sin semántica adicional.
`isActive` coincide con master data CURRENT y ADR-012.

### 21.4 No persisted normalized key

Usar sólo `mode: insensitive` simplifica schema, pero no garantiza búsqueda
accent-tolerant ni candidatos equivalentes `José`/`Jose`. Se descarta para V1
porque una shadow key local es pequeña, Prisma-compatible y ya existe como
patrón conceptual en Equipment.

### 21.5 Separate normalized field per attribute

`firstNameKey`, `lastNameKey`, `specialtyKey`, etc. facilitan algunas queries
exactas, pero multiplican campos derivados e invariantes de sincronización. Una
`searchKey` compuesta satisface search y warning V1 con menor superficie.

### 21.6 PostgreSQL extension search

`citext`, `unaccent` y `pg_trgm` pueden mejorar capacidades, pero no existen en
el proyecto y no se introducen sin evidencia de escala/operación.

### 21.7 App-only tenant validation

Coincide con algunas relaciones legacy, pero deja abierta una inconsistencia
por bug, script o futura ruta. Las FKs compuestas ya son un patrón probado del
repositorio y se recomiendan.

---

## 22. Rejected approaches

Se rechazan explícitamente:

- identidad global de Doctor/Hospital;
- generic Party model;
- Doctor como Customer/User/Technician;
- Hospital como Customer/Company;
- `Doctor.hospitalId` único;
- many-to-many implícito;
- una fila nueva de affiliation en cada reactivación;
- `Doctor.specialty` duplicada en affiliation;
- unique por nombre, email, teléfono o `searchKey`;
- hard delete normal;
- `Cascade`/`SetNull` sobre referencias históricas;
- Doctor/Hospital como free text permanente en Case;
- snapshots en HealthcareCase V1;
- creación silenciosa de affiliation desde Case;
- extensión PostgreSQL introducida sólo por conveniencia;
- Patient, Payer, MedicalSpecialty, Organization/Facility o Contact prematuros;
- índices especulativos sin query conocida;
- locks fuertes para convertir duplicate warning en exclusión.

---

## 23. Deferred decisions

Permanecen deliberadamente fuera de este diseño:

- rutas/DTOs/responses y códigos de error exactos;
- RBAC y permisos por acción;
- UX de warning/override/reactivación;
- importación y reconciliación de duplicados;
- merge administrativo y redirect de identidades;
- audit trail de edits, lifecycle y cambios de Case;
- professional license;
- MedicalSpecialty catalog;
- múltiples Doctors por Case;
- effectiveFrom/effectiveTo en affiliation;
- Hospital organization/facility split;
- contactos hospitalarios múltiples;
- dirección estructurada y coordenadas;
- snapshots para documentos confirmados/legales;
- full-text/trigram search cuando métricas lo justifiquen;
- optimistic version field para master edits;
- política excepcional de borrado por privacidad/retención;
- Doctor/Hospital en Opportunity;
- Customer/Payer relations.

Estas decisiones no bloquean la migración V1 descrita.

---

## 24. Implementation sequence

Slices posteriores recomendados:

1. Prisma schema + migration + migration-level integrity tests.
2. Normalization utility y persistence Services de Doctor/Hospital.
3. Affiliation persistence y concurrencia de unique/P2002.
4. HealthcareCase DTO/Service integration con PATCH semantics y tenant tests.
5. API/RBAC contract.
6. Frontend master-data workflows y Case selectors.
7. Search/duplicate-warning UX y observabilidad de volumen/query cost.

Cada slice debe conservar los límites del Modular Monolith: Healthcare posee
estas reglas; ERP Core no recibe campos médicos específicos.

---

## 25. Validation strategy

La implementación futura debe verificar como mínimo:

### Schema/migration

- Prisma validate/format y generated client;
- migración desde schema actual con Cases existentes;
- rollback sólo en base disposable antes de datos nuevos;
- checks de required strings;
- unique de affiliation;
- query plans básicos para list, duplicate candidates y upcoming Cases.

### Relational integrity on PostgreSQL

- Case A -> Doctor A allowed;
- Case A -> Doctor B rejected por FK;
- Case A -> Hospital A allowed;
- Case A -> Hospital B rejected por FK;
- affiliation Doctor A + Hospital A allowed;
- affiliation Doctor A + Hospital B rejected;
- duplicate affiliation rejected incluso concurrentemente;
- nullable Case relations mantienen filas actuales;
- hard delete de Doctor/Hospital referenciado rejected;
- deactivate conserva relaciones.

### Service behavior

- todas las queries incluyen authenticated `companyId`;
- create/update normaliza display y `searchKey` atómicamente;
- required blank rejected y optional blank -> null;
- nuevos links exigen master activo;
- reschedule/partial update preserva links omitidos;
- Case no exige affiliation ni la crea;
- duplicate warning incluye active/inactive y permite override deliberado;
- affiliation reactiva la misma fila, no crea otra;
- P2002 concurrente de affiliation se traduce a resultado/error estable.

### Regression

- lifecycle `DRAFT/SCHEDULED/CANCELLED` sin cambios;
- Case Status != Readiness;
- folio y responsible User sin cambios;
- existing HealthcareCase indexes conservados;
- tests tenant isolation actuales continúan pasando.

---

## 26. Final proposed schema shape

> **PROPOSED / NOT IMPLEMENTED.** Este pseudo-Prisma documenta la forma
> recomendada. `app/api/prisma/schema.prisma` no fue modificado. Los CHECK de
> strings no vacíos requieren SQL explícito en la migración futura.

```prisma
model Company {
  // Existing fields and relations remain unchanged.

  healthcareDoctors                    HealthcareDoctor[]
  healthcareHospitals                  HealthcareHospital[]
  healthcareDoctorHospitalAffiliations HealthcareDoctorHospitalAffiliation[]
}

model HealthcareDoctor {
  id        String @id @default(uuid())
  companyId String

  firstName String
  lastName  String
  specialty String

  phone String?
  email String?
  notes String?

  searchKey String
  isActive  Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Restrict)

  affiliations HealthcareDoctorHospitalAffiliation[]
  cases        HealthcareCase[]                      @relation("HealthcareCaseDoctor")

  @@unique([id, companyId])
  @@index([companyId, isActive, lastName, firstName])
  @@index([companyId, searchKey])
}

model HealthcareHospital {
  id        String @id @default(uuid())
  companyId String

  name  String
  city  String
  state String

  address     String?
  phone       String?
  email       String?
  contactName String?
  notes       String?

  searchKey String
  isActive  Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Restrict)

  affiliations HealthcareDoctorHospitalAffiliation[]
  cases        HealthcareCase[]                      @relation("HealthcareCaseHospital")

  @@unique([id, companyId])
  @@index([companyId, isActive, name])
  @@index([companyId, state, city])
  @@index([companyId, searchKey])
}

model HealthcareDoctorHospitalAffiliation {
  id         String @id @default(uuid())
  companyId  String
  doctorId   String
  hospitalId String

  isActive Boolean @default(true)
  notes    String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company  Company            @relation(fields: [companyId], references: [id], onDelete: Restrict)
  doctor   HealthcareDoctor   @relation(fields: [doctorId, companyId], references: [id, companyId], onDelete: Restrict)
  hospital HealthcareHospital @relation(fields: [hospitalId, companyId], references: [id, companyId], onDelete: Restrict)

  @@unique([companyId, doctorId, hospitalId])
  @@index([companyId, doctorId, isActive])
  @@index([companyId, hospitalId, isActive])
}

model HealthcareCase {
  // All existing fields and relations remain unchanged.

  doctorId   String?
  hospitalId String?

  healthcareDoctor HealthcareDoctor?   @relation("HealthcareCaseDoctor", fields: [doctorId, companyId], references: [id, companyId], onDelete: Restrict)
  healthcareHospital HealthcareHospital? @relation("HealthcareCaseHospital", fields: [hospitalId, companyId], references: [id, companyId], onDelete: Restrict)

  // Existing uniques/indexes remain unchanged.
  @@index([companyId, doctorId, scheduledStart])
  @@index([companyId, hospitalId, scheduledStart])
}
```

La forma con un mismo `companyId` participando en la relation a Company y en
las FKs compuestas de Doctor/Hospital/Affiliation es válida para Prisma 6.19.3
y produce la invariant SQL deseada. La implementación debe volver a validarla
dentro del schema completo tras integrar inverse relation fields.

---

## 27. Decision summary

| Tema | Decisión V1 |
| --- | --- |
| Model naming | `HealthcareDoctor`, `HealthcareHospital`, `HealthcareDoctorHospitalAffiliation` |
| Identity | UUID estable en los tres modelos |
| Ownership | `companyId` directo en los tres modelos |
| Doctor/Hospital tenant key | `@@unique([id, companyId])` |
| Affiliation | Entidad explícita N:N, opcional, una fila persistente por par |
| Affiliation unique | `[companyId, doctorId, hospitalId]` |
| Lifecycle | `isActive Boolean @default(true)` |
| Normal deletion | No hard delete; deactivate/reactivate |
| Delete actions | `onDelete: Restrict` en relaciones empresariales |
| Case relations | `doctorId?`, `hospitalId?`, FKs compuestas tenant-safe |
| Case scheduling | Sin cambio; puede estar SCHEDULED sin Doctor/Hospital |
| Affiliation requirement for Case | Ninguna; no creación implícita |
| Historical behavior | Referencias preservadas al desactivar |
| Snapshots | No en HealthcareCase V1 |
| Name uniqueness | Ninguna |
| Search | Application-maintained accent/case-normalized `searchKey` |
| PostgreSQL extensions | No en V1 |
| Duplicate handling | Warning + revisión + override deliberado |
| Concurrency | Unique/P2002 para affiliation; duplicate warning permanece advisory |
| Migration | Aditiva, nullable Case FKs, sin backfill |

Este diseño mantiene Healthcare como propietario de la semántica operacional,
aprovecha los patrones de integridad ya presentes y no introduce dependencias
nuevas en ERP Core.
