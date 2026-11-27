import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {reviewer,approver,seedMembers} from './slice3-fixtures';
import {intakePrincipalId} from './slice2-fixtures';
import {asRole,chatPool,hex,insertPoolItem,seedTech,techA,techB} from './pool-fixtures';
import {ids} from '../src/server/identities';

// GIAO VIỆC 5 B, T1: migration 025 (pool items, pool events, intake work links) and its row level security.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);await seedTech(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const exists=async(t:string)=>(await rows<{t:string|null}>('SELECT to_regclass($1)::text t',[t]))[0].t!==null;
const TABLES=['intake_pool_items','intake_pool_events','intake_work_links'];
const tech=(p=techA)=>({person:p.id,projects:p.projectIds});
const poolEvent=(item:string,over:R={})=>{
  const e={kind:'pool.triaged',actor:techA.id,kindActor:'user',...over};
  return ['INSERT INTO intake_pool_events(tenant_id,pool_item_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [ids.tenant,item,e.actor,e.kindActor,e.kind,randomUUID(),randomUUID(),JSON.stringify({state_before:'unassigned',state_after:'assigned'})]] as [string,unknown[]];
};
/** A request filed by `who` in the sales project, inserted by the operational login (the service path is T4). */
const request=async(who=techA.id,state='pending')=>{
  const id=randomUUID();
  await rows(`INSERT INTO work_requests(id,tenant_id,project_id,requester_id,requester_name,request_key,request_hash,title,origin,source_ref)
    VALUES($1,$2,$3,$4,'Tên thử',$5,$6,'Việc ghi để thử cách ly','intake','IN-TEST0001 · x')`,[id,ids.tenant,ids.sales,who,randomUUID(),hex(id)]);
  if(state!=='pending') throw new Error('only pending in this helper');
  return id;
};
const assign=(item:string,project:string)=>h.operator.transaction(async tx=>{
  await tx.query("SELECT set_config('app.person_id',$1,true)",[techA.id]);
  await tx.query("UPDATE intake_pool_items SET state='assigned',project_id=$2,classification='request',triaged_by=$3,triaged_at=now(),version=version+1 WHERE id=$1",[item,project,techA.id]);
});

test('(1) the three tables exist, and none of them has a column that could hold message text, a file name or a sender label',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  const cols=async(t:string)=>(await rows<{c:string}>(
    "SELECT column_name c FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND data_type IN ('text','character varying','jsonb','json') ORDER BY 1",[t])).map(r=>r.c);
  // the closed list of text-typed columns: every one is an id, a hash, a code, a mime type or a person's own name; none can carry a message
  expect(await cols('intake_pool_items')).toEqual(['attachment_mime','chat_id','classification','content_hash','dismiss_code','locator','message_id','reply_to_message_id','source_id','source_type','state','topic_id']);
  expect(await cols('intake_pool_events')).toEqual(['actor_kind','kind','payload']);
  // the payload accepts neither a request id nor a work id (the link row holds them)
  const idItem=await insertPoolItem(h);
  for(const key of ['work_request_id','work_id'])
    await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query('INSERT INTO intake_pool_events(tenant_id,pool_item_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,$3,\'user\',\'pool.request_filed\',$4,$5,$6)',
      [ids.tenant,idItem,techA.id,randomUUID(),randomUUID(),JSON.stringify({[key]:randomUUID()})])),key).rejects.toThrow();
  expect(await cols('intake_work_links')).toEqual(['created_by_name','source_key','target_key']);
  for(const t of TABLES) for(const c of await cols(t)) expect(c,t).not.toMatch(/text|excerpt|file_?name|label|caption|body|title|note|reason/i);
  // the event payload accepts ids, states and versions only
  const item=await insertPoolItem(h);
  await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query('INSERT INTO intake_pool_events(tenant_id,pool_item_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,$3,\'user\',\'pool.triaged\',$4,$5,$6)',
    [ids.tenant,item,techA.id,randomUUID(),randomUUID(),JSON.stringify({text:'một đoạn chữ'})]))).rejects.toThrow();
});

