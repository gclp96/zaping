import { ServiceUnavailableException } from '@nestjs/common';
import { ClamAvReadinessGuard } from './clamav-readiness-guard';

describe('ClamAV pre/post scan signature readiness', () => {
  const good = {
    engineVersion: '1.4.3',
    definitionVersion: 27840,
    definitionBuildTime: '2026-10-26T11:00:00.000Z',
    definitionAgeHours: 1,
  };
  const policy = {
    allowedEngineMajorMinor: ['1.4'],
    maxDefinitionAgeHours: 48,
  };
  const bytes = Buffer.from('synthetic');
  const probe = { verifyReadiness: jest.fn() };
  const engine = { scan: jest.fn() };
  const guard = new ClamAvReadinessGuard(probe, engine, policy);

  beforeEach(() => {
    jest.resetAllMocks();
    probe.verifyReadiness.mockResolvedValue(good);
    engine.scan.mockResolvedValue('CLAMD_OK_UNATTESTED');
  });

  it('requires matching fresh definitions before and after scanning', async () => {
    await expect(guard.scan(bytes)).resolves.toEqual({
      verdict: 'CLAMD_OK_UNATTESTED',
      readiness: good,
    });
    expect(probe.verifyReadiness).toHaveBeenCalledTimes(2);
    expect(probe.verifyReadiness).toHaveBeenCalledWith(policy);
    expect(engine.scan).toHaveBeenCalledWith(bytes);
  });

  it('never calls the scanner when signatures are stale or daemon unavailable', async () => {
    probe.verifyReadiness.mockRejectedValueOnce(
      new ServiceUnavailableException('Motor antivirus no apto'),
    );
    await expect(guard.scan(bytes)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(engine.scan).not.toHaveBeenCalled();
  });

  it('fails closed when daemon reports a definition change during the scan', async () => {
    probe.verifyReadiness
      .mockResolvedValueOnce(good)
      .mockResolvedValueOnce({ ...good, definitionVersion: 27841 });
    await expect(guard.scan(bytes)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('does not interpret post-scan probe failure as clean result', async () => {
    probe.verifyReadiness
      .mockResolvedValueOnce(good)
      .mockRejectedValueOnce(
        new ServiceUnavailableException('ClamAV disconnected'),
      );
    await expect(guard.scan(bytes)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('preserves an actual malware finding when the engine remains verified', async () => {
    engine.scan.mockResolvedValueOnce('MALWARE_DETECTED');
    await expect(guard.scan(bytes)).resolves.toMatchObject({
      verdict: 'MALWARE_DETECTED',
    });
  });
});
