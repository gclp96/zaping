# Doctors & Hospitals — Technical Design

**Módulo:** Healthcare Doctors & Hospitals

**Producto:** Zaping Healthcare

**Estado:** PARTIALLY IMPLEMENTED — BACKEND IN PROGRESS (C1-C3 MERGED; C4 GATES PASS / PRE-COMMIT)

**Tipo de documento:** Persistence, relational-integrity, API and authorization design

**Fecha:** 2026-09-10

---

## 1. Purpose

Este documento traduce el contrato de dominio aprobado de Doctors & Hospitals
a un diseño concreto de persistencia, integridad, API, DTOs, comportamiento de
Service y autorización para PostgreSQL, Prisma y la arquitectura NestJS actual
de Zaping.

El diseño decide la forma de los modelos, relaciones, invariantes tenant-safe,
lifecycle, constraints, índices, normalización, búsqueda, concurrencia y
migración, además de rutas HTTP, validación, response shapes, semántica de
errores, RBAC de roles fijos e integración API con HealthcareCase. Su objetivo
es permitir que slices posteriores implementen el diseño aprobado sin reabrir
decisiones básicas de arquitectura o contrato.

El documento no implementa por sí mismo el capability. C1-C3 ya materializaron
la persistencia, los backends de Doctor/Hospital y las affiliations en `main`;
C4 implementa en su branch la integración API de HealthcareCase descrita en
Sections 28.10-28.11. Frontend y acceptance permanecen pendientes.

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
- comportamiento histórico, concurrencia y estrategia de migración;
- contrato de rutas HTTP y response shapes para Doctors, Hospitals y
  affiliations;
- contrato de DTOs, validación, normalización y comportamiento de Service;
- matriz RBAC para los roles fijos CURRENT y semántica estable de errores;
- integración API de Doctor/Hospital en HealthcareCase.

No incluye diseño detallado de:

- implementación de componentes, navegación o interacciones frontend;
- presentación UX avanzada de warnings, confirmaciones y lifecycle;
- permission-based RBAC, field-level permissions o roles distintos de los
  cuatro roles fijos CURRENT;
- implementación de Prisma/NestJS, migraciones o tests;
- Patient, Payer, MedicalSpecialty o HospitalContact;
- múltiples Doctors por Case;
- snapshots legales u operacionales e infraestructura de audit trail.

---

## 3. Inputs / source of truth

Fuentes de dominio:

- `docs/modules/healthcare/DOCTORS_HOSPITALS.md` — contrato canónico V1;
- `docs/modules/healthcare/HEALTHCARE.md` — límites de la vertical;
- `docs/modules/healthcare/DOMAIN_MODEL.md` — ownership entre dominios;
- `docs/modules/healthcare/CASES.md` — comportamiento CURRENT de Case,
  incluyendo sus relaciones backend con Doctor/Hospital, y UX TARGET.

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

## 4. Current implementation baseline

El schema CURRENT usa PostgreSQL mediante Prisma 6.19.3. C1 ya incorporó
`HealthcareDoctor`, `HealthcareHospital`,
`HealthcareDoctorHospitalAffiliation`, los scalar FK nullable
`HealthcareCase.doctorId`/`hospitalId` y sus FKs compuestas tenant-safe. C2 y
C3 ya implementaron los backends de master data y affiliations.

Antes de C4, `HealthcareCase` ya contenía:

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

C4 agrega el uso API de las relaciones ya persistidas: create/PATCH aceptan
IDs opcionales, todos los reads/mutations existentes devuelven contexto compacto
y las validaciones same-tenant/active ocurren dentro de la transacción de Case.
No se consulta ni modifica affiliation.

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

Las rutas, DTOs, response shapes, códigos estables de error y la matriz RBAC de
roles fijos ya no están diferidos: su diseño está aprobado en la Sección 28.

Permanecen deliberadamente fuera del diseño V1 o de su implementación inicial:

- presentación e interacciones frontend para warning, confirmación explícita de
  duplicados y reactivación; la semántica API/Service de esos flujos y los
  comandos de lifecycle están aprobados en las Secciones 28.8 y 28.9;
- permission-based RBAC y field-level permissions posteriores a la matriz fija
  aprobada en la Sección 28.13;
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

La dirección de dependencia aprobada se formaliza en el plan ejecutable de la
Sección 29: `HC-NEXT-01C1 -> C2 -> C3 -> C4 -> C5 -> C6 -> C7 -> C8`. Cada
slice tiene alcance, tests, quality gates, stop conditions y estrategia de
recuperación propios. Esta sección ya no funciona como backlog independiente.

Cada slice debe conservar los límites del Modular Monolith: Healthcare posee
estas reglas; ERP Core no recibe campos médicos específicos.

---

## 25. Validation strategy

La implementación por slices debe verificar como mínimo. C1-C4 ya aportan la
evidencia correspondiente a persistencia, backends y Case integration; C5
consolida el hardening/regression restante:

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

> **IMPLEMENTED BY C1.** Este pseudo-Prisma conserva la forma aprobada como
> referencia; `schema.prisma` y la migración C1 son la fuente ejecutable. Los
> CHECK de strings no vacíos se implementaron en SQL explícito.

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

## 27. Persistence decision summary

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
nuevas en ERP Core. Este resumen cubre persistencia e integridad; el contrato
API/DTO/RBAC aprobado se resume separadamente en la Sección 28.21.

---

## 28. API / DTO / Authorization Contract

> **APPROVED DESIGN / IMPLEMENTED THROUGH C4.** C2 implementó Doctors/Hospitals,
> C3 affiliations y C4 la integración API de HealthcareCase. C5 conserva un
> gate posterior de hardening/regression y C6-C8 cubren Web/acceptance.

### 28.1 Scope and status

Esta sección define:

- rutas HTTP de Doctors, Hospitals y affiliations;
- list, search, filtros, paginación y orden estable;
- DTOs de create/update/lifecycle;
- flujo de duplicate warning;
- semántica de Service y lifecycle;
- integración aditiva de Doctor/Hospital en HealthcareCase;
- response shaping;
- RBAC usando los cuatro roles CURRENT;
- tenant isolation y mapping de errores/concurrencia.

No define componentes frontend, permiso granular futuro, OpenAPI codegen,
audit transversal ni implementación Prisma/NestJS.

#### 28.1.1 Current API patterns and decisions

El contrato parte de estos comportamientos CURRENT:

1. Healthcare usa el prefijo `/healthcare`, por ejemplo
   `/healthcare/cases`.
2. Los Controllers se protegen con `JwtAuthGuard`, `RolesGuard` y `@Roles`.
3. `companyId` se obtiene de `AuthenticatedRequest.user`, no de input.
4. IDs modernos usan `ParseUUIDPipe` en path y `@IsUUID()` en DTOs.
5. El `ValidationPipe` global usa `whitelist`, `forbidNonWhitelisted` y
   `transform`; campos no declarados producen 400.
6. Services hacen lookup por `id + companyId` y usan 404 para recurso ausente
   o fuera del tenant.
7. Estados incompatibles y carreras suelen usar 409; datos inválidos usan
   400.
8. Los Controllers devuelven entidades/arrays y Nest asigna 201 a POST y 200 a
   GET/PATCH salvo override.
9. No existe una convención CURRENT de paginación en los módulos revisados.
10. Lifecycle de Customer/Supplier/Product se implementa como cambio de
    `isActive`, aunque algunas rutas legacy usan DELETE. Para este dominio se
    prefieren comandos explícitos conforme ADR-012.
11. P2002 se captura donde existe una unique race relevante; Purchase Receipt
    relee el ganador de una carrera idempotente y Equipment traduce P2002 a
    409.

Donde no existe convención —principalmente paginación y warning no bloqueante—
esta sección define una solución local y pequeña, no un filtering framework
global.

### 28.2 Resource routes

#### 28.2.1 Doctors

| Method | Route | Semántica | Success |
| --- | --- | --- | --- |
| GET | `/healthcare/doctors` | Lista paginada/search/filter. | 200 |
| POST | `/healthcare/doctors` | Evalúa duplicados y crea cuando procede. | 201 created o 200 review required |
| GET | `/healthcare/doctors/:doctorId` | Detail tenant-scoped. | 200 |
| PATCH | `/healthcare/doctors/:doctorId` | Partial update; no lifecycle. | 200 updated o review required |
| POST | `/healthcare/doctors/:doctorId/deactivate` | Desactiva idempotentemente. | 200 |
| POST | `/healthcare/doctors/:doctorId/reactivate` | Reactiva idempotentemente. | 200 |
| GET | `/healthcare/doctors/:doctorId/hospitals` | Affiliations/Hospitals paginados. | 200 |

#### 28.2.2 Hospitals

| Method | Route | Semántica | Success |
| --- | --- | --- | --- |
| GET | `/healthcare/hospitals` | Lista paginada/search/filter. | 200 |
| POST | `/healthcare/hospitals` | Evalúa duplicados y crea cuando procede. | 201 created o 200 review required |
| GET | `/healthcare/hospitals/:hospitalId` | Detail tenant-scoped. | 200 |
| PATCH | `/healthcare/hospitals/:hospitalId` | Partial update; no lifecycle. | 200 updated o review required |
| POST | `/healthcare/hospitals/:hospitalId/deactivate` | Desactiva idempotentemente. | 200 |
| POST | `/healthcare/hospitals/:hospitalId/reactivate` | Reactiva idempotentemente. | 200 |
| GET | `/healthcare/hospitals/:hospitalId/doctors` | Affiliations/Doctors paginados. | 200 |

