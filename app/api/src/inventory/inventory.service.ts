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
  constructor(private readonly prisma: PrismaService) {}

  async findInventory(companyId: string) {
    return this.prisma.product.findMany({
      where: {
        companyId,
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
    return this.executeSerializableWithRetry(async (tx) => {
      // Re-read the product inside every Serializable attempt so retries never
      // reuse a stock value from an aborted transaction.
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

  private async executeSerializableWithRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        if (!this.isSerializableConflict(error) || attempt === maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error('Serializable transaction retry loop exhausted');
  }

  private isSerializableConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  async registerPurchaseEntry(
    tx: Prisma.TransactionClient,
    companyId: string,
    data: {
      productId: string;
      quantity: number;
      unitCost: number;
      referenceId: string;
      notes: string;
    },
  ) {
    const product = await tx.product.findFirst({
      where: {
        id: data.productId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const updatedProduct = await tx.product.update({
      where: {
        id_companyId: {
          id: data.productId,
          companyId,
        },
      },
      data: {
        stock: {
          increment: data.quantity,
        },
      },
      select: {
        stock: true,
      },
    });

    return tx.inventoryMovement.create({
      data: {
        companyId,
        productId: data.productId,
        movementType: 'IN',
        quantity: data.quantity,
        balance: updatedProduct.stock,
        unitCost: data.unitCost,
        referenceType: 'PURCHASE',
        referenceId: data.referenceId,
        notes: data.notes,
      },
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
