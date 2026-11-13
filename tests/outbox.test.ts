import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,intakePrincipalId,messageEvent,signedRequest,type EventOverride} from './slice2-fixtures';
import {IntakeService} from '../src/server/intake';
import {IdentityService} from '../src/server/identity';
import {handleBridgeIo} from '../src/server/bridge-io';
import {MAX_ATTEMPTS,OutboxService,backoffSeconds,enqueueDm,enqueueReceipt,outboxTransition,type OutboxSignal,type OutboxState} from '../src/server/outbox';
import {ids} from '../src/server/identities';

let h:Harness,identity:IdentityService;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);identity=new IdentityService(h.operator,ids.tenant);});
afterEach(async()=>{await h.reset();await h.close();});

const chats=bridgeConfig.intake!.chats;
const intake=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,chats,enqueueReceipt);
const outbox=(projectIds=[ids.sales,ids.transport])=>new OutboxService(h.operator,identity,{id:intakePrincipalId,tenantId:ids.tenant,projectIds});
const ev=(o:EventOverride={})=>messageEvent(o);
type R=Record<string,unknown>;
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const one=async(id:string)=>(await rows<{state:string;attempt_no:number;delivered_at:unknown;acknowledged_at:unknown;last_error_code:string|null;next_attempt_at:string;lease_token:string|null}>('SELECT * FROM outbox_messages WHERE id=$1',[id]))[0];
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const rcpt=(d:{outboxId:string;attemptNo:number;leaseToken:string},o:R={})=>({outboxId:d.outboxId,attemptNo:d.attemptNo,leaseToken:d.leaseToken,phase:'send',outcome:'delivered',telegramMessageId:'77',reportedAt:new Date().toISOString(),...o});
const pullOne=async()=>{const r=await outbox().pull({limit:5});expect(r.deliveries).toHaveLength(1);return r.deliveries[0];};
const due=(id:string)=>h.operator.query("UPDATE outbox_messages SET next_attempt_at=now()-interval '1 hour' WHERE id=$1",[id]);

test('outboxTransition accepts the listed moves and rejects the rest',()=>{
  const ok:[OutboxState,OutboxSignal,number,OutboxState][]=[
    ['pending','lease',0,'leased'],['leased','delivered',1,'delivered'],['leased','failed_retryable',1,'pending'],['leased','failed_retryable',MAX_ATTEMPTS,'dead'],
    ['leased','failed_permanent',1,'dead'],['leased','uncertain',1,'uncertain'],['leased','lease_expired',1,'uncertain'],['uncertain','reconciled_delivered',1,'delivered'],
    ['uncertain','reconciled_not_sent',1,'pending'],['dead','requeue',6,'pending'],['dead','abandon',6,'abandoned'],['uncertain','abandon',1,'abandoned']];
  for(const [s,g,a,x] of ok) expect(outboxTransition(s,g,a),`${s}+${g}`).toBe(x);
  const bad:[OutboxState,OutboxSignal][]=[['delivered','lease'],['pending','delivered'],['uncertain','lease'],['abandoned','requeue'],['delivered','requeue'],['pending','abandon'],['leased','requeue']];
  for(const [s,g] of bad) expect(()=>outboxTransition(s,g,1),`${s}+${g}`).toThrowError(expect.objectContaining({code:'OUTBOX_TRANSITION_INVALID',status:409}));
  expect([1,2,3,4,5,6,7,8].map(backoffSeconds)).toEqual([30,60,120,240,480,900,900,900]);
});

