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

import type { Quote } from '../types';

import { useQuoteActions } from './useQuoteActions';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (
    _error: unknown,
    fallbackMessage: string,
  ) => fallbackMessage,
}));

const quote: Quote = {
  id: 'quote-1',
  companyId: 'company-1',
  customerId: 'customer-1',
  folio: 'COT-001',

  subtotal: 1000,
  iva: 160,
  total: 1160,

  status: 'DRAFT',
  convertedToSale: false,

  createdAt: '2026-08-13T18:00:00.000Z',
  updatedAt: '2026-08-13T18:00:00.000Z',

  customer: {
    id: 'customer-1',
    name: 'Hospital de prueba',
  },

  items: [
    {
      id: 'quote-item-1',
      productId: 'product-1',
      quantity: 2,
      price: 500,
      subtotal: 1000,
      product: {
        id: 'product-1',
        sku: 'MED-001',
        name: 'Producto médico',
      },
    },
  ],
};

const confirmedQuote: Quote = {
  ...quote,
  status: 'CONFIRMED',
};

function setupHook() {
  const onQuoteChanged = vi
    .fn()
    .mockResolvedValue(undefined);

  const hook = renderHook(() =>
    useQuoteActions({
      onQuoteChanged,
    }),
  );

  return {
    ...hook,
    onQuoteChanged,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let linkClickSpy: ReturnType<typeof vi.spyOn>;

const createObjectURLMock = vi.fn();
const revokeObjectURLMock = vi.fn();

describe('useQuoteActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
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

  it('inicia sin acciones seleccionadas', () => {
    const { result } = setupHook();

    expect(
      result.current.quoteToApprove,
    ).toBeNull();

    expect(
      result.current.quoteToCancel,
    ).toBeNull();

    expect(
      result.current.quoteToConvert,
    ).toBeNull();

    expect(result.current.approving).toBe(false);
    expect(result.current.cancelling).toBe(false);
    expect(result.current.converting).toBe(false);

    expect(
      result.current.downloadingQuoteId,
    ).toBeNull();

    expect(result.current.actionError).toBe('');
    expect(result.current.createdSale).toBeNull();
  });

  it('abre y cierra los diálogos de acciones', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openApproveDialog(quote);
    });

    expect(
      result.current.quoteToApprove,
    ).toEqual(quote);

    act(() => {
      result.current.closeApproveDialog();
    });

    expect(
      result.current.quoteToApprove,
    ).toBeNull();

    act(() => {
      result.current.openCancelDialog(quote);
    });

    expect(
      result.current.quoteToCancel,
    ).toEqual(quote);

    act(() => {
      result.current.closeCancelDialog();
    });

    expect(
      result.current.quoteToCancel,
    ).toBeNull();

    act(() => {
      result.current.openConvertDialog(
        confirmedQuote,
      );
    });

    expect(
      result.current.quoteToConvert,
    ).toEqual(confirmedQuote);

    act(() => {
      result.current.closeConvertDialog();
    });

    expect(
      result.current.quoteToConvert,
    ).toBeNull();
  });

  it('aprueba una cotización y actualiza la lista', async () => {
    const {
      result,
      onQuoteChanged,
    } = setupHook();

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        ...quote,
        status: 'CONFIRMED',
      },
    } as never);

    act(() => {
      result.current.openApproveDialog(quote);
    });

    await act(async () => {
      await result.current.handleApproveQuote();
    });

    expect(api.patch).toHaveBeenCalledWith(
      '/quotes/quote-1/approve',
    );

    expect(
      onQuoteChanged,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.current.quoteToApprove,
    ).toBeNull();

    expect(result.current.approving).toBe(false);
  });

  it('mantiene abierto el diálogo cuando falla la aprobación', async () => {
    const {
      result,
      onQuoteChanged,
    } = setupHook();

    vi.mocked(api.patch).mockRejectedValue(
      new Error('Error aprobando'),
    );

    act(() => {
      result.current.openApproveDialog(quote);
    });

    await act(async () => {
      await result.current.handleApproveQuote();
    });

    expect(
      result.current.quoteToApprove,
    ).toEqual(quote);

    expect(
      onQuoteChanged,
    ).not.toHaveBeenCalled();

    expect(result.current.actionError).toBe(
      'No fue posible aprobar la cotización.',
    );
  });

  it('cancela una cotización y actualiza la lista', async () => {
    const {
      result,
      onQuoteChanged,
    } = setupHook();

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        ...quote,
        status: 'CANCELLED',
      },
    } as never);

    act(() => {
      result.current.openCancelDialog(quote);
    });

    await act(async () => {
      await result.current.handleCancelQuote();
    });

    expect(api.patch).toHaveBeenCalledWith(
      '/quotes/quote-1/cancel',
    );

    expect(
      onQuoteChanged,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.current.quoteToCancel,
    ).toBeNull();

    expect(result.current.cancelling).toBe(false);
  });

  it('mantiene abierto el diálogo cuando falla la cancelación', async () => {
    const {
      result,
      onQuoteChanged,
    } = setupHook();

    vi.mocked(api.patch).mockRejectedValue(
      new Error('Error cancelando'),
    );

    act(() => {
      result.current.openCancelDialog(quote);
    });

    await act(async () => {
      await result.current.handleCancelQuote();
    });

    expect(
      result.current.quoteToCancel,
    ).toEqual(quote);

    expect(
      onQuoteChanged,
    ).not.toHaveBeenCalled();

    expect(result.current.actionError).toBe(
      'No fue posible cancelar la cotización.',
    );
  });

  it('convierte una cotización confirmada en venta y actualiza la lista', async () => {
    const {
      result,
      onQuoteChanged,
    } = setupHook();

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'sale-1',
        folio: 'V-000001',
      },
    } as never);

    act(() => {
      result.current.openConvertDialog(
        confirmedQuote,
      );
    });

    await act(async () => {
      await result.current.handleConvertToSale();
    });

    expect(api.post).toHaveBeenCalledWith(
      '/sales/from-quote/quote-1',
    );

    expect(
      onQuoteChanged,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.current.quoteToConvert,
    ).toBeNull();

    expect(result.current.converting).toBe(false);
    expect(result.current.createdSale).toEqual({
      id: 'sale-1',
      folio: 'V-000001',
    });
  });

  it('mantiene abierto el diálogo cuando falla la conversión', async () => {
    const {
      result,
      onQuoteChanged,
    } = setupHook();

    vi.mocked(api.post).mockRejectedValue(
      new Error('Stock insuficiente'),
    );

    act(() => {
      result.current.openConvertDialog(
        confirmedQuote,
      );
    });

    await act(async () => {
      await result.current.handleConvertToSale();
    });

    expect(
      result.current.quoteToConvert,
    ).toEqual(confirmedQuote);

    expect(
      onQuoteChanged,
    ).not.toHaveBeenCalled();

    expect(result.current.converting).toBe(false);

    expect(result.current.actionError).toBe(
      'No fue posible convertir la cotización en venta.',
    );
    expect(result.current.createdSale).toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(
      1,
    );
  });

  it('bloquea una segunda conversión mientras la primera sigue pendiente', async () => {
    const { result } = setupHook();
    let resolveRequest!: (value: unknown) => void;
    const request = new Promise((resolve) => {
      resolveRequest = resolve;
    });

    vi.mocked(api.post).mockReturnValue(request as never);

    act(() => {
      result.current.openConvertDialog(confirmedQuote);
    });

    let firstRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.handleConvertToSale();
      void result.current.handleConvertToSale();
    });

    expect(api.post).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({
        data: {
          id: 'sale-1',
          folio: 'V-000001',
        },
      });
      await firstRequest;
    });

    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('conserva el éxito cuando falla solo la recarga posterior', async () => {
    const { result, onQuoteChanged } = setupHook();

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'sale-1',
        folio: 'V-000001',
      },
    } as never);
    onQuoteChanged.mockRejectedValue(
      new Error('No fue posible recargar'),
    );

    act(() => {
      result.current.openConvertDialog(confirmedQuote);
    });

    await act(async () => {
      await result.current.handleConvertToSale();
    });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(result.current.quoteToConvert).toBeNull();
    expect(result.current.createdSale).toEqual({
      id: 'sale-1',
      folio: 'V-000001',
    });
    expect(result.current.actionError).toBe(
      'La venta se creó, pero no fue posible actualizar el estado de la cotización.',
    );

    act(() => {
      result.current.closeCreatedSale();
    });

    expect(result.current.createdSale).toBeNull();
    expect(result.current.actionError).toBe('');
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
      'blob:quote-pdf',
    );

    vi.mocked(api.get).mockResolvedValue({
      data: pdfBlob,
    } as never);

    await act(async () => {
      await result.current.handleDownloadPdf(
        quote,
      );
    });

    expect(api.get).toHaveBeenCalledWith(
      '/quotes/quote-1/pdf',
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
      'blob:quote-pdf',
    );

    expect(
      result.current.downloadingQuoteId,
    ).toBeNull();
  });

  it('muestra un error cuando falla la descarga del PDF', async () => {
    const { result } = setupHook();

    vi.mocked(api.get).mockRejectedValue(
      new Error('Error descargando PDF'),
    );

    await act(async () => {
      await result.current.handleDownloadPdf(
        quote,
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

    expect(
      result.current.downloadingQuoteId,
    ).toBeNull();
  });
});
