import { Injectable, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { ProductInventoryTracking, ProductLotTracking } from '@prisma/client';
import { CreateSaleDto } from './dto/create-sale.dto';

type GenericSalesProduct = {
  id: string;
  name: string;
  inventoryTracking: ProductInventoryTracking;
  lotTracking: ProductLotTracking;
};

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateGenericSalesProductEligibility(product: GenericSalesProduct) {
    if (product.inventoryTracking !== ProductInventoryTracking.QUANTITY) {
      throw new BadRequestException(
        `El producto ${product.name} no es compatible con el flujo de venta genérico por su tipo de seguimiento de inventario`,
      );
    }

    if (product.lotTracking === ProductLotTracking.REQUIRED) {
      throw new BadRequestException(
        `El producto ${product.name} requiere selección de lote para completar la venta`,
      );
    }
  }

  async create(companyId: string, dto: CreateSaleDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        companyId,
        isActive: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(
        'Cliente no encontrado, inactivo o fuera de la empresa',
      );
    }

    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Debe enviar al menos un item');
    }

    /*
     * Aunque el DTO ya valida quantity,
     * mantenemos esta regla de negocio en el
     * service para proteger llamadas internas
     * que no pasen por ValidationPipe.
     */
    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException(
          `Cantidad inválida para producto ${item.productId}`,
        );
      }
    }

    /*
     * Una venta no debe contener el mismo
     * producto en partidas distintas.
     */
    const productIds = new Set<string>();

    for (const item of dto.items) {
      if (productIds.has(item.productId)) {
        throw new BadRequestException(
          `El producto ${item.productId} está duplicado`,
        );
      }

      productIds.add(item.productId);
    }

    const roundMoney = (value: number): number =>
      Math.round((value + Number.EPSILON) * 100) / 100;

    const saleItems: Array<{
      productId: string;
      quantity: number;
      price: number;
      subtotal: number;
    }> = [];

    let subtotal = 0;

    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: Array.from(productIds),
        },
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        inventoryTracking: true,
        lotTracking: true,
      },
    });

    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    for (const item of dto.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new NotFoundException(
          `Producto ${item.productId} no encontrado, inactivo o fuera de la empresa`,
        );
      }

      this.validateGenericSalesProductEligibility(product);

      /*
       * En venta manual el backend utiliza
       * siempre el precio vigente del producto.
       */
      const itemSubtotal = roundMoney(item.quantity * product.price);

      subtotal = roundMoney(subtotal + itemSubtotal);

      saleItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        subtotal: itemSubtotal,
      });
    }

    const iva = roundMoney(subtotal * 0.16);

    const total = roundMoney(subtotal + iva);

    const folio = `V-${Date.now()}`;

    return this.prisma.sale.create({
      data: {
        companyId,
        customerId: dto.customerId,

        folio,

        subtotal,
        iva,
        total,

        status: 'DRAFT',

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

  async approve(companyId: string, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        companyId,
      },
      include: {
        items: true,
      },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    if (sale.status === 'CONFIRMED') {
      throw new BadRequestException('La venta ya fue aprobada');
    }

    if (sale.status === 'CANCELLED') {
      throw new BadRequestException('No se puede aprobar una venta cancelada');
    }

    return this.prisma.$transaction(async (tx) => {
      const saleProductIds = Array.from(
        new Set(sale.items.map((item) => item.productId)),
      );

      const products = await tx.product.findMany({
        where: {
          id: {
            in: saleProductIds,
          },
          companyId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          cost: true,
          inventoryTracking: true,
          lotTracking: true,
        },
      });

      const productsById = new Map(
        products.map((product) => [product.id, product]),
      );

      for (const item of sale.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado, inactivo o fuera de la empresa`,
          );
        }

        this.validateGenericSalesProductEligibility(product);
      }

      /*
       * Reservar la transición DRAFT -> CONFIRMED.
       *
       * Esto evita que dos solicitudes concurrentes
       * aprueben la misma venta y descuenten inventario
       * más de una vez.
       */
      const statusUpdate = await tx.sale.updateMany({
        where: {
          id: saleId,
          companyId,
          status: 'DRAFT',
        },
        data: {
          status: 'CONFIRMED',
        },
      });

      if (statusUpdate.count !== 1) {
        throw new BadRequestException(
          'La venta ya fue aprobada, cancelada o ya no puede aprobarse',
        );
      }

      for (const item of sale.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado, inactivo o fuera de la empresa`,
          );
        }

        /*
         * Descuento condicional.
         *
         * La condición stock >= quantity evita sobreventa
         * incluso cuando existen operaciones concurrentes.
         */
        const stockUpdate = await tx.product.updateMany({
          where: {
            id: product.id,
            companyId,
            isActive: true,
            stock: {
              gte: item.quantity,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (stockUpdate.count !== 1) {
          const currentProduct = await tx.product.findFirst({
            where: {
              id: product.id,
              companyId,
            },
            select: {
              stock: true,
            },
          });

          throw new BadRequestException(
            `Stock insuficiente para ${product.name}. Disponible: ${
              currentProduct?.stock ?? 0
            }`,
          );
        }

        /*
         * Leer el saldo real después del descuento.
         */
        const updatedProduct = await tx.product.findFirst({
          where: {
            id: product.id,
            companyId,
          },
          select: {
            stock: true,
          },
        });

        if (!updatedProduct) {
          throw new NotFoundException(`Producto ${product.id} no encontrado`);
        }

        await tx.inventoryMovement.create({
          data: {
            companyId,
            productId: product.id,

            movementType: 'OUT',
            quantity: item.quantity,

            /*
             * El movimiento almacena costo de inventario,
             * no precio de venta.
             */
            unitCost: product.cost,

            balance: updatedProduct.stock,

            referenceType: 'SALE',
            referenceId: sale.id,

            notes: `Venta aprobada ${sale.folio}`,
          },
        });
      }

      return tx.sale.findFirst({
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
    });
  }

  async generatePDF(companyId: string, saleId: string, res: Response) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
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

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    const companyName = sale.company.tradeName?.trim() || sale.company.name;

    const currency = sale.company.currency || 'MXN';

    const formatMoney = (value: number) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency,
      }).format(value);

    const doc = new PDFDocument();

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=venta-${sale.folio}.pdf`,
    );

    doc.pipe(res);

    doc.fontSize(22);
    doc.text(companyName, {
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

    if (sale.customer.contactName) {
      doc.text(`Contacto: ${sale.customer.contactName}`);
    }

    if (sale.customer.email) {
      doc.text(`Email: ${sale.customer.email}`);
    }

    if (sale.customer.phone) {
      doc.text(`Teléfono: ${sale.customer.phone}`);
    }

    doc.moveDown();

    // Productos

    doc.fontSize(14);
    doc.text('Productos');

    doc.moveDown();

    sale.items.forEach((item) => {
      doc.fontSize(12);

      doc.text(
        `- ${item.product.name} | Cantidad: ${
          item.quantity
        } | Precio: ${formatMoney(item.price)} | Subtotal: ${formatMoney(
          item.subtotal,
        )}`,
      );
    });

    doc.moveDown();

    // Totales

    doc.fontSize(14);

    doc.text(`Subtotal: ${formatMoney(sale.subtotal)}`);

    doc.text(`IVA (16%): ${formatMoney(sale.iva)}`);

    doc.text(`Total: ${formatMoney(sale.total)}`);

    doc.end();
  }

  async createFromQuote(companyId: string, quoteId: string) {
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
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

      if (quote.status !== 'CONFIRMED') {
        throw new BadRequestException(
          'La cotización debe estar aprobada antes de convertirse en venta',
        );
      }

      if (quote.convertedToSale) {
        throw new BadRequestException(
          'La cotización ya fue convertida a venta',
        );
      }

      if (quote.items.length === 0) {
        throw new BadRequestException('La cotización no contiene productos');
      }

      const quoteProductIds = Array.from(
        new Set(quote.items.map((item) => item.productId)),
      );

      const products = await tx.product.findMany({
        where: {
          id: {
            in: quoteProductIds,
          },
          companyId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          cost: true,
          inventoryTracking: true,
          lotTracking: true,
        },
      });

      const productsById = new Map(
        products.map((product) => [product.id, product]),
      );

      for (const item of quote.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado, inactivo o fuera de la empresa`,
          );
        }

        this.validateGenericSalesProductEligibility(product);
      }

      /*
       * Reservar la conversión dentro de la misma
       * transacción.
       *
       * El WHERE convertedToSale: false evita que dos
       * solicitudes simultáneas conviertan la misma
       * cotización.
       */
      const quoteConversion = await tx.quote.updateMany({
        where: {
          id: quoteId,
          companyId,
          status: 'CONFIRMED',
          convertedToSale: false,
        },
        data: {
          convertedToSale: true,
        },
      });

      if (quoteConversion.count !== 1) {
        throw new BadRequestException(
          'La cotización ya fue convertida o ya no puede convertirse',
        );
      }

      const folio = `V-${Date.now()}`;

      const sale = await tx.sale.create({
        data: {
          companyId,
          customerId: quote.customerId,

          quoteId,

          folio,

          subtotal: quote.subtotal,
          iva: quote.iva,
          total: quote.total,

          status: 'CONFIRMED',

          items: {
            create: quote.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
            })),
          },
        },
      });

      for (const item of quote.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado, inactivo o fuera de la empresa`,
          );
        }

        /*
         * El descuento es condicional.
         *
         * Esto evita vender más unidades de las
         * disponibles aunque existan operaciones
         * concurrentes.
         */
        const stockUpdate = await tx.product.updateMany({
          where: {
            id: product.id,
            companyId,
            isActive: true,
            stock: {
              gte: item.quantity,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (stockUpdate.count !== 1) {
          const currentProduct = await tx.product.findFirst({
            where: {
              id: product.id,
              companyId,
            },
            select: {
              stock: true,
            },
          });

          throw new BadRequestException(
            `Stock insuficiente para ${product.name}. Disponible: ${
              currentProduct?.stock ?? 0
            }`,
          );
        }

        const updatedProduct = await tx.product.findFirst({
          where: {
            id: product.id,
            companyId,
          },
          select: {
            stock: true,
          },
        });

        if (!updatedProduct) {
          throw new NotFoundException(`Producto ${product.id} no encontrado`);
        }

        await tx.inventoryMovement.create({
          data: {
            companyId,
            productId: product.id,

            movementType: 'OUT',
            quantity: item.quantity,

            unitCost: product.cost,
            balance: updatedProduct.stock,

            referenceType: 'SALE',
            referenceId: sale.id,

            notes: `Venta ${sale.folio} generada desde cotización ${quote.folio}`,
          },
        });
      }

      return tx.sale.findFirst({
        where: {
          id: sale.id,
          companyId,
        },
        include: {
          customer: true,
          quote: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
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

    /*
     * Transición atómica DRAFT -> CANCELLED.
     *
     * El status en el WHERE evita que una venta
     * sea cancelada si otra operación ya la aprobó
     * o canceló de forma concurrente.
     */
    const statusUpdate = await this.prisma.sale.updateMany({
      where: {
        id: saleId,
        companyId,
        status: 'DRAFT',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (statusUpdate.count !== 1) {
      throw new BadRequestException(
        'La venta ya fue aprobada, cancelada o ya no puede cancelarse',
      );
    }

    const cancelledSale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        companyId,
      },
    });

    if (!cancelledSale) {
      throw new NotFoundException('Venta no encontrada');
    }

    return cancelledSale;
  }
}
