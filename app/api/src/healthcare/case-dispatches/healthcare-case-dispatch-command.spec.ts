import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { AddHealthcareCaseDispatchItemDto } from './dto/add-healthcare-case-dispatch-item.dto';
import { CreateHealthcareCaseDispatchDto } from './dto/create-healthcare-case-dispatch.dto';
import { SetHealthcareCaseDispatchCustodianDto } from './dto/set-healthcare-case-dispatch-custodian.dto';
import { CancelHealthcareCaseDispatchDto } from './dto/cancel-healthcare-case-dispatch.dto';
import { ExcludeHealthcareCaseDispatchItemDto } from './dto/exclude-healthcare-case-dispatch-item.dto';
import { createDispatchRequestHash } from './healthcare-case-dispatch-request-hash';
import {
  DispatchCommandContext,
  DispatchCommandIntent,
} from './healthcare-case-dispatch-command.types';
import { HealthcareCaseDispatchCommandRepository } from './healthcare-case-dispatch-command.repository';
import { HealthcareCaseDispatchCommandService } from './healthcare-case-dispatch-command.service';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
const id = '11111111-1111-4111-8111-111111111111';
const c: DispatchCommandContext = {
  companyId: 'tenant',
  actorId: 'actor',
  caseId: 'case',
  dispatchId: 'dispatch',
  itemId: 'item',
  key: 'key',
};
const custodian = {
  type: 'EXTERNAL_PERSON' as const,
  displayName: 'Receiver',
  userId: null,
};
const material = {
  type: 'MATERIAL',
  expectedRevision: 0,
  sourceCaseKitItemId: id,
  quantity: 2,
  sourcePositionId: id,
  batchId: null,
};
const equipment = {
  type: 'EQUIPMENT',
  expectedRevision: 0,
  sourceCaseKitItemId: id,
};
const options = { whitelist: true, forbidNonWhitelisted: true };
describe('Dispatch strict command DTOs', () => {
  it.each([material, { ...material, batchId: id }, equipment])(
    'accepts valid source intent %j',
    async (dto) => {
      expect(
        await validate(
          plainToInstance(AddHealthcareCaseDispatchItemDto, dto),
          options,
        ),
      ).toEqual([]);
    },
  );
  it.each([
    { ...equipment, quantity: undefined },
    { ...equipment, quantity: 1 },
    { ...equipment, batchId: null },
    { ...equipment, sourcePositionId: id },
    { ...equipment, assignmentId: id },
    { ...equipment, assetId: id },
    { ...equipment, expectedPhysicalRevision: 0 },
    { ...material, productId: id },
    { ...material, expectedPositionRevision: 0 },
    { ...material, physicalEffectId: id },
    { ...material, quantity: 0 },
    { ...material, quantity: 1.5 },
    { ...material, batchId: undefined },
    { ...material, type: 'OTHER' },
    { ...equipment, expectedRevision: -1 },
    { ...equipment, expectedRevision: 2147483647 },
    { ...equipment, sourceCaseKitItemId: 'foreign' },
  ])('rejects invalid/cross-type/internal intent %j', async (dto) => {
    expect(
      (
        await validate(
          plainToInstance(AddHealthcareCaseDispatchItemDto, dto),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('requires explicit material batchId', async () => {
    const { batchId: omitted, ...dto } = material;
    void omitted;
    expect(
      (
        await validate(
          plainToInstance(AddHealthcareCaseDispatchItemDto, dto),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    { custodian },
    { custodian: { ...custodian, type: 'INTERNAL_USER', userId: id } },
    { custodian: { ...custodian, type: 'INTERNAL_USER' } },
  ])('accepts custodian %j', async (dto) => {
    expect(
      await validate(
        plainToInstance(CreateHealthcareCaseDispatchDto, dto),
        options,
      ),
    ).toEqual([]);
  });
  it.each([
    {},
    { custodian: null },
    { custodian: { ...custodian, userId: id } },
    { custodian: { ...custodian, displayName: ' ' } },
    { custodian: { ...custodian, displayName: 'x'.repeat(257) } },
    { custodian: { ...custodian, passwordHash: 'secret' } },
    { custodian, companyId: id },
  ])('rejects malformed custodian %j', async (dto) => {
    expect(
      (
        await validate(
          plainToInstance(CreateHealthcareCaseDispatchDto, dto),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('normalizes custodian whitespace', () => {
    expect(
      plainToInstance(CreateHealthcareCaseDispatchDto, {
        custodian: { ...custodian, displayName: ' A   B ' },
      }).custodian.displayName,
    ).toBe('A B');
  });
  it.each([
    CancelHealthcareCaseDispatchDto,
    ExcludeHealthcareCaseDispatchItemDto,
  ])('validates revision and trimmed bounded reason', async (Dto) => {
    expect(
      await validate(
        plainToInstance(Dto, { expectedRevision: 0, reason: ' Reason ' }),
        options,
      ),
    ).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(Dto, { expectedRevision: 0, reason: ' ' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(Dto, { expectedRevision: -1, reason: 'Reason' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('set custodian requires expectedRevision', async () => {
    expect(
      (
        await validate(
          plainToInstance(SetHealthcareCaseDispatchCustodianDto, { custodian }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
describe('Dispatch canonical intent hash', () => {
  const commands: DispatchCommandIntent[] = [
    { operation: 'CREATE', dto: { custodian } },
    { operation: 'CUSTODIAN_SET', dto: { custodian, expectedRevision: 0 } },
    {
      operation: 'ITEM_ADD',
      dto: material as AddHealthcareCaseDispatchItemDto,
    },
    {
      operation: 'ITEM_ADD',
      dto: equipment as AddHealthcareCaseDispatchItemDto,
    },
    {
      operation: 'ITEM_EXCLUDE',
      dto: { expectedRevision: 0, reason: 'Reason' },
    },
    { operation: 'CANCEL', dto: { expectedRevision: 0, reason: 'Reason' } },
  ];
  it.each(commands)(
    '$operation excludes actor,key/server state and includes tenant/target intent',
    (i) => {
      const hash = createDispatchRequestHash(c, i);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(
        createDispatchRequestHash({ ...c, actorId: 'other', key: 'other' }, i),
      ).toBe(hash);
      expect(
        createDispatchRequestHash({ ...c, companyId: 'other' }, i),
      ).not.toBe(hash);
      expect(createDispatchRequestHash({ ...c, caseId: 'other' }, i)).not.toBe(
        hash,
      );
    },
  );
  it('canonicalizes name/reason and explicit null', () => {
    expect(
      createDispatchRequestHash(c, {
        operation: 'CREATE',
        dto: {
          custodian: {
            ...custodian,
            displayName: ' Receiver ',
            userId: undefined,
          },
        },
      }),
    ).toBe(
      createDispatchRequestHash(c, { operation: 'CREATE', dto: { custodian } }),
    );
    expect(
      createDispatchRequestHash(c, {
        operation: 'CANCEL',
        dto: { expectedRevision: 0, reason: ' Reason ' },
      }),
    ).toBe(
      createDispatchRequestHash(c, {
        operation: 'CANCEL',
        dto: { expectedRevision: 0, reason: 'Reason' },
      }),
    );
  });
  it('hash includes source,quantity,batch,revision and operation', () => {
    const intent: DispatchCommandIntent = {
      operation: 'ITEM_ADD',
      dto: material as AddHealthcareCaseDispatchItemDto,
    };
    for (const patch of [
      { quantity: 3 },
      { batchId: id },
      { expectedRevision: 1 },
      { sourcePositionId: 'other' },
    ])
      expect(
        createDispatchRequestHash(c, {
          ...intent,
          dto: { ...intent.dto, ...patch },
        }),
      ).not.toBe(createDispatchRequestHash(c, intent));
  });
});
describe('Dispatch service receipt/transaction boundary', () => {
  const tx = {} as Prisma.TransactionClient,
    now = new Date('2026-10-15T12:00:00Z'),
    actor = { id: 'actor', firstName: 'Original', lastName: 'Actor' };
  const detail = () => ({
    id: 'dispatch',
    caseId: 'case',
    caseKitId: 'kit',
    status: 'DRAFT',
    revision: 0,
    custodianType: 'EXTERNAL_PERSON',
    custodianUserId: null,
    custodianDisplayName: 'Receiver',
    createdAt: now,
    confirmedAt: null,
    cancelledAt: null,
    snapshotVersion: null,
    snapshot: null,
    createdBy: actor,
    confirmedBy: null,
    cancelledBy: null,
    confirmedFromRevision: null,
    cancellationReason: null,
    healthcareCase: {
      id: 'case',
      folio: 'F',
      scheduledStart: now,
      scheduledEnd: now,
    },
    items: [],
    audit: [],
  });
  const audit = (operation = 'CREATE', before: number | null = null) => ({
    id: 'audit',
    companyId: 'tenant',
    dispatchId: 'dispatch',
    dispatchItemId: null,
    operation,
    actorId: 'original-actor',
    createdAt: now,
    revisionBefore: before,
    revisionAfter: before === null ? 0 : before + 1,
    change: {
      version: 1,
      operation,
      reason: operation === 'CANCEL' ? 'Reason' : null,
    },
  });
  const repo = {
    runInReadSnapshot: jest.fn(),
    runInTransaction: jest.fn(),
    findClaim: jest.fn(),
    createClaim: jest.fn(),
    completeClaim: jest.fn(),
    detail: jest.fn(),
    findWitness: jest.fn(),
    findReplayItem: jest.fn(),
    lockSources: jest.fn(),
    lockCaseForShare: jest.fn(),
    lockProductForKeyShare: jest.fn(),
    lockAssetsForShare: jest.fn(),
    lockAssignmentsForShare: jest.fn(),
    findCase: jest.fn(),
    findKit: jest.fn(),
    lockReadiness: jest.fn(),
    createDraft: jest.fn(),
    appendAudit: jest.fn(),
    lockDraftById: jest.fn(),
    findCustodianUser: jest.fn(),
    setCustodianWithExpectedRevision: jest.fn(),
    cancelDraftWithExpectedRevision: jest.fn(),
    lockItem: jest.fn(),
    excludeItemWithExpectedRevision: jest.fn(),
    advanceItemRevision: jest.fn(),
  };
  const service = new HealthcareCaseDispatchCommandService(
    repo as unknown as HealthcareCaseDispatchCommandRepository,
    healthcareCompanyTransactionTimeoutConfiguration(),
  );
  beforeEach(() => {
    jest.resetAllMocks();
    repo.runInReadSnapshot.mockImplementation(
      (fn: (t: Prisma.TransactionClient) => unknown) => fn(tx),
    );
    repo.runInTransaction.mockImplementation(
      (fn: (t: Prisma.TransactionClient) => unknown) => fn(tx),
    );
    repo.findClaim.mockResolvedValue(null);
    repo.createClaim.mockResolvedValue({ id: 'claim' });
    repo.detail.mockResolvedValue(detail());
    repo.findCase.mockResolvedValue({
      id: 'case',
      status: 'SCHEDULED',
      scheduledStart: now,
      scheduledEnd: new Date(now.getTime() + 1000),
    });
    repo.findKit.mockResolvedValue({
      id: 'kit',
      status: 'PREPARED',
      items: [],
      healthcareCase: {
        status: 'SCHEDULED',
        scheduledStart: now,
        scheduledEnd: new Date(now.getTime() + 1000),
        requirements: [],
      },
    });
    repo.createDraft.mockResolvedValue({ id: 'dispatch' });
    repo.appendAudit.mockResolvedValue(audit());
    repo.lockDraftById.mockResolvedValue({
      id: 'dispatch',
      caseKitId: 'kit',
      status: 'DRAFT',
      revision: 0,
    });
    repo.setCustodianWithExpectedRevision.mockResolvedValue({ count: 1 });
    repo.cancelDraftWithExpectedRevision.mockResolvedValue({ count: 1 });
  });
  it('claims before locks, appends one audit and completes within same tx', async () => {
    const r = await service.execute(c, {
      operation: 'CREATE',
      dto: { custodian },
    });
    expect(r.replay).toBe(false);
    expect(repo.createClaim.mock.invocationCallOrder[0]).toBeLessThan(
      repo.lockCaseForShare.mock.invocationCallOrder[0],
    );
    expect(repo.appendAudit).toHaveBeenCalledTimes(1);
    expect(repo.completeClaim).toHaveBeenCalledWith('claim', 'dispatch', tx);
    expect(repo.runInTransaction).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, '', ' '.repeat(3), 'x'.repeat(129)])(
    'rejects invalid key %j before persistence',
    async (key) => {
      await expect(
        service.execute(
          { ...c, key: key! },
          { operation: 'CREATE', dto: { custodian } },
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(repo.findClaim).not.toHaveBeenCalled();
    },
  );
  it.each([
    { status: 'DRAFT', scheduledStart: now, scheduledEnd: now },
    { status: 'SCHEDULED', scheduledStart: null, scheduledEnd: now },
    { status: 'SCHEDULED', scheduledStart: now, scheduledEnd: now },
  ])('rejects invalid schedule %j', async (parent) => {
    repo.findKit.mockResolvedValue({
      id: 'kit',
      status: 'PREPARED',
      items: [],
      healthcareCase: { ...parent, requirements: [] },
    });
    await expect(
      service.execute(c, { operation: 'CREATE', dto: { custodian } }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.appendAudit).not.toHaveBeenCalled();
  });
  it('missing/foreign Case is 404', async () => {
    repo.findCase.mockResolvedValue(null);
    await expect(
      service.execute(c, { operation: 'CREATE', dto: { custodian } }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('requires prepared Kit and local readiness', async () => {
    repo.findKit.mockResolvedValue({
      id: 'kit',
      status: 'DRAFT',
      healthcareCase: {
        status: 'SCHEDULED',
        scheduledStart: now,
        scheduledEnd: new Date(now.getTime() + 1000),
      },
    });
    await expect(
      service.execute(c, { operation: 'CREATE', dto: { custodian } }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('BLOCKED readiness rejects before write', async () => {
    repo.findKit.mockResolvedValue({
      id: 'kit',
      status: 'PREPARED',
      items: [],
      healthcareCase: {
        status: 'SCHEDULED',
        scheduledStart: now,
        scheduledEnd: new Date(now.getTime() + 1000),
        requirements: [
          {
            id: 'required',
            lifecycle: 'ACTIVE',
            type: 'REQUIRED',
            requestedQty: 1,
            product: { inventoryTracking: 'QUANTITY' },
          },
        ],
      },
    });
    await expect(
      service.execute(c, { operation: 'CREATE', dto: { custodian } }),
    ).rejects.toMatchObject({
      response: { code: 'CASE_KIT_PREPARATION_BLOCKED' },
    });
    expect(repo.createDraft).not.toHaveBeenCalled();
  });
  it('same custodian with new key is revisioned', async () => {
    await service.execute(c, {
      operation: 'CUSTODIAN_SET',
      dto: { expectedRevision: 0, custodian },
    });
    expect(repo.setCustodianWithExpectedRevision).toHaveBeenCalledTimes(1);
    expect(repo.appendAudit).toHaveBeenCalledWith(
      c,
      'CUSTODIAN_SET',
      0,
      null,
      null,
      tx,
    );
  });
  it('stale revision is 409 with no audit/completion', async () => {
    repo.lockDraftById.mockResolvedValue({ status: 'DRAFT', revision: 1 });
    await expect(
      service.execute(c, {
        operation: 'CANCEL',
        dto: { expectedRevision: 0, reason: 'Reason' },
      }),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_STATE_CHANGED' } });
    expect(repo.appendAudit).not.toHaveBeenCalled();
    expect(repo.completeClaim).not.toHaveBeenCalled();
  });
  it('terminal state rejects new command', async () => {
    repo.lockDraftById.mockResolvedValue({ status: 'CANCELLED', revision: 0 });
    await expect(
      service.execute(c, {
        operation: 'CANCEL',
        dto: { expectedRevision: 0, reason: 'Reason' },
      }),
    ).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_NOT_MUTABLE' },
    });
  });
  it('cancel needs no Case/Kit/readiness even when degraded', async () => {
    await service.execute(c, {
      operation: 'CANCEL',
      dto: { expectedRevision: 0, reason: ' Reason ' },
    });
    expect(repo.findCase).not.toHaveBeenCalled();
    expect(repo.findKit).not.toHaveBeenCalled();
    expect(repo.cancelDraftWithExpectedRevision).toHaveBeenCalledWith(
      c,
      0,
      'Reason',
      tx,
    );
  });
  async function setupReplay(i: DispatchCommandIntent) {
    repo.findClaim.mockResolvedValue({
      requestHash: createDispatchRequestHash(c, i),
      resourceId: 'dispatch',
    });
    repo.findWitness.mockResolvedValue(
      audit(i.operation, i.operation === 'CREATE' ? null : 0),
    );
    repo.detail.mockResolvedValue({
      ...detail(),
      status: 'CANCELLED',
      revision: 9,
      cancelledBy: actor,
      cancelledAt: now,
      cancellationReason: 'Later',
    });
    return service.execute({ ...c, actorId: 'retry-actor' }, i);
  }
  it('replay returns current aggregate plus original actor/time after later revision', async () => {
    const r = await setupReplay({
      operation: 'CUSTODIAN_SET',
      dto: { expectedRevision: 0, custodian },
    });
    expect(r).toMatchObject({
      replay: true,
      command: {
        actorId: 'original-actor',
        occurredAt: now.toISOString(),
        revisionAfter: 1,
      },
      data: { status: 'CANCELLED', revision: 9 },
    });
    expect(repo.runInTransaction).not.toHaveBeenCalled();
    expect(repo.lockDraftById).not.toHaveBeenCalled();
  });
  it('key mismatch fails before mutable state', async () => {
    repo.findClaim.mockResolvedValue({
      requestHash: 'different',
      resourceId: 'dispatch',
    });
    await expect(
      service.execute(c, { operation: 'CREATE', dto: { custodian } }),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(repo.findCase).not.toHaveBeenCalled();
  });
  it.each([
    null,
    audit('CANCEL'),
    { ...audit(), revisionBefore: 2 },
    { ...audit(), dispatchItemId: 'wrong' },
  ])('missing/incoherent witness fails sanitized %j', async (witness) => {
    repo.findClaim.mockResolvedValue({
      requestHash: createDispatchRequestHash(c, {
        operation: 'CREATE',
        dto: { custodian },
      }),
      resourceId: 'dispatch',
    });
    repo.findWitness.mockResolvedValue(witness);
    await expect(
      service.execute(c, { operation: 'CREATE', dto: { custodian } }),
    ).rejects.toMatchObject({
      response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
    });
  });
  it('claim UNIQUE loser reads winner outside aborted tx', async () => {
    const i: DispatchCommandIntent = {
      operation: 'CREATE',
      dto: { custodian },
    };
    repo.findClaim.mockResolvedValueOnce(null).mockResolvedValueOnce({
      requestHash: createDispatchRequestHash(c, i),
      resourceId: 'dispatch',
    });
    repo.createClaim.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['companyId', 'scope', 'key'] },
      }),
    );
    repo.findWitness.mockResolvedValue(audit());
    expect((await service.execute(c, i)).replay).toBe(true);
    expect(repo.runInReadSnapshot).toHaveBeenCalledTimes(2);
    expect(repo.lockSources).not.toHaveBeenCalled();
  });
  it('sanitizes unexpected database failures', async () => {
    repo.createClaim.mockRejectedValue(new Error('secret db'));
    await expect(
      service.execute(c, { operation: 'CREATE', dto: { custodian } }),
    ).rejects.toMatchObject({
      response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
    });
  });
});

describe('Dispatch source validation before physical mutation', () => {
  const now = new Date(),
    tx = {} as Prisma.TransactionClient;
  const repo = {
    runInReadSnapshot: jest.fn(),
    runInTransaction: jest.fn(),
    findClaim: jest.fn(),
    createClaim: jest.fn(),
    findIdentity: jest.fn(),
    lockSources: jest.fn(),
    lockCaseForShare: jest.fn(),
    lockProductForKeyShare: jest.fn(),
    lockAssetsForShare: jest.fn(),
    lockAssignmentsForShare: jest.fn(),
    findCase: jest.fn(),
    findKit: jest.fn(),
    lockDraftById: jest.fn(),
    findSource: jest.fn(),
    findProduct: jest.fn(),
    findBatch: jest.fn(),
    findPosition: jest.fn(),
    findAsset: jest.fn(),
    equipmentConsumed: jest.fn(),
    materialCapacity: jest.fn(),
    localSource: jest.fn(),
    insertMaterialItem: jest.fn(),
    insertEquipmentItem: jest.fn(),
    advanceItemRevision: jest.fn(),
    appendAudit: jest.fn(),
    completeClaim: jest.fn(),
    detail: jest.fn(),
  };
  const service = new HealthcareCaseDispatchCommandService(
    repo as unknown as HealthcareCaseDispatchCommandRepository,
    healthcareCompanyTransactionTimeoutConfiguration(),
  );
  const materialIntent: DispatchCommandIntent = {
    operation: 'ITEM_ADD',
    dto: material as AddHealthcareCaseDispatchItemDto,
  };
  beforeEach(() => {
    jest.resetAllMocks();
    repo.runInReadSnapshot.mockImplementation(
      (fn: (t: Prisma.TransactionClient) => unknown) => fn(tx),
    );
    repo.runInTransaction.mockImplementation(
      (fn: (t: Prisma.TransactionClient) => unknown) => fn(tx),
    );
    repo.findClaim.mockResolvedValue(null);
    repo.createClaim.mockResolvedValue({ id: 'claim' });
    repo.findIdentity.mockResolvedValue({ id: 'dispatch' });
    repo.findCase.mockResolvedValue({ id: 'case' });
    repo.findKit.mockResolvedValue({
      id: 'kit',
      status: 'PREPARED',
      healthcareCase: {
        status: 'SCHEDULED',
        scheduledStart: now,
        scheduledEnd: new Date(now.getTime() + 1000),
      },
    });
    repo.lockDraftById.mockResolvedValue({
      id: 'dispatch',
      caseKitId: 'kit',
      revision: 0,
      status: 'DRAFT',
    });
    repo.findSource.mockResolvedValue({
      id: 'source',
      lifecycle: 'ACTIVE',
      requirement: { id: 'req', lifecycle: 'ACTIVE', productId: 'product' },
      requirementId: 'req',
      equipmentAssignmentId: null,
      preparedQuantity: 10,
    });
    repo.findProduct.mockResolvedValue({
      id: 'product',
      isActive: true,
      inventoryTracking: 'QUANTITY',
      lotTracking: 'NONE',
    });
    repo.findPosition.mockResolvedValue({
      id: 'position',
      productId: 'product',
      inventoryBatchId: null,
      state: 'AVAILABLE',
      contextType: null,
      contextId: null,
      quantity: 10,
      revision: 7,
    });
    repo.materialCapacity.mockResolvedValue({
      confirmed: 0,
      local: 0,
      position: 0,
    });
    repo.localSource.mockResolvedValue(null);
    repo.insertMaterialItem.mockResolvedValue({ id: 'item' });
    repo.advanceItemRevision.mockResolvedValue({ count: 1 });
    repo.appendAudit.mockResolvedValue({
      id: 'audit',
      operation: 'ITEM_ADD',
      dispatchItemId: 'item',
      revisionBefore: 0,
      revisionAfter: 1,
      actorId: 'actor',
      createdAt: now,
    });
    repo.detail.mockResolvedValue({
      id: 'dispatch',
      caseId: 'case',
      caseKitId: 'kit',
      status: 'DRAFT',
      revision: 1,
      custodianType: 'EXTERNAL_PERSON',
      custodianUserId: null,
      custodianDisplayName: 'Receiver',
      createdAt: now,
      confirmedAt: null,
      cancelledAt: null,
      snapshot: null,
      snapshotVersion: null,
      createdBy: { id: 'actor', firstName: 'A', lastName: 'B' },
      confirmedBy: null,
      cancelledBy: null,
      confirmedFromRevision: null,
      cancellationReason: null,
      healthcareCase: {
        id: 'case',
        folio: 'F',
        scheduledStart: null,
        scheduledEnd: null,
      },
      items: [],
      audit: [],
    });
  });
  it('captures server-observed Position revision', async () => {
    await service.execute(c, materialIntent);
    expect(repo.insertMaterialItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePositionId: 'position',
        expectedPositionRevision: 7,
      }),
      tx,
    );
  });
  it('wrong-Case Dispatch yields 404 before planning gates', async () => {
    repo.findIdentity.mockResolvedValue(null);
    await expect(service.execute(c, materialIntent)).rejects.toMatchObject({
      status: 404,
    });
    expect(repo.findKit).not.toHaveBeenCalled();
  });
  it.each([
    { confirmed: 9, local: 0, position: 0 },
    { confirmed: 0, local: 9, position: 0 },
    { confirmed: 0, local: 0, position: 9 },
  ])(
    'enforces committed/local/prepared and cross-source Position aggregate %j',
    async (capacity) => {
      repo.materialCapacity.mockResolvedValue(capacity);
      await expect(service.execute(c, materialIntent)).rejects.toMatchObject({
        response: { code: 'CASE_DISPATCH_CAPACITY_EXCEEDED' },
      });
      expect(repo.insertMaterialItem).not.toHaveBeenCalled();
      expect(repo.appendAudit).not.toHaveBeenCalled();
    },
  );
  it.each([
    { productId: 'foreign' },
    { inventoryBatchId: id },
    { state: 'CUSTODY' },
    { contextType: 'CASE_DISPATCH_ITEM' },
    { contextId: 'business' },
  ])('rejects incoherent Position %j', async (patch) => {
    repo.findPosition.mockResolvedValue({
      id: 'position',
      productId: 'product',
      inventoryBatchId: null,
      state: 'AVAILABLE',
      contextType: null,
      contextId: null,
      quantity: 10,
      revision: 0,
      ...patch,
    });
    await expect(service.execute(c, materialIntent)).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_SOURCE_NOT_VALID' },
    });
  });
  it.each([
    { isActive: false, inventoryTracking: 'QUANTITY', lotTracking: 'NONE' },
    { isActive: true, inventoryTracking: 'ASSET', lotTracking: 'NONE' },
    { isActive: true, inventoryTracking: 'QUANTITY', lotTracking: 'REQUIRED' },
  ])('rejects Product/tracking mismatch %j', async (product) => {
    repo.findProduct.mockResolvedValue({ id: 'product', ...product });
    await expect(service.execute(c, materialIntent)).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_SOURCE_NOT_VALID' },
    });
  });
  it('NONE rejects explicit batch rather than switching source', async () => {
    await expect(
      service.execute(c, {
        operation: 'ITEM_ADD',
        dto: { ...(material as AddHealthcareCaseDispatchItemDto), batchId: id },
      }),
    ).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_SOURCE_NOT_VALID' },
    });
    expect(repo.findBatch).not.toHaveBeenCalled();
  });
  it('batch Product mismatch rejected', async () => {
    repo.findProduct.mockResolvedValue({
      id: 'product',
      isActive: true,
      inventoryTracking: 'QUANTITY',
      lotTracking: 'OPTIONAL',
    });
    repo.findBatch.mockResolvedValue({
      id,
      productId: 'foreign',
      isActive: true,
      expirationDate: null,
    });
    await expect(
      service.execute(c, {
        operation: 'ITEM_ADD',
        dto: { ...(material as AddHealthcareCaseDispatchItemDto), batchId: id },
      }),
    ).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_SOURCE_NOT_VALID' },
    });
  });
  it('Equipment requires coherent RESERVED Assignment', async () => {
    repo.findAsset.mockResolvedValue({ id: 'asset', productId: 'product' });
    repo.findSource.mockResolvedValue({
      id: 'source',
      lifecycle: 'ACTIVE',
      requirementId: null,
      equipmentAssignment: {
        id: 'assignment',
        companyId: 'tenant',
        caseId: 'case',
        lifecycle: 'RELEASED',
        equipmentAssetId: 'asset',
      },
    });
    await expect(
      service.execute(c, {
        operation: 'ITEM_ADD',
        dto: equipment as AddHealthcareCaseDispatchItemDto,
      }),
    ).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_SOURCE_NOT_VALID' },
    });
    expect(repo.insertEquipmentItem).not.toHaveBeenCalled();
  });
  it.each(['valid', 'changed binding', 'changed product'])(
    'locks Equipment canonically and rereads %s',
    async (scenario) => {
      const source = {
        id: 'source',
        lifecycle: 'ACTIVE',
        requirementId: null,
        equipmentAssignment: {
          id: 'assignment',
          equipmentAssetId: 'asset',
          companyId: c.companyId,
          caseId: c.caseId,
          lifecycle: 'RESERVED',
        },
      };
      repo.findSource.mockResolvedValueOnce(source).mockResolvedValue({
        ...source,
        equipmentAssignment: {
          ...source.equipmentAssignment,
          equipmentAssetId: scenario === 'changed binding' ? 'other' : 'asset',
        },
      });
      repo.findAsset
        .mockResolvedValueOnce({ id: 'asset', productId: 'product' })
        .mockResolvedValue({
          id: 'asset',
          productId: scenario === 'changed product' ? 'other' : 'product',
          lifecycle: 'ACTIVE',
          condition: 'GOOD',
          physicalLocation: 'WAREHOUSE',
          physicalRevision: 9,
          activeCustodyId: null,
        });
      repo.findProduct.mockResolvedValue({
        id: 'product',
        isActive: true,
        inventoryTracking: 'ASSET',
      });
      repo.equipmentConsumed.mockResolvedValue(false);
      repo.insertEquipmentItem.mockResolvedValue({ id: 'item' });
      const pending = service.execute(c, {
        operation: 'ITEM_ADD',
        dto: equipment as AddHealthcareCaseDispatchItemDto,
      });
      if (scenario === 'valid') {
        await pending;
        expect(repo.insertEquipmentItem).toHaveBeenCalledWith(
          expect.objectContaining({ expectedPhysicalRevision: 9 }),
          tx,
        );
      } else {
        await expect(pending).rejects.toMatchObject({ status: 409 });
        expect(repo.insertEquipmentItem).not.toHaveBeenCalled();
      }
      expect(repo.lockCaseForShare.mock.invocationCallOrder[0]).toBeLessThan(
        repo.lockProductForKeyShare.mock.invocationCallOrder[0],
      );
      expect(
        repo.lockProductForKeyShare.mock.invocationCallOrder[0],
      ).toBeLessThan(repo.lockAssetsForShare.mock.invocationCallOrder[0]);
      expect(repo.lockAssetsForShare.mock.invocationCallOrder[0]).toBeLessThan(
        repo.lockAssignmentsForShare.mock.invocationCallOrder[0],
      );
      expect(repo.lockAssetsForShare).toHaveBeenCalledTimes(1);
      expect(repo.lockAssignmentsForShare).toHaveBeenCalledTimes(1);
      expect(
        repo.lockSources.mock.calls.some(
          ([table]) => table === 'HealthcareCase',
        ),
      ).toBe(false);
    },
  );
});

describe('Dispatch readiness repository lock protocol', () => {
  it('locks Products then Assets then Requirements then Assignments', async () => {
    const repository = new HealthcareCaseDispatchCommandRepository(
      {} as never,
      {} as never,
    );
    const locks = jest.spyOn(repository, 'lockSources').mockResolvedValue();
    const kit = {
      items: [
        {
          id: 'item',
          lifecycle: 'ACTIVE',
          equipmentAssignmentId: 'assignment',
          equipmentAssignment: {
            equipmentAsset: { id: 'asset', product: { id: 'product' } },
          },
        },
      ],
      healthcareCase: { requirements: [{ id: 'requirement' }] },
    };
    await repository.lockReadiness(
      kit as never,
      c,
      {} as Prisma.TransactionClient,
    );
    expect(locks.mock.calls.map(([table]) => table)).toEqual([
      'HealthcareCaseKitItem',
      'Product',
      'EquipmentAsset',
      'HealthcareCaseRequirement',
      'HealthcareEquipmentAssignment',
    ]);
  });
  it('sorts and deduplicates lock IDs and uses actual SHARE/KEY SHARE modes', async () => {
    const query = jest
      .fn<
        Promise<unknown[]>,
        [Prisma.Sql | TemplateStringsArray, ...unknown[]]
      >()
      .mockResolvedValue([]);
    const tx = { $queryRaw: query } as unknown as Prisma.TransactionClient;
    const repository = new HealthcareCaseDispatchCommandRepository(
      {} as never,
      {} as never,
    );
    await repository.lockAssetsForShare('tenant', ['z', 'a', 'z'], tx);
    const sql = query.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toEqual(['tenant', 'a', 'z']);
    expect(sql.text).toMatch(/ORDER BY id FOR SHARE$/);
    await repository.lockProductForKeyShare('tenant', 'product', tx);
    expect((query.mock.calls[1][0] as TemplateStringsArray).join('')).toContain(
      'FOR KEY SHARE',
    );
  });
});
