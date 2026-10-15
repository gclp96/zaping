import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ConfirmHealthcareCaseDispatchDto } from './dto/confirm-healthcare-case-dispatch.dto';
import {
  assertDispatchTransferCount,
  HealthcareCaseDispatchConfirmService,
} from './healthcare-case-dispatch-confirm.service';
import { createDispatchConfirmRequestHash } from './healthcare-case-dispatch-request-hash';
import { ConfirmContext } from './healthcare-case-dispatch-confirm.repository';
import { HealthcareCaseDispatchModule } from './healthcare-case-dispatches.module';
import { EquipmentCustodyContextRegistry } from '../../equipment/equipment-custody-context.registry';
import { PrismaService } from '../../prisma/prisma.service';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
import { parseDispatchItemSnapshot } from './healthcare-case-dispatch.snapshot';

const context: ConfirmContext = {
  companyId: 'company',
  caseId: 'case',
  dispatchId: 'dispatch',
  actorId: 'actor',
  key: 'key',
};
describe('Dispatch Confirm boundary', () => {
  const materialSnapshot = {
    version: 1,
    product: {
      id: 'product',
      sku: 'sku',
      name: 'Captured name',
      inventoryTracking: 'QUANTITY',
      lotTracking: 'NONE',
    },
    preparation: {
      sourceCaseKitItemId: 'source',
      requirementId: 'requirement',
      assignmentId: null,
      preparedQuantity: 3,
    },
    batch: null,
    equipment: null,
    capturedAt: '2026-10-15T12:00:00.123Z',
    handoff: {
      quantity: 3,
      sourcePositionId: 'source-position',
      sourceRevision: 0,
      destinationPositionId: 'destination',
      physicalEffectId: 'effect',
      assignmentId: null,
      assetId: null,
      physicalRevisionBefore: null,
      physicalRevisionAfter: null,
      equipmentCustodyId: null,
      equipmentPhysicalEventId: null,
      conditionBefore: null,
      lifecycleBefore: null,
      locationBefore: null,
    },
  };
  it('round-trips the captured material provenance without live lookups', () => {
    expect(parseDispatchItemSnapshot(materialSnapshot)).toEqual(
      materialSnapshot,
    );
  });
  it('keeps explicit null handoff for an excluded item', () => {
    expect(
      parseDispatchItemSnapshot({ ...materialSnapshot, handoff: null }).handoff,
    ).toBeNull();
  });
  it.each([
    { quantity: 0 },
    { sourcePositionId: null },
    { sourceRevision: -1 },
    { destinationPositionId: null },
    { physicalEffectId: null },
    { assetId: 'forged' },
    { equipmentCustodyId: 'forged' },
    { physicalRevisionBefore: 0 },
  ])('rejects malformed/mixed physical snapshot %j', (change) => {
    expect(() =>
      parseDispatchItemSnapshot({
        ...materialSnapshot,
        handoff: { ...materialSnapshot.handoff, ...change },
      }),
    ).toThrow();
  });
  it.each([undefined, 'invalid', null])(
    'requires a captured timestamp when handoff exists: %s',
    (capturedAt) => {
      expect(() =>
        parseDispatchItemSnapshot({ ...materialSnapshot, capturedAt }),
      ).toThrow();
    },
  );
  it.each([0, 1, 2147483646])(
    'accepts current Int revision %s',
    async (expectedRevision) => {
      expect(
        await validate(
          plainToInstance(ConfirmHealthcareCaseDispatchDto, {
            expectedRevision,
          }),
          { whitelist: true, forbidNonWhitelisted: true },
        ),
      ).toEqual([]);
    },
  );
  it.each([undefined, null, -1, 0.5, '0', 2147483647])(
    'rejects revision %s',
    async (expectedRevision) => {
      expect(
        (
          await validate(
            plainToInstance(ConfirmHealthcareCaseDispatchDto, {
              expectedRevision,
            }),
            { whitelist: true, forbidNonWhitelisted: true },
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it.each([
    'sourcePositionId',
    'batchId',
    'assetId',
    'assignmentId',
    'expectedPhysicalRevision',
    'companyId',
    'actorId',
    'physicalEffectId',
  ])('rejects supplied source/evidence %s', async (field) => {
    expect(
      (
        await validate(
          plainToInstance(ConfirmHealthcareCaseDispatchDto, {
            expectedRevision: 0,
            [field]: 'forged',
          }),
          { whitelist: true, forbidNonWhitelisted: true },
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each([999, 1000])('permits the structural transfer boundary %s', (count) =>
    expect(() => assertDispatchTransferCount(count)).not.toThrow(),
  );
  it('rejects 1001 without invoking any physical primitive', () =>
    expect(() => assertDispatchTransferCount(1001)).toThrow());
  it('hash binds tenant/Case/Dispatch/revision and excludes retry actor/key', () => {
    const hash = createDispatchConfirmRequestHash(context, 4);
    expect(
      createDispatchConfirmRequestHash(
        { ...context, actorId: 'other', key: 'other' },
        4,
      ),
    ).toBe(hash);
    for (const change of [
      { companyId: 'other' },
      { caseId: 'other' },
      { dispatchId: 'other' },
    ])
      expect(
        createDispatchConfirmRequestHash({ ...context, ...change }, 4),
      ).not.toBe(hash);
    expect(createDispatchConfirmRequestHash(context, 5)).not.toBe(hash);
  });
  it('returns completed replay before entering live transaction/runtime/physical gates', async () => {
    const result = { replay: true, command: {}, data: {} };
    const repo = {
      commands: {
        runInReadSnapshot: jest.fn().mockResolvedValue(result),
        runInTransaction: jest.fn(),
      },
    };
    const runtime = { identity: jest.fn() },
      physical = { transfer: jest.fn() };
    const service = new HealthcareCaseDispatchConfirmService(
      repo as never,
      physical as never,
      {} as never,
      {} as never,
      {} as never,
      runtime,
      healthcareCompanyTransactionTimeoutConfiguration(),
    );
    expect(await service.execute(context, { expectedRevision: 0 })).toEqual(
      result,
    );
    expect(repo.commands.runInTransaction).not.toHaveBeenCalled();
    expect(runtime.identity).not.toHaveBeenCalled();
    expect(physical.transfer).not.toHaveBeenCalled();
  });
  it.each([undefined, '', ' ', 'x'.repeat(129)])(
    'rejects invalid idempotency key before any repository access',
    async (key) => {
      const service = new HealthcareCaseDispatchConfirmService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        healthcareCompanyTransactionTimeoutConfiguration(),
      );
      await expect(
        service.execute({ ...context, key: key! }, { expectedRevision: 0 }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it('compiles the actual Nest module/adapter graph without forwardRef or a database connection', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [healthcareCompanyTransactionTimeoutConfiguration],
        }),
        HealthcareCaseDispatchModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    expect(module.get(HealthcareCaseDispatchConfirmService)).toBeDefined();
    expect(module.get(EquipmentCustodyContextRegistry)).toBeDefined();
    await module.close();
  });
});
