import {
  HealthcareCaseStatus,
  HealthcareRequirementLifecycle,
  HealthcareRequirementType,
  Prisma,
  ProductInventoryTracking,
} from '@prisma/client';

import { requirementFulfillmentLockedException } from '../common/healthcare-errors';
import { HealthcareRequirementListStatus } from './dto/healthcare-requirement-list-query.dto';
import { HealthcareRequirementsService } from './healthcare-requirements.service';
import { NoopRequirementOperationalEvidencePolicy } from './requirement-operational-evidence-policy';

const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompanyId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const caseId = '44444444-4444-4444-8444-444444444444';
const productId = '55555555-5555-4555-8555-555555555555';
const requirementId = '66666666-6666-4666-8666-666666666666';
const requirementIdB = '77777777-7777-4777-8777-777777777777';

const createDto = {
  productId,
  requestedQty: 2,
  type: HealthcareRequirementType.REQUIRED,
  notes: '  Preparar con cuidado  ',
  sortOrder: 10,
};

const product = {
  id: productId,
  sku: 'SKU-1',
  name: 'Producto clínico',
  isActive: true,
  inventoryTracking: ProductInventoryTracking.QUANTITY,
};

const baseRecord = {
  id: requirementId,
  companyId,
  caseId,
  productId,
  requestedQty: 2,
  type: HealthcareRequirementType.REQUIRED,
  notes: 'Preparar con cuidado',
  sortOrder: 10,
  lifecycle: HealthcareRequirementLifecycle.ACTIVE,
  createdById: userId,
  retiredAt: null,
  retiredById: null,
  retirementReason: null,
  reactivatedAt: null,
  reactivatedById: null,
  createdAt: new Date('2026-09-14T01:00:00.000Z'),
  updatedAt: new Date('2026-09-14T01:00:00.000Z'),
  product,
};

type RecordOverrides = Partial<typeof baseRecord> & {
  product?: typeof product;
};

const makeRecord = (overrides: RecordOverrides = {}) => ({
  ...baseRecord,
  ...overrides,
  product: overrides.product ?? product,
});

const makeIdentity = (
  lifecycle = HealthcareRequirementLifecycle.ACTIVE,
  id = requirementId,
) => ({ id, companyId, caseId, productId, lifecycle });

const makeLockedRequirement = (
  lifecycle = HealthcareRequirementLifecycle.ACTIVE,
  id = requirementId,
  sortOrder = 10,
) => ({ id, caseId, productId, lifecycle, sortOrder });

type RequirementFindManyCall = {
  where: Record<string, unknown>;
  select: {
    product: { select: Record<string, boolean> };
    [key: string]: unknown;
  };
  orderBy: Array<Record<string, string>>;
};

type RequirementWriteCall = {
  where?: Record<string, unknown>;
  data: Record<string, unknown>;
  select?: Record<string, unknown>;
};

type RequirementPolicyContext = {
  companyId: string;
  caseId: string;
  requirementId: string;
  productId: string;
};

