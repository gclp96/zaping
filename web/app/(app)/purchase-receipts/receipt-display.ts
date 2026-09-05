import type {
  PurchaseReceiptListItem,
  ReceiptUser,
} from './types';

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

export function formatReceiptMoney(value: number): string {
  return receiptMoneyFormatter.format(value);
}

export function getReceiptResponsibleLabel(
  user: ReceiptUser | null,
): string {
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
    ...receipt.items.flatMap((item) => [
      item.product.sku,
      item.product.name,
    ]),
  ];

  return searchableValues.some((value) =>
    value?.toLowerCase().includes(normalizedSearch),
  );
}
