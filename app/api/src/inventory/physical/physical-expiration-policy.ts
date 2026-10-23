import {
  normalizePositionExpirationDate,
  requirePhysical,
} from './physical-inventory.contract';

export type PhysicalExpirationEligibility =
  'UNKNOWN' | 'NOT_EXPIRED' | 'EXPIRED';

// Decode the persisted calendar value, not a UTC instant of expiration. This
// also preserves the stored UTC calendar component of historical Batch values.
export function storedExpirationDay(
  value: Date | null | undefined,
): string | null {
  if (value == null) return null;
  requirePhysical(
    Number.isFinite(value.getTime()),
    'PHYSICAL_SOURCE_NOT_ELIGIBLE',
  );
  return normalizePositionExpirationDate(value.toISOString().slice(0, 10));
}

// Pure policy. Writers must supply the persisted Company's zone and obtain asOf
// after their business locks; neither value belongs to a PhysicalRequest/hash.
export function companyLocalDay(companyTimezone: string, asOf: Date): string {
  requirePhysical(
    Number.isFinite(asOf.getTime()),
    'PHYSICAL_SOURCE_NOT_ELIGIBLE',
  );
  requirePhysical(
    typeof companyTimezone === 'string' && companyTimezone.trim().length > 0,
    'PHYSICAL_SOURCE_NOT_ELIGIBLE',
  );
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: companyTimezone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(asOf);
  } catch {
    requirePhysical(false, 'PHYSICAL_SOURCE_NOT_ELIGIBLE');
  }
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  const localDay = normalizePositionExpirationDate(
    `${part('year')}-${part('month')}-${part('day')}`,
  );
  requirePhysical(localDay, 'PHYSICAL_SOURCE_NOT_ELIGIBLE');
  return localDay;
}

export function physicalExpirationEligibility(
  expirationDay: string | null,
  companyTimezone: string,
  asOf: Date,
): PhysicalExpirationEligibility {
  const day = normalizePositionExpirationDate(expirationDay);
  const localDay = companyLocalDay(companyTimezone, asOf);
  return day === null ? 'UNKNOWN' : day < localDay ? 'EXPIRED' : 'NOT_EXPIRED';
}
