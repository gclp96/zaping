import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import {
  HealthcareRequirementLifecycle,
  HealthcareRequirementType,
  Prisma,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';

type Fixture = {
  companyAId: string;
  companyBId: string;
  userAId: string;
  userBId: string;
  caseAId: string;
  caseBId: string;
  productAId: string;
  productBId: string;
};

const retiredAt = new Date('2026-09-14T01:00:00.000Z');
const reactivatedAt = new Date('2026-09-14T02:00:00.000Z');
const retiredAgainAt = new Date('2026-09-14T03:00:00.000Z');

function buildFixture(): Fixture {
  return {
    companyAId: randomUUID(),
    companyBId: randomUUID(),
    userAId: randomUUID(),
    userBId: randomUUID(),
    caseAId: randomUUID(),
    caseBId: randomUUID(),
    productAId: randomUUID(),
    productBId: randomUUID(),
  };
}

async function cleanupFixture(
  prisma: PrismaService,
  fixture: Fixture,
): Promise<void> {
  const companyIds = [fixture.companyAId, fixture.companyBId];
  const cleanupOperations: Array<() => Promise<unknown>> = [
    () =>
      prisma.healthcareCaseRequirement.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareCase.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.product.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.user.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.company.deleteMany({
        where: { id: { in: companyIds } },
      }),
  ];
  const cleanupErrors: unknown[] = [];

  for (const cleanup of cleanupOperations) {
    try {
      await cleanup();
    } catch (error) {
      if (!isMissingCleanupTable(error)) {
        cleanupErrors.push(error);
      }
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      'Healthcare Requirements persistence fixture cleanup failed.',
    );
  }
}

function isMissingCleanupTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

const safeDatabaseNamePattern =
  /(?:^|[_-])(?:test|testing|integration|ci|qa|ephemeral)(?:[_-]|$)/i;
const productionDatabaseNamePattern =
  /(?:^|[_-])(?:prod|production)(?:[_-]|$)/i;

function assertSafeDbIntegrityDatabase(): void {
  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (!rawDatabaseUrl) {
    throw new Error('DATABASE_URL is required when RUN_DB_INTEGRITY_TESTS=1.');
  }

  let databaseUrl: URL;

  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL URL for integrity tests.',
    );
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error(
      'DATABASE_URL must use the postgres: or postgresql: protocol for integrity tests.',
    );
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('DATABASE_URL contains an invalid encoded database name.');
  }

  if (!databaseName || databaseName.includes('/')) {
    throw new Error(
      'DATABASE_URL must identify one PostgreSQL integrity-test database.',
    );
  }

  if (
    productionDatabaseNamePattern.test(databaseName) ||
    !safeDatabaseNamePattern.test(databaseName)
  ) {
    throw new Error(
      `Database "${databaseName}" is not explicitly marked as a safe integration/test database.`,
    );
  }

  if (process.env.DB_INTEGRITY_TEST_SAFE !== '1') {
    throw new Error(
      'DB_INTEGRITY_TEST_SAFE=1 is required to run database integrity tests.',
    );
  }
}

const runDbIntegrityTests = process.env.RUN_DB_INTEGRITY_TESTS === '1';

if (runDbIntegrityTests) {
  assertSafeDbIntegrityDatabase();
}

