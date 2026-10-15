import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryAuthorityResolver } from './inventory-authority-resolver';
import { inventoryAuthorityFence } from './inventory-authority-fence';
import { InventoryAuthorityError } from './inventory-authority-error';
import { InventoryRuntimeCompatibilityService } from './inventory-runtime-compatibility.service';
import { InventoryCutoverError } from './inventory-cutover.contract';

@Injectable()
export class InventoryAuthorityTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: InventoryAuthorityResolver,
    private readonly runtime: InventoryRuntimeCompatibilityService,
  ) {}
  async run<T>(
    companyId: string,
    action: (
      tx: Prisma.TransactionClient,
      authority: 'LEGACY' | 'PHYSICAL',
    ) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await inventoryAuthorityFence(tx, companyId, 'shared');
            this.runtime.identity();
            const authority = await this.resolver.resolve(tx, companyId);
            if (authority === 'CUTOVER') {
              const control = await tx.inventoryCutover.findUnique({
                where: { companyId },
              });
              throw new InventoryAuthorityError(
                control?.status === 'RECOVERY_REQUIRED'
                  ? 'RECOVERY_REQUIRED'
                  : 'CUTOVER_FROZEN',
              );
            }
            return action(tx, authority);
          },
          { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 15000 },
        );
      } catch (error) {
        if (error instanceof InventoryCutoverError)
          throw new InventoryAuthorityError('RECOVERY_REQUIRED');
        if (
          attempt < 2 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        )
          continue;
        throw error;
      }
    }
  }
}
