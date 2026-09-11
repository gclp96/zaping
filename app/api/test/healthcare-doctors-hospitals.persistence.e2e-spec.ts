import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { Prisma, UserRole } from '@prisma/client';
import { HttpException } from '@nestjs/common';

import { HealthcareDoctorHospitalAffiliationsService } from '../src/healthcare/doctor-hospital-affiliations/healthcare-doctor-hospital-affiliations.service';
import { HealthcareCaseFolioService } from '../src/healthcare/cases/healthcare-case-folio.service';
import { HealthcareCaseService } from '../src/healthcare/cases/healthcare-case.service';
import { PrismaService } from '../src/prisma/prisma.service';

type Fixture = {
  companyAId: string;
  companyBId: string;
  doctorAId: string;
  doctorBId: string;
  hospitalAId: string;
  hospitalBId: string;
  userAId: string;
  userBId: string;
};

type AffiliationPair = {
  companyId: string;
  doctorId: string;
  hospitalId: string;
};

type P2002RaceObservation = {
  transactionAttempts: number;
  passedPrechecks: number;
  insertAttempts: number;
  p2002Targets: unknown[];
};

type InteractiveTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

class AsyncBarrier {
  arrivals = 0;

  private release!: () => void;
  private readonly released: Promise<void>;

  constructor(private readonly expectedArrivals: number) {
    this.released = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  async arrive(): Promise<void> {
    this.arrivals += 1;

    if (this.arrivals > this.expectedArrivals) {
      throw new Error('The P2002 test barrier received too many arrivals.');
    }

    if (this.arrivals === this.expectedArrivals) {
      this.release();
    }

    await this.released;
  }
}

class P2002RacePrismaFacade {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pair: AffiliationPair,
    private readonly barrier: AsyncBarrier,
    private readonly observation: P2002RaceObservation,
  ) {}

  get healthcareDoctor() {
    return this.prisma.healthcareDoctor;
  }

  get healthcareHospital() {
    return this.prisma.healthcareHospital;
  }

  get healthcareDoctorHospitalAffiliation() {
    return this.prisma.healthcareDoctorHospitalAffiliation;
  }

  $transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
    options?: InteractiveTransactionOptions,
  ): Promise<T> {
    this.observation.transactionAttempts += 1;

    return this.prisma.$transaction(
      async (transaction) => callback(this.instrumentTransaction(transaction)),
      options,
    );
  }

  private instrumentTransaction(
    transaction: Prisma.TransactionClient,
  ): Prisma.TransactionClient {
    const affiliationDelegate = transaction.healthcareDoctorHospitalAffiliation;
    const instrumentedAffiliationDelegate = new Proxy(affiliationDelegate, {
      get: (target, property, receiver): unknown => {
        if (property === 'findUnique') {
          return async (
            args: Prisma.HealthcareDoctorHospitalAffiliationFindUniqueArgs,
          ) => {
            const result = await affiliationDelegate.findUnique(args);
            const pair = args.where.companyId_doctorId_hospitalId;

            if (result === null && this.matchesPair(pair)) {
              this.observation.passedPrechecks += 1;
              await this.barrier.arrive();
            }

            return result;
          };
        }

        if (property === 'create') {
          return async (
            args: Prisma.HealthcareDoctorHospitalAffiliationCreateArgs,
          ) => {
            this.observation.insertAttempts += 1;

            try {
              return await affiliationDelegate.create(args);
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
              ) {
                this.observation.p2002Targets.push(error.meta?.target);
              }

              throw error;
            }
          };
        }

        return Reflect.get(target, property, receiver) as unknown;
      },
    });

    return new Proxy(transaction, {
      get: (target, property, receiver): unknown =>
        property === 'healthcareDoctorHospitalAffiliation'
          ? instrumentedAffiliationDelegate
          : (Reflect.get(target, property, receiver) as unknown),
    });
  }

  private matchesPair(
    pair:
      | Prisma.HealthcareDoctorHospitalAffiliationCompanyIdDoctorIdHospitalIdCompoundUniqueInput
      | undefined,
  ): boolean {
    return (
      pair?.companyId === this.pair.companyId &&
      pair.doctorId === this.pair.doctorId &&
      pair.hospitalId === this.pair.hospitalId
    );
  }
}

