import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {ids} from '../src/server/identities';
import {IntakeService} from '../src/server/intake';
import {threadFreshness} from '../src/server/source-text';
import {putBack,takeOffAbove} from './migration-stack';
import {bridgeConfig,chatSales,intakePrincipalId,messageEvent} from './slice2-fixtures';

// deploy/post-restore.sql (N4 and N12 of DELIVERY-016): the step that follows every restore. The cases run it as the harness runs everything else (PGlite, and native PostgreSQL when
// SLICE1_TEST_DATABASE_URL is set). A restore is imitated, not performed: pg_restore --disable-triggers ends with ENABLE TRIGGER ALL, which is what a case does to the numbering trigger
// (the real pg_dump / pg_restore are in restore-rehearsal.test.ts). The file is three statements in one transaction here as it is one session for psql: a DO block that does all the work,
// ANALYZE, and a SELECT that answers one JSON row only when the block has finished.
const file=(p:string)=>readFile(path.join(process.cwd(),p),'utf8');
const sqlText=()=>file('deploy/post-restore.sql');
const forwardSql=()=>file('migrations/023_thread_order.sql');
const rollbackSql=()=>file('migrations/rollback/023_thread_order.sql');
const hex=(c:string)=>c.repeat(64);
const SOURCES='[{"ref":"synthetic-source"}]';
const NUMBERING='source_event_revisions_thread_position',GUARD='draft_decisions_subject_order_guard';
const COMMENT_ONLY=/^(\s*--[^\n]*\n?)*\s*$/;
/** The statements of the file at column 0: SET, DO, ANALYZE, SELECT. Comment-only chunks (the header) are not statements. */
const statements=(sql:string)=>sql.split(/\n(?=SET |DO \$|ANALYZE;|SELECT )/).filter(p=>!COMMENT_ONLY.test(p));

let h:Harness;
let needsForward=false;
let taken:string[]=[];
let undo:string[]=[];
/** P4h and P4j set a default of `libetech.archive_kind` on the database and on two roles in it and undo it in afterEach; a process that died in between would leave it and turn every later case red with
 * POST-RESTORE-01 until someone reset it by hand. So every case starts by removing such a default (RESET of a setting that is not set is not an error). */
const CLEAR_KIND_DEFAULTS=`DO $$ DECLARE r text; BEGIN
  EXECUTE format('ALTER DATABASE %I RESET libetech.archive_kind', current_database());
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('libetech_runtime', session_user) LOOP
    EXECUTE format('ALTER ROLE %I IN DATABASE %I RESET libetech.archive_kind', r, current_database());
  END LOOP;
END $$`;
// 024 and everything above it sit on top of 023: the cases that roll 023 back need them off first (tests/migration-stack.ts), and they are put back after
beforeEach(async()=>{needsForward=false;undo=[];h=await openHarness();taken=await takeOffAbove(h,23);await h.exec(CLEAR_KIND_DEFAULTS);await h.reset();await seedSlice1(h);});
afterEach(async()=>{
  await h.exec('ROLLBACK').catch(()=>{});
  try{
    if(needsForward) await h.exec(await forwardSql());
    await putBack(h,taken);
    for(const sql of undo.reverse()) await h.exec(sql);
    // a case that ended before its own undo must not leave the shared database with a trigger off or at the wrong state
    await h.exec(`ALTER TABLE public.source_event_revisions ENABLE ALWAYS TRIGGER ${NUMBERING}`).catch(()=>{});
  }finally{await h.reset();await h.close();}
});

const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const svc=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!);
const states=async()=>Object.fromEntries((await q<{tgname:string;tgenabled:string}>(`SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('${NUMBERING}','${GUARD}')`)).map(r=>[r.tgname,r.tgenabled]));
const numbering=async()=>(await states())[NUMBERING];
const APP_SCHEMAS="('public','identity','analytics','intelligence')";
async function counts():Promise<Record<string,number>>{
  const tables=await q<{t:string}>(`SELECT n.nspname||'.'||c.relname t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN ${APP_SCHEMAS} ORDER BY 1`);
  const out:Record<string,number>={};
  for(const {t} of tables) out[t]=(await q<{n:number}>(`SELECT count(*)::int n FROM ${t}`))[0].n;
  return out;
}

type Outcome={ok:true;result:Record<string,unknown>}|{ok:false;error:string};
/**
 * The file as one session: the DO block, ANALYZE, then the row that says it finished. A failure rolls the whole transaction back, as it does for psql with ON_ERROR_STOP.
 * `kind` is what the installers hand the file first (`SET libetech.archive_kind = ...`): the word that restore-plan.py prints for the archive, `post-023` or `pre-023`. The file requires it.
 */
