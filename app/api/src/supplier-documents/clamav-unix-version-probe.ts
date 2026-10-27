import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createConnection } from 'node:net';
import { isAbsolute } from 'node:path';
import {
  evaluateClamAvVersion,
  type ClamAvVersionEvidence,
  type ClamAvVersionPolicy,
} from './clamav-version-readiness';

/**
 * Local worker-only zVERSION probe. Socket protocol has no authentication:
 * only use a trusted Unix socket with ownership/permission checks by the
 * scanner worker. Never connect to clamd over public TCP.
 */
export class ClamAvUnixVersionProbe {
  constructor(
    private readonly socketPath: string,
    private readonly timeoutMs = 5_000,
  ) {
    if (
      !isAbsolute(socketPath) ||
      socketPath.includes('\0') ||
      socketPath.includes('\r') ||
      socketPath.includes('\n') ||
      timeoutMs < 1_000 ||
      timeoutMs > 30_000 ||
      !Number.isSafeInteger(timeoutMs)
    ) {
      throw new BadRequestException('Socket del antivirus inválido');
    }
  }

  async verifyReadiness(
    policy: ClamAvVersionPolicy,
    now: Date = new Date(),
  ): Promise<ClamAvVersionEvidence> {
    const version = await this.readVersion();
    return evaluateClamAvVersion(version, now, policy);
  }

  async readVersion(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const socket = createConnection({ path: this.socketPath });
      let done = false;
      let collected = Buffer.alloc(0);
      const rejectUnavailable = () =>
        complete(
          new ServiceUnavailableException('Motor antivirus no disponible'),
        );
      const complete = (outcome: string | Error) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        socket.destroy();
        if (outcome instanceof Error) reject(outcome);
        else resolve(outcome);
      };
      const timeout = setTimeout(rejectUnavailable, this.timeoutMs);
      socket.on('error', rejectUnavailable);
      socket.on('close', () => {
        if (!done) rejectUnavailable();
      });
      socket.on('data', (chunk: Buffer) => {
        collected = Buffer.concat([collected, chunk]);
        if (collected.length > 256) {
          rejectUnavailable();
          return;
        }
        const terminator = collected.indexOf(0);
        if (terminator === -1) return;
        if (terminator !== collected.length - 1) {
          rejectUnavailable();
          return;
        }
        complete(collected.subarray(0, terminator).toString('utf8'));
      });
      socket.once('connect', () => {
        socket.write(Buffer.from('zVERSION\0', 'ascii'), (error) => {
          if (error) rejectUnavailable();
        });
      });
    });
  }
}
