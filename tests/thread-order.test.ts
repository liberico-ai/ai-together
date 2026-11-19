import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import {IntakeService} from '../src/server/intake';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent,type EventOverride} from './slice2-fixtures';
import {mapDomain} from './slice3-fixtures';

// Migration 023 (OQ-53 point 3 (b)). The intake half: a number per thread for every stored revision, a counter row per thread, and the refusals of the file (A1-A9b).
// The confirming half: the column draft_decisions.subject_thread_seq and the trigger that compares it with the counter row and writes it (B1-B9).
// After the tier-1 reviews: the refusals of the file as behaviour, with the locks that come first (A10, A11, A13 native), the second run (A12 native), the counter rows of
// several scopes under one chat and thread key (B8), and the lookups of the guard when the other guards are off (A9b, B9).
// The cases that need two connections and do not need the harness login are in thread-order-concurrency.test.ts (native PostgreSQL only).
const file=(p:string)=>readFile(path.join(process.cwd(),p),'utf8');
const forwardSql=()=>file('migrations/023_thread_order.sql');
const rollbackSql=()=>file('migrations/rollback/023_thread_order.sql');
const hex=(c:string)=>c.repeat(64);
const TABLES=['intake_thread_heads','source_revision_positions'];
const OTHER_ROLES=['libetech_intake','libetech_ai','libetech_identity','libetech_auth','libetech_projector','libetech_outbox_audit','libetech_intake_svc'];

let h:Harness;
let needsForward=false;
// The triggers that a case of this file or of thread-order-concurrency.test.ts switches off with a COMMITTED statement (A7b here, N19b there: another connection has to see them off).
// A case that dies between the two statements must not leave the shared native database in that state for the next run, so both hooks put them back, idempotently (review R-S-9).
// Each trigger goes back to the state the file leaves it in: the guard of 022 enabled (O), the numbering trigger enabled for every session role (A, ENABLE ALWAYS: a session with
// session_replication_role = replica fires it too). Only a trigger that is switched OFF (D) is put back: a trigger that stands at another state is not changed here, so the hook never
// hides what the file itself leaves; the cases that depend on the state of the file apply it first (A6, B10, N25).
const SWITCHED_OFF=[['draft_decisions','draft_decisions_pointer_only_guard','O'],['source_event_revisions','source_event_revisions_thread_position','A']] as const;
async function restoreGuards(db:Harness){
  for(const [table,trigger,state] of SWITCHED_OFF){
    const r=await db.operator.query<{tgenabled:string}>('SELECT tgenabled FROM pg_trigger WHERE tgname=$1 AND tgrelid=$2::regclass AND NOT tgisinternal',[trigger,'public.'+table]);
    if(r.rows[0]&&r.rows[0].tgenabled==='D') await db.exec(`ALTER TABLE public.${table} ENABLE ${state==='A'?'ALWAYS ':''}TRIGGER ${trigger}`);
  }
}
beforeEach(async()=>{needsForward=false;h=await openHarness();await restoreGuards(h);await h.reset();await seedSlice1(h);});
afterEach(async()=>{
  await h.exec('ROLLBACK').catch(()=>{});
  try {
    // a case that rolled 023 back puts it back before the harness truncates: the database may be a shared native one
    if(needsForward) await h.exec(await forwardSql());
  } finally {
    await restoreGuards(h);
    await h.reset();await h.close();
  }
});

const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const svc=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!);
const count=async(t:string)=>(await q<{n:number}>(`SELECT count(*)::int n FROM ${t}`))[0].n;
const regclass=async(t:string)=>(await q<{r:string|null}>('SELECT to_regclass($1)::text r',[t]))[0].r;

/** The numbers of every stored revision, by thread then number. */
const numbers=()=>q<{chat_id:string;thread_key:string;seq:number;message_id:string;revision_no:number}>(
  `SELECT p.chat_id,p.thread_key,p.thread_seq::int seq,e.message_id,r.revision_no FROM source_revision_positions p
   JOIN source_event_revisions r ON r.id=p.revision_id JOIN source_events e ON e.id=p.source_event_id ORDER BY p.chat_id,p.thread_key,p.thread_seq`);
const heads=()=>q<{chat_id:string;thread_key:string;last_seq:number;updated_at:string}>(
  'SELECT chat_id,thread_key,last_seq::int last_seq,updated_at::text updated_at FROM intake_thread_heads ORDER BY chat_id,thread_key');

/** One transaction as a database role, with the scope that role declares for the request. */
function as<T>(role:string,projects:string[],fn:(tx:Queryable)=>Promise<T>):Promise<T>{
  return h.operator.transaction(async tx=>{
    await tx.query(`SET LOCAL ROLE ${role}`);
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.intake_principal_id',$3,true),set_config('app.person_id',$3,true)",
      [ids.tenant,projects.join(','),pm.id]);
    return fn(tx);
  });
}
const asRuntime=<T>(projects:string[],fn:(tx:Queryable)=>Promise<T>)=>scoped(h.db,{...pm,projectIds:projects},async tx=>{
  await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);
  return fn(tx);
});
const refusal=(p:Promise<unknown>)=>p.then(()=>null,(e:{code?:string;message:string;detail?:string;hint?:string})=>e);

const eventSql=`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
  VALUES($1,$2,$3,'telegram_gateway',80,$4,$5,$6,'actor-1',now(),false,false,$7,$7) RETURNING id`;
const rawEvent=async(chat:string,message:string,thread:string,project=ids.sales)=>
  (await q<{id:string}>(eventSql,[ids.tenant,project,'gw-'+message,chat,message,thread,randomUUID()]))[0].id;
const REV_COLS='tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode';
const revSql=`INSERT INTO source_event_revisions(${REV_COLS}) VALUES($1,$2,$3,$4,$5,$6,'pointer_only') RETURNING id`;
/** A revision written as it was before 023: raw, with the creation time and the id chosen by the case. */
const rawRevision=async(event:string,no:number,createdAt:string,key:string,id:string=randomUUID(),project=ids.sales)=>
  (await q<{id:string}>(`INSERT INTO source_event_revisions(id,created_at,${REV_COLS}) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pointer_only') RETURNING id`,
    [id,createdAt,ids.tenant,project,event,no,hex(key),hex('b')]))[0].id;
const draftSql=`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
  VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,1,$4,$3,$3,$5) RETURNING id`;
