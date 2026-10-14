import { InventoryAuthorityTransactionService } from './physical/inventory-authority-transaction.service';
import {
  InventoryAuthorityError,
  inventoryWriterError,
} from './physical/inventory-authority-error';
import {
  ManualPhysicalInventoryService,
  ManualPhysicalInput,
} from './physical/manual-physical-inventory.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: InventoryAuthorityTransactionService,
    private readonly manual: ManualPhysicalInventoryService,
  ) {}

  async findInventory(companyId: string) {
    return this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        minStock: true,
        price: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findMovementsByReference(
    companyId: string,
    referenceType: string,
    referenceId: string,
  ) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        companyId,
        referenceType,
        referenceId,
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createMovement(companyId: string, data: CreateMovementDto) {
    return this.authority.run(companyId, async (tx, authority) => {
      if (authority !== 'LEGACY')
        throw new InventoryAuthorityError('PHYSICAL_AUTHORITY_REQUIRED');
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Product" WHERE id=${data.productId} AND "companyId"=${companyId} FOR UPDATE`,
      );
      // Product root is locked before reading the current legacy balance.
      const product = await tx.product.findFirst({
        where: {
          id: data.productId,
          companyId,
        },
      });

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      let newStock = product.stock;

      switch (data.movementType) {
        case 'IN':
          newStock += data.quantity;
          break;

        case 'OUT':
          if (product.stock < data.quantity) {
            throw new BadRequestException('Stock insuficiente');
          }

          newStock -= data.quantity;
          break;

        case 'ADJUSTMENT':
          newStock = data.quantity;
          break;
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: data.productId,
          movementType: data.movementType,
          quantity: data.quantity,
          balance: newStock,
          notes: data.notes,
        },
      });

      await tx.product.update({
        where: {
          id_companyId: {
            id: data.productId,
            companyId,
          },
        },
        data: {
          stock: newStock,
        },
      });

      return movement;
    });
  }

  async createPhysicalMovement(input: ManualPhysicalInput) {
    const execute = () =>
      this.authority.run(input.companyId, async (tx, authority) => {
        if (authority !== 'PHYSICAL')
          throw new InventoryAuthorityError('LEGACY_AUTHORITY_REQUIRED');
        return this.manual.execute(tx, input);
      });
    try {
      return await execute();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        ['companyId', 'scope', 'key'].every((k) =>
          (error.meta!.target as string[]).includes(k),
        )
      ) {
        try {
          return await execute();
        } catch (readError) {
          inventoryWriterError(readError);
        }
      }
      inventoryWriterError(error);
    }
  }

  findPhysicalPositions(companyId: string, productId: string) {
    return this.authority.run(companyId, async (tx, authority) => {
      if (authority !== 'PHYSICAL')
        throw new InventoryAuthorityError('LEGACY_AUTHORITY_REQUIRED');
      return tx.$queryRaw(Prisma.sql`
        SELECT pos.id, pos."productId", pos."inventoryBatchId", pos.state,
          pos.quantity, pos.revision,
          (pos.state='AVAILABLE' AND p."isActive" AND
            (pos."inventoryBatchId" IS NULL OR (b."isActive" AND
              (b."expirationDate" IS NULL OR b."expirationDate">CURRENT_TIMESTAMP)))) AS eligible
        FROM "InventoryPosition" pos
        JOIN "Product" p ON p.id=pos."productId" AND p."companyId"=pos."companyId"
        LEFT JOIN "InventoryBatch" b ON b.id=pos."inventoryBatchId" AND b."companyId"=pos."companyId" AND b."productId"=pos."productId"
        WHERE pos."companyId"=${companyId} AND pos."productId"=${productId}
        ORDER BY pos.id
      `);
    });
  }

  async findMovements(companyId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        companyId,
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
