import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { isAbsolute } from 'node:path';
import { inventoryAuthorityFence } from './inventory-authority-fence';
import { InventoryAuthorityError } from './inventory-authority-error';
import { InventoryCutoverVerifyService } from './inventory-cutover-verify.service';
import {
  assertCutoverControl,
  cutoverHash,
  cutoverId,
  cutoverInt,
  InventoryCutoverError,
} from './inventory-cutover.contract';
import {
  ActivationEvidenceAdapter,
  ActivationRequest,
} from './inventory-cutover-activation.contract';
import {
  INVENTORY_AUTHORITY_PROTOCOL,
  InventoryRuntimeCompatibilityService,
} from './inventory-runtime-compatibility.service';
import {
  assertCheckpointSet,
  assertOpeningProduct,
} from './inventory-opening-evidence';

export class InventoryCutoverActivationService {
  constructor(
    private readonly db: PrismaClient,
    private readonly verify: InventoryCutoverVerifyService,
    private readonly runtime: InventoryRuntimeCompatibilityService,
    private readonly evidence?: ActivationEvidenceAdapter,
  ) {}

  private conflict(): never {
    throw new InventoryAuthorityError('CUTOVER_ACTIVATION_PRECONDITION_FAILED');
  }
  private async proof(
    request: ActivationRequest,
    mode: 'ACTIVATE' | 'READBACK' | 'ROLLBACK_REVIEW',
  ) {
    [request.companyId, request.cutoverId, request.businessActorId].forEach(
      cutoverId,
    );
    cutoverInt(request.expectedRevision);
    cutoverHash(request.manifestDigest);
    cutoverHash(request.evidenceHash);
    if (
      !request.operatorId?.trim() ||
      !isAbsolute(request.evidencePath) ||
      !this.evidence
    )
      this.conflict();
    const identity = this.runtime.identity();
    if (
      identity.build !== request.expectedBuild ||
      identity.environment !== request.expectedEnvironment
    )
      throw new InventoryAuthorityError('INCOMPATIBLE_BUILD');
    const proof = await this.evidence.accept(request, mode);
    const from = Date.parse(proof.validFrom),
      until = Date.parse(proof.validUntil);
    if (
      !isDeepStrictEqual(request, proof.retainedRequest) ||
      proof.protocol !== INVENTORY_AUTHORITY_PROTOCOL ||
      !Number.isFinite(from) ||
      !Number.isFinite(until) ||
      from >= until ||
      !proof.freezeAccepted ||
      !proof.writerInventoryCertified ||
      !proof.staleRuntimeFenceCertified ||
      !proof.runtimeCertified
    )
      this.conflict();
    if (mode !== 'READBACK' && !(from <= Date.now() && Date.now() <= until))
      this.conflict();
    return proof;
  }

