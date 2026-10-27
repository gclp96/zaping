# UX-PDOC-01B3d5b3a — Immutable signed evidence receipt (NOT attestation)

**Status:** Draft, stacked on B3d5b2 (#162). This is *only* a safe database foundation. No runtime or R2 activation, grants, API endpoints or promotion.

## What was implemented

- A new `SupplierAttachmentSignedEvidenceReceipt` stores submitted signing-key ID, Ed25519 signature encoding and the full signed JSON claims. It is **not** named "Verified", because PostgreSQL in this migration does not validate Ed25519, nor does it authenticate who submitted the row.
- A composite foreign key `(attemptId, companyId, requestNonce)` binds a receipt to exactly one existing `SupplierAttachmentScanAttempt`; UNIQUE constraints prevent duplicate receipts per attempt and tenant/nonce.
- A PostgreSQL BEFORE trigger requires the signed claims' protocol, Company, Document, Attachment/Reservation, nonce, quarantine key, size, SHA-256, verdict, scanner policy, engine version, database revision, reported worker identity, and failure code to agree with the immutable B3d5a ledger and registered reservation. UPDATE and DELETE fail; PostgreSQL supplies the actual `recordedAt`.
- The received signature must have the expected **base64url shape**, but a syntactically valid signature is **not cryptographic proof**. In fact, disposable CI intentionally inserts a signature-shaped synthetic value to demonstrate that a raw receipt carries *zero* approval authority.
- No new SQL procedure transitions `PENDING_SCAN` to `AVAILABLE` or `REJECTED`; the existing B3d5a denial trigger remains unchanged.
- The new table has no PUBLIC grants. **This does not restrict the table owner or superuser**, and does not by itself secure a real API deployment. CI creates two temporary non-owner NOLOGIN roles and verifies neither has INSERT/UPDATE grants to the new receipt table.

## CI and security tests

The existing opt-in B3d5a PostgreSQL suite now exercises the new receipt: cross-tenant attempt mapping, nonce mismatch, false SHA-256, wrong quarantine key, invalid signature length, double insert/replay, append-only UPDATE/DELETE and attempted attachment approval. All test data and database roles are synthetic and disposable, and the integration test is guarded to GitHub Actions local `zaping_test` / `ci`.

## Explicitly NOT provided

1. **No server-issued/committed job challenge yet.** B3d5a nonce uniqueness prevents duplicated strings but not unauthorized creation of a fresh nonce. Do not treat it as authenticated job authorization.
2. **No verified signature persistence gateway yet.** Only a future privileged service can independently look up issued job identity, check pinned worker keys and current policy, verify Ed25519 over the canonical claims, and atomically consume that issued nonce when inserting both ledger and receipt.
3. **No production DB role deployment.** SQL grants/revokes and production credentials require separate owner/service role design; never use the schema-migration owner as the API DB identity.
4. No valid live signature freshness proof: the existing ClamAV CI uses preloaded offline definitions and a synthetic clock.
5. No Cloudflare R2 uploads, promotion, private-object verification, downloads, scheduled scanner or user-facing functionality.
6. No interpretation of a receipt's presence, or of its `CLEAN_CANDIDATE` verdict, as permission to release a file.

## Next deliverables, in order

- **B3d5b3b — Trusted job issuance:** issued Company/Reservation-bound nonce with independently derived metadata, TTL, single-consume atomic lock and dedicated producer role. Tests for forged, stale, cross-company and duplicated challenges.
- **B3d5b3c — Signature-verifying gateway:** only accepted from authenticated scanner channel, pinned public key/policy/worker build, verify actual signature and claims against DB-issued job in one transaction; persist immutable evidence atomically with nonce consumption. Non-owner database roles tested, no credential in repo.
- **B3d5c — private R2 promotion and audited state transition**, independently verifying source/destination exact bytes and a durable verified attestation under a privileged promoter.

**Release gate:** all PRs remain Draft until security review and end-to-end QA; do not merge into main or apply these migrations to operational environments.
