import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {provisionApprovers} from './account-approval-fixture';
import {IdentityService,digest,secret} from '../src/server/identity';
import {AccountService} from '../src/server/accounts';
import {AccountApprovalService,approvalReady} from '../src/server/account-approval';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant} from '../src/server/types';

// SPEC-007 case (b): widening an existing account's access needs its own frozen ballot. OQ-29 decided 14/11/2026: one frozen BoM
// voter agreeing approves it; the Chairman's agreement never counts, the Chairman's rejection (S13) or every BoM rejecting closes it.
// Registration ballots keep Chairman + one BoM. Reducing access stays a direct admin command.
let h:Harness,identity:IdentityService,accounts:AccountService,ballot:AccountApprovalService,admin:Principal;
let approvers:Awaited<ReturnType<typeof provisionApprovers>>;
const subject={id:'',username:'subject.ac',name:'Người được đổi quyền'};
const salesName='Cổng bán hàng mẫu',transportName='Điều phối vận tải mẫu';
beforeEach(async()=>{
 h=await openHarness();await h.reset();await seedSlice1(h);
 const id=randomUUID();
 identity=new IdentityService(h.operator,ids.tenant,id);accounts=new AccountService(identity);ballot=new AccountApprovalService(identity);
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
  VALUES($1,$2,'chair-ac','Admin','manager','test-fixture')`,[id,ids.tenant]);
 for(const project of [ids.sales,ids.transport]) await h.operator.query(
  'INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',[ids.tenant,id,project,'manager']);
 admin={id,tenantId:ids.tenant,name:'Admin',role:'manager',projectIds:[ids.sales,ids.transport],accountAdmin:true,
  grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]},{projectId:ids.transport,role:'manager',reportPermissions:[]}]};
 approvers=await provisionApprovers(h.operator,identity,id,ids.sales);
 subject.id=randomUUID();
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
  VALUES($1,$2,$3,$4,'viewer','fixture-hash')`,[subject.id,ids.tenant,subject.username,subject.name]);
 await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,
  [ids.tenant,subject.id,ids.sales]);
});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const count=async(t:string,where='true',p:unknown[]=[])=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t} WHERE ${where}`,p))[0].n);
const wider:ProjectGrant[]=[
 {projectId:ids.sales,role:'engineer',reportPermissions:['quality_review','people_read']},
 {projectId:ids.transport,role:'viewer',reportPermissions:[]},
];
const current=async()=>{const user=(await accounts.list(admin)).find(row=>row.id===subject.id);if(!user) throw new Error('subject not listed');return user;};
const memberships=()=>rows<{project_id:string;project_role:string;report_permissions:string[]}>(
 'SELECT project_id,project_role,report_permissions FROM identity.memberships WHERE user_id=$1 ORDER BY project_id',[subject.id]);
const command=async(kind:string,extra:R={})=>accounts.command(admin,{kind,userId:subject.id,
 expectedVersion:(await current()).version,reason:'Thay đổi phạm vi Team Tech',...extra});
const propose=(grants:ProjectGrant[]=wider)=>command('propose_access_change',{grants});
const access=(grants:ProjectGrant[])=>command('access',{grants});
async function proposeId(grants:ProjectGrant[]=wider) {
 const result=await propose(grants);
 if(!('approvalId' in result)||!result.approvalId) throw new Error('no ballot');
 return result.approvalId as string;
}
const say=(seat:number,approvalId:string,choice='agree')=>
 ballot.vote(approvers[seat].telegram,approvers[seat].telegram,'private',approvalId,choice);
const approval=async(id:string)=>(await rows<R>('SELECT * FROM identity.account_approvals WHERE id=$1',[id]))[0];
const sortGrants=(grants:{projectId:string;reportPermissions:string[]}[])=>
 [...grants].map(grant=>({...grant,reportPermissions:[...grant.reportPermissions].sort()})).sort((a,b)=>a.projectId.localeCompare(b.projectId));

test('expanding access without an approved ballot is still refused',async()=>{
 const before=await memberships();
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await proposeId();
 // a pending ballot is not an approved one
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await memberships()).toEqual(before);
});

test('an access-change ballot freezes grants and applies once one BoM agrees',async()=>{
 const token=secret();
 await h.operator.query(`INSERT INTO identity.sessions(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')`,
  [ids.tenant,subject.id,digest(token)]);
 expect((await identity.session(token)).id).toBe(subject.id);
 const before=await memberships();
 const start=await current();
 const proposed=await propose();
 expect(proposed).toMatchObject({pendingTelegramApproval:true,agreed:0,required:'1bom'});
 const id=(proposed as {approvalId:string}).approvalId;
 expect(await approval(id)).toMatchObject({kind:'access_change',state:'pending',registration_id:null,subject_user_id:subject.id,
  subject_account_version:start.version,previous_grants:start.grants,grants:wider,proposer_id:admin.id});
 expect(await memberships()).toEqual(before);
 expect((await current()).version).toBe(start.version);
 expect(await count('identity.account_approval_voters','approval_id=$1',[id])).toBe(4);
 expect(await count('outbox_messages','dedupe_key LIKE $1',['account_approval.pending:'+id+':%'])).toBe(4);
 const proposedEvent=await rows<{user_id:string;actor_id:string;detail:R}>(
  "SELECT user_id,actor_id,detail FROM identity.events WHERE kind='access_change_proposed' AND detail->>'approvalId'=$1",[id]);
 expect(proposedEvent).toHaveLength(1);
 expect(proposedEvent[0]).toMatchObject({user_id:subject.id,actor_id:admin.id,detail:{before:start.grants,after:wider}});
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await memberships()).toEqual(before);
 expect(await say(1,id)).toMatchObject({state:'approved',chairmanAgreed:false,bomAgreed:1,required:'1bom'});
 expect(await memberships()).toEqual(before);
 // the same grants listed in another order are the frozen grants
 const reordered:ProjectGrant[]=[wider[1],{...wider[0],reportPermissions:['people_read','quality_review']}];
 const applied=await access(reordered);
 if(!('user' in applied)||!applied.user) throw new Error('access not applied');
 expect(applied.user.version).toBe(start.version+1);
 expect(sortGrants((await memberships()).map(m=>({projectId:m.project_id,role:m.project_role,reportPermissions:m.report_permissions}))))
  .toEqual(sortGrants(wider));
 expect(await approval(id)).toMatchObject({state:'issued'});
 await expect(identity.session(token)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 const audit=await rows<{detail:R}>("SELECT detail FROM identity.events WHERE kind='account_access' AND user_id=$1",[subject.id]);
 expect(audit).toHaveLength(1);
 expect(audit[0].detail).toMatchObject({approvalId:id,previousVersion:start.version,version:start.version+1});
 // an issued ballot backs nothing more
 await expect(access([{projectId:ids.sales,role:'manager',reportPermissions:[]},wider[1]])).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
});

