import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthenticatedSessionCache,
  type UserRole,
} from '@/app/auth-session';
import { api } from '@/services/api';
import {
  getHealthcareEquipmentAssignment,
  listHealthcareEquipmentAssignments,
  type HealthcareEquipmentAssignment,
  type HealthcareEquipmentAssignmentListResponse,
} from '@/services/healthcare-equipment-assignments';

import type { HealthcareCase } from '../../types';
import HealthcareCaseEquipmentAssignmentsPage from './page';

const routeMock = vi.hoisted(() => ({
  caseId: 'case-1',
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ caseId: routeMock.caseId }),
}));

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/healthcare-equipment-assignments', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/services/healthcare-equipment-assignments')
  >();

  return {
    ...actual,
    listHealthcareEquipmentAssignments: vi.fn(),
    getHealthcareEquipmentAssignment: vi.fn(),
  };
});

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

const healthcareCase: HealthcareCase = {
  id: 'case-1',
  doctorId: null,
  hospitalId: null,
  folio: 'HC-0001',
  title: 'Cirugía programada',
  procedureDescription: null,
  status: 'SCHEDULED',
  scheduledStart: '2026-09-25T16:00:00.000Z',
  scheduledEnd: '2026-09-25T18:00:00.000Z',
  responsibleUserId: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
  doctor: null,
  hospital: null,
};

const assignment: HealthcareEquipmentAssignment = {
  id: 'assignment-1',
  caseId: healthcareCase.id,
  requirementId: 'requirement-1',
  origin: 'REQUIREMENT',
  status: 'RESERVED',
  equipmentAsset: {
    id: 'asset-1',
    productId: 'product-1',
    assetCode: 'EQ-0001',
    serialNumber: 'SN-0001',
    lifecycle: 'ACTIVE',
    condition: 'GOOD',
    product: {
      id: 'product-1',
      sku: 'EQ-SKU-1',
      name: 'Torre laparoscópica',
      isActive: true,
    },
  },
  assignedAt: '2026-09-24T18:00:00.000Z',
  assignedBy: {
    id: 'admin-1',
    firstName: 'Ana',
    lastName: 'Ramos',
  },
  replacesAssignmentId: null,
  replacement: null,
  release: null,
  availability: {
    fullyVerifiable: true,
    conflictFree: false,
    warnings: [
      {
        code: 'CURRENT_ASSIGNMENT_CONFLICT',
        message: 'El equipo tiene otra reserva activa con horario superpuesto',
      },
    ],
  },
  conflictOverrides: [],
  createdAt: '2026-09-24T18:00:00.000Z',
  updatedAt: '2026-09-24T18:00:00.000Z',
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

function listResponse(
  items: HealthcareEquipmentAssignment[] = [assignment],
  overrides: Partial<HealthcareEquipmentAssignmentListResponse['pagination']> = {},
): HealthcareEquipmentAssignmentListResponse {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 25,
      totalItems: items.length,
      totalPages: items.length ? 1 : 0,
      ...overrides,
    },
  };
}

function configureApi(role: UserRole = 'ADMIN') {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (String(url) === '/auth/me') return authResponse(role);
    if (String(url) === '/healthcare/cases/case-1') {
      return { data: healthcareCase } as never;
    }
    throw new Error(`Unexpected endpoint ${String(url)}`);
  });
}

async function renderPage(role: UserRole = 'ADMIN') {
  configureApi(role);
  vi.mocked(listHealthcareEquipmentAssignments).mockResolvedValue(
    listResponse(),
  );
  vi.mocked(getHealthcareEquipmentAssignment).mockResolvedValue(assignment);
  render(<HealthcareCaseEquipmentAssignmentsPage />);
  await screen.findByText('Torre laparoscópica');
}

