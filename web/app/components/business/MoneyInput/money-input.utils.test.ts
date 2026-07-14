import { describe, expect, it } from 'vitest';

import { normalizeMoneyInputValue } from './money-input.utils';

describe('normalizeMoneyInputValue', () => {
  it('mantiene un valor monetario válido', () => {
    expect(normalizeMoneyInputValue('100.50')).toBe('100.50');
  });

  it('normaliza la coma como separador decimal', () => {
    expect(normalizeMoneyInputValue('100,50')).toBe('100.50');
  });

  it('normaliza un valor pegado con símbolo y miles', () => {
    expect(normalizeMoneyInputValue('$1,000.00')).toBe(
      '1000.00',
    );
  });

  it('permite un valor vacío durante la edición', () => {
    expect(normalizeMoneyInputValue('')).toBe('');
  });

  it('rechaza caracteres inválidos', () => {
    expect(normalizeMoneyInputValue('abc')).toBeNull();
  });

  it('rechaza más decimales de los permitidos', () => {
    expect(
      normalizeMoneyInputValue('12.345', {
        maxDecimals: 2,
      }),
    ).toBeNull();
  });

  it('rechaza valores negativos por defecto', () => {
    expect(normalizeMoneyInputValue('-100')).toBeNull();
  });

  it('permite negativos cuando están habilitados', () => {
    expect(
      normalizeMoneyInputValue('-100.50', {
        allowNegative: true,
      }),
    ).toBe('-100.50');
  });
});