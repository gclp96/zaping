> Historical PERF-01 evidence, COMPLETE / MERGED — PR #97. The pending-review
> status below records its pre-merge acceptance. Current writer optimization and
> project status: [PERF-02 acceptance](physical-writer-throughput-results.md).

# HC-RR-PERF-01 — final acceptance delta (2026-10-17)

HC-RR-PERF-01: **IMPLEMENTED / TESTED — PENDING HUMAN REVIEW / MERGE — TARGET 8 SP**.
The final execution of every PERF-01 gate passed. Earlier failed attempts remain
recorded below; this is not a claim of repeatable production writer throughput.
HC-RR-PERF-02: **READY / NOT IMPLEMENTED — TARGET 5 SP**. Writer throughput **NOT CERTIFIED**.
HC-RR-01A/01B/01C: COMPLETE / MERGED — PR #94/#95/#96.
HC-RR-01D: **IMPLEMENTED FUNCTIONALLY / ACCEPTANCE BLOCKED / NOT MERGED**,
as specified by the human delta; its separate worktree was not inspected here.
Return/Reconciliation backend: **NOT YET CERTIFIED COMPLETE**.
Real Company cutover and real Equipment reconciliation: **NOT EXECUTED**. M-HC1: **OPEN**.

## Current acceptance and superseded assertion

The binding final human delta supersedes only the single-run real Confirm
`expect(confirmMs).toBeLessThan(10000)` assertion as a PERF-01 gate. The N1000
real Confirm test remains active: terminal state, snapshots, item evidence, exactly
one Effect/2000 Lines and replay without additional Lines are still asserted;
1001 Positions still reject. No test is skipped or counted as passing by exclusion.
Its logs explicitly say PERF-02 baseline / throughput NOT CERTIFIED.
Three test-only read timing wrappers were removed because ordinary Promise wrappers
lose Prisma fluent-client return types; production reads and functional checks are
unchanged. Historical read timings are preserved in the baseline section below.

PERF-01 retains N1000 structural completion <10 s, explicit validation <4 s,
one aggregate call per terminal root/Effect, local item/Line checks, all correctness
invariants and actual PostgreSQL cancellation/rollback. No thresholds or timeouts
were increased. The structural fixture is set-based staging, not real writer throughput.

## Current structural performance — PASS

Run `d27d7662-4664-445c-b85f-b62703bddeb8`, PostgreSQL16 fresh loopback/tmpfs,
port 51812; no concurrent suite during this measurement. Milliseconds:

| N    | Dispatch structural complete | Dispatch aggregate | Physical local | Physical aggregate | Total explicit Dispatch + physical | RR aggregate |
| ---- | ---------------------------: | -----------------: | -------------: | -----------------: | ---------------------------------: | -----------: |
| 10   |                       173.50 |              13.77 |           2.36 |               4.19 |                              20.32 |        12.42 |
| 50   |                       137.26 |              10.61 |           2.36 |               2.58 |                              15.55 |         5.50 |
| 100  |                       149.25 |               9.79 |           2.58 |               4.00 |                              16.36 |        10.81 |
| 250  |                       427.10 |              27.81 |           9.89 |              31.62 |                              69.31 |        41.53 |
| 500  |                       574.29 |              57.10 |          14.40 |               6.01 |                              77.52 |        63.74 |
| 1000 |                  **1288.36** |         **118.28** |      **20.05** |           **9.27** |                         **147.59** |    **70.71** |

At every N: Dispatch aggregate calls=1; RR aggregate calls=1; physical aggregate
calls=1. Flushing only Line-local constraints invokes zero full physical aggregate
validators. Physical N1000 total=29.32 ms. RR N1000 DRAFT staging=237.48 ms.
These are wall-clock client measurements, not server-only CPU timings.

## Current correctness, timeout and migration results

Dispatch and RR local/final separation, DRAFT safety without a root update,
provenance, Material/Equipment evidence, snapshots, missing audit rejection,
observational episodes, terminal/audit immutability and tenant isolation passed.
Physical CREDIT, TRANSFER, DEFINITIVE_OUT, COUNT_CORRECTION and OPENING passed,
including count/ordinal completeness, arithmetic, tenant references, grouped
balance, replay, duplicate evidence and late Line rejection on unchanged committed
Effects. History remains append-only through supported application paths; no general
historical SQL UPDATE/DELETE/TRUNCATE protection is added or claimed.

