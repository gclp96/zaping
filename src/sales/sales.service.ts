/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async create(companyId: string, data: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!data.items || !Array.isArray(data.items)) {
      throw new BadRequestException('Debe enviar un arreglo items');
    }

    const folio = `V-${Date.now()}`;

    let subtotal = 0;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (const item of data.items) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      subtotal += item.quantity * item.price;
    }

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return this.prisma.sale.create({
      data: {
        companyId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        customerId: data.customerId,

        folio,
        subtotal,
        iva,
        total,

        items: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          create: data.items.map((item: any) => ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            productId: item.productId,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            quantity: item.quantity,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            price: item.price,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            subtotal: item.quantity * item.price,
          })),
        },
      },

      include: {
        items: true,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findAll(companyId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (sale.status === 'APPROVED') {
      throw new BadRequestException('La venta ya fue aprobada');
    }

    // Validar inventario disponible
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (const item of sale.items) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Stock insuficiente para ${item.product.name}. Disponible: ${item.product.stock}`,
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      for (const item of sale.items) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const newStock = item.product.stock - item.quantity;

        await tx.product.update({
          where: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            id: item.productId,
          },
          data: {
            stock: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              decrement: item.quantity,
            },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            productId: item.productId,

            type: 'OUT',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            quantity: item.quantity,

            balance: newStock,

            referenceType: 'SALE',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            referenceId: sale.id,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            notes: `Venta aprobada ${sale.folio}`,
          },
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return tx.sale.update({
        where: {
          id,
        },
        data: {
          status: 'APPROVED',
        },
      });
    });
  }

  async generatePDF(companyId: string, saleId: string, res: Response) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    doc.text(`Folio: ${sale.folio}`);

    doc.text(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      `Fecha: ${sale.createdAt.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    doc.text(`Estado: ${sale.status}`);

    doc.moveDown();

    // Cliente

    doc.fontSize(16);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    doc.text(`Cliente: ${sale.customer.name}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    doc.text(`Contacto: ${sale.customer.contactName ?? ''}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    doc.text(`Email: ${sale.customer.email}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    doc.text(`Teléfono: ${sale.customer.phone}`);

    doc.moveDown();

    // Productos

    doc.fontSize(14);
    doc.text('Productos');

    doc.moveDown();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    sale.items.forEach((item) => {
      doc.fontSize(12);

      doc.text(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `- ${item.product.name} | Cantidad: ${item.quantity} | Precio: $${item.price.toFixed(
          2,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        )} | Subtotal: $${item.subtotal.toFixed(2)}`,
      );
    });

    doc.moveDown();

    // Totales

    doc.fontSize(14);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    doc.text(`Subtotal: $${sale.subtotal.toFixed(2)}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    doc.text(`IVA (16%): $${sale.iva.toFixed(2)}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

    if (quote.status !== 'APPROVED') {
      throw new BadRequestException('La cotización debe estar aprobada');
    }

    // Validar inventario disponible

    for (const item of quote.items) {
      const product = await this.prisma.product.findUnique({
        where: {
          id: item.productId,
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const sale = await this.prisma.sale.create({
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

    await this.prisma.quote.update({
      where: {
        id: quoteId,
      },
      data: {
        convertedToSale: true,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return sale;
  }

  async cancel(companyId: string, saleId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        companyId,
      },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (sale.status === 'APPROVED') {
      throw new BadRequestException('No se puede cancelar una venta aprobada');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (sale.status === 'CANCELLED') {
      throw new BadRequestException('La venta ya está cancelada');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
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
