import { HealthcareCaseReconciliationAuditOperation } from '@prisma/client';
import { CreateHealthcareCaseReconciliationDto } from './dto/create-healthcare-case-reconciliation.dto';
import { AddHealthcareCaseReconciliationItemDto } from './dto/add-healthcare-case-reconciliation-item.dto';
import { SetHealthcareCaseReconciliationOutcomeDto } from './dto/set-healthcare-case-reconciliation-outcome.dto';
import { CancelHealthcareCaseReconciliationDto } from './dto/cancel-healthcare-case-reconciliation.dto';
import { mapReconciliationDetail } from './healthcare-case-reconciliation.mapper';
export type ReconciliationDraftOperation = Exclude<
  HealthcareCaseReconciliationAuditOperation,
  'CONFIRM'
>;
export type ReconciliationCommandIntent =
  | { operation: 'CREATE'; dto: CreateHealthcareCaseReconciliationDto }
  | { operation: 'ITEM_ADD'; dto: AddHealthcareCaseReconciliationItemDto }
  | { operation: 'OUTCOME_SET'; dto: SetHealthcareCaseReconciliationOutcomeDto }
  | { operation: 'ITEM_EXCLUDE'; dto: CancelHealthcareCaseReconciliationDto }
  | { operation: 'CANCEL'; dto: CancelHealthcareCaseReconciliationDto };
export interface ReconciliationCommandContext {
  companyId: string;
  actorId: string;
  caseId: string;
  reconciliationId?: string;
  itemId?: string;
  key: string;
}
export interface ReconciliationCommandReceipt {
  auditId: string;
  operation: HealthcareCaseReconciliationAuditOperation;
  reconciliationId: string;
  itemId: string | null;
  revisionBefore: number | null;
  revisionAfter: number;
  actorId: string;
  occurredAt: string;
}
export interface ReconciliationCommandResult {
  replay: boolean;
  command: ReconciliationCommandReceipt;
  data: ReturnType<typeof mapReconciliationDetail>;
}
