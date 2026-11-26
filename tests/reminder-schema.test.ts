// GIAO VIỆC 5 F (Q-F1, Q-F3): the database lets the scheduler role queue a reminder only to an enabled target's own chat and topic, never for an IBS HI or
// unconfirmed-domain project; only the operator writes targets and meeting series, and every change of them is recorded.
import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {mapDomain} from './slice3-fixtures';
import {as,groupOther,groupSales,groupTransport,insertSeries,insertTarget,regclass,reminderRow,sameBuProject,seedReminders} from './reminder-fixtures';
import {takeOffAbove,putBack} from './migration-stack';
import {ids} from '../src/server/identities';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await seedReminders(h);});
afterEach(async()=>{await h.reset();await h.close();});

const refused=(p:Promise<unknown>)=>p.then(()=>false,()=>true);
const count=async(sql:string,p:unknown[]=[])=>Number((await h.operator.query<{n:string}>(sql,p)).rows[0].n);
const tables=async()=>{for(const t of ['public.reminder_targets','public.meeting_series','public.meeting_changes','public.reminder_config_events','analytics.golive_member_status'])
  expect(await regclass(h,t),t+' exists').not.toBeNull();};

describe('the send guard',()=>{
 test('a reminder goes only to the enabled target of its project, kind, chat and topic, and answers no message',async()=>{
  await tables();
  const golive=await insertTarget(h);
  await expect(reminderRow(h,{target:golive})).resolves.toHaveLength(1);
  const cases:[string,Parameters<typeof reminderRow>[1]][]=[
   ['another chat',{target:golive,chat:groupOther}],
   ['another topic',{target:golive,topic:'7'}],
   ['a template of another kind',{target:golive,template:'reminder.bom_meeting'}],
   ['a reply to a message',{target:golive,reply:'15'}],
   ['no target at all',{target:null}],
   ['the target under another project',{target:golive,project:ids.transport,scope:[ids.sales,ids.transport]}],
   ['an intake template',{target:golive,template:'intake.received'}],
  ];
  for(const [label,o] of cases) expect(await refused(reminderRow(h,o)),label).toBe(true);
  const meeting=await insertTarget(h,{kind:'bom_meeting'});
  await expect(reminderRow(h,{target:meeting,template:'reminder.bom_meeting'})).resolves.toHaveLength(1);
  await expect(reminderRow(h,{target:meeting,template:'reminder.bom_meeting_question'})).resolves.toHaveLength(1);
  await h.operator.query('UPDATE reminder_targets SET enabled=false WHERE id=$1',[golive]);
  expect(await refused(reminderRow(h,{target:golive})),'a disabled target').toBe(true);
  expect(await count("SELECT count(*) n FROM outbox_messages WHERE reminder_target_id IS NOT NULL")).toBe(3);
 });

 test('no application role writes a target or a series, and no role but the scheduler queues a reminder',async()=>{
  await tables();
  const target=await insertTarget(h);
  await insertSeries(h);
  for(const role of ['libetech_reminder','libetech_runtime','libetech_intake','libetech_identity','libetech_projector'] as const){
   expect(await refused(as(h,role,[ids.sales],q=>q(`INSERT INTO reminder_targets(tenant_id,project_id,kind,chat_id,enabled) VALUES($1,$2,'bom_meeting',$3,true)`,[ids.tenant,ids.sales,groupOther]))),role+' inserts a target').toBe(true);
   expect(await refused(as(h,role,[ids.sales],q=>q('UPDATE reminder_targets SET chat_id=$1 WHERE id=$2 RETURNING id',[groupOther,target]))),role+' moves a target').toBe(true);
   expect(await refused(as(h,role,[ids.sales],q=>q("UPDATE meeting_series SET start_time='07:00' RETURNING id"))),role+' moves a series').toBe(true);
  }
  expect((await h.operator.query<{c:string}>('SELECT chat_id c FROM reminder_targets WHERE id=$1',[target])).rows[0].c).toBe(groupSales);
  // intake may insert group rows of its project, but never a reminder one; the runtime role inserts nothing
  const asIntake=()=>as(h,'libetech_intake',[ids.sales],q=>q(`INSERT INTO outbox_messages(tenant_id,project_id,reminder_target_id,event_id,event_type,trace_id,correlation_id,audience,target_chat_id,template,payload,dedupe_key)
    VALUES($1,$2,$3,$4,'reminder.golive_status',$5,$6,'group',$7,'reminder.golive_status','{}','k-intake')`,[ids.tenant,ids.sales,target,randomUUID(),randomUUID(),randomUUID(),groupSales]));
  expect(await refused(asIntake()),'intake queues a reminder').toBe(true);
  // the scheduler cannot reach anything else: no DM row, no state change, no read of work or messages
  const dm=()=>as(h,'libetech_reminder',[ids.sales],q=>q(`INSERT INTO outbox_messages(tenant_id,event_id,event_type,trace_id,correlation_id,audience,target_chat_id,recipient_user_id,template,payload,dedupe_key)
    VALUES($1,$2,'account_approval.pending',$3,$4,'dm','900000101',$5,'account_approval.pending','{}','k-dm')`,[ids.tenant,randomUUID(),randomUUID(),randomUUID(),randomUUID()]));
  expect(await refused(dm()),'the scheduler queues a DM').toBe(true);
  await reminderRow(h,{target});
  expect(await refused(as(h,'libetech_reminder',[ids.sales],q=>q("UPDATE outbox_messages SET state='abandoned' RETURNING id"))),'the scheduler moves a state').toBe(true);
  for(const sql of ['SELECT title FROM work_items','SELECT chat_id FROM source_events','SELECT sender_id FROM intake_pool_items','SELECT name FROM identity.users','SELECT payload FROM outbox_messages'])
   expect(await refused(as(h,'libetech_reminder',[ids.sales],q=>q(sql))),sql).toBe(true);
 });

 test('IBS HI and unconfirmed-domain projects get no reminder, even through a target made while they were allowed',async()=>{
  await tables();
  await expect(insertTarget(h,{project:sameBuProject,chat:groupOther}),'no confirmed domain').rejects.toThrow();
  const sales=await insertTarget(h);
  await mapDomain(h,ids.sales,'IBS_HI',2);
  expect(await refused(reminderRow(h,{target:sales})),'remapped to IBS HI').toBe(true);
  await mapDomain(h,ids.transport,'LIBERICO_BU',2);
  await h.operator.query("UPDATE projects SET bu='IBS HI' WHERE id=$1",[ids.transport]);
  await expect(insertTarget(h,{project:ids.transport,chat:groupTransport}),'a BU named IBS HI').rejects.toThrow();
  // a disabled target may be written for any project: it sends nothing
  await expect(insertTarget(h,{project:sameBuProject,chat:groupOther,enabled:false})).resolves.toBeTruthy();
  expect(await count('SELECT count(*) n FROM outbox_messages WHERE reminder_target_id IS NOT NULL')).toBe(0);
 });

 test('every change of a target or a series leaves an audit row with its source; no application role reads it',async()=>{
  await tables();
  const target=await insertTarget(h,{source:'Biên bản thử A'});
  await h.operator.transaction(async tx=>{await tx.query("SELECT set_config('libetech.reminder_source','Biên bản thử B',true)");await tx.query('UPDATE reminder_targets SET enabled=false,updated_at=now() WHERE id=$1',[target]);});
  const series=await insertSeries(h);
  // a version bump alone (what a recorded change does) is not a configuration change
  await h.operator.query('UPDATE meeting_series SET version=version+1,updated_at=now() WHERE id=$1',[series]);
  const ids_=(await h.operator.query<{r:string|null;t:string|null}>('SELECT to_jsonb(e)->>$1 AS r,to_jsonb(e)->>$2 AS t FROM reminder_config_events e',['request_id','trace_id'])).rows;
  expect(ids_.every(x=>x.r&&x.t),'every event carries a request id and a trace id').toBe(true);
  const run=randomUUID();
  await h.operator.transaction(async tx=>{await tx.query("SELECT set_config('libetech.reminder_source','Biên bản thử C',true),set_config('libetech.request_id',$1,true)",[run]);
   await tx.query('UPDATE reminder_targets SET send_time=$2,updated_at=now() WHERE id=$1',[target,'09:00']);});
  expect((await h.operator.query<{r:string|null}>("SELECT to_jsonb(e)->>'request_id' AS r FROM reminder_config_events e WHERE source='Biên bản thử C'")).rows).toEqual([{r:run}]);
  await h.operator.query('UPDATE reminder_targets SET send_time=$2,updated_at=now() WHERE id=$1',[target,'08:30']);
  const events=(await h.operator.query<{entity:string;op:string;source:string}>("SELECT entity,op,source FROM reminder_config_events WHERE source NOT IN ('Biên bản thử C','unstated') ORDER BY seq")).rows;
  expect(events).toEqual([{entity:'reminder_target',op:'INSERT',source:'Biên bản thử A'},{entity:'reminder_target',op:'UPDATE',source:'Biên bản thử B'},{entity:'meeting_series',op:'INSERT',source:'Lịch gốc thử'}]);
  for(const role of ['libetech_reminder','libetech_runtime','libetech_intake'] as const)
   expect(await refused(as(h,role,[ids.sales],async q=>{const r=await q('SELECT id FROM reminder_config_events');if(!r.length)throw new Error('nothing visible');return r;})),role).toBe(true);
  expect(await refused(h.operator.query('DELETE FROM reminder_config_events'))).toBe(true);
 });
});

