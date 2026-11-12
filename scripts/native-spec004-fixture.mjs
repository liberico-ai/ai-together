import { randomBytes } from 'node:crypto';
import { Pool,escapeLiteral } from 'pg';
import { spawnSync } from 'node:child_process';

const base = new URL('postgresql://127.0.0.1:35448/spec004_verify');
base.username='spec004_operator';
base.password=process.env.SPEC004_TEMP_PASSWORD;
const result=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/migrate.ts'],
  {env:{...process.env,MIGRATION_DATABASE_URL:base.href},stdio:'inherit'});
if(result.status!==0) process.exit(result.status??1);
const pool=new Pool({connectionString:base.href});
const runtime=new URL(base);
runtime.username='libetech_web';
runtime.password=randomBytes(24).toString('hex');
try {
  await pool.query('ALTER ROLE libetech_web PASSWORD '+escapeLiteral(runtime.password));
} finally { await pool.end(); }
const tests=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/spec004.test.ts','--reporter=dot'],
  {env:{...process.env,SPEC004_TEST_DATABASE_URL:base.href,SPEC004_WEB_DATABASE_URL:runtime.href},stdio:'inherit'});
process.exitCode=tests.status??1;
