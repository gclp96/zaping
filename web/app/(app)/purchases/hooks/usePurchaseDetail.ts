import { useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type {
  InventoryMovement,
  Purchase,
  PurchaseReceipt,
} from '../types';

export function usePurchaseDetail() {
  const [purchaseToView, setPurchaseToView] =
    useState<Purchase | null>(null);

  const [inventoryMovements, setInventoryMovements] =
    useState<InventoryMovement[]>([]);

  const [purchaseReceipts, setPurchaseReceipts] =
    useState<PurchaseReceipt[]>([]);

  const [receiptsLoading, setReceiptsLoading] =
    useState(false);

  const [receiptsError, setReceiptsError] =
    useState('');

  const [movementsLoading, setMovementsLoading] =
    useState(false);

  const [movementsError, setMovementsError] =
    useState('');

  function resetDetailData() {
    setInventoryMovements([]);
    setMovementsError('');

    setPurchaseReceipts([]);
    setReceiptsError('');
  }

  function closePurchaseDetail() {
    setPurchaseToView(null);
    resetDetailData();
  }

  async function openPurchaseDetail(
    purchase: Purchase,
  ) {
    setPurchaseToView(purchase);
    resetDetailData();

    setMovementsLoading(true);
    setReceiptsLoading(true);

    const [movementsResult, receiptsResult] =
      await Promise.allSettled([
        api.get<InventoryMovement[]>(
          `/purchases/${purchase.id}/inventory-movements`,
        ),
        api.get<PurchaseReceipt[]>(
          `/purchase-receipts/purchase/${purchase.id}`,
        ),
      ]);

    if (movementsResult.status === 'fulfilled') {
      setInventoryMovements(
        movementsResult.value.data,
      );
    } else {
      const error: unknown =
        movementsResult.reason;

      console.error(error);

      setMovementsError(
        getApiErrorMessage(
          error,
          'No fue posible cargar los movimientos de inventario.',
        ),
      );
    }

    if (receiptsResult.status === 'fulfilled') {
      setPurchaseReceipts(
        receiptsResult.value.data,
      );
    } else {
      const error: unknown =
        receiptsResult.reason;

      console.error(error);

      setReceiptsError(
        getApiErrorMessage(
          error,
          'No fue posible cargar las recepciones de la compra.',
        ),
      );
    }

    setMovementsLoading(false);
    setReceiptsLoading(false);
  }

  return {
    purchaseToView,
    inventoryMovements,
    purchaseReceipts,

    receiptsLoading,
    receiptsError,

    movementsLoading,
    movementsError,

    openPurchaseDetail,
    closePurchaseDetail,
  };
}