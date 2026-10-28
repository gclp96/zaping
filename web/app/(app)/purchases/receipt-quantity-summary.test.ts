import { describe, expect, it } from 'vitest';

import { calculateReceiptQuantitySummary } from './receipt-quantity-summary';

function item(pendingQuantity: number, quantityReceived: string) {
  return { pendingQuantity, quantityReceived };
}

describe('RR-004 — resumen informativo de cantidades', () => {
  it('no confunde cantidades pedidas con pendientes ni incluye filas vacías', () => {
    expect(
      calculateReceiptQuantitySummary([
        item(6, '3'),
        item(5, ''),
        item(7, ' 2 '),
      ]),
    ).toEqual({
      status: 'ready',
      pendingBefore: 18,
      toReceive: 5,
      remainingAfter: 13,
      selectedLines: 2,
      totalLines: 3,
    });
  });

  it('permite completar partidas parcialmente y llegar a cero pendiente', () => {
    const result = calculateReceiptQuantitySummary([
      item(2, '2'),
      item(1, '1'),
    ]);
    expect(result.status).toBe('ready');
    expect(result.toReceive).toBe(3);
    expect(result.remainingAfter).toBe(0);
  });

  it('sin captura informa pendiente pero nunca simula que hay registro', () => {
    expect(
      calculateReceiptQuantitySummary([item(4, ''), item(3, '  ')]),
    ).toEqual({
      status: 'empty',
      pendingBefore: 7,
      toReceive: 0,
      remainingAfter: 7,
      selectedLines: 0,
      totalLines: 2,
    });
  });

  it.each(['0', '-1', '1.5', '7', 'abc', 'Infinity', 'NaN'])(
    'oculta ambos totales derivados si una cantidad está fuera de regla: %s',
    (quantityReceived) => {
      const result = calculateReceiptQuantitySummary([
        item(5, '2'),
        item(6, quantityReceived),
      ]);
      expect(result).toEqual({
        status: 'invalid',
        pendingBefore: 11,
        toReceive: null,
        remainingAfter: null,
        selectedLines: 2,
        totalLines: 2,
      });
    },
  );

  it('rechaza pendientes corruptos en vez de mostrar totales engañosos', () => {
    expect(
      calculateReceiptQuantitySummary([
        item(5, '2'),
        item(Number.NaN, ''),
      ]),
    ).toEqual({
      status: 'invalid',
      pendingBefore: null,
      toReceive: null,
      remainingAfter: null,
      selectedLines: 1,
      totalLines: 2,
    });
  });

  it('no permite que la suma exceda el rango de enteros seguros', () => {
    const result = calculateReceiptQuantitySummary([
      item(Number.MAX_SAFE_INTEGER, '2'),
      item(1, '1'),
    ]);
    expect(result.status).toBe('invalid');
    expect(result.pendingBefore).toBeNull();
    expect(result.toReceive).toBeNull();
    expect(result.remainingAfter).toBeNull();
  });

  it('conserva rango seguro en un conjunto sin filas', () => {
    expect(calculateReceiptQuantitySummary([])).toEqual({
      status: 'empty',
      pendingBefore: 0,
      toReceive: 0,
      remainingAfter: 0,
      selectedLines: 0,
      totalLines: 0,
    });
  });
});
