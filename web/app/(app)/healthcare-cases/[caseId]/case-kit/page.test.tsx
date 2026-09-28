import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';
import {
  addHealthcareCaseKitItem,
  createHealthcareCaseKit,
  getHealthcareCaseKit,
  type HealthcareCaseKit,
} from '@/services/healthcare-case-kits';
import { listHealthcareEquipmentAssignments } from '@/services/healthcare-equipment-assignments';
import { listHealthcareRequirements } from '@/services/healthcare-requirements';

import HealthcareCaseKitPage from './page';

const state = vi.hoisted(() => ({ role: 'MANAGER' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ caseId: 'case-1' }) }));
vi.mock('@/app/auth-session', () => ({
  useAuthenticatedSession: () => ({
    status: 'success',
    user: { id: 'user-1', companyId: 'company-1', role: state.role },
  }),
}));
vi.mock('@/services/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/services/healthcare-case-kits', () => ({
  getHealthcareCaseKit: vi.fn(),
  createHealthcareCaseKit: vi.fn(),
  addHealthcareCaseKitItem: vi.fn(),
}));
vi.mock('@/services/healthcare-equipment-assignments', () => ({
  listHealthcareEquipmentAssignments: vi.fn(),
}));
vi.mock('@/services/healthcare-requirements', () => ({
  listHealthcareRequirements: vi.fn(),
}));

const healthcareCase = {
  id: 'case-1',
  folio: 'HC-1',
  title: 'Cirugía',
  status: 'SCHEDULED',
};
const emptyKit = {
  id: 'kit-1',
  caseId: 'case-1',
  status: 'DRAFT',
  createdBy: { id: 'user-1', firstName: 'Ana', lastName: 'López' },
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  items: [],
} as HealthcareCaseKit;

describe('HealthcareCaseKitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.role = 'MANAGER';
    vi.mocked(api.get).mockResolvedValue({ data: healthcareCase });
    vi.mocked(getHealthcareCaseKit).mockResolvedValue(emptyKit);
    vi.mocked(listHealthcareRequirements).mockResolvedValue([]);
    vi.mocked(listHealthcareEquipmentAssignments).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
    });
  });
  afterEach(cleanup);

  it('renders DRAFT sections and the non-reservation warning', async () => {
    render(<HealthcareCaseKitPage />);
    expect(await screen.findByText('Materiales')).toBeTruthy();
    expect(screen.getByText('Equipos')).toBeTruthy();
    expect(screen.getByText(/no descuentan stock ni lotes/i)).toBeTruthy();
  });

  it('keeps SALES read-only', async () => {
    state.role = 'SALES';
    render(<HealthcareCaseKitPage />);
    await screen.findByText('Materiales');
    expect(
      screen.queryByRole('button', { name: /agregar contenido/i }),
    ).toBeNull();
  });

  it('creates the empty kit and renders the result', async () => {
    vi.mocked(getHealthcareCaseKit).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { code: 'CASE_KIT_NOT_FOUND' } },
    });
    vi.mocked(createHealthcareCaseKit).mockResolvedValue(emptyKit);
    render(<HealthcareCaseKitPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Crear maletín' }),
    );
    await waitFor(() =>
      expect(createHealthcareCaseKit).toHaveBeenCalledWith('case-1'),
    );
    expect(
      await screen.findByText('Maletín creado correctamente.'),
    ).toBeTruthy();
  });

  it('renders derived stale warnings without edit or remove controls', async () => {
    vi.mocked(getHealthcareCaseKit).mockResolvedValue({
      ...emptyKit,
      items: [
        {
          id: 'item-1',
          sourceType: 'REQUIREMENT',
          preparedQuantity: 2,
          requirement: {
            id: 'req-1',
            requestedQty: 1,
            lifecycle: 'RETIRED',
            product: {
              id: 'p-1',
              sku: 'MAT-1',
              name: 'Material',
              isActive: false,
              inventoryTracking: 'QUANTITY',
            },
          },
          equipmentAssignment: null,
          sourceValid: false,
          stale: true,
          warnings: [
            {
              code: 'CASE_KIT_REQUIREMENT_NOT_ACTIVE',
              message: 'El requerimiento ya no está activo.',
            },
          ],
          addedBy: { id: 'user-1', firstName: 'Ana', lastName: 'López' },
          createdAt: '2026-09-27T12:00:00Z',
        },
      ],
    });
    render(<HealthcareCaseKitPage />);
    expect(
      await screen.findByText('El requerimiento ya no está activo.'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /eliminar|editar/i }),
    ).toBeNull();
    expect(addHealthcareCaseKitItem).not.toHaveBeenCalled();
  });

  it('adds a QUANTITY requirement through the documented payload', async () => {
    vi.mocked(listHealthcareRequirements).mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        caseId: 'case-1',
        productId: 'product-1',
        requestedQty: 3,
        type: 'REQUIRED',
        notes: null,
        sortOrder: 1,
        lifecycle: 'ACTIVE',
        retiredAt: null,
        retirementReason: null,
        createdAt: '2026-09-27T12:00:00Z',
        updatedAt: '2026-09-27T12:00:00Z',
        product: {
          id: 'product-1',
          sku: 'MAT-1',
          name: 'Material',
          isActive: true,
          inventoryTracking: 'QUANTITY',
        },
      },
    ]);
    vi.mocked(addHealthcareCaseKitItem).mockResolvedValue({
      id: 'item-1',
    } as never);
    render(<HealthcareCaseKitPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: /agregar contenido/i }),
    );
    const selectors = await screen.findAllByRole('combobox');
    await userEvent.selectOptions(
      selectors[1],
      '11111111-1111-4111-8111-111111111111',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() =>
      expect(addHealthcareCaseKitItem).toHaveBeenCalledWith('kit-1', {
        sourceType: 'REQUIREMENT',
        requirementId: '11111111-1111-4111-8111-111111111111',
        preparedQuantity: 1,
      }),
    );
  });
});
