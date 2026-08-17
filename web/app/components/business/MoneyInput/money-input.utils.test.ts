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

  it('permite conservar el separador decimal durante la edición', () => {
  expect(
    normalizeMoneyInputValue('12.'),
  ).toBe('12.');
});

it('normaliza un separador decimal inicial', () => {
  expect(
    normalizeMoneyInputValue('.'),
  ).toBe('0.');
});

it('elimina la moneda MXN de un valor pegado', () => {
  expect(
    normalizeMoneyInputValue('MXN 150.50'),
  ).toBe('150.50');
});

it('rechaza múltiples signos negativos', () => {
  expect(
    normalizeMoneyInputValue('--100', {
      allowNegative: true,
    }),
  ).toBeNull();
});

it('rechaza un signo negativo en una posición inválida', () => {
  expect(
    normalizeMoneyInputValue('10-0', {
      allowNegative: true,
    }),
  ).toBeNull();
});

it('trata maxDecimals negativo como cero', () => {
  expect(
    normalizeMoneyInputValue('12.1', {
      maxDecimals: -1,
    }),
  ).toBeNull();

  expect(
    normalizeMoneyInputValue('12', {
      maxDecimals: -1,
    }),
  ).toBe('12');
});

it('normaliza maxDecimals decimal a un entero', () => {
  expect(
    normalizeMoneyInputValue('12.34', {
      maxDecimals: 1.8,
    }),
  ).toBeNull();

  expect(
    normalizeMoneyInputValue('12.3', {
      maxDecimals: 1.8,
    }),
  ).toBe('12.3');
});

it('usa dos decimales cuando maxDecimals no es finito', () => {
  expect(
    normalizeMoneyInputValue('12.34', {
      maxDecimals: Number.NaN,
    }),
  ).toBe('12.34');

  expect(
    normalizeMoneyInputValue('12.345', {
      maxDecimals: Number.NaN,
    }),
  ).toBeNull();
});

it('usa dos decimales cuando maxDecimals es infinito', () => {
  expect(
    normalizeMoneyInputValue('12.34', {
      maxDecimals: Number.POSITIVE_INFINITY,
    }),
  ).toBe('12.34');

  expect(
    normalizeMoneyInputValue('12.345', {
      maxDecimals: Number.POSITIVE_INFINITY,
    }),
  ).toBeNull();
});
});