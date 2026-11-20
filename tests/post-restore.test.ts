import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {ids} from '../src/server/identities';
import {IntakeService} from '../src/server/intake';
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
let undo:string[]=[];
beforeEach(async()=>{needsForward=false;undo=[];h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{
  await h.exec('ROLLBACK').catch(()=>{});
  try{
    if(needsForward) await h.exec(await forwardSql());
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
/** The file as one session: the DO block, ANALYZE, then the row that says it finished. A failure rolls the whole transaction back, as it does for psql with ON_ERROR_STOP. */
async function postRestore(asRole?:string,replica=false):Promise<Outcome>{
  const parts=statements(await sqlText());
  expect(parts.map(p=>p.split(/\s/)[0]),'SET, DO, ANALYZE, SELECT').toEqual(['SET','DO','ANALYZE;','SELECT']);
  try{
    const rows=await h.operator.transaction(async tx=>{
      if(asRole) await tx.query(`SET LOCAL ROLE ${asRole}`);
      if(replica) await tx.query('SET LOCAL session_replication_role = replica');
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
const failsWith=async(code:string,asRole?:string,replica=false)=>{
  const r=await postRestore(asRole,replica);
  expect(r.ok,'the file must stop').toBe(false);
  expect(r.ok?'':r.error).toMatch(new RegExp('^'+code));
};

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
    expect(second.ok&&second.result).toMatchObject({post_restore:'pass',numbering_trigger_was:'A',thread_order:'checked'});
    expect(await counts()).toEqual(before);
    expect(await numbering()).toBe('A');
  });

  test('P3 why the repair exists: at O a session with session_replication_role = replica writes a revision with no number; after the file it is numbered',async()=>{
    await h.exec(`ALTER TABLE public.source_event_revisions ENABLE TRIGGER ${NUMBERING}`);
    expect(await replicaWrite(),'at O the replica session skips the numbering trigger').toBeNull();
    const r=await postRestore();expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(await replicaWrite(),'at A it is numbered').toBe(1);
  });

  test('P4 a revision that has no number stops the file and leaves the trigger as it was: nothing is repaired on the way to a refusal',async()=>{
    await someThreads();
    await h.exec(`ALTER TABLE public.source_event_revisions DISABLE TRIGGER ${NUMBERING}`);
    const ev=await rawEvent();
    await q(revSql,[ids.tenant,ids.sales,ev,1,hex('1'),hex('a')]);
    expect(await numbering()).toBe('D');
    await failsWith('POST-RESTORE-05');
    expect(await numbering(),'one block, one transaction: the repair is undone with the refusal').toBe('D');
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
    expect(notices.length).toBe(1);
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
    const r=await postRestore();
    expect(r.ok,JSON.stringify(r)).toBe(true);
    expect(r.ok&&r.result).toMatchObject({post_restore:'pass',thread_order:'023 not applied'});
  });
});
