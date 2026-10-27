#!/usr/bin/env bash
# B3d4b laboratory-only: ClamAV real-daemon smoke. Never use customer files.
set -euo pipefail

SOCKET="${CLAMD_SOCKET:-/tmp/clamd.sock}"
CONFIG="${CLAMD_CONFIG:-/etc/clamav/clamd.conf}"
DB_DIR="${CLAMAV_DATABASE_DIR:-/var/lib/clamav}"

if [[ ! -S "$SOCKET" || ! -r "$CONFIG" || ! -d "$DB_DIR" ]]; then
  echo "FAIL: local clamd socket, config or signature directory absent" >&2
  exit 1
fi
for binary in clamdscan sigtool; do
  command -v "$binary" >/dev/null || { echo "FAIL: missing $binary" >&2; exit 1; }
done

# A valid .cvd/.cld file must exist. Neither its filesystem mtime nor this
# existence check attests database freshness: that is a separate release gate.
shopt -s nullglob
databases=("$DB_DIR"/*.cvd "$DB_DIR"/*.cld)
if (( ${#databases[@]} == 0 )); then
  echo "FAIL: no signature database in $DB_DIR" >&2
  exit 1
fi
sigtool --info "${databases[0]}" | grep -E '^(Version|Build time|Signatures):' || {
  echo "FAIL: unreadable signature database metadata" >&2
  exit 1
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Synthetic PDF; no customer bytes. The EICAR payload is the standard
# harmless antivirus test signature, not executable malware.
printf '%%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%%%EOF\n' > "$tmp/clean.pdf"
printf '%s' 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > "$tmp/eicar.com"
if [[ "$(wc -c < "$tmp/eicar.com" | tr -d ' ')" != "68" ]]; then
  echo "FAIL: invalid EICAR synthetic test payload length" >&2
  exit 1
fi

set +e
clamdscan --no-summary --fdpass --config-file="$CONFIG" "$tmp/clean.pdf" > "$tmp/clean.log" 2>&1
clean_status=$?
clamdscan --no-summary --fdpass --config-file="$CONFIG" "$tmp/eicar.com" > "$tmp/eicar.log" 2>&1
infected_status=$?
set -e

if (( clean_status != 0 )); then
  echo "FAIL: clean synthetic PDF was not accepted" >&2
  cat "$tmp/clean.log" >&2
  exit 1
fi
if (( infected_status != 1 )) || ! grep -Eq 'Eicar.* FOUND|EICAR.* FOUND' "$tmp/eicar.log"; then
  echo "FAIL: EICAR synthetic signature not detected (or daemon unavailable)" >&2
  cat "$tmp/eicar.log" >&2
  exit 1
fi
echo "PASS: real clamd accepted clean PDF and detected EICAR; signature freshness NOT attested"
