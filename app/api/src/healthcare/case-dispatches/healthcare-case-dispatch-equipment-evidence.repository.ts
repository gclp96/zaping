import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class HealthcareCaseDispatchEquipmentEvidenceRepository {
  item(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.healthcareCaseDispatchItem.findFirst({
      where: { id, companyId },
      include: {
        dispatch: true,
        sourceCaseKitItem: { include: { caseKit: true } },
        assignment: true,
      },
    });
  }
  audit(
    tx: Prisma.TransactionClient,
    companyId: string,
    dispatchId: string,
    revision: number,
  ) {
    return tx.healthcareCaseDispatchAudit.findFirst({
      where: {
        companyId,
        dispatchId,
        operation: 'CONFIRM',
        dispatchItemId: null,
        revisionBefore: revision,
        revisionAfter: revision + 1,
      },
    });
  }
  claim(
    tx: Prisma.TransactionClient,
    companyId: string,
    hash: string,
    resourceId: string | null,
  ) {
    return tx.idempotencyRecord.findFirst({
      where: {
        companyId,
        scope: 'HEALTHCARE_CASE_DISPATCH_CONFIRM',
        requestHash: hash,
        resourceId,
      },
    });
  }
  actor(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.user.findFirst({
      where: {
        id,
        companyId,
        isActive: true,
        role: { in: ['ADMIN', 'MANAGER', 'WAREHOUSE'] },
      },
      select: { id: true },
    });
  }
}
