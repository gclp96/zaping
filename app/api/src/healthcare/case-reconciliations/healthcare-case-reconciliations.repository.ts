import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthcareCaseReconciliationListQueryDto } from './dto/healthcare-case-reconciliation-list-query.dto';
const actor = { id: true, firstName: true, lastName: true } as const;
export const reconciliationSelect = {
  id: true,
  caseId: true,
  dispatchId: true,
  caseKitId: true,
  status: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  confirmedFromRevision: true,
  confirmedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  observation: true,
  snapshotVersion: true,
  snapshot: true,
  createdBy: { select: actor },
  confirmedBy: { select: actor },
  cancelledBy: { select: actor },
  dispatch: {
    select: {
      id: true,
      caseId: true,
      caseKitId: true,
      status: true,
      snapshot: true,
    },
  },
} satisfies Prisma.HealthcareCaseReconciliationSelect;
export const reconciliationDetailSelect = {
  ...reconciliationSelect,
  items: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      createdBy: { select: actor },
      excludedBy: { select: actor },
      sourceDispatchItem: {
        select: {
          id: true,
          productId: true,
          batchId: true,
          assetId: true,
          quantity: true,
          equipmentPhysicalEventId: true,
          snapshot: true,
        },
      },
    },
  },
  audit: {
    orderBy: { revisionAfter: 'asc' },
    select: {
      id: true,
      reconciliationItemId: true,
      operation: true,
      createdAt: true,
      revisionBefore: true,
      revisionAfter: true,
      change: true,
      actor: { select: actor },
    },
  },
} satisfies Prisma.HealthcareCaseReconciliationSelect;
export type ReconciliationRow = Prisma.HealthcareCaseReconciliationGetPayload<{
  select: typeof reconciliationSelect;
}>;
export type ReconciliationDetailRow =
  Prisma.HealthcareCaseReconciliationGetPayload<{
    select: typeof reconciliationDetailSelect;
  }>;
export const summarySourceInclude = {
  destinationPosition: true,
  physicalEffect: { include: { lines: true } },
  equipmentCustody: true,
  equipmentPhysicalEvent: true,
  asset: { select: { activeCustodyId: true, physicalLocation: true } },
  reconciliationItems: {
    where: { lifecycle: 'ACTIVE', reconciliation: { status: 'CONFIRMED' } },
    include: {
      reconciliation: { select: { id: true, confirmedById: true } },
      returnedDestinationPosition: true,
      returnedPhysicalEffect: { include: { lines: true } },
      usedPhysicalEffect: { include: { lines: true } },
      closePhysicalEvent: true,
    },
  },
} satisfies Prisma.HealthcareCaseDispatchItemInclude;
export type SummarySource = Prisma.HealthcareCaseDispatchItemGetPayload<{
  include: typeof summarySourceInclude;
}>;
@Injectable()
export class HealthcareCaseReconciliationsRepository {
  constructor(private readonly prisma: PrismaService) {}
  runInReadSnapshot<T>(read: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(read, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
  findCase(companyId: string, caseId: string, tx: Prisma.TransactionClient) {
    return tx.healthcareCase.findFirst({
      where: { id: caseId, companyId },
      select: { id: true },
    });
  }
  async list(
    companyId: string,
    caseId: string,
    q: HealthcareCaseReconciliationListQueryDto,
    tx: Prisma.TransactionClient,
  ) {
    const where = {
      companyId,
      caseId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.dispatchId ? { dispatchId: q.dispatchId } : {}),
    };
    const totalItems = await tx.healthcareCaseReconciliation.count({ where });
    const items = await tx.healthcareCaseReconciliation.findMany({
      where,
      select: reconciliationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    return { totalItems, items };
  }
  detail(
    companyId: string,
    caseId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.healthcareCaseReconciliation.findFirst({
      where: { companyId, caseId, id },
      select: reconciliationDetailSelect,
    });
  }
  summary(
    companyId: string,
    caseId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.healthcareCaseDispatch.findFirst({
      where: { companyId, caseId, id, status: 'CONFIRMED' },
      select: {
        id: true,
        items: {
          where: { lifecycle: 'ACTIVE' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: summarySourceInclude,
        },
      },
    });
  }
}
