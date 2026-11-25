import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {native,openHarness,type Harness} from './slice1-db';
import {bot,member,pm,seedSlice1,viewer} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent,type EventOverride} from './slice2-fixtures';
import {approver,mapDomain,reviewer,seedMembers} from './slice3-fixtures';
import {canaryHits,chatPool,hex,poolOverride,seedTech,techA,techB,techTelegram} from './pool-fixtures';
import {IntakeService} from '../src/server/intake';
import {PoolService} from '../src/server/intake-pool';
import {InboxService} from '../src/server/inbox';
import {WorkRequestService} from '../src/server/work-requests';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// GIAO VIỆC 5 B, T4 (triage of a pool item) and T5 (commands on the candidate of a project group).
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);await seedTech(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const CANARY='canary-5d2c80';
const cfg={chats:bridgeConfig.intake!.chats,excerptChats:[chatSales,chatPool],poolChats:[chatPool]};
const intake=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,cfg);
const pool=()=>new PoolService(h.db);
const inbox=()=>new InboxService(h.db,[chatSales,chatTransport]);
const requests=()=>new WorkRequestService(h.db);
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const rid=()=>randomUUID();
const NOTE='Đã xem xét và đồng ý tạo việc.';
const poolItem=async(o:EventOverride={})=>{
  const ack=await intake().ingest(messageEvent({...poolOverride(),...o,context:{...poolOverride().context,...o.context}}));
  return ack.sourceEventId;
};
const fileBody=(v:number,over:R={})=>({kind:'file_request',expectedVersion:v,projectId:ids.sales,classification:'request',requestKey:rid(),code:null,title:'Việc mới từ tin nhóm chung',
  priority:'normal',dueAt:null,criteria:'',specUrl:null,assigneeId:null,technicalId:null,businessId:null,...over});
const linkBody=(v:number,over:R={})=>({kind:'link_work',expectedVersion:v,projectId:ids.sales,classification:'request',workId:ids.pilot,...over});
const cmd=(p:Principal,id:string,body:R)=>pool().command(p,id,body,rid());
const itemRow=async(id:string)=>(await rows<R>('SELECT * FROM intake_pool_items WHERE id=$1',[id]))[0];
const poolKinds=async(id:string)=>(await rows<{kind:string}>('SELECT kind FROM intake_pool_events WHERE pool_item_id=$1 ORDER BY created_at,id',[id])).map(e=>e.kind);
// Tech member B also holds a project role in sales: an engineer there
const techBEngineer:Principal={...techB,projectIds:[ids.transport,ids.sales],role:'viewer',grants:[{projectId:ids.transport,role:'viewer',reportPermissions:[]},{projectId:ids.sales,role:'engineer',reportPermissions:[]}]};
const grantEngineer=()=>h.operator.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')",[ids.tenant,techB.id,ids.sales]);

