import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {native,openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent,ticketStateColumns,type EventOverride} from './slice2-fixtures';
import {IntakeService} from '../src/server/intake';
import {InboxService} from '../src/server/inbox';
import {OutboxService} from '../src/server/outbox';
import {IdentityService} from '../src/server/identity';
import {ProjectRegistryService} from '../src/server/projects-registry';
import {WorkService} from '../src/server/service';
import {candidateTransition,type CandidateAction,type CandidateState} from '../src/server/intake-rules';
import {ids} from '../src/server/identities';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const chats=bridgeConfig.intake!.chats;
const intake=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,chats);
const inbox=()=>new InboxService(h.db);
const outbox=()=>new OutboxService(h.operator,new IdentityService(h.operator,ids.tenant),{id:intakePrincipalId,tenantId:ids.tenant,projectIds:[ids.sales,ids.transport]});
const k=()=>randomUUID();
type R=Record<string,unknown>;
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const ingest=async(o:EventOverride={})=>{
  const e=messageEvent(o);
  const ack=await intake().ingest(e);
  const id=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
  return {id,ack,e};
};
const mapDomain=(project:string,code:string)=>h.operator.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,$3,$4,'synthetic-source',1)",[ids.tenant,project,code,pm.id]);
const kinds=async(id:string)=>(await rows<{kind:string}>('SELECT kind FROM intake_events WHERE entity_id=$1 ORDER BY created_at,id',[id])).map(r=>r.kind);
const confirm=(v=1)=>({kind:'confirm',expectedVersion:v,classification:'incident'});
const deniedMessage=async(p:Promise<unknown>)=>{
  const e=await p.then(()=>{throw new Error('expected SCOPE_DENIED');},x=>x);
  expect(e).toMatchObject({code:'SCOPE_DENIED',status:404});
  return (e as Error).message;
};
const rcpt=(d:{outboxId:string;attemptNo:number;leaseToken:string},o:R={})=>({outboxId:d.outboxId,attemptNo:d.attemptNo,leaseToken:d.leaseToken,phase:'send',outcome:'delivered',telegramMessageId:'77',reportedAt:new Date().toISOString(),...o});
/** ingest an addressed message, lease its receipt and report the given outcome */
const settle=async(over:R)=>{
  const {id}=await ingest();
  const d=(await outbox().pull({limit:5})).deliveries;
  expect(d).toHaveLength(1);
  await outbox().report({receipts:[rcpt(d[0],over)]});
  return {candidateId:id,outboxId:d[0].outboxId};
};
const outboxRow=async(id:string)=>(await rows<{state:string;version:number;attempt_no:number;failure_owner_id:string|null}>('SELECT state,version,attempt_no,failure_owner_id FROM outbox_messages WHERE id=$1',[id]))[0];

test('list requires a project and returns only that project\'s candidates',async()=>{
  await expect(inbox().list(pm,{})).rejects.toBeInstanceOf(ZodError);
  await expect(inbox().list(pm,{projectId:ids.sales,tenantId:ids.tenant})).rejects.toBeInstanceOf(ZodError);
  const a=await ingest();
  await ingest();
  await ingest({context:{chatId:chatTransport}});
  const sales=await inbox().list(pm,{projectId:ids.sales});
  expect(sales.total).toBe(2);
  expect(sales.items).toHaveLength(2);
  expect(sales.items.every(c=>c.projectId===ids.sales)).toBe(true);
  expect((await inbox().list(pm,{projectId:ids.transport})).total).toBe(1);
  expect((await inbox().list(pm,{projectId:ids.sales,limit:1,offset:1})).items).toHaveLength(1);
  await expect(inbox().list(pm,{projectId:ids.sales,limit:201})).rejects.toBeInstanceOf(ZodError);
  const card=sales.items.find(c=>c.candidateId===a.id)!;
  expect(card).toMatchObject({state:'new',classification:null,ticketRef:null,version:1,contentMode:'pointer_only',excerpt:null,forwarded:false,ref:'IN-'+a.id.slice(0,8).toUpperCase()});
  expect(card.status).toMatchObject({projectedAt:null,deliveredAt:null,acknowledgedAt:null,outboxState:'pending'});
  expect(card.status.receivedAt).toBe(new Date(a.e.observedAt).toISOString());
  expect((await inbox().list(pm,{projectId:ids.sales,state:'confirmed'})).total).toBe(0);
});

