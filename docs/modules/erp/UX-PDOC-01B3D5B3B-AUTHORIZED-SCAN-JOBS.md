# UX-PDOC-01B3d5b3b — DB-issued scanner job challenges (isolated foundation)

**Status:** Draft, stacked on PR #163 (B3d5b3a). **No production migration**, runtime privileges, worker scheduling, Cloudflare R2 calls or attachment availability change.

## Actual trust boundary

The previous B3d5a `requestNonce` uniqueness prevented duplicates, but an arbitrary database insert could claim any **new** nonce. B3d5b3b adds `SupplierAttachmentScanJob` as a separate, server-issued challenge tied to exactly one registered upload reservation and attachment. PostgreSQL generates `jobId` and `requestNonce` using `gen_random_uuid()`; neither comes from HTTP/client parameters.

A job snapshot contains Company, Document, Attachment, Reservation, the original quarantine object key, byte count, lowercase SHA-256, issue timestamp, expiry and lifecycle status. Composite foreign keys and the guarded insert validate that all references belong to the same Company, have matching immutable bytes and are still `REGISTERED`/`PENDING_SCAN`, while the document is `ACTIVE`. No PDF/JPEG payload is stored in PostgreSQL by this migration.

## Issuer

`issue_supplier_attachment_scan_job(companyId, reservationId, ttlSeconds=120)` is a **SECURITY INVOKER** PostgreSQL function with no PUBLIC EXECUTE grant. It checks TTL between 60–300 seconds, locks the reservation row, validates the registered pending attachment, marks expired challenges `EXPIRED`, rejects an already-active challenge, and inserts a new DB-generated nonce. The unique partial index `SASJ_one_issued_attachment` additionally enforces only one `ISSUED` job per Company/Attachment. Another attempt after an actual terminal/expired job receives a new nonce, never the original nonce.

The partial unique index exists in the SQL migration even though Prisma 6 does not express partial indexes in its ordinary schema model; retain and review it in subsequent migrations.

## Consumption (accounting only — NOT scan approval)

`consume_supplier_attachment_scan_job(companyId, requestNonce)` atomically locks and checks a still-live issued job and transitions it to `CONSUMED` only when a matching immutable B3d5a attempt and B3d5b3a receipt exist for the same Company, Reservation, Attachment, original byte count/hash and nonce. Repeating consumption returns false, and terminal jobs cannot be changed back. Unknown/other-company/expired jobs cannot be consumed.

**CRITICAL:** a matching receipt is STILL UNTRUSTED. Neither the SQL function nor PostgreSQL verifies the Ed25519 signature or real ClamAV signature freshness. In the disposable CI, an explicitly synthetic fake signature-shaped receipt may be used to prove `CONSUMED` is **not** evidence authenticity. Never use `CONSUMED`, a nonce match, or a `CLEAN_CANDIDATE` row to authorize `AVAILABLE`/`REJECTED`, object promotion, customer download, or invoicing evidence.

The hard B3d5a denial of `PENDING_SCAN -> AVAILABLE/REJECTED` remains active and unchanged.

## Privileges and deployments

Both routines are `SECURITY INVOKER`, and `PUBLIC` is denied EXECUTE and table privileges. That does not restrict a migration owner/superuser. **No role has been granted** production permissions. Later deployment must create separate constrained non-owner identities for job issuer, signed-evidence verifier/gateway, scanner and promoter; prohibit direct INSERT/UPDATE to the job table. Scanner workers cannot choose a challenge or mark their job consumed without trusted gateway approval.

Do not invoke the issuer through a client-facing controller or HTTP route. Do not give the worker or API general SQL write authority. Reissuance of an expired challenge must remain serialized under reservation row locks.

## Isolated QA coverage

- Valid registration and immutable metadata are required; Company crossing, no reconciliation and malformed TTL are rejected.
- Duplicate concurrent issuance to one Company/Attachment yields a single active challenge.
- No matching receipt means no consumption, no cross-company consumption or replay; original job and metadata are immutable.
- Receipt-backed single consumption is terminal and permits only a *new* nonce. Even synthetic fake receipt data cannot release the attachment.
- Non-owner NOLOGIN CI role has no INSERT permission and cannot execute the issuer/consumer routines.
- Tests run only under `RUN_SUPPLIER_SCAN_JOBS_PG=1`, GitHub Actions + CI, the disposable `ci@localhost:5432/zaping_test` database. No `zaping_dev`, `zaping_qa`, real customer files or secrets.

## Remaining release gates

1. **B3d5b3c:** separate dedicated worker and issuer/gateway identities; independent trusted job lookup before signing/verification; Ed25519 signature validation with pinned worker public key, build and policy, real wall-clock signature freshness; atomic transaction binding verified receipt and challenge consumption. A job with a fake receipt must not be accepted as authenticated.
2. Add authenticated channel and least-privilege grants with distinct database roles and tests of actual denied API access, not just the absence of PUBLIC grants. Decide which roles can execute SQL functions and ensure no role can bypass validation with direct DML.
3. **B3d5c:** independent byte-for-byte Cloudflare R2 promotion verification, append-only audit, guarded status transition, reconciliation of ambiguous writes and signed private download URLs.

**Do not merge or deploy** any stacked PR until the complete security/release review. The present migration only enables laboratory proof of challenge issuance and single-use bookkeeping.