test('Chairman agreement alone does not approve an access change',async()=>{
 const id=await proposeId();
 expect(await say(0,id)).toMatchObject({state:'pending',chairmanAgreed:true,bomAgreed:0,required:'1bom'});
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await expect(identity.scope(tx=>approvalReady(tx,identity,id,'access_change'))).rejects.toMatchObject({code:'APPROVAL_NOT_READY',status:409});
 expect(await approval(id)).toMatchObject({state:'pending'});
});

test('one BoM rejection keeps it pending while another BoM can still vote; every BoM rejecting closes it',async()=>{
 const id=await proposeId();
 // seats 1..3 are the three BoM voters besides the subject
 expect(await say(1,id,'reject')).toMatchObject({state:'pending'});
 expect(await say(2,id,'reject')).toMatchObject({state:'pending'});
 expect(await approval(id)).toMatchObject({state:'pending'});
 expect(await say(3,id,'reject')).toMatchObject({state:'rejected'});
 expect(await approval(id)).toMatchObject({state:'rejected'});
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 // a second ballot: a rejecting BoM does not stop another BoM from approving
 const next=await proposeId();
 expect(await say(1,next,'reject')).toMatchObject({state:'pending'});
 expect(await say(2,next)).toMatchObject({state:'approved',bomAgreed:1});
});

test('a registration ballot still needs Chairman and one BoM',async()=>{
 await identity.requestRegistration({username:'reg.tally',name:'Người đăng ký',projectInterest:'Team Tech',note:''});
 const request=(await accounts.pendingRegistrations(admin)).find(row=>row.username==='reg.tally')!;
 const proposed=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Đã kiểm danh tính Team Tech'});
 const id=(proposed as {approvalId:string}).approvalId;
 expect(await say(1,id)).toMatchObject({state:'pending',chairmanAgreed:false,bomAgreed:1,required:'chairman+1bom'});
 expect(await say(0,id)).toMatchObject({state:'approved',chairmanAgreed:true,bomAgreed:1});
});

