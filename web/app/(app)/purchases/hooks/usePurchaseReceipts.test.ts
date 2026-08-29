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
  Purchase,
  PurchaseReceipt,
} from '../types';

import { usePurchaseReceipts } from './usePurchaseReceipts';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
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

const previousReceipt: PurchaseReceipt = {
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

const firstIdempotencyKey =
  '11111111-1111-4111-8111-111111111111';
const secondIdempotencyKey =
  '22222222-2222-4222-8222-222222222222';

function setupHook(
  purchaseReceipts: PurchaseReceipt[] = [
    previousReceipt,
  ],
  receiptHistoryReady = true,
) {
  const onReceiptCreated = vi
    .fn()
    .mockResolvedValue(undefined);

  const hook = renderHook(() =>
    usePurchaseReceipts({
      purchaseReceipts,
      receiptHistoryReady,
      onReceiptCreated,
    }),
  );

  return {
    ...hook,
    onReceiptCreated,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('usePurchaseReceipts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockReset();
    vi.spyOn(
      globalThis.crypto,
      'randomUUID',
    ).mockReturnValue(firstIdempotencyKey);

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    cleanup();
  });

  it('no abre la recepción si el historial no está disponible', () => {
    const { result } = setupHook([], false);

    let opened = true;

    act(() => {
      opened = result.current.openReceiptModal(purchase);
    });

    expect(opened).toBe(false);
    expect(result.current.purchaseToReceive).toBeNull();
    expect(result.current.receiptFormItems).toEqual([]);
    expect(
      globalThis.crypto.randomUUID,
    ).not.toHaveBeenCalled();
  });

  it('inicia con el formulario cerrado y vacío', () => {
    const { result } = setupHook();

    expect(
      result.current.purchaseToReceive,
    ).toBeNull();

    expect(
      result.current.receiptFormItems,
    ).toEqual([]);

    expect(result.current.receiptNotes).toBe('');
    expect(result.current.receiptSaving).toBe(false);
    expect(result.current.receiptFormError).toBe('');
    expect(result.current.createdReceipt).toBeNull();
  });

  it('calcula las cantidades recibidas y pendientes', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    expect(
      result.current.purchaseToReceive,
    ).toEqual(purchase);

    expect(result.current.receiptFormItems).toEqual([
      {
        purchaseItemId: 'purchase-item-1',
        productId: 'product-1',
        sku: 'MED-001',
        name: 'Producto médico',
        orderedQuantity: 10,
        receivedQuantity: 4,
        pendingQuantity: 6,
        quantityReceived: '',
        lotNumber: '',
        expirationDate: '',
      },
    ]);
  });

  it('excluye los productos recibidos completamente', () => {
    const completeReceipt: PurchaseReceipt = {
      ...previousReceipt,
      items: [
        {
          ...previousReceipt.items[0],
          quantityReceived: 10,
        },
      ],
    };

    const { result } = setupHook([
      completeReceipt,
    ]);

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    expect(
      result.current.receiptFormItems,
    ).toEqual([]);
  });

  it('muestra un error cuando no se captura ninguna cantidad', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(result.current.receiptFormError).toBe(
      'Captura la cantidad recibida de al menos un producto.',
    );

    expect(api.post).not.toHaveBeenCalled();
  });

  it('rechaza una cantidad mayor que la pendiente', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    act(() => {
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '7',
      );
    });

    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(result.current.receiptFormError).toBe(
      'La cantidad de Producto médico debe ser un entero entre 1 y 6.',
    );

    expect(api.post).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de caducidad sin número de lote', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    act(() => {
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '2',
      );

      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'expirationDate',
        '2029-06-30',
      );
    });

    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(result.current.receiptFormError).toBe(
      'Captura el número de lote de Producto médico para registrar su caducidad.',
    );

    expect(api.post).not.toHaveBeenCalled();
  });

  it('registra la recepción, conserva su identidad y reinicia el formulario', async () => {
    const { result, onReceiptCreated } =
      setupHook();

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'receipt-2',
        folio: 'RC-0002',
      },
    } as never);

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    act(() => {
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '2',
      );

      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'lotNumber',
        'LOTE-002',
      );

      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'expirationDate',
        '2029-06-30',
      );

      result.current.handleReceiptNotesChange(
        'Recepción desde prueba unitaria',
      );
    });

    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(api.post).toHaveBeenCalledWith(
      '/purchase-receipts',
      {
        purchaseId: 'purchase-1',
        notes: 'Recepción desde prueba unitaria',
        items: [
          {
            purchaseItemId: 'purchase-item-1',
            quantityReceived: 2,
            lotNumber: 'LOTE-002',
            expirationDate: '2029-06-30',
          },
        ],
      },
      {
        headers: {
          'Idempotency-Key':
            firstIdempotencyKey,
        },
      },
    );

    expect(
      globalThis.crypto.randomUUID,
    ).toHaveBeenCalledTimes(1);
    expect(
      api.post.mock.calls[0]?.[1],
    ).not.toHaveProperty('idempotencyKey');

    expect(
      onReceiptCreated,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.current.purchaseToReceive,
    ).toBeNull();

    expect(
      result.current.receiptFormItems,
    ).toEqual([]);

    expect(result.current.receiptNotes).toBe('');
    expect(result.current.receiptFormError).toBe('');
    expect(result.current.receiptSaving).toBe(false);
    expect(result.current.createdReceipt).toEqual({
      id: 'receipt-2',
      folio: 'RC-0002',
    });
  });

  it('reutiliza la misma clave al reintentar después de un error', async () => {
    const { result } = setupHook();

    vi.mocked(api.post)
      .mockRejectedValueOnce(
        new Error('Error transitorio'),
      )
      .mockResolvedValueOnce({
        data: {
          id: 'receipt-retry',
          folio: 'RC-RETRY',
        },
      } as never);

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    act(() => {
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '2',
      );
    });

    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(result.current.createdReceipt).toBeNull();
    expect(
      result.current.receiptFormItems[0].quantityReceived,
    ).toBe('2');

    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls[0]?.[2]).toEqual({
      headers: {
        'Idempotency-Key': firstIdempotencyKey,
      },
    });
    expect(api.post.mock.calls[1]?.[2]).toEqual({
      headers: {
        'Idempotency-Key': firstIdempotencyKey,
      },
    });
    expect(
      globalThis.crypto.randomUUID,
    ).toHaveBeenCalledTimes(1);
    expect(result.current.createdReceipt).toEqual({
      id: 'receipt-retry',
      folio: 'RC-RETRY',
    });
  });

  it('genera otra clave después de completar y abrir una nueva recepción', async () => {
    vi.mocked(globalThis.crypto.randomUUID)
      .mockReset()
      .mockReturnValueOnce(firstIdempotencyKey)
      .mockReturnValueOnce(secondIdempotencyKey);

    const { result } = setupHook();

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'receipt-success',
        folio: 'RC-SUCCESS',
      },
    } as never);

    act(() => {
      result.current.openReceiptModal(purchase);
    });
    act(() => {
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '2',
      );
    });
    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    act(() => {
      result.current.closeReceiptModal();
    });

    expect(result.current.createdReceipt).toBeNull();

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    expect(
      result.current.receiptFormItems[0].quantityReceived,
    ).toBe('');
    act(() => {
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '1',
      );
    });
    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(api.post.mock.calls[0]?.[2]).toEqual({
      headers: {
        'Idempotency-Key': firstIdempotencyKey,
      },
    });
    expect(api.post.mock.calls[1]?.[2]).toEqual({
      headers: {
        'Idempotency-Key': secondIdempotencyKey,
      },
    });
  });

  it('bloquea un segundo envío mientras el primero sigue pendiente', async () => {
    let resolvePost:
      | ((value: unknown) => void)
      | undefined;

    const pendingPost = new Promise((resolve) => {
      resolvePost = resolve;
    });

    vi.mocked(api.post).mockReturnValue(
      pendingPost as never,
    );

    const { result } = setupHook();

    act(() => {
      result.current.openReceiptModal(purchase);
    });
    act(() => {
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '2',
      );
    });

    let firstSubmission:
      | Promise<void>
      | undefined;
    let secondSubmission:
      | Promise<void>
      | undefined;

    act(() => {
      firstSubmission =
        result.current.handleCreateReceipt();
      secondSubmission =
        result.current.handleCreateReceipt();
    });

    expect(api.post).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePost?.({
        data: {
          id: 'receipt-pending',
          folio: 'RC-PENDING',
        },
      });

      await Promise.all([
        firstSubmission,
        secondSubmission,
      ]);
    });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(result.current.createdReceipt).toEqual({
      id: 'receipt-pending',
      folio: 'RC-PENDING',
    });
  });

  it('mantiene abierto el formulario cuando el backend falla', async () => {
    const { result, onReceiptCreated } =
      setupHook();

    vi.mocked(api.post).mockRejectedValue(
      new Error('Error del servidor'),
    );

    act(() => {
      result.current.openReceiptModal(purchase);
    });

    act(() => {
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '2',
      );
    });

    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(result.current.receiptFormError).toBe(
      'No fue posible registrar la recepción.',
    );

    expect(
      result.current.purchaseToReceive,
    ).toEqual(purchase);

    expect(
      result.current.receiptFormItems[0]
        .quantityReceived,
    ).toBe('2');

    expect(
      onReceiptCreated,
    ).not.toHaveBeenCalled();

    expect(result.current.receiptSaving).toBe(false);
    expect(result.current.createdReceipt).toBeNull();
  });

  it('descarta un intento cancelado y usa otra clave al reabrir', async () => {
    vi.mocked(globalThis.crypto.randomUUID)
      .mockReset()
      .mockReturnValueOnce(firstIdempotencyKey)
      .mockReturnValueOnce(secondIdempotencyKey);
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'receipt-after-cancel',
        folio: 'RC-AFTER-CANCEL',
      },
    } as never);

    const { result } = setupHook();

    act(() => {
      result.current.openReceiptModal(purchase);
      result.current.handleReceiptNotesChange('Intento cancelado');
      result.current.closeReceiptModal();
    });

    expect(result.current.purchaseToReceive).toBeNull();
    expect(result.current.receiptNotes).toBe('');

    act(() => {
      result.current.openReceiptModal(purchase);
      result.current.handleReceiptItemChange(
        'purchase-item-1',
        'quantityReceived',
        '1',
      );
    });

    await act(async () => {
      await result.current.handleCreateReceipt();
    });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0]?.[2]).toEqual({
      headers: {
        'Idempotency-Key': secondIdempotencyKey,
      },
    });
  });
});
