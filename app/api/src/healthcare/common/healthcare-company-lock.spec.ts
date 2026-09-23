import { Prisma } from '@prisma/client';

import { HealthcareCompanyLockTimeoutError } from './healthcare-company-lock-timeout.error';
import { acquireHealthcareCompanyLock } from './healthcare-company-lock';

const negativeKeyCompanyId = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const negativeCompanyLockKey = -8734125084349097208n;

describe('acquireHealthcareCompanyLock', () => {
  it('uses the parameterized single-bigint transaction lock with the V1 negative key', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([lockTimeoutSetting('0', 0)])
      .mockResolvedValueOnce([{ lockTimeout: '2500ms' }])
      .mockResolvedValueOnce([{ lock: '' }])
      .mockResolvedValueOnce([{ lockTimeout: '0' }]);

    await acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
      acquisitionTimeoutMs: 2_500,
    });

    const acquisitionQuery = queryRaw.mock.calls[2][0];
    const acquisitionSql = normalizeSql(acquisitionQuery);

    expect(acquisitionSql).toContain(
      'SELECT pg_advisory_xact_lock(?::bigint)::text AS "lock"',
    );
    expect(acquisitionQuery.values).toEqual([negativeCompanyLockKey]);
    expect(acquisitionQuery.strings.join('')).not.toContain(
      negativeCompanyLockKey.toString(),
    );
    expect(acquisitionQuery.strings.join('')).not.toContain(
      negativeKeyCompanyId,
    );
    expect(queryRaw).toHaveBeenCalledTimes(4);
  });

  it('temporarily limits an inherited unlimited lock_timeout and restores it', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([lockTimeoutSetting('0', 0)])
      .mockResolvedValueOnce([{ lockTimeout: '1750ms' }])
      .mockResolvedValueOnce([{ lock: '' }])
      .mockResolvedValueOnce([{ lockTimeout: '0' }]);

    await acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
      acquisitionTimeoutMs: 1_750,
    });

    expect(queryRaw.mock.calls[1][0].values).toEqual(['1750ms']);
    expect(queryRaw.mock.calls[3][0].values).toEqual(['0']);
    expect(normalizeSql(queryRaw.mock.calls[1][0])).toContain(
      "set_config('lock_timeout', ?, true)",
    );
  });

  it('preserves a stricter inherited lock_timeout without setting or restoring it', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([lockTimeoutSetting('400ms', 400)])
      .mockResolvedValueOnce([{ lock: '' }]);

    await acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
      acquisitionTimeoutMs: 1_000,
    });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(normalizeSql(queryRaw.mock.calls[1][0])).toContain(
      'pg_advisory_xact_lock',
    );
    expect(allSql(queryRaw)).not.toContain('set_config');
  });

  it('temporarily narrows a looser inherited lock_timeout and restores its exact value', async () => {
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([lockTimeoutSetting('5s', 5_000)])
      .mockResolvedValueOnce([{ lockTimeout: '1000ms' }])
      .mockResolvedValueOnce([{ lock: '' }])
      .mockResolvedValueOnce([{ lockTimeout: '5s' }]);

    await acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
      acquisitionTimeoutMs: 1_000,
    });

    expect(queryRaw.mock.calls[1][0].values).toEqual(['1000ms']);
    expect(queryRaw.mock.calls[3][0].values).toEqual(['5s']);
    expect(queryRaw).toHaveBeenCalledTimes(4);
  });

  it('does not execute restoration SQL after acquisition fails', async () => {
    const rawError = new Error('acquisition failed');
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([lockTimeoutSetting('0', 0)])
      .mockResolvedValueOnce([{ lockTimeout: '1000ms' }])
      .mockRejectedValueOnce(rawError);

    await expect(
      acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
        acquisitionTimeoutMs: 1_000,
      }),
    ).rejects.toBe(rawError);
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('classifies structured P2010/55P03 only from lock acquisition', async () => {
    const rawError = knownPrismaError('P2010', { code: '55P03' });
    const { queryRaw, transaction } = mockTransaction();

    queryRaw
      .mockResolvedValueOnce([lockTimeoutSetting('0', 0)])
      .mockResolvedValueOnce([{ lockTimeout: '1000ms' }])
      .mockRejectedValueOnce(rawError);

    const error = await captureError(
      acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
        acquisitionTimeoutMs: 1_000,
      }),
    );

    expect(error).toBeInstanceOf(HealthcareCompanyLockTimeoutError);
    expect((error as HealthcareCompanyLockTimeoutError).cause).toBe(rawError);
    expect(error).toHaveProperty(
      'message',
      'Healthcare Company advisory-lock acquisition timed out.',
    );
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['deadlock', knownPrismaError('P2010', { code: '40P01' })],
    ['statement timeout', knownPrismaError('P2010', { code: '57014' })],
    ['P2010 without SQLSTATE', knownPrismaError('P2010')],
    [
      'Prisma transaction timeout',
      knownPrismaError('P2028', { code: '55P03' }),
    ],
    ['plain persistence failure', new Error('persistence failure')],
  ])(
    'passes through unrelated acquisition error: %s',
    async (_label, error) => {
      const { queryRaw, transaction } = mockTransaction();

      queryRaw
        .mockResolvedValueOnce([lockTimeoutSetting('0', 0)])
        .mockResolvedValueOnce([{ lockTimeout: '1000ms' }])
        .mockRejectedValueOnce(error);

      await expect(
        acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
          acquisitionTimeoutMs: 1_000,
        }),
      ).rejects.toBe(error);
      expect(queryRaw).toHaveBeenCalledTimes(3);
    },
  );

  it.each(['read', 'apply', 'restore'] as const)(
    'does not classify P2010/55P03 outside acquisition during %s',
    async (stage) => {
      const rawError = knownPrismaError('P2010', { code: '55P03' });
      const { queryRaw, transaction } = mockTransaction();

      if (stage === 'read') {
        queryRaw.mockRejectedValueOnce(rawError);
      } else {
        queryRaw.mockResolvedValueOnce([lockTimeoutSetting('0', 0)]);

        if (stage === 'apply') {
          queryRaw.mockRejectedValueOnce(rawError);
        } else {
          queryRaw
            .mockResolvedValueOnce([{ lockTimeout: '1000ms' }])
            .mockResolvedValueOnce([{ lock: '' }])
            .mockRejectedValueOnce(rawError);
        }
      }

      await expect(
        acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
          acquisitionTimeoutMs: 1_000,
        }),
      ).rejects.toBe(rawError);
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid explicit acquisition timeout %p before SQL',
    async (acquisitionTimeoutMs) => {
      const { queryRaw, transaction } = mockTransaction();

      await expect(
        acquireHealthcareCompanyLock(transaction, negativeKeyCompanyId, {
          acquisitionTimeoutMs,
        }),
      ).rejects.toThrow(
        new RangeError(
          'Healthcare Company lock acquisitionTimeoutMs must be a positive safe integer.',
        ),
      );
      expect(queryRaw).not.toHaveBeenCalled();
    },
  );
});

function lockTimeoutSetting(
  lockTimeout: string,
  lockTimeoutMilliseconds: number,
): {
  lockTimeout: string;
  lockTimeoutMilliseconds: number;
  lockTimeoutUnit: string;
} {
  return { lockTimeout, lockTimeoutMilliseconds, lockTimeoutUnit: 'ms' };
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

function knownPrismaError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('database detail', {
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

  throw new Error('Expected promise to reject.');
}