test('(3) viewer, bot, another project\'s member and another tenant cannot list, read or act',async()=>{
  const {outboxId}=await settle({outcome:'failed_permanent',errorCode:'BOT_FORBIDDEN',telegramMessageId:undefined});
  const t=await ingest({context:{chatId:chatTransport}});
  const tOut=(await rows<{id:string}>("SELECT id FROM outbox_messages WHERE project_id=$1 AND state='pending'",[ids.transport]))[0].id;
  const msgs=new Set<string>();
  for(const p of [viewer,bot,member,outsider]){
    const target=ids.transport;
    msgs.add(await deniedMessage(inbox().list(p,{projectId:target})));
    msgs.add(await deniedMessage(inbox().detail(p,t.id)));
    msgs.add(await deniedMessage(inbox().command(p,t.id,confirm(),k(),randomUUID())));
    msgs.add(await deniedMessage(inbox().failures(p,target)));
    msgs.add(await deniedMessage(inbox().failureCommand(p,tOut,{kind:'take',expectedVersion:1,reason:'x'},k(),randomUUID())));
    msgs.add(await deniedMessage(inbox().sources(p,target)));
  }
  // a project that exists but is out of scope and an id that does not exist answer with the same sentence
  msgs.add(await deniedMessage(inbox().detail(pm,randomUUID())));
  msgs.add(await deniedMessage(inbox().list(member,{projectId:ids.transport})));
  expect([...msgs]).toHaveLength(1);
  expect(await outboxRow(outboxId)).toMatchObject({state:'dead'});
  expect((await rows<{state:string}>('SELECT state FROM intake_candidates WHERE id=$1',[t.id]))[0].state).toBe('new');
});

test('an engineer may read the inbox but only a manager may act',async()=>{
  const a=await ingest();
  expect((await inbox().list(member,{projectId:ids.sales})).total).toBe(1);
  await expect(inbox().detail(member,a.id)).resolves.toBeTruthy();
  await expect(inbox().command(member,a.id,confirm(),k(),randomUUID())).rejects.toMatchObject({code:'MANAGER_REQUIRED',status:403});
  expect((await rows<{version:number}>('SELECT version FROM intake_candidates WHERE id=$1',[a.id]))[0].version).toBe(1);
});

test('(5) no intake or bot path creates, assigns, closes or accepts work',async()=>{
  const before=await n('work_items');
  const a=await ingest();
  await inbox().command(pm,a.id,confirm(),k(),randomUUID());
  expect(await n('work_items')).toBe(before);
  await expect(new WorkService(h.db).create(bot,{projectId:ids.transport,serviceId:ids.transportService,code:'BOT-0001',title:'Việc do bot tạo',priority:'normal',dueAt:null,assigneeId:null,technicalId:null,businessId:null,criteria:'',specUrl:null,sourceSha:null},k())).rejects.toMatchObject({code:'READ_ONLY',status:403});
  await expect(new WorkService(h.db).command(bot,ids.transportWork,{kind:'close_ticket',expectedVersion:1,ticketRef:'X-1',note:'x'},k())).rejects.toMatchObject({code:'READ_ONLY',status:403});
  const t=await ingest({context:{chatId:chatTransport}});
  await expect(inbox().command(bot,t.id,confirm(),k(),randomUUID())).rejects.toMatchObject({code:'SCOPE_DENIED'});
  await expect(inbox().command(pm,a.id,{kind:'create_work',expectedVersion:2},k(),randomUUID())).rejects.toBeInstanceOf(ZodError);
  for(const s of ['new','needs_info','confirmed','duplicate','dismissed'] as CandidateState[])
    for(const name of ['create_work','assign','accept','close']) expect(()=>candidateTransition(s,name as CandidateAction),`${s}+${name}`).toThrow();
  expect(await n('work_items')).toBe(before);
});

