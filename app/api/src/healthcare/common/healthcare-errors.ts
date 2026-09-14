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