Dispatch evaluates Line, Effect, then Dispatch/idempotency/custody deferred
constraints after all staging/root/audit/claim writes and before callback return.
The existing statement timeout is still active. The explicit deferred pg_sleep(2)
probe under a 75 ms server statement_timeout raised SQLSTATE 57014, and its inserted
row was absent after rollback (109 ms test). Physical negative tests also prove
Effect/Line atomic rollback. This evidence does not rely solely on Prisma P2028.
Normal policy remains Company lock 2500 ms, lock_timeout 1500 ms,
statement_timeout 4000 ms, Prisma maxWait 3000 ms and transaction 20000 ms.

The single forward migration `20261016000000_deferred_validation_scalability`
applied successfully after all 43 existing migrations in fresh PostgreSQL16.
Equipment foundation separately exercises its historical migration subset.
Earlier migrations and schema.prisma are unchanged. Backfill/data repair NONE;
new Prisma model, product enum and API contract NONE. No writer batching, Position
CAS, projection, stock/authority, Equipment semantics, RR Confirm, RBAC or frontend
production changes are included.

## Current final regression results

| Suite                                                         |                       Final result |
| ------------------------------------------------------------- | ---------------------------------: |
| Dispatch persistence                                          |                         59/59 PASS |
| Dispatch Confirm, including real N1000 and rejection at 1001  |                         76/76 PASS |
| Reconciliation 01A structural                                 |                         44/44 PASS |
| Inventory physical                                            |                         26/26 PASS |
| New physical Effect deferred matrix                           |                         37/37 PASS |
| Purchase Receipt / Manual Inventory / COUNT_CORRECTION        |                         30/30 PASS |
| Sales physical                                                |                         12/12 PASS |
| OPENING                                                       |                         43/43 PASS |
| Equipment foundation                                          |                         23/23 PASS |
| Equipment custody close                                       | 46/46 PASS (unchanged-code repeat) |
| Deferred scaling / DRAFT / server timeout                     |                         10/10 PASS |
| **Distinct PostgreSQL cases, latest execution of each suite** |                   **406/406 PASS** |
| Full API, including affected unit tests                       |    **2460/2460 PASS — 133 suites** |

Official build-config typecheck, focal noEmit (nine source/test roots, zero
diagnostics), focal ESLint, Prisma validate and affected TS/CJS formatting passed.
Prisma validate used a dummy loopback port-1 URL and did not connect to a database.
No skipped case is included in these totals. Repeated attempts are not added twice.

### Failed attempts retained; no stability claim

The first final-delta Confirm run passed 75/76 and failed real N1000 at 20023.45 ms
with mapped HEALTHCARE_PERSISTENCE_ERROR. Full API/static verification overlapped
that attempt. Transfer=15241.15 ms, projection=3367.29 ms; final constraint evaluation
had not been reached. The underlying exception was not retained, so no specific
SQLSTATE or Prisma code is assigned to this attempt. There was no timeout change.
The subsequent full Confirm run without concurrent quality checks passed 76/76:
N1000=13542.68 ms, fixture+Confirm=14166.81 ms, transfer=7145.76 ms,
projection=1354.91 ms, evidence=1514.33 ms, snapshots=1646.67 ms. Its three explicit
constraint statements took 16.09 + 467.87 + 160.00 = 643.97 ms.
This repeat does not erase the failure or certify repeatable writer reliability.

The first Equipment custody close run passed 32/46; 14 cases rejected at the
existing server timestamp guard before close writes. A fresh unchanged-code repeat
passed 46/46. The first failure's timestamp values/cause were not captured; no
constraint, clock guard, timeout or Equipment production code was weakened.
This transient result remains a human-review limitation rather than a concealed PASS.

## PERF-02 historical READ baseline and pending acceptance

Ten normal real N1000 Confirm executions (seconds):
15.7840, 16.2424, 14.8417, 16.9058, 18.4479, 12.7684, 16.0896, 15.5917, 17.2822, 14.7895.
Median **15.94 s**, nearest-rank sample p95 **18.45 s**, **7/10 above 15 s**,
**0/10 natural transaction failures in that historical sample only**.
The later failed final-delta run above is outside that ten-run sample; 0/10 must
not be generalized to all executions in this work.