#### 28.2.3 Affiliations

| Method | Route | Semántica | Success |
| --- | --- | --- | --- |
| POST | `/healthcare/doctor-hospital-affiliations` | Crea un link nuevo entre masters activos. | 201 |
| PATCH | `/healthcare/doctor-hospital-affiliations/:affiliationId` | Edita únicamente notes. | 200 |
| POST | `/healthcare/doctor-hospital-affiliations/:affiliationId/deactivate` | “Unlink” lógico idempotente. | 200 |
| POST | `/healthcare/doctor-hospital-affiliations/:affiliationId/reactivate` | Reactiva explícitamente. | 200 |

No se expone `DELETE`, un top-level list redundante ni rutas nested de mutation.
Las dos rutas nested GET cubren los access paths operacionales; las mutations
usan el recurso affiliation canónico y su ID.

Todo `:doctorId`, `:hospitalId` y `:affiliationId` usa `ParseUUIDPipe`.

### 28.3 Doctor endpoints and service behavior

#### List

El Service construye un filtro que siempre incluye authenticated `companyId`,
aplica status/search y ejecuta count + page query. No carga Cases ni la lista
de affiliations.

#### Detail

Busca por `id + companyId`, incluyendo active o inactive. Devuelve core fields
y un resumen de affiliations, no el grafo completo ni Cases.

```json
{
  "id": "uuid",
  "companyId": "uuid",
  "firstName": "Juan",
  "lastName": "Pérez",
  "specialty": "Cardiología",
  "phone": null,
  "email": null,
  "notes": null,
  "isActive": true,
  "createdAt": "2026-09-10T00:00:00.000Z",
  "updatedAt": "2026-09-10T00:00:00.000Z",
  "affiliationSummary": {
    "active": 2,
    "total": 3
  }
}
```

`active` significa effective active: affiliation, Doctor y counterpart
Hospital activos. `total` incluye relaciones históricas.

#### Create/update

Orden del Service:

1. recibir `companyId` autenticado;
2. normalizar input;
3. validar campos después de normalización;
4. calcular `searchKey` server-side;
5. buscar duplicate candidates del mismo tenant;
6. devolver review result sin write si falta confirmación;
7. crear/actualizar y devolver response shape explícito.

Update primero carga por `id + companyId`, conserva campos omitidos, excluye el
propio ID al buscar duplicados y actualiza con predicate tenant-scoped.

### 28.4 Hospital endpoints and service behavior

Hospital sigue el mismo flujo que Doctor. Detail incluye core fields y:

```json
{
  "affiliationSummary": {
    "active": 4,
    "total": 5
  }
}
```

No incluye Doctors completos ni Cases. La lista nested correspondiente es la
fuente para recorrer affiliations.

Hospital list puede filtrar por city/state, pero no crea una abstracción de
address ni Organization/Facility.

### 28.5 Affiliation endpoints

Affiliation mutations use the top-level canonical resource routes in 28.2.3;
the two nested GET routes provide the directional lists. There is no duplicate
top-level list or nested mutation surface.

PATCH permite solamente corregir `notes` y funciona sobre affiliations activas
o inactivas; no cambia Doctor, Hospital ni lifecycle. Omitted/no fields devuelve
el recurso actual sin write y explicit null limpia notes. Detailed link and
lifecycle behavior appears in 28.9.1.

### 28.6 List and search contracts

#### 28.6.1 Common query contract

```text
status   ACTIVE | INACTIVE | ALL   default ACTIVE
search   normalized length 1..100  optional
page     integer >= 1              default 1
pageSize integer 1..100            default 25
```

Si `search` se envía vacío después de trim, devuelve 400; omitirlo significa
sin filtro. Se permiten términos de un carácter porque los catálogos son
tenant-scoped y la página está acotada. No se introduce ranking.

El query DTO usa `@Type(() => Number)`, `@IsInt()` y bounds explícitos para
page/pageSize; status usa un string enum de API, no un Prisma enum nuevo.

Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

`page > totalPages` devuelve 200 con `items: []`; no es error.

#### 28.6.2 Stable sorting

No se expone sort arbitrario en V1.

Doctor:

```text
lastName ASC, firstName ASC, id ASC
```

Hospital:

```text
name ASC, city ASC, id ASC
```

Affiliated Hospitals:

```text
hospital.name ASC, hospital.city ASC, affiliation.id ASC
```

Affiliated Doctors:

```text
doctor.lastName ASC, doctor.firstName ASC, affiliation.id ASC
```

El ID final evita que empates cambien de página entre lecturas estables.

#### 28.6.3 Hospital location filters

Hospital añade:

```text
city?  normalized length 1..100
state? normalized length 1..100
```

Son equality filters case-insensitive dentro de Company. Accent-insensitive se
garantiza para `search` mediante `searchKey`; para city/state exactos se difiere
hasta existir normalized per-field keys o una estrategia PostgreSQL aprobada.

#### 28.6.4 Nested affiliation lists

Usan `status`, `search`, `page` y `pageSize`. Aquí status es efectivo:

- `ACTIVE`: affiliation y ambos masters activos;
- `INACTIVE`: al menos una de esas tres partes está inactiva;
- `ALL`: todas las filas históricas.

Cada item incluye affiliation fields y un compact counterpart; no incluye
notes/contact data del counterpart más allá de lo necesario para identificarlo.

### 28.7 Create/update DTOs

#### 28.7.1 Normalization before validation

Los DTOs aplican transforms locales antes de `class-validator`:

- required string: trim + collapse whitespace;
- optional string: conservar `undefined`, convertir `null`/blank a `null`, y
  normalizar texto no vacío;
- email: trim + lowercase antes de `@IsEmail()`;
- phone: trim + collapse whitespace sin eliminar `+`, punctuation o extension.

El Service repite las invariantes críticas y calcula `searchKey`; no confía en
un valor derivado por Controller/cliente.

#### 28.7.2 CreateDoctorDto

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `firstName` | string | yes | post-trim non-empty, max 100 |
| `lastName` | string | yes | post-trim non-empty, max 100 |
| `specialty` | string | yes | post-trim non-empty, max 150 |
| `phone` | string/null | no | blank -> null, max 30 |
| `email` | string/null | no | blank -> null, valid email, max 254 |
| `notes` | string/null | no | blank -> null, max 1000 |
| `confirmPossibleDuplicate` | boolean | no | default false; workflow-only |

No se aceptan `id`, `companyId`, `searchKey`, `isActive`, `createdAt` ni
`updatedAt`.

#### 28.7.3 UpdateDoctorDto

Todos los user-editable fields son opcionales. Debe declararse explícitamente,
no heredar ciegamente `PartialType(CreateDoctorDto)`, porque:

- omitted significa unchanged;
- `firstName`, `lastName` y `specialty` rechazan explicit `null`, blank y tipo
  no string;
- `phone`, `email` y `notes` aceptan explicit `null` para clear;
- `confirmPossibleDuplicate` sólo controla el update actual;
- protected fields siguen rechazados por el ValidationPipe.

Si no queda ningún field editable definido, el Service devuelve 200 con el
recurso actual y no escribe.

#### 28.7.4 CreateHospitalDto

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `name` | string | yes | post-trim non-empty, max 150 |
| `city` | string | yes | post-trim non-empty, max 100 |
| `state` | string | yes | post-trim non-empty, max 100 |
| `address` | string/null | no | blank -> null, max 250 |
| `phone` | string/null | no | blank -> null, max 30 |
| `email` | string/null | no | blank -> null, valid email, max 254 |
| `contactName` | string/null | no | blank -> null, max 150 |
| `notes` | string/null | no | blank -> null, max 1000 |
| `confirmPossibleDuplicate` | boolean | no | default false; workflow-only |

No se aceptan protected/internal fields.

#### 28.7.5 UpdateHospitalDto

Usa las mismas longitudes. `name`, `city` y `state` son optional en PATCH pero
no nullable; los demás campos editables pueden limpiarse con `null`. Omitted
preserva. Se recomienda DTO explícito por la misma razón que Doctor.

#### 28.7.6 Affiliation DTOs

Create:

```text
doctorId   UUID required
hospitalId UUID required
notes      string|null optional, max 1000
```

Update:

```text
notes string|null optional, max 1000
```

Update no acepta doctorId/hospitalId. Cambiar la pareja significa conservar o
desactivar la relation anterior y crear otra mediante acciones explícitas.

Lifecycle commands no requieren body en V1.

### 28.8 Duplicate-warning flow

Se elige una variante simple de create/update con confirmación explícita; no se
crea un endpoint duplicate-check separado que pueda quedar desacoplado del
write.

#### First attempt

Cuando `confirmPossibleDuplicate` está ausente/false y existen candidatos:

- no se persiste ningún cambio;
- no se devuelve 409 porque similitud no es una constraint ni un conflicto de
  identidad probado;
- se devuelve HTTP 200 con resultado discriminado.

Doctor example:

```json
{
  "outcome": "DUPLICATE_REVIEW_REQUIRED",
  "resourceType": "DOCTOR",
  "candidates": [
    {
      "id": "uuid",
      "firstName": "José",
      "lastName": "Pérez",
      "specialty": "Cardiología",
      "phone": null,
      "email": null,
      "isActive": false
    }
  ]
}
```

Hospital candidates incluyen `id`, `name`, `city`, `state`, `address` e
`isActive`, nunca notes/searchKey/company data ajena.

#### Confirmed attempt

