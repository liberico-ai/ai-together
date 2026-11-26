// GIAO VIỆC 5 F: the web form and the two routes that record a BoM meeting time change. Synthetic ids and text.
import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {bridgeConfig,chatSales,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {IntakeService} from '../src/server/intake';
import {handleApi} from '../src/server/http';
import {COOKIE,createSession} from '../src/server/auth';
import {nextSession} from '../src/server/meeting-times';
import {MeetingsView,meetingBody} from '../src/components/meetings';
import type {SeriesView} from '../src/server/meetings';
import {ids} from '../src/server/identities';
import {insertSeries,seedReminders} from './reminder-fixtures';

const url='http://127.0.0.1:3147';
describe('the routes',()=>{
 let h:Harness;let series='';
 beforeEach(async()=>{h=await openHarness();await seedReminders(h);series=await insertSeries(h);});
 afterEach(async()=>{await h.reset();await h.close();});
 const cookie=(profileKey:string)=>COOKIE+'='+createSession(new Request(url+'/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:url}}),{profileKey}).token;
 const call=(method:string,route:string[],who:string,payload?:unknown)=>handleApi(new Request(url+'/api/v1/'+route.join('/'),
  {method,headers:{host:'127.0.0.1:3147',origin:url,cookie:cookie(who)},...(payload!==undefined?{body:JSON.stringify(payload)}:{})}),route,h.db);

 test('a seat lists its series and records a change (201, then 200 on a replay); a non-seat sees no series and gets 404',async()=>{
  const list=await call('GET',['meetings'],'manager');
  expect(list.status).toBe(200);
  expect((await list.json()).data.series.map((s:SeriesView)=>s.id)).toEqual([series]);
  expect((await (await call('GET',['meetings'],'engineer')).json()).data?.series).toEqual([]);
  const ref=(await new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats:bridgeConfig.intake!.chats,excerptChats:[chatSales]}).ingest(messageEvent())).candidateRef!;
  const body={seriesId:series,requestKey:randomUUID(),kind:'one_off',sessionDate:nextSession({weekday:4,startTime:'09:00'},[],new Date()).date,newTime:'14:00',sourceRef:ref,resolvesChangeId:null,expectedVersion:1};
  const made=await call('POST',['meetings','changes'],'manager',body);
  expect(made.status).toBe(201);
  expect((await made.json()).data).toMatchObject({replayed:false,series:{id:series,version:2}});
  expect((await call('POST',['meetings','changes'],'manager',body)).status).toBe(200);
  const denied=await call('POST',['meetings','changes'],'engineer',{...body,requestKey:randomUUID()});
  expect(denied.status).toBe(404);
  expect((await denied.json()).error.code).toBe('NOT_FOUND');
 });
});

const view=(over:Partial<SeriesView>={}):SeriesView=>({id:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',projectName:'Dự án Thử',title:'Họp BoM',
 weekday:4,baseTime:'09:00',enabled:true,version:3,next:{date:'2026-11-26',time:'09:00',sourceRef:null},openQuestions:[],changes:[],...over});
const change=(over:Record<string,unknown>={})=>({id:'33333333-3333-4333-8333-333333333333',seq:1,kind:'one_off',sessionDate:'2026-12-03',effectiveFrom:null,newTime:'14:00',sourceRef:'IN-0A1B2C3D',
 resolvesChangeId:null,recorderName:'Ghế BoM thử',at:'2026-11-26T01:00:00.000Z',...over}) as SeriesView['changes'][number];
const html=(series:SeriesView[])=>renderToStaticMarkup(<MeetingsView series={series} onCommand={()=>{}}/>);

describe('the page',()=>{
 test('each series shows its day, base time, next session with its source, and its history with who recorded it',()=>{
  const out=html([view({next:{date:'2026-11-26',time:'14:00',sourceRef:'IN-0A1B2C3D'},changes:[change()]})]);
  for(const text of ['Dự án Thử','Họp BoM','Thứ Năm','09:00','26/11/2026','14:00','IN-0A1B2C3D','Chỉ buổi 03/12/2026','Ghế BoM thử']) expect(out,text).toContain(text);
  expect(html([view()])).toContain('lịch gốc');
 });
 test('the form offers one session, the series, or unclear; an open question is shown with the pause and can be answered',()=>{
  const out=html([view()]);
  for(const text of ['Chỉ một buổi','Cả lịch định kỳ, từ buổi kế tiếp','Chưa rõ áp cho buổi nào','Mã tin xác nhận (IN-…)','Ghi thay đổi']) expect(out,text).toContain(text);
  expect(out).not.toContain('Trả lời câu hỏi');
  const open=html([view({openQuestions:[change({kind:'unclear',sessionDate:null})],changes:[change({kind:'unclear',sessionDate:null})]})]);
  expect(open).toContain('tạm ngừng nhắc');
  expect(open).toContain('Trả lời câu hỏi');
 });
 test('nobody without a series is shown a form',()=>{
  const out=html([]);
  expect(out).toContain('Bạn chưa có lịch họp nào để ghi');
  expect(out).not.toContain('Ghi thay đổi');
 });
 test('the body carries only what the kind needs, with the code upper-cased',()=>{
  const form=(v:Record<string,string>)=>(k:string)=>v[k]??'';
  expect(meetingBody(view(),form({kind:'one_off',sessionDate:'2026-11-26',newTime:'14:00',sourceRef:' in-0a1b2c3d ',resolvesChangeId:''}),'k1')).toEqual(
   {seriesId:view().id,requestKey:'k1',kind:'one_off',sessionDate:'2026-11-26',newTime:'14:00',sourceRef:'IN-0A1B2C3D',resolvesChangeId:null,expectedVersion:3});
  expect(meetingBody(view(),form({kind:'recurring',sessionDate:'2026-11-26',newTime:'10:00',sourceRef:'IN-0A1B2C3D',resolvesChangeId:'q'}),'k2')).toMatchObject({sessionDate:null,resolvesChangeId:'q'});
  expect(meetingBody(view(),form({kind:'unclear',sessionDate:'2026-11-26',newTime:'',sourceRef:'IN-0A1B2C3D',resolvesChangeId:'q'}),'k3')).toMatchObject({sessionDate:null,newTime:null,resolvesChangeId:null});
 });
});