Approximately **8137 application-issued SQL commands** per Confirm (8138 observed
including one diagnostic PID query), not network packets or trigger-internal SQL.
Transfer=5011, compatibility projection=1002, evidence=1000, snapshots=1000;
remaining=124. Median phase durations: transfer 8.75 s, projection 1.44 s,
evidence 1.91 s, snapshots 2.02 s. Ten-run explicit constraints median 355 ms,
max 660 ms. Those method times include SQL transport and are not exclusive CPU.

Two controlled READ expirations under the unchanged 20 s policy reproduced Prisma
P2028, including an expiration after transfer/projection/evidence staging: PostgreSQL
ROLLBACK left root DRAFT and no Effect, Lines, confirm audit, claim or staged evidence.
They are controlled probes, not natural failures in the ten-run sample. They do not
recover the uncaptured historical ~21.44 s exception or the new ~20 s mapped exception.

READ targets (both cleaned): 127.0.0.1:50479 and :63256,
`zaping_case_dispatch_confirm_test`, role `case_dispatch_confirm_test`, runs
`f149bae4-e918-47dc-8c02-f3ed444b4bf2` and
`7dac9112-4fcd-4afb-aab5-85d6b7587451`.

HC-RR-PERF-02 is READY / NOT IMPLEMENTED, TARGET 5 SP. Future acceptance requires
repeatable real PostgreSQL Confirm p95 <=15 s and zero timeout failures using normal
transaction configuration; report median/p90/p95/max and every failed execution.
The approved follow-up addresses physical Line persistence, compatibility projection,
Dispatch evidence and snapshots. No batching or throughput implementation is made here.
HC-RR-01D remains functionally implemented but acceptance blocked and not merged;
PERF-01 review/merge and PERF-02 writer acceptance remain prerequisites to its closure.

## Final-delta disposable targets and cleanup

All targets below were newly created PostgreSQL16 on loopback/tmpfs with no volume
and a non-superuser runtime. Every owned container/tmpfs was removed. Never reused
an existing task/dev/QA/production database during this final delta.

| Purpose                      | 127.0.0.1 port / database                           | Run                                  | Cleanup |
| ---------------------------- | --------------------------------------------------- | ------------------------------------ | ------- |
| Structural scaling           | 51812 / zaping_case_dispatch_persistence_test       | d27d7662-4664-445c-b85f-b62703bddeb8 | PASS    |
| Confirm first failed attempt | 51828 / zaping_case_dispatch_confirm_test           | dc923af6-68fc-4bb9-a9e3-0dd99c01b66f | PASS    |
| Confirm final                | 59650 / zaping_case_dispatch_confirm_test           | 94692b0f-bc55-4126-aa72-c46624fbf3df | PASS    |
| Dispatch persistence         | 50881 / zaping_case_dispatch_persistence_test       | bc4a7fdf-fb95-4239-8957-da5b7ca71988 | PASS    |
| RR persistence               | 52944 / zaping_case_reconciliation_persistence_test | a58f2761-09f3-450b-8b77-6dea91ddf7f2 | PASS    |
| Physical + new matrix        | 52951 / zaping_spike_test                           | f21a9daa-4e8d-4ae9-b919-f7a3541a3935 | PASS    |
| Receipt/Manual/Count         | 52960 / zaping_spike_test                           | 70f164b6-4512-416c-95a1-658c5d6055ee | PASS    |
| Sales                        | 52972 / zaping_spike_test                           | 1f1c1187-94d7-4d90-aaaf-871a0488f4ec | PASS    |
| OPENING                      | 58574 / zaping_opening_test                         | c0087a8b-1103-45de-8ae2-b52c1d716eda | PASS    |
| Equipment foundation         | 58588 / zaping_equipment_physical_test              | abe57edc-2f39-453e-961e-efe25313b11c | PASS    |
| Custody first failed attempt | 58603 / zaping_equipment_custody_close_test         | ba9aad09-dfa5-430f-a898-ed21b072d7f0 | PASS    |
| Custody final                | 55426 / zaping_equipment_custody_close_test         | 18835db6-4378-4656-a2bb-b72f387e0585 | PASS    |

Runtime roles: case_dispatch_persistence_test, case_dispatch_confirm_test,
case_reconciliation_persistence_test, zaping_inv01a_<random>, zaping_inv01b_<random>,
zaping_inv01c_<random>, opening_test, equipment_physical_test,
equipment_custody_close_test. Disposable role passwords were generated per runner;
no stored credentials or .env were used or modified. A separate network-disabled
`docker run --rm ... date` inspected the container clock only and removed itself.

