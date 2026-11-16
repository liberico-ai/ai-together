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
  expect(reassignmentState({state:'applied',agree:3,hasReceipt:false})).toBe('reconcile');   // a stored applied without its receipt is an inconsistent row (D2 extended: was quorum_met)
  expect(reassignmentState({state:'applied',agree:2,hasReceipt:false})).toBe('reconcile');
  expect(reassignmentState({state:'pending',agree:3,hasReceipt:false})).toBe('quorum_met');
  expect(reassignmentState({state:'pending',agree:2,hasReceipt:false})).toBe('pending');
  expect(reassignmentState({state:'pending',agree:0,hasReceipt:false})).toBe('pending');
  expect(reassignmentState({state:'applied',agree:3,hasReceipt:true})).toBe('applied');
  for(const s of ['rejected','revise','cancelled','expired','reconcile'] as const) expect(reassignmentState({state:s,agree:1,hasReceipt:false})).toBe(s);
  for(const s of ['pending','rejected','revise','cancelled','expired','reconcile']) expect(reassignmentState({state:s,agree:3,hasReceipt:true}),s).toBe('reconcile');
  for(const bad of ['bogus','','APPLIED','quorum_met']) for(const hasReceipt of [false,true]) expect(reassignmentState({state:bad,agree:3,hasReceipt}),bad).toBe('reconcile');
 });

 test('D2 the exhaustive table: every stored state x 0..3 agreeing votes x receipt yes/no, `applied` needs all three facts',()=>{
  const stored=['pending','applied','rejected','revise','cancelled','expired','reconcile','quorum_met','bogus',''];
  const terminal=['rejected','revise','cancelled','expired','reconcile'];
  const expected=(state:string,agree:number,hasReceipt:boolean)=>{
   if(state==='applied') return hasReceipt&&agree>=3?'applied':'reconcile';
   if(hasReceipt) return 'reconcile';
   if(state==='pending') return agree>=3?'quorum_met':'pending';
   return terminal.includes(state)?state:'reconcile';
  };
  for(const state of stored) for(const agree of [0,1,2,3]) for(const hasReceipt of [false,true])
   expect(reassignmentState({state,agree,hasReceipt}),JSON.stringify({state,agree,hasReceipt})).toBe(expected(state,agree,hasReceipt));
  expect(reassignmentState({state:'applied',agree:2,hasReceipt:true})).toBe('reconcile');
  expect(reassignmentState({state:'applied',agree:3,hasReceipt:true})).toBe('applied');
  expect(reassignmentState({state:'pending',agree:3,hasReceipt:false})).toBe('quorum_met');
  expect(reassignmentState({state:'pending',agree:3,hasReceipt:true})).toBe('reconcile');
  for(const agree of [0,1,2,3]) for(const state of stored) if(!(state==='pending'&&agree>=3)) expect(reassignmentState({state,agree,hasReceipt:false}),state+agree).not.toBe('quorum_met');
 });
});

describe('reassignment cards',()=>{
 test('D2 a stored applied proposal with a receipt and only two agreeing votes reads reconcile; the receipt line still follows the receipt',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db);
  const id=(await bom.command(pm,{action:'propose',workId:s.workId,expectedVersion:1,allocation:s.selection,reason:'Phân công mô phỏng trong bản thử'},k())).proposal.id;
  for(const voter of [s.roster[0],s.roster[1]]) await bom.command(voter,{action:'vote',proposalId:id,choice:'agree',note:'Xác nhận bằng phiên thử nghiệm'},k());
  await h.operator.query("UPDATE bom_proposals SET state='applied',finished_at=now() WHERE id=$1",[id]);
  await h.operator.query(`INSERT INTO bom_receipts(proposal_id,tenant_id,project_id,work_id,work_version,source_checked_at) SELECT id,tenant_id,project_id,work_id,work_version,now() FROM bom_proposals WHERE id=$1`,[id]);
  const [card]=reassignments(await list(pm));
  expect(card).toMatchObject({decisionId:id,quorum:{needed:3,have:2},state:'reconcile'});
  expect(card.appliedReceipt).not.toBeNull();
 });

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
  expect((await bom.pending(pm,ids.sales)).cards).toHaveLength(1);
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
  const {cards}=await new BomService(spyDb).pending(pm,ids.sales);
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

