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

import QuotesPage from './page';

import type {
  Customer,
  Product,
  Quote,
} from './types';

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

const customer: Customer = {
  id: 'customer-1',
  name: 'Hospital de prueba',
  type: 'Hospital',
  contactName: 'Responsable de compras',
  email: 'hospital@example.com',
  phone: '6621234567',
  isActive: true,
};

const product: Product = {
  id: 'product-1',
  sku: 'MED-001',
  name: 'Producto médico',
  cost: 300,
  price: 500,
  stock: 20,
  minStock: 5,
  isActive: true,
};

const draftQuote: Quote = {
  id: 'quote-1',
  companyId: 'company-1',
  customerId: customer.id,

  folio: 'COT-0001',

  subtotal: 1000,
  iva: 160,
  total: 1160,

  status: 'DRAFT',
  convertedToSale: false,

  createdAt: '2026-08-13T18:00:00.000Z',
  updatedAt: '2026-08-13T18:00:00.000Z',

  customer,

  items: [
    {
      id: 'quote-item-1',
      productId: product.id,
      quantity: 2,
      price: 500,
      subtotal: 1000,

      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
      },
    },
  ],
};

const confirmedQuote: Quote = {
  ...draftQuote,
  status: 'CONFIRMED',
};

const convertedQuote: Quote = {
  ...confirmedQuote,
  convertedToSale: true,
};