const draftDecision=(draftId:string,result='rejected')=>q(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,decided_by,command_key,request_id,trace_id)
  VALUES($1,$2,$3,$4,$5,'Lý do đủ dài',$6,'thread-order-key',$7,$7)`,[ids.tenant,ids.sales,draftId,hex('c'),result,pm.id,randomUUID()]);

/** Four revisions in two threads as they were before 023, written while 023 is rolled back. Returns the clock the cases order them by. */
async function fourOldRevisions(){
  const at=(s:number)=>new Date(Date.parse('2026-01-01T10:00:00Z')+s*1000).toISOString();
  // thread A: revision 1 was written later than revision 2 (a larger number, an earlier creation time)
  const a=await rawEvent(chatSales,'9001','m:9001');
  await rawRevision(a,1,at(3),'1');await rawRevision(a,2,at(1),'2');
  // thread B: two events with one thread key and the same creation time and revision number: the id decides, and it is not the insertion order
  const b1=await rawEvent(chatSales,'9002','m:9002'),b2=await rawEvent(chatSales,'9003','m:9002');
  await rawRevision(b2,1,at(2),'3','00000000-0000-4000-8000-0000000000b2');
  await rawRevision(b1,1,at(2),'4','00000000-0000-4000-8000-0000000000b1');
  return {a,b1,b2};
}

test('A1 every stored revision gets the next number of its thread, and the head row says the same',async()=>{
  const s=svc(),root=messageEvent({});
  await s.ingest(root);
  await s.ingest(messageEvent({context:{replyToMessageId:root.context.messageId}}));
  await s.ingest({...root,editedAt:new Date(1760009999000).toISOString(),contentHash:hex('b')});
  const other=messageEvent({});
  await s.ingest(other);
  const mine='m:'+root.context.messageId,theirs='m:'+other.context.messageId;
  const n=await numbers();
  expect(n.filter(r=>r.thread_key===mine).map(r=>[r.seq,r.revision_no])).toEqual([[1,1],[2,1],[3,2]]);
  expect(n.filter(r=>r.thread_key===theirs).map(r=>r.seq)).toEqual([1]);
  expect((await heads()).map(r=>[r.thread_key,r.last_seq]).sort()).toEqual([[mine,3],[theirs,1]].sort());
  expect(n).toHaveLength(4);
});

test('A2 a replayed revision takes no number and leaves the head row untouched',async()=>{
  const s=svc(),e=messageEvent({});
  expect((await s.ingest(e)).replayed).toBe(false);
  const before={numbers:await numbers(),heads:await heads()};
  expect(before.heads).toHaveLength(1);
  const again=await s.ingest(e);
  expect(again.replayed).toBe(true);
  expect(await numbers()).toEqual(before.numbers);
  // last_seq and updated_at: a row that was written again would carry a later updated_at
  expect(await heads()).toEqual(before.heads);
  expect(await count('source_revision_positions')).toBe(1);
});

test('A3 34a–34e for the two new tables',async()=>{
  const s=svc(),root=messageEvent({});
  await s.ingest(root);await s.ingest(messageEvent({context:{replyToMessageId:root.context.messageId}}));
  expect(await count('intake_thread_heads')).toBe(1);expect(await count('source_revision_positions')).toBe(2);
  // 34d no context: nothing; 34a the scope of the role decides
  for(const t of TABLES){
    const none=await h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query(`SELECT * FROM ${t}`)).rows;});
    expect(none,t+' without a context').toHaveLength(0);
    expect((await asRuntime([ids.sales],async tx=>(await tx.query(`SELECT * FROM ${t}`)).rows)).length,t+' in scope').toBeGreaterThan(0);
    expect(await asRuntime([ids.transport],async tx=>(await tx.query(`SELECT * FROM ${t}`)).rows),t+' another project').toHaveLength(0);
    expect(await h.operator.transaction(async tx=>{
      await tx.query('SET LOCAL ROLE libetech_runtime');
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.otherTenant,ids.sales]);
      return (await tx.query(`SELECT * FROM ${t}`)).rows;
    }),t+' another tenant').toHaveLength(0);
  }
  // 34b, 34c: no write, from any role that holds the table at all
  const writes=[
    `INSERT INTO intake_thread_heads(tenant_id,project_id,chat_id,thread_key,last_seq) VALUES(gen_random_uuid(),gen_random_uuid(),'-1','x',1)`,
    'UPDATE intake_thread_heads SET last_seq=last_seq+1','DELETE FROM intake_thread_heads',
    `INSERT INTO source_revision_positions(tenant_id,project_id,source_event_id,revision_id,chat_id,thread_key,thread_seq) VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'-1','x',1)`,
    'UPDATE source_revision_positions SET thread_seq=thread_seq+1','DELETE FROM source_revision_positions'];
  for(const role of ['libetech_runtime','libetech_intake','libetech_ai'])
    for(const sql of writes) await expect(as(role,[ids.sales],tx=>tx.query(sql)),role+' '+sql).rejects.toThrow(/permission denied/);
  // a SELECT of any other role is refused as well: a grant that should not be there fails here
  for(const role of OTHER_ROLES)
    for(const t of TABLES) await expect(as(role,[ids.sales],tx=>tx.query(`SELECT * FROM ${t}`)),role+' '+t).rejects.toThrow(/permission denied/);
  if(native)
    for(const t of TABLES) await expect(h.db.query(`SELECT * FROM ${t}`),'libetech_web '+t).rejects.toThrow(/permission denied/);
  // the login of the operator is stopped by the history trigger, not by a grant
  await expect(h.operator.query('UPDATE source_revision_positions SET thread_seq=thread_seq')).rejects.toThrow(/Append-only/);
  await expect(h.operator.query('DELETE FROM source_revision_positions')).rejects.toThrow(/Append-only/);
  await expect(h.operator.query('DELETE FROM intake_thread_heads')).rejects.toThrow(/Append-only/);
  // from the catalog (DB-10): the only grant on either table is SELECT to the runtime role
  expect(await q(`SELECT c.relname t,coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type p FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
    WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1) AND a.grantee<>c.relowner ORDER BY 1,2,3`,[TABLES]))
    .toEqual([{t:'intake_thread_heads',grantee:'libetech_runtime',p:'SELECT'},{t:'source_revision_positions',grantee:'libetech_runtime',p:'SELECT'}]);
  expect(await q("SELECT 1 FROM pg_attribute a WHERE a.attrelid=ANY($1::regclass[]) AND a.attacl IS NOT NULL",[TABLES.map(t=>'public.'+t)])).toEqual([]);
  for(const {rolname} of await q<{rolname:string}>("SELECT rolname FROM pg_roles WHERE rolname LIKE 'libetech\\_%'"))
    for(const t of TABLES){
      for(const p of ['INSERT','UPDATE','REFERENCES']) expect((await q<{ok:boolean}>('SELECT has_any_column_privilege($1,$2,$3) ok',[rolname,'public.'+t,p]))[0].ok,`${rolname} ${p} ${t}`).toBe(false);
      for(const p of ['DELETE','TRUNCATE','TRIGGER']) expect((await q<{ok:boolean}>('SELECT has_table_privilege($1,$2,$3) ok',[rolname,'public.'+t,p]))[0].ok,`${rolname} ${p} ${t}`).toBe(false);
      expect((await q<{ok:boolean}>("SELECT has_any_column_privilege($1,$2,'SELECT') ok",[rolname,'public.'+t]))[0].ok,`${rolname} SELECT ${t}`).toBe(rolname==='libetech_runtime');
    }
  // 34e: neither role that writes the intake path or reads it bypasses row-level security
  expect(await q("SELECT rolname,rolbypassrls FROM pg_roles WHERE rolname IN ('libetech_runtime','libetech_intake') ORDER BY 1"))
    .toEqual([{rolname:'libetech_intake',rolbypassrls:false},{rolname:'libetech_runtime',rolbypassrls:false}]);
});

test('A4 no libetech role locks a head row by itself or calls the function',async()=>{
  const s=svc();
  await s.ingest(messageEvent({}));
  const roles=(await q<{rolname:string}>("SELECT rolname FROM pg_roles WHERE rolname LIKE 'libetech\\_%' ORDER BY 1")).map(r=>r.rolname);
  expect(roles).toEqual(expect.arrayContaining(['libetech_runtime','libetech_intake','libetech_ai','libetech_web']));
  for(const role of roles){
    for(const mode of ['FOR KEY SHARE','FOR SHARE','FOR NO KEY UPDATE','FOR UPDATE']){
      const e=await refusal(as(role,[ids.sales],tx=>tx.query(`SELECT 1 FROM intake_thread_heads ${mode}`)));
      expect(e,role+' '+mode).not.toBeNull();
      expect(e!.code,role+' '+mode).toBe('42501');
    }
    const f=await refusal(as(role,[ids.sales],tx=>tx.query('SELECT public.source_event_revisions_thread_position()')));
    expect(f,role+' function').not.toBeNull();
    expect(f!.message,role+' function').toMatch(/permission denied/);
  }
});

test('A5 the intake role scoped to one project cannot write a revision into a thread of another, and is answered by row-level security',async()=>{
  const s=svc(),mine=messageEvent({}),theirs=messageEvent({context:{chatId:chatTransport}});
  await s.ingest(mine);await s.ingest(theirs);
  const ev=async(chat:string,message:string)=>(await q<{id:string;project_id:string}>('SELECT id,project_id FROM source_events WHERE chat_id=$1 AND message_id=$2',[chat,message]))[0];
  const sales=await ev(chatSales,mine.context.messageId),transport=await ev(chatTransport,theirs.context.messageId);
  expect(sales.project_id).toBe(ids.sales);expect(transport.project_id).toBe(ids.transport);
  const before={positions:await count('source_revision_positions'),heads:await heads()};
  const forms:[string,string,unknown[]][]=[
    ['one row of another project',revSql,[ids.tenant,ids.transport,transport.id,2,hex('9'),hex('8')]],
    // two rows in one statement, one in scope: the whole statement is refused and the row in scope is not numbered either
    ['two rows, VALUES',`INSERT INTO source_event_revisions(${REV_COLS}) VALUES($1,$2,$3,2,$4,$5,'pointer_only'),($1,$6,$7,2,$8,$5,'pointer_only')`,
      [ids.tenant,ids.sales,sales.id,hex('7'),hex('8'),ids.transport,transport.id,hex('6')]],
    ['two rows, INSERT … SELECT',`INSERT INTO source_event_revisions(${REV_COLS}) SELECT $1::uuid,v.p,v.e,2,v.k,$2::text,'pointer_only' FROM (VALUES($3::uuid,$4::uuid,$5::text),($6::uuid,$7::uuid,$8::text)) v(p,e,k)`,
      [ids.tenant,hex('8'),ids.sales,sales.id,hex('7'),ids.transport,transport.id,hex('6')]],
  ];
  for(const [name,sql,params] of forms){
    const e=await refusal(as('libetech_intake',[ids.sales],tx=>tx.query(sql,params)));
    expect(e,name).not.toBeNull();
    expect(e!.message,name).toMatch(/row-level security/);
    expect(await count('source_revision_positions'),name).toBe(before.positions);
    expect(await heads(),name+': no counter moved').toEqual(before.heads);
  }
  // control: the same role writes a revision of its own project, and it is numbered
  await as('libetech_intake',[ids.sales],tx=>tx.query(revSql,[ids.tenant,ids.sales,sales.id,2,hex('5'),hex('8')]));
  expect(await count('source_revision_positions')).toBe(before.positions+1);
});

test('A6 the catalog of 023: tables, policies, triggers, functions; a second run changes nothing',async()=>{
  const OWN=`('intake_thread_heads','source_revision_positions')`;
  const shape=async()=>({
    classes:await q(`SELECT relname,relrowsecurity,relforcerowsecurity,relkind FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ${OWN} ORDER BY 1`),
    policies:await q(`SELECT tablename,policyname,cmd,roles::text,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ${OWN} ORDER BY 1,2`),
    triggers:await q(`SELECT tgrelid::regclass::text t,tgname,tgtype::int,tgenabled,pg_get_triggerdef(oid) d FROM pg_trigger WHERE NOT tgisinternal
      AND tgrelid IN ('public.intake_thread_heads'::regclass,'public.source_revision_positions'::regclass,'public.source_event_revisions'::regclass) ORDER BY 1,2`),
    functions:await q(`SELECT p.proname,p.prosecdef,p.proconfig,p.proacl::text acl,pg_get_userbyid(p.proowner) owner,pg_get_functiondef(p.oid) d FROM pg_proc p
      WHERE p.pronamespace='public'::regnamespace AND p.proname='source_event_revisions_thread_position'`),
    indexes:await q(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ${OWN} ORDER BY 1,2`),
    constraints:await q(`SELECT conrelid::regclass::text t,conname,pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid IN ('public.intake_thread_heads'::regclass,'public.source_revision_positions'::regclass) ORDER BY 1,2`),
    columns:await q(`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ${OWN} ORDER BY 1,ordinal_position`),
  });
  const s=svc();
  await s.ingest(messageEvent({}));
  // the state that the file leaves, whatever an earlier case or file left on a shared database (the numbering trigger is replaced by the file, and ENABLE ALWAYS comes after it)
  await h.exec(await forwardSql());
  const first=await shape();
  // both tables: ENABLE and FORCE, and exactly one policy each: the SELECT of the runtime role, with the condition of 016
  expect(first.classes).toEqual([{relname:'intake_thread_heads',relrowsecurity:true,relforcerowsecurity:true,relkind:'r'},{relname:'source_revision_positions',relrowsecurity:true,relforcerowsecurity:true,relkind:'r'}]);
  const ref=(await q<{qual:string}>("SELECT qual FROM pg_policies WHERE tablename='source_event_revisions' AND policyname='runtime_select'"))[0].qual;
  expect(first.policies).toEqual(TABLES.map(t=>({tablename:t,policyname:'runtime_select',cmd:'SELECT',roles:'{libetech_runtime}',qual:ref,with_check:null})).sort((a,b)=>a.tablename.localeCompare(b.tablename)));
  // the constraints of the two tables, by what they say (names are generated; the NOT NULL entries that PostgreSQL 18 lists are left out): the key, the unique keys, the positive
  // numbers, the foreign key of each table to projects and the foreign key of the number table to the revision. A foreign key that is missing turns this red (review R-DB-3).
  const defs=(await q<{t:string;c:string;d:string}>(`SELECT conrelid::regclass::text t,contype::text c,pg_get_constraintdef(oid) d FROM pg_constraint
    WHERE conrelid IN ('public.intake_thread_heads'::regclass,'public.source_revision_positions'::regclass) AND contype IN ('p','u','c','f')`)).map(r=>`${r.t}|${r.c}|${r.d.replace(/public\./g,'')}`).sort();
  expect(defs).toEqual([
    'intake_thread_heads|c|CHECK ((last_seq > 0))',
    'intake_thread_heads|f|FOREIGN KEY (project_id, tenant_id) REFERENCES projects(id, tenant_id)',
    'intake_thread_heads|p|PRIMARY KEY (id)',
    'intake_thread_heads|u|UNIQUE (tenant_id, project_id, chat_id, thread_key)',
    'source_revision_positions|c|CHECK ((thread_seq > 0))',
    'source_revision_positions|f|FOREIGN KEY (project_id, tenant_id) REFERENCES projects(id, tenant_id)',
    'source_revision_positions|f|FOREIGN KEY (revision_id, source_event_id, tenant_id, project_id) REFERENCES source_event_revisions(id, source_event_id, tenant_id, project_id)',
    'source_revision_positions|p|PRIMARY KEY (id)',
    'source_revision_positions|u|UNIQUE (revision_id)',
    'source_revision_positions|u|UNIQUE (tenant_id, project_id, chat_id, thread_key, thread_seq)',
  ].sort());
  // the revision table: the immutability trigger of 016 and one AFTER INSERT row trigger of 023, enabled for every session role
  const rev=first.triggers.filter(t=>t.t==='source_event_revisions') as {tgname:string;tgtype:number;tgenabled:string}[];
  expect(rev.map(t=>t.tgname)).toEqual(expect.arrayContaining(['source_event_revisions_immutable','source_event_revisions_thread_position']));
  // the numbering trigger fires for every session role: tgenabled A (ENABLE ALWAYS). With O a session that sets session_replication_role = replica stores a revision that is not numbered.
  expect(rev.find(t=>t.tgname==='source_event_revisions_thread_position')).toMatchObject({tgtype:5,tgenabled:'A'});
  expect(first.triggers.filter(t=>t.t!=='source_event_revisions').map(t=>(t as {tgname:string;tgenabled:string}).tgname+':'+(t as {tgenabled:string}).tgenabled).sort())
    .toEqual(['intake_thread_heads_no_delete:O','source_revision_positions_immutable:O']);
  // the function: definer, the three settings, owned by a role that row-level security does not bind, executable by nobody
  expect(first.functions).toHaveLength(1);
  const fn=first.functions[0] as {prosecdef:boolean;proconfig:string[];acl:string|null;owner:string};
  expect(fn.prosecdef).toBe(true);
  expect([...fn.proconfig].sort()).toEqual(['lock_timeout=5s','row_security=off','search_path=pg_catalog, pg_temp']);
  expect((await q<{ok:boolean}>('SELECT (r.rolsuper OR r.rolbypassrls) ok FROM pg_roles r WHERE r.rolname=$1',[fn.owner]))[0].ok).toBe(true);
  expect(await q(`SELECT coalesce(r.rolname,'PUBLIC') grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee
    WHERE p.proname='source_event_revisions_thread_position' AND a.privilege_type='EXECUTE' AND a.grantee<>p.proowner`)).toEqual([]);
  for(const role of ['libetech_runtime','libetech_intake','libetech_ai','libetech_web'])
    expect((await q<{ok:boolean}>("SELECT has_function_privilege($1,'public.source_event_revisions_thread_position()','EXECUTE') ok",[role]))[0].ok,role).toBe(false);
  // E-DB-01/02/08: UUID keys, timestamptz, the foreign-key and created_at indexes of the same migration
  for(const t of TABLES){
    const cols=first.columns.filter(c=>(c as {table_name:string}).table_name===t) as {column_name:string;data_type:string;is_nullable:string}[];
    expect(cols.find(c=>c.column_name==='id')).toMatchObject({data_type:'uuid'});
    for(const c of ['created_at','updated_at']) expect(cols.find(x=>x.column_name===c)).toMatchObject({data_type:'timestamp with time zone',is_nullable:'NO'});
    expect(first.indexes.map(i=>(i as {indexname:string}).indexname)).toEqual(expect.arrayContaining([`idx_${t}_scope_created`,`idx_${t}_project_fk`]));
  }
  // the second run: nothing changes, and no row is added (DB-1: a trigger or policy created twice would fail here with 42710)
  const rowsBefore={positions:await numbers(),heads:await heads()};
  await h.exec(await forwardSql());
  expect(await shape()).toEqual(first);
  expect({positions:await numbers(),heads:await heads()}).toEqual(rowsBefore);
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toHaveLength(1);
  // and a third: the step that enables the trigger for every role runs after every replacement, so the state is the same each time
  await h.exec(await forwardSql());
  expect(await shape()).toEqual(first);
  expect((await q<{tgenabled:string}>("SELECT tgenabled FROM pg_trigger WHERE tgname='source_event_revisions_thread_position' AND NOT tgisinternal"))[0].tgenabled).toBe('A');
});