test('an addressed new message queues exactly one receipt in the same transaction',async()=>{
  const e=ev({});
  const ack=await intake().ingest(e);
  const o=await rows<R>('SELECT * FROM outbox_messages');
  expect(o).toHaveLength(1);
  expect(o[0]).toMatchObject({state:'pending',template:'intake.received',target_chat_id:chatSales,reply_to_message_id:e.context.messageId,causation_id:null,audience:'group',project_id:ids.sales,source_event_id:ack.sourceEventId});
  const src=(await rows<{correlation_id:string;trace_id:string}>('SELECT correlation_id,trace_id FROM source_events WHERE id=$1',[ack.sourceEventId]))[0];
  expect(o[0].correlation_id).toBe(src.correlation_id);
  const d=await pullOne();
  expect(Object.keys(d.envelope).sort()).toEqual(['causation_id','correlation_id','event_id','event_type','payload','source','tenant_id','timestamp','trace_id','version']);
  expect(d.envelope).toMatchObject({version:'v1',source:'libetech-ai-os',tenant_id:ids.tenant,correlation_id:src.correlation_id,causation_id:null,payload:{template:'intake.received'}});
  expect(Object.keys(d.envelope.payload.params).sort()).toEqual(['observedAt','ref']);
  expect(JSON.stringify(d.envelope)).not.toContain(e.text);
});

test('PM-07 a persisted message is not shown as sent',async()=>{
  const ack=await intake().ingest(ev({}));
  expect(ack.receipt).toBe('queued');
  expect(JSON.stringify(ack)).not.toMatch(/delivered|sent/i);
  const id=(await rows<{id:string}>('SELECT id FROM outbox_messages'))[0].id;
  expect((await one(id)).delivered_at).toBeNull();
  const d=await pullOne();
  expect((await one(id)).delivered_at).toBeNull();
  await outbox().report({receipts:[rcpt(d)]});
  const after=await one(id);
  expect(after.delivered_at).not.toBeNull();expect(after.acknowledged_at).toBeNull();expect(after.state).toBe('delivered');
});

test('PM-03 a replayed message and a replayed pull never duplicate a receipt',async()=>{
  const e=ev({});
  for(let i=0;i<3;i++) await intake().ingest(e);
  expect(await n('outbox_messages')).toBe(1);
  const d=await pullOne();
  expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
  const r=rcpt(d);
  expect(await outbox().report({receipts:[r]})).toEqual({accepted:1,replayed:0,rejected:[]});
  expect(await outbox().report({receipts:[r]})).toEqual({accepted:0,replayed:1,rejected:[]});
  expect(await n('delivery_receipts')).toBe(1);
  const q=(await rows<{quality_score:number;source_type:string}>('SELECT quality_score,source_type FROM delivery_receipts'))[0];
  expect(q).toEqual({quality_score:100,source_type:'telegram_gateway'});
});

test('DOC-12 a spooled message stored after recovery gets one recovery receipt and no duplicate',async()=>{
  const e=ev({spooled:true});
  await intake().ingest(e);await intake().ingest(e);
  expect(await n('source_events')).toBe(1);
  const o=await rows<{template:string}>('SELECT template FROM outbox_messages');
  expect(o).toEqual([{template:'intake.recovered'}]);
});

test('DOC-04 a failed attachment queues attachment_failed, never intake.received',async()=>{
  const ack=await intake().ingest(ev({attachment:{state:'failed',reasonCode:'download_failed'}}));
  expect(ack).toMatchObject({receipt:'withheld',reason:'ATTACHMENT_NOT_STORED'});
  expect(await rows<{template:string}>('SELECT template FROM outbox_messages')).toEqual([{template:'intake.attachment_failed'}]);
  expect(await n('outbox_messages')).toBe(1);
});

test('a timeout after send becomes uncertain and is reconciled before any resend',async()=>{
  await intake().ingest(ev({}));
  const d=await pullOne();
  await outbox().report({receipts:[rcpt(d,{outcome:'uncertain',telegramMessageId:undefined,errorCode:'TIMEOUT'})]});
  const p=await outbox().pull({limit:5});
  expect(p.deliveries).toEqual([]);
  expect(p.reconcile).toEqual([{outboxId:d.outboxId,attemptNo:1}]);
  await outbox().report({receipts:[rcpt(d,{phase:'reconcile',outcome:'delivered'})]});
  const row=await one(d.outboxId);
  expect(row.state).toBe('delivered');expect(row.delivered_at).not.toBeNull();
  expect((await rows<{quality_score:number}>("SELECT quality_score FROM delivery_receipts WHERE phase='reconcile'"))[0].quality_score).toBe(60);
  // other branch
  await intake().ingest(ev({}));
  const d2=await pullOne();
  await outbox().report({receipts:[rcpt(d2,{outcome:'uncertain',telegramMessageId:undefined})]});
  await outbox().report({receipts:[rcpt(d2,{phase:'reconcile',outcome:'not_sent',telegramMessageId:undefined})]});
  expect((await one(d2.outboxId)).state).toBe('pending');
  expect((await outbox().pull({limit:5})).deliveries).toEqual([]); // backoff applies
  await due(d2.outboxId);
  const again=await pullOne();
  expect(again).toMatchObject({outboxId:d2.outboxId,attemptNo:2});
  expect(again.leaseToken).not.toBe(d2.leaseToken);
});

