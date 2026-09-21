# ADR-HC-LOCK-001 — Healthcare Company-Scoped Transaction Coordination

**Estado:** ACCEPTED — architecture decision only; implementation and production readiness remain pending
**Estado de decisión:** ACCEPTED
**Estado de implementación:** PENDING
**Preparación para producción:** NOT APPROVED
**Fecha de decisión:** 2026-09-21
**Responsable:** Zaping Architecture Team

---

# 1. Contexto

Las mutaciones de Healthcare Equipment Assignment y Healthcare Requirement
pueden concurrir sobre el mismo conjunto de recursos:

* `HealthcareCase`;
* `HealthcareCaseRequirement`;
* `HealthcareEquipmentAsset`;
* `HealthcareEquipmentAssignment`;
* claims de idempotencia;
* y coordinación de settings de Equipment Assignment.

Los locks de fila continúan siendo necesarios para proteger cada agregado, pero
órdenes distintos de adquisición entre comandos pueden producir esperas
circulares. Además, el timeout de una transacción interactiva de Prisma no
garantiza por sí solo que PostgreSQL interrumpa una espera de advisory lock que
ya está en curso.

Existe un spike que aporta evidencia experimental sobre una coordinación por
Company, espera acotada y contrato HTTP. Ese spike no es la implementación V1
aprobada y no autoriza integración ni despliegue en producción.

---

# 2. Problema

Zaping necesita un orden común antes de que comandos relacionados adquieran
locks de fila en secuencias diferentes. El mecanismo debe:

* coordinar únicamente transacciones de la misma Company;
* mantener aislamiento entre Companies;
* operar dentro de la misma transacción que realiza la mutación;
* acotar la espera real en PostgreSQL;
* conservar los contratos de autorización, tenant isolation, validación,
  idempotencia y errores públicos;
* y permitir una identidad estable entre procesos, versiones e instancias.

---

# 3. Opciones consideradas

## 3.1 Conservar sólo locks de fila

No establece un punto de entrada común cuando dos comandos necesitan los mismos
recursos en órdenes distintos. Se descarta como solución completa.

## 3.2 Usar aislamiento `Serializable` o retries generales

Amplía el costo y el comportamiento de todas las transacciones sin resolver por
sí solo el contrato de espera, clasificación de errores e idempotencia. No se
adopta para V1.

## 3.3 Coordinar por Case o EquipmentAsset

Es más estrecho, pero no cubre de forma uniforme mutaciones que atraviesan Case,
Requirement, EquipmentAsset y Assignment. No se adopta como protocolo común
inicial.

## 3.4 Advisory lock transaccional por Company

Proporciona una primera adquisición común para los comandos participantes y se
libera con la transacción. Ésta es la opción aceptada, con los costos de
contención descritos en este ADR.

---

# 4. Decisión de coordinación

Los comandos participantes deben adquirir un advisory lock exclusivo de
PostgreSQL por Company mediante:

```sql
pg_advisory_xact_lock(bigint)
```

Reglas obligatorias:

1. Se adquiere dentro del mismo `Prisma.TransactionClient` que ejecuta la
   mutación protegida.
2. Es la primera adquisición de lock relevante, antes de los locks de fila y
   de los writes protegidos.
3. Se mantiene hasta `COMMIT` o `ROLLBACK`; no se libera manualmente.
4. Los reads preliminares pueden descubrir identidad o rechazar entradas, pero
   no son autoritativos. El estado crítico se relee y revalida dentro de la
   transacción protegida.
5. El advisory lock no reemplaza RBAC, autorización, filtros tenant-scoped,
   constraints, idempotencia ni validaciones de negocio.

La coordinación es exclusiva entre participantes de una misma Company. Este
ADR no ordena que toda mutación de Healthcare adopte automáticamente el lock.

---

# 5. Identidad estable V1

La entrada canónica es:

```text
zaping:healthcare:company-lock:v1:{companyId}
```

La derivación V1 es:

1. `companyId` se representa como UUID canónico, en minúsculas y con guiones.
2. El texto completo se codifica en UTF-8.
3. Se calcula SHA-256.
4. Se extraen los primeros ocho bytes del digest.
5. Los ocho bytes se interpretan como entero de 64 bits con signo y orden
   big-endian.
