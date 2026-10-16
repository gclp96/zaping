import { Prisma } from '@prisma/client';
import { HealthcareCaseReconciliationCommandService as Service } from './healthcare-case-reconciliation-command.service';
import { HealthcareCaseReconciliationCommandRepository as Repository } from './healthcare-case-reconciliation-command.repository';
import {
  ReconciliationCommandContext as Context,
  ReconciliationCommandIntent as Intent,
} from './healthcare-case-reconciliation-command.types';
import { ReconciliationDetailRow } from './healthcare-case-reconciliations.repository';
import { createReconciliationRequestHash } from './healthcare-case-reconciliation-request-hash';
const now = new Date('2026-10-16T12:00:00Z'),
  actor = { id: 'original', firstName: 'Original', lastName: 'Actor' };
const c: Context = {
  companyId: 'company',
  actorId: 'original',
  caseId: 'case',
  reconciliationId: 'rr',
  itemId: 'item',
  key: 'key',
};
const create: Intent = {
  operation: 'CREATE',
  dto: { dispatchId: 'dispatch', observation: ' note ' },
};
const policy = {
  companyLockAcquisitionTimeoutMs: 100,
  subsequentLockTimeoutMs: 100,
  subsequentStatementTimeoutMs: 1000,
  prismaMaxWaitMs: 1000,
  prismaTransactionTimeoutMs: 2000,
};
const row = () =>
  ({
    id: 'rr',
    caseId: 'case',
    dispatchId: 'dispatch',
    caseKitId: 'kit',
    status: 'DRAFT',
    revision: 4,
    createdAt: now,
    updatedAt: now,
    confirmedFromRevision: null,
    confirmedAt: null,
    confirmedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    observation: 'note',
    snapshotVersion: null,
    snapshot: null,
    createdBy: actor,
    items: [],
    audit: [],
    dispatch: {
      id: 'dispatch',
      caseId: 'case',
      caseKitId: 'kit',
      status: 'CONFIRMED',
      snapshot: {
        version: 1,
        case: {
          id: 'case',
          folio: 'HC',
          scheduledStart: null,
          scheduledEnd: null,
        },
        custodian: {
          type: 'EXTERNAL_PERSON',
          userId: null,
          displayName: 'Receiver',
        },
        dispatchedBy: actor,
        dispatchedAt: now.toISOString(),
      },
    },
  }) as unknown as ReconciliationDetailRow;
