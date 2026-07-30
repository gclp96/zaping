import { useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type { Purchase } from '../types';

type UsePurchaseActionsParams = {
  onPurchaseChanged: () => Promise<void>;
};

export function usePurchaseActions({
  onPurchaseChanged,
}: UsePurchaseActionsParams) {
  const [purchaseToApprove, setPurchaseToApprove] =
    useState<Purchase | null>(null);

  const [purchaseToCancel, setPurchaseToCancel] =
    useState<Purchase | null>(null);

  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [
    downloadingPurchaseId,
    setDownloadingPurchaseId,
  ] = useState<string | null>(null);

  function openApproveDialog(purchase: Purchase) {
    setPurchaseToApprove(purchase);
  }

  function closeApproveDialog() {
    if (approving) {
      return;
    }

    setPurchaseToApprove(null);
  }

  function openCancelDialog(purchase: Purchase) {
    setPurchaseToCancel(purchase);
  }

  function closeCancelDialog() {
    if (cancelling) {
      return;
    }

    setPurchaseToCancel(null);
  }

  async function handleApprovePurchase() {
    if (!purchaseToApprove) {
      return;
    }

    try {
      setApproving(true);

      await api.patch(
        `/purchases/${purchaseToApprove.id}/approve`,
      );

      await onPurchaseChanged();

      setPurchaseToApprove(null);
    } catch (error: unknown) {
      console.error(error);

      window.alert(
        getApiErrorMessage(
          error,
          'No fue posible aprobar la compra.',
        ),
      );
    } finally {
      setApproving(false);
    }
  }

  async function handleCancelPurchase() {
    if (!purchaseToCancel) {
      return;
    }

    try {
      setCancelling(true);

      await api.patch(
        `/purchases/${purchaseToCancel.id}/cancel`,
      );

      await onPurchaseChanged();

      setPurchaseToCancel(null);
    } catch (error: unknown) {
      console.error(error);

      window.alert(
        getApiErrorMessage(
          error,
          'No fue posible cancelar la compra.',
        ),
      );
    } finally {
      setCancelling(false);
    }
  }

  async function handleDownloadPdf(
    purchase: Purchase,
  ) {
    let fileUrl: string | null = null;

    try {
      setDownloadingPurchaseId(purchase.id);

      const response = await api.get(
        `/purchases/${purchase.id}/pdf`,
        {
          responseType: 'blob',
        },
      );

      fileUrl = window.URL.createObjectURL(
        response.data as Blob,
      );

      const link = document.createElement('a');

      link.href = fileUrl;
      link.download = `compra-${purchase.folio}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: unknown) {
      console.error(error);

      window.alert(
        getApiErrorMessage(
          error,
          'No fue posible descargar el PDF.',
        ),
      );
    } finally {
      if (fileUrl) {
        window.URL.revokeObjectURL(fileUrl);
      }

      setDownloadingPurchaseId(null);
    }
  }

  return {
    purchaseToApprove,
    purchaseToCancel,

    approving,
    cancelling,
    downloadingPurchaseId,

    openApproveDialog,
    closeApproveDialog,

    openCancelDialog,
    closeCancelDialog,

    handleApprovePurchase,
    handleCancelPurchase,
    handleDownloadPdf,
  };
}