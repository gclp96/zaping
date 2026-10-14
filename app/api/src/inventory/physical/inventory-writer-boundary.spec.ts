import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

describe('01D-C bounded writer/import contract', () => {
  const root = join(__dirname, '../..');
  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? sources(join(dir, e.name))
        : e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')
          ? [join(dir, e.name)]
          : [],
    );
  }
  it('allows direct Product stock mutation only in approved legacy/projection branches', () => {
    const allowed = new Set([
      'inventory/inventory.service.ts',
      'sales/sales.service.ts',
      'purchases-receipts/purchases-receipts.service.ts',
      'inventory/physical/receipt-physical-integration.service.ts',
      'inventory/physical/inventory-compatibility-projection.service.ts',
      'inventory/physical/inventory-opening-projection.service.ts',
    ]);
    const violations: string[] = [];
    for (const path of sources(root)) {
      const source = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ['update', 'updateMany', 'create', 'upsert'].includes(
            node.expression.name.text,
          ) &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          node.expression.expression.name.text === 'product'
        ) {
          const input = node.arguments[0];
          if (
            input &&
            ts.isObjectLiteralExpression(input) &&
            /\bstock\s*:/.test(input.getText(source)) &&
            !allowed.has(relative(root, path).replaceAll('\\', '/'))
          )
            violations.push(relative(root, path));
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(violations).toEqual([]);
  });
  it('productive modules cannot register activation or opening tooling', () => {
    for (const path of sources(root).filter((p) => p.endsWith('.module.ts'))) {
      expect(readFileSync(path, 'utf8')).not.toMatch(
        /inventory-(opening|reconciliation|cutover-(activate|activation|verify))/,
      );
    }
  });
  it('the four productive entry points retain their guarded composition', () => {
    const read = (path: string) => readFileSync(join(root, path), 'utf8');
    expect(read('inventory/inventory.service.ts')).toContain(
      'this.authority.run(',
    );
    expect(read('inventory/inventory.service.ts')).not.toContain(
      'registerPurchaseEntry',
    );
    expect(read('purchases-receipts/purchases-receipts.service.ts')).toContain(
      'this.authority.run(',
    );
    expect(read('sales/sales.service.ts')).toContain(
      'private async approveLegacy(',
    );
    expect(read('sales/sales.service.ts')).toContain(
      'private async createFromQuoteLegacy(',
    );
    expect(
      read('inventory/physical/sales-physical-integration.service.ts'),
    ).toContain('this.authority.run(');
    expect(
      read('inventory/physical/inventory-authority-transaction.service.ts'),
    ).toContain('this.resolver.resolve(');
  });
});
