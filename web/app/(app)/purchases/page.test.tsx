import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

import PurchasesPage from './page';

import type { Purchase } from './types';

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: '',
}));

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

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(routerMock.search),
}));

const receiptIdempotencyKey =
  '11111111-1111-4111-8111-111111111111';

const purchase: Purchase = {
  id: 'purchase-1',
  folio: 'OC-0001',
  status: 'CONFIRMED',
  subtotal: 1000,
  iva: 160,
  total: 1160,
  createdAt: '2026-07-23T18:00:00.000Z',
  supplier: {
    id: 'supplier-1',
    name: 'Proveedor médico',
    email: 'proveedor@example.com',
    contactName: 'Responsable de compras',
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

const draftPurchase: Purchase = {
  ...purchase,
  status: 'DRAFT',
};

const confirmedFilterPurchase: Purchase = {
  ...purchase,
  id: 'purchase-5',
  folio: 'OC-0005',
};

const partialPurchase: Purchase = {
  ...purchase,
  id: 'purchase-2',
  folio: 'OC-0002',
  status: 'PARTIALLY_RECEIVED',
  supplier: {
    id: 'supplier-2',
    name: 'Clínica del Desierto',
    contactName: 'María Torres',
    email: 'compras@desierto.test',
    isActive: false,
  },
  items: [
    {
      ...purchase.items[0],
      id: 'purchase-item-2',
      productId: 'product-2',
      product: {
        id: 'product-2',
        sku: 'RX-200',
        name: 'Reactivo especializado',
      },
    },
  ],
};

const receivedPurchase: Purchase = {
  ...purchase,
  id: 'purchase-3',
  folio: 'OC-0003',
  status: 'RECEIVED',
};

const cancelledPurchase: Purchase = {
  ...purchase,
  id: 'purchase-4',
  folio: 'OC-0004',
  status: 'CANCELLED',
};


const supplier = {
  id: 'supplier-1',
  name: 'Proveedor médico',
  email: 'proveedor@example.com',
  contactName: 'Responsable de compras',
};

const product = {
  id: 'product-1',
  sku: 'MED-001',
  name: 'Producto médico',
  cost: 100,
  stock: 4,
  minStock: 2,
};

const previousReceipt = {
  id: 'receipt-1',
  purchaseId: 'purchase-1',
  folio: 'RC-0001',
  receivedAt: '2026-07-23T19:00:00.000Z',
  receivedBy: 'user-1',
  receivedByUser: {
    id: 'user-1',
    firstName: 'Leonardo',
    lastName: 'Garnica',
    email: 'admin@example.com',
  },
  notes: 'Primera recepción parcial',
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

function configureApiMocks(
  purchases: Purchase[] = [purchase],
) {
  vi.mocked(api.get).mockImplementation(
    async (url) => {
      const endpoint = String(url);

      if (endpoint === '/purchases') {
        return {
          data: purchases,
        } as never;
      }

      if (endpoint === '/suppliers') {
        return {
          data: [supplier],
        } as never;
      }

      if (endpoint === '/products') {
        return {
          data: [product],
        } as never;
      }

      if (
        endpoint ===
        '/purchases/purchase-1/inventory-movements'
      ) {
        return {
          data: [],
        } as never;
      }

      if (
        endpoint ===
        '/purchase-receipts/purchase/purchase-1'
      ) {
        return {
          data: [previousReceipt],
        } as never;
      }

      throw new Error(
        `Solicitud GET no configurada: ${endpoint}`,
      );
    },
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

async function selectProduct(
  user: ReturnType<typeof userEvent.setup>,
  searchValue = 'MED-001',
) {
  const productSelect = screen.getByRole(
    'combobox',
    {
      name: 'Producto',
    },
  );

  await user.click(productSelect);

  await user.type(
    productSelect,
    searchValue,
  );

  await user.click(
    screen.getByRole('option', {
      name: new RegExp(searchValue, 'i'),
    }),
  );
}

beforeEach(() => {
  routerMock.search = '';
});

describe('PurchasesPage — navegación trazable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureApiMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('abre el detalle existente desde purchaseId, enlaza su recepción y limpia la URL al cerrar', async () => {
    const user = userEvent.setup();
    routerMock.search = 'purchaseId=purchase-1';

    render(<PurchasesPage />);

    expect(
      await screen.findByRole('heading', { name: 'Detalle de compra' }),
    ).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(
      '/purchases/purchase-1/inventory-movements',
    );
    expect(api.get).toHaveBeenCalledWith(
      '/purchase-receipts/purchase/purchase-1',
    );
    expect(
      (await screen.findByRole('link', { name: 'Ver recepción' })).getAttribute(
        'href',
      ),
    ).toBe('/purchase-receipts/receipt-1');

    await user.click(screen.getByRole('button', { name: 'Cerrar modal' }));

    expect(routerMock.replace).toHaveBeenCalledWith('/purchases');
    expect(
      screen.queryByRole('heading', { name: 'Detalle de compra' }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver detalle' })).toBeTruthy();
  });

  it('mantiene la lista usable cuando purchaseId no pertenece a una compra cargada', async () => {
    const user = userEvent.setup();
    routerMock.search = 'purchaseId=purchase-missing';

    render(<PurchasesPage />);

    expect(
      await screen.findByText('No se encontró la compra solicitada.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver detalle' })).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Detalle de compra' }),
    ).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Volver a compras' }));

    expect(routerMock.replace).toHaveBeenCalledWith('/purchases');
  });
});

describe('PurchasesPage — normalización de lista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureApiMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('busca por folio, proveedor, contacto, email, SKU y producto', async () => {
    const user = userEvent.setup();
    configureApiMocks([purchase, partialPurchase]);

    render(<PurchasesPage />);

    const initialFolio = await screen.findByText(purchase.folio);
    const initialRow = initialFolio.closest('tr');

    expect(initialRow).not.toBeNull();
    expect(
      within(initialRow as HTMLTableRowElement).getByText('$1,160.00'),
    ).toBeTruthy();

    const search = screen.getByRole('searchbox', {
      name: 'Buscar compras',
    });

    for (const term of [
      '  oc-0002  ',
      'CLÍNICA DEL DESIERTO',
      'maría torres',
      'compras@desierto.test',
      'rx-200',
      'REACTIVO ESPECIALIZADO',
    ]) {
      await user.clear(search);
      await user.type(search, term);
      expect(screen.getByText(partialPurchase.folio)).toBeTruthy();
      expect(screen.queryByText(purchase.folio)).toBeNull();
    }

    await user.clear(search);
    await user.type(search, 'sin coincidencias');
    expect(screen.getByText('No se encontraron compras')).toBeTruthy();
  });

  it('combina los cinco estados reales con el proveedor derivado y limpia filtros', async () => {
    const user = userEvent.setup();
    configureApiMocks([
      draftPurchase,
      confirmedFilterPurchase,
      partialPurchase,
      receivedPurchase,
      cancelledPurchase,
    ]);

    render(<PurchasesPage />);

    await screen.findByText(draftPurchase.folio);

    const status = screen.getByRole('combobox', { name: 'Estado' });
    const supplierFilter = screen.getByRole('combobox', {
      name: 'Proveedor',
    });

    for (const [value, label, folio] of [
      ['DRAFT', 'Borrador', draftPurchase.folio],
      ['CONFIRMED', 'Confirmada', confirmedFilterPurchase.folio],
      [
        'PARTIALLY_RECEIVED',
        'Parcialmente recibida',
        partialPurchase.folio,
      ],
      ['RECEIVED', 'Recibida', receivedPurchase.folio],
      ['CANCELLED', 'Cancelada', cancelledPurchase.folio],
    ]) {
      expect(within(status).getByRole('option', { name: label })).toBeTruthy();
      await user.selectOptions(status, value);
      expect(screen.getByText(folio)).toBeTruthy();
      expect(
        screen.getAllByRole('button', { name: 'Ver detalle' }),
      ).toHaveLength(1);
    }

    expect(within(supplierFilter).getAllByRole('option')).toHaveLength(3);
    expect(
      within(supplierFilter).getByRole('option', {
        name: 'Todos los proveedores',
      }),
    ).toBeTruthy();

    await user.selectOptions(status, 'PARTIALLY_RECEIVED');
    await user.selectOptions(supplierFilter, 'supplier-2');
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar compras' }),
      'reactivo',
    );

    expect(screen.getByText(partialPurchase.folio)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Ver detalle' })).toHaveLength(
      1,
    );

    const search = screen.getByRole('searchbox', {
      name: 'Buscar compras',
    });
    await user.clear(search);
    await user.type(search, 'sin resultados');
    expect(screen.getByText('No se encontraron compras')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(screen.getByText(draftPurchase.folio)).toBeTruthy();
    expect(screen.getByText(confirmedFilterPurchase.folio)).toBeTruthy();
    expect(screen.getByText(partialPurchase.folio)).toBeTruthy();
    expect(screen.getByText(receivedPurchase.folio)).toBeTruthy();
    expect(screen.getByText(cancelledPurchase.folio)).toBeTruthy();
    expect(
      vi.mocked(api.get).mock.calls.filter(
        ([url]) => String(url) === '/suppliers',
      ),
    ).toHaveLength(1);
  });

  it('muestra el error de carga y permite reintentar con recuperación', async () => {
    const user = userEvent.setup();
    let purchaseRequests = 0;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/purchases') {
        purchaseRequests += 1;

        if (purchaseRequests === 1) {
          throw new Error('Sin conexión');
        }

        return { data: [purchase] } as never;
      }

      if (endpoint === '/suppliers') {
        return { data: [supplier] } as never;
      }

      if (endpoint === '/products') {
        return { data: [product] } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    render(<PurchasesPage />);

    expect(
      await screen.findByText(
        'No fue posible cargar la información de compras.',
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText(purchase.folio)).toBeTruthy();
    expect(purchaseRequests).toBe(2);
  });

  it('muestra un estado vacío útil cuando no hay compras', async () => {
    configureApiMocks([]);

    render(<PurchasesPage />);

    expect(
      await screen.findByText('No hay compras registradas'),
    ).toBeTruthy();
    expect(
      screen.getByText('Comienza creando tu primera orden de compra.'),
    ).toBeTruthy();
  });

  it('conserva visible una compra histórica de proveedor inactivo', async () => {
    configureApiMocks([partialPurchase]);

    render(<PurchasesPage />);

    const folio = await screen.findByText(partialPurchase.folio);
    const row = folio.closest('tr');

    expect(row).not.toBeNull();
    expect(
      within(row as HTMLTableRowElement).getByText(
        partialPurchase.supplier.name,
      ),
    ).toBeTruthy();
  });

  it.each([
    {
      action: 'Aprobar',
      dialog: 'Aprobar compra',
      endpoint: '/purchases/purchase-1/approve',
      error: 'No fue posible aprobar la compra.',
    },
    {
      action: 'Cancelar',
      dialog: 'Cancelar compra',
      endpoint: '/purchases/purchase-1/cancel',
      error: 'No fue posible cancelar la compra.',
    },
  ])(
    'muestra un error estructurado cuando falla $action',
    async ({ action, dialog, endpoint, error }) => {
      const user = userEvent.setup();
      configureApiMocks([draftPurchase]);
      vi.mocked(api.patch).mockRejectedValue(new Error('Error del servidor'));

      render(<PurchasesPage />);

      await screen.findByText(draftPurchase.folio);
      await user.click(screen.getByRole('button', { name: action }));

      const dialogHeading = await screen.findByRole('heading', {
        name: dialog,
      });
      const dialogElement = dialogHeading.parentElement?.parentElement;

      expect(dialogElement).not.toBeNull();

      await user.click(
        within(dialogElement as HTMLElement).getByRole('button', {
          name: dialog === 'Aprobar compra' ? 'Aprobar' : 'Cancelar compra',
        }),
      );

      expect(await screen.findByText(error)).toBeTruthy();
      expect(api.patch).toHaveBeenCalledWith(endpoint);
      expect(screen.getAllByText(draftPurchase.folio).length).toBeGreaterThan(
        0,
      );
    },
  );

  it('muestra un error estructurado cuando falla el PDF', async () => {
    const user = userEvent.setup();
    const defaultGet = vi.mocked(api.get).getMockImplementation();

    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/purchases/purchase-1/pdf') {
        throw new Error('PDF no disponible');
      }

      return await defaultGet!(url);
    });

    render(<PurchasesPage />);

    await screen.findByText(purchase.folio);
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));

    expect(
      await screen.findByText('No fue posible descargar el PDF.'),
    ).toBeTruthy();
  });
});