test('a permission failure is dead at once and is never leased again',async()=>{
  await intake().ingest(ev({}));
  const d=await pullOne();
  await outbox().report({receipts:[rcpt(d,{outcome:'failed_permanent',errorCode:'BOT_FORBIDDEN',telegramMessageId:undefined})]});
  expect(await one(d.outboxId)).toMatchObject({state:'dead',last_error_code:'BOT_FORBIDDEN'});
  for(let i=0;i<3;i++) expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
});

test('network failures back off and stop at six attempts',async()=>{
  await intake().ingest(ev({}));
  let id='';
  for(let a=1;a<=MAX_ATTEMPTS;a++){
    const d=await pullOne();id=d.outboxId;
    expect(d.attemptNo).toBe(a);
    await outbox().report({receipts:[rcpt(d,{outcome:'failed_retryable',errorCode:'NETWORK',telegramMessageId:undefined})]});
    const row=await one(id);
    if(a<MAX_ATTEMPTS){
      expect(row.state).toBe('pending');
      const wait=(await rows<{s:number}>('SELECT extract(epoch FROM (next_attempt_at-now()))::float s FROM outbox_messages WHERE id=$1',[id]))[0].s;
      expect(wait).toBeGreaterThan(backoffSeconds(a)-5);expect(wait).toBeLessThanOrEqual(backoffSeconds(a)+1);
      // not due yet: nothing is returned until the clock passes
      expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
      await due(id);
    } else expect(row.state).toBe('dead');
  }
  await due(id);
  expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
});

test('a receipt with an expired or foreign lease, or a second different outcome, is refused',async()=>{
  await intake().ingest(ev({}));
  const d=await pullOne();
  const rej=(o:{outboxId:string;attemptNo:number},code:string)=>({outboxId:o.outboxId,attemptNo:o.attemptNo,code});
  expect(await outbox().report({receipts:[rcpt({...d,leaseToken:randomUUID()})]})).toEqual({accepted:0,replayed:0,rejected:[rej(d,'LEASE_INVALID')]});
  expect(await n('delivery_receipts')).toBe(0);
  expect(await outbox().report({receipts:[rcpt({...d,attemptNo:2})]})).toMatchObject({accepted:0,rejected:[{code:'LEASE_INVALID'}]});
  await h.operator.query("UPDATE outbox_messages SET lease_expires_at=now()-interval '1 minute' WHERE id=$1",[d.outboxId]);
  await outbox().pull({limit:5});
  expect((await one(d.outboxId)).state).toBe('uncertain');
  expect(await outbox().report({receipts:[rcpt(d)]})).toMatchObject({accepted:0,rejected:[{code:'LEASE_INVALID'}]});
  expect((await one(d.outboxId)).state).toBe('uncertain');
  expect(await n('delivery_receipts')).toBe(0);
  // second different outcome on a delivered attempt
  await outbox().report({receipts:[rcpt(d,{phase:'reconcile',outcome:'delivered'})]});
  expect(await outbox().report({receipts:[rcpt(d,{phase:'reconcile',outcome:'not_sent',telegramMessageId:undefined})]})).toMatchObject({accepted:0,rejected:[{code:'RECEIPT_CONFLICT'}]});
  expect((await one(d.outboxId)).state).toBe('delivered');
  await intake().ingest(ev({}));
  const d2=await pullOne();
  await outbox().report({receipts:[rcpt(d2)]});
  expect(await outbox().report({receipts:[rcpt(d2,{outcome:'failed_permanent',telegramMessageId:undefined})]})).toMatchObject({rejected:[{code:'RECEIPT_CONFLICT'}]});
  expect((await one(d2.outboxId)).state).toBe('delivered');
});

