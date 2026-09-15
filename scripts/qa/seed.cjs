// Explicit opt-in utility, outside application code/startup. Never deletes data.
const { createRequire } = require('node:module');
const { writeFileSync } = require('node:fs');
const { assertQaEnvironment, assertQaDatabase, id } = require('./guard.cjs');
const appRequire = createRequire('/app/package.json');
const { PrismaClient } = appRequire('@prisma/client');
const bcrypt = appRequire('bcrypt');

async function ensureRequirementsAcceptanceFixtures(tx, tenant) {
  const companyId = id(tenant);
  const createdById = id(`${tenant}-ADMIN`);
  const productFixtures = tenant === 'A'
    ? [
        ['requirement-primary', 'QA-A-RQ-PRIMARY', 'QA A Requirement Primary'],
        ['requirement-backup', 'QA-A-RQ-BACKUP', 'QA A Requirement Backup'],
        ['requirement-historical', 'QA-A-RQ-HISTORICAL', 'QA A Requirement Historical'],
        ['requirement-admin', 'QA-A-RQ-ADMIN', 'QA A Requirement ADMIN'],
        ['requirement-manager', 'QA-A-RQ-MANAGER', 'QA A Requirement MANAGER'],
        ['requirement-sales', 'QA-A-RQ-SALES', 'QA A Requirement SALES'],
        ['requirement-warehouse', 'QA-A-RQ-WAREHOUSE', 'QA A Requirement WAREHOUSE'],
      ]
    : [['requirement-primary', 'QA-B-RQ-PRIMARY', 'QA B Requirement Primary']];
  let historicalProductWasCreated = false;
  for (const [key, sku, name] of productFixtures) {
    const existing = await tx.product.findUnique({ where: { companyId_sku: { companyId, sku } }, select: { id: true } });
    if (existing) continue;
    await tx.product.create({ data: { id: id(`${tenant}-${key}`), companyId, sku, name, categoryId: id(`${tenant}-category`), cost: 15, price: 30, stock: 10, minStock: 2, inventoryTracking: 'QUANTITY', lotTracking: 'NONE' } });
    if (key === 'requirement-historical') historicalProductWasCreated = true;
  }

  const caseFixtures = tenant === 'A'
    ? [
        { key: 'requirement-case-draft', folio: 'QA-A-HC-RQ-DRAFT', title: 'QA Requirements Draft Case', status: 'DRAFT' },
        { key: 'requirement-case-scheduled', folio: 'QA-A-HC-RQ-SCHEDULED', title: 'QA Requirements Scheduled Case', status: 'SCHEDULED', scheduledStart: new Date('2026-09-15T16:00:00.000Z'), scheduledEnd: new Date('2026-09-15T18:00:00.000Z') },
        { key: 'requirement-case-cancelled', folio: 'QA-A-HC-RQ-CANCELLED', title: 'QA Requirements Cancelled Case', status: 'CANCELLED', cancelledAt: new Date('2026-09-14T12:00:00.000Z'), cancelledById: createdById, cancellationReason: 'Synthetic local QA cancelled case' },
      ]
    : [{ key: 'requirement-case-draft', folio: 'QA-B-HC-RQ-DRAFT', title: 'QA B Requirements Tenant Isolation Case', status: 'DRAFT' }];
  for (const fixture of caseFixtures) {
    const existing = await tx.healthcareCase.findUnique({ where: { companyId_folio: { companyId, folio: fixture.folio } }, select: { id: true } });
    if (existing) continue;
    const { key, ...data } = fixture;
    await tx.healthcareCase.create({ data: { id: id(`${tenant}-${key}`), companyId, createdById, ...data } });
  }

  const requirementFixtures = tenant === 'A'
    ? [
        ['requirement-draft-active', 'requirement-case-draft', 'requirement-primary', 2, 'REQUIRED', 10, 'ACTIVE'],
        ['requirement-draft-retired', 'requirement-case-draft', 'requirement-backup', 1, 'BACKUP', 20, 'RETIRED'],
        ['requirement-draft-inactive-retired', 'requirement-case-draft', 'requirement-historical', 3, 'REQUIRED', 30, 'RETIRED'],
        ['requirement-scheduled-active', 'requirement-case-scheduled', 'requirement-backup', 4, 'REQUIRED', 10, 'ACTIVE'],
        ['requirement-scheduled-inactive-active', 'requirement-case-scheduled', 'requirement-historical', 1, 'BACKUP', 20, 'ACTIVE'],
        ['requirement-cancelled-active', 'requirement-case-cancelled', 'requirement-primary', 2, 'REQUIRED', 10, 'ACTIVE'],
        ['requirement-cancelled-retired', 'requirement-case-cancelled', 'requirement-backup', 1, 'BACKUP', 20, 'RETIRED'],
      ]
    : [['requirement-draft-active', 'requirement-case-draft', 'requirement-primary', 1, 'REQUIRED', 10, 'ACTIVE']];
  for (const [key, caseKey, productKey, requestedQty, type, sortOrder, lifecycle] of requirementFixtures) {
    const caseId = id(`${tenant}-${caseKey}`);
    const productId = id(`${tenant}-${productKey}`);
    const existing = await tx.healthcareCaseRequirement.findUnique({ where: { companyId_caseId_productId: { companyId, caseId, productId } }, select: { id: true } });
    if (existing) continue;
    await tx.healthcareCaseRequirement.create({ data: { id: id(`${tenant}-${key}`), companyId, caseId, productId, requestedQty, type, notes: `Synthetic local QA ${lifecycle.toLowerCase()} requirement`, sortOrder, lifecycle, createdById, ...(lifecycle === 'RETIRED' ? { retiredAt: new Date('2026-09-14T12:30:00.000Z'), retiredById: createdById, retirementReason: 'Synthetic local QA retired requirement' } : {}) } });
  }

  // Establish a real historical reference before deactivating the dedicated Product.
  if (historicalProductWasCreated) {
    await tx.product.update({ where: { id: id(`${tenant}-requirement-historical`) }, data: { isActive: false } });
  }
}

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
      for (const tenant of ['A', 'B']) await ensureRequirementsAcceptanceFixtures(tx, tenant);
    }, { timeout: 30000 });
    const manifest = {};
    for (const tenant of ['A', 'B']) {
      const companyId = id(tenant);
      const users = await db.user.findMany({ where: { companyId }, select: { id: true, email: true, role: true, isActive: true } });
      const resources = {};
      for (const model of ['category', 'customer', 'supplier', 'product', 'purchase', 'purchaseReceipt', 'quote', 'sale', 'equipmentAsset', 'inventoryMovement', 'healthcareCase', 'healthcareCaseRequirement']) {
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
      const requirements = await db.healthcareCaseRequirement.findMany({ where: { companyId }, include: { healthcareCase: true, product: true, createdBy: true, retiredBy: true, reactivatedBy: true } });
      const relations = [...products.map((p) => p.category), ...purchases.map((p) => p.supplier), ...sales.map((s) => s.customer), ...quotes.map((q) => q.customer), ...[...purchases, ...sales, ...quotes].flatMap((d) => d.items.map((i) => i.product)), ...receipts.flatMap((r) => [r.purchase, r.receivedByUser, ...r.items.flatMap((i) => [i, i.product, i.purchaseItem.purchase])]), ...equipment.map((e) => e.product), ...movements.map((m) => m.product), ...requirements.flatMap((r) => [r.healthcareCase, r.product, r.createdBy, r.retiredBy, r.reactivatedBy]).filter(Boolean)];
      if (relations.some((r) => !r || r.companyId !== companyId)) throw new Error('QA verification failed: tenant relation');
      manifest[tenant] = { companyId, users, resources };
      console.log(`Company ${tenant}: roles ${users.map((u) => u.role).join(', ')}; resources and tenant relations verified`);
    }
    writeFileSync('/qa-private/fixtures.json', JSON.stringify(manifest, null, 2), { mode: 0o600 });
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('QA seed/verification failed (details suppressed to protect credentials).'); process.exitCode = 1; });