test('candidateTransition follows the listed moves only',()=>{
  const ok:[CandidateState,CandidateAction,CandidateState][]=[
    ['new','need_info','needs_info'],['new','confirm','confirmed'],['new','mark_duplicate','duplicate'],['new','dismiss','dismissed'],
    ['needs_info','confirm','confirmed'],['needs_info','need_info','needs_info'],['needs_info','mark_duplicate','duplicate'],['needs_info','dismiss','dismissed'],['needs_info','reopen','new'],
    ['confirmed','reopen','new'],['duplicate','reopen','new'],['dismissed','reopen','new'],['confirmed','link_ticket','confirmed'],['new','link_ticket','new']];
  for(const [s,a,x] of ok) expect(candidateTransition(s,a),`${s}+${a}`).toBe(x);
  for(const [s,a] of [['new','reopen'],['confirmed','confirm'],['dismissed','dismiss'],['duplicate','need_info'],['confirmed','dismiss']] as [CandidateState,CandidateAction][])
    expect(()=>candidateTransition(s,a),`${s}+${a}`).toThrowError(expect.objectContaining({code:'CANDIDATE_TRANSITION_INVALID',status:409}));
});

test('confirm stores the human classification with an audit event; a stale version changes nothing',async()=>{
  const a=await ingest();
  const key=k();
  const card=await inbox().command(pm,a.id,confirm(),key,randomUUID());
  expect(card).toMatchObject({state:'confirmed',classification:'incident',version:2});
  const ev=await rows<{kind:string;actor_kind:string;actor_id:string}>("SELECT kind,actor_kind,actor_id FROM intake_events WHERE entity_id=$1 AND kind='candidate.confirmed'",[a.id]);
  expect(ev).toEqual([{kind:'candidate.confirmed',actor_kind:'user',actor_id:pm.id}]);
  await expect(inbox().command(pm,a.id,confirm(1),k(),randomUUID())).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});
  expect(await rows("SELECT 1 FROM intake_events WHERE entity_id=$1 AND kind='candidate.confirmed'",[a.id])).toHaveLength(1);
  expect((await rows<{version:number;state:string}>('SELECT version,state FROM intake_candidates WHERE id=$1',[a.id]))[0]).toEqual({version:2,state:'confirmed'});
  expect(await inbox().command(pm,a.id,confirm(),key,randomUUID())).toEqual(card);
  await expect(inbox().command(pm,a.id,{...confirm(),classification:'request'},key,randomUUID())).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT',status:409});
  expect(await rows("SELECT 1 FROM intake_events WHERE entity_id=$1 AND kind='candidate.confirmed'",[a.id])).toHaveLength(1);
  // an identity or tenant in the body is refused
  const b=await ingest();
  await expect(inbox().command(pm,b.id,{...confirm(),actorId:pm.id},k(),randomUUID())).rejects.toBeInstanceOf(ZodError);
  await expect(inbox().command(pm,b.id,{...confirm(),tenantId:ids.tenant},k(),randomUUID())).rejects.toBeInstanceOf(ZodError);
  // an invalid move from the current state is refused and changes nothing
  await expect(inbox().command(pm,a.id,{kind:'dismiss',expectedVersion:2,reason:'x'},k(),randomUUID())).rejects.toMatchObject({code:'CANDIDATE_TRANSITION_INVALID',status:409});
  expect((await rows<{version:number}>('SELECT version FROM intake_candidates WHERE id=$1',[a.id]))[0].version).toBe(2);
});

