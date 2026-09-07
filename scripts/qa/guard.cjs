const { createHash } = require('node:crypto');

function assertQaEnvironment(env) {
  const fail = () => { throw new Error('ABORT: explicit local zaping_qa environment required'); };
  if (!['development', 'test'].includes(env.NODE_ENV) || env.QA_ENABLE !== 'local-only') fail();
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { fail(); }
  if (url.protocol !== 'postgresql:' || url.pathname !== '/zaping_qa' ||
      url.username !== 'zaping_qa' || !url.password || url.search || url.hash ||
      !['localhost', '127.0.0.1', '[::1]', 'zaping-qa-postgres'].includes(url.hostname) ||
      !['5432', '5433'].includes(url.port)) fail();
  if (!env.QA_PASSWORD || env.QA_PASSWORD.length < 12) fail();
}

async function assertQaDatabase(db) {
  const [identity] = await db.$queryRaw`SELECT current_database() AS db, current_user AS usr`;
  if (identity.db !== 'zaping_qa' || identity.usr !== 'zaping_qa') {
    throw new Error('ABORT: connected database identity is not QA');
  }
}

function id(key) {
  const hex = createHash('sha256').update(`zaping-local-qa-v1:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
module.exports = { assertQaEnvironment, assertQaDatabase, id };
