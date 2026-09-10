import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { UserRole } from '@prisma/client';

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
    let fixture: Fixture;

    beforeAll(async () => {
      await prisma.$connect();

      const suffix = randomUUID();
      const companyAId = randomUUID();
      const companyBId = randomUUID();
      const userAId = randomUUID();
      const userBId = randomUUID();
      const doctorAId = randomUUID();
      const doctorBId = randomUUID();
      const hospitalAId = randomUUID();
      const hospitalBId = randomUUID();

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

      fixture = {
        companyAId,
        companyBId,
        doctorAId,
        doctorBId,
        hospitalAId,
        hospitalBId,
        userAId,
        userBId,
      };
    });

    afterAll(async () => {
      if (fixture) {
        const companyIds = [fixture.companyAId, fixture.companyBId];

        await prisma.healthcareCase.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.healthcareDoctorHospitalAffiliation.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.healthcareDoctor.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.healthcareHospital.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.user.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.company.deleteMany({
          where: { id: { in: companyIds } },
        });
      }

      await prisma.$disconnect();
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
