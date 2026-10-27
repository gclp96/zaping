# UX-PDOC-01B3d5b1 — Ed25519 scan evidence contract

**Status:** isolated cryptographic primitive and negative unit tests. **NOT** a trusted production scanner, database attestation, or file release gate. Stacked on B3d5a / PR #160.

## Scope delivered

- Deterministic, fixed-position, versioned scan-evidence payload with explicit domain separation `zaping:supplier-attachment-scan:v1`.
- Ed25519 detached signature over all claims **and key ID**. The signing key is supplied to an isolated function; no keys are generated, stored or configured in the application runtime by this change.
- Verification uses an independently configured, pinned public-key registry mapping key ID to worker identity and worker build SHA-256 digest. Caller-provided key material is never trusted.
- The verifier requires exactly matching Company, Document, Attachment, Reservation, job nonce, reported source SHA-256 and byte length, as supplied by a **trusted independent job/DB lookup**.
- Strict canonical schema: no extra fields, lowercase UUIDs and hashes, server-derived quarantine key, size cap 10 MiB, bounded scan duration, canonical UTC timestamps, known result/failure codes and signature-encoding checks.
- Clean candidate/malware findings require `bytesVerified=true`, an allowed ClamAV engine version, DB revision, database build timestamp, two readiness observation timestamps bracketing the scan and freshness checks. Failed scans remain `SCAN_FAILED` and can never be treated as clean.
- Stale messages, future clock skew, altered fields/signatures, key rotation mismatches, unknown worker builds, tenant crossings, unexpected policies, and mismatched nonces are rejected fail-closed with sanitized errors.
- Unit tests use **ephemeral in-process Ed25519 key pairs** and entirely synthetic identities/bytes. No secrets or customer objects.

## Important distinction: crypto authenticity != malware clearance

A valid Ed25519 signature proves that the matching private key signed those claims; it does **not** prove the worker really scanned the bytes or that ClamAV's signature database was genuinely current. B3d5b1 has **no worker orchestration** and its functions are not registered with NestJS/Prisma, HTTP routes, scheduled jobs, or Cloudflare R2.

The signer is a low-level isolated primitive. In B3d5b2, only a dedicated worker should call it *after* a trusted job nonce is issued, quarantine bytes are read and verified independently against DB identity, actual `INSTREAM` scan finishes, and B3d4c readiness is confirmed both before and after. Conflicting pre/post scanner versions or signature revisions must fail closed.

The verifier binds to the **expected** nonce but does not consume it. Replay protection requires a DB-enforced one-time operation (the B3d5a `companyId + requestNonce` unique index) inside an audited transaction and real worker-role separation. Re-running this pure function with the same evidence is intentionally idempotent and does not itself provide replay prevention.

## Security policy for future deployment

1. Private signing key must never be present in Next.js, API JWT process, DB connection, developer workstation configs committed to GitHub or public CI logs. Choose restricted worker secret storage / managed key operations and document rotation and revocation.
2. Verify pinned public keys from a deployment-controlled registry, not requests, uploads or worker-supplied metadata. Explicitly allowlist worker image digests, ClamAV engine versions, and scan policy versions.
3. Use a server-issued nonce bound to the immutable upload reservation; confirm Company and document identity by independent DB lookup, not just by trusting signed input.
4. Authenticate signature and exact expected scope before writing any durable scan evidence. B3d5a ledger does not store signature/key ID yet and is still **untrusted**.
5. Introduce separate non-owner DB identities. API cannot insert trusted evidence; scanner cannot mark `AVAILABLE`; promoter cannot sign clean evidence.
6. Persist immutable signed claims, signer key ID, signature, audit time, replay-consumption state and key-revocation policy. Define key decommissioning and historic verification explicitly.
7. Require an independent private R2 byte-for-byte re-read and an audited privileged transition (B3d5c) before `AVAILABLE`. No bypass by populating legacy `scanEngine`/`scannedAt`.

## Next subdivisions

- **B3d5b2:** assemble claims *only* from real isolated worker readiness and verified quarantine byte scan; EICAR and outage laboratory E2E, no production connector.
- **B3d5b3:** PostgreSQL signed evidence persistence / privileges, mandatory verified-signature gateway and replay tests with distinct CI roles.
- **B3d5c:** byte-verified promotion, authoritative status state machine, audit, reconciliation.

B3d5b1 cannot authorize release, rejection, download, and does not modify the schema or data in any environment.
