import { describe, expect, it } from 'vitest';

import {
  formatPurchaseDate,
  getOperationalDateKey,
  isValidTimeZone,
} from './purchase-date';

describe('purchase-date', () => {
  it('deriva la fecha operativa con la zona horaria de la empresa', () => {
    expect(
      getOperationalDateKey(
        '2026-09-01T02:00:00.000Z',
        'America/Hermosillo',
      ),
    ).toBe('2026-08-31');
    expect(
      formatPurchaseDate(
        '2026-09-01T02:00:00.000Z',
        'America/Hermosillo',
      ),
    ).toMatch(/31 ago 2026/i);
  });

  it('rechaza fechas y zonas horarias inválidas sin romper el render', () => {
    expect(isValidTimeZone('America/Hermosillo')).toBe(true);
    expect(isValidTimeZone('Zona/Invalida')).toBe(false);
    expect(getOperationalDateKey('no-date', 'America/Hermosillo')).toBeNull();
    expect(
      getOperationalDateKey(
        '2026-09-01T02:00:00.000Z',
        'Zona/Invalida',
      ),
    ).toBeNull();
    expect(formatPurchaseDate('no-date', 'America/Hermosillo')).toBeNull();
  });
});
