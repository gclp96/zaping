import type {
  SaleStatus,
  SaleStatusDescriptor,
} from './types';

const saleStatusDescriptors: Record<
  SaleStatus,
  SaleStatusDescriptor
> = {
  DRAFT: {
    label: 'Borrador',
    tone: 'warning',
  },

  CONFIRMED: {
    label: 'Confirmada',
    tone: 'success',
  },

  CANCELLED: {
    label: 'Cancelada',
    tone: 'danger',
  },
};

export function getSaleStatusDescriptor(
  status: SaleStatus,
): SaleStatusDescriptor {
  return saleStatusDescriptors[status];
}