## Documentation and Git disposition

Final checks: git diff --check PASS; status/stat reviewed; 13 tracked modifications
and eight new files (21 total), staged NONE. Final Docker checks found no containers
under the nine acceptance-runner labels. The four documentation paths are
`docs/project/PROJECT_BOARD.md`,
`docs/modules/healthcare/CASE_DISPATCH_TECHNICAL_DESIGN.md`,
`docs/modules/healthcare/CASE_RECONCILIATION_TECHNICAL_DESIGN.md` and
`docs/modules/erp/INVENTORY_CUSTODY_TECHNICAL_DESIGN.md`.

Updated Project Board and Dispatch, Reconciliation and Inventory custody technical
design addenda only after the final PERF-01 gates passed. The historical sections
below retain their original measurements/status decisions under the old gate;
current acceptance above supersedes those statuses and historical file counts.
The complete uncommitted scope is 21 files: the previous 17 implementation/test/
evidence paths listed below plus those four technical/project documents.
No staging, commit, push, branch switch, stash, reset or clean. No access to the
original 01D worktree, output/, tmp/, .env or stored credentials in this final delta.

---

# Historical implementation evidence — previous gate, superseded status

Everything below records the earlier implementation delta. Its real Confirm <10 s
acceptance requirement and blocked status were superseded by the final human delta.
Measurements, failed attempts, safety deviations and implementation details remain
historical evidence; they are not current gate definitions or current project status.

# HC-RR-PERF-01 — validation scalability acceptance evidence

Status: PHYSICAL DELTA IMPLEMENTED / TESTED; overall HC-RR-PERF-01 BLOCKED by the
real Dispatch Confirm N1000 completion gate. TARGET remains 8 SP. Not merge certified.

## Implementation and enforcement boundary

The single unmerged forward migration
`20261016000000_deferred_validation_scalability` is extended atomically (BEGIN/COMMIT).
Older merged migrations and schema.prisma are unchanged. No backfill, seed, row
rewriting, mutable counters, generic historical UPDATE/DELETE/TRUNCATE guards,
public API, RBAC, frontend or timeout changes.

The existing Dispatch/Reconciliation split remains: local final-row checks retain
DRAFT safety and provenance; a terminal root transition queues one aggregate check.
Material totals are grouped once per tenant/root execution. Audit CHECK/FK and
append-only guards remain; audit insertion does not queue another aggregate scan.

`InventoryPhysicalEffect_complete` still fires on Effect INSERT, now using one
Company/Effect-scoped materialized Lines/Position relation and one TRANSFER grouping.
It retains final count/min/max, CREDIT, DEFINITIVE_OUT, non-count zero-delta exclusion,
COUNT_CORRECTION cardinality/AVAILABLE state and every merged OPENING predicate.
OPENING permits the same Position states as before, including registered CUSTODY.

`InventoryPhysicalEffectLine_complete` keeps its name but invokes the new
`inventory_physical_effect_line_local()` function. It reads only the final affected
Line and its Company-scoped parent and checks 1 <= sequence <= final lineCount.
Immediate CHECK/FK/UNIQUE constraints retain arithmetic, tenant and duplicate safety.
A valid unchanged committed Effect already occupies every ordinal 1..lineCount:
UNIQUE rejects occupied ordinals; the local upper bound rejects new late ordinals.

The binding human delta establishes APPLICATION-PATH append-only history.
Unsupported direct-SQL UPDATE of historical headers, DELETE/replacement of Lines
and history reconstruction are outside this ticket. Database-enforced general
historical immutability is neither added nor claimed. Supported writers create a
header with final lineCount and all Lines in one transaction; replay appends none.

Dispatch Confirm explicitly evaluates physical Line constraints, then physical
Effect constraints, then Dispatch/custody constraints AFTER all staging writes.
Errors escape its callback. Existing production timeout policy is unchanged.

## Isolated scaling measurement — PASS

Command from app/api:
`node test/helpers/deferred-validation-postgres-runner.cjs --run-isolated`

New PostgreSQL 16, loopback random port 64098, tmpfs, no volume, non-superuser runtime.
Database `zaping_case_dispatch_persistence_test`, run
`fd84d5c9-e754-41e1-a5a6-d6c5e5261ef2`. Container/tmpfs cleanup PASS.
No other PostgreSQL regression ran concurrently with the scaling measurement.

