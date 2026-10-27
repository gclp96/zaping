import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import {
  verifyScanEvidence,
  type EvidenceVerificationPolicy,
  type SignedScanEvidence,
} from './supplier-attachment-signed-scan-evidence';

/** Not registered or reachable by HTTP. Production roles are NOT provisioned. */
type Job = {
  id: string;
  companyId: string;
  documentId: string;
  attachmentId: string;
  reservationId: string;
  requestNonce: string;
  quarantineKey: string;
  contentSizeBytes: number;
  contentSha256: string;
  issuedAt: Date;
  expiresAt: Date;
  dbNow: Date;
};

const invalid = () =>
  new ServiceUnavailableException('Atestación antimalware no verificable');

export class IsolatedVerifiedScanEvidenceGateway {
  constructor(
    private readonly db: PrismaClient,
    private readonly policy: EvidenceVerificationPolicy,
  ) {}

  async accept(companyId: string, nonce: string, submitted: unknown) {
    const validCompany = /^[0-9a-f-]{36}$/u.test(companyId);
    const validNonce = /^[0-9a-f-]{36}$/u.test(nonce);
    if (!validCompany || !validNonce) {
      throw invalid();
    }

    try {
      return await this.db.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<Job[]>(
            Prisma.sql`SELECT j."id", j."companyId", j."documentId",
              j."attachmentId", j."reservationId", j."requestNonce",
              j."quarantineKey", j."contentSizeBytes", j."contentSha256",
              j."issuedAt", j."expiresAt", clock_timestamp() AS "dbNow"
            FROM "SupplierAttachmentScanJob" j
            JOIN "SupplierAttachmentUploadReservation" r
              ON r."id" = j."reservationId" AND r."companyId" = j."companyId"
            JOIN "SupplierDocumentAttachment" a
              ON a."id" = j."attachmentId" AND a."companyId" = j."companyId"
            JOIN "SupplierDocument" d
              ON d."id" = j."documentId" AND d."companyId" = j."companyId"
            WHERE j."companyId" = ${companyId}
              AND j."requestNonce" = ${nonce}::uuid
              AND j."status" = 'ISSUED'
              AND r."status" = 'REGISTERED'
              AND a."status" = 'PENDING_SCAN'
              AND d."status" = 'ACTIVE'
              AND r."documentId" = j."documentId"
              AND a."documentId" = j."documentId"
              AND r."quarantineKey" = j."quarantineKey"
              AND r."sizeBytes" = j."contentSizeBytes"
              AND a."sizeBytes" = j."contentSizeBytes"
              AND r."sha256" = j."contentSha256"
              AND a."sha256" = j."contentSha256"
            FOR UPDATE OF j`,
          );
          if (rows.length !== 1) throw invalid();
          const job = rows[0];
          const now = job.dbNow.getTime();
          if (
            !Number.isFinite(now) ||
            now < job.issuedAt.getTime() ||
            now >= job.expiresAt.getTime()
          ) {
            throw invalid();
          }

          const claims = verifyScanEvidence(
            submitted,
            {
              companyId: job.companyId,
              documentId: job.documentId,
              attachmentId: job.attachmentId,
              reservationId: job.reservationId,
              requestNonce: job.requestNonce,
              contentSizeBytes: job.contentSizeBytes,
              contentSha256: job.contentSha256,
            },
            this.policy,
            now,
          );
          if (
            claims.quarantineKey !== job.quarantineKey ||
            Date.parse(claims.startedAt) <
              job.issuedAt.getTime() - this.policy.maxFutureClockSkewMs ||
            Date.parse(claims.completedAt) >
              job.expiresAt.getTime() + this.policy.maxFutureClockSkewMs
          ) {
            throw invalid();
          }

          const e = submitted as SignedScanEvidence;
          const attempt = await tx.supplierAttachmentScanAttempt.create({
            data: {
              companyId: job.companyId,
              attachmentId: job.attachmentId,
              reservationId: job.reservationId,
              requestNonce: job.requestNonce,
              contentSizeBytes: job.contentSizeBytes,
              contentSha256: job.contentSha256,
              verdict: claims.verdict,
              engineVersion: claims.engineVersion,
              databaseVersion: claims.databaseVersion,
              databaseBuiltAt: claims.databaseBuiltAt
                ? new Date(claims.databaseBuiltAt)
                : null,
              policyVersion: claims.policyVersion,
              workerIdentity: claims.workerIdentity,
              failureCode: claims.failureCode,
            },
          });
          const receipt =
            await tx.supplierAttachmentSignedEvidenceReceipt.create({
              data: {
                companyId: job.companyId,
                attemptId: attempt.id,
                requestNonce: job.requestNonce,
                signingKeyId: e.keyId,
                signature: e.signature,
                signedClaims: { ...claims },
              },
            });
          const consumed = await tx.$queryRaw<{ ok: boolean }[]>(
            Prisma.sql`SELECT "consume_supplier_attachment_scan_job"(
              ${job.companyId}::text, ${job.requestNonce}::uuid
            ) AS ok`,
          );
          if (consumed.length !== 1 || consumed[0].ok !== true) {
            throw invalid();
          }
          const audit = await tx.supplierAttachmentVerifiedScanEvidence.create({
            data: {
              id: randomUUID(),
              jobId: job.id,
              receiptId: receipt.id,
              companyId: job.companyId,
              requestNonce: job.requestNonce,
              signingKeyId: e.keyId,
              signatureSha256: createHash('sha256')
                .update(Buffer.from(e.signature, 'base64url'))
                .digest('hex'),
            },
          });
          return {
            auditId: audit.id,
            verdict: claims.verdict,
            releaseAuthorized: false as const,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch {
      throw invalid();
    }
  }
}
