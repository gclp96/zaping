export function getPurchaseReceiptInventoryHref(
  receiptId: string,
  receiptFolio: string,
): string {
  const searchParams = new URLSearchParams({
    tab: 'movements',
    referenceType: 'PURCHASE_RECEIPT',
    referenceId: receiptId,
    receiptFolio,
  });

  return `/inventory?${searchParams.toString()}`;
}

export function getPurchaseReceiptHref(receiptId: string): string {
  return `/purchase-receipts/${encodeURIComponent(receiptId)}`;
}
