import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {outsider,pm,seedSlice1} from './slice1-fixtures';
import {provisionApprovers} from './account-approval-fixture';
import {grantDocApproval,reviewer,seedMembers,approver as docApprover,transportApprover} from './slice3-fixtures';
import {IdentityService,digest,secret} from '../src/server/identity';
import {AccountService} from '../src/server/accounts';
import {AccountApprovalService} from '../src/server/account-approval';
import {DOC_APPROVAL_TYPES,docApprovalCode,docApprovalTypes} from '../src/server/access-grants';
import {scoped} from '../src/server/db';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant} from '../src/server/types';

// SPEC-007 case (b) carries the right to approve a document's canonical revision (OQ-31 b): eight codes doc_approve:<type> on a membership,
// granted only through the existing access-change ballot (one BoM agreeing, OQ-29). No new ballot kind and no new voting rule.
let h:Harness,identity:IdentityService,accounts:AccountService,ballot:AccountApprovalService,admin:Principal;
let approvers:Awaited<ReturnType<typeof provisionApprovers>>;
const subject={id:'',username:'subject.da',name:'Người được cấp quyền duyệt'};
beforeEach(async()=>{
 h=await openHarness();await h.reset();await seedSlice1(h);
 const id=randomUUID();
 identity=new IdentityService(h.operator,ids.tenant,id);accounts=new AccountService(identity);ballot=new AccountApprovalService(identity);
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
  VALUES($1,$2,'chair-da','Admin','manager','test-fixture')`,[id,ids.tenant]);
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
const design=docApprovalCode('design'),plan=docApprovalCode('plan');
const docGrants=(...codes:ProjectGrant['reportPermissions'])=>[{projectId:ids.sales,role:'engineer' as const,reportPermissions:codes}];
const current=async()=>{const user=(await accounts.list(admin)).find(row=>row.id===subject.id);if(!user) throw new Error('subject not listed');return user;};
const memberships=()=>rows<{project_id:string;project_role:string;report_permissions:string[]}>(
 'SELECT project_id,project_role,report_permissions FROM identity.memberships WHERE user_id=$1 ORDER BY project_id',[subject.id]);
const command=async(kind:string,extra:R={})=>accounts.command(admin,{kind,userId:subject.id,
 expectedVersion:(await current()).version,reason:'Thay đổi phạm vi Team Tech',...extra});
const propose=(grants:ProjectGrant[])=>command('propose_access_change',{grants});
const access=(grants:ProjectGrant[])=>command('access',{grants});
async function proposeId(grants:ProjectGrant[]) {
 const result=await propose(grants);
 if(!('approvalId' in result)||!result.approvalId) throw new Error('no ballot');
 return result.approvalId as string;
}
const say=(seat:number,approvalId:string,choice='agree')=>
 ballot.vote(approvers[seat].telegram,approvers[seat].telegram,'private',approvalId,choice);
const approval=async(id:string)=>(await rows<R>('SELECT * FROM identity.account_approvals WHERE id=$1',[id]))[0];
/** Operational login: a synthetic access_change ballot of the given state naming this project and these codes, for this subject. */
async function ballotFor(userId:string,projectId:string,codes:string[],state:string,tenant=ids.tenant) {
 const grants=JSON.stringify([{projectId,role:'engineer',reportPermissions:codes}]);
 const previous=JSON.stringify([{projectId,role:'engineer',reportPermissions:[]}]);
 await h.operator.query(`INSERT INTO identity.account_approvals(tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason,state)
  VALUES($1,'access_change',$2,1,$3,$4,$5,'Phiếu đổi quyền tổng hợp cho bản thử',$6)`,[tenant,userId,previous,admin.id,grants,state]);
}
const setPermissions=(userId:string,projectId:string,codes:string[])=>h.operator.query(
 'UPDATE identity.memberships SET report_permissions=$3 WHERE user_id=$1 AND project_id=$2',[userId,projectId,codes]);
const listApprovers=(p:Principal,project:string)=>scoped(h.db,p,async tx=>(await tx.query<{user_id:string;doc_types:string[]}>(
 'SELECT user_id,doc_types FROM public.document_approvers($1) ORDER BY user_id',[project])).rows);
const GUARD=/Document approval needs an approved access-change ballot that names it/;

// ---------------------------------------------------------------- Toàn vẹn
test('the pure helpers keep the eight types in order and drop what is not a doc_approve code',()=>{
 expect([...DOC_APPROVAL_TYPES]).toEqual(['project_index','change_brief','requirements','design','plan','verification','guide','other']);
 expect(docApprovalCode('plan')).toBe('doc_approve:plan');
 expect(docApprovalTypes(['people_read','doc_approve:plan','doc_approve:design','doc_approve:bogus','doc_approve:plan','quality_review','doc_approve:'])).toEqual(['design','plan']);
 expect(docApprovalTypes([])).toEqual([]);
});

test('the membership permission set admits the eight doc_approve codes and nothing else',async()=>{
 const checks=await rows<{conname:string;def:string}>(`SELECT conname,pg_get_constraintdef(oid) def FROM pg_constraint
  WHERE conrelid='identity.memberships'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%report_permissions%'`);
 expect(checks.map(c=>c.conname)).toEqual(['memberships_grant_permissions_check']);
 for(const value of ['people_read','quality_review','report_approve',...DOC_APPROVAL_TYPES.map(docApprovalCode)])
  expect(checks[0].def,value).toContain(`'${value}'`);
 expect((checks[0].def.match(/doc_approve:/g)??[]).length).toBe(8);
 // all eight enter a membership when a ballot names them; a code outside the eight is refused by the CHECK even when a ballot names it
 await ballotFor(subject.id,ids.sales,[...DOC_APPROVAL_TYPES.map(docApprovalCode),'doc_approve:bogus'],'issued');
 await setPermissions(subject.id,ids.sales,DOC_APPROVAL_TYPES.map(docApprovalCode));
 expect((await memberships())[0].report_permissions).toHaveLength(8);
 await expect(setPermissions(subject.id,ids.sales,['doc_approve:bogus'])).rejects.toThrow(/memberships_grant_permissions_check/);
 await expect(setPermissions(subject.id,ids.sales,['report_admin'])).rejects.toThrow(/memberships_grant_permissions_check/);
 await expect(setPermissions(subject.id,ids.sales,['Doc_Approve:design'])).rejects.toThrow(/memberships_grant_permissions_check/);
 expect((await memberships())[0].report_permissions).toHaveLength(8);
});

