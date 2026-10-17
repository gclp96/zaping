import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  HealthcareCaseDispatchConfirmRepository,
  ConfirmContext,
} from '../src/healthcare/case-dispatches/healthcare-case-dispatch-confirm.repository';
import { HealthcareCaseDispatchConfirmService } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-confirm.service';
import { HealthcareCaseDispatchCommandRepository } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-command.repository';
import { HealthcareCaseDispatchCommandService } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-command.service';
import { HealthcareCaseDispatchesRepository } from '../src/healthcare/case-dispatches/healthcare-case-dispatches.repository';
import { HealthcareCaseDispatchEquipmentEvidenceRepository } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-equipment-evidence.repository';
import { HealthcareCaseDispatchEquipmentContextAdapter } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-equipment-context.adapter';
import { HealthcareEquipmentAssignmentsRepository } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.service';
import { HealthcareCaseKitsRepository } from '../src/healthcare/case-kits/healthcare-case-kits.repository';
import { HealthcareCaseKitsService } from '../src/healthcare/case-kits/healthcare-case-kits.service';
import { HealthcareCaseService } from '../src/healthcare/cases/healthcare-case.service';
import { EquipmentService } from '../src/equipment/equipment.service';
import { EquipmentPhysicalRepository } from '../src/equipment/equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from '../src/equipment/equipment-physical-history.service';
import { EquipmentCustodyService } from '../src/equipment/equipment-custody.service';
import { EquipmentCustodyContextRegistry } from '../src/equipment/equipment-custody-context.registry';
import { EquipmentProvisioningService } from '../src/equipment/equipment-provisioning.service';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../src/inventory/physical/inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from '../src/inventory/physical/inventory-compatibility-history.service';
import { InventoryAuthorityResolver } from '../src/inventory/physical/inventory-authority-resolver';
import { InventoryAuthorityTransactionService } from '../src/inventory/physical/inventory-authority-transaction.service';
import { InventoryRuntimeCompatibilityService } from '../src/inventory/physical/inventory-runtime-compatibility.service';
import { inventoryAuthorityFence } from '../src/inventory/physical/inventory-authority-fence';
import { SalesPhysicalIntegrationService } from '../src/inventory/physical/sales-physical-integration.service';
import { SalesPhysicalSourceResolver } from '../src/inventory/physical/sales-physical-source-resolver';
import { ReceiptPhysicalIntegrationService } from '../src/inventory/physical/receipt-physical-integration.service';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import { acquireHealthcareCompanyLock } from '../src/healthcare/common/healthcare-company-lock';
import { createDispatchConfirmRequestHash } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-request-hash';

