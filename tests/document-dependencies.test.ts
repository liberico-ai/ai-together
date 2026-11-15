import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {proposeRev,registerDoc,reviewer,seedMembers,transportApprover} from './slice3-fixtures';
import {DependencyService} from '../src/server/document-dependencies';
import {STALE_MESSAGE} from '../src/server/document-review';
import {DocumentService} from '../src/server/documents';
import {ids} from '../src/server/identities';
import type {DocumentDetail,Principal} from '../src/server/types';

// Slice 3 Task 6: «document B depends on revision N of document A», flagged «needs review» when A gets a newer revision, in the proposal's own transaction.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const svc=()=>new DependencyService(h.db);
const k=()=>randomUUID();
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const NOT_FOUND='Không tìm thấy tài liệu trong phạm vi được cấp.';
const refused=async(p:Promise<unknown>,code:string,status:number)=>{
 const e=await p.then(()=>null,x=>x);
 expect(e,'expected a refusal').toBeTruthy();
 expect(e).toMatchObject({code,status});
 return e as Error;
};
const snap=async()=>({deps:await rows('SELECT id,version,needs_review,flagged_revision_id FROM document_dependencies ORDER BY id'),events:await n('review_events'),commands:await n('document_commands'),
 recs:await rows('SELECT id,version,latest_revision_id FROM document_records ORDER BY id')});
/** What the coordinator saw: the document's latest revision (a random id when there is none or the id is not one). */
const latest=async(id:string)=>(await rows<{latest_revision_id:string|null}>('SELECT latest_revision_id FROM document_records WHERE id::text=lower($1)',[id]))[0]?.latest_revision_id??randomUUID();
const link=async(p:Principal,up:string,dep:string,over:R={},key:string=k())=>svc().link(p,{projectId:ids.sales,upstreamDocumentId:up,dependentDocumentId:dep,upstreamRevisionId:await latest(up),...over},key,k());
/** A document of sales with one proposed revision (by pm). */
async function doc(projectId:string=ids.sales,withRevision=true):Promise<DocumentDetail> {
 const d=await registerDoc(h,pm,{projectId});
 return withRevision?proposeRev(h,pm,d):d;
}
const fresh=(id:string)=>new DocumentService(h.db).detail(pm,id);
const propose=async(p:Principal,id:string)=>proposeRev(h,p,await fresh(id));

