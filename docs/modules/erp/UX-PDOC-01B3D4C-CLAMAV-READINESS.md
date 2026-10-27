# UX-PDOC-01B3d4c — ClamAV readiness policy (laboratory only)

**Status:** isolated, fail-closed preflight prototype. This is NOT scan attestation, an active worker, or approval to publish files.

## Scope

- `ClamAvReadinessProbe` sends `zPING\0` and `zVERSION\0` through separate local Unix-domain socket connections.
- Responses must be NUL-terminated, capped at 512 bytes and received within a bounded timeout. Errors, disconnects, malformed replies and unmatched versions fail closed.
- A versioned policy explicitly allows engine patch versions and bounds signature database build age (initial lab candidate 48 h) and future clock skew (initial lab candidate 5 min). The policy requires `daemonTimeZone: 'UTC'` as an **unverified operational assumption** because the daemon's `ctime`-formatted VERSION reply contains no time-zone suffix.
- `evaluateClamAvVersion` enforces a strict, documented VERSION response triplet; timestamp parsing checks calendar validity and weekday rather than silently rolling invalid dates. The result is explicitly `attested: false`.
- The VERSION response and database build timestamp alone do **not** prove the signature provenance, authenticity, real-time update success, worker identity or immutable scan evidence.

## Explicit non-goals / remaining gates

1. Do not register readiness in an HTTP module, scanner authorization, document state machine or background service yet.
2. Do not add R2 credentials, DB privileges, schema migrations, upload/download paths, or object promotion.
3. Verify VERSION format and behavior against real ClamAV versions and signature databases used for deployment. The B3d4c branch-only CI lab launches clamd with `TZ=UTC`, checks `PING`/`VERSION` via Unix socket and runs an opt-in Jest E2E. It evaluates the observed database timestamp with an explicitly **synthetic** evaluation clock (reported build time + 1 hour): this proves parsing/wire-format compatibility, **not** that the signatures are current today. Version allowlist for production must be sourced from reviewed deployment configuration, never a user request. CI dynamically selects the observed engine version for this format-only test; it does not approve that version for deployment.
4. Add controlled, automatically refreshed signatures and independently observed wall-clock freshness/provenance; enforce a verified UTC scanner runtime, synchronize system clocks, pin the container digest; monitor freshclam failures and daemon outages. Current preloaded offline CI image is intentionally not a signature freshness authority.
5. Implement worker identity, immutable scan evidence, anti-replay protections, pre/post scan readiness and byte-bound SHA-256 verification. Even successful preflight is NOT a clean verdict.
6. Verify fail-closed outages and stale signatures on a disposable real daemon in a separate CI lab (opt-in, never on production databases). Only later: dedicated worker privileges, PostgreSQL attestation, quarantined-object promotion to private R2, and end-to-end QA.

## Security / operations

This new probe is unused until separately reviewed and wired by a later task. All existing scanner gates and `SupplierDocumentsModule` remain fail-closed. The initial 48 h/5 min thresholds are **lab examples**, not approved release parameters. Clock synchronization and algorithmic version controls require deployment approval. No file may become AVAILABLE because this probe succeeded.

References: https://docs.clamav.net/manual/Usage/ClamdProtocol.html ; https://docs.clamav.net/manual/Usage/Scanning.html
