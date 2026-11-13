import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {intakePrincipalId} from './slice2-fixtures';
import {provisionApprovers} from './account-approval-fixture';
import {IdentityService} from '../src/server/identity';
import {AccountService} from '../src/server/accounts';
import {AccountApprovalService,notifyVoters} from '../src/server/account-approval';
import {OutboxService} from '../src/server/outbox';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// SPEC-007 case (a): every frozen voter of an account-approval ballot gets one DM through the outbox, written in the
// ballot's own transaction. Delivery (gateway receipt) and acknowledgement (the recipient's vote) are separate states.
let h:Harness,identity:IdentityService,accounts:AccountService,admin:Principal;
let approvers:Awaited<ReturnType<typeof provisionApprovers>>;
beforeEach(async()=>{
 h=await openHarness();await h.reset();await seedSlice1(h);
 const id=randomUUID();
 identity=new IdentityService(h.operator,ids.tenant,id);accounts=new AccountService(identity);
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
  VALUES($1,$2,'chair-dm','Admin','manager','test-fixture')`,[id,ids.tenant]);
 await h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',
  [ids.tenant,id,ids.sales,'manager']);
 admin={id,tenantId:ids.tenant,name:'Admin',role:'manager',projectIds:[ids.sales],accountAdmin:true,
  grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]}]};
 approvers=await provisionApprovers(h.operator,identity,id,ids.sales);
});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const count=async(t:string,where='true',p:unknown[]=[])=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t} WHERE ${where}`,p))[0].n);
const grants=[{projectId:ids.sales,role:'engineer' as const,reportPermissions:[]}];
const reason='Đã kiểm danh tính Team Tech';
const key=(approvalId:string,userId:string)=>'account_approval.pending:'+approvalId+':'+userId;
async function request(username:string,name='Người đăng ký DM') {
 await identity.requestRegistration({username,name,projectInterest:'Team Tech',note:''});
 const found=(await accounts.pendingRegistrations(admin)).find(row=>row.username===username);
 if(!found) throw new Error('registration not found');
 return found.id;
}
async function propose(requestId:string,service=accounts) {
 const result=await service.registrationDecision(admin,{kind:'approve_registration',requestId,grants,reason});
 if(!('approvalId' in result)||!result.approvalId) throw new Error('approval not proposed');
 return result.approvalId;
}

test('a new ballot queues one DM per frozen voter in the same transaction',async()=>{
 const approvalId=await propose(await request('dm.member','Nguyễn Thử Đăng Ký'));
 const ballot=(await rows<{created_at:Date}>('SELECT created_at FROM identity.account_approvals WHERE id=$1',[approvalId]))[0];
 const voters=await rows<{user_id:string}>('SELECT user_id FROM identity.account_approval_voters WHERE approval_id=$1',[approvalId]);
 expect(voters).toHaveLength(4);
 const out=await rows<R&{target_chat_id:string;created_at:Date;payload:unknown;trace_id:string;event_id:string}>(
  'SELECT * FROM outbox_messages ORDER BY target_chat_id');
 expect(out).toHaveLength(4);
 expect(out.map(row=>row.target_chat_id)).toEqual(approvers.map(a=>a.telegram).sort());
 for(const row of out) {
  const seat=approvers.find(a=>a.telegram===row.target_chat_id)!;
  expect(row).toMatchObject({audience:'dm',project_id:null,template:'account_approval.pending',event_type:'account_approval.pending',
   state:'pending',recipient_user_id:seat.id,dedupe_key:key(approvalId,seat.id),delivered_at:null,acknowledged_at:null,causation_id:null,
   source_event_id:null,candidate_id:null});
  expect(row.payload).toEqual({params:{}});
  const payload=JSON.stringify(row.payload);
  for(const hidden of ['Nguyễn Thử Đăng Ký','dm.member','Cổng bán hàng mẫu',ids.sales,approvalId]) expect(payload).not.toContain(hidden);
  // now() is the transaction start time: the ballot and every DM row carry the same instant only when written together
  expect(new Date(row.created_at).getTime()).toBe(new Date(ballot.created_at).getTime());
 }
 expect(new Set(out.map(row=>row.trace_id)).size).toBe(1);
 expect(new Set(out.map(row=>row.event_id)).size).toBe(4);
});

