import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@/app/auth-session';
import { api } from '@/services/api';
import type { HealthcareRequirement } from '@/services/healthcare-requirements';

import type { HealthcareCase } from '../types';
import HealthcareRequirementsSection from './HealthcareRequirementsSection';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const product = {
  id: 'product-1',
  sku: 'SKU-001',
  name: 'Implante principal',
  isActive: true,
  inventoryTracking: 'QUANTITY',
} as const;

const backupProduct = {
  id: 'product-2',
  sku: 'SKU-002',
  name: 'Implante de respaldo',
  isActive: true,
  inventoryTracking: 'SERIALIZED',
} as const;

const activeRequirement: HealthcareRequirement = {
  id: 'requirement-1',
  caseId: 'case-1',
  productId: product.id,
  requestedQty: 2,
  type: 'REQUIRED',
  notes: 'Medida principal',
  sortOrder: 10,
  lifecycle: 'ACTIVE',
  retiredAt: null,
  retirementReason: null,
  createdAt: '2026-09-14T10:00:00.000Z',
  updatedAt: '2026-09-14T10:00:00.000Z',
  product,
};

const secondActiveRequirement: HealthcareRequirement = {
  ...activeRequirement,
  id: 'requirement-2',
  productId: backupProduct.id,
  type: 'BACKUP',
  sortOrder: 20,
  product: backupProduct,
};

const retiredRequirement: HealthcareRequirement = {
  ...activeRequirement,
  id: 'requirement-retired',
  productId: 'product-retired',
  lifecycle: 'RETIRED',
  retiredAt: '2026-09-14T11:00:00.000Z',
  retirementReason: 'Cambio de plan clínico',
  product: {
    ...product,
    id: 'product-retired',
    sku: 'SKU-OLD',
    name: 'Producto histórico',
    isActive: false,
  },
};

const healthcareCase: HealthcareCase = {
  id: 'case-1',
  doctorId: null,
  hospitalId: null,
  folio: 'HC-0001',
  title: 'Caso de prueba',
  procedureDescription: null,
  status: 'SCHEDULED',
  scheduledStart: null,
  scheduledEnd: null,
  responsibleUserId: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
  doctor: null,
  hospital: null,
};

function configureApi({
  active = [activeRequirement],
  retired = [retiredRequirement],
}: {
  active?: HealthcareRequirement[];
  retired?: HealthcareRequirement[];
} = {}) {
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    const path = String(url);
    if (path === '/products') {
      return { data: [product, backupProduct] } as never;
    }
    if (path === '/healthcare/cases/case-1/requirements') {
      const status = (config?.params as { status?: string } | undefined)
        ?.status;
      return {
        data: {
          items:
            status === 'RETIRED'
              ? retired
              : status === 'ALL'
                ? [...active, ...retired]
                : active,
        },
      } as never;
    }
    throw new Error(`Unexpected GET ${path}`);
  });
  vi.mocked(api.post).mockResolvedValue({ data: activeRequirement } as never);
  vi.mocked(api.patch).mockResolvedValue({
    data: { items: [activeRequirement] },
  } as never);
}

async function renderSection(
  role: UserRole | null = 'ADMIN',
  targetCase: HealthcareCase = healthcareCase,
) {
  render(
    <HealthcareRequirementsSection healthcareCase={targetCase} role={role} />,
  );
  await screen.findByText('Implante principal');
}

async function openActions(
  user: ReturnType<typeof userEvent.setup>,
  sku: string,
) {
  await user.click(
    screen.getByRole('button', {
      name: `Acciones del requerimiento ${sku}`,
    }),
  );
}

function apiError(code: string) {
  return {
    isAxiosError: true,
    response: {
      data: {
        code,
        message: 'raw backend detail',
      },
    },
  };
}

async function openCreateWithProduct(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Nuevo requerimiento' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Nuevo requerimiento',
  });
  const productSelect = within(dialog).getByRole('combobox', {
    name: 'Producto',
  });
  await waitFor(() =>
    expect((productSelect as HTMLSelectElement).disabled).toBe(false),
  );
  await user.selectOptions(productSelect, product.id);
  return dialog;
}

