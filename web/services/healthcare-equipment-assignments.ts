import { api } from './api';

export type HealthcareEquipmentAssignmentOrigin = 'REQUIREMENT' | 'DIRECT';
export type HealthcareEquipmentAssignmentStatus =
  | 'RESERVED'
  | 'RELEASED'
  | 'REPLACED';
export type HealthcareEquipmentAssignmentReleaseCause =
  | 'MANUAL'
  | 'CASE_CANCELLED'
  | 'REQUIREMENT_WITHDRAWN';

export type HealthcareEquipmentAssignmentAvailabilityWarning = {
  code:
    | 'INCOMPLETE_CASE_SCHEDULE'
    | 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE'
    | 'CURRENT_ASSIGNMENT_CONFLICT'
    | 'CONFLICT_OVERRIDE_CONFIRMED';
  message: string;
};

export type HealthcareEquipmentAssignmentAvailability = {
  fullyVerifiable: boolean;
  conflictFree: boolean | null;
  warnings: HealthcareEquipmentAssignmentAvailabilityWarning[];
};

export type HealthcareEquipmentAssignmentUser = {
  id: string;
  firstName: string;
  lastName: string;
};

export type HealthcareEquipmentAssignment = {
  id: string;
  caseId: string;
  requirementId: string | null;
  origin: HealthcareEquipmentAssignmentOrigin;
  status: HealthcareEquipmentAssignmentStatus;
  equipmentAsset: {
    id: string;
    productId: string;
    assetCode: string;
    serialNumber: string | null;
    lifecycle: 'ACTIVE' | 'RETIRED';
    condition: 'GOOD' | 'INSPECTION_PENDING' | 'DAMAGED' | 'OUT_OF_SERVICE';
    product: {
      id: string;
      sku: string;
      name: string;
      isActive: boolean;
    };
  };
  assignedAt: string;
  assignedBy: HealthcareEquipmentAssignmentUser;
  directAssignmentReason?: string | null;
  replacesAssignmentId: string | null;
  replacement: {
    successorAssignmentId: string;
    reason: string;
    replacedAt: string;
    replacedBy: HealthcareEquipmentAssignmentUser;
  } | null;
  release: {
    cause: HealthcareEquipmentAssignmentReleaseCause;
    reason: string | null;
    releasedAt: string;
    releasedBy: HealthcareEquipmentAssignmentUser;
  } | null;
  availability: HealthcareEquipmentAssignmentAvailability | null;
  conflictOverrides: Array<{
    conflictingAssignmentId: string;
    approvedAt: string;
    approvedBy: HealthcareEquipmentAssignmentUser;
    reason: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type HealthcareEquipmentAssignmentListResponse = {
  items: HealthcareEquipmentAssignment[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export async function listHealthcareEquipmentAssignments(
  caseId: string,
  page: number,
  pageSize: number,
): Promise<HealthcareEquipmentAssignmentListResponse> {
  const response =
    await api.get<HealthcareEquipmentAssignmentListResponse>(
      '/healthcare/equipment-assignments',
      {
        params: {
          caseId,
          status: 'ALL',
          page,
          pageSize,
        },
      },
    );

  return response.data;
}

export async function getHealthcareEquipmentAssignment(
  assignmentId: string,
): Promise<HealthcareEquipmentAssignment> {
  const response = await api.get<HealthcareEquipmentAssignment>(
    `/healthcare/equipment-assignments/${assignmentId}`,
  );

  return response.data;
}
