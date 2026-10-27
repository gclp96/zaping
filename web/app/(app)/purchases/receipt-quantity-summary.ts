import type { PurchaseReceiptFormItem } from './types';

type QuantityFields = Pick<
  PurchaseReceiptFormItem,
  'pendingQuantity' | 'quantityReceived'
>;

export type ReceiptQuantitySummary =
  | {
      status: 'empty' | 'ready';
      pendingBefore: number;
      toReceive: number;
      remainingAfter: number;
      selectedLines: number;
      totalLines: number;
    }
  | {
      status: 'invalid';
      pendingBefore: number | null;
      toReceive: null;
      remainingAfter: null;
      selectedLines: number;
      totalLines: number;
    };

/**
 * Informational preview only: the receipt backend remains the authority.
 * Blank rows are skipped just as in usePurchaseReceipts.handleCreateReceipt.
 * No "will enter stock" totals are shown if one entered quantity is invalid.
 */
export function calculateReceiptQuantitySummary(
  items: readonly QuantityFields[],
): ReceiptQuantitySummary {
  let pendingBefore = 0;
  let toReceive = 0;
  let selectedLines = 0;
  let quantitiesValid = true;
  let pendingValid = true;

  for (const item of items) {
    const pending = item.pendingQuantity;
    const validPending = Number.isSafeInteger(pending) && pending >= 0;
    if (!validPending || !Number.isSafeInteger(pendingBefore + pending)) {
      pendingValid = false;
    } else if (pendingValid) {
      pendingBefore += pending;
    }

    const entered = item.quantityReceived.trim();
    if (!entered) continue;

    selectedLines += 1;
    const quantity = Number(entered);
    if (
      !validPending ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > pending ||
      !Number.isSafeInteger(toReceive + quantity)
    ) {
      quantitiesValid = false;
    } else if (quantitiesValid) {
      toReceive += quantity;
    }
  }

  if (!pendingValid || !quantitiesValid) {
    return {
      status: 'invalid',
      pendingBefore: pendingValid ? pendingBefore : null,
      toReceive: null,
      remainingAfter: null,
      selectedLines,
      totalLines: items.length,
    };
  }

  return {
    status: selectedLines === 0 ? 'empty' : 'ready',
    pendingBefore,
    toReceive,
    remainingAfter: pendingBefore - toReceive,
    selectedLines,
    totalLines: items.length,
  };
}
