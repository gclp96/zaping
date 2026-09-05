import { useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type { Sale } from '../types';

type UseSaleActionsParams = {
  onSaleChanged: (saleId: string) => Promise<void>;
};

export function useSaleActions({
  onSaleChanged,
}: UseSaleActionsParams) {
  const [saleToApprove, setSaleToApprove] = useState<Sale | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);

  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [downloadingSaleId, setDownloadingSaleId] =
    useState<string | null>(null);

  const [actionError, setActionError] = useState('');

  function clearActionError() {
    setActionError('');
  }

  function openApproveDialog(sale: Sale) {
    setActionError('');
    setSaleToApprove(sale);
  }

  function closeApproveDialog() {
    if (approving) {
      return;
    }

    setSaleToApprove(null);
  }

  function openCancelDialog(sale: Sale) {
    setActionError('');
    setSaleToCancel(sale);
  }

  function closeCancelDialog() {
    if (cancelling) {
      return;
    }

    setSaleToCancel(null);
  }

  async function handleApproveSale() {
    if (!saleToApprove || approving) {
      return;
    }

    try {
      setApproving(true);
      setActionError('');

      await api.patch(`/sales/${saleToApprove.id}/approve`);
      await onSaleChanged(saleToApprove.id);

      setSaleToApprove(null);
    } catch (error: unknown) {
      setSaleToApprove(null);
      setActionError(
        getApiErrorMessage(
          error,
          'No fue posible aprobar la venta.',
        ),
      );
    } finally {
      setApproving(false);
    }
  }

  async function handleCancelSale() {
    if (!saleToCancel || cancelling) {
      return;
    }

    try {
      setCancelling(true);
      setActionError('');

      await api.patch(`/sales/${saleToCancel.id}/cancel`);
      await onSaleChanged(saleToCancel.id);

      setSaleToCancel(null);
    } catch (error: unknown) {
      setSaleToCancel(null);
      setActionError(
        getApiErrorMessage(
          error,
          'No fue posible cancelar la venta.',
        ),
      );
    } finally {
      setCancelling(false);
    }
  }

  async function handleDownloadPdf(sale: Sale) {
    let fileUrl: string | null = null;

    try {
      setDownloadingSaleId(sale.id);
      setActionError('');

      const response = await api.get(`/sales/${sale.id}/pdf`, {
        responseType: 'blob',
      });

      fileUrl = window.URL.createObjectURL(response.data as Blob);

      const link = document.createElement('a');

      link.href = fileUrl;
      link.download = `venta-${sale.folio}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: unknown) {
      setActionError(
        getApiErrorMessage(
          error,
          'No fue posible descargar el PDF.',
        ),
      );
    } finally {
      if (fileUrl) {
        window.URL.revokeObjectURL(fileUrl);
      }

      setDownloadingSaleId(null);
    }
  }

  return {
    saleToApprove,
    saleToCancel,
    approving,
    cancelling,
    downloadingSaleId,
    actionError,
    clearActionError,
    openApproveDialog,
    closeApproveDialog,
    openCancelDialog,
    closeCancelDialog,
    handleApproveSale,
    handleCancelSale,
    handleDownloadPdf,
  };
}
