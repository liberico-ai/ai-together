import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {approver,delegate,frozenRevision,grantDocApproval,proposeRev,registerDoc,reviewer,revokeDelegation,seedMembers,transportApprover} from './slice3-fixtures';
import {eligibility,followUpAllowed,threadClosed,isFrozen,revisionDiff,ReviewService,type ReviewItem,type ReviewRevision} from '../src/server/document-review';
import {DocumentService} from '../src/server/documents';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// Slice 3 Task 5: the review queue, the revision detail with its diff, comments, and the decision bound to the exact revision and hash that was read.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const svc=()=>new ReviewService(h.db);
const k=()=>randomUUID();
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const HASH='a1'.repeat(32),HASH2='b2'.repeat(32);
const NOT_FOUND='Không tìm thấy tài liệu trong phạm vi được cấp.';
const CONFLICT='Nguồn đã đổi. Đọc bản mới trước khi gửi lại.';
const docOf=(id:string)=>new DocumentService(h.db).detail(pm,id);

type W={docId:string;revisionId:string;version:number;hash:string|null;title:string};
/** A document of sales registered by pm; its newest revision is proposed by `author` (member by default): frozen by the operator, or self-declared with `hash`. */
async function world(o:{author?:Principal;docType?:string;frozen?:boolean;hash?:string|null}={}):Promise<W> {
 const doc=await registerDoc(h,pm,{projectId:ids.sales,docType:o.docType??'design'});
 const author=o.author??member;
 if(o.frozen===false) await proposeRev(h,author,doc,{sourceHash:o.hash===undefined?HASH:o.hash});
 else await frozenRevision(h,doc.record.id,author.id);
 return {...(await current(doc.record.id)),title:doc.record.title};
}
async function current(docId:string):Promise<Omit<W,'title'>> {
 const r=(await rows<{version:number;latest_revision_id:string;source_hash:string|null}>(
  'SELECT d.version,d.latest_revision_id,v.source_hash FROM document_records d JOIN document_revisions v ON v.id=d.latest_revision_id WHERE d.id=$1',[docId]))[0];
 return {docId,revisionId:r.latest_revision_id,version:r.version,hash:r.source_hash};
}
const dec=(w:W|Omit<W,'title'>,over:R={}):R=>({revisionId:w.revisionId,sourceHash:w.hash,expectedVersion:w.version,result:'changes_requested',scopeNote:'Đã đọc đúng bản này',exceptions:[],...over});
const cmt=(w:W|Omit<W,'title'>,over:R={}):R=>({kind:'comment',revisionId:w.revisionId,anchor:'Mục 1',body:'Cần làm rõ phạm vi',...over});
const decide=(p:Principal,w:W|Omit<W,'title'>,over:R={},key:string=k())=>svc().decide(p,w.docId,dec(w,over),key,k());
const comment=(p:Principal,docId:string,raw:R,key:string=k())=>svc().comment(p,docId,raw,key,k());
/** A comment sent through the service, and the comment that call wrote: found by the request id of the call, never by its place in the answer. The answer lists
 * comments by (createdAt, id); two written within one tick of the clock (PGlite counts whole milliseconds) share createdAt and then come by id, which is random.
 * What «the new comment is the last one» says without the clock is checked here: the list never goes back in time, and nothing in it is later than the new comment. */
const wrote=async(p:Principal,docId:string,raw:R)=>{
 const req=k(),view=await svc().comment(p,docId,raw,k(),req);
 const made=await rows<{id:string}>('SELECT id FROM review_comments WHERE request_id=$1',[req]);
 expect(made).toHaveLength(1);
 const row=view.comments.find(c=>c.id===made[0].id)!;
 expect(row,'the answer holds the comment this call wrote').toBeTruthy();
 const at=view.comments.map(c=>c.createdAt);
 expect(at).toEqual([...at].sort());
 expect(row.createdAt).toBe(at.at(-1));
 return {view,row};
};
const refused=async(p:Promise<unknown>,code:string,status:number)=>{
 const e=await p.then(()=>null,x=>x);
 expect(e,'expected a refusal').toBeTruthy();
 expect(e).toMatchObject({code,status});
 return e as Error;
};
const snap=async(docId:string)=>({decisions:await n('review_decisions'),events:await n('review_events'),comments:await n('review_comments'),commands:await n('document_commands'),
 rec:(await rows('SELECT version,latest_revision_id,approved_revision_id FROM document_records WHERE id=$1',[docId]))[0]});
const itemOf=async(p:Principal,docId:string,projectId=ids.sales):Promise<ReviewItem> => {
 const q=await svc().queue(p,{projectId,limit:200});
 const it=q.items.find(i=>i.documentId===docId);
 expect(it,'document is in the queue').toBeTruthy();
 return it!;
};

