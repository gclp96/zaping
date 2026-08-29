import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { api } from '@/services/api';

import type {
  InventoryMovement,
  Purchase,
  PurchaseReceipt,
} from '../types';

import { usePurchaseDetail } from './usePurchaseDetail';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (
    _error: unknown,
    fallbackMessage: string,
  ) => fallbackMessage,
}));

const purchase: Purchase = {
  id: 'purchase-1',
  folio: 'OC-0001',
  status: 'CONFIRMED',
  subtotal: 1000,
  iva: 160,
  total: 1160,
  createdAt: '2026-07-30T18:00:00.000Z',
  supplier: {
    id: 'supplier-1',
    name: 'Proveedor médico',
  },
  items: [
    {
      id: 'purchase-item-1',
      productId: 'product-1',
      quantity: 10,
      price: 100,
      subtotal: 1000,
      product: {
        id: 'product-1',
        sku: 'MED-001',
        name: 'Producto médico',
      },
    },
  ],
};

const inventoryMovement: InventoryMovement = {
  id: 'movement-1',
  productId: 'product-1',
  movementType: 'IN',
  quantity: 4,
  balance: 24,
  unitCost: 100,
  referenceType: 'PURCHASE_RECEIPT',
  referenceId: 'receipt-1',
  notes: 'Recepción parcial',
  createdAt: '2026-07-30T19:00:00.000Z',
  product: {
    id: 'product-1',
    sku: 'MED-001',
    name: 'Producto médico',
  },
};

const purchaseReceipt: PurchaseReceipt = {
  id: 'receipt-1',
  purchaseId: 'purchase-1',
  folio: 'RC-0001',
  receivedAt: '2026-07-30T19:00:00.000Z',
  receivedBy: 'user-1',
  notes: 'Primera recepción parcial',
  receivedByUser: {
    id: 'user-1',
    firstName: 'Leonardo',
    lastName: 'Garnica',
    email: 'admin@example.com',
  },
  items: [
    {
      id: 'receipt-item-1',
      purchaseItemId: 'purchase-item-1',
      productId: 'product-1',
      quantityReceived: 4,
      lotNumber: 'LOTE-001',
      expirationDate:
        '2028-12-31T00:00:00.000Z',
      unitCost: 100,
      batchId: 'batch-1',
      product: {
        id: 'product-1',
        sku: 'MED-001',
        name: 'Producto médico',
      },
      batch: {
        id: 'batch-1',
        lotNumber: 'LOTE-001',
        expirationDate:
          '2028-12-31T00:00:00.000Z',
        initialQuantity: 4,
        availableQuantity: 4,
        unitCost: 100,
      },
    },
  ],
};

