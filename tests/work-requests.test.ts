import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {approver,reviewer,seedMembers,transportApprover} from './slice3-fixtures';
import {WorkRequestService,publicRequest} from '../src/server/work-requests';
import {WorkService} from '../src/server/service';
import {handleApi} from '../src/server/http';
import {COOKIE,createSession} from '../src/server/auth';
import {scoped,type Database} from '../src/server/db';
import {demoProfiles,ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

type R=Record<string,unknown>;
const techId='14000000-0000-4000-8000-000000000077';
// A Team Tech member who holds one grant (viewer, transport) and none in sales.
const tech:Principal={id:techId,tenantId:ids.tenant,projectIds:[ids.transport],name:'Thành viên Tech thử',role:'viewer',
  grants:[{projectId:ids.transport,role:'viewer',reportPermissions:[]}]};
const NOTE='Đã xem xét và đồng ý tạo việc.';

let h:Harness;
beforeEach(async()=>{
  h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'wr-tech',$3,'viewer','fixture-only')`,[tech.id,tech.tenantId,tech.name]);
  await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,tech.id,ids.transport]);
  await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,tech.id]);
  // the three BoM seats of the sales project: pm, reviewer, approver; each with Telegram linked
  for(const [i,p] of [pm,reviewer,approver].entries())
    await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[ids.tenant,p.id,String(920100+i)]);
  await h.operator.query('INSERT INTO bom_scopes(tenant_id,project_id,seat_ids,enabled) VALUES($1,$2,$3,true)',[ids.tenant,ids.sales,[pm.id,reviewer.id,approver.id]]);
});
afterEach(async()=>{await h.reset();await h.close();});

const svc=()=>new WorkRequestService(h.db);
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const input=(over:R={})=>({projectId:ids.sales,requestKey:randomUUID(),code:null,title:'Việc mới do Tech gửi để duyệt',priority:'normal',dueAt:null,criteria:'',specUrl:null,assigneeId:null,technicalId:null,businessId:null,...over});
const file=async(over:R={},who:Principal=tech)=>(await svc().submit(who,input(over))).request;
const decision=(over:R={})=>({decision:'approve',expectedVersion:1,serviceId:ids.salesService,code:null,note:NOTE,assigneeId:member.id,technicalId:null,businessId:null,...over});
const k=()=>randomUUID();
const row=async(id:string)=>(await rows<R>('SELECT * FROM work_requests WHERE id=$1',[id]))[0];
const hash=(c:string)=>createHash('sha256').update(c).digest('hex');
/** Inserts a request row as the operational login, with the clock the case chooses (the service never writes created_at). */
const raw=(over:R={})=>{
  const r={id:randomUUID(),project:ids.sales,requester:tech.id,name:tech.name,key:randomUUID(),title:'Việc ghi trực tiếp để kiểm tra',state:'pending',by:null,at:null,decider:null,note:null,created:'2026-01-01T10:00:00Z',...over};
  return rows(`INSERT INTO work_requests(id,tenant_id,project_id,requester_id,requester_name,request_key,request_hash,title,state,decided_by,decided_at,decider_name,decision_note,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,[r.id,ids.tenant,r.project,r.requester,r.name,r.key,hash(String(r.key)),r.title,r.state,r.by,r.at,r.decider,r.note,r.created]);
};

test('(1) a Team Tech member sees every project and files into one they hold no grant in; a person off the roster sees an empty catalog',async()=>{
  const catalog=await svc().catalog(tech);
  expect(catalog.map(c=>c.id).sort()).toEqual([ids.sales,ids.transport,'11000000-0000-4000-8000-000000000003'].sort());
  expect(Object.keys(catalog[0]).sort()).toEqual(['bu','id','name']);
  expect(catalog.some(c=>c.id===ids.otherProject)).toBe(false);
  const filed=await svc().submit(tech,input());
  expect(filed.replayed).toBe(false);
  expect(filed.request).toMatchObject({project_id:ids.sales,requester_id:tech.id,requester_name:tech.name,state:'pending',origin:'form',version:1});
  // off the roster and no manager role anywhere: nothing
  expect(await svc().catalog(member)).toEqual([]);
  // not on the roster, but a manager of two projects: the projects where they manage
  expect((await svc().catalog(pm)).map(c=>c.id).sort()).toEqual([ids.sales,ids.transport].sort());
});

test('(2) a viewer or engineer off the roster is denied, a bot is read-only, a project manager may file',async()=>{
  for(const p of [viewer,member,reviewer])
    await expect(svc().submit(p,input())).rejects.toMatchObject({code:'WORK_REQUEST_DENIED',status:403,message:'Chỉ thành viên Team Tech hoặc điều phối dự án được tạo việc. Nhờ điều phối dự án tạo việc giúp bạn, hoặc nhờ người quản trị thêm bạn vào Team Tech.'});
  await expect(svc().submit(bot,input())).rejects.toMatchObject({code:'READ_ONLY',status:403});
  const mine=await svc().submit(pm,input({projectId:ids.transport}));
  expect(mine.request).toMatchObject({requester_id:pm.id,project_id:ids.transport,state:'pending'});
  // a project that does not exist and one outside the tenant answer with the same sentence, for a roster member and for a manager
  const texts=new Set<string>();
  for(const [p,project] of [[tech,randomUUID()],[tech,ids.otherProject],[pm,randomUUID()],[pm,ids.otherProject]] as const) {
    const e=await svc().submit(p,input({projectId:project})).then(()=>{throw new Error('expected SCOPE_DENIED');},x=>x);
    expect(e).toMatchObject({code:'SCOPE_DENIED',status:404});
    texts.add(e.message);
  }
  expect([...texts]).toHaveLength(1);
  expect(await n('work_requests')).toBe(1);
});

test('(3) the body cannot name the tenant, the requester or the state; identity comes from the session only',async()=>{
  for(const extra of [{tenantId:ids.otherTenant},{requesterId:pm.id},{state:'approved'},{requesterName:'Người khác'}])
    await expect(svc().submit(tech,input(extra))).rejects.toBeInstanceOf(ZodError);
  await expect(svc().submit(tech,input({requestKey:'not-a-uuid'}))).rejects.toBeInstanceOf(ZodError);
  await expect(svc().submit(tech,input({specUrl:'https://user:pw@example.com/x'}))).rejects.toBeInstanceOf(ZodError);
  await expect(svc().submit(tech,input({specUrl:'http://example.com/x'}))).rejects.toBeInstanceOf(ZodError);
  await expect(svc().submit(tech,input({code:'ab'}))).rejects.toBeInstanceOf(ZodError);
  await expect(svc().submit(tech,input({title:'ngắn'}))).rejects.toBeInstanceOf(ZodError);
  expect(await n('work_requests')).toBe(0);
  const ok=await svc().submit(tech,input());
  expect(ok.request.requester_id).toBe(tech.id);
  // proposed people are checked as in the old create: assignee and acceptor must differ and hold the roles
  await expect(svc().submit(tech,input({assigneeId:member.id,technicalId:member.id}))).rejects.toMatchObject({code:'SELF_ACCEPTANCE'});
  await expect(svc().submit(tech,input({assigneeId:approver.id}))).rejects.toMatchObject({code:'INVALID_ASSIGNMENT'});
  expect(await n('work_requests')).toBe(1);
  // a requester sees only the people of projects they hold a grant in (the server directory): naming a person of sales from a transport-only grant is refused
  for(const field of ['assigneeId','technicalId','businessId'])
    await expect(svc().submit(tech,input({[field]:{assigneeId:member.id,technicalId:reviewer.id,businessId:approver.id}[field]}))).rejects.toMatchObject({code:'INVALID_ASSIGNMENT',status:422});
  expect(await n('work_requests')).toBe(1);
});

test('(4) the same key and content replays the stored row; the same key with other content is a conflict',async()=>{
  const body=input({title:'Việc gửi hai lần cùng khoá'});
  const first=await svc().submit(tech,body);
  const again=await svc().submit(tech,body);
  expect(first.replayed).toBe(false);expect(again.replayed).toBe(true);
  expect(again.request.id).toBe(first.request.id);
  expect(await n('work_requests')).toBe(1);
  expect(await n('work_request_events')).toBe(1);
  await expect(svc().submit(tech,{...body,title:'Nội dung đã đổi giữa chừng'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT',status:409});
  // the key belongs to its requester: another person may use the same value
  const other=await svc().submit(pm,{...body,projectId:ids.sales});
  expect(other.replayed).toBe(false);
  expect(other.request.id).not.toBe(first.request.id);
  expect(await n('work_requests')).toBe(2);
});

test('(5) the requester and the BoM seats of the project see the request; another member of the project does not',async()=>{
  const r=await file();
  const own=await svc().list(tech,{});
  expect(own.total).toBe(1);
  expect(own.items[0]).toMatchObject({id:r.id,project_name:expect.any(String),can_decide:false});
  for(const seat of [pm,reviewer,approver]) {
    const seen=await svc().list(seat,{});
    expect(seen.items.map(i=>i.id),seat.name).toEqual([r.id]);
    expect(seen.items[0].can_decide,seat.name).toBe(true);
  }
  // member (engineer, sales, no seat), a transport-only seat and another tenant
  expect((await svc().list(member,{})).items).toEqual([]);
  expect((await svc().list(member,{})).total).toBe(0);
  expect((await svc().list({...pm,id:randomUUID(),name:'Điều phối không ghế',grants:pm.grants},{})).items).toEqual([]);
  expect((await svc().list(outsider,{})).items).toEqual([]);
});

test('list: pending first, then newest first; paged with a hard cap',async()=>{
  const [oldPending,newPending,rejected]=[randomUUID(),randomUUID(),randomUUID()];
  await raw({id:oldPending,created:'2026-01-01T10:00:00Z'});
  await raw({id:newPending,created:'2026-01-03T10:00:00Z'});
  await raw({id:rejected,created:'2026-01-02T10:00:00Z',state:'rejected',by:pm.id,at:'2026-01-04T10:00:00Z',decider:pm.name,note:'Không thuộc phạm vi dự án.'});
  const all=await svc().list(tech,{});
  expect(all.items.map(i=>i.id)).toEqual([newPending,oldPending,rejected]);
  expect(all.items[2]).toMatchObject({state:'rejected',decider_name:pm.name,work_code:null});
  const page=await svc().list(tech,{limit:1,offset:1});
  expect(page.items.map(i=>i.id)).toEqual([oldPending]);
  expect(page.total).toBe(3);
  await expect(svc().list(tech,{limit:201})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().list(tech,{tenantId:ids.tenant})).rejects.toBeInstanceOf(ZodError);
  expect((await svc().list(tech,{limit:'2',offset:'0'})).items).toHaveLength(2);
});

test('(6) a BoM seat other than the requester approves: the work item, the audit trail and the decision are written together',async()=>{
  // the requester holds no grant in sales and so names nobody; the seat fills the three slots at approval
  const r=await file({title:'Việc cần BoM phê duyệt',criteria:'Đạt khi có biên bản.',priority:'high',specUrl:'https://example.com/spec/wr-6'});
  const done=await svc().decide(pm,r.id,decision({technicalId:reviewer.id,businessId:approver.id}),k());
  expect(done.request).toMatchObject({state:'approved',decided_by:pm.id,decider_name:pm.name,version:2});
  expect(done.work).toMatchObject({project_id:ids.sales,service_id:ids.salesService,title:'Việc cần BoM phê duyệt',state:'planned',assignee_id:member.id,technical_id:reviewer.id,business_id:approver.id,priority:'high'});
  const code='WR-'+r.id.slice(0,8).toUpperCase();
  expect(done.work!.code).toBe(code);
  const saved=await row(r.id);
  expect(saved).toMatchObject({state:'approved',decided_by:pm.id,decider_name:pm.name,work_id:done.work!.id,decision_note:NOTE,version:2});
  expect(saved.decided_at).toBeTruthy();
  const audit=await rows<{payload:R;actor_id:string}>("SELECT payload,actor_id FROM audit_events WHERE work_id=$1 AND kind='created'",[done.work!.id]);
  expect(audit).toHaveLength(1);
  expect(audit[0].actor_id).toBe(pm.id);
  expect(audit[0].payload).toMatchObject({requestId:r.id,requestedBy:tech.id,requesterName:tech.name,approvedBy:pm.id,origin:'form',revision:1,sourceSha:null,sourceRef:null,filledBySeat:['assigneeId','technicalId','businessId']});
  const kinds=await rows<{kind:string;actor_id:string;payload:R}>('SELECT kind,actor_id,payload FROM work_request_events WHERE request_id=$1 ORDER BY created_at,id',[r.id]);
  expect(kinds.map(e=>e.kind).sort()).toEqual(['approved','submitted']);
  expect(kinds.find(e=>e.kind==='approved')!.actor_id).toBe(pm.id);
  expect(kinds.find(e=>e.kind==='approved')!.payload).toMatchObject({workId:done.work!.id,assigneeId:member.id,technicalId:reviewer.id,businessId:approver.id,filledBySeat:['assigneeId','technicalId','businessId']});
  expect(kinds.find(e=>e.kind==='submitted')!.actor_id).toBe(tech.id);
  // the list now names the work item and the decider
  const item=(await svc().list(pm,{})).items.find(i=>i.id===r.id)!;
  expect(item).toMatchObject({state:'approved',work_code:code,decider_name:pm.name,can_decide:false});
  // the requester holds no grant in the project, so the work item itself stays unreadable to them: state and decider only
  expect((await svc().list(tech,{})).items[0]).toMatchObject({state:'approved',decider_name:pm.name,work_code:null});
  // an explicit code wins over the request's own and the generated one
  const second=await file({code:'REQ-OWN-01'});
  expect((await svc().decide(reviewer,second.id,decision(),k())).work!.code).toBe('REQ-OWN-01');
  const third=await file({code:'REQ-OWN-02'});
  expect((await svc().decide(approver,third.id,decision({code:'BOM-CHOSEN-1'}),k())).work!.code).toBe('BOM-CHOSEN-1');
});

test('(6b) 0.9.2: the seat fills empty slots and may change a proposed person (M3), itself or another seat included (M1); no assignee, a wrong role and an assignee who is also an acceptor are refused',async()=>{
  const r=await file();
  const refuse=async(who:Principal,over:R,code:string,status:number)=>{
    await expect(svc().decide(who,r.id,decision(over),k())).rejects.toMatchObject({code,status});
    expect(await row(r.id)).toMatchObject({state:'pending',version:1,work_id:null});
  };
  await refuse(pm,{assigneeId:null},'ASSIGNEE_REQUIRED',422);
  await refuse(pm,{technicalId:approver.id},'INVALID_ASSIGNMENT',422);
  await refuse(pm,{assigneeId:member.id,technicalId:member.id},'SELF_ACCEPTANCE',422);
  await refuse(pm,{assigneeId:randomUUID()},'INVALID_ASSIGNMENT',422);
  expect(await n('work_items WHERE code LIKE \'WR-%\'')).toBe(0);
  expect(await n(`audit_events WHERE payload->>'requestId'='${r.id}'`)).toBe(0);
  // M3: a person the requester proposed may be changed by the seat, here to another seat of the project (M1); the change is recorded
  const p=await file({assigneeId:member.id},pm);
  const changed=await svc().decide(reviewer,p.id,decision({assigneeId:approver.id}),k());
  expect(changed.work).toMatchObject({assignee_id:approver.id});
  expect((await rows<{payload:R}>("SELECT payload FROM audit_events WHERE work_id=$1 AND kind='created'",[changed.work!.id]))[0].payload).toMatchObject({changedBySeat:['assigneeId'],proposed:{assigneeId:member.id},final:{assigneeId:approver.id}});
  // a null keeps the proposed person
  const kept=await file({assigneeId:member.id},pm);
  await expect(svc().decide(reviewer,kept.id,decision({assigneeId:null,technicalId:null}),k())).resolves.toMatchObject({work:{assignee_id:member.id}});
  const q=await file({assigneeId:member.id},pm);
  const same=await svc().decide(approver,q.id,decision({assigneeId:member.id}),k());
  expect(same.work).toMatchObject({assignee_id:member.id});
  expect((await rows<{payload:R}>("SELECT payload FROM audit_events WHERE work_id=$1 AND kind='created'",[same.work!.id]))[0].payload).toMatchObject({filledBySeat:[],changedBySeat:[]});
});

test('a BoM seat rejects with a note; no work item is made; the approval needs a service of that project',async()=>{
  const r=await file();
  const before=await n('work_items');
  const done=await svc().decide(reviewer,r.id,decision({decision:'reject',serviceId:null,note:'Chưa thuộc phạm vi quý này.'}),k());
  expect(done.work).toBeNull();
  expect(await row(r.id)).toMatchObject({state:'rejected',decided_by:reviewer.id,decider_name:reviewer.name,work_id:null,decision_note:'Chưa thuộc phạm vi quý này.',version:2});
  expect(await n('work_items')).toBe(before);
  expect((await rows<{kind:string}>('SELECT kind FROM work_request_events WHERE request_id=$1',[r.id])).map(e=>e.kind).sort()).toEqual(['rejected','submitted']);
  const s=await file();
  await expect(svc().decide(pm,s.id,decision({serviceId:ids.transportService}),k())).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
  await expect(svc().decide(pm,s.id,decision({serviceId:ids.otherService}),k())).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
  await expect(svc().decide(pm,s.id,decision({serviceId:null}),k())).rejects.toMatchObject({status:422});
  await expect(svc().decide(pm,s.id,{...decision(),state:'approved'},k())).rejects.toBeInstanceOf(ZodError);
  await expect(svc().decide(pm,s.id,decision({note:'ngắn'}),k())).rejects.toBeInstanceOf(ZodError);
  expect(await row(s.id)).toMatchObject({state:'pending',version:1});
});

test('(7) a seat does not decide its own request; the database refuses it too',async()=>{
  const r=await file({},pm);
  await expect(svc().decide(pm,r.id,decision(),k())).rejects.toMatchObject({code:'SELF_APPROVAL',status:403,message:'Người tạo việc không tự duyệt việc của mình. Nhờ một BoM Tech khác hoặc một ghế BoM khác của dự án duyệt.'});
  await expect(svc().decide(pm,r.id,decision({decision:'reject'}),k())).rejects.toMatchObject({code:'SELF_APPROVAL'});
  expect(await row(r.id)).toMatchObject({state:'pending',version:1});
  // the requester who is not a seat is not told anything about the row: the same answer as for an id that does not exist
  const t=await file();
  await expect(svc().decide(tech,t.id,decision(),k())).rejects.toMatchObject({code:'NOT_FOUND',status:404});
  // written straight to the database as an already decided row: the CHECK of the table holds even for the operational login
  await expect(raw({state:'rejected',by:tech.id,at:'2026-01-02T10:00:00Z',decider:tech.name,note:'Tự từ chối thử'})).rejects.toThrow(/check constraint|violates/i);
  // and an UPDATE by anybody who is not a seat is stopped by the trigger, the operational login included
  await expect(rows(`UPDATE work_requests SET state='rejected',decided_by=requester_id,decided_at=now(),decider_name=requester_name,decision_note='Tự từ chối thử',version=2 WHERE id=$1`,[t.id])).rejects.toThrow(/Only a BoM seat/);
  expect(await row(t.id)).toMatchObject({state:'pending',version:1});
  // and the runtime role: a member of the project who holds no seat does not even see the row, so the UPDATE reaches nothing
  expect(await scoped(h.db,member,async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[member.id]);
    return (await tx.query(`UPDATE work_requests SET state='rejected',decided_by=$2,decided_at=now(),decider_name='x',decision_note='Không có ghế BoM',version=2,updated_at=now() WHERE id=$1 RETURNING id`,[t.id,member.id])).rows.length;
  })).toBe(0);
  expect(await row(t.id)).toMatchObject({state:'pending',version:1});
  // a seat other than the requester that tries to decide in the requester's name is stopped by the trigger
  await expect(scoped(h.db,pm,async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);
    await tx.query(`UPDATE work_requests SET state='rejected',decided_by=$2,decided_at=now(),decider_name='x',decision_note='Ghi tên người khác',version=2,updated_at=now() WHERE id=$1`,[t.id,tech.id]);
  })).rejects.toThrow(/check constraint|Only a BoM seat/);
  expect(await row(t.id)).toMatchObject({state:'pending',version:1});
});