describe('PurchasesPage — recepciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(
      globalThis.crypto,
      'randomUUID',
    ).mockReturnValue(receiptIdempotencyKey);

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    configureApiMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    cleanup();
  });

  it('calcula la cantidad recibida y pendiente al abrir el formulario', async () => {
  const user = userEvent.setup();

  render(<PurchasesPage />);

  expect(
    await screen.findByText('OC-0001'),
  ).toBeTruthy();

  await user.click(
    screen.getByRole('button', {
      name: /ver detalle/i,
    }),
  );

  const detailTitle = await screen.findByRole(
    'heading',
    {
      name: /detalle de compra/i,
    },
  );

  const detailModal =
    detailTitle.parentElement?.parentElement;

  expect(detailModal).not.toBeNull();

  const registerReceiptButton = within(
    detailModal as HTMLElement,
  ).getByRole('button', {
    name: /registrar recepci[oó]n/i,
  });

  await user.click(registerReceiptButton);

  expect(
    await screen.findByRole('heading', {
      name: /registrar recepci[oó]n.*OC-0001/i,
    }),
  ).toBeTruthy();

  const productSku = screen.getByText('MED-001');
  const productRow = productSku.closest('tr');

  expect(productRow).not.toBeNull();

  const row = within(
    productRow as HTMLTableRowElement,
  );

  expect(row.getByText('10')).toBeTruthy();
  expect(row.getByText('4')).toBeTruthy();
  expect(row.getByText('6')).toBeTruthy();

  const quantityInput = screen.getByRole(
    'spinbutton',
    {
      name: /cantidad recibida de producto médico/i,
    },
  );

  expect(quantityInput.getAttribute('min')).toBe('1');
  expect(quantityInput.getAttribute('max')).toBe('6');
});

