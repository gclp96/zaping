import {
  BadRequestException,
  ConflictException,
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

export type UpdateHealthcareCaseInput = {
  title?: string;
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

type NormalizedUpdateHealthcareCaseInput = NormalizedCreateHealthcareCaseInput;

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

  async update(
    companyId: string,
    caseId: string,
    input: UpdateHealthcareCaseInput,
  ): Promise<HealthcareCase> {
    return this.prisma.$transaction(async (tx) => {
      const healthcareCase = await tx.healthcareCase.findFirst({
        where: {
          id: caseId,
          companyId,
        },
      });

      if (!healthcareCase) {
        throw new NotFoundException('Caso no encontrado');
      }

      if (healthcareCase.status === HealthcareCaseStatus.CANCELLED) {
        throw new ConflictException('El caso cancelado no puede modificarse');
      }

      const normalizedInput = this.normalizeUpdateInput(healthcareCase, input);

      if (this.hasDefinedOwn(input, 'responsibleUserId')) {
        if (normalizedInput.responsibleUserId) {
          await this.validateResponsibleUser(
            tx,
            companyId,
            normalizedInput.responsibleUserId,
          );
        }
      }

      const updateResult = await tx.healthcareCase.updateMany({
        where: {
          id: caseId,
          companyId,
          status: {
            in: [HealthcareCaseStatus.DRAFT, HealthcareCaseStatus.SCHEDULED],
          },
        },
        data: {
          title: normalizedInput.title,
          procedureDescription: normalizedInput.procedureDescription,
          status: normalizedInput.status,
          scheduledStart: normalizedInput.scheduledStart,
          scheduledEnd: normalizedInput.scheduledEnd,
          responsibleUserId: normalizedInput.responsibleUserId,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          'El caso cambió de estado durante la actualización. Intenta nuevamente',
        );
      }

      return this.findOneInTransaction(tx, companyId, caseId);
    });
  }

  async cancel(
    companyId: string,
    caseId: string,
    cancelledById: string,
    cancellationReason: string,
  ): Promise<HealthcareCase> {
    const normalizedReason =
      this.normalizeCancellationReason(cancellationReason);
    const cancelledAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const healthcareCase = await tx.healthcareCase.findFirst({
        where: {
          id: caseId,
          companyId,
        },
      });

      if (!healthcareCase) {
        throw new NotFoundException('Caso no encontrado');
      }

      if (healthcareCase.status === HealthcareCaseStatus.CANCELLED) {
        throw new ConflictException('El caso ya está cancelado');
      }

      await this.validateCancellationActor(tx, companyId, cancelledById);

      const updateResult = await tx.healthcareCase.updateMany({
        where: {
          id: caseId,
          companyId,
          status: {
            in: [HealthcareCaseStatus.DRAFT, HealthcareCaseStatus.SCHEDULED],
          },
        },
        data: {
          status: HealthcareCaseStatus.CANCELLED,
          cancelledAt,
          cancelledById,
          cancellationReason: normalizedReason,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          'El caso cambió de estado durante la cancelación. Intenta nuevamente',
        );
      }

      return this.findOneInTransaction(tx, companyId, caseId);
    });
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

    this.validateSchedule(scheduledStart, scheduledEnd);

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

  private normalizeUpdateInput(
    healthcareCase: HealthcareCase,
    input: UpdateHealthcareCaseInput,
  ): NormalizedUpdateHealthcareCaseInput {
    const title = this.hasDefinedOwn(input, 'title')
      ? this.normalizeTitle(input.title)
      : healthcareCase.title;

    const procedureDescription = this.hasDefinedOwn(
      input,
      'procedureDescription',
    )
      ? this.normalizeOptionalString(input.procedureDescription)
      : healthcareCase.procedureDescription;

    const scheduledStart = this.hasDefinedOwn(input, 'scheduledStart')
      ? (input.scheduledStart ?? null)
      : healthcareCase.scheduledStart;

    const scheduledEnd = this.hasDefinedOwn(input, 'scheduledEnd')
      ? (input.scheduledEnd ?? null)
      : healthcareCase.scheduledEnd;

    const responsibleUserId = this.hasDefinedOwn(input, 'responsibleUserId')
      ? (input.responsibleUserId ?? null)
      : healthcareCase.responsibleUserId;

    this.validateSchedule(scheduledStart, scheduledEnd);

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

  private normalizeTitle(title: string) {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      throw new BadRequestException('El título del caso es obligatorio');
    }

    return normalizedTitle;
  }

  private normalizeOptionalString(value?: string | null) {
    return value?.trim() || null;
  }

  private normalizeCancellationReason(cancellationReason: string) {
    const normalizedReason = cancellationReason.trim();

    if (!normalizedReason) {
      throw new BadRequestException('La razón de cancelación es obligatoria');
    }

    return normalizedReason;
  }

  private validateSchedule(
    scheduledStart: Date | null,
    scheduledEnd: Date | null,
  ) {
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
  }

  private hasOwn<T extends object>(
    object: T,
    key: PropertyKey,
  ): key is keyof T {
    return Boolean(Object.prototype.hasOwnProperty.call(object, key));
  }

  private hasDefinedOwn<T extends object, K extends keyof T>(
    object: T,
    key: K,
  ): object is T & Record<K, Exclude<T[K], undefined>> {
    return this.hasOwn(object, key) && object[key] !== undefined;
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

  private async validateCancellationActor(
    tx: Prisma.TransactionClient,
    companyId: string,
    cancelledById: string,
  ) {
    const cancelledBy = await tx.user.findFirst({
      where: {
        id: cancelledById,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!cancelledBy) {
      throw new BadRequestException('Usuario cancelador no válido');
    }
  }

  private async findOneInTransaction(
    tx: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
  ) {
    const healthcareCase = await tx.healthcareCase.findFirst({
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
}
