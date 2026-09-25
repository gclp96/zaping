import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './api';
import {
  createDirectHealthcareEquipmentAssignment,
  getHealthcareEquipmentAssignment,
  listEligibleEquipmentAssignmentAssets,
  listHealthcareEquipmentAssignments,
  type HealthcareEquipmentAssignment,
  type HealthcareEquipmentAssignmentAssetCandidate,
} from './healthcare-equipment-assignments';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const assignment = {
  id: 'assignment-1',
  caseId: 'case-1',
} as HealthcareEquipmentAssignment;

describe('healthcare-equipment-assignments service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista todas las asignaciones del Case con paginación explícita', async () => {
    const response = {
      items: [assignment],
      pagination: {
        page: 2,
        pageSize: 10,
        totalItems: 11,
        totalPages: 2,
      },
    };
    vi.mocked(api.get).mockResolvedValue({ data: response });

    await expect(
      listHealthcareEquipmentAssignments('case-1', 2, 10),
    ).resolves.toEqual(response);
    expect(api.get).toHaveBeenCalledWith(
      '/healthcare/equipment-assignments',
      {
        params: {
          caseId: 'case-1',
          status: 'ALL',
          page: 2,
          pageSize: 10,
        },
      },
    );
  });

  it('obtiene el detalle por Assignment sin emitir mutaciones', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: assignment });

    await expect(
      getHealthcareEquipmentAssignment('assignment-1'),
    ).resolves.toEqual(assignment);
    expect(api.get).toHaveBeenCalledWith(
      '/healthcare/equipment-assignments/assignment-1',
    );
  });

  it('lista sólo equipos elegibles según lifecycle y condition del contrato', async () => {
    const eligibleAsset = {
      id: 'asset-good',
      lifecycle: 'ACTIVE',
      condition: 'GOOD',
    } as HealthcareEquipmentAssignmentAssetCandidate;
    const retiredAsset = {
      id: 'asset-retired',
      lifecycle: 'RETIRED',
      condition: 'GOOD',
    } as HealthcareEquipmentAssignmentAssetCandidate;
    const damagedAsset = {
      id: 'asset-damaged',
      lifecycle: 'ACTIVE',
      condition: 'DAMAGED',
    } as HealthcareEquipmentAssignmentAssetCandidate;
    const pendingAsset = {
      id: 'asset-pending',
      lifecycle: 'ACTIVE',
      condition: 'INSPECTION_PENDING',
    } as HealthcareEquipmentAssignmentAssetCandidate;
    vi.mocked(api.get).mockResolvedValue({
      data: [eligibleAsset, retiredAsset, damagedAsset, pendingAsset],
    });

    await expect(listEligibleEquipmentAssignmentAssets()).resolves.toEqual([
      eligibleAsset,
    ]);
    expect(api.get).toHaveBeenCalledWith('/equipment');
  });

  it('crea una DIRECT con una Idempotency-Key nueva por request', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { outcome: 'CREATED', data: assignment },
    });
    const payload = {
      caseId: 'case-1',
      equipmentAssetId: 'asset-1',
      directAssignmentReason: 'Necesidad operativa',
    };

    await createDirectHealthcareEquipmentAssignment(payload);
    await createDirectHealthcareEquipmentAssignment(payload);

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/healthcare/equipment-assignments',
      payload,
      {
        headers: {
          'Idempotency-Key': expect.stringMatching(/^hc-assignment-/),
        },
      },
    );
    const firstKey = vi.mocked(api.post).mock.calls[0]?.[2]?.headers?.[
      'Idempotency-Key'
    ];
    const secondKey = vi.mocked(api.post).mock.calls[1]?.[2]?.headers?.[
      'Idempotency-Key'
    ];
    expect(firstKey).not.toBe(secondKey);
  });
});
