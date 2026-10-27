import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Metadata gate for an isolated scanner worker. A successful probe is NOT an
 * attestation of file safety, identity or policy compliance by itself.
 */
export type ClamAvVersionPolicy = {
  readonly allowedEngineMajorMinor: readonly string[];
  readonly maxDefinitionAgeHours: number;
};

export type ClamAvVersionEvidence = {
  engineVersion: string;
  definitionVersion: number;
  definitionBuildTime: string;
  definitionAgeHours: number;
};

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function evaluateClamAvVersion(
  reply: string,
  evaluatedAt: Date,
  policy: ClamAvVersionPolicy,
): ClamAvVersionEvidence {
  if (
    !Number.isFinite(policy.maxDefinitionAgeHours) ||
    policy.maxDefinitionAgeHours <= 0 ||
    policy.maxDefinitionAgeHours > 168 ||
    policy.allowedEngineMajorMinor.length < 1 ||
    !policy.allowedEngineMajorMinor.every((item) =>
      /^\d+\.\d+$/.test(item),
    ) ||
    !Number.isFinite(evaluatedAt.getTime())
  ) {
    throw new BadRequestException('Política antivirus inválida');
  }
  const unavailable = () =>
    new ServiceUnavailableException('Motor antivirus no apto');
  if (reply.length > 256 || reply.includes('\n') || reply.includes('\r')) {
    throw unavailable();
  }

  // Typical clamd VERSION: ClamAV 1.4.3/27840/Mon Oct 26 11:00:00 2026
  // Explicitly reject bare engine versions, omitted definition metadata,
  // COMMAND UNAVAILABLE or unexpected engine protocols.
  const matched =
    /^ClamAV (\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)\/(\d{1,10})\/(.{15,95})$/.exec(
      reply,
    );
  if (!matched) throw unavailable();
  const [, engineVersion, definitionNumber, dateLabel] = matched;
  const majorMinor = engineVersion.split('.').slice(0, 2).join('.');
  if (!policy.allowedEngineMajorMinor.includes(majorMinor)) {
    throw unavailable();
  }
  const definitionVersion = Number(definitionNumber);
  if (!Number.isSafeInteger(definitionVersion) || definitionVersion <= 0) {
    throw unavailable();
  }

  // Require an explicit, recognizable English time value, interpreted in UTC
  // rather than the local timezone of an application server.
  const normalized = dateLabel.trim();
  if (
    !/^[A-Za-z]{3} [A-Za-z]{3} [ \d]\d \d{2}:\d{2}:\d{2} \d{4}(?: (?:UTC|GMT))?$/.test(
      normalized,
    )
  ) {
    throw unavailable();
  }
  const timeZoneExplicit = / (?:UTC|GMT)$/.test(normalized);
  const builtAtMs = Date.parse(
    timeZoneExplicit ? normalized : normalized + ' UTC',
  );
  if (!Number.isFinite(builtAtMs)) throw unavailable();
  const ageMs = evaluatedAt.getTime() - builtAtMs;
  if (
    ageMs < -MAX_FUTURE_SKEW_MS ||
    ageMs > policy.maxDefinitionAgeHours * 60 * 60 * 1000
  ) {
    throw unavailable();
  }

  return {
    engineVersion,
    definitionVersion,
    definitionBuildTime: new Date(builtAtMs).toISOString(),
    definitionAgeHours: Math.max(0, ageMs) / (60 * 60 * 1000),
  };
}