All values below are wall-clock milliseconds including client/SQL transport.
Dispatch fixture uses N items, N distinct batched sources/destinations and one
TRANSFER Effect with 2N Lines. createMany/set-based staging isolates SQL validation;
this fixture is not a production Confirm throughput claim. Physical writes are
included in Dispatch writes, not additive. Local/header flushes are separate SQL
statements. Counts use before/after pg_stat_xact_user_functions deltas with
track_functions=all. The Line-only flush asserts ZERO full aggregate calls.

|    N | Dispatch fixture/write | Physical writes | Dispatch flush | Physical Line local | Physical Effect aggregate | Physical explicit total | All explicit total | Dispatch fixture complete |
| ---: | ---------------------: | --------------: | -------------: | ------------------: | ------------------------: | ----------------------: | -----------------: | ------------------------: |
|   10 |                 196.29 |           40.35 |          17.38 |                4.85 |                      7.06 |                   11.90 |              29.28 |                    243.90 |
|   50 |                 142.99 |           57.98 |          10.33 |                2.97 |                      3.75 |                    6.72 |              17.05 |                    172.45 |
|  100 |                 188.40 |           87.53 |          16.05 |                4.41 |                      7.83 |                   12.25 |              28.29 |                    233.49 |
|  250 |                 387.16 |          214.54 |          26.91 |                6.95 |                     29.71 |                   36.66 |              63.56 |                    490.26 |
|  500 |                 633.52 |          346.05 |          75.07 |               12.52 |                      7.26 |                   19.77 |              94.84 |                    741.46 |
| 1000 |                1156.11 |          741.29 |         127.62 |               22.34 |                      9.22 |                   31.56 |             159.18 |                   1326.43 |

Full aggregate call counts at EVERY N: Physical Effect 1; Dispatch 1; Reconciliation 1.
No full Effect scan from each Line. Physical validation N1000 is 31.56 ms, below the
2500 ms preferred limit. All explicit fixture validation is 159.18 ms, below 4000 ms.
The same earlier fixture measured physical validation at 6948.94 ms before the split.
Smaller-N timings include startup/planner variability; no quadratic growth remains
in the measured physical flush. Reconciliation still uses observational structural
confirmation, without recreating the unmerged 01D writer.

|    N | RR DRAFT writes | RR terminal/local flush |
| ---: | --------------: | ----------------------: |
|   10 |           40.73 |                   12.94 |
|   50 |           29.85 |                    8.45 |
|  100 |           54.31 |                   16.93 |
|  250 |          108.45 |                   28.53 |
|  500 |          203.46 |                   57.91 |
| 1000 |          291.13 |                   70.85 |

Scaling suite: 10/10 PASS, including missing audit, DRAFT safety and isolated server
statement_timeout cancellation/rollback. The synthetic deferred pg_sleep(2) probe
uses a 75 ms statement timeout; it raises 57014 and its inserted row is absent.
The timeout test passed in 85 ms. Production timeouts are unchanged.

## Real production-writer N1000 gate — FAIL / STOP

An added test exercises the merged Confirm service with 1000 valid distinct material
Positions and the normal application policy, preserving the existing 1001 rejection.
The full suite passed all 75 previous tests; the new N1000 duration assertion failed:
Confirm 17012.51 ms, fixture+Confirm 17825.61 ms (run
`5c7a5dee-ca06-47a3-b80b-d5cbc7ac1485`, port 58892).

A focused repeat, with no other PostgreSQL suites running, confirmed completion at
14067.22 ms (fixture+Confirm 14958.19 ms), still above the 10000 ms gate. Target:
`127.0.0.1:59095/zaping_case_dispatch_confirm_test`, non-superuser
`case_dispatch_confirm_test`; run `8926e980-c073-4140-8b0d-377d67108dde`.
Its test-only method/constraint instrumentation measured:

| Function/phase                                   |       Calls | Milliseconds |
| ------------------------------------------------ | ----------: | -----------: |
| PhysicalInventoryService.transfer                |           1 |      7005.13 |
| InventoryCompatibilityProjectionService.apply    |           1 |      1281.58 |
| Confirm repository itemEvidence                  |        1000 |      1711.97 |
| Confirm repository itemSnapshot                  |        1000 |      1922.58 |
| Confirm repository root reads                    |           4 |       872.09 |
| Confirm repository kit reads                     |           3 |        44.42 |
| Confirm repository lockPhysical                  |           1 |       234.24 |
| Confirm repository materialConsumed              |           1 |         4.98 |
| Dispatch detail read                             |           1 |       437.67 |
| Explicit physical Line local validation          | 1 statement |        36.07 |
| Explicit physical Effect aggregate validation    | 1 statement |        15.95 |
| Explicit Dispatch/idempotency/custody validation | 1 statement |       166.54 |

