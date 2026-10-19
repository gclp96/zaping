import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
import { PrismaService } from '../../prisma/prisma.service';
import { EquipmentModule } from '../../equipment/equipment.module';
import { EQUIPMENT_CUSTODY_CLOSE_CONTEXT_ADAPTERS } from '../../equipment/equipment-custody-close-context.registry';
import { HealthcareCaseReconciliationModule } from './healthcare-case-reconciliations.module';
import { HealthcareCaseReconciliationEquipmentEvidenceModule } from './healthcare-case-reconciliation-equipment-evidence.module';
import { HealthcareCaseReconciliationEquipmentContextAdapter } from './healthcare-case-reconciliation-equipment-context.adapter';
import { HealthcareCaseReconciliationEquipmentEvidenceRepository } from './healthcare-case-reconciliation-equipment-evidence.repository';
import { ConfirmHealthcareCaseReconciliationDto } from './dto/confirm-healthcare-case-reconciliation.dto';
import { createReconciliationConfirmRequestHash } from './healthcare-case-reconciliation-request-hash';
import * as companyLock from '../common/healthcare-company-lock';
import * as transactionTimeouts from '../common/healthcare-subsequent-transaction-timeouts';
import { HealthcareCaseReconciliationConfirmRepository } from './healthcare-case-reconciliation-confirm.repository';
import { HealthcareCaseReconciliationConfirmService } from './healthcare-case-reconciliation-confirm.service';
import { ReconciliationItemSnapshot } from './healthcare-case-reconciliation.types';
import { ReconciliationCommandResult } from './healthcare-case-reconciliation-command.types';
import { assertReconciliationPhysicalCallLimits } from './healthcare-case-reconciliation-confirm.service';

describe('HC-RR-01D Confirm contract and DI', () => {
  const row = (returnedQty: number, usedQty: number) => ({
    lifecycle: 'ACTIVE',
    type: 'MATERIAL',
    returnedQty,
    usedQty,
  });
  it.each(['RETURNED', 'USED'] as const)(
    '%s accepts exactly 1000 positive entries',
    (kind) => {
      expect(() =>
        assertReconciliationPhysicalCallLimits(
          Array.from({ length: 1000 }, () =>
            row(kind === 'RETURNED' ? 1 : 0, kind === 'USED' ? 1 : 0),
          ),
        ),
      ).not.toThrow();
    },
  );
  it.each(['RETURNED', 'USED'] as const)(
    '%s rejects 1001 positive entries',
    (kind) => {
      expect(() =>
        assertReconciliationPhysicalCallLimits(
          Array.from({ length: 1001 }, () =>
            row(kind === 'RETURNED' ? 1 : 0, kind === 'USED' ? 1 : 0),
          ),
        ),
      ).toThrow('INVALID_PHYSICAL_REQUEST');
    },
  );
  it('counts the two calls independently and ignores excluded/observational/Equipment entries', () => {
    const items = [
      ...Array.from({ length: 1000 }, () => row(1, 0)),
      ...Array.from({ length: 1000 }, () => row(0, 1)),
      ...Array.from({ length: 1001 }, () => ({
        ...row(1, 1),
        lifecycle: 'EXCLUDED',
      })),
      ...Array.from({ length: 1001 }, () => ({
        ...row(1, 1),
        type: 'EQUIPMENT',
      })),
      ...Array.from({ length: 1001 }, () => row(0, 0)),
    ];
    expect(() => assertReconciliationPhysicalCallLimits(items)).not.toThrow();
  });
  it('hash is canonical and binds only the approved durable command fields', () => {
    const c = {
        companyId: randomUUID(),
        caseId: randomUUID(),
        reconciliationId: randomUUID(),
      },
      hash = createReconciliationConfirmRequestHash(c, 3);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(createReconciliationConfirmRequestHash({ ...c }, 3)).toBe(hash);
    for (const key of ['companyId', 'caseId', 'reconciliationId'] as const)
      expect(
        createReconciliationConfirmRequestHash(
          { ...c, [key]: randomUUID() },
          3,
        ),
      ).not.toBe(hash);
    expect(createReconciliationConfirmRequestHash(c, 4)).not.toBe(hash);
  });
  it.each([-1, 0.5, 2147483647, '0', null, undefined])(
    'DTO rejects revision %s',
    async (expectedRevision) => {
      await expect(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
        }).transform(
          { expectedRevision },
          { type: 'body', metatype: ConfirmHealthcareCaseReconciliationDto },
        ),
      ).rejects.toThrow();
    },
  );
  it.each([0, 2147483646])(
    'DTO accepts revision %s',
    async (expectedRevision) => {
      await expect(
        new ValidationPipe().transform(
          { expectedRevision },
          { type: 'body', metatype: ConfirmHealthcareCaseReconciliationDto },
        ),
      ).resolves.toHaveProperty('expectedRevision', expectedRevision);
    },
  );
  it('narrow evidence module imports only Prisma and does not import business modules', () => {
    const imports: unknown = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      HealthcareCaseReconciliationEquipmentEvidenceModule,
    );
    expect(Array.isArray(imports)).toBe(true);
    expect(imports).toHaveLength(1);
    expect(imports).not.toContain(EquipmentModule);
    expect(imports).not.toContain(HealthcareCaseReconciliationModule);
  });
  it('compiles the actual module graph without a DB and freezes productive registrations', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [healthcareCompanyTransactionTimeoutConfiguration],
        }),
        HealthcareCaseReconciliationModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    expect(
      module.get(HealthcareCaseReconciliationEquipmentContextAdapter),
    ).toBeDefined();
    const adapters = module.get<
      readonly HealthcareCaseReconciliationEquipmentContextAdapter[]
    >(EQUIPMENT_CUSTODY_CLOSE_CONTEXT_ADAPTERS);
    expect(Object.isFrozen(adapters)).toBe(true);
    expect(adapters.map((a) => a.key)).toEqual(['CASE_RECONCILIATION_ITEM']);
    expect(
      module.get(HealthcareCaseReconciliationEquipmentEvidenceRepository),
    ).toBeDefined();
    await module.close();
  });
});

