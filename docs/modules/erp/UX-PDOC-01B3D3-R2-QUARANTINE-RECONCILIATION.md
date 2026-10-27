# UX-PDOC-01B3d3 — Reconciling R2 quarantine and PostgreSQL

**Status:** internal-only implementation; no HTTP route, no configured R2 service account, no scanner, no production release. Stacked on B3d2.

## Invariant and failure scenario

Cloudflare R2 and PostgreSQL do not participate in one atomic transaction. An upload may have reached R2 even if the HTTP client or worker lost the response. An error MUST NOT automatically delete the object, expire the request, mark it safe or release its reserved quota.

B3d3 introduces an internal `QuarantineObjectVerifier` and `CloudflareR2QuarantineVerifier` using S3 `GetObject`. It reads the **quarantine** bucket with a separate bucket-scoped credential and verifies the **entire** byte stream (limit and SHA-256) before allowing a DB transition. ETag is not used as a SHA-256 substitute. Provider errors, missing or mismatched bytes, timeouts and malformed streams are sanitized.

`SupplierAttachmentUploadReconciliationService.reconcile({companyId, documentId, reservationId})`:

1. Fetches a reservation strictly under its Company and SupplierDocument; confirms server-derived quarantine path and allowed RESERVED/RECONCILE_REQUIRED state.
2. Verifies the R2 object **outside** a database transaction.
3. If not verifiable, acquires the same **SupplierDocument row lock** used in B3d2, changes RESERVED → RECONCILE_REQUIRED with append-only event NEEDS_REVIEW. The reservation **continues to count against quota**. Repeat uncertainty is idempotent; if another worker already registered it, the result is REGISTERED.
4. If verified, takes the same lock and transactionally creates `SupplierDocumentAttachment` in `PENDING_SCAN`, changes reservation to REGISTERED and appends event QUARANTINE_VERIFIED. Concurrency/replay produce one attachment and one event.
5. The attachment uses the deterministic **future private object key** derived from the reservation's quarantine key. Only the quarantine bucket contains bytes today. No user download is possible because list/download require AVAILABLE and active runtime store remains fail-closed.
6. A new PostgreSQL trigger enforces immutable Company/Document/actor/size/hash/key after creation and requires exactly matching PENDING_SCAN attachment to transition to REGISTERED. It does not allow RELEASED_VERIFIED_EMPTY. Event rows cannot be changed or deleted.

## Why no release yet?

`RELEASED_VERIFIED_EMPTY` remains a reserved status with no permitted transition in B3d3. Proving object absence safely involves consistency semantics, exclusive writer ownership, token permissions, timeout ambiguity, scheduled retry policy, access isolation and audit. Do not infer absence from one failed read. Finish a separate B3d4 runbook/implementation before releasing any held quota.

## Credential separation

- QA `zaping-r2-qa-readonly` allows only **private bucket GET** and is **never** used for quarantine.
- A future isolated worker will have a separate restricted credential for `zaping-quarantine-qa` (Cloudflare Dashboard preset Object Read & Write) and another separate least-privileged private promotion credential. Do not configure in PR CI.
- No public/custom bucket domain. No signed public URL, no key returned to HTTP clients.
- The file pipeline is **NOT operational**: backend provider still returns HTTP 503; scanner, safe promotion and audit attestation have not been implemented.
- Runtime package reports vulnerabilities via npm audit from dependency tree; review before any release.

## Test contract

The new PG E2E only runs in GitHub Actions CI against disposable `127.0.0.1:5432/zaping_test` user `ci`, requiring explicit `RUN_SUPPLIER_UPLOAD_RECONCILIATION_PG=1`. Scenarios: verified success never AVAILABLE; uncertainty retains quota and can later recover; replay and two workers serialize; cross-Company denial before remote access; SQL rejects fabricated REGISTERED/RELEASED and tampered metadata; immutable audit. SDK unit tests simulate S3, no network/secrets. No actual R2 PUT is executed.

## Future B3d4/activation gates

- Confirm scanner architecture with isolated malware scanning, versioned scan evidence and promotion/cleanup. A hash match only proves integrity, **not cleanliness**.
- Review scanner transition trigger: current legacy attachment status transition is allowed by presence of scanEngine+date; require trustworthy worker attestation and separation of DB privileges before actual uploads are enabled.
- Implement/upload coordinator with strict streaming multipart limits, permissions and business metrics, leveraging B3d1 writer and B3d2 reservation; no user-provided object keys.
- QA real object write using a dedicated temporary quarantine credential with explicit manual approval, and tests for ambiguous timeout/retries; never use read-only private credentials for PUT.
- Integration sequence and migration review of stacked PRs; no merge to main or operative DB migration until release gates are satisfied.

