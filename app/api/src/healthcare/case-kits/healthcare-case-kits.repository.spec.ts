/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {
  HealthcareCaseKitItemLifecycle,
  HealthcareCaseKitStatus,
} from '@prisma/client';

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

  it.each([
    ['lockActiveItems', 'HealthcareCaseKitItem'],
    ['lockCaseRequirements', 'HealthcareCaseRequirement'],
    ['lockActiveItemAssignments', 'HealthcareEquipmentAssignment'],
  ] as const)(
    'locks preparation sources deterministically with %s',
    async (method, table) => {
      const queryRaw = jest.fn().mockResolvedValue([]);
      const repository = new HealthcareCaseKitsRepository({} as never);

      if (method === 'lockCaseRequirements') {
        await repository[method](
          { $queryRaw: queryRaw } as never,
          companyId,
          'case-id',
        );
      } else {
        await repository[method](
          { $queryRaw: queryRaw } as never,
          companyId,
          caseKitId,
        );
      }

      const sql = queryRaw.mock.calls[0][0].strings.join('');
      expect(sql).toContain(`"${table}"`);
      expect(sql).toContain('ORDER BY "id"');
      expect(sql).toContain('FOR UPDATE');
    },
  );

  it.each([
    [
      'lockActiveItemProducts',
      'Product',
      'HealthcareCaseRequirement',
      'productId',
      'requirementId',
    ],
    [
      'lockActiveItemEquipmentAssets',
      'EquipmentAsset',
      'HealthcareEquipmentAssignment',
      'equipmentAssetId',
      'equipmentAssignmentId',
    ],
  ] as const)(
    '%s locks distinct ACTIVE item sources in tenant-scoped ID order',
    async (method, table, sourceTable, sourceId, itemSourceId) => {
      const queryRaw = jest
        .fn()
        .mockResolvedValue([{ id: 'source-a' }, { id: 'source-b' }]);
      const repository = new HealthcareCaseKitsRepository({} as never);

      await expect(
        repository[method](
          { $queryRaw: queryRaw } as never,
          companyId,
          caseKitId,
        ),
      ).resolves.toEqual(['source-a', 'source-b']);

      const query = queryRaw.mock.calls[0][0];
      const sql = query.strings.join('');
      expect(sql).toContain(`SELECT "id" FROM "${table}"`);
      // IN keeps duplicates in the source join from multiplying locked rows.
      expect(sql).toContain('AND "id" IN (');
      expect(sql).toContain(`JOIN "${sourceTable}"`);
      expect(sql).toContain(`."${sourceId}"`);
      expect(sql).toContain(`item."${itemSourceId}"`);
      expect(sql).toContain('WHERE "companyId" = ');
      expect(sql).toContain('WHERE item."companyId" = ');
      expect(sql).toContain('= item."companyId"');
      expect(sql).toContain('= item."caseId"');
      expect(sql).toContain('item."caseKitId" = ');
      expect(sql).toContain('item."lifecycle" = \'ACTIVE\'');
      expect(sql).toContain('ORDER BY "id"');
      expect(sql).toContain('FOR UPDATE');
      expect(query.values).toEqual([companyId, companyId, caseKitId]);
    },
  );

  it('uses a tenant-scoped conditional DRAFT to PREPARED update', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new HealthcareCaseKitsRepository({} as never);
    const preparedAt = new Date('2026-09-28T12:00:00.000Z');

    await repository.confirmPreparation(
      { healthcareCaseKit: { updateMany } } as never,
      {
        companyId,
        caseKitId,
        preparedById: excludedById,
        preparedAt,
      },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: caseKitId,
        companyId,
        status: HealthcareCaseKitStatus.DRAFT,
      },
      data: {
        status: HealthcareCaseKitStatus.PREPARED,
        preparedById: excludedById,
        preparedAt,
      },
    });
  });
});