describe('HealthcareRequirementsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureApi();
  });

  afterEach(() => cleanup());

  it('carga ACTIVE por defecto y muestra el histórico e indicador de producto inactivo', async () => {
    const user = userEvent.setup();
    await renderSection();

    expect(api.get).toHaveBeenCalledWith(
      '/healthcare/cases/case-1/requirements',
      { params: { status: 'ACTIVE' } },
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Requerido')).toBeTruthy();
    expect(screen.getByText('Medida principal')).toBeTruthy();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Vigencia' }),
      'ALL',
    );

    expect(await screen.findByText('Producto histórico')).toBeTruthy();
    expect(screen.getByText('Producto inactivo (histórico)')).toBeTruthy();
    expect(screen.getByText('Cambio de plan clínico')).toBeTruthy();
  });

  it('muestra el estado vacío y conserva el orden estable recibido del backend', async () => {
    configureApi({ active: [] });
    const { unmount } = render(
      <HealthcareRequirementsSection
        healthcareCase={healthcareCase}
        role="ADMIN"
      />,
    );
    expect(await screen.findByText('Sin requerimientos activos')).toBeTruthy();
    unmount();

    configureApi({
      active: [
        { ...secondActiveRequirement, sortOrder: 10 },
        activeRequirement,
      ],
    });
    await renderSection();
    const rows = within(
      screen.getByRole('table', {
        name: 'Requerimientos del caso HC-0001',
      }),
    ).getAllByRole('row');
    expect(within(rows[1]).getByText('Implante de respaldo')).toBeTruthy();
    expect(within(rows[2]).getByText('Implante principal')).toBeTruthy();
  });

  it.each(['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE'] as const)(
    'permite administrar requerimientos a %s',
    async (role) => {
      await renderSection(role);
      expect(
        screen.getByRole('button', { name: 'Nuevo requerimiento' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: 'Acciones del requerimiento SKU-001',
        }),
      ).toBeTruthy();
    },
  );

  it('no presenta mutaciones sin un rol autorizado', async () => {
    await renderSection(null);
    expect(
      screen.queryByRole('button', { name: 'Nuevo requerimiento' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Acciones del requerimiento SKU-001',
      }),
    ).toBeNull();
  });

  it('crea con producto activo y sólo envía campos aprobados', async () => {
    const user = userEvent.setup();
    await renderSection('WAREHOUSE');
    await user.click(
      screen.getByRole('button', { name: 'Nuevo requerimiento' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Nuevo requerimiento',
    });
    await waitFor(() =>
      expect(
        (
          within(dialog).getByRole('combobox', {
            name: 'Producto',
          }) as HTMLSelectElement
        ).disabled,
      ).toBe(false),
    );
    await user.type(
      within(dialog).getByRole('searchbox', {
        name: 'Buscar productos activos',
      }),
      'SKU-002',
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Producto' }),
      backupProduct.id,
    );
    await user.clear(
      within(dialog).getByRole('spinbutton', { name: 'Cantidad solicitada' }),
    );
    await user.type(
      within(dialog).getByRole('spinbutton', { name: 'Cantidad solicitada' }),
      '3',
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Tipo' }),
      'BACKUP',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Notas (opcional)' }),
      '  Alternativa  ',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar requerimiento' }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/healthcare/cases/case-1/requirements',
        {
          productId: backupProduct.id,
          requestedQty: 3,
          type: 'BACKUP',
          notes: 'Alternativa',
          sortOrder: 0,
        },
      ),
    );
    const payload = vi.mocked(api.post).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('companyId');
    expect(payload).not.toHaveProperty('caseId');
    expect(payload).not.toHaveProperty('lifecycle');
    expect(payload).not.toHaveProperty('createdById');
  });

  it('valida los campos requeridos antes de crear', async () => {
    const user = userEvent.setup();
    await renderSection();
    await user.click(
      screen.getByRole('button', { name: 'Nuevo requerimiento' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Nuevo requerimiento',
    });
    const productSelect = within(dialog).getByRole('combobox', {
      name: 'Producto',
    }) as HTMLSelectElement;
    expect(productSelect.required).toBe(true);
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar requerimiento' }),
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each([
    [
      'REQUIREMENT_ALREADY_ACTIVE',
      'Este producto ya tiene un requerimiento activo en el caso.',
    ],
    [
      'PRODUCT_INACTIVE',
      'El producto está inactivo. Selecciona un producto activo.',
    ],
  ])('traduce el conflicto CREATE %s', async (code, expectedMessage) => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(apiError(code));
    await renderSection();
    const dialog = await openCreateWithProduct(user);
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar requerimiento' }),
    );

    expect(await within(dialog).findByText(expectedMessage)).toBeTruthy();
    expect(within(dialog).queryByText('raw backend detail')).toBeNull();
  });

  it('actualiza una línea activa sin permitir cambiar Product', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openActions(user, product.sku);
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar requerimiento',
    });
    expect(
      within(dialog).queryByRole('combobox', { name: 'Producto' }),
    ).toBeNull();
    await user.clear(
      within(dialog).getByRole('spinbutton', { name: 'Cantidad solicitada' }),
    );
    await user.type(
      within(dialog).getByRole('spinbutton', { name: 'Cantidad solicitada' }),
      '4',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar cambios' }),
    );

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/healthcare/requirements/requirement-1',
        {
          requestedQty: 4,
          type: 'REQUIRED',
          notes: 'Medida principal',
          sortOrder: 10,
        },
      ),
    );
  });

  it('mantiene RETIRED en sólo lectura salvo reactivación explícita', async () => {
    const user = userEvent.setup();
    await renderSection();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Vigencia' }),
      'RETIRED',
    );
    await screen.findByText('Producto histórico');
    expect(api.get).toHaveBeenCalledWith(
      '/healthcare/cases/case-1/requirements',
      { params: { status: 'RETIRED' } },
    );
    await openActions(user, 'SKU-OLD');
    expect(
      (screen.getByRole('menuitem', { name: 'Editar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('menuitem', {
          name: 'Acción destructiva: Retirar',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('menuitem', { name: 'Reactivar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('muestra un cambio de estado estable al actualizar', async () => {
    const user = userEvent.setup();
    vi.mocked(api.patch).mockRejectedValueOnce(
      apiError('RESOURCE_STATE_CHANGED'),
    );
    await renderSection();
    await openActions(user, product.sku);
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar requerimiento',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar cambios' }),
    );

    expect(
      await within(dialog).findByText(
        'El requerimiento cambió de estado. Actualiza la lista e intenta nuevamente.',
      ),
    ).toBeTruthy();
  });

  it('exige motivo y confirma el retiro sin usar semántica Delete', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openActions(user, product.sku);
    await user.click(
      screen.getByRole('menuitem', {
        name: 'Acción destructiva: Retirar',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Retirar requerimiento',
    });
    expect(within(dialog).queryByText(/eliminar/i)).toBeNull();
    const reasonInput = within(dialog).getByRole('textbox', {
      name: 'Motivo del retiro',
    }) as HTMLTextAreaElement;
    expect(reasonInput.required).toBe(true);
    await user.click(
      within(dialog).getByRole('button', { name: 'Retirar requerimiento' }),
    );
    expect(api.post).not.toHaveBeenCalled();
    await user.type(reasonInput, 'Cambio de plan');
    await user.click(
      within(dialog).getByRole('button', { name: 'Retirar requerimiento' }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/healthcare/requirements/requirement-1/retire',
        { retirementReason: 'Cambio de plan' },
      ),
    );
  });

  it('muestra un error estable al retirar y conserva la confirmación', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(
      apiError('REQUIREMENT_FULFILLMENT_LOCKED'),
    );
    await renderSection();
    await openActions(user, product.sku);
    await user.click(
      screen.getByRole('menuitem', {
        name: 'Acción destructiva: Retirar',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Retirar requerimiento',
    });
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Motivo del retiro' }),
      'Cambio de plan',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Retirar requerimiento' }),
    );

    expect(
      await within(dialog).findByText(
        'El requerimiento tiene evidencia operacional y ya no puede modificarse.',
      ),
    ).toBeTruthy();
  });

  it('reactiva explícitamente una línea retirada', async () => {
    const user = userEvent.setup();
    await renderSection();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Vigencia' }),
      'RETIRED',
    );
    await screen.findByText('Producto histórico');
    await openActions(user, 'SKU-OLD');
    await user.click(screen.getByRole('menuitem', { name: 'Reactivar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Reactivar requerimiento',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Reactivar' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/healthcare/requirements/requirement-retired/reactivate',
        {},
      ),
    );
  });

  it('muestra PRODUCT_INACTIVE dentro de la confirmación de reactivación', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(apiError('PRODUCT_INACTIVE'));
    await renderSection();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Vigencia' }),
      'RETIRED',
    );
    await screen.findByText('Producto histórico');
    await openActions(user, 'SKU-OLD');
    await user.click(screen.getByRole('menuitem', { name: 'Reactivar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Reactivar requerimiento',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Reactivar' }));

    expect(
      await within(dialog).findByText(
        'El producto está inactivo. Selecciona un producto activo.',
      ),
    ).toBeTruthy();
  });

  it('persiste un orden explícito y refresca desde servidor', async () => {
    const user = userEvent.setup();
    configureApi({ active: [activeRequirement, secondActiveRequirement] });
    await renderSection();
    await openActions(user, product.sku);
    await user.click(screen.getByRole('menuitem', { name: 'Mover abajo' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/healthcare/cases/case-1/requirements/reorder',
        {
          items: [
            { requirementId: 'requirement-2', sortOrder: 0 },
            { requirementId: 'requirement-1', sortOrder: 1 },
          ],
        },
      ),
    );
    expect(
      vi
        .mocked(api.get)
        .mock.calls.filter(
          ([url]) => String(url) === '/healthcare/cases/case-1/requirements',
        ).length,
    ).toBeGreaterThan(1);
  });

  it('muestra el error estable del backend al reordenar', async () => {
    const user = userEvent.setup();
    configureApi({ active: [activeRequirement, secondActiveRequirement] });
    vi.mocked(api.patch).mockRejectedValueOnce(
      apiError('INVALID_REQUIREMENT_REORDER'),
    );
    await renderSection();
    await openActions(user, product.sku);
    await user.click(screen.getByRole('menuitem', { name: 'Mover abajo' }));

    expect(
      await screen.findByText(
        'No fue posible guardar el nuevo orden. Actualiza la lista e intenta nuevamente.',
      ),
    ).toBeTruthy();
  });

  it('mantiene CANCELLED como historial visible sin controles de mutación', async () => {
    await renderSection('WAREHOUSE', {
      ...healthcareCase,
      status: 'CANCELLED',
    });
    expect(screen.getByText(/permanece.*historial/i)).toBeTruthy();
    expect(screen.getByText('Implante principal')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Nuevo requerimiento' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Acciones del requerimiento SKU-001',
      }),
    ).toBeNull();
  });

  it('traduce REQUIREMENT_RETIRED con guía de reactivación', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: {
          code: 'REQUIREMENT_RETIRED',
          message: 'raw detail',
        },
      },
    });
    await renderSection();
    await user.click(
      screen.getByRole('button', { name: 'Nuevo requerimiento' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Nuevo requerimiento',
    });
    await waitFor(() =>
      expect(
        (
          within(dialog).getByRole('combobox', {
            name: 'Producto',
          }) as HTMLSelectElement
        ).disabled,
      ).toBe(false),
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Producto' }),
      product.id,
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar requerimiento' }),
    );

    expect(
      await within(dialog).findByText(
        /Usa la vista Retirados para reactivarlo/,
      ),
    ).toBeTruthy();
    expect(within(dialog).queryByText('raw detail')).toBeNull();
  });
});
