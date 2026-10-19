import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, EquipmentCondition } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { HealthcareCaseReconciliationConfirmService } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-confirm.service';
import {
  HealthcareCaseReconciliationConfirmRepository,
  ReconciliationConfirmContext,
} from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-confirm.repository';
import { HealthcareCaseReconciliationCommandRepository } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-command.repository';
import { HealthcareCaseReconciliationsRepository } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliations.repository';
import { HealthcareCaseReconciliationEquipmentContextAdapter } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-equipment-context.adapter';
import { HealthcareCaseReconciliationEquipmentEvidenceRepository } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-equipment-evidence.repository';
import { EquipmentCustodyCloseContextRegistry } from '../src/equipment/equipment-custody-close-context.registry';
import { EquipmentCustodyCloseService } from '../src/equipment/equipment-custody-close.service';
import { EquipmentPhysicalRepository } from '../src/equipment/equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from '../src/equipment/equipment-physical-history.service';
import { EquipmentService } from '../src/equipment/equipment.service';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../src/inventory/physical/inventory-compatibility-projection.service';
import { InventoryRuntimeCompatibilityService } from '../src/inventory/physical/inventory-runtime-compatibility.service';
import { InventoryAuthorityResolver } from '../src/inventory/physical/inventory-authority-resolver';
import { inventoryAuthorityFence } from '../src/inventory/physical/inventory-authority-fence';
import { acquireHealthcareCompanyLock } from '../src/healthcare/common/healthcare-company-lock';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import { deriveReconciliationSummary } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-summary';
import { EquipmentCustodyCloseCommand } from '../src/equipment/equipment-custody-close.contract';
import { InventoryAuthorityTransactionService } from '../src/inventory/physical/inventory-authority-transaction.service';
import { InventoryCompatibilityHistoryService } from '../src/inventory/physical/inventory-compatibility-history.service';
import { SalesPhysicalIntegrationService } from '../src/inventory/physical/sales-physical-integration.service';
import { SalesPhysicalSourceResolver } from '../src/inventory/physical/sales-physical-source-resolver';
import { ReceiptPhysicalIntegrationService } from '../src/inventory/physical/receipt-physical-integration.service';
import { EquipmentProvisioningService } from '../src/equipment/equipment-provisioning.service';

