// GIAO VIỆC 5 F: the scheduler queues each reminder once, inside its time window, to the enabled target of one project; it says why it did not queue one.
import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {assertRestrictedLogin} from '../src/server/db';
import {openHarness,type Harness} from './slice1-db';
import {member,pm} from './slice1-fixtures';
import {bridgeConfig,chatSales,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {mapDomain} from './slice3-fixtures';
import {IntakeService} from '../src/server/intake';
import {MeetingService} from '../src/server/meetings';
import {projectGoliveStatus} from '../src/server/golive-status';
import {reminderCounts,sendReminders} from '../src/server/reminders';
import {OutboxService} from '../src/server/outbox';
import * as bridgeConfigModule from '../src/server/bridge-config';
import {ids} from '../src/server/identities';
import {groupOther,groupSales,groupTransport,insertSeries,insertTarget,reminderRow,seedReminders,techA,techB} from './reminder-fixtures';

let h:Harness;
beforeEach(async()=>{
 h=await openHarness();await seedReminders(h);
 await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[ids.tenant,member.id]);
});
afterEach(async()=>{await h.reset();await h.close();});

/** An instant given as Vietnam local time. */
const vn=(local:string)=>new Date(local+':00+07:00');
const TUE=vn('2026-11-24T08:35');
type Sent={template:string;target_chat_id:string;project_id:string;payload:{params:Record<string,string>}};
const sent=async()=>(await h.operator.query<Sent>('SELECT template,target_chat_id,project_id,payload FROM outbox_messages WHERE reminder_target_id IS NOT NULL ORDER BY created_at,dedupe_key').catch(()=>({rows:[] as Sent[]}))).rows;
const run=(now:Date=TUE,intakeProjects:string[]|null=null)=>sendReminders(h.operator,{tenantId:ids.tenant,now,intakeProjects});
const target=(over:Parameters<typeof insertTarget>[1]={})=>insertTarget(h,over).catch(()=>'');
/** Projects the status and stamps it as taken `minutes` before the pretend clock. */
const projected=async(project:string=ids.sales,now:Date=TUE,minutes=5)=>{
 await projectGoliveStatus(h.operator,ids.tenant,project);
 await h.operator.query('UPDATE analytics.golive_member_status SET projected_at=$1 WHERE project_id=$2',[new Date(now.getTime()-minutes*60000).toISOString(),project]).catch(()=>{});
};