test('need_info keeps the missing fields and mark_duplicate needs a visible target in the same project and merges nothing by itself',async()=>{
  const a=await ingest(),b=await ingest(),t=await ingest({context:{chatId:chatTransport}});
  const info=await inbox().command(pm,a.id,{kind:'need_info',expectedVersion:1,missingFields:['địa điểm','mức độ']},k(),randomUUID());
  expect(info).toMatchObject({state:'needs_info',missingFields:['địa điểm','mức độ'],version:2});
  await expect(inbox().command(pm,b.id,{kind:'need_info',expectedVersion:1,missingFields:[]},k(),randomUUID())).rejects.toBeInstanceOf(ZodError);
  const dup=(target:string,v=1,id=b.id)=>inbox().command(pm,id,{kind:'mark_duplicate',expectedVersion:v,duplicateOf:target,reason:'trùng'},k(),randomUUID());
  await expect(dup(t.id)).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
  await expect(dup(b.id)).rejects.toMatchObject({status:422});
  await expect(dup(randomUUID())).rejects.toMatchObject({code:'SCOPE_DENIED'});
  const done=await dup(a.id);
  expect(done).toMatchObject({state:'duplicate',version:2});
  expect(await n('intake_candidates')).toBe(3);
  expect((await rows<{state:string}>('SELECT state FROM intake_candidates WHERE id=$1',[a.id]))[0].state).toBe('needs_info');
  // a target that is itself a duplicate is refused
  const c=await ingest();
  await expect(inbox().command(pm,c.id,{kind:'mark_duplicate',expectedVersion:1,duplicateOf:b.id,reason:'trùng'},k(),randomUUID())).rejects.toMatchObject({status:422});
  expect(await kinds(b.id)).toContain('candidate.marked_duplicate');
});

test('I-2 the incident note of a confirm reaches the audit event that «Xem chi tiết» reads; no note, no key',async()=>{
  const a=await ingest(),b=await ingest();
  const note='Mất kết nối 15 phút; đã khởi động lại cổng';
  await inbox().command(pm,a.id,{kind:'confirm',expectedVersion:1,classification:'incident',note},k(),randomUUID());
  const ev=(await inbox().detail(pm,a.id)).events.find(e=>e.kind==='candidate.confirmed');
  expect(ev?.payload).toMatchObject({classification:'incident',note,stateBefore:'new',stateAfter:'confirmed'});
  await inbox().command(pm,b.id,{kind:'confirm',expectedVersion:1,classification:'document'},k(),randomUUID());
  const plain=(await inbox().detail(pm,b.id)).events.find(e=>e.kind==='candidate.confirmed');
  expect(plain?.payload).toMatchObject({classification:'document'});
  expect(plain?.payload).not.toHaveProperty('note');
  // the note is the manager's own text: it is kept for a pointer-only project too, still capped at 1000 characters
  await expect(inbox().command(pm,b.id,{kind:'confirm',expectedVersion:2,classification:'incident',note:'x'.repeat(1001)},k(),randomUUID())).rejects.toBeInstanceOf(ZodError);
});

test('I-2 a needs_info card can be asked again: the new list replaces the old one, with its own audit event',async()=>{
  const a=await ingest();
  await inbox().command(pm,a.id,{kind:'need_info',expectedVersion:1,missingFields:['địa điểm']},k(),randomUUID());
  const again=await inbox().command(pm,a.id,{kind:'need_info',expectedVersion:2,missingFields:['địa điểm','ảnh chụp lỗi']},k(),randomUUID());
  expect(again).toMatchObject({state:'needs_info',classification:null,missingFields:['địa điểm','ảnh chụp lỗi'],version:3});
  expect((await kinds(a.id)).filter(x=>x==='candidate.needs_info')).toHaveLength(2);
  const done=await inbox().command(pm,a.id,{kind:'confirm',expectedVersion:3,classification:'request'},k(),randomUUID());
  expect(done).toMatchObject({state:'confirmed',classification:'request',missingFields:[],version:4});
});

test('PM-07 reopening keeps history and earlier delivery receipts',async()=>{
  const {candidateId,outboxId}=await settle({});
  const before={receipts:await n('delivery_receipts'),outbox:await n('outbox_messages')};
  expect(before).toEqual({receipts:1,outbox:1});
  const deliveredAt=(await rows<{delivered_at:unknown}>('SELECT delivered_at FROM outbox_messages WHERE id=$1',[outboxId]))[0].delivered_at;
  expect(deliveredAt).not.toBeNull();
  await inbox().command(pm,candidateId,{kind:'dismiss',expectedVersion:1,reason:'không liên quan'},k(),randomUUID());
  const card=await inbox().command(pm,candidateId,{kind:'reopen',expectedVersion:2,reason:'xem lại'},k(),randomUUID());
  expect(card).toMatchObject({state:'new',version:3});
  expect((await kinds(candidateId)).filter(x=>x.startsWith('candidate.'))).toEqual(['candidate.created','candidate.dismissed','candidate.reopened']);
  expect({receipts:await n('delivery_receipts'),outbox:await n('outbox_messages')}).toEqual(before);
  expect((await rows<{delivered_at:unknown}>('SELECT delivered_at FROM outbox_messages WHERE id=$1',[outboxId]))[0].delivered_at).toEqual(deliveredAt);
  expect(card.status.deliveredAt).not.toBeNull();
  expect(card.status.outboxState).toBe('delivered');
  const d=await inbox().detail(pm,candidateId);
  expect(d.deliveries).toHaveLength(1);
  expect(d.events.map(e=>e.kind)).toEqual(expect.arrayContaining(['candidate.dismissed','candidate.reopened']));
  expect(d.revisions).toHaveLength(1);
});