test('the three lists agree: access-grants, the documents schema and migration 019',async()=>{
 const source=await readFile(path.join(process.cwd(),'src/server/documents.ts'),'utf8');
 const declared=source.match(/const DOC_TYPES\s*=\s*\[([^\]]+)\]\s*as const/);
 expect(declared).not.toBeNull();
 const docTypes=[...declared![1].matchAll(/'([a-z_]+)'/g)].map(m=>m[1]);
 expect(docTypes).toHaveLength(8);
 expect([...DOC_APPROVAL_TYPES]).toEqual(docTypes);
 // the documents schema takes docType from this very list (there is no database CHECK on document_records.doc_type)
 expect(source).toContain('z.enum(DOC_TYPES)');
 const grantCheck=(await rows<{def:string}>(`SELECT pg_get_constraintdef(oid) def FROM pg_constraint WHERE conname='memberships_grant_permissions_check'`))[0].def;
 expect([...grantCheck.matchAll(/'doc_approve:([a-z_]+)'/g)].map(m=>m[1]).sort()).toEqual([...docTypes].sort());
 const file=await readFile(path.join(process.cwd(),'migrations/019_document_approver_grant.sql'),'utf8');
 expect([...file.matchAll(/'doc_approve:([a-z_]+)'/g)].map(m=>m[1]).sort()).toEqual([...docTypes].sort());
});