async function postRestore(asRole?:string,replica=false,kind:string|null='post-023'):Promise<Outcome>{
  const parts=statements(await sqlText());
  expect(parts.map(p=>p.split(/\s/)[0]),'SET, DO, ANALYZE, SELECT').toEqual(['SET','DO','ANALYZE;','SELECT']);
  try{
    const rows=await h.operator.transaction(async tx=>{
      if(asRole) await tx.query(`SET LOCAL ROLE ${asRole}`);
      if(replica) await tx.query('SET LOCAL session_replication_role = replica');
      if(kind!==null) await tx.query("SELECT set_config('libetech.archive_kind',$1,true)",[kind]);
      const found={path:(await tx.query<{search_path:string}>('SHOW search_path')).rows[0],lock:(await tx.query<{lock_timeout:string}>('SHOW lock_timeout')).rows[0]};
      await tx.query(parts[0]);await tx.query(parts[1]);
      // when a pool runs the text as one transaction, what follows the block must not run under the path and the lock timeout that the block pinned
      expect({path:(await tx.query('SHOW search_path')).rows[0],lock:(await tx.query('SHOW lock_timeout')).rows[0]},'the block leaves the session as it found it').toEqual(found);
      await tx.query(parts[2]);
      const answered=(await tx.query<{result:string}>(parts[3])).rows;
      // the probe's replica mode ended with the probe
      if(answered.length) expect((await tx.query<{r:string}>('SHOW session_replication_role')).rows[0]).toEqual({session_replication_role:'origin'});
      return answered;
    });
    if(rows.length!==1) return {ok:false,error:'no result row'};
    return {ok:true,result:JSON.parse(rows[0].result)};
  }catch(e){return {ok:false,error:(e as Error).message};}
}
const failsWith=async(code:string,asRole?:string,replica=false,kind:string|null='post-023')=>{
  const r=await postRestore(asRole,replica,kind);
  expect(r.ok,'the file must stop').toBe(false);
  expect(r.ok?'':r.error).toMatch(new RegExp('^'+code));
};
/** The text with which the file refuses (the whole of what an installer or a person is shown of it). */
const failsWithMessage=async(kind:string)=>{const r=await postRestore(undefined,false,kind);expect(r.ok,'the file must stop').toBe(false);return r.ok?'':r.error;};

// --- data, written as the service writes it, or raw where a case needs a state that the service never leaves ---
async function someThreads(){
  const root=messageEvent({});
  await svc().ingest(root);
  await svc().ingest(messageEvent({context:{replyToMessageId:root.context.messageId}}));
  await svc().ingest({...root,editedAt:new Date(1760009999000).toISOString(),contentHash:hex('b')});
  await svc().ingest(messageEvent({}));
  return {root,thread:'m:'+root.context.messageId};
}
let rawSeq=9000;
const eventSql=`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
  VALUES($1,$2,$3,'telegram_gateway',80,$4,$5,$6,'actor-1',now(),false,false,$7,$7) RETURNING id`;
const revSql=`INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode) VALUES($1,$2,$3,$4,$5,$6,'pointer_only') RETURNING id`;
const rawEvent=async()=>{const n=String(++rawSeq);return (await q<{id:string}>(eventSql,[ids.tenant,ids.sales,'gw-'+n,chatSales,n,'m:'+n,randomUUID()]))[0].id;};
/** The number that a revision written by a session with session_replication_role = replica gets; null when none. Always rolled back. */
async function replicaWrite():Promise<number|null>{
  let seen:number|null=null;
  await h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL session_replication_role = replica');
    const n=String(++rawSeq);
    const ev=(await tx.query<{id:string}>(eventSql,[ids.tenant,ids.sales,'gw-'+n,chatSales,n,'m:'+n,randomUUID()])).rows[0].id;
    const rev=(await tx.query<{id:string}>(revSql,[ids.tenant,ids.sales,ev,1,hex('1'),hex('a')])).rows[0].id;
    seen=(await tx.query<{s:number}>('SELECT thread_seq::int s FROM source_revision_positions WHERE revision_id=$1',[rev])).rows[0]?.s??null;
    throw new Error('rollback');
  }).catch(e=>{if((e as Error).message!=='rollback') throw e;});
  return seen;
}

/**
 * A revision that the numbering trigger never saw: written in `thread` while the trigger is off (a loader of its own, a maintenance session, a source that already held the thread).
 * The trigger is left at D, as such a session leaves it; the file is the step that puts it back. Returns the source event.
 */
async function unnumberedRevision(project:string,thread:string,revisionNo=1,event?:string,chat=chatSales):Promise<string>{
  await h.exec(`ALTER TABLE public.source_event_revisions DISABLE TRIGGER ${NUMBERING}`);
  const m=String(++rawSeq);
  const ev=event??(await q<{id:string}>(eventSql,[ids.tenant,project,'gw-'+m,chat,m,thread,randomUUID()]))[0].id;
  await q(revSql,[ids.tenant,project,ev,revisionNo,hex(String(revisionNo)),hex('a')]);
  return ev;
}
const UUID_SHAPE=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

