'use client';

import { useCallback, useEffect, useState } from 'react';

import type { PurchaseStatus } from '@/app/(app)/purchases/types';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

export type DashboardData = {
  totals: {
    quotes: number;
    purchases: number;
    sales: number;
  };
  lowStock: Array<{
    id: string;
    stock: number;
    minStock: number;
  }>;
};

export type HomeEquipment = {
  id: string;
  lifecycle: 'ACTIVE' | 'RETIRED' | string;
  condition: 'INSPECTION_PENDING' | string;
};

export type HomePurchase = {
  id: string;
  status: PurchaseStatus;
};

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

function createResourceState<T>(): ResourceState<T> {
  return {
    data: null,
    loading: true,
    error: '',
  };
}

export function useHomeData() {
  const [dashboardState, setDashboardState] = useState<
    ResourceState<DashboardData>
  >(() => createResourceState<DashboardData>());
  const [equipmentState, setEquipmentState] = useState<
    ResourceState<HomeEquipment[]>
  >(() => createResourceState<HomeEquipment[]>());
  const [purchasesState, setPurchasesState] = useState<
    ResourceState<HomePurchase[]>
  >(() => createResourceState<HomePurchase[]>());

  const loadDashboard = useCallback(async () => {
    setDashboardState((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    try {
      const response = await api.get<DashboardData>('/dashboard');
      setDashboardState({ data: response.data, loading: false, error: '' });
    } catch (error: unknown) {
      console.error(error);
      setDashboardState({
        data: null,
        loading: false,
        error: getApiErrorMessage(
          error,
          'No fue posible consultar las prioridades de inventario.',
        ),
      });
    }
  }, []);

  const loadEquipment = useCallback(async () => {
    setEquipmentState((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    try {
      const response = await api.get<HomeEquipment[]>('/equipment');
      setEquipmentState({ data: response.data, loading: false, error: '' });
    } catch (error: unknown) {
      console.error(error);
      setEquipmentState({
        data: null,
        loading: false,
        error: getApiErrorMessage(
          error,
          'No fue posible consultar los equipos pendientes.',
        ),
      });
    }
  }, []);

  const loadPurchases = useCallback(async () => {
    setPurchasesState((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    try {
      const response = await api.get<HomePurchase[]>('/purchases');
      setPurchasesState({ data: response.data, loading: false, error: '' });
    } catch (error: unknown) {
      console.error(error);
      setPurchasesState({
        data: null,
        loading: false,
        error: getApiErrorMessage(
          error,
          'No fue posible consultar las compras por recibir.',
        ),
      });
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() =>
      Promise.all([loadDashboard(), loadEquipment(), loadPurchases()]),
    );
  }, [loadDashboard, loadEquipment, loadPurchases]);

  const initialLoading =
    dashboardState.loading &&
    equipmentState.loading &&
    purchasesState.loading &&
    !dashboardState.data &&
    !equipmentState.data &&
    !purchasesState.data;
  const attentionUpdating =
    dashboardState.loading || equipmentState.loading || purchasesState.loading;
  const attentionHasErrors = Boolean(
    dashboardState.error || equipmentState.error || purchasesState.error,
  );

  return {
    dashboardState,
    equipmentState,
    purchasesState,
    loadDashboard,
    loadEquipment,
    loadPurchases,
    initialLoading,
    attentionUpdating,
    attentionHasErrors,
  };
}
