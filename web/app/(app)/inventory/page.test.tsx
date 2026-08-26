import {
  cleanup,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { api } from '@/services/api';

import {
  formatMovementDate,
  type InventoryItem,
  type InventoryMovement,
  type InventoryMovementProduct,
} from './inventory-ledger';
import InventoryPage from './page';

const navigationMock = vi.hoisted(() => ({
  replace: vi.fn(),
  search: '',
}));

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMock,
  useSearchParams: () => new URLSearchParams(navigationMock.search),
}));

const inventory: InventoryItem[] = [
  {
    id: 'product-normal',
    sku: 'MED-001',
    name: 'Sutura quirúrgica',
    stock: 10,
    minStock: 5,
    price: 250,
  },
  {
    id: 'product-low',
    sku: 'LF1837',
    name: 'BLUNT TIP',
    stock: 2,
    minStock: 2,
    price: 150,
  },
  {
    id: 'product-empty',
    sku: 'ZERO-001',
    name: 'Producto agotado',
    stock: 0,
    minStock: 1,
    price: 80,
  },
];

function buildProduct(
  overrides: Partial<InventoryMovementProduct> = {},
): InventoryMovementProduct {
  return {
    id: 'product-normal',
    companyId: 'company-1',
    sku: 'MED-001',
    name: 'Sutura quirúrgica',
    description: null,
    brand: 'Marca médica',
    categoryId: null,
    barcode: null,
    cost: 100,
    price: 250,
    stock: 10,
    minStock: 5,
    isActive: true,
    inventoryTracking: 'QUANTITY',
    lotTracking: 'OPTIONAL',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-20T18:00:00.000Z',
    ...overrides,
  };
}

const purchaseReceiptMovement: InventoryMovement = {
  id: 'movement-receipt',
  companyId: 'company-1',
  productId: 'product-normal',
  batchId: null,
  movementType: 'IN',
  quantity: 12,
  balance: 20,
  referenceType: 'PURCHASE_RECEIPT',
  referenceId: '658dc34b-1111-2222-3333-444444444444',
  notes: 'Recepción REC-000001 de compra OC-000001',
  createdBy: 'user-1',
  unitCost: 100,
  createdAt: '2026-08-20T18:00:00.000Z',
  product: buildProduct(),
};

const saleMovement: InventoryMovement = {
  ...purchaseReceiptMovement,
  id: 'movement-sale',
  productId: 'product-low',
  movementType: 'OUT',
  quantity: 1,
  balance: 49,
  referenceType: 'SALE',
  referenceId: 'sale-12345678-1111-2222-3333-444444444444',
  notes: 'Venta V-000001',
  createdAt: '2026-08-19T18:00:00.000Z',
  product: buildProduct({
    id: 'product-low',
    sku: 'LF1837',
    name: 'BLUNT TIP',
  }),
};

const purchaseMovement: InventoryMovement = {
  ...purchaseReceiptMovement,
  id: 'movement-purchase',
  quantity: 5,
  balance: 25,
  referenceType: 'PURCHASE',
  referenceId: 'purchase-1',
  notes: 'Compra histórica',
  createdAt: '2026-08-18T18:00:00.000Z',
};

const adjustmentMovement: InventoryMovement = {
  ...purchaseReceiptMovement,
  id: 'movement-adjustment',
  movementType: 'ADJUSTMENT',
  quantity: 7,
  balance: 7,
  referenceType: null,
  referenceId: null,
  notes: null,
  createdAt: '2026-08-17T18:00:00.000Z',
  product: buildProduct({
    id: 'product-empty',
    sku: 'ZERO-001',
    name: 'Producto agotado',
  }),
};

const movements = [
  purchaseReceiptMovement,
  saleMovement,
  purchaseMovement,
  adjustmentMovement,
];

function configureApiMocks({
  inventoryData = inventory,
  movementData = movements,
  inventoryError,
  movementError,
}: {
  inventoryData?: InventoryItem[];
  movementData?: InventoryMovement[];
  inventoryError?: Error;
  movementError?: Error;
} = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/inventory') {
      if (inventoryError) {
        throw inventoryError;
      }

      return { data: inventoryData } as never;
    }

    if (endpoint === '/inventory/movements') {
      if (movementError) {
        throw movementError;
      }

      return { data: movementData } as never;
    }

    throw new Error(`Solicitud GET no configurada: ${endpoint}`);
  });
}