test('(8) a manager without a seat, a disabled scope and a project without a scope all stop the decision of a project member; a seat without Telegram still decides on the web (0.9.2, M5)',async()=>{
  // a person who holds no seat of the project cannot see the request at all (row level security), so the answer is the one for an unknown id
  const deny=async(who:Principal,id:string)=>expect(svc().decide(who,id,decision(),k())).rejects.toMatchObject({code:'NOT_FOUND',status:404,message:'Không tìm thấy yêu cầu trong phạm vi được cấp. Tải lại danh sách.'});
  // transport has no scope: pm manages it, still no seat
  const t=await file({projectId:ids.transport});
  await deny(pm,t.id);
  // a manager of sales who holds no seat
  const stranger:Principal={...pm,id:randomUUID(),name:'Điều phối không ghế'};
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'wr-stranger',$3,'manager','fixture-only')`,[stranger.id,ids.tenant,stranger.name]);
  await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'manager')`,[ids.tenant,stranger.id,ids.sales]);
  const a=await file();
  await deny(stranger,a.id);
  // a seat whose Telegram link is gone keeps deciding on the web (M5); only the 3/3 ballot needs the link
  await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[approver.id]);
  expect((await svc().list(approver,{})).items.find(i=>i.id===a.id)).toMatchObject({can_decide:true});
  // a disabled scope takes every seat away
  await h.operator.query('UPDATE bom_scopes SET enabled=false WHERE project_id=$1',[ids.sales]);
  await deny(pm,a.id);
  await deny(reviewer,a.id);
  expect(await row(a.id)).toMatchObject({state:'pending',version:1});
  expect(await n('work_items WHERE code LIKE \'WR-%\'')).toBe(0);
  // a person who is not a member of the project cannot even see it
  await h.operator.query('UPDATE bom_scopes SET enabled=true WHERE project_id=$1',[ids.sales]);
  await expect(svc().decide(transportApprover,a.id,decision(),k())).rejects.toMatchObject({code:'NOT_FOUND',status:404});
  await expect(svc().decide(pm,randomUUID(),decision(),k())).rejects.toMatchObject({code:'NOT_FOUND',status:404});
  await expect(svc().decide(pm,'not-a-uuid',decision(),k())).rejects.toMatchObject({code:'NOT_FOUND',status:404});
});

