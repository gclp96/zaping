import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './api';
import {
  createHealthcareRequirement,
  getHealthcareRequirement,
  getHealthcareRequirementErrorMessage,
  listHealthcareRequirements,
  reactivateHealthcareRequirement,
  reorderHealthcareRequirements,
  retireHealthcareRequirement,
  updateHealthcareRequirement,
} from './healthcare-requirements';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const requirement = {
  id: 'requirement-1',
  caseId: 'case-1',
  productId: 'product-1',
  requestedQty: 2,
  type: 'REQUIRED',
  notes: null,
  sortOrder: 0,
  lifecycle: 'ACTIVE',
  retiredAt: null,
  retirementReason: null,
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
  product: {
    id: 'product-1',
    sku: 'SKU-1',
    name: 'Producto 1',
    isActive: true,
    inventoryTracking: 'QUANTITY',
  },
} as const;

describe('healthcare requirements API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: requirement } as never);
    vi.mocked(api.post).mockResolvedValue({ data: requirement } as never);
    vi.mocked(api.patch).mockResolvedValue({ data: requirement } as never);
  });

  it('uses the approved seven routes and payloads', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: [requirement] } } as never)
      .mockResolvedValueOnce({ data: requirement } as never);
    vi.mocked(api.patch)
      .mockResolvedValueOnce({ data: { items: [requirement] } } as never)
      .mockResolvedValueOnce({ data: requirement } as never);

    await listHealthcareRequirements('case-1', 'ALL');
    await createHealthcareRequirement('case-1', {
      productId: 'product-1',
      requestedQty: 2,
      type: 'REQUIRED',
      notes: null,
      sortOrder: 0,
    });
    await reorderHealthcareRequirements('case-1', {
      items: [{ requirementId: 'requirement-1', sortOrder: 1 }],
    });
    await getHealthcareRequirement('requirement-1');
    await updateHealthcareRequirement('requirement-1', { requestedQty: 3 });
    await retireHealthcareRequirement('requirement-1', 'Ya no se necesita');
    await reactivateHealthcareRequirement('requirement-1');

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      '/healthcare/cases/case-1/requirements',
      { params: { status: 'ALL' } },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/healthcare/cases/case-1/requirements',
      {
        productId: 'product-1',
        requestedQty: 2,
        type: 'REQUIRED',
        notes: null,
        sortOrder: 0,
      },
    );
    expect(api.patch).toHaveBeenNthCalledWith(
      1,
      '/healthcare/cases/case-1/requirements/reorder',
      { items: [{ requirementId: 'requirement-1', sortOrder: 1 }] },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      '/healthcare/requirements/requirement-1',
    );
    expect(api.patch).toHaveBeenNthCalledWith(
      2,
      '/healthcare/requirements/requirement-1',
      { requestedQty: 3 },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/healthcare/requirements/requirement-1/retire',
      { retirementReason: 'Ya no se necesita' },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      3,
      '/healthcare/requirements/requirement-1/reactivate',
      {},
    );
  });

  it('translates stable codes without exposing raw backend messages', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          code: 'REQUIREMENT_FULFILLMENT_LOCKED',
          message: 'raw backend detail',
        },
      },
    };

    expect(getHealthcareRequirementErrorMessage(error, 'Fallback seguro')).toBe(
      'El requerimiento tiene evidencia operacional y ya no puede modificarse.',
    );
    expect(
      getHealthcareRequirementErrorMessage(
        {
          isAxiosError: true,
          response: { data: { code: 'UNKNOWN', message: 'raw' } },
        },
        'Fallback seguro',
      ),
    ).toBe('Fallback seguro');
  });
});
