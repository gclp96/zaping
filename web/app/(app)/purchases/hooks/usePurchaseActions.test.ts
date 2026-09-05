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

import type { Purchase } from '../types';

import { usePurchaseActions } from './usePurchaseActions';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
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
  status: 'DRAFT',
  receiptProgress: {
    orderedUnits: 10,
    receivedUnits: 0,
    pendingUnits: 10,
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

function setupHook() {
  const onPurchaseChanged = vi
    .fn()
    .mockResolvedValue(undefined);

  const hook = renderHook(() =>
    usePurchaseActions({
      onPurchaseChanged,
    }),
  );

  return {
    ...hook,
    onPurchaseChanged,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let linkClickSpy: ReturnType<typeof vi.spyOn>;

const createObjectURLMock = vi.fn();
const revokeObjectURLMock = vi.fn();

describe('usePurchaseActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.get).mockReset();
    vi.mocked(api.patch).mockReset();

    createObjectURLMock.mockReset();
    revokeObjectURLMock.mockReset();

    Object.defineProperty(
      window.URL,
      'createObjectURL',
      {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
      },
    );

    Object.defineProperty(
      window.URL,
      'revokeObjectURL',
      {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
      },
    );

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    linkClickSpy = vi
      .spyOn(
        HTMLAnchorElement.prototype,
        'click',
      )
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    linkClickSpy.mockRestore();

    cleanup();
  });

  it('inicia sin compras seleccionadas ni acciones en curso', () => {
    const { result } = setupHook();

    expect(
      result.current.purchaseToApprove,
    ).toBeNull();

    expect(
      result.current.purchaseToCancel,
    ).toBeNull();

    expect(result.current.approving).toBe(false);
    expect(result.current.cancelling).toBe(false);

    expect(
      result.current.downloadingPurchaseId,
    ).toBeNull();
    expect(result.current.actionError).toBe('');
  });

  it('abre y cierra los diálogos de aprobación y cancelación', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openApproveDialog(purchase);
    });

    expect(
      result.current.purchaseToApprove,
    ).toEqual(purchase);

    act(() => {
      result.current.closeApproveDialog();
    });

    expect(
      result.current.purchaseToApprove,
    ).toBeNull();

    act(() => {
      result.current.openCancelDialog(purchase);
    });

    expect(
      result.current.purchaseToCancel,
    ).toEqual(purchase);

    act(() => {
      result.current.closeCancelDialog();
    });

    expect(
      result.current.purchaseToCancel,
    ).toBeNull();
  });

  it('aprueba una compra y actualiza la lista', async () => {
    const { result, onPurchaseChanged } =
      setupHook();

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        ...purchase,
        status: 'CONFIRMED',
      },
    } as never);

    act(() => {
      result.current.openApproveDialog(purchase);
    });

    await act(async () => {
      await result.current.handleApprovePurchase();
    });

    expect(api.patch).toHaveBeenCalledWith(
      '/purchases/purchase-1/approve',
    );

    expect(
      onPurchaseChanged,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.current.purchaseToApprove,
    ).toBeNull();

    expect(result.current.approving).toBe(false);
    expect(result.current.actionError).toBe('');
  });

  it('mantiene abierto el diálogo cuando falla la aprobación', async () => {
    const { result, onPurchaseChanged } =
      setupHook();

    vi.mocked(api.patch).mockRejectedValue(
      new Error('Error del servidor'),
    );

    act(() => {
      result.current.openApproveDialog(purchase);
    });

    await act(async () => {
      await result.current.handleApprovePurchase();
    });

    expect(
      result.current.purchaseToApprove,
    ).toEqual(purchase);

    expect(result.current.approving).toBe(false);

    expect(
      onPurchaseChanged,
    ).not.toHaveBeenCalled();

    expect(result.current.actionError).toBe(
      'No fue posible aprobar la compra.',
    );

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('cancela una compra y actualiza la lista', async () => {
    const { result, onPurchaseChanged } =
      setupHook();

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        ...purchase,
        status: 'CANCELLED',
      },
    } as never);

    act(() => {
      result.current.openCancelDialog(purchase);
    });

    await act(async () => {
      await result.current.handleCancelPurchase();
    });

    expect(api.patch).toHaveBeenCalledWith(
      '/purchases/purchase-1/cancel',
    );

    expect(
      onPurchaseChanged,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.current.purchaseToCancel,
    ).toBeNull();

    expect(result.current.cancelling).toBe(false);
    expect(result.current.actionError).toBe('');
  });

  it('mantiene abierto el diálogo cuando falla la cancelación', async () => {
    const { result, onPurchaseChanged } =
      setupHook();

    vi.mocked(api.patch).mockRejectedValue(
      new Error('Error del servidor'),
    );

    act(() => {
      result.current.openCancelDialog(purchase);
    });

    await act(async () => {
      await result.current.handleCancelPurchase();
    });

    expect(
      result.current.purchaseToCancel,
    ).toEqual(purchase);

    expect(result.current.cancelling).toBe(false);

    expect(
      onPurchaseChanged,
    ).not.toHaveBeenCalled();

    expect(result.current.actionError).toBe(
      'No fue posible cancelar la compra.',
    );

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('descarga el PDF y libera la URL temporal', async () => {
    const { result } = setupHook();

    const pdfBlob = new Blob(
      ['contenido del PDF'],
      {
        type: 'application/pdf',
      },
    );

    createObjectURLMock.mockReturnValue(
      'blob:purchase-pdf',
    );

    vi.mocked(api.get).mockResolvedValue({
      data: pdfBlob,
    } as never);

    await act(async () => {
      await result.current.handleDownloadPdf(
        purchase,
      );
    });

    expect(api.get).toHaveBeenCalledWith(
      '/purchases/purchase-1/pdf',
      {
        responseType: 'blob',
      },
    );

    expect(
      createObjectURLMock,
    ).toHaveBeenCalledWith(pdfBlob);

    expect(linkClickSpy).toHaveBeenCalledTimes(1);

    expect(
      revokeObjectURLMock,
    ).toHaveBeenCalledWith(
      'blob:purchase-pdf',
    );

    expect(
      result.current.downloadingPurchaseId,
    ).toBeNull();

    expect(result.current.actionError).toBe('');
  });

  it('muestra un error cuando falla la descarga del PDF', async () => {
    const { result } = setupHook();

    vi.mocked(api.get).mockRejectedValue(
      new Error('Error descargando PDF'),
    );

    await act(async () => {
      await result.current.handleDownloadPdf(
        purchase,
      );
    });

    expect(result.current.actionError).toBe(
      'No fue posible descargar el PDF.',
    );

    expect(
      createObjectURLMock,
    ).not.toHaveBeenCalled();

    expect(
      revokeObjectURLMock,
    ).not.toHaveBeenCalled();

    expect(linkClickSpy).not.toHaveBeenCalled();

    expect(
      result.current.downloadingPurchaseId,
    ).toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