test('A7 numbering rows that were there before 023, and the refusal while a draft of a candidate is undecided',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),forward=await forwardSql();
  await h.exec(rollback);
  expect(await regclass('public.source_revision_positions')).toBeNull();
  const {a}=await fourOldRevisions();
  // an undecided draft of an intake candidate and revisions that carry no number: 023 stops, with its own words, and creates nothing
  const draftId=(await q<{id:string}>(draftSql,[ids.tenant,ids.sales,randomUUID(),hex('c'),'thread-order-draft-0001']))[0].id;
  await expect(h.exec(forward)).rejects.toThrow(/no person has decided/);
  await h.exec('ROLLBACK');
  for(const t of TABLES) expect(await regclass('public.'+t),t).toBeNull();
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toEqual([]);
  // the same draft once a person has decided it: 023 runs
  await draftDecision(draftId,'rejected');
  await h.exec(forward);
  expect((await numbers()).map(r=>[r.thread_key,r.seq,r.revision_no,r.message_id])).toEqual([
    ['m:9001',1,2,'9001'],['m:9001',2,1,'9001'],
    // the same creation time and revision number: the smaller id first, whatever the insertion order
    ['m:9002',1,1,'9002'],['m:9002',2,1,'9003']]);
  expect((await heads()).map(r=>[r.thread_key,r.last_seq])).toEqual([['m:9001',2],['m:9002',2]]);
  // the next message of the thread takes the next number
  const next=await svc().ingest(messageEvent({context:{replyToMessageId:'9001'}}));
  expect(next.replayed).toBe(false);
  expect((await numbers()).filter(r=>r.thread_key==='m:9001').map(r=>r.seq)).toEqual([1,2,3]);
  expect((await heads()).find(r=>r.thread_key==='m:9001')!.last_seq).toBe(3);
  expect(a).toBeTruthy();
  // a second run finds nothing to number and changes no counter
  const stable={positions:await numbers(),heads:await heads()};
  await h.exec(forward);
  expect({positions:await numbers(),heads:await heads()}).toEqual(stable);
});

test('A7b revisions stored while the trigger was off are numbered after the counter of their thread, and applying 023 again turns the trigger back on',async()=>{
  const s=svc(),root=messageEvent({});
  await s.ingest(root);await s.ingest(messageEvent({context:{replyToMessageId:root.context.messageId}}));
  const thread='m:'+root.context.messageId;
  const before=await numbers();
  expect(before.map(r=>r.seq)).toEqual([1,2]);
  // the trigger off (W9): two revisions of the thread get no number and the counter does not move
  await h.exec('ALTER TABLE source_event_revisions DISABLE TRIGGER source_event_revisions_thread_position');
  const event=(await q<{id:string}>('SELECT id FROM source_events WHERE chat_id=$1 AND message_id=$2',[chatSales,root.context.messageId]))[0].id;
  const earlier=new Date(Date.now()+60_000).toISOString(),later=new Date(Date.now()+120_000).toISOString();
  // the larger revision number was written first: the order of numbering is created_at, not revision_no
  await rawRevision(event,3,earlier,'7');await rawRevision(event,2,later,'6');
  expect(await count('source_revision_positions')).toBe(2);expect((await heads())[0].last_seq).toBe(2);
  needsForward=true;
  await h.exec(await forwardSql());
  // numbered after the counter, in the order of created_at; the old numbers do not change
  const after=await numbers();
  expect(after.filter(r=>before.some(b=>b.message_id===r.message_id&&b.revision_no===r.revision_no&&b.seq===r.seq))).toEqual(before);
  expect(after.filter(r=>r.thread_key===thread).map(r=>[r.seq,r.revision_no])).toEqual([[1,1],[2,1],[3,3],[4,2]]);
  expect((await heads())[0].last_seq).toBe(4);
  // the second application replaced the trigger: it is enabled again, for every session role (ENABLE ALWAYS comes after the replacement, which sets the state back to O), and numbers the next revision
  expect((await q<{tgenabled:string}>("SELECT tgenabled FROM pg_trigger WHERE tgname='source_event_revisions_thread_position' AND NOT tgisinternal"))[0].tgenabled).toBe('A');
  await s.ingest(messageEvent({context:{replyToMessageId:root.context.messageId}}));
  expect((await heads())[0].last_seq).toBe(5);
});

test('A8 (i) 023 stops above the cap on the revisions that carry no number, with its own words, and creates nothing; revisions that are numbered do not count',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),forward=await forwardSql();
  await h.exec(rollback);
  await fourOldRevisions();
  expect(await count('source_event_revisions')).toBe(4);
  await expect(h.exec("SET LOCAL libetech.thread_order_max_rows = '3';\n"+forward)).rejects.toThrow(/more revisions without a thread number than libetech\.thread_order_max_rows/);
  await h.exec('ROLLBACK');
  for(const t of TABLES) expect(await regclass('public.'+t),t).toBeNull();
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toEqual([]);
  // exactly at the cap it runs; the cap is the one thing the setting changes
  await h.exec("SET LOCAL libetech.thread_order_max_rows = '4';\n"+forward);
  expect(await count('source_revision_positions')).toBe(4);
  // the numbering costs what there is to number (review R-DB-2): all four revisions carry a number now, so a cap of three, below the number of revisions, stops nothing; the file
  // runs again and changes no number. This is the way to put the trigger back (W9, A7b) on a table of any size.
  const stable={positions:await numbers(),heads:await heads()};
  await h.exec("SET LOCAL libetech.thread_order_max_rows = '3';\n"+forward);
  expect({positions:await numbers(),heads:await heads()}).toEqual(stable);
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toHaveLength(1);
  await h.exec(rollback);
  await h.exec(forward);
  expect(await count('source_revision_positions')).toBe(4);
});

test('A8 (ii) 023 stops when it is applied by a role that is not a superuser, and creates nothing',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),forward=await forwardSql();
  await h.exec(rollback);
  await expect(h.exec('SET ROLE libetech_runtime;\n'+forward)).rejects.toThrow(/must be applied by a superuser/);
  await h.exec('ROLLBACK');
  await h.exec('RESET ROLE');
  for(const t of TABLES) expect(await regclass('public.'+t),t).toBeNull();
  expect(await regclass('public.source_event_revisions')).not.toBeNull();
  expect(await q("SELECT 1 FROM pg_proc WHERE proname='source_event_revisions_thread_position'")).toEqual([]);
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toEqual([]);
  // the operator login is a superuser: the same file runs
  expect((await q<{s:boolean}>('SELECT rolsuper s FROM pg_roles WHERE rolname=current_user'))[0].s).toBe(true);
  await h.exec(forward);
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toHaveLength(1);
});

test('A8 (iii) the file carries the check that refuses while a login that can act as libetech_ai is connected, and only for a login that is not a superuser; the check comes after the locks',async()=>{
  const code=(await forwardSql()).replace(/--.*$/gm,'').replace(/\s+/g,' ');
  for(const part of ['pg_catalog.pg_stat_activity','pg_catalog.pg_roles','NOT r.rolsuper',"pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER')",'a.pid <> pg_catalog.pg_backend_pid()',
    'a.datname = pg_catalog.current_database()','login that can act as libetech_ai is connected']) expect(code,part).toContain(part);
  // The branch that refuses is a behaviour case (A10, A11) for the condition of the SQL, with the name of the AI role replaced by the name of a role that a login of the harness is a
  // member of. What is still not shown is the real name: no login that is a member of libetech_ai exists in this PR (condition N14).
  expect(await q("SELECT count(*)::int n FROM pg_roles r WHERE r.rolcanlogin AND NOT r.rolsuper AND pg_has_role(r.oid,'libetech_ai','MEMBER')")).toEqual([{n:0}]);
  // The order of the file (reviews R-DB-1, R-S-3): the check of the superuser, the locks on the revision table and on the draft table, the check of the logins under them, and
  // only then the first table. One lock on the revision table, the one at the top: the lock that stood at step 8 is gone.
  const at=(t:string)=>code.indexOf(t);
  // The lock on the decision table is the third of the three and is taken by a second run only (class sweep CS-DB-7): inside a block that asks whether the counter table exists, which it
  // does only once the file has been applied. A first application has no confirmation trigger to deadlock with, and the lock would stop every decision for the length of the numbering.
  const again="IF pg_catalog.to_regclass('public.intake_thread_heads') IS NOT NULL THEN";
  const order=['must be applied by a superuser','LOCK TABLE public.source_event_revisions IN SHARE ROW EXCLUSIVE MODE','LOCK TABLE intelligence.ai_drafts IN SHARE ROW EXCLUSIVE MODE',
    again,'LOCK TABLE public.draft_decisions IN SHARE ROW EXCLUSIVE MODE','pg_catalog.pg_stat_activity','CREATE TABLE IF NOT EXISTS public.intake_thread_heads'].map(at);
  expect(order.every(i=>i>-1),'every part of the order is in the file').toBe(true);
  expect([...order].sort((a,b)=>a-b)).toEqual(order);
  expect(code.split('LOCK TABLE public.source_event_revisions').length-1).toBe(1);
  expect(code.split('LOCK TABLE public.draft_decisions').length-1,'one lock on the decision table at step 1').toBe(1);
  expect(code,'the lock on the decision table is taken only by a second run, and nothing else is in the block').toContain(`DO $$ BEGIN ${again} LOCK TABLE public.draft_decisions IN SHARE ROW EXCLUSIVE MODE; END IF; END $$;`);
  // the statistics before the step that holds ACCESS EXCLUSIVE on the decision table (R-DB-7), and the trigger of the intake half replaced in place: a second run takes no
  // ACCESS EXCLUSIVE on the revision table (A12)
  expect(at('ANALYZE public.source_revision_positions')).toBeGreaterThan(-1);
  expect(at('ANALYZE public.source_revision_positions')).toBeLessThan(at('ALTER TABLE public.draft_decisions ADD COLUMN'));
  expect(code).toContain('CREATE OR REPLACE TRIGGER source_event_revisions_thread_position');
  expect(code).not.toContain('DROP TRIGGER IF EXISTS source_event_revisions_thread_position');
  // the numbering trigger is enabled for every session role AFTER the replacement (the replacement sets the state back to O), so that a session with session_replication_role = replica
  // fires it too and takes the counter row (class sweep CS-DB-1)
  const always='ALTER TABLE public.source_event_revisions ENABLE ALWAYS TRIGGER source_event_revisions_thread_position';
  expect(code.split(always).length-1).toBe(1);
  expect(at(always)).toBeGreaterThan(at('CREATE OR REPLACE TRIGGER source_event_revisions_thread_position'));
  expect(at(always)).toBeLessThan(at('ALTER TABLE public.draft_decisions ADD COLUMN'));
  // the check of the logins is made twice, both times under the two locks (review R-S-8): right after them, and again right before the record of the migration, after every step
  // that can wait (the step that adds the column waits for the readers of the decision table: A14)
  const checks=[...code.matchAll(/pg_catalog\.pg_stat_activity/g)].map(m=>m.index!);
  expect(checks).toHaveLength(2);
  expect(code.split("pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER')").length-1).toBe(2);
  expect(checks[0]).toBeGreaterThan(at('LOCK TABLE intelligence.ai_drafts IN SHARE ROW EXCLUSIVE MODE'));
  expect(checks[1]).toBeGreaterThan(at('CREATE TRIGGER draft_decisions_subject_order_guard'));
  expect(checks[1]).toBeLessThan(at('INSERT INTO schema_migrations'));
  // the default of the cap is 250 000 (what the cap counts is A8 (i))
  expect(code).toContain("'250000'");
});

