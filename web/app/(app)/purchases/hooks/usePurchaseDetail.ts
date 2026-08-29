import { useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type {
  InventoryMovement,
  Purchase,
  PurchaseReceipt,
} from '../types';

export type PurchaseReceiptHistoryStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error';

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

  const [receiptHistoryStatus, setReceiptHistoryStatus] =
    useState<PurchaseReceiptHistoryStatus>('idle');

  const [movementsLoading, setMovementsLoading] =
    useState(false);

  const [movementsError, setMovementsError] =
    useState('');

  function resetDetailData() {
    setInventoryMovements([]);
    setMovementsError('');

    setPurchaseReceipts([]);
    setReceiptsError('');
    setReceiptHistoryStatus('idle');
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
    setReceiptHistoryStatus('loading');

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
      setReceiptHistoryStatus('success');
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
      setReceiptHistoryStatus('error');
    }

    setMovementsLoading(false);
    setReceiptsLoading(false);
  }

  async function retryPurchaseReceipts() {
    if (!purchaseToView) {
      return;
    }

    setReceiptsLoading(true);
    setReceiptsError('');
    setReceiptHistoryStatus('loading');

    try {
      const response = await api.get<PurchaseReceipt[]>(
        `/purchase-receipts/purchase/${purchaseToView.id}`,
      );

      setPurchaseReceipts(response.data);
      setReceiptHistoryStatus('success');
    } catch (error: unknown) {
      console.error(error);

      setReceiptsError(
        getApiErrorMessage(
          error,
          'No fue posible cargar las recepciones de la compra.',
        ),
      );
      setReceiptHistoryStatus('error');
    } finally {
      setReceiptsLoading(false);
    }
  }

  return {
    purchaseToView,
    inventoryMovements,
    purchaseReceipts,

    receiptsLoading,
    receiptsError,
    receiptHistoryStatus,

    movementsLoading,
    movementsError,

    openPurchaseDetail,
    closePurchaseDetail,
    retryPurchaseReceipts,
  };
}
