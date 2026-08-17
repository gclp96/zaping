export interface NormalizeMoneyInputOptions {
  allowNegative?: boolean;
  maxDecimals?: number;
}

export function normalizeMoneyInputValue(
  rawValue: string,
  {
    allowNegative = false,
    maxDecimals = 2,
  }: NormalizeMoneyInputOptions = {},
): string | null {
  let value = rawValue.trim();

  if (value === '') {
    return '';
  }

  value = value
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(/MXN/gi, '');

  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  if (hasComma && hasDot) {
    value = value.replace(/,/g, '');
  } else if (hasComma) {
    value = value.replace(/,/g, '.');
  }

  const minusSigns = value.match(/-/g)?.length ?? 0;

  if (minusSigns > 1) {
    return null;
  }

  if (value.includes('-') && !value.startsWith('-')) {
    return null;
  }

  if (!allowNegative && value.startsWith('-')) {
    return null;
  }

  const unsignedValue = value.startsWith('-')
    ? value.slice(1)
    : value;

  if (!/^\d*(?:\.\d*)?$/.test(unsignedValue)) {
    return null;
  }

  if (unsignedValue === '.') {
    value = value.startsWith('-') ? '-0.' : '0.';
  }

  const decimals = value.split('.')[1];
  const decimalLimit = Number.isFinite(maxDecimals)
  ? Math.max(
      0,
      Math.floor(maxDecimals),
    )
  : 2;

  if (decimals && decimals.length > decimalLimit) {
    return null;
  }

  return value;
}