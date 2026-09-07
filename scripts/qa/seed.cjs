// Explicit opt-in utility, outside application code/startup. Never deletes data.
const { createRequire } = require('node:module');
const { writeFileSync } = require('node:fs');
const { assertQaEnvironment, assertQaDatabase, id } = require('./guard.cjs');
const appRequire = createRequire('/app/package.json');
const { PrismaClient } = appRequire('@prisma/client');
const bcrypt = appRequire('bcrypt');

async function main() {
  assertQaEnvironment(process.env);
  const db = new PrismaClient();
  try {
    await assertQaDatabase(db);
    const passwordHash = await bcrypt.hash(process.env.QA_PASSWORD, 10);
    await db.$transaction(async (tx) => {
      // Prevent mixing fixtures with a developer database, even if it was renamed.
      const companies = await tx.company.findMany({ select: { id: true, name: true } });
      if (companies.some((c) => !['A', 'B'].some((t) => c.id === id(t) && c.name === `Zaping QA Company ${t}`))) {
        throw new Error('ABORT: database contains non-fixture companies');
      }
      for (const tenant of ['A', 'B']) {
        const companyId = id(tenant);
        // One atomic transaction initializes both tenants. Re-run preserves QA work.
        if (companies.some((c) => c.id === companyId)) continue;
        await tx.company.create({ data: { id: companyId, name: `Zaping QA Company ${tenant}`, rfc: `QA-LOCAL-${tenant}` } });
        const roles = tenant === 'A' ? ['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE'] : ['ADMIN'];
        for (const role of roles) {
          await tx.user.create({ data: { id: id(`${tenant}-${role}`), companyId, firstName: 'QA', lastName: `${tenant} ${role}`, email: `${role.toLowerCase()}.${tenant.toLowerCase()}@qa.example.test`, passwordHash, role, isActive: true } });
        }
        await tx.category.create({ data: { id: id(`${tenant}-category`), companyId, name: `QA-${tenant}-Category` } });
        await tx.customer.create({ data: { id: id(`${tenant}-customer`), companyId, name: `QA-${tenant}-Customer` } });
        await tx.supplier.create({ data: { id: id(`${tenant}-supplier`), companyId, name: `QA-${tenant}-Supplier` } });
        for (const [kind, stock, minStock, inventoryTracking] of [['normal', 25, 5, 'QUANTITY'], ['low', 1, 5, 'QUANTITY'], ['asset', 2, 0, 'ASSET']]) {
          const productId = id(`${tenant}-${kind}`);
          await tx.product.create({ data: { id: productId, companyId, sku: `QA-${tenant}-${kind}`, name: `QA ${tenant} ${kind}`, categoryId: id(`${tenant}-category`), cost: 10, price: 20, stock, minStock, inventoryTracking, lotTracking: 'NONE' } });
          const initial = kind === 'normal' ? 20 : stock;
          await tx.inventoryMovement.create({ data: { id: id(`${tenant}-${kind}-opening`), companyId, productId, movementType: 'IN', quantity: initial, balance: initial, unitCost: 10, referenceType: 'QA_OPENING', referenceId: productId, notes: 'Synthetic local QA opening stock' } });
        }
        for (const status of ['DRAFT', 'PARTIALLY_RECEIVED']) {
          const purchaseId = id(`${tenant}-purchase-${status}`);
          await tx.purchase.create({ data: { id: purchaseId, companyId, supplierId: id(`${tenant}-supplier`), folio: `QA-${tenant}-PO-${status}`, subtotal: 200, iva: 32, total: 232, status,
            items: { create: { id: id(`${tenant}-purchase-item-${status}`), productId: id(`${tenant}-normal`), quantity: 20, price: 10, subtotal: 200 } } } });
        }
        const receiptId = id(`${tenant}-receipt`);
        await tx.purchaseReceipt.create({ data: { id: receiptId, companyId, purchaseId: id(`${tenant}-purchase-PARTIALLY_RECEIVED`), folio: `QA-${tenant}-REC-001`, receivedBy: id(`${tenant}-ADMIN`),
          items: { create: { id: id(`${tenant}-receipt-item`), companyId, purchaseItemId: id(`${tenant}-purchase-item-PARTIALLY_RECEIVED`), productId: id(`${tenant}-normal`), quantityReceived: 5, unitCost: 10 } } } });
        await tx.inventoryMovement.create({ data: { id: id(`${tenant}-receipt-movement`), companyId, productId: id(`${tenant}-normal`), movementType: 'IN', quantity: 5, balance: 25, unitCost: 10, referenceType: 'PURCHASE_RECEIPT', referenceId: receiptId } });
        for (const status of ['DRAFT', 'CONFIRMED']) {
          await tx.quote.create({ data: { id: id(`${tenant}-quote-${status}`), companyId, customerId: id(`${tenant}-customer`), folio: `QA-${tenant}-QUOTE-${status}`, subtotal: 40, iva: 6.4, total: 46.4, status,
            items: { create: { id: id(`${tenant}-quote-item-${status}`), productId: id(`${tenant}-normal`), quantity: 2, price: 20, subtotal: 40 } } } });
        }
        await tx.sale.create({ data: { id: id(`${tenant}-sale`), companyId, customerId: id(`${tenant}-customer`), folio: `QA-${tenant}-SALE-DRAFT`, subtotal: 40, iva: 6.4, total: 46.4,
          items: { create: { id: id(`${tenant}-sale-item`), productId: id(`${tenant}-normal`), quantity: 2, price: 20, subtotal: 40 } } } });
        for (const condition of ['GOOD', 'INSPECTION_PENDING']) {
          await tx.equipmentAsset.create({ data: { id: id(`${tenant}-equipment-${condition}`), companyId, productId: id(`${tenant}-asset`), assetCode: `QA-${tenant}-EQ-${condition}`, condition, origin: 'INITIAL_MIGRATION' } });
        }
      }
    }, { timeout: 30000 });
    const manifest = {};
    for (const tenant of ['A', 'B']) {
      const companyId = id(tenant);
      const users = await db.user.findMany({ where: { companyId }, select: { id: true, email: true, role: true, isActive: true } });
      const resources = {};
      for (const model of ['category', 'customer', 'supplier', 'product', 'purchase', 'purchaseReceipt', 'quote', 'sale', 'equipmentAsset', 'inventoryMovement']) {
        resources[model] = await db[model].findMany({ where: { companyId }, select: { id: true } });
        if (!resources[model].length) throw new Error('QA verification failed: missing resources');
      }
      const expectedRoles = tenant === 'A' ? ['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE'] : ['ADMIN'];
      if (expectedRoles.some((r) => !users.some((u) => u.role === r && u.isActive))) throw new Error('QA verification failed: roles');
      // Validate linked entities, not merely counts.
      const products = await db.product.findMany({ where: { companyId }, include: { category: true } });
      const purchases = await db.purchase.findMany({ where: { companyId }, include: { supplier: true, items: { include: { product: true } } } });
      const sales = await db.sale.findMany({ where: { companyId }, include: { customer: true, items: { include: { product: true } } } });
      const quotes = await db.quote.findMany({ where: { companyId }, include: { customer: true, items: { include: { product: true } } } });
      const receipts = await db.purchaseReceipt.findMany({ where: { companyId }, include: { purchase: true, receivedByUser: true, items: { include: { product: true, purchaseItem: { include: { purchase: true } } } } } });
      const equipment = await db.equipmentAsset.findMany({ where: { companyId }, include: { product: true } });
      const movements = await db.inventoryMovement.findMany({ where: { companyId }, include: { product: true } });
      const relations = [...products.map((p) => p.category), ...purchases.map((p) => p.supplier), ...sales.map((s) => s.customer), ...quotes.map((q) => q.customer), ...[...purchases, ...sales, ...quotes].flatMap((d) => d.items.map((i) => i.product)), ...receipts.flatMap((r) => [r.purchase, r.receivedByUser, ...r.items.flatMap((i) => [i, i.product, i.purchaseItem.purchase])]), ...equipment.map((e) => e.product), ...movements.map((m) => m.product)];
      if (relations.some((r) => !r || r.companyId !== companyId)) throw new Error('QA verification failed: tenant relation');
      manifest[tenant] = { companyId, users, resources };
      console.log(`Company ${tenant}: roles ${users.map((u) => u.role).join(', ')}; resources and tenant relations verified`);
    }
    writeFileSync('/qa-private/fixtures.json', JSON.stringify(manifest, null, 2), { mode: 0o600 });
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('QA seed/verification failed (details suppressed to protect credentials).'); process.exitCode = 1; });
