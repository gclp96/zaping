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

import type {
  Sale,
  SaleCustomer,
  SaleProduct,
} from './types';

const navigationMock = vi.hoisted(() => ({
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
  useRouter: () => navigationMock,
  useSearchParams: () => new URLSearchParams(navigationMock.search),
}));

const customer: SaleCustomer = {
  id: 'customer-1',
  name: 'Hospital de prueba',
  type: 'Hospital',
  contactName: 'Responsable de compras',
  email: 'hospital@example.com',
  phone: '6621234567',
  isActive: true,
};

const productQuantityNone: SaleProduct = {
  id: 'product-quantity-none',
  sku: 'GEN-001',
  name: 'Guantes generales',
  cost: 50,
  price: 100,
  stock: 8,
  minStock: 2,
  isActive: true,
  inventoryTracking: 'QUANTITY',
  lotTracking: 'NONE',
};

const productQuantityOptional: SaleProduct = {
  id: 'product-quantity-optional',
  sku: 'GEN-002',
  name: 'Sutura opcional',
  cost: 75,
  price: 150,
  stock: 3,
  minStock: 1,
  isActive: true,
  inventoryTracking: 'QUANTITY',
  lotTracking: 'OPTIONAL',
};

const assetProduct: SaleProduct = {
  ...productQuantityNone,
  id: 'product-asset',
  sku: 'AST-001',
  name: 'Equipo biomédico',
  inventoryTracking: 'ASSET',
};

const serializedProduct: SaleProduct = {
  ...productQuantityNone,
  id: 'product-serialized',
  sku: 'SER-001',
  name: 'Dispositivo serializado',
  inventoryTracking: 'SERIALIZED',
};

const requiredLotProduct: SaleProduct = {
  ...productQuantityNone,
  id: 'product-required-lot',
  sku: 'LOT-001',
  name: 'Reactivo con lote',
  lotTracking: 'REQUIRED',
};

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
  customer,
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

function buildSaleList(count: number): Sale[] {
  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1;
    const timestamp = new Date(
      Date.UTC(2026, 7, sequence, 18, 0, 0),
    ).toISOString();

    return {
      ...baseSale,
      id: `sale-page-${sequence}`,
      folio: `V-${String(sequence).padStart(6, '0')}`,
      subtotal: sequence * 100,
      iva: 0,
      total: sequence * 100,
      status: sequence % 2 === 0 ? 'CONFIRMED' : 'DRAFT',
      createdAt: timestamp,
      updatedAt: timestamp,
      customerId: `customer-page-${sequence}`,
      customer: {
        ...customer,
        id: `customer-page-${sequence}`,
        name: `Cliente ${String(sequence).padStart(3, '0')}`,
      },
      items: [
        {
          ...baseSale.items[0],
          id: `sale-item-page-${sequence}`,
          price: sequence * 100,
          subtotal: sequence * 100,
        },
      ],
    };
  });
}

function configureApiMocks({
  sales = [baseSale],
  customers = [customer],
  products = [
    productQuantityNone,
    productQuantityOptional,
    assetProduct,
    serializedProduct,
    requiredLotProduct,
  ],
  saleDetails,
}: {
  sales?: Sale[];
  customers?: SaleCustomer[];
  products?: SaleProduct[];
  saleDetails?: Record<string, Sale>;
} = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/sales') {
      return {
        data: sales,
      } as never;
    }

    if (endpoint === '/customers') {
      return {
        data: customers,
      } as never;
    }

    if (endpoint === '/products') {
      return {
        data: products,
      } as never;
    }

    if (endpoint.startsWith('/sales/')) {
      const saleId = endpoint.replace('/sales/', '');
      const saleDetail =
        saleDetails?.[saleId] ?? sales.find((sale) => sale.id === saleId);

      if (saleDetail) {
        return {
          data: saleDetail,
        } as never;
      }
    }

    throw new Error(`Solicitud GET no configurada: ${endpoint}`);
  });
}

async function openNewSaleModal() {
  const user = userEvent.setup();

  render(<SalesPage />);

  await screen.findByText('V-000001');
  await user.click(screen.getByRole('button', { name: /nueva venta/i }));

  return user;
}

