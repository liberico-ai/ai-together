import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {approver,beforeStatement,delegate,frozenRevision,grantDocApproval,proposeRev,registerDoc,reviewer,seedBom,seedMembers,transportApprover} from './slice3-fixtures';
import {BomService} from '../src/server/bom';
import {DecisionService,reassignmentCard,reassignmentState,type DecisionCard,type ReassignmentCard,type ReviewCard} from '../src/server/decisions';
import {ReviewService} from '../src/server/document-review';
import {DocumentService} from '../src/server/documents';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// Slice 3 Task 13: decision cards (review of the newest revision, 3/3 reassignment) and the rule that a yes is valid only on the exact live card.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
afterEach(async()=>{await h.reset();await h.close();});

const k=()=>randomUUID();
const list=(p:Principal,projectId:string=ids.sales)=>new DecisionService(h.db).list(p,{projectId}).then(r=>r.cards);
const reviews=(cards:DecisionCard[])=>cards.filter((c):c is ReviewCard=>c.kind==='document_review');
const reassignments=(cards:DecisionCard[])=>cards.filter((c):c is ReassignmentCard=>c.kind==='reassignment');
const rows=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const NOT_FOUND='Không tìm thấy tài liệu trong phạm vi được cấp.';
const refused=async(p:Promise<unknown>,code:string,status:number)=>{
 const e=await p.then(()=>null,x=>x);
 expect(e,'expected a refusal').toBeTruthy();
 expect(e).toMatchObject({code,status});
 return e as Error;
};

type W={docId:string;revisionId:string;version:number;hash:string|null};
async function current(docId:string):Promise<W> {
 const r=(await rows<{version:number;latest_revision_id:string;source_hash:string|null}>(
  'SELECT d.version,d.latest_revision_id,v.source_hash FROM document_records d JOIN document_revisions v ON v.id=d.latest_revision_id WHERE d.id=$1',[docId]))[0];
 return {docId,revisionId:r.latest_revision_id,version:r.version,hash:r.source_hash};
}
/** A document registered by pm whose newest revision is frozen and proposed by `author`. */
async function world(author:Principal=member,revisions=1):Promise<W> {
 const doc=await registerDoc(h,pm,{projectId:ids.sales,docType:'design'});
 for(let i=0;i<revisions;i++) await frozenRevision(h,doc.record.id,author.id);
 return current(doc.record.id);
}
const dec=(w:W,over:Record<string,unknown>={})=>({revisionId:w.revisionId,sourceHash:w.hash,expectedVersion:w.version,result:'approved',scopeNote:'Đã đọc đúng bản này',exceptions:[],...over});
const decide=(p:Principal,w:W,over:Record<string,unknown>={})=>new ReviewService(h.db).decide(p,w.docId,dec(w,over),k(),k());
const docOf=(id:string)=>new DocumentService(h.db).detail(pm,id);

describe('reassignmentState',()=>{
 test('reassignmentState never says applied without a receipt',()=>{
  const stored=['pending','applied','rejected','revise','cancelled','expired','reconcile','quorum_met','bogus',''];
  for(const state of stored) for(const agree of [0,1,2,3,4]) for(const hasReceipt of [false,true]) {
   const out=reassignmentState({state,agree,hasReceipt});
   if(out==='applied') {expect(hasReceipt,`${state}/${agree}`).toBe(true);expect(state).toBe('applied');}
  }
  expect(reassignmentState({state:'applied',agree:3,hasReceipt:false})).toBe('quorum_met');
  expect(reassignmentState({state:'applied',agree:2,hasReceipt:false})).toBe('reconcile');
  expect(reassignmentState({state:'pending',agree:3,hasReceipt:false})).toBe('quorum_met');
  expect(reassignmentState({state:'pending',agree:2,hasReceipt:false})).toBe('pending');
  expect(reassignmentState({state:'pending',agree:0,hasReceipt:false})).toBe('pending');
  expect(reassignmentState({state:'applied',agree:3,hasReceipt:true})).toBe('applied');
  for(const s of ['rejected','revise','cancelled','expired','reconcile'] as const) expect(reassignmentState({state:s,agree:1,hasReceipt:false})).toBe(s);
  for(const s of ['pending','rejected','revise','cancelled','expired','reconcile']) expect(reassignmentState({state:s,agree:3,hasReceipt:true}),s).toBe('reconcile');
  for(const bad of ['bogus','','APPLIED','quorum_met']) for(const hasReceipt of [false,true]) expect(reassignmentState({state:bad,agree:3,hasReceipt}),bad).toBe('reconcile');
 });
});

