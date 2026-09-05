import { createHash } from 'node:crypto';

import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';

function normalizeOptionalText(value: string | undefined): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue || null;
}

function normalizeExpirationDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

export function createPurchaseReceiptRequestHash(
  dto: CreatePurchaseReceiptDto,
): string {
  const canonicalRequest = {
    purchaseId: dto.purchaseId,
    notes: normalizeOptionalText(dto.notes),
    items: dto.items
      .map((item) => ({
        purchaseItemId: item.purchaseItemId,
        quantityReceived: item.quantityReceived,
        lotNumber: normalizeOptionalText(item.lotNumber),
        expirationDate: normalizeExpirationDate(item.expirationDate),
      }))
      .sort((left, right) => {
        if (left.purchaseItemId < right.purchaseItemId) {
          return -1;
        }

        if (left.purchaseItemId > right.purchaseItemId) {
          return 1;
        }

        return 0;
      }),
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalRequest))
    .digest('hex');
}
