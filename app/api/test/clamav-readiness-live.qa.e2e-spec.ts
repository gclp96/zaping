import { ServiceUnavailableException } from '@nestjs/common';
import { createConnection } from 'node:net';
import {
  ClamAvReadinessProbe,
  evaluateClamAvVersion,
  type ClamAvReadinessPolicy,
} from '../src/supplier-documents/clamav-readiness-probe';

const describeLive =
  process.env.RUN_CLAMAV_READINESS_REAL_LAB === '1'
    ? describe
    : describe.skip;

function readLiveVersion(socketPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath });
    let settled = false;
    let response = Buffer.alloc(0);
    const fail = () => finish(new Error('Real lab VERSION command failed'));
    const timer = setTimeout(fail, 5_000);
    function finish(result: string | Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (result instanceof Error) reject(result);
      else resolve(result);
    }
    socket.on('error', fail);
    socket.on('close', fail);
    socket.on('data', (chunk: Buffer) => {
      response = Buffer.concat([response, chunk]);
      if (response.length > 512) return fail();
      const end = response.indexOf(0);
      if (end < 0) return;
      if (end !== response.length - 1) return fail();
      finish(response.subarray(0, end).toString('utf8'));
    });
    socket.once('connect', () => {
      socket.write(Buffer.from('zVERSION\0', 'ascii'), (err) => {
        if (err) fail();
      });
    });
  });
}

/**
 * Opt-in disposable CI only. Validation time is deliberately anchored to
 * the daemon's reported timestamp to validate protocol formatting WITHOUT
 * claiming the preloaded database is fresh as of real wall-clock time.
 */
describeLive('B3d4c actual clamd readiness protocol lab', () => {
  let socketPath: string;

  beforeAll(() => {
    if (
      process.env.CI !== 'true' ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.TZ !== 'UTC' ||
      !process.env.CLAMD_SOCKET?.startsWith('/') ||
      !process.env.CLAMD_SOCKET.includes('/zaping-clamd-socket/')
    ) {
      throw new Error('B3d4c real readiness lab requires isolated UTC CI socket');
    }
    socketPath = process.env.CLAMD_SOCKET;
  });

  it('parses real zVERSION bytes and zPING with a deliberately synthetic clock', async () => {
    const reply = await readLiveVersion(socketPath);
    const match = /^ClamAV (\d+\.\d+\.\d+)\/([1-9]\d*)\/(.+)$/u.exec(reply);
    expect(match).not.toBeNull();
    const engine = match![1];
    const reportedTime = Date.parse(match![3] + ' GMT');
    expect(Number.isFinite(reportedTime)).toBe(true);

    const policy: ClamAvReadinessPolicy = {
      policyVersion: 'b3d4c-real-format-lab',
      daemonTimeZone: 'UTC',
      allowedEngineVersions: [engine],
      maxDatabaseAgeMs: 48 * 60 * 60 * 1_000,
      maxFutureClockSkewMs: 5 * 60 * 1_000,
    };
    const observedAt = reportedTime + 60 * 60 * 1_000;
    const result = await new ClamAvReadinessProbe(socketPath, policy).check(
      observedAt,
    );
    expect(result.engineVersion).toBe(engine);
    expect(result.databaseVersion).toBe(Number(match![2]));
    expect(result.attested).toBe(false);
    expect(result.databaseBuiltAt).toBe(new Date(reportedTime).toISOString());
  });

  it('rejects real live daemon with disallowed engine version', async () => {
    const policy: ClamAvReadinessPolicy = {
      policyVersion: 'b3d4c-reject-lab',
      daemonTimeZone: 'UTC',
      allowedEngineVersions: ['0.0.0'],
      maxDatabaseAgeMs: 48 * 60 * 60 * 1_000,
      maxFutureClockSkewMs: 5 * 60 * 1_000,
    };
    await expect(
      new ClamAvReadinessProbe(socketPath, policy).check(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
