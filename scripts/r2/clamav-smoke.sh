#!/usr/bin/env bash
# Non-production, isolated ClamAV smoke test. No real customer files or R2 credentials.
set -euo pipefail
SOCKET="${CLAMD_SOCKET:-/run/clamav/clamd.ctl}"
if [[ ! -S "$SOCKET" ]]; then echo "FAIL: clamd Unix socket unavailable" >&2; exit 1; fi
if ! command -v clamdscan >/dev/null || ! command -v freshclam >/dev/null; then
  echo "FAIL: clamdscan/freshclam not installed" >&2; exit 1
fi
if [[ -z "${CLAMAV_DATABASE_DIR:-}" || ! -d "$CLAMAV_DATABASE_DIR" ]]; then
  echo "FAIL: CLAMAV_DATABASE_DIR must point to mounted signature directory" >&2; exit 1
fi
if ! find "$CLAMAV_DATABASE_DIR" -maxdepth 1 -type f \( -name '*.cvd' -o -name '*.cld' \) -mmin -2880 | grep -q .; then
  echo "FAIL: no signature database file updated in the last 48h" >&2; exit 1
fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf '%%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%%%EOF\n' > "$tmp/clean.pdf"
# EICAR is the standard harmless antivirus test signature, not real malware.
printf 'X5O!P%%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > "$tmp/eicar.com"
set +e
clamdscan --no-summary --fdpass --config-file="${CLAMD_CONFIG:-/etc/clamav/clamd.conf}" "$tmp/clean.pdf" > "$tmp/clean.log" 2>&1
clean_status=$?
clamdscan --no-summary --fdpass --config-file="${CLAMD_CONFIG:-/etc/clamav/clamd.conf}" "$tmp/eicar.com" > "$tmp/eicar.log" 2>&1
infected_status=$?
set -e
if [[ $clean_status -ne 0 ]]; then echo "FAIL: clean sample not accepted" >&2; cat "$tmp/clean.log" >&2; exit 1; fi
if [[ $infected_status -ne 1 ]] || ! grep -q 'FOUND' "$tmp/eicar.log"; then
  echo "FAIL: EICAR was not detected (or daemon failed)" >&2
  cat "$tmp/eicar.log" >&2; exit 1
fi
echo "PASS: clean sample accepted and EICAR detected by real clamd"
