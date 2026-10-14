# Inventory authority cutover — 01D-C operational runbook

Scope: one explicit Company/cutover/revision/digest. This runbook does not authorize
execution. ACTUAL CUTOVER NOT EXECUTED; 01D ACTIVATION NOT PERFORMED AGAINST REAL
COMPANY. EXTERNAL FENCE NOT CERTIFIED. 01A/01B/01C activation DORMANT; M-HC1 OPEN.

## Authority and transaction contract

Every productive Manual, Receipt, Sale approval and Quote conversion transaction
uses READ COMMITTED, the shared Company transaction advisory fence, runtime identity
validation and the single InventoryAuthorityResolver, in that order. Exactly one
LEGACY or PHYSICAL branch executes. CUTOVER and RECOVERY_REQUIRED reject before
business/idempotency mutation. No physical error authorizes legacy fallback.

The fence uses PostgreSQL's two-int namespace `0x494e5641` and the first signed
32 bits of SHA-256 of the lowercase Company UUID. Collisions cause conservative
contention only; all actual queries retain Company predicates. Normal writers use
shared locks, not a Company-wide exclusive mutex. Control creation/transitions,
recovery, manifest review/APPLY/certification and activation acquire the exclusive
fence before control and business roots. Exclusive tooling rejects fixed-snapshot
transaction isolation. Read-only B VERIFY retains its consistent snapshot and is
recomputed inside the guarded activation transaction.

Ordering after the fence:

- Manual legacy: Product before current stock read; physical: key claim → sorted
  Products → sorted Batches → sorted Positions.
- Receipt: key claim → Purchase → ASSET_CODE reservation → sorted Products →
  Batches → Positions. QUANTITY takes CREDIT, non-QUANTITY takes its existing
  equipment/compatibility path, atomically. There is no second QUANTITY increment.
- Sale approval: Sale claim → Products → Batches → Positions.
- Quote conversion: coherent replay → SALE_FOLIO → Quote → Sale → Products →
  Batches → Positions. Every retry/readback resolves authority again under the fence.

Product.stock remains the owned compatibility projection. Inventory/Product GET,
lowStock, dashboard valuation and compatibility history keep their meanings.
OPTIONAL Sales uses eligible unbatched Candidate C only; REQUIRED remains rejected.

## Application configuration and operational adapter

Before granting the compatible binary any traffic/write capability, configure:

- `INVENTORY_AUTHORITY_PROTOCOL=inventory-authority-v1`.
- `INVENTORY_RUNTIME_BUILD`: immutable deployment artifact/commit identity, 1–128
  characters from `[a-zA-Z0-9._:-]`; all intended instances must match the certified
  artifact. Do not reuse an identity for different binaries.
- `INVENTORY_RUNTIME_ENVIRONMENT`: explicit verified environment identity using the
  same character/length contract. These are non-secret metadata, not credentials.

Missing/invalid metadata fails readiness and writers closed. `/health/live` is
process-only; `/health/ready` requires DB connectivity plus runtime identity and
returns `{status:"ok",inventory:{protocol,build,environment}}`. Configured metadata
is an assertion, not cryptographic proof of the deployed image. The external
certifier must bind it to the actual deployed binary and DB environment.

The internal CLI additionally requires an **installed trusted** operational adapter
at the absolute `INVENTORY_ACTIVATION_ADAPTER_PATH`. This executable path is privileged
configuration, never an HTTP/request/evidence-supplied path. Its export
`createInventoryActivationAdapters()` supplies `activation`, `opening` and `custody`
adapters according to `inventory-cutover-activation.contract.ts`. No permissive
production adapter is shipped. Missing adapter means activation is unavailable.
Test adapters are restricted to disposable acceptance fixtures.

The adapter must authenticate immutable externally retained evidence and its
origin/hash, not merely return values from untrusted JSON. The retained request is
written **before** activation and binds Company, cutover, expected revision, digest,
business ADMIN actor, external operator, environment/build and evidence path/hash.
The accepted envelope supplies a validity window and authenticated certifications
of freeze, writer inventory, runtime compatibility and stale-runtime fencing.
Opening evidence/CUSTODY namespace resolvers must validate the actual baseline.