6. El resultado se pasa de forma parametrizada al overload de un solo argumento
   `pg_advisory_xact_lock(bigint)`.
7. No se agrega otro seed.

HC-LOCK-02 debe incorporar vectores deterministas verificados y validar la
parametrización segura del `bigint`, incluidos valores negativos.

El helper del spike usa `hashtextextended()` con otro namespace y un seed. Esa
identidad experimental no es compatible con V1 y no implementa la derivación
SHA-256 aprobada.

Todas las instancias concurrentes que ejecuten comandos protegidos deben usar la
misma identidad efectiva. Antes del primer rollout V1 debe comprobarse que no
exista un deployment activo usando una clave incompatible. Un despliegue mixto
requiere un plan explícito de compatibilidad o transición.

---

# 6. Participantes y orden inicial

El orden principal aprobado es:

| Comando | Orden principal de adquisición |
| --- | --- |
| Assignment Create | Company → EquipmentAsset → Requirement opcional → coordinación de settings → Cases relevantes. |
| Assignment Replace | Company → EquipmentAsset destino → Requirement → Assignment fuente → coordinación de settings → Cases relevantes. |
| Requirement Update | Company → Case → Requirement. |
| Requirement Retire | Company → Case → Requirement. |
| Requirement Reactivate | Company → Case → Product → Requirement. |
| Requirement Reorder | Company → Case → Requirements en orden determinista por ID. |

Se conservan las reglas detalladas existentes:

* locks de fila tenant-scoped con el modo definido por cada comando;
* advisory lock separado para coordinar settings de Equipment Assignment;
* múltiples Cases deduplicados y adquiridos en orden determinista por ID;
* y rereads autoritativos después de establecer la frontera de locks.

## 6.1 Manual Release

Manual Release debe participar antes de integrar el workflow completo de
reservas. Su orden objetivo es:

```text
Company → EquipmentAsset → Assignment
```

La implementación debe resolver el EquipmentAsset de forma tenant-scoped y
revalidar bajo lock que la Assignment continúa relacionada con ese Asset. Este
trabajo pertenece a HC-LOCK-03.

## 6.2 Parent Integrations

Case Cancel debe adquirir Company antes de sus futuros releases derivados.
Requirement Retire debe conservar el protocolo aprobado cuando incorpore sus
futuros releases derivados.

Los releases por Case Cancel y Requirement Retire son un entregable funcional
separado. Este ADR no afirma que estén implementados.

---

# 7. Política de timeouts

El protocolo distingue cuatro límites:

| Límite | Alcance |
| --- | --- |
| `maxWait` de Prisma | Espera para obtener/iniciar la transacción interactiva. |
| `lock_timeout` de PostgreSQL | Espera de adquisición del Company advisory lock. |
| Límites del trabajo posterior | Esperas de row locks y ejecución de statements después de adquirir Company. |
| `timeout` de Prisma | Duración global administrada por la transacción interactiva desde el cliente. |

El timeout específico de Zaping nunca debe debilitar un timeout heredado más
estricto. La configuración aplicada a la adquisición debe quedar limitada a la
transacción y restaurar la política efectiva que corresponda antes de continuar
con los statements posteriores.

`lock_timeout` limita esperas de locks en PostgreSQL. `statement_timeout` limita
la ejecución del statement completo. El timeout interactivo de Prisma administra
la transacción desde el cliente, pero no debe asumirse como interruptor
database-side de una consulta ya bloqueada. Del mismo modo, límites por statement
no garantizan por sí solos una duración absoluta de la transacción.

El valor `1000ms` usado por el spike es experimental y no es un valor aprobado
para producción. Implementación detallada, calibración numérica, cancelación,
rollback y recovery pertenecen a HC-LOCK-02 y HC-LOCK-04.

---

# 8. Contrato de error público

Un timeout identificado específicamente durante la adquisición del Company lock
se mapea a:

```text
HTTP 503
code = HEALTHCARE_CONCURRENCY_TIMEOUT
```

La clasificación debe usar evidencia estructurada de Prisma/PostgreSQL y el
contexto explícito de la adquisición. No se clasifican automáticamente como
Company-lock timeout:

* Prisma `P2010`;
* Prisma `P2028`;
* PostgreSQL `40P01`;
* PostgreSQL `57014`;
* PostgreSQL `55P03`;
* ni errores de persistencia no relacionados.

