import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';
import {
  addHealthcareCaseKitItem,
  confirmHealthcareCaseKitPreparation,
  createHealthcareCaseKit,
  excludeHealthcareCaseKitItem,
  getHealthcareCaseKit,
  type HealthcareCaseKit,
  type HealthcareCaseKitItem,
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
  excludeHealthcareCaseKitItem: vi.fn(),
  confirmHealthcareCaseKitPreparation: vi.fn(),
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
  preparedBy: null,
  preparedAt: null,
  preparationReadiness: { status: 'PASS', blockers: [] },
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  items: [],
} as HealthcareCaseKit;

const activeMaterialItem = {
  id: 'item-1',
  lifecycle: 'ACTIVE',
  sourceType: 'REQUIREMENT',
  preparedQuantity: 1,
  requirement: {
    id: 'req-1',
    requestedQty: 1,
    lifecycle: 'ACTIVE',
    product: {
      id: 'p-1',
      sku: 'MAT-1',
      name: 'Material',
      isActive: true,
      inventoryTracking: 'QUANTITY',
    },
  },
  equipmentAssignment: null,
  sourceValid: true,
  stale: false,
  warnings: [],
  addedBy: { id: 'user-1', firstName: 'Ana', lastName: 'López' },
  excludedBy: null,
  excludedAt: null,
  exclusionReason: null,
  createdAt: '2026-09-27T12:00:00Z',
} satisfies HealthcareCaseKitItem;

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
    expect(
      screen.getByText(/no reserva ni descuenta stock o lotes/i),
    ).toBeTruthy();
  });

  it('keeps SALES read-only', async () => {
    state.role = 'SALES';
    vi.mocked(getHealthcareCaseKit).mockResolvedValue({
      ...emptyKit,
      items: [activeMaterialItem],
    });
    render(<HealthcareCaseKitPage />);
    await screen.findByText('Materiales');
    expect(
      screen.queryByRole('button', { name: /agregar contenido/i }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /confirmar preparación/i }),
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
          lifecycle: 'ACTIVE',
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
          excludedBy: null,
          excludedAt: null,
          exclusionReason: null,
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

  it('excludes an ACTIVE item with a required reason and refreshes the kit', async () => {
    vi.mocked(getHealthcareCaseKit).mockResolvedValue({
      ...emptyKit,
      items: [activeMaterialItem],
    });
    vi.mocked(excludeHealthcareCaseKitItem).mockResolvedValue({
      ...activeMaterialItem,
      lifecycle: 'EXCLUDED',
    });
    render(<HealthcareCaseKitPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir' }),
    );
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Excluir' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/historial, actor, fecha y motivo/i)).toBeTruthy();

    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Motivo' }),
      '  No requerido  ',
    );
    await userEvent.click(submit);

    await waitFor(() =>
      expect(excludeHealthcareCaseKitItem).toHaveBeenCalledWith(
        'kit-1',
        'item-1',
        'No requerido',
      ),
    );
    expect(
      await screen.findByText('Contenido excluido; el historial se conservó.'),
    ).toBeTruthy();
    expect(getHealthcareCaseKit).toHaveBeenCalledTimes(2);
  });

  it('renders excluded history and its immutable audit without an action', async () => {
    vi.mocked(getHealthcareCaseKit).mockResolvedValue({
      ...emptyKit,
      items: [
        {
          ...activeMaterialItem,
          lifecycle: 'EXCLUDED',
          excludedBy: {
            id: 'user-2',
            firstName: 'Mario',
            lastName: 'Ruiz',
          },
          excludedAt: '2026-09-27T13:00:00Z',
          exclusionReason: 'No requerido',
        },
      ],
    });
    render(<HealthcareCaseKitPage />);

    expect(await screen.findByText('Historial excluido')).toBeTruthy();
    expect(screen.getByText(/Excluido por Mario Ruiz/i)).toBeTruthy();
    expect(screen.getByText('Motivo: No requerido')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
  });

  it('keeps an exclusion error inside the flow without changing the session', async () => {
    vi.mocked(getHealthcareCaseKit).mockResolvedValue({
      ...emptyKit,
      items: [activeMaterialItem],
    });
    vi.mocked(excludeHealthcareCaseKitItem).mockRejectedValue(
      new Error('No fue posible excluir'),
    );
    render(<HealthcareCaseKitPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir' }),
    );
    await userEvent.type(
      within(screen.getByRole('dialog')).getByRole('textbox', {
        name: 'Motivo',
      }),
      'No requerido',
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Excluir',
      }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No fue posible excluir',
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(state.role).toBe('MANAGER');
  });

  it('shows readiness and confirms preparation before refreshing', async () => {
    const preparedKit: HealthcareCaseKit = {
      ...emptyKit,
      status: 'PREPARED',
      preparedBy: { id: 'user-1', firstName: 'Ana', lastName: 'López' },
      preparedAt: '2026-09-28T12:00:00Z',
    };
    vi.mocked(getHealthcareCaseKit)
      .mockResolvedValueOnce(emptyKit)
      .mockResolvedValueOnce(preparedKit);
    vi.mocked(confirmHealthcareCaseKitPreparation).mockResolvedValue(
      preparedKit,
    );

    render(<HealthcareCaseKitPage />);
    expect(await screen.findByText('Listo para confirmar')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: /confirmar preparación/i }),
    );

    await waitFor(() =>
      expect(confirmHealthcareCaseKitPreparation).toHaveBeenCalledWith('kit-1'),
    );
    expect(await screen.findByText('Preparado')).toBeTruthy();
    expect(screen.getByText(/Preparado por Ana López/i)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /agregar contenido/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /confirmar preparación/i }),
    ).toBeNull();
  });

  it('keeps a confirmation error in the flow without changing the session', async () => {
    vi.mocked(confirmHealthcareCaseKitPreparation).mockRejectedValue(
      new Error('La preparación cambió y requiere revisión'),
    );

    render(<HealthcareCaseKitPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: /confirmar preparación/i }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'La preparación cambió y requiere revisión',
    );
    expect(
      screen.getByRole('button', { name: /confirmar preparación/i }),
    ).toBeTruthy();
    expect(state.role).toBe('MANAGER');
  });

  it('retains PREPARED while rendering post-preparation blockers', async () => {
    vi.mocked(getHealthcareCaseKit).mockResolvedValue({
      ...emptyKit,
      status: 'PREPARED',
      preparedBy: { id: 'user-1', firstName: 'Ana', lastName: 'López' },
      preparedAt: '2026-09-28T12:00:00Z',
      preparationReadiness: {
        status: 'BLOCKED',
        blockers: [{ code: 'CASE_KIT_ASSIGNMENT_NOT_RESERVED' }],
      },
    });

    render(<HealthcareCaseKitPage />);

    expect(await screen.findByText('Preparado')).toBeTruthy();
    expect(screen.getByText('Bloqueado')).toBeTruthy();
    expect(
      screen.getByText('Una asignación incluida ya no está reservada.'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /confirmar preparación/i }),
    ).toBeNull();
  });

  it.each([
    'CASE_KIT_PREPARATION_BLOCKED',
    'CASE_KIT_NOT_MUTABLE',
    'RESOURCE_STATE_CHANGED',
  ])('refetches authoritative readiness after %s', async (code) => {
    vi.mocked(getHealthcareCaseKit)
      .mockResolvedValueOnce(emptyKit)
      .mockResolvedValueOnce({
        ...emptyKit,
        preparationReadiness: {
          status: 'BLOCKED',
          blockers: [{ code: 'CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE' }],
        },
      });
    vi.mocked(confirmHealthcareCaseKitPreparation).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { code, message: 'La preparación cambió y requiere revisión.' },
      },
    });
    render(<HealthcareCaseKitPage />);
    expect(await screen.findByText('Listo para confirmar')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: /confirmar preparación/i }),
    );
    expect(await screen.findByText('Bloqueado')).toBeTruthy();
    expect(
      screen.getByText(
        'El producto de un requerimiento incluido está inactivo.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Listo para confirmar')).toBeNull();
    expect(
      screen.getByText('La preparación cambió y requiere revisión.'),
    ).toBeTruthy();
    expect(getHealthcareCaseKit).toHaveBeenCalledTimes(2);
  });

  it('hides stale readiness and retains the conflict when refetch fails, then allows retry', async () => {
    vi.mocked(getHealthcareCaseKit)
      .mockResolvedValueOnce(emptyKit)
      .mockRejectedValueOnce(new Error('No fue posible actualizar el maletín.'))
      .mockResolvedValueOnce({
        ...emptyKit,
        status: 'PREPARED',
        preparedBy: emptyKit.createdBy,
        preparedAt: '2026-09-28T12:00:00Z',
        preparationReadiness: {
          status: 'BLOCKED',
          blockers: [{ code: 'CASE_KIT_CASE_CANCELLED' }],
        },
      });
    vi.mocked(confirmHealthcareCaseKitPreparation).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'RESOURCE_STATE_CHANGED',
          message: 'La preparación cambió.',
        },
      },
    });
    render(<HealthcareCaseKitPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: /confirmar preparación/i }),
    );
    expect(
      await screen.findByText('No fue posible actualizar el maletín.'),
    ).toBeTruthy();
    expect(screen.getByText('La preparación cambió.')).toBeTruthy();
    expect(screen.queryByText('Listo para confirmar')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /confirmar preparación/i }),
    ).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Preparado')).toBeTruthy();
    expect(screen.getByText(/Preparado por Ana López/i)).toBeTruthy();
    expect(screen.getByText('Bloqueado')).toBeTruthy();
    expect(getHealthcareCaseKit).toHaveBeenCalledTimes(3);
  });
});
