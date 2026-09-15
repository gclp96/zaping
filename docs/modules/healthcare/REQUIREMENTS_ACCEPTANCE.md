# Healthcare Requirements V1 — Integrated Acceptance

**Branch:** `qa/healthcare-requirements-acceptance`
**Baseline:** `2476f94bd62c90f0f56c877c140097c4db841cc6`
**Fecha de aceptación:** 2026-09-14
**Estado:** COMPLETE / ACCEPTED
**Resultado final:** PASS

Este documento registra el preflight automatizado, el runtime smoke y la matriz
manual completada de Healthcare Requirements V1. La integración real de
evidencia operacional prevista por `RQ-006` continúa diferida hasta que exista
un producer Healthcare.

## 1. Entorno QA local

- PostgreSQL 16 dedicado: `zaping_qa`, saludable y publicado sólo en
  `127.0.0.1:5433`.
- API: `http://localhost:3001`; liveness y readiness responden HTTP 200.
- Web: `http://localhost:3000`; `/healthcare-cases` responde HTTP 200.
- API y Web fueron recreados desde el checkout actual sin recrear PostgreSQL ni
  borrar su volumen.
- La migración `20260914003630_add_healthcare_requirements` se aplicó mediante
  `prisma migrate deploy`; las 27 migraciones quedaron aplicadas sin error.
- `prisma validate` y `prisma generate` pasan.

Usuarios deterministas de Company A, con la contraseña configurada en el
entorno QA local:

| Rol | Usuario |
| --- | --- |
| ADMIN | `admin.a@qa.example.test` |
| MANAGER | `manager.a@qa.example.test` |
| SALES | `sales.a@qa.example.test` |
| WAREHOUSE | `warehouse.a@qa.example.test` |

Company B conserva `admin.b@qa.example.test` para comprobaciones de aislamiento.
Un usuario WAREHOUSE manual adicional preexistente quedó intacto y no forma
parte de esta matriz determinista.

## 2. Fixtures deterministas

El seed QA existente se amplió de forma idempotente y sin deletes. Una
reejecución preserva el trabajo manual ya realizado.

| Company | Case | Estado | Requirements iniciales |
| --- | --- | --- | --- |
| A | `QA-A-HC-RQ-DRAFT` | DRAFT | 1 ACTIVE, 2 RETIRED |
| A | `QA-A-HC-RQ-SCHEDULED` | SCHEDULED | 2 ACTIVE |
| A | `QA-A-HC-RQ-CANCELLED` | CANCELLED | 1 ACTIVE, 1 RETIRED |
| B | `QA-B-HC-RQ-DRAFT` | DRAFT | 1 ACTIVE |

Products dedicados:

- `QA-A-RQ-PRIMARY` y `QA-A-RQ-BACKUP`: ACTIVE y referenciados por fixtures.
- `QA-A-RQ-HISTORICAL`: se creó ACTIVE, se relacionó con Requirements y después
  se desactivó. Permite validar visualización histórica, mutación permitida de
  una relación existente y rechazo de reactivation.
- `QA-A-RQ-ADMIN`, `QA-A-RQ-MANAGER`, `QA-A-RQ-SALES` y
  `QA-A-RQ-WAREHOUSE`: ACTIVE, uno por rol para pruebas independientes de
  create/edit/reorder/retire/reactivate.
- `QA-B-RQ-PRIMARY`: fixture tenant-scoped de Company B.

## 3. Evidencia automatizada

| Gate | Resultado |
| --- | --- |
| Requirements backend focal | PASS — 3 suites / 95 tests |
| Requirements frontend focal | PASS — 2 files / 23 tests |
| RBAC matrix | PASS — 1 suite / 69 tests |
| Healthcare backend regression | PASS — 19 suites / 528 tests |
| Healthcare/Cases frontend regression | PASS — integrated 4 files / 42 tests; final affected Case focal 1 file / 17 tests; cubierta además por full Web |
| PostgreSQL Requirements integrity | PASS — 1 suite / 31 tests |
| API full regression | PASS — 78 suites / 1154 tests |
| Web full regression, 1 worker | PASS — 63 files / 762 tests |
| API lint / typecheck / build | PASS |
| Web lint / typecheck / production build | PASS |
| Prisma validate / generate | PASS |
| `git diff --check` | PASS |

