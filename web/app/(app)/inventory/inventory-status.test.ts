import { describe, expect, it } from 'vitest';

import { getInventoryStatusDescriptor } from './inventory-status';

describe('getInventoryStatusDescriptor', () => {
  it('devuelve Sin stock cuando el stock es cero', () => {
    expect(getInventoryStatusDescriptor(0, 5)).toEqual({
      status: 'OUT_OF_STOCK',
      label: 'Sin stock',
      tone: 'danger',
    });
  });

  it('considera una existencia negativa como Sin stock', () => {
    expect(getInventoryStatusDescriptor(-2, 5)).toEqual({
      status: 'OUT_OF_STOCK',
      label: 'Sin stock',
      tone: 'danger',
    });
  });

  it('devuelve Bajo stock cuando el stock es menor al mínimo', () => {
    expect(getInventoryStatusDescriptor(3, 5)).toEqual({
      status: 'LOW_STOCK',
      label: 'Bajo stock',
      tone: 'warning',
    });
  });

  it('devuelve Bajo stock cuando el stock es igual al mínimo', () => {
    expect(getInventoryStatusDescriptor(5, 5)).toEqual({
      status: 'LOW_STOCK',
      label: 'Bajo stock',
      tone: 'warning',
    });
  });

  it('devuelve En stock cuando supera el mínimo', () => {
    expect(getInventoryStatusDescriptor(10, 5)).toEqual({
      status: 'IN_STOCK',
      label: 'En stock',
      tone: 'success',
    });
  });
});