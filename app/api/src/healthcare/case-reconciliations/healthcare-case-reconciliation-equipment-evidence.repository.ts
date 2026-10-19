import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
@Injectable()
export class HealthcareCaseReconciliationEquipmentEvidenceRepository {
  item(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.healthcareCaseReconciliationItem.findFirst({
      where: { id, companyId },
      include: {
        reconciliation: true,
        sourceDispatchItem: { include: { dispatch: true } },
        equipmentCustody: true,
        assignment: true,
        closePhysicalEvent: true,
      },
    });
  }
  audit(
    tx: Prisma.TransactionClient,
    companyId: string,
    reconciliationId: string,
    revision: number,
  ) {
    return tx.healthcareCaseReconciliationAudit.findFirst({
      where: {
        companyId,
        reconciliationId,
        operation: 'CONFIRM',
        reconciliationItemId: null,
        revisionBefore: revision,
        revisionAfter: revision + 1,
      },
    });
  }
  claim(
    tx: Prisma.TransactionClient,
    companyId: string,
    requestHash: string,
    resourceId: string | null,
  ) {
    return tx.idempotencyRecord.findFirst({
      where: {
        companyId,
        scope: 'HEALTHCARE_CASE_RECONCILIATION_CONFIRM',
        requestHash,
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
