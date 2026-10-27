# UX-PDOC-01B3d5b2 — Isolated scan evidence worker (laboratory)

**Status:** Draft stacked on B3d5b1 / PR #161. No runtime registration, DB writes, signing-key deployment, R2 credentials, uploads or attachment state transitions.

## Included

- `IsolatedScannerEvidenceWorker` runs an explicitly injected ClamAV readiness probe before the byte-verified scan and again after. It uses a restricted `VerifiedQuarantineScanner` contract matching `CloudflareR2QuarantineMalwareScan.scan(companyId, key, sizeBytes, sha256)`. The existing adapter verifies the entire quarantine object by size and SHA-256 before passing its bytes to ClamAV, then scrubs its in-memory buffer. The new worker does not independently read R2, nor instantiate any production provider.
- The quarantine object key is derived from the trusted `ExpectedScanIdentity`, never supplied as an independent HTTP input. The job identity/nonce MUST eventually be read from a trusted, Company-scoped DB job record, not an arbitrary caller.
- **No signed result** is returned unless both health probes pass and report identical engine version, database version, database build timestamp and policy version, with sane timestamps encompassing the scan. Unknown scanner replies, object integrity errors, readiness failures and post-scan outages fail closed with sanitized exceptions.
- A `CLAMD_OK_UNATTESTED` reply becomes `CLEAN_CANDIDATE`, and `MALWARE_DETECTED` becomes the separately signed malware verdict. Neither can authorize `AVAILABLE` or `REJECTED`.
- The low-level B3d5b1 Ed25519 signer binds identity, exact expected SHA-256/length, policy and pre/post ClamAV state to one signed envelope. The worker does not persist signatures or consume the nonce.
- Unit tests cover valid clean and infected claims, early daemon failure, quarantine mismatch, changed signature revisions, policy mismatch and post-scan failure.

## Real daemon laboratory (opt-in)

The **internal-PR-only** GitHub Actions lab uses a disposable `clamav/clamav-debian:stable` container with `--network none`, no R2 access, an ephemeral Unix socket and synthetic clean PDF/EICAR input. It calls actual `zPING`, `zVERSION` and `zINSTREAM` through the TypeScript adapters, signs claims using a throwaway in-memory Ed25519 keypair, then verifies the signature with a matching temporary public key. No signing keys are stored in GitHub.

The container has **preloaded offline signatures**. The test uses a **synthetic clock** near the reported signature build date solely to confirm the transport, pre/post equality and signature-envelope format; it does **not** demonstrate real-time signature freshness, production signing-key provenance, R2 object immutability, worker isolation or malware-clean authorization.

## Remaining mandatory gates

1. **Source authenticity:** deployment-pinned worker image digest, trusted provisioning of signing key, rotation/revocation, and signed scan policy; independently verifiable signature database update provenance and actual UTC wall clock.
2. **Real job ownership:** DB-issued nonce and server-derived Company/Document/Reservation identity with replay-safe job locking. The current `ExpectedScanIdentity` is a pure input contract, not a DB lookup.
3. **Cryptographic persistence:** signed canonical claims, key ID, signature, audit and metadata bound atomically to `SupplierAttachmentScanAttempt`, with distinct restricted PostgreSQL roles and integrity tests.
4. **Object isolation:** investigate R2 write-once/version binding to prevent replacement between verified scan and promotion. Never substitute ETag for SHA-256.
5. **Safe promotion:** independent re-read and full size/hash validation of the destination private object plus privileged audited state transition, rollback and ambiguous-write recovery (B3d5c).
6. **Failure evidence:** errors currently return an exception and cannot create a clean signed result; future worker must persist sanitized `SCAN_FAILED` records without allowing rollback of security gates or unsafe log disclosure.

Keep the original B3d5a `PENDING_SCAN` denial trigger active. These files must not be imported into any HTTP controller or active NestJS provider until the security and release gates are approved.