describe('document review decisions',()=>{
 test('DOC-06 a source change during review answers REVISION_CONFLICT and the vote is not applied to the new revision',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const r1=await world({frozen:false,hash:null});
  await proposeRev(h,member,await docOf(r1.docId));
  const r2=await current(r1.docId);
  const before=await snap(r1.docId);
  const e=await refused(decide(reviewer,r1),'REVISION_CONFLICT',409);
  expect(e.message).toBe(CONFLICT);
  expect(await snap(r1.docId)).toEqual(before);
  expect(before.decisions).toBe(0);expect(before.rec.approved_revision_id).toBeNull();
  const ok=await decide(reviewer,r2);
  expect(ok.item.decision).toMatchObject({result:'changes_requested',revisionId:r2.revisionId});
  expect(await rows('SELECT document_revision_id FROM review_decisions')).toEqual([{document_revision_id:r2.revisionId}]);
 });

 test('(3) an old vote cannot land on a newer revision: stale revision id, stale hash and stale version are each refused',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world({frozen:false,hash:HASH});
  await proposeRev(h,member,await docOf(w.docId),{sourceHash:HASH2});
  const w2=await current(w.docId);
  const before=await snap(w.docId);
  await refused(decide(reviewer,w,{expectedVersion:w2.version}),'REVISION_CONFLICT',409);                 // stale revision id
  await refused(decide(reviewer,w2,{sourceHash:HASH}),'REVISION_CONFLICT',409);                           // stale hash
  await refused(decide(reviewer,w2,{sourceHash:null}),'REVISION_CONFLICT',409);                           // hash dropped
  await refused(decide(reviewer,w2,{expectedVersion:w2.version-1}),'REVISION_CONFLICT',409);              // stale version
  await refused(decide(reviewer,w2,{expectedVersion:w2.version+1}),'REVISION_CONFLICT',409);              // version from the future
  expect(await snap(w.docId)).toEqual(before);
 });

 test('(1) DOC-08 the author cannot decide the own revision, with a review delegation or with the approval grant',async()=>{
  await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
  const a=await world({author:reviewer}),b=await world({author:approver});
  for(const [w,p,result] of [[a,reviewer,'changes_requested'],[b,approver,'approved'],[b,approver,'changes_requested']] as [W,Principal,string][]) {
   const before=await snap(w.docId);
   await refused(decide(p,w,{result}),'APPROVER_NOT_AUTHORIZED',403);
   expect(await snap(w.docId)).toEqual(before);
  }
 });

 test('DOC-08 a member without any authority, and a holder outside the document type, are refused',async()=>{
  await delegate(h,ids.sales,reviewer.id,['plan']);await grantDocApproval(h,approver.id,ids.sales,['plan']);
  const w=await world();
  const before=await snap(w.docId);
  for(const [p,result] of [[member,'changes_requested'],[reviewer,'changes_requested'],[approver,'changes_requested'],[approver,'approved'],[pm,'changes_requested']] as [Principal,string][]) {
   const e=await refused(decide(p,w,{result}),'APPROVER_NOT_AUTHORIZED',403);
   for(const secret of [w.title,member.name,reviewer.name,approver.name,pm.name,'design']) expect(e.message).not.toContain(secret);
  }
  expect(await snap(w.docId)).toEqual(before);
 });

 test('a reviewer cannot use the review delegation to approve a baseline',async()=>{
  const delegationId=await delegate(h,ids.sales,reviewer.id);
  const w=await world();
  const before=await snap(w.docId);
  await refused(decide(reviewer,w,{result:'approved'}),'APPROVER_NOT_AUTHORIZED',403);
  expect(await snap(w.docId)).toEqual(before);
  expect(before.decisions).toBe(0);expect(before.rec.approved_revision_id).toBeNull();
  const ok=await decide(reviewer,w);
  expect(ok.item.decision).toMatchObject({result:'changes_requested',decidedBy:reviewer.id});
  expect(await rows('SELECT authority,delegation_id FROM review_decisions')).toEqual([{authority:'review_delegation',delegation_id:delegationId}]);
  expect((await snap(w.docId)).rec.approved_revision_id).toBeNull();
 });

 test('the approval grant covers comment and changes_requested for its document types and nothing outside them',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const inside=await world(),outside=await world({docType:'plan'});
  const c=await comment(approver,inside.docId,cmt(inside));
  expect(c.comments.map(x=>x.actorId)).toEqual([approver.id]);
  const d=await decide(approver,inside);
  expect(d.item.decision?.result).toBe('changes_requested');
  expect(await rows('SELECT authority,delegation_id FROM review_decisions')).toEqual([{authority:'approval_grant',delegation_id:null}]);
  const before=await snap(outside.docId);
  await refused(comment(approver,outside.docId,cmt(outside)),'APPROVER_NOT_AUTHORIZED',403);
  await refused(decide(approver,outside),'APPROVER_NOT_AUTHORIZED',403);
  await refused(decide(approver,outside,{result:'approved'}),'APPROVER_NOT_AUTHORIZED',403);
  expect(await snap(outside.docId)).toEqual(before);
 });

 test('(5) an approver of project A cannot see or decide a document of project B; the answer equals the one for an unknown id',async()=>{
  await grantDocApproval(h,transportApprover.id,ids.transport,['design']);await delegate(h,ids.sales,reviewer.id);
  const w=await world();
  const transportDoc=await registerDoc(h,pm,{projectId:ids.transport});
  const unknown=await refused(svc().detail(reviewer,randomUUID()),'SCOPE_DENIED',404);
  expect(unknown.message).toBe(NOT_FOUND);
  const before=await snap(w.docId);
  const calls=(p:Principal,docId:string,w2:W)=>[()=>svc().detail(p,docId),()=>decide(p,w2,{}),()=>comment(p,docId,cmt(w2))];
  for(const p of [transportApprover,outsider]) for(const call of calls(p,w.docId,w)) {
   const e=await refused(call(),'SCOPE_DENIED',404);
   expect(e.message).toBe(unknown.message);expect(e.message).not.toContain(w.title);
  }
  // viewer and bot are scoped to transport, where the document exists: refused by role with the same sentence
  const tw:W={docId:transportDoc.record.id,revisionId:randomUUID(),version:1,hash:null,title:transportDoc.record.title};
  const salesViewer:Principal={...reviewer,grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
  for(const [p,docId,w2] of [[viewer,tw.docId,tw],[bot,tw.docId,tw],[salesViewer,w.docId,w]] as [Principal,string,W][]) for(const call of calls(p,docId,w2)) {
   const e=await refused(call(),'SCOPE_DENIED',404);
   expect(e.message).toBe(unknown.message);expect(e.message).not.toContain(w2.title);
  }
  expect(await snap(w.docId)).toEqual(before);
  await refused(svc().queue(transportApprover,{projectId:ids.sales}),'SCOPE_DENIED',404);
  await refused(svc().queue(bot,{projectId:ids.transport}),'SCOPE_DENIED',404);
  await refused(svc().queue(viewer,{projectId:ids.transport}),'SCOPE_DENIED',404);
 });

 test('(6) resending the same decision with the same key stores one decision; the same key with other content conflicts',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world();
  const key=k();
  const first=await decide(reviewer,w,{},key);
  const again=await decide(reviewer,w,{},key);
  expect(again).toEqual(first);
  expect(await n('review_decisions')).toBe(1);expect(await n('review_events')).toBe(1);
  await refused(decide(reviewer,w,{scopeNote:'Một ghi chú phạm vi khác hẳn'},key),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('review_decisions')).toBe(1);expect(await n('review_events')).toBe(1);
 });

 test('approving an unfrozen revision answers SOURCE_NOT_FROZEN and writes nothing; requesting changes on it is stored',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const w=await world({frozen:false,hash:HASH});
  const before=await snap(w.docId);
  await refused(decide(approver,w,{result:'approved'}),'SOURCE_NOT_FROZEN',409);
  expect(await snap(w.docId)).toEqual(before);
  const ok=await decide(approver,w);
  expect(ok.item.decision?.result).toBe('changes_requested');
  expect(ok.item.revision.frozen).toBe(false);
  expect((await snap(w.docId)).rec.approved_revision_id).toBeNull();
 });

 test('approval of a frozen synthetic revision moves the approved pointer once, bumps the version and writes one event',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const w=await world();
  const before=await snap(w.docId);
  const out=await decide(approver,w,{result:'approved',exceptions:['Chưa có phụ lục B','Chưa có phụ lục C']});
  expect(out.item.decision).toMatchObject({result:'approved',revisionId:w.revisionId,revisionHash:w.hash,exceptions:['Chưa có phụ lục B','Chưa có phụ lục C']});
  expect(out.item.approvedRevisionId).toBe(w.revisionId);expect(out.item.recordVersion).toBe(w.version+1);
  const doc=await docOf(w.docId);
  expect(doc.record.approved_revision_id).toBe(w.revisionId);expect(doc.record.latest_revision_id).toBe(w.revisionId);expect(doc.record.version).toBe(w.version+1);
  const after=await snap(w.docId);
  expect(after.decisions).toBe(before.decisions+1);expect(after.events).toBe(before.events+1);
  const ev=(await rows<{kind:string;entity_type:string;actor_id:string;payload:R}>('SELECT kind,entity_type,actor_id,payload FROM review_events'))[0];
  const decisionId=(await rows<{id:string}>('SELECT id FROM review_decisions'))[0].id;
  expect(ev).toMatchObject({kind:'review.approved',entity_type:'review_decision',actor_id:approver.id,payload:{decisionId,revisionId:w.revisionId,versionBefore:w.version,versionAfter:w.version+1}});
  expect(JSON.stringify(ev.payload)).not.toContain('Chưa có phụ lục');
  // a newer proposal does not move the baseline (DOC-07)
  await proposeRev(h,member,doc);
  const later=await docOf(w.docId);
  expect(later.record.approved_revision_id).toBe(w.revisionId);expect(later.record.latest_revision_id).not.toBe(w.revisionId);
 });

 test('a second decision on the same revision answers REVIEW_ALREADY_DECIDED in either order',async()=>{
  await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
  const a=await world();
  await decide(approver,a,{result:'approved'});
  const sa=await snap(a.docId);
  await refused(decide(reviewer,a),'REVIEW_ALREADY_DECIDED',409);
  await refused(decide(approver,a,{result:'approved'}),'REVIEW_ALREADY_DECIDED',409);
  await refused(decide(approver,a,{},k()),'REVIEW_ALREADY_DECIDED',409);
  expect(await snap(a.docId)).toEqual(sa);
  const b=await world();
  await decide(reviewer,b);
  const sb=await snap(b.docId);
  await refused(decide(approver,b,{result:'approved'}),'REVIEW_ALREADY_DECIDED',409);
  await refused(decide(approver,b),'REVIEW_ALREADY_DECIDED',409);
  expect(await snap(b.docId)).toEqual(sb);
  expect(await n('review_decisions')).toBe(2);
 });

 test('authority lost before the click refuses the decision and writes nothing',async()=>{
  const delegationId=await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
  const w=await world(),w2=await world({author:pm});
  const before=await snap(w.docId);
  await revokeDelegation(h,delegationId);
  await refused(decide(reviewer,w),'APPROVER_NOT_AUTHORIZED',403);
  // the session still carries the code; the service reads the database
  const stale:Principal={...approver,grants:[{projectId:ids.sales,role:'business',reportPermissions:['doc_approve:design']}]};
  await h.operator.query("UPDATE identity.memberships SET report_permissions='{}' WHERE user_id=$1",[approver.id]);
  await refused(decide(stale,w,{result:'approved'}),'APPROVER_NOT_AUTHORIZED',403);
  await refused(decide(stale,w),'APPROVER_NOT_AUTHORIZED',403);
  // a delegate who is no longer a member of the project
  await delegate(h,ids.sales,member.id);
  await h.operator.query('DELETE FROM identity.memberships WHERE user_id=$1 AND project_id=$2',[member.id,ids.sales]);
  await refused(decide(member,w2),'APPROVER_NOT_AUTHORIZED',403);
  // no project left in the session: out of scope
  await refused(decide({...reviewer,projectIds:[ids.transport]},w),'SCOPE_DENIED',404);
  expect(await snap(w.docId)).toEqual(before);
 });

 test('a revision without hash accepts changes_requested with sourceHash null; a document without revisions is not queued and a decision on it conflicts',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world({frozen:false,hash:null});
  const out=await decide(reviewer,w,{sourceHash:null});
  expect(out.item.decision?.revisionHash).toBeNull();
  expect(await rows('SELECT revision_hash FROM review_decisions')).toEqual([{revision_hash:null}]);
  const empty=await registerDoc(h,pm);
  const q=await svc().queue(reviewer,{projectId:ids.sales});
  expect(q.items.map(i=>i.documentId)).toEqual([w.docId]);expect(q.total).toBe(1);
  const before=await snap(empty.record.id);
  await refused(svc().decide(reviewer,empty.record.id,dec({docId:empty.record.id,revisionId:randomUUID(),version:1,hash:null}),k(),k()),'REVISION_CONFLICT',409);
  await refused(svc().detail(reviewer,empty.record.id),'NO_REVISION',409);
  expect(await snap(empty.record.id)).toEqual(before);
 });

 test('a failed decision leaves no decision, no event and no version change',async()=>{
  await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
  const used=k();
  await decide(reviewer,await world(),{},used);
  let sibling=''; // a real, frozen revision of another document of the same project
  const cases:{name:string;prepare:()=>Promise<W>;call:(w:W)=>Promise<unknown>;code:string;status:number}[]=[
   {name:'stale version',prepare:()=>world(),call:w=>decide(reviewer,w,{expectedVersion:w.version+3}),code:'REVISION_CONFLICT',status:409},
   {name:'foreign revision id',prepare:()=>world(),call:w=>decide(reviewer,w,{revisionId:randomUUID()}),code:'REVISION_CONFLICT',status:409},
   {name:'revision of another document of the same project',prepare:async()=>{sibling=(await world()).revisionId;return world();},call:w=>decide(reviewer,w,{revisionId:sibling}),code:'REVISION_CONFLICT',status:409},
   {name:'no authority',prepare:()=>world(),call:w=>decide(member,w),code:'APPROVER_NOT_AUTHORIZED',status:403},
   {name:'author',prepare:()=>world({author:reviewer}),call:w=>decide(reviewer,w),code:'APPROVER_NOT_AUTHORIZED',status:403},
   {name:'delegate approves',prepare:()=>world(),call:w=>decide(reviewer,w,{result:'approved'}),code:'APPROVER_NOT_AUTHORIZED',status:403},
   {name:'already decided',prepare:async()=>{const w=await world();await decide(reviewer,w);return w;},call:w=>decide(approver,w),code:'REVIEW_ALREADY_DECIDED',status:409},
   {name:'not frozen',prepare:()=>world({frozen:false}),call:w=>decide(approver,w,{result:'approved'}),code:'SOURCE_NOT_FROZEN',status:409},
   {name:'key reused for other content',prepare:()=>world(),call:w=>decide(reviewer,w,{},used),code:'IDEMPOTENCY_CONFLICT',status:409},
   {name:'key malformed',prepare:()=>world(),call:w=>decide(reviewer,w,{},'x'),code:'IDEMPOTENCY_REQUIRED',status:400},
  ];
  for(const c of cases) {
   const w=await c.prepare();
   const before=await snap(w.docId);
   await refused(c.call(w),c.code,c.status);
   expect(await snap(w.docId),c.name).toEqual(before);
  }
 });

 test('document approval does not touch work, evidence or acceptance',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['design']);await delegate(h,ids.sales,reviewer.id);
  const w=await world();
  const fingerprint=async()=>({work:await n('work_items'),evidence:await n('evidence'),audit:await n('audit_events'),
   digest:(await rows<{d:string}>("SELECT md5(coalesce(string_agg(w::text,',' ORDER BY id),'')) d FROM work_items w"))[0].d});
  const before=await fingerprint();
  expect(before.work).toBeGreaterThan(0);
  await comment(reviewer,w.docId,cmt(w));
  await decide(approver,w,{result:'approved'});
  expect(await fingerprint()).toEqual(before);
 });
});

