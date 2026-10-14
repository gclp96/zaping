import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// 01D seam only. No timestamp heuristic, manifest, backfill or cutover here.
@Injectable()
export class SalesLegacyClassifier {
  classify(
    _tx: Prisma.TransactionClient,
    _companyId: string,
    _saleId: string,
  ): Promise<'LEGACY' | 'PHYSICAL' | 'UNKNOWN'> {
    void _tx;
    void _companyId;
    void _saleId;
    return Promise.resolve('UNKNOWN');
  }
}
