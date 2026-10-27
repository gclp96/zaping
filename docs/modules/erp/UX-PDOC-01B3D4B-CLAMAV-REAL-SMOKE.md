# B3d4b — Real ClamAV laboratory smoke gate

**Status:** test harness only. Not executed, not a scanner deployment, not a clean attestation.

Run `scripts/r2/clamav-smoke.sh` **manually** only inside a dedicated non-production Linux scanner environment with a local Unix-domain `clamd` socket, `clamdscan` and `freshclam` installed, fresh signature database, no customer files and no Cloudflare R2 credentials.

Required environment:
- `CLAMD_SOCKET`: local Unix socket (default `/run/clamav/clamd.ctl`).
- `CLAMD_CONFIG`: daemon client configuration (default `/etc/clamav/clamd.conf`).
- `CLAMAV_DATABASE_DIR`: explicit path to persistent ClamAV signature files; the script requires at least one .cvd/.cld modified in last 48 hours (a filesystem timestamp is **not** proof of actual signature freshness).
- `StreamMaxLength` and daemon `MaxFileSize`/limits must support Zaping's 10 MiB cap; configure separately and test with a 10 MiB clean file.

Smoke acceptance: clean synthetic PDF returns exit 0, harmless EICAR antivirus test returns exit 1 and `FOUND`. Exit 2 or any unexpected status fails the gate. This does **not** test Zaping's `INSTREAM` adapter against a live daemon; that separate test is still required.

Security:
- Do not open clamd TCP port 3310 or mount the Docker socket.
- Run worker and daemon as unprivileged users, enforce filesystem permissions on Unix socket and resource limits.
- Keep sample files and signatures isolated. No secrets or production R2 tokens.
- Require independently observed engine/database version and signature timestamp, process identity and policy version for any later durable scan attestation.
- This script deliberately does not modify DB status, upload files to R2, authorize download, or promote from quarantine.
- Prefer a dedicated 3–4 GiB RAM scanner host/container allocation for planning; benchmark actual resource usage before choosing a hosting plan.

Next: wire an isolated ephemeral daemon in CI (opt-in) and test the **actual** TypeScript `zINSTREAM` client against it; validate signature age using engine metadata rather than file modification time; add durable worker-signed scan evidence with least-privilege DB permissions and replay protection before promotion.

References: https://docs.clamav.net/manual/Usage/ClamdProtocol.html and https://docs.clamav.net/manual/Installing/Docker.html
