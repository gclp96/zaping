import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthenticatedSessionCache,
  type UserRole,
} from '@/app/auth-session';
import { api } from '@/services/api';

import HealthcareCasesPage from './page';
import type { HealthcareCase } from './types';

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
  isActive: true,
};

const replacementDoctor = {
  id: 'doctor-2',
  firstName: 'Luis',
  lastName: 'Mora',
  specialty: 'Cirugía',
  isActive: true,
};

const inactiveDoctor = {
  id: 'doctor-inactive',
  firstName: 'Bruno',
  lastName: 'López',
  specialty: 'Traumatología',
  isActive: false,
};

const hospital = {
  id: 'hospital-1',
  name: 'Hospital Central',
  city: 'Hermosillo',
  state: 'Sonora',
  isActive: true,
};

const replacementHospital = {
  id: 'hospital-2',
  name: 'Clínica Norte',
  city: 'Nogales',
  state: 'Sonora',
  isActive: true,
};

const healthcareCase: HealthcareCase = {
  id: 'case-1',
  doctorId: doctor.id,
  hospitalId: hospital.id,
  folio: 'HC-0001',
  title: 'Reemplazo de equipo',
  procedureDescription: 'Procedimiento programado',
  status: 'SCHEDULED',
  scheduledStart: '2026-09-12T16:00:00.000Z',
  scheduledEnd: '2026-09-12T18:00:00.000Z',
  responsibleUserId: 'user-responsible',
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-09-11T00:00:00.000Z',
  updatedAt: '2026-09-11T00:00:00.000Z',
  doctor,
  hospital,
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

function pageResponse<T>(items: T[]) {
  return {
    data: {
      items,
      pagination: {
        page: 1,
        pageSize: 100,
        totalItems: items.length,
        totalPages: items.length ? 1 : 0,
      },
    },
  } as never;
}

function configureApi(
  role: UserRole = 'ADMIN',
  cases: HealthcareCase[] = [healthcareCase],
) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const path = String(url);
    if (path === '/auth/me') return authResponse(role);
    if (path === '/healthcare/cases') return { data: cases } as never;
    if (path === '/healthcare/doctors') {
      return pageResponse([doctor, replacementDoctor, inactiveDoctor]);
    }
    if (path === '/healthcare/hospitals') {
      return pageResponse([hospital, replacementHospital]);
    }
    if (path === `/healthcare/doctors/${doctor.id}/hospitals`) {
      return { data: { items: [] } } as never;
    }
    if (path === `/healthcare/doctors/${replacementDoctor.id}/hospitals`) {
      return { data: { items: [] } } as never;
    }
    throw new Error(`Unexpected endpoint ${path}`);
  });
  vi.mocked(api.post).mockImplementation(async (url) => {
    if (String(url) === '/healthcare/cases') {
      return { data: healthcareCase } as never;
    }
    throw new Error(`Unexpected POST ${String(url)}`);
  });
  vi.mocked(api.patch).mockResolvedValue({ data: healthcareCase } as never);
}

async function renderCases(
  role: UserRole = 'ADMIN',
  cases: HealthcareCase[] = [healthcareCase],
) {
  configureApi(role, cases);
  render(<HealthcareCasesPage />);
  if (cases.length) {
    await screen.findByText(cases[0].title);
  } else {
    await screen.findByText('Sin casos de salud');
  }
}

async function openCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Nuevo caso' }));
  await screen.findByRole('dialog', { name: 'Nuevo caso de salud' });
}

async function openEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: 'Acciones del caso HC-0001' }),
  );
  await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
  await screen.findByRole('dialog', { name: 'Editar caso de salud' });
}

function casePostCalls() {
  return vi
    .mocked(api.post)
    .mock.calls.filter(([url]) => String(url) === '/healthcare/cases');
}

