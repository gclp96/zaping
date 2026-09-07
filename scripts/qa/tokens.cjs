const { createRequire } = require('node:module');
const { randomBytes, createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { assertQaEnvironment, assertQaDatabase, id } = require('./guard.cjs');
const appRequire = createRequire('/app/package.json');
const { PrismaClient } = appRequire('@prisma/client');
const bcrypt = appRequire('bcrypt');
async function main() {
  assertQaEnvironment(process.env);
  const db = new PrismaClient();
  try {
    await assertQaDatabase(db);
    const result = {};
    await db.$transaction(async (tx) => {
      const roles = ['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE'];
      const targets = roles.map((role) => id(`A-${role}`)).concat(id('B-ADMIN'));
      const users = await tx.user.findMany({ where: { id: { in: targets } }, include: { company: true } });
      if (users.length !== 5 || users.some((u) => !['A', 'B'].some((t) => u.companyId === id(t) && u.company.name === `Zaping QA Company ${t}`) || !u.email.endsWith('@qa.example.test'))) throw new Error('Fixture identity mismatch');
      if (process.argv.includes('--restore-auth')) {
        const passwordHash = await bcrypt.hash(process.env.QA_PASSWORD, 10);
        await tx.user.updateMany({ where: { id: { in: targets } }, data: { passwordHash, isActive: true, authVersion: { increment: 1 } } });
      }
      const now = new Date();
      await tx.passwordResetToken.updateMany({ where: { userId: { in: targets }, usedAt: null }, data: { usedAt: now } });
      for (const [kind, role] of [['valid', 'ADMIN'], ['expired', 'MANAGER'], ['used', 'SALES']]) {
        // Same 32-byte base64url + SHA-256 hex contract as PasswordRecoveryService.
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(now.getTime() + (kind === 'expired' ? -60000 : 30 * 60000));
        await tx.passwordResetToken.create({ data: { userId: id(`A-${role}`), tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt, usedAt: kind === 'used' ? now : null } });
        result[kind] = { token, expiresAt: expiresAt.toISOString(), email: `${role.toLowerCase()}.a@qa.example.test` };
      }
    });
    writeFileSync('/qa-private/reset-tokens.local.json', JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log('QA reset fixtures refreshed in ignored .qa/reset-tokens.local.json; raw values not printed.');
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('QA token preparation aborted; no secrets printed.'); process.exitCode = 1; });