Physical explicit validation: 52.02 ms. All three explicit statements: 218.56 ms.
The deferred CPU residual is resolved. The remaining bottleneck is supported writer
work: transfer's per-Line persistence and subsequent per-item evidence/snapshot
writes, plus projections/readback. Phase timings are inclusive method durations,
not PostgreSQL-exclusive CPU measurements. No broad writer optimization was made.

A further focused attempt returned HEALTHCARE_PERSISTENCE_ERROR after ~21.44 seconds;
its underlying server/Prisma cause was not captured, so it is not certified as a
specific timeout error. No timeout was raised. The final focal test now also checks
all 2000 Lines, item evidence and zero-Line replay before asserting the unchanged
10-second gate, and logs phase measurements even on failure.

Reproduce focused probe:
`CASE_DISPATCH_CONFIRM_TEST_PATTERN='45 1000 distinct' node test/helpers/case-dispatch-confirm-postgres-runner.cjs --run-isolated`
(The environment assignment above is conceptual shell notation; in PowerShell use
`$env:CASE_DISPATCH_CONFIRM_TEST_PATTERN = '45 1000 distinct'` before running Node.)

Overall performance gate remains FAIL because real Dispatch completion exceeds
10 seconds. Do not mark PERF-01 merge-ready, lower N, increase timeouts, remove the
new failing test or treat the fast SQL fixture as production completion evidence.
Further writer batching/round-trip reduction needs explicit follow-up scope review.

## Semantic and writer regressions

| Suite                                           |     Result |
| ----------------------------------------------- | ---------: |
| New physical Effect split matrix                | 37/37 PASS |
| Inventory physical                              | 26/26 PASS |
| Receipt / Manual / COUNT_CORRECTION integration | 30/30 PASS |
| Sales physical                                  | 12/12 PASS |
| Cutover OPENING                                 | 43/43 PASS |
| Dispatch persistence                            | 59/59 PASS |
| Dispatch Confirm previous cases                 | 75/75 PASS |
| Dispatch Confirm added real N1000 duration gate |       FAIL |
| Reconciliation 01A structural                   | 44/44 PASS |
| Equipment foundation                            | 23/23 PASS |
| Equipment custody close                         | 46/46 PASS |
| Deferred validation scaling / DRAFT / timeout   | 10/10 PASS |

405 passing cases and one added performance-gate failure, counting each distinct
case once. Focused diagnostic repetitions intentionally skip the other 75 Confirm
cases; the preceding full run exercised all 76. No invariant is suppressed to pass.

The physical matrix covers valid CREDIT/TRANSFER/OUT, positive/negative/zero COUNT,
AVAILABLE and CUSTODY OPENING; incomplete count, gaps, late/duplicate ordinals,
missing debit/credit, Product and batch imbalance, invalid CREDIT/OUT/COUNT/OPENING,
Company/FK mismatches, duplicate Position, quantity/revision arithmetic and explicit
failure rollback. Shared destination TRANSFER commits. Existing writer suites prove
replay produces no additional physical writes and application-path history remains
append-only. No new test requires unsupported historical SQL mutation protection.

Every database used for THIS delta is NEW PostgreSQL16, loopback/tmpfs, no volume,
with a non-superuser runtime and owned-container cleanup. Extra targets:

- Physical + new matrix: port 61072, run e13036bb-f603-425d-9a8a-d2719ab67009.
- Receipt/Manual/Count: port 61073, run abd7bca6-854c-4ac7-9467-941ee5343829.
- Sales: port 61071, run a52cefc6-f998-49e7-8092-adce84c19208.
- Opening: port 61074, run 8f2e4512-40e5-4d50-a3ae-ad0717233c0b.
- Dispatch persistence: port 55858, run c4151a56-8fa3-45dd-a21c-747dbc966d62.
- Reconciliation 01A: port 55859, run 568b3337-7e69-43c2-9975-a91386537408.
- Equipment foundation: port 55860, run 5f6d3bc8-972f-41a0-b7b7-396ff7d40504.
- Custody close: port 55861, run 10e9706f-e84f-45a3-ae01-b7147a9db55e.
  The first attempt at extending the migration failed on SQL quoting in a disposable
  DB; it was corrected before successful deployment and acceptance. That container
  was also removed. No existing database, .env or stored credentials were used here.

