// Local API smoke only; does not execute the manual ERP acceptance matrix.
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { assertQaEnvironment, assertQaDatabase } = require('./guard.cjs');
const appRequire = createRequire('/app/package.json');
const { PrismaClient } = appRequire('@prisma/client');
const { JwtService } = appRequire('@nestjs/jwt');
const api = 'http://127.0.0.1:3001';
async function request(path, expected, body, token) {
  const response = await fetch(api + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
  });
  console.log(`${path}: HTTP ${response.status}`);
  const result = await response.json();
  if (response.status !== expected) {
    const knownMessages = [
      'El enlace no es válido o ha expirado.',
      'La nueva contraseña debe ser diferente de la actual.',
      'Credenciales inválidas',
      'Forbidden resource',
    ];
    console.error(`Unexpected response: ${knownMessages.includes(result.message) ? result.message : 'redacted'}`);
    throw new Error('Unexpected HTTP status');
  }
  return result;
}
async function main() {
  assertQaEnvironment(process.env);
  const db = new PrismaClient();
  let verifiedIdentity = false;
  try {
    await assertQaDatabase(db);
    verifiedIdentity = true;
    const sessions = {};
    for (const role of ['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE']) {
      const result = await request('/auth/login', 201, { email: `${role.toLowerCase()}.a@qa.example.test`, password: process.env.QA_PASSWORD });
      if (result.user.role !== role) throw new Error('Unexpected role');
      console.log(`Verified role: ${role}`);
      sessions[role] = result;
      const me = await request('/auth/me', 200, null, result.token);
      if (me.role !== role) throw new Error('Unexpected session');
    }
    const other = await request('/auth/login', 201, { email: 'admin.b@qa.example.test', password: process.env.QA_PASSWORD });
    if (other.user.companyId === sessions.ADMIN.user.companyId) throw new Error('Tenant mismatch');
    console.log('Company B ADMIN login verified');
    await request('/auth/login', 401, { email: 'admin.a@qa.example.test', password: randomBytes(24).toString('hex') });
    await request('/auth/me', 401);
    await request('/auth/me', 401, null, 'invalid-qa-token');
    const signer = new JwtService({ secret: process.env.JWT_SECRET });
    const payload = signer.decode(sessions.ADMIN.token);
    payload.exp = Math.floor(Date.now() / 1000) - 60;
    await request('/auth/me', 401, null, signer.sign(payload));
    await request('/users', 403, null, sessions.SALES.token);
    await request('/auth/me', 200, null, sessions.SALES.token);
    const nextPassword = randomBytes(24).toString('base64url');
    await request('/auth/change-password', 201, { currentPassword: process.env.QA_PASSWORD, newPassword: nextPassword }, sessions.WAREHOUSE.token);
    await request('/auth/me', 401, null, sessions.WAREHOUSE.token);
    await request('/auth/login', 401, { email: 'warehouse.a@qa.example.test', password: process.env.QA_PASSWORD });
    await request('/auth/login', 201, { email: 'warehouse.a@qa.example.test', password: nextPassword });
    const tokens = JSON.parse(readFileSync('/qa-private/reset-tokens.local.json', 'utf8'));
    for (const kind of ['expired', 'used']) await request('/auth/reset-password', 400, { token: tokens[kind].token, newPassword: nextPassword });
    await request('/auth/reset-password', 400, { token: tokens.valid.token, newPassword: process.env.QA_PASSWORD });
    await request('/auth/reset-password', 201, { token: tokens.valid.token, newPassword: nextPassword });
    await request('/auth/reset-password', 400, { token: tokens.valid.token, newPassword: nextPassword });
    await request('/auth/me', 401, null, sessions.ADMIN.token);
    await request('/auth/login', 201, { email: 'admin.a@qa.example.test', password: nextPassword });
    console.log('Local auth smoke PASS; no JWTs/passwords/reset tokens printed.');
  } finally {
    await db.$disconnect();
    if (verifiedIdentity) {
      const restore = spawnSync(process.execPath, ['/qa-tools/tokens.cjs', '--restore-auth'], { stdio: 'inherit', env: process.env });
      if (restore.status !== 0) throw new Error('QA auth restore failed');
    }
  }
}
main().catch(() => { console.error('Local auth verification failed; inspect HTTP statuses, not secrets.'); process.exitCode = 1; });
