import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {openWorld,propose,say,rows,snapshot,setProjectRole,resetThrottle,identityOn,beforeStatementInTx,BASIS,type World} from './doc-approval-fixtures';
import {bot} from './slice1-fixtures';
import {approver,grantDocApproval,reviewer} from './slice3-fixtures';
import {COOKIE} from '../src/server/auth';
import {handleDocApprovalApi} from '../src/server/doc-approval-http';
import {AppError} from '../src/server/errors';
import {digest,type IdentityService} from '../src/server/identity';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// Task 7c, Task 1b: the thin handler of /api/team/doc-approvals. It only exposes DocApprovalProposalService; the principal comes from the
// session store, never from the body or the query. Synthetic data only; each case builds its own world (F5).
let w:World;
const tokens:string[]=[];
const store=globalThis as unknown as {libetechSessions?:Map<string,{principal:Principal;expires:number}>};
beforeEach(async()=>{w=await openWorld();});
afterEach(async()=>{for(const t of tokens.splice(0)) store.libetechSessions?.delete(t);await w.h.reset();await w.h.close();vi.restoreAllMocks();});

const S=ids.sales,T=ids.transport;
const url='http://127.0.0.1:3147';
const PENDING='Người này đang có một phiếu đổi quyền chưa xong.';
const PAIR_WAIT='Anh/chị chưa trình lại được cho người này: phiếu trước của anh/chị cho họ không được áp, và khoảng chờ 24 giờ sau phiếu đó chưa hết. Thử lại sau, hoặc nhờ quản trị tài khoản trình.';
type Body={data:any;error:{code:string;message:string}|null;meta:{requestId:string}};
/** A session for any principal, in the store the local login uses (as in tests/review-http.test.ts). */
const loginAs=(p:Principal)=>{
  const token='t'+randomUUID().replace(/-/g,'');
  (store.libetechSessions??=new Map()).set(token,{principal:p,expires:Date.now()+3600000});
  tokens.push(token);
  return COOKIE+'='+token;
};
/** `route` is the part after /api/team/doc-approvals, with its query string. */
async function call(method:string,route:string,o:{as?:Principal|null;payload?:unknown;raw?:string;origin?:string;identity?:()=>IdentityService}={}){
  const headers:Record<string,string>={host:'127.0.0.1:3147',origin:o.origin??url};
  if(o.as!==null) headers.cookie=loginAs(o.as??w.coordinator);
  const sends=method!=='GET'&&method!=='HEAD';
  const init:RequestInit={method,headers,...(sends&&o.raw!==undefined?{body:o.raw}:sends&&o.payload!==undefined?{body:JSON.stringify(o.payload)}:{})};
  const parts=route.split('?')[0].split('/').filter(Boolean);
  return handleDocApprovalApi(new Request(url+'/api/team/doc-approvals'+route,init),parts,o.identity??(()=>w.identity));
}
const json=async(r:Response)=>await r.clone().json() as Body;
/** The body with the per-request id removed: what must be identical across indistinguishable answers. */
const shape=async(r:Response)=>{const b=await json(r);return JSON.stringify({...b,meta:{...b.meta,requestId:undefined}});};
const P=(over:Record<string,unknown>={})=>({projectId:S,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS,...over});
const expectErr=async(r:Response,status:number,code:string,message?:string)=>{
  const b=await json(r);
  expect({status:r.status,code:b.error?.code},code).toEqual({status,code});
  if(message!==undefined) expect(b.error?.message).toBe(message);
  expect(b.data).toBeNull();
  expect(r.headers.get('cache-control'),code).toBe('no-store');
};
const attempts=async(p:Principal)=>Number((await rows<{n:number}>(w,'SELECT coalesce(max(attempts),0) AS n FROM identity.throttle WHERE bucket=$1',[digest('doc-approval-proposal:'+p.id)]))[0].n);

