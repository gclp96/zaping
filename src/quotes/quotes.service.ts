import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class QuotesService {
  quotesService: any;
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, data: any) {
    const folio = `COT-${Date.now()}`;

    let subtotal = 0;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (const item of data.items) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      subtotal += item.quantity * item.price;
    }

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    const quote = await this.prisma.quote.create({
      data: {
        companyId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        customerId: data.customerId,

        folio,
        subtotal,
        iva,
        total,

        items: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
        customer: true,
        items: true,
      },
    });

    return quote;
  }

  async findAll(companyId: string) {
    return this.prisma.quote.findMany({
      where: {
        companyId,
      },

      include: {
        customer: true,
        items: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async generatePDF(companyId: string, quoteId: string, res: Response) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
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

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const doc = new PDFDocument({
      margin: 50,
    });

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=quote-${quote.folio}.pdf`,
    );
    doc.pipe(res);

    // Encabezado
    doc.fontSize(22);
    doc.text('INSAP', {
      align: 'center',
    });

    doc.moveDown();

    doc.fontSize(16);
    doc.text(`${quote.folio}`);
    doc.text(`Fecha: ${quote.createdAt.toLocaleDateString()}`);

    doc.moveDown();

    // Cliente
    doc.text(`Cliente: ${quote.customer.name}`);
    doc.text(`Contacto: ${quote.customer.contactName}`);
    doc.text(`Email: ${quote.customer.email}`);
    doc.text(`Teléfono: ${quote.customer.phone}`);

    doc.moveDown();

    // Productos
    doc.fontSize(14);
    doc.text('Productos');

    doc.moveDown();

    quote.items.forEach((item) => {
      doc.fontSize(12);

      doc.text(
        `${item.product.name} | Cantidad: ${item.quantity} | Precio: $${item.price}`,
      );
    });

    doc.moveDown();

    // Totales
    doc.fontSize(14);

    doc.text(`Subtotal: $${quote.subtotal}`);
    doc.text(`IVA: $${quote.iva}`);
    doc.text(`Total: $${quote.total}`);

    doc.end();
  }

  async approve(companyId: string, quoteId: string) {
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

    if (quote.status === 'APPROVED') {
      throw new BadRequestException('La cotización ya fue aprobada');
    }

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
          `Stock insuficiente para ${product.name}`,
        );
      }

      await this.prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stock: product.stock - item.quantity,
        },
      });

      await this.prisma.inventoryMovement.create({
        data: {
          companyId,
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          notes: `Venta aprobada ${quote.folio}`,
        },
      });
    }

    return this.prisma.quote.update({
      where: {
        id: quoteId,
      },
      data: {
        status: 'APPROVED',
      },
    });
  }

  async cancel(companyId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId,
      },
    });

    if (!quote) {
      throw new NotFoundException('Cotización no encontrada');
    }

    if (quote.status === 'APPROVED') {
      throw new BadRequestException(
        'No se puede cancelar una cotización aprobada',
      );
    }

    return this.prisma.quote.update({
      where: {
        id: quoteId,
      },
      data: {
        status: 'CANCELLED',
      },
    });
  }
}
