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

import SalesPage from './page';

import type { Sale } from './types';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (
    _error: unknown,
    fallbackMessage: string,
  ) => fallbackMessage,
}));

const baseSale: Sale = {
  id: 'sale-1',
  companyId: 'company-1',
  folio: 'V-000001',
  customerId: 'customer-1',
  quoteId: null,
  subtotal: 1000,
  iva: 160,
  total: 1160,
  status: 'DRAFT',
  createdAt: '2026-08-20T18:00:00.000Z',
  updatedAt: '2026-08-20T18:00:00.000Z',
  customer: {
    id: 'customer-1',
    name: 'Hospital de prueba',
  },
  items: [
    {
      id: 'sale-item-1',
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
    {
      id: 'sale-item-2',
      productId: 'product-2',
      quantity: 1,
      price: 0,
      subtotal: 0,
      product: {
        id: 'product-2',
        sku: 'MED-002',
        name: 'Insumo médico',
      },
    },
  ],
};

const confirmedSale: Sale = {
  ...baseSale,
  id: 'sale-2',
  folio: 'V-000002',
  customerId: 'customer-2',
  status: 'CONFIRMED',
  total: 580,
  customer: {
    id: 'customer-2',
    name: 'Clínica Norte',
  },
  items: [
    {
      ...baseSale.items[0],
      id: 'sale-item-3',
    },
  ],
};

const cancelledSale: Sale = {
  ...baseSale,
  id: 'sale-3',
  folio: 'V-1787610435656',
  customerId: 'customer-3',
  status: 'CANCELLED',
  customer: {
    id: 'customer-3',
    name: 'Laboratorio Central',
  },
};

function configureApiMocks(sales: Sale[] = [baseSale]) {
  vi.mocked(api.get).mockResolvedValue({
    data: sales,
  } as never);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('SalesPage', () => {
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

  it('llama GET /sales al iniciar', async () => {
    render(<SalesPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/sales');
    });
  });

  it('muestra el estado de carga', () => {
    vi.mocked(api.get).mockImplementation(
      () => new Promise(() => undefined),
    );

    render(<SalesPage />);

    expect(screen.getByText('Cargando ventas...')).toBeTruthy();
  });

  it('muestra el error de carga y permite reintentar', async () => {
    const user = userEvent.setup();
    let firstRequest = true;

    vi.mocked(api.get).mockImplementation(async () => {
      if (firstRequest) {
        firstRequest = false;
        throw new Error('Error cargando ventas');
      }

      return {
        data: [baseSale],
      } as never;
    });

    render(<SalesPage />);

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toContain(
      'No fue posible cargar la información de ventas.',
    );

    await user.click(
      within(alert).getByRole('button', {
        name: /reintentar/i,
      }),
    );

    expect(await screen.findByText('V-000001')).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('muestra el estado vacío cuando no hay ventas', async () => {
    configureApiMocks([]);

    render(<SalesPage />);

    expect(
      await screen.findByText('No hay ventas registradas'),
    ).toBeTruthy();
    expect(screen.queryByText('V-000001')).toBeNull();
  });

  it('renderiza folio, cliente, fecha, partidas y total', async () => {
    render(<SalesPage />);

    expect(await screen.findByText('V-000001')).toBeTruthy();
    expect(screen.getByText('Hospital de prueba')).toBeTruthy();
    expect(screen.getByText(/20 ago 2026/i)).toBeTruthy();
    expect(screen.getByText('2 partidas')).toBeTruthy();
    expect(screen.getByText('$1,160.00')).toBeTruthy();
  });

  it('mapea DRAFT, CONFIRMED y CANCELLED a etiquetas en español', async () => {
    configureApiMocks([baseSale, confirmedSale, cancelledSale]);

    render(<SalesPage />);

    expect(
      await screen.findByLabelText('Estado de la venta: Borrador'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Estado de la venta: Confirmada'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Estado de la venta: Cancelada'),
    ).toBeTruthy();
  });

  it('busca por folio preservando los registros coincidentes', async () => {
    const user = userEvent.setup();

    configureApiMocks([baseSale, confirmedSale]);

    render(<SalesPage />);

    await screen.findByText('V-000001');

    await user.type(
      screen.getByRole('searchbox', {
        name: /buscar/i,
      }),
      '000002',
    );

    expect(screen.queryByText('V-000001')).toBeNull();
    expect(screen.getByText('V-000002')).toBeTruthy();
  });

  it('busca por cliente sin distinguir mayúsculas', async () => {
    const user = userEvent.setup();

    configureApiMocks([baseSale, confirmedSale]);

    render(<SalesPage />);

    await screen.findByText('Hospital de prueba');

    await user.type(
      screen.getByRole('searchbox', {
        name: /buscar/i,
      }),
      'clínica norte',
    );

    expect(screen.queryByText('Hospital de prueba')).toBeNull();
    expect(screen.getByText('Clínica Norte')).toBeTruthy();
  });

  it('filtra por estado localmente', async () => {
    const user = userEvent.setup();

    configureApiMocks([baseSale, confirmedSale, cancelledSale]);

    render(<SalesPage />);

    await screen.findByText('V-000001');

    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /estado/i,
      }),
      'CONFIRMED',
    );

    expect(screen.queryByText('V-000001')).toBeNull();
    expect(screen.getByText('V-000002')).toBeTruthy();
    expect(screen.queryByText('V-1787610435656')).toBeNull();
  });

  it('muestra un vacío distinto cuando los filtros no tienen resultados', async () => {
    const user = userEvent.setup();

    render(<SalesPage />);

    await screen.findByText('V-000001');

    await user.type(
      screen.getByRole('searchbox', {
        name: /buscar/i,
      }),
      'sin coincidencias',
    );

    expect(
      screen.getByText(
        'No se encontraron ventas con los filtros seleccionados.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('No hay ventas registradas'),
    ).toBeNull();
  });

  it('no muestra ventas falsas ni acciones fuera de alcance', async () => {
    render(<SalesPage />);

    expect(await screen.findByText('V-000001')).toBeTruthy();

    expect(screen.queryByText('Venta de ejemplo')).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: /nueva venta/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: /^eliminar$/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: /^aprobar$/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: /^cancelar$/i,
      }),
    ).toBeNull();
  });
});
