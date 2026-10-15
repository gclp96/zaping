import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { EquipmentPhysicalBaselineService } from './equipment-physical-baseline.service';
import {
  EquipmentBaselineCommand,
  EquipmentBaselineEvidenceAdapter,
  validateEquipmentBaseline,
} from './equipment-physical.contract';

// Explicit single-Asset operator CLI. Never imported by application modules.
export async function equipmentBaselineFromArguments(args: string[]) {
  const required = [
    'companyId',
    'assetId',
    'reconciliationId',
    'expectedPhysicalRevision',
    'targetPhysicalLocation',
    'operatorIdentity',
    'evidenceReference',
    'evidenceHash',
  ];
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]?.slice(2);
    if (
      !args[i]?.startsWith('--') ||
      ![...required, 'businessActorId'].includes(name) ||
      values.has(name) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error('Explicit single-Asset baseline arguments required');
    values.set(name, args[i + 1]);
  }
  if (
    !required.every((name) => values.has(name)) ||
    !/^\d+$/.test(values.get('expectedPhysicalRevision')!)
  )
    throw new Error('Explicit single-Asset baseline arguments required');
  const command: EquipmentBaselineCommand = {
    companyId: values.get('companyId')!,
    assetId: values.get('assetId')!,
    reconciliationId: values.get('reconciliationId')!,
    expectedPhysicalRevision: Number(values.get('expectedPhysicalRevision')),
    targetPhysicalLocation: values.get(
      'targetPhysicalLocation',
    )! as 'WAREHOUSE',
    operatorIdentity: values.get('operatorIdentity')!,
    evidenceReference: values.get('evidenceReference')!,
    evidenceHash: values.get('evidenceHash')!,
    ...(values.has('businessActorId')
      ? { businessActorId: values.get('businessActorId')! }
      : {}),
  };
  validateEquipmentBaseline(command);
  // Executable adapter path comes ONLY from privileged configuration, never CLI/evidence.
  const adapterPath = process.env.EQUIPMENT_BASELINE_EVIDENCE_ADAPTER_PATH;
  if (!adapterPath || !isAbsolute(adapterPath))
    throw new Error('Trusted warehouse evidence adapter is not configured');
  const adapterModule = createRequire(__filename)(adapterPath) as {
    createEquipmentBaselineEvidenceAdapter?: () => Promise<EquipmentBaselineEvidenceAdapter>;
  };
  if (
    typeof adapterModule.createEquipmentBaselineEvidenceAdapter !== 'function'
  )
    throw new Error('Invalid evidence adapter');
  const adapter = await adapterModule.createEquipmentBaselineEvidenceAdapter();
  if (!adapter || typeof adapter.accept !== 'function')
    throw new Error('Invalid evidence adapter');
  // No database client is instantiated before explicit arguments/adapter validation.
  const db = new PrismaClient();
  try {
    const result = await new EquipmentPhysicalBaselineService(
      db,
      adapter,
    ).reconcile(command);
    return {
      outcome: result.outcome,
      eventId: result.event.id,
      assetId: command.assetId,
      revision: result.event.revisionAfter,
    };
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module) {
  equipmentBaselineFromArguments(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        'Equipment baseline failed; retain the exact request before retrying.',
      );
      process.exitCode = 1;
    });
}