test('(9) a stale version, a decided request and a taken code are refused; a taken code leaves the request pending',async()=>{
  const r=await file();
  await expect(svc().decide(pm,r.id,decision({expectedVersion:2}),k())).rejects.toMatchObject({code:'VERSION_CONFLICT',status:409});
  expect(await row(r.id)).toMatchObject({state:'pending',version:1});
  const key=k();
  const done=await svc().decide(pm,r.id,decision(),key);
  // the same key and body returns what was recorded; another key finds it decided
  const replay=await svc().decide(pm,r.id,decision(),key);
  expect(replay.request.id).toBe(done.request.id);
  expect(replay.work!.id).toBe(done.work!.id);
  await expect(svc().decide(reviewer,r.id,decision(),k())).rejects.toMatchObject({code:'REQUEST_DECIDED',status:409});
  await expect(svc().decide(reviewer,r.id,decision({decision:'reject'}),k())).rejects.toMatchObject({code:'REQUEST_DECIDED'});
  await expect(svc().decide(pm,r.id,decision({note:'Nội dung khác cùng khoá thao tác'}),key)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  expect(await n("work_items WHERE code='WR-"+r.id.slice(0,8).toUpperCase()+"'")).toBe(1);
  await expect(svc().decide(pm,r.id,decision(),'short')).rejects.toMatchObject({code:'IDEMPOTENCY_REQUIRED'});
  // a code that already names a work item of the project
  await h.operator.query(`INSERT INTO work_items(tenant_id,project_id,service_id,code,title,state) VALUES($1,$2,$3,'TAKEN-01','Việc đã có mã này','doing')`,[ids.tenant,ids.sales,ids.salesService]);
  const taken=await file({code:'TAKEN-01'});
  await expect(svc().decide(pm,taken.id,decision(),k())).rejects.toMatchObject({code:'CODE_TAKEN',status:409});
  expect(await row(taken.id)).toMatchObject({state:'pending',version:1,work_id:null,decided_by:null});
  expect(await n(`audit_events WHERE payload->>'requestId'='${taken.id}'`)).toBe(0);
  expect(await n(`work_request_events WHERE request_id='${taken.id}'`)).toBe(1);
  // the seat then chooses another code and it goes through
  const retry=await svc().decide(pm,taken.id,decision({code:'TAKEN-02'}),k());
  expect(retry.work!.code).toBe('TAKEN-02');
});

describe.skipIf(!native)('(10) two seats deciding at the same time (native PostgreSQL)',()=>{
  test('one wins, one finds the request decided, and exactly one work item exists',async()=>{
    const r=await file();
    const res=await Promise.allSettled([svc().decide(pm,r.id,decision(),k()),svc().decide(reviewer,r.id,decision(),k())]);
    expect(res.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    const lost=res.find(x=>x.status==='rejected') as PromiseRejectedResult;
    expect(['REQUEST_DECIDED','VERSION_CONFLICT']).toContain(lost.reason.code);
    expect(await n(`work_items WHERE code='WR-${r.id.slice(0,8).toUpperCase()}'`)).toBe(1);
    expect(await n(`work_request_events WHERE request_id='${r.id}' AND kind='approved'`)).toBe(1);
    expect(await row(r.id)).toMatchObject({state:'approved',version:2});
  });
  test('approve and reject at the same time leave one decision',async()=>{
    const r=await file();
    const res=await Promise.allSettled([svc().decide(pm,r.id,decision(),k()),svc().decide(approver,r.id,decision({decision:'reject'}),k())]);
    expect(res.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(await n(`work_request_events WHERE request_id='${r.id}' AND kind IN ('approved','rejected')`)).toBe(1);
  });
});

test('(11) row level security: no context, other requester, other tenant and a filing into another tenant',async()=>{
  const r=await file();
  await h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_runtime');
    expect((await tx.query('SELECT 1 FROM work_requests')).rows).toHaveLength(0);
    expect((await tx.query('SELECT 1 FROM work_request_events')).rows).toHaveLength(0);
  });
  const insert=(tx:{query:(s:string,p?:unknown[])=>Promise<unknown>},tenant:string,project:string,requester:string)=>tx.query(
    `INSERT INTO work_requests(tenant_id,project_id,requester_id,requester_name,request_key,request_hash,title) VALUES($1,$2,$3,'Tên thử',$4,$5,'Việc ghi trực tiếp thử')`,
    [tenant,project,requester,randomUUID(),hash('x')]);
  // as someone else
  await expect(scoped(h.db,tech,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[tech.id]);await insert(tx,ids.tenant,ids.sales,pm.id);})).rejects.toThrow(/row-level security/);
  // without a person in the context
  await expect(scoped(h.db,tech,async tx=>{await insert(tx,ids.tenant,ids.sales,tech.id);})).rejects.toThrow(/row-level security/);
  // into a project of another tenant
  await expect(scoped(h.db,tech,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[tech.id]);await insert(tx,ids.otherTenant,ids.otherProject,tech.id);})).rejects.toThrow(/row-level security/);
  // a person who is neither on the roster nor holds a grant in sales
  await expect(scoped(h.db,member,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[member.id]);await insert(tx,ids.tenant,ids.transport,member.id);})).rejects.toThrow(/row-level security/);
  // the other tenant sees nothing; the requester sees the row; a project member sees it at the table level (the service narrows it to seats)
  expect(await scoped(h.db,outsider,async tx=>(await tx.query('SELECT 1 FROM work_requests')).rows.length)).toBe(0);
  expect(await scoped(h.db,outsider,async tx=>(await tx.query('SELECT 1 FROM work_request_events')).rows.length)).toBe(0);
  expect(await scoped(h.db,tech,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[tech.id]);return (await tx.query('SELECT id FROM work_requests')).rows;})).toEqual([{id:r.id}]);
  // a member of the project who holds no seat sees neither the request nor its history; a seat sees both
  expect(await scoped(h.db,member,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[member.id]);return (await tx.query('SELECT 1 FROM work_requests')).rows.length;})).toBe(0);
  expect(await scoped(h.db,member,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[member.id]);return (await tx.query('SELECT 1 FROM work_request_events')).rows.length;})).toBe(0);
  expect(await scoped(h.db,reviewer,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[reviewer.id]);return (await tx.query('SELECT 1 FROM work_requests')).rows.length;})).toBe(1);
  expect(await scoped(h.db,reviewer,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[reviewer.id]);return (await tx.query('SELECT 1 FROM work_request_events')).rows.length;})).toBe(1);
  // another tenant: an UPDATE reaches no row, and the seat function is false for a project of the other tenant
  expect(await scoped(h.db,outsider,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[outsider.id]);
    return (await tx.query('UPDATE work_requests SET updated_at=now() WHERE id=$1 RETURNING id',[r.id])).rows.length;})).toBe(0);
  expect(await scoped(h.db,outsider,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[outsider.id]);
    return (await tx.query<{ok:boolean}>('SELECT public.work_request_seat($1) AS ok',[ids.sales])).rows[0].ok;})).toBe(false);
  expect(await scoped(h.db,pm,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);
    return (await tx.query<{ok:boolean}>('SELECT public.work_request_seat($1) AS ok',[ids.otherProject])).rows[0].ok;})).toBe(false);
  // history is append-only and requests are never deleted, whoever asks
  await expect(rows('DELETE FROM work_request_events')).rejects.toThrow();
  await expect(rows('DELETE FROM work_requests')).rejects.toThrow();
  expect(await n('work_requests')).toBe(1);
});

