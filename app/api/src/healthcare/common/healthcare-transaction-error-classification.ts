import { Prisma } from '@prisma/client';

import { HealthcareCompanyLockTimeoutError } from './healthcare-company-lock-timeout.error';

export const HEALTHCARE_TRANSACTION_ERROR_KINDS = {
  companyLockAcquisitionTimeout: 'company-lock-acquisition-timeout',
  subsequentLockTimeout: 'subsequent-lock-timeout',
  subsequentStatementTimeout: 'subsequent-statement-timeout',
  deadlock: 'deadlock',
} as const;

export type HealthcareTransactionErrorKind =
  (typeof HEALTHCARE_TRANSACTION_ERROR_KINDS)[keyof typeof HEALTHCARE_TRANSACTION_ERROR_KINDS];

export type HealthcareTransactionErrorPhase =
  'transaction' | 'subsequent-operation';

export function classifyHealthcareTransactionError(
  error: unknown,
  phase: HealthcareTransactionErrorPhase = 'transaction',
): HealthcareTransactionErrorKind | null {
  if (error instanceof HealthcareCompanyLockTimeoutError) {
    return HEALTHCARE_TRANSACTION_ERROR_KINDS.companyLockAcquisitionTimeout;
  }

  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (error.code !== 'P2010') {
    return null;
  }

  const sqlState = error.meta?.code;

  if (sqlState === '40P01') {
    return HEALTHCARE_TRANSACTION_ERROR_KINDS.deadlock;
  }

  if (phase !== 'subsequent-operation') {
    return null;
  }

  if (sqlState === '55P03') {
    return HEALTHCARE_TRANSACTION_ERROR_KINDS.subsequentLockTimeout;
  }

  if (sqlState === '57014') {
    return HEALTHCARE_TRANSACTION_ERROR_KINDS.subsequentStatementTimeout;
  }

  return null;
}