describe('HealthcareCasesPage', () => {
  beforeEach(() => {
    clearAuthenticatedSessionCache();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    clearAuthenticatedSessionCache();
    window.localStorage.clear();
  });

  it.each([
    ['sin relaciones', false, false],
    ['sólo con médico', true, false],
    ['sólo con hospital', false, true],
    ['con médico y hospital', true, true],
  ] as const)('crea un caso %s', async (_label, withDoctor, withHospital) => {
    const user = userEvent.setup();
    await renderCases('ADMIN', []);
    await openCreate(user);
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Caso nuevo');

    if (withDoctor) {
      await screen.findByRole('option', {
        name: 'Ana Torres — Cardiología',
      });
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Médico' }),
        doctor.id,
      );
    }
    if (withHospital) {
      await screen.findByRole('option', {
        name: 'Hospital Central — Hermosillo, Sonora',
      });
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Hospital' }),
        hospital.id,
      );
    }

    if (withDoctor && withHospital) {
      expect(
        await screen.findByText(/No hay una afiliación activa/),
      ).toBeTruthy();
    }
    await user.click(screen.getByRole('button', { name: 'Registrar caso' }));

    const expected: Record<string, string | null> = {
      title: 'Caso nuevo',
      procedureDescription: null,
    };
    if (withDoctor) expected.doctorId = doctor.id;
    if (withHospital) expected.hospitalId = hospital.id;
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/healthcare/cases', expected),
    );
    expect(casePostCalls()).toHaveLength(1);
    const payload = casePostCalls()[0]?.[1] as Record<string, unknown>;
    for (const protectedField of [
      'companyId',
      'status',
      'searchKey',
      'isActive',
      'scheduledStart',
      'scheduledEnd',
      'responsibleUserId',
    ]) {
      expect(payload).not.toHaveProperty(protectedField);
    }
    expect(
      vi.mocked(api.post).mock.calls.some(([url]) =>
        String(url).includes('doctor-hospital-affiliations'),
      ),
    ).toBe(false);
  });

  it('omite relaciones y campos de agenda al editar sin cambios', async () => {
    const user = userEvent.setup();
    await renderCases();
    await openEdit(user);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/healthcare/cases/case-1', {}),
    );
    const payload = vi.mocked(api.patch).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('doctorId');
    expect(payload).not.toHaveProperty('hospitalId');
    expect(payload).not.toHaveProperty('scheduledStart');
    expect(payload).not.toHaveProperty('scheduledEnd');
    expect(payload).not.toHaveProperty('companyId');
  });

  it('envía null al limpiar y el UUID nuevo al reemplazar una relación', async () => {
    const user = userEvent.setup();
    await renderCases();
    await openEdit(user);
    const doctorSelector = await screen.findByRole('combobox', {
      name: 'Médico',
    });
    const hospitalSelector = await screen.findByRole('combobox', {
      name: 'Hospital',
    });
    await waitFor(() =>
      expect((doctorSelector as HTMLSelectElement).disabled).toBe(false),
    );
    await user.selectOptions(doctorSelector, '');
    await user.selectOptions(hospitalSelector, replacementHospital.id);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/healthcare/cases/case-1', {
        doctorId: null,
        hospitalId: replacementHospital.id,
      }),
    );
  });

  it('muestra la relación histórica inactiva y no la ofrece en un caso nuevo', async () => {
    const user = userEvent.setup();
    const historicalCase = {
      ...healthcareCase,
      doctorId: inactiveDoctor.id,
      doctor: inactiveDoctor,
    };
    await renderCases('ADMIN', [historicalCase]);
    await openEdit(user);

    const historicalOption = await screen.findByRole('option', {
      name: 'Bruno López — Traumatología — Inactivo (histórico)',
    });
    expect((historicalOption as HTMLOptionElement).disabled).toBe(true);
    expect(screen.getByText(/relación histórica permanece visible/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await openCreate(user);
    await waitFor(() =>
      expect(
        (screen.getByRole('combobox', {
          name: 'Médico',
        }) as HTMLSelectElement).disabled,
      ).toBe(false),
    );
    expect(
      screen.queryByRole('option', { name: /Bruno López/ }),
    ).toBeNull();
  });

  it('muestra candidatos y cancelar quick-create no hace confirmación automática', async () => {
    const user = userEvent.setup();
    await renderCases('ADMIN', []);
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
    await openCreate(user);
    await user.click(screen.getByRole('button', { name: 'Crear médico' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Nombre del médico' }),
      'Julia',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Apellido del médico' }),
      'Mora',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Especialidad del médico' }),
      'Pediatría',
    );
    await user.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));

    const review = await screen.findByRole('dialog', {
      name: 'Revisar posible duplicado',
    });
    expect(within(review).getByText('Julia Mora')).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
    const firstPayload = vi.mocked(api.post).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(firstPayload).not.toHaveProperty('confirmPossibleDuplicate');
    await user.click(within(review).getByRole('button', { name: 'Cancelar' }));
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('confirma quick-create una vez y selecciona el médico creado', async () => {
    const user = userEvent.setup();
    await renderCases('SALES', []);
    let doctorCreates = 0;
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (String(url) === '/healthcare/doctors') {
        doctorCreates += 1;
        if (doctorCreates === 1) {
          return {
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
          } as never;
        }
        return {
          data: {
            outcome: 'CREATED',
            data: {
              id: 'doctor-created',
              firstName: 'Julia',
              lastName: 'Mora',
              specialty: 'Pediatría',
              phone: null,
              email: null,
              notes: null,
              isActive: true,
            },
          },
        } as never;
      }
      if (String(url) === '/healthcare/cases') {
        return { data: healthcareCase } as never;
      }
      throw new Error(`Unexpected POST ${String(url)}`);
    });

    await openCreate(user);
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Caso rápido');
    await user.click(screen.getByRole('button', { name: 'Crear médico' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Nombre del médico' }),
      'Julia',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Apellido del médico' }),
      'Mora',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Especialidad del médico' }),
      'Pediatría',
    );
    await user.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));
    const review = await screen.findByRole('dialog', {
      name: 'Revisar posible duplicado',
    });
    await user.click(
      within(review).getByRole('button', { name: 'Crear de todos modos' }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/healthcare/doctors', {
        firstName: 'Julia',
        lastName: 'Mora',
        specialty: 'Pediatría',
        phone: null,
        email: null,
        notes: null,
        confirmPossibleDuplicate: true,
      }),
    );
    expect(
      await screen.findByRole('option', {
        name: 'Julia Mora — Pediatría',
        selected: true,
      }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Registrar caso' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/healthcare/cases', {
        title: 'Caso rápido',
        procedureDescription: null,
        doctorId: 'doctor-created',
      }),
    );
    expect(doctorCreates).toBe(2);
  });

  it.each(['ADMIN', 'MANAGER', 'SALES'] as const)(
    'ofrece edición y quick-create a %s',
    async (role) => {
      const user = userEvent.setup();
      await renderCases(role);
      expect(screen.getByRole('button', { name: 'Nuevo caso' })).toBeTruthy();
      await openCreate(user);
      expect(screen.getByRole('button', { name: 'Crear médico' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Crear hospital' })).toBeTruthy();
    },
  );

  it('mantiene WAREHOUSE en lectura y usa el contexto compacto de la lista', async () => {
    const user = userEvent.setup();
    await renderCases('WAREHOUSE');
    expect(screen.queryByRole('button', { name: 'Nuevo caso' })).toBeNull();
    expect(screen.getByText('Ana Torres')).toBeTruthy();
    expect(screen.getByText('Hospital Central')).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'Acciones del caso HC-0001' }),
    );
    expect(screen.getByRole('menuitem', { name: 'Ver detalle' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Editar' })).toBeNull();
    expect(api.patch).not.toHaveBeenCalled();
    expect(
      vi.mocked(api.get).mock.calls.some(([url]) =>
        String(url).match(/^\/healthcare\/(doctors|hospitals)\//),
      ),
    ).toBe(false);
  });

  it('presenta un 403 sin borrar la sesión', async () => {
    window.localStorage.setItem('token', 'valid-token');
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/auth/me') return authResponse('WAREHOUSE');
      throw { response: { status: 403 } };
    });

    render(<HealthcareCasesPage />);
    expect(
      await screen.findByRole('heading', { name: 'Sin permisos' }),
    ).toBeTruthy();
    expect(window.localStorage.getItem('token')).toBe('valid-token');
  });
});
