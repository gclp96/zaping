# HC-DSP-COR-01D — Equipment Compensation

**Estado:** PR [#113](https://github.com/gclp96/zaping/pull/113) **OPEN / CODE REVIEW — PostgreSQL QA FOCAL PASS; CI / DoD / MERGE PENDING**. **No DONE**, no despliegue ni habilitación operativa.
**Workstream:** M-HC1 — Healthcare Operations Foundation (**OPEN**).
**Base:** `main@8055dbafd8297be2f6baf94fbdc5b694e996b7d3`; commit funcional `cdce02570b003a04f27b2c37eee39b14ef284408`.
**Fecha de evidencia local:** 2026-10-22 (America/Hermosillo).
**SP, Commitment, Forecast, Actual:** sin nueva estimación/compromiso aprobados; no inferir horas de timestamps.

## Alcance implementado

- `EquipmentCustodyCloseService` mantiene advisory lock, CAS, guard temporal, reconciliación de historial y actor; la extensión es **específica** para origen `CASE_DISPATCH_CORRECTION_ITEM`, verificado por un adapter dentro de la transacción y sin overrides genéricos.
- El evento compensatorio usa el `requestHash` del root confirmado y su `confirmedAt` como timestamp tanto para `EquipmentAssetCustody.closedAt` como para `EquipmentAssetPhysicalEvent.createdAt`. Se satisfacen los constraints Equipment establecidos en 01B **sin migraciones nuevas ni cambios de schema.prisma**.
- Corrección Equipment-only y MIXTO MATERIAL+Equipment compuesta de manera explícita bajo **una transacción**; condition/lifecycle y Assignment permanecen intactos, Asset pasa de CUSTODY a WAREHOUSE, se limpia activeCustodyId y la revisión aumenta una vez por cierre.
- Política V1 fail-closed: rechazar eventos físicos posteriores al CUSTODY_OPEN objetivo, custodia/historial/revisión incoherente, actor/tenant no autorizado y RR incompatible. Replay histórico e idempotencia sin nuevos efectos.
- **21 archivos** de código, tests y harness E2E. Sin endpoint público ni registro de caller productivo; no se activa corrección.

## Evidencia de validación

| Gate | Resultado y alcance |
| --- | --- |
| Unitarias y regresiones afectadas | **271/271 PASS**, 11 suites, reportadas por Codex local |
| TypeScript focal/productivo y 01C-C | PASS reportado |
| ESLint, Prettier, whitespace y build API | PASS reportado |
| PostgreSQL 16 — 01D Equipment/MIXTO | **33/33 PASS**, suite única, segunda ejecución aislada, ~24.1 s; Equipment-only (4 condiciones), multi-Asset, MIXTO, SQL 01B hash/tiempo/constraints, rollback físico+proyección, RR, permisos, replay, carreras y lock timeout |
| PostgreSQL 16 — regresión 01C-C MATERIAL-only | **22/22 PASS**, suite independiente en base limpia 01C-C, exit code 0, ~19.58 s |
| **Total PostgreSQL local** | **55/55 PASS** (dos suites/bases aisladas); ninguna prueba sobre Company real |
| GitHub CI API/Web | **PENDING** para head final del PR #113 |

**Historial significativo:** RUN 1 de 01D = 12 PASS / 21 FAIL por fixture `custodianDisplayName='Isolated receiver'` diferente del `rootSnapshot` (`Receiver`) que quebró `Dispatch_final_state`. Se corrigió sólo el helper E2E, RUN 1 se preservó; RUN 2 en base nueva completó 33/33 PASS. No reutilizar bases con fixtures para otra ejecución.

**Límites:** la inversión de locks/deadlock de la suite es deliberada en SQL de test y **no acredita una inversión productiva**. 01C-C verifica únicamente su matriz MATERIAL y no reemplaza la matriz RR CREATE/CANCEL/CONFIRM ni read-model discriminado (**01E**). Integración, gates adicionales y validación de consumidores (**01F**) permanecen pendientes. No se acredita despliegue, cutover ni liberación operativa.

**Riesgos:** RISK-006 **OPEN / NOT REPRODUCED**; intermitencia previa de Equipment no demostrada como resuelta; excepción histórica de typecheck global fuera del gate focal. M-HC1 continúa **OPEN**.

## Criterios restantes antes de DONE

1. CI remoto API/Web del **head final** del PR PASS y revisión de cambios/alcance.
2. Aprobar manualmente merge del PR y verificar commit `main`; actualizar estado únicamente entonces.
3. Conservar 01E/01F como release gates independientes; **no activar corrección operativa** por cerrar 01D.

**Fuentes:** [Diseño técnico](../modules/healthcare/CASE_DISPATCH_CORRECTION_TECHNICAL_DESIGN.md) · [Board](PROJECT_BOARD.md) · [PR #113](https://github.com/gclp96/zaping/pull/113).
