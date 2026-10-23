import { InventoryAuthorityTransactionService } from './inventory-authority-transaction.service';
import { InventoryAuthorityError } from './inventory-authority-error';
import { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesFolioService } from '../../sales/sales-folio.service';
import {
  SalesPhysicalSourceResolver,
  validateSalesItems,
} from './sales-physical-source-resolver';
import { PhysicalInventoryService } from './physical-inventory.service';
import { InventoryCompatibilityProjectionService } from './inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from './inventory-compatibility-history.service';
import {
  PhysicalInventoryError,
  physicalPersistenceError,
  requirePhysical,
} from './physical-inventory.contract';
import { SalesLegacyClassifier } from './sales-legacy-classifier';
import { assertSalesPhysicalEvidence } from './sales-physical-evidence';

const saleInclude = {
  customer: true,
  quote: true,
  items: { include: { product: true } },
} as const;
type Sale = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;
type Mode = 'approve' | 'quote';
class ConversionRace extends Error {}

@Injectable()
// One transaction owner for both authority branches; physical algorithm stays here.
export class SalesPhysicalIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folios: SalesFolioService,
    private readonly resolver: SalesPhysicalSourceResolver,
    private readonly physical: PhysicalInventoryService,
    private readonly projections: InventoryCompatibilityProjectionService,
    private readonly history: InventoryCompatibilityHistoryService,
    private readonly authority: InventoryAuthorityTransactionService,
    @Optional()
    private readonly legacy: SalesLegacyClassifier = new SalesLegacyClassifier(),
  ) {}

  approve(
    companyId: string,
    actorId: string,
    saleId: string,
    legacy?: (tx: Prisma.TransactionClient) => Promise<Sale>,
  ) {
    return this.run(companyId, actorId, saleId, 'approve', legacy);
  }
  createFromQuote(
    companyId: string,
    actorId: string,
    quoteId: string,
    legacy?: (tx: Prisma.TransactionClient) => Promise<Sale>,
  ) {
    return this.run(companyId, actorId, quoteId, 'quote', legacy);
  }

  private async authorize(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string,
  ) {
    const actor = await tx.user.findFirst({
      where: { id: actorId, companyId, isActive: true },
    });
    if (!actor || !['ADMIN', 'MANAGER', 'SALES'].includes(actor.role))
      throw new ForbiddenException('No autorizado para confirmar ventas');
  }
  private async run(
    companyId: string,
    actorId: string,
    id: string,
    mode: Mode,
    legacy?: (tx: Prisma.TransactionClient) => Promise<Sale>,
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sale = await this.authority.run(
          companyId,
          async (tx, authority) => {
            if (authority === 'LEGACY') {
              if (!legacy)
                throw new InventoryAuthorityError('LEGACY_AUTHORITY_REQUIRED');
              return legacy(tx);
            }
            await this.authorize(tx, companyId, actorId);
            // Coherent committed retries perform no writes, including folio allocation.
            const replay = await this.readReplay(
              tx,
              companyId,
              actorId,
              id,
              mode,
            );
            if (replay) return replay;
            if (mode === 'quote')
              return this.convert(tx, companyId, actorId, id);
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM "Sale" WHERE id=${id} AND "companyId"=${companyId} FOR UPDATE`,
            );
            const lockedReplay = await this.readReplay(
              tx,
              companyId,
              actorId,
              id,
              mode,
            );
            if (lockedReplay) return lockedReplay;
            const sale = await this.getSale(tx, companyId, id);
            if (sale.status !== 'DRAFT')
              throw new BadRequestException(
                'No se puede aprobar una venta cancelada',
              );
            const claim = await tx.sale.updateMany({
              where: { id, companyId, status: 'DRAFT' },
              data: { status: 'CONFIRMED' },
            });
            requirePhysical(
              claim.count === 1,
              'SALE_PHYSICAL_STATE_INCONSISTENT',
            );
            return this.fulfill(tx, companyId, actorId, sale);
          },
        );
        return this.response(sale, mode);
      } catch (error) {
        if (error instanceof HttpException) throw error;
        if (
          error instanceof BadRequestException ||
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
        )
          throw error;
        const domain = physicalPersistenceError(error);
        if (domain.transactionAborted) {
          if (attempt < 2) {
            await new Promise((resolve) =>
              setTimeout(resolve, 10 * (attempt + 1)),
            );
            continue;
          }
          throw domain;
        }
        // Only the core's classified Effect claim conflict authorizes origin
        // readback. Unrelated UNIQUE failures are not successful replays.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.meta?.code === '23505')
        )
          throw domain;
        // Only after the entire transaction has ended. This also handles an
        // uncertain commit result without ever blindly attempting another debit.
        if (
          error instanceof ConversionRace ||
          domain.code === 'PHYSICAL_EFFECT_CLAIM_CONFLICT' ||
          !(error instanceof PhysicalInventoryError)
        ) {
          const replay = await this.authority
            .run(companyId, async (tx, authority) => {
              if (authority !== 'PHYSICAL')
                throw new InventoryAuthorityError('LEGACY_AUTHORITY_REQUIRED');
              await this.authorize(tx, companyId, actorId);
              return this.readReplay(tx, companyId, actorId, id, mode);
            })
            .catch((readError) => {
              if (
                readError instanceof BadRequestException ||
                readError instanceof ForbiddenException ||
                readError instanceof NotFoundException
              )
                throw readError;
              throw physicalPersistenceError(readError);
            });
          if (replay) return this.response(replay, mode);
        }
        if (domain.code === 'PHYSICAL_EFFECT_MISMATCH')
          throw new PhysicalInventoryError('SALE_PHYSICAL_EFFECT_MISMATCH');
        throw domain;
      }
    }
    throw new PhysicalInventoryError('PHYSICAL_CONCURRENCY_TIMEOUT');
  }
  private response(sale: Sale, mode: Mode) {
    if (mode === 'quote') return sale;
    const { quote: _quote, ...response } = sale;
    void _quote;
    return response;
  }
  private async getSale(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ) {
    const sale = await tx.sale.findFirst({
      where: { id, companyId },
      include: saleInclude,
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }
  private duplicate(mode: Mode): never {
    throw new BadRequestException(
      mode === 'approve'
        ? 'La venta ya fue aprobada'
        : 'La cotización ya fue convertida a venta',
    );
  }
  private async readReplay(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string,
    id: string,
    mode: Mode,
  ): Promise<Sale | null> {
    let sale: Sale;
    if (mode === 'quote') {
      // A single SQL statement observes conversion flag and canonical identity
      // atomically; Prisma's separate relation queries could straddle a commit.
      const [quote] = await tx.$queryRaw<
        { status: string; convertedToSale: boolean; saleId: string | null }[]
      >(Prisma.sql`
        SELECT q.status, q."convertedToSale", s.id AS "saleId"
        FROM "Quote" q LEFT JOIN "Sale" s ON s."quoteId"=q.id
        WHERE q.id=${id} AND q."companyId"=${companyId}
      `);
      if (!quote) throw new NotFoundException('Cotización no encontrada');
      if (!quote.convertedToSale && !quote.saleId) {
        if (quote.status !== 'CONFIRMED')
          throw new BadRequestException(
            'La cotización debe estar aprobada antes de convertirse en venta',
          );
        return null;
      }
      requirePhysical(
        quote.convertedToSale && quote.saleId && quote.status === 'CONFIRMED',
        'SALE_PHYSICAL_STATE_INCONSISTENT',
      );
      sale = await this.getSale(tx, companyId, quote.saleId);
      requirePhysical(
        sale.companyId === companyId && sale.quoteId === id,
        'SALE_PHYSICAL_STATE_INCONSISTENT',
      );
    } else {
      sale = await this.getSale(tx, companyId, id);
    }
    const effect = await tx.inventoryPhysicalEffect.findUnique({
      where: {
        companyId_originType_originId_originOperation: {
          companyId,
          originType: 'SALE',
          originId: sale.id,
          originOperation: 'CONFIRM',
        },
      },
      include: {
        lines: { include: { position: true }, orderBy: { sequence: 'asc' } },
      },
    });
    // Another committed confirmation can appear between READ COMMITTED reads.
    // Re-read the immutable business state if evidence is newer than our Sale read.
    if (effect && sale.status !== 'CONFIRMED')
      sale = await this.getSale(tx, companyId, sale.id);
    if (!effect) {
      if (sale.status === 'DRAFT' && mode === 'approve') {
        await this.legacy.assertNoMembership(tx, companyId, sale.id);
        return null;
      }
      if (sale.status === 'CANCELLED' && mode === 'approve')
        throw new BadRequestException(
          'No se puede aprobar una venta cancelada',
        );
      if (
        sale.status === 'CONFIRMED' &&
        (await this.legacy.classify(tx, companyId, sale.id)) === 'LEGACY'
      )
        this.duplicate(mode);
      throw new PhysicalInventoryError('SALE_PHYSICAL_STATE_INCONSISTENT');
    }
    await this.legacy.assertNoMembership(tx, companyId, sale.id);
    assertSalesPhysicalEvidence(companyId, sale, effect);
    if (effect.actorId !== actorId) this.duplicate(mode);
    return sale;
  }

  private async convert(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string,
    quoteId: string,
  ) {
    const folio = await this.folios.allocateNextAvailableFolio(tx, companyId);
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Quote" WHERE id=${quoteId} AND "companyId"=${companyId} FOR UPDATE`,
    );
    const quote = await tx.quote.findFirst({
      where: { id: quoteId, companyId },
      include: { items: true, sale: true },
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    // Roll back the allocated folio before doing fresh replay classification.
    if (quote.convertedToSale || quote.sale) throw new ConversionRace();
    if (quote.status !== 'CONFIRMED')
      throw new BadRequestException(
        'La cotización debe estar aprobada antes de convertirse en venta',
      );
    validateSalesItems(quote.items);
    const claim = await tx.quote.updateMany({
      where: {
        id: quoteId,
        companyId,
        status: 'CONFIRMED',
        convertedToSale: false,
      },
      data: { convertedToSale: true },
    });
    requirePhysical(claim.count === 1, 'SALE_PHYSICAL_STATE_INCONSISTENT');
    const sale = await tx.sale.create({
      data: {
        companyId,
        customerId: quote.customerId,
        quoteId,
        folio,
        status: 'CONFIRMED',
        subtotal: quote.subtotal,
        iva: quote.iva,
        total: quote.total,
        items: {
          create: quote.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            subtotal: i.subtotal,
          })),
        },
      },
      include: saleInclude,
    });
    return this.fulfill(tx, companyId, actorId, sale);
  }

  private async fulfill(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string,
    sale: Sale,
  ) {
    const { plan, products } = await this.resolver.planConfirmedSaleSources(
      tx,
      companyId,
      sale.items,
    );
    const result = await this.physical.consumeConfirmedSale(tx, {
      companyId,
      actorId,
      saleId: sale.id,
      sources: plan.flatMap((item) =>
        item.sources.map((source) => ({
          sourceId: source.positionId,
          quantity: source.quantity,
          expectedSourceRevision: source.expectedRevision,
        })),
      ),
    });
    requirePhysical(!result.replay, 'SALE_PHYSICAL_STATE_INCONSISTENT');
    await this.projections.apply(tx, companyId, result);
    await this.history.writeSale(
      tx,
      result,
      sale.items.map((i) => ({
        ...i,
        unitCost: products.find((p) => p.id === i.productId)!.cost,
      })),
      sale.quote
        ? `Venta ${sale.folio} generada desde cotización ${sale.quote.folio}`
        : `Venta aprobada ${sale.folio}`,
    );
    return this.getSale(tx, companyId, sale.id);
  }
}
