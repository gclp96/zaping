import type { StatusTone } from '@/app/components/business/StatusBadge';

export type InventoryMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  price: number;
};

export type InventoryMovementProduct = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryId: string | null;
  barcode: string | null;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  inventoryTracking: 'QUANTITY' | 'SERIALIZED' | 'ASSET';
  lotTracking: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  createdAt: string;
  updatedAt: string;
};

export type InventoryMovement = {
  id: string;
  companyId: string;
  productId: string;
  batchId: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  balance: number | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdBy: string | null;
  unitCost: number | null;
  createdAt: string;
  product: InventoryMovementProduct;
};

type MovementTypeDescriptor = {
  label: string;
  tone: StatusTone;
  quantityClassName: string;
};

const movementTypeDescriptors: Record<
  InventoryMovementType,
  MovementTypeDescriptor
> = {
  IN: {
    label: 'Entrada',
    tone: 'success',
    quantityClassName: 'text-green-700',
  },
  OUT: {
    label: 'Salida',
    tone: 'danger',
    quantityClassName: 'text-red-700',
  },
  ADJUSTMENT: {
    label: 'Ajuste',
    tone: 'warning',
    quantityClassName: 'text-yellow-800',
  },
};

const referenceTypeLabels: Record<string, string> = {
  PURCHASE_RECEIPT: 'Recepción de compra',
  SALE: 'Venta',
  PURCHASE: 'Compra',
};

const movementDateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function getMovementTypeDescriptor(
  movementType: string,
): MovementTypeDescriptor {
  if (movementType in movementTypeDescriptors) {
    return movementTypeDescriptors[
      movementType as InventoryMovementType
    ];
  }

  return {
    label: `Otro (${movementType})`,
    tone: 'neutral',
    quantityClassName: 'text-gray-700',
  };
}

export function getReferenceTypeLabel(
  referenceType: string | null,
): string {
  if (!referenceType) {
    return 'Movimiento manual';
  }

  return referenceTypeLabels[referenceType] ?? `Otro origen (${referenceType})`;
}

export function compactReferenceId(referenceId: string): string {
  if (referenceId.length <= 12) {
    return referenceId;
  }

  return `${referenceId.slice(0, 8)}…`;
}

export function formatMovementDate(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return movementDateFormatter.format(date);
}

export function movementMatchesSearch(
  movement: InventoryMovement,
  search: string,
): boolean {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    movement.product.sku,
    movement.product.name,
    movement.referenceType,
    getReferenceTypeLabel(movement.referenceType),
    movement.referenceId,
    movement.notes,
  ].some((value) => value?.toLowerCase().includes(normalizedSearch));
}
