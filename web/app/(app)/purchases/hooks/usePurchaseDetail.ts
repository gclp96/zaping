import { useRef, useState } from 'react';

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

export type PurchaseDetailLoadResult = {
  stale: boolean;
  inventoryMovements: InventoryMovement[];
  purchaseReceipts: PurchaseReceipt[];
  movementsError: string;
  receiptsError: string;
};

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
  const detailRequestVersion = useRef(0);

  function resetDetailData() {
    setInventoryMovements([]);
    setMovementsError('');

    setPurchaseReceipts([]);
    setReceiptsError('');
    setReceiptHistoryStatus('idle');
  }

  function closePurchaseDetail() {
    detailRequestVersion.current += 1;
    setPurchaseToView(null);
    resetDetailData();
  }

  async function loadPurchaseDetailData(
    purchase: Purchase,
  ): Promise<PurchaseDetailLoadResult> {
    const requestVersion =
      detailRequestVersion.current + 1;
    detailRequestVersion.current = requestVersion;

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

    if (requestVersion !== detailRequestVersion.current) {
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

    if (movementsResult.status === 'fulfilled') {
      setInventoryMovements(
        movementsResult.value.data,
      );
    } else {
      const error: unknown =
        movementsResult.reason;

      console.error(error);

      movementsError = getApiErrorMessage(
        error,
        'No fue posible cargar los movimientos de inventario.',
      );
      setMovementsError(movementsError);
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

      receiptsError = getApiErrorMessage(
        error,
        'No fue posible cargar las recepciones de la compra.',
      );
      setReceiptsError(receiptsError);
      setReceiptHistoryStatus('error');
    }

    setMovementsLoading(false);
    setReceiptsLoading(false);

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

  async function openPurchaseDetail(
    purchase: Purchase,
  ) {
    setPurchaseToView(purchase);
    await loadPurchaseDetailData(purchase);
  }

  async function preparePurchaseForReceipt(
    purchase: Purchase,
  ) {
    return loadPurchaseDetailData(purchase);
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
    preparePurchaseForReceipt,
  };
}
