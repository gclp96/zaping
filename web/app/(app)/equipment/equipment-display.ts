import type { StatusTone } from '@/app/components/business/StatusBadge';

import type { EquipmentAsset } from './types';

type EquipmentDescriptor = {
  label: string;
  tone: StatusTone;
};

const lifecycleDescriptors: Record<string, EquipmentDescriptor> = {
  ACTIVE: {
    label: 'Activo',
    tone: 'success',
  },
  RETIRED: {
    label: 'Retirado',
    tone: 'neutral',
  },
};

const conditionDescriptors: Record<string, EquipmentDescriptor> = {
  GOOD: {
    label: 'Bueno',
    tone: 'success',
  },
  INSPECTION_PENDING: {
    label: 'Inspección pendiente',
    tone: 'warning',
  },
  DAMAGED: {
    label: 'Dañado',
    tone: 'warning',
  },
  OUT_OF_SERVICE: {
    label: 'Fuera de servicio',
    tone: 'danger',
  },
};

const originLabels: Record<string, string> = {
  MANUAL: 'Registro manual',
  PURCHASE_RECEIPT: 'Recepción de compra',
  IMPORT: 'Importación',
  INITIAL_MIGRATION: 'Migración inicial',
};

const availabilityReasonLabels: Record<string, string> = {
  RETIRED: 'Retirado',
  INSPECTION_PENDING: 'Inspección pendiente',
  DAMAGED: 'Dañado',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

const equipmentDateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function getEquipmentLifecycleDescriptor(
  lifecycle: string,
): EquipmentDescriptor {
  return lifecycleDescriptors[lifecycle] ?? {
    label: `Otro (${lifecycle})`,
    tone: 'neutral',
  };
}

export function getEquipmentConditionDescriptor(
  condition: string,
): EquipmentDescriptor {
  return conditionDescriptors[condition] ?? {
    label: `Otra (${condition})`,
    tone: 'neutral',
  };
}

export function getEquipmentOriginLabel(origin: string): string {
  return originLabels[origin] ?? `Otro origen (${origin})`;
}

export function getEquipmentAvailabilityReasonLabel(
  reason: string,
): string {
  return availabilityReasonLabels[reason] ?? `Otro motivo (${reason})`;
}

export function formatEquipmentDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return equipmentDateFormatter.format(date);
}

export function compactEquipmentReference(referenceId: string): string {
  if (referenceId.length <= 12) {
    return referenceId;
  }

  return `${referenceId.slice(0, 8)}…`;
}

export function equipmentMatchesSearch(
  equipment: EquipmentAsset,
  search: string,
): boolean {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    equipment.assetCode,
    equipment.serialNumber,
    equipment.product.name,
    equipment.product.sku,
  ].some((value) => value?.toLowerCase().includes(normalizedSearch));
}

export function isEquipmentProductEligible(
  product: EquipmentAsset['product'],
): boolean {
  return product.isActive && product.inventoryTracking === 'ASSET';
}
