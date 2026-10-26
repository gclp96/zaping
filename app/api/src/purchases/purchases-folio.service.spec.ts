import { Prisma } from '@prisma/client';
import { PurchasesFolioService } from './purchases-folio.service';

describe('PurchasesFolioService', () => {
  const allocateNext = jest.fn();
  const tx = {
    $queryRaw: jest.fn<Promise<Array<{ year: number }>>, [Prisma.Sql]>(),
    purchase: { findFirst: jest.fn() },
  };
  const service = new PurchasesFolioService({ allocateNext });

  beforeEach(() => {
    jest.resetAllMocks();
    tx.$queryRaw.mockResolvedValue([{ year: 2026 }]);
    tx.purchase.findFirst.mockResolvedValue(null);
    allocateNext.mockResolvedValue(1);
  });

  it.each([
    [1, '00001'],
    [25, '00025'],
    [99999, '99999'],
  ])('formats %s with exactly five digits', async (value, suffix) => {
    allocateNext.mockResolvedValue(value);
    await expect(
      service.allocateNextAvailableFolio(tx as never, 'company-a'),
    ).resolves.toBe(`OC-26-${suffix}`);
  });

  it('uses one database clock reading, persisted timezone and a tenant parameter', async () => {
    await service.allocateNextAvailableFolio(tx as never, 'company-a');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const query = tx.$queryRaw.mock.calls[0][0];
    expect(query.sql.match(/clock_timestamp\(\)/g)).toHaveLength(1);
    expect(query.sql).toContain('AT TIME ZONE c.timezone');
    expect(query.values).toEqual(['company-a']);
    expect(allocateNext).toHaveBeenCalledWith(
      tx,
      'company-a',
      'PURCHASE_FOLIO:2026',
    );
  });

  it('reserves occupied folios regardless of status and keeps the captured year', async () => {
    tx.purchase.findFirst
      .mockResolvedValueOnce({ id: 'cancelled' })
      .mockResolvedValueOnce(null);
    allocateNext.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await expect(
      service.allocateNextAvailableFolio(tx as never, 'company-a'),
    ).resolves.toBe('OC-26-00002');
    expect(tx.purchase.findFirst).toHaveBeenNthCalledWith(1, {
      where: { companyId: 'company-a', folio: 'OC-26-00001' },
      select: { id: true },
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('separates companies and full calendar years', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ year: 2026 }])
      .mockResolvedValueOnce([{ year: 2027 }]);
    await expect(
      service.allocateNextAvailableFolio(tx as never, 'company-a'),
    ).resolves.toBe('OC-26-00001');
    await expect(
      service.allocateNextAvailableFolio(tx as never, 'company-b'),
    ).resolves.toBe('OC-27-00001');
    expect(allocateNext).toHaveBeenLastCalledWith(
      tx,
      'company-b',
      'PURCHASE_FOLIO:2027',
    );
  });

  it('rejects exhaustion before purchase lookup', async () => {
    allocateNext.mockResolvedValue(100000);
    await expect(
      service.allocateNextAvailableFolio(tx as never, 'company-a'),
    ).rejects.toMatchObject({
      response: { code: 'PURCHASE_FOLIO_EXHAUSTED' },
    });
    expect(tx.purchase.findFirst).not.toHaveBeenCalled();
  });

  it('does not allocate for a missing Company', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      service.allocateNextAvailableFolio(tx as never, 'missing'),
    ).rejects.toThrow('Empresa no encontrada');
    expect(allocateNext).not.toHaveBeenCalled();
  });

  it.each(['P2002', 'P2034', 'P2028'])(
    'propagates %s without claiming success or retrying',
    async (code) => {
      const error = Object.assign(new Error('database failure'), { code });
      tx.purchase.findFirst.mockRejectedValue(error);
      await expect(
        service.allocateNextAvailableFolio(tx as never, 'company-a'),
      ).rejects.toBe(error);
      expect(allocateNext).toHaveBeenCalledTimes(1);
    },
  );
});