describe('document review queue, detail and diff',()=>{
 test('queue shows Chờ xác định người duyệt state when nobody but the author holds the approval grant for the type, and eligibility explains why the viewer cannot act',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world();                                   // nobody holds the grant
  expect((await itemOf(pm,w.docId)).approverState).toBe('unassigned');
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const mine=await world({author:approver});                // only the author holds it
  expect((await itemOf(pm,mine.docId)).approverState).toBe('unassigned');
  expect((await itemOf(pm,w.docId)).approverState).toBe('assigned');
  // the holder's project role is viewer: not counted (S51)
  await h.operator.query("UPDATE identity.memberships SET project_role='viewer' WHERE user_id=$1 AND project_id=$2",[approver.id,ids.sales]);
  expect((await itemOf(pm,w.docId)).approverState).toBe('unassigned');
  await h.operator.query("UPDATE identity.memberships SET project_role='business' WHERE user_id=$1 AND project_id=$2",[approver.id,ids.sales]);
  expect((await itemOf(pm,w.docId)).approverState).toBe('assigned');
  // reasons the viewer cannot act
  expect((await itemOf(approver,mine.docId)).eligibility).toEqual({canComment:false,canRequestChanges:false,canApprove:false,reason:'AUTHOR'});
  expect((await itemOf(member,w.docId)).eligibility).toEqual({canComment:false,canRequestChanges:false,canApprove:false,reason:'AUTHOR'});
  expect((await itemOf(pm,w.docId)).eligibility).toEqual({canComment:false,canRequestChanges:false,canApprove:false,reason:'NO_DELEGATION'});
  expect((await itemOf(reviewer,w.docId)).eligibility).toEqual({canComment:true,canRequestChanges:true,canApprove:false,reason:'REVIEW_ONLY'});
  expect((await itemOf(approver,w.docId)).eligibility).toEqual({canComment:true,canRequestChanges:true,canApprove:true,reason:null});
  const plan=await world({docType:'plan'});
  expect((await itemOf(reviewer,plan.docId)).eligibility.reason).toBe('TYPE_NOT_COVERED');
  const unfrozen=await world({frozen:false});
  expect((await itemOf(approver,unfrozen.docId)).eligibility).toEqual({canComment:true,canRequestChanges:true,canApprove:false,reason:'NOT_FROZEN'});
  await decide(reviewer,w);
  const after=await itemOf(approver,w.docId);
  expect(after.eligibility).toEqual({canComment:false,canRequestChanges:false,canApprove:false,reason:'ALREADY_DECIDED'});
  expect(after.decision?.decidedBy).toBe(reviewer.id);
 });

 test('eligibility() answers the six reasons in table order',()=>{
  const base={actorId:'a',proposedBy:'b',docType:'design' as const,frozen:true,decided:false,reviewTypes:null as string[]|null,approveTypes:[] as string[]};
  const no={canComment:false,canRequestChanges:false,canApprove:false};
  expect(eligibility({...base,decided:true,actorId:'b',approveTypes:['design']})).toEqual({...no,reason:'ALREADY_DECIDED'});
  expect(eligibility({...base,actorId:'b',reviewTypes:['design'],approveTypes:['design']})).toEqual({...no,reason:'AUTHOR'});
  expect(eligibility(base)).toEqual({...no,reason:'NO_DELEGATION'});
  expect(eligibility({...base,reviewTypes:['plan']})).toEqual({...no,reason:'TYPE_NOT_COVERED'});
  expect(eligibility({...base,approveTypes:['plan','guide']})).toEqual({...no,reason:'TYPE_NOT_COVERED'});
  expect(eligibility({...base,reviewTypes:['design']})).toEqual({canComment:true,canRequestChanges:true,canApprove:false,reason:'REVIEW_ONLY'});
  expect(eligibility({...base,reviewTypes:['design'],approveTypes:['plan']})).toEqual({canComment:true,canRequestChanges:true,canApprove:false,reason:'REVIEW_ONLY'});
  expect(eligibility({...base,approveTypes:['plan','design'],frozen:false})).toEqual({canComment:true,canRequestChanges:true,canApprove:false,reason:'NOT_FROZEN'});
  expect(eligibility({...base,approveTypes:['plan','design'],reviewTypes:['design']})).toEqual({canComment:true,canRequestChanges:true,canApprove:true,reason:null});
  expect(eligibility({...base,approveTypes:['design','plan']})).toEqual(eligibility({...base,approveTypes:['plan','design']}));
 });

 test('the queue lists the latest revision of each document once, also after it was decided, and never an older revision',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world({frozen:false});
  const other=await world({frozen:false});
  await registerDoc(h,pm);                                   // no revision: not queued
  const r1=w.revisionId;
  await decide(reviewer,w);
  let q=await svc().queue(reviewer,{projectId:ids.sales});
  expect(q.total).toBe(2);
  const first=q.items.filter(i=>i.documentId===w.docId);
  expect(first).toHaveLength(1);
  expect(first[0].revision.id).toBe(r1);expect(first[0].decision).toMatchObject({result:'changes_requested',revisionId:r1});expect(first[0].eligibility.reason).toBe('ALREADY_DECIDED');
  await proposeRev(h,member,await docOf(w.docId));
  q=await svc().queue(reviewer,{projectId:ids.sales});
  const second=q.items.filter(i=>i.documentId===w.docId);
  expect(second).toHaveLength(1);expect(q.items).toHaveLength(2);
  expect(second[0].revision.id).not.toBe(r1);expect(second[0].revision.revisionNo).toBe(2);expect(second[0].decision).toBeNull();
  expect(second[0].eligibility.reason).toBe('REVIEW_ONLY');
  // paging is stable and total is the whole list
  const p1=await svc().queue(reviewer,{projectId:ids.sales,limit:1,offset:0}),p2=await svc().queue(reviewer,{projectId:ids.sales,limit:1,offset:1});
  expect(p1.total).toBe(2);expect(new Set([p1.items[0].documentId,p2.items[0].documentId])).toEqual(new Set([w.docId,other.docId]));
  await expect(svc().queue(reviewer,{projectId:ids.sales,limit:201})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().queue(reviewer,{projectId:ids.sales,offset:-1})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().queue(reviewer,{projectId:ids.sales,limit:5,extra:1})).rejects.toBeInstanceOf(ZodError);
 });

 test('detail returns the base, the diff and the comments of the document, with ids and no names',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const doc=await registerDoc(h,pm);
  const r1doc=await proposeRev(h,member,doc,{changes:{summary:'Bản đầu tiên của tài liệu',present:['Mục A'],missing:['Mục B']},sourceRevision:'rev-1',sourceHash:HASH});
  await proposeRev(h,member,r1doc,{changes:{summary:'Bản thứ hai của tài liệu',present:['Mục A','Mục B'],missing:[]},sourceRevision:'rev-2',sourceHash:HASH2});
  const w=await current(doc.record.id);
  await comment(reviewer,w.docId,cmt(w,{body:'<b>đậm</b> & "trích"'}));
  const d=await svc().detail(reviewer,w.docId);
  expect(d.item.revision).toMatchObject({revisionNo:2,sourceHash:HASH2,hashVerification:'self_declared',frozen:false,proposedBy:member.id});
  expect(d.base?.revisionNo).toBe(1);                      // no approved baseline: the revision this one is based on
  expect(d.diff).toEqual([
   {field:'summary',change:'modified',before:'Bản đầu tiên của tài liệu',after:'Bản thứ hai của tài liệu'},
   {field:'present',change:'added',before:null,after:'Mục B'},
   {field:'missing',change:'removed',before:'Mục B',after:null},
   {field:'source_revision',change:'modified',before:'rev-1',after:'rev-2'},
   {field:'source_hash',change:'modified',before:HASH,after:HASH2},
  ]);
  expect(d.comments).toHaveLength(1);expect(d.comments[0]).toMatchObject({kind:'comment',parentId:null,body:'<b>đậm</b> & "trích"',actorId:reviewer.id,revisionId:w.revisionId,anchor:'Mục 1'});
  expect(JSON.stringify(d)).not.toContain(reviewer.name);expect(JSON.stringify(d)).not.toContain('snapshot_ref');
 });

 test('revisionDiff compares summary, list elements, source refs by kind:label:value, revision and hash',()=>{
  const rev=(o:Partial<ReviewRevision>):ReviewRevision=>({id:randomUUID(),revisionNo:1,basedOnRevisionId:null,sourceRevision:null,sourceHash:null,hashVerification:'self_declared',frozen:false,
   changes:{summary:'Tóm tắt',present:[],missing:[]},sourceRefs:[],proposedBy:randomUUID(),createdAt:new Date().toISOString(),...o});
  const ref=(value:string)=>({kind:'url' as const,label:'Nhãn',value});
  const base=rev({changes:{summary:'Bản cũ',present:['a','b'],missing:['x']},sourceRefs:[ref('https://x.example')],sourceRevision:'r1',sourceHash:'h1'});
  const cand=rev({changes:{summary:'Bản mới',present:['b','c'],missing:[]},sourceRefs:[ref('https://y.example')],sourceRevision:'r2',sourceHash:'h1'});
  expect(revisionDiff(base,cand)).toEqual([
   {field:'summary',change:'modified',before:'Bản cũ',after:'Bản mới'},
   {field:'present',change:'removed',before:'a',after:null},{field:'present',change:'added',before:null,after:'c'},
   {field:'missing',change:'removed',before:'x',after:null},
   {field:'source_refs',change:'removed',before:'url:Nhãn:https://x.example',after:null},{field:'source_refs',change:'added',before:null,after:'url:Nhãn:https://y.example'},
   {field:'source_revision',change:'modified',before:'r1',after:'r2'},
  ]);
  expect(revisionDiff(base,base)).toEqual([]);
  const first=revisionDiff(null,rev({changes:{summary:'Bản đầu',present:['a'],missing:[]},sourceHash:'h9'}));
  expect(first).toEqual([{field:'summary',change:'added',before:null,after:'Bản đầu'},{field:'present',change:'added',before:null,after:'a'},{field:'source_hash',change:'added',before:null,after:'h9'}]);
  expect(isFrozen({snapshot_ref:'s',hash_verification:'verified',source_hash:'h'})).toBe(true);
  expect(isFrozen({snapshot_ref:null,hash_verification:'verified',source_hash:'h'})).toBe(false);
  expect(isFrozen({snapshot_ref:'s',hash_verification:'self_declared',source_hash:'h'})).toBe(false);
  expect(isFrozen({snapshot_ref:'s',hash_verification:'verified',source_hash:null})).toBe(false);
 });
});