describe('reassignment cards',()=>{
 const propose=(bom:BomService,s:Awaited<ReturnType<typeof seedBom>>)=>
  bom.command(pm,{action:'propose',workId:s.workId,expectedVersion:1,allocation:s.selection,reason:'Phân công mô phỏng trong bản thử'},k());
 const agree=(bom:BomService,id:string,p:Principal)=>bom.command(p,{action:'vote',proposalId:id,choice:'agree',note:'Xác nhận bằng phiên thử nghiệm'},k());

 test('DOC-09 a 2/3 card reads pending with have 2 and no receipt; after the third vote it reads applied with the receipt',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db);
  const id=(await propose(bom,s)).proposal.id;
  let [card]=reassignments(await list(pm));
  expect(card).toMatchObject({kind:'reassignment',decisionId:id,projectId:ids.sales,workId:s.workId,workCode:'STT-5',title:'Triển khai bot Hermes',revision:{workVersion:1},
   quorum:{needed:3,have:0},state:'pending',appliedReceipt:null,actorEligibility:{canVote:true,reason:null}});
  await agree(bom,id,s.roster[0]);await agree(bom,id,s.roster[1]);
  [card]=reassignments(await list(pm));
  expect(card).toMatchObject({quorum:{needed:3,have:2},state:'pending',appliedReceipt:null});
  expect(card.votes.map(v=>v.actorId).sort()).toEqual([s.roster[0].id,s.roster[1].id].sort());
  expect(card.votes.every(v=>v.choice==='agree')).toBe(true);
  expect(card.actorEligibility).toEqual({canVote:false,reason:'ALREADY_VOTED'});
  await agree(bom,id,s.roster[2]);
  [card]=reassignments(await list(pm));
  expect(card).toMatchObject({quorum:{needed:3,have:3},state:'applied',appliedReceipt:{workVersion:2},actorEligibility:{canVote:false,reason:'CLOSED'}});
  expect(typeof card.appliedReceipt!.at).toBe('string');
 });

 test('EXPIRED wins over ALREADY_VOTED: a seat that voted and looks at an expired proposal reads EXPIRED',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db);
  const id=(await propose(bom,s)).proposal.id;
  const voter=s.roster[0];
  await agree(bom,id,voter);
  expect(reassignments(await list(voter))[0].actorEligibility).toEqual({canVote:false,reason:'ALREADY_VOTED'});
  await h.operator.query("UPDATE bom_proposals SET created_at=now()-interval '2 days',expires_at=now()-interval '1 second' WHERE id=$1",[id]);
  const card=reassignments(await list(voter))[0];
  expect(card.votes.map(v=>v.actorId)).toContain(voter.id);
  expect(card.actorEligibility).toEqual({canVote:false,reason:'EXPIRED'});
 });

 test('reassignmentCard reads the viewer id in one normalised form: an upper-case id still holds its seat and its vote',()=>{
  const seat=randomUUID(),other=randomUUID(),at='2026-11-15T00:00:00.000Z';
  const card=(votes:{voter_id:string}[])=>({proposal:{id:randomUUID(),project_id:ids.sales,work_id:randomUUID(),work_version:1,state:'pending',reason:'Lý do',seat_ids:[seat,other],
   expires_at:new Date(Date.now()+3600e3).toISOString()},votes:votes.map(v=>({...v,choice:'agree',note:'',created_at:at})),receipt:null,
   work:{id:randomUUID(),code:'STT-1',title:'Việc',version:1}}) as unknown as Parameters<typeof reassignmentCard>[1];
  const viewerUpper={...pm,id:seat.toUpperCase()};
  expect(reassignmentCard(viewerUpper,card([]),Date.now()).actorEligibility).toEqual({canVote:true,reason:null});
  expect(reassignmentCard(viewerUpper,card([{voter_id:seat}]),Date.now()).actorEligibility).toEqual({canVote:false,reason:'ALREADY_VOTED'});
  expect(reassignmentCard({...pm,id:randomUUID()},card([]),Date.now()).actorEligibility).toEqual({canVote:false,reason:null});
 });

 test('a card explains why the viewer cannot act: closed, expired, already voted',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db);
  const id=(await propose(bom,s)).proposal.id;
  // created_at moves back with expires_at: a proposal cannot expire before it was created
  await h.operator.query("UPDATE bom_proposals SET created_at=now()-interval '2 days',expires_at=now()-interval '1 second' WHERE id=$1",[id]);
  expect(reassignments(await list(pm))[0].actorEligibility).toEqual({canVote:false,reason:'EXPIRED'});
  const id2=(await rows<{id:string}>('SELECT id FROM bom_proposals'))[0].id;
  await h.operator.query("UPDATE bom_proposals SET state='rejected',finished_at=now() WHERE id=$1",[id2]);
  expect(reassignments(await list(pm))[0].actorEligibility).toEqual({canVote:false,reason:'CLOSED'});
 });

 test('only seats see reassignment cards; other members see none and learn no count',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db);
  await propose(bom,s);
  const w=await world();
  expect(reassignments(await list(pm))).toHaveLength(1);
  for(const p of [reviewer,approver,s.chair]) {
   const cards=await list(p);
   expect(reassignments(cards)).toHaveLength(0);
   expect(cards).toHaveLength(1);
   expect(reviews(cards)[0].revision.id).toBe(w.revisionId);
   expect(JSON.stringify(cards)).not.toMatch(/reassignment|STT-5|Hermes/);
  }
 });

 test('pending fails closed when the work row of a proposal is not returned, and answers a malformed project id as not found',async()=>{
  // a proposal cannot outlive its work row (composite foreign key), so a missing row is an inconsistency, never a card to leave out
  const s=await seedBom(h);
  const bom=new BomService(h.db);
  await propose(bom,s);
  const hide=(q:{query:Function}) =>({query:(sql:string,params?:unknown[])=>/FROM work_items WHERE id=ANY/.test(sql)?Promise.resolve({rows:[],rowCount:0}):q.query(sql,params)});
  const hiding={...hide(h.db),transaction:(fn:Function)=>h.db.transaction(tx=>fn(hide(tx))),close:()=>h.db.close()} as unknown as typeof h.db;
  await refused(new BomService(hiding).pending(pm,ids.sales),'BOM_INCONSISTENT',500);
  await refused(new DecisionService(hiding).list(pm,{projectId:ids.sales}),'BOM_INCONSISTENT',500);
  // control: the same call without the hiding returns the card
  expect(await bom.pending(pm,ids.sales)).toHaveLength(1);
  // a project id that is not a uuid is the same 404 assertSeat gives, before any query
  const e=await refused(bom.pending(pm,'not-a-uuid'),'SCOPE_DENIED',404);
  expect(e.message).toBe('Không tìm thấy hồ sơ BoM trong phạm vi được cấp.');
  await refused(bom.pending(pm,''),'SCOPE_DENIED',404);
 });

 test('pending answers a non-seat and an unlinked seat as read() does, and writes nothing',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db);
  await propose(bom,s);
  const seen:string[]=[];
  const spy=(q:{query:Function}) =>({query:(sql:string,params?:unknown[])=>{seen.push(sql);return q.query(sql,params);}});
  const spyDb={...spy(h.db),transaction:(fn:Function)=>h.db.transaction(tx=>fn(spy(tx))),close:()=>h.db.close()} as unknown as typeof h.db;
  const counts=async()=>[await n('bom_proposals'),await n('bom_votes'),await n('bom_receipts'),await n('work_items'),await n('audit_events')];
  const before=await counts();
  const versions=await rows('SELECT id,version,assignee_id,updated_at FROM work_items ORDER BY id');
  const cards=await new BomService(spyDb).pending(pm,ids.sales);
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({work:{id:s.workId,code:'STT-5',title:'Triển khai bot Hermes',version:1},proposal:{state:'pending'}});
  expect(await counts()).toEqual(before);
  expect(await rows('SELECT id,version,assignee_id,updated_at FROM work_items ORDER BY id')).toEqual(versions);
  expect(seen.filter(q=>/\b(INSERT|UPDATE|DELETE|FOR UPDATE|FOR SHARE)\b/i.test(q.replace(/set_config/gi,'')))).toEqual([]);
  // a person who holds no seat, and a project with no BoM scope, get the same not-found answer as read()
  const e=await refused(bom.pending(reviewer,ids.sales),'SCOPE_DENIED',404);
  expect(e.message).toBe('Không tìm thấy hồ sơ BoM trong phạm vi được cấp.');
  await refused(bom.pending(pm,ids.transport),'SCOPE_DENIED',404);
  await refused(bom.pending(bot,ids.sales),'SCOPE_DENIED',404);
  // a seat whose Telegram link is gone
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[s.roster[2].id]);
  const e2=await refused(bom.pending(s.roster[2],ids.sales),'SCOPE_DENIED',403);
  expect(e2.message).toBe('Cần ghép Telegram và có phạm vi dự án.');
 });
});

