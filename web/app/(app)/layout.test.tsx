import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
import ForgotPasswordPage from '../(public)/forgot-password/page';
import LoginPage from '../(public)/login/page';
import RegisterPage from '../(public)/register/page';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
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

  it('renders the Header', () => {
    renderInShell(<div>Shell child</div>);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('Leonardo')).toBeTruthy();
  });

  it('renders children in the main content region', () => {
    renderInShell(<div>Shell child</div>);

    expect(screen.getByText('Shell child')).toBeTruthy();
  });

  it('renders Dashboard in the shared shell without a duplicate Sidebar', async () => {
    const { container } = renderInShell(<DashboardPage />);

    expect(
      await screen.findByText(
        'Resumen general de la actividad de la empresa.',
      ),
    ).toBeTruthy();
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(screen.getAllByText('Zaping ERP')).toHaveLength(1);
  });

  it('renders Products under the authenticated shell', async () => {
    renderInShell(<ProductsPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/products');
    });

    expect(screen.getByText('Zaping ERP')).toBeTruthy();
    expect(screen.getAllByText('Productos')).toHaveLength(2);
  });

  it('renders Customers under the authenticated shell', async () => {
    renderInShell(<CustomersPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/customers');
    });

    expect(screen.getByText('Zaping ERP')).toBeTruthy();
    expect(screen.getAllByText('Clientes')).toHaveLength(2);
  });

  it('renders Purchases under the authenticated shell', async () => {
    renderInShell(<PurchasesPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/purchases');
    });

    expect(screen.getByText('Zaping ERP')).toBeTruthy();
    expect(screen.getAllByText('Compras')).toHaveLength(2);
  });

  it('does not render the authenticated shell for Login', () => {
    render(<LoginPage />);

    expect(screen.queryByText('Zaping ERP')).toBeNull();
    expect(screen.queryByText('Leonardo')).toBeNull();
  });

  it('does not render the authenticated shell for Register', () => {
    render(<RegisterPage />);

    expect(screen.queryByText('Zaping ERP')).toBeNull();
    expect(screen.queryByText('Leonardo')).toBeNull();
  });

  it('does not render the authenticated shell for Forgot Password', () => {
    render(<ForgotPasswordPage />);

    expect(screen.queryByText('Zaping ERP')).toBeNull();
    expect(screen.queryByText('Leonardo')).toBeNull();
  });
});