// ---------------------------------------------------------------- Có phiếu mới ghi được (tầng DB)
test('a doc_approve code enters a membership only with an approved or issued access-change ballot that names that project and code',async()=>{
 const other=randomUUID();
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'other.da','Người khác','viewer','fixture-hash')`,[other,ids.tenant]);
 const before=await memberships();
 const refused=async()=>{await expect(setPermissions(subject.id,ids.sales,[design])).rejects.toThrow(GUARD);expect(await memberships()).toEqual(before);};
 // no ballot at all
 await refused();
 // a pending, rejected or expired ballot is not an approved one
 for(const state of ['pending','rejected','expired']) {
  await h.operator.query('DELETE FROM identity.account_approvals');
  await ballotFor(subject.id,ids.sales,[design],state);
  await refused();
 }
 await h.operator.query('DELETE FROM identity.account_approvals');
 // a ballot that names another type, another project or another person
 await ballotFor(subject.id,ids.sales,[plan],'approved');
 await refused();
 await h.operator.query('DELETE FROM identity.account_approvals');
 await ballotFor(subject.id,ids.transport,[design],'approved');
 await refused();
 await h.operator.query('DELETE FROM identity.account_approvals');
 await ballotFor(other,ids.sales,[design],'approved');
 await refused();
 // an insert is checked too
 await expect(h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role,report_permissions) VALUES($1,$2,$3,\'engineer\',$4)',
  [ids.tenant,subject.id,ids.transport,[design]])).rejects.toThrow(GUARD);
 // an ordinary permission needs no ballot
 await setPermissions(subject.id,ids.sales,['people_read']);
 expect((await memberships())[0].report_permissions).toEqual(['people_read']);
 // the right ballot admits the code, approved or issued; one of two codes named is not enough for both
 await h.operator.query('DELETE FROM identity.account_approvals');
 await ballotFor(subject.id,ids.sales,[design],'approved');
 await setPermissions(subject.id,ids.sales,['people_read',design]);
 await expect(setPermissions(subject.id,ids.sales,[design,plan])).rejects.toThrow(GUARD);
 expect((await memberships())[0].report_permissions).toEqual(['people_read',design]);
 await h.operator.query("UPDATE identity.account_approvals SET state='issued'");
 await setPermissions(subject.id,ids.sales,[design]);
 await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,subject.id,ids.transport]);
 await ballotFor(subject.id,ids.transport,[plan],'issued');
 await setPermissions(subject.id,ids.transport,[plan]);
 expect((await memberships()).map(m=>m.report_permissions)).toEqual([[design],[plan]]);
});

test('moving a membership that carries a doc_approve code to another project or another person needs a ballot that names the new project and person',async()=>{
 const other=randomUUID();
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'mover.da','Người khác','viewer','fixture-hash')`,[other,ids.tenant]);
 await grantDocApproval(h,subject.id,ids.sales,['design']);
 const snapshot=()=>rows('SELECT id,user_id,project_id,report_permissions FROM identity.memberships WHERE user_id IN ($1,$2) ORDER BY id',[subject.id,other]);
 const before=await snapshot();
 // the targets satisfy the unique and foreign keys (no membership of that person in that project; both exist), so the guard is what refuses
 await expect(h.operator.query('UPDATE identity.memberships SET project_id=$2 WHERE user_id=$1',[subject.id,ids.transport])).rejects.toThrow(GUARD);
 await expect(h.operator.query('UPDATE identity.memberships SET user_id=$2 WHERE user_id=$1',[subject.id,other])).rejects.toThrow(GUARD);
 expect(await snapshot()).toEqual(before);
 // a ballot naming the new project (for the same person) lets the move through; the old ballot does not cover the other person
 await ballotFor(subject.id,ids.transport,[design],'approved');
 await h.operator.query('UPDATE identity.memberships SET project_id=$2 WHERE user_id=$1',[subject.id,ids.transport]);
 expect((await rows<{project_id:string}>('SELECT project_id FROM identity.memberships WHERE user_id=$1',[subject.id]))[0].project_id).toBe(ids.transport);
});

// ---------------------------------------------------------------- Cô lập và rò
test('document_approvers lists holders of the project in scope only',async()=>{
 await seedMembers(h);
 await grantDocApproval(h,reviewer.id,ids.sales,['plan','design']);
 await grantDocApproval(h,transportApprover.id,ids.transport,['design']);
 const salesOnly:Principal={...pm,projectIds:[ids.sales]};
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([{user_id:reviewer.id,doc_types:['design','plan']}]);
 // a project outside app.project_ids, even one that has holders, returns nothing
 expect(await listApprovers(salesOnly,ids.transport)).toEqual([]);
 expect(await listApprovers({...pm,projectIds:[ids.transport]},ids.transport)).toEqual([{user_id:transportApprover.id,doc_types:['design']}]);
 // another tenant's context sees none of this tenant's holders
 expect(await listApprovers(outsider,ids.sales)).toEqual([]);
 // no context at all
 const bare=await h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');
  return (await tx.query('SELECT * FROM public.document_approvers($1)',[ids.sales])).rows;});
 expect(bare).toEqual([]);
 // a locked account and one that never activated are not listed
 await h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[reviewer.id]);
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([]);
 await h.operator.query('UPDATE identity.users SET active=true,password_hash=NULL WHERE id=$1',[reviewer.id]);
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([]);
 await h.operator.query("UPDATE identity.users SET password_hash='fixture-only' WHERE id=$1",[reviewer.id]);
 expect(await listApprovers(salesOnly,ids.sales)).toHaveLength(1);
 // a member holding no doc_approve code is not listed
 expect((await listApprovers(salesOnly,ids.sales)).map(r=>r.user_id)).not.toContain(docApprover.id);
});