El cliente reenvía el mismo create/update con:

```json
{ "confirmPossibleDuplicate": true }
```

El Service vuelve a normalizar y consultar, pero la coincidencia advisory ya no
bloquea. Create devuelve:

```text
201 { outcome: "CREATED", data: ResourceResponse }
```

Update devuelve:

```text
200 { outcome: "UPDATED", data: ResourceResponse }
```

Cuando no hay candidates, la primera request devuelve directamente CREATED o
UPDATED con la misma envelope. El flag no se persiste.

El warning aplica a create y a updates que cambian identity fields. Update
excluye el registro actual. Contact data puede reforzar el orden de candidatos,
pero no cambia la regla de confirmación ni crea unicidad.

No se emite token de confirmación en V1. Dado que duplicados deliberados están
permitidos, un candidato concurrente nuevo no invalida una confirmación.

### 28.9 Lifecycle commands

Doctor, Hospital y affiliation exponen `POST /:id/deactivate` y
`POST /:id/reactivate`.

Semántica:

- lookup siempre por `id + companyId`;
- repeated deactivate de inactive devuelve 200 con estado actual;
- repeated reactivate de active devuelve 200 con estado actual;
- una transición real usa `updateMany` con `companyId` y estado esperado;
- si pierde una carrera, relee y devuelve el estado terminal solicitado cuando
  ya coincide; de otro modo responde 409 concurrent modification;
- no cambia ni elimina HealthcareCases históricos;
- no modifica automáticamente affiliations al desactivar Doctor/Hospital;
- reactivar Doctor/Hospital no reactiva affiliations explícitamente inactivas;
- reactivar un master existente no exige duplicate confirmation: el usuario ya
  seleccionó deliberadamente esa identidad persistente.

Affiliation reactivate requiere Doctor y Hospital activos. Si alguno está
inactivo, devuelve 409 `AFFILIATION_ENDPOINT_INACTIVE`. Deactivate sí puede
ejecutarse aunque un endpoint master ya esté inactivo.

“Unlink” significa deactivate. No existe normal hard delete.

#### 28.9.1 Affiliation link and lifecycle behavior

#### Link

`POST /healthcare/doctor-hospital-affiliations` ejecuta en una transacción:

1. valida Doctor por `doctorId + companyId` e `isActive = true`;
2. valida Hospital por `hospitalId + companyId` e `isActive = true`;
3. busca el pair persistente del tenant;
4. si no existe, crea y devuelve 201;
5. si existe active y ambos masters están activos, devuelve 409
   `AFFILIATION_ALREADY_ACTIVE` con su ID;
6. si existe inactive, devuelve 409 `AFFILIATION_INACTIVE` con su ID y exige
   el comando reactivate;
7. si la fila está active pero un endpoint quedó inactive, devuelve 409
   `AFFILIATION_ENDPOINT_INACTIVE`.

Link nunca reactiva silenciosamente y nunca crea affiliation desde Case.

#### Exact duplicate race

Si dos creates pasan el pre-check, la unique
`[companyId, doctorId, hospitalId]` decide. El loser captura únicamente el
P2002 de esa constraint, relee el pair tenant-scoped y devuelve el mismo 409
estable que habría producido el pre-check. Otros P2002 se propagan al mapper
interno y nunca se exponen raw.

#### Nested list item

```json
{
  "id": "affiliation-uuid",
  "companyId": "company-uuid",
  "doctorId": "doctor-uuid",
  "hospitalId": "hospital-uuid",
  "isActive": true,
  "notes": null,
  "createdAt": "2026-09-10T00:00:00.000Z",
  "updatedAt": "2026-09-10T00:00:00.000Z",
  "hospital": {
    "id": "hospital-uuid",
    "name": "Hospital Central",
    "city": "Hermosillo",
    "state": "Sonora",
    "isActive": true
  }
}
```

La ruta inversa sustituye `hospital` por compact `doctor`.

### 28.10 HealthcareCase DTO integration

#### CreateHealthcareCaseDto

Se agregan de forma opcional:

```text
doctorId?   UUID | null
hospitalId? UUID | null
```

- omitted o null: no relation;
- non-null: master del mismo `companyId` y active required;
- Doctor y Hospital se validan independientemente;
- no se valida affiliation entre ambos;
- no se crea/reactiva affiliation;
- no cambia la derivación DRAFT/SCHEDULED.

#### UpdateHealthcareCaseDto

Por cada campo:

```text
omitted            -> preserve current relation
explicit null      -> clear relation
different non-null -> validate same-Company + active, then replace
same current ID    -> treat as unchanged and allow even if now inactive
```

Se elige “same current ID = unchanged” porque formularios pueden reenviar el
estado completo. Rechazarlo por una desactivación posterior rompería una
edición no relacionada y contradiría la preservación histórica. La comparación
con el valor actual ocurre antes de validar active.

Si current es null, cualquier non-null es selección nueva. Si current es otro
ID, el replacement requiere active aunque el anterior esté inactive. La regla
se aplica por separado a Doctor y Hospital.

El Controller debe conservar presencia de property, como ya hace con
responsibleUserId, para no confundir omitted con null. `companyId`, status,
searchKey y affiliation nunca se aceptan en Case DTO.

La validación relacional y el update se ejecutan en la transacción existente.
Un Case CANCELLED continúa rechazando update antes de cambiar relaciones.

### 28.11 HealthcareCase response integration

Todas las respuestas actuales de Case conservan sus fields y agregan:

```json
{
  "doctorId": null,
  "hospitalId": null,
  "doctor": null,
  "hospital": null
}
```

Cuando existen relaciones, se usan objetos compactos:

```json
{
  "doctor": {
    "id": "uuid",
    "firstName": "Juan",
    "lastName": "Pérez",
    "specialty": "Cardiología",
    "isActive": false
  },
  "hospital": {
    "id": "uuid",
    "name": "Hospital Central",
    "city": "Hermosillo",
    "state": "Sonora",
    "isActive": true
  }
}
```

Create, list, detail, update y cancel usan explicit Prisma `select/include`
compartido para producir esta forma sin N+1. No incluyen contact data, notes,
affiliations, Cases inversos ni searchKey. Mostrar `isActive` permite distinguir
una referencia histórica. Cancel conserva sin cambios su DTO, validaciones,
lifecycle y audit; únicamente devuelve la misma forma Case enriquecida.

### 28.12 Tenant isolation

Reglas obligatorias para todos los handlers:

- `companyId` deriva exclusivamente del JWT/authenticated User;
- body y query que intenten incluir companyId se rechazan por whitelist;
- list/search/count/duplicate candidates se filtran por companyId;
- detail/update/lifecycle usan `id + companyId`;
- affiliation valida ambos endpoints dentro del mismo companyId;
- Case valida Doctor/Hospital por `id + companyId`;
- compact relations y counts nunca cruzan tenant;
- la FK compuesta es la defensa final ante bugs o carreras.

Un ID inexistente y un ID de otra Company producen el mismo 404. No se usa 403
para indicar que el recurso existe en otro tenant. El Service no realiza un
lookup global para distinguirlos.

Un recurso same-tenant inactive sí puede producir un error específico porque
su existencia ya es visible al usuario autorizado dentro del tenant.

### 28.13 RBAC matrix

Todos los Controllers nuevos usan `@UseGuards(JwtAuthGuard, RolesGuard)` y
metadata `@Roles` explícita por handler. No se crea otro sistema de permisos.

| Capability | ADMIN | MANAGER | SALES | WAREHOUSE |
| --- | --- | --- | --- | --- |
| Doctor list/detail | allow | allow | allow | allow |
| Doctor create/edit | allow | allow | allow | deny |
| Doctor deactivate/reactivate | allow | allow | deny | deny |
| Hospital list/detail | allow | allow | allow | allow |
| Hospital create/edit | allow | allow | allow | deny |
| Hospital deactivate/reactivate | allow | allow | deny | deny |
| Affiliation nested lists | allow | allow | allow | allow |
| Affiliation link/edit notes | allow | allow | allow | deny |
| Affiliation deactivate/reactivate | allow | allow | deny | deny |
| Case read + Doctor/Hospital context | allow | allow | allow | allow |
| Case assign/change/clear Doctor/Hospital | allow | allow | allow | deny |

Justificación:

- ADMIN/MANAGER administran master data y lifecycle.
- SALES ya crea/edita Customers, Quotes, Sales y HealthcareCases; capturar
  Doctors/Hospitals y relacionarlos es parte del workflow comercial/operacional.
- Lifecycle puede afectar selectores y operación de otros usuarios, por lo que
  SALES no lo administra en V1.
- WAREHOUSE necesita leer contexto de Case, Doctor, Hospital y affiliations,
  pero sus writes CURRENT están concentrados en Suppliers, Purchases/Receipts,
  Inventory y Equipment. No recibe master-data Healthcare writes por defecto.
- Assignment sigue el permiso CURRENT de Case update:
  ADMIN/MANAGER/SALES. WAREHOUSE conserva read sin ampliar mutation.

Duplicate candidates requieren el mismo permiso de create/edit que inició la
operación. No existe endpoint público de candidatos.

La implementación debe ampliar el role-matrix test con cada handler y pruebas
representativas reales a través de RolesGuard.

### 28.14 HTTP and error semantics