// Follow-up to DELIVERY-012 gap 44 (reviewer P2): the 3/3 cards were the newest 30 proposals of the project, closed ones included, with no word that the list was cut.
// «Live» below is the rule of the vote command: stored `pending` and not past `expires_at`. Every row is synthetic and written by the operational login.
// OQ-47 (b), Chairman 16/11/2026: the ballots that are no longer live follow by closing time, most recently closed first. A ballot past its expiry that nobody closed has no
// closing time; this session ranks it by its expiry (a ruling of the session, not of the Chairman).
describe('P2 the 3/3 cards keep live ballots ahead of the cap and say when they were cut',()=>{
 const full=(p:Principal)=>new DecisionService(h.db).list(p,{projectId:ids.sales});
 let seats:Awaited<ReturnType<typeof seedBom>>;
 /** One proposal through the service, moved back in time so that every copy below is newer. */
 async function liveBallot(hoursAgo=2):Promise<string> {
  const s=seats=await seedBom(h);
  const id=(await new BomService(h.db).command(pm,{action:'propose',workId:s.workId,expectedVersion:1,allocation:s.selection,reason:'Phân công mô phỏng trong bản thử'},k())).proposal.id;
  await h.operator.query('UPDATE bom_proposals SET created_at=now()-make_interval(hours=>$2::int) WHERE id=$1',[id,hoursAgo]);
  return id;
 }
 /** `count` copies of a proposal in `state`, created `from`, `from+1`, … minutes ago (so the first is the newest). Every copy expires in six days, the closed ones too:
  * an order that looked at the expiry alone would rank a closed ballot as live. A closed copy was closed thirty seconds after it was created, so among the copies of one
  * call the most recently created is also the most recently closed. */
 async function copies(sourceId:string,count:number,state:string,from=1):Promise<void> {
  await h.operator.query(`INSERT INTO bom_proposals(tenant_id,project_id,work_id,proposer_id,work_version,scope_version,seat_ids,source_ref,source_fingerprint,
    before_assignment,proposed_assignment,reason,state,created_at,expires_at,finished_at)
   SELECT b.tenant_id,b.project_id,b.work_id,b.proposer_id,b.work_version,b.scope_version,b.seat_ids,b.source_ref,b.source_fingerprint,b.before_assignment,b.proposed_assignment,b.reason,
    $2::text,now()-make_interval(mins=>g),now()+interval '6 days',CASE WHEN $2::text='pending' THEN NULL ELSE now()-make_interval(mins=>g)+interval '30 seconds' END
   FROM bom_proposals b,generate_series($3::int,$4::int) g WHERE b.id=$1`,[sourceId,state,from,from+count-1]);
 }
 /** Ids of every proposal except the named ones, newest first by creation. */
 const newestFirst=async(...except:string[])=>(await rows<{id:string}>('SELECT id FROM bom_proposals WHERE NOT (id = ANY($1::uuid[])) ORDER BY created_at DESC,id DESC',[except])).map(r=>r.id);
 /** Ids of every proposal except the named ones, none of them live: most recent first by closing time, a stale pending ballot by its expiry, a closed row with no closing
  * time by its creation. Stated here apart from the service; the cases below also name exact positions, which follow from the fixture times alone. */
 const byEndOfLife=async(...except:string[])=>(await rows<{id:string}>(
  `SELECT id FROM bom_proposals WHERE NOT (id = ANY($1::uuid[])) ORDER BY (CASE WHEN state='pending' THEN expires_at ELSE COALESCE(finished_at,created_at) END) DESC,created_at DESC,id DESC`,[except])).map(r=>r.id);

 test('a live ballot older than thirty-one newer closed ballots is still listed, first, and the list says it was cut',async()=>{
  const open=await liveBallot();
  await copies(open,31,'rejected');
  const r=await full(pm);
  const cards=reassignments(r.cards);
  expect(cards).toHaveLength(30);
  expect(cards[0]).toMatchObject({decisionId:open,state:'pending',actorEligibility:{canVote:true,reason:null}});
  expect(cards.slice(1).map(c=>c.decisionId)).toEqual((await newestFirst(open)).slice(0,29));   // the closed copies follow, most recently closed first (for these copies that is also newest first); the last two give way
  expect(cards.slice(1).every(c=>c.state==='rejected')).toBe(true);
  expect(r.reassignmentCardsTruncated).toBe(true);
 });

 test('reassignmentCardsTruncated is false at exactly thirty ballots and true at thirty-one; the cap stays thirty',async()=>{
  const open=await liveBallot();
  expect(await full(pm)).toMatchObject({reassignmentCardsTruncated:false});
  await copies(open,29,'rejected');
  let r=await full(pm);
  expect(reassignments(r.cards)).toHaveLength(30);
  expect(r.reassignmentCardsTruncated).toBe(false);
  await copies(open,1,'rejected',40);
  r=await full(pm);
  expect(reassignments(r.cards)).toHaveLength(30);
  expect(r.reassignmentCardsTruncated).toBe(true);
  expect(r.reviewCardsTruncated).toBe(false);   // the two flags are separate facts
 });

 test('live ballots come first, newest first; the rest follow by the time they stopped being live: closing time, or expiry for a ballot nobody closed',async()=>{
  const older=await liveBallot(3);
  await copies(older,1,'pending',90);            // a second live ballot, newer than the first
  const newer=(await newestFirst(older))[0];
  await copies(older,1,'pending',5);             // a third pending ballot, then made stale: still stored pending, past its expiry
  const stale=(await newestFirst(older,newer))[0];
  // created before every closed ballot; expired fifteen minutes ago, between the closing of the fifteenth closed ballot (14.5 minutes ago) and of the sixteenth (15.5 minutes ago)
  await h.operator.query("UPDATE bom_proposals SET created_at=now()-interval '9 days',expires_at=now()-interval '15 minutes' WHERE id=$1",[stale]);
  await copies(older,30,'rejected');             // thirty closed ballots, created 1 to 30 minutes ago: all newer than the two live ones
  const r=await full(pm);
  const cards=reassignments(r.cards);
  expect(cards).toHaveLength(30);
  expect(cards.slice(0,2).map(c=>c.decisionId)).toEqual([newer,older]);
  expect(cards.slice(0,2).every(c=>c.actorEligibility.canVote)).toBe(true);
  // 33 proposals: two live, then one group of thirty-one (thirty closed and the stale one), cut after twenty-eight.
  // The stale ballot is not moved ahead with the live ones; its place is its expiry, not its creation nine days ago (that would put it last, and cut).
  const rest=await byEndOfLife(older,newer);
  expect(rest.indexOf(stale)).toBe(15);
  expect(cards.slice(2).map(c=>c.decisionId)).toEqual(rest.slice(0,28));
  expect(cards[17]).toMatchObject({decisionId:stale,state:'pending',actorEligibility:{canVote:false,reason:'EXPIRED'}});
  expect(r.reassignmentCardsTruncated).toBe(true);
  // when nothing is cut the stale ballot is still listed after the live ones
  await h.operator.query("DELETE FROM bom_proposals WHERE state='rejected'");
  const all=await full(pm);
  expect(reassignments(all.cards).map(c=>c.decisionId)).toEqual([newer,older,stale]);
  expect(all.reassignmentCardsTruncated).toBe(false);
 });

 test('OQ-47 (b) a ballot that has just closed keeps a place: after the vote it is the first card below the live ones, however old it is',async()=>{
  const open=await liveBallot();           // created two hours ago
  await copies(open,31,'rejected');        // thirty-one closed ballots, all created and closed after it was created
  const voter=seats.roster[0];
  expect(reassignments((await full(voter)).cards)[0]).toMatchObject({decisionId:open,state:'pending',actorEligibility:{canVote:true,reason:null}});
  await new BomService(h.db).command(voter,{action:'vote',proposalId:open,choice:'reject',note:'Từ chối trong bản thử nghiệm'},k());
  // the read the screen makes after a recorded vote: the card is still there, with its new state and the vote
  const r=await full(voter);
  let cards=reassignments(r.cards);
  expect(cards).toHaveLength(30);
  expect(cards[0]).toMatchObject({decisionId:open,state:'rejected',actorEligibility:{canVote:false,reason:'CLOSED'}});
  expect(cards[0].votes).toMatchObject([{actorId:voter.id,choice:'reject'}]);
  expect(cards.slice(1).map(c=>c.decisionId)).toEqual((await newestFirst(open)).slice(0,29));   // the thirty-one older closings follow, most recent first; two are cut
  expect(r.reassignmentCardsTruncated).toBe(true);
  // a live ballot, even one created before everything else, still comes ahead of the ballot that has just closed
  await copies(open,1,'pending',200);
  const live=(await rows<{id:string}>("SELECT id FROM bom_proposals WHERE state='pending'"))[0].id;
  cards=reassignments((await full(pm)).cards);
  expect(cards.slice(0,2).map(c=>c.decisionId)).toEqual([live,open]);
  expect(cards[0].actorEligibility.canVote).toBe(true);
 });

 test('OQ-47 (b) closed ballots follow by closing time, not by creation time; ties go to the newer ballot, then to the higher id',async()=>{
  const open=await liveBallot();
  await copies(open,10,'rejected');                  // created 1 to 10 minutes ago, each closed thirty seconds after its creation
  const byCreation=await newestFirst(open);
  const oldest=byCreation[9];                        // last by creation …
  await h.operator.query("UPDATE bom_proposals SET finished_at=now()-interval '10 seconds' WHERE id=$1",[oldest]);   // … and the most recently closed
  let cards=reassignments((await full(pm)).cards);
  expect(cards.map(c=>c.decisionId)).toEqual([open,oldest,...byCreation.slice(0,9)]);
  // two ballots closed at the same instant, the lower id made the one created later: creation decides before the id does
  const [low,high]=[byCreation[3],byCreation[6]].sort();
  await h.operator.query("UPDATE bom_proposals SET finished_at=date_trunc('second',now())-interval '5 seconds' WHERE id=ANY($1::uuid[])",[[low,high]]);
  await h.operator.query("UPDATE bom_proposals SET created_at=now()-interval '75 seconds' WHERE id=$1",[low]);
  await h.operator.query("UPDATE bom_proposals SET created_at=now()-interval '135 seconds' WHERE id=$1",[high]);
  cards=reassignments((await full(pm)).cards);
  expect(cards.slice(0,3).map(c=>c.decisionId)).toEqual([open,low,high]);
  // the same instant for closing and for creation: only then the higher id comes first
  await h.operator.query('UPDATE bom_proposals SET created_at=(SELECT created_at FROM bom_proposals WHERE id=$1) WHERE id=$2',[low,high]);
  cards=reassignments((await full(pm)).cards);
  expect(cards.slice(0,3).map(c=>c.decisionId)).toEqual([open,high,low]);
 });

 test('OQ-47 (b) a ballot closed after its expiry is ranked by its closing: a late vote closes it as expired and it becomes the first card of the rest',async()=>{
  const open=await liveBallot();
  await copies(open,31,'rejected');
  // expired twenty minutes ago and nobody closed it: no ballot is live, and it sits at the place of its expiry, after the twenty ballots closed since
  await h.operator.query("UPDATE bom_proposals SET created_at=now()-interval '9 days',expires_at=now()-interval '20 minutes' WHERE id=$1",[open]);
  const voter=seats.roster[0];
  let cards=reassignments((await full(voter)).cards);
  expect(cards.findIndex(c=>c.decisionId===open)).toBe(20);
  expect(cards[20]).toMatchObject({state:'pending',actorEligibility:{canVote:false,reason:'EXPIRED'}});
  // the command refuses the vote by closing the ballot as expired; from then on its place is its closing
  const closed=await new BomService(h.db).command(voter,{action:'vote',proposalId:open,choice:'agree',note:'Xác nhận bằng phiên thử nghiệm'},k());
  expect(closed.proposal.state).toBe('expired');
  expect(closed.votes).toHaveLength(0);
  cards=reassignments((await full(voter)).cards);
  expect(cards[0]).toMatchObject({decisionId:open,state:'expired',actorEligibility:{canVote:false,reason:'CLOSED'}});
 });

 test('a closed row with no closing time falls back to its creation time and cannot push out a ballot that has just closed',async()=>{
  const open=await liveBallot();
  await copies(open,31,'rejected');
  // inconsistent rows the service never writes (it sets the closing time whenever it closes a ballot): closed, no closing time, expiry still six days ahead
  await h.operator.query("UPDATE bom_proposals SET finished_at=NULL WHERE state='rejected'");
  const voter=seats.roster[0];
  await new BomService(h.db).command(voter,{action:'vote',proposalId:open,choice:'reject',note:'Từ chối trong bản thử nghiệm'},k());
  const cards=reassignments((await full(voter)).cards);
  expect(cards).toHaveLength(30);
  expect(cards[0]).toMatchObject({decisionId:open,state:'rejected'});
  expect(cards.slice(1).map(c=>c.decisionId)).toEqual((await newestFirst(open)).slice(0,29));
 });

 test('a person who holds no seat, a former seat, and a seat without its Telegram link learn nothing about the cut: the same answer with one ballot and with thirty-two',async()=>{
  const open=await liveBallot();
  await world();   // one review card, so the answers compared below are not empty
  // the third seat is replaced: that person stays frozen on the ballot but no longer holds a seat of the project
  const former=seats.roster[2];
  await h.operator.query('UPDATE bom_scopes SET seat_ids=$1 WHERE project_id=$2',[[seats.roster[0].id,seats.roster[1].id,seats.chair.id],ids.sales]);
  const outside=[reviewer,approver,former];
  const before=[];
  for(const p of outside) before.push(await full(p));
  await copies(open,31,'rejected');
  expect((await full(pm)).reassignmentCardsTruncated).toBe(true);   // control: a seat sees the flag
  for(const [i,p] of outside.entries()) {
   const r=await full(p);
   expect(reassignments(r.cards)).toHaveLength(0);
   expect(reviews(r.cards)).toHaveLength(1);
   expect(r.reassignmentCardsTruncated).toBe(false);
   expect(r).toEqual(before[i]);   // the whole answer, not only the flag: thirty-one more ballots moved nothing in it
  }
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[pm.id]);
  const unlinked=await full(pm);
  expect(reassignments(unlinked.cards)).toHaveLength(0);
  expect(unlinked.reassignmentCardsTruncated).toBe(false);
 });

 test('the seat and Telegram checks come before any ballot is read: a refused caller causes no statement on a ballot table',async()=>{
  const open=await liveBallot();
  await copies(open,31,'rejected');
  const seen:string[]=[];
  const spy=(q:{query:Function})=>({query:(sql:string,params?:unknown[])=>{seen.push(sql);return q.query(sql,params);}});
  const spyDb={...spy(h.db),transaction:(fn:Function)=>h.db.transaction(tx=>fn(spy(tx))),close:()=>h.db.close()} as unknown as typeof h.db;
  const ballotRead=/\bbom_(proposals|votes|receipts)\b|FROM work_items WHERE id=ANY/;
  // not a seat: refused on the scope row alone
  await refused(new BomService(spyDb).pending(reviewer,ids.sales),'SCOPE_DENIED',404);
  expect(seen.some(q=>/FROM bom_scopes/.test(q))).toBe(true);
  expect(seen.filter(q=>ballotRead.test(q))).toEqual([]);
  // a seat whose Telegram link is gone: refused after the membership read, still before any ballot
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[pm.id]);
  seen.length=0;
  await refused(new BomService(spyDb).pending(pm,ids.sales),'SCOPE_DENIED',403);
  expect(seen.some(q=>/bom_eligible_members/.test(q))).toBe(true);
  expect(seen.filter(q=>ballotRead.test(q))).toEqual([]);
  // control: for a linked seat the same spy does see the ballot read, after both checks
  seen.length=0;
  expect((await new BomService(spyDb).pending(seats.roster[0],ids.sales)).cards).toHaveLength(30);
  const at=(re:RegExp)=>seen.findIndex(q=>re.test(q));
  expect(at(/FROM bom_scopes/)).toBeGreaterThanOrEqual(0);
  expect(at(/bom_eligible_members/)).toBeGreaterThan(at(/FROM bom_scopes/));
  expect(at(/FROM bom_proposals WHERE project_id/)).toBeGreaterThan(at(/bom_eligible_members/));
 });
});