test('(11b) filing at the table: a project grant alone files nothing (bot, viewer, engineer, acceptor); a manager of the project and a Team Tech member file',async()=>{
  // the viewer gets an account and a viewer membership, so the refusal below is about the role and not about a missing account row
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'wr-viewer',$3,'viewer','fixture-only') ON CONFLICT DO NOTHING`,[viewer.id,viewer.tenantId,viewer.name]);
  await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer') ON CONFLICT DO NOTHING`,[viewer.tenantId,viewer.id,ids.transport]);
  const withPerson=<T>(p:Principal,fn:(tx:{query:<X=R>(s:string,v?:unknown[])=>Promise<{rows:X[]}>})=>Promise<T>)=>scoped(h.db,p,async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[p.id]);return fn(tx as never);});
  const direct=(p:Principal,project:string)=>withPerson(p,async tx=>(await tx.query<{id:string}>(
    `INSERT INTO work_requests(tenant_id,project_id,requester_id,requester_name,request_key,request_hash,title) VALUES($1,$2,$3,'Tên thử',$4,$5,'Việc ghi trực tiếp thử') RETURNING id`,
    [p.tenantId,project,p.id,randomUUID(),hash('x')])).rows);
  const filer=(p:Principal,project:string)=>withPerson(p,async tx=>(await tx.query<{ok:boolean}>('SELECT public.work_request_filer($1) AS ok',[project])).rows[0].ok);
  for(const [p,project] of [[bot,ids.transport],[viewer,ids.transport],[member,ids.sales],[reviewer,ids.sales],[transportApprover,ids.transport]] as const) {
    expect(p.projectIds).toContain(project);
    expect(await filer(p,project)).toBe(false);
    await expect(direct(p,project)).rejects.toThrow(/row-level security/);
  }
  // a session that claims a manager grant the account rows do not hold is answered by the service with the denial, not a database error
  const claimed:Principal={...member,role:'manager',grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]}]};
  await expect(svc().submit(claimed,input())).rejects.toMatchObject({code:'WORK_REQUEST_DENIED',status:403});
  // a manager files in the project they manage while it is in scope; the same project outside the context files nothing
  expect(await direct(pm,ids.sales)).toHaveLength(1);
  expect(await filer({...pm,projectIds:[ids.transport]},ids.sales)).toBe(false);
  // a manager whose account is disabled files nothing
  await h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[pm.id]);
  expect(await filer(pm,ids.sales)).toBe(false);
  await expect(direct(pm,ids.sales)).rejects.toThrow(/row-level security/);
  // a Team Tech member files in a project they hold no grant in
  expect(tech.projectIds).not.toContain(ids.sales);
  expect(await direct(tech,ids.sales)).toHaveLength(1);
  expect(await n('work_requests')).toBe(2);
});

