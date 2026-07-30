import type { PurchaseStatusDescriptor } from './types';

export function getPurchaseStatusDescriptor(
  status: string,
): PurchaseStatusDescriptor {
  if (status === 'CONFIRMED') {
    return {
      label: 'Confirmada',
      tone: 'success',
    };
  }

  if (status === 'PARTIALLY_RECEIVED') {
    return {
      label: 'Parcialmente recibida',
      tone: 'warning',
    };
  }

  if (status === 'RECEIVED') {
    return {
      label: 'Recibida',
      tone: 'success',
    };
  }

  if (status === 'CANCELLED') {
    return {
      label: 'Cancelada',
      tone: 'danger',
    };
  }

  if (status === 'DRAFT') {
    return {
      label: 'Borrador',
      tone: 'warning',
    };
  }

  return {
    label: status,
    tone: 'neutral',
  };
}