External envelope references must cover:

- freeze artifact and global scope (or affirmative tenant-isolation proof);
- inventory of every application, job, worker, script and direct SQL writer;
- deployed image/build/protocol and every instance's readiness;
- old credential privileges, terminated session identities, drained transactions
  and absence of capable prepared transactions;
- new credential distribution and verified database/environment identity;
- approved manifest/digest, current VERIFY evidence, operator and business actor;
- request correlation, immutable retention, validity interval and subsequent result.

A hash does not establish authenticity or prove infrastructure actions. Adapter
installation/certification and real operational artifacts remain external work.

## Ordered execution and ownership

| Step | Owner                                               | Required action / gate                                                                                                                                                                                             |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | APPLICATION AUTOMATED + OPERATIONAL                 | Rehearse on a new isolated PostgreSQL instance; verify test report and cleanup. Never reuse dev/QA/production/spike data.                                                                                          |
| 2    | OPERATIONAL / INFRASTRUCTURE                        | Build and retain one immutable binary supporting all three authority states and all four writers; record build identity.                                                                                           |
| 3    | OPERATIONAL / INFRASTRUCTURE                        | Prepare compatible instances with no traffic/jobs, approved metadata and new write credentials unavailable to old runtimes.                                                                                        |
| 4    | OPERATIONAL / MANUAL                                | Establish **GLOBAL APPLICATION WRITE FREEZE** unless tenant-isolation is positively proven. Include catalog, Product/Batch, Purchase, Quote, Sale and all source-changing work, not just four stock writers.       |
| 5    | OPERATIONAL / INFRASTRUCTURE                        | Remove old traffic, stop jobs/workers and disable automatic restarts/scaling into old binaries. Inventory and stop every alternate writer.                                                                         |
| 6    | OPERATIONAL / INFRASTRUCTURE                        | Disable/revoke old DB capabilities, terminate old sessions and drain active/idle-in-transaction/prepared transactions capable of legacy commit. Certify the result.                                                |
| 7    | APPLICATION AUTOMATED under operator control        | Create exact Company control and perform review using existing A/B services. Initial creation holds the exclusive fence and waits for compatible in-flight writers. No generic SQL status setter.                  |
| 8    | APPLICATION AUTOMATED under operator control        | Execute final dry-run/review/manifest lock, B OPENING and fresh VERIFY; certify every Product and Company. Any discrepancy blocks activation.                                                                      |
| 9    | OPERATIONAL certification + APPLICATION validation  | Authenticate retained envelope, complete writer inventory, actual deployed build/roles/readiness, stale-runtime fence and current freeze. Historical baselineBuild need not equal the new compatible runtimeBuild. |
| 10   | APPLICATION AUTOMATED, explicit operator invocation | Activate exact Company/cutover/revision/digest with authorized active ADMIN business actor and external operator. Exclusive fence → control lock → complete fresh validation → CAS VERIFIED to PHYSICAL_ACTIVE.    |
| 11   | OPERATIONAL / MANUAL, read-only                     | Keep traffic closed. Read control/attribution/checkpoints, owned and batch parity, readiness and runtime inventory. Do not create a synthetic business receipt/sale/count.                                         |
| 12   | OPERATIONAL / MANUAL                                | Record an explicit unfreeze decision only after every preceding gate succeeds. Retain result or reconstruct coherent activation readback after lost response.                                                      |
| 13   | OPERATIONAL with application evidence               | Verify the first legitimate Receipt/Manual/Sales operations and their exact Effects/Lines/Positions/projections/history.                                                                                           |

Old binaries do not know the advisory protocol. Application locks/readiness cannot
fence them or direct SQL. `NOLOGIN` or password rotation alone does not terminate
existing sessions. Revoking table grants is insufficient for superusers, owners or
inherited privileges. Use distinct runtime identities with no old alternate write
capability; never share the migration/operator credential with application instances.
An absent or unproven external fence is a hard stop for actual activation.

