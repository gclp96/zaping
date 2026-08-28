import { describe, expect, it } from 'vitest';

import { canRegisterPurchaseReceipt } from './purchase-status';
import type { PurchaseStatus } from './types';

describe('canRegisterPurchaseReceipt', () => {
  it.each([
    ['DRAFT', false],
    ['CONFIRMED', true],
    ['PARTIALLY_RECEIVED', true],
    ['RECEIVED', false],
    ['CANCELLED', false],
  ] as Array<[PurchaseStatus, boolean]>)('returns %s eligibility as %s', (status, expected) => {
    expect(canRegisterPurchaseReceipt(status)).toBe(expected);
  });
});