Los errores nuevos deben usar Nest HTTP exceptions sin exponer Prisma. Cuando
el cliente necesita branching, el body conserva la forma Nest y agrega `code`:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "code": "DOCTOR_INACTIVE",
  "message": "El doctor está inactivo"
}
```

| Scenario | HTTP | Stable code/behavior |
| --- | --- | --- |
| Missing/foreign Doctor | 404 | `DOCTOR_NOT_FOUND` |
| Missing/foreign Hospital | 404 | `HOSPITAL_NOT_FOUND` |
| Missing/foreign affiliation | 404 | `AFFILIATION_NOT_FOUND` |
| Missing/foreign Case | 404 | Existing Case not-found semantics; no tenant distinction |
| Doctor selected inactive | 409 | `DOCTOR_INACTIVE` |
| Hospital selected inactive | 409 | `HOSPITAL_INACTIVE` |
| Probable duplicate | 200 | `outcome=DUPLICATE_REVIEW_REQUIRED`; no write |
| Exact active affiliation | 409 | `AFFILIATION_ALREADY_ACTIVE` |
| Existing inactive pair on link | 409 | `AFFILIATION_INACTIVE`; explicit reactivate required |
| Reactivate affiliation with inactive endpoint | 409 | `AFFILIATION_ENDPOINT_INACTIVE` |
| Invalid lifecycle/concurrent state | 409 | `RESOURCE_STATE_CHANGED` unless idempotent terminal state reached |
| Invalid email/type/length/query | 400 | ValidationPipe messages |
| Blank required after normalization | 400 | field-specific validation message |
| Malformed path UUID | 400 | `ParseUUIDPipe` convention |
| Malformed body UUID | 400 | `@IsUUID()` convention |
| Unauthorized role | 403 | RolesGuard; no resource lookup |
| Unauthenticated/invalid session | 401 | JwtAuthGuard |
| Affiliation P2002 race | 409 | Re-read and map to stable affiliation code |
| FK/P2003 race | 409 | `RELATED_RESOURCE_CHANGED`; retry/reload |
| P2025/update count zero | 404 if absent; otherwise 409 after scoped re-read | Never raw Prisma |

`details` puede incluir el same-tenant `affiliationId` en exact-pair conflicts y
compact candidate objects en duplicate review. Nunca incluye foreign IDs,
queries o database constraint names.

### 28.15 Normalization boundary and search

Public requests nunca aceptan ni devuelven `searchKey`.

Doctor `search` consulta el key derivado de:

```text
firstName + lastName + specialty
```

Hospital `search` consulta:

```text
name + city + state
```

El server normaliza query y campos con la misma función aprobada en la sección
15. Los términos normalizados se aplican con AND sobre `searchKey`; no hay
ranking, fuzzy matching ni auto-merge.

Create/update calculan display values y searchKey en la misma write. El mapper
de persistencia usa una allowlist explícita para impedir mass assignment de
`companyId`, `searchKey`, `isActive` o timestamps.

### 28.16 Response shaping

Se usan response selects/mappers explícitos; no se serializa un model Prisma
sin control.

#### Public/read-only fields

- `companyId` permanece en full resource y affiliation responses porque los
  recursos CURRENT de Zaping normalmente lo devuelven. Es read-only y siempre
  coincide con el tenant autenticado.
- `searchKey` nunca se devuelve.
- `createdAt`/`updatedAt` se devuelven como ISO-8601.
- `isActive` se devuelve para contexto histórico.
- list items omiten notes y affiliation graph.
- detail incluye notes y affiliation counts, no full graph.
- compact Case relations omiten companyId/contact/notes porque heredan el
  contexto del Case.

Doctor list item incluye id, companyId, name fields, specialty, phone, email,
isActive y timestamps. Hospital list item incluye id, companyId, name,
city/state, address/contact fields, isActive y timestamps. Notes aparece sólo
en detail.

### 28.17 Concurrency behavior

#### Affiliation duplicate race

La unique compuesta es autoridad. Capturar P2002 sólo si `meta.target`
corresponde a Company+Doctor+Hospital, releer por esa key y devolver el conflicto
estable. No tratar cualquier P2002 como affiliation duplicate.

#### Lifecycle race

Usar conditional `updateMany` con estado esperado. Si count=0, releer
tenant-scoped:

- estado solicitado alcanzado: devolver 200 idempotente;
- recurso desaparecido/foreign: 404;
- otro cambio relevante: 409 `RESOURCE_STATE_CHANGED`.

#### Duplicate-warning create race

Permanece advisory. Dos requests pueden crear dos Doctors/Hospitals similares;
no se agrega lock ni unique por searchKey. `confirmPossibleDuplicate=true`
autoriza crear con los candidatos existentes al momento del write.

#### Case assignment vs deactivate

El Service valida active dentro de la Case transaction. Si assignment leyó
active antes de deactivate, el estado final Case -> inactive master sigue siendo
históricamente válido; se lineariza como assignment anterior. Si deactivate ya
es visible, la selección falla 409. No se usa FK contra `isActive`.

Una FK race excepcional se mapea a `RELATED_RESOURCE_CHANGED`; raw P2003 no
llega al cliente.

### 28.18 Security and privacy

- Notes son exclusivamente operacionales y no deben almacenar PHI, diagnósticos
  ni historia clínica.
- Mensajes, labels y documentación de UI futura deben reforzar ese límite.
- Search y duplicate warning sólo consultan el tenant autenticado.
- Candidatos omiten notes y campos internos.
- Relation lookup no confirma existencia cross-tenant.
- WAREHOUSE read no implica mutation.
- SALES write no implica lifecycle.
- Role denial ocurre antes de consultas de negocio.
- Logs no deben registrar notes, emails o phones completos salvo política
  explícita de redacción/seguridad.

### 28.19 Backward compatibility

HealthcareCase cambia aditivamente:

- request fields nuevos son opcionales;
- requests existentes continúan válidos;
- rows existentes producen doctorId/hospitalId y compact relations como null;
- fields y semántica CURRENT se conservan;
- no cambia status, readiness, folio, schedule, cancellation ni responsible
  User;
- JSON clients tolerantes a fields adicionales continúan funcionando.

La implementación debe actualizar tipos de consumidores internos antes de
depender de los objetos compactos. Si un consumidor valida respuestas con
`additionalProperties: false`, debe desplegarse compatible antes o junto con el
backend. No se versiona la ruta sólo por fields nullable aditivos.

Doctors/Hospitals son recursos nuevos y no tienen compatibilidad legacy. Sus
lists usan envelope paginada desde el primer release para evitar un breaking
change posterior desde array sin paginar.

### 28.20 Deferred API decisions

Permanecen fuera de V1:

- permission-based RBAC distinto de los roles fijos;
- bulk import endpoints;
- merge/redirect de duplicados;
- duplicate confirmation token;
- audit event response/history endpoints;
- hard-delete/privacy administration;
- arbitrary sort/filter DSL;
- cursor pagination;
- full-text/fuzzy/ranked search;
- Doctor/Hospital 360 y Case history embebida;
- effective dates de affiliation;
- múltiples Doctors por Case;
- Opportunity/Customer/Payer links;
- field-level permissions;
- idempotency keys para estas master-data mutations;
- ETag/If-Match u optimistic version fields;
- external/public Doctor or Hospital directories.

### 28.21 API decision summary

| Topic | V1 contract |
| --- | --- |
| Contract status | APPROVED DESIGN; backend implemented through C4, C5 hardening pending |
| Base routes | `/healthcare/doctors`, `/healthcare/hospitals`, `/healthcare/doctor-hospital-affiliations` |
| IDs | UUID; ParseUUIDPipe/path and IsUUID/body |
| Lists | page/pageSize, status, search; fixed stable order |
| Default status | ACTIVE |
| Page defaults | page 1, pageSize 25, max 100 |
| Search | server-normalized searchKey, 1..100, no ranking |
| Detail graph | Core fields + affiliation counts only |
| DTO semantics | Trim/normalize, reject protected fields, omitted PATCH fields preserve, nullable fields accept explicit null |
| Duplicate warning | 200 discriminated no-write result, then explicit confirm flag |
| Exact affiliation duplicate | 409 stable code; no duplicate row |
| Lifecycle | Explicit POST commands, idempotent repeated target state |
| Generic PATCH | Never accepts isActive/companyId/searchKey |
| Affiliation API | Explicit link, notes update, deactivate/reactivate and directional lists; never DELETE |
| Affiliation unlink | Deactivate, never DELETE |
| Case same inactive ID | Treated as unchanged and allowed |
| Case replacement | Same-Company active master required |
| Case affiliation | Not required and never auto-created |
| Case response | Nullable IDs + compact Doctor/Hospital objects |
| Tenant not-found | Foreign and absent are indistinguishable 404 |
| Stable errors | Machine-readable codes for state/conflict branches; Prisma errors never exposed raw |
| Fixed-role RBAC | ADMIN/MANAGER full; SALES read/create/edit/link/assign without lifecycle; WAREHOUSE read only |
| ADMIN/MANAGER | Full V1 management |
| SALES | Read, create/edit/link, Case assignment; no lifecycle |
| WAREHOUSE | Read/context only; no Healthcare master mutations |
| Internal fields | searchKey hidden; companyId read-only |
| Prisma errors | Mapped; never exposed raw |

Este contrato conserva los permisos CURRENT de HealthcareCase, permite que
SALES capture el contexto médico-operacional sin concederle lifecycle y da a
WAREHOUSE el contexto necesario sin ampliar sus mutaciones. C1-C3 ya
implementaron y fusionaron persistencia, Doctors/Hospitals, duplicate review,
lifecycle, fixed-role RBAC y affiliation backend. C4 implementa y valida en el
branch actual la integración backend de HealthcareCase; permanece PRE-COMMIT y
todavía no está merged. C5 mantiene pendiente el hardening/regression backend;
C6 implementará frontend master data, C7 selectors/duplicate-review UX y C8 la
acceptance integrada. Permission-based RBAC permanece diferido.

---

## 29. Implementation Plan & Quality Gates

> **APPROVED IMPLEMENTATION PLAN / C4 GATES PASS — PRE-COMMIT.** Esta sección descompone el
> diseño aprobado en slices implementables. C1-C3 están integrados en `main` y
> C4 implementa la integración API de HealthcareCase en su branch, pendiente
> de commit/review/merge. C5-C8 permanecen sin implementar.

### 29.1 Planning rules and gate model

La implementación avanza en ocho slices secuenciales y revisables. Cada slice
parte del predecessor merged y green, limita su diff al alcance declarado y
puede revertirse sin arrastrar trabajo no relacionado. Un gate verde de un
slice anterior no sustituye los gates focales ni de regresión del siguiente.

El modelo obligatorio para cada slice es:

| Gate | Requirement |
| --- | --- |
| ENTRY | Dependencias merged; branch limpia; contrato aplicable todavía vigente; herramientas y entorno requeridos disponibles. |
| IMPLEMENT | Sólo el comportamiento aprobado para el slice; ningún capability futuro incidental. |
| FOCAL TESTS | Tests nuevos o ajustados prueban el comportamiento cambiado y fallarían si se elimina la implementación. |
| REGRESSION | Suites de módulos afectados y contratos preexistentes permanecen verdes. |
| QUALITY | Lint sin autofix, typecheck, tests y build según las capas tocadas. |
| SECURITY | Tenant isolation, roles y campos protegidos se verifican en el boundary real, no sólo leyendo metadata. |
| REVIEW | `git diff --check`, revisión del diff completo, migraciones y generated artifacts cuando apliquen. |
| COMMIT | Sólo después de PASS; un commit/PR no debe mezclar el siguiente slice. |
| NEXT | El siguiente slice no inicia con findings bloqueantes, gates rojos o evidencia incompleta. |

Los comandos se ejecutan desde `app/api` o `web`, no desde el package raíz. En
API se usa `npm run lint:check`; `npm run lint` contiene `--fix` y no es un gate
read-only. Para Web, la suite completa usa un worker para mantener la estrategia
estable del repositorio.

Comandos base, además de los focales de cada slice:

```text
# app/api
npm run lint:check
npm run typecheck
npm test -- --runInBand
npm run build

