import type { StatusTone } from '@/app/components/business/StatusBadge';

export type InventoryStatus =
  | 'OUT_OF_STOCK'
  | 'LOW_STOCK'
  | 'IN_STOCK';

export interface InventoryStatusDescriptor {
  status: InventoryStatus;
  label: string;
  tone: StatusTone;
}

export function getInventoryStatusDescriptor(
  stock: number,
  minStock: number,
): InventoryStatusDescriptor {
  if (stock <= 0) {
    return {
      status: 'OUT_OF_STOCK',
      label: 'Sin stock',
      tone: 'danger',
    };
  }

  if (stock <= minStock) {
    return {
      status: 'LOW_STOCK',
      label: 'Bajo stock',
      tone: 'warning',
    };
  }

  return {
    status: 'IN_STOCK',
    label: 'En stock',
    tone: 'success',
  };
}