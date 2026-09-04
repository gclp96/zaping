import { act, cleanup, renderHook } from '@testing-library/react';

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

import { usePurchaseReceiptPreparation } from './usePurchaseReceiptPreparation';

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
  receiptProgress: {
    orderedUnits: 10,
    receivedUnits: 4,
    pendingUnits: 6,
    orderedLines: 1,
    completedLines: 0,
  },
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
        inventoryTracking: 'QUANTITY',
        lotTracking: 'OPTIONAL',
      },
    },
  ],
};

const secondPurchase: Purchase = {
  ...purchase,
  id: 'purchase-2',
  folio: 'OC-0002',
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
      expirationDate: '2028-12-31T00:00:00.000Z',
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
        expirationDate: '2028-12-31T00:00:00.000Z',
        initialQuantity: 4,
        availableQuantity: 4,
        unitCost: 100,
      },
    },
  ],
};

function configureSuccessfulRequests() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/purchases/purchase-1/inventory-movements') {
      return {
        data: [inventoryMovement],
      } as never;
    }

    if (endpoint === '/purchase-receipts/purchase/purchase-1') {
      return {
        data: [purchaseReceipt],
      } as never;
    }

    throw new Error(`Solicitud GET no configurada: ${endpoint}`);
  });
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('usePurchaseReceiptPreparation', () => {
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

  it('carga movimientos y recepciones para preparar una recepción segura', async () => {
    configureSuccessfulRequests();

    const { result } = renderHook(() => usePurchaseReceiptPreparation());

    let preparationResult:
      | Awaited<ReturnType<typeof result.current.preparePurchaseForReceipt>>
      | undefined;

    await act(async () => {
      preparationResult = await result.current.preparePurchaseForReceipt(
        purchase,
      );
    });

    expect(preparationResult).toEqual({
      stale: false,
      inventoryMovements: [inventoryMovement],
      purchaseReceipts: [purchaseReceipt],
      movementsError: '',
      receiptsError: '',
    });
    expect(api.get).toHaveBeenCalledWith(
      '/purchases/purchase-1/inventory-movements',
    );
    expect(api.get).toHaveBeenCalledWith(
      '/purchase-receipts/purchase/purchase-1',
    );
  });

  it('mantiene las recepciones disponibles cuando falla la carga de movimientos', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/purchases/purchase-1/inventory-movements') {
        throw new Error('Error cargando movimientos');
      }

      if (endpoint === '/purchase-receipts/purchase/purchase-1') {
        return {
          data: [purchaseReceipt],
        } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    const { result } = renderHook(() => usePurchaseReceiptPreparation());

    let preparationResult:
      | Awaited<ReturnType<typeof result.current.preparePurchaseForReceipt>>
      | undefined;

    await act(async () => {
      preparationResult = await result.current.preparePurchaseForReceipt(
        purchase,
      );
    });

    expect(preparationResult).toEqual({
      stale: false,
      inventoryMovements: [],
      purchaseReceipts: [purchaseReceipt],
      movementsError:
        'No fue posible cargar los movimientos de inventario.',
      receiptsError: '',
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('reporta como insegura la preparación cuando falla el historial de recepciones', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/purchases/purchase-1/inventory-movements') {
        return {
          data: [inventoryMovement],
        } as never;
      }

      if (endpoint === '/purchase-receipts/purchase/purchase-1') {
        throw new Error('Error cargando recepciones');
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    const { result } = renderHook(() => usePurchaseReceiptPreparation());

    let preparationResult:
      | Awaited<ReturnType<typeof result.current.preparePurchaseForReceipt>>
      | undefined;

    await act(async () => {
      preparationResult = await result.current.preparePurchaseForReceipt(
        purchase,
      );
    });

    expect(preparationResult).toEqual({
      stale: false,
      inventoryMovements: [inventoryMovement],
      purchaseReceipts: [],
      movementsError: '',
      receiptsError: 'No fue posible cargar las recepciones de la compra.',
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('marca una preparación como obsoleta cuando una solicitud posterior gana la carrera', async () => {
    let resolveFirstMovements: ((value: unknown) => void) | undefined;
    let resolveFirstReceipts: ((value: unknown) => void) | undefined;

    const firstMovementsPromise = new Promise((resolve) => {
      resolveFirstMovements = resolve;
    });
    const firstReceiptsPromise = new Promise((resolve) => {
      resolveFirstReceipts = resolve;
    });

    vi.mocked(api.get).mockImplementation((url) => {
      const endpoint = String(url);

      if (endpoint === '/purchases/purchase-1/inventory-movements') {
        return firstMovementsPromise as never;
      }

      if (endpoint === '/purchase-receipts/purchase/purchase-1') {
        return firstReceiptsPromise as never;
      }

      if (endpoint === '/purchases/purchase-2/inventory-movements') {
        return Promise.resolve({ data: [] }) as never;
      }

      if (endpoint === '/purchase-receipts/purchase/purchase-2') {
        return Promise.resolve({ data: [] }) as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    const { result } = renderHook(() => usePurchaseReceiptPreparation());

    const firstPreparation = result.current.preparePurchaseForReceipt(purchase);

    let secondPreparationResult:
      | Awaited<ReturnType<typeof result.current.preparePurchaseForReceipt>>
      | undefined;

    await act(async () => {
      secondPreparationResult =
        await result.current.preparePurchaseForReceipt(secondPurchase);
    });

    resolveFirstMovements?.({ data: [inventoryMovement] });
    resolveFirstReceipts?.({ data: [purchaseReceipt] });

    let firstPreparationResult:
      | Awaited<ReturnType<typeof result.current.preparePurchaseForReceipt>>
      | undefined;

    await act(async () => {
      firstPreparationResult = await firstPreparation;
    });

    expect(secondPreparationResult).toEqual({
      stale: false,
      inventoryMovements: [],
      purchaseReceipts: [],
      movementsError: '',
      receiptsError: '',
    });
    expect(firstPreparationResult).toEqual({
      stale: true,
      inventoryMovements: [],
      purchaseReceipts: [],
      movementsError: '',
      receiptsError: '',
    });
  });
});
