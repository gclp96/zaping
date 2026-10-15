import { HttpException } from '@nestjs/common';
import { PhysicalInventoryError } from './physical-inventory.contract';

export type InventoryAuthorityErrorCode =
  | 'CUTOVER_FROZEN'
  | 'RECOVERY_REQUIRED'
  | 'STALE_RUNTIME'
  | 'INCOMPATIBLE_BUILD'
  | 'PHYSICAL_AUTHORITY_REQUIRED'
  | 'LEGACY_AUTHORITY_REQUIRED'
  | 'CUTOVER_NOT_VERIFIED'
  | 'CUTOVER_ACTIVATION_PRECONDITION_FAILED';

export class InventoryAuthorityError extends HttpException {
  constructor(readonly code: InventoryAuthorityErrorCode) {
    const status = [
      'CUTOVER_FROZEN',
      'RECOVERY_REQUIRED',
      'STALE_RUNTIME',
      'INCOMPATIBLE_BUILD',
    ].includes(code)
      ? 503
      : 409;
    super({ statusCode: status, code, message: code }, status);
  }
}

export function inventoryWriterError(error: unknown): never {
  if (!(error instanceof PhysicalInventoryError)) throw error;
  const status =
    error.code === 'INVENTORY_TENANT_MISMATCH'
      ? 403
      : [
            'PRODUCT_NOT_FOUND',
            'INVENTORY_BATCH_NOT_FOUND',
            'PHYSICAL_POSITION_NOT_FOUND',
          ].includes(error.code)
        ? 404
        : [
              'INVALID_PHYSICAL_REQUEST',
              'SALE_PHYSICAL_SOURCE_REQUIRED',
              'SALE_PHYSICAL_SOURCE_INVALID',
            ].includes(error.code)
          ? 400
          : error.code === 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR'
            ? 503
            : 409;
  throw new HttpException(
    { statusCode: status, code: error.code, message: error.code },
    status,
  );
}