test('(2) no context gives no rows; another tenant gives no rows; writing with another tenant is refused',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  const item=await insertPoolItem(h);
  await asRole(h,'libetech_runtime',tech(),async tx=>{await tx.query(...poolEvent(item));});
  for(const [role,person] of [['libetech_runtime',techA.id],['libetech_intake',intakePrincipalId]] as const)
    for(const t of TABLES.slice(0,2)){
      // visible with the right context, so the zero below is the policy and not an empty table
      const seen=await asRole(h,role,{person},async tx=>(await tx.query(`SELECT 1 FROM ${t}`)).rows.length);
      expect(seen,role+' '+t+' with context').toBeGreaterThan(0);
      expect(await asRole(h,role,{tenant:null,person},async tx=>(await tx.query(`SELECT 1 FROM ${t}`)).rows.length),role+' '+t+' no context').toBe(0);
      expect(await asRole(h,role,{tenant:ids.otherTenant,person},async tx=>(await tx.query(`SELECT 1 FROM ${t}`)).rows.length),role+' '+t+' other tenant').toBe(0);
    }
  // the intake role writes an item for another tenant
  await expect(insertPoolItem(h,{tenant:ids.otherTenant})).rejects.toThrow();
  // the runtime role writes an event with another tenant's id
  await expect(asRole(h,'libetech_runtime',{tenant:ids.otherTenant,person:techA.id},async tx=>tx.query(...poolEvent(item)))).rejects.toThrow();
  // the table itself has no row for another tenant, and the one item stays one
  expect(Number((await rows<{n:string}>('SELECT count(*) n FROM intake_pool_items'))[0].n)).toBe(1);
});

test('(3) a person off the roster, even a project manager, reads no pool row and writes none; a roster member does',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  const item=await insertPoolItem(h);
  expect(await asRole(h,'libetech_runtime',tech(),async tx=>(await tx.query('SELECT id FROM intake_pool_items')).rows.length)).toBe(1);
  for(const p of [pm,member,reviewer,approver]){
    const ctx={person:p.id,projects:p.projectIds};
    expect(await asRole(h,'libetech_runtime',ctx,async tx=>(await tx.query('SELECT id FROM intake_pool_items')).rows.length),p.name).toBe(0);
    expect(await asRole(h,'libetech_runtime',ctx,async tx=>(await tx.query('SELECT id FROM intake_pool_events')).rows.length),p.name).toBe(0);
    expect(await asRole(h,'libetech_runtime',ctx,async tx=>(await tx.query("UPDATE intake_pool_items SET state='dismissed',dismiss_code='not_work',triaged_by=$2,triaged_at=now(),version=version+1 WHERE id=$1 RETURNING id",[item,p.id])).rows.length),p.name+' update').toBe(0);
    await expect(asRole(h,'libetech_runtime',ctx,async tx=>tx.query(...poolEvent(item,{actor:p.id})))).rejects.toThrow();
  }
  expect((await rows<{state:string}>('SELECT state FROM intake_pool_items WHERE id=$1',[item]))[0].state).toBe('unassigned');
});

test('(4) a member of project Y sees neither the link nor the request of a pool item assigned to project X',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  const item=await insertPoolItem(h);
  await assign(item,ids.sales);
  const req=await request(techA.id);
  await rows(`INSERT INTO intake_work_links(tenant_id,project_id,pool_item_id,work_request_id,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,'Tên thử')`,[ids.tenant,ids.sales,item,req,techA.id]);
  const links=(who:{person:string;projects:string[]})=>asRole(h,'libetech_runtime',who,async tx=>(await tx.query('SELECT id FROM intake_work_links')).rows.length);
  const reqs=(who:{person:string;projects:string[]})=>asRole(h,'libetech_runtime',who,async tx=>(await tx.query('SELECT id FROM work_requests')).rows.length);
  // the filer and a member of the project see them
  expect(await links(tech())).toBe(1);expect(await reqs(tech())).toBe(1);
  expect(await links({person:pm.id,projects:[ids.sales]})).toBe(1);
  // another Team Tech member, whose only grant is project Y (transport), sees the pool item but not the link or the request
  expect(await asRole(h,'libetech_runtime',tech(techB),async tx=>(await tx.query('SELECT id FROM intake_pool_items')).rows.length)).toBe(1);
  expect(await links(tech(techB))).toBe(0);expect(await reqs(tech(techB))).toBe(0);
  // a project manager of Y only
  expect(await links({person:pm.id,projects:[ids.transport]})).toBe(0);
});

