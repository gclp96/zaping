import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import PDFDocument from 'pdfkit';
import { Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreatePurchaseDto) {
    const productIds = dto.items.map((item) => item.productId);
    const uniqueProductIds = new Set(productIds);

    if (uniqueProductIds.size !== productIds.length) {
      throw new BadRequestException(
        'No se permiten productos duplicados en una compra',
      );
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: dto.supplierId,
        companyId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        id: {
          in: productIds,
        },
      },
    });

    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    const missingProductId = productIds.find(
      (productId) => !productsById.has(productId),
    );

    if (missingProductId) {
      throw new NotFoundException(`Producto ${missingProductId} no encontrado`);
    }

    const purchaseItems: Array<{
      productId: string;
      quantity: number;
      price: number;
      subtotal: number;
    }> = [];

    let subtotal = 0;

    for (const item of dto.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new NotFoundException(`Producto ${item.productId} no encontrado`);
      }

      const itemSubtotal = this.roundMoney(item.quantity * product.cost);

      subtotal = this.roundMoney(subtotal + itemSubtotal);

      purchaseItems.push({
        productId: product.id,

        quantity: item.quantity,
        price: product.cost,
        subtotal: itemSubtotal,
      });
    }

    const iva = this.roundMoney(subtotal * 0.16);
    const total = this.roundMoney(subtotal + iva);
    const folio = `OC-${Date.now()}`;

    return this.prisma.purchase.create({
      data: {
        companyId,
        supplierId: dto.supplierId,
        folio,
        subtotal,
        iva,
        total,
        items: {
          create: purchaseItems,
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async findAll(companyId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        companyId,
      },
      include: {
        supplier: true,
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

    const purchaseItemIds = purchases.flatMap((purchase) =>
      purchase.items.map((item) => item.id),
    );

    const receiptItems =
      purchaseItemIds.length === 0
        ? []
        : await this.prisma.purchaseReceiptItem.findMany({
            where: {
              companyId,
              purchaseItemId: {
                in: purchaseItemIds,
              },
            },
            select: {
              purchaseItemId: true,
              quantityReceived: true,
            },
          });

    const receivedByPurchaseItem = new Map<string, number>();

    for (const receiptItem of receiptItems) {
      const previousQuantity =
        receivedByPurchaseItem.get(receiptItem.purchaseItemId) ?? 0;

      receivedByPurchaseItem.set(
        receiptItem.purchaseItemId,
        previousQuantity + Math.max(receiptItem.quantityReceived, 0),
      );
    }

    return purchases.map((purchase) => {
      let orderedUnits = 0;
      let receivedUnits = 0;
      let pendingUnits = 0;
      let completedLines = 0;

      for (const item of purchase.items) {
        const orderedQuantity = Math.max(item.quantity, 0);
        const receivedQuantity = Math.max(
          receivedByPurchaseItem.get(item.id) ?? 0,
          0,
        );
        const pendingQuantity = Math.max(orderedQuantity - receivedQuantity, 0);

        orderedUnits += orderedQuantity;
        receivedUnits += receivedQuantity;
        pendingUnits += pendingQuantity;

        if (receivedQuantity >= orderedQuantity) {
          completedLines += 1;
        }
      }

      return {
        ...purchase,
        receiptProgress: {
          orderedUnits,
          receivedUnits,
          pendingUnits,
          orderedLines: purchase.items.length,
          completedLines,
        },
      };
    });
  }

  async update(companyId: string, purchaseId: string, dto: UpdatePurchaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: {
          id: purchaseId,
          companyId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!purchase) {
        throw new NotFoundException('Compra no encontrada');
      }

      if (purchase.status !== 'DRAFT') {
        throw new BadRequestException(
          `No se puede editar una compra con estado ${purchase.status}`,
        );
      }

      const productIds = dto.items.map((item) => item.productId);

      const uniqueProductIds = new Set(productIds);

      if (uniqueProductIds.size !== productIds.length) {
        throw new BadRequestException(
          'No se permiten productos duplicados en una compra',
        );
      }

      const supplier = await tx.supplier.findFirst({
        where: {
          id: dto.supplierId,
          companyId,
        },
        select: {
          id: true,
        },
      });

      if (!supplier) {
        throw new NotFoundException('Proveedor no encontrado');
      }

      const products = await tx.product.findMany({
        where: {
          companyId,
          id: {
            in: productIds,
          },
        },
      });

      const productsById = new Map(
        products.map((product) => [product.id, product]),
      );

      const missingProductId = productIds.find(
        (productId) => !productsById.has(productId),
      );

      if (missingProductId) {
        throw new NotFoundException(
          `Producto ${missingProductId} no encontrado`,
        );
      }

      const purchaseItems: Array<{
        productId: string;
        quantity: number;
        price: number;
        subtotal: number;
      }> = [];

      let subtotal = 0;

      for (const item of dto.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado`,
          );
        }

        const itemSubtotal = this.roundMoney(item.quantity * product.cost);

        subtotal = this.roundMoney(subtotal + itemSubtotal);

        purchaseItems.push({
          productId: product.id,

          quantity: item.quantity,
          price: product.cost,
          subtotal: itemSubtotal,
        });
      }

      const iva = this.roundMoney(subtotal * 0.16);
      const total = this.roundMoney(subtotal + iva);

      return tx.purchase.update({
        where: {
          id: purchaseId,
        },
        data: {
          supplierId: dto.supplierId,
          subtotal,
          iva,
          total,
          items: {
            deleteMany: {},
            create: purchaseItems,
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });
  }

  async findInventoryMovements(companyId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        companyId,
      },
      select: {
        id: true,
        receipts: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException('Compra no encontrada');
    }

    const receiptIds = purchase.receipts.map((receipt) => receipt.id);

    if (receiptIds.length === 0) {
      return [];
    }

    return this.prisma.inventoryMovement.findMany({
      where: {
        companyId,
        referenceType: 'PURCHASE_RECEIPT',
        referenceId: {
          in: receiptIds,
        },
      },
      include: {
        product: true,
        batch: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async approve(companyId: string, purchaseId: string) {
    return this.prisma.$transaction(async (tx) => {
      const statusTransition = await tx.purchase.updateMany({
        where: {
          id: purchaseId,
          companyId,
          status: 'DRAFT',
        },
        data: {
          status: 'CONFIRMED',
        },
      });

      if (statusTransition.count === 0) {
        const existingPurchase = await tx.purchase.findFirst({
          where: {
            id: purchaseId,
            companyId,
          },
          select: {
            status: true,
          },
        });

        if (!existingPurchase) {
          throw new NotFoundException('Compra no encontrada');
        }

        if (existingPurchase.status === 'CONFIRMED') {
          throw new ConflictException('La compra ya fue confirmada');
        }

        throw new BadRequestException(
          `No se puede confirmar una compra con estado ${existingPurchase.status}`,
        );
      }

      const purchase = await tx.purchase.findFirst({
        where: {
          id: purchaseId,
          companyId,
        },
        include: {
          supplier: true,
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

      if (purchase.items.length === 0) {
        throw new BadRequestException(
          'No se puede confirmar una compra sin productos',
        );
      }

      return purchase;
    });
  }

  async cancel(companyId: string, purchaseId: string) {
    const statusTransition = await this.prisma.purchase.updateMany({
      where: {
        id: purchaseId,
        companyId,
        status: 'DRAFT',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (statusTransition.count === 0) {
      const purchase = await this.prisma.purchase.findFirst({
        where: {
          id: purchaseId,
          companyId,
        },
        select: {
          status: true,
        },
      });

      if (!purchase) {
        throw new NotFoundException('Compra no encontrada');
      }

      if (purchase.status === 'CANCELLED') {
        throw new ConflictException('La compra ya fue cancelada');
      }

      if (purchase.status === 'CONFIRMED') {
        throw new BadRequestException(
          'Una compra confirmada no puede cancelarse',
        );
      }

      throw new BadRequestException(
        `No se puede cancelar una compra con estado ${purchase.status}`,
      );
    }

    return this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        companyId,
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async generatePDF(companyId: string, purchaseId: string, res: Response) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        companyId,
      },
      include: {
        company: true,
        supplier: true,
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

    const formatMoney = (value: number) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: purchase.company.currency,
      }).format(value);

    const formatDate = (date: Date) =>
      new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);

    const getStatusLabel = (status: string) => {
      if (status === 'DRAFT') return 'Borrador';
      if (status === 'CONFIRMED') return 'Confirmada';
      if (status === 'PARTIALLY_RECEIVED') {
        return 'Recibida partcialmente';
      }
      if (status === 'RECEIVED') return 'Recibida';
      if (status === 'CANCELLED') return 'Cancelada';

      return status;
    };

    const getValue = (value?: string | null) =>
      value && value.trim().length > 0 ? value : 'No especificado';

    const fileName = `compra-${purchase.folio.replace(/[^a-zA-Z0-9-_]/g, '-')}.pdf`;

    const doc = new PDFDocument({
      margin: 50,
      size: 'LETTER',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const pageWidth = right - left;

    const addPageIfNeeded = (requiredSpace: number) => {
      if (doc.y + requiredSpace > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        return true;
      }

      return false;
    };

    const drawDivider = () => {
      doc
        .moveTo(left, doc.y)
        .lineTo(right, doc.y)
        .strokeColor('#E5E7EB')
        .stroke();

      doc.moveDown();
    };

    const companyName = purchase.company.tradeName || purchase.company.name;

    // Encabezado
    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(companyName, {
        align: 'left',
      });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#4B5563')
      .text(`RFC: ${purchase.company.rfc}`)
      .text(`Correo: ${getValue(purchase.company.email)}`)
      .text(`Teléfono: ${getValue(purchase.company.phone)}`);

    doc.moveDown();

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#111827')
      .text('ORDEN DE COMPRA', {
        align: 'right',
      });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#374151')
      .text(`Folio: ${purchase.folio}`, {
        align: 'right',
      })
      .text(`Fecha: ${formatDate(purchase.createdAt)}`, {
        align: 'right',
      })
      .text(`Estado: ${getStatusLabel(purchase.status)}`, {
        align: 'right',
      });

    doc.moveDown();
    drawDivider();

    // Proveedor
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#111827')
      .text('Proveedor');

    doc.moveDown(0.5);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#374151')
      .text(`Nombre: ${purchase.supplier.name}`)
      .text(`Contacto: ${getValue(purchase.supplier.contactName)}`)
      .text(`Correo: ${getValue(purchase.supplier.email)}`)
      .text(`Teléfono: ${getValue(purchase.supplier.phone)}`)
      .text(`Dirección: ${getValue(purchase.supplier.address)}`);

    doc.moveDown();
    drawDivider();

    // Tabla
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#111827')
      .text('Productos');

    doc.moveDown(0.75);

    const columns = {
      sku: {
        x: left,
        width: 70,
      },
      product: {
        x: left + 75,
        width: 205,
      },
      quantity: {
        x: left + 285,
        width: 55,
      },
      price: {
        x: left + 345,
        width: 80,
      },
      subtotal: {
        x: left + 430,
        width: pageWidth - 430,
      },
    };

    const drawTableHeader = () => {
      const y = doc.y;

      doc.rect(left, y, pageWidth, 24).fillColor('#F3F4F6').fill();

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');

      doc.text('SKU', columns.sku.x + 4, y + 7, {
        width: columns.sku.width,
      });

      doc.text('Producto', columns.product.x, y + 7, {
        width: columns.product.width,
      });

      doc.text('Cant.', columns.quantity.x, y + 7, {
        width: columns.quantity.width,
        align: 'right',
      });

      doc.text('Costo', columns.price.x, y + 7, {
        width: columns.price.width,
        align: 'right',
      });

      doc.text('Subtotal', columns.subtotal.x, y + 7, {
        width: columns.subtotal.width,
        align: 'right',
      });

      doc.y = y + 30;
    };

    drawTableHeader();

    purchase.items.forEach((item) => {
      const productName = item.product.name;
      const productHeight = doc.heightOfString(productName, {
        width: columns.product.width,
      });

      const rowHeight = Math.max(30, productHeight + 14);

      const addedPage = addPageIfNeeded(rowHeight + 20);

      if (addedPage) {
        drawTableHeader();
      }

      const y = doc.y;

      doc.font('Helvetica').fontSize(9).fillColor('#374151');

      doc.text(item.product.sku, columns.sku.x + 4, y + 7, {
        width: columns.sku.width,
      });

      doc.text(productName, columns.product.x, y + 7, {
        width: columns.product.width,
      });

      doc.text(String(item.quantity), columns.quantity.x, y + 7, {
        width: columns.quantity.width,
        align: 'right',
      });

      doc.text(formatMoney(item.price), columns.price.x, y + 7, {
        width: columns.price.width,
        align: 'right',
      });

      doc.text(formatMoney(item.subtotal), columns.subtotal.x, y + 7, {
        width: columns.subtotal.width,
        align: 'right',
      });

      doc
        .moveTo(left, y + rowHeight)
        .lineTo(right, y + rowHeight)
        .strokeColor('#E5E7EB')
        .stroke();

      doc.y = y + rowHeight + 6;
    });

    // Totales
    addPageIfNeeded(110);

    doc.moveDown();

    const totalsX = right - 220;
    const totalsLabelWidth = 100;
    const totalsValueWidth = 120;

    doc.font('Helvetica').fontSize(10).fillColor('#374151');

    doc.text('Subtotal', totalsX, doc.y, {
      width: totalsLabelWidth,
    });

    doc.text(
      formatMoney(purchase.subtotal),
      totalsX + totalsLabelWidth,
      doc.y - 12,
      {
        width: totalsValueWidth,
        align: 'right',
      },
    );

    doc.moveDown(0.75);

    doc.text('IVA (16%)', totalsX, doc.y, {
      width: totalsLabelWidth,
    });

    doc.text(
      formatMoney(purchase.iva),
      totalsX + totalsLabelWidth,
      doc.y - 12,
      {
        width: totalsValueWidth,
        align: 'right',
      },
    );

    doc.moveDown(0.75);

    doc
      .moveTo(totalsX, doc.y)
      .lineTo(right, doc.y)
      .strokeColor('#D1D5DB')
      .stroke();

    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827');

    doc.text('Total', totalsX, doc.y, {
      width: totalsLabelWidth,
    });

    doc.text(
      formatMoney(purchase.total),
      totalsX + totalsLabelWidth,
      doc.y - 14,
      {
        width: totalsValueWidth,
        align: 'right',
      },
    );

    // Pie
    doc.moveDown(3);

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#6B7280')
      .text(
        'Documento generado por Zaping ERP. Esta orden de compra es para control operativo interno.',
        left,
        doc.page.height - 70,
        {
          width: pageWidth,
          align: 'center',
        },
      );

    doc.end();
  }
}
