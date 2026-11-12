import { beforeEach, afterEach, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { embeddedDatabase, scoped, type Database } from '../src/server/db';
import { seed, demoSha } from '../src/server/seed';
import { WorkService } from '../src/server/service';
import { demoProfiles as profiles, ids, otherPrincipal } from '../src/server/identities';
import { createSession, principalFromRequest, COOKIE, endSession } from '../src/server/auth';
import { handleApi } from '../src/server/http';
import type { Principal, WorkDetail } from '../src/server/types';
let db:Database, service:WorkService;
const key=()=>randomUUID();
const url='http://127.0.0.1:3147';
const req=(method='POST', payload:unknown={profileKey:'manager'}, cookie?:string, route='/api/demo/session')=>new Request(url+route,{method,headers:{host:'127.0.0.1:3147',origin:url,...(cookie?{cookie}:{})},...(method!=='GET'?{body:JSON.stringify(payload)}:{})});
beforeEach(async()=>{ process.env.LIBETECH_DEMO='1'; db=await embeddedDatabase(); await seed(db); service=new WorkService(db); });
afterEach(async()=>{ await db.close(); });
async function cmd(p:Principal, command:Record<string,unknown>, version?:number, id=ids.pilot) {
  const current=await service.detail(profiles.manager,id);
  return service.command(p,id,{expectedVersion:version??current.work.version,...command},key());
}
async function acceptTech() {
  const d=await service.detail(profiles.manager,ids.pilot);
  return cmd(profiles.technical,{kind:'technical_accept',sourceSha:demoSha,revision:d.work.revision,evidenceId:d.evidence[0].id,confirmed:true,note:'Đã kiểm tra tiêu chí kỹ thuật trong phép thử.'});
}
async function acceptBoth() {
  let d=await acceptTech();
  d=await cmd(profiles.business,{kind:'evidence',evidenceKind:'uat',sourceId:'https://example.com/demo/uat',sourceType:'manual',sourceSha:demoSha,note:'Biên bản UAT mô phỏng có xác nhận người được giao.'});
  return cmd(profiles.business,{kind:'business_accept',sourceSha:demoSha,revision:d.work.revision,evidenceId:d.evidence.find(e=>e.kind==='uat')!.id,confirmed:true,note:'Đã kiểm tra nghiệp vụ theo tiêu chí mô phỏng.'});
}
describe('scope and identity',()=>{
  test('all scoped tables fail closed without RLS context',async()=>{
    await db.transaction(async tx=>{
      await tx.query('SET LOCAL ROLE libetech_runtime');
      for(const table of ['projects','services','work_items','evidence','audit_events','commands','analytics.work_summary']) expect((await tx.query('SELECT * FROM '+table)).rows).toHaveLength(0);
    });
  });
  test('tenant/project isolation covers every table and details',async()=>{
    for (const [p,id] of [[profiles.manager,ids.pilot],[profiles.manager,ids.transportWork],[otherPrincipal,ids.otherWork]] as const)
      await service.command(p,id,{kind:'close_ticket',expectedVersion:1,ticketRef:'ISOLATION-DEMO',note:'Seed idempotency row for scope verification.'},key());
    for(const principal of [profiles.customer,otherPrincipal]) {
      await scoped(db,principal,async tx=>{
        for(const table of ['projects','services','work_items','evidence','audit_events','commands','analytics.work_summary']) {
          const rows=(await tx.query<Record<string,unknown>>('SELECT * FROM '+table)).rows;
          for(const row of rows) { expect(row.tenant_id).toBe(principal.tenantId); expect(principal.projectIds).toContain(table==='projects'?row.id:row.project_id); }
        }
      });
      await expect(service.detail(principal,ids.pilot)).rejects.toMatchObject({code:'SCOPE_DENIED'});
    }
    expect((await service.workspace(profiles.manager)).work).toHaveLength(5);
    expect((await service.workspace(profiles.customer)).work).toHaveLength(1);
    expect((await service.workspace(otherPrincipal)).work).toHaveLength(1);
    await expect(service.workspace(null as unknown as Principal)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  });
  test('RLS blocks cross-project insert and tenant mismatch even with a valid foreign key',async()=>{
    for(const p of [profiles.customer,otherPrincipal]) await expect(scoped(db,p,tx=>tx.query('INSERT INTO audit_events(tenant_id,project_id,work_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)',[ids.tenant,ids.sales,ids.pilot,p.id,'forged','{}']))).rejects.toThrow();
  });
  test('bot and customer cannot write, even with a forged body',async()=>{
    for(const p of [profiles.bot,profiles.customer]) {
      await expect(service.command(p,ids.transportWork,{kind:'close_ticket',actorId:profiles.manager.id},key())).rejects.toMatchObject({code:'READ_ONLY'});
      await expect(service.create(p,{},key())).rejects.toMatchObject({code:'READ_ONLY'});
      await expect(service.refresh(p)).rejects.toMatchObject({code:'READ_ONLY'});
    }
  });
  test('authentication requires explicit flag and loopback; headers cannot select a principal',()=>{
    expect(()=>principalFromRequest(req('GET',{},undefined))).toThrow();
    expect(()=>createSession(new Request('https://evil.example/api',{method:'POST',headers:{host:'evil.example',origin:'https://evil.example'}}),{profileKey:'manager'})).toThrow();
    expect(()=>createSession(req('POST',{profileKey:'manager'}),{profileKey:'manager',tenantId:ids.otherTenant})).toThrow();
    process.env.LIBETECH_DEMO='0'; expect(()=>createSession(req(),{profileKey:'manager'})).toThrow();
    process.env.LIBETECH_DEMO='1'; const {token}=createSession(req(),{profileKey:'manager'});
    const request=req('GET',{},COOKIE+'='+token); expect(principalFromRequest(request).id).toBe(profiles.manager.id);
    endSession(req('POST',{},COOKIE+'='+token)); expect(()=>principalFromRequest(request)).toThrow();
  });
  test('legitimate loopback origin survives Next internal URL normalization',()=>{
    const normalized=new Request('http://localhost:3147/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:'http://127.0.0.1:3147'}});
    expect(createSession(normalized,{profileKey:'manager'}).principal.id).toBe(profiles.manager.id);
    const forged=new Request('http://localhost:3147/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:'https://evil.example'}});
    expect(()=>createSession(forged,{profileKey:'manager'})).toThrow();
  });
});
describe('state and acceptance',()=>{
  test('done requires BOTH acceptances; ticket closure does not change either',async()=>{
    await expect(cmd(profiles.manager,{kind:'transition',state:'done',note:'Thử hoàn thành'})).rejects.toMatchObject({code:'ACCEPTANCE_REQUIRED'});
    const closed=await cmd(profiles.manager,{kind:'close_ticket',ticketRef:'DEMO-TICKET-1',note:'Đã phản hồi khách trong phép thử.'});
    expect(closed.work.state).toBe('review'); expect(closed.acceptance).toEqual({technical:false,business:false});
    await acceptTech(); await expect(cmd(profiles.manager,{kind:'transition',state:'done',note:'Thiếu UAT'})).rejects.toMatchObject({code:'ACCEPTANCE_REQUIRED'});
  });
  test('rejects implementer, wrong acceptor, old SHA and wrong evidence',async()=>{
    const d=await service.detail(profiles.manager,ids.pilot);
    const payload={kind:'technical_accept',sourceSha:demoSha,revision:1,evidenceId:d.evidence[0].id,confirmed:true,note:'Kiểm nghiệm quyền thực hiện'};
    await expect(cmd(profiles.engineer,payload)).rejects.toMatchObject({code:'SELF_ACCEPTANCE'});
    await expect(cmd(profiles.manager,payload)).rejects.toMatchObject({code:'WRONG_ACCEPTOR'});
    await expect(cmd(profiles.technical,{...payload,sourceSha:'b'.repeat(40)})).rejects.toMatchObject({code:'REVISION_MISMATCH'});
    await expect(cmd(profiles.business,{...payload,kind:'business_accept'})).rejects.toMatchObject({code:'EVIDENCE_REQUIRED'});
    await expect(cmd(profiles.technical,{...payload,confirmed:false})).rejects.toThrow();
  });
  test('full technical → UAT → business → completion succeeds and preserves provenance',async()=>{
    const d=await acceptBoth(); expect(d.acceptance).toEqual({technical:true,business:true});
    const done=await cmd(profiles.manager,{kind:'transition',state:'done',note:'Đủ hai nghiệm thu ở SHA đang bàn giao.'});
    expect(done.work.state).toBe('done'); expect(done.evidence.every(e=>e.source_sha===demoSha && Number(e.quality_score)===0)).toBe(true);
    expect(done.events.filter(e=>e.kind.endsWith('_accept')).every(e=>e.payload.sourceSha===demoSha&&e.payload.revision===1)).toBe(true);
    expect((await service.overview(profiles.manager)).summary.done).toBe(1);
  });
  test('changing revision invalidates approvals and keeps old evidence immutable',async()=>{
    await acceptBoth();
    const d=await cmd(profiles.manager,{kind:'revise',sourceSha:'b'.repeat(40),criteria:'Tiêu chí mới cần kiểm chứng lại.',specUrl:'https://example.com/demo/revised',dueAt:null,assigneeId:profiles.engineer.id,technicalId:profiles.technical.id,businessId:profiles.business.id,note:'Thay đổi phạm vi và mã nguồn.'});
    expect(d.work.revision).toBe(2); expect(d.work.state).toBe('doing'); expect(d.acceptance).toEqual({technical:false,business:false}); expect(d.evidence.every(e=>e.revision===1)).toBe(true);
    await cmd(profiles.manager,{kind:'transition',state:'review',note:'Bàn giao lại phiên bản mới.'});
    await expect(cmd(profiles.manager,{kind:'transition',state:'done',note:'Không được dùng nghiệm thu cũ.'})).rejects.toMatchObject({code:'ACCEPTANCE_REQUIRED'});
  });
  test('return from review invalidates previous acceptance',async()=>{
    await acceptTech(); const d=await cmd(profiles.engineer,{kind:'transition',state:'doing',note:'Cần làm lại theo góp ý.'});
    expect(d.work.revision).toBe(2); expect(d.acceptance.technical).toBe(false);
  });
  test('stale writes and failed mutations have no audit or version side effects',async()=>{
    const old=await service.detail(profiles.manager,ids.pilot);
    await cmd(profiles.manager,{kind:'close_ticket',ticketRef:'DEMO-TICKET-2',note:'Ghi nhận đóng độc lập.'});
    const before=await service.detail(profiles.manager,ids.pilot);
    await expect(cmd(profiles.manager,{kind:'transition',state:'doing',note:'Gửi từ tab cũ.'},old.work.version)).rejects.toMatchObject({code:'VERSION_CONFLICT'});
    const after=await service.detail(profiles.manager,ids.pilot); expect(after).toEqual(before);
  });
  test('two concurrent writes at the same version produce one commit and one conflict',async()=>{
    const input={kind:'close_ticket',ticketRef:'RACE-DEMO',note:'Simultaneous request test.',expectedVersion:1};
    const results=await Promise.allSettled([service.command(profiles.manager,ids.pilot,input,key()),service.command(profiles.manager,ids.pilot,input,key())]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const failed=results.find(r=>r.status==='rejected') as PromiseRejectedResult;
    expect(failed.reason.code).toBe('VERSION_CONFLICT');
    const after=await service.detail(profiles.manager,ids.pilot);
    expect(after.work.version).toBe(2);
    expect(after.events.filter(e=>e.kind==='close_ticket')).toHaveLength(1);
  });
  test('idempotent retries return the original result and key reuse conflicts',async()=>{
    const k=key(), input={kind:'close_ticket',ticketRef:'DEMO-TICKET-3',note:'Một thao tác chỉ ghi một lần.',expectedVersion:1};
    const first=await service.command(profiles.manager,ids.pilot,input,k);
    const retry=await service.command(profiles.manager,ids.pilot,input,k);
    expect(JSON.parse(JSON.stringify(first))).toEqual(retry);
    expect((await service.detail(profiles.manager,ids.pilot)).events.filter(e=>e.kind==='close_ticket')).toHaveLength(1);
    await expect(service.command(profiles.manager,ids.pilot,{...input,note:'Nội dung đã đổi.'},k)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  });
  test('audit and evidence cannot be updated or removed under runtime role',async()=>{
    for(const table of ['audit_events','evidence']) {
      await expect(scoped(db,profiles.manager,tx=>tx.query('UPDATE '+table+' SET updated_at=now()'))).rejects.toThrow();
      await expect(scoped(db,profiles.manager,tx=>tx.query('DELETE FROM '+table))).rejects.toThrow();
    }
  });
  test('create validates assignment and scoped service; fresh work enters planned state',async()=>{
    const input={projectId:ids.sales,serviceId:ids.salesService,code:'DEMO-NEW',title:'Việc mới để kiểm tra',priority:'normal',dueAt:null,assigneeId:profiles.engineer.id,technicalId:profiles.technical.id,businessId:profiles.business.id,criteria:'Tiêu chí kiểm thử đầy đủ.',specUrl:'https://example.com/demo/new',sourceSha:demoSha};
    await expect(service.create(profiles.manager,{...input,technicalId:profiles.engineer.id},key())).rejects.toMatchObject({code:'SELF_ACCEPTANCE'});
    await expect(service.create(profiles.manager,{...input,tenantId:ids.tenant},key())).rejects.toThrow();
    await expect(service.create(profiles.manager,{...input,serviceId:ids.otherService},key())).rejects.toMatchObject({code:'SCOPE_DENIED'});
    const d=await service.create(profiles.manager,input,key()); expect(d.work.state).toBe('planned'); expect(d.events).toHaveLength(1);
    expect((await service.refresh(profiles.manager)).summary.total).toBe(6);
    await expect(service.refresh(profiles.engineer)).rejects.toMatchObject({code:'MANAGER_REQUIRED'});
  });
});
describe('HTTP contract',()=>{
  const cookieFor=(profileKey:string)=>COOKIE+'='+createSession(req(),{profileKey}).token;
  test('unauthenticated, scoped reads, bot denials and CSRF boundary',async()=>{
    expect((await handleApi(req('GET'),['work'],db)).status).toBe(401);
    const cookie=cookieFor('bot');
    const visible=await handleApi(req('GET',{},cookie),['work'],db); expect(visible.status).toBe(200); expect((await visible.json()).data).toHaveLength(1);
    expect((await handleApi(req('GET',{},cookie),['work',ids.pilot],db)).status).toBe(404);
    const denied=await handleApi(req('POST',{},cookie),['work'],db); expect(denied.status).toBe(403); expect((await denied.json()).error.code).toBe('READ_ONLY');
    const cross=new Request(url+'/api/v1/work',{method:'POST',headers:{host:'127.0.0.1:3147',origin:'https://evil.example',cookie:cookieFor('manager')},body:'{}'});
    expect((await handleApi(cross,['work'],db)).status).toBe(403);
  });
  test('shared handler exposes useful GETs, validation errors and successful commands',async()=>{
    const cookie=cookieFor('manager');
    for(const endpoint of [['workspace'],['overview'],['services'],['work',ids.pilot]]) expect((await handleApi(req('GET',{},cookie),endpoint,db)).status).toBe(200);
    expect((await handleApi(req('GET',{},cookie),['unknown'],db)).status).toBe(404);
    expect((await handleApi(req('POST',{actorId:'forged'},cookie),['work'],db)).status).toBe(422);
    const post=req('POST',{kind:'close_ticket',expectedVersion:1,ticketRef:'API-DEMO',note:'Đóng ticket qua API mô phỏng.'},cookie); post.headers.set('idempotency-key',key());
    const result=await handleApi(post,['work',ids.pilot,'commands'],db); expect(result.status).toBe(200); const json=await result.json(); expect(json.data.work.state).toBe('review'); expect(json.meta.requestId).toBeTruthy();
    expect((await handleApi(req('POST',{},cookie),['overview','refresh'],db)).status).toBe(200);
  });
});
test('persistent store survives close/reopen; bootstrap does not overwrite edits',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'libetech-persistence-'));
  let fileDb:Database|undefined;
  try {
    fileDb=await embeddedDatabase(dir); await seed(fileDb);
    const s=new WorkService(fileDb); await s.command(profiles.manager,ids.pilot,{kind:'close_ticket',expectedVersion:1,ticketRef:'PERSIST-1',note:'Kiểm dữ liệu qua lần mở lại.'},key());
    await fileDb.close(); fileDb=await embeddedDatabase(dir); await seed(fileDb);
    const d:WorkDetail=await new WorkService(fileDb).detail(profiles.manager,ids.pilot); expect(d.work.version).toBe(2); expect(d.events.some(e=>e.kind==='close_ticket')).toBe(true);
  } finally { await fileDb?.close(); await rm(dir,{recursive:true,force:true}); }
});
