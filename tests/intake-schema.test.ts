import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import {chatSales} from './slice2-fixtures';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

// scoped() does not set app.person_id; the actor binding is exercised here by setting it explicitly.
const asRuntime=<T>(fn:(tx:Queryable)=>Promise<T>,person:string|null=pm.id)=>scoped(h.db,pm,async tx=>{
  if(person) await tx.query("SELECT set_config('app.person_id',$1,true)",[person]);
  return fn(tx);
});
const tables=['source_events','source_event_revisions','intake_attachments','intake_candidates','intake_events'];
const hex=(c:string)=>c.repeat(64);

async function asIntake<T>(projectIds:string[],fn:(tx:Queryable)=>Promise<T>,tenant:string=ids.tenant,principal:string|null=pm.id):Promise<T>{
  return h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_intake');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[tenant,projectIds.join(',')]);
    if(principal) await tx.query("SELECT set_config('app.intake_principal_id',$1,true)",[principal]);
    return fn(tx);
  });
}
const eventSql=`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,content_mode,trace_id,correlation_id)
  VALUES($1,$2,'gw-1','telegram_gateway',80,$3,$4,'t1','actor-1',now(),false,false,'excerpt',$5,$5) RETURNING id`;
const newEvent=(tx:Queryable,project=ids.sales,tenant=ids.tenant,msg='1')=>tx.query<{id:string}>(eventSql,[tenant,project,chatSales,msg,randomUUID()]);
const revSql=`INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash) VALUES($1,$2,$3,1,$4,$5) RETURNING id`;
const candSql=`INSERT INTO intake_candidates(tenant_id,project_id,chat_id,thread_key,root_source_event_id) VALUES($1,$2,$3,'t1',$4) RETURNING id`;
const evtSql=`INSERT INTO intake_events(tenant_id,project_id,entity_type,entity_id,actor_id,actor_kind,kind,request_id,trace_id,payload)
  VALUES($1,$2,'source_event',$3,$4,$5,'k',$6,$6,'{}')`;

async function seedAll(){
  const o=h.operator;
  const e=(await o.query<{id:string}>(eventSql,[ids.tenant,ids.sales,chatSales,'1',randomUUID()])).rows[0].id;
  const r=(await o.query<{id:string}>(revSql,[ids.tenant,ids.sales,e,hex('a'),hex('b')])).rows[0].id;
  await o.query(`INSERT INTO intake_attachments(tenant_id,project_id,source_event_id,revision_id,state) VALUES($1,$2,$3,$4,'failed')`,[ids.tenant,ids.sales,e,r]);
  await o.query(candSql,[ids.tenant,ids.sales,chatSales,e]);
  await o.query(evtSql,[ids.tenant,ids.sales,e,pm.id,'user',randomUUID()]);
  return {e,r};
}

test('intake tables return nothing without RLS context',async()=>{
  await seedAll();
  for(const role of ['libetech_intake','libetech_runtime'])
    for(const t of tables){
      const rows=await h.operator.transaction(async tx=>{await tx.query(`SET LOCAL ROLE ${role}`);return (await tx.query(`SELECT * FROM ${t}`)).rows;});
      expect(rows,role+' '+t).toHaveLength(0);
    }
  // control: with context the intake role sees its rows
  const n=await asIntake([ids.sales],async tx=>(await tx.query<{n:number}>('SELECT count(*)::int n FROM source_events')).rows[0].n);
  expect(n).toBe(1);
});

test('intake role cannot touch work, documents, registry or identity',async()=>{
  const denied=[
    "INSERT INTO work_items(tenant_id,project_id,title) VALUES(gen_random_uuid(),gen_random_uuid(),'x')",
    "UPDATE work_items SET title='x'",
    "INSERT INTO audit_events(tenant_id,project_id) VALUES(gen_random_uuid(),gen_random_uuid())",
    "INSERT INTO document_records(tenant_id,project_id) VALUES(gen_random_uuid(),gen_random_uuid())",
    'SELECT * FROM identity.users','SELECT * FROM project_channels','SELECT * FROM project_profiles',
    'SELECT * FROM evidence','SELECT * FROM commands','SELECT * FROM analytics.work_summary',
  ];
  for(const sql of denied) await expect(asIntake([ids.sales],tx=>tx.query(sql)),sql).rejects.toThrow(/permission denied/);
  await expect(asIntake([ids.sales],tx=>tx.query('SELECT name FROM projects'))).rejects.toThrow(/permission denied/);
  await expect(asIntake([ids.sales],tx=>tx.query('SELECT id,tenant_id FROM projects'))).resolves.toBeTruthy();
  await expect(asIntake([ids.sales],tx=>tx.query('SELECT * FROM project_domain_mappings'))).resolves.toBeTruthy();
});

