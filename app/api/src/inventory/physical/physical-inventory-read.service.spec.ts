import { Prisma } from '@prisma/client';
import { PhysicalInventoryReadService } from './physical-inventory-read.service';

describe('PhysicalInventoryReadService calendar availability', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const batchId = '33333333-3333-4333-8333-333333333333';
  const service = new PhysicalInventoryReadService();
  const aggregate = {
    owned: 23n,
    available: 8n,
    inCustody: 7n,
    count: 6n,
    batchId: null,
    batchProductId: null,
  };
  function arrange(rows: object[] = [aggregate]) {
    const query = jest
      .fn<Promise<object[]>, [Prisma.Sql]>()
      .mockResolvedValue(rows);
    const tx = { $queryRaw: query } as unknown as Prisma.TransactionClient;
    return { query, tx };
  }
  it('keeps one statement for physical totals, Company configuration and inclusive calendar eligibility', async () => {
    const { tx, query } = arrange();
    await expect(service.product(tx, companyId, productId)).resolves.toEqual({
      authority: 'PHYSICAL_POSITIONS',
      owned: 23,
      available: 8,
      inCustody: 7,
      hasPositions: true,
    });
    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0][0];
    expect(sql.text).toContain('JOIN "Company" c ON c.id=p."companyId"');
    expect(sql.text).toContain(
      'pos."expirationDate">=(statement_timestamp() AT TIME ZONE c.timezone)::date',
    );
    expect(sql.text).toContain(
      'b."expirationDate"::date>=(statement_timestamp() AT TIME ZONE c.timezone)::date',
    );
    expect(sql.text).toContain('pos."expirationDate" IS NULL');
    expect(sql.text).toContain('b."expirationDate" IS NULL');
    expect(sql.text).toContain('SUM(pos.quantity)');
    expect(sql.text).toContain(
      "CASE WHEN pos.state='CUSTODY' THEN pos.quantity ELSE 0 END",
    );
    expect(sql.text).not.toMatch(
      /CURRENT_DATE|CURRENT_TIMESTAMP|transaction_timestamp|\bnow\(|clock_timestamp|p\.stock/i,
    );
    expect(sql.values).toEqual([null, productId, companyId]);
  });
  it('retains exact product/batch/tenant predicates within the same statement', async () => {
    const { tx, query } = arrange([
      { ...aggregate, batchId, batchProductId: productId },
    ]);
    await service.batch(tx, companyId, productId, batchId);
    const sql = query.mock.calls[0][0];
    expect(sql.text).toContain('AND pos."inventoryBatchId"=');
    expect(sql.text).toContain('requested."companyId"=p."companyId"');
    expect(sql.text).toContain(
      'b."companyId"=pos."companyId" AND b."productId"=pos."productId"',
    );
    expect(sql.values).toEqual([batchId, batchId, productId, companyId]);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('returns explicit zeroes for a product with no positions', async () => {
    const { tx } = arrange([
      { ...aggregate, owned: 0n, available: 0n, inCustody: 0n, count: 0n },
    ]);
    await expect(service.product(tx, companyId, productId)).resolves.toEqual({
      authority: 'PHYSICAL_POSITIONS',
      owned: 0,
      available: 0,
      inCustody: 0,
      hasPositions: false,
    });
  });
  it.each([
    [[], 'PRODUCT_NOT_FOUND'],
    [[aggregate], 'INVENTORY_BATCH_NOT_FOUND'],
    [
      [{ ...aggregate, batchId, batchProductId: companyId }],
      'INVENTORY_BATCH_PRODUCT_MISMATCH',
    ],
    [[{ ...aggregate, owned: 2147483648n }], 'PHYSICAL_QUANTITY_LIMIT'],
    [[{ ...aggregate, available: -1n }], 'PHYSICAL_QUANTITY_LIMIT'],
  ] as const)(
    'preserves failure classification: %s -> %s',
    async (rows, code) => {
      const { tx } = arrange([...rows]);
      await expect(
        rows.length && code === 'PHYSICAL_QUANTITY_LIMIT'
          ? service.product(tx, companyId, productId)
          : service.batch(tx, companyId, productId, batchId),
      ).rejects.toMatchObject({ code });
    },
  );
  it('rejects invalid identity before SQL and never turns a database/configuration failure into zero stock', async () => {
    const { tx, query } = arrange();
    await expect(
      service.product(tx, 'invalid', productId),
    ).rejects.toMatchObject({ code: 'INVALID_PHYSICAL_REQUEST' });
    expect(query).not.toHaveBeenCalled();
    query.mockRejectedValue(new Error('invalid Company timezone'));
    await expect(
      service.product(tx, companyId, productId),
    ).rejects.toMatchObject({ code: 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR' });
  });
});
