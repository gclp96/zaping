import { Prisma } from '@prisma/client';

import { HealthcareCompanyTransactionTimeoutPolicy } from './healthcare-company-transaction-timeout-policy';
import { applyHealthcareSubsequentTransactionTimeouts } from './healthcare-subsequent-transaction-timeouts';

const policy: HealthcareCompanyTransactionTimeoutPolicy = {
  companyLockAcquisitionTimeoutMs: 750,
  subsequentLockTimeoutMs: 1_250,
  subsequentStatementTimeoutMs: 3_000,
  prismaMaxWaitMs: 2_000,
  prismaTransactionTimeoutMs: 10_000,
};

describe('applyHealthcareSubsequentTransactionTimeouts', () => {
  it('applies transaction-local limits for inherited unlimited settings', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([timeoutSettings('0', 0, '0', 0)])
      .mockResolvedValueOnce([{ configuredValue: '1250ms' }])
      .mockResolvedValueOnce([{ configuredValue: '3000ms' }]);

    await applyHealthcareSubsequentTransactionTimeouts(transaction, policy);

    expect(normalizeSql(queryRaw.mock.calls[0][0])).toContain(
      "current_setting('lock_timeout')",
    );
    expect(normalizeSql(queryRaw.mock.calls[0][0])).toContain(
      "current_setting('statement_timeout')",
    );
    expect(normalizeSql(queryRaw.mock.calls[1][0])).toContain(
      'set_config(?, ?, true)',
    );
    expect(queryRaw.mock.calls[1][0].values).toEqual([
      'lock_timeout',
      '1250ms',
    ]);
    expect(queryRaw.mock.calls[2][0].values).toEqual([
      'statement_timeout',
      '3000ms',
    ]);
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('preserves inherited settings that are already stricter', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw.mockResolvedValueOnce([
      timeoutSettings('400ms', 400, '900ms', 900),
    ]);

    await applyHealthcareSubsequentTransactionTimeouts(transaction, policy);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(allSql(queryRaw)).not.toContain('set_config');
  });

  it('tightens inherited looser settings without restoration SQL', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([timeoutSettings('5s', 5_000, '8s', 8_000)])
      .mockResolvedValueOnce([{ configuredValue: '1250ms' }])
      .mockResolvedValueOnce([{ configuredValue: '3000ms' }]);

    await applyHealthcareSubsequentTransactionTimeouts(transaction, policy);

    expect(queryRaw).toHaveBeenCalledTimes(3);
    expect(queryRaw.mock.calls[1][0].values).toEqual([
      'lock_timeout',
      '1250ms',
    ]);
    expect(queryRaw.mock.calls[2][0].values).toEqual([
      'statement_timeout',
      '3000ms',
    ]);
    expect(allValues(queryRaw)).not.toContain('5s');
    expect(allValues(queryRaw)).not.toContain('8s');
  });

  it('tightens each inherited setting independently', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([timeoutSettings('500ms', 500, '0', 0)])
      .mockResolvedValueOnce([{ configuredValue: '3000ms' }]);

    await applyHealthcareSubsequentTransactionTimeouts(transaction, policy);

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw.mock.calls[1][0].values).toEqual([
      'statement_timeout',
      '3000ms',
    ]);
  });

  it('does not rewrite inherited settings equal to the policy', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw.mockResolvedValueOnce([
      timeoutSettings('1250ms', 1_250, '3s', 3_000),
    ]);

    await applyHealthcareSubsequentTransactionTimeouts(transaction, policy);

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed inherited settings without applying limits', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw.mockResolvedValueOnce([
      {
        ...timeoutSettings('0', 0, '0', 0),
        statementTimeoutUnit: 's',
      },
    ]);

    await expect(
      applyHealthcareSubsequentTransactionTimeouts(transaction, policy),
    ).rejects.toThrow(
      new Error(
        'Could not resolve the effective PostgreSQL transaction timeouts.',
      ),
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('propagates an inherited-settings read failure unchanged', async () => {
    const rawError = new Error('settings read failed');
    const { queryRaw, transaction } = mockTransaction();

    queryRaw.mockRejectedValueOnce(rawError);

    await expect(
      applyHealthcareSubsequentTransactionTimeouts(transaction, policy),
    ).rejects.toBe(rawError);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not continue or run cleanup SQL after the first application fails', async () => {
    const rawError = new Error('lock timeout application failed');
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([timeoutSettings('0', 0, '0', 0)])
      .mockRejectedValueOnce(rawError);

    await expect(
      applyHealthcareSubsequentTransactionTimeouts(transaction, policy),
    ).rejects.toBe(rawError);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw.mock.calls[1][0].values).toEqual([
      'lock_timeout',
      '1250ms',
    ]);
  });

  it('does not run cleanup SQL after the second application fails', async () => {
    const rawError = new Error('statement timeout application failed');
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([timeoutSettings('0', 0, '0', 0)])
      .mockResolvedValueOnce([{ configuredValue: '1250ms' }])
      .mockRejectedValueOnce(rawError);

    await expect(
      applyHealthcareSubsequentTransactionTimeouts(transaction, policy),
    ).rejects.toBe(rawError);
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('rejects an invalid policy before executing SQL', async () => {
    const { queryRaw, transaction } = mockTransaction();

    await expect(
      applyHealthcareSubsequentTransactionTimeouts(transaction, {
        ...policy,
        subsequentLockTimeoutMs: 0,
      }),
    ).rejects.toThrow(
      new RangeError(
        'subsequentLockTimeoutMs must be a positive safe integer.',
      ),
    );
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

function timeoutSettings(
  lockTimeout: string,
  lockTimeoutMilliseconds: number,
  statementTimeout: string,
  statementTimeoutMilliseconds: number,
): {
  lockTimeout: string;
  lockTimeoutMilliseconds: number;
  lockTimeoutUnit: string;
  statementTimeout: string;
  statementTimeoutMilliseconds: number;
  statementTimeoutUnit: string;
} {
  return {
    lockTimeout,
    lockTimeoutMilliseconds,
    lockTimeoutUnit: 'ms',
    statementTimeout,
    statementTimeoutMilliseconds,
    statementTimeoutUnit: 'ms',
  };
}

function mockTransaction(): {
  queryRaw: jest.Mock<Promise<unknown>, [Prisma.Sql]>;
  transaction: Prisma.TransactionClient;
} {
  const queryRaw = jest.fn<Promise<unknown>, [Prisma.Sql]>();

  return {
    queryRaw,
    transaction: { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient,
  };
}

function normalizeSql(query: Prisma.Sql): string {
  return query.strings.join('?').replace(/\s+/gu, ' ').trim();
}

function allSql(queryRaw: jest.Mock<Promise<unknown>, [Prisma.Sql]>): string {
  return queryRaw.mock.calls.map(([query]) => normalizeSql(query)).join(' ');
}

function allValues(
  queryRaw: jest.Mock<Promise<unknown>, [Prisma.Sql]>,
): unknown[] {
  return queryRaw.mock.calls.flatMap(([query]) => query.values);
}
