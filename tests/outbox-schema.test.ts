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

let h:Harness,srcSales:string;
const TG='900000001'; // telegram id linked to pm (synthetic)
beforeEach(async()=>{
  h=await openHarness();await h.reset();await seedSlice1(h);
  await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,pm.id,TG]);
  srcSales=(await h.operator.query<{id:string}>(`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,content_mode,trace_id,correlation_id)
    VALUES($1,$2,'g','telegram_gateway',80,$3,'1000','t','a',now(),false,false,'excerpt',$4,$4) RETURNING id`,[ids.tenant,ids.sales,chatSales,randomUUID()])).rows[0].id;
});
afterEach(async()=>{await h.reset();await h.close();});

const intake=(projectIds:string[],tenant:string=ids.tenant)=>({id:intakePrincipalId,tenantId:tenant,projectIds}) as never;
const asIntake=<T>(projectIds:string[],fn:(tx:Queryable)=>Promise<T>,tenant:string=ids.tenant)=>intakeScoped(h.operator,intake(projectIds,tenant),fn);
const asIdentity=<T>(fn:(tx:Queryable)=>Promise<T>,tenant:string=ids.tenant)=>new IdentityService(h.operator,tenant).scope(fn);
const asRuntime=<T>(fn:(tx:Queryable)=>Promise<T>)=>scoped(h.db,pm,fn);

type Row=Record<string,unknown>;
const groupVals=(over:Row={}):Row=>({
  tenant_id:ids.tenant,project_id:ids.sales,event_id:randomUUID(),event_type:'intake.received',trace_id:randomUUID(),correlation_id:randomUUID(),
  audience:'group',target_chat_id:chatSales,source_event_id:srcSales,template:'intake.received',dedupe_key:'k-'+randomUUID(),...over});
const dmVals=(over:Row={}):Row=>groupVals({project_id:null,audience:'dm',recipient_user_id:pm.id,target_chat_id:TG,source_event_id:null,template:'account_approval.pending',...over});
// The identity role has no INSERT on project_id: its rows leave the column out so the default (NULL) applies.
const identityDm=(over:Row={}):Row=>{const v=dmVals(over);delete v.project_id;if(v.source_event_id===null) delete v.source_event_id;return v;};
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
  // state moves are guarded by trigger (see the hardening tests); non-state columns it owns stay writable
  await expect(scoped(h.db,pm,tx=>tx.query("UPDATE outbox_messages SET last_error_code='X_CODE',version=version+1,updated_at=now()"))).resolves.toBeTruthy();
  await expect(asIdentity(tx=>tx.query('UPDATE outbox_messages SET delivered_at=now()'))).rejects.toThrow(/permission denied/);
  // acknowledgement needs a delivered row (guard trigger); the pending DM row refuses it
  await expect(asIdentity(tx=>tx.query('UPDATE outbox_messages SET acknowledged_at=now(),updated_at=now()'))).rejects.toThrow(/acknowledged/i);
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
    expect(await reg('public.outbox_state_events')).toBeNull();
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

// ---- hardening: outbox target binding and state moves ----
const both=()=>[ids.sales,ids.transport];
test('a group row must target the chat, topic and message of its own visible source event',async()=>{
  await expect(asIntake(both(),tx=>insert(tx,groupVals({target_chat_id:'-1000000000999'})))).rejects.toThrow(/Outbox target/);
  await expect(asIntake(both(),tx=>insert(tx,groupVals({target_topic_id:'77'})))).rejects.toThrow(/Outbox target/);
  await expect(asIntake(both(),tx=>insert(tx,groupVals({reply_to_message_id:'999'})))).rejects.toThrow(/Outbox target/);
  await expect(asIntake(both(),tx=>insert(tx,groupVals({source_event_id:null})))).rejects.toThrow(/Outbox target/);
  await expect(asIntake(both(),tx=>insert(tx,groupVals({source_event_id:randomUUID()})))).rejects.toThrow();
  await expect(asIntake(both(),tx=>insert(tx,groupVals({target_chat_id:'1000000000001'})))).rejects.toThrow();
  await expect(asIntake(both(),tx=>insert(tx,groupVals({reply_to_message_id:'1000'})))).resolves.toBeTruthy();
  await expect(asIntake(both(),tx=>insert(tx,groupVals()))).resolves.toBeTruthy();
});

