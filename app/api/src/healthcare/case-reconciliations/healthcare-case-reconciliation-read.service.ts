import { Prisma } from '@prisma/client';
import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  caseNotFoundException,
  healthcarePersistenceException,
} from '../common/healthcare-errors';
import { HealthcareCaseReconciliationsRepository } from './healthcare-case-reconciliations.repository';
import { HealthcareCaseReconciliationListQueryDto } from './dto/healthcare-case-reconciliation-list-query.dto';
import {
  mapReconciliation,
  mapReconciliationDetail,
} from './healthcare-case-reconciliation.mapper';
import { deriveReconciliationSummary } from './healthcare-case-reconciliation-summary';
@Injectable()
export class HealthcareCaseReconciliationReadService {
  constructor(private readonly repo: HealthcareCaseReconciliationsRepository) {}
  private async read<T>(
    companyId: string,
    caseId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.repo.runInReadSnapshot(async (tx) => {
        if (!(await this.repo.findCase(companyId, caseId, tx)))
          throw caseNotFoundException();
        return fn(tx);
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw healthcarePersistenceException();
    }
  }
  list(
    companyId: string,
    caseId: string,
    q: HealthcareCaseReconciliationListQueryDto,
  ) {
    return this.read(companyId, caseId, async (tx) => {
      const r = await this.repo.list(companyId, caseId, q, tx);
      return {
        items: r.items.map(mapReconciliation),
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          totalItems: r.totalItems,
          totalPages: Math.ceil(r.totalItems / q.pageSize),
        },
      };
    });
  }
  detail(companyId: string, caseId: string, id: string) {
    return this.read(companyId, caseId, async (tx) => {
      const r = await this.repo.detail(companyId, caseId, id, tx);
      if (!r)
        throw new NotFoundException({
          code: 'CASE_RECONCILIATION_NOT_FOUND',
          message: 'Reconciliación no encontrada',
        });
      return mapReconciliationDetail(r);
    });
  }
  summary(companyId: string, caseId: string, id: string) {
    return this.read(companyId, caseId, async (tx) => {
      const d = await this.repo.summary(companyId, caseId, id, tx);
      if (!d)
        throw new NotFoundException({
          code: 'CASE_DISPATCH_NOT_FOUND',
          message: 'Despacho no encontrado',
        });
      return deriveReconciliationSummary(d.id, d.items);
    });
  }
}