describe('document dependencies',()=>{
 test('proposing a revision of a document that has dependents succeeds under the runtime role, and the flag event names the proposer',async()=>{
  const a=await doc(),b=await doc(),c=await doc(),lone=await doc();
  await link(pm,a.record.id,b.record.id);await link(pm,a.record.id,c.record.id);
  const events0=await n('review_events');
  const after=await propose(member,a.record.id);
  expect(after.record.latest_revision_id).not.toBe(a.record.latest_revision_id);
  const ev=await rows<{actor_id:string;kind:string;entity_type:string;entity_id:string}>("SELECT actor_id,kind,entity_type,entity_id FROM review_events WHERE kind='dependency.flagged'");
  const depIds=(await rows<{id:string}>('SELECT id FROM document_dependencies')).map(r=>r.id).sort();
  expect(ev.map(e=>e.entity_id).sort()).toEqual(depIds);
  for(const e of ev) expect(e).toMatchObject({actor_id:member.id,kind:'dependency.flagged',entity_type:'document_dependency'});
  expect(await n('review_events')).toBe(events0+2);
  // a document with no dependents is proposed as before
  const lone2=await propose(member,lone.record.id);
  expect(lone2.record.version).toBe(lone.record.version+1);
  expect(await n('review_events')).toBe(events0+2);
 });

 test('a new revision of the upstream flags every dependent in the same transaction',async()=>{
  const a=await doc(),b=await doc(),c=await doc();
  const l1=await link(pm,a.record.id,b.record.id),l2=await link(pm,a.record.id,c.record.id);
  expect(l1).toMatchObject({upstreamRevisionId:a.record.latest_revision_id,needsReview:false,flaggedRevisionId:null,flaggedAt:null,version:1});
  const r2=await propose(pm,a.record.id);
  const flagged=await rows<{id:string;needs_review:boolean;flagged_revision_id:string;flagged_at:unknown;upstream_revision_id:string;version:number;confirmed_by:string}>('SELECT * FROM document_dependencies ORDER BY id');
  expect(flagged).toHaveLength(2);
  for(const d of flagged) {
   expect(d).toMatchObject({needs_review:true,flagged_revision_id:r2.record.latest_revision_id,upstream_revision_id:a.record.latest_revision_id,version:2,confirmed_by:pm.id});
   expect(d.flagged_at).not.toBeNull();
  }
  expect(flagged.map(d=>d.id).sort()).toEqual([l1.id,l2.id].sort());
  const listed=await svc().list(pm,{projectId:ids.sales,needsReview:true});
  expect(listed.total).toBe(2);expect(listed.items.every(i=>i.needsReview&&i.flaggedRevisionId===r2.record.latest_revision_id)).toBe(true);
  // a further revision advances the flag, version moves by exactly one
  const r3=await propose(pm,a.record.id);
  for(const d of await rows<{flagged_revision_id:string;version:number;upstream_revision_id:string}>('SELECT * FROM document_dependencies'))
   expect(d).toMatchObject({flagged_revision_id:r3.record.latest_revision_id,version:3,upstream_revision_id:a.record.latest_revision_id});
  expect(await n('review_events')).toBe(2+4);
 });

 test('a failed proposal (stale version) flags nothing',async()=>{
  const a=await doc(),b=await doc();
  await link(pm,a.record.id,b.record.id);
  const before=await snap();
  const stale=await fresh(a.record.id);
  const e=await new DocumentService(h.db).proposeRevision(pm,a.record.id,{expectedVersion:stale.record.version-1,basedOnRevisionId:stale.record.latest_revision_id,sourceRevision:null,sourceHash:null,
   sourceModifiedAt:null,changes:{summary:'Thay đổi tổng hợp cho bản thử',present:[],missing:[]},sourceRefs:[]},k()).then(()=>null,x=>x);
  expect(e).toMatchObject({code:'REVISION_CONFLICT',status:409});
  expect(await snap()).toEqual(before);
 });

 test('flagging is not transitive and a cycle A→B, B→A does not loop',async()=>{
  const a=await doc(),b=await doc(),c=await doc();
  const ab=await link(pm,a.record.id,b.record.id);      // B depends on A
  const bc=await link(pm,b.record.id,c.record.id);      // C depends on B
  const ba=await link(pm,b.record.id,a.record.id);      // A depends on B: a cycle
  await propose(pm,a.record.id);
  const state=Object.fromEntries((await rows<{id:string;needs_review:boolean;version:number}>('SELECT id,needs_review,version FROM document_dependencies')).map(r=>[r.id,r]));
  expect(state[ab.id]).toMatchObject({needs_review:true,version:2});
  expect(state[bc.id]).toMatchObject({needs_review:false,version:1});
  expect(state[ba.id]).toMatchObject({needs_review:false,version:1});
  expect(await n('review_events')).toBe(3+1);
  await propose(pm,b.record.id);
  const after=Object.fromEntries((await rows<{id:string;needs_review:boolean;version:number}>('SELECT id,needs_review,version FROM document_dependencies')).map(r=>[r.id,r]));
  expect(after[bc.id]).toMatchObject({needs_review:true,version:2});expect(after[ba.id]).toMatchObject({needs_review:true,version:2});expect(after[ab.id].version).toBe(2);
 });

 test('only a project manager links; viewer, bot, another project\'s member and another tenant are refused with the not-found answer',async()=>{
  const a=await doc(),b=await doc();
  const salesViewer:Principal={...reviewer,grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
  const before=await snap();
  const unknown=await refused(link(pm,randomUUID(),b.record.id),'SCOPE_DENIED',404);
  expect(unknown.message).toBe(NOT_FOUND);
  for(const p of [viewer,bot,salesViewer,member,reviewer,transportApprover,outsider]) {
   const e=await refused(link(p,a.record.id,b.record.id),'SCOPE_DENIED',404);
   expect(e.message).toBe(NOT_FOUND);expect(e.message).not.toContain(a.record.title);
  }
  expect(await snap()).toEqual(before);
  expect(await link(pm,a.record.id,b.record.id)).toMatchObject({upstreamDocumentId:a.record.id,dependentDocumentId:b.record.id});
 });

 test('linking across projects, to itself, or twice is refused; the same key replays one link',async()=>{
  const a=await doc(),b=await doc(),t=await doc(ids.transport),noRev=await doc(ids.sales,false);
  const before=await snap();
  for(const [up,dep] of [[a.record.id,t.record.id],[t.record.id,a.record.id]]) {
   const e=await refused(link(pm,up,dep),'SCOPE_DENIED',404);expect(e.message).toBe(NOT_FOUND);expect(e.message).not.toContain(t.record.title);
  }
  await refused(link(pm,a.record.id,a.record.id),'DEPENDENCY_INVALID',422);
  await refused(link(pm,noRev.record.id,a.record.id),'DEPENDENCY_INVALID',422);
  expect(await snap()).toEqual(before);
  const key=k();
  const first=await link(pm,a.record.id,b.record.id,{note:'B cites section 2'},key);
  const again=await link(pm,a.record.id,b.record.id,{note:'B cites section 2'},key);
  expect(again).toEqual(first);
  expect(await n('document_dependencies')).toBe(1);expect(await n('review_events')).toBe(1);
  expect((await rows<{kind:string;actor_id:string}>('SELECT kind,actor_id FROM review_events'))[0]).toEqual({kind:'dependency.linked',actor_id:pm.id});
  const mid=await snap();
  await refused(link(pm,a.record.id,b.record.id,{note:'B cites section 2'}),'DEPENDENCY_EXISTS',409);
  await refused(link(pm,a.record.id,b.record.id,{note:'other'},key),'IDEMPOTENCY_CONFLICT',409);
  expect(await snap()).toEqual(mid);
  // the reverse direction is a different link
  expect(await link(pm,b.record.id,a.record.id)).toMatchObject({upstreamDocumentId:b.record.id});
 });

 test('list requires a project and never returns another project\'s links',async()=>{
  const a=await doc(),b=await doc(),ta=await doc(ids.transport),tb=await doc(ids.transport);
  const l=await link(pm,a.record.id,b.record.id);
  const tl=await svc().link(pm,{projectId:ids.transport,upstreamDocumentId:ta.record.id,upstreamRevisionId:ta.record.latest_revision_id,dependentDocumentId:tb.record.id},k(),k());
  expect(await svc().list(pm,{projectId:ids.sales})).toMatchObject({total:1,items:[{id:l.id}]});
  expect((await svc().list(pm,{projectId:ids.transport})).items.map(i=>i.id)).toEqual([tl.id]);
  expect((await svc().list(member,{projectId:ids.sales,documentId:b.record.id})).items.map(i=>i.id)).toEqual([l.id]);
  expect((await svc().list(pm,{projectId:ids.sales,documentId:ta.record.id})).total).toBe(0);
  expect((await svc().list(pm,{projectId:ids.sales,needsReview:true})).total).toBe(0);
  expect((await svc().list(pm,{projectId:ids.sales,limit:1,offset:1})).items).toEqual([]);
  await expect(svc().list(pm,{})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().list(pm,{projectId:ids.sales,limit:201})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().list(pm,{projectId:ids.sales,limit:0})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().list(pm,{projectId:ids.sales,tenantId:ids.tenant})).rejects.toBeInstanceOf(ZodError);
  for(const p of [viewer,bot,outsider,transportApprover]) await refused(svc().list(p,{projectId:ids.sales}),'SCOPE_DENIED',404);
 });

 test('forged fields are rejected',async()=>{
  const a=await doc(),b=await doc();
  const before=await snap();
  for(const extra of [{confirmedBy:member.id},{actorId:member.id},{tenantId:randomUUID()},{needsReview:true},{flaggedRevisionId:a.record.latest_revision_id},{role:'manager'},{version:5}])
   await expect(link(pm,a.record.id,b.record.id,extra)).rejects.toBeInstanceOf(ZodError);
  await expect(link(pm,a.record.id,b.record.id,{note:'a\u0000b'})).rejects.toBeInstanceOf(ZodError);
  await expect(link(pm,a.record.id,b.record.id,{note:'lone \uD800 surrogate'})).rejects.toBeInstanceOf(ZodError);
  await expect(link(pm,a.record.id,b.record.id,{note:'x'.repeat(501)})).rejects.toBeInstanceOf(ZodError);
  await expect(link(pm,'not-a-uuid',b.record.id)).rejects.toBeInstanceOf(ZodError);
  expect(await snap()).toEqual(before);
  // identifiers are lower-cased at parse time and compared with the database's ids; the confirmer is the session principal
  const v=await link(pm,a.record.id.toUpperCase(),b.record.id.toUpperCase(),{note:'ok'});
  expect(v).toMatchObject({upstreamDocumentId:a.record.id,dependentDocumentId:b.record.id,note:'ok'});
  expect((await rows<{confirmed_by:string}>('SELECT confirmed_by FROM document_dependencies'))[0].confirmed_by).toBe(pm.id);
 });
 describe('the command names the revision the coordinator saw',()=>{
  test('a proposal in between answers REVISION_CONFLICT with the review sentence and writes nothing: no link, no event, no claim',async()=>{
   const a=await doc(),b=await doc();
   const seen=a.record.latest_revision_id as string;
   await propose(member,a.record.id);                       // r2 proposed before the command reaches the server
   const before=await snap();
   const e=await refused(link(pm,a.record.id,b.record.id,{upstreamRevisionId:seen}),'REVISION_CONFLICT',409);
   expect(e.message).toBe(STALE_MESSAGE);
   expect(await snap()).toEqual(before);
   expect(await n('document_dependencies')).toBe(0);expect(await n("review_events WHERE kind='dependency.linked'")).toBe(0);
   // the answers before the check do not change: a person outside the rule, an unknown document, a self-link, still get theirs first
   for(const p of [member,viewer,bot,outsider]) expect((await refused(link(p,a.record.id,b.record.id,{upstreamRevisionId:seen}),'SCOPE_DENIED',404)).message).toBe(NOT_FOUND);
   await refused(link(pm,randomUUID(),b.record.id,{upstreamRevisionId:seen}),'SCOPE_DENIED',404);
   await refused(link(pm,a.record.id,randomUUID(),{upstreamRevisionId:seen}),'SCOPE_DENIED',404);
   await refused(link(pm,a.record.id,a.record.id,{upstreamRevisionId:seen}),'DEPENDENCY_INVALID',422);
   expect(await snap()).toEqual(before);
   // the same command naming the new latest links, and the stored link names exactly that id
   const r2=(await fresh(a.record.id)).record.latest_revision_id as string;
   expect(r2).not.toBe(seen);
   const v=await link(pm,a.record.id,b.record.id,{upstreamRevisionId:r2});
   expect(v.upstreamRevisionId).toBe(r2);
   expect((await rows<{upstream_revision_id:string}>('SELECT upstream_revision_id FROM document_dependencies'))[0].upstream_revision_id).toBe(r2);
  });

  test('naming the latest links, and the stored upstream_revision_id is the named id',async()=>{
   const a=await doc(),b=await doc();
   const v=await link(pm,a.record.id,b.record.id,{upstreamRevisionId:(a.record.latest_revision_id as string).toUpperCase()});
   expect(v.upstreamRevisionId).toBe(a.record.latest_revision_id);
   expect(await n("review_events WHERE kind='dependency.linked'")).toBe(1);
   expect((await rows<{payload:{upstreamRevisionId:string}}>("SELECT payload FROM review_events WHERE kind='dependency.linked'"))[0].payload.upstreamRevisionId).toBe(a.record.latest_revision_id);
  });

  test('a body without upstreamRevisionId is a validation error and writes nothing',async()=>{
   const a=await doc(),b=await doc();
   const before=await snap();
   await expect(link(pm,a.record.id,b.record.id,{upstreamRevisionId:undefined})).rejects.toBeInstanceOf(ZodError);
   await expect(link(pm,a.record.id,b.record.id,{upstreamRevisionId:'not-a-uuid'})).rejects.toBeInstanceOf(ZodError);
   await expect(link(pm,a.record.id,b.record.id,{upstreamRevisionId:null})).rejects.toBeInstanceOf(ZodError);
   expect(await snap()).toEqual(before);
  });

  test('a revision id of another document is not the latest of this one: the same answer as a stale one',async()=>{
   const a=await doc(),b=await doc(),c=await doc();
   const before=await snap();
   const foreign=await refused(link(pm,a.record.id,b.record.id,{upstreamRevisionId:c.record.latest_revision_id}),'REVISION_CONFLICT',409);
   await propose(member,a.record.id);
   const mid=await snap();
   const stale=await refused(link(pm,a.record.id,b.record.id,{upstreamRevisionId:a.record.latest_revision_id}),'REVISION_CONFLICT',409);
   expect(foreign.message).toBe(stale.message);
   await refused(link(pm,a.record.id,b.record.id,{upstreamRevisionId:randomUUID()}),'REVISION_CONFLICT',409);
   expect(await snap()).toEqual(mid);expect(mid.deps).toEqual(before.deps);
  });

  test('a replay with the same key and body returns the same link; the same key with another upstreamRevisionId is IDEMPOTENCY_CONFLICT',async()=>{
   const a=await doc(),b=await doc();
   const key=k();
   const first=await link(pm,a.record.id,b.record.id,{},key);
   expect(await link(pm,a.record.id,b.record.id,{},key)).toEqual(first);
   // even after a newer revision the replay is the recorded outcome, as for every other command
   await propose(member,a.record.id);
   expect((await link(pm,a.record.id,b.record.id,{upstreamRevisionId:first.upstreamRevisionId},key)).id).toBe(first.id);
   const mid=await snap();
   await refused(link(pm,a.record.id,b.record.id,{upstreamRevisionId:(await fresh(a.record.id)).record.latest_revision_id},key),'IDEMPOTENCY_CONFLICT',409);
   await refused(link(pm,a.record.id,b.record.id,{upstreamRevisionId:randomUUID()},key),'IDEMPOTENCY_CONFLICT',409);
   expect(await snap()).toEqual(mid);
   expect(await n('document_dependencies')).toBe(1);
  });
 });
});