test('a DM row must target the telegram id linked to its recipient',async()=>{
  await expect(asIdentity(tx=>insert(tx,identityDm({target_chat_id:'900000099'})))).rejects.toThrow(/Outbox target/);
  await expect(asIdentity(tx=>insert(tx,identityDm({target_chat_id:chatSales})))).rejects.toThrow();
  await expect(asIdentity(tx=>insert(tx,identityDm({recipient_user_id:randomUUID()})))).rejects.toThrow();
  await expect(asIdentity(tx=>insert(tx,identityDm()))).resolves.toBeTruthy();
});

// Every state change needs a signal and a request id in the transaction; the database writes the state event (round 3).
const SIG:Record<string,string>={'pending>leased':'lease','leased>delivered':'delivered','leased>pending':'failed_retryable','leased>dead':'failed_permanent','leased>uncertain':'uncertain',
  'uncertain>delivered':'reconciled_delivered','uncertain>pending':'reconciled_not_sent','uncertain>dead':'reconciled_not_sent','uncertain>abandoned':'abandon','dead>pending':'requeue','dead>abandoned':'abandon'};
const setSignal=(tx:Queryable,signal:string)=>tx.query("SELECT set_config('app.outbox_signal',$1,true), set_config('app.request_id',$2,true)",[signal,randomUUID()]);
const stateOf=async(id:string)=>(await h.operator.query<{state:string;attempt_no:number;version:number}>('SELECT state,attempt_no,version FROM outbox_messages WHERE id=$1',[id])).rows[0];
/** A legal state change made by the intake role with the right signal (setup helper). */
async function force(id:string,to:string,attempt?:number){
  const cur=await stateOf(id);
  return asIntake(both(),async tx=>{
    await setSignal(tx,SIG[cur.state+'>'+to]);
    return tx.query("UPDATE outbox_messages SET state=$2,attempt_no=coalesce($3::int,attempt_no),delivered_at=CASE WHEN $2='delivered' THEN now() ELSE delivered_at END,version=version+1,updated_at=now() WHERE id=$1",[id,to,attempt??null]);
  });
}
type Path='leased'|'delivered'|'dead'|'uncertain';
const PATHS:Record<string,string[]>={pending:[],leased:['leased'],delivered:['leased','delivered'],dead:['leased','dead'],uncertain:['leased','uncertain']};
async function mkRow(state:keyof typeof PATHS|Path='pending'){
  const id=(await insert(h.operator,groupVals())).rows[0].id;
  for(const step of PATHS[state]) await force(id,step,3);
  return id;
}
const run=async(who:'runtime'|'intake',sql:string,id:string)=>{
  const cur=(await stateOf(id)).state,m=/state='(\w+)'/.exec(sql);
  const sig=m?(SIG[cur+'>'+m[1]]??'lease'):null;
  const go=async(tx:Queryable)=>{if(sig) await setSignal(tx,sig);return tx.query(sql,[id]);};
  return who==='runtime'?asRuntimePerson(go):asIntake(both(),go);
};
const setState=(s:string,extra='')=>`UPDATE outbox_messages SET state='${s}'${extra},version=version+1,updated_at=now() WHERE id=$1`;