(runDbIntegrityTests ? describe : describe.skip)(
  'Healthcare Requirements PostgreSQL persistence integrity',
  () => {
    const prisma = new PrismaService();
    const fixture = buildFixture();
    let databaseConnected = false;

    const buildRequirementData = (
      overrides: Partial<Prisma.HealthcareCaseRequirementUncheckedCreateInput> = {},
    ): Prisma.HealthcareCaseRequirementUncheckedCreateInput => ({
      id: randomUUID(),
      companyId: fixture.companyAId,
      caseId: fixture.caseAId,
      productId: fixture.productAId,
      requestedQty: 1,
      type: HealthcareRequirementType.REQUIRED,
      sortOrder: 0,
      createdById: fixture.userAId,
      ...overrides,
    });

    const expectRequirementRejected = async (
      data: Prisma.HealthcareCaseRequirementUncheckedCreateInput,
    ): Promise<void> => {
      const id = data.id ?? randomUUID();

      await expect(
        prisma.healthcareCaseRequirement.create({
          data: { ...data, id },
        }),
      ).rejects.toBeDefined();
      await expect(
        prisma.healthcareCaseRequirement.findUnique({ where: { id } }),
      ).resolves.toBeNull();
    };

    const createProduct = async (companyId: string): Promise<string> => {
      const id = randomUUID();

      await prisma.product.create({
        data: {
          id,
          companyId,
          sku: `HC-RQ-${id}`,
          name: `Healthcare Requirement Product ${id}`,
        },
      });

      return id;
    };

    const createCase = async (
      companyId: string,
      createdById: string,
    ): Promise<string> => {
      const id = randomUUID();

      await prisma.healthcareCase.create({
        data: {
          id,
          companyId,
          folio: `HC-RQ-${id}`,
          title: `Healthcare Requirement Case ${id}`,
          createdById,
        },
      });

      return id;
    };

    const createUser = async (companyId: string): Promise<string> => {
      const id = randomUUID();

      await prisma.user.create({
        data: {
          id,
          companyId,
          firstName: 'Requirement',
          lastName: 'Audit Actor',
          email: `hc-rq-${id}@example.test`,
          passwordHash: 'not-used-by-persistence-test',
          role: UserRole.ADMIN,
        },
      });

      return id;
    };

    beforeAll(async () => {
      await prisma.$connect();
      databaseConnected = true;

      const suffix = randomUUID();

      await prisma.company.createMany({
        data: [
          {
            id: fixture.companyAId,
            name: `HC-RQ Company A ${suffix}`,
            rfc: `RQA${suffix.replaceAll('-', '').slice(0, 10)}`,
          },
          {
            id: fixture.companyBId,
            name: `HC-RQ Company B ${suffix}`,
            rfc: `RQB${suffix.replaceAll('-', '').slice(0, 10)}`,
          },
        ],
      });
      await prisma.user.createMany({
        data: [
          {
            id: fixture.userAId,
            companyId: fixture.companyAId,
            firstName: 'Requirement',
            lastName: 'User A',
            email: `hc-rq-a-${suffix}@example.test`,
            passwordHash: 'not-used-by-persistence-test',
            role: UserRole.ADMIN,
          },
          {
            id: fixture.userBId,
            companyId: fixture.companyBId,
            firstName: 'Requirement',
            lastName: 'User B',
            email: `hc-rq-b-${suffix}@example.test`,
            passwordHash: 'not-used-by-persistence-test',
            role: UserRole.ADMIN,
          },
        ],
      });
      await prisma.product.createMany({
        data: [
          {
            id: fixture.productAId,
            companyId: fixture.companyAId,
            sku: `HC-RQ-A-${suffix}`,
            name: 'Healthcare Requirement Product A',
          },
          {
            id: fixture.productBId,
            companyId: fixture.companyBId,
            sku: `HC-RQ-B-${suffix}`,
            name: 'Healthcare Requirement Product B',
          },
        ],
      });
      await prisma.healthcareCase.createMany({
        data: [
          {
            id: fixture.caseAId,
            companyId: fixture.companyAId,
            folio: `HC-RQ-A-${suffix}`,
            title: 'Healthcare Requirement Case A',
            createdById: fixture.userAId,
          },
          {
            id: fixture.caseBId,
            companyId: fixture.companyBId,
            folio: `HC-RQ-B-${suffix}`,
            title: 'Healthcare Requirement Case B',
            createdById: fixture.userBId,
          },
        ],
      });
    });

    afterAll(async () => {
      try {
        if (databaseConnected) {
          await cleanupFixture(prisma, fixture);
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it('acepta requestedQty positivo y el estado ACTIVE inicial válido', async () => {
      const productId = await createProduct(fixture.companyAId);
      const requirement = await prisma.healthcareCaseRequirement.create({
        data: buildRequirementData({ productId, requestedQty: 2 }),
      });

      expect(requirement).toMatchObject({
        companyId: fixture.companyAId,
        caseId: fixture.caseAId,
        productId,
        requestedQty: 2,
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
        retiredAt: null,
        retiredById: null,
        retirementReason: null,
        reactivatedAt: null,
        reactivatedById: null,
      });
    });

    it('rechaza Case de otra Company', async () => {
      await expectRequirementRejected(
        buildRequirementData({ caseId: fixture.caseBId }),
      );
    });

    it('rechaza Product de otra Company', async () => {
      await expectRequirementRejected(
        buildRequirementData({ productId: fixture.productBId }),
      );
    });

    it('rechaza createdBy de otra Company', async () => {
      await expectRequirementRejected(
        buildRequirementData({ createdById: fixture.userBId }),
      );
    });

    it('rechaza retiredBy de otra Company', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          lifecycle: HealthcareRequirementLifecycle.RETIRED,
          retiredAt,
          retiredById: fixture.userBId,
          retirementReason: 'No longer required',
        }),
      );
    });

    it('rechaza reactivatedBy de otra Company', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          retiredAt,
          retiredById: fixture.userAId,
          retirementReason: 'Previously retired',
          reactivatedAt,
          reactivatedById: fixture.userBId,
        }),
      );
    });

    it('rechaza duplicate Company + Case + Product incluyendo historia', async () => {
      const productId = await createProduct(fixture.companyAId);

      await prisma.healthcareCaseRequirement.create({
        data: buildRequirementData({ productId }),
      });
      await expect(
        prisma.healthcareCaseRequirement.create({
          data: buildRequirementData({ productId }),
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('permite el mismo Product en Requirements de Cases distintos', async () => {
      const productId = await createProduct(fixture.companyAId);
      const secondCaseId = await createCase(
        fixture.companyAId,
        fixture.userAId,
      );

      await prisma.healthcareCaseRequirement.createMany({
        data: [
          buildRequirementData({ productId }),
          buildRequirementData({ productId, caseId: secondCaseId }),
        ],
      });

      await expect(
        prisma.healthcareCaseRequirement.count({
          where: { companyId: fixture.companyAId, productId },
        }),
      ).resolves.toBe(2);
    });

    it('mantiene relaciones semánticas equivalentes aisladas por Company', async () => {
      await prisma.healthcareCaseRequirement.createMany({
        data: [
          buildRequirementData(),
          buildRequirementData({
            companyId: fixture.companyBId,
            caseId: fixture.caseBId,
            productId: fixture.productBId,
            createdById: fixture.userBId,
          }),
        ],
      });

      const rows = await prisma.healthcareCaseRequirement.findMany({
        where: {
          companyId: { in: [fixture.companyAId, fixture.companyBId] },
          productId: { in: [fixture.productAId, fixture.productBId] },
        },
        select: { companyId: true, caseId: true, productId: true },
        orderBy: { companyId: 'asc' },
      });

      expect(rows).toHaveLength(2);
      expect(new Set(rows.map(({ companyId }) => companyId))).toEqual(
        new Set([fixture.companyAId, fixture.companyBId]),
      );
    });

    it.each([0, -1])('rechaza requestedQty=%i', async (requestedQty) => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({ productId, requestedQty }),
      );
    });

    it('no impone signo ni unicidad a sortOrder', async () => {
      const productAId = await createProduct(fixture.companyAId);
      const productBId = await createProduct(fixture.companyAId);

      await expect(
        prisma.healthcareCaseRequirement.createMany({
          data: [
            buildRequirementData({ productId: productAId, sortOrder: -1 }),
            buildRequirementData({ productId: productBId, sortOrder: -1 }),
          ],
        }),
      ).resolves.toMatchObject({ count: 2 });
    });

    it('acepta RETIRED con audit completo', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expect(
        prisma.healthcareCaseRequirement.create({
          data: buildRequirementData({
            productId,
            lifecycle: HealthcareRequirementLifecycle.RETIRED,
            retiredAt,
            retiredById: fixture.userAId,
            retirementReason: 'No longer required',
          }),
        }),
      ).resolves.toMatchObject({
        lifecycle: HealthcareRequirementLifecycle.RETIRED,
        retiredAt,
        retiredById: fixture.userAId,
      });
    });

    it('rechaza RETIRED sin retiredAt', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          lifecycle: HealthcareRequirementLifecycle.RETIRED,
          retiredById: fixture.userAId,
          retirementReason: 'No longer required',
        }),
      );
    });

    it('rechaza RETIRED sin retiredById', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          lifecycle: HealthcareRequirementLifecycle.RETIRED,
          retiredAt,
          retirementReason: 'No longer required',
        }),
      );
    });

    it('rechaza RETIRED sin retirementReason', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          lifecycle: HealthcareRequirementLifecycle.RETIRED,
          retiredAt,
          retiredById: fixture.userAId,
        }),
      );
    });

    it('rechaza retirementReason blank', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          lifecycle: HealthcareRequirementLifecycle.RETIRED,
          retiredAt,
          retiredById: fixture.userAId,
          retirementReason: '   ',
        }),
      );
    });

    it.each([
      { reactivatedAt, reactivatedById: null },
      { reactivatedAt: null, reactivatedById: fixture.userAId },
    ])('rechaza audit de reactivation parcial', async (reactivationAudit) => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          retiredAt,
          retiredById: fixture.userAId,
          retirementReason: 'Previously retired',
          ...reactivationAudit,
        }),
      );
    });

    it('rechaza reactivation sin retirement previo', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          reactivatedAt,
          reactivatedById: fixture.userAId,
        }),
      );
    });

    it('acepta ACTIVE reactivada con orden temporal válido', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expect(
        prisma.healthcareCaseRequirement.create({
          data: buildRequirementData({
            productId,
            retiredAt,
            retiredById: fixture.userAId,
            retirementReason: 'Previously retired',
            reactivatedAt,
            reactivatedById: fixture.userAId,
          }),
        }),
      ).resolves.toMatchObject({
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
        retiredAt,
        reactivatedAt,
      });
    });

    it('rechaza ACTIVE con reactivatedAt anterior a retiredAt', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          retiredAt: reactivatedAt,
          retiredById: fixture.userAId,
          retirementReason: 'Previously retired',
          reactivatedAt: retiredAt,
          reactivatedById: fixture.userAId,
        }),
      );
    });

    it('rechaza ACTIVE con retirement audit pero sin reactivation', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          retiredAt,
          retiredById: fixture.userAId,
          retirementReason: 'Still retired historically',
        }),
      );
    });

    it('acepta RETIRED posterior a una reactivation previa', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expect(
        prisma.healthcareCaseRequirement.create({
          data: buildRequirementData({
            productId,
            lifecycle: HealthcareRequirementLifecycle.RETIRED,
            retiredAt: retiredAgainAt,
            retiredById: fixture.userAId,
            retirementReason: 'Retired again',
            reactivatedAt,
            reactivatedById: fixture.userAId,
          }),
        }),
      ).resolves.toMatchObject({
        lifecycle: HealthcareRequirementLifecycle.RETIRED,
        retiredAt: retiredAgainAt,
        reactivatedAt,
      });
    });

    it('rechaza RETIRED anterior a su última reactivation', async () => {
      const productId = await createProduct(fixture.companyAId);

      await expectRequirementRejected(
        buildRequirementData({
          productId,
          lifecycle: HealthcareRequirementLifecycle.RETIRED,
          retiredAt,
          retiredById: fixture.userAId,
          retirementReason: 'Invalid second retirement',
          reactivatedAt,
          reactivatedById: fixture.userAId,
        }),
      );
    });

    it('restringe delete del Case referenciado', async () => {
      const caseId = await createCase(fixture.companyAId, fixture.userAId);
      const productId = await createProduct(fixture.companyAId);

      await prisma.healthcareCaseRequirement.create({
        data: buildRequirementData({ caseId, productId }),
      });

      await expect(
        prisma.healthcareCase.delete({ where: { id: caseId } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('restringe delete del Product referenciado', async () => {
      const productId = await createProduct(fixture.companyAId);

      await prisma.healthcareCaseRequirement.create({
        data: buildRequirementData({ productId }),
      });

      await expect(
        prisma.product.delete({ where: { id: productId } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('restringe delete del createdBy referenciado', async () => {
      const createdById = await createUser(fixture.companyAId);
      const productId = await createProduct(fixture.companyAId);

      await prisma.healthcareCaseRequirement.create({
        data: buildRequirementData({ productId, createdById }),
      });

      await expect(
        prisma.user.delete({ where: { id: createdById } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('restringe delete del retiredBy referenciado', async () => {
      const retiredById = await createUser(fixture.companyAId);
      const productId = await createProduct(fixture.companyAId);

      await prisma.healthcareCaseRequirement.create({
        data: buildRequirementData({
          productId,
          lifecycle: HealthcareRequirementLifecycle.RETIRED,
          retiredAt,
          retiredById,
          retirementReason: 'No longer required',
        }),
      });

      await expect(
        prisma.user.delete({ where: { id: retiredById } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('restringe delete del reactivatedBy referenciado', async () => {
      const reactivatedById = await createUser(fixture.companyAId);
      const productId = await createProduct(fixture.companyAId);

      await prisma.healthcareCaseRequirement.create({
        data: buildRequirementData({
          productId,
          retiredAt,
          retiredById: fixture.userAId,
          retirementReason: 'Previously retired',
          reactivatedAt,
          reactivatedById,
        }),
      });

      await expect(
        prisma.user.delete({ where: { id: reactivatedById } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('instala CHECK, unique/index y FKs RESTRICT con nombres estables', async () => {
      const checkNames = [
        'HealthcareCaseRequirement_lifecycle_audit_check',
        'HealthcareCaseRequirement_reactivation_audit_check',
        'HealthcareRequirement_reactivation_requires_retirement_check',
        'HealthcareCaseRequirement_requestedQty_positive_check',
        'HealthcareCaseRequirement_retirement_audit_check',
      ];
      const foreignKeyNames = [
        'HealthcareCaseRequirement_caseId_companyId_fkey',
        'HealthcareCaseRequirement_companyId_fkey',
        'HealthcareCaseRequirement_createdById_companyId_fkey',
        'HealthcareCaseRequirement_productId_companyId_fkey',
        'HealthcareCaseRequirement_reactivatedById_companyId_fkey',
        'HealthcareCaseRequirement_retiredById_companyId_fkey',
      ];
      const indexNames = [
        'HealthcareCaseRequirement_companyId_caseId_lifecycle_sortOr_idx',
        'HealthcareCaseRequirement_companyId_caseId_productId_key',
        'HealthcareCaseRequirement_companyId_productId_idx',
        'HealthcareCaseRequirement_id_companyId_key',
        'User_id_companyId_key',
      ];
      const checks = await prisma.$queryRaw<Array<{ conname: string }>>`
        SELECT conname
        FROM pg_constraint
        WHERE conname = ANY(${checkNames})
        ORDER BY conname
      `;
      const foreignKeys = await prisma.$queryRaw<
        Array<{ conname: string; confdeltype: string }>
      >`
        SELECT conname, confdeltype::text
        FROM pg_constraint
        WHERE conname = ANY(${foreignKeyNames})
        ORDER BY conname
      `;
      const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE indexname = ANY(${indexNames})
        ORDER BY indexname
      `;

      expect(checks.map(({ conname }) => conname)).toEqual(
        [...checkNames].sort(),
      );
      expect(foreignKeys.map(({ conname }) => conname)).toEqual(
        [...foreignKeyNames].sort(),
      );
      expect(foreignKeys.every(({ confdeltype }) => confdeltype === 'r')).toBe(
        true,
      );
      expect(indexes.map(({ indexname }) => indexname)).toEqual(
        [...indexNames].sort(),
      );
    });
  },
);
