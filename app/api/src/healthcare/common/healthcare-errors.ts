import {
  ConflictException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export const HEALTHCARE_ERROR_CODES = {
  doctorNotFound: 'DOCTOR_NOT_FOUND',
  hospitalNotFound: 'HOSPITAL_NOT_FOUND',
  doctorInactive: 'DOCTOR_INACTIVE',
  hospitalInactive: 'HOSPITAL_INACTIVE',
  resourceStateChanged: 'RESOURCE_STATE_CHANGED',
  relatedResourceChanged: 'RELATED_RESOURCE_CHANGED',
  persistenceError: 'HEALTHCARE_PERSISTENCE_ERROR',
} as const;

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