test('runtime may only requeue dead rows with attempt_no reset or abandon dead and uncertain rows',async()=>{
  await expect(run('runtime',setState('pending'),await mkRow('delivered'))).rejects.toThrow(/state/i);
  await expect(run('runtime',setState('delivered',",delivered_at=now()"),await mkRow('pending'))).rejects.toThrow();
  await expect(run('runtime',setState('pending'),await mkRow('leased'))).rejects.toThrow(/state/i);
  await expect(run('runtime',setState('leased'),await mkRow('pending'))).rejects.toThrow();
  await expect(run('runtime',setState('pending'),await mkRow('dead'))).rejects.toThrow(/state/i);
  const d=await mkRow('dead');
  await expect(run('runtime',setState('pending',',attempt_no=0'),d)).resolves.toBeTruthy();
  expect(await stateOf(d)).toMatchObject({state:'pending',attempt_no:0});
  await expect(run('runtime',setState('abandoned'),await mkRow('dead'))).resolves.toBeTruthy();
  await expect(run('runtime',setState('abandoned'),await mkRow('uncertain'))).resolves.toBeTruthy();
  await expect(run('runtime',setState('pending',',attempt_no=0'),await mkRow('uncertain'))).rejects.toThrow(/state/i);
  await expect(run('runtime',setState('dead'),await mkRow('uncertain'))).rejects.toThrow(/state/i);
  // abandoned is terminal
  const a=await mkRow('dead');await run('runtime',setState('abandoned'),a);
  await expect(run('runtime',setState('pending',',attempt_no=0'),a)).rejects.toThrow();
});

test('runtime keeps its non-state columns to failure_owner_id, last_error_code, version and updated_at',async()=>{
  const p=await mkRow('pending');
  await expect(run('runtime',"UPDATE outbox_messages SET next_attempt_at=now()+interval '1 day' WHERE id=$1",p)).rejects.toThrow(/runtime/i);
  await expect(run('runtime','UPDATE outbox_messages SET attempt_no=0 WHERE id=$1',await mkRow('leased'))).rejects.toThrow(/runtime/i);
  await expect(run('runtime',"UPDATE outbox_messages SET last_error_code='OWNER',failure_owner_id=$2,version=version+1,updated_at=now() WHERE id=$1".replace('$2',`'${pm.id}'`),p)).resolves.toBeTruthy();
});

test('intake follows the allowed moves; delivered and abandoned are terminal',async()=>{
  const move=(from:keyof typeof PATHS,to:string)=>mkRow(from).then(id=>run('intake',setState(to,to==='delivered'?',delivered_at=now()':''),id));
  const ok:[string,string][]=[['pending','leased'],['leased','delivered'],['leased','pending'],['leased','dead'],['leased','uncertain'],
    ['uncertain','delivered'],['uncertain','pending'],['uncertain','dead'],['uncertain','abandoned'],['dead','pending'],['dead','abandoned']];
  for(const [f,t] of ok) await expect(move(f,t),f+'→'+t).resolves.toBeTruthy();
  const bad:[string,string][]=[['delivered','leased'],['delivered','pending'],['pending','delivered'],['pending','dead'],['pending','abandoned'],['leased','abandoned'],['uncertain','leased'],['dead','leased']];
  for(const [f,t] of bad) await expect(move(f,t),f+'→'+t).rejects.toThrow();
  const a=await mkRow('dead');await run('intake',setState('abandoned'),a);
  await expect(run('intake',setState('pending'),a)).rejects.toThrow();
  // updates that keep the state stay allowed (identity acknowledging a DM)
  const dm=(await insert(h.operator,dmVals())).rows[0].id;
  await force(dm,'leased',1);await force(dm,'delivered');
  await expect(asIdentity(tx=>tx.query('UPDATE outbox_messages SET acknowledged_at=now(),updated_at=now() WHERE id=$1',[dm]))).resolves.toBeTruthy();
});