test('a viewer holding a doc_approve code is not listed as an approver',async()=>{
 await seedMembers(h);
 await grantDocApproval(h,reviewer.id,ids.sales,['design']);
 await grantDocApproval(h,subject.id,ids.sales,['design']);
 const salesOnly:Principal={...pm,projectIds:[ids.sales]};
 // the subject is a viewer in this project: the code is stored but never listed
 expect((await memberships())[0]).toMatchObject({project_role:'viewer',report_permissions:[design]});
 expect((await listApprovers(salesOnly,ids.sales)).map(r=>r.user_id)).toEqual([reviewer.id]);
 // the effective role is the project role first: a user-level viewer with an engineer membership is listed, an engineer user with a viewer membership is not
 await h.operator.query("UPDATE identity.memberships SET project_role='engineer' WHERE user_id=$1",[subject.id]);
 expect((await listApprovers(salesOnly,ids.sales)).map(r=>r.user_id).sort()).toEqual([reviewer.id,subject.id].sort());
 await h.operator.query("UPDATE identity.memberships SET project_role='viewer' WHERE user_id=$1",[reviewer.id]);
 expect((await listApprovers(salesOnly,ids.sales)).map(r=>r.user_id)).toEqual([subject.id]);
});

test('the runtime role cannot read or write identity.memberships, and only libetech_runtime may execute document_approvers',async()=>{
 const asRole=(role:string,sql:string,p:unknown[]=[])=>h.operator.transaction(async tx=>{await tx.query(`SET LOCAL ROLE ${role}`);return tx.query(sql,p);});
 await expect(asRole('libetech_runtime','SELECT count(*) FROM identity.memberships')).rejects.toThrow(/permission denied/);
 await expect(asRole('libetech_runtime',"UPDATE identity.memberships SET report_permissions='{}'")).rejects.toThrow(/permission denied/);
 await expect(asRole('libetech_runtime',"INSERT INTO identity.memberships(tenant_id,user_id,project_id) VALUES($1,$2,$3)",[ids.tenant,subject.id,ids.transport])).rejects.toThrow(/permission denied/);
 await expect(asRole('libetech_runtime','DELETE FROM identity.memberships')).rejects.toThrow(/permission denied/);
 await expect(asRole('libetech_intake','SELECT * FROM public.document_approvers($1)',[ids.sales])).rejects.toThrow(/permission denied/);
 const acl=(await rows<{role:string;ok:boolean}>(`SELECT r.rolname role,has_function_privilege(r.oid,'public.document_approvers(uuid)','EXECUTE') ok
  FROM pg_roles r WHERE r.rolname IN ('libetech_runtime','libetech_intake','libetech_identity') ORDER BY r.rolname`));
 expect(acl).toEqual([{role:'libetech_identity',ok:true},{role:'libetech_intake',ok:false},{role:'libetech_runtime',ok:true}]);
 const meta=(await rows<{owner:string;secdef:boolean;config:string[]|null}>(`SELECT pg_get_userbyid(p.proowner) owner,p.prosecdef secdef,p.proconfig config
  FROM pg_proc p WHERE p.oid='public.document_approvers(uuid)'::regprocedure`))[0];
 expect(meta).toMatchObject({owner:'libetech_identity',secdef:true,config:['search_path=pg_catalog']});
 const guard=(await rows<{secdef:boolean;config:string[]|null}>(`SELECT p.prosecdef secdef,p.proconfig config FROM pg_proc p
  WHERE p.oid='identity.memberships_doc_approve_guard()'::regprocedure`))[0];
 expect(guard).toEqual({secdef:false,config:['search_path=pg_catalog, pg_temp']});
});