// Native only: PGlite has one connection, so a second session cannot be open while the file runs.
test.skipIf(!native)('A8 (iii) with other superuser sessions open (an idle one, one that did SET LOCAL ROLE libetech_ai) the file still runs',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),forward=await forwardSql();
  await h.exec(rollback);
  let applied=false;
  await h.operator.transaction(async tx=>{
    // a session of the migration login that acts as the AI role for the length of its transaction: its login is still a superuser (measurements 9a, 9b)
    await tx.query('SET LOCAL ROLE libetech_ai');
    await h.exec(forward);
    applied=true;
  });
  expect(applied).toBe(true);
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toHaveLength(1);
});

// The answer is the one of the foreign key of 016 on (source_event_id, tenant_id, project_id): its check trigger (RI_ConstraintTrigger_*) sorts before
// source_event_revisions_thread_position and triggers of one event fire in name order, so the foreign key refuses first. The NOT FOUND branch of the
// trigger function is defence in depth: it cannot be reached while the foreign key exists.
test('A9 a revision whose source event is not visible is refused by the foreign key, and the answer names no id and no number',async()=>{
  const s=svc(),theirs=messageEvent({context:{chatId:chatTransport}});
  await s.ingest(theirs);
  const transport=(await q<{id:string}>('SELECT id FROM source_events WHERE chat_id=$1 AND message_id=$2',[chatTransport,theirs.context.messageId]))[0].id;
  const before={positions:await count('source_revision_positions'),heads:await heads()};
  // in the scope of the role (the sales project) and with the event of the transport project
  const e=await refusal(as('libetech_intake',[ids.sales],tx=>tx.query(revSql,[ids.tenant,ids.sales,transport,2,hex('9'),hex('8')]))) as {code?:string;message:string;detail?:string;hint?:string;constraint?:string}|null;
  expect(e).not.toBeNull();
  expect(e!.code).toBe('23503');
  expect(e!.constraint).toMatch(/^source_event_revisions_source_event_id_tenant_id_project/);
  const said=[e!.message,e!.detail,e!.hint].filter(Boolean).join(' ');
  expect(said).not.toMatch(/[0-9a-f]{8}-/);
  expect(said).not.toMatch(/[0-9]/);
  expect(await count('source_revision_positions')).toBe(before.positions);
  expect(await heads()).toEqual(before.heads);
});

// ---- The confirming half (steps 10 and 11 of 023): draft_decisions.subject_thread_seq and draft_decisions_subject_order_guard ----
// A decision row is inserted raw, as the runtime role in the scope of the caller, for a draft about a candidate that the intake service really created.
type Told={code?:string;message:string;detail?:string;hint?:string;where?:string;constraint?:string};
const SOURCES='[{"ref":"synthetic-source"}]';
const GUARD='draft_decisions_subject_order_guard';
// The sentence of S-6, in the header of the file and in the comment of the column: the column does not prove that the rules of the service ran.
const NOT_NULL_SENTENCE='subject_thread_seq IS NOT NULL chỉ chứng minh rằng không bản nào được nhận vào luồng giữa lúc số được đọc và lúc quyết định được ghi; nó không chứng minh nháp đã qua phép kiểm nào của dịch vụ';

/** A candidate that exists because the service took in a message; `thread` is its thread key. */
async function realCandidate(over:EventOverride={}){
  const event=messageEvent(over),thread='m:'+event.context.messageId;
  await svc().ingest(event);
  const c=(await q<{id:string}>('SELECT id FROM intake_candidates WHERE chat_id=$1 AND thread_key=$2',[event.context.chatId,thread]))[0];
  return {id:c.id,event,thread};
}
const position=async(thread:string)=>(await heads()).find(r=>r.thread_key===thread)!.last_seq;
const anotherMessage=(c:{event:{context:{messageId:string}}})=>svc().ingest(messageEvent({context:{replyToMessageId:c.event.context.messageId}}));
/** A draft written as the operational login (the AI role is not what these cases are about): one source, value hash hex('c'). */
const draftOf=async(entityType:'intake_candidate'|'document',entityId:string,o:{project?:string;tenant?:string;sources?:string}={})=>
  (await q<{id:string}>(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,sources,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
    VALUES($1,$2,$3,$4,'intake_analyst','1',$5,'m','{}',$5,$6::jsonb,1,$5,$4,$4,$7) RETURNING id`,[o.tenant??ids.tenant,o.project??ids.sales,entityType,entityId,hex('c'),o.sources??SOURCES,'thread-order-'+randomUUID()]))[0].id;
const decisionVals=(draft:string,over:Record<string,unknown>={}):Record<string,unknown>=>({tenant_id:ids.tenant,project_id:ids.sales,draft_id:draft,draft_value_hash:hex('c'),result:'confirmed',reason:'',
  decided_by:pm.id,command_key:'thread-order-'+randomUUID(),request_id:randomUUID(),trace_id:randomUUID(),subject_thread_seq:null,...over});
const insertDecision=(tx:Queryable,draft:string,over:Record<string,unknown>={})=>{
  const v=decisionVals(draft,over),keys=Object.keys(v);
  return tx.query(`INSERT INTO draft_decisions(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`,keys.map(k=>v[k]));
};
/** The insert as the runtime role in the scope `projects` (default: the sales project); null when it is stored, else the error. */
const decide=(draft:string,over:Record<string,unknown>={},projects:string[]=[ids.sales])=>refusal(asRuntime(projects,tx=>insertDecision(tx,draft,over))) as Promise<Told|null>;
const decisionCount=async(draft?:string)=>(await q<{n:number}>(draft?'SELECT count(*)::int n FROM draft_decisions WHERE draft_id=$1':'SELECT count(*)::int n FROM draft_decisions',draft?[draft]:[]))[0].n;
const storedPosition=async(draft:string)=>(await q<{s:number|null}>('SELECT subject_thread_seq::int s FROM draft_decisions WHERE draft_id=$1',[draft]))[0]?.s;
/** One transaction that always rolls back: the operational login first (for the statements that need it), then the runtime role in scope. */
const asRuntimeAfter=(before:(tx:Queryable)=>Promise<void>,fn:(tx:Queryable)=>Promise<unknown>,projects:string[]=[ids.sales])=>{
  const done=new Error('rolled back on purpose');
  return refusal(h.operator.transaction(async tx=>{
    await before(tx);
    await tx.query('SET LOCAL ROLE libetech_runtime');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)",[ids.tenant,projects.join(','),pm.id]);
    await fn(tx);
    throw done;
  })).then(e=>(e as unknown)===done?null:e) as Promise<Told|null>;
};

test('B1 a confirmed decision of a candidate draft is stored only with the current position of its thread',async()=>{
  const c=await realCandidate();
  await anotherMessage(c);
  const read=await position(c.thread);
  expect(read).toBe(2);
  const draft=await draftOf('intake_candidate',c.id);
  // the position was read, then a message arrived: the thread has moved on
  await anotherMessage(c);
  const now=await position(c.thread);
  expect(now).toBe(read+1);
  const headsBefore=await heads();
  for(const [label,seq] of [['the position that was read before a message arrived',read],['a larger position',now+1],['no position',null]] as const){
    const e=await decide(draft,{subject_thread_seq:seq});
    expect(e,label).not.toBeNull();
    expect(e!.code,label).toBe('LTZ03');
    expect(await decisionCount(draft),label).toBe(0);
  }
  // a candidate that does not exist
  const ghost=await draftOf('intake_candidate',randomUUID());
  expect((await decide(ghost,{subject_thread_seq:1}))?.code).toBe('LTZ03');
  // a candidate whose thread has no counter row: a root event and its candidate, no numbered revision
  const bare=await rawEvent(chatSales,'9301','m:9301');
  const bareCandidate=(await q<{id:string}>("INSERT INTO intake_candidates(tenant_id,project_id,chat_id,thread_key,root_source_event_id) VALUES($1,$2,$3,'m:9301',$4) RETURNING id",[ids.tenant,ids.sales,chatSales,bare]))[0].id;
  const orphan=await draftOf('intake_candidate',bareCandidate);
  expect((await decide(orphan,{subject_thread_seq:1}))?.code).toBe('LTZ03');
  expect(await decisionCount()).toBe(0);
  // refusals moved nothing: the counter rows are as they were
  expect(await heads()).toEqual(headsBefore);
  // the current position is stored, and the column carries it
  expect(await decide(draft,{subject_thread_seq:now})).toBeNull();
  expect(await decisionCount(draft)).toBe(1);
  expect(await storedPosition(draft)).toBe(now);
  expect(await heads()).toEqual(headsBefore);
});

test('B2 a rejection, and any decision of a document draft, carries no thread position',async()=>{
  const c=await realCandidate();
  const pos=await position(c.thread);
  const draft=await draftOf('intake_candidate',c.id),doc=await draftOf('document',randomUUID());
  // a rejection with a position, and a confirmation with a position that is not positive: the constraint
  for(const [label,over] of [['a rejection with a position',{result:'rejected',reason:'Lý do đủ dài',subject_thread_seq:pos}],
    ['a confirmation with position 0',{subject_thread_seq:0}],['a confirmation with a negative position',{subject_thread_seq:-1}]] as const){
    const e=await decide(draft,over);
    expect(e,label).not.toBeNull();
    expect(e!.code,label).toBe('23514');
    expect(e!.message,label).toMatch(/draft_decisions_thread_seq_only_confirmed/);
  }
  // a confirmation of a document draft with a position: refused by the trigger
  expect((await decide(doc,{subject_thread_seq:pos}))?.code).toBe('LTZ03');
  expect(await decisionCount()).toBe(0);
  // with the constraint out of the way the trigger refuses the rejection by itself (defence in depth); the transaction rolls back
  const alone=await asRuntimeAfter(async tx=>{await tx.query('ALTER TABLE draft_decisions DROP CONSTRAINT draft_decisions_thread_seq_only_confirmed');},
    tx=>insertDecision(tx,draft,{result:'rejected',reason:'Lý do đủ dài',subject_thread_seq:pos}));
  expect(alone?.code).toBe('LTZ03');
  expect(alone?.where).toContain(GUARD);
  expect(await q("SELECT 1 FROM pg_constraint WHERE conname='draft_decisions_thread_seq_only_confirmed'")).toHaveLength(1);
  // neither carries a position: stored, as before 023
  expect(await decide(draft,{result:'rejected',reason:'Lý do đủ dài'})).toBeNull();
  expect(await decide(doc)).toBeNull();
  expect(await decisionCount()).toBe(2);
  expect(await storedPosition(draft)).toBeNull();expect(await storedPosition(doc)).toBeNull();
});

test('B3 the answer of the guard names no id and no number',async()=>{
  const c=await realCandidate();
  const pos=await position(c.thread);
  const draft=await draftOf('intake_candidate',c.id),doc=await draftOf('document',randomUUID()),ghost=await draftOf('intake_candidate',randomUUID());
  await anotherMessage(c);
  const told:[string,Told|null][]=[
    ['a position that has become old',await decide(draft,{subject_thread_seq:pos})],
    ['no position',await decide(draft,{subject_thread_seq:null})],
    ['a candidate that does not exist',await decide(ghost,{subject_thread_seq:1})],
    ['a position on a document draft',await decide(doc,{subject_thread_seq:pos})],
  ];
  const messages=new Set<string>();
  for(const [label,e] of told){
    expect(e,label).not.toBeNull();
    expect(e!.code,label).toBe('LTZ03');
    const said=[e!.message,e!.detail,e!.hint].filter(Boolean).join(' ');
    expect(said,label).not.toMatch(/[0-9a-f]{8}-/);
    expect(said,label).not.toMatch(/[0-9]/);
    messages.add(e!.message);
  }
  // one fixed sentence for all the causes
  expect(messages.size).toBe(1);
  // the check constraint, under the runtime role: the answer does not carry the row that was refused
  const e=await decide(draft,{result:'rejected',reason:'Lý do đủ dài',subject_thread_seq:pos});
  expect(e?.code).toBe('23514');
  const said=[e!.message,e!.detail,e!.hint].filter(Boolean).join(' ');
  expect(said).not.toMatch(/[0-9a-f]{8}-/);
  expect(e!.detail??'').not.toMatch(/Failing row/);
});

test('B4 a decision about a draft outside the caller\'s scope never reaches the thread',async()=>{
  const mine=await realCandidate(),theirs=await realCandidate({context:{chatId:chatTransport}});
  const draftMine=await draftOf('intake_candidate',mine.id),draftTheirs=await draftOf('intake_candidate',theirs.id,{project:ids.transport});
  const headsBefore=await heads();
  const theirPos=await position(theirs.thread),minePos=await position(mine.thread);
  // a draft of another project, the row naming that project or its own: draft_decisions_guard (BEFORE) does not see the draft under the scope of the caller
  for(const project of [ids.transport,ids.sales]){
    const e=await decide(draftTheirs,{project_id:project,subject_thread_seq:theirPos},[ids.sales]);
    expect(e,project).not.toBeNull();
    expect(e!.code,project).toBe('P0001');
    expect(e!.message,project).toBe('A decision names a draft of its own project');
    expect(e!.where,project).toContain('draft_decisions_guard');
    expect(e!.where,project).not.toContain(GUARD);
  }
  // a draft in scope, decided_by another person: row-level security, which answers before the AFTER trigger
  const other=await decide(draftMine,{decided_by:randomUUID(),subject_thread_seq:minePos});
  expect(other).not.toBeNull();
  expect(other!.code).toBe('42501');
  expect(other!.message).toMatch(/row-level security/);
  // a draft of this project that names a candidate of another project (written by the operational login): the candidate is looked up in the project of the decision,
  // so the thread of the other project is not read, locked or compared, whatever position the row carries
  const crossed=await draftOf('intake_candidate',theirs.id);
  const across=await decide(crossed,{subject_thread_seq:theirPos});
  expect(across).not.toBeNull();
  expect(across!.code).toBe('LTZ03');
  expect(await decisionCount()).toBe(0);
  expect(await heads()).toEqual(headsBefore);
  // the same chat and thread key in two projects (raw rows): the sales project has a thread under that key, the transport project has a candidate under it. A draft of the
  // sales project that names the candidate of the transport project is not judged against the thread that the sales project happens to hold under the same key
  const shared='m:9400';
  await rawRevision(await rawEvent(chatSales,'9401',shared),1,new Date().toISOString(),'a');
  const transportRoot=await rawEvent(chatSales,'9402',shared,ids.transport);
  const sharedCandidate=(await q<{id:string}>('INSERT INTO intake_candidates(tenant_id,project_id,chat_id,thread_key,root_source_event_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [ids.tenant,ids.transport,chatSales,shared,transportRoot]))[0].id;
  const sharedPos=await position(shared);
  expect(sharedPos).toBe(1);
  const sharedDraft=await draftOf('intake_candidate',sharedCandidate);
  expect((await decide(sharedDraft,{subject_thread_seq:sharedPos}))?.code).toBe('LTZ03');
  expect(await decisionCount()).toBe(0);
});

test('B5 the catalog of the confirming half: the trigger is AFTER INSERT, the function is definer with the three settings, runtime may insert the new column and nothing else changed; a second run changes nothing',async()=>{
  await realCandidate();
  const shape=async()=>({
    triggers:await q(`SELECT tgname,tgtype::int,tgenabled,pg_get_triggerdef(oid) d FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.draft_decisions'::regclass ORDER BY 1`),
    functions:await q(`SELECT p.proname,p.prosecdef,p.proconfig,p.proacl::text acl,pg_get_userbyid(p.proowner) owner,pg_get_functiondef(p.oid) d FROM pg_proc p
      WHERE p.pronamespace='public'::regnamespace AND p.proname='${GUARD}'`),
    column:await q(`SELECT a.attname,format_type(a.atttypid,a.atttypmod) t,a.attnotnull,a.atthasdef,a.attacl::text acl,col_description(a.attrelid,a.attnum) comment FROM pg_attribute a
      WHERE a.attrelid='public.draft_decisions'::regclass AND a.attname='subject_thread_seq' AND NOT a.attisdropped`),
    constraint:await q("SELECT conname,contype,convalidated,pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname='draft_decisions_thread_seq_only_confirmed'"),
    indexes:await q("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='draft_decisions' ORDER BY 1"),
  });
  const first=await shape();
  // the triggers of the table, by timing: 021 and 022 BEFORE INSERT (tgtype 7), 023 AFTER INSERT (tgtype 5), the history guard BEFORE UPDATE OR DELETE (tgtype 27); all enabled for every session role
  const byName=Object.fromEntries((first.triggers as {tgname:string;tgtype:number;tgenabled:string;d:string}[]).map(t=>[t.tgname,t]));
  expect(Object.keys(byName).sort()).toEqual(['draft_decisions_guard','draft_decisions_immutable','draft_decisions_pointer_only_guard',GUARD]);
  expect(byName[GUARD]).toMatchObject({tgtype:5,tgenabled:'O'});
  expect(byName[GUARD].d).toMatch(/AFTER INSERT ON (public\.)?draft_decisions FOR EACH ROW EXECUTE FUNCTION (public\.)?draft_decisions_subject_order_guard\(\)/);
  for(const n of ['draft_decisions_guard','draft_decisions_pointer_only_guard']) expect(byName[n],n).toMatchObject({tgtype:7,tgenabled:'O'});
  expect(byName.draft_decisions_immutable).toMatchObject({tgtype:27,tgenabled:'O'});
  // the function: definer, the three settings, owned by a role that row-level security does not bind, executable by nobody else
  expect(first.functions).toHaveLength(1);
  const fn=first.functions[0] as {prosecdef:boolean;proconfig:string[];owner:string;d:string};
  expect(fn.prosecdef).toBe(true);
  // four settings: the three of the numbering function and plan_cache_mode = force_custom_plan (class sweep CS-DB-4: from the sixth execution in a backend a generic plan makes the
  // scan for revisions without a number 20 to 25 per cent slower, which is time spent holding the counter row)
  expect([...fn.proconfig].sort()).toEqual(['lock_timeout=5s','plan_cache_mode=force_custom_plan','row_security=off','search_path=pg_catalog, pg_temp']);
  expect((await q<{ok:boolean}>('SELECT (r.rolsuper OR r.rolbypassrls) ok FROM pg_roles r WHERE r.rolname=$1',[fn.owner]))[0].ok).toBe(true);
  expect(await q(`SELECT coalesce(r.rolname,'PUBLIC') grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee
    WHERE p.proname='${GUARD}' AND a.privilege_type='EXECUTE' AND a.grantee<>p.proowner`)).toEqual([]);
  for(const role of ['libetech_runtime','libetech_intake','libetech_ai','libetech_web'])
    expect((await q<{ok:boolean}>(`SELECT has_function_privilege($1,'public.${GUARD}()','EXECUTE') ok`,[role]))[0].ok,role).toBe(false);
  // the column: bigint, no default, may be empty; its comment carries the sentence of S-6; the constraint is there and validated
  expect(first.column).toHaveLength(1);
  expect(first.column[0]).toMatchObject({attname:'subject_thread_seq',t:'bigint',attnotnull:false,atthasdef:false});
  expect((first.column[0] as {comment:string}).comment).toContain(NOT_NULL_SENTENCE);
  expect(first.constraint).toHaveLength(1);
  expect(first.constraint[0]).toMatchObject({contype:'c',convalidated:true});
  // only the runtime role may insert the column, and nothing else of the table was granted: the insertable columns are the eleven of 021 and the new one
  expect(await q(`SELECT coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type p FROM pg_attribute t CROSS JOIN LATERAL aclexplode(t.attacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
    WHERE t.attrelid='public.draft_decisions'::regclass AND t.attname='subject_thread_seq'`)).toEqual([{grantee:'libetech_runtime',p:'INSERT'}]);
  const cols=async(role:string,priv:string)=>(await q<{c:string}>(`SELECT a.attname c FROM pg_attribute a WHERE a.attrelid='public.draft_decisions'::regclass AND a.attnum>0 AND NOT a.attisdropped
    AND has_column_privilege($1,a.attrelid,a.attnum,$2) ORDER BY 1`,[role,priv])).map(r=>r.c);
  expect(await cols('libetech_runtime','INSERT')).toEqual(['command_key','decided_by','document_revision_id','draft_id','draft_value_hash','project_id','reason','request_id','result','subject_thread_seq','tenant_id','trace_id']);
  for(const {rolname} of await q<{rolname:string}>("SELECT rolname FROM pg_roles WHERE rolname LIKE 'libetech\\_%' ORDER BY 1")){
    expect(await cols(rolname,'UPDATE'),rolname+' UPDATE').toEqual([]);
    if(rolname!=='libetech_runtime') for(const p of ['INSERT','SELECT','REFERENCES']) expect(await cols(rolname,p),rolname+' '+p).toEqual([]);
  }
  // the second run: nothing changes (DB-1: a trigger created twice would fail here with 42710; ADD COLUMN IF NOT EXISTS and the guarded constraint add nothing)
  await h.exec(await forwardSql());
  expect(await shape()).toEqual(first);
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toHaveLength(1);
});

