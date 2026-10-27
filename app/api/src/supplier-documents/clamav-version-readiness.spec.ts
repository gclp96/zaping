import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  evaluateClamAvVersion,
  type ClamAvVersionPolicy,
} from './clamav-version-readiness';

describe('ClamAV VERSION freshness and engine policy', () => {
  const now = new Date('2026-10-26T12:00:00.000Z');
  const policy: ClamAvVersionPolicy = {
    allowedEngineMajorMinor: ['1.4'],
    maxDefinitionAgeHours: 48,
  };
  const current = 'ClamAV 1.4.3/27840/Mon Oct 26 11:00:00 2026';

  it('extracts engine/database versions and evaluates a recent build', () => {
    expect(evaluateClamAvVersion(current, now, policy)).toEqual({
      engineVersion: '1.4.3',
      definitionVersion: 27840,
      definitionBuildTime: '2026-10-26T11:00:00.000Z',
      definitionAgeHours: 1,
    });
  });

  it.each([
    'ClamAV 1.4.3/27838/Thu Oct 22 11:00:00 2026',
    'ClamAV 1.4.3/27842/Tue Oct 27 11:00:00 2026',
    'ClamAV 1.3.1/27840/Mon Oct 26 11:00:00 2026',
    'ClamAV 1.4.3',
    'ClamAV 1.4.3/0/Mon Oct 26 11:00:00 2026',
    'ClamAV 1.4.3/27840/not-a-time',
    'COMMAND UNAVAILABLE',
    '',
    'ClamAV 1.4.3/27840/Mon Oct 26 11:00:00 2026\nPONG',
  ])('fails closed on stale/missing/unsupported metadata: %s', (reply) => {
    expect(() => evaluateClamAvVersion(reply, now, policy)).toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects disabled or nonsensical policy configuration', () => {
    expect(() =>
      evaluateClamAvVersion(current, now, {
        allowedEngineMajorMinor: [],
        maxDefinitionAgeHours: 48,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      evaluateClamAvVersion(current, now, {
        allowedEngineMajorMinor: ['1.4'],
        maxDefinitionAgeHours: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('respects UTC independently of process locale', () => {
    const result = evaluateClamAvVersion(
      'ClamAV 1.4.3/27840/Mon Oct 26 11:00:00 2026 GMT',
      now,
      policy,
    );
    expect(result.definitionAgeHours).toBe(1);
  });
});
