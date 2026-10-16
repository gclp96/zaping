import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EquipmentCustodyCloseCommand } from './equipment-custody-close.contract';
import { equipmentPhysicalAssert } from './equipment-physical.contract';

export interface EquipmentCustodyCloseContextAdapter {
  readonly key: string;
  readonly originType: string;
  readonly originOperation: string;
  // Authenticate retained domain evidence and actor permission in the caller tx.
  // Read only: no physical writes or late row locks. Command references are not proof.
  validate(
    this: void,
    tx: Prisma.TransactionClient,
    command: EquipmentCustodyCloseCommand,
    requestHash: string,
    mode: 'APPLY' | 'REPLAY',
  ): Promise<{
    companyId: string;
    assetId: string;
    custodyId: string;
    caseId: string;
    assignmentId: string;
    contextId: string;
    actorId: string;
    originType: string;
    originId: string;
    originOperation: string;
    requestHash: string;
  }>;
}
export const EQUIPMENT_CUSTODY_CLOSE_CONTEXT_ADAPTERS = Symbol(
  'EQUIPMENT_CUSTODY_CLOSE_CONTEXT_ADAPTERS',
);
@Injectable()
export class EquipmentCustodyCloseContextRegistry {
  private readonly adapters: readonly EquipmentCustodyCloseContextAdapter[];
  constructor(
    @Optional()
    @Inject(EQUIPMENT_CUSTODY_CLOSE_CONTEXT_ADAPTERS)
    adapters: readonly EquipmentCustodyCloseContextAdapter[] = [],
  ) {
    if (new Set(adapters.map((a) => a.key)).size !== adapters.length)
      throw new Error('Duplicate Equipment custody close adapter');
    this.adapters = Object.freeze([...adapters]);
  }
  async validate(
    tx: Prisma.TransactionClient,
    c: EquipmentCustodyCloseCommand,
    hash: string,
    mode: 'APPLY' | 'REPLAY',
  ) {
    const adapter = this.adapters.find(
      (a) => a.key === c.validatedContext.adapterKey,
    );
    equipmentPhysicalAssert(
      adapter &&
        adapter.originType === c.durableOrigin.type &&
        adapter.originOperation === c.durableOrigin.operation,
      'RESOURCE_STATE_CHANGED',
    );
    const proof = await adapter.validate(tx, c, hash, mode);
    equipmentPhysicalAssert(
      proof &&
        proof.companyId === c.companyId &&
        proof.assetId === c.assetId &&
        proof.custodyId === c.custodyId &&
        proof.caseId === c.caseId &&
        proof.assignmentId === c.assignmentId &&
        proof.contextId === c.validatedContext.contextId &&
        proof.actorId === c.actorId &&
        proof.originType === c.durableOrigin.type &&
        proof.originId === c.durableOrigin.id &&
        proof.originOperation === c.durableOrigin.operation &&
        proof.requestHash === hash,
      'RESOURCE_STATE_CHANGED',
    );
  }
}