test('link_ticket stores an external reference only',async()=>{
  const a=await ingest();
  const card=await inbox().command(pm,a.id,{kind:'link_ticket',expectedVersion:1,ticketRef:'TK-XECA-202611-001'},k(),randomUUID());
  expect(card).toMatchObject({ticketRef:'TK-XECA-202611-001',state:'new',version:2});
  expect(await kinds(a.id)).toContain('candidate.ticket_linked');
  for(const bad of ['tk-xeca-202611-001','TK-XECA-202611','TK-XECA-202611-1','https://x.test/TK-XECA-202611-001'])
    await expect(inbox().command(pm,a.id,{kind:'link_ticket',expectedVersion:2,ticketRef:bad},k(),randomUUID()),bad).rejects.toBeInstanceOf(ZodError);
  expect(await ticketStateColumns(async q=>(await h.operator.query<{column_name:string}>(q)).rows)).toEqual([]);
});

test('a group with no received message shows Chưa xác minh khả năng nhận tin',async()=>{
  const reg=new ProjectRegistryService(h.db);
  await reg.saveProfile(pm,ids.sales,{expectedVersion:0,objective:'Mục tiêu mẫu',ownerBu:'BU mẫu',pmLabel:'PM mẫu',vaultPointer:null,repoUrl:null,status:'proposed'},k());
  await reg.proposeChannel(pm,ids.sales,{expectedVersion:1,chatId:chatSales,topicId:'',mode:'command_reply',policyVersion:'v1'},k());
  const empty=await inbox().sources(pm,ids.sales);
  expect(empty).toEqual([{chatId:chatSales,topicId:'',state:'not-configured',coverageStart:null,coverageGaps:[],label:'Chưa xác minh khả năng nhận tin'}]);
  const first=await ingest();
  const one=(await inbox().sources(pm,ids.sales))[0];
  expect(one).toMatchObject({state:'partially-received',coverageStart:new Date(first.e.observedAt).toISOString(),coverageGaps:[]});
  expect(one.label).toContain('không có lịch sử trước mốc này');
  // UI-4: the time is coverageStart, formatted by the screen; the label carries no raw ISO timestamp
  expect(one.label).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
  await ingest({spooled:true});
  const two=(await inbox().sources(pm,ids.sales))[0];
  expect(two.coverageGaps).toHaveLength(1);
  expect(two.coverageStart).toBe(one.coverageStart);
  for(const r of [empty[0],one,two]) expect(r.label).not.toMatch(/đầy đủ/i);
  // the channel list never grants or decides anything: another project's reader sees nothing of it
  await deniedMessage(inbox().sources(viewer,ids.sales));
});