describe('coordinator proposal HTTP',()=>{
  test('no session answers 401, a cross-origin POST answers 403, forged fields answer 422',async()=>{
    for(const [m,route] of [['GET','?projectId='+S],['HEAD','?projectId='+S],['POST',''],['DELETE',''],['GET','/x']])
      await expectErr(await call(m,route,{as:null,payload:P()}),401,'UNAUTHENTICATED');
    for(const m of ['POST','PUT','PATCH','DELETE']) await expectErr(await call(m,'',{payload:P(),origin:'https://evil.example'}),403,'ORIGIN_DENIED');
    // a read never needs the origin check; HEAD is a read like GET
    for(const m of ['GET','HEAD']) expect((await call(m,'?projectId='+S,{origin:'https://evil.example'})).status,m).toBe(200);
    const before=await snapshot(w);
    const forged:Record<string,unknown>={proposerId:w.coManager.id,tenantId:ids.tenant,grants:[{projectId:S,role:'manager',reportPermissions:['doc_approve:design']}],
      role:'manager',reportPermissions:['doc_approve:design'],projectIds:[S,T],state:'approved'};
    for(const [k,v] of Object.entries(forged)) await expectErr(await call('POST','',{payload:P({[k]:v})}),422,'INVALID_INPUT');
    await expectErr(await call('POST','',{raw:JSON.stringify(P()).slice(0,-1)+',"__proto__":{"role":"manager"}}'}),422,'INVALID_INPUT');
    await expectErr(await call('POST','',{raw:'{nope'}),422,'INVALID_INPUT');
    for(const q of ['proposerId='+w.coManager.id,'tenantId='+ids.tenant,'role=manager','projectIds='+S])
      for(const m of ['GET','HEAD']) await expectErr(await call(m,'?projectId='+S+'&'+q),422,'INVALID_INPUT');
    expect(await snapshot(w)).toEqual(before);
    expect(await attempts(w.coordinator)).toBe(0);
  });

  test('each refusal keeps its status and code through the handler',async()=>{
    // 200: the coordinator's aggregated session role is `viewer` (two projects); the role that counts is the one in the database
    expect(w.coordinator.role).toBe('viewer');
    const ok=await call('POST','',{payload:P()});
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const made=await json(ok);
    expect(Object.keys(made)).toEqual(['data','error','meta']);
    expect(made.error).toBeNull();
    expect(Object.keys(made.data).sort()).toEqual(['addedTypes','approvalId','expiresAt','projectId','replayed','state','userId']);
    expect(made.data).toMatchObject({projectId:S,userId:w.subject.id,addedTypes:['design'],state:'pending',replayed:false});
    expect(new Date(made.data.expiresAt).toISOString()).toBe(made.data.expiresAt);
    // 404: a project the caller is not in; the bot principal
    await expectErr(await call('POST','',{payload:P({projectId:randomUUID()})}),404,'SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.');
    await expectErr(await call('POST','',{as:bot,payload:P()}),404,'SCOPE_DENIED');
    // 403: a member of the project who is not its coordinator
    await expectErr(await call('POST','',{payload:P({projectId:T,userId:w.transportMember.id})}),403,'MANAGER_REQUIRED');
    // 422: oneself; the account admin
    await expectErr(await call('POST','',{payload:P({userId:w.coordinator.id})}),422,'DOC_APPROVAL_PROPOSAL_INVALID');
    await expectErr(await call('POST','',{as:w.admin,payload:P()}),422,'DOC_APPROVAL_PROPOSAL_INVALID');
    // 409: another open ballot for the subject; the held types changed; nothing left to add
    await expectErr(await call('POST','',{as:w.coManager,payload:P()}),409,'APPROVAL_PENDING',PENDING);
    await expectErr(await call('POST','',{payload:P({userId:approver.id,expectedTypes:['plan']})}),409,'VERSION_CONFLICT');
    await grantDocApproval(w.h,reviewer.id,S,['design']);
    await expectErr(await call('POST','',{payload:P({userId:reviewer.id,expectedTypes:['design']})}),409,'ACCESS_CHANGE_NOT_NEEDED');
    // 429: the wait of the pair after a ballot that was not applied, then the hourly counter
    await say(w,0,made.data.approvalId,'reject');
    await expectErr(await call('POST','',{payload:P()}),429,'RATE_LIMITED',PAIR_WAIT);
    await resetThrottle(w);
    for(let i=0;i<10;i++) await expectErr(await call('POST','',{payload:P({userId:approver.id,expectedTypes:['plan']})}),409,'VERSION_CONFLICT');
    await expectErr(await call('POST','',{payload:P({userId:approver.id,expectedTypes:['plan']})}),429,'RATE_LIMITED','Thử lại sau ít phút.');
    // 409: no BoM seat other than the proposer's can vote
    await w.h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=ANY($1::uuid[])',[[w.approvers[2].id,w.approvers[3].id]]);
    await expectErr(await call('POST','',{as:w.seatCoordinator,payload:P({userId:approver.id})}),409,'APPROVERS_NOT_READY');
    // R7: the 422 of an unknown key carries the header too (the shared failure() sets none on that branch)
    const forged=await call('POST','',{payload:P({tenantId:ids.tenant})});
    expect(forged.status).toBe(422);
    expect(forged.headers.get('cache-control')).toBe('no-store');
  });

  test('GET requires projectId; a project the caller is not a member of answers the same 404 as an unknown project; a proposer demoted but still in the project still lists the own ballots',async()=>{
    for(const m of ['GET','HEAD']) {
      for(const q of ['','?x=1','?projectId='+S+'&x=1','?projectId='+S+'&projectId='+S,'?projectId='+S+'&__proto__=x','?projectId=not-a-uuid'])
        await expectErr(await call(m,q),422,'INVALID_INPUT');
    }
    const made=await propose(w,w.coordinator);
    const listed=async(p:Principal)=>{const r=await call('GET','?projectId='+S,{as:p});expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');return (await json(r)).data;};
    const mine=[{approvalId:made.approvalId,projectId:S,userId:w.subject.id,addedTypes:['design'],state:'pending',expiresAt:made.expiresAt,replayed:false}];
    expect(await listed(w.coordinator)).toEqual(mine);
    expect(await listed(w.coManager)).toEqual([]);
    // the bot principal, a bot principal carrying the coordinator's own id (an account row and an open ballot exist for it), and a principal
    // of another tenant with that id get the unknown-project 404 on the read path too, naming no ballot (AR-06; security review 1b M2)
    const unknownProject=await shape(await call('GET','?projectId='+randomUUID()));
    const botWithMemberId:Principal={...w.coordinator,role:'bot'};
    for(const p of [bot,botWithMemberId,{...w.coordinator,tenantId:ids.otherTenant}]) for(const m of ['GET','HEAD']) {
      const r=await call(m,'?projectId='+S,{as:p});
      const who=m+' '+(p===bot?'demo bot':p===botWithMemberId?'bot with member id':'other tenant');
      expect(r.status,who).toBe(404);
      await expectErr(r,404,'SCOPE_DENIED');
      expect(await shape(r),who).toBe(unknownProject);
      expect(JSON.stringify(await json(r))).not.toContain(made.approvalId);
    }
    // demoted, still a member of the project (any role, viewer included): still lists the own ballot (OQ-50 c)
    for(const role of ['engineer','viewer'] as const) {
      await setProjectRole(w,w.coordinator.id,S,role);
      expect(await listed(w.coordinator),role).toEqual(mine);
    }
    // removed from the project: the 404 of an unknown project, word for word, naming no ballot
    await setProjectRole(w,w.coordinator.id,S,null);
    const removed=await call('GET','?projectId='+S);
    await expectErr(removed,404,'SCOPE_DENIED');
    const unknown=await call('GET','?projectId='+randomUUID());
    expect(await shape(removed)).toBe(await shape(unknown));
    expect(JSON.stringify(await json(removed))).not.toContain(made.approvalId);
    // a project the caller was never a member of
    expect(await shape(await call('GET','?projectId='+T,{as:w.coManager}))).toBe(await shape(unknown));
    expect(await shape(await call('HEAD','?projectId='+T,{as:w.coManager}))).toBe(await shape(unknown));
  });

  test('an unknown path or method answers the common 404',async()=>{
    const answers=[await call('GET','/x'),await call('DELETE',''),await call('POST','/a/b/c',{payload:P()}),await call('PUT','',{payload:P()}),
      await call('PATCH','',{payload:P()}),await call('GET','/'+randomUUID()),await call('HEAD','/x')];
    for(const r of answers) await expectErr(r,404,'SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.');
    const shapes=await Promise.all(answers.map(shape));
    for(const s of shapes) expect(s).toBe(shapes[0]);
    // and the same body as the service's own out-of-scope answer
    expect(await shape(await call('POST','',{payload:P({projectId:randomUUID()})}))).toBe(shapes[0]);
    expect(await snapshot(w)).toMatchObject({approvals:0});
  });

  // Task 2: POST /<approvalId>/withdraw with the body {reason}. The id comes from the path only (T7C-31).
  const WITHDRAW='Đã trình nhầm loại tài liệu, xin rút lại';
  const withdrawCall=(id:string,o:{as?:Principal|null;payload?:unknown;raw?:string;origin?:string}={})=>call('POST','/'+id+'/withdraw',{payload:{reason:WITHDRAW},...o});
  const stateOf=async(id:string)=>(await rows<{state:string}>(w,'SELECT state FROM identity.account_approvals WHERE id=$1',[id]))[0].state;

  test('withdraw through the handler keeps each status and code',async()=>{
    const b1=await propose(w,w.coordinator);
    const b2=await propose(w,w.coordinator,{userId:reviewer.id});
    const b3=await propose(w,w.coordinator,{userId:approver.id});
    await say(w,2,b3.approvalId);
    // a ballot dead by an account change of its subject (as in W12)
    const b4=await propose(w,w.coordinator,{userId:w.coManager.id});
    const version=(await rows<{v:number}>(w,'SELECT account_version v FROM identity.users WHERE id=$1',[w.coManager.id]))[0].v;
    await w.accounts.command(w.admin,{kind:'revoke_sessions',userId:w.coManager.id,expectedVersion:version,reason:'Thu hồi phiên của đồng điều phối mẫu'});
    // 200
    const ok=await withdrawCall(b1.approvalId);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(await json(ok)).toMatchObject({data:{approvalId:b1.approvalId,state:'withdrawn'},error:null});
    expect(Object.keys((await json(ok)).data).sort()).toEqual(['approvalId','state']);
    // 409: closed (a second withdrawal; a ballot dead by an account change); approved (OQ-51 b)
    await expectErr(await withdrawCall(b1.approvalId),409,'APPROVAL_CLOSED','Phiếu đã kết thúc hoặc hết hạn.');
    await expectErr(await withdrawCall(b4.approvalId),409,'APPROVAL_CLOSED','Phiếu đã kết thúc hoặc hết hạn.');
    await expectErr(await withdrawCall(b3.approvalId),409,'BALLOT_ALREADY_APPROVED','Phiếu đã đủ xác nhận, không còn rút được ở đây. Nhờ quản trị tài khoản huỷ nếu cần.');
    // 404: not the proposer; an id in the path that is not a uuid
    await expectErr(await withdrawCall(b2.approvalId,{as:w.coManager}),404,'SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.');
    await expectErr(await withdrawCall('x'),404,'SCOPE_DENIED');
    // 422: an unknown key in the body, expectedState of plan 0.1 included; a body that is not JSON
    for(const extra of [{expectedState:'pending'},{state:'expired'},{proposerId:w.coordinator.id},{tenantId:ids.tenant}])
      await expectErr(await withdrawCall(b2.approvalId,{payload:{reason:WITHDRAW,...extra}}),422,'INVALID_INPUT');
    await expectErr(await withdrawCall(b2.approvalId,{raw:'{nope'}),422,'INVALID_INPUT');
    // 401 without a session; 403 from another origin
    await expectErr(await withdrawCall(b2.approvalId,{as:null}),401,'UNAUTHENTICATED');
    await expectErr(await withdrawCall(b2.approvalId,{origin:'https://evil.example'}),403,'ORIGIN_DENIED');
    expect(await stateOf(b2.approvalId)).toBe('pending');
    // 404: the proposer removed from the project, the same body as an unknown ballot
    await setProjectRole(w,w.coordinator.id,S,null);
    const removed=await withdrawCall(b2.approvalId);
    await expectErr(removed,404,'SCOPE_DENIED');
    expect(await shape(removed)).toBe(await shape(await withdrawCall(randomUUID())));
    expect(await stateOf(b2.approvalId)).toBe('pending');
    expect(await stateOf(b3.approvalId)).toBe('approved');
    expect(await stateOf(b4.approvalId)).toBe('pending');
  });

  test('withdraw takes the ballot id from the path only',async()=>{
    const b1=await propose(w,w.coordinator);
    const b2=await propose(w,w.coordinator,{userId:reviewer.id});
    // the same id as the path is still an unknown key
    await expectErr(await withdrawCall(b1.approvalId,{payload:{approvalId:b1.approvalId,reason:WITHDRAW}}),422,'INVALID_INPUT');
    expect(await stateOf(b1.approvalId)).toBe('pending');
    // another id: the body does not override the path, and the path does not silently win
    await expectErr(await withdrawCall(b1.approvalId,{payload:{approvalId:b2.approvalId,reason:WITHDRAW}}),422,'INVALID_INPUT');
    expect([await stateOf(b1.approvalId),await stateOf(b2.approvalId)]).toEqual(['pending','pending']);
    const ok=await withdrawCall(b1.approvalId);
    expect(ok.status).toBe(200);
    expect((await json(ok)).data).toEqual({approvalId:b1.approvalId,state:'withdrawn'});
    expect([await stateOf(b1.approvalId),await stateOf(b2.approvalId)]).toEqual(['expired','pending']);
    // a body without reason
    await expectErr(await withdrawCall(b2.approvalId,{payload:{}}),422,'INVALID_INPUT');
    expect(await stateOf(b2.approvalId)).toBe('pending');
  });

  // Fix round 1, F1 of the Task 2 security review: the withdrawal's hourly cap answers through the handler like every other refusal.
  test('a withdrawal past the hourly cap answers 429 with no-store',async()=>{
    const made=await propose(w,w.coordinator);
    for(let i=0;i<10;i++) await expectErr(await withdrawCall(randomUUID()),404,'SCOPE_DENIED');
    const capped=await withdrawCall(made.approvalId);
    await expectErr(capped,429,'RATE_LIMITED','Thử lại sau ít phút.');
    expect(JSON.stringify(await json(capped))).not.toContain(made.approvalId);
    expect(await stateOf(made.approvalId)).toBe('pending');
  });

  test('paths under an approval id that the handler does not serve answer the common 404',async()=>{
    const {approvalId:id}=await propose(w,w.coordinator);
    const payload={reason:WITHDRAW};
    const answers=[await call('GET','/'+id+'/withdraw'),await call('HEAD','/'+id+'/withdraw'),await call('POST','/'+id,{payload}),
      await call('POST','/'+id+'/withdraw/x',{payload}),await call('PUT','/'+id+'/withdraw',{payload}),await call('PATCH','/'+id+'/withdraw',{payload}),
      await call('DELETE','/'+id+'/withdraw',{payload}),await call('POST','/'+id+'/WITHDRAW',{payload})];
    const common=await shape(await call('GET','/x'));
    for(const r of answers) {
      await expectErr(r,404,'SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.');
      expect(await shape(r)).toBe(common);
    }
    await expectErr(await call('HEAD','?x=1'),422,'INVALID_INPUT');
    expect(await stateOf(id)).toBe('pending');
  });

  test('identity not configured answers 503 and an unexpected failure answers 500, both through the handler and both no-store',async()=>{
    const logged:string[]=[];
    vi.spyOn(console,'error').mockImplementation((...args:unknown[])=>{logged.push(args.map(String).join(' '));});
    const unavailable=()=>{throw new AppError('IDENTITY_UNAVAILABLE','Đăng nhập chưa được cấu hình.',503);};
    const broken=()=>{throw new Error('boom');};
    for(const [m,route] of [['GET','?projectId='+S],['POST','']] as const) {
      await expectErr(await call(m,route,{payload:P(),identity:unavailable}),503,'IDENTITY_UNAVAILABLE');
      const r=await call(m,route,{payload:P(),identity:broken});
      await expectErr(r,500,'INTERNAL_ERROR');
      expect(JSON.stringify(await json(r))).not.toContain('boom');
    }
    // H1: a unique violation the service does not map (a real conflict on the first voter row) is the generic 500, never the shared DUPLICATE_CODE
    const before=await snapshot(w);
    const voterClash=identityOn(w,beforeStatementInTx(w.h.operator,/INSERT INTO identity\.account_approval_voters/,async(tx,sql,params)=>{await tx.query(sql,params);}));
    const clash=await call('POST','',{payload:P(),identity:()=>voterClash});
    await expectErr(clash,500,'INTERNAL_ERROR');
    expect(JSON.stringify(await json(clash))).not.toMatch(/account_approval|duplicate|23505/i);
    expect(await snapshot(w)).toEqual(before);
    // the fail-closed internal Error of P11 (stored grants that repeat a code and leave no room for one more) is the same generic 500
    await w.h.operator.query('UPDATE identity.memberships SET report_permissions=$3 WHERE user_id=$1 AND project_id=$2',[w.subject.id,S,Array(11).fill('people_read')]);
    const p11=await call('POST','',{payload:P()});
    await expectErr(p11,500,'INTERNAL_ERROR');
    expect(JSON.stringify(await json(p11))).not.toMatch(/pure addition|grants/i);
    expect(await snapshot(w)).toEqual(before);
    // the log names the request and the error type only
    expect(logged.length).toBeGreaterThan(0);
    for(const line of logged) {
      expect(line).toMatch(/"event":"request_failed"/);
      expect(line).not.toMatch(/boom|account_approval|pure addition|people_read|Điều phối|Cần người duyệt/);
    }
  });

  test('only /api/team/accounts can apply grants',async()=>{
    const walk=async(d:string):Promise<string[]>=>(await Promise.all((await readdir(d)).map(async f=>{const p=path.join(d,f);return (await stat(p)).isDirectory()?walk(p):[p];}))).flat();
    const routes=(await walk('src/app/api')).filter(f=>/route\.tsx?$/.test(f));
    const applying:string[]=[];
    for(const f of routes) {const src=await readFile(f,'utf8');if(/\bAccountService\b/.test(src)&&/\.command\(/.test(src)) applying.push(f.split(path.sep).join('/'));}
    expect(applying).toEqual(['src/app/api/team/accounts/route.ts']);
    for(const f of ['src/server/doc-approval-proposals.ts','src/server/doc-approval-http.ts']) {
      const src=await readFile(f,'utf8');
      expect(src,f).not.toContain('setGrants');
      expect(src,f).not.toMatch(/(INSERT INTO|UPDATE|DELETE FROM)\s+identity\.memberships/);
    }
    // the new route file only forwards to the handler
    const route=await readFile('src/app/api/team/doc-approvals/[[...path]]/route.ts','utf8');
    expect([...route.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]).sort()).toEqual(['@/server/doc-approval-http','@/server/identity']);
    expect(route).toMatch(/runtime\s*=\s*'nodejs'/);expect(route).toMatch(/dynamic\s*=\s*'force-dynamic'/);
    for(const m of ['GET','POST','PUT','PATCH','DELETE']) expect(route).toMatch(new RegExp(`export const ${m}\\s*=\\s*handler`));
  });
});