// ---- gate-2 fix A ----
const asRuntimePerson=<T>(fn:(tx:Queryable)=>Promise<T>,person:string|null=pm.id)=>scoped(h.db,pm,async tx=>{
  if(person) await tx.query("SELECT set_config('app.person_id',$1,true)",[person]);
  return fn(tx);
});
const stateEvent=async(tx:Queryable,outboxId:string,project:string|null,over:Row={})=>{
  const live=(await tx.query<{version:number}>('SELECT version FROM outbox_messages WHERE id=$1',[outboxId])).rows[0]?.version??1;
  const v:Row={outbox_version:live,tenant_id:ids.tenant,project_id:project,outbox_id:outboxId,from_state:'pending',to_state:'leased',signal:'lease',attempt_no:1,
    actor_kind:'intake_service',actor_id:intakePrincipalId,request_id:randomUUID(),trace_id:randomUUID(),...over};
  const cols=Object.keys(v);
  return tx.query(`INSERT INTO outbox_state_events(${cols.join(',')}) VALUES(${cols.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(v));
};

const leaseBoth=async(...ids2:string[])=>{for(const id of ids2) await force(id,'leased',1);};
const events=(id:string)=>h.operator.query<{from_state:string;to_state:string;signal:string;attempt_no:number;outbox_version:number;actor_kind:string;actor_id:string;project_id:string|null}>(
  'SELECT from_state,to_state,signal,attempt_no,outbox_version,actor_kind,actor_id,project_id FROM outbox_state_events WHERE outbox_id=$1 ORDER BY outbox_version',[id]).then(r=>r.rows);
const DIRECT=/written only by the outbox state trigger/i;

test('outbox_state_events: no context returns nothing; roles see only their rows',async()=>{
  const {g,d}=await seedBoth();await leaseBoth(g,d);
  for(const role of ['libetech_intake','libetech_runtime','libetech_identity'])
    expect(await h.operator.transaction(async tx=>{await tx.query(`SET LOCAL ROLE ${role}`);return count(tx,'outbox_state_events');}),role).toBe(0);
  expect(await asIntake([ids.sales],tx=>count(tx,'outbox_state_events'))).toBe(2);
  expect(await asIntake([ids.transport],tx=>count(tx,'outbox_state_events'))).toBe(1);
  expect(await asRuntime(tx=>count(tx,'outbox_state_events'))).toBe(1);
  expect(await asIdentity(tx=>count(tx,'outbox_state_events'))).toBe(1);
  expect(await scoped(h.db,viewer,tx=>count(tx,'outbox_state_events'))).toBe(0);
  expect(await scoped(h.db,outsider,tx=>count(tx,'outbox_state_events'))).toBe(0);
});

test('outbox_state_events: a state change writes exactly one event with the right fields and actor from the role',async()=>{
  const {g,d}=await seedBoth();
  await force(g,'leased',1);await force(d,'leased',1);
  expect(await events(g)).toEqual([{from_state:'pending',to_state:'leased',signal:'lease',attempt_no:1,outbox_version:2,actor_kind:'intake_service',actor_id:intakePrincipalId,project_id:ids.sales}]);
  expect(await events(d)).toEqual([{from_state:'pending',to_state:'leased',signal:'lease',attempt_no:1,outbox_version:2,actor_kind:'intake_service',actor_id:intakePrincipalId,project_id:null}]);
  // runtime: a person requeues a dead row, the event carries the person
  const dead=await mkRow('dead');
  await asRuntimePerson(async tx=>{await setSignal(tx,'requeue');return tx.query("UPDATE outbox_messages SET state='pending',attempt_no=0,version=version+1,updated_at=now() WHERE id=$1",[dead]);});
  expect((await events(dead)).at(-1)).toMatchObject({from_state:'dead',to_state:'pending',signal:'requeue',attempt_no:0,actor_kind:'user',actor_id:pm.id,project_id:ids.sales});
  // a failed move leaves no event and the state unchanged
  const l=await mkRow('leased');
  await expect(asIntake(both(),async tx=>{await setSignal(tx,'delivered');return tx.query("UPDATE outbox_messages SET state='abandoned',version=version+1 WHERE id=$1",[l]);})).rejects.toThrow();
  expect((await stateOf(l)).state).toBe('leased');
});

test('outbox_state_events: no signal, a reused signal, a bad signal or a missing actor fail closed and leave the row unchanged',async()=>{
  const p=await mkRow('pending');
  const before=await stateOf(p);
  // no signal at all
  await expect(asIntake(both(),tx=>tx.query("UPDATE outbox_messages SET state='leased',attempt_no=1,version=version+1 WHERE id=$1",[p]))).rejects.toThrow(/app\.outbox_signal/);
  // request id missing
  await expect(asIntake(both(),async tx=>{await tx.query("SELECT set_config('app.outbox_signal','lease',true)");return tx.query("UPDATE outbox_messages SET state='leased',attempt_no=1,version=version+1 WHERE id=$1",[p]);})).rejects.toThrow(/app\.request_id/);
  expect(await stateOf(p)).toEqual(before);
  // the signal is consumed: a second state change in the same transaction needs a fresh one
  await expect(asIntake(both(),async tx=>{
    await setSignal(tx,'lease');
    await tx.query("UPDATE outbox_messages SET state='leased',attempt_no=1,version=version+1 WHERE id=$1",[p]);
    return tx.query("UPDATE outbox_messages SET state='uncertain',version=version+1 WHERE id=$1",[p]);
  })).rejects.toThrow(/app\.outbox_signal/);
  expect(await stateOf(p)).toEqual(before);
  await asIntake(both(),async tx=>{
    await setSignal(tx,'lease');await tx.query("UPDATE outbox_messages SET state='leased',attempt_no=1,version=version+1 WHERE id=$1",[p]);
    await setSignal(tx,'uncertain');await tx.query("UPDATE outbox_messages SET state='uncertain',version=version+1 WHERE id=$1",[p]);
  });
  expect((await events(p)).map(e=>e.signal)).toEqual(['lease','uncertain']);
  // a signal that does not belong to the move
  const q=await mkRow('pending');
  await expect(asIntake(both(),async tx=>{await setSignal(tx,'delivered');return tx.query("UPDATE outbox_messages SET state='leased',attempt_no=1,version=version+1 WHERE id=$1",[q]);})).rejects.toThrow(/signal/i);
  await expect(asIntake(both(),async tx=>{await setSignal(tx,'free_text');return tx.query("UPDATE outbox_messages SET state='leased',attempt_no=1,version=version+1 WHERE id=$1",[q]);})).rejects.toThrow();
  expect((await stateOf(q)).state).toBe('pending');
  // actor id missing from the context (intake context without the principal id)
  await expect(h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_intake');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,both().join(',')]);
    await setSignal(tx,'lease');
    return tx.query("UPDATE outbox_messages SET state='leased',attempt_no=1,version=version+1 WHERE id=$1",[q]);
  })).rejects.toThrow();
  // runtime without a person id
  const dead=await mkRow('dead');
  await expect(asRuntimePerson(async tx=>{await setSignal(tx,'abandon');return tx.query("UPDATE outbox_messages SET state='abandoned',version=version+1 WHERE id=$1",[dead]);},null)).rejects.toThrow();
  // any other role changing a state is refused (owner / operator)
  await expect(h.operator.transaction(async tx=>{await setSignal(tx,'lease');return tx.query("UPDATE outbox_messages SET state='leased',attempt_no=1,version=version+1 WHERE id=$1",[q]);})).rejects.toThrow(/may not change/i);
  expect((await stateOf(q)).state).toBe('pending');
});

test('outbox_state_events: version never decreases and every state change raises it by exactly 1',async()=>{
  const p=await mkRow('pending');
  const mv=(set:string,sig='lease')=>asIntake(both(),async tx=>{await setSignal(tx,sig);return tx.query(`UPDATE outbox_messages SET state='leased',attempt_no=1,${set} WHERE id=$1`,[p]);});
  await expect(mv('version=version')).rejects.toThrow(/version/i);
  await expect(mv('version=version+2')).rejects.toThrow(/version/i);
  await expect(mv('version=version-1')).rejects.toThrow(/version/i);
  expect((await stateOf(p)).state).toBe('pending');
  await expect(mv('version=version+1')).resolves.toBeTruthy();
  const v=(await stateOf(p)).version;
  await expect(run('intake',"UPDATE outbox_messages SET version=version-1 WHERE id=$1",p)).rejects.toThrow(/version/i);
  await expect(run('intake',"UPDATE outbox_messages SET version=version+2 WHERE id=$1",p)).rejects.toThrow(/version/i);
  await expect(run('intake',"UPDATE outbox_messages SET version=version+1 WHERE id=$1",p)).resolves.toBeTruthy();
  expect((await stateOf(p)).version).toBe(v+1);
  // terminal rows too
  const ab=await mkRow('dead');await run('intake',setState('abandoned'),ab);
  await expect(run('intake',"UPDATE outbox_messages SET version=version-1 WHERE id=$1",ab)).rejects.toThrow(/version/i);
  await expect(run('runtime',"UPDATE outbox_messages SET version=version+3 WHERE id=$1",ab)).rejects.toThrow(/version/i);
});

test('outbox_state_events: a direct INSERT of an event is refused for intake and runtime, even after version games',async()=>{
  const bothP=both();
  const hum={actor_kind:'user',actor_id:pm.id};
  // abandoned row: runtime bumps the version (allowed by the guard) but still cannot add an abandon event
  const u=await mkRow('uncertain');
  await run('runtime',setState('abandoned'),u);
  const ab={...hum,from_state:'uncertain',to_state:'abandoned',signal:'abandon',attempt_no:3};
  await run('runtime',"UPDATE outbox_messages SET version=version+1 WHERE id=$1",u);
  await expect(asRuntimePerson(tx=>stateEvent(tx,u,ids.sales,ab))).rejects.toThrow(DIRECT);
  await expect(asIntake(bothP,tx=>stateEvent(tx,u,ids.sales,{from_state:'uncertain',to_state:'abandoned',signal:'abandon',attempt_no:3}))).rejects.toThrow(DIRECT);
  // requeued pending row: failure_owner_id update then a direct requeue event
  const dead=await mkRow('dead');
  await asRuntimePerson(async tx=>{await setSignal(tx,'requeue');return tx.query("UPDATE outbox_messages SET state='pending',attempt_no=0,version=version+1 WHERE id=$1",[dead]);});
  await run('runtime',`UPDATE outbox_messages SET failure_owner_id='${pm.id}',version=version+1 WHERE id=$1`,dead);
  await expect(asRuntimePerson(tx=>stateEvent(tx,dead,ids.sales,{...hum,from_state:'dead',to_state:'pending',signal:'requeue',attempt_no:0}))).rejects.toThrow(DIRECT);
  // intake: delivered / lease events on a live row
  const l=await mkRow('leased');
  await expect(asIntake(bothP,tx=>stateEvent(tx,l,ids.sales,{from_state:'pending',to_state:'leased',signal:'lease',attempt_no:3}))).rejects.toThrow(DIRECT);
  // operator as owner cannot either
  await expect(stateEvent(h.operator,l,ids.sales,{from_state:'pending',to_state:'leased',signal:'lease',attempt_no:3})).rejects.toThrow(DIRECT);
  // identity cannot insert
  const {d}=await seedBoth();
  await expect(asIdentity(tx=>stateEvent(tx,d,null,hum))).rejects.toThrow(/permission denied/);
});

test('outbox_state_events: append-only and column-level grants',async()=>{
  const {g}=await seedBoth();await leaseBoth(g);
  await expect(h.operator.query("UPDATE outbox_state_events SET signal='lease'")).rejects.toThrow('Append-only history');
  await expect(h.operator.query('DELETE FROM outbox_state_events')).rejects.toThrow('Append-only history');
  for(const [c,v] of [['id','00000000-0000-4000-8000-0000000000cc'],['created_at','2020-01-01T00:00:00Z'],['updated_at','2020-01-01T00:00:00Z']] as [string,unknown][]){
    await expect(asIntake([ids.sales],tx=>stateEvent(tx,g,ids.sales,{[c]:v})),'intake '+c).rejects.toThrow(/permission denied/);
    await expect(asRuntimePerson(tx=>stateEvent(tx,g,ids.sales,{actor_kind:'user',actor_id:pm.id,[c]:v})),'runtime '+c).rejects.toThrow(/permission denied/);
  }
});

test('trigger functions resolve names in pinned schemas: a TEMP shadow of source_events cannot forge a target',async()=>{
  const forged='-1000000000999';
  await expect(asIntake(both(),async tx=>{
    await tx.query(`CREATE TEMP TABLE source_events AS SELECT id,tenant_id,project_id,'${forged}'::text AS chat_id,topic_id,message_id FROM public.source_events`);
    return insert(tx,groupVals({target_chat_id:forged}));
  })).rejects.toThrow(/Outbox target/);
});

test('guard trigger: delivery columns move only with delivered; terminal rows are frozen; acknowledged_at once, only when delivered',async()=>{
  const p=await mkRow('pending');
  await expect(run('intake',"UPDATE outbox_messages SET delivered_at=now() WHERE id=$1",p)).rejects.toThrow(/delivered/i);
  await expect(run('intake',"UPDATE outbox_messages SET telegram_message_id='5' WHERE id=$1",await mkRow('leased'))).rejects.toThrow(/delivered/i);
  const dl=await mkRow('delivered');
  await expect(run('intake','UPDATE outbox_messages SET attempt_no=9 WHERE id=$1',dl)).rejects.toThrow(/terminal|frozen/i);
  await expect(run('intake',"UPDATE outbox_messages SET delivered_at=now()-interval '1 day' WHERE id=$1",dl)).rejects.toThrow(/terminal|frozen|delivered/i);
  await expect(run('intake',"UPDATE outbox_messages SET last_error_code='X' WHERE id=$1",dl)).rejects.toThrow(/terminal|frozen/i);
  const ab=await mkRow('dead');await run('intake',setState('abandoned'),ab);
  await expect(run('intake',"UPDATE outbox_messages SET last_error_code='X' WHERE id=$1",ab)).rejects.toThrow(/terminal|frozen/i);
  // identity acknowledgement on a DM row
  const dm=(await insert(h.operator,dmVals())).rows[0].id;
  let n=0; // a different timestamp each time, so a second acknowledgement is a real change rather than a no-op
  const ack=()=>asIdentity(tx=>tx.query("UPDATE outbox_messages SET acknowledged_at=now()+make_interval(days => $2::int),updated_at=now() WHERE id=$1",[dm,n++]));
  await expect(ack()).rejects.toThrow(/acknowledged/i);
  await force(dm,'leased',1);await force(dm,'delivered');
  await expect(ack()).resolves.toBeTruthy();
  await expect(ack()).rejects.toThrow(/acknowledged/i);
  await expect(asIdentity(tx=>tx.query("UPDATE outbox_messages SET acknowledged_at=NULL,updated_at=now() WHERE id=$1",[dm]))).rejects.toThrow(/acknowledged/i);
});

test('payload cap counts bytes, envelope constants and error codes are closed',async()=>{
  const o=h.operator;
  const wide=JSON.stringify({a:'é'.repeat(1100)});
  expect(wide.length).toBeLessThan(2048);expect(Buffer.byteLength(wide)).toBeGreaterThan(2048);
  await expect(insert(o,groupVals({payload:wide}))).rejects.toThrow();
  await expect(insert(o,groupVals({payload:JSON.stringify({a:'é'.repeat(500)})}))).resolves.toBeTruthy();
  await expect(insert(o,groupVals({event_version:'v2'}))).rejects.toThrow();
  await expect(insert(o,groupVals({source:'other'}))).rejects.toThrow();
  await expect(asIntake(both(),tx=>insert(tx,groupVals({event_version:'v1',source:'libetech-ai-os'})))).resolves.toBeTruthy();
  const id=await mkRow('leased');
  for(const bad of ['bad code','lower_case','X'.repeat(65),''])
    await expect(o.query('UPDATE outbox_messages SET last_error_code=$2 WHERE id=$1',[id,bad]),JSON.stringify(bad)).rejects.toThrow();
  await expect(o.query("UPDATE outbox_messages SET last_error_code='NET_TIMEOUT_1' WHERE id=$1",[id])).resolves.toBeTruthy();
  const {g}=await seedBoth();
  await expect(receipt(o,g,ids.sales,{attempt_no:2,error_code:'free text'})).rejects.toThrow();
  await expect(receipt(o,g,ids.sales,{attempt_no:2,error_code:'RECIPIENT_UNLINKED'})).resolves.toBeTruthy();
});
