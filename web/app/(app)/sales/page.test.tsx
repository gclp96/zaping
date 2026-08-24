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

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (
    _error: unknown,
    fallbackMessage: string,
  ) => fallbackMessage,
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
}: {
  sales?: Sale[];
  customers?: SaleCustomer[];
  products?: SaleProduct[];
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

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('SalesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    configureApiMocks();
    vi.mocked(api.post).mockResolvedValue({
      data: baseSale,
    } as never);
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
    expect(screen.getByText('Hospital de prueba')).toBeTruthy();
    expect(screen.getByText(/20 ago 2026/i)).toBeTruthy();
    expect(screen.getByText('2 partidas')).toBeTruthy();
    expect(screen.getByText('$1,160.00')).toBeTruthy();
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
  });

  it('no muestra ventas falsas ni acciones de ciclo de vida', async () => {
    render(<SalesPage />);

    expect(await screen.findByText('V-000001')).toBeTruthy();
    expect(screen.queryByText('Venta de ejemplo')).toBeNull();
    expect(screen.queryByRole('button', { name: /^eliminar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^aprobar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).toBeNull();
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