// ---------------------------------------------------------------- Phiếu có sẵn, không luật mới
test('granting document approval is a widening: without an approved ballot the grant is refused',async()=>{
 const before=await memberships();
 await expect(access(docGrants(design))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 const id=await proposeId(docGrants(design));
 // a pending ballot is not an approved one
 await expect(access(docGrants(design))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await approval(id)).toMatchObject({state:'pending'});
 expect(await memberships()).toEqual(before);
});

test('one BoM agreeing approves the ballot and the admin applies exactly the frozen grants',async()=>{
 const salesOnly:Principal={...pm,projectIds:[ids.sales]};
 const id=await proposeId(docGrants(design));
 expect(await approval(id)).toMatchObject({kind:'access_change',state:'pending',grants:docGrants(design)});
 expect(await say(1,id)).toMatchObject({state:'approved',chairmanAgreed:false,bomAgreed:1,required:'1bom'});
 expect((await memberships())[0].report_permissions).toEqual([]);
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([]);
 const start=await current();
 const applied=await access(docGrants(design));
 if(!('user' in applied)||!applied.user) throw new Error('access not applied');
 expect(applied.user.version).toBe(start.version+1);
 expect(await memberships()).toEqual([{project_id:ids.sales,project_role:'engineer',report_permissions:[design]}]);
 expect(await approval(id)).toMatchObject({state:'issued'});
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([{user_id:subject.id,doc_types:['design']}]);
 // an issued ballot backs nothing more
 await expect(access(docGrants(design,plan))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 // the grant and the other report permissions live side by side, up to eleven values
 const all:ProjectGrant['reportPermissions']=['people_read','quality_review','report_approve',...DOC_APPROVAL_TYPES.map(docApprovalCode)];
 expect(all).toHaveLength(11);
 const wide=await proposeId(docGrants(...all));
 await say(2,wide);
 await access(docGrants(...all));
 expect((await memberships())[0].report_permissions).toHaveLength(11);
});

test('Chairman agreement alone does not grant document approval; the subject does not vote on their own ballot',async()=>{
 const salesOnly:Principal={...pm,projectIds:[ids.sales]};
 const id=await proposeId(docGrants(design));
 expect(await say(0,id)).toMatchObject({state:'pending',chairmanAgreed:true,bomAgreed:0,required:'1bom'});
 const before=await memberships();
 await expect(access(docGrants(design))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await memberships()).toEqual(before);
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([]);
 // the subject sits on a BoM seat of their own ballot: frozen voters leave them out, and a vote from them is refused
 await h.operator.query("UPDATE identity.account_approvals SET state='rejected'");
 const subjectTelegram='900009';
 await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,subject.id,subjectTelegram]);
 await h.operator.query("UPDATE identity.account_approval_seats SET user_id=$1 WHERE seat='bom_quan'",[subject.id]);
 const own=await proposeId(docGrants(design));
 const voters=await rows<{user_id:string}>('SELECT user_id FROM identity.account_approval_voters WHERE approval_id=$1',[own]);
 expect(voters).toHaveLength(3);
 expect(voters.map(v=>v.user_id)).not.toContain(subject.id);
 await expect(ballot.vote(subjectTelegram,subjectTelegram,'private',own,'agree')).rejects.toMatchObject({code:'APPROVER_REQUIRED'});
 expect(await count('identity.account_approval_votes','approval_id=$1',[own])).toBe(0);
 expect(await memberships()).toEqual(before);
});

// ---------------------------------------------------------------- Tự cấp quyền
test('the admin cannot propose or apply document approval for their own account',async()=>{
 const own=(kind:string)=>accounts.command(admin,{kind,userId:admin.id,expectedVersion:1,reason:'Tự cấp quyền duyệt bản chuẩn',
  grants:[{projectId:ids.sales,role:'manager',reportPermissions:[design]},{projectId:ids.transport,role:'manager',reportPermissions:[]}]});
 const before=await count('identity.account_approvals');
 await expect(own('propose_access_change')).rejects.toMatchObject({code:'ACCOUNT_SCOPE_DENIED',status:403});
 await expect(own('access')).rejects.toMatchObject({code:'ACCOUNT_SCOPE_DENIED',status:403});
 expect(await count('identity.account_approvals')).toBe(before);
 expect((await rows<{report_permissions:string[]}>('SELECT report_permissions FROM identity.memberships WHERE user_id=$1',[admin.id])).every(m=>m.report_permissions.length===0)).toBe(true);
});

