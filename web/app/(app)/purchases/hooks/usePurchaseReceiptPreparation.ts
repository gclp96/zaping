import { useRef } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type {
  InventoryMovement,
  Purchase,
  PurchaseReceipt,
} from '../types';

export type PurchaseReceiptPreparationResult = {
  stale: boolean;
  inventoryMovements: InventoryMovement[];
  purchaseReceipts: PurchaseReceipt[];
  movementsError: string;
  receiptsError: string;
};

export function usePurchaseReceiptPreparation() {
  const requestVersion = useRef(0);

  async function preparePurchaseForReceipt(
    purchase: Purchase,
  ): Promise<PurchaseReceiptPreparationResult> {
    const currentRequestVersion = requestVersion.current + 1;
    requestVersion.current = currentRequestVersion;

    const [movementsResult, receiptsResult] =
      await Promise.allSettled([
        api.get<InventoryMovement[]>(
          `/purchases/${purchase.id}/inventory-movements`,
        ),
        api.get<PurchaseReceipt[]>(
          `/purchase-receipts/purchase/${purchase.id}`,
        ),
      ]);

    if (currentRequestVersion !== requestVersion.current) {
      return {
        stale: true,
        inventoryMovements: [],
        purchaseReceipts: [],
        movementsError: '',
        receiptsError: '',
      };
    }

    let movementsError = '';
    let receiptsError = '';

    if (movementsResult.status === 'rejected') {
      const error: unknown = movementsResult.reason;

      console.error(error);

      movementsError = getApiErrorMessage(
        error,
        'No fue posible cargar los movimientos de inventario.',
      );
    }

    if (receiptsResult.status === 'rejected') {
      const error: unknown = receiptsResult.reason;

      console.error(error);

      receiptsError = getApiErrorMessage(
        error,
        'No fue posible cargar las recepciones de la compra.',
      );
    }

    return {
      stale: false,
      inventoryMovements:
        movementsResult.status === 'fulfilled'
          ? movementsResult.value.data
          : [],
      purchaseReceipts:
        receiptsResult.status === 'fulfilled'
          ? receiptsResult.value.data
          : [],
      movementsError,
      receiptsError,
    };
  }

  return {
    preparePurchaseForReceipt,
  };
}
