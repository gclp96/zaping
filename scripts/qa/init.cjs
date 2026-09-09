// Generates LOCAL-only secrets; never prints values or overwrites existing files.
const { mkdirSync, writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const folder = resolve(__dirname, '../../.qa');
const names = ['api.env', 'postgres.env', 'web.env'];
if (names.some((name) => existsSync(resolve(folder, name)))) {
  console.error('QA env already exists: preserve it; initialization aborted.');
  process.exitCode = 1;
} else {
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const password = randomBytes(32).toString('hex');
  const jwt = randomBytes(48).toString('hex');
  const fixture = randomBytes(20).toString('base64url');
  const write = (name, content) => writeFileSync(resolve(folder, name), content + '\n', { mode: 0o600, flag: 'wx' });
  write('postgres.env', `POSTGRES_USER=zaping_qa\nPOSTGRES_DB=zaping_qa\nPOSTGRES_PASSWORD=${password}`);
  write('api.env', `NODE_ENV=development\nQA_ENABLE=local-only\nDATABASE_URL=postgresql://zaping_qa:${password}@zaping-qa-postgres:5432/zaping_qa\nJWT_SECRET=${jwt}\nQA_PASSWORD=${fixture}\nPORT=3001\nTRUST_PROXY_HOPS=0\nFRONTEND_ORIGIN=http://127.0.0.1:3000\nFRONTEND_BASE_URL=http://127.0.0.1:3000`);
  write('web.env', 'NODE_ENV=development\nNEXT_PUBLIC_API_URL=http://127.0.0.1:3001');
  console.log('QA env created under .qa; secrets were not printed.');
}
