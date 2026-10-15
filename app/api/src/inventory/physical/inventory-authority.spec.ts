import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryAuthorityTransactionService } from './inventory-authority-transaction.service';
import {
  InventoryRuntimeCompatibilityService,
  INVENTORY_AUTHORITY_PROTOCOL,
} from './inventory-runtime-compatibility.service';
import { inventoryAuthorityKey } from './inventory-authority-fence';
import { InventoryService } from '../inventory.service';
import { ManualPhysicalInventoryService } from './manual-physical-inventory.service';
import { PurchaseReceiptsService } from '../../purchases-receipts/purchases-receipts.service';
import { ReceiptPhysicalIntegrationService } from './receipt-physical-integration.service';
import { EquipmentProvisioningService } from '../../equipment/equipment-provisioning.service';
import { SalesPhysicalIntegrationService } from './sales-physical-integration.service';
import { SalesFolioService } from '../../sales/sales-folio.service';
import { SalesPhysicalSourceResolver } from './sales-physical-source-resolver';
import { PhysicalInventoryService } from './physical-inventory.service';
import { InventoryCompatibilityProjectionService } from './inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from './inventory-compatibility-history.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePhysicalMovementDto } from '../dto/create-physical-movement.dto';

describe('01D-C authority protocol', () => {
  const companyId = randomUUID(),
    actorId = randomUUID(),
    productId = randomUUID();
  function setup(
    authority: 'LEGACY' | 'PHYSICAL' | 'CUTOVER',
    recovery = false,
  ) {
    const calls: string[] = [];
    const tx = {
      $queryRaw: jest.fn(() => {
        calls.push('fence');
        return Promise.resolve([]);
      }),
      inventoryCutover: {
        findUnique: jest.fn().mockResolvedValue({
          status: recovery ? 'RECOVERY_REQUIRED' : 'VERIFIED',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const resolver = {
      resolve: jest.fn(() => {
        calls.push('resolve');
        return Promise.resolve(authority);
      }),
    };
    const runtime = {
      identity: jest.fn(() => {
        calls.push('runtime');
      }),
    };
    const runner = new InventoryAuthorityTransactionService(
      prisma as unknown as PrismaService,
      resolver,
      runtime as unknown as InventoryRuntimeCompatibilityService,
    );
    return { calls, tx, prisma, resolver, runtime, runner };
  }
  it('uses stable tenant keys, including case normalization', () => {
    expect(inventoryAuthorityKey(companyId)).toBe(
      inventoryAuthorityKey(companyId.toUpperCase()),
    );
    expect(() => inventoryAuthorityKey('all')).toThrow();
  });
  it.each(['LEGACY', 'PHYSICAL'] as const)(
    'fence precedes runtime and resolver for %s',
    async (authority) => {
      const f = setup(authority);
      await f.runner.run(companyId, (_tx, selected) => {
        f.calls.push(selected);
        return Promise.resolve();
      });
      expect(f.calls).toEqual(['fence', 'runtime', 'resolve', authority]);
      expect(f.prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function) as unknown,
        {
          isolationLevel: 'ReadCommitted',
          maxWait: 5000,
          timeout: 15000,
        },
      );
      expect((f.tx.$queryRaw.mock.calls[0] as unknown[])[0]).toEqual(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining('pg_advisory_xact_lock_shared'),
          ]) as unknown,
        }),
      );
    },
  );
  it.each([false, true])(
    'CUTOVER/recovery invokes no branch (%s)',
    async (recovery) => {
      const f = setup('CUTOVER', recovery),
        branch = jest.fn();
      await expect(f.runner.run(companyId, branch)).rejects.toMatchObject({
        code: recovery ? 'RECOVERY_REQUIRED' : 'CUTOVER_FROZEN',
      });
      expect(branch).not.toHaveBeenCalled();
    },
  );
  it('aborted retry reacquires fence and observes changed authority', async () => {
    const f = setup('LEGACY');
    f.resolver.resolve
      .mockResolvedValueOnce('LEGACY')
      .mockResolvedValueOnce('PHYSICAL');
    const branch = jest
      .fn<Promise<string>, [Prisma.TransactionClient, string]>()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('abort', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      )
      .mockResolvedValue('ok');
    await expect(f.runner.run(companyId, branch)).resolves.toBe('ok');
    expect(branch.mock.calls.map((c) => c[1])).toEqual(['LEGACY', 'PHYSICAL']);
    expect(f.calls).toEqual(['fence', 'runtime', 'fence', 'runtime']);
    expect(f.resolver.resolve).toHaveBeenCalledTimes(2);
  });
  it.each(['manual', 'receipt', 'approve', 'quote'] as const)(
    '%s rejects CUTOVER without invoking a physical/legacy mutation',
    async (writer) => {
      const f = setup('CUTOVER'),
        execute = jest.fn();
      const inventory = new InventoryService(
        f.prisma as unknown as PrismaService,
        f.runner,
        { execute } as unknown as ManualPhysicalInventoryService,
      );
      const receipt = new PurchaseReceiptsService(
        f.prisma as unknown as PrismaService,
        {} as EquipmentProvisioningService,
        f.runner,
        { execute } as unknown as ReceiptPhysicalIntegrationService,
      );
      const sales = new SalesPhysicalIntegrationService(
        f.prisma as unknown as PrismaService,
        {} as SalesFolioService,
        {} as SalesPhysicalSourceResolver,
        {} as PhysicalInventoryService,
        {} as InventoryCompatibilityProjectionService,
        {} as InventoryCompatibilityHistoryService,
        f.runner,
      );
      const action =
        writer === 'manual'
          ? inventory.createMovement(companyId, {
              productId,
              movementType: 'IN',
              quantity: 1,
            })
          : writer === 'receipt'
            ? receipt.create(companyId, actorId, 'key', {
                purchaseId: randomUUID(),
                items: [],
              })
            : writer === 'approve'
              ? sales.approve(companyId, actorId, randomUUID(), execute)
              : sales.createFromQuote(
                  companyId,
                  actorId,
                  randomUUID(),
                  execute,
                );
      await expect(action).rejects.toMatchObject({ code: 'CUTOVER_FROZEN' });
      expect(execute).not.toHaveBeenCalled();
    },
  );
  it('PHYSICAL rejects legacy manual payload without a physical call', async () => {
    const f = setup('PHYSICAL'),
      execute = jest.fn();
    const inventory = new InventoryService(
      f.prisma as unknown as PrismaService,
      f.runner,
      { execute } as unknown as ManualPhysicalInventoryService,
    );
    await expect(
      inventory.createMovement(companyId, {
        productId,
        movementType: 'ADJUSTMENT',
        quantity: 3,
      }),
    ).rejects.toMatchObject({ code: 'PHYSICAL_AUTHORITY_REQUIRED' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('LEGACY rejects explicit physical manual and hides Positions', async () => {
    const f = setup('LEGACY'),
      execute = jest.fn();
    const inventory = new InventoryService(
      f.prisma as unknown as PrismaService,
      f.runner,
      { execute } as unknown as ManualPhysicalInventoryService,
    );
    await expect(
      inventory.createPhysicalMovement({
        companyId,
        actorId,
        key: 'k',
        operation: { kind: 'IN', productId, batchId: null, quantity: 1 },
      }),
    ).rejects.toMatchObject({ code: 'LEGACY_AUTHORITY_REQUIRED' });
    await expect(
      inventory.findPhysicalPositions(companyId, productId),
    ).rejects.toMatchObject({ code: 'LEGACY_AUTHORITY_REQUIRED' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('validates explicit source revision and count reason', async () => {
    const dto = plainToInstance(CreatePhysicalMovementDto, {
      kind: 'OUT',
      sources: [{ positionId: randomUUID(), quantity: 1 }],
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
    expect(() =>
      CreatePhysicalMovementDto.operation(
        plainToInstance(CreatePhysicalMovementDto, {
          kind: 'COUNT_CORRECTION',
          positionId: randomUUID(),
          countedQuantity: 0,
          expectedRevision: 1,
        }),
      ),
    ).toThrow('requiere motivo');
  });
  it('refuses unavailable/mismatched runtime configuration', () => {
    const prior = { ...process.env };
    try {
      delete process.env.INVENTORY_RUNTIME_BUILD;
      const runtime = new InventoryRuntimeCompatibilityService();
      expect(() => runtime.identity()).toThrow('INCOMPATIBLE_BUILD');
      process.env.INVENTORY_RUNTIME_BUILD = 'fixture';
      process.env.INVENTORY_RUNTIME_ENVIRONMENT = 'isolated';
      process.env.INVENTORY_AUTHORITY_PROTOCOL = 'old';
      expect(() => runtime.identity()).toThrow('STALE_RUNTIME');
      process.env.INVENTORY_AUTHORITY_PROTOCOL = INVENTORY_AUTHORITY_PROTOCOL;
      expect(runtime.identity()).toEqual({
        build: 'fixture',
        environment: 'isolated',
        protocol: INVENTORY_AUTHORITY_PROTOCOL,
      });
    } finally {
      process.env = prior;
    }
  });
});