async function openMovementsView() {
  const user = userEvent.setup();

  render(<InventoryPage />);
  await screen.findByText('MED-001');
  await user.click(
    screen.getByRole('tab', {
      name: 'Movimientos',
    }),
  );

  return user;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMock.search = '';
    configureApiMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('carga ambos contratos y conserva Existencias como vista inicial', async () => {
    render(<InventoryPage />);

    expect(screen.getByText('Cargando existencias...')).toBeTruthy();
    expect(
      screen.getByRole('tab', {
        name: 'Existencias',
      }).getAttribute('aria-selected'),
    ).toBe('true');

    const skuCell = await screen.findByText('MED-001');
    const row = skuCell.closest('tr');
    expect(row).toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText('Sutura quirúrgica'))
      .toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText('10')).toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText('5')).toBeTruthy();
    expect(screen.getByLabelText(/BLUNT TIP: Bajo stock/i)).toBeTruthy();
    expect(screen.getByLabelText(/Producto agotado: Sin stock/i)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/inventory');
    expect(api.get).toHaveBeenCalledWith('/inventory/movements');
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button', { name: /ajustar stock/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /nuevo movimiento/i })).toBeNull();
  });

  it('muestra el ledger completo con tipos, cantidades, balances y referencias', async () => {
    await openMovementsView();

    expect(
      screen.getByRole('tab', {
        name: 'Movimientos',
      }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByText(formatMovementDate(purchaseReceiptMovement.createdAt)))
      .toBeTruthy();
    expect(screen.getAllByText('Sutura quirúrgica').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MED-001').length).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText('Tipo de movimiento: Entrada'),
    ).toHaveLength(2);
    expect(screen.getByLabelText('Tipo de movimiento: Salida')).toBeTruthy();
    expect(screen.getByLabelText('Tipo de movimiento: Ajuste')).toBeTruthy();
    expect(screen.getByLabelText('Entrada: 12 unidades')).toBeTruthy();
    expect(screen.getByLabelText('Salida: 1 unidad')).toBeTruthy();
    expect(screen.getByText('49')).toBeTruthy();
    expect(screen.getByText('Recepción de compra')).toBeTruthy();
    expect(screen.getByText('Venta')).toBeTruthy();
    expect(screen.getByText('Compra')).toBeTruthy();
    expect(screen.getByText('Movimiento manual')).toBeTruthy();
    expect(screen.getByText('ID 658dc34b…')).toBeTruthy();
    expect(
      screen.getByLabelText(
        `Identificador de referencia: ${purchaseReceiptMovement.referenceId}`,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Venta V-000001')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('filtra por búsqueda normalizada y por tipo de movimiento', async () => {
    const user = await openMovementsView();
    const search = screen.getByRole('searchbox', {
      name: 'Buscar movimientos',
    });

    await user.type(search, '  blunt tip  ');

    expect(screen.getByText('LF1837')).toBeTruthy();
    expect(screen.queryByText('ZERO-001')).toBeNull();

    await user.clear(search);
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: 'Tipo de movimiento',
      }),
      'ADJUSTMENT',
    );

    expect(screen.getByText('ZERO-001')).toBeTruthy();
    expect(screen.queryByText('LF1837')).toBeNull();
  });

  it('distingue vacío total de filtros sin coincidencias', async () => {
    const { unmount } = render(<InventoryPage />);
    const user = userEvent.setup();

    await screen.findByText('MED-001');
    await user.click(screen.getByRole('tab', { name: 'Movimientos' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar movimientos' }),
      'sin-coincidencias',
    );

    expect(screen.getByText('Sin movimientos coincidentes')).toBeTruthy();

    unmount();
    cleanup();
    vi.clearAllMocks();
    configureApiMocks({ movementData: [] });
    render(<InventoryPage />);
    await screen.findByText('MED-001');
    await user.click(screen.getByRole('tab', { name: 'Movimientos' }));

    expect(screen.getByText('Sin movimientos de inventario')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar movimientos')).toBeNull();
  });

  it('mantiene movimientos utilizables si falla Existencias y permite reintentar', async () => {
    let inventoryAttempts = 0;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/inventory') {
        inventoryAttempts += 1;

        if (inventoryAttempts === 1) {
          throw new Error('Existencias no disponibles');
        }

        return { data: inventory } as never;
      }

      if (endpoint === '/inventory/movements') {
        return { data: movements } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    const user = userEvent.setup();
    render(<InventoryPage />);

    expect(await screen.findByText('Existencias no disponibles')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Movimientos' }));
    expect(screen.getByText('Venta V-000001')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Existencias' }));
    await user.click(
      screen.getByRole('button', {
        name: 'Reintentar existencias',
      }),
    );

    expect(await screen.findByText('MED-001')).toBeTruthy();
    expect(inventoryAttempts).toBe(2);
  });

  it('mantiene Existencias si falla el ledger y permite reintentar movimientos', async () => {
    let movementAttempts = 0;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/inventory') {
        return { data: inventory } as never;
      }

      if (endpoint === '/inventory/movements') {
        movementAttempts += 1;

        if (movementAttempts === 1) {
          throw new Error('Movimientos no disponibles');
        }

        return { data: movements } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    const user = userEvent.setup();
    render(<InventoryPage />);

    expect(await screen.findByText('MED-001')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Movimientos' }));
    expect(await screen.findByText('Movimientos no disponibles')).toBeTruthy();
    await user.click(
      screen.getByRole('button', {
        name: 'Reintentar movimientos',
      }),
    );

    expect(await screen.findByText('Venta V-000001')).toBeTruthy();
    expect(movementAttempts).toBe(2);
  });

  it('abre Movimientos desde query y conserva sólo la coincidencia exacta de recepción', async () => {
    const otherReceiptMovement: InventoryMovement = {
      ...purchaseReceiptMovement,
      id: 'movement-other-receipt',
      referenceId: `${purchaseReceiptMovement.referenceId}-suffix`,
      notes: 'Otra recepción con referencia parecida',
    };
    navigationMock.search = new URLSearchParams({
      tab: 'movements',
      referenceType: 'PURCHASE_RECEIPT',
      referenceId: purchaseReceiptMovement.referenceId!,
      receiptFolio: 'REC-000001',
    }).toString();
    configureApiMocks({
      movementData: [
        purchaseReceiptMovement,
        otherReceiptMovement,
        saleMovement,
        purchaseMovement,
      ],
    });

    render(<InventoryPage />);

    expect(
      screen.getByRole('tab', { name: 'Movimientos' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
    expect(
      await screen.findByText('Movimientos de la recepción REC-000001'),
    ).toBeTruthy();
    expect(screen.getByText('Recepción REC-000001 de compra OC-000001'))
      .toBeTruthy();
    expect(screen.queryByText('Otra recepción con referencia parecida'))
      .toBeNull();
    expect(screen.queryByText('Venta V-000001')).toBeNull();
    expect(screen.queryByText('Compra histórica')).toBeNull();
  });

  it('limpia la referencia con replace y mantiene disponible el ledger de movimientos', async () => {
    const user = userEvent.setup();
    navigationMock.search = new URLSearchParams({
      tab: 'movements',
      referenceType: 'PURCHASE_RECEIPT',
      referenceId: purchaseReceiptMovement.referenceId!,
      receiptFolio: 'REC-000001',
    }).toString();
    const { rerender } = render(<InventoryPage />);

    await screen.findByText('Recepción REC-000001 de compra OC-000001');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtro' }));

    expect(navigationMock.replace).toHaveBeenCalledWith(
      '/inventory?tab=movements',
    );

    navigationMock.search = 'tab=movements';
    rerender(<InventoryPage />);

    expect(await screen.findByText('Venta V-000001')).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Movimientos' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
    expect(screen.queryByRole('button', { name: 'Limpiar filtro' })).toBeNull();
  });

  it('presenta un vacío contextual cuando la referencia no tiene movimientos', async () => {
    navigationMock.search = new URLSearchParams({
      tab: 'movements',
      referenceType: 'PURCHASE_RECEIPT',
      referenceId: 'receipt-without-movements',
    }).toString();

    render(<InventoryPage />);

    expect(await screen.findByText('Sin movimientos asociados')).toBeTruthy();
    expect(
      screen.getByText(
        'No hay movimientos de inventario asociados a esta recepción.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