test('B6 each guard of 021 and 022 still fires on a candidate draft of a real candidate, and before the guard of 023',async()=>{
  const c=await realCandidate();
  const pos=await position(c.thread);
  const draft=await draftOf('intake_candidate',c.id),unsourced=await draftOf('intake_candidate',c.id,{sources:'[]'});
  const headsBefore=await heads();
  // each case also carries NO position: if the guard of 023 were reached first, the answer would be LTZ03
  const first=async(label:string,draftId:string,over:Record<string,unknown>,code:string|undefined,message:string,fn:string)=>{
    const e=await decide(draftId,{subject_thread_seq:null,...over});
    expect(e,label).not.toBeNull();
    if(code) expect(e!.code,label).toBe(code);
    expect(e!.code,label).not.toBe('LTZ03');
    expect(e!.message,label).toBe(message);
    expect(e!.where,label).toContain(fn);
    expect(e!.where,label).not.toContain(GUARD);
    expect(await decisionCount(draftId),label).toBe(0);
  };
  // 021
  await first('021 a wrong value hash',draft,{draft_value_hash:hex('d')},undefined,'A decision carries the value hash of the draft it answers','draft_decisions_guard');
  await first('021 a draft that names no source',unsourced,{},undefined,'A draft that names no source cannot be confirmed','draft_decisions_guard');
  await first('021 a revision attached to a candidate draft',draft,{document_revision_id:randomUUID()},undefined,'A revision can only be attached to a draft about that very document','draft_decisions_guard');
  // 022: not READ COMMITTED
  const rr=await refusal(h.operator.transaction(async tx=>{
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await tx.query('SET LOCAL ROLE libetech_runtime');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)",[ids.tenant,ids.sales,pm.id]);
    await insertDecision(tx,draft,{subject_thread_seq:null});
  })) as Told|null;
  expect(rr?.code).toBe('LTZ02');
  expect(rr?.message).toBe('A draft is confirmed in a READ COMMITTED transaction');
  expect(rr?.where).toContain('draft_decisions_pointer_only_guard');
  expect(rr?.where).not.toContain(GUARD);
  // everything right: stored, and the column carries the position
  expect(await decide(draft,{subject_thread_seq:pos})).toBeNull();
  expect(await storedPosition(draft)).toBe(pos);
  // 022: a project that is IBS_HI (another draft of the same candidate: one decision per draft)
  const later=await draftOf('intake_candidate',c.id);
  await mapDomain(h,ids.sales,'IBS_HI',1);
  await first('022 an IBS_HI project',later,{},'LTZ01','A draft of a pointer-only project is not confirmed','draft_decisions_pointer_only_guard');
  expect(await heads()).toEqual(headsBefore);
});

test('B7 the guard of 023 refuses a confirmation outside READ COMMITTED by itself when the guard of 022 is switched off; the transaction rolls back',async()=>{
  const c=await realCandidate();
  const pos=await position(c.thread);
  const draft=await draftOf('intake_candidate',c.id);
  const done=new Error('rolled back on purpose');
  const e=await refusal(h.operator.transaction(async tx=>{
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await tx.query('ALTER TABLE draft_decisions DISABLE TRIGGER draft_decisions_pointer_only_guard');
    await tx.query('SET LOCAL ROLE libetech_runtime');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)",[ids.tenant,ids.sales,pm.id]);
    await insertDecision(tx,draft,{subject_thread_seq:pos});
    throw done;
  })) as Told|null;
  expect(e).not.toBe(done);
  expect(e?.code).toBe('LTZ02');
  expect(e?.where).toContain(GUARD);
  expect(e?.message).toMatch(/READ COMMITTED/);
  expect(e?.message).not.toBe('A draft is confirmed in a READ COMMITTED transaction');
  expect(await decisionCount()).toBe(0);
  expect((await q<{tgenabled:string}>("SELECT tgenabled FROM pg_trigger WHERE tgname='draft_decisions_pointer_only_guard' AND NOT tgisinternal"))[0].tgenabled).toBe('O');
});

