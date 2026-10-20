import { Prisma } from '@prisma/client';
import { HealthcareCaseDispatchCorrectionRepository } from './healthcare-case-dispatch-correction.repository';

describe('internal correction historical lookup', () => {
  const context = {
    companyId: 'tenant',
    caseId: 'case',
    dispatchId: 'dispatch',
  };
  const witness = {
    id: 'witness',
    idempotencyRecordId: 'claim',
    requestHash: 'hash',
  };
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const db = {
    healthcareCaseDispatchCorrection: { findFirst },
    idempotencyRecord: { findUnique },
  } as unknown as Prisma.TransactionClient;
  const repository = new HealthcareCaseDispatchCorrectionRepository(db);
  beforeEach(() => jest.resetAllMocks());
  it('scopes witness to company, case and Dispatch without current physical joins', async () => {
    findFirst.mockResolvedValue(witness);
    expect(await repository.findWitness(context)).toBe(witness);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        ...context,
        status: 'CONFIRMED',
        snapshot: { not: Prisma.DbNull },
      },
      include: { items: { orderBy: { sourceDispatchItemId: 'asc' } } },
    });
  });
  it('returns the historical witness on identical replay', async () => {
    findUnique.mockResolvedValue({
      id: 'claim',
      resourceId: 'witness',
      requestHash: 'hash',
    });
    findFirst.mockResolvedValue(witness);
    expect(await repository.findReplay(context, 'key', 'hash')).toBe(witness);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        companyId_scope_key: {
          companyId: 'tenant',
          scope: 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
          key: 'key',
        },
      },
    });
  });
  it('returns null for an unknown key without accessing a witness', async () => {
    findUnique.mockResolvedValue(null);
    expect(await repository.findReplay(context, 'key', 'hash')).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
  it('rejects key reuse for a different hash before accessing evidence', async () => {
    findUnique.mockResolvedValue({ requestHash: 'different' });
    await expect(
      repository.findReplay(context, 'key', 'hash'),
    ).rejects.toMatchObject({ status: 409 });
    expect(findFirst).not.toHaveBeenCalled();
  });
  it('fails closed for missing, foreign or mismatched witness linkage', async () => {
    findUnique.mockResolvedValue({
      id: 'claim',
      resourceId: 'other',
      requestHash: 'hash',
    });
    findFirst.mockResolvedValue(witness);
    await expect(repository.findReplay(context, 'key', 'hash')).rejects.toThrow(
      'inconsistent',
    );
  });
});