describe('the state that a restore leaves, and the repair',()=>{
  test('P1 the numbering trigger that pg_restore --disable-triggers sets back to O is put back to A, and the answer says what it was',async()=>{
    await someThreads();
    await h.exec(`ALTER TABLE public.source_event_revisions ENABLE TRIGGER ${NUMBERING}`);
    expect(await numbering()).toBe('O');
    const r=await postRestore();
    expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(await numbering()).toBe('A');
    expect(r.ok&&r.result).toMatchObject({post_restore:'pass',numbering_trigger_was:'O'});
  });

  test('P2 a second run changes nothing: the trigger was already A, and no table gains or loses a row',async()=>{
    await someThreads();
    const before=await counts();
    const first=await postRestore();expect(first.ok,JSON.stringify(first)).toBe(true);
    const second=await postRestore();
    expect(second.ok&&second.result).toMatchObject({post_restore:'pass',numbering_trigger_was:'A',thread_order:'checked',held_by_project:[]});
    expect(await counts()).toEqual(before);
    expect(await numbering()).toBe('A');
  });

  test('P3 why the repair exists: at O a session with session_replication_role = replica writes a revision with no number; after the file it is numbered',async()=>{
    await h.exec(`ALTER TABLE public.source_event_revisions ENABLE TRIGGER ${NUMBERING}`);
    expect(await replicaWrite(),'at O the replica session skips the numbering trigger').toBeNull();
    const r=await postRestore();expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(await replicaWrite(),'at A it is numbered').toBe(1);
  });

  // OQ-59 (b) (1), the Chairman's answer of 22/11/2026: a restore keeps what the source had. A revision with no number is not a refusal: it is counted, its thread stays held (rule 4 of
  // the service, the guard of 023), and nothing here numbers it.
  test('P4 a revision that has no number does not stop the file: it is counted in the answer, its thread stays held, nothing is numbered, and the trigger is put back',async()=>{
    const root=messageEvent({});await svc().ingest(root);
    const reply=messageEvent({context:{replyToMessageId:root.context.messageId}});await svc().ingest(reply);
    const thread='m:'+root.context.messageId;
    const eventOf=async(m:string)=>(await q<{id:string}>('SELECT id FROM source_events WHERE chat_id=$1 AND message_id=$2',[chatSales,m]))[0].id;
    const [rootEvent,replyEvent]=[await eventOf(root.context.messageId),await eventOf(reply.context.messageId)];
    const candidate=(await q<{id:string}>('SELECT id FROM intake_candidates WHERE thread_key=$1',[thread]))[0].id;
    // the check of rule 4 of the service, as a draft that read the whole thread would make it
    const fresh=()=>threadFreshness(h.operator,ids.sales,candidate,[rootEvent,replyEvent],[{id:rootEvent,revisionNo:1},{id:replyEvent,revisionNo:1}]);
    expect(await fresh(),'control: a thread whose revisions are all numbered is not held').toEqual({hasBaseline:true,changed:false,position:'2'});
    await unnumberedRevision(ids.sales,thread);
    expect(await numbering()).toBe('D');
    const state=async()=>({positions:await q('SELECT revision_id::text r,thread_seq::int s FROM source_revision_positions ORDER BY 1'),heads:await q('SELECT thread_key,last_seq::int s FROM intake_thread_heads ORDER BY 1'),counts:await counts()});
    const before=await state();
    const r=await postRestore();
    expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(r.ok&&r.result).toMatchObject({post_restore:'pass',thread_order:'checked',archive_kind:'post-023',numbering_trigger_was:'D',held_by_project:[{project_no:1,revisions:1,threads:1}]});
    expect(await numbering(),'the repair is kept now that the file passes').toBe('A');
    expect(await state(),'no number is made up, no counter row moves, no row is added or lost').toEqual(before);
    const said=JSON.stringify(r.ok&&r.result);
    for(const leak of [chatSales,thread,ids.tenant,ids.sales]) expect(said,'the answer names no chat, thread, tenant or project').not.toContain(leak);
    expect(said).not.toMatch(UUID_SHAPE);
    expect(await fresh(),'the thread stays held: rule 4 of the service still reads the revision without a number as a change').toEqual({hasBaseline:true,changed:true,position:'2'});
  });

  test('P4b the count is per project, in the order of the project ids, with an ordinal and no id; a thread is counted once however many of its revisions have no number',async()=>{
    const other=randomUUID();
    await q('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)',[other,ids.tenant,'Dự án thứ hai','BU 2']);
    // the sales project: one thread with two revisions of one message and a revision of another message, a second thread with one, and a thread of the SAME KEY in another chat (a thread is
    // a chat and a key: the guard and rule 4 say so); the other project: one thread, one revision
    const first=await unnumberedRevision(ids.sales,'m:9101');
    await unnumberedRevision(ids.sales,'m:9101',2,first);
    await unnumberedRevision(ids.sales,'m:9101');
    await unnumberedRevision(ids.sales,'m:9102');
    await unnumberedRevision(ids.sales,'m:9101',1,undefined,chatSales+'9');
    await unnumberedRevision(other,'m:9103');
    const mine=new Map([[ids.sales,{revisions:5,threads:3}],[other,{revisions:1,threads:1}]]);
    const ordered=[...mine.keys()].sort();
    const r=await postRestore();
    expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(r.ok&&r.result).toMatchObject({post_restore:'pass',held_by_project:ordered.map((p,i)=>({project_no:i+1,...mine.get(p)!}))});
    // Codex gate, run 3 (P1, AGENTS.md: reports never aggregate across reporting domains): the answer is counted PER PROJECT, and no total of the revisions that have no number adds the projects up (a project belongs to one domain; two
    // projects of two domains must not meet in one number). The totals that the first version of this change added are gone from the answer; `revisions` and `threads` are the older whole-database figures.
    for(const total of ['unnumbered_revisions','held_threads']) expect(r.ok&&r.result,total+' is not a key of the answer').not.toHaveProperty(total);
    const said=JSON.stringify(r.ok&&r.result);
    expect(said).not.toMatch(UUID_SHAPE);for(const leak of [chatSales,chatSales+'9','m:9101','m:9102','m:9103',ids.sales,other]) expect(said).not.toContain(leak);
  });

  // Reality check of the last review: the no-total rule was pinned by two blacklisted names, so a total under any other name would pass. The answer is a contract: exactly these keys.
  test('P4i the answer has exactly these keys, so no figure can join it unseen: the kind, the whole-database figures of N4, and held_by_project (per project, no total of the revisions that have no number)',async()=>{
    const {thread}=await someThreads();
    const keys=['archive_kind','foreign_keys','held_by_project','numbering_trigger_was','post_restore','revisions','thread_order','threads'];
    // nothing is held: the same keys, an empty list
    const clean=await postRestore(undefined,false,'pre-023');
    expect(clean.ok,JSON.stringify(clean)).toBe(true);
    expect(Object.keys(clean.ok?clean.result:{}).sort()).toEqual(keys);
    // a thread is held (the kind is now post-023: for pre-023 the same revision is a refusal): the same keys again
    await unnumberedRevision(ids.sales,thread);
    const held=await postRestore();
    expect(held.ok,JSON.stringify(held)).toBe(true);
    expect(Object.keys(held.ok?held.result:{}).sort()).toEqual(keys);
    // the entries of the list carry a number for the project and its two counts, and nothing else
    expect((held.ok?held.result.held_by_project as Record<string,unknown>[]:[]).map(e=>Object.keys(e).sort())).toEqual([['project_no','revisions','threads']]);
  });

  test('P4c a held thread does not hide what a later check finds: with a revision that has no number, a counter row that disagrees (06) and a row with nothing to point at (09) still stop the file',async()=>{
    const {thread}=await someThreads();
    await unnumberedRevision(ids.sales,thread);
    const ok=await postRestore();expect(ok.ok,'the held thread alone passes: '+JSON.stringify(ok)).toBe(true);
    await q('UPDATE intake_thread_heads SET last_seq = last_seq + 3');
    await failsWith('POST-RESTORE-06');
    await q('UPDATE intake_thread_heads SET last_seq = last_seq - 3');
    await h.exec('ALTER TABLE public.source_events DISABLE TRIGGER ALL');
    await q(eventSql,[ids.tenant,randomUUID(),'gw-orphan',chatSales,'9999','m:9999',randomUUID()]);
    await h.exec('ALTER TABLE public.source_events ENABLE TRIGGER ALL');
    await failsWith('POST-RESTORE-09');
  });

  // Codex gate, round 1 (P1/P2): a person who runs the file by hand on an archive of before 023 and skips the numbering (runbook step 6) used to be stopped by 05 and, after OQ-59 (b) (1), got a pass.
  // The file cannot tell the two from the data (a source that had 023 with its numbering trigger off looks the same), so it is TOLD: the kind of the archive, as restore-plan.py names it, is required,
  // and for `pre-023` the same revisions are a refusal. OQ-59 (b) (1) is about an archive of after 023 and changes nothing here.
  test('P4e the kind of the archive is required: none, or one that the file does not know, stops it at 01 with its own sentence (the order against the repair is shown with real psql, R8b)',async()=>{
    await someThreads();
    await h.exec(`ALTER TABLE public.source_event_revisions ENABLE TRIGGER ${NUMBERING}`);
    for(const kind of [null,'','other','POST-023','post-023 ','pre-023;']){
      const r=await postRestore(undefined,false,kind);
      expect(r.ok,`kind ${JSON.stringify(kind)}: the file must stop`).toBe(false);
      expect(r.ok?'':r.error,`kind ${JSON.stringify(kind)}`).toMatch(/^POST-RESTORE-01 give the kind of the archive first/);
      expect(await numbering()).toBe('O');
    }
  });

  // Database review and security review of the kind parameter, both: `current_setting` reads a default that ALTER DATABASE / ALTER ROLE ... SET gave, so a hand run with no SET would be "told" by a
  // default that nobody gave it for this archive. The file already refuses a default of session_replication_role the same way (it reads pg_db_role_setting).
  test('P4h a default of the database that gives the kind does not count as being told it: the file refuses with the kind, and without',async()=>{
    await someThreads();
    await h.exec(`DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET libetech.archive_kind = %L', current_database(), 'post-023'); END $$`);
    undo.push(`DO $$ BEGIN EXECUTE format('ALTER DATABASE %I RESET libetech.archive_kind', current_database()); END $$`);
    for(const kind of [null,'post-023','pre-023']){
      const r=await postRestore(undefined,false,kind);
      expect(r.ok,`kind ${JSON.stringify(kind)}: the file must stop`).toBe(false);
      expect(r.ok?'':r.error,`kind ${JSON.stringify(kind)}`).toMatch(/^POST-RESTORE-01 a default of the database or of the role that runs this file gives the kind/);
    }
  });

  test('P4f an archive of before 023 that still has a revision without a number after 023 was applied again is refused at 05, and the trigger is left as it was; the same revision is only counted for an archive of after 023',async()=>{
    const {thread}=await someThreads();
    await unnumberedRevision(ids.sales,thread);
    expect(await numbering()).toBe('D');
    await failsWith('POST-RESTORE-05',undefined,false,'pre-023');
    expect(await numbering(),'one block, one transaction: the repair is undone with the refusal').toBe('D');
    const r=await failsWithMessage('pre-023');
    for(const leak of [chatSales,thread,ids.tenant,ids.sales]) expect(r,'the refusal names no chat, thread, tenant or project').not.toContain(leak);
    expect(r,'the refusal carries no count: a figure over every project is not given').toMatch(/^POST-RESTORE-05 revisions have no thread number/);
    const post=await postRestore(undefined,false,'post-023');
    expect(post.ok,JSON.stringify(post)).toBe(true);
    expect(post.ok&&post.result).toMatchObject({archive_kind:'post-023',held_by_project:[{project_no:1,revisions:1,threads:1}]});
  });

  test('P4g an archive of before 023 whose revisions all have a number passes with kind pre-023, and the answer says which kind it was told',async()=>{
    await someThreads();
    const r=await postRestore(undefined,false,'pre-023');
    expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(r.ok&&r.result).toMatchObject({post_restore:'pass',archive_kind:'pre-023',held_by_project:[]});
  });

  // Codex gate, run 3 (P2): a default that belongs to a role that does not run the file is no reason to stop it. The settings that apply to a session are those of the database and of the role that
  // connected (pg_db_role_setting: setdatabase this database or none, setrole this session's role or none).
  test('P4j only a default that applies to THIS session counts: a default of another role in this database does not stop the file, a default of the role that runs it does',async()=>{
    await someThreads();
    const db=(await q<{d:string}>('SELECT current_database() d'))[0].d,me=(await q<{u:string}>('SELECT session_user u'))[0].u;
    const set=(role:string)=>h.exec(`DO $$ BEGIN EXECUTE format('ALTER ROLE %I IN DATABASE %I SET libetech.archive_kind = %L', '${role}', '${db}', 'post-023'); END $$`);
    const reset=(role:string)=>`DO $$ BEGIN EXECUTE format('ALTER ROLE %I IN DATABASE %I RESET libetech.archive_kind', '${role}', '${db}'); END $$`;
    await set('libetech_runtime');undo.push(reset('libetech_runtime'));
    const other=await postRestore();
    expect(other.ok,'a default of a role that does not run the file: '+JSON.stringify(other)).toBe(true);
    await set(me);undo.push(reset(me));
    for(const kind of [null,'post-023']){
      const r=await postRestore(undefined,false,kind);
      expect(r.ok,`kind ${JSON.stringify(kind)}: a default of the role that runs the file`).toBe(false);
      expect(r.ok?'':r.error).toMatch(/^POST-RESTORE-01 a default of the database or of the role that runs this file gives the kind/);
    }
  });

  // Codex gate, run 4 (P2): the guard matched the NAME as a substring, so another default whose name merely contains the key's (a hint, a longer name) stopped a restore for nothing.
  test('P4k only the setting libetech.archive_kind itself counts as a default of the kind, not another one whose name contains it',async()=>{
    await someThreads();
    const db=(await q<{d:string}>('SELECT current_database() d'))[0].d,me=(await q<{u:string}>('SELECT session_user u'))[0].u;
    const set=(name:string)=>h.exec(`DO $$ BEGIN EXECUTE format('ALTER ROLE %I IN DATABASE %I SET ${name} = %L', '${me}', '${db}', 'post-023'); END $$`);
    const reset=(name:string)=>`DO $$ BEGIN EXECUTE format('ALTER ROLE %I IN DATABASE %I RESET ${name}', '${me}', '${db}'); END $$`;
    for(const name of ['libetech.archive_kind_hint','libetech.not_archive_kind','libetech.archive_kinds']){await set(name);undo.push(reset(name));}
    const unrelated=await postRestore();
    expect(unrelated.ok,'settings of other names do not stop the file: '+JSON.stringify(unrelated)).toBe(true);
    await set('libetech.archive_kind');undo.push(reset('libetech.archive_kind'));
    const real=await postRestore();
    expect(real.ok,'the setting itself still does').toBe(false);
    expect(real.ok?'':real.error).toMatch(/^POST-RESTORE-01 a default of the database or of the role that runs this file gives the kind/);
  });

  test('P4d a database in which every revision has a number reports none held: the count is a zero and an empty list, not an absence',async()=>{
    await someThreads();
    const r=await postRestore();
    expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(r.ok&&r.result).toMatchObject({held_by_project:[]});
  });

  test('P5 a counter row that disagrees with the numbers of its thread stops the file',async()=>{
    await someThreads();
    await q('UPDATE intake_thread_heads SET last_seq = last_seq + 3');
    await failsWith('POST-RESTORE-06');
  });

  test('P5b a number that does not belong to the thread of its source event stops the file, though the counter rows agree with the numbers',async()=>{
    await someThreads();
    await h.exec('ALTER TABLE public.source_revision_positions DISABLE TRIGGER source_revision_positions_immutable');
    undo.push('ALTER TABLE public.source_revision_positions ENABLE TRIGGER source_revision_positions_immutable');
    // the thread key of the numbers and of their counter row are changed together: the only disagreement left is with the source event
    await q("UPDATE source_revision_positions SET thread_key = thread_key || '-moved'");
    await q("UPDATE intake_thread_heads SET thread_key = thread_key || '-moved'");
    // the trigger is put back first: this case is about the numbers, not about a trigger that is off
    await h.exec('ALTER TABLE public.source_revision_positions ENABLE TRIGGER source_revision_positions_immutable');
    await failsWith('POST-RESTORE-07');
  });

  test('P6 a numbering trigger of the right name that would not number (a WHEN condition, another event, another function) stops the file, and is not "repaired" to A',async()=>{
    await someThreads();
    for(const [label,ddl] of [
      ['WHEN (false)',`CREATE OR REPLACE TRIGGER ${NUMBERING} AFTER INSERT ON public.source_event_revisions FOR EACH ROW WHEN (false) EXECUTE FUNCTION public.${NUMBERING}()`],
      ['AFTER UPDATE',`CREATE OR REPLACE TRIGGER ${NUMBERING} AFTER UPDATE ON public.source_event_revisions FOR EACH ROW EXECUTE FUNCTION public.${NUMBERING}()`],
      ['another function',`CREATE OR REPLACE TRIGGER ${NUMBERING} AFTER INSERT ON public.source_event_revisions FOR EACH ROW EXECUTE FUNCTION public.${GUARD}()`],
    ] as const){
      needsForward=true;
      await h.exec(ddl);
      await failsWith('POST-RESTORE-02');
      expect(await numbering(),label).toBe('O');
      await h.exec(await forwardSql());needsForward=false;
      expect(await numbering(),'application of 023 puts it right').toBe('A');
    }
  });

  test('P7 the confirmation trigger switched off, or gone, stops the file',async()=>{
    await someThreads();
    await h.exec(`ALTER TABLE public.draft_decisions DISABLE TRIGGER ${GUARD}`);
    undo.push(`ALTER TABLE public.draft_decisions ENABLE TRIGGER ${GUARD}`);
    await failsWith('POST-RESTORE-04');
    await h.exec(`ALTER TABLE public.draft_decisions ENABLE TRIGGER ${GUARD}`);
    needsForward=true;
    await h.exec(`DROP TRIGGER ${GUARD} ON public.draft_decisions`);
    await failsWith('POST-RESTORE-04');
  });

  test('P7b any other trigger of the application schemas that is switched off, or replica-only, stops the file (the foreign key triggers too)',async()=>{
    await someThreads();
    await h.exec('ALTER TABLE public.source_events DISABLE TRIGGER source_events_immutable');
    undo.push('ALTER TABLE public.source_events ENABLE TRIGGER source_events_immutable');
    await failsWith('POST-RESTORE-04');
    await h.exec('ALTER TABLE public.source_events ENABLE REPLICA TRIGGER source_events_immutable');
    await failsWith('POST-RESTORE-04');
  });

  test('P7c the triggers of the foreign keys that a failed or hand-made load left off stop the file too (the file does not read them as O because their table is fine)',async()=>{
    await someThreads();
    undo.push('ALTER TABLE public.source_events ENABLE TRIGGER ALL');
    await h.exec('ALTER TABLE public.source_events DISABLE TRIGGER ALL');
    expect((await q<{n:number}>("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='public.source_events'::regclass AND tgisinternal AND tgenabled='D'"))[0].n).toBeGreaterThan(0);
    await failsWith('POST-RESTORE-04');
  });

  test('P17 two tenants and four projects that share a chat and a thread key each have their own counter row and numbers: a check that mixed them would call valid data wrong',async()=>{
    const tenants=[ids.tenant,ids.otherTenant];
    for(const t of tenants) for(const n of [1,2]){
      const p=randomUUID();
      await q('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)',[p,t,'Dự án mẫu '+n,'BU '+n]);
      // a message id is unique for a tenant and a chat, so each project has its own message, in a thread of the same key
      const ev=(await q<{id:string}>(eventSql,[t,p,'gw-shared-'+(++rawSeq),chatSales,String(rawSeq),'m:7001',randomUUID()]))[0].id;
      for(const n of [1,2,3]) await q(revSql,[t,p,ev,n,hex(String(n)),hex('a')]);
    }
    const heads=await q<{last_seq:number}>('SELECT last_seq::int FROM intake_thread_heads WHERE thread_key=$1',['m:7001']);
    expect(heads.map(r=>r.last_seq)).toEqual([3,3,3,3]);
    const r=await postRestore();
    expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(r.ok&&r.result).toMatchObject({post_restore:'pass',thread_order:'checked'});
  });
});

