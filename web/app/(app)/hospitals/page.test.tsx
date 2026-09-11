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

import {
  clearAuthenticatedSessionCache,
  type UserRole,
} from '@/app/auth-session';
import { api } from '@/services/api';

import HospitalsPage from './page';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  isForbiddenError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'response' in error &&
        (error as { response?: { status?: number } }).response?.status === 403,
    ),
}));

const hospital = {
  id: 'hospital-1',
  name: 'Hospital Central',
  city: 'Hermosillo',
  state: 'Sonora',
  address: 'Blvd. Salud 100',
  phone: '6625552000',
  email: 'contacto@central.test',
  contactName: 'Laura Soto',
  isActive: true,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

const hospitalDetail = {
  ...hospital,
  notes: 'Recepción por urgencias.',
  affiliationSummary: { active: 4, total: 5 },
};

function authResponse(role: UserRole) {
  return {
    data: {
      id: `${role.toLowerCase()}-1`,
      companyId: 'company-1',
      email: `${role.toLowerCase()}@test.test`,
      firstName: role,
      lastName: 'Test',
      role,
      companyTimezone: 'America/Hermosillo',
    },
  } as never;
}

function pageResponse(items = [hospital]) {
  return {
    data: {
      items,
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: items.length,
        totalPages: items.length ? 1 : 0,
      },
    },
  } as never;
}

function configureApi(role: UserRole = 'ADMIN', items = [hospital]) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const path = String(url);
    if (path === '/auth/me') return authResponse(role);
    if (path === '/healthcare/hospitals') return pageResponse(items);
    if (path === `/healthcare/hospitals/${hospital.id}`) {
      return { data: hospitalDetail } as never;
    }
    throw new Error(`Unexpected endpoint ${path}`);
  });
  vi.mocked(api.post).mockResolvedValue({
    data: { outcome: 'CREATED', data: hospitalDetail },
  } as never);
  vi.mocked(api.patch).mockResolvedValue({
    data: { outcome: 'UPDATED', data: hospitalDetail },
  } as never);
}

async function renderHospitals(role: UserRole = 'ADMIN') {
  configureApi(role);
  render(<HospitalsPage />);
  await screen.findByText('Hospital Central');
}

async function openAction(
  user: ReturnType<typeof userEvent.setup>,
  action: 'Ver detalle' | 'Editar' | 'Cambiar estado',
) {
  const row = screen.getByText('Hospital Central').closest('tr');
  if (!row) throw new Error('Missing Hospital Central row');

  await user.click(
    within(row).getByRole('button', {
      name: 'Acciones del hospital Hospital Central',
    }),
  );
  await user.click(screen.getByRole('menuitem', { name: action }));
}

function listCalls() {
  return vi
    .mocked(api.get)
    .mock.calls.filter(([url]) => String(url) === '/healthcare/hospitals');
}

