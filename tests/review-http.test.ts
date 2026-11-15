import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {approver,delegate,frozenRevision,grantDocApproval,proposeRev,registerDoc,reviewer,seedMembers} from './slice3-fixtures';
import {COOKIE,createSession} from '../src/server/auth';
import {handleDecisionsApi,handleReviewApi} from '../src/server/review-http';
import {DocumentService} from '../src/server/documents';
import {NOT_FOUND_COPY} from '../src/components/review-view';
import {DelegationService} from '../src/server/review-delegations';
import {ids,demoProfiles} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// Slice 3 Task 15: the web handlers for Review, project reviewers, document dependencies and the Decisions list. They only expose the services.
let h:Harness;
const url='http://127.0.0.1:3147';
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const login=(profileKey:string)=>COOKIE+'='+createSession(new Request(url+'/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:url}}),{profileKey}).token;
/** A session for a principal the demo profiles do not have (a manager of another project): put in the same store the demo login uses. */
const loginAs=(p:Principal)=>{
  const store=globalThis as unknown as {libetechSessions?:Map<string,{principal:Principal;expires:number}>};
  const token='t'+randomUUID().replace(/-/g,'');
  (store.libetechSessions??=new Map()).set(token,{principal:p,expires:Date.now()+3600000});
  return COOKIE+'='+token;
};
const transportManager:Principal={id:'14000000-0000-4000-8000-000000000042',tenantId:ids.tenant,projectIds:[ids.transport],name:'Điều phối Vận tải mẫu',role:'manager',
  grants:[{projectId:ids.transport,role:'manager',reportPermissions:[]}]};
async function call(method:string,route:string,o:{cookie?:string|null;payload?:unknown;raw?:string;key?:string|null;origin?:string}={}){
  const headers:Record<string,string>={host:'127.0.0.1:3147',origin:o.origin??url};
  if(o.cookie!==null) headers.cookie=o.cookie??login('manager');
  if(o.key!==null&&method!=='GET') headers['idempotency-key']=o.key??'http-key-'+Math.random().toString(36).slice(2,12);
  const init:RequestInit={method,headers,...(o.raw!==undefined?{body:o.raw}:o.payload!==undefined?{body:JSON.stringify(o.payload)}:{})};
  const request=new Request(url+route,init);
  const pathOnly=route.split('?')[0];
  if(pathOnly==='/api/decisions') return handleDecisionsApi(request,h.db);
  return handleReviewApi(request,pathOnly.split('/').filter(Boolean).slice(1),h.db);
}
const json=async(r:Response)=>r.json() as Promise<any>;
const k=()=>'k-'+randomUUID();
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const HASH='a1'.repeat(32);
const BASIS='Điều phối giao nhận xét tài liệu thiết kế';
const REVOKE_BASIS='Thu hồi vì hết nhiệm vụ nhận xét';

type W={docId:string;revisionId:string;version:number;hash:string|null};
async function world(o:{frozen?:boolean;projectId?:string}={}):Promise<W> {
  const doc=await registerDoc(h,pm,{projectId:o.projectId??ids.sales,docType:'design'});
  if(o.frozen===false) await proposeRev(h,member,doc,{sourceHash:HASH});
  else await frozenRevision(h,doc.record.id,member.id);
  const r=(await rows<{version:number;latest_revision_id:string;source_hash:string|null}>(
    'SELECT d.version,d.latest_revision_id,v.source_hash FROM document_records d JOIN document_revisions v ON v.id=d.latest_revision_id WHERE d.id=$1',[doc.record.id]))[0];
  return {docId:doc.record.id,revisionId:r.latest_revision_id,version:r.version,hash:r.source_hash};
}
const dec=(w:W,over:R={}):R=>({revisionId:w.revisionId,sourceHash:w.hash,expectedVersion:w.version,result:'changes_requested',scopeNote:'Đã đọc đúng bản này',exceptions:[],...over});
const cmt=(w:W,over:R={}):R=>({kind:'comment',revisionId:w.revisionId,anchor:'Mục 1',body:'Cần làm rõ phạm vi',...over});
const G=(over:R={}):R=>({projectId:ids.sales,delegateId:member.id,docTypes:['design'],basis:BASIS,...over});
const V=(version:number,over:R={}):R=>({expectedVersion:version,basis:REVOKE_BASIS,...over});
const delegationVersion=async(id:string)=>(await rows<{version:number}>('SELECT version FROM review_delegations WHERE id=$1',[id]))[0].version;
/** The body with the per-request id removed: what must be byte-identical across indistinguishable answers. */
const shape=async(r:Response)=>{const b=await json(r);delete b.meta.requestId;return JSON.stringify(b);};

describe('review HTTP',()=>{
  test('no session answers 401; a cross-origin POST answers 403',async()=>{
    const w=await world();
    for(const [m,route] of [['GET','/api/reviews?projectId='+ids.sales],['GET','/api/reviews/'+w.docId],['GET','/api/reviews/dependencies?projectId='+ids.sales],
      ['GET','/api/reviews/delegations?projectId='+ids.sales],['GET','/api/decisions?projectId='+ids.sales],['POST','/api/reviews/'+w.docId+'/decisions']])
      expect((await call(m,route,{cookie:null})).status,m+route).toBe(401);
    for(const [route,payload] of [['/api/reviews/'+w.docId+'/comments',cmt(w)],['/api/reviews/'+w.docId+'/decisions',dec(w)],['/api/reviews/dependencies',{}],
      ['/api/reviews/delegations',G()],['/api/reviews/delegations/'+randomUUID()+'/revoke',V(1)]] as const) {
      const r=await call('POST',route,{payload,origin:'https://evil.example'});
      expect(r.status,route).toBe(403);
    }
    expect(await n('review_comments')+await n('review_decisions')+await n('review_delegations')).toBe(0);
  });

  test('W11 HEAD is a read like GET (Next.js serves it through the exported GET): it answers the GET status, never the origin refusal; writes still refuse a foreign origin',async()=>{
    const w=await world(),cookie=login('manager');
    for(const route of ['/api/reviews?projectId='+ids.sales,'/api/reviews/'+w.docId,'/api/reviews/delegations?projectId='+ids.sales,'/api/decisions?projectId='+ids.sales]) {
      const get=await call('GET',route,{cookie,origin:'https://evil.example'});
      const head=await call('HEAD',route,{cookie,origin:'https://evil.example'});
      expect(head.status,route).toBe(get.status);
      expect(head.status,route).toBe(200);
    }
    expect((await call('HEAD','/api/reviews?projectId='+ids.sales,{cookie:null})).status).toBe(401);
    expect((await call('POST','/api/reviews/'+w.docId+'/comments',{cookie,payload:cmt(w),origin:'https://evil.example'})).status).toBe(403);
    expect((await call('PUT','/api/decisions?projectId='+ids.sales,{cookie,origin:'https://evil.example'})).status).toBe(403);
    // the demo session store holds 200 sessions per process and this file is close to it: give this test's session back
    (globalThis as unknown as {libetechSessions?:Map<string,unknown>}).libetechSessions?.delete(cookie.slice(COOKIE.length+1));
  });

  test('W13 the not-found sentence of the client is the sentence of the handler and of the review service',async()=>{
    const literal=(src:string,from:RegExp)=>{const m=from.exec(src);expect(m,String(from)).toBeTruthy();return m![1];};
    const handler=literal(await readFile('src/server/review-http.ts','utf8'),/const notFound = \(\) => new AppError\('SCOPE_DENIED', '([^']+)', 404\)/);
    const service=literal(await readFile('src/server/document-review.ts','utf8'),/const NOT_FOUND = '([^']+)'/);
    expect(NOT_FOUND_COPY).toBe(handler);
    expect(NOT_FOUND_COPY).toBe(service);
  });

  test('unknown path, unknown id and out-of-scope id answer the same 404 body; bot and viewer get that same answer',async()=>{
    const w=await world(),tw=await world({projectId:ids.transport});
    const delegationId=await delegate(h,ids.sales,member.id);
    const unknownId=randomUUID();
    const cases:[string,string,string|undefined][]=[
      ['GET','/api/reviews/nothing/here/at/all',undefined],
      ['GET','/api/reviews/dependencies/x',undefined],
      ['GET','/api/reviews/delegations/x',undefined],
      ['GET','/api/reviews/not-a-uuid',undefined],
      ['GET','/api/reviews/'+unknownId,undefined],
      ['GET','/api/reviews/'+tw.docId,login('technical')],            // a document of a project the session does not hold
      ['GET','/api/reviews/'+w.docId,login('bot')],
      ['GET','/api/reviews/'+w.docId,login('customer')],               // viewer of another project
      ['GET','/api/reviews?projectId='+ids.sales,login('bot')],
      ['GET','/api/reviews?projectId='+ids.transport,login('technical')],
      ['GET','/api/reviews?projectId='+ids.sales,login('customer')],
      ['GET','/api/reviews/dependencies?projectId='+ids.sales,login('bot')],
      ['GET','/api/reviews/dependencies?projectId='+ids.transport,login('technical')],
      ['GET','/api/reviews/decisions',undefined],                      // not an alias of the Decisions list
      ['PATCH','/api/reviews/'+w.docId,undefined],['PUT','/api/reviews/'+w.docId,undefined],['DELETE','/api/reviews/'+w.docId,undefined],
      ['POST','/api/reviews/'+w.docId,undefined],['POST','/api/reviews',undefined],['POST','/api/reviews/'+w.docId+'/other',undefined],
      ['PATCH','/api/reviews',undefined],['DELETE','/api/reviews/dependencies',undefined],['PUT','/api/reviews/dependencies',undefined],
      ['PATCH','/api/reviews/'+w.docId+'/comments',undefined],['PUT','/api/reviews/'+w.docId+'/decisions',undefined],['GET','/api/reviews/'+w.docId+'/decisions',undefined],
    ];
    const delegationCases:[string,string,string|undefined,unknown?][]=[
      ['POST','/api/reviews/delegations/'+unknownId+'/revoke',undefined,V(1)],
      ['POST','/api/reviews/delegations/not-a-uuid/revoke',undefined,V(1)],
      ['POST','/api/reviews/delegations/'+delegationId+'/revoke',login('bot'),V(1)],
      ['POST','/api/reviews/delegations/'+delegationId+'/revoke',login('customer'),V(1)],
      ['POST','/api/reviews/delegations/'+delegationId+'/revoke',loginAs(transportManager),V(1)],   // a member of another project
      ['GET','/api/reviews/delegations?projectId='+ids.sales,login('bot')],
      ['GET','/api/reviews/delegations?projectId='+ids.sales,login('customer')],
      ['GET','/api/reviews/delegations?projectId='+ids.transport,login('technical')],                // a project outside the caller's scope
      ['POST','/api/reviews/delegations',loginAs(transportManager),G()],
      ['POST','/api/reviews/delegations',login('bot'),G()],
    ];
    const bodies:string[]=[];
    for(const [m,route,cookie] of cases) {
      const r=await call(m,route,{cookie,payload:m==='GET'?undefined:{}});
      expect(r.status,m+' '+route).toBe(404);
      bodies.push(await shape(r));
    }
    for(const [m,route,cookie,payload] of delegationCases) {
      const r=await call(m,route,{cookie,payload});
      expect(r.status,m+' '+route).toBe(404);
      bodies.push(await shape(r));
    }
    // the Decisions list is reachable only at /api/decisions and answers bot, viewer and a stranger the same way
    for(const [m,route,cookie] of [['GET','/api/decisions?projectId='+ids.sales,login('bot')],['GET','/api/decisions?projectId='+ids.sales,login('customer')],
      ['GET','/api/decisions?projectId='+ids.transport,login('technical')],['POST','/api/decisions',undefined],['PUT','/api/decisions',undefined],['PATCH','/api/decisions',undefined],['DELETE','/api/decisions',undefined]] as const) {
      const r=await call(m,route,{cookie,payload:m==='GET'?undefined:{}});
      expect(r.status,m+' '+route).toBe(404); bodies.push(await shape(r));
    }
    expect(bodies.length).toBeGreaterThan(40);
    // R15-g: one body for every class of denial, in every route family (meta.requestId removed: it is per request; no other field differs)
    for(const b of bodies) expect(b).toBe(bodies[0]);
    expect(JSON.parse(bodies[0])).toEqual({data:null,error:{code:'SCOPE_DENIED',message:'Không tìm thấy tài liệu trong phạm vi được cấp.'},meta:{}});
    // PATCH, PUT, DELETE and anything unknown under delegations
    for(const [m,route] of [['PATCH','/api/reviews/delegations/'+delegationId],['PUT','/api/reviews/delegations/'+delegationId],['DELETE','/api/reviews/delegations/'+delegationId],
      ['PATCH','/api/reviews/delegations/'+delegationId+'/revoke'],['DELETE','/api/reviews/delegations/'+delegationId+'/revoke'],['GET','/api/reviews/delegations/'+delegationId+'/revoke'],
      ['POST','/api/reviews/delegations/'+delegationId],['POST','/api/reviews/delegations/'+delegationId+'/edit'],['PATCH','/api/reviews/delegations'],['DELETE','/api/reviews/delegations'],
      ['GET','/api/reviews/delegations/'+delegationId],['POST','/api/reviews/delegations/'+delegationId+'/revoke/extra']]) {
      const r=await call(m,route,{payload:m==='GET'?undefined:{}});
      expect(r.status,m+' '+route).toBe(404); expect(await shape(r),m+' '+route).toBe(bodies[0]);
    }
  });

  test('forged body fields answer 422 on every POST and write nothing',async()=>{
    const w=await world(),w2=await world();
    await grantDocApproval(h,approver.id,ids.sales,['design']);
    const delegationId=await delegate(h,ids.sales,member.id);
    const before=async()=>[await n('review_decisions'),await n('review_comments'),await n('review_delegations'),await n('document_dependencies'),await n('review_events')];
    const snap=await before();
    const forged=async(route:string,cookie:string,base:R,extras:R[])=>{
      for(const extra of extras) {
        const r=await call('POST',route,{cookie,payload:{...base,...extra}});
        expect(r.status,route+JSON.stringify(extra)).toBe(422); expect((await json(r)).error.code).toBe('INVALID_INPUT');
      }
    };
    await forged(`/api/reviews/${w.docId}/decisions`,login('business'),dec(w,{result:'approved'}),
      [{actorId:pm.id},{decidedBy:pm.id},{tenantId:ids.otherTenant},{projectId:ids.sales},{delegationId:randomUUID()},{authority:'approval_grant'},{requestId:randomUUID()}]);
    await forged(`/api/reviews/${w.docId}/comments`,login('technical'),cmt(w),[{actorId:pm.id},{tenantId:ids.otherTenant},{projectId:ids.sales},{documentId:w.docId},{requestId:randomUUID()}]);
    await forged('/api/reviews/delegations',login('manager'),G(),[{grantedBy:pm.id},{capability:'approve'},{approve:true},{revokedAt:'2026-01-01T00:00:00Z'},{tenantId:ids.otherTenant},{actorId:pm.id}]);
    await forged(`/api/reviews/delegations/${delegationId}/revoke`,login('manager'),V(1),[{revokedBy:pm.id},{revokedAt:'2026-01-01T00:00:00Z'},{docTypes:['design']},{projectId:ids.sales}]);
    await forged('/api/reviews/dependencies',login('manager'),{projectId:ids.sales,upstreamDocumentId:w.docId,upstreamRevisionId:w.revisionId,dependentDocumentId:w2.docId},[{actorId:pm.id},{confirmedBy:pm.id},{tenantId:ids.otherTenant}]);
    // a body that is not an object, or not JSON
    for(const raw of ['[]','null','7','"x"']) expect((await call('POST',`/api/reviews/${w.docId}/comments`,{cookie:login('technical'),raw})).status,raw).toBe(422);
    expect((await call('POST',`/api/reviews/${w.docId}/comments`,{cookie:login('technical'),raw:'{not json'})).status).toBe(422);
    expect(await before()).toEqual(snap);
  });

  test('a decision without idempotency key answers 400; the request id in meta is the one stored on the decision and on the event',async()=>{
    const w=await world();
    await grantDocApproval(h,approver.id,ids.sales,['design']);
    const missing=await call('POST',`/api/reviews/${w.docId}/decisions`,{cookie:login('business'),payload:dec(w,{result:'approved'}),key:null});
    expect(missing.status).toBe(400); expect((await json(missing)).error.code).toBe('IDEMPOTENCY_REQUIRED');
    expect(await n('review_decisions')).toBe(0);
    const r=await call('POST',`/api/reviews/${w.docId}/decisions`,{cookie:login('business'),payload:dec(w,{result:'approved'})});
    expect(r.status).toBe(200);
    const b=await json(r);
    expect(b.data.item.decision).toMatchObject({result:'approved',decidedBy:approver.id});
    const row=(await rows<{request_id:string}>('SELECT request_id FROM review_decisions'))[0];
    expect(b.meta.requestId).toBe(row.request_id);
    const ev=await rows<{request_id:string}>("SELECT request_id FROM review_events WHERE kind='review.approved'");
    expect(ev.map(e=>e.request_id)).toEqual([b.meta.requestId]);
    // the body cannot carry a request id: refused, nothing stored under it
    const w2=await world();
    const forged=randomUUID();
    const f=await call('POST',`/api/reviews/${w2.docId}/decisions`,{cookie:login('business'),payload:dec(w2,{result:'approved',requestId:forged})});
    expect(f.status).toBe(422);
    expect(await rows('SELECT 1 FROM review_events WHERE request_id=$1',[forged])).toHaveLength(0);
  });

  test('a comment round trip: the path document and the request id reach the service, nothing else does',async()=>{
    const w=await world();
    await delegate(h,ids.sales,reviewer.id);
    const r=await call('POST',`/api/reviews/${w.docId}/comments`,{cookie:login('technical'),payload:cmt(w)});
    expect(r.status).toBe(200);
    const b=await json(r);
    expect(b.data.comments).toHaveLength(1);
    expect(b.data.comments[0]).toMatchObject({kind:'comment',actorId:reviewer.id,body:'Cần làm rõ phạm vi'});
    const row=(await rows<{document_id:string;request_id:string;actor_id:string}>('SELECT document_id,request_id,actor_id FROM review_comments'))[0];
    expect(row).toMatchObject({document_id:w.docId,request_id:b.meta.requestId,actor_id:reviewer.id});
    expect((await rows<{request_id:string}>("SELECT request_id FROM review_events WHERE kind='review.comment'")).map(e=>e.request_id)).toEqual([b.meta.requestId]);
    // the author answers it
    const reply=await call('POST',`/api/reviews/${w.docId}/comments`,{cookie:login('engineer'),payload:{kind:'addressed',parentId:b.data.comments[0].id,body:'Đã bổ sung phần phạm vi'}});
    expect(reply.status).toBe(200); expect((await json(reply)).data.comments).toHaveLength(2);
  });

  test('every POST of this handler needs an Idempotency-Key, and nothing is written without it',async()=>{
    const w=await world(),w2=await world();
    const delegationId=await delegate(h,ids.sales,member.id);
    const snap=[await n('review_decisions'),await n('review_comments'),await n('review_delegations'),await n('document_dependencies')];
    for(const [route,payload] of [[`/api/reviews/${w.docId}/comments`,cmt(w)],[`/api/reviews/${w.docId}/decisions`,dec(w)],
      ['/api/reviews/dependencies',{projectId:ids.sales,upstreamDocumentId:w.docId,upstreamRevisionId:w.revisionId,dependentDocumentId:w2.docId}],['/api/reviews/delegations',G({delegateId:reviewer.id})],
      [`/api/reviews/delegations/${delegationId}/revoke`,V(1)]] as const) {
      for(const key of [null,'']) {
        const r=await call('POST',route,{payload,key});
        expect(r.status,route+String(key)).toBe(400); expect((await json(r)).error.code).toBe('IDEMPOTENCY_REQUIRED');
      }
    }
    expect([await n('review_decisions'),await n('review_comments'),await n('review_delegations'),await n('document_dependencies')]).toEqual(snap);
  });

  test('OQ-31 through the handler: self-designation 422, a manager of another project 404, missing document types 422; a designation round trip',async()=>{
    const self=await call('POST','/api/reviews/delegations',{payload:G({delegateId:pm.id})});
    expect(self.status).toBe(422); expect((await json(self)).error.code).toBe('DELEGATION_INVALID');
    const other=await call('POST','/api/reviews/delegations',{cookie:loginAs(transportManager),payload:G()});
    expect(other.status).toBe(404); expect((await json(other)).error.code).toBe('SCOPE_DENIED');
    const {docTypes:_d,...noTypes}=G();
    for(const payload of [noTypes,G({docTypes:[]}),G({docTypes:['unknown']})]) expect((await call('POST','/api/reviews/delegations',{payload})).status).toBe(422);
    expect(await n('review_delegations')).toBe(0);
    const ok=await call('POST','/api/reviews/delegations',{payload:G()});
    expect(ok.status).toBe(200);
    const b=await json(ok);
    expect(b.data).toMatchObject({delegateId:member.id,docTypes:['design']});
    expect((await rows<{request_id:string}>("SELECT request_id FROM review_events WHERE kind='delegation.granted'")).map(e=>e.request_id)).toEqual([b.meta.requestId]);
    const again=await call('POST','/api/reviews/delegations',{payload:G()});
    expect(again.status).toBe(409); expect((await json(again)).error.code).toBe('DELEGATION_EXISTS');
    // a member who is not a manager of the project is told so
    const notManager=await call('POST','/api/reviews/delegations',{cookie:login('technical'),payload:G({delegateId:reviewer.id})});
    expect(notManager.status).toBe(403); expect((await json(notManager)).error.code).toBe('MANAGER_REQUIRED');
  });

  test('OQ-34 through the handler: revoke by a coordinator, refusals, conflict',async()=>{
    const id=await delegate(h,ids.sales,member.id);
    const route=`/api/reviews/delegations/${id}/revoke`;
    // not a coordinator, the delegate included
    for(const who of ['engineer','technical','business']) {
      const r=await call('POST',route,{cookie:login(who),payload:V(1)}); expect(r.status,who).toBe(403); expect((await json(r)).error.code).toBe('MANAGER_REQUIRED');
    }
    const {basis:_b,...noBasis}=V(1),{expectedVersion:_v,...noVersion}=V(1);
    for(const payload of [noBasis,noVersion]) expect((await call('POST',route,{payload})).status).toBe(422);
    expect((await call('POST',route,{payload:V(1),key:null})).status).toBe(400);
    expect((await call('POST',route,{payload:V(9)})).status).toBe(409);
    expect((await rows('SELECT 1 FROM review_delegations WHERE revoked_at IS NOT NULL'))).toHaveLength(0);
    const ok=await call('POST',route,{payload:V(await delegationVersion(id))});
    expect(ok.status).toBe(200);
    const b=await json(ok);
    expect(b.data).toMatchObject({id});
    expect(b.data.revokedAt).toBeTruthy();
    expect((await rows<{request_id:string}>("SELECT request_id FROM review_events WHERE kind='delegation.revoked'")).map(e=>e.request_id)).toEqual([b.meta.requestId]);
    const again=await call('POST',route,{payload:V(await delegationVersion(id))});
    expect(again.status).toBe(409); expect((await json(again)).error.code).toBe('DELEGATION_CONFLICT');
  });

  test('REVISION_CONFLICT, SOURCE_NOT_FROZEN, APPROVER_NOT_AUTHORIZED, REVIEW_ALREADY_DECIDED, DEPENDENCY_INVALID and DEPENDENCY_EXISTS keep their status and code',async()=>{
    await grantDocApproval(h,approver.id,ids.sales,['design']);
    const w=await world();
    const decide=(who:string,ww:W,over:R={})=>call('POST',`/api/reviews/${ww.docId}/decisions`,{cookie:login(who),payload:dec(ww,over)});
    const expectErr=async(r:Response,status:number,code:string)=>{expect(r.status).toBe(status);expect((await json(r)).error.code).toBe(code);expect(r.headers.get('cache-control')).toBe('no-store');};
    await expectErr(await decide('business',w,{result:'approved',expectedVersion:w.version+1}),409,'REVISION_CONFLICT');
    await expectErr(await decide('engineer',w),403,'APPROVER_NOT_AUTHORIZED');
    const unfrozen=await world({frozen:false});
    await expectErr(await decide('business',unfrozen,{result:'approved'}),409,'SOURCE_NOT_FROZEN');
    expect((await decide('business',w,{result:'approved'})).status).toBe(200);
    await expectErr(await decide('business',w,{result:'approved'}),409,'REVIEW_ALREADY_DECIDED');
    const a=await world(),b=await world();
    const mgr=login('manager');   // one session for the whole test: the demo store caps live sessions
    const link=async(up:string,down:string,over:R={})=>call('POST','/api/reviews/dependencies',{cookie:mgr,payload:{projectId:ids.sales,upstreamDocumentId:up,upstreamRevisionId:(await rows<{latest_revision_id:string}>('SELECT latest_revision_id FROM document_records WHERE id=$1',[up]))[0].latest_revision_id,dependentDocumentId:down,...over}});
    await expectErr(await link(a.docId,a.docId),422,'DEPENDENCY_INVALID');
    const first=await link(a.docId,b.docId); expect(first.status).toBe(200);
    expect((await json(first)).data).toMatchObject({upstreamDocumentId:a.docId,dependentDocumentId:b.docId});
    await expectErr(await link(a.docId,b.docId),409,'DEPENDENCY_EXISTS');
    // the command names the revision that was seen: without it 422, a stale or foreign one 409, and nothing is written
    const c=await world(),d=await world(),count=await n('document_dependencies'),events=await n('review_events');
    await expectErr(await link(c.docId,d.docId,{upstreamRevisionId:undefined}),422,'INVALID_INPUT');
    await expectErr(await link(c.docId,d.docId,{upstreamRevisionId:a.revisionId}),409,'REVISION_CONFLICT');
    await proposeRev(h,pm,await new DocumentService(h.db).detail(pm,c.docId));
    await expectErr(await link(c.docId,d.docId,{upstreamRevisionId:c.revisionId}),409,'REVISION_CONFLICT');
    expect([await n('document_dependencies'),await n('review_events')]).toEqual([count,events]);
    const list=await call('GET','/api/reviews/dependencies?projectId='+ids.sales);
    expect(list.status).toBe(200); expect((await json(list)).data.total).toBe(1);
  });

  test('list endpoints need projectId, accept only the named parameters, and the service refuses a limit above 200',async()=>{
    const w=await world();
    for(const route of ['/api/reviews','/api/reviews/dependencies','/api/reviews/delegations','/api/decisions']) {
      const r=await call('GET',route); expect(r.status,route).toBe(422); expect((await json(r)).error.code).toBe('INVALID_INPUT');
      const bad=await call('GET',route+'?projectId=nope'); expect(bad.status,route).toBe(422);
      const extra=await call('GET',route+`?projectId=${ids.sales}&tenantId=${ids.otherTenant}`); expect(extra.status,route+' extra').toBe(422);
    }
    expect((await call('GET',`/api/reviews/${w.docId}?projectId=${ids.sales}`)).status).toBe(200);   // ignored: a read by id takes no parameter
    const q=`/api/reviews?projectId=${ids.sales}`;
    expect((await call('GET',q+'&limit=200')).status).toBe(200);
    for(const bad of ['201','0','-1','abc','1.5']) expect((await call('GET',q+'&limit='+bad)).status,bad).toBe(422);
    expect((await call('GET',q+'&offset=-1')).status).toBe(422);
    const page=await json(await call('GET',q+'&limit=1&offset=0'));
    expect(page.data.total).toBe(1); expect(page.data.items).toHaveLength(1);
    const detail=await call('GET','/api/reviews/'+w.docId); expect(detail.status).toBe(200);
    expect((await json(detail)).data.item).toBeTruthy();
    const decisions=await call('GET','/api/decisions?projectId='+ids.sales); expect(decisions.status).toBe(200);
    expect(Array.isArray((await json(decisions)).data.cards)).toBe(true);
  });

  test('dependency list: filters by documentId and needsReview, pages, and refuses an unknown parameter',async()=>{
    const a=await world(),b=await world(),c=await world();
    const link=(up:W,down:W)=>call('POST','/api/reviews/dependencies',{payload:{projectId:ids.sales,upstreamDocumentId:up.docId,upstreamRevisionId:up.revisionId,dependentDocumentId:down.docId}});
    expect((await link(a,b)).status).toBe(200); expect((await link(b,c)).status).toBe(200);
    await proposeRev(h,pm,await new DocumentService(h.db).detail(pm,b.docId));   // a newer revision of the upstream flags the link that depends on it
    const list=async(q:string)=>{const r=await call('GET','/api/reviews/dependencies?projectId='+ids.sales+q);return {status:r.status,body:await json(r)};};
    expect((await list('')).body.data.total).toBe(2);
    const byDoc=await list('&documentId='+a.docId); expect(byDoc.status).toBe(200); expect(byDoc.body.data.items.map((i:R)=>i.upstreamDocumentId)).toEqual([a.docId]);
    expect((await list('&documentId='+b.docId)).body.data.total).toBe(2);
    const flagged=await list('&needsReview=true'); expect(flagged.body.data.items.map((i:R)=>i.upstreamDocumentId)).toEqual([b.docId]);
    expect((await list('&needsReview=false')).body.data.items.map((i:R)=>i.upstreamDocumentId)).toEqual([a.docId]);
    const page=await list('&limit=1&offset=1'); expect(page.body.data.items).toHaveLength(1); expect(page.body.data.total).toBe(2);
    for(const bad of ['&needsReview=maybe','&limit=201','&limit=abc','&documentId=nope','&foo=1','&tenantId='+ids.otherTenant]) expect((await list(bad)).status,bad).toBe(422);
  });

  test('the Decisions list is reachable only at /api/decisions',async()=>{
    expect((await call('GET','/api/decisions?projectId='+ids.sales)).status).toBe(200);
    const alias=await call('GET','/api/reviews/decisions?projectId='+ids.sales);
    expect(alias.status).toBe(404);
    const unknown=await call('GET','/api/reviews/nothing/here');
    expect(await shape(alias)).toBe(await shape(unknown));
  });

  test('the request id in meta is generated by the server, one per request, and a body or query request id is not taken',async()=>{
    const sent=randomUUID();
    const a=await json(await call('GET','/api/reviews?projectId='+ids.sales));
    const b=await json(await call('GET','/api/reviews?projectId='+ids.sales));
    expect(a.meta.requestId).not.toBe(b.meta.requestId);
    const withQuery=await call('GET',`/api/reviews?projectId=${ids.sales}&requestId=${sent}`);
    expect(withQuery.status).toBe(422);
    expect((await json(withQuery)).meta.requestId).not.toBe(sent);
    const c=await call('POST','/api/reviews/delegations',{payload:G({requestId:sent})});
    expect(c.status).toBe(422); expect((await json(c)).meta.requestId).not.toBe(sent);
  });

  test('success and error responses of both functions carry Cache-Control: no-store',async()=>{
    const w=await world();
    const results:[string,Response][]=[
      ['200 queue',await call('GET','/api/reviews?projectId='+ids.sales)],
      ['200 detail',await call('GET','/api/reviews/'+w.docId)],
      ['200 decisions',await call('GET','/api/decisions?projectId='+ids.sales)],
      ['401',await call('GET','/api/reviews?projectId='+ids.sales,{cookie:null})],
      ['401 decisions',await call('GET','/api/decisions?projectId='+ids.sales,{cookie:null})],
      ['403 origin',await call('POST','/api/reviews/delegations',{payload:G(),origin:'https://evil.example'})],
      ['403 origin decisions',await call('POST','/api/decisions',{payload:{},origin:'https://evil.example'})],
      ['403 manager',await call('POST','/api/reviews/delegations',{cookie:login('technical'),payload:G({delegateId:reviewer.id})})],
      ['404',await call('GET','/api/reviews/nothing/here/at/all')],
      ['404 decisions',await call('PATCH','/api/decisions',{payload:{}})],
      ['409',await call('POST','/api/reviews/delegations/'+await delegate(h,ids.sales,member.id)+'/revoke',{payload:V(9)})],
      ['422 zod',await call('GET','/api/reviews')],
      ['422 zod decisions',await call('GET','/api/decisions')],
      ['422 json',await call('POST','/api/reviews/delegations',{raw:'{nope'})],
      ['400',await call('POST','/api/reviews/delegations',{payload:G(),key:null})],
    ];
    for(const [name,r] of results) expect(r.headers.get('cache-control'),name).toBe('no-store');
  });

  test('the delegation list passes through untouched, for a coordinator and for a non-coordinator',async()=>{
    await delegate(h,ids.sales,member.id);
    await delegate(h,ids.sales,reviewer.id,['design','requirements']);
    const revoked=await call('POST','/api/reviews/delegations',{payload:G({delegateId:approver.id})});
    expect(revoked.status).toBe(200);
    await grantDocApproval(h,approver.id,ids.sales,['design']);
    for(const profile of ['manager','engineer','technical','business'] as const) {
      const principal=demoProfiles[profile];
      const direct=JSON.parse(JSON.stringify(await new DelegationService(h.db).list(principal,{projectId:ids.sales})));
      const r=await call('GET','/api/reviews/delegations?projectId='+ids.sales,{cookie:login(profile)});
      expect(r.status,profile).toBe(200);
      const b=await json(r);
      expect(b.data,profile).toEqual(direct);
      expect(Object.keys(b.data).sort()).toEqual(['approvers','canDesignate','reviewers','reviewersTruncated']);
      expect(Object.keys(b)).toEqual(['data','error','meta']);
    }
    const coordinator=(await json(await call('GET','/api/reviews/delegations?projectId='+ids.sales))).data;
    const other=(await json(await call('GET','/api/reviews/delegations?projectId='+ids.sales,{cookie:login('technical')}))).data;
    expect(coordinator.canDesignate).toBe(true); expect(other.canDesignate).toBe(false);
    expect(coordinator.reviewers.length).toBeGreaterThan(0);
  });

  test('the review handler has no route that concerns document approval, and imports only its four services and the shared http helpers',async()=>{
    for(const route of ['/api/reviews/doc-approvals','/api/reviews/approvals','/api/reviews/accounts','/api/reviews/approvers','/api/reviews/delegations/approvers']) {
      for(const m of ['GET','POST','PATCH','PUT','DELETE']) {
        const r=await call(m,route+(m==='GET'?'?projectId='+ids.sales:''),{payload:m==='GET'?undefined:{}});
        expect(r.status,m+route).toBe(404);
      }
    }
    const src=await readFile('src/server/review-http.ts','utf8');
    const specs=[...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]).sort();
    const allowed=new Set(['node:crypto','zod','./auth','./db','./errors','./http','./document-review','./document-dependencies','./review-delegations','./decisions']);
    for(const s of specs) expect(allowed.has(s),s).toBe(true);
    for(const banned of ['accounts','identity','account-approval','suggestions','ai-scope','skill-context','access-grants']) expect(specs.some(s=>s.endsWith('/'+banned)),banned).toBe(false);
    expect(src).not.toMatch(/doc-approvals|api\/team/);
  });

  test('only these two route files import the review handler, and they import no service directly',async()=>{
    const walk=async(d:string):Promise<string[]>=>(await Promise.all((await readdir(d)).map(async f=>{const p=path.join(d,f);return (await stat(p)).isDirectory()?walk(p):[p];}))).flat();
    const importing=(await walk('src/app')).filter(f=>/\.(ts|tsx)$/.test(f));
    const users:string[]=[];
    for(const f of importing) if(/review-http/.test(await readFile(f,'utf8'))) users.push(f);
    expect(users.sort()).toEqual(['src/app/api/decisions/route.ts','src/app/api/reviews/[[...path]]/route.ts']);
    const mine=[...await walk('src/app/api/reviews'),...await walk('src/app/api/decisions')].filter(f=>/\.(ts|tsx)$/.test(f));
    expect(mine.length).toBe(2);
    for(const f of mine) {
      const src=await readFile(f,'utf8');
      const specs=[...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
      for(const s of specs) expect(['@/server/review-http','@/server/db'],f+' '+s).toContain(s);
      for(const banned of ['document-review','document-dependencies','review-delegations','decisions.ts']) expect(src,f).not.toMatch(new RegExp(`server/${banned.replace('.ts','')}['"]`));
      expect(src).toMatch(/runtime\s*=\s*'nodejs'/); expect(src).toMatch(/dynamic\s*=\s*'force-dynamic'/);
    }
  });
});