describe('the data that a restore loads',()=>{
  test('P8 a row that has no row to point at stops the file, though every trigger is back on (a restore with --disable-triggers checks no foreign key)',async()=>{
    await someThreads();
    await h.exec('ALTER TABLE public.source_events DISABLE TRIGGER ALL');
    await q(eventSql,[ids.tenant,randomUUID(),'gw-orphan',chatSales,'9999','m:9999',randomUUID()]);
    await h.exec('ALTER TABLE public.source_events ENABLE TRIGGER ALL');
    await failsWith('POST-RESTORE-09');
  });

  test('P9 a confirmed decision of a candidate draft that carries a position beyond the last of its thread stops the file',async()=>{
    const {thread}=await someThreads();
    const candidate=(await q<{id:string}>('SELECT id FROM intake_candidates WHERE thread_key=$1',[thread]))[0].id;
    const newDraft=async()=>(await q<{id:string}>(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,sources,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
      VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,$5::jsonb,1,$4,$3,$3,$6) RETURNING id`,[ids.tenant,ids.sales,candidate,hex('c'),SOURCES,'post-restore-'+randomUUID()]))[0].id;
    // one decision for each draft (a draft has at most one)
    const decide=async(position:number|null)=>{const draft=await newDraft();await h.operator.transaction(async tx=>{
      // as a restore writes it: no guard of the decision table runs
      await tx.query('SET LOCAL session_replication_role = replica');
      await tx.query(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,decided_by,command_key,request_id,trace_id,subject_thread_seq)
        VALUES($1,$2,$3,$4,'confirmed','',$5,$6,$7,$7,$8)`,[ids.tenant,ids.sales,draft,hex('c'),pm.id,'post-restore-'+randomUUID(),randomUUID(),position]);
    });};
    const last=(await q<{s:number}>('SELECT last_seq::int s FROM intake_thread_heads WHERE thread_key=$1',[thread]))[0].s;
    await decide(last-1);
    // a confirmation with no position is what a confirmation written before 023 is: history, not an error (P9b)
    await decide(null);
    const ok=await postRestore();expect(ok.ok,'a decision that was written when the thread stood lower is history, not an error: '+JSON.stringify(ok)).toBe(true);
    await decide(last+5);
    await failsWith('POST-RESTORE-08');
  });

  test('P10 the write that the file tries leaves no row anywhere, and no probe project',async()=>{
    await someThreads();
    const before=await counts(),heads=await q('SELECT thread_key,last_seq::int FROM intake_thread_heads ORDER BY 1');
    const r=await postRestore();expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(await counts()).toEqual(before);
    expect(await q('SELECT thread_key,last_seq::int FROM intake_thread_heads ORDER BY 1')).toEqual(heads);
    expect((await q<{n:number}>("SELECT count(*)::int n FROM projects WHERE bu='probe'"))[0].n).toBe(0);
    expect(r.ok&&r.result).toMatchObject({revisions:4,threads:2});
  });

  test('P8b a foreign key of a match type that the file does not check (MATCH FULL) is refused, not passed over',async()=>{
    await h.exec('CREATE TABLE public.p8b_parent(id int PRIMARY KEY, k int, UNIQUE(id,k))');
    undo.push('DROP TABLE public.p8b_parent CASCADE');
    await h.exec('CREATE TABLE public.p8b_child(a int, b int, FOREIGN KEY (a,b) REFERENCES public.p8b_parent(id,k) MATCH FULL)');
    undo.push('DROP TABLE public.p8b_child');
    await failsWith('POST-RESTORE-09');
  });

  test('P10b a numbering trigger that has the right shape and state, whose function no longer numbers (the body was replaced), stops the file at the write that is undone',async()=>{
    await someThreads();
    needsForward=true;
    await h.exec(`CREATE OR REPLACE FUNCTION public.${NUMBERING}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$`);
    expect(await numbering()).toBe('A');
    await failsWith('POST-RESTORE-10');
    expect((await q<{n:number}>("SELECT count(*)::int n FROM projects WHERE bu='probe'"))[0].n,'the undone write left nothing').toBe(0);
  });

  test.skipIf(!native)('P10c a lock that another session holds is a lock error with its own code (98), never a failure of the write that is undone (10)',async()=>{
    await someThreads();
    const holder=await h.operator.transaction(async tx=>{
      // SHARE conflicts with the ROW EXCLUSIVE that the write asks for; the repair is not needed (the trigger stands at A), so the file gets as far as the write
      await tx.query('LOCK TABLE public.source_event_revisions IN SHARE MODE');
      return postRestore();
    });
    expect(holder.ok).toBe(false);
    expect(holder.ok?'':holder.error).toMatch(/^POST-RESTORE-98/);
    expect(holder.ok?'':holder.error).not.toMatch(/SQLSTATE/);
  });

  test('P11 a role that is not a superuser is refused before anything is read',async()=>{
    await failsWith('POST-RESTORE-01','libetech_runtime');
  });

  test('P11b a session in replica mode is refused: in it the triggers that the file tests are not the ones that run',async()=>{
    await failsWith('POST-RESTORE-01',undefined,true);
  });
});

