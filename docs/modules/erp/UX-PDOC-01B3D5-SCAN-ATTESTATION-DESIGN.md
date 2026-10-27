# UX-PDOC-01B3d5 — Durable scan evidence and controlled promotion (design only)

**Status:** proposal for review. No database migration, worker registration, R2 write or production activation in this PR.

**Dependencies:** B3d3 quarantine reconciliation (PR #153), B3d4a safe scan boundary (PR #154), B3d4b live ClamAV (PR #156), B3d4c readiness policy (PR #158). All remain stacked drafts until individually reviewed.

## Source-of-truth inventory (observed in the current Prisma schema)

- `SupplierAttachmentUploadReservation` carries `companyId`, `documentId`, `quarantineKey`, `sizeBytes`, `sha256` and reservation status, with a Company-scoped idempotency key.
- `SupplierDocumentAttachment` carries `companyId`, `documentId`, its **future private** `storageKey`, `sha256`, `sizeBytes`, and `PENDING_SCAN | AVAILABLE | REJECTED | REMOVED` status.
- `SupplierAttachmentReconcileEvent` is append-only and records the quarantine-verification transition.
- B3d3 warns that a legacy attachment transition can be satisfied by `scanEngine` plus `scannedAt`. Those columns must **not** be treated as a trustworthy authorization to reach `AVAILABLE`.

## Core invariants

1. Company-scoped attachment, upload reservation, source key, verified bytes and scanner evidence all refer to **one immutable upload identity** and exactly matching `sha256` and `sizeBytes`.
2. A protocol reply (`CLAMD_OK_UNATTESTED`) and successful B3d4c readiness probe are **not** a clean-file attestation. A verdict and readiness snapshot must be bound to the same attempt under an authenticated isolated worker.
3. Every attempt, whether clean, infected, error, timeout or indeterminate, has its own **append-only** durable evidence. Errors never become clean or AVAILABLE.
4. An attested clean result still does **not** imply AVAILABLE. Availability requires independent, byte-for-byte verification of the private R2 object after controlled promotion.
5. No HTTP application role, ordinary business user or upload writer is allowed to insert a trusted scan attestation, change a scan verdict, mutate immutable evidence, or transition a pending attachment directly to AVAILABLE.
6. Quarantine objects are not accessible through public or customer URLs. No production or customer data is used in laboratory tests.

## Proposed data model (not yet migrated)

Introduce a durable `SupplierAttachmentScanAttempt` (exact name pending migration review), appended once per terminal attempt:

| Field / concept | Constraint |
|---|---|
| `id`, `attemptId` / `jobNonce` | Server generated unique UUID; unique replay key; repeated delivery cannot fabricate additional approval |
| `companyId`, `documentId`, `attachmentId`, `reservationId` | Required, composite foreign keys enforce same Company/Document, never cross-tenant |
| `quarantineKey`, `expectedPrivateKey` | Derived internally from recorded reservation; compare to attachment, never accepted from HTTP input |
| `verifiedSizeBytes`, `verifiedSha256` | Exact bytes read from R2 quarantine during this attempt; must equal immutable upload metadata |
| `scanVerdict` | `CLEAN_CANDIDATE`, `MALWARE_DETECTED`, `SCAN_FAILED` only. Clean candidate does not grant availability |
| `engineName`, `engineVersion`, `databaseVersion`, `databaseBuiltAt` | Observed during actual daemon operation; freshness and provenance need a separately approved policy |
| `policyVersion`, `workerIdentity`, `workerBuildDigest` | Versioned, authenticated, verified against configured allowlists |
| `startedAt`, `completedAt`, `recordedAt` | Bounded duration, non-future timestamps, server-recorded time authoritative for audit |
| `evidenceDigest`, `evidenceSignature` / `signingKeyId` | Canonically serialized claims, independently verifiable; signer private key never accessible to HTTP role |
| `failureCode` | Controlled sanitized machine code, no file content, provider key, signature name or sensitive internal error text |
| source object generation/version if supported | Prefer immutable source version; never accept an unverified ETag as SHA-256 |

**Persistence decision for implementation:** append-only PostgreSQL trigger rejects UPDATE/DELETE even from the general runtime role; a dedicated scanner-insert path must validate tenant relations, uniqueness, policy and signing claims. Do not assume an ordinary application-level `CHECK` or DTO is enough. An append-only table alone does not prevent a forged initial INSERT: worker identity/key verification and constrained DB role are mandatory.

**Option under review:** cryptographically sign canonical evidence (e.g., Ed25519) using a scanner-only key isolated from API/DB write access; verify signatures in a privileged promotion component before any state transition. Key rotation, revocation, replay nonce and audit provenance must be specified before adoption. Never infer trust merely because a row exists.

## State transitions and gates

| Current state | Event | Expected state |
|---|---|---|
| PENDING_SCAN | Scanner error, unavailable signatures, stale version, hash mismatch, timeout | PENDING_SCAN; append failed attempt; keep quarantined and blocked |
| PENDING_SCAN | Attested MALWARE_DETECTED with matching identity | REJECTED only through privileged transition + append-only audit; never promote |
| PENDING_SCAN | Attested CLEAN_CANDIDATE | PENDING_SCAN; eligible for promotion workflow, **not** AVAILABLE |
| PENDING_SCAN | Privileged promotion + re-read private object verifies same SHA-256 and length + attestation is still valid for immutable source | AVAILABLE via one guarded DB transaction, audit appended |
| AVAILABLE/REJECTED/REMOVED | Replay of old scan or promotion | No new authorization or state change |

Failure after R2 write but before DB commit must remain non-AVAILABLE and enter a reconciliation path. Retries cannot overwrite conflicting target bytes or bypass audit. R2 cannot participate in the PostgreSQL transaction.

## Promotion anti-TOCTOU contract

- **Do not** trust a quarantine key alone after the scan. An object could be replaced between scan and copy if writer credentials allow it. Require unique write-once keys with enforced writer restrictions/version binding; **otherwise** perform a fresh trusted read and exact-byte verification before private PUT.
- The promoting identity has only the minimum required read-quarantine / write-private permissions. An independent verification stage checks private bytes and metadata before DB availability.
- The private target name is server-derived, Company-scoped and single-assignment. An ambiguous `PUT`/copy outcome must be reconciled, never blindly retried as a new business event.
- When a retried private object already exists, verify exact size/hash before deciding idempotency; conflicting bytes are a security incident, not success.
- Scope encrypted transport, object retention, sensitive download headers, cleanup and orphan reconciliation to later review; never authorize public object URLs.

## Roles and privilege boundaries

- **API role:** create/inspect pending metadata and submit an internal job, but no scan attestation INSERT or direct AVAILABLE/REJECTED status transition.
- **Scanner role:** read only the assigned quarantined bytes, run local ClamAV, append verified scan attempts via a narrowly scoped interface. No private-bucket access and no general write permissions over supplier documents.
- **Promoter role:** verify latest valid clean evidence and object identity, write and verify private storage, invoke one narrowly permissioned guarded status transition; no ability to forge scanner evidence.
- **DB migration owner:** may install constraints, immutable triggers and role grants under reviewed deployment; runtime credentials must not inherit this power.

## Planned implementation split

- **B3d5a — migration design / DB enforcement:** schema, composite foreign keys, indexes, append-only triggers, restricted role tests, anti-forgery/anti-replay tests on disposable PostgreSQL.
- **B3d5b — worker evidence:** authenticated scanner identity, nonce, signed versioned claims, pre/post readiness, same-bytes digest and signature validation, isolated EICAR + outage E2E.
- **B3d5c — safe promotion:** separate worker credentials, verify quarantine/private bytes, ambiguous-commit reconciliation, guarded AVAILABLE transition and full audit.

No substage can be released alone.

## Definition of Ready for coding

1. Approve the source object immutability / conditional write strategy in Cloudflare R2.
2. Approve how PostgreSQL trusts worker identity and validates evidence (signature vs narrow DB role, preferably both).
3. Confirm all existing B3d3 SQL triggers and legacy AVAILABLE transitions are tightened before activation.
4. Review engine/signature freshness and time-zone policy against **real** daemon results.
5. Confirm isolated CI paths, privilege separation, fail-closed tests and rollback plan.

## Definition of Done (B3d5 overall)

Dedicated least-privilege roles tested, append-only audit enforced in PostgreSQL, replay and tenant escape tests pass, real ClamAV/EICAR and stale/error tests pass, R2 integrity and promotion tests pass with disposable credentials, no unscanned file becomes AVAILABLE, security review and release checklist approved. Until then, attachments remain unavailable to users.
