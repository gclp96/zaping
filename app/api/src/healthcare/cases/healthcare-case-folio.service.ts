import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CompanySequenceAllocatorService } from '../../company-sequences/company-sequence-allocator.service';

const HEALTHCARE_CASE_FOLIO_SEQUENCE_KEY = 'HEALTHCARE_CASE_FOLIO';

@Injectable()
export class HealthcareCaseFolioService {
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
        HEALTHCARE_CASE_FOLIO_SEQUENCE_KEY,
      );

      const folio = this.formatHealthcareCaseFolio(nextValue);

      const existingCase = await tx.healthcareCase.findFirst({
        where: {
          companyId,
          folio,
        },
        select: {
          id: true,
        },
      });

      if (!existingCase) {
        return folio;
      }
    }
  }

  private formatHealthcareCaseFolio(value: number) {
    return `CASE-${value.toString().padStart(6, '0')}`;
  }
}
