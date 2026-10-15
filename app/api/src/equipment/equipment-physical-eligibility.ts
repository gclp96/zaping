import { EquipmentAsset } from '@prisma/client';
import { evaluateEquipmentCurrentAvailability } from './equipment-availability.evaluator';
import { MAX_EQUIPMENT_PHYSICAL_REVISION } from './equipment-physical.contract';
import { EquipmentAvailabilityReason } from './equipment-availability.types';

export type EquipmentPhysicalFacts = Pick<
  EquipmentAsset,
  | 'lifecycle'
  | 'condition'
  | 'physicalLocation'
  | 'physicalRevision'
  | 'activeCustodyId'
>;

// Health remains independently reusable by Coverage. Physical eligibility is additive.
export function evaluateEquipmentPhysicalEligibility(
  facts: EquipmentPhysicalFacts,
) {
  const reasons: EquipmentAvailabilityReason[] = [
    ...evaluateEquipmentCurrentAvailability(facts).reasons,
  ];
  if (facts.physicalLocation === 'UNVERIFIED')
    reasons.push('PHYSICAL_LOCATION_UNVERIFIED');
  if (facts.physicalLocation === 'CUSTODY')
    reasons.push('EQUIPMENT_IN_CUSTODY');
  const coherent =
    Number.isSafeInteger(facts.physicalRevision) &&
    facts.physicalRevision >= 0 &&
    facts.physicalRevision <= MAX_EQUIPMENT_PHYSICAL_REVISION &&
    (facts.physicalLocation === 'CUSTODY'
      ? typeof facts.activeCustodyId === 'string' &&
        facts.activeCustodyId.length > 0
      : ['WAREHOUSE', 'UNVERIFIED'].includes(facts.physicalLocation) &&
        facts.activeCustodyId === null);
  if (!coherent) reasons.push('EQUIPMENT_PHYSICAL_STATE_INCOHERENT');
  return {
    available:
      coherent &&
      facts.lifecycle === 'ACTIVE' &&
      facts.condition === 'GOOD' &&
      facts.physicalLocation === 'WAREHOUSE' &&
      reasons.length === 0,
    primaryReason: reasons[0] ?? null,
    reasons,
  };
}