test('a proposal that fails leaves no DM row',async()=>{
 const requestId=await request('dm.fail','Đăng ký lỗi');
 let written=-1;
 const failing:typeof notifyVoters=async(tx,service,approvalId,voters,traceId)=>{
  await notifyVoters(tx,service,approvalId,voters,traceId);
  written=(await tx.query<{n:number}>("SELECT count(*)::int n FROM outbox_messages WHERE audience='dm'")).rows[0].n;
  // a duplicate seat on the same ballot, after the DMs were written: the voters table refuses it
  await tx.query('INSERT INTO identity.account_approval_voters(approval_id,tenant_id,seat,user_id) VALUES($1,$2,$3,$4)',
   [approvalId,ids.tenant,'chairman',admin.id]);
 };
 await expect(propose(requestId,new AccountService(identity,failing))).rejects.toThrow();
 expect(written).toBe(4);
 expect(await count('outbox_messages')).toBe(0);
 expect(await count('identity.account_approvals')).toBe(0);
 expect(await count('identity.account_approval_voters')).toBe(0);
 expect(await rows('SELECT state FROM identity.registration_requests WHERE id=$1',[requestId])).toEqual([{state:'pending'}]);
 expect(await count('identity.events',"kind='account_approval_proposed' AND detail->>'requestId'=$1",[requestId])).toBe(0);
 // control: the same proposal without the fault queues the four DMs
 await propose(requestId);
 expect(await count('outbox_messages')).toBe(4);
});

test('the DM has a delivery receipt of its own, separate from the vote',async()=>{
 const approvalId=await propose(await request('dm.receipt'));
 const outbox=new OutboxService(h.operator,identity,{id:intakePrincipalId,tenantId:ids.tenant,projectIds:[ids.sales]});
 const pulled=await outbox.pull({limit:10});
 expect(pulled.deliveries).toHaveLength(4);
 expect(pulled.deliveries.map(d=>d.chatId).sort()).toEqual(approvers.map(a=>a.telegram).sort());
 for(const d of pulled.deliveries) {
  expect(d).toMatchObject({audience:'dm',topicId:'',replyToMessageId:null,envelope:{payload:{template:'account_approval.pending',params:{}}}});
  expect(JSON.stringify(d)).not.toContain(approvalId);
 }
 const delivery=(tg:string)=>pulled.deliveries.find(d=>d.chatId===tg)!;
 const receipt=(tg:string)=>{const d=delivery(tg);return {outboxId:d.outboxId,attemptNo:d.attemptNo,leaseToken:d.leaseToken,
  phase:'send',outcome:'delivered',telegramMessageId:'501',reportedAt:new Date().toISOString()};};
 const row=async(tg:string)=>(await rows<{state:string;delivered_at:Date|null;acknowledged_at:Date|null;version:number}>(
  'SELECT state,delivered_at,acknowledged_at,version FROM outbox_messages WHERE target_chat_id=$1',[tg]))[0];
 const [chair,bom]=approvers;
 expect(await outbox.report({receipts:[receipt(chair.telegram)]})).toMatchObject({accepted:1});
 const delivered=await row(chair.telegram);
 expect(delivered).toMatchObject({state:'delivered',acknowledged_at:null});
 expect(delivered.delivered_at).not.toBeNull();
 const ballot=new AccountApprovalService(identity);
 await ballot.vote(chair.telegram,chair.telegram,'private',approvalId,'agree');
 const voted=await row(chair.telegram);
 expect(voted).toMatchObject({state:'delivered',delivered_at:delivered.delivered_at,version:delivered.version});
 expect(voted.acknowledged_at).not.toBeNull();
 // a voter whose DM is still out (leased, no receipt) votes on the web: acknowledged, still not delivered
 const before=await row(bom.telegram);
 expect(before).toMatchObject({state:'leased',delivered_at:null,acknowledged_at:null});
 const web=await identity.telegramPrincipal(bom.telegram);
 expect(await ballot.voteForPrincipal(web,approvalId,'agree')).toMatchObject({state:'approved'});
 const acked=await row(bom.telegram);
 expect(acked).toMatchObject({state:'leased',delivered_at:null,version:before.version});
 expect(acked.acknowledged_at).not.toBeNull();
 expect(await count('delivery_receipts')).toBe(1);
 // the gateway receipt still lands on the acknowledged row, and the acknowledgement stays as it was
 expect(await outbox.report({receipts:[receipt(bom.telegram)]})).toMatchObject({accepted:1});
 expect(await row(bom.telegram)).toMatchObject({state:'delivered',acknowledged_at:acked.acknowledged_at});
 for(const other of approvers.slice(2)) expect((await row(other.telegram)).acknowledged_at).toBeNull();
});

