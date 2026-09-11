const SEARCH_KEY_SEPARATOR = '\u001F';

export function normalizeHealthcareDisplayText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function normalizeHealthcareOptionalText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return value.trim() || null;
}

export function normalizeHealthcareOptionalDisplayText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return normalizeHealthcareDisplayText(value) || null;
}

export function normalizeHealthcareEmail(
  value: string | null | undefined,
): string | null | undefined {
  const normalized = normalizeHealthcareOptionalText(value);

  return typeof normalized === 'string' ? normalized.toLowerCase() : normalized;
}

export function normalizeHealthcareSearchText(value: string): string {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replaceAll(SEARCH_KEY_SEPARATOR, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function buildHealthcareSearchKey(values: string[]): string {
  return values.map(normalizeHealthcareSearchText).join(SEARCH_KEY_SEPARATOR);
}

export function getHealthcareSearchTerms(value: string): string[] {
  return normalizeHealthcareSearchText(value)
    .split(' ')
    .filter((term) => term.length > 0);
}

export function transformHealthcareDisplayText(value: unknown): unknown {
  return typeof value === 'string'
    ? normalizeHealthcareDisplayText(value)
    : value;
}

export function transformHealthcareOptionalText(value: unknown): unknown {
  return typeof value === 'string'
    ? normalizeHealthcareOptionalText(value)
    : value;
}

export function transformHealthcareOptionalDisplayText(
  value: unknown,
): unknown {
  return typeof value === 'string'
    ? normalizeHealthcareOptionalDisplayText(value)
    : value;
}

export function transformHealthcareEmail(value: unknown): unknown {
  return typeof value === 'string' ? normalizeHealthcareEmail(value) : value;
}

export function transformHealthcareSearchText(value: unknown): unknown {
  return typeof value === 'string'
    ? normalizeHealthcareSearchText(value)
    : value;
}