# web
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run build

# repository
git diff --check
```

Los tests E2E o de migración que requieren PostgreSQL sólo se ejecutan contra
una base explícitamente disposable. Ningún slice autoriza reset, limpieza o
pruebas destructivas sobre datos locales compartidos, QA o producción.

### 29.2 Dependency chain and review units

```text
HC-NEXT-01C1
  -> HC-NEXT-01C2
    -> HC-NEXT-01C3
      -> HC-NEXT-01C4
        -> HC-NEXT-01C5
          -> HC-NEXT-01C6
            -> HC-NEXT-01C7
              -> HC-NEXT-01C8
```

| Slice | Reviewable outcome | Direct dependency |
| --- | --- | --- |
| HC-NEXT-01C1 | Schema, migration and database integrity | Approved Sections 1-28 |
| HC-NEXT-01C2 | Doctor/Hospital backend | C1 merged and green |
| HC-NEXT-01C3 | Affiliation backend | C2 merged and green |
| HC-NEXT-01C4 | HealthcareCase integration | C3 merged and green |
| HC-NEXT-01C5 | Backend hardening/regression | C4 merged and green |
| HC-NEXT-01C6 | Doctor/Hospital master-data frontend | C5 merged and green |
| HC-NEXT-01C7 | Case selectors and duplicate-review UX | C6 merged and green |
| HC-NEXT-01C8 | Integrated automated/manual acceptance | C7 merged and green |

Estado de ejecución al 2026-09-11:

| Slice | Current status |
| --- | --- |
| HC-NEXT-01C1 | COMPLETED / MERGED |
| HC-NEXT-01C2 | COMPLETED / MERGED |
| HC-NEXT-01C3 | COMPLETED / MERGED |
| HC-NEXT-01C4 | IMPLEMENTED / VALIDATED / PRE-COMMIT — current branch, not merged |
| HC-NEXT-01C5 | NEXT |
| HC-NEXT-01C6 | NOT STARTED / NOT IMPLEMENTED |
| HC-NEXT-01C7 | NOT STARTED / NOT IMPLEMENTED |
| HC-NEXT-01C8 | NOT STARTED / NOT IMPLEMENTED |

No se omiten dependencias por comodidad. Puede prepararse un branch apilado
mientras el predecessor está en review, pero no se mezcla ni se declara green
fuera de orden.

### 29.3 HC-NEXT-01C1 — Prisma Schema, Migration & Relational Integrity

#### Objective, dependencies and scope

Implementar exclusivamente la persistencia aprobada. ENTRY exige Sections
1-28 aprobadas, schema CURRENT verificado, working tree limpio y una
`DATABASE_URL` disposable identificada inequívocamente.

Expected code areas:

- `app/api/prisma/schema.prisma`;
- una nueva carpeta en `app/api/prisma/migrations/` con SQL revisable;
- tests de integración/migración en `app/api/test/` y utilidades estrictamente
  necesarias para ejecutarlos;
- Prisma Client generado sólo por el comando de generación; generated output
  se versiona únicamente si ya es convención del repositorio.

IMPLEMENT incluye:

- `HealthcareDoctor`, `HealthcareHospital` y
  `HealthcareDoctorHospitalAffiliation`;
- inverse relations en Company;
- `doctorId`/`hospitalId` nullable e inverse relations en HealthcareCase;
- UUID, `companyId`, `@@unique([id, companyId])`, `searchKey`, `isActive` y
  timestamps de Doctor/Hospital;
- unique `[companyId, doctorId, hospitalId]`, las dos FKs compuestas tenant-safe
  y `ON DELETE RESTRICT` de affiliation;
- FKs compuestas nullable e índices aprobados de HealthcareCase;
- CHECK SQL con `btrim(...) <> ''` para campos required y `searchKey`;
- migración aditiva sin backfill.

Forbidden scope:

- módulos NestJS, DTOs, controllers, Services o permisos;
- endpoints o frontend;
- seeds/fixtures productivos;
- backfill especulativo, hard delete, extensión PostgreSQL o cambio de
  HealthcareCaseStatus.

#### Tests and gates

FOCAL TESTS deben demostrar en PostgreSQL real:

- create válido de Doctor y Hospital con UUID/companyId;
- rechazo de required strings blank por CHECK, incluso fuera de la API;
- affiliation same-tenant válida y exact pair duplicado rechazado;
- cada FK cross-tenant de affiliation rechazada;
- Case nullable válido y rows preexistentes válidas sin backfill;
- Case same-tenant Doctor/Hospital válido y cada FK cross-tenant rechazada;
- `RESTRICT` impide hard delete de masters referenciados;
- índices, uniques y FK names/acciones coinciden con el SQL revisado.

REGRESSION/QUALITY:

```text
npx prisma format
npx prisma validate
npx prisma generate
npm run lint:check
npm run typecheck
npm test -- --runInBand
npm run build
```

Además, en bases desechables separadas:

1. confirmar de forma explícita la `DATABASE_URL` desechable y ejecutar
   `npx prisma migrate reset --force` para desplegar la chain desde vacío;
2. crear otra base con el schema CURRENT y HealthcareCases existentes, luego
   ejecutar `npm run prisma:migrate:deploy` para aplicar la nueva migración;
3. ejecutar los tests de integridad;
4. revisar `migration.sql` manualmente antes de merge.

SECURITY pasa sólo si la base, no únicamente Prisma Service, impide relaciones
cross-company. REVIEW incluye diff de schema + SQL, ausencia de cambios
destructivos y `git diff --check`.

#### Completion, recovery and STOP

Complete cuando la cadena limpia y el upgrade con datos CURRENT pasan, Prisma
validate/generate y API regression están verdes, y toda invariant tenant-safe
tiene test positivo y negativo. El commit contiene sólo persistencia y tests de
integridad.

Recovery: antes de merge puede corregirse/recrearse la nueva migración en la DB
disposable. Una vez aplicada en un entorno compartido, no se reescribe historia:
se usa una migración forward corrective. Revertir código no debe asumir que
pueden eliminarse tablas/columnas con datos; el schema es aditivo y tolerado por
el backend anterior.

**C1 STOP** si Prisma validate/generate falla, la chain no parte desde main,
aparece SQL destructivo inesperado, se requiere backfill no aprobado, una FK
cross-tenant puede persistirse, una row CURRENT queda inválida o el target de
reset no es demostrablemente disposable.

### 29.4 HC-NEXT-01C2 — Normalization + Doctor/Hospital Backend

#### Objective, dependencies and scope

Implementar el backend independiente de ambos masters sobre C1. ENTRY exige C1
merged, Prisma Client actualizado, migration gate verde y el contrato de
Sections 28.2-28.9 sin contradicciones abiertas.

Expected code areas:

- `app/api/src/healthcare/doctors/**`;
- `app/api/src/healthcare/hospitals/**`;
- utility de normalización/searchKey bajo `app/api/src/healthcare/**`;
- registro de modules en el composition root Healthcare/API;
- DTO/controller/service specs y `erp-core-role-matrix.spec.ts`.

IMPLEMENT incluye DTOs, controllers y Services para list, detail, create,
update, duplicate review, confirm, deactivate y reactivate; normalización y
searchKey; filtros/paginación/orden estable; response mappers y códigos de error
de la Section 28.

Forbidden scope:

- mutations o nested lists de affiliation;
- cambios funcionales a HealthcareCase;
- frontend, import/merge de duplicados, fuzzy ranking o permission-based RBAC;
- aceptar `companyId`, `searchKey` o `isActive` del cliente.

#### Tests and gates

Doctor y Hospital requieren grupos focales separados para create, DTO
validation, normalization, list/detail, search, filters, pagination, stable
sorting, duplicate review sin write, explicit confirmation, update semantics,
lifecycle idempotente, responses y stable errors.

Golden normalization cubre como mínimo:

- `José`/`Jose` y `Muñoz`/`Munoz`;
- uppercase/lowercase;
- whitespace repetido y leading/trailing;
- city/state con acentos;
- optional blank convertido a `null`;
- `searchKey` calculado y nunca aceptado/devuelto públicamente.

SECURITY requiere tests efectivos por request/guard y Service:

- ADMIN/MANAGER/SALES leen, crean y editan; WAREHOUSE sólo lee;
- sólo ADMIN/MANAGER ejecutan lifecycle;
- Company A no lista, busca, obtiene, muta ni recibe duplicate candidates de B;
- ID foreign e inexistente son 404 indistinguible;
- body/query no controlan companyId y unknown fields producen 400;
- un 403 no destruye la sesión.

REGRESSION incluye HealthcareCase y la matriz de roles CURRENT. QUALITY ejecuta
los focales, `npm run lint:check`, `npm run typecheck`, todos los API tests con
`--runInBand`, `npm run build` y `git diff --check`.

#### Completion, recovery and STOP

Complete cuando ambos resources cumplen el contrato completo de C2, sus tests
fallan si se omite tenant predicate o un role, y ningún raw Prisma error cruza
el boundary HTTP. El commit no contiene affiliation, Case ni frontend.

Recovery consiste en revertir módulos/API de C2 sin retirar el schema aditivo
de C1. Los datos creados permanecen inaccesibles al backend anterior pero no se
eliminan. Un cambio de contrato descubierto vuelve a diseño explícito; no se
parchea silenciosamente en el mismo review.

**C2 STOP** si companyId es controlable por cliente, existe tenant leakage,
duplicate review escribe antes de confirmación, nombres required aceptan blank,
lifecycle elimina historia, raw Prisma escapa, la matriz fija no se cumple o un
gate API completo queda rojo.

### 29.5 HC-NEXT-01C3 — Doctor-Hospital Affiliation Backend

#### Objective, dependencies and scope

Implementar la relación explícita N:N una vez estables ambos masters. ENTRY
exige C2 merged/green y lifecycle/duplicate contracts de Doctor/Hospital
cerrados.

Expected code areas:

- `app/api/src/healthcare/doctor-hospital-affiliations/**`;
- extensiones narrowly scoped de Doctor/Hospital para los dos nested GET;
- module registration, DTOs, mappers y tests;
- test E2E/concurrency con PostgreSQL para el race P2002.

IMPLEMENT incluye link/create, PATCH de notes, deactivate, reactivate,
Doctor-to-Hospitals list, Hospital-to-Doctors list, effective-active status,
exact-pair P2002 mapping y los códigos 409 aprobados.

Forbidden scope:

- DELETE o nueva fila al reactivar;
- cambiar la pareja por PATCH;
- creación/reactivación silenciosa desde Case;
- mutation con master inactivo;
- Case DTO/response, frontend o nuevos roles.

#### Tests and gates

FOCAL TESTS cubren:

- link same-tenant con ambos masters activos;
- active pair repetido -> `AFFILIATION_ALREADY_ACTIVE` 409;
- inactive pair en create -> `AFFILIATION_INACTIVE` 409 y reactivación sólo por
  command explícito;
- notes PATCH sin alterar pair/lifecycle;
- deactivate/reactivate idempotentes sobre la misma row;
- reactivate rechazado si cualquier endpoint está inactivo;
- listas direccionales paginadas, status y effective-active correctos;
- dos creates concurrentes dejan una row y el loser recibe error estable;
- deactivate no modifica HealthcareCase.

SECURITY verifica read para los cuatro roles, link/edit notes para
ADMIN/MANAGER/SALES, lifecycle sólo ADMIN/MANAGER y WAREHOUSE read-only. Todos
los master, pair, list y candidate lookups usan authenticated companyId;
combinaciones A/B no revelan ni enlazan foreign IDs.

REGRESSION incluye C2 y HealthcareCase existente. QUALITY usa focal unit/E2E,
full API tests in-band, API lint:check/typecheck/build y diff check.

#### Completion, recovery and STOP

Complete cuando sólo una row persistente representa cada pair, todas las rutas
de 28.2.3/28.5 existen, P2002 real está probado y no hay DELETE. El commit/PR es
independiente de Case y frontend.

Recovery revierte la superficie API conservando rows. Si un race aparece tras
merge se corrige forward manteniendo la unique; nunca se borra la row winner ni
se relaja tenant integrity para desbloquear un test.

**C3 STOP** si se puede enlazar cross-tenant, create reactiva silenciosamente,
se duplica una pareja, raw P2002 escapa, lifecycle de SALES/WAREHOUSE queda
permitido, una deactivation toca Case o cualquier gate de C2 regresa.

### 29.6 HC-NEXT-01C4 — HealthcareCase Doctor/Hospital Integration

#### Objective, dependencies and scope

Agregar el contrato aditivo de Sections 28.10-28.11 al Case CURRENT. ENTRY
exige C3 green, Services de master disponibles para validación scoped y baseline
de HealthcareCase registrado antes de editar.

Expected code areas:

- `app/api/src/healthcare/cases/dto/create-healthcare-case.dto.ts`;
- `app/api/src/healthcare/cases/dto/update-healthcare-case.dto.ts`;
- `healthcare-case.service.ts`, controller sólo si response wiring lo exige;
- specs de DTO, Service y Controller de HealthcareCase;
- role-matrix y tests E2E tenant/cross-relation cuando corresponda.

IMPLEMENT incluye `doctorId?`/`hospitalId?`, property-presence semantics,
validation de nuevos/replacement IDs activos same-tenant y responses con IDs y
compact relations sin N+1.

Forbidden scope:

- exigir o crear affiliation;
- cambiar HealthcareCaseStatus, Readiness, folio, schedule, responsibleUser o
  cancel behavior;
- ocultar una relation histórica porque su master se desactivó;
- frontend, snapshots o múltiples Doctors.

#### Tests and gates

FOCAL TESTS cubren create omitido/null/non-null; PATCH omitido preserva, null
limpia, ID distinto exige active same-tenant y mismo ID es no-op permitido aun
si quedó inactivo. También fijan response IDs/compact objects en create, update,
detail y list, con bounded selects y sin carga implícita de notes/contact data.

SECURITY prueba cada campo por separado y combinado:

- foreign Doctor/Hospital y nonexistent ID devuelven 404 indistinguible;
- inactive same-tenant new/replacement devuelve stable 409;
- WAREHOUSE no adquiere Case mutation; ADMIN/MANAGER/SALES conservan el permiso
  CURRENT para assign/change/clear;
- companyId sigue derivado de auth y no aparece como authority del payload.

REGRESSION debe preservar create/list/detail/update/cancel, DRAFT/SCHEDULED/
CANCELLED, folio, reschedule, responsibleUser, tenant tests y consumidores que
ignoran fields aditivos. QUALITY ejecuta DTO/Service/Controller focales, matriz
RBAC, full API tests in-band, lint:check, typecheck, build y diff check.

#### Completion, recovery and STOP

Complete cuando todas las truth tables de create/PATCH están cubiertas,
responses son aditivas y los flows CURRENT son idénticos salvo los nuevos
fields. El commit no contiene UI ni crea dependencia de affiliation.

Recovery revierte DTO/Service/mapper dejando columnas nullable sin uso. No se
limpian relaciones ya escritas; si se requiere deshabilitar temporalmente la
feature, el backend anterior puede seguir leyendo Cases porque los fields son
aditivos.

**C4 STOP** si omitted se convierte en null, el mismo inactive ID falla, una
relation nueva acepta master inactive/foreign, desaparece contexto histórico,
se auto-crea affiliation, cambia Status/Readiness o cualquier regression de
HealthcareCase falla.

#### Implemented surface and evidence — 2026-09-11

Estado del slice: `IMPLEMENTED / GATES PASS — PRE-COMMIT`.

- create y PATCH aceptan `doctorId?`/`hospitalId?` nullable y conservan la
  distinción omitted/null/same/replacement;
- Doctor se valida antes que Hospital mediante lookups `id + companyId` dentro
  de la transacción existente; un mismo ID histórico no se revalida por active;
- create/list/detail/update/cancel usan un select compartido bounded y exponen
  IDs más objetos compactos sin N+1 ni datos de affiliation;
- missing/foreign, inactive y P2003 usan los errores estables de Section 28;
- la matriz real de `RolesGuard` cubre HealthcareCasesController sin cambiar
  permisos;
- tests focales y PostgreSQL cubren asignación nullable/same-tenant, ausencia de
  dependencia de affiliation y conservación de masters inactivos;
- evidencia C4: Cases focal 153/153, RBAC 63/63, regresión de masters/
  affiliations 199/199, PostgreSQL 18/18 y API completa 75 suites / 1010 tests;
  Prisma validate/generate, lint, typecheck, build y diff-check PASS.

### 29.7 HC-NEXT-01C5 — API/RBAC Regression & Backend Hardening

#### Objective, dependencies and scope

Cerrar riesgos de integración backend después de C4 sin agregar capability.
ENTRY exige C1-C4 merged, todos sus focales verdes y una lista de findings de
hardening reproducibles.

Expected code areas:

- specs de Doctors, Hospitals, affiliations y HealthcareCase;
- `app/api/src/auth/guards/erp-core-role-matrix.spec.ts`;
- E2E/concurrency tests bajo `app/api/test/`;
- mappers/Services/DTOs existentes sólo para corregir incumplimientos probados.

Forbidden scope:

- nuevas rutas, filters, roles o UX;
- cambios de schema/migration salvo que se detenga C5 y vuelva formalmente a C1;
- relajar assertions, transformar 404 en leak-friendly 403 o capturar todos los
  errores Prisma como un mismo conflicto.

#### Tests and gates

FOCAL/SECURITY amplía cobertura para:

- role matrix completa por método real, incluyendo allowed y denied;
- isolation A/B en list/detail/search/duplicate/lifecycle/affiliation/Case;
- P2002 exact pair, FK race y P2025/update-count race;
- master deactivate concurrente con Case assignment o affiliation reactivate;
- unknown DTO fields y malformed UUID;
- rechazo de `companyId`, `searchKey`, `isActive` y pair mutation;
- raw Prisma errors nunca expuestos y cross-tenant existence nunca observable;
- repeated lifecycle target state idempotente.

REGRESSION/QUALITY es el gate backend completo:

```text
npm run lint:check
npm run typecheck
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
git diff --check
```

`test:e2e` requiere el entorno PostgreSQL documentado y disposable. Si el
runner actual no aísla datos, C5 debe corregir el harness antes de aceptar la
evidencia; no puede sustituirlo con mocks para los races.

#### Completion, recovery and STOP

Complete con full API green, races relevantes probados contra DB real, matriz
RBAC ejecutada y un audit del diff confirmando que no se añadió producto. Este
slice es la baseline backend que consume C6.

Recovery revierte cada hardening fix junto con su test sólo si el predecessor
contract permanece green; preferiblemente cada finding tiene un commit pequeño
dentro del mismo PR C5. No se revierte la migration ni se borran datos.

**C5 STOP** si cualquier full gate falla, un race queda flaky/no reproducible,
el test environment no es disposable, un fix exige rediseñar Section 28, hay
leak/role bypass o el diff agrega capability no aprobado.

### 29.8 HC-NEXT-01C6 — Doctors/Hospitals Frontend

#### Objective, dependencies and scope

Implementar master-data UX consumiendo la baseline backend C5. ENTRY exige C5
merged/green, respuestas reales disponibles y lectura de las guías relevantes
de la versión instalada en `node_modules/next/dist/docs/` antes de escribir
Next.js code.

Expected code areas:

- `web/app/(app)/doctors/**` y `web/app/(app)/hospitals/**`;
- componentes/forms/hooks/types narrowly scoped bajo esas features o
  `web/app/components/business/**` cuando sean genuinamente compartidos;
- `web/app/erp-role-access.ts`, navigation/sidebar y sus tests;
- API client/session/error handling CURRENT, extendido sin sistema paralelo.

IMPLEMENT incluye list, search, status filter, stable pagination, create, edit,
detail si el workflow lo necesita, deactivate/reactivate por role, specialty
prominente y city/state context. ADMIN/MANAGER tienen full UX, SALES read/create/
edit sin lifecycle y WAREHOUSE read-only.

La frontera con C7 es explícita: C6 reconoce
`DUPLICATE_REVIEW_REQUIRED` como resultado **sin escritura**, nunca muestra
éxito ni reintenta con confirmación implícita. La presentación de candidates y
el retry confirmado pertenecen a C7.

Forbidden scope:

- Case selectors, quick-create desde Case o affiliation mutation UI;
- 360 views, advanced filters/ranking, new design system o refactor de
  navegación no requerido;
- permisos inventados en componentes en lugar de helpers RBAC compartidos.

#### Tests and gates

FOCAL TESTS por role cubren visibilidad y requests: ADMIN/MANAGER ven todas las
acciones; SALES no ve ni dispara lifecycle; WAREHOUSE no ve ni dispara create,
edit o lifecycle; todos leen list/detail. Search/filter/pagination y estados
loading/empty/error/retry deben mantener sesión ante 403.

También se prueba que protected fields nunca entran al payload, que una
duplicate review no se trata como created/updated y que un usuario sin acción
visible tampoco puede dispararla por estado/ruta directa del frontend.

SECURITY frontend es defense-in-depth: no reemplaza los guards C5. No se envía
companyId, no se mezclan caches entre sesiones/companies y los IDs proceden de
responses autenticadas.

REGRESSION incluye layout, sidebar, navigation, authenticated session y
componentes compartidos tocados. QUALITY:

```text
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run build
git diff --check
```

#### Completion, recovery and STOP

Complete cuando ambos masters son utilizables para operaciones no duplicadas,
la matriz visual/request-level coincide con backend, duplicate review queda en
estado seguro no confirmado y los full Web gates pasan. El commit no contiene
Case selector/confirmation UX.

Recovery revierte rutas, nav y role helpers de C6; el backend sigue siendo
compatible y no se borran masters. Si un shared helper causa regresión, se
restaura el comportamiento anterior para módulos no Healthcare y se corrige de
forma focal.

**C6 STOP** si una acción forbidden aparece o dispara request, un 403 destruye
sesión, duplicate warning se interpreta como éxito, protected fields salen del
browser, Home/Sidebar/navigation regresan o cualquier Web gate/build falla.

### 29.9 HC-NEXT-01C7 — HealthcareCase Selectors + Duplicate Review UX

#### Objective, dependencies and scope

Completar la integración de usuario con selectors y confirmación explícita.
ENTRY exige C6 green, la superficie Web de HealthcareCase identificada y las
guías Next.js instaladas revisadas. Si aún no existe Case UI, su ubicación de
navegación se decide dentro del frontend scope sin cambiar el contrato API.

Expected code areas:

- pantalla/form/hooks/types de HealthcareCase bajo `web/app/(app)/**`;
- Doctor/Hospital selector components compartidos;
- quick-create modals/forms que reutilizan los contratos C6;
- API response/result types y tests de los workflows integrados;
- role-access helpers existentes, sin permission engine paralelo.

IMPLEMENT incluye searchable selectors, clear relation, compact Case context,
display histórico de master inactivo, explicit quick-create, candidates de
duplicate review, confirmación visible antes del retry y warning no bloqueante
por falta de affiliation.

Doctor options muestran name + specialty; Hospital options name + city/state.
Sólo masters activos pueden ser selección nueva. Un master inactivo ya ligado
permanece visible y reenviar el mismo ID no fuerza reemplazo. Missing
affiliation no bloquea Case ni crea una relación.

Forbidden scope:

- creación implícita de Doctor/Hospital o affiliation;
- selección de inactive como nueva relation;
- convertir warning en error bloqueante sin opción de confirmación;
- múltiples Doctors, Patient/Payer, 360/history avanzada o lifecycle de Case
  adicional.

#### Tests and gates

FOCAL TESTS cubren:

- search/debounce/result rendering sin requests cross-session;
- select Doctor/Hospital, clear, omitted edit preserve y reschedule preserve;
- historical inactive relation visible pero ausente de opciones nuevas;
- quick-create requiere acción explícita y respeta roles;
- duplicate candidates se muestran, cancel no escribe y confirm hace un único
  retry con `confirmPossibleDuplicate: true`;
- missing affiliation presenta warning contextual y permite continuar;
- no request de affiliation creation ocurre desde Case;
- WAREHOUSE read-only; ADMIN/MANAGER/SALES assign/change/clear según Section 28.

SECURITY verifica que selectors sólo consumen endpoints tenant-scoped, nunca
envían companyId y descartan resultados stale después de session/company
change. Un ID manipulado recibe el 404/409 backend sin revelar foreign details
ni destruir sesión.

REGRESSION incluye todos los HealthcareCase Web flows existentes, C6 master
pages, session/layout/sidebar y API C4/C5 tests si cambia algún shared contract.
QUALITY ejecuta focal Web, full Web one-worker, lint/typecheck/build, y full API
gates si se toca cualquier archivo/API contract backend.

#### Completion, recovery and STOP

Complete cuando Case create/edit soporta seleccionar, conservar y limpiar;
historical inactive se muestra; quick-create/duplicate confirmation son
explícitos; missing affiliation no bloquea; y full Web está green.

Recovery desactiva/revierte sólo selectors y quick-create UI; los optional API
fields mantienen compatibilidad y las relaciones persistidas permanecen. No se
limpian IDs válidos ni se reactiva un master como rollback de UX.

**C7 STOP** si una confirmación puede ocurrir implícitamente, cancel crea o
edita, el selector ofrece inactive/foreign, desaparece una relación histórica,
se requiere affiliation, se crea affiliation silenciosa, roles se amplían o
Web/API regression queda rojo.

### 29.10 HC-NEXT-01C8 — Integrated Acceptance & Regression Gate

#### Objective, dependencies and scope

Cerrar HC-NEXT-01 mediante evidencia integrada; C8 no agrega producto. ENTRY
exige C1-C7 merged, automated gates verdes, migration aplicada en ambiente QA
controlado y datos/manual accounts identificados por company y role.

Expected code areas se limitan a tests automatizados/E2E estrictamente faltantes
para acceptance y sus harnesses; las demás áreas esperadas son evidencia manual
y documentos de status enumerados en 29.13. Cualquier fix funcional descubierto
se realiza en un commit/PR focal que vuelve al slice propietario; C8 se reanuda
después de reejecutar sus gates.

Forbidden scope:

- corregir findings dentro de un mega acceptance commit;
- relajar asserts o marcar PASS con evidencia parcial;
- reset de QA/producción, datos artificiales no trazables o mezcla de otro
  milestone Healthcare.

#### Automated and manual gates

Automated completion requiere:

- migration chain limpia y upgrade CURRENT en PostgreSQL disposable;
- todos los focales C1-C7;
- full API lint:check, typecheck, unit tests, E2E y build;
- full Web lint, typecheck, one-worker tests y production build;
- role matrix y tenant isolation A/B;
- `git diff --check` y scope review final.

Manual acceptance registra actor, company, role, acción, expected/actual y
evidencia para ADMIN, MANAGER, SALES y WAREHOUSE:

- Doctor create/search/edit y lifecycle permitido/denegado;
- Hospital create/search/edit y lifecycle permitido/denegado;
- affiliation link/read/deactivate/reactivate según role;
- Case assign Doctor/Hospital, clear y reschedule preserving relations;
- inactive historical relation visible y no selectable como nueva;
- Case sin affiliation válido y sin auto-create;
- duplicate review cancel/confirm explícitos;
- Company A incapaz de leer, buscar, mutar o enlazar resources de Company B;
- 401/403/404/409 esperados no destruyen la sesión;
- ERP Core navigation y workflows aceptados permanecen operativos.

#### Completion, recovery and STOP

Complete sólo con evidencia reproducible, cero finding bloqueante, todos los
gates verdes y documentación sincronizada. Un failure se clasifica, asigna al
slice originador y deja C8 abierto; tras el fix se reejecuta al menos el focal,
la capa completa y el escenario manual afectado.

Recovery en C8 es revertir el slice defectuoso o desplegar un forward fix
reviewed. Migration/data rollback nunca se improvisa durante acceptance.

**C8 STOP** si falla cualquier API/Web/DB gate, hay role-matrix o tenant leak,
surge regresión ERP Core/HealthcareCase, falta evidencia manual de algún role,
existe P0 abierto o un finding contradice el contrato aprobado.

### 29.11 Cross-slice evidence and review requirements

Cada PR debe adjuntar:

- branch/base y dependencia satisfechas;
- lista exacta de archivos y migrations;
- matriz de tests con comando, resultado y conteo cuando la herramienta lo da;
- evidencia tenant/role positiva y negativa;
- `git diff --check` y status final;
- riesgos, findings diferidos y recovery path;
- confirmación de forbidden scope no tocado.

Un test que sólo inspecciona `@Roles` metadata no basta cuando puede probarse el
request real. Las invariants DB requieren PostgreSQL; mocks son útiles para
branches de Service pero no prueban FKs, unique races ni migration safety. Un
build verde no sustituye tests, y tests focales no sustituyen la suite completa
en C5/C8.

### 29.12 Branch, commit and PR strategy

La estrategia recomendada es **ocho branches/PRs cortos y secuenciales**, uno
por C1-C8, cada uno basado en el predecessor ya merged. C1-C4 separan cambios
con distinto recovery profile; C5 estabiliza una API completa antes de que Web
la consuma; C6/C7 separan master UX de integración Case; C8 mantiene acceptance
sin ocultar fixes funcionales.

Cada PR puede contener más de un commit sólo si siguen siendo atómicos dentro
del mismo slice (por ejemplo implementation + tests), pero debe quedar
reviewable y revertible como unidad. No se prescriben SHAs ni nombres exactos.

Stacked branches pueden reducir espera, pero deben rebasearse/actualizarse tras
merge del predecessor y sus CI results no autorizan merge fuera de orden. Un
único branch largo con C1-C8 se desaconseja: mezcla migration, backend y Web,
dificulta rollback/review y acumula drift. Tampoco se agrupan automáticamente
todos los slices en un único PR.

### 29.13 Documentation synchronization plan

Este task sólo modifica el technical design. Durante implementación, cada doc
se actualiza en el slice indicado, dentro del PR que vuelve verdadera la nueva
afirmación:

| Document | Update point |
| --- | --- |
| `DOCTORS_HOSPITALS_TECHNICAL_DESIGN.md` | Cada C1-C7 registra implemented surface y evidencia; C8 registra VALIDATED. |
| `DOCTORS_HOSPITALS.md` | C2/C3 si implementation descubre una precisión no contradictoria; C7/C8 sincroniza experiencia y estado final. |
| `HEALTHCARE.md` | C4 al integrar Case backend; C7 al habilitar workflow Web; C8 al cerrar capability. |
| `DOMAIN_MODEL.md` | C1 cuando existen modelos/relaciones reales; C4 cuando Case relations quedan implementadas. |
| `CASES.md` | C4 para API/semantics CURRENT; C7 para selectors/UX CURRENT; C8 para validation evidence. |
| `PROJECT_BOARD.md` | Al iniciar/completar cada C-slice según governance; cierre HC-NEXT-01 sólo en C8. |
| `ROADMAP.md` | Cuando el milestone cambia de planned a active y, después, a validated/closed; no por trabajo local sin merge. |
| `CHANGELOG.md` | En los PRs que vuelven user-visible/API-visible el capability, consolidado en C8 según convención del release. |

No se reescribe un contrato aprobado para hacer coincidir accidentalmente una
implementación divergente. La divergencia bloquea el slice o requiere una
decisión de diseño explícita y revisión documental antes de continuar.

### 29.14 Status transitions

Status del technical design/capability:

| Milestone | Allowed status |
| --- | --- |
| Estado inicial — sólo plan aprobado | `PROPOSED / NOT IMPLEMENTED` y Section 29 `APPROVED IMPLEMENTATION PLAN / NOT STARTED` |
| C1 merged | `PARTIALLY IMPLEMENTED — PERSISTENCE` |
| C2-C4 merged | `PARTIALLY IMPLEMENTED — BACKEND IN PROGRESS` con slices exactos enumerados |
| C5 merged | `PARTIALLY IMPLEMENTED — BACKEND VALIDATED` |
| C6 merged | `PARTIALLY IMPLEMENTED — MASTER-DATA WEB` |
| C7 merged y automated gates green | `IMPLEMENTED / INTEGRATED ACCEPTANCE REQUIRED` |
| C8 completo | `IMPLEMENTED / VALIDATED` y HC-NEXT-01 eligible para cierre |

Un status sólo cambia después de merge y evidencia del gate correspondiente.
No se usa `IMPLEMENTED` mientras falte C7 ni `VALIDATED` antes de manual role
acceptance C8.

### 29.15 Final HC-NEXT-01 exit criteria

HC-NEXT-01 puede cerrarse únicamente cuando todos son verdaderos:

- el contrato de dominio sigue válido o toda enmienda fue aprobada y trazada;
- schema/persistence y migration aditiva están implementados y validados;
- migration chain desde vacío y upgrade con rows CURRENT pasan;
- Doctor y Hospital API/backend implementan DTO, search, duplicate, lifecycle,
  errors y responses aprobados;
- affiliation API conserva una row por pair y lifecycle explícito;
- HealthcareCase integration implementa create/PATCH/response sin alterar
  Status, Readiness, folio, schedule, responsibleUser o cancel;
- Doctors/Hospitals master-data frontend está implementado;
- Case selectors, historical inactive display, quick-create y duplicate-review
  confirmation explícita están implementados;
- tenant isolation está validado en DB, Service, HTTP y frontend workflows;
- fixed-role RBAC está validado para ADMIN, MANAGER, SALES y WAREHOUSE;
- full API lint/typecheck/unit/E2E/build pasan;
- full Web lint/typecheck/one-worker tests/production build pasan;
- manual role acceptance y A/B tenant scenarios pasan con evidencia;
- ERP Core y HealthcareCase regression pasan;
- documentación, board, roadmap y changelog aplicables están sincronizados;
- no existe P0 abierto ni otro finding que viole un criterio de aceptación;
- diffs finales pasan whitespace/scope review y no contienen scope forbidden.

### 29.16 Plan decision summary

| Decision | Approved plan |
| --- | --- |
| Delivery model | Eight dependency-ordered, independently reviewed slices |
| First implementation | C1 persistence/migration only |
| Backend readiness | C2-C4 capability; C5 full hardening baseline |
| Frontend boundary | C6 master data; C7 Case selectors + duplicate confirmation |
| Final gate | C8 automated + manual four-role and two-tenant acceptance |
| Merge policy | No slice merges or advances with blocking red gates |
| PR strategy | Separate sequential PRs; stacked preparation allowed, merge order fixed |
| Recovery | Revert code by slice; forward migrations after shared application; never delete QA/production data casually |
| Status now | PARTIALLY IMPLEMENTED — BACKEND IN PROGRESS; C1-C3 merged, C4 gates pass/pre-commit |

Las decisiones API/RBAC no se reabren en implementación por defecto. Un
conflicto real con el repositorio, migration safety o seguridad tenant obliga a
STOP, documentar evidencia y obtener una decisión revisada antes de ampliar o
debilitar el contrato.
