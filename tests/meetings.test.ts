// GIAO VIỆC 5 F: a BoM meeting time change is recorded by a BoM seat of the project or a BoM Tech, with the IN code of a stored message of that project, and
// applies to exactly one session or to the series. An unclear change applies nothing until it is answered.
import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,pm} from './slice1-fixtures';
import {approver,reviewer} from './slice3-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {chatPool,insertPoolItem} from './pool-fixtures';
import {IntakeService,refOf} from '../src/server/intake';
import {MeetingService,type SeriesView} from '../src/server/meetings';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';
import {as,bomUser,insertSeries,seedReminders,techA} from './reminder-fixtures';

let h:Harness;
let series:string;
// Tuesday 24/11/2026 09:00 in Vietnam; the series meets on Thursdays at 09:00, so the next session is 26/11.
const TUE=new Date('2026-11-24T02:00:00Z');
beforeEach(async()=>{h=await openHarness();await seedReminders(h);series=await insertSeries(h).catch(()=>randomUUID());});
afterEach(async()=>{await h.reset();await h.close();});

const svc=(now:Date=TUE)=>new MeetingService(h.db,()=>now);
const view=async(p:Principal=pm,now:Date=TUE):Promise<SeriesView|undefined>=>(await svc(now).list(p)).series.find(s=>s.id===series);
const cfg={chats:bridgeConfig.intake!.chats,excerptChats:[chatSales]};
const code=async(chat:string=chatSales)=>{
 const ack=await new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,cfg).ingest(messageEvent({context:{chatId:chat}}));
 return ack.candidateRef??'IN-00000000';
};
const n=async()=>Number((await h.operator.query<{n:string}>('SELECT count(*) n FROM meeting_changes').catch(()=>({rows:[{n:'-1'}]}))).rows[0].n);
const change=async(over:Record<string,unknown>={},version=1)=>({seriesId:series,requestKey:randomUUID(),kind:'one_off',sessionDate:'2026-11-26',newTime:'14:00',sourceRef:await code(),resolvesChangeId:null,expectedVersion:version,...over});

describe('who records a change',()=>{
 test('a BoM seat of the project and a BoM Tech may; a member without a seat, a Team Tech member and a bot may not',async()=>{
  for(const p of [member,techA]) {
   expect((await svc().list(p)).series.map(s=>s.id)).toEqual([]);
   await expect(svc().record(p,await change())).rejects.toMatchObject({code:'NOT_FOUND',status:404});
  }
  await expect(svc().record(bot,await change())).rejects.toMatchObject({code:'READ_ONLY'});
  expect(await n()).toBe(0);
  for(const [i,p] of [pm,reviewer,approver,bomUser].entries()) {
   await expect(svc().record(p,await change({sessionDate:'2026-11-26',newTime:`1${i}:00`},i+1)),p.name).resolves.toMatchObject({replayed:false});
  }
  expect(await n()).toBe(4);
 });
 test('the database refuses a change written by anyone else, and a recorded change never changes',async()=>{
  await svc().record(pm,await change()).catch(()=>{});
  expect(await n()).toBe(1);
  const row=(await h.operator.query<{source_candidate_id:string}>('SELECT source_candidate_id FROM meeting_changes')).rows[0];
  const direct=(writer:string,recorder:string)=>as(h,'libetech_runtime',[ids.sales],q=>q(`INSERT INTO meeting_changes(tenant_id,project_id,series_id,kind,session_date,new_time,source_candidate_id,recorded_by,recorder_name,request_key,request_hash)
    VALUES($1,$2,$3,'one_off','2026-12-03','07:00',$4,$5,'x',$6,$7) RETURNING id`,[ids.tenant,ids.sales,series,row?.source_candidate_id??null,recorder,randomUUID(),'a'.repeat(64)]),writer);
  await expect(direct(member.id,member.id),'a member without a seat').rejects.toThrow();
  await expect(direct(reviewer.id,pm.id),'a seat writing in another name').rejects.toThrow();
  await expect(h.operator.query("UPDATE meeting_changes SET new_time='07:00'")).rejects.toThrow();
  expect(await n()).toBe(1);
 });
});

