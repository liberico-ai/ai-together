import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import {intakeScoped} from '../src/server/bridge-io';
import {IdentityService} from '../src/server/identity';
import {chatSales,intakePrincipalId} from './slice2-fixtures';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const intake=(projectIds:string[],tenant:string=ids.tenant)=>({id:intakePrincipalId,tenantId:tenant,projectIds}) as never;
const asIntake=<T>(projectIds:string[],fn:(tx:Queryable)=>Promise<T>,tenant:string=ids.tenant)=>intakeScoped(h.operator,intake(projectIds,tenant),fn);
const asIdentity=<T>(fn:(tx:Queryable)=>Promise<T>,tenant:string=ids.tenant)=>new IdentityService(h.operator,tenant).scope(fn);
const asRuntime=<T>(fn:(tx:Queryable)=>Promise<T>)=>scoped(h.db,pm,fn);

type Row=Record<string,unknown>;
const groupVals=(over:Row={}):Row=>({
  tenant_id:ids.tenant,project_id:ids.sales,event_id:randomUUID(),event_type:'intake.received',trace_id:randomUUID(),correlation_id:randomUUID(),
  audience:'group',target_chat_id:chatSales,template:'intake.received',dedupe_key:'k-'+randomUUID(),...over});
const dmVals=(over:Row={}):Row=>groupVals({project_id:null,audience:'dm',recipient_user_id:pm.id,template:'account_approval.pending',...over});
// The identity role has no INSERT on project_id: its rows leave the column out so the default (NULL) applies.
const identityDm=(over:Row={}):Row=>{const v=dmVals(over);delete v.project_id;return v;};
const insert=(tx:Queryable,v:Row)=>{
  const cols=Object.keys(v);
  return tx.query<{id:string}>(`INSERT INTO outbox_messages(${cols.join(',')}) VALUES(${cols.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,Object.values(v));
};
const receipt=(tx:Queryable,outboxId:string,project:string|null,over:Row={})=>{
  const v:Row={tenant_id:ids.tenant,project_id:project,outbox_id:outboxId,attempt_no:1,phase:'send',outcome:'delivered',
    telegram_message_id:'5',reported_at:new Date().toISOString(),source_id:'gw-r1',source_type:'telegram_gateway',quality_score:100,...over};
  const cols=Object.keys(v);
  return tx.query(`INSERT INTO delivery_receipts(${cols.join(',')}) VALUES(${cols.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(v));
};
const count=async(tx:Queryable,t:string)=>(await tx.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;

async function seedBoth(project:string=ids.sales){
  const g=(await insert(h.operator,groupVals({project_id:project}))).rows[0].id;
  const d=(await insert(h.operator,dmVals())).rows[0].id;
  await receipt(h.operator,g,project);
  await receipt(h.operator,d,null);
  return {g,d};
}

test('outbox tables return nothing without RLS context',async()=>{
  await seedBoth();
  for(const role of ['libetech_intake','libetech_runtime','libetech_identity'])
    for(const t of ['outbox_messages','delivery_receipts']){
      const n=await h.operator.transaction(async tx=>{await tx.query(`SET LOCAL ROLE ${role}`);return count(tx,t);});
      expect(n,role+' '+t).toBe(0);
    }
  // controls: with context each role sees its rows
  expect(await asIntake([ids.sales],tx=>count(tx,'outbox_messages'))).toBe(2);
  expect(await asRuntime(tx=>count(tx,'outbox_messages'))).toBe(1);
  expect(await asIdentity(tx=>count(tx,'outbox_messages'))).toBe(1);
  expect(await asIdentity(tx=>count(tx,'delivery_receipts'))).toBe(1);
});

test('(3) the Xeca scope cannot read LBRC or IBS HI receipts and outbox rows',async()=>{
  await seedBoth(ids.sales);
  for(const t of ['outbox_messages','delivery_receipts']){
    expect(await scoped(h.db,viewer,tx=>count(tx,t)),'viewer '+t).toBe(0);
    expect(await scoped(h.db,outsider,tx=>count(tx,t)),'outsider '+t).toBe(0);
    // the transport-scoped intake principal sees only the tenant DM row, never the sales group row
    expect(await asIntake([ids.transport],tx=>count(tx,t)),'intake transport '+t).toBe(1);
    expect(await asIntake([ids.otherProject],tx=>count(tx,t),ids.otherTenant),'intake other tenant '+t).toBe(0);
  }
});

test('project rows are invisible across projects, DM rows only to intake and identity of the same tenant',async()=>{
  await seedBoth(ids.sales);
  const rows=(tx:Queryable,t:string)=>tx.query<{project_id:string|null}>(`SELECT project_id FROM ${t}`).then(r=>r.rows.map(x=>x.project_id));
  expect(await asIntake([ids.transport],tx=>rows(tx,'outbox_messages'))).toEqual([null]);
  expect(await asIntake([ids.transport],tx=>rows(tx,'delivery_receipts'))).toEqual([null]);
  expect(await asIntake([ids.sales],tx=>rows(tx,'outbox_messages'))).toHaveLength(2);
  await expect(asIdentity(tx=>rows(tx,'outbox_messages'),ids.otherTenant)).resolves.toEqual([]);
  expect(await asRuntime(tx=>rows(tx,'outbox_messages'))).toEqual([ids.sales]);
});

test('runtime and identity cannot insert a group outbox row; intake cannot insert a DM row',async()=>{
  await expect(asRuntime(tx=>insert(tx,groupVals()))).rejects.toThrow();
  await expect(asIdentity(tx=>insert(tx,groupVals()))).rejects.toThrow();
  await expect(asIntake([ids.sales],tx=>insert(tx,dmVals()))).rejects.toThrow();
  // controls
  await expect(asIntake([ids.sales],tx=>insert(tx,groupVals()))).resolves.toBeTruthy();
  await expect(asIdentity(tx=>insert(tx,identityDm()))).resolves.toBeTruthy();
  // intake cannot write another project's group row
  await expect(asIntake([ids.sales],tx=>insert(tx,groupVals({project_id:ids.transport})))).rejects.toThrow();
});

test('no role can insert an outbox row that is already delivered or acknowledged',async()=>{
  const now=new Date().toISOString();
  const bad:Row[]=[{state:'delivered'},{delivered_at:now},{acknowledged_at:now},{attempt_no:1},{state:'leased'}];
  for(const over of bad){
    const label=JSON.stringify(Object.keys(over));
    await expect(asIntake([ids.sales],tx=>insert(tx,groupVals(over))),'intake '+label).rejects.toThrow();
    await expect(asIdentity(tx=>insert(tx,identityDm(over))),'identity '+label).rejects.toThrow();
  }
  expect(await count(h.operator,'outbox_messages')).toBe(0);
});

test('runtime cannot mark a message delivered',async()=>{
  await seedBoth();
  await expect(scoped(h.db,pm,tx=>tx.query('UPDATE outbox_messages SET delivered_at=now()'))).rejects.toThrow(/permission denied/);
  await expect(scoped(h.db,pm,tx=>tx.query('UPDATE outbox_messages SET acknowledged_at=now()'))).rejects.toThrow(/permission denied/);
  await expect(scoped(h.db,pm,tx=>tx.query("UPDATE outbox_messages SET state='dead',last_error_code='x',version=version+1,updated_at=now()"))).resolves.toBeTruthy();
  await expect(asIdentity(tx=>tx.query('UPDATE outbox_messages SET delivered_at=now()'))).rejects.toThrow(/permission denied/);
  await expect(asIdentity(tx=>tx.query('UPDATE outbox_messages SET acknowledged_at=now(),updated_at=now()'))).resolves.toBeTruthy();
  await expect(asIntake([ids.sales],tx=>tx.query('UPDATE outbox_messages SET acknowledged_at=now()'))).rejects.toThrow(/permission denied/);
});

test('a DM row has no project and a group row has one',async()=>{
  const o=h.operator;
  await expect(insert(o,groupVals({project_id:null}))).rejects.toThrow();
  await expect(insert(o,groupVals({recipient_user_id:pm.id}))).rejects.toThrow();
  await expect(insert(o,dmVals({project_id:ids.sales}))).rejects.toThrow();
  await expect(insert(o,dmVals({recipient_user_id:null}))).rejects.toThrow();
  const e=(await o.query<{id:string}>(`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,content_mode,trace_id,correlation_id)
    VALUES($1,$2,'g','telegram_gateway',80,$3,'1','t','a',now(),false,false,'excerpt',$4,$4) RETURNING id`,[ids.tenant,ids.sales,chatSales,randomUUID()])).rows[0].id;
  await expect(insert(o,dmVals({source_event_id:e}))).rejects.toThrow();
  await expect(insert(o,groupVals({source_event_id:e}))).resolves.toBeTruthy();
  // a source event of another project is refused by the composite FK
  await expect(insert(o,groupVals({project_id:ids.transport,source_event_id:e}))).rejects.toThrow();
  // closed label sets, size cap, shape of state
  await expect(insert(o,groupVals({template:'free.text'}))).rejects.toThrow();
  await expect(insert(o,groupVals({payload:JSON.stringify({a:'x'.repeat(2100)})}))).rejects.toThrow();
  await expect(insert(o,groupVals({state:'delivered'}))).rejects.toThrow();
  await expect(insert(o,groupVals({state:'sent'}))).rejects.toThrow();
  const ev=randomUUID();
  await insert(o,groupVals({event_id:ev,dedupe_key:'same'}));
  await expect(insert(o,groupVals({event_id:ev}))).rejects.toThrow(/duplicate|unique/i);
  await expect(insert(o,groupVals({dedupe_key:'same'}))).rejects.toThrow(/duplicate|unique/i);
  await expect(o.query('DELETE FROM outbox_messages')).rejects.toThrow();
});

test('delivery receipts are append-only and unique per attempt and phase',async()=>{
  const {g}=await seedBoth();
  await expect(h.operator.query("UPDATE delivery_receipts SET outcome='failed_permanent'")).rejects.toThrow('Append-only history');
  await expect(h.operator.query('DELETE FROM delivery_receipts')).rejects.toThrow('Append-only history');
  await expect(receipt(h.operator,g,ids.sales)).rejects.toThrow(/duplicate|unique/i);
  await expect(receipt(h.operator,g,ids.sales,{phase:'reconcile'})).resolves.toBeTruthy();
  await expect(receipt(h.operator,g,ids.sales,{attempt_no:0})).rejects.toThrow();
  await expect(receipt(h.operator,g,ids.sales,{attempt_no:2,outcome:'sent'})).rejects.toThrow();
  await expect(receipt(h.operator,g,ids.sales,{attempt_no:2,source_type:'other'})).rejects.toThrow();
  await expect(receipt(h.operator,g,ids.sales,{attempt_no:2,quality_score:101})).rejects.toThrow();
  await expect(receipt(h.operator,randomUUID(),ids.sales,{attempt_no:3})).rejects.toThrow();
});

test('receipt access by role: intake reads and inserts, runtime and identity only read their rows',async()=>{
  const {g,d}=await seedBoth();
  await expect(asIntake([ids.sales],tx=>receipt(tx,g,ids.sales,{attempt_no:2}))).resolves.toBeTruthy();
  await expect(asIntake([ids.sales],tx=>receipt(tx,d,null,{attempt_no:2}))).resolves.toBeTruthy();
  await expect(asIntake([ids.sales],tx=>receipt(tx,g,ids.transport,{attempt_no:3}))).rejects.toThrow();
  await expect(asIntake([ids.sales],tx=>receipt(tx,g,ids.sales,{attempt_no:3,tenant_id:ids.otherTenant}))).rejects.toThrow();
  await expect(asRuntime(tx=>receipt(tx,g,ids.sales,{attempt_no:4}))).rejects.toThrow(/permission denied/);
  await expect(asIdentity(tx=>receipt(tx,d,null,{attempt_no:4}))).rejects.toThrow(/permission denied/);
  expect(await asRuntime(tx=>count(tx,'delivery_receipts'))).toBe(2);
  expect(await asIdentity(tx=>count(tx,'delivery_receipts'))).toBe(2);
});

test('item 2 column-level INSERT grants: defaults own ids, timestamps, state and delivery columns',async()=>{
  const old='2020-01-01T00:00:00Z',idv='00000000-0000-4000-8000-0000000000cc';
  const owned:[string,unknown][]=[['id',idv],['created_at',old],['updated_at',old],['state','pending'],['attempt_no',0],['next_attempt_at',old],
    ['lease_token',idv],['lease_expires_at',old],['delivered_at',old],['telegram_message_id','1'],['acknowledged_at',old],['last_error_code','x'],
    ['failure_owner_id',idv],['version',5]];
  for(const [c,v] of owned){
    await expect(asIntake([ids.sales],tx=>insert(tx,groupVals({[c]:v}))),'intake '+c).rejects.toThrow(/permission denied/);
    await expect(asIdentity(tx=>insert(tx,identityDm({[c]:v}))),'identity '+c).rejects.toThrow(/permission denied/);
  }
  // identity may not name project, source/candidate links, topic, reply, occurred_at, event_version or source
  const idOnly:[string,unknown][]=[['source_event_id',idv],['candidate_id',idv],['target_topic_id','1'],['reply_to_message_id','1'],['occurred_at',old],['event_version','v2'],['source','x']];
  for(const [c,v] of idOnly)
    await expect(asIdentity(tx=>insert(tx,identityDm({[c]:v}))),'identity '+c).rejects.toThrow(/permission denied/);
  await expect(asIdentity(tx=>insert(tx,{...identityDm(),project_id:null})),'identity project_id').rejects.toThrow(/permission denied/);
  const {g}=await seedBoth();
  for(const c of ['id','created_at','updated_at','ingested_at'])
    await expect(asIntake([ids.sales],tx=>receipt(tx,g,ids.sales,{attempt_no:9,[c]:c==='id'?idv:old})),'receipt '+c).rejects.toThrow(/permission denied/);
});

test('017 rollback refuses while identity.account_approvals.kind exists, then drops both tables',async()=>{
  const dir=(p:string)=>path.join(process.cwd(),p);
  const rb=await readFile(dir('migrations/rollback/017_outbox.sql'),'utf8');
  const fw=await readFile(dir('migrations/017_outbox.sql'),'utf8');
  expect(rb.replace(/--.*$/gm,'')).not.toMatch(/CASCADE/i);
  const reg=async(t:string)=>(await h.operator.query<{r:string|null}>('SELECT to_regclass($1)::text r',[t])).rows[0].r;
  try {
    // Task 9 (migration 018) adds this column; it is faked here only to exercise the guard.
    await h.exec('ALTER TABLE identity.account_approvals ADD COLUMN IF NOT EXISTS kind text');
    await expect(h.exec(rb)).rejects.toThrow('Roll back 018 before 017');
    await h.exec('ROLLBACK').catch(()=>{});
    expect(await reg('public.outbox_messages')).toBe('outbox_messages');
    await h.exec('ALTER TABLE identity.account_approvals DROP COLUMN kind');
    await h.exec(rb);
    expect(await reg('public.outbox_messages')).toBeNull();
    expect(await reg('public.delivery_receipts')).toBeNull();
    expect((await h.operator.query("SELECT 1 FROM schema_migrations WHERE version='017'")).rows).toHaveLength(0);
  } finally {
    await h.exec('ROLLBACK').catch(()=>{});
    await h.exec('ALTER TABLE identity.account_approvals DROP COLUMN IF EXISTS kind');
    await h.exec(fw);
  }
  expect(await reg('public.outbox_messages')).toBe('outbox_messages');
  await h.exec(fw); // forward twice in a row
});

test('a receipt project is derived from its outbox row, never trusted from the caller',async()=>{
  const {g,d}=await seedBoth(ids.sales);
  const both=[ids.sales,ids.transport];
  // wrong in-scope project for a group row
  await expect(asIntake(both,tx=>receipt(tx,g,ids.transport,{attempt_no:2}))).rejects.toThrow(/project/i);
  // NULL project for a group row must not slip in through the DM branch
  await expect(asIntake(both,tx=>receipt(tx,g,null,{attempt_no:3}))).rejects.toThrow(/project/i);
  // a project for a DM row
  await expect(asIntake(both,tx=>receipt(tx,d,ids.sales,{attempt_no:4}))).rejects.toThrow(/project/i);
  // an outbox row the inserting role cannot see (sales group row, intake scoped to transport only)
  await expect(asIntake([ids.transport],tx=>receipt(tx,g,ids.transport,{attempt_no:5}))).rejects.toThrow();
  await expect(asIntake([ids.transport],tx=>receipt(tx,g,null,{attempt_no:6}))).rejects.toThrow();
  // an outbox id that does not exist
  await expect(asIntake(both,tx=>receipt(tx,randomUUID(),null,{attempt_no:7}))).rejects.toThrow();
  // matching receipts are accepted; the DM receipt is inserted by the intake role (DM branch of its policy)
  await expect(asIntake(both,tx=>receipt(tx,g,ids.sales,{attempt_no:8}))).resolves.toBeTruthy();
  await expect(asIntake(both,tx=>receipt(tx,d,null,{attempt_no:9}))).resolves.toBeTruthy();
  expect(await count(h.operator,'delivery_receipts')).toBe(4);
});

test('the receipt INSERT policy rejects the same cases when the trigger is disabled (second layer)',async()=>{
  const {g,d}=await seedBoth(ids.sales);
  const both=[ids.sales,ids.transport];
  const trig=(mode:string)=>h.exec('ALTER TABLE delivery_receipts '+mode+' TRIGGER delivery_receipts_derive_project');
  await trig('DISABLE');
  try {
    await expect(asIntake(both,tx=>receipt(tx,g,ids.transport,{attempt_no:2}))).rejects.toThrow(/row-level security/);
    await expect(asIntake(both,tx=>receipt(tx,g,null,{attempt_no:3}))).rejects.toThrow(/row-level security/);
    await expect(asIntake(both,tx=>receipt(tx,d,ids.sales,{attempt_no:4}))).rejects.toThrow(/row-level security/);
    await expect(asIntake([ids.transport],tx=>receipt(tx,g,null,{attempt_no:5}))).rejects.toThrow(/row-level security/);
    await expect(asIntake(both,tx=>receipt(tx,g,ids.sales,{attempt_no:6}))).resolves.toBeTruthy();
    await expect(asIntake(both,tx=>receipt(tx,d,null,{attempt_no:7}))).resolves.toBeTruthy();
  } finally { await trig('ENABLE'); }
});