test('proposing the same registration twice never queues a second DM',async()=>{
 const requestId=await request('dm.again');
 const first=await propose(requestId);
 expect(await count('outbox_messages')).toBe(4);
 await expect(propose(requestId)).rejects.toMatchObject({code:'APPROVAL_PENDING'});
 expect(await count('outbox_messages')).toBe(4);
 // notifying the same ballot again adds nothing: the dedupe key is per ballot and voter
 const voters=await rows<{user_id:string;telegram_id:string}>(`SELECT v.user_id,l.telegram_id FROM identity.account_approval_voters v
  JOIN identity.telegram_links l ON (l.user_id,l.tenant_id)=(v.user_id,v.tenant_id) WHERE v.approval_id=$1`,[first]);
 await identity.scope(tx=>notifyVoters(tx,identity,first,voters,randomUUID()));
 expect(await count('outbox_messages')).toBe(4);
 // the ballot expires; proposing again opens a new ballot whose DMs carry new dedupe keys
 await h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 minute' WHERE id=$1",[first]);
 const second=await propose(requestId);
 expect(second).not.toBe(first);
 expect(await rows('SELECT state FROM identity.account_approvals WHERE id=$1',[first])).toEqual([{state:'expired'}]);
 expect(await count('outbox_messages')).toBe(8);
 expect(await count('outbox_messages','dedupe_key LIKE $1',['account_approval.pending:'+second+':%'])).toBe(4);
 expect(await count('outbox_messages','dedupe_key LIKE $1',['account_approval.pending:'+first+':%'])).toBe(4);
});

test('(6) a ballot tapped in a group, tapped again, or tapped on an old card records no vote',async()=>{
 const approvalId=await propose(await request('dm.taps'));
 const ballot=new AccountApprovalService(identity);
 const [chair,bom,late]=approvers;
 const votes=(id=approvalId)=>count('identity.account_approval_votes','approval_id=$1',[id]);
 const ack=async(userId:string,id=approvalId)=>(await rows<{acknowledged_at:Date|null}>(
  'SELECT acknowledged_at FROM outbox_messages WHERE dedupe_key=$1',[key(id,userId)]))[0].acknowledged_at;
 await expect(ballot.vote(chair.telegram,'-1000000000001','group',approvalId,'agree')).rejects.toMatchObject({code:'PRIVATE_CHAT_REQUIRED'});
 expect(await votes()).toBe(0);
 expect(await ack(chair.id)).toBeNull();
 expect(await ballot.vote(chair.telegram,chair.telegram,'private',approvalId,'agree')).toMatchObject({state:'pending',replayed:false});
 const first=await ack(chair.id);
 expect(first).not.toBeNull();
 expect(await ballot.vote(chair.telegram,chair.telegram,'private',approvalId,'agree')).toMatchObject({replayed:true});
 expect(await votes()).toBe(1);
 expect(await ack(chair.id)).toEqual(first);
 await expect(ballot.vote(chair.telegram,chair.telegram,'private',approvalId,'reject')).rejects.toMatchObject({code:'VOTE_LOCKED'});
 expect(await votes()).toBe(1);
 expect(await ballot.vote(bom.telegram,bom.telegram,'private',approvalId,'agree')).toMatchObject({state:'approved'});
 // an old card on a closed ballot
 await expect(ballot.vote(late.telegram,late.telegram,'private',approvalId,'agree')).rejects.toMatchObject({code:'APPROVAL_CLOSED'});
 expect(await votes()).toBe(2);
 expect(await ack(late.id)).toBeNull();
 // an old card on an expired ballot
 const expired=await propose(await request('dm.expired'));
 await h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 minute' WHERE id=$1",[expired]);
 await expect(ballot.vote(chair.telegram,chair.telegram,'private',expired,'agree')).rejects.toMatchObject({code:'APPROVAL_CLOSED'});
 expect(await votes(expired)).toBe(0);
 expect(await ack(chair.id,expired)).toBeNull();
});
