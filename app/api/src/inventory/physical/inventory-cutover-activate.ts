import { PrismaClient } from '@prisma/client';
import { isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import {
  InventoryActivationAdapters,
  ActivationRequest,
} from './inventory-cutover-activation.contract';
import { InventoryCutoverActivationService } from './inventory-cutover-activation.service';
import { InventoryCutoverVerifyService } from './inventory-cutover-verify.service';
import { InventoryOpeningService } from './inventory-opening.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';
import { OpeningArtifact } from './inventory-opening-artifact';
import { InventoryRuntimeCompatibilityService } from './inventory-runtime-compatibility.service';

// Internal operator CLI. Never loaded by AppModule. No default Company, evidence,
// adapter or environment; DATABASE_URL remains the operator's explicit configuration.
export async function activateFromArguments(args: string[]) {
  const names = [
    'companyId',
    'cutoverId',
    'expectedRevision',
    'manifestDigest',
    'manifestPath',
    'evidencePath',
    'evidenceHash',
    'expectedBuild',
    'expectedEnvironment',
    'businessActorId',
    'operatorId',
    'repositoryRoot',
  ];
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    if (
      !args[i]?.startsWith('--') ||
      !names.includes(key) ||
      values.has(key) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error('Explicit activation arguments required');
    values.set(key, args[i + 1]);
  }
  if (
    values.size !== names.length ||
    !/^\d+$/.test(values.get('expectedRevision')!)
  )
    throw new Error('Explicit activation arguments required');
  const adapterPath = process.env.INVENTORY_ACTIVATION_ADAPTER_PATH;
  if (!adapterPath || !isAbsolute(adapterPath))
    throw new Error('Trusted operational evidence adapter is not configured');
  // Installation/configuration is privileged; never take executable adapter paths
  // from the request or evidence file. Adapter must validate actual external proof.
  const module = createRequire(__filename)(adapterPath) as {
    createInventoryActivationAdapters?: () => Promise<InventoryActivationAdapters>;
  };
  if (typeof module.createInventoryActivationAdapters !== 'function')
    throw new Error('Invalid evidence adapter');
  const adapters = await module.createInventoryActivationAdapters();
  if (!adapters.activation || !adapters.opening || !adapters.custody)
    throw new Error('Incomplete evidence adapter');
  const runtime = new InventoryRuntimeCompatibilityService();
  runtime.identity();
  const db = new PrismaClient();
  try {
    const verification = new InventoryCutoverVerifyService(
      new InventoryOpeningService(
        new InventoryReconciliationService(adapters.opening, adapters.custody),
      ),
      new OpeningArtifact(
        values.get('manifestPath')!,
        values.get('repositoryRoot')!,
      ),
    );
    const request: ActivationRequest = {
      companyId: values.get('companyId')!,
      cutoverId: values.get('cutoverId')!,
      expectedRevision: Number(values.get('expectedRevision')),
      manifestDigest: values.get('manifestDigest')!,
      evidencePath: values.get('evidencePath')!,
      evidenceHash: values.get('evidenceHash')!,
      expectedBuild: values.get('expectedBuild')!,
      expectedEnvironment: values.get('expectedEnvironment')!,
      businessActorId: values.get('businessActorId')!,
      operatorId: values.get('operatorId')!,
    };
    const result = await new InventoryCutoverActivationService(
      db,
      verification,
      runtime,
      adapters.activation,
    ).activate(request);
    return {
      outcome: result.outcome,
      companyId: request.companyId,
      cutoverId: request.cutoverId,
      revision: result.control?.revision,
      activatedBy: result.control?.activatedBy,
      activatedAt: result.control?.activatedAt,
    };
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module) {
  activateFromArguments(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      // Do not leak configuration, credentials, adapter or database diagnostics.
      console.error(
        'Activation failed; retain the request and use coherent readback before retrying.',
      );
      process.exitCode = 1;
    });
}
