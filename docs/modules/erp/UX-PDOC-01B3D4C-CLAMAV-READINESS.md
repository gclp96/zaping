# UX-PDOC-01B3d4c — ClamAV readiness policy (laboratory only)

**Status:** isolated, fail-closed preflight prototype. This is NOT scan attestation, an active worker, or approval to publish files.

## Scope

- `ClamAvReadinessProbe` sends `zPING\0` and `zVERSION\0` through separate local Unix-domain socket connections.
- Responses must be NUL-terminated, capped at 512 bytes and received within a bounded timeout. Errors, disconnects, malformed replies and unmatched versions fail closed.
- A versioned policy explicitly allows engine patch versions and bounds signature database build age (initial lab candidate 48 h) and future clock skew (initial lab candidate 5 min).
- `evaluateClamAvVersion` enforces a strict, documented VERSION response triplet; timestamp parsing checks calendar validity and weekday rather than silently rolling invalid dates. The result is explicitly `attested: false`.
- The VERSION response and database build timestamp alone do **not** prove the signature provenance, authenticity, real-time update success, worker identity or immutable scan evidence.

## Explicit non-goals / remaining gates

1. Do not register readiness in an HTTP module, scanner authorization, document state machine or background service yet.
2. Do not add R2 credentials, DB privileges, schema migrations, upload/download paths, or object promotion.
3. Verify VERSION format and behavior against real ClamAV versions and signature databases used for deployment. Version allowlist must be sourced from reviewed deployment configuration, never a user request.
4. Add controlled, automatically refreshed signatures and independently observed freshness/provenance; pin the container digest; monitor freshclam failures and daemon outages.
5. Implement worker identity, immutable scan evidence, anti-replay protections, pre/post scan readiness and byte-bound SHA-256 verification. Even successful preflight is NOT a clean verdict.
6. Verify fail-closed outages and stale signatures on a disposable real daemon in a separate CI lab (opt-in, never on production databases). Only later: dedicated worker privileges, PostgreSQL attestation, quarantined-object promotion to private R2, and end-to-end QA.

## Security / operations

This new probe is unused until separately reviewed and wired by a later task. All existing scanner gates and `SupplierDocumentsModule` remain fail-closed. The initial 48 h/5 min thresholds are **lab examples**, not approved release parameters. Clock synchronization and algorithmic version controls require deployment approval. No file may become AVAILABLE because this probe succeeded.

References: https://docs.clamav.net/manual/Usage/ClamdProtocol.html ; https://docs.clamav.net/manual/Usage/Scanning.html