describe('document review comments',()=>{
 test('comments are tied to the latest revision; addressed and resolved follow their roles; bodies keep markup as plain text and reject 2001 characters',async()=>{
  await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
  const w=await world({frozen:false});
  const markup='<img src=x onerror=alert(1)> **không** hiểu';
  const c=await comment(reviewer,w.docId,cmt(w,{body:markup}));
  expect(c.comments[0].body).toBe(markup);
  expect(await rows('SELECT body,kind,parent_id FROM review_comments')).toEqual([{body:markup,kind:'comment',parent_id:null}]);
  await comment(reviewer,w.docId,cmt(w,{body:'x'.repeat(2000),anchor:'y'.repeat(200)}));
  await expect(comment(reviewer,w.docId,cmt(w,{body:'x'.repeat(2001)}))).rejects.toBeInstanceOf(ZodError);
  await expect(comment(reviewer,w.docId,cmt(w,{body:''}))).rejects.toBeInstanceOf(ZodError);
  await expect(comment(reviewer,w.docId,cmt(w,{anchor:'y'.repeat(201)}))).rejects.toBeInstanceOf(ZodError);
  const rootId=c.comments[0].id;
  // addressed: the author of the revision the comment sits on, or a project manager; nobody else
  await refused(comment(approver,w.docId,{kind:'addressed',parentId:rootId,body:'Đã sửa xong'}),'APPROVER_NOT_AUTHORIZED',403);
  await refused(comment(reviewer,w.docId,{kind:'addressed',parentId:rootId,body:'Đã sửa xong'}),'APPROVER_NOT_AUTHORIZED',403);
  const a1=await wrote(member,w.docId,{kind:'addressed',parentId:rootId,body:'Đã sửa xong'});
  const a2=await wrote(pm,w.docId,{kind:'addressed',parentId:rootId,body:'Điều phối ghi đã sửa'});
  expect(a1.row).toMatchObject({kind:'addressed',parentId:rootId,actorId:member.id,anchor:''});
  expect(a2.row).toMatchObject({kind:'addressed',actorId:pm.id});
  // resolved: the writer of the root comment, or a holder of an authority for the type; not the author, not a bystander
  await refused(comment(member,w.docId,{kind:'resolved',parentId:rootId,body:'Tôi tự đóng'}),'APPROVER_NOT_AUTHORIZED',403);
  await refused(comment(pm,w.docId,{kind:'resolved',parentId:rootId,body:'Điều phối tự đóng'}),'APPROVER_NOT_AUTHORIZED',403);
  await comment(reviewer,w.docId,{kind:'resolved',parentId:rootId,body:'Đã xác nhận'});
  // a thread closed by `resolved` takes no further follow-up (COMMENT_RESOLVED, round-1 fix of the Codex gate): the approver's confirmation is refused
  await refused(comment(approver,w.docId,{kind:'resolved',parentId:rootId,body:'Người duyệt xác nhận'}),'COMMENT_RESOLVED',409);
  expect(await n('review_comments')).toBe(5);expect(await n('review_events')).toBe(5);
  // a new comment must name the latest revision
  const old=await current(w.docId);
  await proposeRev(h,member,await docOf(w.docId));
  const before=await snap(w.docId);
  const e=await refused(comment(reviewer,w.docId,cmt(old)),'REVISION_CONFLICT',409);
  expect(e.message).toBe(CONFLICT);
  await refused(comment(reviewer,w.docId,cmt(old,{revisionId:randomUUID()})),'REVISION_CONFLICT',409);
  expect(await snap(w.docId)).toEqual(before);
  await comment(reviewer,w.docId,cmt(await current(w.docId)));
 });

 test('a reply is stored on the revision of the comment it answers',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world({frozen:false});
  const other=await world({frozen:false});
  const root=(await comment(reviewer,w.docId,cmt(w))).comments[0];
  const foreign=(await comment(reviewer,other.docId,cmt(other))).comments[0];
  await proposeRev(h,member,await docOf(w.docId));
  const reply=await wrote(member,w.docId,{kind:'addressed',parentId:root.id,body:'Đã sửa ở bản mới'});
  expect(reply.row).toMatchObject({kind:'addressed',revisionId:w.revisionId});
  expect((await rows<{document_revision_id:string}>("SELECT document_revision_id FROM review_comments WHERE kind='addressed'"))[0].document_revision_id).toBe(w.revisionId);
  const replyId=reply.row.id;
  const before=await snap(w.docId);
  for(const parentId of [foreign.id,randomUUID(),replyId]) {
   const e=await refused(comment(member,w.docId,{kind:'addressed',parentId,body:'Đã sửa'}),'SCOPE_DENIED',404);
   expect(e.message).toBe(NOT_FOUND);
  }
  expect(await snap(w.docId)).toEqual(before);
 });

 test('a member without authority who comments is answered APPROVER_NOT_AUTHORIZED, and nothing is stored',async()=>{
  const outsideType=await delegate(h,ids.sales,reviewer.id,['plan']);
  const w=await world({author:pm});
  const before=await snap(w.docId);
  // no delegation at all; a delegation that does not name the type
  await refused(comment(member,w.docId,cmt(w)),'APPROVER_NOT_AUTHORIZED',403);
  await refused(comment(reviewer,w.docId,cmt(w)),'APPROVER_NOT_AUTHORIZED',403);
  // a revoked delegation
  await revokeDelegation(h,outsideType);
  const live=await delegate(h,ids.sales,reviewer.id,['design']);
  await comment(reviewer,w.docId,cmt(w));
  await revokeDelegation(h,live);
  const mid=await snap(w.docId);
  await refused(comment(reviewer,w.docId,cmt(w)),'APPROVER_NOT_AUTHORIZED',403);
  expect(await snap(w.docId)).toEqual(mid);
  expect(before.comments).toBe(0);expect(mid.comments).toBe(1);
  // addressed by a non-author, non-manager; resolved by someone who neither wrote the root nor holds an authority
  const root=(await rows<{id:string}>('SELECT id FROM review_comments'))[0].id;
  const s=await snap(w.docId);
  await refused(comment(reviewer,w.docId,{kind:'addressed',parentId:root,body:'Tôi đã sửa'}),'APPROVER_NOT_AUTHORIZED',403);
  await refused(comment(member,w.docId,{kind:'resolved',parentId:root,body:'Tôi đóng nhé'}),'APPROVER_NOT_AUTHORIZED',403);
  expect(await snap(w.docId)).toEqual(s);
 });

 test('on a decided revision a new comment answers REVIEW_ALREADY_DECIDED, while addressed and resolved on an existing comment are still stored',async()=>{
  await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
  for(const result of ['approved','changes_requested'] as const) {
   const w=await world();
   const root=(await comment(reviewer,w.docId,cmt(w))).comments[0];
   await decide(approver,w,{result});
   const it=await itemOf(reviewer,w.docId);
   expect(it.eligibility.canComment).toBe(false);expect(it.eligibility.reason).toBe('ALREADY_DECIDED');
   const cur=await current(w.docId);
   const before=await snap(w.docId);
   await refused(comment(reviewer,w.docId,cmt(cur)),'REVIEW_ALREADY_DECIDED',409);
   expect(await snap(w.docId)).toEqual(before);
   await comment(member,w.docId,{kind:'addressed',parentId:root.id,body:`Đã sửa sau ${result}`});
   await comment(reviewer,w.docId,{kind:'resolved',parentId:root.id,body:`Xác nhận sau ${result}`});
   expect((await snap(w.docId)).comments).toBe(before.comments+2);
  }
 });
});

