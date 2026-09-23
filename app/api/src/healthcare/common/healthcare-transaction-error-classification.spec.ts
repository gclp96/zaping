import { Prisma } from '@prisma/client';

import { HealthcareCompanyLockTimeoutError } from './healthcare-company-lock-timeout.error';
import {
  classifyHealthcareTransactionError,
  HEALTHCARE_TRANSACTION_ERROR_KINDS,
} from './healthcare-transaction-error-classification';

describe('classifyHealthcareTransactionError', () => {
  it('classifies only the dedicated acquisition error as a Company-lock timeout', () => {
    const rawError = knownPrismaError('P2010', '55P03');

    expect(
      classifyHealthcareTransactionError(
        new HealthcareCompanyLockTimeoutError(rawError),
      ),
    ).toBe(HEALTHCARE_TRANSACTION_ERROR_KINDS.companyLockAcquisitionTimeout);
    expect(classifyHealthcareTransactionError(rawError)).toBeNull();
  });

  it.each([
    [
      'subsequent lock timeout',
      '55P03',
      HEALTHCARE_TRANSACTION_ERROR_KINDS.subsequentLockTimeout,
    ],
    [
      'subsequent statement timeout',
      '57014',
      HEALTHCARE_TRANSACTION_ERROR_KINDS.subsequentStatementTimeout,
    ],
  ] as const)(
    'classifies structured %s only in the subsequent-operation phase',
    (_label, sqlState, expectedKind) => {
      const error = knownPrismaError('P2010', sqlState);

      expect(
        classifyHealthcareTransactionError(error, 'subsequent-operation'),
      ).toBe(expectedKind);
      expect(classifyHealthcareTransactionError(error)).toBeNull();
    },
  );

  it.each([
    [
      'timeout-looking transaction expiration',
      prismaTransactionError(
        'Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was exceeded.',
      ),
    ],
    [
      'non-timeout committed transaction',
      prismaTransactionError(
        'Transaction already closed: A query cannot be executed on a committed transaction.',
      ),
    ],
    ['missing transaction detail', knownPrismaError('P2028')],
  ])(
    'leaves P2028 unclassified without stable evidence: %s',
    (_label, error) => {
      expect(classifyHealthcareTransactionError(error)).toBeNull();
      expect(
        classifyHealthcareTransactionError(error, 'subsequent-operation'),
      ).toBeNull();
    },
  );

  it('classifies a structured PostgreSQL deadlock independently of phase', () => {
    const error = knownPrismaError('P2010', '40P01');

    expect(classifyHealthcareTransactionError(error)).toBe(
      HEALTHCARE_TRANSACTION_ERROR_KINDS.deadlock,
    );
    expect(
      classifyHealthcareTransactionError(error, 'subsequent-operation'),
    ).toBe(HEALTHCARE_TRANSACTION_ERROR_KINDS.deadlock);
  });

  it.each([
    ['plain error', new Error('persistence failed')],
    ['different Prisma error', knownPrismaError('P2002')],
    ['P2010 without SQLSTATE', knownPrismaError('P2010')],
    ['unknown SQLSTATE', knownPrismaError('P2010', 'XX000')],
    ['lookalike object', { code: 'P2010', meta: { code: '55P03' } }],
  ])(
    'leaves unrelated persistence failure unclassified: %s',
    (_label, error) => {
      expect(
        classifyHealthcareTransactionError(error, 'subsequent-operation'),
      ).toBeNull();
    },
  );
});

function knownPrismaError(
  code: string,
  sqlState?: string,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('database detail', {
    code,
    clientVersion: '6.19.3',
    meta: sqlState ? { code: sqlState } : undefined,
  });
}

function prismaTransactionError(
  transactionDetail: string,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Transaction API error', {
    code: 'P2028',
    clientVersion: '6.19.3',
    meta: { error: transactionDetail },
  });
}
