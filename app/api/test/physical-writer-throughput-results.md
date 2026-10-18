# HC-RR-PERF-02 — physical writer throughput acceptance

2026-10-17. Worktree C:/dev/zaping-perf; branch
`perf/hc-rr-perf-02-writer-throughput`; baseline `70a962b` (PR #97).
HC-RR-PERF-01: COMPLETE / MERGED — PR #97.
HC-RR-PERF-02: **IMPLEMENTED / TESTED — PENDING HUMAN REVIEW / MERGE — TARGET 5 SP**.
HC-RR-01D: IMPLEMENTED FUNCTIONALLY / ACCEPTANCE BLOCKED UNTIL PERF-02 MERGE /
NOT MERGED — TARGET 8 SP; separate acceptance remains required after baseline sync.
Return/Reconciliation backend: NOT YET CERTIFIED COMPLETE. Real Company cutover and
real Equipment reconciliation: NOT EXECUTED. M-HC1 OPEN.

## Implementation and integrity

Exactly three approved areas changed; no Position CAS optimization:

- Physical EffectLines: stage canonical evidence after the existing per-Position
  create/CAS loop, then createManyAndReturn in chunks <=250. No skipDuplicates.
  Input Position IDs are unique; Company/Effect and sequence are verified before
  SQL. Real persisted IDs come from RETURNING, mapped by sequence with exact field
  and cardinality verification, independent of SQL return order. One business
  Effect/origin/hash and the original receipt/replay contract remain unchanged.
  The single-Line writer remains available to existing OPENING/internal callers.
- Dispatch evidence and snapshots: separate typed repository bulk methods use
  parameterized VALUES/UPDATE/RETURNING in chunks <=250, validate uniqueness before
  SQL and exact returned ID sets. Evidence requires ACTIVE, exact Company/root/type,
  DRAFT parent and empty prior evidence/snapshot. Material references must match
  Company/Product/Batch, destination context, Effect origin and positive Line;
  Equipment custody/event must match Company/Asset/Case/Assignment/origin. Snapshot
  writes require exact current lifecycle, DRAFT parent, null prior snapshot and v1
  JSON. ACTIVE and EXCLUDED descriptive snapshots persist exactly. No item
  snapshotVersion column, fallback or post-terminal writes were introduced.
- Compatibility Batch projections: retain grouped nonzero deltas; parameterized
  bounded UPDATE FROM checks Company/Product/Batch, original atomic lower/upper
  availableQuantity bounds and exact returned ID sets, and preserves updatedAt.
  Product.stock guarded updates remain unchanged. AVAILABLE state alone contributes
  Batch availability; CUSTODY contributes ownership but not AVAILABLE credits/debits.

Every operation remains in the existing caller transaction. A missing/incompatible
row, duplicate input, unexpected cardinality or later failure escapes the callback
and rolls back all physical/business work. Snapshot parsing still precedes writing.
Audit/root finalization/idempotency completion and explicit PERF-01 constraints stay
at the end, with all Lines/evidence/snapshots already staged.

## Lock-order and concurrency proof

Physical apply discovers source and target Batch IDs, locks sorted Products, then
all sorted Batches, then Positions, before physical mutations. Dispatch also retains
its pre-existing canonical root/Product/Batch/Position/Asset locks. Projection uses
only those already held Batch rows; UPDATE FROM planner order cannot introduce a
new row-lock order. The new domain-specific applyBatchDeltas method requires those
prelocks; direct acceptance callers acquire them in the same order.
Position mutatePosition is byte-for-byte unchanged after newline normalization:
Company/ID/revision/quantity guard and quantity/revision increment are intact.
No stale expected revision refresh, bulk Position update, new lock family, late root,
transaction nesting, or change to authority fence/HC Company lock.

PostgreSQL concurrency acceptance uses independent backend PIDs, pg_blocking_pids
and barriers: concurrent Transfer and competing Position/stale revision remain
covered; new competing Batch writers block on canonical prelocks, then the loser
rechecks bounds and aborts. Concurrent physical Sales and Receipt with Confirm,
manual/count compatibility, same/different-key replay, late failure and rollback
remain green. No deadlock regression was observed.

## N1000 measurement policy and results — PASS

Command from app/api (PowerShell):

`$env:RUN_WRITER_THROUGHPUT='1'; $env:WRITER_THROUGHPUT_RUNS='30'; $env:CASE_DISPATCH_CONFIRM_TEST_PATTERN='45 1000 distinct'; node test/helpers/case-dispatch-confirm-postgres-runner.cjs --run-isolated`

The actual orchestration set these variables only in its child process environment.
New PostgreSQL16 on loopback/tmpfs, no volume, fresh 44 migrations and restricted
runtime role. One fresh environment contains 30 independent valid fixtures with
unique Companies, one prepared Material source, 1000 distinct batches and material
source/destination Positions, one Transfer
Effect and 2000 Lines each. N is never reduced. beforeAll connects clients and fixture
creation occurs outside the timer, matching the READ baseline. No separate warm-up
execution is discarded: the first measured Confirm is included. All 30 execute the
real merged service and check terminal snapshots/evidence, Effect/Line cardinality,
per-item destinations and unchanged replay. No other test/build/lint process ran
concurrently with the 30 measurements. Query-event counting/test-only phase wrappers
remain enabled throughout the measured service call; no backend PID probe is added.
Times include client orchestration/SQL transport; they are not server CPU timings.

Normal settings unchanged: Company acquisition 2500 ms; lock_timeout 1500 ms;
statement_timeout 4000 ms; Prisma maxWait 3000 ms; Prisma transaction 20000 ms.
No alternate Company release policy or increased timeout was introduced.

| Metric                              | Historical READ baseline (10) | Optimized sample (30) |
| ----------------------------------- | ----------------------------: | --------------------: |
| Median                              |                       15.94 s |           **6.324 s** |
| p90, nearest rank                   |                       17.28 s |           **7.486 s** |
| p95, nearest rank                   |                       18.45 s |           **7.922 s** |
| Maximum                             |                       18.45 s |           **8.519 s** |
| Above 15 s                          |                          7/10 |              **0/30** |
| Natural failures in this sample     |                          0/10 |              **0/30** |
| Transaction timeouts in this sample |                          0/10 |              **0/30** |

Binding p95 <=15 s / zero timeout failures: PASS. Desired median <12 s: PASS.
p95 uses ceil(0.95*30)=29th ordered sample; median averages samples 15/16.
The historical PERF-01 acceptance had additional failed attempts outside its ten-run
READ sample; these remain in deferred-validation-results.md. They are not erased or
included in this new optimized sample. No optimized execution failed or was excluded.
Initial optimized full Confirm N1000 probes before the 30-run sample completed at
6283.99 ms and 6404.68 ms; they are not substituted for the repeated gate.

All 30 normal Confirm times (milliseconds, chronological):
6209.0944, 5869.0035, 5595.4717, 7376.7633, 6950.7889, 6721.6125,
5865.8289, 6050.2244, 6856.9054, 6338.8406, 6495.7362, 5759.1521,
6179.1268, 6149.8487, 6515.4156, 6524.7121, 6264.0779, 6180.7316,
6950.4993, 8519.1200, 7485.6768, 6432.0985, 6116.6833, 6033.9390,
6292.4850, 7587.4295, 6206.3583, 6482.2676, 7921.7808, 6309.1955.

## Actual application SQL command counts

All 30 optimized executions issued exactly **3157** application SQL commands versus
~8137 baseline: 4980 fewer, approximately **61.2% reduction**. Counts include client
transaction/control statements but exclude trigger-internal SQL and do not represent
network packets. Prisma query events are counted only between Confirm entry/return;
fixtures, assertions and the subsequent replay check are outside that counter.

| Phase                                      | Baseline commands | Optimized commands |
| ------------------------------------------ | ----------------: | -----------------: |
| Physical transfer                          |              5011 |           **3019** |
| Compatibility projection                   |              1002 |              **6** |
| Dispatch item evidence                     |              1000 |              **4** |
| Dispatch item snapshots                    |              1000 |              **4** |
| Remaining control/reads/locks/finalization |               124 |            **124** |
| Total                                      |             ~8137 |           **3157** |

Transfer retains 1000 destination INSERTs and 2000 unchanged Position CAS UPDATEs,
10 reads, one Effect INSERT; only 2000 Line INSERTs become eight chunks. Projection
retains two facts/Position reads, uses four Batch updates and zero Product stock
updates for this zero-owned-delta Transfer. Remaining=113 other +7 outer physical
locks +1 capacity +3 explicit constraint statements. The READ estimate ~3141 omitted
bounded chunk overhead; 3157 is measured, not an estimated target.

| Measured phase                                    |               Calls | Median ms |  p95 ms |  Max ms |
| ------------------------------------------------- | ------------------: | --------: | ------: | ------: |
| Outer physical prelocks                           |                   1 |    173.38 |  225.76 |  275.65 |
| Material capacity                                 |                   1 |      4.83 |    7.13 |    8.46 |
| Physical transfer                                 |                   1 |   4326.45 | 5783.83 | 6923.81 |
| Compatibility projection                          |                   1 |    157.89 |  175.76 |  180.85 |
| Evidence bulk                                     | 1 (four SQL chunks) |     96.96 |  166.62 |  178.81 |
| Snapshot bulk                                     | 1 (four SQL chunks) |    351.13 |  398.03 |  411.99 |
| Explicit physical local constraints               |                   1 |     20.43 |   23.70 |   25.96 |
| Explicit physical aggregate constraints           |                   1 |    273.48 |  379.36 |  440.97 |
| Explicit Dispatch/idempotency/custody constraints |                   1 |    135.30 |  319.54 |  324.59 |

Phase medians/percentiles are computed separately and cannot be added to reconstruct
whole-operation percentiles. Remaining round trips are dominated by the approved
unchanged Position creation/CAS implementation. No bulk Position redesign was needed.
Capacity reads still scale with the number of distinct prepared sources; this
comparable fixture has one prepared source, as in the READ baseline. Other fixture
shapes were not separately benchmarked. Local 30-run acceptance does not execute
operational adoption or certify RR-01D.

## Functional and regression acceptance

| Suite                                                       |                 Current result |
| ----------------------------------------------------------- | -----------------------------: |
| Confirm full, including new bulk guards/exact JSON/rollback |                 **90/90 PASS** |
| Inventory physical                                          |                 **27/27 PASS** |
| Physical Effect deferred invariant matrix                   |                 **37/37 PASS** |
| Receipt / Manual / COUNT / Batch projection                 |                 **38/38 PASS** |
| Sales physical                                              |                 **12/12 PASS** |
| Dispatch persistence                                        |                 **59/59 PASS** |
| RR structural                                               |                 **44/44 PASS** |
| OPENING                                                     |                 **43/43 PASS** |
| PERF-01 structural/DRAFT/server timeout                     |                 **10/10 PASS** |
| Distinct PostgreSQL functional/regression cases             |               **360/360 PASS** |
| Repeated real N1000 performance cases, reported separately  |                 **30/30 PASS** |
| Full API, including affected units                          | **2473/2473 PASS, 134 suites** |
| New writer batching unit cases, included in full API        |                 **13/13 PASS** |

Benchmark selection intentionally leaves 88 unrelated cases unexecuted in that
benchmark run; they are not counted as PASS there. All are exercised by the separate
90/90 complete Confirm run. Earlier 76/76 and 88/88 development executions are
retained as successful probes, not counted again in the 360 distinct cases.

Focused cases verify canonical sequence and exact persisted before/after facts,
IDs/cardinality, no skipDuplicates, duplicate/missing/incompatible evidence rejection,
later-chunk failure rolling back earlier chunks and every Position CAS, wrong
Company/root/lifecycle/reference and duplicate input rejection, non-overwrite,
partial UPDATE rollback, exact ACTIVE/EXCLUDED JSON and no post-terminal mutation.
Batch cases retain quantity bounds, grouped identities, zero-owned Transfer,
CUSTODY out ownership, CUSTODY→AVAILABLE restoration and unchanged replay.
Existing negative physical completeness/duplicate/missing Line assertions all reject.
Standalone Equipment PostgreSQL suites were not rerun: Equipment production code is
unchanged; full API Equipment units and full Confirm Equipment/MIXED/custody-failure
regressions passed. No frontend/shared public contract changes; Web not run.

Official typecheck, focused noEmit (10 source/test roots, zero diagnostics), focal
ESLint, Nest build, Prisma validate, Prettier/check and git diff --check: PASS.
Prisma validate used a dummy loopback port-1 URL with no connection. Schema and every
migration, including approved PERF-01 triggers, remain unchanged. No backfill.
No implementation/test acceptance failure occurred in this PERF-02 delta.

## Disposable database targets and cleanup

Every listed database was freshly created on PostgreSQL16 loopback/tmpfs without
volumes. Runtime roles are non-superuser/NOCREATEDB/NOCREATEROLE, with generated
per-run credentials; stored credentials/.env were not used or changed. Every runner
verified container ownership before cleanup. All targets/container/tmpfs removed.

| Purpose                    | 127.0.0.1 port / database                           | Run                                  | Cleanup |
| -------------------------- | --------------------------------------------------- | ------------------------------------ | ------- |
| Initial full Confirm       | 52277 / zaping_case_dispatch_confirm_test           | 1b135459-69be-4af4-a4dc-ee449e8a3efe | PASS    |
| Extended Confirm           | 61937 / zaping_case_dispatch_confirm_test           | 621ab270-759d-4ee8-8ed9-39080c4fff57 | PASS    |
| Physical + deferred matrix | 53458 / zaping_spike_test                           | abd17b36-3ba5-457f-857a-504f6a99f14a | PASS    |
| Receipt/Manual/Count/Batch | 53474 / zaping_spike_test                           | 7ec62ccd-df2f-4766-b33f-61b1f7ff5031 | PASS    |
| Sales                      | 53482 / zaping_spike_test                           | 985bddf8-5093-4ffc-abf4-51c6719450b5 | PASS    |
| Dispatch persistence       | 53491 / zaping_case_dispatch_persistence_test       | 77180502-ee4b-49e6-8128-9b6028c2bbc4 | PASS    |
| RR persistence             | 53497 / zaping_case_reconciliation_persistence_test | 911bc576-7d5c-4b7e-8329-b1f65987fba9 | PASS    |
| OPENING                    | 53504 / zaping_opening_test                         | d8716e84-7d2e-47da-8b50-880120d16c22 | PASS    |
| PERF-01 regression         | 53731 / zaping_case_dispatch_persistence_test       | 68500d63-3d0c-4236-94ea-1e8d1bfa460a | PASS    |
| Final full Confirm         | 61775 / zaping_case_dispatch_confirm_test           | 3acedba2-42f4-4abe-bd24-748426939445 | PASS    |
| 30-run benchmark           | 56436 / zaping_case_dispatch_confirm_test           | 3b74139c-1ed8-4c4e-853a-4e7a5fbac2ef | PASS    |

Runtime roles: case_dispatch_confirm_test, case_dispatch_persistence_test,
case_reconciliation_persistence_test, zaping_inv01a_92ef2f2767c8,
zaping_inv01b_d9c1556de398, zaping_inv01c_<random>, opening_test.
No existing task, dev, QA or production DB was accessed. Original 01D worktree,
output/, tmp/, .env and stored credentials: UNTOUCHED.

## Files and Git disposition

Five production files: physical-inventory.repository.ts, physical-inventory.service.ts,
inventory-compatibility-projection.service.ts, healthcare-case-dispatch-confirm.repository.ts
and healthcare-case-dispatch-confirm.service.ts. Test scope: existing physical
contract unit and three PostgreSQL suites, plus new physical-writer-batching.spec.ts.
Documentation: this evidence, historical PERF-01 evidence pointer, Project Board and
Dispatch/Reconciliation/Inventory custody technical addenda. Total 16 changed files.
No staging, commit, push, stash, reset, clean, branch switch or other worktree change.
No hard stop or scope expansion. PERF-02 remains pending human review/merge; 01D
must integrate that merged baseline and pass its own separate acceptance before
being marked complete. Backend RR NOT YET CERTIFIED COMPLETE; M-HC1 OPEN.
