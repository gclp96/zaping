import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CompanySequenceAllocatorService } from '../company-sequences/company-sequence-allocator.service';

@Injectable()
export class PurchasesFolioService {
  constructor(private readonly sequences: CompanySequenceAllocatorService) {}

  async allocateNextAvailableFolio(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    // One database instant and the persisted Company timezone determine the year.
    const rows = await tx.$queryRaw<Array<{ year: number }>>(Prisma.sql`
      WITH issuance AS MATERIALIZED (SELECT clock_timestamp() AS instant)
      SELECT EXTRACT(YEAR FROM (issuance.instant AT TIME ZONE c.timezone))::int AS year
      FROM "Company" c CROSS JOIN issuance
      WHERE c.id = ${companyId}
    `);
    if (rows.length !== 1) throw new NotFoundException('Empresa no encontrada');
    const year = rows[0].year;
    const key = `PURCHASE_FOLIO:${year}`;

    // The allocator holds this Company/year counter lock until the caller commits.
    // Existing folios, including cancelled purchases, remain reserved.
    while (true) {
      const value = await this.sequences.allocateNext(tx, companyId, key);
      if (!Number.isInteger(value) || value < 1 || value > 99999) {
        throw new ConflictException({
          code: 'PURCHASE_FOLIO_EXHAUSTED',
          message: 'Se agotó la numeración anual de órdenes de compra.',
        });
      }
      const folio = `OC-${String(year).slice(-2).padStart(2, '0')}-${String(value).padStart(5, '0')}`;
      const existing = await tx.purchase.findFirst({
        where: { companyId, folio },
        select: { id: true },
      });
      if (!existing) return folio;
    }
  }
}
