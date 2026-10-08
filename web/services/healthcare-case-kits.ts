import { api } from './api';

export type HealthcareCaseKitUser = {
  id: string;
  firstName: string;
  lastName: string;
};

export type HealthcareCaseKitWarning = {
  code:
    | 'CASE_KIT_CASE_CANCELLED'
    | 'CASE_KIT_REQUIREMENT_NOT_ACTIVE'
    | 'CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE'
    | 'CASE_KIT_PREPARED_QUANTITY_EXCEEDS_REQUESTED'
    | 'CASE_KIT_ASSIGNMENT_NOT_RESERVED'
    | 'CASE_KIT_EQUIPMENT_NOT_ACTIVE'
    | 'CASE_KIT_EQUIPMENT_NOT_GOOD';
  message: string;
};

export type HealthcareCaseKitReadinessBlocker = {
  code:
    | HealthcareCaseKitWarning['code']
    | 'CASE_KIT_CASE_NOT_SCHEDULED'
    | 'CASE_KIT_CASE_SCHEDULE_INCOMPLETE'
    | 'CASE_KIT_REQUIRED_QUANTITY_NOT_COVERED'
    | 'CASE_KIT_REQUIRED_ASSET_NOT_COVERED'
    | 'CASE_KIT_SERIALIZED_REQUIREMENT_UNSUPPORTED';
  requirementId?: string;
  caseKitItemId?: string;
};

export type HealthcareCaseKitItem = {
  id: string;
  lifecycle: 'ACTIVE' | 'EXCLUDED';
  sourceType: 'REQUIREMENT' | 'EQUIPMENT_ASSIGNMENT';
  preparedQuantity: number | null;
  requirement: {
    id: string;
    requestedQty: number;
    lifecycle: 'ACTIVE' | 'RETIRED';
    product: {
      id: string;
      sku: string;
      name: string;
      isActive: boolean;
      inventoryTracking: 'QUANTITY' | 'SERIALIZED' | 'ASSET';
    };
  } | null;
  equipmentAssignment: {
    id: string;
    lifecycle: 'RESERVED' | 'RELEASED' | 'REPLACED';
    equipmentAsset: {
      id: string;
      assetCode: string;
      serialNumber: string | null;
      lifecycle: 'ACTIVE' | 'RETIRED';
      condition: 'GOOD' | 'INSPECTION_PENDING' | 'DAMAGED' | 'OUT_OF_SERVICE';
      product: { id: string; sku: string; name: string; isActive: boolean };
    };
  } | null;
  sourceValid: boolean;
  stale: boolean;
  warnings: HealthcareCaseKitWarning[];
  addedBy: HealthcareCaseKitUser;
  excludedBy: HealthcareCaseKitUser | null;
  excludedAt: string | null;
  exclusionReason: string | null;
  createdAt: string;
};

export type HealthcareCaseKit = {
  id: string;
  caseId: string;
  status: 'DRAFT' | 'PREPARED';
  createdBy: HealthcareCaseKitUser;
  preparedBy: HealthcareCaseKitUser | null;
  preparedAt: string | null;
  preparationReadiness: {
    status: 'PASS' | 'BLOCKED';
    blockers: HealthcareCaseKitReadinessBlocker[];
  };
  createdAt: string;
  updatedAt: string;
  items: HealthcareCaseKitItem[];
};

export type AddHealthcareCaseKitItemPayload =
  | {
      sourceType: 'REQUIREMENT';
      requirementId: string;
      preparedQuantity: number;
    }
  | {
      sourceType: 'EQUIPMENT_ASSIGNMENT';
      equipmentAssignmentId: string;
    };

export async function getHealthcareCaseKit(
  caseId: string,
): Promise<HealthcareCaseKit> {
  const response = await api.get<HealthcareCaseKit>(
    `/healthcare/cases/${caseId}/case-kit`,
  );
  return response.data;
}

export async function createHealthcareCaseKit(
  caseId: string,
): Promise<HealthcareCaseKit> {
  const response = await api.post<HealthcareCaseKit>(
    `/healthcare/cases/${caseId}/case-kit`,
    {},
    {
      headers: {
        'Idempotency-Key': `hc-case-kit-${globalThis.crypto.randomUUID()}`,
      },
    },
  );
  return response.data;
}

export async function addHealthcareCaseKitItem(
  caseKitId: string,
  payload: AddHealthcareCaseKitItemPayload,
): Promise<HealthcareCaseKitItem> {
  const response = await api.post<HealthcareCaseKitItem>(
    `/healthcare/case-kits/${caseKitId}/items`,
    payload,
    {
      headers: {
        'Idempotency-Key': `hc-case-kit-item-${globalThis.crypto.randomUUID()}`,
      },
    },
  );
  return response.data;
}

export async function excludeHealthcareCaseKitItem(
  caseKitId: string,
  itemId: string,
  reason: string,
): Promise<HealthcareCaseKitItem> {
  const response = await api.post<HealthcareCaseKitItem>(
    `/healthcare/case-kits/${caseKitId}/items/${itemId}/exclude`,
    { reason },
    {
      headers: {
        'Idempotency-Key': `hc-case-kit-item-exclude-${globalThis.crypto.randomUUID()}`,
      },
    },
  );
  return response.data;
}

export async function confirmHealthcareCaseKitPreparation(
  caseKitId: string,
): Promise<HealthcareCaseKit> {
  const response = await api.post<HealthcareCaseKit>(
    `/healthcare/case-kits/${caseKitId}/confirm-preparation`,
    {},
    {
      headers: {
        'Idempotency-Key': `hc-case-kit-confirm-${globalThis.crypto.randomUUID()}`,
      },
    },
  );
  return response.data;
}