test('(5) a link names its own creator, is never changed or deleted; an event is never changed or deleted; an assigned item keeps its project',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  const item=await insertPoolItem(h);
  await assign(item,ids.sales);
  const req=await request(techA.id);
  const link=(who:string,over:R={})=>['INSERT INTO intake_work_links(tenant_id,project_id,pool_item_id,work_request_id,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,\'Tên thử\') RETURNING id',
    [ids.tenant,ids.sales,item,over.request??req,who]] as [string,unknown[]];
  // someone else's id as creator: the policy refuses
  await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query(...link(techB.id)))).rejects.toThrow();
  const id=(await asRole(h,'libetech_runtime',tech(),async tx=>tx.query<{id:string}>(...link(techA.id)))).rows[0].id;
  // a request filed by somebody else cannot be linked by this person
  const other=await request(techB.id);
  await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query(...link(techA.id,{request:other})))).rejects.toThrow();
  // the same pair twice: one row (ON CONFLICT DO NOTHING is the idempotency; the unique key is the proof)
  const again=await asRole(h,'libetech_runtime',tech(),async tx=>tx.query("INSERT INTO intake_work_links(tenant_id,project_id,pool_item_id,work_request_id,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,'Tên thử') ON CONFLICT DO NOTHING RETURNING id",[ids.tenant,ids.sales,item,req,techA.id]));
  expect(again.rows).toHaveLength(0);
  // no change, no delete, for the runtime role and for the owner
  await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query("UPDATE intake_work_links SET created_by_name='Tên khác'"))).rejects.toThrow();
  await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query('DELETE FROM intake_work_links'))).rejects.toThrow();
  await expect(rows("UPDATE intake_work_links SET created_by_name='Tên khác' WHERE id=$1",[id])).rejects.toThrow();
  await expect(rows('DELETE FROM intake_work_links WHERE id=$1',[id])).rejects.toThrow();
  const ev=(await asRole(h,'libetech_runtime',tech(),async tx=>tx.query<{id:string}>(...poolEvent(item)))).rows[0].id;
  await expect(rows("UPDATE intake_pool_events SET kind='pool.revised' WHERE id=$1",[ev])).rejects.toThrow();
  await expect(rows('DELETE FROM intake_pool_events WHERE id=$1',[ev])).rejects.toThrow();
  // an assigned item: another project is refused, a delete is refused, a version that does not move by one is refused
  await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query('UPDATE intake_pool_items SET project_id=$2,version=version+1 WHERE id=$1',[item,ids.transport]))).rejects.toThrow();
  await expect(rows('DELETE FROM intake_pool_items WHERE id=$1',[item])).rejects.toThrow();
  await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query('UPDATE intake_pool_items SET version=version+2 WHERE id=$1',[item]))).rejects.toThrow();
  // triaged_by is the actor of the transaction
  const second=await insertPoolItem(h);
  await expect(asRole(h,'libetech_runtime',tech(),async tx=>tx.query("UPDATE intake_pool_items SET state='dismissed',dismiss_code='not_work',triaged_by=$2,triaged_at=now(),version=version+1 WHERE id=$1",[second,techB.id]))).rejects.toThrow();
  // a link points at the project of its item
  await expect(rows(`INSERT INTO intake_work_links(tenant_id,project_id,pool_item_id,work_request_id,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,'Tên thử')`,[ids.tenant,ids.transport,item,(await request(techA.id)),techA.id])).rejects.toThrow();
  expect((await rows<{project_id:string}>('SELECT project_id FROM intake_pool_items WHERE id=$1',[item]))[0].project_id).toBe(ids.sales);
});