describe('the file itself',()=>{
  test('P12c the file asks for the kind of the archive, and refuses a default of it, BEFORE its first repair (source order; the behaviour with real psql is R8b, which needs the native tools)',async()=>{
    const text=await sqlText();
    const at=(needle:string)=>{const i=text.indexOf(needle);expect(i,needle).toBeGreaterThan(-1);return i;};
    const guard=at("current_setting('libetech.archive_kind', true)"),defaults=at("= 'libetech.archive_kind')) THEN"),refusal=at("POST-RESTORE-01 give the kind of the archive first");
    const repair=at('ENABLE ALWAYS TRIGGER source_event_revisions_thread_position');
    for(const [name,i] of [['the default guard',defaults],['the read of the kind',guard],['the refusal for a missing kind',refusal]] as const) expect(i,name+' comes before the repair').toBeLessThan(repair);
    // and the superuser and replica checks stay first of all
    expect(at("current_setting('is_superuser')")).toBeLessThan(defaults);
  });

  test('P12 text: no psql meta-command, no transaction control, every refusal carries a code and no id, chat or thread key of the data',async()=>{
    const text=await sqlText();
    const lines=text.split('\n');
    expect(lines.filter(l=>l.startsWith('\\')),'a meta-command: PGlite and pg.query cannot run it').toEqual([]);
    // (a bare BEGIN opens a block of the DO body; a statement that controls the transaction ends in a semicolon)
    expect(lines.filter(l=>/^\s*(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\s*;/i.test(l)),'one block is the transaction').toEqual([]);
    const messages=[...text.matchAll(/RAISE (?:EXCEPTION|WARNING)\s+'((?:[^']|'')*)'/g)].map(m=>m[1]);
    expect(messages.length).toBeGreaterThan(10);
    for(const m of messages) expect(m,m).toMatch(/^POST-RESTORE-\d\d\b/);
    // a notice has no code (an installer that shows the codes it finds must not show one for a state that a refusal undoes), and no value of the data either
    const notices=[...text.matchAll(/RAISE NOTICE\s+'((?:[^']|'')*)'/g)].map(m=>m[1]);
    // the repair of the trigger, and the count of revisions that have no number (OQ-59 (b) (1): a report, not a refusal, so no code of the family that the installers show for a failure)
    expect(notices.length).toBe(2);
    // the file does not guess what an archive was from its data: "held as at the source" is said by nobody here (the kind is given, and for `pre-023` the same revisions are refused, step 05)
    for(const m of notices) expect(m,m).not.toMatch(/at the source/);
    for(const m of notices) expect(m,m).not.toMatch(/POST-RESTORE|PRE-RESTORE/);
    for(const m of [...messages,...notices]) expect(m,m).not.toMatch(/chat_id|thread_key|message_id|%s|%L/);
    expect(statements(text).map(s=>s.split(/\s/)[0])).toEqual(['SET','DO','ANALYZE;','SELECT']);
  });

  test('P12b scope: the search path and the replica mode live inside the block and for the transaction only; nothing sets a session value of the two; the lock comes before the first check',async()=>{
    const text=await sqlText();
    // psql -f runs each statement of the file on its own (autocommit): a SET LOCAL outside the block would be a warning and nothing more
    const [before,block]=[text.slice(0,text.indexOf('DO $post_restore$')),text.slice(text.indexOf('DO $post_restore$'))];
    expect(before.split('\n').filter(l=>!l.startsWith('--')&&/search_path|session_replication_role|lock_timeout/i.test(l))).toEqual([]);
    expect(block).toMatch(/set_config\('search_path', 'pg_catalog, pg_temp', true\)/);
    expect(block).toMatch(/set_config\('lock_timeout', '1s', true\)/);
    expect(text).not.toMatch(/set_config\('(search_path|session_replication_role|lock_timeout)'[^)]*false\)/);
    expect([...text.matchAll(/\bSET\s+(?!LOCAL\b)(search_path|session_replication_role)/gi)]).toEqual([]);
    // no lock while it only reads; the one lock of the probe is the first lock that migration 023 asks for, taken before the probe writes anything
    expect(block.match(/LOCK TABLE/g)).toHaveLength(1);
    expect(block).toMatch(/LOCK TABLE public\.source_event_revisions IN ROW EXCLUSIVE MODE;\n\s+INSERT INTO public\.projects/);
    // the fixed text for what is not ours, in the write that is undone as well as around the whole block
    expect(block).toMatch(/POST-RESTORE-99/);expect(block.match(/POST-RESTORE-98/g)!.length).toBeGreaterThanOrEqual(2);
    // the block puts back what it pinned
    expect(block).toMatch(/set_config\('search_path', old_path, true\)/);expect(block).toMatch(/set_config\('lock_timeout', old_lock_timeout, true\)/);
  });

  test('P13 after every migration only the numbering trigger of 023 is not enabled for the origin role alone: the constant of the file is the catalog (D7)',async()=>{
    const odd=await q<{rel:string;tgname:string;tgenabled:string}>(`SELECT c.relname rel,t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ${APP_SCHEMAS} AND t.tgenabled<>'O' ORDER BY 1,2`);
    expect(odd).toEqual([{rel:'source_event_revisions',tgname:NUMBERING,tgenabled:'A'}]);
    // and the file knows it: the one name that it expects at A is that trigger
    expect(await sqlText()).toContain(`ARRAY['public.source_event_revisions.${NUMBERING}']`);
  });
});

