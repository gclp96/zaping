import { ConflictException, NotFoundException } from '@nestjs/common';
export function dispatchConflict(code: string, message: string): never {
  throw new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code,
    message,
  });
}
export function dispatchMissing(item = false): never {
  throw new NotFoundException({
    statusCode: 404,
    error: 'Not Found',
    code: item ? 'CASE_DISPATCH_ITEM_NOT_FOUND' : 'CASE_DISPATCH_NOT_FOUND',
    message: item
      ? 'Contenido de despacho no encontrado'
      : 'Despacho no encontrado',
  });
}
export function invalidDispatchSource(): never {
  return dispatchConflict(
    'CASE_DISPATCH_SOURCE_NOT_VALID',
    'Fuente de despacho no válida',
  );
}
export function dispatchCapacityExceeded(): never {
  return dispatchConflict(
    'CASE_DISPATCH_CAPACITY_EXCEEDED',
    'Capacidad de despacho insuficiente',
  );
}
