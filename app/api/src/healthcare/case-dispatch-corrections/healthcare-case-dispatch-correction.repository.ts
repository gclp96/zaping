import { Prisma } from '@prisma/client';
import {
  assertDispatchCorrectionReplayHash,
  DISPATCH_CORRECTION_SCOPE,
} from './healthcare-case-dispatch-correction.contract';

export type DispatchCorrectionLookup = {
  companyId: string;
  caseId: string;
  dispatchId: string;
};

// Internal read only. Deliberately unregistered: no module/controller/provider,
// physical writer or public response contract is activated by this slice.
export class HealthcareCaseDispatchCorrectionRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  findWitness(context: DispatchCorrectionLookup) {
    return this.db.healthcareCaseDispatchCorrection.findFirst({
      where: {
        ...context,
        status: 'CONFIRMED',
        snapshot: { not: Prisma.DbNull },
      },
      include: { items: { orderBy: { sourceDispatchItemId: 'asc' } } },
    });
  }

  async findReplay(
    context: DispatchCorrectionLookup,
    key: string,
    requestHash: string,
  ) {
    const recorded = await this.db.idempotencyRecord.findUnique({
      where: {
        companyId_scope_key: {
          companyId: context.companyId,
          scope: DISPATCH_CORRECTION_SCOPE,
          key,
        },
      },
    });
    if (!recorded) return null;
    assertDispatchCorrectionReplayHash(recorded.requestHash, requestHash);
    const witness = await this.findWitness(context);
    if (
      !witness ||
      witness.id !== recorded.resourceId ||
      witness.idempotencyRecordId !== recorded.id ||
      witness.requestHash !== recorded.requestHash
    ) {
      throw new Error('Correction idempotency witness inconsistent');
    }
    return witness;
  }
}
