import { describe, expect, it } from 'vitest';

import {
  getPurchaseReceiptHref,
  getPurchaseReceiptInventoryHref,
} from './receipt-navigation';

describe('receipt navigation', () => {
  it('preserves the receipt-to-inventory query contract', () => {
    expect(
      getPurchaseReceiptInventoryHref('receipt-123', 'REC-000123'),
    ).toBe(
      '/inventory?tab=movements&referenceType=PURCHASE_RECEIPT&referenceId=receipt-123&receiptFolio=REC-000123',
    );
  });

  it('builds an encoded receipt detail path', () => {
    expect(getPurchaseReceiptHref('receipt/123')).toBe(
      '/purchase-receipts/receipt%2F123',
    );
  });
});