test('one bad receipt does not block the valid ones in the same batch, and a resubmit is stable',async()=>{
  for(let i=0;i<3;i++) await intake().ingest(ev({}));
  const [a,b,c]=(await outbox().pull({limit:5})).deliveries;
  await outbox().report({receipts:[rcpt(c)]});            // c is delivered; a later different outcome conflicts
  const batch=[rcpt(a),rcpt({...b,leaseToken:randomUUID()}),rcpt(c,{outcome:'failed_permanent',telegramMessageId:undefined})];
  const rejected=[{outboxId:b.outboxId,attemptNo:1,code:'LEASE_INVALID'},{outboxId:c.outboxId,attemptNo:1,code:'RECEIPT_CONFLICT'}];
  expect(await outbox().report({receipts:batch})).toEqual({accepted:1,replayed:0,rejected});
  expect((await one(a.outboxId)).state).toBe('delivered');
  expect(await rows('SELECT outbox_id FROM delivery_receipts WHERE outbox_id=$1',[a.outboxId])).toHaveLength(1);
  expect(await rows('SELECT outbox_id FROM delivery_receipts WHERE outbox_id=$1',[b.outboxId])).toHaveLength(0);
  expect((await one(b.outboxId)).state).toBe('leased');
  expect((await one(c.outboxId)).state).toBe('delivered');
  expect(await rows('SELECT outbox_id FROM delivery_receipts WHERE outbox_id=$1',[c.outboxId])).toHaveLength(1);
  expect(await n('delivery_receipts')).toBe(2);
  expect(await outbox().report({receipts:batch})).toEqual({accepted:0,replayed:1,rejected});
  expect(await n('delivery_receipts')).toBe(2);
});

test('(3) a pull scoped to Xeca projects never returns LBRC or IBS HI messages',async()=>{
  await intake().ingest(ev({}));
  expect((await outbox([ids.transport]).pull({limit:5})).deliveries).toEqual([]);
  expect((await one((await rows<{id:string}>('SELECT id FROM outbox_messages'))[0].id)).state).toBe('pending');
  await expect(outbox([]).pull({limit:5})).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  expect((await outbox([ids.sales]).pull({limit:5})).deliveries).toHaveLength(1);
});

test('every state change in a project row writes an intake_events row',async()=>{
  await intake().ingest(ev({}));
  const d=await pullOne();
  await outbox().report({receipts:[rcpt(d,{outcome:'failed_permanent',errorCode:'BOT_FORBIDDEN',telegramMessageId:undefined})]});
  const k=(await rows<{kind:string;actor_kind:string;actor_id:string}>("SELECT kind,actor_kind,actor_id FROM intake_events WHERE entity_type='outbox_message' ORDER BY created_at,kind"));
  expect(k.map(x=>x.kind).sort()).toEqual(['outbox.dead','outbox.leased']);
  expect(k.every(x=>x.actor_kind==='intake_service'&&x.actor_id===intakePrincipalId)).toBe(true);
});

test('pull and receipts reject unknown keys and out-of-range limits',async()=>{
  await expect(outbox().pull({limit:5,tenantId:ids.tenant})).rejects.toThrow();
  await expect(outbox().pull({limit:11})).rejects.toThrow();
  await expect(outbox().pull({limit:0})).rejects.toThrow();
  await expect(outbox().report({receipts:[]})).rejects.toThrow();
  await expect(outbox().report({receipts:[{...rcpt({outboxId:randomUUID(),attemptNo:1,leaseToken:randomUUID()}),projectId:ids.sales}]})).rejects.toThrow();
  await expect(outbox().report({receipts:[rcpt({outboxId:randomUUID(),attemptNo:1,leaseToken:randomUUID()},{phase:'send',outcome:'not_sent'})]})).rejects.toThrow();
});

