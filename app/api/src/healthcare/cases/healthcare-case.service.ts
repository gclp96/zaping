import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HealthcareCase, HealthcareCaseStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { HealthcareCaseFolioService } from './healthcare-case-folio.service';

export type CreateHealthcareCaseInput = {
  title: string;
  procedureDescription?: string | null;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
  responsibleUserId?: string | null;
};

type NormalizedCreateHealthcareCaseInput = {
  title: string;
  procedureDescription: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  responsibleUserId: string | null;
  status: HealthcareCaseStatus;
};

@Injectable()
export class HealthcareCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthcareCaseFolioService: HealthcareCaseFolioService,
  ) {}

  async create(
    companyId: string,
    createdById: string,
    input: CreateHealthcareCaseInput,
  ): Promise<HealthcareCase> {
    const normalizedInput = this.normalizeCreateInput(input);

    return this.prisma.$transaction(async (tx) => {
      await this.validateCreator(tx, companyId, createdById);

      if (normalizedInput.responsibleUserId) {
        await this.validateResponsibleUser(
          tx,
          companyId,
          normalizedInput.responsibleUserId,
        );
      }

      const folio =
        await this.healthcareCaseFolioService.allocateNextAvailableFolio(
          tx,
          companyId,
        );

      return tx.healthcareCase.create({
        data: {
          companyId,
          folio,
          title: normalizedInput.title,
          procedureDescription: normalizedInput.procedureDescription,
          status: normalizedInput.status,
          scheduledStart: normalizedInput.scheduledStart,
          scheduledEnd: normalizedInput.scheduledEnd,
          responsibleUserId: normalizedInput.responsibleUserId,
          createdById,
          cancelledAt: null,
          cancelledById: null,
          cancellationReason: null,
        },
      });
    });
  }

  async findAll(companyId: string): Promise<HealthcareCase[]> {
    return this.prisma.healthcareCase.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(companyId: string, caseId: string): Promise<HealthcareCase> {
    const healthcareCase = await this.prisma.healthcareCase.findFirst({
      where: {
        id: caseId,
        companyId,
      },
    });

    if (!healthcareCase) {
      throw new NotFoundException('Caso no encontrado');
    }

    return healthcareCase;
  }

  private normalizeCreateInput(
    input: CreateHealthcareCaseInput,
  ): NormalizedCreateHealthcareCaseInput {
    const title = input.title.trim();

    if (!title) {
      throw new BadRequestException('El título del caso es obligatorio');
    }

    const procedureDescription = input.procedureDescription?.trim() || null;
    const scheduledStart = input.scheduledStart ?? null;
    const scheduledEnd = input.scheduledEnd ?? null;
    const responsibleUserId = input.responsibleUserId ?? null;

    if (!scheduledStart && scheduledEnd) {
      throw new BadRequestException('La fecha de fin requiere fecha de inicio');
    }

    if (
      scheduledStart &&
      scheduledEnd &&
      scheduledEnd.getTime() <= scheduledStart.getTime()
    ) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    return {
      title,
      procedureDescription,
      scheduledStart,
      scheduledEnd,
      responsibleUserId,
      status: scheduledStart
        ? HealthcareCaseStatus.SCHEDULED
        : HealthcareCaseStatus.DRAFT,
    };
  }

  private async validateCreator(
    tx: Prisma.TransactionClient,
    companyId: string,
    createdById: string,
  ) {
    const creator = await tx.user.findFirst({
      where: {
        id: createdById,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!creator) {
      throw new BadRequestException('Usuario creador no válido');
    }
  }

  private async validateResponsibleUser(
    tx: Prisma.TransactionClient,
    companyId: string,
    responsibleUserId: string,
  ) {
    const responsibleUser = await tx.user.findFirst({
      where: {
        id: responsibleUserId,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!responsibleUser) {
      throw new BadRequestException('Usuario responsable no válido');
    }
  }
}
