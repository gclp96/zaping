# UX-PDOC-01B3d4c — ClamAV engine and definitions readiness gate

**Status:** source-only control and tests. Draft PR stacked on #156; no worker configured, no R2/Prisma, no upload/download endpoint, no Clean attestation.

## Evidence inherited from B3d4b

Real isolated ClamAV scan succeeded in GitHub Actions lab run [40438904182](https://github.com/gclp96/zaping/actions/runs/40438904182), job `ClamAV real lab (isolated, no R2)`: EICAR detected, synthetic clean PDF accepted, TypeScript Unix `INSTREAM` 3/3 PASS. This proves the protocol works, **not** definition freshness or malware clearance for real user files. That overall workflow run was marked **cancelled** after superseding commits, despite the lab job succeeding; verify the latest commit CI separately.

## Policy and implementation

- `ClamAvUnixVersionProbe` queries the **local Unix socket only** with `zVERSION\0`. ClamAV documents the command for engine/database version and permits disabling it. Missing, disabled, malformed, oversized, truncated or timed-out replies are untrusted and fail closed.
- `evaluateClamAvVersion` parses the three slash-delimited VERSION elements: engine version, definition database version, definition build timestamp. It enforces an **explicitly configured** engine major/minor allowlist and a max signature age in hours, using UTC and a small permitted clock skew. There is no universal version allowed by default.
- `ClamAvReadinessGuard` checks readiness *both before and after* invoking an isolated scan engine; a version/database switch mid-scan means verification is unavailable, **not** CLEAN. Errors propagate without approval.
- Tests simulate real Unix-domain socket framing, daemon outage, missing metadata, invalid dates, disallowed engine releases, expired/future signatures, and pre/post mismatches.
- POLICY EXAMPLE (not active): allowedMajorMinor ['1.4'], maximum definition age 48 hours. In production the permitted engine versions must come from an explicitly maintained, security-reviewed supported-release policy rather than being inferred from an image tag.
- Database build time is evidence metadata, **not independent proof of cryptographic provenance** or confirmation that freshclam is actively working. The scanner daemon/socket must be isolated, and worker identity plus signature provenance must be independently verified before attesting any scan.

## Release-blocking gaps

1. Real `zVERSION` output shape and timezone from the intended supported ClamAV container image must be validated in disposable CI, and the policy must be tested against both a fresh and deliberately stale synthetic VERSION response.
2. Pin a digest for the actual ClamAV image and ensure official signatures are updated by `freshclam` under controlled egress. Current lab disables freshclam and uses image preload; never trust it for currentness.
3. Implement worker credentials and unique immutable scan attempts/attestations, with a tamper-resistant PostgreSQL audit table and restricted worker SQL privileges.
4. Design R2 byte immutability/promotion and download authorization. Do not promote a file from `PENDING_SCAN` to `AVAILABLE` from a mere VERSION or `INSTREAM OK` response.
5. Test concurrency, malware detection, retries, outages, stale signatures, and recovery against a real worker in a non-production environment.

No operational DB migration, no R2 write, no service configuration and no merge to main in B3d4c.

Primary reference: https://docs.clamav.net/manual/Usage/ClamdProtocol.html
