import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';

describe('hardening PostgreSQL test registration (no database)', () => {
  const path = resolve(
    __dirname,
    '../../../test/case-dispatch-correction-hardening.postgres.e2e-spec.ts',
  );
  const source = readFileSync(path, 'utf8');

  it('contains no test registration inside another test callback', () => {
    const file = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    const nested: number[] = [];
    function visit(node: ts.Node, depth: number) {
      const registration =
        ts.isCallExpression(node) &&
        /^(it|test)(\.|\(|$)/.test(node.expression.getText(file)) &&
        node.arguments.length >= 2 &&
        ts.isStringLiteral(node.arguments[0]) &&
        (ts.isArrowFunction(node.arguments[1]) ||
          ts.isFunctionExpression(node.arguments[1]));
      if (registration && depth > 0)
        nested.push(
          file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
        );
      ts.forEachChild(node, (child) =>
        visit(child, depth + Number(registration)),
      );
    }
    visit(file, 0);
    expect(nested).toEqual([]);
  });

  it('registers all 37 cases with the gate enabled without running hooks or test bodies', () => {
    const names: string[] = [];
    const register = (name: string) => names.push(name);
    const it = Object.assign(register, {
      each: (rows: unknown[]) => (name: string) => {
        rows.forEach(() => register(name));
      },
    });
    const describe = Object.assign(
      (_name: string, callback: () => void) => callback(),
      {
        skip: () => {
          throw new Error('Unexpected skipped suite');
        },
      },
    );
    const requireMock = jest.fn(() => ({}));
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    // Every import is stubbed; hooks and test callbacks are never invoked.
    // In particular PrismaClient cannot be constructed or connect to a database.
    runInNewContext(code, {
      exports: {},
      require: requireMock,
      process: { env: { RUN_CASE_DISPATCH_CORRECTION_POSTGRES: '1' } },
      jest: { setTimeout: () => undefined },
      describe,
      beforeAll: () => undefined,
      afterAll: () => undefined,
      it,
    });
    expect(names).toHaveLength(37);
    expect(
      names.filter((name) => name.includes('grouped Effect lines')),
    ).toHaveLength(2);
    expect(
      names.filter((name) => name.includes('stale-snapshot')),
    ).toHaveLength(1);
  });
});
