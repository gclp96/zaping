import { randomUUID } from 'node:crypto';
import { HealthcareCaseDispatchCorrection, Prisma } from '@prisma/client';
import { HealthcareCaseDispatchCorrectionEquipmentOrchestrator } from './healthcare-case-dispatch-correction-equipment.orchestrator';
import { EquipmentCustodyCloseService } from '../../equipment/equipment-custody-close.service';
import type { MaterialCorrectionSource } from './healthcare-case-dispatch-correction-command.repository';

describe('01D Equipment writer composition', () => {
  afterEach(() => jest.restoreAllMocks());
  function fixture() {
    const c = {
      companyId: randomUUID(),
      caseId: randomUUID(),
      dispatchId: randomUUID(),
      requesterId: randomUUID(),
      idempotencyKey: 'key',
    };
    const at = new Date('2026-10-02Z');
    const root = {
      id: randomUUID(),
      confirmedAt: at,
      confirmedById: c.requesterId,
    } as HealthcareCaseDispatchCorrection;
    const items = ['b', 'a'].map((assetId) => ({
      id: randomUUID(),
      type: 'EQUIPMENT',
      assetId,
      assignmentId: randomUUID(),
      equipmentCustodyId: randomUUID(),
      equipmentPhysicalEventId: randomUUID(),
      lifecycle: 'ACTIVE',
    }));
    const source = { items } as unknown as MaterialCorrectionSource;
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      equipmentAssetPhysicalEvent: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ revisionAfter: 1, conditionAfter: 'DAMAGED' }),
      },
      healthcareCaseDispatchCorrectionItem: {
        create: jest
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) =>
            Promise.resolve({ id: randomUUID(), ...args.data }),
          ),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const close = jest
      .spyOn(EquipmentCustodyCloseService.prototype, 'returnFromCustody')
      .mockImplementation((_tx, command) =>
        Promise.resolve({
          outcome: 'CLOSED',
          custodyId: command.custodyId,
          physicalEventId: randomUUID(),
          assetId: command.assetId,
          revisionBefore: 1,
          revisionAfter: 2,
          conditionBefore: 'DAMAGED',
          conditionAfter: 'DAMAGED',
          lifecycleBefore: 'ACTIVE',
          lifecycleAfter: 'ACTIVE',
          locationBefore: 'CUSTODY',
          locationAfter: 'WAREHOUSE',
          activeCustodyIdBefore: command.custodyId,
          activeCustodyIdAfter: null,
          closedAt: at,
          closedById: c.requesterId,
        }),
      );
    const orchestrator =
      new HealthcareCaseDispatchCorrectionEquipmentOrchestrator();
    const run = () =>
      orchestrator.compensate(
        tx as unknown as Prisma.TransactionClient,
        c,
        root,
        source,
      );
    return { c, root, source, tx, close, run, orchestrator };
  }
  it('prelocks all Assets before all Custodies, closes in Asset order and snapshots each exact witness', async () => {
    const f = fixture();
    await f.run();
    const locks = f.tx.$queryRaw.mock.calls as unknown as [Prisma.Sql][];
    expect(locks[0][0].sql).toContain('"EquipmentAsset"');
    expect(locks[1][0].sql).toContain('"EquipmentAssetCustody"');
    expect(f.tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      f.close.mock.invocationCallOrder[0],
    );
    expect(f.close.mock.calls.map((call) => call[1].assetId)).toEqual([
      'a',
      'b',
    ]);
    for (const [tx, command] of f.close.mock.calls) {
      expect(tx).toBe(f.tx);
      expect(command).toMatchObject({
        companyId: f.c.companyId,
        caseId: f.c.caseId,
        actorId: f.c.requesterId,
        expectedPhysicalRevision: 1,
        reportedCondition: 'DAMAGED',
        durableOrigin: {
          type: 'CASE_DISPATCH_CORRECTION_ITEM',
          operation: 'COMPENSATE_NO_HANDOFF_EQUIPMENT',
        },
      });
      expect(command.validatedContext.contextId).toBe(command.durableOrigin.id);
      expect(Object.keys(command)).not.toContain('requestHash');
      expect(Object.keys(command)).not.toContain('closedAt');
    }
    expect(
      f.tx.healthcareCaseDispatchCorrectionItem.update,
    ).toHaveBeenCalledTimes(2);
    expect(f.tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(
      f.tx.healthcareCaseDispatchCorrectionItem.create.mock
        .invocationCallOrder[0],
    ).toBeLessThan(f.close.mock.invocationCallOrder[0]);
  });
  it('propagates a close failure without snapshotting it or pretending replay', async () => {
    const f = fixture();
    f.close.mockRejectedValueOnce(new Error('close rejected'));
    await expect(f.run()).rejects.toThrow('close rejected');
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(
      f.tx.healthcareCaseDispatchCorrectionItem.update,
    ).not.toHaveBeenCalled();
    expect(f.tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('rejects duplicate Asset sources before physical locks', async () => {
    const f = fixture();
    f.source.items[1].assetId = f.source.items[0].assetId;
    await expect(
      f.orchestrator.lockAssignments(
        f.tx as unknown as Prisma.TransactionClient,
        f.c,
        f.source,
      ),
    ).rejects.toHaveProperty('code', 'CORRECTION_EVIDENCE_INCONSISTENT');
    expect(f.tx.$queryRaw).not.toHaveBeenCalled();
    expect(f.close).not.toHaveBeenCalled();
  });
});
