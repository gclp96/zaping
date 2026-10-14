import { InventoryRuntimeCompatibilityService } from '../inventory/physical/inventory-runtime-compatibility.service';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: InventoryRuntimeCompatibilityService,
  ) {}

  inventoryIdentity() {
    return this.runtime.identity();
  }

  async isReady(): Promise<boolean> {
    try {
      this.runtime.identity();
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
