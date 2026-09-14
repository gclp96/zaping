import axios from 'axios';

import { api } from './api';

export type HealthcareRequirementLifecycle = 'ACTIVE' | 'RETIRED';
export type HealthcareRequirementListStatus =
  HealthcareRequirementLifecycle | 'ALL';
export type HealthcareRequirementType = 'REQUIRED' | 'BACKUP';

export type HealthcareRequirementProduct = {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
  inventoryTracking: 'QUANTITY' | 'SERIALIZED' | 'ASSET';
};

export type HealthcareRequirement = {
  id: string;
  caseId: string;
  productId: string;
  requestedQty: number;
  type: HealthcareRequirementType;
  notes: string | null;
  sortOrder: number;
  lifecycle: HealthcareRequirementLifecycle;
  retiredAt: string | null;
  retirementReason: string | null;
  createdAt: string;
  updatedAt: string;
  product: HealthcareRequirementProduct;
};

export type CreateHealthcareRequirementPayload = {
  productId: string;
  requestedQty: number;
  type: HealthcareRequirementType;
  notes: string | null;
  sortOrder: number;
};

export type UpdateHealthcareRequirementPayload = Partial<
  Pick<
    CreateHealthcareRequirementPayload,
    'requestedQty' | 'type' | 'notes' | 'sortOrder'
  >
>;

export type ReorderHealthcareRequirementsPayload = {
  items: Array<{
    requirementId: string;
    sortOrder: number;
  }>;
};

export type HealthcareRequirementErrorCode =
  | 'CASE_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'REQUIREMENT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'CASE_REQUIREMENTS_READ_ONLY'
  | 'REQUIREMENT_ALREADY_ACTIVE'
  | 'REQUIREMENT_RETIRED'
  | 'REQUIREMENT_FULFILLMENT_LOCKED'
  | 'INVALID_REQUIREMENT_REORDER'
  | 'RESOURCE_STATE_CHANGED'
  | 'RELATED_RESOURCE_CHANGED'
  | 'HEALTHCARE_PERSISTENCE_ERROR';

type HealthcareRequirementListResponse = {
  items: HealthcareRequirement[];
};

type HealthcareErrorResponse = {
  code?: string;
};

const requirementErrorMessages: Record<HealthcareRequirementErrorCode, string> =
  {
    CASE_NOT_FOUND:
      'El caso ya no está disponible. Regresa al listado y vuelve a intentarlo.',
    PRODUCT_NOT_FOUND:
      'El producto ya no está disponible. Selecciona otro producto.',
    REQUIREMENT_NOT_FOUND:
      'El requerimiento ya no está disponible. Actualiza la lista.',
    PRODUCT_INACTIVE:
      'El producto está inactivo. Selecciona un producto activo.',
    CASE_REQUIREMENTS_READ_ONLY:
      'El caso está cancelado y sus requerimientos son de sólo lectura.',
    REQUIREMENT_ALREADY_ACTIVE:
      'Este producto ya tiene un requerimiento activo en el caso.',
    REQUIREMENT_RETIRED:
      'Este producto ya tiene un requerimiento retirado. Usa la vista Retirados para reactivarlo.',
    REQUIREMENT_FULFILLMENT_LOCKED:
      'El requerimiento tiene evidencia operacional y ya no puede modificarse.',
    INVALID_REQUIREMENT_REORDER:
      'No fue posible guardar el nuevo orden. Actualiza la lista e intenta nuevamente.',
    RESOURCE_STATE_CHANGED:
      'El requerimiento cambió de estado. Actualiza la lista e intenta nuevamente.',
    RELATED_RESOURCE_CHANGED:
      'Un recurso relacionado cambió. Actualiza la lista e intenta nuevamente.',
    HEALTHCARE_PERSISTENCE_ERROR:
      'No fue posible completar la operación. Intenta nuevamente.',
  };

export async function listHealthcareRequirements(
  caseId: string,
  status: HealthcareRequirementListStatus,
): Promise<HealthcareRequirement[]> {
  const response = await api.get<HealthcareRequirementListResponse>(
    `/healthcare/cases/${caseId}/requirements`,
    { params: { status } },
  );

  return response.data.items;
}

export async function createHealthcareRequirement(
  caseId: string,
  payload: CreateHealthcareRequirementPayload,
): Promise<HealthcareRequirement> {
  const response = await api.post<HealthcareRequirement>(
    `/healthcare/cases/${caseId}/requirements`,
    payload,
  );

  return response.data;
}

export async function reorderHealthcareRequirements(
  caseId: string,
  payload: ReorderHealthcareRequirementsPayload,
): Promise<HealthcareRequirement[]> {
  const response = await api.patch<HealthcareRequirementListResponse>(
    `/healthcare/cases/${caseId}/requirements/reorder`,
    payload,
  );

  return response.data.items;
}

export async function getHealthcareRequirement(
  requirementId: string,
): Promise<HealthcareRequirement> {
  const response = await api.get<HealthcareRequirement>(
    `/healthcare/requirements/${requirementId}`,
  );

  return response.data;
}

export async function updateHealthcareRequirement(
  requirementId: string,
  payload: UpdateHealthcareRequirementPayload,
): Promise<HealthcareRequirement> {
  const response = await api.patch<HealthcareRequirement>(
    `/healthcare/requirements/${requirementId}`,
    payload,
  );

  return response.data;
}

export async function retireHealthcareRequirement(
  requirementId: string,
  retirementReason: string,
): Promise<HealthcareRequirement> {
  const response = await api.post<HealthcareRequirement>(
    `/healthcare/requirements/${requirementId}/retire`,
    { retirementReason },
  );

  return response.data;
}

export async function reactivateHealthcareRequirement(
  requirementId: string,
): Promise<HealthcareRequirement> {
  const response = await api.post<HealthcareRequirement>(
    `/healthcare/requirements/${requirementId}/reactivate`,
    {},
  );

  return response.data;
}

export function getHealthcareRequirementErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!axios.isAxiosError<HealthcareErrorResponse>(error)) {
    return fallback;
  }

  const code = error.response?.data?.code;

  return code && code in requirementErrorMessages
    ? requirementErrorMessages[code as HealthcareRequirementErrorCode]
    : fallback;
}