it('muestra un error cuando no se captura ninguna cantidad', async () => {
  const user = userEvent.setup();

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /ver detalle/i,
    }),
  );

  const detailTitle = await screen.findByRole(
    'heading',
    {
      name: /detalle de compra/i,
    },
  );

  const detailModal =
    detailTitle.parentElement?.parentElement;

  expect(detailModal).not.toBeNull();

  await user.click(
    within(detailModal as HTMLElement).getByRole(
      'button',
      {
        name: /registrar recepci[oó]n/i,
      },
    ),
  );

  await screen.findByRole('heading', {
    name: /registrar recepci[oó]n.*OC-0001/i,
  });

  await user.click(
    screen.getByRole('button', {
      name: /^registrar recepci[oó]n$/i,
    }),
  );

  const alert = await screen.findByRole('alert');

  expect(alert.textContent).toContain(
    'Captura la cantidad recibida de al menos un producto.',
  );

  expect(api.post).not.toHaveBeenCalled();
});

it('rechaza una cantidad mayor que la pendiente', async () => {
  const user = userEvent.setup();

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /ver detalle/i,
    }),
  );

  const detailTitle = await screen.findByRole(
    'heading',
    {
      name: /detalle de compra/i,
    },
  );

  const detailModal =
    detailTitle.parentElement?.parentElement;

  expect(detailModal).not.toBeNull();

  await user.click(
    within(detailModal as HTMLElement).getByRole(
      'button',
      {
        name: /registrar recepci[oó]n/i,
      },
    ),
  );

  await screen.findByRole('heading', {
    name: /registrar recepci[oó]n.*OC-0001/i,
  });

  const quantityInput = screen.getByRole(
    'spinbutton',
    {
      name: /cantidad recibida de producto médico/i,
    },
  );

  await user.type(quantityInput, '7');

  await user.click(
    screen.getByRole('button', {
      name: /^registrar recepci[oó]n$/i,
    }),
  );

  const alert = await screen.findByRole('alert');

  expect(alert.textContent).toContain(
    'La cantidad de Producto médico debe ser un entero entre 1 y 6.',
  );

  expect(api.post).not.toHaveBeenCalled();
});

