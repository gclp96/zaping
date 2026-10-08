import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import {
  HealthcareCaseKitStatus,
  HealthcareCaseStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { App } from 'supertest/types';

import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { HealthcareCaseKitsController } from '../src/healthcare/case-kits/healthcare-case-kits.controller';
import {
  HealthcareCaseKitRecord,
  HealthcareCaseKitsRepository,
} from '../src/healthcare/case-kits/healthcare-case-kits.repository';
import { HealthcareCaseKitsService } from '../src/healthcare/case-kits/healthcare-case-kits.service';
import { acquireHealthcareCompanyLock } from '../src/healthcare/common/healthcare-company-lock';
import { applyHealthcareSubsequentTransactionTimeouts } from '../src/healthcare/common/healthcare-subsequent-transaction-timeouts';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import { PrismaService } from '../src/prisma/prisma.service';

// Persistence and locking are already covered by the accepted PostgreSQL suite.
// Keep the real HTTP controller, service, JWT strategy and role guard here.
jest.mock('../src/healthcare/common/healthcare-company-lock');
jest.mock(
  '../src/healthcare/common/healthcare-subsequent-transaction-timeouts',
);

describe('HC-OPS-01B confirmation HTTP pipeline', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let kit: HealthcareCaseKitRecord;
  const companyId = randomUUID();
  const userId = randomUUID();
  const kitId = randomUUID();
  const caseId = randomUUID();
  const person = { id: userId, firstName: 'Ana', lastName: 'López' };
  const previousSecret = process.env.JWT_SECRET;
  const secret = randomUUID();
  const claims = new Map<
    string,
    { requestHash: string; resourceId: string | null }
  >();
  const transaction = {} as Prisma.TransactionClient;
  const repository = {
    findKit: jest.fn((tenant: string, id: string) =>
      Promise.resolve(tenant === companyId && id === kitId ? kit : null),
    ),
    findIdempotencyRecord: jest.fn((tenant: string, key: string) =>
      Promise.resolve(tenant === companyId ? (claims.get(key) ?? null) : null),
    ),
    runInTransaction: jest.fn(
      (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(transaction),
    ),
    lockCase: jest.fn().mockResolvedValue(true),
    lockKit: jest.fn().mockResolvedValue(true),
    lockActiveItems: jest.fn().mockResolvedValue([]),
    lockCaseRequirements: jest.fn().mockResolvedValue([]),
    lockActiveItemAssignments: jest.fn().mockResolvedValue([]),
    lockActiveItemProducts: jest.fn().mockResolvedValue([]),
    lockActiveItemEquipmentAssets: jest.fn().mockResolvedValue([]),
    confirmPreparation: jest.fn(
      (
        _tx: Prisma.TransactionClient,
        input: { preparedById: string; preparedAt: Date },
      ) => {
        kit = {
          ...kit,
          status: HealthcareCaseKitStatus.PREPARED,
          preparedBy: { ...person, id: input.preparedById },
          preparedAt: input.preparedAt,
        };
        return Promise.resolve({ count: 1 });
      },
    ),
    createIdempotencyClaim: jest.fn(
      (
        _tx: Prisma.TransactionClient,
        _tenant: string,
        key: string,
        _scope: unknown,
        requestHash: string,
      ) => {
        claims.set(key, { requestHash, resourceId: null });
        return Promise.resolve({ id: key });
      },
    ),
    completeIdempotencyClaim: jest.fn(
      (_tx: Prisma.TransactionClient, key: string, resourceId: string) => {
        claims.get(key)!.resourceId = resourceId;
        return Promise.resolve({ id: key });
      },
    ),
  };
  const users = new Map<
    string,
    typeof person & {
      companyId: string;
      email: string;
      role: UserRole;
      authVersion: number;
    }
  >();

  function token(role: UserRole, tenant = companyId) {
    const id = tenant === companyId ? userId : randomUUID();
    const user = {
      ...person,
      id,
      companyId: tenant,
      email: `${id}@example.test`,
      role,
      authVersion: 0,
    };
    users.set(id, user);
    return jwt.sign({
      sub: id,
      companyId: tenant,
      email: user.email,
      role,
      authVersion: 0,
    });
  }

  function confirm(bearer: string, key = 'confirm-key', id = kitId) {
    return supertest(app.getHttpServer())
      .post(`/healthcare/case-kits/${id}/confirm-preparation`)
      .auth(bearer, { type: 'bearer' })
      .set('Idempotency-Key', key);
  }

  beforeAll(async () => {
    // Same authenticated Healthcare harness pattern as Assignment backend E2E:
    // Passport + signed JWT + production JwtStrategy + production validation.
    process.env.JWT_SECRET = secret;
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret, signOptions: { expiresIn: '10m' } }),
      ],
      controllers: [HealthcareCaseKitsController],
      providers: [
        JwtStrategy,
        HealthcareCaseKitsService,
        { provide: HealthcareCaseKitsRepository, useValue: repository },
        {
          provide: healthcareCompanyTransactionTimeoutConfiguration.KEY,
          useValue: {
            companyLockAcquisitionTimeoutMs: 2500,
            subsequentLockTimeoutMs: 1500,
            subsequentStatementTimeoutMs: 4000,
            prismaMaxWaitMs: 3000,
            prismaTransactionTimeoutMs: 20000,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findFirst: jest.fn(
                ({ where }: { where: { id: string; companyId: string } }) => {
                  const user = users.get(where.id);
                  return Promise.resolve(
                    user?.companyId === where.companyId ? user : null,
                  );
                },
              ),
            },
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    claims.clear();
    users.clear();
    jest.mocked(acquireHealthcareCompanyLock).mockResolvedValue(undefined);
    jest
      .mocked(applyHealthcareSubsequentTransactionTimeouts)
      .mockResolvedValue(undefined);
    kit = {
      id: kitId,
      companyId,
      caseId,
      status: HealthcareCaseKitStatus.DRAFT,
      preparedBy: null,
      preparedAt: null,
      createdBy: person,
      createdAt: new Date('2026-09-28T12:00:00Z'),
      updatedAt: new Date('2026-09-28T12:00:00Z'),
      items: [],
      healthcareCase: {
        status: HealthcareCaseStatus.SCHEDULED,
        scheduledStart: new Date('2026-09-29T12:00:00Z'),
        scheduledEnd: new Date('2026-09-29T14:00:00Z'),
        requirements: [],
      },
    };
  });

  it.each([UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE])(
    'allows %s and returns a direct HTTP 200 response',
    async (role) => {
      const response = await confirm(token(role)).send({}).expect(200);
      expect(response.body).toEqual({
        id: kitId,
        caseId,
        status: 'PREPARED',
        createdBy: person,
        createdAt: kit.createdAt.toISOString(),
        updatedAt: kit.updatedAt.toISOString(),
        preparedBy: person,
        preparedAt: kit.preparedAt!.toISOString(),
        items: [],
        preparationReadiness: { status: 'PASS', blockers: [] },
      });
      expect(repository.confirmPreparation).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          companyId,
          caseKitId: kitId,
          preparedById: userId,
        }),
      );
    },
  );

  it('rejects SALES through the real role guard before service discovery', async () => {
    await confirm(token(UserRole.SALES)).send({}).expect(403);
    expect(repository.findIdempotencyRecord).not.toHaveBeenCalled();
    expect(repository.findKit).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    await supertest(app.getHttpServer())
      .post(`/healthcare/case-kits/${kitId}/confirm-preparation`)
      .set('Idempotency-Key', 'key')
      .send({})
      .expect(401);
    expect(repository.findKit).not.toHaveBeenCalled();
  });

  it('presents a foreign-tenant Kit as missing using the authenticated tenant', async () => {
    const tenant = randomUUID();
    const response = await confirm(token(UserRole.MANAGER, tenant))
      .send({})
      .expect(404);
    expect(response.body).toMatchObject({ code: 'CASE_KIT_NOT_FOUND' });
    expect(repository.findKit).toHaveBeenCalledWith(tenant, kitId);
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('validates required key, empty body and UUID through HTTP before discovery', async () => {
    const bearer = token(UserRole.MANAGER);
    const missingKey = await supertest(app.getHttpServer())
      .post(`/healthcare/case-kits/${kitId}/confirm-preparation`)
      .auth(bearer, { type: 'bearer' })
      .send({})
      .expect(400);
    expect(missingKey.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const invalidKey = await confirm(bearer, 'k'.repeat(129))
      .send({})
      .expect(400);
    expect(invalidKey.body).toMatchObject({ code: 'INVALID_IDEMPOTENCY_KEY' });
    const invalidBody = await confirm(bearer)
      .send({ companyId: randomUUID(), status: 'PREPARED' })
      .expect(400);
    expect(invalidBody.body).toMatchObject({ code: 'INVALID_REQUEST_BODY' });
    await confirm(bearer, 'key', 'not-a-uuid').send({}).expect(400);
    expect(repository.findKit).not.toHaveBeenCalled();
  });

  it('returns structured readiness blockers with HTTP 409 and no transition or claim', async () => {
    kit.healthcareCase.status = HealthcareCaseStatus.DRAFT;
    const response = await confirm(token(UserRole.MANAGER))
      .send({})
      .expect(409);
    expect(response.body).toMatchObject({
      code: 'CASE_KIT_PREPARATION_BLOCKED',
      details: { blockers: [{ code: 'CASE_KIT_CASE_NOT_SCHEDULED' }] },
    });
    expect(repository.confirmPreparation).not.toHaveBeenCalled();
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('returns HTTP 200 for key/state replay after invalidation and rejects key reuse', async () => {
    const bearer = token(UserRole.MANAGER);
    const prepared = await confirm(bearer).send({}).expect(200);
    kit.healthcareCase.status = HealthcareCaseStatus.CANCELLED;
    for (const key of ['confirm-key', 'new-key']) {
      const replay = await confirm(bearer, key).send({}).expect(200);
      expect(replay.body).toMatchObject({
        status: 'PREPARED',
        preparedBy: person,
        preparedAt: (prepared.body as { preparedAt: string }).preparedAt,
        preparationReadiness: {
          status: 'BLOCKED',
          blockers: [{ code: 'CASE_KIT_CASE_CANCELLED' }],
        },
      });
    }
    expect(repository.confirmPreparation).toHaveBeenCalledTimes(1);
    expect(repository.createIdempotencyClaim).toHaveBeenCalledTimes(1);
    const reused = await confirm(bearer, 'confirm-key', randomUUID())
      .send({})
      .expect(409);
    expect(reused.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
});
