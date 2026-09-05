import { describe, expect, it } from 'vitest';

import {
  compactReferenceId,
  formatMovementDate,
  getMovementTypeDescriptor,
  getReferenceTypeLabel,
  movementMatchesSearch,
  type InventoryMovement,
} from './inventory-ledger';

const movement = {
  movementType: 'IN',
  referenceType: 'PURCHASE_RECEIPT',
  referenceId: '658dc34b-1111-2222-3333-444444444444',
  notes: 'Recepción de material',
  product: {
    sku: 'MED-001',
    name: 'Sutura quirúrgica',
  },
} as InventoryMovement;

describe('inventory ledger helpers', () => {
  it.each([
    ['IN', 'Entrada', 'success'],
    ['OUT', 'Salida', 'danger'],
    ['ADJUSTMENT', 'Ajuste', 'warning'],
  ])('mapea %s a su etiqueta y tono', (type, label, tone) => {
    expect(getMovementTypeDescriptor(type)).toEqual(
      expect.objectContaining({ label, tone }),
    );
  });

  it('usa fallback neutral para un tipo de movimiento desconocido', () => {
    expect(getMovementTypeDescriptor('TRANSFER')).toEqual(
      expect.objectContaining({
        label: 'Otro (TRANSFER)',
        tone: 'neutral',
      }),
    );
  });

  it.each([
    ['PURCHASE_RECEIPT', 'Recepción de compra'],
    ['SALE', 'Venta'],
    ['PURCHASE', 'Compra'],
    [null, 'Movimiento manual'],
  ])('mapea la referencia %s', (type, label) => {
    expect(getReferenceTypeLabel(type)).toBe(label);
  });

  it('usa fallback neutral para una referencia desconocida', () => {
    expect(getReferenceTypeLabel('LEGACY_IMPORT')).toBe(
      'Otro origen (LEGACY_IMPORT)',
    );
  });

  it('compacta referencias largas y conserva las cortas', () => {
    expect(
      compactReferenceId('658dc34b-1111-2222-3333-444444444444'),
    ).toBe('658dc34b…');
    expect(compactReferenceId('ABC-123')).toBe('ABC-123');
  });

  it('formatea fechas válidas y tolera fechas inválidas', () => {
    expect(formatMovementDate('2026-08-20T18:00:00.000Z')).not.toBe(
      'Fecha no disponible',
    );
    expect(formatMovementDate('fecha-invalida')).toBe(
      'Fecha no disponible',
    );
  });

  it('busca sin distinguir mayúsculas ni espacios externos', () => {
    expect(movementMatchesSearch(movement, '  med-001  ')).toBe(true);
    expect(movementMatchesSearch(movement, 'QUIRÚRGICA')).toBe(true);
    expect(movementMatchesSearch(movement, 'recepción de compra')).toBe(true);
    expect(movementMatchesSearch(movement, '658DC34B')).toBe(true);
    expect(movementMatchesSearch(movement, 'sin coincidencia')).toBe(false);
  });
});
