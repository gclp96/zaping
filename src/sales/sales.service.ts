import { Injectable, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateSaleDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        companyId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Debe enviar al menos un item');
    }

    const saleItems: Array<{
      productId: string;
      quantity: number;
      price: number;
      subtotal: number;
    }> = [];

    let subtotal = 0;

    for (const item of dto.items) {
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new BadRequestException(
          `Cantidad inválida para producto ${item.productId}`,
        );
      }

      const product = await this.prisma.product.findFirst({
        where: {
          id: item.productId,
          companyId,
        },
      });

      if (!product) {
        throw new NotFoundException(`Producto ${item.productId} no encontrado`);
      }

      const itemSubtotal = item.quantity * product.price;

      subtotal += itemSubtotal;

      saleItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        subtotal: itemSubtotal,
      });
    }

    const folio = `V-${Date.now()}`;
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    return this.prisma.sale.create({
      data: {
        companyId,
        customerId: dto.customerId,
        folio,
        subtotal,
        iva,
        total,
        items: {
          create: saleItems,
        },
      },
      include: {
        items: true,
      },
    });
  }

  async findOne(companyId: string, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        companyId,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    return sale;
  }

  async findAll(companyId: string) {
    return this.prisma.sale.findMany({
      where: {
        companyId,
      },

      include: {
        customer: true,

        items: {
          include: {
            product: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async approve(companyId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
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

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    if (sale.status === 'CONFIRMED') {
      throw new BadRequestException('La venta ya fue aprobada');
    }

    // Validar inventario disponible
    for (const item of sale.items) {
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para ${item.product.name}. Disponible: ${item.product.stock}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        const newStock = item.product.stock - item.quantity;

        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId,
            productId: item.productId,
            unitCost: item.price,

            movementType: 'OUT',
            quantity: item.quantity,

            balance: newStock,

            referenceType: 'SALE',
            referenceId: sale.id,

            notes: `Venta aprobada ${sale.folio}`,
          },
        });
      }

      return tx.sale.update({
        where: {
          id,
        },
        data: {
          status: 'CONFIRMED',
        },
      });
    });
  }

  async generatePDF(companyId: string, saleId: string, res: Response) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        companyId,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    const doc = new PDFDocument();

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=venta-${sale.folio}.pdf`,
    );

    doc.pipe(res);

    // Encabezado

    doc.fontSize(22);
    doc.text('INSAP', {
      align: 'center',
    });

    doc.moveDown();

    doc.fontSize(18);
    doc.text('VENTA', {
      align: 'center',
    });

    doc.moveDown();

    doc.fontSize(14);

    doc.text(`Folio: ${sale.folio}`);

    doc.text(
      `Fecha: ${sale.createdAt.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
    );

    doc.text(`Estado: ${sale.status}`);

    doc.moveDown();

    // Cliente

    doc.fontSize(16);
    doc.text(`Cliente: ${sale.customer.name}`);
    doc.text(`Contacto: ${sale.customer.contactName ?? ''}`);
    doc.text(`Email: ${sale.customer.email}`);
    doc.text(`Teléfono: ${sale.customer.phone}`);

    doc.moveDown();

    // Productos

    doc.fontSize(14);
    doc.text('Productos');

    doc.moveDown();

    sale.items.forEach((item) => {
      doc.fontSize(12);

      doc.text(
        `- ${item.product.name} | Cantidad: ${item.quantity} | Precio: $${item.price.toFixed(
          2,
        )} | Subtotal: $${item.subtotal.toFixed(2)}`,
      );
    });

    doc.moveDown();

    // Totales

    doc.fontSize(14);

    doc.text(`Subtotal: $${sale.subtotal.toFixed(2)}`);
    doc.text(`IVA (16%): $${sale.iva.toFixed(2)}`);
    doc.text(`Total: $${sale.total.toFixed(2)}`);

    doc.end();
  }

  async createFromQuote(companyId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId,
      },
      include: {
        items: true,
      },
    });

    if (!quote) {
      throw new NotFoundException('Cotización no encontrada');
    }

    if (quote.convertedToSale) {
      throw new BadRequestException('La cotización ya fue convertida a venta');
    }

    if (quote.status !== 'CONFIRMED') {
      throw new BadRequestException('La cotización debe estar aprobada');
    }

    // Validar inventario disponible

    for (const item of quote.items) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: item.productId,
          companyId,
        },
      });

      if (!product) {
        throw new NotFoundException(`Producto ${item.productId} no encontrado`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para ${product.name}. Disponible: ${product.stock}`,
        );
      }
    }

    const folio = `V-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          companyId,
          customerId: quote.customerId,
          folio,
          subtotal: quote.subtotal,
          iva: quote.iva,
          total: quote.total,
          items: {
            create: quote.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      await tx.quote.update({
        where: {
          id: quoteId,
        },
        data: {
          convertedToSale: true,
        },
      });

      return sale;
    });
  }

  async cancel(companyId: string, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        companyId,
      },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    if (sale.status === 'CONFIRMED') {
      throw new BadRequestException('No se puede cancelar una venta aprobada');
    }

    if (sale.status === 'CANCELLED') {
      throw new BadRequestException('La venta ya está cancelada');
    }

    return this.prisma.sale.update({
      where: {
        id: saleId,
      },
      data: {
        status: 'CANCELLED',
      },
    });
  }
}