  async activate(request: ActivationRequest) {
    try {
      const m = await this.verify.load(
        request.companyId,
        request.cutoverId,
        request.manifestDigest,
      );
      return await this.db.$transaction(
        async (tx) => {
          await inventoryAuthorityFence(tx, request.companyId, 'exclusive');
          const c = await this.verify.opening.controlRepo.lock(
            tx,
            request.companyId,
            request.cutoverId,
          );
          if (!c) throw new NotFoundException();
          assertCutoverControl(c);
          if (
            !(await tx.user.findFirst({
              where: {
                id: request.businessActorId,
                companyId: request.companyId,
                role: 'ADMIN',
                isActive: true,
              },
            }))
          )
            throw new ForbiddenException();
          if (c.status === 'RECOVERY_REQUIRED')
            throw new InventoryAuthorityError('RECOVERY_REQUIRED');
          const proof = await this.proof(
            request,
            c.status === 'PHYSICAL_ACTIVE' ? 'READBACK' : 'ACTIVATE',
          );
          if (
            c.manifestDigest !== request.manifestDigest ||
            !c.manifestLockedAt ||
            c.snapshotFingerprint !== m.snapshotFingerprint ||
            c.baselineBuild !== m.baselineBuild
          )
            this.conflict();
          if (c.status === 'PHYSICAL_ACTIVE') {
            // Do not re-run opening revision-1 assertions after legitimate business.
            if (
              c.revision !== request.expectedRevision + 1 ||
              c.activatedBy !== request.businessActorId ||
              !c.activatedAt ||
              c.activatedAt.getTime() < Date.parse(proof.validFrom) ||
              c.activatedAt.getTime() > Date.parse(proof.validUntil)
            )
              this.conflict();
            const checkpoints = await assertCheckpointSet(tx, m);
            if (
              !checkpoints.every(
                (cp) => cp.status === 'VERIFIED' && cp.verifiedAt !== null,
              )
            )
              this.conflict();
            return { outcome: 'ALREADY_ACTIVATED' as const, control: c };
          }
          if (c.status !== 'VERIFIED')
            throw new InventoryAuthorityError('CUTOVER_NOT_VERIFIED');
          if (c.revision !== request.expectedRevision) this.conflict();
          const checked = await this.verify.inspect(
            tx,
            m,
            new Date().toISOString(),
          );
          if (
            !checked.cps.every(
              (cp) => cp.status === 'VERIFIED' && cp.verifiedAt !== null,
            )
          )
            this.conflict();
          // Evidence may expire while transactional verification runs.
          if (Date.now() > Date.parse(proof.validUntil)) this.conflict();
          const activatedAt = new Date();
          const result = await tx.inventoryCutover.updateMany({
            where: {
              id: c.id,
              companyId: c.companyId,
              status: 'VERIFIED',
              revision: request.expectedRevision,
              manifestDigest: request.manifestDigest,
              activatedAt: null,
              activatedBy: null,
            },
            data: {
              status: 'PHYSICAL_ACTIVE',
              activatedBy: request.businessActorId,
              activatedAt,
              revision: { increment: 1 },
            },
          });
          if (result.count !== 1) this.conflict();
          return {
            outcome: 'ACTIVATED' as const,
            control: await this.verify.opening.controlRepo.find(
              tx,
              c.companyId,
              c.id,
            ),
          };
        },
        { isolationLevel: 'ReadCommitted', timeout: 60000 },
      );
    } catch (error) {
      if (error instanceof InventoryCutoverError) this.conflict();
      throw error;
    }
  }

  async rollbackBoundary(request: ActivationRequest) {
    const m = await this.verify.load(
      request.companyId,
      request.cutoverId,
      request.manifestDigest,
    );
    return this.db.$transaction(
      async (tx) => {
        await inventoryAuthorityFence(tx, request.companyId, 'exclusive');
        const c = await this.verify.opening.controlRepo.lock(
          tx,
          request.companyId,
          request.cutoverId,
        );
        if (!c) throw new NotFoundException();
        assertCutoverControl(c);
        await this.verify.opening.authorize(
          tx,
          request.companyId,
          request.businessActorId,
        );
        if (
          c.status !== 'PHYSICAL_ACTIVE' ||
          c.manifestDigest !== request.manifestDigest ||
          c.revision !== request.expectedRevision + 1
        )
          this.conflict();
        const cps = await assertCheckpointSet(tx, m);
        if (!cps.every((cp) => cp.status === 'VERIFIED')) this.conflict();
        const openingIds = cps.flatMap((cp) =>
          cp.openingEffectId ? [cp.openingEffectId] : [],
        );
        const effects = await tx.inventoryPhysicalEffect.findMany({
          where: { companyId: request.companyId },
          select: { id: true, kind: true, originType: true, originId: true },
        });
        const baseline = new Set(openingIds);
        if (
          effects.some((e) => !baseline.has(e.id)) ||
          openingIds.some(
            (id) =>
              !effects.some(
                (e) =>
                  e.id === id &&
                  e.kind === 'OPENING' &&
                  e.originType === 'INVENTORY_OPENING' &&
                  e.originId === request.cutoverId,
              ),
          )
        ) {
          return {
            status: 'FREEZE_DIAGNOSE_FORWARD_FIX' as const,
            rollbackAllowed: false,
          };
        }
        const proof = await this.proof(request, 'ROLLBACK_REVIEW');
        if (!proof.beforeImagesCompatible) this.conflict();
        await this.verify.opening.reconciliation.revalidate(tx, m);
        for (const product of m.products)
          await assertOpeningProduct(tx, m, product, true);
        return {
          status: 'ROLLBACK_EVALUATION_ELIGIBLE' as const,
          rollbackAllowed: false,
        };
      },
      { isolationLevel: 'ReadCommitted', timeout: 60000 },
    );
  }
}
