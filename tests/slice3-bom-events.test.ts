import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {approver,reviewer,seedBom} from './slice3-fixtures';
import {BomService} from '../src/server/bom';
import {InboxService} from '../src/server/inbox';
import {IntakeService} from '../src/server/intake';
import {scoped} from '../src/server/db';
import {demoProfiles,ids} from '../src/server/identities';
import {demoSha} from '../src/server/seed';
import {WorkService} from '../src/server/service';
import type {Principal} from '../src/server/types';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const key=()=>randomUUID();
const sha='8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab';
const n=async(sql:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${sql}`)).rows[0].n);
const propose=(bom:BomService,s:Awaited<ReturnType<typeof seedBom>>,allocation=s.selection,priorId?:string)=>
  bom.command(pm,{action:'propose',workId:s.workId,expectedVersion:1,allocation,reason:'Phân công mô phỏng trong bản thử',priorId},key());
const agree=(bom:BomService,id:string,p:Principal,requestKey=key())=>
  bom.command(p,{action:'vote',proposalId:id,choice:'agree',note:'Xác nhận bằng phiên thử nghiệm'},requestKey);
const reviseCommand=(assigneeId:string)=>({kind:'revise',expectedVersion:1,assigneeId,technicalId:demoProfiles.technical.id,businessId:demoProfiles.business.id,
  sourceSha:sha,criteria:'Tiêu chí thử nghiệm đủ dài',specUrl:'https://example.com/spec',dueAt:null,note:'Thử ghi theo đường tắt'});

test('DOC-09/T06 two agrees change nothing: assignment, version and receipts stay',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db),work=new WorkService(h.db);
  const before=(await work.detail(pm,s.workId)).work;
  const {proposal:{id}}=await propose(bom,s);
  await agree(bom,id,s.roster[0]);
  const second=await agree(bom,id,s.roster[1]);
  expect(second).toMatchObject({proposal:{state:'pending'},receipt:null});
  expect(second.votes).toHaveLength(2);
  expect((await work.detail(pm,s.workId)).work).toEqual(before);
  expect(before).toMatchObject({assignee_id:member.id,version:1});
  expect(await n('bom_receipts')).toBe(0);
  expect(await n("audit_events WHERE kind='bom_allocation_applied'")).toBe(0);
});

test('DOC-09/T07 the third agree applies once with exactly one receipt',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db),work=new WorkService(h.db);
  const before=(await work.detail(pm,s.workId)).work;
  const {proposal:{id}}=await propose(bom,s);
  await agree(bom,id,s.roster[0]);await agree(bom,id,s.roster[1]);
  const lastKey=key();
  const final=await agree(bom,id,s.roster[2],lastKey);
  expect(final).toMatchObject({proposal:{state:'applied'},receipt:{proposal_id:id,work_version:2}});
  expect(final.votes).toHaveLength(3);
  expect(await n('bom_receipts')).toBe(1);
  expect(await n("audit_events WHERE kind='bom_allocation_applied'")).toBe(1);
  const after=(await work.detail(pm,s.workId)).work;
  expect(after).toMatchObject({assignee_id:pm.id,version:2,revision:before.revision});
  const replay=await agree(bom,id,s.roster[2],lastKey);
  expect(replay.receipt).toEqual(final.receipt);
  expect(await n('bom_receipts')).toBe(1);
  expect(await n("audit_events WHERE kind='bom_allocation_applied'")).toBe(1);
  expect((await work.detail(pm,s.workId)).work.version).toBe(2);
});

test('PM-05 reject and revise end the round; a changed source or a revoked link holds the vote for reconciliation',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db),work=new WorkService(h.db);
  const before=(await work.detail(pm,s.workId)).work;
  const same=async()=>{expect((await work.detail(pm,s.workId)).work).toEqual(before);expect(await n('bom_receipts')).toBe(0);};
  const vote=(id:string,choice:'reject'|'revise')=>bom.command(s.roster[2],{action:'vote',proposalId:id,choice,note:'Cần xem lại phương án'},key());
  // 1 reject
  const rejected=(await propose(bom,s)).proposal.id;
  await agree(bom,rejected,s.roster[1]);
  expect(await vote(rejected,'reject')).toMatchObject({proposal:{state:'rejected'},receipt:null});
  await expect(agree(bom,rejected,s.roster[0])).rejects.toMatchObject({code:'PROPOSAL_CLOSED'});
  await same();
  // 2 revise
  const revised=(await propose(bom,s)).proposal.id;
  await agree(bom,revised,s.roster[1]);
  expect(await vote(revised,'revise')).toMatchObject({proposal:{state:'revise'},receipt:null});
  await expect(agree(bom,revised,s.roster[0])).rejects.toMatchObject({code:'PROPOSAL_CLOSED'});
  await same();
  // 3 source changed after 2/3
  const drift=(await propose(bom,s)).proposal.id;
  await agree(bom,drift,s.roster[0]);await agree(bom,drift,s.roster[1]);
  await h.operator.query("UPDATE bom_sources SET fingerprint=$1 WHERE work_id=$2",['f'.repeat(64),s.workId]);
  expect(await agree(bom,drift,s.roster[2])).toMatchObject({proposal:{state:'reconcile'},receipt:null});
  await same();
  // 4 Telegram link revoked after 2/3 (the source was changed above, so the next proposal records the changed fingerprint)
  const revoked=(await propose(bom,s)).proposal.id;
  await agree(bom,revoked,s.roster[0]);await agree(bom,revoked,s.roster[1]);
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[member.id]);
  expect(await agree(bom,revoked,s.roster[2])).toMatchObject({proposal:{state:'reconcile'},receipt:null});
  await same();
  expect(await n("bom_proposals WHERE state='applied'")).toBe(0);
});

test('PM-05/T15 every shortcut around 3/3 is refused',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db),work=new WorkService(h.db);
  const before=(await work.detail(pm,s.workId)).work;
  const third=s.roster[2];
  await expect(work.command(pm,s.workId,reviseCommand(third.id),key())).rejects.toMatchObject({code:'BOM_REQUIRED'});
  await expect(scoped(h.db,pm,tx=>tx.query('UPDATE work_items SET assignee_id=$2 WHERE id=$1',[s.workId,third.id])))
    .rejects.toThrow('BoM receipt with 3/3 votes required');
  // a runtime-written receipt for a proposal with only two agrees does not unlock the guard
  const {proposal:{id}}=await propose(bom,s);
  await agree(bom,id,s.roster[0]);await agree(bom,id,s.roster[1]);
  await expect(scoped(h.db,pm,async tx=>{
    await tx.query('INSERT INTO bom_receipts(proposal_id,tenant_id,project_id,work_id,work_version,source_checked_at) VALUES($1,$2,$3,$4,2,now())',[id,ids.tenant,ids.sales,s.workId]);
    await tx.query('UPDATE work_items SET assignee_id=$2,version=2 WHERE id=$1',[s.workId,pm.id]);
  })).rejects.toThrow('BoM receipt with 3/3 votes required');
  for(const cmd of [
    {action:'propose',workId:s.workId,expectedVersion:1,allocation:s.selection,reason:'Bot thử đề xuất phân công'},
    {action:'vote',proposalId:id,choice:'agree',note:'Bot thử bỏ phiếu'},
  ]) await expect(bom.command(bot,cmd,key())).rejects.toMatchObject({code:'SCOPE_DENIED'});
  expect((await work.detail(pm,s.workId)).work).toEqual(before);
  expect(await n('bom_receipts')).toBe(0);
});

async function pilotCommand(work:WorkService,p:Principal,command:Record<string,unknown>) {
  const current=await work.detail(pm,ids.pilot);
  return work.command(p,ids.pilot,{expectedVersion:current.work.version,...command},key());
}

test('PM-06 technical and business acceptance are separate events by different people; closing the ticket replaces neither',async()=>{
  const work=new WorkService(h.db);
  const closed=await pilotCommand(work,pm,{kind:'close_ticket',ticketRef:'DEMO-TICKET-1',note:'Đã phản hồi khách trong phép thử.'});
  expect(closed.acceptance).toEqual({technical:false,business:false});
  await expect(pilotCommand(work,pm,{kind:'transition',state:'done',note:'Thử hoàn thành'})).rejects.toMatchObject({code:'ACCEPTANCE_REQUIRED'});
  const d=await work.detail(pm,ids.pilot);
  await pilotCommand(work,reviewer,{kind:'technical_accept',sourceSha:demoSha,revision:d.work.revision,evidenceId:d.evidence.find(e=>e.kind==='checks')!.id,confirmed:true,note:'Đã kiểm tra tiêu chí kỹ thuật trong phép thử.'});
  await expect(pilotCommand(work,pm,{kind:'transition',state:'done',note:'Thiếu UAT'})).rejects.toMatchObject({code:'ACCEPTANCE_REQUIRED'});
  const withUat=await pilotCommand(work,approver,{kind:'evidence',evidenceKind:'uat',sourceId:'https://example.com/demo/uat',sourceType:'manual',sourceSha:demoSha,note:'Biên bản UAT mô phỏng có xác nhận người được giao.'});
  const both=await pilotCommand(work,approver,{kind:'business_accept',sourceSha:demoSha,revision:withUat.work.revision,evidenceId:withUat.evidence.find(e=>e.kind==='uat')!.id,confirmed:true,note:'Đã kiểm tra nghiệp vụ theo tiêu chí mô phỏng.'});
  expect(both.acceptance).toEqual({technical:true,business:true});
  const tech=both.events.find(e=>e.kind==='technical_accept')!,biz=both.events.find(e=>e.kind==='business_accept')!;
  expect(tech.actor_id).toBe(reviewer.id);expect(biz.actor_id).toBe(approver.id);
  expect(tech.actor_id).not.toBe(biz.actor_id);
  expect(tech.payload).toMatchObject({revision:d.work.revision,sourceSha:demoSha});
  expect(biz.payload).toMatchObject({revision:d.work.revision,sourceSha:demoSha});
  expect(tech.created_at).toBeTruthy();expect(biz.created_at).toBeTruthy();
  // two separate events, not one row read twice; the business one was written after the technical one (not asserted unequal: both may share a millisecond)
  expect(tech.id).not.toBe(biz.id);
  expect(new Date(tech.created_at).getTime()).toBeLessThanOrEqual(new Date(biz.created_at).getTime());
  expect(both.events.filter(e=>e.kind==='close_ticket')).toHaveLength(1);
});

test('DOC-08/T17 the implementer cannot accept own work, also after reassignment through 3/3',async()=>{
  const s=await seedBom(h);
  const bom=new BomService(h.db),work=new WorkService(h.db);
  const {proposal:{id}}=await propose(bom,s);
  for(const seat of [s.roster[1],s.roster[0],s.roster[2]]) await agree(bom,id,seat);
  // revision:1 and the random evidenceId are never reached: the self-acceptance refusal comes before either is checked
  const accept=(kind:'technical_accept'|'business_accept')=>({kind,expectedVersion:2,sourceSha:sha,revision:1,evidenceId:randomUUID(),confirmed:true,note:'Thử nghiệm thu sau khi đổi vai'});
  expect((await work.detail(pm,s.workId)).work).toMatchObject({assignee_id:pm.id,version:2});
  // the new assignee and the previous assignee (a participant on the receipt) are both the implementer side
  for(const p of [pm,member]) for(const kind of ['technical_accept','business_accept'] as const)
    await expect(work.command(p,s.workId,accept(kind),key()),`${p.name} ${kind}`).rejects.toMatchObject({code:'SELF_ACCEPTANCE'});
  // a seat that took no part in the assignment is not the assigned acceptor either
  await expect(work.command(s.roster[2],s.workId,accept('technical_accept'),key())).rejects.toMatchObject({code:'WRONG_ACCEPTOR'});
  // the pilot item: the implementer, then a wrong role
  const d=await work.detail(pm,ids.pilot);
  const payload={kind:'technical_accept',sourceSha:demoSha,revision:1,evidenceId:d.evidence[0].id,confirmed:true,note:'Kiểm nghiệm quyền thực hiện'};
  await expect(pilotCommand(work,member,payload)).rejects.toMatchObject({code:'SELF_ACCEPTANCE'});
  await expect(pilotCommand(work,pm,payload)).rejects.toMatchObject({code:'WRONG_ACCEPTOR'});
});

test('T18 a closed ticket leaves acceptance missing and the work in review',async()=>{
  const work=new WorkService(h.db);
  const before=await work.detail(pm,ids.pilot);
  expect(before.work.state).toBe('review');
  const overviewBefore=(await work.overview(pm)).summary;
  const closed=await pilotCommand(work,pm,{kind:'close_ticket',ticketRef:'DEMO-TICKET-2',note:'Ghi nhận đóng độc lập.'});
  expect(closed.work.state).toBe('review');
  expect(closed.work.revision).toBe(before.work.revision);
  expect(closed.acceptance).toEqual({technical:false,business:false});
  expect(closed.events.find(e=>e.kind==='close_ticket')!.payload).toMatchObject({changesAcceptance:false,changesWorkState:false});
  expect((await work.overview(pm)).summary).toEqual(overviewBefore);
  expect(overviewBefore.done).toBe(0);
  await expect(pilotCommand(work,pm,{kind:'transition',state:'done',note:'Đóng ticket không phải nghiệm thu'})).rejects.toMatchObject({code:'ACCEPTANCE_REQUIRED'});
  expect((await work.detail(pm,ids.pilot)).work.state).toBe('review');
});

test('incident intake is not gated by 3/3',async()=>{
  await seedBom(h);
  expect(await n('bom_scopes WHERE enabled AND project_id=\''+ids.sales+'\'')).toBe(1);
  const chats=bridgeConfig.intake!.chats;
  const ack=await new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats}).ingest(messageEvent({text:'Sự cố mẫu: cổng bán hàng chậm'}));
  const cand=(await h.operator.query<{id:string;project_id:string}>('SELECT id,project_id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId])).rows[0];
  expect(cand.project_id).toBe(ids.sales);
  const works=await n('work_items');
  const card=await new InboxService(h.db,[chatSales,chatTransport]).command(pm,cand.id,{kind:'confirm',expectedVersion:1,classification:'incident'},key(),randomUUID());
  expect(card).toMatchObject({state:'confirmed',classification:'incident'});
  expect(await n('bom_proposals')).toBe(0);
  expect(await n('bom_receipts')).toBe(0);
  expect(await n('work_items')).toBe(works);
});