## Explicit internal CLI

After build, the internal entry point is
`app/api/dist/src/inventory/physical/inventory-cutover-activate.js`.
It has no public HTTP endpoint, `--all`, default Company or SQL shortcut.
All arguments below are mandatory; paths must identify retained external artifacts.
The DB connection remains explicit operator configuration; do not edit `.env` to
redirect an existing runtime. Never print credentials in a command or result.

```text
node dist/src/inventory/physical/inventory-cutover-activate.js
  --companyId <UUID>
  --cutoverId <UUID>
  --expectedRevision <VERIFIED revision>
  --manifestDigest <sha256>
  --manifestPath <absolute external manifest>
  --evidencePath <absolute external activation envelope>
  --evidenceHash <sha256>
  --expectedBuild <certified compatible build>
  --expectedEnvironment <certified environment>
  --businessActorId <active Company ADMIN UUID>
  --operatorId <external operator identity>
  --repositoryRoot <absolute repository root>
```

This is an argument inventory, not an authorization to execute. The implementation
task never runs this harness against a real Company. The service validates the
exact locked manifest/checkpoints/membership, current B evidence and complete
Product set; activation changes only control status, revision and attribution.
Different-actor retries cannot claim the original activation. A coherent retained
request can read back success after response loss without rewriting attribution or
requiring opening Position revision 1 after legitimate business operations.

## Manual backend use

Authenticated ADMIN/MANAGER/WAREHOUSE can read
`GET /inventory/physical-positions/:productId` only in PHYSICAL. Results contain
identity, Product/Batch identity, state, quantity, revision and eligibility. They are
observations, not reservations; send expected revisions and handle stale conflicts.
No partial opening Positions are exposed during CUTOVER.

`POST /inventory/physical-movements` requires `Idempotency-Key` (1–128 characters).
Company/actor come only from authentication. Bodies:

```json
{ "kind": "IN", "productId": "<UUID>", "batchId": null, "quantity": 1 }
```

```json
{
  "kind": "OUT",
  "sources": [{ "positionId": "<UUID>", "quantity": 1, "expectedRevision": 1 }]
}
```

```json
{
  "kind": "COUNT_CORRECTION",
  "positionId": "<UUID>",
  "countedQuantity": 0,
  "expectedRevision": 1,
  "reason": "Authorized physical count"
}
```

COUNT_CORRECTION is ADMIN/MANAGER only, including a zero-delta count. Sources are
explicit; the legacy Product-only endpoint remains LEGACY-only. No heuristic
ADJUSTMENT conversion, inferred source selection or frontend dependency is added.

Errors: CUTOVER_FROZEN, RECOVERY_REQUIRED, STALE_RUNTIME and INCOMPATIBLE_BUILD are
503; PHYSICAL_AUTHORITY_REQUIRED, LEGACY_AUTHORITY_REQUIRED and activation
precondition conflicts are 409. Existing invalid input/auth/missing entity semantics
remain 400/403/404. Database details are not part of the public contract.

## Business acceptance and recovery boundary

For first **legitimate** operations verify Receipt → one CREDIT; Manual → one
physical Effect and expected revisions; Sale/Quote → one SALE/CONFIRM/DEFINITIVE_OUT
with exact sources. Check actor, replay, Lines, owned/batch parity and one set of
compatibility Movements. No extra direct stock increment/decrement is permitted.
Any explicitly authorized write smoke crosses the business-effect boundary.

`InventoryCutoverActivationService.rollbackBoundary` compares the exact certified
checkpoint opening Effect IDs against the Company's Effects. It does not classify
by timestamp. Missing/unknown residue fails closed; COUNT_CORRECTION with zero delta
is a business Effect. With no business Effects, accepted current freeze and checked
before-images/baseline, it may return **ROLLBACK_EVALUATION_ELIGIBLE** only; the
response always says `rollbackAllowed:false`. This is not an executable rollback.