function buildFixture(): Fixture {
  return {
    companyAId: randomUUID(),
    companyBId: randomUUID(),
    doctorAId: randomUUID(),
    doctorBId: randomUUID(),
    hospitalAId: randomUUID(),
    hospitalBId: randomUUID(),
    userAId: randomUUID(),
    userBId: randomUUID(),
  };
}

async function cleanupFixture(
  prisma: PrismaService,
  fixture: Fixture,
): Promise<void> {
  const companyIds = [fixture.companyAId, fixture.companyBId];
  const cleanupOperations: Array<() => Promise<unknown>> = [
    () =>
      prisma.healthcareCase.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareDoctorHospitalAffiliation.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareDoctor.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareHospital.deleteMany({
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
      'Healthcare persistence fixture cleanup failed.',
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
  'Doctors/Hospitals PostgreSQL persistence integrity',
  () => {
    const prisma = new PrismaService();
    const affiliationsService = new HealthcareDoctorHospitalAffiliationsService(
      prisma,
    );
    const healthcareCaseService = new HealthcareCaseService(prisma, {
      allocateNextAvailableFolio: () =>
        Promise.resolve(`HC-C4-${randomUUID()}`),
    } as HealthcareCaseFolioService);
    const fixture = buildFixture();
    let databaseConnected = false;

    beforeAll(async () => {
      await prisma.$connect();
      databaseConnected = true;

      const suffix = randomUUID();
      const {
        companyAId,
        companyBId,
        userAId,
        userBId,
        doctorAId,
        doctorBId,
        hospitalAId,
        hospitalBId,
      } = fixture;

      await prisma.company.createMany({
        data: [
          {
            id: companyAId,
            name: `HC-C1 Company A ${suffix}`,
            rfc: `HCA${suffix.replaceAll('-', '').slice(0, 10)}`,
          },
          {
            id: companyBId,
            name: `HC-C1 Company B ${suffix}`,
            rfc: `HCB${suffix.replaceAll('-', '').slice(0, 10)}`,
          },
        ],
      });

      await prisma.user.createMany({
        data: [
          {
            id: userAId,
            companyId: companyAId,
            firstName: 'C1',
            lastName: 'User A',
            email: `hc-c1-a-${suffix}@example.test`,
            passwordHash: 'not-used-by-persistence-test',
            role: UserRole.ADMIN,
          },
          {
            id: userBId,
            companyId: companyBId,
            firstName: 'C1',
            lastName: 'User B',
            email: `hc-c1-b-${suffix}@example.test`,
            passwordHash: 'not-used-by-persistence-test',
            role: UserRole.ADMIN,
          },
        ],
      });

      await prisma.healthcareDoctor.createMany({
        data: [
          {
            id: doctorAId,
            companyId: companyAId,
            firstName: 'Doctor',
            lastName: 'Company A',
            specialty: 'Cardiology',
            searchKey: 'doctor company a cardiology',
          },
          {
            id: doctorBId,
            companyId: companyBId,
            firstName: 'Doctor',
            lastName: 'Company B',
            specialty: 'Cardiology',
            searchKey: 'doctor company b cardiology',
          },
        ],
      });

      await prisma.healthcareHospital.createMany({
        data: [
          {
            id: hospitalAId,
            companyId: companyAId,
            name: 'Hospital Company A',
            city: 'Hermosillo',
            state: 'Sonora',
            searchKey: 'hospital company a hermosillo sonora',
          },
          {
            id: hospitalBId,
            companyId: companyBId,
            name: 'Hospital Company B',
            city: 'Hermosillo',
            state: 'Sonora',
            searchKey: 'hospital company b hermosillo sonora',
          },
        ],
      });

      await prisma.healthcareDoctorHospitalAffiliation.create({
        data: {
          companyId: companyAId,
          doctorId: doctorAId,
          hospitalId: hospitalAId,
        },
      });

      await prisma.healthcareCase.createMany({
        data: [
          {
            companyId: companyAId,
            folio: `HC-C1-DOCTOR-${suffix}`,
            title: 'Same-tenant Doctor relation',
            doctorId: doctorAId,
            createdById: userAId,
          },
          {
            companyId: companyAId,
            folio: `HC-C1-HOSPITAL-${suffix}`,
            title: 'Same-tenant Hospital relation',
            hospitalId: hospitalAId,
            createdById: userAId,
          },
          {
            companyId: companyAId,
            folio: `HC-C1-NULL-${suffix}`,
            title: 'Nullable Doctor and Hospital relations',
            createdById: userAId,
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

    it('persiste masters, affiliation y Cases same-tenant/null', async () => {
      await expect(
        prisma.healthcareDoctor.findUniqueOrThrow({
          where: { id: fixture.doctorAId },
        }),
      ).resolves.toMatchObject({ companyId: fixture.companyAId });

      await expect(
        prisma.healthcareHospital.findUniqueOrThrow({
          where: { id: fixture.hospitalAId },
        }),
      ).resolves.toMatchObject({ companyId: fixture.companyAId });

      await expect(
        prisma.healthcareDoctorHospitalAffiliation.findFirstOrThrow({
          where: { companyId: fixture.companyAId },
        }),
      ).resolves.toMatchObject({
        doctorId: fixture.doctorAId,
        hospitalId: fixture.hospitalAId,
      });

      await expect(
        prisma.healthcareCase.count({
          where: { companyId: fixture.companyAId },
        }),
      ).resolves.toBe(3);
    });

    it('integra Cases nullable/same-tenant y conserva referencias históricas inactivas', async () => {
      const nullableCase = await healthcareCaseService.create(
        fixture.companyAId,
        fixture.userAId,
        { title: 'C4 nullable relations' },
      );

      expect(nullableCase).toMatchObject({
        doctorId: null,
        hospitalId: null,
        doctor: null,
        hospital: null,
      });

      const doctorId = randomUUID();
      const hospitalId = randomUUID();

      await prisma.healthcareDoctor.create({
        data: {
          id: doctorId,
          companyId: fixture.companyAId,
          firstName: 'Historical',
          lastName: 'Doctor',
          specialty: 'Cardiology',
          searchKey: `historical doctor ${doctorId}`,
        },
      });
      await prisma.healthcareHospital.create({
        data: {
          id: hospitalId,
          companyId: fixture.companyAId,
          name: 'Historical Hospital',
          city: 'Hermosillo',
          state: 'Sonora',
          searchKey: `historical hospital ${hospitalId}`,
        },
      });

      const linkedCase = await healthcareCaseService.create(
        fixture.companyAId,
        fixture.userAId,
        {
          title: 'C4 linked relations without affiliation',
          doctorId,
          hospitalId,
        },
      );

      expect(linkedCase).toMatchObject({
        doctorId,
        hospitalId,
        doctor: {
          id: doctorId,
          firstName: 'Historical',
          lastName: 'Doctor',
          specialty: 'Cardiology',
          isActive: true,
        },
        hospital: {
          id: hospitalId,
          name: 'Historical Hospital',
          city: 'Hermosillo',
          state: 'Sonora',
          isActive: true,
        },
      });
      await expect(
        prisma.healthcareDoctorHospitalAffiliation.count({
          where: {
            companyId: fixture.companyAId,
            doctorId,
            hospitalId,
          },
        }),
      ).resolves.toBe(0);

      await prisma.healthcareDoctor.update({
        where: { id: doctorId },
        data: { isActive: false },
      });
      await prisma.healthcareHospital.update({
        where: { id: hospitalId },
        data: { isActive: false },
      });

      await expect(
        healthcareCaseService.findOne(fixture.companyAId, linkedCase.id),
      ).resolves.toMatchObject({
        doctorId,
        hospitalId,
        doctor: { id: doctorId, isActive: false },
        hospital: { id: hospitalId, isActive: false },
      });
    });

    it('rechaza affiliation Doctor A + Hospital B mediante FK compuesta', async () => {
      const id = randomUUID();

      await expect(
        prisma.healthcareDoctorHospitalAffiliation.create({
          data: {
            id,
            companyId: fixture.companyAId,
            doctorId: fixture.doctorAId,
            hospitalId: fixture.hospitalBId,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });

      await expect(
        prisma.healthcareDoctorHospitalAffiliation.findUnique({
          where: { id },
        }),
      ).resolves.toBeNull();
    });

    it.each([
      ['doctor', 'doctorId', () => fixture.doctorBId],
      ['hospital', 'hospitalId', () => fixture.hospitalBId],
    ] as const)(
      'rechaza Case Company A -> %s Company B mediante FK compuesta',
      async (_label, field, foreignId) => {
        const id = randomUUID();

        await expect(
          prisma.healthcareCase.create({
            data: {
              id,
              companyId: fixture.companyAId,
              folio: `HC-C1-CROSS-${id}`,
              title: 'Cross-tenant relation must fail',
              createdById: fixture.userAId,
              [field]: foreignId(),
            },
          }),
        ).rejects.toMatchObject({ code: 'P2003' });

        await expect(
          prisma.healthcareCase.findUnique({ where: { id } }),
        ).resolves.toBeNull();
      },
    );

    it('rechaza una segunda affiliation para la misma pareja', async () => {
      await expect(
        prisma.healthcareDoctorHospitalAffiliation.create({
          data: {
            companyId: fixture.companyAId,
            doctorId: fixture.doctorAId,
            hospitalId: fixture.hospitalAId,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('serializa dos links concurrentes como una row y un conflicto estable', async () => {
      const doctorId = randomUUID();
      const hospitalId = randomUUID();

      await prisma.healthcareDoctor.create({
        data: {
          id: doctorId,
          companyId: fixture.companyAId,
          firstName: 'Concurrent',
          lastName: 'Doctor',
          specialty: 'Cardiology',
          searchKey: `concurrent doctor ${doctorId}`,
        },
      });
      await prisma.healthcareHospital.create({
        data: {
          id: hospitalId,
          companyId: fixture.companyAId,
          name: 'Concurrent Hospital',
          city: 'Hermosillo',
          state: 'Sonora',
          searchKey: `concurrent hospital ${hospitalId}`,
        },
      });

      const pair = {
        companyId: fixture.companyAId,
        doctorId,
        hospitalId,
      };
      const barrier = new AsyncBarrier(2);
      const observation: P2002RaceObservation = {
        transactionAttempts: 0,
        passedPrechecks: 0,
        insertAttempts: 0,
        p2002Targets: [],
      };
      const racePrisma = new P2002RacePrismaFacade(
        prisma,
        pair,
        barrier,
        observation,
      );
      const raceService = new HealthcareDoctorHospitalAffiliationsService(
        racePrisma as unknown as PrismaService,
      );
      const results = await Promise.allSettled([
        raceService.create(fixture.companyAId, {
          doctorId,
          hospitalId,
        }),
        raceService.create(fixture.companyAId, {
          doctorId,
          hospitalId,
        }),
      ]);
      const winner = results.find((result) => result.status === 'fulfilled');
      const loser = results.find((result) => result.status === 'rejected');
      const persistedRows =
        await prisma.healthcareDoctorHospitalAffiliation.findMany({
          where: pair,
        });

      expect(results).toHaveLength(2);
      expect(observation).toMatchObject({
        transactionAttempts: 2,
        passedPrechecks: 2,
        insertAttempts: 2,
      });
      expect(barrier.arrivals).toBe(2);
      expect(observation.p2002Targets).toEqual([
        ['companyId', 'doctorId', 'hospitalId'],
      ]);
      expect(persistedRows).toHaveLength(1);

      if (
        !winner ||
        winner.status !== 'fulfilled' ||
        !loser ||
        loser.status !== 'rejected' ||
        !persistedRows[0]
      ) {
        throw new Error('Expected one create winner and one P2002 loser.');
      }

      const persistedWinner = persistedRows[0];
      const loserError: unknown = loser.reason;
      const expectedCode = persistedWinner.isActive
        ? 'AFFILIATION_ALREADY_ACTIVE'
        : 'AFFILIATION_INACTIVE';
      const expectedMessage = persistedWinner.isActive
        ? 'La afiliación ya está activa'
        : 'La afiliación existe pero está inactiva';

      expect(winner.value.id).toBe(persistedWinner.id);
      expect(loserError).toBeInstanceOf(HttpException);
      expect((loserError as HttpException).getResponse()).toEqual({
        statusCode: 409,
        error: 'Conflict',
        code: expectedCode,
        message: expectedMessage,
        details: {
          affiliationId: persistedWinner.id,
        },
      });
      expect(
        Object.keys((loserError as HttpException).getResponse()).sort(),
      ).toEqual(['statusCode', 'error', 'code', 'message', 'details'].sort());
    });

    it('deactivate/reactivate conserva la misma row y no modifica Cases', async () => {
      const affiliation =
        await prisma.healthcareDoctorHospitalAffiliation.findFirstOrThrow({
          where: {
            companyId: fixture.companyAId,
            doctorId: fixture.doctorAId,
            hospitalId: fixture.hospitalAId,
          },
        });
      const casesBefore = await prisma.healthcareCase.findMany({
        where: { companyId: fixture.companyAId },
        select: { id: true, doctorId: true, hospitalId: true },
        orderBy: { id: 'asc' },
      });

      await affiliationsService.deactivate(fixture.companyAId, affiliation.id);
      await affiliationsService.reactivate(fixture.companyAId, affiliation.id);

      await expect(
        prisma.healthcareDoctorHospitalAffiliation.findFirstOrThrow({
          where: {
            id: affiliation.id,
            companyId: fixture.companyAId,
          },
        }),
      ).resolves.toMatchObject({ id: affiliation.id, isActive: true });
      await expect(
        prisma.healthcareCase.findMany({
          where: { companyId: fixture.companyAId },
          select: { id: true, doctorId: true, hospitalId: true },
          orderBy: { id: 'asc' },
        }),
      ).resolves.toEqual(casesBefore);
    });

    it.each(['firstName', 'lastName', 'specialty', 'searchKey'] as const)(
      'rechaza HealthcareDoctor.%s blank mediante CHECK',
      async (field) => {
        const id = randomUUID();
        const data = {
          id,
          companyId: fixture.companyAId,
          firstName: 'Valid',
          lastName: 'Doctor',
          specialty: 'Cardiology',
          searchKey: 'valid doctor cardiology',
          [field]: '   ',
        };

        await expect(
          prisma.healthcareDoctor.create({ data }),
        ).rejects.toBeDefined();
        await expect(
          prisma.healthcareDoctor.findUnique({ where: { id } }),
        ).resolves.toBeNull();
      },
    );

    it.each(['name', 'city', 'state', 'searchKey'] as const)(
      'rechaza HealthcareHospital.%s blank mediante CHECK',
      async (field) => {
        const id = randomUUID();
        const data = {
          id,
          companyId: fixture.companyAId,
          name: 'Valid Hospital',
          city: 'Hermosillo',
          state: 'Sonora',
          searchKey: 'valid hospital hermosillo sonora',
          [field]: '   ',
        };

        await expect(
          prisma.healthcareHospital.create({ data }),
        ).rejects.toBeDefined();
        await expect(
          prisma.healthcareHospital.findUnique({ where: { id } }),
        ).resolves.toBeNull();
      },
    );

    it('rechaza hard delete de Doctor y Hospital referenciados', async () => {
      await expect(
        prisma.healthcareDoctor.delete({
          where: { id: fixture.doctorAId },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });

      await expect(
        prisma.healthcareHospital.delete({
          where: { id: fixture.hospitalAId },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('instala los CHECK y FKs RESTRICT con nombres estables', async () => {
      const checkNames = [
        'HealthcareDoctor_firstName_not_blank_check',
        'HealthcareDoctor_lastName_not_blank_check',
        'HealthcareDoctor_specialty_not_blank_check',
        'HealthcareDoctor_searchKey_not_blank_check',
        'HealthcareHospital_name_not_blank_check',
        'HealthcareHospital_city_not_blank_check',
        'HealthcareHospital_state_not_blank_check',
        'HealthcareHospital_searchKey_not_blank_check',
      ];
      const foreignKeyNames = [
        'HealthcareDoctor_companyId_fkey',
        'HealthcareHospital_companyId_fkey',
        'HealthcareDoctorHospitalAffiliation_companyId_fkey',
        'HealthcareDoctorHospitalAffiliation_doctorId_companyId_fkey',
        'HealthcareDoctorHospitalAffiliation_hospitalId_companyId_fkey',
        'HealthcareCase_doctorId_companyId_fkey',
        'HealthcareCase_hospitalId_companyId_fkey',
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

      expect(checks.map(({ conname }) => conname)).toEqual(
        [...checkNames].sort(),
      );
      expect(foreignKeys.map(({ conname }) => conname)).toEqual(
        [...foreignKeyNames].sort(),
      );
      expect(foreignKeys.every(({ confdeltype }) => confdeltype === 'r')).toBe(
        true,
      );
    });
  },
);