describe('HealthcareRequirementsService', () => {
  const transaction = {
    $queryRaw: jest.fn<Promise<unknown[]>, [Prisma.Sql]>(),
    healthcareCaseRequirement: {
      findUnique: jest.fn<Promise<unknown>, [unknown]>(),
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      findMany: jest.fn<Promise<unknown[]>, [RequirementFindManyCall]>(),
      create: jest.fn<Promise<unknown>, [RequirementWriteCall]>(),
      updateMany: jest.fn<Promise<{ count: number }>, [RequirementWriteCall]>(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    healthcareCase: {
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    },
    healthcareCaseRequirement: {
      findUnique: jest.fn<Promise<unknown>, [unknown]>(),
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      findMany: jest.fn<Promise<unknown[]>, [RequirementFindManyCall]>(),
    },
  };
  const evidencePolicy = {
    assertMutable: jest.fn<
      Promise<void>,
      [typeof transaction, RequirementPolicyContext]
    >(),
  };

  let service: HealthcareRequirementsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => unknown) => callback(transaction),
    );
    evidencePolicy.assertMutable.mockResolvedValue(undefined);
    service = new HealthcareRequirementsService(
      prisma as never,
      evidencePolicy as never,
    );
  });

  describe('read', () => {
    it('lists ACTIVE by default with deterministic ordering and explicit shaping', async () => {
      prisma.healthcareCase.findFirst.mockResolvedValue({ id: caseId });
      prisma.healthcareCaseRequirement.findMany.mockResolvedValue([
        makeRecord(),
      ]);

      await expect(
        service.findAllForCase(companyId, caseId, {}),
      ).resolves.toEqual({ items: [makeRecord()] });

      expect(prisma.healthcareCase.findFirst).toHaveBeenCalledWith({
        where: { id: caseId, companyId },
        select: { id: true },
      });
      const query = prisma.healthcareCaseRequirement.findMany.mock.calls[0][0];
      expect(query.where).toEqual({
        companyId,
        caseId,
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
      });
      expect(query.orderBy).toEqual([
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ]);
      expect(Object.keys(query.select.product.select).sort()).toEqual(
        ['id', 'inventoryTracking', 'isActive', 'name', 'sku'].sort(),
      );
      expect(query.select.product.select).not.toHaveProperty('stock');
      expect(query.select).not.toHaveProperty('createdBy');
    });

    it.each([
      [HealthcareRequirementListStatus.RETIRED, 'RETIRED'],
      [HealthcareRequirementListStatus.ALL, undefined],
    ] as const)('applies list status %s', async (status, lifecycle) => {
      prisma.healthcareCase.findFirst.mockResolvedValue({ id: caseId });
      prisma.healthcareCaseRequirement.findMany.mockResolvedValue([]);

      await service.findAllForCase(companyId, caseId, { status });

      expect(
        prisma.healthcareCaseRequirement.findMany.mock.calls[0][0].where,
      ).toEqual({
        companyId,
        caseId,
        ...(lifecycle ? { lifecycle } : {}),
      });
    });

    it('returns CASE_NOT_FOUND for a missing or foreign Case without a global lookup', async () => {
      prisma.healthcareCase.findFirst.mockResolvedValue(null);

      await expect(
        service.findAllForCase(otherCompanyId, caseId, {}),
      ).rejects.toMatchObject({ response: { code: 'CASE_NOT_FOUND' } });
      expect(prisma.healthcareCase.findFirst).toHaveBeenCalledWith({
        where: { id: caseId, companyId: otherCompanyId },
        select: { id: true },
      });
      expect(prisma.healthcareCaseRequirement.findMany).not.toHaveBeenCalled();
    });

    it('returns historical Requirements with an inactive compact Product', async () => {
      const historical = makeRecord({
        lifecycle: HealthcareRequirementLifecycle.RETIRED,
        product: { ...product, isActive: false },
      });
      prisma.healthcareCaseRequirement.findFirst.mockResolvedValue(historical);

      await expect(service.findOne(companyId, requirementId)).resolves.toEqual(
        historical,
      );
    });

    it('returns REQUIREMENT_NOT_FOUND for foreign detail IDs', async () => {
      prisma.healthcareCaseRequirement.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(otherCompanyId, requirementId),
      ).rejects.toMatchObject({ response: { code: 'REQUIREMENT_NOT_FOUND' } });
      expect(prisma.healthcareCaseRequirement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: requirementId, companyId: otherCompanyId },
        }),
      );
    });
  });

  describe('create', () => {
    it('locks Case then Product and creates an ACTIVE row without invoking the policy', async () => {
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([{ id: productId, isActive: true }]);
      transaction.healthcareCaseRequirement.findUnique.mockResolvedValue(null);
      transaction.healthcareCaseRequirement.create.mockResolvedValue(
        makeRecord(),
      );

      await expect(
        service.create(companyId, userId, caseId, createDto),
      ).resolves.toEqual(makeRecord());

      expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
      expect(
        transaction.$queryRaw.mock.calls[0][0].strings.join(' '),
      ).toContain('FROM "HealthcareCase"');
      expect(
        transaction.$queryRaw.mock.calls[1][0].strings.join(' '),
      ).toContain('FROM "Product"');
      expect(evidencePolicy.assertMutable).not.toHaveBeenCalled();
      const createCall =
        transaction.healthcareCaseRequirement.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        companyId,
        caseId,
        productId,
        createdById: userId,
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
        notes: 'Preparar con cuidado',
      });
      expect(createCall.data).not.toHaveProperty('id');
    });

    it('rejects CANCELLED Case before Product or Requirement access', async () => {
      transaction.$queryRaw.mockResolvedValueOnce([
        {
          id: caseId,
          caseId,
          productId,
          status: HealthcareCaseStatus.CANCELLED,
        },
      ]);

      await expect(
        service.create(companyId, userId, caseId, createDto),
      ).rejects.toMatchObject({
        response: { code: 'CASE_REQUIREMENTS_READ_ONLY' },
      });
      expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
      expect(
        transaction.healthcareCaseRequirement.create,
      ).not.toHaveBeenCalled();
    });

    it.each([
      [[], 'PRODUCT_NOT_FOUND'],
      [[{ id: productId, isActive: false }], 'PRODUCT_INACTIVE'],
    ])('rejects missing/foreign or inactive Product %#', async (rows, code) => {
      transaction.$queryRaw
        .mockResolvedValueOnce([
          {
            id: caseId,
            caseId,
            productId,
            status: HealthcareCaseStatus.SCHEDULED,
          },
        ])
        .mockResolvedValueOnce(rows);

      await expect(
        service.create(companyId, userId, caseId, createDto),
      ).rejects.toMatchObject({ response: { code } });
      expect(
        transaction.healthcareCaseRequirement.create,
      ).not.toHaveBeenCalled();
    });

    it.each([
      [HealthcareRequirementLifecycle.ACTIVE, 'REQUIREMENT_ALREADY_ACTIVE'],
      [HealthcareRequirementLifecycle.RETIRED, 'REQUIREMENT_RETIRED'],
    ])('rejects an existing %s Case/Product pair', async (lifecycle, code) => {
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([{ id: productId, isActive: true }]);
      transaction.healthcareCaseRequirement.findUnique.mockResolvedValue({
        id: requirementId,
        lifecycle,
      });

      await expect(
        service.create(companyId, userId, caseId, createDto),
      ).rejects.toMatchObject({ response: { code } });
      expect(evidencePolicy.assertMutable).not.toHaveBeenCalled();
      expect(
        transaction.healthcareCaseRequirement.create,
      ).not.toHaveBeenCalled();
    });

    it.each([
      [HealthcareRequirementLifecycle.ACTIVE, 'REQUIREMENT_ALREADY_ACTIVE'],
      [HealthcareRequirementLifecycle.RETIRED, 'REQUIREMENT_RETIRED'],
    ])(
      'maps an exact concurrent P2002 winner in %s state',
      async (lifecycle, code) => {
        prisma.$transaction.mockRejectedValueOnce(
          knownPrismaError('P2002', {
            target: ['companyId', 'caseId', 'productId'],
          }),
        );
        prisma.healthcareCaseRequirement.findUnique.mockResolvedValue({
          id: requirementId,
          lifecycle,
        });

        await expect(
          service.create(companyId, userId, caseId, createDto),
        ).rejects.toMatchObject({ response: { code } });
        expect(
          prisma.healthcareCaseRequirement.findUnique,
        ).toHaveBeenCalledWith({
          where: {
            companyId_caseId_productId: { companyId, caseId, productId },
          },
          select: { id: true, lifecycle: true },
        });
      },
    );

    it('does not misclassify an unrelated P2002 and hides persistence details', async () => {
      prisma.$transaction.mockRejectedValueOnce(
        knownPrismaError('P2002', { target: ['companyId', 'otherField'] }),
      );

      const error = await captureError(
        service.create(companyId, userId, caseId, createDto),
      );

      expect(error).toMatchObject({
        response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
      });
      expect(JSON.stringify(error)).not.toContain('secret database detail');
    });

    it('maps P2003 to RELATED_RESOURCE_CHANGED', async () => {
      prisma.$transaction.mockRejectedValueOnce(knownPrismaError('P2003'));

      await expect(
        service.create(companyId, userId, caseId, createDto),
      ).rejects.toMatchObject({
        response: { code: 'RELATED_RESOURCE_CHANGED' },
      });
    });
  });

  describe('update', () => {
    it('updates an ACTIVE historical Requirement without checking Product activity', async () => {
      mockIdentity(HealthcareRequirementLifecycle.ACTIVE);
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([
          makeLockedRequirement(HealthcareRequirementLifecycle.ACTIVE),
        ]);
      transaction.healthcareCaseRequirement.updateMany.mockResolvedValue({
        count: 1,
      });
      transaction.healthcareCaseRequirement.findFirst.mockResolvedValue(
        makeRecord({
          requestedQty: 4,
          product: { ...product, isActive: false },
        }),
      );

      await service.update(companyId, requirementId, {
        requestedQty: 4,
        notes: '  Ajustado  ',
      });

      expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
      expect(
        transaction.$queryRaw.mock.calls[0][0].strings.join(' '),
      ).toContain('FOR UPDATE OF healthcare_case');
      expect(
        transaction.$queryRaw.mock.calls[1][0].strings.join(' '),
      ).toContain('FROM "HealthcareCaseRequirement"');
      expect(evidencePolicy.assertMutable).toHaveBeenCalledWith(transaction, {
        companyId,
        caseId,
        requirementId,
        productId,
      });
      const updateCall =
        transaction.healthcareCaseRequirement.updateMany.mock.calls[0][0];
      expect(updateCall.where).toMatchObject({
        companyId,
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
      });
      expect(updateCall.data).toEqual({
        requestedQty: 4,
        notes: 'Ajustado',
      });
    });

    it('returns an ACTIVE Requirement unchanged for an empty update without invoking the policy', async () => {
      const current = makeRecord();
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([makeLockedRequirement()]);
      transaction.healthcareCaseRequirement.findFirst.mockResolvedValue(
        current,
      );

      await expect(
        service.update(companyId, requirementId, {}),
      ).resolves.toEqual(current);
      expect(evidencePolicy.assertMutable).not.toHaveBeenCalled();
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('rejects a RETIRED line even for an empty update before policy/write', async () => {
      mockIdentity(HealthcareRequirementLifecycle.RETIRED);
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([
          makeLockedRequirement(HealthcareRequirementLifecycle.RETIRED),
        ]);

      await expect(
        service.update(companyId, requirementId, {}),
      ).rejects.toMatchObject({ response: { code: 'REQUIREMENT_RETIRED' } });
      expect(evidencePolicy.assertMutable).not.toHaveBeenCalled();
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('returns REQUIREMENT_NOT_FOUND inside the transaction for a foreign ID', async () => {
      transaction.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        service.update(otherCompanyId, requirementId, { requestedQty: 3 }),
      ).rejects.toMatchObject({ response: { code: 'REQUIREMENT_NOT_FOUND' } });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
      expect(
        transaction.healthcareCaseRequirement.findFirst,
      ).not.toHaveBeenCalled();
    });

    it('blocks update when the owning Case is CANCELLED', async () => {
      mockIdentity();
      transaction.$queryRaw.mockResolvedValueOnce([
        {
          id: caseId,
          caseId,
          productId,
          status: HealthcareCaseStatus.CANCELLED,
        },
      ]);

      await expect(
        service.update(companyId, requirementId, { requestedQty: 3 }),
      ).rejects.toMatchObject({
        response: { code: 'CASE_REQUIREMENTS_READ_ONLY' },
      });
    });

    it.each([
      [HealthcareRequirementLifecycle.RETIRED, 'REQUIREMENT_RETIRED'],
      [HealthcareRequirementLifecycle.ACTIVE, 'RESOURCE_STATE_CHANGED'],
    ])('resolves an update lost race from %s', async (lifecycle, code) => {
      mockIdentity();
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([makeLockedRequirement()]);
      transaction.healthcareCaseRequirement.updateMany.mockResolvedValue({
        count: 0,
      });
      transaction.healthcareCaseRequirement.findFirst.mockResolvedValue(
        makeIdentity(lifecycle),
      );

      await expect(
        service.update(companyId, requirementId, { requestedQty: 3 }),
      ).rejects.toMatchObject({ response: { code } });
    });

    it('returns tenant-safe 404 when the target disappears after a lost race', async () => {
      mockIdentity();
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([makeLockedRequirement()]);
      transaction.healthcareCaseRequirement.updateMany.mockResolvedValue({
        count: 0,
      });
      transaction.healthcareCaseRequirement.findFirst.mockResolvedValue(null);

      await expect(
        service.update(companyId, requirementId, { requestedQty: 3 }),
      ).rejects.toMatchObject({ response: { code: 'REQUIREMENT_NOT_FOUND' } });
    });

    it('propagates the reserved RQ-006 fulfillment conflict before writing', async () => {
      mockIdentity();
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([makeLockedRequirement()]);
      evidencePolicy.assertMutable.mockRejectedValueOnce(
        requirementFulfillmentLockedException(),
      );

      await expect(
        service.update(companyId, requirementId, { requestedQty: 3 }),
      ).rejects.toMatchObject({
        response: { code: 'REQUIREMENT_FULFILLMENT_LOCKED' },
      });
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('retires with normalized audit and invokes policy before the write', async () => {
      mockIdentity();
      transaction.$queryRaw
        .mockResolvedValueOnce([
          {
            id: caseId,
            caseId,
            productId,
            status: HealthcareCaseStatus.SCHEDULED,
          },
        ])
        .mockResolvedValueOnce([makeLockedRequirement()]);
      transaction.healthcareCaseRequirement.updateMany.mockResolvedValue({
        count: 1,
      });
      transaction.healthcareCaseRequirement.findFirst.mockResolvedValue(
        makeRecord({ lifecycle: HealthcareRequirementLifecycle.RETIRED }),
      );

      await service.retire(companyId, userId, requirementId, {
        retirementReason: '  Cambio   clínico  ',
      });

      expect(evidencePolicy.assertMutable).toHaveBeenCalledTimes(1);
      const retireData =
        transaction.healthcareCaseRequirement.updateMany.mock.calls[0][0].data;
      expect(retireData).toMatchObject({
        lifecycle: HealthcareRequirementLifecycle.RETIRED,
        retiredById: userId,
        retirementReason: 'Cambio clínico',
      });
      expect(retireData.retiredAt).toBeInstanceOf(Date);
    });

    it('keeps retirement audit unchanged on an idempotent retire', async () => {
      const retired = makeRecord({
        lifecycle: HealthcareRequirementLifecycle.RETIRED,
        retiredAt: new Date('2026-09-14T02:00:00.000Z'),
        retiredById: userId,
        retirementReason: 'Original',
      });
      mockIdentity(HealthcareRequirementLifecycle.RETIRED);
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([
          makeLockedRequirement(HealthcareRequirementLifecycle.RETIRED),
        ]);
      transaction.healthcareCaseRequirement.findFirst.mockResolvedValue(
        retired,
      );

      await expect(
        service.retire(companyId, userId, requirementId, {
          retirementReason: 'No sobrescribir',
        }),
      ).resolves.toEqual(retired);
      expect(evidencePolicy.assertMutable).not.toHaveBeenCalled();
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('reactivates only with an active Product and preserves retirement audit', async () => {
      mockIdentity(HealthcareRequirementLifecycle.RETIRED);
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([{ id: productId, isActive: true }])
        .mockResolvedValueOnce([
          makeLockedRequirement(HealthcareRequirementLifecycle.RETIRED),
        ]);
      transaction.healthcareCaseRequirement.updateMany.mockResolvedValue({
        count: 1,
      });
      transaction.healthcareCaseRequirement.findFirst.mockResolvedValue(
        makeRecord(),
      );

      await service.reactivate(companyId, userId, requirementId);

      const data =
        transaction.healthcareCaseRequirement.updateMany.mock.calls[0][0].data;
      expect(data).toEqual({
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
        reactivatedAt: data.reactivatedAt,
        reactivatedById: userId,
      });
      expect(data.reactivatedAt).toBeInstanceOf(Date);
      expect(data).not.toHaveProperty('retiredAt');
      expect(data).not.toHaveProperty('retiredById');
      expect(data).not.toHaveProperty('retirementReason');
      expect(evidencePolicy.assertMutable).toHaveBeenCalledTimes(1);
    });

    it('rejects reactivation when Product is inactive', async () => {
      mockIdentity(HealthcareRequirementLifecycle.RETIRED);
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([{ id: productId, isActive: false }])
        .mockResolvedValueOnce([
          makeLockedRequirement(HealthcareRequirementLifecycle.RETIRED),
        ]);

      await expect(
        service.reactivate(companyId, userId, requirementId),
      ).rejects.toMatchObject({ response: { code: 'PRODUCT_INACTIVE' } });
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('returns an already ACTIVE row without overwriting reactivation audit', async () => {
      const active = makeRecord({
        reactivatedAt: new Date('2026-09-14T03:00:00.000Z'),
        reactivatedById: userId,
      });
      mockIdentity();
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([{ id: productId, isActive: false }])
        .mockResolvedValueOnce([makeLockedRequirement()]);
      transaction.healthcareCaseRequirement.findFirst.mockResolvedValue(active);

      await expect(
        service.reactivate(companyId, userId, requirementId),
      ).resolves.toEqual(active);
      expect(evidencePolicy.assertMutable).not.toHaveBeenCalled();
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });

    it.each([
      ['retire', HealthcareRequirementLifecycle.RETIRED],
      ['reactivate', HealthcareRequirementLifecycle.ACTIVE],
    ] as const)(
      'returns the reached state after a lost %s race',
      async (command, reachedLifecycle) => {
        const initialLifecycle =
          command === 'retire'
            ? HealthcareRequirementLifecycle.ACTIVE
            : HealthcareRequirementLifecycle.RETIRED;
        mockIdentity(initialLifecycle);
        transaction.$queryRaw.mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ]);
        if (command === 'reactivate') {
          transaction.$queryRaw.mockResolvedValueOnce([
            { id: productId, isActive: true },
          ]);
        }
        transaction.$queryRaw.mockResolvedValueOnce([
          makeLockedRequirement(initialLifecycle),
        ]);
        transaction.healthcareCaseRequirement.updateMany.mockResolvedValue({
          count: 0,
        });
        transaction.healthcareCaseRequirement.findFirst
          .mockResolvedValueOnce(makeIdentity(reachedLifecycle))
          .mockResolvedValueOnce(makeRecord({ lifecycle: reachedLifecycle }));

        const operation =
          command === 'retire'
            ? service.retire(companyId, userId, requirementId, {
                retirementReason: 'Cambio',
              })
            : service.reactivate(companyId, userId, requirementId);

        await expect(operation).resolves.toMatchObject({
          lifecycle: reachedLifecycle,
        });
      },
    );

    it('maps P2003 from lifecycle audit actors without leaking the relation', async () => {
      prisma.$transaction.mockRejectedValueOnce(knownPrismaError('P2003'));
      prisma.healthcareCaseRequirement.findFirst.mockResolvedValue(
        makeIdentity(),
      );

      await expect(
        service.retire(companyId, userId, requirementId, {
          retirementReason: 'Cambio',
        }),
      ).rejects.toMatchObject({
        response: { code: 'RELATED_RESOURCE_CHANGED' },
      });
    });
  });

  describe('reorder', () => {
    it('locks in deterministic order, allows duplicate positions, and reads back stably', async () => {
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([
          makeLockedRequirement(
            HealthcareRequirementLifecycle.ACTIVE,
            requirementId,
            10,
          ),
          makeLockedRequirement(
            HealthcareRequirementLifecycle.ACTIVE,
            requirementIdB,
            20,
          ),
        ]);
      transaction.healthcareCaseRequirement.updateMany.mockResolvedValue({
        count: 1,
      });
      transaction.healthcareCaseRequirement.findMany.mockResolvedValue([
        makeRecord({ sortOrder: 10 }),
        makeRecord({ id: requirementIdB, sortOrder: 10 }),
      ]);

      await service.reorder(companyId, caseId, {
        items: [
          { requirementId: requirementIdB, sortOrder: 10 },
          { requirementId, sortOrder: 10 },
        ],
      });

      const lockQuery = transaction.$queryRaw.mock.calls[1][0];
      expect(lockQuery.values).toEqual([
        companyId,
        caseId,
        requirementId,
        requirementIdB,
      ]);
      expect(evidencePolicy.assertMutable).toHaveBeenCalledTimes(1);
      expect(evidencePolicy.assertMutable.mock.calls[0][1]).toEqual({
        companyId,
        caseId,
        requirementId: requirementIdB,
        productId,
      });
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).toHaveBeenCalledTimes(1);
      expect(
        evidencePolicy.assertMutable.mock.invocationCallOrder[0],
      ).toBeLessThan(
        transaction.healthcareCaseRequirement.updateMany.mock
          .invocationCallOrder[0],
      );
      const readback =
        transaction.healthcareCaseRequirement.findMany.mock.calls[0][0];
      expect(readback.where).toEqual({
        companyId,
        caseId,
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
      });
      expect(readback.orderBy).toEqual([
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ]);
    });

    it('rejects duplicate IDs before opening a transaction', async () => {
      await expect(
        service.reorder(companyId, caseId, {
          items: [
            { requirementId, sortOrder: 1 },
            { requirementId, sortOrder: 2 },
          ],
        }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_REQUIREMENT_REORDER' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects missing/foreign members without writes', async () => {
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.reorder(companyId, caseId, {
          items: [{ requirementId, sortOrder: 20 }],
        }),
      ).rejects.toMatchObject({ response: { code: 'REQUIREMENT_NOT_FOUND' } });
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('rejects a RETIRED member before policy or writes', async () => {
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([
          makeLockedRequirement(HealthcareRequirementLifecycle.RETIRED),
        ]);

      await expect(
        service.reorder(companyId, caseId, {
          items: [{ requirementId, sortOrder: 20 }],
        }),
      ).rejects.toMatchObject({ response: { code: 'REQUIREMENT_RETIRED' } });
      expect(evidencePolicy.assertMutable).not.toHaveBeenCalled();
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('validates every affected policy before the first write for atomic failure', async () => {
      transaction.$queryRaw
        .mockResolvedValueOnce([
          { id: caseId, caseId, productId, status: HealthcareCaseStatus.DRAFT },
        ])
        .mockResolvedValueOnce([
          makeLockedRequirement(
            HealthcareRequirementLifecycle.ACTIVE,
            requirementId,
            10,
          ),
          makeLockedRequirement(
            HealthcareRequirementLifecycle.ACTIVE,
            requirementIdB,
            20,
          ),
        ]);
      evidencePolicy.assertMutable
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(requirementFulfillmentLockedException());

      await expect(
        service.reorder(companyId, caseId, {
          items: [
            { requirementId, sortOrder: 30 },
            { requirementId: requirementIdB, sortOrder: 40 },
          ],
        }),
      ).rejects.toMatchObject({
        response: { code: 'REQUIREMENT_FULFILLMENT_LOCKED' },
      });
      expect(
        transaction.healthcareCaseRequirement.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('blocks all reorder work when the Case is CANCELLED', async () => {
      transaction.$queryRaw.mockResolvedValueOnce([
        {
          id: caseId,
          caseId,
          productId,
          status: HealthcareCaseStatus.CANCELLED,
        },
      ]);

      await expect(
        service.reorder(companyId, caseId, {
          items: [{ requirementId, sortOrder: 20 }],
        }),
      ).rejects.toMatchObject({
        response: { code: 'CASE_REQUIREMENTS_READ_ONLY' },
      });
      expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  function mockIdentity(
    lifecycle = HealthcareRequirementLifecycle.ACTIVE,
  ): void {
    prisma.healthcareCaseRequirement.findFirst.mockResolvedValue(
      makeIdentity(lifecycle),
    );
  }
});

describe('NoopRequirementOperationalEvidencePolicy', () => {
  it('allows the current V1 mutation boundary without inventing evidence state', async () => {
    const policy = new NoopRequirementOperationalEvidencePolicy();

    await expect(
      policy.assertMutable({} as Prisma.TransactionClient, {
        companyId,
        caseId,
        requirementId,
        productId,
      }),
    ).resolves.toBeUndefined();
  });
});

function knownPrismaError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('secret database detail', {
    code,
    clientVersion: '6.19.3',
    meta,
  });
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected promise to reject');
}