test('failures lists dead, uncertain and overdue messages; requeue and abandon need a manager and a fresh version',async()=>{
  const dead=await settle({outcome:'failed_permanent',errorCode:'BOT_FORBIDDEN',telegramMessageId:undefined});
  const unsure=await settle({outcome:'uncertain',errorCode:'TIMEOUT',telegramMessageId:undefined});
  await settle({});
  const late=await ingest();
  const fresh=await ingest();
  await ingest({context:{chatId:chatTransport}});
  const lateOutbox=(await rows<{id:string}>('SELECT id FROM outbox_messages WHERE candidate_id=$1',[late.id]))[0].id;
  await h.operator.query("UPDATE outbox_messages SET created_at=now()-interval '11 minutes' WHERE id=$1",[lateOutbox]);
  const list=await inbox().failures(pm,ids.sales);
  expect(list.map(r=>[r.outboxId,r.state,r.overdue]).sort()).toEqual([[dead.outboxId,'dead',false],[unsure.outboxId,'uncertain',false],[lateOutbox,'pending',true]].sort());
  expect(list.find(r=>r.outboxId===dead.outboxId)).toMatchObject({template:'intake.received',lastErrorCode:'BOT_FORBIDDEN',ownerId:null});
  expect(list.some(r=>r.outboxId!==lateOutbox&&r.state==='pending')).toBe(false);
  void fresh;

  await expect(inbox().failureCommand(member,dead.outboxId,{kind:'take',expectedVersion:2,reason:'x'},k(),randomUUID())).rejects.toMatchObject({code:'MANAGER_REQUIRED',status:403});
  const v0=(await outboxRow(dead.outboxId)).version;
  await inbox().failureCommand(pm,dead.outboxId,{kind:'take',expectedVersion:v0,reason:'tôi xử lý'},k(),randomUUID());
  expect(await outboxRow(dead.outboxId)).toMatchObject({state:'dead',version:v0+1,failure_owner_id:pm.id});
  expect((await inbox().failures(pm,ids.sales)).find(r=>r.outboxId===dead.outboxId)).toMatchObject({ownerId:pm.id,version:v0+1});
  expect(await rows("SELECT 1 FROM intake_events WHERE entity_id=$1 AND kind='outbox.taken'",[dead.outboxId])).toHaveLength(1);
  // a stale version changes nothing
  await expect(inbox().failureCommand(pm,dead.outboxId,{kind:'requeue',expectedVersion:v0,reason:'gửi lại'},k(),randomUUID())).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});
  expect(await outboxRow(dead.outboxId)).toMatchObject({state:'dead',version:v0+1});
  const states=await n('outbox_state_events');
  // requeue: dead -> pending with attempt_no 0; the database writes the state event, with the person as actor
  await inbox().failureCommand(pm,dead.outboxId,{kind:'requeue',expectedVersion:v0+1,reason:'gửi lại'},k(),randomUUID());
  expect(await outboxRow(dead.outboxId)).toMatchObject({state:'pending',attempt_no:0,version:v0+2});
  expect(await n('outbox_state_events')).toBe(states+1);
  const se=(await rows<{signal:string;actor_kind:string;actor_id:string}>("SELECT signal,actor_kind,actor_id FROM outbox_state_events WHERE outbox_id=$1 ORDER BY created_at DESC,outbox_version DESC LIMIT 1",[dead.outboxId]))[0];
  expect(se).toEqual({signal:'requeue',actor_kind:'user',actor_id:pm.id});
  expect(await rows("SELECT 1 FROM intake_events WHERE entity_id=$1 AND kind='outbox.requeued'",[dead.outboxId])).toHaveLength(1);
  // an uncertain row can be abandoned but not requeued
  const u=await outboxRow(unsure.outboxId);
  await expect(inbox().failureCommand(pm,unsure.outboxId,{kind:'requeue',expectedVersion:u.version,reason:'x'},k(),randomUUID())).rejects.toMatchObject({code:'OUTBOX_TRANSITION_INVALID',status:409});
  await inbox().failureCommand(pm,unsure.outboxId,{kind:'abandon',expectedVersion:u.version,reason:'không cần gửi nữa'},k(),randomUUID());
  expect((await outboxRow(unsure.outboxId)).state).toBe('abandoned');
  expect(await rows("SELECT 1 FROM intake_events WHERE entity_id=$1 AND kind='outbox.abandoned'",[unsure.outboxId])).toHaveLength(1);
  expect((await inbox().failures(pm,ids.sales)).some(r=>r.outboxId===unsure.outboxId)).toBe(false);
  await expect(inbox().failureCommand(pm,unsure.outboxId,{kind:'take',expectedVersion:u.version+1,reason:'x',actorId:pm.id},k(),randomUUID())).rejects.toBeInstanceOf(ZodError);
});