test('intake role cannot write another project or tenant',async()=>{
  await expect(asIntake([ids.sales],tx=>newEvent(tx,ids.sales))).resolves.toBeTruthy();
  await expect(asIntake([ids.sales],tx=>newEvent(tx,ids.transport,ids.tenant,'2'))).rejects.toThrow();
  await expect(asIntake([ids.sales],tx=>newEvent(tx,ids.otherProject,ids.otherTenant,'3'))).rejects.toThrow();
  await expect(asIntake([ids.sales],tx=>newEvent(tx,ids.sales,ids.otherTenant,'4'))).rejects.toThrow();
  expect((await h.operator.query<{n:number}>('SELECT count(*)::int n FROM source_events')).rows[0].n).toBe(1);
});

test('intake role cannot create a decided candidate',async()=>{
  const e=(await h.operator.query<{id:string}>(eventSql,[ids.tenant,ids.sales,chatSales,'1',randomUUID()])).rows[0].id;
  const base=(extra:string,val:unknown)=>asIntake([ids.sales],tx=>tx.query(
    `INSERT INTO intake_candidates(tenant_id,project_id,chat_id,thread_key,root_source_event_id,${extra}) VALUES($1,$2,$3,'t9',$4,$5)`,[ids.tenant,ids.sales,chatSales,e,val]));
  await expect(base('state','confirmed')).rejects.toThrow();
  await expect(base('classification','incident')).rejects.toThrow();
  await expect(base('ticket_ref','TCK-1')).rejects.toThrow();
  await expect(base('decided_by',pm.id)).rejects.toThrow();
  await expect(asIntake([ids.sales],tx=>tx.query(candSql,[ids.tenant,ids.sales,chatSales,e]))).resolves.toBeTruthy();
});

test('intake role is gated on attachment hash level and event actor kind',async()=>{
  const {e,r}=await seedAll();
  await expect(asIntake([ids.sales],tx=>tx.query(
    `INSERT INTO intake_attachments(tenant_id,project_id,source_event_id,revision_id,state,hash_verification) VALUES($1,$2,$3,$4,'failed','verified')`,
    [ids.tenant,ids.sales,e,r]))).rejects.toThrow();
  await expect(asIntake([ids.sales],tx=>tx.query(evtSql,[ids.tenant,ids.sales,e,pm.id,'user',randomUUID()]))).rejects.toThrow();
  await expect(asIntake([ids.sales],tx=>tx.query(evtSql,[ids.tenant,ids.sales,e,pm.id,'intake_service',randomUUID()]))).resolves.toBeTruthy();
});

test('runtime cannot insert source events, revisions, attachments or candidates',async()=>{
  const {e,r}=await seedAll();
  const stmts:[string,unknown[]][]=[
    [eventSql,[ids.tenant,ids.sales,chatSales,'77',randomUUID()]],
    [revSql,[ids.tenant,ids.sales,e,hex('c'),hex('d')]],
    [`INSERT INTO intake_attachments(tenant_id,project_id,source_event_id,revision_id,state) VALUES($1,$2,$3,$4,'failed')`,[ids.tenant,ids.sales,e,r]],
    [candSql,[ids.tenant,ids.sales,chatSales,e]],
  ];
  for(const [sql,p] of stmts) await expect(scoped(h.db,pm,tx=>tx.query(sql,p)),sql).rejects.toThrow(/permission denied/);
  // runtime may write human events only, and may update candidates in scope
  await expect(asRuntime(tx=>tx.query(evtSql,[ids.tenant,ids.sales,e,pm.id,'intake_service',randomUUID()]))).rejects.toThrow();
  await expect(asRuntime(tx=>tx.query(evtSql,[ids.tenant,ids.sales,e,pm.id,'user',randomUUID()]))).resolves.toBeTruthy();
  await expect(scoped(h.db,pm,tx=>tx.query("UPDATE intake_candidates SET state='dismissed',version=version+1,updated_at=now()"))).resolves.toBeTruthy();
  await expect(scoped(h.db,pm,tx=>tx.query("UPDATE intake_candidates SET chat_id='-1'"))).rejects.toThrow(/permission denied/);
});

