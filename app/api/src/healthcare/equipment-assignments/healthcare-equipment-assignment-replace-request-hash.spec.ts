import { createHealthcareEquipmentAssignmentReplaceRequestHash } from './healthcare-equipment-assignment-replace-request-hash';

describe('createHealthcareEquipmentAssignmentReplaceRequestHash', () => {
  const sourceAssignmentId = '11111111-1111-4111-8111-111111111111';

  const base = {
    equipmentAssetId: '22222222-2222-4222-8222-222222222222',
    replacementReason: 'Equipo original no disponible',
  };

  it('canonicalizes normalized replacement reason whitespace', () => {
    expect(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        {
          ...base,
          replacementReason: 'Equipo original no disponible',
        },
      ),
    ).toBe(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        base,
      ),
    );
  });

  it('changes when the source assignment id changes', () => {
    expect(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        base,
      ),
    ).not.toBe(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        '33333333-3333-4333-8333-333333333333',
        base,
      ),
    );
  });

  it('changes when the replacement EquipmentAsset changes', () => {
    expect(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        base,
      ),
    ).not.toBe(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        {
          ...base,
          equipmentAssetId: '44444444-4444-4444-8444-444444444444',
        },
      ),
    );
  });

  it('changes when the normalized replacement reason changes', () => {
    expect(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        base,
      ),
    ).not.toBe(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        {
          ...base,
          replacementReason: 'Equipo dañado',
        },
      ),
    );
  });

  it('includes normalized conflict confirmation fields', () => {
    const fingerprint = 'a'.repeat(64);

    const confirmed = createHealthcareEquipmentAssignmentReplaceRequestHash(
      sourceAssignmentId,
      {
        ...base,
        confirmConflictOverride: true,
        conflictReviewFingerprint: fingerprint,
        conflictOverrideReason: '  Riesgo aceptado  ',
      },
    );
    expect(confirmed).toBe(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        {
          ...base,
          confirmConflictOverride: true,
          conflictReviewFingerprint: fingerprint,
          conflictOverrideReason: 'Riesgo aceptado',
        },
      ),
    );

    expect(confirmed).not.toBe(
      createHealthcareEquipmentAssignmentReplaceRequestHash(
        sourceAssignmentId,
        base,
      ),
    );
  });
});