const constraintStatements = [
  'SET CONSTRAINTS "InventoryPhysicalEffectLine_complete" IMMEDIATE',
  'SET CONSTRAINTS "InventoryPhysicalEffect_complete" IMMEDIATE',
  'SET CONSTRAINTS "Reconciliation_local_state", "Reconciliation_item_final_state", "Reconciliation_final_state", "Reconciliation_insert_final_state", "Reconciliation_idempotency_resource", "EquipmentAsset_custody_coherence", "EquipmentAssetCustody_coherence" IMMEDIATE',
];
describe('HC-RR-01D final constraint evaluation orchestration', () => {
  afterEach(() => jest.restoreAllMocks());
  function setup(kind: 'equipment' | 'observational', failAt = -1) {
    const trace: string[] = [];
    const id = randomUUID(),
      companyId = randomUUID(),
      caseId = randomUUID(),
      dispatchId = randomUUID(),
      kitId = randomUUID();
    const actor = { id: randomUUID(), firstName: 'Test', lastName: 'Actor' };
    const at = new Date('2026-10-17T12:00:00Z');
    const item = {
      id: randomUUID(),
      lifecycle: 'ACTIVE',
      type: kind === 'equipment' ? 'EQUIPMENT' : 'MATERIAL',
      returnedQty: 0,
      usedQty: 0,
      outcome: kind === 'equipment' ? 'RETURNED' : null,
      assetId: randomUUID(),
      equipmentCustodyId: randomUUID(),
      assignmentId: randomUUID(),
      expectedPhysicalRevision: 2,
      reportedCondition: 'GOOD',
    };
    const dispatchHistory = {
      version: 1,
      case: {
        id: caseId,
        folio: 'C',
        scheduledStart: null,
        scheduledEnd: null,
      },
      custodian: {
        type: 'EXTERNAL_PERSON',
        userId: null,
        displayName: 'Receiver',
      },
      dispatchedBy: actor,
      dispatchedAt: at.toISOString(),
    };
    const root = {
      id,
      companyId,
      caseId,
      caseKitId: kitId,
      dispatchId,
      status: 'DRAFT',
      revision: 0,
      observation: 'Pending disposition',
      dispatch: {
        id: dispatchId,
        status: 'CONFIRMED',
        companyId,
        caseId,
        caseKitId: kitId,
        snapshot: dispatchHistory,
      },
      items: [item],
    };
    const history = {
      version: 1 as const,
      product: {
        id: randomUUID(),
        sku: 'P',
        name: 'Product',
        inventoryTracking:
          kind === 'equipment' ? ('ASSET' as const) : ('QUANTITY' as const),
        lotTracking: 'NONE' as const,
      },
      preparation: {
        sourceCaseKitItemId: randomUUID(),
        requirementId: null,
        assignmentId: null,
        preparedQuantity: null,
      },
      batch: null,
      equipment:
        kind === 'equipment'
          ? { id: item.assetId, assetCode: 'A', serialNumber: null }
          : null,
    };
    const before = {
      condition: 'GOOD' as const,
      lifecycle: 'ACTIVE' as const,
      location: 'CUSTODY' as const,
      revision: 2,
    };
    const snapshot: ReconciliationItemSnapshot = {
      version: 1,
      sourceDispatchItemId: randomUUID(),
      history,
      dispatchedQty: kind === 'equipment' ? null : 10,
      capturedAt: '',
      result:
        kind === 'equipment'
          ? {
              type: 'EQUIPMENT',
              custodyId: item.equipmentCustodyId,
              assignmentId: item.assignmentId,
              openPhysicalEventId: randomUUID(),
              outcome: 'RETURNED',
              reportedCondition: 'GOOD',
              before,
              after: { ...before },
              closePhysicalEventId: null,
              custodyClosedAt: null,
            }
          : {
              type: 'MATERIAL',
              returnedQty: 0,
              usedQty: 0,
              unresolvedBefore: 10,
              unresolvedAfter: 10,
              source: { positionId: randomUUID(), revision: 1, quantity: 10 },
              returnedDestinationPositionId: null,
              returnedPhysicalEffectId: null,
              usedPhysicalEffectId: null,
            },
    };
    const sql = jest.fn((statement: string): Promise<number> => {
      trace.push(statement);
      if (statement === constraintStatements[failAt])
        return Promise.reject(Error('constraint rejected'));
      return Promise.resolve(0);
    });
    const tx = {
      $executeRawUnsafe: sql,
      user: { findFirst: jest.fn().mockResolvedValue(actor) },
    };
    const write = (name: string) =>
      jest.fn(() => {
        trace.push(name);
        return Promise.resolve({ count: 1 });
      });
    const commands = {
      createClaim: jest.fn().mockResolvedValue({ id: 'claim' }),
      completeClaim: write('completeClaim'),
      runInTransaction: jest.fn(
        async (
          fn: (client: typeof tx) => Promise<ReconciliationCommandResult>,
        ) => {
          trace.push('begin');
          try {
            const r = await fn(tx);
            trace.push('callback returned');
            return r;
          } catch (e) {
            trace.push('abort');
            throw e;
          }
        },
      ),
    };
    const repo = {
      commands,
      root: jest.fn().mockResolvedValue(root),
      bindings: jest.fn().mockReturnValue('stable'),
      lockStructure: jest.fn(),
      lockPhysical: jest.fn(),
      sources: jest.fn().mockResolvedValue([]),
      timestamp: jest.fn().mockResolvedValue(at),
      audit: jest.fn(() => {
        trace.push('audit');
        return Promise.resolve({ id: 'audit' });
      }),
      itemEvidence: write('evidence'),
      itemSnapshot: write('snapshot'),
      finalize: write('finalize'),
    };
    const close = {
      returnFromCustody: jest.fn(() => {
        trace.push('close');
        return Promise.resolve({
          outcome: 'CLOSED',
          conditionAfter: 'GOOD',
          lifecycleAfter: 'ACTIVE',
          locationAfter: 'WAREHOUSE',
          revisionAfter: 3,
          physicalEventId: randomUUID(),
          closedAt: at,
        });
      }),
    };
    const authority = { resolve: jest.fn() };
    const service = new HealthcareCaseReconciliationConfirmService(
      repo as unknown as HealthcareCaseReconciliationConfirmRepository,
      {} as never,
      {} as never,
      close as never,
      authority,
      {} as never,
      {
        companyLockAcquisitionTimeoutMs: 2500,
        subsequentLockTimeoutMs: 1500,
        subsequentStatementTimeoutMs: 4000,
        prismaMaxWaitMs: 3000,
        prismaTransactionTimeoutMs: 20000,
      },
    );
    const internal = service as unknown as {
      replay: () => Promise<ReconciliationCommandResult | null>;
      validate: () => Promise<Map<string, ReconciliationItemSnapshot>>;
      material: () => Promise<void>;
      result: () => Promise<ReconciliationCommandResult>;
    };
    const receipt = { replay: false } as ReconciliationCommandResult;
    const replay = jest.spyOn(internal, 'replay').mockResolvedValue(null);
    jest
      .spyOn(internal, 'validate')
      .mockResolvedValue(new Map([[item.id, snapshot]]));
    jest.spyOn(internal, 'material').mockResolvedValue(undefined);
    const result = jest.spyOn(internal, 'result').mockImplementation(() => {
      trace.push('result read');
      return Promise.resolve(receipt);
    });
    jest
      .spyOn(companyLock, 'acquireHealthcareCompanyLock')
      .mockResolvedValue(undefined);
    jest
      .spyOn(
        transactionTimeouts,
        'applyHealthcareSubsequentTransactionTimeouts',
      )
      .mockResolvedValue(undefined);
    return {
      service,
      trace,
      sql,
      tx,
      repo,
      authority,
      close,
      result,
      replay,
      receipt,
      context: {
        companyId,
        caseId,
        actorId: actor.id,
        reconciliationId: id,
        key: randomUUID(),
      },
    };
  }
  it.each(['equipment', 'observational'] as const)(
    '%s evaluates after all writes and before callback return on the same client',
    async (kind) => {
      const f = setup(kind);
      await expect(
        f.service.execute(f.context, { expectedRevision: 0 }),
      ).resolves.toBe(f.receipt);
      expect(f.sql.mock.calls.map(([s]) => s)).toEqual(constraintStatements);
      expect(f.sql.mock.contexts.every((c) => c === f.tx)).toBe(true);
      expect(f.trace).toEqual([
        'begin',
        'audit',
        ...(kind === 'equipment' ? ['close'] : []),
        'evidence',
        'snapshot',
        'finalize',
        'completeClaim',
        ...constraintStatements,
        'result read',
        'callback returned',
      ]);
      expect(f.authority.resolve).not.toHaveBeenCalled();
      expect(f.close.returnFromCustody).toHaveBeenCalledTimes(
        kind === 'equipment' ? 1 : 0,
      );
    },
  );
  it.each([0, 1, 2])(
    'constraint statement %i failure stops evaluation and prevents successful return',
    async (failAt) => {
      const f = setup('equipment', failAt);
      await expect(
        f.service.execute(f.context, { expectedRevision: 0 }),
      ).rejects.toHaveProperty('response.code', 'HEALTHCARE_PERSISTENCE_ERROR');
      expect(f.sql.mock.calls.map(([s]) => s)).toEqual(
        constraintStatements.slice(0, failAt + 1),
      );
      expect(f.result).not.toHaveBeenCalled();
      expect(f.trace.at(-1)).toBe('abort');
      expect(f.trace.slice(f.trace.indexOf('completeClaim') + 1)).toEqual([
        ...constraintStatements.slice(0, failAt + 1),
        'abort',
      ]);
    },
  );
  it('completed historical replay bypasses the mutation callback and its constraints', async () => {
    const f = setup('equipment');
    const receipt = { ...f.receipt, replay: true };
    f.replay.mockResolvedValue(receipt);
    await expect(
      f.service.execute(f.context, { expectedRevision: 0 }),
    ).resolves.toBe(receipt);
    expect(f.repo.commands.runInTransaction).not.toHaveBeenCalled();
    expect(f.sql).not.toHaveBeenCalled();
    expect(f.close.returnFromCustody).not.toHaveBeenCalled();
  });
});
