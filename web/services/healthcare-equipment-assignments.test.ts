import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './api';
import {
  getHealthcareEquipmentAssignment,
  listHealthcareEquipmentAssignments,
  type HealthcareEquipmentAssignment,
} from './healthcare-equipment-assignments';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
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
});
