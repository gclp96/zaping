import { useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type { Quote } from '../types';

type UseQuoteActionsParams = {
  onQuoteChanged: () => Promise<void>;
};

export function useQuoteActions({
  onQuoteChanged,
}: UseQuoteActionsParams) {
  const [quoteToApprove, setQuoteToApprove] =
    useState<Quote | null>(null);

  const [quoteToCancel, setQuoteToCancel] =
    useState<Quote | null>(null);

  const [quoteToConvert, setQuoteToConvert] =
    useState<Quote | null>(null);

  const [approving, setApproving] = useState(false);

  const [cancelling, setCancelling] =
    useState(false);

  const [converting, setConverting] =
    useState(false);

  const [
    downloadingQuoteId,
    setDownloadingQuoteId,
  ] = useState<string | null>(null);

  function openApproveDialog(quote: Quote) {
    setQuoteToApprove(quote);
  }

  function closeApproveDialog() {
    if (approving) {
      return;
    }

    setQuoteToApprove(null);
  }

  function openCancelDialog(quote: Quote) {
    setQuoteToCancel(quote);
  }

  function closeCancelDialog() {
    if (cancelling) {
      return;
    }

    setQuoteToCancel(null);
  }

  function openConvertDialog(quote: Quote) {
    setQuoteToConvert(quote);
  }

  function closeConvertDialog() {
    if (converting) {
      return;
    }

    setQuoteToConvert(null);
  }

  async function handleApproveQuote() {
    if (!quoteToApprove) {
      return;
    }

    try {
      setApproving(true);

      await api.patch(
        `/quotes/${quoteToApprove.id}/approve`,
      );

      await onQuoteChanged();

      setQuoteToApprove(null);
    } catch (error: unknown) {
      console.error(error);

      window.alert(
        getApiErrorMessage(
          error,
          'No fue posible aprobar la cotización.',
        ),
      );
    } finally {
      setApproving(false);
    }
  }

  async function handleCancelQuote() {
    if (!quoteToCancel) {
      return;
    }

    try {
      setCancelling(true);

      await api.patch(
        `/quotes/${quoteToCancel.id}/cancel`,
      );

      await onQuoteChanged();

      setQuoteToCancel(null);
    } catch (error: unknown) {
      console.error(error);

      window.alert(
        getApiErrorMessage(
          error,
          'No fue posible cancelar la cotización.',
        ),
      );
    } finally {
      setCancelling(false);
    }
  }

  async function handleConvertToSale() {
    if (!quoteToConvert) {
      return;
    }

    try {
      setConverting(true);

      await api.post(
        `/sales/from-quote/${quoteToConvert.id}`,
      );

      await onQuoteChanged();

      setQuoteToConvert(null);
    } catch (error: unknown) {
      console.error(error);

      window.alert(
        getApiErrorMessage(
          error,
          'No fue posible convertir la cotización en venta.',
        ),
      );
    } finally {
      setConverting(false);
    }
  }

  async function handleDownloadPdf(quote: Quote) {
    let fileUrl: string | null = null;

    try {
      setDownloadingQuoteId(quote.id);

      const response = await api.get(
        `/quotes/${quote.id}/pdf`,
        {
          responseType: 'blob',
        },
      );

      fileUrl = window.URL.createObjectURL(
        response.data as Blob,
      );

      const link = document.createElement('a');

      link.href = fileUrl;
      link.download =
        `cotizacion-${quote.folio}.pdf`;

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

      setDownloadingQuoteId(null);
    }
  }

  return {
    quoteToApprove,
    quoteToCancel,
    quoteToConvert,

    approving,
    cancelling,
    converting,
    downloadingQuoteId,

    openApproveDialog,
    closeApproveDialog,

    openCancelDialog,
    closeCancelDialog,

    openConvertDialog,
    closeConvertDialog,

    handleApproveQuote,
    handleCancelQuote,
    handleConvertToSale,
    handleDownloadPdf,
  };
}