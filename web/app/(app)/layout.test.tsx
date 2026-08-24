import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { api } from '@/services/api';

import AuthenticatedAppLayout from './layout';
import CustomersPage from './customers/page';
import DashboardPage from './dashboard/page';
import ProductsPage from './products/page';
import PurchasesPage from './purchases/page';
import SalesPage from './sales/page';
import ForgotPasswordPage from '../(public)/forgot-password/page';
import LoginPage from '../(public)/login/page';
import RegisterPage from '../(public)/register/page';

const navigationMock = vi.hoisted(() => ({
  pathname: '/dashboard',
}));

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMock.pathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const dashboardData = {
  totals: {
    customers: 0,
    suppliers: 0,
    products: 0,
    quotes: 0,
    purchases: 0,
    sales: 0,
  },
  inventoryValue: 0,
  lowStockProducts: 0,
  lowStock: [],
};

function configureApiMocks() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/dashboard') {
      return {
        data: dashboardData,
      } as never;
    }

    return {
      data: [],
    } as never;
  });
}

function renderInShell(children: ReactNode) {
  return render(
    <AuthenticatedAppLayout>
      {children}
    </AuthenticatedAppLayout>,
  );
}

describe('AuthenticatedAppLayout', () => {
  beforeEach(() => {
    navigationMock.pathname = '/dashboard';
    configureApiMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the Sidebar', () => {
    renderInShell(<div>Shell child</div>);

    expect(screen.getByText('Zaping ERP')).toBeTruthy();
    expect(screen.getByText('Clientes')).toBeTruthy();
  });

  it('renders the Header with the current route title', () => {
    renderInShell(<div>Shell child</div>);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.queryByText('Leonardo')).toBeNull();
    expect(screen.getByLabelText('Cuenta')).toBeTruthy();
  });

  it('renders children in the main content region', () => {
    renderInShell(<div>Shell child</div>);

    expect(screen.getByText('Shell child')).toBeTruthy();
  });

  it('renders Dashboard in the shared shell without a duplicate Sidebar', async () => {
    const { container } = renderInShell(<DashboardPage />);

    expect(
      await screen.findByText(
        'Estado actual de tu operación.',
      ),
    ).toBeTruthy();
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(screen.getAllByText('Zaping ERP')).toHaveLength(1);
  });

  it('renders all approved existing navigation groups', () => {
    renderInShell(<div>Shell child</div>);

    expect(screen.getByText('INICIO')).toBeTruthy();
    expect(screen.getByText('COMERCIAL')).toBeTruthy();
    expect(screen.getByText('COMPRAS')).toBeTruthy();
    expect(screen.getByText('INVENTARIO')).toBeTruthy();
    expect(screen.getByText('ADMINISTRACIÓN')).toBeTruthy();
  });

  it('renders approved navigation links for existing routes', () => {
    renderInShell(<div>Shell child</div>);

    expect(
      screen
        .getByRole('link', { name: 'Dashboard' })
        .getAttribute('href'),
    ).toBe('/dashboard');
    expect(
      screen
        .getByRole('link', { name: 'Clientes' })
        .getAttribute('href'),
    ).toBe('/customers');
    expect(
      screen
        .getByRole('link', { name: 'Cotizaciones' })
        .getAttribute('href'),
    ).toBe('/quotes');
    expect(
      screen
        .getByRole('link', { name: 'Ventas' })
        .getAttribute('href'),
    ).toBe('/sales');
    expect(
      screen
        .getByRole('link', { name: 'Proveedores' })
        .getAttribute('href'),
    ).toBe('/suppliers');
    expect(
      screen
        .getByRole('link', { name: 'Compras' })
        .getAttribute('href'),
    ).toBe('/purchases');
    expect(
      screen
        .getByRole('link', { name: 'Productos' })
        .getAttribute('href'),
    ).toBe('/products');
    expect(
      screen
        .getByRole('link', { name: 'Inventario' })
        .getAttribute('href'),
    ).toBe('/inventory');
    expect(
      screen
        .getByRole('link', { name: 'Categorías' })
        .getAttribute('href'),
    ).toBe('/categories');
  });

  it('does not render navigation links for missing routes', () => {
    renderInShell(<div>Shell child</div>);

    expect(
      screen.queryByRole('link', { name: 'Sales' }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', { name: 'Equipment' }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', { name: 'Equipos' }),
    ).toBeNull();
  });

  it('marks Dashboard active for the Dashboard route', () => {
    navigationMock.pathname = '/dashboard';

    renderInShell(<div>Shell child</div>);

    expect(
      screen
        .getByRole('link', { name: 'Dashboard' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('marks Products active for the Products route', () => {
    navigationMock.pathname = '/products';

    renderInShell(<div>Shell child</div>);

    expect(
      screen
        .getByRole('link', { name: 'Productos' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('marks Purchases active for nested Purchase routes', () => {
    navigationMock.pathname = '/purchases/123';

    renderInShell(<div>Shell child</div>);

    expect(
      screen
        .getByRole('link', { name: 'Compras' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('marks Sales active for the Sales route', () => {
    navigationMock.pathname = '/sales';

    renderInShell(<div>Shell child</div>);

    expect(
      screen
        .getByRole('link', { name: 'Ventas' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('marks Sales active for nested Sales routes', () => {
    navigationMock.pathname = '/sales/sale-1';

    renderInShell(<div>Shell child</div>);

    expect(
      screen
        .getByRole('link', { name: 'Ventas' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('does not mark unrelated routes active', () => {
    navigationMock.pathname = '/products';

    renderInShell(<div>Shell child</div>);

    expect(
      screen
        .getByRole('link', { name: 'Compras' })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('does not activate navigation entries for root route matching', () => {
    navigationMock.pathname = '/';

    renderInShell(<div>Shell child</div>);

    const activeLinks = screen
      .getAllByRole('link')
      .filter((link) =>
        link.getAttribute('aria-current') === 'page',
      );

    expect(activeLinks).toHaveLength(0);
  });

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/products', 'Productos'],
    ['/purchases', 'Compras'],
    ['/quotes', 'Cotizaciones'],
    ['/sales', 'Ventas'],
  ])(
    'renders %s with the correct Header title',
    (pathname, title) => {
      navigationMock.pathname = pathname;

      renderInShell(<div>Shell child</div>);

      expect(
        screen.getByRole('heading', { name: title }),
      ).toBeTruthy();
    },
  );

  it('renders Products under the authenticated shell', async () => {
    navigationMock.pathname = '/products';

    renderInShell(<ProductsPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/products');
    });

    expect(screen.getByText('Zaping ERP')).toBeTruthy();
    expect(
      screen.getByText('Administra el catálogo de productos.'),
    ).toBeTruthy();
  });

  it('renders Customers under the authenticated shell', async () => {
    navigationMock.pathname = '/customers';

    renderInShell(<CustomersPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/customers');
    });

    expect(screen.getByText('Zaping ERP')).toBeTruthy();
    expect(
      screen.getByText('Administra los clientes registrados.'),
    ).toBeTruthy();
  });

  it('renders Purchases under the authenticated shell', async () => {
    navigationMock.pathname = '/purchases';

    renderInShell(<PurchasesPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/purchases');
    });

    expect(screen.getByText('Zaping ERP')).toBeTruthy();
    expect(
      screen.getByText(
        'Administra las órdenes de compra registradas.',
      ),
    ).toBeTruthy();
  });

  it('renders Sales under the authenticated shell', async () => {
    navigationMock.pathname = '/sales';

    renderInShell(<SalesPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/sales');
    });

    expect(screen.getByText('Zaping ERP')).toBeTruthy();
    expect(
      screen.getByText(
        'Consulta y da seguimiento a las ventas registradas.',
      ),
    ).toBeTruthy();
  });

  it('does not render the authenticated shell for Login', () => {
    render(<LoginPage />);

    expect(screen.queryByText('Zaping ERP')).toBeNull();
    expect(screen.queryByText('Leonardo')).toBeNull();
    expect(screen.queryByLabelText('Abrir navegación')).toBeNull();
  });

  it('does not render the authenticated shell for Register', () => {
    render(<RegisterPage />);

    expect(screen.queryByText('Zaping ERP')).toBeNull();
    expect(screen.queryByText('Leonardo')).toBeNull();
    expect(screen.queryByLabelText('Abrir navegación')).toBeNull();
  });

  it('does not render the authenticated shell for Forgot Password', () => {
    render(<ForgotPasswordPage />);

    expect(screen.queryByText('Zaping ERP')).toBeNull();
    expect(screen.queryByText('Leonardo')).toBeNull();
    expect(screen.queryByLabelText('Abrir navegación')).toBeNull();
  });

  it('renders a mobile menu control', () => {
    renderInShell(<div>Shell child</div>);

    expect(screen.getByLabelText('Abrir navegación')).toBeTruthy();
  });

  it('opens and closes the mobile navigation drawer', async () => {
    const user = userEvent.setup();

    renderInShell(<div>Shell child</div>);

    await user.click(screen.getByLabelText('Abrir navegación'));

    expect(screen.getByRole('dialog')).toBeTruthy();

    await user.click(screen.getAllByLabelText('Cerrar navegación')[0]);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the mobile navigation drawer after selecting a link', async () => {
    const user = userEvent.setup();

    renderInShell(<div>Shell child</div>);

    await user.click(screen.getByLabelText('Abrir navegación'));

    const drawer = screen.getByRole('dialog');

    const productsLink = within(drawer).getByRole('link', {
      name: 'Productos',
    });

    productsLink.addEventListener('click', (event) => {
      event.preventDefault();
    });

    await user.click(productsLink);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