Historical deviations from the earlier initial PERF implementation remain recorded:
one read-only original-worktree status/file listing before its restriction was read;
and one legacy inventory runner used the existing spike test DB, confirmed cleanup
of its test fixtures and temporary role, then was replaced by fresh acceptance.
THIS delta did not access the original worktree or the legacy database. The new
fresh integration/Sales runners avoid their legacy fixed-target helpers.

## Post-merge HC-RR-01D requirement

HC-RR-01D remains BLOCKED UNTIL PERF-01 MERGE. Its implementation in a separate
worktree is not certified and was not inspected/modified here. After PERF-01 can
actually merge, safely sync/rebase that baseline and add these exact calls after
ALL staging, audit, root-transition and idempotency-completion writes:

```ts
await tx.$executeRawUnsafe(
  'SET CONSTRAINTS "InventoryPhysicalEffectLine_complete" IMMEDIATE',
);
await tx.$executeRawUnsafe(
  'SET CONSTRAINTS "InventoryPhysicalEffect_complete" IMMEDIATE',
);
await tx.$executeRawUnsafe(
  'SET CONSTRAINTS "Reconciliation_local_state", "Reconciliation_item_final_state", "Reconciliation_final_state", "Reconciliation_insert_final_state", "Reconciliation_idempotency_resource", "EquipmentAsset_custody_coherence", "EquipmentAssetCustody_coherence" IMMEDIATE',
);
```

Rerun complete 01D acceptance and certify RETURNED/USED 1000/1001. Do not perform
those steps here. Project Board and technical design remain unchanged because ALL
gates are not green. Return/Reconciliation backend is not complete; M-HC1 stays OPEN.

## Files changed (entire uncommitted PERF work)

- app/api/prisma/migrations/20261016000000_deferred_validation_scalability/migration.sql
- app/api/src/healthcare/case-dispatches/healthcare-case-dispatch-confirm.service.ts
- app/api/test/deferred-validation.postgres.e2e-spec.ts
- app/api/test/deferred-validation-results.md
- app/api/test/physical-effect-deferred.postgres.e2e-spec.ts
- app/api/test/case-dispatch-confirm.postgres.e2e-spec.ts
- app/api/test/case-dispatch-persistence.postgres.e2e-spec.ts
- app/api/test/equipment-physical-foundation.postgres.e2e-spec.ts
- app/api/test/inventory-physical.postgres.e2e-spec.ts
- app/api/test/inventory-integration.postgres.e2e-spec.ts
- app/api/test/sales-physical.postgres.e2e-spec.ts
- app/api/test/helpers/deferred-validation-postgres-runner.cjs
- app/api/test/helpers/inventory-physical-fresh-postgres-runner.cjs
- app/api/test/helpers/inventory-integration-fresh-postgres-runner.cjs
- app/api/test/helpers/sales-physical-fresh-postgres-runner.cjs
- app/api/test/helpers/case-dispatch-confirm-postgres-runner.cjs
- app/api/test/helpers/equipment-physical-foundation-postgres-runner.cjs

Schema.prisma unchanged. Backfill NONE. Additional migration NONE. Existing merged
migrations unchanged. Staged NONE. Committed NONE. Pushed NONE. Original 01D worktree,
output/, tmp/, .env and stored credentials were not accessed or modified in this delta.

## Final static checks and cleanup

API build-config noEmit typecheck: PASS. Affected TypeScript ESLint: PASS.
Prettier check on affected implementation/performance tests and runners: PASS.
git diff --check: PASS. No staged paths. No task-owned containers remained in the
final label-filtered Docker checks. Final focal attempt used port 55067, run
913fcc5b-f453-4e88-a945-e986b6b681e1, and its container/tmpfs cleanup passed.
The test-only timing wrappers were subsequently adjusted to satisfy typed lint;
no production behavior or gate threshold changed during that cleanup.

The 17-file uncommitted diff contains nine tracked modifications and eight new
unstaged files. git diff --stat reports tracked paths only. No changes were made
to Project Board/technical design because the full writer gate is red.