it('rechaza una fecha de caducidad sin número de lote', async () => {
  const user = userEvent.setup();

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /ver detalle/i,
    }),
  );

  const detailTitle = await screen.findByRole(
    'heading',
    {
      name: /detalle de compra/i,
    },
  );

  const detailModal =
    detailTitle.parentElement?.parentElement;

  expect(detailModal).not.toBeNull();

  await user.click(
    within(detailModal as HTMLElement).getByRole(
      'button',
      {
        name: /registrar recepci[oó]n/i,
      },
    ),
  );

  await screen.findByRole('heading', {
    name: /registrar recepci[oó]n.*OC-0001/i,
  });

  const quantityInput = screen.getByRole(
    'spinbutton',
    {
      name: /cantidad recibida de producto médico/i,
    },
  );

  const expirationInput = screen.getByLabelText(
    /caducidad de producto médico/i,
  );

  await user.type(quantityInput, '2');
  await user.type(expirationInput, '2028-12-31');

  await user.click(
    screen.getByRole('button', {
      name: /^registrar recepci[oó]n$/i,
    }),
  );

  const alert = await screen.findByRole('alert');

  expect(alert.textContent).toContain(
    'Captura el número de lote de Producto médico para registrar su caducidad.',
  );

  expect(api.post).not.toHaveBeenCalled();
});

