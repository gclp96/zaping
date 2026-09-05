import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';
import { CreateMovementDto } from '../src/inventory/dto/create-movement.dto';
import { InventoryService } from '../src/inventory/inventory.service';

type Fixture = {
  companyId: string;
  productId: string;
};

const runDbConcurrencyTests = process.env.RUN_DB_CONCURRENCY_TESTS === '1';

(runDbConcurrencyTests ? describe : describe.skip)(
  'InventoryService PostgreSQL concurrency',
  () => {
    const prisma = new PrismaService();
    const service = new InventoryService(prisma);

    beforeAll(async () => {
      await prisma.$connect();
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    async function createFixture(initialStock: number): Promise<Fixture> {
      const companyId = randomUUID();
      const productId = randomUUID();

      await prisma.company.create({
        data: {
          id: companyId,
          name: `RC-DATA-01 ${companyId}`,
          rfc: `RCD${companyId.replaceAll('-', '').slice(0, 10)}`,
        },
      });

      await prisma.product.create({
        data: {
          id: productId,
          companyId,
          sku: `RC-DATA-01-${productId}`,
          name: `RC-DATA-01 ${productId}`,
          stock: initialStock,
        },
      });

      return { companyId, productId };
    }

    async function deleteFixture(fixture: Fixture): Promise<void> {
      await prisma.inventoryMovement.deleteMany({
        where: {
          companyId: fixture.companyId,
          productId: fixture.productId,
        },
      });
      await prisma.product.delete({
        where: {
          id_companyId: {
            id: fixture.productId,
            companyId: fixture.companyId,
          },
        },
      });
      await prisma.company.delete({
        where: {
          id: fixture.companyId,
        },
      });
    }

    async function withFixture<T>(
      initialStock: number,
      callback: (fixture: Fixture) => Promise<T>,
    ): Promise<T> {
      const fixture = await createFixture(initialStock);

      try {
        return await callback(fixture);
      } finally {
        await deleteFixture(fixture);
      }
    }

    function movement(
      fixture: Fixture,
      movementType: InventoryMovementType,
      quantity: number,
    ): CreateMovementDto {
      return {
        productId: fixture.productId,
        movementType,
        quantity,
      };
    }

    async function readProduct(fixture: Fixture) {
      return prisma.product.findUnique({
        where: {
          id_companyId: {
            id: fixture.productId,
            companyId: fixture.companyId,
          },
        },
      });
    }

    async function readMovements(fixture: Fixture) {
      return prisma.inventoryMovement.findMany({
        where: {
          companyId: fixture.companyId,
          productId: fixture.productId,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
    }

    it('serializa cinco repeticiones de IN concurrente y conserva stock y ledger', async () => {
      for (let iteration = 1; iteration <= 5; iteration += 1) {
        await withFixture(10, async (fixture) => {
          const results = await Promise.all([
            service.createMovement(
              fixture.companyId,
              movement(fixture, InventoryMovementType.IN, 1),
            ),
            service.createMovement(
              fixture.companyId,
              movement(fixture, InventoryMovementType.IN, 1),
            ),
          ]);

          const product = await readProduct(fixture);
          const movements = await readMovements(fixture);

          expect(results).toHaveLength(2);
          expect(product?.stock).toBe(12);
          expect(movements).toHaveLength(2);
          expect(movements.map(({ balance }) => balance).sort()).toEqual([
            11, 12,
          ]);
        });
      }
    }, 30000);

    it('serializa cinco repeticiones de OUT concurrente sin oversell', async () => {
      for (let iteration = 1; iteration <= 5; iteration += 1) {
        await withFixture(1, async (fixture) => {
          const results = await Promise.allSettled([
            service.createMovement(
              fixture.companyId,
              movement(fixture, InventoryMovementType.OUT, 1),
            ),
            service.createMovement(
              fixture.companyId,
              movement(fixture, InventoryMovementType.OUT, 1),
            ),
          ]);

          const product = await readProduct(fixture);
          const movements = await readMovements(fixture);
          const fulfilled = results.filter(
            ({ status }) => status === 'fulfilled',
          );
          const rejected = results.filter(
            ({ status }) => status === 'rejected',
          );

          expect(fulfilled).toHaveLength(1);
          expect(rejected).toHaveLength(1);
          expect(
            rejected[0]?.status === 'rejected' ? rejected[0].reason : undefined,
          ).toBeInstanceOf(BadRequestException);
          expect(product?.stock).toBe(0);
          expect(movements).toHaveLength(1);
          expect(movements[0]).toMatchObject({
            movementType: InventoryMovementType.OUT,
            quantity: 1,
            balance: 0,
          });
        });
      }
    }, 30000);

    it('serializa cinco repeticiones mixtas y obtiene el resultado del orden válido', async () => {
      for (let iteration = 1; iteration <= 5; iteration += 1) {
        await withFixture(10, async (fixture) => {
          const results = await Promise.all([
            service.createMovement(
              fixture.companyId,
              movement(fixture, InventoryMovementType.IN, 2),
            ),
            service.createMovement(
              fixture.companyId,
              movement(fixture, InventoryMovementType.OUT, 3),
            ),
          ]);

          const product = await readProduct(fixture);
          const movements = await readMovements(fixture);

          expect(results).toHaveLength(2);
          expect(product?.stock).toBe(9);
          expect(movements).toHaveLength(2);
          expect(
            movements.map(({ movementType }) => movementType).sort(),
          ).toEqual([InventoryMovementType.IN, InventoryMovementType.OUT]);
          expect(movements.map(({ balance }) => balance)).toContain(9);
        });
      }
    }, 30000);

    it('serializa cinco repeticiones de ADJUSTMENT sin lost update', async () => {
      for (let iteration = 1; iteration <= 5; iteration += 1) {
        await withFixture(10, async (fixture) => {
          const results = await Promise.all([
            service.createMovement(
              fixture.companyId,
              movement(fixture, InventoryMovementType.ADJUSTMENT, 7),
            ),
            service.createMovement(
              fixture.companyId,
              movement(fixture, InventoryMovementType.ADJUSTMENT, 4),
            ),
          ]);

          const product = await readProduct(fixture);
          const movements = await readMovements(fixture);

          expect(results).toHaveLength(2);
          expect([4, 7]).toContain(product?.stock);
          expect(movements).toHaveLength(2);
          expect(movements.map(({ quantity }) => quantity).sort()).toEqual([
            4, 7,
          ]);
          expect(movements.map(({ balance }) => balance).sort()).toEqual([
            4, 7,
          ]);
        });
      }
    }, 30000);

    it('revierte movement y stock juntos cuando falla antes del commit', async () => {
      await withFixture(10, async (fixture) => {
        await expect(
          prisma.$transaction(async (tx) => {
            await tx.inventoryMovement.create({
              data: {
                companyId: fixture.companyId,
                productId: fixture.productId,
                movementType: InventoryMovementType.IN,
                quantity: 1,
                balance: 11,
              },
            });
            await tx.product.update({
              where: {
                id_companyId: {
                  id: fixture.productId,
                  companyId: fixture.companyId,
                },
              },
              data: {
                stock: 11,
              },
            });
            throw new Error('forced rollback');
          }),
        ).rejects.toThrow('forced rollback');

        const product = await readProduct(fixture);
        const movements = await readMovements(fixture);

        expect(product?.stock).toBe(10);
        expect(movements).toHaveLength(0);
      });
    }, 30000);
  },
);