// ---- After the tier-1 reviews (task 2b) ----
const latch=()=>{let open!:()=>void;const promise=new Promise<void>(r=>{open=r;});return {promise,open};};
/** The statement `p` (which never rejects) is in flight and waits for a lock: it has not settled while `n` sessions are blocked. */
const inFlight=async(p:Promise<unknown>,n=1)=>{
  const first=await Promise.race([p.then(()=>'settled' as const),waitForBlocked(h,n).then(()=>'blocked' as const)]);
  expect(first,'the statement was expected to wait for a lock').toBe('blocked');
};
/** As asRuntimeAfter, for any role: the operational login prepares, then the role acts in the scope; the transaction always rolls back; the answer is the error, null when the statement went through. */
const asRoleAfter=(role:string,before:(tx:Queryable)=>Promise<void>,fn:(tx:Queryable)=>Promise<unknown>,projects:string[]=[ids.sales])=>{
  const done=new Error('rolled back on purpose');
  return refusal(h.operator.transaction(async tx=>{
    await before(tx);
    await tx.query(`SET LOCAL ROLE ${role}`);
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.intake_principal_id',$3,true),set_config('app.person_id',$3,true)",[ids.tenant,projects.join(','),pm.id]);
    await fn(tx);
    throw done;
  })).then(e=>(e as unknown)===done?null:e) as Promise<Told|null>;
};

// R-DB-9, R-S-5: the NOT FOUND branch of the trigger of the intake half. The foreign key of the revision table answers first (A9); with the foreign keys off, in a transaction that rolls back,
// the trigger answers by itself, and it looks the source event up under the tenant and the project of the revision.
test('A9b with the foreign keys of the revision table switched off in one transaction, the trigger refuses a revision whose source event is of another project, by itself and with a sentence that names no id and no number',async()=>{
  const theirs=messageEvent({context:{chatId:chatTransport}});
  await svc().ingest(theirs);
  const transport=(await q<{id:string}>('SELECT id FROM source_events WHERE chat_id=$1 AND message_id=$2',[chatTransport,theirs.context.messageId]))[0].id;
  const before={positions:await count('source_revision_positions'),heads:await heads(),revisions:await count('source_event_revisions')};
  const off=async(tx:Queryable)=>{
    // every trigger of the table off (the foreign keys are triggers), then the one under test on again
    await tx.query('ALTER TABLE source_event_revisions DISABLE TRIGGER ALL');
    await tx.query('ALTER TABLE source_event_revisions ENABLE TRIGGER source_event_revisions_thread_position');
  };
  // in the scope of the role (the sales project), naming the event of the transport project
  const e=await asRoleAfter('libetech_intake',off,tx=>tx.query(revSql,[ids.tenant,ids.sales,transport,2,hex('9'),hex('8')]));
  expect(e).not.toBeNull();
  expect(e!.code).toBe('23503');
  expect(e!.message).toBe('The source event of a revision is not visible');
  expect(e!.where).toContain('source_event_revisions_thread_position');
  const said=[e!.message,e!.detail,e!.hint].filter(Boolean).join(' ');
  expect(said).not.toMatch(/[0-9a-f]{8}-/);
  expect(said).not.toMatch(/[0-9]/);
  // the transaction rolled back: nothing stored, no trigger left off
  expect(await count('source_event_revisions')).toBe(before.revisions);
  expect(await count('source_revision_positions')).toBe(before.positions);
  expect(await heads()).toEqual(before.heads);
  // no trigger left off: every trigger of the table is on (O), and the numbering trigger is on for every session role (A)
  expect((await q<{n:number}>("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='public.source_event_revisions'::regclass AND tgenabled NOT IN ('O','A')"))[0].n).toBe(0);
  expect((await q<{tgenabled:string}>("SELECT tgenabled FROM pg_trigger WHERE tgname='source_event_revisions_thread_position' AND NOT tgisinternal"))[0].tgenabled).toBe('A');
});

// R-DB-4, R-S-4: the refusal for a connected login of the AI role, as behaviour. No login of that role exists (condition N14), but the condition of the SQL is about roles in general: the file
// read from disk is run with the name of the AI role replaced, in the one predicate that asks about it, by the name of the runtime role, of which the login of the web service
// (libetech_web, not a superuser) is a member.
const AI_PREDICATE="pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER')";
const REFUSES=/refuses to run while a login that can act as libetech_ai is connected/;
const withRuntimeAsAi=async()=>{
  const sql=await forwardSql();
  // every place that asks about the AI role (A8 (iii) counts them: two checks)
  expect(sql.split(AI_PREDICATE).length-1,'the predicate that names the AI role is in the file').toBeGreaterThanOrEqual(1);
  return sql.split(AI_PREDICATE).join(AI_PREDICATE.replace('libetech_ai','libetech_runtime'));
};
const nothingOf023=async()=>{
  for(const t of TABLES) expect(await regclass('public.'+t),t).toBeNull();
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toEqual([]);
  expect(await q("SELECT 1 FROM pg_proc WHERE proname IN ('source_event_revisions_thread_position','draft_decisions_subject_order_guard')")).toEqual([]);
  expect(await q("SELECT 1 FROM pg_attribute WHERE attrelid='public.draft_decisions'::regclass AND attname='subject_thread_seq' AND NOT attisdropped")).toEqual([]);
};

// Native only: the case needs sessions of other logins while the file runs.
test.skipIf(!native)('A10 the refusal for a connected login of the role: a session of a login that is not a superuser stops the file, a session of a superuser does not, even one acting as that role',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),probe=await withRuntimeAsAi();
  await h.exec(rollback);
  // sessions of the migration login (a superuser) are open, one of them acting as the runtime role for the length of its transaction: neither is counted, and the file runs
  await h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_runtime');
    await h.exec(probe);
  });
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toHaveLength(1);
  await h.exec(rollback);
  await nothingOf023();
  // the web login (not a superuser, a member of the runtime role) has a session open, even idle in a transaction: the file stops, with its own words, and creates nothing
  await h.db.transaction(async web=>{
    await web.query('SELECT 1');
    await expect(h.exec(probe)).rejects.toThrow(REFUSES);
  });
  await nothingOf023();
});

// R-DB-1: the file waits for a message that is in flight before it looks at the logins. Before the fix it looked first and then waited, so a login that connected during the wait was not seen.
test.skipIf(!native)('A11 the file waits for a transaction that is taking in a message and looks at the logins only after the wait: a login that connects while it waits stops it',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),probe=await withRuntimeAsAi();
  await h.exec(rollback);
  const web=latch(),opened=latch();
  let applying!:Promise<Told|null>,webDone:Promise<unknown>=Promise.resolve();
  try {
    await h.operator.transaction(async tx=>{
      // a message in flight: its event and its revision are written, the transaction is open
      const event=(await tx.query<{id:string}>(eventSql,[ids.tenant,ids.sales,'gw-9501',chatSales,'9501','m:9501',randomUUID()])).rows[0].id;
      await tx.query(revSql,[ids.tenant,ids.sales,event,1,hex('6'),hex('b')]);
      applying=refusal(h.exec(probe)) as Promise<Told|null>;
      await inFlight(applying);
      // the file waits for the lock of the revision table; no login of the role was connected when it began. One connects now.
      webDone=h.db.transaction(async w=>{await w.query('SELECT 1');opened.open();await web.promise;});
      await Promise.race([opened.promise,webDone]);
    });
    // the message commits; the file goes on, looks, finds the login and stops
    const e=await applying;
    expect(e,'the file was expected to stop').not.toBeNull();
    expect(e!.message).toMatch(REFUSES);
  } finally {
    web.open();
    await webDone;
  }
  await nothingOf023();
});

// R-DB-7: a second run replaces the trigger of the revision table in place.
test.skipIf(!native)('A12 applying 023 again takes no lock that a reader of the revision table would wait for; a reader of the decision table does wait',async()=>{
  const forward=await forwardSql();
  await svc().ingest(messageEvent({}));
  // a reader holds ACCESS SHARE on the revision table to the end of its transaction: the second run goes through (it takes SHARE ROW EXCLUSIVE at most)
  const free=await h.operator.transaction(async reader=>{
    await reader.query('SELECT count(*) FROM source_event_revisions');
    return refusal(h.exec(forward)) as Promise<Told|null>;
  });
  expect(free,'a reader of the revision table made the second run wait').toBeNull();
  // the control that gives the probe its meaning: the step that adds the column holds ACCESS EXCLUSIVE on the decision table, and a reader of that table makes the file wait out its cap
  const waited=await h.operator.transaction(async reader=>{
    await reader.query('SELECT count(*) FROM draft_decisions');
    return refusal(h.exec(forward)) as Promise<Told|null>;
  });
  expect(waited?.code).toBe('55P03');
  // and the two new tables (review R-DB-12): steps 2 and 3 drop and create their triggers and policies again, which takes ACCESS EXCLUSIVE on them to the end of the transaction,
  // so a reader of them waits as well. The header of the file says so; this is the case that keeps the header true.
  const waitedNew=await h.operator.transaction(async reader=>{
    await reader.query('SELECT count(*) FROM intake_thread_heads');
    return refusal(h.exec(forward)) as Promise<Told|null>;
  });
  expect(waitedNew?.code).toBe('55P03');
},40000);

test('B8 the same chat and thread key in two projects and in two tenants, each with its own counter row: a confirmation is judged against the counter row of its own scope',async()=>{
  const key='m:9700';
  // one thread key under one chat, three scopes: sales (one revision), transport (three), the project of the other tenant (two). Raw rows; the trigger of 023 numbers them.
  const build=async(name:string,tenant:string,project:string,revisions:number)=>{
    const event=(await q<{id:string}>(eventSql,[tenant,project,'gw-'+name,chatSales,name,key,randomUUID()]))[0].id;
    for(let n=1;n<=revisions;n++) await q(`INSERT INTO source_event_revisions(${REV_COLS}) VALUES($1,$2,$3,$4,$5,$6,'pointer_only')`,[tenant,project,event,n,hex(String(n)),hex('b')]);
    const candidate=(await q<{id:string}>('INSERT INTO intake_candidates(tenant_id,project_id,chat_id,thread_key,root_source_event_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[tenant,project,chatSales,key,event]))[0].id;
    return {name,tenant,project,seq:revisions,draft:await draftOf('intake_candidate',candidate,{tenant,project})};
  };
  const scopes=[await build('9701',ids.tenant,ids.sales,1),await build('9702',ids.tenant,ids.transport,3),await build('9703',ids.otherTenant,ids.otherProject,2)];
  expect((await q<{n:number}>('SELECT last_seq::int n FROM intake_thread_heads WHERE thread_key=$1 ORDER BY 1',[key])).map(r=>r.n)).toEqual([1,2,3]);
  const confirm=(s:{tenant:string;project:string;draft:string},seq:number)=>refusal(scoped(h.db,{...pm,tenantId:s.tenant,projectIds:[s.project]},async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);
    return insertDecision(tx,s.draft,{tenant_id:s.tenant,project_id:s.project,subject_thread_seq:seq});
  })) as Promise<Told|null>;
  // the numbers of the other scopes are not the number of this one: refused, for each scope and each foreign number
  for(const s of scopes) for(const other of scopes.filter(o=>o!==s)){
    const e=await confirm(s,other.seq);
    expect(e,`${s.name} with the number of ${other.name}`).not.toBeNull();
    expect(e!.code,`${s.name} with the number of ${other.name}`).toBe('LTZ03');
  }
  expect(await decisionCount()).toBe(0);
  // its own number: stored
  for(const s of scopes) expect(await confirm(s,s.seq),s.name).toBeNull();
  expect(await decisionCount()).toBe(3);
});

test('B9 with the guard of 021, the guard of 022 and the foreign keys switched off in one transaction, the lookups of the guard of 023 refuse by themselves',async()=>{
  const mine=await realCandidate(),theirs=await realCandidate({context:{chatId:chatTransport}});
  const draftMine=await draftOf('intake_candidate',mine.id),draftTheirs=await draftOf('intake_candidate',theirs.id,{project:ids.transport});
  // a draft of the sales project that names the candidate of the transport project
  const crossed=await draftOf('intake_candidate',theirs.id);
  const minePos=await position(mine.thread),theirPos=await position(theirs.thread);
  const off=async(tx:Queryable)=>{
    // every trigger of the decision table off (the guards of 021 and 022 and the foreign keys), then the one under test on again
    await tx.query('ALTER TABLE draft_decisions DISABLE TRIGGER ALL');
    await tx.query(`ALTER TABLE draft_decisions ENABLE TRIGGER ${GUARD}`);
  };
  // the control that gives the rest its meaning: a decision that is right goes through with the others off (the transaction rolls back, so nothing is stored)
  expect(await asRuntimeAfter(off,tx=>insertDecision(tx,draftMine,{subject_thread_seq:minePos}))).toBeNull();
  // a draft of another project, named by a row of the project in scope: the draft is looked up in the project of the row
  const a=await asRuntimeAfter(off,tx=>insertDecision(tx,draftTheirs,{subject_thread_seq:theirPos}));
  expect(a).not.toBeNull();
  expect(a!.code).toBe('P0001');
  expect(a!.message).toBe('A decision names a draft of its own project');
  expect(a!.where).toContain(GUARD);
  // a draft of the project in scope that names a candidate of another project: the candidate is looked up in the project of the row
  const b=await asRuntimeAfter(off,tx=>insertDecision(tx,crossed,{subject_thread_seq:theirPos}));
  expect(b).not.toBeNull();
  expect(b!.code).toBe('LTZ03');
  expect(b!.where).toContain(GUARD);
  expect(await decisionCount()).toBe(0);
  expect((await q<{n:number}>("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='public.draft_decisions'::regclass AND tgenabled<>'O'"))[0].n).toBe(0);
});