test('Chairman rejection closes it',async()=>{
 const id=await proposeId();
 expect(await say(0,id,'reject')).toMatchObject({state:'rejected'});
 await expect(say(1,id)).rejects.toMatchObject({code:'APPROVAL_CLOSED'});
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await count('identity.account_approval_votes','approval_id=$1',[id])).toBe(1);
 // a closed ballot does not block a new proposal, and a second open one is refused
 const next=await proposeId();
 expect(next).not.toBe(id);
 await expect(propose()).rejects.toMatchObject({code:'APPROVAL_PENDING'});
});

test('grants that differ from the frozen ballot are refused',async()=>{
 const id=await proposeId();
 await say(0,id);await say(1,id);
 const before=await memberships();
 const extra:ProjectGrant[]=[{...wider[0],reportPermissions:[...wider[0].reportPermissions,'report_approve']},wider[1]];
 await expect(access(extra)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await expect(access([wider[0]])).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await memberships()).toEqual(before);
 expect(await approval(id)).toMatchObject({state:'approved'});
 // control: the frozen grants apply
 await expect(access(wider)).resolves.toBeTruthy();
});

test('an account change after the proposal invalidates the ballot',async()=>{
 const id=await proposeId();
 await command('disable');await command('enable');
 expect((await ballot.pendingForPrincipal(admin)).map(row=>(row as {id:string}).id)).not.toContain(id);
 await expect(say(0,id)).rejects.toMatchObject({code:'APPROVAL_CLOSED'});
 expect(await approval(id)).toMatchObject({state:'expired'});
 expect(await count('identity.account_approval_votes','approval_id=$1',[id])).toBe(0);
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 // an approved ballot stops counting too once the account changes
 const approved=await proposeId();
 await say(0,approved);await say(1,approved);
 await command('revoke_sessions');
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await approval(approved)).toMatchObject({state:'approved'});
 expect((await memberships()).map(m=>m.project_id)).toEqual([ids.sales]);
});

test('the subject never votes on their own access change',async()=>{
 const subjectTelegram='900009';
 await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,subject.id,subjectTelegram]);
 await h.operator.query("UPDATE identity.account_approval_seats SET user_id=$1 WHERE seat='bom_quan'",[subject.id]);
 // as the only BoM left there is nobody to approve
 const others=approvers.filter(a=>a.seat==='bom_chu'||a.seat==='bom_phuong');
 await h.operator.query("DELETE FROM identity.account_approval_seats WHERE seat IN ('bom_chu','bom_phuong')");
 await expect(propose()).rejects.toMatchObject({code:'APPROVERS_NOT_READY'});
 expect(await count('identity.account_approvals')).toBe(0);
 expect(await count('outbox_messages')).toBe(0);
 for(const a of others) await h.operator.query('INSERT INTO identity.account_approval_seats(tenant_id,seat,user_id) VALUES($1,$2,$3)',[ids.tenant,a.seat,a.id]);
 const id=await proposeId();
 const voters=await rows<{user_id:string}>('SELECT user_id FROM identity.account_approval_voters WHERE approval_id=$1',[id]);
 expect(voters).toHaveLength(3);
 expect(voters.map(v=>v.user_id)).not.toContain(subject.id);
 expect(await count('outbox_messages','dedupe_key LIKE $1',['account_approval.pending:'+id+':%'])).toBe(3);
 expect(await count('outbox_messages','target_chat_id=$1',[subjectTelegram])).toBe(0);
 await expect(ballot.vote(subjectTelegram,subjectTelegram,'private',id,'agree')).rejects.toMatchObject({code:'APPROVER_REQUIRED'});
 expect(await count('identity.account_approval_votes','approval_id=$1',[id])).toBe(0);
});

test('reducing access still needs no ballot',async()=>{
 await h.operator.query("UPDATE identity.memberships SET project_role='engineer',report_permissions=ARRAY['people_read'] WHERE user_id=$1",[subject.id]);
 await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,
  [ids.tenant,subject.id,ids.transport]);
 const start=await current();
 const reduced=await access([{projectId:ids.sales,role:'viewer',reportPermissions:[]}]);
 if(!('user' in reduced)||!reduced.user) throw new Error('reduce not applied');
 expect(reduced.user.version).toBe(start.version+1);
 expect(await memberships()).toEqual([{project_id:ids.sales,project_role:'viewer',report_permissions:[]}]);
 expect(await count('identity.account_approvals')).toBe(0);
 expect(await count('outbox_messages')).toBe(0);
});