describe('document review input',()=>{
 test('ids in any letter case mean the same record, and text PostgreSQL cannot store is refused as input',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world({frozen:false});
  const up=(s:string)=>s.toUpperCase();
  const root=(await comment(reviewer,up(w.docId),cmt(w,{revisionId:up(w.revisionId)}))).comments[0];
  expect(root.revisionId).toBe(w.revisionId);
  await comment(member,up(w.docId),{kind:'addressed',parentId:up(root.id),body:'Đã sửa'});
  const out=await svc().decide(reviewer,up(w.docId),dec(w,{revisionId:up(w.revisionId)}),k(),k());
  expect(out.item.decision?.revisionId).toBe(w.revisionId);
  expect((await svc().detail(reviewer,up(w.docId))).item.documentId).toBe(w.docId);
  const w2=await world({frozen:false});
  const before=await snap(w2.docId);
  const bad=['\u0000','a\u0000b','\ud800','a\udc00b','x\ud83d'];
  for(const text of bad) {
   await expect(comment(reviewer,w2.docId,cmt(w2,{body:text}))).rejects.toBeInstanceOf(ZodError);
   await expect(comment(reviewer,w2.docId,cmt(w2,{anchor:text}))).rejects.toBeInstanceOf(ZodError);
   await expect(decide(reviewer,w2,{scopeNote:`Ghi chú ${text} phạm vi`})).rejects.toBeInstanceOf(ZodError);
   await expect(decide(reviewer,w2,{exceptions:[text]})).rejects.toBeInstanceOf(ZodError);
  }
  await expect(decide(reviewer,w2,{scopeNote:'      '})).rejects.toBeInstanceOf(ZodError);
  await expect(decide(reviewer,w2,{scopeNote:'abcd'})).rejects.toBeInstanceOf(ZodError);
  await expect(decide(reviewer,w2,{exceptions:Array.from({length:11},()=>'ngoại lệ')})).rejects.toBeInstanceOf(ZodError);
  await expect(decide(reviewer,w2,{exceptions:['']})).rejects.toBeInstanceOf(ZodError);
  await expect(decide(reviewer,w2,{exceptions:['x'.repeat(301)]})).rejects.toBeInstanceOf(ZodError);
  await expect(decide(reviewer,w2,{exceptions:Array.from({length:10},()=>'\u0001'.repeat(300))})).rejects.toBeInstanceOf(ZodError);
  await expect(decide(reviewer,w2,{sourceHash:'A1'.repeat(32)})).rejects.toBeInstanceOf(ZodError);
  await expect(decide(reviewer,w2,{expectedVersion:0})).rejects.toBeInstanceOf(ZodError);
  await expect(decide(reviewer,w2,{result:'published'})).rejects.toBeInstanceOf(ZodError);
  expect(await snap(w2.docId)).toEqual(before);
  // other control characters are stored as plain text
  const ok=await decide(reviewer,w2,{exceptions:['dòng\u0001điều khiển']});
  expect(ok.item.decision?.exceptions).toEqual(['dòng\u0001điều khiển']);
 });

 test('forged fields are rejected',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world({frozen:false});
  const before=await snap(w.docId);
  const forged:R[]=[{decidedBy:pm.id},{actorId:pm.id},{delegationId:randomUUID()},{authority:'approval_grant'},{tenantId:ids.otherTenant},{projectId:ids.transport}];
  for(const f of forged) {
   await expect(decide(reviewer,w,f)).rejects.toBeInstanceOf(ZodError);
   await expect(comment(reviewer,w.docId,cmt(w,f))).rejects.toBeInstanceOf(ZodError);
  }
  const root=(await comment(reviewer,w.docId,cmt(w))).comments[0];
  for(const f of forged) await expect(comment(member,w.docId,{kind:'addressed',parentId:root.id,body:'Đã sửa',...f})).rejects.toBeInstanceOf(ZodError);
  await expect(comment(member,w.docId,{kind:'addressed',parentId:root.id,revisionId:w.revisionId,body:'Đã sửa'})).rejects.toBeInstanceOf(ZodError);
  await expect(comment(reviewer,w.docId,{...cmt(w),kind:'approved'})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().decide(reviewer,w.docId,dec(w),k(),'not-a-uuid')).rejects.toBeInstanceOf(ZodError);
  expect((await snap(w.docId)).decisions).toBe(before.decisions);expect((await snap(w.docId)).comments).toBe(1);
 });
});

