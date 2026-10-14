import { Injectable } from '@nestjs/common';
import { InventoryAuthorityError } from './inventory-authority-error';

export const INVENTORY_AUTHORITY_PROTOCOL = 'inventory-authority-v1';
@Injectable()
export class InventoryRuntimeCompatibilityService {
  identity() {
    const build = process.env.INVENTORY_RUNTIME_BUILD;
    const environment = process.env.INVENTORY_RUNTIME_ENVIRONMENT;
    if (
      !build ||
      !/^[a-zA-Z0-9._:-]{1,128}$/.test(build) ||
      !environment ||
      !/^[a-zA-Z0-9._:-]{1,128}$/.test(environment)
    ) {
      throw new InventoryAuthorityError('INCOMPATIBLE_BUILD');
    }
    if (
      process.env.INVENTORY_AUTHORITY_PROTOCOL !== INVENTORY_AUTHORITY_PROTOCOL
    ) {
      throw new InventoryAuthorityError('STALE_RUNTIME');
    }
    return { protocol: INVENTORY_AUTHORITY_PROTOCOL, build, environment };
  }
}
