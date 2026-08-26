import { useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type { Sale } from '../types';

export function useSaleDetail() {
  const [saleIdToView, setSaleIdToView] = useState<string | null>(null);
  const [saleToView, setSaleToView] = useState<Sale | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  async function loadSaleDetail(saleId: string) {
    try {
      setDetailLoading(true);
      setDetailError('');
      setSaleToView(null);

      const response = await api.get<Sale>(`/sales/${saleId}`);

      setSaleToView(response.data);
    } catch (error: unknown) {
      console.error(error);

      setDetailError(
        getApiErrorMessage(
          error,
          'No fue posible cargar el detalle de la venta.',
        ),
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function openSaleDetailById(saleId: string) {
    setSaleIdToView(saleId);
    await loadSaleDetail(saleId);
  }

  async function openSaleDetail(sale: Sale) {
    await openSaleDetailById(sale.id);
  }

  function closeSaleDetail() {
    setSaleIdToView(null);
    setSaleToView(null);
    setDetailError('');
    setDetailLoading(false);
  }

  function retrySaleDetail() {
    if (!saleIdToView) {
      return;
    }

    void loadSaleDetail(saleIdToView);
  }

  return {
    saleIdToView,
    saleToView,
    detailLoading,
    detailError,
    openSaleDetail,
    openSaleDetailById,
    closeSaleDetail,
    loadSaleDetail,
    retrySaleDetail,
  };
}
