# UX-PDOC-01B3d5b3c1 — Isolated Ed25519-verifying gateway

**Status:** Draft laboratory prototype; stacked on B3d5b3b / PR #164.
No runtime worker registration, HTTP endpoint, Cloudflare R2 requests, production key store,
database grants, main merge or customer file access.

## Verified gateway contract

`IsolatedVerifiedScanEvidenceGateway` accepts an internally submitted signed envelope.
It **does not** trust caller-provided tenant, nonce or upload identity. Inside a PostgreSQL
transaction, it locks an existing `ISSUED`, nonexpired `SupplierAttachmentScanJob`,
rechecks that the registered reservation, pending attachment and active document
match the immutable Company, Document, key, SHA-256 and length, then calls the
B3d5b1 Ed25519 verifier against deployment-supplied pinned public keys, worker build
and scan policy. Scan times must be bounded by challenge issuance and expiry.

Only after successful cryptographic verification, it inserts:
(1) B3d5a append-only scan attempt,
(2) B3d5b3a signed evidence receipt,
(3) B3d5b3b atomic one-use challenge consumption,
(4) a separate `SupplierAttachmentVerifiedScanEvidence` audit marker.

All four operations execute within the **same PostgreSQL transaction**. An exception
rolls back everything; same nonce/claim replay is denied by locks and uniqueness.
The gateway returns `releaseAuthorized: false` without mutating the attachment.
The B3d5a SQL trigger rejecting PENDING_SCAN -> AVAILABLE/REJECTED remains intact.

## Why verified audit is separately stored

An earlier `CONSUMED` job can exist with a signature-shaped fake B3d5b3a receipt:
its accounting consumption **is not** authentication. The new audit marker distinguishes
a gateway-checked signature acceptance. The audit marker has a guarded Company/job/nonce/
receipt association, immutable insert-only behavior, and unique job/receipt/nonce IDs.

**Important:** PostgreSQL checks the marker's relational consistency, not Ed25519.
A migration owner/superuser or malicious user who can write directly to the new table
could manufacture a row; thus **even the new audit marker is NOT a production-grade
trust root** until deployment roles and access controls are independently verified.

## QA

Disposable PostgreSQL E2E uses only synthetic attachments and ephemeral in-memory
Ed25519 keys. Tests exercise successful atomic acceptance, pending status retention,
tampered hash or tenant/nonce rejection and no partial writes, concurrent duplicate
submissions, and a previously consumed challenge backed by a fake signature-shaped
receipt. The test requires CI and GitHub Actions with only `ci@localhost:5432/zaping_test`.
No real signer key, real R2 object or live signature database is used.

## Mandatory next gates before production

- **B3d5b3c2:** create and test distinct *non-owner* PostgreSQL API, issuer,
  scanner, verifier and promoter roles, with narrowly granted statements and
  `SECURITY INVOKER` or reviewed owner-isolated interfaces. Runtime API must not
  write attempts, receipts, verification audit or status changes. DB migration
  owner credentials must never be supplied to runtime.
- Separate authenticated internal scanner-to-gateway channel; pinned worker
  image/key provenance, signed policy, key rotation/revocation and emergency
  disable controls. Raw worker claims alone are insufficient.
- Run verification with real UTC wall-clock scanner signature freshness and
  trusted `freshclam` update provenance; lab preloaded signatures/synthetic clock
  do not demonstrate current-world malware protection.
- **B3d5c:** verify write-once quarantine source identity, copy and independently
  re-read the private R2 object, audit all failures/ambiguous outcomes and only
  then install a separately privileged, guarded `AVAILABLE` transition.

**Never** treat `CONSUMED`, `CLEAN_CANDIDATE` or verification audit alone as
authorization to deliver or download an attachment. All drafts remain unmerged.