test('(12) an approved work item carries the proposed assignee, and changing it later still needs the 3/3 BoM receipt',async()=>{
  // the manager of sales sees its members and proposes them; another seat approves
  const r=await file({assigneeId:member.id,technicalId:reviewer.id,businessId:approver.id},pm);
  const {work}=await svc().decide(reviewer,r.id,decision({assigneeId:null}),k());
  expect(work).toMatchObject({assignee_id:member.id,technical_id:reviewer.id,business_id:approver.id});
  const detail=await new WorkService(h.db).detail(pm,work!.id);
  await expect(new WorkService(h.db).command(pm,work!.id,{kind:'revise',expectedVersion:detail.work.version,sourceSha:'a'.repeat(40),criteria:'Tiêu chí mới đủ dài để nhận.',specUrl:'https://example.com/spec',dueAt:null,
    assigneeId:pm.id,technicalId:reviewer.id,businessId:approver.id,note:'Đổi người thực hiện.'},k())).rejects.toMatchObject({code:'BOM_REQUIRED',status:409});
  await expect(scoped(h.db,pm,async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);
    await tx.query('UPDATE work_items SET assignee_id=$2 WHERE id=$1',[work!.id,pm.id]);
  })).rejects.toThrow();
  expect((await rows<{assignee_id:string|null}>('SELECT assignee_id FROM work_items WHERE id=$1',[work!.id]))[0].assignee_id).toBe(member.id);
});

