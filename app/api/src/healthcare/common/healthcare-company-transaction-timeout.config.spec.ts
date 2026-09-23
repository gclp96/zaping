import { ConfigModule, ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import {
  createHealthcareCompanyTransactionTimeoutPolicy,
  healthcareCompanyTransactionTimeoutConfiguration,
} from './healthcare-company-transaction-timeout.config';

describe('Healthcare Company transaction timeout configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPolicyId = process.env.HEALTHCARE_COMPANY_TIMEOUT_POLICY_ID;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalPolicyId === undefined) {
      delete process.env.HEALTHCARE_COMPANY_TIMEOUT_POLICY_ID;
    } else {
      process.env.HEALTHCARE_COMPANY_TIMEOUT_POLICY_ID = originalPolicyId;
    }
  });

  it('exposes the provisional integration policy through Nest configuration', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.HEALTHCARE_COMPANY_TIMEOUT_POLICY_ID;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [healthcareCompanyTransactionTimeoutConfiguration],
        }),
      ],
    }).compile();

    try {
      const policy = moduleRef.get<
        ConfigType<typeof healthcareCompanyTransactionTimeoutConfiguration>
      >(healthcareCompanyTransactionTimeoutConfiguration.KEY);

      expect(policy).toEqual({
        companyLockAcquisitionTimeoutMs: 2_500,
        subsequentLockTimeoutMs: 1_500,
        subsequentStatementTimeoutMs: 4_000,
        prismaMaxWaitMs: 3_000,
        prismaTransactionTimeoutMs: 20_000,
      });
      expect(Object.isFrozen(policy)).toBe(true);
    } finally {
      await moduleRef.close();
    }
  });

  it('fails Nest configuration before startup can listen when production approval is absent', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.HEALTHCARE_COMPANY_TIMEOUT_POLICY_ID;

    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            load: [healthcareCompanyTransactionTimeoutConfiguration],
          }),
        ],
      }).compile(),
    ).rejects.toThrow(
      'Healthcare Company timeout policy selection is required in production.',
    );
  });

  it('rejects an explicitly supplied missing policy', () => {
    expect(() =>
      createHealthcareCompanyTransactionTimeoutPolicy(undefined),
    ).toThrow(
      new TypeError(
        'Healthcare Company transaction timeout policy must be an object.',
      ),
    );
  });

  it('reuses policy validation for missing fields', () => {
    expect(() =>
      createHealthcareCompanyTransactionTimeoutPolicy({
        companyLockAcquisitionTimeoutMs: 2_500,
        subsequentLockTimeoutMs: 1_500,
        subsequentStatementTimeoutMs: 4_000,
        prismaMaxWaitMs: 3_000,
      }),
    ).toThrow(
      new RangeError(
        'prismaTransactionTimeoutMs must be a positive safe integer.',
      ),
    );
  });

  it('reuses policy ordering validation', () => {
    expect(() =>
      createHealthcareCompanyTransactionTimeoutPolicy({
        companyLockAcquisitionTimeoutMs: 2_500,
        subsequentLockTimeoutMs: 4_000,
        subsequentStatementTimeoutMs: 4_000,
        prismaMaxWaitMs: 3_000,
        prismaTransactionTimeoutMs: 20_000,
      }),
    ).toThrow(
      new RangeError(
        'subsequentLockTimeoutMs must be less than subsequentStatementTimeoutMs.',
      ),
    );
  });
});
