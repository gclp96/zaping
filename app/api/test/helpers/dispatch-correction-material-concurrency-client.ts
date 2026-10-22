import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';

// Test-only loader for the INSTALLED generated Prisma 6.19.3 client. Its normal
// entry invokes warnEnvConflicts at import time, BEFORE explicit URL validation.
// Keep the real client/engine/error classes, but disable both generated env paths
// in memory before that call. No generated files are changed; existing require cache entries are not replaced.
class CompilableModule extends Module {
  declare _compile: (source: string, filename: string) => void;
}
export function concurrencyPrismaWithoutDotenv(): typeof import('@prisma/client') {
  const filename = require.resolve('.prisma/client/index');
  const source = readFileSync(filename, 'utf8');
  const marker =
    "const { warnEnvConflicts } = require('@prisma/client/runtime/library.js')";
  if (
    !source.includes('"clientVersion": "6.19.3"') ||
    source.split(marker).length !== 2
  ) {
    throw new Error(
      'Re-review 01C-C no-dotenv loader for this generated Prisma version',
    );
  }
  const code = source.replace(
    marker,
    'config.relativeEnvPaths = { rootEnvPath: null, schemaEnvPath: null };\n' +
      marker,
  );
  const clientModule = new CompilableModule(filename, module);
  clientModule.filename = filename;
  clientModule.paths =
    createRequire(filename).resolve.paths('@prisma/client') ?? [];
  // _compile uses Node's outer realm. Load the REAL runtime through Jest so
  // decoded Date values and error classes belong to the same realm as the
  // production contracts under test (notably serverTime's instanceof Date).
  const nativeRequire = clientModule.require.bind(clientModule) as (
    id: string,
  ) => unknown;
  const runtime = jest.requireActual<
    typeof import('@prisma/client/runtime/library')
  >('@prisma/client/runtime/library.js');
  clientModule.require = (id: string) =>
    id === '@prisma/client/runtime/library.js' ? runtime : nativeRequire(id);
  clientModule._compile(code, filename);
  return clientModule.exports as typeof import('@prisma/client');
}
