// OQ-53 planning probe. Runs only inside schema oq53_probe of the session's own test database. No application table is written.
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const URL_OP = process.env.SLICE1_TEST_DATABASE_URL, URL_WEB = process.env.SLICE1_WEB_DATABASE_URL;
const u = new URL(URL_OP);
if (u.hostname !== '127.0.0.1' || u.port !== '55471' || u.pathname !== '/slice1_verify_531119') throw new Error('wrong database');
const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const open = async (url = URL_OP) => { const c = new Client({ connectionString: url, statement_timeout: 20000 }); await c.connect(); await c.query('SET search_path = oq53_probe, pg_catalog'); return c; };
const q = async (c, sql, p) => (await c.query(sql, p)).rows;
const timed = async f => { const t = Date.now(); try { const v = await f(); return { ms: Date.now() - t, v }; } catch (e) { return { ms: Date.now() - t, err: e.code || e.message }; } };
const T = randomUUID(), PA = randomUUID(), PB = randomUUID();

const DDL = `
DROP SCHEMA IF EXISTS oq53_probe CASCADE;
CREATE SCHEMA oq53_probe;
SET search_path = oq53_probe, pg_catalog;
CREATE TABLE projects(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text, UNIQUE(id,tenant_id));
CREATE TABLE mappings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id));
CREATE TABLE ev(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  chat_id text NOT NULL, thread_key text NOT NULL, message_id text NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id), UNIQUE(tenant_id,chat_id,message_id), UNIQUE(id,tenant_id,project_id));
CREATE INDEX ev_thread ON ev(tenant_id,chat_id,thread_key);
-- variant A: AFTER INSERT trigger, positions in a side table
CREATE TABLE rev(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid NOT NULL, revision_no integer NOT NULL, revision_key text NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(source_event_id,tenant_id,project_id) REFERENCES ev(id,tenant_id,project_id),
  UNIQUE(source_event_id,revision_key), UNIQUE(source_event_id,revision_no), UNIQUE(id,source_event_id,tenant_id,project_id));
CREATE TABLE heads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  chat_id text NOT NULL, thread_key text NOT NULL, last_seq bigint NOT NULL CHECK(last_seq>0),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id), UNIQUE(tenant_id,project_id,chat_id,thread_key));
CREATE TABLE pos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid NOT NULL, revision_id uuid NOT NULL UNIQUE, chat_id text NOT NULL, thread_key text NOT NULL, thread_seq bigint NOT NULL CHECK(thread_seq>0),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(revision_id,source_event_id,tenant_id,project_id) REFERENCES rev(id,source_event_id,tenant_id,project_id),
  UNIQUE(tenant_id,project_id,chat_id,thread_key,thread_seq));
CREATE TABLE fired(n bigserial PRIMARY KEY, what text, at timestamptz DEFAULT clock_timestamp());
CREATE FUNCTION rev_position() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE k record; n bigint;
BEGIN
  SELECT e.chat_id, e.thread_key INTO k FROM oq53_probe.ev e WHERE e.id = NEW.source_event_id AND e.tenant_id = NEW.tenant_id AND e.project_id = NEW.project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no event' USING ERRCODE = '23503'; END IF;
  INSERT INTO oq53_probe.heads AS h(tenant_id,project_id,chat_id,thread_key,last_seq) VALUES(NEW.tenant_id,NEW.project_id,k.chat_id,k.thread_key,1)
    ON CONFLICT(tenant_id,project_id,chat_id,thread_key) DO UPDATE SET last_seq = h.last_seq + 1, updated_at = pg_catalog.clock_timestamp() RETURNING h.last_seq INTO n;
  INSERT INTO oq53_probe.pos(tenant_id,project_id,source_event_id,revision_id,chat_id,thread_key,thread_seq) VALUES(NEW.tenant_id,NEW.project_id,NEW.source_event_id,NEW.id,k.chat_id,k.thread_key,n);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION rev_position() FROM PUBLIC;
CREATE TRIGGER rev_position AFTER INSERT ON rev FOR EACH ROW EXECUTE FUNCTION rev_position();
-- variant B: BEFORE INSERT trigger, number in a column of the revision row
CREATE TABLE rev_b(LIKE rev INCLUDING DEFAULTS, thread_seq bigint, PRIMARY KEY(id), UNIQUE(source_event_id,revision_key), UNIQUE(source_event_id,revision_no));
CREATE TABLE heads_b(LIKE heads INCLUDING DEFAULTS, UNIQUE(tenant_id,project_id,chat_id,thread_key));
CREATE FUNCTION rev_b_position() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE k record; n bigint;
BEGIN
  INSERT INTO oq53_probe.fired(what) VALUES('before rev_b');
  SELECT e.chat_id, e.thread_key INTO k FROM oq53_probe.ev e WHERE e.id = NEW.source_event_id;
  INSERT INTO oq53_probe.heads_b AS h(tenant_id,project_id,chat_id,thread_key,last_seq) VALUES(NEW.tenant_id,NEW.project_id,k.chat_id,k.thread_key,1)
    ON CONFLICT(tenant_id,project_id,chat_id,thread_key) DO UPDATE SET last_seq = h.last_seq + 1 RETURNING h.last_seq INTO n;
  NEW.thread_seq := n;
  RETURN NEW;
END $$;
CREATE TRIGGER rev_b_position BEFORE INSERT ON rev_b FOR EACH ROW EXECUTE FUNCTION rev_b_position();
CREATE FUNCTION rev_fired() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO oq53_probe.fired(what) VALUES('after rev'); RETURN NULL; END $$;
CREATE TRIGGER a_rev_fired AFTER INSERT ON rev FOR EACH ROW EXECUTE FUNCTION rev_fired();
-- confirm side: a decision row carries the position the service saw; an AFTER INSERT trigger locks the head row and compares
CREATE TABLE cand(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, chat_id text NOT NULL, thread_key text NOT NULL, UNIQUE(tenant_id,project_id,chat_id,thread_key));
CREATE TABLE dec(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, cand_id uuid NOT NULL, result text NOT NULL, subject_thread_seq bigint, decided_by uuid,
  mode text NOT NULL DEFAULT 'FOR NO KEY UPDATE', FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id));
CREATE FUNCTION dec_project_lock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
BEGIN PERFORM 1 FROM oq53_probe.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE; RETURN NEW; END $$;
CREATE TRIGGER dec_a_project_lock BEFORE INSERT ON dec FOR EACH ROW EXECUTE FUNCTION dec_project_lock();
CREATE FUNCTION dec_subject_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE c record; cur bigint;
BEGIN
  IF NEW.result <> 'confirmed' THEN RETURN NULL; END IF;
  SELECT x.chat_id, x.thread_key INTO c FROM oq53_probe.cand x WHERE x.id = NEW.cand_id AND x.tenant_id = NEW.tenant_id AND x.project_id = NEW.project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no candidate' USING ERRCODE = 'LTZ03'; END IF;
  EXECUTE 'SELECT h.last_seq FROM oq53_probe.heads h WHERE h.tenant_id=$1 AND h.project_id=$2 AND h.chat_id=$3 AND h.thread_key=$4 ' || NEW.mode INTO cur USING NEW.tenant_id, NEW.project_id, c.chat_id, c.thread_key;
  IF cur IS NULL OR NEW.subject_thread_seq IS NULL OR cur <> NEW.subject_thread_seq THEN
    RAISE EXCEPTION 'thread moved: saw %, now %', NEW.subject_thread_seq, cur USING ERRCODE = 'LTZ03';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER dec_subject_order AFTER INSERT ON dec FOR EACH ROW EXECUTE FUNCTION dec_subject_order();
CREATE SEQUENCE plain_seq;
CREATE TABLE seq_rows(n bigint PRIMARY KEY, who text);
`;

