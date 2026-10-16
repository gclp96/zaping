import { ConflictException, NotFoundException } from '@nestjs/common';
export function reconciliationConflict(
  code: string,
  message = 'La reconciliación no admite esta operación',
): never {
  throw new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code,
    message,
  });
}
export function reconciliationMissing(item = false): never {
  throw new NotFoundException({
    statusCode: 404,
    error: 'Not Found',
    code: item
      ? 'CASE_RECONCILIATION_ITEM_NOT_FOUND'
      : 'CASE_RECONCILIATION_NOT_FOUND',
    message: item
      ? 'Contenido de reconciliación no encontrado'
      : 'Reconciliación no encontrada',
  });
}
export function reconciliationSourceInvalid(): never {
  return reconciliationConflict(
    'CASE_RECONCILIATION_SOURCE_NOT_VALID',
    'Fuente de reconciliación no válida',
  );
}
export function reconciliationCapacityExceeded(): never {
  return reconciliationConflict(
    'CASE_RECONCILIATION_CAPACITY_EXCEEDED',
    'Capacidad de reconciliación insuficiente',
  );
}