// R-S-3: the lock on the draft table. A draft that is being written when the file begins is waited for, and then seen by the check of refusal 4. Without the lock the check ran while
// the draft was not yet committed, did not see it, and let the file number revisions that the draft had been written before.
test.skipIf(!native)('A13 the file waits for an AI draft that is being written and then refuses because of it: an undecided draft of a candidate while revisions carry no number',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),forward=await forwardSql();
  await h.exec(rollback);
  await fourOldRevisions();
  let applying!:Promise<Told|null>;
  try {
    await h.operator.transaction(async tx=>{
      // the draft is written and its transaction is open
      await tx.query(draftSql,[ids.tenant,ids.sales,randomUUID(),hex('c'),'thread-order-draft-13a']);
      applying=refusal(h.exec(forward)) as Promise<Told|null>;
      await inFlight(applying);
    });
    // the draft commits; the file goes on, sees it, and stops with its own words
    const e=await applying;
    expect(e,'the file was expected to stop').not.toBeNull();
    expect(e!.message).toMatch(/no person has decided/);
    await nothingOf023();
    // the draft that was waited for is stored as written
    expect(await count('intelligence.ai_drafts')).toBe(1);
  } finally {
    // the draft is an undecided one, which would stop the file again when the case puts it back (and the next case could not open): the rows go first
    await h.reset();
  }
});

// ---- After the second look at the fix round (task 2c) ----

// R-S-8: the second check of the logins. A login of the role that connects after the first check, while the file waits at a later step, is found by the check at the end.
test.skipIf(!native)('A14 a login of the role that connects after the first check and before the commit stops the file: the check is made again right before the record of the migration',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),probe=await withRuntimeAsAi();
  await h.exec(rollback);
  const web=latch(),opened=latch();
  let applying!:Promise<Told|null>,webDone:Promise<unknown>=Promise.resolve();
  try {
    await h.operator.transaction(async reader=>{
      // a reader of the decision table holds ACCESS SHARE on it: the step that adds the column (ACCESS EXCLUSIVE) waits for it, after the first check and before the second
      await reader.query('SELECT count(*) FROM draft_decisions');
      applying=refusal(h.exec(probe)) as Promise<Told|null>;
      await inFlight(applying);
      // no login of the role was connected when the file began or when it passed the first check. One connects now.
      webDone=h.db.transaction(async w=>{await w.query('SELECT 1');opened.open();await web.promise;});
      await Promise.race([opened.promise,webDone]);
    });
    // the reader ends; the file goes on, reaches the second check, finds the login and stops
    const e=await applying;
    expect(e,'the file was expected to stop').not.toBeNull();
    expect(e!.message).toMatch(REFUSES);
  } finally {
    web.open();
    await webDone;
  }
  await nothingOf023();
});

// R-S-9: the hooks that put the switched-off triggers back (restoreGuards, run before and after every case). H1 switches the guard of 022 and the numbering trigger off with committed
// statements and ends without putting them back; H2 runs after it, on the same native database (cases of a file run in order), and finds both on. Without the hooks H2 is red.
test.skipIf(!native)('H1 a case that switches the guard of 022 and the numbering trigger off with committed statements and ends without putting them back',async()=>{
  await h.exec('ALTER TABLE public.draft_decisions DISABLE TRIGGER draft_decisions_pointer_only_guard');
  await h.exec('ALTER TABLE public.source_event_revisions DISABLE TRIGGER source_event_revisions_thread_position');
  expect(await q("SELECT tgname,tgenabled FROM pg_trigger WHERE tgname IN ('draft_decisions_pointer_only_guard','source_event_revisions_thread_position') AND NOT tgisinternal ORDER BY 1"))
    .toEqual([{tgname:'draft_decisions_pointer_only_guard',tgenabled:'D'},{tgname:'source_event_revisions_thread_position',tgenabled:'D'}]);
});

test.skipIf(!native)('H2 the case that follows finds both on, each as the file leaves it (O for the guard, A for the numbering trigger): the hooks put them back',async()=>{
  expect(await q("SELECT tgname,tgenabled FROM pg_trigger WHERE tgname IN ('draft_decisions_pointer_only_guard','source_event_revisions_thread_position') AND NOT tgisinternal ORDER BY 1"))
    .toEqual([{tgname:'draft_decisions_pointer_only_guard',tgenabled:'O'},{tgname:'source_event_revisions_thread_position',tgenabled:'A'}]);
});

// ---- Codex gate, round 1 (P1), and the class sweep before round 2: a revision that no number was given to ----
// The comparison of last_seq sees only revisions that the numbering trigger saw. Two things now hold. (1) The numbering trigger is enabled for every session role (ENABLE ALWAYS), so a
// session with session_replication_role = replica (a restore) fires it, takes the counter row and numbers its revision: the counter row moves, and a confirmation that read the old
// position is stale. (2) The trigger of the decision table refuses while the numbering trigger is not enabled, and while any revision of the thread has no number (the rule of the service
// at the database): what is left is the owner of the table switching the numbering trigger off by name, writing, and switching it on again in one transaction.
/** A revision that stays without a number, committed: the table owner switches the numbering trigger off by name, writes, and switches it on again for every role (the state the file gives it), in one transaction (T16). */
const leaveUnnumbered=(project:string,event:string,no:number)=>h.operator.transaction(async tx=>{
  await tx.query('ALTER TABLE public.source_event_revisions DISABLE TRIGGER source_event_revisions_thread_position');
  await tx.query(revSql,[ids.tenant,project,event,no,hex(String(no)),hex('b')]);
  await tx.query('ALTER TABLE public.source_event_revisions ENABLE ALWAYS TRIGGER source_event_revisions_thread_position');
});
/** A revision written by a session with session_replication_role = replica, as a restore does, committed. */
const writeAsRestore=(project:string,event:string,no:number)=>h.operator.transaction(async tx=>{
  await tx.query('SET LOCAL session_replication_role = replica');
  await tx.query(revSql,[ids.tenant,project,event,no,hex(String(no)),hex('b')]);
});
const unnumberedCount=async()=>(await q<{n:number}>('SELECT count(*)::int n FROM source_event_revisions r WHERE NOT EXISTS (SELECT 1 FROM source_revision_positions p WHERE p.revision_id=r.id)'))[0].n;
const eventOf=async(chat:string,message:string)=>(await q<{id:string}>('SELECT id FROM source_events WHERE chat_id=$1 AND message_id=$2',[chat,message]))[0].id;

test('B10 a revision written by a restore is numbered, so the position that was read is stale; a revision left without a number refuses a confirmation whatever position it carries, in its own thread only',async()=>{
  // the state that the file leaves, whatever an earlier case or file left on a shared database
  await h.exec(await forwardSql());
  const a=await realCandidate();await anotherMessage(a);
  const posA=await position(a.thread),root=await eventOf(chatSales,a.event.context.messageId);
  const draftA=await draftOf('intake_candidate',a.id);
  expect(await unnumberedCount()).toBe(0);
  // (1) a restore: a session with session_replication_role = replica writes one more revision of the thread. The numbering trigger fires for it (ENABLE ALWAYS): the revision has a number
  // and the counter row moves on, so the position that the service read is stale
  await writeAsRestore(ids.sales,root,2);
  expect(await unnumberedCount()).toBe(0);
  const posNow=await position(a.thread);
  expect(posNow).toBe(posA+1);
  const headsBefore=await heads();
  const e=await decide(draftA,{subject_thread_seq:posA});
  expect(e).not.toBeNull();
  expect(e!.code).toBe('LTZ03');
  expect(e!.message).toBe('The thread of the candidate moved on');
  const said=[e!.message,e!.detail,e!.hint].filter(Boolean).join(' ');
  expect(said).not.toMatch(/[0-9a-f]{8}-/);
  expect(said).not.toMatch(/[0-9]/);
  expect(await decisionCount()).toBe(0);
  expect(await heads()).toEqual(headsBefore);
  // (2) the owner switches the numbering trigger off by name, writes a revision and switches it on again in one transaction (T16): the revision has no number and the counter row does not move
  await leaveUnnumbered(ids.sales,root,3);
  expect(await unnumberedCount()).toBe(1);
  expect(await position(a.thread)).toBe(posNow);
  expect((await decide(draftA,{subject_thread_seq:posNow}))?.code).toBe('LTZ03');
  expect(await decisionCount()).toBe(0);
  // the check is about the thread of the candidate: a revision without a number in the thread of A does not stop a confirmation of another thread of the same project ...
  const b=await realCandidate(),draftB=await draftOf('intake_candidate',b.id);
  expect(await decide(draftB,{subject_thread_seq:await position(b.thread)})).toBeNull();
  // ... nor one of a thread whose chat and thread key another project has too, with a revision without a number of its own there
  const d=await realCandidate(),draftD=await draftOf('intake_candidate',d.id);
  const foreign=await rawEvent(chatSales,'9951',d.thread,ids.transport);
  await leaveUnnumbered(ids.transport,foreign,1);
  expect(await unnumberedCount()).toBe(2);
  expect(await decide(draftD,{subject_thread_seq:await position(d.thread)})).toBeNull();
  expect(await decisionCount()).toBe(2);
  // the invariant clears when the revision is numbered again: the file numbers it (a person decides the undecided draft first, refusal 4 of the file), and the position of the thread
  // moves on by that revision, so the position that was read is stale and the new one is stored
  expect(await decide(draftA,{result:'rejected',reason:'Lý do đủ dài'})).toBeNull();
  await h.exec(await forwardSql());
  expect(await unnumberedCount()).toBe(0);
  const posA2=await position(a.thread);
  expect(posA2).toBe(posNow+1);
  const draftA2=await draftOf('intake_candidate',a.id);
  expect((await decide(draftA2,{subject_thread_seq:posNow}))?.code).toBe('LTZ03');
  expect(await decide(draftA2,{subject_thread_seq:posA2})).toBeNull();
  expect(await storedPosition(draftA2)).toBe(posA2);
});

