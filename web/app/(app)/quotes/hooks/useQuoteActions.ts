import { useRef, useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type { CreatedSale, Quote } from '../types';

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

  const [actionError, setActionError] =
    useState('');

  const [createdSale, setCreatedSale] =
    useState<CreatedSale | null>(null);

  const conversionInFlight = useRef(false);

  const [
    downloadingQuoteId,
    setDownloadingQuoteId,
  ] = useState<string | null>(null);

  function openApproveDialog(quote: Quote) {
    setActionError('');
    setQuoteToApprove(quote);
  }

  function closeApproveDialog() {
    if (approving) {
      return;
    }

    setQuoteToApprove(null);
    setActionError('');
  }

  function openCancelDialog(quote: Quote) {
    setActionError('');
    setQuoteToCancel(quote);
  }

  function closeCancelDialog() {
    if (cancelling) {
      return;
    }

    setQuoteToCancel(null);
    setActionError('');
  }

  function openConvertDialog(quote: Quote) {
    setActionError('');
    setQuoteToConvert(quote);
  }

  function closeConvertDialog() {
    if (converting) {
      return;
    }

    setQuoteToConvert(null);
    setActionError('');
  }

  function clearActionError() {
    setActionError('');
  }

  function closeCreatedSale() {
    setCreatedSale(null);
    setActionError('');
  }

  async function handleApproveQuote() {
    if (!quoteToApprove || approving) {
      return;
    }

    try {
      setApproving(true);
      setActionError('');

      await api.patch(
        `/quotes/${quoteToApprove.id}/approve`,
      );

      await onQuoteChanged();

      setQuoteToApprove(null);
    } catch (error: unknown) {

      setActionError(
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
    if (!quoteToCancel || cancelling) {
      return;
    }

    try {
      setCancelling(true);
      setActionError('');

      await api.patch(
        `/quotes/${quoteToCancel.id}/cancel`,
      );

      await onQuoteChanged();

      setQuoteToCancel(null);
    } catch (error: unknown) {

      setActionError(
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
    if (!quoteToConvert || conversionInFlight.current) {
      return;
    }

    conversionInFlight.current = true;

    try {
      setConverting(true);
      setActionError('');

      const response = await api.post<CreatedSale>(
        `/sales/from-quote/${quoteToConvert.id}`,
      );

      setQuoteToConvert(null);
      setCreatedSale({
        id: response.data.id,
        folio: response.data.folio,
      });

      try {
        await onQuoteChanged();
      } catch (error: unknown) {

        setActionError(
          getApiErrorMessage(
            error,
            'La venta se creó, pero no fue posible actualizar el estado de la cotización.',
          ),
        );
      }
    } catch (error: unknown) {

      setActionError(
        getApiErrorMessage(
          error,
          'No fue posible convertir la cotización en venta.',
        ),
      );
    } finally {
      conversionInFlight.current = false;
      setConverting(false);
    }
  }

  async function handleDownloadPdf(quote: Quote) {
    let fileUrl: string | null = null;

    try {
      setDownloadingQuoteId(quote.id);
      setActionError('');

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
    actionError,
    createdSale,

    openApproveDialog,
    closeApproveDialog,

    openCancelDialog,
    closeCancelDialog,

    openConvertDialog,
    closeConvertDialog,

    clearActionError,
    closeCreatedSale,

    handleApproveQuote,
    handleCancelQuote,
    handleConvertToSale,
    handleDownloadPdf,
  };
}