describe('review cards',()=>{
 test('a review card reports the vote and the applied baseline as two facts',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const doc=await registerDoc(h,pm,{projectId:ids.sales,docType:'design'});
  await frozenRevision(h,doc.record.id,member.id);
  const older=(await current(doc.record.id)).revisionId;
  await frozenRevision(h,doc.record.id,member.id);
  const w=await current(doc.record.id);
  let [card]=reviews(await list(reviewer));
  expect(card).toMatchObject({decisionId:w.revisionId,state:'open',quorum:{needed:1,have:0},votes:[],appliedReceipt:null,expiresAt:null,documentId:doc.record.id});
  await decide(approver,w);
  const expectApprovedNotApplied=async()=>{
   const cards=reviews(await list(reviewer));
   expect(cards).toHaveLength(1);
   expect(cards[0]).toMatchObject({decisionId:w.revisionId,state:'approved',quorum:{needed:1,have:1},appliedReceipt:null});
   expect(cards[0].votes).toMatchObject([{actorId:approver.id,choice:'approved'}]);
  };
  [card]=reviews(await list(reviewer));
  expect(card).toMatchObject({state:'approved',quorum:{needed:1,have:1},appliedReceipt:{approvedRevisionId:w.revisionId}});
  expect(card.appliedReceipt!.decisionId).toBe((await rows<{id:string}>('SELECT id FROM review_decisions'))[0].id);
  // the operational login moves the baseline pointer to another revision, then clears it
  await h.operator.query('UPDATE document_records SET approved_revision_id=$1 WHERE id=$2',[older,doc.record.id]);
  await expectApprovedNotApplied();
  await h.operator.query('UPDATE document_records SET approved_revision_id=NULL WHERE id=$1',[doc.record.id]);
  await expectApprovedNotApplied();
 });

 test('a changes_requested decision uses the only slot: have 0, its own state and vote',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const w=await world();
  await decide(reviewer,w,{result:'changes_requested'});
  const [card]=reviews(await list(approver));
  expect(card).toMatchObject({state:'changes_requested',quorum:{needed:1,have:0},appliedReceipt:null,actorEligibility:{reason:'ALREADY_DECIDED',canApprove:false}});
  expect(card.votes).toMatchObject([{actorId:reviewer.id,choice:'changes_requested'}]);
 });

 test('a superseded revision has no card',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const doc=await registerDoc(h,pm,{projectId:ids.sales,docType:'design'});
  await frozenRevision(h,doc.record.id,member.id);
  const r1=await current(doc.record.id);
  await decide(approver,r1);
  expect(reviews(await list(reviewer))[0]).toMatchObject({decisionId:r1.revisionId,quorum:{have:1}});
  await proposeRev(h,member,await docOf(doc.record.id));
  const r2=await current(doc.record.id);
  expect(r2.revisionId).not.toBe(r1.revisionId);
  const cards=reviews(await list(reviewer));
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({decisionId:r2.revisionId,quorum:{needed:1,have:0},state:'open',appliedReceipt:null,revision:{id:r2.revisionId,no:2}});
  expect(JSON.stringify(cards)).not.toContain(r1.revisionId);
 });

 test('a card explains why the viewer cannot act',async()=>{
  const open=await world();
  const mine=await world(approver);
  await delegate(h,ids.sales,reviewer.id);
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const find=(cards:DecisionCard[],w:W)=>reviews(cards).find(c=>c.decisionId===w.revisionId)!;
  // the author
  expect(find(await list(approver),mine).actorEligibility).toMatchObject({canComment:false,canRequestChanges:false,canApprove:false,reason:'AUTHOR'});
  // no delegation
  expect(find(await list(viewerLike()),open).actorEligibility).toMatchObject({canApprove:false,reason:'NO_DELEGATION'});
  // comment only
  expect(find(await list(reviewer),open).actorEligibility).toMatchObject({canComment:true,canRequestChanges:true,canApprove:false,reason:'REVIEW_ONLY'});
  // approver on a revision that is not frozen
  const doc=await registerDoc(h,pm,{projectId:ids.sales,docType:'design'});
  await proposeRev(h,member,doc,{sourceHash:'c3'.repeat(32)});
  const loose=await current(doc.record.id);
  expect(find(await list(approver),loose).actorEligibility).toMatchObject({canComment:true,canApprove:false,reason:'NOT_FROZEN'});
  // may approve
  expect(find(await list(approver),open).actorEligibility).toMatchObject({canApprove:true,reason:null});
  // already decided
  await decide(reviewer,open,{result:'changes_requested'});
  expect(find(await list(approver),open).actorEligibility).toMatchObject({canApprove:false,reason:'ALREADY_DECIDED'});
 });

 test('viewer, bot, another project\'s member and another tenant get the not-found answer',async()=>{
  await world();
  for(const p of [viewer,bot,transportApprover,outsider]) {
   const e=await refused(list(p),'SCOPE_DENIED',404);
   expect(e.message).toBe(NOT_FOUND);
  }
  // an unknown project looks the same
  expect((await refused(list(pm,randomUUID()),'SCOPE_DENIED',404)).message).toBe(NOT_FOUND);
 });

 test('input is a strict {projectId}; a forged identity field is an unknown field; the id is lower-cased',async()=>{
  await world();
  const svc=new DecisionService(h.db);
  for(const extra of [{tenantId:ids.tenant},{actorId:pm.id},{projectIds:[ids.sales]},{limit:5}])
   await expect(svc.list(pm,{projectId:ids.sales,...extra})).rejects.toBeInstanceOf(ZodError);
  await expect(svc.list(pm,{})).rejects.toBeInstanceOf(ZodError);
  await expect(svc.list(pm,{projectId:'nope'})).rejects.toBeInstanceOf(ZodError);
  expect((await svc.list(pm,{projectId:ids.sales.toUpperCase()})).cards).toHaveLength(1);
 });

 test('only SCOPE_DENIED from pending is absorbed; any other failure propagates',async()=>{
  const sb=await seedBom(h);
  await new BomService(h.db).command(pm,{action:'propose',workId:sb.workId,expectedVersion:1,allocation:sb.selection,reason:'Phân công mô phỏng trong bản thử'},k());
  await world();
  const boom=new Error('simulated pending failure');
  const db=beforeStatement(h.db,/FROM bom_proposals WHERE project_id/,async()=>{throw boom;});
  const e=await new DecisionService(db).list(pm,{projectId:ids.sales}).then(()=>null,x=>x);
  expect(e).toBe(boom);
  // a seat whose Telegram link is gone is SCOPE_DENIED from pending and is absorbed: review cards only
  const s=await rows<{id:string}>("SELECT id FROM identity.users WHERE id=$1",[pm.id]);
  expect(s).toHaveLength(1);
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[pm.id]);
  const cards=await list(pm);
  expect(reassignments(cards)).toHaveLength(0);
  expect(reviews(cards)).toHaveLength(1);
 });

 test('a yes is valid only on the exact live card',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const a=await world(),b=await world();
  const svc=new ReviewService(h.db);
  // a command without the exact revision or hash is not a command
  const {revisionId:_r,...noRevision}=dec(a);
  const {sourceHash:_h,...noHash}=dec(a);
  await expect(svc.decide(approver,a.docId,noRevision,k(),k())).rejects.toBeInstanceOf(ZodError);
  await expect(svc.decide(approver,a.docId,noHash,k(),k())).rejects.toBeInstanceOf(ZodError);
  await expect(svc.decide(approver,a.docId,{result:'approved'},k(),k())).rejects.toBeInstanceOf(ZodError);
  expect(await n('review_decisions')).toBe(0);
  // one command decides exactly one card
  await decide(approver,a);
  const cards=reviews(await list(approver));
  expect(cards.find(c=>c.decisionId===a.revisionId)).toMatchObject({state:'approved'});
  expect(cards.find(c=>c.decisionId===b.revisionId)).toMatchObject({state:'open',quorum:{have:0}});
  expect(await n('review_decisions')).toBe(1);
  // a card of an old revision is refused after a newer one exists
  const c=await world(member,1);
  const old=c;
  await proposeRev(h,member,await docOf(c.docId));
  await refused(decide(approver,old),'REVISION_CONFLICT',409);
  expect(await n('review_decisions')).toBe(1);
  // the same on a decided card
  await refused(decide(approver,a),'REVIEW_ALREADY_DECIDED',409);
 });

 test('a yes on a 3/3 card names the proposal; a closed or unknown card is refused',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db);
  const id=(await bom.command(pm,{action:'propose',workId:s.workId,expectedVersion:1,allocation:s.selection,reason:'Phân công mô phỏng trong bản thử'},k())).proposal.id;
  const vote=(p:Principal,choice:string,proposalId:string|undefined=id)=>bom.command(p,{action:'vote',proposalId,choice,note:'Xác nhận bằng phiên thử nghiệm'},k());
  await expect(bom.command(pm,{action:'vote',choice:'agree',note:'Xác nhận bằng phiên thử nghiệm'},k())).rejects.toBeInstanceOf(ZodError);
  await expect(bom.command(pm,'yes',k())).rejects.toBeInstanceOf(ZodError);
  await vote(s.roster[1],'agree');
  await vote(s.roster[2],'reject');
  await refused(vote(s.roster[0],'agree'),'PROPOSAL_CLOSED',409);
  await refused(vote(pm,'agree',randomUUID()),'SCOPE_DENIED',404);
  const [card]=reassignments(await list(pm));
  expect(card).toMatchObject({state:'rejected',quorum:{have:1},actorEligibility:{canVote:false,reason:'CLOSED'}});
 });
});

function viewerLike():Principal {return {...member,id:'14000000-0000-4000-8000-0000000000aa'};}

describe('W9 the decision list says when its review cards were cut',()=>{
 test('reviewCardsTruncated follows the queue total against the 200 cards fetched',async()=>{
  await world();
  expect((await new DecisionService(h.db).list(pm,{projectId:ids.sales})).reviewCardsTruncated).toBe(false);
  // 201 documents with a revision would need 201 registrations; the queue is replaced by a double that reports the larger total
  const svc=new DecisionService(h.db) as unknown as {review:{queue:(p:Principal,q:unknown)=>Promise<{items:unknown[];total:number}>}};
  const real=svc.review.queue.bind(svc.review);
  svc.review.queue=async(p,q)=>({...(await real(p,q)),total:201});
  expect((await (svc as unknown as DecisionService).list(pm,{projectId:ids.sales})).reviewCardsTruncated).toBe(true);
 });
});
