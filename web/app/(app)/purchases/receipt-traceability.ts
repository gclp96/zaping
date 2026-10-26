import type { PurchaseReceiptFormItem, ReceiptAuthority } from './types';

export function hasOptionalReceiptTraceability(
  authority: ReceiptAuthority | null,
  item: Pick<PurchaseReceiptFormItem, 'inventoryTracking'>,
): boolean {
  return authority === 'PHYSICAL' && item.inventoryTracking === 'QUANTITY';
}
