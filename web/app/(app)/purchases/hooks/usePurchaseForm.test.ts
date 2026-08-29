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

import { usePurchaseForm } from './usePurchaseForm';

vi.mock('@/services/api', () => ({
  api: {
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

const product = {
  id: 'product-1',
  sku: 'MED-001',
  name: 'Producto médico',
  cost: 100,
  stock: 20,
  minStock: 5,
  price: 120,
  inventoryTracking: 'QUANTITY' as const,
  lotTracking: 'OPTIONAL' as const,
};

const draftPurchase = {
  id: 'purchase-1',
  folio: 'OC-0001',
  status: 'DRAFT',
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
  const onPurchaseSaved = vi
    .fn()
    .mockResolvedValue(undefined);

  const hook = renderHook(() =>
    usePurchaseForm({
      products: [product],
      onPurchaseSaved,
    }),
  );

  return {
    ...hook,
    onPurchaseSaved,
  };
}

describe('usePurchaseForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('inicia con el formulario cerrado y vacío', () => {
    const { result } = setupHook();

    expect(result.current.openModal).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.purchaseToEdit).toBeNull();

    expect(result.current.supplierId).toBe('');
    expect(result.current.selectedProductId).toBe('');
    expect(result.current.quantity).toBe('1');
    expect(result.current.items).toEqual([]);

    expect(result.current.subtotal).toBe(0);
    expect(result.current.iva).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it('abre el formulario para crear una compra', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openCreateModal();
    });

    expect(result.current.openModal).toBe(true);
    expect(result.current.purchaseToEdit).toBeNull();
    expect(result.current.quantity).toBe('1');
    expect(result.current.items).toEqual([]);
  });

  it('agrega un producto y calcula los totales', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openCreateModal();
    });

    act(() => {
      result.current.handleSupplierChange(
        'supplier-1',
      );

      result.current.handleSelectedProductChange(
        'product-1',
      );

      result.current.handleFormQuantityChange('3');
    });

    act(() => {
      result.current.handleAddProduct();
    });

    expect(result.current.items).toEqual([
      {
        productId: 'product-1',
        sku: 'MED-001',
        name: 'Producto médico',
        quantity: '3',
        unitCost: 100,
      },
    ]);

    expect(result.current.subtotal).toBe(300);
    expect(result.current.iva).toBe(48);
    expect(result.current.total).toBe(348);

    expect(
      result.current.selectedProductId,
    ).toBe('');

    expect(result.current.quantity).toBe('1');
  });

  it('carga una compra en borrador para edición', () => {
    const { result } = setupHook();

    act(() => {
      result.current.openEditModal(draftPurchase);
    });

    expect(result.current.openModal).toBe(true);

    expect(result.current.purchaseToEdit).toEqual(
      draftPurchase,
    );

    expect(result.current.supplierId).toBe(
      'supplier-1',
    );

    expect(result.current.items).toEqual([
      {
        productId: 'product-1',
        sku: 'MED-001',
        name: 'Producto médico',
        quantity: '10',
        unitCost: 100,
      },
    ]);

    expect(result.current.subtotal).toBe(1000);
    expect(result.current.iva).toBe(160);
    expect(result.current.total).toBe(1160);
  });

  it('muestra errores cuando se intenta guardar un formulario vacío', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.openCreateModal();
    });

    await act(async () => {
      await result.current.handleCreatePurchase();
    });

    expect(result.current.supplierError).toBe(
      'Selecciona un proveedor.',
    );

    expect(result.current.itemsError).toBe(
      'Agrega al menos un producto.',
    );

    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('crea una compra mediante POST y reinicia el formulario', async () => {
    const { result, onPurchaseSaved } =
      setupHook();

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'purchase-2',
        folio: 'OC-0002',
      },
    } as never);

    act(() => {
      result.current.openCreateModal();
    });

    act(() => {
      result.current.handleSupplierChange(
        'supplier-1',
      );

      result.current.handleSelectedProductChange(
        'product-1',
      );

      result.current.handleFormQuantityChange('3');
    });

    act(() => {
      result.current.handleAddProduct();
    });

    await act(async () => {
      await result.current.handleCreatePurchase();
    });

    expect(api.post).toHaveBeenCalledWith(
      '/purchases',
      {
        supplierId: 'supplier-1',
        items: [
          {
            productId: 'product-1',
            quantity: 3,
          },
        ],
      },
    );

    expect(onPurchaseSaved).toHaveBeenCalledTimes(1);

    expect(result.current.openModal).toBe(false);
    expect(result.current.purchaseToEdit).toBeNull();
    expect(result.current.supplierId).toBe('');
    expect(result.current.items).toEqual([]);
  });

  it('actualiza una compra en borrador mediante PATCH', async () => {
    const { result, onPurchaseSaved } =
      setupHook();

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        ...draftPurchase,
        total: 580,
      },
    } as never);

    act(() => {
      result.current.openEditModal(draftPurchase);
    });

    act(() => {
      result.current.handleItemQuantityChange(
        'product-1',
        '5',
      );
    });

    await act(async () => {
      await result.current.handleCreatePurchase();
    });

    expect(api.patch).toHaveBeenCalledWith(
      '/purchases/purchase-1',
      {
        supplierId: 'supplier-1',
        items: [
          {
            productId: 'product-1',
            quantity: 5,
          },
        ],
      },
    );

    expect(api.post).not.toHaveBeenCalled();
    expect(onPurchaseSaved).toHaveBeenCalledTimes(1);

    expect(result.current.openModal).toBe(false);
    expect(result.current.purchaseToEdit).toBeNull();
  });
});