test('a registration ballot cannot carry document approval',async()=>{
 await identity.requestRegistration({username:'reg.da',name:'Người đăng ký',projectInterest:'Team Tech',note:''});
 const request=(await accounts.pendingRegistrations(admin)).find(row=>row.username==='reg.da')!;
 const ballots=await count('identity.account_approvals');
 const events=await count('identity.events');
 for(const permissions of [[design],['people_read',plan]] as const)
  await expect(accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
   grants:[{projectId:ids.sales,role:'engineer',reportPermissions:[...permissions]}],reason:'Đã kiểm danh tính Team Tech'}))
   .rejects.toMatchObject({code:'DOC_APPROVAL_NEEDS_ACCESS_CHANGE',status:422,
    message:'Quyền duyệt bản chuẩn chỉ cấp qua phiếu đổi quyền cho tài khoản đã kích hoạt.'});
 expect(await count('identity.account_approvals')).toBe(ballots);
 expect(await count('identity.account_approval_voters')).toBe(0);
 expect(await count('outbox_messages')).toBe(0);
 expect(await count('identity.events')).toBe(events);
 expect(await rows('SELECT state FROM identity.registration_requests WHERE id=$1',[request.id])).toEqual([{state:'pending'}]);
 // control: the same registration without the code goes to a ballot
 await expect(accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants:[{projectId:ids.sales,role:'engineer',reportPermissions:['people_read']}],reason:'Đã kiểm danh tính Team Tech'}))
  .resolves.toMatchObject({pendingTelegramApproval:true});
});

// ---------------------------------------------------------------- Đúng loại
test('applying other document types than the frozen ballot is refused',async()=>{
 const id=await proposeId(docGrants(design));
 await say(1,id);
 const before=await memberships();
 await expect(access(docGrants(design,plan))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await expect(access(docGrants(plan))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await memberships()).toEqual(before);
 expect(await approval(id)).toMatchObject({state:'approved'});
 // control: exactly the frozen type applies
 await expect(access(docGrants(design))).resolves.toBeTruthy();
});

// ---------------------------------------------------------------- Giảm quyền
test('removing a doc_approve code is a reduction: applied directly, sessions revoked, and document_approvers no longer lists the person',async()=>{
 const salesOnly:Principal={...pm,projectIds:[ids.sales]};
 await h.operator.query("UPDATE identity.memberships SET project_role='engineer' WHERE user_id=$1",[subject.id]);
 await grantDocApproval(h,subject.id,ids.sales,['design','plan']);
 const token=secret();
 await h.operator.query(`INSERT INTO identity.sessions(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')`,[ids.tenant,subject.id,digest(token)]);
 expect((await identity.session(token)).id).toBe(subject.id);
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([{user_id:subject.id,doc_types:['design','plan']}]);
 const ballots=await count('identity.account_approvals');
 const start=await current();
 // dropping one code keeps the person listed for the other
 const one=await access(docGrants(design));
 if(!('user' in one)||!one.user) throw new Error('reduce not applied');
 expect(one.user.version).toBe(start.version+1);
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([{user_id:subject.id,doc_types:['design']}]);
 await expect(identity.session(token)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 const none=await access(docGrants());
 if(!('user' in none)||!none.user) throw new Error('reduce not applied');
 expect(await memberships()).toEqual([{project_id:ids.sales,project_role:'engineer',report_permissions:[]}]);
 expect(await listApprovers(salesOnly,ids.sales)).toEqual([]);
 expect(await count('identity.account_approvals')).toBe(ballots);
 expect(await count('outbox_messages')).toBe(0);
 expect(await count('identity.events',"kind='account_access' AND user_id=$1",[subject.id])).toBe(2);
});

// ---------------------------------------------------------------- Người bỏ phiếu thấy gì
test('the pending list hands the new code through unchanged',async()=>{
 const id=await proposeId(docGrants('people_read',design,plan));
 type Row={id:string;kind:string;grant_details:{name:string;role:string;reportPermissions:string[]}[];previous_grant_details:{reportPermissions:string[]}[]};
 const list=await ballot.pendingForPrincipal(admin) as Row[];
 const row=list.find(r=>r.id===id)!;
 expect(row.kind).toBe('access_change');
 expect(row.grant_details).toEqual([{name:'Cổng bán hàng mẫu',role:'engineer',reportPermissions:['people_read',design,plan]}]);
 expect(row.previous_grant_details).toEqual([{name:'Cổng bán hàng mẫu',role:'viewer',reportPermissions:[]}]);
 expect(JSON.stringify(row.previous_grant_details)).not.toContain('doc_approve:');
});