test('(6) the runtime and intake roles do not bypass RLS; the new functions belong to libetech_identity and are closed to PUBLIC',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  const roles=await rows<{rolname:string;rolbypassrls:boolean;rolsuper:boolean}>("SELECT rolname,rolbypassrls,rolsuper FROM pg_roles WHERE rolname IN ('libetech_runtime','libetech_intake')");
  expect(roles).toHaveLength(2);
  for(const r of roles){expect(r.rolbypassrls,r.rolname).toBe(false);expect(r.rolsuper,r.rolname).toBe(false);}
  const fns=await rows<{n:string;owner:string;definer:boolean;cfg:string[]|null;public_exec:boolean}>(
    `SELECT p.proname n,pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig cfg,
       has_function_privilege('public',p.oid,'EXECUTE') public_exec
     FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public'
      AND p.proname IN ('intake_pool_sender','intake_link_allowed','tech_roster_names','intake_pool_links_outside') ORDER BY 1`);
  expect(fns.map(f=>f.n)).toEqual(['intake_link_allowed','intake_pool_links_outside','intake_pool_sender','tech_roster_names']);
  for(const f of fns){
    expect(f.owner,f.n).toBe('libetech_identity');expect(f.definer,f.n).toBe(true);expect(f.public_exec,f.n).toBe(false);
    expect(f.cfg?.some(c=>c.replace(/ /g,'')==='search_path=pg_catalog,pg_temp'),f.n).toBe(true);// 032 names the temporary schema last
  }
  // no DELETE on any of the three tables for any application role
  for(const t of TABLES) for(const r of ['libetech_runtime','libetech_intake','libetech_identity'])
    expect((await rows<{ok:boolean}>('SELECT has_table_privilege($1,$2,\'DELETE\') ok',[r,t]))[0].ok,r+' '+t).toBe(false);
  // the identity role reads four columns of the links (to say whether a link lies outside the requests the caller names) and nothing of the requests
  const colPriv=async(t:string)=>(await rows<{c:string}>("SELECT column_name c FROM information_schema.column_privileges WHERE grantee='libetech_identity' AND table_name=$1 AND privilege_type='SELECT' ORDER BY 1",[t])).map(r=>r.c);
  // 030 adds the id, so the same definer function can leave out revoked links; an id is a random key and names nothing
  expect(await colPriv('intake_work_links')).toEqual(['id','pool_item_id','project_id','tenant_id','work_request_id']);
  expect(await colPriv('work_requests')).toEqual([]);
  expect(Number((await rows<{n:string}>("SELECT count(*) n FROM pg_policies WHERE tablename='work_requests' AND policyname='identity_blockers'"))[0].n)).toBe(0);
  // the sender function: the roster member with Telegram linked, nobody else
  const sender=(telegram:string,tenant=ids.tenant)=>asRole(h,'libetech_intake',{tenant,person:intakePrincipalId},async tx=>(await tx.query<{id:string|null}>('SELECT public.intake_pool_sender($1) id',[telegram])).rows[0].id);
  expect(await sender('900000101')).toBe(techA.id);
  expect(await sender('900000999')).toBeNull();
  expect(await sender('900000101',ids.otherTenant)).toBeNull();
  // a linked person who is not on the roster
  expect(await sender('900000201')).toBeNull();
  void chatPool;
});

test('(10) a person cannot link a candidate they cannot read, even to a request they filed',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  // a candidate of the sales project, which techA holds no grant in
  const ev=randomUUID(),cand=randomUUID();
  await rows(`INSERT INTO source_events(id,tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,spooled,trace_id,correlation_id)
    VALUES($1,$2,$3,'s1','telegram_gateway',100,'-10012345','9','m:9','tg:1',now(),false,false,false,$4,$4)`,[ev,ids.tenant,ids.sales,randomUUID()]);
  await rows(`INSERT INTO intake_candidates(id,tenant_id,project_id,chat_id,thread_key,root_source_event_id) VALUES($1,$2,$3,'-10012345','m:9',$4)`,[cand,ids.tenant,ids.sales,ev]);
  const req=await request(techA.id);
  const link=(projects:string[])=>asRole(h,'libetech_runtime',{person:techA.id,projects},async tx=>tx.query(
    "INSERT INTO intake_work_links(tenant_id,project_id,candidate_id,work_request_id,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,'Tên thử') RETURNING id",[ids.tenant,ids.sales,cand,req,techA.id]));
  await expect(link([ids.transport])).rejects.toThrow();
  // with the project in scope the same row is accepted: the refusal above was the candidate policy and nothing else
  expect((await link([ids.sales,ids.transport])).rows).toHaveLength(1);
});