it('envía correctamente la recepción al backend', async () => {
  const user = userEvent.setup();

  vi.mocked(api.post).mockResolvedValue({
    data: {
      id: 'receipt-123',
      folio: 'REC-000123',
    },
  } as never);

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /ver detalle/i,
    }),
  );

  const detailTitle = await screen.findByRole(
    'heading',
    {
      name: /detalle de compra/i,
    },
  );

  const detailModal =
    detailTitle.parentElement?.parentElement;

  expect(detailModal).not.toBeNull();

  await user.click(
    within(detailModal as HTMLElement).getByRole(
      'button',
      {
        name: /registrar recepci[oó]n/i,
      },
    ),
  );

  await screen.findByRole('heading', {
    name: /registrar recepci[oó]n.*OC-0001/i,
  });

  const quantityInput = screen.getByRole(
    'spinbutton',
    {
      name: /cantidad recibida de producto médico/i,
    },
  );

  const lotInput = screen.getByLabelText(
    /lote de producto médico/i,
  );

  const expirationInput = screen.getByLabelText(
    /caducidad de producto médico/i,
  );

  const notesInput = screen.getByLabelText(/notas/i);

  await user.type(quantityInput, '2');
  await user.type(lotInput, 'LOTE-002');
  await user.type(expirationInput, '2029-06-30');
  await user.type(
    notesInput,
    'Recepción registrada desde pruebas',
  );

  await user.click(
    screen.getByRole('button', {
      name: /^registrar recepci[oó]n$/i,
    }),
  );

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  expect(api.post).toHaveBeenCalledWith(
    '/purchase-receipts',
    {
      purchaseId: 'purchase-1',
      notes: 'Recepción registrada desde pruebas',
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
          receiptIdempotencyKey,
      },
    },
  );

  expect(
    await screen.findByRole('heading', {
      name: 'Recepción registrada correctamente',
    }),
  ).toBeTruthy();
  expect(screen.getByText('REC-000123')).toBeTruthy();
  expect(
    screen.queryByRole('button', {
      name: /^registrar recepción$/i,
    }),
  ).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);

  await user.click(
    screen.getByRole('button', {
      name: 'Ver recepción',
    }),
  );

  expect(routerMock.push).toHaveBeenCalledWith(
    '/purchase-receipts/receipt-123',
  );
});

it('refresca compra e historial, cierra el éxito y abre un intento fresco', async () => {
  const user = userEvent.setup();

  const partialPurchase = {
    ...purchase,
    status: 'PARTIALLY_RECEIVED',
  };
  const createdReceipt = {
    ...previousReceipt,
    id: 'receipt-2',
    folio: 'REC-000002',
    items: [
      {
        ...previousReceipt.items[0],
        id: 'receipt-item-2',
        quantityReceived: 2,
      },
    ],
  };
  let receiptCreated = false;

  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/purchases') {
      return {
        data: [receiptCreated ? partialPurchase : purchase],
      } as never;
    }

    if (endpoint === '/suppliers') {
      return { data: [supplier] } as never;
    }

    if (endpoint === '/products') {
      return { data: [product] } as never;
    }

    if (
      endpoint === '/purchases/purchase-1/inventory-movements'
    ) {
      return { data: [] } as never;
    }

    if (
      endpoint === '/purchase-receipts/purchase/purchase-1'
    ) {
      return {
        data: receiptCreated
          ? [previousReceipt, createdReceipt]
          : [previousReceipt],
      } as never;
    }

    throw new Error(`Solicitud GET no configurada: ${endpoint}`);
  });

  vi.mocked(api.post).mockImplementation(async () => {
    receiptCreated = true;

    return {
      data: {
        id: 'receipt-2',
        folio: 'REC-000002',
      },
    } as never;
  });

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /ver detalle/i,
    }),
  );

  const detailTitle = await screen.findByRole(
    'heading',
    {
      name: /detalle de compra/i,
    },
  );

  const detailModal =
    detailTitle.parentElement?.parentElement;

  expect(detailModal).not.toBeNull();

  await user.click(
    within(detailModal as HTMLElement).getByRole(
      'button',
      {
        name: /registrar recepci[oó]n/i,
      },
    ),
  );

  await screen.findByRole('heading', {
    name: /registrar recepci[oó]n.*OC-0001/i,
  });

  const quantityInput = screen.getByRole(
    'spinbutton',
    {
      name: /cantidad recibida de producto médico/i,
    },
  );

  await user.type(quantityInput, '2');

  await user.click(
    screen.getByRole('button', {
      name: /^registrar recepci[oó]n$/i,
    }),
  );

  expect(
    await screen.findByRole('heading', {
      name: 'Recepción registrada correctamente',
    }),
  ).toBeTruthy();
  expect(
    screen.getByLabelText(
      'Estado de la compra: Parcialmente recibida',
    ),
  ).toBeTruthy();

  const purchasesRequests = vi
    .mocked(api.get)
    .mock.calls.filter(
      ([url]) => String(url) === '/purchases',
    );

  expect(purchasesRequests).toHaveLength(2);

  await user.click(screen.getByRole('button', { name: 'Cerrar' }));

  expect(
    screen.queryByRole('heading', {
      name: 'Recepción registrada correctamente',
    }),
  ).toBeNull();
  expect(screen.getByRole('heading', { name: 'Compras' })).toBeTruthy();

  await user.click(
    screen.getByRole('button', { name: 'Ver detalle' }),
  );

  const detailTitleAfterSuccess = await screen.findByRole('heading', {
    name: 'Detalle de compra',
  });
  const detailAfterSuccess =
    detailTitleAfterSuccess.parentElement?.parentElement;

  expect(detailAfterSuccess).toBeTruthy();
  expect(
    within(detailAfterSuccess as HTMLElement).getByText('REC-000002'),
  ).toBeTruthy();

  await user.click(
    within(detailAfterSuccess as HTMLElement).getByRole('button', {
      name: 'Registrar recepción',
    }),
  );

  const freshQuantity = await screen.findByRole('spinbutton', {
    name: 'Cantidad recibida de Producto médico',
  });

  expect((freshQuantity as HTMLInputElement).value).toBe('');
  expect(freshQuantity.getAttribute('max')).toBe('4');
  expect((screen.getByLabelText('Notas') as HTMLTextAreaElement).value).toBe(
    '',
  );
});

