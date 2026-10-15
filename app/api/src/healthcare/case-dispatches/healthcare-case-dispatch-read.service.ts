import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  caseNotFoundException,
  healthcarePersistenceException,
} from '../common/healthcare-errors';
import { HealthcareCaseDispatchListQueryDto } from './dto/healthcare-case-dispatch-list-query.dto';
import { HealthcareCaseDispatchesRepository } from './healthcare-case-dispatches.repository';
import {
  mapDispatchDetail,
  mapDispatchSummary,
} from './healthcare-case-dispatch.mapper';
@Injectable()
export class HealthcareCaseDispatchReadService {
  constructor(private readonly repo: HealthcareCaseDispatchesRepository) {}
  async list(
    companyId: string,
    caseId: string,
    q: HealthcareCaseDispatchListQueryDto,
  ) {
    try {
      return await this.repo.runInReadSnapshot(async (tx) => {
        if (!(await this.repo.findCase(companyId, caseId, tx)))
          throw caseNotFoundException();
        const r = await this.repo.list(companyId, caseId, q, tx);
        return {
          items: r.items.map(mapDispatchSummary),
          pagination: {
            page: q.page,
            pageSize: q.pageSize,
            totalItems: r.totalItems,
            totalPages: Math.ceil(r.totalItems / q.pageSize),
          },
        };
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw healthcarePersistenceException();
    }
  }
  async detail(companyId: string, caseId: string, id: string) {
    try {
      return await this.repo.runInReadSnapshot(async (tx) => {
        if (!(await this.repo.findCase(companyId, caseId, tx)))
          throw caseNotFoundException();
        const r = await this.repo.detail(companyId, caseId, id, tx);
        if (!r)
          throw new NotFoundException({
            statusCode: 404,
            error: 'Not Found',
            code: 'CASE_DISPATCH_NOT_FOUND',
            message: 'Despacho no encontrado',
          });
        return mapDispatchDetail(r);
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw healthcarePersistenceException();
    }
  }
}