jest.setTimeout(660000);
const suite =
  process.env.RUN_CASE_RECONCILIATION_CONFIRM_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('HC-RR-01D isolated PostgreSQL16 atomic Confirm acceptance', () => {
  let db: PrismaClient, one: PrismaClient, two: PrismaClient;
  type Metrics = {
    phase: string;
    counts: Record<string, number>;
    phases: Record<string, { calls: number; ms: number }>;
    statements: string[];
    completed: string[];
    rollback: boolean;
    callbackReturned: boolean;
    callbackMs: number;
    transactionMs: number;
    settings?: { statement: string; lock: string };
    cause?: { code?: string; sqlstate?: string; message?: string };
    failingOperation?: string;
    lastSql: string[];
  };
  let activeMetrics: Metrics | undefined;
  const keys = [
    'INVENTORY_RUNTIME_BUILD',
    'INVENTORY_RUNTIME_ENVIRONMENT',
    'INVENTORY_AUTHORITY_PROTOCOL',
  ] as const;
  const saved = keys.map((k) => process.env[k]);
  const policy = healthcareCompanyTransactionTimeoutConfiguration();
  const diagnostic = process.env.CASE_RECONCILIATION_FIXTURE_DIAGNOSTIC === '1';
  beforeAll(async () => {
    const url = new URL(
      process.env.CASE_RECONCILIATION_CONFIRM_TEST_DATABASE_URL!,
    );
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_case_reconciliation_confirm_test' ||
      url.username !== 'case_reconciliation_confirm_test' ||
      !process.env.CASE_RECONCILIATION_CONFIRM_TEST_RUN
    )
      throw new Error('Unverified isolated target');
    const client = (name: string) => {
      const u = new URL(url);
      u.searchParams.set('application_name', name);
      const instance = new PrismaClient({
        datasources: { db: { url: u.toString() } },
        log: [{ emit: 'event', level: 'query' }],
      });
      instance.$on('query', (event) => {
        const m = activeMetrics;
        if (!m) return;
        m.counts[m.phase] = (m.counts[m.phase] ?? 0) + 1;
        m.rollback ||= /^\s*ROLLBACK/i.test(event.query);
        m.lastSql.push(event.query.replace(/\s+/g, ' ').slice(0, 180));
        if (m.lastSql.length > 8) m.lastSql.shift();
      });
      return instance;
    };
    db = client('rr-observer');
    one = client('rr-a');
    two = client('rr-b');
    await Promise.all([db.$connect(), one.$connect(), two.$connect()]);
    const [role] = await db.$queryRaw<
      {
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        version: string;
      }[]
    >`SELECT rolsuper,rolcreatedb,rolcreaterole,current_setting('server_version') AS version FROM pg_roles WHERE rolname=current_user`;
    expect(role).toMatchObject({
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });
    expect(role.version).toMatch(/^16\./);
  });
  beforeEach(() => {
    process.env.INVENTORY_RUNTIME_BUILD = 'rr-confirm-test';
    process.env.INVENTORY_RUNTIME_ENVIRONMENT = 'isolated';
    process.env.INVENTORY_AUTHORITY_PROTOCOL = 'inventory-authority-v1';
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    try {
      if (db) {
        const [s] = await db.$queryRaw<
          { deadlocks: bigint }[]
        >`SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()`;
        expect(Number(s.deadlocks)).toBe(0);
      }
    } finally {
      await Promise.all([
        db?.$disconnect(),
        one?.$disconnect(),
        two?.$disconnect(),
      ]);
      keys.forEach((k, i) => {
        if (saved[i] === undefined) delete process.env[k];
        else process.env[k] = saved[i];
      });
    }
  });
  function services(client = db) {
    const reads = new HealthcareCaseReconciliationsRepository(
        client as PrismaService,
      ),
      commands = new HealthcareCaseReconciliationCommandRepository(
        client as PrismaService,
        reads,
      ),
      physicalRepo = new PhysicalInventoryRepository(),
      physical = new PhysicalInventoryService(physicalRepo),
      projections = new InventoryCompatibilityProjectionService(),
      repo = new HealthcareCaseReconciliationConfirmRepository(
        commands,
        physicalRepo,
      ),
      equipmentRepo = new EquipmentPhysicalRepository(),
      history = new EquipmentPhysicalHistoryService(equipmentRepo),
      evidence = new HealthcareCaseReconciliationEquipmentEvidenceRepository(),
      adapter = new HealthcareCaseReconciliationEquipmentContextAdapter(
        evidence,
      ),
      close = new EquipmentCustodyCloseService(
        equipmentRepo,
        history,
        new EquipmentCustodyCloseContextRegistry([adapter]),
      ),
      authority = new InventoryAuthorityResolver(),
      runtime = new InventoryRuntimeCompatibilityService();
    return {
      repo,
      commands,
      reads,
      physicalRepo,
      physical,
      projections,
      equipmentRepo,
      history,
      evidence,
      adapter,
      close,
      authority,
      runtime,
      confirm: new HealthcareCaseReconciliationConfirmService(
        repo,
        physical,
        projections,
        close,
        authority,
        runtime,
        policy,
      ),
      equipment: new EquipmentService(
        client as PrismaService,
        {} as never,
        equipmentRepo,
        history,
        policy,
      ),
    };
  }
  function observe(s: ReturnType<typeof services>, cancelFirstFlush = false) {
    const m: Metrics = {
      phase: 'other',
      counts: {},
      phases: {},
      statements: [],
      completed: [],
      rollback: false,
      callbackReturned: false,
      callbackMs: 0,
      transactionMs: 0,
      lastSql: [],
    };
    const cause = (error: unknown) => {
      if (!m.cause && error && typeof error === 'object') {
        const e = error as {
          code?: string;
          meta?: { code?: string; error?: string; message?: string };
          message?: string;
        };
        m.cause = {
          code: e.code,
          sqlstate: e.meta?.code,
          message: (e.meta?.error ?? e.meta?.message ?? e.message)
            ?.replace(/postgres(?:ql)?:\/\/\S+/g, '[URL]')
            .slice(0, 600),
        };
      }
    };
    async function measure<T>(
      name: string,
      action: () => Promise<T>,
    ): Promise<T> {
      const previous = m.phase;
      m.phase = name;
      const at = performance.now();
      try {
        return await action();
      } catch (e) {
        m.failingOperation ??= name;
        cause(e);
        throw e;
      } finally {
        const phase = m.phases[name] ?? { calls: 0, ms: 0 };
        phase.calls++;
        phase.ms += performance.now() - at;
        m.phases[name] = phase;
        m.phase = previous;
      }
    }
    function instrument(object: object, key: string, name: string) {
      const original = Reflect.get(object, key) as (
        ...args: unknown[]
      ) => Promise<unknown>;
      jest
        .spyOn(
          object as Record<string, (...args: unknown[]) => Promise<unknown>>,
          key,
        )
        .mockImplementation((...args) =>
          measure(name, () => Reflect.apply(original, object, args)),
        );
    }
    instrument(s.physical, 'transfer', 'physical.returned');
    instrument(s.physical, 'definitiveOut', 'physical.used');
    instrument(s.projections, 'apply', 'projection');
    instrument(s.repo, 'itemEvidence', 'evidence');
    instrument(s.repo, 'itemSnapshot', 'snapshot');
    instrument(s.repo, 'sources', 'sources');
    instrument(s.repo, 'finalize', 'rootCAS');
    instrument(s.commands, 'completeClaim', 'completeClaim');
    instrument(s.confirm, 'validate', 'validation');
    const original = s.commands.runInTransaction.bind(
      s.commands,
    ) as HealthcareCaseReconciliationCommandRepository['runInTransaction'];
    jest
      .spyOn(s.commands, 'runInTransaction')
      .mockImplementation(async (action, p) => {
        expect(p).toMatchObject({
          companyLockAcquisitionTimeoutMs: 2500,
          subsequentLockTimeoutMs: 1500,
          subsequentStatementTimeoutMs: 4000,
          prismaMaxWaitMs: 3000,
          prismaTransactionTimeoutMs: 20000,
        });
        const transactionAt = performance.now();
        try {
          return await original(async (tx: Prisma.TransactionClient) => {
            const callbackAt = performance.now();
            const wrapped = new Proxy(tx, {
              get(target, key, receiver) {
                if (key === '$executeRawUnsafe')
                  return async (sql: string, ...values: unknown[]) => {
                    if (!sql.startsWith('SET CONSTRAINTS '))
                      return target.$executeRawUnsafe(sql, ...values);
                    const name = 'constraints.' + m.statements.length;
                    m.statements.push(sql);
                    return measure(name, async () => {
                      if (!m.settings)
                        m.settings = (
                          await target.$queryRaw<
                            { statement: string; lock: string }[]
                          >`SELECT current_setting('statement_timeout') AS statement,current_setting('lock_timeout') AS lock`
                        )[0];
                      if (cancelFirstFlush)
                        await target.$executeRawUnsafe('SELECT pg_sleep(5)');
                      const result = await target.$executeRawUnsafe(
                        sql,
                        ...values,
                      );
                      m.completed.push(sql);
                      return result;
                    });
                  };
                return Reflect.get(target, key, receiver) as unknown;
              },
            });
            try {
              const result = await action(wrapped);
              m.callbackReturned = true;
              return result;
            } catch (e) {
              cause(e);
              throw e;
            } finally {
              m.callbackMs = performance.now() - callbackAt;
            }
          }, p);
        } catch (e) {
          cause(e);
          throw e;
        } finally {
          m.transactionMs = performance.now() - transactionAt;
        }
      });
    activeMetrics = m;
    return {
      metrics: m,
      stop: () => {
        activeMetrics = undefined;
      },
      report: (label: string) =>
        console.log(
          'HC-RR-01D integration ' +
            JSON.stringify({
              label,
              ...m,
              sqlCommands: Object.values(m.counts).reduce((a, b) => a + b, 0),
            }),
        ),
    };
  }
  // Structural source Dispatch/warehouse fixtures; only the operation under test
  // executes productive Reconciliation Confirm and the productive close adapter.
  async function fixture(
    kind: 'MATERIAL' | 'EQUIPMENT' | 'MIXED' = 'MATERIAL',
    authority: 'PHYSICAL' | 'LEGACY' | 'CUTOVER' | 'RECOVERY' = 'PHYSICAL',
    batched = false,
    count = 1,
  ) {
    const companyId = (
      await db.company.create({
        data: { name: 'RR Confirm isolated', rfc: randomUUID() },
      })
    ).id;
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
        title: 'Return after planning changes',
      },
    });
    const kit = await db.healthcareCaseKit.create({
      data: { companyId, caseId: parent.id, createdById: actor.id },
    });
    if (authority !== 'LEGACY')
      await db.inventoryCutover.create({
        data:
          authority === 'PHYSICAL'
            ? {
                companyId,
                initiatedBy: actor.id,
                status: 'PHYSICAL_ACTIVE',
                revision: 6,
                manifestDigest: 'a'.repeat(64),
                snapshotFingerprint: 'b'.repeat(64),
                baselineBuild: 'isolated-rr',
                approvedBy: actor.id,
                manifestLockedAt: new Date(),
                activatedBy: actor.id,
                activatedAt: new Date(),
              }
            : authority === 'RECOVERY'
              ? {
                  companyId,
                  initiatedBy: actor.id,
                  status: 'RECOVERY_REQUIRED',
                  recoveryFromStatus: 'PRECHECK',
                }
              : { companyId, initiatedBy: actor.id },
      });
    const dispatch = await db.healthcareCaseDispatch.create({
      data: {
        companyId,
        caseId: parent.id,
        caseKitId: kit.id,
        createdById: actor.id,
        custodianType: 'EXTERNAL_PERSON',
        custodianDisplayName: 'Receiver',
      },
    });
    const materials: {
      id: string;
      productId: string;
      batchId: string | null;
      sourcePositionId: string;
      destinationPositionId: string;
    }[] = [];
    const equipment: {
      id: string;
      assetId: string;
      custodyId: string;
      assignmentId: string;
    }[] = [];
    const started = Date.now();
    const stage = (name: string) => {
      if (count >= 1000)
        console.log(
          `Fixture ${count}: ${name}; elapsed=${Date.now() - started}ms`,
        );
    };
    stage('Dispatch transaction starting');
    await db.$transaction(
      async (tx) => {
        if (diagnostic)
          await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '60000ms'");
        // Setup only: avoid repeatedly compiling the deferred provenance scan.
        // All constraints remain enabled and are evaluated before this fixture commits.
        if (count >= 1000 && !diagnostic)
          await tx.$executeRawUnsafe('SET LOCAL jit = off');
        if (count >= 1000)
          console.log(
            'Fixture settings',
            await tx.$queryRaw`SELECT pg_backend_pid() AS pid,current_setting('statement_timeout') AS statement_timeout,current_setting('lock_timeout') AS lock_timeout`,
          );
        if (kind !== 'EQUIPMENT') {
          const effectId = randomUUID();
          const rows = Array.from({ length: count }, () => ({
            id: randomUUID(),
            productId: randomUUID(),
            requirementId: randomUUID(),
            kitItemId: randomUUID(),
            sourcePositionId: randomUUID(),
            destinationPositionId: randomUUID(),
            batchId: batched ? randomUUID() : null,
          }));
          await tx.product.createMany({
            data: rows.map((r) => ({
              id: r.productId,
              companyId,
              sku: r.productId,
              name: 'Historical Material',
              stock: 10,
              inventoryTracking: 'QUANTITY',
              lotTracking: batched ? 'OPTIONAL' : 'NONE',
            })),
          });
          if (batched)
            await tx.inventoryBatch.createMany({
              data: rows.map((r) => ({
                id: r.batchId!,
                companyId,
                productId: r.productId,
                lotNumber: r.batchId!,
                initialQuantity: 10,
                availableQuantity: 0,
                unitCost: 1,
                expirationDate: new Date('2028-01-01'),
              })),
            });
          await tx.healthcareCaseRequirement.createMany({
            data: rows.map((r) => ({
              id: r.requirementId,
              companyId,
              caseId: parent.id,
              productId: r.productId,
              requestedQty: 10,
              type: 'REQUIRED',
              sortOrder: 0,
              createdById: actor.id,
            })),
          });
          await tx.healthcareCaseKitItem.createMany({
            data: rows.map((r) => ({
              id: r.kitItemId,
              companyId,
              caseId: parent.id,
              caseKitId: kit.id,
              requirementId: r.requirementId,
              preparedQuantity: 10,
              addedById: actor.id,
            })),
          });
          await tx.inventoryPosition.createMany({
            data: rows.flatMap((r) => [
              {
                id: r.sourcePositionId,
                companyId,
                productId: r.productId,
                inventoryBatchId: r.batchId,
                state: 'AVAILABLE' as const,
                quantity: 0,
                revision: 1,
                contextType: null,
                contextId: null,
              },
              {
                id: r.destinationPositionId,
                companyId,
                productId: r.productId,
                inventoryBatchId: r.batchId,
                state: 'CUSTODY' as const,
                quantity: 10,
                revision: 1,
                contextType: 'CASE_DISPATCH_ITEM',
                contextId: r.id,
              },
            ]),
          });
          await tx.inventoryPhysicalEffect.create({
            data: {
              id: effectId,
              companyId,
              originType: 'CASE_DISPATCH',
              originId: dispatch.id,
              originOperation: 'CONFIRM_QUANTITY',
              kind: 'TRANSFER',
              requestHash: 'a'.repeat(64),
              lineCount: rows.length * 2,
              actorId: actor.id,
            },
          });
          await tx.inventoryPhysicalEffectLine.createMany({
            data: rows.flatMap((r, n) => [
              {
                companyId,
                effectId,
                positionId: r.sourcePositionId,
                sequence: n * 2 + 1,
                delta: -10,
                quantityBefore: 10,
                quantityAfter: 0,
                revisionBefore: 0,
                revisionAfter: 1,
              },
              {
                companyId,
                effectId,
                positionId: r.destinationPositionId,
                sequence: n * 2 + 2,
                delta: 10,
                quantityBefore: 0,
                quantityAfter: 10,
                revisionBefore: 0,
                revisionAfter: 1,
              },
            ]),
          });
          await tx.healthcareCaseDispatchItem.createMany({
            data: rows.map((r) => ({
              id: r.id,
              companyId,
              caseId: parent.id,
              caseKitId: kit.id,
              dispatchId: dispatch.id,
              sourceCaseKitItemId: r.kitItemId,
              type: 'MATERIAL',
              productId: r.productId,
              batchId: r.batchId,
              quantity: 10,
              sourcePositionId: r.sourcePositionId,
              expectedPositionRevision: 0,
              destinationPositionId: r.destinationPositionId,
              physicalEffectId: effectId,
              addedById: actor.id,
              snapshot: {
                version: 1,
                product: {
                  id: r.productId,
                  sku: r.productId,
                  name: 'Historical Material',
                  inventoryTracking: 'QUANTITY',
                  lotTracking: batched ? 'OPTIONAL' : 'NONE',
                },
                preparation: {
                  sourceCaseKitItemId: r.kitItemId,
                  requirementId: r.requirementId,
                  assignmentId: null,
                  preparedQuantity: 10,
                },
                batch: r.batchId
                  ? {
                      id: r.batchId,
                      lotNumber: r.batchId,
                      expirationDate: '2028-01-01T00:00:00.000Z',
                    }
                  : null,
                equipment: null,
              },
            })),
          });
          materials.push(...rows);
        }
        if (kind !== 'MATERIAL')
          for (let n = 0; n < count; n++) {
            const product = await tx.product.create({
              data: {
                companyId,
                sku: randomUUID(),
                name: 'Historical Equipment',
                inventoryTracking: 'ASSET',
              },
            });
            const asset = await tx.equipmentAsset.create({
              data: {
                companyId,
                productId: product.id,
                assetCode: randomUUID(),
                condition: 'GOOD',
                physicalLocation: 'WAREHOUSE',
              },
            });
            const assignment = await tx.healthcareEquipmentAssignment.create({
              data: {
                companyId,
                caseId: parent.id,
                equipmentAssetId: asset.id,
                origin: 'DIRECT',
                directAssignmentReason: 'Fixture',
                createdById: actor.id,
              },
            });
            const source = await tx.healthcareCaseKitItem.create({
              data: {
                companyId,
                caseId: parent.id,
                caseKitId: kit.id,
                equipmentAssignmentId: assignment.id,
                addedById: actor.id,
              },
            });
            const id = randomUUID();
            const custody = await tx.equipmentAssetCustody.create({
              data: {
                companyId,
                equipmentAssetId: asset.id,
                caseId: parent.id,
                assignmentId: assignment.id,
                openedById: actor.id,
              },
            });
            await tx.equipmentAsset.update({
              where: { id: asset.id },
              data: {
                physicalLocation: 'CUSTODY',
                activeCustodyId: custody.id,
                physicalRevision: 1,
              },
            });
            const event = await tx.equipmentAssetPhysicalEvent.create({
              data: {
                companyId,
                equipmentAssetId: asset.id,
                custodyId: custody.id,
                operation: 'CUSTODY_OPEN',
                originType: 'CASE_DISPATCH_ITEM',
                originId: id,
                originOperation: 'CONFIRM_EQUIPMENT',
                requestHash: 'a'.repeat(64),
                physicalLocationBefore: 'WAREHOUSE',
                physicalLocationAfter: 'CUSTODY',
                conditionBefore: 'GOOD',
                conditionAfter: 'GOOD',
                lifecycleBefore: 'ACTIVE',
                lifecycleAfter: 'ACTIVE',
                revisionBefore: 0,
                revisionAfter: 1,
                actorId: actor.id,
                reasonCode: 'FIXTURE',
              },
            });
            await tx.healthcareCaseDispatchItem.create({
              data: {
                id,
                companyId,
                caseId: parent.id,
                caseKitId: kit.id,
                dispatchId: dispatch.id,
                sourceCaseKitItemId: source.id,
                type: 'EQUIPMENT',
                productId: product.id,
                assetId: asset.id,
                assignmentId: assignment.id,
                expectedPhysicalRevision: 0,
                equipmentCustodyId: custody.id,
                equipmentPhysicalEventId: event.id,
                addedById: actor.id,
                snapshot: {
                  version: 1,
                  product: {
                    id: product.id,
                    sku: product.sku,
                    name: product.name,
                    inventoryTracking: 'ASSET',
                    lotTracking: product.lotTracking,
                  },
                  preparation: {
                    sourceCaseKitItemId: source.id,
                    requirementId: null,
                    assignmentId: assignment.id,
                    preparedQuantity: null,
                  },
                  batch: null,
                  equipment: {
                    id: asset.id,
                    assetCode: asset.assetCode,
                    serialNumber: null,
                  },
                },
              },
            });
            equipment.push({
              id,
              assetId: asset.id,
              custodyId: custody.id,
              assignmentId: assignment.id,
            });
          }
        const [clock] = await tx.$queryRaw<
          { at: Date }[]
        >`SELECT transaction_timestamp()::timestamp(3) AS at`;
        await tx.healthcareCaseDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: 'CONFIRMED',
            revision: 1,
            confirmedFromRevision: 0,
            confirmedById: actor.id,
            confirmedAt: clock.at,
            snapshotVersion: 1,
            snapshot: {
              version: 1,
              case: {
                id: parent.id,
                folio: parent.folio,
                scheduledStart: null,
                scheduledEnd: null,
              },
              custodian: {
                type: 'EXTERNAL_PERSON',
                userId: null,
                displayName: 'Receiver',
              },
              dispatchedBy: {
                id: actor.id,
                firstName: actor.firstName,
                lastName: actor.lastName,
              },
              dispatchedAt: clock.at.toISOString(),
            },
          },
        });
        await tx.healthcareCaseDispatchAudit.create({
          data: {
            companyId,
            dispatchId: dispatch.id,
            operation: 'CONFIRM',
            actorId: actor.id,
            revisionBefore: 0,
            revisionAfter: 1,
            createdAt: clock.at,
            change: { version: 1, operation: 'CONFIRM', reason: null },
          },
        });
        stage('rows inserted; evaluating deferred constraints');
        if (count >= 1000 && !diagnostic) {
          await tx.$executeRawUnsafe(
            'ANALYZE "HealthcareCaseDispatchItem", "InventoryPhysicalEffectLine", "InventoryPosition"',
          );
          await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
          stage('deferred constraints complete');
        }
      },
      { timeout: count >= 1000 && !diagnostic ? 600000 : 180000 },
    );
    stage('COMMIT completed');
    return {
      companyId,
      actorId: actor.id,
      caseId: parent.id,
      kitId: kit.id,
      dispatchId: dispatch.id,
      materials,
      equipment,
    };
  }
  type F = Awaited<ReturnType<typeof fixture>>;
  async function episode(
    f: F,
    returnedQty = 0,
    usedQty = 0,
    outcome: 'RETURNED' | 'UNRESOLVED' = 'UNRESOLVED',
    reportedCondition: EquipmentCondition = 'GOOD',
  ) {
    const root = await db.healthcareCaseReconciliation.create({
      data: {
        companyId: f.companyId,
        caseId: f.caseId,
        caseKitId: f.kitId,
        dispatchId: f.dispatchId,
        createdById: f.actorId,
        observation: 'Pending disposition observed',
      },
    });
    const positions = await db.inventoryPosition.findMany({
      where: { id: { in: f.materials.map((m) => m.destinationPositionId) } },
    });
    const assets = await db.equipmentAsset.findMany({
      where: { id: { in: f.equipment.map((e) => e.assetId) } },
    });
    await db.$transaction(
      async (tx) => {
        if (f.materials.length)
          await tx.healthcareCaseReconciliationItem.createMany({
            data: f.materials.map((m) => ({
              companyId: f.companyId,
              caseId: f.caseId,
              dispatchId: f.dispatchId,
              reconciliationId: root.id,
              sourceDispatchItemId: m.id,
              createdById: f.actorId,
              type: 'MATERIAL',
              sourceCustodyPositionId: m.destinationPositionId,
              expectedSourceRevision: positions.find(
                (p) => p.id === m.destinationPositionId,
              )!.revision,
              returnedQty,
              usedQty,
            })),
          });
        for (const e of f.equipment)
          await tx.healthcareCaseReconciliationItem.create({
            data: {
              companyId: f.companyId,
              caseId: f.caseId,
              dispatchId: f.dispatchId,
              reconciliationId: root.id,
              sourceDispatchItemId: e.id,
              createdById: f.actorId,
              type: 'EQUIPMENT',
              equipmentCustodyId: e.custodyId,
              assetId: e.assetId,
              assignmentId: e.assignmentId,
              expectedPhysicalRevision: assets.find((a) => a.id === e.assetId)!
                .physicalRevision,
              outcome,
              reportedCondition:
                outcome === 'RETURNED' ? reportedCondition : null,
            },
          });
      },
      { timeout: 180000 },
    );
    return {
      companyId: f.companyId,
      caseId: f.caseId,
      actorId: f.actorId,
      reconciliationId: root.id,
      key: randomUUID(),
    } satisfies ReconciliationConfirmContext;
  }
  const confirm = (
    c: ReconciliationConfirmContext,
    s = services(),
    revision = 0,
  ) => s.confirm.execute(c, { expectedRevision: revision });
  async function snapshot(f: F) {
    return JSON.stringify({
      roots: await db.healthcareCaseReconciliation.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      items: await db.healthcareCaseReconciliationItem.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      audit: await db.healthcareCaseReconciliationAudit.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      claims: await db.idempotencyRecord.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      positions: await db.inventoryPosition.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      effects: await db.inventoryPhysicalEffect.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      lines: await db.inventoryPhysicalEffectLine.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      products: await db.product.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      batches: await db.inventoryBatch.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      assets: await db.equipmentAsset.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      custodies: await db.equipmentAssetCustody.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      events: await db.equipmentAssetPhysicalEvent.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
    });
  }
  const summary = async (f: F) =>
    db.$transaction(async (tx) =>
      deriveReconciliationSummary(
        f.dispatchId,
        await services().repo.sources(
          tx,
          { ...f, reconciliationId: 'unused', key: '' },
          f.dispatchId,
        ),
      ),
    );
  function signal<T = void>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }
  async function race<A, B>(
    first: (client: PrismaClient) => Promise<A>,
    second: (client: PrismaClient) => Promise<B>,
  ) {
    const held = signal<number>(),
      waiting = signal<number>(),
      release = signal();
    const wrap = (base: PrismaClient, hold: boolean) =>
      new Proxy(base, {
        get(obj, key) {
          if (key === '$transaction')
            return (
              cb: (tx: Prisma.TransactionClient) => Promise<unknown>,
              options: {
                isolationLevel?: Prisma.TransactionIsolationLevel;
                maxWait?: number;
                timeout?: number;
              },
            ) =>
              obj.$transaction(async (tx) => {
                if (options?.isolationLevel === 'RepeatableRead') return cb(tx);
                const [pid] = await tx.$queryRaw<
                  { pid: number }[]
                >`SELECT pg_backend_pid() AS pid`;
                if (!hold) waiting.resolve(pid.pid);
                const result = await cb(tx);
                if (hold) {
                  held.resolve(pid.pid);
                  await release.promise;
                }
                return result;
              }, options);
          const value: unknown = Reflect.get(obj, key);
          return typeof value === 'function'
            ? (value.bind(obj) as unknown)
            : value;
        },
      });
    const a = first(wrap(one, true)),
      safeA = a.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
    const firstPid = await Promise.race([
      held.promise,
      a.then(() => {
        throw new Error('Missing held transaction');
      }),
    ]);
    const b = second(wrap(two, false)),
      safeB = b.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
    try {
      const secondPid = await waiting.promise;
      expect(firstPid).not.toBe(secondPid);
      let observed = false;
      const until = Date.now() + 5000;
      while (Date.now() < until) {
        const [r] = await db.$queryRaw<
          { blocked: boolean }[]
        >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=${secondPid} AND wait_event_type='Lock' AND ${firstPid}::int=ANY(pg_blocking_pids(pid))) AS blocked`;
        if (r.blocked) {
          observed = true;
          break;
        }
        await new Promise<void>((r) => setImmediate(r));
      }
      expect(observed).toBe(true);
    } finally {
      release.resolve();
    }
    return [await safeA, await safeB] as const;
  }
  it('1 same-key concurrent Confirm executes once and replays', async () => {
    const f = await fixture(),
      c = await episode(f, 3);
    const [a, b] = await race(
      (client) => confirm(c, services(client)),
      (client) => confirm(c, services(client)),
    );
    expect(a).toHaveProperty('value.replay', false);
    expect(b).toHaveProperty('value.replay', true);
    expect(
      await db.healthcareCaseReconciliationAudit.count({
        where: { reconciliationId: c.reconciliationId, operation: 'CONFIRM' },
      }),
    ).toBe(1);
  });
  it('2 different-key same revision has one terminal winner', async () => {
    const f = await fixture(),
      c = await episode(f, 3);
    const [a, b] = await race(
      (client) => confirm(c, services(client)),
      (client) => confirm({ ...c, key: randomUUID() }, services(client)),
    );
    expect(a).toHaveProperty('value');
    expect(b).toHaveProperty('error');
  });
  it('3 lost response replay has zero writes', async () => {
    const f = await fixture(),
      c = await episode(f, 3),
      r = await confirm(c),
      before = await snapshot(f);
    expect(await confirm(c)).toEqual({ ...r, replay: true });
    expect(await snapshot(f)).toBe(before);
  });
  it('4 same-key hash mismatch rejects', async () => {
    const f = await fixture(),
      c = await episode(f, 3);
    await confirm(c);
    await expect(confirm(c, services(), 1)).rejects.toHaveProperty(
      'response.code',
      'IDEMPOTENCY_KEY_REUSED',
    );
  });
  it('5 stale root revision rejects atomically', async () => {
    const f = await fixture(),
      c = await episode(f, 3),
      before = await snapshot(f);
    await expect(confirm(c, services(), 1)).rejects.toHaveProperty(
      'response.code',
      'RESOURCE_STATE_CHANGED',
    );
    expect(await snapshot(f)).toBe(before);
  });
  it.each([
    [3, 0],
    [0, 3],
    [3, 2],
  ] as const)('6-8 Material returned=%s used=%s', async (r, u) => {
    const f = await fixture(),
      c = await episode(f, r, u),
      result = await confirm(c);
    expect(result.data.status).toBe('CONFIRMED');
    const i = result.data.items[0];
    expect(i.expectedSourceRevision).toBe(1);
    expect(i.snapshot?.result).toMatchObject({
      returnedQty: r,
      usedQty: u,
      unresolvedBefore: 10,
      unresolvedAfter: 10 - r - u,
    });
    expect(
      (
        await db.inventoryPosition.findUniqueOrThrow({
          where: { id: f.materials[0].destinationPositionId },
        })
      ).quantity,
    ).toBe(10 - r - u);
    expect(
      (
        await db.product.findUniqueOrThrow({
          where: { id: f.materials[0].productId },
        })
      ).stock,
    ).toBe(10 - u);
  });
  it('9 multiple Material items use grouped effects', async () => {
    const f = await fixture('MATERIAL', 'PHYSICAL', false, 3),
      c = await episode(f, 2, 1),
      r = await confirm(c);
    expect(
      new Set(r.data.items.map((i) => i.returnedPhysicalEffectId)).size,
    ).toBe(1);
    expect(new Set(r.data.items.map((i) => i.usedPhysicalEffectId)).size).toBe(
      1,
    );
  });
  it('10 partial reconciliation derives PARTIALLY_RECONCILED', async () => {
    const f = await fixture();
    await confirm(await episode(f, 3, 1));
    expect(await summary(f)).toHaveProperty('status', 'PARTIALLY_RECONCILED');
  });
  it('11 second partial episode uses current revision', async () => {
    const f = await fixture();
    await confirm(await episode(f, 3, 1));
    await confirm(await episode(f, 2, 1));
    expect((await summary(f)).items[0]).toMatchObject({
      confirmedReturnedQty: 5,
      confirmedUsedQty: 2,
      unresolvedQty: 3,
    });
  });
  it('12 cumulative capacity exact resolves source', async () => {
    const f = await fixture();
    await confirm(await episode(f, 3, 1));
    await confirm(await episode(f, 6));
    expect(await summary(f)).toHaveProperty('status', 'FULLY_RECONCILED');
  });
  it('13 over-capacity rejects without writes', async () => {
    const f = await fixture();
    await confirm(await episode(f, 4));
    const c = await episode(f, 7),
      before = await snapshot(f);
    await expect(confirm(c)).rejects.toHaveProperty(
      'response.code',
      'CASE_RECONCILIATION_CAPACITY_EXCEEDED',
    );
    expect(await snapshot(f)).toBe(before);
  });
  it('14 concurrent capacity 10-4 vs two candidates of 6 cannot exceed 10', async () => {
    const f = await fixture();
    await confirm(await episode(f, 4));
    const a = await episode(f, 6),
      b = await episode(f, 6);
    const result = await race(
      (client) => confirm(a, services(client)),
      (client) => confirm(b, services(client)),
    );
    expect(result[0]).toHaveProperty('value');
    expect(result[1]).toHaveProperty(
      'error.response.code',
      'CASE_RECONCILIATION_CAPACITY_EXCEEDED',
    );
    expect(await summary(f)).toHaveProperty('status', 'FULLY_RECONCILED');
  });
  it.each([true, false])(
    '15-16 original batch/null preserved: %s',
    async (batched) => {
      const f = await fixture('MATERIAL', 'PHYSICAL', batched),
        c = await episode(f, 3),
        r = await confirm(c);
      const dest = await db.inventoryPosition.findUniqueOrThrow({
        where: { id: r.data.items[0].returnedDestinationPositionId! },
      });
      expect(dest.inventoryBatchId).toBe(f.materials[0].batchId);
      expect(dest).toMatchObject({
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
      });
    },
  );
  it.each(['product', 'batch', 'expired'] as const)(
    '17 restock fails closed for %s',
    async (kind) => {
      const f = await fixture('MATERIAL', 'PHYSICAL', true),
        c = await episode(f, 3);
      if (kind === 'product')
        await db.product.update({
          where: { id: f.materials[0].productId },
          data: { isActive: false },
        });
      else
        await db.inventoryBatch.update({
          where: { id: f.materials[0].batchId! },
          data:
            kind === 'expired'
              ? { expirationDate: new Date('2020-01-01') }
              : { isActive: false },
        });
      const before = await snapshot(f);
      await expect(confirm(c)).rejects.toHaveProperty(
        'response.code',
        'PHYSICAL_SOURCE_NOT_ELIGIBLE',
      );
      expect(await snapshot(f)).toBe(before);
    },
  );
  it('18 returned leaves Product.stock unchanged', async () => {
    const f = await fixture();
    await confirm(await episode(f, 4));
    expect(
      (
        await db.product.findUniqueOrThrow({
          where: { id: f.materials[0].productId },
        })
      ).stock,
    ).toBe(10);
  });
  it('19 used decreases Product.stock exactly once even after retry', async () => {
    const f = await fixture(),
      c = await episode(f, 0, 4);
    await confirm(c);
    await confirm(c);
    expect(
      (
        await db.product.findUniqueOrThrow({
          where: { id: f.materials[0].productId },
        })
      ).stock,
    ).toBe(6);
  });
  it('20 returned increases Batch.available exactly', async () => {
    const f = await fixture('MATERIAL', 'PHYSICAL', true);
    await confirm(await episode(f, 4));
    expect(
      (
        await db.inventoryBatch.findUniqueOrThrow({
          where: { id: f.materials[0].batchId! },
        })
      ).availableQuantity,
    ).toBe(4);
  });
  it('21 used does not debit AVAILABLE Batch and permits inactive/expired batch', async () => {
    const f = await fixture('MATERIAL', 'PHYSICAL', true);
    await db.inventoryBatch.update({
      where: { id: f.materials[0].batchId! },
      data: { isActive: false, expirationDate: new Date('2020-01-01') },
    });
    await confirm(await episode(f, 0, 4));
    expect(
      (
        await db.inventoryBatch.findUniqueOrThrow({
          where: { id: f.materials[0].batchId! },
        })
      ).availableQuantity,
    ).toBe(0);
  });
  it.each(['GOOD', 'INSPECTION_PENDING', 'DAMAGED', 'OUT_OF_SERVICE'] as const)(
    '22-25 Equipment %s returns via productive adapter',
    async (condition) => {
      const f = await fixture('EQUIPMENT'),
        c = await episode(f, 0, 0, 'RETURNED', condition),
        r = await confirm(c);
      expect(r.data.items[0].snapshot?.result).toMatchObject({
        type: 'EQUIPMENT',
        before: { location: 'CUSTODY', revision: 1 },
        after: { location: 'WAREHOUSE', revision: 2, condition },
      });
      expect(
        await db.equipmentAssetPhysicalEvent.count({
          where: { companyId: f.companyId, operation: 'CUSTODY_CLOSE' },
        }),
      ).toBe(1);
      expect(
        await db.equipmentInspection.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(0);
    },
  );
  it('26 RETIRED Assets are prelocked and returned without lifecycle change', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY', false, 2),
      s = services();
    for (const e of f.equipment)
      await s.equipment.retire(f.companyId, f.actorId, e.assetId, {
        retiredReason: 'END_OF_LIFE',
      });
    const c = await episode(f, 0, 0, 'RETURNED'),
      r = await confirm(c);
    expect(r.data.items).toHaveLength(2);
    for (const i of r.data.items)
      expect(i.snapshot?.result).toMatchObject({
        before: { lifecycle: 'RETIRED' },
        after: { lifecycle: 'RETIRED', location: 'WAREHOUSE' },
      });
  });
  it('27 Equipment UNRESOLVED remains open with no physical writes', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY'),
      c = await episode(f),
      r = await confirm(c);
    expect(r.data.items[0].closePhysicalEventId).toBeNull();
    expect(
      (
        await db.equipmentAsset.findUniqueOrThrow({
          where: { id: f.equipment[0].assetId },
        })
      ).physicalRevision,
    ).toBe(1);
    expect(await summary(f)).toHaveProperty('status', 'UNRECONCILED');
  });
  it('28 concurrent different episodes cannot double return custody', async () => {
    const f = await fixture('EQUIPMENT'),
      a = await episode(f, 0, 0, 'RETURNED'),
      b = await episode(f, 0, 0, 'RETURNED');
    const r = await race(
      (client) => confirm(a, services(client)),
      (client) => confirm(b, services(client)),
    );
    expect(r[0]).toHaveProperty('value');
    expect(r[1]).toHaveProperty(
      'error.code',
      'EQUIPMENT_CUSTODY_ALREADY_CLOSED',
    );
    expect(
      await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: f.companyId, operation: 'CUSTODY_CLOSE' },
      }),
    ).toBe(1);
  });
  it('29 Equipment lost-response replay survives later physical state', async () => {
    const f = await fixture('EQUIPMENT'),
      c = await episode(f, 0, 0, 'RETURNED'),
      r = await confirm(c);
    await services().equipment.createInspection(
      f.companyId,
      f.actorId,
      f.equipment[0].assetId,
      { conditionAfter: 'DAMAGED' },
    );
    const before = await snapshot(f);
    expect(await confirm(c)).toEqual({ ...r, replay: true });
    expect(await snapshot(f)).toBe(before);
  });
  it.each(['PHYSICAL', 'LEGACY', 'CUTOVER', 'RECOVERY'] as const)(
    '30-32 Material authority %s',
    async (mode) => {
      const f = await fixture('MATERIAL', mode),
        c = await episode(f, 2);
      if (mode === 'PHYSICAL')
        expect(await confirm(c)).toHaveProperty('data.status', 'CONFIRMED');
      else
        await expect(confirm(c)).rejects.toHaveProperty(
          'code',
          mode === 'LEGACY'
            ? 'PHYSICAL_AUTHORITY_REQUIRED'
            : mode === 'CUTOVER'
              ? 'CUTOVER_FROZEN'
              : 'RECOVERY_REQUIRED',
        );
    },
  );
  it('33 Equipment-only under LEGACY bypasses QUANTITY runtime', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY');
    delete process.env.INVENTORY_RUNTIME_BUILD;
    expect(await confirm(await episode(f, 0, 0, 'RETURNED'))).toHaveProperty(
      'data.status',
      'CONFIRMED',
    );
  });
  it('34 pure Material observational under LEGACY bypasses QUANTITY runtime', async () => {
    const f = await fixture('MATERIAL', 'LEGACY');
    delete process.env.INVENTORY_AUTHORITY_PROTOCOL;
    const c = await episode(f);
    await confirm(c);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { originId: c.reconciliationId },
      }),
    ).toBe(0);
  });
  it('35 mixed succeeds atomically', async () => {
    const f = await fixture('MIXED'),
      r = await confirm(await episode(f, 2, 3, 'RETURNED', 'DAMAGED'));
    expect(r.data.snapshot?.episodeFacts).toEqual({
      materialItemCount: 1,
      equipmentItemCount: 1,
      hasPhysicalMutation: true,
    });
    expect(
      r.data.items.every(
        (i) => !!(i.returnedPhysicalEffectId || i.closePhysicalEventId),
      ),
    ).toBe(true);
  });
  it.each([
    'equipment',
    'late',
    'returned',
    'returnedProjection',
    'used',
    'usedProjection',
    'close',
    'evidence',
    'snapshots',
    'terminal',
    'audit',
  ] as const)(
    '36-44 rollback after %s leaves zero committed partial state',
    async (stage) => {
      const f = await fixture('MIXED'),
        c = await episode(f, 2, 3, 'RETURNED'),
        before = await snapshot(f),
        s = services(),
        base = services();
      const fail = () => {
        throw new Error('Test-only failure after ' + stage);
      };
      if (stage === 'equipment')
        jest
          .spyOn(s.close, 'returnFromCustody')
          .mockImplementation(() =>
            Promise.reject(new Error('Test equipment failure')),
          );
      if (stage === 'close')
        jest
          .spyOn(s.close, 'returnFromCustody')
          .mockImplementation(
            async (
              ...args: Parameters<
                EquipmentCustodyCloseService['returnFromCustody']
              >
            ) => {
              await base.close.returnFromCustody(...args);
              return fail();
            },
          );
      if (stage === 'returned')
        jest
          .spyOn(s.physical, 'transfer')
          .mockImplementation(
            async (
              ...args: Parameters<PhysicalInventoryService['transfer']>
            ) => {
              await base.physical.transfer(...args);
              return fail();
            },
          );
      if (stage === 'used')
        jest
          .spyOn(s.physical, 'definitiveOut')
          .mockImplementation(
            async (
              ...args: Parameters<PhysicalInventoryService['definitiveOut']>
            ) => {
              await base.physical.definitiveOut(...args);
              return fail();
            },
          );
      if (stage === 'returnedProjection' || stage === 'usedProjection')
        jest
          .spyOn(s.projections, 'apply')
          .mockImplementation(
            async (
              ...args: Parameters<
                InventoryCompatibilityProjectionService['apply']
              >
            ) => {
              await base.projections.apply(...args);
              if (
                (stage === 'returnedProjection' &&
                  args[2].effect.kind === 'TRANSFER') ||
                (stage === 'usedProjection' &&
                  args[2].effect.kind === 'DEFINITIVE_OUT')
              )
                fail();
            },
          );
      if (stage === 'audit')
        jest
          .spyOn(s.repo, 'audit')
          .mockImplementation(
            async (
              ...args: Parameters<
                HealthcareCaseReconciliationConfirmRepository['audit']
              >
            ) => {
              await base.repo.audit(...args);
              return fail();
            },
          );
      if (stage === 'evidence')
        jest
          .spyOn(s.repo, 'itemEvidence')
          .mockImplementation(
            async (
              ...args: Parameters<
                HealthcareCaseReconciliationConfirmRepository['itemEvidence']
              >
            ) => {
              await base.repo.itemEvidence(...args);
              return fail();
            },
          );
      if (stage === 'snapshots')
        jest
          .spyOn(s.repo, 'itemSnapshot')
          .mockImplementation(
            async (
              ...args: Parameters<
                HealthcareCaseReconciliationConfirmRepository['itemSnapshot']
              >
            ) => {
              await base.repo.itemSnapshot(...args);
              return fail();
            },
          );
      if (stage === 'terminal' || stage === 'late')
        jest
          .spyOn(s.repo, 'finalize')
          .mockImplementation(
            async (
              ...args: Parameters<
                HealthcareCaseReconciliationConfirmRepository['finalize']
              >
            ) => {
              await base.repo.finalize(...args);
              return fail();
            },
          );
      await expect(confirm(c, s)).rejects.toThrow();
      expect(await snapshot(f)).toBe(before);
    },
  );
  it.each(['inspection', 'retirement'] as const)(
    '45-46 %s wins: stale Confirm rolls back',
    async (op) => {
      const f = await fixture('EQUIPMENT'),
        c = await episode(f, 0, 0, 'RETURNED');
      const r = await race(
        async (client) => {
          await (op === 'inspection'
            ? services(client).equipment.createInspection(
                f.companyId,
                f.actorId,
                f.equipment[0].assetId,
                { conditionAfter: 'DAMAGED' },
              )
            : services(client).equipment.retire(
                f.companyId,
                f.actorId,
                f.equipment[0].assetId,
                { retiredReason: 'END_OF_LIFE' },
              ));
        },
        (client) => confirm(c, services(client)),
      );
      expect(r[0]).toHaveProperty('value');
      expect(r[1]).toHaveProperty(
        'error.response.code',
        'RESOURCE_STATE_CHANGED',
      );
    },
  );
  it('47 same custody winner leaves only one close under concurrent mixed episodes', async () => {
    const f = await fixture('MIXED'),
      a = await episode(f, 2, 1, 'RETURNED'),
      b = await episode(f, 2, 1, 'RETURNED');
    const r = await race(
      (client) => confirm(a, services(client)),
      (client) => confirm(b, services(client)),
    );
    expect(r[0]).toHaveProperty('value');
    expect(r[1]).toHaveProperty('error');
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId, originType: 'CASE_RECONCILIATION' },
      }),
    ).toBe(2);
  });
  async function physicalWriter(
    client: PrismaClient,
    f: F,
    kind: 'SALE' | 'RECEIPT' | 'COUNT',
  ) {
    return client.$transaction(
      async (tx) => {
        await inventoryAuthorityFence(tx, f.companyId, 'shared');
        const s = services(client);
        await s.physicalRepo.lockProducts(tx, f.companyId, [
          f.materials[0].productId,
        ]);
        const p = await tx.inventoryPosition.findUniqueOrThrow({
          where: { id: f.materials[0].sourcePositionId },
        });
        const command = {
          companyId: f.companyId,
          actorId: f.actorId,
          origin: {
            type: 'ISOLATED_' + kind,
            id: randomUUID(),
            operation: kind,
          },
        };
        const result =
          kind === 'RECEIPT'
            ? await s.physical.creditAvailable(tx, command, [
                {
                  quantity: 1,
                  target: {
                    productId: p.productId,
                    inventoryBatchId: p.inventoryBatchId,
                    state: 'AVAILABLE',
                    contextType: null,
                    contextId: null,
                  },
                },
              ])
            : kind === 'COUNT'
              ? await s.physical.countCorrection(
                  tx,
                  { ...command, reason: 'Isolated count' },
                  {
                    sourceId: p.id,
                    expectedRevision: p.revision,
                    countedQuantity: p.quantity,
                  },
                )
              : await s.physical.definitiveOut(tx, command, [
                  {
                    sourceId: p.id,
                    quantity: 1,
                    expectedSourceRevision: p.revision,
                  },
                ]);
        await s.projections.apply(tx, f.companyId, result);
        return result;
      },
      { isolationLevel: 'ReadCommitted', timeout: 180000 },
    );
  }
  it.each(['SALE', 'RECEIPT', 'COUNT'] as const)(
    '48-49 compatible %s physical writer serializes on Product/Position',
    async (kind) => {
      const f = await fixture(),
        c = await episode(f, 2);
      const r = await race(
        (client) => confirm(c, services(client)),
        (client) => physicalWriter(client, f, kind),
      );
      expect(r[0]).toHaveProperty('value');
      expect(r[1]).toHaveProperty('value');
    },
  );
  it.each(['SALE', 'RECEIPT'] as const)(
    'actual %s integration writer is compatible with Confirm',
    async (kind) => {
      const f = await fixture(),
        c = await episode(f, 2);
      let writer: (client: PrismaClient) => Promise<unknown>;
      if (kind === 'SALE') {
        const customer = await db.customer.create({
          data: { companyId: f.companyId, name: 'Acceptance' },
        });
        const sale = await db.sale.create({
          data: {
            companyId: f.companyId,
            customerId: customer.id,
            folio: randomUUID(),
            subtotal: 1,
            iva: 0,
            total: 1,
            items: {
              create: [
                {
                  productId: f.materials[0].productId,
                  quantity: 1,
                  price: 1,
                  subtotal: 1,
                },
              ],
            },
          },
        });
        writer = (client) => {
          const s = services(client);
          return new SalesPhysicalIntegrationService(
            client as PrismaService,
            {} as never,
            new SalesPhysicalSourceResolver(s.physicalRepo),
            s.physical,
            s.projections,
            new InventoryCompatibilityHistoryService(),
            new InventoryAuthorityTransactionService(
              client as PrismaService,
              s.authority,
              s.runtime,
            ),
          ).approve(f.companyId, f.actorId, sale.id);
        };
      } else {
        const supplier = await db.supplier.create({
          data: { companyId: f.companyId, name: 'Acceptance' },
        });
        const purchase = await db.purchase.create({
          data: {
            companyId: f.companyId,
            supplierId: supplier.id,
            folio: randomUUID(),
            status: 'CONFIRMED',
            subtotal: 1,
            iva: 0,
            total: 1,
            items: {
              create: [
                {
                  productId: f.materials[0].productId,
                  quantity: 1,
                  price: 1,
                  subtotal: 1,
                },
              ],
            },
          },
          include: { items: true },
        });
        writer = (client) => {
          const s = services(client);
          const receipt = new ReceiptPhysicalIntegrationService(
            s.physicalRepo,
            s.physical,
            s.projections,
            new InventoryCompatibilityHistoryService(),
            new EquipmentProvisioningService({} as never),
          );
          return new InventoryAuthorityTransactionService(
            client as PrismaService,
            s.authority,
            s.runtime,
          ).run(f.companyId, (tx) =>
            receipt.execute(tx, f.companyId, f.actorId, randomUUID(), {
              purchaseId: purchase.id,
              items: [
                { purchaseItemId: purchase.items[0].id, quantityReceived: 1 },
              ],
            }),
          );
        };
      }
      const result = await race(
        (client) => confirm(c, services(client)),
        writer,
      );
      expect(result[0]).toHaveProperty('value');
      expect(result[1]).toHaveProperty('value');
      expect(
        (
          await db.product.findUniqueOrThrow({
            where: { id: f.materials[0].productId },
          })
        ).stock,
      ).toBe(kind === 'SALE' ? 9 : 11);
    },
  );
  it('50 exclusive cutover fence blocks until positive Material Confirm commits', async () => {
    const f = await fixture(),
      c = await episode(f, 2);
    const r = await race(
      (client) => confirm(c, services(client)),
      (client) =>
        client.$transaction(
          async (tx) => {
            await inventoryAuthorityFence(tx, f.companyId, 'exclusive');
            return true;
          },
          { isolationLevel: 'ReadCommitted', timeout: 10000 },
        ),
    );
    expect(r[0]).toHaveProperty('value');
    expect(r[1]).toHaveProperty('value', true);
  });
  it('51 tenant isolation prevents cross-company Confirm', async () => {
    const f = await fixture(),
      g = await fixture(),
      c = await episode(f, 2),
      before = await snapshot(f);
    await expect(
      confirm({ ...c, companyId: g.companyId }),
    ).rejects.toHaveProperty('response.code', 'CASE_RECONCILIATION_NOT_FOUND');
    expect(await snapshot(f)).toBe(before);
  });
  it('52 terminal root/items remain immutable', async () => {
    const f = await fixture(),
      r = await confirm(await episode(f, 2));
    await expect(
      db.healthcareCaseReconciliationItem.update({
        where: { id: r.data.items[0].id },
        data: { usedQty: 1 },
      }),
    ).rejects.toThrow();
    await expect(
      db.healthcareCaseReconciliation.update({
        where: { id: r.data.id },
        data: { observation: 'rewrite' },
      }),
    ).rejects.toThrow();
  });
  it('53 deferred validator rejects mixed final state INSIDE callback and rolls everything back', async () => {
    const f = await fixture('MIXED', 'PHYSICAL', true),
      c = await episode(f, 2, 1, 'RETURNED'),
      s = services(),
      before = await snapshot(f);
    const observation = observe(s);
    const detail = jest.spyOn(s.commands, 'detail');
    jest
      .spyOn(s.repo, 'itemEvidence')
      .mockImplementation(async (tx, context, id, data) => {
        if ('returnedPhysicalEffectId' in data) return { count: 1 };
        return new HealthcareCaseReconciliationConfirmRepository(
          s.commands,
          s.physicalRepo,
        ).itemEvidence(tx, context, id, data);
      });
    try {
      await expect(confirm(c, s)).rejects.toHaveProperty(
        'response.code',
        'HEALTHCARE_PERSISTENCE_ERROR',
      );
    } finally {
      observation.stop();
      observation.report('mixed invalid final state');
    }
    expect(observation.metrics.completed).toHaveLength(2);
    expect(observation.metrics.statements).toHaveLength(3);
    expect(observation.metrics.cause?.sqlstate).toBe('23514');
    expect(observation.metrics.callbackReturned).toBe(false);
    expect(observation.metrics.rollback).toBe(true);
    expect(detail).not.toHaveBeenCalled();
    expect(await snapshot(f)).toBe(before);
    expect(
      await db.healthcareCaseReconciliation.findUnique({
        where: { id: c.reconciliationId },
      }),
    ).toMatchObject({ status: 'DRAFT', snapshot: null, confirmedAt: null });
    expect(
      await db.healthcareCaseReconciliationAudit.count({
        where: { reconciliationId: c.reconciliationId, operation: 'CONFIRM' },
      }),
    ).toBe(0);
    expect(
      await db.idempotencyRecord.count({
        where: {
          companyId: f.companyId,
          scope: 'HEALTHCARE_CASE_RECONCILIATION_CONFIRM',
        },
      }),
    ).toBe(0);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId, originId: c.reconciliationId },
      }),
    ).toBe(0);
    expect(
      await db.equipmentAssetCustody.count({
        where: { companyId: f.companyId, closedAt: { not: null } },
      }),
    ).toBe(0);
  });
  it('server 57014 at final evaluation boundary rolls back the entire mixed transaction', async () => {
    const f = await fixture('MIXED', 'PHYSICAL', true),
      c = await episode(f, 2, 1, 'RETURNED'),
      s = services(),
      before = await snapshot(f);
    // Test-only slow statement at the evaluation boundary; production constraints/timeouts are unchanged.
    const observation = observe(s, true);
    const detail = jest.spyOn(s.commands, 'detail');
    try {
      await expect(confirm(c, s)).rejects.toThrow();
    } finally {
      observation.stop();
      observation.report('mixed server cancellation');
    }
    expect(observation.metrics.cause?.sqlstate).toBe('57014');
    expect(observation.metrics.rollback).toBe(true);
    expect(observation.metrics.callbackReturned).toBe(false);
    expect(observation.metrics.settings).toEqual({
      statement: '4s',
      lock: '1500ms',
    });
    expect(detail).not.toHaveBeenCalled();
    expect(await snapshot(f)).toBe(before);
  });
  it('54 audit is exactly once with root timestamp/revision', async () => {
    const f = await fixture(),
      c = await episode(f, 2),
      r = await confirm(c);
    await confirm(c);
    const a = await db.healthcareCaseReconciliationAudit.findMany({
      where: { reconciliationId: c.reconciliationId, operation: 'CONFIRM' },
    });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      actorId: f.actorId,
      revisionBefore: 0,
      revisionAfter: 1,
      createdAt: new Date(r.command.occurredAt),
      change: { version: 1, operation: 'CONFIRM' },
    });
    expect(r.data.confirmedAt).toEqual(a[0].createdAt);
  });
  it.each(['dispatch', 'case', 'kit', 'assignment'] as const)(
    '55-57 zero %s mutation',
    async (kind) => {
      const f = await fixture('MIXED');
      const read = () =>
        kind === 'dispatch'
          ? db.healthcareCaseDispatch.findUnique({
              where: { id: f.dispatchId },
              include: { items: true },
            })
          : kind === 'case'
            ? db.healthcareCase.findUnique({ where: { id: f.caseId } })
            : kind === 'kit'
              ? db.healthcareCaseKit.findUnique({
                  where: { id: f.kitId },
                  include: { items: true },
                })
              : db.healthcareEquipmentAssignment.findMany({
                  where: { companyId: f.companyId },
                });
      const before = await read();
      await confirm(await episode(f, 2, 1, 'RETURNED'));
      expect(await read()).toEqual(before);
    },
  );
  it('58 partial summary includes Equipment still unresolved', async () => {
    const f = await fixture('MIXED');
    await confirm(await episode(f, 10));
    expect(await summary(f)).toHaveProperty('status', 'PARTIALLY_RECONCILED');
  });
  it('59 full summary permits INSPECTION_PENDING returned Equipment', async () => {
    const f = await fixture('MIXED');
    await confirm(await episode(f, 5, 5, 'RETURNED', 'INSPECTION_PENDING'));
    expect(await summary(f)).toHaveProperty('status', 'FULLY_RECONCILED');
  });
  it('60 observational episodes do not manufacture progress', async () => {
    const f = await fixture('MIXED', 'LEGACY');
    await confirm(await episode(f));
    await confirm(await episode(f));
    expect(await summary(f)).toHaveProperty('status', 'UNRECONCILED');
  });
  it.each(['build', 'protocol'] as const)(
    'runtime missing/incompatible %s fails before writes',
    async (kind) => {
      const f = await fixture(),
        c = await episode(f, 2),
        before = await snapshot(f);
      if (kind === 'build') delete process.env.INVENTORY_RUNTIME_BUILD;
      else process.env.INVENTORY_AUTHORITY_PROTOCOL = 'wrong';
      await expect(confirm(c)).rejects.toHaveProperty(
        'code',
        kind === 'build' ? 'INCOMPATIBLE_BUILD' : 'STALE_RUNTIME',
      );
      expect(await snapshot(f)).toBe(before);
    },
  );
  it('actor-different replay returns original receipt before authority/runtime', async () => {
    const f = await fixture(),
      c = await episode(f, 2),
      r = await confirm(c);
    const actor = await db.user.create({
      data: {
        companyId: f.companyId,
        firstName: 'Other',
        lastName: 'Actor',
        email: randomUUID() + '@example.invalid',
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'WAREHOUSE',
      },
    });
    delete process.env.INVENTORY_RUNTIME_BUILD;
    const before = await snapshot(f);
    const replay = await confirm({ ...c, actorId: actor.id });
    expect(replay.command).toEqual(r.command);
    expect(replay.replay).toBe(true);
    expect(await snapshot(f)).toBe(before);
  });
  it('adapter REPLAY authorizes historical close after later Asset condition', async () => {
    const f = await fixture('EQUIPMENT'),
      c = await episode(f, 0, 0, 'RETURNED'),
      r = await confirm(c),
      item = r.data.items[0];
    await services().equipment.createInspection(
      f.companyId,
      f.actorId,
      f.equipment[0].assetId,
      { conditionAfter: 'DAMAGED' },
    );
    const command: EquipmentCustodyCloseCommand = {
      companyId: f.companyId,
      caseId: f.caseId,
      assetId: item.assetId!,
      custodyId: item.equipmentCustodyId!,
      assignmentId: item.assignmentId!,
      actorId: f.actorId,
      expectedPhysicalRevision: item.expectedPhysicalRevision!,
      reportedCondition: item.reportedCondition!,
      validatedContext: {
        adapterKey: 'CASE_RECONCILIATION_ITEM',
        contextId: item.id,
      },
      durableOrigin: {
        type: 'CASE_RECONCILIATION_ITEM',
        id: item.id,
        operation: 'CONFIRM_EQUIPMENT_RETURN',
      },
    };
    const result = await db.$transaction(async (tx) => {
      await acquireHealthcareCompanyLock(tx, f.companyId, {
        acquisitionTimeoutMs: 1000,
      });
      return services().close.returnFromCustody(tx, command);
    });
    expect(result.outcome).toBe('REPLAY');
    expect(result.conditionAfter).toBe('GOOD');
  });
  it('authority hint changing before locked reread aborts rather than acquiring late fence', async () => {
    const f = await fixture('MIXED'),
      c = await episode(f),
      s = services(),
      original = new HealthcareCaseReconciliationConfirmRepository(
        s.commands,
        s.physicalRepo,
      );
    let calls = 0;
    jest
      .spyOn(s.repo, 'root')
      .mockImplementation(
        async (
          ...args: Parameters<
            HealthcareCaseReconciliationConfirmRepository['root']
          >
        ) => {
          const root = await original.root(...args);
          if (++calls === 1 && root) {
            const item = root.items.find((i) => i.type === 'MATERIAL')!;
            item.returnedQty = 1;
          }
          return root;
        },
      );
    const before = await snapshot(f);
    await expect(confirm(c, s)).rejects.toHaveProperty(
      'response.code',
      'RESOURCE_STATE_CHANGED',
    );
    expect(await snapshot(f)).toBe(before);
  });
  it.each(['empty', 'excluded', 'noObservation', 'resolved'] as const)(
    'observational %s rejects',
    async (kind) => {
      const f = await fixture(),
        c = await episode(f);
      if (kind === 'resolved') {
        await confirm(await episode(f, 10));
      } else if (kind === 'noObservation')
        await db.healthcareCaseReconciliation.update({
          where: { id: c.reconciliationId },
          data: { observation: null },
        });
      else if (kind === 'excluded')
        await db.healthcareCaseReconciliationItem.updateMany({
          where: { reconciliationId: c.reconciliationId },
          data: {
            lifecycle: 'EXCLUDED',
            excludedById: f.actorId,
            excludedAt: new Date(),
            exclusionReason: 'Test',
          },
        });
      else {
        const r = await db.healthcareCaseReconciliation.create({
          data: {
            companyId: f.companyId,
            caseId: f.caseId,
            caseKitId: f.kitId,
            dispatchId: f.dispatchId,
            createdById: f.actorId,
            observation: 'No items',
          },
        });
        c.reconciliationId = r.id;
      }
      await expect(confirm(c)).rejects.toThrow();
    },
  );
  it('shared canonical AVAILABLE destination aggregates credits in one physical result', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY');
    const product = await db.product.create({
      data: {
        companyId: f.companyId,
        sku: randomUUID(),
        name: 'Shared destination primitive',
        inventoryTracking: 'QUANTITY',
        lotTracking: 'NONE',
        stock: 5,
      },
    });
    const sources = await Promise.all(
      [2, 3].map((quantity) =>
        db.inventoryPosition.create({
          data: {
            companyId: f.companyId,
            productId: product.id,
            state: 'CUSTODY',
            contextType: 'ISOLATED_TEST',
            contextId: randomUUID(),
            quantity,
          },
        }),
      ),
    );
    const result = await db.$transaction(async (tx) => {
      const s = services();
      const r = await s.physical.transfer(
        tx,
        {
          companyId: f.companyId,
          actorId: f.actorId,
          origin: {
            type: 'ISOLATED_SHARED_DESTINATION',
            id: randomUUID(),
            operation: 'RETURNED',
          },
        },
        sources.map((p) => ({
          sourceId: p.id,
          quantity: p.quantity,
          expectedSourceRevision: p.revision,
          target: {
            productId: product.id,
            inventoryBatchId: null,
            state: 'AVAILABLE',
            contextType: null,
            contextId: null,
          },
        })),
      );
      await s.projections.apply(tx, f.companyId, r);
      return r;
    });
    expect(result.effect.lines.filter((l) => l.delta > 0)).toHaveLength(1);
    expect(result.effect.lines.find((l) => l.delta > 0)?.delta).toBe(5);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock,
    ).toBe(5);
  });
  it('lost-response Confirm and productive adapter replay survive later redispatch', async () => {
    const f = await fixture('EQUIPMENT', 'LEGACY'),
      c = await episode(f, 0, 0, 'RETURNED'),
      original = await confirm(c),
      assetId = f.equipment[0].assetId;
    // A later independent custody episode, authored as retained structural test evidence.
    await db.$transaction(async (tx) => {
      const parent = await tx.healthcareCase.create({
        data: {
          companyId: f.companyId,
          createdById: f.actorId,
          folio: randomUUID(),
          title: 'Later handoff',
        },
      });
      const assignment = await tx.healthcareEquipmentAssignment.create({
        data: {
          companyId: f.companyId,
          caseId: parent.id,
          equipmentAssetId: assetId,
          origin: 'DIRECT',
          directAssignmentReason: 'Later handoff fixture',
          createdById: f.actorId,
        },
      });
      const custody = await tx.equipmentAssetCustody.create({
        data: {
          companyId: f.companyId,
          equipmentAssetId: assetId,
          caseId: parent.id,
          assignmentId: assignment.id,
          openedById: f.actorId,
        },
      });
      await tx.equipmentAsset.update({
        where: { id: assetId },
        data: {
          physicalLocation: 'CUSTODY',
          activeCustodyId: custody.id,
          physicalRevision: 3,
        },
      });
      await tx.equipmentAssetPhysicalEvent.create({
        data: {
          companyId: f.companyId,
          equipmentAssetId: assetId,
          custodyId: custody.id,
          operation: 'CUSTODY_OPEN',
          originType: 'ISOLATED_LATER_HANDOFF',
          originId: randomUUID(),
          originOperation: 'OPEN',
          requestHash: 'b'.repeat(64),
          physicalLocationBefore: 'WAREHOUSE',
          physicalLocationAfter: 'CUSTODY',
          conditionBefore: 'GOOD',
          conditionAfter: 'GOOD',
          lifecycleBefore: 'ACTIVE',
          lifecycleAfter: 'ACTIVE',
          revisionBefore: 2,
          revisionAfter: 3,
          actorId: f.actorId,
          reasonCode: 'FIXTURE',
        },
      });
    });
    const before = await snapshot(f);
    delete process.env.INVENTORY_RUNTIME_BUILD;
    expect(await confirm(c)).toEqual({ ...original, replay: true });
    expect(await snapshot(f)).toBe(before);
    expect(await summary(f)).toHaveProperty('status', 'FULLY_RECONCILED');
  });
  if (diagnostic)
    it('mass fixture diagnostic only', async () => {
      await fixture('MATERIAL', 'PHYSICAL', false, 1000);
    });
  let limitBlocker: unknown;
  it.each(['RETURNED', 'USED'] as const)(
    'positive %s count 1000 completes with one grouped effect',
    async (kind) => {
      if (limitBlocker)
        throw new Error(
          'HARD STOP: prior 1000-entry Confirm failed; no subsequent operation attempted',
        );
      const f = await fixture('MATERIAL', 'PHYSICAL', false, 1000),
        c = await episode(
          f,
          kind === 'RETURNED' ? 1 : 0,
          kind === 'USED' ? 1 : 0,
        ),
        s = services();
      console.log(
        `Confirm ${kind} 1000 starting with normal application policy`,
        policy,
      );
      const before = await snapshot(f);
      const observation = observe(s);
      const operationStarted = performance.now();
      let result: Awaited<ReturnType<typeof confirm>>;
      try {
        result = await confirm(c, s);
      } catch (error) {
        limitBlocker = error;
        console.error(
          `HARD STOP: Confirm ${kind} 1000 failed after ${performance.now() - operationStarted}ms`,
          error,
        );
        observation.stop();
        observation.report(kind + ' 1000 FAILURE');
        expect(await snapshot(f)).toBe(before);
        console.log('HC-RR-01D failed N1000 persisted rollback verified');
        throw error;
      } finally {
        observation.stop();
      }
      observation.report(kind + ' 1000 PASS');
      console.log(
        'HC-RR-01D operation ' +
          JSON.stringify({
            kind,
            n: 1000,
            ms: performance.now() - operationStarted,
          }),
      );
      expect(observation.metrics.callbackReturned).toBe(true);
      expect(observation.metrics.completed).toHaveLength(3);
      expect(observation.metrics.settings).toEqual({
        statement: '4s',
        lock: '1500ms',
      });
      expect(result.data.items).toHaveLength(1000);
      expect(
        await db.inventoryPhysicalEffect.count({
          where: { originId: c.reconciliationId },
        }),
      ).toBe(1);
      expect(result.data.status).toBe('CONFIRMED');
      const persisted = await db.healthcareCaseReconciliationItem.findMany({
        where: { reconciliationId: c.reconciliationId },
      });
      const effects = await db.inventoryPhysicalEffect.findMany({
        where: { companyId: f.companyId, originId: c.reconciliationId },
        include: { lines: true },
      });
      expect(effects).toHaveLength(1);
      const effect = effects[0];
      expect(effect.lines).toHaveLength(kind === 'RETURNED' ? 2000 : 1000);
      expect(
        persisted.every(
          (i) =>
            i.snapshot !== null &&
            i.expectedSourceRevision === 1 &&
            i.returnedQty === (kind === 'RETURNED' ? 1 : 0) &&
            i.usedQty === (kind === 'USED' ? 1 : 0) &&
            (kind === 'RETURNED'
              ? i.returnedPhysicalEffectId
              : i.usedPhysicalEffectId) === effect.id,
        ),
      ).toBe(true);
      expect(
        await db.product.findMany({
          where: { companyId: f.companyId },
          select: { stock: true },
        }),
      ).toEqual(
        Array.from({ length: 1000 }, () => ({
          stock: kind === 'RETURNED' ? 10 : 9,
        })),
      );
      expect(
        await db.inventoryBatch.count({ where: { companyId: f.companyId } }),
      ).toBe(0);
      expect(
        await db.healthcareCaseReconciliationAudit.count({
          where: { reconciliationId: c.reconciliationId, operation: 'CONFIRM' },
        }),
      ).toBe(1);
      expect(
        await db.idempotencyRecord.findFirst({
          where: {
            companyId: f.companyId,
            scope: 'HEALTHCARE_CASE_RECONCILIATION_CONFIRM',
            key: c.key,
          },
        }),
      ).toMatchObject({ resourceId: c.reconciliationId });
      for (const item of persisted) {
        const source = effect.lines.find(
          (l) => l.positionId === item.sourceCustodyPositionId,
        )!;
        expect(source).toMatchObject({
          delta: -1,
          quantityBefore: 10,
          quantityAfter: 9,
          revisionBefore: 1,
          revisionAfter: 2,
        });
        if (kind === 'RETURNED')
          expect(
            effect.lines.find(
              (l) => l.positionId === item.returnedDestinationPositionId,
            ),
          ).toMatchObject({
            delta: 1,
            quantityBefore: 0,
            quantityAfter: 1,
            revisionBefore: 1,
            revisionAfter: 2,
          });
      }
    },
  );
  it.each(['RETURNED', 'USED'] as const)(
    'positive %s count 1001 rejects before audit or physical writes',
    async (kind) => {
      if (limitBlocker)
        throw new Error(
          'HARD STOP: prior 1000-entry Confirm failed; no subsequent operation attempted',
        );
      const f = await fixture('MATERIAL', 'PHYSICAL', false, 1001),
        c = await episode(
          f,
          kind === 'RETURNED' ? 1 : 0,
          kind === 'USED' ? 1 : 0,
        ),
        s = services(),
        before = await snapshot(f);
      const observation = observe(s);
      const operationStarted = performance.now();
      const audit = jest.spyOn(s.repo, 'audit'),
        transfer = jest.spyOn(s.physical, 'transfer'),
        out = jest.spyOn(s.physical, 'definitiveOut');
      try {
        await expect(confirm(c, s)).rejects.toHaveProperty(
          'response.code',
          'INVALID_PHYSICAL_REQUEST',
        );
      } finally {
        observation.stop();
        observation.report(kind + ' 1001 rejected');
      }
      console.log(
        'HC-RR-01D operation ' +
          JSON.stringify({
            kind,
            n: 1001,
            ms: performance.now() - operationStarted,
          }),
      );
      expect(audit).not.toHaveBeenCalled();
      expect(transfer).not.toHaveBeenCalled();
      expect(out).not.toHaveBeenCalled();
      expect(await snapshot(f)).toBe(before);
    },
  );
});