test('(13) the history cannot be forged: no approved event of one\'s own, no second submitted event, no approval pointing at an unrelated work item, no table-wide insert',async()=>{
  const r=await file();
  const asRuntime=(who:Principal,fn:(tx:{query:(s:string,p?:unknown[])=>Promise<unknown>})=>Promise<unknown>)=>scoped(h.db,who,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[who.id]);await fn(tx);});
  const ev=(kind:string,actor:string)=>`INSERT INTO work_request_events(tenant_id,project_id,request_id,requester_id,actor_id,kind,payload) VALUES('${ids.tenant}','${ids.sales}','${r.id}','${tech.id}','${actor}','${kind}','{}')`;
  // the requester writes an approval of their own request, a decider's event by a non-decider, a second submission
  await expect(asRuntime(tech,tx=>tx.query(ev('approved',tech.id)))).rejects.toThrow(/row-level security/);
  await expect(asRuntime(tech,tx=>tx.query(ev('rejected',tech.id)))).rejects.toThrow(/row-level security/);
  await expect(asRuntime(pm,tx=>tx.query(ev('approved',pm.id)))).rejects.toThrow(/row-level security/);
  await expect(asRuntime(tech,tx=>tx.query(ev('submitted',tech.id)))).rejects.toThrow(/duplicate key|row-level security/);
  await expect(asRuntime(pm,tx=>tx.query(ev('submitted',pm.id)))).rejects.toThrow(/row-level security/);
  expect(await n(`work_request_events WHERE request_id='${r.id}'`)).toBe(1);
  // a decision that points at a work item no approval created: the guard asks for the audit row of this request
  await expect(asRuntime(pm,tx=>tx.query(`UPDATE work_requests SET state='approved',decided_by=$2,decider_name='x',decided_at=now(),decision_note='Trỏ vào việc khác',work_id=$3,version=2,updated_at=now() WHERE id=$1`,[r.id,pm.id,ids.pilot]))).rejects.toThrow(/approval|audit/i);
  expect(await row(r.id)).toMatchObject({state:'pending',version:1,work_id:null});
  // INSERT is granted by column: state, decided_by and the other decision columns are not insertable by the runtime role
  await expect(asRuntime(tech,tx=>tx.query(`INSERT INTO work_requests(tenant_id,project_id,requester_id,requester_name,request_key,request_hash,title,state) VALUES($1,$2,$3,'x',$4,$5,'Việc gài sẵn trạng thái','pending')`,[ids.tenant,ids.transport,tech.id,randomUUID(),hash('y')]))).rejects.toThrow(/permission denied/);
  // the one real approval still writes exactly one approved event
  await svc().decide(pm,r.id,decision(),k());
  expect(await n(`work_request_events WHERE request_id='${r.id}' AND kind='approved'`)).toBe(1);
  await expect(rows(`INSERT INTO work_request_events(tenant_id,project_id,request_id,requester_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,'approved','{}')`,[ids.tenant,ids.sales,r.id,tech.id,pm.id])).rejects.toThrow(/duplicate key/);
});

test('(13b) responses carry no tenant, request key or hash; decided_by only for a seat or the decider',async()=>{
  const r=await file();
  const done=await svc().decide(pm,r.id,decision(),k());
  const asSeat=publicRequest(done.request,pm.id,true);
  for(const key of ['tenant_id','request_key','request_hash']) expect(asSeat).not.toHaveProperty(key);
  expect(asSeat).toMatchObject({decided_by:pm.id,decider_name:pm.name});
  expect(asSeat.decided_at).toBeTruthy();
  expect(publicRequest(done.request,tech.id,false)).not.toHaveProperty('decided_by');
  expect(publicRequest(done.request,tech.id,false)).toMatchObject({decider_name:pm.name});
  expect(publicRequest(done.request,pm.id,false)).toHaveProperty('decided_by',pm.id);
  const listed=await svc().list(tech,{});
  expect(listed.items[0]).toMatchObject({is_seat:false});
});

