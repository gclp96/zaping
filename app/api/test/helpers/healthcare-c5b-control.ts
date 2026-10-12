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
  const owned = (companyId: string) => {
    const owner = owners.find((o) => o.id === companyId);
    requireControl(owner);
    return owner;
  };
  return {
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