El build Web usa una URL HTTPS sintética de producción sólo para satisfacer la
guarda de configuración durante prerender; no realiza llamadas a ese host.

## 4. Runtime smoke real

- Login, `/auth/me` y preservación de sesión se verificaron para ADMIN,
  MANAGER, SALES y WAREHOUSE de Company A; también se verificó ADMIN de Company
  B.
- WAREHOUSE obtuvo HTTP 200 y 3 registros al consultar `ALL` del Case DRAFT de
  Company A.
- El mismo token de Company A obtuvo HTTP 404 con `CASE_NOT_FOUND` al consultar
  el Case determinista de Company B.
- ADMIN de Company B obtuvo HTTP 200 y su único Requirement propio.
- En navegador real, ADMIN abrió `QA-A-HC-RQ-DRAFT`; la sección
  `Requerimientos` cargó desde el API/PostgreSQL real y mostró
  `QA-A-RQ-PRIMARY`.
- Este smoke no ejecutó ni sustituyó la matriz manual por rol.

## 5. Findings de aceptación — RESOLVED / VERIFIED

La ejecución manual inicial con ADMIN detectó tres hallazgos. Todos quedaron
resueltos y verificados antes del cierre de aceptación:

| Finding | Clasificación | Estado |
| --- | --- | --- |
| El menú **Acciones** de un Requirement no presentaba opciones visibles dentro del modal de detalle del Case. | Blocking defect | FIXED / VERIFIED |
| El reorder manual se retiró después del feedback de aceptación porque `sortOrder` es sólo de presentación y no existe un significado operacional V1 para mover Requirements. | Approved UX simplification | RESOLVED BY SIMPLIFICATION / VERIFIED |
| Se agregó **Guardar y agregar requerimientos** después de crear un Case, sin cambiar el contrato de creación del Case. | Approved UX improvement | FIXED / VERIFIED |

El flujo **Guardar y agregar requerimientos** usa orquestación frontend: primero
crea el Case mediante el endpoint existente y, con el `caseId` confirmado, abre
el detalle y el alta de Requirement. No introduce Requirements dentro del POST
del Case ni una pseudo-transacción cross-resource.

Una posible secuencia operacional pertenece a los futuros dominios de
Preparation / CaseKit / Maletín. No se definen reglas automáticas de prioridad,
agrupación o secuencia en Requirements V1.

## 6. Matriz manual completada

### 6.1 Preparación utilizada por sesión

Para cada fila de la tabla siguiente se utilizó una sesión independiente:

1. Abrir `http://localhost:3000/login` e iniciar sesión con el usuario indicado.
2. Ir a **Casos de salud** y confirmar que aparecen los tres Cases de Company A.
3. Abrir **Ver detalle** de `QA-A-HC-RQ-DRAFT`.
4. No utilizar el Product asignado a otro rol.

| Rol | Usuario | Product reservado |
| --- | --- | --- |
| ADMIN | `admin.a@qa.example.test` | `QA-A-RQ-ADMIN` |
| MANAGER | `manager.a@qa.example.test` | `QA-A-RQ-MANAGER` |
| SALES | `sales.a@qa.example.test` | `QA-A-RQ-SALES` |
| WAREHOUSE | `warehouse.a@qa.example.test` | `QA-A-RQ-WAREHOUSE` |

### 6.2 Flujo común validado — ADMIN / MANAGER / SALES / WAREHOUSE

Se ejecutó para cada rol:

1. Cambiar **Vigencia** entre **Activos**, **Retirados** y **Todos**; verificar
   que cada vista contiene sólo las vigencias esperadas y que **Todos** contiene
   ambas.
2. Volver a **Activos**, pulsar **Nuevo requerimiento** y crear la línea con el
   Product reservado, cantidad entera mayor que cero, tipo REQUIRED o BACKUP,
   y notas identificando el rol.
3. Abrir **Editar**, cambiar cantidad, tipo o notas y guardar; recargar la
   página y confirmar persistencia.
4. Confirmar que el orden visual estable recibido del backend se conserva al
   recargar. No deben aparecer controles **Subir**, **Bajar**, valores técnicos
   de `sortOrder` ni lenguaje de prioridad o secuencia operacional.
