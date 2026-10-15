/* Async fixture resolvers implement the adapter Promise contract. */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import {
  canonical,
  eligible,
  manifestHash,
  OpeningCustodyRegistry,
  OpeningManifest,
  OpeningProduct,
  openingHash,
  productFingerprint,
  totals,
  validateManifest,
} from './inventory-opening-manifest';
import { movementBalance } from './inventory-reconciliation.service';
import { OpeningArtifact } from './inventory-opening-artifact';

function manifest(): OpeningManifest {
  const companyId = randomUUID(),
    productId = randomUUID(),
    cutoverId = randomUUID();
  const frozenAsOf = '2026-10-14T00:00:00.000Z';
  const evidence = {
    reference: 'evidence:1',
    contentHash: 'a'.repeat(64),
    evidenceType: 'CERTIFIED_COUNT',
  };
  const p: OpeningProduct = {
    productId,
    inventoryTracking: 'QUANTITY',
    lotTracking: 'NONE',
    isActive: true,
    legacyStock: 10,
    batches: [],
    pools: [
      {
        batchId: null,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
        quantity: 10,
        evidenceRefs: [evidence.reference],
      },
    ],
    expectedOwned: 10,
    expectedAvailableState: 10,
    expectedAvailable: 10,
    expectedCustody: 0,
    optionalAccessibility: null,
    projectionEvidence: {
      version: 1,
      asOf: frozenAsOf,
      productStockBefore: 10,
      productStockExpected: 10,
      batches: [],
    },
    sourceEvidence: [evidence],
    discrepancies: [],
    manifestProductFingerprint: '',
  };
  p.manifestProductFingerprint = productFingerprint(p);
  const m: OpeningManifest = {
    formatVersion: 1,
    companyId,
    cutoverId,
    baselineBuild: 'test',
    frozenAsOf,
    freezeEvidenceRef: evidence.reference,
    freezeEvidenceHash: evidence.contentHash,
    snapshotFingerprint: 'b'.repeat(64),
    products: [p],
    legacySales: [],
    evidenceCatalog: [evidence],
    manifestDigest: '',
  };
  m.manifestDigest = manifestHash(m);
  return m;
}
function seal(m: OpeningManifest) {
  m.products.forEach(
    (p) => (p.manifestProductFingerprint = productFingerprint(p)),
  );
  m.manifestDigest = manifestHash(m);
  return m;
}
describe('01D-B manifest, reconciliation and dormant boundaries', () => {
  it('strict canonical manifest and product hashes are deterministic', () => {
    const m = manifest();
    validateManifest(m);
    expect(manifestHash(structuredClone(m))).toBe(m.manifestDigest);
    expect(productFingerprint(m.products[0])).toBe(
      m.products[0].manifestProductFingerprint,
    );
    expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }));
  });
  it('execution envelope does not change payload digest', () => {
    const m = manifest();
    expect(manifestHash({ payload: m, executedAt: 'now' }.payload)).toBe(
      manifestHash({ payload: m, executedAt: 'later' }.payload),
    );
  });
  it.each(['isActive', 'legacyStock', 'lotTracking'] as const)(
    'material %s changes fingerprint',
    (field) => {
      const m = manifest(),
        p = m.products[0];
      const before = productFingerprint(p);
      const changed = {
        ...p,
        [field]:
          field === 'isActive'
            ? false
            : field === 'legacyStock'
              ? 11
              : 'OPTIONAL',
      };
      expect(productFingerprint(changed)).not.toBe(before);
    },
  );
  it('rejects unknown manifest fields even with recomputed digest', () => {
    const m = Object.assign(manifest(), { bypass: true });
    m.manifestDigest = manifestHash(m);
    expect(() => validateManifest(m)).toThrow();
  });
  it.each([NaN, Infinity, 0.5, undefined])(
    'canonical serialization rejects noncanonical value %s',
    (value) => expect(() => canonical({ value })).toThrow(),
  );
  it('hashes explicit null and rejects implicit undefined', () => {
    expect(openingHash({ id: null })).toHaveLength(64);
    expect(() => openingHash({ id: undefined })).toThrow();
  });
  it('ADJUSTMENT is absolute, IN/OUT deltas; receipt is not a second movement', () => {
    const history = [
      { movementType: 'IN' as const, quantity: 10 },
      { movementType: 'ADJUSTMENT' as const, quantity: 7 },
      { movementType: 'OUT' as const, quantity: 2 },
    ];
    expect(history.reduce(movementBalance, 0)).toBe(5);
  });
  it('REQUIRED unbatched residual blocks', () => {
    const m = manifest();
    m.products[0].lotTracking = 'REQUIRED';
    expect(() => validateManifest(seal(m))).toThrow();
  });
  it('NONE cannot relabel a batch identity', () => {
    const m = manifest();
    m.products[0].pools[0].batchId = randomUUID();
    expect(() => validateManifest(seal(m))).toThrow();
  });
  it('zero baseline has no pools', () => {
    const m = manifest(),
      p = m.products[0];
    p.pools = [];
    p.legacyStock =
      p.expectedOwned =
      p.expectedAvailable =
      p.expectedAvailableState =
        0;
    p.projectionEvidence.productStockBefore =
      p.projectionEvidence.productStockExpected = 0;
    expect(() => validateManifest(seal(m))).not.toThrow();
  });
  it('zero quantity Position/pool is invalid', () => {
    const m = manifest();
    m.products[0].pools[0].quantity = 0;
    expect(() => validateManifest(seal(m))).toThrow();
  });
  it('duplicate canonical pool is rejected', () => {
    const m = manifest();
    m.products[0].pools.push({ ...m.products[0].pools[0] });
    expect(() => validateManifest(seal(m))).toThrow();
  });
  it('inactive owned remains truthful and ineligible', () => {
    const m = manifest(),
      p = m.products[0];
    p.isActive = false;
    p.expectedAvailable = 0;
    expect(() => validateManifest(seal(m))).not.toThrow();
    expect(totals(p, m.frozenAsOf)).toEqual({
      owned: 10,
      availableState: 10,
      available: 0,
      custody: 0,
    });
  });
  it('expired batch eligibility is separate from AVAILABLE state', () => {
    const m = manifest(),
      p = m.products[0],
      pool = p.pools[0],
      id = randomUUID();
    pool.batchId = id;
    p.batches = [
      {
        batchId: id,
        lotNumber: 'real',
        expirationDate: '2020-01-01T00:00:00.000Z',
        receivedAt: m.frozenAsOf,
        isActive: true,
        initialQuantityBefore: 10,
        availableQuantityBefore: 10,
        availableQuantityExpected: 10,
      },
    ];
    expect(eligible(p, pool, m.frozenAsOf)).toBe(false);
    expect(totals(p, m.frozenAsOf).owned).toBe(10);
  });
  it('CUSTODY default registry fails closed; explicit resolver is tenant-aware', async () => {
    const m = manifest(),
      p = m.products[0];
    p.pools[0] = {
      ...p.pools[0],
      state: 'CUSTODY',
      contextType: 'TEST_ONLY',
      contextId: m.companyId,
    };
    const tx = {} as Prisma.TransactionClient;
    await expect(
      new OpeningCustodyRegistry().validate(tx, m, p),
    ).rejects.toThrow();
    const registry = new OpeningCustodyRegistry(
      new Map([
        [
          'TEST_ONLY',
          async (_tx, c, _p, pool) => pool.contextId === c.companyId,
        ],
      ]),
    );
    await expect(registry.validate(tx, m, p)).resolves.toBeUndefined();
    await expect(
      registry.validate(tx, { ...m, companyId: randomUUID() }, p),
    ).rejects.toThrow();
  });
  it('no artifact path defaults into repository or preserved directories', () => {
    expect(
      () =>
        new OpeningArtifact(
          join(process.cwd(), 'output', 'manifest.json'),
          process.cwd(),
        ),
    ).toThrow();
    expect(() => new OpeningArtifact('relative.json', process.cwd())).toThrow();
  });
  it('no productive source imports opening/reconciliation/verification services', () => {
    const root = join(__dirname, '../..');
    const violations: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.spec.ts') &&
          ![
            'inventory-cutover-activate.ts',
            'inventory-cutover-activation.contract.ts',
            'inventory-cutover-activation.service.ts',
          ].includes(entry.name) &&
          !/^inventory-(opening|reconciliation|cutover-verify)/.test(
            entry.name,
          ) &&
          /from ['"].*inventory-(opening|reconciliation|cutover-verify)/.test(
            readFileSync(path, 'utf8'),
          )
        )
          violations.push(path);
      }
    };
    walk(root);
    expect(violations).toEqual([]);
    expect(
      readFileSync(join(__dirname, 'physical-inventory.contract.ts'), 'utf8'),
    ).not.toContain("kind: 'OPENING'");
  });
});
