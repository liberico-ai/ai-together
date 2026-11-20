import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {Client} from 'pg';
import {PGlite} from '@electric-sql/pglite';
import {assertIsolated,native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {ids} from '../src/server/identities';
import {chatSales} from './slice2-fixtures';

// deploy/pre-023-check.sql (N3 of docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md): the count that is made BEFORE migration 023 is applied to a database that serves.
// It reads and writes nothing, and it answers what 023 itself would answer: its four refusals (not a superuser, more unnumbered revisions than the cap, an undecided candidate draft while
// revisions have no number, a login that can act as libetech_ai connected) as codes, and the counts behind them. Each case that says "blocked" because of 02, 03 or 04 also applies 023 and shows
// that it refuses for the same reason; each case that says "ready" applies 023 again (a second run on an applied database, the first run on a rolled-back one) and shows that it runs. The file is
// two DO blocks and a SELECT in one session, as psql runs it.
const file=(p:string)=>readFile(path.join(process.cwd(),p),'utf8');
const forwardSql=()=>file('migrations/023_thread_order.sql');
const rollbackSql=()=>file('migrations/rollback/023_thread_order.sql');
const checkSql=()=>file('deploy/pre-023-check.sql');
const hex=(c:string)=>c.repeat(64);
const COMMENT_ONLY=/^(\s*--[^\n]*\n?)*\s*$/;
/** The statements of the file at column 0: DO, DO, SELECT. Comment-only chunks (the header) are not statements. */
const statements=(sql:string)=>sql.split(/\n(?=SET |DO \$|SELECT )/).filter(p=>!COMMENT_ONLY.test(p));
/** The version of the newest migration, and of the newest below 023 (what a rolled-back database says). Read from the files: the next migration must not break a case. */
const versions=async()=>(await readdir(path.join(process.cwd(),'migrations'))).filter(f=>/^\d+.*\.sql$/.test(f)).map(f=>Number(f.match(/^\d+/)![0])).sort((a,b)=>a-b);
const latest=async()=>String((await versions()).at(-1)).padStart(3,'0');
const below023=async()=>String((await versions()).filter(v=>v<23).at(-1)).padStart(3,'0');

let h:Harness;
let needsForward=false;
beforeEach(async()=>{needsForward=false;h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{
  await h.exec('ROLLBACK').catch(()=>{});
  try {if(needsForward) await h.exec(await forwardSql());} finally {await h.reset();await h.close();}
});
const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;

const eventSql=`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
  VALUES($1,$2,$3,'telegram_gateway',80,$4,$5,$6,'actor-1',now(),false,false,$7,$7) RETURNING id`;
const REV_COLS='tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode';
const draftSql=`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
  VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,1,$4,$3,$3,$5) RETURNING id`;
let serial=9100;
/** n revisions as raw rows: with 023 rolled back none carries a number; with 023 applied the trigger numbers them. */
async function rawRevisions(n:number){
  for(let i=0;i<n;i++){
    const no=serial++;
    const ev=(await q<{id:string}>(eventSql,[ids.tenant,ids.sales,'gw-'+no,chatSales,String(no),'m:'+no,randomUUID()]))[0].id;
    await q(`INSERT INTO source_event_revisions(${REV_COLS}) VALUES($1,$2,$3,1,$4,$5,'pointer_only')`,[ids.tenant,ids.sales,ev,hex('1'),hex('b')]);
  }
}
const undecidedDraft=async()=>(await q<{id:string}>(draftSql,[ids.tenant,ids.sales,randomUUID(),hex('c'),'pre-023-draft-'+randomUUID()]))[0].id;
const decide=(draftId:string)=>q(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,decided_by,command_key,request_id,trace_id)
  VALUES($1,$2,$3,$4,'rejected','Lý do đủ dài',$5,'pre-023-key',$6,$6)`,[ids.tenant,ids.sales,draftId,hex('c'),pm.id,randomUUID()]);

type Answer={pre_023:string;reasons:string[];warnings:string[];revisions:number|null;revisions_without_number:number|null;cap:number|null;undecided_candidate_drafts:number|null;
  ai_logins_connected:number|null;sessions_with_conflicting_locks:number|null;statement_timeout_ms:number;lock_timeout_ms:number;idle_in_transaction_timeout_ms:number;has_023:boolean|null;migrations_max:string|null};
/** The file as one session, the way psql -f runs it: the DO that sets the nonce, the DO that does the work, then the row that says it finished. */
async function runFile(asRole?:string,settings:Record<string,string>={}):Promise<string>{
  const parts=statements(await checkSql());
  expect(parts.map(p=>p.split(/\s/)[0]),'DO, DO, SELECT').toEqual(['DO','DO','SELECT']);
  const rows=await h.operator.transaction(async tx=>{
    for(const [k,v] of Object.entries(settings)) await tx.query('SELECT set_config($1,$2,true)',[k,v]);
    if(asRole) await tx.query(`SET LOCAL ROLE ${asRole}`);
    await tx.query(parts[0]);await tx.query(parts[1]);
    return (await tx.query<{result:string}>(parts[2])).rows;
  });
  expect(rows,'one answer row').toHaveLength(1);
  return rows[0].result;
}
const check=async(asRole?:string,settings:Record<string,string>={}):Promise<Answer>=>JSON.parse(await runFile(asRole,settings));
async function rolledBack<T>(fn:()=>Promise<T>):Promise<T>{
  needsForward=true;
  await h.exec(await rollbackSql());
  return fn();
}
const positions=async()=>(await q<{n:number}>('SELECT count(*)::int n FROM source_revision_positions'))[0].n;

describe('the count before 023 answers what 023 would answer',()=>{
  test('C1 a database from before 023 with four old revisions: ready, with the counts, and 023 then runs and numbers all four',async()=>rolledBack(async()=>{
    await rawRevisions(4);
    const a=await check();
    expect(a).toMatchObject({pre_023:'ready',reasons:[],warnings:[],revisions:4,revisions_without_number:4,cap:250000,undecided_candidate_drafts:0,ai_logins_connected:0,has_023:false});
    expect(a.migrations_max).toBe(await below023());
    await h.exec(await forwardSql());
    expect(await positions()).toBe(4);
  }));
  test('C2 after 023 the revisions a trigger numbered are counted as numbered: ready, nothing to number, and applying 023 again runs',async()=>{
    await rawRevisions(2);
    const a=await check();
    expect(a).toMatchObject({pre_023:'ready',reasons:[],revisions:2,revisions_without_number:0,has_023:true});
    expect(a.migrations_max).toBe(await latest());
    await h.exec(await forwardSql());
    expect(await positions()).toBe(2);
  });
  test('C3 more unnumbered revisions than the cap: blocked with PRE-023-02 and the cap it read, and 023 refuses with its own words; at the cap it is ready and 023 runs',async()=>rolledBack(async()=>{
    await rawRevisions(4);
    expect(await check(undefined,{'libetech.thread_order_max_rows':'3'})).toMatchObject({pre_023:'blocked',reasons:['PRE-023-02'],revisions_without_number:4,cap:3});
    await expect(h.exec("SET LOCAL libetech.thread_order_max_rows = '3';\n"+await forwardSql())).rejects.toThrow(/more revisions without a thread number/);
    await h.exec('ROLLBACK').catch(()=>{});
    expect(await check(undefined,{'libetech.thread_order_max_rows':'4'})).toMatchObject({pre_023:'ready',reasons:[],cap:4});
    await h.exec("SET LOCAL libetech.thread_order_max_rows = '4';\n"+await forwardSql());
    expect(await positions()).toBe(4);
  }));
  test('C4 an undecided candidate draft while revisions have no number: blocked with PRE-023-03, 023 refuses; once decided it is ready and 023 runs; with every revision numbered it is not a reason',async()=>rolledBack(async()=>{
    await rawRevisions(2);
    const draft=await undecidedDraft();
    expect(await check()).toMatchObject({pre_023:'blocked',reasons:['PRE-023-03'],undecided_candidate_drafts:1,revisions_without_number:2});
    await expect(h.exec(await forwardSql())).rejects.toThrow(/no person has decided/);
    await h.exec('ROLLBACK').catch(()=>{});
    await decide(draft);
    expect(await check()).toMatchObject({pre_023:'ready',reasons:[],undecided_candidate_drafts:0});
    await h.exec(await forwardSql());
    await undecidedDraft();
    expect(await check()).toMatchObject({pre_023:'ready',reasons:[],undecided_candidate_drafts:1,revisions_without_number:0});
    await h.exec(await forwardSql());
  }));
  test('C5 not a superuser: blocked with PRE-023-01 and nothing else read, not even a cap that is not a number (a login that cannot apply 023 reads only what it was given)',async()=>{
    const a=await check('libetech_runtime',{'libetech.thread_order_max_rows':'not-a-number'});
    expect(a).toMatchObject({pre_023:'blocked',reasons:['PRE-023-01'],revisions:null,revisions_without_number:null,cap:null,undecided_candidate_drafts:null,ai_logins_connected:null,sessions_with_conflicting_locks:null});
  });
  test('C6 the file reads and writes nothing: it runs in a read-only transaction, and carries no statement that writes',async()=>{
    const parts=statements(await checkSql());
    const rows=await h.operator.transaction(async tx=>{
      await tx.query('SET TRANSACTION READ ONLY');
      await tx.query(parts[0]);await tx.query(parts[1]);
      return (await tx.query<{result:string}>(parts[2])).rows;
    });
    expect(JSON.parse(rows[0].result)).toMatchObject({pre_023:'ready'});
    const code=(await checkSql()).split('\n').filter(l=>!/^\s*--/.test(l)).join('\n');
    expect(code).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|TRUNCATE|DROP\s+|CREATE\s+|ALTER\s+|LOCK\s+TABLE|GRANT\s+|REVOKE\s+)/i);
  });
  test('C7 the answer holds counts, booleans and fixed codes only: no id, chat, thread key, role or database name',async()=>rolledBack(async()=>{
    await rawRevisions(2);
    const raw=await runFile();
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['ai_logins_connected','cap','has_023','idle_in_transaction_timeout_ms','lock_timeout_ms','migrations_max','pre_023','reasons','revisions','revisions_without_number',
      'sessions_with_conflicting_locks','statement_timeout_ms','undecided_candidate_drafts','warnings']);
    expect(raw).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(raw).not.toMatch(/libetech_|slice1|m:9|telegram/i);
  }));
  test('C8 a second run changes nothing and answers the same (the answer\'s timeouts are those of the session, which the case does not change)',async()=>{
    expect(await check()).toEqual(await check());
  });
  test('C9 the answer says the timeouts of the session that ran it, so the one that applies 023 is known: a session with statement_timeout 10 s says so',async()=>{
    expect(await check(undefined,{statement_timeout:'10s',idle_in_transaction_session_timeout:'30s'})).toMatchObject({statement_timeout_ms:10000,idle_in_transaction_timeout_ms:30000,lock_timeout_ms:0});
  });
  test('C10 a cap that is not a number, for a superuser: the file stops with PRE-023-99 and the SQLSTATE, and the message does not carry the value',async()=>{
    const e=await check(undefined,{'libetech.thread_order_max_rows':'secret-cap-value'}).then(()=>null,(err:Error)=>err);
    expect(e).not.toBeNull();
    expect(e!.message).toBe('PRE-023-99 unexpected error (SQLSTATE 22P02)');
  });
  test('C11 revisions that carry no number on a database that has 023 (a revision stored while the trigger was off): counted, ready, and 023 numbers it',async()=>{
    await rawRevisions(1);
    await h.exec('ALTER TABLE public.source_event_revisions DISABLE TRIGGER source_event_revisions_thread_position');
    try {await rawRevisions(1);} finally {await h.exec('ALTER TABLE public.source_event_revisions ENABLE ALWAYS TRIGGER source_event_revisions_thread_position');}
    expect(await check()).toMatchObject({pre_023:'ready',reasons:[],revisions:2,revisions_without_number:1,has_023:true});
    await h.exec(await forwardSql());
    expect(await positions()).toBe(2);
  });
  test('C12 the answer that stands in the session from an earlier run is not read as the answer of this one: the statement that answers needs the nonce of this run',async()=>{
    const parts=statements(await checkSql());
    // one session throughout (one transaction), so that the earlier run's answer is really in it
    const [first,second]=await h.operator.transaction(async tx=>{
      await tx.query(parts[0]);await tx.query(parts[1]);
      const first=(await tx.query<{result:string}>(parts[2])).rows;
      await tx.query(parts[0]);
      // the work block is not run again: the answer and the "done" of the earlier run are still in the session
      const second=(await tx.query<{result:string}>(parts[2])).rows;
      return [first,second];
    });
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
  });
});

describe('a database that is not at 023\'s starting point, and a session that is split',()=>{
  test('C13 an empty database: blocked with PRE-023-98 and no count; the work block alone, without the statement that sets the nonce, stops with PRE-023-97',async()=>{
    const pg=await PGlite.create();
    try {
      const parts=statements(await checkSql());
      const alone=await pg.query(parts[1]).then(()=>null,(e:Error)=>e);
      expect(alone?.message).toMatch(/^PRE-023-97 /);
      await pg.query(parts[0]);await pg.query(parts[1]);
      const rows=(await pg.query<{result:string}>(parts[2])).rows;
      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].result)).toMatchObject({pre_023:'blocked',reasons:['PRE-023-98'],revisions:null,revisions_without_number:null,has_023:false});
    } finally {await pg.close();}
  });
});

describe.skipIf(!native)('the count sees the other sessions of the database (native PostgreSQL)',()=>{
  const url=()=>{const u=process.env.SLICE1_TEST_DATABASE_URL as string;assertIsolated(u);return u;};
  test('C14 a login that can act as libetech_ai is connected: blocked with PRE-023-04, and 023 refuses; when it is gone, ready',async()=>{
    // roles are cluster-wide: a run that died between CREATE and DROP must not leave a member of libetech_ai for the next run (tests/z4-pointer-guard.test.ts asserts there is none)
    for(const r of await q<{rolname:string}>("SELECT rolname FROM pg_roles WHERE rolname LIKE 'pre023\\_ai\\_login\\_%'")) await h.exec(`DROP ROLE IF EXISTS ${r.rolname}`);
    const role='pre023_ai_login_'+randomUUID().slice(0,8),password=randomUUID();
    await h.exec(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER IN ROLE libetech_ai`);
    let ai:Client|undefined;
    try {
      const u=new URL(url());u.username=role;u.password=password;
      ai=new Client({connectionString:u.toString()});await ai.connect();
      expect(await check()).toMatchObject({pre_023:'blocked',reasons:['PRE-023-04'],ai_logins_connected:1});
      await expect(h.exec(await forwardSql())).rejects.toThrow(/login that can act as libetech_ai is connected/);
      await h.exec('ROLLBACK').catch(()=>{});
      await ai.end();ai=undefined;
      // the server notices the end of the session a moment later
      for(let i=0;i<50&&(await check()).ai_logins_connected;i++) await new Promise(r=>setTimeout(r,100));
      expect(await check()).toMatchObject({pre_023:'ready',reasons:[],ai_logins_connected:0});
      await h.exec(await forwardSql());
    } finally {
      if(ai) await ai.end().catch(()=>{});
      await h.exec(`DROP ROLE IF EXISTS ${role}`);
    }
  });
  test('C15 a session idle in a transaction that holds no conflicting lock is not a warning (it cannot make 023 wait); a writer in flight is, and 023 does wait for it',async()=>{
    const idle=new Client({connectionString:url()});await idle.connect();
    const writer=new Client({connectionString:url()});await writer.connect();
    try {
      await idle.query('BEGIN');await idle.query('SELECT 1');
      expect(await check()).toMatchObject({pre_023:'ready',warnings:[],sessions_with_conflicting_locks:0});
      await idle.query('ROLLBACK');
      // what an intake in flight holds on the revision table
      await writer.query('BEGIN');await writer.query('LOCK TABLE public.source_event_revisions IN ROW EXCLUSIVE MODE');
      expect(await check()).toMatchObject({pre_023:'ready',reasons:[],warnings:['PRE-023-W1'],sessions_with_conflicting_locks:1});
      const applying=h.exec(await forwardSql());
      await waitForBlocked(h,1);
      await writer.query('ROLLBACK');
      await applying;
      // a writer of the draft table, whose lock 023 asks for second, is counted too
      await writer.query('BEGIN');await writer.query('LOCK TABLE intelligence.ai_drafts IN ROW EXCLUSIVE MODE');
      expect(await check()).toMatchObject({pre_023:'ready',reasons:[],warnings:['PRE-023-W1'],sessions_with_conflicting_locks:1});
      await writer.query('ROLLBACK');
      expect(await check()).toMatchObject({warnings:[],sessions_with_conflicting_locks:0});
    } finally {
      await idle.query('ROLLBACK').catch(()=>{});await writer.query('ROLLBACK').catch(()=>{});
      await idle.end();await writer.end();
    }
  });
});
