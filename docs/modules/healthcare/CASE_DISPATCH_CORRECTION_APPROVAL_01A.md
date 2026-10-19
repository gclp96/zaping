# HC-DSP-COR-01A — Technical Design Approval Delta

**Proyecto:** Zaping Healthcare — M-HC1
**Documento base:** `CASE_DISPATCH_CORRECTION_TECHNICAL_DESIGN.md`, especialmente §§ 14 y 17.
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

**Nota de integración:** esta aprobación documental se considerará `MERGED` únicamente después del PR a `main`.
