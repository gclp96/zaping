import {
  cleanup,
  render,
  screen,
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

import DashboardPage from './page';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const dashboardData = {
  totals: {
    customers: 12,
    suppliers: 8,
    products: 34,
    quotes: 7,
    purchases: 5,
    sales: 6,
  },
  inventoryValue: 98765.43,
  lowStockProducts: 2,
  lowStock: [
    {
      id: 'product-low-1',
      name: 'Guantes quirúrgicos',
      stock: 3,
      minStock: 10,
    },
    {
      id: 'product-low-2',
      name: 'Sutura absorbible',
      stock: 4,
      minStock: 4,
    },
  ],
};

const recentSales = [
  {
    id: 'sale-1',
    folio: 'V-2001',
    status: 'CONFIRMED',
    total: 12500,
    createdAt: '2026-08-24T10:00:00.000Z',
    customer: {
      name: 'Clínica Real',
    },
  },
  {
    id: 'sale-2',
    folio: 'V-2002',
    status: 'DRAFT',
    total: 8200,
    createdAt: '2026-08-23T10:00:00.000Z',
    customer: {
      name: 'Hospital Central',
    },
  },
  {
    id: 'sale-3',
    folio: 'V-2003',
    status: 'CANCELLED',
    total: 400,
    createdAt: '2026-08-22T10:00:00.000Z',
    customer: null,
  },
];

function mockDashboardSuccess({
  dashboard = dashboardData,
  sales = recentSales,
}: {
  dashboard?: typeof dashboardData;
  sales?: typeof recentSales;
} = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/dashboard') {
      return {
        data: dashboard,
      } as never;
    }

    if (endpoint === '/sales') {
      return {
        data: sales,
      } as never;
    }

    throw new Error(`Unexpected endpoint ${endpoint}`);
  });
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDashboardSuccess();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('requests Dashboard and Sales data only', async () => {
    render(<DashboardPage />);

    await screen.findByText('Resumen operativo');

    expect(api.get).toHaveBeenCalledWith('/dashboard');
    expect(api.get).toHaveBeenCalledWith('/sales');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('renders real KPI values from the Dashboard response', async () => {
    render(<DashboardPage />);

    await screen.findByText('Resumen operativo');

    expect(screen.getByText('Valor de inventario')).toBeTruthy();
    expect(screen.getByText('$98,765.43')).toBeTruthy();
    expect(screen.getByText('Stock bajo')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Ventas')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('Compras')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Cotizaciones')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Productos')).toBeTruthy();
    expect(screen.getByText('34')).toBeTruthy();
  });

  it('renders low-stock products with current and minimum quantities', async () => {
    render(<DashboardPage />);

    await screen.findByText('Guantes quirúrgicos');

    expect(screen.getByText('Stock actual: 3')).toBeTruthy();
    expect(screen.getByText('Mínimo: 10')).toBeTruthy();
    expect(screen.getByText('Sutura absorbible')).toBeTruthy();
    expect(screen.getByText('Stock actual: 4')).toBeTruthy();
    expect(screen.getByText('Mínimo: 4')).toBeTruthy();
  });

  it('renders the low-stock empty state', async () => {
    mockDashboardSuccess({
      dashboard: {
        ...dashboardData,
        lowStockProducts: 0,
        lowStock: [],
      },
    });

    render(<DashboardPage />);

    expect(
      await screen.findByText('No hay productos con stock bajo'),
    ).toBeTruthy();
  });

  it('renders real recent sales from GET /sales', async () => {
    render(<DashboardPage />);

    await screen.findByText('V-2001');

    expect(screen.getByText('Clínica Real')).toBeTruthy();
    expect(screen.getByText('$12,500.00')).toBeTruthy();
    expect(screen.getByText('Confirmada')).toBeTruthy();
    expect(screen.getByText('V-2002')).toBeTruthy();
    expect(screen.getByText('Borrador')).toBeTruthy();
    expect(screen.getByText('Cliente no especificado')).toBeTruthy();
  });

  it('limits recent sales to five records', async () => {
    const sixSales = Array.from({ length: 6 }, (_, index) => ({
      id: `sale-${index + 1}`,
      folio: `V-30${index + 1}`,
      status: 'CONFIRMED',
      total: 100 + index,
      createdAt: `2026-08-2${index}T10:00:00.000Z`,
      customer: {
        name: `Cliente ${index + 1}`,
      },
    }));

    mockDashboardSuccess({
      sales: sixSales,
    });

    render(<DashboardPage />);

    await screen.findByText('V-301');

    expect(screen.getByText('V-305')).toBeTruthy();
    expect(screen.queryByText('V-306')).toBeNull();
  });

  it('does not render hardcoded recent sales records', async () => {
    render(<DashboardPage />);

    await screen.findByText('Resumen operativo');

    expect(screen.queryByText('V-1001')).toBeNull();
    expect(screen.queryByText('Hospital San José')).toBeNull();
  });

  it('renders the sales empty state without placeholder records', async () => {
    mockDashboardSuccess({
      sales: [],
    });

    render(<DashboardPage />);

    expect(
      await screen.findByText('No hay ventas registradas'),
    ).toBeTruthy();
    expect(screen.queryByText('V-1001')).toBeNull();
  });

  it('renders the loading state while Dashboard data is pending', () => {
    vi.mocked(api.get).mockImplementation(
      () => new Promise(() => undefined),
    );

    render(<DashboardPage />);

    expect(screen.getByText('Cargando dashboard...')).toBeTruthy();
  });

  it('renders a Dashboard error state and retries', async () => {
    const user = userEvent.setup();

    vi.mocked(api.get)
      .mockImplementationOnce(async () => {
        throw new Error('Dashboard unavailable');
      })
      .mockResolvedValueOnce({
        data: [],
      } as never)
      .mockResolvedValueOnce({
        data: dashboardData,
      } as never)
      .mockResolvedValueOnce({
        data: recentSales,
      } as never);

    render(<DashboardPage />);

    expect(
      await screen.findByText('No fue posible cargar el dashboard'),
    ).toBeTruthy();
    expect(screen.getByText('Dashboard unavailable')).toBeTruthy();

    await user.click(screen.getByText('Reintentar'));

    expect(await screen.findByText('Resumen operativo')).toBeTruthy();
    expect(screen.getByText('Guantes quirúrgicos')).toBeTruthy();
  });

  it('keeps Dashboard usable when only Sales fails', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/dashboard') {
        return {
          data: dashboardData,
        } as never;
      }

      if (endpoint === '/sales') {
        throw new Error('Sales unavailable');
      }

      throw new Error(`Unexpected endpoint ${endpoint}`);
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Resumen operativo')).toBeTruthy();
    expect(screen.getByText('Guantes quirúrgicos')).toBeTruthy();
    expect(
      screen.getByText('Ventas recientes no disponibles'),
    ).toBeTruthy();
    expect(screen.getByText('Sales unavailable')).toBeTruthy();
    expect(screen.queryByText('V-1001')).toBeNull();
  });

  it('retries recent sales independently after a Sales failure', async () => {
    const user = userEvent.setup();

    vi.mocked(api.get)
      .mockImplementationOnce(async () => ({
        data: dashboardData,
      }) as never)
      .mockImplementationOnce(async () => {
        throw new Error('Sales unavailable');
      })
      .mockImplementationOnce(async () => ({
        data: recentSales,
      }) as never);

    render(<DashboardPage />);

    expect(
      await screen.findByText('Ventas recientes no disponibles'),
    ).toBeTruthy();

    await user.click(screen.getByText('Reintentar ventas'));

    expect(await screen.findByText('V-2001')).toBeTruthy();
  });

  it('does not introduce a link to the missing Sales route', async () => {
    render(<DashboardPage />);

    await screen.findByText('Resumen operativo');

    const salesLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/sales');

    expect(salesLinks).toHaveLength(0);
  });

  it('uses the approved local Dashboard heading', async () => {
    render(<DashboardPage />);

    expect(await screen.findByText('Resumen operativo')).toBeTruthy();
    expect(screen.getByText('Estado actual de tu operación.')).toBeTruthy();
  });
});
