import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {provisionApprovers} from './account-approval-fixture';
import {delegate,frozenRevision,registerDoc,reviewer,seedMembers} from './slice3-fixtures';
import {IdentityService} from '../src/server/identity';
import {AccountService} from '../src/server/accounts';
import {AccountApprovalService} from '../src/server/account-approval';
import {ReviewService} from '../src/server/document-review';
import {docApprovalCode} from '../src/server/access-grants';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant,Role} from '../src/server/types';

// OQ-31 (b), end to end on the existing mechanism (OQ-29): the account admin proposes, one BoM member agrees, the admin applies, and only
// then the member can approve a frozen canonical revision. No new route, no new command, no new voting rule.
let h:Harness,identity:IdentityService,accounts:AccountService,ballot:AccountApprovalService,admin:Principal,review:ReviewService;
let approvers:Awaited<ReturnType<typeof provisionApprovers>>;
const subject={id:'',username:'subject.df',name:'Người được cấp quyền duyệt'};
const design=docApprovalCode('design'),plan=docApprovalCode('plan');
beforeEach(async()=>{
 h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);
 const id=randomUUID();
 identity=new IdentityService(h.operator,ids.tenant,id);accounts=new AccountService(identity);ballot=new AccountApprovalService(identity);review=new ReviewService(h.db);
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'chair-df','Admin','manager','test-fixture')`,[id,ids.tenant]);
 for(const project of [ids.sales,ids.transport]) await h.operator.query(
  'INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',[ids.tenant,id,project,'manager']);
 admin={id,tenantId:ids.tenant,name:'Admin',role:'manager',projectIds:[ids.sales,ids.transport],accountAdmin:true,
  grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]},{projectId:ids.transport,role:'manager',reportPermissions:[]}]};
 approvers=await provisionApprovers(h.operator,identity,id,ids.sales);
 // the person to be granted: an explicit project role the review screens admit (engineer), never the viewer of tests/access-change.test.ts
 subject.id=randomUUID();
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,'engineer','fixture-hash')`,[subject.id,ids.tenant,subject.username,subject.name]);
 await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')`,[ids.tenant,subject.id,ids.sales]);
});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const count=async(t:string,where='true',p:unknown[]=[])=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t} WHERE ${where}`,p))[0].n);
const grants=(role:Role&ProjectGrant['role'],...codes:ProjectGrant['reportPermissions'])=>[{projectId:ids.sales,role,reportPermissions:codes}] as ProjectGrant[];
const current=async()=>{const user=(await accounts.list(admin)).find(row=>row.id===subject.id);if(!user) throw new Error('subject not listed');return user;};
const command=async(kind:string,extra:R={})=>accounts.command(admin,{kind,userId:subject.id,
 expectedVersion:(await current()).version,reason:'Thay đổi phạm vi Team Tech',...extra});
async function proposeId(g:ProjectGrant[]) {
 const result=await command('propose_access_change',{grants:g});
 if(!('approvalId' in result)||!result.approvalId) throw new Error('no ballot');
 return result.approvalId as string;
}
const say=(seat:number,approvalId:string,choice='agree')=>ballot.vote(approvers[seat].telegram,approvers[seat].telegram,'private',approvalId,choice);
const apply=(g:ProjectGrant[])=>command('access',{grants:g});
/** The whole real chain: the admin proposes, one BoM member agrees, the admin applies. */
async function grantThroughBallot(g:ProjectGrant[]) {await say(1,await proposeId(g));await apply(g);}
const memberships=()=>rows<{project_id:string;project_role:string;report_permissions:string[]}>(
 'SELECT project_id,project_role,report_permissions FROM identity.memberships WHERE user_id=$1 ORDER BY project_id',[subject.id]);
/** The session the person would carry; `sessionRole` and `sessionCodes` are what an older session may still say. */
const who=(sessionRole:ProjectGrant['role']='engineer',sessionCodes:ProjectGrant['reportPermissions']=[]):Principal=>({id:subject.id,tenantId:ids.tenant,projectIds:[ids.sales],name:subject.name,
 role:sessionRole,grants:[{projectId:ids.sales,role:sessionRole,reportPermissions:sessionCodes}]});

type Doc={docId:string;revisionId:string;version:number;hash:string};
async function frozenDoc(docType='design',projectId=ids.sales,author:string=member.id):Promise<Doc> {
 const doc=await registerDoc(h,pm,{projectId,docType});
 const f=await frozenRevision(h,doc.record.id,author);
 return {docId:doc.record.id,revisionId:f.revisionId,version:f.version,hash:f.hash};
}
const decision=(d:Doc,result:'approved'|'changes_requested'='approved')=>({revisionId:d.revisionId,sourceHash:d.hash,expectedVersion:d.version,result,scopeNote:'Đã đọc đúng bản này',exceptions:[]});
const decide=(p:Principal,d:Doc,result:'approved'|'changes_requested'='approved')=>review.decide(p,d.docId,decision(d,result),randomUUID(),randomUUID());
const failure=async(p:Promise<unknown>)=>{const e=await p.then(()=>null,x=>x) as {code?:string;status?:number}|null;if(!e) throw new Error('expected a refusal');return {code:e.code,status:e.status};};
const NOT_AUTHORIZED={code:'APPROVER_NOT_AUTHORIZED',status:403};
const pointer=async(d:Doc)=>(await rows<{approved_revision_id:string|null;version:number}>('SELECT approved_revision_id,version FROM document_records WHERE id=$1',[d.docId]))[0];
const untouched=async(d:Doc)=>{expect(await pointer(d)).toEqual({approved_revision_id:null,version:d.version});expect(await count('review_decisions')).toBe(0);};

test('end to end: proposed by the admin, approved by one BoM, applied by the admin, and only then the member approves a frozen design revision',async()=>{
 const doc=await frozenDoc();
 const person=who();
 // nothing yet: the right is not on the membership
 expect(await failure(decide(person,doc))).toEqual(NOT_AUTHORIZED);
 await untouched(doc);
 // proposed by the admin: still nothing, and the card shows no approver for the type
 const id=await proposeId(grants('engineer',design));
 expect(await failure(decide(person,doc))).toEqual(NOT_AUTHORIZED);
 // one BoM member agrees: the ballot is approved, the right is still not granted until the admin applies it
 expect(await say(1,id)).toMatchObject({state:'approved',bomAgreed:1,required:'1bom'});
 expect(await failure(decide(person,doc))).toEqual(NOT_AUTHORIZED);
 expect((await review.queue(person,{projectId:ids.sales})).items[0]).toMatchObject({approverState:'unassigned',eligibility:{canApprove:false}});
 await untouched(doc);
 // applied by the admin: now the member can approve, and the pointer moves exactly once
 await apply(grants('engineer',design));
 expect(await memberships()).toEqual([{project_id:ids.sales,project_role:'engineer',report_permissions:[design]}]);
 expect((await review.queue(person,{projectId:ids.sales})).items[0]).toMatchObject({approverState:'assigned',eligibility:{canApprove:true,reason:null}});
 const detail=await decide(person,doc);
 expect(detail.item.decision).toMatchObject({result:'approved',decidedBy:subject.id,revisionId:doc.revisionId});
 expect(await pointer(doc)).toEqual({approved_revision_id:doc.revisionId,version:doc.version+1});
 expect(await rows('SELECT authority,decided_by FROM review_decisions')).toEqual([{authority:'approval_grant',decided_by:subject.id}]);
 expect(await count('review_events',"kind='review.approved'")).toBe(1);
 // a second decision on the same revision changes nothing
 expect(await failure(decide(person,doc))).toEqual({code:'REVIEW_ALREADY_DECIDED',status:409});
 expect(await pointer(doc)).toEqual({approved_revision_id:doc.revisionId,version:doc.version+1});
 expect(await count('review_decisions')).toBe(1);
});

test('a pending, rejected or expired ballot grants nothing; Chairman agreement alone grants nothing',async()=>{
 const doc=await frozenDoc();
 const person=who();
 const nothing=async()=>{
  expect(await failure(decide(person,doc))).toEqual(NOT_AUTHORIZED);
  await untouched(doc);
  expect((await memberships())[0].report_permissions).toEqual([]);
 };
 // pending, then Chairman agreeing: neither counts for an access-change ballot
 const id=await proposeId(grants('engineer',design));
 await nothing();
 expect(await say(0,id)).toMatchObject({state:'pending',chairmanAgreed:true,bomAgreed:0});
 await nothing();
 await expect(apply(grants('engineer',design))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await nothing();
 // rejected: every BoM seat rejects
 for(const seat of [1,2,3]) await say(seat,id,'reject');
 expect((await rows<{state:string}>('SELECT state FROM identity.account_approvals WHERE id=$1',[id]))[0].state).toBe('rejected');
 await expect(apply(grants('engineer',design))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await nothing();
 // approved but past its deadline: it backs nothing; so does one marked expired
 const late=await proposeId(grants('engineer',design));
 await say(2,late);
 await h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 hour' WHERE id=$1",[late]);
 await expect(apply(grants('engineer',design))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await nothing();
 await h.operator.query("UPDATE identity.account_approvals SET state='expired' WHERE id=$1",[late]);
 await expect(apply(grants('engineer',design))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await nothing();
 // control: a fresh ballot, one BoM agreeing, applied
 await grantThroughBallot(grants('engineer',design));
 expect((await decide(person,doc)).item.decision).toMatchObject({result:'approved'});
});

test('the grant is per document type and per project',async()=>{
 await grantThroughBallot(grants('engineer',design));
 const planDoc=await frozenDoc('plan'),designDoc=await frozenDoc('design'),transportDoc=await frozenDoc('design',ids.transport);
 // the holder's session lists sales only, and the transport document is not in their scope
 const person=who();
 expect(await failure(decide(person,planDoc))).toEqual(NOT_AUTHORIZED);
 await untouched(planDoc);
 expect(await failure(decide(person,transportDoc))).toEqual({code:'SCOPE_DENIED',status:404});
 // even a session that lists the transport project with the role does not reach it: the right lives on the sales membership only
 const wide:Principal={...person,projectIds:[ids.sales,ids.transport],grants:[...person.grants!,{projectId:ids.transport,role:'engineer',reportPermissions:[design]}]};
 expect(await failure(decide(wide,transportDoc))).toMatchObject({code:'APPROVER_NOT_AUTHORIZED'});
 expect(await pointer(transportDoc)).toEqual({approved_revision_id:null,version:transportDoc.version});
 // a plan is not a design: the plan row stays unassigned while the design row is assigned
 const queue=(await review.queue(person,{projectId:ids.sales})).items;
 expect(queue.find(i=>i.documentId===planDoc.docId)).toMatchObject({approverState:'unassigned',eligibility:{canApprove:false}});
 expect(queue.find(i=>i.documentId===designDoc.docId)).toMatchObject({approverState:'assigned',eligibility:{canApprove:true}});
 // the right granted: the design document of sales
 expect((await decide(person,designDoc)).item.decision).toMatchObject({result:'approved'});
 // the plan code is another widening and needs its own ballot
 await expect(apply(grants('engineer',design,plan))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await grantThroughBallot(grants('engineer',design,plan));
 expect((await decide(person,planDoc)).item.decision).toMatchObject({result:'approved'});
});

test('reducing the grant takes effect on the very next decision, also for a principal whose session grants still list it',async()=>{
 await grantThroughBallot(grants('engineer',design));
 const first=await frozenDoc(),second=await frozenDoc();
 const stale=who('engineer',[design]);
 expect((await decide(stale,first)).item.decision).toMatchObject({result:'approved'});
 // the admin reduces directly (no ballot); the principal object below was built before and still lists the code
 const ballots=await count('identity.account_approvals');
 await apply(grants('engineer'));
 expect(await count('identity.account_approvals')).toBe(ballots);
 expect((await memberships())[0].report_permissions).toEqual([]);
 expect(stale.grants![0].reportPermissions).toEqual([design]);
 expect(await failure(decide(stale,second))).toEqual(NOT_AUTHORIZED);
 expect(await count('review_decisions')).toBe(1);
 expect(await pointer(second)).toEqual({approved_revision_id:null,version:second.version});
});

test('the person granted approval still cannot approve their own revision',async()=>{
 await grantThroughBallot(grants('engineer',design));
 const own=await frozenDoc('design',ids.sales,subject.id),others=await frozenDoc('design',ids.sales,member.id);
 const person=who();
 expect(await failure(decide(person,own))).toEqual(NOT_AUTHORIZED);
 expect(await pointer(own)).toEqual({approved_revision_id:null,version:own.version});
 expect((await review.queue(person,{projectId:ids.sales})).items.find(i=>i.documentId===own.docId)).toMatchObject({eligibility:{canApprove:false,reason:'AUTHOR'}});
 // control: the same person approves the same type authored by someone else
 expect((await decide(person,others)).item.decision).toMatchObject({result:'approved'});
});

test("a reviewer designated by a manager gains nothing from someone else's ballot",async()=>{
 // reviewer is designated for design by the manager; the ballot below is for the subject, not for the reviewer
 await delegate(h,ids.sales,reviewer.id,['design']);
 await grantThroughBallot(grants('engineer',design));
 const doc=await frozenDoc();
 expect(await failure(decide(reviewer,doc))).toEqual(NOT_AUTHORIZED);
 await untouched(doc);
 expect(await rows<{report_permissions:string[]}>('SELECT report_permissions FROM identity.memberships WHERE user_id=$1',[reviewer.id])).toEqual([{report_permissions:[]}]);
 // the designation still lets them ask for changes, which is all it ever did
 expect((await decide(reviewer,doc,'changes_requested')).item.decision).toMatchObject({result:'changes_requested',decidedBy:reviewer.id});
 expect(await rows('SELECT authority FROM review_decisions')).toEqual([{authority:'review_delegation'}]);
 expect(await pointer(doc)).toEqual({approved_revision_id:null,version:doc.version});
});

test('the code alone is not enough: a holder whose project role is viewer is not an approver',async()=>{
 await h.operator.query("UPDATE identity.memberships SET project_role='viewer' WHERE user_id=$1",[subject.id]);
 // the ballot adds the code to a person who is a viewer in the project; it is approved and applied
 await grantThroughBallot(grants('viewer',design));
 expect(await memberships()).toEqual([{project_id:ids.sales,project_role:'viewer',report_permissions:[design]}]);
 const doc=await frozenDoc();
 const approversNow=await rows<{user_id:string}>(`SELECT user_id FROM identity.memberships WHERE project_id=$1 AND report_permissions @> ARRAY[$2]::text[]`,[ids.sales,design]);
 expect(approversNow.map(r=>r.user_id)).toEqual([subject.id]); // the ledger carries the code ...
 // ... but the review rows still wait for someone: seen by a manager, the row has no approver
 expect((await review.queue(pm,{projectId:ids.sales})).items.find(i=>i.documentId===doc.docId)).toMatchObject({approverState:'unassigned'});
 // the person cannot approve, whether their session is stale (says engineer) or honest (says viewer)
 expect(await failure(decide(who('engineer',[design]),doc))).toEqual(NOT_AUTHORIZED);
 expect(await failure(decide(who('viewer',[design]),doc))).toEqual({code:'SCOPE_DENIED',status:404});
 await untouched(doc);
 // raising the role is another widening and needs its own ballot
 await expect(apply(grants('engineer',design))).rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await grantThroughBallot(grants('engineer',design));
 expect((await review.queue(pm,{projectId:ids.sales})).items.find(i=>i.documentId===doc.docId)).toMatchObject({approverState:'assigned'});
 expect((await decide(who(),doc)).item.decision).toMatchObject({result:'approved'});
});
