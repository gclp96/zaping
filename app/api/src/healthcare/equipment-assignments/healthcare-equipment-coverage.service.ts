import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  caseNotFoundException,
  requirementNotFoundException,
  healthcarePersistenceException,
} from '../common/healthcare-errors';
import { HealthcareEquipmentAssignmentsService } from './healthcare-equipment-assignments.service';
import { HealthcareEquipmentAssignmentsRepository } from './healthcare-equipment-assignments.repository';
import {
  resolveEquipmentAssignmentBuffers,
  equipmentAssignmentAssetIsEligible,
} from './healthcare-equipment-assignment-availability';
import { aggregateRequirementAvailability } from './healthcare-equipment-coverage-availability';
import { HealthcareEquipmentCoverageNotesQueryDto } from './dto/healthcare-equipment-coverage-notes-query.dto';

export function deriveCoverageQuantities(
  requestedQty: number,
  nominalAssignedQty: number,
  assignedQty: number,
  unavailable: boolean,
) {
  return {
    requestedQty,
    nominalAssignedQty,
    assignedQty,
    missingQty: Math.max(requestedQty - assignedQty, 0),
    quantityState:
      assignedQty === 0
        ? unavailable
          ? 'UNAVAILABLE'
          : 'PENDING'
        : assignedQty < requestedQty
          ? 'PARTIAL'
          : 'COVERED',
  };
}

@Injectable()
export class HealthcareEquipmentCoverageService {
  constructor(
    private readonly repository: HealthcareEquipmentAssignmentsRepository,
    private readonly assignments: HealthcareEquipmentAssignmentsService,
  ) {}

  private async readSnapshot<T>(
    read: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.repository.runInReadSnapshot(read);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw healthcarePersistenceException();
    }
  }

  private async assertCase(
    tx: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
  ) {
    const record = await this.repository.findCase(companyId, caseId, tx);
    if (!record) throw caseNotFoundException();
  }

  findCoverage(companyId: string, caseId: string) {
    return this.readSnapshot(async (tx) => {
      await this.assertCase(tx, companyId, caseId);
      const requirements = await this.repository.findCoverageRequirements(
        companyId,
        caseId,
        tx,
      );
      const records = await this.repository.findCoverageAssignments(
        companyId,
        caseId,
        requirements.map((r) => r.id),
        tx,
      );
      const applicable = records.filter((record) => {
        const requirement = requirements.find(
          (r) => r.id === record.requirementId,
        );
        return (
          requirement?.product.id === record.equipmentAsset.productId &&
          equipmentAssignmentAssetIsEligible(record.equipmentAsset)
        );
      });
      const settings = await this.repository.findSettings(companyId, tx);
      const reservations =
        applicable.length === 0
          ? []
          : await this.repository.findReservedAssignmentsForAssets(
              companyId,
              [...new Set(applicable.map((r) => r.equipmentAsset.id))],
              tx,
            );
      const buffers = resolveEquipmentAssignmentBuffers(settings);
      return {
        items: requirements.map((requirement) => {
          const effective = applicable.filter(
            (r) => r.requirementId === requirement.id,
          );
          return {
            requirementId: requirement.id,
            product: requirement.product,
            ...deriveCoverageQuantities(
              requirement.requestedQty,
              records.filter((r) => r.requirementId === requirement.id).length,
              effective.length,
              requirement.equipmentCoverageNotes.some(
                (note) => note.kind === 'UNAVAILABLE',
              ),
            ),
            availability: aggregateRequirementAvailability(
              effective.map((record) =>
                this.assignments.evaluateCoverageAssignment(
                  record,
                  buffers,
                  reservations,
                ),
              ),
            ),
            activeNotes: requirement.equipmentCoverageNotes,
          };
        }),
      };
    });
  }

  findNotes(
    companyId: string,
    caseId: string,
    requirementId: string,
    query: HealthcareEquipmentCoverageNotesQueryDto,
  ) {
    return this.readSnapshot(async (tx) => {
      await this.assertCase(tx, companyId, caseId);
      const requirement = await this.repository.findCoverageRequirement(
        companyId,
        caseId,
        requirementId,
        tx,
      );
      if (!requirement) throw requirementNotFoundException();
      const totalItems = await this.repository.countCoverageNotes(
        companyId,
        requirementId,
        tx,
      );
      const items = await this.repository.findCoverageNotes(
        companyId,
        requirementId,
        query.page,
        query.pageSize,
        tx,
      );
      return {
        items,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / query.pageSize),
        },
      };
    });
  }
}