it('mantiene el handoff cuando la recepción completa la compra', async () => {
  const user = userEvent.setup();
  const receivedPurchase = {
    ...purchase,
    status: 'RECEIVED',
  };
  let purchaseRequests = 0;
  const defaultGet = vi.mocked(api.get).getMockImplementation();

  vi.mocked(api.get).mockImplementation(async (url) => {
    if (String(url) === '/purchases') {
      purchaseRequests += 1;

      return {
        data: [purchaseRequests > 1 ? receivedPurchase : purchase],
      } as never;
    }

    return await defaultGet!(url);
  });
  vi.mocked(api.post).mockResolvedValue({
    data: {
      id: 'receipt-full',
      folio: 'REC-FULL-001',
    },
  } as never);

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');
  await user.click(screen.getByRole('button', { name: 'Ver detalle' }));

  const detailTitle = await screen.findByRole('heading', {
    name: 'Detalle de compra',
  });
  const detailModal = detailTitle.parentElement?.parentElement;

  await user.click(
    within(detailModal as HTMLElement).getByRole('button', {
      name: 'Registrar recepción',
    }),
  );
  await user.type(
    screen.getByRole('spinbutton', {
      name: 'Cantidad recibida de Producto médico',
    }),
    '6',
  );
  await user.click(
    screen.getByRole('button', { name: 'Registrar recepción' }),
  );

  expect(
    await screen.findByRole('heading', {
      name: 'Recepción registrada correctamente',
    }),
  ).toBeTruthy();
  expect(screen.getByText('REC-FULL-001')).toBeTruthy();
  expect(
    screen.getByLabelText('Estado de la compra: Recibida'),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Ver recepción' }),
  ).toBeTruthy();
});

it('muestra un error cuando el backend no puede registrar la recepción', async () => {
  const user = userEvent.setup();

  vi.mocked(api.post).mockRejectedValue(
    new Error('Error del servidor'),
  );

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /ver detalle/i,
    }),
  );

  const detailTitle = await screen.findByRole(
    'heading',
    {
      name: /detalle de compra/i,
    },
  );

  const detailModal =
    detailTitle.parentElement?.parentElement;

  expect(detailModal).not.toBeNull();

  await user.click(
    within(detailModal as HTMLElement).getByRole(
      'button',
      {
        name: /registrar recepci[oó]n/i,
      },
    ),
  );

  const receiptHeading = await screen.findByRole(
    'heading',
    {
      name: /registrar recepci[oó]n.*OC-0001/i,
    },
  );

  const receiptModal =
    receiptHeading.parentElement?.parentElement;

  expect(receiptModal).not.toBeNull();

  const receiptScope = within(
    receiptModal as HTMLElement,
  );

  await user.type(
    receiptScope.getByRole('spinbutton', {
      name: /cantidad recibida de producto médico/i,
    }),
    '2',
  );

  await user.click(
    receiptScope.getByRole('button', {
      name: /^registrar recepci[oó]n$/i,
    }),
  );

  const alert = await receiptScope.findByRole('alert');

  expect(alert.textContent).toContain(
    'No fue posible registrar la recepción.',
  );

  expect(api.post).toHaveBeenCalledTimes(1);

  expect(
    screen.queryByRole('heading', {
      name: /registrar recepci[oó]n.*OC-0001/i,
    }),
  ).not.toBeNull();

  const purchasesRequests = vi
    .mocked(api.get)
    .mock.calls.filter(
      ([url]) => String(url) === '/purchases',
    );

  expect(purchasesRequests).toHaveLength(1);
});

});