async function seed(c) {
  await q(c, 'INSERT INTO projects(id,tenant_id,name) VALUES($1,$3,$4),($2,$3,$5)', [PA, PB, T, 'A', 'B']);
}
let msg = 0;
const newEvent = async (c, project, thread) => (await q(c, 'INSERT INTO ev(tenant_id,project_id,chat_id,thread_key,message_id) VALUES($1,$2,$3,$4,$5) RETURNING id', [T, project, '-100', thread, String(++msg)]))[0].id;
const insRev = (c, project, ev, no, key = randomUUID()) => q(c, `INSERT INTO rev(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_event_id,revision_key) DO NOTHING RETURNING id`, [T, project, ev, no, key]);
const seqOf = async (c, revId) => Number((await q(c, 'SELECT thread_seq FROM pos WHERE revision_id=$1', [revId]))[0].thread_seq);
const head = async (c, project, thread) => { const r = await q(c, 'SELECT last_seq FROM heads WHERE project_id=$1 AND thread_key=$2', [project, thread]); return r[0] ? Number(r[0].last_seq) : null; };

async function main() {
  const op = await open();
  log('server:', (await q(op, 'SHOW server_version'))[0].server_version, '| isolation default:', (await q(op, 'SHOW default_transaction_isolation'))[0].default_transaction_isolation);
  await op.query(DDL);
  await seed(op);
  const a = await open(), b = await open(), r = await open();

  log('\n== 1. plain sequence: nextval is handed out at call time, not at commit ==');
  await a.query('BEGIN'); await b.query('BEGIN');
  const n1 = Number((await q(a, "SELECT nextval('plain_seq') n"))[0].n); await q(a, "INSERT INTO seq_rows VALUES($1,'T1')", [n1]);
  const n2 = Number((await q(b, "SELECT nextval('plain_seq') n"))[0].n); await q(b, "INSERT INTO seq_rows VALUES($1,'T2')", [n2]);
  await b.query('COMMIT');
  const seen = (await q(r, 'SELECT max(n) m, count(*) c FROM seq_rows'))[0];
  log(`T1 got ${n1} (open), T2 got ${n2} and committed first; a reader now sees max=${seen.m}, rows=${seen.c}`);
  await a.query('COMMIT');
  const later = (await q(r, 'SELECT array_agg(n ORDER BY n) v FROM seq_rows'))[0].v;
  log(`after T1 commits the reader sees ${JSON.stringify(later)}: number ${n1} became visible AFTER the reader had already seen ${n2} => a check "nothing above my baseline ${n2}" passed while ${n1} was still in flight; a check "nothing above baseline ${n1}"... the row ${n1} is below any later baseline and is never noticed`);

  log('\n== 2. per-thread counter row (variant A: AFTER INSERT trigger + side table), READ COMMITTED ==');
  const e1 = await newEvent(op, PA, 't1'), e2 = await newEvent(op, PA, 't1'), e3 = await newEvent(op, PA, 't2');
  const first = (await insRev(op, PA, e1, 1))[0].id;
  log('2a first revision of thread t1: thread_seq =', await seqOf(op, first), '| head =', await head(op, PA, 't1'));
  // same thread, two sessions
  await a.query('BEGIN'); await b.query('BEGIN');
  const ra = (await insRev(a, PA, e1, 2))[0].id;
  let bDone = false;
  const pb = timed(async () => { const x = (await insRev(b, PA, e2, 1))[0].id; bDone = true; return x; });
  await sleep(400);
  log(`2b same thread: session A inserted (seq ${await seqOf(a, ra)}, open). Session B's insert finished after 400 ms? ${bDone}`);
  const readerMid = await head(r, PA, 't1');
  await a.query('COMMIT');
  const rb = await pb;
  log(`    A committed; B's insert returned after ${rb.ms} ms with seq ${await seqOf(b, rb.v)}; a reader between saw head=${readerMid}`);
  await b.query('COMMIT');
  log('    committed positions of t1:', JSON.stringify((await q(r, "SELECT array_agg(thread_seq ORDER BY thread_seq) v FROM pos WHERE thread_key='t1'"))[0].v), '| head =', await head(r, PA, 't1'));
  // B cannot commit before A: try 20 rounds where B is asked to commit "first"
  let inversions = 0;
  for (let i = 0; i < 20; i++) {
    await a.query('BEGIN'); await b.query('BEGIN');
    const xa = (await insRev(a, PA, e1, 10 + i))[0].id; const sa = await seqOf(a, xa);
    const p = (async () => { const xb = (await insRev(b, PA, e2, 10 + i))[0].id; const sb = await seqOf(b, xb); await b.query('COMMIT'); return { sb, at: Date.now() }; })();
    await sleep(15);
    const maxMid = Number((await q(r, "SELECT coalesce(max(thread_seq),0) m FROM pos WHERE thread_key='t1'"))[0].m);
    await a.query('COMMIT'); const aAt = Date.now();
    const { sb, at } = await p;
    if (!(sa < sb && aAt <= at && maxMid < sa)) inversions++;
  }
  log(`2c 20 rounds, B always tries to commit first: order violations (seq order != commit order, or a reader saw a higher seq before a lower one committed) = ${inversions}`);
  // rollback leaves no gap
  await a.query('BEGIN'); const xr = (await insRev(a, PA, e1, 100))[0].id; const sr = await seqOf(a, xr); await a.query('ROLLBACK');
  const xn = (await insRev(op, PA, e1, 101))[0].id;
  log(`2d a rolled-back insert had seq ${sr}; the next committed insert got seq ${await seqOf(op, xn)} (no gap; head = ${await head(op, PA, 't1')}, max(pos) = ${(await q(op, "SELECT max(thread_seq) m FROM pos WHERE thread_key='t1'"))[0].m})`);
  // new thread, two sessions at once
  const f1 = await newEvent(op, PA, 't-new'), f2 = await newEvent(op, PA, 't-new');
  await a.query('BEGIN'); await b.query('BEGIN');
  const na = (await insRev(a, PA, f1, 1))[0].id;
  const pnb = timed(async () => (await insRev(b, PA, f2, 1))[0].id);
  await sleep(300); await a.query('COMMIT');
  const nb = await pnb; await b.query('COMMIT');
  log(`2e brand-new thread (no counter row), two sessions: A seq ${await seqOf(op, na)}, B waited ${nb.ms} ms and got seq ${nb.err ?? await seqOf(op, nb.v)}`);
  // different threads do not block
  await a.query('BEGIN');
  await insRev(a, PA, e1, 200);
  const other = await timed(() => insRev(b, PA, e3, 1));
  log(`2f other thread of the same project while t1 is held: insert took ${other.ms} ms, err=${other.err ?? 'none'}`);
  // a different project row: the FK lock on projects does not make inserts of one project wait for each other either
  await a.query('COMMIT');
  // REPEATABLE READ
  await a.query('BEGIN'); await insRev(a, PA, e1, 300);
  await b.query('BEGIN ISOLATION LEVEL REPEATABLE READ'); await q(b, 'SELECT 1');
  const prr = timed(() => insRev(b, PA, e2, 300));
  await sleep(200); await a.query('COMMIT');
  const rr = await prr; await b.query('ROLLBACK');
  log(`2g REPEATABLE READ session whose snapshot predates A's commit: its insert ended after ${rr.ms} ms with ${rr.err ?? 'no error (!)'}`);
  // lock_timeout cap
  await a.query('BEGIN'); await insRev(a, PA, e1, 400);
  await q(b, "SET lock_timeout = '1234ms'");
  const cap = await timed(() => insRev(b, PA, e2, 400));
  log(`2h holder left open: the second insert of the thread failed with ${cap.err} after ${cap.ms} ms; session lock_timeout afterwards = ${(await q(b, 'SHOW lock_timeout'))[0].lock_timeout}`);
  await q(b, 'RESET lock_timeout'); await a.query('ROLLBACK');

  log('\n== 3. a trigger and INSERT ... ON CONFLICT DO NOTHING (the replay of an existing revision, intake.ts:89-93) ==');
  await q(op, 'TRUNCATE fired');
  const key = randomUUID();
  const g1 = await insRev(op, PA, e3, 2, key); const h1 = await head(op, PA, 't2');
  const g2 = await insRev(op, PA, e3, 3, key); const h2 = await head(op, PA, 't2');
  log(`3a variant A (AFTER INSERT): first insert rows=${g1.length} head=${h1}; replay rows=${g2.length} head=${h2}; AFTER trigger fired ${(await q(op, "SELECT count(*) c FROM fired WHERE what='after rev'"))[0].c} time(s)`);
  await q(op, 'TRUNCATE fired');
  const insB = (no, k2) => q(op, 'INSERT INTO rev_b(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_event_id,revision_key) DO NOTHING RETURNING thread_seq', [T, PA, e3, no, k2]);
  const k2 = randomUUID();
  const b1 = await insB(1, k2), b2 = await insB(2, k2), b3 = await insB(3, randomUUID());
  const hb = (await q(op, "SELECT last_seq FROM heads_b WHERE thread_key='t2'"))[0].last_seq;
  log(`3b variant B (BEFORE INSERT): first insert seq=${b1[0]?.thread_seq}; replay rows=${b2.length}; next real insert seq=${b3[0]?.thread_seq}; counter=${hb}; max(seq in rows)=${(await q(op, 'SELECT max(thread_seq) m FROM rev_b'))[0].m}; BEFORE trigger fired ${(await q(op, "SELECT count(*) c FROM fired"))[0].c} times for 2 stored rows => the replay burned a number and took the counter lock`);
  // replay while the thread is held: does the replay wait?
  await a.query('BEGIN'); await insRev(a, PA, e3, 50);
  const replayA = await timed(() => insRev(b, PA, e3, 51, key));
  await q(a, 'INSERT INTO rev_b(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES($1,$2,$3,60,$4)', [T, PA, e3, randomUUID()]);
  await q(b, "SET lock_timeout = '700ms'");
  const replayB = await timed(() => q(b, 'INSERT INTO rev_b(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES($1,$2,$3,61,$4) ON CONFLICT(source_event_id,revision_key) DO NOTHING', [T, PA, e3, k2]));
  await q(b, 'RESET lock_timeout'); await a.query('ROLLBACK');
  log(`3c replay while another session holds the thread: variant A returned in ${replayA.ms} ms (rows=${replayA.v?.length}, no wait); variant B ended with ${replayB.err ?? 'ok'} after ${replayB.ms} ms (it waits for the counter)`);

  log('\n== 4. confirm side: compare-and-set in an AFTER INSERT trigger of the decision table ==');
  const cT = 't-confirm'; const ce = await newEvent(op, PA, cT); await insRev(op, PA, ce, 1);
  const cand = (await q(op, 'INSERT INTO cand(tenant_id,project_id,chat_id,thread_key) VALUES($1,$2,$3,$4) RETURNING id', [T, PA, '-100', cT]))[0].id;
  const insDec = (c, seq, mode = 'FOR NO KEY UPDATE', result = 'confirmed') => q(c, 'INSERT INTO dec(tenant_id,project_id,cand_id,result,subject_thread_seq,mode) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [T, PA, cand, result, seq, mode]);
  let n = 2;
  for (const mode of ['FOR NO KEY UPDATE', 'FOR SHARE', 'FOR KEY SHARE', 'FOR UPDATE']) {
    const base = await head(op, PA, cT);
    // (i) intake in flight first
    await a.query('BEGIN'); await insRev(a, PA, ce, n++);
    await b.query('BEGIN');
    const pd = timed(() => insDec(b, base, mode));
    await sleep(300); await a.query('COMMIT');
    const d1 = await pd; await b.query(d1.err ? 'ROLLBACK' : 'COMMIT');
    // (ii) decision first
    const base2 = await head(op, PA, cT);
    await a.query('BEGIN'); const d2 = await timed(() => insDec(a, base2, mode));
    await b.query('BEGIN');
    const pi = timed(() => insRev(b, PA, ce, n++));
    await sleep(300); const before = await head(r, PA, cT); await a.query('COMMIT');
    const i2 = await pi; await b.query('COMMIT');
    log(`4 ${mode}: (i) intake open with a new number, decision carrying the old position ${base}: decision ended after ${d1.ms} ms with ${d1.err ?? 'STORED (gap)'}; (ii) decision holds first (${d2.err ?? 'stored'}): intake insert took ${i2.ms} ms (${i2.ms >= 250 ? 'waited for the decision to commit' : 'DID NOT WAIT => it commits inside the decision transaction'}), head seen meanwhile ${before}`);
  }
  // single statement FOR NO KEY UPDATE re-reads the row after the wait
  const base3 = await head(op, PA, cT);
  await a.query('BEGIN'); await insRev(a, PA, ce, n++);
  const pl = timed(() => q(b, "SELECT last_seq FROM heads WHERE thread_key=$1 FOR NO KEY UPDATE", [cT]));
  await sleep(200); await a.query('COMMIT');
  const l = await pl;
  log(`4b one locking statement that waited ${l.ms} ms returned last_seq=${l.v[0].last_seq} (before the wait it was ${base3}): the locked row is re-read after the wait`);
  // a rejection takes no thread lock
  await a.query('BEGIN'); await insRev(a, PA, ce, n++);
  const rej = await timed(() => insDec(b, null, 'FOR NO KEY UPDATE', 'rejected'));
  await a.query('COMMIT');
  log(`4c a rejected decision while an intake of the thread is open: ${rej.err ?? 'stored'} after ${rej.ms} ms`);
  // lock order and deadlock probes
  const base4 = await head(op, PA, cT);
  await a.query('BEGIN'); const evOpen = await newEvent(a, PA, cT); await insRev(a, PA, evOpen, 1);          // intake: FK KEY SHARE on project, then thread
  await b.query('BEGIN');
  const pd2 = timed(() => insDec(b, base4));                                                                    // decision: project NO KEY UPDATE (BEFORE), then thread (AFTER)
  await sleep(200);
  const more = await timed(() => q(a, 'INSERT INTO mappings(tenant_id,project_id) VALUES($1,$2)', [T, PA]));   // intake goes on to insert a row referencing the project (FK KEY SHARE) while B holds NO KEY UPDATE on it
  await a.query('COMMIT'); const d4 = await pd2; await b.query('ROLLBACK');
  log(`4d intake (FK KEY SHARE on the project, then the thread lock) against a decision (project FOR NO KEY UPDATE, then the thread lock): the intake's next FK insert took ${more.ms} ms (err=${more.err ?? 'none'}); the decision ended with ${d4.err} after ${d4.ms} ms; no 40P01`);
  // two threads in opposite order inside raw multi-statement transactions: a real cycle
  const o1 = await newEvent(op, PA, 't-x'), o2 = await newEvent(op, PA, 't-y'); await insRev(op, PA, o1, 1); await insRev(op, PA, o2, 1);
  await a.query('BEGIN'); await b.query('BEGIN');
  await insRev(a, PA, o1, 2); await insRev(b, PA, o2, 2);
  const pa2 = timed(() => insRev(a, PA, o2, 3)); await sleep(100);
  const pb2 = await timed(() => insRev(b, PA, o1, 3));
  const ra2 = await pa2; await a.query(ra2.err ? 'ROLLBACK' : 'COMMIT'); await b.query(pb2.err ? 'ROLLBACK' : 'COMMIT');
  log(`4e two raw transactions that each write two threads in opposite order: A ${ra2.err ?? 'ok'} (${ra2.ms} ms), B ${pb2.err ?? 'ok'} (${pb2.ms} ms) — the service writes one revision per transaction and cannot build this`);
  // starvation probe: overlapping short decisions with FOR SHARE vs an intake
  for (const mode of ['FOR SHARE', 'FOR NO KEY UPDATE']) {
    let stop = false, done = 0;
    const worker = async () => { const c = await open(); while (!stop) { try { await c.query('BEGIN'); await insDec(c, await head(c, PA, cT), mode); await sleep(150); await c.query('ROLLBACK'); done++; } catch { await c.query('ROLLBACK').catch(() => {}); } } await c.end(); };
    const ws = [worker(), (async () => { await sleep(50); await worker(); })(), (async () => { await sleep(100); await worker(); })()];
    await sleep(300);
    await q(b, "SET lock_timeout = '0'"); await q(b, "SET statement_timeout = '8s'");
    const st = await timed(async () => { await b.query('BEGIN'); try { return await insRev(b, PA, ce, n++); } finally { await b.query('COMMIT').catch(() => b.query('ROLLBACK')); } });
    stop = true; await Promise.all(ws); await b.query('ROLLBACK').catch(() => {});
    log(`4f three sessions keep overlapping 150 ms decisions with ${mode}: an intake insert of the thread (function cap 5s, statement cap 8s) ended after ${st.ms} ms with ${st.err ?? 'ok'}; ${done} decision transactions ran meanwhile`);
    await q(b, 'RESET statement_timeout'); await q(b, 'RESET lock_timeout');
  }

  log('\n== 5. who can take the thread lock ==');
  await op.query(`GRANT USAGE ON SCHEMA oq53_probe TO libetech_runtime, libetech_intake, libetech_ai;
    GRANT SELECT ON heads, pos, ev, rev, cand TO libetech_runtime; GRANT SELECT ON ev, rev TO libetech_intake;
    GRANT INSERT ON ev, rev TO libetech_intake; GRANT SELECT ON rev_b, ev TO libetech_intake; GRANT INSERT ON rev_b TO libetech_intake;
    ALTER TABLE rev ENABLE ROW LEVEL SECURITY; ALTER TABLE rev FORCE ROW LEVEL SECURITY; ALTER TABLE rev_b ENABLE ROW LEVEL SECURITY; ALTER TABLE rev_b FORCE ROW LEVEL SECURITY;
    ALTER TABLE heads ENABLE ROW LEVEL SECURITY; ALTER TABLE heads FORCE ROW LEVEL SECURITY; ALTER TABLE pos ENABLE ROW LEVEL SECURITY; ALTER TABLE pos FORCE ROW LEVEL SECURITY;
    CREATE POLICY runtime_select ON heads FOR SELECT TO libetech_runtime USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
    CREATE POLICY runtime_select ON pos FOR SELECT TO libetech_runtime USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
    CREATE POLICY intake_select ON rev FOR SELECT TO libetech_intake USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
    CREATE POLICY intake_insert ON rev FOR INSERT TO libetech_intake WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
    CREATE POLICY intake_select ON rev_b FOR SELECT TO libetech_intake USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
    CREATE POLICY intake_insert ON rev_b FOR INSERT TO libetech_intake WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));`);
  const roles = (await q(op, "SELECT rolname FROM pg_roles WHERE rolname LIKE 'libetech%' ORDER BY 1")).map(x => x.rolname);
  const res = {};
  for (const role of roles) {
    res[role] = [];
    for (const mode of ['FOR KEY SHARE', 'FOR SHARE', 'FOR NO KEY UPDATE', 'FOR UPDATE']) {
      await b.query('BEGIN');
      try {
        await b.query(`SET LOCAL ROLE ${role}`);
        await q(b, "SELECT set_config('app.tenant_id',$1,true), set_config('app.project_ids',$2,true)", [T, PA]);
        await q(b, `SELECT last_seq FROM oq53_probe.heads WHERE thread_key='t1' ${mode}`); res[role].push('LOCKED');
      } catch (e) { res[role].push(e.code); }
      await b.query('ROLLBACK');
    }
  }
  log('5a SELECT ... FOR <mode> on the counter table under each role (KEY SHARE, SHARE, NO KEY UPDATE, UPDATE); libetech_runtime holds SELECT and a SELECT policy, the others hold nothing:');
  for (const [k, v] of Object.entries(res)) log(`   ${k}: ${v.join(' ')}`);
  for (const role of roles) {
    await b.query('BEGIN');
    let v; try { await b.query(`SET LOCAL ROLE ${role}`); await q(b, 'SELECT oq53_probe.rev_position()'); v = 'called'; } catch (e) { v = e.code; }
    await b.query('ROLLBACK'); res[role] = v;
  }
  log('5b calling the trigger function directly: ' + Object.entries(res).map(([k, v]) => `${k}=${v}`).join(' '));
  // the web login itself
  const web = await open(URL_WEB).catch(e => null);
  if (web) {
    const w = [];
    for (const stmt of ["SELECT last_seq FROM oq53_probe.heads FOR NO KEY UPDATE", "INSERT INTO oq53_probe.rev(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,'k')"]) {
      try { await web.query(stmt); w.push('ok'); } catch (e) { w.push(e.code); }
    }
    log(`5c login libetech_web, no SET ROLE: lock the counter => ${w[0]}; insert a revision => ${w[1]}`);
    await web.end();
  }
  // intake role scoped to project A writes a revision of project B's thread: BEFORE vs AFTER trigger relative to row-level security
  const eB = await newEvent(op, PB, 't-b'); await insRev(op, PB, eB, 1);
  await q(op, 'INSERT INTO rev_b(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES($1,$2,$3,1,$4)', [T, PB, eB, randomUUID()]);
  await a.query('BEGIN'); await insRev(a, PB, eB, 2); await q(a, 'INSERT INTO rev_b(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES($1,$2,$3,2,$4)', [T, PB, eB, randomUUID()]);  // an open intake of project B holds both counters
  const asIntake = async (table) => { await b.query('BEGIN'); await b.query('SET LOCAL ROLE libetech_intake'); await q(b, "SELECT set_config('app.tenant_id',$1,true), set_config('app.project_ids',$2,true)", [T, PA]); await q(b, "SET LOCAL lock_timeout = '1500ms'");
    const x = await timed(() => q(b, `INSERT INTO oq53_probe.${table}(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES($1,$2,$3,3,$4)`, [T, PB, eB, randomUUID()])); await b.query('ROLLBACK'); return x; };
  const oa = await asIntake('rev'), ob = await asIntake('rev_b');
  await a.query('ROLLBACK');
  await b.query('BEGIN'); await b.query('SET LOCAL ROLE libetech_intake'); await q(b, "SELECT set_config('app.tenant_id',$1,true), set_config('app.project_ids',$2,true)", [T, PA]);
  const free = await timed(() => q(b, `INSERT INTO oq53_probe.rev_b(tenant_id,project_id,source_event_id,revision_no,revision_key) VALUES($1,$2,$3,3,$4)`, [T, PB, eB, randomUUID()])); await b.query('ROLLBACK');
  log(`5d intake role scoped to project A inserts a revision into a thread of project B while B's thread is held by an open transaction:`);
  log(`   AFTER trigger (variant A): ${oa.err} after ${oa.ms} ms — refused by row-level security before the trigger runs; no lock taken, no wait`);
  log(`   BEFORE trigger (variant B): ${ob.err} after ${ob.ms} ms while held, ${free.err} after ${free.ms} ms when free — the trigger runs BEFORE the WITH CHECK: the out-of-scope role waits on (and would take) the lock of a thread it may not write, and learns from the wait that the thread is being written`);
  const heldAfter = await timed(() => q(op, "SELECT 1 FROM heads WHERE project_id=$1 FOR NO KEY UPDATE NOWAIT", [PB]));
  log(`   after the refused AFTER-variant insert rolled back nothing holds B's counter: NOWAIT lock => ${heldAfter.err ?? 'taken'}`);
  // the decision trigger: AFTER INSERT runs after WITH CHECK too
  await op.query(`GRANT SELECT, INSERT ON dec TO libetech_runtime; ALTER TABLE dec ENABLE ROW LEVEL SECURITY; ALTER TABLE dec FORCE ROW LEVEL SECURITY;
    CREATE POLICY runtime_select ON dec FOR SELECT TO libetech_runtime USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
    CREATE POLICY runtime_insert ON dec FOR INSERT TO libetech_runtime WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) AND decided_by = nullif(current_setting('app.person_id',true),'')::uuid);
    DROP TRIGGER dec_a_project_lock ON dec;`);
  const candB = (await q(op, 'INSERT INTO cand(tenant_id,project_id,chat_id,thread_key) VALUES($1,$2,$3,$4) RETURNING id', [T, PB, '-100', 't-b']))[0].id;
  await a.query('BEGIN'); await insRev(a, PB, eB, 5);
  await b.query('BEGIN'); await b.query('SET LOCAL ROLE libetech_runtime'); await q(b, "SELECT set_config('app.tenant_id',$1,true), set_config('app.project_ids',$2,true), set_config('app.person_id',$3,true)", [T, PA, randomUUID()]);
  const od = await timed(() => q(b, "INSERT INTO oq53_probe.dec(tenant_id,project_id,cand_id,result,subject_thread_seq,decided_by) VALUES($1,$2,$3,'confirmed',1,$4)", [T, PB, candB, randomUUID()]));
  await b.query('ROLLBACK'); await a.query('ROLLBACK');
  log(`5e runtime role scoped to project A writes a confirmed decision for a candidate of project B while B's thread is held: ${od.err} after ${od.ms} ms (AFTER INSERT trigger: row-level security answers first, no lock, no wait)`);

  log('\n== 6. migration on tables that already hold rows ==');
  await op.query(`CREATE TABLE big_ev(LIKE ev INCLUDING DEFAULTS, PRIMARY KEY(id)); CREATE TABLE big_rev(LIKE rev INCLUDING DEFAULTS, PRIMARY KEY(id), UNIQUE(source_event_id,revision_no));
    CREATE FUNCTION reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Append-only history cannot be updated or deleted'; END $$;
    CREATE TRIGGER big_rev_immutable BEFORE UPDATE OR DELETE ON big_rev FOR EACH ROW EXECUTE FUNCTION reject();
    INSERT INTO big_ev(id,tenant_id,project_id,chat_id,thread_key,message_id,created_at)
      SELECT gen_random_uuid(),'${T}','${PA}','-100','th-'||(g%4000),g::text, now() - (60000-g) * interval '1 second' FROM generate_series(1,40000) g;
    INSERT INTO big_rev(tenant_id,project_id,source_event_id,revision_no,revision_key,created_at)
      SELECT e.tenant_id,e.project_id,e.id,k,md5(e.id::text||k),e.created_at + (k-1) * interval '90 minutes' FROM big_ev e, generate_series(1,2) k WHERE k=1 OR e.message_id::int % 2 = 0;
    ANALYZE big_ev; ANALYZE big_rev;`);
  const cnt = (await q(op, 'SELECT (SELECT count(*) FROM big_ev) e, (SELECT count(*) FROM big_rev) r, (SELECT count(DISTINCT thread_key) FROM big_ev) t'))[0];
  log(`data: ${cnt.e} messages, ${cnt.r} revisions, ${cnt.t} threads`);
  const node = async t => (await q(op, "SELECT pg_relation_filenode($1::regclass) f, pg_relation_size($1::regclass) s", [`oq53_probe.${t}`]))[0];
  // (S) side table: no column on the old table
  const n0 = await node('big_rev');
  let t0 = Date.now();
  await op.query(`BEGIN; SET LOCAL lock_timeout='5s';
    CREATE TABLE big_heads(LIKE heads INCLUDING DEFAULTS, PRIMARY KEY(id), UNIQUE(tenant_id,project_id,chat_id,thread_key));
    CREATE TABLE big_pos(LIKE pos INCLUDING DEFAULTS, PRIMARY KEY(id), UNIQUE(revision_id), UNIQUE(tenant_id,project_id,chat_id,thread_key,thread_seq));
    LOCK TABLE big_rev IN SHARE ROW EXCLUSIVE MODE;
    INSERT INTO big_pos(tenant_id,project_id,source_event_id,revision_id,chat_id,thread_key,thread_seq)
      SELECT r.tenant_id,r.project_id,r.source_event_id,r.id,e.chat_id,e.thread_key,
             row_number() OVER (PARTITION BY r.tenant_id,r.project_id,e.chat_id,e.thread_key ORDER BY r.created_at, r.id)
      FROM big_rev r JOIN big_ev e ON e.id=r.source_event_id;
    INSERT INTO big_heads(tenant_id,project_id,chat_id,thread_key,last_seq) SELECT tenant_id,project_id,chat_id,thread_key,max(thread_seq) FROM big_pos GROUP BY 1,2,3,4;
    COMMIT;`);
  const tS = Date.now() - t0; const n1b = await node('big_rev');
  const chk = (await q(op, `SELECT (SELECT count(*) FROM big_pos) p, (SELECT count(*) FROM big_heads) h,
     (SELECT count(*) FROM big_heads h WHERE h.last_seq <> (SELECT count(*) FROM big_pos p WHERE p.thread_key=h.thread_key)) bad`))[0];
  log(`6a side table (create two tables + backfill by INSERT ... SELECT, the old table locked SHARE ROW EXCLUSIVE for the whole transaction): ${tS} ms; positions=${chk.p}, counters=${chk.h}, counters that disagree with their thread=${chk.bad}; old table file node ${n0.f} -> ${n1b.f}, size ${n0.s} -> ${n1b.s} bytes (untouched)`);
  // blocked insert while the migration transaction is open
  await a.query('BEGIN'); await a.query('LOCK TABLE big_rev IN SHARE ROW EXCLUSIVE MODE');
  await q(b, "SET lock_timeout='800ms'");
  const blocked = await timed(() => q(b, "INSERT INTO big_rev(tenant_id,project_id,source_event_id,revision_no,revision_key) SELECT tenant_id,project_id,id,9,'k9' FROM big_ev LIMIT 1"));
  const readOk = await timed(() => q(b, 'SELECT count(*) FROM big_rev'));
  await a.query('ROLLBACK'); await q(b, 'RESET lock_timeout');
  log(`6b while that lock is held: an insert into the old table => ${blocked.err} after ${blocked.ms} ms (it waits for the migration); a SELECT => ${readOk.err ?? 'ok'} in ${readOk.ms} ms`);
  // (C) column on the old table
  t0 = Date.now();
  await op.query(`BEGIN; SET LOCAL lock_timeout='5s'; ALTER TABLE big_rev ADD COLUMN thread_seq bigint; COMMIT;`);
  const tAdd = Date.now() - t0; const n2b = await node('big_rev');
  const upd = await timed(() => op.query(`UPDATE big_rev SET thread_seq = 1 WHERE id = (SELECT id FROM big_rev LIMIT 1)`));
  t0 = Date.now();
  await op.query(`BEGIN; SET LOCAL lock_timeout='5s'; ALTER TABLE big_rev DISABLE TRIGGER big_rev_immutable;
    UPDATE big_rev r SET thread_seq = p.thread_seq FROM big_pos p WHERE p.revision_id = r.id;
    ALTER TABLE big_rev ENABLE TRIGGER big_rev_immutable; COMMIT;`);
  const tUpd = Date.now() - t0; const n3b = await node('big_rev');
  t0 = Date.now();
  await op.query(`BEGIN; SET LOCAL lock_timeout='5s'; ALTER TABLE big_rev ALTER COLUMN thread_seq SET NOT NULL; COMMIT;`);
  const tNN = Date.now() - t0;
  log(`6c column on the old table: ADD COLUMN (nullable, no default) ${tAdd} ms, file node ${n1b.f} -> ${n2b.f} (no rewrite); a backfill UPDATE with the immutability trigger in place => ${upd.err ?? 'ok'}; with the trigger disabled inside the migration: ${tUpd} ms, table size ${n2b.s} -> ${n3b.s} bytes (every row written again); SET NOT NULL ${tNN} ms (full scan under ACCESS EXCLUSIVE)`);
  // rollback of the side-table variant
  t0 = Date.now();
  await op.query(`BEGIN; SET LOCAL lock_timeout='5s'; DROP TABLE big_pos; DROP TABLE big_heads; COMMIT;`);
  log(`6d rollback of the side-table variant (drop two tables): ${Date.now() - t0} ms; old table rows = ${(await q(op, 'SELECT count(*) c FROM big_rev'))[0].c}`);
  // nullable column on the decision table
  await op.query('INSERT INTO dec(tenant_id,project_id,cand_id,result) SELECT $1,$2,$3,$4 FROM generate_series(1,20000)', [T, PA, cand, 'rejected']);
  const d0 = await node('dec'); t0 = Date.now();
  await op.query(`BEGIN; SET LOCAL lock_timeout='5s'; ALTER TABLE dec ADD COLUMN IF NOT EXISTS subject_thread_seq2 bigint; COMMIT;`);
  const d1b = await node('dec');
  log(`6e ADD COLUMN IF NOT EXISTS (nullable bigint) on a decision table of 20000 rows: ${Date.now() - t0} ms, file node ${d0.f} -> ${d1b.f}`);

  await op.query('DROP SCHEMA oq53_probe CASCADE');
  log('\nschema oq53_probe dropped; objects left in it: ' + (await q(op, "SELECT count(*) c FROM pg_namespace WHERE nspname='oq53_probe'"))[0].c);
  for (const c of [a, b, r, op]) await c.end();
  require('node:fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
}
main().catch(async e => { console.error('PROBE FAILED', e.code, e.message, e.where || ''); try { const c = await open(); await c.query('DROP SCHEMA IF EXISTS oq53_probe CASCADE'); await c.end(); } catch {} process.exit(1); });