describe('HealthcareCaseEquipmentAssignmentsPage', () => {
  beforeEach(() => {
    clearAuthenticatedSessionCache();
    vi.clearAllMocks();
    window.localStorage.clear();
    routeMock.caseId = 'case-1';
  });

  afterEach(() => {
    cleanup();
    clearAuthenticatedSessionCache();
    window.localStorage.clear();
  });

  it.each(['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE'] as const)(
    'muestra el listado read-only a %s',
    async (role) => {
      await renderPage(role);

      expect(screen.getByText('HC-0001 — Cirugía programada')).toBeTruthy();
      expect(screen.getByText('Con conflicto')).toBeTruthy();
      expect(
        screen.getByText(
          'El equipo tiene otra reserva activa con horario superpuesto',
        ),
      ).toBeTruthy();
      expect(listHealthcareEquipmentAssignments).toHaveBeenCalledWith(
        'case-1',
        1,
        25,
      );
      expect(screen.queryByRole('button', { name: /crear|reemplazar|liberar/i }))
        .toBeNull();
    },
  );

  it('muestra loading y después el estado vacío', async () => {
    configureApi();
    let resolveList: (
      value: HealthcareEquipmentAssignmentListResponse,
    ) => void = () => undefined;
    vi.mocked(listHealthcareEquipmentAssignments).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );

    render(<HealthcareCaseEquipmentAssignmentsPage />);
    expect(
      await screen.findByText('Cargando asignaciones de equipo...'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(listHealthcareEquipmentAssignments).toHaveBeenCalledWith(
        'case-1',
        1,
        25,
      ),
    );

    resolveList(listResponse([]));
    expect(await screen.findByText('Sin asignaciones de equipo')).toBeTruthy();
  });

  it('muestra error y permite reintentar la carga', async () => {
    const user = userEvent.setup();
    configureApi();
    vi.mocked(listHealthcareEquipmentAssignments)
      .mockRejectedValueOnce(new Error('No fue posible consultar la API.'))
      .mockResolvedValueOnce(listResponse());

    render(<HealthcareCaseEquipmentAssignmentsPage />);
    expect(
      await screen.findByText('No fue posible consultar la API.'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Torre laparoscópica')).toBeTruthy();
    expect(listHealthcareEquipmentAssignments).toHaveBeenCalledTimes(2);
  });

  it('presenta 403 sin cerrar la sesión', async () => {
    window.localStorage.setItem('token', 'valid-token');
    configureApi('WAREHOUSE');
    vi.mocked(listHealthcareEquipmentAssignments).mockRejectedValue({
      response: { status: 403 },
    });

    render(<HealthcareCaseEquipmentAssignmentsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Sin permisos' }),
    ).toBeTruthy();
    expect(window.localStorage.getItem('token')).toBe('valid-token');
  });

  it('abre Detail en modal y conserva warnings y auditoría', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(
      screen.getByRole('button', {
        name: 'Acciones de la asignación EQ-0001',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Detalle de la asignación',
    });
    expect(getHealthcareEquipmentAssignment).toHaveBeenCalledWith(
      'assignment-1',
    );
    expect(within(dialog).getByText('Ana Ramos')).toBeTruthy();
    expect(within(dialog).getByText('Con conflicto')).toBeTruthy();
    expect(
      within(dialog).getByText(
        'El equipo tiene otra reserva activa con horario superpuesto',
      ),
    ).toBeTruthy();
  });

  it('pagina usando el contrato del backend', async () => {
    const user = userEvent.setup();
    configureApi();
    vi.mocked(listHealthcareEquipmentAssignments).mockImplementation(
      async (_caseId, page, pageSize) =>
        listResponse([assignment], {
          page,
          pageSize,
          totalItems: 26,
          totalPages: 2,
        }),
    );

    render(<HealthcareCaseEquipmentAssignmentsPage />);
    await screen.findByText('Mostrando 1-25 de 26');
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));

    await waitFor(() =>
      expect(listHealthcareEquipmentAssignments).toHaveBeenLastCalledWith(
        'case-1',
        2,
        25,
      ),
    );
  });
});
