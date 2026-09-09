#!/bin/sh
set -eu
test "$(node --version)" = "v24.20.0"
test "$(npm --version)" = "11.19.0"
test "$NODE_ENV" = "development"
# Copy only source to an isolated Docker volume, never write into the checkout.
grep -q ' /app ' /proc/mounts || { echo 'ABORT: /app is not an isolated mount' >&2; exit 1; }
find /app -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf -- {} +
cd /source
tar --exclude='./node_modules' --exclude='./dist' --exclude='./.next' --exclude='./coverage' --exclude='./.env*' --exclude='*.tsbuildinfo' -cf - . | tar -xf - -C /app
cd /app
if [ "$1" = "api" ] && ! command -v openssl >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends ca-certificates openssl
fi
lock_hash="$(sha256sum package.json package-lock.json | sha256sum | cut -d ' ' -f 1)"
if [ ! -f node_modules/.zaping-qa-lock-hash ] || [ "$(cat node_modules/.zaping-qa-lock-hash)" != "$lock_hash" ]; then
  npm ci --no-audit --no-fund
  printf '%s' "$lock_hash" > node_modules/.zaping-qa-lock-hash
fi
if [ "$1" = "api" ]; then
  npx prisma generate
  exec npm run start:dev
fi
exec npm run dev -- --hostname 0.0.0.0 --port 3000
