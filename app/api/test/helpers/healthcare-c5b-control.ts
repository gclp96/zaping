import { HealthcareCompanyTransactionTimeoutPolicy } from '../../src/healthcare/common/healthcare-company-transaction-timeout-policy';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { deriveHealthcareCompanyLockKey } from '../../src/healthcare/common/healthcare-company-lock-key';
import { HealthcareEquipmentAssignmentsRepository } from '../../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';

type Owner = { id: string; name: string; rfc: string; userId: string };
type Pids = readonly [number, number, number];
type Observation = {
  pid: number;
  username: string;
  waiting: boolean;
  held: boolean;
};
type KitItemFixture = {
  id: string;
  excluded?: boolean;
} & (
  | {
      requirementId: string;
      preparedQuantity: number;
      equipmentAssignmentId?: never;
    }
  | {
      equipmentAssignmentId: string;
      requirementId?: never;
      preparedQuantity?: never;
    }
);
export type C5bKitFixture = {
  id: string;
  companyId: string;
  caseId: string;
  status?: 'DRAFT' | 'PREPARED';
  items: readonly KitItemFixture[];
};
function requireControl(ok: unknown): asserts ok {
  if (!ok) throw new Error('C5B control invariant failed');
}

// Rows include ALL database sessions, with booleans for this exact bigint lock.
export function c5bObservedContention(
  rows: Observation[],
  pids: Pids,
): boolean {
  requireControl(
    new Set(pids).size === 3 && pids.every((p) => Number.isInteger(p) && p > 0),
  );
  requireControl(
    rows.length === 3 &&
      new Set(rows.map((r) => r.pid)).size === 3 &&
      rows.every((r) => pids.includes(r.pid)),
  );
  const apps = pids.slice(0, 2).map((pid) => rows.find((r) => r.pid === pid)!);
  requireControl(apps.every((r) => r.username === 'zaping_hc_c5b'));
  const operator = rows.find((r) => r.pid === pids[2])!;
  requireControl(operator.username !== 'zaping_hc_c5b' && operator.held);
  return apps.every((r) => r.waiting && !r.held);
}

export interface C5bControl {
  createCaseKit(fixture: C5bKitFixture): Promise<void>;
  cleanupCaseKits(): Promise<void>;
  observeInventory(): Promise<{
    batches: Prisma.InventoryBatchGetPayload<object>[];
    movements: Prisma.InventoryMovementGetPayload<object>[];
  }>;
  contend<T>(
    companyId: string,
    requests: readonly [() => Promise<T>, () => Promise<T>],
  ): Promise<[T, T]>;
  transition(
    companyId: string,
    caseId: string,
    requirementId: string,
    mode: 'cancel' | 'retire',
  ): Promise<void>;
}