test('(13c) a member who holds no seat gets the same answer for a request that exists and one that does not',async()=>{
  const r=await file();
  const ask=(id:string)=>svc().decide(member,id,decision(),k()).then(()=>{throw new Error('expected NOT_FOUND');},e=>({code:e.code,status:e.status,message:e.message}));
  const known=await ask(r.id),unknown=await ask(randomUUID());
  expect(known).toEqual(unknown);
  expect(known).toMatchObject({code:'NOT_FOUND',status:404});
  expect(await row(r.id)).toMatchObject({state:'pending',version:1});
});

describe.skipIf(!native)('(13d) the seat standing is read under lock (native PostgreSQL)',()=>{
  test('a seat removed while the decision waits gets BOM_SEAT_REQUIRED and nothing is written',async()=>{
    const r=await file();
    let res!:Promise<unknown>;
    await h.operator.transaction(async tx=>{
      await tx.query('UPDATE bom_scopes SET seat_ids=$2,version=version+1,updated_at=now() WHERE project_id=$1',[ids.sales,[reviewer.id,approver.id,member.id]]);
      res=svc().decide(pm,r.id,decision(),k()).then(()=>null,e=>e);
      await waitForBlocked(h,1);
    });
    expect(await res).toMatchObject({code:'BOM_SEAT_REQUIRED',status:403});
    expect(await row(r.id)).toMatchObject({state:'pending',version:1});
    expect(await n('work_items WHERE code LIKE \'WR-%\'')).toBe(0);
  });
  test('a second connection changing the seats waits until the decision commits',async()=>{
    const r=await file();
    let change:Promise<unknown>|null=null,waited=false,decided=false;
    const hooked:Database={...h.db,transaction:fn=>h.db.transaction(tx=>fn({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{
      const out=await tx.query<T>(sql,params);
      if(!change&&sql.includes('bom_eligible_members')){
        change=h.operator.query('UPDATE bom_scopes SET seat_ids=$2,version=version+1,updated_at=now() WHERE project_id=$1',[ids.sales,[reviewer.id,approver.id,member.id]]);
        await waitForBlocked(h,1);waited=true;
      }
      return out;
    }}))};
    const done=await new WorkRequestService(hooked).decide(pm,r.id,decision(),k());
    decided=true;
    await change;
    expect(waited&&decided).toBe(true);
    expect(done.request).toMatchObject({state:'approved'});
    expect((await rows<{seat_ids:string[]}>('SELECT seat_ids FROM bom_scopes WHERE project_id=$1',[ids.sales]))[0].seat_ids).toContain(member.id);
    expect(await n('work_items WHERE code LIKE \'WR-%\'')).toBe(1);
  });
});

