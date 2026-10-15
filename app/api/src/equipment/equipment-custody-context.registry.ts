import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { equipmentPhysicalAssert } from './equipment-physical.contract';

export type EquipmentCustodyCommand = {
  companyId: string;
  assetId: string;
  assignmentId: string;
  caseId: string;
  expectedPhysicalRevision: number;
  validatedContext: { adapterKey: string; contextId: string };
  actorId: string;
  durableOrigin: { type: string; id: string; operation: string };
};
export interface EquipmentCustodyContextAdapter {
  readonly key: string;
  readonly originType: string;
  readonly originOperation: string;
  // Must authenticate caller permission and retained real domain evidence in tx.
  // Read-only validation within the caller's existing lock scope; no later lock acquisition.
  // Strings supplied in the command are references, never proof by themselves.
  validate(
    tx: Prisma.TransactionClient,
    command: EquipmentCustodyCommand,
    requestHash: string,
    mode: 'APPLY' | 'REPLAY',
  ): Promise<{
    companyId: string;
    assetId: string;
    caseId: string;
    assignmentId: string;
    contextId: string;
    originId: string;
    requestHash: string;
  }>;
}
export const EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS = Symbol(
  'EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS',
);

@Injectable()
export class EquipmentCustodyContextRegistry {
  constructor(
    @Optional()
    @Inject(EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS)
    private readonly adapters: readonly EquipmentCustodyContextAdapter[] = [],
  ) {
    if (new Set(adapters.map((a) => a.key)).size !== adapters.length)
      throw new Error('Duplicate Equipment custody adapter');
  }
  async validate(
    tx: Prisma.TransactionClient,
    command: EquipmentCustodyCommand,
    hash: string,
    mode: 'APPLY' | 'REPLAY',
  ) {
    const adapter = this.adapters.find(
      (a) => a.key === command.validatedContext.adapterKey,
    );
    equipmentPhysicalAssert(
      adapter &&
        adapter.originType === command.durableOrigin.type &&
        adapter.originOperation === command.durableOrigin.operation,
      'RESOURCE_STATE_CHANGED',
    );
    const proof = await adapter.validate(tx, command, hash, mode);
    equipmentPhysicalAssert(
      proof &&
        proof.companyId === command.companyId &&
        proof.assetId === command.assetId &&
        proof.caseId === command.caseId &&
        proof.assignmentId === command.assignmentId &&
        proof.contextId === command.validatedContext.contextId &&
        proof.originId === command.durableOrigin.id &&
        proof.requestHash === hash,
      'RESOURCE_STATE_CHANGED',
    );
  }
}
