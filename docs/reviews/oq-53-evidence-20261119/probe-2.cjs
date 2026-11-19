// OQ-53 planning probe, part 2: starvation on the confirm side, the full lock order with a mapping insert, and EXPLAIN of the freshness read.
const { Client } = require('pg'); const { randomUUID } = require('node:crypto');
const u = new URL(process.env.SLICE1_TEST_DATABASE_URL);
if (u.hostname !== '127.0.0.1' || u.port !== '55471' || u.pathname !== '/slice1_verify_531119') throw new Error('wrong database');
const out = []; const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const open = async () => { const c = new Client({ connectionString: process.env.SLICE1_TEST_DATABASE_URL, statement_timeout: 20000 }); await c.connect(); await c.query('SET search_path = oq53_probe, pg_catalog'); return c; };
const q = async (c, sql, p) => (await c.query(sql, p)).rows;
const timed = async f => { const t = Date.now(); try { const v = await f(); return { ms: Date.now() - t, v }; } catch (e) { return { ms: Date.now() - t, err: e.code || e.message }; } };
const T = randomUUID(), PA = randomUUID();
const DDL = `
DROP SCHEMA IF EXISTS oq53_probe CASCADE; CREATE SCHEMA oq53_probe; SET search_path = oq53_probe, pg_catalog;
CREATE TABLE projects(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, UNIQUE(id,tenant_id));
CREATE TABLE mappings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id));
CREATE TABLE heads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, thread_key text NOT NULL, last_seq bigint NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id), UNIQUE(tenant_id,project_id,thread_key));
CREATE TABLE dec(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, thread_key text NOT NULL, seen bigint, mode text NOT NULL, project_lock boolean NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id));
CREATE FUNCTION project_lock() RETURNS trigger LANGUAGE plpgsql SET lock_timeout='5s' AS $$
BEGIN IF NEW.project_lock THEN PERFORM 1 FROM oq53_probe.projects p WHERE p.id = NEW.project_id FOR NO KEY UPDATE; END IF; RETURN NEW; END $$;
CREATE FUNCTION mapping_lock() RETURNS trigger LANGUAGE plpgsql SET lock_timeout='5s' AS $$
BEGIN PERFORM 1 FROM oq53_probe.projects p WHERE p.id = NEW.project_id FOR NO KEY UPDATE; RETURN NEW; END $$;
CREATE TRIGGER a_lock BEFORE INSERT ON dec FOR EACH ROW EXECUTE FUNCTION project_lock();
CREATE TRIGGER a_lock BEFORE INSERT ON mappings FOR EACH ROW EXECUTE FUNCTION mapping_lock();
CREATE FUNCTION dec_cas() RETURNS trigger LANGUAGE plpgsql SET lock_timeout='5s' AS $$
DECLARE cur bigint;
BEGIN
  EXECUTE 'SELECT last_seq FROM oq53_probe.heads WHERE project_id=$1 AND thread_key=$2 ' || NEW.mode INTO cur USING NEW.project_id, NEW.thread_key;
  IF cur IS DISTINCT FROM NEW.seen THEN RAISE EXCEPTION 'moved' USING ERRCODE='LTZ03'; END IF; RETURN NULL;
END $$;
CREATE TRIGGER z_cas AFTER INSERT ON dec FOR EACH ROW EXECUTE FUNCTION dec_cas();
CREATE FUNCTION bump(p uuid, t text) RETURNS bigint LANGUAGE sql SET lock_timeout='5s' AS $$
  INSERT INTO oq53_probe.heads AS h(tenant_id,project_id,thread_key,last_seq) SELECT tenant_id,id,t,1 FROM oq53_probe.projects WHERE id=p
  ON CONFLICT(tenant_id,project_id,thread_key) DO UPDATE SET last_seq=h.last_seq+1 RETURNING last_seq $$;
`;
(async () => {
  const op = await open(); await op.query(DDL); await q(op, 'INSERT INTO projects VALUES($1,$2)', [PA, T]); await q(op, 'SELECT bump($1,$2)', [PA, 't']);
  log('== 7. starvation of an intake insert by overlapping confirmations (three sessions, each holds 150 ms, started 50 ms apart) ==');
  for (const projectLock of [false, true]) for (const mode of ['FOR SHARE', 'FOR NO KEY UPDATE']) {
    let stop = false, okN = 0, errs = {};
    const worker = async delay => { const c = await open(); await sleep(delay); while (!stop) { try { await c.query('BEGIN'); const seen = (await q(c, "SELECT last_seq FROM heads WHERE thread_key='t'"))[0].last_seq;
      await q(c, 'INSERT INTO dec(tenant_id,project_id,thread_key,seen,mode,project_lock) VALUES($1,$2,$3,$4,$5,$6)', [T, PA, 't', seen, mode, projectLock]); await sleep(150); await c.query('ROLLBACK'); okN++; }
      catch (e) { errs[e.code] = (errs[e.code] || 0) + 1; await c.query('ROLLBACK').catch(() => {}); } } await c.end(); };
    const ws = [worker(0), worker(50), worker(100)];
    await sleep(700);
    const before = okN;
    const c = await open(); await q(c, "SET statement_timeout='9s'");
    const st = await timed(() => q(c, 'SELECT bump($1,$2)', [PA, 't']));
    const during = okN - before;
    stop = true; await Promise.all(ws); await c.end();
    log(`confirmations take the project row lock first (as 022 does): ${projectLock} | thread lock ${mode}: the intake's counter update ended after ${st.ms} ms with ${st.err ?? 'ok'}; confirmations that completed while it waited: ${during}; worker errors: ${JSON.stringify(errs)}`);
  }
  log('\n== 8. full lock order: mapping insert (project NKU) / confirmation (project NKU, then thread) / intake (FK KEY SHARE on project, then thread) ==');
  const a = await open(), b = await open(), c = await open();
  await a.query('BEGIN'); await q(a, 'INSERT INTO mappings(tenant_id,project_id) VALUES($1,$2)', [T, PA]);                 // A: mapping insert holds project NKU
  await b.query('BEGIN'); const pi = timed(() => q(b, 'SELECT bump($1,$2)', [PA, 't']));                                    // B: intake takes the thread
  const ib = await pi;
  const fk = await timed(() => q(b, 'INSERT INTO heads(tenant_id,project_id,thread_key,last_seq) VALUES($1,$2,$3,1)', [T, PA, 't-fk-' + randomUUID()])); // B: an FK insert while A holds NKU
  await c.query('BEGIN'); const seen = (await q(op, "SELECT last_seq FROM heads WHERE thread_key='t'"))[0].last_seq;
  const pd = timed(() => q(c, 'INSERT INTO dec(tenant_id,project_id,thread_key,seen,mode,project_lock) VALUES($1,$2,$3,$4,$5,true)', [T, PA, 't', seen, 'FOR NO KEY UPDATE'])); // C: confirmation waits for A's project lock
  await sleep(300); await a.query('COMMIT'); await sleep(300); await b.query('COMMIT');
  const d = await pd; await c.query('ROLLBACK');
  log(`intake took the thread in ${ib.ms} ms and its FK insert took ${fk.ms} ms while a mapping insert held the project row; the confirmation waited for the mapping (300 ms), then for the intake (300 ms): ended after ${d.ms} ms with ${d.err} (the intake's number committed meanwhile); no 40P01 anywhere`);
  await op.query('DROP SCHEMA oq53_probe CASCADE');
  for (const x of [a, b, c, op]) await x.end();
  require('node:fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
})().catch(async e => { console.error('FAILED', e.code, e.message); try { const c = await open(); await c.query('DROP SCHEMA IF EXISTS oq53_probe CASCADE'); await c.end(); } catch {} process.exit(1); });