describe('GO LIVE status reminder',()=>{
 test('one weekday message per target per day, with names only, and a second run queues nothing',async()=>{
  await target();await projected();
  await expect(run()).resolves.toMatchObject({queued:1,replayed:0});
  await expect(run(vn('2026-11-24T09:20'))).resolves.toMatchObject({queued:0,replayed:1});
  const rows=await sent();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({template:'reminder.golive_status',target_chat_id:groupSales,project_id:ids.sales});
  const p=rows[0]?.payload.params??{};
  expect(p).toMatchObject({project:'Cổng bán hàng mẫu',date:'2026-11-24'});
  expect(p.noRequest).toContain(techB.name);
  expect(p.noEvidence).toContain(member.name+' (1 việc)');
  const text=JSON.stringify(rows[0]?.payload??{});
  for(const secret of ['LT-DEMO','Bộ lọc','Chuẩn hóa','fixture-only','90000']) expect(text,secret).not.toContain(secret);
 });

 test('nothing outside weekday mornings; a missed window and a stale status are counted, never silent',async()=>{
  await target();await projected();
  for(const at of ['2026-11-24T07:59','2026-11-28T08:35','2026-11-29T08:35']) await expect(run(vn(at)),at).resolves.toMatchObject({queued:0});
  await projected(ids.sales,vn('2026-11-24T12:00'));
  await expect(run(vn('2026-11-24T12:00'))).resolves.toMatchObject({queued:0,skipped:{window_passed:1}});
  await projected(ids.sales,TUE,180);
  await expect(run()).resolves.toMatchObject({queued:0,skipped:{stale_status:1}});
  expect(await sent()).toEqual([]);
 });

 test('no row means nothing to send; a target outside the intake scope, or on a project now IBS HI, sends nothing and says why',async()=>{
  await expect(run()).resolves.toMatchObject({queued:0,replayed:0});
  await target();await projected();
  await expect(run(TUE,[ids.transport])).resolves.toMatchObject({queued:0,skipped:{not_in_intake_scope:1}});
  await mapDomain(h,ids.sales,'IBS_HI',2);
  await expect(run()).resolves.toMatchObject({queued:0,skipped:{refused_project:1}});
  expect(await sent()).toEqual([]);
 });

 test('everybody has filed and has evidence: no message',async()=>{
  // only techA stays on the roster: no open work of theirs, and one request filed
  await h.operator.query('DELETE FROM identity.tech_roster WHERE user_id<>$1',[techA.id]);
  await h.operator.query(`INSERT INTO work_requests(tenant_id,project_id,requester_id,requester_name,request_key,request_hash,title) VALUES($1,$2,$3,$4,$5,$6,'Yêu cầu thử đã gửi')`,
    [ids.tenant,ids.sales,techA.id,techA.name,randomUUID(),'a'.repeat(64)]);
  await target();await projected();
  await expect(run()).resolves.toMatchObject({queued:0,skipped:{nothing_missing:1}});
 });

 test('a message of one project names nobody of another, and long or unsafe names are cut and cleaned, never silently',async()=>{
  await h.operator.query("UPDATE identity.users SET name=$1 WHERE id=$2",['AAA @kênh/lệnh\nxuống <dòng> {date}',techB.id]);
  for(let i=0;i<30;i++){
   const id=randomUUID();
   await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,'viewer','fixture-only')`,[id,ids.tenant,'gv5f-many-'+i,`Nguyễn Thị Thành Viên Số ${String(i).padStart(2,'0')} Rất Dài`]);
   await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,id]);
  }
  await target();await target({project:ids.transport,chat:groupTransport});await projected();await projected(ids.transport);
  await expect(run()).resolves.toMatchObject({queued:2});
  const rows=await sent();
  const sales=rows.find(r=>r.project_id===ids.sales)?.payload.params??{};
  expect(sales.noRequest).toMatch(/ và \d+ người nữa$/);
  expect(sales.noRequest).not.toMatch(/[@\/<>\n]/);
  expect(sales.noRequest).toContain('AAA kênh lệnh xuống dòng');
  expect(sales.noRequest).not.toMatch(/[{}]/);
  for(const r of rows) expect(Buffer.byteLength(JSON.stringify(r.payload))).toBeLessThanOrEqual(2048);
  // the engineer holds no work in transport: no «1 việc» entry there
  expect(rows.find(r=>r.project_id===ids.transport)?.payload.params.noEvidence??'x').not.toContain(member.name);
 });
});

describe('BoM meeting reminder',()=>{
 // series on Thursdays at 09:00; WED is the day before, 08:35
 const WED=vn('2026-11-25T08:35');
 const code=async()=>(await new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats:bridgeConfig.intake!.chats,excerptChats:[chatSales]}).ingest(messageEvent())).candidateRef!;
 const record=(over:Record<string,unknown>,now:Date,version=1,series='')=>new MeetingService(h.db,()=>now).record(pm,{seriesId:series,requestKey:randomUUID(),kind:'one_off',sessionDate:'2026-11-26',newTime:'14:00',resolvesChangeId:null,expectedVersion:version,...over});
 let series='';
 beforeEach(async()=>{series=await insertSeries(h).catch(()=>'');await target({kind:'bom_meeting',chat:groupOther});});

 test('one message the day before at the target time, with the base time; a changed time sends one more with its IN code',async()=>{
  await expect(run(vn('2026-11-25T08:00'))).resolves.toMatchObject({queued:0});
  await expect(run(WED)).resolves.toMatchObject({queued:1});
  await expect(run(vn('2026-11-25T15:00'))).resolves.toMatchObject({queued:0,replayed:1});
  const ref=await code();
  await record({sourceRef:ref},vn('2026-11-25T16:00'),1,series).catch(()=>{});
  await expect(run(vn('2026-11-25T16:05'))).resolves.toMatchObject({queued:1});
  expect((await sent()).map(r=>r.payload.params)).toEqual([
   {project:'Cổng bán hàng mẫu',date:'2026-11-26',time:'09:00',source:'base'},
   {project:'Cổng bán hàng mẫu',date:'2026-11-26',time:'14:00',source:ref}]);
  expect((await sent()).every(r=>r.template==='reminder.bom_meeting'&&r.target_chat_id===groupOther)).toBe(true);
 });

 test('no message at night, nor after the session started; a session the timer missed the day before is sent that morning',async()=>{
  await expect(run(vn('2026-11-25T22:30'))).resolves.toMatchObject({queued:0});
  await expect(run(vn('2026-11-26T06:30'))).resolves.toMatchObject({queued:0});
  await expect(run(vn('2026-11-26T09:05'))).resolves.toMatchObject({queued:0});
  await expect(run(vn('2026-11-26T07:15'))).resolves.toMatchObject({queued:1});
 });

 test('an unclear change stops the reminder and asks once; after the answer the reminder carries the answered time',async()=>{
  const ref=await code();
  await record({kind:'unclear',sessionDate:null,sourceRef:ref},vn('2026-11-24T10:00'),1,series).catch(()=>{});
  await expect(run(WED)).resolves.toMatchObject({queued:1,skipped:{blocked_unclear:1}});
  await expect(run(vn('2026-11-25T10:00'))).resolves.toMatchObject({queued:0,replayed:1});
  expect(await sent()).toMatchObject([{template:'reminder.bom_meeting_question',payload:{params:{project:'Cổng bán hàng mẫu',source:ref,date:'2026-11-26'}}}]);
  const open=(await new MeetingService(h.db,()=>WED).list(pm)).series.find(s=>s.id===series)?.openQuestions[0]?.id??randomUUID();
  const answer=await code();
  await record({sourceRef:answer,resolvesChangeId:open},vn('2026-11-25T11:00'),2,series).catch(()=>{});
  await expect(run(vn('2026-11-25T11:05'))).resolves.toMatchObject({queued:1});
  expect((await sent()).at(-1)).toMatchObject({template:'reminder.bom_meeting',payload:{params:{time:'14:00',source:answer}}});
 });
});

describe('operating the scheduler',()=>{
 test('the status check counts queued reminders by message and state, and nothing else',async()=>{
  await reminderRow(h,{target:await target()});
  await reminderRow(h,{target:await target({kind:'bom_meeting',chat:groupOther}),chat:groupOther,template:'reminder.bom_meeting'});
  await expect(reminderCounts(h.operator,ids.tenant)).resolves.toEqual([
   {template:'reminder.bom_meeting',state:'pending',n:1},{template:'reminder.golive_status',state:'pending',n:1}]);
 });
 test('one target that fails is counted as failed and does not stop the others',async()=>{
  await target();await projected();
  await insertSeries(h);await target({kind:'bom_meeting',chat:groupOther});
  // the status table closes to the scheduler for this case only: the GO LIVE target fails, the meeting target still goes
  await h.operator.query('REVOKE SELECT ON analytics.golive_member_status FROM libetech_reminder');
  try { await expect(run(vn('2026-11-25T08:35'))).resolves.toMatchObject({queued:1,skipped:{failed:1}}); }
  finally { await h.operator.query('GRANT SELECT ON analytics.golive_member_status TO libetech_reminder'); }
  expect((await sent()).map(r=>r.template)).toEqual(['reminder.bom_meeting']);
 });
});

describe('the intake scope the scheduler checks',()=>{
 test('is exactly what the gateway pull uses: the projects of the intake chats, each once; none without intake',()=>{
  const ids_=(bridgeConfigModule as unknown as {intakeProjectIds?:(c:typeof bridgeConfig)=>string[]|null}).intakeProjectIds;
  expect(ids_?.(bridgeConfig)?.slice().sort()).toEqual([ids.sales,ids.transport,'11000000-0000-4000-8000-000000000003'].sort());
  expect(ids_?.({key:bridgeConfig.key,chatScopes:bridgeConfig.chatScopes})).toBeNull();
 });
});

describe('delivery',()=>{
 const outbox=()=>new OutboxService(h.operator,{} as never,{id:intakePrincipalId,tenantId:ids.tenant,projectIds:[ids.sales]});
 test('a queued reminder is pulled for its target; one older than six hours expires with a visible code instead of going out late',async()=>{
  const t=await target();
  await reminderRow(h,{target:t,dedupe:'old'}).catch(()=>{});
  await h.operator.transaction(async tx=>{await tx.query("SET LOCAL session_replication_role = 'replica'");await tx.query("UPDATE outbox_messages SET created_at=now()-interval '7 hour' WHERE dedupe_key='old'");});
  await reminderRow(h,{target:t,dedupe:'fresh'}).catch(()=>{});
  const pulled=await outbox().pull({limit:10});
  expect(pulled.deliveries.map(d=>[d.chatId,d.envelope.payload.template,d.replyToMessageId])).toEqual([[groupSales,'reminder.golive_status',null]]);
  const rows=(await h.operator.query<{dedupe_key:string;state:string;last_error_code:string|null}>('SELECT dedupe_key,state,last_error_code FROM outbox_messages ORDER BY dedupe_key')).rows;
  expect(rows).toEqual([{dedupe_key:'fresh',state:'leased',last_error_code:null},{dedupe_key:'old',state:'dead',last_error_code:'REMINDER_EXPIRED'}]);
 });
});

describe('operator scripts (deploy/reminder-targets.sql, deploy/meeting-series.sql)',()=>{
 // psql is not part of the test: the script text is run with its variables written in as literals; meta-commands (the \getenv of the chat id) are dropped
 const script=async(file:string,vars:Record<string,string>)=>{
  let sql=await readFile(path.join(process.cwd(),'deploy',file),'utf8').catch(()=>'SELECT 1');
  for(const [k,v] of Object.entries(vars)) sql=sql.replaceAll(`:'${k}'`,"'"+v.replaceAll("'","''")+"'");
  await h.exec(sql.split('\n').filter(l=>!l.startsWith('\\')).join('\n'));
 };
 const rows=async(sql:string)=>(await h.operator.query<Record<string,unknown>>(sql).catch(()=>({rows:[{missing:true}]}))).rows;
 test('the target script writes and updates one target per project and kind, and records each real change with its source',async()=>{
  const vars={tenant_id:ids.tenant,project_id:ids.sales,kind:'golive_status',chat_id:groupSales,topic_id:'',send_time:'08:30',lead_days:'1',enabled:'true',source:'Biên bản thử A'};
  await script('reminder-targets.sql',vars);await script('reminder-targets.sql',vars);
  await script('reminder-targets.sql',{...vars,enabled:'false',source:'Biên bản thử B'});
  expect(await rows('SELECT kind,chat_id,enabled FROM reminder_targets')).toEqual([{kind:'golive_status',chat_id:groupSales,enabled:false}]);
  expect(await rows('SELECT op,source FROM reminder_config_events ORDER BY seq')).toEqual([{op:'INSERT',source:'Biên bản thử A'},{op:'UPDATE',source:'Biên bản thử B'}]);
  await expect(script('reminder-targets.sql',{...vars,source:'x'})).rejects.toThrow();
  await h.exec('ROLLBACK').catch(()=>{});
 });
 test('the series script writes and updates one series per project and title',async()=>{
  const vars={tenant_id:ids.tenant,project_id:ids.sales,title:'Họp BoM',weekday:'4',start_time:'09:00',enabled:'true',source:'Lịch gốc thử'};
  await script('meeting-series.sql',vars);await script('meeting-series.sql',{...vars,start_time:'10:00'});await script('meeting-series.sql',{...vars,start_time:'10:00'});
  expect(await rows("SELECT weekday,to_char(start_time,'HH24:MI') t,enabled,version FROM meeting_series")).toEqual([{weekday:4,t:'10:00',enabled:true,version:2}]);
  expect(await rows('SELECT op FROM reminder_config_events ORDER BY seq')).toEqual([{op:'INSERT'},{op:'UPDATE'}]);
 });
});

describe('the scheduler login',()=>{
 test('a login that also reaches another application role is refused',async()=>{
  const name='gv5f_both_'+randomUUID().slice(0,8);
  await h.operator.query(`CREATE ROLE ${name} LOGIN`);
  try {
   await h.operator.query(`GRANT libetech_reminder TO ${name}`).catch(()=>{});
   await h.operator.query(`GRANT libetech_runtime TO ${name}`);
   await expect(h.operator.transaction(async tx=>{await tx.query(`SET LOCAL ROLE ${name}`);await assertRestrictedLogin(tx);})).rejects.toThrow(/Runtime login/);
  } finally {
   await h.operator.query(`REVOKE libetech_runtime FROM ${name}`).catch(()=>{});
   await h.operator.query(`REVOKE libetech_reminder FROM ${name}`).catch(()=>{});
   await h.operator.query(`DROP ROLE ${name}`);
  }
 });
});
