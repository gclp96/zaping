import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClamAvUnixVersionProbe } from './clamav-unix-version-probe';

async function fakeVersionServer(reply: Buffer | null) {
  const directory = await mkdtemp(join(tmpdir(), 'zaping-av-version-'));
  const socketPath = join(directory, 'clamd.sock');
  const commands: string[] = [];
  const server: Server = createServer((socket) => {
    socket.once('data', (chunk: Buffer) => {
      commands.push(chunk.toString('ascii'));
      if (reply === null) {
        socket.destroy();
      } else {
        socket.end(reply);
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });
  return {
    socketPath,
    commands,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

describe('ClamAV local zVERSION readiness transport', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const policy = {
    allowedEngineMajorMinor: ['1.4'],
    maxDefinitionAgeHours: 48,
  };

  it('probes the local Unix socket with z-framing', async () => {
    const fixture = await fakeVersionServer(
      Buffer.from('ClamAV 1.4.3/27840/Mon Oct 26 11:00:00 2026\0', 'ascii'),
    );
    try {
      const result = await new ClamAvUnixVersionProbe(
        fixture.socketPath,
      ).verifyReadiness(policy, now);
      expect(result.definitionAgeHours).toBe(1);
      expect(fixture.commands).toEqual(['zVERSION\0']);
    } finally {
      await fixture.close();
    }
  });

  it('rejects a closed daemon or incomplete reply without allowing scanning', async () => {
    const fixture = await fakeVersionServer(null);
    try {
      await expect(
        new ClamAvUnixVersionProbe(fixture.socketPath).verifyReadiness(
          policy,
          now,
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      await fixture.close();
    }
  });

  it('rejects unknown or malformed protocol frames', async () => {
    const fixture = await fakeVersionServer(
      Buffer.from('COMMAND UNAVAILABLE\0', 'ascii'),
    );
    try {
      await expect(
        new ClamAvUnixVersionProbe(fixture.socketPath).verifyReadiness(
          policy,
          now,
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      await fixture.close();
    }
  });

  it('denies TCP/socket URL configuration and missing socket', async () => {
    expect(() => new ClamAvUnixVersionProbe('tcp://localhost:3310')).toThrow(
      BadRequestException,
    );
    await expect(
      new ClamAvUnixVersionProbe(
        '/nonexistent/zaping-clamd.sock',
      ).readVersion(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