test('a DM to a recipient who unlinked Telegram is dead with RECIPIENT_UNLINKED and is not returned',async()=>{
  const link=async(tg:string)=>h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,pm.id,tg]);
  await link('900000042');
  const mk=(key:string)=>identity.scope(tx=>enqueueDm(tx,{tenantId:ids.tenant,recipientUserId:pm.id,telegramId:'900000042',template:'account_approval.pending',dedupeKey:key,params:{},traceId:randomUUID(),correlationId:randomUUID(),causationId:null}));
  await mk('dm-1');await mk('dm-1');
  expect(await n('outbox_messages')).toBe(1);
  const ok=await outbox().pull({limit:5});
  expect(ok.deliveries).toHaveLength(1);
  expect(ok.deliveries[0]).toMatchObject({audience:'dm',chatId:'900000042',replyToMessageId:null});
  await outbox().report({receipts:[rcpt(ok.deliveries[0])]});
  await mk('dm-2');
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[pm.id]);
  expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
  expect(await rows("SELECT state,last_error_code FROM outbox_messages WHERE dedupe_key='dm-2'")).toEqual([{state:'dead',last_error_code:'RECIPIENT_UNLINKED'}]);
  expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
});

test('routes: outbox/pull and outbox/receipts work through handleBridgeIo with the intake key only',async()=>{
  await intake().ingest(ev({}));
  const deps={intakeDb:h.operator,identity,config:bridgeConfig,tenantId:ids.tenant};
  const call=(p:string,b:unknown)=>handleBridgeIo(signedRequest(p,b),p.replace('/api/bridge/','').split('/'),deps);
  const pulled=await call('/api/bridge/outbox/pull',{limit:5}) as {deliveries:{outboxId:string;attemptNo:number;leaseToken:string}[]};
  expect(pulled.deliveries).toHaveLength(1);
  expect(await call('/api/bridge/outbox/receipts',{receipts:[rcpt(pulled.deliveries[0])]})).toEqual({accepted:1,replayed:0,rejected:[]});
  await expect(handleBridgeIo(signedRequest('/api/bridge/outbox/pull',{limit:5},{key:bridgeConfig.key}),['outbox','pull'],deps)).rejects.toMatchObject({code:'BRIDGE_AUTH_DENIED'});
  // events route now queues through the real enqueueReceipt
  await handleBridgeIo(signedRequest('/api/bridge/intake/events',ev({})),['intake','events'],deps);
  expect(await n('outbox_messages')).toBe(2);
});

// ---- Gate-2 fix B ----
const stateEvents=()=>rows<{from_state:string;to_state:string;signal:string;attempt_no:number;actor_kind:string;actor_id:string;project_id:string|null}>('SELECT from_state,to_state,signal,attempt_no,actor_kind,actor_id,project_id FROM outbox_state_events ORDER BY created_at,id');
const outboxIntakeEvents=()=>n("intake_events WHERE entity_type='outbox_message'");
const linkPm=(tg:string)=>h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,pm.id,tg]);
const mkDm=(key:string,tg:string)=>identity.scope(tx=>enqueueDm(tx,{tenantId:ids.tenant,recipientUserId:pm.id,telegramId:tg,template:'account_approval.pending',dedupeKey:key,params:{},traceId:randomUUID(),correlationId:randomUUID(),causationId:null}));

test('FB-1 a DM lease then unlinked kill writes 2 state events and no intake_events row',async()=>{
  await linkPm('900000042');await mkDm('dm-a','900000042');
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[pm.id]);
  expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
  const ev2=await stateEvents();
  expect(ev2.map(e=>`${e.from_state}>${e.to_state}:${e.signal}`)).toEqual(['pending>leased:lease','leased>dead:failed_permanent']);
  expect(ev2.every(e=>e.project_id===null&&e.actor_kind==='intake_service'&&e.actor_id===intakePrincipalId)).toBe(true);
  expect(await outboxIntakeEvents()).toBe(0);
});

test('FB-1 a group lease then delivered writes 2 state events and the matching intake_events rows',async()=>{
  await intake().ingest(ev({}));
  const d=await pullOne();
  await outbox().report({receipts:[rcpt(d)]});
  const e2=await stateEvents();
  expect(e2.map(e=>`${e.from_state}>${e.to_state}:${e.signal}:${e.attempt_no}`)).toEqual(['pending>leased:lease:1','leased>delivered:delivered:1']);
  expect(e2.every(e=>e.project_id===ids.sales)).toBe(true);
  expect((await rows<{kind:string}>("SELECT kind FROM intake_events WHERE entity_type='outbox_message'")).map(r=>r.kind).sort()).toEqual(['outbox.delivered','outbox.leased']);
});