function configureSuccessfulRequests() {
  vi.mocked(api.get).mockImplementation(
    async (url) => {
      const endpoint = String(url);

      if (
        endpoint ===
        '/purchases/purchase-1/inventory-movements'
      ) {
        return {
          data: [inventoryMovement],
        } as never;
      }

      if (
        endpoint ===
        '/purchase-receipts/purchase/purchase-1'
      ) {
        return {
          data: [purchaseReceipt],
        } as never;
      }

      throw new Error(
        `Solicitud GET no configurada: ${endpoint}`,
      );
    },
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('usePurchaseDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockReset();

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('inicia sin compra, movimientos ni recepciones', () => {
    const { result } = renderHook(() =>
      usePurchaseDetail(),
    );

    expect(result.current.purchaseToView).toBeNull();

    expect(
      result.current.inventoryMovements,
    ).toEqual([]);

    expect(
      result.current.purchaseReceipts,
    ).toEqual([]);

    expect(result.current.movementsLoading).toBe(
      false,
    );

    expect(result.current.receiptsLoading).toBe(
      false,
    );

    expect(result.current.movementsError).toBe('');
    expect(result.current.receiptsError).toBe('');
    expect(result.current.receiptHistoryStatus).toBe(
      'idle',
    );
  });

  it('carga los movimientos y recepciones de una compra', async () => {
    configureSuccessfulRequests();

    const { result } = renderHook(() =>
      usePurchaseDetail(),
    );

    await act(async () => {
      await result.current.openPurchaseDetail(
        purchase,
      );
    });

    expect(result.current.purchaseToView).toEqual(
      purchase,
    );

    expect(
      result.current.inventoryMovements,
    ).toEqual([inventoryMovement]);

    expect(
      result.current.purchaseReceipts,
    ).toEqual([purchaseReceipt]);

    expect(api.get).toHaveBeenCalledWith(
      '/purchases/purchase-1/inventory-movements',
    );

    expect(api.get).toHaveBeenCalledWith(
      '/purchase-receipts/purchase/purchase-1',
    );

    expect(result.current.movementsLoading).toBe(
      false,
    );

    expect(result.current.receiptsLoading).toBe(
      false,
    );

    expect(result.current.movementsError).toBe('');
    expect(result.current.receiptsError).toBe('');
    expect(result.current.receiptHistoryStatus).toBe(
      'success',
    );
  });

  it('activa los estados de carga mientras obtiene el detalle', async () => {
    let resolveMovements:
      | ((value: unknown) => void)
      | undefined;

    let resolveReceipts:
      | ((value: unknown) => void)
      | undefined;

    const movementsPromise = new Promise(
      (resolve) => {
        resolveMovements = resolve;
      },
    );

    const receiptsPromise = new Promise(
      (resolve) => {
        resolveReceipts = resolve;
      },
    );

    vi.mocked(api.get).mockImplementation(
      (url) => {
        const endpoint = String(url);

        if (
          endpoint ===
          '/purchases/purchase-1/inventory-movements'
        ) {
          return movementsPromise as never;
        }

        if (
          endpoint ===
          '/purchase-receipts/purchase/purchase-1'
        ) {
          return receiptsPromise as never;
        }

        throw new Error(
          `Solicitud GET no configurada: ${endpoint}`,
        );
      },
    );

    const { result } = renderHook(() =>
      usePurchaseDetail(),
    );

    let openDetailPromise!: Promise<void>;

    act(() => {
      openDetailPromise =
        result.current.openPurchaseDetail(purchase);
    });

    expect(result.current.purchaseToView).toEqual(
      purchase,
    );

    expect(result.current.movementsLoading).toBe(
      true,
    );

    expect(result.current.receiptsLoading).toBe(
      true,
    );
    expect(result.current.receiptHistoryStatus).toBe(
      'loading',
    );

    await act(async () => {
      resolveMovements?.({
        data: [inventoryMovement],
      });

      resolveReceipts?.({
        data: [purchaseReceipt],
      });

      await openDetailPromise;
    });

    expect(result.current.movementsLoading).toBe(
      false,
    );

    expect(result.current.receiptsLoading).toBe(
      false,
    );
  });

  it('mantiene las recepciones cuando falla la carga de movimientos', async () => {
    vi.mocked(api.get).mockImplementation(
      async (url) => {
        const endpoint = String(url);

        if (
          endpoint ===
          '/purchases/purchase-1/inventory-movements'
        ) {
          throw new Error(
            'Error cargando movimientos',
          );
        }

        if (
          endpoint ===
          '/purchase-receipts/purchase/purchase-1'
        ) {
          return {
            data: [purchaseReceipt],
          } as never;
        }

        throw new Error(
          `Solicitud GET no configurada: ${endpoint}`,
        );
      },
    );

    const { result } = renderHook(() =>
      usePurchaseDetail(),
    );

    await act(async () => {
      await result.current.openPurchaseDetail(
        purchase,
      );
    });

    expect(
      result.current.inventoryMovements,
    ).toEqual([]);

    expect(
      result.current.purchaseReceipts,
    ).toEqual([purchaseReceipt]);

    expect(result.current.movementsError).toBe(
      'No fue posible cargar los movimientos de inventario.',
    );

    expect(result.current.receiptsError).toBe('');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(
      1,
    );
  });

  it('mantiene los movimientos cuando falla la carga de recepciones', async () => {
    vi.mocked(api.get).mockImplementation(
      async (url) => {
        const endpoint = String(url);

        if (
          endpoint ===
          '/purchases/purchase-1/inventory-movements'
        ) {
          return {
            data: [inventoryMovement],
          } as never;
        }

        if (
          endpoint ===
          '/purchase-receipts/purchase/purchase-1'
        ) {
          throw new Error(
            'Error cargando recepciones',
          );
        }

        throw new Error(
          `Solicitud GET no configurada: ${endpoint}`,
        );
      },
    );

    const { result } = renderHook(() =>
      usePurchaseDetail(),
    );

    await act(async () => {
      await result.current.openPurchaseDetail(
        purchase,
      );
    });

    expect(
      result.current.inventoryMovements,
    ).toEqual([inventoryMovement]);

    expect(
      result.current.purchaseReceipts,
    ).toEqual([]);

    expect(result.current.movementsError).toBe('');

    expect(result.current.receiptsError).toBe(
      'No fue posible cargar las recepciones de la compra.',
    );
    expect(result.current.receiptHistoryStatus).toBe(
      'error',
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(
      1,
    );
  });

  it('reintenta sólo el historial y vuelve a marcarlo como disponible', async () => {
    let receiptRequests = 0;

    vi.mocked(api.get).mockImplementation(
      async (url) => {
        const endpoint = String(url);

        if (
          endpoint ===
          '/purchases/purchase-1/inventory-movements'
        ) {
          return { data: [] } as never;
        }

        if (
          endpoint ===
          '/purchase-receipts/purchase/purchase-1'
        ) {
          receiptRequests += 1;

          if (receiptRequests === 1) {
            throw new Error('Error temporal');
          }

          return { data: [purchaseReceipt] } as never;
        }

        throw new Error(
          `Solicitud GET no configurada: ${endpoint}`,
        );
      },
    );

    const { result } = renderHook(() =>
      usePurchaseDetail(),
    );

    await act(async () => {
      await result.current.openPurchaseDetail(purchase);
    });

    expect(result.current.receiptHistoryStatus).toBe(
      'error',
    );
    expect(result.current.purchaseReceipts).toEqual([]);

    await act(async () => {
      await result.current.retryPurchaseReceipts();
    });

    expect(receiptRequests).toBe(2);
    expect(result.current.receiptHistoryStatus).toBe(
      'success',
    );
    expect(result.current.purchaseReceipts).toEqual([
      purchaseReceipt,
    ]);
  });

  it('cierra el detalle y limpia los datos cargados', async () => {
    configureSuccessfulRequests();

    const { result } = renderHook(() =>
      usePurchaseDetail(),
    );

    await act(async () => {
      await result.current.openPurchaseDetail(
        purchase,
      );
    });

    expect(result.current.purchaseToView).not.toBeNull();

    act(() => {
      result.current.closePurchaseDetail();
    });

    expect(result.current.purchaseToView).toBeNull();

    expect(
      result.current.inventoryMovements,
    ).toEqual([]);

    expect(
      result.current.purchaseReceipts,
    ).toEqual([]);

    expect(result.current.movementsError).toBe('');
    expect(result.current.receiptsError).toBe('');
    expect(result.current.receiptHistoryStatus).toBe(
      'idle',
    );
  });
});
