import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {IntakeService} from '../src/server/intake';
import {IdentityService} from '../src/server/identity';
import {OutboxService,enqueueDm,enqueueReceipt} from '../src/server/outbox';
import {AccountService} from '../src/server/accounts';
import {notifyVoters} from '../src/server/account-approval';
import {provisionApprovers} from './account-approval-fixture';
import {ids} from '../src/server/identities';

describe.skipIf(!native)('outbox crash and concurrency (native PostgreSQL)',()=>{
 let h:Harness;
 beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
 afterEach(async()=>{await h.reset();await h.close();});
 const chats=bridgeConfig.intake!.chats;
 const intake=(enq=enqueueReceipt)=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,chats,enq);
 const outbox=()=>new OutboxService(h.operator,new IdentityService(h.operator,ids.tenant),{id:intakePrincipalId,tenantId:ids.tenant,projectIds:[ids.sales]});
 const count=async(t:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${t}`)).rows[0].n);
 const rcpt=(d:{outboxId:string;attemptNo:number;leaseToken:string})=>({outboxId:d.outboxId,attemptNo:d.attemptNo,leaseToken:d.leaseToken,phase:'send',outcome:'delivered',telegramMessageId:'77',reportedAt:new Date().toISOString()});

 test('a rolled-back business transaction leaves no outbox row',async()=>{
  const failing:typeof enqueueReceipt=async(tx,i)=>{await enqueueReceipt(tx,i);throw new Error('forced failure after the outbox write');};
  await expect(intake(failing).ingest(messageEvent({}))).rejects.toThrow('forced failure');
  expect(await count('source_events')).toBe(0);expect(await count('intake_events')).toBe(0);expect(await count('outbox_messages')).toBe(0);
  await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,pm.id,'900000042']);
  const identity=new IdentityService(h.operator,ids.tenant);
  await expect(identity.scope(async tx=>{
   await enqueueDm(tx,{tenantId:ids.tenant,recipientUserId:pm.id,telegramId:'900000042',template:'account_approval.pending',dedupeKey:'crash-dm',params:{},traceId:randomUUID(),correlationId:randomUUID(),causationId:null});
   throw new Error('forced failure after the DM write');
  })).rejects.toThrow('forced failure');
  expect(await count('outbox_messages')).toBe(0);
  // Task 9: identity.scope proposes a real ballot, queues its DMs, then dies: no ballot, no voter, no DM row survives
  const adminId=randomUUID();
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'crash-admin','Admin','manager','fixture-only')`,[adminId,ids.tenant]);
  await h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',[ids.tenant,adminId,ids.sales,'manager']);
  const approving=new IdentityService(h.operator,ids.tenant,adminId);
  await provisionApprovers(h.operator,approving,adminId,ids.sales);
  await approving.requestRegistration({username:'crash.member',name:'Crash Member',projectInterest:'Team Tech',note:''});
  const admin={id:adminId,tenantId:ids.tenant,name:'Admin',role:'manager' as const,projectIds:[ids.sales],accountAdmin:true};
  const request=(await new AccountService(approving).pendingRegistrations(admin))[0];
  let queued=0;
  const dying:typeof notifyVoters=async(tx,service,approvalId,voters,traceId)=>{
   await notifyVoters(tx,service,approvalId,voters,traceId);
   queued=(await tx.query<{n:number}>("SELECT count(*)::int n FROM outbox_messages WHERE audience='dm'")).rows[0].n;
   throw new Error('forced failure after the ballot DMs');
  };
  await expect(new AccountService(approving,dying).registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
   grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Kiểm thử chết giữa chừng'})).rejects.toThrow('forced failure after the ballot DMs');
  expect(queued).toBe(4);
  expect(await count('outbox_messages')).toBe(0);
  expect(await count('identity.account_approvals')).toBe(0);
  expect(await count('identity.account_approval_voters')).toBe(0);
 });

 test('a process that dies between write and send still delivers exactly once after restart',async()=>{
  await intake().ingest(messageEvent({}));
  await h.close();
  h=await openHarness();
  const d=await outbox().pull({limit:5});
  expect(d.deliveries).toHaveLength(1);
  await outbox().report({receipts:[rcpt(d.deliveries[0])]});
  expect((await outbox().pull({limit:5})).deliveries).toEqual([]);
  expect(await count('delivery_receipts')).toBe(1);
 });

 test('two pulls in parallel never lease the same message',async()=>{
  for(let i=0;i<5;i++) await intake().ingest(messageEvent({}));
  const all=(await h.operator.query<{id:string}>('SELECT id FROM outbox_messages')).rows.map(r=>r.id);
  expect(all).toHaveLength(5);
  const [a,b]=await Promise.all([outbox().pull({limit:5}),outbox().pull({limit:5})]);
  const got=[...a.deliveries,...b.deliveries].map(x=>x.outboxId);
  expect(new Set(got).size).toBe(got.length);
  expect([...got].sort()).toEqual([...all].sort());
  expect((await h.operator.query("SELECT 1 FROM outbox_messages WHERE state='leased' AND attempt_no<>1")).rows).toEqual([]);
 });

 test('a gateway that dies after leasing leaves the message uncertain, not resent',async()=>{
  await intake().ingest(messageEvent({}));
  const d=await outbox().pull({limit:5});
  expect(d.deliveries).toHaveLength(1);
  await h.operator.query("UPDATE outbox_messages SET lease_expires_at=now()-interval '1 minute'");
  const next=await outbox().pull({limit:5});
  expect(next.deliveries).toEqual([]);
  expect(next.reconcile).toEqual([{outboxId:d.deliveries[0].outboxId,attemptNo:1}]);
 });
});