test('a reduce-only proposal is ACCESS_CHANGE_NOT_NEEDED',async()=>{
 const start=await current();
 await expect(propose([{projectId:ids.sales,role:'viewer',reportPermissions:[]}])).rejects
  .toMatchObject({code:'ACCESS_CHANGE_NOT_NEEDED',status:409});
 expect(await count('identity.account_approvals')).toBe(0);
 expect(await count('outbox_messages')).toBe(0);
 expect((await current()).version).toBe(start.version);
});

test('an access-change ballot can never back an invitation',async()=>{
 const id=await proposeId();
 await say(0,id);await say(1,id);
 await expect(identity.scope(tx=>approvalReady(tx,identity,id,'registration'))).rejects.toMatchObject({code:'APPROVAL_NOT_READY'});
 await expect(identity.scope(tx=>approvalReady(tx,identity,id,'access_change'))).resolves.toMatchObject({id});
 const invitee=randomUUID(),token=secret();
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role) VALUES($1,$2,'invitee.ac','Người được mời','viewer')`,[invitee,ids.tenant]);
 await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,invitee,ids.sales]);
 await h.operator.query(`INSERT INTO identity.invitations(tenant_id,user_id,issuer_id,account_version,account_approval_id,token_hash,expires_at)
  VALUES($1,$2,$3,1,$4,$5,now()+interval '1 hour')`,[ids.tenant,invitee,admin.id,id,digest(token)]);
 const activate=()=>identity.activate({token,password:'Passphrase test Tech 2026!'});
 await expect(activate()).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 // still refused once the ballot is issued
 await access(wider);
 expect(await approval(id)).toMatchObject({state:'issued'});
 await expect(activate()).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await rows('SELECT password_hash FROM identity.users WHERE id=$1',[invitee])).toEqual([{password_hash:null}]);
});

test("pending shows both kinds with frozen current and proposed grants; another tenant's project name stays hidden",async()=>{
 await identity.requestRegistration({username:'reg.both',name:'Người đăng ký mới',projectInterest:'LBRC',note:''});
 const request=(await accounts.pendingRegistrations(admin)).find(row=>row.username==='reg.both')!;
 const registration=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants:[{projectId:ids.sales,role:'engineer',reportPermissions:[]}],reason:'Đã kiểm danh tính Team Tech'});
 const registrationId=(registration as {approvalId:string}).approvalId;
 const accessId=await proposeId();
 type Row={id:string;kind:string;name:string;username:string;project_interest:string|null;grant_details:unknown;previous_grant_details:unknown};
 const list=await ballot.pendingForPrincipal(admin) as Row[];
 expect(list).toHaveLength(2);
 expect(list.find(row=>row.id===registrationId)).toMatchObject({kind:'registration',name:'Người đăng ký mới',username:'reg.both',
  project_interest:'LBRC',previous_grant_details:null,grant_details:[{name:salesName,role:'engineer',reportPermissions:[]}]});
 const accessRow=list.find(row=>row.id===accessId)!;
 expect(accessRow).toMatchObject({kind:'access_change',name:subject.name,username:subject.username,project_interest:null,
  previous_grant_details:[{name:salesName,role:'viewer',reportPermissions:[]}],
  grant_details:[{name:salesName,role:'engineer',reportPermissions:['quality_review','people_read']},{name:transportName,role:'viewer',reportPermissions:[]}]});
 // a project of another tenant written into the frozen JSON never shows its name
 await h.operator.query(`UPDATE identity.account_approvals SET previous_grants=previous_grants||$2::jsonb,grants=grants||$2::jsonb WHERE id=$1`,
  [accessId,JSON.stringify([{projectId:ids.otherProject,role:'manager',reportPermissions:[]}])]);
 const again=(await ballot.pendingForPrincipal(admin) as Row[]).find(row=>row.id===accessId)!;
 expect(again.previous_grant_details).toEqual(accessRow.previous_grant_details);
 expect(again.grant_details).toEqual(accessRow.grant_details);
 expect(JSON.stringify([again.previous_grant_details,again.grant_details])).not.toContain('Dự án tenant đối chứng');
});

test('an approved ballot does not apply once the frozen grants no longer match, even if account_version did not move',async()=>{
 const id=await proposeId();
 await say(0,id);await say(1,id);
 expect(await approval(id)).toMatchObject({state:'approved'});
 // a membership written behind the service's back: same account_version, different grants than the ballot froze
 await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,subject.id,ids.transport]);
 const before=await memberships();
 await expect(access(wider)).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await memberships()).toEqual(before);
 expect(await approval(id)).toMatchObject({state:'approved'});
});
