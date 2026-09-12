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

import DoctorsPage from './page';

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

const doctor = {
  id: 'doctor-1',
  firstName: 'Ana',
  lastName: 'Torres',
  specialty: 'Cardiología',
  phone: '6625551000',
  email: 'ana@hospital.test',
  isActive: true,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

const inactiveDoctor = {
  ...doctor,
  id: 'doctor-2',
  firstName: 'Bruno',
  lastName: 'López',
  specialty: 'Traumatología',
  isActive: false,
};

const doctorDetail = {
  ...doctor,
  notes: 'Atiende por la mañana.',
  affiliationSummary: { active: 2, total: 3 },
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

function pageResponse(items = [doctor], totalItems = items.length) {
  return {
    data: {
      items,
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / 25),
      },
    },
  } as never;
}

function configureApi(role: UserRole = 'ADMIN', items = [doctor]) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const path = String(url);
    if (path === '/auth/me') return authResponse(role);
    if (path === '/healthcare/doctors') return pageResponse(items);
    if (path === `/healthcare/doctors/${doctor.id}`) {
      return { data: doctorDetail } as never;
    }
    if (path === `/healthcare/doctors/${inactiveDoctor.id}`) {
      return {
        data: {
          ...inactiveDoctor,
          notes: null,
          affiliationSummary: { active: 0, total: 1 },
        },
      } as never;
    }
    throw new Error(`Unexpected endpoint ${path}`);
  });
  vi.mocked(api.post).mockResolvedValue({
    data: { outcome: 'CREATED', data: doctorDetail },
  } as never);
  vi.mocked(api.patch).mockResolvedValue({
    data: { outcome: 'UPDATED', data: doctorDetail },
  } as never);
}

async function renderDoctors(role: UserRole = 'ADMIN') {
  configureApi(role);
  render(<DoctorsPage />);
  await screen.findByText('Ana Torres');
}

async function openAction(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  action: 'Ver detalle' | 'Editar' | 'Cambiar estado',
) {
  const row = screen.getByText(name).closest('tr');
  if (!row) throw new Error(`Missing row for ${name}`);

  await user.click(
    within(row).getByRole('button', {
      name: `Acciones del médico ${name}`,
    }),
  );
  await user.click(screen.getByRole('menuitem', { name: action }));
}

function listCalls() {
  return vi
    .mocked(api.get)
    .mock.calls.filter(([url]) => String(url) === '/healthcare/doctors');
}

