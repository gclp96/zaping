import 'reflect-metadata';

import { HealthcareCaseKitItemSourceType } from './dto/add-healthcare-case-kit-item.dto';
import {
  createHealthcareCaseKitItemExclusionRequestHash,
  createHealthcareCaseKitItemRequestHash,
  createHealthcareCaseKitPreparationRequestHash,
  createHealthcareCaseKitRequestHash,
} from './healthcare-case-kit-request-hash';

describe('Healthcare CaseKit request hashes', () => {
  it('is stable for Create and scopes the Case', () => {
    expect(createHealthcareCaseKitRequestHash('case-a')).toBe(
      createHealthcareCaseKitRequestHash('case-a'),
    );
    expect(createHealthcareCaseKitRequestHash('case-a')).not.toBe(
      createHealthcareCaseKitRequestHash('case-b'),
    );
  });

  it('includes the normalized discriminated Add Item payload', () => {
    const requirement = createHealthcareCaseKitItemRequestHash('kit-id', {
      sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
      requirementId: 'requirement-id',
      preparedQuantity: 2,
    });
    const assignment = createHealthcareCaseKitItemRequestHash('kit-id', {
      sourceType: HealthcareCaseKitItemSourceType.EQUIPMENT_ASSIGNMENT,
      equipmentAssignmentId: 'assignment-id',
    });
    expect(requirement).not.toBe(assignment);
  });

  it('scopes Exclude Item to Kit, item and normalized reason', () => {
    const hash = createHealthcareCaseKitItemExclusionRequestHash(
      'kit-id',
      'item-id',
      'Motivo normalizado',
    );
    expect(hash).toBe(
      createHealthcareCaseKitItemExclusionRequestHash(
        'kit-id',
        'item-id',
        'Motivo normalizado',
      ),
    );
    expect(hash).not.toBe(
      createHealthcareCaseKitItemExclusionRequestHash(
        'kit-id',
        'item-id',
        'Otro motivo',
      ),
    );
    expect(hash).not.toBe(
      createHealthcareCaseKitItemExclusionRequestHash(
        'kit-id',
        'other-item',
        'Motivo normalizado',
      ),
    );
  });

  it('scopes Confirm Preparation to the CaseKit', () => {
    expect(createHealthcareCaseKitPreparationRequestHash('kit-a')).toBe(
      createHealthcareCaseKitPreparationRequestHash('kit-a'),
    );
    expect(createHealthcareCaseKitPreparationRequestHash('kit-a')).not.toBe(
      createHealthcareCaseKitPreparationRequestHash('kit-b'),
    );
  });
});
