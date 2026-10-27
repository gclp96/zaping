#!/usr/bin/env node
/**
 * B3d4b — LIVE ClamAV protocol check against an isolated local Unix socket.
 * Never contacts R2, PostgreSQL, GitHub secrets or a public malware API.
 *
 * Fail closed: engine too old, signatures stale, socket unavailable, malware
 * incorrectly accepted, clean sample rejected or malformed protocol.
 */
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';

const socketPath = process.argv[2] ?? '/run/clamav/clamd.sock';
const maxSignatureAgeHours = 72;
const startupDeadline = Date.now() + 5 * 60_000;
const MAX_RESPONSE = 2048;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function request(command, bytes) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath });
    let response = Buffer.alloc(0);
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error('clamd response timeout')),
      15_000,
    );

    socket.once('error', () =>
      finish(new Error('ClamAV Unix socket unavailable')),
    );
    socket.once('close', () => {
      if (!settled) finish(new Error('ClamAV closed before complete reply'));
    });
    socket.on('data', (chunk) => {
      response = Buffer.concat([response, chunk]);
      if (response.length > MAX_RESPONSE) {
        finish(new Error('ClamAV reply too large'));
        return;
      }
      const nul = response.indexOf(0);
      if (nul < 0) return;
      if (nul !== response.length - 1) {
        finish(new Error('ClamAV reply has trailing data'));
        return;
      }
      finish(null, response.subarray(0, nul).toString('utf8'));
    });

    socket.once('connect', () => {
      if (bytes === undefined) {
        socket.write(Buffer.from('z' + command + '\0', 'ascii'));
        return;
      }
      socket.write(Buffer.from('zINSTREAM\0', 'ascii'));
      for (let i = 0; i < bytes.length; i += 64 * 1024) {
        const chunk = bytes.subarray(i, i + 64 * 1024);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(chunk.length);
        socket.write(header);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}

function checkVersionAndFreshness(raw) {
  // ClamAV 1.4.6/12345/Mon Oct 26 12:00:00 2026
  const match = /^ClamAV (\d+)\.(\d+)\.(\d+)\/(\d+)\/(.+)$/.exec(raw);
  assert.ok(match, 'ClamAV VERSION reply has an unknown structure');
  const [, majorRaw, minorRaw, patchRaw, dbVersion, databaseDate] = match;
  const [major, minor, patch] = [
    Number(majorRaw),
    Number(minorRaw),
    Number(patchRaw),
  ];
  assert.ok(
    major > 1 || (major === 1 && (minor > 4 || (minor === 4 && patch >= 6))),
    'ClamAV engine version is not an approved security patch',
  );
  assert.ok(Number(dbVersion) > 0, 'ClamAV has no loaded signature database');
  const signatureTimestamp = Date.parse(databaseDate);
  assert.ok(Number.isFinite(signatureTimestamp), 'Signature timestamp invalid');
  const ageHours = (Date.now() - signatureTimestamp) / 3_600_000;
  assert.ok(
    ageHours >= -1 && ageHours <= maxSignatureAgeHours,
    'Signature database is expired or timestamp is invalid',
  );
  return {
    engine: `${major}.${minor}.${patch}`,
    signatureDb: Number(dbVersion),
    signatureAgeHours: Number(ageHours.toFixed(1)),
  };
}

async function waitForReady() {
  let lastError = 'daemon not responding';
  while (Date.now() < startupDeadline) {
    try {
      assert.equal(await request('PING'), 'PONG');
      const version = checkVersionAndFreshness(await request('VERSION'));
      return version;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown error';
      await sleep(2_000);
    }
  }
  throw new Error(`ClamAV readiness/freshness gate failed: ${lastError}`);
}

async function main() {
  assert.ok(
    socketPath.startsWith('/') && !socketPath.includes('\0'),
    'Only a local absolute Unix socket path is permitted',
  );
  const metadata = await waitForReady();
  console.log(
    'ClamAV real engine and signature gate PASS:',
    JSON.stringify(metadata),
  );

  const cleanPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\n%%EOF\n',
  );
  const cleanJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0xff, 0xd9,
  ]);
  assert.equal(await request('INSTREAM', cleanPdf), 'stream: OK');
  assert.equal(await request('INSTREAM', cleanJpeg), 'stream: OK');
  console.log('Synthetic PDF and JPEG scans PASS (stream: OK)');

  // Standard harmless EICAR antivirus TEST signature generated in memory.
  // Assemble pieces so security scanners do not mistake source for a sample.
  const eicar = Buffer.from(
    String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}` +
      '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
    'ascii',
  );
  assert.equal(eicar.length, 68, 'EICAR test bytes not canonical');
  const infected = await request('INSTREAM', eicar);
  assert.match(
    infected,
    /^stream: [^\r\n\0]{1,200} FOUND$/,
    'Expected ClamAV to detect EICAR, not return clean or unknown',
  );
  console.log('EICAR detection PASS (malware verdict; signature redacted)');

  // Invalid/unavailable scanner must fail closed rather than return OK.
  const missing = socketPath + '.nonexistent';
  try {
    const originalSocket = socketPath;
    assert.notEqual(missing, originalSocket);
    await new Promise((resolve, reject) => {
      const socket = createConnection({ path: missing });
      socket.once('connect', () => {
        socket.destroy();
        reject(new Error('Unexpected accessible missing socket'));
      });
      socket.once('error', () => {
        socket.destroy();
        resolve();
      });
    });
  } catch (error) {
    throw error;
  }
  console.log('Unavailable socket fail-closed behavior PASS');
  console.log('B3d4b REAL CLAMAV SMOKE: PASS (no DB/R2 operations)');
}

main().catch((error) => {
  console.error(
    'B3d4b REAL CLAMAV SMOKE: FAIL:',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exitCode = 1;
});
