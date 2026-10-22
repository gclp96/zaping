# HC-DSP-COR-01 — Corrección auditada de Dispatch confirmado (sin entrega física)

**Producto:** Zaping Healthcare
**Milestone:** M-HC1 — Healthcare Operations Foundation
**Versión:** 0.8 — Consolidación documental del contrato técnico V0.7 aprobado, con aprobación 01A anexa
**Estado actual:** TECHNICAL DESIGN APPROVED; 01A/01B integrados, 01C-A DONE / MERGED (PR #105), cierre A PR #106; **01C-B DONE / MERGED (PR #109, main@7ee270b)**. 01C-C pendiente de DoR y concurrencia global. Corrección operativa deshabilitada. Corrección operativa deshabilitada.
**Base documental revisada:** `main`, después de los PR #99 y #100; contraste de rutas existentes de Dispatch, Reconciliation, PhysicalInventory y EquipmentCustodyClose.
**Prioridad propuesta:** P0 — release gate de corrección/reversión auditada de Dispatch.
**Alcance:** Backend y aceptación PostgreSQL; frontend en ticket posterior.

> **Alcance de la aprobación:** el responsable de producto aprobó expresamente el contrato técnico V0.7 y las seis decisiones DEC-DSP-COR-TD-01..06; constancia en §18. Los nombres exactos de campos, SQL, DTO, respuestas públicas y plan de locks siguen sujetos a validación durante los slices 01B..01F. Esta aprobación no autoriza despliegue, cutover de Company real, migración sobre datos reales ni exposición anticipada de una ruta de compensación.

## 1. Motivación y necesidad de negocio

En la operación descrita de INSAP, los errores de saldos disponibles se corrigen mediante ajuste manual con observación, sin enlace obligatorio a una entrada/salida. Zaping conservará esa facilidad para el inventario **AVAILABLE**; no debe convertir el ajuste manual en un bypass de posiciones **CUSTODY** ni de la trazabilidad Equipment.

El contrato vigente de Dispatch establece que `CONFIRMED` es un hecho histórico inmutable. Confirm crea transferencias de material **AVAILABLE → CUSTODY** y/o abre episodios de custodia Equipment; la mera edición de `Product.stock` o la creación de una devolución ficticia no revierte esos hechos. Return/Reconciliation existente representa recepción/consumo *real*, no corrección de una entrega que nunca ocurrió.

**Objetivo de V1:** revertir de manera **completa**, auditada y atómica la *consecuencia física registrada* de un único Dispatch confirmado por error, únicamente cuando un responsable autorizado certifique que **ninguno de sus recursos salió físicamente del almacén**. La vista operativa deberá identificar la corrección, sin falsificar una devolución o reconciliación.

## 2. Alcance propuesto y límites

### Incluido

- Un comando explícito `CORRECT_NO_HANDOFF` vinculado a **un Dispatch CONFIRMED** y a todas sus fuentes `ACTIVE`.
- Declaración expresa de ausencia de entrega física, motivo obligatorio, actor y momento de confirmación.
- Evidencia durable de cada material/equipo compensado, con provenance del Dispatch/Item y efectos físicos nuevos, sin reescribir los originales.
- Material `QUANTITY`: `TRANSFER` de su `InventoryPosition` exacta **CUSTODY → AVAILABLE**, preservando `companyId`, `productId`, `inventoryBatchId` y cantidad; `Product.stock` *owned* no aumenta; la proyección `Batch.availableQuantity` se restaura conforme a la transferencia.
- Equipo `ASSET`: cerrar *exactamente* el episodio `EquipmentAssetCustody` abierto por ese Dispatch, devolver su ubicación lógica de `CUSTODY` a `WAREHOUSE`, limpiar `activeCustodyId`, incrementar `physicalRevision` y anexar un único evento `CUSTODY_CLOSE` con origen **corrección**, no de devolución. **DEC-DSP-COR-EQ-01 (APROBADA):** preservar la `condition` actual verificada del Asset y su `lifecycle`, sin restablecer automáticamente `GOOD` ni su disponibilidad.
- Operación idempotente, tenant-safe, con bloqueos físicos y transacción única.
- Actualizar las lecturas operativas para mostrar **«Corregido — sin entrega física»** y señalar que se trata de una corrección de registro, no de una devolución física o de una reconciliación completada (**DEC-DSP-COR-READ-01 — APROBADA**).

### Excluido expresamente de V1

- Reversión parcial o selectiva de líneas.
- Modificar el root/item/snapshot/folio/audit de `HealthcareCaseDispatch` ya `CONFIRMED`.
- Modificar/cancelar un `HealthcareCaseReconciliation` confirmado.
- Revertir un Dispatch con entrega física real, con evidencia de salida posterior, o con custodia/consumo/reconciliación incompatible. No cancelar automáticamente reconciliaciones `DRAFT` vinculadas.
- Restaurar automáticamente la `preparedQuantity` o la capacidad de Dispatch del CaseKit, ni cambiar estados de Case/CaseKit/Assignment.
- Ajustes manuales sobre `CUSTODY`, creación de una devolución `RETURNED` ficticia, `COUNT_CORRECTION` en `CUSTODY`, alta de ASSET sin identidad o material `SERIALIZED`.
- Implementación de frontend, cutover de Company real, deployment o certificación operativa externa.

## 3. Invariantes vinculantes heredadas

1. `HealthcareCaseDispatch` conserva `status=CONFIRMED`, `confirmedAt/confirmedBy`, `snapshot`, items y auditoría inmutables. El rótulo operativo «Corregido — sin entrega física» es **derivado** de la corrección confirmada, no un nuevo estado persistido en el Dispatch original.
2. Dispatch, Reconciliation, posiciones físicas y custodia Equipment preservan identidad/tenant y auditoría original.
3. Reconciliation `CONFIRMED` es terminal; no se pueden reconstruir resultados `RETURNED/USED` como si nunca hubiesen sucedido. Cualquier Reconciliation `DRAFT` del Dispatch bloquea la corrección hasta que sea cancelada explícitamente por su flujo existente. Las `CANCELLED` se conservan como historia.
4. Las posiciones físicas son autoridad de cantidades `QUANTITY` una vez activada la autoridad `PHYSICAL`; `Product.stock` es proyección *owned*, no caja de ajustes de custodia.
5. **DEC-DSP-COR-EQ-01 — APROBADA:** `EquipmentAssetCustody` original sólo se cierra una vez; al trasladar la ubicación lógica de `CUSTODY` a `WAREHOUSE`, `EquipmentAsset.condition` y `EquipmentAsset.lifecycle` permanecen exactamente como se verificaron en la relectura autoritativa. Ni `GOOD` ni `ACTIVE` se asignan de forma automática; ubicación `WAREHOUSE` no garantiza disponibilidad derivada.
6. No se omiten los fences, locks, CAS, restricciones diferidas, errores fail-closed y timeouts aprobados.

## 4. Reglas de admisión (propuesta)

Se exige **todo** lo siguiente en lectura autoritativa dentro de la transacción:

- `Company` proviene del JWT, Dispatch pertenece al `Case` indicado, root `CONFIRMED`, no está ya corregido por otra operación.
- Hay al menos un ítem `ACTIVE` y todos tienen evidencia original completa y estructuralmente coherente.
- **DEC-DSP-COR-ATTEST-01 — APROBADA:** el `ADMIN` o `MANAGER` que confirma declara expresamente `noPhysicalHandoffConfirmed=true` y escribe un motivo obligatorio. El sistema registra actor y fecha del servidor. La declaración es **responsabilidad humana**: el sistema no puede demostrar por sí solo un hecho físico negativo.
- **DEC-DSP-COR-REC-01 — APROBADA:** no puede existir ninguna Reconciliation `CONFIRMED` ni `DRAFT` asociada al Dispatch. Si existe alguna `DRAFT`, debe cancelarse **explícitamente mediante el comando de cancelación existente** antes de intentar la corrección. La corrección **no cancela ni modifica** drafts por sí misma. Las Reconciliation `CANCELLED` históricas no bloquean siempre que sean coherentes con el contrato de cero efectos físicos y con la evidencia física restante; su historia permanece íntegra. Si una `CANCELLED` conserva evidencia física incompatible, **fail-closed**.
- Cada material mantiene **exactamente** el saldo del handoff en su `CUSTODY` originaria, identidad/lote/contexto correctos, revisión coherente y sin efectos posteriores de disposición o mutación que no estén expresamente permitidos.
- Cada Equipment conserva el mismo `activeCustodyId`, Asset/Company/Case/Assignment de la apertura, custodia `OPEN`, localización `CUSTODY` y continuidad verificable de historial/revisión; cualquier mutación física posterior no admitida bloquea. La `condition` actual debe releerse y comprobarse bajo locks antes de cerrar; su preservación **no** autoriza ignorar discrepancias de provenance, revisión o estado físico.
- Para material, Company opera en autoridad `PHYSICAL` con runtime y fence válidos; estados `LEGACY`, `CUTOVER` o `RECOVERY_REQUIRED` rechazan. Equipment-only conserva su independencia de cutover QUANTITY, sujeto al protocolo HC y al control operativo externo existente.
- Si cualquier precondición falla, **no se escribe ninguna corrección ni ningún efecto físico parcial**.

**Política de seguridad aprobada para V1 (DEC-DSP-COR-ATTEST-01):** únicamente `ADMIN` o `MANAGER` confirma la excepción con declaración expresa y motivo obligatorio; `WAREHOUSE` y `SALES` pueden consultar, pero no confirmar. **La verificación obligatoria por una segunda persona no forma parte de V1** y queda como posible endurecimiento futuro, sin inferir que una simple declaración pruebe la ausencia física de entrega.

## 5. Persistencia aprobada a nivel de contrato — SQL e integridad por concretar en 01B

Crear un agregado separado, por ejemplo:

- `HealthcareCaseDispatchCorrection`: `id (UUID)`, `companyId`, `caseId`, `dispatchId`, `kind=NO_PHYSICAL_HANDOFF`, `reason`, `attestedNoHandoff`, `confirmedById`, `confirmedAt`, `snapshotVersion`, `snapshot`, `requestHash` o vínculo a `IdempotencyRecord`.
- `HealthcareCaseDispatchCorrectionItem`: `companyId`, `correctionId`, `sourceDispatchItemId`, `type`, `originalPhysicalEvidence`, `compensatingPhysicalEffectId` para material o `custodyId`/`closePhysicalEventId` para Equipment, más snapshot del antes/después.
- Restricción durable **a lo sumo una corrección confirmada por Dispatch** y relaciones compuestas tenant-safe. No `UPDATE` del Dispatch original.
- **DEC-DSP-COR-TD-01 aprobada:** V1 tendrá testigo terminal en un solo commit y sin DRAFT público. El staging interno transaccional y los constraints diferidos concretos se definen/validan en 01B.
- Usar el mismo framework de `IdempotencyRecord`, con un scope propio y hash versionado de la intención. No almacenar llaves/tokens en snapshots.

Validar restricciones DB, índices, integridad cruzada y compatibilidad de consumidores antes de migrar. No reutilizar la tabla de Reconciliation para simular una devolución que no ocurrió.

## 6. Efectos compensatorios y proyecciones

### 6.1 MATERIAL — QUANTITY

- Obtener del `HealthcareCaseDispatchItem` la `destinationPositionId` de `CUSTODY` y el `physicalEffectId` original.
- Tras locks y relectura autoritativa, transferir exactamente `item.quantity` desde **esa** Position `CUSTODY` hacia la Position canónica `AVAILABLE` del mismo Product/batch. No inferir otra fuente ni usar FEFO/FIFO.
- Usar nuevo origen físico tipado, conceptualmente `CASE_DISPATCH_CORRECTION` / `correctionId` / `COMPENSATE_NO_HANDOFF_QUANTITY`, con `kind=TRANSFER`.
- El `owned` total y, por tanto, `Product.stock` no cambian; si hay batch, `Batch.availableQuantity` aumenta por el saldo que vuelve a `AVAILABLE`; el historial registra el nuevo Effect/Lines.
- No incrementar `preparedQuantity` del Kit ni reescribir el Transfer original.

### 6.2 EQUIPMENT — ASSET

**DEC-DSP-COR-EQ-01 — APROBADA (funcional):** la corrección conserva la **condición actual verificada** del equipo. El regreso de su ubicación lógica a `WAREHOUSE` no lo cambia automáticamente a `GOOD` ni implica que esté disponible para una nueva asignación.

- No fabricar `RETURNED` ni invocar el flujo de Reconciliation con un episodio falso.
- Reutilizar la primitiva de cierre de custodia **sólo si** su contrato permite un origen de compensación explícito y verificable; registrar/autorizar un adapter propio `CASE_DISPATCH_CORRECTION_ITEM` si es necesario. Nunca bypass del registry o del guard temporal.
- Comprobar episodio exacto abierto y continuidad de Asset/eventos. Bajo locks, leer y validar `condition`, `lifecycle`, `physicalLocation`, `activeCustodyId`, `physicalRevision` y hechos históricos coherentes con la declaración de no entrega. Si la evidencia es contradictoria, **fail-closed**; no normalizar el Asset para permitir la compensación.
- Cerrar la custodia exacta, mover **sólo ubicación** `CUSTODY → WAREHOUSE`, poner `activeCustodyId=null`, incrementar `physicalRevision` y anexar un único `CUSTODY_CLOSE` con provenance a la corrección. La `condition` y el `lifecycle` en la evidencia antes/después son iguales a los valores autoritativos verificados; no se inventa un cambio de condición ni un `EquipmentInspection`.
- Conservar una condición verificada `GOOD`, `INSPECTION_PENDING`, `DAMAGED` u `OUT_OF_SERVICE` **sin convertirla automáticamente a `GOOD`**. Si después queda en `WAREHOUSE` con condición distinta de `GOOD`, **no es elegible** por la regla vigente de disponibilidad (`ACTIVE + GOOD + WAREHOUSE` con puntero coherente). Tampoco reactivar `RETIRED`.
- No liberar ni modificar automáticamente Assignment.

**Pendiente técnico, no aprobado:** validar compatibilidad de `EquipmentCustodyService.returnFromCustody` y de sus guardas de tiempo/condición con este origen compensatorio; definir el adapter/registry y los casos admisibles de cambios físicos intermedios. La decisión funcional no autoriza abrir un bypass del guard temporal ni ampliar la política de mutaciones posteriores.

### 6.3 MIXTO

Todos los Effects, proyecciones, cierres, eventos, snapshots, confirmación de corrección, auditoría y completion idempotente pertenecen a **una sola transacción**. Fallar una línea revierte todas.

## 7. Compatibilidad con Return/Reconciliation y lecturas — DEC-DSP-COR-READ-01 APROBADA

**DEC-DSP-COR-READ-01 — APROBADA (decisión funcional):** un Dispatch corregido se presenta con la etiqueta **«Corregido — sin entrega física»**. El registro histórico original **sigue `CONFIRMED`**, y su compensación **no se considera Return, `RETURNED`, `USED` ni Reconciliation `FULLY_RECONCILED`**. La confirmación original y la corrección se consultan como hechos separados.

### 7.1 Separación entre histórico y pendientes operativos

El resumen histórico debe conservar las cantidades originalmente confirmadas y cualquier evidencia de efectos físicos. El resumen operativo, en cambio, **no debe mostrar los recursos compensados por un error sin entrega como custodia pendiente de recuperar**.

La fórmula vigente de Reconciliation `unresolved = dispatched - confirmedReturned - confirmedUsed` describe exclusivamente episodios de despacho **no corregidos** bajo el contrato actual; no se debe manipular introduciendo devoluciones/consumos ficticios para hacerla cuadrar con una corrección. Para Dispatch corregido, el consumidor debe conocer explícitamente el nuevo motivo de resolución e interpretar de forma distinta el saldo accionable, preservando las cifras históricas si se exponen.

El read-model deberá:

- Exponer `status=CONFIRMED` del Dispatch histórico y **un indicador de corrección confirmada independiente**.
- Mostrar **«Corregido — sin entrega física»** como estado **operativo derivado**, no como mutación de `HealthcareCaseDispatch.status`.
- Hacer visible el identificador, motivo, actor y momento de la corrección; mantener acceso separado al Dispatch original y al nuevo evento compensatorio.
- No incluir cantidades/material/equipo ya compensados en *pendientes operativos de devolución/custodia*; tampoco contarlos como `returnedQty` o `usedQty` de Reconciliation.
- No clasificar un Dispatch corregido como `FULLY_RECONCILED`; es **no aplicable por corrección sin entrega física**.
- Rechazar la creación/confirmación de nuevos episodios Reconciliation sobre el Dispatch corregido. Una Reconciliation `DRAFT` preexistente impide confirmar la corrección hasta que un usuario la cancele expresamente, y nunca se cancela automáticamente.
- Preservar la capacidad de Dispatch históricamente consumida sobre CaseKit; sin restauración automática de `preparedQuantity` ni disponibilidad para otro Dispatch.

### 7.2 Representación técnica de lectura candidata — compatibilidad y DTO exacto pendientes

Para cumplir la semántica funcional aprobada se **propone**, sujeto a compatibilidad de consumidores y aprobación del contrato API exacto:

- Indicador separado de la historia: `resolutionKind=CORRECTED_NO_HANDOFF` o estructura equivalente vinculada a `HealthcareCaseDispatchCorrection` confirmada.
- Valor de summary `NOT_APPLICABLE_CORRECTED` o respuesta discriminada equivalente, **sin reutilizar** `FULLY_RECONCILED`.
- Propiedad explícita para *pendiente operativo accionable* (cero/no aplicable en el Dispatch completamente compensado), separada de la fórmula histórica de Reconciliation; definir cuidadosamente `null` vs `0` y ausencia de campos antes de exponerla.
- Soporte readback para consumidores API y Web, sin romper contratos existentes de Dispatches no corregidos.

La elección de nombres, enums, shape JSON, evolución de rutas y reglas de agregación en pantallas **sigue pendiente de Technical Design Approval**. Los valores anteriores son ejemplos, no schema ni endpoints aprobados.

**Gate de implementación:** no fusionar la compensación física sin integrar su lectura discriminada y la prevención de Reconciliation posterior. La decisión funcional está aprobada; quedan pendientes el contrato API exacto y la verificación de consumidores.

## 8. API aprobada a nivel de ruta y permisos — DTO/códigos concretos pendientes

`POST /healthcare/cases/:caseId/dispatches/:dispatchId/corrections/no-handoff`

Headers: `Authorization: Bearer <JWT>`; `Idempotency-Key: <key>`.

Body conceptual:

```json
{
  "reason": "La salida se confirmó por error; el material y equipo permanecieron en almacén",
  "noPhysicalHandoffConfirmed": true
}
```

- `companyId`, actor y tiempo siempre se derivan del servidor/contexto autenticado.
- `201` al confirmar por primera vez; `200` en replay según contrato que se apruebe. Mismatch de clave: `409` sin escrituras.
- Otro comando para el mismo Dispatch: devolver conflicto estructurado o readback histórico, según intención/idempotencia; nunca ejecutar dos correcciones.
- `GET` detail/read se diseñará junto con el contrato de resolución y permisos.
- Errores tipados: `DISPATCH_NOT_CORRECTABLE`, `DISPATCH_ALREADY_CORRECTED`, `DISPATCH_RECONCILIATION_EXISTS`, `PHYSICAL_STATE_CHANGED`, `INVENTORY_AUTHORITY_REQUIRED`, entre otros **candidatos**, sin exposición de SQL. Ante `DRAFT` vinculada, conflicto explicable y acción requerida: cancelar el borrador por su endpoint habitual y luego reintentar con una nueva intención autorizada; no auto-cancelación.

## 9. Transacción, orden de locks y concurrencia

La secuencia final **debe validarse contra el código integrado** antes de declararse aprobada:

1. Detectar replay completado mediante evidencia durable, antes de gates vivos, sin permitir dobles efectos.
2. Cuando haya material: adquirir el **Inventory shared authority fence** antes del HC Company lock; validar autoridad PHYSICAL/runtime.
3. Adquirir claim idempotente y el **HC Company exclusive advisory lock** con protocolo/timeouts existentes.
4. Bloquear raíces empresariales Dispatch/items/Reconciliations relevantes y raíces físicas en orden determinista compatible con Dispatch Confirm, RR Confirm, Inspection/Retirement y demás writers.
5. Releer historia, saldos/revisiones, existencia y estado de **todas** las reconciliaciones y validación de no mutación posterior **bajo los locks**; el preflight solo no autoriza escrituras. Serializar correctamente con create/cancel/confirm de Reconciliation para impedir que se cree o confirme un episodio entre la verificación y el commit.
6. Aplicar efectos compensatorios, proyecciones, cierres/eventos Equipment y evidencia de corrección; validar constraints diferidas, commit único.
7. Una key repetida con misma intención retorna el testigo histórico sin repetir los efectos, incluso si desde entonces cambió el estado vivo; key con hash distinto falla.

No crear transacciones anidadas, ampliar timeouts especulativamente ni confiar en una validación de lectura fuera de la transacción. La adquisición final y cualquier nuevo namespace físico requieren revisión de deadlocks y de pruebas PostgreSQL con conexiones reales.

## 10. QA / Acceptance Criteria propuestos

**Funcionales:**

- Confirm erróneo QUANTITY `NONE`, `OPTIONAL` con y sin batch y `REQUIRED` con lote, y comparación exacta `AVAILABLE`, `CUSTODY`, `owned`, `Product.stock`, `Batch.availableQuantity` y ledger antes/después.
- Confirm erróneo Equipment-only y MIXTO: custodia exacta, condición/lifecycle preservados, evento correcto y sin mutación Assignment. Cubrir explícitamente `GOOD`, `INSPECTION_PENDING`, `DAMAGED` y `OUT_OF_SERVICE` cuando las precondiciones de provenance sean válidas; para condiciones no elegibles verificar `WAREHOUSE` con **disponibilidad derivada falsa**, sin transición artificial a `GOOD`, y `RETIRED` sin reactivación.
- Original Dispatch/snapshot/folio/actor/audit **byte-for-byte estables**; nuevo registro compensatorio rastreable, sin mutación de `HealthcareCaseDispatch.status=CONFIRMED`.
- Reconciliation posterior se rechaza; summary y UI/read model muestran **«Corregido — sin entrega física»**, sin pendiente operativo ficticio, sin sumar `RETURNED`/`USED` y sin clasificar `FULLY_RECONCILED`. Verificar históricos y agregados en las consultas.
- No recuperación automática de capacidad CaseKit.

**Negativas e integridad:**

- Rechazos zero-write si hubo Reconciliation confirmada o DRAFT abierta, consumo/retorno, cambio posterior de Position, revisión stale, custodia ya cerrada, cambio de Asset, fuente incoherente, cross-tenant, error de rol o falta de atestación. Reconciliation `CANCELLED` sin efectos y con estado físico íntegro **permite** continuar, sin reabrirse ni mutarse.
- Reintentos con misma key; distinta key tras corrección; misma key con otra intención; respuesta perdida; actor distinto en replay. Sin doble Effect/evento/audit.
- Concurrencia con RR Create/Cancel/Confirm (incluido DRAFT que se cancela justo antes de la corrección), otro intento de corrección, Inventory writer, Equipment Inspection/Retirement y Dispatches relacionados, con conexiones PG independientes, observación real de locks y consistencia al commit. Caso de prueba: el corrector rechaza un DRAFT hasta cancelación explícita; no confirma si RR crea/confirma un episodio incompatible en carrera.
- Rollback inducido después de cada clase de efecto (material, batch/proyección, Equipment, snapshot/audit/claim): **cero estados parciales**.
- PostgreSQL 16 aislado y efímero, migraciones aplicadas sólo en la base de prueba; cleanup demostrado; nunca tocar `zaping_dev`, `zaping_qa` ni Company real.
- Typecheck, ESLint, formato, Prisma validate/migrations, build, tests API/Web consumidores y QA manual cuando corresponda.

**RISK-006:** conservar `OPEN / NOT REPRODUCED`. Cubrir el guard temporal de cierre Equipment con pruebas de timestamps; si el fallo reaparece, registrar operandos y contexto de manera segura para diagnóstico, sin cambiar código funcional o timeout sin causa verificada.

## 11. Backlog refinado / gestión de proyecto — V0.7

**Secuencia de trabajo sugerida; tickets todavía no creados en GitHub.** Los códigos y alcances son propuestas, y los Story Points se estimarán en refinamiento. Se evita un slice monolítico que reúna Inventory, Equipment, lecturas y concurrencia. La integración pública de la corrección queda **cerrada** hasta que todos los slices estén validados conjuntamente.

| Ticket propuesto | Objetivo | Dependencia / gate | Estado |
| --- | --- | --- | --- |
| `HC-DSP-COR-01A` — Contract & ADR | Aprobar decisiones técnicas pendientes: esquema, estados de summary, manejo Equipment y protocolo de locks. Documentar compatibilidad y secuencia aprobada. | Este documento V0.7 + revisión humana | `REFINEMENT` |
| `HC-DSP-COR-01B` — Persistence & Witness | Prisma/migraciones/constraints tenant-safe, root + items inmutables, auditoría, identificación histórica y lectura interna de evidencia. Sin comando físico público. | 01A aprobado | `BACKLOG` |
| `HC-DSP-COR-01C` — QUANTITY Compensation | Material `CUSTODY → AVAILABLE`, autoridad/fence, batch/proyecciones, idempotencia, rollback y tests sin ruta pública. | 01B + contrato lock | `BACKLOG` |
| `HC-DSP-COR-01D` — Equipment Compensation | Adapter `CASE_DISPATCH_CORRECTION_ITEM` y cierre Equipment vía primitiva caller-owned con condition/lifecycle preservados; casos no admitidos fail-closed. | 01B + política de eventos | `BACKLOG` |
| `HC-DSP-COR-01E` — Reconciliation/Read Integration | Serializar contra RR `CREATE/CONFIRM`; bloquear nuevos RR después de corrección, read model discriminado de Dispatch y summary, validar consumidores. **Gating conjunto** con 01C/01D. | 01B; integrar 01C/01D | `BACKLOG` |
| `HC-DSP-COR-01F` — PostgreSQL & Release QA | E2E sobre dos conexiones reales, casos mixtos, auditoría, replay, constraints, rollback, compatibilidad de lectores y cierre de documentación. | 01B–01E integrados | `BACKLOG` |

### Definition of Ready para 01B

1. Aprobación humana de decisiones de §17.1, incluidos estado de lectura y política de eventos intermedios Equipment.
2. Matriz exacta de modelos, relaciones tenant-safe e índices/constraints SQL revisada para coexistir con Reconciliation y Equipment.
3. Plan de locking con replay/claim y fence Inventory que no invierta el protocolo actual; validación obligatoria mediante E2E de dos sesiones en 01F.
4. Contrato de error/RBAC/API y de consumidores definido. No se asignan SP, fecha, `Commitment` ni `Actual` sin refinamiento.

### Definition of Done del conjunto

Funcionalidad accesible **sólo** cuando se cumplan conjuntamente los criterios de §10 y §17.2, con migraciones, CI, pruebas PostgreSQL reales, lecturas/admission coherentes, revisión humana y documentación de cierre. `RISK-006` continúa abierto. El cierre backend **no** equivale a cutover real ni autorización de producción.

## 12. Registro de decisiones y pendientes antes de aprobar el Technical Design

1. **DEC-DSP-COR-ATTEST-01 — APROBADA:** declaración expresa de no entrega y motivo obligatorio por `ADMIN`/`MANAGER`; actor/fecha del servidor. Segunda aprobación por una persona distinta: **diferida, no exigida en V1**.
2. **DEC-DSP-COR-READ-01 — APROBADA (funcional):** mostrar **«Corregido — sin entrega física»**, conservar `status=CONFIRMED`, no representar como Return ni `FULLY_RECONCILED`, eliminar falsos pendientes operativos al compensar. **PENDIENTE:** definir campos/enums/semántica `null` vs `0` y contrato concreto de `reconciliation-summary` tras revisar consumidores.
3. **DEC-DSP-COR-REC-01 — APROBADA (funcional):** ninguna Reconciliation `CONFIRMED` o `DRAFT` permite la corrección. La `DRAFT` debe cancelarse expresamente con el comando existente; sin cancelación automática. Las `CANCELLED` coherentes y sin efectos físicos no bloquean; conservar su historia. **PENDIENTE técnico:** verificar coordinación transaccional y locks con RR Create/Cancel/Confirm.
4. **DEC-DSP-COR-EQ-01 — APROBADA (funcional):** preservar la condición actual verificada y el lifecycle al compensar la custodia del Equipment y situarlo en `WAREHOUSE`; no forzar `GOOD`, reactivar `RETIRED` ni marcar disponible un Asset no elegible. **PENDIENTE técnico:** compatibilidad de la primitiva y guard temporal, adapter/registry de origen compensatorio y tratamiento de mutaciones intermedias válidas.
5. **Esquema/API exactos, lock ordering y scopes de idempotencia:** sujetos a diseño detallado y aceptación sobre repositorio integrado.

## 13. Hallazgos verificados del código integrado (`main`, revisión para V0.6)

Esta sección separa **hechos comprobados en código** de propuestas. No representa pruebas ejecutadas ni aprobación de un cambio.

| Superficie | Hecho verificado en `main` | Consecuencia obligatoria |
| --- | --- | --- |
| `case-reconciliations/healthcare-case-reconciliation-summary.ts` | MATERIAL verifica `p.quantity === dispatchedQty - returnedQty - usedQty`; Equipment exige un cierre con evidencia `CASE_RECONCILIATION_ITEM` y `CONFIRM_EQUIPMENT_RETURN`. | Una transferencia/cierre por corrección causará error de integridad si el summary sigue igual. La lectura discriminada es **parte del mismo release**, no seguimiento opcional. |
| `case-reconciliations/healthcare-case-reconciliations.repository.ts` | `summarySourceInclude` sólo reúne reconciliaciones `CONFIRMED` y sus efectos; `summary()` retorna fuentes del Dispatch. | Debe obtenerse también la corrección confirmada y su evidencia en un **mismo snapshot de lectura**; no inferir resolución por Position vacía. |
| `case-reconciliations/healthcare-case-reconciliation-command.service.ts` y `...command.repository.ts` | `CREATE` bloquea `HealthcareCase` y `HealthcareCaseDispatch` con `FOR KEY SHARE`, comprueba únicamente que el Dispatch esté `CONFIRMED` y crea DRAFT. **No adquiere el HC Company exclusive lock** en esa ruta. | El HC Company lock de la corrección **no basta** por sí mismo. Debe reforzarse `CREATE` para rechazar Dispatch corregido después de adquirir el lock del Dispatch; la corrección debe serializar con ese mismo root. |
| `case-reconciliations/healthcare-case-reconciliation-confirm.service.ts` y repositorio | `CONFIRM` adquiere Inventory fence cuando hay MATERIAL positivo, luego HC Company lock y locks de estructuras/físicos. Bloquea Dispatch con `FOR SHARE` y fuentes con `FOR UPDATE`. | La corrección debe coordinarse con ese orden; se requiere suite PostgreSQL de carreras reales `CORRECT` vs `CREATE/CANCEL/CONFIRM`. |
| `equipment/equipment-custody-close.service.ts` | Existe `returnFromCustody(tx, ...)` caller-owned; exige HC advisory lock exclusivo, custodia exacta abierta, `physicalRevision` y continuidad de eventos; registra un `CUSTODY_CLOSE`, avanza revisión y deriva condición desde `reportedCondition`. | Hay primitiva reutilizable, pero **no** origen autorizado de corrección todavía. Necesita adapter propio y pasar la `condition` autoritativa revalidada, no un valor del cliente. |
| `equipment/equipment-custody-close-context.registry.ts` | Los adapters se registran mediante `EQUIPMENT_CUSTODY_CLOSE_CONTEXT_ADAPTERS` y validan evidencia durable del caller; no aceptan strings de contexto como prueba. | Registrar adapter `CASE_DISPATCH_CORRECTION_ITEM` con comprobación `APPLY/REPLAY`, sin bypass de permisos ni del guard temporal. |
| `healthcare/case-dispatches/healthcare-case-dispatches.repository.ts` | Las lecturas `list/detail` no incluyen corrección porque aún no existe entidad. | Extensión aditiva en ambas respuestas, manteniendo `status=CONFIRMED`, folio/snapshot y propiedades actuales. |
| `inventory/physical/physical-inventory.service.ts` | `transfer(tx,...)` ya opera sobre Position exacta y revisiones; PhysicalInventory mantiene origen/effects/proyecciones como autoridad. | Reutilizar transferencia con **nuevo origen durable** `CASE_DISPATCH_CORRECTION`, sin ajuste manual ni segundo efecto sobre owned. |

**Riesgo de diseño detectado:** el guard de Equipment (`proveApplyHistory`) acepta continuidad histórica con `condition/lifecycle` coherentes. El diseño debe fijar qué operaciones intermedias se consideran compatibles con una declaración **sin entrega física**. La decisión aprobada de conservar la condición actual **no** equivale a admitir cualquier historial de eventos posterior a `CUSTODY_OPEN`.

## 14. Contrato técnico aprobado en alcance — requisitos concretos de implementación

Los siguientes detalles son propuestas concretas para dejar listo el trabajo de implementación; **NO ESTÁN APROBADOS** por las decisiones funcionales previas.

### 14.1 Persistencia y garantías durables

**Root sugerido:** `HealthcareCaseDispatchCorrection`, con `id`, `companyId`, `caseId`, `dispatchId`, `kind=NO_PHYSICAL_HANDOFF`, `reason`, `attestedNoHandoff`, `confirmedById`, `confirmedAt`, `snapshotVersion`, `snapshot` y relaciones tenant-safe. **Único por (`companyId`, `dispatchId`)** en V1: sólo se admite una corrección total por Dispatch.

**Items sugeridos:** `HealthcareCaseDispatchCorrectionItem`, exactamente uno por `HealthcareCaseDispatchItem ACTIVE` corregido, con `companyId`, `correctionId`, `dispatchId`, `sourceDispatchItemId`, `type`, evidencia de origen y de compensación (`physicalEffectId` compartible entre líneas MATERIAL; `custodyId`/`closePhysicalEventId` para Equipment), más snapshot de antes/después. Unicidad (`correctionId`, `sourceDispatchItemId`) y FKs compuestas que exijan el mismo tenant y Dispatch.

**Lifecycle:** un comando sin DRAFT público. Insertar evidencia de trabajo y confirmar dentro de la **misma transacción**; el estado intermedio, si se necesitara para el adapter, debe ser exclusivamente transaccional y no poder quedar persistido sin evidencia completa. Confirmación en un solo commit; prohibidos PATCH/DELETE o `UPDATE` de Dispatch original. La decisión de usar o no una raíz `PENDING` interna debe cerrarse con constraints/migración auditadas.

**Integridad DB:** índice UNIQUE para la corrección por Dispatch, identidades de fuente y de episodio Equipment, FK compuestas, `RESTRICT` en evidencias, índice de lectura por Company/Case/Dispatch y checks aplicables. El backend debe revalidar que el conjunto exacto de `ACTIVE` coincide con los items de corrección antes de confirmar; no basta con el número de filas. El mecanismo final de comprobación al commit requiere diseño de constraints diferidas o alternativa equivalente, nunca lógica sólo en frontend.

**Idempotencia:** un scope nuevo de `IdempotencyRecord` para `CONFIRM_NO_HANDOFF_CORRECTION`. Hash versionado sobre `companyId`, `caseId`, `dispatchId`, `kind`, revisión esperada si el contrato la incluye, motivo canónico y declaración; excluir actor, timestamp y revisiones físicas generadas/descubiertas por servidor. Mismo `scope+key+hash`: readback histórico, cero efectos repetidos incluso después de cambios vivos; hash distinto: `409`; distinta key sobre Dispatch ya corregido: conflicto estable o witness original según contrato final, pero **nunca otro Effect/CUSTODY_CLOSE**. `resourceId` apunta a `correction.id` en el mismo commit.

### 14.2 API y RBAC candidatos

```http
POST /healthcare/cases/:caseId/dispatches/:dispatchId/corrections/no-handoff
Idempotency-Key: <clave>
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "reason": "Se confirmó la salida por error; no hubo entrega física",
  "noPhysicalHandoffConfirmed": true
}
```

- Solo `ADMIN/MANAGER` ejecutan. Exigir clave, declaración explícita `true`, motivo no vacío y actor `User` activo del mismo Company; no aceptar actor, tenant, condición Equipment, balances o timestamps del cliente.
- `201` primer confirm, `200` replay lógico son **propuestas** (confirmar convenciones HTTP con controladores existentes). `GET` corrección individual y extensiones de `GET dispatches/:id`, `GET dispatches` y summary disponibles para ADMIN/MANAGER/WAREHOUSE/SALES sólo lectura.
- Errores tipados propuestos por rol, inexistencia cross-tenant como `404`, reconciliación DRAFT/CONFIRMED, historia contradictoria, cambio de revisión, falta de autoridad PHYSICAL, duplicado y conflicto de idempotencia. No exponer SQL ni detalles de otros tenants.
- El permiso de `WAREHOUSE` para Dispatch/Return **no** concede permiso para aprobar la excepción sin entrega física.

### 14.3 Orden de concurrencia y coordinación con Reconciliation

**Peligro confirmado:** `Reconciliation CREATE` toma `FOR KEY SHARE` en el Dispatch y sólo revisa `status=CONFIRMED`. Por tanto, la corrección no puede depender únicamente del lock HC, de un `SELECT` de reconciliaciones antes del lock ni de una UNIQUE sobre correcciones.

**Estrategia candidata, sujeta a aceptación PostgreSQL y revisión de deadlocks:**

1. Clasificar intención/evidencia de un Dispatch sin elevarla a autoridad; replay validado primero.
2. En cualquier corrección que incluya MATERIAL QUANTITY, obtener `Inventory shared authority fence` antes del HC Company lock; claim e identidad runtime/PHYSICAL conforme protocolo vigente.
3. Adquirir HC Company lock exclusivo y `HealthcareCase` lock compatible. **Bloquear la fila del Dispatch con `FOR UPDATE` sin modificar sus campos**, serializando con `CREATE` (`FOR KEY SHARE`) y `CONFIRM` (`FOR SHARE`). Respetar el orden de roots con los adapters físicos y locks de CaseKit/Assignment; no introducir upgrades peligrosos de locks.
4. Bajo ese lock, releer todas las Reconciliations del Dispatch y confirmar que ninguna sea `DRAFT` o `CONFIRMED`; las `CANCELLED` quedan históricas. Después bloquear raíces físicas en orden **Product → Batch → Position → Asset → Custody**, compatible con escritores existentes, y revalidar hechos/pool exactos.
5. **Modificar el admission transaccional de Reconciliation `CREATE`** para comprobar, *después de su `FOR KEY SHARE`*, la existencia de corrección confirmada del Dispatch y rechazarla. `ITEM_ADD`/`OUTCOME_SET` y `CONFIRM` deberán fallar cerrado ante cualquier corrección, con protección del mismo root/locks. Esto cierra la carrera posterior al commit sin reescribir Dispatch `CONFIRMED`.
6. Crear corrección/ítems y audit/claim, transferir MATERIAL y cerrar Equipment mediante adapter de corrección (origen único), registrar todas las referencias y cerrar el witness, validar constraints antes de commit.

Esta es una **secuencia candidata**, NO un orden de locks aprobado. El orden real de `IdempotencyRecord`, Case, Dispatch, reconciliation roots, Item, Position, EquipmentAsset/EquipmentAssetCustody y auditoría debe fijarse mediante el código y las pruebas de dos conexiones; si aparece inversión/no-progress, **STOP** y rediseñar, nunca saltar un fence ni agregar timeout arbitrario.

### 14.4 Reutilización de Equipment — contrato candidato del adapter

- `validatedContext.adapterKey = CASE_DISPATCH_CORRECTION_ITEM`, `contextId = correctionItem.id`.
- `durableOrigin.type = CASE_DISPATCH_CORRECTION_ITEM`, `id = correctionItem.id`, `operation = COMPENSATE_NO_HANDOFF_EQUIPMENT`.
- El adapter `APPLY` comprobará correction/claim/audit del mismo Company/Case/Dispatch, actor ADMIN/MANAGER, declaración y motivo; `sourceDispatchItem` ACTIVE, asset/Assignment/custody coincidentes, idempotencia y ausencia de Reconciliations activas/confirmadas. El adapter de registro **solo lee evidencia**; no adquiere locks tardíos ni aplica cambios físicos.
- El caller suministra `expectedPhysicalRevision` obtenida bajo locks y `reportedCondition = asset.condition` releída. La primitiva retorna `CLOSED`, dejando `condition` y `lifecycle` iguales al valor verificado, y avanza ubicación/revisión/evento una sola vez. `REPLAY` debe validar testigo histórico y origin en el evento propio, sin comparar contra condición viva posterior.
- Cambios `CONDITION_CHANGE` o `LIFECYCLE_CHANGE` intermedios no deben admitirse automáticamente: requieren continuidad del historial, `custodyId` correcto, ausencia de otra entrega/cierre y una decisión de **whitelist limitada** de eventos compatibles. Historial incompleto o ambiguo implica `409` sin escritura. Preservar el `clock_timestamp` y guard temporal actuales; `RISK-006` sigue `OPEN`.

### 14.5 Lectura discriminada y compatibilidad de consumidores

**No modificar** la ecuación histórica de Reconciliation para fingir `RETURNED` o `USED`. El parser actual falla si la custodia MATERIAL queda en cero o la custodia Equipment se cierra mediante otro origen; por ello, el summary debe comprobar primero una **corrección confirmada íntegra y verificable**, derivar su resolución y dejar el camino existente **idéntico** para Dispatch sin corrección.

**Formato de respuesta candidato (NO APROBADO):**

```json
{
  "dispatchId": "<UUID>",
  "status": "NOT_APPLICABLE_CORRECTED",
  "resolution": {
    "kind": "CORRECTED_NO_HANDOFF",
    "correctionId": "<UUID>"
  },
  "items": [
    {
      "type": "MATERIAL",
      "sourceDispatchItemId": "<UUID>",
      "dispatchedQty": 10,
      "confirmedReturnedQty": 0,
      "confirmedUsedQty": 0,
      "actionablePendingQty": 0,
      "correctedNoHandoffQty": 10
    }
  ]
}
```

Esto **extiende la unión** de `status`; deben verificarse consumidores de API/Web y versiones del cliente **antes** de decidir si ese campo cambia o se introduce un discriminador alterno. En un Dispatch corregido, la fórmula histórica (`dispatched - returned - used`) sigue describiendo el registro original, pero **no** representa custodia pendiente accionable. No hacer que `unresolvedQty=0` se interprete como reconciliation: conservar datos históricos aparte y probar la agregación de reportes. Para Equipment, mostrar cierre `CORRECTION` separado de `RETURNED`, con su propio `CUSTODY_CLOSE`.

Agregar resolución operativa en lecturas list/detail de Dispatch sin borrar `status=CONFIRMED`; impedir creación de nuevos R/R sobre Dispatch corregido y su inclusión como pendiente. Los DTO y mappers concretos requieren aprobación conjunta; el ejemplo NO autoriza cambios de respuesta.

## 15. Acceptance gates adicionales que impiden una falsa aprobación

**Aprobación de contrato:** confirmar nombres definitivos de modelos, endpoints, scopes, status/resolution de summary, tratamiento de cambios intermedios Equipment y locks; revisar migración/constraints diferidas antes de pasar a implementación.

**Cobertura obligatoria:** unit + E2E PostgreSQL para `RR CREATE` vs `CORRECT` (en ambos órdenes de obtención de lock); `RR CONFIRM` vs `CORRECT`; borrador cancelado previamente; actor y tenant distintos; operación con MATERIAL/Equipment/mixed; histórico de CONDITION_CHANGE; falla de validación temporal Equipment; replay después de eventos físicos posteriores; read model corregido y sin corrección; `CaseKit` sin recuperar capacidad; fail-closed ante efecto/episodio huérfano; rollback después del primer Effect.

**Gobernanza y release:** corte real no iniciado; permisos operativos/activation fence no certificados; staging y rollout sólo con plan separado; `RISK-006` sigue OPEN/NOT REPRODUCED. No declarar release gate de corrección satisfecho hasta que implementación y consumidores estén integrados, CI/PG completo y QA humano aceptados.

## 16. Referencias existentes en `main`

- `docs/modules/healthcare/CASE_DISPATCH_TECHNICAL_DESIGN.md` §§2, 5–10, 17.
- `docs/modules/healthcare/CASE_RECONCILIATION_TECHNICAL_DESIGN.md` §§2–6, 10–13, 20–21.
- `docs/modules/erp/INVENTORY_CUSTODY_01B_TECHNICAL_DESIGN.md` — `COUNT_CORRECTION` solo `AVAILABLE`.
- `docs/modules/erp/INVENTORY_CUSTODY_01E_TECHNICAL_DESIGN.md` — custodia Equipment, `physicalRevision`, locks.
- `docs/project/PROJECT_BOARD.md` — release gate corrección/reversal y `RISK-006` abierto.
- `app/api/prisma/schema.prisma` — Dispatch, Reconciliation, Positions, Effects, Custody/Events.

**Checkpoint histórico V0.6 (anterior a la aprobación):** las cuatro decisiones funcionales estaban aprobadas; las seis decisiones técnicas aún estaban propuestas. **Esa situación fue superada por la aprobación V0.7 consignada en §18.** Persisten como tareas de implementación la definición exacta de schema/SQL, DTO/response, protocolo de locks, adapter Equipment y pruebas PostgreSQL. Aún no se ejecutan migraciones, CI, despliegue ni cutover.

## 17. Revisión técnica V0.7 — decisiones posteriormente aprobadas

Esta sección conserva la revisión del contrato V0.6 frente al código actual. Las decisiones de §17.1 fueron aprobadas expresamente después de su redacción y se formalizan en §18. **No autoriza por sí misma migraciones, exposición de endpoints ni cambios en `main`.** `HC-DSP-COR-01A` sólo puede considerarse MERGED cuando su PR documental esté integrado.

### 17.1 Decisiones técnicas aprobadas (detalles de implementación por validar)

| ID aprobado | Contrato | Motivo / límite |
| --- | --- | --- |
| `DEC-DSP-COR-TD-01` — persistencia | Root `HealthcareCaseDispatchCorrection` y 1 item por fuente ACTIVE, relación compuesta con Company/Case/Dispatch, unicidad por Dispatch, commit único y evidencia irreversible, sin `DRAFT` público. | Testigo propio que no altera el `CONFIRMED` original y que permite auditoría/lectura estable. Definir checks diferidos de completitud. |
| `DEC-DSP-COR-TD-02` — API | `POST .../dispatches/:dispatchId/corrections/no-handoff`, key obligatoria, body con declaración `true` y motivo, roles ADMIN/MANAGER. Replay devuelve testigo histórico y no se reautoriza con estado físico mutable. | Separar excepción del `CANCEL` normal de DRAFT y del manual Inventory. Debe revisarse la convención de códigos 201/200 y errores estructurados. |
| `DEC-DSP-COR-TD-03` — Equipment estricto V1 | **Rechazar cualquier evento físico posterior a `CUSTODY_OPEN` del episodio objetivo**, incluso `CONDITION_CHANGE`/`LIFECYCLE_CHANGE`, salvo que un contrato posterior apruebe expresamente un subconjunto acotado. Condición/lifecycle se releen y permanecen inalterados. | Política inicial conservadora de no-entrega. Una inspección bajo custodia puede ser legítima, pero exige evaluación de provenance adicional; no se presume segura ni se reinterpreta la declaración humana. Esta recomendación reduce el alcance V1, **no modifica la decisión funcional EQ aprobada**. |
| `DEC-DSP-COR-TD-04` — summary | Representar **resolución operacional separada**, candidata `NOT_APPLICABLE_CORRECTED` + `resolution.kind=CORRECTED_NO_HANDOFF`; no contabilizar como RETURNED/USED/FULLY_RECONCILED. Conservar historia y diferenciar pendiente histórico del **pendiente accionable cero**. | El summary actual falla por su fórmula de custody residual y por el origen exigido de cierre Equipment. **No alterar el enum públicamente sin auditar consumidores**; si hay clientes no migrables, diseñar contrato versionado/compatibilidad o error explícito, nunca devolver `UNRECONCILED` como si hubiera pendiente físico. |
| `DEC-DSP-COR-TD-05` — serialización RR | La corrección toma `FOR UPDATE` del root Dispatch tras autoridad/fences; RR CREATE mantiene lock compatible seguido de una comprobación de corrección confirmada **bajo ese mismo root lock**; RR CONFIRM e ITEM_ADD/OUTCOME_SET rechazan corrección. | `CREATE` usa hoy `FOR KEY SHARE` y no HC Company lock; una verificación sólo antes del locking deja carrera. Dos conexiones PostgreSQL deben demostrar ambos órdenes sin inversión ni efectos parciales. |
| `DEC-DSP-COR-TD-06` — material | Transferir desde cada Position `CUSTODY` del Dispatch exacto a AVAILABLE canónica del mismo producto y batch, sin aumentar owned; evidencia de Effect/Line por source item y origen de corrección. No crear ajuste manual. | Mantener ley de conservación física y proyección/ledger real. Runtime MATERIAL sólo en Company PHYSICAL con fence válido. |

**Nota del guard Equipment / RISK-006:** el origen compensatorio nuevo puede usar `EquipmentCustodyCloseService.returnFromCustody(tx, ...)` con adapter de corrección comprobado, pero no debe manipular el control de timestamp existente, inventar horarios ni modificar la historia original. Si falla el guard histórico de manera reproducible se abre investigación aparte, con operandos y contexto seguro.

### 17.2 Matriz mínima de aceptación integrada

| Prueba/gate | Resultado requerido |
| --- | --- |
| MATERIAL NONE/OPTIONAL/REQUIRED | CUSTODY original a cero; AVAILABLE canónica aumenta la cantidad exacta; `Product.stock` owned no cambia; batch cambia sólo si loteado; Effect/Lines consistentes. |
| Equipment-only | Episodio objetivo OPEN→CLOSED, un solo evento de corrección, condición y lifecycle preservados, `activeCustodyId=null`, `WAREHOUSE`, revisión +1, Assignment intacto. |
| MIXTO + error inducido | Si falla cualquiera de los efectos, no persiste corrección ni movimiento/close/audit/claim parcial; una sola transacción. |
| Reconciliation histórica | `DRAFT` bloquea, CANCELLED coherente no bloquea, CONFIRMED bloquea. No se cancela ningún borrador automáticamente. |
| Carrera `RR CREATE` vs `CORRECT` | Ambos órdenes de bloqueo: nunca corrección confirmada con nuevo draft RR válido; si ganó CREATE se bloquea corrección hasta cancelación explícita; si ganó CORRECT, CREATE devuelve conflicto. |
| Carrera `RR CONFIRM` vs `CORRECT` | Nunca confirman ambas operaciones sobre la misma fuente; cero efectos dobles, timeouts explícitos y sin deadlock permanente. |
| Acceso posterior | RR CREATE, ITEM_ADD, OUTCOME_SET y CONFIRM no pueden añadir efectos al Dispatch corregido. |
| Readback y consumers | Dispatch histórico sigue CONFIRMED; resolución corrección separada; RR no muestra falsa devolución, uso, reconciliación completa ni pendiente operativo. Lectura antigua inalterada para Dispatch no corregidos. |
| Historial Equipment | Revisión/custodia inconsistente, otro close, evento posterior no admitido o timestamp inválido ⇒ rechazo total sin escrituras. |
| Idempotencia y permisos | Key/hash coincidente retorna witness original; nueva key no compensa dos veces; hash distinto 409; WAREHOUSE/SALES no confirman; tenant extranjero 404 sin filtrar datos. |
| QA y entornos | PostgreSQL 16 aislado, pruebas reales de dos conexiones y failpoints; tests focales + regresiones + lint/typecheck/build/Prisma; ninguna Company real, sin cutover. |

### 17.3 Release/activación segura y seguimiento

- Los slices 01B–01E pueden desarrollarse incrementalmente en ramas de trabajo, pero **la mutación no será accesible** hasta integrar serialización y lecturas discriminadas y completar 01F.
- El diseño debe contemplar clientes ya desplegados: compatibilidad/versión de contrato de resumen es un **gate**, no una tarea opcional posterior al lanzamiento.
- La certificación de fence externo, la adopción de Company real y el rollout son actividades independientes; ninguna queda aprobada por este documento.
- `RISK-006`: **OPEN / NOT REPRODUCED**, root cause UNKNOWN; no resolver por el simple hecho de pasar tests.

**Checkpoint V0.8 (documental):** cuatro decisiones funcionales (`ATTEST`, `READ`, `REC`, `EQ`) y seis técnicas (`TD-01..06`) **aprobadas**. Desglose 01A..01F preparado; 01B no iniciado. **Integración documental aún pendiente de merge, implementación no iniciada, RISK-006 abierto, Company cutover no ejecutado.**


## 18. Aprobación técnica V0.7 — constancia de decisión 01A


**Proyecto:** Zaping Healthcare — M-HC1
**Documento base:** §17 de este documento (contrato V0.7 aprobado), especialmente §§ 14 y 17.
**Decisión:** **APPROVED — contrato técnico V0.7**, por aprobación expresa del responsable de producto en la sesión del 19 de octubre de 2026.
**Alcance:** aprobación de diseño; **NO IMPLEMENTED / NO MERGED / NO CUTOVER**.
**Prioridad:** P0, release gate antes de declarar Healthcare production-ready.

## Decisiones técnicas aprobadas

| ID | Contrato aprobado | Límite vinculante |
| --- | --- | --- |
| DEC-DSP-COR-TD-01 | Agregado propio `HealthcareCaseDispatchCorrection` + un item por cada DispatchItem ACTIVE; una sola corrección terminal por Dispatch; testigo duradero, tenant-safe, sin DRAFT público. | No editar Dispatch CONFIRMED, sus snapshots, líneas ni auditoría original; especificar constraints e integridad en 01B. |
| DEC-DSP-COR-TD-02 | Comando explícito candidato `POST /healthcare/cases/:caseId/dispatches/:dispatchId/corrections/no-handoff`, Idempotency-Key obligatoria, atestación true, motivo no vacío, ADMIN/MANAGER. | Revisar códigos HTTP y DTO exactos contra convenciones del API; no registrar ruta accesible antes del gate integral. |
| DEC-DSP-COR-TD-03 | V1 estricto: rechazar **cualquier evento físico Equipment posterior a CUSTODY_OPEN** del episodio objetivo, incluidos CONDITION_CHANGE/LIFECYCLE_CHANGE. | Preservar condición/lifecycle actual verificados; no corregir casos históricos complejos por este mecanismo. |
| DEC-DSP-COR-TD-04 | Separar resolución operativa `CORRECTED_NO_HANDOFF` de status histórico `CONFIRMED` y de resultados Return/Reconciliation. | `NOT_APPLICABLE_CORRECTED` es forma candidata: revisar/versionar contrato API si afecta clientes existentes, sin mentir en el summary. |
| DEC-DSP-COR-TD-05 | Serializar CORRECT contra RR CREATE/CONFIRM sobre el Dispatch; la corrección toma `FOR UPDATE` y RR CREATE verifica el testigo de corrección bajo su lock del mismo root. | Verificar orden exacto de locks y carreras reales en PostgreSQL; si aparece inversión/deadlock, STOP y rediseñar. |
| DEC-DSP-COR-TD-06 | Material QUANTITY: transferencia compensatoria de posición exacta CUSTODY a AVAILABLE canónica, identidad Product/batch invariable y proyecciones correctas; nunca un ajuste manual de CUSTODY. | Autoridad PHYSICAL + Inventory fence; sin cambiar Product.stock owned. |

## Decisiones funcionales previamente aprobadas, conservadas

- **DEC-DSP-COR-ATTEST-01:** ADMIN/MANAGER debe declarar ausencia de entrega física, motivo obligatorio y actor/fecha servidor; no exige segundo aprobador en V1.
- **DEC-DSP-COR-READ-01:** mostrar «Corregido — sin entrega física», manteniendo Dispatch `CONFIRMED`, sin falso pendiente ni resultado `RETURNED`/`USED`/`FULLY_RECONCILED`.
- **DEC-DSP-COR-REC-01:** RR DRAFT bloquea hasta cancelación explícita; RR CONFIRMED bloquea; CANCELLED coherente sin efectos no bloquea; no auto-cancelación.
- **DEC-DSP-COR-EQ-01:** cierre de custodia a WAREHOUSE sin alterar condición/lifecycle verificados, usando un evento de corrección auditable.

## Condiciones de implementación y release

La aprobación **no** afirma que los nombres físicos del esquema, DTO exactos, índices SQL, orden detallado de locks o comportamiento de clientes estén ya probados. Los siguientes aspectos se resuelven en 01B–01F mediante código, constraints, pruebas y revisión:

1. Integridad persistente, unicidad por Dispatch y FK tenant-safe; corrección inmutable y testigos de Effect/Event verificables.
2. API/RBAC/idempotencia coherentes; replay sin doble efecto y sin depender de saldos actuales.
3. Adaptador de cierre Equipment `CASE_DISPATCH_CORRECTION_ITEM`, evidencia duradera y ausencia estricta de eventos posteriores al CUSTODY_OPEN.
4. RR CREATE/CONFIRM/ITEM_ADD/OUTCOME_SET y summary compatibles con corrección; ningún writer externo o versión de cliente obtiene un estado falso.
5. Pruebas reales PostgreSQL 16 aisladas de carreras en ambas direcciones, rollback mixto, fallos de guard temporal y regresiones integrales.
6. No exponer comando productivo hasta completar 01B–01F y gate de revisión humana. Sin desplegar/cutover ni modificar compañías reales por esta aprobación.
7. `RISK-006` sigue **OPEN / NOT REPRODUCED**, causa desconocida, sin corrección funcional acreditada.

## Gestión

`HC-DSP-COR-01A`: **decisión de producto y arquitectura aprobada; documentación aún pendiente de integrar en rama y PR a main.** No marcar `Done` ni `MERGED` sin ese paso.
Siguiente trabajo: `HC-DSP-COR-01B` — Persistence & Witness; sin endpoints habilitados.
Story Points, Commitment, fechas y Actual: **TBD** en refinamiento.

**Referencias**: TD V0.7 y `docs/modules/healthcare/CASE_DISPATCH_TECHNICAL_DESIGN.md`, `docs/modules/healthcare/CASE_RECONCILIATION_TECHNICAL_DESIGN.md`, `docs/project/PROJECT_BOARD.md` de `main`.

## 19. Refinement 01C — decisiones y límites vigentes

Base de este refinamiento: main@0953883, posterior al PR #103. 01A está integrado por PR #101; 01B por PR #102 y su cierre documental por PR #103. Los checkpoints anteriores se conservan como historia; no representan el estado operativo actual. [Board](../../project/PROJECT_BOARD.md) y [ticket 01C](../../project/HC_DSP_COR_01C_TICKET.md) mantienen el seguimiento.

Checkpoint PR #104: 01C era el único ticket principal activo, en refinamiento documental, sin implementación iniciada. La implementación autorizada posterior de A se registra en §20. Secuencia: 01C-A contrato Inventory y evidencia (5 SP preliminares), 01C-B orquestación MATERIAL-only (5 SP preliminares), 01C-C concurrencia y cierre (3 SP preliminares). No son Commitment, Forecast, Actual ni Target aprobado.

### Contrato conservado y adapter específico

Compensar CUSTODY → AVAILABLE desde la Position original de cada DispatchItem ACTIVE MATERIAL, mismo tenant/Product/Batch y cantidad exacta. Verificar cantidad y revisión actuales contra la evidencia original bajo locks, además de ausencia de movimientos posteriores incompatibles; saldo repuesto no demuestra historia intacta. Destino AVAILABLE canónico con contextType/contextId null. Conservar owned total, Product.stock sin incremento, Effects/Lines auditables e historia original de Dispatch; no restaurar capacidad CaseKit.

Un Effect puede agrupar materiales; mantener mapping por fuente y totales agregados sin imponer un Effect por item. Product/Batch no elegibles siguen rechazándose por el contrato actual: vencimiento o desactivación posterior al Dispatch puede impedir la corrección. No introducir bypass ni relajar Inventory globalmente.

El core actual calcula physicalRequestHash y crea occurredAt por default; 01B exige que el Effect compensatorio tenga requestHash y fecha iguales a la corrección. El adapter deberá ser interno y específico, derivando metadatos de la corrección staged y validando identidad, intención y transacción. No admitir overrides generales ni cambios de comportamiento en writers existentes. Revisar conjuntamente creación, búsqueda y replay de Effects: no basta adaptar el INSERT si findEffect/classifyCommittedEffect conserva una comparación incompatible. Origen: CASE_DISPATCH_CORRECTION / correction.id / COMPENSATE_NO_HANDOFF_QUANTITY. No se identifica una migración obligatoria por ese origen string; cualquier necesidad nueva exige diseño forward-only separado, sin editar migraciones existentes.

### Protocolo histórico candidato, todavía no validado — sustituido para B por §21

Replay autorizado → READ COMMITTED → Inventory shared fence → claim con correctionId definitivo → control persistido/autoridad PHYSICAL/runtime → HC Company advisory lock/timeouts existentes → Case FOR SHARE → Dispatch FOR UPDATE → DispatchItems ordenados → Product → Batch → Positions fuente/destino ordenadas → validación/aplicación/proyecciones → snapshots y sello → commit.

El orden es candidato por inspección, **no aprobado ni demostrado libre de inversiones**. Su orden final requiere PostgreSQL 16 real, aislado y autorizado con escritores competidores y ambas direcciones de adquisición. Conservar NOWAIT del sello 01B; timeout/deadlock/transporte no son rechazos de integridad ni duplicados. LEGACY/sin control rechaza PHYSICAL_AUTHORITY_REQUIRED; CUTOVER y RECOVERY_REQUIRED conservan sus bloqueos específicos. No adquirir el fence después de locks de negocio.

Claim, root/items, transferencia, proyecciones y evidencia se completan en una sola transacción. Root sin snapshot, items y evidencias completos, snapshots de items y sello root al final; constraints diferidas verifican completitud. Cualquier error aborta todo. Colisiones se clasifican sólo tras rollback, mediante lectura fresca del ganador; Effect huérfano no se adopta como éxito.

Replay entre actores exige autorización actual válida, misma Company e intención idéntica; conserva actor histórico y no depende del saldo físico vivo. Misma key con otro hash rechaza; distinta key para Dispatch ya corregido devuelve conflicto estable y ninguna compensación nueva. Mantener hash v1 de 01B, sin introducir precondiciones nuevas silenciosamente.

### Dependencias de integración

01C rechaza íntegramente Dispatch con Equipment ACTIVE antes de aplicar efectos. Sin compensación parcial, caller público ni exposición productiva. RR DRAFT/CONFIRMED bloquea; CANCELLED sólo si coherente y sin efectos. RR CREATE no toma el lock HC Company: su lock Dispatch y la comprobación posterior de corrección deben integrarse en 01E, junto con guards de otros comandos y lecturas discriminadas. 01D añade Equipment; 01F conserva QA integral. **Sin activar el flujo hasta integrar 01D, 01E y 01F y satisfacer los gates correspondientes.**

M-HC1: **OPEN**. RISK-006: **OPEN / NOT REPRODUCED**. Incidente intermitente EQUIPMENT: sin causa raíz confirmada ni resolución demostrada. Typecheck global de specs: **FAIL, 70 errores históricos reportados**, sin nuevas localizaciones reportadas en la evidencia 01B; no se reejecutó ni se dispensa su excepción pendiente de aceptación humana. Sin cutover ni autorización de producción.

## 20. Estado histórico de 01C-A — PostgreSQL QA 13/13 PASS, previo al merge

Rama `feat/hc-dsp-cor-01c-a-inventory-contract`, base main@519f0dc (PR #104). Inicio real 2026-10-20; Target aprobado 5 SP, sin Commitment, Forecast ni Actual. Únicamente A autorizado; B/C pendientes. [Ticket 01C](../../project/HC_DSP_COR_01C_TICKET.md#01c-a--implementación-autorizada-y-checkpoint-local) mantiene comandos, métricas y resultados. **Estado en aquel checkpoint: PostgreSQL QA 13/13 PASS; Code Review sin bloqueos funcionales; integración pendiente.** Cambios locales sin commit; no backend integrado ni habilitación operativa.

PhysicalInventoryService añade `transferDispatchCorrectionMaterial(tx, input)` y `classifyCommittedDispatchCorrectionMaterial(tx, input)`. El input contiene companyId, caseId, dispatchId, correctionId, requesterId, idempotencyKey, attestedNoHandoff:true y reason. El helper específico deriva hash v1, actor histórico, fecha y motivo del root/claim persistidos; deriva fuentes/destinos/revisiones desde Dispatch y Effects originales. Sin overrides externos. El método de creación de header específico preserva exactamente esos metadatos; findEffect mantiene su clave tenant/origen y todos los puntos de clasificación de la nueva ruta emplean el witness 01B. El contrato genérico conserva hashing, normalización y fechas.

Motivo Unicode: validación 01B por puntos de código; la geometría física se normaliza sin aplicar al motivo el límite genérico UTF-16. Origen fijo CASE_DISPATCH_CORRECTION / correction.id / COMPENSATE_NO_HANDOFF_QUANTITY. No requiere migración: campos string/hash/fecha y validaciones 01B ya existentes. No se alteraron schema ni SQL.

Nueva evidencia requiere transacción caller-owned, root sin sellar y creationTransactionId actual, requester activo ADMIN/MANAGER del tenant y actor del root. Verifica posesión del fence y control PHYSICAL consistente/runtime; no adquiere el fence tardíamente ni sustituye la obligación del caller de comprobar autoridad antes de claim/root. El chequeo de posesión no certifica orden global, pendiente de PostgreSQL B/C. Fuentes originales, cantidades y revisiones se validan de nuevo bajo locks; una línea posterior en la historia CUSTODY rechaza incluso con saldo repuesto. Product/Batch inactivo/vencido sigue rechazando.

Replay autorizado no exige saldos/elegibilidad actuales: verifica claim/root sellado, Effect/Lines, snapshots y actor histórico. Distinta key implica conflicto estable; huérfanos no se adoptan. Se contempla el ganador que commitea entre lecturas READ COMMITTED mediante su claim vinculado y una relectura acotada si aparece Effect tras ausencia inicial del root. Esto tiene prueba simulada, no aprobación de concurrencia global. Fallos de transporte/timeout/deadlock se propagan como fallo, nunca éxito de integridad.

El adapter no crea el agregado de corrección ni ejecuta proyecciones/sello productivos; el harness sintético compone esos pasos para probar A. Sin registro de nuevos providers, callers públicos ni endpoints. Equipment ACTIVE rechaza íntegramente; activación bloqueada hasta integrar 01D/01E/01F y gates humanos.

**Estado histórico local:** PostgreSQL A estaba BLOCKED / NOT EXECUTED por ausencia de autorización/conexión propias en el proceso Codex; la suite de 13 casos quedó preparada para QA manual. Se conserva ese checkpoint en el ticket. No reutilizar autorización ni credenciales de 01B; el PASS histórico 01B no acredita por sí mismo el adapter nuevo.

**QA externa posterior, ejecutada manualmente por el usuario:** primer intento con **13 FAIL**, InventoryAuthorityError: INCOMPATIBLE_BUILD, por variables de compatibilidad Inventory ausentes. Ejecución posterior en PostgreSQL **16.15**, 127.0.0.1:5436, base aislada zaping_hc_dsp_cor_01c_a_test: **13/13 PASS, exit code 0**, con INVENTORY_RUNTIME_BUILD, INVENTORY_RUNTIME_ENVIRONMENT e INVENTORY_AUTHORITY_PROTOCOL configurados. Evidencia confirmada por salida de terminal comunicada por el usuario; **Codex no ejecutó PostgreSQL**.

Se conservan las validaciones locales de Codex previamente reportadas: **253/253 PASS**, build, lint, formato y typecheck focal/productivo PASS. La revisión técnica final no identificó bloqueos funcionales; el único P2 documental queda resuelto al registrar la QA externa y separar el estado histórico del actual. **Veredicto documental: READY; integración pendiente.** Target **5 SP**, sin Commitment, Forecast ni Actual. 01C-B/01C-C y los gates de concurrencia global siguen pendientes; el 13/13 no certifica el orden global de locks ni habilita la operación. En esta actualización sólo se modifican los dos documentos, sin ejecutar PostgreSQL o suites ni realizar staging, commit, push o PR.

M-HC1 **OPEN**; RISK-006 **OPEN / NOT REPRODUCED**; incidente intermitente EQUIPMENT sin causa confirmada; typecheck global histórico **FAIL, 70 errores reportados**, sin aceptación automática ni nueva ejecución global en esta sesión. Sin cutover ni producción.

## 21. 01C-B — orquestación interna MATERIAL-only

**Estado actual:** A DONE / MERGED (PR #105), cierre A integrado por PR #106 en `main@10a5327`. B **DONE / MERGED por PR #109** desde `feat/hc-dsp-cor-01c-b-material-orchestration`, commit funcional `1fd9b00`, merge `7ee270b`, **Target 5 SP aprobado y completado**, Started 2026-10-20 / Merged 2026-10-22 (America/Hermosillo), sin Commitment/Forecast/Actual recalculado. §20 y el protocolo de §19 conservan checkpoints históricos; el prefijo vigente de B comprueba autoridad **antes del claim**. Seguimiento, comandos y evidencia en el [ticket 01C](../../project/HC_DSP_COR_01C_TICKET.md#01c-b--implementación-local-y-gate-postgresql).

### Entrada y límite de transacción

Clase interna sin decorator, provider, controller ni caller productivo: `HealthcareCaseDispatchCorrectionCommandService`. Su método `execute(context, intent): Promise<MaterialCorrectionResult>` recibe companyId/caseId/dispatchId/requesterId/idempotencyKey y attestedNoHandoff:true/reason. Devuelve `{ replay, witness }`, incluyendo los items del testigo 01B; sólo resuelve tras finalizar la transacción exterior. No acepta una transacción externa ni overrides físicos o históricos. Normaliza clave y motivo una sola vez, reconstruye los campos admitidos y usa hash v1 01B, incluyendo Unicode por puntos de código.

Responsabilidades separadas en los tres archivos nuevos `healthcare-case-dispatch-correction-command.{contract,repository,service}.ts`: contrato/errores; transacciones/locks/lecturas/persistencia; composición. No se cambia el adapter A, el core Inventory, SQL ni la persistencia read-only existente de 01B.

### Secuencia implementada — evidencia global de locks pendiente

1. Lectura RepeatableRead consistente con autorización ADMIN/MANAGER activa del tenant; buscar claim con la key y witness sellado mediante repository 01B. Si existe, derivar correctionId de esa evidencia y clasificar con A. Replay histórico conserva actor/fecha y no depende de autoridad, elegibilidad o saldos vivos; no abre rama de escritura.
2. Sin replay, abrir READ COMMITTED con maxWait/timeout y límites locales de lock/statement de la política HC vigente. Primer lock de dominio: Inventory shared fence. Exigir control persistido, resolver PHYSICAL y comprobar runtime compatible, **antes de claim/root/locks de negocio**. Sin control/LEGACY: PHYSICAL_AUTHORITY_REQUIRED; CUTOVER: CUTOVER_FROZEN; recuperación: RECOVERY_REQUIRED; runtime incompatible conserva su error.
3. Reautorizar y releer replay; si sigue ausente, generar correctionId servidor e insertar claim con resourceId definitivo y hash. No utilizar `createClaim → completeClaim` ni mutar el claim.
4. HC Company advisory lock con timeout existente → Case FOR SHARE → Dispatch FOR UPDATE → DispatchItems ACTIVE ordenados por id FOR UPDATE. Revalidar tenant, fuente CONFIRMED y snapshot, inexistencia de corrección, 1–1000 fuentes MATERIAL y RR compatible; Equipment ACTIVE, incluso mixto, rechaza todo. RR DRAFT/CONFIRMED bloquea; CANCELLED sólo sin Effects/Event incompatibles en cualquiera de sus items, también excluidos; sin cancelación automática.
5. Crear root sin snapshot con actor/hash/fecha del servidor y claim vinculado; `creationTransactionId` conserva el default SQL existente. Invocar A para CUSTODY → AVAILABLE, exigiendo un resultado nuevo. A retiene validaciones originales y locks Product → Batch → Positions; no eludir elegibilidad, cantidad, revisión ni historia original.
6. Aplicar proyecciones en esa transacción. Reler Lines persistidas y Positions; comprobar identidad/metadatos del Effect y correspondencia exacta de cantidades/revisiones, débitos originales y créditos AVAILABLE canónicos, agrupación y owned neto cero. Crear un CorrectionItem por fuente con mappings originales/compensatorios; generar snapshots mediante función SQL 01B. Product.stock conserva owned; Batch AVAILABLE se proyecta desde hechos físicos.
7. Reautorizar, sellar snapshot root conservando guards NOWAIT 01B y reautorizar después del sello. Forzar constraints diferidas de Effect/root/items/claim, obtener witness final con id/hash esperados y devolver sólo tras commit. Ninguna escritura de negocio después del sello; cualquier fallo revierte la transacción completa.

Este orden está implementado, con comprobación local de secuencia y evidencia PostgreSQL externa de atomicidad/duplicado básico de B (31/31 PASS). **No se declara aprobado globalmente ni libre de inversiones con todos los escritores competidores.** C conserva las carreras globales de ambos sentidos, movimientos competidores y cierre del orden definitivo. RR CREATE todavía necesita su guard de corrección y admission/read models de 01E; el comando de B permanece sin registro/caller por esa dependencia.

### Idempotencia y fallos

Misma key/intención: replay con autorización actual, misma Company, witness y evidencia A coherentes, sin escrituras ni cambios del actor histórico. Key/hash distinto: IDEMPOTENCY_KEY_REUSED. Otra key sobre Dispatch corregido en la rama de nueva ejecución: CORRECTION_ALREADY_EXISTS sin nueva compensación persistida. Colisiones P2002 se reconocen únicamente por el target exacto de claim companyId/scope/key o corrección companyId/dispatchId; la transacción fallida termina antes de clasificar al ganador en otra lectura consistente. No consultar sobre el cliente abortado, adoptar ganador por errores genéricos ni añadir retry automático.

Los errores de dominio A/Inventory y HTTP se conservan. Validaciones B usan códigos CORRECTION_INVALID_REQUEST, ACTOR_FORBIDDEN, DISPATCH_NOT_FOUND, DISPATCH_NOT_CONFIRMED, MATERIAL_ONLY, ALREADY_EXISTS, RECONCILIATION_INCOMPATIBLE y EVIDENCE_INCONSISTENT, todos con prefijo `CORRECTION_`. Conflictos transaccionales/timeouts reconocidos se clasifican como CORRECTION_CONCURRENCY_ERROR; fallos inesperados como CORRECTION_PERSISTENCE_ERROR sin datos de conexión ni causas crudas. Un Effect huérfano jamás es replay aceptable.

### Validación histórica inicial y límites de entrega

QA local Codex: **847/847 casos únicos PASS en 29 suites**, sumando 711 PASS de regresión y repetición exclusiva de 136 HTTP PASS tras EACCES del sandbox. Incluye 37 pruebas B y 25 Physical previamente focalizadas (62/62); no sumar dos veces. Integración focal usa B/01B/A reales con delegates y SQL simulados: acredita composición, no constraints reales. Typecheck focal/productivo, ESLint, Prettier y build API PASS. **PostgreSQL B BLOCKED / NOT EXECUTED** por falta de cuatro variables propias de autorización/conexión; 31 E2E preparados y compilados, pendientes de ejecución manual en PostgreSQL 16 aislado propio de B (requisitos y comando en ticket). La evidencia externa 13/13 de A permanece histórica y separada.

Fixtures comparan estado completo antes/después de replay o rollback, conservan Dispatch/snapshots/auditoría/CaseKit, y prevén fallos reales tras cada fase mediante spies exclusivos de tests. El duplicado básico previsto usa dos PrismaClient de una conexión, barrera anterior al claim y PIDs distintos. No usa sleeps ni hooks productivos. Los episodios RR de E2E se construyen con sus comandos vigentes; no fabricar CANCELLED con Effects que el SQL prohíbe ni relajar constraints. La comprobación defensiva local conserva ese rechazo también para items excluidos.

**B no está DONE, integrado ni habilitado operacionalmente**: PG real del slice acreditado externamente; revisión final y cierre de evidencia a continuación. Permanecen aprobación humana y CI/integración. C pendiente; sin activar flujo hasta 01D/01E/01F y gates correspondientes. M-HC1 **OPEN**, RISK-006 **OPEN / NOT REPRODUCED**, EQUIPMENT intermitente sin causa confirmada y typecheck global histórico **FAIL con 70 errores**. Ningún PASS local elimina esos riesgos.

### Estado actual — Code Review y cierre de QA externa de B

**CODE REVIEW / QA PASSED / NOT MERGED**, Target **5 SP**, sin DONE ni Actual SP. Revisión focal de los once archivos el 2026-10-21; ningún cambio de código durante el review. La evidencia inicial de bloqueo de entorno y sus métricas anteriores se conserva como historia, sustituida para el estado actual por esta secuencia:

1. Codex, implementación inicial anterior al fix: **847/847 casos únicos PASS, 29 suites**, en dos ejecuciones; 711 PASS iniciales y repetición de 136 HTTP PASS tras EACCES. Build/lint/formato/typecheck focal/productivo iniciales PASS. No reejecutar ni atribuir esas 847 al código corregido.
2. Usuario, PostgreSQL manual: **25 PASS / 6 FAIL, exit 1**. La impresión manual posterior de PASS no fue aceptación. No se dispone aquí de los seis diagnósticos individuales completos.
3. Defecto demostrado y corregido en B: contexto completo pasado a 01B filtraba requesterId/idempotencyKey al where Prisma. El repository B ahora construye explícitamente `DispatchCorrectionLookup` con companyId/caseId/dispatchId para findReplay/findWitness. Requester sigue en autorización y key en idempotencia; sin cambios en claim/hash, adapter A ni clasificación de errores. Regresiones comparan filtros Prisma exactos y rechazan identidad incompatible, otro hash y errores originales; no sólo respuestas de mocks permisivos.
4. Codex, después del fix: **45/45 focales y 260/260 PASS, ocho suites afectadas**; las 45 están incluidas. Typecheck focal/productivo, ESLint y Prettier PASS. Las nuevas aserciones fallaban antes de corregir el lookup (8 FAIL / 37 PASS).
5. Usuario, PostgreSQL manual posterior: repetición focal **2/2 PASS** y ejecución completa final **31/31 PASS, 0 skipped, exit code 0**, PostgreSQL **16**, `127.0.0.1:5437`, DB aislada `zaping_hc_dsp_cor_01c_b_test`. Fuente: confirmación expresa del usuario; **Codex no ejecutó PostgreSQL**. No se inventan versión menor, fechas/horas ni SHA de ejecución. La secuencia no prueba atribución causal individual de los seis fallos anteriores.
6. Code Review final: las ocho suites locales afectadas se revalidaron **260/260 PASS** sobre el código corregido; no se repitieron las 847 ni PostgreSQL. Typecheck focal/productivo, build API, ESLint y Prettier reejecutados PASS en este review; evidencia consolidada en el [ticket](../../project/HC_DSP_COR_01C_TICKET.md#cierre-de-evidencia-y-code-review-final-de-01c-b).

Revisión sin bloqueos funcionales P0/P1/P2. Observación **P3 no bloqueante** en E2E:432/496: las negativas de rollback comparan estado y error genérico, pero no afirman explícitamente llegada al throw inyectado; una falla anterior con el mismo código podría satisfacerlas. Mejora diagnóstica propuesta, no aplicada. No confundir esta limitación con un defecto funcional demostrado ni con aprobación global de concurrencia.

Los 31 E2E cubren positivos/evidencia/sello, límites y negativos, rollback por las fases previstas y duplicado básico de misma key con dos conexiones/PIDs/barrera. El orden global y carreras con escritores Inventory/Dispatch/RR, cutover y otros conflictos permanecen en **01C-C pendiente**; guards/read models en 01E. No repetir auditorías generales 01B/A ni afirmar que el PASS de B habilita el flujo. **Aprobación de merge otorgada por el responsable; CI #341 API/Web SUCCESS, PR #109 MERGED, B DONE; sin Actual SP recalculados.** M-HC1 OPEN, RISK-006 OPEN / NOT REPRODUCED, EQUIPMENT sin causa confirmada, typecheck global histórico FAIL con 70 errores y operación deshabilitada se conservan.

## 22. HC-DSP-COR-01C-B — cierre documental post-merge

[PR #109](https://github.com/gclp96/zaping/pull/109): **MERGED** en `main@7ee270b6a11cadea284801ab76d634226b7add36` el 2026-10-22. Commit funcional `1fd9b004817b5c1c0caf3927258e5f77d541d86b`. [CI #341](https://github.com/gclp96/zaping/actions/runs/39818610916): **API SUCCESS, Web SUCCESS**. Se conserva la aceptación manual previa: 260/260 focales y 31/31 PostgreSQL aislado reportados, sin nuevas ejecuciones en este cierre. **B DONE / MERGED, Target 5 SP aprobado y completado**; no inferir Commitment, Forecast, Actual u horas.

La implementación permanece **interna y dormida**, sin endpoint/caller productivo ni autorización de cutover. El orden global de locks y las carreras reales Inventory/Dispatch/RR/cutover no están certificados: son el alcance del siguiente refinamiento **01C-C pendiente** (3 SP preliminares, sin DoR de implementación aprobada). P3 de fault injection no bloqueante, M-HC1 OPEN, RISK-006 OPEN / NOT REPRODUCED, intermitencia EQUIPMENT sin causa confirmada y deuda histórica del typecheck global preservados. Los checkpoints de §21 anteriores al PR #109 permanecen como historia.