test('history tables reject update and delete; candidates reject delete',async()=>{
  await seedAll();
  for(const t of ['source_events','source_event_revisions','intake_attachments','intake_events']){
    await expect(h.operator.query(`UPDATE ${t} SET created_at=now()`),t).rejects.toThrow('Append-only history');
    await expect(h.operator.query(`DELETE FROM ${t}`),t).rejects.toThrow('Append-only history');
  }
  await expect(h.operator.query('DELETE FROM intake_candidates')).rejects.toThrow();
});

test('no intake table has a bytes or file content column',async()=>{
  const cols=(await h.operator.query<{table_name:string;column_name:string;data_type:string}>(
    "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1)",[tables])).rows;
  expect(new Set(cols.map(c=>c.table_name))).toEqual(new Set(tables));
  for(const c of cols){
    expect(c.data_type,c.table_name+'.'+c.column_name).not.toBe('bytea');
    expect(['content','body','bytes','data'],c.table_name+'.'+c.column_name).not.toContain(c.column_name);
  }
});

test('a stored attachment needs locator, hash and a size within 20 MiB',async()=>{
  const e=(await h.operator.query<{id:string}>(eventSql,[ids.tenant,ids.sales,chatSales,'1',randomUUID()])).rows[0].id;
  const r=(await h.operator.query<{id:string}>(revSql,[ids.tenant,ids.sales,e,hex('a'),hex('b')])).rows[0].id;
  let n=0;
  const put=async(state:string,locator:string|null,sha:string|null,size:number|null)=>{
    // one revision per attachment (UNIQUE(revision_id)); make a fresh revision each time
    n+=1;
    const rid=n===1?r:(await h.operator.query<{id:string}>(
      'INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [ids.tenant,ids.sales,e,n,hex(String(n)),hex('b')])).rows[0].id;
    return h.operator.query(`INSERT INTO intake_attachments(tenant_id,project_id,source_event_id,revision_id,state,locator,sha256,size_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ids.tenant,ids.sales,e,rid,state,locator,sha,size]);
  };
  await expect(put('stored','loc/1',null,10)).rejects.toThrow();
  await expect(put('stored','loc/1',hex('e'),20971521)).rejects.toThrow();
  await expect(put('stored',null,hex('e'),10)).rejects.toThrow();
  await expect(put('failed','loc/1',null,null)).rejects.toThrow();
  await expect(put('stored','loc/1',hex('e'),20971520)).resolves.toBeTruthy();
});

test('an attachment cannot point to a revision of a different source event',async()=>{
  const {r}=await seedAll();
  const e2=(await h.operator.query<{id:string}>(eventSql,[ids.tenant,ids.sales,chatSales,'2',randomUUID()])).rows[0].id;
  await expect(h.operator.query(`INSERT INTO intake_attachments(tenant_id,project_id,source_event_id,revision_id,state) VALUES($1,$2,$3,$4,'failed')`,
    [ids.tenant,ids.sales,e2,r])).rejects.toThrow();
});

test('intake_events actor_id is bound to the acting identity (fail-closed)',async()=>{
  const {e}=await seedAll();
  const other=randomUUID();
  const svc=(actor:string)=>(tx:Queryable)=>tx.query(evtSql,[ids.tenant,ids.sales,e,actor,'intake_service',randomUUID()]);
  await expect(asIntake([ids.sales],svc(pm.id))).resolves.toBeTruthy();
  await expect(asIntake([ids.sales],svc(other))).rejects.toThrow();
  await expect(asIntake([ids.sales],svc(pm.id),ids.tenant,null)).rejects.toThrow();
  const usr=(actor:string)=>(tx:Queryable)=>tx.query(evtSql,[ids.tenant,ids.sales,e,actor,'user',randomUUID()]);
  await expect(asRuntime(usr(pm.id))).resolves.toBeTruthy();
  await expect(asRuntime(usr(other))).rejects.toThrow();
  await expect(asRuntime(usr(pm.id),null)).rejects.toThrow();
});

describe.skipIf(!native)('native roles',()=>{
  test('web login cannot assume the intake role; intake login is unprivileged',async()=>{
    await expect(h.db.transaction(async tx=>{await tx.query('SET ROLE libetech_intake');})).rejects.toThrow();
    const r=(await h.operator.query<{rolsuper:boolean;rolbypassrls:boolean;rolinherit:boolean;rolcanlogin:boolean}>(
      "SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname='libetech_intake_svc'")).rows[0];
    expect(r).toEqual({rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:true});
    const member=(await h.operator.query<{r:string}>(
      "SELECT g.rolname r FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE u.rolname='libetech_intake_svc'")).rows.map(x=>x.r);
    expect(member).toEqual(['libetech_intake']);
  });
});

test('item 2 column-level INSERT grants: defaults own ids, timestamps, ingested_at, version, hash level',async()=>{
  const e=(await h.operator.query<{id:string}>(eventSql,[ids.tenant,ids.sales,chatSales,'1',randomUUID()])).rows[0].id;
  const r=(await h.operator.query<{id:string}>(revSql,[ids.tenant,ids.sales,e,hex('a'),hex('b')])).rows[0].id;
  const T=[ids.tenant,ids.sales];
  const tryIns=(table:string,cols:string,vals:unknown[],extra:[string,unknown],who:'intake'|'runtime')=>{
    const names=cols+','+extra[0],ph=[...vals,extra[1]].map((_,i)=>'$'+(i+1)).join(',');
    const run=(tx:Queryable)=>tx.query(`INSERT INTO ${table}(${names}) VALUES(${ph})`,[...vals,extra[1]]);
    return who==='intake'?asIntake([ids.sales],run):asRuntime(run);
  };
  const old='2020-01-01T00:00:00Z',idv='00000000-0000-4000-8000-0000000000cc';
  const cases:[string,string,unknown[],[string,unknown][]][]=[
    ['source_events','tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,content_mode,trace_id,correlation_id',
      [...T,'g','telegram_gateway',80,chatSales,'91','t','a',old,false,false,'excerpt',idv,idv],[['ingested_at',old],['created_at',old],['id',idv]]],
    ['source_event_revisions','tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash',[...T,e,2,hex('c'),hex('d')],[['created_at',old],['id',idv]]],
    ['intake_attachments','tenant_id,project_id,source_event_id,revision_id,state',[...T,e,r,'failed'],[['created_at',old],['hash_verification','gateway_declared']]],
    ['intake_candidates','tenant_id,project_id,chat_id,thread_key,root_source_event_id',[...T,chatSales,'t9',e],[['created_at',old],['version',5],['note','x'],['missing_fields','[]']]],
    ['intake_events','tenant_id,project_id,entity_type,entity_id,actor_id,actor_kind,kind,request_id,trace_id,payload',[...T,'source_event',e,pm.id,'intake_service','k',idv,idv,'{}'],[['created_at',old],['id',idv]]],
  ];
  for(const [table,cols,vals,extras] of cases) for(const x of extras)
    await expect(tryIns(table,cols,vals,x,'intake'),table+'.'+x[0]).rejects.toThrow(/permission denied/);
  await expect(tryIns('intake_events','tenant_id,project_id,entity_type,entity_id,actor_id,actor_kind,kind,request_id,trace_id,payload',[...T,'source_event',e,pm.id,'user','k',idv,idv,'{}'],['created_at',old],'runtime')).rejects.toThrow(/permission denied/);
  await expect(tryIns('intake_events','tenant_id,project_id,entity_type,entity_id,actor_id,actor_kind,kind,request_id,trace_id',[...T,'source_event',e,pm.id,'user','k',idv,idv],['id',idv],'runtime')).rejects.toThrow(/permission denied/);
});
