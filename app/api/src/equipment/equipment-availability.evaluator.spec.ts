import { EquipmentCondition, EquipmentLifecycle } from '@prisma/client';

import { evaluateEquipmentCurrentAvailability } from './equipment-availability.evaluator';
import {
  EQUIPMENT_AVAILABILITY_REASON,
  EquipmentCurrentAvailabilityFacts,
} from './equipment-availability.types';

describe('evaluateEquipmentCurrentAvailability', () => {
  it('should mark ACTIVE GOOD equipment as available', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.GOOD,
    });

    expect(result).toEqual({
      available: true,
      primaryReason: null,
      reasons: [],
    });
  });

  it('should block ACTIVE INSPECTION_PENDING equipment', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.INSPECTION_PENDING,
    });

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.INSPECTION_PENDING,
      reasons: [EQUIPMENT_AVAILABILITY_REASON.INSPECTION_PENDING],
    });
  });

  it('should block ACTIVE DAMAGED equipment', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.DAMAGED,
    });

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.DAMAGED,
      reasons: [EQUIPMENT_AVAILABILITY_REASON.DAMAGED],
    });
  });

  it('should block ACTIVE OUT_OF_SERVICE equipment', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.OUT_OF_SERVICE,
    });

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.OUT_OF_SERVICE,
      reasons: [EQUIPMENT_AVAILABILITY_REASON.OUT_OF_SERVICE],
    });
  });

  it('should block RETIRED GOOD equipment', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.GOOD,
    });

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.RETIRED,
      reasons: [EQUIPMENT_AVAILABILITY_REASON.RETIRED],
    });
  });

  it('should return RETIRED before INSPECTION_PENDING', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.INSPECTION_PENDING,
    });

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.RETIRED,
      reasons: [
        EQUIPMENT_AVAILABILITY_REASON.RETIRED,
        EQUIPMENT_AVAILABILITY_REASON.INSPECTION_PENDING,
      ],
    });
  });

  it('should return RETIRED before DAMAGED', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.DAMAGED,
    });

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.RETIRED,
      reasons: [
        EQUIPMENT_AVAILABILITY_REASON.RETIRED,
        EQUIPMENT_AVAILABILITY_REASON.DAMAGED,
      ],
    });
  });

  it('should return RETIRED before OUT_OF_SERVICE', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.OUT_OF_SERVICE,
    });

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.RETIRED,
      reasons: [
        EQUIPMENT_AVAILABILITY_REASON.RETIRED,
        EQUIPMENT_AVAILABILITY_REASON.OUT_OF_SERVICE,
      ],
    });
  });

  it('should use deterministic reason ordering', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.DAMAGED,
    });

    expect(result.reasons).toEqual([
      EQUIPMENT_AVAILABILITY_REASON.RETIRED,
      EQUIPMENT_AVAILABILITY_REASON.DAMAGED,
    ]);
    expect(result.primaryReason).toBe(EQUIPMENT_AVAILABILITY_REASON.RETIRED);
  });

  it('should not mutate input facts', () => {
    const facts: EquipmentCurrentAvailabilityFacts = {
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.DAMAGED,
    };
    const originalFacts = { ...facts };

    evaluateEquipmentCurrentAvailability(facts);

    expect(facts).toEqual(originalFacts);
  });

  it('should not include evaluatedAt in the pure result', () => {
    const result = evaluateEquipmentCurrentAvailability({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.GOOD,
    });

    expect(result).not.toHaveProperty('evaluatedAt');
  });

  it('should represent manual GOOD equipment without inspection history', () => {
    const facts: EquipmentCurrentAvailabilityFacts = {
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.GOOD,
    };

    const result = evaluateEquipmentCurrentAvailability(facts);

    expect(result).toEqual({
      available: true,
      primaryReason: null,
      reasons: [],
    });
  });
});