test('every privileged function of this migration pins its search path with the temporary schema last',async()=>{
 await tables();
 const names=['reminder_project_allowed','meeting_changes_guard','meeting_source','reminder_config_record','tech_roster_members','reminder_delivery_facts'];
 const rows=(await h.operator.query<{proname:string;config:string}>("SELECT proname,coalesce(array_to_string(proconfig,';'),'') AS config FROM pg_proc WHERE proname=ANY($1::text[]) AND prosecdef ORDER BY proname",[names])).rows;
 expect(rows.map(r=>r.proname).sort()).toEqual([...names].sort());
 for(const r of rows) expect(r.config.split(';').find(c=>c.startsWith('search_path='))?.replace(/ /g,''),r.proname).toBe('search_path=pg_catalog,pg_temp');
});

describe('migration 031',()=>{
 const forward=()=>readFile(path.join(process.cwd(),'migrations/031_reminders.sql'),'utf8').catch(()=>'SELECT 1');
 const rollback=()=>readFile(path.join(process.cwd(),'migrations/rollback/031_reminders.sql'),'utf8').catch(()=>'SELECT 1');
 test('the rollback refuses while a reminder or its configuration exists; on a clean copy it rolls back and applies again',async()=>{
  await tables();
  const above=await takeOffAbove(h,31);
  try {
   const target=await insertTarget(h);
   await reminderRow(h,{target});
   await expect(h.exec(await rollback())).rejects.toThrow(/reminder/i);
   await h.exec('ROLLBACK').catch(()=>{});// the refused file leaves its transaction open and aborted
   expect(await regclass(h,'public.reminder_targets')).not.toBeNull();
  } finally {await h.exec('ROLLBACK').catch(()=>{});await putBack(h,above);}
  await h.reset();
  const fresh=await openHarness();
  try {
   if(!fresh.native){
    const up=await takeOffAbove(fresh,31);
    await fresh.exec(await rollback());
    expect(await regclass(fresh,'public.reminder_targets')).toBeNull();
    const cols=(await fresh.operator.query("SELECT 1 FROM information_schema.columns WHERE table_name='outbox_messages' AND column_name='reminder_target_id'")).rows;
    expect(cols).toHaveLength(0);
    await fresh.exec(await forward());await fresh.exec(await forward());
    expect(await regclass(fresh,'public.reminder_targets')).not.toBeNull();
    await putBack(fresh,up);
   }
  } finally {await fresh.close();}
 });
});
