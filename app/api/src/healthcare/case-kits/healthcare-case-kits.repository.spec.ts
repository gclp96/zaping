/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { HealthcareCaseKitItemLifecycle } from '@prisma/client';

import { HealthcareCaseKitsRepository } from './healthcare-case-kits.repository';

describe('HealthcareCaseKitsRepository', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';
  const caseKitId = '22222222-2222-4222-8222-222222222222';
  const itemId = '33333333-3333-4333-8333-333333333333';
  const excludedById = '44444444-4444-4444-8444-444444444444';
  const excludedAt = new Date('2026-09-27T12:00:00.000Z');

  it('checks duplicates among ACTIVE items only', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new HealthcareCaseKitsRepository({
      healthcareCaseKitItem: { findFirst },
    } as never);

    await repository.findDuplicateItem(companyId, caseKitId, {
      requirementId: 'requirement-id',
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        companyId,
        caseKitId,
        lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
        requirementId: 'requirement-id',
      },
      select: { id: true },
    });
  });

  it('uses a tenant- and Kit-scoped conditional exclusion update', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new HealthcareCaseKitsRepository({} as never);

    await repository.excludeItem(
      { healthcareCaseKitItem: { updateMany } } as never,
      {
        companyId,
        caseKitId,
        itemId,
        excludedById,
        excludedAt,
        exclusionReason: 'No requerido',
      },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: itemId,
        companyId,
        caseKitId,
        lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
      },
      data: {
        lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
        excludedById,
        excludedAt,
        exclusionReason: 'No requerido',
      },
    });
  });

  it('locks one tenant- and Kit-scoped item FOR UPDATE', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: itemId }]);
    const repository = new HealthcareCaseKitsRepository({} as never);

    await expect(
      repository.lockItem(
        { $queryRaw: queryRaw } as never,
        companyId,
        caseKitId,
        itemId,
      ),
    ).resolves.toBe(true);

    const query = queryRaw.mock.calls[0][0];
    expect(query.strings.join('')).toContain('FOR UPDATE');
    expect(query.strings.join('')).toContain('"caseKitId" = ');
    expect(query.values).toEqual([itemId, companyId, caseKitId]);
  });
});
