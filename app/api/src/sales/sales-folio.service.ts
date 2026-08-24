import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CompanySequenceAllocatorService } from '../company-sequences/company-sequence-allocator.service';

const SALE_FOLIO_SEQUENCE_KEY = 'SALE_FOLIO';

@Injectable()
export class SalesFolioService {
  constructor(
    private readonly companySequenceAllocator: CompanySequenceAllocatorService,
  ) {}

  async allocateNextAvailableFolio(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    while (true) {
      const nextValue = await this.companySequenceAllocator.allocateNext(
        tx,
        companyId,
        SALE_FOLIO_SEQUENCE_KEY,
      );

      const folio = this.formatSalesFolio(nextValue);

      const existingSale = await tx.sale.findFirst({
        where: {
          companyId,
          folio,
        },
        select: {
          id: true,
        },
      });

      if (!existingSale) {
        return folio;
      }
    }
  }

  private formatSalesFolio(value: number) {
    return `V-${value.toString().padStart(6, '0')}`;
  }
}