test('M-3 a leased row whose lease ran out is listed as stuck, and every row names its card',async()=>{
  const a=await ingest(),b=await ingest();
  const d=(await outbox().pull({limit:5})).deliveries;
  expect(d).toHaveLength(2);
  const [stuck,live]=d;
  await h.operator.query("UPDATE outbox_messages SET lease_expires_at=now()-interval '1 minute' WHERE id=$1",[stuck.outboxId]);
  const list=await inbox().failures(pm,ids.sales);
  expect(list.map(r=>r.outboxId)).toEqual([stuck.outboxId]);
  expect(list[0]).toMatchObject({state:'leased',overdue:true,template:'intake.received'});
  const owner=(await rows<{candidate_id:string}>('SELECT candidate_id FROM outbox_messages WHERE id=$1',[stuck.outboxId]))[0].candidate_id;
  expect([a.id,b.id]).toContain(owner);
  expect(list[0].candidateRef).toMatch(/^IN-[0-9A-F]+/);
  expect((await inbox().list(pm,{projectId:ids.sales})).items.find(c=>c.candidateId===owner)?.ref).toBe(list[0].candidateRef);
  void live;
});

test('the newest revision is chosen by edited_at',async()=>{
  await mapDomain(ids.sales,'XECA');
  const first=messageEvent({addressed:false,text:'bản đầu'});
  await intake().ingest(first);
  const at=(ms:number)=>new Date(new Date(first.observedAt).getTime()+ms).toISOString();
  const again=(text:string,editedAt:string)=>intake().ingest(messageEvent({addressed:false,text,editedAt,context:{messageId:first.context.messageId}}));
  await again('bản hai (sửa muộn nhất)',at(60000));
  await again('bản cũ hơn (số thứ tự lớn hơn)',at(30000));
  const revs=await rows<{revision_no:number}>('SELECT revision_no FROM source_event_revisions ORDER BY revision_no');
  expect(revs.map(r=>r.revision_no)).toEqual([1,2,3]);
  const items=(await inbox().list(pm,{projectId:ids.sales})).items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({contentMode:'excerpt',excerpt:'bản hai (sửa muộn nhất)'});
  const d=await inbox().detail(pm,items[0].candidateId);
  expect(d.revisions).toHaveLength(3);
  expect(d.revisions[0]).toMatchObject({revisionNo:2,excerpt:items[0].excerpt});
  expect(d.revisions.map(r=>r.revisionNo)).toEqual([2,3,1]);
});

test('duplicate suggestions are hints: same newest content, same project, nothing merged',async()=>{
  const a=await ingest({text:'cùng một nội dung'}),b=await ingest({text:'cùng một nội dung'}),c=await ingest({text:'nội dung khác'});
  await ingest({context:{chatId:chatTransport},text:'cùng một nội dung'});
  const items=(await inbox().list(pm,{projectId:ids.sales})).items;
  const card=(id:string)=>items.find(x=>x.candidateId===id)!;
  expect(card(a.id).duplicateCandidates).toEqual([{candidateId:b.id,ref:'IN-'+b.id.slice(0,8).toUpperCase(),reason:'cùng nội dung'}]);
  expect(card(b.id).duplicateCandidates.map(x=>x.candidateId)).toEqual([a.id]);
  expect(card(c.id).duplicateCandidates).toEqual([]);
  expect(items.every(x=>x.state==='new')).toBe(true);
});

test('M1 detail gives no content hash for a pointer_only project and keeps it for an excerpt project',async()=>{
  const a=await ingest({text:'nội dung kiểm tra con trỏ'});
  const d=await inbox().detail(pm,a.id);
  expect(d.card.contentMode).toBe('pointer_only');
  expect(d.revisions.length).toBeGreaterThan(0);
  for(const r of d.revisions){expect(r.contentHash).toBeNull();expect(r.excerpt).toBeNull();}
  await mapDomain(ids.transport,'XECA');
  const t=await ingest({context:{chatId:chatTransport},text:'nội dung có trích đoạn'});
  const dt=await inbox().detail(pm,t.id);
  expect(dt.card.contentMode).toBe('excerpt');
  for(const r of dt.revisions) expect(r.contentHash).toMatch(/^[a-f0-9]{64}$/);
});