5. Retirar la línea con una razón no vacía; confirmar que desaparece de
   **Activos**, aparece en **Retirados** y conserva la razón.
6. Reactivarla; confirmar que vuelve a **Activos** y que la sesión permanece
   válida.
7. Abrir también `QA-A-HC-RQ-SCHEDULED` y confirmar que las acciones de
   Requirements siguen disponibles.

Para WAREHOUSE, además:

- confirmar que sí dispone de todas las acciones anteriores dentro de
  Requirements;
- confirmar que no aparece **Nuevo caso** ni **Editar** para el Case general;
- confirmar que esta restricción no oculta **Ver detalle** ni Requirements.

### 6.3 Crear Case y continuar con Requirements

Con ADMIN, MANAGER y SALES:

1. Crear un Case con **Guardar y agregar requerimientos**.
2. Confirmar que se crea mediante el flujo normal y se abre su detalle.
3. Confirmar que **Nuevo requerimiento** se abre automáticamente.
4. Repetir con **Guardar caso** y confirmar que conserva el comportamiento
   normal, sin abrir Requirements automáticamente.
5. Confirmar que WAREHOUSE no recibe permisos nuevos de creación o edición del
   Case general.

### 6.4 Case CANCELLED

Con cualquiera de los cuatro roles:

1. Abrir `QA-A-HC-RQ-CANCELLED`.
2. Confirmar que ACTIVE, RETIRED y ALL siguen siendo consultables.
3. Confirmar el aviso de historial read-only.
4. Confirmar ausencia de **Nuevo requerimiento**, **Editar**, **Retirar** y
   **Reactivar**.
5. Confirmar que no aparece un error genérico y que la sesión sigue activa.

Esto valida la UX de `CASE_REQUIREMENTS_READ_ONLY`; su respuesta API también
permanece cubierta por pruebas automatizadas.

### 6.5 Product histórico inactivo

1. Abrir `QA-A-HC-RQ-SCHEDULED` en **Activos**.
2. Confirmar que `QA-A-RQ-HISTORICAL` sigue visible con el indicador
   **Producto inactivo (histórico)**.
3. Editar la línea existente y confirmar que la actualización se permite.
4. Retirarla con una razón y confirmar que el retiro se permite.
5. Ir a **Retirados**, intentar reactivarla y confirmar el mensaje seguro de
   `PRODUCT_INACTIVE`; la línea debe seguir retirada y la sesión intacta.

El fixture DRAFT incluye además una línea RETIRED del mismo Product para probar
el rechazo de reactivation sin alterar primero la línea SCHEDULED.

### 6.6 Errores y cambios de estado

- `REQUIREMENT_ALREADY_ACTIVE`: tras crear la línea reservada de un rol,
  intentar crear otra para el mismo Product y Case; debe mostrarse el mensaje
  específico, sin duplicado ni pérdida de sesión.
- `REQUIREMENT_RETIRED`: después de retirar la línea y antes de reactivarla,
  intentar crearla de nuevo; debe dirigir al flujo de Retirados.
- `PRODUCT_INACTIVE`: usar la reactivation histórica descrita arriba.
- `CASE_REQUIREMENTS_READ_ONLY`: comprobar el Case CANCELLED y ausencia de
  controles; la cobertura API automatizada comprueba el rechazo estable.
- `RESOURCE_STATE_CHANGED`: si se prueba con dos sesiones, cargar el mismo
  registro en ambas y ejecutar transiciones incompatibles; la sesión perdedora
  debe pedir recargar sin perder autenticación. Si no se fuerza manualmente, la
  cobertura de concurrencia automatizada permanece como evidencia.

### 6.7 Resultado manual

La matriz final quedó:

```text
ADMIN     → PASS
MANAGER   → PASS
SALES     → PASS
WAREHOUSE → PASS
```

Healthcare Requirements V1 queda `COMPLETE / ACCEPTED`. RQ-006 conserva el
contrato `RequirementOperationalEvidencePolicy`, pero su integración con
evidencia real de fulfillment continúa diferida hasta futuros productores como
Dispatch, Equipment Assignment o Custody.