async function selectCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
  await user.click(
    screen.getByRole('option', {
      name: /Hospital de prueba/i,
    }),
  );
}

async function selectFirstProduct(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: 'Producto' }));
  await user.click(
    screen.getByRole('option', {
      name: /GEN-001/i,
    }),
  );
}

async function openSaleDetail(
  sale: Sale = baseSale,
  sales: Sale[] = [sale],
) {
  const user = userEvent.setup();

  configureApiMocks({ sales });

  render(<SalesPage />);

  await screen.findByText(sale.folio);
  await user.click(
    screen.getByRole('button', {
      name: `Ver venta ${sale.folio}`,
    }),
  );

  return user;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let createObjectUrlSpy: ReturnType<typeof vi.fn>;
let revokeObjectUrlSpy: ReturnType<typeof vi.fn>;
let anchorClickSpy: ReturnType<typeof vi.spyOn>;

describe('SalesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMock.search = '';

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    configureApiMocks();
    vi.mocked(api.post).mockResolvedValue({
      data: baseSale,
    } as never);
    vi.mocked(api.patch).mockResolvedValue({
      data: baseSale,
    } as never);

    createObjectUrlSpy = vi.fn(() => 'blob:sale-pdf');
    revokeObjectUrlSpy = vi.fn();

    Object.defineProperty(window, 'URL', {
      configurable: true,
      value: {
        createObjectURL: createObjectUrlSpy,
        revokeObjectURL: revokeObjectUrlSpy,
      },
    });

    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    anchorClickSpy.mockRestore();
    cleanup();
  });

  it('llama GET /sales al iniciar', async () => {
    render(<SalesPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/sales');
    });
  });

  it('abre el detalle existente desde saleId usando el backend como fuente de verdad', async () => {
    const linkedSale: Sale = {
      ...confirmedSale,
      id: 'sale-123',
      folio: 'V-000123',
    };
    navigationMock.search = 'saleId=sale-123';
    configureApiMocks({
      sales: [baseSale],
      saleDetails: {
        'sale-123': linkedSale,
      },
    });

    render(<SalesPage />);

    expect(
      await screen.findByRole('heading', { name: 'Detalle de venta' }),
    ).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/sales/sale-123');
    expect(await screen.findByText('V-000123')).toBeTruthy();
    expect(screen.getByText(linkedSale.customer!.name)).toBeTruthy();
  });

  it('limpia el deep-link con replace al cerrar y conserva la lista usable', async () => {
    const user = userEvent.setup();
    navigationMock.search = 'saleId=sale-1';

    render(<SalesPage />);

    expect(
      await screen.findByRole('heading', { name: 'Detalle de venta' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cerrar modal' }));

    expect(navigationMock.replace).toHaveBeenCalledWith('/sales');
    expect(
      screen.queryByRole('heading', { name: 'Detalle de venta' }),
    ).toBeNull();
    expect(screen.getByText(baseSale.folio)).toBeTruthy();
  });

  it('mantiene la ruta normal sin abrir ni solicitar un detalle', async () => {
    render(<SalesPage />);

    expect(await screen.findByText(baseSale.folio)).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Detalle de venta' }),
    ).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith(`/sales/${baseSale.id}`);
    expect(navigationMock.replace).not.toHaveBeenCalled();
  });

  it('muestra el error de un saleId inválido y permite volver a la lista', async () => {
    const user = userEvent.setup();
    navigationMock.search = 'saleId=sale-missing';

    render(<SalesPage />);

    expect(
      await screen.findByText('No fue posible cargar el detalle de la venta.'),
    ).toBeTruthy();
    expect(screen.getByText(baseSale.folio)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(navigationMock.replace).toHaveBeenCalledWith('/sales');
    expect(
      screen.queryByText('No fue posible cargar el detalle de la venta.'),
    ).toBeNull();
    expect(screen.getByText(baseSale.folio)).toBeTruthy();
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

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/sales' && firstRequest) {
        firstRequest = false;
        throw new Error('Error cargando ventas');
      }

      if (endpoint === '/sales') {
        return { data: [baseSale] } as never;
      }

      if (endpoint === '/customers') {
        return { data: [customer] } as never;
      }

      if (endpoint === '/products') {
        return { data: [productQuantityNone] } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
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
    expect(api.get).toHaveBeenCalledWith('/sales');
  });

  it('muestra el estado vacío cuando no hay ventas', async () => {
    configureApiMocks({ sales: [] });

    render(<SalesPage />);

    expect(
      await screen.findByText('No hay ventas registradas'),
    ).toBeTruthy();
    expect(screen.queryByText('V-000001')).toBeNull();
  });

  it('renderiza folio, cliente, fecha, partidas y total', async () => {
    render(<SalesPage />);

    expect(await screen.findByText('V-000001')).toBeTruthy();
    expect(
      screen.getByRole('table', { name: 'Listado de ventas' }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole('columnheader').map((header) =>
        header.textContent?.trim(),
      ),
    ).toEqual([
      'Folio',
      'Cliente',
      'Fecha',
      'Partidas',
      'Total',
      'Estado',
      'Acciones',
    ]);
    expect(
      screen.getByRole('columnheader', { name: 'Folio' }).classList.contains(
        'hidden',
      ),
    ).toBe(false);
    expect(
      screen.getByRole('columnheader', { name: 'Fecha' }).classList.contains(
        'sm:table-cell',
      ),
    ).toBe(true);
    expect(
      screen
        .getByRole('columnheader', { name: 'Partidas' })
        .classList.contains('md:table-cell'),
    ).toBe(true);
    expect(screen.getByText('Hospital de prueba')).toBeTruthy();
    expect(screen.getByText(/20 ago 2026/i)).toBeTruthy();
    expect(screen.getByText('2 partidas')).toBeTruthy();
    expect(screen.getByText('$1,160.00')).toBeTruthy();
  });

  it('ordena por folio y total usando el valor real de cada venta', async () => {
    const user = userEvent.setup();

    configureApiMocks({
      sales: [
        {
          ...baseSale,
          id: 'sale-sort-10',
          folio: 'V-0010',
          total: 10,
          customer: { ...customer, name: 'Cliente Zeta' },
        },
        {
          ...confirmedSale,
          id: 'sale-sort-2',
          folio: 'V-0002',
          total: 200,
          customer: { ...customer, name: 'Cliente Alfa' },
        },
        {
          ...cancelledSale,
          id: 'sale-sort-1',
          folio: 'V-0001',
          total: 100,
          customer: { ...customer, name: 'Cliente Medio' },
        },
      ],
    });

    render(<SalesPage />);
    await screen.findByText('V-0010');

    const folioHeader = screen.getByRole('columnheader', {
      name: 'Folio',
    });
    await user.click(
      within(folioHeader).getByRole('button', { name: 'Folio' }),
    );

    expect(folioHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(
      screen.getAllByRole('row').slice(1).map((row) =>
        within(row).getAllByRole('cell')[0].textContent?.trim(),
      ),
    ).toEqual(['V-0001', 'V-0002', 'V-0010']);

    await user.click(screen.getByRole('button', { name: 'Total' }));
    expect(
      screen.getAllByRole('row').slice(1).map((row) =>
        within(row).getAllByRole('cell')[0].textContent?.trim(),
      ),
    ).toEqual(['V-0010', 'V-0001', 'V-0002']);
  });

  it('pagina 30 ventas y reinicia página al cambiar filtro, tamaño y búsqueda', async () => {
    const user = userEvent.setup();
    configureApiMocks({ sales: buildSaleList(30) });

    render(<SalesPage />);
    await screen.findByText('V-000001');

    expect(screen.getByText('Mostrando 1-25 de 30')).toBeTruthy();
    expect(screen.queryByText('V-000026')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('Mostrando 26-30 de 30')).toBeTruthy();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado' }),
      'CONFIRMED',
    );
    expect(screen.getByText('Mostrando 1-15 de 15')).toBeTruthy();
    expect(screen.getByText('V-000002')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Mostrando 1-25 de 30')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filas por página' }),
      '10',
    );
    expect(screen.getByText('Mostrando 1-10 de 30')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar' }),
      'V-000030',
    );
    expect(screen.getByText('Mostrando 1-1 de 1')).toBeTruthy();
    expect(screen.getByText('V-000030')).toBeTruthy();
  });

  it('mapea DRAFT, CONFIRMED y CANCELLED a etiquetas en español', async () => {
    configureApiMocks({
      sales: [baseSale, confirmedSale, cancelledSale],
    });

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

    configureApiMocks({ sales: [baseSale, confirmedSale] });

    render(<SalesPage />);

    await screen.findByText('V-000001');
    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), '000002');

    expect(screen.queryByText('V-000001')).toBeNull();
    expect(screen.getByText('V-000002')).toBeTruthy();
  });

  it('busca por cliente sin distinguir mayúsculas', async () => {
    const user = userEvent.setup();

    configureApiMocks({ sales: [baseSale, confirmedSale] });

    render(<SalesPage />);

    await screen.findByText('Hospital de prueba');
    await user.type(
      screen.getByRole('searchbox', { name: /buscar/i }),
      'clínica norte',
    );

    expect(screen.queryByText('Hospital de prueba')).toBeNull();
    expect(screen.getByText('Clínica Norte')).toBeTruthy();
  });

  it('filtra por estado localmente', async () => {
    const user = userEvent.setup();

    configureApiMocks({ sales: [baseSale, confirmedSale, cancelledSale] });

    render(<SalesPage />);

    await screen.findByText('V-000001');
    await user.selectOptions(
      screen.getByRole('combobox', { name: /estado/i }),
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
      screen.getByRole('searchbox', { name: /buscar/i }),
      'sin coincidencias',
    );

    expect(
      screen.getByText(
        'No se encontraron ventas con los filtros seleccionados.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('No hay ventas registradas')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('V-000001')).toBeTruthy();
  });

  it('no muestra ventas falsas ni acciones de ciclo de vida', async () => {
    render(<SalesPage />);

    expect(await screen.findByText('V-000001')).toBeTruthy();
    expect(screen.queryByText('Venta de ejemplo')).toBeNull();
    expect(
      screen.getByRole('button', { name: /ver venta v-000001/i }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^eliminar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^aprobar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).toBeNull();
  });

  it('abre detalle con GET /sales/:id y muestra el estado de carga', async () => {
    const user = userEvent.setup();
    let resolveDetail!: () => void;

    vi.mocked(api.get).mockImplementation((url) => {
      const endpoint = String(url);

      if (endpoint === '/sales') {
        return Promise.resolve({ data: [baseSale] } as never);
      }

      if (endpoint === '/customers') {
        return Promise.resolve({ data: [customer] } as never);
      }

      if (endpoint === '/products') {
        return Promise.resolve({ data: [productQuantityNone] } as never);
      }

      if (endpoint === '/sales/sale-1') {
        return new Promise((resolve) => {
          resolveDetail = () => resolve({ data: baseSale } as never);
        });
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    render(<SalesPage />);

    await screen.findByText('V-000001');
    await user.click(
      screen.getByRole('button', { name: /ver venta v-000001/i }),
    );

    expect(api.get).toHaveBeenCalledWith('/sales/sale-1');
    expect(screen.getByText('Cargando detalle de venta...')).toBeTruthy();

    resolveDetail();
  });

  it('muestra error de detalle y permite cerrar o reintentar', async () => {
    const user = userEvent.setup();

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/sales') {
        return { data: [baseSale] } as never;
      }

      if (endpoint === '/customers') {
        return { data: [customer] } as never;
      }

      if (endpoint === '/products') {
        return { data: [productQuantityNone] } as never;
      }

      if (endpoint === '/sales/sale-1') {
        throw new Error('Detalle no disponible');
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    render(<SalesPage />);

    await screen.findByText('V-000001');
    await user.click(
      screen.getByRole('button', { name: /ver venta v-000001/i }),
    );

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toContain(
      'No fue posible cargar el detalle de la venta.',
    );

    await user.click(
      within(alert).getByRole('button', { name: /reintentar/i }),
    );

    expect(api.get).toHaveBeenCalledWith('/sales/sale-1');
  });

  it('renderiza el detalle persistido de la venta', async () => {
    await openSaleDetail(baseSale);

    expect(await screen.findByRole('heading', { name: /detalle de venta/i }))
      .toBeTruthy();
    expect(screen.getAllByText('V-000001').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Hospital de prueba').length).toBeGreaterThan(1);
    expect(screen.getByText('MED-001')).toBeTruthy();
    expect(screen.getByText('Producto médico')).toBeTruthy();
    expect(screen.getByText('MED-002')).toBeTruthy();
    expect(screen.getByText('Insumo médico')).toBeTruthy();
    expect(screen.getAllByText('2').length).toBeGreaterThan(1);
    expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$1,000.00').length).toBeGreaterThan(1);
    expect(screen.getByText('$160.00')).toBeTruthy();
    expect(screen.getAllByText('$1,160.00').length).toBeGreaterThan(1);
    expect(
      screen.getAllByLabelText('Estado de la venta: Borrador').length,
    ).toBeGreaterThan(1);
  });

  it('muestra estados terminales y origen de cotización en detalle', async () => {
    const quotedConfirmedSale: Sale = {
      ...confirmedSale,
      quoteId: 'quote-1',
    };

    await openSaleDetail(quotedConfirmedSale, [quotedConfirmedSale, cancelledSale]);

    expect(
      await screen.findAllByLabelText('Estado de la venta: Confirmada'),
    ).toHaveLength(2);
    expect(screen.getByText('Cotización')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^aprobar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).toBeNull();

    cleanup();
    consoleErrorSpy.mockRestore();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await openSaleDetail(cancelledSale, [cancelledSale]);

    expect(
      await screen.findAllByLabelText('Estado de la venta: Cancelada'),
    ).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^aprobar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).toBeNull();
  });

  it('aprueba una venta DRAFT con confirmación, sin payload inventado, y refresca lista y detalle', async () => {
    const user = userEvent.setup();
    const approvedSale: Sale = {
      ...baseSale,
      status: 'CONFIRMED',
    };
    let currentSale = baseSale;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/sales') {
        return { data: [currentSale] } as never;
      }

      if (endpoint === '/customers') {
        return { data: [customer] } as never;
      }

      if (endpoint === '/products') {
        return { data: [productQuantityNone] } as never;
      }

      if (endpoint === '/sales/sale-1') {
        return { data: currentSale } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    vi.mocked(api.patch).mockImplementation(async (url, body) => {
      expect(url).toBe('/sales/sale-1/approve');
      expect(body).toBeUndefined();

      currentSale = approvedSale;
      return { data: approvedSale } as never;
    });

    render(<SalesPage />);

    await screen.findByText('V-000001');
    await user.click(
      screen.getByRole('button', { name: /ver venta v-000001/i }),
    );

    await screen.findByRole('heading', { name: /detalle de venta/i });
    await user.click(
      screen.getAllByRole('button', { name: /^aprobar$/i }).at(-1)!,
    );

    expect(screen.getByText(/se descontará el inventario/i)).toBeTruthy();

    await user.click(
      screen.getAllByRole('button', { name: /^aprobar$/i }).at(-1)!,
    );

    expect(api.patch).toHaveBeenCalledWith('/sales/sale-1/approve');
    expect(
      await screen.findAllByLabelText('Estado de la venta: Confirmada'),
    ).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^aprobar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/sales');
    expect(api.get).toHaveBeenCalledWith('/sales/sale-1');
  });

  it('muestra error al aprobar y mantiene el detalle abierto', async () => {
    const user = await openSaleDetail(baseSale);

    vi.mocked(api.patch).mockRejectedValue(
      new Error('Stock insuficiente'),
    );

    await screen.findByRole('heading', { name: /detalle de venta/i });
    await user.click(screen.getByRole('button', { name: /^aprobar$/i }));
    await user.click(
      screen.getAllByRole('button', { name: /^aprobar$/i }).at(-1)!,
    );

    expect(await screen.findByText('No fue posible aprobar la venta.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /detalle de venta/i })).toBeTruthy();
  });

  it('evita doble aprobación mientras la solicitud está pendiente', async () => {
    const user = await openSaleDetail(baseSale);
    let resolveApprove!: () => void;

    vi.mocked(api.patch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApprove = () => resolve({ data: confirmedSale } as never);
        }),
    );

    await screen.findByRole('heading', { name: /detalle de venta/i });
    await user.click(screen.getByRole('button', { name: /^aprobar$/i }));

    const confirmButton = screen
      .getAllByRole('button', { name: /^aprobar$/i })
      .at(-1)!;
    await user.dblClick(confirmButton);

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole('button', {
        name: /aprobando/i,
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    resolveApprove();
  });

  it('cancela una venta DRAFT con confirmación, sin razón, y refresca lista y detalle', async () => {
    const user = userEvent.setup();
    const cancelledDetail: Sale = {
      ...baseSale,
      status: 'CANCELLED',
    };
    let currentSale = baseSale;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/sales') {
        return { data: [currentSale] } as never;
      }

      if (endpoint === '/customers') {
        return { data: [customer] } as never;
      }

      if (endpoint === '/products') {
        return { data: [productQuantityNone] } as never;
      }

      if (endpoint === '/sales/sale-1') {
        return { data: currentSale } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    vi.mocked(api.patch).mockImplementation(async (url, body) => {
      expect(url).toBe('/sales/sale-1/cancel');
      expect(body).toBeUndefined();

      currentSale = cancelledDetail;
      return { data: cancelledDetail } as never;
    });

    render(<SalesPage />);

    await screen.findByText('V-000001');
    await user.click(
      screen.getByRole('button', { name: /ver venta v-000001/i }),
    );

    await screen.findByRole('heading', { name: /detalle de venta/i });
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));

    expect(
      screen.getByText(/esta venta en borrador será cancelada/i),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: /cancelar venta/i }),
    );

    expect(api.patch).toHaveBeenCalledWith('/sales/sale-1/cancel');
    expect(
      await screen.findAllByLabelText('Estado de la venta: Cancelada'),
    ).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^aprobar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/sales');
    expect(api.get).toHaveBeenCalledWith('/sales/sale-1');
  });

  it('muestra error al cancelar y mantiene el detalle abierto', async () => {
    const user = await openSaleDetail(baseSale);

    vi.mocked(api.patch).mockRejectedValue(
      new Error('Estado inválido'),
    );

    await screen.findByRole('heading', { name: /detalle de venta/i });
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
    await user.click(screen.getByRole('button', { name: /cancelar venta/i }));

    expect(await screen.findByText('No fue posible cancelar la venta.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /detalle de venta/i })).toBeTruthy();
  });

  it('evita doble cancelación mientras la solicitud está pendiente', async () => {
    const user = await openSaleDetail(baseSale);
    let resolveCancel!: () => void;

    vi.mocked(api.patch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCancel = () => resolve({ data: cancelledSale } as never);
        }),
    );

    await screen.findByRole('heading', { name: /detalle de venta/i });
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));

    const confirmButton = screen.getByRole('button', {
      name: /cancelar venta/i,
    });
    await user.dblClick(confirmButton);

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole('button', {
        name: /cancelando/i,
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    resolveCancel();
  });

  it('descarga PDF como blob y muestra errores sin cerrar el detalle', async () => {
    const user = await openSaleDetail(baseSale);
    const pdfBlob = new Blob(['PDF'], {
      type: 'application/pdf',
    });

    vi.mocked(api.get).mockImplementation(async (url, config) => {
      const endpoint = String(url);

      if (endpoint === '/sales/sale-1/pdf') {
        expect(config).toEqual({
          responseType: 'blob',
        });

        return { data: pdfBlob } as never;
      }

      if (endpoint === '/sales/sale-1') {
        return { data: baseSale } as never;
      }

      if (endpoint === '/sales') {
        return { data: [baseSale] } as never;
      }

      if (endpoint === '/customers') {
        return { data: [customer] } as never;
      }

      if (endpoint === '/products') {
        return { data: [productQuantityNone] } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    await screen.findByRole('heading', { name: /detalle de venta/i });
    await user.click(screen.getByRole('button', { name: /descargar pdf/i }));

    expect(api.get).toHaveBeenCalledWith('/sales/sale-1/pdf', {
      responseType: 'blob',
    });
    expect(createObjectUrlSpy).toHaveBeenCalledWith(pdfBlob);
    expect(anchorClickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:sale-pdf');

    vi.mocked(api.get).mockRejectedValue(new Error('PDF falló'));

    await user.click(screen.getByRole('button', { name: /descargar pdf/i }));

    expect(await screen.findByText('No fue posible descargar el PDF.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /detalle de venta/i })).toBeTruthy();
  });

  it('renderiza Nueva venta y abre el modal', async () => {
    await openNewSaleModal();

    expect(
      screen.getByRole('heading', {
        name: /nueva venta/i,
      }),
    ).toBeTruthy();
  });

  it('carga clientes y productos compatibles en el modal', async () => {
    const user = await openNewSaleModal();

    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    expect(screen.getAllByText('Hospital de prueba').length).toBeGreaterThan(1);

    await user.click(screen.getByRole('combobox', { name: 'Producto' }));
    expect(screen.getByText(/GEN-001.*Guantes generales/i)).toBeTruthy();
    expect(screen.getByText(/GEN-002.*Sutura opcional/i)).toBeTruthy();
    expect(screen.queryByText(/Equipo biomédico/i)).toBeNull();
    expect(screen.queryByText(/Dispositivo serializado/i)).toBeNull();
    expect(screen.queryByText(/Reactivo con lote/i)).toBeNull();
  });

  it('muestra stock y precio informativo de productos compatibles', async () => {
    const user = await openNewSaleModal();

    await user.click(screen.getByRole('combobox', { name: 'Producto' }));

    expect(screen.getByText('Stock: 8')).toBeTruthy();
    expect(screen.getByText('Precio: $100.00')).toBeTruthy();
  });

  it('agrega y quita partidas de venta', async () => {
    const user = await openNewSaleModal();

    await selectFirstProduct(user);
    await user.click(screen.getByRole('button', { name: /agregar producto/i }));

    expect(screen.getByText('Guantes generales')).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: /quitar guantes generales/i,
      }),
    );

    expect(screen.queryByText('Guantes generales')).toBeNull();
    expect(
      screen.getByText('Todavía no se han agregado productos.'),
    ).toBeTruthy();
  });

  it('valida cantidad, cliente requerido y al menos una partida', async () => {
    const user = await openNewSaleModal();

    await user.click(screen.getByRole('button', { name: /crear venta/i }));

    expect(screen.getByText('Selecciona un cliente.')).toBeTruthy();
    expect(screen.getByText('Agrega al menos un producto.')).toBeTruthy();

    await selectFirstProduct(user);
    await user.clear(screen.getByRole('spinbutton', { name: /cantidad/i }));
    await user.type(screen.getByRole('spinbutton', { name: /cantidad/i }), '0');
    await user.click(screen.getByRole('button', { name: /agregar producto/i }));

    expect(
      screen.getByText('La cantidad debe ser un número entero mayor a cero.'),
    ).toBeTruthy();
  });

  it('evita productos duplicados en la venta', async () => {
    const user = await openNewSaleModal();

    await selectFirstProduct(user);
    await user.click(screen.getByRole('button', { name: /agregar producto/i }));
    await user.click(screen.getByRole('combobox', { name: 'Producto' }));

    const duplicatedOption = screen.getByRole('option', { name: /GEN-001/i });

    expect(duplicatedOption.getAttribute('aria-disabled')).toBe('true');
  });

  it('calcula el preview de totales con IVA de venta', async () => {
    const user = await openNewSaleModal();

    await selectFirstProduct(user);
    await user.clear(screen.getByRole('spinbutton', { name: /cantidad/i }));
    await user.type(screen.getByRole('spinbutton', { name: /cantidad/i }), '2');
    await user.click(screen.getByRole('button', { name: /agregar producto/i }));

    expect(screen.getAllByText('$200.00').length).toBeGreaterThan(1);
    expect(screen.getByText('$32.00')).toBeTruthy();
    expect(screen.getByText('$232.00')).toBeTruthy();
  });

  it('envía solamente customerId e items con productId y quantity', async () => {
    const user = await openNewSaleModal();

    await selectCustomer(user);
    await selectFirstProduct(user);
    await user.click(screen.getByRole('button', { name: /agregar producto/i }));
    await user.click(screen.getByRole('button', { name: /crear venta/i }));

    expect(api.post).toHaveBeenCalledWith('/sales', {
      customerId: 'customer-1',
      items: [
        {
          productId: 'product-quantity-none',
          quantity: 1,
        },
      ],
    });

    const payload = vi.mocked(api.post).mock.calls[0][1] as Record<
      string,
      unknown
    >;

    expect(payload).not.toHaveProperty('price');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('folio');
    expect(payload).not.toHaveProperty('companyId');
  });

  it('protege contra doble submit mientras crea la venta', async () => {
    const user = await openNewSaleModal();
    let resolvePost!: () => void;

    vi.mocked(api.post).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = () => resolve({ data: baseSale } as never);
        }),
    );

    await selectCustomer(user);
    await selectFirstProduct(user);
    await user.click(screen.getByRole('button', { name: /agregar producto/i }));

    const submit = screen.getByRole('button', { name: /crear venta/i });
    await user.dblClick(submit);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole('button', {
        name: /creando/i,
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    resolvePost();
  });

  it('cierra el modal, refresca la lista y muestra la venta DRAFT creada', async () => {
    const user = userEvent.setup();
    let salesRequest = 0;
    const createdSale: Sale = {
      ...baseSale,
      id: 'sale-created',
      folio: 'V-000009',
      status: 'DRAFT',
    };

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/sales') {
        salesRequest += 1;
        return {
          data: salesRequest === 1 ? [] : [createdSale],
        } as never;
      }

      if (endpoint === '/customers') {
        return { data: [customer] } as never;
      }

      if (endpoint === '/products') {
        return { data: [productQuantityNone] } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    render(<SalesPage />);

    await screen.findByText('No hay ventas registradas');
    await user.click(screen.getByRole('button', { name: /nueva venta/i }));
    await selectCustomer(user);
    await selectFirstProduct(user);
    await user.click(screen.getByRole('button', { name: /agregar producto/i }));
    await user.click(screen.getByRole('button', { name: /crear venta/i }));

    expect(await screen.findByText('V-000009')).toBeTruthy();
    expect(screen.getByLabelText('Estado de la venta: Borrador')).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: /nueva venta/i }),
    ).toBeNull();
  });

  it('muestra errores de API y mantiene abierto el modal', async () => {
    const user = await openNewSaleModal();

    vi.mocked(api.post).mockRejectedValue(
      new Error('Producto incompatible'),
    );

    await selectCustomer(user);
    await selectFirstProduct(user);
    await user.click(screen.getByRole('button', { name: /agregar producto/i }));
    await user.click(screen.getByRole('button', { name: /crear venta/i }));

    expect(await screen.findByText('No fue posible crear la venta.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /nueva venta/i })).toBeTruthy();
  });

  it('explica cuando no hay clientes o productos compatibles', async () => {
    const user = userEvent.setup();

    configureApiMocks({
      sales: [baseSale],
      customers: [],
      products: [assetProduct, requiredLotProduct],
    });

    render(<SalesPage />);

    await screen.findByText('V-000001');
    await user.click(screen.getByRole('button', { name: /nueva venta/i }));

    expect(screen.getByText('No hay clientes registrados.')).toBeTruthy();
    expect(
      screen.getByText('No hay productos compatibles con venta genérica.'),
    ).toBeTruthy();
  });
});
