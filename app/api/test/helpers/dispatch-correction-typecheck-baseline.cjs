// Read-only QA tool for the installed Prisma 6.19.3 / TypeScript environment.
// Does not run the Prisma CLI, emit files, connect to PG or change the checkout.
// Node --expose-gc test/helpers/dispatch-correction-typecheck-baseline.cjs
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');
const ts = require('typescript');

const prismaVersion = require('prisma/package.json').version;
if (prismaVersion !== '6.19.3')
  throw new Error(
    'Re-review the in-memory generator adapter for this Prisma version',
  );
const cli = require.resolve('prisma/build/index.js');
const ast = ts.createSourceFile(
  cli,
  fs.readFileSync(cli, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
let wasmInitializer;
(function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'Oue')
    wasmInitializer = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
})(ast);
if (!wasmInitializer?.includes('prisma_schema_build_bg.wasm'))
  throw new Error('Unexpected Prisma WASM wrapper');
const wasm = new Function(
  'P',
  'require',
  '__dirname',
  'return ' + wasmInitializer,
)(
  (factory) => () => {
    const entry = { exports: {} };
    factory(entry.exports, entry);
    return entry.exports;
  },
  require,
  path.dirname(cli),
)();
const generatorPath = require.resolve('@prisma/client/generator-build');
let generatorText = fs.readFileSync(generatorPath, 'utf8');
const start = generatorText.indexOf('function dmmfToTypes(dmmf) {');
const end = generatorText.indexOf('// src/generation/generator.ts', start);
if (start < 0 || end < 0) throw new Error('Unexpected Prisma generator');
const options = generatorText
  .slice(start, end)
  .replace(
    'datasources: [],',
    "datasources: [{name:'db',activeProvider:'postgresql',provider:'postgresql',url:{fromEnvVar:'DATABASE_URL',value:null}}],",
  )
  .replace('activeProvider: "",', 'activeProvider: "postgresql",')
  .replace('runtimeNameTs: "library",', 'runtimeNameTs: "library.js",')
  .replace(
    'runtimeBase: "@prisma/client",',
    'runtimeBase: "@prisma/client/runtime",',
  );
generatorText =
  generatorText.slice(0, start) + options + generatorText.slice(end);
const generatorModule = new Module(generatorPath, module);
generatorModule.filename = generatorPath;
generatorModule.paths = Module._nodeModulePaths(path.dirname(generatorPath));
generatorModule._compile(generatorText, generatorPath); // memory only, never write node_modules
const generator = generatorModule.exports;
const config = ts.readConfigFile('tsconfig.spec.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
const declarationPath = path
  .resolve('node_modules/.prisma/client/index.d.ts')
  .toLowerCase();
const baselineCommit = '619c9b6';
function diagnostics(version, declarations) {
  const compilerOptions = {
    ...parsed.options,
    noEmit: true,
    incremental: false,
  };
  const host = ts.createCompilerHost(compilerOptions);
  const read = host.readFile;
  if (declarations)
    host.readFile = (file) =>
      path.resolve(file).toLowerCase() === declarationPath
        ? declarations
        : read(file);
  const roots =
    version === 'baseline'
      ? parsed.fileNames.filter(
          (file) =>
            !file.includes('case-dispatch-correction') &&
            !file.includes('dispatch-correction-'),
        )
      : parsed.fileNames;
  const program = ts.createProgram(roots, compilerOptions, host);
  return ts.getPreEmitDiagnostics(program).map((item) => ({
    file: item.file
      ? path.relative(process.cwd(), item.file.fileName).replaceAll('\\', '/')
      : null,
    line: item.file
      ? item.file.getLineAndCharacterOfPosition(item.start || 0).line + 1
      : null,
    code: item.code,
    message: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
  }));
}
const result = {};
for (const version of ['baseline', 'current', 'installed']) {
  let declarations;
  if (version !== 'installed') {
    const schema =
      version === 'baseline'
        ? cp.execFileSync(
            'git',
            ['show', baselineCommit + ':app/api/prisma/schema.prisma'],
            { encoding: 'utf8' },
          )
        : fs.readFileSync('prisma/schema.prisma', 'utf8');
    const dmmf = JSON.parse(
      wasm.get_dmmf(JSON.stringify({ prismaSchema: schema, noColor: true })),
    );
    declarations = generator.dmmfToTypes(
      generator.externalToInternalDmmf(dmmf),
    );
  }
  result[version] = diagnostics(version, declarations);
  global.gc?.();
}
const identity = (item) => JSON.stringify([item.file, item.line, item.code]);
const old = new Map(result.baseline.map((item) => [identity(item), item]));
const current = new Map(result.current.map((item) => [identity(item), item]));
const report = {
  baselineCommit,
  prismaVersion,
  typescriptVersion: ts.version,
  sameInstalledDependencies: true,
  noFileEmission: true,
  globalSpecsGate: result.current.length ? 'FAIL' : 'PASS',
  baselineCount: result.baseline.length,
  currentCount: result.current.length,
  installedMatchesMemory:
    JSON.stringify(result.installed) === JSON.stringify(result.current),
  addedLocations: result.current.filter((item) => !old.has(identity(item))),
  removedLocations: result.baseline.filter(
    (item) => !current.has(identity(item)),
  ),
  changedMessages: result.current
    .filter(
      (item) =>
        old.has(identity(item)) &&
        old.get(identity(item)).message !== item.message,
    )
    .map((item) => ({ baseline: old.get(identity(item)), current: item })),
  baselineDiagnostics: result.baseline,
  currentDiagnostics: result.current,
};
console.log(JSON.stringify(report, null, 2));
if (!report.installedMatchesMemory || report.addedLocations.length)
  process.exitCode = 1;