test('(11) the reopen check is one bit and tells a roster member who reads nothing of the project nothing: one link, two links or a link to work answer the same',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  // the counting function is gone: its number told any roster member how many links an item held in a project the member could not read (Codex, PR B)
  expect((await rows<{f:string|null}>("SELECT to_regprocedure('public.intake_pool_link_count(uuid,uuid)')::text f"))[0].f).toBeNull();
  const item=await insertPoolItem(h);await assign(item,ids.sales);
  const link=(target:{work_request_id?:string;work_id?:string})=>rows(`INSERT INTO intake_work_links(tenant_id,project_id,pool_item_id,work_request_id,work_id,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,$6,'Tên thử')`,
    [ids.tenant,ids.sales,item,target.work_request_id??null,target.work_id??null,techA.id]);
  const outside=(who:{person:string;projects:string[]},readable:(string|null)[])=>asRole(h,'libetech_runtime',who,async tx=>
    (await tx.query<{b:boolean|null}>('SELECT public.intake_pool_links_outside($1,$2,$3::uuid[]) b',[item,ids.sales,readable])).rows[0].b);
  // techB holds no grant in sales and reads none of its requests
  const first=await request(techA.id);await link({work_request_id:first});
  expect(await outside(tech(techB),[])).toBe(true);
  const second=await request(techA.id);await link({work_request_id:second});
  expect(await outside(tech(techB),[])).toBe(true);
  // a NULL in the list hides nothing
  expect(await outside(tech(techB),[null])).toBe(true);
  // the caller that names every request the item links finds nothing outside; one fewer, and something is
  expect(await outside(tech(),[first,second])).toBe(false);
  expect(await outside(tech(),[first])).toBe(true);
  // a link to existing work is always outside the requests named
  await link({work_id:ids.pilot});
  expect(await outside(tech(),[first,second])).toBe(true);
  expect(await outside(tech(techB),[])).toBe(true);
  // anybody off the roster gets no answer
  expect(await outside({person:member.id,projects:[ids.sales]},[])).toBeNull();
});

test('(12) the event payload holds states, numbers, a project id and codes only: free text under any allowed key is refused',async()=>{
  for(const t of TABLES) expect(await exists('public.'+t),t).toBe(true);
  const item=await insertPoolItem(h);
  const put=(payload:R)=>asRole(h,'libetech_runtime',tech(),async tx=>tx.query("INSERT INTO intake_pool_events(tenant_id,pool_item_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,$3,'user','pool.triaged',$4,$5,$6)",
    [ids.tenant,item,techA.id,randomUUID(),randomUUID(),JSON.stringify(payload)]));
  const TEXT='nội dung một tin của nhóm';
  for(const key of ['state_before','state_after','version_before','version_after','project_id','classification','revision_no','dismiss_code'])
    for(const value of [TEXT,{text:TEXT},[TEXT]]) await expect(put({[key]:value}),key+' '+JSON.stringify(value)).rejects.toThrow();
  // a number where a state goes, and a state where a number goes
  await expect(put({state_after:1})).rejects.toThrow();
  await expect(put({version_after:'2'})).rejects.toThrow();
  // what the services write is accepted
  await put({state_before:'unassigned',state_after:'assigned',version_before:1,version_after:2,project_id:ids.sales,classification:'request'});
  await put({revision_no:2,version_before:2,version_after:3});
  await put({state_before:'unassigned',state_after:'dismissed',version_before:1,version_after:2,dismiss_code:'not_work'});
  await put({project_id:ids.sales,version_after:2});
  // a project id as a client may send it, in capitals
  await put({project_id:ids.sales.toUpperCase(),version_after:2});
  expect(Number((await rows<{n:string}>('SELECT count(*) n FROM intake_pool_events WHERE pool_item_id=$1',[item]))[0].n)).toBeGreaterThanOrEqual(5);
});
