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

import PurchaseReceiptsPage from './page';
import type { PurchaseReceiptListItem } from './types';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

const primaryReceipt: PurchaseReceiptListItem = {
  id: 'receipt-alpha',
  purchaseId: 'purchase-alpha',
  folio: 'REC-ALPHA-001',
  receivedAt: '2026-08-26T18:00:00.000Z',
  receivedBy: 'user-alpha',
  notes: 'Recepción operativa',
  receivedByUser: {
    id: 'user-alpha',
    firstName: 'Ana',
    lastName: 'López',
    email: 'ana.lopez@example.com',
  },
  purchase: {
    id: 'purchase-alpha',
    folio: 'OC-ALPHA-001',
    status: 'RECEIVED',
    supplier: {
      id: 'supplier-alpha',
      name: 'Hospital Norte',
    },
  },
  items: [
    {
      id: 'item-alpha-1',
      purchaseItemId: 'purchase-item-alpha-1',
      productId: 'product-alpha-1',
      quantityReceived: 2,
      lotNumber: null,
      expirationDate: null,
      unitCost: 120,
      batchId: null,
      product: {
        id: 'product-alpha-1',
        sku: 'SKU-ALPHA',
        name: 'Monitor vital',
      },
      batch: null,
    },
    {
      id: 'item-alpha-2',
      purchaseItemId: 'purchase-item-alpha-2',
      productId: 'product-alpha-2',
      quantityReceived: 3,
      lotNumber: null,
      expirationDate: null,
      unitCost: 80,
      batchId: null,
      product: {
        id: 'product-alpha-2',
        sku: 'SKU-SECONDARY',
        name: 'Sensor clínico',
      },
      batch: null,
    },
  ],
};

const secondaryReceipt: PurchaseReceiptListItem = {
  ...primaryReceipt,
  id: 'receipt-beta',
  purchaseId: 'purchase-beta',
  folio: 'REC-BETA-002',
  receivedBy: 'user-beta',
  receivedByUser: {
    id: 'user-beta',
    firstName: 'Bruno',
    lastName: 'Díaz',
    email: 'bruno.diaz@example.com',
  },
  purchase: {
    id: 'purchase-beta',
    folio: 'OC-BETA-002',
    status: 'PARTIALLY_RECEIVED',
    supplier: {
      id: 'supplier-beta',
      name: 'Clínica Sur',
    },
  },
  items: [
    {
      ...primaryReceipt.items[0],
      id: 'item-beta-1',
      quantityReceived: 1,
      product: {
        id: 'product-beta-1',
        sku: 'SKU-BETA',
        name: 'Consumible general',
      },
    },
  ],
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('PurchaseReceiptsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({
      data: [primaryReceipt, secondaryReceipt],
    } as never);
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('carga las recepciones y calcula partidas y unidades recibidas', async () => {
    render(<PurchaseReceiptsPage />);

    const action = await screen.findByRole('link', {
      name: 'Ver recepción REC-ALPHA-001',
    });
    const row = action.closest('tr');

    expect(row).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/purchase-receipts');
    expect(within(row as HTMLTableRowElement).getByText('REC-ALPHA-001')).toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText('OC-ALPHA-001')).toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText('Hospital Norte')).toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText('Ana López')).toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText('2')).toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText('5')).toBeTruthy();
    expect(action.getAttribute('href')).toBe(
      '/purchase-receipts/receipt-alpha',
    );
  });

  it.each([
    'rec-alpha',
    'oc-alpha',
    'hospital norte',
    'ana',
    'lópez',
    'ana.lopez@example.com',
    'sku-alpha',
    'monitor vital',
  ])('busca sin distinguir mayúsculas por %s', async (searchValue) => {
    const user = userEvent.setup();
    render(<PurchaseReceiptsPage />);

    const search = await screen.findByRole('searchbox', {
      name: 'Buscar recepciones',
    });

    await user.type(search, searchValue.toUpperCase());

    expect(
      screen.getByRole('link', {
        name: 'Ver recepción REC-ALPHA-001',
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('link', {
        name: 'Ver recepción REC-BETA-002',
      }),
    ).toBeNull();
  });

  it('muestra el vacío de búsqueda cuando no hay coincidencias', async () => {
    const user = userEvent.setup();
    render(<PurchaseReceiptsPage />);

    const search = await screen.findByRole('searchbox', {
      name: 'Buscar recepciones',
    });

    await user.type(search, 'folio inexistente');

    expect(screen.getByText('Sin recepciones coincidentes')).toBeTruthy();
  });

  it('muestra error y permite reintentar el listado', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Recepciones temporalmente inaccesibles'))
      .mockResolvedValueOnce({ data: [primaryReceipt] } as never);

    render(<PurchaseReceiptsPage />);

    expect(
      await screen.findByText('Recepciones temporalmente inaccesibles'),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('link', {
        name: 'Ver recepción REC-ALPHA-001',
      }),
    ).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('muestra un estado vacío útil cuando no existen recepciones', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never);

    render(<PurchaseReceiptsPage />);

    expect(
      await screen.findByText('Sin recepciones registradas'),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
