import { createHealthcareEquipmentAssignmentRequestHash } from './healthcare-equipment-assignment-request-hash';

describe('createHealthcareEquipmentAssignmentRequestHash', () => {
  const base = {
    caseId: '11111111-1111-4111-8111-111111111111',
    equipmentAssetId: '22222222-2222-4222-8222-222222222222',
  };

  it('canonicalizes omitted/null fields and normalized reason whitespace', () => {
    expect(createHealthcareEquipmentAssignmentRequestHash(base)).toBe(
      createHealthcareEquipmentAssignmentRequestHash({
        ...base,
        requirementId: null,
        directAssignmentReason: null,
      }),
    );
    expect(
      createHealthcareEquipmentAssignmentRequestHash({
        ...base,
        directAssignmentReason: '  Urgente  ',
      }),
    ).toBe(
      createHealthcareEquipmentAssignmentRequestHash({
        ...base,
        directAssignmentReason: 'Urgente',
      }),
    );
  });

  it('changes when the normalized command changes', () => {
    expect(
      createHealthcareEquipmentAssignmentRequestHash({
        ...base,
        directAssignmentReason: 'Urgente',
      }),
    ).not.toBe(
      createHealthcareEquipmentAssignmentRequestHash({
        ...base,
        directAssignmentReason: 'Respaldo',
      }),
    );
  });
});