test('M2 the stored command response keeps ids only; a replay returns the current card',async()=>{
  const dead=await settle({outcome:'failed_permanent',errorCode:'BOT_FORBIDDEN',telegramMessageId:undefined});
  await mapDomain(ids.sales,'XECA');
  const hex='b'.repeat(64);
  const a=await ingest({text:'đoạn trích bí mật cần giữ',attachment:{state:'stored',locator:'gw://libetech/attachments/'+hex,sha256:hex,mimeType:'application/pdf',sizeBytes:1000,fileName:'bao-cao-mat.pdf'}});
  const key=k();
  const first=await inbox().command(pm,a.id,confirm(),key,randomUUID());
  expect(first.excerpt).toBe('đoạn trích bí mật cần giữ');
  const stored=JSON.stringify((await rows<{response:unknown}>('SELECT response FROM commands WHERE command_key=$1',[key]))[0].response);
  expect(stored).not.toContain('đoạn trích');
  expect(stored).not.toContain('bao-cao-mat');
  expect(stored).not.toContain(first.sourceRef);
  expect(JSON.parse(stored)).toEqual({candidateId:a.id,state:'confirmed',version:2});
  await inbox().command(pm,a.id,{kind:'link_ticket',expectedVersion:2,ticketRef:'TK-XECA-202611-002'},k(),randomUUID());
  const replay=await inbox().command(pm,a.id,confirm(),key,randomUUID());
  expect(replay).toMatchObject({ticketRef:'TK-XECA-202611-002',version:3,state:'confirmed'});
  // failureCommand stores no more than ids, state and version
  const fkey=k();
  await inbox().failureCommand(pm,dead.outboxId,{kind:'take',expectedVersion:(await outboxRow(dead.outboxId)).version,reason:'xử lý'},fkey,randomUUID());
  const fstored=(await rows<{response:Record<string,unknown>}>('SELECT response FROM commands WHERE command_key=$1',[fkey]))[0].response;
  expect(Object.keys(fstored).sort()).toEqual(['outboxId','state','version']);
});

test('M5 the caller\'s request id is the audit and state-event request id',async()=>{
  const dead=await settle({outcome:'failed_permanent',errorCode:'BOT_FORBIDDEN',telegramMessageId:undefined});
  const a=await ingest();
  const rid=randomUUID();
  await inbox().command(pm,a.id,confirm(),k(),rid);
  expect((await rows<{request_id:string}>("SELECT request_id FROM intake_events WHERE entity_id=$1 AND kind='candidate.confirmed'",[a.id]))[0].request_id).toBe(rid);
  const rid2=randomUUID();
  await inbox().failureCommand(pm,dead.outboxId,{kind:'requeue',expectedVersion:(await outboxRow(dead.outboxId)).version,reason:'gửi lại'},k(),rid2);
  expect((await rows<{request_id:string}>("SELECT request_id FROM intake_events WHERE entity_id=$1 AND kind='outbox.requeued'",[dead.outboxId]))[0].request_id).toBe(rid2);
  expect((await rows<{request_id:string}>("SELECT request_id FROM outbox_state_events WHERE outbox_id=$1 AND signal='requeue'",[dead.outboxId]))[0].request_id).toBe(rid2);
  await expect(inbox().command(pm,a.id,{kind:'reopen',expectedVersion:2,reason:'x'},k(),'not-a-uuid')).rejects.toThrow();
});

describe.skipIf(!native)('M4 opposite duplicate marks never form a cycle',()=>{
  test('two parallel marks A->B and B->A: exactly one wins',async()=>{
    const a=await ingest(),b=await ingest();
    const mark=(from:string,to:string)=>inbox().command(pm,from,{kind:'mark_duplicate',expectedVersion:1,duplicateOf:to,reason:'trùng'},k(),randomUUID());
    const res=await Promise.allSettled([mark(a.id,b.id),mark(b.id,a.id)]);
    expect(res.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const lost=res.find(r=>r.status==='rejected') as PromiseRejectedResult;
    expect([409,422]).toContain((lost.reason as {status:number}).status);
    const st=await rows<{state:string}>('SELECT state FROM intake_candidates WHERE id=ANY($1) ORDER BY state',[[a.id,b.id]]);
    expect(st.map(r=>r.state).sort()).toEqual(['duplicate','new']);
  });
});