describe('what a change applies to',()=>{
 test('a one-off change moves exactly that session; the following ones keep the base time',async()=>{
  await expect(svc().record(pm,await change())).resolves.toMatchObject({replayed:false});
  const s=await view();
  expect(s?.next).toMatchObject({date:'2026-11-26',time:'14:00'});
  expect(s?.next?.sourceRef).toMatch(/^IN-[0-9A-F]{8}$/);
  expect((await view(pm,new Date('2026-11-27T02:00:00Z')))?.next).toEqual({date:'2026-12-03',time:'09:00',sourceRef:null});
 });
 test('a recurring change applies from the next session that has not started; after today\'s session it starts a week later',async()=>{
  const ref=await code();
  await svc().record(pm,await change({kind:'recurring',sessionDate:null,newTime:'10:00',sourceRef:ref})).catch(()=>{});
  expect((await view())?.next).toEqual({date:'2026-11-26',time:'10:00',sourceRef:ref});
  expect((await view(pm,new Date('2026-12-02T02:00:00Z')))?.next).toEqual({date:'2026-12-03',time:'10:00',sourceRef:ref});
  // recorded Thursday 26/11 at 11:00 VN, after that day's session: it starts on 03/12
  const late=await code();
  const thu=new Date('2026-11-26T04:00:00Z');
  await svc(thu).record(pm,await change({kind:'recurring',sessionDate:null,newTime:'15:00',sourceRef:late},2)).catch(()=>{});
  expect((await view(pm,thu))?.next).toEqual({date:'2026-12-03',time:'15:00',sourceRef:late});
  expect((await view(pm,new Date('2026-11-26T01:00:00Z')))?.next).toMatchObject({date:'2026-11-26',time:'10:00'});
 });
 test('a one-off change of a session wins over a recurring one, whichever was recorded first',async()=>{
  const one=await code();
  await svc().record(pm,await change({sourceRef:one})).catch(()=>{});
  await svc().record(pm,await change({kind:'recurring',sessionDate:null,newTime:'10:00'},2)).catch(()=>{});
  expect((await view())?.next).toEqual({date:'2026-11-26',time:'14:00',sourceRef:one});
 });
 test('an unclear change applies nothing and stays open until a one-off or recurring change answers it, once',async()=>{
  const ref=await code();
  await expect(svc().record(pm,await change({kind:'unclear',sessionDate:null,newTime:'14:00',sourceRef:ref}))).resolves.toMatchObject({replayed:false});
  let s=await view();
  expect(s?.next).toEqual({date:'2026-11-26',time:'09:00',sourceRef:null});
  expect(s?.openQuestions).toMatchObject([{sourceRef:ref}]);
  const q=s?.openQuestions[0]?.id??randomUUID();
  await expect(svc().record(pm,await change({kind:'unclear',sessionDate:null,resolvesChangeId:q},2))).rejects.toThrow();
  await expect(svc().record(pm,await change({resolvesChangeId:q},2))).resolves.toMatchObject({replayed:false});
  s=await view();
  expect(s?.openQuestions).toEqual([]);
  await expect(svc().record(pm,await change({resolvesChangeId:q},3))).rejects.toMatchObject({code:'RESOLVE_INVALID'});
  await expect(svc().record(pm,await change({resolvesChangeId:s?.changes.find(c=>c.kind==='one_off')?.id??randomUUID()},3))).rejects.toMatchObject({code:'RESOLVE_INVALID'});
 });
});

describe('the source and the input',()=>{
 test('the source is a stored message of this project: a candidate, or a shared-group message assigned to it',async()=>{
  const other=await code(chatTransport);
  await expect(svc().record(pm,await change({sourceRef:'IN-0000000F'}))).rejects.toMatchObject({code:'SOURCE_NOT_FOUND',status:422});
  await expect(svc().record(pm,await change({sourceRef:other}))).rejects.toMatchObject({code:'SOURCE_NOT_FOUND'});
  const item=await insertPoolItem(h,{chat:chatPool});
  await expect(svc().record(pm,await change({sourceRef:refOf(item)}))).rejects.toMatchObject({code:'SOURCE_NOT_FOUND'});// not assigned yet
  await h.operator.transaction(async tx=>{
   await tx.query("SELECT set_config('app.person_id',$1,true)",[techA.id]);// the triage guard (025) names the actor of the transaction
   await tx.query("UPDATE intake_pool_items SET state='assigned',project_id=$1,classification='request',triaged_by=$2,triaged_at=now(),version=version+1 WHERE id=$3",[ids.sales,techA.id,item]);
  });
  await expect(svc().record(pm,await change({sourceRef:refOf(item)}))).resolves.toMatchObject({replayed:false});
  expect(await n()).toBe(1);
 });
 test('the same request twice writes once; the same key with other content, or a stale version, writes nothing',async()=>{
  const body=await change();
  await expect(svc().record(pm,body)).resolves.toMatchObject({replayed:false});
  await expect(svc().record(pm,body)).resolves.toMatchObject({replayed:true});
  await expect(svc().record(pm,{...body,newTime:'16:00'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  await expect(svc().record(pm,await change({},1))).rejects.toMatchObject({code:'REVISION_CONFLICT'});
  expect(await n()).toBe(1);
 });
 test('a one-off names a coming session of the series and a time; identity comes from the session only',async()=>{
  for(const sessionDate of ['2026-11-25','2026-11-19','2026-13-01',null])
   await expect(svc().record(pm,await change({sessionDate})),String(sessionDate)).rejects.toThrow();
  await expect(svc().record(pm,await change({newTime:null}))).rejects.toThrow();
  await expect(svc().record(pm,await change({newTime:'24:10'}))).rejects.toThrow();
  await expect(svc().record(pm,{...(await change()),recordedBy:member.id})).rejects.toThrow();
  await expect(svc().record(pm,await change({seriesId:randomUUID()}))).rejects.toMatchObject({code:'NOT_FOUND'});
  expect(await n()).toBe(0);
 });
});