export function createC5bControl(input: {
  concurrent: PrismaService;
  operator: PrismaService;
  pids: Pids;
  owners: readonly Owner[];
  repository: HealthcareEquipmentAssignmentsRepository;
  checkBoundary: () => Promise<void>;
}): C5bControl {
  const { concurrent, operator, pids, owners, repository, checkBoundary } =
    input;
  let busy = false;
  const kits: C5bKitFixture[] = [];
  const owned = (companyId: string) => {
    const owner = owners.find((o) => o.id === companyId);
    requireControl(owner);
    return owner;
  };
  const accredit = async (tx: Prisma.TransactionClient, owner: Owner) => {
    requireControl(
      (await tx.company.count({
        where: { id: owner.id, name: owner.name, rfc: owner.rfc },
      })) === 1,
    );
    requireControl(
      (await tx.user.count({
        where: { id: owner.userId, companyId: owner.id },
      })) === 1,
    );
  };
  return {
    async createCaseKit(input) {
      requireControl(!busy);
      const owner = owned(input.companyId);
      requireControl(
        !kits.some(
          (kit) =>
            kit.id === input.id ||
            (kit.companyId === input.companyId && kit.caseId === input.caseId),
        ) &&
          new Set(input.items.map((item) => item.id)).size ===
            input.items.length &&
          input.items.every(
            (item) =>
              !kits.some((kit) =>
                kit.items.some((prior) => prior.id === item.id),
              ),
          ),
      );
      // Copy the closed input: caller mutation cannot broaden teardown predicates.
      const fixture: C5bKitFixture = {
        id: input.id,
        companyId: input.companyId,
        caseId: input.caseId,
        status: input.status ?? 'DRAFT',
        items: input.items.map((item) => ({ ...item })),
      };
      requireControl(
        fixture.status === 'DRAFT' || fixture.status === 'PREPARED',
      );
      await checkBoundary();
      busy = true;
      try {
        await operator.$transaction(
          async (tx) => {
            await accredit(tx, owner);
            requireControl(
              (await tx.healthcareCase.count({
                where: {
                  id: fixture.caseId,
                  companyId: owner.id,
                  createdById: owner.userId,
                  folio: `C5AVL-${fixture.caseId}`,
                },
              })) === 1,
            );
            requireControl(
              (await tx.healthcareCaseKit.count({
                where: {
                  OR: [
                    { id: fixture.id },
                    { companyId: owner.id, caseId: fixture.caseId },
                  ],
                },
              })) === 0,
            );
            requireControl(
              (await tx.healthcareCaseKitItem.count({
                where: {
                  id: { in: fixture.items.map((item) => item.id) },
                },
              })) === 0,
            );
            for (const item of fixture.items) {
              if (item.requirementId !== undefined) {
                requireControl(
                  item.equipmentAssignmentId === undefined &&
                    Number.isInteger(item.preparedQuantity) &&
                    item.preparedQuantity > 0,
                );
                requireControl(
                  (await tx.healthcareCaseRequirement.count({
                    where: {
                      id: item.requirementId,
                      companyId: owner.id,
                      caseId: fixture.caseId,
                      createdById: owner.userId,
                      product: { inventoryTracking: 'QUANTITY' },
                    },
                  })) === 1,
                );
              } else {
                requireControl(
                  item.equipmentAssignmentId !== undefined &&
                    item.preparedQuantity === undefined,
                );
                requireControl(
                  (await tx.healthcareEquipmentAssignment.count({
                    where: {
                      id: item.equipmentAssignmentId,
                      companyId: owner.id,
                      caseId: fixture.caseId,
                      createdById: owner.userId,
                    },
                  })) === 1,
                );
              }
            }
            // Register after collision/dependency checks, before the first INSERT.
            // An uncertain transaction result still leaves exact cleanup identifiers.
            kits.push(fixture);
            const audit = new Date();
            await tx.healthcareCaseKit.create({
              data: {
                id: fixture.id,
                companyId: owner.id,
                caseId: fixture.caseId,
                createdById: owner.userId,
                status: fixture.status,
                ...(fixture.status === 'PREPARED'
                  ? { preparedById: owner.userId, preparedAt: audit }
                  : {}),
              },
            });
            for (const item of fixture.items) {
              await tx.healthcareCaseKitItem.create({
                data: {
                  id: item.id,
                  companyId: owner.id,
                  caseId: fixture.caseId,
                  caseKitId: fixture.id,
                  addedById: owner.userId,
                  requirementId: item.requirementId ?? null,
                  equipmentAssignmentId: item.equipmentAssignmentId ?? null,
                  preparedQuantity: item.preparedQuantity ?? null,
                  ...(item.excluded
                    ? {
                        lifecycle: 'EXCLUDED',
                        excludedById: owner.userId,
                        excludedAt: audit,
                        exclusionReason: 'C5AVL owned excluded fixture',
                      }
                    : {}),
                },
              });
            }
          },
          { maxWait: 3000, timeout: 20000 },
        );
        await checkBoundary();
      } finally {
        busy = false;
      }
    },
    async cleanupCaseKits() {
      requireControl(!busy);
      if (!kits.length) return;
      await checkBoundary();
      busy = true;
      try {
        await operator.$transaction(
          async (tx) => {
            for (const fixture of kits) {
              const owner = owned(fixture.companyId);
              await accredit(tx, owner);
              requireControl(
                (await tx.healthcareCase.count({
                  where: {
                    id: fixture.caseId,
                    companyId: owner.id,
                    createdById: owner.userId,
                    folio: `C5AVL-${fixture.caseId}`,
                  },
                })) === 1,
              );
              const kitWhere = {
                id: fixture.id,
                companyId: owner.id,
                caseId: fixture.caseId,
                createdById: owner.userId,
              };
              // Fail closed if a registered identity changed ownership, or if
              // unregistered child rows appeared. Never delete by Company alone.
              requireControl(
                (await tx.healthcareCaseKit.count({
                  where: { id: fixture.id },
                })) === (await tx.healthcareCaseKit.count({ where: kitWhere })),
              );
              const itemWhere = {
                id: { in: fixture.items.map((item) => item.id) },
                companyId: owner.id,
                caseId: fixture.caseId,
                caseKitId: fixture.id,
                addedById: owner.userId,
              };
              const children = await tx.healthcareCaseKitItem.count({
                where: itemWhere,
              });
              requireControl(
                children ===
                  (await tx.healthcareCaseKitItem.count({
                    where: {
                      OR: [
                        { id: { in: fixture.items.map((item) => item.id) } },
                        { caseKitId: fixture.id },
                      ],
                    },
                  })),
              );
              await tx.healthcareCaseKitItem.deleteMany({ where: itemWhere });
              await tx.healthcareCaseKit.deleteMany({ where: kitWhere });
            }
          },
          { maxWait: 3000, timeout: 20000 },
        );
        await checkBoundary();
      } finally {
        busy = false;
      }
    },
    async observeInventory() {
      requireControl(!busy);
      await checkBoundary();
      busy = true;
      try {
        return await operator.$transaction(
          async (tx) => {
            for (const owner of owners) await accredit(tx, owner);
            const where = {
              companyId: { in: owners.map((owner) => owner.id) },
            };
            return {
              batches: await tx.inventoryBatch.findMany({
                where,
                orderBy: { id: 'asc' },
              }),
              movements: await tx.inventoryMovement.findMany({
                where,
                orderBy: { id: 'asc' },
              }),
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        );
      } finally {
        busy = false;
      }
    },
    async contend<T>(
      companyId: string,
      requests: readonly [() => Promise<T>, () => Promise<T>],
    ): Promise<[T, T]> {
      requireControl(!busy);
      owned(companyId);
      await checkBoundary();
      busy = true;
      // Retain the exact method for restoration; invoke only through its bound copy.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const original = repository.runCoverageNoteCommand;
      const runOriginal = original.bind(repository) as typeof original;
      const second = new HealthcareEquipmentAssignmentsRepository(concurrent);
      let arrive = 0;
      let aborted = false;
      let release!: () => void;
      const rendezvous = new Promise<void>((resolve) => {
        release = resolve;
      });
      // Both JWT validations finish before either command can occupy the primary
      // pool. The real repository transaction/production lock runs on each app PID.
      repository.runCoverageNoteCommand = async <R>(
        id: string,
        policy: HealthcareCompanyTransactionTimeoutPolicy,
        operation: (tx: Prisma.TransactionClient) => Promise<R>,
      ): Promise<R> => {
        requireControl(id === companyId && arrive < 2 && !aborted);
        const index = arrive++;
        if (arrive === 2) release();
        await rendezvous;
        requireControl(!aborted);
        return index === 0
          ? runOriginal(id, policy, operation)
          : second.runCoverageNoteCommand(id, policy, operation);
      };
      let pending: Promise<PromiseSettledResult<T>[]> | undefined;
      try {
        const key = deriveHealthcareCompanyLockKey(companyId);
        const unsigned = BigInt.asUintN(64, key);
        const high = (unsigned >> 32n).toString();
        const low = (unsigned & 0xffffffffn).toString();
        await operator.$transaction(
          async (tx) => {
            await tx.$queryRaw(
              Prisma.sql`SELECT pg_advisory_xact_lock(${key}::bigint)::text`,
            );
            pending = Promise.allSettled(
              requests.map((request) => Promise.resolve().then(request)),
            );
            const deadline = Date.now() + 1500;
            for (;;) {
              await tx.$queryRaw(
                Prisma.sql`SELECT pg_stat_clear_snapshot()::text`,
              );
              const rows = await tx.$queryRaw<Observation[]>(Prisma.sql`
              SELECT a.pid, a.usename::text AS username,
                (a.wait_event_type = 'Lock' AND a.wait_event = 'advisory' AND EXISTS (
                  SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND l.locktype = 'advisory'
                  AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
                  AND l.classid = ${high}::oid AND l.objid = ${low}::oid AND l.objsubid = 1 AND NOT l.granted
                )) IS TRUE AS waiting,
                EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND l.locktype = 'advisory'
                  AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
                  AND l.classid = ${high}::oid AND l.objid = ${low}::oid AND l.objsubid = 1 AND l.granted) AS held
              FROM pg_stat_activity a WHERE a.datname = current_database()`);
              if (c5bObservedContention(rows, pids)) break;
              requireControl(Date.now() < deadline);
            }
          },
          { maxWait: 3000, timeout: 5000 },
        );
        const results = await pending!;
        requireControl(
          results.length === 2 &&
            results.every((r) => r.status === 'fulfilled'),
        );
        await checkBoundary();
        return results.map((r) => r.value) as [T, T];
      } finally {
        aborted = true;
        release();
        // Blocker transaction has ended; drain HTTP work before PID teardown.
        if (pending) await pending;
        repository.runCoverageNoteCommand = original;
        busy = false;
      }
    },
    async transition(companyId, caseId, requirementId, mode) {
      requireControl(!busy && (mode === 'cancel' || mode === 'retire'));
      const owner = owned(companyId);
      await checkBoundary();
      busy = true;
      try {
        await operator.$transaction(
          async (tx) => {
            await tx.$queryRaw(
              Prisma.sql`SELECT pg_advisory_xact_lock(${deriveHealthcareCompanyLockKey(companyId)}::bigint)::text`,
            );
            requireControl(
              (await tx.company.count({
                where: { id: owner.id, name: owner.name, rfc: owner.rfc },
              })) === 1,
            );
            requireControl(
              (await tx.user.count({
                where: { id: owner.userId, companyId },
              })) === 1,
            );
            requireControl(
              (await tx.healthcareCase.count({
                where: {
                  id: caseId,
                  companyId,
                  createdById: owner.userId,
                  folio: `C5N-${caseId}`,
                  status: 'DRAFT',
                },
              })) === 1,
            );
            requireControl(
              (await tx.healthcareCaseRequirement.count({
                where: {
                  id: requirementId,
                  companyId,
                  caseId,
                  createdById: owner.userId,
                  lifecycle: 'ACTIVE',
                  retiredAt: null,
                  reactivatedAt: null,
                },
              })) === 1,
            );
            // Only isolated, never-assigned fixtures; no cancellation/release policy simulation.
            requireControl(
              (await tx.healthcareEquipmentAssignment.count({
                where: { companyId, caseId },
              })) === 0,
            );
            if (mode === 'cancel') {
              await tx.healthcareCase.update({
                where: { id: caseId },
                data: {
                  status: 'CANCELLED',
                  cancelledAt: new Date(),
                  cancelledById: owner.userId,
                  cancellationReason: 'C5B owned lifecycle replay fixture',
                },
              });
            } else {
              await tx.healthcareCaseRequirement.update({
                where: { id: requirementId },
                data: {
                  lifecycle: 'RETIRED',
                  retiredAt: new Date(),
                  retiredById: owner.userId,
                  retirementReason: 'C5B owned lifecycle replay fixture',
                },
              });
            }
          },
          { maxWait: 3000, timeout: 5000 },
        );
        await checkBoundary();
      } finally {
        busy = false;
      }
    },
  };
}
