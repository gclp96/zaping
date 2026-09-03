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

import type { Product } from '../types';

import { useQuoteForm } from './useQuoteForm';

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

const products: Product[] = [
  {
    id: 'product-1',
    sku: 'MED-001',
    name: 'Producto médico',
    cost: 100,
    price: 125.5,
    stock: 20,
    minStock: 5,
    isActive: true,
  },
  {
    id: 'product-2',
    sku: 'MED-002',
    name: 'Segundo producto',
    cost: 150,
    price: 200,
    stock: 10,
    minStock: 3,
    isActive: true,
  },
  {
    id: 'product-3',
    sku: 'MED-003',
    name: 'Producto inactivo',
    cost: 200,
    price: 300,
    stock: 5,
    minStock: 2,
    isActive: false,
  },
];

function setupHook() {
  const onQuoteSaved = vi
    .fn()
    .mockResolvedValue(undefined);

  const hook = renderHook(() =>
    useQuoteForm({
      products,
      onQuoteSaved,
    }),
  );

  return {
    ...hook,
    onQuoteSaved,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('useQuoteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.post).mockReset();

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('inicia con el formulario cerrado y vacío', () => {
    const { result } = setupHook();

    expect(result.current.openModal).toBe(false);
    expect(result.current.saving).toBe(false);

    expect(result.current.customerId).toBe('');
    expect(
      result.current.selectedProductId,
    ).toBe('');

    expect(result.current.quantity).toBe('1');
    expect(result.current.price).toBe('');

    expect(result.current.items).toEqual([]);

    expect(result.current.subtotal).toBe(0);
    expect(result.current.iva).toBe(0);
    expect(result.current.total).toBe(0);

    expect(result.current.customerError).toBe('');
    expect(result.current.productError).toBe('');
    expect(result.current.itemsError).toBe('');
    expect(result.current.formError).toBe('');
  });

  it('abre el formulario de nueva cotización', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openCreateModal();
    });

    expect(result.current.openModal).toBe(true);
  });

  it('carga automáticamente el precio del producto seleccionado', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openCreateModal();

      result.current.handleSelectedProductChange(
        'product-1',
      );
    });

    expect(
      result.current.selectedProductId,
    ).toBe('product-1');

    expect(result.current.price).toBe('125.5');
  });

  it('agrega un producto y calcula subtotal, IVA y total', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openCreateModal();
    });

    act(() => {
      result.current.handleSelectedProductChange(
        'product-1',
      );

      result.current.handleFormQuantityChange('2');
    });

    act(() => {
      result.current.handleAddProduct();
    });

    expect(result.current.items).toEqual([
      {
        productId: 'product-1',
        productName: 'Producto médico',
        productSku: 'MED-001',
        quantity: 2,
        price: 125.5,
        subtotal: 251,
      },
    ]);

    expect(result.current.subtotal).toBe(251);
    expect(result.current.iva).toBe(40.16);
    expect(result.current.total).toBe(291.16);

    expect(
      result.current.selectedProductId,
    ).toBe('');

    expect(result.current.quantity).toBe('1');
    expect(result.current.price).toBe('');
  });

  it('rechaza un producto duplicado', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleSelectedProductChange(
        'product-1',
      );
    });

    act(() => {
      result.current.handleAddProduct();
    });

    act(() => {
      result.current.handleSelectedProductChange(
        'product-1',
      );
    });

    act(() => {
      result.current.handleAddProduct();
    });

    expect(result.current.items).toHaveLength(1);

    expect(result.current.productError).toBe(
      'El producto ya fue agregado a la cotización.',
    );
  });

  it('rechaza cantidad inválida al agregar un producto', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleSelectedProductChange(
        'product-1',
      );

      result.current.handleFormQuantityChange(
        '1.5',
      );
    });

    act(() => {
      result.current.handleAddProduct();
    });

    expect(result.current.items).toEqual([]);

    expect(result.current.productError).toBe(
      'La cantidad debe ser un número entero mayor o igual a uno.',
    );
  });

  it('rechaza un precio negativo al agregar un producto', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleSelectedProductChange(
        'product-1',
      );

      result.current.handleFormPriceChange('-10');
    });

    act(() => {
      result.current.handleAddProduct();
    });

    expect(result.current.items).toEqual([]);

    expect(result.current.productError).toBe(
      'El precio debe ser un número válido, no negativo y con máximo dos decimales.',
    );
  });

  it('muestra errores cuando intenta crear una cotización vacía', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.openCreateModal();
    });

    await act(async () => {
      await result.current.handleCreateQuote();
    });

    expect(result.current.customerError).toBe(
      'Selecciona un cliente.',
    );

    expect(result.current.itemsError).toBe(
      'Agrega al menos un producto.',
    );

    expect(api.post).not.toHaveBeenCalled();
  });

  it('crea la cotización con el payload correcto y limpia el formulario', async () => {
    const {
      result,
      onQuoteSaved,
    } = setupHook();

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'quote-1',
      },
    } as never);

    act(() => {
      result.current.openCreateModal();
    });

    act(() => {
      result.current.handleCustomerChange(
        'customer-1',
      );

      result.current.handleSelectedProductChange(
        'product-1',
      );

      result.current.handleFormQuantityChange('2');
    });

    act(() => {
      result.current.handleAddProduct();
    });

    await act(async () => {
      await result.current.handleCreateQuote();
    });

    expect(api.post).toHaveBeenCalledWith(
      '/quotes',
      {
        customerId: 'customer-1',
        items: [
          {
            productId: 'product-1',
            quantity: 2,
            price: 125.5,
          },
        ],
      },
    );

    expect(
      onQuoteSaved,
    ).toHaveBeenCalledTimes(1);

    expect(result.current.openModal).toBe(false);

    expect(result.current.customerId).toBe('');
    expect(result.current.items).toEqual([]);

    expect(result.current.subtotal).toBe(0);
    expect(result.current.iva).toBe(0);
    expect(result.current.total).toBe(0);

    expect(result.current.saving).toBe(false);
  });

  it('mantiene abierto el formulario cuando falla el backend', async () => {
    const {
      result,
      onQuoteSaved,
    } = setupHook();

    vi.mocked(api.post).mockRejectedValue(
      new Error('Error del servidor'),
    );

    act(() => {
      result.current.openCreateModal();
    });

    act(() => {
      result.current.handleCustomerChange(
        'customer-1',
      );

      result.current.handleSelectedProductChange(
        'product-1',
      );
    });

    act(() => {
      result.current.handleAddProduct();
    });

    await act(async () => {
      await result.current.handleCreateQuote();
    });

    expect(result.current.openModal).toBe(true);

    expect(
      onQuoteSaved,
    ).not.toHaveBeenCalled();

    expect(result.current.formError).toBe(
      'No fue posible crear la cotización.',
    );

    expect(result.current.items).toHaveLength(1);

    expect(result.current.saving).toBe(false);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(
      1,
    );
  });
});
