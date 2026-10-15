import { HealthcareCaseDispatchAuditOperation } from '@prisma/client';
import { CreateHealthcareCaseDispatchDto } from './dto/create-healthcare-case-dispatch.dto';
import { SetHealthcareCaseDispatchCustodianDto } from './dto/set-healthcare-case-dispatch-custodian.dto';
import { AddHealthcareCaseDispatchItemDto } from './dto/add-healthcare-case-dispatch-item.dto';
import { CancelHealthcareCaseDispatchDto } from './dto/cancel-healthcare-case-dispatch.dto';
import { mapDispatchDetail } from './healthcare-case-dispatch.mapper';
export type DraftOperation = Exclude<
  HealthcareCaseDispatchAuditOperation,
  'CONFIRM'
>;
export type DispatchCommandIntent =
  | { operation: 'CREATE'; dto: CreateHealthcareCaseDispatchDto }
  | { operation: 'CUSTODIAN_SET'; dto: SetHealthcareCaseDispatchCustodianDto }
  | { operation: 'ITEM_ADD'; dto: AddHealthcareCaseDispatchItemDto }
  | {
      operation: 'ITEM_EXCLUDE' | 'CANCEL';
      dto: CancelHealthcareCaseDispatchDto;
    };
export interface DispatchCommandContext {
  companyId: string;
  actorId: string;
  caseId: string;
  dispatchId?: string;
  itemId?: string;
  key: string;
}
export interface DispatchCommandReceipt {
  auditId: string;
  operation: HealthcareCaseDispatchAuditOperation;
  dispatchId: string;
  itemId: string | null;
  revisionBefore: number | null;
  revisionAfter: number;
  actorId: string;
  occurredAt: string;
}
export interface DispatchCommandResult {
  replay: boolean;
  command: DispatchCommandReceipt;
  data: ReturnType<typeof mapDispatchDetail>;
}
