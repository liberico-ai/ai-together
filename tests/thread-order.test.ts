import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import {IntakeService} from '../src/server/intake';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent} from './slice2-fixtures';

// Migration 023, the intake half (OQ-53 point 3 (b)): a number per thread for every stored revision, a counter row per thread, and the refusals of the file.
// The cases that need two connections are in thread-order-concurrency.test.ts (native PostgreSQL only).
const file=(p:string)=>readFile(path.join(process.cwd(),p),'utf8');
const forwardSql=()=>file('migrations/023_thread_order.sql');
const rollbackSql=()=>file('migrations/rollback/023_thread_order.sql');
const hex=(c:string)=>c.repeat(64);
const TABLES=['intake_thread_heads','source_revision_positions'];
const OTHER_ROLES=['libetech_intake','libetech_ai','libetech_identity','libetech_auth','libetech_projector','libetech_outbox_audit','libetech_intake_svc'];

let h:Harness;
let needsForward=false;
beforeEach(async()=>{needsForward=false;h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{
  await h.exec('ROLLBACK').catch(()=>{});
  // a case that rolled 023 back puts it back before the harness truncates: the database may be a shared native one
  if(needsForward) await h.exec(await forwardSql());
  await h.reset();await h.close();
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
  const first=await shape();
  // both tables: ENABLE and FORCE, and exactly one policy each: the SELECT of the runtime role, with the condition of 016
  expect(first.classes).toEqual([{relname:'intake_thread_heads',relrowsecurity:true,relforcerowsecurity:true,relkind:'r'},{relname:'source_revision_positions',relrowsecurity:true,relforcerowsecurity:true,relkind:'r'}]);
  const ref=(await q<{qual:string}>("SELECT qual FROM pg_policies WHERE tablename='source_event_revisions' AND policyname='runtime_select'"))[0].qual;
  expect(first.policies).toEqual(TABLES.map(t=>({tablename:t,policyname:'runtime_select',cmd:'SELECT',roles:'{libetech_runtime}',qual:ref,with_check:null})).sort((a,b)=>a.tablename.localeCompare(b.tablename)));
  // the revision table: the immutability trigger of 016 and one AFTER INSERT row trigger of 023, enabled for every session role
  const rev=first.triggers.filter(t=>t.t==='source_event_revisions') as {tgname:string;tgtype:number;tgenabled:string}[];
  expect(rev.map(t=>t.tgname)).toEqual(expect.arrayContaining(['source_event_revisions_immutable','source_event_revisions_thread_position']));
  expect(rev.find(t=>t.tgname==='source_event_revisions_thread_position')).toMatchObject({tgtype:5,tgenabled:'O'});
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
  // the second application replaced the trigger: it is enabled again and numbers the next revision
  expect((await q<{tgenabled:string}>("SELECT tgenabled FROM pg_trigger WHERE tgname='source_event_revisions_thread_position' AND NOT tgisinternal"))[0].tgenabled).toBe('O');
  await s.ingest(messageEvent({context:{replyToMessageId:root.context.messageId}}));
  expect((await heads())[0].last_seq).toBe(5);
});

test('A8 (i) 023 stops above the cap on the number of revisions, with its own words, and creates nothing; without the setting it runs',async()=>{
  needsForward=true;
  const rollback=await rollbackSql(),forward=await forwardSql();
  await h.exec(rollback);
  await fourOldRevisions();
  expect(await count('source_event_revisions')).toBe(4);
  await expect(h.exec("SET LOCAL libetech.thread_order_max_rows = '3';\n"+forward)).rejects.toThrow(/more rows than libetech\.thread_order_max_rows/);
  await h.exec('ROLLBACK');
  for(const t of TABLES) expect(await regclass('public.'+t),t).toBeNull();
  expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toEqual([]);
  // exactly at the cap it runs; the cap is the one thing the setting changes
  await h.exec("SET LOCAL libetech.thread_order_max_rows = '4';\n"+forward);
  expect(await count('source_revision_positions')).toBe(4);
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

test('A8 (iii) the file carries the check that refuses while a login that can act as libetech_ai is connected, and only for a login that is not a superuser',async()=>{
  const code=(await forwardSql()).replace(/--.*$/gm,'').replace(/\s+/g,' ');
  for(const part of ['pg_catalog.pg_stat_activity','pg_catalog.pg_roles','NOT r.rolsuper',"pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER')",'a.pid <> pg_catalog.pg_backend_pid()',
    'a.datname = pg_catalog.current_database()','login that can act as libetech_ai is connected']) expect(code,part).toContain(part);
  // the branch that refuses has no behaviour case in this PR: it needs a login that is a member of the AI role, and no login of that kind is created here (N14).
  expect(await q("SELECT count(*)::int n FROM pg_roles r WHERE r.rolcanlogin AND NOT r.rolsuper AND pg_has_role(r.oid,'libetech_ai','MEMBER')")).toEqual([{n:0}]);
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
