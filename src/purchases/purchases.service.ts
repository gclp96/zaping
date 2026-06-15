import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import PDFDocument from 'pdfkit';
import { Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreatePurchaseDto) {
    try {
      if (!dto.items || !Array.isArray(dto.items)) {
        throw new BadRequestException('Debe enviar un arreglo items');
      }

      const folio = `OC-${Date.now()}`;

      let subtotal = 0;

      const purchaseItems: Array<{
        productId: string;
        quantity: number;
        price: number;
        subtotal: number;
      }> = [];

      for (const item of dto.items) {
        const product = await this.prisma.product.findUnique({
          where: {
            id: item.productId,
          },
        });

        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado`,
          );
        }

        const itemSubtotal = item.quantity * product.cost;

        subtotal += itemSubtotal;

        purchaseItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.cost,
          subtotal: itemSubtotal,
        });
      }

      const iva = subtotal * 0.16;
      const total = subtotal + iva;

      return await this.prisma.purchase.create({
        data: {
          companyId,
          supplier: dto.supplier,
          folio,
          subtotal,
          iva,
          total,

          items: {
            create: purchaseItems,
          },
        },

        include: {
          items: true,
        },
      });
    } catch (error) {
      console.dir(error, { depth: null });
      throw error;
    }
  }

  async findAll(companyId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        companyId,
      },

      include: {
        items: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    return purchases;
  }

  async approve(companyId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        companyId,
      },
      include: {
        items: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Compra no encontrada');
    }

    if (purchase.status === 'APPROVED') {
      throw new BadRequestException('La compra ya fue aprobada');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of purchase.items) {
        const product = await tx.product.findUnique({
          where: {
            id: item.productId,
          },
        });

        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado`,
          );
        }

        const newStock = product.stock + item.quantity;

        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId,

            productId: item.productId,

            type: 'IN',

            quantity: item.quantity,

            balance: newStock,

            referenceType: 'PURCHASE',

            referenceId: purchase.id,

            notes: `Compra aprobada ${purchase.folio}`,
          },
        });
      }

      return tx.purchase.update({
        where: {
          id: purchaseId,
        },
        data: {
          status: 'APPROVED',
        },
      });
    });
  }

  async generatePDF(companyId: string, purchaseId: string, res: Response) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        companyId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException('Compra no encontrada');
    }

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=compra-${purchase.folio}.pdf`,
    );

    doc.pipe(res);

    // Encabezado

    doc.fontSize(22);
    doc.text('INSAP', { align: 'center' });

    doc.moveDown();

    doc.fontSize(18);
    doc.text('ORDEN DE COMPRA', { align: 'center' });

    doc.moveDown();

    doc.fontSize(14);
    doc.text(`Folio: ${purchase.folio}`);
    doc.text(
      `Fecha: ${purchase.createdAt.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
    );

    doc.moveDown();

    //Proveedor

    doc.fontSize(16);
    doc.text(`Proveedor: ${purchase.supplier}`);

    doc.moveDown();

    // Tabla de productos

    doc.fontSize(14);
    doc.text('Productos:');

    doc.moveDown();

    purchase.items.forEach((item) => {
      doc.fontSize(12);
      doc.text(
        `- ${item.product.name} | Cantidad: ${item.quantity} | Precio: $${item.price.toFixed(2)} | Subtotal: $${item.subtotal.toFixed(2)}`,
      );
    });

    doc.moveDown();

    // Totales

    doc.fontSize(14);
    doc.text(`Subtotal: $${purchase.subtotal.toFixed(2)}`);
    doc.text(`IVA (16%): $${purchase.iva.toFixed(2)}`);
    doc.text(`Total: $${purchase.total.toFixed(2)}`);

    doc.end();
  }
}
