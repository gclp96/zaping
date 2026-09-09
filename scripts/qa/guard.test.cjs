const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertQaEnvironment, assertQaDatabase, id } = require('./guard.cjs');
const good = { NODE_ENV: 'development', QA_ENABLE: 'local-only', QA_PASSWORD: 'synthetic-test-only', DATABASE_URL: 'postgresql://zaping_qa:synthetic@localhost:5433/zaping_qa' };
test('accepts explicit local QA only', () => assert.doesNotThrow(() => assertQaEnvironment(good)));
for (const url of [
  'postgresql://zaping_qa:synthetic@remote.example:5432/zaping_qa',
  'postgresql://zaping_qa:synthetic@localhost:5433/zaping_dev',
  'postgresql://zaping_qa:synthetic@localhost.evil.test:5433/zaping_qa',
  'postgresql://postgres:synthetic@localhost:5433/zaping_qa',
  'postgresql://zaping_qa:synthetic@localhost:5433/zaping_qa?host=remote',
  'postgresql://zaping_qa:synthetic@localhost:5433/%7Aaping_qa',
  'not-a-url',
]) test(`rejects unsafe destination ${url}`, () => assert.throws(() => assertQaEnvironment({ ...good, DATABASE_URL: url }), /ABORT/));
for (const patch of [{ NODE_ENV: 'production' }, { NODE_ENV: undefined }, { QA_ENABLE: undefined }, { QA_PASSWORD: '' }]) {
  test(`rejects missing safeguards ${JSON.stringify(patch)}`, () => assert.throws(() => assertQaEnvironment({ ...good, ...patch }), /ABORT/));
}
test('checks actual database identity', async () => {
  await assert.rejects(assertQaDatabase({ $queryRaw: async () => [{ db: 'zaping_dev', usr: 'zaping_qa' }] }), /ABORT/);
  await assert.doesNotReject(assertQaDatabase({ $queryRaw: async () => [{ db: 'zaping_qa', usr: 'zaping_qa' }] }));
});
test('stable distinct UUIDs', () => {
  assert.equal(id('A'), id('A'));
  assert.notEqual(id('A'), id('B'));
  assert.match(id('A'), /^[a-f0-9-]{36}$/);
});
