import type { PurchaseReceiptListItem, ReceiptUser } from './types';

const receiptDateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
});

const receiptMoneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

export function formatReceiptDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return receiptDateFormatter.format(date);
}

// Expiration is a calendar DATE, never a timestamp in the browser timezone.
export function formatReceiptExpirationDate(value: string): string {
  const day = value.slice(0, 10);
  const date = new Date(day + 'T00:00:00.000Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== day
  ) {
    return 'Fecha no disponible';
  }
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

export function formatReceiptMoney(value: number): string {
  return receiptMoneyFormatter.format(value);
}

export function getReceiptResponsibleLabel(user: ReceiptUser | null): string {
  if (!user) {
    return '—';
  }

  const name = `${user.firstName} ${user.lastName}`.trim();

  return name || user.email || '—';
}

export function receiptMatchesSearch(
  receipt: PurchaseReceiptListItem,
  search: string,
): boolean {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableValues = [
    receipt.folio,
    receipt.purchase.folio,
    receipt.purchase.supplier.name,
    receipt.receivedByUser?.firstName,
    receipt.receivedByUser?.lastName,
    receipt.receivedByUser?.email,
    ...receipt.items.flatMap((item) => [item.product.sku, item.product.name]),
  ];

  return searchableValues.some((value) =>
    value?.toLowerCase().includes(normalizedSearch),
  );
}