describe('the runbook',()=>{
  test('P16 the catalog query that the runbook gives for N12 on a database in service answers the two triggers of 023 with their state, and shows a numbering trigger that a restore left at O',async()=>{
    const blocks=[...(await file('docs/RUNBOOK-RESTORE-AFTER-023.md')).matchAll(/```sql\n([\s\S]*?)```/g)].map(m=>m[1]).filter(b=>b.includes(GUARD)&&b.includes('pg_trigger'));
    expect(blocks,'one query of the runbook reads the catalog for the two triggers').toHaveLength(1);
    const healthy=[{relname:'draft_decisions',tgname:GUARD,tgenabled:'O'},{relname:'source_event_revisions',tgname:NUMBERING,tgenabled:'A'}];
    expect(await q(blocks[0])).toEqual(healthy);
    await h.exec(`ALTER TABLE public.source_event_revisions ENABLE TRIGGER ${NUMBERING}`);
    expect(await q(blocks[0]),'what a restore leaves').toEqual([healthy[0],{...healthy[1],tgenabled:'O'}]);
    await h.exec(`ALTER TABLE public.source_event_revisions DISABLE TRIGGER ${NUMBERING}`);
    expect((await q<{tgenabled:string}>(blocks[0])).map(r=>r.tgenabled)).toEqual(['O','D']);
  });
});

describe('a database before 023',()=>{
  test('P14 on a schema that has no 023 the checks of 023 are left out, the rest runs, and the answer says so (a backup taken before 023 is rehearsed into schema 022)',async()=>{
    needsForward=true;
    await h.exec(await rollbackSql());
    expect(await q("SELECT to_regclass('public.intake_thread_heads')::text r")).toEqual([{r:null}]);
    // a backup of before 023 rehearsed into schema 022 is told `pre-023`; the file has nothing of 023 to look at for either word, and says null (not zero) for what it did not count
    for(const kind of ['pre-023','post-023']){
      const r=await postRestore(undefined,false,kind);
      expect(r.ok,JSON.stringify(r)).toBe(true);
      expect(r.ok&&r.result).toMatchObject({post_restore:'pass',thread_order:'023 not applied',archive_kind:kind,held_by_project:null});
    }
  });
});