describe('PurchasesPage — formulario de compra', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    configureApiMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('crea una compra con el proveedor y producto seleccionados', async () => {
    const user = userEvent.setup();

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'purchase-2',
        folio: 'OC-0002',
      },
    } as never);

    render(<PurchasesPage />);

    await screen.findByText('OC-0001');

    await user.click(
      screen.getByRole('button', {
        name: /nueva compra/i,
      }),
    );

    const formHeading = await screen.findByRole('heading', {
      name: /nueva compra/i,
    });
    const formModal = formHeading.parentElement?.parentElement;

    expect(formModal).not.toBeNull();

    const supplierSelect =
      within(formModal as HTMLElement).getByRole('combobox', {
        name: /^proveedor$/i,
      });

    const quantityInput = screen.getByRole(
      'spinbutton',
      {
        name: /^cantidad$/i,
      },
    );

    await user.selectOptions(
      supplierSelect,
      'supplier-1',
    );

    await selectProduct(user);

    await user.clear(quantityInput);
    await user.type(quantityInput, '3');

    await user.click(
      screen.getByRole('button', {
        name: /agregar producto/i,
      }),
    );

    expect(
      screen.getByText('Producto médico'),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: /crear compra/i,
      }),
    );

    await waitFor(() => {
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
    });
  });

  it('edita una compra en borrador y actualiza su cantidad', async () => {
    const user = userEvent.setup();

    vi.mocked(api.get).mockImplementation(
      async (url) => {
        const endpoint = String(url);

        if (endpoint === '/purchases') {
          return {
            data: [draftPurchase],
          } as never;
        }

        if (endpoint === '/suppliers') {
          return {
            data: [supplier],
          } as never;
        }

        if (endpoint === '/products') {
          return {
            data: [product],
          } as never;
        }

        throw new Error(
          `Solicitud GET no configurada: ${endpoint}`,
        );
      },
    );

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        ...draftPurchase,
        items: [
          {
            ...draftPurchase.items[0],
            quantity: 5,
            subtotal: 500,
          },
        ],
      },
    } as never);

    render(<PurchasesPage />);

    await screen.findByText('OC-0001');

    await user.click(
      screen.getByRole('button', {
        name: /^editar$/i,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: /editar compra/i,
      }),
    ).toBeTruthy();

    const quantityInput = screen.getByRole(
      'spinbutton',
      {
        name: /cantidad de producto médico/i,
      },
    );

    expect(
      (quantityInput as HTMLInputElement).value,
    ).toBe('10');

    await user.clear(quantityInput);
    await user.type(quantityInput, '5');

    await user.click(
      screen.getByRole('button', {
        name: /guardar cambios/i,
      }),
    );

    await waitFor(() => {
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
    });

    const purchasesRequests = vi
      .mocked(api.get)
      .mock.calls.filter(
        ([url]) => String(url) === '/purchases',
      );

    expect(purchasesRequests).toHaveLength(2);
  });

  it('rechaza una cantidad inválida al agregar un producto', async () => {
  const user = userEvent.setup();

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /nueva compra/i,
    }),
  );

  const modalHeading =
    await screen.findByRole('heading', {
      name: /nueva compra/i,
    });

  const modal =
    modalHeading.parentElement?.parentElement;

  expect(modal).not.toBeNull();

  const modalScope = within(
    modal as HTMLElement,
  );

  const quantityInput =
    modalScope.getByRole('spinbutton', {
      name: /^cantidad$/i,
    });

  await selectProduct(user);

  fireEvent.change(quantityInput, {
    target: {
      value: '0',
    },
  });

  expect(
    (quantityInput as HTMLInputElement).value,
  ).toBe('0');

  await user.click(
    modalScope.getByRole('button', {
      name: /agregar producto/i,
    }),
  );

  const alert =
    await modalScope.findByRole('alert');

  expect(alert.textContent).toContain(
    'La cantidad debe ser un número entero mayor o igual a uno.',
  );

  expect(api.post).not.toHaveBeenCalled();

  expect(
    screen.queryByRole('spinbutton', {
      name: /cantidad de producto médico/i,
    }),
  ).toBeNull();
});
});

 describe('PurchasesPage — acciones de compra', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    configureApiMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('aprueba una compra en borrador y recarga las compras', async () => {
    const user = userEvent.setup();

    vi.mocked(api.get).mockImplementation(
      async (url) => {
        const endpoint = String(url);

        if (endpoint === '/purchases') {
          return {
            data: [draftPurchase],
          } as never;
        }

        if (endpoint === '/suppliers') {
          return {
            data: [supplier],
          } as never;
        }

        if (endpoint === '/products') {
          return {
            data: [product],
          } as never;
        }

        throw new Error(
          `Solicitud GET no configurada: ${endpoint}`,
        );
      },
    );

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        ...draftPurchase,
        status: 'CONFIRMED',
      },
    } as never);

    render(<PurchasesPage />);

    await screen.findByText('OC-0001');

    await user.click(
      screen.getByRole('button', {
        name: /^aprobar$/i,
      }),
    );

    const dialogTitle = await screen.findByRole(
      'heading',
      {
        name: /aprobar compra/i,
      },
    );

    const dialog =
      dialogTitle.parentElement?.parentElement;

    expect(dialog).not.toBeNull();

    await user.click(
      within(dialog as HTMLElement).getByRole(
        'button',
        {
          name: /^aprobar$/i,
        },
      ),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        '/purchases/purchase-1/approve',
      );
    });

    const purchasesRequests = vi
      .mocked(api.get)
      .mock.calls.filter(
        ([url]) => String(url) === '/purchases',
      );

    expect(purchasesRequests).toHaveLength(2);

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /aprobar compra/i,
        }),
      ).toBeNull();
    });
  });

  it('cancela una compra en borrador y recarga las compras', async () => {
  const user = userEvent.setup();

  vi.mocked(api.get).mockImplementation(
    async (url) => {
      const endpoint = String(url);

      if (endpoint === '/purchases') {
        return {
          data: [draftPurchase],
        } as never;
      }

      if (endpoint === '/suppliers') {
        return {
          data: [supplier],
        } as never;
      }

      if (endpoint === '/products') {
        return {
          data: [product],
        } as never;
      }

      throw new Error(
        `Solicitud GET no configurada: ${endpoint}`,
      );
    },
  );

  vi.mocked(api.patch).mockResolvedValue({
    data: {
      ...draftPurchase,
      status: 'CANCELLED',
    },
  } as never);

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /^cancelar$/i,
    }),
  );

  const dialogTitle = await screen.findByRole(
    'heading',
    {
      name: /cancelar compra/i,
    },
  );

  const dialog =
    dialogTitle.parentElement?.parentElement;

  expect(dialog).not.toBeNull();

  await user.click(
    within(dialog as HTMLElement).getByRole(
      'button',
      {
        name: /cancelar compra/i,
      },
    ),
  );

  await waitFor(() => {
    expect(api.patch).toHaveBeenCalledWith(
      '/purchases/purchase-1/cancel',
    );
  });

  const purchasesRequests = vi
    .mocked(api.get)
    .mock.calls.filter(
      ([url]) => String(url) === '/purchases',
    );

  expect(purchasesRequests).toHaveLength(2);

  await waitFor(() => {
    expect(
      screen.queryByRole('heading', {
        name: /cancelar compra/i,
      }),
    ).toBeNull();
  });
});

  it('descarga el PDF de una compra', async () => {
  const user = userEvent.setup();

  const pdfBlob = new Blob(
    ['contenido del PDF'],
    {
      type: 'application/pdf',
    },
  );

  const createObjectURLSpy = vi
    .spyOn(window.URL, 'createObjectURL')
    .mockReturnValue('blob:purchase-pdf');

  const revokeObjectURLSpy = vi
    .spyOn(window.URL, 'revokeObjectURL')
    .mockImplementation(() => undefined);

  const linkClickSpy = vi
    .spyOn(
      HTMLAnchorElement.prototype,
      'click',
    )
    .mockImplementation(() => undefined);

  vi.mocked(api.get).mockImplementation(
    async (url) => {
      const endpoint = String(url);

      if (endpoint === '/purchases') {
        return {
          data: [purchase],
        } as never;
      }

      if (endpoint === '/suppliers') {
        return {
          data: [supplier],
        } as never;
      }

      if (endpoint === '/products') {
        return {
          data: [product],
        } as never;
      }

      if (
        endpoint ===
        '/purchases/purchase-1/pdf'
      ) {
        return {
          data: pdfBlob,
        } as never;
      }

      throw new Error(
        `Solicitud GET no configurada: ${endpoint}`,
      );
    },
  );

  render(<PurchasesPage />);

  await screen.findByText('OC-0001');

  await user.click(
    screen.getByRole('button', {
      name: /descargar pdf/i,
    }),
  );

  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith(
      '/purchases/purchase-1/pdf',
      {
        responseType: 'blob',
      },
    );
  });

  expect(
    createObjectURLSpy,
  ).toHaveBeenCalledWith(pdfBlob);

  expect(linkClickSpy).toHaveBeenCalledTimes(1);

  expect(
    revokeObjectURLSpy,
  ).toHaveBeenCalledWith(
    'blob:purchase-pdf',
  );

  createObjectURLSpy.mockRestore();
  revokeObjectURLSpy.mockRestore();
  linkClickSpy.mockRestore();
});
});
