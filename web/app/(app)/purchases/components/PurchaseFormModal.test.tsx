import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import type {
  ComponentProps,
  ReactNode,
} from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  Product,
  PurchaseFormItem,
  Supplier,
} from '../types';
import PurchaseFormModal from './PurchaseFormModal';

vi.mock('@/app/components/ui/Modal', () => ({
  default: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

const supplier: Supplier = {
  id: 'supplier-1',
  name: 'Proveedor médico',
};

const product: Product = {
  id: 'product-1',
  sku: 'MED-001',
  name: 'Producto médico',
  cost: 100,
  stock: 20,
  minStock: 5,
  price: 120,
  inventoryTracking: 'QUANTITY',
  lotTracking: 'OPTIONAL',
};

const item: PurchaseFormItem = {
  productId: product.id,
  sku: product.sku,
  name: product.name,
  quantity: '3',
  unitCost: product.cost,
};

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function renderModal(
  overrides: Partial<ComponentProps<typeof PurchaseFormModal>> = {},
) {
  const props: ComponentProps<typeof PurchaseFormModal> = {
    isOpen: true,
    editing: false,
    saving: false,
    suppliers: [supplier],
    products: [product],
    supplierId: supplier.id,
    selectedProductId: '',
    quantity: '1',
    items: [item],
    supplierError: '',
    productError: '',
    quantityError: '',
    itemQuantityErrors: {},
    itemsError: '',
    subtotal: 300,
    iva: 48,
    total: 348,
    formatMoney,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    onAddProduct: vi.fn(),
    onRemoveItem: vi.fn(),
    onSupplierChange: vi.fn(),
    onSelectedProductChange: vi.fn(),
    onQuantityChange: vi.fn(),
    onItemQuantityChange: vi.fn(),
    ...overrides,
  };

  return render(<PurchaseFormModal {...props} />);
}

describe('PurchaseFormModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('organiza el formulario y mantiene tabla/editor con el mismo handler', () => {
    const onItemQuantityChange = vi.fn();
    const onRemoveItem = vi.fn();

    renderModal({
      itemQuantityErrors: {
        [item.productId]: 'La cantidad debe ser válida.',
      },
      itemsError: 'Corrige las cantidades antes de guardar.',
      onItemQuantityChange,
      onRemoveItem,
    });

    expect(
      screen.getByRole('heading', { name: 'Datos de la compra' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Agregar partida' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Partidas' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Resumen financiero' }),
    ).toBeTruthy();

    const table = screen.getByTestId('purchase-form-items-table');
    const mobileItems = screen.getByTestId('purchase-form-mobile-items');
    const mobileItem = screen.getByTestId(
      'purchase-form-mobile-item-product-1',
    );

    expect(table.classList.contains('md:block')).toBe(true);
    expect(mobileItems.classList.contains('md:hidden')).toBe(true);
    expect(mobileItems.classList.contains('overflow-x-auto')).toBe(false);
    expect(
      within(table)
        .getByRole('columnheader', { name: 'Producto' })
        .getAttribute('scope'),
    ).toBe('col');
    expect(
      within(mobileItem).getByRole('heading', {
        name: 'Producto médico',
      }),
    ).toBeTruthy();
    expect(within(mobileItem).getByText('SKU: MED-001')).toBeTruthy();

    const mobileQuantity = within(mobileItem).getByRole('spinbutton', {
      name: 'Cantidad de Producto médico',
    });
    fireEvent.change(mobileQuantity, { target: { value: '5' } });

    expect(onItemQuantityChange).toHaveBeenCalledWith('product-1', '5');
    expect(within(mobileItem).getByText('$100.00')).toBeTruthy();
    expect(within(mobileItem).getByText('$300.00')).toBeTruthy();

    fireEvent.click(
      within(screen.getByTestId('purchase-form-mobile-item-product-1')).getByRole(
        'button',
        { name: 'Quitar Producto médico' },
      ),
    );
    expect(onRemoveItem).toHaveBeenCalledWith('product-1');

    const footerAlert = within(
      screen.getByTestId('purchase-form-footer'),
    ).getByRole('alert');
    expect(footerAlert.textContent?.includes(
      'Corrige las cantidades antes de guardar.',
    )).toBe(true);
    expect(
      within(screen.getByTestId('purchase-form-footer')).getByRole(
        'button',
        { name: 'Crear compra' },
      ),
    ).toBeTruthy();
  });

  it('acerca el error de cantidad al campo del bloque de alta', () => {
    renderModal({
      items: [],
      quantityError: 'La cantidad debe ser un número entero mayor o igual a uno.',
    });

    const addItemSection = screen.getByTestId('purchase-form-add-item');
    const quantityInput = within(addItemSection).getByRole('spinbutton', {
      name: 'Cantidad',
    });

    expect(quantityInput.getAttribute('aria-invalid')).toBe('true');
    const quantityAlert = within(addItemSection).getByRole('alert');
    expect(quantityAlert.textContent?.includes(
      'La cantidad debe ser un número entero mayor o igual a uno.',
    )).toBe(true);
    const itemsSection = screen.getByTestId('purchase-form-items');
    expect(itemsSection.textContent?.includes('Selecciona un producto')).toBe(
      true,
    );
    expect(itemsSection.textContent?.includes('comenzar la compra')).toBe(
      true,
    );
  });

  it.each([
    { editing: false, title: 'Nueva compra', action: 'Crear compra' },
    { editing: true, title: 'Editar compra', action: 'Guardar cambios' },
  ])('preserva el modo $title y su CTA', ({ editing, title, action }) => {
    renderModal({ editing });

    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByRole('button', { name: action })).toBeTruthy();
  });
});
