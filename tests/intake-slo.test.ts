import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {performance} from 'node:perf_hooks';
import {native,openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {IntakeService} from '../src/server/intake';
import {InboxService} from '../src/server/inbox';
import {OutboxService,enqueueReceipt} from '../src/server/outbox';
import {IdentityService} from '../src/server/identity';
import {ids} from '../src/server/identities';

const pct=(xs:number[],q:number)=>{const s=[...xs].sort((a,b)=>a-b);return Math.round(s[Math.min(s.length-1,Math.ceil(q*s.length)-1)]*10)/10;};

describe.skipIf(!native)('intake SLO probe (native PostgreSQL)',()=>{
 let h:Harness;
 beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
 afterEach(async()=>{await h.reset();await h.close();});
 const chats=bridgeConfig.intake!.chats;
 const intake=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,chats,enqueueReceipt);
 const outbox=()=>new OutboxService(h.operator,new IdentityService(h.operator,ids.tenant),{id:intakePrincipalId,tenantId:ids.tenant,projectIds:[ids.sales]});

 test('SLO probe on synthetic data (a measurement, not a commitment)',async()=>{
  const N=200;
  const persist:number[]=[];const queued:number[]=[];const start:number[]=[];const candidates:string[]=[];
  for(let i=0;i<N;i++){
   const t0=performance.now();
   const ack=await intake().ingest(messageEvent({}));
   const t1=performance.now();
   const r=await h.operator.query('SELECT 1 FROM outbox_messages WHERE source_event_id=$1',[ack.sourceEventId]);
   const t2=performance.now();
   expect(r.rows).toHaveLength(1);
   persist.push(t1-t0);queued.push(t2-t0);start.push(t0);candidates.push(ack.sourceEventId);
  }
  const delivered:number[]=[];
  for(let guard=0;guard<N*2;guard++){
   const d=await outbox().pull({limit:10});
   if(d.deliveries.length===0)break;
   await outbox().report({receipts:d.deliveries.map(x=>({outboxId:x.outboxId,attemptNo:x.attemptNo,leaseToken:x.leaseToken,phase:'send',outcome:'delivered',telegramMessageId:'77',reportedAt:new Date().toISOString()}))});
   const now=performance.now();
   for(let j=0;j<d.deliveries.length;j++) delivered.push(now);
  }
  expect(delivered).toHaveLength(N);
  const toDelivered=delivered.map((t,i)=>t-start[i]);
  const p95Queued=pct(queued,0.95);
  console.log(JSON.stringify({slo_probe:{events:N,persist_ms_p50:pct(persist,0.5),persist_ms_p95:pct(persist,0.95),persist_to_receipt_queued_ms_p95:p95Queued,persist_to_delivered_simulated_ms_p95:pct(toDelivered,0.95),projection:'not_measured: no intake projection in slice 2',overdue_listed_after_s:600}}));
  expect(p95Queued).toBeLessThan(30000);
  // an undelivered pending row moved 11 minutes into the past is listed as overdue
  const late=await intake().ingest(messageEvent({}));
  await h.operator.query("UPDATE outbox_messages SET created_at=now()-interval '11 minutes' WHERE source_event_id=$1",[late.sourceEventId]);
  const list=await new InboxService(h.db).failures(pm,ids.sales);
  expect(list.some(r=>r.state==='pending'&&r.overdue)).toBe(true);
 });
});
