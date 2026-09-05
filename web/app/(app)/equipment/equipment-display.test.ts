import { describe, expect, it } from 'vitest';

import {
  compactEquipmentReference,
  formatEquipmentDate,
  equipmentMatchesSearch,
  getEquipmentAvailabilityReasonLabel,
  getEquipmentConditionDescriptor,
  getEquipmentLifecycleDescriptor,
  getEquipmentOriginLabel,
  getEquipmentRetirementReasonLabel,
  isEquipmentProductEligible,
} from './equipment-display';

import type { EquipmentAsset, EquipmentProduct } from './types';

const equipment = {
  assetCode: 'EQ-000001',
  serialNumber: 'SN-MED-001',
  product: {
    name: 'Equipo de prueba',
    sku: 'EQP-001',
  },
} as EquipmentAsset;

describe('equipment display helpers', () => {
  it.each([
    ['ACTIVE', 'Activo', 'success'],
    ['RETIRED', 'Retirado', 'neutral'],
  ])('mapea lifecycle %s', (lifecycle, label, tone) => {
    expect(getEquipmentLifecycleDescriptor(lifecycle)).toEqual({
      label,
      tone,
    });
  });

  it.each([
    ['GOOD', 'Bueno', 'success'],
    ['INSPECTION_PENDING', 'Inspección pendiente', 'warning'],
    ['DAMAGED', 'Dañado', 'warning'],
    ['OUT_OF_SERVICE', 'Fuera de servicio', 'danger'],
  ])('mapea condición %s', (condition, label, tone) => {
    expect(getEquipmentConditionDescriptor(condition)).toEqual({
      label,
      tone,
    });
  });

  it.each([
    ['MANUAL', 'Registro manual'],
    ['PURCHASE_RECEIPT', 'Recepción de compra'],
    ['IMPORT', 'Importación'],
    ['INITIAL_MIGRATION', 'Migración inicial'],
  ])('mapea origen %s', (origin, label) => {
    expect(getEquipmentOriginLabel(origin)).toBe(label);
  });

  it('tolera valores desconocidos con fallbacks neutrales', () => {
    expect(getEquipmentLifecycleDescriptor('LEGACY')).toEqual({
      label: 'Otro (LEGACY)',
      tone: 'neutral',
    });
    expect(getEquipmentConditionDescriptor('UNKNOWN')).toEqual({
      label: 'Otra (UNKNOWN)',
      tone: 'neutral',
    });
    expect(getEquipmentOriginLabel('OTHER_SOURCE')).toBe(
      'Otro origen (OTHER_SOURCE)',
    );
    expect(getEquipmentAvailabilityReasonLabel('FUTURE_REASON')).toBe(
      'Otro motivo (FUTURE_REASON)',
    );
    expect(getEquipmentRetirementReasonLabel('LEGACY_REASON')).toBe(
      'Otro motivo (LEGACY_REASON)',
    );
  });

  it.each([
    ['RETIRED', 'Retirado'],
    ['INSPECTION_PENDING', 'Inspección pendiente'],
    ['DAMAGED', 'Dañado'],
    ['OUT_OF_SERVICE', 'Fuera de servicio'],
  ])('mapea motivo de no disponibilidad %s', (reason, label) => {
    expect(getEquipmentAvailabilityReasonLabel(reason)).toBe(label);
  });

  it.each([
    ['SOLD', 'Vendido'],
    ['LOST', 'Perdido'],
    ['DESTROYED', 'Destruido'],
    ['END_OF_LIFE', 'Fin de vida útil'],
    ['REPLACED', 'Reemplazado'],
    ['OTHER', 'Otro'],
  ])('mapea motivo de retiro %s', (reason, label) => {
    expect(getEquipmentRetirementReasonLabel(reason)).toBe(label);
  });

  it.each([
    '  eq-000001  ',
    'sn-med-001',
    'EQUIPO DE PRUEBA',
    'eqp-001',
  ])('busca sin distinguir mayúsculas ni espacios: %s', (search) => {
    expect(equipmentMatchesSearch(equipment, search)).toBe(true);
  });

  it('rechaza búsquedas sin coincidencia', () => {
    expect(equipmentMatchesSearch(equipment, 'otro equipo')).toBe(false);
  });

  it('compacta referencias largas y conserva las cortas', () => {
    expect(
      compactEquipmentReference('658dc34b-1111-2222-3333-444444444444'),
    ).toBe('658dc34b…');
    expect(compactEquipmentReference('ITEM-001')).toBe('ITEM-001');
  });

  it('formatea fechas válidas y tolera valores inválidos', () => {
    expect(formatEquipmentDate('2026-08-20T18:00:00.000Z')).not.toBe(
      'Fecha no disponible',
    );
    expect(formatEquipmentDate('fecha-invalida')).toBe(
      'Fecha no disponible',
    );
  });

  it.each([
    ['ASSET', true, true],
    ['ASSET', false, false],
    ['QUANTITY', true, false],
    ['SERIALIZED', true, false],
  ] as const)(
    'evalúa elegibilidad %s activo=%s',
    (inventoryTracking, isActive, expected) => {
      expect(
        isEquipmentProductEligible({
          inventoryTracking,
          isActive,
        } as EquipmentProduct),
      ).toBe(expected);
    },
  );
});
