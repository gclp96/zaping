import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type RequirementOperationalEvidenceContext = {
  companyId: string;
  caseId: string;
  requirementId: string;
  productId: string;
};

export interface RequirementOperationalEvidencePolicy {
  assertMutable(
    transaction: Prisma.TransactionClient,
    context: RequirementOperationalEvidenceContext,
  ): Promise<void>;
}

export const REQUIREMENT_OPERATIONAL_EVIDENCE_POLICY = Symbol(
  'REQUIREMENT_OPERATIONAL_EVIDENCE_POLICY',
);

@Injectable()
export class NoopRequirementOperationalEvidencePolicy implements RequirementOperationalEvidencePolicy {
  assertMutable(
    transaction: Prisma.TransactionClient,
    context: RequirementOperationalEvidenceContext,
  ): Promise<void> {
    void transaction;
    void context;

    return Promise.resolve();
  }
}
