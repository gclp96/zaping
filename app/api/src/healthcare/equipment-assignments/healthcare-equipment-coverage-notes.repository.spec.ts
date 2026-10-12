import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HealthcareEquipmentAssignmentsRepository,
  coverageNotePublicSelect,
} from './healthcare-equipment-assignments.repository';
import { acquireHealthcareCompanyLock } from '../common/healthcare-company-lock';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';

jest.mock('../common/healthcare-company-lock', () => ({
  acquireHealthcareCompanyLock: jest.fn(),
}));
jest.mock('../common/healthcare-subsequent-transaction-timeouts', () => ({
  applyHealthcareSubsequentTransactionTimeouts: jest.fn(),
}));

describe('CoverageNote repository transaction and write boundary', () => {
  const tx = {
    $queryRaw: jest.fn(),
    healthcareEquipmentRequirementCoverageNote: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    idempotencyRecord: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  // No root delegates and no physical mutation delegates on the transaction.
  const prisma = { $transaction: jest.fn() };
  const repository = new HealthcareEquipmentAssignmentsRepository(
    prisma as unknown as PrismaService,
  );
  const client = tx as unknown as Prisma.TransactionClient;
  const policy = {
    companyLockAcquisitionTimeoutMs: 2500,
    subsequentLockTimeoutMs: 1500,
    subsequentStatementTimeoutMs: 4000,
    prismaMaxWaitMs: 3000,
    prismaTransactionTimeoutMs: 20000,
  };
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(client),
    );
    tx.$queryRaw.mockResolvedValue([{ id: 'owned' }]);
  });
  it('acquires existing Company lock and subsequent budgets inside one transaction before command', async () => {
    const command = jest.fn().mockResolvedValue('done');
    expect(
      await repository.runCoverageNoteCommand('tenant', policy, command),
    ).toBe('done');
    expect(acquireHealthcareCompanyLock).toHaveBeenCalledWith(
      client,
      'tenant',
      { acquisitionTimeoutMs: 2500 },
    );
    expect(applyHealthcareSubsequentTransactionTimeouts).toHaveBeenCalledWith(
      client,
      policy,
    );
    expect(
      jest.mocked(acquireHealthcareCompanyLock).mock.invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(applyHealthcareSubsequentTransactionTimeouts).mock
        .invocationCallOrder[0],
    );
    expect(
      jest.mocked(applyHealthcareSubsequentTransactionTimeouts).mock
        .invocationCallOrder[0],
    ).toBeLessThan(command.mock.invocationCallOrder[0]);
    expect(command).toHaveBeenCalledWith(client);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 3000,
      timeout: 20000,
    });
  });
  it('propagates errors for transaction rollback', async () => {
    const failure = new Error('rollback');
    await expect(
      repository.runCoverageNoteCommand('tenant', policy, () =>
        Promise.reject(failure),
      ),
    ).rejects.toBe(failure);
  });
  it('locks only the exact tenant Case, Requirement and Note identities in order', async () => {
    await repository.lockCoverageCase(client, 'tenant', 'case');
    await repository.lockRequirement(client, 'tenant', 'req');
    await repository.lockCoverageNote(client, 'tenant', 'req', 'note');
    const queries = tx.$queryRaw.mock.calls.map(
      ([query]: [Prisma.Sql]) => query,
    );
    expect(queries.map((q) => q.values)).toEqual([
      ['case', 'tenant'],
      ['req', 'tenant'],
      ['note', 'tenant', 'req'],
    ]);
    expect(queries.every((q) => q.sql.includes('FOR UPDATE'))).toBe(true);
    expect(queries.map((q) => q.sql).join()).not.toContain('EquipmentAsset');
  });
  it('scopes note read/duplicate checks and reuses the R public select', async () => {
    await repository.findCoverageNote(client, 'tenant', 'req', 'note');
    await repository.findActiveCoverageNote(
      client,
      'tenant',
      'req',
      'UNAVAILABLE',
    );
    expect(
      tx.healthcareEquipmentRequirementCoverageNote.findFirst,
    ).toHaveBeenNthCalledWith(1, {
      where: { id: 'note', companyId: 'tenant', requirementId: 'req' },
      select: coverageNotePublicSelect,
    });
    expect(
      tx.healthcareEquipmentRequirementCoverageNote.findFirst,
    ).toHaveBeenNthCalledWith(2, {
      where: {
        companyId: 'tenant',
        requirementId: 'req',
        kind: 'UNAVAILABLE',
        resolvedAt: null,
      },
      select: { id: true },
    });
  });
  it('creates only registration fields and resolves only the two approved audit columns', async () => {
    const data = {
      companyId: 'tenant',
      requirementId: 'req',
      kind: 'UNAVAILABLE' as const,
      comment: 'Context',
      recordedById: 'actor',
    };
    await repository.createCoverageNote(client, data);
    await repository.resolveCoverageNote(
      client,
      'tenant',
      'req',
      'note',
      'resolver',
    );
    expect(
      tx.healthcareEquipmentRequirementCoverageNote.create,
    ).toHaveBeenCalledWith({ data, select: coverageNotePublicSelect });
    expect(
      tx.healthcareEquipmentRequirementCoverageNote.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'note',
        companyId: 'tenant',
        requirementId: 'req',
        resolvedAt: null,
      },
      data: {
        resolvedAt: expect.any(Date) as unknown,
        resolvedById: 'resolver',
      },
    });
  });
});