describe('T4 triage of a pool item',()=>{
  test('(15) a Team Tech member with no grant in X files a request into X: pending, origin intake, the IN code in source_ref, two pool events, the item carries X',async()=>{
    const id=await poolItem();
    const card=await cmd(techA,id,fileBody(1));
    expect(card).toMatchObject({itemId:id,state:'assigned',projectId:ids.sales,classification:'request',version:2});
    const req=(await rows<R>('SELECT * FROM work_requests'))[0];
    expect(req).toMatchObject({state:'pending',origin:'intake',project_id:ids.sales,requester_id:techA.id});
    expect(String(req.source_ref)).toBe(`IN-${id.slice(0,8).toUpperCase()} · ${id}`);
    // nothing from Telegram's id space reaches the request, its events or the audit
    const message=String((await rows<R>('SELECT message_id FROM intake_pool_items'))[0].message_id);
    const trail=JSON.stringify([await rows('SELECT * FROM work_requests'),await rows('SELECT * FROM work_request_events'),await rows('SELECT * FROM intake_pool_events'),await rows('SELECT * FROM audit_events'),await rows('SELECT * FROM intake_work_links')]);
    expect(trail).not.toContain(chatPool);
    expect(trail).not.toContain('telegram:');
    expect(trail).not.toContain(`"message_id":"${message}"`);
    expect((await poolKinds(id)).sort()).toEqual(['pool.received','pool.request_filed','pool.triaged']);
    expect((await rows<R>('SELECT * FROM work_request_events')).map(e=>e.kind)).toEqual(['submitted']);
    // (14) the events come back in the order they were written, though they share one transaction clock; the payloads name no request and no work
    const events=(await pool().detail(techA,id)).events;
    expect(events.map(e=>e.kind)).toEqual(['pool.received','pool.triaged','pool.request_filed']);
    expect(JSON.stringify(events)).not.toMatch(/work_request_id|work_id|workRequestId/);
    expect(await n('intake_work_links')).toBe(1);
    expect((await rows<R>('SELECT * FROM intake_work_links'))[0]).toMatchObject({pool_item_id:id,work_request_id:req.id,project_id:ids.sales,created_by:techA.id});
    expect(await n('work_items')).toBe(6);   // nothing was created as work: a BoM seat has not approved
    // the BoM seat approves: another person, and only then work exists
    await requests().decide(pm,String(req.id),{decision:'approve',expectedVersion:1,serviceId:ids.salesService,code:null,note:NOTE,assigneeId:member.id,technicalId:null,businessId:null},'k-approve-0001');
    expect(await n('work_items')).toBe(7);
  });

  test('(3) a person off the roster, even a project manager, cannot read or command a pool item: SCOPE_DENIED',async()=>{
    const id=await poolItem();
    for(const p of [pm,member,viewer]){
      await expect(cmd(p,id,fileBody(1))).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
      await expect(pool().detail(p,id)).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
      expect(await pool().list(p,{})).toEqual({items:[],unassigned:0});
    }
    expect((await itemRow(id)).state).toBe('unassigned');
    expect(await n('work_requests')).toBe(0);
  });

  test('(16) the body cannot name origin, tenant, requester or sender; a bot is read-only',async()=>{
    const id=await poolItem();
    for(const extra of [{origin:'form'},{tenantId:ids.otherTenant},{requesterId:pm.id},{senderId:pm.id},{actorId:pm.id},{state:'assigned'}])
      await expect(cmd(techA,id,fileBody(1,extra))).rejects.toBeInstanceOf(ZodError);
    await expect(cmd(techA,id,{kind:'dismiss',expectedVersion:1,code:'not_work',reason:'ghi chú tự do'})).rejects.toBeInstanceOf(ZodError);
    await expect(cmd(bot,id,fileBody(1))).rejects.toMatchObject({code:'READ_ONLY',status:403});
    await expect(pool().list(bot,{})).rejects.toMatchObject({code:'READ_ONLY',status:403});
    expect(await n('work_requests')).toBe(0);
    expect((await itemRow(id)).version).toBe(1);
  });

  test('(17) the same key and content give the old result with one request and one link; a stale version is REVISION_CONFLICT; another content under the key is refused',async()=>{
    const id=await poolItem();
    const body=fileBody(1);
    const first=await cmd(techA,id,body);
    const again=await cmd(techA,id,body);
    expect(again).toMatchObject({itemId:id,state:'assigned',version:2});
    expect(await n('work_requests')).toBe(1);
    expect(await n('intake_work_links')).toBe(1);
    expect(await poolKinds(id)).toHaveLength(3);
    expect(first.version).toBe(2);
    await expect(cmd(techA,id,{...body,title:'Nội dung khác dưới cùng một mã'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT',status:409});
    // a new key with the version the item had before: conflict, and the request it would have filed is not left behind
    await expect(cmd(techA,id,fileBody(1))).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});
    expect(await n('work_requests')).toBe(1);
    expect(await n('intake_work_links')).toBe(1);
    expect((await itemRow(id)).version).toBe(2);
    // a second request from the same assigned item (same project, the current version) is allowed (B4 reading: one message may lead to several requests)
    await cmd(techA,id,fileBody(2));
    expect(await n('work_requests')).toBe(2);
    expect((await itemRow(id)).version).toBe(3);
    // another project once assigned
    await expect(cmd(techA,id,fileBody(3,{projectId:ids.transport}))).rejects.toMatchObject({code:'POOL_ASSIGNED',status:409});
  });

  test('(18) linking existing work: a viewer in X or a Tech member without a right in X is refused; an engineer or a BoM seat of X may; work of another project is SCOPE_DENIED',async()=>{
    const id=await poolItem();
    // techA holds viewer in transport, nothing in sales
    await expect(cmd(techA,id,linkBody(1))).rejects.toMatchObject({code:'LINK_DENIED',status:403});
    await expect(cmd(techA,id,linkBody(1,{projectId:ids.transport,workId:ids.transportWork}))).rejects.toMatchObject({code:'LINK_DENIED',status:403});
    expect((await itemRow(id)).state).toBe('unassigned');
    expect(await n('intake_work_links')).toBe(0);
    // techB becomes an engineer in sales
    await grantEngineer();
    await expect(cmd(techBEngineer,id,linkBody(1,{workId:ids.transportWork}))).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
    await expect(cmd(techBEngineer,id,linkBody(1,{workId:rid()}))).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
    expect(await n('intake_work_links')).toBe(0);
    const card=await cmd(techBEngineer,id,linkBody(1));
    expect(card).toMatchObject({state:'assigned',projectId:ids.sales,version:2});
    expect(await poolKinds(id)).toEqual(expect.arrayContaining(['pool.triaged','pool.work_linked']));
    expect((await rows<R>('SELECT * FROM intake_work_links'))[0]).toMatchObject({pool_item_id:id,work_id:ids.pilot,work_request_id:null,created_by:techB.id});
  });

  test('(18) a BoM seat of X who is a viewer there may link',async()=>{
    const id=await poolItem();
    await h.operator.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')",[ids.tenant,techB.id,ids.sales]);
    await h.operator.query('UPDATE bom_scopes SET seat_ids=$2 WHERE project_id=$1',[ids.sales,[techB.id,reviewer.id,approver.id]]);
    const seat:Principal={...techB,projectIds:[ids.transport,ids.sales],grants:[{projectId:ids.transport,role:'viewer',reportPermissions:[]},{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
    const card=await cmd(seat,id,linkBody(1));
    expect(card).toMatchObject({state:'assigned',projectId:ids.sales});
  });

  test('(19) linking the same pair again, even with an old version, adds no row and no event and keeps the version',async()=>{
    const id=await poolItem();
    await grantEngineer();
    await cmd(techBEngineer,id,linkBody(1));
    const kinds=await poolKinds(id);
    const again=await cmd(techBEngineer,id,linkBody(2));
    expect(again).toMatchObject({version:2});
    // an old client repeating its first command (stale version) gets the same answer
    expect(await cmd(techBEngineer,id,linkBody(1))).toMatchObject({version:2});
    expect(await n('intake_work_links')).toBe(1);
    expect(await poolKinds(id)).toEqual(kinds);
    expect((await itemRow(id)).version).toBe(2);
  });

  test.runIf(native)('(19) three simultaneous links of the same pair by one person leave one row (native)',async()=>{
    const id=await poolItem();
    await grantEngineer();
    const results=await Promise.allSettled([cmd(techBEngineer,id,linkBody(1)),cmd(techBEngineer,id,linkBody(1)),cmd(techBEngineer,id,linkBody(1))]);
    expect(results.filter(r=>r.status==='fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await n('intake_work_links')).toBe(1);
    expect((await itemRow(id)).version).toBe(2);
  });

  test('(20) dismissing takes one of three codes; opening again: a dismissed item yes; an assigned item with a pending request no; once the only request is rejected, the person who can read that rejection opens it and the card forgets the old assignment',async()=>{
    const id=await poolItem();
    for(const code of ['other','','Not_work']) await expect(cmd(techA,id,{kind:'dismiss',expectedVersion:1,code})).rejects.toBeInstanceOf(ZodError);
    const dismissed=await cmd(techA,id,{kind:'dismiss',expectedVersion:1,code:'not_work'});
    expect(dismissed).toMatchObject({state:'dismissed',version:2,projectId:null});
    await expect(cmd(techA,id,fileBody(2))).rejects.toMatchObject({code:'POOL_DISMISSED',status:409});
    const reopened=await cmd(techB,id,{kind:'reopen',expectedVersion:2});
    expect(reopened).toMatchObject({state:'unassigned',version:3});
    await expect(cmd(techB,id,{kind:'reopen',expectedVersion:3})).rejects.toMatchObject({code:'POOL_TRANSITION_INVALID',status:409});
    // assigned with a pending request
    await cmd(techA,id,fileBody(3));
    await expect(cmd(techA,id,{kind:'reopen',expectedVersion:4})).rejects.toMatchObject({code:'POOL_ASSIGNED',status:409});
    await expect(cmd(techA,id,{kind:'dismiss',expectedVersion:4,code:'duplicate'})).rejects.toMatchObject({code:'POOL_ASSIGNED',status:409});
    // a BoM seat rejects the only request; the requester reads the rejection and may open the item again
    const req=(await rows<{id:string}>('SELECT id FROM work_requests'))[0].id;
    await requests().decide(pm,req,{decision:'reject',expectedVersion:1,serviceId:null,code:null,note:'Chưa đủ thông tin để tạo việc.'},'k-reject-0001');
    const open=await cmd(techA,id,{kind:'reopen',expectedVersion:4});
    expect(open).toMatchObject({state:'unassigned',projectId:null,version:5});
    // (4) the card of the open item shows none of the earlier assignment: not the rejection, not the old project
    expect(open.links).toEqual([]);
    expect(open.trail).toMatchObject({label:'Đã nhận — chưa gán dự án',waitingOn:'người phân loại (Team Tech)'});
    expect((await pool().detail(techA,id)).card.trail.label).toBe('Đã nhận — chưa gán dự án');
    expect(await poolKinds(id)).toEqual(expect.arrayContaining(['pool.dismissed','pool.reopened']));
    // and may be assigned again, to another project
    await cmd(techA,id,fileBody(5,{projectId:ids.transport}));
    expect((await itemRow(id)).project_id).toBe(ids.transport);
    expect((await pool().detail(techA,id)).card.links).toHaveLength(1);
  });

  test('(7) reopen answers the same to a roster member whatever the BoM decided; only a reader of the rejection opens the item',async()=>{
    const same:string[]=[];
    const attempt=async(id:string,v:number)=>cmd(techB,id,{kind:'reopen',expectedVersion:v}).then(()=>{throw new Error('expected a refusal');},e=>{expect(e).toMatchObject({code:'POOL_ASSIGNED',status:409});same.push(e.message);});
    // pending
    const pending=await poolItem();
    await cmd(techA,pending,fileBody(1));
    await attempt(pending,2);
    // approved (the seat approves; the work now exists)
    const approved=await poolItem();
    await cmd(techA,approved,fileBody(1));
    const reqs=await rows<{id:string}>('SELECT id FROM work_requests ORDER BY created_at DESC,id');
    const second=(await rows<{id:string}>('SELECT work_request_id id FROM intake_work_links WHERE pool_item_id=$1',[approved]))[0].id;
    await requests().decide(pm,second,{decision:'approve',expectedVersion:1,serviceId:ids.salesService,code:null,note:NOTE,assigneeId:member.id,technicalId:null,businessId:null},'k-approve-0007');
    await attempt(approved,2);
    // rejected
    const rejected=await poolItem();
    await cmd(techA,rejected,fileBody(1));
    const third=(await rows<{id:string}>('SELECT work_request_id id FROM intake_work_links WHERE pool_item_id=$1',[rejected]))[0].id;
    await requests().decide(pm,third,{decision:'reject',expectedVersion:1,serviceId:null,code:null,note:'Chưa đủ thông tin để tạo việc.'},'k-reject-0007');
    await attempt(rejected,2);
    expect(new Set(same).size).toBe(1);
    expect(same[0]).toBe('Không mở lại được mục này.');
    void reqs;
    // the requester reads the rejection and opens it; the approved one stays closed to the requester too
    await expect(cmd(techA,approved,{kind:'reopen',expectedVersion:2})).rejects.toMatchObject({code:'POOL_ASSIGNED'});
    expect(await cmd(techA,rejected,{kind:'reopen',expectedVersion:2})).toMatchObject({state:'unassigned'});
  });

  test('(1) an edit of a message that was assigned or dismissed is a revision: the count rises, one pool.revised, no error',async()=>{
    for(const how of ['assigned','dismissed'] as const){
      const e=messageEvent({...poolOverride(),context:{...poolOverride().context}});
      const id=(await intake().ingest(e)).sourceEventId;
      if(how==='assigned') await cmd(techA,id,fileBody(1));else await cmd(techA,id,{kind:'dismiss',expectedVersion:1,code:'not_work'});
      const before=(await itemRow(id)).version as number;
      const edited={...e,editedAt:new Date(Date.parse(e.observedAt)+60000).toISOString(),contentHash:hex('edit-'+how)};
      const ack=await intake().ingest(edited);
      expect(ack).toMatchObject({replayed:false,sourceEventId:id});
      expect(await itemRow(id)).toMatchObject({state:how,revision_count:1,content_hash:hex('edit-'+how),version:before+1});
      expect((await poolKinds(id)).filter(k=>k==='pool.revised')).toHaveLength(1);
      expect((await intake().ingest(edited)).replayed).toBe(true);
    }
  });

  test('(8) after assignment to a project of the IBS HI domain the canary is still in no column of any table',async()=>{
    await mapDomain(h,ids.sales,'IBS_HI');
    const id=await poolItem({text:`${CANARY} nội dung`,actorLabel:`Người ${CANARY}`,attachment:{state:'stored',locator:'gw://libetech/attachments/'+'b'.repeat(64),sha256:'b'.repeat(64),mimeType:'application/pdf',sizeBytes:10,fileName:`${CANARY}.pdf`}});
    expect(await canaryHits(h,CANARY)).toEqual([]);
    await cmd(techA,id,fileBody(1));
    expect(await n('work_requests')).toBe(1);
    expect(await canaryHits(h,CANARY)).toEqual([]);
    const card=await pool().detail(techA,id);
    expect(JSON.stringify(card)).not.toContain(CANARY);
  });
});

const asRoleLinks=(person:string,projects:string[])=>h.operator.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE libetech_runtime');
  await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)",[ids.tenant,projects.join(','),person]);
  return (await tx.query('SELECT id FROM intake_work_links')).rows.length;
});

describe('T5 commands on the candidate of a project group',()=>{
  const ingest=async(o:EventOverride={})=>{
    const ack=await intake().ingest(messageEvent(o));
    return (await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
  };
  const confirmed=async(o:EventOverride={})=>{
    const id=await ingest(o);
    await inbox().command(pm,id,{kind:'confirm',expectedVersion:1,classification:'request'},rid(),rid());
    return id;
  };
  const fileCandidate=(v:number,over:R={})=>{const {projectId:_p,classification:_c,kind:_k,...rest}=fileBody(v,over);void _p;void _c;void _k;return {kind:'file_request',...rest};};
  const linkCandidate=(v:number,over:R={})=>({kind:'link_work',expectedVersion:v,workId:ids.pilot,...over});
  const run=(p:Principal,id:string,body:R)=>inbox().command(p,id,body,rid(),rid());

  test('(21) a candidate that is not confirmed gives CANDIDATE_NOT_CONFIRMED to file_request and link_work',async()=>{
    const id=await ingest();
    await expect(run(pm,id,fileCandidate(1))).rejects.toMatchObject({code:'CANDIDATE_NOT_CONFIRMED',status:409});
    await expect(run(pm,id,linkCandidate(1))).rejects.toMatchObject({code:'CANDIDATE_NOT_CONFIRMED',status:409});
    expect(await n('work_requests')).toBe(0);
    expect(await n('intake_work_links')).toBe(0);
  });

  test('(22) file_request files a pending request; the text of the message is not copied, even for a group that stores text',async()=>{
    const id=await confirmed({text:`${CANARY} mô tả sự cố`});
    const stored=(await rows<R>('SELECT text_excerpt FROM source_event_revisions'))[0];
    expect(String(stored.text_excerpt)).toContain(CANARY);          // the group stores text, so the canary is in the revision (and only there)
    // (12) PR A's submit rule: a Team Tech member or the manager of the project; an engineer who reads the candidate is refused
    await expect(run(member,id,fileCandidate(2))).rejects.toMatchObject({code:'WORK_REQUEST_DENIED',status:403});
    expect(await n('work_requests')).toBe(0);
    const card=await run(pm,id,fileCandidate(2));
    expect(card).toMatchObject({state:'confirmed',version:3});
    const req=(await rows<R>('SELECT * FROM work_requests'))[0];
    expect(req).toMatchObject({state:'pending',origin:'intake',project_id:ids.sales,requester_id:pm.id});
    expect(String(req.source_ref)).toBe(`IN-${id.slice(0,8).toUpperCase()} · ${id}`);
    expect(JSON.stringify(req)).not.toContain(CANARY);
    expect(JSON.stringify(await rows('SELECT * FROM work_request_events'))).not.toContain(CANARY);
    expect((await rows<R>('SELECT kind FROM intake_events WHERE entity_id=$1 ORDER BY created_at,id',[id])).map(e=>e.kind)).toContain('candidate.request_filed');
    expect(await n('intake_work_links')).toBe(1);
    // a viewer does not read the candidate at all
    await expect(run(viewer,id,fileCandidate(3))).rejects.toMatchObject({code:'SCOPE_DENIED'});
    // the same key again: no second request
    const body=fileCandidate(3);
    await run(pm,id,body);
    await run(pm,id,body);
    expect(await n('work_requests')).toBe(2);
    // the request cannot name another project: the body has no projectId
    await expect(run(pm,id,{...fileCandidate(4),projectId:ids.transport})).rejects.toBeInstanceOf(ZodError);
  });

  test('(23) link_work by a viewer is refused like any non-reader; by an engineer it links; again changes nothing; the candidate keeps its state and moves one version',async()=>{
    const transportCandidate=await ingest({context:{chatId:chatTransport}});
    await inbox().command(pm,transportCandidate,{kind:'confirm',expectedVersion:1,classification:'incident'},rid(),rid());
    // the demo viewer holds only the transport project, role viewer
    await expect(run(viewer,transportCandidate,linkCandidate(2,{workId:ids.transportWork}))).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
    expect(await n('intake_work_links')).toBe(0);
    const id=await confirmed();
    const card=await run(member,id,linkCandidate(2));
    expect(card).toMatchObject({state:'confirmed',version:3});
    expect(await n('intake_work_links')).toBe(1);
    expect((await rows<R>('SELECT * FROM intake_work_links'))[0]).toMatchObject({candidate_id:id,work_id:ids.pilot,pool_item_id:null,created_by:member.id});
    const events=(await rows('SELECT 1 FROM intake_events WHERE entity_id=$1',[id])).length;
    const again=await run(member,id,linkCandidate(3));
    expect(again).toMatchObject({state:'confirmed',version:3});
    expect(await n('intake_work_links')).toBe(1);
    expect((await rows('SELECT 1 FROM intake_events WHERE entity_id=$1',[id])).length).toBe(events);
    // work of another project is out of reach
    await expect(run(member,id,linkCandidate(3,{workId:ids.transportWork}))).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
    // a stale version on a new link
    await expect(run(member,id,linkCandidate(2,{workId:'13000000-0000-4000-8000-000000000002'}))).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});
    expect(await n('intake_work_links')).toBe(1);
  });
  test('(23) a BoM seat whose project role is viewer is refused like any non-reader and gets no card, even though it may link; an engineer and a manager still link',async()=>{
    const id=await confirmed({text:`${CANARY} mô tả`});
    await h.operator.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')",[ids.tenant,techB.id,ids.sales]);
    await h.operator.query('UPDATE bom_scopes SET seat_ids=$2 WHERE project_id=$1',[ids.sales,[techB.id,reviewer.id,approver.id]]);
    const seat:Principal={...techB,projectIds:[ids.sales],role:'viewer',grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
    // the database would let this person link (a seat); the service refuses before anything is read or written
    expect((await rows<{ok:boolean}>("SELECT true ok FROM bom_scopes WHERE $1::uuid=ANY(seat_ids)",[techB.id]))).toHaveLength(1);
    const e=await run(seat,id,linkCandidate(2)).then(()=>{throw new Error('expected a refusal');},x=>x);
    expect(e).toMatchObject({code:'SCOPE_DENIED',status:404});
    expect(JSON.stringify(e)).not.toContain(CANARY);
    // the same refusal as a person outside the project
    const outside=await run(viewer,id,linkCandidate(2)).then(()=>{throw new Error('expected a refusal');},x=>x);
    expect(outside).toMatchObject({code:e.code,status:e.status,message:e.message});
    expect(await n('intake_work_links')).toBe(0);
    expect((await rows<R>('SELECT version FROM intake_candidates WHERE id=$1',[id]))[0].version).toBe(2);
    await run(member,id,linkCandidate(2));
    await run(pm,id,linkCandidate(3,{workId:'13000000-0000-4000-8000-000000000002'}));
    expect(await n('intake_work_links')).toBe(2);
  });
  test('(5) an engineer of the project who is not the requester, decider or seat sees no link, no requester name and neutral copy on the candidate',async()=>{
    // A (024) reads work_requests only for the requester, the decider and a BoM seat; the engineer is none of them, and the link policy asks work_requests.
    const id=await confirmed();
    await run(pm,id,fileCandidate(2));
    expect(await n('intake_work_links')).toBe(1);
    const seen=await inbox().list(member,{projectId:ids.sales});
    const mine=seen.items.find(c=>c.candidateId===id)!;
    expect(JSON.stringify(mine.trail)).not.toContain(pm.name);
    expect(mine.trail.label).not.toMatch(/chưa tạo việc|đã tạo|đã giao/i);
    expect(mine.trail.steps.find(x=>x.key==='request')!.label).toBe('Chưa thấy yêu cầu hay liên kết việc nào trong phạm vi của bạn');
    const direct=await asRoleLinks(member.id,[ids.sales]);
    expect(direct).toBe(0);
    // the filer still sees its own
    expect((await inbox().list(pm,{projectId:ids.sales})).items.find(c=>c.candidateId===id)!.trail.label).toBe('Đã lập yêu cầu — chờ BoM duyệt');
  });
});

void techTelegram;