Los timeouts posteriores de row locks requieren clasificación separada. V1 no
introduce retries automáticos. Un retry explícito debe conservar las reglas de
idempotencia del comando.

La respuesta pública no expone SQL, metadata PostgreSQL, datos de conexión ni
causas internas de Prisma.

---

# 9. Acuerdo de dominio para Manual Release

El contrato aprobado es:

* primera transición válida `RESERVED → RELEASED`;
* `reason` obligatorio y normalizado;
* `releaseCause = MANUAL`;
* actor, timestamp, reason e historia originales se preservan;
* repetir un release manual previo con la misma razón normalizada devuelve HTTP
  200 sin nuevos writes;
* usar una razón diferente después de completar el release manual devuelve HTTP
  409 sin alterar la historia;
* coexisten la idempotencia por estado y la idempotencia por
  `Idempotency-Key + payload`;
* una Assignment `REPLACED` no puede transicionar a `RELEASED` mediante Manual
  Release;
* y release lógico no implica Return físico, Inventory Movement ni cambio de
  Custody.

HC-LOCK-03 debe resolver, sin que este ADR invente el resultado:

1. precedencia entre replay idempotente y lifecycle actual del Case;
2. request manual después de un release causado por `CASE_CANCELLED` o
   `REQUIREMENT_WITHDRAWN`;
3. código público estable para lifecycle incompatible;
4. contrato HTTP exacto de `Idempotency-Key`, scope de Release, fingerprint y
   persistencia/recovery;
5. descubrimiento tenant-scoped del Asset y revalidación dentro de la secuencia
   final de locks;
6. resultados detallados de las carreras Release/Release, Release/Replace y
   Release/Parent Integrations.

---

# 10. Consecuencias y riesgos

## 10.1 Consecuencias positivas

* Los participantes comparten una primera adquisición determinista.
* Companies diferentes usan identidades independientes.
* El lock se libera con la misma transacción que confirma o revierte la mutación.
* La espera de adquisición puede acotarse en PostgreSQL.

## 10.2 Costos y riesgos

* Operaciones independientes de una misma Company pueden serializarse.
* Después de adquirir Company todavía pueden existir esperas de row locks.
* Identidades incompatibles en un rollout mixto eliminan la coordinación
  efectiva.
* Mutation paths no participantes pueden conservar carreras concretas.
* Manual Release y Parent Integrations siguen siendo dependencias funcionales.
* Mutaciones del lifecycle de EquipmentAsset requieren análisis de recursos y
  orden antes de decidir si participan.
* La operación necesita observabilidad sanitizada de contención, latencia,
  timeouts y duración transaccional, sin filtrar detalles internos.

La reducción de paralelismo dentro de una Company es una limitación esperada de
V1. El protocolo no serializa por esta identidad operaciones de Companies
distintas, aunque todas continúan compartiendo recursos generales de base de
datos.

---

# 11. Trabajo de integración

* **HC-LOCK-02:** consolidar helper V1, derivación estable, vectores, aplicación
  y restauración de timeouts y adopción por participantes.
* **HC-LOCK-03:** refinar e implementar Manual Release según las decisiones
  pendientes de la sección 9.
* **HC-LOCK-04:** validar PostgreSQL y HTTP, rollback, contención, aislamiento
  multi-tenant y regresión.
* **HC-NEXT-03C4-C:** implementar por separado los releases derivados de Case
  Cancel y Requirement Retire.

Este ADR acepta la arquitectura objetivo. No aprueba la implementación del
spike, producción, deployment ni rollout.

---

# 12. Documentos relacionados

* [ADR-001 — Arquitectura Multi-Tenant](ADR-001-multi-tenant.md)
* [Equipment Assignment Technical Design](../../modules/healthcare/EQUIPMENT_ASSIGNMENT_TECHNICAL_DESIGN.md)
* [Project Board — HC-LOCK y HC-NEXT-03C4-C](../../project/PROJECT_BOARD.md)

---

# 13. Principio final

Las mutaciones participantes de una Company deben entrar a su región crítica
por la misma identidad y dentro de la misma transacción, antes de adquirir los
recursos de dominio que comparten.

Esa coordinación refuerza el orden transaccional; no sustituye las garantías de
dominio que hacen válida cada mutación.