// Class sweep CS-DB-1: a numbering trigger that is not enabled leaves no revision a number, and a revision written while it is off would be invisible to the comparison for the whole time.
// While it is not enabled (D off, or gone) no confirmation of a candidate draft goes through, whatever the thread says; O and A both pass.
test('B11 a confirmation is refused while the numbering trigger is switched off or gone, though the thread has not changed; enabled, for the origin role (O) or for every role (A), it is stored',async()=>{
  await h.exec(await forwardSql());
  const c=await realCandidate();await anotherMessage(c);
  const pos=await position(c.thread);
  const [d1,d2,d3,d4,d5]=[await draftOf('intake_candidate',c.id),await draftOf('intake_candidate',c.id),await draftOf('intake_candidate',c.id),await draftOf('intake_candidate',c.id),await draftOf('intake_candidate',c.id)];
  const table='public.source_event_revisions',trigger='source_event_revisions_thread_position';
  const headsBefore=await heads();
  // switched off with a committed statement (the state that a restore with the triggers disabled leaves): no confirmation goes through
  await h.exec(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
  const off=await decide(d1,{subject_thread_seq:pos});
  expect(off).not.toBeNull();
  expect(off!.code).toBe('LTZ03');
  expect(off!.message).toBe('The thread of the candidate moved on');
  expect(await decisionCount()).toBe(0);
  expect(await unnumberedCount()).toBe(0);
  expect(await heads()).toEqual(headsBefore);
  // enabled for every session role: stored
  await h.exec(`ALTER TABLE ${table} ENABLE ALWAYS TRIGGER ${trigger}`);
  expect(await decide(d1,{subject_thread_seq:pos}),'enabled for every role (A)').toBeNull();
  // enabled for the origin role (the plain ENABLE): stored as well
  await h.exec(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
  expect(await decide(d2,{subject_thread_seq:pos}),'enabled for the origin role (O)').toBeNull();
  expect(await decisionCount()).toBe(2);
  // in one transaction, which rolls back: switched off by name, switched off with every trigger of the table (DISABLE TRIGGER ALL), and dropped: refused in that transaction
  const inTx=(before:string,draft:string)=>asRuntimeAfter(async tx=>{await tx.query(before);},tx=>insertDecision(tx,draft,{subject_thread_seq:pos}));
  for(const [label,before,draft] of [['off by name',`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`,d3],['every trigger off',`ALTER TABLE ${table} DISABLE TRIGGER ALL`,d4],['dropped',`DROP TRIGGER ${trigger} ON ${table}`,d5]] as const){
    const e=await inTx(before,draft);
    expect(e,label).not.toBeNull();
    expect(e!.code,label).toBe('LTZ03');
  }
  expect(await decisionCount()).toBe(2);
  // the transactions rolled back: the trigger is there, on
  expect((await q<{tgenabled:string}>(`SELECT tgenabled FROM pg_trigger WHERE tgname='${trigger}' AND NOT tgisinternal`))[0].tgenabled).toBe('O');
  // the state of the file again (the hooks also put it back)
  await h.exec(`ALTER TABLE ${table} ENABLE ALWAYS TRIGGER ${trigger}`);
});

// Class sweep CS-DB-6: the name and the state are not enough. The owner of the table can create the trigger again under the same name, enabled, and make it do nothing: with a WHEN condition that never
// holds, on UPDATE instead of INSERT, or calling another function. The check reads the kind (AFTER INSERT, for each row: tgtype 5), the absence of a WHEN condition (tgqual) and the function (tgfoid).
// What it does not read is the body of the function: replacing that is the same hand as the owner switching the guards off, the trust boundary of R19 and R37 (stated in the header).
test('B11b a confirmation is refused while the numbering trigger has the right name and state but would not number a revision (a WHEN condition, another event, another function); applying 023 again puts it right',async()=>{
  const table='public.source_event_revisions',trigger='source_event_revisions_thread_position',other='public.thread_order_not_the_numbering_function';
  await h.exec(await forwardSql());
  const c=await realCandidate();await anotherMessage(c);
  const pos=await position(c.thread);
  const recreate=(event:string,when:string,fn:string)=>`CREATE OR REPLACE TRIGGER ${trigger} ${event} ON ${table} FOR EACH ROW ${when} EXECUTE FUNCTION ${fn}()`;
  const mine=`public.${trigger}`;
  const variants:[string,string][]=[
    ['a WHEN condition that never holds',recreate('AFTER INSERT','WHEN (false)',mine)],
    ['AFTER UPDATE, not AFTER INSERT',recreate('AFTER UPDATE','',mine)],
    ['another function',recreate('AFTER INSERT','',other)],
  ];
  const state=async()=>(await q<{tgenabled:string}>(`SELECT tgenabled FROM pg_trigger WHERE tgname='${trigger}' AND tgrelid='${table}'::regclass AND NOT tgisinternal`))[0].tgenabled;
  try {
    await h.exec(`CREATE FUNCTION ${other}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$`);
    let decisions=0;
    for(const [label,ddl] of variants){
      const draft=await draftOf('intake_candidate',c.id);
      await h.exec(ddl);
      // the state that the old check let through: enabled for the origin role, nothing unnumbered in the thread, the position current
      expect(await state(),label).toBe('O');
      expect(await unnumberedCount(),label).toBe(0);
      const e=await decide(draft,{subject_thread_seq:pos});
      expect(e,label).not.toBeNull();
      expect(e!.code,label).toBe('LTZ03');
      expect(e!.message,label).toBe('The thread of the candidate moved on');
      expect(await decisionCount(),label).toBe(decisions);
      // put right: a person decides the undecided draft (refusal 4 of the file), then the file is applied again
      expect(await decide(draft,{result:'rejected',reason:'Lý do đủ dài'}),label).toBeNull();decisions++;
      await h.exec(await forwardSql());
      expect(await state(),label).toBe('A');
      expect(await position(c.thread),label).toBe(pos);
      const again=await draftOf('intake_candidate',c.id);
      expect(await decide(again,{subject_thread_seq:pos}),label).toBeNull();decisions++;
      expect(await decisionCount(),label).toBe(decisions);
    }
  } finally {
    // whatever happened, the shared database is left with the trigger of the file
    await h.exec('ROLLBACK').catch(()=>{});
    await h.reset();
    await h.exec(await forwardSql());
    await h.exec(`DROP FUNCTION IF EXISTS ${other}()`);
  }
});

// Class sweep CS-DB-3: the order of the locks of a second run. The file holds the counter table from step 2 on (it drops and creates the triggers and policies again) and asks for the decision
// table at step 10; a confirmation that had written its row (a lock on the decision table) and then asked for the counter row in its trigger waited for the file, which waited for it: 40P01.
// A second run takes the decision table at step 1 (SHARE ROW EXCLUSIVE: inserts wait; the lock is for a second run only, CS-DB-7 and A16), so such a confirmation waits at its INSERT, holding nothing,
// and goes through after the file. The case is a second run: the file is applied already, and the raw confirmation is the one that has read nothing of the thread.
test.skipIf(!native)('A15 a confirmation that is written while the file is applied again does not deadlock with it: it waits for the file and is then stored',async()=>{
  const forward=await forwardSql();
  const c=await realCandidate();await anotherMessage(c);
  const pos=await position(c.thread),draft=await draftOf('intake_candidate',c.id);
  let applying!:Promise<Told|null>,confirming!:Promise<Told|null>;
  await h.operator.transaction(async reader=>{
    // a reader of the counter table holds ACCESS SHARE on it: the second run waits for it at step 2, holding the locks of step 1
    await reader.query('SELECT count(*) FROM intake_thread_heads');
    applying=refusal(h.exec(forward)) as Promise<Told|null>;
    await inFlight(applying);
    // a confirmation that has read nothing of the thread yet: it writes its row and reads the counter row in the trigger
    confirming=decide(draft,{subject_thread_seq:pos});
    await inFlight(confirming,2);
  });
  expect(await applying,'the file was expected to apply').toBeNull();
  expect(await confirming,'the confirmation was expected to be stored, not 40P01').toBeNull();
  expect(await decisionCount(draft)).toBe(1);
  expect(await storedPosition(draft)).toBe(pos);
});

// Class sweep CS-DB-7: the price of the lock of step 1. On a first application nothing waits for the decision table's lock to avoid a deadlock (the confirmation trigger does not exist yet), and
// SHARE ROW EXCLUSIVE there would stop every decision for the length of the numbering (1 961 ms against 14 ms, measured at 150 000 revisions). So a first application holds none of it from step 1
// and ACCESS EXCLUSIVE only from step 10; a second run holds it from step 1 (A15 is the case that needs it). Read from pg_locks in the open transaction of the file cut at a marker, then rolled back.
test('A16 the first application of the file takes no SHARE ROW EXCLUSIVE lock on the decision table at step 1, a second run does; the first two locks are taken either way',async()=>{
  needsForward=true;
  const forward=await forwardSql(),rollback=await rollbackSql();
  const upTo=(marker:string)=>{const i=forward.indexOf(marker);expect(i,marker).toBeGreaterThan(-1);return forward.slice(0,i);};
  const held=async(table:string)=>(await q<{mode:string}>('SELECT l.mode FROM pg_locks l WHERE l.pid=pg_backend_pid() AND l.locktype=\'relation\' AND l.relation=$1::regclass AND l.granted ORDER BY 1',[table])).map(r=>r.mode);
  /** The file up to the marker, its own BEGIN included; the locks it holds; the transaction rolled back. */
  const probe=async(marker:string)=>{
    await h.exec(upTo(marker));
    try {
      return {revisions:await held('public.source_event_revisions'),drafts:await held('intelligence.ai_drafts'),decisions:await held('public.draft_decisions')};
    } finally {
      await h.exec('ROLLBACK');
    }
  };
  const SRE='ShareRowExclusiveLock',AEL='AccessExclusiveLock';
  // step 1 is the file up to step 2; "after the numbering" is the file up to step 10 (the trigger of step 11 and its drop take other locks on the decision table, so the end says nothing about step 1)
  const step1='-- Step 2: the counter row of a thread.',numbered='-- Step 10: the position a confirmation carries.',end='INSERT INTO schema_migrations';
  // a first application: 023 is not there
  await h.exec(rollback);
  expect(await regclass('public.intake_thread_heads')).toBeNull();
  const first1=await probe(step1);
  expect(first1.revisions,'first application, revision table').toContain(SRE);
  expect(first1.drafts,'first application, draft table').toContain(SRE);
  expect(first1.decisions,'first application, decision table, step 1').not.toContain(SRE);
  expect(first1.decisions).not.toContain(AEL);
  const first2=await probe(numbered);
  expect(first2.decisions,'first application, decision table, after the numbering (steps 2 to 9): still no SHARE ROW EXCLUSIVE').not.toContain(SRE);
  expect(first2.decisions,'first application, decision table, before step 10: no ACCESS EXCLUSIVE yet').not.toContain(AEL);
  expect(first2.revisions).toContain(SRE);
  const first3=await probe(end);
  expect(first3.decisions,'first application, decision table, end: ACCESS EXCLUSIVE from step 10').toContain(AEL);
  // a second run: the file is there
  await h.exec(forward);
  expect(await regclass('public.intake_thread_heads')).not.toBeNull();
  const again1=await probe(step1);
  expect(again1.revisions,'second run, revision table').toContain(SRE);
  expect(again1.drafts,'second run, draft table').toContain(SRE);
  expect(again1.decisions,'second run, decision table, step 1').toContain(SRE);
  expect(again1.decisions).not.toContain(AEL);
  const again2=await probe(numbered);
  expect(again2.decisions,'second run, decision table, after the numbering').toContain(SRE);
  expect(again2.decisions,'second run, decision table, before step 10').not.toContain(AEL);
  const again3=await probe(end);
  expect(again3.decisions,'second run, decision table, end').toEqual(expect.arrayContaining([SRE,AEL]));
});

// The header says what is closed and what is not (class sweep CS-DB-1): the replica path and a numbering trigger that is off or gone are closed; what remains is the table owner switching the
// trigger off by name, writing and switching it on again in one transaction without the counter row, the trust boundary of R19 and R37 of PR #22; and the rule for a maintenance session that
// writes a revision without a number on purpose (take the counter row FOR UPDATE first), which is condition N15.
test('A8 (iv) the header says what is closed, the rule for a maintenance session, and the boundary that remains',async()=>{
  const head=(await forwardSql()).split('\nBEGIN;')[0];
  for(const part of ['ENABLE ALWAYS','session_replication_role','FOR UPDATE','N15','R19','R37','DISABLE TRIGGER','one transaction','trust boundary']) expect(head,part).toContain(part);
  // the earlier wording of the limit (the replica path is not an open window any more)
  expect(head).not.toContain('The path exists only for a session that bypasses the numbering trigger');
  expect(head).not.toContain('It is stated, not closed (L7)');
});

// Class sweep, review of the fix (CS-DB-6, CS-DB-7, CS-DB-8): what the header has to say after the second look.
test('A8 (v) the header says what the check of the numbering trigger reads and what it does not, the lock window of a first application, and what a loader of its own has to do',async()=>{
  const head=(await forwardSql()).split('\nBEGIN;')[0].replace(/^-- ?/gm,'').replace(/\s+/g,' ');
  // CS-DB-6: the three things the check reads besides the name and the state, and the one thing it does not read
  for(const part of ['tgtype','tgqual','tgfoid','AFTER INSERT','WHEN','CS-DB-6','the body of the function']) expect(head,part).toContain(part);
  // CS-DB-7: the decision table is locked at step 1 by a second run only; a first application holds ACCESS EXCLUSIVE there from step 10 only
  for(const part of ['CS-DB-7','second run only','first application']) expect(head,part).toContain(part);
  expect(head).not.toContain('the three tables from step 1');
  expect(head).not.toContain('on intelligence.ai_drafts (no draft is written) and on public.draft_decisions (no decision is written)');
  // CS-DB-8: a loader of its own that runs under session_replication_role = replica fails now, and what to do; pg_restore sets the state back to O
  for(const part of ['CS-DB-8','loader','23503','23505','DISABLE TRIGGER','pg_restore --disable-triggers','ENABLE ALWAYS TRIGGER','the intent of ENABLE ALWAYS']) expect(head,part).toContain(part);
});
