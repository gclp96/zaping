import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export const HEALTHCARE_ERROR_CODES = {
  caseNotFound: 'CASE_NOT_FOUND',
  productNotFound: 'PRODUCT_NOT_FOUND',
  requirementNotFound: 'REQUIREMENT_NOT_FOUND',
  doctorNotFound: 'DOCTOR_NOT_FOUND',
  hospitalNotFound: 'HOSPITAL_NOT_FOUND',
  affiliationNotFound: 'AFFILIATION_NOT_FOUND',
  doctorInactive: 'DOCTOR_INACTIVE',
  hospitalInactive: 'HOSPITAL_INACTIVE',
  affiliationAlreadyActive: 'AFFILIATION_ALREADY_ACTIVE',
  affiliationInactive: 'AFFILIATION_INACTIVE',
  affiliationEndpointInactive: 'AFFILIATION_ENDPOINT_INACTIVE',
  productInactive: 'PRODUCT_INACTIVE',
  caseRequirementsReadOnly: 'CASE_REQUIREMENTS_READ_ONLY',
  requirementAlreadyActive: 'REQUIREMENT_ALREADY_ACTIVE',
  requirementRetired: 'REQUIREMENT_RETIRED',
  requirementFulfillmentLocked: 'REQUIREMENT_FULFILLMENT_LOCKED',
  invalidRequirementReorder: 'INVALID_REQUIREMENT_REORDER',
  equipmentAssignmentNotFound: 'EQUIPMENT_ASSIGNMENT_NOT_FOUND',
  equipmentAssetNotFound: 'EQUIPMENT_ASSET_NOT_FOUND',
  invalidAssignmentOrigin: 'INVALID_ASSIGNMENT_ORIGIN',
  caseEquipmentAssignmentsReadOnly: 'CASE_EQUIPMENT_ASSIGNMENTS_READ_ONLY',
  assignmentRequirementCaseMismatch: 'ASSIGNMENT_REQUIREMENT_CASE_MISMATCH',
  assignmentProductMismatch: 'ASSIGNMENT_PRODUCT_MISMATCH',
  equipmentAssetNotEligible: 'EQUIPMENT_ASSET_NOT_ELIGIBLE',
  requirementOverCoverage: 'REQUIREMENT_OVER_COVERAGE',
  assignmentAlreadyReserved: 'ASSIGNMENT_ALREADY_RESERVED',
  invalidConflictReviewConfirmation: 'INVALID_CONFLICT_REVIEW_CONFIRMATION',
  conflictOverrideReasonRequired: 'CONFLICT_OVERRIDE_REASON_REQUIRED',
  idempotencyKeyReused: 'IDEMPOTENCY_KEY_REUSED',
  resourceStateChanged: 'RESOURCE_STATE_CHANGED',
  relatedResourceChanged: 'RELATED_RESOURCE_CHANGED',
  persistenceError: 'HEALTHCARE_PERSISTENCE_ERROR',
} as const;

export function caseNotFoundException(): NotFoundException {
  return healthcareNotFoundException(
    HEALTHCARE_ERROR_CODES.caseNotFound,
    'Caso no encontrado',
  );
}

export function productNotFoundException(): NotFoundException {
  return healthcareNotFoundException(
    HEALTHCARE_ERROR_CODES.productNotFound,
    'Producto no encontrado',
  );
}

export function requirementNotFoundException(): NotFoundException {
  return healthcareNotFoundException(
    HEALTHCARE_ERROR_CODES.requirementNotFound,
    'Requerimiento no encontrado',
  );
}

export function doctorNotFoundException(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: HEALTHCARE_ERROR_CODES.doctorNotFound,
    message: 'Doctor no encontrado',
  });
}

export function hospitalNotFoundException(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: HEALTHCARE_ERROR_CODES.hospitalNotFound,
    message: 'Hospital no encontrado',
  });
}

export function affiliationNotFoundException(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: HEALTHCARE_ERROR_CODES.affiliationNotFound,
    message: 'Afiliación no encontrada',
  });
}

export function doctorInactiveException(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: HEALTHCARE_ERROR_CODES.doctorInactive,
    message: 'El doctor está inactivo',
  });
}

export function hospitalInactiveException(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: HEALTHCARE_ERROR_CODES.hospitalInactive,
    message: 'El hospital está inactivo',
  });
}

export function affiliationAlreadyActiveException(
  affiliationId: string,
): ConflictException {
  return affiliationConflictException(
    HEALTHCARE_ERROR_CODES.affiliationAlreadyActive,
    'La afiliación ya está activa',
    affiliationId,
  );
}

export function affiliationInactiveException(
  affiliationId: string,
): ConflictException {
  return affiliationConflictException(
    HEALTHCARE_ERROR_CODES.affiliationInactive,
    'La afiliación existe pero está inactiva',
    affiliationId,
  );
}

export function affiliationEndpointInactiveException(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: HEALTHCARE_ERROR_CODES.affiliationEndpointInactive,
    message: 'El doctor y el hospital deben estar activos',
  });
}

export function productInactiveException(): ConflictException {
  return healthcareConflictException(
    HEALTHCARE_ERROR_CODES.productInactive,
    'El producto está inactivo',
  );
}

export function caseRequirementsReadOnlyException(): ConflictException {
  return healthcareConflictException(
    HEALTHCARE_ERROR_CODES.caseRequirementsReadOnly,
    'Los requerimientos del caso son de sólo lectura',
  );
}

export function requirementAlreadyActiveException(): ConflictException {
  return healthcareConflictException(
    HEALTHCARE_ERROR_CODES.requirementAlreadyActive,
    'El requerimiento ya está activo',
  );
}

export function requirementRetiredException(): ConflictException {
  return healthcareConflictException(
    HEALTHCARE_ERROR_CODES.requirementRetired,
    'El requerimiento existe pero está retirado',
  );
}