const audit = (operation = 'CREATE') => ({
  id: 'audit',
  companyId: 'company',
  reconciliationId: 'rr',
  reconciliationItemId: operation === 'OUTCOME_SET' ? 'item' : null,
  operation,
  actorId: 'original',
  createdAt: now,
  revisionBefore: operation === 'CREATE' ? null : 1,
  revisionAfter: operation === 'CREATE' ? 0 : 2,
  change:
    operation === 'OUTCOME_SET'
      ? {
          version: 1,
          operation,
          type: 'MATERIAL',
          before: { returnedQty: 0, usedQty: 0 },
          after: { returnedQty: 1, usedQty: 0 },
        }
      : { version: 1, operation },
});
describe('Reconciliation DRAFT command orchestration and replay', () => {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    runInTransaction: jest.fn(),
    runInReadSnapshot: jest.fn(),
    findClaim: jest.fn(),
    createClaim: jest.fn(),
    completeClaim: jest.fn(),
    lockSourcePrefix: jest.fn(),
    findCase: jest.fn(),
    sourceDispatch: jest.fn(),
    createDraft: jest.fn(),
    appendAudit: jest.fn(),
    detail: jest.fn(),
    findWitness: jest.fn(),
    replayItem: jest.fn(),
    lockDraftById: jest.fn(),
    cancelDraft: jest.fn(),
    admissionSources: jest.fn(),
  };
  const service = new Service(repo as unknown as Repository, policy);
  beforeEach(() => {
    jest.resetAllMocks();
    repo.runInTransaction.mockImplementation(
      (fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx),
    );
    repo.runInReadSnapshot.mockImplementation(
      (fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx),
    );
    repo.findClaim.mockResolvedValue(null);
    repo.createClaim.mockResolvedValue({ id: 'claim' });
    repo.findCase.mockResolvedValue({ id: 'case' });
    repo.sourceDispatch.mockResolvedValue({
      id: 'dispatch',
      caseKitId: 'kit',
      status: 'CONFIRMED',
    });
    repo.createDraft.mockResolvedValue({ id: 'rr' });
    repo.appendAudit.mockResolvedValue(audit());
    repo.detail.mockResolvedValue(row());
    repo.findWitness.mockResolvedValue(audit());
  });
  it('CREATE claims, locks, writes once, completes before same-tx readback', async () => {
    const r = await service.execute({ ...c, key: ' key ' }, create);
    expect(r.replay).toBe(false);
    expect(r.data.items).toEqual([]);
    expect(repo.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'key', actorId: 'original' }),
      'dispatch',
      'kit',
      'note',
      tx,
    );
    expect(repo.appendAudit).toHaveBeenCalledTimes(1);
    expect(repo.completeClaim).toHaveBeenCalledWith('claim', 'rr', tx);
    expect(repo.completeClaim.mock.invocationCallOrder[0]).toBeLessThan(
      repo.detail.mock.invocationCallOrder[0],
    );
    expect(repo.admissionSources).not.toHaveBeenCalled();
  });
  it.each([undefined, '', ' ', 'x'.repeat(129)])(
    'rejects invalid key before persistence',
    async (key) => {
      await expect(
        service.execute({ ...c, key: key as string }, create),
      ).rejects.toThrow();
      expect(repo.findClaim).not.toHaveBeenCalled();
      expect(repo.createClaim).not.toHaveBeenCalled();
    },
  );
  it('completed replay skips source gates and preserves original actor', async () => {
    repo.findClaim.mockResolvedValue({
      resourceId: 'rr',
      requestHash: createReconciliationRequestHash(c, create),
    });
    const r = await service.execute({ ...c, actorId: 'later' }, create);
    expect(r.replay).toBe(true);
    expect(r.command.actorId).toBe('original');
    expect(r.data.revision).toBe(4);
    expect(repo.runInTransaction).not.toHaveBeenCalled();
    expect(repo.lockSourcePrefix).not.toHaveBeenCalled();
  });
  it('OUTCOME replay compares historical after, not current item values', async () => {
    const i: Intent = {
      operation: 'OUTCOME_SET',
      dto: {
        expectedRevision: 1,
        type: 'MATERIAL',
        returnedQty: 1,
        usedQty: 0,
      },
    };
    repo.findClaim.mockResolvedValue({
      resourceId: 'item',
      requestHash: createReconciliationRequestHash(c, i),
    });
    repo.replayItem.mockResolvedValue({
      id: 'item',
      reconciliationId: 'rr',
      sourceDispatchItemId: 'source',
      type: 'MATERIAL',
    });
    repo.findWitness.mockResolvedValue(audit('OUTCOME_SET'));
    const r = await service.execute(c, i);
    expect(r.replay).toBe(true);
    expect(r.command.revisionAfter).toBe(2);
    expect(r.data.revision).toBe(4);
    expect(repo.admissionSources).not.toHaveBeenCalled();
  });
  it('hash mismatch precedes resource/source checks', async () => {
    repo.findClaim.mockResolvedValue({
      resourceId: null,
      requestHash: 'wrong',
    });
    await expect(service.execute(c, create)).rejects.toHaveProperty(
      'response.code',
      'IDEMPOTENCY_KEY_REUSED',
    );
    expect(repo.detail).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ...audit(), operation: 'CANCEL' },
    { ...audit(), revisionBefore: 1 },
    { ...audit(), reconciliationItemId: 'foreign' },
    { ...audit(), change: { version: 2, operation: 'CREATE' } },
  ])('missing/incoherent witness fails closed', async (witness) => {
    repo.findClaim.mockResolvedValue({
      resourceId: 'rr',
      requestHash: createReconciliationRequestHash(c, create),
    });
    repo.findWitness.mockResolvedValue(witness);
    await expect(service.execute(c, create)).rejects.toHaveProperty(
      'response.code',
      'HEALTHCARE_PERSISTENCE_ERROR',
    );
  });
  it('concurrent unique-claim loser resolves fresh replay', async () => {
    repo.findClaim.mockResolvedValueOnce(null).mockResolvedValueOnce({
      resourceId: 'rr',
      requestHash: createReconciliationRequestHash(c, create),
    });
    repo.createClaim.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '6',
        meta: { target: ['companyId', 'scope', 'key'] },
      }),
    );
    expect((await service.execute(c, create)).replay).toBe(true);
    expect(repo.findClaim).toHaveBeenCalledTimes(2);
    expect(repo.createDraft).not.toHaveBeenCalled();
  });
  it('does not mistake an unrelated unique violation for a claim replay', async () => {
    repo.createClaim.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '6',
        meta: { target: ['other'] },
      }),
    );
    await expect(service.execute(c, create)).rejects.toHaveProperty(
      'response.code',
      'HEALTHCARE_PERSISTENCE_ERROR',
    );
    expect(repo.findClaim).toHaveBeenCalledTimes(1);
  });
  it('CANCEL has no source admission and CAS failure writes no audit', async () => {
    repo.lockDraftById.mockResolvedValue({ revision: 1, status: 'DRAFT' });
    repo.cancelDraft.mockResolvedValue({ count: 0 });
    await expect(
      service.execute(c, {
        operation: 'CANCEL',
        dto: { expectedRevision: 1, reason: 'r' },
      }),
    ).rejects.toHaveProperty('response.code', 'RESOURCE_STATE_CHANGED');
    expect(repo.admissionSources).not.toHaveBeenCalled();
    expect(repo.lockSourcePrefix).not.toHaveBeenCalled();
    expect(repo.appendAudit).not.toHaveBeenCalled();
  });
  it('stale precedence survives terminal state', async () => {
    repo.lockDraftById.mockResolvedValue({ revision: 2, status: 'CANCELLED' });
    await expect(
      service.execute(c, {
        operation: 'CANCEL',
        dto: { expectedRevision: 1, reason: 'r' },
      }),
    ).rejects.toHaveProperty('response.code', 'RESOURCE_STATE_CHANGED');
  });
  it('sanitizes internal failure', async () => {
    repo.createClaim.mockRejectedValue(Error('SQL password secret'));
    await expect(service.execute(c, create)).rejects.toHaveProperty(
      'response.code',
      'HEALTHCARE_PERSISTENCE_ERROR',
    );
  });
});
