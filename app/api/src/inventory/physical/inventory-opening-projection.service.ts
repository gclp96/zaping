import { Prisma } from '@prisma/client';
import { cutoverAssert } from './inventory-cutover.contract';
import { OpeningProduct } from './inventory-opening-manifest';

export class InventoryOpeningProjectionService {
  async apply(
    tx: Prisma.TransactionClient,
    companyId: string,
    p: OpeningProduct,
  ) {
    cutoverAssert(
      await tx.product.findFirst({
        where: { id: p.productId, companyId, stock: p.expectedOwned },
      }),
      'MISMATCH',
    );
    for (const b of p.batches) {
      const where = {
        id: b.batchId,
        companyId,
        productId: p.productId,
        initialQuantity: b.initialQuantityBefore,
        availableQuantity: b.availableQuantityBefore,
      };
      cutoverAssert(await tx.inventoryBatch.findFirst({ where }), 'MISMATCH');
      if (b.availableQuantityBefore !== b.availableQuantityExpected)
        cutoverAssert(
          (
            await tx.inventoryBatch.updateMany({
              where,
              data: { availableQuantity: b.availableQuantityExpected },
            })
          ).count === 1,
          'MISMATCH',
        );
    }
  }
}