export function requirementFulfillmentLockedException(): ConflictException {
  return healthcareConflictException(
    HEALTHCARE_ERROR_CODES.requirementFulfillmentLocked,
    'El requerimiento tiene evidencia operacional y no puede modificarse',
  );
}

export function invalidRequirementReorderException(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: HEALTHCARE_ERROR_CODES.invalidRequirementReorder,
    message: 'El reordenamiento de requerimientos no es válido',
  });
}

export function equipmentAssignmentNotFoundException(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: HEALTHCARE_ERROR_CODES.equipmentAssignmentNotFound,
    message: 'Asignación de equipo no encontrada',
  });
}

export function equipmentAssetNotFoundException(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: HEALTHCARE_ERROR_CODES.equipmentAssetNotFound,
    message: 'Equipo no encontrado',
  });
}

export function invalidAssignmentOriginException(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: HEALTHCARE_ERROR_CODES.invalidAssignmentOrigin,
    message: 'La relación entre Requirement, origen y razón no es válida',
  });
}

export function caseEquipmentAssignmentsReadOnlyException(): ConflictException {
  return equipmentAssignmentConflictException(
    HEALTHCARE_ERROR_CODES.caseEquipmentAssignmentsReadOnly,
    'Las asignaciones de equipo del caso son de sólo lectura',
  );
}

export function assignmentRequirementCaseMismatchException(): ConflictException {
  return equipmentAssignmentConflictException(
    HEALTHCARE_ERROR_CODES.assignmentRequirementCaseMismatch,
    'El requerimiento no pertenece al caso indicado',
  );
}

export function assignmentProductMismatchException(): ConflictException {
  return equipmentAssignmentConflictException(
    HEALTHCARE_ERROR_CODES.assignmentProductMismatch,
    'El producto del equipo no coincide con el requerimiento',
  );
}

export function equipmentAssetNotEligibleException(): ConflictException {
  return equipmentAssignmentConflictException(
    HEALTHCARE_ERROR_CODES.equipmentAssetNotEligible,
    'El equipo no está disponible para una nueva asignación',
  );
}

export function requirementOverCoverageException(): ConflictException {
  return equipmentAssignmentConflictException(
    HEALTHCARE_ERROR_CODES.requirementOverCoverage,
    'La cantidad solicitada del requerimiento ya está cubierta',
  );
}

export function assignmentAlreadyReservedException(): ConflictException {
  return equipmentAssignmentConflictException(
    HEALTHCARE_ERROR_CODES.assignmentAlreadyReserved,
    'El equipo ya está reservado para este caso',
  );
}

export function invalidConflictReviewConfirmationException(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: HEALTHCARE_ERROR_CODES.invalidConflictReviewConfirmation,
    message: 'La confirmación de revisión de conflicto no es válida',
  });
}

export function conflictOverrideReasonRequiredException(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: HEALTHCARE_ERROR_CODES.conflictOverrideReasonRequired,
    message: 'La justificación del override de conflicto es obligatoria',
  });
}

export function idempotencyKeyReusedException(): ConflictException {
  return equipmentAssignmentConflictException(
    HEALTHCARE_ERROR_CODES.idempotencyKeyReused,
    'La clave de idempotencia ya fue utilizada con una solicitud diferente',
  );
}

export function resourceStateChangedException(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: HEALTHCARE_ERROR_CODES.resourceStateChanged,
    message: 'El recurso cambió de estado. Intenta nuevamente',
  });
}

export function relatedResourceChangedException(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: HEALTHCARE_ERROR_CODES.relatedResourceChanged,
    message: 'Un recurso relacionado cambió. Recarga e intenta nuevamente',
  });
}

export function healthcarePersistenceException(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: HEALTHCARE_ERROR_CODES.persistenceError,
    message: 'No fue posible completar la operación',
  });
}

function affiliationConflictException(
  code:
    | typeof HEALTHCARE_ERROR_CODES.affiliationAlreadyActive
    | typeof HEALTHCARE_ERROR_CODES.affiliationInactive,
  message: string,
  affiliationId: string,
): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code,
    message,
    details: { affiliationId },
  });
}

function healthcareNotFoundException(
  code:
    | typeof HEALTHCARE_ERROR_CODES.caseNotFound
    | typeof HEALTHCARE_ERROR_CODES.productNotFound
    | typeof HEALTHCARE_ERROR_CODES.requirementNotFound,
  message: string,
): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code,
    message,
  });
}

function healthcareConflictException(
  code:
    | typeof HEALTHCARE_ERROR_CODES.productInactive
    | typeof HEALTHCARE_ERROR_CODES.caseRequirementsReadOnly
    | typeof HEALTHCARE_ERROR_CODES.requirementAlreadyActive
    | typeof HEALTHCARE_ERROR_CODES.requirementRetired
    | typeof HEALTHCARE_ERROR_CODES.requirementFulfillmentLocked,
  message: string,
): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code,
    message,
  });
}

function equipmentAssignmentConflictException(
  code:
    | typeof HEALTHCARE_ERROR_CODES.caseEquipmentAssignmentsReadOnly
    | typeof HEALTHCARE_ERROR_CODES.assignmentRequirementCaseMismatch
    | typeof HEALTHCARE_ERROR_CODES.assignmentProductMismatch
    | typeof HEALTHCARE_ERROR_CODES.equipmentAssetNotEligible
    | typeof HEALTHCARE_ERROR_CODES.requirementOverCoverage
    | typeof HEALTHCARE_ERROR_CODES.assignmentAlreadyReserved
    | typeof HEALTHCARE_ERROR_CODES.idempotencyKeyReused,
  message: string,
): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code,
    message,
  });
}