describe('DoctorsPage', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearAuthenticatedSessionCache();
    vi.clearAllMocks();
    window.localStorage.clear();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
    clearAuthenticatedSessionCache();
    window.localStorage.clear();
  });

  it('renderiza lista, especialidad, estado y detalle sin exponer datos internos', async () => {
    const user = userEvent.setup();
    configureApi();
    render(<DoctorsPage />);

    expect(screen.getByText('Cargando médicos...')).toBeTruthy();
    expect(await screen.findByText('Ana Torres')).toBeTruthy();
    expect(screen.getByText('Cardiología')).toBeTruthy();
    expect(screen.getByLabelText('Estado del médico: Activo')).toBeTruthy();

    await openAction(user, 'Ana Torres', 'Ver detalle');

    expect(await screen.findByText('Atiende por la mañana.')).toBeTruthy();
    expect(screen.getByText('Afiliaciones activas')).toBeTruthy();
    expect(screen.getByText('Afiliaciones totales')).toBeTruthy();
    expect(screen.queryByText('company-1')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/healthcare/doctors/doctor-1');
  });

  it('mantiene búsqueda, filtro y paginación en el contrato server-side', async () => {
    const user = userEvent.setup();
    configureApi();
    vi.mocked(api.get).mockImplementation(async (url, config) => {
      if (String(url) === '/auth/me') return authResponse('ADMIN');
      if (String(url) === '/healthcare/doctors') {
        const params = (config as { params?: { page?: number; pageSize?: number } })
          ?.params;
        return {
          data: {
            items: [doctor],
            pagination: {
              page: params?.page ?? 1,
              pageSize: params?.pageSize ?? 25,
              totalItems: 60,
              totalPages: 3,
            },
          },
        } as never;
      }
      throw new Error(`Unexpected endpoint ${String(url)}`);
    });

    render(<DoctorsPage />);
    await screen.findByText('Ana Torres');

    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar médicos' }),
      '  cardiología  ',
    );
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toMatchObject({
        params: {
          page: 1,
          pageSize: 25,
          status: 'ACTIVE',
          search: 'cardiología',
        },
      }),
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado' }),
      'ALL',
    );
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toMatchObject({
        params: expect.objectContaining({ page: 1, status: 'ALL' }),
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toMatchObject({
        params: expect.objectContaining({ page: 2 }),
      }),
    );
  });

  it('muestra estado vacío y recupera un error con retry', async () => {
    let listRequest = 0;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/auth/me') return authResponse('ADMIN');
      listRequest += 1;
      if (listRequest === 1) throw new Error('Médicos no disponibles');
      return pageResponse([]);
    });

    render(<DoctorsPage />);
    expect(await screen.findByText('Médicos no disponibles')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Sin médicos activos')).toBeTruthy();
    expect(listRequest).toBe(2);
  });

  it.each(['ADMIN', 'MANAGER'] as const)(
    'permite create/edit/lifecycle a %s',
    async (role) => {
      const user = userEvent.setup();
      await renderDoctors(role);

      expect(screen.getByRole('button', { name: 'Nuevo médico' })).toBeTruthy();
      const row = screen.getByText('Ana Torres').closest('tr');
      await user.click(
        within(row as HTMLTableRowElement).getByRole('button', {
          name: 'Acciones del médico Ana Torres',
        }),
      );
      expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeTruthy();
      expect(
        screen.getByRole('menuitem', { name: 'Cambiar estado' }),
      ).toBeTruthy();
    },
  );

  it('permite crear/editar a SALES pero oculta y no dispara lifecycle', async () => {
    const user = userEvent.setup();
    await renderDoctors('SALES');

    expect(screen.getByRole('button', { name: 'Nuevo médico' })).toBeTruthy();
    const row = screen.getByText('Ana Torres').closest('tr');
    await user.click(
      within(row as HTMLTableRowElement).getByRole('button', {
        name: 'Acciones del médico Ana Torres',
      }),
    );
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Cambiar estado' })).toBeNull();
    expect(api.post).not.toHaveBeenCalledWith(
      '/healthcare/doctors/doctor-1/deactivate',
    );
  });

  it('deja WAREHOUSE en lectura con detalle, sin create/edit/lifecycle', async () => {
    const user = userEvent.setup();
    await renderDoctors('WAREHOUSE');

    expect(screen.queryByRole('button', { name: 'Nuevo médico' })).toBeNull();
    const row = screen.getByText('Ana Torres').closest('tr');
    await user.click(
      within(row as HTMLTableRowElement).getByRole('button', {
        name: 'Acciones del médico Ana Torres',
      }),
    );
    expect(screen.getByRole('menuitem', { name: 'Ver detalle' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Cambiar estado' })).toBeNull();
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('muestra candidatos y cancelar duplicate review no realiza confirmación', async () => {
    const user = userEvent.setup();
    await renderDoctors();
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        outcome: 'DUPLICATE_REVIEW_REQUIRED',
        resourceType: 'DOCTOR',
        candidates: [
          {
            id: 'candidate-1',
            firstName: 'Julia',
            lastName: 'Mora',
            specialty: 'Pediatría',
            phone: null,
            email: 'julia@test.test',
            isActive: true,
          },
        ],
      },
    } as never);

    await user.click(screen.getByRole('button', { name: 'Nuevo médico' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), ' Julia ');
    await user.type(screen.getByRole('textbox', { name: 'Apellido' }), ' Mora ');
    await user.type(
      screen.getByRole('textbox', { name: 'Especialidad' }),
      ' Pediatría ',
    );
    await user.click(screen.getByRole('button', { name: 'Registrar médico' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/healthcare/doctors', {
        firstName: 'Julia',
        lastName: 'Mora',
        specialty: 'Pediatría',
        phone: null,
        email: null,
        notes: null,
      }),
    );
    const duplicateDialog = await screen.findByRole('dialog', {
      name: 'Revisar posible duplicado',
    });
    expect(within(duplicateDialog).getByText('Julia Mora')).toBeTruthy();
    expect(within(duplicateDialog).getByText(/Aún no se ha creado/)).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
    await user.click(
      within(duplicateDialog).getByRole('button', { name: 'Cancelar' }),
    );
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', { name: 'Nuevo médico' }),
    ).toBeTruthy();
    expect(screen.queryByText('Médico registrado correctamente.')).toBeNull();

    const payload = vi.mocked(api.post).mock.calls.at(-1)?.[1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('companyId');
    expect(payload).not.toHaveProperty('isActive');
    expect(payload).not.toHaveProperty('searchKey');
    expect(payload).not.toHaveProperty('confirmPossibleDuplicate');
  });

  it('confirma duplicate review sólo después de una acción explícita', async () => {
    const user = userEvent.setup();
    await renderDoctors();
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        outcome: 'DUPLICATE_REVIEW_REQUIRED',
        resourceType: 'DOCTOR',
        candidates: [
          {
            id: 'candidate-1',
            firstName: 'Julia',
            lastName: 'Mora',
            specialty: 'Pediatría',
            phone: null,
            email: null,
            isActive: true,
          },
        ],
      },
    } as never);

    await user.click(screen.getByRole('button', { name: 'Nuevo médico' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Julia');
    await user.type(screen.getByRole('textbox', { name: 'Apellido' }), 'Mora');
    await user.type(
      screen.getByRole('textbox', { name: 'Especialidad' }),
      'Pediatría',
    );
    await user.click(screen.getByRole('button', { name: 'Registrar médico' }));

    const duplicateDialog = await screen.findByRole('dialog', {
      name: 'Revisar posible duplicado',
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    await user.click(
      within(duplicateDialog).getByRole('button', {
        name: 'Crear de todos modos',
      }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith('/healthcare/doctors', {
        firstName: 'Julia',
        lastName: 'Mora',
        specialty: 'Pediatría',
        phone: null,
        email: null,
        notes: null,
        confirmPossibleDuplicate: true,
      }),
    );
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it('edita sólo valores intencionalmente cambiados y permite limpiar nullable', async () => {
    const user = userEvent.setup();
    await renderDoctors();
    await openAction(user, 'Ana Torres', 'Editar');

    const phone = await screen.findByRole('textbox', { name: 'Teléfono' });
    await user.clear(phone);
    const specialty = screen.getByRole('textbox', { name: 'Especialidad' });
    await user.clear(specialty);
    await user.type(specialty, 'Medicina interna');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/healthcare/doctors/doctor-1', {
        specialty: 'Medicina interna',
        phone: null,
      }),
    );
  });

  it('usa lifecycle explícito para desactivar y reactivar', async () => {
    const user = userEvent.setup();
    configureApi('ADMIN', [doctor, inactiveDoctor]);
    render(<DoctorsPage />);
    await screen.findByText('Ana Torres');

    await openAction(user, 'Ana Torres', 'Cambiar estado');
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/healthcare/doctors/doctor-1/deactivate',
      ),
    );

    await openAction(user, 'Bruno López', 'Cambiar estado');
    await user.click(screen.getByRole('button', { name: 'Reactivar' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/healthcare/doctors/doctor-2/reactivate',
      ),
    );
  });

  it('presenta un 403 sin borrar la sesión', async () => {
    window.localStorage.setItem('token', 'valid-token');
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/auth/me') return authResponse('WAREHOUSE');
      throw { response: { status: 403 } };
    });

    render(<DoctorsPage />);

    expect(
      await screen.findByRole('heading', { name: 'Sin permisos' }),
    ).toBeTruthy();
    expect(window.localStorage.getItem('token')).toBe('valid-token');
  });
});
