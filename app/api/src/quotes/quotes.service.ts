import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DocumentStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';

import type { Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';

import { CreateQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateQuoteDto) {
    await this.validateCustomer(companyId, dto.customerId);

    await this.validateProducts(
      companyId,
      dto.items.map((item) => item.productId),
    );

    const items = dto.items.map((item) => {
      const itemSubtotal = this.roundMoney(item.quantity * item.price);

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: itemSubtotal,
      };
    });

    const subtotal = this.roundMoney(
      items.reduce((accumulator, item) => accumulator + item.subtotal, 0),
    );

    const iva = this.roundMoney(subtotal * 0.16);
    const total = this.roundMoney(subtotal + iva);

    const folio = `COT-${Date.now()}`;

    return this.prisma.quote.create({
      data: {
        companyId,
        customerId: dto.customerId,
        folio,
        subtotal,
        iva,
        total,
        items: {
          create: items,
        },
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
  }

  async findAll(companyId: string) {
    return this.prisma.quote.findMany({
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

  async generatePDF(companyId: string, quoteId: string, res: Response) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId,
      },
      include: {
        company: true,
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Cotización no encontrada');
    }

    const companyName = quote.company.tradeName ?? quote.company.name;

    const currency = quote.company.currency || 'MXN';

    const moneyFormatter = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
    });

    const doc = new PDFDocument({
      margin: 50,
    });

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=cotizacion-${quote.folio}.pdf`,
    );

    doc.pipe(res);

    doc.fontSize(22).text(companyName, {
      align: 'center',
    });

    doc.moveDown();

    doc.fontSize(16).text(`Cotización ${quote.folio}`);

    doc
      .fontSize(11)
      .text(`Fecha: ${quote.createdAt.toLocaleDateString('es-MX')}`)
      .text(`Estado: ${quote.status}`);

    doc.moveDown();

    doc.fontSize(14).text('Cliente');

    doc.fontSize(11).text(`Nombre: ${quote.customer.name}`);

    if (quote.customer.contactName) {
      doc.text(`Contacto: ${quote.customer.contactName}`);
    }

    if (quote.customer.email) {
      doc.text(`Email: ${quote.customer.email}`);
    }

    if (quote.customer.phone) {
      doc.text(`Teléfono: ${quote.customer.phone}`);
    }

    doc.moveDown();

    doc.fontSize(14).text('Productos');

    doc.moveDown(0.5);

    for (const item of quote.items) {
      doc
        .fontSize(11)
        .text(`${item.product.sku} — ${item.product.name}`)
        .text(
          [
            `Cantidad: ${item.quantity}`,
            `Precio: ${moneyFormatter.format(item.price)}`,
            `Subtotal: ${moneyFormatter.format(item.subtotal)}`,
          ].join(' | '),
        );

      doc.moveDown(0.5);
    }

    doc.moveDown();

    doc
      .fontSize(12)
      .text(`Subtotal: ${moneyFormatter.format(quote.subtotal)}`, {
        align: 'right',
      })
      .text(`IVA: ${moneyFormatter.format(quote.iva)}`, {
        align: 'right',
      })
      .fontSize(14)
      .text(`Total: ${moneyFormatter.format(quote.total)}`, {
        align: 'right',
      });

    doc.end();
  }

  async approve(companyId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!quote) {
      throw new NotFoundException('Cotización no encontrada');
    }

    if (quote.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se pueden aprobar cotizaciones en borrador',
      );
    }

    return this.prisma.quote.update({
      where: {
        id: quote.id,
      },
      data: {
        status: DocumentStatus.CONFIRMED,
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
  }

  async cancel(companyId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!quote) {
      throw new NotFoundException('Cotización no encontrada');
    }

    if (quote.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se pueden cancelar cotizaciones en borrador',
      );
    }

    return this.prisma.quote.update({
      where: {
        id: quote.id,
      },
      data: {
        status: DocumentStatus.CANCELLED,
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
  }

  private async validateCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(
        'El cliente no existe, está inactivo o no pertenece a la empresa',
      );
    }
  }

  private async validateProducts(companyId: string, productIds: string[]) {
    const uniqueProductIds = [...new Set(productIds)];

    if (uniqueProductIds.length !== productIds.length) {
      throw new BadRequestException(
        'No se puede repetir un producto dentro de la cotización',
      );
    }

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        id: {
          in: uniqueProductIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (products.length !== uniqueProductIds.length) {
      throw new NotFoundException(
        'Uno o más productos no existen, están inactivos o no pertenecen a la empresa',
      );
    }
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
