import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import * as runtime from '@prisma/client/runtime/library';

// Jest module mapper, NOT a Prisma mock: export the complete installed REAL
// generated client/engine. Disable generated dotenv paths before any import-time
// env loader can run. Keep runtime decoding in Jest's realm (Date/error identity).
class GeneratedModule extends Module {
  declare _compile: (source: string, filename: string) => void;
}
const native = createRequire(__filename);
const filename = native.resolve('.prisma/client/index');
const source = readFileSync(filename, 'utf8');
const marker =
  "const { warnEnvConflicts } = require('@prisma/client/runtime/library.js')";
if (
  !source.includes('"clientVersion": "6.19.3"') ||
  source.split(marker).length !== 2
)
  throw new Error(
    'Re-review 01D no-dotenv loader for installed Prisma version',
  );
const generated = new GeneratedModule(filename, module);
generated.filename = filename;
generated.paths = createRequire(filename).resolve.paths('@prisma/client') ?? [];
generated.require = (id: string) =>
  id === '@prisma/client/runtime/library.js'
    ? runtime
    : (createRequire(filename)(id) as unknown);
generated._compile(
  source.replace(
    marker,
    'config.relativeEnvPaths = { rootEnvPath: null, schemaEnvPath: null };\n' +
      marker,
  ),
  filename,
);
const client = generated.exports as typeof import('@prisma/client');
export = client;
