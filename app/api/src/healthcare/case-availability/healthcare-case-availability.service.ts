import { HttpException, Injectable } from '@nestjs/common';
import { HealthcareCaseKitsRepository } from '../case-kits/healthcare-case-kits.repository';
import { evaluateHealthcareCaseKitReadiness } from '../case-kits/healthcare-case-kit-readiness';
import {
  caseNotFoundException,
  healthcarePersistenceException,
} from '../common/healthcare-errors';
import {
  deriveEquipmentAssignmentOperationalWindow,
  INCOMPLETE_CASE_SCHEDULE_WARNING,
  resolveEquipmentAssignmentBuffers,
} from '../equipment-assignments/healthcare-equipment-assignment-availability';
import { HealthcareEquipmentAssignmentsRepository } from '../equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../equipment-assignments/healthcare-equipment-assignments.service';
import { aggregateRequirementAvailability } from '../equipment-assignments/healthcare-equipment-coverage-availability';
import { HealthcareEquipmentCoverageService } from '../equipment-assignments/healthcare-equipment-coverage.service';
import { HealthcareCaseAvailabilityRepository } from './healthcare-case-availability.repository';

@Injectable()
export class HealthcareCaseAvailabilityService {
  constructor(
    private readonly repository: HealthcareCaseAvailabilityRepository,
    private readonly coverage: HealthcareEquipmentCoverageService,
    private readonly assignments: HealthcareEquipmentAssignmentsService,
    private readonly equipmentRepository: HealthcareEquipmentAssignmentsRepository,
    private readonly kits: HealthcareCaseKitsRepository,
  ) {}

  async findAvailability(companyId: string, caseId: string) {
    try {
      return await this.repository.runInReadSnapshot(async (tx) => {
        const healthcareCase = await this.repository.findCase(
          companyId,
          caseId,
          tx,
        );
        if (!healthcareCase) throw caseNotFoundException();
        const requirements = await this.repository.findActiveRequirements(
          companyId,
          caseId,
          tx,
        );
        const coverage = await this.coverage.findCoverageInSnapshot(
          companyId,
          caseId,
          tx,
        );
        const records = await this.repository.findReservedAssignments(
          companyId,
          caseId,
          tx,
        );
        const settings = await this.equipmentRepository.findSettings(
          companyId,
          tx,
        );
        const buffers = resolveEquipmentAssignmentBuffers(settings);
        const reservations =
          records.length === 0
            ? []
            : await this.equipmentRepository.findReservedAssignmentsForAssets(
                companyId,
                [...new Set(records.map((r) => r.equipmentAsset.id))],
                tx,
              );
        const kit = await this.kits.findKitByCase(companyId, caseId, tx);
        const readiness = kit ? evaluateHealthcareCaseKitReadiness(kit) : null;
        // Collapse only the public blocker scope; item detail remains in CaseKit GET.
        const blockers = readiness?.blockers.map(({ code, requirementId }) => ({
          code,
          ...(requirementId ? { requirementId } : {}),
        }));
        const seen = new Set<string>();
        const complete =
          deriveEquipmentAssignmentOperationalWindow(
            healthcareCase,
            buffers,
          ) !== null;
        return {
          caseId: healthcareCase.id,
          caseStatus: healthcareCase.status,
          schedule: {
            scheduledStart: healthcareCase.scheduledStart,
            scheduledEnd: healthcareCase.scheduledEnd,
            complete,
            warnings: complete ? [] : [{ ...INCOMPLETE_CASE_SCHEDULE_WARNING }],
          },
          requirements: {
            activeCount: requirements.length,
            requiredCount: requirements.filter((r) => r.type === 'REQUIRED')
              .length,
            backupCount: requirements.filter((r) => r.type === 'BACKUP').length,
          },
          coverage: {
            requirementCount: coverage.items.length,
            coveredCount: coverage.items.filter(
              (r) => r.quantityState === 'COVERED',
            ).length,
            partialCount: coverage.items.filter(
              (r) => r.quantityState === 'PARTIAL',
            ).length,
            pendingCount: coverage.items.filter(
              (r) => r.quantityState === 'PENDING',
            ).length,
            unavailableCount: coverage.items.filter(
              (r) => r.quantityState === 'UNAVAILABLE',
            ).length,
            activeNoteCount: coverage.items.reduce(
              (count, r) => count + r.activeNotes.length,
              0,
            ),
          },
          equipment: {
            reservedAssignmentCount: records.length,
            ...aggregateRequirementAvailability(
              records.map((record) =>
                this.assignments.evaluateCoverageAssignment(
                  record,
                  buffers,
                  reservations,
                ),
              ),
            ),
          },
          preparation: {
            caseKitId: kit?.id ?? null,
            status: kit?.status ?? null,
            readiness: readiness
              ? {
                  status: readiness.status,
                  blockers: blockers!.filter((blocker) => {
                    const key = `${blocker.code}:${blocker.requirementId ?? ''}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  }),
                }
              : null,
          },
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw healthcarePersistenceException();
    }
  }
}
