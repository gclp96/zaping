import {
  cleanup,
  render,
  screen,
  waitFor,
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

import CustomersPage from './page';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

const clinicCustomer = {
  id: 'customer-clinic',
  name: 'Clínica Norte',
  type: 'Clínica',
  email: 'contacto@norte.test',
  phone: '6621001000',
  address: 'Hermosillo Centro',
  contactName: 'Ana López',
  notes: 'Cuenta clínica',
};

const hospitalCustomer = {
  id: 'customer-hospital',
  name: 'Hospital del Sur',
  type: 'Hospital',
  email: 'compras@sur.test',
  phone: '6442002000',
  address: 'Ciudad Obregón',
  contactName: 'Luis Pérez',
  notes: null,
};

const customers = [clinicCustomer, hospitalCustomer];

function configureApiMocks(customerData = customers) {
  vi.mocked(api.get).mockResolvedValue({ data: customerData } as never);
  vi.mocked(api.post).mockResolvedValue({ data: clinicCustomer } as never);
  vi.mocked(api.patch).mockResolvedValue({ data: clinicCustomer } as never);
  vi.mocked(api.delete).mockResolvedValue({ data: {} } as never);
}

async function renderCustomersPage() {
  render(<CustomersPage />);
  await screen.findByText(clinicCustomer.name);
}

async function completeCustomerForm(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.type(screen.getByRole('textbox', { name: 'Nombre' }), name);
  await user.type(screen.getByRole('textbox', { name: 'Tipo' }), 'Clínica');
  await user.type(
    screen.getByRole('textbox', { name: 'Email' }),
    'nuevo@cliente.test',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Teléfono' }),
    '6623334444',
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('CustomersPage', () => {
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

  it('carga las columnas útiles y busca por nombre, email y teléfono', async () => {
    const user = userEvent.setup();
    render(<CustomersPage />);

    expect(screen.getByText('Cargando clientes...')).toBeTruthy();
    expect(await screen.findByText(clinicCustomer.name)).toBeTruthy();
    expect(screen.getByText(clinicCustomer.email)).toBeTruthy();
    expect(screen.getByText(clinicCustomer.phone)).toBeTruthy();
    expect(screen.getByText(clinicCustomer.address)).toBeTruthy();

    const search = screen.getByRole('searchbox', { name: 'Buscar clientes' });

    await user.type(search, '  clínica norte  ');
    expect(screen.getByText(clinicCustomer.name)).toBeTruthy();
    expect(screen.queryByText(hospitalCustomer.name)).toBeNull();

    await user.clear(search);
    await user.type(search, hospitalCustomer.email.toUpperCase());
    expect(screen.getByText(hospitalCustomer.name)).toBeTruthy();
    expect(screen.queryByText(clinicCustomer.name)).toBeNull();

    await user.clear(search);
    await user.type(search, clinicCustomer.phone);
    expect(screen.getByText(clinicCustomer.name)).toBeTruthy();

    await user.clear(search);
    await user.type(search, 'sin coincidencias');
    expect(screen.getByText('Sin clientes coincidentes')).toBeTruthy();
    expect(
      screen.getByText('No encontramos clientes con esa búsqueda.'),
    ).toBeTruthy();
  });

  it('muestra un error de carga y permite reintentar', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Clientes no disponibles'))
      .mockResolvedValueOnce({ data: customers } as never);

    render(<CustomersPage />);

    expect(await screen.findByText('Clientes no disponibles')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText(clinicCustomer.name)).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('presenta un estado vacío útil', async () => {
    configureApiMocks([]);

    render(<CustomersPage />);

    expect(await screen.findByText('Sin clientes activos')).toBeTruthy();
    expect(
      screen.getByText(
        'Registra un cliente para comenzar a usarlo en cotizaciones y ventas.',
      ),
    ).toBeTruthy();
  });

  it('crea un cliente sin lifecycle, refresca la lista y cierra el formulario', async () => {
    const user = userEvent.setup();
    const newCustomer = {
      ...clinicCustomer,
      id: 'customer-new',
      name: 'Cliente Nuevo',
      email: 'nuevo@cliente.test',
      phone: '6623334444',
      address: null,
      contactName: null,
      notes: null,
    };
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: customers } as never)
      .mockResolvedValue({ data: [...customers, newCustomer] } as never);
    vi.mocked(api.post).mockResolvedValue({ data: newCustomer } as never);

    await renderCustomersPage();
    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await completeCustomerForm(user, newCustomer.name);
    await user.click(
      screen.getByRole('button', { name: 'Registrar cliente' }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/customers', {
        name: newCustomer.name,
        type: 'Clínica',
        email: newCustomer.email,
        phone: newCustomer.phone,
        contactName: undefined,
        address: undefined,
        notes: undefined,
      });
    });
    expect(await screen.findByText(newCustomer.name)).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Nuevo cliente' }),
    ).toBeNull();
  });

  it('mantiene abierto el formulario y muestra el error de creación', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue(new Error('Cliente duplicado'));

    await renderCustomersPage();
    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await completeCustomerForm(user, 'Cliente Duplicado');
    await user.click(
      screen.getByRole('button', { name: 'Registrar cliente' }),
    );

    expect(await screen.findByText('Cliente duplicado')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Nuevo cliente' }),
    ).toBeTruthy();
  });

  it('edita con el payload existente y sin campos de lifecycle', async () => {
    const user = userEvent.setup();
    const updatedCustomer = {
      ...clinicCustomer,
      name: 'Clínica Norte Actualizada',
    };
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: customers } as never)
      .mockResolvedValue({ data: [updatedCustomer, hospitalCustomer] } as never);
    vi.mocked(api.patch).mockResolvedValue({ data: updatedCustomer } as never);

    await renderCustomersPage();
    await user.click(
      screen.getByRole('button', {
        name: `Editar cliente ${clinicCustomer.name}`,
      }),
    );
    const nameInput = screen.getByRole('textbox', { name: 'Nombre' });
    await user.clear(nameInput);
    await user.type(nameInput, updatedCustomer.name);
    await user.click(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        `/customers/${clinicCustomer.id}`,
        {
          name: updatedCustomer.name,
          type: clinicCustomer.type,
          email: clinicCustomer.email,
          phone: clinicCustomer.phone,
          contactName: clinicCustomer.contactName,
          address: clinicCustomer.address,
          notes: clinicCustomer.notes,
        },
      );
    });
    expect(await screen.findByText(updatedCustomer.name)).toBeTruthy();
  });

  it('desactiva con lenguaje no destructivo y refresca la lista activa', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: customers } as never)
      .mockResolvedValueOnce({ data: [hospitalCustomer] } as never);

    await renderCustomersPage();
    await user.click(
      screen.getByRole('button', {
        name: `Desactivar cliente ${clinicCustomer.name}`,
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'Desactivar cliente' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /El cliente dejará de aparecer en las operaciones nuevas\. Su historial se conservará\./,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/eliminar/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(api.delete).toHaveBeenCalledWith(
      `/customers/${clinicCustomer.id}`,
    );
    await waitFor(() => {
      expect(screen.queryByText(clinicCustomer.name)).toBeNull();
    });
    expect(screen.getByText(hospitalCustomer.name)).toBeTruthy();
  });

  it('conserva el cliente y permite reintentar cuando falla la desactivación', async () => {
    const user = userEvent.setup();
    vi.mocked(api.delete).mockRejectedValue(
      new Error('No fue posible desactivar este cliente'),
    );

    await renderCustomersPage();
    await user.click(
      screen.getByRole('button', {
        name: `Desactivar cliente ${clinicCustomer.name}`,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(
      await screen.findByText('No fue posible desactivar este cliente'),
    ).toBeTruthy();
    expect(screen.getAllByText(clinicCustomer.name).length).toBeGreaterThan(0);
    expect(api.delete).toHaveBeenCalledTimes(1);
  });
});
