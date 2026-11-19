// OQ-53 plan 0.2, probe 3: can a migration see "a session of a role that is a member of libetech_ai" in pg_stat_activity? Read-only: no object is created.
const { Client } = require('pg');
const u = new URL(process.env.SLICE1_TEST_DATABASE_URL);
if (u.hostname !== '127.0.0.1' || u.port !== '55471' || u.pathname !== '/slice1_verify_531119') throw new Error('wrong database');
const out = []; const log = s => { out.push(s); console.log(s); };
const open = async () => { const c = new Client({ connectionString: process.env.SLICE1_TEST_DATABASE_URL }); await c.connect(); return c; };
const CHECK = `SELECT count(*)::int n FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_roles r ON r.oid = a.usesysid
  WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.datname = pg_catalog.current_database() AND NOT r.rolsuper
    AND pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER')`;
const NAIVE = CHECK.replace('AND NOT r.rolsuper', '');
(async () => {
  const mig = await open(), other = await open();
  const n = async sql => (await mig.query(sql)).rows[0].n;
  log('== 9. the refusal "a session of a role that is a member of libetech_ai is connected" (plan 0.2, P6; security gate S-1) ==');
  log(`9a another superuser session only: check without "NOT rolsuper" counts ${await n(NAIVE)} (pg_has_role is true for a superuser); with it: ${await n(CHECK)}`);
  await other.query('BEGIN'); await other.query('SET LOCAL ROLE libetech_ai');
  log(`9b the other session does SET LOCAL ROLE libetech_ai inside a transaction (what the tests' AI handle does): check counts ${await n(CHECK)}; its usename is still ${(await mig.query('SELECT usename FROM pg_stat_activity WHERE pid=$1', [other.processID])).rows[0].usename === u.username ? 'the login' : 'changed'}`);
  await other.query('ROLLBACK');
  await other.query('SET SESSION AUTHORIZATION libetech_ai');
  const name = (await mig.query('SELECT usename FROM pg_stat_activity WHERE pid=$1', [other.processID])).rows[0].usename;
  log(`9c the other session does SET SESSION AUTHORIZATION libetech_ai: usename in pg_stat_activity = ${name}; check counts ${await n(CHECK)}`);
  await other.query('RESET SESSION AUTHORIZATION');
  await other.query('SET SESSION AUTHORIZATION libetech_runtime');
  log(`9d the other session is libetech_runtime (not a member): check counts ${await n(CHECK)}`);
  await other.query('RESET SESSION AUTHORIZATION');
  log(`9e members of libetech_ai among login roles today: ${(await mig.query("SELECT count(*)::int n FROM pg_roles r WHERE r.rolcanlogin AND NOT r.rolsuper AND pg_has_role(r.oid,'libetech_ai','MEMBER')")).rows[0].n}`);
  await other.end(); await mig.end();
  require('node:fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
})().catch(e => { console.error('FAILED', e.code, e.message); process.exit(1); });