test('FB-1 a rejected receipt leaves no state event and no intake_events row; relinked DM and bad reconcile receipts',async()=>{
  await intake().ingest(ev({}));
  const d=await pullOne();
  const se=(await stateEvents()).length,ie=await outboxIntakeEvents();
  const r1=await outbox().report({receipts:[rcpt({...d,leaseToken:randomUUID()}),rcpt(d,{phase:'reconcile',outcome:'delivered'}),rcpt({...d,attemptNo:2},{phase:'reconcile',outcome:'delivered'})]});
  expect(r1).toMatchObject({accepted:0,rejected:[{code:'LEASE_INVALID'},{code:'LEASE_INVALID'},{code:'LEASE_INVALID'}]});
  expect((await stateEvents()).length).toBe(se);expect(await outboxIntakeEvents()).toBe(ie);
  expect(await n('delivery_receipts')).toBe(0);expect((await one(d.outboxId)).state).toBe('leased');
  // a DM whose recipient relinked to a different telegram id
  await linkPm('900000042');await mkDm('dm-b','900000042');
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[pm.id]);await linkPm('900000099');
  const p=await outbox().pull({limit:5});
  expect(p.deliveries.filter(x=>x.audience==='dm')).toEqual([]);
  expect(await rows("SELECT state,last_error_code FROM outbox_messages WHERE dedupe_key='dm-b'")).toEqual([{state:'dead',last_error_code:'RECIPIENT_UNLINKED'}]);
});

test('FB-3 not_sent loop stops at the attempt cap and applies backoff',async()=>{
  await intake().ingest(ev({}));
  let id='';
  for(let a=1;a<=MAX_ATTEMPTS;a++){
    const d=await pullOne();id=d.outboxId;expect(d.attemptNo).toBe(a);
    await outbox().report({receipts:[rcpt(d,{outcome:'uncertain',telegramMessageId:undefined})]});
    await outbox().report({receipts:[rcpt(d,{phase:'reconcile',outcome:'not_sent',telegramMessageId:undefined})]});
    const row=await one(id);
    expect(row.state).toBe('pending');
    const wait=(await rows<{s:number}>('SELECT extract(epoch FROM (next_attempt_at-now()))::float s FROM outbox_messages WHERE id=$1',[id]))[0].s;
    expect(wait).toBeGreaterThan(backoffSeconds(a)-5);expect(wait).toBeLessThanOrEqual(backoffSeconds(a)+1);
    expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
    await due(id);
  }
  expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
  expect(await one(id)).toMatchObject({state:'dead',last_error_code:'MAX_ATTEMPTS_EXHAUSTED',attempt_no:MAX_ATTEMPTS});
});

test('FB-4 a malformed errorCode fails the whole request as a schema error',async()=>{
  await intake().ingest(ev({}));await intake().ingest(ev({}));
  const [a,b]=(await outbox().pull({limit:5})).deliveries;
  await expect(outbox().report({receipts:[rcpt(a),rcpt(b,{outcome:'failed_permanent',errorCode:'bad code; DROP',telegramMessageId:undefined})]})).rejects.toThrow();
  expect((await one(a.outboxId)).state).toBe('leased');
});

test('FB-5 the envelope carries version and source from the row',async()=>{
  await intake().ingest(ev({}));
  const row=(await rows<{event_version:string;source:string}>('SELECT event_version,source FROM outbox_messages'))[0];
  const d=await pullOne();
  expect(d.envelope.version).toBe(row.event_version);expect(d.envelope.source).toBe(row.source);
});

test('FB-7 a spooled event with a failed file queues attachment_failed, never recovered',async()=>{
  await intake().ingest(ev({spooled:true,attachment:{state:'failed',reasonCode:'download_failed'}}));
  expect(await rows<{template:string}>('SELECT template FROM outbox_messages')).toEqual([{template:'intake.attachment_failed'}]);
});