jest.setTimeout(30000);
const suite =
  process.env.RUN_CASE_DISPATCH_CONFIRM_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('HC-DSP-01C isolated PostgreSQL16 acceptance', () => {
  let db: PrismaClient, one: PrismaClient, two: PrismaClient;
  const runtimeKeys = [
    'INVENTORY_AUTHORITY_PROTOCOL',
    'INVENTORY_RUNTIME_BUILD',
    'INVENTORY_RUNTIME_ENVIRONMENT',
  ] as const;
  const runtimeEnv = runtimeKeys.map((k) => process.env[k]);
  const policy = healthcareCompanyTransactionTimeoutConfiguration();
  beforeAll(async () => {
    const url = new URL(process.env.CASE_DISPATCH_CONFIRM_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_case_dispatch_confirm_test' ||
      url.username !== 'case_dispatch_confirm_test' ||
      !process.env.CASE_DISPATCH_CONFIRM_TEST_RUN
    )
      throw Error('Unverified isolated target');
    const client = (name: string) => {
      const u = new URL(url);
      u.searchParams.set('application_name', name);
      return new PrismaClient({ datasources: { db: { url: u.toString() } } });
    };
    db = client('confirm-observer');
    one = client('confirm-a');
    two = client('confirm-b');
    await Promise.all([db.$connect(), one.$connect(), two.$connect()]);
    const [role] = await db.$queryRaw<
      { rolsuper: boolean; version: string }[]
    >`SELECT rolsuper, current_setting('server_version') AS version FROM pg_roles WHERE rolname=current_user`;
    expect(role.rolsuper).toBe(false);
    expect(role.version).toMatch(/^16\./);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    runtimeKeys.forEach((k, i) => {
      if (runtimeEnv[i] === undefined) delete process.env[k];
      else process.env[k] = runtimeEnv[i];
    });
  });
  afterAll(async () => {
    if (db) {
      const [stats] = await db.$queryRaw<
        { deadlocks: bigint }[]
      >`SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()`;
      expect(Number(stats.deadlocks)).toBe(0);
    }
    await Promise.all([
      db?.$disconnect(),
      one?.$disconnect(),
      two?.$disconnect(),
    ]);
  });
  function services(client = db) {
    const reads = new HealthcareCaseDispatchesRepository(
      client as PrismaService,
    );
    const commands = new HealthcareCaseDispatchCommandRepository(
      client as PrismaService,
      reads,
    );
    const assignments = new HealthcareEquipmentAssignmentsRepository(
      client as PrismaService,
    );
    const physicalRepo = new PhysicalInventoryRepository(),
      physical = new PhysicalInventoryService(physicalRepo);
    const projections = new InventoryCompatibilityProjectionService(),
      runtime = new InventoryRuntimeCompatibilityService(),
      authority = new InventoryAuthorityResolver();
    const equipmentRepo = new EquipmentPhysicalRepository(),
      history = new EquipmentPhysicalHistoryService(equipmentRepo);
    const evidence = new HealthcareCaseDispatchEquipmentEvidenceRepository(),
      adapter = new HealthcareCaseDispatchEquipmentContextAdapter(evidence);
    const custody = new EquipmentCustodyService(
      equipmentRepo,
      history,
      new EquipmentCustodyContextRegistry([adapter]),
    );
    const repo = new HealthcareCaseDispatchConfirmRepository(
      client as PrismaService,
      commands,
      assignments,
      physicalRepo,
    );
    return {
      repo,
      commands,
      reads,
      physicalRepo,
      physical,
      projections,
      runtime,
      authority,
      equipmentRepo,
      history,
      custody,
      adapter,
      evidence,
      confirm: new HealthcareCaseDispatchConfirmService(
        repo,
        physical,
        projections,
        custody,
        authority,
        runtime,
        policy,
      ),
      draft: new HealthcareCaseDispatchCommandService(commands, policy),
      assignment: new HealthcareEquipmentAssignmentsService(
        assignments,
        policy,
      ),
      assignments,
      kit: new HealthcareCaseKitsService(
        new HealthcareCaseKitsRepository(client as PrismaService),
        policy,
      ),
      equipment: new EquipmentService(
        client as PrismaService,
        {} as never,
        equipmentRepo,
        history,
        policy,
      ),
      case: new HealthcareCaseService(
        client as PrismaService,
        {} as never,
        new HealthcareEquipmentAssignmentsService(assignments, policy),
        policy,
      ),
      authorityTx: new InventoryAuthorityTransactionService(
        client as PrismaService,
        authority,
        runtime,
      ),
    };
  }
  async function fixture(
    kind: 'MATERIAL' | 'EQUIPMENT' | 'MIXED' = 'MIXED',
    authority: 'PHYSICAL' | 'LEGACY' | 'CUTOVER' = 'PHYSICAL',
    batched = false,
    preparedQuantity = 10,
    quantity = 3,
    equipmentCount = 1,
  ) {
    const company = await db.company.create({
      data: {
        name: 'Confirm isolated synthetic acceptance',
        rfc: randomUUID(),
      },
    });
    const companyId = company.id;
    const actor = await db.user.create({
      data: {
        companyId,
        firstName: 'Confirm',
        lastName: 'Actor',
        email: randomUUID() + '@example.invalid',
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'ADMIN',
      },
    });
    const parent = await db.healthcareCase.create({
      data: {
        companyId,
        createdById: actor.id,
        folio: randomUUID(),
        title: 'Dispatch Confirm',
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-11-01T10:00:00Z'),
        scheduledEnd: new Date('2026-11-01T12:00:00Z'),
      },
    });
    // Structural authority/warehouse fixtures only: no operational cutover or reconciliation is invoked.
    if (authority !== 'LEGACY')
      await db.inventoryCutover.create({
        data:
          authority === 'CUTOVER'
            ? { companyId, initiatedBy: actor.id }
            : {
                companyId,
                initiatedBy: actor.id,
                status: 'PHYSICAL_ACTIVE',
                revision: 6,
                manifestDigest: 'a'.repeat(64),
                snapshotFingerprint: 'b'.repeat(64),
                baselineBuild: 'dispatch-confirm-acceptance',
                approvedBy: actor.id,
                manifestLockedAt: new Date(),
                activatedBy: actor.id,
                activatedAt: new Date(),
              },
      });
    const material = await db.product.create({
      data: {
        companyId,
        sku: randomUUID(),
        name: 'Historical material',
        inventoryTracking: 'QUANTITY',
        lotTracking: batched ? 'OPTIONAL' : 'NONE',
        stock: kind === 'EQUIPMENT' ? 0 : 20,
      },
    });
    const batch = batched
      ? await db.inventoryBatch.create({
          data: {
            companyId,
            productId: material.id,
            lotNumber: randomUUID(),
            initialQuantity: 20,
            availableQuantity: 20,
            unitCost: 1,
            expirationDate: new Date('2028-01-01'),
          },
        })
      : null;
    const position =
      kind === 'EQUIPMENT'
        ? null
        : await db.inventoryPosition.create({
            data: {
              companyId,
              productId: material.id,
              inventoryBatchId: batch?.id,
              state: 'AVAILABLE',
              quantity: 20,
            },
          });
    const ep = await db.product.create({
      data: {
        companyId,
        sku: randomUUID(),
        name: 'Historical equipment',
        inventoryTracking: 'ASSET',
      },
    });
    const asset = await db.equipmentAsset.create({
      data: {
        companyId,
        productId: ep.id,
        assetCode: randomUUID(),
        condition: 'GOOD',
        physicalLocation: 'WAREHOUSE',
      },
    });
    const assignment = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId,
        caseId: parent.id,
        equipmentAssetId: asset.id,
        origin: 'DIRECT',
        directAssignmentReason: 'Acceptance',
        createdById: actor.id,
      },
    });
    const kit = await db.healthcareCaseKit.create({
      data: { companyId, caseId: parent.id, createdById: actor.id },
    });
    const requirement = await db.healthcareCaseRequirement.create({
      data: {
        companyId,
        caseId: parent.id,
        productId: material.id,
        requestedQty: preparedQuantity,
        type: 'REQUIRED',
        sortOrder: 0,
        createdById: actor.id,
      },
    });
    const source = await db.healthcareCaseKitItem.create({
      data: {
        companyId,
        caseId: parent.id,
        caseKitId: kit.id,
        requirementId: requirement.id,
        preparedQuantity,
        addedById: actor.id,
      },
    });
    const equipmentSource = await db.healthcareCaseKitItem.create({
      data: {
        companyId,
        caseId: parent.id,
        caseKitId: kit.id,
        equipmentAssignmentId: assignment.id,
        addedById: actor.id,
      },
    });
    const equipmentSources = [{ asset, assignment, source: equipmentSource }];
    for (let n = 1; n < equipmentCount; n++) {
      const extra = await db.equipmentAsset.create({
        data: {
          companyId,
          productId: ep.id,
          assetCode: randomUUID(),
          condition: 'GOOD',
          physicalLocation: 'WAREHOUSE',
        },
      });
      const reservation = await db.healthcareEquipmentAssignment.create({
        data: {
          companyId,
          caseId: parent.id,
          equipmentAssetId: extra.id,
          origin: 'DIRECT',
          directAssignmentReason: 'Acceptance',
          createdById: actor.id,
        },
      });
      const selected = await db.healthcareCaseKitItem.create({
        data: {
          companyId,
          caseId: parent.id,
          caseKitId: kit.id,
          equipmentAssignmentId: reservation.id,
          addedById: actor.id,
        },
      });
      equipmentSources.push({
        asset: extra,
        assignment: reservation,
        source: selected,
      });
    }
    const s = services();
    await s.kit.confirmPreparation(companyId, actor.id, kit.id, randomUUID());
    const context = {
      companyId,
      caseId: parent.id,
      actorId: actor.id,
      key: randomUUID(),
    };
    const created = await s.draft.execute(context, {
      operation: 'CREATE',
      dto: {
        custodian: {
          type: 'EXTERNAL_PERSON',
          displayName: 'Receiver',
          userId: null,
        },
      },
    });
    const c: ConfirmContext = {
      ...context,
      dispatchId: created.data.id,
      key: randomUUID(),
    };
    let revision = 0;
    if (kind !== 'EQUIPMENT') {
      await s.draft.execute(
        { ...c, key: randomUUID() },
        {
          operation: 'ITEM_ADD',
          dto: {
            type: 'MATERIAL',
            expectedRevision: revision++,
            sourceCaseKitItemId: source.id,
            quantity,
            sourcePositionId: position!.id,
            batchId: batch?.id ?? null,
          },
        },
      );
    }
    if (kind !== 'MATERIAL') {
      for (const selected of equipmentSources)
        await s.draft.execute(
          { ...c, key: randomUUID() },
          {
            operation: 'ITEM_ADD',
            dto: {
              type: 'EQUIPMENT',
              expectedRevision: revision++,
              sourceCaseKitItemId: selected.source.id,
            },
          },
        );
    }
    return {
      companyId,
      actor,
      parent,
      material,
      batch,
      position,
      ep,
      asset,
      assignment,
      kit,
      requirement,
      source,
      equipmentSource,
      equipmentSources,
      c,
      revision,
    };
  }
  type F = Awaited<ReturnType<typeof fixture>>;
  const confirm = (f: F, s = services(), key = f.c.key) =>
    s.confirm.execute({ ...f.c, key }, { expectedRevision: f.revision });
  async function state(f: F) {
    const where = { companyId: f.companyId };
    return {
      products: await db.product.findMany({ where, orderBy: { id: 'asc' } }),
      batches: await db.inventoryBatch.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
      positions: await db.inventoryPosition.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
      effects: await db.inventoryPhysicalEffect.findMany({
        where,
        include: { lines: { orderBy: { sequence: 'asc' } } },
        orderBy: { id: 'asc' },
      }),
      assets: await db.equipmentAsset.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
      custody: await db.equipmentAssetCustody.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
      events: await db.equipmentAssetPhysicalEvent.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
      roots: await db.healthcareCaseDispatch.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
      items: await db.healthcareCaseDispatchItem.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
      audits: await db.healthcareCaseDispatchAudit.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
      claims: await db.idempotencyRecord.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
    };
  }
  async function assertConfirmed(f: F) {
    const root = await services().repo.root(db, f.c);
    expect(root).toMatchObject({
      status: 'CONFIRMED',
      revision: f.revision + 1,
      confirmedFromRevision: f.revision,
      confirmedById: f.actor.id,
    });
    expect(
      await db.healthcareCaseDispatchAudit.count({
        where: { dispatchId: f.c.dispatchId, operation: 'CONFIRM' },
      }),
    ).toBe(1);
    expect(
      await db.healthcareCase.findUnique({ where: { id: f.parent.id } }),
    ).toMatchObject({ status: 'SCHEDULED' });
    expect(
      await db.healthcareCaseKit.findUnique({ where: { id: f.kit.id } }),
    ).toMatchObject({ status: 'PREPARED' });
    expect(
      await db.healthcareEquipmentAssignment.findUnique({
        where: { id: f.assignment.id },
      }),
    ).toMatchObject({ lifecycle: 'RESERVED' });
    for (const item of root!.items) {
      expect(item.snapshot).not.toBeNull();
      if (item.lifecycle === 'EXCLUDED')
        expect([
          item.destinationPositionId,
          item.physicalEffectId,
          item.equipmentCustodyId,
          item.equipmentPhysicalEventId,
        ]).toEqual([null, null, null, null]);
      else if (item.type === 'MATERIAL') {
        const target = await db.inventoryPosition.findUniqueOrThrow({
          where: { id: item.destinationPositionId! },
        });
        expect(target).toMatchObject({
          companyId: f.companyId,
          productId: item.productId,
          inventoryBatchId: item.batchId,
          quantity: item.quantity,
          state: 'CUSTODY',
          contextType: 'CASE_DISPATCH_ITEM',
          contextId: item.id,
        });
        const effect = await db.inventoryPhysicalEffect.findUniqueOrThrow({
          where: { id: item.physicalEffectId! },
          include: { lines: true },
        });
        expect(effect).toMatchObject({
          kind: 'TRANSFER',
          originType: 'CASE_DISPATCH',
          originId: root!.id,
          originOperation: 'CONFIRM_QUANTITY',
        });
        expect(
          effect.lines.find((l) => l.positionId === target.id)?.delta,
        ).toBe(item.quantity);
      } else {
        expect(
          await db.equipmentAssetCustody.findUnique({
            where: { id: item.equipmentCustodyId! },
          }),
        ).toMatchObject({
          companyId: f.companyId,
          caseId: f.parent.id,
          equipmentAssetId: item.assetId,
          assignmentId: item.assignmentId,
        });
        expect(
          await db.equipmentAssetPhysicalEvent.findUnique({
            where: { id: item.equipmentPhysicalEventId! },
          }),
        ).toMatchObject({
          operation: 'CUSTODY_OPEN',
          originType: 'CASE_DISPATCH_ITEM',
          originId: item.id,
          originOperation: 'CONFIRM_EQUIPMENT',
          revisionBefore: item.expectedPhysicalRevision,
          revisionAfter: item.expectedPhysicalRevision! + 1,
        });
      }
    }
  }
  function gate() {
    let entered!: () => void,
      release!: () => void,
      pid = 0;
    const held = new Promise<void>((r) => (entered = r)),
      wait = new Promise<void>((r) => (release = r));
    return {
      held,
      release,
      pid: () => pid,
      async pause(tx: Prisma.TransactionClient) {
        const [p] = await tx.$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;
        pid = p.pid;
        entered();
        await wait;
      },
    };
  }
  async function observed(pid: number) {
    for (let n = 0; n < 150; n++) {
      const rows = await db.$queryRaw<
        { pid: number; blockers: number[] }[]
      >`SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE application_name='confirm-b' AND wait_event_type='Lock'`;
      const waiter = rows.find((r) => r.blockers.includes(pid));
      if (waiter) {
        console.log(`CONFIRM LOCK BARRIER: ${waiter.pid} waits for ${pid}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 15));
    }
    throw Error('Expected blocking backend PID not observed');
  }
  async function race(
    g: ReturnType<typeof gate>,
    a: () => Promise<unknown>,
    b: () => Promise<unknown>,
  ) {
    const first = a(),
      firstResult = Promise.allSettled([first]);
    let secondResult: Promise<PromiseSettledResult<unknown>[]>;
    try {
      await Promise.race([
        g.held,
        first.then(() => {
          throw Error('Holder missed barrier');
        }),
      ]);
      secondResult = Promise.allSettled([b()]);
      await observed(g.pid());
    } finally {
      g.release();
    }
    const results = [...(await firstResult), ...(await secondResult)];
    for (const r of results)
      if (r.status === 'rejected')
        expect(String(r.reason)).not.toMatch(/40P01|deadlock/i);
    return results;
  }
  function hold(s: ReturnType<typeof services>, g: ReturnType<typeof gate>) {
    const original = (
      ...args: Parameters<HealthcareCaseDispatchConfirmRepository['audit']>
    ) => services(one).repo.audit(...args);
    jest.spyOn(s.repo, 'audit').mockImplementation(async (...args) => {
      const audit = await original(...args);
      await g.pause(args[0]);
      return audit;
    });
  }
  it.each(['MATERIAL', 'EQUIPMENT', 'MIXED'] as const)(
    '13/14/15/27/32/34/35/38 real %s success and durable provenance',
    async (kind) => {
      const f = await fixture(kind),
        before = await db.product.findUniqueOrThrow({
          where: { id: f.material.id },
        });
      const result = await confirm(f);
      expect(result.replay).toBe(false);
      expect(result.command).toMatchObject({
        operation: 'CONFIRM',
        revisionBefore: f.revision,
        revisionAfter: f.revision + 1,
        actorId: f.actor.id,
      });
      await assertConfirmed(f);
      expect(
        (await db.product.findUniqueOrThrow({ where: { id: f.material.id } }))
          .stock,
      ).toBe(before.stock);
      expect(
        await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
      ).toBe(0);
      const times = result.data.items.map((i) => i.capturedAt);
      expect(times.every((t) => t === result.data.dispatchedAt)).toBe(true);
    },
  );
  it('33 exact Batch AVAILABLE projection decreases and owned stock is unchanged', async () => {
    const f = await fixture('MATERIAL', 'PHYSICAL', true);
    await confirm(f);
    await assertConfirmed(f);
    expect(
      await db.inventoryBatch.findUnique({ where: { id: f.batch!.id } }),
    ).toMatchObject({ availableQuantity: 17 });
    expect(
      await db.product.findUnique({ where: { id: f.material.id } }),
    ).toMatchObject({ stock: 20 });
  });
  it('23 lost-response replay precedes runtime/authority/current Case and Asset state', async () => {
    const f = await fixture(),
      result = await confirm(f),
      before = await state(f);
    const audit = before.audits.find((a) => a.operation === 'CONFIRM')!;
    expect(audit.createdAt).toEqual(before.roots[0].confirmedAt);
    await db.healthcareCase.update({
      where: { id: f.parent.id },
      data: {
        status: 'CANCELLED',
        cancelledById: f.actor.id,
        cancelledAt: new Date(),
        cancellationReason: 'Replay fixture',
      },
    });
    await db.product.update({
      where: { id: f.material.id },
      data: { isActive: false, name: 'Changed live name' },
    });
    delete process.env.INVENTORY_RUNTIME_BUILD;
    const s = services();
    const resolve = jest
      .spyOn(s.authority, 'resolve')
      .mockRejectedValue(Error('Must not resolve on replay'));
    const transfer = jest
      .spyOn(s.physical, 'transfer')
      .mockRejectedValue(Error('Must not mutate on replay'));
    const replay = await confirm(f, s);
    expect(replay).toEqual({ ...result, replay: true });
    expect((await state(f)).effects).toEqual(before.effects);
    expect((await state(f)).custody).toEqual(before.custody);
    expect(resolve).not.toHaveBeenCalled();
    expect(transfer).not.toHaveBeenCalled();
  });
  it('24 same key with another expectedRevision rejects before live gates', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY');
    await confirm(f);
    const before = await state(f);
    await expect(
      services().confirm.execute(f.c, { expectedRevision: f.revision + 1 }),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(await state(f)).toEqual(before);
  });
  it.each(['LEGACY', 'CUTOVER'] as const)(
    '25/26 ACTIVE material rejects %s with zero physical writes',
    async (authority) => {
      const f = await fixture('MIXED', authority),
        before = await state(f);
      await expect(confirm(f)).rejects.toMatchObject({
        response: {
          code:
            authority === 'LEGACY'
              ? 'PHYSICAL_AUTHORITY_REQUIRED'
              : 'CUTOVER_FROZEN',
        },
      });
      expect(await state(f)).toEqual(before);
    },
  );
  it.each(['LEGACY', 'CUTOVER'] as const)(
    '28 Equipment-only ignores QUANTITY %s and runtime configuration',
    async (authority) => {
      const f = await fixture('EQUIPMENT', authority);
      delete process.env.INVENTORY_RUNTIME_BUILD;
      const s = services();
      const resolver = jest.spyOn(s.authority, 'resolve');
      await confirm(f, s);
      expect(resolver).not.toHaveBeenCalled();
      await assertConfirmed(f);
      expect(
        await db.inventoryPhysicalEffect.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(0);
    },
  );
  it.each(['missing', 'protocol'] as const)(
    '43 runtime %s fails closed before physical writes',
    async (mode) => {
      const f = await fixture('MATERIAL'),
        before = await state(f);
      if (mode === 'missing') delete process.env.INVENTORY_RUNTIME_ENVIRONMENT;
      else process.env.INVENTORY_AUTHORITY_PROTOCOL = 'incompatible';
      await expect(confirm(f)).rejects.toMatchObject({
        response: {
          code: mode === 'missing' ? 'INCOMPATIBLE_BUILD' : 'STALE_RUNTIME',
        },
      });
      expect(await state(f)).toEqual(before);
    },
  );
  it.each(['LEGACY', 'CUTOVER'] as const)(
    '47/48 EXCLUDED material skips authority and physical validation in %s',
    async (authority) => {
      const f = await fixture('MIXED', authority),
        item = await db.healthcareCaseDispatchItem.findFirstOrThrow({
          where: { dispatchId: f.c.dispatchId, type: 'MATERIAL' },
        });
      await services().draft.execute(
        { ...f.c, itemId: item.id, key: randomUUID() },
        {
          operation: 'ITEM_EXCLUDE',
          dto: { expectedRevision: f.revision, reason: 'Not handed off' },
        },
      );
      f.revision++;
      await db.inventoryPosition.update({
        where: { id: f.position!.id },
        data: { quantity: 0, revision: { increment: 1 } },
      });
      delete process.env.INVENTORY_RUNTIME_BUILD;
      const s = services(),
        spy = jest.spyOn(s.physical, 'transfer');
      const before = await db.inventoryPosition.findMany({
        where: { companyId: f.companyId },
      });
      const result = await confirm(f, s);
      expect(spy).not.toHaveBeenCalled();
      await assertConfirmed(f);
      expect(result.data.items.find((i) => i.id === item.id)).toMatchObject({
        lifecycle: 'EXCLUDED',
        handoff: null,
      });
      expect(
        await db.inventoryPosition.findMany({
          where: { companyId: f.companyId },
        }),
      ).toEqual(before);
    },
  );
  it.each(['LEGACY', 'CUTOVER'] as const)(
    '48 EXCLUDED material alone never activates the QUANTITY gate in %s',
    async (authority) => {
      const f = await fixture('MATERIAL', authority),
        s = services();
      const item = await db.healthcareCaseDispatchItem.findFirstOrThrow({
        where: { dispatchId: f.c.dispatchId },
      });
      await s.draft.execute(
        { ...f.c, itemId: item.id, key: randomUUID() },
        {
          operation: 'ITEM_EXCLUDE',
          dto: { expectedRevision: f.revision, reason: 'No physical handoff' },
        },
      );
      f.revision++;
      delete process.env.INVENTORY_RUNTIME_BUILD;
      const resolve = jest.spyOn(s.authority, 'resolve'),
        transfer = jest.spyOn(s.physical, 'transfer');
      const before = await state(f);
      await expect(confirm(f, s)).rejects.toMatchObject({
        status: 409,
        response: { code: 'CASE_DISPATCH_SOURCE_NOT_VALID' },
      });
      expect(resolve).not.toHaveBeenCalled();
      expect(transfer).not.toHaveBeenCalled();
      expect(await state(f)).toEqual(before);
    },
  );
  it('36 tenant/wrong Case target is uniformly missing', async () => {
    const f = await fixture(),
      foreign = await fixture('EQUIPMENT', 'LEGACY'),
      before = await state(f);
    await expect(
      services().confirm.execute(
        { ...f.c, companyId: foreign.companyId, actorId: foreign.actor.id },
        { expectedRevision: f.revision },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      services().confirm.execute(
        { ...f.c, caseId: foreign.parent.id },
        { expectedRevision: f.revision },
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(await state(f)).toEqual(before);
  });
  it('37 terminal root/items immutable and a new key cannot reconfirm', async () => {
    const f = await fixture();
    await confirm(f);
    const before = await state(f);
    await expect(confirm(f, services(), randomUUID())).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      db.healthcareCaseDispatch.update({
        where: { id: f.c.dispatchId },
        data: { custodianDisplayName: 'Forged' },
      }),
    ).rejects.toThrow();
    await expect(
      db.healthcareCaseDispatchItem.updateMany({
        where: { dispatchId: f.c.dispatchId },
        data: { snapshot: {} },
      }),
    ).rejects.toThrow();
    expect(await state(f)).toEqual(before);
  });
  it('49 Confirm exposes no Return mutation or classification', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY');
    await confirm(f);
    const custody = await db.equipmentAssetCustody.findFirstOrThrow({
      where: { companyId: f.companyId },
    });
    expect(custody.closedAt).toBeNull();
    expect(
      await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: f.companyId, operation: 'CUSTODY_CLOSE' },
      }),
    ).toBe(0);
  });
  it.each([
    'case',
    'schedule',
    'kit',
    'readiness',
    'revision',
    'zero-active',
    'position',
    'balance',
    'batch-expired',
    'batch-inactive',
    'product-inactive',
    'tracking',
    'equipment-revision',
    'equipment-condition',
    'assignment',
    'schedule-conflict',
    'schedule-unverifiable',
  ] as const)('gates reject %s without a partial commit', async (mode) => {
    const f = await fixture('MIXED', 'PHYSICAL', true);
    if (mode === 'case')
      await db.healthcareCase.update({
        where: { id: f.parent.id },
        data: { status: 'DRAFT' },
      });
    if (mode === 'schedule')
      await db.healthcareCase.update({
        where: { id: f.parent.id },
        data: { scheduledStart: null, scheduledEnd: null, status: 'DRAFT' },
      });
    if (mode === 'kit')
      await db.healthcareCaseKit.update({
        where: { id: f.kit.id },
        data: { status: 'DRAFT', preparedById: null, preparedAt: null },
      });
    if (mode === 'readiness')
      await db.healthcareCaseRequirement.update({
        where: { id: f.requirement.id },
        data: { requestedQty: 11 },
      });
    if (mode === 'revision') f.revision--;
    if (mode === 'zero-active') {
      const items = await db.healthcareCaseDispatchItem.findMany({
        where: { dispatchId: f.c.dispatchId },
      });
      for (const item of items) {
        await services().draft.execute(
          { ...f.c, itemId: item.id, key: randomUUID() },
          {
            operation: 'ITEM_EXCLUDE',
            dto: { expectedRevision: f.revision, reason: 'Exclude all' },
          },
        );
        f.revision++;
      }
    }
    if (mode === 'position')
      await db.inventoryPosition.update({
        where: { id: f.position!.id },
        data: { revision: { increment: 1 } },
      });
    if (mode === 'balance')
      await db.inventoryPosition.update({
        where: { id: f.position!.id },
        data: { quantity: 1 },
      });
    if (mode === 'batch-expired')
      await db.inventoryBatch.update({
        where: { id: f.batch!.id },
        data: { expirationDate: new Date('2000-01-01') },
      });
    if (mode === 'batch-inactive')
      await db.inventoryBatch.update({
        where: { id: f.batch!.id },
        data: { isActive: false },
      });
    if (mode === 'product-inactive')
      await db.product.update({
        where: { id: f.material.id },
        data: { isActive: false },
      });
    if (mode === 'tracking')
      await db.product.update({
        where: { id: f.material.id },
        data: { lotTracking: 'NONE' },
      });
    if (mode === 'equipment-revision')
      await db.equipmentAsset.update({
        where: { id: f.asset.id },
        data: { physicalRevision: { increment: 1 } },
      });
    if (mode === 'equipment-condition')
      await db.equipmentAsset.update({
        where: { id: f.asset.id },
        data: { condition: 'DAMAGED' },
      });
    if (mode === 'assignment')
      await services().assignment.release(
        f.companyId,
        f.actor.id,
        f.assignment.id,
        { reason: 'Release before confirm' },
        randomUUID(),
      );
    if (mode === 'schedule-conflict' || mode === 'schedule-unverifiable') {
      const parent = await db.healthcareCase.create({
        data: {
          companyId: f.companyId,
          createdById: f.actor.id,
          folio: randomUUID(),
          title: 'Other reservation',
          ...(mode === 'schedule-conflict'
            ? {
                status: 'SCHEDULED',
                scheduledStart: f.parent.scheduledStart,
                scheduledEnd: f.parent.scheduledEnd,
              }
            : {}),
        },
      });
      await db.healthcareEquipmentAssignment.create({
        data: {
          companyId: f.companyId,
          caseId: parent.id,
          equipmentAssetId: f.asset.id,
          origin: 'DIRECT',
          directAssignmentReason: 'Historical overridden reservation',
          createdById: f.actor.id,
        },
      });
    }
    const before = await state(f);
    await expect(confirm(f)).rejects.toMatchObject({ status: 409 });
    expect(await state(f)).toEqual(before);
  });
  async function another(
    f: F,
    equipment = false,
    position = f.position,
    batchId = f.batch?.id ?? null,
    quantity = 3,
  ) {
    const s = services(),
      created = await s.draft.execute(
        { ...f.c, key: randomUUID() },
        {
          operation: 'CREATE',
          dto: {
            custodian: {
              type: 'EXTERNAL_PERSON',
              displayName: 'Other receiver',
              userId: null,
            },
          },
        },
      );
    const c = { ...f.c, dispatchId: created.data.id, key: randomUUID() };
    await s.draft.execute(
      { ...c, key: randomUUID() },
      equipment
        ? {
            operation: 'ITEM_ADD',
            dto: {
              type: 'EQUIPMENT',
              expectedRevision: 0,
              sourceCaseKitItemId: f.equipmentSource.id,
            },
          }
        : {
            operation: 'ITEM_ADD',
            dto: {
              type: 'MATERIAL',
              expectedRevision: 0,
              sourceCaseKitItemId: f.source.id,
              sourcePositionId: position!.id,
              batchId,
              quantity,
            },
          },
    );
    return { ...f, c, revision: 1 };
  }
  it.each([true, false])(
    '1/2 concurrent Confirm same-key=%s, one physical winner',
    async (sameKey) => {
      const f = await fixture(),
        s = services(one),
        g = gate();
      hold(s, g);
      const results = await race(
        g,
        () => confirm(f, s),
        () => confirm(f, services(two), sameKey ? f.c.key : randomUUID()),
      );
      expect(results[0].status).toBe('fulfilled');
      if (sameKey)
        expect(results[1]).toMatchObject({
          status: 'fulfilled',
          value: { replay: true },
        });
      else
        expect(results[1]).toMatchObject({
          status: 'rejected',
          reason: { status: 409 },
        });
      await assertConfirmed(f);
      expect(
        await db.inventoryPhysicalEffect.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(1);
      expect(
        await db.equipmentAssetCustody.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(1);
      expect(
        await db.idempotencyRecord.count({
          where: {
            companyId: f.companyId,
            scope: 'HEALTHCARE_CASE_DISPATCH_CONFIRM',
          },
        }),
      ).toBe(1);
    },
  );
  it('3 Position revision changes while Confirm waits, no revision refresh', async () => {
    const f = await fixture('MATERIAL'),
      g = gate();
    const first = () =>
      one.$transaction(
        async (tx) => {
          await inventoryAuthorityFence(tx, f.companyId, 'shared');
          await new PhysicalInventoryRepository().lockProducts(
            tx,
            f.companyId,
            [f.material.id],
          );
          await tx.inventoryPosition.update({
            where: { id: f.position!.id },
            data: { quantity: { increment: 1 }, revision: { increment: 1 } },
          });
          await g.pause(tx);
        },
        { timeout: 15000 },
      );
    const results = await race(g, first, () => confirm(f, services(two)));
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { response: { code: 'RESOURCE_STATE_CHANGED' } },
    });
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(0);
  });
  it('4 concurrent material prepared-capacity uses same source UPDATE and separate Positions', async () => {
    const f = await fixture('MATERIAL', 'PHYSICAL', true, 10, 6);
    const batch = await db.inventoryBatch.create({
      data: {
        companyId: f.companyId,
        productId: f.material.id,
        lotNumber: randomUUID(),
        initialQuantity: 20,
        availableQuantity: 20,
        unitCost: 1,
      },
    });
    const position = await db.inventoryPosition.create({
      data: {
        companyId: f.companyId,
        productId: f.material.id,
        inventoryBatchId: batch.id,
        state: 'AVAILABLE',
        quantity: 20,
      },
    });
    const other = await another(f, false, position, batch.id, 6),
      s = services(one),
      g = gate();
    hold(s, g);
    const results = await race(
      g,
      () => confirm(f, s),
      () => confirm(other, services(two)),
    );
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { response: { code: 'CASE_DISPATCH_CAPACITY_EXCEEDED' } },
    });
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });
  it('5 competing source Position balance/revision has one winner', async () => {
    const f = await fixture('MATERIAL', 'PHYSICAL', false, 20, 12),
      other = await another(f, false, f.position, null, 12),
      s = services(one),
      g = gate();
    hold(s, g);
    const results = await race(
      g,
      () => confirm(f, s),
      () => confirm(other, services(two)),
    );
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { status: 409 },
    });
    expect(
      await db.inventoryPosition.findUnique({ where: { id: f.position!.id } }),
    ).toMatchObject({ quantity: 8, revision: 1 });
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });
  it('6 same prepared Equipment source across competing DRAFTs has one custody', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY'),
      other = await another(f, true),
      s = services(one),
      g = gate();
    hold(s, g);
    const results = await race(
      g,
      () => confirm(f, s),
      () => confirm(other, services(two)),
    );
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { status: 409 },
    });
    expect(
      await db.equipmentAssetCustody.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
    expect(
      await db.healthcareCaseDispatch.count({
        where: { companyId: f.companyId, status: 'CONFIRMED' },
      }),
    ).toBe(1);
  });
  it.each([
    'inspection',
    'retirement',
    'release',
    'replace',
    'schedule',
    'kit',
  ] as const)(
    '7-12/41/42 real %s writer waits for Confirm without a cycle',
    async (kind) => {
      const f = await fixture('EQUIPMENT', 'LEGACY'),
        s = services(one),
        contender = services(two),
        g = gate();
      hold(s, g);
      const next = await db.equipmentAsset.create({
        data: {
          companyId: f.companyId,
          productId: f.ep.id,
          assetCode: randomUUID(),
          condition: 'GOOD',
          physicalLocation: 'WAREHOUSE',
        },
      });
      const writer = () => {
        switch (kind) {
          case 'inspection':
            return contender.equipment.createInspection(
              f.companyId,
              f.actor.id,
              f.asset.id,
              { conditionAfter: 'DAMAGED' },
            );
          case 'retirement':
            return contender.equipment.retire(
              f.companyId,
              f.actor.id,
              f.asset.id,
              {
                retiredReason: 'OTHER',
                retirementNotes: 'Synthetic acceptance retirement',
              },
            );
          case 'release':
            return contender.assignment.release(
              f.companyId,
              f.actor.id,
              f.assignment.id,
              { reason: 'Release after handoff' },
              randomUUID(),
            );
          case 'replace':
            return contender.assignment.replace(
              f.companyId,
              f.actor.id,
              f.assignment.id,
              randomUUID(),
              {
                equipmentAssetId: next.id,
                replacementReason: 'Replace after handoff',
              },
            );
          case 'schedule':
            return contender.case.update(f.companyId, f.parent.id, {
              scheduledStart: new Date('2026-11-03T10:00:00Z'),
              scheduledEnd: new Date('2026-11-03T12:00:00Z'),
            });
          case 'kit':
            return contender.kit.confirmPreparation(
              f.companyId,
              f.actor.id,
              f.kit.id,
              randomUUID(),
            );
        }
      };
      const results = await race(g, () => confirm(f, s), writer);
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      const custody = await db.equipmentAssetCustody.findFirstOrThrow({
        where: { companyId: f.companyId },
      });
      expect(custody.closedAt).toBeNull();
      expect(
        await db.healthcareCaseDispatch.count({
          where: { id: f.c.dispatchId, status: 'CONFIRMED' },
        }),
      ).toBe(1);
    },
  );
  it.each(['inspection', 'retirement', 'release', 'replace'] as const)(
    '7-10 reverse %s wins; Confirm revalidates and rejects',
    async (kind) => {
      const f = await fixture('EQUIPMENT', 'LEGACY'),
        s = services(one),
        g = gate();
      const next = await db.equipmentAsset.create({
        data: {
          companyId: f.companyId,
          productId: f.ep.id,
          assetCode: randomUUID(),
          condition: 'GOOD',
          physicalLocation: 'WAREHOUSE',
        },
      });
      if (kind === 'inspection' || kind === 'retirement') {
        const original = (
          ...args: Parameters<
            EquipmentPhysicalRepository['lockAssetForPhysicalMutation']
          >
        ) =>
          new EquipmentPhysicalRepository().lockAssetForPhysicalMutation(
            ...args,
          );
        jest
          .spyOn(s.equipmentRepo, 'lockAssetForPhysicalMutation')
          .mockImplementation(async (...args) => {
            const r = await original(...args);
            await g.pause(args[0]);
            return r;
          });
      } else {
        const original = (
          ...args: Parameters<
            HealthcareEquipmentAssignmentsRepository['lockEquipmentAsset']
          >
        ) =>
          new HealthcareEquipmentAssignmentsRepository(
            one as PrismaService,
          ).lockEquipmentAsset(...args);
        jest
          .spyOn(s.assignments, 'lockEquipmentAsset')
          .mockImplementation(async (...args) => {
            const r = await original(...args);
            await g.pause(args[0]);
            return r;
          });
      }
      const writer = () =>
        kind === 'inspection'
          ? s.equipment.createInspection(f.companyId, f.actor.id, f.asset.id, {
              conditionAfter: 'DAMAGED',
            })
          : kind === 'retirement'
            ? s.equipment.retire(f.companyId, f.actor.id, f.asset.id, {
                retiredReason: 'OTHER',
                retirementNotes: 'Synthetic acceptance retirement',
              })
            : kind === 'release'
              ? s.assignment.release(
                  f.companyId,
                  f.actor.id,
                  f.assignment.id,
                  { reason: 'Release wins' },
                  randomUUID(),
                )
              : s.assignment.replace(
                  f.companyId,
                  f.actor.id,
                  f.assignment.id,
                  randomUUID(),
                  {
                    equipmentAssetId: next.id,
                    replacementReason: 'Replace wins',
                  },
                );
      const results = await race(g, writer, () => confirm(f, services(two)));
      expect(results[0].status).toBe('fulfilled');
      expect(results[1]).toMatchObject({
        status: 'rejected',
        reason: { status: 409 },
      });
      expect(
        await db.equipmentAssetCustody.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(0);
      expect(
        await db.healthcareCaseDispatchAudit.count({
          where: { dispatchId: f.c.dispatchId, operation: 'CONFIRM' },
        }),
      ).toBe(0);
    },
  );
  it.each([
    'claim',
    'audit',
    'first-debit',
    'effect',
    'projection',
    'custody',
    'evidence',
    'snapshot',
    'root',
  ] as const)(
    '16-22 rollback after %s removes every partial physical/business row',
    async (point) => {
      const f = await fixture(),
        before = await state(f),
        s = services();
      const fail = () => {
        throw Error('Deterministic acceptance boundary');
      };
      if (point === 'claim') {
        const original = (
          ...args: Parameters<
            HealthcareCaseDispatchCommandRepository['createClaim']
          >
        ) => services().commands.createClaim(...args);
        jest
          .spyOn(s.commands, 'createClaim')
          .mockImplementation(async (...args) => {
            await original(...args);
            fail();
            return { id: '' };
          });
      } else if (point === 'audit') {
        const original = (
          ...args: Parameters<HealthcareCaseDispatchConfirmRepository['audit']>
        ) => services().repo.audit(...args);
        jest.spyOn(s.repo, 'audit').mockImplementation(async (...args) => {
          const r = await original(...args);
          fail();
          return r;
        });
      } else if (point === 'first-debit') {
        const original = (
          ...args: Parameters<PhysicalInventoryRepository['mutatePosition']>
        ) => new PhysicalInventoryRepository().mutatePosition(...args);
        jest
          .spyOn(s.physicalRepo, 'mutatePosition')
          .mockImplementation(async (...args) => {
            const r = await original(...args);
            fail();
            return r;
          });
      } else if (point === 'effect') {
        const original = (
          ...args: Parameters<PhysicalInventoryRepository['claimEffect']>
        ) => new PhysicalInventoryRepository().claimEffect(...args);
        jest
          .spyOn(s.physicalRepo, 'claimEffect')
          .mockImplementation(async (...args) => {
            const r = await original(...args);
            fail();
            return r;
          });
      } else if (point === 'projection') {
        jest
          .spyOn(s.projections, 'apply')
          .mockImplementation(async (...args) => {
            await new InventoryCompatibilityProjectionService().apply(...args);
            fail();
          });
      } else if (point === 'custody') {
        const original = (
          ...args: Parameters<EquipmentCustodyService['transferToCustody']>
        ) => services().custody.transferToCustody(...args);
        jest
          .spyOn(s.custody, 'transferToCustody')
          .mockImplementation(async (...args) => {
            const r = await original(...args);
            fail();
            return r;
          });
      } else if (point === 'evidence') {
        const original = (
          ...args: Parameters<
            HealthcareCaseDispatchConfirmRepository['itemEvidence']
          >
        ) => services().repo.itemEvidence(...args);
        jest
          .spyOn(s.repo, 'itemEvidence')
          .mockImplementation(async (...args) => {
            const r = await original(...args);
            fail();
            return r;
          });
      } else if (point === 'snapshot') {
        const original = (
          ...args: Parameters<
            HealthcareCaseDispatchConfirmRepository['itemSnapshot']
          >
        ) => services().repo.itemSnapshot(...args);
        jest
          .spyOn(s.repo, 'itemSnapshot')
          .mockImplementation(async (...args) => {
            const r = await original(...args);
            fail();
            return r;
          });
      } else {
        const original = (
          ...args: Parameters<
            HealthcareCaseDispatchConfirmRepository['finalize']
          >
        ) => services().repo.finalize(...args);
        jest.spyOn(s.repo, 'finalize').mockImplementation(async (...args) => {
          const r = await original(...args);
          fail();
          return r;
        });
      }
      await expect(confirm(f, s)).rejects.toThrow();
      expect(await state(f)).toEqual(before);
    },
  );
  it('29 one prepared material source, distinct real batches/Positions, one Effect and exact per-item destinations', async () => {
    const f = await fixture('MATERIAL', 'PHYSICAL', true);
    const batch = await db.inventoryBatch.create({
      data: {
        companyId: f.companyId,
        productId: f.material.id,
        lotNumber: randomUUID(),
        initialQuantity: 7,
        availableQuantity: 7,
        unitCost: 1,
        expirationDate: new Date('2028-01-01'),
      },
    });
    const position = await db.inventoryPosition.create({
      data: {
        companyId: f.companyId,
        productId: f.material.id,
        inventoryBatchId: batch.id,
        state: 'AVAILABLE',
        quantity: 7,
      },
    });
    await db.product.update({
      where: { id: f.material.id },
      data: { stock: 27 },
    });
    await services().draft.execute(
      { ...f.c, key: randomUUID() },
      {
        operation: 'ITEM_ADD',
        dto: {
          type: 'MATERIAL',
          expectedRevision: f.revision,
          sourceCaseKitItemId: f.source.id,
          sourcePositionId: position.id,
          batchId: batch.id,
          quantity: 4,
        },
      },
    );
    f.revision++;
    await confirm(f);
    await assertConfirmed(f);
    const items = await db.healthcareCaseDispatchItem.findMany({
      where: { dispatchId: f.c.dispatchId },
    });
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.physicalEffectId)).size).toBe(1);
    expect(new Set(items.map((i) => i.destinationPositionId)).size).toBe(2);
    expect(
      await db.inventoryPosition.findUnique({ where: { id: f.position!.id } }),
    ).toMatchObject({ quantity: 17, revision: 1 });
    expect(
      await db.inventoryPosition.findUnique({ where: { id: position.id } }),
    ).toMatchObject({ quantity: 3, revision: 1 });
    expect(
      await db.inventoryBatch.findUnique({ where: { id: f.batch!.id } }),
    ).toMatchObject({ availableQuantity: 17 });
    expect(
      await db.inventoryBatch.findUnique({ where: { id: batch.id } }),
    ).toMatchObject({ availableQuantity: 3 });
    expect(
      await db.product.findUnique({ where: { id: f.material.id } }),
    ).toMatchObject({ stock: 27 });
  });
  it('29 negative: normal Draft command rejects a duplicate prepared source/Position without writes', async () => {
    const f = await fixture('MATERIAL'),
      before = await state(f);
    await expect(
      services().draft.execute(
        { ...f.c, key: randomUUID() },
        {
          operation: 'ITEM_ADD',
          dto: {
            type: 'MATERIAL',
            expectedRevision: f.revision,
            sourceCaseKitItemId: f.source.id,
            sourcePositionId: f.position!.id,
            batchId: null,
            quantity: 1,
          },
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await state(f)).toEqual(before);
  });
  it('30 multiple Equipment opens custody in deterministic Asset order', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY', false, 10, 3, 3),
      s = services();
    const transfer = jest.spyOn(s.custody, 'transferToCustody');
    await confirm(f, s);
    await assertConfirmed(f);
    expect(transfer.mock.calls.map((call) => call[1].assetId)).toEqual(
      f.equipmentSources.map((i) => i.asset.id).sort(),
    );
  });
  it.each([false, true])(
    '44 authority fence serializes cutover, cutover-first=%s',
    async (cutoverFirst) => {
      const f = await fixture('MATERIAL'),
        g = gate(),
        s = services(one);
      const transition = (client: PrismaClient, pause: boolean) =>
        client.$transaction(
          async (tx) => {
            await inventoryAuthorityFence(tx, f.companyId, 'exclusive');
            await tx.inventoryCutover.update({
              where: { companyId: f.companyId },
              data: {
                status: 'RECOVERY_REQUIRED',
                recoveryFromStatus: 'PHYSICAL_ACTIVE',
                revision: { increment: 1 },
              },
            });
            if (pause) await g.pause(tx);
          },
          { timeout: 15000 },
        );
      if (cutoverFirst) {
        const results = await race(
          g,
          () => transition(one, true),
          () => confirm(f, services(two)),
        );
        expect(results[0].status).toBe('fulfilled');
        expect(results[1]).toMatchObject({
          status: 'rejected',
          reason: { status: 503, response: { code: 'RECOVERY_REQUIRED' } },
        });
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId: f.companyId },
          }),
        ).toBe(0);
      } else {
        hold(s, g);
        const results = await race(
          g,
          () => confirm(f, s),
          () => transition(two, false),
        );
        expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
        await assertConfirmed(f);
      }
    },
  );
  it.each([
    'missing-proof',
    'wrong-context',
    'wrong-actor',
    'wrong-revision',
  ] as const)('46 forged Equipment %s cannot open custody', async (variant) => {
    const f = await fixture('EQUIPMENT', 'LEGACY'),
      before = await state(f),
      s = services();
    let admitted = false;
    const open = jest.spyOn(s.equipmentRepo, 'openCustody');
    const item = await db.healthcareCaseDispatchItem.findFirstOrThrow({
      where: { dispatchId: f.c.dispatchId },
    });
    await expect(
      db.$transaction(async (tx) => {
        await acquireHealthcareCompanyLock(tx, f.companyId, {
          acquisitionTimeoutMs: 5000,
        });
        if (variant !== 'missing-proof') {
          await s.commands.createClaim(
            f.c,
            'HEALTHCARE_CASE_DISPATCH_CONFIRM',
            createDispatchConfirmRequestHash(f.c, f.revision),
            tx,
          );
          await s.repo.audit(tx, f.c, f.revision);
        }
        const result = await s.custody.transferToCustody(tx, {
          companyId: f.companyId,
          assetId: f.asset.id,
          caseId: f.parent.id,
          assignmentId: f.assignment.id,
          actorId: variant === 'wrong-actor' ? randomUUID() : f.actor.id,
          expectedPhysicalRevision: variant === 'wrong-revision' ? 1 : 0,
          validatedContext: {
            adapterKey: 'CASE_DISPATCH_ITEM',
            contextId: variant === 'wrong-context' ? randomUUID() : item.id,
          },
          durableOrigin: {
            type: 'CASE_DISPATCH_ITEM',
            id: item.id,
            operation: 'CONFIRM_EQUIPMENT',
          },
        });
        admitted = true;
        return result;
      }),
    ).rejects.toBeDefined();
    expect(admitted).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(await state(f)).toEqual(before);
  });
  it.each(['Sales', 'Receipt'] as const)(
    '39/40 %s writer shares Product locks and preserves compatibility projection',
    async (kind) => {
      const f = await fixture('MATERIAL'),
        s = services(one),
        other = services(two),
        g = gate();
      let writer: () => Promise<unknown>;
      if (kind === 'Sales') {
        const customer = await db.customer.create({
          data: { companyId: f.companyId, name: 'Synthetic acceptance' },
        });
        const sale = await db.sale.create({
          data: {
            companyId: f.companyId,
            customerId: customer.id,
            folio: randomUUID(),
            subtotal: 2,
            iva: 0,
            total: 2,
            items: {
              create: [
                {
                  productId: f.material.id,
                  quantity: 2,
                  price: 1,
                  subtotal: 2,
                },
              ],
            },
          },
        });
        const sales = new SalesPhysicalIntegrationService(
          two as PrismaService,
          {} as never,
          new SalesPhysicalSourceResolver(other.physicalRepo),
          other.physical,
          other.projections,
          new InventoryCompatibilityHistoryService(),
          other.authorityTx,
        );
        writer = () => sales.approve(f.companyId, f.actor.id, sale.id);
      } else {
        const supplier = await db.supplier.create({
          data: { companyId: f.companyId, name: 'Synthetic acceptance' },
        });
        const purchase = await db.purchase.create({
          data: {
            companyId: f.companyId,
            supplierId: supplier.id,
            folio: randomUUID(),
            status: 'CONFIRMED',
            subtotal: 2,
            iva: 0,
            total: 2,
            items: {
              create: [
                {
                  productId: f.material.id,
                  quantity: 2,
                  price: 1,
                  subtotal: 2,
                },
              ],
            },
          },
          include: { items: true },
        });
        const receipt = new ReceiptPhysicalIntegrationService(
          other.physicalRepo,
          other.physical,
          other.projections,
          new InventoryCompatibilityHistoryService(),
          new EquipmentProvisioningService({} as never),
        );
        writer = () =>
          other.authorityTx.run(f.companyId, (tx) =>
            receipt.execute(tx, f.companyId, f.actor.id, randomUUID(), {
              purchaseId: purchase.id,
              items: [
                { purchaseItemId: purchase.items[0].id, quantityReceived: 2 },
              ],
            }),
          );
      }
      hold(s, g);
      const results = await race(g, () => confirm(f, s), writer);
      expect(results).toEqual([
        expect.objectContaining({ status: 'fulfilled' }),
        expect.objectContaining({ status: 'fulfilled' }),
      ]);
      await assertConfirmed(f);
      expect(
        await db.product.findUnique({ where: { id: f.material.id } }),
      ).toMatchObject({ stock: kind === 'Sales' ? 18 : 22 });
      expect(
        await db.inventoryPosition.findUnique({
          where: { id: f.position!.id },
        }),
      ).toMatchObject({ quantity: kind === 'Sales' ? 15 : 19, revision: 2 });
    },
  );
  it.each([1000, 1001])(
    '45 %i distinct material Positions preserve Confirm boundary',
    async (count) => {
      const fixtureAt = performance.now();
      const f = await fixture('MATERIAL', 'PHYSICAL', true, 1010, 1);
      const batches = Array.from({ length: count - 1 }, () => ({
        id: randomUUID(),
        companyId: f.companyId,
        productId: f.material.id,
        lotNumber: randomUUID(),
        initialQuantity: 1,
        availableQuantity: 1,
        unitCost: 1,
        expirationDate: new Date('2028-01-01'),
      }));
      await db.inventoryBatch.createMany({ data: batches });
      const positions = batches.map((batch) => ({
        id: randomUUID(),
        companyId: f.companyId,
        productId: f.material.id,
        inventoryBatchId: batch.id,
        state: 'AVAILABLE' as const,
        quantity: 1,
      }));
      await db.inventoryPosition.createMany({ data: positions });
      await db.healthcareCaseDispatchItem.createMany({
        data: positions.map((p) => ({
          companyId: f.companyId,
          caseId: f.parent.id,
          caseKitId: f.kit.id,
          dispatchId: f.c.dispatchId,
          sourceCaseKitItemId: f.source.id,
          type: 'MATERIAL',
          productId: f.material.id,
          addedById: f.actor.id,
          quantity: 1,
          batchId: p.inventoryBatchId,
          sourcePositionId: p.id,
          expectedPositionRevision: 0,
        })),
      });
      const before = await state(f),
        s = services();
      if (count === 1000) {
        const phases: Record<string, { calls: number; ms: number }> = {};
        async function measured<T>(
          name: string,
          action: () => Promise<T>,
        ): Promise<T> {
          const at = performance.now();
          try {
            return await action();
          } finally {
            const phase = phases[name] ?? { calls: 0, ms: 0 };
            phase.calls++;
            phase.ms += performance.now() - at;
            phases[name] = phase;
          }
        }
        const original_physicalTransfer = Reflect.get(s.physical, 'transfer');
        jest
          .spyOn(s.physical, 'transfer')
          .mockImplementation((...args) =>
            measured('physicalTransfer', () =>
              Reflect.apply(original_physicalTransfer, s.physical, args),
            ),
          );
        const original_projections = Reflect.get(s.projections, 'apply');
        jest
          .spyOn(s.projections, 'apply')
          .mockImplementation((...args) =>
            measured('projections', () =>
              Reflect.apply(original_projections, s.projections, args),
            ),
          );
        const original_materialConsumed = Reflect.get(
          s.repo,
          'materialConsumed',
        );
        jest
          .spyOn(s.repo, 'materialConsumed')
          .mockImplementation((...args) =>
            measured('materialConsumed', () =>
              Reflect.apply(original_materialConsumed, s.repo, args),
            ),
          );
        const original_itemEvidence = Reflect.get(s.repo, 'itemEvidence');
        jest
          .spyOn(s.repo, 'itemEvidence')
          .mockImplementation((...args) =>
            measured('itemEvidence', () =>
              Reflect.apply(original_itemEvidence, s.repo, args),
            ),
          );
        const original_itemSnapshot = Reflect.get(s.repo, 'itemSnapshot');
        jest
          .spyOn(s.repo, 'itemSnapshot')
          .mockImplementation((...args) =>
            measured('itemSnapshot', () =>
              Reflect.apply(original_itemSnapshot, s.repo, args),
            ),
          );
        const original_lockPhysical = Reflect.get(s.repo, 'lockPhysical');
        jest
          .spyOn(s.repo, 'lockPhysical')
          .mockImplementation((...args) =>
            measured('lockPhysical', () =>
              Reflect.apply(original_lockPhysical, s.repo, args),
            ),
          );
        // Prisma fluent read clients are kept intact; historical read timings
        // remain recorded in deferred-validation-results.md.
        const originalRun = Reflect.get(s.commands, 'runInTransaction');
        jest
          .spyOn(s.commands, 'runInTransaction')
          .mockImplementation((action, p) =>
            Reflect.apply(originalRun, s.commands, [
              async (tx: Prisma.TransactionClient) => {
                const observed = new Proxy(tx, {
                  get(target, key, receiver) {
                    if (key === '$executeRawUnsafe')
                      return (sql: string, ...values: unknown[]) =>
                        measured(sql, () =>
                          target.$executeRawUnsafe(sql, ...values),
                        );
                    return Reflect.get(target, key, receiver) as unknown;
                  },
                });
                return action(observed);
              },
              p,
            ]),
          );
        const confirmAt = performance.now();
        try {
          await confirm(f, s);
        } catch (error) {
          console.log(
            'HC-RR-PERF-02 baseline (throughput NOT CERTIFIED) production Confirm failure ' +
              JSON.stringify({
                n: count,
                elapsedMs: performance.now() - confirmAt,
                phases,
              }),
          );
          throw error;
        }
        const confirmMs = performance.now() - confirmAt;
        console.log(
          'HC-RR-PERF-02 baseline (throughput NOT CERTIFIED) production Confirm ' +
            JSON.stringify({
              n: count,
              confirmMs,
              phases,
              fixtureAndConfirmMs: performance.now() - fixtureAt,
            }),
        );
        const root = await db.healthcareCaseDispatch.findUniqueOrThrow({
          where: { id: f.c.dispatchId },
          include: { items: true },
        });
        expect(root.status).toBe('CONFIRMED');
        expect(
          root.items.every(
            (i) => i.snapshot !== null && i.destinationPositionId !== null,
          ),
        ).toBe(true);
        const effects = await db.inventoryPhysicalEffect.findMany({
          where: { companyId: f.companyId, originId: root.id },
          include: { lines: true },
        });
        expect(effects).toHaveLength(1);
        expect(effects[0].lines).toHaveLength(2000);
        const lineByPosition = new Map(
          effects[0].lines.map((l) => [l.positionId, l]),
        );
        for (const item of root.items)
          expect(lineByPosition.get(item.destinationPositionId!)?.delta).toBe(
            item.quantity,
          );
        expect((await confirm(f, s)).replay).toBe(true);
        expect(
          await db.inventoryPhysicalEffectLine.count({
            where: { effectId: effects[0].id },
          }),
        ).toBe(2000);
        expect(
          await db.healthcareCaseDispatchItem.count({
            where: {
              dispatchId: f.c.dispatchId,
              physicalEffectId: { not: null },
            },
          }),
        ).toBe(1000);
        // Final acceptance delta supersedes the PERF-01 single-run <10s assertion.
        // Keep real Confirm semantics above; writer p95 <=15s with zero failures
        // remains an unimplemented PERF-02 acceptance gate (not certified here).
        return;
      }
      const transfer = jest.spyOn(s.physical, 'transfer'),
        audit = jest.spyOn(s.repo, 'audit');
      await expect(confirm(f, s)).rejects.toMatchObject({ status: 409 });
      expect(transfer).not.toHaveBeenCalled();
      expect(audit).not.toHaveBeenCalled();
      expect(await state(f)).toEqual(before);
    },
  );
  it('38 deferred database invariant rejects terminal transition with missing item evidence/audit at commit', async () => {
    const f = await fixture('MATERIAL'),
      before = await state(f);
    let reachedCommit = false;
    await expect(
      db.$transaction(async (tx) => {
        const root = await services().repo.root(tx, f.c);
        const snapshot = {
          version: 1,
          case: {
            id: f.parent.id,
            folio: f.parent.folio,
            scheduledStart: f.parent.scheduledStart!.toISOString(),
            scheduledEnd: f.parent.scheduledEnd!.toISOString(),
          },
          custodian: {
            type: root!.custodianType,
            userId: null,
            displayName: root!.custodianDisplayName,
          },
          dispatchedBy: {
            id: f.actor.id,
            firstName: f.actor.firstName,
            lastName: f.actor.lastName,
          },
          dispatchedAt: new Date().toISOString(),
        };
        await services().repo.finalize(
          tx,
          f.c,
          f.revision,
          new Date(snapshot.dispatchedAt),
          snapshot,
        );
        reachedCommit = true;
      }),
    ).rejects.toBeDefined();
    expect(reachedCommit).toBe(true);
    expect(await state(f)).toEqual(before);
  });
  it('16 Quantity succeeds internally then Equipment fails: projection/effect/audit all roll back', async () => {
    const f = await fixture(),
      before = await state(f),
      s = services();
    const transfer = jest.spyOn(s.physical, 'transfer');
    jest
      .spyOn(s.custody, 'transferToCustody')
      .mockRejectedValue(Error('Injected custody failure'));
    await expect(confirm(f, s)).rejects.toThrow();
    expect(transfer).toHaveBeenCalledTimes(1);
    expect(await state(f)).toEqual(before);
  });
});
