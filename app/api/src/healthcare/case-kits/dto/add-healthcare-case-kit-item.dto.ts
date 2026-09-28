import { Allow } from 'class-validator';

export enum HealthcareCaseKitItemSourceType {
  REQUIREMENT = 'REQUIREMENT',
  EQUIPMENT_ASSIGNMENT = 'EQUIPMENT_ASSIGNMENT',
}

export class AddHealthcareCaseKitItemDto {
  @Allow()
  sourceType!: HealthcareCaseKitItemSourceType;

  @Allow()
  requirementId?: string;

  @Allow()
  preparedQuantity?: number;

  @Allow()
  equipmentAssignmentId?: string;
}
