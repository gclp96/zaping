const { spawnSync } = require('node:child_process');
const { assertQaEnvironment } = require('./guard.cjs');
try {
  assertQaEnvironment(process.env);
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: '/app', env: process.env, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} catch {
  console.error('QA migration guard aborted.');
  process.exitCode = 1;
}
