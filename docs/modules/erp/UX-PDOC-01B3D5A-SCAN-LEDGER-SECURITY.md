# UX-PDOC-01B3d5a — PostgreSQL fail-closed scan ledger (untrusted foundation)

**Status:** Draft, stacked on #159. NOT approved for production migration or file activation.

## Background

The original `guard_supplier_document_attachment_mutation` trigger from B3d1 allowed an attachment in `PENDING_SCAN` to become `AVAILABLE` or `REJECTED` when `scanEngine` and `scannedAt` were supplied. Those fields are not proof of a trusted ClamAV scan or verified R2 promotion. B3d5a adds a **second enforced SQL guard** to reject every departure from `PENDING_SCAN` until B3d5b/c install a separately reviewed and authenticated transition.

## Implemented

1. `SupplierAttachmentScanAttempt` records *untrusted observations* only. `CLEAN_CANDIDATE`, `MALWARE_DETECTED` and `SCAN_FAILED` carry no authorization and cannot change attachment status.
2. Each insert references a company-scoped `SupplierDocumentAttachment` and `SupplierAttachmentUploadReservation` through composite foreign keys; the trigger requires the same `attachmentId=reservationId`, registered reservation, pending attachment, actor, document, name, MIME, original immutable size/hash and private-key derivation.
3. Duplicate `(companyId, requestNonce)` is rejected, and UPDATE/DELETE of attempts is rejected. The database supplies `createdAt`, ignoring caller-provided timestamps.
4. Invalid sizes, hashes, missing failure reason for `SCAN_FAILED` and unexpected failure reasons for non-failed attempts are rejected.
5. Original metadata and quarantine registration remain protected by existing B3d3 checks.
6. Existing disposable PostgreSQL test that previously simulated fake clean approval now expects that approval to fail. A new opt-in E2E exercises cross-tenant denial, hash/size mismatch, nonce replay, append-only behavior and failure paths.

## Security boundaries

- Evidence stored by B3d5a **is not a signed attestation**. The fields `workerIdentity`, `engineVersion`, `databaseVersion` and `policyVersion` are claims, and can be fabricated by anyone with direct INSERT privileges.
- `REVOKE ... FROM PUBLIC` does **not** restrict a table owner or PostgreSQL superuser. The current CI `ci` role owns its disposable tables and is used strictly for migration/QA. Before production, introduce a dedicated DB migration owner, non-owner API role without scan INSERT/grant authority, tightly constrained scanner identity, signature verification and separate promotion role. Demonstrate privilege separation with disposable PostgreSQL accounts.
- No database row currently authorizes an attachment to become `AVAILABLE` or `REJECTED`, including a row with `CLEAN_CANDIDATE`.
- A future migration must not simply drop the new denial trigger and restore the legacy status shortcut; its replacement must verify authenticated scanner evidence **and** byte-verified R2 private promotion inside a privileged transaction with immutable audit.
- No daemon, worker, R2 bucket access, upload route or user download is enabled by this migration. All operative databases remain untouched.

## Testing and rollout

- Run schema validation, Prisma client generation, full API and Web CI on the stacked branch.
- Run `RUN_SUPPLIER_SCAN_LEDGER_PG=1` E2E **only** with `GITHUB_ACTIONS=true`, `CI=true` and disposable `127.0.0.1:5432/zaping_test` / `ci`, using the dedicated GitHub Actions step.
- Confirm older B3d1/B3d2/B3d3 suites remain compatible with deny-by-default behavior.
- Require manual migration review, privileged-role integration tests, rollback plan and security review before applying to a real environment.

## Remaining stages

**B3d5b:** authenticated scanner-only identity, signed canonical result bound to verified bytes + versioned policy, trustworthy signature freshness, anti-replay and failure/health E2E.

**B3d5c:** independent private R2 promotion, re-read exact hash/length, guarded status transition with DB privilege separation, append-only audit, ambiguous-write reconciliation, safe downloads.

Neither B3d5b nor B3d5c can be deployed independently without all required security gates.
