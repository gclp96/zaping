import { PrismaService } from '../prisma/prisma.service';
import { EquipmentProvisioningService } from '../equipment/equipment-provisioning.service';
import { PurchaseReceiptsService } from './purchases-receipts.service';
import { InventoryAuthorityTransactionService } from '../inventory/physical/inventory-authority-transaction.service';
import { InventoryRuntimeCompatibilityService } from '../inventory/physical/inventory-runtime-compatibility.service';
import { ReceiptPhysicalIntegrationService } from '../inventory/physical/receipt-physical-integration.service';

// Real authority transaction and shared fence; only persistence/runtime are test doubles.
describe('receipt capability uses the existing authority boundary', () => {
  const companyId = '22222222-2222-4222-8222-222222222222';
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
      $transaction: jest.fn((callback: (t: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
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
    const writer = { execute: jest.fn() };
    const service = new PurchaseReceiptsService(
      prisma as unknown as PrismaService,
      {} as EquipmentProvisioningService,
      runner,
      writer as unknown as ReceiptPhysicalIntegrationService,
    );
    return { service, calls, tx, resolver, writer, runtime };
  }
  it.each(['LEGACY', 'PHYSICAL'] as const)(
    'returns only %s from the fenced resolver without business writes',
    async (authority) => {
      const f = setup(authority);
      expect(await f.service.getReceiptCapabilities(companyId)).toEqual({
        authority,
      });
      expect(f.calls).toEqual(['fence', 'runtime', 'resolve']);
      expect(f.resolver.resolve).toHaveBeenCalledWith(f.tx, companyId);
      expect(f.tx.$queryRaw.mock.calls[0]).toEqual([
        expect.objectContaining({
          text: expect.stringContaining(
            'pg_advisory_xact_lock_shared',
          ) as unknown,
        }),
      ]);
      expect(f.writer.execute).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    'rejects CUTOVER/recovery (%s) with no reception capability',
    async (recovery) => {
      const f = setup('CUTOVER', recovery);
      await expect(
        f.service.getReceiptCapabilities(companyId),
      ).rejects.toMatchObject({
        code: recovery ? 'RECOVERY_REQUIRED' : 'CUTOVER_FROZEN',
      });
      expect(f.writer.execute).not.toHaveBeenCalled();
    },
  );
  it('fails closed on runtime incompatibility', async () => {
    const f = setup('PHYSICAL');
    f.runtime.identity.mockImplementation(() => {
      throw new Error('INCOMPATIBLE_BUILD');
    });
    await expect(f.service.getReceiptCapabilities(companyId)).rejects.toThrow(
      'INCOMPATIBLE_BUILD',
    );
    expect(f.resolver.resolve).not.toHaveBeenCalled();
    expect(f.writer.execute).not.toHaveBeenCalled();
  });
});
