# B3d4b — Real ClamAV laboratory smoke gate

**Status:** test harness and branch-restricted disposable CI runner added. CI results must be checked separately; this is not a production scanner deployment or clean attestation.

Run `scripts/r2/clamav-smoke.sh` in a dedicated non-production Linux scanner environment with local Unix-domain `clamd` socket, `clamdscan`/`sigtool` and preloaded signatures, no customer files or Cloudflare R2 credentials. The repository CI job `clamav-real-lab` is enabled **only for push events on branch `feat/ux-pdoc-01b3d4b-clamav-real-smoke`**; it uses official `clamav/clamav-debian:stable`, 4 GiB RAM limit, `--network none`, no published ports, and disables freshclam during this synthetic smoke. It is intentionally not a general release gate.

Required environment:
- `CLAMD_SOCKET`: local Unix socket (default `/tmp/clamd.sock` for the official container).
- `CLAMD_CONFIG`: daemon client configuration (default `/etc/clamav/clamd.conf`).
- `CLAMAV_DATABASE_DIR`: directory containing ClamAV .cvd/.cld signatures (default `/var/lib/clamav`). The script prints basic signature metadata using `sigtool --info` but **does not attest freshness, provenance or engine policy**. CI uses preloaded signatures; freshclam is disabled because the disposable container has no network.
- `StreamMaxLength` and daemon `MaxFileSize`/limits must support Zaping's 10 MiB cap; configure separately and test with a 10 MiB clean file.

Smoke acceptance: clean synthetic PDF returns exit 0, harmless EICAR antivirus test returns exit 1 and `FOUND`. Script validates the exact EICAR 68-byte payload. Exit 2 or any unexpected status fails the gate. This does **not** test Zaping's TypeScript `INSTREAM` adapter against a live daemon; that separate test is still required.

Security:
- Do not open clamd TCP port 3310 or mount the Docker socket.
- Run worker and daemon as unprivileged users, enforce filesystem permissions on Unix socket and resource limits.
- Keep sample files and signatures isolated. No secrets or production R2 tokens.
- Require independently observed engine/database version and signature timestamp, process identity and policy version for any later durable scan attestation.
- This script deliberately does not modify DB status, upload files to R2, authorize download, or promote from quarantine.
- Prefer a dedicated 3–4 GiB RAM scanner host/container allocation for planning; benchmark actual resource usage before choosing a hosting plan.

Next: after obtaining a green real-daemon smoke, test the **actual** TypeScript `zINSTREAM` client against the same ephemeral clamd, validate signature age from authoritative engine metadata, pin and audit an image digest for release, and add durable worker-signed scan evidence with least-privilege DB permissions/replay protection before promotion.

References: https://docs.clamav.net/manual/Usage/ClamdProtocol.html and https://docs.clamav.net/manual/Installing/Docker.html