describe('HospitalsPage', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearAuthenticatedSessionCache();
    vi.clearAllMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
    clearAuthenticatedSessionCache();
  });

  it('renderiza hospital, contexto ciudad/estado y detalle', async () => {
    const user = userEvent.setup();
    configureApi();
    render(<HospitalsPage />);

    expect(screen.getByText('Cargando hospitales...')).toBeTruthy();
    expect(await screen.findByText('Hospital Central')).toBeTruthy();
    expect(screen.getByText('Hermosillo, Sonora')).toBeTruthy();
    expect(screen.getByText('Laura Soto')).toBeTruthy();

    await openAction(user, 'Ver detalle');
    expect(await screen.findByText('Recepción por urgencias.')).toBeTruthy();
    expect(screen.getByText('Afiliaciones activas')).toBeTruthy();
    expect(screen.queryByText('company-1')).toBeNull();
  });

  it('envía búsqueda, ubicación exacta y estado como filtros server-side', async () => {
    const user = userEvent.setup();
    await renderHospitals();

    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar hospitales' }),
      ' central ',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Ciudad exacta' }),
      ' Hermosillo ',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Estado exacto' }),
      ' Sonora ',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado del registro' }),
      'ALL',
    );

    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toMatchObject({
        params: {
          page: 1,
          pageSize: 25,
          status: 'ALL',
          search: 'central',
          city: 'Hermosillo',
          state: 'Sonora',
        },
      }),
    );
  });

  it.each(['ADMIN', 'MANAGER'] as const)(
    'muestra create/edit/lifecycle a %s',
    async (role) => {
      const user = userEvent.setup();
      await renderHospitals(role);

      expect(screen.getByRole('button', { name: 'Nuevo hospital' })).toBeTruthy();
      const row = screen.getByText('Hospital Central').closest('tr');
      await user.click(
        within(row as HTMLTableRowElement).getByRole('button', {
          name: 'Acciones del hospital Hospital Central',
        }),
      );
      expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeTruthy();
      expect(
        screen.getByRole('menuitem', { name: 'Cambiar estado' }),
      ).toBeTruthy();
    },
  );

  it('conserva create/edit para SALES sin lifecycle', async () => {
    const user = userEvent.setup();
    await renderHospitals('SALES');

    expect(screen.getByRole('button', { name: 'Nuevo hospital' })).toBeTruthy();
    const row = screen.getByText('Hospital Central').closest('tr');
    await user.click(
      within(row as HTMLTableRowElement).getByRole('button', {
        name: 'Acciones del hospital Hospital Central',
      }),
    );
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Cambiar estado' })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('mantiene WAREHOUSE read-only con acceso a detalle', async () => {
    const user = userEvent.setup();
    await renderHospitals('WAREHOUSE');

    expect(screen.queryByRole('button', { name: 'Nuevo hospital' })).toBeNull();
    const row = screen.getByText('Hospital Central').closest('tr');
    await user.click(
      within(row as HTMLTableRowElement).getByRole('button', {
        name: 'Acciones del hospital Hospital Central',
      }),
    );
    expect(screen.getByRole('menuitem', { name: 'Ver detalle' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Cambiar estado' })).toBeNull();
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('crea con payload permitido y feedback de éxito', async () => {
    const user = userEvent.setup();
    await renderHospitals();

    await user.click(screen.getByRole('button', { name: 'Nuevo hospital' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Nombre' }),
      ' Clínica Norte ',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Ciudad' }),
      ' Hermosillo ',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Estado' }),
      ' Sonora ',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Nombre de contacto' }),
      ' Marta Ruiz ',
    );
    await user.click(screen.getByRole('button', { name: 'Registrar hospital' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/healthcare/hospitals', {
        name: 'Clínica Norte',
        city: 'Hermosillo',
        state: 'Sonora',
        address: null,
        phone: null,
        email: null,
        contactName: 'Marta Ruiz',
        notes: null,
      }),
    );
    expect(
      await screen.findByText('Hospital registrado correctamente.'),
    ).toBeTruthy();

    const payload = vi.mocked(api.post).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    for (const field of [
      'companyId',
      'isActive',
      'searchKey',
      'confirmPossibleDuplicate',
      'createdAt',
      'updatedAt',
    ]) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  it('edita sólo campos cambiados y nunca usa lifecycle en PATCH', async () => {
    const user = userEvent.setup();
    await renderHospitals();
    await openAction(user, 'Editar');

    const contactName = await screen.findByRole('textbox', {
      name: 'Nombre de contacto',
    });
    await user.clear(contactName);
    const address = screen.getByRole('textbox', { name: 'Dirección' });
    await user.clear(address);
    await user.type(address, 'Blvd. Salud 200');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/healthcare/hospitals/hospital-1',
        {
          address: 'Blvd. Salud 200',
          contactName: null,
        },
      ),
    );
    const payload = vi.mocked(api.patch).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('isActive');
    expect(payload).not.toHaveProperty('companyId');
  });

  it('revisa y confirma explícitamente un posible hospital duplicado', async () => {
    const user = userEvent.setup();
    await renderHospitals();
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        outcome: 'DUPLICATE_REVIEW_REQUIRED',
        resourceType: 'HOSPITAL',
        candidates: [
          {
            id: 'candidate-1',
            name: 'Hospital Central',
            city: 'Hermosillo',
            state: 'Sonora',
            address: 'Centro',
            isActive: true,
          },
        ],
      },
    } as never);

    await user.click(screen.getByRole('button', { name: 'Nuevo hospital' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Central');
    await user.type(screen.getByRole('textbox', { name: 'Ciudad' }), 'Hermosillo');
    await user.type(screen.getByRole('textbox', { name: 'Estado' }), 'Sonora');
    await user.click(screen.getByRole('button', { name: 'Registrar hospital' }));

    const duplicateDialog = await screen.findByRole('dialog', {
      name: 'Revisar posible duplicado',
    });
    expect(within(duplicateDialog).getByText('Hospital Central')).toBeTruthy();
    expect(within(duplicateDialog).getByText(/Aún no se ha creado/)).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', { name: 'Nuevo hospital' }),
    ).toBeTruthy();
    expect(screen.queryByText('Hospital registrado correctamente.')).toBeNull();
    const payload = vi.mocked(api.post).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('confirmPossibleDuplicate');

    await user.click(
      within(duplicateDialog).getByRole('button', {
        name: 'Crear de todos modos',
      }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith('/healthcare/hospitals', {
        name: 'Central',
        city: 'Hermosillo',
        state: 'Sonora',
        address: null,
        phone: null,
        email: null,
        contactName: null,
        notes: null,
        confirmPossibleDuplicate: true,
      }),
    );
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it('usa el endpoint lifecycle explícito', async () => {
    const user = userEvent.setup();
    await renderHospitals();
    await openAction(user, 'Cambiar estado');
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/healthcare/hospitals/hospital-1/deactivate',
      ),
    );
  });
});
