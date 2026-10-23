import { it, expect } from 'vitest';

it('conserva el día DATE exacto para caducidad conocida y rechaza fechas inválidas', async () => {
  const { formatReceiptExpirationDate } = await import('./receipt-display');
  expect(formatReceiptExpirationDate('2028-12-31T00:00:00.000Z')).toBe(
    '31 dic 2028',
  );
  expect(formatReceiptExpirationDate('2028-12-31')).toBe('31 dic 2028');
  expect(formatReceiptExpirationDate('2028-02-30')).toBe('Fecha no disponible');
});
