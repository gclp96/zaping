import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthcareCaseDispatchListQueryDto } from './dto/healthcare-case-dispatch-list-query.dto';
const actor = { id: true, firstName: true, lastName: true } as const;
export const dispatchSummarySelect = {
  id: true,
  caseId: true,
  caseKitId: true,
  status: true,
  revision: true,
  custodianType: true,
  custodianUserId: true,
  custodianDisplayName: true,
  createdAt: true,
  confirmedAt: true,
  cancelledAt: true,
  snapshotVersion: true,
  snapshot: true,
  createdBy: { select: actor },
  confirmedBy: { select: actor },
  cancelledBy: { select: actor },
} satisfies Prisma.HealthcareCaseDispatchSelect;
export const dispatchDetailSelect = {
  ...dispatchSummarySelect,
  confirmedFromRevision: true,
  cancellationReason: true,
  healthcareCase: {
    select: { id: true, folio: true, scheduledStart: true, scheduledEnd: true },
  },
  items: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sourceCaseKitItemId: true,
      type: true,
      lifecycle: true,
      productId: true,
      quantity: true,
      batchId: true,
      sourcePositionId: true,
      expectedPositionRevision: true,
      destinationPositionId: true,
      physicalEffectId: true,
      assignmentId: true,
      assetId: true,
      expectedPhysicalRevision: true,
      equipmentCustodyId: true,
      equipmentPhysicalEventId: true,
      createdAt: true,
      excludedAt: true,
      exclusionReason: true,
      snapshot: true,
      addedBy: { select: actor },
      excludedBy: { select: actor },
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          inventoryTracking: true,
          lotTracking: true,
        },
      },
      batch: { select: { id: true, lotNumber: true, expirationDate: true } },
      asset: { select: { id: true, assetCode: true, serialNumber: true } },
      sourceCaseKitItem: {
        select: {
          id: true,
          requirementId: true,
          equipmentAssignmentId: true,
          preparedQuantity: true,
        },
      },
    },
  },
  audit: {
    orderBy: { revisionAfter: 'asc' },
    select: {
      id: true,
      dispatchItemId: true,
      operation: true,
      createdAt: true,
      revisionBefore: true,
      revisionAfter: true,
      change: true,
      actor: { select: actor },
    },
  },
} satisfies Prisma.HealthcareCaseDispatchSelect;
export type DispatchSummaryRow = Prisma.HealthcareCaseDispatchGetPayload<{
  select: typeof dispatchSummarySelect;
}>;
export type DispatchDetailRow = Prisma.HealthcareCaseDispatchGetPayload<{
  select: typeof dispatchDetailSelect;
}>;
@Injectable()
export class HealthcareCaseDispatchesRepository {
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
    q: HealthcareCaseDispatchListQueryDto,
    tx: Prisma.TransactionClient,
  ) {
    const where = {
      companyId,
      caseId,
      ...(q.status ? { status: q.status } : {}),
    };
    const totalItems = await tx.healthcareCaseDispatch.count({ where });
    const items = await tx.healthcareCaseDispatch.findMany({
      where,
      select: dispatchSummarySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    return { items, totalItems };
  }
  detail(
    companyId: string,
    caseId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.healthcareCaseDispatch.findFirst({
      where: { companyId, caseId, id },
      select: dispatchDetailSelect,
    });
  }
}
