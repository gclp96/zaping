import { ServiceUnavailableException } from '@nestjs/common';
import type {
  ClamAvVersionEvidence,
  ClamAvVersionPolicy,
} from './clamav-version-readiness';
import type { ClamAvProtocolVerdict } from './clamav-instream-scanner';

export interface ScannerVersionProbe {
  verifyReadiness(
    policy: ClamAvVersionPolicy,
  ): Promise<ClamAvVersionEvidence>;
}

export interface MalwareScanEngine {
  scan(bytes: Buffer): Promise<ClamAvProtocolVerdict>;
}

/**
 * Worker-only pre/post scan safety gate. No R2, Prisma, HTTP, or signed scan
 * attestation. ClamAV VERSION is metadata from a local trusted process;
 * it does not establish worker identity or grant a document AVAILABLE status.
 */
export class ClamAvReadinessGuard {
  constructor(
    private readonly versionProbe: ScannerVersionProbe,
    private readonly engine: MalwareScanEngine,
    private readonly policy: ClamAvVersionPolicy,
  ) {}

  async scan(bytes: Buffer): Promise<{
    verdict: ClamAvProtocolVerdict;
    readiness: ClamAvVersionEvidence;
  }> {
    const before = await this.versionProbe.verifyReadiness(this.policy);
    const verdict = await this.engine.scan(bytes);
    const after = await this.versionProbe.verifyReadiness(this.policy);
    if (
      after.engineVersion !== before.engineVersion ||
      after.definitionVersion !== before.definitionVersion ||
      after.definitionBuildTime !== before.definitionBuildTime
    ) {
      throw new ServiceUnavailableException(
        'Actualización antivirus durante el análisis',
      );
    }
    return { verdict, readiness: after };
  }
}