function configureApiMocks(
  quotes: Quote[] = [draftQuote],
) {
  vi.mocked(api.get).mockImplementation(
    async (url) => {
      const endpoint = String(url);

      if (endpoint === '/quotes') {
        return {
          data: quotes,
        } as never;
      }

      if (endpoint === '/customers') {
        return {
          data: [customer],
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
}

function getDetailModal(
  heading: HTMLElement,
): HTMLElement {
  const modal =
    heading.parentElement?.parentElement;

  if (!modal) {
    throw new Error(
      'No fue posible localizar el modal de detalle',
    );
  }

  return modal;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let alertSpy: ReturnType<typeof vi.spyOn>;

describe('QuotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    alertSpy = vi
      .spyOn(window, 'alert')
      .mockImplementation(() => undefined);

    configureApiMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();

    cleanup();
  });

  it('carga cotizaciones, clientes y productos al iniciar', async () => {
    render(<QuotesPage />);

    expect(
      await screen.findByText('COT-0001'),
    ).toBeTruthy();

    expect(
      screen.getByText('Hospital de prueba'),
    ).toBeTruthy();

    expect(
      screen.getByText('Borrador'),
    ).toBeTruthy();

    expect(api.get).toHaveBeenCalledWith(
      '/quotes',
    );

    expect(api.get).toHaveBeenCalledWith(
      '/customers',
    );

    expect(api.get).toHaveBeenCalledWith(
      '/products',
    );
  });

  it('registra un cliente desde la cotización y lo selecciona automáticamente', async () => {
  const user = userEvent.setup();

  const newCustomer = {
    id: 'customer-2',
    name: 'Clínica nueva',
    type: 'Clínica',
    email: 'compras@clinicanueva.com',
    phone: '6627654321',
    contactName: null,
    address: null,
    notes: null,
    isActive: true,
  };

  vi.mocked(api.post).mockResolvedValue({
    data: newCustomer,
  } as never);

  render(<QuotesPage />);

  await screen.findByText('COT-0001');

  await user.click(
    screen.getByRole('button', {
      name: /nueva cotización/i,
    }),
  );

  const quoteHeading =
    await screen.findByRole('heading', {
      name: /nueva cotización/i,
    });

  const quoteModal =
    quoteHeading.parentElement?.parentElement;

  expect(quoteModal).not.toBeNull();

  const quoteScope = within(
    quoteModal as HTMLElement,
  );

  await user.click(
    quoteScope.getByRole('combobox', {
      name: 'Cliente',
    }),
  );

  await user.click(
    quoteScope.getByRole('button', {
      name: /registrar nuevo cliente/i,
    }),
  );

  const customerHeading =
    await screen.findByRole('heading', {
      name: /nuevo cliente/i,
    });

  const customerModal =
    customerHeading.parentElement?.parentElement;

  expect(customerModal).not.toBeNull();

  const customerScope = within(
    customerModal as HTMLElement,
  );

  await user.type(
    customerScope.getByLabelText(/^nombre/i),
    'Clínica nueva',
  );

  await user.type(
    customerScope.getByLabelText(/^tipo/i),
    'Clínica',
  );

  await user.type(
    customerScope.getByLabelText(/^email/i),
    'compras@clinicanueva.com',
  );

  await user.type(
    customerScope.getByLabelText(/^teléfono/i),
    '6627654321',
  );

  await user.click(
    customerScope.getByRole('button', {
      name: /registrar cliente/i,
    }),
  );

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith(
      '/customers',
      {
        name: 'Clínica nueva',
        type: 'Clínica',
        email: 'compras@clinicanueva.com',
        phone: '6627654321',
        contactName: undefined,
        address: undefined,
        notes: undefined,
      },
    );
  });

  await waitFor(() => {
    expect(
      screen.queryByRole('heading', {
        name: /^nuevo cliente$/i,
      }),
    ).toBeNull();
  });

  expect(
    within(
      quoteModal as HTMLElement,
    ).getByText('Clínica nueva'),
  ).toBeTruthy();

  expect(
    within(
      quoteModal as HTMLElement,
    ).getByText(
      'compras@clinicanueva.com',
    ),
  ).toBeTruthy();

  expect(
    screen.getByRole('heading', {
      name: /nueva cotización/i,
    }),
  ).toBeTruthy();
});

  it('muestra aprobar y cancelar para una cotización en borrador', async () => {
    render(<QuotesPage />);

    await screen.findByText('COT-0001');

    expect(
      screen.getByRole('button', {
        name: /^aprobar$/i,
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole('button', {
        name: /^cancelar$/i,
      }),
    ).toBeTruthy();

    expect(
      screen.queryByRole('button', {
        name: /^convertir a venta$/i,
      }),
    ).toBeNull();
  });

  it('permite convertir desde el detalle únicamente una cotización confirmada no convertida', async () => {
    const user = userEvent.setup();

    configureApiMocks([confirmedQuote]);

    render(<QuotesPage />);

    await screen.findByText('COT-0001');

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

    await user.click(
      screen.getByRole('button', {
        name: /ver detalle/i,
      }),
    );

    const heading = await screen.findByRole(
      'heading',
      {
        name: /cotización cot-0001/i,
      },
    );

    const detailModal =
      getDetailModal(heading);

    expect(
      within(detailModal).getByText(
        /^No convertida$/i,
      ),
    ).toBeTruthy();

    expect(
      within(detailModal).getByRole(
        'button',
        {
          name: /^convertir a venta$/i,
        },
      ),
    ).toBeTruthy();
  });

  it('no permite convertir nuevamente una cotización ya convertida', async () => {
    const user = userEvent.setup();

    configureApiMocks([convertedQuote]);

    render(<QuotesPage />);

    await screen.findByText('COT-0001');

    await user.click(
      screen.getByRole('button', {
        name: /ver detalle/i,
      }),
    );

    const heading = await screen.findByRole(
      'heading',
      {
        name: /cotización cot-0001/i,
      },
    );

    const detailModal =
      getDetailModal(heading);

    expect(
      within(detailModal).getByText(
        /^Convertida a venta$/i,
      ),
    ).toBeTruthy();

    expect(
      within(detailModal).queryByRole(
        'button',
        {
          name: /^convertir a venta$/i,
        },
      ),
    ).toBeNull();
  });

  it('convierte una cotización confirmada y recarga su estado', async () => {
    const user = userEvent.setup();

    let quoteRequestCount = 0;

    vi.mocked(api.get).mockImplementation(
      async (url) => {
        const endpoint = String(url);

        if (endpoint === '/quotes') {
          quoteRequestCount += 1;

          return {
            data: [
              quoteRequestCount === 1
                ? confirmedQuote
                : convertedQuote,
            ],
          } as never;
        }

        if (endpoint === '/customers') {
          return {
            data: [customer],
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

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'sale-1',
        quoteId: confirmedQuote.id,
        status: 'CONFIRMED',
      },
    } as never);

    render(<QuotesPage />);

    await screen.findByText('COT-0001');

    await user.click(
      screen.getByRole('button', {
        name: /ver detalle/i,
      }),
    );

    const detailHeading =
      await screen.findByRole('heading', {
        name: /cotización cot-0001/i,
      });

    const detailModal =
      getDetailModal(detailHeading);

    await user.click(
      within(detailModal).getByRole(
        'button',
        {
          name: /^convertir a venta$/i,
        },
      ),
    );

    const dialogHeading =
      await screen.findByRole('heading', {
        name: /convertir cotización a venta/i,
      });

    const dialog =
      dialogHeading.parentElement?.parentElement;

    expect(dialog).not.toBeNull();

    expect(
      within(dialog as HTMLElement).getByText(
        /descontará las existencias del inventario/i,
      ),
    ).toBeTruthy();

    await user.click(
      within(dialog as HTMLElement).getByRole(
        'button',
        {
          name: /^convertir a venta$/i,
        },
      ),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/sales/from-quote/quote-1',
      );
    });

    await waitFor(() => {
      expect(quoteRequestCount).toBe(2);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /convertir cotización a venta/i,
        }),
      ).toBeNull();
    });

    await user.click(
      screen.getByRole('button', {
        name: /ver detalle/i,
      }),
    );

    const updatedDetailHeading =
      await screen.findByRole('heading', {
        name: /cotización cot-0001/i,
      });

    const updatedDetailModal =
      getDetailModal(updatedDetailHeading);

    expect(
      within(updatedDetailModal).getByText(
        /^Convertida a venta$/i,
      ),
    ).toBeTruthy();

    expect(
      within(updatedDetailModal).queryByRole(
        'button',
        {
          name: /^convertir a venta$/i,
        },
      ),
    ).toBeNull();

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('permite buscar y seleccionar un cliente al crear una cotización', async () => {
  const user = userEvent.setup();

  render(<QuotesPage />);

  await screen.findByText('COT-0001');

  await user.click(
    screen.getByRole('button', {
      name: /nueva cotización/i,
    }),
  );

  const quoteHeading =
    await screen.findByRole('heading', {
      name: /nueva cotización/i,
    });

  const quoteModal =
    quoteHeading.parentElement?.parentElement;

  expect(quoteModal).not.toBeNull();

  const quoteScope = within(
    quoteModal as HTMLElement,
  );

  const customerSearch =
    quoteScope.getByRole('combobox', {
      name: 'Cliente',
    });

  await user.click(customerSearch);

  await user.type(
    customerSearch,
    'Hospital de prueba',
  );

  await user.click(
    quoteScope.getByRole('option', {
      name: /Hospital de prueba/i,
    }),
  );

  expect(
    quoteScope.getByText(
      'Hospital de prueba',
    ),
  ).toBeTruthy();

  expect(
    quoteScope.getByText(
      'hospital@example.com',
    ),
  ).toBeTruthy();
});

  it('muestra el error de carga y permite reintentar', async () => {
    const user = userEvent.setup();

    let firstQuotesRequest = true;

    vi.mocked(api.get).mockImplementation(
      async (url) => {
        const endpoint = String(url);

        if (endpoint === '/quotes') {
          if (firstQuotesRequest) {
            firstQuotesRequest = false;

            throw new Error(
              'Error cargando cotizaciones',
            );
          }

          return {
            data: [draftQuote],
          } as never;
        }

        if (endpoint === '/customers') {
          return {
            data: [customer],
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

    render(<QuotesPage />);

    const alert =
      await screen.findByRole('alert');

    expect(alert.textContent).toContain(
      'No fue posible cargar la información de cotizaciones.',
    );

    await user.click(
      within(alert).getByRole('button', {
        name: /reintentar/i,
      }),
    );

    expect(
      await screen.findByText('COT-0001'),
    ).toBeTruthy();

    expect(
      screen.queryByText(
        'No fue posible cargar la información de cotizaciones.',
      ),
    ).toBeNull();
  });
});