After any business Effect: **FREEZE → DIAGNOSE → FORWARD-FIX**. Use the fenced
RECOVERY_REQUIRED transition to reject business mutations. No automatic
PHYSICAL_ACTIVE→LEGACY, deletion of control/Effects, inverse migration, stock-only
repair or old-binary redeployment is provided. Actual pre-business reversal requires
a separately reviewed plan reconciling the durable control and every before-image.

## Isolated acceptance command

From `app/api`:

```text
node test/helpers/inventory-authority-cutover-postgres-runner.cjs --run-isolated
```

The runner creates and verifies a unique PostgreSQL 16 tmpfs container, loopback-only
port, empty `zaping_authority_test` database and dedicated non-superuser runtime role.
It applies existing schema migrations only there; no new migration is introduced.
An isolated admin connection is used solely for the old-role/session fencing test.
The runner removes only its label-verified container/tmpfs in `finally`. Independent
connections, explicit barriers and `pg_blocking_pids` prove concurrency; sleeps are
not the sole proof. Neither the runner nor these fixtures certify real operations.

## Inventario de archivos de implementación 01D-C

Rutas exactas relativas a `C:\dev\zaping`; cambios sin staging.

```text
app/api/src/health/health.controller.spec.ts
app/api/src/health/health.controller.ts
app/api/src/health/health.module.ts
app/api/src/health/health.service.ts
app/api/src/inventory/dto/create-physical-movement.dto.ts
app/api/src/inventory/inventory.controller.ts
app/api/src/inventory/inventory.module.ts
app/api/src/inventory/inventory.service.spec.ts
app/api/src/inventory/inventory.service.ts
app/api/src/inventory/physical/inventory-authority-error.ts
app/api/src/inventory/physical/inventory-authority-fence.ts
app/api/src/inventory/physical/inventory-authority-resolver.ts
app/api/src/inventory/physical/inventory-authority-transaction.service.ts
app/api/src/inventory/physical/inventory-authority.spec.ts
app/api/src/inventory/physical/inventory-cutover-activate.ts
app/api/src/inventory/physical/inventory-cutover-activation.contract.ts
app/api/src/inventory/physical/inventory-cutover-activation.service.ts
app/api/src/inventory/physical/inventory-cutover-verify.service.ts
app/api/src/inventory/physical/inventory-cutover.service.ts
app/api/src/inventory/physical/inventory-cutover.spec.ts
app/api/src/inventory/physical/inventory-opening.service.ts
app/api/src/inventory/physical/inventory-opening.spec.ts
app/api/src/inventory/physical/inventory-physical-authority.module.ts
app/api/src/inventory/physical/inventory-runtime-compatibility.service.ts
app/api/src/inventory/physical/inventory-writer-boundary.spec.ts
app/api/src/inventory/physical/physical-inventory.contract.spec.ts
app/api/src/inventory/physical/sales-physical-integration.service.ts
app/api/src/inventory/physical/sales-physical.spec.ts
app/api/src/purchases-receipts/purchases-receipts.module.ts
app/api/src/purchases-receipts/purchases-receipts.service.spec.ts
app/api/src/purchases-receipts/purchases-receipts.service.ts
app/api/src/sales/sales.controller.spec.ts
app/api/src/sales/sales.controller.ts
app/api/src/sales/sales.module.ts
app/api/src/sales/sales.service.spec.ts
app/api/src/sales/sales.service.ts
app/api/test/helpers/inventory-authority-cutover-postgres-runner.cjs
app/api/test/inventory-authority-cutover.postgres.e2e-spec.ts
app/api/test/inventory.concurrency.e2e-spec.ts
app/api/test/sales-physical.postgres.e2e-spec.ts
docs/modules/erp/INVENTORY_CUSTODY_01D_CUTOVER_RUNBOOK.md
docs/modules/erp/INVENTORY_CUSTODY_01D_TECHNICAL_DESIGN.md
docs/modules/erp/INVENTORY_CUSTODY_DEFINITION.md
docs/project/PROJECT_BOARD.md
```
