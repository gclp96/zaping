import {
  cleanup,
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

const purchase = {
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

function configureApiMocks() {
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

describe('PurchasesPage — recepciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureApiMocks();
  });

  afterEach(() => {
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
      id: 'receipt-2',
      folio: 'RC-0002',
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
  );
});

it('cierra el formulario y recarga las compras después de registrar la recepción', async () => {
  const user = userEvent.setup();

  vi.mocked(api.post).mockResolvedValue({
    data: {
      id: 'receipt-2',
      folio: 'RC-0002',
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

  await user.type(quantityInput, '2');

  await user.click(
    screen.getByRole('button', {
      name: /^registrar recepci[oó]n$/i,
    }),
  );

  await waitFor(() => {
    expect(
      screen.queryByRole('heading', {
        name: /registrar recepci[oó]n.*OC-0001/i,
      }),
    ).toBeNull();
  });

  const purchasesRequests = vi
    .mocked(api.get)
    .mock.calls.filter(
      ([url]) => String(url) === '/purchases',
    );

  expect(purchasesRequests).toHaveLength(2);
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

