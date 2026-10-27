import { BadRequestException } from '@nestjs/common';
import { ClamAvInstreamScanner } from '../src/supplier-documents/clamav-instream-scanner';
import { ClamAvUnixVersionProbe } from '../src/supplier-documents/clamav-unix-version-probe';

const describeLive =
  process.env.RUN_CLAMAV_REAL_LAB === '1' ? describe : describe.skip;

/**
 * This explicitly opt-in integration test talks to a genuine ClamAV daemon
 * via a disposable local Unix socket. It never reads R2, writes to Prisma or
 * marks an attachment AVAILABLE.
 */
describeLive(
  'B3d4b ClamAV real Unix INSTREAM integration (CI laboratory)',
  () => {
    let scanner: ClamAvInstreamScanner;

    beforeAll(() => {
      if (
        process.env.CI !== 'true' ||
        process.env.GITHUB_ACTIONS !== 'true' ||
        !process.env.CLAMD_SOCKET?.startsWith('/') ||
        !process.env.CLAMD_SOCKET.includes('/zaping-clamd-socket/')
      ) {
        throw new Error(
          'Real ClamAV smoke requires disposable isolated CI socket',
        );
      }
      scanner = new ClamAvInstreamScanner(process.env.CLAMD_SOCKET, 20_000);
    });

    it('reads engine and definition metadata from real zVERSION Unix protocol', async () => {
      const socketPath = process.env.CLAMD_SOCKET;
      if (!socketPath) throw new Error('Laboratory Unix socket unavailable');
      const version = await new ClamAvUnixVersionProbe(
        socketPath,
      ).readVersion();
      expect(version).toMatch(/^ClamAV \d+\.\d+\.\d+\/\d+\/.{15,95}$/);
    });

    it('passes a synthetic clean PDF through the real Node zINSTREAM client', async () => {
      const cleanPdf = Buffer.from(
        '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n',
        'ascii',
      );
      expect(await scanner.scan(cleanPdf)).toBe('CLAMD_OK_UNATTESTED');
    });

    it('reports actual harmless EICAR test signature as malware, never clean', async () => {
      const eicar = Buffer.from(
        String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`,
        'ascii',
      );
      expect(eicar.byteLength).toBe(68);
      expect(await scanner.scan(eicar)).toBe('MALWARE_DETECTED');
    });

    it('never accepts empty streams even when a real scanner is running', async () => {
      await expect(scanner.scan(Buffer.alloc(0))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  },
);
