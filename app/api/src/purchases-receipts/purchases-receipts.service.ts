import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma, PurchaseStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { EquipmentProvisioningService } from '../equipment/equipment-provisioning.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseReceiptItemDto } from './dto/create-purchase-receipt-item.dto';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';

interface ValidatedReceiptItem {
  purchaseItemId: string;
  productId: string;
  quantityReceived: number;
  unitCost: number;
  lotNumber?: string;
  expirationDate?: Date;
}

interface RegisterBatchData {
  companyId: string;
  productId: string;
  lotNumber: string;
  expirationDate?: Date;
  quantityReceived: number;
  unitCost: number;
  receivedAt: Date;
}

@Injectable()
export class PurchaseReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly equipmentProvisioningService: EquipmentProvisioningService,
  ) {}

  async create(
    companyId: string,
    receivedBy: string | undefined,
    dto: CreatePurchaseReceiptDto,
  ) {
    this.validateDuplicatedItems(dto.items);

    const receivedAt = new Date();

    return this.prisma.$transaction(
      async (tx) => {
        const purchase = await tx.purchase.findFirst({
          where: {
            id: dto.purchaseId,
            companyId,
          },
          include: {
            items: {
              include: {
                receiptItems: {
                  select: {
                    quantityReceived: true,
                  },
                },
              },
            },
          },
        });

        if (!purchase) {
          throw new NotFoundException('Compra no encontrada');
        }

        this.validatePurchaseStatus(purchase.status);

        const purchaseItemsById = new Map(
          purchase.items.map((item) => [item.id, item]),
        );

        const validatedItems: ValidatedReceiptItem[] = dto.items.map(
          (inputItem) => {
            const purchaseItem = purchaseItemsById.get(
              inputItem.purchaseItemId,
            );

            if (!purchaseItem) {
              throw new BadRequestException(
                `La partida ${inputItem.purchaseItemId} no pertenece a la compra`,
              );
            }

            const previouslyReceived = purchaseItem.receiptItems.reduce(
              (total, receiptItem) => total + receiptItem.quantityReceived,
              0,
            );

            const pendingQuantity = purchaseItem.quantity - previouslyReceived;

            if (pendingQuantity <= 0) {
              throw new BadRequestException(
                `La partida ${purchaseItem.id} ya fue recibida completamente`,
              );
            }

            if (inputItem.quantityReceived > pendingQuantity) {
              throw new BadRequestException(
                `La cantidad recibida de la partida ${purchaseItem.id} supera la cantidad pendiente (${pendingQuantity})`,
              );
            }

            const lotNumber = this.normalizeOptionalText(inputItem.lotNumber);

            const expirationDate = this.parseExpirationDate(
              inputItem.expirationDate,
              receivedAt,
            );

            if (expirationDate && !lotNumber) {
              throw new BadRequestException(
                'No se puede registrar una fecha de caducidad sin número de lote',
              );
            }

            return {
              purchaseItemId: purchaseItem.id,
              productId: purchaseItem.productId,
              quantityReceived: inputItem.quantityReceived,
              unitCost: purchaseItem.price,
              lotNumber,
              expirationDate,
            };
          },
        );

        await this.validateProducts(
          tx,
          companyId,
          validatedItems.map((item) => item.productId),
        );

        const receipt = await tx.purchaseReceipt.create({
          data: {
            companyId,
            purchaseId: purchase.id,
            folio: this.generateFolio(),
            receivedAt,
            receivedBy,
            notes: this.normalizeOptionalText(dto.notes),
          },
        });

        for (const item of validatedItems) {
          const batch = item.lotNumber
            ? await this.registerBatch(tx, {
                companyId,
                productId: item.productId,
                lotNumber: item.lotNumber,
                expirationDate: item.expirationDate,
                quantityReceived: item.quantityReceived,
                unitCost: item.unitCost,
                receivedAt,
              })
            : undefined;

          const createdReceiptItem = await tx.purchaseReceiptItem.create({
            data: {
              companyId,
              receiptId: receipt.id,
              purchaseItemId: item.purchaseItemId,
              productId: item.productId,
              quantityReceived: item.quantityReceived,
              lotNumber: item.lotNumber,
              expirationDate: item.expirationDate,
              unitCost: item.unitCost,
              batchId: batch?.id,
            },
          });

          await this.equipmentProvisioningService.provisionFromPurchaseReceiptItem(
            tx,
            companyId,
            createdReceiptItem.id,
          );

          const updatedProduct = await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              stock: {
                increment: item.quantityReceived,
              },
            },
            select: {
              stock: true,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              batchId: batch?.id,
              movementType: InventoryMovementType.IN,
              quantity: item.quantityReceived,
              balance: updatedProduct.stock,
              referenceType: 'PURCHASE_RECEIPT',
              referenceId: receipt.id,
              notes: `Recepción ${receipt.folio} de compra ${purchase.folio}`,
              createdBy: receivedBy,
              unitCost: item.unitCost,
            },
          });
        }

        const receivedInCurrentRequest = new Map(
          validatedItems.map((item) => [
            item.purchaseItemId,
            item.quantityReceived,
          ]),
        );

        const purchaseWasFullyReceived = purchase.items.every(
          (purchaseItem) => {
            const previouslyReceived = purchaseItem.receiptItems.reduce(
              (total, receiptItem) => total + receiptItem.quantityReceived,
              0,
            );

            const currentlyReceived =
              receivedInCurrentRequest.get(purchaseItem.id) ?? 0;

            return (
              previouslyReceived + currentlyReceived >= purchaseItem.quantity
            );
          },
        );

        await tx.purchase.update({
          where: {
            id: purchase.id,
          },
          data: {
            status: purchaseWasFullyReceived
              ? PurchaseStatus.RECEIVED
              : PurchaseStatus.PARTIALLY_RECEIVED,
          },
        });

        return tx.purchaseReceipt.findUniqueOrThrow({
          where: {
            id: receipt.id,
          },
          include: {
            purchase: {
              select: {
                id: true,
                folio: true,
                status: true,
              },
            },
            items: {
              include: {
                product: true,
                batch: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      },
    );
  }

  async findAll(companyId: string) {
    return this.prisma.purchaseReceipt.findMany({
      where: {
        companyId,
      },
      include: {
        receivedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        purchase: {
          select: {
            id: true,
            folio: true,
            status: true,
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
              },
            },
            batch: true,
          },
        },
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });
  }

  async findOne(companyId: string, receiptId: string) {
    const receipt = await this.prisma.purchaseReceipt.findFirst({
      where: {
        id: receiptId,
        companyId,
      },
      include: {
        receivedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        purchase: {
          include: {
            supplier: true,
          },
        },
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Recepción no encontrada');
    }

    return receipt;
  }

  async findByPurchase(companyId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Compra no encontrada');
    }

    return this.prisma.purchaseReceipt.findMany({
      where: {
        companyId,
        purchaseId,
      },
      include: {
        receivedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
              },
            },
            batch: true,
          },
        },
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });
  }

  private validateDuplicatedItems(items: CreatePurchaseReceiptItemDto[]): void {
    const purchaseItemIds = new Set<string>();

    for (const item of items) {
      if (purchaseItemIds.has(item.purchaseItemId)) {
        throw new BadRequestException(
          `La partida ${item.purchaseItemId} está repetida en la recepción`,
        );
      }

      purchaseItemIds.add(item.purchaseItemId);
    }
  }

  private validatePurchaseStatus(status: PurchaseStatus): void {
    if (status === PurchaseStatus.DRAFT) {
      throw new BadRequestException(
        'La compra debe confirmarse antes de recibir mercancía',
      );
    }

    if (status === PurchaseStatus.RECEIVED) {
      throw new BadRequestException('La compra ya fue recibida completamente');
    }

    if (status === PurchaseStatus.CANCELLED) {
      throw new BadRequestException('No se puede recibir una compra cancelada');
    }

    if (
      status !== PurchaseStatus.CONFIRMED &&
      status !== PurchaseStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        'El estado de la compra no permite recibir mercancía',
      );
    }
  }

  private async validateProducts(
    tx: Prisma.TransactionClient,
    companyId: string,
    productIds: string[],
  ): Promise<void> {
    const uniqueProductIds = [...new Set(productIds)];

    const products = await tx.product.findMany({
      where: {
        companyId,
        id: {
          in: uniqueProductIds,
        },
      },
      select: {
        id: true,
      },
    });

    const existingProductIds = new Set(products.map((product) => product.id));

    const missingProductId = uniqueProductIds.find(
      (productId) => !existingProductIds.has(productId),
    );

    if (missingProductId) {
      throw new NotFoundException(`Producto ${missingProductId} no encontrado`);
    }
  }

  private async registerBatch(
    tx: Prisma.TransactionClient,
    data: RegisterBatchData,
  ) {
    const existingBatch = await tx.inventoryBatch.findUnique({
      where: {
        companyId_productId_lotNumber: {
          companyId: data.companyId,
          productId: data.productId,
          lotNumber: data.lotNumber,
        },
      },
    });

    if (!existingBatch) {
      return tx.inventoryBatch.create({
        data: {
          companyId: data.companyId,
          productId: data.productId,
          lotNumber: data.lotNumber,
          expirationDate: data.expirationDate,
          initialQuantity: data.quantityReceived,
          availableQuantity: data.quantityReceived,
          unitCost: data.unitCost,
          receivedAt: data.receivedAt,
        },
      });
    }

    this.validateBatchExpirationDate(
      existingBatch.expirationDate,
      data.expirationDate,
      data.lotNumber,
    );

    const newInitialQuantity =
      existingBatch.initialQuantity + data.quantityReceived;

    const weightedUnitCost =
      (existingBatch.unitCost * existingBatch.initialQuantity +
        data.unitCost * data.quantityReceived) /
      newInitialQuantity;

    return tx.inventoryBatch.update({
      where: {
        id: existingBatch.id,
      },
      data: {
        initialQuantity: {
          increment: data.quantityReceived,
        },
        availableQuantity: {
          increment: data.quantityReceived,
        },
        unitCost: weightedUnitCost,
        expirationDate: existingBatch.expirationDate ?? data.expirationDate,
        isActive: true,
      },
    });
  }

  private validateBatchExpirationDate(
    existingExpirationDate: Date | null,
    receivedExpirationDate: Date | undefined,
    lotNumber: string,
  ): void {
    if (!existingExpirationDate || !receivedExpirationDate) {
      return;
    }

    if (existingExpirationDate.getTime() !== receivedExpirationDate.getTime()) {
      throw new BadRequestException(
        `El lote ${lotNumber} ya existe con una fecha de caducidad diferente`,
      );
    }
  }

  private parseExpirationDate(
    value: string | undefined,
    receivedAt: Date,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const expirationDate = new Date(value);

    const expirationDay = Date.UTC(
      expirationDate.getUTCFullYear(),
      expirationDate.getUTCMonth(),
      expirationDate.getUTCDate(),
    );

    const receivedDay = Date.UTC(
      receivedAt.getUTCFullYear(),
      receivedAt.getUTCMonth(),
      receivedAt.getUTCDate(),
    );

    if (expirationDay < receivedDay) {
      throw new BadRequestException(
        'La fecha de caducidad no puede ser anterior a la fecha de recepción',
      );
    }

    return expirationDate;
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    const normalizedValue = value?.trim();

    return normalizedValue || undefined;
  }

  private generateFolio(): string {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');

    const suffix = randomUUID().slice(0, 8).toUpperCase();

    return `REC-${date}-${suffix}`;
  }
}