describe('(14) the HTTP routes',()=>{
  const url='http://127.0.0.1:3147';
  const cookie=(profileKey:string)=>COOKIE+'='+createSession(new Request(url+'/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:url}}),{profileKey}).token;
  const call=(method:string,route:string[],who:string,payload?:unknown,extra:Record<string,string>={})=>handleApi(new Request(url+'/api/v1/'+route.join('/'),
    {method,headers:{host:'127.0.0.1:3147',origin:url,cookie:cookie(who),...extra},...(payload!==undefined?{body:JSON.stringify(payload)}:{})}),route,h.db);
  test('POST /work answers 410 and writes nothing; POST /work-requests is 201 then 200 on a replay; the list and the catalog answer',async()=>{
    const gone=await call('POST',['work'],'manager',{});
    expect(gone.status).toBe(410);
    expect((await gone.json()).error).toMatchObject({code:'WORK_REQUEST_REQUIRED',message:'Việc mới đi qua yêu cầu chờ BoM duyệt. Gửi yêu cầu ở trang «Việc chờ BoM duyệt».'});
    const body=input({projectId:ids.transport,title:'Việc gửi qua đường HTTP'});
    const created=await call('POST',['work-requests'],'manager',body);
    expect(created.status).toBe(201);
    const first=(await created.json()).data;
    expect(first).toMatchObject({replayed:false,request:{state:'pending',requester_id:demoProfiles.manager.id}});
    for(const key of ['tenant_id','request_key','request_hash']) expect(first.request).not.toHaveProperty(key);
    const replay=await call('POST',['work-requests'],'manager',body);
    expect(replay.status).toBe(200);
    expect((await replay.json()).data).toMatchObject({replayed:true,request:{id:first.request.id}});
    expect((await call('POST',['work-requests'],'manager',{...body,requesterId:pm.id})).status).toBe(422);
    expect((await call('POST',['work-requests'],'bot',body)).status).toBe(403);
    const listed=await call('GET',['work-requests'],'manager');
    expect(listed.status).toBe(200);
    const page=(await listed.json()).data;
    expect(page).toMatchObject({total:1,items:[{id:first.request.id}]});
    for(const key of ['tenant_id','request_key','request_hash','is_seat']) expect(page.items[0]).not.toHaveProperty(key);
    const catalog=await call('GET',['work-requests','catalog'],'manager');
    expect((await catalog.json()).data.map((c:{id:string})=>c.id).sort()).toEqual([ids.sales,ids.transport].sort());
    // the requester is the manager: the decision route refuses the self-approval, and needs a key
    const id=first.request.id as string;
    const dec=await call('POST',['work-requests',id,'decision'],'manager',decision(),{'idempotency-key':k()});
    // transport has no BoM scope, so the requester holds no seat: the row is invisible to a decision (the same answer as for an unknown id)
    expect(dec.status).toBe(404);
    expect((await dec.json()).error.code).toBe('NOT_FOUND');
    expect((await call('GET',['work-requests'],'customer')).status).toBe(200);
    expect(await n('work_items WHERE code LIKE \'WR-%\'')).toBe(0);
  });
});

describe('operator scripts (deploy/tech-roster.sql, deploy/bom-seats.sql)',()=>{
  // psql is not part of the test: the script text is run with its variables written in as literals, meta-commands and comments dropped
  const run=async(file:string,vars:Record<string,string>)=>{
    const {readFile}=await import('node:fs/promises');
    let sql=await readFile(process.cwd()+'/deploy/'+file,'utf8');
    for(const [k,v] of Object.entries(vars)) sql=sql.replaceAll(`:'${k}'`,"'"+v.replaceAll("'","''")+"'");
    sql=sql.split('\n').filter(l=>!l.startsWith('\\')).join('\n');
    await h.exec(sql);
  };
  // identity.events is append-only and is not emptied between cases on the native harness: count only the events this case wrote
  let baseline:string[]=[];
  beforeEach(async()=>{baseline=(await rows<{id:string}>('SELECT id FROM identity.events')).map(r=>r.id);});
  const events=(kind:string)=>rows<{detail:R}>('SELECT detail FROM identity.events WHERE kind=$1 AND NOT (id=ANY($2::uuid[]))',[kind,baseline]);
  test('the roster script adds and removes people, idempotently, and records the source on each real change',async()=>{
    const vars={tenant_id:ids.tenant,user_ids:`${member.id},${reviewer.id}`,source:'bien-ban-thu-nghiem'};
    await run('tech-roster.sql',{...vars,action:'add'});
    await run('tech-roster.sql',{...vars,action:'add'});
    expect(await n('identity.tech_roster')).toBe(3);
    const added=await events('tech_roster_added');
    // the second run adds nobody and records nothing; the Tech member of the fixture was added before the baseline
    expect(added).toHaveLength(2);
    expect(added.every(e=>e.detail.source==='bien-ban-thu-nghiem'&&typeof e.detail.db_role==='string'&&e.detail.db_role.length>0)).toBe(true);
    await run('tech-roster.sql',{...vars,action:'remove'});
    await run('tech-roster.sql',{...vars,action:'remove'});
    expect(await n('identity.tech_roster')).toBe(1);
    expect(await events('tech_roster_removed')).toHaveLength(2);
    await expect(run('tech-roster.sql',{...vars,action:'drop'})).rejects.toThrow();
    await h.exec('ROLLBACK').catch(()=>{});
    expect(await n('identity.tech_roster')).toBe(1);
  });
  test('the seat script sets three seats, moves the version only on a change, and writes one event per run',async()=>{
    await h.operator.query('DELETE FROM bom_scopes WHERE project_id=$1',[ids.transport]);
    // the seeded transport work has no assignee: the script refuses to enable control over it unless the operator says so
    const vars={tenant_id:ids.tenant,project_id:ids.transport,seat_ids:`${pm.id},${reviewer.id},${approver.id}`,source:'bien-ban-thu-nghiem',allow_unassigned:'1'};
    await run('bom-seats.sql',vars);
    expect(await rows('SELECT version,enabled,cardinality(seat_ids) seats FROM bom_scopes WHERE project_id=$1',[ids.transport])).toEqual([{version:1,enabled:true,seats:3}]);
    await run('bom-seats.sql',vars);
    expect((await rows<{version:number}>('SELECT version FROM bom_scopes WHERE project_id=$1',[ids.transport]))[0].version).toBe(1);
    await run('bom-seats.sql',{...vars,seat_ids:`${pm.id},${reviewer.id},${member.id}`});
    expect((await rows<{version:number}>('SELECT version FROM bom_scopes WHERE project_id=$1',[ids.transport]))[0].version).toBe(2);
    const log=await events('bom_seats_set');
    // three runs, three events; compared as a set because now() can give two statements the same millisecond
    expect(log.map(e=>[e.detail.changed,e.detail.version]).sort((a,b)=>String(a).localeCompare(String(b)))).toEqual([[false,1],[true,1],[true,2]]);
    expect(log.every(e=>e.detail.project_id===ids.transport&&e.detail.source==='bien-ban-thu-nghiem'&&typeof e.detail.db_role==='string')).toBe(true);
    // the first run created the scope (no old seats), the third replaced one seat
    expect(log.filter(e=>e.detail.old_seat_ids===null)).toHaveLength(1);
    expect(log.find(e=>e.detail.version===2)!.detail).toMatchObject({old_seat_ids:[pm.id,reviewer.id,approver.id],seat_ids:[pm.id,reviewer.id,member.id]});
    await expect(run('bom-seats.sql',{...vars,seat_ids:`${pm.id},${reviewer.id}`})).rejects.toThrow();
    await h.exec('ROLLBACK').catch(()=>{});
  });
  test('the seat script refuses to enable control over work without an assignee unless told to',async()=>{
    await h.operator.query('DELETE FROM bom_scopes WHERE project_id=$1',[ids.transport]);
    const vars={tenant_id:ids.tenant,project_id:ids.transport,seat_ids:`${pm.id},${reviewer.id},${approver.id}`,source:'bien-ban-thu-nghiem',allow_unassigned:'0'};
    expect(Number((await rows<{n:string}>("SELECT count(*) n FROM work_items WHERE project_id=$1 AND state<>'done' AND assignee_id IS NULL",[ids.transport]))[0].n)).toBeGreaterThan(0);
    await expect(run('bom-seats.sql',vars)).rejects.toThrow();
    await h.exec('ROLLBACK').catch(()=>{});
    expect(await n(`bom_scopes WHERE project_id='${ids.transport}'`)).toBe(0);
    await h.operator.query("UPDATE work_items SET assignee_id=$2 WHERE project_id=$1 AND assignee_id IS NULL",[ids.transport,member.id]);
    await run('bom-seats.sql',vars);
    expect(await n(`bom_scopes WHERE project_id='${ids.transport}' AND enabled`)).toBe(1);
  });
  test('the seat script refuses a project that is not of the tenant passed, and writes no scope and no event',async()=>{
    const before=await n('bom_scopes');
    const vars={tenant_id:ids.tenant,project_id:ids.otherProject,seat_ids:`${pm.id},${reviewer.id},${approver.id}`,source:'bien-ban-thu-nghiem',allow_unassigned:'1'};
    await expect(run('bom-seats.sql',vars)).rejects.toThrow();
    await h.exec('ROLLBACK').catch(()=>{});
    expect(await n('bom_scopes')).toBe(before);
    expect(await n(`bom_scopes WHERE project_id='${ids.otherProject}'`)).toBe(0);
    expect(await events('bom_seats_set')).toHaveLength(0);
  });
});