describe('follow-up rights shown to the viewer (canAddress, canResolve)',()=>{
 test('the predicate: who may write addressed and who may write resolved',()=>{
  const ctx=(o:Partial<Parameters<typeof followUpAllowed>[1]>={})=>({me:'m',revisionAuthor:'a',commentWriter:'w',manager:false,covers:false,...o});
  // addressed: the author of the revision the comment sits on, or a project manager
  expect(followUpAllowed('addressed',ctx({me:'a'}))).toBe(true);
  expect(followUpAllowed('addressed',ctx({manager:true}))).toBe(true);
  expect(followUpAllowed('addressed',ctx())).toBe(false);
  expect(followUpAllowed('addressed',ctx({me:'w'}))).toBe(false);
  expect(followUpAllowed('addressed',ctx({covers:true}))).toBe(false);
  // resolved: the writer of the comment, or someone holding an authority for the type who is not the revision's author
  expect(followUpAllowed('resolved',ctx({me:'w'}))).toBe(true);
  expect(followUpAllowed('resolved',ctx({covers:true}))).toBe(true);
  expect(followUpAllowed('resolved',ctx({me:'a',covers:true}))).toBe(false);
  expect(followUpAllowed('resolved',ctx({me:'a'}))).toBe(false);
  expect(followUpAllowed('resolved',ctx({manager:true}))).toBe(false);
  expect(followUpAllowed('resolved',ctx())).toBe(false);
  expect(followUpAllowed('resolved',ctx({me:'a',commentWriter:'a'}))).toBe(true);
 });

 test('detail() returns the flags for the author, the comment writer, a manager and an unrelated reader, and none on a resolved thread or a reply',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world({frozen:false});
  const root=(await comment(reviewer,w.docId,cmt(w))).comments[0];
  const flags=async(p:Principal)=>{
   const c=(await svc().detail(p,w.docId)).comments.find(x=>x.id===root.id)!;
   return {canAddress:c.canAddress,canResolve:c.canResolve};
  };
  expect(await flags(member)).toEqual({canAddress:true,canResolve:false});      // author of the revision
  expect(await flags(reviewer)).toEqual({canAddress:false,canResolve:true});    // writer of the comment
  expect(await flags(pm)).toEqual({canAddress:true,canResolve:false});          // a manager
  expect(await flags(approver)).toEqual({canAddress:false,canResolve:false});   // an unrelated reader (no authority for the type)
  // the flags are exactly what comment() then accepts or refuses
  for(const [p,kind,ok] of [[member,'addressed',true],[member,'resolved',false],[reviewer,'resolved',true],[reviewer,'addressed',false],[approver,'addressed',false],[approver,'resolved',false]] as const) {
   const f=await flags(p);
   expect(kind==='addressed'?f.canAddress:f.canResolve,p.id+' '+kind).toBe(ok);
  }
  // a thread with a resolved reply offers nothing; the reply rows themselves carry false flags
  const closed=await comment(reviewer,w.docId,{kind:'resolved',parentId:root.id,body:'Đã xác nhận'});
  expect(await flags(member)).toEqual({canAddress:false,canResolve:false});
  expect(await flags(pm)).toEqual({canAddress:false,canResolve:false});
  expect(closed.comments.filter(c=>c.parentId!==null).every(c=>c.canAddress===false&&c.canResolve===false)).toBe(true);
 });
});

