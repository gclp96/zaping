import { createHealthcareEquipmentAssignmentReleaseRequestHash } from './healthcare-equipment-assignment-release-request-hash';

describe('createHealthcareEquipmentAssignmentReleaseRequestHash', () => {
  const assignmentId = '11111111-1111-4111-8111-111111111111';

  it('normalizes the reason and includes the Assignment path identity', () => {
    expect(
      createHealthcareEquipmentAssignmentReleaseRequestHash(
        assignmentId,
        '  Equipo ya no requerido  ',
      ),
    ).toBe(
      createHealthcareEquipmentAssignmentReleaseRequestHash(
        assignmentId,
        'Equipo ya no requerido',
      ),
    );

    expect(
      createHealthcareEquipmentAssignmentReleaseRequestHash(
        '22222222-2222-4222-8222-222222222222',
        'Equipo ya no requerido',
      ),
    ).not.toBe(
      createHealthcareEquipmentAssignmentReleaseRequestHash(
        assignmentId,
        'Equipo ya no requerido',
      ),
    );
  });

  it('changes when the normalized reason changes', () => {
    expect(
      createHealthcareEquipmentAssignmentReleaseRequestHash(
        assignmentId,
        'Cambio operativo',
      ),
    ).not.toBe(
      createHealthcareEquipmentAssignmentReleaseRequestHash(
        assignmentId,
        'Equipo ya no requerido',
      ),
    );
  });
});
