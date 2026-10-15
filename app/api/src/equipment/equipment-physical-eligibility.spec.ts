import {
  EquipmentPhysicalFacts,
  evaluateEquipmentPhysicalEligibility,
} from './equipment-physical-eligibility';
import { equipmentAssignmentAssetIsEligible } from '../healthcare/equipment-assignments/healthcare-equipment-assignment-availability';

const warehouse: EquipmentPhysicalFacts = {
  lifecycle: 'ACTIVE',
  condition: 'GOOD',
  physicalLocation: 'WAREHOUSE',
  physicalRevision: 1,
  activeCustodyId: null,
};
describe('01E-B physical eligibility, separate from Coverage health', () => {
  it('accepts only coherent warehouse health', () => {
    expect(evaluateEquipmentPhysicalEligibility(warehouse)).toEqual({
      available: true,
      primaryReason: null,
      reasons: [],
    });
  });
  it.each<Partial<EquipmentPhysicalFacts>>([
    { physicalLocation: 'UNVERIFIED', physicalRevision: 0 },
    { physicalLocation: 'CUSTODY', activeCustodyId: 'episode' },
    { condition: 'INSPECTION_PENDING' },
    { condition: 'DAMAGED' },
    { condition: 'OUT_OF_SERVICE' },
    { lifecycle: 'RETIRED' },
    { activeCustodyId: 'stray-pointer' },
    { physicalLocation: 'CUSTODY' },
    { physicalRevision: -1 },
    { physicalRevision: NaN },
    { physicalRevision: 0.1 },
  ])('rejects %j', (change) => {
    expect(
      evaluateEquipmentPhysicalEligibility({ ...warehouse, ...change })
        .available,
    ).toBe(false);
  });
  it('preserves condition/lifecycle priority before physical reasons', () => {
    expect(
      evaluateEquipmentPhysicalEligibility({
        ...warehouse,
        lifecycle: 'RETIRED',
        condition: 'DAMAGED',
        physicalLocation: 'UNVERIFIED',
      }).reasons,
    ).toEqual(['RETIRED', 'DAMAGED', 'PHYSICAL_LOCATION_UNVERIFIED']);
  });
  it.each(['CUSTODY', 'UNVERIFIED'] as const)(
    'does not narrow Coverage health for %s',
    (physicalLocation) => {
      const facts = {
        ...warehouse,
        physicalLocation,
        activeCustodyId: physicalLocation === 'CUSTODY' ? 'episode' : null,
      };
      expect(equipmentAssignmentAssetIsEligible(facts)).toBe(true);
      expect(evaluateEquipmentPhysicalEligibility(facts).available).toBe(false);
    },
  );
});