describe('W9 the detail says when its comments were cut',()=>{
 test('commentsTruncated is false for a few comments and true past 1000',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world({frozen:false});
  await comment(reviewer,w.docId,cmt(w));
  expect((await svc().detail(reviewer,w.docId)).commentsTruncated).toBe(false);
  await h.operator.query(`INSERT INTO review_comments(tenant_id,project_id,document_id,document_revision_id,kind,anchor,body,actor_id,request_id,trace_id)
    SELECT $1,$2,$3,$4,'comment','','Nhận xét hàng loạt mẫu',$5,gen_random_uuid(),gen_random_uuid() FROM generate_series(1,1000)`,[ids.tenant,ids.sales,w.docId,w.revisionId,reviewer.id]);
  const d=await svc().detail(reviewer,w.docId);
  expect(d.comments).toHaveLength(1000);
  expect(d.commentsTruncated).toBe(true);
 },60000);
});

describe('a closed thread takes no follow-up',()=>{
 const RESOLVED_COPY='Nhận xét này đã được xác nhận xử lý xong.';
 test('resolved twice: the second is 409 COMMENT_RESOLVED, one row and one event; addressed after resolved is the same answer',async()=>{
  await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
  const w=await world({frozen:false});
  const root=(await comment(reviewer,w.docId,cmt(w))).comments[0];
  await comment(reviewer,w.docId,{kind:'resolved',parentId:root.id,body:'Đã xác nhận'});
  const before=await snap(w.docId);
  const resolvedRows=()=>n("review_comments WHERE kind='resolved'"),resolvedEvents=()=>n("review_events WHERE kind='review.resolved'");
  expect([await resolvedRows(),await resolvedEvents()]).toEqual([1,1]);
  for(const [p,kind] of [[reviewer,'resolved'],[approver,'resolved'],[member,'addressed'],[pm,'addressed']] as const) {
   const e=await refused(comment(p,w.docId,{kind,parentId:root.id,body:'Gửi thêm sau khi đã đóng'}),'COMMENT_RESOLVED',409);
   expect(e.message).toBe(RESOLVED_COPY);
  }
  expect(await snap(w.docId)).toEqual(before);
  expect([await resolvedRows(),await resolvedEvents()]).toEqual([1,1]);
  // the scope and authority answers come first: a person who could not write there anyway is told nothing about the thread
  await refused(comment(approver,w.docId,{kind:'addressed',parentId:root.id,body:'Không có quyền'}),'APPROVER_NOT_AUTHORIZED',403);
  await refused(comment(outsider,w.docId,{kind:'resolved',parentId:root.id,body:'Ngoài phạm vi'}),'SCOPE_DENIED',404);
  // a replay of the command that closed the thread is still the recorded outcome
  const key=k(),w2=await world({frozen:false});
  const r2=(await comment(reviewer,w2.docId,cmt(w2))).comments[0];
  const first=await comment(reviewer,w2.docId,{kind:'resolved',parentId:r2.id,body:'Đã xác nhận lần đầu'},key);
  expect(await comment(reviewer,w2.docId,{kind:'resolved',parentId:r2.id,body:'Đã xác nhận lần đầu'},key)).toEqual(first);
 });

 test('the flags of detail() and the answers of comment() agree for every state of a thread',async()=>{
  await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
  const w=await world({frozen:false});
  const state={
   open:async(_root:string)=>{},
   addressed:async(root:string)=>{await comment(member,w.docId,{kind:'addressed',parentId:root,body:'Đã sửa'});},
   resolved:async(root:string)=>{await comment(reviewer,w.docId,{kind:'resolved',parentId:root,body:'Đã xác nhận'});},
  };
  const table:string[]=[];
  for(const [name,put] of Object.entries(state)) for(const p of [member,reviewer,pm,approver]) for(const kind of ['addressed','resolved'] as const) {
   const root=(await wrote(reviewer,w.docId,cmt(w))).row;
   await put(root.id);
   const seen=(await svc().detail(p,w.docId)).comments.find(c=>c.id===root.id)!;
   const flag=kind==='addressed'?seen.canAddress:seen.canResolve;
   const before=await snap(w.docId);
   const out=await comment(p,w.docId,{kind,parentId:root.id,body:'Thử theo bảng'}).then(()=>'ok',x=>(x as {code:string}).code);
   const label=`${name}/${p.id}/${kind}`;
   if(flag) expect(out,label).toBe('ok'); else expect(['APPROVER_NOT_AUTHORIZED','COMMENT_RESOLVED'],label).toContain(out);
   if(name==='resolved') {
    expect(flag,label).toBe(false);
    // whoever could write on an open thread is told it is closed; whoever could not still gets the authority answer
    const wasAllowed=[[member,'addressed'],[pm,'addressed'],[reviewer,'resolved'],[approver,'resolved']].some(([q,kd])=>q===p&&kd===kind);
    expect(out,label).toBe(wasAllowed?'COMMENT_RESOLVED':'APPROVER_NOT_AUTHORIZED');
   }
   if(out!=='ok') expect(await snap(w.docId),label).toEqual(before);
   table.push(`${label}:${flag}:${out}`);
  }
  expect(table.filter(r=>r.startsWith('resolved/')&&!/:false:(COMMENT_RESOLVED|APPROVER_NOT_AUTHORIZED)$/.test(r))).toEqual([]);
  expect(table.some(r=>r.startsWith('open/')&&r.endsWith(':true:ok'))).toBe(true);
  expect(table.some(r=>r.startsWith('addressed/')&&r.endsWith(':true:ok'))).toBe(true);
 });

 test('the one rule: a thread is closed exactly when it has a resolved reply',()=>{
  expect(threadClosed([])).toBe(false);
  expect(threadClosed(['addressed','addressed'])).toBe(false);
  expect(threadClosed(['addressed','resolved'])).toBe(true);
  expect(threadClosed(['resolved'])).toBe(true);
 });
});
